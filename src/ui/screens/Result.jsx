// After a trial: outcome, numbers, optional feedback, next steps.
import { Portrait } from '../art/Portrait.jsx';
import { FeedbackPanel } from '../../telemetry/FeedbackPanel.jsx';
import { fmtTime, cx, CLASS_COLORS } from '../util.js';

const { useState } = React;

export function Result({ result, trial, kit, sel, classOrder, kits, feedbackGiven, onFeedback, onRetry, onOtherClass, onHall, onAnalysis }) {
  const { session, outcome, summary, abandoned } = result;
  const res = abandoned ? 'abandoned' : outcome ? outcome.result : 'abandoned';
  const title = res === 'victory' ? 'Victory' : res === 'escaped' ? 'Escaped' : res === 'defeat' ? 'Defeat' : 'Left early';
  const [fbDone, setFbDone] = useState(!!feedbackGiven);
  return (
    <div className="result">
      <div className={cx('result-card', 'r-' + res)} style={{ '--cc': kit.color }}>
        <div className="result-head">
          <Portrait id={kit.portrait} size={64} />
          <div>
            <div className="result-eyebrow">{trial.title} · Level {sel.level} {kit.name}</div>
            <h2 className="result-title">{title}</h2>
            <div className="muted">{outcome ? outcome.reason : 'You left before the fight was decided.'}</div>
          </div>
        </div>
        <div className="result-stats">
          <div className="stat"><span>Fight time</span><b>{fmtTime(session.simSeconds || 0)}</b></div>
          <div className="stat"><span>Real time</span><b>{fmtTime((session.realMs || 0) / 1000)}</b></div>
          {(summary || []).map((l, i) => (
            <div className="stat" key={i}><span>{l.label}</span><b>{l.value}</b></div>
          ))}
        </div>
        {res === 'defeat' && <p className="muted small">A loss is information about the fight, not about whether you enjoyed the class. The analysis keeps those apart.</p>}
      </div>
      <div className="result-feedback">
        {!fbDone ? (
          <FeedbackPanel session={session} trial={trial} kit={kit} onSubmit={(fb) => { onFeedback(fb); setFbDone(true); }} onSkip={() => setFbDone(true)} />
        ) : (
          <div className="panel muted">{feedbackGiven || fbDone ? 'Thanks — noted.' : ''}</div>
        )}
      </div>
      <div className="result-actions">
        <button type="button" className="btn primary" onClick={onRetry}>Play it again as {kit.name}</button>
        {classOrder.filter((c) => c !== kit.id).map((c) => (
          <button type="button" key={c} className="btn" style={{ '--cc': CLASS_COLORS[c] }} onClick={() => onOtherClass(c)}>
            Try it as {kits[c].name}
          </button>
        ))}
        <button type="button" className="btn ghost" onClick={onHall}>Back to the Hall</button>
        <button type="button" className="btn ghost" onClick={onAnalysis}>See the analysis</button>
      </div>
    </div>
  );
}
