// Playable races for the three trial classes, and their WoW: Forever racials.
// Racial texts and numbers: Wowhead Forever race pages + spell tooltips (build
// 1.60.1, read 2026-10-27). applyRace() layers a race onto a kit build: portrait,
// racial actives on the bar, passives as auras/stat changes, and a stat offset.
import { registerAbilities } from '../engine/registry.js';

const WH = (note) => ({ status: 'confirmed-official', src: 'wh-forever', note: 'Wowhead Forever racial tooltip' + (note ? '. ' + note : '.') });

export const RACES = {
  orc: { id: 'orc', name: 'Orc' },
  troll: { id: 'troll', name: 'Troll' },
  tauren: { id: 'tauren', name: 'Tauren' },
  undead: { id: 'undead', name: 'Undead' },
  skyborne: { id: 'skyborne', name: 'Skyborne', note: 'Windshaper Skyborne, the Horde branch of the new Forever race.' },
};

// Horde races per class in Forever. The first entry is the default (the original kit race).
export const CLASS_RACES = {
  hunter: ['orc', 'troll', 'tauren', 'skyborne'],
  mage: ['undead', 'troll', 'orc'],
  priest: ['undead', 'troll'],
};
export const defaultRace = (classId) => (CLASS_RACES[classId] || ['orc'])[0];
export const racesFor = (classId) => CLASS_RACES[classId] || [defaultRace(classId)];
export const validRace = (classId, race) => (racesFor(classId).includes(race) ? race : defaultRace(classId));

// ---------------------------------------------------------------- actives

registerAbilities({
  'race.berserking': {
    name: 'Berserking', icon: 'beast-wrath', school: 'physical', mechanic: 'physical', category: 'cooldown',
    tags: ['racial', 'cooldown', 'burst'], target: 'self', gcd: 0, cooldown: 180,
    desc: 'Troll racial. Spellcasting and attack speed +10 % for 10 s. 3 min cooldown.',
    forever: WH(),
    effects: [{ type: 'aura', to: 'self', aura: { id: 'race.berserking', name: 'Berserking', school: 'physical', duration: 10, mods: { castTime: 1 / 1.1, meleeHaste: 0.1, rangedHaste: 0.1 } } }],
  },
  'race.rapidregen': {
    name: 'Rapid Regeneration', icon: 'renew', school: 'nature', mechanic: 'physical', category: 'defensive',
    tags: ['racial', 'defensive', 'optional-utility'], target: 'self', cooldown: 180,
    channel: { duration: 6, ticks: 6, effects: [] },
    noPushback: true,
    desc: 'Troll racial. Channel: regenerate 50 % of maximum health over 6 s. Moving, acting or taking damage cancels it. 3 min cooldown.',
    forever: WH(),
    onChannelStart: ({ u }) => { u.casting.startHp = u.hp; },
    onTick: ({ state, u, api }) => {
      if (u.casting && u.lastHostileT > u.casting.startedAt + 0.05 && u.hp < u.casting.startHp) { api.cancelCast(state, u, 'damaged'); return; }
      u.hp = Math.min(u.maxHp, u.hp + (u.maxHp * 0.5) / 6);
      if (u.casting) u.casting.startHp = u.hp;
    },
  },
  'race.warstomp': {
    name: 'War Stomp', icon: 'nova', school: 'physical', mechanic: 'physical', category: 'control',
    tags: ['racial', 'control', 'aoe'], target: 'none', castTime: 0.5, cooldown: 90, fx: 'ring', fxRadius: 8,
    desc: 'Tauren racial. 0.5 s cast: stuns up to 5 enemies within 8 yards for 2 s. 1.5 min cooldown.',
    forever: WH('Cooldown lowered from 2 min.'),
    effects: [{ type: 'aura', aoe: { center: 'self', radius: 8, maxTargets: 5 }, aura: { id: 'race.warstomp', name: 'War Stomp', school: 'physical', debuff: true, duration: 2, cc: 'stun', dr: 'stun' } }],
  },
  'race.shattercurse': {
    name: 'Shatter Curse', icon: 'dispel', school: 'physical', mechanic: 'physical', category: 'dispel',
    tags: ['racial', 'dispel', 'defensive', 'optional-utility'], target: 'self', gcd: 0, cooldown: 180,
    desc: 'Orc racial. Removes all Curses and Banes from you and reduces magic damage taken by 5 % for 8 s. 3 min cooldown.',
    forever: WH(),
    effects: [
      { type: 'dispel', types: ['curse'], count: 99, which: 'debuff' },
      { type: 'aura', to: 'self', aura: { id: 'race.shattercurse', name: 'Shatter Curse', school: 'physical', duration: 8, mods: { dmgTaken: { fire: 0.95, frost: 0.95, arcane: 0.95, shadow: 0.95, nature: 0.95, holy: 0.95 } } } },
    ],
  },
  // Passive proc, never on the bar; registered so logs and the meter can name it.
  'race.totg': {
    name: 'Touch of the Grave', icon: 'skull', school: 'shadow', mechanic: 'physical', category: 'passive', tags: ['racial', 'passive'], passive: true,
    desc: 'Undead racial passive: 30 % chance on a spell or attack to drain up to 5 % of your maximum health from the target. 25 s cooldown.',
    forever: WH(),
  },
  'race.skysight': {
    name: 'Skysight', icon: 'dash', school: 'nature', mechanic: 'physical', category: 'mobility',
    tags: ['racial', 'mobility', 'optional-utility'], target: 'self', castTime: 0.5, cooldown: 120,
    desc: 'Skyborne racial. 0.5 s cast: movement speed +10 % for 30 s (15 min near an elemental convergence, which these trials do not have). 2 min cooldown.',
    forever: WH(),
    effects: [{ type: 'aura', to: 'self', aura: { id: 'race.skysight', name: 'Skysight', school: 'nature', duration: 30, mods: { speed: 0.1 } } }],
  },
});

// Actives per race, in bar order. Orc and Undead keep the abilities shared.js already defines.
const ACTIVES = {
  orc: ['race.bloodfury', 'race.shattercurse'],
  troll: ['race.berserking', 'race.rapidregen'],
  tauren: ['race.warstomp'],
  undead: ['race.wotf', 'race.cannibalize'],
  skyborne: ['race.skysight'],
};

// ---------------------------------------------------------------- passives

const P = (name, desc, forever) => ({ name, desc, forever, racial: true });

// Undead: Touch of the Grave — 30 % chance on a spell or attack to drain up to 5 % of
// max health from the target; 25 s internal cooldown.
function touchOfTheGrave({ state, u, dst, pk, api }) {
  if (!dst || dst === u || !dst.alive || !api.hostile(u, dst) || pk.isTick) return;
  if ((u.meta.totgReady || 0) > state.t || state.rng() >= 0.3) return;
  u.meta.totgReady = state.t + 25;
  const amount = Math.round(u.maxHp * 0.05);
  api.dealDamage(state, u, dst, { amount, school: 'shadow', kind: 'spell', canCrit: false, ability: 'race.totg' });
  api.healUnit(state, u, u, { amount, canCrit: false, ability: 'race.totg' });
}

function chainHook(hooks, name, fn) {
  const prev = hooks[name];
  hooks[name] = prev ? (x) => { prev(x); fn(x); } : fn;
}

// Apply race-specific passives to a finished template. Returns the passive list for the briefing.
function applyPassives(race, t) {
  const auras = (t.auras = [...(t.auras || [])]);
  const stats = (t.stats = { ...t.stats });
  const hooks = (t.hooks = { ...(t.hooks || {}) });
  if (race === 'orc') {
    stats.critPhys = (stats.critPhys || 0) + 0.01;
    stats.critSpell = (stats.critSpell || 0) + 0.01;
    auras.push({ id: 'race.hardiness', name: 'Hardiness', hidden: true, permanent: true, mods: { stunDuration: 0.8 } });
    return [
      P('Savage', 'Critical strike chance with all spells and abilities +1 %.', WH('Replaced Axe Specialization in the Oct 15 build.')),
      P('Hardiness', 'Stun effects on you last 20 % shorter.', WH()),
    ];
  }
  if (race === 'troll') {
    auras.push({ id: 'race.beastslaying', name: 'Beast Slaying', hidden: true, permanent: true, mods: { dmgVsTag: { beast: 1.05 } } });
    t.regen = { ...(t.regen || {}) };
    t.regen.hpOOC = (t.regen.hpOOC || 0) * 1.2;
    t.regen.hpIC = (t.regen.hpIC || 0) + t.regen.hpOOC * 0.2;
    return [
      P('Regeneration', 'Health regeneration +20 %, and 20 % of it continues in combat.', WH('In-combat share raised from 10 % in the Oct 15 build.')),
      P('Beast Slaying', 'Damage against Beasts +5 %.', WH()),
    ];
  }
  if (race === 'tauren') {
    t.maxHp = Math.round(t.maxHp * 1.05);
    auras.push({ id: 'race.endurance', name: 'Endurance', hidden: true, permanent: true, mods: { critDamage: 1.02, critHeal: 1.02 } });
    auras.push({ id: 'race.plainsrunning', name: 'Plainsrunning', hidden: true, permanent: true });
    chainHook(hooks, 'onTick', plainsrunning);
    return [
      P('Endurance', 'Total health +5 %; critical strike damage and healing +2 %.', WH('Was +1 % hit before Forever.')),
      P('Plainsrunning', 'Movement speed +1 % per 5 s spent moving, up to +30 %. Taking damage or standing still lowers it.', WH()),
    ];
  }
  if (race === 'undead') {
    chainHook(hooks, 'afterDamage', touchOfTheGrave);
    return [P('Touch of the Grave', 'Your spells and attacks have a 30 % chance to drain up to 5 % of your maximum health from the target (25 s cooldown).', WH())];
  }
  if (race === 'skyborne') {
    auras.push({ id: 'race.windblessed', name: 'Wind Blessed', hidden: true, permanent: true, mods: { castTime: 1 / 1.03, meleeHaste: 0.03, rangedHaste: 0.03 } });
    auras.push({ id: 'race.elementalinsight', name: 'Elemental Insight', hidden: true, permanent: true, mods: { dmgVsTag: { elemental: 1.05 } } });
    return [
      P('Wind Blessed', 'Spellcasting, melee and ranged haste +3 %.', WH('Raised from 1 % in the Oct 15 build.')),
      P('Elemental Insight', 'Damage against Elementals +5 %.', WH()),
    ];
  }
  return [];
}

// Plainsrunning: +1 % speed per 5 s moving (max 30 %); a hit or standing still drops it.
function plainsrunning({ state, u, dt }) {
  const moving = !!(u.move && u.move.to);
  const hit = u.lastHostileT && state.t - u.lastHostileT < (dt || 0.05) + 1e-6;
  const m = u.meta;
  m.plains = moving && !hit ? Math.min(30, (m.plains || 0) + (dt || 0) / 5) : Math.max(0, (m.plains || 0) - (dt || 0) * (hit ? 10 : 3));
  const a = u.auras.find((x) => x.id === 'race.plainsrunning');
  if (a) a.def = { ...a.def, mods: { speed: Math.floor(m.plains) / 100 } };
}

// Layer a race onto a kit build. Mutates nothing shared; returns a new build.
export function applyRace(build, { classId, race }) {
  const r = validRace(classId, race);
  const template = { ...build.template, portrait: `${r}-${classId}`, meta: { ...(build.template.meta || {}), race: r } };
  const passives = applyPassives(r, template);
  const consumables = [...(build.consumables || []).filter((id) => !id.startsWith('race.')), ...ACTIVES[r]];
  return { ...build, template, consumables, race: r, racials: passives };
}
