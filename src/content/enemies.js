// Shared enemy abilities and helpers for the trials. Enemy bodies (health, armor, melee
// damage) come from real Classic 1.12 mobs of the same level (cmangos medians, see
// data/classic-mobs.js); each template says how it differs from an ordinary mob (mob: {...}).
import { registerAbilities } from '../engine/registry.js';
import { MOB, ELITE } from './data/classic-mobs.js';

const APPROX = { status: 'approximation', note: 'Original enemy for this trial.' };

registerAbilities({
  // Kobold / gnoll / bandit casters
  'npc.firebolt': {
    name: 'Fire Bolt',
    icon: 'fireball',
    school: 'fire',
    category: 'damage',
    castTime: 2.5,
    range: 30,
    projectile: { speed: 24 },
    desc: 'A slow bolt of fire. Interruptible.',
    forever: APPROX,
    effects: [{ type: 'damage', amount: 'dmg' }],
    byLevel: { 10: { dmg: [14, 18] }, 30: { dmg: [78, 92] }, 60: { dmg: [420, 480] } },
  },
  'npc.shadowbolt': {
    name: 'Shadow Bolt',
    icon: 'bolt',
    school: 'shadow',
    category: 'damage',
    castTime: 2.5,
    range: 30,
    projectile: { speed: 24 },
    desc: 'A bolt of shadow. Interruptible.',
    forever: APPROX,
    effects: [{ type: 'damage', amount: 'dmg' }],
    byLevel: { 10: { dmg: [15, 19] }, 30: { dmg: [85, 100] }, 60: { dmg: [450, 520] } },
  },
  'npc.earthbind': {
    name: 'Earthbind Hex',
    icon: 'eye',
    school: 'nature',
    category: 'control',
    castTime: 1.5,
    range: 30,
    cooldown: 14,
    desc: 'Magic: slows the target by 50 % for 10 s. A Priest can dispel it.',
    forever: APPROX,
    effects: [
      {
        type: 'aura',
        aura: { id: 'npc.earthbind', name: 'Earthbind Hex', icon: 'eye', school: 'nature', debuff: true, duration: 10, mods: { slow: 0.5 }, dispel: 'magic' },
      },
    ],
  },
  'npc.bite.disease': {
    name: 'Festering Bite',
    icon: 'bite',
    school: 'physical',
    mechanic: 'physical',
    category: 'dot',
    range: 5,
    cooldown: 12,
    desc: 'Disease: bleeds health over 15 s. Cure Disease removes it.',
    forever: APPROX,
    effects: [
      { type: 'damage', amount: 'hit', kind: 'melee' },
      {
        type: 'aura',
        aura: {
          id: 'npc.festering',
          name: 'Festering Bite',
          icon: 'bite',
          school: 'nature',
          debuff: true,
          duration: 15,
          dispel: 'disease',
          tick: { interval: 3, amount: 'tick', school: 'nature' },
        },
      },
    ],
    byLevel: { 10: { hit: [6, 8], tick: 3 }, 30: { hit: [30, 38], tick: 18 }, 60: { hit: [160, 190], tick: 90 } },
  },
  'npc.enrage': {
    name: 'Enrage',
    icon: 'beast-wrath',
    school: 'physical',
    mechanic: 'physical',
    category: 'buff',
    target: 'self',
    cooldown: 999,
    desc: 'At low health it goes berserk: much faster attacks. Tranquilizing Shot removes it.',
    forever: APPROX,
    effects: [
      {
        type: 'aura',
        to: 'self',
        aura: {
          id: 'npc.enrage',
          name: 'Enrage',
          icon: 'beast-wrath',
          school: 'physical',
          duration: 30,
          dispel: 'enrage',
          mods: { meleeHaste: 0.5, dmgDone: { melee: 1.15 } },
        },
      },
    ],
  },
  'npc.rend': {
    name: 'Rend',
    icon: 'claw',
    school: 'physical',
    mechanic: 'physical',
    category: 'dot',
    range: 5,
    cooldown: 10,
    desc: 'A tearing bite that bleeds.',
    forever: APPROX,
    effects: [
      { type: 'damage', amount: 'hit', kind: 'melee' },
      {
        type: 'aura',
        aura: { id: 'npc.rend', name: 'Rend', icon: 'claw', debuff: true, duration: 12, tick: { interval: 3, amount: 'tick', school: 'physical' } },
      },
    ],
    byLevel: { 10: { hit: [5, 7], tick: 2 }, 30: { hit: [28, 34], tick: 14 }, 60: { hit: [150, 180], tick: 75 } },
  },
  'npc.cripple': {
    name: 'Crippling Shot',
    icon: 'concussive',
    school: 'physical',
    mechanic: 'physical',
    ranged: true,
    category: 'control',
    range: 25,
    cooldown: 14,
    desc: 'A shot that slows you by 40 % for 6 s.',
    forever: APPROX,
    effects: [
      { type: 'damage', amount: 'hit', kind: 'ranged' },
      { type: 'aura', aura: { id: 'npc.cripple', name: 'Crippled', icon: 'concussive', debuff: true, duration: 6, mods: { slow: 0.4 } } },
    ],
    byLevel: { 30: { hit: [40, 50] }, 60: { hit: [220, 260] } },
  },
  'npc.hex.frailty': {
    name: 'Hex of Frailty',
    icon: 'skull',
    school: 'shadow',
    category: 'control',
    castTime: 1.5,
    range: 30,
    cooldown: 20,
    desc: 'Curse: you take 15 % more damage for 20 s. A Mage can remove curses.',
    forever: APPROX,
    effects: [
      {
        type: 'aura',
        aura: {
          id: 'npc.frailty',
          name: 'Hex of Frailty',
          icon: 'skull',
          school: 'shadow',
          debuff: true,
          duration: 20,
          mods: { dmgTaken: { all: 1.15 } },
          dispel: 'curse',
        },
      },
    ],
  },
  'npc.heal': {
    name: 'Flash of Zeal',
    icon: 'flash-heal',
    school: 'holy',
    category: 'heal',
    castTime: 2.5,
    range: 40,
    target: 'ally',
    cooldown: 8,
    desc: 'A big heal on an ally. Interrupt it!',
    forever: APPROX,
    effects: [{ type: 'heal', amount: 'heal' }],
    byLevel: { 10: { heal: [70, 90] }, 30: { heal: [520, 600] }, 60: { heal: [3000, 3500] } },
  },
});

// An ordinary Classic mob of this level, times the template's own factors:
// mob: { hp, dmg, armor, speed, caster, elite }. Elites use the median elite/normal ratios.
export function classicMob(level, m = {}) {
  const row =
    MOB[level] ||
    MOB[
      Object.keys(MOB)
        .map(Number)
        .reduce((a, b) => (Math.abs(b - level) < Math.abs(a - level) ? b : a))
    ];
  const band = level < 30 ? ELITE['10-29'] : level < 50 ? ELITE['30-49'] : ELITE['50-60'];
  const speed = m.speed ?? 2.0;
  const avg = row[3] * (m.elite ? band[1] : 1) * (m.dmg ?? 1) * speed;
  const armor = (m.caster ? (row[2] ?? row[1] * 0.55) : row[1]) * (m.armor ?? 1);
  return {
    maxHp: Math.round(row[0] * (m.elite ? band[0] : 1) * (m.hp ?? 1)),
    armor: Math.round(armor),
    melee: { min: Math.round(avg * 0.87), max: Math.round(avg * 1.13), speed },
  };
}

export function scaled(level, base) {
  return { ...base, level, ...classicMob(level, base.mob) };
}
