# Switch Sense

Tells you whether the Nintendo Switch is on the home Wi-Fi, from any Windows machine on that Wi-Fi.

```
powershell -ExecutionPolicy Bypass -File .\detect-switch.ps1
```

Output is one line: `ON`, `SEEN` (answered ARP recently, probably asleep in the dock) or `OFF`.

Why not ping: the Switch drops ICMP, so ping says "timed out" even when it is on. ARP is the honest signal. The script nudges every address in the /24 once so the neighbor table fills, then reads `Get-NetNeighbor` for the Switch's MAC and reports its State.

Defaults are the home network values (MAC `20-0b-cf-9b-4a-34`, lease `192.168.254.23`). Override with `-Mac` and `-Ip` for another console or subnet.
