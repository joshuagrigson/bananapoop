#!/usr/bin/env bash
# Animate the three Qwen colorful3d demo plates with Wan 2.2 on the free Hugging Face Space.
# One block per call, ~40 s each when ZeroGPU quota is available. Skips clips already made,
# so re-run it after a quota refusal and it picks up where it stopped.
# Usage: animate_demo.sh [outdir]   (default: explainer/demo/plates/qwen-colorful3d)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PLATES="$HERE/../demo/plates/qwen-colorful3d"
OUT="${1:-$PLATES}"; mkdir -p "$OUT"

declare -A MOTION=(
  [block01]="the golf cart drives slowly forward along the path, the three people smile and look around, palm fronds sway, gentle camera dolly following the cart, smooth pixar style animation"
  [block02]="the phone screen pulses and the phone buzzes gently on the table, soft sunrise light shifts, leaves move in a light breeze, slow push-in on the phone, smooth pixar style animation"
  [block03]="the family walks up the steps toward the door holding hands, the flags ripple in the breeze, the lantern glow flickers warmly, slow camera push-in, smooth pixar style animation"
)

for b in block01 block02 block03; do
  clip="$OUT/${b}_wan.mp4"
  if [ -s "$clip" ]; then echo "have $clip"; continue; fi
  echo "== $b"
  python3 "$HERE/hf_spaces.py" --animate "$PLATES/$b.png" "$clip" --motion "${MOTION[$b]}" --seed 7
done
echo "all three clips in $OUT"
