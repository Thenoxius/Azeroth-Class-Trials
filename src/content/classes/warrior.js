// Warrior kit — WoW: Forever. For now the NPC tanks of the dungeon party and the raid play it
// (Protection at 30 and 60); it becomes a playable kit later. Rage comes from damage dealt and
// taken (Classic 1.12 formula, src/engine/core.js), blocks need a shield. Spell ranks are the
// datamined Forever values (Wowhead, live build 1.60.1.70630, read 2026-10-27). Forever's
// tooltips give no threat numbers; the flat threat values below are Classic's.
import { registerAbilities } from '../../engine/registry.js';
import { roll, val, addStacks } from './shared.js';
import { deriveStats, buffTotals, GEAR, WEAPONS } from '../stats.js';

const DM = (note) => ({ status: 'beta-observation', src: 'wh-forever', note });
const T = (u) => (u.meta && u.meta.talents) || {};
const REVENGE_READY = { id: 'warrior.revenge.ready', name: 'Revenge ready', icon: 'shield', duration: 5 };

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
    byLevel: { 30: { rage: 15, armorPer: 180, thr: 140 }, 60: { rage: 15, armorPer: 450, thr: 261 } },
  },
  'warrior.revenge': {
    name: 'Revenge', icon: 'shield', school: 'physical', mechanic: 'physical', category: 'damage', tags: ['core', 'threat'], range: 5,
    desc: 'Usable for 5 s after you block, dodge or parry: a counterattack with a high amount of threat.',
    forever: DM('Datamine: 31–37 at 30, 138–168 at 60 (about 70 % more than Classic). Threat value is Classic’s.'),
    cooldown: 5, cost: { rage: 'rage' },
    canUse: ({ u }) => (u.auras.some((a) => a.id === REVENGE_READY.id) ? true : 'custom:Only after a block, dodge or parry'),
    effects: [{ type: 'custom', fn: (ctx) => { ctx.api.removeAuraById(ctx.state, ctx.u, REVENGE_READY.id); strike(ctx, { mult: 1 + (T(ctx.u).impRevenge || 0) }); } }],
    byLevel: { 30: { rage: 5, dmg: [31, 37], thr: 195 }, 60: { rage: 5, dmg: [138, 168], thr: 355 } },
  },
  'warrior.shieldblock': {
    name: 'Shield Block', icon: 'shield-wall', school: 'physical', mechanic: 'physical', category: 'defensive', tags: ['defensive'], target: 'self', gcd: 0,
    desc: '+75 % chance to block for 7 s, up to 2 blocks.',
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
    byLevel: { 30: { rage: 15, dmg: [44, 44], thr: 80 }, 60: { rage: 15, dmg: [157, 157], thr: 175 } },
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
    byLevel: { 30: { rage: 20, dmg: [37, 37], dur: 18 }, 60: { rage: 20, dmg: [103, 103], dur: 30 } },
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
    desc: 'Forces the target to attack you for 3 s and matches the top threat on it.',
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

// Protection builds (21 points at 30, 31/5/15 at 60), from the Forever talent tree.
const TALENTS = {
  prot30: { shieldSpec: true, anticipation: true, toughness: 0.1, impRevenge: 0.6, defiance: 1.15, impShieldBlock: true, lastStand: true, masterOfDefense: true, impSunder: 3 },
  prot60: { shieldSpec: true, anticipation: true, toughness: 0.1, impRevenge: 0.6, defiance: 1.15, impShieldBlock: true, lastStand: true, masterOfDefense: true, impSunder: 3, bastion: 1.1, impShieldWall: true, impHs: 3, impTc: 6 },
};
// Shield block value (shield + Strength / 20) on typical shields of the level.
const SHIELD_VALUE = { 30: 22, 60: 55 };

const snap = (level) => (level >= 45 ? 60 : 30);

export const KIT = {
  id: 'warrior',
  name: 'Warrior',
  color: '#C69B6D',
  resource: 'rage',
  race: 'Orc',
  portrait: 'orc-warrior',
  npcOnly: true,
  specs: { 30: [{ id: 'prot', name: 'Protection' }], 60: [{ id: 'prot', name: 'Protection' }] },
  build({ level, race = 'orc', groupBuffs = [] }) {
    const L = snap(level);
    const key = 'prot' + L;
    const tal = TALENTS[key];
    const gear = GEAR.warriorTank[L];
    const S = deriveStats({ classId: 'warrior', race, level: L, gear: { ...gear, armor: Math.round(gear.armor * (1 + tal.toughness)) }, buffs: buffTotals(groupBuffs, L) });
    // Anticipation: +20 defense = +0.8 % dodge, parry and block.
    const def = tal.anticipation ? 0.008 : 0;
    const stats = { ...S.stats, parry: 0.05 + def, dodge: S.stats.dodge + def, block: 0.05 + (tal.shieldSpec ? 0.05 : 0) + def, blockValue: SHIELD_VALUE[L] + Math.round(S.attrs.str / 20) };
    const [min, max, speed] = WEAPONS.tank1h[L];
    const auras = [{ id: 'warrior.defstance', name: 'Defensive Stance', icon: 'shield', permanent: true, mods: { dmgTaken: { all: 0.9 }, dmgDone: { all: 0.9 * (tal.bastion || 1) }, threat: 1.3 * (tal.defiance || 1) } }];
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
