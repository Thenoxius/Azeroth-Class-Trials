// Warlock kit — WoW: Forever. Played by NPC casters for now (Destruction with an Affliction
// splash at 30 and 60); becomes a playable kit later. Forever splits Classic's curses into
// Curses and Banes (one of each per Warlock per target); Curse of Agony is now Bane of Agony.
// The demon pet is not modelled yet. Spell ranks: Wowhead datamine, build 1.60.1.70630.
import { registerAbilities } from '../../engine/registry.js';
import { roll, val } from './shared.js';
import { deriveStats, buffTotals, GEAR, WEAPONS } from '../stats.js';

const DM = (note) => ({ status: 'beta-observation', src: 'wh-forever', note });
const T = (u) => (u.meta && u.meta.talents) || {};

// Shadow damage spells go through here: Improved Shadow Bolt, Ruin, Devastation.
function lockHit(ctx, o = {}) {
  const { state, u, t, ab, api } = ctx;
  if (!t || !t.alive) return 0;
  const tal = T(u);
  const destro = ab.destro;
  return api.dealDamage(state, u, t, {
    amount: roll(state, val(ab, o.amount ?? 'dmg')),
    coef: val(ab, 'coef'),
    school: ab.school,
    kind: 'spell',
    ability: ab.id,
    critBonus: destro ? tal.devastation || 0 : 0,
    critMult: destro && tal.ruin ? 2 : undefined,
  });
}

// One Curse and one Bane per Warlock per target.
function setSlot(state, api, u, t, slot, def) {
  for (const a of [...t.auras]) if (a.srcId === u.id && a.def.slot === slot && a.id !== def.id) api.removeAura(state, t, a, 'removed');
  return api.applyAura(state, u, t, { ...def, slot });
}

function lockAfterDamage({ state, u, api, pk, dst, final }) {
  // Improved Shadow Bolt: a Shadow Bolt crit makes the target take 20 % more Shadow damage from you for 12 s.
  if (pk.ability === 'warlock.sb' && pk.crit && final > 0 && T(u).impSb && dst.alive)
    api.applyAura(state, u, dst, {
      id: 'warlock.isb',
      name: 'Improved Shadow Bolt',
      icon: 'bolt',
      school: 'shadow',
      debuff: true,
      duration: 12,
      mods: { dmgTakenMine: { shadow: 1.2 } },
    });
}

registerAbilities({
  'warlock.sb': {
    name: 'Shadow Bolt',
    icon: 'bolt',
    school: 'shadow',
    category: 'filler',
    tags: ['core', 'filler'],
    destro: true,
    desc: 'A bolt of Shadow damage.',
    forever: DM('Datamine: 79–89 at 30, 263–292 at 60 — about 45 % below Classic.'),
    range: 30,
    castTime: 'ct',
    cost: { mana: 'mana' },
    projectile: { speed: 26 },
    effects: [{ type: 'custom', fn: (ctx) => lockHit(ctx) }],
    byLevel: { 30: { dmg: [79, 89], ct: 3, mana: 160, coef: 0.857 }, 60: { dmg: [263, 292], ct: 3, mana: 380, coef: 0.857 } },
  },
  'warlock.corruption': {
    name: 'Corruption',
    icon: 'skull',
    school: 'shadow',
    category: 'dot',
    tags: ['core', 'dot'],
    desc: 'Shadow damage over 18 s.',
    forever: DM('Datamine: 132 over 18 s at 30, 438 at 60; Improved Corruption makes it instant and +10 %.'),
    range: 30,
    castTime: 'ct',
    cost: { mana: 'mana' },
    effects: [
      {
        type: 'custom',
        fn: ({ state, u, t, ab, api }) =>
          api.applyAura(state, u, t, {
            id: 'warlock.corruption',
            name: 'Corruption',
            icon: 'skull',
            school: 'shadow',
            debuff: true,
            duration: 18,
            dispel: 'magic',
            tick: { interval: 3, amount: val(ab, 'tick') * (T(u).impCorruption ? 1.1 : 1), coef: 1 / 6, school: 'shadow' },
          }),
      },
    ],
    byLevel: { 30: { tick: 22, ct: 2, mana: 100 }, 60: { tick: 73, ct: 2, mana: 340 } },
  },
  'warlock.agony': {
    name: 'Bane of Agony',
    icon: 'skull',
    school: 'shadow',
    category: 'dot',
    tags: ['core', 'dot'],
    desc: 'Shadow damage over 24 s that starts slowly and builds up. One Bane per Warlock.',
    forever: DM('Renamed from Curse of Agony; datamine: 168 over 24 s at 30, 552 at 60.'),
    range: 30,
    cost: { mana: 'mana' },
    effects: [
      {
        type: 'custom',
        fn: ({ state, u, t, ab, api }) => {
          const total = val(ab, 'total');
          const a = setSlot(state, api, u, t, 'bane', {
            id: 'warlock.agony',
            name: 'Bane of Agony',
            icon: 'skull',
            school: 'shadow',
            debuff: true,
            duration: 24,
            tick: {
              interval: 2,
              type: 'custom',
              fn: ({ state: st, u: holder, aura, src, api: a2 }) => {
                // Classic ramp: the first four ticks at half, the middle four average, the last four at 1.5×.
                aura.data.n = (aura.data.n || 0) + 1;
                const w = aura.data.n <= 4 ? 0.5 : aura.data.n <= 8 ? 1 : 1.5;
                if (src && src.alive)
                  a2.dealDamage(st, src, holder, {
                    amount: (total / 12) * w,
                    coef: (1 / 12) * w,
                    school: 'shadow',
                    kind: 'dot',
                    ability: 'warlock.agony',
                    isTick: true,
                  });
              },
            },
          });
          if (a) a.data.n = 0;
        },
      },
    ],
    byLevel: { 30: { total: 168, mana: 90 }, 60: { total: 552, mana: 215 } },
  },
  'warlock.cor': {
    name: 'Curse of Recklessness',
    icon: 'skull',
    school: 'shadow',
    category: 'debuff',
    tags: ['debuff'],
    desc: 'Lowers the target’s armor for 2 min. One Curse per Warlock.',
    forever: DM('Datamine: −285 armor at 30, −505 at 60 (Classic −640).'),
    range: 30,
    cost: { mana: 'mana' },
    effects: [
      {
        type: 'custom',
        fn: ({ state, u, t, ab, api }) =>
          setSlot(state, api, u, t, 'curse', {
            id: 'warlock.cor',
            name: 'Curse of Recklessness',
            icon: 'skull',
            school: 'shadow',
            debuff: true,
            duration: 120,
            dispel: 'curse',
            mods: { statAdd: { armor: -val(ab, 'armor') } },
          }),
      },
    ],
    byLevel: { 30: { armor: 285, mana: 60 }, 60: { armor: 505, mana: 115 } },
  },
  'warlock.coe': {
    name: 'Curse of the Elements',
    icon: 'skull',
    school: 'shadow',
    category: 'debuff',
    tags: ['debuff'],
    desc: 'The target takes more magic damage and has lower resistances for 5 min. One Curse per Warlock.',
    forever: DM('Datamine: learned at 30 (Classic 46); −45 resistances and +6 % magic damage at 30, −75 and +10 % at 60.'),
    range: 30,
    cost: { mana: 'mana' },
    effects: [
      {
        type: 'custom',
        fn: ({ state, u, t, ab, api }) => {
          const m = val(ab, 'mult');
          setSlot(state, api, u, t, 'curse', {
            id: 'warlock.coe',
            name: 'Curse of the Elements',
            icon: 'skull',
            school: 'shadow',
            debuff: true,
            duration: 300,
            dispel: 'curse',
            mods: { dmgTaken: { fire: m, frost: m, arcane: m, nature: m, shadow: m, holy: m }, statAdd: { resist: -val(ab, 'res') } },
          });
        },
      },
    ],
    byLevel: { 30: { mult: 1.06, res: 45, mana: 100 }, 60: { mult: 1.1, res: 75, mana: 200 } },
  },
  'warlock.immolate': {
    name: 'Immolate',
    icon: 'flame',
    school: 'fire',
    category: 'dot',
    tags: ['dot'],
    destro: true,
    desc: 'Fire damage now and more over 15 s.',
    forever: DM('Datamine: 63.5 + 95 over 15 s at 30, 169.5 + 275 at 60.'),
    range: 30,
    castTime: 'ct',
    cost: { mana: 'mana' },
    effects: [
      {
        type: 'custom',
        fn: (ctx) => {
          lockHit(ctx);
          if (ctx.t.alive)
            ctx.api.applyAura(ctx.state, ctx.u, ctx.t, {
              id: 'warlock.immolate',
              name: 'Immolate',
              icon: 'flame',
              school: 'fire',
              debuff: true,
              duration: 15,
              dispel: 'magic',
              tick: { interval: 3, amount: val(ctx.ab, 'tick'), coef: 0.13, school: 'fire' },
            });
        },
      },
    ],
    byLevel: { 30: { dmg: [63.5, 63.5], tick: 19, ct: 2, mana: 155, coef: 0.2 }, 60: { dmg: [169.5, 169.5], tick: 55, ct: 2, mana: 380, coef: 0.2 } },
  },
  'warlock.lifetap': {
    name: 'Life Tap',
    icon: 'devour',
    school: 'shadow',
    category: 'resource',
    tags: ['resource'],
    target: 'self',
    desc: 'Turns health into the same amount of mana (more with Spirit).',
    forever: DM('Datamine: 140 + Spirit at 30, 430 + Spirit at 60.'),
    effects: [
      {
        type: 'custom',
        fn: ({ u, ab }) => {
          const amt = val(ab, 'base') + (u.stats.spi || 0);
          u.hp = Math.max(1, u.hp - amt);
          if (u.res.mana) u.res.mana.cur = Math.min(u.res.mana.max, u.res.mana.cur + amt * (T(u).impLifeTap ? 1.2 : 1));
        },
      },
    ],
    byLevel: { 30: { base: 140 }, 60: { base: 430 } },
  },
});

// Destruction with an Affliction splash: Bane, Improved Shadow Bolt, Devastation, Ruin, plus
// Suppression and Improved Corruption (21 points at 30, 20/0/31 at 60).
const TALENTS = {
  destro30: { bane: 0.5, impSb: true, cataclysm: 0.95, devastation: 0.05, suppression: 0.05 },
  destro60: {
    bane: 0.5,
    impSb: true,
    cataclysm: 0.95,
    devastation: 0.05,
    ruin: true,
    suppression: 0.05,
    impCorruption: true,
    impLifeTap: true,
    emberstorm: 1.1,
  },
};

const snap = (level) => (level >= 45 ? 60 : 30);

export const KIT = {
  id: 'warlock',
  name: 'Warlock',
  color: '#8788EE',
  resource: 'mana',
  race: 'Undead',
  portrait: 'undead-warlock',
  npcOnly: true,
  specs: { 30: [{ id: 'destro', name: 'Destruction' }], 60: [{ id: 'destro', name: 'Destruction' }] },
  build({ level, race = 'undead', groupBuffs = [] }) {
    const L = snap(level);
    const tal = TALENTS['destro' + L];
    // Demon Armor on yourself (datamined: +300 armor at 30, +570 at 60).
    const S = deriveStats({ classId: 'warlock', race, level: L, gear: GEAR.warlock[L], buffs: buffTotals([...groupBuffs, 'demonArmor'], L) });
    const stats = { ...S.stats };
    const [wMin, wMax, wSpeed] = WEAPONS.wand[L];
    const tweaks = {
      'warlock.sb': { ct: 3 - tal.bane, costMultFn: () => tal.cataclysm },
      'warlock.immolate': { ct: 2 - tal.bane, costMultFn: () => tal.cataclysm },
    };
    if (tal.impCorruption) tweaks['warlock.corruption'] = { ct: 0 };
    const auras = [
      { id: 'warlock.t.suppression', name: 'Suppression', hidden: true, permanent: true, mods: { spellHit: { shadow: tal.suppression }, threat: 0.8 } },
    ];
    if (tal.emberstorm) auras.push({ id: 'warlock.t.ember', name: 'Emberstorm', hidden: true, permanent: true, mods: { dmgDone: { fire: tal.emberstorm } } });
    const bar = ['warlock.sb', 'warlock.corruption', 'warlock.agony', 'warlock.immolate', 'warlock.cor', 'warlock.coe', 'warlock.lifetap'];
    return {
      template: {
        portrait: 'undead-warlock',
        maxHp: S.maxHp,
        resources: { mana: S.mana },
        regen: { ...S.regen },
        stats,
        armor: S.armor,
        tags: ['undead', 'humanoid'],
        ranged: { kind: 'wand', min: wMin, max: wMax, speed: wSpeed, range: 30, windup: 0.5, school: 'shadow', visual: 'shadow' },
        abilities: [...bar],
        auras,
        meta: { talents: tal, spec: 'destro' },
        hooks: { afterDamage: lockAfterDamage },
      },
      bar,
      tweaks,
    };
  },
};
