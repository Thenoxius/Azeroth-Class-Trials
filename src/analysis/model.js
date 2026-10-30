// Evidence model constants for the class analysis. Plain JS (node tests import it).
// Everything the verdict depends on lives here or in evidence.js / analyze.js and is
// shown to the player on the Method screen — there is no hidden score.
import { DIMENSIONS } from '../content/facts.js';

export const CLASSES = ['hunter', 'mage', 'priest', 'warrior', 'rogue', 'shaman'];
export const CLASS_NAMES = { hunter: 'Hunter', mage: 'Mage', priest: 'Priest', warrior: 'Warrior', rogue: 'Rogue', shaman: 'Shaman' };
export const DIM_IDS = DIMENSIONS.map((d) => d.id);
export const DIM_NAMES = Object.fromEntries(DIMENSIONS.map((d) => [d.id, d.name]));

export const KINDS = ['fact', 'observed', 'self', 'prediction'];
export const KIND_LABEL = { fact: 'Fact', observed: 'Observed', self: 'You said', prediction: 'Prediction' };
export const KIND_BLURB = {
  fact: 'What is known about WoW: Forever, discounted by how solid the source is.',
  observed: 'What you actually did in the trials, compared with your own play on the other classes.',
  self: 'What you told the game after a trial (enjoyment, frustration, play again, highlight).',
  prediction: 'An extrapolation from what exists to what does not (e.g. level 30 → 60). Always uncertain.',
};

// The five trials the analysis expects. The real TRIALS list from the content
// registry overrides these entries when it is passed in; missing ones are gaps.
export const DEFAULT_TRIALS = [
  { id: 't1', order: 1, kind: 'questing', level: 10, levels: [10, 30], title: 'Questing' },
  { id: 't2', order: 2, kind: 'danger', level: 30, levels: [30], title: 'Unexpected danger' },
  { id: 't3', order: 3, kind: 'dungeon', level: 30, levels: [30], title: 'Dungeon', healerFor: ['priest'] },
  { id: 't4', order: 4, kind: 'pvp', level: 60, levels: [60], title: 'PvP' },
  { id: 't5', order: 5, kind: 'raid', level: 60, levels: [60], title: 'Raid', healerFor: ['priest'] },
];
export const KIND_NAMES = { questing: 'Questing', danger: 'Unexpected danger', dungeon: 'Dungeon', pvp: 'PvP', raid: 'Raid' };
export const GROUP_KINDS = ['dungeon', 'raid'];
export const SOLO_KINDS = ['questing', 'danger'];

// Which dimension a trial mainly informs (used for observed + self evidence).
export const KIND_PRIMARY = { questing: 'leveling', danger: 'soloIndependence', dungeon: 'dungeon', pvp: 'pvp', raid: 'raid' };

// Self-report spill-over: a rating given after a trial counts toward these
// dimensions with these multipliers (1 = full weight).
export const SELF_MAP = {
  questing: { leveling: 1, worldUtility: 0.35, soloIndependence: 0.35 },
  danger: { soloIndependence: 1, leveling: 0.6, combatDepth: 0.4 },
  dungeon: { dungeon: 1, combatDepth: 0.3 },
  pvp: { pvp: 1, combatDepth: 0.4 },
  raid: { raid: 1, longTerm: 0.5, combatDepth: 0.3 },
};
// Every enjoyment answer also touches character fantasy a little; "play again"
// also touches long-term engagement.
export const SELF_FANTASY_MULT = 0.25;
export const SELF_AGAIN_LONGTERM_MULT = 0.4;
export const SELF_WEIGHTS = { enjoyment: 1.5, frustration: 0.75, again: 1.25, moment: 0.5, none: 0.3 };
// Frustration is asymmetric: "not frustrating" is not the same as "fun".
export const FRUSTRATION_VALUE = { 1: 0.3, 2: 0.15, 3: 0, 4: -0.5, 5: -1 };
// Frustration reported right after a defeat may be about losing, not the class.
export const FRUSTRATION_AFTER_DEFEAT = 0.6;

// A highlight ("moment") pick: which systems it speaks for.
export const MOMENT_MAP = {
  pet: { combatDepth: 0.6, fantasy: 1 },
  control: { combatDepth: 1 },
  burst: { combatDepth: 0.6, fantasy: 0.4 },
  healing: { roleFlexibility: 0.6, fantasy: 0.4 },
  dot: { combatDepth: 0.8 },
  rotation: { combatDepth: 0.6, longTerm: 0.6 },
  mobility: { worldUtility: 0.6, combatDepth: 0.4 },
  utility: { worldUtility: 1 },
  defensive: { soloIndependence: 0.8, combatDepth: 0.4 },
  teamplay: { roleFlexibility: 0.4, fantasy: 0.4 },
  counterplay: { pvp: 0.8, combatDepth: 0.6 },
  resource: { combatDepth: 0.6 },
};

// Fact weighting: facts are a weak prior.
export const FACT_BASE_WEIGHT = 0.5;
export const STATUS_FACTOR = {
  'confirmed-official': 1,
  'reported-guide': 0.75,
  'beta-observation': 0.6,
  'classic-baseline': 0.4,
  approximation: 0.3,
  speculative: 0.2,
};
export const STATUS_NAMES = {
  'confirmed-official': 'official',
  'reported-guide': 'guide',
  'beta-observation': 'beta',
  'classic-baseline': 'Classic baseline',
  approximation: 'approximation',
  speculative: 'speculative',
};

// Per-cell caps on the summed weight of each kind (after which items are scaled
// down proportionally) — so twenty facts cannot outvote one honest answer.
export const KIND_CAPS = { fact: 1, observed: 3, self: 5, prediction: 0.6 };
// When you answered, behaviour may weigh at most this share of your answers.
export const OBSERVED_VS_SELF = 0.8;
// Every cell starts neutral with this imaginary weight; real evidence pulls it away.
export const NEUTRAL_PRIOR = 2;

// Visible, adjustable weights.
export const DEFAULT_WEIGHTS = { questing: 1, dungeons: 1, raids: 1, pvp: 1, convenience: 0.5, attachment: 0.25 };
export const WEIGHT_INFO = [
  { id: 'questing', label: 'Questing & exploration', min: 0, max: 3, step: 0.25 },
  { id: 'dungeons', label: 'Dungeons', min: 0, max: 3, step: 0.25 },
  { id: 'raids', label: 'Raids', min: 0, max: 3, step: 0.25 },
  { id: 'pvp', label: 'PvP & battlegrounds', min: 0, max: 3, step: 0.25 },
  { id: 'convenience', label: 'Gameplay depth ↔ convenience', min: 0, max: 1, step: 0.05, left: 'Depth', right: 'Convenience' },
  { id: 'attachment', label: 'Existing character attachment', min: 0, max: 1, step: 0.05, left: 'Ignore', right: 'Strong' },
];
export const ACTIVITY_KEYS = ['questing', 'dungeons', 'raids', 'pvp'];
export const ATTACHMENT = { cls: 'priest', label: 'your Undead Priest from the Forever beta (level cap 30)', itemWeight: 6, rowBonus: 1 };

export function normalizeWeights(w) {
  const src = { ...(w && w.activities ? w.activities : {}), ...(w || {}) };
  const out = {};
  for (const info of WEIGHT_INFO) {
    const v = typeof src[info.id] === 'number' && isFinite(src[info.id]) ? src[info.id] : DEFAULT_WEIGHTS[info.id];
    out[info.id] = Math.max(info.min, Math.min(info.max, v));
  }
  return out;
}

// How much each dimension row counts in a class total. Formulas are printed on
// the Method screen; with default weights every activity row counts 1.
export function dimWeights(weights) {
  const w = normalizeWeights(weights);
  const conv = 0.25 + 1.5 * w.convenience; // 1 at the midpoint
  const depth = 0.25 + 1.5 * (1 - w.convenience); // 1 at the midpoint
  const group = (w.dungeons + w.raids) / 2;
  const endgame = (w.dungeons + w.raids + w.pvp) / 3;
  return {
    leveling: w.questing,
    combatDepth: depth,
    dungeon: w.dungeons,
    raid: w.raids,
    pvp: w.pvp,
    worldUtility: 0.25 + 0.5 * w.questing,
    soloIndependence: (0.25 + 0.5 * w.questing) * conv,
    shortSessions: 0.75 * conv,
    longTerm: (0.5 + 0.5 * endgame) * depth,
    roleFlexibility: 0.25 + 0.5 * group,
    fantasy: 0.75 + ATTACHMENT.rowBonus * w.attachment,
  };
}

export const DIM_WEIGHT_FORMULA = {
  leveling: 'Questing',
  combatDepth: '0.25 + 1.5 × (1 − convenience)',
  dungeon: 'Dungeons',
  raid: 'Raids',
  pvp: 'PvP',
  worldUtility: '0.25 + 0.5 × Questing',
  soloIndependence: '(0.25 + 0.5 × Questing) × (0.25 + 1.5 × convenience)',
  shortSessions: '0.75 × (0.25 + 1.5 × convenience)',
  longTerm: '(0.5 + 0.5 × mean of Dungeons, Raids, PvP) × (0.25 + 1.5 × (1 − convenience))',
  roleFlexibility: '0.25 + 0.5 × mean of Dungeons, Raids',
  fantasy: '0.75 + attachment',
};

// Mechanical facts the observed rules must respect (not preferences).
export const CLASS_TRAITS = {
  shaman: { autoRepeatIsCore: false, pet: false, healer: true },
  warrior: { autoRepeatIsCore: true, pet: false, healer: false },
  rogue: { autoRepeatIsCore: true, pet: false, healer: false },
  hunter: { autoRepeatIsCore: true, pet: true, healer: false },
  mage: { autoRepeatIsCore: false, pet: false, healer: false },
  priest: { autoRepeatIsCore: false, pet: false, healer: true },
};

// The observed-behaviour rules, in plain language, for the Method screen.
export const OBSERVED_RULES = [
  {
    id: 'R1',
    name: 'Activity',
    dims: 'leveling (questing, danger), dungeon, pvp, raid',
    text: 'Share of combat time you were casting or on the global cooldown, compared with your own average on the same trial and level across classes (healer runs only against healer runs). With no other class to compare against, a fixed 60 % midpoint is used at half weight.',
  },
  {
    id: 'R2',
    name: 'Auto-attack reliance',
    dims: 'leveling',
    text: 'Share of the fight carried by wand/auto-attacks, if recorded. Not applied to Hunter, whose Auto Shot is the core of the class.',
  },
  {
    id: 'R3',
    name: 'Downtime',
    dims: 'leveling, short sessions, solo independence',
    text: 'Share of a trial spent eating and drinking, compared across classes. More downtime counts mildly against.',
  },
  {
    id: 'R4',
    name: 'Breadth',
    dims: 'combat depth',
    text: 'Number of different abilities you actually pressed, compared with your other classes on the same trial.',
  },
  {
    id: 'R5',
    name: 'Tactical buttons',
    dims: 'combat depth (+ pvp, dungeon, solo independence)',
    text: 'Control, defensive, utility, movement, interrupt and dispel uses per combat minute, compared across classes.',
  },
  {
    id: 'R6',
    name: 'Reaction to danger',
    dims: 'combat depth, solo independence',
    text: 'What you did first when an unexpected threat appeared: a tactical answer (control, defensive, movement, utility, interrupt, pet) reads positive, plain damage neutral, no answer mildly negative. Reaction time is shown but never scored.',
  },
  {
    id: 'R7',
    name: 'Pet handling',
    dims: 'combat depth, fantasy, dungeon/raid',
    text: 'Pet commands and manually used pet abilities per combat minute (Hunter only).',
  },
  {
    id: 'R8',
    name: 'Voluntary replays',
    dims: 'the trial’s own dimension, long-term',
    text: 'Playing a trial again with the same class after you already won it is the strongest behavioural signal. A retry after a loss counts only a little (it can be stubbornness).',
  },
  {
    id: 'R9',
    name: 'Leaving early',
    dims: 'the trial’s own dimension',
    text: 'Abandoning a trial counts against it, lightly — and even lighter if the fight had been paused first (probably an interruption).',
  },
  {
    id: 'R10',
    name: 'Raid attention',
    dims: 'raid, long-term',
    text: 'Activity in the first third of the raid fight vs the last third. A drop suggests the rotation lost your attention.',
  },
  { id: 'R11', name: 'Autopilot', dims: 'raid, long-term, combat depth', text: 'Share of combat where you let the autopilot cast your filler.' },
  {
    id: 'R12',
    name: 'Solo results',
    dims: 'solo independence only',
    text: 'Wins vs losses in the solo trials, smoothed so a single loss barely moves it. This is the only place results are scored, and only as capability — never as enjoyment.',
  },
  { id: 'R13', name: 'Emergency potions', dims: 'solo independence', text: 'Healing potions needed in solo trials, compared across classes.' },
  {
    id: 'R14',
    name: 'Session length',
    dims: 'short sessions',
    text: 'Real minutes (paused time excluded) one run took, compared with the other classes on the same trial.',
  },
  {
    id: 'R15',
    name: 'Interruptions',
    dims: 'short sessions',
    text: 'Runs that were paused (by you or because the tab was hidden) and still finished count slightly positive; runs abandoned after a pause slightly negative.',
  },
  { id: 'R16', name: 'Getting going', dims: 'short sessions', text: 'Seconds until your first action in a fight, if recorded, compared across classes.' },
  {
    id: 'R17',
    name: 'Level trend',
    dims: 'long-term, leveling',
    text: 'Your activity relative to the other classes at level 10, 30 and 60. Rising engagement as the kit grows counts positive.',
  },
  { id: 'R18', name: 'Extra time', dims: 'long-term', text: 'Share of all your voluntary replay minutes that went to this class.' },
  { id: 'R19', name: 'Both roles', dims: 'role flexibility', text: 'Actually playing both healer and damage in group trials (Priest).' },
  {
    id: 'R20',
    name: 'Responsibilities',
    dims: 'dungeon / raid / pvp, combat depth',
    text: 'Share of interrupt, dispel and similar responsibility windows you personally handled. Whether it succeeded is shown as performance, not scored.',
  },
  {
    id: 'R21',
    name: 'Utility while questing',
    dims: 'world exploration & utility',
    text: 'Optional-utility abilities used per minute while questing, compared across classes.',
  },
];
