// Trial 4 (adaptive duel). Every class can win with its best PvP spec; weaker specs
// (petless-style Marksmanship, non-Frost Mages) are allowed to struggle — that is a
// documented spec trait, not a bug. Careless play is never better than competent play.
import assert from 'node:assert/strict';
import { trialMatrix } from './bots/trial-suite.mjs';

const rows = trialMatrix('t4', { seeds: 4 });
for (const cls of ['hunter', 'mage', 'priest']) {
  const best = Math.max(...rows.filter((r) => r.classId === cls && r.mode === 'competent').map((r) => r.winRate));
  assert.ok(best >= 0.75, `t4: best ${cls} spec only wins ${(best * 100).toFixed(0)} %`);
}
for (const r of rows.filter((x) => x.mode === 'competent')) {
  const c = rows.find((x) => x.mode === 'careless' && x.classId === r.classId && x.spec === r.spec);
  assert.ok(c.winRate <= r.winRate, `t4 ${r.classId} ${r.spec}: careless wins more often than competent`);
}
console.log('t4 ok');
