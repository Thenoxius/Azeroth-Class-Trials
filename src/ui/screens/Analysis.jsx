// The class analysis: recommendation, ranking, evidence per class × dimension,
// conflicts, gaps and the (visible, adjustable) weights. Nothing hidden.
import { analyze } from '../../analysis/analyze.js';
import { WEIGHT_INFO, DEFAULT_WEIGHTS, KIND_LABEL, DIM_NAMES, DIM_IDS } from '../../analysis/model.js';
import { Portrait } from '../art/Portrait.jsx';
import { CLASS_COLORS, cx } from '../util.js';

const { useState, useMemo } = React;

const CONF_LABEL = { high: 'solid', medium: 'some evidence', low: 'thin', none: 'no evidence' };

function ScorePill({ cell, color, onClick, open }) {
  const s = cell.score;
  return (
    <button type="button" className={cx('an-cell', 'conf-' + cell.confidence, open && 'open')} onClick={onClick} style={{ '--cc': color }} aria-expanded={open}>
      <span className="an-score">{s == null ? '—' : s}</span>
      <span className="an-bar">
        <span style={{ width: `${s == null ? 0 : s}%` }} />
      </span>
      <span className="an-conf">{CONF_LABEL[cell.confidence]}</span>
    </button>
  );
}

function Evidence({ list }) {
  if (!list.length) return <p className="muted small">No evidence on this row yet.</p>;
  return (
    <ul className="an-ev">
      {list.slice(0, 14).map((e, i) => (
        <li key={i} className={cx('an-ev-item', e.value > 0.1 ? 'pos' : e.value < -0.1 ? 'neg' : 'neu')}>
          <span className={cx('badge', 'kind-' + e.kind)}>{KIND_LABEL[e.kind]}</span>
          <span className="an-ev-text">
            {e.text}
            {e.scored === false && <em className="muted small"> Not scored: not every class has a sourced fact on this row yet.</em>}
          </span>
          <span className="an-ev-w" title="Weight after caps">
            {e.value > 0.1 ? '▲' : e.value < -0.1 ? '▼' : '•'} {e.weight.toFixed(2)}
          </span>
        </li>
      ))}
      {list.length > 14 && <li className="muted small">… and {list.length - 14} smaller items.</li>}
    </ul>
  );
}

export function Analysis({ evidence, kits, trials, classOrder, characters = [], weights, onWeights, onBack, onMethod, onPlay }) {
  const [w, setW] = useState(() => ({ ...DEFAULT_WEIGHTS, ...(weights || {}) }));
  const [open, setOpen] = useState(null); // `${cls}:${dim}`
  const a = useMemo(() => {
    const ids = new Set(trials.map((t) => t.id));
    return analyze({
      sessions: evidence.sessions.filter((s) => ids.has(s.trialId)),
      feedback: evidence.feedback.filter((f) => ids.has(f.trialId)),
      weights: w,
      trials,
    });
  }, [evidence, w, trials]);
  const rec = a.recommendation;
  const setWeight = (id, v) => {
    const next = { ...w, [id]: v };
    setW(next);
    onWeights && onWeights(next);
  };
  const main = rec.main ? kits[rec.main] : null;
  const alt = rec.alt ? kits[rec.alt] : null;
  const totals = a.ranking.filter((r) => r.total != null).map((r) => r.total);
  const maxTotal = Math.max(...totals, 60);
  const minTotal = Math.min(...totals, 40);
  const provenance = (cls) => {
    const c = a.classes[cls];
    const named = Object.entries(c.byCharacter).map(([id, n]) => `${(characters.find((x) => x.id === id) || {}).name || 'removed character'} ${n}`);
    if (c.unlinkedRuns) named.push(`${c.unlinkedRuns} not linked to a character`);
    return named.length ? ` (${named.join(', ')})` : '';
  };
  const nextGap = a.gaps.find((g) => g.kind === 'trial');
  return (
    <div className="analysis">
      <header className="an-head">
        <button type="button" className="btn small ghost" onClick={onBack}>
          ← Hall
        </button>
        <h2>Class analysis</h2>
        <button type="button" className="btn small" onClick={onMethod}>
          How this verdict is reached
        </button>
      </header>

      {rec.status === 'empty' ? (
        <section className="panel an-empty">
          <p>
            No trials played yet, so there is no recommendation and no ranking. The analysis uses what you actually do in the trials and what you tell it
            afterwards. Sourced WoW: Forever facts are shown below, but they never rank a class on their own.
          </p>
          {nextGap && (
            <button
              type="button"
              className="btn primary"
              onClick={() =>
                onPlay({ trialId: nextGap.trialId, classId: nextGap.classes[0], level: (trials.find((t) => t.id === nextGap.trialId) || {}).level })
              }
            >
              Start with {trials.find((t) => t.id === nextGap.trialId).title} as {kits[nextGap.classes[0]].name}
            </button>
          )}
        </section>
      ) : rec.status === 'single' ? (
        <section className="panel an-empty">
          <p>So far you only played {kits[rec.played[0]].name}, so there is nothing to compare yet. Play another class to get a first read.</p>
        </section>
      ) : (
        <section className="an-verdict" style={{ '--cc': main.color }}>
          <div className="an-main">
            <Portrait id={main.portrait} size={84} />
            <div>
              <div className="an-eyebrow">
                {rec.status === 'early' ? 'Early read among the classes you played' : rec.confident ? 'Recommendation' : 'Leaning'}
              </div>
              <h3 className="an-main-name">{main.name}</h3>
              <div className="muted">
                {rec.margin.toFixed(1)} points ahead of {alt.name} · {a.sessions} trial runs · {Math.round(a.coverage * 100)} % of trial × class cells played
              </div>
            </div>
          </div>
          <div className="an-why">
            <div className="panel-title">Why</div>
            {rec.why.length ? (
              <ul>
                {rec.why.map((x, i) => (
                  <li key={i}>
                    {x.kind && <span className={cx('badge', 'kind-' + x.kind)}>{KIND_LABEL[x.kind]}</span>} {x.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">No single row separates them clearly yet.</p>
            )}
            <div className="panel-title">Strongest alternative</div>
            <p>{rec.strongestAlternative.text}.</p>
            {rec.whatWouldChange.length > 0 && (
              <>
                <div className="panel-title">What would change this</div>
                <ul>
                  {rec.whatWouldChange.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>
      )}

      <section className="an-rank">
        {a.ranking.map((r) => (
          <div key={r.cls} className="an-rank-row" style={{ '--cc': CLASS_COLORS[r.cls] }}>
            <span className="an-rank-name">{kits[r.cls].name}</span>
            <span className="an-rank-bar">
              {r.total != null && <span style={{ width: `${((r.total - minTotal + 5) / (maxTotal - minTotal + 10)) * 100}%` }} />}
            </span>
            <span className="an-rank-total">{r.total == null ? '—' : r.total.toFixed(1)}</span>
            <span className="muted small">
              {r.total == null
                ? 'Not played'
                : `${a.classes[r.cls].sessions} ${a.classes[r.cls].sessions === 1 ? 'run' : 'runs'}${provenance(r.cls)} · ${a.classes[r.cls].feedback} answers`}
            </span>
          </div>
        ))}
      </section>

      <section className="panel an-table-wrap">
        <div className="panel-title">Every row, every class — click a score to see its evidence</div>
        <div className="an-table" style={{ '--cols': classOrder.length }}>
          <div className="an-th" />
          {classOrder.map((c) => (
            <div key={c} className="an-th" style={{ color: CLASS_COLORS[c] }}>
              {kits[c].name}
            </div>
          ))}
          {DIM_IDS.map((dim) => (
            <div key={dim} className="an-tr" style={{ display: 'contents' }}>
              <div className="an-dim">
                {DIM_NAMES[dim]}
                <span className="an-dw" title="How much this row counts with your weights">
                  ×{a.dimWeights[dim].toFixed(2)}
                </span>
              </div>
              {classOrder.map((c) => {
                const k = `${c}:${dim}`;
                return (
                  <ScorePill key={c} cell={a.classes[c].dims[dim]} color={CLASS_COLORS[c]} open={open === k} onClick={() => setOpen(open === k ? null : k)} />
                );
              })}
              {open && open.endsWith(':' + dim) && (
                <div className="an-detail" style={{ gridColumn: '1 / -1' }}>
                  <div className="an-detail-head" style={{ color: CLASS_COLORS[open.split(':')[0]] }}>
                    {kits[open.split(':')[0]].name} · {DIM_NAMES[dim]}
                  </div>
                  <Evidence list={a.classes[open.split(':')[0]].dims[dim].evidence} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="an-side">
        {a.conflicts.length > 0 && (
          <section className="panel">
            <div className="panel-title">Mixed signals</div>
            <ul className="an-list">
              {a.conflicts.slice(0, 8).map((c, i) => (
                <li key={i}>{c.text}</li>
              ))}
            </ul>
          </section>
        )}
        {a.gaps.length > 0 && (
          <section className="panel">
            <div className="panel-title">Not known yet</div>
            <ul className="an-list">
              {a.gaps.slice(0, 10).map((g, i) => (
                <li key={i}>
                  {g.text}
                  {g.kind === 'trial' && (
                    <span className="an-gap-btns">
                      {g.classes.map((c) => (
                        <button
                          type="button"
                          key={c}
                          className="chip"
                          style={{ '--cc': CLASS_COLORS[c] }}
                          onClick={() => onPlay({ trialId: g.trialId, classId: c, level: (trials.find((t) => t.id === g.trialId) || {}).level })}
                        >
                          Play as {kits[c].name}
                        </button>
                      ))}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="panel an-weights">
          <div className="panel-title">Your weights</div>
          <p className="muted small">How much each part of the game matters to you. The verdict above recalculates as you move them.</p>
          {WEIGHT_INFO.map((info) => (
            <label key={info.id} className="an-weight">
              <span>{info.label}</span>
              {info.left && <span className="an-w-end">{info.left}</span>}
              <input
                type="range"
                min={info.min}
                max={info.max}
                step={info.step}
                value={w[info.id]}
                onChange={(e) => setWeight(info.id, Number(e.target.value))}
              />
              {info.right && <span className="an-w-end">{info.right}</span>}
              <b className="an-w-val">{info.right ? '' : w[info.id].toFixed(2)}</b>
            </label>
          ))}
          <button
            type="button"
            className="btn small ghost"
            onClick={() => {
              setW({ ...DEFAULT_WEIGHTS });
              onWeights && onWeights({ ...DEFAULT_WEIGHTS });
            }}
          >
            Reset weights
          </button>
        </section>
      </div>
      <p className="muted small an-foot">
        Facts are a weak prior; what you do and especially what you say outweigh them. Losing a trial is never read as not enjoying a class. Everything is
        stored only in this browser.
      </p>
    </div>
  );
}
