# Revenue Station setup and daily start for Windows. Safe to run again any time: it skips what is already done.
# From PowerShell, in the folder that holds bananapoop:
#   powershell -ExecutionPolicy Bypass -File .\bananapoop\revenue-engine\setup.ps1
# A second, separate station (a barbershop, a salon, a family allowance chart, any business with its own rooms) keeps
# its own ledger, rooms and links in data-<name> and runs on its own port, side by side with the first:
#   powershell -ExecutionPolicy Bypass -File .\bananapoop\revenue-engine\setup.ps1 -Station shop
#   powershell -ExecutionPolicy Bypass -File .\bananapoop\revenue-engine\setup.ps1 -Station family
param([switch]$NoServe, [string]$Station = '', [int]$Port = 0)

# 'Continue', not 'Stop': Windows PowerShell 5.1 can treat git's and npm's normal progress output on stderr as a
# fatal error under 'Stop'. Every real failure below is caught by checking exit codes and throwing on purpose.
$ErrorActionPreference = 'Continue'
Set-Location -Path $PSScriptRoot
$onWindows = $env:OS -eq 'Windows_NT'
$npm = if ($onWindows) { 'npm.cmd' } else { 'npm' }
$named = [bool]$Station
if ($named) {
  if ($Station -notmatch '^[a-z0-9][a-z0-9-]{0,19}$') { throw 'Use a short lowercase station name, like: -Station shop' }
  $env:REVENUE_ENGINE_DATA = Join-Path $PSScriptRoot "data-$Station"
  if (-not $Port) { $Port = 8791 }
} else {
  if (-not $Port) { $Port = 8790 }
}

function Say($msg) { Write-Host "`n== $msg" -ForegroundColor Cyan }

Say 'Getting the latest version'
if (Get-Command git -ErrorAction SilentlyContinue) {
  & git -C $PSScriptRoot pull --ff-only
  if ($LASTEXITCODE -ne 0) { Write-Host 'Could not update (offline or local changes). Using the copy you have.' -ForegroundColor Yellow }
}

Say 'Checking Node.js'
$major = 0
if (Get-Command node -ErrorAction SilentlyContinue) { $major = [int](((& node -v) -replace '^v', '').Split('.')[0]) }
if ($major -lt 22) {
  if ($onWindows -and (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Host 'Installing Node.js with winget...'
    & winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
    Write-Host 'Node.js is installed. Close this window, open a new PowerShell, and paste the same command again.' -ForegroundColor Yellow
  } else {
    Write-Host 'Install Node.js 22 or newer from https://nodejs.org, then run this again.' -ForegroundColor Yellow
  }
  exit 1
}
Write-Host "Node $(& node -v) is ready."

Say 'Installing packages'
& $npm install --no-audit --no-fund | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'npm install failed. Check your internet connection and run this again.' }

Say 'Anthropic API key'
if (-not $env:ANTHROPIC_API_KEY -and $onWindows) {
  $saved = [Environment]::GetEnvironmentVariable('ANTHROPIC_API_KEY', 'User')
  if ($saved) { $env:ANTHROPIC_API_KEY = $saved }
}
if ($named -and -not $env:ANTHROPIC_API_KEY) {
  Write-Host 'Skipped: this station tracks sales and needs no key. A key only matters if you hire agents later.'
} elseif (-not $env:ANTHROPIC_API_KEY) {
  Write-Host 'Get a key at https://console.anthropic.com/settings/keys'
  $secure = Read-Host 'Paste your key and press Enter (it stays hidden)' -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  $key = $key.Trim()
  if ($key -notmatch '^sk-ant-') { throw 'That does not look like an Anthropic key. It should start with sk-ant-. Run this again and paste the key.' }
  if ($onWindows) { [Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', $key, 'User') }
  $env:ANTHROPIC_API_KEY = $key
  Write-Host 'Saved to your Windows account, so you only do this once.'
} else {
  Write-Host 'Key found.'
}

if ($named) {
  Say "Station '$Station'"
  Write-Host "Its ledger, rooms and income links live in $env:REVENUE_ENGINE_DATA (never uploaded anywhere)."
  if ($NoServe) { Say 'Setup done (not starting the station because -NoServe was given).'; exit 0 }
  Say 'Starting the station'
  Write-Host 'Your browser opens in a moment. The first time, pick what it is for (a service shop like a barber, or an'
  Write-Host 'allowance tracker for kids), pick a world (space, castle, farm, cyber city, alien ship, ocean) and name it.'
  Write-Host 'A shop: open Sync, link Square, and every sale lands in the room for its service.'
  Write-Host 'An allowance chart: add the kids, then check chores off in their rooms and pay them from the vault.'
  Write-Host 'Leave this window open: closing it stops the sync. Paste the same command again to update and restart.'
  & node src/cli.js serve --port $Port --open
  exit 0
}

Say 'Finding new local businesses (free Texas records)'
& node src/cli.js harvest | Out-Host
if ($LASTEXITCODE -ne 0) { Write-Host 'The Texas data site did not answer. The station still starts; it tries again daily.' -ForegroundColor Yellow }

Say 'Client #1'
$clients = (& node src/cli.js clients gbp-management) -join "`n"
if ($clients -notmatch 'Randi') {
  & node src/cli.js client add gbp-management --name "Hair by Randi Marlene" --city Texarkana --category "hair salon" --monthly 0 | Out-Host
} else {
  Write-Host 'Randi is already a client.'
}

Say 'Standing jobs'
$jobs = (& node src/cli.js jobs) -join "`n"
if ($jobs -notmatch ' auditor -> gbp-management') { & node src/cli.js job add auditor --path gbp-management --every 24 --max-usd 1 | Out-Host }
if ($jobs -notmatch ' manager -> gbp-management') { & node src/cli.js job add manager --path gbp-management --every 24 --max-usd 2 | Out-Host }
& node src/cli.js jobs | Out-Host

if ($NoServe) { Say 'Setup done (not starting the station because -NoServe was given).'; exit 0 }

Say 'Starting the Revenue Station'
Write-Host 'Your browser opens in a moment. Leave this window open: closing it stops the agents.'
Write-Host 'The auditor starts within a minute and spends at most $1 a run and $5 a day.'
Write-Host 'Tomorrow, paste the same command again to update and restart.'
& node src/cli.js serve --port $Port --harvest-daily --open
