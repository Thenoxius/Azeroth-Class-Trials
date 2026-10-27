// Trial 5 (raid). The raid should not hinge on one player: competent bots win reliably,
// and the measurable difference is your own output (DPS / HPS), not the outcome.
import assert from 'node:assert/strict';
import { trialMatrix, BOTS } from './bots/trial-suite.mjs';
import { runTrial } from './bots/harness.mjs';

const rows = trialMatrix('t5', { seeds: 3, maxSeconds: 420 });
for (const r of rows.filter((x) => x.mode === 'competent')) {
  assert.ok(r.winRate >= 2 / 3, `t5 ${r.classId} ${r.spec} ${r.role}: competent win rate ${(r.winRate * 100).toFixed(0)} %`);
  if (r.medianT) assert.ok(r.medianT >= 150 && r.medianT <= 300, `t5 ${r.classId} ${r.spec}: fight length ${r.medianT.toFixed(0)} s outside 2.5–5 min`);
}
// Nobody carries the raid: a competent player (pet included) stays below 1.5× the best NPC
// raider (the Hunter once did 1.6–2.2×). Casters may sit lower: against a level-63 fire boss
// they miss 17 % of spells before hit talents, lose damage to fire resistance and run on mana
// for four minutes — real Classic raid conditions, not a bug.
for (const [classId, spec] of [['hunter', 'bm'], ['hunter', 'mm'], ['hunter', 'sv'], ['mage', 'arcane'], ['priest', 'shadow']]) {
  // Averaged over seeds: on one seed the best NPC rogue alone can swing ±8 %.
  const ratios = [];
  for (const seed of [1, 2, 3]) {
    const b = { classId, level: 60, spec, role: 'dps' };
    const r = runTrial({ ...b, trialId: 't5', seed, policy: BOTS[classId].competent(b), maxSeconds: 420 });
    const P = r.state.units[r.state.playerId];
    const mine = r.state.list.filter((u) => u.id === P.id || u.ownerId === P.id).reduce((a, u) => a + (r.meters.dmg[u.id] || 0), 0);
    const best = Math.max(...r.state.list.filter((u) => u.kind === 'ally' && u.role === 'dps').map((u) => r.meters.dmg[u.id] || 0));
    ratios.push(mine / best);
  }
  const ratio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  assert.ok(ratio > 0.6 && ratio < 1.5, `t5 ${classId} ${spec}: player / best NPC raider damage ${ratio.toFixed(2)} (seeds ${ratios.map((x) => x.toFixed(2)).join(', ')})`);
}
console.log('t5 ok');
