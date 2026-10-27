// Optional post-trial feedback. Three 5-step scales, each with "not sure / skip"
// (stored as null — never as a midpoint), and a "moment" pick built from this
// fight's own highlights, with "none of these" and a free-text answer.
// No transparent preference questions ("do you like healing?").
import { cx } from '../ui/util.js';

const { useState } = React;

const SCALES = [
  { key: 'enjoyment', q: 'How did that fight feel to play?', lo: 'Flat', hi: 'Great' },
  { key: 'frustration', q: 'How much did the class itself get in your way?', lo: 'Not at all', hi: 'A lot' },
  { key: 'again', q: 'Would you queue this up again with this class?', lo: 'No', hi: 'Right now' },
];

export function FeedbackPanel({ session, trial, kit, onSubmit, onSkip }) {
  const [vals, setVals] = useState({ enjoyment: undefined, frustration: undefined, again: undefined });
  const [moment, setMoment] = useState(undefined);
  const [custom, setCustom] = useState('');
  const moments = (session.moments || []).slice(0, 4);
  const set = (k, v) => setVals((o) => ({ ...o, [k]: o[k] === v ? undefined : v }));
  const submit = () => {
    const norm = (v) => (v === undefined || v === 'skip' ? null : v);
    const m = moment === undefined || moment === 'skip' ? null : moment === 'none' ? 'none' : moment === 'custom' ? null : moments[moment] || null;
    onSubmit({
      sessionId: session.id,
      trialId: trial.id,
      classId: kit.id,
      level: session.level,
      spec: session.spec || null,
      role: session.role || 'dps',
      at: new Date().toISOString(),
      enjoyment: norm(vals.enjoyment),
      frustration: norm(vals.frustration),
      again: norm(vals.again),
      moment: m,
      custom: moment === 'custom' && custom.trim() ? custom.trim().slice(0, 280) : null,
      skipped: false,
    });
  };
  const anything = Object.values(vals).some((v) => v !== undefined) || moment !== undefined;
  return (
    <div className="panel feedback">
      <div className="panel-title">A quick word on that fight — all optional</div>
      {SCALES.map((s) => (
        <div className="fb-q" key={s.key}>
          <div className="fb-label">{s.q}</div>
          <div className="fb-scale" role="radiogroup" aria-label={s.q}>
            <span className="fb-end">{s.lo}</span>
            {[1, 2, 3, 4, 5].map((v) => (
              <button type="button" key={v} role="radio" aria-checked={vals[s.key] === v} className={cx('fb-dot', vals[s.key] === v && 'on')} onClick={() => set(s.key, v)}>
                {v}
              </button>
            ))}
            <span className="fb-end">{s.hi}</span>
            <button type="button" className={cx('chip', 'fb-skip', vals[s.key] === 'skip' && 'on')} onClick={() => set(s.key, 'skip')}>Not sure</button>
          </div>
        </div>
      ))}
      {moments.length > 0 && (
        <div className="fb-q">
          <div className="fb-label">Which moment stood out, if any?</div>
          <div className="fb-moments">
            {moments.map((m, i) => (
              <button type="button" key={i} className={cx('chip', 'fb-moment', moment === i && 'on')} onClick={() => setMoment(moment === i ? undefined : i)}>{m.text}</button>
            ))}
            <button type="button" className={cx('chip', moment === 'none' && 'on')} onClick={() => setMoment(moment === 'none' ? undefined : 'none')}>None of these</button>
            <button type="button" className={cx('chip', moment === 'custom' && 'on')} onClick={() => setMoment(moment === 'custom' ? undefined : 'custom')}>Something else…</button>
          </div>
          {moment === 'custom' && <input className="fb-text" type="text" maxLength={280} placeholder="In your own words (optional)" value={custom} onChange={(e) => setCustom(e.target.value)} />}
        </div>
      )}
      <div className="row gap">
        <button type="button" className="btn primary small" disabled={!anything && !custom} onClick={submit}>Save</button>
        <button type="button" className="btn small ghost" onClick={() => { onSkip && onSkip(); onSubmit && onSubmit({ sessionId: session.id, trialId: trial.id, classId: kit.id, level: session.level, spec: session.spec || null, role: session.role || 'dps', at: new Date().toISOString(), enjoyment: null, frustration: null, again: null, moment: null, custom: null, skipped: true }); }}>Skip</button>
      </div>
    </div>
  );
}
