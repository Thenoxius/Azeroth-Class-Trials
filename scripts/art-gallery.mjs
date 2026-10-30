// Render an art map to a PNG contact sheet for visual review.
//   node scripts/art-gallery.mjs portraits|icons <out.png> [filterIds,comma,separated]
// Bundles the real Portrait / AbilityIcon wrappers with esbuild, renders static
// markup with react-dom/server, and screenshots it with headless Edge.
import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
globalThis.React = React;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const kind = process.argv[2] || 'portraits';
const out = resolve(process.argv[3] || `scratch/${kind}.png`);
const filter = process.argv[4] ? process.argv[4].split(',') : null;
mkdirSync(dirname(out), { recursive: true });

const entry = kind === 'portraits' ? 'src/ui/art/Portrait.jsx' : 'src/ui/art/AbilityIcon.jsx';
const tmp = resolve(root, 'node_modules/.cache/art-' + kind + '.mjs');
mkdirSync(dirname(tmp), { recursive: true });
await build({
  entryPoints: [resolve(root, entry)],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: tmp,
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  logLevel: 'error',
});
const mod = await import(pathToFileURL(tmp).href + '?t=' + Date.now());
const h = React.createElement;
let cells = [];
if (kind === 'portraits') {
  const ids = Object.keys(mod.PORTRAITS).filter((id) => !filter || filter.includes(id));
  cells = ids.map((id) =>
    h(
      'div',
      { className: 'cell', key: id },
      h(
        'div',
        { className: 'row' },
        h('div', { className: 'round big' }, h(mod.Portrait, { id, size: 112 })),
        h('div', { className: 'round small' }, h(mod.Portrait, { id, size: 36 })),
        h('div', { className: 'round small' }, h(mod.Portrait, { id, size: 36, dead: true })),
      ),
      h('div', { className: 'label' }, id),
    ),
  );
} else {
  const ids = Object.keys(mod.GLYPHS).filter((id) => !filter || filter.includes(id));
  const schools = ['fire', 'frost', 'arcane', 'shadow', 'holy', 'nature', 'physical'];
  cells = ids.map((id, i) =>
    h(
      'div',
      { className: 'cell icon', key: id },
      h(
        'div',
        { className: 'row' },
        h(mod.AbilityIcon, { icon: id, school: schools[i % schools.length], size: 72 }),
        h(mod.AbilityIcon, { icon: id, school: schools[(i + 3) % schools.length], size: 34 }),
      ),
      h('div', { className: 'label' }, id),
    ),
  );
}
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#15131a;color:#ddd;font:12px system-ui;padding:12px}
.grid{display:flex;flex-wrap:wrap;gap:10px}
.cell{background:#211d28;border:1px solid #3a3346;border-radius:8px;padding:8px;width:${kind === 'portraits' ? 210 : 150}px}
.row{display:flex;gap:8px;align-items:center}
.round{border-radius:50%;overflow:hidden;border:2px solid #b08d4a;line-height:0}
.label{margin-top:6px;color:#e8d9b0}
</style><div class="grid">${renderToStaticMarkup(h(React.Fragment, null, ...cells))}</div>`;
const htmlPath = out.replace(/\.png$/, '.html');
writeFileSync(htmlPath, html);
const rows = Math.ceil(cells.length / (kind === 'portraits' ? 6 : 8));
const height = Math.max(400, rows * (kind === 'portraits' ? 160 : 120) + 40);
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
execFileSync(
  edge,
  ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--window-size=1320,${height}`, `--screenshot=${out}`, pathToFileURL(htmlPath).href],
  { stdio: 'ignore' },
);
console.log(`rendered ${cells.length} ${kind} → ${out}`);
