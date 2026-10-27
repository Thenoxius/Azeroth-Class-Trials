// Azeroth Class Trials — combat simulation core.
//
// Real-time, fixed-step simulation (call step(state, dt) with dt ≈ 0.05–0.1s).
// Everything the rules need lives in `state`; the UI only reads it and sends
// commands (playerCast, setMoveDir, moveTo, setTarget, petCommand, ...).
// The model is a simplified, explicitly approximate take on Classic-era WoW
// combat: 1.5s global cooldown, cast times, channels, mana with the
// five-second rule, threat tables, crowd control with diminishing returns,
// line of sight around obstacles, projectiles and telegraphed ground effects.

import { makeRng } from './rng.js';
import * as G from './geometry.js';
import { getAbility, getTemplate, getBehavior, resolveAbility, num } from './registry.js';
import { thinkUnit } from './ai.js';
import { armorReduction, resistReduction, spellMissBase, physicalTable, inFrontOf, spellCritSuppression, isMob } from './combat.js';

export const GCD = 1.5;
export const SPELL_QUEUE = 0.4;
export const MELEE_RANGE = 5;
export const FSR_SECONDS = 5;
export const PUSHBACK = 0.5;
export const MAX_PUSHBACKS = 2;
export const DR_RESET = 15;

// ---------------------------------------------------------------- battle setup

export function createBattle(encounter, opts = {}) {
  const seed = opts.seed ?? 1;
  const state = {
    t: 0,
    seed,
    rng: makeRng(seed),
    encounter,
    opts: { level: encounter.level ?? 10, ...opts },
    arena: { w: 60, h: 34, obstacles: [], ...(encounter.arena || {}) },
    units: {},
    list: [],
    nextId: 1,
    playerId: null,
    projectiles: [],
    zones: [],
    events: [],
    log: [],
    evSeq: 0,
    outcome: null,
    combat: false,
    combatStart: null,
    script: {},
    flags: { pvpDR: false, ...(encounter.flags || {}) },
    meters: { dmg: {}, heal: {}, overheal: {}, taken: {}, absorbed: {} },
    banner: null, // {text, sub, until} short centre-screen announcements
    objectives: [],
  };
  arenaObstacles(state);
  if (encounter.setup) encounter.setup(state, api);
  return state;
}

function arenaObstacles(state) {
  state.arena.obstacles = (state.arena.obstacles || []).map((o, i) => ({ id: 'o' + i, ...o }));
}

export function spawnUnit(state, tpl, o = {}) {
  const base = typeof tpl === 'string' ? getTemplate(tpl) : tpl;
  if (!base) throw new Error('Unknown template ' + tpl);
  const d = { ...base, ...o };
  const level = d.level ?? state.opts.level ?? 10;
  const u = {
    id: d.id || 'u' + state.nextId++,
    templateId: d.templateId || null,
    name: d.name || 'Unknown',
    side: d.side || 'enemy',
    kind: d.kind || 'enemy',
    ownerId: d.ownerId || null,
    petId: null,
    classId: d.classId || null,
    role: d.role || null,
    level,
    portrait: d.portrait || 'generic',
    color: d.color || null,
    tags: d.tags || [],
    elite: !!d.elite,
    x: d.x ?? 10,
    y: d.y ?? 10,
    facing: d.facing ?? 0,
    radius: d.radius ?? 0.8,
    speed: d.speed ?? 7,
    maxHp: d.maxHp ?? 100,
    hp: d.hp ?? d.maxHp ?? 100,
    res: {},
    primary: d.resource || null,
    regen: { spirit: 0, mp5: 0, castRegen: 0, hpOOC: 0, hpIC: 0, focus: 0, energy: 0, rageDecay: 0, ...(d.regen || {}) },
    stats: { sp: 0, ap: 0, rap: 0, heal: 0, critSpell: 0.05, critPhys: 0.05, ...(d.stats || {}) },
    physMit: d.physMit ?? 0.1,
    armor: d.armor ?? null,
    resist: d.resist || {},
    melee: d.melee ? { range: MELEE_RANGE, ...d.melee } : null,
    ranged: d.ranged ? { ...d.ranged } : null,
    swingT: d.melee ? d.melee.speed * 0.5 : 0,
    rangedT: 0,
    stillFor: 1,
    autoMelee: d.autoMelee ?? d.kind !== 'player',
    autoRanged: false,
    abilities: [...(d.abilities || [])],
    ab: {},
    cds: {},
    cdTotal: {},
    gcd: 0,
    gcdTotal: GCD,
    schoolLock: {},
    casting: null,
    queued: null,
    auras: [],
    cc: emptyCC(),
    target: d.target || null,
    threat: d.side === 'enemy' ? {} : null,
    taunt: null,
    ai: d.ai ? { interval: 0.2, react: 1.0, ...d.ai, next: 0, mem: {} } : null,
    move: { dir: null, to: null },
    moving: false,
    engaged: false,
    home: { x: d.x ?? 10, y: d.y ?? 10 },
    aggroRadius: d.aggroRadius ?? 0,
    group: d.group || null,
    evading: false,
    leash: d.leash ?? 60,
    alive: true,
    deadAt: null,
    lastSpendT: -99,
    lastHostileT: -99,
    immune: { ...(d.immune || {}) },
    hooks: d.hooks || {},
    autocast: { ...(d.autocast || {}) },
    flags: { ...(d.flags || {}) },
    threatMod: d.threatMod ?? 1,
    isPlayer: !!d.isPlayer,
    petMode: d.petMode || 'defensive',
    petCmd: d.petCmd || 'follow',
    dr: {},
    meta: d.meta || {},
    spawnedAt: state.t,
    hidden: !!d.hidden,
  };
  for (const [k, v] of Object.entries(d.resources || {})) {
    const max = typeof v === 'number' ? v : v.max;
    const cur = typeof v === 'number' ? (k === 'rage' ? 0 : v) : v.cur ?? v.max;
    u.res[k] = { cur, max };
  }
  if (!u.primary) u.primary = Object.keys(u.res)[0] || null;
  for (const id of u.abilities) learn(u, id);
  if (d.auras) for (const a of d.auras) applyAura(state, u, u, a, { silent: true });
  state.units[u.id] = u;
  state.list.push(u);
  if (u.ownerId && state.units[u.ownerId] && u.kind === 'pet') state.units[u.ownerId].petId = u.id;
  emit(state, { type: 'spawn', dst: u.id });
  return u;
}

export function learn(u, id) {
  const def = getAbility(id);
  if (!def) throw new Error('Unknown ability ' + id);
  u.ab[id] = resolveAbility(def, u.level);
  if (!u.abilities.includes(id)) u.abilities.push(id);
}

export function removeUnit(state, u) {
  delete state.units[u.id];
  state.list = state.list.filter((x) => x !== u);
}

// ---------------------------------------------------------------- events

export function emit(state, ev) {
  ev.t = state.t;
  ev.seq = ++state.evSeq;
  state.events.push(ev);
  return ev;
}

export function drainEvents(state) {
  const e = state.events;
  state.events = [];
  return e;
}

export function say(state, unit, text, kind = 'say') {
  emit(state, { type: 'say', src: unit ? unit.id : null, text, kind });
}

export function banner(state, text, sub = '', secs = 2.5, tone = 'info') {
  state.banner = { text, sub, until: state.t + secs, tone, seq: ++state.evSeq };
  emit(state, { type: 'banner', text, sub, tone });
}

// ---------------------------------------------------------------- queries

export const U = (state, id) => (id ? state.units[id] : null);
export const player = (state) => state.units[state.playerId];
export const hostile = (a, b) => !!a && !!b && a.side !== b.side;
export const gap = (a, b) => G.edgeDist(a, b);
export const alive = (u) => !!u && u.alive;

export function enemiesOf(state, u, filter) {
  return state.list.filter((x) => x.alive && !x.hidden && x.side !== u.side && (!filter || filter(x)));
}
export function alliesOf(state, u, filter) {
  return state.list.filter((x) => x.alive && !x.hidden && x.side === u.side && (!filter || filter(x)));
}
export function unitsInRadius(state, p, r, filter) {
  return state.list.filter((x) => x.alive && !x.hidden && G.dist(p, x) <= r + (x.radius || 0) * 0.5 && (!filter || filter(x)));
}
export function nearest(list, p) {
  let best = null, bd = Infinity;
  for (const x of list) {
    const d = G.dist(p, x);
    if (d < bd) { bd = d; best = x; }
  }
  return best;
}
export function hpPct(u) {
  return u ? u.hp / u.maxHp : 0;
}
export function resPct(u, k) {
  const r = u && u.res[k || u.primary];
  return r ? r.cur / r.max : 0;
}
export function hasAura(u, id, srcId) {
  return !!findAura(u, id, srcId);
}
export function findAura(u, id, srcId) {
  if (!u) return null;
  return u.auras.find((a) => a.id === id && (!srcId || a.srcId === srcId)) || null;
}
export function auraRemaining(u, id, srcId) {
  const a = findAura(u, id, srcId);
  return a ? a.remaining : 0;
}

// Sum/product of numeric aura mods. mods may be numbers or {school: n}.
export function modMult(u, key, school) {
  let m = 1;
  for (const a of u.auras) {
    const v = a.def.mods && a.def.mods[key];
    if (v === undefined) continue;
    const per = typeof v === 'object' ? v[school] ?? v.all : v;
    if (per !== undefined) m *= Math.pow(per, a.def.stackMods ? a.stacks : 1);
  }
  return m;
}
// Like modMult, but keyed by school AND kind at once: each aura counts once
// (an {all: x} mod must not apply twice, once for the school and once for the kind).
export function modMultFor(u, key, school, kind) {
  let m = 1;
  for (const a of u.auras) {
    const v = a.def.mods && a.def.mods[key];
    if (v === undefined) continue;
    let per;
    if (typeof v === 'object') {
      const s = v[school];
      const k = v[kind];
      per = s !== undefined || k !== undefined ? (s ?? 1) * (k ?? 1) : v.all;
    } else per = v;
    if (per !== undefined) m *= Math.pow(per, a.def.stackMods ? a.stacks : 1);
  }
  return m;
}

// Effective power stat including additive aura buffs: mods.statAdd = { sp, ap, rap, heal }.
export function statOf(u, key) {
  if (!u) return 0;
  return (u.stats[key] || 0) + modAdd(u, 'statAdd', key);
}

export function modAdd(u, key, school) {
  let s = 0;
  for (const a of u.auras) {
    const v = a.def.mods && a.def.mods[key];
    if (v === undefined) continue;
    const per = typeof v === 'object' ? v[school] ?? v.all : v;
    if (per !== undefined) s += per * (a.def.stackMods ? a.stacks : 1);
  }
  return s;
}

function emptyCC() {
  return { stun: false, root: false, incap: false, fear: false, silence: false, disarm: false, frozen: false, immune: false, slow: 0, haste: 0, castSlow: 0, fearSrc: null };
}

function computeCC(u) {
  const cc = emptyCC();
  let maxSlow = 0, maxSpeed = 0;
  for (const a of u.auras) {
    const d = a.def;
    const list = d.cc ? (Array.isArray(d.cc) ? d.cc : [d.cc]) : [];
    for (const c of list) {
      if (c === 'stun') cc.stun = true;
      else if (c === 'root') cc.root = true;
      else if (c === 'incap') cc.incap = true;
      else if (c === 'fear') { cc.fear = true; cc.fearSrc = a.srcId; }
      else if (c === 'silence') cc.silence = true;
      else if (c === 'disarm') cc.disarm = true;
    }
    if (d.frozen) cc.frozen = true;
    if (d.immune) cc.immune = true;
    if (d.mods) {
      if (d.mods.slow) maxSlow = Math.max(maxSlow, d.mods.slow);
      if (d.mods.speed) maxSpeed = Math.max(maxSpeed, d.mods.speed);
      if (d.mods.castSlow) cc.castSlow = Math.max(cc.castSlow, d.mods.castSlow);
    }
  }
  cc.slow = maxSlow;
  cc.haste = maxSpeed;
  u.cc = cc;
}

export function canAct(u) {
  return u.alive && !u.cc.stun && !u.cc.incap && !u.cc.fear;
}

export function inCombat(state, u) {
  if (!u) return false;
  if (u.side === 'enemy') return u.engaged;
  return state.combat;
}

// ---------------------------------------------------------------- abilities

export const REASONS = {
  dead: 'You are dead',
  cc: "Can't do that while incapacitated",
  silenced: "Can't do that while silenced",
  locked: 'That school is locked out',
  casting: 'Another action is in progress',
  gcd: 'Ability not ready yet',
  cooldown: 'Ability not ready yet',
  nores: 'Not enough ',
  notarget: 'You have no target',
  invalid: 'Invalid target',
  range: 'Out of range',
  minrange: 'Target is too close',
  los: 'Target not in line of sight',
  moving: "Can't do that while moving",
  combat: "Can't do that while in combat",
  nopet: 'You have no pet',
  petdead: 'Your pet is dead',
  petalive: 'Your pet is alive',
  unknown: 'Unknown ability',
  immune: 'Target is immune',
  feigned: 'You are feigning death',
  rooted: "Can't do that while rooted",
  disarmed: 'You are disarmed',
};

export function reasonText(reason, ab, u) {
  if (!reason) return '';
  if (reason.startsWith('custom:')) return reason.slice(7);
  if (reason === 'nores') {
    const k = costKey(ab) || (u && u.primary) || 'mana';
    return 'Not enough ' + k;
  }
  return REASONS[reason] || reason;
}

function costKey(ab) {
  if (!ab || !ab.cost) return null;
  return Object.keys(ab.cost).find((k) => k !== 'pct') || null;
}

export function abilityCost(u, ab) {
  if (!ab.cost) return null;
  const out = {};
  for (const [k, v] of Object.entries(ab.cost)) {
    if (k === 'pct') continue;
    let c = num(ab, v);
    if (ab.costPct && u.res[k]) c = Math.round(u.res[k].max * num(ab, ab.costPct));
    c *= modMult(u, 'costMult', ab.school);
    if (ab.costMultFn) c *= ab.costMultFn(u, ab);
    out[k] = Math.max(0, Math.round(c));
  }
  return out;
}

function hasCost(u, ab) {
  const c = abilityCost(u, ab);
  if (!c) return true;
  for (const [k, v] of Object.entries(c)) if (!u.res[k] || u.res[k].cur + 1e-9 < v) return false;
  return true;
}

function payCost(state, u, ab) {
  const c = abilityCost(u, ab);
  if (!c) return true;
  if (!hasCost(u, ab)) return false;
  for (const [k, v] of Object.entries(c)) {
    if (v <= 0) continue;
    u.res[k].cur -= v;
    if (k === 'mana') u.lastSpendT = state.t;
  }
  return true;
}

export function castTimeOf(u, ab) {
  let ct = num(ab, ab.castTime, 0);
  if (ct <= 0) return 0;
  ct *= modMult(u, 'castTime', ab.school);
  if (ab.castTimeMultFn) ct *= ab.castTimeMultFn(u, ab);
  if (u.cc.castSlow) ct *= 1 + u.cc.castSlow;
  return Math.max(0, ct);
}

export function cooldownOf(u, ab) {
  return num(ab, ab.cooldown, 0) * modMult(u, 'cooldown', ab.id);
}

function resolveTarget(state, u, ab, opts) {
  const tt = ab.target || 'enemy';
  if (tt === 'self' || tt === 'none') return { t: u };
  if (tt === 'point') return { t: null };
  if (tt === 'pet') {
    const p = U(state, u.petId);
    if (!p) return { reason: 'nopet' };
    if (!p.alive && !ab.allowDead) return { reason: 'petdead' };
    if (p.alive && ab.requireDeadPet) return { reason: 'petalive' };
    return { t: p };
  }
  let t = opts.targetId ? U(state, opts.targetId) : U(state, u.target);
  if (tt === 'enemy') {
    if (!t || !t.alive || !hostile(u, t) || t.hidden) {
      if (opts.noAuto) return { reason: 'notarget' };
      // Pure lookup: canCast runs every frame for the action bar, so the
      // target only changes in startCast. A living friend stays selected and
      // the spell goes to that friend's target (assist), else the nearest foe.
      const friend = t && t.alive && !t.hidden && !hostile(u, t) ? t : null;
      const assist = friend && friend !== u ? U(state, friend.target) : null;
      t = assist && assist.alive && !assist.hidden && hostile(u, assist) ? assist : autoTarget(state, u, ab);
      if (!t) return { reason: 'notarget' };
      return { t, auto: friend ? 'assist' : 'switch' };
    }
    return { t };
  }
  if (tt === 'ally') {
    if (!t || !t.alive || hostile(u, t)) t = u;
    return { t };
  }
  if (tt === 'deadAlly') {
    if (!t || t.alive || hostile(u, t)) return { reason: 'invalid' };
    return { t };
  }
  if (tt === 'any') {
    if (!t || !t.alive) t = u;
    return { t };
  }
  return { t };
}

function autoTarget(state, u, ab) {
  const range = num(ab, ab.range, 30) + 5;
  const foes = enemiesOf(state, u, (e) => e.engaged || u.side === 'enemy');
  const near = foes.filter((e) => gap(u, e) <= range);
  return nearest(near.length ? near : foes, u);
}

export function canCast(state, u, id, opts = {}) {
  const ab = u.ab[id];
  if (!ab) return { ok: false, reason: 'unknown' };
  if (!u.alive) return { ok: false, reason: 'dead', ab };
  if (!canAct(u) && !ab.usableWhileCC) return { ok: false, reason: 'cc', ab };
  if (u.cc.stun && ab.usableWhileCC && !ab.breaksStun) return { ok: false, reason: 'cc', ab };
  const physical = ab.mechanic === 'physical';
  if (u.cc.silence && !physical && !ab.usableWhileCC) return { ok: false, reason: 'silenced', ab };
  if (!physical && u.schoolLock[ab.school] > state.t) return { ok: false, reason: 'locked', ab };
  if (ab.noRoot && u.cc.root) return { ok: false, reason: 'rooted', ab }; // Charge / Intercept
  if (u.cc.disarm && ab.mechanic === 'physical' && !ab.ranged && ab.category !== 'consumable' && num(ab, ab.range, MELEE_RANGE) <= MELEE_RANGE && ab.target !== 'self' && ab.target !== 'none' && ab.target !== 'pet') return { ok: false, reason: 'disarmed', ab };
  if (u.casting && !opts.ignoreCasting) return { ok: false, reason: 'casting', ab };
  const gcd = ab.gcd ?? GCD;
  if (gcd > 0 && u.gcd > 1e-6 && !opts.ignoreGcd) return { ok: false, reason: 'gcd', ab };
  if ((u.cds[id] || 0) > 1e-6) return { ok: false, reason: 'cooldown', ab };
  if (!hasCost(u, ab)) return { ok: false, reason: 'nores', ab };
  if (ab.outOfCombat && inCombat(state, u)) return { ok: false, reason: 'combat', ab };
  const ct = castTimeOf(u, ab);
  if ((ct > 0 || ab.channel) && u.moving && !ab.castWhileMoving) return { ok: false, reason: 'moving', ab };
  const r = resolveTarget(state, u, ab, opts);
  if (r.reason) return { ok: false, reason: r.reason, ab };
  const t = r.t;
  if (t && t !== u && ab.target !== 'pet' && !ab.noRangeCheck) {
    const range = num(ab, ab.range, ab.mechanic === 'physical' && !ab.ranged ? MELEE_RANGE : 30);
    if (gap(u, t) > range) return { ok: false, reason: 'range', ab, t };
    const minR = num(ab, ab.minRange, 0);
    if (minR && gap(u, t) < minR) return { ok: false, reason: 'minrange', ab, t };
    if (!ab.ignoreLoS && !G.hasLoS(state.arena, u, t)) return { ok: false, reason: 'los', ab, t };
  }
  if (t && ab.target === 'pet' && !ab.noRangeCheck && ab.range && G.dist(u, t) > num(ab, ab.range)) return { ok: false, reason: 'range', ab, t };
  if (ab.target === 'point' && opts.point && ab.range && G.dist(u, opts.point) > num(ab, ab.range) + 0.5) return { ok: false, reason: 'range', ab };
  if (ab.canUse) {
    const c = ab.canUse({ state, u, t, ab, opts, api });
    if (c !== true && c !== undefined) return { ok: false, reason: typeof c === 'string' ? c : 'invalid', ab, t };
  }
  return { ok: true, ab, t, auto: r.auto };
}

// An offensive spell that picked its own target: with no (hostile) target the
// player now targets it; with a friend selected the friend stays selected and
// auto-attacks (the wand) keep shooting the assisted foe.
function applyAutoTarget(u, t, auto) {
  if (!auto || !t || !(u.isPlayer || u.kind === 'player')) return;
  if (auto === 'switch') u.target = t.id;
  else u.assistId = t.id;
}

export function startCast(state, u, id, opts = {}) {
  const chk = canCast(state, u, id, opts);
  if (!chk.ok) {
    if (u.isPlayer || opts.reportFail) emit(state, { type: 'error', src: u.id, ability: id, reason: chk.reason, text: reasonText(chk.reason, chk.ab, u) });
    return chk;
  }
  const { ab, t } = chk;
  applyAutoTarget(u, t, chk.auto);
  const point = opts.point || (ab.target === 'point' ? (t ? { x: t.x, y: t.y } : { x: u.x, y: u.y }) : null);
  if (t && t !== u) u.facing = G.angleTo(u, t);
  else if (point && (point.x !== u.x || point.y !== u.y)) u.facing = G.angleTo(u, point);
  const gcd = ab.gcd ?? GCD;
  if (gcd > 0) {
    u.gcd = gcd * modMult(u, 'gcd');
    u.gcdTotal = u.gcd;
  }
  breakStealthLike(state, u, ab);
  if (ab.mechanic !== 'physical' && u.ranged && u.ranged.kind === 'wand' && u.autoRanged && !ab.keepsWand) {
    u.autoRanged = false;
    u.wandResume = !!u.flags.wandMacro;
  }
  if (ab.startsAutoShot && u.ranged && u.ranged.kind === 'autoshot') u.autoRanged = true;
  if (ab.startsMelee) u.autoMelee = true;
  const ct = castTimeOf(u, ab);
  emit(state, { type: 'castStart', src: u.id, dst: t ? t.id : null, ability: id, cat: ab.category, castTime: ct, channel: !!ab.channel });
  if (ab.channel) {
    if (!payCost(state, u, ab)) return { ok: false, reason: 'nores' };
    startCooldown(u, ab);
    // Channels scale with 'channelTime' mods only, so cast-time effects (Presence of Mind) leave them alone.
    const dur = num(ab, ab.channel.duration, 3) * modMult(u, 'channelTime', ab.school);
    const ticks = num(ab, ab.channel.ticks, 3);
    u.casting = { id, ab, targetId: t ? t.id : null, point, channel: true, duration: dur, elapsed: 0, ticks, ticksDone: 0, interval: dur / ticks, nextTick: ab.channel.tickOnStart ? 0 : dur / ticks, cut: 0, pushbacks: 0, startedAt: state.t };
    if (ab.onChannelStart) ab.onChannelStart({ state, u, t, ab, point, api });
    // A channel counts as cast when it starts (telemetry + on-cast talents such as Clearcasting).
    emit(state, { type: 'cast', src: u.id, dst: t ? t.id : null, ability: id, cat: ab.category, tags: ab.tags || null, channel: true, x: point ? point.x : null, y: point ? point.y : null });
    runHooks(state, u, 'onCast', { ab, t, point });
    if (ab.channel.tickOnStart) {
      u.casting.nextTick = dur / ticks;
      u.casting.ticksDone = 1;
      channelTick(state, u, u.casting);
    }
    return { ok: true, ab };
  }
  if (ct > 0) {
    u.casting = { id, ab, targetId: t ? t.id : null, point, channel: false, total: ct, remaining: ct, pushbacks: 0, startedAt: state.t };
    return { ok: true, ab };
  }
  if (!payCost(state, u, ab)) return { ok: false, reason: 'nores' };
  startCooldown(u, ab);
  resolveCast(state, u, ab, t, point);
  return { ok: true, ab };
}

function breakStealthLike(state, u, ab) {
  // Feign Death / Fade-like auras flagged cancelOnAction end when acting.
  for (const a of [...u.auras]) if (a.def.cancelOnAction && !(ab && ab.keepsAura === a.id)) removeAura(state, u, a, 'action');
}

function startCooldown(u, ab) {
  const cd = cooldownOf(u, ab);
  if (cd > 0) {
    u.cds[ab.id] = cd;
    u.cdTotal[ab.id] = cd;
  }
  if (ab.sharedCooldown) {
    for (const [otherId, secs] of Object.entries(ab.sharedCooldown)) {
      if ((u.cds[otherId] || 0) < secs) {
        u.cds[otherId] = secs;
        u.cdTotal[otherId] = secs;
      }
    }
  }
}

export function cancelCast(state, u, reason = 'cancel') {
  const c = u.casting;
  if (!c) return;
  u.casting = null;
  if (c.channel && c.ab.onChannelEnd) c.ab.onChannelEnd({ state, u, ab: c.ab, api, reason });
  if (!c.channel && reason !== 'complete') {
    // A cast that never finished does not keep the full GCD lock on the player.
    if (u.isPlayer) u.gcd = Math.min(u.gcd, 0);
  }
  emit(state, { type: 'castStop', src: u.id, ability: c.id, reason, channel: c.channel });
}

export function interruptCast(state, target, src, lockout = 4, abilityId) {
  const c = target && target.casting;
  if (!c) {
    emit(state, { type: 'interruptMiss', src: src && src.id, dst: target && target.id, ability: abilityId });
    return false;
  }
  if (c.ab.mechanic === 'physical' || c.ab.uninterruptible) {
    emit(state, { type: 'interruptMiss', src: src && src.id, dst: target.id, ability: abilityId });
    return false;
  }
  const school = c.ab.school;
  target.schoolLock[school] = state.t + lockout * (target.kind === 'boss' ? 0.5 : 1);
  cancelCast(state, target, 'interrupted');
  emit(state, { type: 'interrupt', src: src && src.id, dst: target.id, ability: abilityId, interrupted: c.id, school });
  return true;
}

function completeCast(state, u) {
  const c = u.casting;
  const ab = c.ab;
  const t = c.targetId ? U(state, c.targetId) : null;
  if (t && t !== u && ab.target !== 'pet' && !ab.noRangeCheck) {
    const range = num(ab, ab.range, 30);
    if (gap(u, t) > range + 4) return failCast(state, u, 'range');
    if (!ab.ignoreLoS && !G.hasLoS(state.arena, u, t)) return failCast(state, u, 'los');
  }
  if (t && !t.alive && !ab.allowDeadTarget && ab.target !== 'deadAlly' && ab.target !== 'pet') return failCast(state, u, 'invalid');
  if (!payCost(state, u, ab)) return failCast(state, u, 'nores');
  u.casting = null;
  startCooldown(u, ab);
  emit(state, { type: 'castStop', src: u.id, ability: c.id, reason: 'complete', channel: false });
  resolveCast(state, u, ab, t, c.point);
}

function failCast(state, u, reason) {
  const c = u.casting;
  u.casting = null;
  emit(state, { type: 'castStop', src: u.id, ability: c.id, reason, channel: false });
  if (u.isPlayer) emit(state, { type: 'error', src: u.id, ability: c.id, reason, text: reasonText(reason, c.ab, u) });
}

function resolveCast(state, u, ab, t, point) {
  emit(state, { type: 'cast', src: u.id, dst: t ? t.id : null, ability: ab.id, cat: ab.category, tags: ab.tags || null, x: point ? point.x : null, y: point ? point.y : null });
  runHooks(state, u, 'onCast', { ab, t, point });
  if (ab.onCast) ab.onCast({ state, u, t, ab, point, api });
  if (ab.projectile && t && t !== u) {
    spawnProjectile(state, u, t, { speed: ab.projectile.speed ?? 28, visual: ab.projectile.visual || ab.school, ab, effects: ab.effects || [], point });
  } else {
    applyEffects(state, u, ab, t, point, ab.effects || []);
  }
}

function channelTick(state, u, c) {
  const t = c.targetId ? U(state, c.targetId) : null;
  if (t && !t.alive && c.ab.target === 'enemy') {
    cancelCast(state, u, 'targetdead');
    return;
  }
  const effects = c.ab.channel.effects || c.ab.effects || [];
  const ctxExtra = { tick: c.ticksDone, ticks: c.ticks };
  if (c.ab.channel.projectile && t) {
    spawnProjectile(state, u, t, { speed: c.ab.channel.projectile.speed ?? 30, visual: c.ab.channel.projectile.visual || c.ab.school, ab: c.ab, effects, extra: ctxExtra });
  } else {
    applyEffects(state, u, c.ab, t, c.point, effects, ctxExtra);
  }
  if (c.ab.onTick) c.ab.onTick({ state, u, t, ab: c.ab, api, tick: c.ticksDone });
  emit(state, { type: 'channelTick', src: u.id, dst: t ? t.id : null, ability: c.id, tick: c.ticksDone });
}

function finishChannel(state, u) {
  const c = u.casting;
  u.casting = null;
  if (c.ab.onChannelEnd) c.ab.onChannelEnd({ state, u, ab: c.ab, api, reason: 'complete' });
  emit(state, { type: 'castStop', src: u.id, ability: c.id, reason: 'complete', channel: true });
}

// ---------------------------------------------------------------- effects

export function applyEffects(state, u, ab, primary, point, effects, extra = {}) {
  for (const e of effects) {
    if (e.chance !== undefined && state.rng() > num(ab, e.chance)) continue;
    if (e.if && !e.if({ state, u, t: primary, ab, api, ...extra })) continue;
    const targets = effectTargets(state, u, ab, e, primary, point);
    for (const t of targets) {
      const h = EFFECTS[e.type];
      if (!h) throw new Error('Unknown effect ' + e.type);
      h(state, u, t, e, ab, { point, primary, ...extra });
    }
  }
}

function effectTargets(state, u, ab, e, primary, point) {
  if (e.aoe) {
    const center = e.aoe.center === 'self' ? u : e.aoe.center === 'point' ? point || u : primary || point || u;
    if (!center) return [];
    const affects = e.aoe.affects || (e.type === 'heal' ? 'allies' : 'enemies');
    const coneDef = e.aoe.cone ? { x: center.x, y: center.y, shape: { type: 'cone', range: num(ab, e.aoe.radius, 10), angle: num(ab, e.aoe.cone, Math.PI / 2), dir: primary && primary !== u && e.aoe.center === 'self' ? G.angleTo(u, primary) : u.facing } } : null;
    let list = unitsInRadius(state, center, num(ab, e.aoe.radius, 8), (x) => {
      if (coneDef && !G.pointInZone(coneDef, x)) return false;
      if (affects === 'enemies') return hostile(u, x);
      if (affects === 'allies') return !hostile(u, x);
      if (affects === 'party') return !hostile(u, x) && x.kind !== 'pet';
      return true;
    });
    if (e.aoe.excludePrimary && primary) list = list.filter((x) => x !== primary);
    if (e.aoe.los !== false) list = list.filter((x) => G.hasLoS(state.arena, center, x));
    if (e.aoe.maxTargets) list = list.sort((a, b) => G.dist(center, a) - G.dist(center, b)).slice(0, num(ab, e.aoe.maxTargets));
    return list;
  }
  if (e.to === 'self') return [u];
  if (e.to === 'pet') return U(state, u.petId) ? [U(state, u.petId)] : [];
  if (e.to === 'owner') return U(state, u.ownerId) ? [U(state, u.ownerId)] : [];
  if (e.to === 'none') return [null];
  return primary ? [primary] : [];
}

export function rollAmount(state, ab, e, key = 'amount') {
  const v = e[key];
  let lo, hi;
  if (Array.isArray(v)) { lo = v[0]; hi = v[1]; }
  else if (typeof v === 'string') {
    const r = ab[v];
    if (Array.isArray(r)) { lo = r[0]; hi = r[1]; } else { lo = hi = r || 0; }
  } else if (typeof v === 'function') { const r = v(ab); if (Array.isArray(r)) { lo = r[0]; hi = r[1]; } else lo = hi = r; }
  else { lo = hi = v || 0; }
  return lo + (hi - lo) * state.rng();
}

const EFFECTS = {
  damage(state, u, t, e, ab, x) {
    if (!t) return;
    let amount = rollAmount(state, ab, e);
    if (e.perTick && x.ticks) amount = amount / 1;
    dealDamage(state, u, t, {
      amount,
      coef: num(ab, e.coef, 0),
      power: e.power,
      school: e.school || ab.school || 'physical',
      kind: e.kind || (ab.mechanic === 'physical' ? (ab.ranged ? 'ranged' : 'melee') : 'spell'),
      ability: ab.id,
      threat: num(ab, e.threat, 1),
      critBonus: num(ab, e.critBonus, 0) + (e.critBonusFn ? e.critBonusFn({ state, u, t, ab }) : 0),
      critMult: e.critMult,
      canCrit: e.canCrit,
      noMiss: e.noMiss || ab.noMiss,
      isTick: !!x.ticks && !e.notTick,
      bonusMult: e.multFn ? e.multFn({ state, u, t, ab }) : 1,
      flatThreat: num(ab, e.flatThreat, 0),
    });
  },
  heal(state, u, t, e, ab, x) {
    if (!t) return;
    healUnit(state, u, t, { amount: rollAmount(state, ab, e), coef: num(ab, e.coef, 0), ability: ab.id, canCrit: e.canCrit, isTick: !!x.ticks });
  },
  aura(state, u, t, e, ab) {
    const dst = e.to === 'self' ? u : t;
    if (!dst) return;
    applyAura(state, u, dst, materializeAura(e.aura, ab), { ab });
  },
  removeAura(state, u, t, e) {
    const dst = e.to === 'self' ? u : t;
    if (!dst) return;
    for (const a of [...dst.auras]) if (a.id === e.id) removeAura(state, dst, a, 'removed');
  },
  interrupt(state, u, t, e, ab) {
    interruptCast(state, t, u, num(ab, e.lockout, 4), ab.id);
  },
  dispel(state, u, t, e, ab) {
    dispelUnit(state, u, t, e.types || ['magic'], num(ab, e.count, 1), e.which || (hostile(u, t) ? 'buff' : 'debuff'), ab.id);
  },
  resource(state, u, t, e, ab) {
    const dst = e.to === 'self' ? u : t || u;
    const r = dst.res[e.resource || dst.primary];
    if (!r) return;
    const amt = e.pct ? r.max * num(ab, e.pct) : rollAmount(state, ab, e);
    const before = r.cur;
    r.cur = G.clamp(r.cur + amt, 0, r.max);
    emit(state, { type: 'resource', src: u.id, dst: dst.id, resource: e.resource || dst.primary, amount: r.cur - before, ability: ab.id });
  },
  threat(state, u, t, e, ab) {
    if (e.mode === 'drop') dropThreat(state, u, num(ab, e.value, 1));
    else if (e.mode === 'taunt' && t) taunt(state, u, t, num(ab, e.duration, 3));
    else if (e.mode === 'add' && t) addThreat(state, t, u, num(ab, e.value, 100));
  },
  teleport(state, u, t, e, ab, x) {
    const d = num(ab, e.distance, 20);
    let dest;
    if (e.mode === 'blink') {
      const dir = u.move.dir && (u.move.dir.x || u.move.dir.y) ? u.move.dir : { x: Math.cos(u.facing), y: Math.sin(u.facing) };
      dest = { x: u.x + dir.x * d, y: u.y + dir.y * d };
      // stop at obstacles along the path
      const steps = 20;
      let last = { x: u.x, y: u.y };
      for (let i = 1; i <= steps; i++) {
        const p = { x: u.x + dir.x * (d * i / steps), y: u.y + dir.y * (d * i / steps), radius: u.radius };
        if ((state.arena.obstacles || []).some((o) => o.solid !== false && G.dist(p, o) < o.r + u.radius)) break;
        last = p;
      }
      dest = last;
    } else if (e.mode === 'toTarget' && t) {
      dest = G.towards(t, u, (t.radius || 0.8) + u.radius + 0.3);
    } else if (e.mode === 'behindTarget' && t) {
      dest = { x: t.x - Math.cos(t.facing) * 2, y: t.y - Math.sin(t.facing) * 2 };
    } else if (e.mode === 'point' && x.point) {
      dest = x.point;
    } else if (e.mode === 'back') {
      const away = { x: u.x - Math.cos(u.facing) * d, y: u.y - Math.sin(u.facing) * d };
      dest = away;
    }
    if (!dest) return;
    const fx = u.x, fy = u.y;
    u.x = dest.x; u.y = dest.y;
    G.collide(state.arena, u);
    u.move.to = null;
    emit(state, { type: 'teleport', src: u.id, fx, fy, x: u.x, y: u.y, ability: ab.id, mode: e.mode });
  },
  knockback(state, u, t, e, ab) {
    if (!t || t.immune.knockback) return;
    const d = num(ab, e.distance, 8);
    const n = G.norm(t.x - u.x, t.y - u.y);
    const fx = t.x, fy = t.y;
    t.x += n.x * d; t.y += n.y * d;
    G.collide(state.arena, t);
    if (t.casting && !t.casting.channel) cancelCast(state, t, 'knockback');
    emit(state, { type: 'teleport', src: t.id, fx, fy, x: t.x, y: t.y, ability: ab.id, mode: 'knockback' });
  },
  summon(state, u, t, e, ab, x) {
    const at = e.at === 'target' && t ? t : e.at === 'point' && x.point ? x.point : u;
    const count = num(ab, e.count, 1);
    for (let i = 0; i < count; i++) {
      const ang = state.rng() * Math.PI * 2;
      const s = spawnUnit(state, e.template, { x: at.x + Math.cos(ang) * (e.spread || 2), y: at.y + Math.sin(ang) * (e.spread || 2), side: e.side || u.side, ownerId: e.owned ? u.id : null, level: u.level, ...(e.overrides || {}) });
      if (e.engage && t && hostile(s, t)) engage(state, s, t);
    }
  },
  zone(state, u, t, e, ab, x) {
    const at = e.at === 'self' ? u : e.at === 'point' ? x.point || u : t || x.point || u;
    spawnZone(state, { ...e.zone, owner: u.id, side: u.side, x: at.x, y: at.y, ab: ab });
  },
  custom(state, u, t, e, ab, x) {
    e.fn({ state, u, t, ab, api, ...x });
  },
};

export function registerEffect(type, fn) {
  EFFECTS[type] = fn;
}

// Ability-relative aura: string refs like duration:'dur' resolve against ab.
function materializeAura(def, ab) {
  if (!def) return def;
  const out = { ...def };
  for (const k of ['duration', 'absorb', 'breakDamage']) if (typeof out[k] === 'string' || typeof out[k] === 'function') out[k] = num(ab, out[k]);
  if (def.tick) {
    out.tick = { ...def.tick };
    for (const k of ['interval', 'coef']) if (typeof out.tick[k] === 'string' || typeof out.tick[k] === 'function') out.tick[k] = num(ab, out.tick[k]);
    if (typeof out.tick.amount === 'string') out.tick.amount = ab[out.tick.amount];
    else if (typeof out.tick.amount === 'function') out.tick.amount = out.tick.amount(ab);
  }
  return out;
}

// ---------------------------------------------------------------- damage & healing

function runHooks(state, u, name, payload) {
  if (!u || !u.hooks) return;
  const h = u.hooks[name];
  if (h) h({ state, u, api, ...payload });
}

export function dealDamage(state, src, dst, p) {
  if (!dst || !dst.alive) return 0;
  const school = p.school || 'physical';
  if (dst.evading || dst.cc.immune || dst.immune.damage) {
    emit(state, { type: 'immune', src: src && src.id, dst: dst.id, ability: p.ability });
    return 0;
  }
  if (dst.immune[school]) {
    emit(state, { type: 'immune', src: src && src.id, dst: dst.id, ability: p.ability });
    return 0;
  }
  const kind = p.kind || (school === 'physical' ? 'melee' : 'spell');
  let amt = p.amount || 0;
  if (src && p.coef) {
    const powerKey = p.power || (kind === 'ranged' ? 'rap' : school === 'physical' ? 'ap' : 'sp');
    // Debuffs like Hunter's Mark add attack power for attacks against their holder.
    amt += p.coef * (statOf(src, powerKey) + modAdd(dst, 'attackerPower', powerKey));
  }
  if (src) amt *= modMultFor(src, 'dmgDone', school, kind);
  amt *= modMultFor(dst, 'dmgTaken', school, kind);
  // Debuffs that only amplify their own caster's damage (Improved Shadow Bolt, Shadow Weaving, Improved Scorch).
  if (src) for (const a of dst.auras) {
    const v = a.srcId === src.id && a.def.mods && a.def.mods.dmgTakenMine;
    if (!v) continue;
    const per = typeof v === 'object' ? v[school] ?? v.all : v;
    if (per !== undefined) amt *= Math.pow(per, a.def.stackMods ? a.stacks : 1);
  }
  amt *= p.bonusMult || 1;
  amt *= 1 - mitigationOf(src, dst, school, p);
  const physCrit = school === 'physical' || kind === 'melee' || kind === 'ranged';
  // Weapon attacks use the Classic attack table; spells use level-based spell hit.
  const table = src && (kind === 'melee' || kind === 'ranged') ? physicalTable(src, dst) : null;
  const critSup = !src ? 0 : table ? table.critSuppression : !isMob(src) && isMob(dst) ? spellCritSuppression(src.level, dst.level) : 0;
  const critBase = p.canCrit === false || (p.isTick && !p.canCrit) ? 0 : (src ? (physCrit ? src.stats.critPhys : src.stats.critSpell) + modAdd(src, 'crit', school) : 0) + (p.critBonus || 0) + (dst ? modAdd(dst, 'critTaken', school) : 0);
  const pk = {
    ...p,
    school,
    kind,
    amount: amt,
    crit: false,
    critChance: critBase > 0 ? Math.max(0, critBase - critSup) : 0,
    critMult: p.critMult || (physCrit && kind !== 'spell' ? 2 : 1.5),
    dst,
    src,
  };
  runHooks(state, src, 'beforeDamage', { pk, dst });
  runHooks(state, dst, 'beforeDamageTaken', { pk, src });
  if (src && src.ownerId) runHooks(state, U(state, src.ownerId), 'beforePetDamage', { pk, dst });
  // White melee swings resolve on one roll (miss, dodge, parry, glancing, crushing, crit, hit);
  // specials, ranged and spells roll hit first and crit separately.
  let whiteRoll = null, whiteEdge = 0, glancing = false, crushing = false, blocked = false;
  if (!p.noMiss && !p.isTick && src) {
    const roll = state.rng();
    let edge, avoid = null;
    if (table) {
      const hit = Math.max(0, (src.stats.hit || 0) + modAdd(src, 'hit') - table.hitSuppression);
      const dualWield = p.ability === 'melee' && src.melee && src.melee.dualWield ? 0.19 : 0;
      edge = pk.missChance ?? p.missChance ?? Math.max(0, table.miss + dualWield - hit);
      if (roll >= edge && kind === 'melee' && !p.noAvoid) {
        edge += table.dodge + (dst.stats.dodge || 0) + modAdd(dst, 'dodge');
        if (roll < edge) avoid = 'dodge';
        else {
          const ownParry = (dst.stats.parry || 0) + modAdd(dst, 'parry');
          if ((table.mobDefender || ownParry > 0) && inFrontOf(dst, src)) {
            edge += table.parry + ownParry;
            if (roll < edge) avoid = 'parry';
          }
        }
      }
      // Shield block (players with a shield, from the front): the hit lands, minus the block value.
      if (roll >= edge && !avoid && kind === 'melee' && !p.noAvoid && (dst.stats.block || 0) + modAdd(dst, 'block') > 0 && inFrontOf(dst, src)) {
        edge += (dst.stats.block || 0) + modAdd(dst, 'block');
        if (roll < edge) blocked = true;
      }
      if (roll >= edge && !avoid && !blocked && p.ability === 'melee') {
        if (roll < edge + table.glance) glancing = true;
        else if (roll < edge + table.glance + table.crush) crushing = true;
        whiteRoll = roll;
        whiteEdge = edge + table.glance + table.crush;
      }
    } else {
      const hit = (src.stats.spellHit || 0) + modAdd(src, 'spellHit', school);
      edge = pk.missChance ?? p.missChance ?? Math.max(0.01, spellMissBase(src.level, dst.level) - hit);
    }
    if (roll < edge || avoid) {
      emit(state, { type: 'miss', src: src.id, dst: dst.id, ability: p.ability, school, kind, resist: kind === 'spell' && !avoid, avoid });
      if (avoid) runHooks(state, dst, 'onAvoid', { src, avoid, pk });
      if (dst.threat) addThreat(state, dst, src, 1);
      combatTouch(state, src, dst);
      return 0;
    }
  }
  if (blocked) {
    pk.amount = Math.max(0, pk.amount - (dst.stats.blockValue || 0) - modAdd(dst, 'blockValue'));
    pk.blocked = true;
    runHooks(state, dst, 'onAvoid', { src, avoid: 'block', pk });
  } else if (glancing) pk.amount *= table.glanceMin + (table.glanceMax - table.glanceMin) * state.rng();
  else if (crushing) pk.amount *= 1.5;
  else if (pk.critChance > 0 && (whiteRoll !== null ? whiteRoll < whiteEdge + pk.critChance : state.rng() < pk.critChance)) {
    pk.crit = true;
    pk.amount *= pk.critMult * (src ? modMult(src, 'critDamage', school) : 1);
  }
  let final = Math.max(0, Math.round(pk.amount));
  let absorbed = 0;
  if (final > 0) {
    for (const a of [...dst.auras].reverse()) {
      if (!a.absorbLeft || a.absorbLeft <= 0) continue;
      if (a.def.absorbSchools && !a.def.absorbSchools.includes(school)) continue;
      let take = Math.min(a.absorbLeft, final);
      const drain = a.def.absorbDrain; // Mana Shield: each point absorbed costs resource
      if (drain) {
        const r = dst.res[drain.resource || 'mana'];
        take = Math.min(take, r ? Math.floor(r.cur / drain.per) : 0);
        if (r) r.cur -= take * drain.per;
        if (take <= 0) { removeAura(state, dst, a, 'consumed'); continue; }
      }
      a.absorbLeft -= take;
      final -= take;
      absorbed += take;
      if (a.absorbLeft <= 0) removeAura(state, dst, a, 'consumed');
      if (final <= 0) break;
    }
  }
  const before = dst.hp;
  dst.hp -= final;
  const overkill = dst.hp < 0 ? -dst.hp : 0;
  const ownerId = src ? src.ownerId || src.id : null;
  if (src) {
    state.meters.dmg[src.id] = (state.meters.dmg[src.id] || 0) + Math.min(final, before);
    if (absorbed) state.meters.absorbed[dst.id] = (state.meters.absorbed[dst.id] || 0) + absorbed;
  }
  state.meters.taken[dst.id] = (state.meters.taken[dst.id] || 0) + final;
  // Rage (Classic 1.12): a white hit gives 15d/(4c) + f·s/2 (at most 15d/c, f 3.5 or 7 on a crit,
  // s weapon speed); damage taken gives 2.5d/c, with c the level's rage conversion value.
  if (src && src.res.rage && p.ability === 'melee' && !pk.noRage && final > 0) {
    const c = rageConversion(src.level);
    gainRage(src, Math.min((15 * final) / c, (15 * final) / (4 * c) + ((pk.crit ? 7 : 3.5) * (src.melee ? src.melee.speed : 2)) / 2));
  }
  if (dst.res.rage && final > 0) gainRage(dst, (2.5 * final) / rageConversion(dst.level));
  emit(state, { type: 'damage', src: src && src.id, owner: ownerId, dst: dst.id, ability: p.ability, amount: final, absorbed, overkill, crit: pk.crit, blocked: !!pk.blocked, school, kind, tick: !!p.isTick });
  if (src && dst.threat) {
    const thr = (final + absorbed) * (p.threat ?? 1) + (p.flatThreat || 0);
    addThreat(state, dst, src, thr);
  }
  combatTouch(state, src, dst);
  if (final > 0) {
    // Pushback: real damage (not absorbed) delays casts / shortens channels.
    const c = dst.casting;
    if (c && !c.ab.noPushback) {
      const resist = Math.min(1, modAdd(dst, 'pushbackResist', c.ab.school));
      if (state.rng() >= resist) {
        if (c.channel) {
          if (c.pushbacks < MAX_PUSHBACKS) { c.cut += c.duration * 0.25; c.pushbacks++; emit(state, { type: 'pushback', dst: dst.id }); }
        } else if (c.pushbacks < MAX_PUSHBACKS) {
          c.remaining = Math.min(c.total, c.remaining + PUSHBACK);
          c.pushbacks++;
          emit(state, { type: 'pushback', dst: dst.id });
        }
      }
    }
    for (const a of [...dst.auras]) {
      if (a.def.breakOnDamage && !(p.isTick && a.def.ignoreTicks)) {
        if (a.srcId === (src && src.id) && a.def.selfDamageOk) continue;
        removeAura(state, dst, a, 'broken');
      } else if (a.def.breakDamage) {
        a.taken = (a.taken || 0) + final;
        if (a.taken >= a.def.breakDamage * (a.def.breakDamagePct ? dst.maxHp : 1)) removeAura(state, dst, a, 'broken');
      }
    }
  }
  for (const a of [...dst.auras]) if (a.def.onHolderDamaged && dst.auras.includes(a)) a.def.onHolderDamaged({ state, u: dst, aura: a, api, src, final, absorbed, pk });
  runHooks(state, src, 'afterDamage', { pk, dst, final, absorbed });
  runHooks(state, dst, 'afterDamageTaken', { pk, src, final, absorbed });
  if (state.encounter.onDamage) state.encounter.onDamage(state, api, { src, dst, amount: final, absorbed, ability: p.ability, crit: pk.crit, school, kind });
  if (dst.hp <= 0) {
    if (dst.hooks.preventDeath && dst.hooks.preventDeath({ state, u: dst, api, src })) {
      dst.hp = Math.max(1, dst.hp);
    } else {
      dst.hp = 0;
      killUnit(state, dst, src);
    }
  }
  return final;
}

// Armor (Classic formula) for physical hits; bleeds ignore armor. Magic: resistance
// points plus the level-based partial resists of higher-level mobs. Units without an
// armor value fall back to a flat physMit fraction; resist values below 1 are fractions.
function mitigationOf(src, dst, school, p) {
  const atkL = src ? src.level : dst.level;
  if (school === 'physical') {
    if (p.ignoreArmor) return 0;
    if (dst.armor === null || dst.armor === undefined) return dst.physMit || 0;
    if (p.isTick) return 0;
    return armorReduction(effectiveArmor(dst), atkL);
  }
  if (p.noResist) return 0;
  const r = dst.resist[school] || 0;
  if (r > 0 && r < 1) return r;
  if (!src || !isMob(dst) || isMob(src)) return r ? resistReduction(r + modAdd(dst, 'statAdd', 'resist'), atkL, dst.level, false) : 0;
  return resistReduction(r + modAdd(dst, 'statAdd', 'resist'), atkL, dst.level, true);
}

export const rageConversion = (L) => 0.0091107836 * L * L + 3.225598133 * L + 4.2652911;
export function gainRage(u, amt) {
  const r = u.res.rage;
  if (!r || !(amt > 0)) return;
  r.cur = Math.min(r.max, r.cur + amt * modMult(u, 'rageGain'));
}

export function effectiveArmor(u) {
  if (u.armor === null || u.armor === undefined) return null;
  return Math.max(0, (u.armor + modAdd(u, 'statAdd', 'armor')) * modMult(u, 'armorMult'));
}

export function healUnit(state, src, dst, p) {
  if (!dst || !dst.alive) return 0;
  let amt = p.amount || 0;
  if (src && p.coef) amt += p.coef * (statOf(src, 'heal') + statOf(src, 'sp') * (p.spScale ?? 0));
  if (src) amt *= modMult(src, 'healDone');
  amt *= modMult(dst, 'healTaken');
  let crit = false;
  if (src && !p.isTick && p.canCrit !== false && state.rng() < (src.stats.critSpell || 0) + modAdd(src, 'healCrit') + (p.critBonus || 0)) {
    crit = true;
    amt *= 1.5;
  }
  const pk = { amount: amt, crit, ability: p.ability, isTick: p.isTick };
  runHooks(state, src, 'beforeHeal', { pk, dst });
  amt = Math.round(pk.amount);
  const missing = dst.maxHp - dst.hp;
  const eff = Math.max(0, Math.min(missing, amt));
  const over = amt - eff;
  dst.hp += eff;
  if (src) {
    state.meters.heal[src.id] = (state.meters.heal[src.id] || 0) + eff;
    state.meters.overheal[src.id] = (state.meters.overheal[src.id] || 0) + over;
  }
  emit(state, { type: 'heal', src: src && src.id, dst: dst.id, ability: p.ability, amount: eff, overheal: over, crit, tick: !!p.isTick });
  if (src && eff > 0) healThreat(state, src, dst, eff);
  runHooks(state, src, 'afterHeal', { dst, eff, over, pk });
  return eff;
}

function healThreat(state, src, dst, eff) {
  const foes = state.list.filter((e) => e.alive && e.engaged && e.threat && e.side !== src.side && (e.threat[dst.id] !== undefined || e.threat[src.id] !== undefined));
  if (!foes.length) return;
  const each = (eff * 0.5) / foes.length;
  for (const e of foes) addThreat(state, e, src, each);
}

function combatTouch(state, src, dst) {
  if (src) src.lastHostileT = state.t;
  if (dst) dst.lastHostileT = state.t;
}

export function killUnit(state, u, killer) {
  if (!u.alive) return;
  u.alive = false;
  u.hp = 0;
  u.deadAt = state.t;
  if (u.casting) u.casting = null;
  u.auras = u.auras.filter((a) => a.def.persistDeath);
  u.move.dir = null;
  u.move.to = null;
  u.moving = false;
  for (const e of state.list) if (e.threat && e.threat[u.id] !== undefined) delete e.threat[u.id];
  emit(state, { type: 'death', dst: u.id, src: killer && killer.id });
  if (killer) {
    runHooks(state, killer, 'onKill', { victim: u });
    if (killer.ownerId) runHooks(state, U(state, killer.ownerId), 'onKill', { victim: u, byPet: true });
  }
  // Kill credit for the player even when an ally/pet landed the blow.
  const p = player(state);
  if (p && p.alive && u.side === 'enemy' && killer !== p && (!killer || killer.ownerId !== p.id)) {
    const engagedWithPlayer = true;
    if (engagedWithPlayer) runHooks(state, p, 'onPartyKill', { victim: u });
  }
  if (state.encounter.onDeath) state.encounter.onDeath(state, api, u, killer);
}

export function reviveUnit(state, u, pct = 0.3) {
  u.alive = true;
  u.hp = Math.max(1, Math.round(u.maxHp * pct));
  u.deadAt = null;
  for (const r of Object.values(u.res)) if (r !== u.res.rage) r.cur = Math.round(r.max * pct);
  emit(state, { type: 'revive', dst: u.id });
}

// ---------------------------------------------------------------- auras

export function applyAura(state, src, dst, def, opts = {}) {
  if (!dst || !dst.alive || !def) return null;
  const list = def.cc ? (Array.isArray(def.cc) ? def.cc : [def.cc]) : [];
  if (list.length && dst !== src) {
    for (const c of list) {
      if (dst.immune[c] || dst.immune.cc) {
        emit(state, { type: 'immune', src: src && src.id, dst: dst.id, ability: opts.ab ? opts.ab.id : def.id, aura: def.id });
        return null;
      }
    }
    // Wards (Fear Ward): an aura with wards:[cc types] absorbs the next matching control effect.
    const ward = dst.auras.find((w) => w.def.wards && list.some((c) => w.def.wards.includes(c)));
    if (ward && hostile(src, dst)) {
      removeAura(state, dst, ward, 'consumed');
      emit(state, { type: 'immune', src: src && src.id, dst: dst.id, ability: opts.ab ? opts.ab.id : def.id, aura: def.id, ward: ward.id });
      return null;
    }
    if (dst.cc.immune && def.debuff !== false) {
      emit(state, { type: 'immune', src: src && src.id, dst: dst.id, aura: def.id });
      return null;
    }
  }
  if (def.debuff && hostile(src, dst) && dst.evading) return null;
  if (def.slowImmuneCheck && dst.immune.slow) return null;
  if (def.mods && def.mods.slow && dst.immune.slow) {
    emit(state, { type: 'immune', src: src && src.id, dst: dst.id, aura: def.id });
    return null;
  }
  let duration = def.duration ?? 10;
  // Diminishing returns on controlled player-like targets (PvP) or when the encounter enables it.
  if (def.dr && (state.flags.pvpDR || dst.kind === 'opponent' || dst.flags.dr) && hostile(src, dst)) {
    const d = dst.dr[def.dr] || { count: 0, resetAt: 0 };
    if (state.t > d.resetAt) d.count = 0;
    const mult = [1, 0.5, 0.25, 0][Math.min(d.count, 3)];
    if (mult === 0) {
      emit(state, { type: 'immune', src: src && src.id, dst: dst.id, aura: def.id, dr: true });
      return null;
    }
    duration *= mult;
    d.count++;
    d.resetAt = state.t + duration + DR_RESET;
    dst.dr[def.dr] = d;
  }
  if (def.pvpDuration && (dst.kind === 'opponent' || dst.kind === 'player') && hostile(src, dst)) duration = Math.min(duration, def.pvpDuration);
  const key = def.unique === 'target' ? def.id : def.id + '@' + (src ? src.id : 'env');
  let a = dst.auras.find((x) => x.key === key);
  if (a) {
    a.remaining = duration;
    a.duration = duration;
    if (def.maxStacks) a.stacks = Math.min(def.maxStacks, a.stacks + (def.stackAdd || 1));
    if (def.absorb) a.absorbLeft = def.absorb;
    if (def.tick && def.tick.resetOnRefresh) a.nextTick = def.tick.interval;
    a.def = def;
    a.snap = snapPower(src);
    emit(state, { type: 'auraRefresh', src: src && src.id, dst: dst.id, aura: def.id, stacks: a.stacks, debuff: !!def.debuff });
  } else {
    a = {
      key,
      id: def.id,
      def,
      srcId: src ? src.id : null,
      remaining: duration,
      duration,
      stacks: def.stacks || 1,
      nextTick: def.tick ? def.tick.interval : 0,
      absorbLeft: def.absorb || 0,
      snap: snapPower(src),
      appliedAt: state.t,
      data: {},
    };
    dst.auras.push(a);
    if (def.onApply) def.onApply({ state, u: dst, src, aura: a, api });
    if (!opts.silent) emit(state, { type: 'auraApply', src: src && src.id, dst: dst.id, aura: def.id, name: def.name || null, debuff: !!def.debuff, cc: list.length ? list : null, dr: def.dr || null, duration, ability: opts.ab ? opts.ab.id : null });
  }
  if (list.length) {
    computeCC(dst);
    if ((dst.cc.stun || dst.cc.incap || dst.cc.fear) && dst.casting) cancelCast(state, dst, 'cc');
    if (dst.cc.silence && dst.casting && dst.casting.ab.mechanic !== 'physical') cancelCast(state, dst, 'silenced');
    if (dst.cc.stun || dst.cc.incap || dst.cc.root || dst.cc.fear) { dst.move.to = null; }
    if (list.includes('incap') && def.healsTarget === false) { /* nothing */ }
  } else {
    computeCC(dst);
  }
  return a;
}

function snapPower(src) {
  if (!src) return { sp: 0, ap: 0, rap: 0, heal: 0 };
  return { sp: statOf(src, 'sp'), ap: statOf(src, 'ap'), rap: statOf(src, 'rap'), heal: statOf(src, 'heal'), dmg: modMult(src, 'dmgDone', 'all') };
}

export function removeAura(state, u, a, reason = 'expired') {
  const i = u.auras.indexOf(a);
  if (i < 0) return;
  u.auras.splice(i, 1);
  if (a.def.onRemove) a.def.onRemove({ state, u, aura: a, api, reason });
  computeCC(u);
  emit(state, { type: 'auraFade', dst: u.id, src: a.srcId, aura: a.id, name: a.def.name || null, reason, debuff: !!a.def.debuff, cc: a.def.cc || null });
}

export function removeAuraById(state, u, id, srcId) {
  for (const a of [...u.auras]) if (a.id === id && (!srcId || a.srcId === srcId)) removeAura(state, u, a, 'removed');
}

export function dispelUnit(state, src, dst, types, count = 1, which = 'debuff', abilityId) {
  if (!dst) return 0;
  const wantDebuff = which === 'debuff';
  const cands = dst.auras.filter((a) => a.def.dispel && types.includes(a.def.dispel) && !!a.def.debuff === wantDebuff);
  let n = 0;
  for (const a of cands.slice(0, count)) {
    removeAura(state, dst, a, 'dispelled');
    n++;
    emit(state, { type: 'dispel', src: src && src.id, dst: dst.id, aura: a.id, ability: abilityId });
  }
  if (!n) emit(state, { type: 'dispelMiss', src: src && src.id, dst: dst.id, ability: abilityId });
  return n;
}

function updateAuras(state, u, dt) {
  for (const a of [...u.auras]) {
    if (!u.alive) return;
    if (a.def.tick) {
      a.nextTick -= dt;
      while (a.nextTick <= 1e-6 && a.remaining > -1e-6) {
        a.nextTick += a.def.tick.interval;
        auraTick(state, u, a);
        if (!u.alive || !u.auras.includes(a)) break;
      }
    }
    if (!u.auras.includes(a)) continue;
    if (a.def.permanent) continue;
    a.remaining -= dt;
    if (a.remaining <= 1e-6) removeAura(state, u, a, 'expired');
  }
}

function auraTick(state, u, a) {
  const tk = a.def.tick;
  const src = U(state, a.srcId);
  const amt = Array.isArray(tk.amount) ? tk.amount[0] + (tk.amount[1] - tk.amount[0]) * state.rng() : tk.amount || 0;
  const stacks = tk.perStack ? a.stacks : 1;
  if (tk.type === 'heal') {
    const bonus = (tk.coef || 0) * (a.snap.heal || 0);
    healUnit(state, src && src.alive ? src : null, u, { amount: (amt + bonus) * stacks, ability: a.def.ability || a.id, isTick: true });
  } else if (tk.type === 'mana' || tk.type === 'resource') {
    const r = u.res[tk.resource || 'mana'];
    if (r) {
      const before = r.cur;
      r.cur = G.clamp(r.cur + amt * stacks * (tk.pctOfMax ? r.max : 1), 0, r.max);
      emit(state, { type: 'resource', dst: u.id, resource: tk.resource || 'mana', amount: r.cur - before, ability: a.id, tick: true });
    }
  } else if (tk.type === 'custom') {
    tk.fn({ state, u, aura: a, src, api });
  } else {
    const key = tk.power || (tk.school === 'physical' || !tk.school ? 'ap' : 'sp');
    const bonus = (tk.coef || 0) * (a.snap[key] || 0);
    // dealDamage applies the live source's dmgDone mods; when the source is gone use the snapshot.
    const realSrc = src && src.alive ? src : null;
    dealDamage(state, realSrc || pseudoSource(state, a), u, {
      amount: (amt + bonus) * stacks,
      school: tk.school || a.def.school || 'shadow',
      kind: 'dot',
      ability: a.def.ability || a.id,
      isTick: true,
      threat: tk.threat ?? 1,
      canCrit: tk.canCrit,
    });
  }
}

function pseudoSource(state, a) {
  return null;
}

// ---------------------------------------------------------------- threat

export function addThreat(state, enemy, unit, amt) {
  if (!enemy || !enemy.threat || !unit || !unit.alive || enemy.side === unit.side) return;
  if (unit.flags.feigned) return;
  if (!enemy.alive) return;
  const mult = (unit.threatMod || 1) * modMult(unit, 'threat');
  enemy.threat[unit.id] = (enemy.threat[unit.id] || 0) + amt * mult;
  if (!enemy.engaged) engage(state, enemy, unit);
}

export function engage(state, enemy, unit, chain = true) {
  if (!enemy.alive || enemy.side === unit.side) return;
  if (enemy.evading) return;
  const was = enemy.engaged;
  enemy.engaged = true;
  if (enemy.threat && enemy.threat[unit.id] === undefined && !unit.flags.feigned) enemy.threat[unit.id] = 0.5;
  if (!enemy.target) enemy.target = unit.id;
  if (!was) {
    emit(state, { type: 'aggro', src: enemy.id, dst: unit.id });
    if (state.encounter.onEngage) state.encounter.onEngage(state, api, enemy, unit);
    if (chain && enemy.group) for (const e of state.list) if (e !== enemy && e.alive && e.group === enemy.group && !e.engaged && !e.hidden) engage(state, e, unit, false);
  }
}

export function dropThreat(state, unit, frac = 1) {
  for (const e of state.list) {
    if (!e.threat || e.threat[unit.id] === undefined) continue;
    if (frac >= 1) delete e.threat[unit.id];
    else e.threat[unit.id] *= 1 - frac;
    if (e.target === unit.id && frac >= 1) e.target = null;
  }
}

export function taunt(state, src, dst, dur = 3) {
  if (!dst.threat) return;
  if (dst.immune.taunt) {
    emit(state, { type: 'immune', src: src.id, dst: dst.id, ability: 'taunt' });
    return;
  }
  const top = Math.max(0, ...Object.values(dst.threat));
  dst.threat[src.id] = Math.max(dst.threat[src.id] || 0, top);
  dst.taunt = { by: src.id, until: state.t + dur };
  dst.target = src.id;
  if (!dst.engaged) engage(state, dst, src);
  emit(state, { type: 'taunt', src: src.id, dst: dst.id });
}

export function threatTarget(state, e) {
  if (e.taunt && e.taunt.until > state.t) {
    const tu = U(state, e.taunt.by);
    if (tu && tu.alive && !tu.flags.feigned) return tu;
  }
  let top = null, topT = -1;
  for (const [id, v] of Object.entries(e.threat || {})) {
    const x = U(state, id);
    if (!x || !x.alive || x.flags.feigned || x.hidden) continue;
    const vv = x.cc.immune ? v * 0.001 : v; // Ice Block-like immunity: look elsewhere if anyone else is listed
    if (vv > topT) { topT = vv; top = x; }
  }
  if (!top) return null;
  const cur = U(state, e.target);
  if (!cur || !cur.alive || cur.flags.feigned || e.threat[cur.id] === undefined || (cur.cc.immune && !top.cc.immune)) return top;
  if (cur === top) return cur;
  const curT = e.threat[cur.id];
  const melee = gap(e, top) <= MELEE_RANGE + 1;
  if (topT > curT * (melee ? 1.1 : 1.3)) return top;
  return cur;
}

export function threatPctOn(state, enemy, unit) {
  if (!enemy.threat) return 0;
  const tank = threatTarget(state, enemy);
  const tv = tank ? enemy.threat[tank.id] || 0 : 0;
  const mine = enemy.threat[unit.id] || 0;
  if (!tv) return mine > 0 ? 1 : 0;
  return mine / tv;
}

function updateThreatAndCombat(state, dt) {
  let combat = false;
  for (const e of state.list) {
    if (e.side !== 'enemy' || !e.alive || !e.threat) continue;
    if (e.engaged) {
      const live = Object.keys(e.threat).filter((id) => {
        const x = U(state, id);
        return x && x.alive && !x.flags.feigned && !x.hidden;
      });
      const far = G.dist(e, e.home) > e.leash;
      if ((!live.length && !e.flags.noEvade) || (far && !e.flags.noLeash)) startEvade(state, e);
      else combat = true;
    }
    if (e.evading) {
      if (G.dist(e, e.home) < 0.6) {
        e.evading = false;
        e.hp = e.maxHp;
        e.x = e.home.x; e.y = e.home.y;
        e.move.to = null;
        emit(state, { type: 'evadeEnd', src: e.id });
      } else {
        e.move.to = { x: e.home.x, y: e.home.y };
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.25 * dt);
      }
    }
  }
  if (combat && !state.combat) {
    state.combatStart = state.t;
    emit(state, { type: 'combatStart' });
  }
  if (!combat && state.combat) emit(state, { type: 'combatEnd', duration: state.t - (state.combatStart || state.t) });
  state.combat = combat;
}

export function startEvade(state, e) {
  e.engaged = false;
  e.evading = true;
  e.threat = {};
  e.target = null;
  e.taunt = null;
  if (e.casting) cancelCast(state, e, 'evade');
  for (const a of [...e.auras]) if (a.def.debuff) removeAura(state, e, a, 'evade');
  e.move.to = { x: e.home.x, y: e.home.y };
  emit(state, { type: 'evade', src: e.id });
}

// ---------------------------------------------------------------- projectiles & zones

export function spawnProjectile(state, src, dst, o) {
  const p = { id: 'p' + ++state.evSeq, src: src.id, dst: dst.id, x: src.x, y: src.y, speed: o.speed || 28, visual: o.visual || 'arcane', ab: o.ab, effects: o.effects, point: o.point, extra: o.extra || {}, onHit: o.onHit, born: state.t };
  state.projectiles.push(p);
  return p;
}

function updateProjectiles(state, dt) {
  const keep = [];
  for (const p of state.projectiles) {
    const dst = U(state, p.dst);
    if (!dst) continue;
    const d = G.dist(p, dst);
    const stepLen = p.speed * dt;
    if (d <= stepLen + 0.3 || state.t - p.born > 4) {
      const src = U(state, p.src);
      if (dst.alive && src) {
        if (p.onHit) p.onHit(state, src, dst);
        else if (p.ab) applyEffects(state, src, p.ab, dst, p.point, p.effects || [], p.extra);
      }
      emit(state, { type: 'impact', src: p.src, dst: p.dst, visual: p.visual, x: dst.x, y: dst.y });
      continue;
    }
    p.x += ((dst.x - p.x) / d) * stepLen;
    p.y += ((dst.y - p.y) / d) * stepLen;
    keep.push(p);
  }
  state.projectiles = keep;
}

// Zone: {shape:{type:'circle',r}|{type:'cone',range,angle,dir}|{type:'rect',w,h}, telegraph, duration,
//        interval, effects:[...] or onTick(state, zone, unitsInside, api), onArm, affects:'hostile'|'friendly'|'all',
//        trigger:'enter' (trap), visual, label}
export function spawnZone(state, z) {
  const zone = {
    id: 'z' + ++state.evSeq,
    shape: { type: 'circle', r: 5 },
    telegraph: 0,
    duration: 0,
    interval: 1,
    affects: 'hostile',
    visual: 'fire',
    ...z,
  };
  zone.bornAt = state.t;
  zone.armAt = state.t + (zone.telegraph || 0);
  zone.endAt = zone.armAt + (zone.duration || 0) + (zone.trigger === 'enter' ? 9999 : 0);
  if (zone.trigger === 'enter' && zone.lifetime) zone.endAt = zone.armAt + zone.lifetime;
  zone.nextTick = zone.armAt + (zone.tickOnArm === false ? zone.interval : 0);
  zone.armed = false;
  state.zones.push(zone);
  emit(state, { type: 'zone', zone: zone.id, visual: zone.visual, owner: zone.owner });
  return zone;
}

export function zoneVictims(state, z) {
  return state.list.filter((x) => {
    if (!x.alive || x.hidden) return false;
    if (z.affects === 'hostile' && x.side === z.side) return false;
    if (z.affects === 'friendly' && x.side !== z.side) return false;
    if (z.excludeKinds && z.excludeKinds.includes(x.kind)) return false;
    return G.pointInZone(z, x);
  });
}

function updateZones(state, dt) {
  const keep = [];
  for (const z of state.zones) {
    if (z.follow) {
      const f = U(state, z.follow);
      if (f && f.alive) { z.x = f.x; z.y = f.y; }
    }
    if (!z.armed && state.t >= z.armAt) {
      z.armed = true;
      if (z.onArm) z.onArm(state, z, zoneVictims(state, z), api);
      if (z.armEffects) zoneApply(state, z, z.armEffects);
      emit(state, { type: 'zoneArm', zone: z.id, visual: z.visual });
    }
    if (z.armed) {
      if (z.trigger === 'enter') {
        const v = zoneVictims(state, z);
        if (v.length) {
          if (z.onTrigger) z.onTrigger(state, z, v, api);
          if (z.effects) zoneApply(state, z, z.effects, v.slice(0, z.maxTargets || 1));
          emit(state, { type: 'zoneTrigger', zone: z.id, dst: v[0].id, visual: z.visual });
          continue;
        }
      } else if (z.interval && (z.effects || z.onTick)) {
        while (state.t >= z.nextTick - 1e-6 && z.nextTick <= z.endAt + 1e-6) {
          const v = zoneVictims(state, z);
          if (z.onTick) z.onTick(state, z, v, api);
          if (z.effects) zoneApply(state, z, z.effects, v);
          z.nextTick += z.interval;
        }
      }
    }
    if (state.t > z.endAt) {
      emit(state, { type: 'zoneEnd', zone: z.id });
      continue;
    }
    keep.push(z);
  }
  state.zones = keep;
}

function zoneApply(state, z, effects, victims) {
  const src = U(state, z.owner) || null;
  const v = victims || zoneVictims(state, z);
  const ab = z.ab || { id: z.abilityId || z.label || 'zone', school: z.school || 'fire' };
  for (const e of effects) {
    for (const t of v) {
      if (e.type === 'damage') {
        dealDamage(state, src, t, { amount: rollAmount(state, ab, e), coef: num(ab, e.coef, 0), school: e.school || ab.school || 'fire', kind: e.kind || 'spell', ability: ab.id, isTick: !e.notTick, noMiss: true, threat: e.threat ?? 1 });
      } else if (e.type === 'aura') {
        applyAura(state, src || t, t, materializeAura(e.aura, ab), { ab });
      } else if (e.type === 'heal') {
        healUnit(state, src, t, { amount: rollAmount(state, ab, e), coef: num(ab, e.coef, 0), ability: ab.id, isTick: true });
      } else if (e.type === 'custom') {
        e.fn({ state, z, t, src, api });
      } else if (e.type === 'knockback' && src) {
        EFFECTS.knockback(state, { x: z.x, y: z.y }, t, e, ab);
      }
    }
  }
}

// ---------------------------------------------------------------- per-tick unit updates

// Point-to-point walkers slide around pillars and crates instead of getting stuck
// head-on (no real pathfinding; arenas are open). Keyboard movement is untouched.
function steerAround(state, u, vx, vy, distLeft) {
  const look = Math.min(distLeft, 1.4 + u.radius);
  for (const o of state.arena.obstacles || []) {
    if (o.solid === false) continue;
    const px = u.x + vx * look;
    const py = u.y + vy * look;
    if (Math.hypot(px - o.x, py - o.y) >= o.r + u.radius + 0.15) continue;
    const nx = u.x - o.x;
    const ny = u.y - o.y;
    const nl = Math.hypot(nx, ny) || 1;
    let tx = -ny / nl;
    let ty = nx / nl;
    const lean = tx * vx + ty * vy;
    if (lean < 0 || (Math.abs(lean) < 0.05 && u.id.charCodeAt(u.id.length - 1) % 2)) { tx = -tx; ty = -ty; }
    return { x: tx * 0.85 + vx * 0.15, y: ty * 0.85 + vy * 0.15 };
  }
  return { x: vx, y: vy };
}

function updateMovement(state, u, dt) {
  const cc = u.cc;
  if (!u.alive || cc.stun || cc.incap) {
    u.moving = false;
    u.stillFor += dt;
    return;
  }
  let vx = 0, vy = 0, speedMult = 1;
  if (cc.fear) {
    const fs = U(state, cc.fearSrc) || u;
    const n = G.norm(u.x - fs.x, u.y - fs.y);
    u.ai && (u.ai.mem.fearWobble = (u.ai.mem.fearWobble || state.rng() * 6) + dt * 0.8);
    const w = Math.sin(state.t * 1.3 + (u.id.length * 7));
    const ang = Math.atan2(n.y, n.x) + w * 0.9;
    vx = Math.cos(ang); vy = Math.sin(ang);
    speedMult = 0.65;
  } else if (u.move.dir && (u.move.dir.x || u.move.dir.y)) {
    const n = G.norm(u.move.dir.x, u.move.dir.y);
    vx = n.x; vy = n.y;
  } else if (u.move.to) {
    const d = G.dist(u, u.move.to);
    if (d < 0.15) {
      u.move.to = null;
    } else {
      vx = (u.move.to.x - u.x) / d;
      vy = (u.move.to.y - u.y) / d;
      const st = steerAround(state, u, vx, vy, d);
      vx = st.x; vy = st.y;
    }
  }
  if (cc.root) { vx = 0; vy = 0; }
  if (vx || vy) {
    let sp = u.speed * (1 + cc.haste) * (1 - cc.slow) * speedMult;
    if (u.casting && !u.casting.ab.castWhileMoving) {
      if (u.isPlayer || u.kind === 'player') cancelCast(state, u, 'moved');
      else { u.moving = false; return; }
    }
    let stepLen = sp * dt;
    if (u.move.to && !u.move.dir) stepLen = Math.min(stepLen, G.dist(u, u.move.to));
    u.x += vx * stepLen;
    u.y += vy * stepLen;
    G.collide(state.arena, u);
    u.facing = Math.atan2(vy, vx);
    u.moving = true;
    u.stillFor = 0;
    for (const a of [...u.auras]) if (a.def.cancelOnMove) removeAura(state, u, a, 'moved');
  } else {
    u.moving = false;
    u.stillFor += dt;
  }
}

function updateCasting(state, u, dt) {
  const c = u.casting;
  if (!c) return;
  if (u.cc.stun || u.cc.incap || u.cc.fear) return cancelCast(state, u, 'cc');
  if (u.cc.silence && c.ab.mechanic !== 'physical') return cancelCast(state, u, 'silenced');
  if (c.channel) {
    c.elapsed += dt;
    c.nextTick -= dt;
    const end = c.duration - c.cut;
    while (c.nextTick <= 1e-6 && c.ticksDone < c.ticks && c.elapsed <= end + 1e-6) {
      c.ticksDone++;
      c.nextTick += c.interval;
      channelTick(state, u, c);
      if (u.casting !== c) return;
    }
    if (c.ticksDone >= c.ticks || c.elapsed >= end - 1e-6) finishChannel(state, u);
  } else {
    c.remaining -= dt;
    if (c.remaining <= 0) completeCast(state, u);
  }
}

function updateAutoAttacks(state, u, dt) {
  if (!canAct(u)) return;
  let t = U(state, u.target);
  if (u.assistId && t && !hostile(u, t)) {
    const a = U(state, u.assistId);
    if (a && a.alive && !a.hidden && hostile(u, a)) t = a;
  }
  if (u.melee) {
    u.swingT = Math.max(0, u.swingT - dt * (1 + modAdd(u, 'meleeHaste')));
    if (u.swingT <= 0 && u.autoMelee && t && t.alive && hostile(u, t) && !t.hidden && !u.cc.disarm && !(u.casting && !u.casting.ab.meleeWhileCasting) && gap(u, t) <= (u.melee.range || MELEE_RANGE) && !u.flags.feigned && !u.flags.noMelee) {
      const amount = u.melee.min + (u.melee.max - u.melee.min) * state.rng();
      dealDamage(state, u, t, { amount, school: u.melee.school || 'physical', kind: 'melee', ability: 'melee', threat: u.melee.threat ?? 1, coef: u.melee.coef ?? 0 });
      u.swingT = u.melee.speed;
      u.facing = G.angleTo(u, t);
      emit(state, { type: 'swing', src: u.id, dst: t.id });
    }
  }
  if (u.ranged) {
    u.rangedT = Math.max(0, u.rangedT - dt * (1 + modAdd(u, 'rangedHaste')));
    if (u.wandResume && !u.casting && u.gcd <= 0 && !u.moving) {
      u.autoRanged = true;
      u.wandResume = false;
    }
    if (u.autoRanged && u.rangedT <= 0 && t && t.alive && hostile(u, t) && !t.hidden && !u.moving && (!u.casting || u.casting.ab.keepsAutoShot) && u.stillFor >= (u.ranged.windup || 0) && !u.flags.feigned) {
      const ed = gap(u, t);
      if (ed <= (u.ranged.range || 30) && ed >= (u.ranged.minRange || 0) && G.hasLoS(state.arena, u, t)) {
        const amount = u.ranged.min + (u.ranged.max - u.ranged.min) * state.rng();
        const r = u.ranged;
        const ab = { id: r.kind === 'wand' ? 'wand' : 'autoshot', school: r.school || 'physical' };
        u.facing = G.angleTo(u, t);
        spawnProjectile(state, u, t, {
          speed: r.projectileSpeed || 40,
          visual: r.visual || (r.kind === 'wand' ? r.school || 'shadow' : 'arrow'),
          onHit: (st, s, d) => {
            dealDamage(st, s, d, { amount, coef: r.coef ?? 0, power: r.kind === 'wand' ? 'none' : 'rap', school: r.school || 'physical', kind: r.kind === 'wand' ? 'spell' : 'ranged', ability: ab.id, threat: 1 });
            if (s.hooks.onAutoHit) s.hooks.onAutoHit({ state: st, u: s, t: d, api, kind: r.kind });
          },
        });
        u.rangedT = r.speed;
        emit(state, { type: 'autoShot', src: u.id, dst: t.id, kind: r.kind });
      }
    }
  }
}

function updateRegen(state, u, dt) {
  const ic = inCombat(state, u);
  const m = u.res.mana;
  if (m) {
    const inFsr = state.t - u.lastSpendT < FSR_SECONDS;
    let r = u.regen.mp5 + (inFsr ? u.regen.spirit * Math.min(1, u.regen.castRegen + modAdd(u, 'castRegen')) : u.regen.spirit);
    r *= modMult(u, 'manaRegen');
    if (!ic) r *= u.regen.oocMult || 1;
    m.cur = Math.min(m.max, m.cur + r * dt);
  }
  if (u.res.focus) u.res.focus.cur = Math.min(u.res.focus.max, u.res.focus.cur + (u.regen.focus || 0) * modMult(u, 'focusRegen') * dt);
  if (u.res.energy) u.res.energy.cur = Math.min(u.res.energy.max, u.res.energy.cur + (u.regen.energy || 10) * modMult(u, 'energyRegen') * dt);
  if (u.res.rage && !ic) u.res.rage.cur = Math.max(0, u.res.rage.cur - (u.regen.rageDecay || 1.5) * dt);
  if (u.hp < u.maxHp && u.alive) {
    const hr = ic ? u.regen.hpIC || 0 : u.regen.hpOOC || 0;
    if (hr) u.hp = Math.min(u.maxHp, u.hp + hr * dt);
  }
}

function updateTimers(u, dt) {
  if (u.gcd > 0) u.gcd = Math.max(0, u.gcd - dt);
  for (const k in u.cds) {
    u.cds[k] -= dt;
    if (u.cds[k] <= 0) delete u.cds[k];
  }
}

function processQueue(state, u) {
  if (!u.queued || !u.alive) return;
  const q = u.queued;
  if (state.t - q.at > 1.2) { u.queued = null; return; }
  if (u.casting || u.gcd > 1e-6) return;
  u.queued = null;
  startCast(state, u, q.id, q.opts);
}

function autopilot(state, u) {
  // Optional "filler autopilot": casts the chosen filler when the player is idle.
  const id = u.flags.autopilot;
  if (!id || u.casting || u.gcd > 0 || u.queued || u.moving) return;
  const t = U(state, u.target);
  if (!t || !t.alive || !hostile(u, t) || !t.engaged) return;
  const chk = canCast(state, u, id);
  if (chk.ok) {
    const r = startCast(state, u, id);
    if (r.ok) emit(state, { type: 'autopilotCast', src: u.id, ability: id });
  }
}

// ---------------------------------------------------------------- main step

export function step(state, dt) {
  if (state.outcome) return;
  state.t += dt;
  const list = state.list.slice();
  for (const u of list) if (u.alive) updateAuras(state, u, dt);
  for (const u of list) if (u.alive) computeCC(u);
  for (const u of list) if (u.alive) updateTimers(u, dt);
  for (const u of list) if (u.alive && u.ai && !u.isPlayer) thinkUnit(state, u, dt);
  for (const u of list) if (u.alive) updateMovement(state, u, dt);
  for (const u of list) if (u.alive) updateCasting(state, u, dt);
  for (const u of list) if (u.alive) updateAutoAttacks(state, u, dt);
  for (const u of list) if (u.alive) updateRegen(state, u, dt);
  updateProjectiles(state, dt);
  updateZones(state, dt);
  updateThreatAndCombat(state, dt);
  const p = player(state);
  if (p) { processQueue(state, p); autopilot(state, p); }
  if (state.encounter.onTick) state.encounter.onTick(state, api, dt);
  if (!state.outcome && state.encounter.checkOutcome) {
    const o = state.encounter.checkOutcome(state, api);
    if (o) endBattle(state, o);
  }
  if (state.log.length > 400) state.log.splice(0, state.log.length - 300);
}

export function endBattle(state, o) {
  if (state.outcome) return;
  state.outcome = { ...o, t: state.t };
  emit(state, { type: 'outcome', result: o.result, reason: o.reason });
}

// ---------------------------------------------------------------- player commands

export function playerCast(state, id, opts = {}) {
  const u = player(state);
  if (!u) return { ok: false, reason: 'dead' };
  const ab = u.ab[id];
  if (!ab) return { ok: false, reason: 'unknown' };
  if (ab.toggle) return toggleAbility(state, u, ab);
  if (ab.petAbility) return petCast(state, ab.petAbility, opts);
  const chk = canCast(state, u, id, opts);
  if (!chk.ok && (chk.reason === 'gcd' || chk.reason === 'casting')) {
    const remainCast = u.casting ? (u.casting.channel ? 99 : u.casting.remaining) : 0;
    const wait = Math.max(u.gcd, remainCast);
    if (wait <= SPELL_QUEUE + 1e-6) {
      u.queued = { id, opts, at: state.t };
      return { ok: true, queued: true };
    }
  }
  return startCast(state, u, id, opts);
}

function toggleAbility(state, u, ab) {
  if (ab.toggle === 'autoshot' || ab.toggle === 'wand') {
    if (!u.ranged) return { ok: false, reason: 'invalid' };
    if (u.autoRanged) {
      u.autoRanged = false;
      u.wandResume = false;
      emit(state, { type: 'toggle', src: u.id, ability: ab.id, on: false, cat: ab.category });
      return { ok: true };
    }
    const r = resolveTarget(state, u, { target: 'enemy', range: u.ranged.range }, {});
    if (r.reason) {
      emit(state, { type: 'error', src: u.id, ability: ab.id, reason: r.reason, text: reasonText(r.reason) });
      return { ok: false, reason: r.reason };
    }
    applyAutoTarget(u, r.t, r.auto);
    if (u.casting && u.ranged.kind === 'wand') cancelCast(state, u, 'wand');
    u.autoRanged = true;
    breakStealthLike(state, u, ab);
    emit(state, { type: 'toggle', src: u.id, ability: ab.id, on: true, cat: ab.category });
    emit(state, { type: 'cast', src: u.id, dst: r.t && r.t.id, ability: ab.id, cat: ab.category, tags: ab.tags || null });
    return { ok: true };
  }
  if (ab.toggle === 'melee') {
    u.autoMelee = !u.autoMelee;
    emit(state, { type: 'toggle', src: u.id, ability: ab.id, on: u.autoMelee, cat: ab.category });
    return { ok: true };
  }
  if (typeof ab.toggle === 'function') return ab.toggle({ state, u, ab, api });
  return { ok: false };
}

export function stopCasting(state) {
  const u = player(state);
  if (u && u.casting) cancelCast(state, u, 'stopped');
  if (u) u.queued = null;
}

export function setMoveDir(state, dir) {
  const u = player(state);
  if (!u) return;
  u.move.dir = dir && (dir.x || dir.y) ? dir : null;
  if (u.move.dir) u.move.to = null;
}

export function moveTo(state, x, y) {
  const u = player(state);
  if (!u) return;
  u.move.to = { x: G.clamp(x, u.radius, state.arena.w - u.radius), y: G.clamp(y, u.radius, state.arena.h - u.radius) };
  u.move.dir = null;
  emit(state, { type: 'moveOrder', src: u.id, x, y });
}

export function setTarget(state, id) {
  const u = player(state);
  if (!u) return;
  const t = U(state, id);
  if (!t || (!t.alive && !t.lootable)) return;
  if (u.target !== id) emit(state, { type: 'target', src: u.id, dst: id, hostile: hostile(u, t) });
  u.target = id;
}

export function cycleTarget(state) {
  const u = player(state);
  if (!u) return;
  const foes = enemiesOf(state, u).filter((e) => e.engaged || G.dist(u, e) < 40).sort((a, b) => G.dist(u, a) - G.dist(u, b));
  if (!foes.length) return;
  const i = foes.findIndex((f) => f.id === u.target);
  setTarget(state, foes[(i + 1) % foes.length].id);
}

// Pet control: cmd = 'attack' | 'follow' | 'stay' | 'aggressive' | 'defensive' | 'passive'
export function petCommand(state, cmd, targetId) {
  const u = player(state);
  const pet = u && U(state, u.petId);
  if (!pet || !pet.alive) {
    emit(state, { type: 'error', src: u && u.id, reason: pet ? 'petdead' : 'nopet', text: reasonText(pet ? 'petdead' : 'nopet') });
    return { ok: false };
  }
  if (cmd === 'aggressive' || cmd === 'defensive' || cmd === 'passive') {
    pet.petMode = cmd;
  } else if (cmd === 'attack') {
    const t = U(state, targetId || u.target);
    if (!t || !t.alive || !hostile(u, t)) {
      emit(state, { type: 'error', src: u.id, reason: 'notarget', text: reasonText('notarget') });
      return { ok: false };
    }
    pet.petCmd = 'attack';
    pet.target = t.id;
    pet.ai.mem.attackOrder = t.id;
  } else if (cmd === 'follow') {
    pet.petCmd = 'follow';
    pet.ai.mem.attackOrder = null;
    pet.target = null;
  } else if (cmd === 'stay') {
    pet.petCmd = 'stay';
    pet.ai.mem.stayAt = { x: pet.x, y: pet.y };
  }
  emit(state, { type: 'petCommand', src: u.id, dst: pet.id, cmd, target: targetId || u.target });
  return { ok: true };
}

export function petCast(state, abilityId, opts = {}) {
  const u = player(state);
  const pet = u && U(state, u.petId);
  if (!pet || !pet.alive) {
    emit(state, { type: 'error', src: u && u.id, reason: 'nopet', text: reasonText(pet ? 'petdead' : 'nopet') });
    return { ok: false };
  }
  const targetId = opts.targetId || (pet.ab[abilityId] && pet.ab[abilityId].target === 'enemy' ? pet.target || u.target : undefined);
  const r = startCast(state, pet, abilityId, { ...opts, targetId, reportFail: true });
  if (!r.ok) {
    // surface the pet's failure as the player's error so the UI can show it
    emit(state, { type: 'error', src: u.id, ability: abilityId, reason: r.reason, text: 'Pet: ' + reasonText(r.reason, r.ab, pet) });
  }
  emit(state, { type: 'petCommand', src: u.id, dst: pet.id, cmd: 'ability', ability: abilityId, ok: !!r.ok });
  return r;
}

export function togglePetAutocast(state, abilityId) {
  const u = player(state);
  const pet = u && U(state, u.petId);
  if (!pet) return;
  pet.autocast[abilityId] = !pet.autocast[abilityId];
  emit(state, { type: 'petCommand', src: u.id, dst: pet.id, cmd: 'autocast', ability: abilityId, on: pet.autocast[abilityId] });
}

// ---------------------------------------------------------------- UI helpers

export function abilityStatus(state, u, id) {
  const ab = u.ab[id];
  if (!ab) return null;
  const chk = canCast(state, u, id, { ignoreGcd: true, ignoreCasting: true, noAuto: false });
  const cd = u.cds[id] || 0;
  const gcd = (ab.gcd ?? GCD) > 0 ? u.gcd : 0;
  return {
    ab,
    cd,
    cdTotal: u.cdTotal[id] || 0,
    gcd,
    gcdTotal: u.gcdTotal,
    usable: chk.ok,
    reason: chk.reason || null,
    noRes: chk.reason === 'nores',
    outOfRange: chk.reason === 'range' || chk.reason === 'minrange' || chk.reason === 'los',
    active: ab.toggle === 'autoshot' || ab.toggle === 'wand' ? u.autoRanged || u.wandResume : ab.toggle === 'melee' ? u.autoMelee : false,
    cost: abilityCost(u, ab),
  };
}

// Everything content scripts may need, passed as `api` to hooks and scripts.
export const api = {
  spawnUnit, learn, removeUnit, emit, say, banner,
  U, player, hostile, gap, alive, enemiesOf, alliesOf, unitsInRadius, nearest, hpPct, resPct,
  hasAura, findAura, auraRemaining, modMult, modAdd, statOf, canAct, inCombat,
  canCast, startCast, cancelCast, interruptCast, applyEffects, dealDamage, healUnit, killUnit, reviveUnit,
  applyAura, removeAura, removeAuraById, dispelUnit,
  addThreat, engage, dropThreat, taunt, threatTarget, threatPctOn, startEvade, gainRage,
  spawnProjectile, spawnZone, zoneVictims, endBattle,
  playerCast, setMoveDir, moveTo, setTarget, petCommand, petCast,
  getBehavior, G,
};
