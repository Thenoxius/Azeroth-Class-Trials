// Trial 2 — Unexpected Danger (level 30). A routine kill at a smugglers' camp turns
// into an ambush, a runner and possibly a third enemy. Tests improvisation:
// positioning, control, pet management, defensives — or a clean escape.
import { registerTemplates, getTemplate } from '../../engine/registry.js';
import { spawnPlayer, marker } from '../common.js';
import { scaled } from '../enemies.js';

registerTemplates({
  't2.captain': {
    // A named (non-elite) level-30 mob, tougher than an ordinary one.
    name: 'Captain Varek',
    portrait: 'bandit',
    side: 'enemy',
    kind: 'enemy',
    tags: ['humanoid'],
    mob: { hp: 1.6, dmg: 1.0 },
    aggroRadius: 10,
    leash: 80,
    abilities: ['npc.cripple'],
    ai: {
      type: 'melee',
      fleeAt: 0.2,
      fleeTo: { x: 53, y: 3 },
      fleeSay: 'Captain Varek bolts for the boathouse, shouting for his hexer!',
      rotation: [{ id: 'npc.cripple', when: (s, u, t) => Math.hypot(u.x - t.x, u.y - t.y) > 9 }],
    },
  },
  't2.ambusher': {
    name: 'Bloodfen Ambusher',
    portrait: 'raptor',
    side: 'enemy',
    kind: 'enemy',
    tags: ['beast'],
    mob: { hp: 0.9, dmg: 0.8, speed: 1.7 },
    speed: 8.5,
    leash: 80,
    abilities: ['npc.rend'],
    ai: { type: 'melee', rotation: [{ id: 'npc.rend' }] },
  },
  't2.hexer': {
    name: 'Smuggler Hexer',
    portrait: 'bandit-mage',
    side: 'enemy',
    kind: 'enemy',
    tags: ['humanoid', 'caster'],
    mob: { hp: 0.85, dmg: 0.5, caster: true },
    leash: 80,
    abilities: ['npc.shadowbolt', 'npc.hex.frailty'],
    ai: {
      type: 'caster',
      range: 26,
      rotation: [{ id: 'npc.hex.frailty', when: (s, u, t) => !t.auras.some((a) => a.id === 'npc.frailty') }, { id: 'npc.shadowbolt' }],
    },
  },
});

const EXIT = { x: 0, y: 17, w: 5, h: 14 };

export const TRIAL = {
  id: 't2',
  order: 2,
  title: 'Unexpected Danger',
  place: 'Greywater Watch',
  level: 30,
  levels: [30],
  kind: 'danger',
  blurb: 'A simple bounty at a lakeside camp. Simple until it is not: improvise, control, survive — or get out.',
  rolesFor: () => ['dps'],
  intro() {
    return {
      text: 'The smugglers at Greywater Watch answer to Captain Varek. The bounty board wants him dead. It is one man in a ruined watchtower — how hard can it be?',
      goals: ['Defeat Captain Varek', 'Survive whatever else turns up', 'Or, if it goes wrong: escape along the road (west edge)'],
      tips: ['Escaping counts as surviving, not as a victory.', 'Watch the banners and the combat log: they tell you what is coming.'],
    };
  },
  arena: {
    w: 56,
    h: 34,
    theme: 'ruins',
    obstacles: [
      { x: 31, y: 11, r: 1.6, kind: 'pillar' },
      { x: 37, y: 13, r: 1.4, kind: 'pillar' },
      { x: 36, y: 23, r: 1.6, kind: 'pillar' },
      { x: 24, y: 26, r: 1.3, kind: 'crate' },
      { x: 21, y: 8, r: 1.2, kind: 'crate' },
      { x: 46, y: 18, r: 2.2, kind: 'rock' },
      { x: 14, y: 29, r: 2.0, kind: 'tree' },
      { x: 12, y: 5, r: 2.2, kind: 'tree' },
    ],
    decor: [
      { kind: 'road', path: 'M0 17 Q 10 18 20 17', w: 3.4 },
      { kind: 'label', x: 3.2, y: 13.5, text: '← Road out', size: 0.9 },
      { kind: 'label', x: 34, y: 7.5, text: 'Ruined watchtower', size: 0.9 },
      { kind: 'label', x: 51, y: 2.2, text: 'Boathouse', size: 0.9 },
      { kind: 'banner', x: 53, y: 6, color: '#2d4a6b' },
    ],
  },
  hud: { party: false, meters: false, timer: true, threat: false },
  setup(state, api) {
    spawnPlayer(state, api, { x: 9, y: 17 });
    const c = api.spawnUnit(state, scaled(30, getTemplate('t2.captain')), { x: 34, y: 17, templateId: 't2.captain' });
    c.meta.boss = true;
    state.script.phase = 'calm';
    // The exit: standing in it during the fight ends the trial as an escape.
    api.spawnZone(state, {
      shape: { type: 'rect', w: EXIT.w, h: EXIT.h },
      x: EXIT.x + EXIT.w / 2,
      y: EXIT.y,
      side: 'enemy',
      affects: 'hostile',
      harmless: true,
      exit: true,
      duration: 9999,
      interval: 0,
      visual: 'nature',
      label: 'Road out',
    });
  },
  onEngage(state, api, enemy) {
    if (enemy.templateId === 't2.captain' && state.script.phase === 'calm') {
      state.script.phase = 'fight';
      state.script.engagedAt = state.t;
      marker(state, api, 'pull', 'Captain Varek');
      api.say(state, enemy, 'A bounty hunter? Lads — now!', 'yell');
    }
  },
  onTick(state, api) {
    const s = state.script;
    const p = api.player(state);
    const cap = state.list.find((u) => u.templateId === 't2.captain');
    if (s.phase === 'fight' && !s.ambushed && cap && (state.t - s.engagedAt > 8 || cap.hp / cap.maxHp < 0.6)) {
      s.ambushed = true;
      // Behind the player, away from the captain.
      const dx = p.x - cap.x;
      const dy = p.y - cap.y;
      const d = Math.hypot(dx, dy) || 1;
      const x = Math.max(2, Math.min(state.arena.w - 2, p.x + (dx / d) * 6));
      const y = Math.max(2, Math.min(state.arena.h - 2, p.y + (dy / d) * 6 + 1));
      const a = api.spawnUnit(state, scaled(30, getTemplate('t2.ambusher')), { x, y, templateId: 't2.ambusher' });
      api.engage(state, a, p);
      api.banner(state, 'Ambush!', 'A raptor bursts out of the reeds behind you.', 2.6, 'warn');
      api.say(state, a, 'The Bloodfen Ambusher shrieks!', 'emote');
      marker(state, api, 'danger', 'Ambush!');
    }
    // Escape: in the exit while something is still hunting you.
    if (p && p.alive && s.phase === 'fight' && p.x < EXIT.x + EXIT.w && Math.abs(p.y - EXIT.y) < EXIT.h / 2) {
      if (state.list.some((u) => u.side === 'enemy' && u.alive && u.engaged)) s.escaped = true;
    }
  },
  onFleeArrive(state, api, u) {
    if (u.templateId !== 't2.captain' || state.script.hexer) return;
    state.script.hexer = true;
    const h = api.spawnUnit(state, scaled(30, getTemplate('t2.hexer')), { x: u.x + 2, y: u.y + 1, templateId: 't2.hexer' });
    const p = api.player(state);
    if (p) {
      api.engage(state, h, p);
      api.engage(state, u, p);
    }
    u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.15);
    api.banner(state, 'Reinforcements!', 'Varek reached the boathouse — and his hexer.', 2.6, 'warn');
    api.say(state, h, 'You should have stayed on the road.', 'yell');
    marker(state, api, 'danger', 'Hexer joins');
  },
  onDeath(state, api, u) {
    if (u.templateId === 't2.captain' && !state.script.hexer) state.script.runnerStopped = true;
  },
  objectives(state) {
    const cap = state.list.find((u) => u.templateId === 't2.captain');
    const others = state.list.filter((u) => u.side === 'enemy' && u.templateId !== 't2.captain');
    const out = [{ text: 'Captain Varek', progress: cap && cap.alive ? `${Math.round((cap.hp / cap.maxHp) * 100)} %` : 'slain', done: cap && !cap.alive }];
    for (const o of others) out.push({ text: o.name, progress: o.alive ? `${Math.round((o.hp / o.maxHp) * 100)} %` : 'slain', done: !o.alive });
    return out;
  },
  checkOutcome(state, api) {
    const p = api.player(state);
    if (!p || !p.alive) return { result: 'defeat', reason: 'You died at Greywater Watch.' };
    if (state.script.escaped) return { result: 'escaped', reason: 'You got away along the road. The bounty can wait.' };
    if (state.script.phase === 'fight' && state.list.filter((u) => u.side === 'enemy' && !u.hidden).every((u) => !u.alive))
      return { result: 'victory', reason: 'Captain Varek and his crew are dead.' };
    return null;
  },
  summary(state) {
    const s = state.script;
    const amb = state.list.find((u) => u.templateId === 't2.ambusher');
    return [
      { label: 'Fight time', value: `${Math.round(state.t - (s.engagedAt || 0))} s` },
      { label: 'Ambusher', value: !amb ? 'Never came' : amb.alive ? 'Still alive' : 'Killed' },
      { label: 'Captain’s run', value: s.hexer ? 'Reached the boathouse (hexer joined)' : s.runnerStopped ? 'Stopped' : 'Did not run' },
      { label: 'Damage taken', value: String(Math.round(state.meters.taken[state.playerId] || 0)) },
    ];
  },
};
