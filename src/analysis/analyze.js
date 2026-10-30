// Evidence-based comparison of the playable classes. Everything here is shown on the
// Method screen: four kinds of evidence (Forever facts, observed behaviour, what you
// said, predictions) per class × dimension, visible weights, no hidden personality score.
// Observed behaviour is compared with your OWN play on the other classes, never with
// an ideal player, and a lost fight is never read as "did not enjoy it".
import {
  CLASSES, CLASS_NAMES, DIM_IDS, DIM_NAMES, KIND_LABEL, DEFAULT_TRIALS, KIND_PRIMARY, SELF_MAP, SELF_FANTASY_MULT,
  SELF_AGAIN_LONGTERM_MULT, SELF_WEIGHTS, FRUSTRATION_VALUE, FRUSTRATION_AFTER_DEFEAT, MOMENT_MAP, FACT_BASE_WEIGHT,
  STATUS_FACTOR, STATUS_NAMES, KIND_CAPS, OBSERVED_VS_SELF, NEUTRAL_PRIOR, normalizeWeights, dimWeights, CLASS_TRAITS,
  ATTACHMENT, SOLO_KINDS, GROUP_KINDS,
} from './model.js';
import { CLASS_FACTS } from '../content/facts.js';

const clamp = (v, a = -1, b = 1) => Math.max(a, Math.min(b, v));
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pct = (v) => `${Math.round(v * 100)} %`;

function ev(list, cls, dim, kind, value, weight, text, rule) {
  if (!weight || !isFinite(value) || !isFinite(weight)) return;
  list.push({ cls, dim, kind, value: clamp(value), weight, text, rule: rule || null });
}

const TACTICAL = ['control', 'defensive', 'utility', 'movement', 'interrupt', 'dispel', 'pet'];
const usable = (s) => s && !s.abandoned && (s.combatSeconds || 0) > 5;
const keyOf = (s) => `${s.trialId}:${s.level}:${s.role === 'healer' ? 'heal' : s.role === 'tank' ? 'tank' : 'dps'}`;

// ---------------------------------------------------------------- observed rules

function observed(sessions, items, trialList) {
  const byKey = {};
  for (const s of sessions) (byKey[keyOf(s)] = byKey[keyOf(s)] || []).push(s);
  const kindOf = (s) => s.kind || (trialList.find((t) => t.id === s.trialId) || {}).kind;
  const dimOf = (s) => KIND_PRIMARY[kindOf(s)] || 'leveling';
  const minutes = (s) => Math.max(0.25, (s.combatSeconds || 0) / 60);
  // Compare a per-session metric with the mean of the other classes on the same trial/level/role.
  function relative(s, metric) {
    const peers = (byKey[keyOf(s)] || []).filter((x) => x.classId !== s.classId && usable(x));
    const others = mean(peers.map(metric).filter((v) => v != null && isFinite(v)));
    return { mine: metric(s), others, n: peers.length };
  }
  const used = sessions.filter(usable);
  for (const s of used) {
    const cls = s.classId;
    const kind = kindOf(s);
    const dim = dimOf(s);
    const label = `${trialName(trialList, s.trialId)} (L${s.level}${s.role === 'healer' ? ', healing' : ''})`;
    // R1 Activity.
    const r1 = relative(s, (x) => (x.gcd ? x.gcd.utilization : null));
    if (r1.mine != null) {
      if (r1.others != null) ev(items, cls, dim, 'observed', (r1.mine - r1.others) / 0.15 * 0.6, 1, `${label}: active ${pct(r1.mine)} of combat vs ${pct(r1.others)} on your other classes`, 'R1');
      else ev(items, cls, dim, 'observed', (r1.mine - 0.6) / 0.15 * 0.4, 0.5, `${label}: active ${pct(r1.mine)} of combat (no other class to compare yet)`, 'R1');
    }
    // R2 Auto-attack reliance (not for Hunter, whose Auto Shot is core).
    if (!CLASS_TRAITS[cls].autoRepeatIsCore && s.damage && s.damage.done > 0 && SOLO_KINDS.includes(kind)) {
      const share = (s.damage.autoRepeat || 0) / s.damage.done;
      if (share > 0.25) ev(items, cls, 'leveling', 'observed', -(share - 0.25) * 2, 0.6, `${label}: ${pct(share)} of your damage came from the wand`, 'R2');
    }
    // R3 Downtime.
    if (SOLO_KINDS.includes(kind)) {
      const r3 = relative(s, (x) => (x.resource ? x.resource.restSeconds / Math.max(1, x.simSeconds) : null));
      if (r3.mine != null && r3.others != null) {
        const d = r3.mine - r3.others;
        if (Math.abs(d) > 0.03) for (const dd of ['leveling', 'shortSessions', 'soloIndependence']) ev(items, cls, dd, 'observed', -d * 4, 0.4, `${label}: ${pct(r3.mine)} of the trial eating & drinking vs ${pct(r3.others)} on your other classes`, 'R3');
      }
    }
    // R4 Breadth.
    const breadth = (x) => Object.keys(x.abilities || {}).filter((id) => !id.startsWith('item.') && !id.startsWith('race.')).length;
    const r4 = relative(s, breadth);
    if (r4.others != null) ev(items, cls, 'combatDepth', 'observed', (r4.mine - r4.others) / 4, 0.6, `${label}: you pressed ${r4.mine} different abilities vs ${r4.others.toFixed(1)} on your other classes`, 'R4');
    // R5 Tactical buttons.
    const tact = (x) => TACTICAL.reduce((a, c) => a + ((x.categories || {})[c] || 0), 0) / minutes(x);
    const r5 = relative(s, tact);
    if (r5.others != null) {
      const v = (r5.mine - r5.others) / Math.max(1.5, r5.others);
      ev(items, cls, 'combatDepth', 'observed', v, 0.7, `${label}: ${r5.mine.toFixed(1)} control/defensive/utility uses per minute vs ${r5.others.toFixed(1)}`, 'R5');
      if (['pvp', 'dungeon'].includes(dim)) ev(items, cls, dim, 'observed', v * 0.6, 0.4, `${label}: tactical play relative to your other classes`, 'R5');
      if (kind === 'danger') ev(items, cls, 'soloIndependence', 'observed', v * 0.6, 0.4, `${label}: tactical answers under pressure`, 'R5');
    }
    // R6 Reaction to danger.
    for (const d of s.danger || []) {
      const cat = d.firstCategory;
      const v = !d.firstAbility ? -0.3 : TACTICAL.includes(cat) ? 0.5 : 0;
      const what = !d.firstAbility ? 'no answer within 12 s' : `${cat || 'an attack'} (${d.latency != null ? d.latency.toFixed(1) + ' s' : '—'})`;
      ev(items, cls, 'combatDepth', 'observed', v, 0.4, `${label} — “${d.label}”: first response ${what}`, 'R6');
      ev(items, cls, 'soloIndependence', 'observed', v, 0.4, `${label} — “${d.label}”: first response ${what}`, 'R6');
    }
    // R7 Pet handling.
    if (CLASS_TRAITS[cls].pet && s.pet && s.pet.present) {
      const c = s.pet.commands || {};
      const per = ((c.attack || 0) + (c.follow || 0) + (c.stay || 0) + (c.passive || 0) + (c.defensive || 0) + (c.aggressive || 0) + (s.pet.manualAbilities || 0)) / minutes(s);
      const v = clamp((per - 1) / 2, -0.5, 0.8);
      ev(items, cls, 'combatDepth', 'observed', v, 0.5, `${label}: ${per.toFixed(1)} pet commands per minute`, 'R7');
      ev(items, cls, 'fantasy', 'observed', v, 0.4, `${label}: pet involvement`, 'R7');
      if (GROUP_KINDS.includes(kind)) ev(items, cls, dim, 'observed', v * 0.5, 0.3, `${label}: pet handled in a group`, 'R7');
    }
    // R10 Raid attention / R11 Autopilot.
    if (kind === 'raid') {
      const b = (s.gcd && s.gcd.buckets) || [];
      if (b.length >= 6) {
        const third = Math.floor(b.length / 3);
        const first = mean(b.slice(0, third).map((x) => x.util));
        const last = mean(b.slice(-third).map((x) => x.util));
        const drop = first - last;
        ev(items, cls, 'raid', 'observed', -drop * 3, 0.7, `Raid: activity ${pct(first)} in the first third vs ${pct(last)} in the last`, 'R10');
        ev(items, cls, 'longTerm', 'observed', -drop * 3, 0.5, `Raid: attention over the fight`, 'R10');
      }
      const ap = (s.ui && s.ui.autopilotSeconds ? s.ui.autopilotSeconds : 0) / Math.max(1, s.combatSeconds || 0);
      if (ap > 0.05) for (const dd of ['raid', 'longTerm', 'combatDepth']) ev(items, cls, dd, 'observed', -ap * 1.5, 0.6, `Raid: autopilot cast your filler for ${pct(ap)} of the fight`, 'R11');
    }
    // R14 Session length / R15 Interruptions / R16 Getting going.
    const r14 = relative(s, (x) => (x.realMs || 0) / 1000);
    if (r14.others != null && r14.others > 0) ev(items, cls, 'shortSessions', 'observed', -(r14.mine - r14.others) / r14.others, 0.4, `${label}: ${Math.round(r14.mine / 60 * 10) / 10} real minutes vs ${Math.round(r14.others / 60 * 10) / 10} on your other classes`, 'R14');
    if (s.ui && s.ui.pauses > 0) ev(items, cls, 'shortSessions', 'observed', 0.15, 0.2, `${label}: paused and picked up again`, 'R15');
    const r16 = relative(s, (x) => (x.firstActionAt != null ? x.firstActionAt : null));
    if (r16.mine != null && r16.others != null) ev(items, cls, 'shortSessions', 'observed', -(r16.mine - r16.others) / 6, 0.2, `${label}: first action after ${r16.mine.toFixed(1)} s vs ${r16.others.toFixed(1)} s`, 'R16');
    // R20 Responsibilities.
    const mech = (s.mechanics || []).filter((m) => m.kind !== 'move');
    if (mech.length) {
      const mineN = mech.filter((m) => m.by === 'you').length;
      const share = mineN / mech.length;
      const v = (share - 0.3) * 1.5;
      ev(items, cls, dim, 'observed', v, 0.5, `${label}: you handled ${mineN} of ${mech.length} duty windows (interrupts, dispels, peels…)`, 'R20');
      ev(items, cls, 'combatDepth', 'observed', v * 0.7, 0.3, `${label}: duties taken on`, 'R20');
    }
    // R21 Utility while questing.
    if (kind === 'questing') {
      const r21 = relative(s, (x) => (((x.tags || {})['optional-utility'] || 0) / minutes(x)));
      if (r21.others != null) ev(items, cls, 'worldUtility', 'observed', (r21.mine - r21.others) / Math.max(0.5, r21.others), 0.4, `${label}: ${r21.mine.toFixed(1)} optional-utility uses per minute vs ${r21.others.toFixed(1)}`, 'R21');
    }
  }
  // R8 Voluntary replays and R9 leaving early (over all sessions).
  for (const s of sessions) {
    const dim = dimOf(s);
    const label = `${trialName(trialList, s.trialId)} (L${s.level})`;
    if (s.afterWin && !s.abandoned) {
      ev(items, s.classId, dim, 'observed', 0.8, 1, `${label}: you played it again after already winning it`, 'R8');
      ev(items, s.classId, 'longTerm', 'observed', 0.6, 0.6, `${label}: voluntary replay`, 'R8');
    } else if (s.attempt > 1 && !s.abandoned) ev(items, s.classId, dim, 'observed', 0.2, 0.3, `${label}: you came back for another attempt`, 'R8');
    if (s.abandoned) ev(items, s.classId, dim, 'observed', s.ui && s.ui.pauses ? -0.15 : -0.4, 0.5, `${label}: left early${s.ui && s.ui.pauses ? ' (after a pause — maybe an interruption)' : ''}`, 'R9');
  }
  // R12 Solo results (capability only) and R13 emergency potions.
  for (const cls of CLASSES) {
    const solo = sessions.filter((s) => s.classId === cls && SOLO_KINDS.includes(kindOf(s)) && !s.abandoned);
    if (solo.length) {
      const wins = solo.filter((s) => s.outcome === 'victory' || s.outcome === 'escaped').length;
      const rate = (wins + 1) / (solo.length + 2);
      ev(items, cls, 'soloIndependence', 'observed', (rate - 0.5) * 1.2, 0.5, `Solo trials: survived ${wins} of ${solo.length} (capability, not enjoyment)`, 'R12');
      const pots = mean(solo.map((s) => (s.resource && s.resource.potions ? s.resource.potions.heal : 0)));
      const otherPots = mean(sessions.filter((s) => s.classId !== cls && SOLO_KINDS.includes(kindOf(s)) && !s.abandoned).map((s) => (s.resource && s.resource.potions ? s.resource.potions.heal : 0)));
      if (otherPots != null) ev(items, cls, 'soloIndependence', 'observed', -(pots - otherPots) / 1.5, 0.3, `Solo trials: ${pots.toFixed(1)} healing potions per run vs ${otherPots.toFixed(1)}`, 'R13');
    }
  }
  // R17 Level trend.
  for (const cls of CLASSES) {
    const lv = {};
    for (const L of [10, 30, 60]) {
      const mineU = used.filter((s) => s.classId === cls && s.level === L && s.role !== 'healer').map((s) => s.gcd.utilization);
      const othersU = used.filter((s) => s.classId !== cls && s.level === L && s.role !== 'healer').map((s) => s.gcd.utilization);
      if (mineU.length && othersU.length) lv[L] = mean(mineU) - mean(othersU);
    }
    const ls = Object.keys(lv).map(Number).sort((a, b) => a - b);
    if (ls.length >= 2) {
      const d = lv[ls[ls.length - 1]] - lv[ls[0]];
      ev(items, cls, 'longTerm', 'observed', d * 4, 0.6, `Your relative activity went from ${signed(lv[ls[0]])} at level ${ls[0]} to ${signed(lv[ls[ls.length - 1]])} at level ${ls[ls.length - 1]}`, 'R17');
      ev(items, cls, 'leveling', 'observed', d * 2, 0.3, `Engagement trend across levels`, 'R17');
    }
  }
  // R18 Extra time and R19 both roles.
  const replayMin = {};
  for (const s of sessions.filter((x) => x.afterWin && !x.abandoned)) replayMin[s.classId] = (replayMin[s.classId] || 0) + (s.realMs || 0) / 60000;
  const totalReplay = Object.values(replayMin).reduce((a, b) => a + b, 0);
  if (totalReplay > 2) for (const cls of CLASSES) ev(items, cls, 'longTerm', 'observed', ((replayMin[cls] || 0) / totalReplay - 1 / 3) * 2, 0.6, `${Math.round((replayMin[cls] || 0))} of your ${Math.round(totalReplay)} voluntary replay minutes went to ${CLASS_NAMES[cls]}`, 'R18');
  const pr = sessions.filter((s) => s.classId === 'priest' && GROUP_KINDS.includes(kindOf(s)) && !s.abandoned);
  if (pr.some((s) => s.role === 'healer') && pr.some((s) => s.role !== 'healer')) ev(items, 'priest', 'roleFlexibility', 'observed', 0.6, 0.6, 'You played group trials both as healer and as damage', 'R19');
}

const signed = (v) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)} pts`;
function trialName(trialList, id) {
  const t = trialList.find((x) => x.id === id);
  return t ? t.title : id;
}

// ---------------------------------------------------------------- self reports

function selfReports(feedback, sessions, items, trialList) {
  const byId = Object.fromEntries(sessions.map((s) => [s.id, s]));
  for (const f of feedback) {
    if (f.skipped) continue;
    const s = byId[f.sessionId] || {};
    const kind = s.kind || (trialList.find((t) => t.id === f.trialId) || {}).kind || 'questing';
    const map = SELF_MAP[kind] || { leveling: 1 };
    const cls = f.classId;
    const label = `${trialName(trialList, f.trialId)} (L${f.level || s.level || '?'})`;
    if (f.enjoyment != null) {
      const v = (f.enjoyment - 3) / 2;
      for (const [dim, m] of Object.entries(map)) ev(items, cls, dim, 'self', v, SELF_WEIGHTS.enjoyment * m, `${label}: “how did it feel” ${f.enjoyment}/5`);
      ev(items, cls, 'fantasy', 'self', v, SELF_WEIGHTS.enjoyment * SELF_FANTASY_MULT, `${label}: enjoyment ${f.enjoyment}/5`);
    }
    if (f.frustration != null) {
      const after = s.outcome === 'defeat' ? FRUSTRATION_AFTER_DEFEAT : 1;
      const v = FRUSTRATION_VALUE[f.frustration] ?? 0;
      for (const [dim, m] of Object.entries(map)) ev(items, cls, dim, 'self', v, SELF_WEIGHTS.frustration * m * after, `${label}: the class got in your way ${f.frustration}/5${after < 1 ? ' (after a loss — weighted down)' : ''}`);
    }
    if (f.again != null) {
      const v = (f.again - 3) / 2;
      for (const [dim, m] of Object.entries(map)) ev(items, cls, dim, 'self', v, SELF_WEIGHTS.again * m, `${label}: play it again ${f.again}/5`);
      ev(items, cls, 'longTerm', 'self', v, SELF_WEIGHTS.again * SELF_AGAIN_LONGTERM_MULT, `${label}: play it again ${f.again}/5`);
    }
    if (f.moment && f.moment !== 'none' && f.moment.system) {
      for (const [dim, m] of Object.entries(MOMENT_MAP[f.moment.system] || {})) ev(items, cls, dim, 'self', 0.6, SELF_WEIGHTS.moment * m, `${label}: highlight — “${f.moment.text}”`);
    } else if (f.moment === 'none') {
      ev(items, cls, KIND_PRIMARY[kind] || 'leveling', 'self', -0.3, SELF_WEIGHTS.none, `${label}: no moment stood out`);
    }
  }
}

// ---------------------------------------------------------------- facts & predictions

function factEvidence(items) {
  for (const cls of CLASSES) {
    const dims = (CLASS_FACTS[cls] && CLASS_FACTS[cls].dims) || {};
    for (const [dim, list] of Object.entries(dims)) {
      for (const f of list) {
        const w = FACT_BASE_WEIGHT * (STATUS_FACTOR[f.status] ?? 0.3) * (f.sign === 0 ? 0.3 : 1);
        ev(items, cls, dim, 'fact', 0.6 * (f.sign || 0), w, `${f.text} (${STATUS_NAMES[f.status] || f.status})`);
      }
    }
  }
}

function predictions(sessions, items) {
  for (const cls of CLASSES) {
    const mine = sessions.filter((s) => s.classId === cls && !s.abandoned);
    const has60 = mine.some((s) => s.level >= 60);
    const low = mine.filter((s) => s.level <= 30 && s.gcd);
    if (!has60 && low.length) {
      const others = sessions.filter((s) => s.classId !== cls && !s.abandoned && s.level <= 30 && s.gcd);
      if (others.length) {
        const d = mean(low.map((s) => s.gcd.utilization)) - mean(others.map((s) => s.gcd.utilization));
        for (const dim of ['raid', 'pvp', 'longTerm']) ev(items, cls, dim, 'prediction', d * 3, 0.3, `No level-60 runs yet: extrapolated from your level 10–30 activity (${signed(d)} vs your other classes)`);
      }
    }
  }
  // Research-based forecasts that only apply when your early play points that way.
  const shadowLow = sessions.filter((s) => s.classId === 'priest' && s.level <= 30 && s.role !== 'healer' && s.damage && s.damage.done > 0 && (s.damage.autoRepeat || 0) / s.damage.done > 0.3);
  if (shadowLow.length) ev(items, 'priest', 'longTerm', 'prediction', 0.35, 0.35, 'Your early Priest leaned on the wand; research says Shadow’s identity arrives late (Mind Flay ~24, Vampiric Embrace 25, Shadowform 40) — later levels should feel better');
  const hunterSimple = sessions.filter((s) => s.classId === 'hunter' && s.kind === 'raid' && s.ui && s.ui.autopilotSeconds / Math.max(1, s.combatSeconds) > 0.2);
  if (hunterSimple.length) ev(items, 'hunter', 'longTerm', 'prediction', -0.3, 0.3, 'You handed much of the Hunter raid loop to the autopilot; guides already call Beast Mastery’s 60 loop simple');
}

// ---------------------------------------------------------------- scoring

function scoreCell(list) {
  // Cap each kind's total weight, then keep behaviour from outweighing what you said.
  const byKind = {};
  for (const it of list) (byKind[it.kind] = byKind[it.kind] || []).push(it);
  const scale = {};
  for (const [k, xs] of Object.entries(byKind)) {
    const sum = xs.reduce((a, x) => a + x.weight, 0);
    scale[k] = sum > KIND_CAPS[k] ? KIND_CAPS[k] / sum : 1;
  }
  const selfW = (byKind.self || []).reduce((a, x) => a + x.weight * scale.self, 0);
  const obsW = (byKind.observed || []).reduce((a, x) => a + x.weight * scale.observed, 0);
  if (selfW > 0 && obsW > selfW * OBSERVED_VS_SELF) scale.observed *= (selfW * OBSERVED_VS_SELF) / obsW;
  let num = 0;
  let den = NEUTRAL_PRIOR;
  const kinds = {};
  for (const it of list) {
    const w = it.weight * scale[it.kind];
    it.effWeight = +w.toFixed(3);
    num += w * it.value;
    den += w;
    kinds[it.kind] = (kinds[it.kind] || 0) + w;
  }
  const real = den - NEUTRAL_PRIOR;
  const score = list.length ? Math.round(50 + 50 * (num / den)) : null;
  const confidence = real >= 2.5 && (kinds.observed || 0) + (kinds.self || 0) >= 1.2 ? 'high' : real >= 1 ? 'medium' : real > 0 ? 'low' : 'none';
  const lean = (k) => {
    const xs = list.filter((x) => x.kind === k);
    const w = xs.reduce((a, x) => a + x.effWeight, 0);
    return w ? xs.reduce((a, x) => a + x.effWeight * x.value, 0) / w : null;
  };
  return { score, confidence, weight: +real.toFixed(2), kinds, lean: { fact: lean('fact'), observed: lean('observed'), self: lean('self'), prediction: lean('prediction') } };
}

export function analyze({ sessions = [], feedback = [], weights, trials } = {}) {
  const trialList = (trials && trials.length ? trials : DEFAULT_TRIALS).map((t) => ({ ...t }));
  const w = normalizeWeights(weights);
  const dw = dimWeights(w);
  const items = [];
  factEvidence(items);
  observed(sessions, items, trialList);
  selfReports(feedback, sessions, items, trialList);
  predictions(sessions, items);
  if (w.attachment > 0) ev(items, ATTACHMENT.cls, 'fantasy', 'self', 0.6, ATTACHMENT.itemWeight * w.attachment, `You told us about ${ATTACHMENT.label} (weighted by your “attachment” setting)`);

  const classes = {};
  for (const cls of CLASSES) {
    const dims = {};
    for (const dim of DIM_IDS) {
      const list = items.filter((x) => x.cls === cls && x.dim === dim);
      const sc = scoreCell(list);
      dims[dim] = { ...sc, evidence: list.sort((a, b) => b.effWeight - a.effWeight).map(({ kind, text, value, effWeight, rule }) => ({ kind, text, value: +value.toFixed(2), weight: effWeight, rule })) };
    }
    let num = 0;
    let den = 0;
    for (const dim of DIM_IDS) {
      const c = dims[dim];
      const s = c.score == null ? 50 : c.score;
      num += dw[dim] * s;
      den += dw[dim];
    }
    const sessionsN = sessions.filter((s) => s.classId === cls).length;
    classes[cls] = { name: CLASS_NAMES[cls], dims, total: den ? Math.round((num / den) * 10) / 10 : 50, sessions: sessionsN, feedback: feedback.filter((f) => f.classId === cls && !f.skipped).length };
  }
  const ranking = CLASSES.map((c) => ({ cls: c, name: CLASS_NAMES[c], total: classes[c].total })).sort((a, b) => b.total - a.total);

  // Coverage & gaps.
  const gaps = [];
  const playedCells = new Set(sessions.filter((s) => !s.abandoned).map((s) => `${s.trialId}:${s.classId}`));
  const coverageTotal = trialList.length * CLASSES.length;
  const coverage = playedCells.size / coverageTotal;
  for (const t of trialList) {
    const missing = CLASSES.filter((c) => !playedCells.has(`${t.id}:${c}`));
    if (missing.length) gaps.push({ kind: 'trial', trialId: t.id, classes: missing, text: `${t.title}: not played as ${missing.map((c) => CLASS_NAMES[c]).join(', ')}` });
  }
  const noFb = CLASSES.filter((c) => sessions.some((s) => s.classId === c) && !feedback.some((f) => f.classId === c && !f.skipped));
  if (noFb.length) gaps.push({ kind: 'feedback', classes: noFb, text: `No feedback answers yet for ${noFb.map((c) => CLASS_NAMES[c]).join(', ')} — your own words carry the most weight` });
  if (!sessions.some((s) => s.classId === 'priest' && s.role === 'healer')) gaps.push({ kind: 'role', classes: ['priest'], text: 'Priest healing is untested (the Dungeon and Raid trials offer it)' });
  for (const cls of CLASSES) if (!sessions.some((s) => s.classId === cls && s.level >= 60)) gaps.push({ kind: 'level', classes: [cls], text: `${CLASS_NAMES[cls]} not played at level 60 yet — raid and PvP rows lean on facts and predictions` });

  // Conflicts: observed vs self (or facts vs self) pulling opposite ways on the same row.
  const conflicts = [];
  for (const cls of CLASSES) {
    for (const dim of DIM_IDS) {
      const c = classes[cls].dims[dim];
      const { observed: o, self: s, fact: f } = c.lean;
      if (o != null && s != null && Math.abs(o) > 0.15 && Math.abs(s) > 0.15 && Math.sign(o) !== Math.sign(s)) {
        conflicts.push({ cls, dim, text: `${CLASS_NAMES[cls]} · ${DIM_NAMES[dim]}: your play ${o > 0 ? 'looked engaged' : 'looked less engaged'}, but you ${s > 0 ? 'rated it well' : 'rated it low'}. Your words weigh more.` });
      } else if (f != null && s != null && Math.abs(f) > 0.2 && Math.abs(s) > 0.2 && Math.sign(f) !== Math.sign(s)) {
        conflicts.push({ cls, dim, text: `${CLASS_NAMES[cls]} · ${DIM_NAMES[dim]}: the research ${f > 0 ? 'favours' : 'warns against'} it, but your experience says ${s > 0 ? 'otherwise — you liked it' : 'otherwise — you did not'}.` });
      }
    }
  }

  // Recommendation.
  const [first, second, third] = ranking;
  const margin = first.total - second.total;
  const realEvidence = sessions.filter((s) => !s.abandoned).length;
  const decided = realEvidence >= 6 && coverage >= 0.4;
  const diffDims = DIM_IDS.map((dim) => {
    const a = classes[first.cls].dims[dim];
    const b = classes[second.cls].dims[dim];
    const d = ((a.score ?? 50) - (b.score ?? 50)) * dw[dim];
    return { dim, d, a, b };
  }).sort((x, y) => y.d - x.d);
  const why = diffDims.filter((x) => x.d > 0.5).slice(0, 3).map((x) => {
    const top = (x.a.evidence || []).filter((e) => e.value > 0 && e.kind !== 'fact').slice(0, 1)[0] || (x.a.evidence || [])[0];
    return { dim: x.dim, text: `${DIM_NAMES[x.dim]}: ${x.a.score ?? 50} vs ${x.b.score ?? 50}${top ? ` — ${top.text}` : ''}`, kind: top ? top.kind : null };
  });
  const altStrong = diffDims.filter((x) => x.d < -0.5).reverse().slice(0, 2).map((x) => ({ dim: x.dim, text: `${DIM_NAMES[x.dim]}: ${x.b.score ?? 50} vs ${x.a.score ?? 50}` }));
  const whatWouldChange = [];
  if (margin < 4) whatWouldChange.push(`The top two are within ${margin.toFixed(1)} points: one more strong (or weak) answer could swap them.`);
  for (const g of gaps.filter((g) => g.classes && (g.classes.includes(first.cls) || g.classes.includes(second.cls))).slice(0, 3)) whatWouldChange.push(g.text);
  if (w.attachment >= 0.5 && first.cls !== ATTACHMENT.cls) whatWouldChange.push('Your attachment setting is high — if that Priest matters more than gameplay, raise it further and see the ranking move.');
  const recommendation = {
    main: first.cls,
    alt: second.cls,
    margin: +margin.toFixed(1),
    confident: decided && margin >= 3,
    why,
    strongestAlternative: { cls: second.cls, text: altStrong.length ? `${CLASS_NAMES[second.cls]} leads on ${altStrong.map((x) => x.text).join(' and ')}` : `${CLASS_NAMES[second.cls]} is close behind without a clear standout row`, dims: altStrong },
    third: third.cls,
    whatWouldChange,
    status: !realEvidence ? 'empty' : decided ? 'ready' : 'early',
  };
  return { classes, ranking, recommendation, conflicts, gaps, coverage, weights: w, dimWeights: dw, sessions: sessions.length, feedback: feedback.length, kinds: KIND_LABEL };
}
