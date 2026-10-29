// Trial 6 — The Proving Grounds (level 60). One fixed standard for every class and
// spec, so runs can be ranked on one leaderboard: a level-63 raid target dummy with
// raid-boss armor, three minutes from your first hit, solo and without raid buffs.
// Its health follows the clock (100 % → 0 % over the three minutes), so the last
// 20 % of the time is an execute phase. The dummy never fights back.
// Afterwards the trial hands the UI a damage report (see buildReport).
import { registerTemplates, getAbility } from '../../engine/registry.js';
import { spawnPlayer, marker, freshEvents } from '../common.js';

export const DUMMY_SECONDS = 180;
const EXECUTE_AT = 0.8; // health is 20 % at 80 % of the time
const BUCKET = 5; // seconds per point in the DPS-over-time chart
const START = { player: { x: 12, y: 13 }, dummy: { x: 30, y: 13 } };
const WHITE = { melee: 'Auto Attack', autoshot: 'Auto Shot', wand: 'Shoot (wand)' };

registerTemplates({
  't6.dummy': {
    // Level 63 and 4691 armor: the same as the raid boss in T5 (Molten Core boss armor).
    name: 'Raid Target Dummy', portrait: 'generic', side: 'enemy', kind: 'boss', level: 63, radius: 1.4,
    maxHp: 10_000_000, armor: 4691, speed: 0, melee: null, ai: { type: 'idle' },
    immune: { stun: true, incap: true, fear: true, root: true, slow: true, cc: true },
    flags: { noEvade: true, noLeash: true },
  },
});

const mine = (e, p) => e.src === p.id || (p.petId && e.src === p.petId) || e.owner === p.id;
const fmtClock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function track(state) {
  const s = state.script;
  if (!s.rec) s.rec = { abilities: {}, buckets: Array(DUMMY_SECONDS / BUCKET).fill(0), idle: 0, cap: 0, oomAt: null, uptime: {}, executeDmg: 0, total: 0 };
  return s.rec;
}

function abilityRow(rec, state, p, e) {
  const src = state.units[e.src];
  const who = e.src === p.id ? 'you' : e.src === p.petId ? 'pet' : 'guardian';
  const key = `${who}:${e.src === p.id ? '' : src ? src.name : ''}:${e.ability || 'melee'}`;
  if (!rec.abilities[key]) {
    const ab = getAbility(e.ability);
    const base = WHITE[e.ability] || (ab && ab.name) || e.ability || 'Auto Attack';
    rec.abilities[key] = { key, name: base, by: who === 'you' ? null : src ? src.name : who, who, ability: e.ability, school: e.school || (ab && ab.school) || 'physical', dmg: 0, hits: 0, crits: 0, ticks: 0, misses: 0, casts: 0, biggest: 0, biggestCrit: false };
  }
  return rec.abilities[key];
}

// The finished report for the UI: totals, per-ability table, timeline and details.
function buildReport(state) {
  const rec = track(state);
  const rows = Object.values(rec.abilities).filter((r) => r.dmg > 0 || r.casts > 0);
  for (const r of rows) {
    r.pct = rec.total ? r.dmg / rec.total : 0;
    r.avg = r.hits ? r.dmg / r.hits : 0;
  }
  rows.sort((a, b) => b.dmg - a.dmg);
  const direct = rows.reduce((n, r) => n + (r.hits - r.ticks), 0);
  const crits = rows.reduce((n, r) => n + r.crits, 0);
  const top = rows.reduce((b, r) => (r.biggest > (b ? b.biggest : 0) ? r : b), null);
  const petDmg = rows.filter((r) => r.who !== 'you').reduce((n, r) => n + r.dmg, 0);
  const uptimes = Object.entries(rec.uptime)
    .map(([name, u]) => ({ name, kind: u.kind, pct: Math.min(1, u.t / DUMMY_SECONDS) }))
    .filter((u) => u.pct >= 0.05)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 6);
  return {
    seconds: DUMMY_SECONDS,
    total: Math.round(rec.total),
    dps: rec.total / DUMMY_SECONDS,
    rows,
    timeline: rec.buckets.map((d) => d / BUCKET),
    bucket: BUCKET,
    critPct: direct ? crits / direct : 0,
    biggest: top ? { name: top.by ? `${top.by}: ${top.name}` : top.name, amount: Math.round(top.biggest), crit: top.biggestCrit } : null,
    executeShare: rec.total ? rec.executeDmg / rec.total : 0,
    petShare: rec.total ? petDmg / rec.total : 0,
    idle: rec.idle,
    cap: rec.capRes ? { resource: rec.capRes, seconds: rec.cap } : null,
    oomAt: rec.oomAt,
    uptimes,
  };
}

export const TRIAL = {
  id: 't6',
  order: 6,
  title: 'The Proving Grounds',
  place: 'A raid target dummy behind Orgrimmar’s barracks',
  level: 60,
  levels: [60],
  kind: 'dummy',
  leaderboard: true,
  blurb: 'Three minutes against a raid target dummy. One standard for every class: your damage goes on the leaderboard.',
  rolesFor: () => ['dps'],
  intro() {
    return {
      text: 'A level-63 raid target dummy with the armor of a raid boss. You get three minutes — the clock starts at your first hit — solo and without raid buffs. Every class and spec plays exactly the same test, so the results go on one leaderboard.',
      goals: ['Deal as much damage as you can in 3:00', 'The clock starts at your first hit — an opener counts'],
      tips: [
        'The dummy’s health follows the clock: the last 36 seconds it is under 20 % — execute range.',
        'It never fights back, so this is your rotation and your resources, nothing else.',
        'Afterwards you get a damage report: per ability, over time, and where the damage went missing.',
      ],
    };
  },
  arena: {
    w: 42, h: 26, theme: 'ruins', obstacles: [],
    decor: [{ kind: 'banner', x: 39, y: 3, color: '#8a1d1d' }, { kind: 'banner', x: 3, y: 23, color: '#8a1d1d' }],
  },
  hud: { party: false, meters: true, timer: false, threat: false },
  setup(state, api) {
    spawnPlayer(state, api, START.player);
    state.script.dummy = api.spawnUnit(state, 't6.dummy', { ...START.dummy });
    state.script.startAt = null;
    api.banner(state, 'The Proving Grounds', 'Hit the dummy to start the clock.', 3, 'info');
  },
  onTick(state, api, dt) {
    const s = state.script;
    const p = api.player(state);
    const dummy = s.dummy;
    const ev = freshEvents(state);
    if (s.ended || !p) return;
    if (s.startAt == null) {
      const first = ev.find((e) => e.type === 'damage' && e.dst === dummy.id && mine(e, p));
      if (!first) return;
      s.startAt = state.t;
      marker(state, api, 'phase', 'Clock started');
    }
    const rec = track(state);
    const elapsed = state.t - s.startAt;
    const at = Math.min(elapsed, DUMMY_SECONDS - 1e-6);
    for (const e of ev) {
      if (!mine(e, p) || e.dst !== dummy.id && e.type !== 'cast') continue;
      if (e.type === 'damage') {
        const r = abilityRow(rec, state, p, e);
        r.dmg += e.amount;
        r.hits++;
        if (e.tick) r.ticks++;
        if (e.crit && !e.tick) r.crits++;
        if (e.amount > r.biggest) { r.biggest = e.amount; r.biggestCrit = !!e.crit; }
        rec.total += e.amount;
        rec.buckets[Math.floor(at / BUCKET)] += e.amount;
        if (at >= DUMMY_SECONDS * EXECUTE_AT) rec.executeDmg += e.amount;
      } else if (e.type === 'miss') {
        abilityRow(rec, state, p, e).misses++;
      } else if (e.type === 'cast' && e.src === p.id && e.ability) {
        abilityRow(rec, state, p, e).casts++;
      }
    }
    // Per-tick details: idle time, resource capping, running out of mana, uptimes.
    if (p.alive && !p.casting && p.gcd <= 0) rec.idle += dt;
    for (const k of ['energy', 'rage']) {
      const r = p.res[k];
      if (r && r.cur >= r.max - 0.5) { rec.cap += dt; rec.capRes = k; }
    }
    if (p.res.mana && rec.oomAt == null && p.res.mana.cur < p.res.mana.max * 0.05) rec.oomAt = elapsed;
    const seen = new Set();
    for (const a of dummy.auras) {
      if (a.def.hidden || !(a.srcId === p.id || a.srcId === p.petId) || !a.def.name || seen.has(a.def.name)) continue;
      seen.add(a.def.name);
      (rec.uptime[a.def.name] ||= { kind: 'debuff', t: 0 }).t += dt;
    }
    for (const a of p.auras) {
      if (a.def.hidden || a.def.permanent || a.def.debuff || a.srcId !== p.id || !a.def.name || seen.has(a.def.name)) continue;
      seen.add(a.def.name);
      (rec.uptime[a.def.name] ||= { kind: 'buff', t: 0 }).t += dt;
    }
    // Health follows the clock; it never reaches zero.
    dummy.hp = Math.max(dummy.maxHp * 0.005, dummy.maxHp * (1 - elapsed / DUMMY_SECONDS));
    if (!s.executeSaid && elapsed >= DUMMY_SECONDS * EXECUTE_AT) {
      s.executeSaid = true;
      api.banner(state, 'Execute range', 'The dummy is under 20 % health.', 2.2, 'warn');
      marker(state, api, 'phase', 'Execute range');
    }
    if (elapsed >= DUMMY_SECONDS) {
      s.ended = true;
      s.report = buildReport(state);
      p.casting = null;
    }
  },
  objectives(state) {
    const s = state.script;
    const rec = s.rec;
    const elapsed = s.startAt == null ? 0 : Math.min(DUMMY_SECONDS, state.t - s.startAt);
    const total = rec ? rec.total : 0;
    return [
      { text: 'Time', progress: s.startAt == null ? 'starts at your first hit' : s.ended ? 'done' : `${fmtClock(DUMMY_SECONDS - elapsed)} left`, done: !!s.ended },
      { text: 'Damage', progress: Math.round(total).toLocaleString('en-US') },
      { text: 'DPS', progress: elapsed > 0 ? Math.round(total / elapsed).toLocaleString('en-US') : '—' },
    ];
  },
  checkOutcome(state) {
    const s = state.script;
    if (s.ended) return { result: 'victory', reason: `${Math.round(s.report.dps).toLocaleString('en-US')} DPS over ${fmtClock(DUMMY_SECONDS)}.` };
    return null;
  },
  summary(state) {
    const r = state.script.report;
    if (!r) return [];
    return [
      { label: 'Damage', value: r.total.toLocaleString('en-US') },
      { label: 'DPS', value: Math.round(r.dps).toLocaleString('en-US') },
      { label: 'Crit rate', value: `${Math.round(r.critPct * 100)} %` },
    ];
  },
  report(state) {
    return state.script.report || null;
  },
};
