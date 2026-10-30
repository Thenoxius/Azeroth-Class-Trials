// Original SVG art — see SPEC.md (Art). Hero, pet and party portraits.
// 100×100 viewBox, head-and-shoulders centred on (50,50) for a circular crop
// (r≈46). Light comes from the upper left: gradients run light → dark toward
// the lower right and a thin warm rim stroke traces upper-left contours.

const u = (id) => `url(#${id})`;
const lg = (id, a, b, x2 = 0.85, y2 = 1) => (
  <linearGradient id={id} x1="0.1" y1="0" x2={x2} y2={y2}>
    <stop offset="0" stopColor={a} />
    <stop offset="1" stopColor={b} />
  </linearGradient>
);
// soft glow: colour fading to transparent (cheaper and crisper than a blur)
const glow = (id, a, b = a, o = 1) => (
  <radialGradient id={id} cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stopColor={a} stopOpacity={o} />
    <stop offset="1" stopColor={b} stopOpacity="0" />
  </radialGradient>
);
const OL = { stroke: '#08060a', strokeOpacity: 0.75, strokeWidth: 1.2, strokeLinejoin: 'round' };
const rim = (d, c = '#ffe6b8', o = 0.6, w = 1.3) => <path d={d} fill="none" stroke={c} strokeOpacity={o} strokeWidth={w} strokeLinecap="round" />;
// glowing eye pair; halo uses gradient `${p}-eye`
const eyes = (p, core, { y = 44, l = 43.5, r = 56.5, rx = 2.6, ry = 1.3, t = 12, h = 6 } = {}) => (
  <g>
    <circle cx={l} cy={y} r={h} fill={u(p + '-eye')} />
    <circle cx={r} cy={y} r={h} fill={u(p + '-eye')} />
    <ellipse cx={l} cy={y} rx={rx} ry={ry} fill={core} transform={`rotate(${t} ${l} ${y})`} />
    <ellipse cx={r} cy={y} rx={rx} ry={ry} fill={core} transform={`rotate(${-t} ${r} ${y})`} />
  </g>
);

const BUST = 'M6 100C8 85 20 76 35 73h30c15 3 27 12 29 27z';
const HOOD = 'M50 9C31 9 21 25 21 45c0 12 3 22 8 31h42c5-9 8-19 8-31C79 25 69 9 50 9z';
const HOLE = 'M50 19c-13 0-20 11-20 26 0 13 7 23 20 29 13-6 20-16 20-29 0-15-7-26-20-26z';
const BRIM = 'M29.5 47c0-16 8-28 20.5-28s20.5 12 20.5 28c-4-10-11-15-20.5-15S33.5 37 29.5 47z';
const BRIM_EDGE = 'M29.5 47c4-10 11-15 20.5-15s16.5 5 20.5 15';
const HOLE_EDGE = 'M30 45c0 13 7 23 20 29 13-6 20-16 20-29';

// Forsaken face: gaunt, sunken sockets, nose slits, jaw torn open on the right
const forsaken = (p, core, eyeOpt) => (
  <g>
    <path d="M50 24c-9.5 0-15.5 7.5-15.5 18 0 9 3 16 7 21 3 4 5.5 6 8.5 6s5.5-2 8.5-6c4-5 7-12 7-21 0-10.5-6-18-15.5-18z" fill={u(p + '-skin')} {...OL} />
    <path d="M35.5 47c1 7 4 12 8.5 15l-1.5-11c-2-2-4.5-3.5-7-4zM64.5 47c-1 7-4 12-8.5 15l1.5-11c2-2 4.5-3.5 7-4z" fill="#1a2016" opacity=".6" />
    <path d="M42 34q-4 1-6 5M58 34q4 1 6 5" stroke="#1a2016" strokeOpacity=".45" strokeWidth="1.4" fill="none" />
    <ellipse cx="43.5" cy="44" rx="5.2" ry="3.8" fill="#120c16" />
    <ellipse cx="56.5" cy="44" rx="5.2" ry="3.8" fill="#120c16" />
    {eyes(p, core, eyeOpt)}
    <path d="M37.5 49q4-2.5 8.5-.5M54 48.5q4.5-2 8.5.5" stroke="#eef4dc" strokeOpacity=".55" strokeWidth="1.1" fill="none" strokeLinecap="round" />
    <path d="M48.2 49.5h3.6l-.9 4.6-.9-.9-.9.9z" fill="#140e10" />
    <path d="M41.5 60.5q4.5 1.4 9.5.4" stroke="#1a1214" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    <path d="M50.5 60.5q6-1 11-6.5l-1 8.5q-4.5 3.2-10 2z" fill="#140c0e" />
    <path d="M52.6 60.4v3.8M55 59.8v4.2M57.4 58.6v4.4M59.6 57v4.4" stroke="#ddd4b4" strokeWidth="1.2" />
    <path d="M51 64.6q5.5.6 10-3.2M60.5 54.5q2.5-4 2.5-8" stroke="#ddd4b4" strokeWidth="1" fill="none" strokeOpacity=".8" />
    {rim('M37 39c-1 8 1 15 5 21', '#eef6dc', 0.5)}
  </g>
);

// Troll face: heavy brow, long nose, tusks from the lower jaw
const trollFace = (p, shade, big = false) => (
  <g>
    <path d="M50 25c-9 0-15 7-15 17 0 10 2 18 5 24 3 5 6 7 10 7s7-2 10-7c3-6 5-14 5-24 0-10-6-17-15-17z" fill={u(p + '-skin')} {...OL} />
    <path d="M36 41.5q7-6.5 13.5-1v2.6q-6.5-3.6-13.5 1.6zM64 41.5q-7-6.5-13.5-1v2.6q6.5-3.6 13.5 1.6z" fill={shade} />
    <path d="M47.5 43c-1 6-4 9.5-4.5 13 2 3 12 3 14 0-.5-3.5-3.5-7-4.5-13z" fill={u(p + '-skin')} stroke={shade} strokeWidth=".9" />
    <path d="M46.5 55.8h2.4M51.1 55.8h2.4" stroke={shade} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M41 62q9 3.5 18 0" stroke={shade} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    <path
      d={
        big
          ? 'M44.5 64.5C36 63 31 55 32 43c3 8 7 13.5 13.5 17zM55.5 64.5C64 63 69 55 68 43c-3 8-7 13.5-13.5 17z'
          : 'M43.5 63.5C38 61.5 35 55.5 35.5 48.5c2.5 6 5.5 10 10.5 13zM56.5 63.5c5.5-2 8.5-8 8-15-2.5 6-5.5 10-10.5 13z'
      }
      fill="#f3e9cd"
      stroke="#4a3a20"
      strokeWidth=".7"
    />
    {rim('M37 36c2-5 6-9 12-10', '#fff0d0', 0.55)}
  </g>
);
const trollEars = (p, shade) => (
  <g>
    <path d="M36 41C27 36 17 32 9 33c6 7 15 13 26 18zM64 41c9-5 19-9 27-8-6 7-15 13-26 18z" fill={u(p + '-skin')} {...OL} />
    <path d="M34 44c-6-3-12-6-18-8 5 5 11 8 18 11zM66 44c6-3 12-6 18-8-5 5-11 8-18 11z" fill={shade} opacity=".55" />
  </g>
);

// Orc head: broad skull, heavy brow, flat nose, underbite tusks
const orcHead = (p, dark) => (
  <g>
    <path d="M33 41c-4-1-8-3-10-7 0 6 3 11 10 14zM67 41c4-1 8-3 10-7 0 6-3 11-10 14z" fill={u(p + '-skin')} {...OL} />
    <path d="M50 21c-11 0-18 7-18 18 0 8 0 15 2 21 2 7 8 12 16 12s14-5 16-12c2-6 2-13 2-21 0-11-7-18-18-18z" fill={u(p + '-skin')} {...OL} />
    <path d="M36 57c4 8 9 12 14 12s10-4 14-12c-4 3-9 5-14 5s-10-2-14-5z" fill={dark} opacity=".4" />
    <path d="M33.5 41c4-6 10-7 15.5-3v3.2c-5-2.5-10-1.5-15.5 3.8zM66.5 41c-4-6-10-7-15.5-3v3.2c5-2.5 10-1.5 15.5 3.8z" fill={dark} />
    <path d="M46.5 43c-1 4-3 7-2.5 10 3 2.5 9 2.5 12 0 .5-3-1.5-6-2.5-10z" fill={dark} opacity=".3" />
    <path d="M45.5 53.3h2.5M52 53.3h2.5" stroke="#120a06" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M40 61.5q10-3.5 20 0" stroke="#120a06" strokeWidth="1.7" fill="none" strokeLinecap="round" />
    <path d="M42.5 62.5l-2-8.5 5 7.3zM57.5 62.5l2-8.5-5 7.3z" fill="#f0e6c6" stroke="#3a2a14" strokeWidth=".6" />
    {rim('M34 47c-1-11 4-21 15-24', '#fff0c8', 0.55)}
  </g>
);

// Tauren head: horns, side ears, forelock, broad muzzle
const tauren = (p, dark) => (
  <g>
    <path d="M39 26.5C29 28 21 25 18 15c-2.5 11 3 23 17.5 24.5zM61 26.5C71 28 79 25 82 15c2.5 11-3 23-17.5 24.5z" fill={u(p + '-horn')} {...OL} />
    <path d="M27 31.5l2-4.5M73 31.5l-2-4.5" stroke={dark} strokeWidth="1" strokeOpacity=".6" />
    <path d="M35 40c-6-3-13-2-18 2 5 4 12 5 18 3zM65 40c6-3 13-2 18 2-5 4-12 5-18 3z" fill={u(p + '-fur')} {...OL} />
    <path d="M33 42c-4-1-8 0-11 1.5 3 1.5 7 2 11 1zM67 42c4-1 8 0 11 1.5-3 1.5-7 2-11 1z" fill="#c88a7a" opacity=".7" />
    <path d="M50 22c-10 0-16 6-16 15 0 8 2 14 4 20 0 9 5 17 12 17s12-8 12-17c2-6 4-12 4-20 0-9-6-15-16-15z" fill={u(p + '-fur')} {...OL} />
    <path d="M41 25c3-5 15-5 18 0-2 5-4 10-9 13-5-3-7-8-9-13z" fill={dark} />
    <path d="M39.5 58c0-6 4.5-9 10.5-9s10.5 3 10.5 9c0 8-4.5 14-10.5 14s-10.5-6-10.5-14z" fill={u(p + '-muzzle')} {...OL} strokeWidth=".8" />
    <ellipse cx="45" cy="61.5" rx="2" ry="3" fill="#1a0e08" transform="rotate(-25 45 61.5)" />
    <ellipse cx="55" cy="61.5" rx="2" ry="3" fill="#1a0e08" transform="rotate(25 55 61.5)" />
    <path d="M36.5 42q5-3 9 0M63.5 42q-5-3-9 0" stroke={dark} strokeWidth="1.8" fill="none" strokeLinecap="round" />
    <ellipse cx="41.5" cy="45" rx="2.4" ry="1.8" fill="#140a04" />
    <ellipse cx="58.5" cy="45" rx="2.4" ry="1.8" fill="#140a04" />
    <circle cx="40.8" cy="44.4" r=".8" fill="#ffd27a" />
    <circle cx="57.8" cy="44.4" r=".8" fill="#ffd27a" />
    {rim('M35 44c-1-9 3-17 11-21', '#fff0d0', 0.5)}
  </g>
);

// Hooded figure body: hood, dark opening (face goes between this and the brim)
const hoodBack = (fill, inner = '#09060c') => (
  <g>
    <path d={HOOD} fill={fill} {...OL} />
    <path d={HOLE} fill={inner} />
  </g>
);

export const PORTRAITS_HEROES = {
  'undead-priest': {
    bg: ['#5d4876', '#130d1b'],
    draw: () => {
      const p = 'undead-priest';
      return (
        <g>
          <defs>
            {lg(p + '-robe', '#6e4c96', '#1c0f28')}
            {lg(p + '-skin', '#bccaa6', '#56664c')}
            {glow(p + '-eye', '#d6b4ff')}
          </defs>
          <path d={BUST} fill={u(p + '-robe')} {...OL} />
          <path d="M38 73l-5 27h11l4-26zM62 73l5 27H56l-4-26z" fill="#ece6f2" stroke="#e0b450" strokeWidth="1.2" />
          {hoodBack(u(p + '-robe'))}
          {forsaken(p, '#f8f0ff')}
          <path d={BRIM} fill={u(p + '-robe')} />
          <path d={BRIM_EDGE + HOLE_EDGE} fill="none" stroke="#efe8f6" strokeWidth="2.2" />
          <path d={BRIM_EDGE} fill="none" stroke="#e0b450" strokeWidth="0.9" transform="translate(0 2)" />
          <path d={HOLE_EDGE} fill="none" stroke="#e0b450" strokeWidth="0.9" />
          <circle cx="50" cy="88" r="4.5" fill="#e8c060" stroke="#5a3a10" strokeWidth="0.8" />
          <path d="M50 84.5v7M46.5 88h7" stroke="#fff6d8" strokeWidth="1.3" />
          {rim('M25 62C21 48 24 28 40 14', '#cfb0ff', 0.55, 1.6)}
        </g>
      );
    },
  },

  'undead-mage': {
    bg: ['#2e4482', '#0a0d20'],
    draw: () => {
      const p = 'undead-mage';
      return (
        <g>
          <defs>
            {lg(p + '-robe', '#4e52b8', '#14123a')}
            {lg(p + '-skin', '#aebcae', '#4e5c56')}
            {glow(p + '-eye', '#7fe8ff')}
            {glow(p + '-orb', '#e6fdff', '#56c8ff')}
          </defs>
          <path d="M29 80C19 64 15 46 17 26c9 9 17 22 22 40zM71 80c10-16 14-34 12-54-9 9-17 22-22 40z" fill={u(p + '-robe')} {...OL} />
          <path d="M20.5 31c6 9 11 19 15 31M79.5 31c-6 9-11 19-15 31" stroke="#8fe2ff" strokeWidth="1.5" fill="none" strokeOpacity=".85" />
          <path d={BUST} fill={u(p + '-robe')} {...OL} />
          <path d="M40 73l10 23 10-23" fill="#0c0b24" stroke="#8fe2ff" strokeWidth="1.8" />
          <path d="M43 63h14l1 11H42z" fill="#2a3430" />
          {forsaken(p, '#effdff')}
          <path
            d="M34 42c0-12 6.5-19 16-19s16 7 16 19c0 10 1 22-1 32h-5c1-12 1-24-1-32-2-6-5-9-9-10-4 1-7 4-9 10-2 8-2 20-1 32h-5c-2-10-1-22-1-32z"
            fill="#24202c"
            {...OL}
            strokeWidth=".9"
          />
          <path d="M37 40c-1 9-1 20 0 30M47 25c-5 2-8 7-9 12M63 40c1 9 1 20 0 30" stroke="#5e5470" strokeWidth=".9" fill="none" strokeLinecap="round" />
          {rim('M36 36c2-6 7-11 14-11', '#eef6dc', 0.6)}
          <circle cx="73" cy="81" r="12" fill={u(p + '-orb')} />
          <circle cx="73" cy="81" r="4.2" fill="#f2feff" />
          <path d="M73 74v14M66 81h14M68 76l10 10M78 76L68 86" stroke="#c8f4ff" strokeWidth=".9" strokeOpacity=".8" />
          <path d="M65 93c1-5 3-7 6-7.5M69.5 95c1-4 4-6 7-5.5M75 94c0-3 2-5 4.5-5" stroke="#d8d2bc" strokeWidth="1.7" fill="none" strokeLinecap="round" />
          {rim('M18 30c1 14 5 28 11 42', '#bfe8ff', 0.5)}
        </g>
      );
    },
  },

  'troll-mage': {
    bg: ['#5e3184', '#150a22'],
    draw: () => {
      const p = 'troll-mage';
      return (
        <g>
          <defs>
            {lg(p + '-robe', '#8c56c4', '#281044')}
            {lg(p + '-skin', '#7aaeea', '#244c86')}
            {glow(p + '-eye', '#e6b8ff', '#c78bff')}
          </defs>
          <path d={BUST} fill={u(p + '-robe')} {...OL} />
          <path d="M35 75q15 9 30 0" stroke="#e0b450" strokeWidth="2" fill="none" />
          <circle cx="50" cy="86" r="4" fill="#f0dcff" />
          <circle cx="50" cy="86" r="8" fill={u(p + '-eye')} />
          {hoodBack(u(p + '-robe'))}
          {trollFace(p, '#173462')}
          {eyes(p, '#fbefff', { y: 45.5, l: 42.5, r: 57.5 })}
          <path d="M35.5 47c-3 9-3 18 0 28M64.5 47c3 9 3 18 0 28" stroke="#c63426" strokeWidth="4.5" strokeLinecap="round" fill="none" />
          <path d="M33.5 60h4M33.5 68h4M62.5 60h4M62.5 68h4" stroke="#e0b450" strokeWidth="2" />
          <path d={BRIM} fill={u(p + '-robe')} />
          <path d="M41 33.5c3 3 6 4.5 9 4.5s6-1.5 9-4.5c-3 .5-6 .8-9 .8s-6-.3-9-.8z" fill="#d23a2a" />
          <path d={BRIM_EDGE} fill="none" stroke="#d9a8ff" strokeWidth="1.4" />
          {trollEars(p, '#173462')}
          {rim('M25 62C21 48 24 28 40 14', '#e2c4ff', 0.55, 1.6)}
        </g>
      );
    },
  },

  'orc-hunter': {
    bg: ['#7c5a32', '#1c1208'],
    draw: () => {
      const p = 'orc-hunter';
      return (
        <g>
          <defs>
            {lg(p + '-skin', '#9cc262', '#36561c')}
            {lg(p + '-leather', '#9e6838', '#2e1a0a')}
            {lg(p + '-fur', '#b89c74', '#3a2818')}
            {glow(p + '-eye', '#ffb84a')}
          </defs>
          <path d="M88 78C91 66 88 55 81 47" stroke="#4a2a12" strokeWidth="4.5" fill="none" strokeLinecap="round" />
          <path d="M87 74c1-8-1-15-5-21" stroke="#b07a44" strokeWidth="1.2" fill="none" />
          <path d={BUST} fill={u(p + '-leather')} {...OL} />
          <path d="M60 76c8-6 20-6 28 0 4 4 6 10 6 16l-30-4z" fill={u(p + '-leather')} {...OL} />
          <path d="M66 77l20 4M64 83l26 3" stroke="#2a1608" strokeWidth="1.2" />
          <path d="M43 62h14l2 13H41z" fill="#2c4416" />
          {orcHead(p, '#22380e')}
          {eyes(p, '#ffe08a', { y: 45.5, l: 42, r: 58, rx: 2.2, ry: 1.1, h: 4 })}
          <path d="M36.5 32c2-8 7-11.5 13.5-11.5S61.5 24 63.5 32c-4-4-8-5.5-13.5-5.5s-9.5 1.5-13.5 5.5z" fill="#1a1410" />
          <path d="M47 22c-1.5-6 2-10.5 7-11 3 0 5 2 5.5 4.5-3.5-.5-7 1.5-8.5 6z" fill="#1a1410" />
          <path d="M35 37c-4 9-5 19-3 30" stroke="#1a1410" strokeWidth="3.6" fill="none" strokeLinecap="round" />
          <path d="M31.5 50h4M31.5 58h4" stroke="#c8a060" strokeWidth="1.6" />
          <path d="M81 48L37 100" stroke="#e8d8b0" strokeWidth="1.4" />
          <path
            d="M4 100Q1 95 0 88Q4 89 6 86Q3 80 5 74Q9 78 12 75Q12 69 15 64Q18 69 21 67Q23 61 27 58Q29 63 32 63Q35 58 39 57Q40 62 42 64Q47 62 50 64Q48 68 48 70Q52 73 52 78Q49 79 48 81C28 85 15 91 4 100z"
            fill={u(p + '-fur')}
            {...OL}
          />
          <path d="M9 92q2-4 6-6M17 85q2-4 6-6M26 79q2-4 6-5M35 76q2-3 6-4" stroke="#2a1c10" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <path
            d="M2 92q0-3-1.5-4M6 82q-1-5-.5-7M14 70q0-3 1-5M25 62q1-2 2-3.5M37 59.5q1-1 2-2"
            stroke="#fff0d0"
            strokeWidth="1.1"
            fill="none"
            strokeOpacity=".7"
            strokeLinecap="round"
          />
          <circle cx="40" cy="80" r="2.6" fill="#c8a060" stroke="#2a1608" strokeWidth=".8" />
        </g>
      );
    },
  },

  'troll-hunter': {
    bg: ['#2f6a5a', '#08160f'],
    draw: () => {
      const p = 'troll-hunter';
      return (
        <g>
          <defs>
            {lg(p + '-skin', '#6ccabb', '#1c5752')}
            {lg(p + '-leather', '#7a5a3a', '#22160a')}
            {glow(p + '-eye', '#ffd84a')}
          </defs>
          <path d="M66 76l12-50 8 2-10 50z" fill="#5a3a1e" {...OL} />
          <path d="M77 27l-4-8 6 4zM81 27.5l-1-9.5 4 8zM85.5 28.5l2-8.5 1.5 9z" fill="#f2ead8" stroke="#3a2a1a" strokeWidth=".6" />
          <path d="M77 27v-3M81 27.5v-3M85.5 28.5l.5-3" stroke="#c43a2a" strokeWidth="2" />
          <path d={BUST} fill={u(p + '-leather')} {...OL} />
          <path d="M30 74l40 26M28 80l32 20" stroke="#3a2412" strokeWidth="3" />
          <path d="M43 63h14l2 12H41z" fill="#18403c" />
          <path d="M43 27l2-11 3 9 2-12 3 12 3-9 1 11z" fill="#ee8a2a" {...OL} strokeWidth=".8" />
          {trollFace(p, '#123a36', true)}
          {eyes(p, '#fff6c8', { y: 45.5, l: 42.5, r: 57.5, h: 5 })}
          <path d="M35 37q15-6.5 30 0l-.4 4.2q-14.6-5.6-29.2 0z" fill="#a8402a" {...OL} strokeWidth=".8" />
          <path d="M41 35.6v3.6M46 34.4v3.6M50 34v3.6M54 34.4v3.6M59 35.6v3.6" stroke="#f0d890" strokeWidth="1.3" />
          <path d="M36 37c-5-6-7.5-14-5.5-23 3.5 7 5.5 14 6.5 22z" fill="#f4eee0" {...OL} strokeWidth=".7" />
          <path d="M39.5 36c-2.5-8-1.5-16 2.5-22 .5 8 .5 15-1 22z" fill="#e8822a" {...OL} strokeWidth=".7" />
          <path d="M31 15l2.5 6M42 14l-1 6" stroke="#2a1a10" strokeWidth="1.6" />
          {trollEars(p, '#123a36')}
        </g>
      );
    },
  },

  'tauren-hunter': {
    bg: ['#7a5a36', '#1a1008'],
    draw: () => {
      const p = 'tauren-hunter';
      return (
        <g>
          <defs>
            {lg(p + '-fur', '#a8723e', '#3e2410')}
            {lg(p + '-horn', '#f2e6c8', '#8a7656')}
            {lg(p + '-muzzle', '#d4ae84', '#7a5636')}
            {lg(p + '-leather', '#8a6a3e', '#2a1a0a')}
          </defs>
          <path d={BUST} fill={u(p + '-leather')} {...OL} />
          <path d="M28 74q22 14 44 0q-4 10-22 12q-18-2-22-12z" fill="#5a3818" {...OL} />
          {tauren(p, '#3a200c')}
          <path d="M35 46l-2 26M65 46l2 26" stroke="#4a2c12" strokeWidth="3.6" strokeLinecap="round" />
          <circle cx="34.2" cy="56" r="2" fill="#3fb8b0" />
          <circle cx="33.6" cy="62" r="2" fill="#e8e0c8" />
          <circle cx="65.8" cy="56" r="2" fill="#d23a2a" />
          <circle cx="66.4" cy="62" r="2" fill="#3fb8b0" />
          <path d="M23 21c-4 4-6 10-5 17 3-5 5-11 5-17zM27 24c-2 5-2 11 0 17 2-6 2-11 0-17z" fill="#f6f0e2" {...OL} strokeWidth=".7" />
          <path d="M18 38l2-5M27 41v-5" stroke="#1a1008" strokeWidth="2" />
          <path d="M22 21l3 2" stroke="#d23a2a" strokeWidth="2.4" />
        </g>
      );
    },
  },

  'undead-hunter': {
    bg: ['#3e4c2c', '#0c1008'],
    draw: () => {
      const p = 'undead-hunter';
      return (
        <g>
          <defs>
            {lg(p + '-cloak', '#5e6a42', '#151a0c')}
            {lg(p + '-skin', '#efe6cf', '#8a806a')}
            {glow(p + '-eye', '#8aff6a', '#3fd84a')}
          </defs>
          <path d="M86 70C90 52 84 34 72 22" stroke="#3a2614" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d={BUST} fill={u(p + '-cloak')} {...OL} />
          <path d="M50 7C33 14 22 28 21 46c0 12 3 22 8 30h42c5-8 8-18 8-30-1-18-12-32-29-39z" fill={u(p + '-cloak')} {...OL} />
          <path d={HOLE} fill="#07060a" />
          <path
            d="M50 28c-8.5 0-13.5 6.5-13.5 15 0 9 3.5 16 8 21 2 2 3.5 3 5.5 3s3.5-1 5.5-3c4.5-5 8-12 8-21 0-8.5-5-15-13.5-15z"
            fill={u(p + '-skin')}
            {...OL}
          />
          <path d="M38.5 41.5l9-.5-1.2 4.2-6.6.3zM61.5 41.5l-9-.5 1.2 4.2 6.6.3z" fill="#0c0a08" />
          {eyes(p, '#e8ffd8', { y: 43.2, l: 43.5, r: 56.5, rx: 2.4, ry: 1, t: 6, h: 5.5 })}
          <path d="M48.6 50.5l-1.2 3h2zM51.4 50.5l1.2 3h-2z" fill="#2a2418" />
          <path d="M45 58.5v4M47.6 59v4.6M50 59.2v4.8M52.4 59v4.6M55 58.5v4" stroke="#2a2418" strokeWidth="1" />
          <path d="M39 49l9-14" stroke="#8a2a1a" strokeWidth="2.2" strokeOpacity=".75" />
          <path d="M60 32l-3 6 2 4-3 5" stroke="#5a5040" strokeWidth=".8" fill="none" />
          <path d="M28 48c0-17 9-29 22-29s22 12 22 29c-5-10-12-16-22-16s-17 6-22 16z" fill={u(p + '-cloak')} />
          <path d="M28 48c5-10 12-16 22-16s17 6 22 16" fill="none" stroke="#0a0c06" strokeWidth="1.4" />
          <circle cx="50" cy="80" r="3.6" fill="#b08d4a" stroke="#3a2a10" strokeWidth=".8" />
          <path d="M30 76l-6 24M70 76l6 24" stroke="#0e1208" strokeWidth="1.6" strokeOpacity=".7" />
          {rim('M25 62C21 46 26 26 46 10', '#d8f0a8', 0.45, 1.6)}
        </g>
      );
    },
  },

  'pet-wolf': {
    bg: ['#4f6a3e', '#10180c'],
    draw: () => {
      const p = 'pet-wolf';
      return (
        <g>
          <defs>
            {lg(p + '-fur', '#b8bec2', '#464c52')}
            {lg(p + '-pale', '#f4f2ec', '#a8a49a')}
          </defs>
          <path d="M8 100c2-16 12-26 24-30l18 6 18-6c12 4 22 14 24 30z" fill={u(p + '-fur')} {...OL} />
          <path
            d="M33 72c5 6 11 9 17 9s12-3 17-9l2 8-4 .5 2.5 5.5-5-.5 1 6.5-5-3-1 7-4-5-3.5 6-3.5-6-4 5-1-7-5 3 1-6.5-5 .5 2.5-5.5-4-.5z"
            fill={u(p + '-pale')}
          />
          <path d="M18 84l4-3M24 78l3-3M82 84l-4-3M76 78l-3-3" stroke="#30343a" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M31 42L28 13l17 14zM69 42l3-29-17 14z" fill={u(p + '-fur')} {...OL} />
          <path d="M32 36l-1.5-16 9 9zM68 36l1.5-16-9 9z" fill="#3a2a2a" />
          <path
            d="M50 24c-12 0-20 8-22 20l-6 12 7-2c3 6 8 10 12 14 3 4 6 8 9 8s6-4 9-8c4-4 9-8 12-14l7 2-6-12c-2-12-10-20-22-20z"
            fill={u(p + '-fur')}
            {...OL}
          />
          <path d="M36 50c3-3 7-3 10-1l1 12c-4 0-8-3-11-11zM64 50c-3-3-7-3-10-1l-1 12c4 0 8-3 11-11z" fill={u(p + '-pale')} />
          <path d="M50 25c-4 4-5 12-3 21h6c2-9 1-17-3-21z" fill="#3a3e44" />
          <path d="M43.5 51c0-4 3-6 6.5-6s6.5 2 6.5 6c0 5 3.5 8 3.5 12.5 0 5.5-4.5 10-10 10s-10-4.5-10-10c0-4.5 3.5-7.5 3.5-12.5z" fill={u(p + '-pale')} />
          <path d="M44.5 59.5q5.5-3.5 11 0-1 5.5-5.5 6.5-4.5-1-5.5-6.5z" fill="#141416" />
          <ellipse cx="48" cy="60" rx="1.6" ry=".8" fill="#9a9aa0" />
          <path d="M50 66v3M43.5 69q3.2 3.2 6.5 0 3.3 3.2 6.5 0" stroke="#1a1a1c" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <path d="M47.5 70.5q2.5 5.5 5 0z" fill="#d86a78" stroke="#5a2028" strokeWidth=".5" />
          <path d="M37.5 44.5q3.5-3 7 0-3.5 2.5-7 0zM55.5 44.5q3.5-3 7 0-3.5 2.5-7 0z" fill="#f2b23a" stroke="#1a1208" strokeWidth=".8" />
          <circle cx="41" cy="44.6" r="1.3" fill="#140c04" />
          <circle cx="59" cy="44.6" r="1.3" fill="#140c04" />
          <circle cx="40.4" cy="44" r=".5" fill="#fff" />
          <circle cx="58.4" cy="44" r=".5" fill="#fff" />
          {rim('M29 41c1-9 8-16 18-17', '#fff4dc', 0.6)}
          {rim('M29 15l2 24', '#fff4dc', 0.5, 1.1)}
        </g>
      );
    },
  },

  'pet-cat': {
    bg: ['#3a6a50', '#08140e'],
    draw: () => {
      const p = 'pet-cat';
      return (
        <g>
          <defs>{lg(p + '-fur', '#e2b874', '#7a5224')}</defs>
          <path d="M10 100c2-14 12-24 26-28h28c14 4 24 14 26 28z" fill={u(p + '-fur')} {...OL} />
          {[
            [26, 84, 2],
            [34, 91, 1.8],
            [21, 94, 1.6],
            [42, 97, 1.6],
            [58, 97, 1.6],
            [66, 89, 1.8],
            [75, 94, 1.8],
            [79, 84, 2],
          ].map(([x, y, r]) => (
            <circle key={x} cx={x} cy={y} r={r} fill="#3a2410" />
          ))}
          <path d="M31 39L29 14l14 15zM69 39l2-25-14 15z" fill={u(p + '-fur')} {...OL} />
          <path d="M29 15l-.5-6 2 6zM71 15l.5-6-2 6z" fill="#1a120a" stroke="#1a120a" strokeWidth="1.6" />
          <path d="M32 33l-1-13 7 8zM68 33l1-13-7 8z" fill="#f0dcc0" />
          <path
            d="M50 26c-12 0-20 8-20 20 0 4-4 11-8 17 7 0 12 3 16 8 4 5 8 7 12 7s8-2 12-7c4-5 9-8 16-8-4-6-8-13-8-17 0-12-8-20-20-20z"
            fill={u(p + '-fur')}
            {...OL}
          />
          <path d="M22 63c6-1 11 1 15 5l3-6c-6-2-12-2-18 1zM78 63c-6-1-11 1-15 5l-3-6c6-2 12-2 18 1z" fill="#f4e6cc" />
          <path d="M50 57c-4-2-10-1-10 4 0 5 5 8 10 5 5 3 10 0 10-5 0-5-6-6-10-4z" fill="#f6eedc" />
          <path d="M47 55.5h6L50 59z" fill="#a8605a" stroke="#3a1a10" strokeWidth=".7" />
          <path d="M50 59v3M46 64q4 2 4-2 0 4 4 2" stroke="#3a2410" strokeWidth=".9" fill="none" />
          <path d="M46 30l1 6M50 28v8M54 30l-1 6M35 50l3 1M65 50l-3 1M34 55l3 1M66 55l-3 1" stroke="#3a2410" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="40" cy="36" r="1.2" fill="#3a2410" />
          <circle cx="60" cy="36" r="1.2" fill="#3a2410" />
          <path
            d="M35.5 46.5q5.5-6 11.5-.5-5.5 5-11.5.5zM64.5 46.5q-5.5-6-11.5-.5 5.5 5 11.5.5z"
            fill="#d6ec4a"
            stroke="#120c04"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M41.3 42.8v6.2M58.7 42.8v6.2" stroke="#0e0a04" strokeWidth="1.9" strokeLinecap="round" />
          <circle cx="39.6" cy="44.6" r=".7" fill="#fff" />
          <circle cx="57" cy="44.6" r=".7" fill="#fff" />
          <path d="M39.5 49.5l-2.5 5.5M60.5 49.5l2.5 5.5" stroke="#3a2410" strokeWidth="1.2" strokeLinecap="round" />
          {rim('M31 41c0-8 7-15 17-15', '#fff4dc', 0.6)}
        </g>
      );
    },
  },

  'pet-boar': {
    bg: ['#8a6a3a', '#1a1208'],
    draw: () => {
      const p = 'pet-boar';
      return (
        <g>
          <defs>
            {lg(p + '-hide', '#8c6448', '#2a160c')}
            {lg(p + '-snout', '#dca48c', '#6a3a2e')}
            {lg(p + '-tusk', '#fffaf0', '#b4a282')}
          </defs>
          <path d="M4 100c1-14 8-24 18-30h56c10 6 17 16 18 30z" fill={u(p + '-hide')} {...OL} />
          <path d="M16 68L13 57h7l-5-11 8 1-3-11 8 2V27l7 4 2-12 6 7 3-14 4 10 4-10 3 14 6-7 2 12 7-4v11l8-2-3 11 8-1-5 11h7l-3 11z" fill="#1e120a" {...OL} />
          <path d="M46 13l1.5 9M37.5 20l3 7M54 13l-1.5 9" stroke="#c89a6a" strokeWidth="1.1" strokeLinecap="round" strokeOpacity=".7" />
          <path d="M31 38L11 30l9 18zM69 38l20-8-9 18z" fill={u(p + '-hide')} {...OL} />
          <path d="M28 39l-11-5 5 9zM72 39l11-5-5 9z" fill="#4a2018" />
          <path d="M50 26c-12 0-21 6-23 16-1 8 4 14 9 20 3 4 4 9 5 14h18c1-5 2-10 5-14 5-6 10-12 9-20-2-10-11-16-23-16z" fill={u(p + '-hide')} {...OL} />
          <path d="M44 44c1 8-1 16-3 24h18c-2-8-4-16-3-24-3-2-9-2-12 0z" fill="#b08262" opacity=".45" />
          <path d="M33 40q7-6 13 1M67 40q-7-6-13 1" stroke="#140a04" strokeWidth="2.8" fill="none" strokeLinecap="round" />
          <ellipse cx="40.5" cy="45" rx="3.2" ry="2.2" fill="#120804" transform="rotate(18 40.5 45)" />
          <ellipse cx="59.5" cy="45" rx="3.2" ry="2.2" fill="#120804" transform="rotate(-18 59.5 45)" />
          <circle cx="41" cy="45" r="1.4" fill="#ff6a2a" />
          <circle cx="59" cy="45" r="1.4" fill="#ff6a2a" />
          <circle cx="40.5" cy="44.4" r=".5" fill="#fff" />
          <circle cx="58.5" cy="44.4" r=".5" fill="#fff" />
          <path d="M36 31l2 4M41 29l1.5 4M47 28l.5 4" stroke="#d8b08a" strokeWidth="1" strokeLinecap="round" strokeOpacity=".7" />
          <path d="M40.5 81q9.5 4 19 0" stroke="#140a04" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <ellipse cx="50" cy="74" rx="11.5" ry="7.2" fill={u(p + '-snout')} {...OL} />
          <ellipse cx="45.5" cy="74.5" rx="2.1" ry="3.2" fill="#2a0e08" transform="rotate(-10 45.5 74.5)" />
          <ellipse cx="54.5" cy="74.5" rx="2.1" ry="3.2" fill="#2a0e08" transform="rotate(10 54.5 74.5)" />
          <path d="M40 80C31 80 25 72 25 61c3 8 8 12 15 13zM60 80c9 0 15-8 15-19-3 8-8 12-15 13z" fill={u(p + '-tusk')} stroke="#3a2a14" strokeWidth=".9" />
          {rim('M27 43c1-9 9-16 21-17', '#ffe2b8', 0.6)}
          {rim('M41 70c3-2 6-3 9-3', '#fff0e0', 0.65, 1)}
          <path d="M14 82l3-3M22 76l2-4M76 76l-2-4M84 82l-3-3M10 92l3-2M88 92l-3-2" stroke="#120804" strokeWidth="1.3" strokeLinecap="round" />
        </g>
      );
    },
  },

  'pet-raptor': {
    bg: ['#6a5a2a', '#161206'],
    draw: () => {
      const p = 'pet-raptor';
      return (
        <g>
          <defs>{lg(p + '-skin', '#eab454', '#7a4212')}</defs>
          <path
            d="M64 30C72 20 80 17 88 20c-6 3-11 8-16 15zM67 37c9-6 18-7 25-3-7 2-13 6-19 11zM67 45c8-2 16 0 21 5-7 0-13 1-19 4z"
            fill="#c63a2a"
            {...OL}
            strokeWidth=".8"
          />
          <path d="M66 33c7-6 12-9 17-9M69 40c7-3 13-4 18-3" stroke="#2fb0a0" strokeWidth="1.6" fill="none" />
          <path d="M56 50c10 10 16 26 18 50H40c2-14 4-26 0-36z" fill={u(p + '-skin')} {...OL} />
          <path d="M50 64c6 0 12 2 18 6M48 76c8 0 15 2 22 6M44 88c9 0 18 2 27 5" stroke="#5a2c0c" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d="M70 36c-6-8-18-8-28-2C32 40 20 43 13 49c0 6 6 9 15 9 9 1 17 3 25 3 11 0 19-8 19-18z" fill={u(p + '-skin')} {...OL} />
          <path d="M17 56c9 6 21 9 33 8l3-4c-12 0-24-2-36-4z" fill="#8a4a18" {...OL} strokeWidth=".8" />
          <path
            d="M20 56.5l1.5 2.6 1.4-2.3M26 57.4l1.5 2.7 1.4-2.3M32 58.2l1.5 2.8 1.4-2.3M38 59l1.4 2.7 1.4-2.2"
            fill="#fff8e8"
            stroke="#fff8e8"
            strokeWidth=".8"
          />
          <path d="M44 36c-1 6 0 12 3 17M54 33c-1 7 0 14 4 20M62 33c-1 5 0 10 3 14" stroke="#5a2c0c" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <path d="M51 41q6-5 12 0-6 4-12 0z" fill="#ffe24a" stroke="#1a0e04" strokeWidth=".9" />
          <path d="M57 38.5v5" stroke="#0e0804" strokeWidth="1.4" />
          <path d="M49 38q7-5 15 0" stroke="#5a2c0c" strokeWidth="2" fill="none" strokeLinecap="round" />
          <ellipse cx="19" cy="48.5" rx="1.6" ry=".9" fill="#2a1406" />
          {rim('M14 48c8-6 18-9 28-14 9-5 18-5 26 0', '#fff2cc', 0.65)}
        </g>
      );
    },
  },

  'orc-warrior': {
    bg: ['#7a2e22', '#1a0806'],
    draw: () => {
      const p = 'orc-warrior';
      return (
        <g>
          <defs>
            {lg(p + '-skin', '#8aa850', '#2c4216')}
            {lg(p + '-plate', '#cfd3d8', '#363a42')}
            {lg(p + '-shield', '#6a3a1e', '#1e0e06')}
            {glow(p + '-eye', '#ff6a3a')}
          </defs>
          <path d={BUST} fill="#2a2a30" {...OL} />
          <path d="M38 73h24l-3 14H41z" fill={u(p + '-plate')} {...OL} />
          <path d="M60 74c6-8 20-10 30-2 5 4 6 12 4 20-10-6-22-8-34-6z" fill={u(p + '-plate')} {...OL} />
          <path d="M64 80c8-3 18-2 28 3M62 86c10-2 20-1 30 4" stroke="#c8a050" strokeWidth="1.4" fill="none" />
          <path d="M76 70l4-14 4 15z" fill={u(p + '-plate')} {...OL} strokeWidth=".9" />
          <path d="M43 62h14l2 12H41z" fill="#22340e" />
          {orcHead(p, '#1c2e0a')}
          {eyes(p, '#ffd2a0', { y: 45.5, l: 42, r: 58, rx: 2.3, ry: 1.1, h: 4.5 })}
          <path d="M35 33l12 20" stroke="#d8968a" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M37 37.5l3-1.5M40 42.5l3-1.5M43 47.5l3-1.5" stroke="#d8968a" strokeWidth="1" />
          <path d="M44 22c1-4 3-6 6-6s5 2 6 6c-2-1-4-1.5-6-1.5s-4 .5-6 1.5z" fill="#141010" />
          <path d="M49 17c0-4 2-7 6-8" stroke="#141010" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M47.5 17.5h5" stroke="#c8a050" strokeWidth="1.8" />
          <circle cx="12" cy="98" r="31" fill={u(p + '-shield')} stroke="#08060a" strokeWidth="5.5" />
          <circle cx="12" cy="98" r="31" fill="none" stroke="#a8acb2" strokeWidth="3.6" />
          {rim('M12 67A31 31 0 0 1 35.7 78.1', '#ffffff', 0.85, 1.3)}
          <circle cx="24.5" cy="69.6" r="1.2" fill="#e8e8ec" />
          <circle cx="36" cy="77.5" r="1.2" fill="#e8e8ec" />
          <circle cx="41.5" cy="90" r="1.2" fill="#e8e8ec" />
          <path d="M25 84l8 8M28 80l9 9" stroke="#3a1e0e" strokeWidth="1" />
        </g>
      );
    },
  },

  'tauren-warrior': {
    bg: ['#5e3a2a', '#140a06'],
    draw: () => {
      const p = 'tauren-warrior';
      return (
        <g>
          <defs>
            {lg(p + '-fur', '#7a4e30', '#24140a')}
            {lg(p + '-horn', '#e8dcc0', '#7a6a4e')}
            {lg(p + '-muzzle', '#b48c6c', '#5a3a26')}
            {lg(p + '-plate', '#d2d6da', '#34383e')}
          </defs>
          <path d={BUST} fill="#2a2628" {...OL} />
          <path d="M34 72c4 6 10 9 16 9s12-3 16-9l2 12c-5 4-11 6-18 6s-13-2-18-6z" fill={u(p + '-plate')} {...OL} />
          <path
            d="M6 92c0-12 8-22 22-24 6 0 10 2 12 6-6 2-10 8-12 16-7-1-15 0-22 2zM94 92c0-12-8-22-22-24-6 0-10 2-12 6 6 2 10 8 12 16 7-1 15 0 22 2z"
            fill={u(p + '-plate')}
            {...OL}
          />
          <path d="M10 84c4-6 10-10 18-11M90 84c-4-6-10-10-18-11" stroke="#c8a050" strokeWidth="1.6" fill="none" />
          <circle cx="20" cy="78" r="1.4" fill="#f0e0a0" />
          <circle cx="80" cy="78" r="1.4" fill="#f0e0a0" />
          {tauren(p, '#1a0c06')}
          <path d="M27 22.5l3 4.5M73 22.5l-3 4.5" stroke="#9aa0a8" strokeWidth="3" />
          <path d="M27 22.5l3 4.5M73 22.5l-3 4.5" stroke="#d8dce0" strokeWidth="1" />
          <path d="M37.5 49l4-4M62.5 49l-4-4M38 53l4-3M62 53l-4-3" stroke="#c82a1e" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="50" cy="67" r="3.2" fill="none" stroke="#e8be5a" strokeWidth="1.7" />
          <path d="M47.5 64.5a3.2 3.2 0 0 1 4.5-.5" stroke="#fff2c0" strokeWidth=".8" fill="none" />
          <path d="M44 84h12" stroke="#c8a050" strokeWidth="1.4" />
        </g>
      );
    },
  },

  'troll-rogue': {
    bg: ['#3e2c4e', '#0c0810'],
    draw: () => {
      const p = 'troll-rogue';
      return (
        <g>
          <defs>
            {lg(p + '-cloth', '#4e4258', '#120e18')}
            {lg(p + '-skin', '#8a8cd0', '#34366e')}
            {lg(p + '-mask', '#8a2a3a', '#2a0a12')}
            {lg(p + '-steel', '#f4f6fa', '#6a7280')}
            {glow(p + '-eye', '#ffd84a')}
          </defs>
          <path d={BUST} fill={u(p + '-cloth')} {...OL} />
          <path d="M26 78l48 22M24 86l26 14" stroke="#2a1e14" strokeWidth="2.6" />
          {hoodBack(u(p + '-cloth'))}
          {trollFace(p, '#1e2050')}
          <path d="M35.5 50q14.5 5 29 0l-2 13q-12.5 10-25 0z" fill={u(p + '-mask')} {...OL} />
          <path d="M38 56q12 4 24 0" stroke="#1a0608" strokeWidth=".9" fill="none" strokeOpacity=".7" />
          <path d="M41 56C36 54 34 49 35 43c2 4 4 7 8 9zM59 56c5-2 7-7 6-13-2 4-4 7-8 9z" fill="#f3e9cd" stroke="#4a3a20" strokeWidth=".7" />
          {eyes(p, '#fff8c0', { y: 44.5, l: 42.5, r: 57.5, rx: 3, ry: 1, t: 14, h: 5.5 })}
          <path d={BRIM} fill={u(p + '-cloth')} />
          <path d="M29.5 47c4-12 11-18.5 20.5-18.5s16.5 6.5 20.5 18.5c-4-9-11-13-20.5-13S33.5 38 29.5 47z" fill={u(p + '-cloth')} />
          {trollEars(p, '#1e2050')}
          <path d="M76 98L85 58l2.5 1-5 40z" fill={u(p + '-steel')} {...OL} strokeWidth=".8" />
          <path d="M71 86l14 4" stroke="#c8a050" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M77 92l-2 8" stroke="#2a1a10" strokeWidth="3.5" />
          {rim('M25 62C21 48 24 28 40 14', '#c8b8e8', 0.45, 1.6)}
        </g>
      );
    },
  },

  'orc-shaman': {
    bg: ['#2c4c66', '#08101a'],
    draw: () => {
      const p = 'orc-shaman';
      return (
        <g>
          <defs>
            {lg(p + '-skin', '#8cb456', '#2e4a18')}
            {lg(p + '-pelt', '#a4a8ac', '#363a40')}
            {lg(p + '-mail', '#4a6a7a', '#141e26')}
            {glow(p + '-eye', '#7ff0ff')}
          </defs>
          <path d={BUST} fill={u(p + '-mail')} {...OL} />
          <path d="M50 8C34 8 24 20 24 36c0 14-2 26-10 40 10 4 18 2 24-2l24 0c6 4 14 6 24 2-8-14-10-26-10-40C76 20 66 8 50 8z" fill={u(p + '-pelt')} {...OL} />
          <path d="M28 26L30 9l12 10zM72 26l-2-17-12 10z" fill={u(p + '-pelt')} {...OL} />
          <path d="M31 21l1-8 6 5zM69 21l-1-8-6 5z" fill="#2a2a2e" />
          <path d="M50 19c-12 0-19 10-19 24 0 12 6 22 19 28 13-6 19-16 19-28 0-14-7-24-19-24z" fill="#0c0e12" />
          {orcHead(p, '#1e3210')}
          <path d="M44 66c1 8 3 14 6 19 3-5 5-11 6-19-3 2-9 2-12 0z" fill="#1a1612" {...OL} strokeWidth=".8" />
          <circle cx="50" cy="78" r="1.6" fill="#5ae0e8" />
          {eyes(p, '#e8feff', { y: 45.5, l: 42, r: 58, rx: 2.4, ry: 1.2, h: 5.5 })}
          <path d="M50 11c-11 0-18 6-19 14 0 5 3 9 7 11l2 3h20l2-3c4-2 7-6 7-11-1-8-8-14-19-14z" fill={u(p + '-pelt')} {...OL} />
          <path d="M44 24c0-3 3-4 6-4s6 1 6 4l-.5 9c-1 3-3 4.5-5.5 4.5S45.5 36 44.5 33z" fill="#d4d6d8" {...OL} strokeWidth=".8" />
          <path d="M46.5 33q3.5-2.5 7 0-1 3.5-3.5 3.5t-3.5-3.5z" fill="#121216" />
          <path d="M35.5 24.5q3.5-2.5 6.5 1-3.5 1.5-6.5-1zM64.5 24.5q-3.5-2.5-6.5 1 3.5 1.5 6.5-1z" fill="#121216" />
          <path
            d="M40 38.5l1.4 3.2 1.4-3.2M44 39l1.4 3.4 1.4-3.4M53.2 39l1.4 3.4 1.4-3.4M57.2 38.5l1.4 3.2 1.4-3.2"
            fill="#f4f0e4"
            stroke="#f4f0e4"
            strokeWidth=".7"
          />
          <path d="M30 80q20 12 40 0" stroke="#3a2a1a" strokeWidth="1" fill="none" />
          {[
            [30, 80, '#3fd0d8'],
            [36, 84, '#f0e6cc'],
            [43, 86.5, '#c83a2a'],
            [50, 87, '#3fd0d8'],
            [57, 86.5, '#c83a2a'],
            [64, 84, '#f0e6cc'],
            [70, 80, '#3fd0d8'],
          ].map(([x, y, c]) => (
            <circle key={x} cx={x} cy={y} r="2.4" fill={c} stroke="#120c08" strokeWidth=".7" />
          ))}
          <circle cx="80" cy="74" r="11" fill={u(p + '-eye')} />
          <path d="M84 63l-6 10h5l-6 11" stroke="#e8feff" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
          {rim('M17 74c6-12 8-24 8-38 0-14 10-26 25-27', '#d8f4ff', 0.5, 1.5)}
        </g>
      );
    },
  },

  'undead-warlock': {
    bg: ['#2a4a1e', '#060c04'],
    draw: () => {
      const p = 'undead-warlock';
      return (
        <g>
          <defs>
            {lg(p + '-robe', '#4a3656', '#0c0610')}
            {lg(p + '-horn', '#8a7a6a', '#1e1612')}
            {lg(p + '-skin', '#a8b49a', '#3e4a36')}
            {lg(p + '-fire', '#f0ffb0', '#2a9a10', 0.2, 1)}
            {glow(p + '-eye', '#9aff4a', '#3fd820')}
          </defs>
          <path d={BUST} fill={u(p + '-robe')} {...OL} />
          {hoodBack(u(p + '-robe'), '#040306')}
          <path d="M25.5 34C15 34 9 25 16 15c0 6 4 10 12.5 8.5zM74.5 34C85 34 91 25 84 15c0 6-4 10-12.5 8.5z" fill={u(p + '-horn')} {...OL} />
          <path d="M14.5 27l3.5-1.6M16.5 31l3-2.2M85.5 27l-3.5-1.6M83.5 31l-3-2.2" stroke="#1a120e" strokeWidth="1" />
          <path d="M42 54c0 8 4 13 8 15 4-2 8-7 8-15-3 2-13 2-16 0z" fill={u(p + '-skin')} {...OL} strokeWidth=".8" />
          <path d="M44 58.5h12l-1.2 4.5H45.2z" fill="#140c0e" />
          <path d="M46 58.5v4.5M48.6 58.5v4.5M51.4 58.5v4.5M54 58.5v4.5" stroke="#d8d0b0" strokeWidth="1.2" />
          {eyes(p, '#f2ffd0', { y: 45, l: 43, r: 57, rx: 2.8, ry: 1.2, t: 16, h: 7 })}
          <path d={BRIM} fill={u(p + '-robe')} />
          <path d={BRIM_EDGE} fill="none" stroke="#7aff3a" strokeWidth="1.3" strokeOpacity=".9" />
          <path d={HOLE_EDGE} fill="none" stroke="#7aff3a" strokeWidth="1" strokeOpacity=".6" />
          <circle cx="50" cy="88" r="16" fill={u(p + '-eye')} />
          <path d="M50 99c-9-2-12-9-8-17 0 4 3 6 4 3 0-5 2-9 6-13 0 5 2 8 4 11 1-3 1-5 0-8 5 5 6 12 3 18-2 4-5 6-9 6z" fill={u(p + '-fire')} />
          <path d="M50 97c-3-1-5-4-3-8 1 2 3 2 3 0 0-2 1-4 3-5 1 4 3 6 1 10-1 2-2 3-4 3z" fill="#f8ffd8" />
          {rim('M25 62C21 48 24 28 40 14', '#c8ff9a', 0.4, 1.6)}
        </g>
      );
    },
  },

  'troll-priest': {
    bg: ['#7a6a3a', '#1a1408'],
    draw: () => {
      const p = 'troll-priest';
      return (
        <g>
          <defs>
            {lg(p + '-robe', '#fbf6ea', '#a89a7a')}
            {lg(p + '-skin', '#86c09a', '#2e5a44')}
            {glow(p + '-halo', '#fff4c0', '#ffe08a')}
            {glow(p + '-eye', '#fff2a0')}
          </defs>
          <circle cx="50" cy="38" r="34" fill={u(p + '-halo')} />
          <circle cx="50" cy="38" r="25" fill="none" stroke="#ffe08a" strokeWidth="1.4" strokeOpacity=".7" />
          <path d={BUST} fill={u(p + '-robe')} {...OL} />
          <path d="M30 76c6 6 13 9 20 9s14-3 20-9l4 6c-7 7-15 10-24 10s-17-3-24-10z" fill="#e0b450" {...OL} strokeWidth=".8" />
          <path d="M50 85v15" stroke="#e0b450" strokeWidth="3" />
          <path d="M43 63h14l2 12H41z" fill="#24483a" />
          <path d="M44.5 28C43 20 45 14 50 9c5 5 7 11 5.5 19z" fill="#f6f2ea" {...OL} strokeWidth=".8" />
          <path d="M45.5 21.5h9" stroke="#e0b450" strokeWidth="2.6" />
          <path d="M50 11c-1.5 4-2 7-1.5 10" stroke="#bdb6a6" strokeWidth=".9" fill="none" />
          {trollFace(p, '#1a3a2c')}
          {eyes(p, '#fffbe0', { y: 45.5, l: 42.5, r: 57.5, h: 5 })}
          <path d="M36 32q14-6 28 0" stroke="#e0b450" strokeWidth="2.6" fill="none" />
          <circle cx="50" cy="29.5" r="2" fill="#5ad0c8" stroke="#7a5a10" strokeWidth=".7" />
          {trollEars(p, '#1a3a2c')}
          <path d="M19 40v7M81 40v7" stroke="#c8a050" strokeWidth="1" />
          <path d="M16.5 47h5l-.5 4.5c-1 1.5-3 1.5-4 0zM78.5 47h5l-.5 4.5c-1 1.5-3 1.5-4 0z" fill="#efe6cc" stroke="#3a2a14" strokeWidth=".7" />
          <circle cx="18" cy="49" r=".7" fill="#1a1008" />
          <circle cx="20" cy="49" r=".7" fill="#1a1008" />
          <circle cx="80" cy="49" r=".7" fill="#1a1008" />
          <circle cx="82" cy="49" r=".7" fill="#1a1008" />
          <path d="M64 84c2 4 2 9 0 13M68 82c3 3 4 8 3 12" stroke="#c63a2a" strokeWidth="2" strokeLinecap="round" fill="none" />
          <circle cx="62" cy="84" r="2.2" fill="#5ad0c8" stroke="#1a1008" strokeWidth=".6" />
          {rim('M10 90c2-8 10-15 22-17', '#fffaf0', 0.8, 1.4)}
        </g>
      );
    },
  },

  'raid-member': {
    bg: ['#4e4438', '#12100c'],
    draw: () => {
      const p = 'raid-member';
      return (
        <g>
          <defs>
            {lg(p + '-cloak', '#8a7458', '#241c14')}
            <linearGradient id={p + '-skin'} x1="0" y1="0" x2="0.25" y2="1">
              <stop offset="0" stopColor="#1c130c" />
              <stop offset=".42" stopColor="#6e4c36" />
              <stop offset=".75" stopColor="#c89a78" />
              <stop offset="1" stopColor="#9a6e50" />
            </linearGradient>
          </defs>
          <path d="M72 46l14-34 4 2-14 34z" fill="#8a8c90" {...OL} strokeWidth=".8" />
          <path d="M70 46l10 5" stroke="#b08d4a" strokeWidth="2.6" strokeLinecap="round" />
          <path d={BUST} fill={u(p + '-cloak')} {...OL} />
          <path d="M30 74l40 26" stroke="#3a2a1a" strokeWidth="3.2" />
          {hoodBack(u(p + '-cloak'))}
          <path
            d="M50 31c-9.5 0-15 7-15 16 0 9 3 15.5 7 20 2.5 3 5.5 4.5 8 4.5s5.5-1.5 8-4.5c4-4.5 7-11 7-20 0-9-5.5-16-15-16z"
            fill={u(p + '-skin')}
            {...OL}
            strokeWidth=".9"
          />
          <path d="M40.5 57c1 7 4.5 12 9.5 14 5-2 8.5-7 9.5-14-2.5 3.5-5.5 5.5-9.5 5.5s-7-2-9.5-5.5z" fill="#3e2a1c" opacity=".75" />
          <path d="M39.5 43.5q4-2 7.5 0M53 43.5q3.5-2 7.5 0" stroke="#120c08" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <ellipse cx="43.5" cy="46.5" rx="2.3" ry="1.1" fill="#e2cca4" />
          <ellipse cx="56.5" cy="46.5" rx="2.3" ry="1.1" fill="#e2cca4" />
          <circle cx="43.8" cy="46.5" r=".9" fill="#2a1a10" />
          <circle cx="56.8" cy="46.5" r=".9" fill="#2a1a10" />
          <path d="M50.5 47c.6 3 1.6 6 2.2 8.6-1.6 1-3.8 1-5.4 0" stroke="#4a3020" strokeWidth="1.1" fill="none" strokeLinecap="round" />
          <path d="M46 61.5q4 1.4 8 0" stroke="#1e120a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          {rim('M36 48c0 7 2.5 13 6.5 18', '#ffd8b0', 0.5, 1.1)}
          <path d={BRIM} fill={u(p + '-cloak')} />
          <path d={BRIM_EDGE} fill="none" stroke="#2a2016" strokeWidth="1.3" />
          <circle cx="40" cy="78" r="3.4" fill="#b08d4a" stroke="#3a2a10" strokeWidth=".8" />
          {rim('M25 62C21 48 24 28 40 14', '#ffe6c0', 0.55, 1.6)}
        </g>
      );
    },
  },

  generic: {
    bg: ['#44444c', '#101014'],
    draw: () => {
      const p = 'generic';
      return (
        <g>
          <defs>
            {lg(p + '-cloak', '#9a9aa4', '#2a2a32')}
            {glow(p + '-face', '#4a4a54')}
          </defs>
          <path d={BUST} fill={u(p + '-cloak')} {...OL} />
          <path d="M50 74v26" stroke="#1e1e24" strokeWidth="1.4" />
          {hoodBack(u(p + '-cloak'), '#0a0a0e')}
          <ellipse cx="50" cy="58" rx="12" ry="13" fill={u(p + '-face')} />
          <path d={BRIM} fill={u(p + '-cloak')} />
          <path d={BRIM_EDGE} fill="none" stroke="#1a1a20" strokeWidth="1.3" />
          {rim('M25 62C21 48 24 28 40 14', '#f0f0f8', 0.5, 1.6)}
        </g>
      );
    },
  },
};
