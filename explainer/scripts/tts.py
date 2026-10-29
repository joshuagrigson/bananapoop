#!/usr/bin/env python3
"""Narrate every block of a script with Kokoro (free, local) and measure it.

Input : script.json  (see explainer/demo/script.json for the shape)
Output: <out>/narration.wav      one continuous track, blocks separated by `gap` seconds
        <out>/timeline.json      per-block start/end/speech seconds, text, voice
Usage : tts.py script.json outdir [--models DIR]
"""
import json, sys, os, argparse
import numpy as np
import soundfile as sf

ap = argparse.ArgumentParser()
ap.add_argument("script")
ap.add_argument("out")
ap.add_argument("--models", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".models"))
a = ap.parse_args()

from kokoro_onnx import Kokoro  # noqa: E402  (import after argparse so --help is fast)

doc = json.load(open(a.script))
os.makedirs(a.out, exist_ok=True)
k = Kokoro(os.path.join(a.models, "kokoro-v1.0.onnx"), os.path.join(a.models, "voices-v1.0.bin"))

default_voice = doc.get("voice", "am_michael")
speed = float(doc.get("speed", 1.0))
gap = float(doc.get("gap", 0.45))          # silence between blocks
lead = float(doc.get("lead", 0.6))         # silence before the first word
SR = 24000

def lang_for(voice):
    return "en-gb" if voice.startswith("b") else "en-us"

def trim(x, thresh=0.01, pad=0.08):
    """Cut leading/trailing near-silence, keep a small pad."""
    idx = np.where(np.abs(x) > thresh)[0]
    if len(idx) == 0:
        return x
    p = int(pad * SR)
    return x[max(0, idx[0] - p): min(len(x), idx[-1] + p)]

track = [np.zeros(int(lead * SR), dtype=np.float32)]
t = lead
timeline = []
for i, b in enumerate(doc["blocks"]):
    voice = b.get("voice", default_voice)
    samples, sr = k.create(b["narration"], voice=voice, speed=speed, lang=lang_for(voice))
    assert sr == SR, sr
    samples = trim(samples.astype(np.float32))
    speech = len(samples) / SR
    timeline.append({
        "index": i,
        "start": round(t, 3),
        "speech": round(speech, 3),
        "end": round(t + speech + gap, 3),
        "voice": voice,
        "headline": b.get("headline", ""),
        "lines": b.get("lines", []),
        "icon": b.get("icon", ""),
        "narration": b["narration"],
    })
    track.append(samples)
    track.append(np.zeros(int(gap * SR), dtype=np.float32))
    t += speech + gap
    print(f"block {i+1:02d} {voice:12s} {speech:5.1f}s  {b['narration'][:60]}")

audio = np.concatenate(track)
sf.write(os.path.join(a.out, "narration.wav"), audio, SR)
json.dump({"title": doc.get("title", ""), "brand": doc.get("brand", ""), "accent": doc.get("accent"),
           "duration": round(len(audio) / SR, 3), "blocks": timeline},
          open(os.path.join(a.out, "timeline.json"), "w"), indent=1)
print(f"total {len(audio)/SR:.1f}s -> {a.out}/narration.wav")
