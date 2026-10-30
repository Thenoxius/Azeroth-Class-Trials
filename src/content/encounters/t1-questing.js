// Trial 1 — The Long Road (questing). Level 10, replayable at level 30.
// Ordinary questing pace: pull → fight → downtime → next pull, at your own pace.
// The level-30 road adds a runner who fetches help and hexes/diseases a utility kit can answer.
import { registerTemplates, getTemplate } from '../../engine/registry.js';
import { spawnPlayer, standardOutcome, marker, DOWNTIME_COMPRESSION } from '../common.js';
import { scaled } from '../enemies.js';

const Q = { tags: ['humanoid'], side: 'enemy', kind: 'enemy', aggroRadius: 9, leash: 70 };

registerTemplates({
  't1.wolf': { ...Q, name: 'Mangy Wolf', portrait: 'wolf', tags: ['beast'], mob: { hp: 0.9, dmg: 0.9 }, ai: { type: 'melee' } },
  't1.brute': { ...Q, name: 'Hollowfang Brute', portrait: 'gnoll-brute', mob: { hp: 1.2, dmg: 1.1, speed: 2.3 }, ai: { type: 'melee' } },
  't1.scout': { ...Q, name: 'Hollowfang Scout', portrait: 'gnoll', mob: { hp: 0.9, dmg: 0.9 }, ai: { type: 'melee' } },
  't1.geomancer': {
    ...Q,
    name: 'Kobold Geomancer',
    portrait: 'kobold-geomancer',
    mob: { hp: 0.85, dmg: 0.5, caster: true },
    tags: ['humanoid', 'caster'],
    abilities: ['npc.firebolt'],
    ai: { type: 'caster', range: 26, rotation: [{ id: 'npc.firebolt' }] },
  },
  't1.packleader': {
    // A named quest mob, not an elite: a real level-30 elite (2.6× health, 3× damage) is group content.
    ...Q,
    name: 'Packleader Grishk',
    portrait: 'gnoll-brute',
    mob: { hp: 1.6, dmg: 1.15 },
    abilities: ['npc.enrage', 'npc.rend'],
    ai: {
      type: 'melee',
      rotation: [{ id: 'npc.enrage', target: 'self', when: (s, u) => u.hp / u.maxHp < 0.3, say: 'Grishk not die to soft-skin!' }, { id: 'npc.rend' }],
    },
  },
  't1.poacher': {
    ...Q,
    name: 'Hollowfang Poacher',
    portrait: 'gnoll',
    mob: { hp: 0.95, dmg: 0.9 },
    ai: { type: 'melee', fleeAt: 0.2, fleeTo: { x: 60, y: 39 }, fleeSay: 'The Poacher runs for the woods, howling for help!' },
  },
  't1.friend': { ...Q, name: 'Hollowfang Brute', portrait: 'gnoll-brute', mob: { hp: 1.2, dmg: 1.1, speed: 2.3 }, ai: { type: 'melee' } },
});

const PULLS = [
  { tpl: 't1.wolf', x: 17, y: 11, label: 'Wolf' },
  { tpl: 't1.brute', x: 27, y: 31, label: 'Brute' },
  { tpl: 't1.scout', x: 43, y: 10, group: 'pair', label: 'Scout pair' },
  { tpl: 't1.wolf', x: 45, y: 7, group: 'pair' },
  { tpl: 't1.geomancer', x: 60, y: 28, label: 'Geomancer' },
  { tpl: 't1.packleader', x: 75, y: 18, label: 'Packleader' },
];
const PULLS_30 = [{ tpl: 't1.poacher', x: 42, y: 34, label: 'Poacher' }];

// Level-30 extras: the geomancer hexes, the packleader's bite festers.
const L30_ABILITIES = {
  't1.geomancer': {
    abilities: ['npc.firebolt', 'npc.earthbind'],
    ai: {
      type: 'caster',
      range: 26,
      rotation: [{ id: 'npc.earthbind', when: (s, u, t) => !t.auras.some((a) => a.id === 'npc.earthbind') }, { id: 'npc.firebolt' }],
    },
  },
  't1.packleader': {
    abilities: ['npc.enrage', 'npc.bite.disease', 'npc.rend'],
    ai: {
      type: 'melee',
      rotation: [
        { id: 'npc.enrage', target: 'self', when: (s, u) => u.hp / u.maxHp < 0.3, say: 'Grishk not die to soft-skin!' },
        { id: 'npc.bite.disease' },
        { id: 'npc.rend' },
      ],
    },
  },
};

function quest(state) {
  return state.list.filter((u) => u.side === 'enemy' && u.meta.quest);
}

export const TRIAL = {
  id: 't1',
  order: 1,
  title: 'The Long Road',
  place: 'Fenwick Hollow',
  level: 10,
  levels: [10, 30],
  kind: 'questing',
  blurb: 'Clear a gnoll-infested road at your own pace. Pull, fight, rest, repeat — and feel how full your bar is.',
  rolesFor: () => ['dps'],
  intro(classId, level) {
    return {
      text:
        level >= 30
          ? 'The Hollowfang gnolls are back on the Fenwick road — stronger now, with a poacher who runs for help and a packleader whose bite festers. You have done this a hundred times. Clear the road.'
          : 'The Fenwick farmers are cut off by Hollowfang gnolls and the wolves that run with them. Walk the road, take each group when you are ready, and rest when you need to.',
      goals: ['Defeat every Hollowfang raider on the road', 'Pull at your own pace — nothing attacks until you get close'],
      tips: [
        'Eating & drinking is time-compressed ×' + DOWNTIME_COMPRESSION + ' — the tracker shows the real-game equivalent.',
        'Casters behind trees can be pulled around them: line of sight matters.',
        level >= 30
          ? 'A gnoll at low health may run for help. Slows, roots and stuns stop runners.'
          : 'Low mana or health simply makes the next pull riskier. Your call.',
      ],
    };
  },
  arena: {
    w: 84,
    h: 40,
    theme: 'forest',
    obstacles: [
      { x: 13, y: 4, r: 2.4, kind: 'tree' },
      { x: 24, y: 16, r: 1.6, kind: 'rock' },
      { x: 35, y: 4, r: 2.2, kind: 'tree' },
      { x: 33, y: 36, r: 2.0, kind: 'tree' },
      { x: 56, y: 25, r: 2.3, kind: 'tree' },
      { x: 52, y: 35, r: 1.5, kind: 'rock' },
      { x: 66, y: 8, r: 2.5, kind: 'tree' },
      { x: 80, y: 30, r: 2.2, kind: 'tree' },
      { x: 8, y: 34, r: 2.4, kind: 'tree' },
    ],
    decor: [
      { kind: 'road', path: 'M0 21 Q 21 17 35 21 T 63 20 T 84 19', w: 3.6 },
      { kind: 'banner', x: 78, y: 13, color: '#7a3b1d' },
      { kind: 'banner', x: 71, y: 24, color: '#7a3b1d' },
      { kind: 'label', x: 77, y: 10.5, text: 'Hollowfang camp', size: 1 },
      { kind: 'label', x: 6, y: 17.5, text: 'Fenwick road', size: 0.9 },
    ],
  },
  hud: { party: false, meters: false, timer: true, threat: false },
  setup(state, api) {
    const L = state.opts.level >= 30 ? 30 : 10;
    spawnPlayer(state, api, { x: 4, y: 21 });
    const pulls = L >= 30 ? [...PULLS, ...PULLS_30] : PULLS;
    for (const p of pulls) {
      const tpl = { ...registryTpl(p.tpl), ...(L >= 30 ? L30_ABILITIES[p.tpl] || {} : {}) };
      const u = api.spawnUnit(state, scaled(L, tpl), { x: p.x, y: p.y, group: p.group || null, templateId: p.tpl });
      u.meta.quest = true;
      u.meta.pull = p.label || null;
    }
    state.script.restTime = 0;
    state.script.rests = 0;
    state.script.pulls = 0;
  },
  onEngage(state, api, enemy) {
    if (enemy.meta.pull) {
      state.script.pulls++;
      marker(state, api, 'pull', enemy.meta.pull);
    }
  },
  onFleeArrive(state, api, u) {
    if (u.templateId !== 't1.poacher' || state.script.reinforced) return;
    state.script.reinforced = true;
    const L = state.opts.level >= 30 ? 30 : 10;
    const f = api.spawnUnit(state, scaled(L, registryTpl('t1.friend')), { x: u.x + 1.5, y: u.y - 1, templateId: 't1.friend' });
    f.meta.quest = true;
    const p = api.player(state);
    if (p) {
      api.engage(state, f, p);
      api.engage(state, u, p);
    }
    u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.25);
    api.banner(state, 'Reinforcements!', 'The poacher came back with a friend.', 2.5, 'warn');
    marker(state, api, 'danger', 'Runner brought help');
  },
  onTick(state, api, dt) {
    const p = api.player(state);
    const resting = !!(p && p.casting && p.casting.id === 'item.rest');
    if (resting) state.script.restTime += dt;
    if (resting && !state.script.wasResting) state.script.rests++;
    state.script.wasResting = resting;
  },
  onDeath(state, api, u) {
    if (u.meta.quest && u.templateId === 't1.poacher' && !state.script.reinforced) state.script.runnerStopped = true;
  },
  objectives(state) {
    const all = quest(state);
    const dead = all.filter((u) => !u.alive).length;
    const out = [{ text: 'Hollowfang raiders slain', progress: `${dead}/${all.length}`, done: dead >= all.length }];
    out.push({
      text: 'Time resting',
      progress: `${Math.round(state.script.restTime || 0)} s (≈${Math.round((state.script.restTime || 0) * DOWNTIME_COMPRESSION)} s in-game)`,
      done: false,
      info: true,
    });
    return out;
  },
  checkOutcome(state, api) {
    const p = api.player(state);
    if (!p || !p.alive) return { result: 'defeat', reason: 'You died on the road.' };
    if (quest(state).every((u) => !u.alive)) return { result: 'victory', reason: 'The road to Fenwick Hollow is clear.' };
    return null;
  },
  summary(state) {
    const p = state.units[state.playerId];
    const rest = state.script.restTime || 0;
    const lines = [
      { label: 'Quest time', value: fmt(state.t) },
      { label: 'Time resting', value: `${fmt(rest)} (≈${fmt(rest * DOWNTIME_COMPRESSION)} in the real game)` },
      { label: 'Rests', value: String(state.script.rests || 0) },
      { label: 'Damage taken', value: String(Math.round(state.meters.taken[state.playerId] || 0)) },
    ];
    if (state.opts.level >= 30) lines.push({ label: 'Runner', value: state.script.reinforced ? 'Got away and brought help' : 'Stopped' });
    if (p && p.petId) lines.push({ label: 'Pet', value: state.units[p.petId] && state.units[p.petId].alive ? 'Alive' : 'Died' });
    return lines;
  },
};

function registryTpl(id) {
  return { ...getTemplate(id) };
}
function fmt(s) {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m ? `${m}:${String(r).padStart(2, '0')}` : `${r} s`;
}
