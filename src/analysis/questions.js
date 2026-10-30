// The fixed questions after a trial. Answers are ordinal categories, never a measurement.
// "Don't know" and skipping are missing information: not neutral and not negative.
export const FUN_QUESTION = 'How much fun was playing this class in this trial?';
export const FUN_OPTIONS = [
  { value: 1, label: 'Not fun at all' },
  { value: 2, label: 'Not much fun' },
  { value: 3, label: 'Okay' },
  { value: 4, label: 'Quite fun' },
  { value: 5, label: 'Very fun' },
];
export const FUN_UNKNOWN = "Don't know yet";

export const EFFORT_QUESTION = 'How much effort did it take to do what you wanted?';
export const EFFORT_OPTIONS = [
  { value: 1, label: 'Very little' },
  { value: 2, label: 'Little' },
  { value: 3, label: 'Some' },
  { value: 4, label: 'A lot' },
  { value: 5, label: 'Very much' },
];
export const EFFORT_UNKNOWN = "Don't know";
// From this answer on, one follow-up question may appear.
export const HIGH_EFFORT = 4;

export const OBSTACLE_QUESTION = 'What got in the way most?';
export const OBSTACLES = [
  { value: 'controls', label: 'Controls or targeting' },
  { value: 'abilities', label: 'Unfamiliar abilities' },
  { value: 'timing', label: 'Timing or resources' },
  { value: 'goal', label: 'Unclear trial goal' },
  { value: 'technical', label: 'A technical problem' },
  { value: 'other', label: 'Something else' },
  { value: 'unknown', label: "Don't know" },
];

export const COMPARE_QUESTION = 'Which would you rather play another trial with now?';
export const COMPARE_OPTIONS = [
  { value: 'a', label: null }, // first class name
  { value: 'b', label: null }, // second class name
  { value: 'both', label: 'Both equally' },
  { value: 'neither', label: 'Neither' },
  { value: 'insufficient', label: "Haven't tried enough" },
];

export const MOMENT_KINDS = [
  { value: 'fun', label: 'Fun' },
  { value: 'annoying', label: 'Annoying' },
  { value: 'notable', label: 'Just stood out' },
];

export const funLabel = (v) => (FUN_OPTIONS.find((o) => o.value === v) || {}).label || null;
export const effortLabel = (v) => (EFFORT_OPTIONS.find((o) => o.value === v) || {}).label || null;
export const obstacleLabel = (v) => (OBSTACLES.find((o) => o.value === v) || {}).label || null;
export const ROLE_LABEL = { dps: 'damage', healer: 'healing', tank: 'tanking' };
