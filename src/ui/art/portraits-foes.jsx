// Original SVG art — see SPEC.md (Art). Enemy / boss / PvP-foe portraits.
// 100×100 viewBox, head-and-shoulders bust centred for a r≈46 circular crop.
// Light comes from the upper-left: gradients run light→dark top-left to
// bottom-right and `rim()` strokes add a warm edge light.

const K = '#120b09';
const stops = (cs) => cs.map((c, i) => <stop key={i} offset={i / (cs.length - 1)} stopColor={c} />);
const lg = (id, cs, x2 = 0.8, y2 = 1) => (
  <linearGradient id={id} x1="0.15" y1="0" x2={x2} y2={y2}>
    {stops(cs)}
  </linearGradient>
);
const rg = (id, cs, cx = 0.5, cy = 0.5, r = 0.5) => (
  <radialGradient id={id} cx={cx} cy={cy} r={r}>
    {stops(cs)}
  </radialGradient>
);
const glow = (id, c, o = 0.85) => (
  <radialGradient id={id}>
    <stop offset="0" stopColor={c} stopOpacity={o} />
    <stop offset="1" stopColor={c} stopOpacity="0" />
  </radialGradient>
);
const rim = (d, c = '#ffe6b8', w = 1.6, o = 0.65) => (
  <path d={d} fill="none" stroke={c} strokeWidth={w} strokeOpacity={o} strokeLinecap="round" strokeLinejoin="round" />
);
const ol = { stroke: K, strokeWidth: 1.6, strokeLinejoin: 'round' };

// Shared hyena head (three-quarter view, facing the light) for gnoll and
// gnoll-brute: long blunt snout, open grinning jaw, slanted eyes.
const gnollHead = (id, eye) => (
  <g>
    <path d="M18 54 L64 58 L60 67 L22 68Z" fill="#4a0a0c" />
    <path d="M21 66 L58 64 C58 72 51 79 41 79 C32 79 25 75 22 70Z" fill={`url(#${id}-fur)`} {...ol} strokeWidth="1.4" />
    <path d="M21.8 66.6 L36 65.2 C35.4 70 34.6 75 33.4 78.6 C28.4 78 24.6 75 22.6 70.6Z" fill={`url(#${id}-snout)`} opacity="0.9" />
    <path d="M24.5 66.4 L26.5 61.5 L28.6 66.2 L31 62 L33.3 66 L35.6 62.2 L38 65.8 L40.4 62.4 L42.8 65.6 L45 62.6 L47.4 65.4Z" fill="#f2e8d0" />
    <path
      d="M50 21 C62 18 75 24 78 36 C80 46 76 55 69 59 L60 61 L44 59.5 L25 58 C19 57.5 15 54.5 15 50.5 C15 47 17.5 45 21 44 L33 39 C37 30 43 24 50 21Z"
      fill={`url(#${id}-fur)`}
      {...ol}
    />
    <path d="M33 39 L21 44 C17.5 45 15 47 15 50.5 C15 54.5 19 57.5 25 58 L42 59.4 C40 52 37.5 45 33 39Z" fill={`url(#${id}-snout)`} />
    <path d="M23.5 57.9 L25.5 62 L27.5 58.2 L30 65 L32.4 58.5 L34.6 62.4 L36.8 58.8 L39 62.6 L41.2 59.1 L43.4 62.6 L45.6 59.4Z" fill="#f2e8d0" />
    <ellipse cx="18" cy="48" rx="3.8" ry="2.7" transform="rotate(-20 18 48)" fill="#050302" />
    <ellipse cx="16.8" cy="47.2" rx="1.3" ry="0.7" fill="#fff" opacity="0.45" />
    <path d="M36 35.5 L44 36.5 L42 40 L37.5 39.5Z M49 35.5 L61 34 L58 40 L51 39.6Z" fill={eye} stroke={K} strokeWidth="0.9" />
    <path d="M40 36.5 V39.5 M55 34.8 V39.8" stroke={K} strokeWidth="1.4" />
    <path d="M33 32 L44 35.5 M62 30.5 L49 34.5" stroke={K} strokeWidth="2.6" strokeLinecap="round" />
    {rim('M16 46 L33 39 C37 30 43 24 50 21', '#ffe6b8', 1.7, 0.7)}
  </g>
);

export const PORTRAITS_FOES = {
  wolf: {
    bg: ['#5c2219', '#140707'],
    draw: () => (
      <g>
        <defs>
          {lg('wolf-fur', ['#8e8580', '#4a413d', '#1e1917'])}
          {lg('wolf-muz', ['#d2c8bc', '#7d736b'])}
          {glow('wolf-glow', '#ff3a1c')}
        </defs>
        <path d="M4 100 L10 84 L5 78 L18 74 L15 66 L30 66 L50 78 L70 66 L85 66 L82 74 L95 78 L90 84 L96 100Z" fill="url(#wolf-fur)" {...ol} />
        <path d="M30 40 L14 10 L46 27Z" fill="url(#wolf-fur)" {...ol} />
        <path d="M70 40 L86 10 L54 27Z" fill="url(#wolf-fur)" {...ol} />
        <path d="M30 34 L19 16 L40 28Z" fill="#4a1a17" />
        <path d="M70 34 L81 16 L60 28Z" fill="#3a1412" />
        <path
          d="M50 19 C38 19 30 27 27 38 L13 45 L23 51 L16 60 L30 62 C34 74 42 84 50 87 C58 84 66 74 70 62 L84 60 L77 51 L87 45 L73 38 C70 27 62 19 50 19Z"
          fill="url(#wolf-fur)"
          {...ol}
        />
        <path d="M50 21 C46 29 44 37 46 46 L50 50 L54 46 C56 37 54 29 50 21Z" fill="#1e1816" opacity="0.6" />
        <path d="M50 44 C43 44 39 51 37 60 C36 70 42 80 50 82 C58 80 64 70 63 60 C61 51 57 44 50 44Z" fill="url(#wolf-muz)" />
        <path d="M36.5 63 C42 67 58 67 63.5 63 C62.5 74 57 81 50 81 C43 81 37.5 74 36.5 63Z" fill="#2e0709" stroke={K} strokeWidth="1" />
        <path d="M42 76 Q50 72 58 76 Q55 80 50 80 Q45 80 42 76Z" fill="#9a2e34" />
        <path
          d="M38.5 64 L41.5 75 L44 65.5Z M61.5 64 L58.5 75 L56 65.5Z M42.5 80 L44.5 71 L46.5 80.5Z M57.5 80 L55.5 71 L53.5 80.5Z M45 66 L46.5 69 L48 66.5Z M52 66.5 L53.5 69 L55 66Z"
          fill="#f2ead8"
        />
        <path d="M43 50 Q50 47.5 57 50 M42 53.5 Q50 51 58 53.5" fill="none" stroke="#3a302c" strokeWidth="1.2" />
        <ellipse cx="50" cy="58" rx="5.5" ry="3.6" fill="#0c0808" />
        <ellipse cx="48.4" cy="56.9" rx="1.8" ry="0.9" fill="#fff" opacity="0.5" />
        <circle cx="39" cy="47" r="8" fill="url(#wolf-glow)" />
        <circle cx="61" cy="47" r="8" fill="url(#wolf-glow)" />
        <path d="M32 44 L45 48.5 L35 50.5Z M68 44 L55 48.5 L65 50.5Z" fill="#ff4a24" stroke={K} strokeWidth="0.8" />
        <circle cx="38.5" cy="47.6" r="1" fill="#ffe0b0" />
        <circle cx="61.5" cy="47.6" r="1" fill="#ffe0b0" />
        <path d="M29 40 L46 46 M71 40 L54 46" stroke={K} strokeWidth="3" strokeLinecap="round" />
        <path d="M60 33 L68 52" stroke="#d8aca0" strokeWidth="1" opacity="0.8" />
        {rim('M28 37 C31 27 39 20 50 19')}
        {rim('M14 10 L30 40', '#ffe6b8', 1.4, 0.5)}
        {rim('M18 74 L5 78 L10 84', '#ffe6b8', 1.2, 0.45)}
      </g>
    ),
  },

  kobold: {
    bg: ['#74501f', '#150d06'],
    draw: () => (
      <g>
        <defs>
          {lg('kobold-fur', ['#c08a54', '#7a4a24', '#36200e'])}
          {lg('kobold-helm', ['#b0a898', '#5c564e', '#26221e'])}
          {glow('kobold-glow', '#ffd25a', 0.7)}
        </defs>
        <circle cx="50" cy="14" r="24" fill="url(#kobold-glow)" />
        <path d="M12 100 C14 86 28 78 50 78 C72 78 86 86 88 100Z" fill="#5c4632" {...ol} />
        <path d="M24 82 L70 100 L60 100 L21 86Z" fill="#33241a" />
        <ellipse cx="20" cy="52" rx="11" ry="13" transform="rotate(-25 20 52)" fill="url(#kobold-fur)" {...ol} />
        <ellipse cx="21" cy="53" rx="6.5" ry="8.5" transform="rotate(-25 21 53)" fill="#c27a6c" />
        <ellipse cx="80" cy="52" rx="11" ry="13" transform="rotate(25 80 52)" fill="url(#kobold-fur)" {...ol} />
        <ellipse cx="79" cy="53" rx="6.5" ry="8.5" transform="rotate(25 79 53)" fill="#a0605a" />
        <path d="M50 36 C36 36 28 44 29 56 C30 66 39 72 44 80 Q50 87 56 80 C61 72 70 66 71 56 C72 44 64 36 50 36Z" fill="url(#kobold-fur)" {...ol} />
        <path d="M42 62 C42 69 46 76 50 80 C54 76 58 69 58 62 C55 58 45 58 42 62Z" fill="#d8ab78" />
        <path d="M44 74 L26 70 M44 76.5 L28 80 M56 74 L74 70 M56 76.5 L72 80" stroke="#f4e6c4" strokeWidth="0.8" opacity="0.85" />
        <path d="M47 81 h6 v6.5 h-6Z" fill="#f4ecd2" stroke={K} strokeWidth="0.8" />
        <path d="M50 81 v6.5" stroke={K} strokeWidth="0.7" />
        <ellipse cx="50" cy="78.5" rx="4.2" ry="3" fill="#e48c8c" stroke={K} strokeWidth="0.8" />
        <circle cx="40.5" cy="59" r="3.9" fill="#140806" />
        <circle cx="59.5" cy="59" r="3.9" fill="#140806" />
        <circle cx="39.3" cy="57.8" r="1.3" fill="#ffe7a0" />
        <circle cx="58.3" cy="57.8" r="1.3" fill="#ffe7a0" />
        <path d="M34 53 L45 56 M66 53 L55 56" stroke={K} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M28 49 C28 34 38 26 50 26 C62 26 72 34 72 49Z" fill="url(#kobold-helm)" {...ol} />
        <path d="M22 48 Q50 54 78 48 L77 53 Q50 59 23 53Z" fill="#3e3a34" {...ol} strokeWidth="1.3" />
        <path d="M60 33 L64 38 L62 44" fill="none" stroke="#2a2622" strokeWidth="1" />
        <g fill="#d8cfbe">
          <circle cx="34" cy="43" r="1.1" />
          <circle cx="66" cy="43" r="1.1" />
          <circle cx="50" cy="47" r="1.1" />
        </g>
        <path d="M43 23 h14 v4.5 h-14Z" fill="#6a625a" stroke={K} strokeWidth="1" />
        <path d="M45 14 h10 v9.5 h-10Z" fill="#efe2b8" stroke={K} strokeWidth="1" />
        <path d="M45.5 14.5 h9 v1.5 c0 2 -2 2 -2 4 c0 1 -1.5 1 -1.5 0 v-3 h-5.5Z" fill="#fffbe8" />
        <path d="M50 4 C46 8.5 45.5 11.5 50 13.5 C54.5 11.5 54 8.5 50 4Z" fill="#ffc43a" />
        <path d="M50 7.5 C48.6 9.5 48.6 11.5 50 12.6 C51.4 11.5 51.4 9.5 50 7.5Z" fill="#fff8d8" />
        {rim('M30 45 C31 35 39 28 48 27', '#fff0c0', 1.8, 0.8)}
        {rim('M11 46 C12 42 15 40 18 39')}
      </g>
    ),
  },

  'kobold-geomancer': {
    bg: ['#3e2a48', '#0d0810'],
    draw: () => (
      <g>
        <defs>
          {lg('kobold-geomancer-hood', ['#8a6448', '#4a3224', '#1a110b'])}
          {lg('kobold-geomancer-fur', ['#dcbc90', '#94704c', '#3a2618'])}
          {glow('kobold-geomancer-glow', '#ff8a2a', 0.9)}
        </defs>
        <path d="M10 100 C12 84 26 74 50 74 C74 74 88 84 90 100Z" fill="url(#kobold-geomancer-hood)" {...ol} />
        <path d="M24 94 L31 87 L38 94 L45 87 L52 94" fill="none" stroke="#ffa040" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M50 9 C38 13 24 27 22 49 C21 62 26 72 32 78 L68 78 C74 72 79 62 78 49 C76 27 62 13 50 9Z" fill="url(#kobold-geomancer-hood)" {...ol} />
        <path d="M50 28 C38 28 31 38 31 52 C31 64 40 76 50 82 C60 76 69 64 69 52 C69 38 62 28 50 28Z" fill="#120a07" />
        <ellipse cx="21" cy="40" rx="8" ry="12" transform="rotate(-42 21 40)" fill="url(#kobold-geomancer-fur)" {...ol} strokeWidth="1.4" />
        <ellipse cx="22" cy="41" rx="4.5" ry="7.5" transform="rotate(-42 22 41)" fill="#a8665a" />
        <ellipse cx="79" cy="40" rx="8" ry="12" transform="rotate(42 79 40)" fill="url(#kobold-geomancer-fur)" {...ol} strokeWidth="1.4" />
        <ellipse cx="78" cy="41" rx="4.5" ry="7.5" transform="rotate(42 78 41)" fill="#8a5248" />
        <path
          d="M50 34 C40 34 34 42 35 52 C36 62 43 70 46 78 Q50 84 54 78 C57 70 64 62 65 52 C66 42 60 34 50 34Z"
          fill="url(#kobold-geomancer-fur)"
          stroke={K}
          strokeWidth="1.4"
        />
        <path d="M43 60 C43 66 46 73 50 77 C54 73 57 66 57 60 C55 57 45 57 43 60Z" fill="#ecd2a8" />
        <ellipse cx="50" cy="76" rx="3.6" ry="2.6" fill="#d88080" stroke={K} strokeWidth="0.7" />
        <path d="M47.5 79 h5 v5 h-5Z" fill="#f0e8cc" stroke={K} strokeWidth="0.7" />
        <circle cx="42" cy="55" r="8.5" fill="url(#kobold-geomancer-glow)" />
        <circle cx="58" cy="55" r="8.5" fill="url(#kobold-geomancer-glow)" />
        <path d="M37.5 52.5 L46.5 55.5 L39.5 58Z M62.5 52.5 L53.5 55.5 L60.5 58Z" fill="#fff2b8" stroke={K} strokeWidth="0.8" />
        <circle cx="50" cy="43" r="8" fill="url(#kobold-geomancer-glow)" />
        <path d="M50 37.5 L54 43 L50 48.5 L46 43Z M50 37.5 V48.5" fill="none" stroke="#ffe0a0" strokeWidth="1.3" strokeLinejoin="round" />
        <circle cx="74" cy="82" r="17" fill="url(#kobold-geomancer-glow)" />
        <path d="M65 78 L71 71 L81 73 L85 81 L79 90 L68 88Z" fill="#5e4e44" {...ol} strokeWidth="1.4" />
        <path d="M68 78 L71 71 L81 73 L77 78Z" fill="#8a7666" />
        <path d="M71 81 L75.5 76.5 L80 81.5 L75 86Z M75.5 76.5 V86" fill="none" stroke="#ffd070" strokeWidth="1.6" strokeLinejoin="round" />
        {rim('M24 46 C26 30 38 15 50 10', '#ffd8a8')}
        {rim('M14 34 C15 30 18 28 21 29', '#ffd8a8', 1.2, 0.5)}
      </g>
    ),
  },

  gnoll: {
    bg: ['#6a5c2c', '#151208'],
    draw: () => (
      <g>
        <defs>
          {lg('gnoll-fur', ['#ecca84', '#a87e3e', '#4a3016'])}
          {lg('gnoll-snout', ['#5e4026', '#2a1a0e', '#120a05'])}
        </defs>
        <path d="M6 100 C8 86 20 77 36 74 L52 70 L68 66 C82 69 92 82 94 100Z" fill="url(#gnoll-fur)" {...ol} />
        <path d="M72 70 L34 100 H46 L78 75Z" fill="#4a2e18" stroke={K} strokeWidth="1" />
        <path d="M24 84 L27 90 L30 85 L33 91 L36 86 L39 92 L42 87" fill="none" stroke="#efe4c8" strokeWidth="1.8" strokeLinejoin="round" />
        <path
          d="M44 25 L45 11 L53 19 L57 5 L63 17 L71 8 L72 22 L82 17 L79 30 L90 30 L82 40 L92 46 L82 50 L90 60 L78 60 L82 72 L64 66Z"
          fill="#2e1c10"
          {...ol}
          strokeWidth="1"
        />
        <ellipse cx="44" cy="20" rx="7" ry="9" transform="rotate(-25 44 20)" fill="url(#gnoll-fur)" {...ol} />
        <ellipse cx="44.5" cy="21" rx="3.8" ry="5.5" transform="rotate(-25 44.5 21)" fill="#5a3a20" />
        <ellipse cx="70" cy="19" rx="8" ry="10.5" transform="rotate(22 70 19)" fill="url(#gnoll-fur)" {...ol} />
        <ellipse cx="69.5" cy="20" rx="4.5" ry="6.5" transform="rotate(22 69.5 20)" fill="#4a2e18" />
        {gnollHead('gnoll', '#ffc83a')}
        <g fill="#5a3a1a" opacity="0.85">
          <circle cx="64" cy="27" r="2.2" />
          <circle cx="72" cy="38" r="2" />
          <circle cx="66" cy="47" r="1.9" />
          <circle cx="57" cy="50" r="1.5" />
          <circle cx="73" cy="51" r="1.5" />
          <circle cx="51" cy="27" r="1.4" />
          <circle cx="16" cy="90" r="2.4" />
          <circle cx="84" cy="86" r="2.4" />
          <circle cx="88" cy="94" r="1.8" />
          <circle cx="62" cy="86" r="1.8" />
        </g>
        {rim('M45 13 C42 14 39 17 38 20', '#ffe6b8', 1.3, 0.55)}
        {rim('M8 96 C10 86 20 78 34 75', '#ffe6b8', 1.3, 0.5)}
      </g>
    ),
  },

  'gnoll-brute': {
    bg: ['#5e2c1a', '#140806'],
    draw: () => (
      <g>
        <defs>
          {lg('gnoll-brute-fur', ['#c8945a', '#7a5226', '#36200c'])}
          {lg('gnoll-brute-snout', ['#4a2c18', '#22140a', '#0e0704'])}
          {lg('gnoll-brute-iron', ['#d0c8bc', '#6a645c', '#25211e'])}
        </defs>
        <path d="M26 100 L30 70 L72 66 L76 100Z" fill="#3e2a1a" {...ol} strokeWidth="1.4" />
        <path d="M31 76 L73 72 M31 82 L74 78 M30 88 L75 84" stroke="#8a7a6a" strokeWidth="1.6" strokeDasharray="2 1.5" />
        <path d="M70 34 L84 30 L80 40 L92 44 L82 50 L90 58 L76 60Z" fill="#26160c" {...ol} strokeWidth="1" />
        <path d="M2 100 L3 78 C5 64 18 58 32 60 C40 62 42 70 42 80 L40 100Z" fill="url(#gnoll-brute-iron)" {...ol} />
        <path d="M98 100 L97 78 C95 64 82 58 68 60 C60 62 58 70 58 80 L60 100Z" fill="url(#gnoll-brute-iron)" {...ol} />
        <path d="M10 64 L4 44 L19 60Z M90 64 L96 44 L81 60Z M76 61 L80 42 L68 60Z" fill="url(#gnoll-brute-iron)" {...ol} strokeWidth="1.2" />
        <path d="M4 86 C12 78 28 76 41 82 M96 86 C88 78 72 76 59 82" fill="none" stroke={K} strokeWidth="1.2" />
        <g fill="#e2d8c4">
          <circle cx="12" cy="74" r="1.2" />
          <circle cx="30" cy="68" r="1.2" />
          <circle cx="88" cy="74" r="1.2" />
          <circle cx="70" cy="68" r="1.2" />
        </g>
        <g transform="translate(5 6) scale(0.9)">{gnollHead('gnoll-brute', '#ff6a2a')}</g>
        <path d="M34 33 C35 20 46 12 58 12 C70 12 78 19 80 32 Q58 25 34 33Z" fill="url(#gnoll-brute-iron)" {...ol} />
        <path d="M32 33 Q58 24 82 33 L81.5 37.5 Q58 29 33 37.5Z" fill="url(#gnoll-brute-iron)" {...ol} strokeWidth="1.2" />
        <path d="M44 17 L31 3 L50 13.5Z M70 15 L82 2 L77 21Z" fill="url(#gnoll-brute-iron)" {...ol} strokeWidth="1.2" />
        <g fill="#e2d8c4">
          <circle cx="40" cy="33.4" r="1" />
          <circle cx="52" cy="30.4" r="1" />
          <circle cx="64" cy="29.8" r="1" />
          <circle cx="75" cy="31.6" r="1" />
        </g>
        <path d="M52 34 L60 51" stroke="#e0a890" strokeWidth="1.3" strokeLinecap="round" />
        <g fill="#3e2610" opacity="0.85">
          <circle cx="66" cy="47" r="1.8" />
          <circle cx="70" cy="40" r="1.6" />
          <circle cx="56" cy="53" r="1.4" />
        </g>
        {rim('M36 30 C37 21 46 14 57 13', '#fff0d0', 1.8, 0.75)}
        {rim('M4 78 C6 66 18 60 30 60', '#fff0d0', 1.6, 0.7)}
        {rim('M4 44 L10 64', '#fff0d0', 1.2, 0.6)}
      </g>
    ),
  },

  bandit: {
    bg: ['#4e3c2c', '#110c08'],
    draw: () => (
      <g>
        <defs>
          {lg('bandit-leather', ['#946c44', '#55391e', '#20140a'])}
          {lg('bandit-hood', ['#6a5a4a', '#33291f', '#0f0b08'])}
          {lg('bandit-red', ['#ff6a44', '#c2261c', '#560b07'])}
          {lg('bandit-skin', ['#efbe94', '#b47a54', '#5e3824'])}
        </defs>
        <path d="M6 100 C10 82 24 72 50 72 C76 72 90 82 94 100Z" fill="url(#bandit-leather)" {...ol} />
        <path d="M22 78 L62 100 H51 L18 82Z" fill="#2a1a0e" stroke={K} strokeWidth="1" />
        <path d="M30 83 L34 85.5 M38 87.5 L42 90" stroke="#d8c07a" strokeWidth="2.4" />
        <path d="M50 12 C33 12 24 26 24 44 C24 58 28 70 34 78 L66 78 C72 70 76 58 76 44 C76 26 67 12 50 12Z" fill="url(#bandit-hood)" {...ol} />
        <path d="M50 25 C40 25 34 34 34 46 C34 58 41 70 50 73 C59 70 66 58 66 46 C66 34 60 25 50 25Z" fill="url(#bandit-skin)" />
        <path d="M34 42 C35 31 41 25 50 25 C59 25 65 31 66 42 C60 35 55 33 50 33 C45 33 40 35 34 42Z" fill="#1a120c" opacity="0.75" />
        <path d="M33 52 Q50 58 67 52 L65 64 Q58 76 50 85 Q42 76 35 64Z" fill="url(#bandit-red)" stroke={K} strokeWidth="1.3" />
        <path d="M39 61 Q50 65 61 61 M43 69 Q50 72 57 69" fill="none" stroke="#6a120c" strokeWidth="1.1" />
        <path d="M66 55 L78 60 L74 64 L82 70 L70 64Z" fill="url(#bandit-red)" stroke={K} strokeWidth="1" />
        <path d="M38.5 46.5 Q43 44 47.5 47 Q43 49 38.5 46.5Z M61.5 46.5 Q57 44 52.5 47 Q57 49 61.5 46.5Z" fill="#f4eee4" />
        <circle cx="43.5" cy="46.8" r="1.4" fill="#1a0e08" />
        <circle cx="56.5" cy="46.8" r="1.4" fill="#1a0e08" />
        <path d="M37.5 43 L47.5 45 M62.5 43 L52.5 45" stroke="#1a100a" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M50 47 L48.6 52.5" stroke="#7a4a30" strokeWidth="1" />
        <path d="M56 36 L60.5 51" stroke="#b05a48" strokeWidth="1.2" />
        {rim('M26 42 C27 26 37 14 50 13')}
        {rim('M36 54 Q42 56.5 50 57', '#ffd0b0', 1.2, 0.6)}
        {rim('M8 96 C12 82 24 74 40 72.5', '#ffe6b8', 1.3, 0.5)}
      </g>
    ),
  },

  'bandit-mage': {
    bg: ['#43210f', '#0c0504'],
    draw: () => (
      <g>
        <defs>
          {lg('bandit-mage-robe', ['#6e5e68', '#3a2e36', '#100b0e'])}
          {rg('bandit-mage-fire', ['#fffbe0', '#ffd040', '#ff7a1a', '#c02a06'], 0.5, 0.65, 0.55)}
          {glow('bandit-mage-glow', '#ff8a2a', 0.9)}
          {lg('bandit-mage-red', ['#a82018', '#d84a30', '#ff8a4a'], 0.6, 1)}
        </defs>
        <path d="M4 100 C8 80 24 70 50 70 C76 70 92 80 96 100Z" fill="url(#bandit-mage-robe)" {...ol} />
        <path d="M50 5 C34 13 21 30 21 50 C21 64 26 74 31 80 L69 80 C74 74 79 64 79 50 C79 30 66 13 50 5Z" fill="url(#bandit-mage-robe)" {...ol} />
        <path d="M50 26 C39 26 32 37 32 50 C32 62 39 73 50 77 C61 73 68 62 68 50 C68 37 61 26 50 26Z" fill="#0a0505" />
        <path d="M37 55 Q50 61 63 55 L61 66 Q55 75 50 77 Q45 75 39 66Z" fill="url(#bandit-mage-red)" />
        <path d="M41 64 Q50 67.5 59 64" fill="none" stroke="#5a0c06" strokeWidth="1" />
        <circle cx="43" cy="47" r="7" fill="url(#bandit-mage-glow)" />
        <circle cx="57" cy="47" r="7" fill="url(#bandit-mage-glow)" />
        <path d="M38 45 L47 47.5 L40 49.5Z M62 45 L53 47.5 L60 49.5Z" fill="#ffd070" />
        <circle cx="70" cy="84" r="22" fill="url(#bandit-mage-glow)" />
        <path d="M70 66 C63 73 58 80 60 87 C62 94 77 94 79 87 C81 80 77 76 75 70 C74 76 71 76 70 66Z" fill="url(#bandit-mage-fire)" />
        <path d="M70 76 C67 80 66 84 68 87 C70 89 73 88 74 85 C74 82 72 80 70 76Z" fill="#fffbe0" opacity="0.85" />
        <path d="M58 100 C58 92 63 90 66 93 L70 91 L74 93 C77 90 82 92 82 100Z" fill="#3a2018" {...ol} strokeWidth="1.2" />
        {rim('M24 44 C25 29 36 14 50 6')}
        {rim('M64 77 C70 72 75 64 77 56', '#ff9a4a', 1.8, 0.8)}
        {rim('M52 70.5 C62 71 70 72.5 76 75', '#ff9a4a', 1.4, 0.6)}
      </g>
    ),
  },

  spider: {
    bg: ['#2e3c1e', '#070a05'],
    draw: () => {
      const legs =
        'M37 54 L22 25 L8 46 M35 58 L13 38 L6 62 M36 63 L13 58 L17 84 M40 68 L22 76 L27 96 M63 54 L78 25 L92 46 M65 58 L87 38 L94 62 M64 63 L87 58 L83 84 M60 68 L78 76 L73 96';
      return (
        <g>
          <defs>
            {lg('spider-body', ['#7a6846', '#33281a', '#100c07'])}
            {glow('spider-glow', '#ff3a2a', 0.7)}
          </defs>
          <path d="M0 10 L38 30 M10 0 L42 26 M0 26 L30 34 M14 18 C18 14 22 12 26 12" stroke="#dfe8cc" strokeWidth="0.6" opacity="0.25" fill="none" />
          <path d={legs} fill="none" stroke="#120d08" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <path d={legs} fill="none" stroke="#6a5a3c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
          <ellipse cx="50" cy="28" rx="22" ry="17" fill="url(#spider-body)" {...ol} />
          <path d="M50 14 L57 22 L50 31 L43 22Z" fill="#d4aa44" />
          <path d="M36 30 L43 35 M64 30 L57 35 M38 20 L42 24 M62 20 L58 24" stroke="#d4aa44" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="50" cy="58" rx="19" ry="17" fill="url(#spider-body)" {...ol} />
          <ellipse cx="43.5" cy="73" rx="5.5" ry="7" fill="url(#spider-body)" stroke={K} strokeWidth="1.2" />
          <ellipse cx="56.5" cy="73" rx="5.5" ry="7" fill="url(#spider-body)" stroke={K} strokeWidth="1.2" />
          <path
            d="M40.5 77 C37.5 85 39.5 91 46 94 C44 89 44 83 45.5 78Z M59.5 77 C62.5 85 60.5 91 54 94 C56 89 56 83 54.5 78Z"
            fill="#ece0c4"
            stroke={K}
            strokeWidth="0.9"
          />
          <circle cx="50" cy="54" r="16" fill="url(#spider-glow)" />
          <g fill="#ff3a24" stroke={K} strokeWidth="0.8">
            <circle cx="44.5" cy="58" r="4.3" />
            <circle cx="55.5" cy="58" r="4.3" />
            <circle cx="38.5" cy="51" r="2.7" />
            <circle cx="61.5" cy="51" r="2.7" />
            <circle cx="45" cy="48.5" r="2.1" />
            <circle cx="55" cy="48.5" r="2.1" />
            <circle cx="34.5" cy="57.5" r="1.9" />
            <circle cx="65.5" cy="57.5" r="1.9" />
          </g>
          <g fill="#ffe0c0">
            <circle cx="43.2" cy="56.6" r="1.3" />
            <circle cx="54.2" cy="56.6" r="1.3" />
            <circle cx="37.8" cy="50.2" r="0.8" />
            <circle cx="60.8" cy="50.2" r="0.8" />
          </g>
          {rim('M30 24 C33 16 41 12 50 11')}
          {rim('M32 53 C34 46 40 42 46 41', '#ffe6b8', 1.3, 0.5)}
        </g>
      );
    },
  },

  raptor: {
    bg: ['#5e2a14', '#120604'],
    draw: () => (
      <g>
        <defs>
          {lg('raptor-skin', ['#f4904c', '#c0401e', '#521006'])}
          {lg('raptor-jaw', ['#f6dfb4', '#b8885a'])}
        </defs>
        <path d="M50 100 C52 84 58 70 64 58 L88 54 C96 66 98 84 96 100Z" fill="url(#raptor-skin)" {...ol} />
        <path d="M56 27 L64 6 L68 24 L78 9 L78 28 L91 19 L85 36 L95 34 L82 47Z" fill="#2a120a" {...ol} strokeWidth="1" />
        <path d="M22 66 L46 64 L70 62 L80 59 C78 72 66 80 52 78 C38 76 28 72 22 66Z" fill="url(#raptor-jaw)" {...ol} strokeWidth="1.4" />
        <path d="M12 51 L44 54 L72 56 L80 59 L70 62 L46 64 L22 66Z" fill="#4a0a0c" />
        <path d="M24 65.6 L26 60.6 L28.6 65.3 L31 60.2 L33.6 65 L36 59.8 L38.6 64.7 L41 59.5 L43.6 64.4 L46 59.5 L48.5 64Z" fill="#f6eedc" />
        <path d="M10 48 C12 40 24 32 40 28 C54 24 68 24 78 32 C86 40 88 52 82 60 L72 56 L44 54 L12 51Z" fill="url(#raptor-skin)" {...ol} />
        <path d="M14 51 L16.5 56 L19 51.4 L21.5 57 L24 51.8 L26.5 57.5 L29 52.2 L31.5 58 L34 52.6 L36.5 58 L39 53 L41.5 58.5 L44 54Z" fill="#f6eedc" />
        <path
          d="M42 30 C44 36 44 42 42 47 M52 27 C55 34 55 42 52 49 M65 27 C68 35 67 44 64 51 M70 64 C75 72 75 81 71 90 M81 61 C86 72 86 84 82 96"
          fill="none"
          stroke="#2a0a04"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path d="M52 37 L65 34 L63 41 L54 41Z" fill="#ffd23a" stroke={K} strokeWidth="1" />
        <path d="M59 34.6 L58.6 41" stroke={K} strokeWidth="1.5" />
        <path d="M47 34 L67 29.5" stroke={K} strokeWidth="2.8" strokeLinecap="round" />
        <ellipse cx="17" cy="44" rx="2.2" ry="1.1" fill={K} transform="rotate(-25 17 44)" />
        {rim('M11 47 C14 39 26 32 40 28.5 C50 26 58 25 64 25.5', '#ffe6b8', 1.8, 0.75)}
        {rim('M52 99 C54 84 59 71 64 59', '#ffe6b8', 1.3, 0.5)}
      </g>
    ),
  },

  zealot: {
    bg: ['#6e1c20', '#160607'],
    draw: () => (
      <g>
        <defs>
          {lg('zealot-red', ['#e4463e', '#9e1a1e', '#3e0608'])}
          {lg('zealot-white', ['#ffffff', '#e8ded0', '#968a7c'])}
          {lg('zealot-steel', ['#f4f6fa', '#a4a8b2', '#4a4e58'])}
          {lg('zealot-skin', ['#f4caa4', '#c48a62', '#6e4230'])}
        </defs>
        <path d="M6 100 C10 82 24 72 40 70 L60 70 C76 72 90 82 94 100Z" fill="url(#zealot-red)" {...ol} />
        <path d="M33 74 L67 74 L64 100 L36 100Z" fill="url(#zealot-white)" stroke="#8e161c" strokeWidth="2.2" strokeLinejoin="round" />
        <path
          d="M50 78 C44 85 44 92 50 98 C56 92 56 85 50 78Z M42 86 C40 90 41 94 44 96 M58 86 C60 90 59 94 56 96"
          fill="url(#zealot-red)"
          stroke="#8e161c"
          strokeWidth="1.4"
        />
        <path
          d="M50 19 C35 19 28 32 28 48 C28 62 33 72 41 78 L59 78 C67 72 72 62 72 48 C72 32 65 19 50 19Z"
          fill="url(#zealot-red)"
          {...ol}
          strokeWidth="1.5"
        />
        <path
          d="M50 33 C42 33 37.5 41 37.5 51 C37.5 62 43 70 50 72 C57 70 62.5 62 62.5 51 C62.5 41 58 33 50 33Z"
          fill="url(#zealot-skin)"
          stroke={K}
          strokeWidth="1.2"
        />
        <path d="M40 60 C42 67 46 71 50 71 C54 71 58 67 60 60 C57 65 53 66 50 66 C47 66 43 65 40 60Z" fill="#5a3424" opacity="0.45" />
        <path d="M29 37 C29 23 39 15 50 15 C61 15 71 23 71 37 Q50 31 29 37Z" fill="url(#zealot-steel)" {...ol} strokeWidth="1.5" />
        <path d="M26 38 Q50 30 74 38 L74 42.5 Q50 35 26 42.5Z" fill="url(#zealot-steel)" {...ol} strokeWidth="1.3" />
        <path d="M50 15.5 V32" stroke="#5a5e68" strokeWidth="1.4" />
        <ellipse cx="44" cy="48.5" rx="3.4" ry="2.8" fill="#fbf6ec" />
        <ellipse cx="56" cy="48.5" rx="3.4" ry="2.8" fill="#fbf6ec" />
        <circle cx="44.4" cy="48.6" r="1.1" fill="#1a0a06" />
        <circle cx="55.6" cy="48.6" r="1.1" fill="#1a0a06" />
        <path d="M39 43.5 L47.5 46.5 M61 43.5 L52.5 46.5" stroke="#3a1e12" strokeWidth="2.3" strokeLinecap="round" />
        <path d="M50 49 L48.5 56 L51 56.5" fill="none" stroke="#8a5a3e" strokeWidth="1" />
        <path d="M43.5 60 Q50 58.5 56.5 60 Q56 67.5 50 68.5 Q44 67.5 43.5 60Z" fill="#3a0a0a" stroke={K} strokeWidth="0.9" />
        <path d="M44.2 60.4 Q50 59 55.8 60.4 L55.4 62.2 Q50 61.2 44.6 62.2Z" fill="#f4ecdc" />
        {rim('M31 34 C32 24 40 16 50 16', '#ffffff', 1.6, 0.8)}
        {rim('M29 46 C29 36 33 27 39 22', '#ffd0b8', 1.3, 0.55)}
        {rim('M8 96 C12 82 24 73 40 71', '#ffd0b8', 1.3, 0.5)}
      </g>
    ),
  },

  'zealot-priest': {
    bg: ['#7a2420', '#170607'],
    draw: () => (
      <g>
        <defs>
          {lg('zealot-priest-red', ['#e64c44', '#9a1c20', '#3c0609'])}
          {lg('zealot-priest-gold', ['#fff2b0', '#e2ac40', '#8a5810'])}
          {lg('zealot-priest-skin', ['#f2c8a4', '#c08a66', '#6a4030'])}
          {lg('zealot-priest-white', ['#ffffff', '#e6dccb', '#9a8e7e'])}
          {glow('zealot-priest-glow', '#ffe08a', 0.95)}
        </defs>
        <path d="M6 100 C10 80 26 70 50 70 C74 70 90 80 94 100Z" fill="url(#zealot-priest-red)" {...ol} />
        <path d="M33 72 L41 100 H49 L44 72Z M67 72 L59 100 H51 L56 72Z" fill="url(#zealot-priest-white)" stroke="#c89430" strokeWidth="1.4" />
        <path d="M37 69 Q50 77 63 69 L61 65 Q50 71 39 65Z" fill="url(#zealot-priest-gold)" stroke={K} strokeWidth="0.8" />
        <circle cx="75" cy="86" r="14" fill="url(#zealot-priest-glow)" />
        <path d="M75 78 L76.8 84.2 L83 86 L76.8 87.8 L75 94 L73.2 87.8 L67 86 L73.2 84.2Z" fill="#fffbe6" />
        <path
          d="M50 32 C40 32 35 40 35 50 C35 62 42 71 50 73 C58 71 65 62 65 50 C65 40 60 32 50 32Z"
          fill="url(#zealot-priest-skin)"
          {...ol}
          strokeWidth="1.5"
        />
        <path d="M37 54 C38 49 41 47 44 47 M63 54 C62 49 59 47 56 47" fill="none" stroke="#7a4a34" strokeWidth="0.8" opacity="0.7" />
        <path d="M44.5 64.5 Q50 68 55.5 64.5 L52.5 77 L50 80 L47.5 77Z" fill="#d6d0c4" stroke={K} strokeWidth="0.8" />
        <path d="M40 50.5 Q43.5 48.4 47 51 Q43.5 52.6 40 50.5Z M60 50.5 Q56.5 48.4 53 51 Q56.5 52.6 60 50.5Z" fill="#fff6d8" />
        <circle cx="44" cy="50.6" r="1.15" fill="#3a2a1a" />
        <circle cx="56" cy="50.6" r="1.15" fill="#3a2a1a" />
        <path d="M38.5 46.6 L47 48.8 M61.5 46.6 L53 48.8" stroke="#a8a296" strokeWidth="2.1" strokeLinecap="round" />
        <path d="M50 51.5 L48.5 59 L51 59.5" fill="none" stroke="#7a4a34" strokeWidth="1" />
        <path d="M45.5 63.5 Q50 62 54.5 63.5" fill="none" stroke="#5a2a1e" strokeWidth="1.3" />
        <path d="M34 42 L33 22 Q41 14 50 7 Q59 14 67 22 L66 42 Q50 37 34 42Z" fill="url(#zealot-priest-red)" {...ol} />
        <path d="M48 12 L52 12 L52 36 L48 36Z" fill="url(#zealot-priest-gold)" />
        <path d="M34 42 Q50 37 66 42 L66 36.5 Q50 31.5 34 36.5Z" fill="url(#zealot-priest-gold)" stroke={K} strokeWidth="0.8" />
        <path d="M50 16 C46 21 46 26 50 30 C54 26 54 21 50 16Z" fill="#fff6dc" stroke="#b07a1a" strokeWidth="1" />
        {rim('M34.5 40 L34 23 Q41 15 49 8.5', '#fff0d0', 1.6, 0.8)}
        {rim('M36.5 47 C37 41 40 37 44 35', '#ffe0c0', 1.2, 0.55)}
        {rim('M8 96 C12 82 26 72 42 70.5', '#ffd0b8', 1.3, 0.5)}
      </g>
    ),
  },

  'zealot-guard': {
    bg: ['#62181c', '#140506'],
    draw: () => (
      <g>
        <defs>
          {lg('zealot-guard-steel', ['#f2f4f8', '#9aa0aa', '#454a54', '#1c1e24'])}
          {lg('zealot-guard-red', ['#dc3e40', '#8e161c', '#3a0608'])}
          {glow('zealot-guard-glow', '#ff4a2a', 0.8)}
        </defs>
        <path d="M30 100 L32 74 L68 74 L70 100Z" fill="url(#zealot-guard-red)" {...ol} strokeWidth="1.4" />
        <path d="M50 79 C45 85 45 92 50 98 C55 92 55 85 50 79Z" fill="#f2ead8" stroke={K} strokeWidth="0.8" />
        <path d="M2 100 L3 82 C4 68 16 60 30 61 C40 62 43 70 43 80 L40 100Z" fill="url(#zealot-guard-steel)" {...ol} />
        <path d="M98 100 L97 82 C96 68 84 60 70 61 C60 62 57 70 57 80 L60 100Z" fill="url(#zealot-guard-steel)" {...ol} />
        <path
          d="M4 84 C10 75 26 71 42 76 M3 93 C12 85 28 83 41 87 M96 84 C90 75 74 71 58 76 M97 93 C88 85 72 83 59 87"
          fill="none"
          stroke={K}
          strokeWidth="1.3"
        />
        <path d="M4 84 C10 75 26 71 42 76 L42 79 C26 74 12 78 4 87Z M96 84 C90 75 74 71 58 76 L58 79 C74 74 88 78 96 87Z" fill="#a81c22" />
        <g fill="#f0ece4">
          <circle cx="14" cy="69" r="1.2" />
          <circle cx="30" cy="65" r="1.2" />
          <circle cx="86" cy="69" r="1.2" />
          <circle cx="70" cy="65" r="1.2" />
        </g>
        <path d="M40 16 C39 6 46 3 52 4 C59 5 63 9 61 16Z" fill="url(#zealot-guard-red)" {...ol} strokeWidth="1.2" />
        <path
          d="M32 32 C32 19 40 12 50 12 C60 12 68 19 68 32 L68 64 C68 71 60 76 50 76 C40 76 32 71 32 64Z"
          fill="url(#zealot-guard-steel)"
          {...ol}
          strokeWidth="1.8"
        />
        <path d="M32 29 Q50 24 68 29 L68 35.5 Q50 30.5 32 35.5Z" fill="url(#zealot-guard-red)" stroke={K} strokeWidth="1" />
        <path d="M35 43 Q50 40 65 43 L64 49 Q50 46.5 36 49Z" fill="#080404" stroke={K} strokeWidth="1" />
        <circle cx="43" cy="45.5" r="4.5" fill="url(#zealot-guard-glow)" />
        <circle cx="57" cy="45.5" r="4.5" fill="url(#zealot-guard-glow)" />
        <ellipse cx="43" cy="45.4" rx="2.4" ry="0.9" fill="#ff8a5a" />
        <ellipse cx="57" cy="45.4" rx="2.4" ry="0.9" fill="#ff8a5a" />
        <path d="M48.6 48.5 h2.8 v27 h-2.8Z" fill="#c8ccd4" stroke={K} strokeWidth="0.8" />
        <g fill="#0a0606">
          <circle cx="40" cy="58" r="1" />
          <circle cx="44" cy="60" r="1" />
          <circle cx="40" cy="63" r="1" />
          <circle cx="44" cy="65" r="1" />
          <circle cx="60" cy="58" r="1" />
          <circle cx="56" cy="60" r="1" />
          <circle cx="60" cy="63" r="1" />
          <circle cx="56" cy="65" r="1" />
        </g>
        {rim('M34 40 V31 C34 21 41 14 50 13.5', '#ffffff', 1.8, 0.85)}
        {rim('M4 82 C5 70 16 62 29 62', '#ffffff', 1.6, 0.75)}
        {rim('M42 13 C42 8 46 5 51 5', '#ffd0c0', 1.2, 0.6)}
      </g>
    ),
  },

  abbot: {
    bg: ['#8a2a1a', '#140404'],
    draw: () => (
      <g>
        <defs>
          {lg('abbot-red', ['#e04840', '#901a1c', '#320507'])}
          {lg('abbot-gold', ['#fff4b8', '#e4ac3c', '#7a4a10'])}
          {lg('abbot-beard', ['#f6f0e6', '#b0a89a', '#6a6258'])}
          {glow('abbot-fire', '#ffb43a', 0.95)}
        </defs>
        <circle cx="50" cy="44" r="42" fill="url(#abbot-fire)" opacity="0.35" />
        <path d="M0 100 C2 78 18 64 50 64 C82 64 98 78 100 100Z" fill="url(#abbot-red)" {...ol} />
        <path d="M30 67 L40 100 H48 L42 69Z M70 67 L60 100 H52 L58 69Z" fill="#f0e6d0" stroke="#d8a03a" strokeWidth="1.8" />
        <path d="M40 84 L46 84 M42 92 L48 92 M60 84 L54 84 M58 92 L52 92" stroke="#c88a24" strokeWidth="1.6" />
        <path d="M50 7 C30 9 18 27 19 50 C20 62 26 70 32 74 L68 74 C74 70 80 62 81 50 C82 27 70 9 50 7Z" fill="url(#abbot-red)" {...ol} />
        <path
          d="M50 21 C38 21 31 33 31 48 C31 60 39 70 50 74 C61 70 69 60 69 48 C69 33 62 21 50 21Z"
          fill="#1a0505"
          stroke="url(#abbot-gold)"
          strokeWidth="2.6"
        />
        <path d="M50 29 C42 29 37 37 37 47 C37 57 43 64 50 66 C57 64 63 57 63 47 C63 37 58 29 50 29Z" fill="#6a3a2a" opacity="0.75" />
        <path d="M38 41 L50 45 L62 41 L62 44 L50 48.5 L38 44Z" fill="#1a0505" opacity="0.7" />
        <path d="M37 55 C37 70 43 84 50 95 C57 84 63 70 63 55 C59 61 55 62 50 59 C45 62 41 61 37 55Z" fill="url(#abbot-beard)" stroke={K} strokeWidth="1" />
        <path d="M44 66 C45 74 47 80 50 86 M56 66 C55 74 53 80 50 86" fill="none" stroke="#8a8276" strokeWidth="0.9" />
        <circle cx="43" cy="47" r="9" fill="url(#abbot-fire)" />
        <circle cx="57" cy="47" r="9" fill="url(#abbot-fire)" />
        <path d="M37.5 45 L47 48 L39 49.5Z M62.5 45 L53 48 L61 49.5Z" fill="#fffbe0" />
        <path d="M50 49 L48.6 55.5 L51 56" fill="none" stroke="#2a0e08" strokeWidth="1.1" />
        <path d="M15.5 100 L18 36 L21.5 36 L20.5 100Z" fill="url(#abbot-gold)" stroke={K} strokeWidth="1.2" />
        <path d="M24 15 C30 10 28 5 33 2" fill="none" stroke="#d8d0c8" strokeWidth="2" opacity="0.4" strokeLinecap="round" />
        <circle cx="20" cy="27" r="11" fill="url(#abbot-fire)" />
        <circle cx="20" cy="27" r="8" fill="none" stroke="url(#abbot-gold)" strokeWidth="3" />
        <path
          d="M20 16 L21.5 19 L18.5 19Z M20 38 L21.5 35 L18.5 35Z M9 27 L12 25.5 L12 28.5Z M31 27 L28 25.5 L28 28.5Z"
          fill="#f0c050"
          stroke={K}
          strokeWidth="0.6"
        />
        <circle cx="20" cy="27" r="4.6" fill="#ffd060" stroke="#7a4a10" strokeWidth="1" />
        <circle cx="19" cy="26" r="2" fill="#fffbe0" />
        {rim('M21 46 C22 28 33 11 50 8', '#ffe0b0', 1.8, 0.75)}
        {rim('M2 96 C6 78 22 66 44 64.5', '#ffe0b0', 1.4, 0.5)}
      </g>
    ),
  },

  'human-warrior': {
    bg: ['#2c3e62', '#090c18'],
    draw: () => (
      <g>
        <defs>
          {lg('human-warrior-blue', ['#76a4ec', '#2e58a8', '#10204a'])}
          {lg('human-warrior-steel', ['#f6f8fc', '#a8b0bc', '#4e5664', '#20242c'])}
          {lg('human-warrior-gold', ['#fff4b8', '#e6b44a', '#8a5a14'])}
          {lg('human-warrior-skin', ['#f4caa2', '#c48a62', '#764830'])}
        </defs>
        <path d="M30 100 L33 72 L67 72 L70 100Z" fill="url(#human-warrior-steel)" {...ol} strokeWidth="1.4" />
        <path d="M38 76 L62 76 L60 100 L40 100Z" fill="url(#human-warrior-blue)" stroke="#d8a840" strokeWidth="1.6" />
        <path
          d="M50 80 L52.6 86.6 L59.5 86.8 L54.2 91 L56 97.5 L50 93.7 L44 97.5 L45.8 91 L40.5 86.8 L47.4 86.6Z"
          fill="url(#human-warrior-gold)"
          stroke={K}
          strokeWidth="0.6"
        />
        <path d="M2 100 L3 80 C4 66 16 58 30 59 C40 60 44 68 44 78 L41 100Z" fill="url(#human-warrior-blue)" {...ol} />
        <path d="M98 100 L97 80 C96 66 84 58 70 59 C60 60 56 68 56 78 L59 100Z" fill="url(#human-warrior-blue)" {...ol} />
        <path
          d="M4 80 C5 67 16 60.5 30 61 C39 62 42 69 42 78 M96 80 C95 67 84 60.5 70 61 C61 62 58 69 58 78"
          fill="none"
          stroke="url(#human-warrior-gold)"
          strokeWidth="2.6"
        />
        <path
          d="M30 40 C30 22 39 13 50 13 C61 13 70 22 70 40 L70 63 C70 70 64 74 59 75 L59 42 L41 42 L41 75 C36 74 30 70 30 63Z"
          fill="url(#human-warrior-steel)"
          {...ol}
        />
        <path d="M41 40 L59 40 L59 69 C57 74 53.5 76 50 76 C46.5 76 43 74 41 69Z" fill="url(#human-warrior-skin)" stroke={K} strokeWidth="1" />
        <path d="M41 61 C42.5 71 46 76 50 76 C54 76 57.5 71 59 61 L57 65.5 Q50 70.5 43 65.5Z" fill="#5a3a20" />
        <ellipse cx="45.8" cy="51" rx="2.4" ry="1.4" fill="#f6f2ea" />
        <ellipse cx="54.2" cy="51" rx="2.4" ry="1.4" fill="#f6f2ea" />
        <circle cx="46.2" cy="51" r="1.15" fill="#2a4a8a" />
        <circle cx="53.8" cy="51" r="1.15" fill="#2a4a8a" />
        <path d="M42.5 47.6 L48.6 48.8 M57.5 47.6 L51.4 48.8" stroke="#3a2414" strokeWidth="1.9" strokeLinecap="round" />
        <path d="M50 51.5 L48.8 58.2 L51.2 58.6" fill="none" stroke="#8a5a3a" strokeWidth="0.9" />
        <path d="M46.2 63.6 L53.8 63.6" stroke="#4a2414" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M31 31 Q50 21 69 31 L69 42 Q50 34 31 42Z" fill="url(#human-warrior-steel)" {...ol} strokeWidth="1.4" />
        <path d="M31 42 Q50 34 69 42" fill="none" stroke="url(#human-warrior-gold)" strokeWidth="2.2" />
        <path d="M38 32.5 V36 M44 30.2 V33.6 M56 30.2 V33.6 M62 32.5 V36" stroke={K} strokeWidth="1.4" />
        <path d="M48 13.5 L52 13.5 L52.4 27 L47.6 27Z" fill="url(#human-warrior-gold)" stroke={K} strokeWidth="0.8" />
        <path d="M50 14 C46 7 51 3 57 4.5 C63 6 67 11 70 18 C63 13 57 12 50 14Z" fill="url(#human-warrior-blue)" stroke={K} strokeWidth="1" />
        {rim('M32 38 C32 24 40 15 49 14', '#ffffff', 1.8, 0.8)}
        {rim('M4 82 C5 68 16 60 30 60', '#ffffff', 1.5, 0.6)}
      </g>
    ),
  },

  'nelf-rogue': {
    bg: ['#2c2c64', '#08081c'],
    draw: () => (
      <g>
        <defs>
          {lg('nelf-rogue-skin', ['#d0b0f4', '#8a64c0', '#3a2268'])}
          {lg('nelf-rogue-hood', ['#505872', '#232838', '#090b11'])}
          {lg('nelf-rogue-hair', ['#ffffff', '#cdd4e8', '#7a84a0'])}
          {glow('nelf-rogue-glow', '#d8e8ff', 0.95)}
        </defs>
        <path d="M8 100 C12 82 26 74 50 74 C74 74 88 82 92 100Z" fill="url(#nelf-rogue-hood)" {...ol} />
        <path d="M22 80 L64 100 H55 L18 84Z" fill="#3a2a1e" stroke={K} strokeWidth="1" />
        <path d="M78 78 L90 62" stroke="#3a2a1e" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M74 82 L82 74" stroke="#c8ccd8" strokeWidth="2" strokeLinecap="round" />
        <path d="M33 45 L8 30 L18 42 L32 56Z" fill="url(#nelf-rogue-skin)" {...ol} strokeWidth="1.4" />
        <path d="M67 45 L92 30 L82 42 L68 56Z" fill="url(#nelf-rogue-skin)" {...ol} strokeWidth="1.4" />
        <path d="M50 10 C34 10 25 24 25 42 C25 58 30 70 36 78 L64 78 C70 70 75 58 75 42 C75 24 66 10 50 10Z" fill="url(#nelf-rogue-hood)" {...ol} />
        <path d="M50 23 C40 23 34 32 34 45 C34 58 41 68 50 72 C59 68 66 58 66 45 C66 32 60 23 50 23Z" fill="url(#nelf-rogue-skin)" />
        <path
          d="M34 47 C33 32 40 23 50 23 C60 23 67 32 66 47 C63 39 60 34 57 32 C56 38 53 41 50 44 C47 41 44 38 43 32 C40 34 37 39 34 47Z"
          fill="url(#nelf-rogue-hair)"
        />
        <path d="M34.5 44 C33.5 55 34.5 63 38 71 L40 58Z M65.5 44 C66.5 55 65.5 63 62 71 L60 58Z" fill="url(#nelf-rogue-hair)" />
        <path d="M35.5 54 Q50 60 64.5 54 L62 64 Q56 72 50 74 Q44 72 38 64Z" fill="#14141e" stroke={K} strokeWidth="1" />
        <circle cx="43" cy="49.5" r="7" fill="url(#nelf-rogue-glow)" />
        <circle cx="57" cy="49.5" r="7" fill="url(#nelf-rogue-glow)" />
        <path d="M37.5 47 Q43 46.5 47.5 50.5 Q42 51.5 37.5 47Z M62.5 47 Q57 46.5 52.5 50.5 Q58 51.5 62.5 47Z" fill="#f8fbff" />
        <path d="M37 44 L46.5 47 M63 44 L53.5 47" stroke="#e6ecf8" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M39 53 L41.5 56.5 M61 53 L58.5 56.5" stroke="#5ad0c0" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
        {rim('M27 40 C27 24 37 12 50 11', '#d8e0ff', 1.7, 0.7)}
        {rim('M9 30 L33 45', '#f0e0ff', 1.2, 0.6)}
        {rim('M10 96 C14 82 26 75 42 74', '#d8e0ff', 1.3, 0.45)}
      </g>
    ),
  },

  'ember-tyrant': {
    bg: ['#92300a', '#1a0502'],
    draw: () => (
      <g>
        <defs>
          {rg('ember-tyrant-fire', ['#fff4b0', '#ffb030', '#e2440c', '#7a1404'], 0.5, 0.7, 0.62)}
          {lg('ember-tyrant-rock', ['#5e4c44', '#2e2420', '#100a08'])}
          {lg('ember-tyrant-horn', ['#6a6074', '#1e1a22', '#050407'])}
          {rg('ember-tyrant-maw', ['#fffbe0', '#ffd040', '#ff6a10', '#7a1404'], 0.5, 0.35, 0.65)}
          {glow('ember-tyrant-glow', '#ffcf40', 0.95)}
        </defs>
        <path
          d="M12 74 C4 54 10 34 20 22 C20 30 24 35 29 35 C27 22 33 10 43 4 C42 13 46 19 50 21 C54 19 58 13 57 4 C67 10 73 22 71 35 C76 35 80 30 80 22 C90 34 96 54 88 74Z"
          fill="url(#ember-tyrant-fire)"
        />
        <path d="M0 100 L3 80 C12 68 28 63 50 63 C72 63 88 68 97 80 L100 100Z" fill="url(#ember-tyrant-rock)" {...ol} />
        <path
          d="M14 80 L22 86 L20 95 M86 80 L78 87 L80 96 M40 70 L44 78 L40 87 M60 70 L57 80 L61 90"
          fill="none"
          stroke="#ffa030"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M35 36 C24 32 12 22 9 6 C18 15 27 19 39 25Z" fill="url(#ember-tyrant-horn)" {...ol} strokeWidth="1.4" />
        <path d="M65 36 C76 32 88 22 91 6 C82 15 73 19 61 25Z" fill="url(#ember-tyrant-horn)" {...ol} strokeWidth="1.4" />
        <path d="M50 22 C38 22 31 30 31 40 L28 54 C30 68 40 80 50 83 C60 80 70 68 72 54 L69 40 C69 30 62 22 50 22Z" fill="url(#ember-tyrant-rock)" {...ol} />
        <path d="M31 42 L50 49 L69 42 L68 38 L50 44.5 L32 38Z" fill="#160e0c" />
        <path
          d="M38 27 L42 33 L39 39 M62 27 L58 33 L61 39 M50 23 L48 29 L52 35 L50 41 M31 55 L37 58.5 L35 64 M69 55 L63 58.5 L65 64"
          fill="none"
          stroke="#ffa830"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <circle cx="40" cy="47" r="10" fill="url(#ember-tyrant-glow)" />
        <circle cx="60" cy="47" r="10" fill="url(#ember-tyrant-glow)" />
        <path d="M33 44 L47 49 L36 51Z M67 44 L53 49 L64 51Z" fill="#fffbe0" />
        <path d="M37 58 Q50 54 63 58 L61 73 Q50 83 39 73Z" fill="url(#ember-tyrant-maw)" {...ol} strokeWidth="1.4" />
        <path d="M38 58.2 L41 64 L43 57 L46 63 L48 56 L50 62 L52 56 L54 63 L57 57 L59 64 L62 58.2Z" fill="#241a16" />
        <path d="M39.6 73.4 L43 68.5 L45 75.5 L48 70 L50 77 L52 70 L55 75.5 L57 68.5 L60.4 73.4 Q50 82.5 39.6 73.4Z" fill="#241a16" />
        <path d="M40 78 C38 86 42 92 46 98 C46 92 48 90 50 95 C52 90 54 92 54 98 C58 92 62 86 60 78 Q50 86 40 78Z" fill="url(#ember-tyrant-fire)" />
        {rim('M33 36 C33 28 40 22.5 50 22.5', '#ffe0a0', 1.6, 0.7)}
        {rim('M11 9 C15 18 25 25 37 28', '#c8b8e0', 1.2, 0.55)}
        {rim('M3 80 C12 69 26 64 44 63.5', '#ffd090', 1.4, 0.55)}
      </g>
    ),
  },

  'ember-imp': {
    bg: ['#8a3a10', '#170602'],
    draw: () => (
      <g>
        <defs>
          {lg('ember-imp-skin', ['#ff9a54', '#d8401c', '#641005'])}
          {rg('ember-imp-fire', ['#fff6c0', '#ffc030', '#ff6a14', '#a01e04'], 0.5, 0.85, 0.75)}
          {glow('ember-imp-glow', '#ffe060', 0.9)}
        </defs>
        <g fill="#ffd060">
          <circle cx="18" cy="24" r="1.5" />
          <circle cx="82" cy="20" r="1.2" />
          <circle cx="86" cy="34" r="1.6" />
          <circle cx="14" cy="66" r="1.1" />
        </g>
        <path d="M22 100 C24 86 36 79 50 79 C64 79 76 86 78 100Z" fill="url(#ember-imp-skin)" {...ol} strokeWidth="1.5" />
        <path d="M36 38 C31 26 38 18 42 7 C44 15 48 15 49 4 C54 13 58 17 58 9 C65 19 69 28 64 38Z" fill="url(#ember-imp-fire)" />
        <path d="M31 50 L6 34 L13 46 L7 51 L15 55 L31 62Z" fill="url(#ember-imp-skin)" {...ol} strokeWidth="1.4" />
        <path d="M69 50 L94 34 L87 46 L93 51 L85 55 L69 62Z" fill="url(#ember-imp-skin)" {...ol} strokeWidth="1.4" />
        <path d="M50 30 C35 30 27 41 28 55 C29 67 39 78 50 80 C61 78 71 67 72 55 C73 41 65 30 50 30Z" fill="url(#ember-imp-skin)" {...ol} />
        <path d="M38 35 C33 29 32 23 35 16 C36 22 40 27 45 31Z M62 35 C67 29 68 23 65 16 C64 22 60 27 55 31Z" fill="#2a0e08" stroke={K} strokeWidth="1" />
        <circle cx="41" cy="52" r="8" fill="url(#ember-imp-glow)" />
        <circle cx="59" cy="52" r="8" fill="url(#ember-imp-glow)" />
        <path d="M33.5 48 L47 53 Q42 57.5 36 54.5Z M66.5 48 L53 53 Q58 57.5 64 54.5Z" fill="#ffe85a" stroke={K} strokeWidth="0.9" />
        <path d="M41.6 50.4 L42.2 55.6 M58.4 50.4 L57.8 55.6" stroke={K} strokeWidth="1.5" />
        <path d="M31.5 45 L46.5 50.5 M68.5 45 L53.5 50.5" stroke="#3a0a04" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M48 60.5 L49 62.5 M52 60.5 L51 62.5" stroke="#4a0e06" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M35 64 Q50 80 65 64 Q50 70 35 64Z" fill="#2a0604" stroke={K} strokeWidth="1" />
        <path
          d="M38 65.4 L40 69 L42 66.3 L44 70.3 L46 67 L48 70.8 L50 67.3 L52 70.8 L54 67 L56 70.3 L58 66.3 L60 69 L62 65.4 Q50 69.4 38 65.4Z"
          fill="#fff3d0"
        />
        {rim('M30 50 C30 39 38 31 49 30.5', '#fff0b0', 1.7, 0.75)}
        {rim('M7 34 L31 50', '#fff0b0', 1.2, 0.55)}
      </g>
    ),
  },

  'core-hound': {
    bg: ['#7a240a', '#160402'],
    draw: () => {
      // One canine head in profile facing left; `s` picks gradients whose
      // light direction survives the mirror so both heads are lit upper-left.
      const head = (s) => (
        <g>
          <path d="M30 30 L33 9 L42 27Z M42 33 L53 16 L50 36Z" fill={`url(#core-hound-plate${s})`} {...ol} strokeWidth="1.1" />
          <path d="M7 52 L44 56 L40 71 L11 69Z" fill="url(#core-hound-maw)" />
          <path d="M10 68 L39 67 C39 75 33 81 24 81 C17 81 12 76 10 71Z" fill={`url(#core-hound-rock${s})`} {...ol} strokeWidth="1.3" />
          <path d="M13 68.3 L15 63.5 L17.2 68.2 L19.6 63.7 L21.8 68.1 L24.2 63.9 L26.4 68 L28.8 64.1 L31 67.9Z" fill="#2a1c16" />
          <path
            d="M30 24 C44 21 54 30 54 43 C54 53 48 59 41 60 L14 57 C8 56.5 5 53.5 5 50 C5 47 7.5 45 11 44 L22 39 C24 31 26 26 30 24Z"
            fill={`url(#core-hound-rock${s})`}
            {...ol}
          />
          <path d="M22 39 L26 28 L40 24 L51 31 L47 39 L34 41Z" fill={`url(#core-hound-plate${s})`} {...ol} strokeWidth="1" />
          <path d="M12 56.6 L14 61.4 L16.2 57 L18.8 63.6 L21.2 57.4 L23.4 61.8 L25.6 57.7 L28 62 L30.4 58 L32.6 62 L35 58.3Z" fill="#2a1c16" />
          <ellipse cx="8.6" cy="48" rx="2.8" ry="2" fill="#050302" />
          <circle cx="30" cy="44" r="10" fill="url(#core-hound-glow)" />
          <path d="M22.5 41.6 L38 43.4 L26.5 48.2Z" fill="#fff4b0" stroke={K} strokeWidth="0.8" />
          <path d="M14 46 L20 50 L18 54 M42 43 L46 49 L42 55 M33 50 L37 53" fill="none" stroke="#ffa030" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M21 80 C20 84 21.5 88 23.5 89.5 C25.5 88 26 84 25 80Z" fill="#ffb030" />
        </g>
      );
      return (
        <g>
          <defs>
            {lg('core-hound-rock', ['#6e5a4e', '#34281f', '#0e0907'])}
            {lg('core-hound-plate', ['#a49488', '#5a4c46', '#2a201c'])}
            <linearGradient id="core-hound-rock-r" x1="0.85" y1="0" x2="0.2" y2="1">
              {stops(['#6e5a4e', '#34281f', '#0e0907'])}
            </linearGradient>
            <linearGradient id="core-hound-plate-r" x1="0.85" y1="0" x2="0.2" y2="1">
              {stops(['#a49488', '#5a4c46', '#2a201c'])}
            </linearGradient>
            {rg('core-hound-maw', ['#fffbe0', '#ffc030', '#e04a0c'], 0.5, 0.3, 0.7)}
            {glow('core-hound-glow', '#ffc040', 0.95)}
          </defs>
          <path d="M4 100 C6 82 18 70 32 66 L50 72 L68 66 C82 70 94 82 96 100Z" fill="url(#core-hound-rock)" {...ol} />
          <path d="M30 56 L50 50 L70 56 L74 76 L26 76Z" fill="url(#core-hound-rock)" {...ol} />
          <path d="M14 84 L24 76 L36 80 L32 92 L18 94Z M86 84 L76 76 L64 80 L68 92 L82 94Z" fill="url(#core-hound-plate)" {...ol} strokeWidth="1" />
          <path d="M44 78 L50 86 L56 78 M50 86 L49 98 M40 62 L46 68 M60 62 L54 68" fill="none" stroke="#ffa030" strokeWidth="1.8" strokeLinejoin="round" />
          <g transform="translate(2 4) scale(0.9)">{head('')}</g>
          <g transform="matrix(-1 0 0 1 100 0) translate(2 4) scale(0.9)">{head('-r')}</g>
          {rim('M8 45 L22 39 C24 32 26 28 30 26', '#ffd090', 1.6, 0.65)}
          {rim('M50.5 31 C52 26 56 23 62 23', '#ffd090', 1.4, 0.55)}
          {rim('M6 96 C8 82 18 71 30 67', '#ffd090', 1.3, 0.5)}
        </g>
      );
    },
  },
};
