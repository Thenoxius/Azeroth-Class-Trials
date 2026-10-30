// Evidence model constants for the class analysis. Plain JS (node tests import it).
// Everything the verdict depends on lives here or in evidence.js / analyze.js and is
// shown to the player on the Method screen — there is no hidden score.
import { DIMENSIONS } from '../content/facts.js';

export const CLASSES = ['hunter', 'mage', 'priest', 'warrior', 'rogue', 'shaman'];
export const CLASS_NAMES = { hunter: 'Hunter', mage: 'Mage', priest: 'Priest', warrior: 'Warrior', rogue: 'Rogue', shaman: 'Shaman' };
export const DIM_IDS = DIMENSIONS.map((d) => d.id);
export const DIM_NAMES = Object.fromEntries(DIMENSIONS.map((d) => [d.id, d.name]));

export const KINDS = ['self', 'observed', 'fact', 'prediction'];
export const KIND_LABEL = { fact: 'Forever fact', observed: 'What you did', self: 'What you said', prediction: 'Still unknown' };
export const KIND_BLURB = {
  self: 'Your answers after a trial. This is the only kind that can make a class your preference.',
  observed:
    'A description of what you did in the trials. Playing well or pressing many buttons does not prove you enjoyed it, and losing does not prove you did not.',
  fact: 'What is known about the class in WoW: Forever. It describes what the class can do, not whether it suits you.',
  prediction: 'What the trials cannot tell you yet, such as a level you have not played.',
};

// The trials the analysis expects. The real TRIALS list overrides these when passed in.
export const DEFAULT_TRIALS = [
  { id: 't1', order: 1, kind: 'questing', level: 10, levels: [10, 30], title: 'Questing' },
  { id: 't2', order: 2, kind: 'danger', level: 30, levels: [30], title: 'Unexpected danger' },
  { id: 't3', order: 3, kind: 'dungeon', level: 30, levels: [30], title: 'Dungeon' },
  { id: 't4', order: 4, kind: 'pvp', level: 60, levels: [60], title: 'PvP' },
  { id: 't5', order: 5, kind: 'raid', level: 60, levels: [60], title: 'Raid' },
];

export const STATUS_NAMES = {
  'confirmed-official': 'official',
  'reported-guide': 'guide',
  'beta-observation': 'beta',
  'classic-baseline': 'Classic baseline',
  approximation: 'approximation',
  speculative: 'speculative',
};
