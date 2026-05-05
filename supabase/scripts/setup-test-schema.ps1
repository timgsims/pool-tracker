# setup-test-schema.ps1 — ONE-TIME script to initialise the test database from the live schema.
# Dumps the public schema from live and applies it to a fresh test Supabase project.
# Run this once after creating the test project. Do NOT run again unless resetting test entirely.
#
# Usage: .\supabase\scripts\setup-test-schema.ps1
[CmdletBinding()]
param(
    [switch]$Force  # Skip the confirmation prompt
)

$ErrorActionPreference = 'Stop'

foreach ($cmd in @('pg_dump', 'psql')) {
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
Write-Host 'This will apply the live database schema to the test database.' -ForegroundColor Cyan
Write-Host 'The test database must be a fresh Supabase project with no existing pool-tracker tables.' -ForegroundColor Cyan
Write-Host 'If any pool-tracker tables already exist in test, this will produce errors.' -ForegroundColor Yellow
Write-Host ''

if (-not $Force) {
    $confirm = Read-Host "Type 'yes' to continue"
    if ($confirm -ne 'yes') { Write-Host 'Aborted.'; exit 0 }
}

New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
$schemaFile = Join-Path $tmpDir 'live_schema.sql'

Write-Host ''
Write-Host '==> Dumping live schema (public schema only)...'
pg_dump $liveUri --no-owner --no-acl --schema-only --schema=public -F p -f $schemaFile
if ($LASTEXITCODE -ne 0) { Write-Error 'pg_dump failed'; exit 1 }

Write-Host '==> Applying schema to test database...'
psql $testUri -f $schemaFile
if ($LASTEXITCODE -ne 0) {
    Write-Warning 'psql reported errors. This may be harmless if some objects already exist (e.g. extensions).'
    Write-Warning 'Check the output above. If the pool-tracker tables were created, the setup succeeded.'
}

Remove-Item $schemaFile -ErrorAction SilentlyContinue

Write-Host ''
Write-Host '==> Schema applied. Next steps:' -ForegroundColor Green
Write-Host '    1. Sign up for an account in your test Supabase project (via the app with test env running)'
Write-Host '    2. In the test project SQL Editor, promote yourself to admin:'
Write-Host "       UPDATE user_roles SET role = 'admin' WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your@email.com');"
Write-Host '    3. Optionally run sync-to-test.ps1 to copy live data into the test database.'
