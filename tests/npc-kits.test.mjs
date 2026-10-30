// NPC class kits (Warrior, Rogue, Warlock, Shaman) build, use their real mechanics and land
// in sane damage / healing bands when the party behaviours play them.
import assert from 'node:assert/strict';
import { KITS } from '../src/content/index.js';
import { createBattle, step, drainEvents } from '../src/engine/core.js';
import { spawnClassMember, NPC_KITS } from '../src/content/party.js';
import { MOB } from '../src/content/data/classic-mobs.js';

for (const id of ['warrior', 'rogue', 'warlock', 'shaman']) {
  for (const level of [30, 60]) {
    const t = NPC_KITS[id].build({ level, groupBuffs: [] }).template;
    assert.ok(t.maxHp > (level === 60 ? 3000 : 900) && t.maxHp < (level === 60 ? 8000 : 2500), `${id} ${level}: health ${t.maxHp}`);
    assert.ok(
      t.abilities.every((a) => typeof a === 'string'),
      `${id} ${level}: bar`,
    );
  }
}

// A practice fight: one NPC (and a tank if it needs one) against a big enemy of its level.
function practice({ level, members, secs, enemy = {} }) {
  const enc = {
    id: 'npc',
    level,
    arena: { w: 50, h: 30, obstacles: [] },
    setup(state, api) {
      const units = members.map((m, i) => spawnClassMember(state, api, m, { x: 14 - i * 2, y: 15 + (i % 2 ? 2 : -2), level }));
      const foe = api.spawnUnit(state, {
        name: 'Dummy',
        side: 'enemy',
        kind: 'boss',
        level: enemy.level ?? level,
        maxHp: 1e7,
        armor: MOB[level][1],
        x: 18,
        y: 15,
        speed: 0,
        melee: enemy.melee || null,
        ai: { type: enemy.melee ? 'melee' : 'idle' },
        flags: { noEvade: true, noLeash: true },
      });
      state.script.focusId = foe.id;
      for (const u of units) api.engage(state, foe, u, false);
      if (enemy.melee) {
        api.taunt(state, units[0], foe, 9999);
        foe.target = units[0].id;
      }
    },
    checkOutcome(state) {
      return state.t >= secs ? { result: 'victory', reason: 'time' } : null;
    },
  };
  const state = createBattle(enc, { classId: 'mage', level, kit: KITS.mage, trialId: 'npc', seed: 3 });
  const events = [];
  while (!state.outcome && state.t < secs + 1) {
    step(state, 0.05);
    events.push(...drainEvents(state));
  }
  return { state, events };
}
const dps = (r, u) => (r.state.meters.dmg[u.id] || 0) / r.state.t;
const named = (r, name) => r.state.list.find((u) => u.name === name);

// Warrior: rage from swings and hits taken, five Sunders, the highest threat.
{
  const r = practice({
    level: 60,
    secs: 40,
    members: [{ classId: 'warrior', role: 'tank', name: 'Tank' }],
    enemy: { melee: { min: 900, max: 1100, speed: 2 } },
  });
  const tank = named(r, 'Tank'),
    foe = named(r, 'Dummy');
  const sunder = foe.auras.find((a) => a.id === 'warrior.sunder');
  assert.ok(sunder && sunder.stacks === 5, 'Sunder Armor reaches 5 stacks');
  assert.ok(
    r.events.some((e) => e.src === tank.id && e.ability === 'warrior.revenge' && e.type === 'damage'),
    'Revenge follows blocks, dodges and parries',
  );
  // Rage-starved like a fresh Classic tank: it goes to Sunder, Revenge and Shield Slam, not Heroic Strike.
  assert.ok(r.events.filter((e) => e.src === tank.id && e.type === 'cast' && e.ability === 'warrior.shieldslam').length >= 1, 'Shield Slam is used');
  assert.ok(foe.threat[tank.id] > 3000, `tank threat ${Math.round(foe.threat[tank.id])}`);
}

// Rogue: combo points into Slice and Dice and Eviscerate.
for (const [level, lo, hi] of [
  [30, 30, 110],
  [60, 150, 450],
]) {
  const r = practice({
    level,
    secs: 60,
    members: [
      { classId: 'warrior', role: 'tank', name: 'Tank' },
      { classId: 'rogue', role: 'dps', name: 'Rogue' },
    ],
  });
  const rogue = named(r, 'Rogue');
  // At 30 energy only stretches to Sinister Strike and Slice and Dice; Eviscerate joins at 60.
  if (level === 60)
    assert.ok(
      r.events.some((e) => e.src === rogue.id && e.ability === 'rogue.evis' && e.type === 'damage'),
      `rogue ${level} uses Eviscerate`,
    );
  assert.ok(r.events.filter((e) => e.src === rogue.id && e.ability === 'rogue.ss' && e.type === 'damage').length >= 8, `rogue ${level} builds combo points`);
  assert.ok(
    r.events.some((e) => e.dst === rogue.id && e.aura === 'rogue.snd'),
    `rogue ${level} keeps Slice and Dice`,
  );
  assert.ok(dps(r, rogue) > lo && dps(r, rogue) < hi, `rogue ${level} dps ${dps(r, rogue).toFixed(0)}`);
}

// Warlock: Corruption and Bane of Agony up, Shadow Bolt filler, Life Tap for mana.
for (const [level, lo, hi] of [
  [30, 15, 80],
  [60, 120, 400],
]) {
  const r = practice({
    level,
    secs: 60,
    members: [
      { classId: 'warrior', role: 'tank', name: 'Tank' },
      { classId: 'warlock', role: 'dps', name: 'Lock', curse: 'cor' },
    ],
  });
  const lock = named(r, 'Lock'),
    foe = named(r, 'Dummy');
  for (const id of ['warlock.corruption', 'warlock.agony', 'warlock.cor', 'warlock.lifetap'])
    assert.ok(
      r.events.some((e) => e.type === 'cast' && e.src === lock.id && e.ability === id),
      `warlock ${level}: casts ${id}`,
    );
  assert.ok(
    foe.auras.some((a) => a.id === 'warlock.cor' && a.srcId === lock.id),
    `warlock ${level}: the curse stays up`,
  );
  assert.ok(dps(r, lock) > lo && dps(r, lock) < hi, `warlock ${level} dps ${dps(r, lock).toFixed(0)}`);
}

// Shaman: keeps a tank alive under steady damage.
for (const [level, hit] of [
  [30, [140, 170]],
  [60, [900, 1100]],
]) {
  const r = practice({
    level,
    secs: 60,
    members: [
      { classId: 'warrior', role: 'tank', name: 'Tank' },
      { classId: 'shaman', role: 'healer', name: 'Shaman' },
    ],
    enemy: { melee: { min: hit[0], max: hit[1], speed: 2 } },
  });
  const tank = named(r, 'Tank'),
    sham = named(r, 'Shaman');
  assert.ok(tank.alive, `shaman ${level} keeps the tank alive`);
  assert.ok((r.state.meters.heal[sham.id] || 0) > 0, `shaman ${level} heals`);
}
console.log('npc kits ok');
