# Usage (after Railway shows your public URL):
#   .\scripts\point-netlify-to-railway.ps1 -RailwayUrl "https://xxxx.up.railway.app"
# Requires: netlify CLI logged in (netlify status), linked to this repo's site.

param(
  [Parameter(Mandatory = $true, HelpMessage = "Public HTTPS URL from Railway → Networking → Generate Domain")]
  [string]$RailwayUrl
)

$ErrorActionPreference = "Stop"
# scripts/ -> repo root (folder that contains netlify.toml)
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
if (-not (Test-Path "netlify.toml")) {
  Write-Error "Run from repo root; netlify.toml not found in $root"
}

$url = $RailwayUrl.Trim().TrimEnd("/")
if ($url -notmatch "^https://") {
  Write-Error "Use full URL starting with https://"
}

Write-Host "Setting STARS_BACKEND_URL for Netlify production..."
netlify env:set STARS_BACKEND_URL $url --context production

Write-Host "Triggering production build + deploy..."
netlify deploy --build --prod

Write-Host "Done. Site: https://stars-family-board.netlify.app"
Write-Host "Test API via Netlify proxy: $($url)/healthz"
