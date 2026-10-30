// Hunter kit — WoW: Forever. Level snapshots 10 / 30 / 60; specs Beast Mastery,
// Marksmanship (petless Lone Wolf at 60) and the reworked melee Survival.
// Names, levels and mechanics follow research/research-hunter.json. Spell ranks use the
// datamined Forever values (Wowhead spellbook/talent diff, live build 1.60.1.70630, read
// 2026-10-27); character stats come from Classic rules and a gear profile (../stats.js).
import { registerAbilities, registerTemplates, registerBehavior } from '../../engine/registry.js';
import * as G from '../../engine/geometry.js';
import { roll, val, RACIALS } from './shared.js';
import { applyRace, validRace, racesFor } from '../races.js';
import { deriveStats, petStats, buffTotals, GEAR, WEAPONS, AMMO } from '../stats.js';

const OFF = (note, src = 'bz-dd-hunter') => ({ status: 'confirmed-official', src, note });
const BETA = (note) => ({ status: 'beta-observation', src: 'wh-forever', note });
const IV = (src, note) => ({ status: 'reported-guide', src, note });
const CLASSIC = (note) => ({ status: 'classic-baseline', note });
const DM = (note) => ({ status: 'beta-observation', src: 'wh-forever', note });

const T = (u) => (u.meta && u.meta.talents) || {};
const hunterOf = (state, u) => (u.ownerId ? state.units[u.ownerId] : u);

// Ranged weapon swing used by shots: weapon roll + RAP/14 × speed (Classic formula).
function rangedWeapon(state, api, u, t) {
  const r = u.ranged;
  if (!r) return 0;
  const markRap = t ? api.modAdd(t, 'attackerPower', 'rap') : 0;
  return r.min + (r.max - r.min) * state.rng() + (r.coef || 0) * (api.statOf(u, 'rap') + markRap);
}
function meleeWeapon(state, api, u) {
  // Melee abilities use the main hand only (Survival's dual-wield pair keeps it in melee.mh).
  const m = u.melee && u.melee.mh ? { ...u.melee.mh, coef: u.melee.mh.speed / 14 } : u.melee;
  if (!m) return 0;
  return m.min + (m.max - m.min) * state.rng() + (m.coef || 0) * api.statOf(u, 'ap');
}

// Every Hunter shot goes through here: crit talents, Rapid Killing, Barrage, Hunter's Mark.
function shot(ctx, o = {}) {
  const { state, u, t, ab, api } = ctx;
  if (!t || !t.alive) return 0;
  const tal = T(u);
  const melee = o.melee || false;
  let amount =
    (o.weapon ? (melee ? meleeWeapon(state, api, u) : rangedWeapon(state, api, u, t)) * (o.weaponMult ?? 1) : 0) + roll(state, val(ab, o.amount ?? 'dmg', 0));
  let mult = o.mult || 1;
  const rk = !melee && api.findAura(u, 'hunter.rk');
  if (rk && ['hunter.arcane', 'hunter.aimed', 'hunter.multishot', 'hunter.sniper'].includes(ab.id)) {
    mult *= 1.2;
    api.removeAura(state, u, rk, 'consumed');
  }
  if (tal.barrage && ['hunter.aimed', 'hunter.multishot', 'hunter.volley'].includes(ab.id)) mult *= 1.1;
  if (!melee && tal.rws) mult *= 1.05;
  const critMult = melee ? 2 * (tal.predatorsEdge ? 1.3 : 1) : 2 * (tal.mortalShots ? 1.15 : 1);
  const power = o.power || (melee ? 'ap' : 'rap');
  return api.dealDamage(state, u, t, {
    amount,
    coef: val(ab, o.coef ?? 'coef', 0),
    power,
    school: o.school || ab.school || 'physical',
    kind: o.kind || (melee ? 'melee' : 'ranged'),
    ability: ab.id,
    critMult,
    bonusMult: mult,
    threat: o.threat ?? 1,
    noAvoid: o.noAvoid,
    critBonus: melee && tal.savageStrikes ? 0.04 : 0,
  });
}
const hit = (o) => ({ type: 'custom', fn: (ctx) => shot(ctx, o) });

const ASPECTS = ['hunter.aspect.hawk', 'hunter.aspect.monkey', 'hunter.aspect.beast'];
function aspect(id, name, icon, mods, note) {
  return {
    type: 'custom',
    fn: ({ state, u, api }) => {
      for (const a of ASPECTS) if (a !== id) api.removeAuraById(state, u, a);
      if (api.findAura(u, id)) return;
      api.applyAura(state, u, u, { id, name, icon, school: 'nature', permanent: true, mods: typeof mods === 'function' ? mods(u) : mods });
    },
  };
}

// Traps: placed at your feet, arm after 1.5 s, trigger on the first enemy that steps in.
function trapZone(state, api, u, ab, o) {
  const tal = T(u);
  return api.spawnZone(state, {
    shape: { type: 'circle', r: o.radius || 2.5 },
    x: u.x,
    y: u.y,
    owner: u.id,
    side: u.side,
    telegraph: 1.5,
    trigger: 'enter',
    lifetime: 60,
    visual: 'trap',
    label: ab.name,
    ab,
    onTrigger: (st, z, victims, api2) => o.onTrigger(st, z, victims, api2, tal),
  });
}

const MONGOOSE_READY = { id: 'hunter.mongoose.ready', name: 'Mongoose Bite ready', icon: 'mongoose', school: 'physical', duration: 5 };
const COUNTER_READY = { id: 'hunter.counter.ready', name: 'Counterattack ready', icon: 'shield', school: 'physical', duration: 5 };

// ---------------------------------------------------------------- hooks

function hunterAfterDamage({ state, u, api, pk, dst, final }) {
  const tal = T(u);
  if (!pk.ability || pk.isTick || final <= 0) return;
  if (tal.exposePrey && dst.alive && api.findAura(dst, 'hunter.mark', u.id) && state.rng() < tal.exposePrey)
    api.applyAura(state, u, u, { ...MONGOOSE_READY, duration: 10 });
  if (tal.resourcefulness && pk.crit && pk.ability !== 'autoshot' && pk.ability !== 'melee')
    api.applyAura(state, u, u, { id: 'hunter.resourceful', name: 'Resourcefulness', icon: 'mongoose', duration: 30, mods: { castRegen: 0.5 } });
}

function hunterOnAutoHit({ state, u, api, kind }) {
  const tal = T(u);
  if (kind === 'autoshot' && tal.deadlyAspects && api.findAura(u, 'hunter.aspect.hawk') && state.rng() < tal.deadlyAspects) {
    api.applyAura(state, u, u, {
      id: 'hunter.quickshots',
      name: 'Quick Shots',
      icon: 'aspect-hawk',
      school: 'nature',
      duration: 12,
      mods: { rangedHaste: 0.3 },
    });
  }
}

function hunterOnKill({ state, u, api }) {
  if (T(u).rapidKilling) api.applyAura(state, u, u, { id: 'hunter.rk', name: 'Rapid Killing', icon: 'rapid-fire', duration: 20 });
}

function hunterOnAvoid({ state, u, api, avoid }) {
  if (avoid === 'dodge' && u.ab['hunter.mongoose']) api.applyAura(state, u, u, MONGOOSE_READY);
  if (avoid === 'parry' && u.ab['hunter.counter']) api.applyAura(state, u, u, COUNTER_READY);
}

// Deadly Aspects on melee swings in Aspect of the Beast (Survival).
function hunterMeleeSwing({ state, u, api, pk }) {
  const tal = T(u);
  if (pk.ability === 'melee' && tal.deadlyAspects && api.findAura(u, 'hunter.aspect.beast') && state.rng() < tal.deadlyAspects) {
    api.applyAura(state, u, u, { id: 'hunter.quickstrikes', name: 'Quick Strikes', icon: 'aspect-monkey', duration: 12, mods: { meleeHaste: 0.3 } });
  }
}

// Pet: Intimidation stun, Frenzy, Bestial Wrath crit, Spirit Bond.
function petBeforeDamage({ u, api, pk }) {
  if (api.findAura(u, 'hunter.intim') && pk.kind === 'melee') pk.critChance += 1;
}
function petAfterDamage({ state, u, api, pk, dst, final }) {
  const owner = state.units[u.ownerId];
  const tal = owner ? T(owner) : {};
  const intim = api.findAura(u, 'hunter.intim');
  if (intim && pk.kind === 'melee' && dst.alive) {
    api.removeAura(state, u, intim, 'consumed');
    api.applyAura(state, u, dst, { id: 'hunter.intim.stun', name: 'Intimidation', icon: 'growl', debuff: true, duration: 3, cc: 'stun', dr: 'stun' });
    api.addThreat(state, dst, u, 300 + u.level * 10);
  }
  if (tal.frenzy && pk.crit && final > 0)
    api.applyAura(state, u, u, { id: 'hunter.frenzy', name: 'Frenzy', icon: 'claw', duration: 8, mods: { meleeHaste: 0.3 } });
}

// ---------------------------------------------------------------- pet & hawk templates

registerBehavior('hawk', (state, u, api) => {
  const owner = state.units[u.ownerId];
  let t = state.units[u.target];
  if (!t || !t.alive || t.evading) {
    const ot = owner && state.units[owner.target];
    t = ot && ot.alive && api.hostile(u, ot) && ot.engaged ? ot : null;
    u.target = t ? t.id : null;
  }
  if (!t) {
    u.move.to = owner ? { x: owner.x + 1.5, y: owner.y - 1.5 } : null;
    return;
  }
  // Strike from behind when something else holds the target's attention (out of frontal cleaves).
  const holder = t.target && state.units[t.target];
  const spot = holder && holder !== u && holder.alive ? G.behind(holder, t, (t.radius || 0.8) + 1.0) : G.towards(t, u, (t.radius || 0.8) + 1.2);
  if (G.dist(u, spot) > 1.2) u.move.to = spot;
  else u.move.to = null;
});

registerTemplates({
  'hunter.hawk': {
    name: 'Hawk',
    portrait: 'hunter-hawk',
    side: 'player',
    kind: 'guardian',
    speed: 12,
    radius: 0.5,
    maxHp: 150,
    physMit: 0,
    melee: { min: 10, max: 14, speed: 1.6 },
    ai: { type: 'hawk', interval: 0.15 },
    tags: ['beast'],
    flags: { noMelee: false },
  },
});

registerAbilities({
  'pet.bite': {
    name: 'Bite',
    icon: 'bite',
    school: 'physical',
    mechanic: 'physical',
    category: 'pet',
    tags: ['pet'],
    range: 5,
    cooldown: 10,
    cost: { focus: 35 },
    desc: 'Your pet bites the target. Every family can learn Bite or Claw.',
    forever: OFF('Every family can learn Bite or Claw, and Dive or Dash.'),
    effects: [{ type: 'damage', amount: 'dmg', kind: 'melee' }],
    byLevel: { 10: { dmg: [12, 16] }, 30: { dmg: [40, 50] }, 60: { dmg: [108, 132] } },
  },
  'pet.growl': {
    name: 'Growl',
    icon: 'growl',
    school: 'physical',
    mechanic: 'physical',
    category: 'pet',
    tags: ['pet', 'threat'],
    range: 10,
    cooldown: 5,
    cost: { focus: 15 },
    desc: 'Your pet growls, adding a large amount of threat (not a full taunt). Autocast by default — turn it off in groups, or your pet steals the tank’s mobs.',
    forever: OFF('The only active ability the Pet Trainer teaches; “not a complete taunt”.'),
    effects: [{ type: 'threat', mode: 'add', value: 'thr' }],
    byLevel: { 10: { thr: 60 }, 30: { thr: 330 }, 60: { thr: 1000 } },
  },
  'pet.dash': {
    name: 'Dash',
    icon: 'dash',
    school: 'physical',
    mechanic: 'physical',
    category: 'pet',
    tags: ['pet', 'mobility'],
    target: 'self',
    cooldown: 30,
    cost: { focus: 20 },
    gcd: 0,
    desc: 'Your pet runs 80 % faster for 15 s.',
    forever: OFF('Every family can learn Dive or Dash.'),
    effects: [{ type: 'aura', to: 'self', aura: { id: 'pet.dash', name: 'Dash', icon: 'dash', duration: 15, mods: { speed: 0.8 } } }],
  },
  'pet.howl': {
    name: 'Furious Howl',
    icon: 'growl',
    school: 'physical',
    mechanic: 'physical',
    category: 'pet',
    tags: ['pet', 'optional-utility'],
    target: 'none',
    cooldown: 10,
    cost: { focus: 20 },
    fx: 'ring',
    fxRadius: 15,
    desc: 'Wolf family ability: party members within 15 yards (pet included) deal 6 % more melee damage for 10 s.',
    forever: OFF('Wolf unique ability; its Attack Power bonus was cut 40 % in beta. Modelled as +6 % melee damage.'),
    effects: [
      {
        type: 'aura',
        aoe: { center: 'self', radius: 15, affects: 'allies' },
        aura: { id: 'pet.howl', name: 'Furious Howl', icon: 'growl', duration: 10, mods: { dmgDone: { melee: 1.06 } } },
      },
    ],
  },
});

// Pet base stats: Classic pet tables (../stats.js). Forever adds 2 health per Hunter Stamina,
// 30 % of the Hunter's armor, 10 % of the Hunter's attack power and all of the Hunter's crit
// (Wowhead / Icy Veins guides; applied in build()).
function petTemplate(L, tal) {
  const S = { ...petStats(L), hpOOC: { 10: 1.5, 30: 5, 60: 18 }[L] };
  const auras = [];
  if (tal.unleashedFury)
    auras.push({ id: 'pet.t.fury', name: 'Unleashed Fury', hidden: true, permanent: true, mods: { dmgDone: { all: 1 + tal.unleashedFury } } });
  if (tal.focusedFire) auras.push({ id: 'pet.t.ff', name: 'Focused Fire', hidden: true, permanent: true, mods: { dmgDone: { all: 1.02 } } });
  return {
    name: 'Wolf',
    portrait: 'pet-wolf',
    speed: 8,
    radius: 0.7,
    tags: ['beast'],
    maxHp: Math.round(S.maxHp * (1 + (tal.enduranceTraining || 0))),
    armor: Math.round(S.armor * (1 + (tal.enduranceTraining || 0))),
    resources: { focus: 100 },
    regen: { focus: 5 * (1 + (tal.bestialDiscipline ? 0.2 : 0)), hpOOC: S.hpOOC },
    stats: { ...S.stats, critPhys: 0.05 + (tal.ferocity || 0) },
    melee: { ...S.melee },
    abilities: ['pet.bite', 'pet.growl', 'pet.dash', 'pet.howl'],
    ai: {
      type: 'pet',
      rotation: [
        { id: 'pet.growl', when: (state, u, t) => t.target !== u.id || (t.threat && (t.threat[u.id] || 0) < Math.max(0, ...Object.values(t.threat)) * 1.2) },
        { id: 'pet.bite' },
        { id: 'pet.howl', target: 'self', when: (state, u, t) => u.res.focus.cur > 60 },
        { id: 'pet.dash', target: 'self', when: (state, u, t) => G.dist(u, t) > 12 },
      ],
    },
    autocast: { 'pet.growl': true, 'pet.bite': true, 'pet.howl': true, 'pet.dash': false },
    petMode: 'defensive',
    auras,
    hooks: { beforeDamage: petBeforeDamage, afterDamage: petAfterDamage },
  };
}

// ---------------------------------------------------------------- hunter abilities

const SHOT = { school: 'physical', mechanic: 'physical', ranged: true, range: 'range', minRange: 8, startsAutoShot: true };

registerAbilities({
  'hunter.autoshot': {
    name: 'Auto Shot',
    icon: 'arrow',
    school: 'physical',
    mechanic: 'physical',
    ranged: true,
    category: 'filler',
    tags: ['core', 'filler', 'autorepeat'],
    learn: 1,
    toggle: 'autoshot',
    gcd: 0,
    range: 35,
    desc: 'Toggle automatic shooting (8–35 yards). Needs 0.5 s standing still before each shot; keeps firing while you cast Aimed Shot.',
    forever: OFF('Needs 0.5 s standing still again; keeps firing during Aimed/Sniper Shot casts.', 'bz-devnotes'),
  },
  'hunter.serpent': {
    ...SHOT,
    name: 'Serpent Sting',
    icon: 'serpent',
    school: 'nature',
    category: 'dot',
    tags: ['core', 'dot', 'rotation'],
    learn: 4,
    desc: 'Nature damage over 15 s. One sting per Hunter per target.',
    forever: BETA(
      'Datamined ranks 21–25 % below Classic at low level (555 over 15 s at 60); beta players report slight Attack Power scaling, modelled as 2 % of RAP per tick.',
    ),
    cost: { mana: 'mana' },
    effects: [
      {
        type: 'custom',
        fn: ({ state, u, t, ab, api }) => {
          const tal = T(u);
          const per = (val(ab, 'tick') + 0.02 * api.statOf(u, 'rap')) * (tal.improvedStings ? 1.2 : 1);
          api.applyAura(state, u, t, {
            id: 'hunter.serpent',
            name: 'Serpent Sting',
            icon: 'serpent',
            school: 'nature',
            debuff: true,
            duration: 15,
            dispel: 'poison',
            tick: { interval: 3, amount: per, school: 'nature' },
          });
          if (tal.rapidRecuperation)
            api.applyAura(state, u, u, { id: 'hunter.rr', name: 'Rapid Recuperation', icon: 'rapid-fire', duration: 15, mods: { castRegen: 0.5 } });
        },
      },
    ],
    byLevel: { 10: { tick: 6, mana: 30, range: 35 }, 30: { tick: 22, mana: 80, range: 35 }, 60: { tick: 111, mana: 250, range: 35 } },
  },
  'hunter.arcane': {
    ...SHOT,
    name: 'Arcane Shot',
    icon: 'arcane-shot',
    school: 'arcane',
    category: 'damage',
    tags: ['core', 'rotation'],
    learn: 6,
    desc: 'Instant Arcane damage. Usable while moving. Shares its cooldown with Summon Hawk.',
    forever: OFF('Shares its cooldown with Summon Hawk, not Aimed Shot. Datamine: 10–54 % more damage than Classic; the tooltip has no Attack Power term.'),
    cooldown: 'cd',
    cost: { mana: 'mana' },
    sharedCooldown: { 'hunter.hawk': 6 },
    effects: [hit({})],
    byLevel: {
      10: { dmg: [20, 20], mana: 25, cd: 6, range: 35 },
      30: { dmg: [65, 65], mana: 80, cd: 6, range: 35 },
      60: { dmg: [217, 217], mana: 190, cd: 6, range: 35 },
    },
  },
  'hunter.mark': {
    ...SHOT,
    minRange: 0,
    startsAutoShot: false,
    name: "Hunter's Mark",
    icon: 'mark',
    school: 'arcane',
    category: 'utility',
    tags: ['optional-utility'],
    learn: 6,
    desc: 'Marks the target for 2 min: ranged attacks against it gain ranged attack power, and it cannot hide in stealth. Marking does not pull the target.',
    forever: OFF('Improved Hunter’s Mark is baseline: datamined ranks are 30 % stronger than Classic (+143 ranged attack power at 60).'),
    cost: { mana: 'mana' },
    effects: [
      {
        type: 'custom',
        fn: ({ state, u, t, ab, api }) =>
          api.applyAura(state, u, t, {
            id: 'hunter.mark',
            name: "Hunter's Mark",
            icon: 'mark',
            school: 'arcane',
            debuff: true,
            duration: 120,
            dispel: 'magic',
            mods: { attackerPower: { rap: val(ab, 'markRap', 0) } },
          }),
      },
    ],
    byLevel: { 10: { mana: 15, range: 100, markRap: 26 }, 30: { mana: 30, range: 100, markRap: 59 }, 60: { mana: 60, range: 100, markRap: 143 } },
  },
  'hunter.concussive': {
    ...SHOT,
    name: 'Concussive Shot',
    icon: 'concussive',
    category: 'control',
    tags: ['control'],
    learn: 8,
    desc: 'Dazes the target: 50 % slower for 4 s. Your kiting tool.',
    forever: BETA('Unchanged from Classic per datamine.'),
    cooldown: 12,
    cost: { mana: 'mana' },
    effects: [
      { type: 'threat', mode: 'add', value: 40 },
      { type: 'aura', aura: { id: 'hunter.concussive', name: 'Dazed', icon: 'concussive', debuff: true, duration: 4, mods: { slow: 0.5 } } },
    ],
    byLevel: { 10: { mana: 16, range: 35 }, 30: { mana: 62, range: 35 }, 60: { mana: 138, range: 35 } },
  },
  'hunter.raptor': {
    name: 'Raptor Strike',
    icon: 'raptor-strike',
    school: 'physical',
    mechanic: 'physical',
    category: 'damage',
    tags: ['core', 'melee'],
    learn: 1,
    range: 5,
    startsMelee: true,
    desc: 'A strong melee attack: weapon damage plus a bonus. Starts your melee auto-attack.',
    forever: BETA('Survival’s main melee button; other specs use it in the dead zone.'),
    cooldown: 6,
    cost: { mana: 'mana' },
    effects: [hit({ weapon: true, melee: true })],
    byLevel: { 10: { dmg: [11, 11], mana: 25 }, 30: { dmg: [30, 30], mana: 45 }, 60: { dmg: [70, 70], mana: 100 } },
  },
  'hunter.wingclip': {
    name: 'Wing Clip',
    icon: 'wing-clip',
    school: 'physical',
    mechanic: 'physical',
    category: 'control',
    tags: ['control', 'melee'],
    learn: 12,
    range: 5,
    startsMelee: true,
    desc: 'Melee: a little damage and a 50 % slow for 10 s.',
    forever: BETA('Improved Wing Clip (Survival) can immobilise for 5 s.'),
    cost: { mana: 'mana' },
    effects: [
      hit({ amount: 'dmg', melee: true }),
      {
        type: 'custom',
        fn: ({ state, u, t, ab, api }) =>
          api.applyAura(state, u, t, {
            id: 'hunter.wingclip',
            name: 'Wing Clip',
            icon: 'wing-clip',
            debuff: true,
            duration: 10,
            mods: { slow: val(ab, 'slow', 0.5) },
          }),
      },
      {
        type: 'custom',
        fn: ({ state, u, t, api }) => {
          if (T(u).impWingClip && t.alive && state.rng() < T(u).impWingClip)
            api.applyAura(state, u, t, { id: 'hunter.iwc', name: 'Improved Wing Clip', icon: 'wing-clip', debuff: true, duration: 5, cc: 'root', dr: 'root' });
        },
      },
    ],
    byLevel: { 30: { dmg: [5, 5], mana: 40, slow: 0.5 }, 60: { dmg: [50, 50], mana: 80, slow: 0.6 } },
  },
  'hunter.mongoose': {
    name: 'Mongoose Bite',
    icon: 'mongoose',
    school: 'physical',
    mechanic: 'physical',
    category: 'damage',
    tags: ['core', 'melee'],
    learn: 16,
    range: 5,
    startsMelee: true,
    desc: 'Usable for 5 s after you dodge (Expose Prey can also enable it): weapon damage plus a bonus.',
    forever: BETA('Now weapon-damage based; Expose Prey enables it without a dodge; Lacerating Strikes adds a bleed.'),
    cooldown: 5,
    cost: { mana: 'mana' },
    canUse: ({ u }) => (u.auras.some((a) => a.id === MONGOOSE_READY.id) ? true : 'custom:Only after you dodge'),
    effects: [
      {
        type: 'custom',
        fn: (ctx) => {
          const { state, u, t, api } = ctx;
          api.removeAuraById(state, u, MONGOOSE_READY.id);
          const d = shot(ctx, { weapon: true, melee: true });
          if (T(u).laceratingStrikes && d > 0 && t.alive)
            api.applyAura(state, u, t, {
              id: 'hunter.lacerate',
              name: 'Lacerating Strikes',
              icon: 'claw',
              debuff: true,
              duration: 21,
              tick: { interval: 3, amount: (d * 0.4) / 7, school: 'physical', canCrit: true },
            });
        },
      },
    ],
    byLevel: { 30: { dmg: [22, 22], mana: 40 }, 60: { dmg: [57, 57], mana: 65 } },
  },
  'hunter.multishot': {
    ...SHOT,
    name: 'Multi-Shot',
    icon: 'multishot',
    category: 'damage',
    tags: ['aoe', 'rotation'],
    learn: 18,
    desc: 'Fires at up to 3 targets: weapon damage plus a bonus each. Shares its cooldown with Aimed Shot.',
    forever: OFF('Now shares its cooldown with Aimed Shot (datamine: 10 s cooldown).'),
    cooldown: 10,
    cost: { mana: 'mana' },
    sharedCooldown: { 'hunter.aimed': 10 },
    effects: [{ type: 'custom', aoe: { center: 'target', radius: 8, maxTargets: 3 }, fn: (ctx) => shot(ctx, { weapon: true }) }],
    byLevel: { 30: { dmg: [40, 40], mana: 140, range: 35 }, 60: { dmg: [150, 150], mana: 230, range: 35 } },
  },
  'hunter.aimed': {
    ...SHOT,
    name: 'Aimed Shot',
    icon: 'aimed',
    category: 'damage',
    tags: ['core', 'rotation', 'burst'],
    learn: 20,
    keepsAutoShot: true,
    desc: 'A 2 s aimed shot: weapon damage plus a bonus. Auto Shot keeps firing while you aim. Shares its cooldown with Multi-Shot.',
    forever: OFF('Baseline for every Hunter at 20 (was an MM talent). Datamine: 2 s cast, weapon damage + 166 at 60 (Classic +600).'),
    castTime: 2,
    cooldown: 6,
    cost: { mana: 'mana' },
    sharedCooldown: { 'hunter.multishot': 6 },
    effects: [hit({ weapon: true })],
    byLevel: { 30: { dmg: [34, 34], mana: 115, range: 35 }, 60: { dmg: [166, 166], mana: 310, range: 35 } },
  },
  'hunter.disengage': {
    name: 'Disengage',
    icon: 'disengage',
    school: 'physical',
    mechanic: 'physical',
    category: 'defensive',
    tags: ['defensive', 'threat'],
    learn: 20,
    range: 5,
    desc: 'Melee range: sharply reduces your threat on the target. Not a leap.',
    forever: OFF('Threat reduction doubled. Still a threat drop, not a leap.'),
    cooldown: 5,
    cost: { mana: 'mana' },
    effects: [
      {
        type: 'custom',
        fn: ({ u, t }) => {
          if (t.threat && t.threat[u.id] !== undefined) t.threat[u.id] = Math.max(0, t.threat[u.id] - (u.level >= 60 ? 1100 : u.level >= 30 ? 560 : 280));
        },
      },
    ],
    byLevel: { 30: { mana: 50 }, 60: { mana: 150 } },
  },
  'hunter.feign': {
    name: 'Feign Death',
    icon: 'feign',
    school: 'physical',
    mechanic: 'physical',
    category: 'defensive',
    tags: ['defensive', 'threat'],
    learn: 30,
    target: 'self',
    gcd: 0,
    desc: 'Play dead: enemies forget you (they will go for your pet if it is fighting). Moving or acting ends it. If nobody is left to fight, enemies reset — and heal.',
    forever: BETA('Drops threat; enemies still attack your pet. Survival Tactics adds hit chance.'),
    cooldown: 30,
    cost: { mana: 'mana' },
    usableWhileCC: false,
    effects: [
      {
        type: 'aura',
        to: 'self',
        aura: {
          id: 'hunter.fd',
          name: 'Feign Death',
          icon: 'feign',
          duration: 360,
          cancelOnMove: true,
          cancelOnAction: true,
          onApply: ({ state, u, api }) => {
            u.flags.feigned = true;
            api.dropThreat(state, u, 1);
            u.autoRanged = false;
            u.autoMelee = false;
            if (u.casting) api.cancelCast(state, u, 'feign');
            for (const e of state.list) if (e.side !== u.side && e.target === u.id) e.target = null;
          },
          onRemove: ({ u }) => {
            u.flags.feigned = false;
          },
        },
      },
    ],
    byLevel: { 30: { mana: 80 }, 60: { mana: 80 } },
  },
  'hunter.freezetrap': {
    name: 'Freezing Trap',
    icon: 'trap-freeze',
    school: 'frost',
    mechanic: 'physical',
    category: 'control',
    tags: ['control', 'trap'],
    learn: 20,
    target: 'none',
    fx: 'none',
    desc: 'Place a trap at your feet (arms in 1.5 s). The first enemy to step in is frozen solid for up to 10–20 s; any damage breaks it. Shares the Frost-trap cooldown.',
    forever: OFF('Traps now work in combat; Frost and Fire traps have separate 30 s cooldowns; still placed at your own feet.'),
    cooldown: 30,
    cost: { mana: 'mana' },
    sharedCooldown: { 'hunter.frosttrap': 30 },
    effects: [
      {
        type: 'custom',
        fn: ({ state, u, ab, api }) =>
          trapZone(state, api, u, ab, {
            onTrigger: (st, z, v, api2, tal) =>
              api2.applyAura(st, u, v[0], {
                id: 'hunter.frozen',
                name: 'Freezing Trap',
                icon: 'trap-freeze',
                school: 'frost',
                debuff: true,
                duration: val(ab, 'dur') * (tal.cleverTraps ? 1.3 : 1),
                cc: 'incap',
                breakOnDamage: true,
                dr: 'incap',
                dispel: 'magic',
              }),
          }),
      },
    ],
    byLevel: { 30: { dur: 10, mana: 50 }, 60: { dur: 20, mana: 100 } },
  },
  'hunter.immotrap': {
    name: 'Immolation Trap',
    icon: 'trap-fire',
    school: 'fire',
    mechanic: 'physical',
    category: 'dot',
    tags: ['dot', 'trap'],
    learn: 16,
    target: 'none',
    fx: 'none',
    desc: 'Place a fire trap at your feet: the first enemy to step in burns for 15 s. Shares the Fire-trap cooldown.',
    forever: OFF('Usable in combat; Fire traps scale with Attack Power (Oct 16).', 'bz-devnotes'),
    cooldown: 30,
    cost: { mana: 'mana' },
    sharedCooldown: { 'hunter.explosivetrap': 30 },
    effects: [
      {
        type: 'custom',
        fn: ({ state, u, ab, api }) =>
          trapZone(state, api, u, ab, {
            onTrigger: (st, z, v, api2, tal) =>
              api2.applyAura(st, u, v[0], {
                id: 'hunter.immolation',
                name: 'Immolation Trap',
                icon: 'trap-fire',
                school: 'fire',
                debuff: true,
                duration: 15,
                tick: { interval: 3, amount: (val(ab, 'tick') + 0.03 * api2.statOf(u, 'rap')) * (tal.cleverTraps ? 1.3 : 1), school: 'fire' },
              }),
          }),
      },
    ],
    byLevel: { 30: { tick: 43, mana: 90 }, 60: { tick: 138, mana: 245 } },
  },
  'hunter.explosivetrap': {
    name: 'Explosive Trap',
    icon: 'trap-fire',
    school: 'fire',
    mechanic: 'physical',
    category: 'damage',
    tags: ['aoe', 'trap'],
    learn: 34,
    target: 'none',
    fx: 'none',
    desc: 'Place a fire trap at your feet: it explodes on the first enemy, burning everything within 10 yards. Shares the Fire-trap cooldown.',
    forever: OFF('Usable in combat and scales with Attack Power; the main Hunter AoE with Multi-Shot and Volley.', 'bz-devnotes'),
    cooldown: 30,
    cost: { mana: 'mana' },
    sharedCooldown: { 'hunter.immotrap': 30 },
    effects: [
      {
        type: 'custom',
        fn: ({ state, u, ab, api }) =>
          trapZone(state, api, u, ab, {
            onTrigger: (st, z, v, api2, tal) => {
              const mult = tal.cleverTraps ? 1.3 : 1;
              for (const x of api2.unitsInRadius(st, z, 10, (e) => e.side !== u.side)) {
                api2.dealDamage(st, u, x, {
                  amount: roll(st, val(ab, 'dmg')) * mult + 0.05 * api2.statOf(u, 'rap'),
                  school: 'fire',
                  kind: 'spell',
                  ability: ab.id,
                });
                if (x.alive)
                  api2.applyAura(st, u, x, {
                    id: 'hunter.explosive',
                    name: 'Explosive Trap',
                    icon: 'trap-fire',
                    school: 'fire',
                    debuff: true,
                    duration: 20,
                    tick: { interval: 2, amount: val(ab, 'tick') * mult, school: 'fire' },
                  });
              }
            },
          }),
      },
    ],
    byLevel: { 60: { dmg: [208, 264], tick: 33, mana: 520 } },
  },
  'hunter.frosttrap': {
    name: 'Frost Trap',
    icon: 'trap-frost',
    school: 'frost',
    mechanic: 'physical',
    category: 'control',
    tags: ['control', 'aoe', 'trap'],
    learn: 28,
    target: 'none',
    fx: 'none',
    desc: 'Place a trap at your feet: when an enemy steps in it becomes an ice slick for 30 s, slowing enemies within 10 yards by 60 %.',
    forever: OFF('Usable in combat; Entrapment (Survival) roots on the first activation.'),
    cooldown: 30,
    cost: { mana: 'mana' },
    sharedCooldown: { 'hunter.freezetrap': 30 },
    effects: [
      {
        type: 'custom',
        fn: ({ state, u, ab, api }) =>
          trapZone(state, api, u, ab, {
            onTrigger: (st, z, v, api2, tal) => {
              if (tal.entrapment)
                for (const x of api2.unitsInRadius(st, z, 10, (e) => e.side !== u.side))
                  api2.applyAura(st, u, x, { id: 'hunter.entrap', name: 'Entrapment', icon: 'trap-frost', debuff: true, duration: 4, cc: 'root', dr: 'root' });
              api2.spawnZone(st, {
                shape: { type: 'circle', r: 10 },
                x: z.x,
                y: z.y,
                owner: u.id,
                side: u.side,
                duration: 30,
                interval: 1,
                visual: 'frost',
                label: 'Frost Trap',
                ab,
                effects: [
                  {
                    type: 'aura',
                    aura: { id: 'hunter.frosttrap.slow', name: 'Frost Trap', icon: 'trap-frost', debuff: true, duration: 1.5, mods: { slow: 0.6 } },
                  },
                ],
              });
            },
          }),
      },
    ],
    byLevel: { 30: { mana: 60 }, 60: { mana: 60 } },
  },
  'hunter.rapidfire': {
    name: 'Rapid Fire',
    icon: 'rapid-fire',
    school: 'physical',
    mechanic: 'physical',
    category: 'cooldown',
    tags: ['cooldown', 'burst'],
    learn: 26,
    target: 'self',
    gcd: 0,
    desc: 'Ranged and melee attack speed +40 % for 15 s.',
    forever: BETA('Now affects ranged and melee attacks; main DPS cooldown for every spec.'),
    cooldown: 'cd',
    cost: { mana: 'mana' },
    effects: [
      {
        type: 'aura',
        to: 'self',
        aura: { id: 'hunter.rapidfire', name: 'Rapid Fire', icon: 'rapid-fire', duration: 15, mods: { rangedHaste: 0.4, meleeHaste: 0.4 } },
      },
    ],
    byLevel: { 30: { mana: 100, cd: 300 }, 60: { mana: 100, cd: 300 } },
  },
  'hunter.mendpet': {
    name: 'Mend Pet',
    icon: 'mend-pet',
    school: 'nature',
    category: 'heal',
    tags: ['pet', 'heal'],
    learn: 12,
    target: 'pet',
    range: 20,
    desc: 'Channel for 5 s to heal your pet every second.',
    forever: OFF('Improved Mend Pet (BM) also cuts its cost and can cleanse a debuff each tick.'),
    cost: { mana: 'mana' },
    channel: {
      duration: 5,
      ticks: 5,
      effects: [
        {
          type: 'custom',
          fn: ({ state, u, t, ab, api }) => {
            if (!t || !t.alive) return;
            api.healUnit(state, u, t, { amount: val(ab, 'heal'), ability: ab.id, isTick: true });
            if (T(u).impMendPet && state.rng() < 0.5) api.dispelUnit(state, u, t, ['magic', 'curse', 'poison', 'disease'], 1, 'debuff', ab.id);
          },
        },
      ],
    },
    byLevel: { 30: { heal: 68, mana: 155 }, 60: { heal: 245, mana: 480 } },
  },
  'hunter.revive': {
    name: 'Revive Pet',
    icon: 'revive-pet',
    school: 'nature',
    category: 'pet',
    tags: ['pet'],
    learn: 10,
    target: 'pet',
    allowDead: true,
    requireDeadPet: true,
    noRangeCheck: true,
    desc: 'Bring your dead pet back with a slow cast and a big chunk of your mana.',
    forever: BETA(
      'Datamine: 10 s cast, all of your base mana, pet returns at 15 % health. Improved Revive Pet (BM) cuts 6 s and 40 % of the cost and adds 30 % health.',
    ),
    castTime: 'ct',
    cost: { mana: 1 },
    costPct: 'pct',
    effects: [
      {
        type: 'custom',
        fn: ({ state, u, t, api }) => {
          if (t && !t.alive) {
            api.reviveUnit(state, t, T(u).impRevive ? 0.45 : 0.15);
            t.petCmd = 'follow';
          }
        },
      },
    ],
    byLevel: { 10: { ct: 10, pct: 1.0 } },
  },
  'hunter.aspect.hawk': {
    name: 'Aspect of the Hawk',
    icon: 'aspect-hawk',
    school: 'nature',
    mechanic: 'physical',
    category: 'buff',
    tags: ['optional-utility'],
    learn: 10,
    target: 'self',
    gcd: 0,
    desc: 'Ranged attack power bonus. One Aspect at a time.',
    forever: BETA('Rank 6 value cut 50 % (datamine). Deadly Aspects (BM) adds Quick Shots procs.'),
    cooldown: 1,
    cost: { mana: 'mana' },
    effects: [aspect('hunter.aspect.hawk', 'Aspect of the Hawk', 'aspect-hawk', (u) => ({ statAdd: { rap: u.level >= 60 ? 120 : u.level >= 30 ? 50 : 20 } }))],
    byLevel: { 10: { mana: 20 }, 30: { mana: 50 }, 60: { mana: 120 } },
  },
  'hunter.aspect.monkey': {
    name: 'Aspect of the Monkey',
    icon: 'aspect-monkey',
    school: 'nature',
    mechanic: 'physical',
    category: 'defensive',
    tags: ['defensive'],
    learn: 4,
    target: 'self',
    gcd: 0,
    desc: '+8 % dodge chance. One Aspect at a time.',
    forever: BETA('Range changed to 100 yd; Improved Aspect of the Monkey (BM) gives the pet half.'),
    cooldown: 1,
    cost: { mana: 'mana' },
    effects: [aspect('hunter.aspect.monkey', 'Aspect of the Monkey', 'aspect-monkey', { dodge: 0.08 })],
    byLevel: { 10: { mana: 20 }, 30: { mana: 20 }, 60: { mana: 20 } },
  },
  'hunter.aspect.beast': {
    name: 'Aspect of the Beast',
    icon: 'paw',
    school: 'nature',
    mechanic: 'physical',
    category: 'buff',
    tags: ['optional-utility'],
    learn: 30,
    target: 'self',
    gcd: 0,
    desc: 'Melee attack power bonus (and untrackable). The Survival aspect. One Aspect at a time.',
    forever: OFF('Now also grants melee Attack Power (datamine +50 to +110).'),
    cooldown: 1,
    cost: { mana: 'mana' },
    effects: [aspect('hunter.aspect.beast', 'Aspect of the Beast', 'paw', (u) => ({ statAdd: { ap: u.level >= 60 ? 110 : 50 } }))],
    byLevel: { 30: { mana: 50 }, 60: { mana: 110 } },
  },
  'hunter.hawk': {
    ...SHOT,
    name: 'Summon Hawk',
    icon: 'eye',
    category: 'pet',
    tags: ['core', 'rotation', 'pet'],
    learn: 25,
    desc: 'A hawk dive-bombs your target and keeps attacking it for 18 s. Up to 2 hawks at once. Shares its cooldown with Arcane Shot.',
    forever: OFF('New 16-point BM talent; hawks have very little health and are buffed by Unleashed Fury and Ferocity.'),
    cooldown: 6,
    cost: { mana: 'mana' },
    sharedCooldown: { 'hunter.arcane': 6 },
    effects: [
      hit({ coef: 0.05, power: 'rap' }),
      {
        type: 'custom',
        fn: ({ state, u, t, ab, api }) => {
          const mine = state.list.filter((x) => x.alive && x.templateId === 'hunter.hawk' && x.ownerId === u.id).sort((a, b) => a.spawnedAt - b.spawnedAt);
          while (mine.length >= 2) {
            const old = mine.shift();
            old.alive = false;
            old.hidden = true;
          }
          const tal = T(u);
          const L = u.level >= 60 ? 60 : 30;
          const h = api.spawnUnit(state, 'hunter.hawk', {
            x: t.x + 1,
            y: t.y - 1,
            ownerId: u.id,
            level: u.level,
            target: t.id,
            maxHp: L === 60 ? 450 : 150,
            melee: L === 60 ? { min: 36, max: 46, speed: 1.6 } : { min: 11, max: 15, speed: 1.6 },
            stats: { critPhys: 0.05 + (tal.ferocity || 0) },
            auras: [
              {
                id: 'hunter.hawk.life',
                name: 'Hawk',
                hidden: true,
                duration: 18,
                onRemove: ({ u: hk }) => {
                  hk.alive = false;
                  hk.hidden = true;
                },
              },
              ...(tal.unleashedFury ? [{ id: 'pet.t.fury', hidden: true, permanent: true, mods: { dmgDone: { all: 1 + tal.unleashedFury } } }] : []),
            ],
          });
          h.autoMelee = true;
        },
      },
    ],
    byLevel: { 30: { dmg: [32, 32], mana: 80, range: 35 }, 60: { dmg: [108, 108], mana: 190, range: 35 } },
  },
  'hunter.intimidation': {
    name: 'Intimidation',
    icon: 'growl',
    school: 'physical',
    mechanic: 'physical',
    category: 'control',
    tags: ['control', 'pet', 'interrupt'],
    learn: 30,
    target: 'pet',
    gcd: 0,
    desc: 'Your pet’s next attack stuns its target for 3 s (and is a guaranteed crit). Works as a makeshift interrupt.',
    forever: OFF('Now +100 % crit on the stunning attack; requires Bestial Swiftness.'),
    cooldown: 60,
    cost: { mana: 'mana' },
    effects: [{ type: 'aura', aura: { id: 'hunter.intim', name: 'Intimidation', icon: 'growl', duration: 15 } }],
    byLevel: { 30: { mana: 40 }, 60: { mana: 80 } },
  },
  'hunter.bestialwrath': {
    name: 'Bestial Wrath',
    icon: 'beast-wrath',
    school: 'physical',
    mechanic: 'physical',
    category: 'cooldown',
    tags: ['cooldown', 'burst', 'pet'],
    learn: 40,
    target: 'pet',
    gcd: 0,
    desc: 'Your pet deals 50 % more damage for 18 s and cannot be crowd-controlled.',
    forever: BETA('BM capstone, unchanged per datamine.'),
    cooldown: 120,
    cost: { mana: 'mana' },
    effects: [
      {
        type: 'aura',
        aura: {
          id: 'hunter.bw',
          name: 'Bestial Wrath',
          icon: 'beast-wrath',
          duration: 18,
          mods: { dmgDone: { all: 1.5 } },
          onApply: ({ u }) => {
            u.immune.cc = true;
          },
          onRemove: ({ u }) => {
            u.immune.cc = false;
          },
        },
      },
    ],
    byLevel: { 60: { mana: 120 } },
  },
  'hunter.scatter': {
    ...SHOT,
    minRange: 0,
    name: 'Scatter Shot',
    icon: 'scatter',
    category: 'control',
    tags: ['control', 'interrupt'],
    learn: 30,
    desc: 'Short range (15 yd): half weapon damage and disorients the target for 4 s. Any damage breaks it.',
    forever: BETA('MM 21-point-tier talent, unchanged per datamine; guides call it a pseudo-interrupt.'),
    cooldown: 30,
    cost: { mana: 'mana' },
    effects: [
      hit({ weapon: true, weaponMult: 0.5 }),
      {
        type: 'custom',
        fn: ({ u, t }) => {
          if (t && t.casting && t.casting.ab.mechanic !== 'physical') t.casting = null;
        },
      },
      {
        type: 'aura',
        aura: { id: 'hunter.scatter', name: 'Scatter Shot', icon: 'scatter', debuff: true, duration: 4, cc: 'incap', breakOnDamage: true, dr: 'scatter' },
      },
    ],
    byLevel: { 30: { mana: 50, range: 15 }, 60: { mana: 100, range: 15 } },
  },
  'hunter.sniper': {
    ...SHOT,
    name: 'Sniper Shot',
    icon: 'aimed',
    category: 'damage',
    tags: ['core', 'burst', 'rotation'],
    learn: 40,
    keepsAutoShot: true,
    desc: 'A 4 s, 45-yard shot: weapon damage plus a large bonus, and +10 yards on your next 3 shots. Auto Shot keeps firing while you aim.',
    forever: OFF('MM 31-point capstone (datamine: weapon damage + 295 at 60); Icy Veins suspects it may be a damage loss in PvE.'),
    castTime: 4,
    cooldown: 15,
    cost: { mana: 'mana' },
    effects: [hit({ weapon: true })],
    byLevel: { 60: { dmg: [295, 295], mana: 365, range: 45 } },
  },
  'hunter.volley': {
    name: 'Volley',
    icon: 'volley',
    school: 'arcane',
    mechanic: 'physical',
    category: 'damage',
    tags: ['aoe'],
    learn: 40,
    target: 'point',
    range: 35,
    fxRadius: 8,
    desc: 'Channel a rain of arrows on a ground area for 6 s (click the ground to aim).',
    forever: BETA('+40 % over Classic; Barrage adds up to 10 %.'),
    cost: { mana: 'mana' },
    channel: {
      duration: 6,
      ticks: 6,
      effects: [{ type: 'custom', aoe: { center: 'point', radius: 8 }, fn: (ctx) => shot(ctx, { amount: 'tick', school: 'arcane' }) }],
    },
    byLevel: { 60: { tick: [112, 112], mana: 490 } },
  },
  'hunter.tranq': {
    ...SHOT,
    name: 'Tranquilizing Shot',
    icon: 'tranq',
    school: 'nature',
    category: 'dispel',
    tags: ['dispel', 'optional-utility'],
    learn: 60,
    desc: 'Removes a Frenzy (enrage) effect from an enemy.',
    forever: {
      status: 'beta-observation',
      src: 'wh-forever',
      note: 'Datamined at 60. How Forever teaches it is unconfirmed (Classic: a Molten Core tome; Molten Core is not a launch raid).',
    },
    cooldown: 20,
    cost: { mana: 'mana' },
    effects: [{ type: 'dispel', types: ['enrage'], count: 1, which: 'buff' }],
    byLevel: { 60: { mana: 270, range: 35 } },
  },
  'hunter.strider': {
    name: 'Strider Kick',
    icon: 'raptor-strike',
    school: 'physical',
    mechanic: 'physical',
    category: 'damage',
    tags: ['core', 'melee', 'mobility'],
    learn: 30,
    range: 5,
    startsMelee: true,
    desc: 'A kick for full weapon damage that also gives you +30 % movement speed for 3 s — step out, shoot, step back in. Not an interrupt.',
    forever: OFF('New Survival 21-point gold medal.'),
    cooldown: 8,
    cost: { mana: 'mana' },
    effects: [
      hit({ weapon: true, melee: true }),
      { type: 'aura', to: 'self', aura: { id: 'hunter.strider', name: 'Strider Kick', icon: 'raptor-strike', duration: 3, mods: { speed: 0.3 } } },
    ],
    byLevel: { 30: { mana: 50 }, 60: { mana: 100 } },
  },
  'hunter.counter': {
    name: 'Counterattack',
    icon: 'shield',
    school: 'physical',
    mechanic: 'physical',
    category: 'control',
    tags: ['melee', 'control'],
    learn: 25,
    range: 5,
    desc: 'Usable for 5 s after you parry: half weapon damage plus a bonus and the target is immobilised for 5 s. Cannot be dodged or parried.',
    forever: OFF('Now the Survival 16-point gold medal; scales with weapon damage.'),
    cooldown: 5,
    cost: { mana: 'mana' },
    canUse: ({ u }) => (u.auras.some((a) => a.id === COUNTER_READY.id) ? true : 'custom:Only after you parry'),
    effects: [
      {
        type: 'custom',
        fn: (ctx) => {
          ctx.api.removeAuraById(ctx.state, ctx.u, COUNTER_READY.id);
          shot(ctx, { weapon: true, weaponMult: 0.5, melee: true, noAvoid: true });
        },
      },
      { type: 'aura', aura: { id: 'hunter.counter.root', name: 'Counterattack', icon: 'shield', debuff: true, duration: 5, cc: 'root', dr: 'root' } },
    ],
    byLevel: { 30: { dmg: [40, 40], mana: 45 }, 60: { dmg: [110, 110], mana: 85 } },
  },
  'hunter.deterrence': {
    name: 'Deterrence',
    icon: 'shield-wall',
    school: 'physical',
    mechanic: 'physical',
    category: 'defensive',
    tags: ['defensive'],
    learn: 20,
    target: 'self',
    gcd: 0,
    desc: '+25 % dodge and parry for 10 s — and every dodge or parry readies Mongoose Bite or Counterattack.',
    forever: BETA('Unchanged; Survivalist’s Discipline cuts its cooldown.'),
    cooldown: 'cd',
    cost: { mana: 'mana' },
    effects: [
      {
        type: 'aura',
        to: 'self',
        aura: { id: 'hunter.deterrence', name: 'Deterrence', icon: 'shield-wall', duration: 10, mods: { dodge: 0.25, parry: 0.25 } },
      },
    ],
    byLevel: { 30: { mana: 30, cd: 300 }, 60: { mana: 30, cd: 300 } },
  },
});

// ---------------------------------------------------------------- talents per spec

const TALENTS = {
  bm30: {
    deadlyAspects: 0.1,
    enduranceTraining: 0.15,
    focusedFire: true,
    impRevive: true,
    unleashedFury: 0.15,
    ferocity: 0.1,
    impMendPet: true,
    bestialDiscipline: true,
    hawk: true,
    intimidation: true,
  },
  mm30: {
    lethalAttacks: 0.05,
    hawkEye: 6,
    improvedStings: true,
    efficiency: 0.85,
    carefulAim: true,
    rapidKilling: true,
    impArcane: 1.5,
    trueshot: 30,
    mortalShots: true,
    scatter: true,
  },
  sv30: {
    deflection: 0.05,
    savageStrikes: true,
    survivalist: 0.1,
    impWingClip: 0.2,
    cleverTraps: true,
    entrapment: true,
    deterrence: true,
    predatorsEdge: true,
    counter: true,
    strider: true,
  },
  bm60: {
    deadlyAspects: 0.1,
    enduranceTraining: 0.15,
    focusedFire: true,
    impRevive: true,
    unleashedFury: 0.15,
    ferocity: 0.1,
    impMendPet: true,
    bestialDiscipline: true,
    hawk: true,
    intimidation: true,
    frenzy: true,
    bestialWrath: true,
    lethalAttacks: 0.05,
    efficiency: 0.85,
    impArcane: 1.5,
  },
  mm60: {
    lethalAttacks: 0.05,
    hawkEye: 6,
    improvedStings: true,
    efficiency: 0.85,
    carefulAim: true,
    rapidKilling: true,
    rapidRecuperation: true,
    impArcane: 1.5,
    trueshot: 50,
    mortalShots: true,
    scatter: true,
    barrage: true,
    rws: true,
    loneWolf: true,
    sniper: true,
    deadlyAspects: 0.1,
  },
  sv60: {
    deflection: 0.05,
    savageStrikes: true,
    survivalist: 0.1,
    impWingClip: 0.2,
    cleverTraps: true,
    entrapment: true,
    deterrence: true,
    predatorsEdge: true,
    counter: true,
    strider: true,
    exposePrey: 0.1,
    resourcefulness: true,
    survDiscipline: true,
    lightningReflexes: 0.15,
    laceratingStrikes: true,
    deadlyAspects: 0.1,
    hit: 0.03,
  },
};

const P = (name, desc, forever) => ({ name, desc, forever });
const PASSIVES = {
  bm30: [
    P('Unleashed Fury · Ferocity', 'Pet and hawks: +15 % damage, +10 % crit.', OFF('Values lowered; now also buff hawks.')),
    P('Deadly Aspects', 'In Aspect of the Hawk, Auto Shot can grant +30 % ranged attack speed for 12 s.', OFF('Renamed Improved Aspect of the Hawk.')),
    P('Endurance Training', 'Pet health +15 %.', OFF('Thick Hide merged in.')),
    P('Bestial Discipline', 'Pet Focus regen +20 %, and half your mana regen continues while casting.', OFF('The mana part is new.')),
    P('Improved Mend Pet · Improved Revive Pet', 'Mend Pet cleanses debuffs; Revive Pet is faster and cheaper.', OFF()),
  ],
  mm30: [
    P('Lethal Attacks · Mortal Shots', '+5 % crit; ranged crits hit 15 % harder.', OFF()),
    P('Careful Aim', 'Your Intellect adds to your attack power.', OFF('New talent.')),
    P('Improved Stings · Efficiency', 'Serpent Sting +20 %; shots and stings cost 15 % less.', OFF()),
    P('Rapid Killing', 'Rapid Fire cooldown −2 min; after a kill your next shot deals +20 %.', OFF('New talent.')),
    P(
      'Hawk Eye · Trueshot Aura',
      '+6 yd range; +30 ranged attack power for you (and, in Forever, your whole raid).',
      OFF('Trueshot Aura raid-wide since Oct 16.', 'bz-devnotes'),
    ),
    P('Keeps the pet', 'Leveling guides advise against Lone Wolf at this level, so your wolf stays.', IV('iv-mm')),
  ],
  sv30: [
    P(
      'Savage Strikes · Predator’s Edge',
      '+4 % crit chance with melee abilities; melee ability crits +30 % and a stronger off-hand.',
      OFF('Predator’s Edge is the dual-wield enabler.'),
    ),
    P('Deflection · Survivalist', '+5 % parry; +10 % health.', OFF()),
    P('Improved Wing Clip · Entrapment · Clever Traps', 'Wing Clip can root; Frost Trap roots; traps last longer and burn harder.', OFF()),
    P('Dual wield (approximation)', 'Two one-handed weapons are modelled as one faster weapon.', { status: 'approximation', note: 'Engine simplification.' }),
  ],
};
PASSIVES.bm60 = [
  ...PASSIVES.bm30,
  P('Frenzy', 'Pet crits grant +30 % attack speed for 8 s.', BETA()),
  P('Marksmanship splash (20)', 'Lethal Attacks, Efficiency, Improved Arcane Shot.', IV('wt-bm', 'Warcraft Tavern’s 31/20/0 projection.')),
];
PASSIVES.mm60 = [
  P(
    'Lone Wolf',
    '+20 % damage with all attacks while you have no pet — so at 60 this build has none.',
    OFF('New 11-point talent; endgame PvE guides take it.'),
  ),
  ...PASSIVES.mm30.slice(0, 5),
  P('Rapid Recuperation', 'Serpent Sting lets half your mana regen continue while casting for 15 s.', OFF('New; Icy Veins: fixes most mana issues.')),
  P('Barrage · Ranged Weapon Specialization', 'Multi-Shot, Aimed Shot and Volley +10 %; ranged damage +5 %.', OFF()),
];
PASSIVES.sv60 = [
  ...PASSIVES.sv30,
  P('Expose Prey', 'Attacks on your Hunter’s Mark target have a 10 % chance to ready Mongoose Bite.', OFF('New.')),
  P('Lacerating Strikes', 'Mongoose Bite also bleeds for 40 % of its damage over 21 s.', OFF('New 31-point gold medal.')),
  P(
    'Resourcefulness · Survivalist’s Discipline',
    'Traps and melee cost 60 % less; ability crits let mana regen run while casting; trap and Deterrence cooldowns −40 %.',
    OFF('New.'),
  ),
];

// ---------------------------------------------------------------- build

const BARS = {
  10: [
    'hunter.autoshot',
    'hunter.serpent',
    'hunter.arcane',
    'hunter.mark',
    'hunter.concussive',
    'hunter.raptor',
    'hunter.aspect.hawk',
    'hunter.aspect.monkey',
    'hunter.revive',
  ],
  bm30: [
    'hunter.autoshot',
    'hunter.serpent',
    'hunter.arcane',
    'hunter.aimed',
    'hunter.multishot',
    'hunter.hawk',
    'hunter.mark',
    'hunter.concussive',
    'hunter.raptor',
    'hunter.wingclip',
    'hunter.disengage',
    'hunter.feign',
    'hunter.freezetrap',
    'hunter.immotrap',
    'hunter.rapidfire',
    'hunter.intimidation',
    'hunter.mendpet',
    'hunter.aspect.hawk',
    'hunter.revive',
  ],
  mm30: [
    'hunter.autoshot',
    'hunter.serpent',
    'hunter.arcane',
    'hunter.aimed',
    'hunter.multishot',
    'hunter.mark',
    'hunter.concussive',
    'hunter.scatter',
    'hunter.raptor',
    'hunter.wingclip',
    'hunter.disengage',
    'hunter.feign',
    'hunter.freezetrap',
    'hunter.immotrap',
    'hunter.rapidfire',
    'hunter.mendpet',
    'hunter.aspect.hawk',
    'hunter.aspect.monkey',
    'hunter.revive',
  ],
  sv30: [
    'hunter.raptor',
    'hunter.mongoose',
    'hunter.strider',
    'hunter.counter',
    'hunter.wingclip',
    'hunter.deterrence',
    'hunter.autoshot',
    'hunter.serpent',
    'hunter.arcane',
    'hunter.mark',
    'hunter.concussive',
    'hunter.disengage',
    'hunter.feign',
    'hunter.freezetrap',
    'hunter.immotrap',
    'hunter.rapidfire',
    'hunter.mendpet',
    'hunter.aspect.beast',
    'hunter.revive',
  ],
  bm60: [
    'hunter.autoshot',
    'hunter.serpent',
    'hunter.arcane',
    'hunter.aimed',
    'hunter.multishot',
    'hunter.hawk',
    'hunter.bestialwrath',
    'hunter.rapidfire',
    'hunter.mark',
    'hunter.concussive',
    'hunter.tranq',
    'hunter.wingclip',
    'hunter.disengage',
    'hunter.feign',
    'hunter.freezetrap',
    'hunter.explosivetrap',
    'hunter.intimidation',
    'hunter.mendpet',
    'hunter.aspect.hawk',
    'hunter.revive',
  ],
  mm60: [
    'hunter.autoshot',
    'hunter.serpent',
    'hunter.arcane',
    'hunter.aimed',
    'hunter.multishot',
    'hunter.sniper',
    'hunter.rapidfire',
    'hunter.mark',
    'hunter.concussive',
    'hunter.scatter',
    'hunter.tranq',
    'hunter.volley',
    'hunter.raptor',
    'hunter.wingclip',
    'hunter.disengage',
    'hunter.feign',
    'hunter.freezetrap',
    'hunter.explosivetrap',
    'hunter.frosttrap',
    'hunter.aspect.hawk',
  ],
  sv60: [
    'hunter.raptor',
    'hunter.mongoose',
    'hunter.strider',
    'hunter.counter',
    'hunter.wingclip',
    'hunter.deterrence',
    'hunter.autoshot',
    'hunter.serpent',
    'hunter.arcane',
    'hunter.mark',
    'hunter.concussive',
    'hunter.tranq',
    'hunter.rapidfire',
    'hunter.disengage',
    'hunter.feign',
    'hunter.freezetrap',
    'hunter.immotrap',
    'hunter.mendpet',
    'hunter.aspect.beast',
    'hunter.revive',
  ],
};

const LOOP = {
  10: 'Send the wolf in, Hunter’s Mark, Serpent Sting, then let Auto Shot work while you weave Arcane Shot. If something reaches you: Raptor Strike, Concussive Shot, step back to 8+ yards.',
  bm30: 'Pet in, Serpent Sting, keep two hawks rolling (they share a cooldown with Arcane Shot), Aimed Shot on cooldown; Auto Shot never stops. Mend Pet when the wolf is low; Feign Death if you pull aggro.',
  mm30: 'Serpent Sting, then Aimed Shot and Arcane Shot on cooldown with Auto Shot underneath; Multi-Shot for groups. Scatter Shot or Concussive to keep melee off you. Your own shots carry the damage.',
  sv30: 'Mark, Serpent Sting, run in: Raptor Strike on cooldown, Mongoose Bite after dodges, Strider Kick to step out and weave a shot, Counterattack after parries, Immolation Trap at your feet.',
  bm60: 'Two hawks, Aimed Shot on cooldown, Serpent Sting up, Arcane Shot only with spare mana; Rapid Fire + Bestial Wrath together. The wolf does a big share — keep it alive and on the right target.',
  mm60: 'No pet (Lone Wolf). Sniper Shot and Aimed Shot on cooldown, Serpent Sting up, Arcane Shot on cooldown, Rapid Fire on cooldown; traps and Scatter Shot for anything that reaches you.',
  sv60: 'Melee: Raptor Strike, Mongoose Bite whenever Expose Prey or a dodge readies it (it bleeds now), Strider Kick, Counterattack; weave Serpent Sting and Arcane Shot; Rapid Fire speeds both melee and shots.',
};

const snap = (level) => (level >= 45 ? 60 : level >= 20 ? 30 : 10);

export const KIT = {
  id: 'hunter',
  name: 'Hunter',
  color: '#AAD372',
  resource: 'mana',
  race: 'Orc',
  portrait: 'orc-hunter',
  tagline: 'A partner at your side and the longest range in the game.',
  fantasy:
    'A tracker who never fights alone. The wolf takes the hits while Auto Shot and your shots do the work; traps, Feign Death and Concussive Shot turn bad pulls around. Forever adds Summon Hawk for Beast Mastery, a petless Lone Wolf path for Marksmanship and a melee Survival.',
  strengthsSummary: 'Solo power and low downtime (the pet tanks, Auto Shot is free), long range and kiting, traps usable in combat, Feign Death resets.',
  risksSummary:
    'No interrupts, stuns or dispels of your own; Beast Mastery may feel simple at 60; pets and hawks may struggle in raids; level-60 loops are projections.',
  specs: {
    30: [
      {
        id: 'bm',
        name: 'Beast Mastery',
        blurb: 'Your wolf tanks and hits hard; two hawks join from 25.',
        forever: { status: 'confirmed-official', note: 'Talent tree official; 21-point pick approximated.' },
      },
      {
        id: 'mm',
        name: 'Marksmanship',
        blurb: 'Your own shots: Aimed, Arcane, Rapid Killing. The wolf stays at this level.',
        forever: { status: 'confirmed-official', note: 'Talent tree official; 21-point pick approximated.' },
      },
      {
        id: 'sv',
        name: 'Survival',
        blurb: 'Melee hunter: Raptor Strike, Mongoose Bite, Strider Kick, traps.',
        forever: { status: 'confirmed-official', note: 'Reworked into melee; guides call it weakest early.' },
      },
    ],
    60: [
      {
        id: 'bm',
        name: 'Beast Mastery',
        blurb: 'Hawks, Bestial Wrath, Frenzy — the pet-centred spec.',
        forever: { status: 'reported-guide', note: 'Warcraft Tavern 31/20/0 projection; untested at 60.' },
      },
      {
        id: 'mm',
        name: 'Marksmanship',
        blurb: 'Lone Wolf (no pet, +20 %), Sniper Shot, raid-wide Trueshot Aura.',
        forever: { status: 'reported-guide', note: 'Warcraft Tavern 5/46/0 projection; Sniper Shot value disputed.' },
      },
      {
        id: 'sv',
        name: 'Survival',
        blurb: 'Dual-wield melee with Expose Prey and bleeding Mongoose Bites.',
        forever: { status: 'approximation', note: 'No level-60 Survival rotation has been published.' },
      },
    ],
  },
  rolesFor: () => ['dps'],
  // The race picks portrait, racials and base attributes; see content/races.js.
  races: () => racesFor('hunter'),
  build(opts) {
    const race = validRace('hunter', opts.race);
    return applyRace(this.buildBase({ ...opts, race }), { classId: 'hunter', race });
  },
  buildBase({ level, spec, trialId, groupBuffs = [], race }) {
    const L = snap(level);
    const sp = L === 10 ? null : spec && TALENTS[spec + L] ? spec : 'bm';
    const key = L === 10 ? 10 : sp + L;
    // Lone Wolf is an endgame-PvE pick; a battleground Marksman keeps the pet (dual spec from 40).
    const pvpPet = key === 'mm60' && trialId === 't4';
    const tal = L === 10 ? {} : pvpPet ? { ...TALENTS[key], loneWolf: false } : TALENTS[key];
    // Orc Hunter: Classic base stats + gear profile; Lightning Reflexes is +15 % Agility, Survivalist +10 % health.
    // A Marksman's own Trueshot Aura (talent below) replaces the raid's.
    const buffs = buffTotals(
      groupBuffs.filter((n) => !(tal.trueshot && n === 'trueshot')),
      L,
    );
    const S = deriveStats({
      classId: 'hunter',
      race,
      level: L,
      gear: GEAR.hunter[L],
      buffs,
      pct: { agi: tal.lightningReflexes || 0 },
      hpPct: tal.survivalist || 0,
    });
    const range = 35 + (tal.hawkEye || 0);
    const stats = { ...S.stats, hit: S.stats.hit + (tal.hit || 0) };
    stats.critPhys += tal.lethalAttacks || 0;
    if (tal.carefulAim) stats.rap += S.attrs.int;
    if (tal.trueshot) stats.rap += tal.trueshot;
    stats.parry = 0.05 + (tal.deflection || 0);
    const w = (k) => {
      const [min, max, speed] = WEAPONS[k][L];
      return { min, max, speed };
    };
    // Survival dual-wields: one combined weapon for white swings (both hands add attack power,
    // off hand at 75 %) with the dual-wield miss penalty; abilities use the main hand.
    const melee = sp === 'sv' ? { ...w('hunterDual'), dualWield: true, mh: w('hunterMH') } : w('hunterMelee');
    melee.coef = (melee.speed / 14) * (sp === 'sv' ? 1.75 : 1);
    const bow = w('bow');
    const ammo = Math.round(AMMO[L].dps * bow.speed);
    const ranged = {
      kind: 'autoshot',
      ...bow,
      min: bow.min + ammo,
      max: bow.max + ammo,
      coef: bow.speed / 14,
      range,
      minRange: 8,
      windup: 0.5,
      visual: 'arrow',
    };
    const tweaks = {};
    const shotsCost = tal.efficiency || 1;
    const svCost = tal.resourcefulness ? 0.4 : 1;
    for (const id of ['hunter.serpent', 'hunter.arcane', 'hunter.aimed', 'hunter.multishot', 'hunter.concussive', 'hunter.sniper', 'hunter.hawk'])
      tweaks[id] = { costMultFn: () => shotsCost };
    for (const id of [
      'hunter.raptor',
      'hunter.mongoose',
      'hunter.strider',
      'hunter.counter',
      'hunter.wingclip',
      'hunter.freezetrap',
      'hunter.immotrap',
      'hunter.explosivetrap',
      'hunter.frosttrap',
    ])
      tweaks[id] = { costMultFn: () => svCost * (['hunter.raptor', 'hunter.wingclip'].includes(id) ? shotsCost : 1) };
    for (const id of [
      'hunter.serpent',
      'hunter.arcane',
      'hunter.aimed',
      'hunter.multishot',
      'hunter.concussive',
      'hunter.sniper',
      'hunter.hawk',
      'hunter.tranq',
    ])
      tweaks[id] = { ...(tweaks[id] || {}), range: (id === 'hunter.sniper' ? 45 : 35) + (tal.hawkEye || 0) };
    if (tal.impArcane) tweaks['hunter.arcane'] = { ...tweaks['hunter.arcane'], cd: 6 - tal.impArcane };
    if (tal.rapidKilling) tweaks['hunter.rapidfire'] = { cd: 180 };
    if (tal.impRevive) tweaks['hunter.revive'] = { ct: 4, pct: 0.3 };
    if (tal.survDiscipline) {
      const pair = {
        'hunter.freezetrap': 'hunter.frosttrap',
        'hunter.frosttrap': 'hunter.freezetrap',
        'hunter.immotrap': 'hunter.explosivetrap',
        'hunter.explosivetrap': 'hunter.immotrap',
      };
      for (const [id, other] of Object.entries(pair)) tweaks[id] = { ...tweaks[id], cooldown: 18, sharedCooldown: { [other]: 18 } };
      tweaks['hunter.deterrence'] = { cd: 180 };
    }
    const auras = [{ id: 'hunter.quiver', name: 'Quiver', icon: 'arrow', hidden: true, permanent: true, mods: { rangedHaste: AMMO[L].haste } }];
    const startAspect = sp === 'sv' ? 'hunter.aspect.beast' : 'hunter.aspect.hawk';
    auras.push({
      id: startAspect,
      name: startAspect === 'hunter.aspect.beast' ? 'Aspect of the Beast' : 'Aspect of the Hawk',
      icon: startAspect === 'hunter.aspect.beast' ? 'paw' : 'aspect-hawk',
      school: 'nature',
      permanent: true,
      mods: startAspect === 'hunter.aspect.beast' ? { statAdd: { ap: L >= 60 ? 110 : 50 } } : { statAdd: { rap: L >= 60 ? 120 : L >= 30 ? 50 : 20 } },
    });
    if (tal.loneWolf) auras.push({ id: 'hunter.t.lonewolf', name: 'Lone Wolf', icon: 'arrow', permanent: true, mods: { dmgDone: { all: 1.2 } } });
    if (tal.focusedFire) auras.push({ id: 'hunter.t.ff', name: 'Focused Fire', hidden: true, permanent: true, mods: { dmgDone: { all: 1.02 } } });
    if (tal.bestialDiscipline) auras.push({ id: 'hunter.t.bd', name: 'Bestial Discipline', hidden: true, permanent: true, mods: { castRegen: 0.5 } });
    if (tal.mortalShots) auras.push({ id: 'hunter.t.ms', name: 'Mortal Shots', hidden: true, permanent: true });
    if (tal.savageStrikes) auras.push({ id: 'hunter.t.ss', name: 'Savage Strikes', hidden: true, permanent: true, mods: { dmgDone: { melee: 1.04 } } });
    const bar = pvpPet ? BARS[key].map((id) => (id === 'hunter.volley' ? 'hunter.mendpet' : id === 'hunter.tranq' ? 'hunter.revive' : id)) : BARS[key];
    const prevKey = L === 60 ? sp + '30' : L === 30 ? 10 : null;
    const prev = prevKey ? BARS[prevKey] : null;
    const hasPet = !tal.loneWolf;
    const petTpl = hasPet ? petTemplate(L, tal) : null;
    if (petTpl) {
      // Forever: pets scale with the Hunter (Wowhead / Icy Veins): 10 % of the higher attack power,
      // all of the crit, 2 health per Stamina and 30 % of the armor.
      const share = Math.round(((0.1 * Math.max(stats.rap, stats.ap)) / 14) * petTpl.melee.speed);
      petTpl.melee.min += share;
      petTpl.melee.max += share;
      petTpl.stats.critPhys = Math.max(petTpl.stats.critPhys, stats.critPhys + (tal.ferocity || 0));
      petTpl.maxHp += 2 * S.attrs.sta;
      petTpl.armor += Math.round(0.3 * S.armor);
    }
    return {
      template: {
        name: 'You',
        portrait: 'orc-hunter',
        maxHp: S.maxHp,
        resources: { mana: S.mana },
        stats,
        regen: { ...S.regen },
        armor: S.armor,
        tags: ['humanoid'],
        ranged,
        melee,
        abilities: [...bar],
        auras,
        meta: { talents: tal, spec: sp },
        hooks: {
          afterDamage: (x) => {
            hunterAfterDamage(x);
            hunterMeleeSwing(x);
          },
          onAutoHit: hunterOnAutoHit,
          onKill: hunterOnKill,
          onPartyKill: hunterOnKill,
          onAvoid: hunterOnAvoid,
        },
        flags: { wandMacro: false },
      },
      bar,
      pet: petTpl ? { template: petTpl, bar: ['pet.bite', 'pet.growl', 'pet.dash', 'pet.howl'], autocast: {} } : null,
      consumables: ['item.rest', 'item.healpot', 'item.manapot', ...RACIALS.orc],
      tweaks,
      passives:
        L === 10
          ? [P('Tame Beast', 'Your wolf comes from the level-10 race quest chain “Taming the Beast”.', OFF())]
          : pvpPet
            ? [
                P(
                  'PvP build: no Lone Wolf',
                  'Guides take Lone Wolf for endgame PvE only; for battlegrounds this Marksman keeps the wolf (dual specialization from level 40).',
                  IV('wt-mm', 'Our build choice for the PvP trial.'),
                ),
                ...PASSIVES[key].slice(1),
              ]
            : PASSIVES[key],
      newSince: prev ? { from: L === 60 ? 30 : 10, ids: bar.filter((id) => !prev.includes(id)) } : null,
      loopHint: LOOP[key],
      filler: sp === 'sv' ? 'hunter.raptor' : 'hunter.autoshot',
    };
  },
};
