// Your comparison: a provisional preference with its reasons, what is uncertain, one useful
// next trial, what was actually compared, and the other kinds of information kept apart.
import { analyze } from '../../analysis/analyze.js';
import { KIND_LABEL, KIND_BLURB, KINDS } from '../../analysis/model.js';
import { ROLE_LABEL, effortLabel } from '../../analysis/questions.js';
import { Portrait } from '../art/Portrait.jsx';
import { CLASS_COLORS, CLASS_TEXT_ON_DARK, cx } from '../util.js';

const { useMemo, useState } = React;

const names = (list, kits) => list.map((c) => kits[c].name).join(', ');

function Confirm({ id, value, onConfirm, yes = 'Yes', no = 'No' }) {
  return (
    <span className="an-confirm">
      {[
        ['yes', yes],
        ['no', no],
        ['unsure', 'Not sure'],
      ].map(([v, label]) => (
        <button type="button" key={v} className={cx('chip', value === v && 'on')} onClick={() => onConfirm(id, value === v ? null : v)}>
          {label}
        </button>
      ))}
    </span>
  );
}

function Verdict({ a, kits, confirmations, onConfirm }) {
  const lean = a.lean;
  if (a.status === 'empty') return <p>No trials played yet, so there is nothing to say about you. Only your own answers can point to a preference.</p>;
  if (a.status === 'single')
    return <p>So far you only played {kits[a.played[0]].name}, so there is nothing to compare yet. One trial with another class gives a first comparison.</p>;
  if (a.status === 'uncompared')
    return (
      <p>
        You played {names(a.played, kits)}, but not yet with an answer in the same trial, level and role. Answers from different situations are not compared.
      </p>
    );
  if (a.status === 'tie')
    return (
      <p>
        <b>No preference so far.</b> Your answers for {names(a.tied, kits)} are equal, which is a valid result: you may simply like them about the same.
      </p>
    );
  if (a.status === 'conflict')
    return (
      <>
        <p>
          <b>Mixed so far.</b> You preferred different classes in different situations. That can be real: the right class may depend on what you want to do
          most.
        </p>
        <ul>
          {a.conflicts
            .flatMap((p) => p.reasons)
            .map((r, i) => (
              <li key={i}>{r.text}</li>
            ))}
        </ul>
      </>
    );
  if (a.status === 'corrected')
    return (
      <p>
        You said {kits[a.rejected.cls].name} is not your preference, so this page does not claim it.{' '}
        <button type="button" className="linkish" onClick={() => onConfirm(`lean:${a.rejected.cls}`, null)}>
          Undo
        </button>
      </p>
    );
  const k = kits[lean.cls];
  const id = `lean:${lean.cls}`;
  return (
    <div className="an-main" style={{ '--cc': k.color }}>
      <Portrait id={k.portrait} size={84} />
      <div>
        <div className="an-eyebrow">Provisional preference · {lean.strength === 'clearer' ? 'clearer so far' : 'slight so far'}</div>
        <h3 className="an-main-name">{k.name}</h3>
        <div className="panel-title">Why</div>
        <ul>
          {lean.reasons.map((r, i) => (
            <li key={i}>{r.text}</li>
          ))}
        </ul>
        {lean.opposing.length > 0 && (
          <>
            <div className="panel-title">Pointing the other way</div>
            <ul>
              {lean.opposing.map((r, i) => (
                <li key={i}>{r.text}</li>
              ))}
            </ul>
          </>
        )}
        {lean.tiedWith.length > 0 && <p className="muted small">About equal with {names(lean.tiedWith, kits)}.</p>}
        <p className="an-ask">
          Does this sound right? <Confirm id={id} value={confirmations[id]} onConfirm={onConfirm} />
        </p>
      </div>
    </div>
  );
}

function Coverage({ a, kits }) {
  if (!a.situations.length) return null;
  const shown = a.played.length ? a.played : Object.keys(a.classes).filter((c) => a.classes[c].played);
  return (
    <section className="panel">
      <div className="panel-title">What was actually compared</div>
      <div className="an-cover-wrap">
        <table className="an-cover">
          <thead>
            <tr>
              <th>Situation</th>
              {shown.map((c) => (
                <th key={c}>
                  <span className="cname" style={{ color: CLASS_TEXT_ON_DARK[c] }}>
                    {kits[c].name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {a.situations.map((s) => (
              <tr key={s.key}>
                <td>{s.title}</td>
                {shown.map((c) => {
                  const r = s.classes[c];
                  if (!r)
                    return (
                      <td key={c} className="muted">
                        Not played
                      </td>
                    );
                  return (
                    <td key={c}>
                      {r.specList.length > 0 && <div className="small muted an-spec">{r.specList.join(', ')}</div>}
                      <div>{r.rating ? r.rating.text : 'No answer'}</div>
                      {typeof r.effort === 'number' && <div className="small muted">Effort: {effortLabel(r.effort)}</div>}
                      {r.runs > 1 && <div className="small muted">{r.runs} runs, one opinion</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Played: {shown.map((c) => `${kits[c].name} (${a.classes[c].roles.map((r) => ROLE_LABEL[r]).join(', ') || 'no finished run'})`).join(' · ')}. Not played:{' '}
        {Object.keys(a.classes)
          .filter((c) => !a.classes[c].played)
          .map((c) => kits[c].name)
          .join(', ') || 'none'}
        . Only answers in the same trial, level and role are compared.
      </p>
    </section>
  );
}

function Provenance({ a, kits, characters }) {
  const lines = a.played.map((c) => {
    const x = a.classes[c];
    const named = Object.entries(x.byCharacter).map(([id, n]) => `${(characters.find((y) => y.id === id) || {}).name || 'removed character'} ${n}`);
    if (x.unlinkedRuns) named.push(`${x.unlinkedRuns} not linked to a character`);
    return named.length ? `${kits[c].name}: ${named.join(', ')}` : null;
  });
  return lines.some(Boolean) ? <p className="muted small">Runs per character. {lines.filter(Boolean).join(' · ')}.</p> : null;
}

export function Analysis({ evidence, kits, trials, classOrder, characters = [], guide, nextUp, leaderboard = [], onConfirm, onBack, onMethod, onPlayNext }) {
  const confirmations = evidence.confirmations || {};
  const [open, setOpen] = useState(null);
  const a = useMemo(
    () =>
      analyze({
        sessions: evidence.sessions,
        feedback: evidence.feedback,
        comparisons: evidence.comparisons || [],
        confirmations,
        experience: (guide && guide.experience) || {},
        trials,
      }),
    [evidence, trials, guide],
  );
  const best = {};
  for (const e of leaderboard) if (!best[e.classId] || e.dps > best[e.classId]) best[e.classId] = e.dps;
  return (
    <div className="analysis">
      <header className="an-head">
        <button type="button" className="btn small ghost" onClick={onBack}>
          ← Back
        </button>
        <h2>Your comparison</h2>
        <button type="button" className="btn small" onClick={onMethod}>
          How this is worked out
        </button>
      </header>

      <section className="an-verdict panel">
        <Verdict a={a} kits={kits} confirmations={confirmations} onConfirm={onConfirm} />
      </section>

      {nextUp && (
        <section className="panel an-next">
          <div className="panel-title">One useful next trial</div>
          <p>{nextUp.text}</p>
          <button type="button" className="btn primary" onClick={onPlayNext}>
            {nextUp.label}
          </button>
        </section>
      )}

      {a.uncertainties.length > 0 && (
        <section className="panel">
          <div className="panel-title">What is still uncertain</div>
          <ul className="an-list">
            {a.uncertainties.slice(0, 8).map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </section>
      )}

      <Coverage a={a} kits={kits} />
      <Provenance a={a} kits={kits} characters={characters} />

      {a.followUps.length > 0 && (
        <section className="panel">
          <div className="panel-title">A question about what you did</div>
          <p className="muted small">Your play can raise a question but not answer it. Your answer is noted here and does not decide a preference.</p>
          <ul className="an-list">
            {a.followUps.slice(0, 5).map((f) => (
              <li key={f.id}>
                {f.text} <Confirm id={f.id} value={f.answer} onConfirm={onConfirm} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {a.played.length > 0 && (
        <section className="panel">
          <div className="panel-title">How the fights went (separate from what you liked)</div>
          <ul className="an-list">
            {a.played.map((c) => (
              <li key={c}>
                <b className="cname" style={{ color: CLASS_TEXT_ON_DARK[c] }}>
                  {kits[c].name}
                </b>
                : {a.performance[c].wins} of {a.performance[c].runs} finished runs won
                {a.performance[c].escaped ? `, ${a.performance[c].escaped} escaped` : ''}
                {best[c] ? ` · best Proving Grounds ${Math.round(best[c]).toLocaleString('en-US')} DPS` : ''}
              </li>
            ))}
          </ul>
          <p className="muted small">
            Gear and enemies are estimates and classes are not balanced against each other here. Winning or losing does not count as liking or disliking a
            class.
          </p>
        </section>
      )}

      <section className="panel">
        <div className="panel-title">The details per class, kept apart</div>
        <div className="an-class-tabs">
          {classOrder.map((c) => (
            <button
              type="button"
              key={c}
              className={cx('chip', open === c && 'on')}
              style={{ '--cc': CLASS_COLORS[c] }}
              onClick={() => setOpen(open === c ? null : c)}
            >
              {kits[c].name}
            </button>
          ))}
        </div>
        {open && (
          <div className="an-kinds">
            {KINDS.map((kind) => {
              const list = a.evidence[kind][open] || [];
              return (
                <div key={kind} className="an-kind">
                  <div className="panel-title">
                    <span className={cx('badge', 'kind-' + kind)}>{KIND_LABEL[kind]}</span>
                  </div>
                  <p className="muted small">{KIND_BLURB[kind]}</p>
                  {list.length ? (
                    <ul className="an-list">
                      {list.slice(0, 14).map((x, i) => (
                        <li key={i}>{typeof x === 'string' ? x : `${x.dim}: ${x.text} (${x.status})`}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted small">Nothing yet.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
      <p className="muted small an-foot">
        Everything is stored only in this browser. Short trials in a simulation cannot prove which class you will like for hundreds of hours.
      </p>
    </div>
  );
}
