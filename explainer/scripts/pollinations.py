#!/usr/bin/env python3
"""Paint plates on Pollinations (free, anonymous, no account) when the ZeroGPU quota is spent.

Usage: pollinations.py script.json style outdir [--seed 7]
Writes outdir/<style>/blockNN.png + manifest.json, the same layout as hf_spaces.py / assets.py,
so build.py --assets picks the plates up as already painted. Existing plates are kept.
Known limits (2026-11-02): returns about 686x858 whatever size is asked, softer than Qwen-Image,
small "pollinations.ai" mark bottom-right (the reel scene's bottom shade covers it), HTTP 402
means rate-limited: wait and retry.
"""
import argparse, json, os, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from hf_spaces import STYLE_PREFIX, SUFFIX  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("script"); ap.add_argument("style"); ap.add_argument("out")
ap.add_argument("--seed", type=int, default=7)
a = ap.parse_args()

doc = json.load(open(a.script))
outdir = os.path.join(a.out, a.style); os.makedirs(outdir, exist_ok=True)
prefix = STYLE_PREFIX.get(a.style, ""); suffix = SUFFIX.get(a.style, SUFFIX["default"])
portrait = str(doc.get("orientation", "portrait")).lower().startswith("p")
w, h = (1080, 1920) if portrait else (1920, 1080)
mpath = os.path.join(outdir, "manifest.json")
manifest = {k: v for k, v in (json.load(open(mpath)) if os.path.exists(mpath) else {}).items() if os.path.exists(v)}

for i, b in enumerate(doc["blocks"]):
    if str(i) in manifest:
        continue
    prompt = f"{prefix}{b.get('scene') or b.get('headline') or b['narration']}, {suffix}"
    url = (f"https://image.pollinations.ai/prompt/{urllib.parse.quote(prompt)}"
           f"?width={w}&height={h}&nologo=true&model=flux&seed={a.seed + i}")
    path = os.path.join(outdir, f"block{i+1:02d}.png")
    for attempt in range(6):
        try:
            t = time.time()
            data = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "explainer/1.0"}), timeout=180).read()
            from PIL import Image; import io
            Image.open(io.BytesIO(data)).convert("RGB").save(path)
            manifest[str(i)] = os.path.abspath(path)
            print(f"block {i+1:02d} {time.time()-t:5.1f}s  {prompt[:80]}", flush=True)
            break
        except Exception as e:
            print(f"   retry {attempt+1} block {i+1:02d}: {str(e)[:120]}", flush=True)
            time.sleep(8 * (attempt + 1))
    json.dump(manifest, open(mpath, "w"), indent=1)
print(f"{len(manifest)}/{len(doc['blocks'])} plates -> {outdir}")
sys.exit(0 if len(manifest) == len(doc["blocks"]) else 2)
