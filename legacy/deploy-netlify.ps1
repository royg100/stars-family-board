# One-time: npx netlify-cli login
# Run: powershell -ExecutionPolicy Bypass -File .\deploy-netlify.ps1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host "npm install..." -ForegroundColor Cyan
npm install

Write-Host "netlify deploy (production)..." -ForegroundColor Cyan
npx --yes netlify-cli deploy --build --prod

Write-Host "Done. Site: https://stars-family-board.netlify.app" -ForegroundColor Green
