// Character roster: create the characters you want to try (race + class + name). The Hall
// shows every character side by side. Only valid Horde race/class pairs can be made.
import { Portrait } from '../art/Portrait.jsx';
import { RACES, racesFor } from '../../content/races.js';
import { CLASS_COLORS, cx } from '../util.js';

const { useState } = React;

export const newCharacterId = () => 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);

export function Roster({ characters, kits, playable, onChange, onDone, onBack, trialCount }) {
  const [classId, setClassId] = useState(null);
  const [race, setRace] = useState(null);
  const [name, setName] = useState('');
  const races = classId ? racesFor(classId) : [];
  const pickClass = (c) => {
    setClassId(c);
    // Keep the race when the new class allows it; otherwise clear it.
    if (race && !racesFor(c).includes(race)) setRace(null);
  };
  const ready = classId && race;
  const create = () => {
    if (!ready) return;
    const fallback = `${RACES[race].name} ${kits[classId].name}`;
    onChange([...characters, { id: newCharacterId(), name: name.trim().slice(0, 24) || fallback, race, classId, createdAt: new Date().toISOString() }]);
    setName('');
  };
  const remove = (id) => onChange(characters.filter((c) => c.id !== id));
  const [editing, setEditing] = useState(null);
  const update = (id, patch) => onChange(characters.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  return (
    <div className="roster">
      <h2 className="act-classic-titlebar">Your Characters</h2>
      <header className="hall-head">
        {onBack ? (
          <button type="button" className="btn small ghost" onClick={onBack}>
            ← Back
          </button>
        ) : (
          <span />
        )}
        <h3>Build your roster</h3>
        <button type="button" className="btn small primary" onClick={onDone} disabled={!characters.length}>
          To the Hall of Trials
        </button>
      </header>
      <p className="muted roster-intro">
        Make the characters you want to compare — a race and a class each. They all appear side by side in the Hall, every one with its own row of trials. You
        can add or remove characters at any time.
      </p>
      <div className="roster-body">
        <section className="panel roster-create" aria-label="New character">
          <div className="panel-title">New character</div>
          <div className="roster-preview">
            {ready ? (
              <Portrait id={`${race}-${classId}`} size={96} title={`${RACES[race].name} ${kits[classId].name}`} />
            ) : (
              <span className="roster-empty" aria-hidden="true">
                ?
              </span>
            )}
          </div>
          <div className="choice">
            <div className="panel-title">Class</div>
            <div className="race-row" role="radiogroup" aria-label="Class">
              {playable.map((c) => (
                <button
                  type="button"
                  key={c}
                  role="radio"
                  aria-checked={classId === c}
                  className={cx('race-card', 'class-card', classId === c && 'on')}
                  style={{ '--cc': CLASS_COLORS[c] }}
                  onClick={() => pickClass(c)}
                >
                  <b style={{ color: CLASS_COLORS[c] }}>{kits[c].name}</b>
                </button>
              ))}
            </div>
          </div>
          <div className="choice">
            <div className="panel-title">Race</div>
            {classId ? (
              <div className="race-row" role="radiogroup" aria-label="Race">
                {races.map((r) => (
                  <button
                    type="button"
                    key={r}
                    role="radio"
                    aria-checked={race === r}
                    className={cx('race-card', race === r && 'on')}
                    style={{ '--cc': CLASS_COLORS[classId] }}
                    onClick={() => setRace(r)}
                  >
                    <Portrait id={`${r}-${classId}`} size={40} title={`${RACES[r].name} ${kits[classId].name}`} />
                    <b>{RACES[r].name}</b>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted small">Pick a class first; only the Horde races that can be that class are shown.</p>
            )}
          </div>
          <label className="roster-name">
            <span className="panel-title">Name (optional)</span>
            <input
              type="text"
              maxLength={24}
              value={name}
              placeholder={ready ? `${RACES[race].name} ${kits[classId].name}` : 'Name'}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') create();
              }}
            />
          </label>
          <button type="button" className="btn primary" onClick={create} disabled={!ready}>
            Create character
          </button>
          <p className="roster-note">Add, change or remove characters at any time. Each character keeps its own trial progress.</p>
        </section>
        <section className="panel roster-list" aria-label="Your characters">
          <div className="panel-title">In the Hall ({characters.length})</div>
          {!characters.length && <p className="muted">No characters yet. Create at least one to enter the Hall.</p>}
          {characters.map((ch) => {
            const k = kits[ch.classId];
            const n = trialCount(ch.classId);
            return (
              <div key={ch.id} className="roster-row" style={{ '--cc': CLASS_COLORS[ch.classId] }}>
                <Portrait id={`${ch.race}-${ch.classId}`} size={44} title={`${RACES[ch.race].name} ${k.name}`} />
                <span className="roster-row-text">
                  <b>{ch.name}</b>
                  <span className="muted small">
                    {RACES[ch.race].name} <span style={{ color: CLASS_COLORS[ch.classId] }}>{k.name}</span>
                    {n < 5 ? ` · ${n} of 5 trials so far` : ''}
                  </span>
                </span>
                {editing === ch.id ? (
                  <span className="roster-edit">
                    <input type="text" maxLength={24} aria-label="Name" value={ch.name} onChange={(e) => update(ch.id, { name: e.target.value })} />
                    <select aria-label="Race" value={ch.race} onChange={(e) => update(ch.id, { race: e.target.value })}>
                      {racesFor(ch.classId).map((r) => (
                        <option key={r} value={r}>
                          {RACES[r].name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => {
                        if (!ch.name.trim()) update(ch.id, { name: `${RACES[ch.race].name} ${k.name}` });
                        setEditing(null);
                      }}
                    >
                      Done
                    </button>
                  </span>
                ) : (
                  <button type="button" className="btn small ghost" onClick={() => setEditing(ch.id)} aria-label={`Change ${ch.name}`}>
                    Change
                  </button>
                )}
                <button type="button" className="btn small ghost" onClick={() => remove(ch.id)} aria-label={`Remove ${ch.name}`}>
                  Remove
                </button>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
