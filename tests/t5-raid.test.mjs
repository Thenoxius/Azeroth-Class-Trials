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
// No single player carries the raid: below 20% of total raid damage. The old 1.5x
// best-NPC ceiling depended on incorrect Rogue offhand/talent values (audit 2026-10-29).
// Keep the NPC ratio as a diagnostic, not a reason to alter sourced class damage.
// A competent player (pet included) is compared with the best NPC
// raider (the Hunter once did 1.6–2.2×). Casters may sit lower: against a level-63 fire boss
// they miss 17 % of spells before hit talents, lose damage to fire resistance and run on mana
// for four minutes — real Classic raid conditions, not a bug.
for (const [classId, spec] of [['hunter', 'bm'], ['hunter', 'mm'], ['hunter', 'sv'], ['mage', 'arcane'], ['priest', 'shadow']]) {
  // Averaged over seeds: on one seed the best NPC rogue alone can swing ±8 %.
  const ratios = [];
  const shares = [];
  for (const seed of [1, 2, 3]) {
    const b = { classId, level: 60, spec, role: 'dps' };
    const r = runTrial({ ...b, trialId: 't5', seed, policy: BOTS[classId].competent(b), maxSeconds: 420 });
    const P = r.state.units[r.state.playerId];
    const mine = r.state.list.filter((u) => u.id === P.id || u.ownerId === P.id).reduce((a, u) => a + (r.meters.dmg[u.id] || 0), 0);
    const best = Math.max(...r.state.list.filter((u) => u.kind === 'ally' && u.role === 'dps').map((u) => r.meters.dmg[u.id] || 0));
    ratios.push(mine / best);
    const raidDamage = r.state.list.filter(u => u.side === 'player').reduce((n,u)=>n+(r.meters.dmg[u.id]||0),0);
    shares.push(mine / raidDamage);
  }
  const ratio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  assert.ok(ratio > 0.6 && shares.every(s => s < 0.2), `t5 ${classId} ${spec}: player / best NPC raider damage ${ratio.toFixed(2)} (seeds ${ratios.map((x) => x.toFixed(2)).join(', ')})`);
}
console.log('t5 ok');
