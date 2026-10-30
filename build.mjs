// Build the pages: bundle src/main.jsx with esbuild and inline it, together with
// the CSS, into src/shell.html.
//   dist/preview.html + dist/art/  the site (GitHub Pages, local preview): a full
//                                  document; bitmap art stays separate files that
//                                  the browser fetches when drawn and caches.
//   dist/index.html                the claude.ai artifact: one self-contained file
//                                  with the art inlined as data URIs.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dev = process.argv.includes('--dev');

const IMG_DIR = resolve(root, 'src/ui/art/img');
// Artifact build only: replace ui/art/art-urls.js with the same list as data URIs.
const inlineArt = {
  name: 'inline-art',
  setup(b) {
    b.onLoad({ filter: /[\\/]ui[\\/]art[\\/]art-urls\.js$/ }, () => {
      const uri = Object.fromEntries(readdirSync(IMG_DIR).map((f) => [f, 'data:image/webp;base64,' + readFileSync(resolve(IMG_DIR, f)).toString('base64')]));
      return {
        contents: `import { IMAGE_FILES } from './art-images.gen.js';\nconst URI = ${JSON.stringify(uri)};\nexport const IMAGES = IMAGE_FILES.map((f) => URI[f]);\n`,
        resolveDir: resolve(root, 'src/ui/art'),
        loader: 'js',
      };
    });
  },
};

async function bundle(plugins) {
  const res = await build({
    entryPoints: [resolve(root, 'src/main.jsx')],
    bundle: true,
    format: 'iife',
    target: ['es2020'],
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    minify: !dev,
    write: false,
    legalComments: 'none',
    logLevel: 'warning',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins,
  });
  return res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
}
const js = await bundle([]);
const jsInline = await bundle([inlineArt]);
// styles.css first, then any other .css under src/ (alphabetical) so feature
// modules can ship their own styles.
function cssFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = resolve(dir, name);
    if (statSync(p).isDirectory()) out.push(...cssFiles(p));
    else if (name.endsWith('.css')) out.push(p);
  }
  return out;
}
const main = resolve(root, 'src/styles.css');
const classic = resolve(root, 'src/ui/chrome/classic-shell.css');
const extra = cssFiles(resolve(root, 'src'))
  .filter((p) => p !== main && p !== classic)
  .sort();
const css = [main, ...extra, classic].map((p) => readFileSync(p, 'utf8')).join('\n');
const shell = readFileSync(resolve(root, 'src/shell.html'), 'utf8');
const pageFor = (code) => shell.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => code);
const page = pageFor(js);
const artifact = pageFor(jsInline);
mkdirSync(resolve(root, 'dist'), { recursive: true });
writeFileSync(resolve(root, 'dist/index.html'), artifact);
writeFileSync(
  resolve(root, 'dist/preview.html'),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${page}</body></html>`,
);
rmSync(resolve(root, 'dist/art'), { recursive: true, force: true });
mkdirSync(resolve(root, 'dist/art'), { recursive: true });
let artBytes = 0;
for (const f of readdirSync(IMG_DIR)) {
  copyFileSync(resolve(IMG_DIR, f), resolve(root, 'dist/art', f));
  artBytes += statSync(resolve(IMG_DIR, f)).size;
}
const kb = (n) => (n / 1024).toFixed(0) + ' KB';
console.log(
  `dist/preview.html ${kb(Buffer.byteLength(page))} (js ${kb(js.length)}, css ${kb(css.length)}) + dist/art ${kb(artBytes)}; dist/index.html (artifact, art inlined) ${kb(Buffer.byteLength(artifact))}`,
);
