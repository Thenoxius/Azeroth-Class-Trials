// Optional questions after a trial: two fixed ones, one follow-up on high effort, one comparison
// when a comparable run with another class exists, and an optional moment. "Don't know" and
// skipping stay missing information.
import { cx } from '../ui/util.js';
import {
  FUN_QUESTION,
  FUN_OPTIONS,
  FUN_UNKNOWN,
  EFFORT_QUESTION,
  EFFORT_OPTIONS,
  EFFORT_UNKNOWN,
  HIGH_EFFORT,
  OBSTACLE_QUESTION,
  OBSTACLES,
  COMPARE_QUESTION,
  COMPARE_OPTIONS,
  MOMENT_KINDS,
} from '../analysis/questions.js';

const { useState } = React;

function Choice({ question, options, value, onChange }) {
  return (
    <div className="fb-q">
      <div className="fb-label">{question}</div>
      <div className="fb-options" role="radiogroup" aria-label={question}>
        {options.map((o) => (
          <button
            type="button"
            key={o.value}
            role="radio"
            aria-checked={value === o.value}
            className={cx('chip', value === o.value && 'on')}
            onClick={() => onChange(value === o.value ? undefined : o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FeedbackPanel({ session, trial, kit, compare, kits, onSubmit, onSkip }) {
  const [fun, setFun] = useState(undefined);
  const [effort, setEffort] = useState(undefined);
  const [obstacle, setObstacle] = useState(undefined);
  const [answer, setAnswer] = useState(undefined);
  const [moment, setMoment] = useState(undefined);
  const [momentKind, setMomentKind] = useState(undefined);
  const [custom, setCustom] = useState('');
  const moments = (session.moments || []).slice(0, 4);
  const high = typeof effort === 'number' && effort >= HIGH_EFFORT;
  const base = {
    v: 2,
    sessionId: session.id,
    trialId: trial.id,
    classId: kit.id,
    level: session.level,
    spec: session.spec || null,
    role: session.role || 'dps',
    at: new Date().toISOString(),
  };
  const submit = () => {
    const picked = typeof moment === 'number' ? moments[moment] : null;
    onSubmit(
      {
        ...base,
        fun: fun ?? null,
        effort: effort ?? null,
        obstacle: high ? (obstacle ?? null) : null,
        moment: picked ? { ...picked, kind: momentKind ?? null } : null,
        custom: moment === 'custom' && custom.trim() ? custom.trim().slice(0, 280) : null,
        skipped: false,
      },
      answer && compare ? { ...compare, id: 'c' + session.id, at: base.at, sessionId: session.id, answer } : null,
    );
  };
  const anything = [fun, effort, answer, moment].some((v) => v !== undefined);
  return (
    <div className="panel feedback">
      <div className="panel-title">A quick word, before the numbers. All optional.</div>
      <Choice question={FUN_QUESTION} options={[...FUN_OPTIONS, { value: 'unknown', label: FUN_UNKNOWN }]} value={fun} onChange={setFun} />
      <Choice question={EFFORT_QUESTION} options={[...EFFORT_OPTIONS, { value: 'unknown', label: EFFORT_UNKNOWN }]} value={effort} onChange={setEffort} />
      {high && <Choice question={OBSTACLE_QUESTION} options={OBSTACLES} value={obstacle} onChange={setObstacle} />}
      {compare && (
        <Choice
          question={COMPARE_QUESTION}
          options={COMPARE_OPTIONS.map((o) => ({ value: o.value, label: o.label || kits[compare[o.value]].name }))}
          value={answer}
          onChange={setAnswer}
        />
      )}
      {moments.length > 0 && (
        <details className="fb-more">
          <summary>Did a moment stand out? (optional)</summary>
          <div className="fb-moments">
            {moments.map((m, i) => (
              <button type="button" key={i} className={cx('chip', 'fb-moment', moment === i && 'on')} onClick={() => setMoment(moment === i ? undefined : i)}>
                {m.text}
              </button>
            ))}
            <button type="button" className={cx('chip', moment === 'custom' && 'on')} onClick={() => setMoment(moment === 'custom' ? undefined : 'custom')}>
              Something else…
            </button>
          </div>
          {typeof moment === 'number' && <Choice question="How was that moment?" options={MOMENT_KINDS} value={momentKind} onChange={setMomentKind} />}
          {moment === 'custom' && (
            <input
              className="fb-text"
              type="text"
              maxLength={280}
              placeholder="In your own words (optional)"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          )}
        </details>
      )}
      <div className="row gap">
        <button type="button" className="btn primary small" disabled={!anything} onClick={submit}>
          Save and see the results
        </button>
        <button
          type="button"
          className="btn small ghost"
          onClick={() => {
            onSubmit({ ...base, fun: null, effort: null, obstacle: null, moment: null, custom: null, skipped: true }, null);
            onSkip && onSkip();
          }}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
