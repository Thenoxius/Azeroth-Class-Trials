// Warrior kit — WoW: Forever. For now the NPC tanks of the dungeon party and the raid play it
// (Protection at 30 and 60); it becomes a playable kit later. Rage comes from damage dealt and
// taken (Classic 1.12 formula, src/engine/core.js), blocks need a shield. Spell ranks are the
// datamined Forever values (Wowhead, live build 1.60.1.70630, read 2026-10-27). Forever's
// tooltips give no threat numbers; the flat threat values below are Classic's.
import { registerAbilities } from '../../engine/registry.js';
import { roll, val, addStacks } from './shared.js';
import { deriveStats, buffTotals, GEAR, WEAPONS } from '../stats.js';
import { applyRace, validRace, racesFor } from '../races.js';

const DM = (note) => ({ status: 'beta-observation', src: 'wh-forever', note });
const T = (u) => (u.meta && u.meta.talents) || {};
const REVENGE_READY = { id: 'warrior.revenge.ready', name: 'Revenge ready', icon: 'shield', duration: 5 };

// ---------------------------------------------------------------- stances
// Forever tooltips: Battle (1) balanced; Defensive (10) −10 % damage taken and done, +30 %
// threat; Berserker (30) +3 % crit, +10 % damage taken. 1 s cooldown, no global cooldown.
// Tactical Mastery (baseline at 14) keeps up to 10 rage on a swap, Improved Tactical
// Mastery (Arms) 15 more.
export const STANCES = {
  battle: { id: 'warrior.stance.battle', name: 'Battle Stance', icon: 'sword', stance: 'battle', permanent: true, mods: {} },
  defensive: { id: 'warrior.stance.defensive', name: 'Defensive Stance', icon: 'shield', stance: 'defensive', permanent: true, mods: { dmgTaken: { all: 0.9 }, dmgDone: { all: 0.9 }, threat: 1.3 } },
  berserker: { id: 'warrior.stance.berserker', name: 'Berserker Stance', icon: 'beast-wrath', stance: 'berserker', permanent: true, mods: { crit: { all: 0.03 }, dmgTaken: { all: 1.1 } } },
};
export function rageKept(u) {
  if (u.level < 14) return 0;
  return 10 + (T(u).impTacticalMastery ? 15 : 0);
}
function switchStance({ state, u, api }, key) {
  for (const a of [...u.auras]) if (a.def.stance) api.removeAura(state, u, a, 'removed');
  api.applyAura(state, u, u, STANCES[key], { silent: false });
  if (u.res.rage) u.res.rage.cur = Math.min(u.res.rage.cur, rageKept(u));
}
const stanceAbility = (key, learn, desc) => ({
  name: STANCES[key].name, icon: STANCES[key].icon, school: 'physical', mechanic: 'physical', category: 'stance',
  tags: ['stance'], target: 'self', gcd: 0, cooldown: 1, learn, desc, stanceSwitch: key,
  forever: DM('Forever stance tooltip.'),
  canUse: ({ u }) => (u.stance === key ? 'custom:Already in that stance' : true),
  effects: [{ type: 'custom', to: 'self', fn: (x) => switchStance(x, key) }],
});

function weaponHit(state, api, u) {
  const m = u.melee;
  return m.min + (m.max - m.min) * state.rng() + (m.coef || 0) * api.statOf(u, 'ap');
}

// A yellow (ability) strike: weapon damage and/or a flat amount, plus flat threat.
function strike(ctx, o = {}) {
  const { state, u, t, ab, api } = ctx;
  if (!t || !t.alive) return 0;
  const amount = ((o.weapon ? weaponHit(state, api, u) : 0) + roll(state, val(ab, o.amount ?? 'dmg', 0)) + (o.extra || 0)) * (o.mult || 1);
  return api.dealDamage(state, u, t, { amount, school: 'physical', kind: 'melee', ability: ab.id, flatThreat: val(ab, 'thr', 0) * (o.threatMult || 1), threat: o.threat ?? 1, noAvoid: o.noAvoid });
}
const hit = (o) => ({ type: 'custom', fn: (ctx) => strike(ctx, o) });

// "On next swing" attacks (Heroic Strike, Cleave) replace the coming white swing.
const nextSwing = ({ u }) => (!u.melee || u.swingT > 0.4 ? 'custom:Waits for your next swing' : true);
const consumeSwing = { type: 'custom', fn: ({ u }) => { if (u.melee) u.swingT = u.melee.speed; } };

function warriorOnAvoid({ state, u, api, avoid }) {
  const tal = T(u);
  if (['block', 'dodge', 'parry'].includes(avoid) && u.ab['warrior.revenge']) api.applyAura(state, u, u, REVENGE_READY);
  if (avoid === 'block') {
    if (tal.shieldSpec) api.gainRage(u, 5);
    const sb = api.findAura(u, 'warrior.shieldblock');
    if (sb) { sb.data.charges = (sb.data.charges ?? 2) - 1; if (sb.data.charges <= 0) api.removeAura(state, u, sb, 'consumed'); }
  }
  if ((avoid === 'dodge' || avoid === 'parry') && tal.masterOfDefense) api.gainRage(u, 5);
}

registerAbilities({
  'warrior.stance.battle': stanceAbility('battle', 1, 'A balanced combat stance. Needed for Charge, Overpower and Mocking Blow.'),
  'warrior.stance.defensive': stanceAbility('defensive', 10, 'Damage taken and dealt −10 %, threat +30 %. Needed for Taunt, Revenge, Shield Block and Shield Wall.'),
  'warrior.stance.berserker': stanceAbility('berserker', 30, 'Critical strike chance +3 %, damage taken +10 %. Needed for Intercept, Whirlwind, Pummel and Berserker Rage.'),
  'warrior.sunder': {
    name: 'Sunder Armor', icon: 'axe', school: 'physical', mechanic: 'physical', category: 'debuff', tags: ['core', 'threat'], range: 5,
    desc: 'Sunders the target’s armor (stacks 5 times, 30 s) with a high amount of threat.',
    forever: DM('Datamine: −180 armor per stack at 30, −450 at 60; Forever added a threat effect. Threat value is Classic’s.'),
    cost: { rage: 'rage' },
    effects: [{
      type: 'custom',
      fn: ({ state, u, t, ab, api }) => {
        if (!t || !t.alive) return;
        addStacks(state, api, u, t, { id: 'warrior.sunder', name: 'Sunder Armor', icon: 'axe', debuff: true, unique: 'target', duration: 30, maxStacks: 5, refresh: true, stackMods: true, mods: { statAdd: { armor: -val(ab, 'armorPer') } } }, 1);
        api.addThreat(state, t, u, val(ab, 'thr'));
      },
    }],
    byLevel: { 10: { rage: 15, armorPer: 90, thr: 100 }, 30: { rage: 15, armorPer: 180, thr: 140 }, 60: { rage: 15, armorPer: 450, thr: 261 } },
  },
  'warrior.revenge': {
    name: 'Revenge', icon: 'shield', school: 'physical', mechanic: 'physical', category: 'damage', tags: ['core', 'threat'], range: 5,
    desc: 'Usable for 5 s after you block, dodge or parry: a counterattack with a high amount of threat.',
    forever: DM('Datamine: 31–37 at 30, 138–168 at 60 (about 70 % more than Classic). Threat value is Classic’s.'),
    cooldown: 5, cost: { rage: 'rage' }, requiresStance: ['defensive'],
    canUse: ({ u }) => (u.auras.some((a) => a.id === REVENGE_READY.id) ? true : 'custom:Only after a block, dodge or parry'),
    effects: [{ type: 'custom', fn: (ctx) => { ctx.api.removeAuraById(ctx.state, ctx.u, REVENGE_READY.id); strike(ctx, { mult: 1 + (T(ctx.u).impRevenge || 0) }); } }],
    byLevel: { 30: { rage: 5, dmg: [31, 37], thr: 195 }, 60: { rage: 5, dmg: [138, 168], thr: 355 } },
  },
  'warrior.shieldblock': {
    name: 'Shield Block', icon: 'shield-wall', school: 'physical', mechanic: 'physical', category: 'defensive', tags: ['defensive'], target: 'self', gcd: 0,
    desc: '+75 % chance to block for 7 s, up to 2 blocks. Defensive Stance.', requiresStance: ['defensive'],
    forever: DM('Datamine: 7 s and +75 % (Classic 5 s); Improved Shield Block adds 2 s and a block.'),
    cooldown: 5, cost: { rage: 'rage' },
    effects: [{ type: 'custom', fn: ({ state, u, api }) => { const imp = T(u).impShieldBlock; const a = api.applyAura(state, u, u, { id: 'warrior.shieldblock', name: 'Shield Block', icon: 'shield-wall', duration: 7 + (imp ? 2 : 0), mods: { block: 0.75 } }); if (a) a.data.charges = imp ? 3 : 2; } }],
    byLevel: { 30: { rage: 10 }, 60: { rage: 10 } },
  },
  'warrior.hs': {
    name: 'Heroic Strike', icon: 'sword', school: 'physical', mechanic: 'physical', category: 'damage', tags: ['threat'], range: 5, gcd: 0,
    desc: 'Your next swing hits harder and causes a high amount of threat. Costs rage that the swing would not give back.',
    forever: DM('Datamine: +44 at 30, +157 at 60. Threat value is Classic’s.'),
    cost: { rage: 'rage' }, canUse: nextSwing,
    effects: [hit({ weapon: true }), consumeSwing],
    byLevel: { 10: { rage: 15, dmg: [21, 21], thr: 45 }, 30: { rage: 15, dmg: [44, 44], thr: 80 }, 60: { rage: 15, dmg: [157, 157], thr: 175 } },
  },
  'warrior.cleave': {
    name: 'Cleave', icon: 'axe', school: 'physical', mechanic: 'physical', category: 'damage', tags: ['threat', 'aoe'], range: 5, gcd: 0,
    desc: 'Your next swing hits the target and a second nearby enemy for weapon damage plus a bonus.',
    forever: DM('Datamine: +10 at 30, +50 at 60.'),
    cost: { rage: 'rage' }, canUse: nextSwing,
    effects: [{ type: 'custom', aoe: { center: 'target', radius: 5, maxTargets: 2 }, fn: (ctx) => strike(ctx, { weapon: true }) }, consumeSwing],
    byLevel: { 30: { rage: 20, dmg: [10, 10], thr: 40 }, 60: { rage: 20, dmg: [50, 50], thr: 100 } },
  },
  'warrior.thunderclap': {
    name: 'Thunder Clap', icon: 'nova', school: 'physical', mechanic: 'physical', category: 'damage', tags: ['aoe', 'threat'], target: 'none', fx: 'ring', fxRadius: 8,
    desc: 'Damages up to 4 nearby enemies and slows their attacks by 20 %.',
    forever: DM('Datamine: 37 damage at 30, 103 at 60; 6 s cooldown; slow lasts 18 / 30 s.'),
    cooldown: 6, cost: { rage: 'rage' },
    effects: [
      { type: 'damage', amount: 'dmg', kind: 'melee', threat: 1.75, aoe: { center: 'self', radius: 8, maxTargets: 4, affects: 'enemies' } },
      { type: 'aura', aoe: { center: 'self', radius: 8, maxTargets: 4, affects: 'enemies' }, aura: { id: 'warrior.tc', name: 'Thunder Clap', icon: 'nova', debuff: true, duration: 'dur', mods: { meleeHaste: -0.2 } } },
    ],
    byLevel: { 10: { rage: 20, dmg: [10, 10], dur: 10 }, 30: { rage: 20, dmg: [37, 37], dur: 18 }, 60: { rage: 20, dmg: [103, 103], dur: 30 } },
  },
  'warrior.demoshout': {
    name: 'Demoralizing Shout', icon: 'scream', school: 'physical', mechanic: 'physical', category: 'debuff', tags: ['aoe'], target: 'none', fx: 'ring', fxRadius: 10,
    desc: 'Lowers the melee attack power of enemies within 10 yards for 45 s.',
    forever: DM('Datamine: −91 attack power at 30, −210 at 60, 45 s. Modelled as the matching cut in melee damage per hit.'),
    cost: { rage: 'rage' },
    effects: [{
      type: 'custom', aoe: { center: 'self', radius: 10, affects: 'enemies' },
      fn: ({ state, u, t, ab, api }) => {
        if (!t || !t.melee) return;
        const per = (val(ab, 'ap') / 14) * t.melee.speed;
        const avg = (t.melee.min + t.melee.max) / 2 || 1;
        api.applyAura(state, u, t, { id: 'warrior.demo', name: 'Demoralizing Shout', icon: 'scream', debuff: true, duration: 45, mods: { dmgDone: { melee: Math.max(0.5, 1 - per / avg) } } });
        api.addThreat(state, t, u, 40);
      },
    }],
    byLevel: { 30: { rage: 10, ap: 91 }, 60: { rage: 10, ap: 210 } },
  },
  'warrior.taunt': {
    name: 'Taunt', icon: 'taunt', school: 'physical', mechanic: 'physical', category: 'utility', tags: ['threat'], range: 10, gcd: 0,
    desc: 'Forces the target to attack you for 3 s and matches the top threat on it. Defensive Stance.', requiresStance: ['defensive'],
    forever: DM('Datamine: 8 s cooldown (Classic 10 s).'),
    cooldown: 8, effects: [{ type: 'threat', mode: 'taunt', duration: 3 }],
  },
  'warrior.shieldbash': {
    name: 'Shield Bash', icon: 'shield', school: 'physical', mechanic: 'physical', category: 'interrupt', tags: ['interrupt'], range: 5, gcd: 0,
    desc: 'Bashes the target with your shield: interrupts spellcasting and locks that school for 6 s.',
    forever: DM('Datamine: 6 damage (rank 1) / 45 (rank 3), 12 s cooldown, 6 s lockout.'),
    cooldown: 12, cost: { rage: 'rage' },
    effects: [hit({}), { type: 'interrupt', lockout: 6 }],
    byLevel: { 30: { rage: 10, dmg: [6, 6], thr: 0 }, 60: { rage: 10, dmg: [45, 45], thr: 0 } },
  },
  'warrior.shieldslam': {
    name: 'Shield Slam', icon: 'shield', school: 'physical', mechanic: 'physical', category: 'damage', tags: ['core', 'threat'], range: 5,
    desc: 'Slams the target with your shield for heavy damage and a very high amount of threat.',
    forever: DM('Datamine: 640–670 plus block value at 60 (Classic 342–358). Threat value is our estimate.'),
    cooldown: 6, cost: { rage: 'rage' },
    effects: [{ type: 'custom', fn: (ctx) => strike(ctx, { extra: ctx.u.stats.blockValue || 0, threat: 1.5 }) }],
    byLevel: { 60: { rage: 20, dmg: [640, 670], thr: 250 } },
  },
  'warrior.bloodrage': {
    name: 'Bloodrage', icon: 'beast-wrath', school: 'physical', mechanic: 'physical', category: 'resource', tags: ['resource'], target: 'self', gcd: 0,
    desc: 'Generates 10 rage at once and 10 more over 10 s, at a small cost in health.',
    forever: DM('Datamine: unchanged amounts, 1 min cooldown.'),
    cooldown: 60,
    effects: [{
      type: 'custom',
      fn: ({ state, u, api }) => {
        api.gainRage(u, 10);
        u.hp = Math.max(1, u.hp - Math.round(u.maxHp * 0.03));
        api.applyAura(state, u, u, { id: 'warrior.bloodrage', name: 'Bloodrage', icon: 'beast-wrath', duration: 10, tick: { interval: 1, type: 'custom', fn: ({ u: me, api: a2 }) => a2.gainRage(me, 1) } });
      },
    }],
  },
  'warrior.shieldwall': {
    name: 'Shield Wall', icon: 'shield-wall', school: 'physical', mechanic: 'physical', category: 'defensive', tags: ['defensive'], target: 'self', gcd: 0,
    desc: 'All damage you take is reduced by 60 % for 12 s.',
    forever: DM('Datamine: 12 s, 15 min cooldown (Improved Shield Wall: −11 min).'),
    cooldown: 'cd',
    effects: [{ type: 'aura', to: 'self', aura: { id: 'warrior.shieldwall', name: 'Shield Wall', icon: 'shield-wall', duration: 12, mods: { dmgTaken: { all: 0.4 } } } }],
    byLevel: { 30: { cd: 900 }, 60: { cd: 240 } },
  },
  'warrior.laststand': {
    name: 'Last Stand', icon: 'shield-wall', school: 'physical', mechanic: 'physical', category: 'defensive', tags: ['defensive'], target: 'self', gcd: 0,
    desc: 'Gain 30 % of your maximum health for 20 s.',
    forever: DM('Protection talent; Classic 10 min cooldown used.'),
    cooldown: 600,
    effects: [{
      type: 'custom',
      fn: ({ state, u, api }) => {
        const extra = Math.round(u.maxHp * 0.3);
        u.maxHp += extra; u.hp += extra;
        api.applyAura(state, u, u, { id: 'warrior.laststand', name: 'Last Stand', icon: 'shield-wall', duration: 20, onRemove: ({ u: me }) => { me.maxHp -= extra; me.hp = Math.min(me.hp, me.maxHp); } });
      },
    }],
  },
});

// ---------------------------------------------------------------- playable Warrior (phase 4)
// Ranks: research/forever-warrior-rogue.json (Wowhead Forever spellbook, build 1.60.1).
// Forever trains Mortal Strike, Bloodthirst and Shield Slam at 48 for every Warrior.
const OVERPOWER_READY = { id: 'warrior.overpower.ready', name: 'Overpower ready', icon: 'sword', duration: 5 };
const VR_READY = { id: 'warrior.vr.ready', name: 'Victory Rush ready', icon: 'sword', duration: 20 };
const ST = (...s) => s;
const stanceText = { battle: 'Battle', defensive: 'Defensive', berserker: 'Berserker' };
const needStance = (...s) => ({ requiresStance: s });
const startsMelee = { startsMelee: true };

registerAbilities({
  'warrior.attack': {
    name: 'Attack', icon: 'sword', school: 'physical', mechanic: 'physical', category: 'damage', tags: ['core'], toggle: 'melee', gcd: 0, range: 5, learn: 1,
    desc: 'Toggle auto-attack: your white swings, which also build rage.',
    forever: DM('Baseline.'),
  },
  'warrior.charge': {
    name: 'Charge', icon: 'dash', school: 'physical', mechanic: 'physical', category: 'movement', tags: ['core', 'opener'], range: 25, minRange: 8, cooldown: 15, gcd: 0, noRoot: true, outOfCombat: true, learn: 4,
    ...needStance('battle'), ...startsMelee,
    desc: 'Rush to an enemy, gain rage and stun it for 1 s. Not in combat. Battle Stance.',
    forever: DM('Forever tooltip: 9 / 12 / 15 rage by rank, 1 s stun, 15 s cooldown.'),
    effects: [
      { type: 'teleport', mode: 'toTarget' },
      { type: 'aura', aura: { id: 'warrior.charge', name: 'Charge Stun', icon: 'dash', debuff: true, duration: 1, cc: 'stun' } },
      { type: 'custom', fn: ({ u, ab, api }) => api.gainRage(u, val(ab, 'rage') + (T(u).impCharge || 0)) },
    ],
    byLevel: { 10: { rage: 9 }, 30: { rage: 12 }, 60: { rage: 15 } },
  },
  'warrior.rend': {
    name: 'Rend', icon: 'claw', school: 'physical', mechanic: 'physical', category: 'dot', tags: ['core', 'bleed'], range: 5, learn: 4,
    ...needStance('battle', 'defensive'), ...startsMelee,
    desc: 'The target bleeds for physical damage over time. Bleeds ignore armor.',
    forever: DM('Forever tooltip: 28 over 12 s (10), 66 over 18 s (30), 147 over 21 s (60).'),
    cost: { rage: 'rage' },
    effects: [{ type: 'custom', fn: ({ state, u, t, ab, api }) => {
      const total = val(ab, 'total') * (1 + (T(u).impRend || 0));
      const dur = val(ab, 'dur');
      api.applyAura(state, u, t, { id: 'warrior.rend', name: 'Rend', icon: 'claw', school: 'physical', debuff: true, duration: dur, bleed: true, tick: { interval: 3, amount: total / (dur / 3), school: 'physical', kind: 'bleed' } });
    } }],
    byLevel: { 10: { rage: 10, total: 28, dur: 12 }, 30: { rage: 10, total: 66, dur: 18 }, 60: { rage: 10, total: 147, dur: 21 } },
  },
  'warrior.hamstring': {
    name: 'Hamstring', icon: 'wing-clip', school: 'physical', mechanic: 'physical', category: 'control', tags: ['control'], range: 5, learn: 8,
    ...needStance('battle', 'berserker'), ...startsMelee,
    desc: 'Small hit that slows the target’s movement for 15 s.',
    forever: DM('Forever tooltip: 5 damage and 40 % (rank 1), 45 damage and 50 % at 54.'),
    cost: { rage: 'rage' },
    effects: [hit({}), { type: 'custom', fn: ({ state, u, t, ab, api }) => { if (t && t.alive) api.applyAura(state, u, t, { id: 'warrior.hamstring', name: 'Hamstring', icon: 'wing-clip', debuff: true, duration: 15, mods: { slow: val(ab, 'slow') } }); } }],
    byLevel: { 10: { rage: 10, dmg: [5, 5], slow: 0.4, thr: 0 }, 30: { rage: 10, dmg: [5, 5], slow: 0.4, thr: 0 }, 60: { rage: 10, dmg: [45, 45], slow: 0.5, thr: 0 } },
  },
  'warrior.overpower': {
    name: 'Overpower', icon: 'sword', school: 'physical', mechanic: 'physical', category: 'damage', tags: ['core', 'proc'], range: 5, cooldown: 5, learn: 12,
    ...needStance('battle'), ...startsMelee,
    desc: 'Usable for 5 s after the target dodges: weapon damage plus a bonus, cannot be dodged, blocked or parried.',
    forever: DM('Forever tooltip: weapon + 15 (30), + 35 (60), 5 rage, 5 s cooldown.'),
    cost: { rage: 'rage' },
    canUse: ({ u }) => (u.auras.some((a) => a.id === OVERPOWER_READY.id) ? true : 'custom:Only after the target dodges'),
    effects: [{ type: 'custom', fn: (ctx) => { ctx.api.removeAuraById(ctx.state, ctx.u, OVERPOWER_READY.id); strike(ctx, { weapon: true, noAvoid: true }); } }],
    byLevel: { 30: { rage: 5, dmg: [15, 15], thr: 0 }, 60: { rage: 5, dmg: [35, 35], thr: 0 } },
  },
  'warrior.execute': {
    name: 'Execute', icon: 'axe', school: 'physical', mechanic: 'physical', category: 'damage', tags: ['core', 'finisher'], range: 5, learn: 24,
    ...needStance('battle', 'berserker'), ...startsMelee,
    desc: 'On a target at 20 % health or less: big damage, and every point of rage left after the cost adds more.',
    forever: DM('Forever tooltip: 125 + 3 per extra rage (rank 1), 600 + 15 per rage at 56.'),
    cost: { rage: 'rage' },
    canUse: ({ t }) => (t && t.alive && t.hp / t.maxHp <= 0.2 ? true : 'custom:Only below 20 % health'),
    effects: [{ type: 'custom', fn: (ctx) => {
      const extra = ctx.u.res.rage ? ctx.u.res.rage.cur : 0;
      if (ctx.u.res.rage) ctx.u.res.rage.cur = 0;
      strike(ctx, { extra: extra * val(ctx.ab, 'perRage') });
    } }],
    byLevel: { 30: { rage: 15, dmg: [125, 125], perRage: 3, thr: 0 }, 60: { rage: 15, dmg: [600, 600], perRage: 15, thr: 0 } },
  },
  'warrior.slam': {
    name: 'Slam', icon: 'axe', school: 'physical', mechanic: 'physical', category: 'damage', tags: ['core'], range: 5, castTime: 1.5, cooldown: 18, learn: 20, resetsSwing: true,
    ...startsMelee,
    desc: '1.5 s cast: weapon damage plus a bonus. Restarts your swing timer. 18 s cooldown in Forever.',
    forever: DM('Forever tooltip: weapon + 32 (30), + 87 (54), 15 rage, 18 s cooldown (new).'),
    cost: { rage: 'rage' },
    effects: [hit({ weapon: true })],
    byLevel: { 30: { rage: 15, dmg: [32, 32], thr: 0 }, 60: { rage: 15, dmg: [87, 87], thr: 0 } },
  },
  'warrior.ms': {
    name: 'Mortal Strike', icon: 'sword', school: 'physical', mechanic: 'physical', category: 'damage', tags: ['core'], range: 5, cooldown: 6, learn: 48,
    ...startsMelee,
    desc: 'Weapon damage plus a bonus; healing on the target is 50 % less effective for 10 s.',
    forever: DM('Forever: trained by every Warrior at 48; weapon + 160 at 60, 30 rage, 6 s cooldown.'),
    cost: { rage: 'rage' },
    effects: [hit({ weapon: true }), { type: 'aura', aura: { id: 'warrior.ms', name: 'Mortal Strike', icon: 'sword', debuff: true, duration: 10, mods: { healTaken: 0.5 } } }],
    byLevel: { 60: { rage: 30, dmg: [160, 160], thr: 0 } },
  },
  'warrior.bt': {
    name: 'Bloodthirst', icon: 'beast-wrath', school: 'physical', mechanic: 'physical', category: 'damage', tags: ['core'], range: 5, cooldown: 6, learn: 48,
    ...startsMelee,
    desc: 'Damage equal to 45 % of your attack power plus a bonus, and +10 % movement speed for 10 s.',
    forever: DM('Forever: trained at 48; 45 % AP + 48 at 60, 30 rage, 6 s cooldown.'),
    cost: { rage: 'rage' },
    effects: [
      { type: 'custom', fn: (ctx) => strike(ctx, { extra: 0.45 * ctx.api.statOf(ctx.u, 'ap') }) },
      { type: 'aura', to: 'self', aura: { id: 'warrior.bt', name: 'Bloodthirst', icon: 'beast-wrath', duration: 10, mods: { speed: 0.1 } } },
    ],
    byLevel: { 60: { rage: 30, dmg: [48, 48], thr: 0 } },
  },
  'warrior.ww': {
    name: 'Whirlwind', icon: 'axe', school: 'physical', mechanic: 'physical', category: 'damage', tags: ['aoe'], target: 'none', cooldown: 10, learn: 36, fx: 'ring', fxRadius: 8,
    ...needStance('berserker'),
    desc: 'Hit up to 4 enemies within 8 yards with both weapons.',
    forever: DM('Forever tooltip: both melee weapons, up to 4 targets, 25 rage, 10 s cooldown.'),
    cost: { rage: 'rage' },
    effects: [{ type: 'custom', aoe: { center: 'self', radius: 8, maxTargets: 4, affects: 'enemies' }, fn: (ctx) => {
      const oh = ctx.u.melee && ctx.u.melee.oh;
      strike(ctx, { weapon: true, amount: [0, 0] });
      if (oh) ctx.api.dealDamage(ctx.state, ctx.u, ctx.t, { amount: (oh.min + (oh.max - oh.min) * ctx.state.rng()) * (oh.mult ?? 0.5), school: 'physical', kind: 'melee', ability: ctx.ab.id, hand: 'oh' });
    } }],
    byLevel: { 60: { rage: 25 } },
  },
  'warrior.vr': {
    name: 'Victory Rush', icon: 'sword', school: 'physical', mechanic: 'physical', category: 'damage', tags: ['sustain'], range: 5, cooldown: 30, learn: 20, gcd: 1.5,
    ...startsMelee,
    desc: 'Within 20 s of a kill: a strike for 15 % of your attack power that heals you for 10 % of your health.',
    forever: DM('Forever: new baseline at 20. 1 + 15 % AP damage, heals 10 % max health, 30 s cooldown.'),
    canUse: ({ u }) => (u.auras.some((a) => a.id === VR_READY.id) ? true : 'custom:Only after a kill'),
    effects: [{ type: 'custom', fn: (ctx) => {
      ctx.api.removeAuraById(ctx.state, ctx.u, VR_READY.id);
      strike(ctx, { amount: [1, 1], extra: 0.15 * ctx.api.statOf(ctx.u, 'ap') });
      ctx.api.healUnit(ctx.state, ctx.u, ctx.u, { amount: ctx.u.maxHp * 0.1, ability: ctx.ab.id, canCrit: false });
    } }],
  },
  'warrior.intercept': {
    name: 'Intercept', icon: 'dash', school: 'physical', mechanic: 'physical', category: 'movement', tags: ['control'], range: 25, minRange: 8, cooldown: 30, gcd: 0, noRoot: true, learn: 30,
    ...needStance('berserker'), ...startsMelee,
    desc: 'Charge an enemy in combat, dealing a little damage and stunning it for 3 s. Berserker Stance.',
    forever: DM('Forever tooltip: 25 damage (30), 65 (52), 10 rage, 30 s cooldown, 3 s stun.'),
    cost: { rage: 'rage' },
    effects: [{ type: 'teleport', mode: 'toTarget' }, hit({}), { type: 'aura', aura: { id: 'warrior.intercept', name: 'Intercept Stun', icon: 'dash', debuff: true, duration: 3, cc: 'stun', dr: 'stun' } }],
    byLevel: { 30: { rage: 10, dmg: [25, 25], thr: 0 }, 60: { rage: 10, dmg: [65, 65], thr: 0 } },
  },
  'warrior.pummel': {
    name: 'Pummel', icon: 'sword', school: 'physical', mechanic: 'physical', category: 'interrupt', tags: ['interrupt'], range: 5, cooldown: 10, gcd: 0, learn: 38,
    ...needStance('berserker'),
    desc: 'Interrupt spellcasting and lock that school for 4 s. Berserker Stance.',
    forever: DM('Forever tooltip: 50 damage at 58, 10 rage, 10 s cooldown, 4 s lockout.'),
    cost: { rage: 'rage' },
    effects: [hit({}), { type: 'interrupt', lockout: 4 }],
    byLevel: { 60: { rage: 10, dmg: [50, 50], thr: 0 } },
  },
  'warrior.berserkerrage': {
    name: 'Berserker Rage', icon: 'beast-wrath', school: 'physical', mechanic: 'physical', category: 'defensive', tags: ['defensive'], target: 'self', cooldown: 30, gcd: 0, learn: 30, usableWhileCC: true,
    ...needStance('berserker'),
    desc: 'Immune to Fear and Incapacitate for 10 s (breaks them now) and more rage from hits taken.',
    forever: DM('Forever tooltip: 10 s, 30 s cooldown.'),
    effects: [{ type: 'custom', fn: ({ state, u, api }) => {
      for (const a of [...u.auras]) if (a.def.cc && ['fear', 'incap'].some((c) => [].concat(a.def.cc).includes(c))) api.removeAura(state, u, a, 'broken');
      if (T(u).impBerserkerRage) api.gainRage(u, 10);
      api.applyAura(state, u, u, { id: 'warrior.berserkerrage', name: 'Berserker Rage', icon: 'beast-wrath', duration: 10,
        onApply: ({ u: me }) => { me.immune.fear = true; me.immune.incap = true; },
        onRemove: ({ u: me }) => { me.immune.fear = false; me.immune.incap = false; } });
    } }],
  },
  'warrior.battleshout': {
    name: 'Battle Shout', icon: 'scream', school: 'physical', mechanic: 'physical', category: 'buff', tags: ['buff'], target: 'none', learn: 1, fx: 'ring', fxRadius: 20,
    desc: 'You and your party within 20 yards gain melee attack power for 3 min.',
    forever: DM('Forever tooltip: +12 (rank 1), +36 (22), +140 (60) attack power; 3 min.'),
    cost: { rage: 'rage' },
    canUse: ({ u }) => (u.auras.some((a) => a.id === 'warrior.battleshout' && a.remaining > 20) ? 'custom:Battle Shout is still up' : true),
    effects: [{ type: 'custom', aoe: { center: 'self', radius: 20, affects: 'allies' }, fn: ({ state, u, t, ab, api }) => { if (t) api.applyAura(state, u, t, { id: 'warrior.battleshout', name: 'Battle Shout', icon: 'scream', unique: 'target', duration: 180, mods: { statAdd: { ap: val(ab, 'ap') } } }); } }],
    byLevel: { 10: { rage: 10, ap: 12 }, 30: { rage: 10, ap: 36 }, 60: { rage: 10, ap: 140 } },
  },
  'warrior.intimidate': {
    name: 'Intimidating Shout', icon: 'scream', school: 'physical', mechanic: 'physical', category: 'control', tags: ['control', 'aoe'], target: 'none', cooldown: 180, learn: 22, fx: 'ring', fxRadius: 8,
    desc: 'Up to 5 enemies within 8 yards flee in fear for 8 s.',
    forever: DM('Forever tooltip: 25 rage, 3 min cooldown, 8 s.'),
    cost: { rage: 'rage' },
    effects: [{ type: 'aura', aoe: { center: 'self', radius: 8, maxTargets: 5, affects: 'enemies' }, aura: { id: 'warrior.intimidate', name: 'Intimidating Shout', icon: 'scream', debuff: true, duration: 8, cc: 'fear', breakDamage: 0.15, breakDamagePct: true, dr: 'fear' } }],
    byLevel: { 30: { rage: 25 }, 60: { rage: 25 } },
  },
  'warrior.retaliation': {
    name: 'Retaliation', icon: 'shield-wall', school: 'physical', mechanic: 'physical', category: 'defensive', tags: ['defensive'], target: 'self', cooldown: 900, gcd: 0, learn: 20,
    ...needStance('battle'),
    desc: 'For 15 s you counterattack every melee hit from the front (up to 30). Battle Stance.',
    forever: DM('Forever tooltip: 15 s, 30 counterattacks, 15 min cooldown.'),
    effects: [{ type: 'aura', to: 'self', aura: { id: 'warrior.retaliation', name: 'Retaliation', icon: 'shield-wall', duration: 15,
      onHolderDamaged: ({ state, u, aura, api, src, pk }) => {
        if (!src || !src.alive || !pk || pk.kind !== 'melee' || (aura.data.n || 0) >= 30) return;
        aura.data.n = (aura.data.n || 0) + 1;
        api.dealDamage(state, u, src, { amount: weaponHit(state, api, u), school: 'physical', kind: 'melee', ability: 'warrior.retaliation' });
      } } }],
  },
  'warrior.recklessness': {
    name: 'Recklessness', icon: 'axe', school: 'physical', mechanic: 'physical', category: 'cooldown', tags: ['burst'], target: 'self', cooldown: 1800, gcd: 0, learn: 50,
    ...needStance('berserker'),
    desc: '+100 % critical strike chance and Fear immunity for 15 s, but you take 20 % more damage.',
    forever: DM('Forever tooltip: 15 s, 30 min cooldown.'),
    effects: [{ type: 'aura', to: 'self', aura: { id: 'warrior.recklessness', name: 'Recklessness', icon: 'axe', duration: 15, mods: { crit: { all: 1 }, dmgTaken: { all: 1.2 } } } }],
  },
  'warrior.deathwish': {
    name: 'Death Wish', icon: 'beast-wrath', school: 'physical', mechanic: 'physical', category: 'cooldown', tags: ['burst'], target: 'self', cooldown: 180, gcd: 0, learn: 30,
    desc: 'Fury talent: physical damage +20 % for 30 s, but you take more damage.',
    forever: DM('Forever Fury talent; duration and the damage-taken cost are Classic’s (30 s, +5 %).'),
    cost: { rage: 'rage' },
    effects: [{ type: 'aura', to: 'self', aura: { id: 'warrior.deathwish', name: 'Death Wish', icon: 'beast-wrath', duration: 30, mods: { dmgDone: { physical: 1.2 }, dmgTaken: { all: 1.05 } } } }],
    byLevel: { 60: { rage: 10 } },
  },
});

// Player-side hooks: Overpower after a dodge, Victory Rush after a kill, Fury/Arms talent procs.
function playerAfterDamage({ state, u, api, pk, dst }) {
  const tal = T(u);
  if (!pk || pk.isTick || !pk.crit || !dst || dst === u) return;
  const melee = pk.kind === 'melee' || pk.ability === 'melee';
  if (!melee) return;
  if (tal.deepWounds && dst.alive) {
    const m = u.melee;
    const per = ((m.min + m.max) / 2) * 0.6 / 4;
    api.applyAura(state, u, dst, { id: 'warrior.deepwounds', name: 'Deep Wounds', icon: 'claw', debuff: true, duration: 12, bleed: true, tick: { interval: 3, amount: per, school: 'physical', kind: 'bleed' } });
  }
  if (tal.flurry) api.applyAura(state, u, u, { id: 'warrior.flurry', name: 'Flurry', icon: 'beast-wrath', duration: (u.melee ? u.melee.speed : 2.5) * 2.2, mods: { meleeHaste: 0.25 } });
}
function playerOnAttackAvoided({ state, u, api, avoid }) {
  if (avoid === 'dodge' && u.level >= 12) api.applyAura(state, u, u, OVERPOWER_READY);
}
function playerOnKill({ state, u, api }) {
  if (u.level >= 20) api.applyAura(state, u, u, VR_READY);
}
function playerOnWeaponHit({ state, u, api }) {
  const tal = T(u);
  if (tal.unbridledWrath && state.rng() < tal.unbridledWrath) api.gainRage(u, 1);
}
function playerAfterDamageTaken({ state, u, api, final }) {
  if (T(u).enrage && final > 0 && state.rng() < 0.3) api.applyAura(state, u, u, { id: 'warrior.enrage', name: 'Enrage', icon: 'beast-wrath', duration: 12, mods: { dmgDone: { physical: 1.1 } } });
}

// Talent picks (Forever trees): 21 points at 30, 51 at 60. Values are what the talents do in
// the engine; Arms/Fury tooltips without numbers (weapon specs) use the Classic value.
const PLAYER_TALENTS = {
  arms30: { impHs: 3, impRend: 0.35, impCharge: 6, impTacticalMastery: true, angerMgmt: true, deepWounds: true, twoHandSpec: 1.05 },
  arms60: { impHs: 3, impRend: 0.35, impCharge: 6, impTacticalMastery: true, angerMgmt: true, deepWounds: true, twoHandSpec: 1.05, impOverpower: 0.5, impale: 1.2, cruelty: 0.05 },
  fury30: { cruelty: 0.05, unbridledWrath: 0.6, dwSpec: 1.25, impExecute: 5, bloodCraze: true },
  fury60: { cruelty: 0.05, unbridledWrath: 0.6, dwSpec: 1.25, impExecute: 5, bloodCraze: true, flurry: true, enrage: true, deathWish: true, impIntercept: 10, impBerserkerRage: true, impHs: 3 },
};

const PLAYER_BARS = {
  10: ['warrior.attack', 'warrior.charge', 'warrior.hs', 'warrior.rend', 'warrior.thunderclap', 'warrior.hamstring', 'warrior.battleshout', 'warrior.bloodrage', 'warrior.sunder', 'warrior.stance.battle', 'warrior.stance.defensive'],
  arms30: ['warrior.attack', 'warrior.charge', 'warrior.overpower', 'warrior.rend', 'warrior.slam', 'warrior.hs', 'warrior.execute', 'warrior.vr', 'warrior.hamstring', 'warrior.thunderclap', 'warrior.intimidate', 'warrior.retaliation', 'warrior.battleshout', 'warrior.bloodrage', 'warrior.stance.battle', 'warrior.stance.defensive', 'warrior.stance.berserker'],
  fury30: ['warrior.attack', 'warrior.charge', 'warrior.intercept', 'warrior.hs', 'warrior.cleave', 'warrior.slam', 'warrior.execute', 'warrior.vr', 'warrior.hamstring', 'warrior.berserkerrage', 'warrior.intimidate', 'warrior.battleshout', 'warrior.bloodrage', 'warrior.stance.battle', 'warrior.stance.defensive', 'warrior.stance.berserker'],
  prot30: ['warrior.attack', 'warrior.charge', 'warrior.sunder', 'warrior.revenge', 'warrior.shieldblock', 'warrior.hs', 'warrior.cleave', 'warrior.thunderclap', 'warrior.demoshout', 'warrior.taunt', 'warrior.shieldbash', 'warrior.shieldwall', 'warrior.laststand', 'warrior.battleshout', 'warrior.bloodrage', 'warrior.stance.battle', 'warrior.stance.defensive'],
  arms60: ['warrior.attack', 'warrior.charge', 'warrior.ms', 'warrior.overpower', 'warrior.slam', 'warrior.execute', 'warrior.rend', 'warrior.hs', 'warrior.vr', 'warrior.hamstring', 'warrior.intercept', 'warrior.pummel', 'warrior.intimidate', 'warrior.retaliation', 'warrior.recklessness', 'warrior.battleshout', 'warrior.bloodrage', 'warrior.stance.battle', 'warrior.stance.defensive', 'warrior.stance.berserker'],
  fury60: ['warrior.attack', 'warrior.intercept', 'warrior.bt', 'warrior.ww', 'warrior.hs', 'warrior.execute', 'warrior.slam', 'warrior.vr', 'warrior.hamstring', 'warrior.pummel', 'warrior.berserkerrage', 'warrior.deathwish', 'warrior.recklessness', 'warrior.intimidate', 'warrior.battleshout', 'warrior.bloodrage', 'warrior.charge', 'warrior.stance.battle', 'warrior.stance.berserker'],
  prot60: ['warrior.attack', 'warrior.shieldslam', 'warrior.revenge', 'warrior.sunder', 'warrior.shieldblock', 'warrior.hs', 'warrior.thunderclap', 'warrior.demoshout', 'warrior.taunt', 'warrior.shieldbash', 'warrior.shieldwall', 'warrior.laststand', 'warrior.battleshout', 'warrior.bloodrage', 'warrior.charge', 'warrior.intercept', 'warrior.stance.battle', 'warrior.stance.defensive', 'warrior.stance.berserker'],
};
const LOOP = {
  10: 'Charge in (Battle Stance), Rend, then Heroic Strike when rage piles up; Thunder Clap on packs. Eat between pulls.',
  arms30: 'Charge, Rend, Overpower whenever it lights up, Slam on cooldown, Heroic Strike with spare rage, Execute below 20 %. Victory Rush after kills keeps you topped up.',
  fury30: 'Charge, then Berserker Stance: Heroic Strike / Cleave with spare rage, Slam, Execute below 20 %, Intercept to close gaps.',
  prot30: 'Defensive Stance: Sunder ×5, Revenge whenever it lights up, Shield Block, Thunder Clap and Demoralizing Shout on packs, Taunt what leaves you.',
  arms60: 'Mortal Strike on cooldown, Overpower on dodges, Slam, Execute in the last 20 %, Heroic Strike to dump rage.',
  fury60: 'Berserker Stance: Bloodthirst on cooldown, Whirlwind, Heroic Strike to dump rage, Execute in the last 20 %, Death Wish + Recklessness together.',
  prot60: 'Shield Slam on cooldown, Revenge, Sunder to five, Shield Block; Heroic Strike only with spare rage.',
};
const PASSIVE = (name, desc, forever) => ({ name, desc, forever });
const PASSIVES = {
  arms: [PASSIVE('Arms talents', '21 points at 30 (Improved Rend, Improved Charge, Tactical Mastery, Anger Management, Deep Wounds, Two-Handed Weapon Specialization); at 60 plus Improved Overpower, Impale and Cruelty.', DM('Forever talent tree; point spread is our pick.'))],
  fury: [PASSIVE('Fury talents', 'Cruelty, Unbridled Wrath, Dual Wield Specialization, Improved Execute; at 60 plus Flurry, Enrage, Death Wish, Improved Intercept and Improved Berserker Rage.', DM('Forever talent tree; point spread is our pick.'))],
  prot: [PASSIVE('Protection talents', 'Shield Specialization, Anticipation, Toughness, Improved Revenge, Defiance, Improved Shield Block, Last Stand; at 60 plus Improved Shield Wall.', DM('Forever talent tree; point spread is our pick.'))],
};

// Protection builds (21 points at 30, 31/5/15 at 60), from the Forever talent tree.
const TALENTS = {
  prot30: { shieldSpec: true, anticipation: true, toughness: 0.1, impRevenge: 0.6, defiance: 1.15, impShieldBlock: true, lastStand: true, masterOfDefense: true, impSunder: 3 },
  prot60: { shieldSpec: true, anticipation: true, toughness: 0.1, impRevenge: 0.6, defiance: 1.15, impShieldBlock: true, lastStand: true, masterOfDefense: true, impSunder: 3, bastion: 1.1, impShieldWall: true, impHs: 3, impTc: 6 },
};
// Shield block value (shield + Strength / 20) on typical shields of the level.
const SHIELD_VALUE = { 30: 22, 60: 55 };

const snap = (level) => (level >= 45 ? 60 : 30);

const playerSnap = (level) => (level >= 45 ? 60 : level >= 20 ? 30 : 10);

// The playable Warrior (phase 4). Arms: two-hander, Battle Stance. Fury: two one-handers,
// Berserker Stance from 30. Protection: shield, Defensive Stance (the tank role).
function playerBuild({ level, spec, role, race, groupBuffs = [] }) {
  const L = playerSnap(level);
  const sp = L === 10 ? null : role === 'tank' ? 'prot' : ['arms', 'fury', 'prot'].includes(spec) ? spec : 'arms';
  const key = L === 10 ? 10 : sp + L;
  const tal = L === 10 ? {} : sp === 'prot' ? TALENTS[key] : PLAYER_TALENTS[key];
  const tank = sp === 'prot';
  const gear = tank ? GEAR.warriorTank[L] : GEAR.warriorDps[L];
  const S = deriveStats({ classId: 'warrior', race, level: L, gear: tank ? { ...gear, armor: Math.round(gear.armor * (1 + (tal.toughness || 0))) } : gear, buffs: buffTotals(groupBuffs.filter((n) => n !== 'battleShout'), L) });
  const stats = { ...S.stats, parry: 0.05, critPhys: S.stats.critPhys + (tal.cruelty || 0) };
  const w = (k) => { const [min, max, speed] = WEAPONS[k][L]; return { min, max, speed, coef: speed / 14 }; };
  let melee;
  if (tank) {
    const def = tal.anticipation ? 0.008 : 0;
    Object.assign(stats, { parry: 0.05 + def, dodge: S.stats.dodge + def, block: 0.05 + (tal.shieldSpec ? 0.05 : 0) + def, blockValue: (SHIELD_VALUE[L] || 10) + Math.round(S.attrs.str / 20) });
    melee = w('tank1h');
  } else if (sp === 'fury') {
    melee = { ...w('fury1h'), dualWield: true, oh: { ...w('fury1h'), mult: 0.5 * (tal.dwSpec || 1) } };
  } else melee = w('twoHand');
  const stance = tank ? 'defensive' : sp === 'fury' && L >= 30 ? 'berserker' : 'battle';
  const auras = [{ ...STANCES[stance], mods: { ...STANCES[stance].mods, ...(tank ? { dmgDone: { all: 0.9 * (tal.bastion || 1) }, threat: 1.3 * (tal.defiance || 1) } : {}) } }];
  if (tal.twoHandSpec) auras.push({ id: 'warrior.t.2h', name: 'Two-Handed Weapon Specialization', hidden: true, permanent: true, mods: { dmgDone: { physical: tal.twoHandSpec } } });
  if (tal.impale) auras.push({ id: 'warrior.t.impale', name: 'Impale', hidden: true, permanent: true, mods: { critDamage: { physical: tal.impale } } });
  if (tal.angerMgmt) auras.push({ id: 'warrior.t.anger', name: 'Anger Management', hidden: true, permanent: true, tick: { interval: 3, type: 'custom', fn: ({ state, u, api }) => { if (api.inCombat(state, u)) api.gainRage(u, 1); } } });
  const bar = PLAYER_BARS[key];
  const tweaks = {};
  const rageOff = (id, n) => { if (n) tweaks[id] = { ...(tweaks[id] || {}), costMultFn: (u, ab) => Math.max(0, (val(ab, ab.cost.rage) - n) / val(ab, ab.cost.rage)) }; };
  rageOff('warrior.hs', tal.impHs);
  rageOff('warrior.execute', tal.impExecute);
  rageOff('warrior.sunder', tal.impSunder);
  rageOff('warrior.thunderclap', tal.impTc);
  if (tal.impIntercept) tweaks['warrior.intercept'] = { cd: 30 - tal.impIntercept };
  if (tal.impOverpower) tweaks['warrior.overpower'] = { critBonus: tal.impOverpower };
  const prevKey = L === 60 ? sp + '30' : L === 30 ? 10 : null;
  const prev = prevKey ? PLAYER_BARS[prevKey] : null;
  return {
    template: {
      name: 'You',
      portrait: 'orc-warrior',
      maxHp: S.maxHp,
      resources: { rage: 100 },
      regen: { hpOOC: S.regen.hpOOC, rageDecay: tal.angerMgmt ? 1.05 : 1.5 },
      stats,
      armor: S.armor,
      tags: ['humanoid'],
      melee,
      abilities: [...bar],
      auras,
      meta: { talents: tal, spec: sp },
      hooks: {
        onAvoid: warriorOnAvoid,
        onAttackAvoided: playerOnAttackAvoided,
        onKill: playerOnKill,
        onPartyKill: playerOnKill,
        afterDamage: playerAfterDamage,
        onWeaponHit: playerOnWeaponHit,
        afterDamageTaken: playerAfterDamageTaken,
      },
    },
    bar,
    consumables: ['item.rest', 'item.healpot'],
    tweaks,
    passives: L === 10 ? [] : PASSIVES[sp],
    newSince: prev ? { from: L === 60 ? 30 : 10, ids: bar.filter((id) => !prev.includes(id)) } : null,
    loopHint: LOOP[key],
    filler: sp === 'prot' ? 'warrior.sunder' : 'warrior.hs',
  };
}

export const KIT = {
  id: 'warrior',
  name: 'Warrior',
  color: '#C69B6D',
  resource: 'rage',
  race: 'Orc',
  portrait: 'orc-warrior',
  tagline: 'Plate, a big weapon and rage that only comes from fighting.',
  fantasy: 'A melee fighter who builds rage by hitting and being hit. Arms swings a two-hander with Overpower, Slam and Mortal Strike, Fury dual-wields in Berserker Stance, Protection holds the enemy with a shield. Charge starts the fight; stances decide what you can do.',
  strengthsSummary: 'Can tank and deal damage, strong burst at 60, Charge/Intercept/Hamstring control melee range, Victory Rush heals between kills.',
  risksSummary: 'Rage starts at zero every fight, high downtime while levelling, stance swaps cost rage, depends on gear.',
  specs: {
    30: [
      { id: 'arms', name: 'Arms', blurb: 'Two-hander: Rend, Overpower, Slam, Deep Wounds.', forever: DM('Talent tree from the Forever datamine; 21-point pick is ours.') },
      { id: 'fury', name: 'Fury', blurb: 'Two one-handers in Berserker Stance; Unbridled Wrath feeds rage.', forever: DM('Talent tree from the Forever datamine; 21-point pick is ours.') },
      { id: 'prot', name: 'Protection', blurb: 'Shield and Defensive Stance: Sunder, Revenge, Shield Block.', forever: DM('Talent tree from the Forever datamine; 21-point pick is ours.') },
    ],
    60: [
      { id: 'arms', name: 'Arms', blurb: 'Mortal Strike, Overpower, Slam and Impale crits.', forever: DM('Mortal Strike is trained at 48 in Forever; 51-point pick is ours.') },
      { id: 'fury', name: 'Fury', blurb: 'Bloodthirst, Whirlwind, Flurry, Death Wish.', forever: DM('Bloodthirst is trained at 48 in Forever; 51-point pick is ours.') },
      { id: 'prot', name: 'Protection', blurb: 'Shield Slam, Revenge, Sunder: the tank.', forever: DM('Shield Slam is trained at 48 in Forever; 51-point pick is ours.') },
    ],
  },
  // Damage specs for 'dps'; the tank role is Protection.
  specsFor(level, role) {
    const all = this.specs[level] || [];
    return role === 'tank' ? all.filter((s) => s.id === 'prot') : all.filter((s) => s.id !== 'prot');
  },
  rolesFor: (trialId) => (trialId === 't3' || trialId === 't5' ? ['dps', 'tank'] : ['dps']),
  races: () => racesFor('warrior'),
  build(opts) {
    if (opts.npc) return this.npcBuild(opts);
    const race = validRace('warrior', opts.race);
    return applyRace(playerBuild({ ...opts, race }), { classId: 'warrior', race });
  },
  npcBuild({ level, race = 'orc', groupBuffs = [] }) {
    const L = snap(level);
    const key = 'prot' + L;
    const tal = TALENTS[key];
    const gear = GEAR.warriorTank[L];
    const S = deriveStats({ classId: 'warrior', race, level: L, gear: { ...gear, armor: Math.round(gear.armor * (1 + tal.toughness)) }, buffs: buffTotals(groupBuffs, L) });
    // Anticipation: +20 defense = +0.8 % dodge, parry and block.
    const def = tal.anticipation ? 0.008 : 0;
    const stats = { ...S.stats, parry: 0.05 + def, dodge: S.stats.dodge + def, block: 0.05 + (tal.shieldSpec ? 0.05 : 0) + def, blockValue: SHIELD_VALUE[L] + Math.round(S.attrs.str / 20) };
    const [min, max, speed] = WEAPONS.tank1h[L];
    const auras = [{ id: 'warrior.defstance', name: 'Defensive Stance', icon: 'shield', stance: 'defensive', permanent: true, mods: { dmgTaken: { all: 0.9 }, dmgDone: { all: 0.9 * (tal.bastion || 1) }, threat: 1.3 * (tal.defiance || 1) } }];
    const bar = ['warrior.sunder', 'warrior.revenge', 'warrior.shieldblock', 'warrior.hs', 'warrior.cleave', 'warrior.thunderclap', 'warrior.demoshout', 'warrior.taunt', 'warrior.shieldbash', 'warrior.bloodrage', 'warrior.shieldwall', 'warrior.laststand', ...(L >= 60 ? ['warrior.shieldslam'] : [])];
    const tweaks = {};
    const rageOff = (id, n) => { if (n) tweaks[id] = { ...(tweaks[id] || {}), costMultFn: (u, ab) => Math.max(0, (val(ab, ab.cost.rage) - n) / val(ab, ab.cost.rage)) }; };
    rageOff('warrior.sunder', tal.impSunder);
    rageOff('warrior.hs', tal.impHs);
    rageOff('warrior.thunderclap', tal.impTc);
    return {
      template: {
        portrait: 'orc-warrior',
        maxHp: S.maxHp,
        resources: { rage: 100 },
        regen: { hpOOC: S.regen.hpOOC, rageDecay: 1.5 },
        stats,
        armor: S.armor,
        tags: ['humanoid'],
        melee: { min, max, speed, coef: speed / 14 },
        abilities: [...bar],
        auras,
        meta: { talents: tal, spec: 'prot' },
        hooks: { onAvoid: warriorOnAvoid },
      },
      bar,
      tweaks,
    };
  },
};
