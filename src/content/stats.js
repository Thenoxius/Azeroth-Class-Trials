// Player stats from Classic rules: base attributes per class/race/level (cmangos tables),
// plus a gear profile, plus self-buffs, turned into health, mana, attack power, crit,
// dodge, armor and spirit regen with the Classic 1.12 formulas.
//
// Rule sources: wowsims Classic/SoD simulator (github.com/wowsims/sod, sim/core/base_stats.go
// and the class files). Gear: WoW: Forever items are not public yet, so each profile is our
// estimate of typical Classic gear at that level (see GEAR below) — an approximation.
import { BASE, ATTR, PET } from './data/classic-tables.js';

// Crit and dodge per point of agility / intellect, in percent, at levels 25/40/50/60.
const CRIT_PER_AGI = {
  warrior: [0.1111, 0.0758, 0.061, 0.05],
  paladin: [0.1075, 0.0741, 0.0606, 0.0506],
  hunter: [0.0515, 0.0303, 0.0234, 0.0189],
  rogue: [0.0952, 0.0556, 0.0427, 0.0345],
  priest: [0.0769, 0.0645, 0.0571, 0.05],
  shaman: [0.0971, 0.0717, 0.06, 0.0508],
  mage: [0.072, 0.0621, 0.0563, 0.0514],
  warlock: [0.0909, 0.0698, 0.0588, 0.05],
  druid: [0.1025, 0.0719, 0.0594, 0.05],
};
const CRIT_PER_INT = {
  warrior: [0, 0, 0, 0],
  paladin: [0.0357, 0.0246, 0.02, 0.0167],
  hunter: [0.035, 0.0241, 0.0197, 0.0165],
  rogue: [0, 0, 0, 0],
  priest: [0.0457, 0.0269, 0.0208, 0.0168],
  shaman: [0.0422, 0.0262, 0.0208, 0.0169],
  mage: [0.0475, 0.0276, 0.0211, 0.0168],
  warlock: [0.0429, 0.0262, 0.0204, 0.0165],
  druid: [0.0427, 0.026, 0.0205, 0.0167],
};
const DODGE_PER_AGI = {
  warrior: [0.1111, 0.0758, 0.061, 0.05],
  paladin: [0.1075, 0.0741, 0.0606, 0.0506],
  hunter: [0.103, 0.0606, 0.0468, 0.0378],
  rogue: [0.1904, 0.1112, 0.0854, 0.069],
  priest: [0.0769, 0.0645, 0.0571, 0.05],
  shaman: [0.0971, 0.0717, 0.06, 0.0508],
  mage: [0.072, 0.0621, 0.0563, 0.0514],
  warlock: [0.0909, 0.0698, 0.0588, 0.05],
  druid: [0.1025, 0.0719, 0.0594, 0.05],
};
// Base crit / dodge in percent (wowsims ClassBaseCrit).
const BASE_SPELL_CRIT = { warrior: 0, paladin: 3.5, hunter: 3.6, rogue: 0, priest: 0.8, shaman: 2.3, mage: 0.2, warlock: 1.7, druid: 1.8 };
const BASE_MELEE_CRIT = { warrior: 0, paladin: 0.7, hunter: 0, rogue: 0, priest: 3.0, shaman: 1.7, mage: 3.2, warlock: 2.0, druid: 0.9 };
const BASE_DODGE = BASE_MELEE_CRIT;
// Melee attack power: per strength, per agility, and the level part (level × 2 − 20, or −10 for casters).
const AP_STR = { warrior: 2, paladin: 2, hunter: 1, rogue: 1, priest: 1, shaman: 2, mage: 1, warlock: 1, druid: 2 };
const AP_AGI = { warrior: 0, paladin: 0, hunter: 1, rogue: 1, priest: 0, shaman: 0, mage: 0, warlock: 0, druid: 0 };
const CASTER_AP = { priest: true, mage: true, warlock: true };
// Spirit-based mana regen per second outside the five-second rule.
const SPIRIT_REGEN = { mage: (s) => 6.25 + s / 8, priest: (s) => 6.25 + s / 8, warlock: (s) => 4 + s / 10 };
const spiritRegen = (classId, spi) => (SPIRIT_REGEN[classId] || ((s) => 7.5 + s / 10))(spi);
// Health regen per second out of combat (Classic per-tick formulas / 2; approximate).
const HP_REGEN = {
  warrior: (s) => (s * 0.8 + 6) / 2,
  rogue: (s) => (s * 0.5 + 2) / 2,
  hunter: (s) => (s * 0.25 + 6) / 2,
  mage: (s) => (s * 0.1 + 6) / 2,
  priest: (s) => (s * 0.1 + 6) / 2,
};

// Interpolate a 25/40/50/60 table. Below 25 the level-25 value is kept (we have no lower data).
function atLevel(row, level) {
  const L = [25, 40, 50, 60];
  if (level <= 25) return row[0];
  for (let i = 1; i < L.length; i++) if (level <= L[i]) return row[i - 1] + ((row[i] - row[i - 1]) * (level - L[i - 1])) / (L[i] - L[i - 1]);
  return row[3];
}
const snapLevel = (level) => (level >= 60 ? 60 : Math.max(10, Math.round(level / 10) * 10));

// Typical gear per class / profile / level: attribute and stat totals from all items.
// Our estimate; WoW: Forever items are not known. L10: quest whites and greens. L30: quest
// greens plus a few dungeon blues. L60: fresh level-60 dungeon blues (pre-raid). Casters get
// +spell damage only from level 30 on (low-level items rarely carried it in Classic).
export const GEAR = {
  hunter: {
    10: { str: 3, agi: 8, sta: 6, int: 3, spi: 1, armor: 150 },
    30: { str: 8, agi: 45, sta: 40, int: 12, spi: 5, armor: 650 },
    60: { str: 30, agi: 250, sta: 170, int: 90, spi: 20, armor: 2600, ap: 60, critPhys: 0.03, hit: 0.04 },
  },
  mage: {
    10: { int: 8, spi: 5, sta: 5, armor: 60 },
    30: { int: 40, spi: 25, sta: 40, armor: 280, sp: 15 },
    60: { int: 150, spi: 60, sta: 140, armor: 800, sp: 230, critSpell: 0.02, spellHit: 0.02 },
  },
  priest: {
    10: { int: 7, spi: 6, sta: 5, armor: 60 },
    30: { int: 35, spi: 30, sta: 36, armor: 280, sp: 12, heal: 12 },
    60: { int: 130, spi: 100, sta: 130, armor: 800, sp: 230, heal: 230, critSpell: 0.01, spellHit: 0.02 },
  },
  // NPC party and raid classes (same estimate: quest greens at 30, fresh dungeon blues at 60).
  // Player Warriors (phase 4): DPS plate and a tank set. Our estimate like the rest.
  warriorDps: {
    10: { str: 10, agi: 5, sta: 8, armor: 300 },
    30: { str: 75, agi: 35, sta: 45, armor: 1500, critPhys: 0.02, hit: 0.02 },
    60: { str: 250, agi: 110, sta: 190, armor: 4600, ap: 60, critPhys: 0.05, hit: 0.06 },
  },
  warriorTank: {
    10: { str: 8, agi: 5, sta: 10, armor: 450 },
    30: { str: 40, agi: 25, sta: 55, armor: 2300 },
    60: { str: 110, agi: 70, sta: 260, armor: 6400, hit: 0.02 },
  },
  rogue: {
    10: { str: 4, agi: 10, sta: 7, armor: 160 },
    30: { str: 20, agi: 50, sta: 35, armor: 600 },
    60: { str: 60, agi: 230, sta: 140, armor: 1900, ap: 80, hit: 0.03, critPhys: 0.03 },
  },
  warlock: {
    30: { int: 35, spi: 25, sta: 40, armor: 280, sp: 15 },
    60: { int: 130, spi: 60, sta: 150, armor: 800, sp: 230, spellHit: 0.02, critSpell: 0.01 },
  },
  shamanCaster: {
    10: { int: 8, spi: 5, sta: 6, armor: 150 },
    30: { int: 40, spi: 25, sta: 40, armor: 650, sp: 15 },
    60: { int: 150, spi: 60, sta: 150, armor: 3200, sp: 230, spellHit: 0.02 },
  },
  shamanMelee: {
    10: { str: 10, agi: 5, sta: 8, armor: 180 },
    30: { str: 65, agi: 30, int: 25, sta: 45, armor: 850 },
    60: { str: 200, agi: 100, int: 70, sta: 170, armor: 3200, hit: 0.04, critPhys: 0.03 },
  },
  shamanHealer: {
    10: { int: 8, spi: 5, sta: 6, armor: 150 },
    30: { int: 40, spi: 30, sta: 35, armor: 650, heal: 45, mp5: 5 },
    60: { int: 150, spi: 70, sta: 150, armor: 3200, heal: 450, mp5: 45, critSpell: 0.01 },
  },
  // Healing-focused pieces (Priest healers): +healing and mp5 instead of +spell damage.
  priestHealer: {
    30: { int: 38, spi: 34, sta: 32, armor: 280, sp: 0, heal: 45 },
    60: { int: 150, spi: 130, sta: 110, armor: 800, sp: 0, heal: 450, mp5: 30, critSpell: 0.01 },
  },
};
export const GEAR_NOTE =
  'Gear is our estimate of typical Classic gear at this level (WoW: Forever items are not public yet): quest greens at 10 and 30, fresh dungeon blues at 60.';

// Weapons per class and level: [min, max, speed]. Approximations of typical items.
export const WEAPONS = {
  bow: { 10: [9, 15, 2.7], 30: [30, 48, 2.8], 60: [104, 160, 3.0] },
  hunterMelee: { 10: [7, 12, 2.6], 30: [30, 46, 2.4], 60: [105, 160, 2.6] },
  // Survival dual-wields; white swings use the pair as one faster weapon (main hand + off hand
  // at 75 % with Predator's Edge), abilities use the main hand.
  hunterDual: { 30: [40, 60, 1.9], 60: [120, 163, 1.9] },
  hunterMH: { 30: [26, 46, 2.4], 60: [80, 150, 2.7] },
  wand: { 10: [9, 15, 1.5], 30: [28, 42, 1.6], 60: [58, 86, 1.6] },
  tank1h: { 10: [8, 15, 2.5], 30: [30, 53, 2.6], 60: [72, 135, 2.7] },
  // Warrior DPS: Arms two-hander; Fury main hand + off hand (real off-hand swings).
  twoHand: { 10: [18, 28, 3.3], 30: [68, 104, 3.5], 60: [160, 255, 3.7] },
  fury1h: { 10: [9, 17, 2.5], 30: [36, 66, 2.6], 60: [95, 165, 2.6] },
  // Rogues: main hand for abilities, and main hand + off hand (50 % + Dual Wield Specialization) as one weapon for white swings.
  rogueMH: { 30: [27, 51, 2.6], 60: [80, 150, 2.7] },
  // Player Rogues (phase 4): real main hand + off hand. Daggers for Assassination/Subtlety
  // (Backstab, Ambush, Mutilate need one), swords for Combat. Our estimate.
  dagger: { 10: [7, 13, 1.8], 30: [26, 48, 1.8], 60: [70, 130, 1.8] },
  rogueSword: { 10: [9, 17, 2.5], 30: [33, 62, 2.6], 60: [84, 156, 2.7] },
  rogueDual: { 30: [40, 54, 1.9], 60: [118, 152, 1.9] },
  casterMace: { 10: [7, 13, 2.5], 30: [25, 45, 2.6], 60: [60, 112, 2.5] },
};
// Hunters still use ammo and a quiver in Forever (Wowhead, Icy Veins). Arrow damage per second is
// added to every ranged weapon hit; the quiver speeds up Auto Shot. Typical Classic items:
// Rough / Sharp / Thorium Headed Arrows, and a small, heavy and Quickdraw-class quiver.
export const AMMO = { 10: { dps: 2.5, haste: 0.1 }, 30: { dps: 7.5, haste: 0.13 }, 60: { dps: 17.5, haste: 0.15 } };

// Class buffs by name (datamined Forever ranks; Mana Spring is the Classic rank). Self-buffs
// and buffs from group members are merged by name, so the same buff never counts twice.
export const BUFFS = {
  fortitude: { 10: { sta: 4 }, 30: { sta: 26 }, 60: { sta: 70 } },
  divineSpirit: { 30: { spi: 17 }, 60: { spi: 40 } },
  arcaneIntellect: { 10: { int: 2 }, 30: { int: 15 }, 60: { int: 31 } },
  innerFire: { 30: { armor: 720 }, 60: { armor: 1395 } },
  battleShout: { 30: { ap: 36 }, 60: { ap: 140 } },
  trueshot: { 60: { rap: 50 } },
  manaSpring: { 30: { mp5: 10 }, 60: { mp5: 25 } },
  strengthOfEarth: { 10: { str: 7 }, 30: { str: 14 }, 60: { str: 53 } },
  graceOfAir: { 60: { agi: 89 } },
  demonArmor: { 30: { armor: 300 }, 60: { armor: 570 } },
};
// Which buffs a group member of each class brings (Shaman totems as the buffs they give).
export const CLASS_BUFFS = {
  warrior: ['battleShout'],
  priest: ['fortitude', 'divineSpirit'],
  mage: ['arcaneIntellect'],
  hunter: ['trueshot'],
  shaman: ['manaSpring', 'strengthOfEarth', 'graceOfAir'],
};
export const buffsFromClasses = (classIds) => [...new Set(classIds.flatMap((c) => CLASS_BUFFS[c] || []))];
export function buffTotals(names, level) {
  const L = snapLevel(level);
  const out = {};
  for (const n of new Set(names || [])) for (const [k, v] of Object.entries((BUFFS[n] && BUFFS[n][L]) || {})) out[k] = (out[k] || 0) + v;
  return out;
}

// Build the stat block. pct: talent multipliers on attributes, e.g. { agi: 0.15 }.
// buffs: flat attribute buffs the character keeps on itself (Arcane Intellect, Fortitude …).
// Base attributes for a class/race pair. Pairs that are new in Forever (Orc Mage) take the
// class's own row plus the race's attribute offset; races are offset the same way in every class.
// Skyborne has no published attribute offset, so it gets none (the Human baseline).
const RACE_REF = 'warrior';
function raceOffset(race, L) {
  const ref = ATTR[RACE_REF];
  if (!ref[race] || !ref.human) return [0, 0, 0, 0, 0];
  return ref[race][L].map((v, i) => v - ref.human[L][i]);
}
export function baseAttrs(classId, race, L) {
  const rows = ATTR[classId];
  if (rows[race]) return rows[race][L];
  const known = Object.keys(rows).find((r) => ATTR[RACE_REF][r]);
  const base = rows[known][L];
  const off = raceOffset(race, L),
    offKnown = raceOffset(known, L);
  return base.map((v, i) => v + off[i] - offKnown[i]);
}

export function deriveStats({ classId, race, level, gear, buffs = {}, pct = {}, hpPct = 0 }) {
  const L = snapLevel(level);
  const [str0, agi0, sta0, int0, spi0] = baseAttrs(classId, race, L);
  const [baseHp, baseMana] = BASE[classId][L];
  const g = gear || {};
  const a = (k, base) => Math.round((base + (g[k] || 0) + (buffs[k] || 0)) * (1 + (pct[k] || 0)));
  const str = a('str', str0),
    agi = a('agi', agi0),
    sta = a('sta', sta0),
    int = a('int', int0),
    spi = a('spi', spi0);
  const fromSta = Math.min(sta, 20) + Math.max(0, sta - 20) * 10;
  const fromInt = Math.min(int, 20) + Math.max(0, int - 20) * 15;
  const levelAp = CASTER_AP[classId] ? -10 : L * 2 - 20;
  const ap = levelAp + str * AP_STR[classId] + agi * AP_AGI[classId] + (g.ap || 0) + (buffs.ap || 0);
  const rap = classId === 'hunter' ? L * 2 - 20 + agi * 2 + (g.ap || 0) + (g.rap || 0) + (buffs.rap || 0) : 0;
  const critPhys = (BASE_MELEE_CRIT[classId] + agi * atLevel(CRIT_PER_AGI[classId], L)) / 100 + (g.critPhys || 0);
  const critSpell = (BASE_SPELL_CRIT[classId] + int * atLevel(CRIT_PER_INT[classId], L)) / 100 + (g.critSpell || 0);
  const dodge = (BASE_DODGE[classId] + agi * atLevel(DODGE_PER_AGI[classId], L)) / 100;
  return {
    maxHp: Math.round((baseHp + fromSta) * (1 + hpPct)),
    mana: baseMana ? baseMana + fromInt : 0,
    armor: (g.armor || 0) + agi * 2 + (buffs.armor || 0),
    attrs: { str, agi, sta, int, spi },
    stats: { ap, rap, sp: g.sp || 0, heal: g.heal || 0, critPhys, critSpell, dodge, hit: g.hit || 0, spellHit: g.spellHit || 0, int, spi, agi },
    regen: { spirit: baseMana ? spiritRegen(classId, spi) : 0, mp5: ((g.mp5 || 0) + (buffs.mp5 || 0)) / 5, hpOOC: (HP_REGEN[classId] || HP_REGEN.mage)(spi) },
  };
}

// Hunter pet (Classic 1.12): level table from cmangos pet_levelstats, weapon damage
// level ± level/4 and attack power 2 × Str − 20 (mangos Pet::InitStatsForLevel), 2.0 s swings.
export function petStats(level) {
  const L = snapLevel(level);
  const [hp, armor, str, agi] = PET[L];
  const ap = str * 2 - 20;
  const bonus = (ap / 14) * 2.0;
  return {
    maxHp: hp,
    armor,
    melee: { min: Math.round(L - L / 4 + bonus), max: Math.round(L + L / 4 + bonus), speed: 2.0 },
    stats: { ap, agi, critPhys: 0.05, dodge: 0.05 },
  };
}
