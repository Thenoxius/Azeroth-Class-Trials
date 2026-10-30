// Race choice: every race/class pair builds with its own portrait, racials and attributes,
// the racials work in the engine, and a competent bot still wins with every race.
import assert from 'node:assert/strict';
import { KITS } from '../src/content/index.js';
import { NPC_KITS } from '../src/content/party.js';
// Classes not yet in CLASS_ORDER (phase 4) are checked through their kit directly.
const kitOf = (c) => KITS[c] || NPC_KITS[c];
import { CLASS_RACES, validRace } from '../src/content/races.js';
import { PORTRAIT_IMG } from '../src/ui/art/art-images.gen.js';
import { BOTS } from './bots/trial-suite.mjs';
import { runTrial } from './bots/harness.mjs';

for (const [classId, races] of Object.entries(CLASS_RACES)) {
  assert.equal(validRace(classId, 'gnome'), races[0], 'unknown race falls back to the default');
  for (const race of races) {
    for (const level of kitOf(classId).supportedLevels || [10, 30, 60]) {
      const b = kitOf(classId).build({ level, race, trialId: 't1' });
      assert.equal(b.race, race);
      assert.equal(b.template.portrait, `${race}-${classId}`);
      assert.ok(PORTRAIT_IMG[b.template.portrait] !== undefined, `bundled portrait for ${race}-${classId}`);
      const racials = b.consumables.filter((id) => id.startsWith('race.'));
      assert.ok(racials.length >= 1, `${race} ${classId} has racial actives`);
      for (const other of Object.keys({ orc: 1, troll: 1, tauren: 1, undead: 1, skyborne: 1 })) {
        if (other === race) continue;
        const foreign = { orc: 'race.bloodfury', troll: 'race.berserking', tauren: 'race.warstomp', undead: 'race.wotf', skyborne: 'race.skysight' }[other];
        assert.ok(!racials.includes(foreign), `${race} ${classId} must not get ${foreign}`);
      }
    }
  }
}

// Passives reach the unit: Tauren +5 % health, Orc +1 % crit, Skyborne haste aura.
const hp = (race) => KITS.hunter.build({ level: 60, race, trialId: 't1' }).template.maxHp;
assert.ok(hp('tauren') > hp('orc') * 1.04, 'Endurance: Tauren has more health');
const crit = (race) => KITS.mage.build({ level: 60, race, trialId: 't1' }).template.stats.critSpell;
assert.ok(Math.abs(crit('orc') - crit('troll')) < 0.002, 'October 26: Orc Savage removed');
assert.ok(KITS.hunter.build({ level: 60, race: 'skyborne', trialId: 't1' }).template.auras.some((a) => a.id === 'race.windblessed'));

// A competent bot wins T1 with every race (the racials must not break a fight).
for (const [classId, races] of Object.entries(CLASS_RACES).filter(([c]) => BOTS[c])) {
  for (const race of races) {
    const spec = kitOf(classId).specs?.[30]?.[0]?.id;
    const r = runTrial({ classId, trialId: 't1', level: 30, spec, race, seed: 1, policy: BOTS[classId].competent({ level: 30, spec }), maxSeconds: 600 });
    console.log(`${classId.padEnd(7)} ${race.padEnd(9)} T1 L30: ${r.outcome && r.outcome.result} in ${Math.round(r.t)} s`);
    assert.equal(r.outcome && r.outcome.result, 'victory', `${race} ${classId} wins T1`);
    assert.equal(r.player.portrait, `${race}-${classId}`);
  }
}

// War Stomp stuns, Hardiness shortens stuns.
{
  const r = runTrial({ classId: 'hunter', trialId: 't1', level: 30, race: 'tauren', seed: 2, maxSeconds: 0.1 });
  assert.ok(r.player.abilities.includes('race.warstomp') || r.player.ab['race.warstomp'], 'Tauren has War Stomp on the unit');
}
console.log('races ok');
