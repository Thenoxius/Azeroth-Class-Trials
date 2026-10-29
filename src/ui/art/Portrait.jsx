// Portrait wrapper. Each entry in the portrait maps is
//   { bg: [innerColor, outerColor], draw: () => <g>…</g> }
// drawn in a 100×100 viewBox, head-and-shoulders, centred on (50,50) so it
// reads inside a circular crop of radius ~46 and at sizes down to 28px.
import { PORTRAITS_HEROES } from './portraits-heroes.jsx';
import { PORTRAITS_FOES } from './portraits-foes.jsx';
import { PORTRAIT_IMG } from './art-images.gen.js';
import { IMAGES } from './art-urls.js';

export const PORTRAITS = { ...PORTRAITS_HEROES, ...PORTRAITS_FOES };
// Units whose bitmap has no SVG drawing of its own fall back to this one.
const SVG_ALIAS = { 'hunter-hawk': 'pet-raptor' };

const FALLBACK = {
  bg: ['#3a3446', '#141018'],
  draw: () => (
    <g>
      <path d="M50 18c-12 0-20 9-20 21 0 9 5 16 12 19-14 3-24 12-26 30h68c-2-18-12-27-26-30 7-3 12-10 12-19 0-12-8-21-20-21z" fill="#8a8197" />
    </g>
  ),
};

export function Portrait({ id, size = 64, dead = false, className = '', title, x, y }) {
  const img = PORTRAIT_IMG[id];
  const deadStyle = dead ? { filter: 'grayscale(1) brightness(0.55)' } : undefined;
  // Approved bitmap portraits (square masters, dark background, facing right)
  // replace the drawing; the circular crop stays with the callers' CSS/clipPath.
  if (img !== undefined) {
    return (
      <svg className={'portrait ' + className} x={x} y={y} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={title || id}>
        <rect width="100" height="100" fill="#121116" />
        <image href={IMAGES[img]} width="100" height="100" preserveAspectRatio="xMidYMid slice" style={deadStyle} />
      </svg>
    );
  }
  const svgId = PORTRAITS[id] ? id : SVG_ALIAS[id];
  const p = PORTRAITS[svgId] || PORTRAITS.generic || FALLBACK;
  const bg = p.bg || FALLBACK.bg;
  const gid = 'pbg-' + (PORTRAITS[svgId] ? svgId : 'generic');
  return (
    <svg className={'portrait ' + className} x={x} y={y} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={title || id}>
      <defs>
        <radialGradient id={gid} cx="50%" cy="38%" r="72%">
          <stop offset="0" stopColor={bg[0]} />
          <stop offset="1" stopColor={bg[1]} />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${gid})`} />
      <g style={deadStyle}>{(p.draw || FALLBACK.draw)()}</g>
    </svg>
  );
}
