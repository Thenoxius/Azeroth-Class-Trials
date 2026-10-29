// Shaman kit — WoW: Forever. Played by NPC healers for now (Restoration at 30 and 60); becomes
// a playable kit later. Totems are modelled as the group buffs they give (data in ../stats.js
// BUFFS: Mana Spring, Strength of Earth, Grace of Air — several are raid-wide in Forever); Mana
// Tide is an active cooldown. Spell ranks: Wowhead datamine, live build 1.60.1.70630.
import { registerAbilities } from '../../engine/registry.js';
import { roll, val } from './shared.js';
import { applyRace, validRace } from '../races.js';
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
    name: 'Healing Wave', icon: 'heal', school: 'nature', category: 'heal', tags: ['heal', 'core'], target: 'ally',
    desc: 'A big, slow heal.',
    forever: DM('Datamine: 329–382 at 30 (rank 5), 1535–1750 at 60 (rank 10); Healing Way adds a flat 25 %.'),
    range: 40, castTime: 'ct', cost: { mana: 'mana' }, effects: [{ type: 'custom', fn: (ctx) => shamanHeal(ctx) }],
    byLevel: { 30: { heal: [329, 382], ct: 3, mana: 200, coef: 0.857 }, 60: { heal: [1535, 1750], ct: 3, mana: 620, coef: 0.857 } },
  },
  'shaman.lhw': {
    name: 'Lesser Healing Wave', icon: 'flash-heal', school: 'nature', category: 'heal', tags: ['heal'], target: 'ally',
    desc: 'A fast 1.5 s heal for emergencies.',
    forever: DM('Datamine: 220–249 at 30, 796–886 at 60.'),
    range: 40, castTime: 1.5, cost: { mana: 'mana' }, effects: [{ type: 'custom', fn: (ctx) => shamanHeal(ctx) }],
    byLevel: { 30: { heal: [220, 249], mana: 145, coef: 0.429 }, 60: { heal: [796, 886], mana: 380, coef: 0.429 } },
  },
  'shaman.ch': {
    name: 'Chain Heal', icon: 'heal', school: 'nature', category: 'heal', tags: ['heal', 'aoe'], target: 'ally',
    desc: 'Heals the target, then jumps to two more hurt party members at 50 % and 25 %.',
    forever: DM('Datamine: rank 3 (level 54) heals 474–539, three targets, each jump half as strong.'),
    range: 40, castTime: 2.5, cost: { mana: 'mana' },
    effects: [{
      type: 'custom',
      fn: (ctx) => {
        const { state, u, t, api } = ctx;
        const riptideBonus = t.auras.some(a => a.id === 'shaman.riptide' && a.srcId === u.id) ? 1.25 : 1;
        shamanHeal(ctx, { mult: riptideBonus });
        const done = new Set([t.id]);
        let from = t, mult = 0.5;
        for (let i = 0; i < 2; i++) {
          const next = api.alliesOf(state, u, (a) => !done.has(a.id) && a.hp < a.maxHp && Math.hypot(a.x - from.x, a.y - from.y) <= 12).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
          if (!next) break;
          shamanHeal({ ...ctx, t: next }, { mult: mult * riptideBonus });
          done.add(next.id); from = next; mult /= 2;
        }
      },
    }],
    byLevel: { 60: { heal: [474, 539], mana: 405, coef: 0.714 } },
  },
  'shaman.riptide': {
    name: 'Riptide', icon: 'renew', school: 'nature', category: 'heal', tags: ['heal'], target: 'ally',
    desc: 'An instant heal plus a heal over 15 s.',
    forever: DM('New Restoration capstone; datamine rank 3 at 60: 838–922 plus 953 over 15 s, 6 s cooldown.'),
    range: 40, cooldown: 6, cost: { mana: 'mana' },
    effects: [{ type: 'custom', fn: (ctx) => { shamanHeal(ctx); if (ctx.t.alive) ctx.api.applyAura(ctx.state, ctx.u, ctx.t, { id: 'shaman.riptide', name: 'Riptide', icon: 'renew', school: 'nature', duration: 15, tick: { interval: 3, type: 'heal', amount: val(ctx.ab, 'hot') / 5 * (T(ctx.u).purification || 1), coef: 0.1 * (T(ctx.u).purification || 1) } }); } }],
    byLevel: { 60: { heal: [838, 922], hot: 953, mana: 385, coef: 0.214 } },
  },
  'shaman.es': {
    name: 'Earth Shock', icon: 'nova', school: 'nature', category: 'interrupt', tags: ['interrupt'],
    desc: 'Instant Nature damage that interrupts spellcasting (2 s lockout). High threat.',
    forever: DM('Datamine: 84–89 at 30, 303–318 at 60, 6 s cooldown.'),
    range: 20, cooldown: 6, cost: { mana: 'mana' },
    effects: [{ type: 'damage', amount: 'dmg', coef: 0.386, threat: 2 }, { type: 'interrupt', lockout: 2 }],
    byLevel: { 30: { dmg: [84, 89], mana: 145 }, 60: { dmg: [303, 318], mana: 450 } },
  },
  'shaman.ns': {
    name: 'Nature’s Swiftness', icon: 'hourglass', school: 'nature', category: 'cooldown', tags: ['cooldown'], target: 'self', gcd: 0,
    desc: 'Your next Nature spell is instant.',
    forever: CLASSIC('Restoration talent; Classic 3 min cooldown used.'),
    cooldown: 180,
    effects: [{ type: 'aura', to: 'self', aura: { id: 'shaman.ns', name: 'Nature’s Swiftness', icon: 'hourglass', duration: 30, mods: { castTime: { nature: 0 } } } }],
  },
  'shaman.manatide': {
    name: 'Mana Tide Totem', icon: 'mana-gem', school: 'nature', category: 'resource', tags: ['resource'], target: 'self',
    desc: 'Restores mana to your group every 3 s for 12 s.',
    forever: DM('Datamine: 290 mana every 3 s (rank 4, level 58), 5 min cooldown.'),
    cooldown: 300, cost: { mana: 'mana' },
    effects: [{ type: 'aura', aoe: { center: 'self', radius: 30, affects: 'allies' }, aura: { id: 'shaman.manatide', name: 'Mana Tide', icon: 'mana-gem', duration: 12, tick: { interval: 3, type: 'mana', amount: 'tide' } } }],
    byLevel: { 60: { mana: 60, tide: 290 } },
  },
});

// Nature's Swiftness is spent by the next Nature spell with a cast time.
function shamanOnCast({ state, u, api, ab }) {
  if (ab && ab.school === 'nature' && ab.castTime && api.findAura(u, 'shaman.ns') && ab.id !== 'shaman.ns') api.removeAuraById(state, u, 'shaman.ns');
}

// Restoration (21 points at 30, 5/15/31 at 60).
const TALENTS = {
  resto30: { impHw: 0.5, tidalFocus: 0.95, mindfulness: 0.5, healingFocus: 0.7, tidalMastery: 0.05, ns: true },
  resto60: { impHw: 0.5, tidalFocus: 0.95, mindfulness: 0.5, healingFocus: 0.7, tidalMastery: 0.05, ns: true, healingWay: true, purification: 1.1, manaTide: true, riptide: true },
};

const snap = (level) => (level >= 45 ? 60 : 30);

export const KIT = {
  id: 'shaman',
  name: 'Shaman',
  color: '#0070DD',
  resource: 'mana',
  race: 'Orc',
  portrait: 'orc-shaman',
  tagline: 'Restoration preview — dungeon and raid healing at 30 and 60.',
  supportedLevels: [30,60],
  rolesFor: () => ['healer'],
  races: () => ['orc'],
  specsFor: (level) => level >= 30 ? [{id:'resto',name:'Restoration',blurb:'Healing Wave, interrupts and healing cooldowns. Totems are currently modelled as group buffs.'}] : [],
  build(opts) {
    if(opts.npc) return this.npcBuild(opts);
    if(![30,60].includes(opts.level)) throw Error('Shaman preview supports level 30 and 60 only');
    const race=validRace('shaman',opts.race);
    const b=this.npcBuild({...opts,race});
    return applyRace({...b,consumables:['item.rest','item.healpot','item.manapot'],loopHint:'Restoration preview: keep the tank alive, interrupt with Earth Shock when safe; Riptide then Chain Heal on its target at 60. Totem placement and DPS specs are not implemented.'},{classId:'shaman',race});
  },
  specs: { 30: [{ id: 'resto', name: 'Restoration' }], 60: [{ id: 'resto', name: 'Restoration' }] },
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
      { id: 'shaman.t.mind', name: 'Mindfulness', hidden: true, permanent: true, mods: { castRegen: tal.mindfulness, pushbackResist: { nature: tal.healingFocus }, healCrit: tal.tidalMastery } },
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
