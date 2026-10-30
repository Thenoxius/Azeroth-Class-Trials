// The analysis must treat all six classes alike: missing information is never a penalty,
// thin data never reads as a verdict, and the evidence kinds stay apart.
import assert from 'node:assert/strict';
import { TRIALS } from '../src/content/index.js';
import { analyze, factRowsComparable } from '../src/analysis/analyze.js';
import { CLASSES, DIM_IDS, paceOf } from '../src/analysis/model.js';
import { CLASS_FACTS, SOURCES } from '../src/content/facts.js';

const trials = TRIALS.filter((t) => !t.leaderboard);
const LEVEL = { t1: 10, t2: 30, t3: 30, t4: 60, t5: 60 };
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
const answer = (s, v) => ({
  sessionId: s.id,
  trialId: s.trialId,
  classId: s.classId,
  level: s.level,
  enjoyment: v,
  frustration: null,
  again: v,
  moment: null,
  skipped: false,
});

// Empty save: no winner, no ranking, no coverage.
const empty = analyze({ sessions: [], feedback: [], trials });
assert.equal(empty.recommendation.status, 'empty');
assert.equal(empty.recommendation.main, null);
assert.equal(empty.coverage, 0);
assert.deepEqual(empty.conflicts, [], 'an empty save has no mixed signals');
for (const r of empty.ranking) assert.equal(r.total, null, `${r.cls} must not get a total from research alone`);
for (const cls of CLASSES)
  for (const dim of DIM_IDS) assert.ok(!empty.classes[cls].dims[dim].evidence.some((e) => e.kind === 'self'), `${cls}.${dim}: nothing was said yet`);

// One class played: nothing to compare.
const single = analyze({ sessions: [session('mage', 't1')], feedback: [], trials });
assert.equal(single.recommendation.status, 'single');
assert.equal(single.recommendation.main, null);
assert.equal(single.classes.warrior.total, null);

// Uneven coverage: three classes on every trial is an early read, never a firm verdict.
const three = ['hunter', 'mage', 'priest'].flatMap((c) => Object.keys(LEVEL).map((t) => session(c, t)));
const uneven = analyze({ sessions: three, feedback: three.filter((s) => s.classId === 'mage').map((s) => answer(s, 5)), trials });
assert.equal(uneven.recommendation.status, 'early');
assert.equal(uneven.recommendation.confident, false);
assert.equal(uneven.recommendation.main, 'mage');
assert.deepEqual(uneven.recommendation.thinClasses, ['warrior', 'rogue', 'shaman']);
for (const c of ['warrior', 'rogue', 'shaman']) {
  assert.equal(uneven.classes[c].total, null, `${c}: unplayed is not a low score`);
  for (const dim of DIM_IDS)
    assert.ok(!uneven.classes[c].dims[dim].evidence.some((e) => e.kind === 'observed' && e.value < 0), `${c}.${dim}: no negative evidence without play`);
}

// All six, equal play: firm verdict possible, and identical runs give identical observed evidence.
const six = CLASSES.flatMap((c) => Object.keys(LEVEL).map((t) => session(c, t)));
const even = analyze({ sessions: six, feedback: six.filter((s) => s.classId === 'rogue').map((s) => answer(s, 5)), trials });
assert.equal(even.recommendation.status, 'ready');
assert.equal(even.recommendation.main, 'rogue');
assert.equal(even.coverage, 1);
// Rules that do not apply to a kit add nothing; what remains must not differ between classes.
const moved = (a, c) =>
  DIM_IDS.flatMap((d) => a.classes[c].dims[d].evidence.filter((e) => e.kind === 'observed' && e.value !== 0).map((e) => [d, e.rule, e.value]));
const same = analyze({ sessions: six, feedback: [], trials });
for (const c of CLASSES) assert.deepEqual(moved(same, c), moved(same, 'mage'), `${c}: same play must read the same as Mage`);

// R1: a rage or energy kit is not compared with casters on activity.
const r1 = analyze({
  sessions: [session('warrior', 't1', { gcd: { utilization: 0.3, buckets: [] } }), session('mage', 't1', { gcd: { utilization: 0.95, buckets: [] } })],
  trials,
});
const has = (a, c, rule) => DIM_IDS.some((d) => a.classes[c].dims[d].evidence.some((e) => e.rule === rule));
assert.ok(!has(r1, 'warrior', 'R1') && !has(r1, 'mage', 'R1'), 'no R1 across pace of play');
assert.equal(paceOf({ classId: 'shaman', spec: 'enhancement' }), 'enhancement');
assert.equal(paceOf({ classId: 'shaman', spec: 'elemental' }), 'caster');
assert.equal(paceOf({ classId: 'priest', role: 'healer' }), 'healer');

// R18: replay minutes never count against a class you did not play.
const replay = analyze({ sessions: [session('mage', 't1', { afterWin: true, realMs: 300000 }), session('priest', 't1')], trials });
assert.ok(!has(replay, 'warrior', 'R18'));

// R19: more than one role counts for every class that has them.
const roles = analyze({
  sessions: [session('warrior', 't3', { role: 'tank' }), session('warrior', 't3'), session('shaman', 't5', { role: 'healer' }), session('shaman', 't5')],
  trials,
});
assert.ok(has(roles, 'warrior', 'R19') && has(roles, 'shaman', 'R19'));

// Provenance: two characters and unlinked runs stay visible at class level.
const prov = analyze({ sessions: [session('mage', 't1', { charId: 'a' }), session('mage', 't2', { charId: 'b' }), session('mage', 't3')], trials });
assert.deepEqual(prov.classes.mage.byCharacter, { a: 1, b: 1 });
assert.equal(prov.classes.mage.unlinkedRuns, 1);

// Attachment is opt-in: at default weights nobody gets a free preference.
assert.ok(!DIM_IDS.some((d) => same.classes.priest.dims[d].evidence.some((e) => e.kind === 'self')));

// Facts: only rows where every class has a sourced fact score; every fact has a known source.
const comparable = factRowsComparable();
const ids = new Set(SOURCES.map((s) => s.id));
for (const c of CLASSES) {
  const dims = CLASS_FACTS[c].dims;
  assert.ok(Object.keys(dims).length >= 5, `${c}: too few sourced rows`);
  for (const [dim, list] of Object.entries(dims)) {
    assert.ok(DIM_IDS.includes(dim), `${c}: unknown row ${dim}`);
    for (const f of list) assert.ok(ids.has(f.src), `${c}.${dim}: unknown source ${f.src}`);
  }
}
for (const c of CLASSES)
  for (const dim of DIM_IDS)
    for (const e of same.classes[c].dims[dim].evidence.filter((x) => x.kind === 'fact'))
      assert.equal(e.scored, comparable.includes(dim), `${c}.${dim}: scored flag`);
console.log('comparable fact rows:', comparable.join(', '));
console.log('analysis fairness ok');
