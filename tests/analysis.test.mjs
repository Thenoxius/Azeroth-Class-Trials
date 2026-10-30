// Telemetry → analysis integration: bot runs produce SessionRecords through the real
// tracker; the analysis must stay well-formed and follow its own honesty rules.
import assert from 'node:assert/strict';
import { KITS, TRIALS, trialById } from '../src/content/index.js';
import { createBattle, step, drainEvents } from '../src/engine/core.js';
import { createTracker } from '../src/telemetry/tracker.js';
import { analyze } from '../src/analysis/analyze.js';
import { makeController } from './bots/harness.mjs';
import { BOTS } from './bots/trial-suite.mjs';

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
  play('warrior', 't1', 10, null),
  play('rogue', 't1', 10, null),
  play('shaman', 't1', 10, null),
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
  {
    sessionId: sessions[0].id,
    trialId: 't1',
    classId: 'mage',
    level: 10,
    enjoyment: 5,
    frustration: 1,
    again: 5,
    moment: sessions[0].moments[0],
    custom: null,
    skipped: false,
  },
  {
    sessionId: sessions[2].id,
    trialId: 't1',
    classId: 'priest',
    level: 10,
    enjoyment: 2,
    frustration: null,
    again: null,
    moment: 'none',
    custom: null,
    skipped: false,
  },
  {
    sessionId: sessions[1].id,
    trialId: 't1',
    classId: 'hunter',
    level: 10,
    enjoyment: null,
    frustration: null,
    again: null,
    moment: null,
    custom: null,
    skipped: true,
  },
];
for (const s of sessions) assert.ok(s.barSize > 0, 'kit size recorded');
const a = analyze({ sessions, feedback, trials: TRIALS.filter((t) => !t.leaderboard) });
assert.equal(a.played.length, 6);
// Mage answered 5 and Priest 2 in the same trial, level and role.
assert.equal(a.lean.cls, 'mage');
assert.ok(a.lean.reasons[0].text.includes('How did that fight feel?'), 'older answers are quoted as asked');
// A careless, lost run tells nothing about liking: only its description and record change.
assert.ok(a.performance.priest.runs >= 1);
// Skipped answers add nothing.
assert.equal(a.evidence.self.hunter.length, 0, 'skipped feedback is not evidence');
assert.ok(a.evidence.observed.mage.length > 0, 'behaviour is described');
assert.ok(a.uncertainties.length > 0, 'gaps are named');
console.log('analysis ok');
