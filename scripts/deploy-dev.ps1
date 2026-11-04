# Deploy dev build to sentinel (dev.pool.simsey.co.nz)
# Uses .env.development (test Supabase instance)

Set-Location $PSScriptRoot\..

Write-Host "Building..." -ForegroundColor Cyan
# --mode development loads .env.development (test Supabase, orange border and icons)
node ./node_modules/vite/bin/vite.js build --mode development
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed" -ForegroundColor Red; exit 1 }

Write-Host "Deploying to sentinel..." -ForegroundColor Cyan
scp -r dist/* sentinel-admin@100.69.34.6:/opt/docker/pool-tracker-dev/dist/
if ($LASTEXITCODE -ne 0) { Write-Host "Deploy failed" -ForegroundColor Red; exit 1 }

ssh sentinel-admin@100.69.34.6 "docker exec pool-tracker-dev nginx -s reload"

Write-Host "Done -> https://dev.pool.simsey.co.nz" -ForegroundColor Green
