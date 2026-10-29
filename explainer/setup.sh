#!/usr/bin/env bash
# One-time (per sandbox) setup for the free explainer pipeline.
# Installs Kokoro ONNX text-to-speech and downloads its model files (~350 MB).
# Idempotent: re-running skips what is already present.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
MODELS="${KOKORO_DIR:-$HERE/.models}"
mkdir -p "$MODELS"

python3 -c "import kokoro_onnx, soundfile" 2>/dev/null || pip install --quiet kokoro-onnx soundfile

BASE="https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
[ -s "$MODELS/kokoro-v1.0.onnx" ] || curl -sSL -o "$MODELS/kokoro-v1.0.onnx" "$BASE/kokoro-v1.0.onnx"
[ -s "$MODELS/voices-v1.0.bin" ]  || curl -sSL -o "$MODELS/voices-v1.0.bin"  "$BASE/voices-v1.0.bin"

node -e "require('playwright')" 2>/dev/null || echo "WARN: playwright not importable from node; the cloud sandbox has it preinstalled, elsewhere run: npm i playwright && npx playwright install chromium"
command -v ffmpeg >/dev/null || { echo "ffmpeg is required"; exit 1; }
echo "ready: models in $MODELS"
