// Refresh presentation mappings from exact spell names and Forever tooltip IDs.
// Never infer an icon from an SVG glyph, and never change gameplay definitions.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allAbilities } from '../src/engine/registry.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
for (const f of readdirSync(resolve(root, 'src/content/classes'))) await import(new URL('../src/content/classes/' + f, import.meta.url));
const original = read('art-source/horde-handoff-v15/spell-icons/ability-map.json');
const candidates = new Map();
function collect(o) {
  if (!o || typeof o !== 'object') return;
  const id = o.ranks?.[0]?.id || o.id;
  if (o.name && Number.isInteger(id)) candidates.set(o.name, id);
  for (const v of Object.values(o)) if (v && typeof v === 'object') collect(v);
}
collect(read('research/forever-warrior-rogue.json'));
const dir = 'assets/spell-icons-extra';
mkdirSync(resolve(root, dir), { recursive: true });
const result = [];
const missing = [];
for (const ab of Object.values(allAbilities())) {
  if (original.some((m) => m.abilityId === ab.id)) continue;
  const existing = original.find((m) => m.name === ab.name && m.sourceVersion === 'forever' && m.file);
  if (existing) {
    result.push({ ...existing, abilityId: ab.id, reusedFrom: existing.abilityId });
    continue;
  }
  const id = candidates.get(ab.name);
  if (!id) {
    missing.push({ abilityId: ab.id, name: ab.name, reason: 'No verified Forever spell ID; retain SVG' });
    continue;
  }
  const sourceUrl = `https://nether.wowhead.com/forever/tooltip/spell/${id}`;
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`${sourceUrl}: ${response.status}`);
  const data = await response.json();
  if (data.name !== ab.name || !/^[a-z0-9_]+$/i.test(data.icon)) throw new Error(`Unexpected Forever spell: ${ab.name} / ${data.name}`);
  const file = `${dir}/${data.icon}.jpg`;
  const image = await fetch(`https://wow.zamimg.com/images/wow/icons/large/${data.icon}.jpg`);
  if (!image.ok) throw new Error(`Cannot download ${data.icon}`);
  writeFileSync(resolve(root, file), Buffer.from(await image.arrayBuffer()));
  result.push({
    abilityId: ab.id,
    name: ab.name,
    spellId: id,
    iconName: data.icon,
    file,
    projectAsset: true,
    sourceVersion: 'forever',
    dataUrl: sourceUrl,
    mappingStatus: 'verified-forever-spell-name-and-icon',
  });
}
writeFileSync(resolve(root, 'assets/spell-icons-extra/mappings.json'), JSON.stringify(result, null, 2) + '\n');
writeFileSync(resolve(root, 'assets/spell-icons-extra/svg-fallbacks.json'), JSON.stringify(missing, null, 2) + '\n');
console.log(`${result.length} supplemental mappings; ${missing.length} explicit SVG fallbacks`);
