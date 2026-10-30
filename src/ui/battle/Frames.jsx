// Unit frames (player, pet, target, target-of-target), party and raid frames,
// aura rows and the player's cast bar.
import { Portrait } from '../art/Portrait.jsx';
import { AbilityIcon } from '../art/AbilityIcon.jsx';
import { RES_COLORS, DISPEL_COLORS, CLASS_COLORS, fmtCd, fmtNum, pct, auraIcon, cx } from '../util.js';
import { threatPctOn } from '../../engine/core.js';

const { memo } = React;
const MemoPortrait = memo(Portrait);

export function Bar({ value, max, color, label, right, className = '', overlay }) {
  const p = pct(value, max);
  return (
    <div className={cx('bar', className)}>
      <div className="bar-fill" style={{ width: `${p * 100}%`, background: color }} />
      {overlay ? <div className="bar-over" style={{ left: `${p * 100}%`, width: `${Math.min(1 - p, overlay) * 100}%` }} /> : null}
      <div className="bar-text">
        <span>{label}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}

export function AuraRow({ u, max = 10, filter, mineId, size = 22 }) {
  const list = u.auras.filter((a) => !a.def.hidden && (!filter || filter(a))).slice(0, max);
  if (!list.length) return null;
  return (
    <div className="auras">
      {list.map((a) => {
        const ic = auraIcon(a, u);
        const disp = a.def.debuff && a.def.dispel ? DISPEL_COLORS[a.def.dispel] : null;
        return (
          <div
            key={a.key}
            className={cx('aura', a.def.debuff ? 'debuff' : 'buff', mineId && a.srcId === mineId && 'mine')}
            style={disp ? { borderColor: disp } : undefined}
            title={(a.def.name || a.id) + (a.def.dispel ? ` (${a.def.dispel})` : '')}
          >
            <AbilityIcon icon={ic.icon} ability={ic.ability} aura={ic.aura} school={ic.school} size={size} />
            {!a.def.permanent && a.remaining < 60 && <span className="aura-t">{fmtCd(a.remaining)}</span>}
            {a.stacks > 1 && <span className="aura-s">{a.stacks}</span>}
          </div>
        );
      })}
    </div>
  );
}

function resColor(k) {
  return RES_COLORS[k] || '#888';
}

export function UnitFrame({ u, kind = 'player', state, kitColor, onClick, compact = false }) {
  if (!u)
    return (
      <div className={cx('uframe', 'uf-' + kind, 'empty')}>
        {kind === 'target' ? <span className="muted">No target — click an enemy or press Tab</span> : null}
      </div>
    );
  const res = u.primary && u.res[u.primary];
  const P = state.units[state.playerId];
  const shield = u.auras.reduce((s, a) => s + (a.absorbLeft || 0), 0);
  const cast = u.casting;
  const threat = kind === 'target' && u.side === 'enemy' && u.engaged && P ? threatPctOn(state, u, P) : null;
  const tot = kind === 'target' && u.target ? state.units[u.target] : null;
  const nameColor = u.side === 'enemy' ? '#ff8a6b' : u.kind === 'player' ? kitColor : CLASS_COLORS[u.classId] || '#cfe3ff';
  return (
    <div className={cx('uframe', 'uf-' + kind, !u.alive && 'dead', u.elite && 'elite', u.kind === 'boss' && 'boss')} onClick={onClick}>
      <div className="uf-portrait">
        <MemoPortrait id={u.portrait} size={compact ? 42 : 58} dead={!u.alive} />
        <span className="uf-level">{u.kind === 'boss' ? '??' : u.level}</span>
      </div>
      <div className="uf-main">
        <div className="uf-name" style={{ color: nameColor }}>
          {u.kind === 'player' ? u.meta.displayName || 'You' : u.name}
          {u.elite && <span className="elite-tag">Elite</span>}
        </div>
        <Bar
          value={u.hp}
          max={u.maxHp}
          color={u.side === 'enemy' ? 'linear-gradient(#d84a35,#9a2216)' : 'linear-gradient(#45c95a,#227a2f)'}
          label={u.alive ? `${fmtNum(u.hp)} / ${fmtNum(u.maxHp)}` : 'Dead'}
          right={u.alive ? Math.round((u.hp / u.maxHp) * 100) + '%' : ''}
          overlay={shield / u.maxHp}
          className="hp"
        />
        {res && (
          <Bar
            value={res.cur}
            max={res.max}
            color={resColor(u.primary)}
            label={`${fmtNum(res.cur)} / ${fmtNum(res.max)}`}
            right={u.classId === 'rogue' ? `energy · ${u.meta.cpTarget === u.target ? u.meta.cp || 0 : 0}/5 combo` : u.primary}
            className="res"
          />
        )}
        {cast && kind !== 'player' && (
          <div className={cx('uf-cast', (cast.ab.uninterruptible || cast.ab.mechanic === 'physical') && 'solid')}>
            <div
              className="uf-cast-fill"
              style={{ width: `${(cast.channel ? 1 - cast.elapsed / Math.max(0.01, cast.duration - cast.cut) : 1 - cast.remaining / cast.total) * 100}%` }}
            />
            <span>
              {cast.ab.name}
              {cast.ab.uninterruptible ? ' (can’t interrupt)' : ''}
            </span>
          </div>
        )}
        <AuraRow u={u} max={compact ? 6 : 12} mineId={P && P.id} size={compact ? 18 : 22} />
        {threat !== null && (
          <div className="uf-threat" title="Your threat relative to whoever this enemy is attacking. Above 110% in melee (130% at range) it turns on you.">
            Threat {Math.round(threat * 100)}%
          </div>
        )}
        {tot && tot.alive && (
          <div className="uf-tot">
            Target: <b>{tot.id === state.playerId ? 'You' : tot.name}</b>
          </div>
        )}
      </div>
    </div>
  );
}

export function PartyFrames({ state, onPick, onHoverMember, selectedId, kitColor, hotkeys = true }) {
  const members = state.list.filter((u) => u.side === 'player' && !u.hidden && (u.kind === 'ally' || u.kind === 'player' || u.kind === 'pet'));
  return (
    <div className="party">
      {members.map((u, i) => {
        const res = u.res.mana && (u.role === 'healer' || u.kind === 'player') ? u.res.mana : null;
        const debuffs = u.auras.filter((a) => a.def.debuff && !a.def.hidden);
        const disp = debuffs.find((a) => a.def.dispel);
        const shield = u.auras.reduce((s, a) => s + (a.absorbLeft || 0), 0);
        const col = u.kind === 'player' || u.kind === 'pet' ? kitColor : CLASS_COLORS[u.classId] || '#9fb7d8';
        const P = state.units[state.playerId];
        const aggro = state.list.some((e) => e.side === 'enemy' && e.alive && e.engaged && e.target === u.id);
        return (
          <button
            type="button"
            key={u.id}
            className={cx('pf', selectedId === u.id && 'sel', !u.alive && 'dead', aggro && u.role !== 'tank' && 'aggro', disp && 'dispellable')}
            onClick={() => onPick(u)}
            onMouseEnter={() => onHoverMember && onHoverMember(u.id)}
            onMouseLeave={() => onHoverMember && onHoverMember(null)}
            style={disp ? { '--disp': DISPEL_COLORS[disp.def.dispel] } : undefined}
          >
            <div className="pf-top">
              <span className="pf-name" style={{ color: col }}>
                {u.id === state.playerId ? 'You' : u.name}
              </span>
              <span className="pf-role">{u.role === 'tank' ? 'Tank' : u.role === 'healer' ? 'Healer' : u.kind === 'pet' ? 'Pet' : ''}</span>
              {hotkeys && i < 5 && <kbd className="pf-key">F{i + 1}</kbd>}
            </div>
            <div className="pf-hp">
              <div className="pf-hp-fill" style={{ width: `${pct(u.hp, u.maxHp) * 100}%` }} />
              {shield > 0 && (
                <div
                  className="pf-hp-shield"
                  style={{ left: `${pct(u.hp, u.maxHp) * 100}%`, width: `${Math.min(1 - pct(u.hp, u.maxHp), shield / u.maxHp) * 100}%` }}
                />
              )}
              <span className="pf-hp-text">{u.alive ? (u.hp >= u.maxHp ? fmtNum(u.hp) : '-' + fmtNum(u.maxHp - u.hp)) : 'Dead'}</span>
            </div>
            {res && (
              <div className="pf-mana">
                <div style={{ width: `${pct(res.cur, res.max) * 100}%` }} />
              </div>
            )}
            <div className="pf-debuffs">
              {debuffs.slice(0, 4).map((a) => {
                const ic = auraIcon(a, u);
                return (
                  <span key={a.key} className="pf-debuff" style={a.def.dispel ? { borderColor: DISPEL_COLORS[a.def.dispel] } : undefined}>
                    <AbilityIcon icon={ic.icon} ability={ic.ability} aura={ic.aura} school={ic.school} size={16} />
                  </span>
                );
              })}
              {u.auras
                .filter((a) => !a.def.debuff && P && a.srcId === P.id && u.id !== P.id)
                .slice(0, 3)
                .map((a) => {
                  const ic = auraIcon(a, u);
                  return (
                    <span key={a.key} className="pf-hot">
                      <AbilityIcon icon={ic.icon} ability={ic.ability} aura={ic.aura} school={ic.school} size={14} />
                    </span>
                  );
                })}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function RaidFrames({ state, onPick, onHoverMember, selectedId, kitColor }) {
  const members = state.list.filter((u) => u.side === 'player' && !u.hidden && (u.kind === 'ally' || u.kind === 'player'));
  return (
    <div className="raid">
      {members.map((u) => {
        const disp = u.auras.find((a) => a.def.debuff && a.def.dispel);
        const col = u.kind === 'player' ? kitColor : CLASS_COLORS[u.classId] || '#9fb7d8';
        return (
          <button
            type="button"
            key={u.id}
            className={cx('rf', selectedId === u.id && 'sel', !u.alive && 'dead', disp && 'dispellable')}
            style={disp ? { '--disp': DISPEL_COLORS[disp.def.dispel] } : undefined}
            onClick={() => onPick(u)}
            onMouseEnter={() => onHoverMember && onHoverMember(u.id)}
            onMouseLeave={() => onHoverMember && onHoverMember(null)}
            title={u.name}
          >
            <div className="rf-fill" style={{ height: `${pct(u.hp, u.maxHp) * 100}%`, background: col }} />
            <span className="rf-name">{u.id === state.playerId ? 'You' : u.name.split(' ')[0]}</span>
            {u.role === 'tank' && <span className="rf-role">T</span>}
          </button>
        );
      })}
    </div>
  );
}

export function PlayerCastBar({ u }) {
  const c = u && u.casting;
  if (!c) return <div className="castbar idle" />;
  const total = c.channel ? Math.max(0.01, c.duration - c.cut) : c.total;
  const done = c.channel ? c.elapsed : total - c.remaining;
  const p = Math.max(0, Math.min(1, c.channel ? 1 - done / total : done / total));
  return (
    <div className={cx('castbar', c.channel && 'channel')}>
      <div className="castbar-fill" style={{ width: `${p * 100}%` }} />
      <span className="castbar-name">{c.ab.name}</span>
      <span className="castbar-time">{Math.max(0, total - done).toFixed(1)}</span>
    </div>
  );
}
