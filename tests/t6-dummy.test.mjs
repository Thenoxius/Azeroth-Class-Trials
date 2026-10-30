// Trial 6 (Proving Grounds): every damage spec finishes the fixed three minutes and gets
// a consistent damage report. No DPS targets: the numbers come from the Forever data
// and are ranked, not tuned.
import assert from 'node:assert/strict';
import { KITS, CLASS_ORDER, trialById, trialSupports } from '../src/content/index.js';
import { runTrial } from './bots/harness.mjs';
import { table } from './bots/calibrate.mjs';
import { BOTS } from './bots/trial-suite.mjs';
import { DUMMY_SECONDS } from '../src/content/encounters/t6-dummy.js';

const trial = trialById('t6');
const rows = [];
for (const classId of CLASS_ORDER.filter((c) => trialSupports('t6', c))) {
  const kit = KITS[classId];
  for (const spec of (kit.specsFor ? kit.specsFor(60, 'dps') : kit.specs[60]).map((s) => s.id)) {
    const b = { classId, level: 60, spec, role: 'dps' };
    const r = runTrial({ ...b, trialId: 't6', seed: 1, policy: BOTS[classId].competent(b), maxSeconds: DUMMY_SECONDS + 60 });
    assert.equal(r.outcome && r.outcome.result, 'victory', `t6 ${classId} ${spec}: did not finish (${r.outcome ? r.outcome.reason : 'timeout'})`);
    const rep = trial.report(r.state);
    assert.ok(rep && rep.total > 0, `t6 ${classId} ${spec}: no damage report`);
    const sum = rep.rows.reduce((n, x) => n + x.dmg, 0);
    assert.ok(Math.abs(sum - rep.total) < 1, `t6 ${classId} ${spec}: ability rows (${sum}) do not add up to the total (${rep.total})`);
    assert.equal(rep.timeline.length, DUMMY_SECONDS / rep.bucket);
    assert.ok(Math.abs(rep.timeline.reduce((n, v) => n + v * rep.bucket, 0) - rep.total) < 1, `t6 ${classId} ${spec}: timeline does not add up`);
    assert.ok(rep.critPct >= 0 && rep.critPct <= 1 && rep.executeShare >= 0 && rep.executeShare <= 1);
    const dummy = r.state.script.dummy;
    assert.ok(dummy.alive && dummy.hp / dummy.maxHp < 0.02, `t6 ${classId} ${spec}: dummy health should follow the clock to ~0 %`);
    rows.push({
      build: `${classId} ${spec}`,
      dps: Math.round(rep.dps),
      crit: Math.round(rep.critPct * 100) + '%',
      exec: Math.round(rep.executeShare * 100) + '%',
      idle: Math.round(rep.idle) + 's',
    });
  }
}
table(rows, ['build', 'dps', 'crit', 'exec', 'idle']);
console.log('t6 ok');
