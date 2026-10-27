// Build the artifact page: bundle src/main.jsx with esbuild and inline it,
// together with src/styles.css, into src/shell.html → dist/index.html.
// dist/preview.html wraps the same content in a full document for local viewing.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dev = process.argv.includes('--dev');

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
});
let js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
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
const extra = cssFiles(resolve(root, 'src')).filter((p) => p !== main).sort();
const css = [main, ...extra].map((p) => readFileSync(p, 'utf8')).join('\n');
const shell = readFileSync(resolve(root, 'src/shell.html'), 'utf8');
const page = shell.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js);
mkdirSync(resolve(root, 'dist'), { recursive: true });
writeFileSync(resolve(root, 'dist/index.html'), page);
writeFileSync(
  resolve(root, 'dist/preview.html'),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${page}</body></html>`,
);
const kb = (Buffer.byteLength(page) / 1024).toFixed(0);
console.log(`dist/index.html ${kb} KB (js ${(js.length / 1024).toFixed(0)} KB, css ${(css.length / 1024).toFixed(0)} KB)`);
