import fs from 'node:fs';
import { allAbilities, resolveAbility } from '../src/engine/registry.js';
import '../src/content/index.js';
import { NPC_KITS } from '../src/content/party.js';
const snapshot = JSON.parse(fs.readFileSync(new URL('../research/forever-ranks.json', import.meta.url)));
const raw = JSON.parse(fs.readFileSync(new URL('../research/forever-warrior-rogue.json', import.meta.url)));
const shamanBook = JSON.parse(fs.readFileSync(new URL('../research/forever-shaman-spellbook.json', import.meta.url))).data.spells;
const shamanTalents = JSON.parse(fs.readFileSync(new URL('../research/forever-shaman-talents.json', import.meta.url))).data.spells;
const nameKey = (s) => s.toLowerCase().replaceAll('’', "'");
const shamanSpells = [...shamanBook, ...shamanTalents].map((s) => ({ ...s, ranks: s.ranks.map((r) => ({ ...r, ...r.after, cd: r.after?.cooldown })) }));
const reviewed = JSON.parse(fs.readFileSync(new URL('../docs/ability-audit/reviewed-findings.json', import.meta.url)));
const rows = [];
for (const ab of Object.values(allAbilities()).filter((a) => /^(hunter|mage|priest|warrior|rogue|warlock|shaman|race|pet)\./.test(a.id))) {
  const cls = ab.id.split('.')[0],
    entry = snapshot.ranks[ab.id],
    spell =
      cls === 'shaman'
        ? shamanSpells.find((s) => nameKey(s.name) === nameKey(ab.name))
        : raw[cls]?.spells.find((s) => s.name.toLowerCase() === ab.name.toLowerCase());
  const rawSource = cls === 'shaman' ? 'research/forever-shaman-spellbook.json + forever-shaman-talents.json' : 'research/forever-warrior-rogue.json';
  const checks = [];
  for (const level of [10, 30, 60]) {
    const resolved = resolveAbility(ab, level),
      data = entry?.[level];
    for (const [field, want] of Object.entries(data?.kit || {})) {
      const actual = resolved[field];
      checks.push({ level, field, expected: want, actual, match: JSON.stringify(want) === JSON.stringify(actual), source: 'research/forever-ranks.json' });
    }
    const rank = spell?.ranks.filter((r) => r.level <= level).at(-1);
    if (rank) {
      for (const [field, text, pattern, multiplier] of [
        ['cooldown', rank.cd, /^(\d+(?:\.\d+)?) (sec|min) cooldown/, 1],
        ['range', rank.range, /^(\d+(?:\.\d+)?) yd/, 1],
        ['castTime', rank.cast, /^(\d+(?:\.\d+)?) sec/, 1],
      ]) {
        const parsed = pattern.exec(text || '');
        let actual = resolved[field];
        if (typeof actual === 'string') actual = resolved[actual];
        if (parsed && typeof actual === 'number') {
          const expected = +parsed[1] * (parsed[2] === 'min' ? 60 : multiplier);
          checks.push({ level, field, expected, actual, match: Math.abs(actual - expected) < 0.001, source: rawSource });
        }
      }

      const m = /^(\d+) (Rage|Energy|Mana)$/i.exec(rank.cost || '');
      if (m && resolved.cost) {
        const key = m[2].toLowerCase(),
          ref = resolved.cost[key],
          actual = typeof ref === 'string' ? resolved[ref] : ref;
        if (actual !== undefined) checks.push({ level, field: 'cost.' + key, expected: +m[1], actual, match: actual === +m[1], source: rawSource });
      }
    }
  }
  const source = entry ? 'rank snapshot' : spell ? 'raw spellbook' : ab.forever?.src || 'no numeric source';
  const estimates = ['Gear, weapon profiles, encounter tuning and Classic-derived stats are simulation assumptions.'];
  if (JSON.stringify(ab, (k, v) => (typeof v === 'function' ? v.toString() : v)).match(/coef|statOf|power|critMult/))
    estimates.push(
      'Power coefficients, normalization and talent/proc calculations require separate evidence; matching base ranks does not verify final damage.',
    );
  if (cls === 'rogue') estimates.push('Poison AP scaling is not verified; the current poison model has no AP coefficient.');
  if (!entry) estimates.push('No independently normalized numeric reference in forever-ranks.json.');
  rows.push({
    id: ab.id,
    name: ab.name,
    classId: cls,
    declaredStatus: ab.forever?.status || 'unlabelled',
    source,
    sourceNote: ab.forever?.note || null,
    checks,
    mismatches: checks.filter((c) => !c.match),
    rawReference: spell || null,
    implementationDefinition: JSON.parse(JSON.stringify(ab, (key, value) => (typeof value === 'function' ? value.toString() : value))),
    reviewedFindings: reviewed.filter((f) => f.abilities.includes(ab.id)),
    estimates,
    status: checks.some((c) => !c.match)
      ? 'mismatch'
      : entry
        ? 'base-fields-match-snapshot'
        : checks.length
          ? 'raw-fields-match-partial'
          : 'estimate-or-unverified',
  });
}
const summary = {
  date: '2026-10-29',
  build: snapshot.build,
  liveVerification:
    'Official class deep-dive and stored spellbook snapshots; Shaman spellbook and talent tree retrieved on 2026-10-29. A datamine is not an official runtime guarantee.',
  abilities: rows.length,
  checkedFields: rows.reduce((n, r) => n + r.checks.length, 0),
  mismatches: rows.flatMap((r) => r.mismatches.map((c) => ({ id: r.id, ...c }))),
  classes: Object.fromEntries([...new Set(rows.map((r) => r.classId))].map((c) => [c, rows.filter((r) => r.classId === c).length])),
};
fs.mkdirSync('docs/ability-audit', { recursive: true });
fs.writeFileSync('docs/ability-audit/audit.json', JSON.stringify({ summary, abilities: rows }, null, 2));
let md =
  '# Forever ability audit — 2026-10-29\n\nEvery registered class and racial ability is inventoried, including playable Shaman and NPC Warlock. A matching base field is not proof of complete gameplay fidelity.\n\nBuild: ' +
  snapshot.build +
  '. Shaman spellbook and talent tree were retrieved on October 29; other classes use their retained snapshots. Coefficients and final tuning remain unverified where noted.\n\n| Ability | Status | Numeric checks | Source | Remaining uncertainty |\n|---|---|---:|---|---|\n';
for (const r of rows)
  md += '| ' + r.id + ' — ' + r.name + ' | ' + r.status + ' | ' + r.checks.length + ' | ' + r.source + ' | ' + r.estimates.join(' ') + ' |\n';
md += '\nFull expected/actual values and raw rank references: audit.json.\n';
fs.writeFileSync('docs/ability-audit/README.md', md);
console.log(JSON.stringify(summary, null, 2));
if (summary.mismatches.length) process.exitCode = 1;
