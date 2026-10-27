// Classic 1.12 combat rules: armor, the melee/ranged attack table and spell hit.
//
// Sources: the attack-table research at github.com/magey/classic-warrior/wiki/Attack-table
// as implemented by the wowsims Classic/SoD simulator (github.com/wowsims/sod,
// sim/core/target.go), and the Classic armor formula. WoW: Forever has not
// announced changes to any of this, so these are classic-baseline rules.
//
// "Mob" means an enemy NPC. Players, pets and NPC party members use player rules;
// a unit with flags.playerLike (the duel opponent) is treated as a player too.

export const isMob = (u) => !!u && u.side === 'enemy' && !(u.flags && u.flags.playerLike);

// Physical damage reduction from armor, attacker level 1–60 (cap 75 %).
export function armorReduction(armor, attackerLevel) {
  const a = Math.max(0, armor || 0);
  return Math.min(0.75, a / (a + 400 + 85 * (attackerLevel || 1)));
}

// Average reduction from magic resistance (resistance points, not a fraction).
// Higher-level mobs add 2 % per level on top (non-binary spells).
export function resistReduction(resistance, attackerLevel, defenderLevel, defenderIsMob) {
  const cap = 5 * Math.max(1, attackerLevel || 1);
  let r = 0.75 * Math.min(1, Math.max(0, resistance || 0) / cap);
  if (defenderIsMob && defenderLevel > attackerLevel) r += 0.02 * (defenderLevel - attackerLevel);
  return Math.min(0.75, r);
}

// Chance for a spell to miss (be fully resisted) by level difference, before spell hit.
export function spellMissBase(attackerLevel, defenderLevel) {
  const d = (defenderLevel || 0) - (attackerLevel || 0);
  if (d <= 0) return Math.max(0.01, 0.04 + 0.01 * d);
  if (d <= 2) return 0.04 + 0.01 * d;
  return 0.17 + 0.11 * (d - 3);
}

// Melee/ranged attack table entries for one attacker/defender pair.
// Returns base chances; the caller adds the defender's own dodge/parry stats for players.
export function physicalTable(src, dst) {
  const atkL = src.level || 1;
  const defL = dst.level || 1;
  if (isMob(dst) && !isMob(src)) {
    const skill = 5 * atkL;
    const diff = 5 * defL - skill; // defense minus weapon skill
    const big = diff > 10;
    return {
      miss: big ? 0.05 + diff * 0.002 : 0.05 + diff * 0.001,
      hitSuppression: big ? (diff - 10) * 0.002 : 0,
      dodge: Math.max(0, 0.05 + diff * 0.001),
      parry: Math.max(0, big ? 0.05 + diff * 0.006 : 0.05 + diff * 0.001),
      glance: Math.max(0, 0.1 + diff * 0.02),
      glanceMin: Math.max(0.01, Math.min(0.91, 1.3 - 0.05 * diff)),
      glanceMax: Math.max(0.2, Math.min(0.99, 1.2 - 0.03 * diff)),
      critSuppression: (diff > 0 ? diff * 0.002 : diff * 0.0004) + (defL - atkL >= 3 ? 0.018 : 0),
      crush: 0,
      mobDefender: true,
    };
  }
  // Mob attacking a player (or players fighting each other): defense skill 5 × level.
  const levelDelta = 0.0004 * 5 * (defL - atkL);
  const d = atkL - defL;
  return {
    miss: Math.max(0, 0.05 + levelDelta),
    hitSuppression: 0,
    dodge: Math.max(0, levelDelta),
    parry: Math.max(0, levelDelta),
    glance: 0,
    glanceMin: 1,
    glanceMax: 1,
    critSuppression: isMob(src) ? levelDelta : 0,
    crush: isMob(src) && d >= 3 ? 0.15 + 0.1 * (d - 3) : 0,
    mobDefender: false,
  };
}

// Is `attacker` within the 180° arc in front of `defender`? (Parry and block need it.)
export function inFrontOf(defender, attacker) {
  const ang = Math.atan2(attacker.y - defender.y, attacker.x - defender.x);
  let d = Math.abs(ang - (defender.facing || 0)) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d <= Math.PI / 2;
}

// Spell crit suppression against higher-level mobs.
export function spellCritSuppression(attackerLevel, defenderLevel) {
  const d = defenderLevel - attackerLevel;
  return d >= 3 ? 0.021 : d === 2 ? 0.003 : 0;
}
