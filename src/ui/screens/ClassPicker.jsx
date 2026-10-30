// Choose the classes you want to try. Race and name get sensible defaults; both can be
// changed later under Characters. Classes you already have a character for keep that character.
import { Portrait } from '../art/Portrait.jsx';
import { CLASS_INTRO } from '../../content/class-intro.js';
import { RACES, racesFor } from '../../content/races.js';
import { CLASS_COLORS, CLASS_TEXT_ON_DARK, cx } from '../util.js';

const { useState } = React;
const EXPERIENCE = [
  { value: 'new', label: 'New to me' },
  { value: 'some', label: 'Played a little' },
  { value: 'lots', label: 'Played a lot' },
];

export function ClassPicker({ kits, playable, characters, onDone, onFreePlay }) {
  const [picked, setPicked] = useState([]);
  const [races, setRaces] = useState({});
  const [experience, setExperience] = useState({});
  const toggle = (c) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
  const existing = (c) => characters.find((x) => x.classId === c);
  const raceOf = (c) => (existing(c) ? existing(c).race : races[c] || racesFor(c)[0]);
  const ready = picked.length >= 1;
  return (
    <div className="picker">
      <h2 className="act-classic-titlebar">Choose your classes</h2>
      <p className="picker-intro">Pick as many as you like. You can change this later.</p>
      <div className="picker-grid">
        {playable.map((c) => {
          const intro = CLASS_INTRO[c];
          const on = picked.includes(c);
          return (
            <div key={c} className={cx('picker-card', on && 'on')} style={{ '--cc': CLASS_COLORS[c] }}>
              <button type="button" className="picker-main" aria-pressed={on} onClick={() => toggle(c)}>
                <Portrait id={`${raceOf(c)}-${c}`} size={56} />
                <span className="picker-text">
                  <b className="cname" style={{ color: CLASS_TEXT_ON_DARK[c] }}>
                    {kits[c].name}
                  </b>
                  <span>{intro.summary}</span>
                  <span className="muted small">{intro.feel}</span>
                  <span className="picker-roles">
                    {intro.roles.map((r) => (
                      <span key={r} className="picker-role">
                        {r}
                      </span>
                    ))}
                  </span>
                </span>
              </button>
              {on && (
                <div className="picker-extra">
                  {existing(c) ? (
                    <span className="muted small">Uses your character {existing(c).name}.</span>
                  ) : (
                    <label className="small">
                      Race{' '}
                      <select value={raceOf(c)} onChange={(e) => setRaces({ ...races, [c]: e.target.value })}>
                        {racesFor(c).map((r) => (
                          <option key={r} value={r}>
                            {RACES[r].name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="small">
                    Played it before?{' '}
                    <select value={experience[c] || ''} onChange={(e) => setExperience({ ...experience, [c]: e.target.value || undefined })}>
                      <option value="">Rather not say</option>
                      {EXPERIENCE.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="picker-foot">
        <button
          type="button"
          className="btn primary big"
          disabled={!ready}
          onClick={() => onDone({ classes: picked, races: Object.fromEntries(picked.map((c) => [c, raceOf(c)])), experience })}
        >
          {ready ? 'Enter the Hall of Trials' : 'Pick at least one class'}
        </button>
        <button type="button" className="linkish" onClick={onFreePlay}>
          Rather build your own roster and play freely
        </button>
      </div>
      <p className="muted small">Race and name can be changed under Characters at any time. Your race only changes racial abilities, not the comparison.</p>
    </div>
  );
}
