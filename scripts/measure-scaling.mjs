import fs from 'node:fs';
import { runTrial, dummyEncounter, dps } from '../tests/bots/harness.mjs';
import { buildsOf } from '../tests/bots/calibrate.mjs';
import * as hunter from '../tests/bots/hunter.mjs';
import * as mage from '../tests/bots/mage.mjs';
import * as priest from '../tests/bots/priest.mjs';
import * as warrior from '../tests/bots/warrior.mjs';
import * as rogue from '../tests/bots/rogue.mjs';
import * as shaman from '../tests/bots/shaman.mjs';
const rows = [];
for (const [classId, bot] of Object.entries({ hunter, mage, priest, warrior, rogue, shaman }))
  for (const b of buildsOf(classId)) {
    const runs = [1, 2, 3, 4, 5].map((seed) =>
      runTrial({ ...b, seed, encounter: dummyEncounter({ level: b.level, duration: 120 }), policy: bot.competent(b) }),
    );
    rows.push({
      ...b,
      dps: Math.round((runs.reduce((n, r) => n + dps(r), 0) / runs.length) * 10) / 10,
      min: Math.round(Math.min(...runs.map((r) => dps(r)))),
      max: Math.round(Math.max(...runs.map((r) => dps(r)))),
    });
  }
console.table(rows);
fs.writeFileSync(new URL('../docs/local-validation/damage-scaling.json', import.meta.url), JSON.stringify(rows, null, 2));
