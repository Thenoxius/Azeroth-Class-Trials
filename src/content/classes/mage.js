// Mage kit — WoW: Forever. Level snapshots 10 / 30 / 60; specs Frost, Fire, Arcane
// (and a Frostfire hybrid at 60, built around the confirmed level-40 Frostfire Bolt).
// Spell names, levels and mechanics follow research/research-mage.json. Spell ranks use the
// datamined Forever values (Wowhead spellbook/talent diff, live build 1.60.1.70630, read
// 2026-10-27); character stats come from Classic rules and a gear profile (../stats.js).
import { registerAbilities } from '../../engine/registry.js';
import { roll, val, stacksOf, addStacks, consumeStack, breakCC, wandAbility, RACIALS, NOTE_NUMBERS } from './shared.js';
import { deriveStats, buffTotals, GEAR, WEAPONS } from '../stats.js';

const IV = (src, note) => ({ status: 'reported-guide', src, note });
const BETA = (note) => ({ status: 'beta-observation', src: 'wh-forever', note });
const OFF = (note, src = 'bz-dd-mage') => ({ status: 'confirmed-official', src, note });

// ---------------------------------------------------------------- shared mechanics

const CHILL = { id: 'mage.chill', name: 'Chilled', icon: 'bolt-frost', school: 'frost', debuff: true, duration: 'slowDur', mods: { slow: 0.4 }, dispel: 'magic', chill: true };
const FROSTBITE = { id: 'mage.frostbite', name: 'Frostbite', icon: 'snowflake', school: 'frost', debuff: true, duration: 5, cc: 'root', frozen: true, dispel: 'magic', dr: 'root' };
const FOF = { id: 'mage.fof', name: 'Fingers of Frost', icon: 'snowflake', school: 'frost', duration: 15, maxStacks: 2, refresh: true };
const HU = { id: 'mage.hu', name: 'Heating Up', icon: 'flame', school: 'fire', duration: 20, maxStacks: 3, refresh: true };
const MB = { id: 'mage.mb', name: 'Missile Barrage', icon: 'missiles', school: 'arcane', duration: 15 };
const CLEARCAST = { id: 'mage.cc', name: 'Clearcasting', icon: 'intellect', school: 'arcane', duration: 15, mods: { costMult: { all: 0 } } };
const WINTERS_CHILL = { id: 'mage.wc', name: "Winter's Chill", icon: 'snowflake', school: 'frost', debuff: true, duration: 15, maxStacks: 5, refresh: true };
const IMP_SCORCH = { id: 'mage.isc', name: 'Fire Vulnerability', icon: 'scorch', school: 'fire', debuff: true, duration: 30, maxStacks: 5, refresh: true, stackMods: true, mods: { dmgTakenMine: { fire: 1.03 } } };

const T = (u) => (u.meta && u.meta.talents) || {};
const isFrostSpell = (ab) => ab.school === 'frost' || !!ab.frostfire;
const isFireSpell = (ab) => ab.school === 'fire' || !!ab.frostfire;

// Frozen for Shatter / Ice Lance: a real freeze, or a Fingers of Frost charge.
function frozenFor(state, api, u, t, consume) {
  if (t.cc.frozen) return 'freeze';
  if (api.findAura(u, FOF.id)) {
    if (consume) consumeStack(state, api, u, FOF.id);
    return 'fof';
  }
  return false;
}

// Every Mage damage spell goes through here so talents apply consistently.
function mageHit(ctx, o = {}) {
  const { state, u, t, ab, api } = ctx;
  if (!t || !t.alive) return 0;
  const tal = T(u);
  const fire = isFireSpell(ab);
  const frost = isFrostSpell(ab);
  const frozen = o.noShatter ? false : frozenFor(state, api, u, t, true);
  let critBonus = 0;
  let mult = o.mult || 1;
  let critMult;
  if (frozen && tal.shatter) critBonus += tal.shatter;
  if (frozen && ab.frozenMult) mult *= ab.frozenMult;
  if (tal.incineration && ['mage.fireblast', 'mage.scorch', 'mage.icelance', 'mage.ablast'].includes(ab.id)) critBonus += tal.incineration;
  if (tal.criticalMass && fire) critBonus += tal.criticalMass;
  if (tal.arcaneImpact && ab.school === 'arcane') critBonus += tal.arcaneImpact;
  if (tal.arcaneInstability) { critBonus += 0.03; mult *= 1.03; }
  const comb = fire && api.findAura(u, 'mage.combustion');
  if (comb) critBonus += 0.1 * comb.stacks;
  if (frost && tal.iceShards) critMult = 2;
  if (ab.school === 'arcane' && tal.arcaneMind) critMult = 2;
  if (fire && tal.firePower) mult *= 1.1;
  const coef = val(ab, o.coef ?? 'coef');
  const amount = roll(state, val(ab, o.amount ?? 'dmg')) + coef * (o.extraSp || 0) + (o.extraDmg || 0);
  // Frostfire Bolt hits whichever of Fire or Frost the target resists less (official).
  const school = o.school || (ab.frostfire ? ((t.resist.fire || 0) > (t.resist.frost || 0) ? 'frost' : 'fire') : ab.school);
  const dealt = api.dealDamage(state, u, t, { amount, coef, school, kind: 'spell', ability: ab.id, critBonus, critMult, bonusMult: mult, threat: o.threat ?? 1 });
  // Winter's Chill: Frostbolt, Frost Blast and Fingers-of-Frost Ice Lances stack it for Cone of Cold.
  if (tal.wintersChill && t.alive && (ab.id === 'mage.frostbolt' || ab.id === 'mage.frostblast' || (ab.id === 'mage.icelance' && frozen === 'fof'))) addStacks(state, api, u, t, WINTERS_CHILL, 1);
  return dealt;
}

const hit = (o) => ({ type: 'custom', fn: (ctx) => mageHit(ctx, o) });

// Chill side effects shared by Frostbolt, Frost Blast, Cone of Cold, Frost Armor and Frostfire Bolt.
function chillProcs(ctx) {
  const { state, u, t, api } = ctx;
  if (!t || !t.alive) return;
  const tal = T(u);
  if (tal.frostbite && state.rng() < tal.frostbite) api.applyAura(state, u, t, FROSTBITE);
  if (tal.fof && state.rng() < tal.fof) addStacks(state, api, u, u, FOF, tal.fofCharges || 1);
}
const chillAndProcs = [{ type: 'aura', aura: CHILL }, { type: 'custom', fn: chillProcs }];

function igniteDef() {
  return {
    id: 'mage.ignite', name: 'Ignite', icon: 'flame', school: 'fire', debuff: true, duration: 4,
    tick: {
      interval: 2,
      type: 'custom',
      fn: ({ state, u: holder, aura, src, api }) => {
        const left = Math.max(1, aura.data.left || 1);
        const per = (aura.data.pool || 0) / left;
        aura.data.pool -= per;
        aura.data.left = left - 1;
        if (src && src.alive && per > 0) api.dealDamage(state, src, holder, { amount: per, school: 'fire', kind: 'dot', ability: 'mage.ignite', isTick: true });
      },
    },
  };
}
function addIgnite(state, api, u, t, amount) {
  // Forever: one Ignite per Mage; a new crit rolls the unfinished damage into the new one.
  let a = api.findAura(t, 'mage.ignite', u.id);
  const pool = (a ? a.data.pool || 0 : 0) + amount;
  if (!a) a = api.applyAura(state, u, t, igniteDef());
  else a.remaining = 4;
  if (a) { a.data.pool = pool; a.data.left = 2; }
}

// Damage-dealt hook: Ignite, Heating Up, Master of Elements, Improved Scorch, Impact, Combustion, Winter's Chill.
function afterDamage({ state, u, api, pk, dst, final }) {
  if (pk.isTick || !pk.ability) return;
  const ab = u.ab[pk.ability];
  if (!ab || !ab.id.startsWith('mage.')) return;
  const tal = T(u);
  const fire = isFireSpell(ab);
  const frost = isFrostSpell(ab);
  if (pk.crit && final > 0) {
    if (tal.ignite && fire) addIgnite(state, api, u, dst, final * tal.ignite);
    if (tal.masterOfElements && (fire || frost) && u.res.mana) u.res.mana.cur = Math.min(u.res.mana.max, u.res.mana.cur + tal.masterOfElements * (val(ab, ab.cost && ab.cost.mana) || 0));
  }
  if (tal.heatingUp && ['mage.fireball', 'mage.ffb', 'mage.fireblast', 'mage.scorch'].includes(ab.id)) {
    const n = (pk.crit ? 1 : 0) + (ab.id === 'mage.fireblast' ? 1 : 0);
    if (n) addStacks(state, api, u, u, HU, n);
  }
  if (tal.impScorch && ab.id === 'mage.scorch' && dst.alive) addStacks(state, api, u, dst, IMP_SCORCH, 1);
  if (tal.impact && fire && dst.alive && state.rng() < tal.impact) api.applyAura(state, u, dst, { id: 'mage.impact', name: 'Impact', icon: 'flame', school: 'fire', debuff: true, duration: 2, cc: 'stun', dr: 'stun' });
  const comb = fire && api.findAura(u, 'mage.combustion');
  if (comb) {
    if (pk.crit) comb.data.crits = (comb.data.crits || 0) + 1;
    if ((comb.data.crits || 0) >= 3) api.removeAura(state, u, comb, 'consumed');
    else comb.stacks++;
  }
}

// Cast hook: Missile Barrage, Arcane Blast stacks, Clearcasting, Presence of Mind, Heating Up spend.
function onCast({ state, u, api, ab }) {
  if (!ab || !ab.id.startsWith('mage.')) return;
  const tal = T(u);
  const damaging = ['damage', 'filler', 'dot', 'control'].includes(ab.category) && ab.cost;
  const pom = api.findAura(u, 'mage.pom');
  if (pom && val(ab, ab.castTime) > 0) api.removeAura(state, u, pom, 'consumed');
  if (ab.id === 'mage.pyro' && !pom) api.removeAuraById(state, u, HU.id);
  if (damaging && api.findAura(u, CLEARCAST.id)) api.removeAuraById(state, u, CLEARCAST.id);
  if (damaging && tal.arcaneConcentration && state.rng() < tal.arcaneConcentration) api.applyAura(state, u, u, CLEARCAST);
  if (tal.missileBarrage) {
    const chance = ab.id === 'mage.ablast' ? 0.4 : ['mage.fireball', 'mage.frostbolt', 'mage.frostblast', 'mage.ffb', 'mage.awrath'].includes(ab.id) ? 0.2 : 0;
    if (chance && state.rng() < chance) api.applyAura(state, u, u, MB);
  }
  if (ab.id === 'mage.ablast') {
    const int = u.stats.int || 0;
    addStacks(state, api, u, u, { id: 'mage.abstack', name: 'Arcane Blast', icon: 'arcane-blast', school: 'arcane', duration: 15, maxStacks: 4, stackMods: true, mods: { statAdd: { sp: Math.round(int * 0.15) } } }, 1);
  }
}

// Frost / Ice Armor: melee attackers are chilled (and can trigger Frostbite / Fingers of Frost).
function afterDamageTaken({ state, u, api, pk, src }) {
  if (!src || !src.alive || pk.kind !== 'melee' || !api.hostile(u, src)) return;
  if (!u.meta.frostArmor) return;
  api.applyAura(state, u, src, { id: 'mage.frostarmor.chill', name: 'Chilled', icon: 'snowflake', school: 'frost', debuff: true, duration: 5, mods: { slow: 0.3, meleeHaste: -0.2 }, dispel: 'magic', chill: true });
  chillProcs({ state, u, t: src, api });
}

// ---------------------------------------------------------------- abilities

registerAbilities({
  ...wandAbility('mage.wand', 'arcane'),
  'mage.frostbolt': {
    name: 'Frostbolt', icon: 'bolt-frost', school: 'frost', category: 'filler', tags: ['core', 'rotation', 'filler'], learn: 4,
    desc: 'Frost damage and a 40 % slow. Its guaranteed chill is what Frostbite and Fingers of Frost feed on.',
    forever: BETA('Datamine: 40 % slow; ranks 8–17 % below Classic (470–506 at 60). Down-ranked Rank 1 gets no Frostbite chance (official).'),
    range: 30, castTime: 'ct', cost: { mana: 'mana' }, projectile: { speed: 30 },
    effects: [hit(), ...chillAndProcs],
    byLevel: {
      10: { dmg: [28, 32], ct: 1.8, mana: 35, coef: 0.27, slowDur: 6 },
      30: { dmg: [104, 114], ct: 3.0, mana: 100, coef: 0.81, slowDur: 7 },
      60: { dmg: [470, 506], ct: 3.0, mana: 290, coef: 0.81, slowDur: 9 },
    },
  },
  'mage.frostblast': {
    name: 'Frost Blast', icon: 'bolt-frost', school: 'frost', category: 'control', tags: ['control', 'mobility'], learn: 24,
    desc: 'Quick 1.5 s cast: a little Frost damage and a 40 % slow for 9 s. The kiting spell that replaced down-ranked Frostbolt.',
    forever: OFF('New in Forever (Oct 15): learned at 24, affected by Frostbolt talents.', 'bz-devnotes'),
    range: 30, castTime: 1.5, cost: { mana: 'mana' }, projectile: { speed: 32 },
    effects: [hit(), { type: 'aura', aura: { ...CHILL, duration: 9 } }, { type: 'custom', fn: chillProcs }],
    byLevel: { 30: { dmg: [28, 31], mana: 40, coef: 0.4 }, 60: { dmg: [80, 88], mana: 90, coef: 0.4 } },
  },
  'mage.fireball': {
    name: 'Fireball', icon: 'fireball', school: 'fire', category: 'filler', tags: ['core', 'rotation', 'filler'], learn: 1,
    desc: 'Fire damage plus a small burn over time.',
    forever: BETA('12 ranks; datamined damage 20–33 % below Classic. Procs Missile Barrage and Heating Up.'),
    range: 35, castTime: 'ct', cost: { mana: 'mana' }, projectile: { speed: 26 },
    effects: [hit(), { type: 'aura', aura: { id: 'mage.fireball.dot', name: 'Fireball', icon: 'fireball', school: 'fire', debuff: true, duration: 'dotDur', tick: { interval: 2, amount: 'dotTick', school: 'fire' } } }],
    byLevel: {
      10: { dmg: [27, 39], ct: 2.0, mana: 45, coef: 0.27, dotDur: 6, dotTick: 1 },
      30: { dmg: [138, 182], ct: 3.5, mana: 185, coef: 1.0, dotDur: 8, dotTick: 6 },
      60: { dmg: [437, 553], ct: 3.5, mana: 410, coef: 1.0, dotDur: 8, dotTick: 15 },
    },
  },
  'mage.fireblast': {
    name: 'Fire Blast', icon: 'scorch', school: 'fire', category: 'damage', tags: ['core', 'burst'], learn: 6,
    desc: 'Instant Fire damage, no travel time. Usable while moving. With Heating Up it always adds a charge.',
    forever: BETA('Always grants an extra Heating Up charge (official).'),
    range: 'range', cooldown: 'cd', cost: { mana: 'mana' }, effects: [hit()],
    byLevel: {
      10: { dmg: [27, 35], mana: 40, coef: 0.2, range: 20, cd: 8 },
      30: { dmg: [157, 187], mana: 165, coef: 0.43, range: 20, cd: 8 },
      60: { dmg: [417, 489], mana: 340, coef: 0.43, range: 20, cd: 8 },
    },
  },
  'mage.missiles': {
    name: 'Arcane Missiles', icon: 'missiles', school: 'arcane', category: 'damage', tags: ['core', 'rotation'], learn: 8,
    desc: 'Channel a volley of arcane missiles. Missile Barrage makes the next one free and twice as fast.',
    forever: BETA('Line of sight is checked once at the start (official). Missile Barrage: free, 50 % faster.'),
    range: 30, cost: { mana: 'mana' },
    channel: { duration: 'chDur', ticks: 'chTicks', projectile: { speed: 34 }, effects: [hit({ amount: 'per' })] },
    onChannelStart: ({ state, u, ab, api }) => {
      const mb = api.findAura(u, MB.id);
      if (!mb || !u.casting) return;
      api.removeAura(state, u, mb, 'consumed');
      u.casting.duration /= 2;
      u.casting.interval /= 2;
      u.casting.nextTick = u.casting.interval;
      if (u.res.mana) u.res.mana.cur = Math.min(u.res.mana.max, u.res.mana.cur + val(ab, ab.cost.mana));
    },
    byLevel: {
      10: { per: [25, 25], mana: 85, coef: 0.16, chDur: 3, chTicks: 3 },
      30: { per: [49, 49], mana: 235, coef: 0.24, chDur: 5, chTicks: 5 },
      60: { per: [213, 213], mana: 655, coef: 0.24, chDur: 5, chTicks: 5 },
    },
  },
  'mage.nova': {
    name: 'Frost Nova', icon: 'nova', school: 'frost', category: 'control', tags: ['control', 'aoe'], learn: 10, target: 'none', fx: 'ring', fxRadius: 10,
    desc: 'Freezes enemies within 10 yards in place for up to 8 s. Damage may break the freeze. Frozen targets can be Shattered.',
    forever: IV('iv-frost', '10 yd radius; guides say save it for emergencies in groups.'),
    cooldown: 'cd', cost: { mana: 'mana' },
    effects: [
      { type: 'custom', aoe: { center: 'self', radius: 10 }, fn: (ctx) => mageHit({ ...ctx, ab: ctx.ab }, { noShatter: true }) },
      { type: 'aura', aoe: { center: 'self', radius: 10 }, aura: { id: 'mage.nova', name: 'Frost Nova', icon: 'nova', school: 'frost', debuff: true, duration: 8, cc: 'root', frozen: true, breakDamage: 0.2, breakDamagePct: true, dr: 'root', dispel: 'magic' } },
    ],
    byLevel: { 10: { dmg: [22, 24], mana: 55, coef: 0.04, cd: 25 }, 30: { dmg: [35, 38], mana: 85, coef: 0.04, cd: 25 }, 60: { dmg: [72, 79], mana: 145, coef: 0.04, cd: 25 } },
  },
  'mage.poly': {
    name: 'Polymorph', icon: 'sheep', school: 'arcane', category: 'control', tags: ['control', 'optional-utility'], learn: 8,
    desc: 'Turns a beast or humanoid into a sheep: it cannot act and wanders. Any damage breaks it. One sheep per Mage.',
    forever: BETA('Unchanged from Classic per datamine; Beasts, Humanoids and Critters only.'),
    range: 30, castTime: 1.5, cost: { mana: 'mana' },
    canUse: ({ t }) => (t && (t.tags || []).some((x) => x === 'beast' || x === 'humanoid') ? true : 'custom:Only beasts and humanoids can be polymorphed'),
    onCast: ({ state, u, t, api }) => {
      for (const x of state.list) if (x !== t) api.removeAuraById(state, x, 'mage.poly', u.id);
    },
    effects: [{ type: 'aura', aura: { id: 'mage.poly', name: 'Polymorph', icon: 'sheep', school: 'arcane', debuff: true, duration: 'dur', cc: 'incap', breakOnDamage: true, dr: 'incap', dispel: 'magic', pvpDuration: 10 } }],
    byLevel: { 10: { mana: 60, dur: 20 }, 30: { mana: 90, dur: 30 }, 60: { mana: 150, dur: 50 } },
  },
  'mage.ae': {
    name: 'Arcane Explosion', icon: 'arcane-explosion', school: 'arcane', category: 'damage', tags: ['aoe'], learn: 14, target: 'none', fx: 'ring', fxRadius: 10,
    desc: 'Instant Arcane damage to every enemy within 10 yards. The Mage AoE for every spec; usable while moving. Expensive.',
    forever: IV('iv-frost', 'Main AoE for every spec; no damage falloff by target count.'),
    cost: { mana: 'mana' },
    effects: [{ type: 'custom', aoe: { center: 'self', radius: 10 }, fn: (ctx) => mageHit(ctx, { noShatter: true }) }],
    byLevel: { 30: { dmg: [95, 102], mana: 185, coef: 0.143 }, 60: { dmg: [239, 258], mana: 390, coef: 0.143 } },
  },
  'mage.cone': {
    name: 'Cone of Cold', icon: 'cone-cold', school: 'frost', category: 'control', tags: ['control', 'aoe'], learn: 26, target: 'none', fx: 'none',
    desc: "Frost damage and a 40 % slow in a cone in front of you (the first 4 targets +10 % slow and +3 s). Spends Winter's Chill stacks.",
    forever: OFF('Duration cut to stop mass kiting; Oct 15: first 4 targets +10 % slow and +3 s.'),
    cooldown: 10, cost: { mana: 'mana' },
    onCast: ({ state, u, api }) => {
      const tt = api.U(state, u.target);
      if (tt && tt.alive && api.hostile(u, tt)) u.facing = api.G.angleTo(u, tt);
    },
    effects: [
      {
        type: 'custom',
        aoe: { center: 'self', radius: 10, cone: Math.PI * 0.6 },
        fn: (ctx) => {
          const { state, u, t, api } = ctx;
          const wc = api.findAura(t, WINTERS_CHILL.id, u.id);
          const st = wc ? wc.stacks : 0;
          const tal = T(u);
          mageHit(ctx, { mult: (1 + 0.05 * st) * (tal.impCone || 1), extraDmg: st * 0.07 * api.statOf(u, 'sp') });
          if (wc) api.removeAura(state, t, wc, 'consumed');
        },
      },
      { type: 'aura', aoe: { center: 'self', radius: 10, cone: Math.PI * 0.6, maxTargets: 4 }, aura: { ...CHILL, id: 'mage.cone', name: 'Cone of Cold', icon: 'cone-cold', duration: 9, mods: { slow: 0.5 } } },
      { type: 'aura', aoe: { center: 'self', radius: 10, cone: Math.PI * 0.6 }, aura: { ...CHILL, duration: 6 } },
      { type: 'custom', aoe: { center: 'self', radius: 10, cone: Math.PI * 0.6, maxTargets: 4 }, fn: chillProcs },
    ],
    byLevel: { 30: { dmg: [96, 106], mana: 210, coef: 0.13 }, 60: { dmg: [333, 362], mana: 555, coef: 0.13 } },
  },
  'mage.blizzard': {
    name: 'Blizzard', icon: 'blizzard', school: 'frost', category: 'damage', tags: ['aoe'], learn: 20, target: 'point', fxRadius: 8,
    desc: 'Channel ice shards onto a ground area for 8 s. Click the ground to aim.',
    forever: BETA('Improved Blizzard slow capped at 40 % (official) — not modelled here.'),
    range: 30, cost: { mana: 'mana' },
    channel: { duration: 8, ticks: 8, effects: [{ type: 'custom', aoe: { center: 'point', radius: 8 }, fn: (ctx) => mageHit(ctx, { amount: 'tick', noShatter: true }) }] },
    byLevel: { 30: { tick: [43, 43], mana: 520, coef: 0.042 }, 60: { tick: [148, 148], mana: 1400, coef: 0.042 } },
  },
  'mage.flamestrike': {
    name: 'Flamestrike', icon: 'flamestrike', school: 'fire', category: 'damage', tags: ['aoe'], learn: 16, target: 'point', fxRadius: 8,
    desc: 'After a 3 s cast, the ground erupts: Fire damage to all enemies in the area, then it keeps burning for 8 s. One Flamestrike per Mage.',
    forever: BETA('New: only one Flamestrike active per Mage.'),
    range: 30, castTime: 3, cost: { mana: 'mana' },
    effects: [
      { type: 'custom', aoe: { center: 'point', radius: 8 }, fn: (ctx) => mageHit(ctx, { noShatter: true }) },
      {
        type: 'custom',
        fn: ({ state, u, ab, api, point }) => {
          state.zones = state.zones.filter((z) => !(z.owner === u.id && z.label === 'Flamestrike'));
          api.spawnZone(state, { shape: { type: 'circle', r: 8 }, x: point.x, y: point.y, owner: u.id, side: u.side, duration: 8, interval: 2, visual: 'fire', label: 'Flamestrike', ab, effects: [{ type: 'damage', amount: 'burn', school: 'fire' }] });
        },
      },
    ],
    byLevel: { 30: { dmg: [100, 126], burn: [21, 21], mana: 330, coef: 0.24 }, 60: { dmg: [384, 468], burn: [83, 83], mana: 990, coef: 0.24 } },
  },
  'mage.scorch': {
    name: 'Scorch', icon: 'scorch', school: 'fire', category: 'damage', tags: ['core', 'rotation'], learn: 22,
    desc: 'Fast 1.5 s Fire spell. With Improved Scorch each cast stacks Fire Vulnerability (+3 % Fire damage from you, 5 stacks).',
    forever: BETA('Values ~28–37 % below Classic. Improved Scorch now benefits only the caster (official).'),
    range: 30, castTime: 1.5, cost: { mana: 'mana' }, effects: [hit()],
    byLevel: { 30: { dmg: [54, 64], mana: 65, coef: 0.43 }, 60: { dmg: [170, 200], mana: 150, coef: 0.43 } },
  },
  'mage.pyro': {
    name: 'Pyroblast', icon: 'pyro', school: 'fire', category: 'damage', tags: ['core', 'burst'], learn: 20,
    desc: 'Huge 6 s Fire nuke plus a burn. Each Heating Up stack cuts the cast by 25 % (3 stacks: 1.5 s). Pre-cast it before a pull.',
    forever: OFF('11-point Fire talent; Heating Up (new) shortens it. Not consumed by a Presence of Mind Pyroblast.'),
    range: 35, castTime: 6, cost: { mana: 'mana' }, projectile: { speed: 24 },
    castTimeMultFn: (u) => {
      const a = u.auras.find((x) => x.id === HU.id);
      return 1 - 0.25 * (a ? a.stacks : 0);
    },
    effects: [hit(), { type: 'aura', aura: { id: 'mage.pyro.dot', name: 'Pyroblast', icon: 'pyro', school: 'fire', debuff: true, duration: 12, tick: { interval: 3, amount: 'dotTick', school: 'fire' } } }],
    byLevel: { 30: { dmg: [180, 227], mana: 195, coef: 1.0, dotTick: 19 }, 60: { dmg: [547, 674], mana: 440, coef: 1.0, dotTick: 53 } },
  },
  'mage.blastwave': {
    name: 'Blast Wave', icon: 'flame', school: 'fire', category: 'damage', tags: ['aoe', 'control', 'burst'], learn: 30, target: 'none', fx: 'ring', fxRadius: 10,
    desc: 'A wave of flame around you: Fire damage and a 50 % daze for 6 s to everything within 10 yards.',
    forever: OFF('21-point Fire talent; no longer requires Pyroblast.'),
    cooldown: 45, cost: { mana: 'mana' },
    effects: [
      { type: 'custom', aoe: { center: 'self', radius: 10 }, fn: (ctx) => mageHit(ctx, { noShatter: true }) },
      { type: 'aura', aoe: { center: 'self', radius: 10 }, aura: { id: 'mage.bw', name: 'Blast Wave', icon: 'flame', school: 'fire', debuff: true, duration: 6, mods: { slow: 0.5 } } },
    ],
    byLevel: { 30: { dmg: [154, 184], mana: 215, coef: 0.13 }, 60: { dmg: [464, 545], mana: 545, coef: 0.13 } },
  },
  'mage.combustion': {
    name: 'Combustion', icon: 'flame', school: 'fire', category: 'cooldown', tags: ['cooldown', 'burst'], learn: 40, target: 'self', gcd: 0,
    desc: 'Each Fire hit adds +10 % Fire crit chance until you have scored 3 Fire crits.',
    forever: OFF('31-point Fire capstone; back to 3 charges (Oct 1). Cooldown not stated for Forever — Classic 3 min used.'),
    cooldown: 180, effects: [{ type: 'aura', to: 'self', aura: { id: 'mage.combustion', name: 'Combustion', icon: 'flame', school: 'fire', duration: 120, stacks: 1 } }],
  },
  'mage.ffb': {
    name: 'Frostfire Bolt', icon: 'frostfire', school: 'fire', frostfire: true, category: 'filler', tags: ['core', 'rotation', 'filler'], learn: 40,
    desc: 'Counts as both Fire and Frost: Fireball-like damage, a burn and a 40 % slow (a chill, so Frostbite can trigger). Fire and Frost talents both apply.',
    forever: OFF('New baseline spell at 40; built for hybrid builds (Ignite + Ice Shards = 280 % crit).'),
    range: 35, castTime: 'ct', cost: { mana: 'mana' }, projectile: { speed: 27, visual: 'frost' },
    effects: [hit(), { type: 'aura', aura: { id: 'mage.ffb.dot', name: 'Frostfire Bolt', icon: 'frostfire', school: 'fire', debuff: true, duration: 9, tick: { interval: 3, amount: 'dotTick', school: 'fire' }, mods: { slow: 0.4 }, chill: true, dispel: 'magic' } }, { type: 'custom', fn: chillProcs }],
    byLevel: { 60: { dmg: [286, 331], ct: 3.0, mana: 370, coef: 0.95, dotTick: 19 } },
  },
  'mage.icelance': {
    name: 'Ice Lance', icon: 'ice-lance', school: 'frost', category: 'damage', tags: ['core', 'burst'], learn: 20, frozenMult: 3,
    desc: 'Instant, usable while moving. Small damage — but triple against Frozen targets or with a Fingers of Frost charge.',
    forever: OFF('New 11-point Frost talent; +200 % vs Frozen (cut from 300 % on Oct 15).'),
    range: 30, cost: { mana: 'mana' }, effects: [hit()],
    byLevel: { 30: { dmg: [35, 41], mana: 55, coef: 0.14 }, 60: { dmg: [140, 164], mana: 160, coef: 0.14 } },
  },
  'mage.iceblock': {
    name: 'Ice Block', icon: 'ice-block', school: 'frost', category: 'defensive', tags: ['defensive'], learn: 25, target: 'self', gcd: 0,
    desc: 'Encase yourself in ice for 10 s: immune to all damage and effects, but you cannot move, attack or cast. Enemies look for another target.',
    forever: OFF('Now the Frost 16-point gold medal. Cooldown not stated — Classic 5 min used.'),
    cooldown: 300, usableWhileCC: true, breaksStun: true,
    effects: [
      { type: 'custom', fn: ({ state, u, api }) => { breakCC(state, api, u, ['stun', 'root', 'fear', 'incap']); for (const a of [...u.auras]) if (a.def.debuff) api.removeAura(state, u, a, 'removed'); } },
      { type: 'aura', to: 'self', aura: { id: 'mage.iceblock', name: 'Ice Block', icon: 'ice-block', school: 'frost', duration: 10, immune: true, cc: ['root', 'silence', 'disarm'], onApply: ({ u }) => { u.autoRanged = false; u.wandResume = false; } } },
    ],
  },
  'mage.coldsnap': {
    name: 'Cold Snap', icon: 'snowflake', school: 'frost', category: 'cooldown', tags: ['cooldown', 'defensive'], learn: 30, target: 'self', gcd: 0,
    desc: 'Finishes the cooldown of your other Frost spells (Frost Nova, Cone of Cold, Ice Block, Ice Barrier). 10 min cooldown.',
    forever: OFF('Now the 21-point gold medal; cooldown raised to 10 min.'),
    cooldown: 600,
    effects: [{ type: 'custom', fn: ({ u }) => { for (const id of ['mage.nova', 'mage.cone', 'mage.iceblock', 'mage.icebarrier', 'mage.frostblast']) delete u.cds[id]; } }],
  },
  'mage.icebarrier': {
    name: 'Ice Barrier', icon: 'ice-barrier', school: 'frost', category: 'defensive', tags: ['defensive', 'rotation'], learn: 40, target: 'self',
    desc: 'Absorbs damage for 1 min and adds 3 % Frost damage; while it holds, your casts are not pushed back.',
    forever: BETA('31-point Frost capstone (calculator); +3 % Frost damage, +3 % more and no pushback while the shield holds.'),
    cooldown: 30, cost: { mana: 'mana' },
    effects: [{ type: 'custom', fn: ({ state, u, ab, api }) => api.applyAura(state, u, u, { id: 'mage.icebarrier', name: 'Ice Barrier', icon: 'ice-barrier', school: 'frost', duration: 60, absorb: Math.round(val(ab, 'absorb') + 0.1 * api.statOf(u, 'sp')), mods: { dmgDone: { frost: 1.03 } } }) }],
    byLevel: { 60: { absorb: 835, mana: 480 } },
  },
  'mage.ablast': {
    name: 'Arcane Blast', icon: 'arcane-blast', school: 'arcane', category: 'filler', tags: ['core', 'rotation', 'resource'], learn: 20,
    desc: 'Fast 1.5 s Arcane spell. Each cast grants spell damage equal to 15 % of your Intellect (up to 4 stacks, 15 s) — and makes the next Arcane Blast cost 175 % more per stack.',
    forever: OFF('11-point Arcane talent, redesigned Oct 15 (stacks Intellect as spell damage, cost rises per stack).', 'bz-devnotes'),
    range: 30, castTime: 1.5, cost: { mana: 'mana' }, projectile: { speed: 36 },
    costMultFn: (u) => {
      const a = u.auras.find((x) => x.id === 'mage.abstack');
      return 1 + 1.75 * (a ? a.stacks : 0);
    },
    effects: [hit()],
    byLevel: { 30: { dmg: [79, 90], mana: 101, coef: 0.43 }, 60: { dmg: [231, 267], mana: 191, coef: 0.43 } },
  },
  'mage.awrath': {
    name: 'Arcane Wrath', icon: 'arcane-blast', school: 'arcane', category: 'damage', tags: ['core', 'rotation'], learn: 25,
    desc: 'Slow 3.5 s Arcane nuke that hits as if you had extra spell power equal to 5 % of your maximum mana. 6 s cooldown.',
    forever: OFF('New 16-point Arcane talent (Oct 15).', 'bz-devnotes'),
    range: 30, castTime: 3.5, cooldown: 6, cost: { mana: 'mana' }, projectile: { speed: 28 },
    effects: [{ type: 'custom', fn: (ctx) => mageHit(ctx, { extraSp: 0.05 * ((ctx.u.res.mana && ctx.u.res.mana.max) || 0) }) }],
    byLevel: { 30: { dmg: [122, 146], mana: 140, coef: 1.0 }, 60: { dmg: [439, 529], mana: 395, coef: 1.0 } },
  },
  'mage.pom': {
    name: 'Presence of Mind', icon: 'hourglass', school: 'arcane', category: 'cooldown', tags: ['cooldown', 'burst'], learn: 30, target: 'self', gcd: 0,
    desc: 'Your next spell with a cast time becomes instant.',
    forever: BETA('Unchanged tooltip; cooldown not stated — Classic 3 min used.'),
    cooldown: 180, effects: [{ type: 'aura', to: 'self', aura: { id: 'mage.pom', name: 'Presence of Mind', icon: 'hourglass', school: 'arcane', duration: 30, mods: { castTime: { all: 0 } } } }],
  },
  'mage.apower': {
    name: 'Arcane Power', icon: 'arcane-explosion', school: 'arcane', category: 'cooldown', tags: ['cooldown', 'burst'], learn: 40, target: 'self', gcd: 0,
    desc: 'For 15 s your spells deal 30 % more damage and cost 30 % more mana.',
    forever: OFF('31-point Arcane capstone; now requires Presence of Mind. Cooldown not stated — Classic 3 min used.'),
    cooldown: 180, effects: [{ type: 'aura', to: 'self', aura: { id: 'mage.apower', name: 'Arcane Power', icon: 'arcane-explosion', school: 'arcane', duration: 15, mods: { dmgDone: { all: 1.3 }, costMult: { all: 1.3 } } } }],
  },
  'mage.blink': {
    name: 'Blink', icon: 'blink', school: 'arcane', category: 'movement', tags: ['mobility', 'defensive'], learn: 20, target: 'self', fx: 'none',
    desc: 'Teleport 20 yards forward (the way you are moving or facing) and break free of stuns and roots.',
    forever: BETA('Unchanged; tooltip reworded.'),
    cooldown: 15, cost: { mana: 'mana' }, usableWhileCC: true, breaksStun: true,
    effects: [{ type: 'custom', fn: ({ state, u, api }) => breakCC(state, api, u, ['stun', 'root']) }, { type: 'teleport', mode: 'blink', distance: 20 }],
    byLevel: { 30: { mana: 236 }, 60: { mana: 446 } },
  },
  'mage.counterspell': {
    name: 'Counterspell', icon: 'counterspell', school: 'arcane', category: 'interrupt', tags: ['interrupt', 'control'], learn: 24, gcd: 0,
    desc: 'Interrupts the target’s spell and locks that school for 10 s. High threat.',
    forever: BETA('Unchanged; Improved Counterspell (Arcane) now always silences 2/4 s.'),
    range: 30, cooldown: 30, cost: { mana: 'mana' },
    effects: [
      { type: 'interrupt', lockout: 10 },
      { type: 'threat', mode: 'add', value: 'thr' },
      { type: 'custom', fn: ({ state, u, t, api }) => { const s = T(u).impCounterspell; if (s && t && t.alive) api.applyAura(state, u, t, { id: 'mage.ics', name: 'Silenced', icon: 'counterspell', school: 'arcane', debuff: true, duration: s, cc: 'silence', dr: 'silence' }); } },
    ],
    byLevel: { 30: { mana: 100, thr: 150 }, 60: { mana: 100, thr: 300 } },
  },
  'mage.manashield': {
    name: 'Mana Shield', icon: 'mana-shield', school: 'arcane', category: 'defensive', tags: ['defensive'], learn: 20, target: 'self',
    desc: 'Absorbs physical damage for 1 min, draining 2 mana per point absorbed. Shields stop pushback.',
    forever: BETA('Unchanged; Arcane Shielding reduces the drain.'),
    cost: { mana: 'mana' },
    effects: [{ type: 'aura', to: 'self', aura: { id: 'mage.manashield', name: 'Mana Shield', icon: 'mana-shield', school: 'arcane', duration: 60, absorb: 'absorb', absorbSchools: ['physical'], absorbDrain: { resource: 'mana', per: 2 } } }],
    byLevel: { 30: { absorb: 210, mana: 60 }, 60: { absorb: 570, mana: 140 } },
  },
  'mage.evocation': {
    name: 'Evocation', icon: 'evocation', school: 'arcane', category: 'resource', tags: ['resource'], learn: 20, target: 'self',
    desc: 'Channel for 8 s: mana regeneration is active and 16× faster. Restores most of your mana pool. Long cooldown.',
    forever: IV('iv-frost', 'Icy Veins: use it regularly in dungeons and raids. 8 min cooldown (datamine).'),
    cooldown: 480,
    channel: { duration: 8, ticks: 8, effects: [] },
    onChannelStart: ({ state, u, api }) => api.applyAura(state, u, u, { id: 'mage.evo', name: 'Evocation', icon: 'evocation', school: 'arcane', duration: 8.5, mods: { manaRegen: 16, castRegen: 1 } }),
    onChannelEnd: ({ state, u, api }) => api.removeAuraById(state, u, 'mage.evo'),
  },
  'mage.decurse': {
    name: 'Remove Lesser Curse', icon: 'dispel', school: 'arcane', category: 'dispel', tags: ['dispel', 'optional-utility'], learn: 18, target: 'ally',
    desc: 'Removes one Curse (or Bane) from a friendly target. Target an ally first (F1–F5), or it hits you.',
    forever: BETA('Now also removes Banes (a new Forever debuff type).'),
    range: 30, cost: { mana: 'mana' },
    effects: [{ type: 'dispel', types: ['curse', 'bane'], count: 1, which: 'debuff' }],
    byLevel: { 30: { mana: 67 }, 60: { mana: 127 } },
  },
  'mage.gem': {
    name: 'Mana Gem', icon: 'mana-gem', school: 'arcane', mechanic: 'physical', category: 'consumable', tags: ['resource-consumable'], target: 'self', gcd: 0,
    desc: 'Use a conjured mana gem: restores mana instantly. 2 min cooldown, 3 gems per trial.',
    forever: BETA('Agate (28) to Ruby (58); unchanged. Wowhead: Agate is undertuned for Forever’s spell costs.'),
    cooldown: 120,
    canUse: ({ u }) => ((u.meta.gems ?? 3) > 0 ? true : 'custom:No mana gems left'),
    effects: [{ type: 'resource', resource: 'mana', amount: 'mana', to: 'self' }, { type: 'custom', fn: ({ u }) => { u.meta.gems = (u.meta.gems ?? 3) - 1; } }],
    byLevel: { 30: { mana: [375, 425] }, 60: { mana: [1000, 1200] } },
  },
});

// ---------------------------------------------------------------- talents per spec

const TALENTS = {
  frost30: { impFrostbolt: 0.5, iceShards: true, frostbite: 0.15, shatter: 0.5, fof: 0.15, fofCharges: 1 },
  fire30: { impFireball: 0.5, incineration: 0.06, ignite: 0.4, heatingUp: true, impScorch: true },
  arcane30: { missileBarrage: true, impChanneling: true, arcaneConcentration: 0.1, arcaneImpact: 0.06, arcaneMeditation: 0.5 },
  frost60: { impFrostbolt: 0.5, iceShards: true, frostbite: 0.15, shatter: 0.5, fof: 0.15, fofCharges: 2, wintersChill: true, frostChanneling: 0.85, elementalPrecision: 0.06, impCone: 1.35, missileBarrage: true, arcaneConcentration: 0.1 },
  fire60: { impFireball: 0.5, incineration: 0.06, ignite: 0.4, heatingUp: true, impScorch: true, criticalMass: 0.1, masterOfElements: 0.3, impact: 0.1, burningSoul: true, firePower: true, impFireBlast: true, elementalPrecision: 0.06 },
  arcane60: { missileBarrage: true, impChanneling: true, arcaneConcentration: 0.1, arcaneImpact: 0.06, arcaneMeditation: 0.5, arcaneMind: true, arcaneInstability: true, impCounterspell: 4, incineration: 0.06, arcaneFocus: 0.05 },
  frostfire60: { impFireball: 0.5, incineration: 0.06, ignite: 0.4, heatingUp: true, criticalMass: 0.1, masterOfElements: 0.3, iceShards: true, frostbite: 0.15, shatter: 0.5, elementalPrecision: 0.06 },
};

const P = (name, desc, forever) => ({ name, desc, forever });
const PASSIVES = {
  frost30: [
    P('Improved Frostbolt', 'Frostbolt and Frost Blast cast 0.5 s faster.', BETA()),
    P('Ice Shards', 'Frost crits deal double damage instead of +50 %.', BETA('Unchanged; also applies to Frostfire Bolt.')),
    P('Frostbite', '15 % chance on any chill to freeze the target for 5 s.', BETA('Low-rank spells proc less (official).')),
    P('Shatter', '+50 % crit chance against Frozen targets.', OFF('3 ranks; no longer requires Improved Frost Nova.')),
    P('Fingers of Frost (1/2)', '15 % chance on chill: your next spell treats the target as Frozen. At level 30 you have one point for it.', OFF('New row-5 talent; at 21 points you choose between it and Cold Snap.')),
  ],
  fire30: [
    P('Improved Fireball', 'Fireball (and later Frostfire Bolt) casts 0.5 s faster.', OFF()),
    P('Ignite', 'Fire crits burn for 40 % more over 4 s; a new crit rolls the remainder in.', OFF('Now one Ignite per Mage.')),
    P('Heating Up', 'Crits from Fireball, Fire Blast and Scorch (Fire Blast always) cut your next Pyroblast by 25 % per stack (3 stacks: 1.5 s).', OFF('Renamed from Hot Streak on Oct 1.')),
    P('Improved Scorch', 'Scorch stacks Fire Vulnerability: +3 % Fire damage per stack, 5 stacks.', OFF('Now only benefits the casting Mage.')),
    P('Incineration', '+6 % crit on Fire Blast, Scorch, Ice Lance and Arcane Blast.', OFF()),
  ],
  arcane30: [
    P('Missile Barrage', 'Arcane Blast (40 %) and Fireball / Frostbolt / Arcane Wrath (20 %) can make your next Arcane Missiles free and twice as fast.', OFF('Row-1 talent since Oct 15.', 'bz-devnotes')),
    P('Arcane Concentration', '10 % chance after a damage spell: the next one costs no mana (Clearcasting).', OFF()),
    P('Improved Channeling', 'Arcane Missiles is never pushed back; Arcane Blast and Arcane Wrath resist pushback 70 %.', OFF()),
    P('Arcane Meditation', '50 % of mana regeneration continues while casting.', OFF('Now requires 5/5 Arcane Concentration.')),
  ],
};
PASSIVES.frost60 = [
  ...PASSIVES.frost30.slice(0, 4),
  P('Fingers of Frost (2/2)', 'Chills can grant 2 charges that make your spells treat the target as Frozen.', OFF()),
  P("Winter's Chill", 'Frostbolt and Frost Blast stack Winter’s Chill (5 max); Cone of Cold spends it for +5 % damage and +7 % of your spell power per stack.', OFF('Oct 15 redesign; dev notes give two different numbers — the datamined one is used.', 'bz-devnotes')),
  P('Frost Channeling', 'Frost spells cost 15 % less.', OFF()),
  P('Arcane splash (11 points)', 'Missile Barrage, Clearcasting and Arcane Blast from the Arcane tree.', { status: 'speculative', src: 'wowtbc-frost', note: 'Level-60 Frost build follows the only published (speculative) priority.' }),
];
PASSIVES.fire60 = [
  ...PASSIVES.fire30,
  P('Critical Mass', '+10 % crit chance with Fire spells.', OFF()),
  P('Master of Elements', 'Fire and Frost crits refund 30 % of the spell’s base mana cost.', BETA()),
  P('Fire Power', '+10 % Fire damage.', BETA('The live datamine shows a flat 10 %; the Oct 15 dev notes described +3 % per Fire effect (up to 12 %).')),
  P('Impact', '10 % chance for Fire spells to stun for 2 s.', OFF('Lower chance from low-rank spells.')),
  P('Burning Soul', 'Fire spells resist pushback 70 %.', OFF()),
];
PASSIVES.arcane60 = [
  ...PASSIVES.arcane30,
  P('Arcane Mind', 'Arcane crits deal double damage.', OFF('Redesigned: +Intellect and Arcane crit damage.')),
  P('Arcane Instability', '+3 % spell damage and crit chance.', OFF()),
  P('Improved Counterspell', 'Counterspell also silences for 4 s.', OFF()),
];
PASSIVES.frostfire60 = [
  P('Frostfire Bolt', 'Counts as Fire and Frost, so Ignite, Ice Shards, Shatter and Heating Up all apply; its slow is a chill that can trigger Frostbite.', OFF('Blizzard’s own example: Ignite + Ice Shards = 280 % crit.')),
  P('Fire tree (31)', 'Improved Fireball, Ignite, Heating Up, Critical Mass, Master of Elements, Combustion.', { status: 'approximation', note: 'Our guess at a hybrid build; no guide has a tested Frostfire build yet.' }),
  P('Frost tree (20)', 'Ice Shards, Frostbite, Ice Lance, Shatter, Ice Block.', { status: 'approximation', note: 'Our guess at a hybrid build.' }),
];

// ---------------------------------------------------------------- build

const BARS = {
  10: ['mage.frostbolt', 'mage.fireball', 'mage.fireblast', 'mage.missiles', 'mage.nova', 'mage.poly', 'mage.wand'],
  frost30: ['mage.frostbolt', 'mage.icelance', 'mage.frostblast', 'mage.fireblast', 'mage.cone', 'mage.nova', 'mage.blizzard', 'mage.ae', 'mage.blink', 'mage.iceblock', 'mage.poly', 'mage.counterspell', 'mage.manashield', 'mage.evocation', 'mage.decurse', 'mage.wand'],
  fire30: ['mage.fireball', 'mage.scorch', 'mage.fireblast', 'mage.pyro', 'mage.blastwave', 'mage.flamestrike', 'mage.ae', 'mage.nova', 'mage.cone', 'mage.blink', 'mage.poly', 'mage.counterspell', 'mage.manashield', 'mage.evocation', 'mage.decurse', 'mage.wand'],
  arcane30: ['mage.ablast', 'mage.missiles', 'mage.awrath', 'mage.pom', 'mage.fireblast', 'mage.frostbolt', 'mage.ae', 'mage.nova', 'mage.cone', 'mage.blink', 'mage.poly', 'mage.counterspell', 'mage.manashield', 'mage.evocation', 'mage.decurse', 'mage.wand'],
  frost60: ['mage.frostbolt', 'mage.icelance', 'mage.ablast', 'mage.missiles', 'mage.cone', 'mage.nova', 'mage.blizzard', 'mage.ae', 'mage.fireblast', 'mage.blink', 'mage.iceblock', 'mage.coldsnap', 'mage.icebarrier', 'mage.poly', 'mage.counterspell', 'mage.evocation', 'mage.decurse', 'mage.wand'],
  fire60: ['mage.fireball', 'mage.scorch', 'mage.fireblast', 'mage.pyro', 'mage.combustion', 'mage.blastwave', 'mage.flamestrike', 'mage.ae', 'mage.nova', 'mage.cone', 'mage.blink', 'mage.poly', 'mage.counterspell', 'mage.manashield', 'mage.evocation', 'mage.decurse', 'mage.wand'],
  arcane60: ['mage.ablast', 'mage.missiles', 'mage.awrath', 'mage.pom', 'mage.apower', 'mage.fireblast', 'mage.frostbolt', 'mage.ae', 'mage.nova', 'mage.cone', 'mage.blink', 'mage.poly', 'mage.counterspell', 'mage.manashield', 'mage.evocation', 'mage.decurse', 'mage.wand'],
  frostfire60: ['mage.ffb', 'mage.fireblast', 'mage.pyro', 'mage.icelance', 'mage.combustion', 'mage.cone', 'mage.nova', 'mage.ae', 'mage.flamestrike', 'mage.blink', 'mage.iceblock', 'mage.poly', 'mage.counterspell', 'mage.manashield', 'mage.evocation', 'mage.decurse', 'mage.wand'],
};

const FILLER = { frost: 'mage.frostbolt', fire: 'mage.fireball', arcane: 'mage.missiles', frostfire: 'mage.ffb' };

const LOOP = {
  10: 'Frostbolt to slow, Fire Blast as an instant finisher, Frost Nova when something reaches you — then step back and keep casting. Wand when mana runs low; drinking between pulls is part of the job.',
  frost30: 'Frostbolt is the filler. When Frostbite freezes the target or Fingers of Frost lights up, Ice Lance hits three times as hard (and Shatter adds crit). Frost Nova, step back, Ice Lance.',
  fire30: 'Pyroblast to open, Scorch a few times for Fire Vulnerability, then Fireball. Fire Blast on cooldown always adds Heating Up; at 3 stacks Pyroblast is a 1.5 s cast — spend it.',
  arcane30: 'Arcane Blast 1–3 times (each makes the next more expensive and you stronger), Arcane Missiles whenever Missile Barrage procs, Arcane Wrath on cooldown. Watch the mana bar — that is the spec.',
  frost60: 'Frostbolt filler; Ice Lance on Fingers of Frost or frozen targets; Cone of Cold at 5 Winter’s Chill stacks; keep Ice Barrier up; Arcane Missiles on Missile Barrage. (The level-60 order is speculative.)',
  fire60: 'Fireball filler, Fire Blast on cooldown, Pyroblast at 3 Heating Up, keep Fire Vulnerability stacked with Scorch, Combustion for burst. Crit feeds everything: Ignite, Heating Up, mana refunds.',
  arcane60: 'Arcane Blast up to the stacks your mana allows, Missiles on Missile Barrage, Arcane Wrath on cooldown, Presence of Mind + Arcane Power for burst, Evocation before you run dry.',
  frostfire60: 'Frostfire Bolt filler (it chills, so Frostbite can freeze), Ice Lance into frozen targets, Fire Blast on cooldown, Pyroblast at 3 Heating Up. Fire and Frost talents stack on every bolt.',
};

const ARMOR = {
  10: { id: 'mage.armor', name: 'Frost Armor', icon: 'snowflake', school: 'frost', permanent: true, mods: { statAdd: { armor: 110 } } },
  30: { id: 'mage.armor', name: 'Ice Armor', icon: 'snowflake', school: 'frost', permanent: true, mods: { statAdd: { armor: 290 } } },
  60: { id: 'mage.armor', name: 'Mage Armor', icon: 'intellect', school: 'arcane', permanent: true, mods: { castRegen: 0.5, statAdd: { resist: 15 } } },
};


function snap(level) {
  return level >= 45 ? 60 : level >= 20 ? 30 : 10;
}

export const KIT = {
  id: 'mage',
  name: 'Mage',
  color: '#3FC7EB',
  resource: 'mana',
  race: 'Undead',
  portrait: 'undead-mage',
  tagline: 'Three schools, one question: which spell, right now?',
  fantasy: 'A scholar of destructive magic. Frost freezes and shatters, Fire builds toward crits and Heating Up Pyroblasts, Arcane spends and manages mana. Blink, Polymorph and Frost Nova make you the control class of the three — at the price of cloth armour and a drink between pulls.',
  strengthsSummary: 'Control (Nova, Polymorph, Counterspell, slows), strong AoE, conjured food and water, teleports and portals; Blizzard reworked each school to be more active moment-to-moment.',
  risksSummary: 'Mana and drinking set the leveling pace; Fire and Arcane felt weak or clunky at 30 in the beta; nobody has played a level-60 Mage yet.',
  specs: {
    30: [
      { id: 'frost', name: 'Frost', blurb: 'Freeze, Shatter, Ice Lance. The safe leveling and PvP spec.', forever: { status: 'confirmed-official', note: 'Talent tree from Blizzard’s deep dive and dev notes; our 21-point pick is an approximation.' } },
      { id: 'fire', name: 'Fire', blurb: 'Crits, Ignite and Heating Up Pyroblasts. Weak until crit gear, per guides.', forever: { status: 'confirmed-official', note: 'Talents official; 21-point pick approximated.' } },
      { id: 'arcane', name: 'Arcane', blurb: 'Arcane Blast stacks against your mana bar; Missile Barrage procs.', forever: { status: 'confirmed-official', note: 'Redesigned Oct 15, after most guides were written.' } },
    ],
    60: [
      { id: 'frost', name: 'Frost', blurb: 'Fingers of Frost, Winter’s Chill, Ice Barrier — plus an Arcane splash.', forever: { status: 'speculative', note: 'The only level-60 Frost priority is wowtbc.gg’s speculative list.' } },
      { id: 'fire', name: 'Fire', blurb: 'Critical Mass, Combustion, Master of Elements.', forever: { status: 'reported-guide', note: 'No level-60 Fire rotation exists; built from the level-30 loop plus capstones.' } },
      { id: 'arcane', name: 'Arcane', blurb: 'Arcane Power, Arcane Mind, Arcane Wrath scaling with your mana pool.', forever: { status: 'reported-guide', note: 'Untested at 60.' } },
      { id: 'frostfire', name: 'Frostfire', blurb: 'Hybrid: Frostfire Bolt with Fire and Frost talents stacked.', forever: { status: 'approximation', note: 'Frostfire Bolt is official (level 40); the hybrid build is our approximation.' } },
    ],
  },
  rolesFor: () => ['dps'],
  build({ level, spec, trialId, groupBuffs = [] }) {
    const L = snap(level);
    const sp = L === 10 ? null : spec && TALENTS[spec + L] ? spec : 'frost';
    const key = L === 10 ? 10 : sp + L;
    const tal = L === 10 ? {} : TALENTS[key];
    // Undead Mage: Classic base stats + gear profile + Arcane Intellect (and any group buffs);
    // Arcane Mind is +10 % Intellect.
    const S = deriveStats({ classId: 'mage', race: 'undead', level: L, gear: GEAR.mage[L], buffs: buffTotals(['arcaneIntellect', ...groupBuffs], L), pct: { int: tal.arcaneMind ? 0.1 : 0 } });
    const [wMin, wMax, wSpeed] = WEAPONS.wand[L];
    const tweaks = {};
    if (tal.impFrostbolt) tweaks['mage.frostbolt'] = { ct: (L === 10 ? 1.8 : 3.0) - tal.impFrostbolt };
    if (tal.impFrostbolt) tweaks['mage.frostblast'] = { castTime: 1.5 - tal.impFrostbolt };
    if (tal.impFireball) {
      tweaks['mage.fireball'] = { ct: 3.5 - tal.impFireball };
      if (L === 60) tweaks['mage.ffb'] = { ct: 3.0 - tal.impFireball };
    }
    if (tal.impFireBlast) tweaks['mage.fireblast'] = { cd: 6.5 };
    if (tal.impChanneling) tweaks['mage.missiles'] = { noPushback: true };
    if (tal.frostChanneling) for (const id of ['mage.frostbolt', 'mage.icelance', 'mage.cone', 'mage.blizzard', 'mage.nova', 'mage.frostblast']) tweaks[id] = { ...(tweaks[id] || {}), costMultFn: () => tal.frostChanneling };
    const auras = [{ ...ARMOR[L] }];
    if (tal.impChanneling) auras.push({ id: 'mage.t.channel', name: 'Improved Channeling', hidden: true, permanent: true, mods: { pushbackResist: { arcane: 0.7 } } });
    if (tal.burningSoul) auras.push({ id: 'mage.t.burning', name: 'Burning Soul', hidden: true, permanent: true, mods: { pushbackResist: { fire: 0.7 }, threat: 0.85 } });
    if (tal.arcaneMeditation) auras.push({ id: 'mage.t.meditation', name: 'Arcane Meditation', hidden: true, permanent: true, mods: { castRegen: tal.arcaneMeditation } });
    if (tal.elementalPrecision) auras.push({ id: 'mage.t.precision', name: 'Elemental Precision', hidden: true, permanent: true, mods: { spellHit: { fire: tal.elementalPrecision, frost: tal.elementalPrecision } } });
    if (tal.arcaneFocus) auras.push({ id: 'mage.t.focus', name: 'Arcane Focus', hidden: true, permanent: true, mods: { spellHit: { arcane: tal.arcaneFocus } } });
    const bar = BARS[key];
    const prevKey = L === 60 ? (sp === 'frostfire' ? 'fire30' : sp + '30') : L === 30 ? 10 : null;
    const prev = prevKey ? BARS[prevKey] : null;
    const consumables = ['item.rest', 'item.healpot', 'item.manapot', ...(L >= 30 ? ['mage.gem'] : []), ...RACIALS.undead];
    return {
      template: {
        name: 'You',
        portrait: 'undead-mage',
        maxHp: S.maxHp,
        resources: { mana: S.mana },
        stats: { ...S.stats },
        regen: { ...S.regen },
        armor: S.armor,
        tags: ['undead', 'humanoid'],
        ranged: { kind: 'wand', min: wMin, max: wMax, speed: wSpeed, range: 30, windup: 0.5, school: 'arcane', visual: 'arcane' },
        abilities: [...bar],
        auras,
        meta: { talents: tal, frostArmor: L <= 30, spec: sp },
        hooks: { afterDamage, onCast, afterDamageTaken },
      },
      bar,
      pet: null,
      consumables,
      tweaks,
      passives: L === 10 ? [] : PASSIVES[key],
      newSince: prev ? { from: L === 60 ? 30 : 10, ids: bar.filter((id) => !prev.includes(id)) } : null,
      loopHint: LOOP[key],
      filler: L === 10 ? 'mage.frostbolt' : FILLER[sp],
    };
  },
};

export { NOTE_NUMBERS };
