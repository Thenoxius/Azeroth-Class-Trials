// Trial 3 (dungeon, incl. the Priest healer role).
import assert from 'node:assert/strict';
import { trialMatrix, assertTrial, BOTS } from './bots/trial-suite.mjs';
import { runTrial } from './bots/harness.mjs';

assertTrial(trialMatrix('t3', { seeds: 4 }), { label: 't3' });

// The party is real level-30 classes now, so the spread between you and the Rogue is the real
// one: a mana-limited Frost Mage does about half a Combat Rogue's damage, a Beast Mastery Hunter
// with its pet a bit more than the Rogue. Nobody carries the group (pets count for the player).
for (const [classId, spec] of [['hunter', 'bm'], ['mage', 'frost'], ['priest', 'shadow']]) {
  for (const seed of [1, 2]) {
    const b = { classId, level: 30, spec, role: 'dps' };
    const r = runTrial({ ...b, trialId: 't3', seed, policy: BOTS[classId].competent(b) });
    const P = r.state.units[r.state.playerId];
    const dmgOf = (pred) => r.state.list.filter(pred).reduce((a, u) => a + (r.meters.dmg[u.id] || 0), 0);
    const mine = dmgOf((u) => u.id === P.id || u.ownerId === P.id);
    const rogue = dmgOf((u) => u.kind === 'ally' && u.classId === 'rogue');
    const tank = dmgOf((u) => u.kind === 'ally' && u.role === 'tank');
    const ratio = mine / rogue;
    assert.ok(ratio > 0.4 && ratio < 2.0, `t3 ${classId} ${spec} seed ${seed}: player/rogue damage ${ratio.toFixed(2)}`);
    assert.ok(tank / rogue > 0.35 && tank / rogue < 0.8, `t3 tank/rogue damage ${(tank / rogue).toFixed(2)}`);
  }
}
console.log('t3 ok');
