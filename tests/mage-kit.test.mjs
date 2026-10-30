// Mage kit: builds, castability, dummy DPS band, careless < competent, sustain.
import assert from 'node:assert/strict';
import * as bots from './bots/mage.mjs';
import { runKitSuite } from './bots/kit-suite.mjs';
import { timeToOom } from './bots/calibrate.mjs';
import { runTrial, dummyEncounter } from './bots/harness.mjs';

runKitSuite('mage', bots, {
  'mage.poly': 'needs a beast or humanoid',
  'race.wotf': 'needs a fear',
  'race.cannibalize': 'needs a corpse',
  'item.rest': 'out of combat only',
  'mage.decurse': 'needs a curse',
});

// Sustain against a dummy that hits back: the competent bot survives at every level.
for (const [level, spec, hit] of [
  [10, null, [6, 9]],
  [30, 'frost', [28, 36]],
  [60, 'frost', [110, 140]],
]) {
  const enc = dummyEncounter({ level, duration: 60, brawler: { min: hit[0], max: hit[1], speed: 2 }, hp: { 10: 900, 30: 4000, 60: 25000 }[level] });
  const r = runTrial({ classId: 'mage', level, spec, trialId: 'dummy', encounter: enc, policy: bots.competent({ level, spec }), seed: 4, maxSeconds: 61 });
  assert.equal(r.outcome.result, 'victory', `mage ${level} ${spec} died to a brawler dummy`);
}

// Arcane spends mana faster than Frost (its identity).
const fr = timeToOom({ classId: 'mage', level: 60, spec: 'frost', role: 'dps' }, bots.careless({ level: 60, spec: 'frost' }), 400);
const ar = timeToOom({ classId: 'mage', level: 60, spec: 'arcane', role: 'dps' }, bots.careless({ level: 60, spec: 'arcane' }), 400);
assert.ok(ar !== null && (fr === null || ar < fr), `careless Arcane should run dry before careless Frost (${ar} vs ${fr})`);
console.log('mage kit ok');
