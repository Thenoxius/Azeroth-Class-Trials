// Priest kit — WoW: Forever. Level snapshots 10 / 30 / 60; Shadow for damage,
// Discipline or Holy for healing (trials that offer the healer role).
// Names, levels and mechanics follow research/research-priest.json. Spell ranks use the
// datamined Forever values (Wowhead spellbook/talent diff, live build 1.60.1.70630, read
// 2026-10-27); character stats come from Classic rules and a gear profile (../stats.js).
import { registerAbilities } from '../../engine/registry.js';
import { roll, val, addStacks, wandAbility, RACIALS } from './shared.js';
import { applyRace, validRace, racesFor } from '../races.js';
import { deriveStats, buffTotals, GEAR, WEAPONS } from '../stats.js';

const OFF = (note, src = 'bz-dd-priest') => ({ status: 'confirmed-official', src, note });
const BETA = (note) => ({ status: 'beta-observation', src: 'wh-forever', note });
const IV = (src, note) => ({ status: 'reported-guide', src, note });

const T = (u) => (u.meta && u.meta.talents) || {};
const inForm = (u) => u.auras.some((a) => a.id === 'priest.sf');
const noForm = ({ u }) => (inForm(u) ? 'custom:Not in Shadowform' : true);

// ---------------------------------------------------------------- damage & healing helpers

function shadowHit(ctx, o = {}) {
  const { state, u, t, ab, api } = ctx;
  if (!t || !t.alive) return 0;
  const tal = T(u);
  const school = o.school || ab.school;
  let mult = o.mult || 1;
  let critBonus = 0;
  let critMult;
  if (school === 'shadow' && inForm(u)) critMult = 2;
  if (tal.twinDisciplines && !val(ab, ab.castTime) && !ab.channel) mult *= 1.05;
  if (
    tal.powerInLight &&
    (ab.id === 'priest.smite' || ab.id === 'priest.penance') &&
    (api.findAura(t, 'priest.hf.dot', u.id) || api.findAura(t, 'priest.swp', u.id))
  )
    mult *= 1.1;
  if (ab.id === 'priest.swd' && tal.earlyDemise && t.hp / t.maxHp <= 0.2) critBonus += 0.3;
  if (api.findAura(u, 'priest.if') && !o.tick) critBonus += 0.25;
  const coef = val(ab, o.coef ?? 'coef');
  const amount = roll(state, val(ab, o.amount ?? 'dmg'));
  return api.dealDamage(state, u, t, {
    amount,
    coef,
    school,
    kind: o.kind || 'spell',
    ability: ab.id,
    critBonus,
    critMult,
    bonusMult: mult,
    threat: o.threat ?? 1,
    isTick: !!o.tick,
    canCrit: o.tick ? false : undefined,
  });
}

function priestHeal(ctx, o = {}) {
  const { state, u, t, ab, api } = ctx;
  if (!t || !t.alive) return 0;
  const tal = T(u);
  let critBonus = 0;
  let mult = o.mult || 1;
  const ws = api.findAura(t, 'priest.ws');
  if (tal.renewedHope && ws) {
    critBonus += 0.1;
    ws.remaining = Math.max(0.1, ws.remaining - 5);
  }
  if (api.findAura(u, 'priest.if')) critBonus += 0.25;
  if (tal.spiritualHealing) mult *= 1.1;
  if (tal.twinDisciplines && !val(ab, ab.castTime) && !ab.channel) mult *= 1.05;
  return api.healUnit(state, u, t, {
    amount: roll(state, val(ab, o.amount ?? 'heal')) * mult,
    coef: val(ab, o.coef ?? 'coef') * mult,
    ability: ab.id,
    critBonus,
    isTick: !!o.tick,
    canCrit: o.tick ? false : undefined,
  });
}

const dmg = (o) => ({ type: 'custom', fn: (ctx) => shadowHit(ctx, o) });
const heal = (o) => ({ type: 'custom', fn: (ctx) => priestHeal(ctx, o) });

// The five nearest party members (VE, Prayer of Healing): Forever groups are parties of five.
function partyOf(state, api, u, center, r = 30) {
  return api
    .alliesOf(state, u, (x) => x.kind !== 'guardian' && Math.hypot(x.x - center.x, x.y - center.y) <= r)
    .sort((a, b) => Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y))
    .slice(0, 5);
}

// ---------------------------------------------------------------- hooks

function priestAfterDamage({ state, u, api, pk, dst, final }) {
  if (final <= 0 || pk.school !== 'shadow') return;
  const tal = T(u);
  if (api.findAura(dst, 'priest.ve', u.id)) {
    for (const m of partyOf(state, api, u, u, 40)) api.healUnit(state, u, m, { amount: final * 0.2, ability: 'priest.ve', isTick: true });
  }
  if (tal.shadowWeaving && dst.alive)
    addStacks(
      state,
      api,
      u,
      dst,
      {
        id: 'priest.weaving',
        name: 'Shadow Weaving',
        icon: 'swp',
        school: 'shadow',
        debuff: true,
        duration: 15,
        maxStacks: 5,
        refresh: true,
        stackMods: true,
        mods: { dmgTakenMine: { shadow: 1.03 } },
      },
      1,
    );
}

function priestOnKill({ state, u, api, victim }) {
  const tal = T(u);
  const mine = victim.auras.some((a) => a.id === 'priest.ve' && a.srcId === u.id);
  if (tal.spiritTap && (mine || !victim.flags.trivial)) {
    api.applyAura(state, u, u, {
      id: 'priest.spirittap',
      name: 'Spirit Tap',
      icon: 'spirit',
      school: 'shadow',
      duration: 15,
      mods: { manaRegen: 2, castRegen: 0.5 },
    });
  }
  const dp = victim.auras.find((a) => a.id === 'priest.dp' && a.srcId === u.id);
  if (tal.devouringContagion && dp && dp.remaining > 1) {
    const near = api
      .enemiesOf(
        state,
        u,
        (e) => e !== victim && Math.hypot(e.x - victim.x, e.y - victim.y) <= 10 && !e.auras.some((a) => a.id === 'priest.dp' && a.srcId === u.id),
      )
      .slice(0, 2);
    for (const e of near) {
      const a = api.applyAura(state, u, e, { ...dp.def });
      if (a) a.remaining = dp.remaining;
    }
  }
}
function priestOnPartyKill(x) {
  if (x.victim.auras.some((a) => a.id === 'priest.ve' && a.srcId === x.u.id)) priestOnKill(x);
}

const HEALS = ['priest.lheal', 'priest.heal', 'priest.flash', 'priest.gheal', 'priest.binding', 'priest.poh', 'priest.penance', 'priest.renew', 'priest.pom'];
function priestOnCast({ state, u, api, ab }) {
  if (!ab || !ab.id.startsWith('priest.')) return;
  const tal = T(u);
  const ifa = api.findAura(u, 'priest.if');
  if (ifa && ab.id !== 'priest.innerfocus' && ab.cost) api.removeAura(state, u, ifa, 'consumed');
  if (tal.litany && HEALS.includes(ab.id)) {
    if (u.meta.lastHeal && u.meta.lastHeal !== ab.id && u.res.mana)
      u.res.mana.cur = Math.min(u.res.mana.max, u.res.mana.cur + 0.1 * val(ab, ab.cost && ab.cost.mana));
    u.meta.lastHeal = ab.id;
  }
  if (tal.darkInspiration && ab.id === 'priest.mb')
    api.applyAura(state, u, u, { id: 'priest.di', name: 'Dark Inspiration', icon: 'spirit', duration: 10, mods: { manaRegen: 1.15 } });
}

function priestAfterHeal({ state, u, api, dst, eff, pk }) {
  const tal = T(u);
  if (tal.divineAegis && pk.crit && !pk.isTick && eff > 0 && dst.alive) {
    api.applyAura(state, u, dst, {
      id: 'priest.aegis',
      name: 'Divine Aegis',
      icon: 'shield',
      school: 'holy',
      unique: 'target',
      duration: 12,
      absorb: Math.min(1200, Math.round(eff * 0.15)),
    });
  }
}

// Spirit of Redemption (Holy): on death become a spirit for 15 s, heals free, then die.
function sorPreventDeath({ state, u, api }) {
  if (!T(u).spiritOfRedemption || u.flags.sor) return false;
  u.flags.sor = true;
  for (const a of [...u.auras]) if (a.def.debuff) api.removeAura(state, u, a, 'removed');
  api.applyAura(state, u, u, {
    id: 'priest.sor',
    name: 'Spirit of Redemption',
    icon: 'spirit',
    school: 'holy',
    duration: 15,
    immune: true,
    mods: { costMult: { all: 0 } },
    onRemove: ({ state: st, u: me, api: a2 }) => {
      if (me.alive) a2.killUnit(st, me, null);
    },
  });
  api.banner(state, 'Spirit of Redemption', 'Heal for free for 15 s — then you die.', 3, 'warn');
  return true;
}

// ---------------------------------------------------------------- abilities

registerAbilities({
  ...wandAbility('priest.wand', 'shadow'),
  'priest.smite': {
    name: 'Smite',
    icon: 'smite',
    school: 'holy',
    category: 'filler',
    tags: ['core', 'filler'],
    learn: 1,
    desc: 'Holy damage. The early-level opener.',
    forever: BETA('Datamine: base damage 49–57 % below Classic (167–186 at 60, rank 8); Icy Veins reports higher spell coefficients to offset it.'),
    range: 30,
    castTime: 'ct',
    cost: { mana: 'mana' },
    effects: [dmg()],
    byLevel: {
      10: { dmg: [26, 31], ct: 2.0, mana: 30, coef: 0.57 },
      30: { dmg: [81, 91], ct: 2.5, mana: 140, coef: 0.71 },
      60: { dmg: [167, 186], ct: 2.5, mana: 280, coef: 0.85 },
    },
  },
  'priest.swp': {
    name: 'Shadow Word: Pain',
    icon: 'swp',
    school: 'shadow',
    category: 'dot',
    tags: ['core', 'dot', 'rotation'],
    learn: 4,
    desc: 'Shadow damage over 18 s. Your main DoT and multi-target tool.',
    forever: BETA('Values 9–23 % below Classic; no snapshotting in Forever. Improved SW:P adds 6 s.'),
    range: 30,
    cost: { mana: 'mana' },
    effects: [
      {
        type: 'custom',
        fn: ({ state, u, t, ab, api }) => {
          const tal = T(u);
          const dur = 18 + (tal.impSwp || 0);
          const per = val(ab, 'tick') + 0.16 * api.statOf(u, 'sp');
          api.applyAura(state, u, t, {
            id: 'priest.swp',
            name: 'Shadow Word: Pain',
            icon: 'swp',
            school: 'shadow',
            debuff: true,
            duration: dur,
            dispel: 'magic',
            tick: { interval: 3, amount: per, school: 'shadow' },
          });
          api.addThreat(state, t, u, 10);
        },
      },
    ],
    byLevel: { 10: { tick: 10, mana: 50 }, 30: { tick: 30, mana: 155 }, 60: { tick: 127, mana: 470 } },
  },
  'priest.mb': {
    name: 'Mind Blast',
    icon: 'mind-blast',
    school: 'shadow',
    category: 'damage',
    tags: ['core', 'burst', 'rotation'],
    learn: 10,
    desc: 'Fast Shadow nuke with high threat. Your pull spell, and on cooldown later.',
    forever: BETA('Values 5–13 % below Classic. Improved Mind Blast moved to row 2 (Oct 15).'),
    range: 30,
    castTime: 1.5,
    cooldown: 'cd',
    cost: { mana: 'mana' },
    effects: [dmg({ threat: 2 })],
    byLevel: {
      10: { dmg: [40, 44], mana: 50, coef: 0.43, cd: 8 },
      30: { dmg: [154, 162], mana: 150, coef: 0.43, cd: 8 },
      60: { dmg: [485, 511], mana: 350, coef: 0.43, cd: 8 },
    },
  },
  'priest.mf': {
    name: 'Mind Flay',
    icon: 'mind-flay',
    school: 'shadow',
    category: 'filler',
    tags: ['core', 'filler', 'rotation', 'control'],
    learn: 20,
    desc: 'Channel 3 s: Shadow damage every second and a 50 % slow. With Improved Mind Flay each tick hits 20 % harder than the last — do not clip it.',
    forever: OFF('Still a 10-point Shadow talent (earliest 20). Improved Mind Flay (Oct 15) ramps each tick.', 'bz-devnotes'),
    range: 20,
    cost: { mana: 'mana' },
    channel: {
      duration: 3,
      ticks: 3,
      effects: [
        { type: 'custom', fn: (ctx) => shadowHit(ctx, { amount: 'per', mult: Math.pow(T(ctx.u).impMindFlay ? 1.2 : 1, (ctx.tick || 1) - 1) }) },
        {
          type: 'aura',
          aura: { id: 'priest.mf.slow', name: 'Mind Flay', icon: 'mind-flay', school: 'shadow', debuff: true, duration: 1.5, mods: { slow: 0.5 } },
        },
      ],
    },
    onChannelEnd: ({ state, u, api, reason }) => {
      if (reason === 'complete' && T(u).darkInspiration)
        api.applyAura(state, u, u, { id: 'priest.di', name: 'Dark Inspiration', icon: 'spirit', duration: 10, mods: { manaRegen: 1.15 } });
    },
    byLevel: { 30: { per: [34, 34], mana: 70, coef: 0.15 }, 60: { per: [130, 130], mana: 205, coef: 0.15 } },
  },
  'priest.dp': {
    name: 'Devouring Plague',
    icon: 'devour',
    school: 'shadow',
    category: 'dot',
    tags: ['core', 'dot', 'rotation', 'heal'],
    learn: 20,
    desc: 'A disease: Shadow damage over 24 s, and the damage heals you. Mana-hungry.',
    forever: OFF('Now trained by every race at 20; 24 s cooldown (Oct 15); can crit (Oct 1).'),
    range: 30,
    cooldown: 24,
    cost: { mana: 'mana' },
    effects: [
      {
        type: 'custom',
        fn: ({ state, u, t, ab, api }) => {
          const per = val(ab, 'tick') + 0.1 * api.statOf(u, 'sp');
          api.applyAura(state, u, t, {
            id: 'priest.dp',
            name: 'Devouring Plague',
            icon: 'devour',
            school: 'shadow',
            debuff: true,
            duration: 24,
            dispel: 'disease',
            persistDeath: true,
            tick: {
              interval: 3,
              type: 'custom',
              fn: ({ state: st, u: holder, src, api: a2 }) => {
                if (!src || !src.alive) return;
                const d = a2.dealDamage(st, src, holder, { amount: per, school: 'shadow', kind: 'dot', ability: 'priest.dp', isTick: true, canCrit: true });
                if (d > 0) a2.healUnit(st, src, src, { amount: d, ability: 'priest.dp', isTick: true });
              },
            },
          });
          api.addThreat(state, t, u, 10);
        },
      },
    ],
    byLevel: { 30: { tick: 29, mana: 350 }, 60: { tick: 106, mana: 985 } },
  },
  'priest.ve': {
    name: 'Vampiric Embrace',
    icon: 'vampiric',
    school: 'shadow',
    category: 'heal',
    tags: ['heal', 'rotation', 'optional-utility'],
    learn: 25,
    desc: 'For 30 s, 20 % of your Shadow damage to the target heals your party (you included). Deaths under it trigger Spirit Tap.',
    forever: OFF('Now the 16-point Shadow talent; 30 s duration and (Oct 15) 30 s cooldown.'),
    range: 30,
    cooldown: 30,
    cost: { mana: 'mana' },
    effects: [
      { type: 'aura', aura: { id: 'priest.ve', name: 'Vampiric Embrace', icon: 'vampiric', school: 'shadow', debuff: true, duration: 30, persistDeath: true } },
      { type: 'threat', mode: 'add', value: 20 },
    ],
    byLevel: { 30: { mana: 40 }, 60: { mana: 85 } },
  },
  'priest.swd': {
    name: 'Shadow Word: Death',
    icon: 'shadow-word-death',
    school: 'shadow',
    category: 'damage',
    tags: ['core', 'burst', 'rotation'],
    learn: 32,
    desc: 'Instant Shadow damage. If the target survives, you take 10 % of your maximum health. Best under 20 % health.',
    forever: OFF('New baseline spell at 32; 18 s cooldown (Oct 15).', 'bz-devnotes'),
    range: 30,
    cooldown: 18,
    cost: { mana: 'mana' },
    effects: [
      {
        type: 'custom',
        fn: (ctx) => {
          shadowHit(ctx);
          if (ctx.t.alive)
            ctx.api.dealDamage(ctx.state, null, ctx.u, {
              amount: ctx.u.maxHp * 0.1,
              school: 'shadow',
              kind: 'spell',
              ability: 'priest.swd.backlash',
              noMiss: true,
              canCrit: false,
            });
        },
      },
    ],
    byLevel: { 60: { dmg: [447, 474], mana: 340, coef: 0.43 } },
  },
  'priest.shadowform': {
    name: 'Shadowform',
    icon: 'shadowform',
    school: 'shadow',
    category: 'buff',
    tags: ['optional-utility'],
    learn: 40,
    target: 'self',
    desc: 'Toggle. Shadow damage +10 %, Shadow spells cost half, Shadow crits deal double, physical damage taken −15 %. You cannot cast healing spells in it.',
    forever: OFF('Reworked capstone (earliest 40): mana efficiency and crit damage; only blocks healing spells.'),
    cooldown: 1.5,
    cost: { mana: 'mana' },
    effects: [
      {
        type: 'custom',
        fn: ({ state, u, api }) => {
          if (inForm(u)) {
            api.removeAuraById(state, u, 'priest.sf');
            return;
          }
          api.applyAura(state, u, u, {
            id: 'priest.sf',
            name: 'Shadowform',
            icon: 'shadowform',
            school: 'shadow',
            permanent: true,
            mods: { dmgDone: { shadow: 1.1 }, costMult: { shadow: 0.5 }, dmgTaken: { physical: 0.85 } },
          });
        },
      },
    ],
    byLevel: { 60: { mana: 200 } },
  },
  'priest.pws': {
    name: 'Power Word: Shield',
    icon: 'shield',
    school: 'holy',
    category: 'defensive',
    tags: ['defensive', 'heal'],
    learn: 6,
    target: 'ally',
    desc: 'Absorbs damage for 30 s; while it holds, casts are not pushed back. The target then has Weakened Soul and cannot be shielded again for 15 s.',
    forever: BETA('Can always overwrite a shield on a target without Weakened Soul (official). May starve rage tanks.'),
    range: 40,
    cooldown: 'cd',
    cost: { mana: 'mana' },
    canUse: ({ t, u }) => (t && t.auras.some((a) => a.id === 'priest.ws') ? 'custom:Target has Weakened Soul' : true),
    effects: [
      {
        type: 'custom',
        fn: ({ state, u, t, ab, api }) => {
          const tal = T(u);
          const amt = (val(ab, 'absorb') + 0.1 * api.statOf(u, 'heal')) * (1 + (tal.impPws || 0)) * (api.findAura(u, 'priest.pi') ? 1.2 : 1);
          api.applyAura(state, u, t, {
            id: 'priest.pws',
            name: 'Power Word: Shield',
            icon: 'shield',
            school: 'holy',
            unique: 'target',
            duration: 30,
            absorb: Math.round(amt),
          });
          api.applyAura(state, u, t, { id: 'priest.ws', name: 'Weakened Soul', icon: 'shield', school: 'holy', debuff: true, unique: 'target', duration: 15 });
          // Shield threat: like healing, split over enemies fighting the target.
          for (const e of api.enemiesOf(state, u, (x) => x.engaged && x.threat && x.threat[t.id] !== undefined)) api.addThreat(state, e, u, amt * 0.25);
        },
      },
    ],
    byLevel: { 10: { absorb: 48, mana: 45, cd: 4 }, 30: { absorb: 303, mana: 210, cd: 4 }, 60: { absorb: 950, mana: 500, cd: 4 } },
  },
  'priest.renew': {
    name: 'Renew',
    icon: 'renew',
    school: 'holy',
    category: 'heal',
    tags: ['heal'],
    learn: 8,
    target: 'ally',
    canUse: noForm,
    desc: 'Heals the target over 15 s.',
    forever: OFF('Renews from several Priests now stack; Renew can crit.'),
    range: 40,
    cost: { mana: 'mana' },
    effects: [
      {
        type: 'custom',
        fn: ({ state, u, t, ab, api }) => {
          const tal = T(u);
          const per = (val(ab, 'tick') + 0.2 * api.statOf(u, 'heal')) * (tal.impRenew ? 1.15 : 1) * (tal.spiritualHealing ? 1.1 : 1);
          api.applyAura(state, u, t, {
            id: 'priest.renew',
            name: 'Renew',
            icon: 'renew',
            school: 'holy',
            duration: 15,
            dispel: 'magic',
            tick: { interval: 3, type: 'heal', amount: per, canCrit: true },
          });
        },
      },
    ],
    byLevel: { 10: { tick: 9, mana: 30 }, 30: { tick: 32, mana: 140 }, 60: { tick: 166, mana: 410 } },
  },
  'priest.lheal': {
    name: 'Lesser Heal',
    icon: 'heal',
    school: 'holy',
    category: 'heal',
    tags: ['heal'],
    learn: 1,
    target: 'ally',
    canUse: noForm,
    desc: 'A small, slow, cheap heal.',
    forever: BETA('Ranks 2–3 buffed ~17 % / ~10 % vs Classic.'),
    range: 40,
    castTime: 2.5,
    cost: { mana: 'mana' },
    effects: [heal()],
    byLevel: { 10: { heal: [157, 181], mana: 75, coef: 0.71 } },
  },
  'priest.heal': {
    name: 'Heal',
    icon: 'heal',
    school: 'holy',
    category: 'heal',
    tags: ['heal', 'core'],
    learn: 16,
    target: 'ally',
    canUse: noForm,
    desc: 'The efficient mid-size heal guides call your bread and butter.',
    forever: BETA('Ranks 16/22/28/34; values 13–18 % below Classic.'),
    range: 40,
    castTime: 'ct',
    cost: { mana: 'mana' },
    effects: [heal()],
    byLevel: { 30: { heal: [510, 576], ct: 3.0, mana: 255, coef: 0.86 }, 60: { heal: [634, 713], ct: 3.0, mana: 305, coef: 0.86 } },
  },
  'priest.flash': {
    name: 'Flash Heal',
    icon: 'flash-heal',
    school: 'holy',
    category: 'heal',
    tags: ['heal'],
    learn: 20,
    target: 'ally',
    canUse: noForm,
    desc: 'A fast 1.5 s heal. Expensive — for emergencies.',
    forever: BETA('Values 8–13 % below Classic; guides: emergencies only.'),
    range: 40,
    castTime: 1.5,
    cost: { mana: 'mana' },
    effects: [heal()],
    byLevel: { 30: { heal: [236, 284], mana: 155, coef: 0.43 }, 60: { heal: [778, 914], mana: 380, coef: 0.43 } },
  },
  'priest.gheal': {
    name: 'Greater Heal',
    icon: 'greater-heal',
    school: 'holy',
    category: 'heal',
    tags: ['heal', 'core'],
    learn: 40,
    target: 'ally',
    canUse: noForm,
    desc: 'A big, slow heal for hits you can see coming. Pair it with Inner Focus.',
    forever: BETA('Ranks 40/46/52/58/60; never playable in the level-30 beta.'),
    range: 40,
    castTime: 'ct',
    cost: { mana: 'mana' },
    effects: [heal()],
    byLevel: { 60: { heal: [1893, 2108], ct: 3.0, mana: 710, coef: 0.86 } },
  },
  'priest.binding': {
    name: 'Binding Heal',
    icon: 'heal',
    school: 'holy',
    category: 'heal',
    tags: ['heal'],
    learn: 25,
    target: 'ally',
    canUse: noForm,
    desc: 'A 1.5 s heal on the target and yourself at once — tuned to be as good as Flash Heal even if you need no healing.',
    forever: OFF('New Holy 16-point gold medal.'),
    range: 40,
    castTime: 1.5,
    cost: { mana: 'mana' },
    effects: [
      heal(),
      {
        type: 'custom',
        fn: (ctx) => {
          if (ctx.t !== ctx.u) priestHeal({ ...ctx, t: ctx.u });
        },
      },
    ],
    byLevel: { 30: { heal: [236, 284], mana: 155, coef: 0.4 }, 60: { heal: [778, 914], mana: 380, coef: 0.4 } },
  },
  'priest.poh': {
    name: 'Prayer of Healing',
    icon: 'prayer',
    school: 'holy',
    category: 'heal',
    tags: ['heal', 'aoe'],
    learn: 30,
    target: 'ally',
    canUse: noForm,
    desc: 'Heals the target’s party (up to five people near them). Expensive; for party-wide damage.',
    forever: OFF('Now heals the target’s party and pets, within 40 yd of the target.'),
    range: 40,
    castTime: 3,
    cost: { mana: 'mana' },
    effects: [
      {
        type: 'custom',
        fn: (ctx) => {
          for (const m of partyOf(ctx.state, ctx.api, ctx.u, ctx.t, 30)) priestHeal({ ...ctx, t: m });
        },
      },
    ],
    byLevel: { 30: { heal: [179, 191], mana: 410, coef: 0.29 }, 60: { heal: [646, 681], mana: 1070, coef: 0.29 } },
  },
  'priest.pom': {
    name: 'Prayer of Mending',
    icon: 'prayer',
    school: 'holy',
    category: 'heal',
    tags: ['heal', 'aoe'],
    learn: 40,
    target: 'ally',
    canUse: noForm,
    desc: 'Places a prayer on the target: the next time they take damage it heals them and jumps to another nearby ally, up to 5 heals.',
    forever: OFF('New Holy 31-point gold medal; 10 s cooldown, 30 s duration, 20 yd jumps.'),
    range: 40,
    cooldown: 10,
    cost: { mana: 'mana' },
    effects: [{ type: 'custom', fn: ({ state, u, t, ab, api }) => placeMending(state, api, u, t, ab, 5) }],
    byLevel: { 60: { heal: [413, 413], mana: 390, coef: 0.429 } },
  },
  'priest.nova': {
    name: 'Holy Nova',
    icon: 'sun',
    school: 'holy',
    category: 'heal',
    tags: ['heal', 'aoe'],
    learn: 20,
    target: 'none',
    fx: 'ring',
    fxRadius: 10,
    canUse: noForm,
    desc: 'Instant: heals your party within 10 yards and damages enemies within 10 yards. Causes no threat. Expensive.',
    forever: BETA('Holy row-3 talent; Searing Light can make it free.'),
    cost: { mana: 'mana' },
    effects: [
      {
        type: 'custom',
        aoe: { center: 'self', radius: 10, affects: 'enemies' },
        fn: (ctx) => shadowHit(ctx, { amount: 'nd', coef: 0.1, school: 'holy', threat: 0 }),
      },
      { type: 'custom', aoe: { center: 'self', radius: 10, affects: 'allies' }, fn: (ctx) => priestHeal(ctx, { coef: 0.16 }) },
    ],
    byLevel: { 30: { heal: [80, 90], nd: [48, 55], mana: 290 }, 60: { heal: [294, 339], nd: [181, 208], mana: 750 } },
  },
  'priest.penance': {
    name: 'Penance',
    icon: 'penance',
    school: 'holy',
    category: 'heal',
    tags: ['heal', 'core', 'burst'],
    learn: 30,
    target: 'any',
    desc: 'Channel 2 s: on an ally it heals every second, on an enemy it damages every second (first tick instant). 12 s cooldown.',
    forever: OFF('New Discipline 21-point gold medal; kept more mana-efficient than Heal (Oct 8).', 'bz-devnotes'),
    range: 36,
    cooldown: 12,
    cost: { mana: 'mana' },
    canUse: (x) => (x.t && x.t.side === x.u.side ? noForm(x) : true),
    channel: {
      duration: 2,
      ticks: 3,
      tickOnStart: true,
      effects: [
        {
          type: 'custom',
          fn: (ctx) => (ctx.t && ctx.t.side !== ctx.u.side ? shadowHit(ctx, { amount: 'pd', coef: 0.14, school: 'holy' }) : priestHeal(ctx, { coef: 0.25 })),
        },
      ],
    },
    byLevel: { 30: { heal: [134, 134], pd: [45, 45], mana: 150 }, 60: { heal: [425, 425], pd: [92, 92], mana: 385 } },
  },
  'priest.holyfire': {
    name: 'Holy Fire',
    icon: 'holy-fire',
    school: 'holy',
    category: 'damage',
    tags: ['core', 'dot'],
    learn: 20,
    desc: 'Slow Holy nuke that also burns over 10 s. The Discipline/Holy opener.',
    forever: BETA('Datamine: 44–48 % below Classic (196–244 + 75 over 10 s at 60); castable in Shadowform without Shadow bonuses.'),
    range: 30,
    castTime: 'ct',
    cost: { mana: 'mana' },
    effects: [
      dmg(),
      {
        type: 'aura',
        aura: {
          id: 'priest.hf.dot',
          name: 'Holy Fire',
          icon: 'holy-fire',
          school: 'holy',
          debuff: true,
          duration: 10,
          tick: { interval: 2, amount: 'dot', school: 'holy' },
        },
      },
    ],
    byLevel: { 30: { dmg: [80, 98], dot: 6, ct: 3.5, mana: 125, coef: 0.86 }, 60: { dmg: [196, 244], dot: 15, ct: 3.5, mana: 255, coef: 0.86 } },
  },
  'priest.innerfocus': {
    name: 'Inner Focus',
    icon: 'power-infusion',
    school: 'holy',
    category: 'cooldown',
    tags: ['cooldown', 'resource'],
    learn: 20,
    target: 'self',
    gcd: 0,
    desc: 'Your next spell costs no mana and has +25 % crit chance.',
    forever: OFF('Crit bonus no longer applies to periodic effects (Oct 1). Cooldown not stated — Classic 3 min used.', 'bz-devnotes'),
    cooldown: 180,
    effects: [
      {
        type: 'aura',
        to: 'self',
        aura: { id: 'priest.if', name: 'Inner Focus', icon: 'power-infusion', school: 'holy', duration: 60, mods: { costMult: { all: 0 } } },
      },
    ],
  },
  'priest.pi': {
    name: 'Power Infusion',
    icon: 'power-infusion',
    school: 'holy',
    category: 'cooldown',
    tags: ['cooldown', 'optional-utility'],
    learn: 40,
    target: 'ally',
    gcd: 0,
    desc: 'Infuse an ally (or yourself): +20 % spell damage and healing for 15 s.',
    forever: IV('iv-disc', 'Disc capstone, requires Penance. Cooldown not stated — Classic 3 min used.'),
    range: 30,
    cooldown: 180,
    cost: { mana: 'mana' },
    effects: [
      {
        type: 'aura',
        aura: { id: 'priest.pi', name: 'Power Infusion', icon: 'power-infusion', school: 'holy', duration: 15, mods: { dmgDone: { all: 1.2 }, healDone: 1.2 } },
      },
    ],
    byLevel: { 60: { mana: 200 } },
  },
  'priest.dispel': {
    name: 'Dispel Magic',
    icon: 'dispel',
    school: 'holy',
    category: 'dispel',
    tags: ['dispel', 'optional-utility'],
    learn: 18,
    target: 'any',
    desc: 'On an ally: removes a harmful Magic effect. On an enemy: removes a beneficial one.',
    forever: BETA('Rank 2 (level 36) removes two effects.'),
    range: 30,
    cost: { mana: 'mana' },
    effects: [{ type: 'dispel', types: ['magic'], count: 'n' }],
    byLevel: { 30: { mana: 124, n: 1 }, 60: { mana: 258, n: 2 } },
  },
  'priest.cure': {
    name: 'Cure Disease',
    icon: 'cure',
    school: 'holy',
    category: 'dispel',
    tags: ['dispel', 'optional-utility'],
    learn: 14,
    target: 'ally',
    desc: 'Removes a disease from a friendly target.',
    forever: BETA('Unchanged.'),
    range: 30,
    cost: { mana: 'mana' },
    effects: [{ type: 'dispel', types: ['disease'], count: 1, which: 'debuff' }],
    byLevel: { 30: { mana: 103 } },
  },
  'priest.abolish': {
    name: 'Abolish Disease',
    icon: 'cure',
    school: 'holy',
    category: 'dispel',
    tags: ['dispel', 'optional-utility'],
    learn: 32,
    target: 'ally',
    desc: 'Removes a disease now and another every 5 s for 20 s.',
    forever: BETA('Unchanged.'),
    range: 30,
    cost: { mana: 'mana' },
    effects: [
      { type: 'dispel', types: ['disease'], count: 1, which: 'debuff' },
      {
        type: 'aura',
        aura: {
          id: 'priest.abolish',
          name: 'Abolish Disease',
          icon: 'cure',
          school: 'holy',
          duration: 20,
          tick: {
            interval: 5,
            type: 'custom',
            fn: ({ state, u, src, api }) => {
              if (u.auras.some((a) => a.def.debuff && a.def.dispel === 'disease')) api.dispelUnit(state, src, u, ['disease'], 1, 'debuff', 'priest.abolish');
            },
          },
        },
      },
    ],
    byLevel: { 60: { mana: 215 } },
  },
  'priest.fade': {
    name: 'Fade',
    icon: 'fade',
    school: 'shadow',
    category: 'defensive',
    tags: ['defensive', 'threat'],
    learn: 8,
    target: 'self',
    gcd: 0,
    desc: 'For 10 s enemies care much less about you: a chunk of your threat is set aside — and comes back when Fade ends.',
    forever: OFF('Threat reduction doubled; Wowhead: the threat returns after 10 s.'),
    cooldown: 30,
    cost: { mana: 'mana' },
    effects: [
      {
        type: 'custom',
        fn: ({ state, u, ab, api }) => {
          const amount = val(ab, 'thr');
          const taken = {};
          for (const e of state.list) {
            if (!e.threat || e.threat[u.id] === undefined) continue;
            const d = Math.min(e.threat[u.id], amount);
            e.threat[u.id] -= d;
            taken[e.id] = d;
          }
          api.applyAura(state, u, u, {
            id: 'priest.fade',
            name: 'Fade',
            icon: 'fade',
            school: 'shadow',
            duration: 10,
            onRemove: ({ state: st }) => {
              for (const [id, d] of Object.entries(taken)) {
                const e = st.units[id];
                if (e && e.alive && e.threat && e.threat[u.id] !== undefined) e.threat[u.id] += d;
              }
            },
          });
        },
      },
    ],
    byLevel: { 10: { thr: 110, mana: 40 }, 30: { thr: 570, mana: 125 }, 60: { thr: 1640, mana: 275 } },
  },
  'priest.scream': {
    name: 'Psychic Scream',
    icon: 'scream',
    school: 'shadow',
    category: 'control',
    tags: ['control', 'aoe'],
    learn: 14,
    target: 'none',
    fx: 'ring',
    fxRadius: 8,
    desc: 'Up to 3–5 enemies within 8 yards flee in fear for 8 s. Damage may break it — and fleeing enemies can run into more trouble.',
    forever: BETA('Unchanged; guides warn feared mobs can pull more.'),
    cooldown: 30,
    cost: { mana: 'mana' },
    effects: [
      {
        type: 'aura',
        aoe: { center: 'self', radius: 8, maxTargets: 'n' },
        aura: {
          id: 'priest.scream',
          name: 'Psychic Scream',
          icon: 'scream',
          school: 'shadow',
          debuff: true,
          duration: 8,
          cc: 'fear',
          breakDamage: 0.12,
          breakDamagePct: true,
          dr: 'fear',
          dispel: 'magic',
        },
      },
    ],
    byLevel: { 30: { n: 3, mana: 140 }, 60: { n: 5, mana: 210 } },
  },
  'priest.silence': {
    name: 'Silence',
    icon: 'silence',
    school: 'shadow',
    category: 'interrupt',
    tags: ['interrupt', 'control'],
    learn: 30,
    desc: 'Interrupts the target’s spell (3 s lockout) and silences it for 5 s. Your only interrupt.',
    forever: OFF('No longer requires Improved Psychic Scream; now also interrupts.'),
    range: 'range',
    cooldown: 45,
    cost: { mana: 'mana' },
    effects: [
      { type: 'interrupt', lockout: 3 },
      {
        type: 'aura',
        aura: {
          id: 'priest.silence',
          name: 'Silence',
          icon: 'silence',
          school: 'shadow',
          debuff: true,
          duration: 5,
          cc: 'silence',
          dr: 'silence',
          dispel: 'magic',
        },
      },
    ],
    byLevel: { 30: { mana: 70, range: 24 }, 60: { mana: 150, range: 24 } },
  },
  'priest.fearward': {
    name: 'Fear Ward',
    icon: 'shield',
    school: 'holy',
    category: 'defensive',
    tags: ['defensive', 'optional-utility'],
    learn: 20,
    target: 'ally',
    gcd: 0,
    desc: 'The next Fear effect on the target fails. Lasts 3 min.',
    forever: OFF('Every race now trains it at 20; 3 min duration and cooldown.'),
    range: 30,
    cooldown: 180,
    cost: { mana: 'mana' },
    effects: [{ type: 'aura', aura: { id: 'priest.fw', name: 'Fear Ward', icon: 'shield', school: 'holy', duration: 180, wards: ['fear'] } }],
    byLevel: { 60: { mana: 100 } },
  },
  'priest.touch': {
    name: 'Touch of Weakness',
    icon: 'touch-weakness',
    school: 'shadow',
    category: 'buff',
    tags: ['racial', 'optional-utility'],
    learn: 10,
    target: 'self',
    desc: 'Undead Priest spell. The next enemy to hit you in melee takes Shadow damage and deals less melee damage for 2 min.',
    forever: OFF('Kept for Undead (“unchanged”); datamine: −43 to −204 melee attack power.'),
    cost: { mana: 'mana' },
    effects: [
      {
        type: 'custom',
        fn: ({ state, u, ab, api }) =>
          api.applyAura(state, u, u, {
            id: 'priest.tow',
            name: 'Touch of Weakness',
            icon: 'touch-weakness',
            school: 'shadow',
            duration: 600,
            onHolderDamaged: ({ state: st, u: me, aura, api: a2, src, pk }) => {
              if (!src || !src.alive || pk.kind !== 'melee' || src.side === me.side) return;
              a2.removeAura(st, me, aura, 'consumed');
              a2.dealDamage(st, me, src, { amount: val(ab, 'td'), school: 'shadow', kind: 'spell', ability: 'priest.touch', noMiss: true });
              if (src.alive)
                a2.applyAura(st, me, src, {
                  id: 'priest.tow.debuff',
                  name: 'Touch of Weakness',
                  icon: 'touch-weakness',
                  school: 'shadow',
                  debuff: true,
                  duration: 120,
                  mods: { dmgDone: { melee: 0.9 } },
                  dispel: 'magic',
                });
            },
          }),
      },
    ],
    byLevel: { 10: { td: 8, mana: 25 }, 30: { td: 18, mana: 75 }, 60: { td: 56, mana: 195 } },
  },
  'priest.darksac': {
    name: 'Dark Sacrifice',
    icon: 'devour',
    school: 'shadow',
    category: 'resource',
    tags: ['racial', 'resource'],
    learn: 20,
    target: 'self',
    desc: 'Undead Priest spell. Trade health for mana over 15 s (more mana with more Spirit).',
    forever: OFF('New Undead Priest spell (replaces their exclusive Devouring Plague). Datamine: X health for X + Spirit mana, 10 min cooldown.'),
    cooldown: 600,
    effects: [
      {
        type: 'custom',
        fn: ({ state, u, ab, api }) => {
          const hp = val(ab, 'hp');
          const mana = hp + (u.stats.spi || 0);
          api.applyAura(state, u, u, {
            id: 'priest.darksac',
            name: 'Dark Sacrifice',
            icon: 'devour',
            school: 'shadow',
            duration: 15,
            tick: {
              interval: 3,
              type: 'custom',
              fn: ({ u: me }) => {
                me.hp = Math.max(1, me.hp - hp / 5);
                if (me.res.mana) me.res.mana.cur = Math.min(me.res.mana.max, me.res.mana.cur + mana / 5);
              },
            },
          });
        },
      },
    ],
    byLevel: { 30: { hp: 720 }, 60: { hp: 1640 } },
  },
});

// Troll Priest spells. Values: Wowhead Forever tooltips (spells 9035-19285, 18137-19312).
registerAbilities({
  'priest.hex': {
    name: 'Hex of Weakness',
    icon: 'touch-weakness',
    school: 'shadow',
    category: 'control',
    tags: ['racial', 'optional-utility'],
    learn: 10,
    range: 30,
    desc: 'Troll Priest spell. Curses an enemy for 2 min: less melee damage, and healing on it is 20 % less effective.',
    forever: OFF(
      'Kept for Trolls (“unchanged”). Datamine: −43 to −204 melee attack power; −20 % healing. Attack power loss is simulated as −10 % melee damage.',
    ),
    cost: { mana: 'mana' },
    effects: [
      {
        type: 'aura',
        aura: {
          id: 'priest.hex',
          name: 'Hex of Weakness',
          icon: 'touch-weakness',
          school: 'shadow',
          debuff: true,
          duration: 120,
          mods: { dmgDone: { melee: 0.9 }, healTaken: 0.8 },
          dispel: 'curse',
        },
      },
    ],
    byLevel: { 10: { mana: 35 }, 30: { mana: 90 }, 60: { mana: 240 } },
  },
  'priest.shadowguard': {
    name: 'Shadowguard',
    icon: 'shield',
    school: 'shadow',
    category: 'buff',
    tags: ['racial', 'optional-utility'],
    learn: 20,
    target: 'self',
    desc: 'Troll Priest spell. For 10 min, up to 3 attackers that hit you with a spell, melee or ranged attack take Shadow damage (at most once per 3.5 s). No threat.',
    forever: OFF('Kept for Trolls (“unchanged”). Datamine: 3 charges, 10 min, 3.5 s between charges, 13 to 96 Shadow damage.'),
    cost: { mana: 'mana' },
    effects: [
      {
        type: 'custom',
        fn: ({ state, u, ab, api }) =>
          api.applyAura(state, u, u, {
            id: 'priest.shadowguard',
            name: 'Shadowguard',
            icon: 'shield',
            school: 'shadow',
            duration: 600,
            maxStacks: 3,
            stacks: 3,
            onHolderDamaged: ({ state: st, u: me, aura, api: a2, src, pk }) => {
              if (!src || !src.alive || pk.isTick || src.side === me.side) return;
              if (st.t < (aura.readyAt || 0)) return;
              aura.readyAt = st.t + 3.5;
              a2.dealDamage(st, me, src, { amount: val(ab, 'td'), school: 'shadow', kind: 'spell', ability: 'priest.shadowguard', noMiss: true, threat: 0 });
              aura.left = (aura.left ?? 3) - 1;
              aura.stacks = aura.left;
              if (aura.left <= 0) a2.removeAura(st, me, aura, 'consumed');
            },
          }),
      },
    ],
    byLevel: { 30: { td: 22, mana: 85 }, 60: { td: 96, mana: 250 } },
  },
});
// Each race trains its own two spells; the bars list the Undead ones.
const RACE_SPELLS = { troll: { 'priest.touch': 'priest.hex', 'priest.darksac': 'priest.shadowguard' } };

// Prayer of Mending: heals on the holder's next damage, then jumps.
function placeMending(state, api, u, t, ab, charges) {
  if (!t || !t.alive || charges <= 0) return;
  api.applyAura(state, u, t, {
    id: 'priest.pom',
    name: 'Prayer of Mending',
    icon: 'prayer',
    school: 'holy',
    unique: 'target',
    duration: 30,
    onHolderDamaged: ({ state: st, u: holder, aura, api: a2, final }) => {
      if (final <= 0) return;
      a2.removeAura(st, holder, aura, 'consumed');
      priestHeal({ state: st, u, t: holder, ab, api: a2 });
      const next = a2
        .alliesOf(st, holder, (x) => x !== holder && x.kind !== 'guardian' && Math.hypot(x.x - holder.x, x.y - holder.y) <= 20)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (next) placeMending(st, a2, u, next, ab, charges - 1);
    },
  });
}

// ---------------------------------------------------------------- talents per spec

const TALENTS = {
  shadow30: {
    wandSpec: 0.25,
    spiritTap: true,
    shadowFocus: 0.05,
    impMb: 2.5,
    impSwp: 6,
    impMindFlay: true,
    shadowWeaving: true,
    darkInspiration: true,
    vampiric: true,
    silence: true,
  },
  disc30: {
    wandSpec: 0.25,
    powerInLight: true,
    twinDisciplines: true,
    silentResolve: 0.7,
    meditation: 0.5,
    impPws: 0.2,
    innerFocus: true,
    soulWarding: true,
    penance: true,
    renewedHope: true,
  },
  holy30: {
    wandSpec: 0.25,
    twilightFocus: 0.7,
    impRenew: true,
    holySpec: 0.05,
    divineFury: 0.5,
    impHealing: 0.85,
    bindingHeal: true,
    litany: true,
    spiritOfRedemption: true,
    spiritualGuidance: true,
  },
  shadow60: {
    wandSpec: 0.25,
    spiritTap: true,
    shadowFocus: 0.05,
    impMb: 2.5,
    impSwp: 6,
    impMindFlay: true,
    shadowWeaving: true,
    darkInspiration: true,
    vampiric: true,
    silence: true,
    devouringContagion: true,
    earlyDemise: true,
    darkness: 1.1,
    shadowform: true,
    meditation: 0.5,
  },
  disc60: {
    wandSpec: 0.25,
    powerInLight: true,
    twinDisciplines: true,
    silentResolve: 0.7,
    meditation: 0.5,
    impPws: 0.2,
    innerFocus: true,
    soulWarding: true,
    penance: true,
    renewedHope: true,
    divineAegis: true,
    powerInfusion: true,
    holySpec: 0.05,
    divineFury: 0.5,
    twilightFocus: 0.7,
  },
  holy60: {
    wandSpec: 0.25,
    twilightFocus: 0.7,
    impRenew: true,
    holySpec: 0.05,
    divineFury: 0.5,
    impHealing: 0.85,
    bindingHeal: true,
    litany: true,
    spiritOfRedemption: true,
    spiritualGuidance: true,
    spiritualHealing: true,
    prayerOfMending: true,
    meditation: 0.5,
    innerFocus: true,
  },
};

const P = (name, desc, forever) => ({ name, desc, forever });
const PASSIVES = {
  shadow30: [
    P(
      'Spirit Tap',
      'After a kill (or any death under your Vampiric Embrace): double Spirit and half regen while casting for 15 s.',
      OFF('Now also triggers on Vampiric Embrace deaths.'),
    ),
    P('Improved Mind Flay', 'Each Mind Flay tick deals 20 % more than the last.', OFF('Oct 15 version.', 'bz-devnotes')),
    P(
      'Shadow Weaving',
      'Your Shadow damage makes the target take 3 % more Shadow damage from you, 5 stacks.',
      OFF('Now self-only; 3 % per stack in the live datamine.'),
    ),
    P('Improved Shadow Word: Pain · Improved Mind Blast', 'SW:P lasts 6 s longer; Mind Blast cooldown −2.5 s.', OFF()),
    P('Dark Inspiration', 'Mind Blast and a full Mind Flay boost your Spirit for 10 s.', OFF('New (Oct 15).', 'bz-devnotes')),
    P('Wand Specialization', '+25 % wand damage.', OFF('Now 2 points.')),
  ],
  disc30: [
    P('Meditation', 'Half of your mana regeneration continues while casting.', OFF('Greatly increased in Forever.')),
    P(
      'Improved Power Word: Shield · Soul Warding',
      'Shields absorb 20 % more; no shield cooldown and 15 % cheaper.',
      OFF('Soul Warding is the new 16-point gold medal.'),
    ),
    P('Renewed Hope', 'Heals on targets with Weakened Soul crit 10 % more often and shorten it by 5 s.', OFF('New.')),
    P('Power in Light · Twin Disciplines', 'Smite and Penance +10 % on your Holy Fire / SW:P targets; instant spells +5 %.', OFF('New.')),
    P('Silent Resolve', 'Your spells cause 30 % less threat.', OFF()),
  ],
  holy30: [
    P('Divine Fury', 'Heal, Greater Heal, Smite and Holy Fire cast 0.5 s faster.', BETA()),
    P('Twilight Focus', 'Any spell resists pushback 70 %.', OFF('Renamed Healing Focus; now all spells.')),
    P('Improved Renew · Holy Specialization · Improved Healing', 'Renew +15 %; +5 % Holy crit; Heal and Greater Heal 15 % cheaper.', OFF()),
    P('Litany of Light', 'A heal refunds 10 % of its cost when it differs from your previous heal — rotate, don’t spam.', OFF('New.')),
    P('Spirit of Redemption', 'When you die you become a spirit for 15 s and heal for free, then die.', BETA('15 s (Classic 10 s).')),
  ],
};
PASSIVES.shadow60 = [
  ...PASSIVES.shadow30,
  P('Shadowform', 'Shadow +10 % damage, half cost, double crits; −15 % physical damage taken; no healing spells.', OFF('Reworked capstone.')),
  P(
    'Devouring Contagion · Early Demise · Darkness',
    'Devouring Plague spreads to 2 enemies on death; SW:Death +30 % crit under 20 %; Shadow +10 %.',
    OFF('New talents.'),
  ),
];
PASSIVES.disc60 = [
  ...PASSIVES.disc30,
  P('Divine Aegis', 'Critical heals leave a 12 s absorb shield worth 15 % of the heal (does not stack).', OFF('New.')),
  P('Power Infusion', '+20 % spell damage and healing on an ally for 15 s.', IV('iv-disc')),
];
PASSIVES.holy60 = [
  ...PASSIVES.holy30,
  P('Prayer of Mending', 'A heal that waits for damage, then jumps up to 5 times.', OFF('New 31-point gold medal.')),
  P('Spiritual Healing · Meditation', '+10 % healing; half regen while casting (18 Discipline points).', OFF()),
];

// ---------------------------------------------------------------- build

const BARS = {
  10: ['priest.smite', 'priest.swp', 'priest.mb', 'priest.wand', 'priest.pws', 'priest.renew', 'priest.lheal', 'priest.fade', 'priest.touch'],
  shadow30: [
    'priest.mb',
    'priest.swp',
    'priest.dp',
    'priest.mf',
    'priest.ve',
    'priest.wand',
    'priest.pws',
    'priest.renew',
    'priest.flash',
    'priest.scream',
    'priest.silence',
    'priest.fade',
    'priest.dispel',
    'priest.touch',
    'priest.darksac',
  ],
  disc30: [
    'priest.pws',
    'priest.renew',
    'priest.heal',
    'priest.flash',
    'priest.penance',
    'priest.innerfocus',
    'priest.dispel',
    'priest.cure',
    'priest.fade',
    'priest.scream',
    'priest.smite',
    'priest.holyfire',
    'priest.swp',
    'priest.wand',
    'priest.touch',
    'priest.darksac',
  ],
  holy30: [
    'priest.renew',
    'priest.pws',
    'priest.heal',
    'priest.flash',
    'priest.binding',
    'priest.poh',
    'priest.nova',
    'priest.dispel',
    'priest.cure',
    'priest.fade',
    'priest.scream',
    'priest.smite',
    'priest.holyfire',
    'priest.swp',
    'priest.wand',
    'priest.touch',
    'priest.darksac',
  ],
  shadow60: [
    'priest.mb',
    'priest.swp',
    'priest.dp',
    'priest.mf',
    'priest.swd',
    'priest.ve',
    'priest.shadowform',
    'priest.pws',
    'priest.flash',
    'priest.scream',
    'priest.silence',
    'priest.fade',
    'priest.dispel',
    'priest.fearward',
    'priest.touch',
    'priest.darksac',
    'priest.wand',
  ],
  disc60: [
    'priest.pws',
    'priest.renew',
    'priest.flash',
    'priest.gheal',
    'priest.penance',
    'priest.poh',
    'priest.innerfocus',
    'priest.pi',
    'priest.dispel',
    'priest.abolish',
    'priest.fade',
    'priest.scream',
    'priest.fearward',
    'priest.smite',
    'priest.holyfire',
    'priest.swp',
    'priest.wand',
    'priest.darksac',
  ],
  holy60: [
    'priest.renew',
    'priest.pws',
    'priest.flash',
    'priest.heal',
    'priest.gheal',
    'priest.binding',
    'priest.poh',
    'priest.pom',
    'priest.nova',
    'priest.innerfocus',
    'priest.dispel',
    'priest.abolish',
    'priest.fade',
    'priest.scream',
    'priest.fearward',
    'priest.smite',
    'priest.holyfire',
    'priest.wand',
    'priest.darksac',
  ],
};

const LOOP = {
  10: 'Shield yourself, Mind Blast or Smite to pull, Shadow Word: Pain — then wand while the DoT ticks. Renew when hurt. This is the “DoT + wand” stage the guides describe; Mind Flay does not exist yet.',
  shadow30:
    'Mind Blast, SW:P and Devouring Plague up, Vampiric Embrace on the target, Mind Flay (full channel) to fill; wand to save mana. Shield before the pull so casts are not pushed back.',
  disc30:
    'Prevent before you heal: shield the tank before damage lands, Renew for chip damage, Penance for bursts, Heal as the efficient main heal, Flash only in emergencies. Wand between pulls to let mana come back.',
  holy30:
    'React: Renew on the tank, Heal as the main heal, Binding Heal when you and the tank are both hurt, Prayer of Healing or Holy Nova when everyone is low. Alternate heals — Litany of Light refunds mana.',
  shadow60:
    'Stay in Shadowform. Keep SW:P and Devouring Plague up, Mind Blast and Shadow Word: Death on cooldown, Vampiric Embrace up, unclipped Mind Flay to fill. (A guide projection — level 60 was never playable.)',
  disc60:
    'Shield the tank, Renew, Penance for burst, Flash for quick saves, Greater Heal + Inner Focus for big hits; Divine Aegis turns crits into shields; Power Infusion on yourself or a caster.',
  holy60:
    'Renew on many targets, Prayer of Mending on cooldown, Flash/Binding for quick heals, Greater Heal for big hits, Prayer of Healing for group damage. Rotate heals for Litany of Light.',
};

// Buffs a Priest keeps on itself: Power Word: Fortitude, Divine Spirit (baseline from 30 in
// Forever) and Inner Fire.
const SELF_BUFFS = ['fortitude', 'divineSpirit', 'innerFire'];

const snap = (level) => (level >= 45 ? 60 : level >= 20 ? 30 : 10);

export const KIT = {
  id: 'priest',
  name: 'Priest',
  color: '#FFFFFF',
  resource: 'mana',
  race: 'Undead',
  portrait: 'undead-priest',
  tagline: 'Heal the group, or bleed the enemy dry in Shadowform.',
  fantasy:
    'A caster of light and shadow. Discipline prevents damage with shields and Penance, Holy reacts with Renew, Binding Heal and Prayer of Mending, and Shadow drains enemies with DoTs, Mind Flay and Vampiric Embrace. The only class here with two roles.',
  strengthsSummary:
    'Healer or damage (dual spec at 40), shields and self-heals, a real interrupt for Shadow, Fortitude/Divine Spirit/Fear Ward for the group, Undead race spells for mana.',
  risksSummary:
    'Shadow leveling stays “DoT + Mind Blast + wand” until the mid-20s and only feels like Shadow at Shadowform (40); healers level slowly solo; fragile with few escapes.',
  specs: {
    30: [
      {
        id: 'shadow',
        name: 'Shadow',
        blurb: 'Mind Flay, Devouring Plague, Vampiric Embrace — before Shadowform.',
        forever: { status: 'confirmed-official', note: 'Talents official; the 21-point pick (Silence over Devouring Contagion) is ours.' },
      },
      {
        id: 'disc',
        name: 'Discipline',
        blurb: 'Shields, Renewed Hope and Penance.',
        forever: { status: 'confirmed-official', note: 'Talents official; 21-point pick approximated.' },
      },
      {
        id: 'holy',
        name: 'Holy',
        blurb: 'Renew, Binding Heal, Litany of Light, Holy Nova.',
        forever: { status: 'confirmed-official', note: 'Talents official; 21-point pick approximated.' },
      },
    ],
    60: [
      {
        id: 'shadow',
        name: 'Shadow',
        blurb: 'Shadowform, SW:Death, Devouring Contagion.',
        forever: { status: 'reported-guide', note: 'Warcraft Tavern 14/3/34 projection; untested at 60.' },
      },
      {
        id: 'disc',
        name: 'Discipline',
        blurb: 'Divine Aegis, Power Infusion, Penance.',
        forever: { status: 'reported-guide', note: 'Warcraft Tavern 31/20/0 projection.' },
      },
      {
        id: 'holy',
        name: 'Holy',
        blurb: 'Prayer of Mending, Spirit of Redemption, Greater Heal.',
        forever: { status: 'reported-guide', note: 'Warcraft Tavern 18/33/0 projection.' },
      },
    ],
  },
  // Damage role plays Shadow; the healer role chooses Discipline or Holy.
  specsFor(level, role) {
    const all = this.specs[level] || [];
    if (!all.length) return [];
    return role === 'healer' ? all.filter((s) => s.id !== 'shadow') : all.filter((s) => s.id === 'shadow');
  },
  rolesFor: (trialId) => (trialId === 't3' || trialId === 't5' ? ['dps', 'healer'] : ['dps']),
  // The race picks portrait, racials and base attributes; see content/races.js.
  races: () => racesFor('priest'),
  build(opts) {
    const race = validRace('priest', opts.race);
    return applyRace(this.buildBase({ ...opts, race }), { classId: 'priest', race });
  },
  buildBase({ level, spec, role, groupBuffs = [], race }) {
    const L = snap(level);
    let sp = null;
    if (L > 10) sp = role === 'healer' ? (spec === 'holy' ? 'holy' : 'disc') : 'shadow';
    const key = L === 10 ? 10 : sp + L;
    const tal = L === 10 ? { wandSpec: 0.13 } : TALENTS[key];
    // Undead Priest: Classic base stats + gear profile (healing gear for healers) + self-buffs.
    const healer = sp && sp !== 'shadow';
    const S = deriveStats({
      classId: 'priest',
      race,
      level: L,
      gear: healer ? GEAR.priestHealer[L] : GEAR.priest[L],
      buffs: buffTotals([...SELF_BUFFS, ...groupBuffs], L),
    });
    const stats = { ...S.stats };
    const regen = { ...S.regen };
    // Spiritual Guidance (Forever): healing +25 % of Spirit, spell damage +8 % of Spirit.
    if (tal.spiritualGuidance) {
      stats.heal += Math.round(0.25 * S.attrs.spi);
      stats.sp += Math.round(0.08 * S.attrs.spi);
    }
    if (tal.holySpec) stats.critSpell += tal.holySpec;
    const [wMin, wMax, wSpeed] = WEAPONS.wand[L];
    const wand = { min: wMin, max: wMax, speed: wSpeed };
    wand.min = Math.round(wand.min * (1 + (tal.wandSpec || 0)));
    wand.max = Math.round(wand.max * (1 + (tal.wandSpec || 0)));
    const tweaks = {};
    if (tal.impMb) tweaks['priest.mb'] = { cd: 8 - tal.impMb };
    if (tal.soulWarding) tweaks['priest.pws'] = { cd: 0, costMultFn: () => 0.85 };
    if (tal.divineFury)
      for (const id of ['priest.heal', 'priest.gheal', 'priest.smite', 'priest.holyfire'])
        tweaks[id] = { ...(tweaks[id] || {}), ct: (id === 'priest.holyfire' ? 3.5 : id === 'priest.smite' ? 2.5 : 3.0) - tal.divineFury };
    if (tal.impHealing)
      for (const id of ['priest.lheal', 'priest.heal', 'priest.gheal', 'priest.penance', 'priest.pom'])
        tweaks[id] = { ...(tweaks[id] || {}), costMultFn: () => tal.impHealing };
    if (tal.devouringContagion) tweaks['priest.dp'] = { ...(tweaks['priest.dp'] || {}), costMultFn: () => 0.5 };
    const auras = [];
    if (L >= 30) auras.push({ id: 'priest.innerfire', name: 'Inner Fire', icon: 'inner-fire', school: 'holy', permanent: true });
    if (tal.shadowFocus)
      auras.push({ id: 'priest.t.focus', name: 'Shadow Focus', hidden: true, permanent: true, mods: { spellHit: { shadow: tal.shadowFocus } } });
    if (tal.meditation) auras.push({ id: 'priest.t.meditation', name: 'Meditation', hidden: true, permanent: true, mods: { castRegen: tal.meditation } });
    if (tal.twilightFocus)
      auras.push({ id: 'priest.t.twilight', name: 'Twilight Focus', hidden: true, permanent: true, mods: { pushbackResist: { all: tal.twilightFocus } } });
    if (tal.silentResolve) auras.push({ id: 'priest.t.resolve', name: 'Silent Resolve', hidden: true, permanent: true, mods: { threat: tal.silentResolve } });
    if (tal.darkness) auras.push({ id: 'priest.t.darkness', name: 'Darkness', hidden: true, permanent: true, mods: { dmgDone: { shadow: tal.darkness } } });
    if (tal.shadowform)
      auras.push({
        id: 'priest.sf',
        name: 'Shadowform',
        icon: 'shadowform',
        school: 'shadow',
        permanent: true,
        mods: { dmgDone: { shadow: 1.1 }, costMult: { shadow: 0.5 }, dmgTaken: { physical: 0.85 } },
      });
    const swap = (ids) => ids.map((id) => (RACE_SPELLS[race] || {})[id] || id);
    const bar = swap(BARS[key]);
    const prevKey = L === 60 ? sp + '30' : L === 30 ? 10 : null;
    const prev = prevKey ? swap(BARS[prevKey]) : null;
    return {
      template: {
        name: 'You',
        portrait: 'undead-priest',
        maxHp: S.maxHp,
        resources: { mana: S.mana },
        stats,
        regen,
        armor: S.armor,
        tags: ['undead', 'humanoid'],
        role: sp && sp !== 'shadow' ? 'healer' : 'dps',
        ranged: { kind: 'wand', ...wand, range: 30, windup: 0.5, school: 'shadow', visual: 'shadow' },
        abilities: [...bar],
        auras,
        meta: { talents: tal, spec: sp },
        hooks: {
          afterDamage: priestAfterDamage,
          onKill: priestOnKill,
          onPartyKill: priestOnPartyKill,
          onCast: priestOnCast,
          afterHeal: priestAfterHeal,
          preventDeath: sorPreventDeath,
        },
      },
      bar,
      pet: null,
      consumables: ['item.rest', 'item.healpot', 'item.manapot', ...RACIALS.undead],
      tweaks,
      passives:
        L === 10
          ? [P('Wand Specialization (1/2)', '+13 % wand damage — the first talent point every leveling guide takes.', OFF('Now 2 points for the full 25 %.'))]
          : PASSIVES[key],
      newSince: prev ? { from: L === 60 ? 30 : 10, ids: bar.filter((id) => !prev.includes(id)) } : null,
      loopHint: LOOP[key],
      filler: L === 10 ? 'priest.smite' : sp === 'shadow' ? 'priest.mf' : L >= 60 ? 'priest.gheal' : 'priest.heal',
    };
  },
};
