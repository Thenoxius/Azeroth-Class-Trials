// Which trials make classes comparable, and what is still missing. The player picks freely in
// the Hall; this only names a useful next trial and when to ask the comparison question.
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

// What to do now, or null when the route is finished.
export function nextStep(classes, sessions, characters) {
  const cell = routeCells(classes).find((c) => !cellDone(c, sessions));
  if (!cell) return null;
  const ch = characters.find((c) => c.classId === cell.classId) || null;
  return { ...cell, charId: ch && ch.id, race: ch && ch.race };
}

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
