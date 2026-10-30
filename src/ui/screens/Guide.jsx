// The guided comparison: one next step, why it is next, and how far along you are.
import { Portrait } from '../art/Portrait.jsx';
import { trialById } from '../../content/index.js';
import { nextStep, routeProgress } from '../../guide/route.js';
import { ROLE_LABEL } from '../../analysis/questions.js';
import { CLASS_INTRO } from '../../content/class-intro.js';
import { CLASS_COLORS, CLASS_TEXT_ON_DARK } from '../util.js';

export function Guide({ guide, sessions, characters, kits, onPlay, onPractice, onSkipPractice, onSkip, onChange, onHall, onAnalysis }) {
  const step = nextStep(guide, sessions, characters);
  const prog = routeProgress(guide, sessions);
  const trial = step && step.type === 'trial' ? trialById(step.trialId) : null;
  return (
    <div className="guide">
      <h2 className="act-classic-titlebar">Your comparison</h2>
      <p className="guide-line">
        Comparing{' '}
        {guide.classes.map((c, i) => (
          <span key={c}>
            {i > 0 ? ', ' : ''}
            <b className="cname" style={{ color: CLASS_TEXT_ON_DARK[c] }}>
              {kits[c].name}
            </b>
          </span>
        ))}
        . {prog.done} of {prog.total} trials played{prog.skipped ? `, ${prog.skipped} skipped` : ''}.
      </p>
      {step && step.type === 'practice' && (
        <section className="panel guide-step" style={{ '--cc': CLASS_COLORS[step.classId] }}>
          <Portrait id={`${step.race}-${step.classId}`} size={72} />
          <div>
            <div className="panel-title">Next: a short practice</div>
            <h3>{kits[step.classId].name} in the Practice Yard</h3>
            <p>
              Try the controls and one {kits[step.classId].name} mechanic on a dummy that never fights back. {CLASS_INTRO[step.classId].feel}
            </p>
            <p className="muted small">About a minute. It does not count towards your comparison.</p>
            <div className="row gap">
              <button type="button" className="btn primary" onClick={() => onPractice(step)}>
                Start practice
              </button>
              <button type="button" className="btn ghost" onClick={() => onSkipPractice(step.classId)}>
                Skip practice
              </button>
            </div>
          </div>
        </section>
      )}
      {step && step.type === 'trial' && (
        <section className="panel guide-step" style={{ '--cc': CLASS_COLORS[step.classId] }}>
          <Portrait id={`${step.race}-${step.classId}`} size={72} />
          <div>
            <div className="panel-title">Next trial</div>
            <h3>{trial.title}</h3>
            <dl className="guide-facts">
              <dt>Class</dt>
              <dd>{kits[step.classId].name}</dd>
              <dt>Role</dt>
              <dd>{ROLE_LABEL[step.role]}</dd>
              <dt>Spec</dt>
              <dd>{step.level >= 20 ? 'you choose on the next screen' : 'none yet at this level'}</dd>
              <dt>Level</dt>
              <dd>{step.level}</dd>
            </dl>
            <p>{step.why}</p>
            <div className="row gap">
              <button type="button" className="btn primary" onClick={() => onPlay(step)}>
                Go to the briefing
              </button>
              <button type="button" className="btn ghost" onClick={() => onSkip(step)}>
                Skip this one
              </button>
            </div>
          </div>
        </section>
      )}
      {!step && (
        <section className="panel guide-step">
          <div>
            <div className="panel-title">Route finished</div>
            <p>You have been through every suggested trial. See what your answers add up to.</p>
            <button type="button" className="btn primary" onClick={onAnalysis}>
              See your comparison
            </button>
          </div>
        </section>
      )}
      <p className="small">
        <button type="button" className="linkish" onClick={onAnalysis}>
          Your comparison so far
        </button>
        {' · '}
        <button type="button" className="linkish" onClick={onHall}>
          Free play in the Hall
        </button>
        {' · '}
        <button type="button" className="linkish" onClick={onChange}>
          Change classes
        </button>
      </p>
    </div>
  );
}
