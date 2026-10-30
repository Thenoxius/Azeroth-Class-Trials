import { Portrait } from '../art/Portrait.jsx';

export function Title({ onStart, onMethod, onHall, guideActive, hasCharacters }) {
  return (
    <div className="title-screen">
      <div className="title-inner">
        <div className="title-sigils" aria-hidden="true">
          <span className="sigil c-hunter">
            <Portrait id="orc-hunter" size={96} />
          </span>
          <span className="sigil c-mage">
            <Portrait id="undead-mage" size={112} />
          </span>
          <span className="sigil c-priest">
            <Portrait id="undead-priest" size={96} />
          </span>
        </div>
        <h1 className="title-name">Azeroth Class Trials</h1>
        <p className="title-tag">Not sure which class to play in World of Warcraft: Forever? Try them in short fights and find out which you like.</p>
        <ul className="title-points">
          <li>
            <b>Try</b> Hunter, Mage, Priest, Warrior, Rogue and Shaman, in the same situations: questing, danger, a dungeon, a duel and a raid.
          </li>
          <li>
            <b>Get</b> a plain comparison based on what you liked, with its reasons and what is still unknown.
          </li>
          <li>
            <b>Start</b> by choosing two or three classes. The game then suggests one trial at a time.
          </li>
        </ul>
        <div className="row gap center">
          <button type="button" className="btn primary big" onClick={onStart}>
            {guideActive ? 'Continue comparing' : 'Choose your classes'}
          </button>
        </div>
        <p className="muted small center title-facts">
          Desktop browser game · No account needed · Saved only in this browser · A simplified simulation of WoW: Forever
        </p>
        <p className="small center">
          <button type="button" className="linkish" onClick={onMethod}>
            How it works
          </button>
          {hasCharacters && (
            <>
              {' · '}
              <button type="button" className="linkish" onClick={onHall}>
                Free play in the Hall
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
