// Ability icon wrapper. Each glyph entry is
//   { draw: ({ c1, c2, c3 }) => <g>…</g> }
// drawn in a 64×64 viewBox. c1 = light highlight, c2 = school colour,
// c3 = deep shade of the school. The wrapper paints the school-tinted
// background, inner vignette and bevelled frame.
import { GLYPHS_A } from './icons-a.jsx';
import { GLYPHS_B } from './icons-b.jsx';
import { IMAGES, ABILITY_IMG, AURA_IMG } from './art-images.gen.js';

export const GLYPHS = { ...GLYPHS_A, ...GLYPHS_B };

export const SCHOOL_COLORS = {
  fire: ['#ffe3a3', '#ff7a2f', '#6e1a04'],
  frost: ['#effbff', '#7fd4ff', '#173f66'],
  arcane: ['#f6e6ff', '#c78bff', '#3f1868'],
  shadow: ['#ece2ff', '#9b6bff', '#24113f'],
  holy: ['#fffbe6', '#ffe08a', '#7a5a0c'],
  nature: ['#efffe2', '#7ed957', '#1b4d10'],
  physical: ['#fff6e6', '#d8c7a8', '#4f3f2a'],
};

const FALLBACK = {
  draw: ({ c1, c2 }) => (
    <g>
      <circle cx="32" cy="32" r="14" fill={c2} />
      <circle cx="28" cy="28" r="5" fill={c1} opacity="0.8" />
    </g>
  ),
};

// `ability` / `aura` are content IDs: when an approved spell icon is linked to
// that ID it replaces the glyph; otherwise the SVG glyph `icon` is drawn.
export function AbilityIcon({ icon, school = 'physical', size = 40, className = '', x, y, ability, aura }) {
  const img = (aura && AURA_IMG[aura]) ?? (ability && ABILITY_IMG[ability]);
  if (img !== undefined && img !== null) {
    return (
      <svg className={'ability-icon ' + className} x={x} y={y} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <rect x="0" y="0" width="64" height="64" rx="7" fill="#07060a" />
        <image href={IMAGES[img]} x="2" y="2" width="60" height="60" preserveAspectRatio="xMidYMid slice" />
        <rect x="1.5" y="1.5" width="61" height="61" rx="6" fill="none" stroke="#000" strokeOpacity="0.85" strokeWidth="3" />
        <rect x="3.5" y="3.5" width="57" height="57" rx="5" fill="none" stroke="#fff" strokeOpacity="0.12" strokeWidth="1.5" />
      </svg>
    );
  }
  const g = GLYPHS[icon] || GLYPHS.generic || FALLBACK;
  const [c1, c2, c3] = SCHOOL_COLORS[school] || SCHOOL_COLORS.physical;
  const bid = 'ibg-' + (SCHOOL_COLORS[school] ? school : 'physical');
  return (
    <svg className={'ability-icon ' + className} x={x} y={y} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id={bid} cx="50%" cy="42%" r="75%">
          <stop offset="0" stopColor={c3} />
          <stop offset="1" stopColor="#07060a" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="64" height="64" rx="7" fill={`url(#${bid})`} />
      <g>{(g.draw || FALLBACK.draw)({ c1, c2, c3 })}</g>
      <rect x="1.5" y="1.5" width="61" height="61" rx="6" fill="none" stroke="#000" strokeOpacity="0.85" strokeWidth="3" />
      <rect x="3.5" y="3.5" width="57" height="57" rx="5" fill="none" stroke="#fff" strokeOpacity="0.12" strokeWidth="1.5" />
    </svg>
  );
}
