// Global content registry. Class kits, enemy files and encounters register
// abilities, unit templates and AI behaviours here; the engine looks them up.

const ABILITIES = {};
const TEMPLATES = {};
const BEHAVIORS = {};

export function registerAbilities(map) {
  for (const [id, a] of Object.entries(map)) ABILITIES[id] = { id, ...a };
}
export function registerTemplates(map) {
  for (const [id, t] of Object.entries(map)) TEMPLATES[id] = { templateId: id, ...t };
}
export function registerBehavior(name, fn) {
  BEHAVIORS[name] = fn;
}

export const getAbility = (id) => ABILITIES[id];
export const getTemplate = (id) => TEMPLATES[id];
export const getBehavior = (name) => BEHAVIORS[name];
export const allAbilities = () => ABILITIES;

// Abilities can carry per-level overrides: byLevel: {10:{...}, 30:{...}, 60:{...}}.
// The highest key <= level wins (falling back to the lowest key).
export function resolveAbility(def, level) {
  if (!def) return null;
  if (!def.byLevel) return def;
  const keys = Object.keys(def.byLevel)
    .map(Number)
    .sort((a, b) => a - b);
  let pick = keys[0];
  for (const k of keys) if (k <= level) pick = k;
  const o = def.byLevel[pick];
  return { ...def, ...o, rankLevel: pick };
}

// Resolve string references ("dmg") and functions against an ability object.
export function num(ab, v, fallback = 0) {
  if (v === undefined || v === null) return fallback;
  if (typeof v === 'string') return ab && ab[v] !== undefined ? ab[v] : fallback;
  if (typeof v === 'function') return v(ab);
  return v;
}
