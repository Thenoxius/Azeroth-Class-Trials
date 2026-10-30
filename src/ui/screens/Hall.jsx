// The Hall of Trials: trials × your characters, progress, coverage-aware suggestion.
// Progress belongs to the character (its id). Results from before characters existed stay
// unlinked and are only counted per class; a character whose class cannot play a trial yet
// shows that instead of a button.
import { Portrait } from '../art/Portrait.jsx';
import { runKey, legacyRunCount } from '../../telemetry/store.js';
import { CLASS_COLORS, CLASS_TEXT_ON_DARK, cx } from '../util.js';
import { RACES } from '../../content/races.js';
import { trialSupports } from '../../content/index.js';
import { nextSuggestion, suggestedOrder } from './hall-next.js';

const KIND_LABEL = { questing: 'Questing', danger: 'Unexpected danger', dungeon: 'Dungeon', pvp: 'PvP', raid: 'Raid', dummy: 'Target dummy' };

export function Hall({ trials, kits, characters, progress, evidence, onPick, onCodex, onSettings, onTitle }) {
  const classOrder = [...new Set(characters.map((c) => c.classId))];
  const next = nextSuggestion(trials, characters, progress);
  const pickFor = (ch, t, lv) => onPick({ trialId: t.id, classId: ch.classId, level: lv, race: ch.race, charId: ch.id });
  const perClass = {};
  for (const c of classOrder) perClass[c] = { sessions: 0, minutes: 0, feedback: 0 };
  for (const s of evidence.sessions) {
    if (!perClass[s.classId]) continue;
    perClass[s.classId].sessions++;
    perClass[s.classId].minutes += (s.realMs || 0) / 60000;
  }
  for (const f of evidence.feedback) if (perClass[f.classId]) perClass[f.classId].feedback++;
  return (
    <div className="hall">
      <header className="hall-head">
        <button type="button" className="linkish" onClick={onTitle}>
          Azeroth Class Trials
        </button>
        <h2>The Hall of Trials</h2>
        <div className="row gap">
          <button type="button" className="btn small ghost" onClick={onCodex}>
            Forever codex
          </button>
          <button type="button" className="btn small ghost" onClick={onSettings}>
            Settings &amp; data
          </button>
        </div>
      </header>
      <div className="hall-body">
        <section className="hall-trials" aria-label="Trials">
          {trials.map((t, ti) => (
            <article key={t.id} className={cx('trial-row', 'k-' + t.kind)}>
              <div className="trial-info">
                <div className="trial-eyebrow">
                  Trial {t.order} · {KIND_LABEL[t.kind] || t.kind} · Level {t.levels && t.levels.length > 1 ? t.levels.join(' / ') : t.level}
                </div>
                <h3 className="trial-title">{t.title}</h3>
                <p className="trial-blurb">{t.blurb || t.place}</p>
              </div>
              <div className="trial-classes">
                {suggestedOrder(ti, characters).map((ch) => {
                  const c = ch.classId;
                  const k = kits[c];
                  const portrait = `${ch.race}-${c}`;
                  const levels = t.levels && t.levels.length ? t.levels : [t.level];
                  if (!trialSupports(t.id, c)) {
                    return (
                      <div key={ch.id} className="tc-cell">
                        <div
                          className="tc st-locked"
                          style={{ '--cc': CLASS_COLORS[c] }}
                          title={`${k.name}s cannot play this trial yet (phase 4 in progress).`}
                        >
                          <span className="tc-portrait">
                            <Portrait id={portrait} size={40} dead />
                          </span>
                          <span className="tc-text">
                            <span className="tc-class" style={{ color: CLASS_TEXT_ON_DARK[c] }}>
                              {ch.name}
                            </span>
                            <span className="tc-status">Not available yet</span>
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={ch.id} className="tc-cell">
                      {levels.map((lv) => {
                        const r = progress.runs[runKey(t.id, c, lv, ch.id)] || null;
                        const isNext = next && next.trialId === t.id && next.charId === ch.id && next.level === lv;
                        const status = !r || !r.attempts ? 'new' : r.wins ? 'won' : 'tried';
                        return (
                          <button
                            type="button"
                            key={lv}
                            className={cx('tc', 'st-' + status, isNext && 'next', lv !== t.level && 'variant')}
                            style={{ '--cc': CLASS_COLORS[c] }}
                            onClick={() => pickFor(ch, t, lv)}
                            title={`${ch.name} — ${RACES[ch.race].name} ${k.name}`}
                          >
                            <span className="tc-portrait">
                              <Portrait id={portrait} size={40} />
                            </span>
                            <span className="tc-text">
                              <span className="tc-class" style={{ color: CLASS_TEXT_ON_DARK[c] }}>
                                {ch.name}
                                {lv !== t.level ? ` · L${lv}` : ''}
                              </span>
                              <span className="tc-status">
                                {status === 'new'
                                  ? isNext
                                    ? 'Suggested next'
                                    : 'Not tried'
                                  : r.bestDps1m
                                    ? `Best ${Math.round(r.bestDps1m).toLocaleString('en-US')} DPS`
                                    : status === 'won'
                                      ? `Won · ${r.attempts} ${r.attempts === 1 ? 'run' : 'runs'}`
                                      : `${r.attempts} ${r.attempts === 1 ? 'attempt' : 'attempts'}`}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </section>
        <aside className="hall-side">
          <div className="panel">
            <div className="panel-title">Evidence so far</div>
            {classOrder.map((c) => (
              <div key={c} className="ev-row">
                <span className="ev-class" style={{ color: CLASS_COLORS[c] }}>
                  {kits[c].name}
                </span>
                <span>
                  {perClass[c].sessions} {perClass[c].sessions === 1 ? 'run' : 'runs'}
                </span>
                <span>{perClass[c].minutes.toFixed(0)} min</span>
                <span>{perClass[c].feedback} notes</span>
              </div>
            ))}
            {classOrder.some((c) => legacyRunCount(progress, c) > 0) && (
              <p className="muted small">
                Earlier runs, not linked to a character:{' '}
                {classOrder
                  .filter((c) => legacyRunCount(progress, c) > 0)
                  .map((c) => `${kits[c].name} ${legacyRunCount(progress, c)}`)
                  .join(', ')}
                .
              </p>
            )}
            <p className="muted small">
              The class order changes from trial to trial, so no class always gets your freshest attention. Replay anything you like: repeats of a trial count
              as one opinion.
            </p>
          </div>
          {next ? (
            <button type="button" className="panel next-card" onClick={() => onPick(next)}>
              <div className="panel-title">Suggested next</div>
              <div className="next-line">
                <Portrait id={`${next.race}-${next.classId}`} size={44} />
                <span>
                  <b>{trials.find((t) => t.id === next.trialId).title}</b>
                  <br />
                  {(characters.find((c) => c.id === next.charId) || {}).name || kits[next.classId].name}, level {next.level}
                </span>
              </div>
            </button>
          ) : (
            <div className="panel">
              <div className="panel-title">{characters.length ? 'Every trial played' : 'No characters yet'}</div>
              <p>
                {characters.length
                  ? 'Your characters have played every trial they can. The analysis shows which classes it still has too little on.'
                  : 'Create a character under Characters to start the trials.'}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
