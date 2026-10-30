// Presentation starter for the current React-18/global-React project.
// Uses createElement intentionally so Node can syntax-check this file as ESM.
// Copy beside classic-assets.gen.js. build.mjs already discovers the CSS separately.
import { CLASSIC_ASSETS as A } from './classic-assets.gen.js';
const h = React.createElement;

export const CLASSIC_NAV = [
  { id: 'roster', label: 'Characters' },
  { id: 'hall', label: 'Trials' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'method', label: 'How it works' },
];

export function classicAssetVariables() {
  const names = {
    'metal-top-tile': '--act-metal',
    'forest-left': '--act-forest-left',
    'forest-right': '--act-forest-right',
    'night-elf-side-plate': '--act-side-plate',
    'parchment-tile': '--act-paper',
    'content-edge-left': '--act-edge-left',
    'content-edge-right': '--act-edge-right',
    'blue-title-middle': '--act-title-middle',
    'blue-title-left': '--act-title-left',
    'blue-title-right': '--act-title-right',
    'nav-left-cap': '--act-nav-left',
    'nav-right-chevron': '--act-nav-right',
  };
  return Object.fromEntries(Object.entries(names).map(([id, name]) => [name, `url("${A[id]}")`]));
}

export function ClassicShell({ screen, children, onNavigate, hasCharacters = true }) {
  // Never wrap the battle HUD in the menu shell. See ClassicBattleFrame below.
  if (screen === 'battle') throw new Error('Use ClassicBattleFrame for battle; the menu theme must not inherit into combat.');
  const active = ['briefing', 'result'].includes(screen) ? 'hall' : screen;
  const nav = CLASSIC_NAV.map((item) =>
    h(
      'button',
      {
        type: 'button',
        key: item.id,
        className: 'act-classic-nav-link' + (active === item.id ? ' is-active' : ''),
        'aria-current': active === item.id ? 'page' : undefined,
        // The current app needs characters before entering the Hall. Open the existing
        // Roster when none exist; do not create a replacement class-only flow.
        onClick: () => onNavigate(item.id === 'hall' && !hasCharacters ? 'roster' : item.id),
        title: item.id === 'hall' && !hasCharacters ? 'Create a character first' : undefined,
      },
      item.label,
    ),
  );
  return h(
    'div',
    { className: 'act-classic-shell', style: classicAssetVariables() },
    h(
      'div',
      { className: 'act-classic-layout' },
      h(
        'aside',
        { className: 'act-classic-sidebar' },
        h('img', { className: 'act-classic-figure', src: A['night-elf-side-plate'], alt: '', 'aria-hidden': true, width: 196, height: 516 }),
        h(
          'div',
          { className: 'act-classic-logo', 'aria-label': 'World of Warcraft Class Trials' },
          h('img', { src: A['wow-wordmark'], alt: 'World of Warcraft', width: 183, height: 73 }),
          h('span', { className: 'act-classic-subtitle' }, 'Class Trials'),
        ),
        h('nav', { className: 'act-classic-nav', 'aria-label': 'Main navigation' }, nav),
      ),
      h('main', { className: 'act-classic-content', id: 'act-classic-content' }, children),
      h('div', { className: 'act-classic-bottom-rail', 'aria-hidden': true }),
      h('footer', { className: 'act-classic-footer' }, h('span', null, 'Class Trials')),
    ),
  );
}

export function ClassicPanel({ title, children, className = '', heading = 'h2' }) {
  return h(
    'section',
    { className: ('act-classic-panel ' + className).trim() },
    title ? h(heading, { className: 'act-classic-titlebar' }, title) : null,
    h('div', { className: 'act-classic-panel-body' }, children),
  );
}

export function ClassicBattleFrame({ children }) {
  // Same existing App root classes and same child tree. Adds only one marker class
  // and decorative asset variables. No extra header/footer/sidebar or HUD controls.
  return h('div', { className: 'app screen-battle act-classic-battle-frame', style: classicAssetVariables() }, children);
}
