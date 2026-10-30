// Build the bitmap art: src/ui/art/img/<hash>.webp plus the ID tables in
// src/ui/art/art-images.gen.js. Reads the approved masters under
// art-source/horde-handoff-v15 (never edited) and resizes them for the sizes the
// UI actually draws. build.mjs serves the files next to the site page and inlines
// them only for the single-file artifact page.
//
//   node scripts/build-art.mjs        (rerun after changing abilities or art)
//
// Only art in use is bundled: the playable race/class portraits, the race/class
// portraits of NPC allies, the enemy and pet portraits the encounters reference, and spell icons for the
// ability IDs that are registered right now. Everything else in the package
// (future races and classes, unused pets) stays in art-source for later.
import sharp from 'sharp';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(root, 'art-source/horde-handoff-v15');
const json = (p) => JSON.parse(readFileSync(resolve(SRC, p), 'utf8'));

// Portraits are drawn at up to 112 px (title screen) for heroes and ~64 px for
// foes (unit frames, battlefield); masters are 1254 px. 2× for sharp screens.
const HERO_PX = 224;
const FOE_PX = 128;
// Spell icons are drawn at 14–46 px; the Zamimg masters are 56 px already.
const ICON_PX = 56;

// Race/class portraits: the playable combinations plus every combination an
// NPC ally uses in the encounters.
const { CLASS_RACES } = await import(pathToFileURL(resolve(root, 'src/content/races.js')).href);
const PLAYABLE = Object.entries(CLASS_RACES).flatMap(([cls, races]) => races.map((r) => r + '-' + cls));
const ICON_OK = new Set(['verified-forever-spell-name-and-icon', 'verified-classic-spell-name-and-icon', 'user-approved-presentation-choice']);

const contentFiles = () => [
  'src/content/enemies.js',
  'src/content/party.js',
  ...readdirSync(resolve(root, 'src/content/classes')).map((f) => 'src/content/classes/' + f),
  ...readdirSync(resolve(root, 'src/content/encounters')).map((f) => 'src/content/encounters/' + f),
];

async function encode(file, px, quality) {
  const buf = await sharp(resolve(file.startsWith('assets/') ? root : SRC, file))
    .resize(px, px, { fit: 'cover', kernel: 'lanczos3' })
    .webp({ quality, effort: 6 })
    .toBuffer();
  // Content-hashed names: unchanged art keeps its URL, so browsers keep it cached.
  const name = createHash('sha256').update(buf).digest('hex').slice(0, 12) + '.webp';
  writeFileSync(resolve(IMG_DIR, name), buf);
  return name;
}

const IMG_DIR = resolve(root, 'src/ui/art/img');
rmSync(IMG_DIR, { recursive: true, force: true });
mkdirSync(IMG_DIR, { recursive: true });
const images = [];
const index = new Map();
async function add(file, px, quality) {
  const key = file + '@' + px;
  if (!index.has(key)) {
    index.set(key, images.length);
    images.push(await encode(file, px, quality));
  }
  return index.get(key);
}

// ---------------------------------------------------------------- portraits
const usedPortraits = new Set();
for (const f of contentFiles()) for (const m of readFileSync(resolve(root, f), 'utf8').matchAll(/portrait: '([^']+)'/g)) usedPortraits.add(m[1]);

const portraits = {};
const heroes = json('manifest.json');
const heroIds = [...new Set([...PLAYABLE, ...[...usedPortraits].filter((id) => heroes.some((h) => h.race + '-' + h.class === id))])];
for (const id of heroIds) {
  const [race, cls] = id.split('-');
  const a = heroes.find((h) => h.race === race && h.class === cls && h.reviewStatus === 'user-approved');
  if (!a) throw new Error('no approved portrait for ' + id);
  portraits[id] = await add(a.file, HERO_PX, 84);
}
for (const a of json('gameplay-manifest.json').assets) {
  if (a.status !== 'user-approved' || !usedPortraits.has(a.id)) continue;
  portraits[a.id] = await add(a.file, FOE_PX, 82);
}

// Approved Shaman element artwork, bundled from the canonical project.
for (const a of JSON.parse(readFileSync(resolve(root, 'assets/shaman-totems-v1/manifest.json'), 'utf8'))) {
  if (a.reviewStatus !== 'user-approved') throw Error('Totem approval missing: ' + a.id);
  portraits['totem-' + a.id] = await add('assets/shaman-totems-v1/' + a.file, 128, 84);
}
// ---------------------------------------------------------------- spell icons
const R = await import(pathToFileURL(resolve(root, 'src/engine/registry.js')).href);
for (const f of contentFiles()) await import(pathToFileURL(resolve(root, f)).href);
const abilities = R.allAbilities();

// Keyed on ability ID, never on the SVG glyph: one glyph covers unrelated spells.
const abilityIcons = {};
const iconFile = {};
const extraPath = resolve(root, 'assets/spell-icons-extra/mappings.json');
const extraMappings = existsSync(extraPath) ? JSON.parse(readFileSync(extraPath, 'utf8')) : [];
const mappings = [...json('spell-icons/ability-map.json'), ...extraMappings];
for (const m of mappings) {
  const ab = abilities[m.abilityId];
  if (!ab || !m.file || !ICON_OK.has(m.mappingStatus)) continue;
  abilityIcons[m.abilityId] = await add(m.projectAsset ? m.file : 'spell-icons/' + m.file, ICON_PX, 88);
  iconFile[m.abilityId] = m.file;
}

// Newly registered class IDs can reuse a verified icon for the exact same spell.
// This resolves names once at build time; the UI still uses only ability IDs.
for (const ab of Object.values(abilities)) {
  if (abilityIcons[ab.id] !== undefined) continue;
  const linked = mappings.find((m) => m.name === ab.name && m.sourceVersion === 'forever' && m.file && ICON_OK.has(m.mappingStatus));
  if (linked) abilityIcons[ab.id] = await add(linked.projectAsset ? linked.file : 'spell-icons/' + linked.file, ICON_PX, 88);
}

// Auras carry their own IDs. Here an aura gets a bitmap when the package links it
// (same name in the same source file). An aura that is the same spell as the
// ability with its ID is resolved at runtime (ui/util.js auraIcon).
const inventory = json('spell-icons/inventory-mapped.json');
const auraIcons = {};
for (const f of contentFiles()) {
  for (const m of readFileSync(resolve(root, f), 'utf8').matchAll(/id: '([^']+)', name: '([^']+)'/g)) {
    const [, id, name] = m;
    if (auraIcons[id] !== undefined) continue;
    const linked = inventory.find((e) => e.file && ICON_OK.has(e.mappingStatus) && e.name === name && f.endsWith(e.source.split('/').pop()));
    if (linked) auraIcons[id] = await add('spell-icons/' + linked.file, ICON_PX, 88);
  }
}

const unmapped = Object.keys(abilities).filter((id) => abilityIcons[id] === undefined);
const out = `// GENERATED by scripts/build-art.mjs from art-source/horde-handoff-v15 — do not edit.
// Bitmap art that replaces SVG drawings where an approved asset exists.
export const IMAGE_FILES = ${JSON.stringify(images)};
export const PORTRAIT_IMG = ${JSON.stringify(portraits)};
export const ABILITY_IMG = ${JSON.stringify(abilityIcons)};
export const AURA_IMG = ${JSON.stringify(auraIcons)};
`;
writeFileSync(resolve(root, 'src/ui/art/art-images.gen.js'), out);
const kb = (Buffer.byteLength(out) / 1024).toFixed(0);
console.log(
  `art-images.gen.js ${kb} KB: ${images.length} images, ${Object.keys(portraits).length} portraits, ${Object.keys(abilityIcons).length}/${Object.keys(abilities).length} abilities, ${Object.keys(auraIcons).length} auras`,
);
if (unmapped.length) console.log('abilities keeping their SVG glyph: ' + unmapped.join(', '));
const svgOnly = [...usedPortraits].filter((id) => portraits[id] === undefined);
if (svgOnly.length) console.log('portraits keeping their SVG: ' + svgOnly.join(', '));
