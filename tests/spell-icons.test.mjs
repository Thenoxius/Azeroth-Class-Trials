import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { allAbilities } from '../src/engine/registry.js';
import { ABILITY_IMG, IMAGE_FILES } from '../src/ui/art/art-images.gen.js';
for (const f of readdirSync(new URL('../src/content/classes/', import.meta.url))) await import('../src/content/classes/' + f);
const fallbacks = JSON.parse(readFileSync(new URL('../assets/spell-icons-extra/svg-fallbacks.json', import.meta.url), 'utf8'));
const allowed = new Set(fallbacks.map((a) => a.abilityId));
for (const ab of Object.values(allAbilities())) {
  if (allowed.has(ab.id)) continue;
  assert.ok(Number.isInteger(ABILITY_IMG[ab.id]), `Missing bitmap for ${ab.id} (${ab.name}); regenerate or explicitly review the fallback`);
  const file = IMAGE_FILES[ABILITY_IMG[ab.id]];
  assert.ok(/^[0-9a-f]{12}\.webp$/.test(file) && existsSync(new URL('../src/ui/art/img/' + file, import.meta.url)), `Missing local image: ${ab.id}`);
}
assert.equal(ABILITY_IMG['warrior.charge'], ABILITY_IMG['t4.charge'], 'Same verified spell must reuse the same image');
console.log('Spell icons: every registered class ability has a local bitmap or an explicit SVG fallback.');
