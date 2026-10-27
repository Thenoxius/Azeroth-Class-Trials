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

// Stealth: the aura sets u.flags.stealthed, slows, hides from aggro beyond close range,
// and breaks when the rogue acts or is hit.
{
  const { KITS } = await import('../src/content/index.js');
  const { createBattle, step, startCast, dealDamage } = await import('../src/engine/core.js');
  const { spawnClassMember } = await import('../src/content/party.js');
  const { getAbility } = await import('../src/engine/registry.js');
  let r, mob;
  const enc = {
    id: 'stealth', level: 30, arena: { w: 60, h: 30, obstacles: [] },
    setup(state, api) {
      r = spawnClassMember(state, api, { classId: 'rogue', role: 'dps', name: 'R' }, { x: 10, y: 15, level: 30 });
      mob = api.spawnUnit(state, { name: 'Mob', side: 'enemy', kind: 'enemy', level: 30, maxHp: 5000, x: 30, y: 15, speed: 0, aggroRadius: 10, ai: { type: 'idle' }, melee: null });
    },
    checkOutcome: () => null,
  };
  const state = createBattle(enc, { classId: 'mage', level: 30, kit: KITS.mage, trialId: 'stealth', seed: 1 });
  r.ai = null;
  r.ab['rogue.stealth'] = { ...getAbility('rogue.stealth') };
  assert.equal(startCast(state, r, 'rogue.stealth').ok, true);
  step(state, 0.05);
  assert.equal(r.flags.stealthed, true, 'stealthed');
  assert.ok(r.cc.slow >= 0.3, 'stealth slows');
  r.x = mob.x - 6; // inside the 10-yard aggro radius, outside 35 % of it
  for (let i = 0; i < 10; i++) step(state, 0.05);
  assert.equal(mob.engaged, false, 'not noticed at 6 yards while stealthed');
  for (let i = 0; i < 10 && r.flags.stealthed; i++) { dealDamage(state, mob, r, { amount: 10, school: 'fire', kind: 'spell', ability: 'test' }); step(state, 0.05); }
  step(state, 0.05);
  assert.equal(r.flags.stealthed, false, 'taking damage breaks stealth');
}
console.log('stealth ok');
