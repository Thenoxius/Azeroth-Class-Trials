// Original SVG art — see SPEC.md (Art). Pet, Priest and shared glyphs.
// 64×64 viewBox; c1 = highlight, c2 = school colour, c3 = deep shade.
// Gradient ids carry the school colour so one glyph can appear in several
// schools on the same page without its gradients colliding.

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
    const rs = [].concat(ro);
    const r = i % 2 ? ri : rs[(i / 2) % rs.length];
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    return (cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1);
  }).join(' ');
// Archimedean spiral path: `turns` turns from radius r0 out to r1.
const spiral = (cx, cy, turns, r0, r1, rot = 0) =>
  'M' +
  Array.from({ length: 49 }, (_, i) => {
    const t = i / 48;
    const a = (rot + t * turns * 360) * (Math.PI / 180);
    const r = r0 + (r1 - r0) * t;
    return (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1);
  }).join('L');

// Painterly fill: highlight upper-left → main colour → shade lower-right.
const Lin = ({ id, a, b, c, x1 = 0.15, y1 = 0.05, x2 = 0.85, y2 = 1, d = 0.6 }) => (
  <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
    <stop offset="0" stopColor={a} />
    <stop offset="0.5" stopColor={b} />
    <stop offset="1" stopColor={mix(b, c, d)} />
  </linearGradient>
);
const Glow = ({ id, c, o = 0.75 }) => (
  <radialGradient id={id}>
    <stop offset="0" stopColor={c} stopOpacity={o} />
    <stop offset="1" stopColor={c} stopOpacity="0" />
  </radialGradient>
);

// Shared motifs ----------------------------------------------------------
const Paw = ({ x = 32, y = 32, s = 1, r = 0, fill }) => (
  <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`} fill={fill} stroke={K} strokeWidth={1.7 / s}>
    <path d="M0 -1c6 0 13 6 13 11.5 0 3.8-3.2 4.8-6.4 3.8-2.4-.8-4.4-1.3-6.6-1.3s-4.2.5-6.6 1.3c-3.2 1-6.4 0-6.4-3.8C-13 5-6-1 0-1z" />
    <ellipse cx="-12.5" cy="-6" rx="3.6" ry="4.8" transform="rotate(-28 -12.5 -6)" />
    <ellipse cx="-5" cy="-12.5" rx="3.9" ry="5.2" transform="rotate(-9 -5 -12.5)" />
    <ellipse cx="5" cy="-12.5" rx="3.9" ry="5.2" transform="rotate(9 5 -12.5)" />
    <ellipse cx="12.5" cy="-6" rx="3.6" ry="4.8" transform="rotate(28 12.5 -6)" />
  </g>
);
// Arrow with its tip at (x, y), flying in direction a (degrees).
const Arrow = ({ x, y, a, l = 30, head, shaft, w = 2.4 }) => (
  <g transform={`translate(${x} ${y}) rotate(${a})`} strokeLinejoin="round">
    <path d={`M-6 0H${-l}`} stroke={K} strokeWidth={w + 2.2} strokeLinecap="round" />
    <path d={`M-6 0H${-l}`} stroke={shaft} strokeWidth={w} strokeLinecap="round" />
    <path d={`M${-l + 9} 0L${-l + 1} -5H${-l - 3}L${-l + 3} 0L${-l - 3} 5H${-l + 1}Z`} fill={shaft} stroke={K} strokeWidth="1.2" />
    <path d="M1.5 0L-11 -5.5L-8 0L-11 5.5Z" fill={head} stroke={K} strokeWidth="1.4" />
  </g>
);
const Skull = ({ x = 32, y = 32, s = 1, fill, eye = K }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} stroke={K} strokeWidth={1.7 / s} strokeLinejoin="round">
    <path d="M0 -24C-14 -24 -21 -14 -20 -2C-20 5 -16 8 -14 10V18Q0 24 14 18V10C16 8 20 5 20 -2C21 -14 14 -24 0 -24Z" fill={fill} />
    <path d="M-15 -3C-14 -8 -6 -9 -3 -4C-2 1 -6 5 -10 4.5C-13 4 -15.5 1 -15 -3Z" fill={eye} />
    <path d="M15 -3C14 -8 6 -9 3 -4C2 1 6 5 10 4.5C13 4 15.5 1 15 -3Z" fill={eye} />
    <path d="M0 5L-3.5 11.5H3.5Z" fill={K} />
    <path d="M-14 10Q0 14.5 14 10M-7 13.5V20M-2.4 14.5V21M2.4 14.5V21M7 13.5V20" fill="none" strokeWidth={1.3 / s} />
  </g>
);
const Flame = ({ x, y, s = 1, outer, inner }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} strokeLinejoin="round">
    <path
      d="M0 -24C3 -16 12 -12 12 0C12 8 7 13 0 13C-7 13 -12 8 -12 0C-12 -7 -7 -9 -6 -16C-3 -12 -3 -9 -2 -7C0 -12 -2 -18 0 -24Z"
      fill={outer}
      stroke={K}
      strokeWidth={1.6 / s}
    />
    <path d="M0 -6C2 -2 6 0 6 5C6 9 3 11 0 11C-3 11 -6 9 -6 5C-6 1 -3 0 -2 -3C-1 -2 -1 0 0 1C1 -2 0 -4 0 -6Z" fill={inner} />
  </g>
);
const Leaf = ({ x, y, r = 0, s = 1, fill }) => (
  <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
    <path d="M0 0C4 -6 11 -7 16 -3C12 3 5 5 0 0Z" fill={fill} stroke={K} strokeWidth={1.3 / s} strokeLinejoin="round" />
    <path d="M1.5 -0.5C6 -2 10 -2.6 14.5 -3" fill="none" stroke={K} strokeOpacity="0.55" strokeWidth={0.9 / s} />
  </g>
);
const Sparkle = ({ x, y, r = 5, fill }) => (
  <path
    d={`M${x} ${y - r}L${x + r * 0.28} ${y - r * 0.28}L${x + r} ${y}L${x + r * 0.28} ${y + r * 0.28}L${x} ${y + r}L${x - r * 0.28} ${y + r * 0.28}L${x - r} ${y}L${x - r * 0.28} ${y - r * 0.28}Z`}
    fill={fill}
  />
);
const Potion = ({ n, liquid: [la, lb, lc], c1 }) => {
  const g = n + '-liq';
  return (
    <g>
      <defs>
        <Lin id={g} a={la} b={lb} c={lc} d={0.7} />
      </defs>
      <rect x="28" y="5" width="8" height="7" rx="1.6" fill="#9a6a3a" stroke={K} strokeWidth="1.4" />
      <path d="M27.5 12V22.7A16 16 0 1 0 36.5 22.7V12Z" fill={c1} fillOpacity="0.14" />
      <path d="M17.2 32A16 16 0 1 0 46.8 32Q39.4 29.2 32 32Q24.6 34.8 17.2 32Z" fill={u(g)} />
      <path d="M17.2 32Q24.6 34.8 32 32Q39.4 29.2 46.8 32" fill="none" stroke={la} strokeWidth="1.3" />
      <path d="M27.5 12V22.7A16 16 0 1 0 36.5 22.7V12Z" fill="none" stroke={K} strokeWidth="2" strokeLinejoin="round" />
      <rect x="25.5" y="10.5" width="13" height="3.6" rx="1.8" fill={c1} fillOpacity="0.85" stroke={K} strokeWidth="1.3" />
      <path d="M21 33C21 28 24 25 27 24" fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="37" cy="41" r="2" fill="#fff" fillOpacity="0.55" />
      <circle cx="31" cy="46" r="1.3" fill="#fff" fillOpacity="0.45" />
      <circle cx="40" cy="47" r="1" fill="#fff" fillOpacity="0.45" />
    </g>
  );
};

export const GLYPHS_B = {
  // ---------------------------------------------------------------- pet / hunter
  volley: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('volley-f', c2);
      return (
        <g>
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path d="M14 7l-.8 5M31 7l-.8 6M43 7l-.6 3.5M54 7l-.8 5" stroke={c1} strokeOpacity="0.45" strokeWidth="1.5" strokeLinecap="round" />
          <Arrow x={13} y={44} a={100} l={28} head={u(f)} shaft={c2} />
          <Arrow x={25} y={55} a={100} l={32} head={u(f)} shaft={c2} />
          <Arrow x={37} y={43} a={100} l={27} head={u(f)} shaft={c2} />
          <Arrow x={49} y={53} a={100} l={31} head={u(f)} shaft={c2} />
        </g>
      );
    },
  },
  tranq: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('tranq-f', c2);
      // Calming curls drift either side of a leaf-fletched dart.
      const sp = spiral(19, 21, 1.4, 1.5, 10, 0) + spiral(45, 43, 1.4, 1.5, 10, 180);
      return (
        <g strokeLinecap="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path d={sp} fill="none" stroke={K} strokeWidth="4.6" />
          <path d={sp} fill="none" stroke={c1} strokeWidth="2.4" />
          <Arrow x={54} y={10} a={-45} l={44} head={u(f)} shaft={c2} w={3.2} />
          <Leaf x={22} y={42} r={-80} s={1.2} fill={u(f)} />
          <Leaf x={22} y={42} r={170} s={1.2} fill={u(f)} />
        </g>
      );
    },
  },
  paw: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('paw-f', c2);
      return (
        <g>
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <Paw x={32} y={35} s={1.42} fill={u(f)} />
        </g>
      );
    },
  },
  claw: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('claw-f', c2);
      const s = 'M36 8Q33 34 9 43Q23 25 36 8ZM47 9Q42 40 14 55Q30 31 47 9ZM56 18Q51 44 26 57Q40 35 56 18Z';
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={mix(c1, c2, 0.5)} c={c2} d={0.7} />
          </defs>
          <path d={s} fill={c2} fillOpacity="0.4" stroke={c2} strokeOpacity="0.4" strokeWidth="5" />
          <path d={s} fill={u(f)} stroke={K} strokeWidth="1.6" />
          <path d="M33.5 13Q30 30 14 40M44.5 14Q39 36 19 51M53.5 23Q48 41 31 53" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="1" />
        </g>
      );
    },
  },
  bite: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('bite-f', c2);
      return (
        <g stroke={K} strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <ellipse cx="32" cy="33" rx="20" ry="11" fill="#000" fillOpacity="0.75" stroke="none" />
          <g fill={c1} strokeWidth="1.2">
            <path d="M14 29L21 26.5L18 41Z" />
            <path d="M24 25L29 24.2L26.5 31.5Z" />
            <path d="M35 24.2L40 25L37.5 31.5Z" />
            <path d="M43 26.5L50 29L46 41Z" />
            <path d="M21 40L27 41.5L24 29Z" />
            <path d="M29 42L35 42L32 35.5Z" />
            <path d="M37 41.5L43 40L40 29Z" />
          </g>
          <path d="M6 31C11 13 53 13 58 31L51 30C44 21 20 21 13 30Z" fill={u(f)} strokeWidth="1.6" />
          <path d="M6 36C11 54 53 54 58 36L51 37C44 46 20 46 13 37Z" fill={u(f)} strokeWidth="1.6" />
          <path d="M11 26C17 19 26 17 32 17" fill="none" stroke={c1} strokeOpacity="0.7" strokeWidth="1.3" />
        </g>
      );
    },
  },
  growl: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('growl-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path
            d="M6 56C4 44 6 32 12 24L13 9L21 19C27 17 34 18 38 22L46 26L45 30L34 32L42 38L40 41C34 43 28 44 24 47C22 50 20 53 19 56Z"
            fill={u(f)}
            stroke={K}
            strokeWidth="1.7"
          />
          <path d="M45 30L34 32L42 38Z" fill="#000" />
          <path d="M43 30.2L41.5 34L40 30.6ZM38 31.2L37 34.2L36 31.5ZM40.5 36.6L39.2 33.6L38.2 35.6Z" fill={c1} />
          <path d="M24 24L31 23L29 26.5Z" fill={c1} stroke={K} strokeWidth="0.8" />
          <circle cx="45.5" cy="26.8" r="1.6" fill={K} />
          <path d="M10 40L14 37M9 47L14 44M12 31L16 30" stroke={K} strokeOpacity="0.5" strokeWidth="1.4" strokeLinecap="round" />
          <g fill="none" strokeLinecap="round">
            <path d="M47.5 29A6.5 6.5 0 0 1 47.5 39M50 25.5A11 11 0 0 1 50 42.5M51 22A15 15 0 0 1 51 46" stroke={K} strokeWidth="4.6" />
            <path d="M47.5 29A6.5 6.5 0 0 1 47.5 39M50 25.5A11 11 0 0 1 50 42.5M51 22A15 15 0 0 1 51 46" stroke={c1} strokeWidth="2.4" />
          </g>
        </g>
      );
    },
  },
  dash: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('dash-f', c2);
      return (
        <g>
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <g strokeLinecap="round">
            <path d="M8 22H22M12 32H20M7 42H21" stroke={K} strokeWidth="5" />
            <path d="M8 22H22M12 32H20M7 42H21" stroke={c1} strokeWidth="2.8" />
          </g>
          <Paw x={37} y={33} s={1.08} r={75} fill={u(f)} />
        </g>
      );
    },
  },
  'mend-pet': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('mend-pet-f', c2);
      const g = gid('mend-pet-g', c1);
      return (
        <g>
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
            <Glow id={g} c={c1} o={0.7} />
          </defs>
          <Paw x={27} y={39} s={1.05} r={-8} fill={u(f)} />
          <circle cx="46" cy="18" r="13" fill={u(g)} />
          <path d="M42.5 8h7v6.5h6.5v7h-6.5v6.5h-7v-6.5h-6.5v-7h6.5z" fill={c1} stroke={K} strokeWidth="1.6" strokeLinejoin="round" />
        </g>
      );
    },
  },
  'call-pet': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('call-pet-f', c2);
      return (
        <g stroke={K} strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path d="M9 47C22 44 33 30 38 14L54 26C44 42 26 52 11 51Z" fill={u(f)} strokeWidth="1.7" />
          <ellipse cx="46" cy="20" rx="10" ry="4" transform="rotate(37 46 20)" fill={mix(c3, '#000000', 0.4)} strokeWidth="1.6" />
          <path d="M37.6 15.2A10 4 37 0 1 54.3 26.4" fill="none" stroke={c1} strokeWidth="1.3" />
          <path d="M24 40.5L30 46M30 34L37 39" fill="none" stroke={c3} strokeWidth="2.4" />
          <rect x="5" y="46" width="7" height="6" rx="1.5" fill={c1} strokeWidth="1.3" transform="rotate(-12 8 49)" />
          <Paw x={19} y={20} s={0.6} fill={u(f)} />
        </g>
      );
    },
  },
  'revive-pet': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('revive-pet-f', c2);
      const b = gid('revive-pet-b', c1);
      return (
        <g>
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
            <linearGradient id={b} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor={c1} stopOpacity="0.75" />
              <stop offset="1" stopColor={c1} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M21 52H43L52 6H12Z" fill={u(b)} />
          <path d="M22 22L32 12L42 22M25 31L32 24L39 31" fill="none" stroke={K} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M22 22L32 12L42 22M25 31L32 24L39 31" fill="none" stroke={c1} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <Paw x={32} y={45} s={0.82} fill={u(f)} />
          <Sparkle x={13} y={30} r={3.5} fill={c1} />
          <Sparkle x={51} y={36} r={3} fill={c1} />
        </g>
      );
    },
  },
  'beast-wrath': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('beast-wrath-f', c2);
      const g = gid('beast-wrath-g', c1);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c2} b={mix(c2, c3, 0.45)} c={c3} />
            <Glow id={g} c={c1} o={0.6} />
          </defs>
          <path d="M8 10L21 20H43L56 10L54 34L44 49L32 56L20 49L10 34Z" fill={u(f)} stroke={K} strokeWidth="1.7" />
          <ellipse cx="20" cy="34" rx="11" ry="7" fill={u(g)} />
          <ellipse cx="44" cy="34" rx="11" ry="7" fill={u(g)} />
          <path d="M10 29L28 36C24 41 14 40 10 29Z" fill={c1} stroke={K} strokeWidth="1.4" />
          <path d="M54 29L36 36C40 41 50 40 54 29Z" fill={c1} stroke={K} strokeWidth="1.4" />
          <ellipse cx="20" cy="35.5" rx="1.4" ry="3" fill={K} />
          <ellipse cx="44" cy="35.5" rx="1.4" ry="3" fill={K} />
          <path d="M8 24L29 32M56 24L35 32M30 24L32 30L34 24" fill="none" stroke={K} strokeWidth="3" strokeLinecap="round" />
          <path d="M28 45H36L32 49Z" fill={K} />
          <path d="M25 50L27.5 56L29 51ZM39 50L36.5 56L35 51Z" fill={c1} stroke={K} strokeWidth="1" />
        </g>
      );
    },
  },
  'kill-command': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('kill-command-f', c2);
      return (
        <g stroke={K} strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          {/* the beast's upper jaw looms over the commanding hand: two great fangs under an arched gum */}
          <path
            d="M20 12L30 15.5C30 21 29 26 27 31C25 25.5 22.5 19 20 12ZM34 15.5L44 12C41.5 19 39 25.5 37 31C35 26 34 21 34 15.5Z"
            fill={c1}
            strokeWidth="1.7"
          />
          <path d="M30.2 16.5H33.8L32 21.5Z" fill={c1} strokeWidth="1.2" />
          <path d="M14 8Q32 21 50 8L50.5 12.5Q32 26 13.5 12.5Z" fill={mix(c3, '#000000', 0.3)} strokeWidth="1.6" />
          <path d="M15.5 10Q24 15.5 32 16.5" fill="none" stroke={c2} strokeWidth="1.3" strokeLinecap="round" />
          <path
            d="M23 18C24.5 22 25.6 25 26.5 28M37.5 19.5C37.6 22.5 37.4 25 37 27"
            fill="none"
            stroke="#fff"
            strokeOpacity="0.85"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <g transform="translate(1 3)">
            <path d="M5 33L15 31L17 52L7 54Z" fill={mix(c3, '#000000', 0.2)} strokeWidth="1.5" />
            <path
              d="M15 32C19 30 23 29 27 30L45 29C48 29 49.5 31 49.5 32.5C49.5 34 48 35.5 45 35.5L32 36C34 37 35 39 33 40.5C35 41.5 35.5 44 33 45C35 46 35 49 32 49.5C33 51 32 53 29 53L17 52Z"
              fill={u(f)}
              strokeWidth="1.6"
            />
            <path d="M19 36C23 34 28 34.5 31 36.5L29 39.5C26 38.5 22 39 19 40" fill={u(f)} strokeWidth="1.3" />
            <path d="M14 33L16 52" fill="none" stroke={c2} strokeWidth="1.6" />
            <path d="M21 31C26 29.5 36 29.5 44 29.6" fill="none" stroke={c1} strokeOpacity="0.8" strokeWidth="1.2" />
          </g>
        </g>
      );
    },
  },
  // ---------------------------------------------------------------- shadow
  eye: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('eye-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path
            d="M32 15V8M40.5 17.3L44 11.2M46.7 23.5L52.8 20M23.5 17.3L20 11.2M17.3 23.5L11.2 20M32 49V56M40.5 46.7L44 52.8M23.5 46.7L20 52.8"
            stroke={c1}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path d="M5 32Q32 6 59 32Q32 58 5 32Z" fill={c1} fillOpacity="0.9" stroke={K} strokeWidth="2" />
          <circle cx="32" cy="32" r="11" fill={u(f)} stroke={K} strokeWidth="1.5" />
          <ellipse cx="32" cy="32" rx="3" ry="7" fill={K} />
          <circle cx="28.5" cy="28" r="2.4" fill="#fff" fillOpacity="0.9" />
          <path d="M5 32Q32 6 59 32" fill="none" stroke={K} strokeWidth="3" />
        </g>
      );
    },
  },
  skull: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('skull-f', c2);
      return (
        <g>
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <Skull x={32} y={33} s={1} fill={u(f)} />
          <circle cx="23" cy="31" r="1.8" fill={c1} />
          <circle cx="41" cy="31" r="1.8" fill={c1} />
        </g>
      );
    },
  },
  swp: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('swp-f', c2);
      const t =
        'M24 22C18 15 9 15 9 22C9 27 15 27 15 23M40 22C46 15 55 15 55 22C55 27 49 27 49 23M23 44C17 50 9 50 9 44C9 39 14 39 15 42M41 44C47 50 55 50 55 44C55 39 50 39 49 42';
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path d={t} fill="none" stroke={K} strokeWidth="5.6" strokeLinecap="round" />
          <path d={t} fill="none" stroke={c2} strokeWidth="3.2" strokeLinecap="round" />
          <path d="M14 18L11 14M50 18L53 14M13 47L10 51M51 47L54 51" stroke={c2} strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="32" cy="33" rx="13" ry="17" fill={u(f)} stroke={K} strokeWidth="1.8" />
          <path d="M23 22Q27 20 30.5 24M41 22Q37 20 33.5 24" fill="none" stroke={K} strokeWidth="2" strokeLinecap="round" />
          <path d="M23.5 27L29 30L24 32.5M40.5 27L35 30L40 32.5" fill="none" stroke={K} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M24.5 41L27.5 38L30 41L32 38L34 41L36.5 38L39.5 41L37 46Q32 48.5 27 46Z" fill={K} />
          <path d="M26 41.5L38 41.5" stroke={c1} strokeWidth="0.9" strokeOpacity="0.6" />
        </g>
      );
    },
  },
  'mind-blast': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('mind-blast-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c2} b={mix(c2, c3, 0.5)} c={c3} />
          </defs>
          <path
            d="M45 57V48C51 46 53 40 51 32C49 22 41 18 33 18C23 18 17 25 17 32L12 39L15.5 41L14.5 45C14.5 48 18 48 21 48L24 49V57Z"
            fill={u(f)}
            stroke={K}
            strokeWidth="1.7"
          />
          <polygon points={star(35, 19, 9, [16, 12], 6.5)} fill={c2} stroke={K} strokeWidth="1.5" />
          <polygon points={star(35, 19, 9, [9, 7], 3.5, -70)} fill={c1} />
          <path d="M35 27L33 33L36 38" fill="none" stroke={c1} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M19 30C19 25 23 21 28 20" fill="none" stroke={c1} strokeOpacity="0.6" strokeWidth="1.3" />
        </g>
      );
    },
  },
  'mind-flay': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('mind-flay-f', c2);
      const g = gid('mind-flay-g', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
            <Glow id={g} c={c2} o={0.8} />
          </defs>
          <circle cx="32" cy="54" r="13" fill={u(g)} />
          <g fill={u(f)} stroke={K} strokeWidth="1.5">
            <path d="M26 54C6 46 24 28 11 16C9 13 12 10 15 12C10 14 12 16 14 18C30 30 14 44 31 53Z" />
            <path d="M29 53C37 38 22 26 34 9C35 7 39 8 38 11C35 12 35 13 36 15C28 28 41 40 35 54Z" />
            <path d="M34 54C38 40 56 42 51 24C50 21 53 19 55 21C52 22 53 24 54 26C58 42 42 44 38 55Z" />
          </g>
          <ellipse cx="32" cy="55" rx="9" ry="4" fill={K} stroke={c2} strokeWidth="1.4" />
        </g>
      );
    },
  },
  shadowform: {
    draw: ({ c1, c2, c3 }) => {
      const g = gid('shadowform-g', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Glow id={g} c={c2} o={0.85} />
          </defs>
          <ellipse cx="32" cy="33" rx="26" ry="27" fill={u(g)} />
          <path
            d="M32 7C20 7 13 18 14 30C14 40 10 48 7 57L14 52L19 57L25 51L30 57L34 51L39 57L45 51L50 57L57 57C54 48 50 40 50 30C51 18 44 7 32 7Z"
            fill="#0b0614"
            stroke={c2}
            strokeWidth="1.6"
          />
          <path d="M32 17C24 17 20 24 21 31C22 38 27 42 32 42C37 42 42 38 43 31C44 24 40 17 32 17Z" fill="#000" />
          <path d="M23.5 28L30.5 31L24.5 33.5Z" fill={c1} />
          <path d="M40.5 28L33.5 31L39.5 33.5Z" fill={c1} />
          <path d="M16 28C16 17 23 9.5 32 9.5" fill="none" stroke={c1} strokeOpacity="0.8" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    },
  },
  'shadow-word-death': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('shadow-word-death-f', c2);
      return (
        <g strokeLinecap="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <circle cx="32" cy="32" r="23" fill="none" stroke={K} strokeWidth="6.5" />
          <circle cx="32" cy="32" r="23" fill="none" stroke={c2} strokeWidth="3.4" />
          <polygon points="32,53.5 13.4,21.3 50.6,21.3" fill="none" stroke={c2} strokeOpacity="0.75" strokeWidth="1.6" />
          <path d="M32 5V12M55.4 18.5L49.3 22M55.4 45.5L49.3 42M32 59V52M8.6 45.5L14.7 42M8.6 18.5L14.7 22" stroke={c1} strokeWidth="2.2" />
          <Skull x={32} y={34} s={0.6} fill={u(f)} eye={c3} />
        </g>
      );
    },
  },
  vampiric: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('vampiric-f', c2);
      return (
        <g stroke={K} strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path d="M8 24C20 23 26 23 32 25C38 23 44 23 56 24C46 33 38 35 32 35C26 35 18 33 8 24Z" fill="#000" stroke="none" />
          <path d="M18.5 23.5L25 24L22 36.5Z" fill={c1} strokeWidth="1.2" />
          <path d="M45.5 23.5L39 24L42 36.5Z" fill={c1} strokeWidth="1.2" />
          <path d="M8 24C16 15 26 13 32 19C38 13 48 15 56 24C46 24 38 23 32 25C26 23 18 24 8 24Z" fill={u(f)} strokeWidth="1.6" />
          <path d="M8 24C18 32 26 35 32 35C38 35 46 32 56 24C50 39 41 44 32 44C23 44 14 39 8 24Z" fill={u(f)} strokeWidth="1.6" />
          <path d="M22 44C25.5 48.5 25.5 52 22 52C18.5 52 18.5 48.5 22 44Z" fill={c2} strokeWidth="1.3" />
          <path d="M41 46C45 51 45 55 41 55C37 55 37 51 41 46Z" fill={c2} strokeWidth="1.3" />
          <path d="M32 47C34 50 34 52 32 52C30 52 30 50 32 47Z" fill={c2} strokeWidth="1.1" />
        </g>
      );
    },
  },
  silence: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('silence-f', c1);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={mix(c1, c2, 0.55)} c={c3} />
          </defs>
          <path
            d="M13 33C17 27 22 22.5 27 23.5C29.5 24 31 25.5 32 26.5C33 25.5 34.5 24 37 23.5C42 22.5 47 27 51 33C43 31.5 37 31 32 32.5C27 31 21 31.5 13 33Z"
            fill={u(f)}
            stroke={K}
            strokeWidth="1.6"
          />
          <path d="M13 33C21 33.6 27 34.2 32 34.2C37 34.2 43 33.6 51 33C46 42 39 45 32 45C25 45 18 42 13 33Z" fill={u(f)} stroke={K} strokeWidth="1.6" />
          <path d="M25 39.5Q29 41.5 34 41" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.4" strokeLinecap="round" />
          <g fill="none" strokeLinecap="round">
            <circle cx="32" cy="32" r="22" stroke={K} strokeWidth="7.5" />
            <path d="M16.4 16.4L47.6 47.6" stroke={K} strokeWidth="7.5" />
            <circle cx="32" cy="32" r="22" stroke={c2} strokeWidth="4.5" />
            <path d="M16.4 16.4L47.6 47.6" stroke={c2} strokeWidth="4.5" />
            <path d="M12 26C14 18 20 12 28 10.4" stroke={c1} strokeWidth="1.5" />
          </g>
        </g>
      );
    },
  },
  scream: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('scream-f', c2);
      const w = 'M46 24.3A17 17 0 0 1 46 43.7M50.5 20.6A22 22 0 0 1 50.5 47.4M18 24.3A17 17 0 0 0 18 43.7M13.5 20.6A22 22 0 0 0 13.5 47.4';
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path d={w} fill="none" stroke={K} strokeWidth="5" strokeLinecap="round" />
          <path d={w} fill="none" stroke={c1} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M32 12C39 12 43 19 43 28C43 40 38 52 32 52C26 52 21 40 21 28C21 19 25 12 32 12Z" fill={u(f)} stroke={K} strokeWidth="1.7" />
          <ellipse cx="27" cy="26" rx="2.6" ry="4.2" transform="rotate(18 27 26)" fill={K} />
          <ellipse cx="37" cy="26" rx="2.6" ry="4.2" transform="rotate(-18 37 26)" fill={K} />
          <ellipse cx="32" cy="41" rx="4.6" ry="7.5" fill={K} />
          <path d="M23 20Q26 17 29.5 20M41 20Q38 17 34.5 20" fill="none" stroke={K} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    },
  },
  fade: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('fade-f', c2);
      return (
        <g>
          <defs>
            <linearGradient id={f} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={c1} />
              <stop offset="0.4" stopColor={c2} stopOpacity="0.95" />
              <stop offset="1" stopColor={c2} stopOpacity="0" />
            </linearGradient>
          </defs>
          <circle cx="27" cy="18" r="8" fill={u(f)} />
          <path d="M9 57C9 40 16 30 27 30C38 30 46 40 46 57Z" fill={u(f)} />
          <path d="M26 20H52M24 29H56M30 37H54M28 45H50M32 52H56" stroke={c3} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M9 57C9 40 16 30 27 30M19 18C19 13 23 10 27 10" fill="none" stroke={c1} strokeOpacity="0.85" strokeWidth="1.5" />
          <g fill={c1}>
            <circle cx="47" cy="24" r="1.4" fillOpacity="0.6" />
            <circle cx="53" cy="33" r="1.1" fillOpacity="0.45" />
            <circle cx="45" cy="41" r="1.5" fillOpacity="0.5" />
            <circle cx="54" cy="48" r="1" fillOpacity="0.35" />
          </g>
        </g>
      );
    },
  },
  // ---------------------------------------------------------------- holy / discipline
  shield: {
    draw: ({ c1, c2, c3 }) => {
      const b = gid('shield-b', c2);
      return (
        <g>
          <defs>
            <radialGradient id={b} cx="0.42" cy="0.4" r="0.6">
              <stop offset="0.5" stopColor={c2} stopOpacity="0.08" />
              <stop offset="0.85" stopColor={c2} stopOpacity="0.55" />
              <stop offset="1" stopColor={c1} stopOpacity="0.95" />
            </radialGradient>
          </defs>
          <ellipse cx="32" cy="55" rx="16" ry="2.6" fill={c2} fillOpacity="0.35" />
          <circle cx="32" cy="32" r="23" fill={u(b)} stroke={c1} strokeWidth="1.8" />
          <circle cx="32" cy="27" r="4.6" fill={c2} fillOpacity="0.85" />
          <path d="M23 45C23 37 27 33.5 32 33.5C37 33.5 41 37 41 45Z" fill={c2} fillOpacity="0.85" />
          <path d="M15 27C17 18 24 12.5 32 12" fill="none" stroke="#fff" strokeOpacity="0.9" strokeWidth="3" strokeLinecap="round" />
          <circle cx="44" cy="17" r="1.8" fill="#fff" fillOpacity="0.8" />
        </g>
      );
    },
  },
  renew: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('renew-f', c2);
      const p = 'M17 55C33 51 48 45 44 36C40 28 20 33 22 24C24 16 38 17 40 9';
      return (
        <g>
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path d={p} fill="none" stroke={c2} strokeOpacity="0.45" strokeWidth="8" strokeLinecap="round" />
          <path d={p} fill="none" stroke={K} strokeWidth="4.6" strokeLinecap="round" />
          <path d={p} fill="none" stroke={c1} strokeWidth="2.6" strokeLinecap="round" />
          <Leaf x={44} y={37} r={-20} s={1.1} fill={u(f)} />
          <Leaf x={22} y={25} r={200} s={1.1} fill={u(f)} />
          <Leaf x={40} y={10} r={-60} s={0.8} fill={u(f)} />
          <Sparkle x={14} y={40} r={3.5} fill={c1} />
          <Sparkle x={52} y={22} r={3} fill={c1} />
        </g>
      );
    },
  },
  heal: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('heal-f', c2);
      const g = gid('heal-g', c1);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
            <Glow id={g} c={c1} o={0.9} />
          </defs>
          <circle cx="32" cy="27" r="19" fill={u(g)} />
          <path d="M32 6V12M19 11L22.5 16M45 11L41.5 16M12 22L17.5 24M52 22L46.5 24" stroke={c1} strokeWidth="2" strokeLinecap="round" />
          <circle cx="32" cy="30" r="6.5" fill={c1} />
          <path d="M7 33Q7 29 10 29Q13 29 13 33Q13 30 16 30Q19 30 18.5 35C20 42 25 46 32 46V55C18 55 7 47 7 33Z" fill={u(f)} stroke={K} strokeWidth="1.6" />
          <path d="M57 33Q57 29 54 29Q51 29 51 33Q51 30 48 30Q45 30 45.5 35C44 42 39 46 32 46V55C46 55 57 47 57 33Z" fill={u(f)} stroke={K} strokeWidth="1.6" />
          <path d="M13 33L13.5 38M51 33L50.5 38" stroke={K} strokeWidth="1.1" strokeOpacity="0.6" />
        </g>
      );
    },
  },
  'flash-heal': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('flash-heal-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <polygon points={star(32, 32, 8, [25, 23], 5, -90)} fill={c2} stroke={K} strokeWidth="1.3" />
          <polygon points={star(32, 32, 8, [14, 18], 4, -90)} fill={c1} fillOpacity="0.8" />
          <path d="M28 16h8v12h12v8h-12v12h-8v-12h-12v-8h12z" fill={u(f)} stroke={K} strokeWidth="1.7" />
          <path d="M28.6 27.4V16.6h6.8" fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth="1.2" />
        </g>
      );
    },
  },
  'greater-heal': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('greater-heal-f', c2);
      const g = gid('greater-heal-g', c1);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
            <Glow id={g} c={c1} o={0.85} />
          </defs>
          <circle cx="32" cy="32" r="26" fill={u(g)} />
          <path d="M47.5 16.5L53 11M47.5 47.5L53 53M16.5 47.5L11 53M16.5 16.5L11 11" stroke={c1} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="32" cy="32" r="19" fill="none" stroke={K} strokeWidth="5" />
          <circle cx="32" cy="32" r="19" fill="none" stroke={c2} strokeWidth="2.6" />
          <path d="M25 7h14v18h18v14h-18v18h-14v-18h-18v-14h18z" fill={u(f)} stroke={K} strokeWidth="1.9" />
          <path d="M26 24V8h12M8 38V26h17" fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="1.3" />
        </g>
      );
    },
  },
  prayer: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('prayer-f', c2);
      const g = gid('prayer-g', c1);
      // Left hand: fingers fan out in steps from the shared fingertip; the right hand mirrors it.
      const hand =
        'M32 46V10C32 6.5 27.5 6.5 27.5 10V12C26 9.6 22.4 10.6 23 14.5V17C21.4 15.2 18.4 16.6 19.2 20.5V23C17.4 21.8 15 24 16.2 27.5C16.8 33 18.8 37 21 40L23 46Z';
      const seams = 'M27.5 12L29.5 28M23 16.5L26 31M19.2 22.5L22.5 33M32 42C29 40 28 35 29 30.5';
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
            <Glow id={g} c={c1} o={0.7} />
          </defs>
          <circle cx="32" cy="22" r="22" fill={u(g)} />
          <path d="M32 2.5V5.5M20 4L22 7.5M44 4L42 7.5M9 15L13 17M55 15L51 17" stroke={c1} strokeWidth="2" strokeLinecap="round" />
          <g transform="translate(64 0) scale(-1 1)">
            <path d={hand} fill={mix(c2, c3, 0.35)} stroke={K} strokeWidth="1.7" />
            <path d={seams} fill="none" stroke={K} strokeOpacity="0.6" strokeWidth="1.2" strokeLinecap="round" />
          </g>
          <path d={hand} fill={u(f)} stroke={K} strokeWidth="1.7" />
          <path d={seams} fill="none" stroke={K} strokeOpacity="0.6" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M17.5 26C18 21 21 17 25 14" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M21 45H43L47 57H17Z" fill={mix(c3, '#000000', 0.25)} stroke={K} strokeWidth="1.6" />
          <path d="M21.5 45.8H42.5" stroke={c2} strokeWidth="2.2" />
        </g>
      );
    },
  },
  'holy-fire': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('holy-fire-f', c2);
      return (
        <g fill="none" strokeLinecap="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path d="M14 18A18 6.5 0 0 1 50 18" stroke={K} strokeWidth="5" />
          <path d="M14 18A18 6.5 0 0 1 50 18" stroke={c1} strokeWidth="2.6" />
          <Flame x={32} y={41} s={1.12} outer={u(f)} inner={c1} />
          <path d="M50 18A18 6.5 0 0 1 14 18" stroke={K} strokeWidth="5" />
          <path d="M50 18A18 6.5 0 0 1 14 18" stroke={c1} strokeWidth="2.6" />
          <Sparkle x={52} y={40} r={3} fill={c1} />
          <Sparkle x={12} y={44} r={2.6} fill={c1} />
        </g>
      );
    },
  },
  smite: {
    draw: ({ c1, c2, c3 }) => {
      const b = gid('smite-b', c2);
      return (
        <g strokeLinecap="round">
          <defs>
            <linearGradient id={b} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={c2} stopOpacity="0.2" />
              <stop offset="0.6" stopColor={c2} stopOpacity="0.9" />
              <stop offset="1" stopColor={c1} />
            </linearGradient>
          </defs>
          {/* a column of light crashing down from above onto an impact burst */}
          <path d="M19 4H45L37 44H27Z" fill={u(b)} />
          <path d="M26 4L30 40M38 4L34 40" stroke={c1} strokeOpacity="0.55" strokeWidth="1.4" />
          <path d="M32 4V42" stroke={K} strokeWidth="5.4" />
          <path d="M32 4V42" stroke={c1} strokeWidth="3" />
          <path d="M12 12L15 26M52 12L49 26" stroke={c2} strokeOpacity="0.7" strokeWidth="1.6" />
          <ellipse cx="32" cy="49" rx="22" ry="5.5" fill={c2} fillOpacity="0.45" />
          <polygon points={star(32, 45, 8, [12.5, 9], 4, -90)} fill={c1} stroke={K} strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="32" cy="45" r="3.6" fill="#fff" />
          <path d="M15 52H8M49 52H56" stroke={c1} strokeWidth="2" />
        </g>
      );
    },
  },
  'inner-fire': {
    draw: ({ c1, c2, c3 }) => {
      const g = gid('inner-fire-g', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Glow id={g} c={c2} o={0.9} />
          </defs>
          <circle cx="32" cy="18" r="8.5" fill="#0c0812" stroke={c2} strokeWidth="1.5" />
          <path d="M9 57C9 42 18 31 32 31C46 31 55 42 55 57Z" fill="#0c0812" stroke={c2} strokeWidth="1.5" />
          <path d="M11 52C12 41 20 33.5 30 33M24.5 15C25.5 12 28 10.5 31 10.3" fill="none" stroke={c1} strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="32" cy="45" r="13" fill={u(g)} />
          <Flame x={32} y={47} s={0.62} outer={c2} inner={c1} />
        </g>
      );
    },
  },
  dispel: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('dispel-f', c2);
      const arc = 'M48.4 20.5A20 20 0 0 1 48.4 43.5';
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          {[
            [4, 3.5],
            [96, 3.5],
            [184, 3.5],
            [272, 3.5],
          ].map(([r, d]) => (
            <g key={r} transform={`rotate(${r} 32 32) translate(${d} 0)`} fill="none" strokeLinecap="round">
              <path d={arc} stroke={K} strokeWidth="6" />
              <path d={arc} stroke={c2} strokeWidth="3.4" />
              <path d="M52 30.5L49 32L52 33.5" stroke={c1} strokeWidth="1.3" />
            </g>
          ))}
          <polygon points="32,18 22,32 32,46 30,38 34,31 30,25" transform="translate(-2.6 -1.2)" fill={u(f)} stroke={K} strokeWidth="1.5" />
          <polygon points="32,18 42,32 32,46 30,38 34,31 30,25" transform="translate(2.6 1.2)" fill={u(f)} stroke={K} strokeWidth="1.5" />
          <g fill={c1} stroke={K} strokeWidth="0.9">
            <path d="M52 10L56 12L53 15Z" />
            <path d="M54 52L50 55L51 50Z" />
            <path d="M10 53L9 49L13 51Z" />
            <path d="M11 10L15 9L13 13Z" />
          </g>
        </g>
      );
    },
  },
  cure: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('cure-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} d={0.7} />
          </defs>
          <rect x="27" y="5" width="10" height="6.5" rx="1.5" fill="#9a6a3a" stroke={K} strokeWidth="1.4" />
          <path d="M28 11V18C22 19 19 22 19 27V51C19 54 22 56 25 56H39C42 56 45 54 45 51V27C45 22 42 19 36 18V11Z" fill={c1} fillOpacity="0.14" />
          <path d="M19.8 30H44.2V51C44.2 53.5 42 55.2 39 55.2H25C22 55.2 19.8 53.5 19.8 51Z" fill={u(f)} />
          <path d="M28 11V18C22 19 19 22 19 27V51C19 54 22 56 25 56H39C42 56 45 54 45 51V27C45 22 42 19 36 18V11Z" fill="none" stroke={K} strokeWidth="2" />
          <path d="M29 33h6v6h6v6h-6v6h-6v-6h-6v-6h6z" fill={c1} stroke={K} strokeWidth="1.4" />
          <path d="M22.5 27V48" stroke="#fff" strokeOpacity="0.75" strokeWidth="2" strokeLinecap="round" />
          <rect x="26" y="10" width="12" height="3" rx="1.5" fill={c1} stroke={K} strokeWidth="1.2" />
        </g>
      );
    },
  },
  wand: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('wand-f', c2);
      const g = gid('wand-g', c1);
      return (
        <g strokeLinecap="round" strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
            <Glow id={g} c={c1} o={0.9} />
          </defs>
          <path d="M11 54L39 26" stroke={K} strokeWidth="6.5" />
          <path d="M11 54L39 26" stroke={c2} strokeWidth="3.8" />
          <path d="M16 46L20 50M20.5 41.5L24.5 45.5M30 32L34 36" stroke={c1} strokeWidth="1.8" />
          <path d="M38 27C33 22 35 16 41 14M38 27C43 32 49 30 51 24" fill="none" stroke={K} strokeWidth="4.4" />
          <path d="M38 27C33 22 35 16 41 14M38 27C43 32 49 30 51 24" fill="none" stroke={c2} strokeWidth="2.2" />
          <polygon points="50,14 47.5,21.5 40,24 42.5,16.5" fill={u(f)} stroke={K} strokeWidth="1.4" />
          <circle cx="49" cy="15" r="11" fill={u(g)} />
          <Sparkle x={49} y={14} r={8} fill={c1} />
          <Sparkle x={56} y={27} r={3} fill={c1} />
          <Sparkle x={38} y={8} r={2.6} fill={c1} />
        </g>
      );
    },
  },
  devour: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('devour-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} d={0.75} />
          </defs>
          <path
            d="M14 42C7 42 7 31 15 31C14 22 24 18 29 23C32 15 44 16 45 24C52 23 57 31 52 36C57 41 52 48 46 45C42 51 32 51 30 46C24 51 14 49 14 42Z"
            fill={u(f)}
            stroke={K}
            strokeWidth="1.7"
          />
          <path d="M21 33C22 30 26 30 27 33C26 36 22 36 21 33ZM37 33C38 30 42 30 43 33C42 36 38 36 37 33Z" fill={K} />
          <path d="M26 41L28 39L30 41L32 39L34 41L36 39L38 41" fill="none" stroke={K} strokeWidth="1.6" />
          {[
            [12, 14, -20],
            [50, 11, 15],
            [55, 53, 30],
            [16, 55, -35],
            [33, 9, 5],
          ].map(([x, y, r]) => (
            <g key={x} transform={`translate(${x} ${y}) rotate(${r})`}>
              <ellipse cx="-2.6" cy="-1.8" rx="3" ry="1.5" transform="rotate(30 -2.6 -1.8)" fill={c1} fillOpacity="0.75" />
              <ellipse cx="2.6" cy="-1.8" rx="3" ry="1.5" transform="rotate(-30 2.6 -1.8)" fill={c1} fillOpacity="0.75" />
              <ellipse cx="0" cy="0.6" rx="1.8" ry="3" fill={K} stroke={c2} strokeWidth="0.8" />
            </g>
          ))}
        </g>
      );
    },
  },
  'touch-weakness': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('touch-weakness-f', c2);
      const fing = 'M27 36L25 27L22 20L20 14M31.5 35L31 25L30 16L31 10M36 35L37 26L39 18L40 12M40.5 37L44 30L47 25L49 21M24 45L18 41L14 35L13 31';
      return (
        <g strokeLinecap="round" strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path d={fing} fill="none" stroke={K} strokeWidth="6.6" />
          <path d="M22 57V47C20 41 22 36 26 34H40C44 36 44 42 42 48V57Z" fill={u(f)} stroke={K} strokeWidth="1.6" />
          <path d={fing} fill="none" stroke={c2} strokeWidth="4" />
          <path d="M27.5 37.5L25.5 28.5L22.5 21.5M31.8 36L31.3 26.5" fill="none" stroke={c1} strokeOpacity="0.7" strokeWidth="1.2" />
          <g fill={c3}>
            <circle cx="25" cy="27" r="1.4" />
            <circle cx="31" cy="25" r="1.4" />
            <circle cx="37" cy="26" r="1.4" />
            <circle cx="44" cy="30" r="1.4" />
            <circle cx="18" cy="41" r="1.4" />
          </g>
          <path d="M30 44C29 48 31 50 30 53M36 43C37 47 35 49 36 52" fill="none" stroke={c3} strokeWidth="1.5" />
          <path d="M48 44C50 47 50 49 48 50C46 49 46 47 48 44ZM53 36C54.5 38.5 54.5 40 53 41C51.5 40 51.5 38.5 53 36Z" fill={c2} stroke={K} strokeWidth="1" />
        </g>
      );
    },
  },
  'power-infusion': {
    draw: ({ c1, c2, c3 }) => {
      const g = gid('power-infusion-g', c1);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Glow id={g} c={c1} o={0.95} />
          </defs>
          <polygon points={star(32, 31, 14, [27, 19], 8, -90)} fill={c2} stroke={K} strokeWidth="1.2" />
          <circle cx="32" cy="31" r="15" fill={u(g)} />
          <path
            d="M26.5 22.5L19.5 9L23.5 7L30.5 20.5H33.5L40.5 7L44.5 9L37.5 22.5L36.5 36L40 56H34.5L32 44L29.5 56H24L27.5 36Z"
            fill={K}
            stroke={c1}
            strokeWidth="1.4"
          />
          <circle cx="32" cy="13.5" r="4.4" fill={K} stroke={c1} strokeWidth="1.4" />
        </g>
      );
    },
  },
  penance: {
    draw: ({ c1, c2, c3 }) => {
      // A channelled beam carrying three bolts (horizontal, so it never reads as claw slashes).
      const g = gid('penance-g', c2);
      const h = gid('penance-h', c1);
      return (
        <g transform="rotate(-18 32 32)" strokeLinejoin="round">
          <defs>
            <linearGradient id={g} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={c2} stopOpacity="0.9" />
              <stop offset="1" stopColor={c2} stopOpacity="0.15" />
            </linearGradient>
            <Glow id={h} c={c1} o={0.95} />
          </defs>
          <path d="M8 24L60 28.5V35.5L8 40Z" fill={u(g)} />
          <path d="M8 32H60" stroke={c1} strokeWidth="1.8" strokeOpacity="0.85" />
          <circle cx="9" cy="32" r="11" fill={u(h)} />
          {[19, 35, 51].map((x) => (
            <g key={x}>
              <path d={`M${x + 7} 32L${x} 24L${x - 6.5} 32L${x} 40Z`} fill={c1} stroke={K} strokeWidth="1.7" />
              <path d={`M${x + 4} 32H${x - 3.5}`} stroke={c2} strokeWidth="2" />
            </g>
          ))}
        </g>
      );
    },
  },
  spirit: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('spirit-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <linearGradient id={f} x1="0.3" y1="0" x2="0.5" y2="1">
              <stop offset="0" stopColor={c1} />
              <stop offset="0.55" stopColor={c2} stopOpacity="0.9" />
              <stop offset="1" stopColor={c2} stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <path
            d="M32 7C42 7 47 15 46 25C45 35 40 41 36 47C33 52 29 57 21 57C26 53 27 49 25 46C19 43 16 35 17 25C17 15 22 7 32 7Z"
            fill={u(f)}
            stroke={c1}
            strokeOpacity="0.6"
            strokeWidth="1.2"
          />
          <ellipse cx="26.5" cy="23" rx="3" ry="4.2" fill={K} />
          <ellipse cx="37.5" cy="23" rx="3" ry="4.2" fill={K} />
          <ellipse cx="32" cy="33" rx="2.4" ry="3.4" fill={K} />
          <path d="M20 21C20 14 24 10 30 9.5" fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth="1.6" strokeLinecap="round" />
          <Sparkle x={12} y={40} r={3.4} fill={c1} />
          <Sparkle x={52} y={30} r={2.8} fill={c1} />
          <circle cx="50" cy="45" r="1.6" fill={c1} fillOpacity="0.7" />
          <circle cx="14" cy="50" r="1.2" fill={c1} fillOpacity="0.55" />
        </g>
      );
    },
  },
  // ---------------------------------------------------------------- celestial / misc
  star: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('star-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <polygon points={star(32, 34, 5, 24, 10)} fill={u(f)} stroke={K} strokeWidth="1.8" />
          <path
            d={
              'M32 34L' +
              star(32, 34, 5, 24, 10)
                .split(' ')
                .filter((_, i) => i % 2)
                .join('M32 34L')
            }
            stroke={K}
            strokeOpacity="0.35"
            strokeWidth="1"
          />
          <path d="M32 11.5L28.5 25" stroke="#fff" strokeOpacity="0.8" strokeWidth="1.3" />
          <Sparkle x={52} y={13} r={4} fill={c1} />
          <Sparkle x={11} y={14} r={2.6} fill={c1} />
        </g>
      );
    },
  },
  sun: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('sun-f', c2);
      const g = gid('sun-g', c1);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} d={0.45} />
            <Glow id={g} c={c1} o={0.6} />
          </defs>
          <circle cx="32" cy="32" r="26" fill={u(g)} />
          <polygon points={star(32, 32, 12, [25, 19], 13)} fill={c2} stroke={K} strokeWidth="1.4" />
          <circle cx="32" cy="32" r="12.5" fill={u(f)} stroke={K} strokeWidth="1.8" />
          <path d="M23.5 30C24 25 28 21.5 32.5 21.5" fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    },
  },
  moon: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('moon-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path d="M42 9A23 23 0 1 0 55 40A18 18 0 1 1 42 9Z" fill={u(f)} stroke={K} strokeWidth="1.8" />
          <g fill={c3} fillOpacity="0.45">
            <circle cx="20" cy="27" r="3" />
            <circle cx="24" cy="42" r="2.2" />
            <circle cx="33" cy="48" r="1.6" />
          </g>
          <path d="M15 22C18 15 25 10 33 9" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.4" strokeLinecap="round" />
          <Sparkle x={47} y={24} r={4.5} fill={c1} />
          <Sparkle x={54} y={13} r={2.4} fill={c1} />
        </g>
      );
    },
  },
  hourglass: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('hourglass-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path
            d="M20 13C20 24 30 28 30 32C30 36 20 40 20 51H44C44 40 34 36 34 32C34 28 44 24 44 13Z"
            fill={c1}
            fillOpacity="0.14"
            stroke={c1}
            strokeOpacity="0.8"
            strokeWidth="1.5"
          />
          <path d="M23 20H41C39 25 33 27.5 32 30.5C31 27.5 25 25 23 20Z" fill={c1} />
          <path d="M32 30V46" stroke={c1} strokeWidth="1.3" />
          <path d="M21.5 50.5C23 44 28 41.5 32 41.5C36 41.5 41 44 42.5 50.5Z" fill={c1} />
          <path d="M17 13V51M47 13V51" stroke={K} strokeWidth="4.4" />
          <path d="M17 13V51M47 13V51" stroke={c2} strokeWidth="2.4" />
          <rect x="12" y="7" width="40" height="6.5" rx="2" fill={u(f)} stroke={K} strokeWidth="1.6" />
          <rect x="12" y="50.5" width="40" height="6.5" rx="2" fill={u(f)} stroke={K} strokeWidth="1.6" />
        </g>
      );
    },
  },
  'potion-red': {
    draw: ({ c1 }) => <Potion n={gid('potion-red', c1)} liquid={['#ff9a8a', '#e04040', '#5a0c12']} c1={c1} />,
  },
  'potion-blue': {
    draw: ({ c1 }) => <Potion n={gid('potion-blue', c1)} liquid={['#a8c8ff', '#3f7fff', '#0c2260']} c1={c1} />,
  },
  bread: {
    draw: ({ c1 }) => {
      const f = 'bread-f';
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a="#f6d08c" b="#c47e3a" c="#3e1f08" />
          </defs>
          <path d="M7 41C7 28 19 19 33 19C47 19 58 27 57 40C56 47 48 50 32 50C16 50 7 47 7 41Z" fill={u(f)} stroke={K} strokeWidth="1.8" />
          <path d="M8 42C14 46 24 47 32 47C42 47 52 46 56.5 41" fill="none" stroke="#5e3414" strokeWidth="1.6" />
          <g strokeLinecap="round">
            <path d="M19 27L25 36M30 23L35.5 33M41 23L46 32" stroke="#5e3414" strokeWidth="3.6" />
            <path d="M19.5 26.5L24.5 34M30.5 22.5L35 31M41.5 22.5L45.5 30" stroke="#fde7b6" strokeWidth="1.6" />
          </g>
          <path d="M11 34C14 26 22 21.5 30 21" fill="none" stroke={c1} strokeOpacity="0.7" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="15" cy="54" r="1.4" fill="#c47e3a" />
          <circle cx="47" cy="55" r="1.1" fill="#c47e3a" />
        </g>
      );
    },
  },
  cup: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('cup-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path d="M47.5 27C56 26 57 41 46 42" fill="none" stroke={K} strokeWidth="6" strokeLinecap="round" />
          <path d="M47.5 27C56 26 57 41 46 42" fill="none" stroke={mix(c2, c3, 0.3)} strokeWidth="3" strokeLinecap="round" />
          <path d="M13 20L18 52C18 55.5 46 55.5 46 52L51 20Z" fill={u(f)} stroke={K} strokeWidth="1.8" />
          <path d="M18.6 49H45.4" stroke={c3} strokeWidth="2.2" />
          <ellipse cx="32" cy="20" rx="19" ry="5" fill={c3} stroke={K} strokeWidth="1.8" />
          <ellipse cx="32" cy="21" rx="16" ry="3.5" fill="#5fb4ee" />
          <path d="M22 21C26 19.5 30 19.5 33 20.5" fill="none" stroke="#e6f6ff" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M17 24L21 49" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M44 4C47.5 9 47.5 12 44 12C40.5 12 40.5 9 44 4Z" fill="#7cc8f5" stroke={K} strokeWidth="1.2" />
        </g>
      );
    },
  },
  bandage: {
    draw: ({ c1, c2 }) => {
      const f = 'bandage-f';
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a="#ffffff" b="#e6dcc6" c="#6d5f48" />
          </defs>
          <path d="M36 43C42 44 46 49 50 53C52 55 55 56 57 55L55 49C51 50 48 46 44 42Z" fill="#d9cdb4" stroke={K} strokeWidth="1.5" />
          <path d="M22 20H38A9 13 0 0 1 38 46H22Z" fill={u(f)} stroke={K} strokeWidth="1.7" />
          <path d="M26 20.2H37M26 45.8H37" stroke={c2} strokeWidth="1.6" />
          <ellipse cx="22" cy="33" rx="9" ry="13" fill="#f3ecdc" stroke={K} strokeWidth="1.7" />
          <ellipse cx="22" cy="33" rx="5.6" ry="8.4" fill="none" stroke="#a89878" strokeWidth="1.2" />
          <ellipse cx="22" cy="33" rx="2.4" ry="3.6" fill="#7a6a50" />
          <path d="M14.5 27C15.5 23 18 21 21 20.4" fill="none" stroke={c1} strokeWidth="1.3" strokeLinecap="round" />
        </g>
      );
    },
  },
  sword: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('sword-f', c2);
      return (
        <g transform="rotate(45 32 32)" strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} x1={0} y1={0} x2={1} y2={0} />
          </defs>
          <polygon points="32,4 37,12 37,41 27,41 27,12" fill={u(f)} stroke={K} strokeWidth="1.7" />
          <path d="M32 12V39" stroke={c3} strokeOpacity="0.7" strokeWidth="1.6" />
          <path d="M28.3 12.5L32 6.5" stroke="#fff" strokeOpacity="0.85" strokeWidth="1.2" />
          <path d="M17 40Q32 45 47 40L47 45Q32 50 17 45Z" fill={c2} stroke={K} strokeWidth="1.6" />
          <rect x="29.3" y="47" width="5.4" height="9" fill={mix(c3, '#000000', 0.3)} stroke={K} strokeWidth="1.3" />
          <path d="M29.5 50L34.5 49M29.5 53L34.5 52" stroke={c2} strokeWidth="1" />
          <circle cx="32" cy="58.5" r="3.4" fill={c1} stroke={K} strokeWidth="1.4" />
        </g>
      );
    },
  },
  axe: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('axe-f', c2);
      return (
        <g transform="translate(32 32) rotate(28) scale(0.86) translate(-32 -32)" strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path d="M35 8V60" stroke={K} strokeWidth="7" strokeLinecap="round" />
          <path d="M35 8V60" stroke={mix(c2, c3, 0.55)} strokeWidth="4.2" strokeLinecap="round" />
          <path d="M33 50H37M33 54H37" stroke={c1} strokeWidth="1.3" />
          <path d="M34 14Q24 17 19 10Q12 8 9 4Q3 22 9 42Q13 37 19 35Q24 28 34 30Z" fill={u(f)} stroke={K} strokeWidth="1.8" />
          <path d="M9.5 7Q5 22 9.8 38.5" fill="none" stroke="#fff" strokeOpacity="0.9" strokeWidth="2" strokeLinecap="round" />
          <path d="M13 11Q9.5 22 13.5 35" fill="none" stroke={K} strokeOpacity="0.45" strokeWidth="1.2" />
          <path d="M36 15L46 20L36 26Z" fill={u(f)} stroke={K} strokeWidth="1.5" />
          <rect x="32" y="11" width="6" height="21" rx="1.2" fill={c3} stroke={K} strokeWidth="1.4" />
          <circle cx="35" cy="21.5" r="1.4" fill={c1} />
        </g>
      );
    },
  },
  'shield-wall': {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('shield-wall-f', c2);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
          </defs>
          <path d="M13 8Q32 4 51 8V38C51 47 43 53 32 58C21 53 13 47 13 38Z" fill={u(f)} stroke={K} strokeWidth="2" />
          <path d="M17 11.5Q32 8.5 47 11.5V38C47 45 41 49.5 32 53.5C23 49.5 17 45 17 38Z" fill="none" stroke={c3} strokeWidth="2" />
          <path d="M32 9V54M15 28H49" stroke={K} strokeWidth="5" />
          <path d="M32 9V54M15 28H49" stroke={c2} strokeWidth="2.6" />
          <circle cx="32" cy="28" r="6" fill={u(f)} stroke={K} strokeWidth="1.6" />
          <g fill={c1} stroke={K} strokeWidth="0.8">
            <circle cx="19" cy="14" r="1.5" />
            <circle cx="45" cy="14" r="1.5" />
            <circle cx="19" cy="42" r="1.5" />
            <circle cx="45" cy="42" r="1.5" />
          </g>
          <path d="M15 36V10.5Q24 7.5 32 7" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.3" />
        </g>
      );
    },
  },
  taunt: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('taunt-f', c2);
      const h = gid('taunt-h', c1);
      return (
        <g strokeLinejoin="round">
          <defs>
            <Lin id={f} a={c1} b={c2} c={c3} />
            <Lin id={h} a="#ffffff" b={c1} c={c3} />
          </defs>
          <path d="M15 24C8 22 5 14 7 6C11 12 14 14 19 16Z" fill={u(h)} stroke={K} strokeWidth="1.5" />
          <path d="M49 24C56 22 59 14 57 6C53 12 50 14 45 16Z" fill={u(h)} stroke={K} strokeWidth="1.5" />
          <path d="M14 30C14 16 22 8 32 8C42 8 50 16 50 30V44L42 48L40 36H24L22 48L14 44Z" fill={u(f)} stroke={K} strokeWidth="1.8" />
          <path d="M24 28H40V48H24Z" fill="#000" />
          <path d="M25 30L30.5 32L25.5 33.5ZM39 30L33.5 32L38.5 33.5Z" fill={c1} />
          <ellipse cx="32" cy="42" rx="4.2" ry="4.6" fill={mix(c3, '#000000', 0.2)} stroke={c2} strokeWidth="1" />
          <path d="M14 27H50" stroke={K} strokeWidth="1.6" />
          <path d="M30 18H34V35H30Z" fill={c3} stroke={K} strokeWidth="1.3" />
          <path d="M17 26C17 18 23 11 31 10.5" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.4" />
          <path d="M27 52L24 57M32 53V58M37 52L40 57" stroke={c1} strokeWidth="2.2" strokeLinecap="round" />
        </g>
      );
    },
  },
  generic: {
    draw: ({ c1, c2, c3 }) => {
      const f = gid('generic-f', c2);
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <defs>
            <Lin id={f} a={mix(c2, c1, 0.3)} b={mix(c2, c3, 0.35)} c={c3} />
          </defs>
          <path d="M32 8L48 17L50 45L32 56L14 45L16 17Z" fill={u(f)} stroke={K} strokeWidth="1.8" />
          <path d="M32 16V48M32 27L24 19M32 27L40 19M32 37L24 45M32 37L40 45" fill="none" stroke={K} strokeWidth="4.4" />
          <path d="M32 16V48M32 27L24 19M32 27L40 19M32 37L24 45M32 37L40 45" fill="none" stroke={c1} strokeWidth="2.2" />
          <path d="M17 19L31 10.5" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.3" />
        </g>
      );
    },
  },
};
