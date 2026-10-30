// The guided comparison: one sensible next step at a time, in the same situations for every
// chosen class. Plain JS so node tests can import it.
import { trialById } from '../content/index.js';

// Level 30 comes first on purpose: at 10 most classes have a thin baseline kit and no spec.
// Level 60 comes last because it asks the most of someone new to a class.
export const ROUTE = [
  { trialId: 't1', level: 30, why: 'A calm start: fight at your own pace with a level 30 kit, which shows a class better than level 10.' },
  { trialId: 't2', level: 30, why: 'The same level under pressure: what does this class give you when things go wrong?' },
  { trialId: 't3', level: 30, why: 'Your first group fight: playing your part with others around you.' },
  { trialId: 't4', level: 60, why: 'A duel at level 60: the full kit against one thinking opponent.' },
  { trialId: 't5', level: 60, why: 'A long boss fight at level 60: does the rotation hold your attention?' },
];

export const situationKey = (trialId, level, role) => `${trialId}:${level}:${role || 'dps'}`;
export const cellKey = (classId, trialId, level, role) => `${classId}@${situationKey(trialId, level, role)}`;
const played = (s) => !s.abandoned;

// All steps in order. Classes rotate per trial so no class always gets your freshest attention.
// Damage comes first, so classes can be compared; a class's other role follows in the same trial.
export function routeCells(classes) {
  const cells = [];
  ROUTE.forEach((r, i) => {
    const t = trialById(r.trialId);
    const order = classes.map((_, n) => classes[(n + i) % classes.length]);
    const rolesOf = (c) => (t.rolesFor ? t.rolesFor(c) : ['dps']);
    for (const classId of order) cells.push({ classId, trialId: r.trialId, level: r.level, role: 'dps', why: r.why });
    for (const classId of order)
      for (const role of rolesOf(classId).filter((x) => x !== 'dps'))
        cells.push({
          classId,
          trialId: r.trialId,
          level: r.level,
          role,
          why: `The same fight in another role: ${classId} can also ${role === 'tank' ? 'tank' : 'heal'}.`,
        });
  });
  return cells;
}

const cellDone = (cell, sessions) =>
  sessions.some((s) => played(s) && s.classId === cell.classId && s.trialId === cell.trialId && s.level === cell.level && (s.role || 'dps') === cell.role);

// What to do now: { type: 'practice' | 'trial', ... }, or null when the route is finished.
export function nextStep(guide, sessions, characters) {
  if (!guide || !guide.classes || !guide.classes.length) return null;
  const skipped = guide.skipped || [];
  const cell = routeCells(guide.classes).find((c) => !cellDone(c, sessions) && !skipped.includes(cellKey(c.classId, c.trialId, c.level, c.role)));
  if (!cell) return null;
  const ch = characters.find((c) => c.classId === cell.classId) || null;
  const known = (guide.practice || {})[cell.classId] || sessions.some((s) => s.classId === cell.classId);
  if (!known) return { type: 'practice', classId: cell.classId, charId: ch && ch.id, race: ch && ch.race, then: cell };
  return { type: 'trial', ...cell, charId: ch && ch.id, race: ch && ch.race };
}

export function routeProgress(guide, sessions) {
  const cells = guide && guide.classes ? routeCells(guide.classes) : [];
  const skipped = (guide && guide.skipped) || [];
  return {
    total: cells.length,
    done: cells.filter((c) => cellDone(c, sessions)).length,
    skipped: cells.filter((c) => !cellDone(c, sessions) && skipped.includes(cellKey(c.classId, c.trialId, c.level, c.role))).length,
  };
}

export const skipCell = (guide, cell) => ({ ...guide, skipped: [...(guide.skipped || []), cellKey(cell.classId, cell.trialId, cell.level, cell.role)] });

// Only a finished run in the same trial, level and role is comparable. Asks about the most
// recent other class that has not been compared with this one here yet; one question per trial.
export function pendingComparison(session, sessions, comparisons = []) {
  if (!session || session.abandoned) return null;
  const key = situationKey(session.trialId, session.level, session.role);
  const asked = (x) => comparisons.some((c) => c.situation === key && [c.a, c.b].includes(x) && [c.a, c.b].includes(session.classId));
  const others = sessions.filter((s) => played(s) && s.classId !== session.classId && situationKey(s.trialId, s.level, s.role) === key && !asked(s.classId));
  if (!others.length) return null;
  return { situation: key, a: others[others.length - 1].classId, b: session.classId };
}

// Practice never reaches the evidence store.
export const countsAsEvidence = (trial) => !trial.practice;
