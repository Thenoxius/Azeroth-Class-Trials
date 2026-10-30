// Verify the supplied UI masters, embedded runtime bytes and combat CSS boundary.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { CLASSIC_ASSETS } from '../src/ui/chrome/classic-assets.gen.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assetsRoot = resolve(root, 'assets/ui-classic');
const manifest = JSON.parse(readFileSync(resolve(assetsRoot, 'ASSET_MANIFEST.json')));
for (const a of manifest.assets) {
  for (const [file, hash] of [
    [a.path, a.sha256],
    [a.runtime_path, a.runtime_sha256],
  ]) {
    assert.equal(
      createHash('sha256')
        .update(readFileSync(resolve(assetsRoot, file)))
        .digest('hex'),
      hash,
      file,
    );
  }
  assert.ok(Buffer.from(CLASSIC_ASSETS[a.id].split(',')[1], 'base64').equals(readFileSync(resolve(assetsRoot, a.runtime_path))), a.id);
}
const css = readFileSync(resolve(root, 'src/ui/chrome/classic-shell.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
for (const [, selector, body] of rules) {
  for (const part of selector.split(',')) {
    assert.ok(
      part.trim().startsWith('.act-classic-shell') ||
        /^\.act-classic-battle-frame(?: \.(?:b-top|objectives|log|meters|controls-help|uframe|b-paused-card|modal|actionbar|petbar|bf)(?: > \.panel-title)?)?$/.test(
          part.trim(),
        ),
      'Unscoped selector: ' + part,
    );
  }
  if (selector.trim().startsWith('.act-classic-battle-frame')) {
    for (const declaration of body.split(';').filter((x) => x.trim())) {
      assert.match(declaration.trim(), /^(background(?:-color|-image|-position|-repeat)?|box-shadow|border-radius):/);
    }
  }
}
console.log(`Verified ${manifest.assets.length} assets and ${rules.length} scoped CSS rules; combat changes are restricted to panel surfaces.`);
