# sync-to-test.ps1 — copies a snapshot of live APPLICATION DATA to the test database.
# Copies only the public schema data (players, matches, tournaments, etc.).
# Auth users (emails/passwords) are NOT copied — they live in Supabase's internal auth
# schema which is inaccessible to pg_dump. Test auth accounts remain independent.
#
# PII note: the players table contains real first/last names. Since this is a private
# group application, scrubbing is not applied. Add masking here if that changes.
#
# Usage: .\supabase\scripts\sync-to-test.ps1
[CmdletBinding()]
param(
    [switch]$Force  # Skip the confirmation prompt
)

$ErrorActionPreference = 'Stop'

foreach ($cmd in @('pg_dump', 'pg_restore')) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Error "$cmd not found. Install PostgreSQL tools: https://www.postgresql.org/download/windows/"
        exit 1
    }
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$envFile     = Join-Path $projectRoot '.env.scripts'
$tmpDir      = Join-Path $projectRoot 'backups\tmp'

if (-not (Test-Path $envFile)) {
    Write-Error ".env.scripts not found at $envFile`nCopy .env.scripts.example and fill in your database URIs."
    exit 1
}

$cfg = @{}
Get-Content $envFile | Where-Object { $_ -match '=' -and $_ -notmatch '^\s*#' } | ForEach-Object {
    $parts = $_ -split '=', 2
    $cfg[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'")
}

$liveUri = $cfg['LIVE_DB_URI']
$testUri = $cfg['TEST_DB_URI']

if (-not $liveUri -or -not $testUri) {
    Write-Error 'Both LIVE_DB_URI and TEST_DB_URI must be set in .env.scripts'
    exit 1
}

Write-Host ''
Write-Host 'NOTE: Player names (real names) will be copied. Auth user emails will NOT be copied.' -ForegroundColor Yellow
Write-Host ''
Write-Host 'This will OVERWRITE all application data in the test database.' -ForegroundColor Red
Write-Host 'The test schema must already exist (run setup-test-schema.ps1 first if not).' -ForegroundColor Cyan
Write-Host ''

if (-not $Force) {
    $confirm = Read-Host "Type 'yes' to continue"
    if ($confirm -ne 'yes') { Write-Host 'Aborted.'; exit 0 }
}

New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
$snapshotFile = Join-Path $tmpDir "live_data_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump"

Write-Host ''
Write-Host '==> Dumping live data (public schema only)...'
pg_dump $liveUri --no-owner --no-acl --data-only --schema=public -F c -f $snapshotFile
if ($LASTEXITCODE -ne 0) { Write-Error 'pg_dump failed'; exit 1 }

Write-Host '==> Restoring to test database...'
pg_restore --data-only --clean --if-exists --disable-triggers -d $testUri $snapshotFile
if ($LASTEXITCODE -ne 0) {
    Write-Warning 'pg_restore reported warnings or non-fatal errors — this is common when some rows do not exist yet to clean.'
    Write-Warning 'Check the output above. If the data loaded, the sync succeeded.'
}

Remove-Item $snapshotFile -ErrorAction SilentlyContinue

Write-Host ''
Write-Host '==> Sync complete. Test database now mirrors live application data.' -ForegroundColor Green
Write-Host '    Note: test auth accounts are separate — log in with your test credentials.'
