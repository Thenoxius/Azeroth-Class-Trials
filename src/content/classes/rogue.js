// Rogue kit — WoW: Forever. Played by NPC damage dealers for now (Combat swords at 30 and 60);
// becomes a playable kit later. Energy regenerates 10 per second, combo points sit on the
// target, white swings dual-wield (one combined weapon with the dual-wield miss penalty, like
// the Survival Hunter). Spell ranks: Wowhead datamine, live build 1.60.1.70630 (2026-10-27).
import { registerAbilities } from '../../engine/registry.js';
import { roll, val } from './shared.js';
import { deriveStats, buffTotals, GEAR, WEAPONS } from '../stats.js';
import { applyRace, validRace, racesFor } from '../races.js';

const DM = (note) => ({ status: 'beta-observation', src: 'wh-forever', note });
const CLASSIC = (note) => ({ status: 'classic-baseline', note });
const T = (u) => (u.meta && u.meta.talents) || {};

// Combo points live on the rogue but belong to one target (Classic: they are lost on a switch).
export const comboOn = (u, t) => (t && u.meta.cpTarget === t.id ? u.meta.cp || 0 : 0);
function addCombo(u, t, n = 1) {
  if (u.meta.cpTarget !== t.id) { u.meta.cpTarget = t.id; u.meta.cp = 0; }
  u.meta.cp = Math.min(5, (u.meta.cp || 0) + n);
}
function spendCombo(state, api, u) {
  const cp = u.meta.cp || 0;
  const tal = T(u);
  u.meta.cp = 0;
  if (tal.relentless && u.res.energy && state.rng() < 0.2 * cp) u.res.energy.cur = Math.min(u.res.energy.max, u.res.energy.cur + 25);
  if (tal.ruthlessness && state.rng() < 0.6) u.meta.cp = 1;
  return cp;
}
const needCombo = ({ u, t }) => (comboOn(u, t) > 0 ? true : 'custom:No combo points on this target');

function mainHand(state, api, u) {
  const m = u.melee.mh || u.melee;
  return m.min + (m.max - m.min) * state.rng() + (m.speed / 14) * api.statOf(u, 'ap');
}

// Stealth (Forever tooltip): sneak at −30 % speed until cancelled; 10 s cooldown. Any action
// other than a stealth-keeping one (Sap) ends it, and so do dealing or taking damage.
export const STEALTH = { id: 'rogue.stealth', name: 'Stealth', icon: 'fade', school: 'physical', stealth: true, permanent: true, cancelOnAction: true, breakOnDamage: true, mods: { slow: 0.3 } };

// ---------------------------------------------------------------- poisons
// Forever tooltips (rank at the snapshot level): proc chance per landed strike, effect.
// Charges are not modelled (a trial never runs a coating dry).
export const POISONS = {
  instant: { name: 'Instant Poison', learn: 20, chance: 0.2, byLevel: { 30: { dmg: [20, 26] }, 60: { dmg: [76, 100] } } },
  deadly: { name: 'Deadly Poison', learn: 30, chance: 0.3, byLevel: { 30: { dot: 24 }, 60: { dot: 92 } } },
  crippling: { name: 'Crippling Poison', learn: 20, chance: 0.3, byLevel: { 30: { slow: 0.5 }, 60: { slow: 0.7 } } },
  mindnumbing: { name: 'Mind-numbing Poison', learn: 24, chance: 0.2, byLevel: { 30: { castSlow: 0.4, dur: 10 }, 60: { castSlow: 0.6, dur: 14 } } },
};
const rankOf = (p, level) => p.byLevel[level >= 60 ? 60 : 30];

// onWeaponHit hook: each hand's poison may proc on a landed strike.
export function poisonOnHit({ state, u, dst, hand, api }) {
  const id = (u.meta.poisons || {})[hand];
  const p = id && POISONS[id];
  if (!p || u.level < p.learn || !api.hostile(u, dst) || state.rng() >= p.chance) return;
  const r = rankOf(p, u.level);
  if (id === 'instant') api.dealDamage(state, u, dst, { amount: r.dmg[0] + (r.dmg[1] - r.dmg[0]) * state.rng(), school: 'nature', kind: 'spell', ability: 'rogue.poison.instant' });
  else if (id === 'deadly') api.applyAura(state, u, dst, { id: 'rogue.poison.deadly', name: 'Deadly Poison', icon: 'serpent', school: 'nature', debuff: true, duration: 12, maxStacks: 5, refresh: true, dispel: 'poison', stackMods: true, tick: { interval: 3, type: 'damage', school: 'nature', amount: r.dot / 4, perStack: true } });
  else if (id === 'crippling') api.applyAura(state, u, dst, { id: 'rogue.poison.crippling', name: 'Crippling Poison', icon: 'concussive', school: 'nature', debuff: true, duration: 12, dispel: 'poison', mods: { slow: r.slow } });
  else if (id === 'mindnumbing') api.applyAura(state, u, dst, { id: 'rogue.poison.mindnumbing', name: 'Mind-numbing Poison', icon: 'silence', school: 'nature', debuff: true, duration: r.dur, dispel: 'poison', mods: { castSlow: r.castSlow } });
}

registerAbilities({
  'rogue.stealth': {
    name: 'Stealth', icon: 'fade', school: 'physical', mechanic: 'physical', category: 'utility', tags: ['stealth'],
    target: 'self', gcd: 0, cooldown: 10, outOfCombat: true, learn: 1, keepsAura: 'rogue.stealth',
    desc: 'Sneak around at 30 % less speed until you act, deal damage or take damage. Openers (Ambush, Cheap Shot, Garrote) need it. 10 s cooldown.',
    forever: DM('Forever Stealth tooltip: 10 s cooldown.'),
    canUse: ({ u }) => (u.flags.stealthed ? 'custom:Already stealthed' : true),
    effects: [{ type: 'aura', to: 'self', aura: STEALTH }],
  },
  'rogue.ss': {
    name: 'Sinister Strike', icon: 'sword', school: 'physical', mechanic: 'physical', category: 'filler', tags: ['core', 'filler'], range: 5,
    desc: 'Main-hand weapon damage plus a bonus. Awards a combo point.',
    forever: DM('Datamine: +22 at 30, +68 at 60, 45 energy.'),
    cost: { energy: 'energy' },
    effects: [{
      type: 'custom',
      fn: ({ state, u, t, ab, api }) => {
        if (!t || !t.alive) return;
        const tal = T(u);
        const d = api.dealDamage(state, u, t, { amount: (mainHand(state, api, u) + roll(state, val(ab, 'dmg'))) * (tal.aggression || 1), school: 'physical', kind: 'melee', ability: ab.id, critMult: 2 * (1 + (tal.lethality || 0) / 2) });
        if (d > 0) addCombo(u, t, 1);
      },
    }],
    byLevel: { 10: { energy: 45, dmg: [6, 6] }, 30: { energy: 45, dmg: [22, 22] }, 60: { energy: 45, dmg: [68, 68] } },
  },
  'rogue.evis': {
    name: 'Eviscerate', icon: 'claw', school: 'physical', mechanic: 'physical', category: 'damage', tags: ['core', 'finisher'], range: 5,
    desc: 'Finishing move: damage per combo point, increased by attack power.',
    forever: DM('Datamine: 165–185 (30) and 904–1012 (60) at 5 points. Attack power part is Classic’s (3 % per point).'),
    cost: { energy: 'energy' }, canUse: needCombo,
    effects: [{
      type: 'custom',
      fn: ({ state, u, t, ab, api }) => {
        if (!t || !t.alive) return;
        const tal = T(u);
        const cp = comboOn(u, t);
        const range = val(ab, 'pts')[cp - 1];
        const amount = (roll(state, range) + 0.03 * cp * api.statOf(u, 'ap')) * (tal.impEvis || 1) * (tal.aggression || 1);
        spendCombo(state, api, u);
        api.dealDamage(state, u, t, { amount, school: 'physical', kind: 'melee', ability: ab.id });
      },
    }],
    byLevel: {
      10: { energy: 35, pts: [[14, 22], [25, 33], [36, 44], [47, 55], [58, 66]] },
      30: { energy: 35, pts: [[41, 61], [72, 92], [103, 123], [134, 154], [165, 185]] },
      60: { energy: 35, pts: [[224, 332], [394, 502], [564, 672], [734, 842], [904, 1012]] },
    },
  },
  'rogue.snd': {
    name: 'Slice and Dice', icon: 'dash', school: 'physical', mechanic: 'physical', category: 'buff', tags: ['core', 'finisher'], range: 5,
    desc: 'Finishing move: faster melee attacks; lasts longer per combo point.',
    forever: DM('Datamine: +20 % attack speed (rank 1), +30 % from rank 2 at 42; 9–21 s.'),
    cost: { energy: 'energy' }, canUse: needCombo,
    effects: [{
      type: 'custom',
      fn: ({ state, u, t, ab, api }) => {
        const cp = spendCombo(state, api, u);
        api.applyAura(state, u, u, { id: 'rogue.snd', name: 'Slice and Dice', icon: 'dash', duration: (6 + 3 * cp) * (1 + (T(u).impSnd || 0)), mods: { meleeHaste: val(ab, 'haste') } });
      },
    }],
    byLevel: { 10: { energy: 25, haste: 0.2 }, 30: { energy: 25, haste: 0.2 }, 60: { energy: 25, haste: 0.3 } },
  },
  'rogue.kick': {
    name: 'Kick', icon: 'raptor-strike', school: 'physical', mechanic: 'physical', category: 'interrupt', tags: ['interrupt'], range: 5, gcd: 0,
    desc: 'Interrupts spellcasting and locks that school for 5 s.',
    forever: DM('Datamine: 30 damage (30) / 80 (60), 10 s cooldown, 5 s lockout.'),
    cooldown: 10, cost: { energy: 'energy' },
    effects: [{ type: 'damage', amount: 'dmg', kind: 'melee' }, { type: 'interrupt', lockout: 5 }],
    byLevel: { 30: { energy: 25, dmg: [30, 30] }, 60: { energy: 25, dmg: [80, 80] } },
  },
  'rogue.bladeflurry': {
    name: 'Blade Flurry', icon: 'axe', school: 'physical', mechanic: 'physical', category: 'cooldown', tags: ['cooldown'], target: 'self', gcd: 0,
    desc: '+20 % attack speed and your swings also hit a second nearby enemy, 15 s.',
    forever: DM('Combat talent; Classic 2 min cooldown used.'),
    cooldown: 120, cost: { energy: 'energy' },
    effects: [{ type: 'aura', to: 'self', aura: { id: 'rogue.bf', name: 'Blade Flurry', icon: 'axe', duration: 15, mods: { meleeHaste: 0.2 } } }],
    byLevel: { 30: { energy: 25 }, 60: { energy: 25 } },
  },
  'rogue.ar': {
    name: 'Adrenaline Rush', icon: 'beast-wrath', school: 'physical', mechanic: 'physical', category: 'cooldown', tags: ['cooldown'], target: 'self', gcd: 0,
    desc: 'Energy regenerates twice as fast for 15 s.',
    forever: CLASSIC('Combat capstone; Classic 5 min cooldown used.'),
    cooldown: 300,
    effects: [{ type: 'aura', to: 'self', aura: { id: 'rogue.ar', name: 'Adrenaline Rush', icon: 'beast-wrath', duration: 15, mods: { energyRegen: 2 } } }],
  },
  'rogue.evasion': {
    name: 'Evasion', icon: 'dash', school: 'physical', mechanic: 'physical', category: 'defensive', tags: ['defensive'], target: 'self', gcd: 0,
    desc: '+50 % dodge chance for 15 s.',
    forever: DM('Datamine: unchanged; 5 min cooldown (Endurance −60 %).'),
    cooldown: 120,
    effects: [{ type: 'aura', to: 'self', aura: { id: 'rogue.evasion', name: 'Evasion', icon: 'dash', duration: 15, mods: { dodge: 0.5 } } }],
  },
  'rogue.feint': {
    name: 'Feint', icon: 'feign', school: 'physical', mechanic: 'physical', category: 'defensive', tags: ['threat'], range: 5,
    desc: 'Lowers your threat on the target.',
    forever: DM('Datamine: “medium” (30) / “large” (60) threat drop; Classic amounts (−250 / −800) used.'),
    cooldown: 10, cost: { energy: 'energy' },
    effects: [{ type: 'custom', fn: ({ u, t, ab }) => { if (t && t.threat && t.threat[u.id] !== undefined) t.threat[u.id] = Math.max(0, t.threat[u.id] - val(ab, 'thr')); } }],
    byLevel: { 30: { energy: 20, thr: 250 }, 60: { energy: 20, thr: 800 } },
  },
});

// Blade Flurry: white swings and Sinister Strike also hit a second enemy next to the target.
function rogueAfterDamage({ state, u, api, pk, dst, final }) {
  if (final <= 0 || pk.flurry || !api.findAura(u, 'rogue.bf')) return;
  if (pk.ability !== 'melee' && pk.ability !== 'rogue.ss') return;
  const other = api.enemiesOf(state, u, (e) => e !== dst && e.engaged && Math.hypot(e.x - dst.x, e.y - dst.y) <= 5)[0];
  if (other) api.dealDamage(state, u, other, { amount: final, school: 'physical', kind: 'melee', ability: 'rogue.bf', noMiss: true, flurry: true });
}

// ---------------------------------------------------------------- playable Rogue (phase 4)
// Ranks: research/forever-warrior-rogue.json (Wowhead Forever spellbook, build 1.60.1).
const isDagger = (u) => !!(u.melee && u.melee.dagger);
const needDagger = ({ u }) => (isDagger(u) ? true : 'custom:Needs a dagger in the main hand');
function landed(api, state, u, t, amount, ab, extra = {}) {
  return api.dealDamage(state, u, t, { amount: amount * (T(u).aggression || 1), school: 'physical', kind: 'melee', ability: ab.id, critMult: 2 * (1 + (T(u).lethality || 0) / 2), ...extra });
}
// A combo-point builder landed: award points (Seal Fate: a crit adds one more).
function build(u, t, n, crit) {
  addCombo(u, t, n + (crit && T(u).sealFate ? 1 : 0));
}
function generator(ab, pts, dmgFn, extra) {
  return {
    type: 'custom',
    fn: (ctx) => {
      const { state, u, t, api } = ctx;
      if (!t || !t.alive) return;
      u.meta.lastCrit = false;
      const d = landed(api, state, u, t, dmgFn(ctx), ctx.ab, extra ? extra(ctx) : {});
      if (d > 0) build(u, t, pts, u.meta.lastCrit);
    },
  };
}
const stealthSlow = (u) => (u.level >= 60 ? 0.3 : u.level >= 20 ? 0.4 : 0.5);
const startsMelee = { startsMelee: true };

registerAbilities({
  'rogue.attack': {
    name: 'Attack', icon: 'sword', school: 'physical', mechanic: 'physical', category: 'damage', tags: ['core'], toggle: 'melee', gcd: 0, range: 5, learn: 1,
    desc: 'Toggle auto-attack with both weapons. Stealth stops it until you open.',
    forever: DM('Baseline.'),
  },
  'rogue.backstab': {
    name: 'Backstab', icon: 'claw', school: 'physical', mechanic: 'physical', category: 'filler', tags: ['core', 'filler'], range: 5, learn: 4, requiresBehind: true,
    ...startsMelee,
    desc: '150 % weapon damage plus a bonus from behind the target. Dagger in the main hand. 1 combo point.',
    forever: DM('Forever tooltip: +10 (10), +46 (28), +150 (60); bonus 33 % lower than Classic. 60 energy.'),
    cost: { energy: 'energy' }, canUse: needDagger,
    effects: [generator(null, 1, ({ state, u, api, ab }) => (1.5 * mainHand(state, api, u) + roll(state, val(ab, 'dmg'))) * (T(u).opportunity || 1), () => ({}))],
    byLevel: { 10: { energy: 60, dmg: [10, 10] }, 30: { energy: 60, dmg: [46, 46] }, 60: { energy: 60, dmg: [150, 150] } },
  },
  'rogue.gouge': {
    name: 'Gouge', icon: 'raptor-strike', school: 'physical', mechanic: 'physical', category: 'control', tags: ['control'], range: 5, cooldown: 10, learn: 6,
    desc: 'Small hit that incapacitates a target facing you for 4 s (damage breaks it) and stops your attack. 1 combo point.',
    forever: DM('Forever tooltip: 10 / 20 / 75 damage, 4 s, 10 s cooldown (new), 45 energy.'),
    cost: { energy: 'energy' },
    effects: [
      generator(null, 1, ({ state, ab }) => roll(state, val(ab, 'dmg'))),
      { type: 'custom', fn: ({ state, u, t, api }) => {
        if (!t || !t.alive) return;
        u.autoMelee = false;
        api.applyAura(state, u, t, { id: 'rogue.gouge', name: 'Gouge', icon: 'raptor-strike', debuff: true, duration: 4 + (T(u).impGouge || 0), cc: 'incap', breakOnDamage: true, dr: 'incap' });
      } },
    ],
    byLevel: { 10: { energy: 45, dmg: [10, 10] }, 30: { energy: 45, dmg: [20, 20] }, 60: { energy: 45, dmg: [75, 75] } },
  },
  'rogue.sap': {
    name: 'Sap', icon: 'raptor-strike', school: 'physical', mechanic: 'physical', category: 'control', tags: ['control', 'opener'], range: 5, learn: 10, requiresStealth: true, keepsAura: 'rogue.stealth',
    desc: 'From stealth: incapacitate a humanoid that is not in combat (25 / 35 / 45 s). Damage breaks it. Keeps you stealthed.',
    forever: DM('Forever tooltip: 25 s (10), 35 s (28), 45 s (48); 65 energy; does not break Stealth.'),
    cost: { energy: 'energy' },
    canUse: ({ t }) => (!t || !(t.tags || []).includes('humanoid') ? 'custom:Only humanoids' : t.engaged ? 'custom:Target is in combat' : true),
    effects: [{ type: 'custom', fn: ({ state, u, t, ab, api }) => {
      for (const o of state.list) for (const a of [...o.auras]) if (a.id === 'rogue.sap' && a.srcId === u.id) api.removeAura(state, o, a, 'removed');
      api.applyAura(state, u, t, { id: 'rogue.sap', name: 'Sap', icon: 'raptor-strike', debuff: true, duration: val(ab, 'dur'), cc: 'incap', breakOnDamage: true });
    } }],
    byLevel: { 10: { energy: 65, dur: 25 }, 30: { energy: 65, dur: 35 }, 60: { energy: 65, dur: 45 } },
  },
  'rogue.ambush': {
    name: 'Ambush', icon: 'claw', school: 'physical', mechanic: 'physical', category: 'damage', tags: ['opener'], range: 5, learn: 18, requiresStealth: true, requiresBehind: true,
    ...startsMelee,
    desc: 'From stealth and behind: 250 % weapon damage plus a big bonus. Dagger. 1 combo point.',
    forever: DM('Forever tooltip: +100 (26), +290 (58); 60 energy.'),
    cost: { energy: 'energy' }, canUse: needDagger,
    effects: [generator(null, 1, ({ state, u, api, ab }) => (2.5 * mainHand(state, api, u) + roll(state, val(ab, 'dmg'))) * (T(u).opportunity || 1), ({ u }) => ({ critBonus: T(u).impAmbush || 0 }))],
    byLevel: { 30: { energy: 60, dmg: [100, 100] }, 60: { energy: 60, dmg: [290, 290] } },
  },
  'rogue.cheapshot': {
    name: 'Cheap Shot', icon: 'raptor-strike', school: 'physical', mechanic: 'physical', category: 'control', tags: ['opener', 'control'], range: 5, learn: 26, requiresStealth: true,
    ...startsMelee,
    desc: 'From stealth: stun the target for 4 s. 2 combo points.',
    forever: DM('Forever tooltip: 4 s stun, 60 energy.'),
    cost: { energy: 'energy' },
    effects: [{ type: 'custom', fn: ({ state, u, t, api }) => {
      if (!t || !t.alive) return;
      api.applyAura(state, u, t, { id: 'rogue.cheapshot', name: 'Cheap Shot', icon: 'raptor-strike', debuff: true, duration: 4, cc: 'stun', dr: 'stun' });
      api.engage(state, t, u);
      build(u, t, 2, false);
    } }],
    byLevel: { 30: { energy: 60 }, 60: { energy: 60 } },
  },
  'rogue.garrote': {
    name: 'Garrote', icon: 'claw', school: 'physical', mechanic: 'physical', category: 'dot', tags: ['opener', 'bleed'], range: 5, learn: 14, requiresStealth: true, requiresBehind: true,
    ...startsMelee,
    desc: 'From stealth and behind: the target bleeds over 18 s, more with attack power. 1 combo point.',
    forever: DM('Forever tooltip: 282 (30), 552 (54) over 18 s; attack-power share is Classic’s (3 % per tick).'),
    cost: { energy: 'energy' },
    effects: [{ type: 'custom', fn: ({ state, u, t, ab, api }) => {
      if (!t || !t.alive) return;
      const per = (val(ab, 'total') + 0.18 * api.statOf(u, 'ap')) / 6;
      api.applyAura(state, u, t, { id: 'rogue.garrote', name: 'Garrote', icon: 'claw', debuff: true, duration: 18, bleed: true, tick: { interval: 3, amount: per, school: 'physical', kind: 'bleed' } });
      api.engage(state, t, u);
      build(u, t, 1, false);
    } }],
    byLevel: { 10: { energy: 50, total: 144 }, 30: { energy: 50, total: 282 }, 60: { energy: 50, total: 552 } },
  },
  'rogue.rupture': {
    name: 'Rupture', icon: 'claw', school: 'physical', mechanic: 'physical', category: 'dot', tags: ['finisher', 'bleed'], range: 5, learn: 20,
    desc: 'Finishing move: the target bleeds; longer and more per combo point, plus attack power.',
    forever: DM('Forever tooltip: 127 over 16 s (30) / 469 over 16 s (60) at 5 points; AP share is Classic’s.'),
    cost: { energy: 'energy' }, canUse: needCombo,
    effects: [{ type: 'custom', fn: ({ state, u, t, ab, api }) => {
      if (!t || !t.alive) return;
      const cp = comboOn(u, t);
      const total = val(ab, 'pts')[cp - 1] + 0.04 * cp * api.statOf(u, 'ap');
      const dur = 6 + 2 * cp;
      spendCombo(state, api, u);
      api.applyAura(state, u, t, { id: 'rogue.rupture', name: 'Rupture', icon: 'claw', debuff: true, duration: dur, bleed: true, tick: { interval: 2, amount: total / (dur / 2), school: 'physical', kind: 'bleed' } });
    } }],
    byLevel: { 30: { energy: 25, pts: [35, 53, 74, 99, 127] }, 60: { energy: 25, pts: [159, 222, 295, 377, 469] } },
  },
  'rogue.kidney': {
    name: 'Kidney Shot', icon: 'raptor-strike', school: 'physical', mechanic: 'physical', category: 'control', tags: ['finisher', 'control'], range: 5, cooldown: 20, learn: 30,
    desc: 'Finishing move: stun; longer per combo point.',
    forever: DM('Forever tooltip: 1–5 s (30), 2–6 s (50); 25 energy, 20 s cooldown.'),
    cost: { energy: 'energy' }, canUse: needCombo,
    effects: [{ type: 'custom', fn: ({ state, u, t, ab, api }) => {
      if (!t || !t.alive) return;
      const cp = comboOn(u, t);
      spendCombo(state, api, u);
      api.applyAura(state, u, t, { id: 'rogue.kidney', name: 'Kidney Shot', icon: 'raptor-strike', debuff: true, duration: cp + val(ab, 'base'), cc: 'stun', dr: 'stun' });
    } }],
    byLevel: { 30: { energy: 25, base: 0 }, 60: { energy: 25, base: 1 } },
  },
  'rogue.expose': {
    name: 'Expose Armor', icon: 'axe', school: 'physical', mechanic: 'physical', category: 'debuff', tags: ['finisher'], range: 5, learn: 14,
    desc: 'Finishing move: lowers the target’s armor for 30 s, more per combo point.',
    forever: DM('Forever tooltip: 180 per point (26), 450 per point (56).'),
    cost: { energy: 'energy' }, canUse: needCombo,
    effects: [{ type: 'custom', fn: ({ state, u, t, ab, api }) => {
      if (!t || !t.alive) return;
      const cp = comboOn(u, t);
      spendCombo(state, api, u);
      api.applyAura(state, u, t, { id: 'rogue.expose', name: 'Expose Armor', icon: 'axe', debuff: true, unique: 'target', duration: 30, mods: { statAdd: { armor: -cp * val(ab, 'per') } } });
    } }],
    byLevel: { 30: { energy: 25, per: 180 }, 60: { energy: 25, per: 450 } },
  },
  'rogue.vanish': {
    name: 'Vanish', icon: 'fade', school: 'physical', mechanic: 'physical', category: 'defensive', tags: ['defensive', 'stealth'], target: 'self', cooldown: 300, gcd: 0, learn: 22, keepsAura: 'rogue.stealth', usableWhileCC: false,
    desc: 'Vanish from sight in combat: enemies lose you, movement slows break, and you are stealthed again.',
    forever: DM('Forever tooltip: improved stealth for 10 s, breaks movement impairing effects; 5 min cooldown.'),
    effects: [{ type: 'custom', fn: ({ state, u, api }) => {
      for (const a of [...u.auras]) if (a.def.debuff && (a.def.mods && a.def.mods.slow || [].concat(a.def.cc || []).includes('root'))) api.removeAura(state, u, a, 'broken');
      api.dropThreat(state, u);
      for (const e of state.list) if (e.target === u.id) e.target = null;
      u.autoMelee = false;
      api.applyAura(state, u, u, { ...STEALTH, mods: { slow: stealthSlow(u) } });
    } }],
  },
  'rogue.sprint': {
    name: 'Sprint', icon: 'dash', school: 'physical', mechanic: 'physical', category: 'mobility', tags: ['mobility'], target: 'self', cooldown: 300, gcd: 0, learn: 10, keepsAura: 'rogue.stealth',
    desc: 'Movement speed +50 % (+70 % at 58) for 15 s. Does not break stealth.',
    forever: DM('Forever tooltip: 5 min cooldown.'),
    effects: [{ type: 'custom', fn: ({ state, u, api }) => api.applyAura(state, u, u, { id: 'rogue.sprint', name: 'Sprint', icon: 'dash', duration: 15, mods: { speed: u.level >= 58 ? 0.7 : 0.5 } }) }],
  },
  'rogue.blind': {
    name: 'Blind', icon: 'fade', school: 'physical', mechanic: 'physical', category: 'control', tags: ['control'], range: 10, cooldown: 300, learn: 34,
    desc: 'The target wanders disoriented for up to 10 s; any damage breaks it.',
    forever: DM('Forever tooltip: 30 energy, 5 min cooldown, 10 s.'),
    cost: { energy: 'energy' },
    effects: [{ type: 'aura', aura: { id: 'rogue.blind', name: 'Blind', icon: 'fade', debuff: true, duration: 10, cc: 'incap', breakOnDamage: true, dr: 'incap' } }],
    byLevel: { 60: { energy: 30 } },
  },
  'rogue.mutilate': {
    name: 'Mutilate', icon: 'claw', school: 'physical', mechanic: 'physical', category: 'filler', tags: ['core', 'filler'], range: 5, learn: 40,
    ...startsMelee,
    desc: 'Strike with both weapons for 75 % weapon damage plus 50 each; +20 % against poisoned targets. Daggers. 2 combo points.',
    forever: DM('Forever: trained at 40 (Classic had no Mutilate). 60 energy.'),
    cost: { energy: 'energy' }, canUse: needDagger,
    effects: [generator(null, 2, ({ state, u, t, api }) => {
      const oh = u.melee.oh || u.melee;
      const poisoned = t.auras.some((a) => a.def.dispel === 'poison' && a.srcId === u.id);
      const each = (m) => 0.75 * (m.min + (m.max - m.min) * state.rng() + (m.speed / 14) * api.statOf(u, 'ap')) + 50;
      return (each(u.melee) + each(oh)) * (poisoned ? 1.2 : 1);
    })],
    byLevel: { 60: { energy: 60 } },
  },
  'rogue.hemo': {
    name: 'Hemorrhage', icon: 'claw', school: 'physical', mechanic: 'physical', category: 'filler', tags: ['core', 'filler'], range: 5, learn: 46,
    ...startsMelee,
    desc: 'Weapon damage; the target takes more physical damage from every hit for 15 s. 1 combo point. No positional need.',
    forever: CLASSIC('Forever trains it at 46; the tooltip is empty in the datamine, so Classic’s weapon damage and +7 per hit are used.'),
    cost: { energy: 'energy' },
    effects: [
      generator(null, 1, ({ state, u, api }) => mainHand(state, api, u)),
      { type: 'custom', fn: ({ state, u, t, api }) => { if (t && t.alive) api.applyAura(state, u, t, { id: 'rogue.hemo', name: 'Hemorrhage', icon: 'claw', debuff: true, duration: 15, mods: { dmgTaken: { physical: 1.03 } } }); } },
    ],
    byLevel: { 60: { energy: 35 } },
  },
  'rogue.coldblood': {
    name: 'Cold Blood', icon: 'beast-wrath', school: 'physical', mechanic: 'physical', category: 'cooldown', tags: ['burst'], target: 'self', cooldown: 180, gcd: 0, learn: 30,
    desc: 'Assassination talent: your next offensive ability is a sure critical strike.',
    forever: CLASSIC('Assassination talent; Classic 3 min cooldown.'),
    effects: [{ type: 'aura', to: 'self', aura: { id: 'rogue.coldblood', name: 'Cold Blood', icon: 'beast-wrath', duration: 60, mods: { crit: { physical: 1 } } } }],
  },
});

// Stealth's speed penalty depends on the rank (−50 % / −40 % / −30 %): the player Rogue casts
// this version; the NPC keeps the shared STEALTH aura.
registerAbilities({
  'rogue.stealth.player': {
    name: 'Stealth', icon: 'fade', school: 'physical', mechanic: 'physical', category: 'utility', tags: ['stealth'],
    target: 'self', gcd: 0, cooldown: 10, outOfCombat: true, learn: 1, keepsAura: 'rogue.stealth',
    desc: 'Sneak around until you act, deal damage or take damage (−50 % speed at 1, −40 % at 20, −30 % at 60). Openers need it. 10 s cooldown.',
    forever: DM('Forever Stealth tooltip: 10 s cooldown; speed penalty by rank.'),
    canUse: ({ u }) => (u.flags.stealthed ? 'custom:Already stealthed' : true),
    effects: [{ type: 'custom', fn: ({ state, u, api }) => api.applyAura(state, u, u, { ...STEALTH, mods: { slow: stealthSlow(u) } }) }],
  },
});

// Cold Blood is used up by the next damaging strike.
function playerAfterDamage(x) {
  const { state, u, api, pk } = x;
  rogueAfterDamage(x);
  if (pk && !pk.isTick) u.meta.lastCrit = !!pk.crit;
  if (pk && !pk.isTick && pk.ability && pk.ability.startsWith('rogue.') && api.findAura(u, 'rogue.coldblood')) api.removeAuraById(state, u, 'rogue.coldblood');
}

// Talents (Forever trees, values as the engine uses them; points are our pick).
const PLAYER_TALENTS = {
  assassination30: { malice: 0.05, ruthlessness: true, relentless: true, impSnd: 0.15, lethality: 0.3, impPoisons: 0.1, murder: 1.02, coldBlood: true, impGouge: 1 },
  assassination60: { malice: 0.05, ruthlessness: true, relentless: true, impSnd: 0.45, lethality: 0.3, impPoisons: 0.1, murder: 1.02, coldBlood: true, sealFate: true, vigor: 10, vilePoisons: 1.2, opportunity: 1.1 },
  combat30: TALENTS_COMBAT30(),
  combat60: TALENTS_COMBAT60(),
  subtlety30: { opportunity: 1.2, impAmbush: 0.3, initiative: true, malice: 0.03, lethality: 0.1, impGouge: 1 },
  subtlety60: { opportunity: 1.2, impAmbush: 0.3, initiative: true, malice: 0.05, lethality: 0.3, serrated: true, deadliness: 1.05, relentless: true, ruthlessness: true },
};
function TALENTS_COMBAT30() { return { impSs: 5, precision: 0.05, dwSpec: 0.25, bladeFlurry: true, impEvis: 1.2, malice: 0.03, lightningReflexes: 0.05 }; }
function TALENTS_COMBAT60() { return { impSs: 5, precision: 0.05, dwSpec: 0.25, bladeFlurry: true, impEvis: 1.2, malice: 0.05, lightningReflexes: 0.05, aggression: 1.06, ar: true, weaponExpertise: 0.02, ruthlessness: true, relentless: true, impSnd: 0.45, lethality: 0.2, hackAndSlash: 0.05 }; }

const PLAYER_BARS = {
  10: ['rogue.attack', 'rogue.stealth.player', 'rogue.ss', 'rogue.backstab', 'rogue.evis', 'rogue.snd', 'rogue.gouge', 'rogue.sap', 'rogue.sprint', 'rogue.evasion'],
  assassination30: ['rogue.attack', 'rogue.stealth.player', 'rogue.cheapshot', 'rogue.garrote', 'rogue.ambush', 'rogue.backstab', 'rogue.ss', 'rogue.evis', 'rogue.snd', 'rogue.rupture', 'rogue.kidney', 'rogue.kick', 'rogue.gouge', 'rogue.coldblood', 'rogue.vanish', 'rogue.evasion', 'rogue.sprint', 'rogue.sap'],
  combat30: ['rogue.attack', 'rogue.stealth.player', 'rogue.cheapshot', 'rogue.ss', 'rogue.evis', 'rogue.snd', 'rogue.rupture', 'rogue.kidney', 'rogue.kick', 'rogue.gouge', 'rogue.bladeflurry', 'rogue.vanish', 'rogue.evasion', 'rogue.sprint', 'rogue.feint', 'rogue.sap'],
  subtlety30: ['rogue.attack', 'rogue.stealth.player', 'rogue.ambush', 'rogue.cheapshot', 'rogue.garrote', 'rogue.backstab', 'rogue.ss', 'rogue.evis', 'rogue.snd', 'rogue.rupture', 'rogue.kidney', 'rogue.kick', 'rogue.gouge', 'rogue.vanish', 'rogue.evasion', 'rogue.sprint', 'rogue.sap'],
  assassination60: ['rogue.attack', 'rogue.stealth.player', 'rogue.cheapshot', 'rogue.garrote', 'rogue.ambush', 'rogue.mutilate', 'rogue.evis', 'rogue.snd', 'rogue.rupture', 'rogue.kidney', 'rogue.expose', 'rogue.kick', 'rogue.coldblood', 'rogue.blind', 'rogue.vanish', 'rogue.evasion', 'rogue.sprint', 'rogue.feint'],
  combat60: ['rogue.attack', 'rogue.stealth.player', 'rogue.cheapshot', 'rogue.ss', 'rogue.evis', 'rogue.snd', 'rogue.rupture', 'rogue.kidney', 'rogue.expose', 'rogue.kick', 'rogue.bladeflurry', 'rogue.ar', 'rogue.blind', 'rogue.vanish', 'rogue.evasion', 'rogue.sprint', 'rogue.feint'],
  subtlety60: ['rogue.attack', 'rogue.stealth.player', 'rogue.ambush', 'rogue.cheapshot', 'rogue.garrote', 'rogue.hemo', 'rogue.backstab', 'rogue.evis', 'rogue.snd', 'rogue.rupture', 'rogue.kidney', 'rogue.kick', 'rogue.blind', 'rogue.vanish', 'rogue.evasion', 'rogue.sprint', 'rogue.feint'],
};
const LOOP = {
  10: 'Stealth up, Sinister Strike (or Backstab from behind) to 3–5 points, Eviscerate. Slice and Dice on longer fights. Gouge buys a breather.',
  assassination30: 'Open with Cheap Shot or Garrote, Backstab from behind (Sinister Strike from the front), Slice and Dice, then Eviscerate or Rupture at 5 points. Cold Blood on a big Eviscerate.',
  combat30: 'Cheap Shot, Sinister Strike, keep Slice and Dice up, Eviscerate at 5 points. Kick casters, Blade Flurry on two targets.',
  subtlety30: 'Ambush from stealth, Backstab, Slice and Dice, Eviscerate at 5. Gouge, step behind, Backstab again.',
  assassination60: 'Garrote or Cheap Shot, Mutilate to 4–5 points (Seal Fate), Slice and Dice, Rupture, Eviscerate. Keep Deadly Poison stacked.',
  combat60: 'Sinister Strike, Slice and Dice always, Eviscerate at 5; Blade Flurry + Adrenaline Rush together.',
  subtlety60: 'Ambush, Hemorrhage (or Backstab from behind), Slice and Dice, Eviscerate; Vanish → Ambush again in a long fight.',
};
const PASSIVE = (name, desc, forever) => ({ name, desc, forever });
const PASSIVES = {
  assassination: [PASSIVE('Assassination talents', 'Malice, Ruthlessness, Relentless Strikes, Improved Slice and Dice, Lethality, Improved Poisons, Murder, Cold Blood; at 60 Seal Fate, Vigor and Vile Poisons.', DM('Forever talent tree; point spread is our pick.'))],
  combat: [PASSIVE('Combat talents', 'Improved Sinister Strike, Precision, Dual Wield Specialization, Improved Eviscerate, Blade Flurry, Lightning Reflexes; at 60 Aggression, Adrenaline Rush, Weapon Expertise, Hack and Slash.', DM('Forever talent tree; point spread is our pick.'))],
  subtlety: [PASSIVE('Subtlety talents', 'Opportunity, Improved Ambush, Initiative; at 60 Serrated Blades, Deadliness and Hemorrhage.', DM('Forever talent tree; point spread is our pick.'))],
};
const playerSnap = (level) => (level >= 45 ? 60 : level >= 20 ? 30 : 10);

function playerBuild({ level, spec, race, groupBuffs = [] }) {
  const L = playerSnap(level);
  const sp = L === 10 ? null : ['assassination', 'combat', 'subtlety'].includes(spec) ? spec : 'combat';
  const key = L === 10 ? 10 : sp + L;
  const tal = L === 10 ? {} : PLAYER_TALENTS[key];
  const S = deriveStats({ classId: 'rogue', race, level: L, gear: GEAR.rogue[L], buffs: buffTotals(groupBuffs, L) });
  const stats = { ...S.stats, hit: S.stats.hit + (tal.precision || 0) + (tal.weaponExpertise || 0), critPhys: S.stats.critPhys + (tal.malice || 0), dodge: S.stats.dodge + (tal.lightningReflexes || 0), parry: 0.05 };
  const w = (k) => { const [min, max, speed] = WEAPONS[k][L]; return { min, max, speed, coef: speed / 14 }; };
  const daggers = sp !== 'combat';
  const mh = w(daggers ? 'dagger' : 'rogueSword');
  const melee = { ...mh, dagger: daggers, dualWield: true, oh: { ...w('dagger'), mult: 0.5 + (tal.dwSpec || 0) } };
  const auras = [];
  if (tal.hackAndSlash) auras.push({ id: 'rogue.t.hack', name: 'Hack and Slash', hidden: true, permanent: true, mods: { meleeHaste: tal.hackAndSlash } });
  if (tal.murder) auras.push({ id: 'rogue.t.murder', name: 'Murder', hidden: true, permanent: true, mods: { dmgDone: { all: tal.murder } } });
  if (tal.deadliness) auras.push({ id: 'rogue.t.deadliness', name: 'Deadliness', hidden: true, permanent: true, mods: { dmgDone: { physical: tal.deadliness } } });
  if (tal.impPoisons) auras.push({ id: 'rogue.t.poisons', name: 'Improved Poisons', hidden: true, permanent: true, mods: { dmgDone: { nature: 1 + tal.impPoisons } } });
  const bar = PLAYER_BARS[key];
  const tweaks = {};
  if (tal.impSs) tweaks['rogue.ss'] = { costMultFn: (u, ab) => (val(ab, ab.cost.energy) - tal.impSs) / val(ab, ab.cost.energy) };
  const prevKey = L === 60 ? sp + '30' : L === 30 ? 10 : null;
  const prev = prevKey ? PLAYER_BARS[prevKey] : null;
  return {
    template: {
      name: 'You',
      portrait: 'troll-rogue',
      maxHp: S.maxHp,
      resources: { energy: 100 + (tal.vigor || 0) },
      regen: { hpOOC: S.regen.hpOOC, energy: 10 },
      stats,
      armor: S.armor,
      tags: ['humanoid'],
      melee,
      abilities: [...bar],
      auras,
      // Poisons from 20: Instant on the main hand, Deadly (30+) or Crippling on the off hand.
      meta: { talents: tal, spec: sp, cp: 0, poisons: L >= 20 ? { mh: 'instant', oh: L >= 30 ? 'deadly' : 'crippling' } : {} },
      hooks: { afterDamage: playerAfterDamage, onWeaponHit: poisonOnHit },
    },
    bar,
    consumables: ['item.rest', 'item.healpot'],
    tweaks,
    passives: L === 10 ? [] : PASSIVES[sp],
    newSince: prev ? { from: L === 60 ? 30 : 10, ids: bar.filter((id) => !prev.includes(id)) } : null,
    loopHint: LOOP[key],
    filler: daggers && L >= 60 && sp === 'assassination' ? 'rogue.mutilate' : sp === 'subtlety' && L >= 60 ? 'rogue.hemo' : 'rogue.ss',
  };
}

// Combat swords with an Assassination splash (21 points at 30, 15/31/5 at 60).
const TALENTS = {
  combat30: { impSs: 5, precision: 0.05, dwSpec: 0.25, bladeFlurry: true, impEvis: 1.2, malice: 0.03, lightningReflexes: 0.05 },
  combat60: { impSs: 5, precision: 0.05, dwSpec: 0.25, bladeFlurry: true, impEvis: 1.2, malice: 0.05, lightningReflexes: 0.05, aggression: 1.06, ar: true, weaponExpertise: 0.02, ruthlessness: true, relentless: true, impSnd: 0.45, lethality: 0.2, hackAndSlash: 0.05 },
};

const snap = (level) => (level >= 45 ? 60 : 30);

export const KIT = {
  id: 'rogue',
  name: 'Rogue',
  color: '#FFF468',
  resource: 'energy',
  race: 'Troll',
  portrait: 'troll-rogue',
  tagline: 'Stealth, combo points and the first strike.',
  fantasy: 'A melee fighter who chooses when the fight starts. Open from stealth, build combo points with Sinister Strike, Backstab or Mutilate, and spend them on Eviscerate, Slice and Dice, Rupture or Kidney Shot. Poisons add damage and slows; Gouge, Blind and Vanish get you out.',
  strengthsSummary: 'Picks its fights (Stealth, Sap), strong control (Cheap Shot, Kidney Shot, Gouge, Blind), interrupts with Kick, Vanish and Sprint to escape, poisons on every weapon.',
  risksSummary: 'Melee only with leather armor, no self-heal, energy pacing matters, positional abilities need you behind the target.',
  specs: {
    30: [
      { id: 'assassination', name: 'Assassination', blurb: 'Daggers and poisons: openers, Backstab, Cold Blood.', forever: DM('Forever talent tree; 21-point pick is ours.') },
      { id: 'combat', name: 'Combat', blurb: 'Swords: Sinister Strike, Blade Flurry, Precision.', forever: DM('Forever talent tree; 21-point pick is ours.') },
      { id: 'subtlety', name: 'Subtlety', blurb: 'Ambush and Backstab from the shadows; Opportunity.', forever: DM('Forever talent tree; 21-point pick is ours.') },
    ],
    60: [
      { id: 'assassination', name: 'Assassination', blurb: 'Mutilate (trained at 40 in Forever), Seal Fate, Deadly Poison.', forever: DM('Mutilate is baseline at 40 in Forever; 51-point pick is ours.') },
      { id: 'combat', name: 'Combat', blurb: 'Sinister Strike, Blade Flurry, Adrenaline Rush.', forever: DM('Forever talent tree; 51-point pick is ours.') },
      { id: 'subtlety', name: 'Subtlety', blurb: 'Hemorrhage, Ambush, Serrated Blades.', forever: DM('Hemorrhage is trained at 46 in Forever; 51-point pick is ours.') },
    ],
  },
  rolesFor: () => ['dps'],
  races: () => racesFor('rogue'),
  build(opts) {
    if (opts.npc) return this.npcBuild(opts);
    const race = validRace('rogue', opts.race);
    return applyRace(playerBuild({ ...opts, race }), { classId: 'rogue', race });
  },
  npcBuild({ level, race = 'troll', groupBuffs = [] }) {
    const L = snap(level);
    const tal = TALENTS['combat' + L];
    const S = deriveStats({ classId: 'rogue', race, level: L, gear: GEAR.rogue[L], buffs: buffTotals(groupBuffs, L) });
    const stats = { ...S.stats, hit: S.stats.hit + tal.precision, critPhys: S.stats.critPhys + (tal.malice || 0), dodge: S.stats.dodge + tal.lightningReflexes, parry: 0.05 };
    const w = (k) => { const [min, max, speed] = WEAPONS[k][L]; return { min, max, speed }; };
    // Main hand + off hand (50 % base, +25 % Dual Wield Specialization) as one weapon for white swings.
    const melee = { ...w('rogueDual'), dualWield: true, mh: w('rogueMH') };
    melee.coef = (melee.speed / 14) * (1 + 0.5 + tal.dwSpec);
    const bar = ['rogue.ss', 'rogue.evis', 'rogue.snd', 'rogue.kick', 'rogue.bladeflurry', 'rogue.evasion', 'rogue.feint', ...(tal.ar ? ['rogue.ar'] : [])];
    const tweaks = { 'rogue.ss': { costMultFn: (u, ab) => (val(ab, ab.cost.energy) - tal.impSs) / val(ab, ab.cost.energy) } };
    // Weapon Expertise: 2 % less dodge and parry (as extra hit); Hack and Slash: 5 % extra swings (as haste).
    if (tal.weaponExpertise) stats.hit += tal.weaponExpertise;
    const auras = tal.hackAndSlash ? [{ id: 'rogue.t.hack', name: 'Hack and Slash', hidden: true, permanent: true, mods: { meleeHaste: tal.hackAndSlash } }] : [];
    return {
      template: {
        portrait: 'troll-rogue',
        maxHp: S.maxHp,
        resources: { energy: 100 },
        regen: { hpOOC: S.regen.hpOOC, energy: 10 },
        stats,
        armor: S.armor,
        tags: ['humanoid'],
        melee,
        abilities: [...bar],
        auras,
        meta: { talents: tal, spec: 'combat', cp: 0 },
        hooks: { afterDamage: rogueAfterDamage },
      },
      bar,
      tweaks,
    };
  },
};
