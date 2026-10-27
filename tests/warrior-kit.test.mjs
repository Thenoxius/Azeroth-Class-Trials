// Playable Warrior (phase 4): builds for every level/spec/race, stance starts, and the
// questing and ambush trials — competent play wins, careless play clearly does worse.
// The Warrior joins CLASS_ORDER (and with it the shared trial matrix) once T3–T5 support it.
import assert from 'node:assert/strict';
import { KITS } from '../src/content/index.js';
import { KIT } from '../src/content/classes/warrior.js';
import { CLASS_RACES } from '../src/content/races.js';
import { competent, careless } from './bots/warrior.mjs';
import { runTrial } from './bots/harness.mjs';

KITS.warrior = KIT; // the harness looks kits up here

for (const race of CLASS_RACES.warrior) {
  for (const level of [10, 30, 60]) {
    for (const spec of ['arms', 'fury', 'prot']) {
      const b = KIT.build({ level, spec, role: spec === 'prot' ? 'tank' : 'dps', race, trialId: 't1' });
      assert.equal(b.template.portrait, `${race}-warrior`);
      assert.ok(b.bar.every((id) => b.template.abilities.includes(id)));
      const stance = b.template.auras.find((a) => a.stance);
      const want = level === 10 ? 'battle' : spec === 'prot' ? 'defensive' : spec === 'fury' ? 'berserker' : 'battle';
      assert.equal(stance && stance.stance, want, `${race} ${spec} ${level} starts in ${want}`);
    }
  }
}
assert.ok(KIT.build({ level: 60, spec: 'fury', trialId: 't1' }).template.melee.oh, 'Fury dual-wields');
assert.ok(KIT.build({ level: 30, npc: true }).template.auras.some((a) => a.stance === 'defensive'), 'NPC tank build unchanged');

for (const [trialId, level, spec] of [['t1', 10, null], ['t1', 30, 'arms'], ['t1', 30, 'fury'], ['t2', 30, 'arms'], ['t2', 30, 'fury']]) {
  const res = { competent: 0, careless: 0 };
  for (const mode of ['competent', 'careless']) {
    for (const seed of [1, 2, 3]) {
      const b = { classId: 'warrior', level, spec };
      const r = runTrial({ ...b, trialId, seed, policy: (mode === 'competent' ? competent : careless)(b), maxSeconds: 600 });
      if (r.outcome && r.outcome.result === 'victory') res[mode]++;
    }
  }
  console.log(`warrior ${trialId} L${level} ${spec || ''}: competent ${res.competent}/3, careless ${res.careless}/3`);
  assert.ok(res.competent >= 2, `${trialId} ${spec} competent wins`);
  assert.ok(res.careless < res.competent, `${trialId} ${spec} careless clearly worse`);
}
console.log('warrior ok');
