# explainer — free faceless explainer videos

Produces a finished narrated explainer (MP4 + thumbnail PNG) with no paid service:
Kokoro text-to-speech on the local CPU, scenes drawn in headless Chromium, assembled by ffmpeg.
Default output is 1080x1920 (Instagram Reels, Facebook Reels/Stories, Pinterest video pins).
Pass `--size 1920x1080` for YouTube.

## One-time setup (per machine or per cloud sandbox)

```bash
bash explainer/setup.sh        # pip installs kokoro-onnx, downloads ~350 MB of model files
```

## Make a video

```bash
python3 explainer/scripts/build.py explainer/demo/script.json
# -> explainer/demo/out/ocr-first-tour-demo.mp4 and .png
```

A 55-second vertical video takes about 3 minutes on a 4-core box, most of it screenshotting frames.

### Painted plates (one picture per block)

```bash
python3 explainer/scripts/build.py explainer/demo/styles-script.json --scene explainer/scenes/colorful3d.html --assets
```

`--assets` paints one plate per block from the block's `scene` text, in the look of the chosen scene
style, and the scene page shows it behind the icon. The default model is **Qwen-Image-Fast** on a free
Hugging Face Space (about 3 to 12 seconds a plate). `--assets flux` uses FLUX.1-schnell (4 seconds a
plate, a little less on-style). If the Space is unreachable or the day's free ZeroGPU quota is spent, the
missing plates are painted locally with SDXL-Turbo on the CPU (about 50 seconds each after a one-time
model load). `--assets draft` or `--assets final` skips the Space and uses only the local model.

The Space needs a Hugging Face token that reaches huggingface.co (an `HF_TOKEN` environment variable,
or a proxy that injects it). A free account's ZeroGPU quota covers roughly one video's plates a day.

`explainer/scripts/hf_spaces.py --animate plate.png out.mp4` turns a plate into a 3.5-second motion clip
with Wan 2.2 on the same free quota (about 40 seconds).

## Script format

```json
{
  "title": "Your First Tour at Ocean Canyon",
  "brand": "Ocean Canyon Resorts",
  "slug": "ocr-first-tour",
  "voice": "am_onyx",
  "speed": 1.0,
  "gap": 0.5,
  "accent": "#1f6f5f",
  "blocks": [
    { "icon": "map", "headline": "Ninety minutes. One resort. No pressure.",
      "lines": ["A guided drive through the resort", "Ask anything you want"],
      "narration": "Your first tour at Ocean Canyon is a ninety minute guided look at one resort." ,
      "voice": "af_bella" }
  ]
}
```

- One block = one spoken beat. Keep narration to 15 to 30 words so each block lands at 6 to 10 seconds.
- `voice` on a block overrides the top-level voice. English voices: `af_*` American female, `am_*` American male, `bf_*`/`bm_*` British.
- Icons: `map clock phone key star check dollar`.
- Captions are generated from the narration automatically and highlighted word by word.

## How it works

```
script.json ──> scripts/tts.py ──────> work/narration.wav + work/timeline.json
                 (Kokoro, measures          │
                  every block)               ▼
                                scripts/render.mjs ──> work/video_silent.mp4
                                 (Playwright seeks the scene page frame by frame,
                                  pipes PNGs into ffmpeg/x264)
                                             │
                                             ▼
                                ffmpeg mux narration ──> out/<slug>.mp4
                                scripts/thumbnail.mjs ──> out/<slug>.png
```

`scenes/editorial.html` is the look. It is a plain web page that exposes `window.setData(timeline)`
and `window.seek(seconds)`, and paints the exact frame for that time, so renders are deterministic.
Add a new style by copying it and keeping those two functions.

## Limits

- Painted plates depend on a free Hugging Face quota, or on a slow CPU fallback; there is no paid tier wired in.
- No lip-sync or on-screen presenter.
- Kokoro voices are good broadcast-neutral narrators, not ElevenLabs-grade actors.
