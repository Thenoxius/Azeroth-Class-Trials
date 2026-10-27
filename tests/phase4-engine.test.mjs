// Phase 4 engine gates (Warrior stances, Rogue stealth and positional abilities).
import assert from 'node:assert/strict';
import { isBehind, reasonText } from '../src/engine/core.js';

const t = { x: 0, y: 0, facing: 0 }; // facing +x
assert.equal(isBehind({ x: -3, y: 0 }, t), true, 'directly behind');
assert.equal(isBehind({ x: 3, y: 0 }, t), false, 'in front');
assert.equal(isBehind({ x: -1, y: 3 }, t), true, 'behind-side');
assert.equal(isBehind({ x: 1, y: 3 }, t), false, 'front-side');
assert.equal(reasonText('behind'), 'You must be behind your target');
assert.equal(reasonText('stance'), 'Wrong stance');
assert.equal(reasonText('stealth'), 'You must be stealthed');
console.log('phase4 engine ok');

// Stances: swapping sets u.stance, applies the stance mods and keeps only Tactical Mastery rage.
{
  const { KITS } = await import('../src/content/index.js');
  const { createBattle, step, playerCast, canCast } = await import('../src/engine/core.js');
  const { spawnClassMember } = await import('../src/content/party.js');
  const { rageKept } = await import('../src/content/classes/warrior.js');
  let w;
  const enc = {
    id: 'stance', level: 30, arena: { w: 40, h: 30, obstacles: [] },
    setup(state, api) { w = spawnClassMember(state, api, { classId: 'warrior', role: 'tank', name: 'W' }, { x: 10, y: 15, level: 30 }); },
    checkOutcome: () => null,
  };
  const state = createBattle(enc, { classId: 'mage', level: 30, kit: KITS.mage, trialId: 'stance', seed: 1 });
  step(state, 0.05);
  assert.equal(w.stance, 'defensive', 'NPC tank starts in Defensive Stance');
  w.ab['warrior.stance.berserker'] = { ...(await import('../src/engine/registry.js')).getAbility('warrior.stance.berserker') };
  w.res.rage.cur = 60;
  const { startCast } = await import('../src/engine/core.js');
  assert.equal(startCast(state, w, 'warrior.stance.berserker').ok, true);
  step(state, 0.05);
  assert.equal(w.stance, 'berserker', 'swapped to Berserker');
  assert.ok(w.res.rage.cur <= rageKept(w) && w.res.rage.cur > rageKept(w) - 1, 'rage capped by Tactical Mastery (minus a tick of decay)');
  assert.equal(rageKept(w), 10);
  assert.ok(!w.auras.some((a) => a.def.stance === 'defensive'), 'old stance removed');
  assert.equal(startCast(state, w, 'warrior.stance.berserker').ok, false, 'cannot re-enter the same stance');
}
console.log('stances ok');
