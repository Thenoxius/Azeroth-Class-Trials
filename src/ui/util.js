// Small UI helpers shared by screens and battle components.

export const CLASS_COLORS = {
  hunter: '#AAD372',
  mage: '#3FC7EB',
  priest: '#FFFFFF',
  warrior: '#C69B6D',
  rogue: '#FFF468',
  shaman: '#0070DD',
  warlock: '#8788EE',
  paladin: '#F48CBA',
  druid: '#FF7C0A',
};

// Class colours for text on the dark Hall buttons: Shaman blue is unreadable there.
export const CLASS_TEXT_ON_DARK = { ...CLASS_COLORS, shaman: '#4aa8ff' };

export const SCHOOL_HEX = {
  fire: '#ff7a2f',
  frost: '#7fd4ff',
  arcane: '#c78bff',
  shadow: '#9b6bff',
  holy: '#ffe08a',
  nature: '#7ed957',
  physical: '#d8c7a8',
  arrow: '#e8dcc0',
  trap: '#9bd7ff',
  void: '#7a4bd6',
};

export const RES_COLORS = { mana: '#2f6fe0', focus: '#e08a2f', energy: '#f2d23c', rage: '#c8312b' };

export const DISPEL_COLORS = { magic: '#3f8cff', curse: '#a24bff', disease: '#b08a3c', poison: '#3fb34a' };

export const STATUS_LABEL = {
  'confirmed-official': 'Confirmed by Blizzard',
  'reported-guide': 'Reported by guides',
  'beta-observation': 'Forever datamine / beta evidence',
  'classic-baseline': 'Classic baseline',
  approximation: 'Game approximation',
  speculative: 'Speculative',
};
export const STATUS_SHORT = {
  'confirmed-official': 'Official',
  'reported-guide': 'Guide',
  'beta-observation': 'Beta',
  'classic-baseline': 'Classic',
  approximation: 'Approx.',
  speculative: 'Spec.',
};

export function fmtTime(s) {
  s = Math.max(0, s);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function fmtNum(n) {
  n = Math.round(n || 0);
  if (Math.abs(n) >= 10000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

export function fmtCd(s) {
  if (s >= 60) return Math.ceil(s / 60) + 'm';
  if (s >= 3) return String(Math.ceil(s));
  return s.toFixed(1);
}

export const pct = (a, b) => (b > 0 ? Math.max(0, Math.min(1, a / b)) : 0);

export function unitColor(u, kitColor) {
  if (!u) return '#888';
  if (u.kind === 'player' || u.kind === 'pet') return kitColor || CLASS_COLORS[u.classId] || '#e8d9b0';
  if (u.side === 'player') return CLASS_COLORS[u.classId] || '#6fa8ff';
  return '#e0443a';
}

export const HOTKEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Q', 'E', 'R', 'F', 'Z', 'X', 'C', 'V', 'T', 'G', 'Y', 'H', 'B', 'N'];

import { getAbility } from '../engine/registry.js';

export function auraIcon(a, u) {
  const d = a.def;
  // An aura that is the same spell as the ability with its ID (same name) shares
  // that ability's icon; renamed effects ("Dazed", "Charge Stun") keep their glyph.
  const same = getAbility(a.id);
  const sameSpell = same && same.name === d.name ? a.id : undefined;
  if (d.icon) return { icon: d.icon, school: d.school || 'physical', aura: a.id, ability: sameSpell };
  const ab = d.ability && u && u.ab && u.ab[d.ability];
  return { icon: (ab && ab.icon) || 'generic', school: d.school || (ab && ab.school) || 'physical', aura: a.id, ability: ab ? d.ability : sameSpell };
}

export function describeCost(cost) {
  if (!cost) return '';
  return Object.entries(cost)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${v} ${k}`)
    .join(', ');
}

export const cx = (...xs) => xs.filter(Boolean).join(' ');
