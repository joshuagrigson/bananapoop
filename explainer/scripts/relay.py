#!/usr/bin/env python3
"""Paint plates through an image relay (a small Netlify function in front of fal.ai).

Usage:
  relay.py script.json style outdir [--model fal-ai/flux-2-pro] [--blocks 2,5] [--dry-run]

Writes outdir/<style>/blockNN.png + manifest.json, the same layout as hf_spaces.py / assets.py,
so build.py --assets relay picks the plates up. Existing plates are kept; --blocks 2,5 repaints
only those blocks (1-based), which is how one bad plate gets fixed without paying for the rest.

Needs two environment variables. Neither is ever written to disk by this script:
  IMAGE_RELAY_URL   https://<your-site>.netlify.app/generate
  RELAY_PASS        the passphrase set on that site

This is the paid tier: every plate costs real money on the relay owner's fal account (4.5 cents
for a 1080x1920 plate on flux-2-pro at the 2026-11-11 price, so about 32 cents for a seven-block
reel). --dry-run prints the prompts and the estimate and spends nothing.

Why it is built this way (rules learned from the relay's own notes):
  - Submit every job first, save the status/response URLs to relay_jobs.json, then poll. A loop
    that submits and polls one at a time loses everything if it is killed mid-flight, and a rerun
    would pay for the same plates twice. A rerun here resumes the saved jobs instead.
  - These models have no negative prompt. "no text, no watermark" puts those words in the prompt
    and raises the odds of getting them, so every "no ..." clause is dropped before sending.
  - Plates are asked for at the real frame size (1080x1920), so nothing is upscaled locally.
  - Exit code 2 = some plates are still missing, so build.py can hand the rest to the free tier.
"""
import argparse, io, json, os, sys, time, urllib.error, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

# flux-2-pro price read from fal's live listing on 2026-11-11: $0.03 for the first output megapixel,
# $0.015 for each additional one, megapixels rounded up, 1 MP = 1024x1024. Printout estimate only.
USD_FIRST_MP, USD_NEXT_MP, MP = 0.03, 0.015, 1024 * 1024


def plate_cost(w, h):
    return USD_FIRST_MP + USD_NEXT_MP * (max(1, -(-(w * h) // MP)) - 1)


def positive(text):
    """Drop every clause that names a thing we want absent ("no text", "without logos")."""
    keep = [c.strip() for c in text.split(",")]
    keep = [c for c in keep if c and not c.lower().startswith(("no ", "without ", "never "))]
    return ", ".join(keep)


def build_prompt(block, prefix, suffix):
    subject = block.get("scene") or block.get("headline") or block["narration"]
    return positive(f"{prefix}{subject}, {suffix}")


class Relay:
    def __init__(self, url, password):
        self.url, self.password = url, password

    def post(self, body):
        """Returns (http_status, parsed_json). Never raises on an HTTP error status."""
        req = urllib.request.Request(
            self.url, data=json.dumps(body).encode(), method="POST",
            headers={"Content-Type": "application/json", "x-relay-pass": self.password})
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.status, json.loads(r.read().decode() or "{}")
        except urllib.error.HTTPError as e:
            raw = e.read().decode(errors="replace")
            try:
                return e.code, json.loads(raw)
            except ValueError:
                return e.code, {"error": raw[:300]}


def explain(status, body):
    msg = str(body.get("error") or body.get("detail") or body)[:300]
    if status == 401:
        return "401 bad pass: RELAY_PASS does not match the site's, or is not set on the site"
    if status == 500 and "no key" in msg:
        return "500 no key configured: FAL_KEY is not set on the relay site"
    if status == 403:
        return f"403 from fal ({msg}). If it says Exhausted balance, the fal credit is out; topping up is Joshua's call"
    if status == 422:
        return f"422 from fal ({msg}). The size field is the first suspect: this model may want --aspect 9:16 instead of image_size"
    return f"HTTP {status}: {msg}"


def save_image(data, path):
    from PIL import Image
    Image.open(io.BytesIO(data)).convert("RGB").save(path)


def main():
    from hf_spaces import STYLE_PREFIX, SUFFIX  # same style tables as the free painters

    ap = argparse.ArgumentParser()
    ap.add_argument("script"); ap.add_argument("style"); ap.add_argument("out")
    ap.add_argument("--model", default="fal-ai/flux-2-pro")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--blocks", default="", help="1-based block numbers to repaint, e.g. 2,5 (default: only missing plates)")
    ap.add_argument("--aspect", default="", help="send aspect_ratio (e.g. 9:16) instead of image_size, for models that want it")
    ap.add_argument("--dry-run", action="store_true", help="print prompts and the cost estimate; spend nothing")
    ap.add_argument("--timeout", type=int, default=600, help="seconds to wait for the whole batch")
    a = ap.parse_args()

    doc = json.load(open(a.script))
    outdir = os.path.join(a.out, a.style); os.makedirs(outdir, exist_ok=True)
    prefix = STYLE_PREFIX.get(a.style, ""); suffix = SUFFIX.get(a.style, SUFFIX["default"])
    portrait = str(doc.get("orientation", "portrait")).lower().startswith("p")
    w, h = (1080, 1920) if portrait else (1920, 1080)
    mpath = os.path.join(outdir, "manifest.json")
    jpath = os.path.join(outdir, "relay_jobs.json")
    manifest = {k: v for k, v in (json.load(open(mpath)) if os.path.exists(mpath) else {}).items() if os.path.exists(v)}

    n = len(doc["blocks"])
    forced = {int(x) - 1 for x in a.blocks.split(",") if x.strip()}
    bad = sorted(i + 1 for i in forced if not 0 <= i < n)
    if bad:
        sys.exit(f"--blocks {bad} out of range: this script has {n} blocks")
    todo = [i for i in range(n) if i in forced or str(i) not in manifest]
    prompts = {i: build_prompt(doc["blocks"][i], prefix, suffix) for i in todo}

    est = len(todo) * plate_cost(w, h)
    print(f"{len(todo)} plate(s) to paint at {w}x{h} on {a.model}; estimate ${est:.2f} "
          f"(${plate_cost(w, h):.3f} a plate at flux-2-pro's 2026-11-11 price)", flush=True)
    for i in todo:
        print(f"  block {i+1:02d}: {prompts[i]}")
    if a.dry_run or not todo:
        return 0

    url, password = os.environ.get("IMAGE_RELAY_URL"), os.environ.get("RELAY_PASS")
    if not url or not password:
        print("!! IMAGE_RELAY_URL and RELAY_PASS must both be set in the environment", file=sys.stderr)
        return 2
    relay = Relay(url, password)

    # 1. Submit everything first; reuse a saved job whose prompt has not changed (no double spend).
    jobs = json.load(open(jpath)) if os.path.exists(jpath) else {}
    for i in todo:
        old = jobs.get(str(i))
        if old and old.get("prompt") == prompts[i] and old.get("model") == a.model and not old.get("done"):
            print(f"block {i+1:02d} resuming the job already submitted", flush=True)
            continue
        body = {"action": "submit", "model": a.model, "prompt": prompts[i], "seed": a.seed + i}
        if a.aspect:
            body["aspect_ratio"] = a.aspect
        else:
            body["image_size"] = {"width": w, "height": h}
        status, res = relay.post(body)
        if status >= 400 or "status_url" not in res:
            print(f"!! block {i+1:02d} submit failed: {explain(status, res)}", file=sys.stderr)
            json.dump(jobs, open(jpath, "w"), indent=1)
            return 2
        jobs[str(i)] = {"prompt": prompts[i], "model": a.model,
                        "status_url": res["status_url"], "response_url": res["response_url"]}
        json.dump(jobs, open(jpath, "w"), indent=1)
        print(f"block {i+1:02d} submitted", flush=True)

    # 2. Poll until each is COMPLETED, then fetch once and download.
    pending = [i for i in todo if not jobs[str(i)].get("done")]
    deadline = time.time() + a.timeout
    while pending and time.time() < deadline:
        for i in list(pending):
            job = jobs[str(i)]
            status, res = relay.post({"action": "poll", "url": job["status_url"]})
            if status in (401, 403, 500):
                print(f"!! block {i+1:02d} poll failed: {explain(status, res)}", file=sys.stderr)
                return 2
            state = res.get("status")
            if state in ("FAILED", "ERROR", "CANCELLED"):
                print(f"!! block {i+1:02d} {state} on fal: {str(res)[:200]}", file=sys.stderr)
                job["done"] = True; pending.remove(i); continue
            if state != "COMPLETED":
                continue
            status, out = relay.post({"action": "poll", "url": job["response_url"]})
            images = out.get("images") or ([out["image"]] if out.get("image") else [])
            if status >= 400 or not images:
                print(f"!! block {i+1:02d} finished but returned no image: {explain(status, out)}", file=sys.stderr)
                job["done"] = True; pending.remove(i); continue
            path = os.path.join(outdir, f"block{i+1:02d}.png")
            req = urllib.request.Request(images[0]["url"], headers={"User-Agent": "explainer/1.0"})
            save_image(urllib.request.urlopen(req, timeout=180).read(), path)
            manifest[str(i)] = os.path.abspath(path)
            job["done"] = True; pending.remove(i)
            json.dump(manifest, open(mpath, "w"), indent=1)
            print(f"block {i+1:02d} painted -> {path}", flush=True)
        json.dump(jobs, open(jpath, "w"), indent=1)
        if pending:
            time.sleep(2)
    if pending:
        print(f"!! still running after {a.timeout}s: blocks {[i+1 for i in pending]}. "
              f"Rerun the same command to keep polling; it will not resubmit.", file=sys.stderr)

    json.dump(manifest, open(mpath, "w"), indent=1)
    print(f"{len(manifest)}/{n} plates -> {outdir}")
    return 0 if len(manifest) == n and not pending else 2


if __name__ == "__main__":
    sys.exit(main())
