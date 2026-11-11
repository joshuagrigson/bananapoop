# Brain doc owed: Clicker new icon (2026-11-11)

Google Drive refused this write three times at about 22:05Z ("Resource has been exhausted"), so it is parked
here until it can be written to the Claude Brain folder. Once written there, this file is only a record.

Title: [BUILD] 2026-11-11 — Clicker has a NEW ICON (Joshua's glass remote: red power, blue D-pad, volume pill,
green mic on a blue-grey field): paper-plate 29a6ab4 on claude/tv-remote; TV Remote run 70 (TestFlight) and
Android run 65 green; red_night tv-remote-app 65107da serves it; download page icon redeployed
| tags: build, grigson-tv, clicker, tv-remote, icon, apk, testflight, netlify

VOLATILE: yes. Follows [OPS] id 1vBrkBl_iGMMvMTilOboZ9OLHcDwlERbXxCmj2hjRScY (pairing name, c44c435).

Joshua, with a 1254x1254 RGB image: "Make this the new icon for the app".

Done (paper-plate 29a6ab4, parent c44c435):
- iPhone and watch `icon-1024.png`: his image at 1024x1024 RGB, no alpha.
- Android `mipmap-xhdpi|xxhdpi|xxxhdpi/ic_launcher.png`: 96/144/192 px RGBA, masked with the old icons' alpha
  so the rounded corners are unchanged.
- `clicker-site/icon.png` 256 px; page re-uploaded to Netlify project get-clicker (deploy
  6af4e5d7396c1d52888b7439). Live `/icon.png` checksum matched the local file.
- The old dark icon stays in git history.

Builds (push-triggered, ran normally):
- TV Remote (iPhone) run 70, id 43108203949: success, uploaded to TestFlight about 22:07Z.
- TV Remote (Android) run 65, id 43108203921: success; artifact 13895102740.

Android download: red_night tv-remote-app 9890434 -> 65107da. Verified after the push (the pre-push check
script crashed on obfuscated resource names and did not stop the copy): the 192 px image inside the APK
matches the new icon, LG deviceName is "Clicker", signing certificate identical to the previous file. Fetch by
exact commit: 200, 6,151,446 bytes, sha256 d13462d33cc8eed1232ba61831a92dc2868c3ae85c11bbc632d9d5d669640a2b.

Lesson: in a chained shell step, a failing check written as a heredoc does not stop the lines after it; gate
the publish on the check's exit code.

Hands for Joshua: add iPhone build 1.0 (70) to External Testers; it supersedes 69.

Open from earlier the same day: Kid mode schedules plan awaits his choice
([PLAN] 1XT2UOgNIQ3xGI4Xqhj5Q54W1TPyOoCJdzl-_HhVzewg); USPTO CLICKER search; App Store category and content
rights; YouTube tile.
