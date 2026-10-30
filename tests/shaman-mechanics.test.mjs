import assert from 'node:assert/strict';
import fs from 'node:fs';
import { KITS } from '../src/content/index.js';
import { POINTS } from '../src/content/classes/shaman-builds.js';
import { activeTotems, summonTotem } from '../src/content/classes/shaman-totems.js';
import { createBattle, player, playerCast, step, abilityCost, castTimeOf, api, findAura, dealDamage, spawnUnit, statOf, killUnit } from '../src/engine/core.js';
import { dummyEncounter } from './bots/harness.mjs';
import { getAbility, resolveAbility } from '../src/engine/registry.js';
const tree = JSON.parse(fs.readFileSync(new URL('../research/forever-shaman-tree.json', import.meta.url)));
for (const [build, points] of Object.entries(POINTS)) {
  const budget = build.endsWith('30') ? 21 : 51;
  assert.equal(
    Object.values(points).reduce((n, p) => n + p, 0),
    budget,
    build + ' point budget',
  );
  for (const [id, ts] of Object.entries(tree)) {
    const talents = Object.values(ts),
      remaining = talents.filter((t) => points[t.name]);
    let spent = 0;
    const learned = {};
    while (remaining.length) {
      const i = remaining.findIndex((t) => t.requiredPoints <= spent && t.requires.every((r) => (learned[r.id] || 0) >= r.qty));
      assert.ok(i >= 0, build + ' invalid tree allocation');
      const [t] = remaining.splice(i, 1),
        n = points[t.name];
      assert.ok(n <= t.ranks.length);
      spent += n;
      learned[t.id] = n;
    }
  }
}
function setup(level = 60, spec = 'elemental') {
  const s = createBattle(dummyEncounter({ level, duration: 1000 }), {
    classId: 'shaman',
    level,
    spec,
    role: spec === 'resto' ? 'healer' : 'dps',
    kit: KITS.shaman,
    seed: 1,
  });
  const p = player(s),
    t = s.list.find((u) => u.side === 'enemy');
  p.x = 20;
  p.y = 15;
  t.x = 24;
  t.y = 15;
  p.target = t.id;
  p.stats.critSpell = 0;
  p.stats.critPhys = 0;
  s.rng = () => 0.9;
  return { s, p, t };
}
const wait = (s, n) => {
  for (let i = 0; i < Math.ceil(n / 0.05); i++) step(s, 0.05);
};
const cast = (s, p, id, opts = {}) => {
  p.gcd = 0;
  const r = playerCast(s, id, opts);
  assert.ok(r.ok, id + ': ' + r.reason);
  if (p.casting) wait(s, p.casting.total + 0.1);
  return r;
};
{
  const { s, p } = setup(60, 'resto');
  p.regen = { ...p.regen, spirit: 0, mp5: 0, hpOOC: 0 };
  cast(s, p, 'shaman.manatide');
  p.res.mana.cur = 0;
  wait(s, 12.1);
  assert.equal(p.res.mana.cur, 290 * 4, 'Mana Tide delivers all four scheduled pulses');
  assert.equal(activeTotems(s, p).length, 0);
}
{
  const { s, p } = setup();
  p.regen = { ...p.regen, spirit: 0, mp5: 0, hpOOC: 0 };
  const cost = abilityCost(p, p.ab['shaman.strength']).mana;
  cast(s, p, 'shaman.strength');
  wait(s, 0.1);
  const before = statOf(p, 'ap');
  assert.equal(before, p.stats.ap + 106, 'Strength of Earth scales melee AP');
  cast(s, p, 'shaman.earthbind');
  wait(s, 0.1);
  assert.equal(activeTotems(s, p).length, 1);
  assert.equal(statOf(p, 'ap'), p.stats.ap, 'replacement removes old buff');
  p.cds['shaman.earthbind'] = 0;
  cast(s, p, 'shaman.strength');
  const ids = activeTotems(s, p).map((t) => t.id),
    expires = activeTotems(s, p)[0].meta.until;
  cast(s, p, 'shaman.projection', { point: { x: 35, y: 15 } });
  assert.deepEqual(
    activeTotems(s, p).map((t) => t.id),
    ids,
  );
  assert.equal(activeTotems(s, p)[0].meta.until, expires, 'projection does not refresh duration');
  p.res.mana.cur = 0;
  cast(s, p, 'shaman.recall');
  assert.equal(p.res.mana.cur, cost * 0.25, 'refund is based on paid cost');
  assert.equal(activeTotems(s, p).length, 0);
  p.res.mana.cur = p.res.mana.max;
  cast(s, p, 'shaman.searing');
  p.gcd = 0;
  assert.equal(playerCast(s, 'shaman.hw', { targetId: activeTotems(s, p)[0].id }).reason, 'invalid', 'totems are not heal targets');
  killUnit(s, p, null);
  wait(s, 0.1);
  assert.equal(activeTotems(s, p).length, 0, 'owner death removes totems');
}
{
  const { s, p } = setup();
  p.regen = { ...p.regen, spirit: 0, mp5: 0, hpOOC: 0 };
  cast(s, p, 'shaman.spring');
  const other = spawnUnit(s, {
    ...KITS.shaman.build({ level: 60, spec: 'elemental' }).template,
    classId: 'shaman',
    kind: 'ally',
    side: p.side,
    level: 60,
    x: 21,
    y: 15,
  });
  other.regen = { ...other.regen, spirit: 0, mp5: 0, hpOOC: 0 };
  summonTotem({ state: s, u: other, api, ab: other.ab['shaman.spring'] }, { element: 'water', buff: 'manaSpring', mana: { 60: 10 } });
  p.res.mana.cur = 0;
  wait(s, 2.1);
  assert.equal(p.res.mana.cur, 10, 'identical Mana Springs never stack');
}
{
  const { s, p, t } = setup(60, 'enhancement');
  p.res.mana.cur = p.res.mana.max;
  cast(s, p, 'shaman.stormstrike');
  assert.ok(p.autoMelee);
  assert.ok(findAura(t, 'shaman.stormstrike', p.id));
  p.autoMelee = false;
  s.rng = () => 0;
  cast(s, p, 'shaman.es');
  assert.ok(findAura(t, 'shaman.stormstrike', p.id), 'miss preserves Stormstrike');
  assert.ok(p.cds['shaman.fs'] > 0 && p.cds['shaman.fr'] > 0, 'Shocks share cooldown');
  p.cds = {};
  s.rng = () => 0.9;
  api.applyAura(s, t, t, { id: 'absorb', duration: 30, absorb: 9999 });
  cast(s, p, 'shaman.es');
  assert.equal(findAura(t, 'shaman.stormstrike', p.id), null, 'absorbed landed spell consumes Stormstrike');
  api.applyAura(s, p, p, { id: 'shaman.maelstrom', duration: 30, stacks: 5 });
  assert.equal(castTimeOf(p, p.ab['shaman.lb']), 0);
  assert.equal(abilityCost(p, p.ab['shaman.lb']).mana, 0);
  cast(s, p, 'shaman.lb');
  assert.equal(findAura(p, 'shaman.maelstrom'), null);
}
{
  const { s, p, t } = setup();
  s.rng = () => 0;
  cast(s, p, 'shaman.fs');
  assert.equal(findAura(t, 'shaman.fs', p.id), null, 'miss cannot apply Flame Shock');
  p.cds = {};
  cast(s, p, 'shaman.fr');
  assert.equal(findAura(t, 'shaman.fr', p.id), null, 'miss cannot slow');
}
{
  const { s, p, t } = setup(60, 'resto');
  cast(s, p, 'shaman.watershield');
  p.res.mana.cur = 0;
  dealDamage(s, t, p, { amount: 10, school: 'physical', noMiss: true, canCrit: false });
  assert.equal(p.res.mana.cur, p.res.mana.max * 0.02);
  assert.equal(findAura(p, 'shaman.watershield').stacks, 2);
  dealDamage(s, t, p, { amount: 10, school: 'shadow', isTick: true, canCrit: false });
  assert.equal(findAura(p, 'shaman.watershield').stacks, 2, 'periodic damage does not spend a shield globe');
  p.res.mana.cur = p.res.mana.max;
  cast(s, p, 'shaman.lightshield');
  assert.equal(findAura(p, 'shaman.watershield'), null, 'elemental shields are exclusive');
}
{
  const { s, p } = setup();
  cast(s, p, 'shaman.em');
  assert.equal(castTimeOf(p, p.ab['shaman.lb']), 1.5);
  assert.equal(KITS.shaman.build({ level: 30, spec: 'elemental' }).bar.includes('shaman.cl'), false, 'Chain Lightning is learned after 30');
  assert.equal(p.ab['shaman.cl'].mana, 315);
  assert.equal(resolveAbility(getAbility('shaman.lb'), 60).dmg[0], 191);
}
console.log(
  'Shaman: legal talent budgets, four Tide pulses, totem lifecycle, non-stacking buffs, Shock misses/cooldowns, Stormstrike, Maelstrom and shields verified.',
);

{
  const { s, p, t } = setup();
  for (const x of [26, 28]) spawnUnit(s, { name: 'Extra dummy', side: 'enemy', kind: 'enemy', level: 60, maxHp: 1e5, x, y: 15, speed: 0 });
  p.stats.critSpell = 0;
  s.rng = () => 0.05;
  const ab = p.ab['shaman.cl'];
  api.applyEffects(s, p, ab, t, null, ab.effects);
  const hits = s.events.filter((e) => e.type === 'damage' && e.ability === 'shaman.cl');
  assert.equal(hits.length, 6, 'Lightning Overload duplicates the entire three-target Chain Lightning');
  for (const dst of new Set(hits.map((h) => h.dst))) {
    const amounts = hits.filter((h) => h.dst === dst).map((h) => h.amount);
    assert.ok(Math.abs(amounts[1] - amounts[0] * 0.5) <= 1, 'overload is half damage');
    assert.ok(s.units[dst].threat[p.id] < amounts[0] + amounts[1], 'overload adds no threat');
  }
}
