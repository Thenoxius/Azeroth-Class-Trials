// The comparison rests on what you said. Behaviour, performance and facts must never move it,
// missing information is never a penalty, and repeats are one opinion.
import assert from 'node:assert/strict';
import { TRIALS } from '../src/content/index.js';
import { analyze } from '../src/analysis/analyze.js';
import { CLASSES } from '../src/analysis/model.js';
import { CLASS_FACTS, SOURCES } from '../src/content/facts.js';

const trials = TRIALS.filter((t) => !t.leaderboard);
const LEVEL = { t1: 30, t2: 30, t3: 30, t4: 60, t5: 60 };
let n = 0;
const session = (classId, trialId, over = {}) => ({
  id: 's' + ++n,
  classId,
  trialId,
  level: LEVEL[trialId],
  role: 'dps',
  kind: trials.find((t) => t.id === trialId).kind,
  outcome: 'victory',
  abandoned: false,
  combatSeconds: 120,
  simSeconds: 150,
  realMs: 150000,
  barSize: 12,
  abilities: { a: 5, b: 3, c: 2 },
  categories: {},
  gcd: { utilization: 0.7, buckets: [] },
  resource: { restSeconds: 0, potions: { heal: 0 } },
  ui: {},
  danger: [],
  mechanics: [],
  ...over,
});
const answer = (s, fun, over = {}) => ({
  v: 2,
  sessionId: s.id,
  trialId: s.trialId,
  classId: s.classId,
  level: s.level,
  role: s.role,
  spec: s.spec || null,
  fun,
  effort: null,
  obstacle: null,
  moment: null,
  custom: null,
  skipped: false,
  ...over,
});
const run = (sessions, feedback = [], extra = {}) => analyze({ sessions, feedback, trials, ...extra });
const cmp = (answer) => ({ comparisons: [{ situation: 't1:30:dps', a: 'mage', b: 'hunter', answer }] });

// Empty: nothing is claimed, and research alone names no class.
const empty = run([]);
assert.equal(empty.status, 'empty');
assert.equal(empty.lean, null);
assert.deepEqual(empty.played, []);

// One class: nothing to compare.
assert.equal(run([session('mage', 't1')]).status, 'single');

// Played but no answers: behaviour alone gives no preference.
const silent = run([
  session('mage', 't1', { abilities: { a: 90, b: 1, c: 1, d: 1 }, categories: { control: 40 } }),
  session('hunter', 't1', { outcome: 'defeat', abilities: { a: 1 } }),
]);
assert.equal(silent.status, 'uncompared');
assert.equal(silent.lean, null);

// Winning, losing and pressing more buttons do not change an equal answer into a preference.
const m = session('mage', 't1', { abilities: { a: 90, b: 9, c: 9, d: 9 } });
const h = session('hunter', 't1', { outcome: 'defeat', abilities: { a: 1 } });
const equal = run([m, h], [answer(m, 4), answer(h, 4)]);
assert.equal(equal.status, 'tie');
assert.deepEqual(new Set(equal.tied), new Set(['mage', 'hunter']));

// Fun decides, even for the class that lost. High effort does not count against it.
const hard = run([m, h], [answer(m, 2), answer(h, 4, { effort: 5, obstacle: 'timing' })]);
assert.equal(hard.status, 'lean');
assert.equal(hard.lean.cls, 'hunter');
assert.equal(hard.lean.strength, 'slight');

// Don't know and skipping are missing, not neutral: no vote and no penalty.
for (const missing of ['unknown', null]) assert.equal(run([m, h], [answer(m, 5), answer(h, missing)]).status, 'uncompared');
assert.equal(run([m, h], [answer(m, 5), answer(h, null, { skipped: true })]).status, 'uncompared');

// Repeats are one opinion: three runs of one trial are not three confirmations.
const m2 = session('mage', 't1');
const m3 = session('mage', 't1');
const rep = run([m, m2, m3, h], [answer(m, 5), answer(m2, 5), answer(m3, 5), answer(h, 3)]);
assert.equal(rep.lean.cls, 'mage');
assert.equal(rep.lean.reasons.length, 1, 'one situation, one reason');
assert.equal(rep.lean.strength, 'slight');
// And the latest counts: changing your mind is allowed.
assert.equal(run([m, m2, h], [answer(m, 5), answer(m2, 1), answer(h, 3)]).lean.cls, 'hunter');

// A direct comparison outranks fun answers in that situation.
assert.equal(run([m, h], [answer(m, 5), answer(h, 3)], cmp('b')).lean.cls, 'hunter');
// "Haven't tried enough" is missing; "both" and "neither" are equal.
assert.equal(run([m, h], [], cmp('insufficient')).status, 'uncompared');
assert.equal(run([m, h], [], cmp('both')).status, 'tie');
assert.equal(run([m, h], [], cmp('neither')).status, 'tie');

// Contradictory preferences are a valid outcome.
const m4 = session('mage', 't2');
const h4 = session('hunter', 't2');
const mixed = run([m, h, m4, h4], [answer(m, 5), answer(h, 2), answer(m4, 2), answer(h4, 5)]);
assert.equal(mixed.status, 'conflict');
assert.equal(mixed.lean, null);

// Two situations the same way read as clearer, still with no number.
const clear = run([m, h, m4, h4], [answer(m, 5), answer(h, 2), answer(m4, 5), answer(h4, 2)]);
assert.equal(clear.lean.strength, 'clearer');
assert.ok(!('total' in clear.classes.mage) && !('ranking' in clear), 'no scores to over-read');

// Different roles are different situations: healing is not compared with damage.
const pHeal = session('priest', 't3', { role: 'healer', spec: 'holy' });
const mDps = session('mage', 't3');
const roles = run([pHeal, mDps], [answer(pHeal, 5), answer(mDps, 1)]);
assert.equal(roles.status, 'uncompared');
assert.deepEqual(roles.classes.priest.roles, ['healer']);
assert.deepEqual(roles.classes.priest.specs, ['holy']);
const pDps = session('priest', 't3', { spec: 'shadow' });
assert.equal(run([pHeal, pDps, mDps], [answer(pHeal, 5), answer(pDps, 2), answer(mDps, 4)]).lean.cls, 'mage', 'only the damage run is compared');

// The same fight at another level is another situation.
const low = session('mage', 't1', { level: 10 });
assert.equal(run([low, h], [answer(low, 5), answer(h, 1)]).status, 'uncompared');

// Two specs of a class in one situation are both kept.
const fr = session('mage', 't1', { spec: 'frost' });
const fi = session('mage', 't1', { spec: 'fire' });
const specs = run([fr, fi, h], [answer(fr, 5), answer(fi, 3), answer(h, 4)]);
assert.equal(specs.status, 'tie', 'the specs average out within one category');
assert.deepEqual(specs.situations[0].classes.mage.specList.sort(), ['fire', 'frost']);

// A technical problem sets the answer aside and says so.
const tech = run([m, h], [answer(m, 1, { obstacle: 'technical', effort: 5 }), answer(h, 4)]);
assert.equal(tech.status, 'uncompared');
assert.ok(tech.uncertainties.some((u) => u.includes('technical')));

// Uneven coverage: a lean among two classes says nothing about the others, and they are not low.
const partial = run([m, h], [answer(m, 5), answer(h, 2)]);
for (const c of ['warrior', 'rogue', 'shaman', 'priest']) assert.equal(partial.classes[c].played, false);
assert.ok(partial.uncertainties.some((u) => u.includes('only one kind of situation')));

// Every current class can be the preference; the logic does not care which.
for (const a of CLASSES)
  for (const b of CLASSES.filter((x) => x !== a)) {
    const sa = session(a, 't1');
    const sb = session(b, 't1');
    assert.equal(run([sa, sb], [answer(sa, 5), answer(sb, 3)]).lean.cls, a);
  }

// Facts about classes are listed, never used.
for (const c of CLASSES) {
  assert.ok(empty.evidence.fact[c].length >= 5, `${c}: sourced facts listed`);
  assert.ok(empty.evidence.self[c].length === 0 && empty.evidence.observed[c].length === 0, 'kinds stay apart');
}
const ids = new Set(SOURCES.map((s) => s.id));
for (const c of CLASSES)
  for (const list of Object.values(CLASS_FACTS[c].dims)) for (const f of list) assert.ok(ids.has(f.src), `${c}: unknown source ${f.src}`);

// The player can correct the interpretation.
const corrected = run([m, h], [answer(m, 5), answer(h, 2)], { confirmations: { 'lean:mage': 'no' } });
assert.equal(corrected.status, 'corrected');
assert.equal(corrected.lean, null);

// Behaviour raises a question, and answering it does not change the preference.
const again = session('hunter', 't1', { afterWin: true });
const q = run([m, h, again], [answer(m, 5), answer(h, 2)], { confirmations: { 'replay:hunter:t1:30:dps': 'yes' } });
assert.equal(q.followUps[0].answer, 'yes');
assert.equal(q.lean.cls, 'mage');

// Performance is reported apart, and earlier experience is named.
assert.deepEqual(partial.performance.hunter, { runs: 1, wins: 0, escaped: 0 });
assert.ok(run([m, h], [], { experience: { mage: 'lots', hunter: 'new' } }).uncertainties.some((u) => u.includes('already knew')));
console.log('analysis fairness ok');
