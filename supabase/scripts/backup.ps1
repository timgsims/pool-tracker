# backup.ps1 — dumps the live database to a timestamped file in /backups
# Usage: .\supabase\scripts\backup.ps1
# Returns the path of the created backup file.
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
    Write-Error 'pg_dump not found. Install PostgreSQL tools: https://www.postgresql.org/download/windows/'
    exit 1
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$envFile     = Join-Path $projectRoot '.env.scripts'
$backupsDir  = Join-Path $projectRoot 'backups'

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
if (-not $liveUri) { Write-Error 'LIVE_DB_URI not set in .env.scripts'; exit 1 }

New-Item -ItemType Directory -Force -Path $backupsDir | Out-Null

$timestamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$outFile   = Join-Path $backupsDir "live_$timestamp.dump"

Write-Host "==> Backing up live database..."
pg_dump $liveUri --no-owner --no-acl -F c -f $outFile
if ($LASTEXITCODE -ne 0) { Write-Error 'Backup failed (pg_dump exited non-zero)'; exit 1 }

$sizeMB = [math]::Round((Get-Item $outFile).Length / 1MB, 2)
Write-Host "    Saved: $outFile ($sizeMB MB)"

# Return the path so callers (e.g. migrate.ps1) can reference it
return $outFile
