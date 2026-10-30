// Shared content: player spawning from a class kit, consumables (rest,
// potions) and small helpers encounters use.
import { registerAbilities } from '../engine/registry.js';

// Downtime is compressed so resting is felt without being tedious.
// A full rest in Classic-era WoW takes roughly 18–30 s; here ~8 s.
export const DOWNTIME_COMPRESSION = 3;
export const REST_SECONDS = 8;

registerAbilities({
  'item.rest': {
    name: 'Eat & Drink',
    icon: 'bread',
    school: 'physical',
    mechanic: 'physical',
    category: 'consumable',
    tags: ['rest'],
    target: 'self',
    outOfCombat: true,
    gcd: 0,
    channel: { duration: REST_SECONDS, ticks: 8, effects: [] },
    noPushback: true,
    desc: `Sit down to eat and drink. Restores health and mana over ${REST_SECONDS} s (time-compressed ×${DOWNTIME_COMPRESSION}; about ${REST_SECONDS * DOWNTIME_COMPRESSION} s in the real game). Out of combat only; moving or being attacked stops it.`,
    forever: { status: 'approximation', note: 'Food and water exist in WoW: Forever as in Classic; the ×3 time compression is ours.' },
    onTick({ state, u, api }) {
      if (api.inCombat(state, u)) {
        api.cancelCast(state, u, 'combat');
        return;
      }
      const hp = u.maxHp * 0.125;
      if (u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + hp);
      for (const k of ['mana', 'focus']) {
        const r = u.res[k];
        if (r) r.cur = Math.min(r.max, r.cur + r.max * 0.125);
      }
      const pet = api.U(state, u.petId);
      if (pet && pet.alive && pet.hp < pet.maxHp) pet.hp = Math.min(pet.maxHp, pet.hp + pet.maxHp * 0.125);
    },
  },
  'item.healpot': {
    name: 'Healing Potion',
    icon: 'potion-red',
    school: 'physical',
    mechanic: 'physical',
    category: 'consumable',
    tags: ['defensive-consumable'],
    target: 'self',
    gcd: 0,
    cooldown: 120,
    sharedCooldown: { 'item.manapot': 120 },
    effects: [{ type: 'heal', amount: 'heal', canCrit: false, to: 'self' }],
    byLevel: { 10: { heal: [140, 180] }, 30: { heal: [455, 585] }, 60: { heal: [1050, 1750] } },
    desc: 'Instantly restores health. Shares a 2 minute cooldown with mana potions.',
    forever: { status: 'classic-baseline', note: 'Potion ranks and values follow Classic; unverified for Forever.' },
  },
  'item.manapot': {
    name: 'Mana Potion',
    icon: 'potion-blue',
    school: 'physical',
    mechanic: 'physical',
    category: 'consumable',
    tags: ['resource-consumable'],
    target: 'self',
    gcd: 0,
    cooldown: 120,
    sharedCooldown: { 'item.healpot': 120 },
    canUse: ({ u }) => (u.res.mana ? true : 'custom:You have no mana'),
    effects: [{ type: 'resource', resource: 'mana', amount: 'mana', to: 'self' }],
    byLevel: { 10: { mana: [140, 180] }, 30: { mana: [455, 585] }, 60: { mana: [1350, 2250] } },
    desc: 'Instantly restores mana. Shares a 2 minute cooldown with healing potions.',
    forever: { status: 'classic-baseline', note: 'Potion ranks and values follow Classic; unverified for Forever.' },
  },
});

export function spawnPlayer(state, api, pos = {}) {
  const { kit, level, spec, role, trialId, race } = state.opts;
  // Group trials name the class buffs your NPC party or raid would give you.
  const groupBuffs = state.encounter.groupBuffs ? state.encounter.groupBuffs(state.opts) : [];
  const b = kit.build({ level, spec, role, trialId, groupBuffs, race });
  const consumables = b.consumables || ['item.rest', 'item.healpot', 'item.manapot'];
  const tpl = b.template;
  const p = api.spawnUnit(state, {
    ...tpl,
    meta: { ...tpl.meta, groupBuffs },
    id: 'player',
    isPlayer: true,
    side: 'player',
    kind: 'player',
    classId: kit.id,
    level,
    x: pos.x ?? 10,
    y: pos.y ?? state.arena.h / 2,
    facing: pos.facing ?? 0,
    abilities: [...(tpl.abilities || []), ...consumables.filter((c) => !(tpl.abilities || []).includes(c))],
    flags: { wandMacro: true, ...(tpl.flags || {}) },
  });
  // Talent tweaks: per-spec overrides merged into this unit's resolved abilities
  // (e.g. Improved Frostbolt's shorter cast) — the shared registry stays untouched.
  for (const [id, tw] of Object.entries(b.tweaks || {})) if (p.ab[id]) p.ab[id] = { ...p.ab[id], ...tw };
  state.playerId = p.id;
  state.build = { ...b, consumables };
  if (b.pet && !pos.noPet) {
    api.spawnUnit(state, {
      ...b.pet.template,
      id: 'pet',
      side: 'player',
      kind: 'pet',
      ownerId: p.id,
      level,
      x: p.x - 1.6,
      y: p.y + 1.4,
      autocast: { ...(b.pet.template.autocast || {}), ...(b.pet.autocast || {}) },
      petMode: b.pet.template.petMode || 'defensive',
    });
  }
  return p;
}

// Encounter helper: time-stamped marker events telemetry uses for reaction timing.
export function marker(state, api, key, label, data) {
  api.emit(state, { type: 'marker', key, label, data: data || null });
}

// Responsibility windows ('mechanic' markers): open one when a duty appears (an
// interruptible cast, a dispellable debuff, a fire circle, an add heading for the
// healer) and resolve it once with who handled it. Telemetry pairs the two.
export function openWindow(state, api, kind, id, label, extra) {
  const w = (state.script.windows = state.script.windows || {});
  if (w[id]) return w[id];
  w[id] = { kind, id, label, at: state.t, open: true, ...(extra || {}) };
  marker(state, api, 'mechanic', label, { kind, id });
  return w[id];
}
export function resolveWindow(state, api, id, ok, by) {
  const w = state.script.windows && state.script.windows[id];
  if (!w || !w.open) return;
  w.open = false;
  w.ok = !!ok;
  w.by = by || null;
  w.latency = state.t - w.at;
  api.emit(state, { type: 'marker', key: 'mechanicResolved', label: w.label, data: { kind: w.kind, id, ok: !!ok, by: by || null } });
}
export function windowStats(state, kind) {
  const all = Object.values(state.script.windows || {}).filter((w) => !kind || w.kind === kind);
  return { total: all.length, ok: all.filter((w) => w.ok).length, byPlayer: all.filter((w) => w.ok && w.by === state.playerId).length };
}

// Events raised since the encounter last looked (encounters scan them in onTick).
export function freshEvents(state) {
  const from = state.script.seenSeq || 0;
  const out = state.events.filter((e) => e.seq > from);
  if (state.events.length) state.script.seenSeq = state.events[state.events.length - 1].seq;
  return out;
}

// Encounter helper: standard "kill everything / don't die" outcome.
export function standardOutcome(state, api, { allowEscape = false } = {}) {
  const p = api.player(state);
  if (!p || !p.alive) return { result: 'defeat', reason: 'You died.' };
  const foes = state.list.filter((u) => u.side === 'enemy' && u.alive && !u.hidden && !u.flags.ignoreForVictory);
  if (!foes.length && !state.script.pendingSpawns) return { result: 'victory', reason: 'All enemies defeated.' };
  if (allowEscape && state.script.escaped) return { result: 'escaped', reason: 'You got away.' };
  return null;
}
