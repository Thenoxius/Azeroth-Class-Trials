// Headless test harness: run a trial (or a training dummy) with a bot policy.
//
//   const r = runTrial({ classId:'mage', trialId:'t1', level:10, spec, role, seed, policy });
//   r.outcome -> {result, reason}, r.t, r.meters, r.state, r.events (optional)
//
// A policy is a function (state, ctl) called before every simulation step.
// ctl wraps the same commands the UI uses, so bots exercise the real input path.
import { KITS, TRIALS } from '../../src/content/index.js';
import {
  createBattle,
  step,
  drainEvents,
  player,
  playerCast,
  setMoveDir,
  moveTo,
  setTarget,
  petCommand,
  petCast,
  canCast,
  enemiesOf,
  alliesOf,
  hpPct,
  resPct,
  U,
  togglePetAutocast,
  stopCasting,
  spawnUnit,
} from '../../src/engine/core.js';
import { spawnPlayer } from '../../src/content/common.js';
import * as G from '../../src/engine/geometry.js';
import { MOB } from '../../src/content/data/classic-mobs.js';

export function makeController(state) {
  const me = () => player(state);
  return {
    state,
    me,
    pet: () => (me() ? U(state, me().petId) : null),
    cast: (id, opts) => playerCast(state, id, opts || {}),
    can: (id, opts) => !!me() && canCast(state, me(), id, opts || {}).ok,
    why: (id, opts) => (me() ? canCast(state, me(), id, opts || {}).reason : 'dead'),
    move: (dir) => setMoveDir(state, dir),
    moveTo: (x, y) => moveTo(state, x, y),
    stop: () => setMoveDir(state, null),
    target: (id) => setTarget(state, id),
    petCmd: (cmd, targetId) => petCommand(state, cmd, targetId),
    petCast: (id) => petCast(state, id),
    petAuto: (id) => togglePetAutocast(state, id),
    stopCasting: () => stopCasting(state),
    enemies: () => (me() ? enemiesOf(state, me()) : []),
    engaged: () => (me() ? enemiesOf(state, me(), (e) => e.engaged) : []),
    allies: () => (me() ? alliesOf(state, me()) : []),
    hp: (u) => hpPct(u || me()),
    res: (u, k) => resPct(u || me(), k),
    dist: (a, b) => G.dist(a, b || me()),
    nearest(list) {
      const m = me();
      let best = null,
        bd = Infinity;
      for (const x of list) {
        const d = G.dist(m, x);
        if (d < bd) {
          bd = d;
          best = x;
        }
      }
      return best;
    },
    // Is the player standing in a hostile zone (telegraphed or active)?
    inDanger() {
      const m = me();
      return state.zones.some((z) => z.side !== m.side && !z.harmless && G.pointInZone(z, m));
    },
    escape() {
      const m = me();
      const z = state.zones.find((zz) => zz.side !== m.side && !zz.harmless && G.pointInZone(zz, m));
      if (!z) return false;
      const p = G.escapeClear(
        z,
        state.zones.filter((zz) => zz.side !== m.side && !zz.harmless),
        m,
        2.5,
        state.arena,
      );
      moveTo(state, p.x, p.y);
      return true;
    },
  };
}

export function runTrial({ classId, trialId, level, spec, role, race, seed = 1, policy, maxSeconds = 900, dt = 0.05, keepEvents = false, encounter }) {
  const kit = KITS[classId];
  if (!kit) throw new Error('No kit ' + classId);
  const trial = encounter || TRIALS.find((t) => t.id === trialId);
  if (!trial) throw new Error('No trial ' + trialId);
  const lvl = level ?? trial.level;
  const specs = (kit.specs && kit.specs[lvl]) || [];
  const roles = trial.rolesFor ? trial.rolesFor(classId) : ['dps'];
  const state = createBattle(trial, {
    classId,
    level: lvl,
    spec: spec ?? (specs[0] && specs[0].id) ?? null,
    role: role ?? roles[0],
    race,
    trialId: trial.id,
    kit,
    seed,
  });
  const ctl = makeController(state);
  const events = [];
  while (!state.outcome && state.t < maxSeconds) {
    if (policy) policy(state, ctl);
    step(state, dt);
    const ev = drainEvents(state);
    if (keepEvents) for (const e of ev) events.push(e);
  }
  return { state, outcome: state.outcome, t: state.t, meters: state.meters, events, player: player(state) };
}

// A training-dummy encounter for kit calibration: one (or more) dummies that
// never fight back, or a 'brawler' dummy that hits back for sustain tests.
export function dummyEncounter({ level = 60, hp = 1e7, count = 1, brawler = null, arena = { w: 50, h: 30 }, duration = 120 } = {}) {
  return {
    id: 'dummy',
    order: 0,
    title: 'Training dummy',
    level,
    arena: { ...arena, theme: 'ruins', obstacles: [] },
    setup(state, api) {
      spawnPlayer(state, api, { x: 8, y: arena.h / 2 });
      for (let i = 0; i < count; i++) {
        api.spawnUnit(state, {
          name: 'Training Dummy',
          side: 'enemy',
          kind: 'enemy',
          level,
          maxHp: hp,
          speed: brawler ? 7 : 0,
          x: 30 + i * 2,
          y: arena.h / 2 + i * 2 - (count - 1),
          armor: brawler && brawler.armor !== undefined ? brawler.armor : MOB[level][1],
          melee: brawler ? { min: brawler.min, max: brawler.max, speed: brawler.speed || 2 } : null,
          ai: brawler ? { type: 'melee' } : { type: 'idle' },
          immune: { cc: !!(brawler && brawler.ccImmune) },
          flags: { noEvade: true, noLeash: true },
        });
      }
    },
    checkOutcome(state, api) {
      const p = api.player(state);
      if (!p || !p.alive) return { result: 'defeat', reason: 'died' };
      if (state.t >= duration) return { result: 'victory', reason: 'time' };
      if (!state.list.some((u) => u.side === 'enemy' && u.alive)) return { result: 'victory', reason: 'killed' };
      return null;
    },
  };
}

export function dps(r, includePet = true) {
  const p = r.player;
  let d = r.meters.dmg[p.id] || 0;
  if (includePet && p.petId) d += r.meters.dmg[p.petId] || 0;
  return d / Math.max(1, r.t);
}

export function summarize(results) {
  const wins = results.filter((r) => r.outcome && r.outcome.result === 'victory').length;
  const ts = results.map((r) => r.t);
  return { n: results.length, wins, winRate: wins / Math.max(1, results.length), avgT: ts.reduce((a, b) => a + b, 0) / Math.max(1, ts.length) };
}
