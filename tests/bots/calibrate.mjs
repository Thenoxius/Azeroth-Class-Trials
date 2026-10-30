// Kit calibration helpers shared by the *-kit tests: castability, dummy DPS, sustain.
import { KITS } from '../../src/content/index.js';
import { createBattle, step, drainEvents, player, canCast, playerCast, hpPct, resPct } from '../../src/engine/core.js';
import { runTrial, dummyEncounter, dps } from './harness.mjs';

export function buildsOf(classId, role = 'dps') {
  const kit = KITS[classId];
  const out = [];
  for (const level of [10, 30, 60]) {
    const specs = (kit.specsFor ? kit.specsFor(level, role) : kit.specs && kit.specs[level]) || [];
    if (role === 'healer' && !specs.length) continue;
    const specIds = specs.length ? specs.map((s) => s.id) : [null];
    for (const spec of specIds) out.push({ classId, level, spec, role });
  }
  return out;
}

// Healer calibration: an NPC tank takes steady damage from a dummy; the healer keeps it up.
export function healerRun(b, policy, { dps, secs, seed = 1 }) {
  const enc = {
    id: 'heal-dummy',
    level: b.level,
    arena: { w: 50, h: 30, theme: 'ruins', obstacles: [] },
    setup(state, api) {
      const { spawnPlayer } = COMMON;
      spawnPlayer(state, api, { x: 12, y: 15 });
      const tank = api.spawnUnit(state, {
        name: 'Tank',
        side: 'player',
        kind: 'ally',
        role: 'tank',
        level: b.level,
        maxHp: { 30: 2200, 60: 8000 }[b.level] || 600,
        physMit: 0,
        x: 30,
        y: 15,
        ai: { type: 'idle' },
        flags: { noMelee: true },
      });
      const d = api.spawnUnit(state, {
        name: 'Brute',
        side: 'enemy',
        kind: 'enemy',
        level: b.level,
        maxHp: 1e7,
        x: 32,
        y: 15,
        speed: 0,
        melee: { min: dps * 2 * 0.85, max: dps * 2 * 1.15, speed: 2 },
        ai: { type: 'melee' },
        flags: { noEvade: true, noLeash: true },
      });
      api.taunt(state, tank, d, 9999);
    },
    checkOutcome(state, api) {
      const tank = state.list.find((u) => u.role === 'tank');
      if (!tank.alive) return { result: 'defeat', reason: 'tank died' };
      if (state.t >= secs) return { result: 'victory', reason: 'time' };
      return null;
    },
  };
  const r = runTrial({ ...b, trialId: 'heal-dummy', encounter: enc, policy, seed, maxSeconds: secs + 1 });
  const me = r.player;
  return {
    ok: r.outcome && r.outcome.result === 'victory',
    t: r.t,
    hps: (r.meters.heal[me.id] || 0) / r.t,
    over: (r.meters.overheal[me.id] || 0) / Math.max(1, (r.meters.heal[me.id] || 0) + (r.meters.overheal[me.id] || 0)),
    mana: resPct(me, 'mana'),
  };
}
import * as COMMON from '../../src/content/common.js';

// Every bar ability: can it be cast against a dummy at 20 yards (with the reason if not)?
export function castability(b, situational = {}) {
  const enc = dummyEncounter({ level: b.level, count: 2 });
  const state = createBattle(enc, { classId: b.classId, level: b.level, spec: b.spec, role: b.role, trialId: 'dummy', kit: KITS[b.classId], seed: 3 });
  const me = player(state);
  const dummies = state.list.filter((u) => u.side === 'enemy');
  dummies[0].x = me.x + 8;
  dummies[0].y = me.y;
  dummies[1].x = me.x + 9;
  dummies[1].y = me.y + 1;
  me.target = dummies[0].id;
  const bad = [];
  for (const id of [...state.build.bar, ...state.build.consumables]) {
    if (situational[id]) continue;
    const ab = me.ab[id];
    if (!ab) {
      bad.push(`${id}: not learned`);
      continue;
    }
    if (ab.toggle || ab.petAbility) continue;
    // Castable from 20 yards (ranged) or from 3 yards (melee): either counts.
    let last = null;
    for (const gap of [20, 3]) {
      dummies[0].x = me.x + gap + (dummies[0].radius || 0.8);
      me.gcd = 0;
      me.cds = {};
      me.casting = null;
      if (me.res.mana) me.res.mana.cur = me.res.mana.max;
      const opts = ab.target === 'point' ? { point: { x: dummies[0].x, y: dummies[0].y } } : ab.target === 'ally' ? { targetId: me.id } : {};
      last = canCast(state, me, id, opts);
      if (last.ok) break;
    }
    if (!last.ok) bad.push(`${id}: ${last.reason}`);
  }
  return bad;
}

// Sustained single-target DPS against a dummy for `secs`, with a policy.
export function dummyDps(b, policy, { secs = 120, seed = 1, count = 1 } = {}) {
  const r = runTrial({ ...b, trialId: 'dummy', encounter: dummyEncounter({ level: b.level, duration: secs, count }), policy, seed, maxSeconds: secs + 1 });
  const me = r.player;
  return { dps: dps(r), manaEnd: me.res.mana ? resPct(me, 'mana') : null, r };
}

// Time until mana first drops under 5 % while the policy plays (or null).
export function timeToOom(b, policy, secs = 300) {
  const enc = dummyEncounter({ level: b.level, duration: secs });
  const state = createBattle(enc, { classId: b.classId, level: b.level, spec: b.spec, role: b.role, trialId: 'dummy', kit: KITS[b.classId], seed: 2 });
  const { makeController } = HARNESS;
  const ctl = makeController(state);
  while (!state.outcome && state.t < secs) {
    policy(state, ctl);
    step(state, 0.05);
    drainEvents(state);
    const me = player(state);
    if (me.res.mana && resPct(me, 'mana') < 0.05) return state.t;
  }
  return null;
}

import * as HARNESS from './harness.mjs';

export function table(rows, cols) {
  const w = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? '').length)));
  const line = (vals) => vals.map((v, i) => String(v ?? '').padEnd(w[i])).join('  ');
  console.log(line(cols));
  for (const r of rows) console.log(line(cols.map((c) => r[c])));
}
