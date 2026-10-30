// Friendly targeting: a healer's selected party member must stay selected.
// The action bar asks abilityStatus() for every button every frame; that check
// once auto-targeted the nearest enemy for Smite / the wand and so overwrote
// any party member the player had just clicked.
import assert from 'node:assert/strict';
import { KITS, TRIALS } from '../src/content/index.js';
import { createBattle, step, drainEvents, player, setTarget, playerCast, abilityStatus } from '../src/engine/core.js';

const trial = TRIALS.find((t) => t.id === 't3');
const s = createBattle(trial, { classId: 'priest', level: trial.level, spec: 'disc', role: 'healer', trialId: 't3', kit: KITS.priest, seed: 1 });
const P = player(s);
const party = s.list.filter((u) => u.side === 'player' && u.kind === 'ally');
const tank = party.find((u) => u.role === 'tank');
const dps = party.find((u) => u.role !== 'tank');
const events = [];
const run = (secs) => {
  const end = s.t + secs;
  while (s.t < end && !s.outcome) {
    for (const id of s.build.bar) abilityStatus(s, P, id); // what the action bar does each frame
    step(s, 0.05);
    events.push(...drainEvents(s));
  }
};

run(12); // the tank has pulled; enemies are engaged
assert.ok(
  s.list.some((u) => u.side === 'enemy' && u.engaged),
  'the pull should have happened',
);

setTarget(s, dps.id);
run(2);
assert.equal(P.target, dps.id, 'a clicked party member stays selected while the action bar refreshes');

// Smite with the tank selected hits the tank's target; the tank stays selected.
setTarget(s, tank.id);
const smite = playerCast(s, 'priest.smite');
assert.ok(smite.ok, 'Smite with a friend selected is castable');
run(0.1);
const cast = events.filter((e) => e.type === 'castStart' && e.src === P.id && e.ability === 'priest.smite').pop();
assert.ok(cast && s.units[cast.dst].side === 'enemy', 'Smite goes to an enemy');
assert.equal(P.target, tank.id, 'casting Smite does not drop the selected tank');
while (P.casting || P.gcd > 0) run(0.05);

// The next heal goes to the tank, not to the priest.
const heal = playerCast(s, 'priest.heal');
assert.ok(heal.ok, 'Heal is castable');
run(0.1);
const healStart = events.filter((e) => e.type === 'castStart' && e.src === P.id && e.ability === 'priest.heal').pop();
assert.equal(healStart.dst, tank.id, 'Heal lands on the selected tank');

// The wand started with a friend selected shoots the friend's target.
run(4);
playerCast(s, 'priest.wand');
run(4);
const shots = events.filter((e) => e.type === 'autoShot' && e.src === P.id);
assert.ok(shots.length > 0, 'the wand keeps firing while a friend is selected');
assert.ok(
  shots.every((e) => s.units[e.dst].side === 'enemy'),
  'wand shots hit enemies',
);
assert.equal(P.target, tank.id, 'wanding does not drop the selected tank');

console.log('targeting ok');
