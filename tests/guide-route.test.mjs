// The guided route, old-save rules for feedback, hints and the practice yard.
import assert from 'node:assert/strict';
import { analyze } from '../src/analysis/analyze.js';
import { CLASS_INTRO } from '../src/content/class-intro.js';
import { CLASS_ORDER, KITS, PRACTICE, TRIALS, trialById } from '../src/content/index.js';
import { createBattle, drainEvents, player, playerCast, setTarget, step } from '../src/engine/core.js';
import { createHints, currentGoal, MAX_HINTS, updateHints } from '../src/guide/hints.js';
import { cellKey, countsAsEvidence, nextStep, pendingComparison, routeCells, routeProgress, skipCell } from '../src/guide/route.js';
import { emptyEvidence, importJSON, migrateEvidence } from '../src/telemetry/store.js';

const chars = [
  { id: 'a', classId: 'mage', race: 'undead' },
  { id: 'b', classId: 'warrior', race: 'orc' },
];
const guide = { classes: ['mage', 'warrior'], practice: {}, skipped: [] };
const run = (c, trialId, level, role = 'dps', over = {}) => ({
  id: `${c}${trialId}${level}${role}`,
  classId: c,
  trialId,
  level,
  role,
  abandoned: false,
  ...over,
});

// The practice comes first, can be skipped, and the first trial is not level 10.
const s0 = nextStep(guide, [], chars);
assert.equal(s0.type, 'practice');
assert.equal(s0.classId, 'mage');
const g1 = { ...guide, practice: { mage: true, warrior: true } };
const s1 = nextStep(g1, [], chars);
assert.deepEqual([s1.type, s1.trialId, s1.level, s1.role, s1.charId], ['trial', 't1', 30, 'dps', 'a']);

// It alternates classes in one situation before moving on, and the order rotates.
const s2 = nextStep(g1, [run('mage', 't1', 30)], chars);
assert.deepEqual([s2.classId, s2.trialId], ['warrior', 't1']);
const s3 = nextStep(g1, [run('mage', 't1', 30), run('warrior', 't1', 30)], chars);
assert.deepEqual([s3.classId, s3.trialId], ['warrior', 't2']);

// A role is its own step; level 10 runs do not fill level 30 steps; leaving early does not count.
const cells = routeCells(['mage', 'warrior']);
assert.ok(cells.some((c) => c.classId === 'warrior' && c.role === 'tank' && c.trialId === 't3'));
assert.ok(!cells.some((c) => c.classId === 'mage' && c.role !== 'dps'));
assert.equal(nextStep(g1, [run('mage', 't1', 10)], chars).level, 30);
assert.equal(nextStep(g1, [run('mage', 't1', 30, 'dps', { abandoned: true })], chars).classId, 'mage');

// Every class, every step can actually be played.
for (const c of CLASS_ORDER)
  for (const cell of routeCells([c, c === 'mage' ? 'rogue' : 'mage'])) {
    const t = trialById(cell.trialId);
    assert.ok((t.levels || [t.level]).includes(cell.level), `${cell.trialId} L${cell.level}`);
    assert.ok(t.rolesFor(cell.classId).includes(cell.role));
  }

// Skipping moves on and is counted; the route can end.
const skipped = skipCell(g1, s1);
assert.equal(nextStep(skipped, [], chars).classId, 'warrior');
assert.equal(routeProgress(skipped, []).skipped, 1);
assert.equal(nextStep({ ...g1, skipped: routeCells(g1.classes).map((c) => cellKey(c.classId, c.trialId, c.level, c.role)) }, [], chars), null);

// The comparison question: same trial, level and role only, once per pair.
const m = run('mage', 't1', 30);
const w = run('warrior', 't1', 30);
assert.deepEqual(pendingComparison(w, [m, w], []), { situation: 't1:30:dps', a: 'mage', b: 'warrior' });
assert.equal(pendingComparison(w, [m, w], [{ situation: 't1:30:dps', a: 'mage', b: 'warrior', answer: 'a' }]), null);
assert.equal(pendingComparison(w, [run('mage', 't1', 10), w], []), null);
assert.equal(pendingComparison(run('warrior', 't3', 30, 'tank'), [run('mage', 't3', 30)], []), null);
assert.equal(pendingComparison({ ...w, abandoned: true }, [m, w], []), null);

// Old saves: feedback stays untouched, gets the new stores, and is not mixed with the new question.
const oldFb = {
  sessionId: 'o1',
  trialId: 't1',
  classId: 'mage',
  level: 30,
  enjoyment: 5,
  frustration: 4,
  again: 2,
  moment: 'none',
  custom: null,
  skipped: false,
};
const oldE = { version: 1, sessions: [], feedback: [oldFb], ui: [] };
const mig = migrateEvidence(oldE);
assert.deepEqual(mig.feedback, [oldFb]);
assert.deepEqual([mig.comparisons, mig.confirmations], [[], {}]);
assert.deepEqual(emptyEvidence().comparisons, []);
assert.deepEqual(importJSON(JSON.stringify({ app: 'azeroth-class-trials', progress: {}, evidence: oldE })).evidence.feedback, [oldFb]);
const trials = TRIALS.filter((t) => !t.leaderboard);
const oS = [run('mage', 't1', 30, 'dps', { id: 'o1' }), run('hunter', 't1', 30, 'dps', { id: 'o2' })];
const oldB = { ...oldFb, sessionId: 'o2', classId: 'hunter', enjoyment: 2 };
const both = analyze({ sessions: oS, feedback: [oldFb, oldB], trials });
assert.equal(both.lean.cls, 'mage', 'old answers can be compared with each other');
assert.ok(both.evidence.self.mage[0].includes('How did that fight feel?'), 'and are quoted as asked');
const newB = { sessionId: 'o2', trialId: 't1', classId: 'hunter', level: 30, fun: 1, skipped: false, v: 2 };
const across = analyze({ sessions: oS, feedback: [oldFb, newB], trials });
assert.equal(across.status, 'uncompared', 'old and new questions are not compared');
assert.ok(across.pairs[0].notes.some((x) => x.includes('different versions')));

// Practice is not evidence, and the analysis ignores such a session if one ever got in.
assert.equal(countsAsEvidence(PRACTICE), false);
assert.equal(countsAsEvidence(trialById('t1')), true);
assert.ok(!TRIALS.includes(PRACTICE));
assert.equal(analyze({ sessions: [run('mage', 't0', 30)], trials }).status, 'empty');

// Hints: limited, once each, and they explain a repeated failure. Tips off means none.
const h = createHints();
const ctx = { playerId: 'p', t: 1, enabled: true, hasTarget: true, anyAction: true, inCombat: false, casting: false, hpPct: 1 };
const err = (reason) => ({ type: 'error', src: 'p', reason });
updateHints(h, [err('range')], ctx);
assert.equal(h.current, null, 'a single failure is explained by the error line');
assert.ok(updateHints(h, [err('range')], ctx).text.includes('too far'));
let t = 10;
for (const r of ['nores', 'moving', 'los', 'behind', 'stance']) {
  t += 10;
  updateHints(h, [err(r), err(r)], { ...ctx, t });
}
assert.ok(h.shown.size <= MAX_HINTS);
assert.equal(updateHints(createHints(), [err('range'), err('range')], { ...ctx, enabled: false }), null);
assert.equal(currentGoal([{ text: 'a', done: true }, { text: 'b' }, { text: 'c' }]).text, 'b');

// Every class has a description and roles, and can finish the practice yard.
for (const c of CLASS_ORDER) {
  const intro = CLASS_INTRO[c];
  assert.ok(intro.summary && intro.feel && intro.roles.length && intro.practice);
  const kit = KITS[c];
  const spec = ((kit.specsFor ? kit.specsFor(30, 'dps') : kit.specs[30]) || [])[0]?.id;
  const s = createBattle(PRACTICE, { classId: c, level: 30, spec, role: 'dps', race: undefined, trialId: 't0', kit, seed: 3 });
  const p = player(s);
  const dummy = s.script.dummy;
  setTarget(s, dummy.id);
  // In range for this class, and far enough from the start to tick off moving.
  p.x = dummy.x - (c === 'hunter' ? 14 : 2);
  p.y = 19;
  if (c !== 'hunter') p.y = dummy.y;
  for (let i = 0; i < 2400 && !s.outcome; i++) {
    if (i % 10 === 0 && !p.casting) {
      const bar = s.build.bar;
      const id = bar[(i / 10) % bar.length];
      playerCast(s, id, { point: { x: p.x + 2, y: p.y } });
    }
    if (p.res.rage && p.res.rage.cur < 30) p.res.rage.cur = 30;
    step(s, 0.05);
    drainEvents(s);
  }
  assert.equal(s.outcome && s.outcome.result, 'victory', `${c} finishes the practice: ${JSON.stringify(s.script.done)}`);
}
console.log('guide route ok');
