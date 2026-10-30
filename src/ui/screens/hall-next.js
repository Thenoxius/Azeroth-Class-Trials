// What the Hall suggests playing next, per character. Plain JS so node tests can import it.
import { runKey } from '../../telemetry/store.js';
import { trialSupports } from '../../content/index.js';

// Rotate the class order per trial so no class always goes first (order effects).
export function suggestedOrder(trialIndex, classOrder) {
  const n = classOrder.length;
  return classOrder.map((_, i) => classOrder[(i + trialIndex) % n]);
}

export function nextSuggestion(trials, characters, progress) {
  for (let ti = 0; ti < trials.length; ti++) {
    const t = trials[ti];
    for (const ch of suggestedOrder(ti, characters)) {
      if (!trialSupports(t.id, ch.classId)) continue;
      const r = progress.runs[runKey(t.id, ch.classId, t.level, ch.id)];
      if (!r || !r.attempts) return { trialId: t.id, classId: ch.classId, level: t.level, race: ch.race, charId: ch.id };
    }
  }
  return null;
}
