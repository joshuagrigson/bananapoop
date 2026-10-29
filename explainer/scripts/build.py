#!/usr/bin/env python3
"""Build a finished explainer video from a script, for free, on this machine.

  script.json --> tts.py (Kokoro) --> timeline.json + narration.wav
              --> render.mjs (Playwright + ffmpeg) --> video.mp4 (silent)
              --> ffmpeg mux --> <name>.mp4   and   thumbnail.mjs --> <name>.png

Usage: build.py script.json [--out DIR] [--scene explainer/scenes/editorial.html] [--fps 30] [--assets [qwen|flux|draft|final]]
"""
import argparse, json, os, subprocess, sys, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

ap = argparse.ArgumentParser()
ap.add_argument("script")
ap.add_argument("--out", default=None)
ap.add_argument("--scene", default=os.path.join(ROOT, "scenes", "editorial.html"))
ap.add_argument("--fps", default="30")
ap.add_argument("--size", default="1080x1920", help="WxH; 1080x1920 for Reels/Stories/Pins, 1920x1080 for YouTube")
ap.add_argument("--models", default=os.path.join(ROOT, ".models"))
ap.add_argument("--name", default=None, help="output basename (default: script slug)")
ap.add_argument("--reuse-audio", action="store_true", help="skip narration if work/timeline.json already exists")
ap.add_argument("--assets", nargs="?", const="qwen", default=None, choices=["qwen", "flux", "draft", "final"],
                help="paint one plate per block. qwen (default) / flux = free Hugging Face Space, "
                     "falls back to the local SDXL-Turbo 'final' tier if the Space or its quota fails; "
                     "draft / final = local CPU model only")
a = ap.parse_args()

doc = json.load(open(a.script))
name = a.name or doc.get("slug") or os.path.splitext(os.path.basename(a.script))[0]
out = a.out or os.path.join(os.path.dirname(os.path.abspath(a.script)), "out")
work = os.path.join(out, "work")
os.makedirs(work, exist_ok=True)

def run(cmd):
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)

timeline = os.path.join(work, "timeline.json")
if not (a.reuse_audio and os.path.exists(timeline)):
    run([sys.executable, os.path.join(HERE, "tts.py"), a.script, work, "--models", a.models])
style = os.path.splitext(os.path.basename(a.scene))[0]
if a.assets:
    adir = os.path.join(work, "assets")
    if a.assets in ("qwen", "flux"):
        cmd = [sys.executable, os.path.join(HERE, "hf_spaces.py"), a.script, style, adir, "--model", a.assets]
        print("+", " ".join(cmd), flush=True)
        if subprocess.run(cmd).returncode != 0:
            print(f"!! {a.assets} Space failed (quota or network); falling back to local SDXL-Turbo for the missing plates", flush=True)
            run([sys.executable, os.path.join(HERE, "assets.py"), a.script, style, adir, "--tier", "final"])
    else:
        run([sys.executable, os.path.join(HERE, "assets.py"), a.script, style, adir, "--tier", a.assets])
    plates = json.load(open(os.path.join(adir, style, "manifest.json")))
    tl = json.load(open(timeline))
    for blk in tl["blocks"]:
        blk["plate"] = "file://" + plates[str(blk["index"])]
    timeline = os.path.join(work, f"timeline_{name}.json")
    json.dump(tl, open(timeline, "w"), indent=1)
silent = os.path.join(work, f"{name}_silent.mp4")
w, h = a.size.lower().split("x")
run(["node", os.path.join(HERE, "render.mjs"), timeline, a.scene, silent, "--fps", a.fps, "--w", w, "--h", h])

final = os.path.join(out, f"{name}.mp4")
run(["ffmpeg", "-y", "-loglevel", "error", "-i", silent, "-i", os.path.join(work, "narration.wav"),
     "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", final])
run(["node", os.path.join(HERE, "thumbnail.mjs"), timeline, a.scene, os.path.join(out, f"{name}.png"), "--w", w, "--h", h])

probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height",
                        "-of", "default=nw=1", final], capture_output=True, text=True).stdout
print(probe)
print("done ->", final)
