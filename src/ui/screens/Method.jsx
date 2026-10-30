// How the comparison is worked out, in plain language.
import { KIND_LABEL, KIND_BLURB, KINDS } from '../../analysis/model.js';
import { cx } from '../util.js';

export function Method({ onBack }) {
  return (
    <div className="method">
      <header className="an-head">
        <button type="button" className="btn small ghost" onClick={onBack}>
          ← Back
        </button>
        <h2>How it works</h2>
        <span />
      </header>
      <section className="panel">
        <p>
          There is no personality test and no score. You play the same situations with different classes, and say what you liked. The page then tells you what
          your own answers add up to, what they do not settle, and what to try next.
        </p>
      </section>
      <section className="method-grid">
        {KINDS.map((k) => (
          <div key={k} className="panel">
            <div className="panel-title">
              <span className={cx('badge', 'kind-' + k)}>{KIND_LABEL[k]}</span>
            </div>
            <p>{KIND_BLURB[k]}</p>
          </div>
        ))}
      </section>
      <section className="panel">
        <div className="panel-title">How a preference is reached</div>
        <ol>
          <li>Only the same trial, level and role are compared. Spec is shown, but a class is compared as a whole.</li>
          <li>If you said which class you would rather play next, that decides for that situation.</li>
          <li>Otherwise your fun answers do, if they differ by at least one whole category. A smaller difference counts as equal.</li>
          <li>Repeating a trial is one opinion, your latest. It does not count as extra confirmation.</li>
          <li>“Don’t know” and skipping count as no answer: not neutral and not negative. A class you did not play is “not played”, not low.</li>
          <li>An answer where you reported a technical problem is set aside.</li>
          <li>
            A class is your provisional preference when it beats the classes it was compared with and loses to none. Equal or mixed results are reported as they
            are.
          </li>
          <li>You can reject the conclusion. The page then stops claiming it.</li>
        </ol>
        <p className="muted small">
          Effort is shown but never counted against a class: something can be hard and still be what you like. Older saves keep their older answers, quoted as
          they were asked, and these are only compared with each other.
        </p>
      </section>
      <section className="panel">
        <div className="panel-title">What the trials can and cannot tell you</div>
        <ul>
          <li>
            Spell and talent numbers are the real Forever values, read from the live client data (Wowhead’s datamined spellbook, build 1.60.1.70630). Combat
            follows Classic 1.12 rules. Nothing is tuned per class, so classes can differ, as they do in the game.
          </li>
          <li>
            Three things are estimates: gear, because Forever items are not public yet; enemies, which are built from real Classic mobs of the same level; and
            boss mechanics, which are our own designs.
          </li>
          <li>Your dungeon party and raid are real classes too, played by an AI that sometimes reacts late. Not modelled yet: the Warlock’s demon pet.</li>
          <li>Ability names, levels and mechanics follow the research, and every tooltip says where it comes from.</li>
          <li>Short trials are not hundreds of hours. This has not been tested against which class people end up enjoying in the real game.</li>
        </ul>
      </section>
    </div>
  );
}
