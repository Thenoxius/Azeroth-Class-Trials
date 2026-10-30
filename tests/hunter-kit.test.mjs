// Hunter kit: builds, castability, DPS band, plus pet / threat / Feign Death mechanics.
import assert from 'node:assert/strict';
import * as bots from './bots/hunter.mjs';
import { runKitSuite } from './bots/kit-suite.mjs';
import { KITS } from '../src/content/index.js';
import { createBattle, step, drainEvents, player, playerCast, petCommand, U } from '../src/engine/core.js';
import { registerTemplates } from '../src/engine/registry.js';
import { spawnPlayer } from '../src/content/common.js';

runKitSuite('hunter', bots, {
  'race.wotf': 1,
  'race.cannibalize': 1,
  'item.rest': 'out of combat only',
  'hunter.revive': 'needs a dead pet',
  'hunter.mongoose': 'needs a dodge',
  'hunter.counter': 'needs a parry',
  'hunter.tranq': 'needs an enrage',
});

registerTemplates({
  'test.boar': {
    name: 'Test Boar',
    side: 'enemy',
    kind: 'enemy',
    maxHp: 2500,
    melee: { min: 30, max: 40, speed: 2 },
    ai: { type: 'melee' },
    aggroRadius: 8,
    tags: ['beast'],
  },
});

function arena(level, spec, extra) {
  return createBattle(
    {
      id: 'hk',
      level,
      arena: { w: 60, h: 30, obstacles: [] },
      setup(state, api) {
        spawnPlayer(state, api, { x: 10, y: 15 });
        api.spawnUnit(state, 'test.boar', { x: 30, y: 15, level });
        if (extra) extra(state, api);
      },
    },
    { classId: 'hunter', level, spec, role: 'dps', trialId: 'hk', kit: KITS.hunter, seed: 5 },
  );
}
const run = (state, secs, each) => {
  for (let i = 0; i < secs / 0.05; i++) {
    if (each) each(state);
    step(state, 0.05);
    drainEvents(state);
  }
};

// 1. The pet attacks and Growl takes the boar off the Hunter.
{
  const s = arena(30, 'bm');
  const me = player(s);
  const boar = s.list.find((u) => u.templateId === 'test.boar');
  me.target = boar.id;
  petCommand(s, 'attack', boar.id);
  playerCast(s, 'hunter.autoshot');
  run(s, 8);
  const pet = U(s, me.petId);
  assert.ok((s.meters.dmg[pet.id] || 0) > 0, 'pet deals damage');
  assert.equal(boar.target, pet.id, 'Growl keeps the boar on the pet');
  // 2. Mend Pet heals the pet.
  pet.hp = pet.maxHp * 0.4;
  const before = pet.hp;
  playerCast(s, 'hunter.mendpet');
  run(s, 2);
  assert.ok(pet.hp > before, 'Mend Pet heals');
}

// 3. Feign Death drops threat; with the pet passive and nobody else listed, the mob evades (and heals).
{
  const s = arena(30, 'mm');
  const me = player(s);
  const boar = s.list.find((u) => u.templateId === 'test.boar');
  me.target = boar.id;
  petCommand(s, 'passive');
  petCommand(s, 'follow');
  playerCast(s, 'hunter.autoshot');
  run(s, 6);
  assert.ok(boar.engaged && boar.hp < boar.maxHp, 'boar engaged and hurt');
  playerCast(s, 'hunter.feign');
  run(s, 1.5);
  assert.ok(me.flags.feigned, 'feigned');
  assert.ok(!boar.engaged, 'boar dropped combat');
  run(s, 6);
  assert.equal(boar.hp, boar.maxHp, 'evading boar healed back to full');
}

// 4. Dead zone: ranged shots cannot be used within 8 yards.
{
  const s = arena(30, 'mm');
  const me = player(s);
  const boar = s.list.find((u) => u.templateId === 'test.boar');
  boar.x = me.x + 4;
  me.target = boar.id;
  const r = playerCast(s, 'hunter.arcane');
  assert.equal(r.reason, 'minrange', 'Arcane Shot blocked in the dead zone');
}

// 5. Marksmanship at 60 has no pet (Lone Wolf); Beast Mastery does.
assert.equal(KITS.hunter.build({ level: 60, spec: 'mm' }).pet, null, 'MM 60 is petless');
assert.ok(KITS.hunter.build({ level: 60, spec: 'bm' }).pet, 'BM 60 has a pet');
console.log('hunter kit ok');
