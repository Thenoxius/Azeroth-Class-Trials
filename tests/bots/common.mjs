// Shared bot building blocks. Policies are (state, ctl) => void, called before every step.
import * as G from '../../src/engine/geometry.js';
import { hpPct, resPct, hasAura, findAura } from '../../src/engine/core.js';

export { hasAura, findAura };

// Nearest engaged enemy, respecting the party focus (skull) and avoiding broken CC.
export function pickTarget(state, ctl, { pull = true } = {}) {
  const me = ctl.me();
  const focus = state.script.focusId && state.units[state.script.focusId];
  if (focus && focus.alive && !ccBreakable(focus)) return focus;
  const cur = state.units[me.target];
  const engaged = ctl.engaged().filter((e) => !ccBreakable(e) && !e.cc.immune);
  // A runner is the most urgent target: stop it before it brings help.
  const runner = engaged.find((e) => e.flags.fleeing);
  if (runner) return runner;
  if (cur && cur.alive && cur.side !== me.side && engaged.includes(cur)) return cur;
  if (engaged.length) return ctl.nearest(engaged);
  // Only crowd-controlled enemies left in this fight: finish them before pulling anything new.
  const held = ctl.engaged().filter((e) => !e.cc.immune);
  if (held.length) return ctl.nearest(held);
  if (!pull || state.script.noPull) return null;
  const quest = ctl.enemies().filter((e) => !e.evading && !e.flags.ignoreForVictory && !ccBreakable(e));
  return ctl.nearest(quest);
}

export const ccBreakable = (u) => u.auras.some((a) => a.def.breakOnDamage && a.def.debuff);

// Move into casting range (and line of sight); returns true while moving.
export function approach(state, ctl, t, range) {
  const me = ctl.me();
  const d = G.dist(me, t) - (t.radius || 0.8);
  const los = G.hasLoS(state.arena, me, t);
  if (d <= range && los) {
    if (me.move.to) ctl.stop();
    return false;
  }
  if (me.casting) return true;
  const goal = los ? G.towards(t, me, Math.max(1.5, range - 3)) : { x: t.x, y: t.y };
  ctl.moveTo(goal.x, goal.y);
  return true;
}

// Step away from melee attackers (kiting). Returns true while moving.
export function backOff(state, ctl, from, dist = 12) {
  const me = ctl.me();
  if (me.cc.root || me.cc.stun) return false;
  const best = escapePoint(state, ctl, from, dist);
  ctl.moveTo(best.x, best.y);
  return true;
}

// The best spot `dist` yards away: far from `from`, inside the arena, clear of
// obstacles, camps we have not pulled, hostile ground effects and exits.
export function escapePoint(state, ctl, from, dist = 12) {
  const me = ctl.me();
  // Score 16 directions: far from the attacker, inside the arena, clear of obstacles,
  // and well away from enemies we have not pulled (a competent player does not kite into a camp).
  const m = 2;
  const idle = state.list.filter((u) => u.alive && u.side !== me.side && !u.engaged && !u.hidden);
  // In a group, stay near the group (healers' range) instead of kiting into a corner.
  const group = state.list.filter((u) => u.alive && u.side === me.side && u.kind === 'ally');
  const centre = group.length >= 3 ? group.reduce((a, u) => ({ x: a.x + u.x / group.length, y: a.y + u.y / group.length }), { x: 0, y: 0 }) : null;
  let best = null;
  let bestScore = -Infinity;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const p = { x: me.x + Math.cos(a) * dist, y: me.y + Math.sin(a) * dist };
    if (p.x < m || p.x > state.arena.w - m || p.y < m || p.y > state.arena.h - m) continue;
    if ((state.arena.obstacles || []).some((o) => G.dist(p, o) < o.r + 1)) continue;
    let s = G.dist(p, from) * 1.5;
    if (centre) s -= Math.max(0, G.dist(p, centre) - 18) * 3;
    for (const e of idle) {
      const d = G.dist(p, e) - (e.aggroRadius || 8);
      if (d < 4) s -= (4 - d) * 6;
    }
    if (state.zones.some((z) => z.side !== me.side && !z.harmless && G.pointInZone(z, { ...p, radius: 3 }))) s -= 40;
    if (state.zones.some((z) => z.exit && G.pointInZone(z, { ...p, radius: 6 }))) s -= 400;
    if (s > bestScore) {
      bestScore = s;
      best = p;
    }
  }
  return best || { x: state.arena.w / 2, y: state.arena.h / 2 };
}

export const meleeOn = (state, ctl) => ctl.engaged().filter((e) => e.target === ctl.me().id && G.dist(e, ctl.me()) < 6.5);

// Out-of-combat recovery. Returns true while resting / waiting.
export function restIfNeeded(state, ctl, threshold = 0.55) {
  const me = ctl.me();
  if (ctl.engaged().length) return false;
  if (me.casting && me.casting.id === 'item.rest') {
    const full = hpPct(me) > 0.97 && (!me.res.mana || resPct(me, 'mana') > 0.97);
    if (full) ctl.stopCasting();
    return true;
  }
  const low = hpPct(me) < threshold || (me.res.mana && resPct(me, 'mana') < threshold);
  if (!low) return false;
  if (me.moving || me.move.to) ctl.stop();
  if (ctl.can('race.cannibalize') && hpPct(me) < 0.8) {
    ctl.cast('race.cannibalize');
    return true;
  }
  if (ctl.can('item.rest')) {
    ctl.cast('item.rest');
    return true;
  }
  return false;
}

// Step out of hostile ground effects.
export function dodge(state, ctl) {
  if (ctl.inDanger()) {
    if (ctl.me().casting && !ctl.me().casting.channel) ctl.stopCasting();
    ctl.escape();
    return true;
  }
  return false;
}

export function potions(state, ctl) {
  const me = ctl.me();
  if (hpPct(me) < 0.3 && ctl.can('item.healpot')) ctl.cast('item.healpot');
  else if (me.res.mana && resPct(me, 'mana') < 0.12 && ctl.engaged().length && ctl.can('item.manapot')) ctl.cast('item.manapot');
}

// Ally with a dispellable debuff of one of the given types.
export function dispelTarget(state, ctl, types) {
  const me = ctl.me();
  const party = state.list.filter((u) => u.alive && u.side === me.side && u.kind !== 'pet' && !u.hidden && G.dist(u, me) < 36);
  return party.find((u) => u.auras.some((a) => a.def.debuff && a.def.dispel && types.includes(a.def.dispel))) || null;
}

// An engaged enemy casting something interruptible within range (heals first).
export function interruptTarget(state, ctl, range) {
  const me = ctl.me();
  const list = ctl
    .engaged()
    .filter(
      (e) =>
        e.casting &&
        e.casting.ab.mechanic !== 'physical' &&
        !e.casting.ab.uninterruptible &&
        G.dist(e, me) - (e.radius || 0.8) <= range &&
        G.hasLoS(state.arena, me, e),
    );
  list.sort((a, b) => (b.casting.ab.category === 'heal') - (a.casting.ab.category === 'heal') || (a.casting.remaining ?? 9) - (b.casting.remaining ?? 9));
  return list[0] || null;
}

// The ally tank, if this is a group fight.
export const tankOf = (state, me) => state.list.find((u) => u.alive && u.side === me.side && u.role === 'tank' && u !== me);

// Raid threat discipline: am I about to pull something off the tank? Only counts enemies
// the tank is actually holding in melee (a ranged caster aimed at the tank is fair game).
export function threatHigh(state, ctl, limit = 0.9) {
  const me = ctl.me();
  for (const e of ctl.engaged()) {
    if (!e.threat || e.threat[me.id] === undefined) continue;
    const holder = state.units[e.target];
    if (!holder || holder === me || holder.role !== 'tank') continue;
    if (G.dist(holder, e) > (e.radius || 0.8) + (holder.radius || 0.8) + 4) continue;
    const mine = e.threat[me.id] || 0;
    const theirs = e.threat[holder.id] || 0;
    if (theirs > 0 && mine >= theirs * limit) return e;
  }
  return null;
}

// Group boss fights: ranged players hold a spot behind the boss (relative to its
// target) at `dist` yards, and drift back there after dodging. Returns true while moving.
export function holdRangedSpot(state, ctl, dist = 24) {
  const me = ctl.me();
  if (me.casting || !tankOf(state, me)) return false;
  const boss = ctl.engaged().find((e) => e.kind === 'boss');
  if (!boss) return false;
  // Anchor on the main tank (not on whoever the boss happens to hit), so the spot never flips sides.
  const holder = tankOf(state, me);
  if (!holder || G.dist(holder, boss) < 0.5) return false;
  const spot = G.behind(holder, boss, dist);
  spot.x = G.clamp(spot.x, 3, state.arena.w - 3);
  spot.y = G.clamp(spot.y, 3, state.arena.h - 3);
  if (state.zones.some((z) => z.side !== me.side && !z.harmless && G.pointInZone(z, spot))) return false;
  if (G.dist(me, spot) > 6) {
    ctl.moveTo(spot.x, spot.y);
    return true;
  }
  return false;
}

export function busy(me) {
  return !!me.casting || me.gcd > 0.05 || !!me.queued;
}

// Try a list of [abilityId, opts?, condition?] in order; cast the first usable one.
export function tryCast(ctl, list) {
  for (const it of list) {
    if (!it) continue;
    const [id, opts, cond] = Array.isArray(it) ? it : [it];
    if (cond === false) continue;
    if (ctl.can(id, opts)) {
      ctl.cast(id, opts);
      return id;
    }
  }
  return null;
}

// The careless baseline every class shares: only the filler on the current or
// nearest target; moves only to get into range; no rest, control or defensives.
export function carelessPolicy(filler, range = 28) {
  return (state, ctl) => {
    const me = ctl.me();
    if (!me || !me.alive) return;
    const t = pickTarget(state, ctl);
    if (!t) return;
    if (me.target !== t.id) ctl.target(t.id);
    if (approach(state, ctl, t, range)) return;
    if (busy(me)) return;
    const ab = me.ab[filler];
    if (ab && ab.toggle) {
      if (!me.autoRanged) ctl.cast(filler);
      return;
    }
    if (ctl.can(filler, { targetId: t.id })) ctl.cast(filler, { targetId: t.id });
    else if (ctl.can('mage.wand') && !me.autoRanged) ctl.cast('mage.wand');
    else if (ctl.can('priest.wand') && !me.autoRanged) ctl.cast('priest.wand');
  };
}
