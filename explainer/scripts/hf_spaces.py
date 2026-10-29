#!/usr/bin/env python3
"""Paint plates (and optionally animate one) on free Hugging Face ZeroGPU Spaces.

Usage:
  hf_spaces.py script.json style outdir [--model qwen|flux]      # one plate per block (qwen default)
  hf_spaces.py --animate plate.png out.mp4 [--motion "..."]       # Wan 2.2 image-to-video

Needs an HF token reaching huggingface.co (env HF_TOKEN, or a proxy that injects it).
ZeroGPU quota is tied to the account, so the Space must see a real credential. gradio_client
moves `token` into an x-hf-authorization header, which a header-injecting proxy never fills,
so we mint a short-lived Space JWT from huggingface.co and send it as plain Authorization.
That is the only way this works from the Claude cloud sandbox.

Measured 2026-10-29 (portrait, cold queue): FLUX.1-schnell 768x1344 4 steps = 4 s/plate,
Qwen-Image-Fast 9:16 8 steps = 2.5-12 s/plate, Wan 2.2 3.5 s clip 480x832 = 39 s.
"""
import argparse, json, os, sys, time, urllib.request
from gradio_client import Client, handle_file

# Same style tables as assets.py (that file parses argv at import, so it cannot be imported).
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

SPACES = {
    "flux": "evalstate/flux1_schnell",
    "qwen": "mcp-tools/Qwen-Image-Fast",
    "wan":  "zerogpu-aoti/wan2-2-fp8da-aoti-faster",
}


def client(space):
    tok = os.environ.get("HF_TOKEN")
    req = urllib.request.Request(f"https://huggingface.co/api/spaces/{space}/jwt",
                                 headers={"Authorization": f"Bearer {tok}"} if tok else {})
    jwt = json.load(urllib.request.urlopen(req))["token"]
    return Client(space, headers={"Authorization": f"Bearer {jwt}"}, verbose=False)


def paint(script, style, out, model, seed):
    """Writes out/<style>/blockNN.png + manifest.json, the same layout assets.py uses, so build.py
    can read either. Existing plates are kept (set ASSETS_FORCE=1 to repaint). If the Space fails
    part-way (ZeroGPU quota is per day and small), the plates already painted stay on disk and the
    process exits 2 so build.py can hand the rest to the local model."""
    doc = json.load(open(script))
    outdir = os.path.join(out, style); os.makedirs(outdir, exist_ok=True)
    prefix = STYLE_PREFIX.get(style, ""); suffix = SUFFIX.get(style, SUFFIX["default"])
    portrait = str(doc.get("orientation", "portrait")).lower().startswith("p")
    force = bool(os.environ.get("ASSETS_FORCE"))
    mpath = os.path.join(outdir, "manifest.json")
    manifest = json.load(open(mpath)) if os.path.exists(mpath) and not force else {}
    manifest = {k: v for k, v in manifest.items() if os.path.exists(v)}
    todo = [(i, b) for i, b in enumerate(doc["blocks"]) if str(i) not in manifest]
    if not todo:
        print(f"reusing {len(manifest)} plates in {outdir} (set ASSETS_FORCE=1 to repaint)"); return
    try:
        c = client(SPACES[model])
    except Exception as e:
        print(f"!! cannot reach {SPACES[model]}: {e}", file=sys.stderr); sys.exit(2)
    failed = False
    for i, b in todo:
        prompt = f"{prefix}{b.get('scene') or b.get('headline') or b['narration']}, {suffix}"
        t = time.time()
        try:
            manifest[str(i)] = _one(c, model, prompt, seed + i, portrait, os.path.join(outdir, f"block{i+1:02d}.png"))
        except Exception as e:
            print(f"!! block {i+1:02d} failed on {SPACES[model]}: {str(e)[:200]}", file=sys.stderr)
            failed = True; break
        print(f"block {i+1:02d} {time.time()-t:5.1f}s  {prompt[:90]}", flush=True)
    json.dump(manifest, open(mpath, "w"), indent=1)
    print(f"{len(manifest)}/{len(doc['blocks'])} plates -> {outdir}")
    if failed:
        sys.exit(2)


def _one(c, model, prompt, seed, portrait, path):
    if model == "flux":
        w, h = (768, 1344) if portrait else (1344, 768)
        r = c.predict(prompt=prompt, seed=seed, randomize_seed=False, width=w, height=h,
                      num_inference_steps=4, api_name="/infer")
    else:
        r = c.predict(prompt=prompt, seed=seed, randomize_seed=False,
                      aspect_ratio="9:16" if portrait else "16:9", guidance_scale=1.0,
                      num_inference_steps=8, api_name="/generate_image")
    src = r[0]["path"] if isinstance(r[0], dict) else r[0]
    from PIL import Image; Image.open(src).save(path)
    return os.path.abspath(path)


def animate(image, out, motion, seconds, seed):
    c = client(SPACES["wan"]); t = time.time()
    r = c.predict(input_image=handle_file(image), prompt=motion, steps=6, duration_seconds=seconds,
                  guidance_scale=1, guidance_scale_2=1, seed=seed, randomize_seed=False,
                  api_name="/generate_video")
    src = r[0]["video"] if isinstance(r[0], dict) else r[0]
    import shutil; shutil.copy(src, out)
    print(f"{time.time()-t:.1f}s -> {out}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("args", nargs="*")
    ap.add_argument("--model", default="qwen", choices=["qwen", "flux"])
    ap.add_argument("--animate", action="store_true")
    ap.add_argument("--motion", default="gentle camera dolly, subtle natural motion, smooth animation")
    ap.add_argument("--seconds", type=float, default=3.5)
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()
    if a.animate:
        animate(a.args[0], a.args[1], a.motion, a.seconds, a.seed)
    else:
        paint(a.args[0], a.args[1], a.args[2], a.model, a.seed)
