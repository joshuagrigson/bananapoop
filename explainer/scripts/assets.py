#!/usr/bin/env python3
"""Paint one style-locked plate per block with a free local image model (CPU).

Usage: assets.py script.json style outdir [--tier draft|final]
  draft = stabilityai/sd-turbo  512px 2 steps  (~9 s each on 4 CPUs)
  final = stabilityai/sdxl-turbo 768px 4 steps (~48 s each)
Writes outdir/<style>/blockNN.png and outdir/<style>/manifest.json ({index: path}).
Each block's `scene` field is the subject; the style supplies the look. Blocks without a
`scene` fall back to their headline. Identical prompt + seed -> identical plate (reproducible).
"""
import argparse, json, os, sys, time

STYLE_PREFIX = {
    "colorful3d": "colorful 3D render, pixar style, soft rounded shapes, candy colors, warm sunset light, soft shadows, clean composition, ",
    "studio3d":   "clean 3D studio render, matte clay materials, soft studio lighting, pale grey seamless background, centered product shot, ",
    "whiteboard": "simple black line art illustration, thick black marker outlines, pure white background, flat, no color fill, minimal clip-art style, one small red accent, ",
    "handdrawn":  "pencil sketch on cream paper, graphite hatching, loose hand-drawn lines, one red pencil accent, ",
    "editorial":  "flat editorial illustration, bold shapes, limited palette of deep teal, cream and orange, grainy texture, ",
    "mix3d":      "bold flat vector poster illustration, yellow and blue and black, halftone dots, screen-print texture, ",
    "pixel":      "16-bit pixel art, retro video game scene, limited palette, crisp pixels, ",
    "mannequin":  "wooden artist mannequin figure posed in a simple grey studio, soft light, ",
}
SUFFIX = {"whiteboard": "no text, no watermark, no photo, no hands, no shading", "handdrawn": "no text", "default": "no text, no watermark, no people's faces close up"}

ap = argparse.ArgumentParser()
ap.add_argument("script"); ap.add_argument("style"); ap.add_argument("out")
ap.add_argument("--tier", default="final", choices=["draft", "final"])
ap.add_argument("--seed", type=int, default=7)
a = ap.parse_args()

doc = json.load(open(a.script))
outdir = os.path.join(a.out, a.style); os.makedirs(outdir, exist_ok=True)
prefix = STYLE_PREFIX.get(a.style, "")
suffix = SUFFIX.get(a.style, SUFFIX["default"])
portrait = str(doc.get("orientation", "portrait")).lower().startswith("p")

mpath = os.path.join(outdir, "manifest.json")
if os.path.exists(mpath):
    m = json.load(open(mpath))
    if len(m) == len(doc["blocks"]) and all(os.path.exists(v) for v in m.values()) and not os.environ.get("ASSETS_FORCE"):
        print(f"reusing {len(m)} plates in {outdir} (set ASSETS_FORCE=1 to repaint)"); sys.exit(0)

import torch
from diffusers import AutoPipelineForText2Image
t0 = time.time()
if a.tier == "draft":
    model, steps, w, h = "stabilityai/sd-turbo", 2, 512, 512
else:
    model, steps, w, h = "stabilityai/sdxl-turbo", 4, (640 if portrait else 896), (896 if portrait else 640)
pipe = AutoPipelineForText2Image.from_pretrained(model, torch_dtype=torch.float32).to("cpu")
pipe.set_progress_bar_config(disable=True)
print(f"{model} loaded in {time.time()-t0:.1f}s; {w}x{h} {steps} steps", flush=True)

manifest = {}
for i, b in enumerate(doc["blocks"]):
    subject = b.get("scene") or b.get("headline") or b["narration"]
    prompt = f"{prefix}{subject}, {suffix}"
    g = torch.Generator("cpu").manual_seed(a.seed + i)
    t1 = time.time()
    img = pipe(prompt=prompt, num_inference_steps=steps, guidance_scale=0.0, width=w, height=h, generator=g).images[0]
    path = os.path.join(outdir, f"block{i+1:02d}.png"); img.save(path)
    manifest[str(i)] = os.path.abspath(path)
    print(f"block {i+1:02d} {time.time()-t1:5.1f}s  {prompt[:90]}", flush=True)
json.dump(manifest, open(os.path.join(outdir, "manifest.json"), "w"), indent=1)
print(f"{len(manifest)} plates -> {outdir}")
