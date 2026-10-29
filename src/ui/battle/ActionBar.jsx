// Action bars: the player's abilities, consumables and (for Hunters) the pet bar.
import { AbilityIcon } from '../art/AbilityIcon.jsx';
import { abilityStatus, castTimeOf, cooldownOf, abilityCost } from '../../engine/core.js';
import { fmtCd, describeCost, STATUS_LABEL, STATUS_SHORT, cx } from '../util.js';
import FOREVER_RANKS from '../../../research/forever-ranks.json';

// The datamined Forever rank behind an ability at this level, if we recorded one.
function foreverRank(id, level) {
  const entry = FOREVER_RANKS.ranks[id];
  if (!entry) return null;
  return entry[level >= 45 ? 60 : level >= 20 ? 30 : 10] || null;
}

export function ActionButton({ state, u, id, hotkey, onUse, onHover, queued, flash, small }) {
  const st = abilityStatus(state, u, id);
  if (!st) return null;
  const { ab } = st;
  const cdLeft = Math.max(st.cd, st.gcd > 0 && (ab.gcd ?? 1.5) > 0 ? st.gcd : 0);
  const cdTot = st.cd > st.gcd ? st.cdTotal || st.cd : st.gcdTotal || 1.5;
  const sweep = cdLeft > 0 ? cdLeft / Math.max(0.01, cdTot) : 0;
  const unusable = !st.usable && !['range', 'minrange', 'los', 'notarget', 'gcd', 'cooldown', 'casting', 'moving'].includes(st.reason);
  return (
    <button
      type="button"
      className={cx('abtn', small && 'small', st.noRes && 'nores', st.outOfRange && 'oor', unusable && 'unusable', st.active && 'active', queued && 'queued', flash && 'flash', st.cd > 0 && 'oncd')}
      onClick={(e) => onUse(id, e)}
      onPointerEnter={() => onHover && onHover(id)}
      onPointerLeave={() => onHover && onHover(null)}
      onFocus={() => onHover && onHover(id)}
      onBlur={() => onHover && onHover(null)}
      aria-label={ab.name}
    >
      <AbilityIcon icon={ab.icon} ability={id} school={ab.school} size={small ? 36 : 46} />
      {sweep > 0 && <span className="abtn-cd" style={{ '--p': sweep }} />}
      {st.cd > 1.6 && <span className="abtn-cdt">{fmtCd(st.cd)}</span>}
      {hotkey && <kbd className="abtn-key">{hotkey}</kbd>}
    </button>
  );
}

export function AbilityTooltip({ state, u, id, petUnit }) {
  const owner = petUnit || u;
  const ab = owner && owner.ab[id];
  if (!ab) return <div className="tooltip empty" />;
  const ct = castTimeOf(owner, ab);
  const cd = cooldownOf(owner, ab);
  const cost = abilityCost(owner, ab);
  const range = ab.target === 'self' || ab.target === 'none' ? null : ab.range;
  const f = ab.forever || { status: 'approximation' };
  const rank = foreverRank(id, owner.level);
  return (
    <div className="tooltip">
      <div className="tt-head">
        <span className="tt-name">{ab.name}</span>
        {ab.rankLevel ? <span className="tt-rank">L{ab.rankLevel} rank</span> : null}
      </div>
      <div className="tt-meta">
        {describeCost(cost) && <span>{describeCost(cost)}</span>}
        {range ? <span>{ab.minRange ? `${ab.minRange}–${range}` : range} yd</span> : <span>Self</span>}
        <span>{ab.channel ? `Channeled ${ab.channel.duration}s` : ab.onNextSwing ? 'Next melee swing · press again to cancel' : ct > 0 ? `${ct.toFixed(1)}s cast` : 'Instant'}</span>
        {cd > 0 && <span>{cd >= 60 ? `${Math.round(cd / 60)} min` : `${Math.round(cd * 10) / 10}s`} cooldown</span>}
        {(ab.gcd ?? 1.5) === 0 && <span>Off GCD</span>}
      </div>
      <p className="tt-desc">{ab.desc}</p>
      <p className="tt-rankdata">Source scope: rank values may be datamined; power scaling, talent interactions and estimated gear are not thereby officially confirmed.</p>
      {rank && <p className="tt-rankdata">Forever {rank.rank ? `rank ${rank.rank}` : 'spell'} (learned at {rank.level}): {rank.text}</p>}
      <div className={cx('tt-status', 'st-' + f.status)}>
        <b>{STATUS_LABEL[f.status] || f.status}</b>
        {f.note ? ` — ${f.note}` : ''}
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  return <span className={cx('badge', 'st-' + status)}>{STATUS_SHORT[status] || status}</span>;
}

const PET_CMDS = [
  { cmd: 'attack', label: 'Attack', glyph: 'claw' },
  { cmd: 'follow', label: 'Follow', glyph: 'paw' },
  { cmd: 'stay', label: 'Stay', glyph: 'hourglass' },
];
const PET_MODES = [
  { cmd: 'aggressive', label: 'Aggressive' },
  { cmd: 'defensive', label: 'Defensive' },
  { cmd: 'passive', label: 'Passive' },
];

export function PetBar({ state, pet, bar, onCommand, onPetAbility, onToggleAuto, onHover }) {
  if (!pet) return null;
  return (
    <div className="petbar" aria-label="Pet controls">
      <div className="petbar-row">
        {PET_CMDS.map((c, i) => (
          <button type="button" key={c.cmd} className={cx('pbtn', pet.petCmd === c.cmd && 'on')} onClick={() => onCommand(c.cmd)} title={`${c.label} (Shift+${i + 1})`} disabled={!pet.alive}>
            <AbilityIcon icon={c.glyph} school="nature" size={32} />
            <span className="pbtn-label">{c.label}</span>
            <kbd className="abtn-key">⇧{i + 1}</kbd>
          </button>
        ))}
        {(bar || []).map((id, i) => {
          const ab = pet.ab[id];
          if (!ab) return null;
          const st = abilityStatus(state, pet, id);
          const sweep = st && st.cd > 0 ? st.cd / Math.max(0.01, st.cdTotal || st.cd) : 0;
          return (
            <span key={id} className="pbtn-wrap">
              <button
                type="button"
                className={cx('pbtn', pet.autocast[id] && 'auto', st && st.noRes && 'nores')}
                onClick={() => onPetAbility(id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onToggleAuto(id);
                }}
                onPointerEnter={() => onHover && onHover(id, true)}
                onPointerLeave={() => onHover && onHover(null)}
                disabled={!pet.alive}
                title={`${ab.name} — click to use, right-click or the A tab to toggle autocast (Shift+${PET_CMDS.length + i + 1})`}
              >
                <AbilityIcon icon={ab.icon} ability={id} school={ab.school} size={32} />
                {sweep > 0 && <span className="abtn-cd" style={{ '--p': sweep }} />}
                <kbd className="abtn-key">⇧{PET_CMDS.length + i + 1}</kbd>
              </button>
              <button type="button" className={cx('auto-tab', pet.autocast[id] && 'on')} onClick={() => onToggleAuto(id)} aria-label={`Toggle autocast for ${ab.name}`}>
                A
              </button>
            </span>
          );
        })}
      </div>
      <div className="petbar-modes" role="group" aria-label="Pet stance">
        {PET_MODES.map((m) => (
          <button type="button" key={m.cmd} className={cx('pmode', pet.petMode === m.cmd && 'on')} onClick={() => onCommand(m.cmd)} disabled={!pet.alive}>
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
