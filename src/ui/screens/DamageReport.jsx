// The Proving Grounds: damage report for one run, and the local leaderboard of
// the best run per class and spec.
import { AbilityIcon } from '../art/AbilityIcon.jsx';
import { Portrait } from '../art/Portrait.jsx';
import { CLASS_COLORS, SCHOOL_HEX, cx } from '../util.js';
import { PLAYABLE, trialSupports } from '../../content/index.js';
import { RACES } from '../../content/races.js';

const num = (n) => Math.round(n).toLocaleString('en-US');
const pct = (f) => `${Math.round(f * 100)} %`;
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const WHITE_GLYPH = { melee: 'sword', autoshot: 'arrow', wand: 'wand' };
// Damage specs at level 60 (kits without a role filter list all their specs).
const dpsSpecs = (k) => (k.specsFor ? k.specsFor(60, 'dps') : k.specs && k.specs[60]) || [];

function Timeline({ report }) {
  const W = 360;
  const H = 90;
  const pts = report.timeline;
  const max = Math.max(1, ...pts) * 1.1;
  const x = (i) => (i / (pts.length - 1)) * W;
  const y = (v) => H - (v / max) * H;
  const line = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const exec = W * 0.8;
  return (
    <svg className="dr-chart" viewBox={`0 0 ${W} ${H + 14}`} role="img" aria-label="Damage per second over the fight">
      <rect x={exec} y="0" width={W - exec} height={H} className="dr-exec" />
      <path d={`${line}L${W} ${H}L0 ${H}Z`} className="dr-area" />
      <path d={line} className="dr-line" />
      <line x1="0" y1={y(report.dps)} x2={W} y2={y(report.dps)} className="dr-avg" />
      {[0, 60, 120, 180].map((s) => <text key={s} x={(s / report.seconds) * W} y={H + 11} textAnchor={s === 0 ? 'start' : s === 180 ? 'end' : 'middle'}>{clock(s)}</text>)}
      <text x={exec + 3} y="10" className="dr-exec-label">execute</text>
    </svg>
  );
}

function details(report) {
  const out = [];
  if (report.biggest) out.push(`Biggest hit: ${report.biggest.name} for ${num(report.biggest.amount)}${report.biggest.crit ? ' (crit)' : ''}.`);
  for (const u of report.uptimes.slice(0, 3)) out.push(`${u.name} was ${u.kind === 'debuff' ? 'on the dummy' : 'up'} ${pct(u.pct)} of the time.`);
  if (report.executeShare > 0) out.push(`${pct(report.executeShare)} of your damage came in the execute phase (the last 36 s).`);
  if (report.petShare > 0) out.push(`Your pet and guardians did ${pct(report.petShare)} of the damage.`);
  if (report.idle >= 1) out.push(`${Math.round(report.idle)} s without a cast or global cooldown running.`);
  if (report.cap && report.cap.seconds >= 1) out.push(`${report.cap.resource === 'rage' ? 'Rage' : 'Energy'} sat at its maximum for ${Math.round(report.cap.seconds)} s.`);
  if (report.oomAt != null) out.push(`Out of mana at ${clock(report.oomAt)}.`);
  return out;
}

export function DamageReport({ report, kit }) {
  const top = report.rows.length ? report.rows[0].dmg : 1;
  return (
    <section className="panel dmg-report" style={{ '--cc': kit.color }}>
      <div className="panel-title">Damage report</div>
      <div className="dr-head">
        <div className="dr-big"><b>{num(report.dps)}</b><span>DPS</span></div>
        <div className="dr-big"><b>{num(report.total)}</b><span>damage in {clock(report.seconds)}</span></div>
        <div className="dr-big"><b>{pct(report.critPct)}</b><span>crit rate</span></div>
      </div>
      <Timeline report={report} />
      <table className="dr-table">
        <thead>
          <tr><th>Ability</th><th className="dr-share" /><th>Damage</th><th>%</th><th>Hits</th><th>Crit</th><th>Average</th><th>Biggest</th></tr>
        </thead>
        <tbody>
          {report.rows.filter((r) => r.dmg > 0).map((r) => (
            <tr key={r.key}>
              <td className="dr-name">
                <AbilityIcon icon={WHITE_GLYPH[r.ability] || 'generic'} ability={r.ability} school={r.school} size={22} />
                <span>{r.name}{r.by && <em> · {r.by}</em>}</span>
              </td>
              <td className="dr-share"><span style={{ width: `${(r.dmg / top) * 100}%`, background: SCHOOL_HEX[r.school] || SCHOOL_HEX.physical }} /></td>
              <td>{num(r.dmg)}</td>
              <td>{pct(r.pct)}</td>
              <td>{r.hits}{r.ticks ? <small> ({r.ticks} ticks)</small> : null}{r.misses ? <small> · {r.misses} missed</small> : null}</td>
              <td>{r.hits - r.ticks > 0 ? pct(r.crits / (r.hits - r.ticks)) : '—'}</td>
              <td>{num(r.avg)}</td>
              <td>{num(r.biggest)}{r.biggestCrit ? '*' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="dr-details">
        {details(report).map((d, i) => <li key={i}>{d}</li>)}
      </ul>
    </section>
  );
}

// Best run per class and spec, highest DPS first, plus the specs nobody tried yet.
export function Leaderboard({ entries, currentId, kits, trial, characters }) {
  const best = new Map();
  for (const e of entries) {
    const k = `${e.classId}:${e.spec}`;
    if (!best.has(k) || e.dps > best.get(k).dps) best.set(k, e);
  }
  const rows = [...best.values()].sort((a, b) => b.dps - a.dps);
  const top = rows.length ? rows[0].dps : 1;
  const current = entries.find((e) => e.id === currentId);
  const specName = (e) => {
    const s = dpsSpecs(kits[e.classId]).find((x) => x.id === e.spec);
    return s ? s.name : e.spec || '';
  };
  const charName = (e) => (characters.find((c) => c.id === e.charId) || {}).name || e.name || `${e.race ? RACES[e.race].name + ' ' : ''}${kits[e.classId].name}`;
  let note = null;
  if (current) {
    const same = entries.filter((e) => e.classId === current.classId && e.spec === current.spec && e.id !== current.id);
    const prev = same.length ? Math.max(...same.map((e) => e.dps)) : null;
    if (prev == null) note = `First ${specName(current)} ${kits[current.classId].name} on the board.`;
    else if (current.dps > prev) note = `New best for ${specName(current)} ${kits[current.classId].name}: +${num(current.dps - prev)} DPS.`;
    else note = `This run: ${num(current.dps)} DPS — the best ${specName(current)} ${kits[current.classId].name} run stays at ${num(prev)}.`;
  }
  const untested = PLAYABLE.filter((c) => trialSupports(trial.id, c) && kits[c]).flatMap((c) =>
    dpsSpecs(kits[c]).filter((s) => !best.has(`${c}:${s.id}`)).map((s) => `${s.name} ${kits[c].name}`),
  );
  return (
    <section className="panel leaderboard">
      <div className="panel-title">Leaderboard · {trial.title}</div>
      {note && <p className="lb-note">{note}</p>}
      {rows.length ? (
        <ol className="lb-list">
          {rows.map((e, i) => (
            <li key={e.id} className={cx('lb-row', current && best.get(`${current.classId}:${current.spec}`) === e && 'lb-mine')} style={{ '--cc': CLASS_COLORS[e.classId] }}>
              <span className="lb-rank">{i + 1}</span>
              <span className="lb-portrait"><Portrait id={`${e.race || kits[e.classId].raceId}-${e.classId}`} size={30} /></span>
              <span className="lb-who"><b>{specName(e)} {kits[e.classId].name}</b><small>{charName(e)}</small></span>
              <span className="lb-bar"><span style={{ width: `${(e.dps / top) * 100}%` }} /></span>
              <span className="lb-dps">{num(e.dps)}<small> DPS</small></span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">No finished runs yet.</p>
      )}
      {untested.length > 0 && <p className="muted small">Not tested yet: {untested.join(', ')}.</p>}
      <p className="muted small">Your own runs in this browser. Same dummy, same three minutes, no raid buffs for every class.</p>
    </section>
  );
}
