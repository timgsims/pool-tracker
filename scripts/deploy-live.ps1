# Deploy live build to sentinel (pool.simsey.co.nz)
# Uses .env (live Supabase instance)
# Always update CHANGELOG.md before running this script.

Set-Location $PSScriptRoot\..

Write-Host "Building..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed" -ForegroundColor Red; exit 1 }

Write-Host "Deploying to sentinel..." -ForegroundColor Cyan
scp -r dist/* sentinel-admin@100.69.34.6:/opt/docker/pool-tracker/dist/
if ($LASTEXITCODE -ne 0) { Write-Host "Deploy failed" -ForegroundColor Red; exit 1 }

ssh sentinel-admin@100.69.34.6 "chmod -R 755 /opt/docker/pool-tracker/dist/ && docker exec pool-tracker nginx -s reload"

Write-Host "Done -> https://pool.simsey.co.nz" -ForegroundColor Green
