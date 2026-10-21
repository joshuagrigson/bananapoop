; Let the phone reach Fling on port 47777 without Windows asking first.
; Public is included because Windows files the iPhone hotspot under Public.
!macro customInstall
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Fling"'
  nsExec::Exec 'netsh advfirewall firewall add rule name="Fling" dir=in action=allow program="$INSTDIR\Fling.exe" protocol=TCP localport=47777 profile=private,public enable=yes'
!macroend

!macro customUnInstall
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Fling"'
!macroend
