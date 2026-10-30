import assert from 'node:assert/strict';
import { KITS } from '../src/content/index.js';
import { createBattle, player, startCast, step, drainEvents, abilityStatus } from '../src/engine/core.js';
import { dummyEncounter } from './bots/harness.mjs';
for (const level of [10, 30, 60]) {
  const s = createBattle(dummyEncounter({ level }), { classId: 'warrior', level, spec: 'arms', role: 'dps', kit: KITS.warrior, seed: 4 });
  const p = player(s),
    t = s.list.find((u) => u.side === 'enemy');
  t.x = p.x + 3;
  p.target = t.id;
  p.res.rage.cur = 100;
  p.swingT = 2;
  assert.ok(startCast(s, p, 'warrior.hs').ok);
  assert.equal(p.nextSwing, 'warrior.hs');
  assert.equal(p.res.rage.cur, 100);
  assert.ok(abilityStatus(s, p, 'warrior.hs').active);
  startCast(s, p, 'warrior.hs');
  assert.equal(p.nextSwing, null, 'second press cancels');
  startCast(s, p, 'warrior.hs');
  drainEvents(s);
  for (let i = 0; i < 41; i++) step(s, 0.05);
  const ev = drainEvents(s);
  assert.ok(ev.some((e) => e.type === 'cast' && e.ability === 'warrior.hs'));
  assert.ok(p.res.rage.cur < 100);
  assert.equal(p.nextSwing, null);
  assert.ok(!ev.some((e) => e.type === 'damage' && e.src === p.id && e.ability === 'melee'), 'queued strike replaces white swing');
  p.swingT = 0.1;
  p.res.rage.cur = 100;
  startCast(s, p, 'warrior.hs');
  p.res.rage.cur = 0;
  drainEvents(s);
  for (let i = 0; i < 3; i++) step(s, 0.05);
  assert.ok(
    drainEvents(s).some((e) => e.type === 'damage' && e.src === p.id && e.ability === 'melee'),
    'insufficient rage falls back to white swing',
  );
}
console.log('next swing regression passed at 10, 30, 60');
