import assert from 'node:assert/strict';
import { KITS } from '../src/content/index.js';
import { createBattle, player, dealDamage, healUnit } from '../src/engine/core.js';
import { dummyEncounter } from './bots/harness.mjs';
const s = createBattle(dummyEncounter({ level: 60 }), { classId: 'mage', level: 60, spec: 'fire', kit: KITS.mage, seed: 1 });
const p = player(s),
  t = s.list.find((u) => u.side === 'enemy');
p.auras = [];
p.stats.critSpell = 1;
p.auras.push({ def: { mods: { dmgDone: { all: 1.5 } } } });
t.armor = 0;
t.resist = {};
assert.equal(
  dealDamage(s, p, t, { amount: 100, school: 'fire', kind: 'dot', ability: 'audit', isTick: true, noMiss: true, canCrit: false, ignoreSourceModifiers: true }),
  100,
  'already-scaled Ignite skips source multipliers',
);
p.hp = p.maxHp - 1000;
assert.equal(healUnit(s, p, p, { amount: 100, isTick: true, canCrit: true }), 150, 'opted-in periodic heal can crit');
p.hp = p.maxHp - 1000;
assert.equal(healUnit(s, p, p, { amount: 100, isTick: true }), 100, 'periodic heals do not universally gain crit');
console.log('official mechanic regressions ok');

// Latest official racial notes override older datamined tooltips.
import { getAbility } from '../src/engine/registry.js';
assert.equal(getAbility('race.bloodfury').cooldown, 120);
assert.equal(getAbility('race.berserking').effects[0].aura.duration, 15);
const orc = KITS.hunter.build({ level: 60, spec: 'bm', race: 'orc' });
assert.equal(orc.template.auras.find((a) => a.id === 'race.command').mods.petDamage, 1.05);
assert.ok(!orc.racials.some((a) => a.name === 'Savage'));
const sky = KITS.hunter.build({ level: 60, spec: 'bm', race: 'skyborne' });
assert.equal(sky.template.auras.find((a) => a.id === 'race.windblessed').mods.meleeHaste, 0.02);

import { resolveAbility } from '../src/engine/registry.js';
assert.equal(resolveAbility(getAbility('shaman.riptide'), 60).coef, 0.214);
const arms = KITS.warrior.build({ level: 60, spec: 'arms', race: 'orc' });
assert.ok(!arms.template.auras.some((a) => a.id === 'warrior.t.impale'), 'Impale must not increase white criticals');
assert.equal(arms.template.auras.find((a) => a.id === 'warrior.t.2h').mods.dmgDone.physical, 1.03);
const combat = KITS.rogue.build({ level: 60, spec: 'combat', race: 'orc' });
assert.equal(combat.template.melee.oh.mult, 0.625, 'offhand talent multiplies its baseline 50% penalty');

t.auras.push({ def: { mods: { dmgTaken: { all: 1.5 } } } });
assert.equal(
  dealDamage(s, p, t, {
    amount: 100,
    school: 'shadow',
    kind: 'spell',
    ability: 'race.totg',
    noMiss: true,
    canCrit: false,
    ignoreSourceModifiers: true,
    ignoreTargetModifiers: true,
  }),
  100,
  'Touch of the Grave skips both source and target percentage bonuses',
);
