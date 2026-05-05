# migrate.ps1 — applies pending SQL migration files from supabase/migrations/ to a target database.
# For the live target, a backup is taken automatically before any migration runs.
# Migration files are applied in alphabetical (numeric) order and tracked in schema_migrations.
#
# Usage:
#   .\supabase\scripts\migrate.ps1 -Target test          # apply pending migrations to test
#   .\supabase\scripts\migrate.ps1 -Target live          # backup live, then apply pending migrations
#   .\supabase\scripts\migrate.ps1 -Target live -DryRun  # show what would run, without applying
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('test', 'live')]
    [string]$Target,

    [switch]$DryRun   # List pending migrations without applying them
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Error 'psql not found. Install PostgreSQL tools: https://www.postgresql.org/download/windows/'
    exit 1
}

$projectRoot    = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$envFile        = Join-Path $projectRoot '.env.scripts'
$migrationsDir  = Join-Path $projectRoot 'supabase\migrations'

if (-not (Test-Path $envFile)) {
    Write-Error ".env.scripts not found at $envFile`nCopy .env.scripts.example and fill in your database URIs."
    exit 1
}

$cfg = @{}
Get-Content $envFile | Where-Object { $_ -match '=' -and $_ -notmatch '^\s*#' } | ForEach-Object {
    $parts = $_ -split '=', 2
    $cfg[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'")
}

$dbUri = if ($Target -eq 'live') { $cfg['LIVE_DB_URI'] } else { $cfg['TEST_DB_URI'] }
if (-not $dbUri) { Write-Error "$($Target.ToUpper())_DB_URI not set in .env.scripts"; exit 1 }

# Collect migration files
$migrations = @(Get-ChildItem $migrationsDir -Filter '*.sql' | Sort-Object Name)

if ($migrations.Count -eq 0) {
    Write-Host 'No migration files found in supabase/migrations/. Nothing to do.'
    exit 0
}

# Backup live before touching it
if ($Target -eq 'live' -and -not $DryRun) {
    Write-Host '==> Backing up live database first...'
    $backupScript = Join-Path $PSScriptRoot 'backup.ps1'
    & $backupScript
    if ($LASTEXITCODE -ne 0) {
        Write-Error 'Backup failed. Aborting — live database was not touched.'
        exit 1
    }
}

# Ensure tracking table exists
psql $dbUri -c "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW());" | Out-Null

# Get already-applied migrations
$appliedRaw = psql $dbUri -t -A -c 'SELECT filename FROM schema_migrations ORDER BY filename;'
$applied    = @($appliedRaw -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ })

# Determine pending migrations
$pending = @($migrations | Where-Object { $applied -notcontains $_.Name })

# Report status
foreach ($f in $migrations) {
    $status = if ($applied -contains $f.Name) { '[applied]' } else { '[pending]' }
    $color  = if ($applied -contains $f.Name) { 'DarkGray' } else { 'Cyan' }
    Write-Host "  $status $($f.Name)" -ForegroundColor $color
}
Write-Host ''

if ($pending.Count -eq 0) {
    Write-Host "==> $Target is already up to date." -ForegroundColor Green
    exit 0
}

if ($DryRun) {
    Write-Host "==> DRY RUN: $($pending.Count) migration(s) would be applied to $Target. No changes made." -ForegroundColor Yellow
    exit 0
}

# Apply pending migrations
foreach ($file in $pending) {
    Write-Host "==> Applying $($file.Name) to $Target..."
    psql $dbUri -f $file.FullName
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Migration failed: $($file.Name)`nThe database may be in a partially-applied state. Review the error above."
        exit 1
    }
    psql $dbUri -c "INSERT INTO schema_migrations (filename) VALUES ('$($file.Name)') ON CONFLICT DO NOTHING;" | Out-Null
    Write-Host "    Done." -ForegroundColor Green
}

Write-Host ''
Write-Host "==> $($pending.Count) migration(s) applied to $Target successfully." -ForegroundColor Green
