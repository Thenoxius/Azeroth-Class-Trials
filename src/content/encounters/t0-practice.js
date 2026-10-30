// The practice yard: a short, skippable first go with the controls and one mechanic of the
// class. A dummy that never fights back. It is not in TRIALS and never reaches the evidence.
import { registerTemplates, getAbility } from '../../engine/registry.js';
import { spawnPlayer, freshEvents } from '../common.js';
import { CLASS_INTRO } from '../class-intro.js';

const START = { x: 12, y: 13 };

registerTemplates({
  't0.dummy': {
    name: 'Practice Dummy',
    portrait: 'generic',
    side: 'enemy',
    kind: 'enemy',
    level: 30,
    radius: 1.2,
    maxHp: 10_000_000,
    armor: 0,
    speed: 0,
    melee: null,
    ai: { type: 'idle' },
    immune: { stun: true, incap: true, fear: true, root: true, slow: true, cc: true },
    flags: { noEvade: true, noLeash: true },
  },
});

export const TRIAL = {
  id: 't0',
  order: 0,
  title: 'Practice Yard',
  place: 'A quiet yard behind the barracks',
  level: 30,
  levels: [30],
  kind: 'practice',
  practice: true,
  blurb: 'Try the controls on a dummy that never fights back. This does not count towards your comparison.',
  rolesFor: () => ['dps'],
  intro(classId) {
    return {
      text: 'A dummy that never fights back. Work through the steps on the right, or leave whenever you like. Nothing here counts towards your comparison.',
      goals: ['Target the dummy', 'Use an ability', (CLASS_INTRO[classId] || {}).practice?.text, 'Move around'].filter(Boolean),
      tips: ['Space pauses the game at any time.'],
    };
  },
  arena: { w: 42, h: 26, theme: 'ruins', obstacles: [], decor: [] },
  hud: { party: false, meters: false, timer: false, threat: false },
  setup(state, api) {
    spawnPlayer(state, api, START);
    state.script.dummy = api.spawnUnit(state, 't0.dummy', { x: 24, y: 13 });
    state.script.done = {};
    api.banner(state, 'Practice Yard', 'This does not count towards your comparison.', 3, 'info');
  },
  onTick(state, api) {
    const s = state.script;
    const p = api.player(state);
    if (!p) return;
    const practice = (CLASS_INTRO[p.classId] || {}).practice;
    if (p.target === s.dummy.id) s.done.target = true;
    if (Math.hypot(p.x - START.x, p.y - START.y) > 4) s.done.move = true;
    for (const e of freshEvents(state)) {
      if (e.src !== p.id && !(e.type === 'damage' && e.src === p.petId)) continue;
      const ab = e.ability ? getAbility(e.ability) : null;
      if (e.type === 'cast' || (e.type === 'damage' && e.src === p.id)) s.done.ability = true;
      if (practice && practice.done(e, ab)) s.done.mechanic = true;
    }
  },
  objectives(state) {
    const s = state.script;
    const p = state.units[state.playerId];
    const practice = p && (CLASS_INTRO[p.classId] || {}).practice;
    return [
      { text: 'Click the dummy to target it (or press Tab)', done: !!s.done?.target },
      { text: 'Use an ability: press 1, or click a button at the bottom', done: !!s.done?.ability },
      ...(practice ? [{ text: practice.text, done: !!s.done?.mechanic }] : []),
      { text: 'Move with W, A, S, D, or click the ground', done: !!s.done?.move },
    ];
  },
  checkOutcome(state) {
    const s = state.script;
    if (s.done && s.done.target && s.done.ability && s.done.mechanic && s.done.move)
      return { result: 'victory', reason: 'Practice done. On to the first trial.' };
    return null;
  },
  summary: () => [],
};
