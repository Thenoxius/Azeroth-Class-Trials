// Local persistence. Two separate stores, on purpose:
//   act.v1.progress — gameplay state (completions, last choices, settings)
//   act.v1.evidence — preference evidence (session records, feedback answers)
// Every access is wrapped: storage can be missing (private window, preview).

const KEYS = { progress: 'act.v1.progress', evidence: 'act.v1.evidence' };

function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? { ...fallback, ...v } : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const emptyProgress = () => ({
  version: 2,
  runs: {}, // 't1:mage:10:<character id>' -> { attempts, wins, bestTime, lastResult, lastAt }
  legacyRuns: {}, // 't1:mage:10' -> the same, from before progress belonged to a character
  last: { classId: null, spec: {}, role: {} },
  settings: { speed: 1, tips: true, wandMacro: true, reduceMotion: false },
  seenIntro: false,
  experience: {}, // classId -> 'new' | 'some' | 'lots', if the player said
  leaderboard: [], // finished T6 runs: { id, at, charId, name, race, classId, spec, dps, total, seconds }
});

export const emptyEvidence = () => ({
  version: 1,
  sessions: [], // SessionRecord[]
  feedback: [], // FeedbackRecord[]; old records keep their old fields (enjoyment, frustration, again)
  comparisons: [], // { id, at, situation, a, b, answer, sessionId }
  confirmations: {}, // interpretation id -> 'yes' | 'no' | 'unsure'
  ui: [], // light-weight screen visits: { t, screen, data }
});

// Version 1 kept one result per class. Those results stay as they are under legacyRuns:
// nothing says which character played them, so they are never assigned to one.
export function migrateProgress(p) {
  if (!p || (p.version || 1) >= 2) return p;
  const runs = {};
  const legacyRuns = { ...(p.legacyRuns || {}) };
  for (const [k, r] of Object.entries(p.runs || {})) {
    if (k.split(':').length === 3) legacyRuns[k] = r;
    else runs[k] = r;
  }
  return { ...p, version: 2, runs, legacyRuns };
}

// New stores are added beside what is there. Old answers are never rewritten.
export const migrateEvidence = (e) => ({ ...e, comparisons: e.comparisons || [], confirmations: e.confirmations || {} });

export const loadProgress = () => migrateProgress(read(KEYS.progress, emptyProgress()));
export const saveProgress = (p) => write(KEYS.progress, p);
export const loadEvidence = () => migrateEvidence(read(KEYS.evidence, emptyEvidence()));
export const saveEvidence = (e) => write(KEYS.evidence, e);

export function resetAll() {
  try {
    window.localStorage.removeItem(KEYS.progress);
    window.localStorage.removeItem(KEYS.evidence);
  } catch {
    /* storage unavailable */
  }
}

export function exportJSON(progress, evidence) {
  return JSON.stringify({ app: 'azeroth-class-trials', exportedAt: new Date().toISOString(), progress, evidence }, null, 1);
}

export function importJSON(text) {
  const v = JSON.parse(text);
  if (!v || v.app !== 'azeroth-class-trials') throw new Error('This is not an Azeroth Class Trials export.');
  return {
    progress: migrateProgress({ ...emptyProgress(), version: 1, ...(v.progress || {}) }),
    evidence: migrateEvidence({ ...emptyEvidence(), ...(v.evidence || {}) }),
  };
}

// Progress belongs to a character. A run started without one (developer links) is kept apart.
export const runKey = (trialId, classId, level, charId) => `${trialId}:${classId}:${level}:${charId || 'no-character'}`;

// Earlier runs of a class that are not linked to any character.
export function legacyRunCount(progress, classId) {
  return Object.entries(progress.legacyRuns || {})
    .filter(([k]) => k.split(':')[1] === classId)
    .reduce((n, [, r]) => n + (r.attempts || 0), 0);
}
