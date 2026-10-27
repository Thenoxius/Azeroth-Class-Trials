import { Portrait } from '../art/Portrait.jsx';

export function Title({ onStart, onMethod, hasProgress, sessions }) {
  return (
    <div className="title-screen">
      <div className="title-inner">
        <div className="title-sigils" aria-hidden="true">
          <span className="sigil c-hunter"><Portrait id="orc-hunter" size={96} /></span>
          <span className="sigil c-mage"><Portrait id="undead-mage" size={112} /></span>
          <span className="sigil c-priest"><Portrait id="undead-priest" size={96} /></span>
        </div>
        <h1 className="title-name">Azeroth Class Trials</h1>
        <p className="title-tag">Hunter, Mage or Priest for World of Warcraft: Forever — settled by playing, not by a questionnaire.</p>
        <div className="title-copy">
          <p>
            Five short trials take each class from a level 10 road to a level 60 raid: ordinary questing, an ambush, a dungeon pull, a battleground duel and a long boss fight. Combat is real-time with pause. Each trial uses the toolkit the class would have at that level.
          </p>
          <p>
            While you play, the game notes what you actually do: which buttons you reach for, how you react when things go wrong, whether you bother with the pet, how long you stay engaged in a repetitive loop. After each trial you can answer a few optional questions. At the end you get a comparison that keeps four kinds of evidence apart — WoW: Forever facts, what you did, what you said, and what is still a guess.
          </p>
          <p className="muted">Everything stays in this browser. Nothing is decided in advance, and liking your Undead Priest is not a vote.</p>
        </div>
        <div className="row gap center">
          <button type="button" className="btn primary big" onClick={onStart}>{hasProgress ? 'Return to the Hall of Trials' : 'Enter the Hall of Trials'}</button>
          <button type="button" className="btn big ghost" onClick={onMethod}>How the verdict is reached</button>
        </div>
        {sessions > 0 && <p className="muted small center">{sessions} recorded {sessions === 1 ? 'attempt' : 'attempts'} so far.</p>}
      </div>
    </div>
  );
}
