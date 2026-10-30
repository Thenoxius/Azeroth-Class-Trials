// Trial progress belongs to a character; old class-level results survive unassigned.
// Also: each Priest race gets its own two racial spells.
import assert from 'node:assert/strict';
import { runKey, migrateProgress, legacyRunCount, emptyProgress, importJSON } from '../src/telemetry/store.js';
import { nextSuggestion } from '../src/ui/screens/hall-next.js';
import { KITS } from '../src/content/index.js';
import { getAbility, resolveAbility } from '../src/engine/registry.js';
import { createBattle, player, step, dealDamage, applyAura } from '../src/engine/core.js';
import { dummyEncounter } from './bots/harness.mjs';

// Two characters of one class do not share progress.
assert.notEqual(runKey('t1', 'mage', 10, 'a'), runKey('t1', 'mage', 10, 'b'));
assert.equal(runKey('t1', 'mage', 10), 't1:mage:10:no-character');

// Migration keeps every old result, unassigned, and is safe to repeat.
const old = {
  version: 1,
  runs: { 't1:mage:10': { attempts: 3, wins: 2, bestTime: 90 }, 't4:priest:60': { attempts: 1, wins: 0 } },
  characters: [{ id: 'a', classId: 'mage', race: 'undead', name: 'One' }],
};
const m = migrateProgress(old);
assert.equal(m.version, 2);
assert.deepEqual(m.runs, {}, 'no result is assigned to a character');
assert.deepEqual(m.legacyRuns, old.runs, 'nothing is lost');
assert.equal(legacyRunCount(m, 'mage'), 3);
assert.equal(legacyRunCount(m, 'priest'), 1);
assert.deepEqual(migrateProgress(m), m, 'migrating twice changes nothing');
// A save without a version counts as old; a fresh save is already current.
assert.ok(migrateProgress({ runs: { 't1:mage:10': { attempts: 1 } } }).legacyRuns['t1:mage:10']);
assert.equal(emptyProgress().version, 2);
// Importing an old export migrates too.
const imported = importJSON(JSON.stringify({ app: 'azeroth-class-trials', progress: { version: 1, runs: old.runs }, evidence: {} }));
assert.deepEqual(imported.progress.legacyRuns, old.runs);

// The Hall suggests the second character even when the first already played.
const chars = [
  { id: 'a', classId: 'mage', race: 'undead', name: 'One' },
  { id: 'b', classId: 'mage', race: 'troll', name: 'Two' },
];
const trials = [{ id: 't1', level: 10 }];
const next = nextSuggestion(trials, chars, { runs: { [runKey('t1', 'mage', 10, 'a')]: { attempts: 1 } } });
assert.equal(next.charId, 'b');

// Priest racials follow the race.
const barOf = (race, level, spec) => KITS.priest.build({ level, spec, role: 'dps', race }).bar;
for (const [level, spec] of [
  [10, null],
  [30, 'shadow'],
  [60, 'shadow'],
]) {
  const undead = barOf('undead', level, spec);
  const troll = barOf('troll', level, spec);
  assert.ok(undead.includes('priest.touch') && !undead.includes('priest.hex'), `Undead L${level} keeps Touch of Weakness`);
  assert.ok(troll.includes('priest.hex') && !troll.includes('priest.touch'), `Troll L${level} has Hex of Weakness, not Touch`);
  if (level > 10) {
    assert.ok(undead.includes('priest.darksac') && !undead.includes('priest.shadowguard'));
    assert.ok(troll.includes('priest.shadowguard') && !troll.includes('priest.darksac'));
  }
}
assert.equal(resolveAbility(getAbility('priest.hex'), 60).mana, 240);
assert.equal(resolveAbility(getAbility('priest.shadowguard'), 60).td, 96);

// Shadowguard: 3 charges, 3.5 s apart, then gone.
const s = createBattle(dummyEncounter({ level: 60 }), { classId: 'priest', level: 60, spec: 'shadow', race: 'troll', kit: KITS.priest, seed: 1 });
const p = player(s);
const foe = s.list.find((u) => u.side === 'enemy');
getAbility('priest.shadowguard').effects[0].fn({
  state: s,
  u: p,
  ab: resolveAbility(getAbility('priest.shadowguard'), 60),
  api: { applyAura: (...a) => applyAura(...a) },
});
const hp0 = foe.hp;
for (let i = 0; i < 5; i++) {
  dealDamage(s, foe, p, { amount: 1, school: 'physical', kind: 'melee', ability: 'melee', noMiss: true, noAvoid: true });
  for (let k = 0; k < 80; k++) step(s, 0.05);
}
assert.ok(hp0 - foe.hp <= 96 * 3 * 1.6 && hp0 > foe.hp, 'at most three reflections');
assert.ok(!p.auras.some((a) => a.id === 'priest.shadowguard'), 'charges used up');
console.log('character progress and priest racials ok');
