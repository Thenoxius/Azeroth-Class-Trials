// Kit spell values must match the datamined Forever ranks in research/forever-ranks.json.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import '../src/content/index.js';
import { allAbilities, resolveAbility } from '../src/engine/registry.js';

const data = JSON.parse(fs.readFileSync(new URL('../research/forever-ranks.json', import.meta.url), 'utf8'));
const abilities = allAbilities();
let checked = 0;
for (const [id, entry] of Object.entries(data.ranks)) {
  assert.ok(abilities[id], `${id} (${entry.spell}) is not a registered ability`);
  for (const [level, rank] of Object.entries(entry)) {
    if (!/^\d+$/.test(level)) continue;
    const ab = resolveAbility(abilities[id], Number(level));
    for (const [field, want] of Object.entries(rank.kit)) {
      const got = ab[field];
      const close = (a, b) => typeof a === 'number' && Math.abs(a - b) <= 0.5;
      const ok = Array.isArray(want) ? Array.isArray(got) && want.every((w, i) => close(got[i], w)) : close(got, want);
      assert.ok(ok, `${id} L${level} ${field}: kit has ${JSON.stringify(got)}, datamine (${rank.text}) says ${JSON.stringify(want)}`);
      checked++;
    }
  }
}
console.log(`ranks ok (${checked} values against build ${data.build})`);
