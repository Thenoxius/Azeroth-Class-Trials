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

// Poisons: a landed melee strike fires onWeaponHit; Instant and Deadly Poison proc at their rates.
{
  const { KITS } = await import('../src/content/index.js');
  const { createBattle, step, dealDamage } = await import('../src/engine/core.js');
  const { spawnClassMember } = await import('../src/content/party.js');
  const { poisonOnHit } = await import('../src/content/classes/rogue.js');
  let r, mob;
  const enc = {
    id: 'poison', level: 60, arena: { w: 40, h: 30, obstacles: [] },
    setup(state, api) {
      r = spawnClassMember(state, api, { classId: 'rogue', role: 'dps', name: 'R' }, { x: 10, y: 15, level: 60 });
      mob = api.spawnUnit(state, { name: 'Mob', side: 'enemy', kind: 'enemy', level: 60, maxHp: 1e7, x: 11.5, y: 15, speed: 0, ai: { type: 'idle' }, melee: null, flags: { noEvade: true } });
    },
    checkOutcome: () => null,
  };
  const state = createBattle(enc, { classId: 'mage', level: 60, kit: KITS.mage, trialId: 'poison', seed: 4 });
  r.ai = null;
  r.meta.poisons = { mh: 'instant', oh: 'deadly' };
  r.hooks = { ...r.hooks, onWeaponHit: poisonOnHit };
  let instant = 0, hitsMh = 0;
  for (let i = 0; i < 400; i++) {
    const before = state.meters.dmg[r.id] || 0;
    dealDamage(state, r, mob, { amount: 100, school: 'physical', kind: 'melee', ability: 'test', hand: i % 2 ? 'oh' : 'mh' });
    step(state, 0.01);
  }
  const ev = (await import('../src/engine/core.js')).drainEvents(state);
  instant = ev.filter((e) => e.type === 'damage' && e.ability === 'rogue.poison.instant').length;
  hitsMh = ev.filter((e) => e.type === 'damage' && e.ability === 'test' && e.amount > 0).length / 2;
  const deadly = mob.auras.find((a) => a.id === 'rogue.poison.deadly');
  assert.ok(instant > hitsMh * 0.1 && instant < hitsMh * 0.3, `Instant Poison procs ~20 % (${instant} of ${hitsMh})`);
  assert.ok(deadly && deadly.stacks === 5, 'Deadly Poison stacks to 5');
}
console.log('poisons ok');

// Warrior engine hooks: onAttackAvoided fires for the attacker on a dodge (Overpower),
// and a resetsSwing cast restarts the swing timer (Slam).
{
  const { KITS } = await import('../src/content/index.js');
  const { createBattle, step, dealDamage } = await import('../src/engine/core.js');
  const { spawnClassMember } = await import('../src/content/party.js');
  let w, mob;
  const enc = {
    id: 'war', level: 30, arena: { w: 40, h: 30, obstacles: [] },
    setup(state, api) {
      w = spawnClassMember(state, api, { classId: 'warrior', role: 'tank', name: 'W' }, { x: 10, y: 15, level: 30 });
      mob = api.spawnUnit(state, { name: 'Mob', side: 'enemy', kind: 'enemy', level: 30, maxHp: 1e7, x: 11.5, y: 15, speed: 0, ai: { type: 'idle' }, melee: null, flags: { noEvade: true }, stats: { dodge: 0.5 } });
    },
    checkOutcome: () => null,
  };
  const state = createBattle(enc, { classId: 'mage', level: 30, kit: KITS.mage, trialId: 'war', seed: 2 });
  w.ai = null;
  let dodged = 0;
  w.hooks = { ...w.hooks, onAttackAvoided: ({ avoid }) => { if (avoid === 'dodge') dodged++; } };
  for (let i = 0; i < 60; i++) { dealDamage(state, w, mob, { amount: 50, school: 'physical', kind: 'melee', ability: 'test' }); step(state, 0.01); }
  assert.ok(dodged > 5, `onAttackAvoided saw dodges (${dodged})`);
}
console.log('warrior hooks ok');
