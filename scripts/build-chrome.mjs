// Generate the menu chrome procedurally (no source images): forged-iron rail, parchment,
// page edges, title bars and the menu emblem, in the brass-and-teal of the Class Trials
// logo. Writes assets/ui-classic/assets/*.webp, the manifest and classic-assets.gen.js.
//   node scripts/build-chrome.mjs
import sharp from 'sharp';
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const DIR = 'assets/ui-classic/';
const sha = (b) => createHash('sha256').update(b).digest('hex');

// Value noise that wraps at the tile edges, so textures repeat without a seam.
function noiseField(w, h, cellsX, cellsY, seed) {
  let s = seed;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const grid = Array.from({ length: cellsX * cellsY }, rnd);
  const smooth = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = (x / w) * cellsX;
    const fy = (y / h) * cellsY;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const at = (i, j) => grid[((j + cellsY) % cellsY) * cellsX + ((i + cellsX) % cellsX)];
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * smooth(fx - x0);
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * smooth(fx - x0);
    return a + (b - a) * smooth(fy - y0);
  };
}
function fractal(
  w,
  h,
  seed,
  cells = [
    [4, 4, 0.5],
    [12, 12, 0.3],
    [40, 40, 0.2],
  ],
) {
  const layers = cells.map(([cx, cy, amp], i) => [noiseField(w, h, cx, cy, seed + i * 77), amp]);
  return (x, y) => layers.reduce((n, [f, amp]) => n + f(x, y) * amp, 0);
}
function paint(w, h, fn) {
  const px = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = fn(x, y);
      for (let k = 0; k < 3; k++) px[(y * w + x) * 3 + k] = Math.max(0, Math.min(255, c[k]));
    }
  }
  return sharp(px, { raw: { width: w, height: h, channels: 3 } })
    .png()
    .toBuffer();
}
const svgOver = (base, svg) =>
  sharp(base)
    .composite([{ input: Buffer.from(svg) }])
    .png()
    .toBuffer();
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const BRASS = [176, 138, 74];
const IRON = [38, 40, 42];

async function metalTile() {
  const w = 280,
    h = 87,
    n = fractal(w, h, 11);
  const base = await paint(w, h, (x, y) => {
    const v = (n(x, y) - 0.5) * 34;
    const band = y > 68 ? 0.55 : 1 - (y / 68) * 0.25;
    return IRON.map((c) => c * band + v);
  });
  let marks = '';
  for (let i = 0; i < 4; i++) {
    const x = 35 + i * 70;
    marks += `<circle cx="${x}" cy="34" r="3.2" fill="#6d6a62"/><circle cx="${x - 0.8}" cy="33.2" r="1.2" fill="#b5b0a2"/>`;
    marks += `<path d="M${x + 35} 26l7 8-7 8-7-8z" fill="#123a3c" stroke="#8a6d3a"/>`;
  }
  marks += `<path d="M0 26l7 8-7 8-7-8z" fill="#123a3c" stroke="#8a6d3a"/>`; // the tile seam completes this diamond
  return svgOver(
    base,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${marks}
    <rect y="0" width="${w}" height="2" fill="#0b0b0b"/><rect y="2" width="${w}" height="1" fill="#6b6658"/>
    <rect y="63" width="${w}" height="1" fill="#e0bd73"/><rect y="64" width="${w}" height="2" fill="#8a6d3a"/><rect y="66" width="${w}" height="2" fill="#0b0b0b"/>
    <rect y="85" width="${w}" height="2" fill="#050505"/></svg>`,
  );
}
function parchment() {
  const w = 128,
    h = 128,
    n = fractal(w, h, 23, [
      [3, 3, 0.45],
      [9, 9, 0.3],
      [32, 32, 0.25],
    ]);
  return paint(w, h, (x, y) => {
    const v = (n(x, y) - 0.5) * 22;
    return [226 + v, 210 + v * 0.95, 172 + v * 0.8];
  });
}
function edge(w, seed, inner) {
  const h = 360,
    n = fractal(w, h, seed, [
      [2, 8, 0.5],
      [6, 24, 0.5],
    ]);
  return paint(w, h, (x, y) => {
    const t = inner === 'right' ? x / (w - 1) : 1 - x / (w - 1); // 0 outside, 1 next to the page
    const v = (n(x, y) - 0.5) * 40;
    const c = t < 0.22 ? IRON : t < 0.32 ? BRASS : t > 0.9 ? [92, 66, 36] : mix([112, 76, 38], [150, 108, 58], Math.sin(t * Math.PI));
    return c.map((k) => k + v);
  });
}
function titleMiddle() {
  const w = 260,
    h = 17,
    n = fractal(w, h, 41, [
      [6, 2, 0.6],
      [26, 4, 0.4],
    ]);
  return paint(w, h, (x, y) => {
    const v = (n(x, y) - 0.5) * 34;
    const shade = 1 - Math.abs(y - 6) / 16;
    return [14 * shade + v * 0.3, 74 * shade + v, 80 * shade + v];
  });
}
const svgPng = (svg) => sharp(Buffer.from(svg)).png().toBuffer();
const titleEnd = (w, flip) =>
  svgPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="24"><g ${flip ? `transform="translate(${w} 0) scale(-1 1)"` : ''}>
  <rect width="${w}" height="24" fill="#10262c"/><rect x="0.5" y="0.5" width="${w - 1}" height="23" fill="none" stroke="#a98e47"/>
  <path d="M13 4l7 8-7 8-7-8z" fill="#1d7f7c" stroke="#e0bd73"/><path d="M13 8l3 4-3 4-3-4z" fill="#7fe0d2"/></g></svg>`);
const navCap = () =>
  svgPng(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
  <rect width="24" height="24" fill="#10262c"/><rect x="0.5" y="0.5" width="23" height="23" fill="none" stroke="#a78c45"/>
  <path d="M12 3l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" fill="#c9a35c" stroke="#3a2a10" stroke-width=".6"/><path d="M12 9l3 3-3 3-3-3z" fill="#2aa39b"/></svg>`);

const made = {
  'metal-top-tile': [await metalTile(), 280, 87],
  'parchment-tile': [await parchment(), 128, 128],
  'content-edge-left': [await edge(36, 51, 'right'), 36, 360],
  'content-edge-right': [await edge(22, 61, 'left'), 22, 360],
  'blue-title-middle': [await titleMiddle(), 260, 17],
  'blue-title-left': [await titleEnd(31, false), 31, 24],
  'blue-title-right': [await titleEnd(23, true), 23, 24],
  'nav-left-cap': [await navCap(), 24, 24],
};

const m = JSON.parse(readFileSync(DIR + 'ASSET_MANIFEST.json', 'utf8'));
const gen = await import(new URL('../src/ui/chrome/classic-assets.gen.js', import.meta.url));
const out = { ...gen.CLASSIC_ASSETS };
for (const [id, [png, width, height]] of Object.entries(made)) {
  const webp = await sharp(png).webp({ quality: 88, effort: 6 }).toBuffer();
  const a = m.assets.find((x) => x.id === id);
  for (const f of [a.path, a.runtime_path]) if (existsSync(DIR + f)) rmSync(DIR + f);
  const file = `assets/${id}.webp`;
  writeFileSync(DIR + file, webp);
  Object.assign(a, {
    path: file,
    runtime_path: file,
    width,
    height,
    sha256: sha(webp),
    runtime_sha256: sha(webp),
    source: 'scripts/build-chrome.mjs (procedural)',
  });
  delete a.source_crop_xyxy;
  out[id] = 'data:image/webp;base64,' + webp.toString('base64');
}
delete m.visual_authority;
m.source = 'Original: scripts/build-chrome.mjs and assets/original-branding-v1.';
m.generation = 'Procedural textures and hand-defined SVG; no crops of third-party images.';
delete m.quality_note;
writeFileSync(DIR + 'ASSET_MANIFEST.json', JSON.stringify(m, null, 2) + '\n');
writeFileSync(
  'src/ui/chrome/classic-assets.gen.js',
  `// Generated by scripts/build-chrome.mjs; do not edit.\nexport const CLASSIC_ASSETS = ${JSON.stringify(out)};\n`,
);
console.log('chrome written');
