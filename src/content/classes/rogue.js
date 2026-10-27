// Rogue kit — WoW: Forever. Played by NPC damage dealers for now (Combat swords at 30 and 60);
// becomes a playable kit later. Energy regenerates 10 per second, combo points sit on the
// target, white swings dual-wield (one combined weapon with the dual-wield miss penalty, like
// the Survival Hunter). Spell ranks: Wowhead datamine, live build 1.60.1.70630 (2026-10-27).
import { registerAbilities } from '../../engine/registry.js';
import { roll, val } from './shared.js';
import { deriveStats, buffTotals, GEAR, WEAPONS } from '../stats.js';

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

registerAbilities({
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
    byLevel: { 30: { energy: 45, dmg: [22, 22] }, 60: { energy: 45, dmg: [68, 68] } },
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
    byLevel: { 30: { energy: 25, haste: 0.2 }, 60: { energy: 25, haste: 0.3 } },
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
  npcOnly: true,
  specs: { 30: [{ id: 'combat', name: 'Combat' }], 60: [{ id: 'combat', name: 'Combat' }] },
  build({ level, race = 'troll', groupBuffs = [] }) {
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
