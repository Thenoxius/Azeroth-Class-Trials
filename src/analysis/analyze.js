// What the trials say about your class preference. Nothing here is a score.
// Only what you said directly (fun, and which class you would rather play next) can make a
// class your preference. Behaviour, Forever facts and predictions are shown beside it, in
// their own lists, and never move it. Performance is reported on its own.
import { CLASSES, CLASS_NAMES, DIM_IDS, DIM_NAMES, KIND_LABEL, DEFAULT_TRIALS, STATUS_NAMES } from './model.js';
import { funLabel, effortLabel, obstacleLabel, ROLE_LABEL } from './questions.js';
import { CLASS_FACTS } from '../content/facts.js';

const TACTICAL = ['control', 'defensive', 'utility', 'movement', 'interrupt', 'dispel'];
const usable = (s) => s && !s.abandoned && (s.combatSeconds || 0) > 5;
const roleOf = (x) => x.role || 'dps';
const situationOf = (s) => `${s.trialId}:${s.level}:${roleOf(s)}`;
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pct = (v) => `${Math.round(v * 100)} %`;

// An answer as a comparable rating. Older answers came from another question ("How did that
// fight feel?"), so they keep their own version and are only compared with each other.
function ratingOf(f) {
  if (f.skipped) return null;
  if (typeof f.fun === 'number') return { version: 2, value: f.fun, text: funLabel(f.fun) };
  if (typeof f.enjoyment === 'number') return { version: 1, value: f.enjoyment, text: `${f.enjoyment}/5, older question: How did that fight feel?` };
  return null;
}

const describeSituation = (trialList, key) => {
  const [trialId, level, role] = key.split(':');
  const t = trialList.find((x) => x.id === trialId);
  return `${t ? t.title : trialId} (level ${level}, ${ROLE_LABEL[role] || role})`;
};

// One row per class × situation. Repeats of the same trial are one opinion: per spec only your
// latest answer counts, so three runs of a trial are not three confirmations.
function situationTable(sessions, feedback, trialList) {
  const byId = Object.fromEntries(sessions.map((s) => [s.id, s]));
  const rows = {};
  const rowFor = (key, cls) => {
    rows[key] = rows[key] || {};
    rows[key][cls] = rows[key][cls] || { runs: 0, finished: 0, specs: {}, disturbed: [], answers: 0 };
    return rows[key][cls];
  };
  for (const s of sessions) {
    const r = rowFor(situationOf(s), s.classId);
    r.runs++;
    if (!s.abandoned) r.finished++;
    if (s.spec) r.specs[s.spec] = r.specs[s.spec] || null;
    if (s.ui && s.ui.pauses > 0 && !r.disturbed.includes('paused')) r.disturbed.push('paused');
  }
  for (const f of feedback) {
    const s = byId[f.sessionId];
    const key = s ? situationOf(s) : `${f.trialId}:${f.level}:${roleOf(f)}`;
    const cls = f.classId;
    const r = rowFor(key, cls);
    if (f.obstacle === 'technical' && !r.disturbed.includes('technical')) r.disturbed.push('technical');
    if (f.obstacle) r.obstacle = f.obstacle;
    if (typeof f.effort === 'number') r.effort = f.effort;
    const rating = ratingOf(f);
    if (!rating) continue;
    r.answers++;
    // A technical problem says nothing about the class, so that answer is set aside.
    if (f.obstacle === 'technical') continue;
    const spec = (s && s.spec) || f.spec || '-';
    r.specs[spec] = rating;
  }
  for (const row of Object.values(rows))
    for (const r of Object.values(row)) {
      const ratings = Object.values(r.specs).filter(Boolean);
      const version = ratings.some((x) => x.version === 2) ? 2 : 1;
      const same = ratings.filter((x) => x.version === version);
      r.rating = same.length ? { version, value: mean(same.map((x) => x.value)), text: same[same.length - 1].text } : null;
      r.specList = Object.keys(r.specs).filter((x) => x !== '-');
    }
  return rows;
}

// Per pair of classes: one vote per situation you compared them in. Saying directly which you
// would rather play decides; otherwise your fun answers do, if they differ by a whole category.
function comparePairs(rows, comparisons, played, trialList) {
  const pairs = [];
  for (let i = 0; i < played.length; i++) {
    for (let j = i + 1; j < played.length; j++) {
      const [a, b] = [played[i], played[j]];
      const pair = { a, b, wins: { [a]: 0, [b]: 0 }, ties: 0, situations: [], reasons: [], notes: [] };
      for (const key of Object.keys(rows)) {
        const ra = rows[key][a];
        const rb = rows[key][b];
        const asked = comparisons.filter((c) => c.situation === key && [c.a, c.b].includes(a) && [c.a, c.b].includes(b)).pop();
        const where = describeSituation(trialList, key);
        if (asked && asked.answer !== 'insufficient') {
          pair.situations.push(key);
          const chosen = asked.answer === 'a' ? asked.a : asked.answer === 'b' ? asked.b : null;
          if (chosen) {
            pair.wins[chosen]++;
            pair.reasons.push({
              cls: chosen,
              text: `After ${where} you said you would rather play ${CLASS_NAMES[chosen]} than ${CLASS_NAMES[chosen === a ? b : a]} next.`,
            });
          } else {
            pair.ties++;
            pair.notes.push(`After ${where} you chose ${asked.answer === 'both' ? 'both equally' : 'neither'} of ${CLASS_NAMES[a]} and ${CLASS_NAMES[b]}.`);
          }
          continue;
        }
        if (!ra || !rb || !ra.rating || !rb.rating) continue;
        if (ra.rating.version !== rb.rating.version) {
          pair.notes.push(`${where}: your answers come from different versions of the question, so they are not compared.`);
          continue;
        }
        pair.situations.push(key);
        const d = ra.rating.value - rb.rating.value;
        if (Math.abs(d) >= 1) {
          const [hi, lo] = d > 0 ? [a, b] : [b, a];
          pair.wins[hi]++;
          pair.reasons.push({
            cls: hi,
            text: `In ${where} you answered “${rows[key][hi].rating.text}” for ${CLASS_NAMES[hi]} and “${rows[key][lo].rating.text}” for ${CLASS_NAMES[lo]}.`,
          });
        } else pair.ties++;
      }
      pairs.push(pair);
    }
  }
  return pairs;
}

function verdict(pairs, played, confirmations) {
  const compared = pairs.filter((p) => p.situations.length);
  const base = { lean: null, tied: [], conflicts: [], rejected: null };
  if (!played.length) return { ...base, status: 'empty' };
  if (played.length === 1) return { ...base, status: 'single' };
  if (!compared.length) return { ...base, status: 'uncompared' };
  const conflicts = compared.filter((p) => p.wins[p.a] > 0 && p.wins[p.b] > 0 && p.wins[p.a] === p.wins[p.b]);
  const wins = {};
  const losses = {};
  for (const p of compared) {
    if (p.wins[p.a] === p.wins[p.b]) continue;
    const [w, l] = p.wins[p.a] > p.wins[p.b] ? [p.a, p.b] : [p.b, p.a];
    (wins[w] = wins[w] || []).push(p);
    (losses[l] = losses[l] || []).push(p);
  }
  const candidates = Object.keys(wins).filter((c) => !losses[c]);
  if (candidates.length === 1) {
    const cls = candidates[0];
    const own = compared.filter((p) => p.a === cls || p.b === cls);
    const reasons = own.flatMap((p) => p.reasons.filter((r) => r.cls === cls));
    const opposing = own.flatMap((p) => p.reasons.filter((r) => r.cls !== cls));
    const tied = own.filter((p) => p.wins[p.a] === p.wins[p.b]).map((p) => (p.a === cls ? p.b : p.a));
    const lean = { cls, strength: reasons.length >= 2 && !opposing.length && !tied.length ? 'clearer' : 'slight', reasons, opposing, tiedWith: tied };
    if (confirmations[`lean:${cls}`] === 'no') return { ...base, status: 'corrected', rejected: lean };
    return { ...base, status: 'lean', lean, conflicts };
  }
  if (candidates.length > 1) return { ...base, status: 'tie', tied: candidates };
  if (conflicts.length || Object.keys(wins).length) return { ...base, status: 'conflict', conflicts };
  return { ...base, status: 'tie', tied: [...new Set(compared.flatMap((p) => [p.a, p.b]))] };
}

// ---------------------------------------------------------------- the other kinds, side by side

// Descriptions of what you did, with no direction and no effect on the verdict. Only the latest
// run per situation, compared with nothing.
function behaviour(sessions, trialList) {
  const out = Object.fromEntries(CLASSES.map((c) => [c, []]));
  const latest = {};
  for (const s of sessions.filter(usable)) latest[`${s.classId}|${situationOf(s)}`] = s;
  for (const s of Object.values(latest)) {
    const where = describeSituation(trialList, situationOf(s));
    const lines = out[s.classId];
    if (!lines) continue;
    const used = Object.keys(s.abilities || {}).filter((id) => !id.startsWith('item.') && !id.startsWith('race.')).length;
    if (s.barSize) lines.push(`${where}: you pressed ${used} of ${s.barSize} abilities.`);
    const minutes = Math.max(0.25, (s.combatSeconds || 0) / 60);
    const tactical = TACTICAL.reduce((a, c) => a + ((s.categories || {})[c] || 0), 0) / minutes;
    if (tactical > 0) lines.push(`${where}: ${tactical.toFixed(1)} control, defensive or utility uses per minute.`);
    if (s.resource && s.simSeconds && s.resource.restSeconds / s.simSeconds > 0.03)
      lines.push(`${where}: ${pct(s.resource.restSeconds / s.simSeconds)} of the time went to eating and drinking.`);
    for (const d of s.danger || [])
      lines.push(`${where}, “${d.label}”: ${d.firstAbility ? `your first response was ${d.firstCategory || 'an attack'}` : 'no response within 12 s'}.`);
    if (s.pet && s.pet.present) lines.push(`${where}: your pet was out${s.pet.manualAbilities ? ', and you used its abilities yourself' : ''}.`);
  }
  return out;
}

// Behaviour can raise a question, not answer it. Each of these waits for your own word.
function followUps(sessions, trialList, confirmations) {
  const out = [];
  const seen = new Set();
  const add = (id, cls, text) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ id, cls, text, answer: confirmations[id] || null });
  };
  for (const s of sessions) {
    const where = describeSituation(trialList, situationOf(s));
    if (s.afterWin && !s.abandoned)
      add(
        `replay:${s.classId}:${situationOf(s)}`,
        s.classId,
        `You played ${where} again as ${CLASS_NAMES[s.classId]} after winning it. Was that because you enjoyed it?`,
      );
    if (s.abandoned)
      add(`left:${s.classId}:${situationOf(s)}`, s.classId, `You left ${where} early as ${CLASS_NAMES[s.classId]}. Was that because of the class?`);
  }
  return out;
}

function selfLines(feedback, sessions, rows, trialList) {
  const byId = Object.fromEntries(sessions.map((s) => [s.id, s]));
  const out = Object.fromEntries(CLASSES.map((c) => [c, []]));
  for (const f of feedback) {
    if (f.skipped || !out[f.classId]) continue;
    const s = byId[f.sessionId];
    const where = describeSituation(trialList, s ? situationOf(s) : `${f.trialId}:${f.level}:${roleOf(f)}`);
    const parts = [];
    if (typeof f.fun === 'number') parts.push(`fun: ${funLabel(f.fun)}`);
    if (f.fun === 'unknown') parts.push('fun: don’t know yet');
    if (typeof f.effort === 'number') parts.push(`effort: ${effortLabel(f.effort)}`);
    if (f.obstacle) parts.push(`in the way: ${obstacleLabel(f.obstacle)}`);
    // Older answers are quoted as they were asked.
    if (typeof f.enjoyment === 'number') parts.push(`“How did that fight feel?” ${f.enjoyment}/5`);
    if (typeof f.frustration === 'number') parts.push(`“How much did the class get in your way?” ${f.frustration}/5`);
    if (typeof f.again === 'number') parts.push(`“Would you queue this up again?” ${f.again}/5`);
    if (f.moment && f.moment.text) parts.push(`${f.moment.kind ? `${f.moment.kind} moment` : 'moment'}: “${f.moment.text}”`);
    if (f.custom) parts.push(`“${f.custom}”`);
    if (parts.length) out[f.classId].push(`${where}: ${parts.join(' · ')}`);
  }
  return out;
}

function factLines() {
  const out = {};
  for (const cls of CLASSES) {
    const dims = (CLASS_FACTS[cls] && CLASS_FACTS[cls].dims) || {};
    out[cls] = DIM_IDS.flatMap((dim) => (dims[dim] || []).map((f) => ({ dim: DIM_NAMES[dim], text: f.text, status: STATUS_NAMES[f.status] || f.status })));
  }
  return out;
}

function predictionLines(sessions) {
  const out = {};
  for (const cls of CLASSES) {
    const mine = sessions.filter((s) => s.classId === cls && !s.abandoned);
    out[cls] =
      mine.length && !mine.some((s) => s.level >= 60)
        ? ['You have not played this class at level 60. Its full kit may feel different: this is unknown, not a forecast.']
        : [];
  }
  return out;
}

function performance(sessions) {
  const out = {};
  for (const cls of CLASSES) {
    const mine = sessions.filter((s) => s.classId === cls && !s.abandoned);
    out[cls] = { runs: mine.length, wins: mine.filter((s) => s.outcome === 'victory').length, escaped: mine.filter((s) => s.outcome === 'escaped').length };
  }
  return out;
}

function uncertainties(state) {
  const { played, rows, pairs, sessions, experience, trialList, thin } = state;
  const out = [];
  for (const p of pairs.filter((x) => !x.situations.length))
    out.push(`${CLASS_NAMES[p.a]} and ${CLASS_NAMES[p.b]} have not been compared in the same situation with an answer yet.`);
  for (const key of Object.keys(rows))
    for (const cls of Object.keys(rows[key])) {
      const r = rows[key][cls];
      const where = describeSituation(trialList, key);
      if (r.disturbed.includes('technical')) out.push(`${CLASS_NAMES[cls]} in ${where}: you reported a technical problem, so that answer is set aside.`);
      else if (r.disturbed.includes('paused')) out.push(`${CLASS_NAMES[cls]} in ${where}: the fight was paused, so it may not have felt like one go.`);
      if (r.runs > 1 && r.rating) out.push(`${CLASS_NAMES[cls]} in ${where}: ${r.runs} runs count as one opinion, your latest.`);
    }
  const known = played.filter((c) => ['some', 'lots'].includes((experience || {})[c]));
  const fresh = played.filter((c) => (experience || {})[c] === 'new');
  if (known.length && fresh.length)
    out.push(
      `You already knew ${known.map((c) => CLASS_NAMES[c]).join(', ')} and ${fresh.map((c) => CLASS_NAMES[c]).join(', ')} was new to you. Familiarity can colour this either way.`,
    );
  for (const c of thin) out.push(`${CLASS_NAMES[c]}: only one kind of situation so far.`);
  for (const c of played)
    if (!sessions.some((s) => s.classId === c && s.level >= 60 && !s.abandoned)) out.push(`${CLASS_NAMES[c]} has not been played at level 60.`);
  return out;
}

export function analyze({ sessions = [], feedback = [], comparisons = [], confirmations = {}, experience = {}, trials } = {}) {
  const trialList = trials && trials.length ? trials : DEFAULT_TRIALS;
  const ids = new Set(trialList.map((t) => t.id));
  // Leaderboard runs are never evidence about preference.
  const runs = sessions.filter((s) => ids.has(s.trialId));
  const answers = feedback.filter((f) => ids.has(f.trialId));
  const rows = situationTable(runs, answers, trialList);
  const played = CLASSES.filter((c) => runs.some((s) => s.classId === c && !s.abandoned) || answers.some((f) => f.classId === c && ratingOf(f)));
  const pairs = comparePairs(rows, comparisons, played, trialList);
  const result = verdict(pairs, played, confirmations);
  const thin = played.filter((c) => new Set(runs.filter((s) => s.classId === c && !s.abandoned).map((s) => s.trialId)).size < 2);
  const classes = Object.fromEntries(
    CLASSES.map((c) => {
      const mine = runs.filter((s) => s.classId === c);
      const byCharacter = {};
      for (const s of mine) if (s.charId) byCharacter[s.charId] = (byCharacter[s.charId] || 0) + 1;
      return [
        c,
        {
          name: CLASS_NAMES[c],
          played: played.includes(c),
          runs: mine.length,
          specs: [...new Set(mine.map((s) => s.spec).filter(Boolean))],
          roles: [...new Set(mine.filter((s) => !s.abandoned).map(roleOf))],
          byCharacter,
          unlinkedRuns: mine.filter((s) => !s.charId).length,
        },
      ];
    }),
  );
  const situations = Object.keys(rows).map((key) => ({ key, title: describeSituation(trialList, key), classes: rows[key] }));
  const order = (key) => trialList.findIndex((t) => t.id === key.split(':')[0]);
  situations.sort((a, b) => order(a.key) - order(b.key));
  return {
    ...result,
    played,
    thin,
    classes,
    situations,
    pairs,
    compared: pairs
      .filter((p) => p.situations.length)
      .map((p) => ({ a: p.a, b: p.b, situations: p.situations.map((k) => describeSituation(trialList, k)), notes: p.notes })),
    uncertainties: uncertainties({ played, rows, pairs, sessions: runs, experience, trialList, thin }),
    evidence: {
      self: selfLines(answers, runs, rows, trialList),
      observed: behaviour(runs, trialList),
      fact: factLines(),
      prediction: predictionLines(runs),
    },
    performance: performance(runs),
    followUps: followUps(runs, trialList, confirmations),
    kinds: KIND_LABEL,
  };
}
