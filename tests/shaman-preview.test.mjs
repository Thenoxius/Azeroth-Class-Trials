import assert from 'node:assert/strict';
import { KITS, trialSupports } from '../src/content/index.js';
import { runTrial } from './bots/harness.mjs';
import { competent } from './bots/shaman.mjs';
for (const level of [10, 30, 60]) {
  const specs = level === 10 ? [null] : ['elemental', 'enhancement', 'resto'];
  for (const spec of specs) {
    const b = KITS.shaman.build({ level, spec });
    assert.ok(b.bar.length);
    assert.ok(b.template.maxHp > 0);
    assert.ok(b.template.resources.mana > 0);
  }
}
for (const t of ['t1', 't2', 't3', 't4', 't5']) assert.equal(trialSupports(t, 'shaman'), true);
for (const [trialId, level] of [
  ['t3', 30],
  ['t5', 60],
])
  for (const seed of [1, 2, 3]) {
    const r = runTrial({ classId: 'shaman', trialId, level, spec: 'resto', role: 'healer', seed, policy: competent({ role: 'healer' }), maxSeconds: 420 });
    console.log(trialId, seed, r.outcome, r.t);
    assert.equal(r.outcome?.result, 'victory');
    assert.ok(r.meters.heal[r.player.id] > 0);
  }
console.log('Shaman builds and healer trials ok');
