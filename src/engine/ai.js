// NPC brains: enemies, party members and pets. Each unit with `ai` thinks
// every ai.interval seconds. Behaviours are plain functions (state, u) and
// encounters can register their own with registerBehavior(name, fn).
//
// ai config fields (all optional):
//   type: 'melee' | 'caster' | 'healer' | 'pet' | 'tank' | 'mdps' | 'rdps' | 'allyHealer' | 'idle' | <custom>
//   rotation: [{ id, when?(state,u,t), target?: 'target'|'self'|'lowestAlly'|'randomEnemy'|'healer'|fn, chance? }]
//   range: preferred casting range (casters)
//   react: seconds before reacting to new danger (zones, loose mobs)
//   skill: 0..1 — chance to dodge telegraphed zones in time (allies)
//   fleeAt: hp fraction at which the unit runs (runner mobs)
//   fleeTo: {x,y} destination when fleeing
//   patrol: [{x,y},...] idle path

import * as G from './geometry.js';
import { getBehavior } from './registry.js';
import {
  U,
  hostile,
  gap,
  canCast,
  startCast,
  threatTarget,
  engage,
  enemiesOf,
  alliesOf,
  hpPct,
  resPct,
  emit,
  say,
  canAct,
  MELEE_RANGE,
  player,
  nearest,
  cancelCast,
  zoneVictims,
  api,
} from './core.js';

export function thinkUnit(state, u, dt) {
  const ai = u.ai;
  ai.next -= dt;
  if (ai.next > 0) return;
  ai.next = ai.interval ?? 0.2;
  if (!canAct(u)) return;
  const fn = getBehavior(ai.type) || BEHAVIORS[ai.type] || BEHAVIORS.melee;
  fn(state, u, api);
}

// ---------------------------------------------------------------- helpers

export function stop(u) {
  u.move.to = null;
  u.move.dir = null;
}

export function moveToward(state, u, p, within = 0) {
  if (u.casting && !u.casting.ab.castWhileMoving) return;
  const d = G.dist(u, p);
  if (d <= within + 0.05) {
    u.move.to = null;
    return;
  }
  if (within > 0) {
    const n = G.norm(p.x - u.x, p.y - u.y);
    u.move.to = { x: p.x - n.x * within, y: p.y - n.y * within };
  } else u.move.to = { x: p.x, y: p.y };
}

export function inMelee(u, t) {
  return gap(u, t) <= (u.melee ? u.melee.range || MELEE_RANGE : MELEE_RANGE) - 0.4;
}

export function resolveRotTarget(state, u, r, t) {
  if (!r.target || r.target === 'target') return t;
  if (typeof r.target === 'function') return r.target(state, u, t);
  if (r.target === 'self') return u;
  if (r.target === 'lowestAlly') return lowestAlly(state, u, r.maxPct ?? 1);
  if (r.target === 'randomEnemy') {
    const foes = enemiesOf(state, u, (e) => G.dist(u, e) < 40 && e.kind !== 'pet');
    return foes.length ? foes[Math.floor(state.rng() * foes.length)] : t;
  }
  if (r.target === 'healer') return enemiesOf(state, u, (e) => e.role === 'healer')[0] || t;
  if (r.target === 'tank') return alliesOf(state, u, (a) => a.role === 'tank')[0] || null;
  return t;
}

export function lowestAlly(state, u, maxPct = 1) {
  let best = null,
    bp = maxPct;
  for (const a of alliesOf(state, u)) {
    const p = hpPct(a);
    if (p < bp - 1e-9) {
      bp = p;
      best = a;
    }
  }
  return best;
}

// Try abilities in priority order; returns true when something was started.
export function tryRotation(state, u, t, rotation) {
  const rot = rotation || u.ai.rotation || [];
  for (const r of rot) {
    const ab = u.ab[r.id];
    if (!ab) continue;
    if (r.chance !== undefined && state.rng() > r.chance) continue;
    const tgt = resolveRotTarget(state, u, r, t);
    if (!tgt && ab.target !== 'none' && ab.target !== 'self' && ab.target !== 'point') continue;
    // when(state, u, castTarget, focusTarget): self-cast entries still see the unit's real target.
    if (r.when && !r.when(state, u, tgt || t, t)) continue;
    const opts = { targetId: tgt ? tgt.id : undefined, noAuto: true };
    if (ab.target === 'point') opts.point = r.point ? r.point(state, u, tgt) : tgt ? { x: tgt.x, y: tgt.y } : { x: u.x, y: u.y };
    const chk = canCast(state, u, r.id, opts);
    if (!chk.ok) continue;
    if ((ab.castTime || ab.channel) && !ab.castWhileMoving) {
      stop(u);
      u.moving = false;
    }
    const res = startCast(state, u, r.id, opts);
    if (res.ok) {
      if (r.say) say(state, u, r.say, 'yell');
      return true;
    }
  }
  return false;
}

// Units standing in a hostile, telegraphed or active zone step out after their reaction delay.
const harms = (z, u) => z.side !== u.side && (z.affects === 'hostile' || z.affects === 'all') && !z.harmless;

// Is this spot inside a zone that would hurt u? NPCs check their home spot with it,
// so they wait at the edge instead of walking straight back into the fire they left.
export function zoneAt(state, u, p) {
  return state.zones.some((z) => harms(z, u) && G.pointInZone(z, { x: p.x, y: p.y, radius: u.radius }));
}

export function escapeZones(state, u) {
  const mem = u.ai.mem;
  const danger = state.zones.filter((z) => harms(z, u) && G.pointInZone(z, u));
  if (!danger.length) {
    mem.dangerSince = null;
    mem.escape = null;
    return false;
  }
  const z = danger[0];
  if (mem.dangerZone !== z.id) {
    mem.dangerZone = z.id;
    mem.dangerSince = state.t;
    const skill = u.ai.skill ?? 0.8;
    mem.willDodge = state.rng() < skill;
    mem.dodgeDelay = (u.ai.react ?? 0.8) * (0.6 + state.rng() * 0.8);
  }
  if (!mem.willDodge && !z.armed) return false; // misjudged the telegraph — gets hit, then moves
  if (!mem.willDodge && z.armed && state.t - mem.dangerSince < mem.dodgeDelay + 1.2) return false;
  if (state.t - mem.dangerSince < mem.dodgeDelay) return false;
  if (u.casting && !u.casting.channel) cancelCast(state, u, 'moved');
  const p = G.escapeClear(
    z,
    state.zones.filter((o) => harms(o, u)),
    u,
    2,
    state.arena,
  );
  p.x = G.clamp(p.x, 1, state.arena.w - 1);
  p.y = G.clamp(p.y, 1, state.arena.h - 1);
  u.move.to = p;
  mem.escape = p;
  return true;
}

const STEALTH_DETECT = 0.35;

export function checkAggro(state, u) {
  if (!u.aggroRadius || u.evading) return;
  for (const x of state.list) {
    if (!x.alive || x.side === u.side || x.hidden || x.flags.feigned) continue;
    // Stealth: noticed only at close range (approximation of Classic stealth detection).
    const r = u.aggroRadius * (x.flags.stealthed ? STEALTH_DETECT : 1);
    if (G.dist(u, x) <= r && G.hasLoS(state.arena, u, x)) {
      engage(state, u, x);
      return;
    }
  }
}

function patrol(state, u) {
  const p = u.ai.patrol;
  if (!p || !p.length) return;
  const mem = u.ai.mem;
  mem.pi = mem.pi ?? 0;
  const goal = p[mem.pi % p.length];
  if (G.dist(u, goal) < 0.6) {
    mem.pi++;
    mem.waitUntil = state.t + (u.ai.patrolWait ?? 1.5);
  }
  if (mem.waitUntil && state.t < mem.waitUntil) {
    stop(u);
    return;
  }
  u.move.to = { ...p[mem.pi % p.length] };
  u.home = { x: u.x, y: u.y };
}

function fleeCheck(state, u) {
  const ai = u.ai;
  if (!ai.fleeAt || u.flags.fled) return false;
  if (hpPct(u) > ai.fleeAt) return false;
  if (!u.flags.fleeing) {
    u.flags.fleeing = true;
    if (u.casting) cancelCast(state, u, 'flee');
    say(state, u, ai.fleeSay || `${u.name} attempts to run away in fear!`, 'emote');
    emit(state, { type: 'flee', src: u.id });
  }
  const to = ai.fleeTo || G.towards(U(state, u.target) || u, u, 40);
  u.move.to = { x: G.clamp(to.x, 1, state.arena.w - 1), y: G.clamp(to.y, 1, state.arena.h - 1) };
  if (G.dist(u, u.move.to) < 1.2) {
    u.flags.fled = true;
    u.flags.fleeing = false;
    emit(state, { type: 'fleeArrive', src: u.id });
    if (state.encounter.onFleeArrive) state.encounter.onFleeArrive(state, api, u);
  }
  return true;
}

// ---------------------------------------------------------------- enemy behaviours

function enemyPrelude(state, u) {
  if (u.evading) {
    u.move.to = { ...u.home };
    return null;
  }
  if (!u.engaged) {
    checkAggro(state, u);
    if (!u.engaged) {
      patrol(state, u);
      return null;
    }
  }
  if (fleeCheck(state, u)) return null;
  const t = threatTarget(state, u);
  if (!t) {
    stop(u);
    return null;
  }
  if (u.target !== t.id) {
    u.target = t.id;
    emit(state, { type: 'retarget', src: u.id, dst: t.id });
  }
  return t;
}

function melee(state, u) {
  const t = enemyPrelude(state, u);
  if (!t) return;
  if (u.casting) return;
  if (tryRotation(state, u, t)) return;
  if (!inMelee(u, t)) moveToward(state, u, t, (t.radius || 0.8) + (u.melee ? u.melee.range || MELEE_RANGE : MELEE_RANGE) - 1.2);
  else stop(u);
}

function caster(state, u) {
  const t = enemyPrelude(state, u);
  if (!t) return;
  if (u.casting) return;
  const range = u.ai.range ?? 28;
  const los = G.hasLoS(state.arena, u, t);
  if (u.cc.root && inMelee(u, t)) {
    if (tryRotation(state, u, t)) return;
    return;
  }
  // Out of mana casters walk in and melee (Classic NPC behaviour).
  const oom = u.res.mana && u.res.mana.cur < (u.ai.oomAt ?? 0);
  if (oom) {
    if (!inMelee(u, t)) moveToward(state, u, t, (t.radius || 0.8) + 3.5);
    else stop(u);
    return;
  }
  if (gap(u, t) > range || !los) {
    moveToward(state, u, t, los ? range - 2 : 0);
    return;
  }
  stop(u);
  if (tryRotation(state, u, t)) return;
  if (inMelee(u, t)) return;
}

function healerEnemy(state, u) {
  const t = enemyPrelude(state, u);
  if (!t) return;
  if (u.casting) return;
  stop(u);
  if (tryRotation(state, u, t)) return;
  const range = u.ai.range ?? 26;
  if (gap(u, t) > range || !G.hasLoS(state.arena, u, t)) moveToward(state, u, t, range - 3);
}

function idle(state, u) {
  if (u.engaged) melee(state, u);
}

// ---------------------------------------------------------------- pet

function pet(state, u) {
  const owner = U(state, u.ownerId);
  if (!owner || !owner.alive) {
    stop(u);
    return;
  }
  const mem = u.ai.mem;
  if (escapeZones(state, u)) return;
  let t = U(state, u.target);
  if (t && (!t.alive || !hostile(u, t) || t.evading || t.hidden)) {
    t = null;
    u.target = null;
    mem.attackOrder = null;
  }
  const ordered = mem.attackOrder && U(state, mem.attackOrder);
  if (ordered && ordered.alive) t = ordered;
  if (!ordered && u.petCmd !== 'stay') {
    if (u.petMode === 'defensive' && (!t || u.petCmd === 'follow')) {
      // Defend: whoever is beating on the owner or the pet.
      const attackers = enemiesOf(state, u, (e) => e.engaged && (e.target === owner.id || e.target === u.id) && !e.cc.incap && !hasCCBreakable(e));
      if (attackers.length) {
        t = nearest(attackers, u);
        u.petCmd = 'attack';
      }
    } else if (u.petMode === 'aggressive' && !t) {
      const near = enemiesOf(state, u, (e) => G.dist(u, e) < 18 && !e.cc.incap && !hasCCBreakable(e));
      if (near.length) {
        t = nearest(near, u);
        u.petCmd = 'attack';
      }
    }
  }
  if (u.petCmd === 'follow' && !ordered) t = null;
  if (u.petMode === 'passive' && !ordered) t = null;
  if (t && hasCCBreakable(t) && !ordered) t = null; // don't break CC on its own
  u.target = t ? t.id : null;
  if (u.casting) return;
  if (!t) {
    if (u.petCmd === 'stay' && mem.stayAt) {
      moveToward(state, u, mem.stayAt, 0.3);
      return;
    }
    const spot = {
      x: owner.x - Math.cos(owner.facing) * 2.2 + Math.cos(owner.facing + Math.PI / 2) * 1.4,
      y: owner.y - Math.sin(owner.facing) * 2.2 + Math.sin(owner.facing + Math.PI / 2) * 1.4,
    };
    if (G.dist(u, spot) > 1.5) moveToward(state, u, spot, 0.3);
    else stop(u);
    return;
  }
  // autocast abilities (Growl etc.), then close to melee.
  const rot = (u.ai.rotation || []).filter((r) => u.autocast[r.id] !== false);
  if (tryRotation(state, u, t, rot)) return;
  if (!inMelee(u, t)) moveToward(state, u, t, (t.radius || 0.8) + 1.4);
  else stop(u);
}

export function hasCCBreakable(u) {
  return u.auras.some((a) => a.def.breakOnDamage && a.def.debuff);
}

// ---------------------------------------------------------------- party members

function partyFocus(state, u) {
  // Per-unit assignment (u.ai.focusId) beats the shared skull (state.script.focusId); else the tank's target.
  const own = u.ai.focusId && U(state, u.ai.focusId);
  if (own && own.alive && !hasCCBreakable(own)) return own;
  const f = state.script.focusId && U(state, state.script.focusId);
  if (f && f.alive && f.engaged !== false && !hasCCBreakable(f)) return f;
  const tank = alliesOf(state, u, (a) => a.role === 'tank')[0];
  const tt = tank && U(state, tank.target);
  if (tt && tt.alive && hostile(u, tt) && !hasCCBreakable(tt)) return tt;
  const foes = enemiesOf(state, u, (e) => e.engaged && !hasCCBreakable(e) && !e.cc.incap);
  return nearest(foes, tank || u);
}

function tank(state, u) {
  const mem = u.ai.mem;
  if (escapeZones(state, u)) return;
  mem.loose = mem.loose || {};
  const foes = enemiesOf(state, u, (e) => e.engaged && !hasCCBreakable(e));
  // Pick up loose mobs after a human-ish delay.
  let loose = null;
  // A raid main tank (ai.noPickup) stays on its target and leaves adds to the off-tank.
  for (const e of u.ai.noPickup ? [] : foes) {
    const tgt = U(state, e.target);
    if (tgt && tgt !== u && tgt.side === u.side) {
      mem.loose[e.id] = mem.loose[e.id] ?? state.t;
      if (state.t - mem.loose[e.id] > (u.ai.react ?? 1.2)) loose = loose || e;
    } else delete mem.loose[e.id];
  }
  let t = U(state, u.target);
  if (loose) {
    t = loose;
    if (u.ai.taunt && canCast(state, u, u.ai.taunt, { targetId: loose.id, noAuto: true }).ok) {
      startCast(state, u, u.ai.taunt, { targetId: loose.id, noAuto: true });
      delete mem.loose[loose.id];
    }
  }
  if (!t || !t.alive || !hostile(u, t) || hasCCBreakable(t)) {
    const f = state.script.tankFocusId && U(state, state.script.tankFocusId);
    t = f && f.alive ? f : nearest(foes, u);
  }
  if (!t) {
    const spot = u.ai.restSpot || state.script.tankSpot;
    if (spot) moveToward(state, u, spot, 0.5);
    else stop(u);
    return;
  }
  u.target = t.id;
  if (u.casting) return;
  if (tryRotation(state, u, t)) return;
  const spot = state.script.tankSpot;
  if (spot && inMelee(u, t) && G.dist(u, spot) > 2.5 && t.target === u.id) {
    // Drag the boss to the tank spot.
    moveToward(state, u, spot, 0.3);
    return;
  }
  if (!inMelee(u, t)) moveToward(state, u, t, (t.radius || 0.8) + 1.4);
  else stop(u);
}

function mdps(state, u) {
  if (escapeZones(state, u)) return;
  const t = partyFocus(state, u);
  if (!t) {
    followLeader(state, u);
    return;
  }
  u.target = t.id;
  if (u.casting) return;
  if (tryRotation(state, u, t)) return;
  // Behind = away from whoever the target is hitting (it faces them), not from any tank:
  // an off-tank holding an add elsewhere would otherwise put the melee in the boss's cleave.
  const victim = U(state, t.target);
  const anchor = victim && victim.alive && victim !== u ? victim : alliesOf(state, u, (a) => a.role === 'tank')[0];
  const spot = meleeSpot(state, u, t, anchor ? G.behind(anchor, t, (t.radius || 0.8) + 1.3) : t);
  if (!spot) {
    stop(u);
    return;
  }
  if (!inMelee(u, t) || G.dist(u, spot) > 2.2) moveToward(state, u, spot, 0.2);
  else stop(u);
}

// The spot behind the target, swung around its back when fire covers it (never into
// the front cone); null when every candidate burns, so the NPC holds where it is.
function meleeSpot(state, u, t, spot) {
  if (!zoneAt(state, u, spot)) return spot;
  const a0 = Math.atan2(spot.y - t.y, spot.x - t.x);
  const d = Math.hypot(spot.x - t.x, spot.y - t.y);
  for (const da of [0.5, -0.5, 1, -1, 1.4, -1.4]) {
    const p = { x: t.x + Math.cos(a0 + da) * d, y: t.y + Math.sin(a0 + da) * d };
    if (!zoneAt(state, u, p)) return p;
  }
  return null;
}

function rdps(state, u) {
  if (escapeZones(state, u)) return;
  const t = partyFocus(state, u);
  if (!t) {
    followLeader(state, u);
    return;
  }
  u.target = t.id;
  if (u.casting) return;
  const range = u.ai.range ?? 26;
  if (gap(u, t) > range || !G.hasLoS(state.arena, u, t)) {
    moveToward(state, u, u.ai.spot || t, u.ai.spot ? 0.3 : range - 4);
    return;
  }
  if (u.ai.spot && G.dist(u, u.ai.spot) > 3 && !zoneAt(state, u, u.ai.spot)) {
    moveToward(state, u, u.ai.spot, 0.3);
    return;
  }
  stop(u);
  if (u.ranged && u.ranged.kind === 'autoshot') u.autoRanged = true;
  tryRotation(state, u, t);
}

function allyHealer(state, u) {
  if (escapeZones(state, u)) return;
  if (u.casting) {
    // Cancel a heal on someone who got topped off (smart healers do).
    const c = u.casting;
    const tgt = U(state, c.targetId);
    if (!c.channel && tgt && hpPct(tgt) > 0.97 && c.remaining > 0.4 && c.ab.category === 'heal') cancelCast(state, u, 'overheal');
    return;
  }
  const spot = u.ai.spot;
  const party = alliesOf(state, u, (a) => a.kind !== 'pet' || (u.ai.healPets ?? true));
  // tankBias < 1 makes a tank's missing health count for more (raid healers on tank duty).
  const eff = (a) => hpPct(a) * (a.role === 'tank' ? (u.ai.tankBias ?? 1) : 1);
  const hurt = party.filter((a) => hpPct(a) < 0.92).sort((a, b) => eff(a) - eff(b));
  if (hurt.length) {
    const tgt = hurt[0];
    if (gap(u, tgt) > 36 || !G.hasLoS(state.arena, u, tgt)) {
      moveToward(state, u, tgt, 26);
      return;
    }
    stop(u);
    if (tryRotation(state, u, tgt)) return;
  }
  if (spot && G.dist(u, spot) > 2 && !zoneAt(state, u, spot)) {
    moveToward(state, u, spot, 0.3);
    return;
  }
  // Nothing to heal: help with damage if configured.
  if (u.ai.dpsRotation) {
    const t = partyFocus(state, u);
    if (t && gap(u, t) <= 30 && G.hasLoS(state.arena, u, t)) tryRotation(state, u, t, u.ai.dpsRotation);
  }
}

function followLeader(state, u) {
  const p = player(state);
  const lead = (u.ai.follow && U(state, u.ai.follow)) || p;
  if (!lead || lead === u) {
    stop(u);
    return;
  }
  const off = u.ai.followOffset || { x: -2, y: 1.5 };
  const spot = { x: lead.x + off.x, y: lead.y + off.y };
  if (G.dist(u, spot) > 2.5) moveToward(state, u, spot, 0.5);
  else stop(u);
}

export const BEHAVIORS = { melee, caster, healer: healerEnemy, idle, pet, tank, mdps, rdps, allyHealer, follow: followLeader };
