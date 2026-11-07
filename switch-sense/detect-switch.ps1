# detect-switch.ps1 — is the Nintendo Switch on the home Wi-Fi right now?
#
# Run on a Windows machine that is on the same Wi-Fi (Windows PowerShell 5.1 or PowerShell 7):
#   powershell -ExecutionPolicy Bypass -File .\detect-switch.ps1
#
# How it works: the Switch drops ping, so "ping" alone always says it is gone. What it
# cannot hide from is ARP: any host that is awake on the LAN answers "who has <ip>" with
# its MAC. We nudge the whole /24 once (cheap, parallel, ~1 s), then read the neighbor
# table and look for the Switch's MAC. Get-NetNeighbor's State is the verdict:
#   Reachable            -> answered ARP just now: ON the network
#   Stale / Delay / Probe -> answered recently, not this second: likely asleep in the dock
#   Unreachable / Incomplete / missing -> OFF (or on another network)

param(
  [string]$Mac = "20-0b-cf-9b-4a-34",   # Switch MAC from the home Wi-Fi census
  [string]$Ip  = "192.168.254.23",      # last known DHCP lease (used only to pick the subnet)
  [string]$Oui = "20-0b-cf"             # vendor prefix; catches the Switch if its lease moved
)

$macNorm = ($Mac -replace '[:.]', '-').ToLower()
$ouiNorm = ($Oui -replace '[:.]', '-').ToLower()
$prefix  = ($Ip -split '\.')[0..2] -join '.'

Write-Host "Nudging $prefix.0/24 so ARP fills in..." -ForegroundColor DarkGray
$tasks = foreach ($n in 1..254) {
  (New-Object System.Net.NetworkInformation.Ping).SendPingAsync("$prefix.$n", 400)
}
try { [System.Threading.Tasks.Task]::WaitAll([System.Threading.Tasks.Task[]]$tasks) } catch { }
Start-Sleep -Milliseconds 300

$neighbors = Get-NetNeighbor -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.LinkLayerAddress -and $_.LinkLayerAddress -ne '00-00-00-00-00-00' }

$exact = $neighbors | Where-Object { $_.LinkLayerAddress.ToLower() -eq $macNorm }
$same  = $neighbors | Where-Object { $_.LinkLayerAddress.ToLower().StartsWith($ouiNorm) -and $_.LinkLayerAddress.ToLower() -ne $macNorm }

if ($exact) {
  foreach ($e in $exact) {
    $verdict = switch -Regex ($e.State) {
      'Reachable'              { 'ON  - Switch is awake on the Wi-Fi right now' }
      'Stale|Delay|Probe'      { 'SEEN - Switch answered recently; probably asleep in the dock' }
      default                  { 'OFF? - entry present but not answering (State ' + $e.State + ')' }
    }
    Write-Host ("{0}  ip={1}  mac={2}  state={3}  via={4}" -f $verdict, $e.IPAddress, $e.LinkLayerAddress, $e.State, $e.InterfaceAlias)
  }
} else {
  Write-Host "OFF  - no ARP entry for $Mac on this subnet (powered off, or not on this Wi-Fi)" -ForegroundColor Yellow
}

if ($same) {
  Write-Host "Also saw other $Oui devices (same vendor prefix):" -ForegroundColor DarkGray
  $same | Format-Table IPAddress, LinkLayerAddress, State, InterfaceAlias -AutoSize | Out-String | Write-Host
}

Write-Host "Second opinion: the router's client list at http://$prefix.254" -ForegroundColor DarkGray
