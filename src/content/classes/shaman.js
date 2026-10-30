// Shaman: playable hybrid kit and existing NPC Restoration kit.
import { playerTalents, TALENT_TEXT } from './shaman-builds.js';
import SOURCE_RANKS from '../data/shaman-ranks.js';
import { getAbility, registerAbilities } from '../../engine/registry.js';
import { roll, val } from './shared.js';
import { applyRace, validRace } from '../races.js';
import { BASE } from '../data/classic-tables.js';
import { activeTotems, summonTotem, recallTotems, projectTotems } from './shaman-totems.js';
import * as G from '../../engine/geometry.js';
import { deriveStats, buffTotals, GEAR, WEAPONS } from '../stats.js';

const DM = (note) => ({ status: 'beta-observation', src: 'wh-forever', note });
const CLASSIC = (note) => ({ status: 'classic-baseline', note });
const T = (u) => (u.meta && u.meta.talents) || {};

function shamanHeal(ctx, o = {}) {
  const { state, u, t, ab, api } = ctx;
  if (!t || !t.alive) return 0;
  const tal = T(u);
  const mult = (o.mult || 1) * (tal.purification || 1) * (ab.id === 'shaman.hw' && tal.healingWay ? 1.25 : 1);
  return api.healUnit(state, u, t, { amount: roll(state, val(ab, o.amount ?? 'heal')) * mult, coef: val(ab, 'coef') * mult, ability: ab.id });
}

registerAbilities({
  'shaman.hw': {
    name: 'Healing Wave',
    icon: 'heal',
    school: 'nature',
    category: 'heal',
    tags: ['heal', 'core'],
    target: 'ally',
    desc: 'A big, slow heal.',
    forever: DM('Datamine: 329–382 at 30 (rank 5), 1535–1750 at 60 (rank 10); Healing Way adds a flat 25 %.'),
    range: 40,
    castTime: 'ct',
    cost: { mana: 'mana' },
    effects: [{ type: 'custom', fn: (ctx) => shamanHeal(ctx) }],
    byLevel: {
      10: { heal: [69, 83], ct: 2, mana: 45, coef: 0.286 },
      30: { heal: [329, 382], ct: 3, mana: 200, coef: 0.857 },
      60: { heal: [1535, 1750], ct: 3, mana: 620, coef: 0.857 },
    },
  },
  'shaman.lhw': {
    name: 'Lesser Healing Wave',
    icon: 'flash-heal',
    school: 'nature',
    category: 'heal',
    tags: ['heal'],
    target: 'ally',
    desc: 'A fast 1.5 s heal for emergencies.',
    forever: DM('Datamine: 220–249 at 30, 796–886 at 60.'),
    range: 40,
    castTime: 1.5,
    cost: { mana: 'mana' },
    effects: [{ type: 'custom', fn: (ctx) => shamanHeal(ctx) }],
    byLevel: { 30: { heal: [220, 249], mana: 145, coef: 0.429 }, 60: { heal: [796, 886], mana: 380, coef: 0.429 } },
  },
  'shaman.ch': {
    name: 'Chain Heal',
    icon: 'heal',
    school: 'nature',
    category: 'heal',
    tags: ['heal', 'aoe'],
    target: 'ally',
    desc: 'Heals the target, then jumps to two more hurt party members at 50 % and 25 %.',
    forever: DM('Datamine: rank 3 (level 54) heals 474–539, three targets, each jump half as strong.'),
    range: 40,
    castTime: 2.5,
    cost: { mana: 'mana' },
    effects: [
      {
        type: 'custom',
        fn: (ctx) => {
          const { state, u, t, api } = ctx;
          const riptideBonus = t.auras.some((a) => a.id === 'shaman.riptide' && a.srcId === u.id) ? 1.25 : 1;
          shamanHeal(ctx, { mult: riptideBonus });
          const done = new Set([t.id]);
          let from = t,
            mult = 0.5;
          for (let i = 0; i < 2; i++) {
            const next = api
              .alliesOf(state, u, (a) => !done.has(a.id) && a.hp < a.maxHp && Math.hypot(a.x - from.x, a.y - from.y) <= 12)
              .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
            if (!next) break;
            shamanHeal({ ...ctx, t: next }, { mult: mult * riptideBonus });
            done.add(next.id);
            from = next;
            mult /= 2;
          }
        },
      },
    ],
    byLevel: { 60: { heal: [474, 539], mana: 405, coef: 0.714 } },
  },
  'shaman.riptide': {
    name: 'Riptide',
    icon: 'renew',
    school: 'nature',
    category: 'heal',
    tags: ['heal'],
    target: 'ally',
    desc: 'An instant heal plus a heal over 15 s.',
    forever: DM('New Restoration capstone; datamine rank 3 at 60: 838–922 plus 953 over 15 s, 6 s cooldown.'),
    range: 40,
    cooldown: 6,
    cost: { mana: 'mana' },
    effects: [
      {
        type: 'custom',
        fn: (ctx) => {
          shamanHeal(ctx);
          if (ctx.t.alive)
            ctx.api.applyAura(ctx.state, ctx.u, ctx.t, {
              id: 'shaman.riptide',
              name: 'Riptide',
              icon: 'renew',
              school: 'nature',
              duration: 15,
              tick: { interval: 3, type: 'heal', amount: (val(ctx.ab, 'hot') / 5) * (T(ctx.u).purification || 1), coef: 0.1 * (T(ctx.u).purification || 1) },
            });
        },
      },
    ],
    byLevel: { 60: { heal: [838, 922], hot: 953, mana: 385, coef: 0.214 } },
  },
  'shaman.es': {
    name: 'Earth Shock',
    icon: 'nova',
    school: 'nature',
    category: 'interrupt',
    tags: ['interrupt'],
    desc: 'Instant Nature damage that interrupts spellcasting (2 s lockout). High threat.',
    forever: DM('Datamine: 84–89 at 30, 303–318 at 60, 6 s cooldown.'),
    range: 20,
    cooldown: 6,
    cost: { mana: 'mana' },
    effects: [
      { type: 'damage', amount: 'dmg', coef: 0.386, threat: 2 },
      { type: 'interrupt', lockout: 2 },
    ],
    byLevel: { 10: { dmg: [36, 38], mana: 50 }, 30: { dmg: [84, 89], mana: 145 }, 60: { dmg: [303, 318], mana: 450 } },
  },
  'shaman.ns': {
    name: 'Nature’s Swiftness',
    icon: 'hourglass',
    school: 'nature',
    category: 'cooldown',
    tags: ['cooldown'],
    target: 'self',
    gcd: 0,
    desc: 'Your next Nature spell is instant.',
    forever: CLASSIC('Restoration talent; Classic 3 min cooldown used.'),
    cooldown: 180,
    effects: [
      { type: 'aura', to: 'self', aura: { id: 'shaman.ns', name: 'Nature’s Swiftness', icon: 'hourglass', duration: 30, mods: { castTime: { nature: 0 } } } },
    ],
  },
  'shaman.manatide': {
    name: 'Mana Tide Totem',
    icon: 'mana-gem',
    school: 'nature',
    category: 'resource',
    tags: ['resource'],
    target: 'self',
    desc: 'Restores mana to your group every 3 s for 12 s.',
    forever: DM('Datamine: 290 mana every 3 s (rank 4, level 58), 5 min cooldown.'),
    cooldown: 300,
    cost: { mana: 'mana' },
    effects: [
      {
        type: 'aura',
        aoe: { center: 'self', radius: 30, affects: 'allies' },
        aura: { id: 'shaman.manatide', name: 'Mana Tide', icon: 'mana-gem', duration: 12, tick: { interval: 3, type: 'mana', amount: 'tide' } },
      },
    ],
    byLevel: { 30: { mana: 20, tide: 88 }, 60: { mana: 60, tide: 290 } },
  },
});

// Nature's Swiftness is spent by the next Nature spell with a cast time.
function shamanOnCast({ state, u, api, ab }) {
  if (ab && ab.school === 'nature' && ab.castTime && api.findAura(u, 'shaman.ns') && ab.id !== 'shaman.ns') api.removeAuraById(state, u, 'shaman.ns');
}

// Restoration (21 points at 30, 5/15/31 at 60).
const TALENTS = {
  resto30: { impHw: 0.5, tidalFocus: 0.95, mindfulness: 0.5, healingFocus: 0.7, tidalMastery: 0.05, ns: true },
  resto60: {
    impHw: 0.5,
    tidalFocus: 0.95,
    mindfulness: 0.5,
    healingFocus: 0.7,
    tidalMastery: 0.05,
    ns: true,
    healingWay: true,
    purification: 1.1,
    manaTide: true,
    riptide: true,
  },
};

const snap = (level) => (level >= 45 ? 60 : 30);

const SPECS = [
  { id: 'elemental', name: 'Elemental', blurb: 'Lightning, Flame Shock and Lava Burst; ranged damage.' },
  { id: 'enhancement', name: 'Enhancement', blurb: 'Two-handed weapon attacks, Stormstrike and Maelstrom.' },
  { id: 'resto', name: 'Restoration', blurb: 'Healing Wave, Chain Heal and healing cooldowns.' },
];
export const KIT = {
  id: 'shaman',
  name: 'Shaman',
  color: '#0070DD',
  resource: 'mana',
  race: 'Orc',
  portrait: 'orc-shaman',
  tagline: 'Lightning, weapon strikes, healing and four elemental totems.',
  fantasy: 'A hybrid who chooses between spellcasting, weapon attacks and healing, and places totems where allies can use them.',
  strengthsSummary: 'Ranged or melee damage, healing, interrupts and adaptable totem support.',
  risksSummary: 'Mana, totem range and positioning constrain every role. Numeric tuning includes documented estimates.',
  supportedLevels: [10, 30, 60],
  rolesFor: () => ['dps', 'healer'],
  races: () => ['orc'],
  specsFor: (level, role) => (level < 20 ? [] : SPECS.filter((s) => !role || (role === 'healer' ? s.id === 'resto' : s.id !== 'resto'))),
  specs: { 30: SPECS, 60: SPECS },
  build(opts) {
    if (opts.npc) return this.npcBuild(opts);
    const race = validRace('shaman', opts.race);
    return applyRace(playerBuild({ ...opts, race }), { classId: 'shaman', race });
  },
  npcBuild({ level, race = 'orc', groupBuffs = [] }) {
    const L = snap(level);
    const tal = TALENTS['resto' + L];
    const S = deriveStats({ classId: 'shaman', race, level: L, gear: GEAR.shamanHealer[L], buffs: buffTotals(groupBuffs, L) });
    const stats = { ...S.stats, block: 0.05, blockValue: 20 };
    const [min, max, speed] = WEAPONS.casterMace[L];
    const heals = ['shaman.hw', 'shaman.lhw', 'shaman.ch', 'shaman.riptide'];
    const tweaks = { 'shaman.hw': { ct: 3 - tal.impHw } };
    for (const id of heals) tweaks[id] = { ...(tweaks[id] || {}), costMultFn: () => tal.tidalFocus };
    const auras = [
      {
        id: 'shaman.t.mind',
        name: 'Mindfulness',
        hidden: true,
        permanent: true,
        mods: { castRegen: tal.mindfulness, pushbackResist: { nature: tal.healingFocus }, healCrit: tal.tidalMastery },
      },
    ];
    const bar = ['shaman.hw', 'shaman.lhw', 'shaman.es', 'shaman.ns', ...(L >= 60 ? ['shaman.ch', 'shaman.riptide', 'shaman.manatide'] : [])];
    return {
      template: {
        portrait: 'orc-shaman',
        maxHp: S.maxHp,
        resources: { mana: S.mana },
        regen: { ...S.regen },
        stats,
        armor: S.armor,
        tags: ['humanoid'],
        melee: { min, max, speed, coef: speed / 14 },
        abilities: [...bar],
        auras,
        meta: { talents: tal, spec: 'resto' },
        hooks: { onCast: shamanOnCast },
      },
      bar,
      tweaks,
    };
  },
};

// Rank fields come from the saved Forever exports. Coefficients and unspecified proc
// parameters remain separately labelled assumptions; no DPS correction factors are used.
const APPROX = (note) => ({ status: 'approximation', src: 'bz-devnotes', note: 'Official mechanics; rank damage/cost and proc tuning estimated. ' + note });
const SHOCKS = ['shaman.es', 'shaman.fs', 'shaman.fr'];
function spellDamage(ctx, scale = 1) {
  const { state, u, t, api, ab } = ctx;
  if (!t?.alive) return;
  let mult = scale;
  const tal = T(u);
  if (['shaman.lb', 'shaman.cl', 'shaman.es'].includes(ab.id)) mult *= tal.concussion || 1;
  if (['shaman.fs', 'shaman.lava'].includes(ab.id)) mult *= tal.callFlame || 1;
  const mark = api.findAura(t, 'shaman.stormstrike', u.id);
  if (mark && ['shaman.lb', 'shaman.cl', 'shaman.es'].includes(ab.id)) mult *= 1.2;
  const n = api.dealDamage(state, u, t, {
    amount: roll(state, ab.dmg) * mult,
    coef: (ab.coef || 0) * mult,
    threat: ctx.overload ? 0 : 1,
    school: ab.school,
    ability: ab.id,
    critMult: T(u).fury ? 2 : 1.5,
  });
  // Consumption is handled by afterDamage, so fully absorbed hits also count.
  return n;
}
const totem = (name, element, byLevel, def) => ({
  name,
  icon: 'shield',
  school: 'nature',
  category: 'totem',
  tags: ['totem', 'utility'],
  target: 'self',
  gcd: 1,
  cost: { mana: 'mana' },
  byLevel,
  forever: APPROX('One totem per element. Persistent buffs last 5 minutes; a 1 s global cooldown is official.'),
  desc: 'Places ' + name + '. Replaces your ' + element + ' totem. Effects require range; rank values are shown in the source note.',
  effects: [{ type: 'custom', fn: (ctx) => summonTotem(ctx, { element, ...def, root: def.slow && T(ctx.u).earthbound }) }],
});
registerAbilities({
  'shaman.attack': {
    name: 'Attack',
    icon: 'axe',
    school: 'physical',
    mechanic: 'physical',
    category: 'filler',
    tags: ['melee'],
    toggle: 'melee',
    gcd: 0,
    forever: CLASSIC('Weapon swings; estimated weapon profile.'),
    desc: 'Toggle melee auto-attacks.',
  },
  'shaman.lb': {
    name: 'Lightning Bolt',
    icon: 'lightning',
    school: 'nature',
    category: 'filler',
    tags: ['core', 'damage'],
    range: 30,
    castTime: 'ct',
    cost: { mana: 'mana' },
    forever: APPROX('Ranks 4+ have 2.5 s base cast time with reduced coefficient, as confirmed by Blizzard.'),
    desc: 'Nature damage. Elemental talents shorten the cast; Maelstrom charges reduce it for Enhancement.',
    byLevel: {
      10: { dmg: [26, 29], mana: 30, ct: 2, coef: 0.571 },
      30: { dmg: [79, 90], mana: 85, ct: 2.5, coef: 0.714 },
      60: { dmg: [191, 213], mana: 220, ct: 2.5, coef: 0.714 },
    },
    effects: [
      {
        type: 'custom',
        fn: (c) => {
          spellDamage(c);
          if (T(c.u).overload && c.state.rng() < T(c.u).overload) spellDamage({ ...c, overload: true }, 0.5);
        },
      },
    ],
  },
  'shaman.cl': {
    name: 'Chain Lightning',
    icon: 'lightning',
    school: 'nature',
    category: 'aoe',
    tags: ['damage', 'aoe'],
    range: 30,
    castTime: 2,
    cooldown: 6,
    cost: { mana: 'mana' },
    forever: APPROX('2 s base cast confirmed. Oct 16 costs reduced ~35%; these costs are provisional.'),
    desc: 'Lightning jumps to two more nearby enemies, losing 30% damage each jump. Avoid breaking control.',
    byLevel: { 32: { dmg: [85, 97], mana: 145, coef: 0.571 }, 60: { dmg: [120, 134], mana: 315, coef: 0.571 } },
    effects: [{ type: 'custom', fn: chainLightning }],
  },
  'shaman.fs': {
    name: 'Flame Shock',
    icon: 'flame',
    school: 'fire',
    category: 'dot',
    tags: ['damage', 'dot'],
    range: 20,
    cooldown: 6,
    cost: { mana: 'mana' },
    forever: APPROX('Shares the Shock cooldown. Call of Flame extends duration at 30+ Elemental.'),
    desc: 'Fire damage followed by a burn. Shares a cooldown with Earth Shock and Frost Shock.',
    byLevel: { 10: { dmg: [24, 24], dot: 28, mana: 55 }, 30: { dmg: [49, 49], dot: 56, mana: 160 }, 60: { dmg: [181, 181], dot: 176, mana: 410 } },
    effects: [
      {
        type: 'custom',
        fn: (c) => {
          if (!spellDamage(c)) return;
          c.api.applyAura(c.state, c.u, c.t, {
            id: 'shaman.fs',
            name: 'Flame Shock',
            icon: 'flame',
            school: 'fire',
            debuff: true,
            duration: 12 + (T(c.u).flameDuration || 0),
            tick: { interval: 3, type: 'damage', amount: (c.ab.dot / 4) * (T(c.u).callFlame || 1), coef: 0.1 * (T(c.u).callFlame || 1) },
            dispel: 'magic',
          });
        },
      },
    ],
  },
  'shaman.fr': {
    name: 'Frost Shock',
    icon: 'frost',
    school: 'frost',
    category: 'control',
    tags: ['damage', 'slow'],
    range: 20,
    cooldown: 6,
    cost: { mana: 'mana' },
    forever: APPROX('Classic rank placeholder; shares Shock cooldown.'),
    desc: 'Frost damage and a 50% slow for 8 s.',
    byLevel: { 30: { dmg: [68, 73], mana: 115, coef: 0.386 }, 60: { dmg: [284, 300], mana: 430, coef: 0.386 } },
    effects: [
      {
        type: 'custom',
        fn: (c) => {
          if (spellDamage(c))
            c.api.applyAura(c.state, c.u, c.t, {
              id: 'shaman.fr',
              name: 'Frost Shock',
              icon: 'frost',
              school: 'frost',
              debuff: true,
              duration: 8,
              mods: { slow: 0.5 },
              dispel: 'magic',
            });
        },
      },
    ],
  },
  'shaman.lava': {
    name: 'Lava Burst',
    icon: 'flame',
    school: 'fire',
    category: 'damage',
    tags: ['damage'],
    range: 30,
    castTime: 2.5,
    cooldown: 10,
    cost: { mana: 'mana' },
    forever: APPROX('Now 21-point talent. Official: +20% damage with own Flame Shock; rank 1/2 raised Oct 26.'),
    desc: 'Fire damage, increased by 20% if your Flame Shock is on the target.',
    byLevel: { 30: { dmg: [114, 145], mana: 135, coef: 0.714 }, 60: { dmg: [203, 258], mana: 265, coef: 0.714 } },
    effects: [{ type: 'custom', fn: (c) => spellDamage(c, c.api.findAura(c.t, 'shaman.fs', c.u.id) ? 1.2 : 1) }],
  },
  'shaman.stormstrike': {
    name: 'Stormstrike',
    icon: 'axe',
    school: 'physical',
    mechanic: 'physical',
    category: 'damage',
    tags: ['damage', 'melee'],
    range: 5,
    startsMelee: true,
    cooldown: 8,
    cost: { mana: 'mana' },
    forever: APPROX('Oct 16: 8% BASE mana; 8 s cooldown. Own next successful Bolt, Chain or Earth Shock is amplified 20%.'),
    desc: 'Instant weapon strike. Your next Lightning Bolt, Chain Lightning or Earth Shock deals 20% more damage.',
    effects: [
      {
        type: 'custom',
        fn: (c) => {
          const w = c.u.melee;
          if (T(c.u).improvedStormstrike)
            c.api.applyAura(c.state, c.u, c.u, {
              id: 'shaman.storm.regen',
              name: 'Improved Stormstrike',
              icon: 'mana-gem',
              duration: 15,
              mods: { castRegen: 0.5 },
            });
          const n = c.api.dealDamage(c.state, c.u, c.t, {
            amount: roll(c.state, [w.min, w.max]),
            coef: w.speed / 14,
            kind: 'melee',
            school: 'physical',
            ability: c.ab.id,
          });
          if (n > 0) c.api.applyAura(c.state, c.u, c.t, { id: 'shaman.stormstrike', name: 'Stormstrike', icon: 'axe', duration: 12, debuff: true });
        },
      },
    ],
  },
  'shaman.em': {
    name: 'Elemental Mastery',
    icon: 'hourglass',
    school: 'nature',
    category: 'cooldown',
    tags: ['cooldown', 'burst'],
    target: 'self',
    gcd: 0,
    cooldown: 180,
    forever: { status: 'confirmed-official', src: 'bz-devnotes', note: 'Oct 16: 15 s, Bolt/Lava cast -0.5 s; Chain Lightning no cooldown; 3 min CD.' },
    desc: 'For 15 s, Lightning Bolt and Lava Burst cast 0.5 s faster and Chain Lightning has no cooldown.',
    effects: [
      {
        type: 'aura',
        to: 'self',
        aura: { id: 'shaman.em', name: 'Elemental Mastery', icon: 'hourglass', duration: 15, mods: { cooldown: { 'shaman.cl': 0 } } },
      },
    ],
  },
  'shaman.rage': {
    name: 'Rage of the Farseer',
    icon: 'axe',
    school: 'nature',
    category: 'cooldown',
    tags: ['cooldown', 'burst'],
    target: 'self',
    gcd: 0,
    cooldown: 180,
    forever: { status: 'confirmed-official', src: 'bz-devnotes', note: 'Personal melee haste 30% for 25 s; Oct 26 removed spell casting speed.' },
    desc: 'Increases your melee attack speed by 30% for 25 s.',
    effects: [{ type: 'aura', to: 'self', aura: { id: 'shaman.rage', name: 'Rage of the Farseer', icon: 'axe', duration: 25, mods: { meleeHaste: 0.3 } } }],
  },
  'shaman.strength': totem('Strength of Earth Totem', 'earth', { 10: { mana: 25 }, 30: { mana: 65 }, 60: { mana: 275 } }, { buff: 'strengthOfEarth' }),
  'shaman.earthbind': totem('Earthbind Totem', 'earth', { 10: { mana: 20 }, 30: { mana: 35 }, 60: { mana: 50 } }, { duration: 45, slow: true }),
  'shaman.searing': totem(
    'Searing Totem',
    'fire',
    { 10: { mana: 25 }, 30: { mana: 75 }, 60: { mana: 170 } },
    { duration: 60, damage: { 10: 5, 30: 18, 60: 45 } },
  ),
  'shaman.spring': totem('Mana Spring Totem', 'water', { 30: { mana: 40 }, 60: { mana: 100 } }, { buff: 'manaSpring', mana: { 30: 4, 60: 10 } }),
  'shaman.stream': totem('Healing Stream Totem', 'water', { 30: { mana: 50 }, 60: { mana: 80 } }, { heal: { 30: 6, 60: 11 } }),
  'shaman.grace': totem('Grace of Air Totem', 'air', { 60: { mana: 310 } }, { buff: 'graceOfAir' }),
  'shaman.nova': {
    name: 'Fire Nova',
    icon: 'flame',
    school: 'fire',
    category: 'aoe',
    tags: ['damage', 'aoe'],
    target: 'self',
    cooldown: 10,
    cost: { mana: 'mana' },
    forever: APPROX('Official: triggers at existing Fire totem without replacing it; coefficient .143 after Oct 16.'),
    desc: 'An eruption at your Fire totem hits enemies within 10 yards. Requires an active Fire totem.',
    byLevel: { 30: { dmg: [54, 62], mana: 120 }, 60: { dmg: [232, 259], mana: 375 } },
    canUse: ({ state, u }) => activeTotems(state, u).some((t) => t.meta.element === 'fire' && G.dist(t, u) <= 30) || 'custom:Place a Fire totem first',
    effects: [
      {
        type: 'custom',
        fn: (c) => {
          const f = activeTotems(c.state, c.u).find((t) => t.meta.element === 'fire');
          if (f)
            for (const t of c.api.enemiesOf(c.state, c.u, (e) => G.dist(e, f) <= 10))
              c.api.dealDamage(c.state, c.u, t, { amount: roll(c.state, c.ab.dmg), coef: 0.143, school: 'fire', ability: c.ab.id });
        },
      },
    ],
  },
  'shaman.recall': {
    name: 'Totemic Recall',
    icon: 'hourglass',
    school: 'nature',
    category: 'utility',
    tags: ['totem', 'utility'],
    target: 'self',
    gcd: 0,
    forever: { status: 'confirmed-official', src: 'bz-devnotes', note: 'Recall learned at 20; returns 25% of totem costs. Refund bug fixed Oct 1.' },
    desc: 'Dismiss your totems and regain 25% of their actual mana cost.',
    effects: [{ type: 'custom', fn: recallTotems }],
  },
  'shaman.projection': {
    name: 'Totemic Projection',
    icon: 'blink',
    school: 'nature',
    category: 'utility',
    tags: ['totem', 'utility'],
    target: 'point',
    range: 30,
    cooldown: 60,
    cost: { mana: 'mana' },
    forever: { status: 'confirmed-official', src: 'bz-devnotes', note: 'Level 22. Teleport totems within 30 yd; 1 min CD, 25% BASE mana.' },
    desc: 'Move your existing totems to the chosen ground location within 30 yards.',
    effects: [{ type: 'custom', fn: projectTotems }],
  },
  'shaman.cleanse': {
    name: 'Cure Poison',
    icon: 'dispel',
    school: 'nature',
    category: 'dispel',
    tags: ['dispel', 'optional-utility'],
    target: 'ally',
    range: 30,
    cost: { mana: 'mana' },
    byLevel: { 30: { mana: 50 }, 60: { mana: 100 } },
    forever: CLASSIC('Classic baseline cost estimate.'),
    desc: 'Removes one Poison from a friendly target.',
    effects: [{ type: 'dispel', types: ['poison'], count: 1, which: 'debuff' }],
  },
});
function playerCast({ state, u, api, ab }) {
  shamanOnCast({ state, u, api, ab });
  if (SHOCKS.includes(ab.id))
    for (const id of SHOCKS)
      if (u.ab[id]) {
        u.cds[id] = 6;
        u.cdTotal[id] = 6;
      }
  const damageSpell = ['shaman.lb', 'shaman.cl', 'shaman.lava', ...SHOCKS, 'shaman.nova'].includes(ab.id);
  if (damageSpell) {
    api.removeAuraById(state, u, 'shaman.clearcast');
    if (T(u).focus && state.rng() < 0.1) api.applyAura(state, u, u, { id: 'shaman.clearcast', name: 'Clearcasting', icon: 'hourglass', duration: 15 });
  }
  if (ab.id === 'shaman.lb') api.removeAuraById(state, u, 'shaman.maelstrom');
}
function weaponHit({ state, u, dst, pk, api }) {
  const tal = T(u);
  if (pk.ability === 'shaman.windfury') return;
  if (tal.flurry && pk.crit)
    api.applyAura(state, u, u, { id: 'shaman.flurry', name: 'Flurry', icon: 'axe', duration: 15, stacks: 3, mods: { meleeHaste: 0.25 } });
  else {
    const f = api.findAura(u, 'shaman.flurry');
    if (f && --f.stacks <= 0) api.removeAura(state, u, f, 'consumed');
  }
  if (tal.maelstrom && state.rng() < 0.2) {
    const a = api.findAura(u, 'shaman.maelstrom');
    if (a) {
      a.stacks = Math.min(5, a.stacks + 1);
      a.remaining = 30;
    } else api.applyAura(state, u, u, { id: 'shaman.maelstrom', name: 'Maelstrom Weapon', icon: 'lightning', duration: 30, maxStacks: 5 });
  }
  if (tal.windfury && api.findAura(u, 'shaman.windfury') && state.t >= (u.meta.wfReady || 0) && state.rng() < 0.2) {
    u.meta.wfReady = state.t + 3;
    for (let i = 0; i < 2; i++)
      api.dealDamage(state, u, dst, {
        amount: roll(state, [u.melee.min, u.melee.max]) + (u.ab['shaman.windfury'].ap * 1.4 * u.melee.speed) / 14,
        coef: u.melee.speed / 14,
        kind: 'melee',
        ability: 'shaman.windfury',
      });
  }
}
function playerBuild({ level, race = 'orc', spec, role, groupBuffs = [] }) {
  const L = level >= 45 ? 60 : level >= 20 ? 30 : 10;
  const sp = L === 10 ? 'baseline' : role === 'healer' ? 'resto' : spec || 'elemental';
  if (!['baseline', ...SPECS.map((s) => s.id)].includes(sp)) throw Error('Unsupported Shaman spec ' + sp);
  const melee = sp === 'enhancement',
    resto = sp === 'resto';
  const tal = playerTalents(L, sp);
  const gear = melee ? GEAR.shamanMelee[L] : resto ? GEAR.shamanHealer[L] : GEAR.shamanCaster[L];
  const S = deriveStats({ classId: 'shaman', race, level: L, gear, buffs: buffTotals(groupBuffs, L), pct: { int: tal.intPct } });
  if (!melee) {
    S.stats.block = 0.05;
    S.stats.blockValue = L === 60 ? 70 : L === 30 ? 25 : 5;
  }
  if (tal.mentalDex) S.stats.ap += S.stats.int;
  if (tal.mentalQuick) {
    S.stats.sp += S.stats.int * 0.3;
    S.stats.heal += S.stats.int * 0.3;
  }
  S.stats.hit += tal.hit;
  S.stats.spellHit += tal.hit;
  S.stats.critPhys += tal.thundering;
  S.stats.critSpell += tal.thundering;
  const [min, max, speed] = WEAPONS[melee ? 'twoHand' : 'casterMace'][L];
  let bar =
    L === 10
      ? ['shaman.lb', 'shaman.es', 'shaman.fs', 'shaman.hw', 'shaman.attack', 'shaman.strength', 'shaman.earthbind', 'shaman.searing']
      : resto
        ? [
            'shaman.hw',
            'shaman.lhw',
            'shaman.es',
            'shaman.ns',
            ...(L === 60 ? ['shaman.ch', 'shaman.riptide'] : []),
            'shaman.manatide',
            'shaman.lb',
            'shaman.cleanse',
          ]
        : melee
          ? ['shaman.attack', 'shaman.stormstrike', 'shaman.es', 'shaman.fs', 'shaman.lb', 'shaman.fr', 'shaman.hw', ...(L === 60 ? ['shaman.rage'] : [])]
          : [
              'shaman.lb',
              'shaman.fs',
              'shaman.lava',
              ...(L === 60 ? ['shaman.cl'] : []),
              'shaman.es',
              'shaman.fr',
              'shaman.hw',
              ...(L === 60 ? ['shaman.em'] : []),
            ];
  bar.push('shaman.lightshield', 'shaman.rockbiter');
  if (melee) bar.push('shaman.windfury');
  if (tal.waterShield) bar.push('shaman.watershield');
  if (L > 10) for (const id of ['shaman.lhw', 'shaman.cleanse']) if (!bar.includes(id)) bar.push(id);
  if (L > 10)
    bar.push(
      'shaman.strength',
      'shaman.earthbind',
      'shaman.searing',
      'shaman.spring',
      'shaman.stream',
      ...(L === 60 ? ['shaman.grace'] : []),
      'shaman.nova',
      'shaman.recall',
      'shaman.projection',
      'shaman.call',
    );
  const preset = L > 10 ? ['shaman.strength', 'shaman.searing', 'shaman.spring', ...(L === 60 ? ['shaman.grace'] : [])] : [];
  const tweaks = {};
  const baseMana = BASE.shaman[L][1];
  for (const id of ['shaman.lb', 'shaman.lava', 'shaman.cl'])
    tweaks[id] = {
      castTimeMultFn: (u, ab) => {
        const ct = typeof ab.castTime === 'string' ? ab[ab.castTime] : ab.castTime;
        let n = Math.max(0, ct - (tal.alacrity || 0) - (['shaman.lb', 'shaman.lava'].includes(id) && u.auras.some((a) => a.id === 'shaman.em') ? 0.5 : 0));
        if (id === 'shaman.lb') n *= 1 - 0.2 * (u.auras.find((a) => a.id === 'shaman.maelstrom')?.stacks || 0);
        return n / ct;
      },
    };
  for (const id of ['shaman.lb', 'shaman.cl', 'shaman.lava', ...SHOCKS, 'shaman.nova'])
    tweaks[id] = {
      ...tweaks[id],
      costMultFn: (u) => {
        if (u.auras.some((a) => a.id === 'shaman.clearcast')) return 0;
        const convection = id === 'shaman.nova' ? 1 : tal.convection;
        return (
          convection *
          (SHOCKS.includes(id) ? tal.shockCost : 1) *
          (id === 'shaman.lb' ? 1 - 0.2 * (u.auras.find((a) => a.id === 'shaman.maelstrom')?.stacks || 0) : 1)
        );
      },
    };
  tweaks['shaman.earthbind'] = { mana: Math.round(baseMana * 0.06), cooldown: 15 };
  tweaks['shaman.cleanse'] = { mana: Math.round(baseMana * 0.09), range: 30 };
  tweaks['shaman.searing'] = {
    effects: [
      {
        type: 'custom',
        fn: (c) =>
          summonTotem(c, { element: 'fire', duration: L === 10 ? 30 : L === 30 ? 40 : 55, interval: 2, damage: { 10: [9, 11], 30: [19, 25], 60: [40, 54] } }),
      },
    ],
  };
  tweaks['shaman.nova'] = { cooldown: 10 };
  tweaks['shaman.stormstrike'] = { mana: Math.round(baseMana * 0.08) };
  tweaks['shaman.projection'] = { mana: Math.round(baseMana * 0.25) };
  tweaks['shaman.call'] = { mana: preset.reduce((n, id) => n + getAbility(id).byLevel[L].mana, 0) };
  tweaks['shaman.lightshield'] = { costMultFn: () => tal.shockCost };
  if (tal.impHw) {
    tweaks['shaman.hw'] = { ct: 3 - tal.impHw };
    for (const id of ['shaman.hw', 'shaman.lhw', 'shaman.ch', 'shaman.riptide']) tweaks[id] = { ...tweaks[id], costMultFn: () => tal.tidalFocus };
    if (resto)
      tweaks['shaman.manatide'] = {
        gcd: 1,
        mana: L === 30 ? 20 : 60,
        effects: [{ type: 'custom', fn: (c) => summonTotem(c, { element: 'water', duration: 12, interval: 3, mana: L === 30 ? 88 : 290 }) }],
      };
  }
  for (const id of bar)
    if (getAbility(id)?.category === 'totem' || id === 'shaman.manatide' || id === 'shaman.projection')
      tweaks[id] = { ...tweaks[id], costMultFn: () => tal.totemCost };
  return {
    template: {
      portrait: 'orc-shaman',
      maxHp: S.maxHp,
      resources: { mana: S.mana },
      regen: S.regen,
      stats: S.stats,
      armor: S.armor,
      tags: ['humanoid'],
      melee: { min, max, speed, coef: speed / 14 },
      abilities: bar,
      meta: { spec: sp, talents: tal, groupBuffs, totemPreset: preset },
      auras: [{ id: 'shaman.t.mind', name: 'Mindfulness', permanent: true, hidden: true, mods: { castRegen: tal.mindfulness, healCrit: tal.tidalMastery } }],
      hooks: {
        onCast: playerCast,
        onWeaponHit: weaponHit,
        beforeDamage: beforeShamanDamage,
        afterDamage: afterShamanDamage,
        afterHeal: afterShamanHeal,
        afterDamageTaken: shamanDamaged,
        onTick: shamanTick,
        onAvoid: shamanAvoid,
      },
    },
    bar,
    tweaks,
    consumables: ['item.rest', 'item.healpot', 'item.manapot'],
    filler: melee ? 'shaman.stormstrike' : 'shaman.lb',
    loopHint: resto
      ? 'Place support totems. Heal injured allies; use Mana Tide before running dry.'
      : melee
        ? 'Keep in melee, Stormstrike then Earth Shock; spend Maelstrom on Lightning Bolt at 60.'
        : 'Apply Flame Shock, cast Lava Burst, then Lightning Bolt. Place totems in range; use Chain Lightning for nearby groups at 60.',
    passives: [
      ...Object.entries(tal.points).map(([name, rank]) => ({
        name: name + ' (' + rank + ')',
        desc: (TALENT_TEXT[name]?.[rank] || '').replace(/<[^>]+>/g, ''),
        forever: DM('Selected from the saved Forever talent tree; 21 points at 30, 51 at 60.'),
      })),
      {
        name: 'Source scope',
        desc: 'Official Forever mechanics with provisional ranks, talents, weapon imbues and gear; consult the Shaman audit before interpreting DPS.',
        forever: APPROX('Gear and unexported ranks remain estimates.'),
      },
    ],
  };
}

// Numeric rank values normalized independently from the retained live spellbook export.

for (const [id, entry] of Object.entries(SOURCE_RANKS)) {
  const ab = getAbility(id);
  if (id === 'shaman.earthbind') ab.cooldown = 15;
  const byLevel = { ...ab.byLevel };
  for (const L of [10, 30, 60]) if (entry[L]) byLevel[L] = { ...byLevel[L], ...entry[L].kit };
  registerAbilities({
    [id]: {
      ...ab,
      byLevel,
      forever: {
        status: 'beta-observation',
        src: 'wh-forever',
        note: 'Rank values from live Shaman export, 29 Oct 2026. Coefficients, gear and unspecified proc rates remain estimates.',
      },
    },
  });
}

function shield(ctx, id) {
  const { state, u, api } = ctx;
  for (const old of ['shaman.lightshield', 'shaman.watershield']) api.removeAuraById(state, u, old);
  api.applyAura(state, u, u, { id, name: id === 'shaman.watershield' ? 'Water Shield' : 'Lightning Shield', icon: 'shield', duration: 600, stacks: 3 });
}
registerAbilities({
  'shaman.lightshield': {
    name: 'Lightning Shield',
    icon: 'shield',
    school: 'nature',
    category: 'defensive',
    tags: ['shield', 'defensive'],
    target: 'self',
    cost: { mana: 'mana' },
    forever: DM('Live spellbook: 3 globes, 10 min; 3.5 s trigger interval from tooltip. Coefficient provisional.'),
    desc: 'Three charges strike attackers with Nature damage; at most one trigger every 3.5 s. Replaces Water Shield.',
    byLevel: { 10: { mana: 45, dmg: 13 }, 30: { mana: 125, dmg: 40 }, 60: { mana: 370, dmg: 178 } },
    effects: [{ type: 'custom', fn: (c) => shield(c, 'shaman.lightshield') }],
  },
  'shaman.watershield': {
    name: 'Water Shield',
    icon: 'shield',
    school: 'nature',
    category: 'resource',
    tags: ['shield', 'resource'],
    target: 'self',
    forever: DM('Live talent export: 3 globes; 2% maximum mana per incoming hit or own spell critical. 3.5 s trigger interval estimated.'),
    desc: 'Three charges each return 2% maximum mana when hit or when your spell crits. Replaces Lightning Shield.',
    effects: [{ type: 'custom', fn: (c) => shield(c, 'shaman.watershield') }],
  },
  'shaman.rockbiter': {
    name: 'Rockbiter Weapon',
    icon: 'axe',
    school: 'nature',
    category: 'buff',
    tags: ['buff'],
    target: 'self',
    cost: { mana: 'mana' },
    forever: DM('Live spellbook AP: 79 / 194 / 686. One weapon imbue; enhanced talent multiplier estimated per build.'),
    desc: 'Imbue your weapon for 60 minutes: melee attack power and threat. Replaces Windfury.',
    byLevel: { 10: { mana: 25, ap: 79 }, 30: { mana: 75, ap: 194 }, 60: { mana: 150, ap: 686 } },
    effects: [
      {
        type: 'custom',
        fn: ({ state, u, api, ab }) => {
          api.removeAuraById(state, u, 'shaman.windfury');
          api.applyAura(state, u, u, {
            id: 'shaman.rockbiter',
            name: 'Rockbiter Weapon',
            icon: 'axe',
            duration: 3600,
            mods: { statAdd: { ap: ab.ap }, threat: 1.3 },
          });
        },
      },
    ],
  },
  'shaman.windfury': {
    name: 'Windfury Weapon',
    icon: 'axe',
    school: 'nature',
    category: 'buff',
    tags: ['buff'],
    target: 'self',
    cost: { mana: 'mana' },
    forever: DM('Live spellbook: 20% chance, 2 extra attacks, 104 / 433 bonus AP at 30 / 60. 3 s proc lockout is Classic assumption.'),
    desc: 'Imbue your weapon for 60 minutes: hits can grant two extra attacks. Replaces Rockbiter.',
    byLevel: { 30: { mana: 90, ap: 104 }, 60: { mana: 165, ap: 433 } },
    effects: [
      {
        type: 'custom',
        fn: ({ state, u, api }) => {
          api.removeAuraById(state, u, 'shaman.rockbiter');
          api.applyAura(state, u, u, { id: 'shaman.windfury', name: 'Windfury Weapon', icon: 'axe', duration: 3600 });
        },
      },
    ],
  },
  'shaman.call': {
    name: 'Call of the Elements',
    icon: 'shield',
    school: 'nature',
    category: 'totem',
    tags: ['totem', 'utility'],
    target: 'self',
    castTime: 3,
    cost: { mana: 'mana' },
    forever: DM('3 s simultaneous summon. This trial uses the selected build’s support preset; costs sum to individual totems.'),
    desc: 'Summon the build preset together: Strength of Earth, Searing, Mana Spring, and Grace of Air at 60. You can replace individual elements afterwards.',
    effects: [
      {
        type: 'custom',
        fn: (c) => {
          for (const id of c.u.meta.totemPreset) {
            const ab = c.u.ab[id];
            for (const e of ab.effects) e.fn({ ...c, ab });
          }
        },
      },
    ],
  },
});
function waterProc({ state, u, api }) {
  const a = api.findAura(u, 'shaman.watershield');
  if (!a || state.t < (u.meta.shieldReady || 0)) return;
  u.meta.shieldReady = state.t + 3.5;
  const n = u.res.mana.max * 0.02;
  u.res.mana.cur = Math.min(u.res.mana.max, u.res.mana.cur + n);
  api.emit(state, { type: 'resource', src: u.id, dst: u.id, ability: 'shaman.watershield', resource: 'mana', amount: n });
  if (--a.stacks <= 0) api.removeAura(state, u, a, 'spent');
}
function beforeShamanDamage(c) {
  const { u, pk, dst, api } = c;
  const tal = T(u);
  if (pk.ability === 'shaman.es') {
    pk.amount *= tal.concussion || 1;
    if (api.findAura(dst, 'shaman.stormstrike', u.id)) pk.amount *= 1.2;
  }
  if (['shaman.searing', 'shaman.nova'].includes(pk.ability)) pk.amount *= tal.callFlame || 1;
  if (pk.ability === 'shaman.lightshield') pk.amount *= tal.shieldDamage || 1;
  if (tal.fury && ['fire', 'frost', 'nature'].includes(pk.school)) pk.critMult = 2;
}
function afterShamanDamage(c) {
  const { state, u, pk, dst, api, final, absorbed } = c;
  if (['shaman.es', 'shaman.lb', 'shaman.cl'].includes(pk.ability) && final + absorbed > 0) {
    const mark = api.findAura(dst, 'shaman.stormstrike', u.id);
    if (mark) api.removeAura(state, dst, mark, 'consumed');
  }
  if (pk.kind === 'spell' && !pk.isTick && pk.crit && pk.ability !== 'shaman.lightshield') waterProc(c);
}
function afterShamanHeal(c) {
  if (c.pk.crit && !c.pk.isTick) waterProc(c);
}
function shamanDamaged(c) {
  const { state, u, src, api, pk, final } = c;
  if (!src || final <= 0 || src.side === u.side || pk.isTick || pk.ability === 'shaman.lightshield') return;
  waterProc(c);
  const a = api.findAura(u, 'shaman.lightshield');
  if (!a || state.t < (u.meta.lightReady || 0)) return;
  u.meta.lightReady = state.t + 3.5;
  if (--a.stacks <= 0) api.removeAura(state, u, a, 'spent');
  api.dealDamage(state, u, src, { amount: u.ab['shaman.lightshield'].dmg, coef: 0.267, school: 'nature', ability: 'shaman.lightshield', canCrit: false });
}

function shamanTick({ u }) {
  const a = u.auras.find((a) => a.id === 'shaman.t.mind');
  if (!a) return;
  const tal = T(u),
    ab = u.casting?.ab;
  const lightning = ['shaman.lb', 'shaman.cl', 'shaman.lava'].includes(ab?.id);
  a.def.mods.pushbackResist = { all: lightning ? tal.eye : ab?.category === 'heal' ? tal.healingFocus : 0 };
}
function shamanAvoid({ u, avoid }) {
  if (T(u).improvedStormstrike && ['dodge', 'parry'].includes(avoid) && u.ab['shaman.stormstrike']) u.cds['shaman.stormstrike'] = 0;
}

function chainLightning(ctx) {
  const { state, u, api } = ctx;
  const jump = (overload = false) => {
    const done = new Set();
    let t = ctx.t;
    for (let i = 0; i < 3 && t; i++) {
      spellDamage({ ...ctx, t, overload }, 0.7 ** i * (overload ? 0.5 : 1));
      done.add(t.id);
      t = api.nearest(
        api.enemiesOf(state, u, (e) => !done.has(e.id) && G.dist(e, t) <= 10),
        t,
      );
    }
  };
  jump();
  if (T(u).overload && state.rng() < T(u).overload) jump(true);
}
