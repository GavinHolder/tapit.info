// Copies the interactive mockups into public/prototypes and makes them fully self-contained:
//  - support.js = React + ReactDOM + the Design Component runtime (no CDN)
//  - Google Fonts links are replaced with a local copy of Manrope
// Run after the mockups in ../mockups change: `npm run prototypes`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const src = path.resolve(root, '..', 'mockups');
const out = path.join(root, 'prototypes');
const vendor = path.join(root, 'vendor');
const boards = fs.readdirSync(src).filter((f) => f.endsWith('.dc.html')).map((f) => f.replace('.dc.html', ''));

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'fonts'), { recursive: true });

const read = (f) => fs.readFileSync(path.join(vendor, f), 'utf8');
fs.writeFileSync(path.join(out, 'support.js'), [read('react.production.min.js'), read('react-dom.production.min.js'), read('dc-runtime.js')].join('\n;\n'));
fs.writeFileSync(path.join(out, 'fonts', 'fonts.css'), ['manrope.local.css', 'v1fonts.local.css'].map((f) => fs.readFileSync(path.join(vendor, f), 'utf8')).join('\n').replace(/\.\/fonts\//g, './'));
for (const f of fs.readdirSync(path.join(vendor, 'fonts'))) fs.copyFileSync(path.join(vendor, 'fonts', f), path.join(out, 'fonts', f));

for (const b of boards) {
  let html = fs.readFileSync(path.join(src, `${b}.dc.html`), 'utf8');
  html = html
    .replace(/^.*rel="preconnect".*\n/gm, '')
    .replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/g, '<link href="./fonts/fonts.css" rel="stylesheet">');
  if (/https?:\/\/(fonts|cdn)\./.test(html)) console.warn(`WARNING: ${b} still references an external host`);
  fs.writeFileSync(path.join(out, `${b}.dc.html`), html);
}
console.log(`Wrote ${boards.length} prototypes to ${path.relative(root, out)}`);
