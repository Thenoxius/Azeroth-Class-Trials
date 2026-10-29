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
  version: 1,
  runs: {}, // 't1:mage:10' -> { attempts, wins, bestTime, lastResult, lastAt }
  last: { classId: null, spec: {}, role: {} },
  settings: { speed: 1, tips: true, wandMacro: true, reduceMotion: false },
  seenIntro: false,
  leaderboard: [], // finished T6 runs: { id, at, charId, name, race, classId, spec, dps, total }
});

export const emptyEvidence = () => ({
  version: 1,
  sessions: [], // SessionRecord[]
  feedback: [], // FeedbackRecord[]
  ui: [], // light-weight screen visits: { t, screen, data }
});

export const loadProgress = () => read(KEYS.progress, emptyProgress());
export const saveProgress = (p) => write(KEYS.progress, p);
export const loadEvidence = () => read(KEYS.evidence, emptyEvidence());
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
  return { progress: { ...emptyProgress(), ...(v.progress || {}) }, evidence: { ...emptyEvidence(), ...(v.evidence || {}) } };
}

export const runKey = (trialId, classId, level) => `${trialId}:${classId}:${level}`;
