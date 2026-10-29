// Helpers and racial abilities shared by the class kits.
import { registerAbilities } from '../../engine/registry.js';

// Roll a [min,max] range (or a plain number).
export const roll = (state, v) => (Array.isArray(v) ? v[0] + (v[1] - v[0]) * state.rng() : v || 0);
// Resolve a value that may be a string key into the (resolved) ability.
export const val = (ab, v, d = 0) => (typeof v === 'string' ? (ab[v] ?? d) : v ?? d);

export const stacksOf = (api, u, id) => {
  const a = api.findAura(u, id);
  return a ? a.stacks : 0;
};

// Add stacks to an aura without refreshing its duration (Arcane Blast, Heating Up…).
export function addStacks(state, api, src, dst, def, n = 1) {
  const a = api.findAura(dst, def.id, def.unique === 'target' ? undefined : src.id);
  if (a) {
    a.stacks = Math.min(def.maxStacks || 99, a.stacks + n);
    if (def.refresh) a.remaining = a.duration;
    api.emit(state, { type: 'auraRefresh', src: src.id, dst: dst.id, aura: def.id, stacks: a.stacks, debuff: !!def.debuff });
    return a;
  }
  const b = api.applyAura(state, src, dst, { ...def, stacks: Math.min(def.maxStacks || 99, n) });
  return b;
}

export function consumeStack(state, api, u, id, n = 1) {
  const a = api.findAura(u, id);
  if (!a) return false;
  a.stacks -= n;
  if (a.stacks <= 0) api.removeAura(state, u, a, 'consumed');
  return true;
}

// Remove auras on a unit that carry any of the given control types.
export function breakCC(state, api, u, types) {
  for (const a of [...u.auras]) {
    const cc = a.def.cc ? (Array.isArray(a.def.cc) ? a.def.cc : [a.def.cc]) : [];
    if (cc.some((c) => types.includes(c))) api.removeAura(state, u, a, 'broken');
  }
}

export const NOTE_NUMBERS = 'Spell numbers are the datamined Forever ranks; your stats come from Classic rules and an estimated gear set.';

// ---------------------------------------------------------------- wand

export function wandAbility(id, school = 'shadow') {
  return {
    [id]: {
      name: 'Shoot (wand)',
      icon: 'wand',
      school,
      category: 'filler',
      tags: ['wand', 'filler'],
      learn: 1,
      toggle: 'wand',
      gcd: 0,
      desc: 'Toggle wand auto-attack. Needs 0.5 s standing still before each shot, costs no mana and does not trigger the five-second rule. Casting a spell pauses it; it resumes afterwards.',
      forever: { status: 'confirmed-official', note: 'Wands need 0.5 s standing still (Oct 15) and no longer gain spell damage (Sep 24).', src: 'bz-devnotes' },
    },
  };
}

// ---------------------------------------------------------------- racials

registerAbilities({
  'race.wotf': {
    name: 'Will of the Forsaken',
    icon: 'skull',
    school: 'shadow',
    mechanic: 'physical',
    category: 'defensive',
    tags: ['racial', 'defensive', 'optional-utility'],
    target: 'self',
    gcd: 0,
    cooldown: 120,
    usableWhileCC: true,
    desc: 'Undead racial. Instantly break all Charm, Fear and Sleep effects. 2 min cooldown.',
    forever: { status: 'reported-guide', note: 'Icy Veins race guide; not usable under Scatter Shot.', src: 'iv-main' },
    canUse: ({ u }) => (u.cc.fear || u.auras.some((a) => a.def.sleep) ? true : 'custom:Nothing to break'),
    effects: [{
      type: 'custom',
      to: 'self',
      fn: ({ state, u, api }) => {
        breakCC(state, api, u, ['fear']);
        for (const a of u.auras.filter((x) => x.def.sleep)) api.removeAura(state, u, a, 'broken');
      },
    }],
  },
  'race.cannibalize': {
    name: 'Cannibalize',
    icon: 'devour',
    school: 'shadow',
    mechanic: 'physical',
    category: 'resource',
    tags: ['racial', 'resource', 'optional-utility'],
    target: 'self',
    cooldown: 120,
    channel: { duration: 10, ticks: 5, effects: [] },
    noPushback: true,
    desc: 'Undead racial. Feed on a humanoid or undead corpse within 5 yards: 35 % of health and mana over 10 s. Moving or taking damage stops it. 2 min cooldown.',
    forever: { status: 'reported-guide', note: 'Forever: restores health AND mana (Classic: health only). Icy Veins calls it great for cutting downtime. Duration is the Classic 10 s.', src: 'iv-main' },
    canUse: ({ state, u }) => (corpseNear(state, u) ? true : 'custom:No humanoid or undead corpse nearby'),
    onChannelStart: ({ state, u }) => {
      const c = corpseNear(state, u);
      if (c) c.flags.eaten = true;
      u.casting.startHp = u.hp;
    },
    onTick: ({ state, u, api }) => {
      if (u.casting && u.lastHostileT > u.casting.startedAt + 0.05 && u.hp < u.casting.startHp) { api.cancelCast(state, u, 'damaged'); return; }
      u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.07);
      if (u.res.mana) u.res.mana.cur = Math.min(u.res.mana.max, u.res.mana.cur + u.res.mana.max * 0.07);
      if (u.casting) u.casting.startHp = u.hp;
    },
  },
  'race.bloodfury': {
    name: 'Blood Fury',
    icon: 'axe',
    school: 'physical',
    mechanic: 'physical',
    category: 'cooldown',
    tags: ['racial', 'cooldown', 'burst'],
    target: 'self',
    gcd: 0,
    cooldown: 120,
    desc: 'Orc racial. Attack power and spell power +10 % for 15 s. 2 min cooldown.',
    forever: { status: 'confirmed-official', note: 'Cooldown reduced to 2 min in the official October 26 update.', src: 'bz-devnotes' },
    effects: [{
      type: 'custom',
      fn: ({ state, u, api }) => {
        const add = { ap: Math.round(u.stats.ap * 0.1), rap: Math.round(u.stats.rap * 0.1), sp: Math.round(u.stats.sp * 0.1) };
        api.applyAura(state, u, u, { id: 'race.bloodfury', name: 'Blood Fury', icon: 'axe', school: 'physical', duration: 15, mods: { statAdd: add } });
      },
    }],
  },
});

function corpseNear(state, u) {
  return state.list.find((x) => !x.alive && !x.flags.eaten && x.kind !== 'pet' && (x.tags || []).some((t) => t === 'humanoid' || t === 'undead') && Math.hypot(x.x - u.x, x.y - u.y) <= 5 + (x.radius || 0.8));
}

export const RACIALS = {
  undead: ['race.wotf', 'race.cannibalize'],
  orc: ['race.bloodfury'],
};
