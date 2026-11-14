#!/usr/bin/env bash
# Render one script in every scene style (narration is generated once and reused). Usage: build_styles.sh script.json outdir [WxH]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$1"; OUT="$2"; SIZE="${3:-1080x1920}"
mkdir -p "$OUT/work"
python3 "$HERE/tts.py" "$SCRIPT" "$OUT/work" --models "$HERE/../.models"
STYLES="editorial whiteboard handdrawn pixel studio3d colorful3d mannequin mix3d"
printf '%s\n' $STYLES | xargs -P 2 -I{} sh -c "python3 '$HERE/build.py' '$SCRIPT' --out '$OUT' --scene '$HERE/../scenes/{}.html' --name '{}' --size '$SIZE' --reuse-audio > '$OUT/{}.log' 2>&1 && echo 'done {}' || echo 'FAILED {}'"
