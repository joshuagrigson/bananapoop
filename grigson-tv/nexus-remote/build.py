#!/usr/bin/env python3
"""Build self-contained interface and illustrated source handoff. Standard library only."""
from pathlib import Path
import base64
import hashlib
import html
import re

ROOT = Path(__file__).resolve().parent
SOURCES = ['index.html', 'styles.css', 'gesture-core.js', 'app.js',
           'adapter.example.js', 'tests/gesture-core.test.cjs',
           'tests/browser.test.cjs', 'build.py']

def inline(text):
    text = html.escape(text)
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
    return text

def markdown(text):
    """Small renderer for this package's headings, prose, lists, tables and fences."""
    out, lines, i = [], text.splitlines(), 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if line.startswith('```'):
            block = []
            i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                block.append(lines[i]); i += 1
            out.append('<pre><code>' + html.escape('\n'.join(block)) + '</code></pre>')
        elif line.startswith('#'):
            level = min(4, len(line) - len(line.lstrip('#')))
            out.append(f'<h{level}>' + inline(line[level:].strip()) + f'</h{level}>')
        elif line.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                cells = [x.strip() for x in lines[i].strip('|').split('|')]
                if not all(re.fullmatch(r'[:\- ]+', c or '-') for c in cells):
                    tag = 'th' if not rows else 'td'
                    rows.append('<tr>' + ''.join(f'<{tag}>' + inline(c) + f'</{tag}>' for c in cells) + '</tr>')
                i += 1
            out.append('<div class="table-wrap"><table>' + ''.join(rows) + '</table></div>')
            continue
        elif re.match(r'^(- |\d+\. )', line):
            ordered = not line.startswith('- ')
            tag = 'ol' if ordered else 'ul'
            items = []
            while i < len(lines) and re.match(r'^(- |\d+\. )', lines[i]):
                items.append('<li>' + inline(re.sub(r'^(- |\d+\. )', '', lines[i])) + '</li>')
                i += 1
            out.append(f'<{tag}>' + ''.join(items) + f'</{tag}>')
            continue
        else:
            paragraph = [line]
            while i + 1 < len(lines) and lines[i+1].strip() and not re.match(r'^(#|\||```|- |\d+\. )', lines[i+1]):
                i += 1; paragraph.append(lines[i])
            out.append('<p>' + inline(' '.join(paragraph)) + '</p>')
        i += 1
    return '\n'.join(out)

def main():
    index = (ROOT / 'index.html').read_text()
    standalone = index.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + (ROOT/'styles.css').read_text() + '\n</style>')
    for filename in ['gesture-core.js', 'app.js']:
        standalone = standalone.replace(f'<script src="{filename}"></script>', '<script>\n' + (ROOT/filename).read_text() + '\n</script>')
    assert 'src="app.js"' not in standalone and 'href="styles.css"' not in standalone
    (ROOT/'NEXUS-Remote.html').write_text(standalone)
    image = base64.b64encode((ROOT/'assets/approved-reference-black.png').read_bytes()).decode()
    downloadable = base64.b64encode(standalone.encode()).decode()
    source_sections = []
    for i, filename in enumerate(SOURCES):
        source = (ROOT/filename).read_text()
        count = len(source.splitlines())
        source_sections.append(f'<details id="source-{i}"><summary>{filename} <small>{count} lines · complete source</small></summary><button class="copy" data-copy="code-{i}">Copy file</button><pre id="code-{i}">{html.escape(source)}</pre></details>')
    template = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NEXUS — Complete Developer Handoff</title>
<style>
:root{color-scheme:dark;font-family:Arial,Helvetica,sans-serif;color:#e9ebed;background:#080a0b}
*{box-sizing:border-box}body{margin:0}main{max-width:1160px;margin:auto;padding:48px 28px 80px}h1{font-size:clamp(30px,5vw,58px);letter-spacing:-.035em;line-height:1.1}h2{font-size:29px;margin-top:56px;border-top:1px solid #343a3e;padding-top:28px}h3{font-size:22px;margin-top:30px}p,li{font-size:17px;line-height:1.65;color:#c7cdd1}li{padding:3px 0}a{color:#eef1f3}small{font-size:13px;color:#aeb5ba}header .eyebrow{text-transform:uppercase;letter-spacing:.2em;color:#a6afb5;font-size:12px}.lede{max-width:800px}.actions{display:flex;gap:12px;flex-wrap:wrap;margin:30px 0}.actions a{padding:14px 20px;border-radius:12px;border:1px solid #b7bfc3;text-decoration:none;background:linear-gradient(140deg,#33393e,#171c20)}figure{margin:30px 0;background:#040506;border:1px solid #30373b;border-radius:18px;overflow:hidden}figure img{width:100%;display:block}figcaption{padding:16px 20px;color:#aeb8be;font-size:14px;line-height:1.5}.note{border-left:3px solid #c0c7cb;padding:16px 20px;background:#171c1f;border-radius:0 10px 10px 0}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:15px}th,td{text-align:left;border-bottom:1px solid #343a3e;padding:12px;vertical-align:top}th{background:#20262a;color:#fff}td{color:#c7cdd1}pre{padding:20px;background:#111619;border:1px solid #313a40;border-radius:10px;overflow:auto;font-size:13px;line-height:1.6;tab-size:2}code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.9em;color:#e9ecef}details{margin:18px 0;border:1px solid #465057;border-radius:12px;overflow:hidden}summary{cursor:pointer;background:#1c2328;padding:20px;font-size:18px;font-weight:bold}summary small{display:block;margin-top:5px}details pre{margin:0;border:0;border-radius:0;max-height:700px}.copy{margin:12px 20px;padding:8px 14px;border:1px solid #8a969e;border-radius:7px;background:#2a343c;color:#fff;cursor:pointer}nav{display:flex;gap:20px;flex-wrap:wrap;font-size:14px;margin-bottom:36px}.cover-spec h1{font-size:34px}footer{margin-top:50px;color:#8b959c}@media print{body{background:#fff;color:#111}main{max-width:none;padding:0}p,li,td{color:#222}a,code{color:#111}.actions,.copy,nav{display:none}figure{break-inside:avoid}pre{white-space:pre-wrap;overflow:visible;background:#f5f5f5;color:#111;border-color:#ccc}details pre{max-height:none}summary,th{background:#eee;color:#111}h2{break-before:page}details{break-inside:auto}.note{background:#eee}}
</style></head><body><main><header><p class="eyebrow">NEXUS / Smoky Silver / Black / 1.0.0</p><h1>The complete recreation handoff.</h1><p class="lede">The final reference, the decisions that define it, the behavior contract, and every line of source code in one self-contained document.</p><div class="actions"><a href="" download="NEXUS-Remote.html">Download standalone interface</a><a href="#source">Go to complete code</a></div></header><nav><a href="#reference">Visual reference</a><a href="#specification">Recreation instructions</a><a href="#validation">Validation</a><a href="#source">Source files</a></nav><section id="reference"><figure><img src="" alt="Final NEXUS remote: trackpad on the left and expanded D-pad with Select on the right; black background and smoky silver accents"><figcaption>Exact generated visual reference, neutral-black revision. Left: Trackpad. Right: D-pad. This image is the design target; it is not a browser screenshot of the supplied code.</figcaption></figure><p class="note"><strong>Provenance:</strong> the mockup was an image, so there was no original code to recover. Included code is a new implementation. Browser rendering and real-TV verification remain outstanding; seven shared gesture-logic tests passed.</p></section><section id="specification" class="cover-spec">SPECIFICATION</section><section id="validation">VALIDATION</section><section id="source"><h2>Complete source — no omitted implementation</h2><p>Expand any file and use Copy file. The runnable standalone HTML is assembled from these exact source files. Source is also provided separately in the ZIP.</p>SOURCE</section><footer>Prepared November 7, 2026. No code was deployed and no existing remote application was modified.</footer></main><script>document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',async()=>{const text=document.getElementById(button.dataset.copy).textContent;try{await navigator.clipboard.writeText(text);button.textContent='Copied';setTimeout(()=>button.textContent='Copy file',1400)}catch(e){const range=document.createRange();range.selectNodeContents(document.getElementById(button.dataset.copy));const selection=getSelection();selection.removeAllRanges();selection.addRange(range);button.textContent='Text selected — copy manually';}}));</script></body></html>'''
    result = template.replace('STANDALONE',downloadable).replace('REFERENCE',image).replace('SPECIFICATION',markdown((ROOT/'HANDOFF.md').read_text())).replace('VALIDATION',markdown((ROOT/'VALIDATION.md').read_text())).replace('SOURCE','\n'.join(source_sections))
    (ROOT/'HANDOFF.html').write_text(result)
    hashes=[]
    for file in sorted(ROOT.rglob('*')):
        if file.is_file() and file.name != 'SHA256SUMS.txt' and '__pycache__' not in str(file):
            hashes.append(hashlib.sha256(file.read_bytes()).hexdigest()+'  '+file.relative_to(ROOT).as_posix())
    (ROOT/'SHA256SUMS.txt').write_text('\n'.join(hashes)+'\n')
    print('Built NEXUS-Remote.html, HANDOFF.html and SHA256SUMS.txt')

if __name__ == '__main__':
    main()
