// Telemetry → analysis integration: bot runs produce SessionRecords through the real
// tracker; the analysis must stay well-formed and follow its own honesty rules.
import assert from 'node:assert/strict';
import { KITS, TRIALS, trialById } from '../src/content/index.js';
import { createBattle, step, drainEvents } from '../src/engine/core.js';
import { createTracker } from '../src/telemetry/tracker.js';
import { analyze } from '../src/analysis/analyze.js';
import { DIM_IDS } from '../src/analysis/model.js';
import { makeController } from './bots/harness.mjs';
import * as mage from './bots/mage.mjs';
import * as hunter from './bots/hunter.mjs';
import * as priest from './bots/priest.mjs';

const BOTS = { mage, hunter, priest };

function play(classId, trialId, level, spec, role = 'dps', mode = 'competent', meta = {}) {
  const trial = trialById(trialId);
  const state = createBattle(trial, { classId, level, spec, role, trialId, kit: KITS[classId], seed: 7 });
  const tracker = createTracker({ trialId, classId, level, spec, role, kind: trial.kind, attempt: 1, ...meta });
  const ctl = makeController(state);
  const pol = BOTS[classId][mode]({ level, spec, role });
  while (!state.outcome && state.t < 500) {
    pol(state, ctl);
    step(state, 0.05);
    tracker.ingest(drainEvents(state), state);
  }
  return tracker.finish(state);
}

const sessions = [
  play('mage', 't1', 10, null),
  play('hunter', 't1', 10, null),
  play('priest', 't1', 10, null),
  play('mage', 't2', 30, 'frost'),
  play('hunter', 't2', 30, 'bm'),
  play('priest', 't2', 30, 'shadow', 'dps', 'careless'),
  play('priest', 't3', 30, 'disc', 'healer'),
  play('hunter', 't1', 10, null, 'dps', 'competent', { attempt: 2, afterWin: true }),
];

// Records are complete.
for (const s of sessions) {
  assert.ok(s.combatSeconds > 0, 'combat time recorded');
  assert.ok(s.gcd.utilization >= 0 && s.gcd.utilization <= 1, 'utilization in range');
  assert.ok(Array.isArray(s.moments) && s.moments.length > 0, `${s.classId} ${s.trialId}: moments offered for feedback`);
  assert.ok(['victory', 'defeat', 'escaped', 'abandoned'].includes(s.outcome));
}
const t2 = sessions.find((s) => s.trialId === 't2' && s.classId === 'mage');
assert.ok(t2.danger.length >= 1, 'the ambush was recorded as a danger marker');
const heal = sessions.find((s) => s.role === 'healer');
assert.ok(heal.healing.done > 0 && heal.mechanics.length > 0, 'healer session has healing and duty windows');

// Feedback, including a "not sure" answer that must not count as a midpoint.
const feedback = [
  { sessionId: sessions[0].id, trialId: 't1', classId: 'mage', level: 10, enjoyment: 5, frustration: 1, again: 5, moment: sessions[0].moments[0], custom: null, skipped: false },
  { sessionId: sessions[2].id, trialId: 't1', classId: 'priest', level: 10, enjoyment: 2, frustration: null, again: null, moment: 'none', custom: null, skipped: false },
  { sessionId: sessions[1].id, trialId: 't1', classId: 'hunter', level: 10, enjoyment: null, frustration: null, again: null, moment: null, custom: null, skipped: true },
];
const a = analyze({ sessions, feedback, trials: TRIALS });
assert.equal(a.ranking.length, 6);
for (const r of a.ranking) assert.ok(Number.isFinite(r.total), 'class total is a number');
for (const cls of ['hunter', 'mage', 'priest']) {
  for (const dim of DIM_IDS) {
    const c = a.classes[cls].dims[dim];
    assert.ok(c.score === null || (c.score >= 0 && c.score <= 100), `${cls}.${dim} score in range`);
    for (const e of c.evidence) assert.ok(['fact', 'observed', 'self', 'prediction'].includes(e.kind));
  }
}
// What you said moves the needle: Mage questing rated 5/5 beats Priest rated 2/5 on leveling.
assert.ok(a.classes.mage.dims.leveling.score > a.classes.priest.dims.leveling.score, 'self-reports move leveling');
// A careless/lost run only touches capability (R12), never self-reported enjoyment.
const r12 = a.classes.priest.dims.soloIndependence.evidence.filter((e) => e.rule === 'R12');
assert.ok(r12.length <= 1);
// Skipped answers add nothing.
assert.ok(!a.classes.hunter.dims.leveling.evidence.some((e) => e.kind === 'self'), 'skipped feedback is not evidence');
assert.ok(['empty', 'early', 'ready'].includes(a.recommendation.status));
assert.ok(a.gaps.length > 0, 'unplayed trials are listed as gaps');
// Weights are visible and move the totals.
const b = analyze({ sessions, feedback, trials: TRIALS, weights: { raids: 3, pvp: 0, questing: 0.25, dungeons: 0.25 } });
assert.notDeepEqual(a.ranking.map((r) => r.total), b.ranking.map((r) => r.total), 'weights change the totals');
console.log(a.ranking.map((r) => `${r.name} ${r.total}`).join(' · '), '| status', a.recommendation.status, '| conflicts', a.conflicts.length);
console.log('analysis ok');
