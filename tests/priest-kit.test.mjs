// Priest kit: Shadow DPS band, healer sustain, and role/spec wiring.
import assert from 'node:assert/strict';
import * as bots from './bots/priest.mjs';
import { runKitSuite } from './bots/kit-suite.mjs';
import { buildsOf, healerRun, table } from './bots/calibrate.mjs';
import { KITS } from '../src/content/index.js';

runKitSuite('priest', bots, {
  'race.wotf': 1,
  'race.cannibalize': 1,
  'item.rest': 'out of combat only',
  'priest.cure': 'needs a disease',
  'priest.abolish': 'needs a disease',
  'priest.dispel': 'needs a magic effect',
  'priest.flash': 'blocked in Shadowform (by design)',
});

// Role wiring: damage plays Shadow, the healer role gets Discipline or Holy.
assert.deepEqual(
  KITS.priest.specsFor(30, 'dps').map((s) => s.id),
  ['shadow'],
);
assert.deepEqual(
  KITS.priest.specsFor(60, 'healer').map((s) => s.id),
  ['disc', 'holy'],
);
assert.equal(KITS.priest.build({ level: 30, spec: 'holy', role: 'healer' }).template.role, 'healer');

// Healer capacity: competent bots keep a tank alive under steady damage. With the datamined
// heal ranks and mana costs a fresh level-60 Priest sustains about 200 incoming DPS for 200 s
// (Holy more, Discipline less); 300 was the old, inflated target.
const rows = [];
for (const b of buildsOf('priest', 'healer')) {
  const [dps, secs] = b.level === 30 ? [75, 90] : [200, 200];
  const c = healerRun(b, bots.competent(b), { dps, secs });
  rows.push({ build: `${b.level} ${b.spec}`, incoming: dps, survived: c.ok, hps: c.hps.toFixed(0), overheal: c.over.toFixed(2), manaEnd: c.mana.toFixed(2) });
  assert.ok(c.ok, `${b.level} ${b.spec} healer could not sustain ${dps} incoming DPS for ${secs}s`);
}
table(rows, ['build', 'incoming', 'survived', 'hps', 'overheal', 'manaEnd']);
console.log('priest kit ok');
