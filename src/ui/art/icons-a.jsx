// Original SVG art — see SPEC.md (Art). Mage and Hunter glyphs.
// 64×64 viewBox; c1 = highlight, c2 = school colour, c3 = deep shade.
// Same conventions as icons-b.jsx: dark outline, painterly gradient, highlight
// upper-left; gradient ids carry the school colour so they never collide.

const K = '#0a0710';
const hx = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) =>
  '#' +
  hx(a)
    .map((v, i) =>
      Math.round(v + (hx(b)[i] - v) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
const gid = (n, c) => n + '-' + c.slice(1);
const u = (id) => `url(#${id})`;
const star = (cx, cy, n, ro, ri, rot = -90) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 ? ri : ro;
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    return (cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1);
  }).join(' ');
const spiral = (cx, cy, turns, r0, r1, rot = 0) =>
  'M' +
  Array.from({ length: 49 }, (_, i) => {
    const t = i / 48;
    const a = (rot + t * turns * 360) * (Math.PI / 180);
    const r = r0 + (r1 - r0) * t;
    return (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1);
  }).join('L');

const Lin = ({ id, a, b, c, x1 = 0.15, y1 = 0.05, x2 = 0.85, y2 = 1, d = 0.6 }) => (
  <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
    <stop offset="0" stopColor={a} />
    <stop offset="0.5" stopColor={b} />
    <stop offset="1" stopColor={mix(b, c, d)} />
  </linearGradient>
);
const Rad = ({ id, a, b, c }) => (
  <radialGradient id={id} cx="0.38" cy="0.35" r="0.75">
    <stop offset="0" stopColor={a} />
    <stop offset="0.45" stopColor={b} />
    <stop offset="1" stopColor={mix(b, c, 0.7)} />
  </radialGradient>
);
const Glow = ({ id, c, o = 0.75 }) => (
  <radialGradient id={id}>
    <stop offset="0" stopColor={c} stopOpacity={o} />
    <stop offset="1" stopColor={c} stopOpacity="0" />
  </radialGradient>
);
const Sparkle = ({ x, y, r = 5, fill }) => (
  <path
    d={`M${x} ${y - r}L${x + r * 0.28} ${y - r * 0.28}L${x + r} ${y}L${x + r * 0.28} ${y + r * 0.28}L${x} ${y + r}L${x - r * 0.28} ${y + r * 0.28}L${x - r} ${y}L${x - r * 0.28} ${y - r * 0.28}Z`}
    fill={fill}
  />
);
// Arrow with its tip at (x, y), flying in direction a (degrees).
const Arrow = ({ x, y, a, l = 30, head, shaft, w = 2.4, fletch }) => (
  <g transform={`translate(${x} ${y}) rotate(${a})`} strokeLinejoin="round">
    <path d={`M-6 0H${-l}`} stroke={K} strokeWidth={w + 2.2} strokeLinecap="round" />
    <path d={`M-6 0H${-l}`} stroke={shaft} strokeWidth={w} strokeLinecap="round" />
    <path d={`M${-l + 9} 0L${-l + 1} -5H${-l - 3}L${-l + 3} 0L${-l - 3} 5H${-l + 1}Z`} fill={fletch || shaft} stroke={K} strokeWidth="1.2" />
    <path d="M1.5 0L-11 -5.5L-8 0L-11 5.5Z" fill={head} stroke={K} strokeWidth="1.4" />
  </g>
);
const Flame = ({ x, y, s = 1, outer, inner, r = 0 }) => (
  <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`} strokeLinejoin="round">
    <path
      d="M0 -24C3 -16 12 -12 12 0C12 8 7 13 0 13C-7 13 -12 8 -12 0C-12 -7 -7 -9 -6 -16C-3 -12 -3 -9 -2 -7C0 -12 -2 -18 0 -24Z"
      fill={outer}
      stroke={K}
      strokeWidth={1.6 / s}
    />
    <path d="M0 -6C2 -2 6 0 6 5C6 9 3 11 0 11C-3 11 -6 9 -6 5C-6 1 -3 0 -2 -3C-1 -2 -1 0 0 1C1 -2 0 -4 0 -6Z" fill={inner} />
  </g>
);
// Six-armed snowflake centred on (x, y).
const Flake = ({ x = 32, y = 32, r = 22, stroke, w = 3 }) => {
  const arms = [0, 60, 120, 180, 240, 300];
  const d = arms
    .map((a) => {
      const R = (a * Math.PI) / 180;
      const p = (t, off = 0) => {
        const rr = r * t;
        const aa = R + off;
        return `${(x + rr * Math.cos(aa)).toFixed(1)} ${(y + rr * Math.sin(aa)).toFixed(1)}`;
      };
      return `M${x} ${y}L${p(1)}M${p(0.55)}L${p(0.78, 0.38)}M${p(0.55)}L${p(0.78, -0.38)}M${p(0.8)}L${p(0.95, 0.25)}M${p(0.8)}L${p(0.95, -0.25)}`;
    })
    .join('');
  return (
    <g strokeLinecap="round" fill="none">
      <path d={d} stroke={K} strokeWidth={w + 2.4} />
      <path d={d} stroke={stroke} strokeWidth={w} />
    </g>
  );
};
// Hunter trap: iron jaws seen from above, open, with teeth.
const TrapJaws = ({ fill, y = 40 }) => (
  <g stroke={K} strokeLinejoin="round">
    <ellipse cx="32" cy={y + 2} rx="25" ry="9" fill="#000" fillOpacity="0.45" stroke="none" />
    <path d={`M9 ${y}C9 ${y - 12} 55 ${y - 12} 55 ${y}`} fill="none" stroke={K} strokeWidth="6" />
    <path d={`M9 ${y}C9 ${y - 12} 55 ${y - 12} 55 ${y}`} fill="none" stroke={fill} strokeWidth="3.4" />
    <path d={`M9 ${y}C9 ${y + 11} 55 ${y + 11} 55 ${y}`} fill="none" stroke={K} strokeWidth="6" />
    <path d={`M9 ${y}C9 ${y + 11} 55 ${y + 11} 55 ${y}`} fill="none" stroke={fill} strokeWidth="3.4" />
    <path d={`M15 ${y - 6}l3 5 2-6 3 6 2-7 3 7 2-7 2 7 3-7 2 7 3-6 2 6 3-5`} fill="none" stroke="#e8e2d6" strokeWidth="1.4" />
    <path d={`M15 ${y + 6}l3 -5 2 6 3 -6 2 7 3 -7 2 7 2 -7 3 7 2 -7 3 6 2 -6 3 5`} fill="none" stroke="#e8e2d6" strokeWidth="1.4" />
    <circle cx="32" cy={y} r="4.2" fill="#6b5a46" strokeWidth="1.4" />
    <circle cx="9" cy={y} r="2.6" fill="#8a7a63" strokeWidth="1.2" />
    <circle cx="55" cy={y} r="2.6" fill="#8a7a63" strokeWidth="1.2" />
  </g>
);
// Animal heads for the aspects, drawn facing left-ish.
const Eye = ({ x, y, r = 2.6, c = '#fff8d8' }) => (
  <g>
    <circle cx={x} cy={y} r={r + 0.9} fill={K} />
    <circle cx={x} cy={y} r={r} fill={c} />
    <circle cx={x - r * 0.3} cy={y} r={r * 0.45} fill={K} />
  </g>
);

export const GLYPHS_A = {
  // ---------------------------------------------------------------- mage: bolts & fire
  bolt: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('bolt-f', c2);
      const g = gid('bolt-g', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Rad id={f} a={c1} b={c2} c={c3} />
            <Glow id={g} c={c2} />
          </defs>
          <path d="M9 9L33 26L27 30L50 50L26 37L31 33Z" fill={c2} fillOpacity="0.35" />
          <path d="M8 8C18 14 26 20 33 28" stroke={c1} strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" />
          <path d="M13 17C21 22 27 26 33 31" stroke={c2} strokeOpacity="0.7" strokeWidth="2" strokeLinecap="round" />
          <circle cx="40" cy="39" r="17" fill={u(g)} />
          <circle cx="40" cy="39" r="11.5" fill={u(f)} stroke={K} strokeWidth="1.7" />
          <path d="M34 34a7 7 0 0 1 7-4" stroke="#fff" strokeOpacity="0.85" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
      );
    },
  },
  'bolt-frost': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('bf-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path d="M6 12L24 22M8 22L22 27M14 6L26 18" stroke={c1} strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" />
          <path d="M20 20L45 31L58 51L36 44Z" fill={u(f)} stroke={K} strokeWidth="1.8" />
          <path d="M20 20L58 51M45 31L36 44" stroke={K} strokeOpacity="0.45" strokeWidth="1.2" />
          <path d="M24 23L43 32" stroke="#fff" strokeOpacity="0.8" strokeWidth="1.6" strokeLinecap="round" />
          <Sparkle x={14} y={34} r={4} fill={c1} />
          <Sparkle x={50} y={17} r={3} fill={c1} />
        </g>
      );
    },
  },
  fireball: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('fb-f', c2);
      const g = gid('fb-g', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Rad id={f} a={c1} b={c2} c={c3} />
            <Glow id={g} c={c2} />
          </defs>
          <path d="M6 10C14 14 20 13 27 20C22 18 18 19 15 21C21 22 25 24 29 29C24 28 20 30 18 33C23 32 28 34 33 38Z" fill={c2} stroke={K} strokeWidth="1.5" />
          <path d="M11 16C17 18 21 19 26 23M15 27C20 27 24 29 28 33" fill="none" stroke={c1} strokeOpacity="0.75" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="40" cy="40" r="19" fill={u(g)} />
          <circle cx="40" cy="40" r="13" fill={u(f)} stroke={K} strokeWidth="1.8" />
          <path d="M32 37a9 9 0 0 1 8-7" stroke="#fff" strokeOpacity="0.9" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        </g>
      );
    },
  },
  flame: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('fl-f', c2);
      return (
        <g>
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} x1={0.5} y1={0} x2={0.5} y2={1} />
          </defs>
          <ellipse cx="32" cy="52" rx="16" ry="4" fill="#000" fillOpacity="0.5" />
          <Flame x={32} y={38} s={1.55} outer={u(f)} inner={c1} />
        </g>
      );
    },
  },
  flamestrike: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('fs-f', c2);
      const g = gid('fs-g', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} x1={0.5} y1={0} x2={0.5} y2={1} />
            <Glow id={g} c={c2} o={0.9} />
          </defs>
          <path d="M26 2H38L36 44H28Z" fill={c1} fillOpacity="0.55" />
          <path d="M29 2H35L34 44H30Z" fill="#fff" fillOpacity="0.6" />
          <ellipse cx="32" cy="50" rx="27" ry="10" fill={u(g)} />
          <ellipse cx="32" cy="50" rx="21" ry="6.5" fill="none" stroke={c1} strokeWidth="1.6" strokeDasharray="3 2.5" />
          <Flame x={18} y={50} s={0.65} outer={u(f)} inner={c1} />
          <Flame x={46} y={50} s={0.65} outer={u(f)} inner={c1} />
          <Flame x={32} y={50} s={0.95} outer={u(f)} inner={c1} />
        </g>
      );
    },
  },
  pyro: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('py-f', c2);
      const g = gid('py-g', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Rad id={f} a="#ffffff" b={c1} c={c2} />
            <Glow id={g} c={c2} o={0.95} />
          </defs>
          <circle cx="32" cy="32" r="30" fill={u(g)} />
          <polygon points={star(32, 32, 12, 28, 15)} fill={c2} stroke={K} strokeWidth="1.5" />
          <polygon points={star(32, 32, 12, 20, 12, -75)} fill={c1} fillOpacity="0.9" />
          <circle cx="32" cy="32" r="11" fill={u(f)} stroke={K} strokeWidth="1.6" />
        </g>
      );
    },
  },
  scorch: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('sc-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path
            d="M8 46C14 38 22 42 28 36C34 30 30 22 38 18C44 15 50 20 56 16C52 26 58 34 50 40C42 46 44 52 34 56C24 60 14 54 8 46Z"
            fill="#1a0c08"
            stroke={K}
            strokeWidth="1.6"
          />
          <path d="M16 46C22 42 26 46 31 41C36 36 34 30 40 27C44 25 47 28 50 26" fill="none" stroke={u(f)} strokeWidth="3.2" strokeLinecap="round" />
          <path d="M22 51L30 47M35 46L44 38" fill="none" stroke={c2} strokeWidth="2" strokeLinecap="round" />
          <Flame x={42} y={30} s={0.7} outer={u(f)} inner={c1} />
          <Flame x={22} y={44} s={0.55} outer={u(f)} inner={c1} r={-12} />
        </g>
      );
    },
  },
  meteor: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('me-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path d="M4 6L34 30L28 36Z" fill={c2} fillOpacity="0.55" />
          <path d="M10 4L38 27M4 14L30 35" stroke={c1} strokeOpacity="0.7" strokeWidth="2" strokeLinecap="round" />
          <path d="M30 32L40 24L52 28L56 40L48 52L36 52L28 44Z" fill="#4a3628" stroke={K} strokeWidth="1.8" />
          <path d="M36 30L46 30L50 38M34 44L42 46" fill="none" stroke={u(f)} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M40 25L50 29" stroke="#fff" strokeOpacity="0.4" strokeWidth="1.4" />
        </g>
      );
    },
  },
  // ---------------------------------------------------------------- mage: frost
  snowflake: {
    draw: ({ c1, c2 }) => (
      <g>
        <circle cx="32" cy="32" r="26" fill={c2} fillOpacity="0.12" />
        <Flake r={24} stroke={c1} w={3.2} />
        <circle cx="32" cy="32" r="3.4" fill={c2} stroke={K} strokeWidth="1.2" />
      </g>
    ),
  },
  nova: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('nv-f', c2);
      const shard = 'M0 -9L3 0L0 4L-3 0Z';
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <circle cx="32" cy="32" r="22" fill="none" stroke={c2} strokeOpacity="0.35" strokeWidth="9" />
          <circle cx="32" cy="32" r="22" fill="none" stroke={c1} strokeWidth="1.6" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <g key={a} transform={`rotate(${a} 32 32) translate(32 9) scale(1.25)`}>
              <path d={shard} fill={u(f)} stroke={K} strokeWidth="1.1" />
            </g>
          ))}
          <circle cx="32" cy="32" r="6" fill={c1} stroke={K} strokeWidth="1.4" />
        </g>
      );
    },
  },
  'cone-cold': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('cc-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} x1={0} y1={0.5} x2={1} y2={0.5} />
          </defs>
          <path d="M6 32L58 8Q64 32 58 56Z" fill={u(f)} fillOpacity="0.85" stroke={K} strokeWidth="1.7" />
          <path d="M6 32L58 20M6 32L60 32M6 32L58 44" stroke="#fff" strokeOpacity="0.45" strokeWidth="1.2" />
          <Sparkle x={40} y={22} r={3.5} fill="#fff" />
          <Sparkle x={48} y={38} r={4} fill="#fff" />
          <Sparkle x={30} y={33} r={2.6} fill="#fff" />
          <circle cx="7" cy="32" r="4" fill={c1} stroke={K} strokeWidth="1.3" />
        </g>
      );
    },
  },
  blizzard: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('bz-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path
            d="M12 24C8 24 6 20 8 17C9 14 13 13 15 14C16 9 22 6 27 8C30 4 38 4 41 9C46 7 52 10 52 15C56 15 58 19 56 22C55 25 52 26 50 26H14Z"
            fill={u(f)}
            stroke={K}
            strokeWidth="1.7"
          />
          <path d="M14 15C17 13 20 13 22 15" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.4" strokeLinecap="round" />
          {[
            [16, 31],
            [27, 35],
            [38, 31],
            [49, 36],
            [21, 46],
            [33, 50],
            [45, 48],
          ].map(([x, y], i) => (
            <path key={i} d={`M${x} ${y}l-3 9l2 0l-1 4`} fill="none" stroke={K} strokeWidth="3.4" strokeLinecap="round" />
          ))}
          {[
            [16, 31],
            [27, 35],
            [38, 31],
            [49, 36],
            [21, 46],
            [33, 50],
            [45, 48],
          ].map(([x, y], i) => (
            <path key={'s' + i} d={`M${x} ${y}l-3 9l2 0l-1 4`} fill="none" stroke={c1} strokeWidth="1.8" strokeLinecap="round" />
          ))}
        </g>
      );
    },
  },
  'ice-block': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('ib-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path d="M32 6L56 18V46L32 58L8 46V18Z" fill={u(f)} fillOpacity="0.9" stroke={K} strokeWidth="1.8" />
          <path d="M8 18L32 30L56 18M32 30V58" fill="none" stroke={K} strokeOpacity="0.55" strokeWidth="1.4" />
          <path d="M32 6L56 18L32 30L8 18Z" fill="#fff" fillOpacity="0.3" />
          <path d="M26 33a4.5 4.5 0 1 0 0.1 0M22 40C22 45 30 45 30 40V48H22Z" fill={K} fillOpacity="0.45" />
          <path d="M12 22L12 40M15 24V31" stroke="#fff" strokeOpacity="0.75" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    },
  },
  'ice-barrier': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('ibr-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path d="M32 5L52 13V31C52 44 43 53 32 59C21 53 12 44 12 31V13Z" fill={u(f)} fillOpacity="0.85" stroke={K} strokeWidth="1.8" />
          <path d="M32 5V59M12 13L32 27L52 13M15 42L32 27L49 42" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="1.3" />
          <path d="M18 17L18 32" stroke="#fff" strokeOpacity="0.8" strokeWidth="2" strokeLinecap="round" />
          <Flake x={32} y={31} r={8} stroke={c1} w={1.8} />
        </g>
      );
    },
  },
  'ice-lance': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('il-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path d="M58 6L44 26L12 54L8 56L10 52L38 20Z" fill={u(f)} stroke={K} strokeWidth="1.8" />
          <path d="M58 6L40 22M58 6L42 24" stroke="#fff" strokeOpacity="0.75" strokeWidth="1.4" />
          <path d="M22 40L16 36M28 34L24 30M30 38L34 42M24 44L28 48" stroke={K} strokeWidth="3.6" strokeLinecap="round" />
          <path d="M22 40L16 36M28 34L24 30M30 38L34 42M24 44L28 48" stroke={c1} strokeWidth="1.8" strokeLinecap="round" />
          <Sparkle x={54} y={16} r={3} fill="#fff" />
        </g>
      );
    },
  },
  frostfire: {
    draw: ({ c1, c2 }) => {
      const fi = 'ff-fire';
      const fr = 'ff-frost';
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={fi} a="#ffe3a3" b="#ff7a2f" c="#6e1a04" />
            <Lin id={fr} a="#effbff" b="#7fd4ff" c="#173f66" />
          </defs>
          <path
            d="M6 8C14 13 19 13 25 19C20 18 17 20 15 22C20 23 24 26 27 30C23 30 20 32 19 35"
            fill="none"
            stroke="#ff7a2f"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="M8 20L26 30M4 30L20 36" stroke="#7fd4ff" strokeWidth="2" strokeLinecap="round" />
          <circle cx="40" cy="40" r="15" fill="#7fd4ff" fillOpacity="0.25" />
          <path d="M40 25A15 15 0 0 0 40 55Z" fill={u(fi)} stroke={K} strokeWidth="1.7" />
          <path d="M40 25A15 15 0 0 1 40 55Z" fill={u(fr)} stroke={K} strokeWidth="1.7" />
          <path d="M44 31L50 37M46 43L52 41" stroke="#fff" strokeOpacity="0.8" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M34 34C35 37 33 39 34 42" stroke="#ffe3a3" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <Sparkle x={c1 ? 52 : 52} y={22} r={3} fill={c2 ? '#fff' : '#fff'} />
        </g>
      );
    },
  },
  // ---------------------------------------------------------------- mage: arcane
  missiles: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('mi-f', c2);
      const g = gid('mi-g', c2);
      const orb = (x, y, r) => (
        <g key={x}>
          <path
            d={`M${x - r * 3.2} ${y - r * 2.6}Q${x - r * 1.4} ${y - r * 0.6} ${x} ${y}`}
            fill="none"
            stroke={c1}
            strokeOpacity="0.6"
            strokeWidth={r * 0.8}
            strokeLinecap="round"
          />
          <circle cx={x} cy={y} r={r * 1.9} fill={u(g)} />
          <circle cx={x} cy={y} r={r} fill={u(f)} stroke={K} strokeWidth="1.3" />
        </g>
      );
      return (
        <g>
          <defs>
            <Rad id={f} a="#ffffff" b={c1} c={c2} />
            <Glow id={g} c={c2} />
          </defs>
          {orb(26, 20, 5)}
          {orb(48, 30, 6)}
          {orb(32, 48, 7)}
        </g>
      );
    },
  },
  'arcane-blast': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('ab-f', c2);
      const g = gid('ab-g', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Rad id={f} a="#ffffff" b={c1} c={c2} />
            <Glow id={g} c={c2} o={0.9} />
          </defs>
          <circle cx="32" cy="32" r="29" fill={u(g)} />
          <circle cx="32" cy="32" r="23" fill="none" stroke={c1} strokeWidth="1.4" strokeDasharray="2 3.5" />
          <polygon points={star(32, 32, 4, 27, 6)} fill={c2} stroke={K} strokeWidth="1.4" />
          <polygon points={star(32, 32, 4, 17, 5, -45)} fill={c1} stroke={K} strokeWidth="1.2" />
          <circle cx="32" cy="32" r="7" fill={u(f)} stroke={K} strokeWidth="1.4" />
        </g>
      );
    },
  },
  'arcane-explosion': {
    draw: ({ c1, c2 }) => (
      <g strokeLinejoin="round">
        <circle cx="32" cy="32" r="27" fill="none" stroke={c2} strokeOpacity="0.3" strokeWidth="6" />
        <circle cx="32" cy="32" r="27" fill="none" stroke={c1} strokeWidth="1.6" />
        <circle cx="32" cy="32" r="18" fill="none" stroke={c2} strokeOpacity="0.5" strokeWidth="5" />
        <circle cx="32" cy="32" r="18" fill="none" stroke={c1} strokeWidth="1.3" strokeDasharray="5 3" />
        <polygon points={star(32, 32, 8, 11, 4)} fill={c1} stroke={K} strokeWidth="1.3" />
        <Sparkle x={12} y={14} r={3.2} fill={c1} />
        <Sparkle x={52} y={50} r={3.2} fill={c1} />
        <Sparkle x={53} y={12} r={2.4} fill={c1} />
      </g>
    ),
  },
  blink: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('bl-f', c2);
      const fig = 'M0 -14a4.5 4.5 0 1 1 0.1 0ZM-6 -6H6L8 10H3L2 22H-2L-3 10H-8Z';
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <g transform="translate(18 30)" opacity="0.35">
            <path d={fig} fill={c2} />
          </g>
          <g transform="translate(28 30)" opacity="0.55">
            <path d={fig} fill={c2} />
          </g>
          <g transform="translate(44 30)">
            <path d={fig} fill={u(f)} stroke={K} strokeWidth="1.5" />
          </g>
          <path d="M8 46H32" stroke={c1} strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />
          <Sparkle x={54} y={16} r={4} fill={c1} />
          <Sparkle x={10} y={18} r={2.6} fill={c1} />
        </g>
      );
    },
  },
  sheep: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('sh-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a="#ffffff" b={mix('#ffffff', c2, 0.35)} c={c3} d={0.4} />
          </defs>
          <path d="M24 46V54M30 47V55M40 47V55M46 46V54" stroke={K} strokeWidth="4" strokeLinecap="round" />
          <path
            d="M18 34C14 30 16 24 21 24C22 18 30 16 34 20C38 16 46 18 47 24C52 24 54 30 51 34C54 38 51 44 46 43C44 48 36 49 34 46C30 49 22 48 21 43C16 44 14 38 18 34Z"
            fill={u(f)}
            stroke={K}
            strokeWidth="1.7"
          />
          <path d="M10 30C8 26 11 22 15 22C19 22 22 26 21 31C20 35 17 37 14 36C11 35 10 33 10 30Z" fill="#3a3040" stroke={K} strokeWidth="1.5" />
          <path d="M14 22C12 18 9 19 8 21M18 23C19 19 22 19 23 21" fill="none" stroke="#3a3040" strokeWidth="3" strokeLinecap="round" />
          <circle cx="14" cy="28" r="1.4" fill="#fff" />
          <Sparkle x={52} y={14} r={4} fill={c2} />
          <Sparkle x={40} y={10} r={2.5} fill={c2} />
        </g>
      );
    },
  },
  counterspell: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('cs-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path d="M20 14C26 22 22 30 30 34C36 37 40 34 44 40" fill="none" stroke={c2} strokeOpacity="0.55" strokeWidth="5" strokeLinecap="round" />
          <polygon points={star(32, 32, 6, 9, 4)} fill={c1} fillOpacity="0.85" />
          <circle cx="32" cy="32" r="23" fill="none" stroke={K} strokeWidth="8" />
          <circle cx="32" cy="32" r="23" fill="none" stroke={u(f)} strokeWidth="5" />
          <path d="M16 16L48 48" stroke={K} strokeWidth="8" strokeLinecap="round" />
          <path d="M16 16L48 48" stroke={u(f)} strokeWidth="5" strokeLinecap="round" />
        </g>
      );
    },
  },
  evocation: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('ev-f', c2);
      const sp = spiral(32, 34, 2.4, 4, 25, 30);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Rad id={f} a="#ffffff" b={c1} c={c2} />
          </defs>
          <path d={sp} fill="none" stroke={K} strokeWidth="5" strokeLinecap="round" />
          <path d={sp} fill="none" stroke={c2} strokeWidth="3" strokeLinecap="round" />
          <path d={sp} fill="none" stroke={c1} strokeOpacity="0.7" strokeWidth="1" strokeLinecap="round" />
          <circle cx="32" cy="34" r="7" fill={u(f)} stroke={K} strokeWidth="1.5" />
          <Sparkle x={50} y={12} r={4} fill={c1} />
          <Sparkle x={12} y={52} r={3} fill={c1} />
        </g>
      );
    },
  },
  'mana-gem': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('mg-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path d="M18 10H46L58 26L32 58L6 26Z" fill={u(f)} stroke={K} strokeWidth="1.8" />
          <path d="M6 26H58M18 10L24 26L32 58L40 26L46 10M24 26L32 10L40 26" fill="none" stroke={K} strokeOpacity="0.5" strokeWidth="1.2" />
          <path d="M18 10L24 26H6Z" fill="#fff" fillOpacity="0.35" />
          <path d="M13 22L18 14" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
          <Sparkle x={50} y={44} r={3.5} fill={c1} />
        </g>
      );
    },
  },
  'mana-shield': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('ms-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Rad id={f} a={mix(c1, c2, 0.2)} b={c2} c={c3} />
          </defs>
          <circle cx="32" cy="32" r="26" fill={u(f)} fillOpacity="0.55" stroke={K} strokeWidth="1.8" />
          <circle cx="32" cy="32" r="26" fill="none" stroke={c1} strokeWidth="1.2" strokeOpacity="0.8" />
          <path d="M32 18L44 32L32 46L20 32Z" fill={c1} fillOpacity="0.85" stroke={K} strokeWidth="1.4" />
          <path d="M32 18V46M20 32H44" stroke={K} strokeOpacity="0.4" strokeWidth="1" />
          <path d="M15 22A20 20 0 0 1 28 11" fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="2.2" strokeLinecap="round" />
        </g>
      );
    },
  },
  teleport: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('tp-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} x1={0.5} y1={0} x2={0.5} y2={1} />
          </defs>
          <path d="M20 4H44L40 48H24Z" fill={c1} fillOpacity="0.35" />
          <path d="M27 4H37L35 48H29Z" fill="#fff" fillOpacity="0.55" />
          <ellipse cx="32" cy="50" rx="25" ry="9" fill="none" stroke={K} strokeWidth="5" />
          <ellipse cx="32" cy="50" rx="25" ry="9" fill="none" stroke={u(f)} strokeWidth="3" />
          <ellipse cx="32" cy="50" rx="16" ry="5" fill="none" stroke={c1} strokeWidth="1.3" strokeDasharray="3 2" />
          <Sparkle x={14} y={24} r={3} fill={c1} />
          <Sparkle x={50} y={18} r={4} fill={c1} />
        </g>
      );
    },
  },
  portal: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('po-f', c2);
      const sp = spiral(32, 33, 2, 2, 15, 200);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Rad id={f} a={c1} b={c2} c={c3} />
          </defs>
          <ellipse cx="32" cy="33" rx="20" ry="26" fill={u(f)} stroke={K} strokeWidth="1.8" />
          <path d={sp} fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.6" strokeLinecap="round" />
          <ellipse cx="32" cy="33" rx="20" ry="26" fill="none" stroke="#8a7a63" strokeWidth="5" />
          <ellipse cx="32" cy="33" rx="20" ry="26" fill="none" stroke={K} strokeWidth="1.2" />
          <path d="M16 12L20 16M48 12L44 16M14 54L18 50M50 54L46 50" stroke="#8a7a63" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    },
  },
  intellect: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('in-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path d="M6 46C16 42 26 42 32 48C38 42 48 42 58 46V20C48 16 38 16 32 22C26 16 16 16 6 20Z" fill="#e9dfc8" stroke={K} strokeWidth="1.8" />
          <path d="M32 22V48" stroke={K} strokeWidth="1.4" />
          <path
            d="M11 26C17 24 22 24 27 27M11 32C17 30 22 30 27 33M37 27C42 24 47 24 53 26M37 33C42 30 47 30 53 32"
            fill="none"
            stroke="#9a8a6e"
            strokeWidth="1.2"
          />
          <polygon points={star(32, 14, 5, 10, 4)} fill={u(f)} stroke={K} strokeWidth="1.3" />
          <Sparkle x={48} y={10} r={3} fill={c1} />
          <Sparkle x={16} y={9} r={2.4} fill={c1} />
        </g>
      );
    },
  },
  // ---------------------------------------------------------------- hunter: shots
  arrow: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('ar-f', c2);
      return (
        <g>
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path d="M8 56L20 44" stroke={c1} strokeOpacity="0.4" strokeWidth="2" strokeLinecap="round" />
          <Arrow x={56} y={8} a={-45} l={54} head={u(f)} shaft="#b88a55" fletch={c2} w={3} />
        </g>
      );
    },
  },
  arrows: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('ars-f', c2);
      return (
        <g>
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <Arrow x={56} y={8} a={-45} l={52} head={u(f)} shaft="#b88a55" fletch={c2} />
          <Arrow x={8} y={8} a={-135} l={52} head={u(f)} shaft="#a07a4a" fletch={c2} />
        </g>
      );
    },
  },
  multishot: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('mu-f', c2);
      return (
        <g>
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <Arrow x={58} y={14} a={-25} l={46} head={u(f)} shaft="#b88a55" fletch={c2} />
          <Arrow x={56} y={34} a={-2} l={46} head={u(f)} shaft="#b88a55" fletch={c2} />
          <Arrow x={50} y={54} a={22} l={42} head={u(f)} shaft="#b88a55" fletch={c2} />
          <circle cx="9" cy="36" r="3" fill={c1} />
        </g>
      );
    },
  },
  aimed: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('am-f', c2);
      return (
        <g strokeLinecap="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <circle cx="40" cy="24" r="16" fill="none" stroke={K} strokeWidth="4.5" />
          <circle cx="40" cy="24" r="16" fill="none" stroke={c1} strokeWidth="2.2" />
          <circle cx="40" cy="24" r="7" fill="none" stroke={c2} strokeWidth="2" />
          <path d="M40 4V14M40 34V44M20 24H30M50 24H60" stroke={K} strokeWidth="4" />
          <path d="M40 4V14M40 34V44M20 24H30M50 24H60" stroke={c1} strokeWidth="2" />
          <Arrow x={39} y={25} a={-45} l={38} head={u(f)} shaft="#b88a55" fletch={c2} />
        </g>
      );
    },
  },
  'arcane-shot': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('as-f', c2);
      const g = gid('as-g', c2);
      return (
        <g>
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
            <Glow id={g} c={c2} />
          </defs>
          <path d="M8 56C16 44 24 40 30 34" stroke={c2} strokeOpacity="0.5" strokeWidth="7" strokeLinecap="round" />
          <circle cx="48" cy="16" r="15" fill={u(g)} />
          <Arrow x={56} y={8} a={-45} l={50} head={u(f)} shaft={c1} fletch={c2} />
          <Sparkle x={18} y={36} r={3.4} fill={c1} />
          <Sparkle x={34} y={52} r={2.6} fill={c1} />
          <Sparkle x={26} y={22} r={2.4} fill={c1} />
        </g>
      );
    },
  },
  serpent: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('se-f', c2);
      const body = 'M14 54C30 54 46 52 46 44C46 36 18 38 18 30C18 22 38 24 42 18';
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path d={body} fill="none" stroke={K} strokeWidth="11" />
          <path d={body} fill="none" stroke={u(f)} strokeWidth="7.5" />
          <path d={body} fill="none" stroke={c1} strokeOpacity="0.5" strokeWidth="1.3" strokeDasharray="2 3" />
          <path d="M38 14C42 8 52 8 54 14C56 20 50 24 44 22Z" fill={u(f)} stroke={K} strokeWidth="1.7" />
          <circle cx="49" cy="13.5" r="1.6" fill="#ffe08a" stroke={K} strokeWidth="0.8" />
          <path d="M54 17L60 19M60 19L62 17M60 19L62 21" fill="none" stroke="#d6413a" strokeWidth="1.4" />
          <path d="M44 22L45 26M48 22L48 25" stroke="#fff" strokeWidth="1.2" />
        </g>
      );
    },
  },
  sting: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('st-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          {[
            [14, 56, 9],
            [20, 46, 8],
            [28, 38, 7.5],
            [38, 32, 7],
            [48, 30, 6.5],
          ].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill={u(f)} stroke={K} strokeWidth="1.6" />
          ))}
          <path d="M52 28C58 26 60 18 56 10C54 16 50 20 46 22Z" fill="#e8e2d6" stroke={K} strokeWidth="1.6" />
          <circle cx="56" cy="9" r="2.2" fill={c2} />
          <path d="M56 6V2" stroke={c2} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M12 52C14 50 17 50 19 51" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.3" fill="none" />
        </g>
      );
    },
  },
  mark: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('mk-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <circle cx="32" cy="42" r="17" fill="none" stroke={K} strokeWidth="5" />
          <circle cx="32" cy="42" r="17" fill="none" stroke={c2} strokeWidth="2.5" />
          <circle cx="32" cy="42" r="8" fill="none" stroke={c1} strokeWidth="2" />
          <circle cx="32" cy="42" r="2.5" fill={c1} />
          <path d="M20 6L32 22L44 6L38 6L32 14L26 6Z" fill={u(f)} stroke={K} strokeWidth="1.6" />
        </g>
      );
    },
  },
  concussive: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('co-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path d="M38 34m-16 0a16 9 0 1 0 32 0a16 9 0 1 0 -32 0" fill="none" stroke={c2} strokeWidth="2" strokeDasharray="4 3" />
          <polygon points={star(38, 34, 8, 12, 5)} fill={u(f)} stroke={K} strokeWidth="1.4" />
          <Arrow x={34} y={34} a={20} l={30} head={u(f)} shaft="#b88a55" fletch={c2} />
          <polygon points={star(18, 14, 5, 5, 2)} fill={c1} stroke={K} strokeWidth="0.9" />
          <polygon points={star(50, 12, 5, 4, 1.6)} fill={c1} stroke={K} strokeWidth="0.9" />
          <polygon points={star(56, 50, 5, 4.5, 1.8)} fill={c1} stroke={K} strokeWidth="0.9" />
        </g>
      );
    },
  },
  scatter: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('sca-f', c2);
      const pellets = [
        [44, 12],
        [52, 22],
        [56, 34],
        [50, 46],
        [42, 54],
        [38, 30],
        [46, 32],
      ];
      return (
        <g strokeLinecap="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          {pellets.map(([x, y], i) => (
            <path key={i} d={`M10 34L${x} ${y}`} stroke={c2} strokeOpacity="0.35" strokeWidth="2" />
          ))}
          {pellets.map(([x, y], i) => (
            <circle key={'p' + i} cx={x} cy={y} r="3.4" fill={u(f)} stroke={K} strokeWidth="1.2" />
          ))}
          <path d="M4 30H14L18 34L14 38H4Z" fill="#6b5a46" stroke={K} strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M22 26Q30 34 22 42" fill="none" stroke={c1} strokeWidth="2" />
        </g>
      );
    },
  },
  // ---------------------------------------------------------------- hunter: traps
  'trap-freeze': {
    draw: ({ c1, c2 }) => (
      <g>
        <TrapJaws fill="#8f9aa8" y={44} />
        <Flake x={32} y={18} r={13} stroke={c1} w={2.4} />
        <circle cx="32" cy="18" r="16" fill={c2} fillOpacity="0.15" />
      </g>
    ),
  },
  'trap-fire': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('tf-f', c2);
      return (
        <g>
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} x1={0.5} y1={0} x2={0.5} y2={1} />
          </defs>
          <TrapJaws fill="#8f7a63" y={44} />
          <Flame x={32} y={28} s={0.95} outer={u(f)} inner={c1} />
          <Flame x={18} y={36} s={0.5} outer={u(f)} inner={c1} r={-15} />
          <Flame x={46} y={36} s={0.5} outer={u(f)} inner={c1} r={15} />
        </g>
      );
    },
  },
  'trap-frost': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('tfr-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <ellipse cx="32" cy="44" rx="28" ry="12" fill={u(f)} fillOpacity="0.55" stroke={K} strokeWidth="1.6" />
          <ellipse cx="32" cy="44" rx="20" ry="8" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.2" strokeDasharray="4 3" />
          {[
            [14, 40, -20],
            [24, 34, -8],
            [40, 33, 8],
            [50, 38, 20],
            [32, 30, 0],
          ].map(([x, y, r], i) => (
            <path key={i} d="M0 0L3 -14L6 0Z" transform={`translate(${x - 3} ${y + 6}) rotate(${r})`} fill={c1} stroke={K} strokeWidth="1.1" />
          ))}
          <Flake x={32} y={14} r={9} stroke={c1} w={1.8} />
        </g>
      );
    },
  },
  // ---------------------------------------------------------------- hunter: melee & tricks
  'wing-clip': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('wc-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path
            d="M8 18C22 10 40 12 54 22C46 22 40 24 36 26C44 28 50 32 52 38C44 36 38 36 34 37C38 40 40 44 40 50C30 44 20 34 14 26C11 22 9 20 8 18Z"
            fill={u(f)}
            stroke={K}
            strokeWidth="1.7"
          />
          <path d="M14 22C24 18 36 18 46 22M16 26C26 26 34 28 42 32M20 30C26 32 30 36 34 40" fill="none" stroke={K} strokeOpacity="0.5" strokeWidth="1.1" />
          <path d="M44 6L22 58" stroke={K} strokeWidth="5.5" strokeLinecap="round" />
          <path d="M44 6L22 58" stroke="#e8e2d6" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M34 30l4 2M28 44l4 1" stroke="#d6413a" strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    },
  },
  'raptor-strike': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('rs-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path
            d="M6 44C8 30 18 20 32 18C40 17 50 20 58 26L50 30L58 34C50 38 44 38 38 38L44 44L34 44C26 50 14 50 6 44Z"
            fill={u(f)}
            stroke={K}
            strokeWidth="1.7"
          />
          <path d="M50 30L58 34L46 34ZM40 38L44 44L36 42Z" fill="#000" />
          <path d="M48 28.5l1.5 3 1-3M43 36.5l1 2.5 1-2.5" fill="#fff" stroke="#fff" strokeWidth="0.8" />
          <circle cx="40" cy="25" r="2.2" fill="#ffe08a" stroke={K} strokeWidth="1" />
          <path d="M16 34C20 30 24 29 28 30M12 40C16 37 20 36 24 37" fill="none" stroke={K} strokeOpacity="0.5" strokeWidth="1.2" />
          <path d="M6 12L20 6M2 22L16 18" stroke={c1} strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    },
  },
  mongoose: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('mo-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path d="M6 56C12 40 22 30 34 24C40 21 48 20 54 22L58 26L52 28L56 32C50 34 44 34 40 34C32 40 26 48 22 56Z" fill={u(f)} stroke={K} strokeWidth="1.7" />
          <path d="M52 28L56 32L48 31Z" fill="#000" />
          <path d="M51 28.5l1 2 1-2" stroke="#fff" strokeWidth="0.9" fill="none" />
          <circle cx="46" cy="24.5" r="1.8" fill={K} />
          <path d="M40 22L44 16L46 22" fill={u(f)} stroke={K} strokeWidth="1.3" />
          <path d="M12 46C16 44 20 44 24 46M16 40C20 38 24 38 27 40" fill="none" stroke={K} strokeOpacity="0.45" strokeWidth="1.2" />
          <path d="M30 8C40 6 50 8 58 14" fill="none" stroke={c1} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M26 14C34 12 42 13 48 16" fill="none" stroke={c1} strokeOpacity="0.6" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );
    },
  },
  disengage: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('di-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path d="M58 32H20" stroke={K} strokeWidth="9" strokeLinecap="round" />
          <path d="M58 32H20" stroke={u(f)} strokeWidth="5.5" strokeLinecap="round" />
          <path d="M26 18L8 32L26 46Z" fill={u(f)} stroke={K} strokeWidth="1.8" />
          <path d="M40 22L46 26M48 18L54 22M42 42L48 38M50 46L56 42" stroke={c1} strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" />
          <circle cx="54" cy="32" r="5" fill="#e0443a" stroke={K} strokeWidth="1.4" />
        </g>
      );
    },
  },
  feign: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('fe-f', c2);
      const body = 'M14 40C10 40 8 43 9 46C10 48 12 49 14 48L22 47L34 48L44 46L54 48C57 48 58 45 56 43L46 40L34 39Z';
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <g transform="translate(4 -16)" opacity="0.6">
            <path d={body} fill={c1} fillOpacity="0.18" stroke={c1} strokeWidth="1.4" strokeDasharray="3 2.5" />
            <circle cx="10" cy="39" r="6" fill={c1} fillOpacity="0.18" stroke={c1} strokeWidth="1.4" strokeDasharray="3 2.5" />
          </g>
          <path d="M18 30C17 26 18 22 20 20M28 30C29 26 30 24 32 22" fill="none" stroke={c1} strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round" />
          <ellipse cx="34" cy="51" rx="27" ry="5" fill="#000" fillOpacity="0.5" />
          <path d={body} fill={u(f)} stroke={K} strokeWidth="1.7" />
          <path d="M22 41L26 47M38 40L36 47" fill="none" stroke={K} strokeOpacity="0.5" strokeWidth="1.2" />
          <circle cx="10" cy="43" r="6.5" fill={u(f)} stroke={K} strokeWidth="1.6" />
          <path d="M6.5 40.5l2.5 2.5M9 40.5l-2.5 2.5M11.5 41.5l2.5 2.5M14 41.5l-2.5 2.5" stroke={K} strokeWidth="1.2" strokeLinecap="round" />
        </g>
      );
    },
  },
  'rapid-fire': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('rf-f', c2);
      return (
        <g>
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path d="M4 16H20M2 32H18M6 48H22" stroke={c1} strokeOpacity="0.55" strokeWidth="2.2" strokeLinecap="round" />
          <Arrow x={60} y={16} a={0} l={36} head={u(f)} shaft="#b88a55" fletch={c2} />
          <Arrow x={58} y={32} a={0} l={36} head={u(f)} shaft="#b88a55" fletch={c2} />
          <Arrow x={60} y={48} a={0} l={36} head={u(f)} shaft="#b88a55" fletch={c2} />
        </g>
      );
    },
  },
  // ---------------------------------------------------------------- hunter: aspects
  'aspect-hawk': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('ah-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path
            d="M52 58C54 44 52 32 46 24C40 14 30 10 22 12C16 13 12 17 10 22L4 26L12 27C14 32 18 34 22 34C20 40 22 48 26 58Z"
            fill={u(f)}
            stroke={K}
            strokeWidth="1.7"
          />
          <path d="M10 22C8 26 6 28 4 26L10 24Z" fill="#e8c46a" stroke={K} strokeWidth="1.2" />
          <path d="M10 22L4 26L12 27C13 25 12 23 10 22Z" fill="#e8c46a" stroke={K} strokeWidth="1.3" />
          <Eye x={20} y={19} r={2.6} c="#ffd24a" />
          <path d="M16 15C20 13 26 14 30 17" fill="none" stroke={K} strokeWidth="2" strokeLinecap="round" />
          <path d="M30 26C36 30 38 38 38 46M38 22C44 28 46 36 46 46" fill="none" stroke={K} strokeOpacity="0.45" strokeWidth="1.3" />
        </g>
      );
    },
  },
  'aspect-monkey': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('amk-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <circle cx="12" cy="30" r="7" fill={u(f)} stroke={K} strokeWidth="1.6" />
          <circle cx="52" cy="30" r="7" fill={u(f)} stroke={K} strokeWidth="1.6" />
          <circle cx="32" cy="32" r="21" fill={u(f)} stroke={K} strokeWidth="1.8" />
          <path d="M18 34C18 26 24 22 32 26C40 22 46 26 46 34C46 46 40 52 32 52C24 52 18 46 18 34Z" fill="#e9cfa8" stroke={K} strokeWidth="1.5" />
          <Eye x={26} y={31} r={2.6} c="#fff3d0" />
          <Eye x={38} y={31} r={2.6} c="#fff3d0" />
          <path d="M29 40h1M34 40h1" stroke={K} strokeWidth="2" strokeLinecap="round" />
          <path d="M26 45C30 48 34 48 38 45" fill="none" stroke={K} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M22 16C26 12 32 11 36 13" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    },
  },
  'aspect-cheetah': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('ach-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a="#ffe8b0" b="#e0a84a" c="#5a3a14" />
          </defs>
          <path d="M2 24H14M0 34H12M4 44H16" stroke={c2} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M18 40C18 26 28 18 40 18C52 18 60 26 60 38C60 48 52 54 42 54C30 54 18 50 18 40Z" fill={u(f)} stroke={K} strokeWidth="1.8" />
          <path d="M26 20L24 10L34 17M48 18L54 10L56 22" fill={u(f)} stroke={K} strokeWidth="1.5" />
          <Eye x={34} y={32} r={2.5} c="#ffd24a" />
          <Eye x={48} y={32} r={2.5} c="#ffd24a" />
          <path d="M34 35C33 40 34 44 37 46M48 35C49 40 48 44 45 46" fill="none" stroke={K} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M38 44L41 47L44 44Z" fill={K} />
          {[
            [26, 28],
            [24, 40],
            [30, 48],
            [54, 44],
            [56, 28],
            [40, 24],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.8" fill={K} fillOpacity="0.75" />
          ))}
        </g>
      );
    },
  },
  'aspect-viper': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('av-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <ellipse cx="32" cy="55" rx="22" ry="6" fill={u(f)} stroke={K} strokeWidth="1.7" />
          <ellipse cx="32" cy="54" rx="13" ry="3" fill="none" stroke={K} strokeOpacity="0.5" strokeWidth="1.2" />
          <path d="M32 16C46 18 56 30 52 42C50 47 42 49 37 48L36 55H28L27 48C22 49 14 47 12 42C8 30 18 18 32 16Z" fill={u(f)} stroke={K} strokeWidth="1.8" />
          <path d="M24 26C20 32 20 40 24 46M40 26C44 32 44 40 40 46M32 30V48" fill="none" stroke={K} strokeOpacity="0.35" strokeWidth="1.3" />
          <path d="M18 28C20 23 24 20 28 19" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M32 4C38 4 42 9 42 15C42 21 37 26 32 26C27 26 22 21 22 15C22 9 26 4 32 4Z" fill={mix(c1, c2, 0.3)} stroke={K} strokeWidth="1.6" />
          <path d="M25 13.5L30 15L25.5 16.5ZM39 13.5L34 15L38.5 16.5Z" fill="#ffe08a" stroke={K} strokeWidth="1" />
          <path d="M29.5 22.5L30.5 27L31.5 23M34.5 22.5L33.5 27L32.5 23" fill="#fff" stroke={K} strokeWidth="0.8" />
          <path d="M32 26V31M32 31L30 34M32 31L34 34" fill="none" stroke="#d6413a" strokeWidth="1.4" strokeLinecap="round" />
        </g>
      );
    },
  },
};
