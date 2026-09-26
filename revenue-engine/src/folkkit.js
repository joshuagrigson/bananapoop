// The folk kit (art/folk-kit) as one inline <script> for the station page: folkSvg, critterSvg and mapSvg as
// plain globals, and the Code Lab cast (art/folk-kit/cast/*.svg) as window.PF_CAST. The page draws its people
// and its world map with them; without them it falls back to its own figures.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../art/folk-kit');
let cached = null;

export function folkKitScript() {
  if (cached) return cached;
  const plain = (f) => `(function () {\n${fs.readFileSync(path.join(KIT, f), 'utf8').replace(/^export \{[^}]*\};?\s*$/m, '')}\n})();`;
  const cast = {};
  const dir = path.join(KIT, 'cast');
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).sort()) if (f.endsWith('.svg')) cast[f.slice(0, -4)] = fs.readFileSync(path.join(dir, f), 'utf8');
  cached = `<script>\n${plain('folkSvg.js')}\n${plain('mapSvg.js')}\nwindow.PF_CAST = ${JSON.stringify(cast).replace(/<\//g, '<\\/')};\n</script>`;
  return cached;
}
// put the kit where the page asks for it
export const withFolkKit = (html) => html.replace('<!--FOLK-KIT-->', () => folkKitScript());
