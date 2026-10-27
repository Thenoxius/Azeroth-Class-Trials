// The battlefield: an SVG drawn in yards (viewBox = arena size), with an HTML
// overlay for crisp floating combat text and speech bubbles.
import { Portrait } from '../art/Portrait.jsx';
import { SCHOOL_HEX, unitColor, cx } from '../util.js';
import { FX_LIFE } from './fx.js';

const { memo, useRef, useCallback } = React;

const MemoPortrait = memo(Portrait);

const THEMES = {
  forest: { a: '#1f2a1b', b: '#121a10', speck: '#2e3d26', line: '#3b4a2c' },
  ruins: { a: '#2a2622', b: '#171412', speck: '#3a342d', line: '#4a4238' },
  crypt: { a: '#211c2a', b: '#120f18', speck: '#2f2840', line: '#3e3452' },
  basin: { a: '#26301d', b: '#151c10', speck: '#35422a', line: '#4c5a36' },
  molten: { a: '#2e1612', b: '#160907', speck: '#4a1e14', line: '#7a2a12' },
};

function schoolHex(s) {
  return SCHOOL_HEX[s] || '#e8dcc0';
}

function Obstacle({ o }) {
  const k = o.kind || 'rock';
  if (k === 'tree')
    return (
      <g transform={`translate(${o.x} ${o.y})`}>
        <ellipse cx="0.5" cy="0.6" rx={o.r * 1.15} ry={o.r * 0.9} fill="#000" opacity="0.35" />
        <circle r={o.r * 1.12} fill="#1d3a1c" />
        <circle cx={-o.r * 0.35} cy={-o.r * 0.3} r={o.r * 0.75} fill="#2a5226" />
        <circle cx={o.r * 0.3} cy={-o.r * 0.1} r={o.r * 0.62} fill="#336330" />
        <circle cx={-o.r * 0.1} cy={-o.r * 0.5} r={o.r * 0.38} fill="#4a7c3c" opacity="0.8" />
      </g>
    );
  if (k === 'pillar')
    return (
      <g transform={`translate(${o.x} ${o.y})`}>
        <ellipse cx="0.5" cy="0.7" rx={o.r * 1.1} ry={o.r * 0.85} fill="#000" opacity="0.4" />
        <circle r={o.r} fill="#5b5249" stroke="#2b2622" strokeWidth="0.25" />
        <circle r={o.r * 0.72} fill="#6f655a" />
        <circle cx={-o.r * 0.25} cy={-o.r * 0.25} r={o.r * 0.3} fill="#8a7f71" opacity="0.7" />
      </g>
    );
  if (k === 'crate')
    return (
      <g transform={`translate(${o.x} ${o.y})`}>
        <rect x={-o.r} y={-o.r} width={o.r * 2} height={o.r * 2} fill="#5a3e22" stroke="#2a1b0e" strokeWidth="0.2" />
        <path d={`M${-o.r} ${-o.r}L${o.r} ${o.r}M${o.r} ${-o.r}L${-o.r} ${o.r}`} stroke="#3a2714" strokeWidth="0.25" />
      </g>
    );
  if (k === 'lava')
    return (
      <g transform={`translate(${o.x} ${o.y})`}>
        <circle r={o.r} fill="#6a1a08" />
        <circle r={o.r * 0.8} fill="#c4410f" opacity="0.9" />
        <circle r={o.r * 0.45} fill="#ff9a3c" opacity="0.8" />
      </g>
    );
  return (
    <g transform={`translate(${o.x} ${o.y})`}>
      <ellipse cx="0.4" cy="0.6" rx={o.r * 1.1} ry={o.r * 0.8} fill="#000" opacity="0.35" />
      <path d={`M${-o.r} ${o.r * 0.2}Q${-o.r * 0.9} ${-o.r * 0.8} ${-o.r * 0.1} ${-o.r}Q${o.r * 0.9} ${-o.r * 0.9} ${o.r} ${-o.r * 0.1}Q${o.r * 0.9} ${o.r * 0.9} 0 ${o.r * 0.95}Q${-o.r * 0.8} ${o.r} ${-o.r} ${o.r * 0.2}Z`} fill="#4d4a44" stroke="#24221f" strokeWidth="0.2" />
      <path d={`M${-o.r * 0.5} ${-o.r * 0.4}Q0 ${-o.r * 0.8} ${o.r * 0.5} ${-o.r * 0.35}`} fill="none" stroke="#7b766c" strokeWidth="0.25" />
    </g>
  );
}

function Decor({ d }) {
  if (d.kind === 'grass') return <path d={`M${d.x} ${d.y}l-0.3 -0.8M${d.x} ${d.y}l0 -1M${d.x} ${d.y}l0.35 -0.75`} stroke="#4f6b38" strokeWidth="0.12" />;
  if (d.kind === 'road') return <path d={d.path} stroke="#3a3426" strokeWidth={d.w || 4} fill="none" strokeLinecap="round" opacity="0.8" />;
  if (d.kind === 'banner') return <g transform={`translate(${d.x} ${d.y})`}><rect x="-0.15" y="-2.4" width="0.3" height="2.6" fill="#3a2a1a" /><path d="M0.15 -2.4h1.6l-0.4 0.6 0.4 0.6h-1.6z" fill={d.color || '#8a1d1d'} /></g>;
  if (d.kind === 'rune') return <circle cx={d.x} cy={d.y} r={d.r || 2} fill="none" stroke={d.color || '#6b4bd6'} strokeWidth="0.15" strokeDasharray="0.6 0.4" opacity="0.6" />;
  if (d.kind === 'lavaCrack') return <path d={d.path} stroke="#ff6a1f" strokeWidth={d.w || 0.35} fill="none" opacity="0.55" />;
  if (d.kind === 'node') return <g transform={`translate(${d.x} ${d.y})`}><circle r="2.6" fill="none" stroke="#c9a35a" strokeWidth="0.2" opacity="0.7" /><path d="M0 -1.6l0.5 1.6h-1z" fill="#c9a35a" opacity="0.7" /></g>;
  if (d.kind === 'label') return <text x={d.x} y={d.y} className="bf-decor-label" fontSize={d.size || 0.9} textAnchor="middle">{d.text}</text>;
  return null;
}

function zonePath(z) {
  const s = z.shape;
  if (s.type === 'cone') {
    const a1 = s.dir - s.angle / 2;
    const a2 = s.dir + s.angle / 2;
    const p1 = [z.x + Math.cos(a1) * s.range, z.y + Math.sin(a1) * s.range];
    const p2 = [z.x + Math.cos(a2) * s.range, z.y + Math.sin(a2) * s.range];
    return `M${z.x} ${z.y}L${p1[0]} ${p1[1]}A${s.range} ${s.range} 0 ${s.angle > Math.PI ? 1 : 0} 1 ${p2[0]} ${p2[1]}Z`;
  }
  return null;
}

function Zone({ z, t }) {
  const col = schoolHex(z.visual === 'trap' ? 'frost' : z.visual === 'void' ? 'void' : z.visual);
  const s = z.shape;
  const tele = !z.armed;
  const prog = tele && z.telegraph ? Math.min(1, (t - z.bornAt) / z.telegraph) : 1;
  if (z.visual === 'trap')
    return (
      <g transform={`translate(${z.x} ${z.y})`} className="bf-trap">
        <circle r={s.r} fill={col} fillOpacity={z.armed ? 0.12 : 0.05} stroke={col} strokeWidth="0.15" strokeDasharray="0.5 0.35" />
        <path d="M-0.9 0.3l0.45 -0.8 0.45 0.8 0.45 -0.8 0.45 0.8" fill="none" stroke={col} strokeWidth="0.18" />
      </g>
    );
  if (z.harmless || z.side === 'player') {
    // Player-side ground effects (Blizzard, Volley, consecrated ground…) and pure visuals:
    // drawn calmly so they never read as danger.
    const f = { fill: col, fillOpacity: 0.13, stroke: col, strokeOpacity: 0.5, strokeWidth: 0.1, className: 'bf-zone friendly' };
    if (s.type === 'cone') return <path d={zonePath(z)} {...f} />;
    if (s.type === 'rect') return <rect x={z.x - s.w / 2} y={z.y - s.h / 2} width={s.w} height={s.h} {...f} />;
    return <circle cx={z.x} cy={z.y} r={s.r} {...f} />;
  }
  const common = { fill: col, fillOpacity: tele ? 0.08 + prog * 0.14 : 0.28, stroke: col, strokeOpacity: tele ? 0.9 : 0.5, strokeWidth: tele ? 0.18 : 0.12, strokeDasharray: tele ? '0.7 0.4' : undefined };
  if (s.type === 'cone') return <path d={zonePath(z)} {...common} className={cx('bf-zone', tele && 'tele')} />;
  if (s.type === 'rect') return <rect x={z.x - s.w / 2} y={z.y - s.h / 2} width={s.w} height={s.h} {...common} className={cx('bf-zone', tele && 'tele')} />;
  return (
    <g className={cx('bf-zone', tele && 'tele')}>
      <circle cx={z.x} cy={z.y} r={s.r} {...common} />
      {tele && <circle cx={z.x} cy={z.y} r={s.r * prog} fill={col} fillOpacity="0.16" />}
      {s.type === 'ring' && <circle cx={z.x} cy={z.y} r={s.inner} fill="#000" fillOpacity="0.35" />}
      {z.label && <text x={z.x} y={z.y + 0.35} textAnchor="middle" fontSize="0.9" className="bf-zone-label">{z.label}</text>}
    </g>
  );
}

// Visual token radius in yards: a little larger than the collision radius so
// portraits stay readable on a 60-yard field.
export function tokenR(u) {
  const base = Math.max(1.05, (u.radius || 0.8) * 1.45);
  return u.kind === 'pet' ? base * 0.85 : base;
}

function ccVisual(u) {
  let v = null;
  for (const a of u.auras) {
    const d = a.def;
    if (d.visual) { v = d.visual; if (d.visual === 'sheep' || d.visual === 'iceblock') return v; continue; }
    if (d.immune && !v) v = 'iceblock';
    else if (d.cc) {
      const c = Array.isArray(d.cc) ? d.cc : [d.cc];
      if (c.includes('stun') && !v) v = 'stun';
      else if (c.includes('fear') && !v) v = 'fear';
      else if (c.includes('incap') && !v) v = 'trap';
      else if (c.includes('root') && !v) v = d.frozen ? 'ice' : 'roots';
      else if (c.includes('silence') && !v) v = 'silence';
    }
  }
  return v;
}

function Token({ u, state, kitColor, isTarget, isPlayer, onPick, fxBubble }) {
  const r = tokenR(u);
  const ring = unitColor(u, kitColor);
  const hpP = Math.max(0, u.hp / u.maxHp);
  const shield = u.auras.reduce((s, a) => s + (a.absorbLeft || 0), 0);
  const vis = u.alive ? ccVisual(u) : null;
  const feigned = u.flags.feigned;
  const engaged = u.side === 'enemy' && u.engaged;
  const hpCol = u.side === 'enemy' ? (engaged ? '#d23a2a' : '#c9a23a') : '#36b34a';
  const nameSize = u.kind === 'boss' ? 1.15 : isTarget || u.elite ? 0.92 : 0.78;
  const barW = Math.max(3, r * 3.2);
  const c = u.casting;
  const castP = c ? (c.channel ? 1 - c.elapsed / Math.max(0.01, c.duration - c.cut) : 1 - c.remaining / c.total) : 0;
  const clipKey = 'tc' + Math.round(r * 100);
  return (
    <g transform={`translate(${u.x} ${u.y})`} className={cx('bf-unit', !u.alive && 'dead', feigned && 'feigned', u.evading && 'evading', isTarget && 'targeted')} onPointerDown={(e) => onPick(e, u)} style={{ cursor: 'pointer' }}>
      <ellipse cx="0.25" cy={r * 0.75} rx={r * 1.05} ry={r * 0.45} fill="#000" opacity="0.45" />
      {isTarget && <circle r={r + 0.55} fill="none" stroke={u.side === 'enemy' ? '#ffcf4a' : '#9fd0ff'} strokeWidth="0.2" strokeDasharray="0.8 0.45" className="bf-target-ring" />}
      {engaged && u.alive && <circle r={r + 0.25} fill="none" stroke="#ff4b2b" strokeOpacity="0.35" strokeWidth="0.5" />}
      <circle r={r + 0.12} fill="#0c0a0e" stroke={ring} strokeWidth={isPlayer ? 0.28 : 0.2} strokeDasharray={u.kind === 'pet' ? '0.5 0.25' : undefined} />
      <g clipPath={`url(#${clipKey})`} transform={feigned ? 'rotate(80)' : undefined} opacity={feigned ? 0.55 : 1}>
        {vis === 'sheep' ? (
          <g>
            <rect x={-r} y={-r} width={r * 2} height={r * 2} fill="#cfe9b0" />
            <ellipse cx="0" cy={r * 0.15} rx={r * 0.7} ry={r * 0.5} fill="#fff" />
            <circle cx={r * 0.55} cy={-r * 0.05} r={r * 0.28} fill="#3b3330" />
          </g>
        ) : (
          <MemoPortrait id={u.portrait} size={r * 2} x={-r} y={-r} dead={!u.alive} />
        )}
      </g>
      {isPlayer && u.alive && <path d={`M${Math.cos(u.facing) * (r + 0.15)} ${Math.sin(u.facing) * (r + 0.15)}L${Math.cos(u.facing + 0.35) * (r - 0.25)} ${Math.sin(u.facing + 0.35) * (r - 0.25)}L${Math.cos(u.facing - 0.35) * (r - 0.25)} ${Math.sin(u.facing - 0.35) * (r - 0.25)}Z`} fill={ring} />}
      {vis === 'ice' && <g className="bf-ice"><circle r={r + 0.3} fill="#9fe3ff" fillOpacity="0.22" stroke="#d9f6ff" strokeWidth="0.15" />{[0, 1, 2, 3, 4, 5].map((i) => <path key={i} d={`M${Math.cos(i) * r} ${Math.sin(i) * r}l${Math.cos(i) * 0.6} ${Math.sin(i) * 0.6}`} stroke="#e8fbff" strokeWidth="0.22" />)}</g>}
      {vis === 'roots' && <circle r={r + 0.25} fill="none" stroke="#7ed957" strokeWidth="0.3" strokeDasharray="0.3 0.2" />}
      {vis === 'iceblock' && <rect x={-r - 0.3} y={-r - 0.3} width={r * 2 + 0.6} height={r * 2 + 0.6} rx="0.3" fill="#bfefff" fillOpacity="0.45" stroke="#e8fbff" strokeWidth="0.15" />}
      {vis === 'trap' && <g><rect x={-r - 0.2} y={-r - 0.2} width={r * 2 + 0.4} height={r * 2 + 0.4} rx="0.2" fill="#9fe3ff" fillOpacity="0.38" stroke="#d9f6ff" strokeWidth="0.12" /><path d={`M${-r} ${-r}l${r * 0.6} ${r * 0.5}M${r} ${-r * 0.4}l${-r * 0.5} ${r * 0.3}`} stroke="#fff" strokeWidth="0.1" opacity="0.7" /></g>}
      {vis === 'fear' && <g className="bf-spin"><path d={`M0 ${-r - 0.6}a${r + 0.6} ${r + 0.6} 0 0 1 ${r + 0.6} ${r + 0.6}`} stroke="#b07bff" strokeWidth="0.22" fill="none" /><path d={`M0 ${r + 0.6}a${r + 0.6} ${r + 0.6} 0 0 1 ${-r - 0.6} ${-r - 0.6}`} stroke="#b07bff" strokeWidth="0.22" fill="none" /></g>}
      {vis === 'stun' && <g className="bf-spin">{[0, 2.1, 4.2].map((a) => <circle key={a} cx={Math.cos(a) * (r * 0.8)} cy={-r - 0.5 + Math.sin(a) * 0.25} r="0.22" fill="#ffe36b" />)}</g>}
      {vis === 'silence' && <path d={`M${-0.5} ${-r - 0.5}h1`} stroke="#ff6b6b" strokeWidth="0.25" />}
      {shield > 0 && u.alive && <circle r={r + 0.42} fill="#fff6c8" fillOpacity="0.1" stroke="#fff3b0" strokeOpacity="0.85" strokeWidth="0.14" className="bf-shield" />}
      {u.alive && (
        <g transform={`translate(0 ${-r - 0.75})`}>
          <rect x={-barW / 2 - 0.06} y="-0.06" width={barW + 0.12} height="0.47" rx="0.1" fill="#000" opacity="0.8" />
          <rect x={-barW / 2} y="0" width={barW * hpP} height="0.35" rx="0.08" fill={hpCol} />
          {shield > 0 && <rect x={-barW / 2 + barW * hpP} y="0" width={Math.min(barW * (1 - hpP), (barW * shield) / u.maxHp)} height="0.35" fill="#fff6c8" opacity="0.8" />}
        </g>
      )}
      <text y={-r - 1.05} textAnchor="middle" fontSize={nameSize} className={cx('bf-name', u.side === 'enemy' ? 'foe' : 'friend', isPlayer && 'me')}>
        {isPlayer ? '' : u.name}
        {u.elite && u.alive ? ' ◆' : ''}
      </text>
      {c && u.alive && (
        <g transform={`translate(0 ${r + 0.55})`}>
          <rect x={-barW / 2 - 0.06} y="-0.06" width={barW + 0.12} height="0.42" rx="0.1" fill="#000" opacity="0.85" />
          <rect x={-barW / 2} y="0" width={barW * Math.max(0, Math.min(1, c.channel ? castP : castP))} height="0.3" rx="0.06" fill={c.ab.uninterruptible || c.ab.mechanic === 'physical' ? '#9a9a9a' : c.channel ? '#7fe07f' : '#f0b43a'} />
        </g>
      )}
      {u.evading && <text y={r + 1.3} textAnchor="middle" fontSize="0.7" className="bf-evade">Evade</text>}
    </g>
  );
}

function Projectile({ p }) {
  const col = schoolHex(p.visual);
  if (p.visual === 'arrow' || p.visual === 'physical') {
    return <circle cx={p.x} cy={p.y} r="0.18" fill="#f2e6c8" className="bf-arrow" />;
  }
  return (
    <g>
      <circle cx={p.x} cy={p.y} r="0.75" fill={col} opacity="0.25" />
      <circle cx={p.x} cy={p.y} r="0.42" fill={col} />
      <circle cx={p.x - 0.1} cy={p.y - 0.1} r="0.18" fill="#fff" opacity="0.85" />
    </g>
  );
}

function Effect({ f, t }) {
  const k = Math.max(0, Math.min(1, (t - f.t0) / f.dur));
  const col = schoolHex(f.school);
  if (f.type === 'beam') return <line x1={f.x} y1={f.y} x2={f.x2} y2={f.y2} stroke={col} strokeWidth={0.35 * (1 - k) + 0.05} strokeLinecap="round" opacity={1 - k} />;
  if (f.type === 'ring') return <circle cx={f.x} cy={f.y} r={Math.max(0.1, f.r * (0.25 + 0.75 * k))} fill={col} fillOpacity={0.18 * (1 - k)} stroke={col} strokeWidth={0.35 * (1 - k)} opacity={1 - k * 0.6} />;
  if (f.type === 'puff') return <circle cx={f.x} cy={f.y} r={0.6 + k * 1.6} fill={col} opacity={0.5 * (1 - k)} />;
  if (f.type === 'flash') return <circle cx={f.x} cy={f.y} r={(f.r || 1) * (0.6 + k * 0.8)} fill={col} opacity={0.55 * (1 - k)} />;
  if (f.type === 'heal')
    return (
      <g opacity={1 - k}>
        {[-0.6, 0, 0.6].map((dx, i) => <circle key={i} cx={f.x + dx} cy={f.y - 0.2 - k * 2 - i * 0.3} r="0.16" fill="#ffe9a0" />)}
      </g>
    );
  return null;
}

export function Battlefield({ state, fx, kitColor, targeting, hoverRing, onGround, onUnit, onHover }) {
  const svgRef = useRef(null);
  const A = state.arena;
  const theme = THEMES[A.theme] || THEMES.forest;
  const P = state.units[state.playerId];
  const tid = P ? P.target : null;
  const t = state.t;
  const toWorld = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = svg.getScreenCTM();
    if (!m) return null;
    const w = pt.matrixTransform(m.inverse());
    return { x: w.x, y: w.y };
  }, []);
  const units = state.list.filter((u) => !u.hidden).sort((a, b) => (a.alive === b.alive ? a.y - b.y : a.alive ? 1 : -1));
  const radii = [...new Set(units.map((u) => Math.round(tokenR(u) * 100)))];
  const onPick = (e, u) => {
    e.stopPropagation();
    if (targeting) {
      const w = toWorld(e);
      if (w) onGround(w, e);
      return;
    }
    onUnit(u, e);
  };
  const handleDown = (e) => {
    const w = toWorld(e);
    if (w) onGround(w, e);
  };
  const handleMove = (e) => {
    if (!onHover) return;
    const w = toWorld(e);
    if (w) onHover(w);
  };
  const lines = [];
  for (const u of units) {
    if (u.side !== 'enemy' || !u.alive || !u.engaged || !u.target) continue;
    const tg = state.units[u.target];
    if (!tg || !tg.alive) continue;
    lines.push(<line key={'l' + u.id} x1={u.x} y1={u.y} x2={tg.x} y2={tg.y} stroke={tg.id === state.playerId ? '#ff5a3c' : '#ff9a6b'} strokeOpacity={tg.id === state.playerId ? 0.55 : 0.22} strokeWidth="0.12" strokeDasharray="0.5 0.35" />);
  }
  const floaters = fx.floaters;
  return (
    <div className={cx('bf', targeting && 'targeting')} style={{ aspectRatio: `${A.w} / ${A.h}`, '--ar': A.w / A.h }}>
      <svg ref={svgRef} viewBox={`0 0 ${A.w} ${A.h}`} className="bf-svg" onPointerDown={handleDown} onPointerMove={handleMove} onContextMenu={(e) => e.preventDefault()}>
        <defs>
          <radialGradient id="bf-ground" cx="45%" cy="40%" r="80%">
            <stop offset="0" stopColor={theme.a} />
            <stop offset="1" stopColor={theme.b} />
          </radialGradient>
          <pattern id={'bf-speck-' + (A.theme || 'forest')} width="3" height="3" patternUnits="userSpaceOnUse">
            <circle cx="0.6" cy="0.8" r="0.12" fill={theme.speck} />
            <circle cx="2.1" cy="2.2" r="0.09" fill={theme.speck} />
            <circle cx="2.4" cy="0.4" r="0.06" fill={theme.line} />
          </pattern>
          {radii.map((k) => (
            <clipPath key={k} id={'tc' + k} clipPathUnits="userSpaceOnUse">
              <circle r={k / 100} />
            </clipPath>
          ))}
        </defs>
        <rect width={A.w} height={A.h} fill="url(#bf-ground)" />
        <rect width={A.w} height={A.h} fill={`url(#bf-speck-${A.theme || 'forest'})`} />
        {(A.decor || []).map((d, i) => <Decor key={i} d={d} />)}
        {state.zones.map((z) => <Zone key={z.id} z={z} t={t} />)}
        {hoverRing && P && <circle cx={hoverRing.at === 'cursor' && hoverRing.x != null ? hoverRing.x : P.x} cy={hoverRing.at === 'cursor' && hoverRing.y != null ? hoverRing.y : P.y} r={hoverRing.r} fill={hoverRing.fill ? schoolHex(hoverRing.school) : 'none'} fillOpacity="0.08" stroke={schoolHex(hoverRing.school)} strokeOpacity="0.7" strokeWidth="0.12" strokeDasharray="0.6 0.4" pointerEvents="none" />}
        {hoverRing && hoverRing.min && P && <circle cx={P.x} cy={P.y} r={hoverRing.min} fill="#ff4040" fillOpacity="0.06" stroke="#ff7a7a" strokeOpacity="0.6" strokeWidth="0.1" pointerEvents="none" />}
        {lines}
        {(A.obstacles || []).map((o) => <Obstacle key={o.id} o={o} />)}
        {units.map((u) => (
          <Token key={u.id} u={u} state={state} kitColor={kitColor} isTarget={u.id === tid} isPlayer={u.id === state.playerId} onPick={onPick} />
        ))}
        {state.projectiles.map((p) => <Projectile key={p.id} p={p} />)}
        {fx.effects.map((f) => <Effect key={f.id} f={f} t={t} />)}
      </svg>
      <div className="bf-overlay" aria-hidden="true">
        {floaters.map((f) => {
          const k = Math.max(0, Math.min(1, (t - f.t0) / FX_LIFE.float));
          const left = (f.x / A.w) * 100;
          const top = (f.y / A.h) * 100;
          return (
            <div key={f.id} className={cx('float', 'f-' + f.kind, f.crit && 'crit')} style={{ left: `calc(${left}% + ${f.jitter * 10}px)`, top: `calc(${top}% - ${18 + k * 46}px)`, opacity: k > 0.7 ? (1 - k) / 0.3 : 1 }}>
              {f.text}
            </div>
          );
        })}
        {Object.entries(fx.bubbles).map(([id, b]) => {
          const u = state.units[id];
          if (!u || !u.alive) return null;
          return (
            <div key={id} className={cx('bubble', 'b-' + b.kind)} style={{ left: `${(u.x / A.w) * 100}%`, top: `${(u.y / A.h) * 100}%` }}>
              {b.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
