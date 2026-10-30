// Trial briefing: story, goals, spec/role choice and the toolkit at this level.
import { Portrait } from '../art/Portrait.jsx';
import { AbilityIcon } from '../art/AbilityIcon.jsx';
import { getAbility, resolveAbility } from '../../engine/registry.js';
import { STATUS_LABEL, STATUS_SHORT, CLASS_COLORS, cx } from '../util.js';
import { RACES, validRace } from '../../content/races.js';

const { useState, useMemo } = React;

export function Briefing({
  trial,
  kit,
  level,
  initialSpec,
  initialRole,
  initialRace,
  raceLocked,
  onStart,
  onBack,
  onSwitchCharacter,
  characters,
  characterId,
  kits,
}) {
  const roles = trial.rolesFor ? trial.rolesFor(kit.id) : ['dps'];
  const [role, setRole] = useState(roles.includes(initialRole) ? initialRole : roles[0]);
  const specsFor = (r) => (kit.specsFor ? kit.specsFor(level, r) : kit.specs && kit.specs[level]) || [];
  const specs = specsFor(role);
  const [specPick, setSpec] = useState(initialSpec);
  const races = kit.races ? kit.races() : [];
  const [racePick, setRace] = useState(initialRace);
  const race = validRace(kit.id, racePick);
  const spec = specs.find((s) => s.id === specPick) ? specPick : specs[0] ? specs[0].id : null;
  const build = useMemo(() => {
    try {
      return kit.build({ level, spec, role, race, trialId: trial.id });
    } catch (e) {
      return { bar: [], error: String(e) };
    }
  }, [kit, level, spec, role, race, trial.id]);
  const intro = trial.intro ? trial.intro(kit.id, level, role) : { text: '', goals: [], tips: [] };
  const newIds = new Set((build.newSince && build.newSince.ids) || []);
  const abilities = (build.bar || [])
    .map((id) => {
      const d = getAbility(id);
      return d ? resolveAbility(d, level) : null;
    })
    .filter(Boolean);
  const petAbilities = build.pet ? (build.pet.bar || []).map((id) => getAbility(id)).filter(Boolean) : [];
  const extras = (build.consumables || []).map((id) => getAbility(id)).filter(Boolean);
  return (
    <div className="briefing">
      <header className="brief-head">
        <button type="button" className="btn small ghost" onClick={onBack}>
          ← Hall
        </button>
        <div className="brief-eyebrow">
          Trial {trial.order} · {trial.place} · Level {level}
        </div>
      </header>
      <div className="brief-body">
        <section className="brief-story">
          <h2>{trial.title}</h2>
          <p className="brief-text">{intro.text}</p>
          {intro.goals && intro.goals.length > 0 && (
            <div className="brief-goals">
              <div className="panel-title">Goals</div>
              <ul>
                {intro.goals.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
          )}
          {intro.tips && intro.tips.length > 0 && (
            <div className="brief-tips">
              <div className="panel-title">Worth knowing</div>
              <ul>
                {intro.tips.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="brief-switch">
            <span className="muted small">Play this trial as</span>
            {characters.map((c) => (
              <button
                type="button"
                key={c.id}
                aria-pressed={c.id === characterId}
                className={cx('chip', c.id === characterId && 'on')}
                style={{ '--cc': CLASS_COLORS[c.classId] }}
                onClick={() => c.id !== characterId && onSwitchCharacter(c)}
              >
                {c.name} · {kits[c.classId].name}
              </button>
            ))}
          </div>
        </section>
        <section className="brief-kit" style={{ '--cc': kit.color }}>
          <div className="kit-head">
            <span className="kit-portrait">
              <Portrait id={build.template && build.template.portrait ? build.template.portrait : kit.portrait} size={72} />
            </span>
            <div>
              <div className="kit-name">
                {RACES[race] ? RACES[race].name + ' ' : ''}
                {kit.name}
              </div>
              <div className="muted small">{kit.tagline || ''}</div>
            </div>
          </div>
          {(races.length > 1 || raceLocked) && (
            <div className="choice">
              <div className="panel-title">{raceLocked ? `Racial traits — ${RACES[race].name}` : 'Race'}</div>
              {!raceLocked && (
                <div className="race-row" role="radiogroup" aria-label="Race">
                  {races.map((r) => (
                    <button
                      type="button"
                      key={r}
                      role="radio"
                      aria-checked={race === r}
                      className={cx('race-card', race === r && 'on')}
                      onClick={() => setRace(r)}
                    >
                      <Portrait id={r + '-' + kit.id} size={44} title={RACES[r].name + ' ' + kit.name} />
                      <b>{RACES[r].name}</b>
                    </button>
                  ))}
                </div>
              )}
              {build.racials && build.racials.length > 0 && (
                <ul className="racials">
                  {build.racials.map((p) => (
                    <li key={p.name}>
                      <b>{p.name}</b> — {p.desc}
                    </li>
                  ))}
                </ul>
              )}
              {RACES[race] && RACES[race].note && <p className="muted small">{RACES[race].note}</p>}
            </div>
          )}
          {specs.length > 0 && (
            <div className="choice">
              <div className="panel-title">Specialisation at level {level}</div>
              <div className="choice-row">
                {specs.map((s) => (
                  <button type="button" key={s.id} className={cx('choice-card', spec === s.id && 'on')} onClick={() => setSpec(s.id)}>
                    <b>{s.name}</b>
                    <span>{s.blurb}</span>
                    {s.forever && <span className={cx('badge', 'st-' + s.forever.status)}>{STATUS_SHORT[s.forever.status]}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
          {roles.length > 1 && (
            <div className="choice">
              <div className="panel-title">Role in this trial</div>
              <div className="choice-row">
                {roles.map((r) => (
                  <button type="button" key={r} className={cx('choice-card', role === r && 'on')} onClick={() => setRole(r)}>
                    <b>{r === 'healer' ? 'Heal the group' : r === 'tank' ? 'Tank the enemies' : 'Deal damage'}</b>
                    <span>
                      {r === 'healer'
                        ? 'Keep four allies alive with your heals, shields and dispels.'
                        : r === 'tank'
                          ? 'Build threat, protect your allies and use defensive abilities.'
                          : 'Bring damage, control and utility.'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {build.loopHint && <p className="loop-hint">{build.loopHint}</p>}
          {build.passives && build.passives.length > 0 && (
            <>
              <div className="panel-title">Talents this build models</div>
              <div className="kit-passives">
                {build.passives.map((p, i) => {
                  const f = p.forever || { status: 'approximation' };
                  return (
                    <div key={i} className="kit-passive" title={f.note || ''}>
                      <span className={cx('badge', 'st-' + f.status)}>{STATUS_SHORT[f.status] || f.status}</span>
                      <span>
                        <b>{p.name}</b> — {p.desc}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <div className="panel-title">Your toolkit at level {level}</div>
          {build.error && <p className="error">{build.error}</p>}
          <div className="kit-grid">
            {abilities.map((ab) => {
              const f = ab.forever || { status: 'approximation' };
              return (
                <div
                  key={ab.id}
                  className={cx('kit-ab', newIds.has(ab.id) && 'is-new')}
                  title={`${ab.desc || ''}\n\n${STATUS_LABEL[f.status] || ''}${f.note ? ': ' + f.note : ''}`}
                >
                  <AbilityIcon icon={ab.icon} ability={ab.id} school={ab.school} size={34} />
                  <span className="kit-ab-name">{ab.name}</span>
                  <span className={cx('badge', 'st-' + f.status)}>{STATUS_SHORT[f.status] || f.status}</span>
                  {newIds.has(ab.id) && <span className="new-tag">new</span>}
                </div>
              );
            })}
            {extras.map((ab) => (
              <div
                key={ab.id}
                className="kit-ab extra"
                title={`${ab.desc || ''}

${STATUS_LABEL[(ab.forever || {}).status] || ''}${ab.forever && ab.forever.note ? ': ' + ab.forever.note : ''}`}
              >
                <AbilityIcon icon={ab.icon} ability={ab.id} school={ab.school} size={34} />
                <span className="kit-ab-name">{ab.name}</span>
                <span className={cx('badge', 'st-' + ((ab.forever && ab.forever.status) || 'approximation'))}>
                  {STATUS_SHORT[(ab.forever && ab.forever.status) || 'approximation']}
                </span>
              </div>
            ))}
            {petAbilities.map((ab) => (
              <div key={ab.id} className="kit-ab pet" title={ab.desc}>
                <AbilityIcon icon={ab.icon} ability={ab.id} school={ab.school} size={34} />
                <span className="kit-ab-name">Pet: {ab.name}</span>
                <span className={cx('badge', 'st-' + ((ab.forever && ab.forever.status) || 'approximation'))}>
                  {STATUS_SHORT[(ab.forever && ab.forever.status) || 'approximation']}
                </span>
              </div>
            ))}
          </div>
          {build.newSince && build.newSince.ids && build.newSince.ids.length > 0 && (
            <p className="muted small">Marked “new”: learned since level {build.newSince.from}.</p>
          )}
          <p className="muted small">
            Badges show where each ability comes from: Blizzard, guide sites, beta reports, Classic (unconfirmed for Forever) or our own approximation. Spell
            numbers are the datamined Forever ranks; your health, mana and power come from Classic rules and an estimated set of gear for this level.
          </p>
          <button type="button" className="btn primary big" onClick={() => onStart({ spec, role, race })} disabled={!!build.error}>
            Begin the trial
          </button>
        </section>
      </div>
    </div>
  );
}
