// Trial 5 — The Ember Tyrant (raid, level 60). An abstract 20-person raid shown as
// 13 NPC raiders plus you. About three and a half minutes of the same boss — this is
// where "do I still enjoy my rotation the fortieth time?" gets measured.
// Class duties: Hunter Tranquilizing Shot, Mage decurse, Priest dispel / tank healing.
import { registerAbilities, registerTemplates, registerBehavior } from '../../engine/registry.js';
import * as G from '../../engine/geometry.js';
import { spawnPlayer, marker, openWindow, resolveWindow, windowStats, freshEvents } from '../common.js';
import { spawnClassMember } from '../party.js';
import { buffsFromClasses } from '../stats.js';
import { escapeZones, tryRotation } from '../../engine/ai.js';

const APPROX = { status: 'approximation', note: 'Original raid boss ability for this trial.' };
// Sized for this 14-player raid of real level-60 classes: about four minutes of their damage.
const BOSS_HP = 340000;

registerAbilities({
  't5.cleave': {
    name: 'Molten Cleave', icon: 'axe', school: 'fire', mechanic: 'physical', category: 'damage', target: 'none', cooldown: 8, fx: 'none',
    desc: 'Fire-wreathed cleave at everyone in front of him.', forever: APPROX,
    onCast: ({ state, u, api }) => { const t = api.U(state, u.target); if (t) u.facing = api.G.angleTo(u, t); },
    effects: [{ type: 'damage', amount: [1500, 1750], kind: 'melee', school: 'physical', aoe: { center: 'self', radius: 9, cone: Math.PI * 0.5, affects: 'enemies' } }],
  },
  't5.breath': {
    name: 'Flame Breath', icon: 'flame', school: 'fire', category: 'damage', target: 'none', cooldown: 9, fx: 'none',
    desc: 'A core hound breathes fire in a cone.', forever: APPROX,
    onCast: ({ state, u, api }) => { const t = api.U(state, u.target); if (t) u.facing = api.G.angleTo(u, t); },
    effects: [{ type: 'damage', amount: [700, 850], school: 'fire', aoe: { center: 'self', radius: 8, cone: Math.PI * 0.45, affects: 'enemies' } }],
  },
  't5.firebolt': {
    name: 'Ember Bolt', icon: 'fireball', school: 'fire', category: 'damage', castTime: 2.5, range: 35, projectile: { speed: 24 },
    desc: 'An imp’s fire bolt. Interruptible.', forever: APPROX, effects: [{ type: 'damage', amount: [120, 145] }],
  },
});

// Adds are level 61, the boss 63 like real raid bosses ("??" to a level-60 player). Armor and
// fire resistance are the real Molten Core values (cmangos classic-db): bosses 4691 armor, Core
// Hounds 4091, fire resistance 93.
const E = { side: 'enemy', level: 61, tags: ['demon'], leash: 999, flags: { noLeash: true } };
registerTemplates({
  't5.tyrant': {
    ...E, level: 63, name: 'Vorgrath the Ember Tyrant', portrait: 'ember-tyrant', kind: 'boss', radius: 1.8, maxHp: BOSS_HP, armor: 4691, resist: { fire: 93 },
    melee: { min: 1000, max: 1150, speed: 2.0 }, immune: { stun: true, incap: true, fear: true, root: true, slow: true, cc: true }, abilities: ['t5.cleave'],
    ai: { type: 'melee', rotation: [{ id: 't5.cleave' }] }, flags: { noLeash: true, noEvade: true },
  },
  't5.imp': {
    ...E, name: 'Ember Imp', portrait: 'ember-imp', kind: 'enemy', radius: 0.6, maxHp: 5500, armor: 3316, resist: { fire: 93 }, tags: ['demon', 'caster'],
    melee: { min: 150, max: 200, speed: 2.0 }, abilities: ['t5.firebolt'], ai: { type: 'caster', range: 30, rotation: [{ id: 't5.firebolt', target: 'randomEnemy' }] },
  },
  't5.hound': {
    ...E, name: 'Core Hound', portrait: 'core-hound', kind: 'enemy', radius: 1.1, maxHp: 16000, armor: 4091, resist: { fire: 93 }, tags: ['beast'],
    melee: { min: 420, max: 500, speed: 2.0 }, abilities: ['t5.breath'], ai: { type: 'melee', rotation: [{ id: 't5.breath' }] },
  },
});

// Off-tank: picks up adds (never the boss), otherwise hits the boss without taunting.
registerBehavior('offtank', (state, u, api) => {
  if (escapeZones(state, u)) return;
  const boss = state.script.boss;
  const adds = api.enemiesOf(state, u, (e) => e.engaged && e !== boss && !e.tags.includes('caster'));
  let t = adds.find((e) => e.target !== u.id) || adds[0] || boss;
  if (t && t !== boss && t.target !== u.id && api.canCast(state, u, 'warrior.taunt', { targetId: t.id, noAuto: true }).ok) api.startCast(state, u, 'warrior.taunt', { targetId: t.id, noAuto: true });
  if (!t || !t.alive) return;
  u.target = t.id;
  // On the boss the off-tank only adds damage and Sunders; on an add it tanks with its full rotation.
  if (!u.casting) tryRotation(state, u, t, t === boss ? u.ai.rotation.filter((r) => r.id !== 'warrior.thunderclap' && r.id !== 'warrior.demoshout') : u.ai.rotation);
  const spot = t === boss ? G.behind({ x: boss.x + 4, y: boss.y }, boss, boss.radius + 1.5) : t;
  if (G.dist(u, spot) > (t === boss ? 1.5 : (t.radius || 0.8) + 1.6)) u.move.to = t === boss ? spot : G.towards(t, u, (t.radius || 0.8) + 1.2);
  else u.move.to = null;
});

// The raid: real level-60 classes (src/content/party.js). Positions: tank east of the boss
// (cleave faces away), melee behind, ranged arc west. Warlocks split the curses: Recklessness
// (armor) and the Elements (magic damage).
function roster(playerRole, playerClass) {
  const list = [
    { cls: 'warrior', role: 'tank', race: 'orc', o: { name: 'Gorrak', portrait: 'orc-warrior' }, at: { x: 50, y: 22 } },
    { cls: 'warrior', role: 'offtank', race: 'tauren', o: { name: 'Haro', portrait: 'tauren-warrior' }, at: { x: 47, y: 18 } },
    { cls: 'rogue', role: 'dps', race: 'troll', o: { name: 'Zaj’ka', portrait: 'troll-rogue' }, at: { x: 40, y: 20 } },
    { cls: 'rogue', role: 'dps', race: 'troll', o: { name: 'Vex', portrait: 'troll-rogue' }, at: { x: 40, y: 24 } },
    { cls: 'rogue', role: 'dps', race: 'orc', o: { name: 'Brakka', portrait: 'orc-rogue' }, at: { x: 39, y: 22 } },
    { cls: 'mage', role: 'dps', spec: 'frost', race: 'troll', o: { name: 'Ilyra', portrait: 'troll-mage', spot: { x: 24, y: 14 } }, at: { x: 24, y: 14 } },
    { cls: 'warlock', role: 'dps', race: 'undead', o: { name: 'Mordessa', portrait: 'undead-warlock', spot: { x: 22, y: 22 }, curse: 'cor' }, at: { x: 22, y: 22 } },
    { cls: 'hunter', role: 'dps', spec: 'mm', race: 'tauren', o: { name: 'Tak', portrait: 'tauren-hunter', spot: { x: 24, y: 30 } }, at: { x: 24, y: 30 } },
    { cls: 'warlock', role: 'dps', race: 'undead', o: { name: 'Sethis', portrait: 'undead-warlock', spot: { x: 27, y: 18 }, curse: 'coe' }, at: { x: 27, y: 18 } },
    { cls: 'shaman', role: 'healer', race: 'orc', o: { name: 'Thalga', portrait: 'orc-shaman', spot: { x: 30, y: 26 } }, at: { x: 30, y: 26 } },
    { cls: 'priest', role: 'healer', spec: 'holy', race: 'troll', o: { name: 'Nuro', portrait: 'troll-priest', spot: { x: 31, y: 16 } }, at: { x: 31, y: 16 } },
    { cls: 'shaman', role: 'healer', race: 'orc', o: { name: 'Kesh', portrait: 'orc-shaman', spot: { x: 28, y: 34 } }, at: { x: 28, y: 34 } },
  ];
  // Avoid two of "you": the NPC of your class steps out.
  const mine = { mage: 'mage', hunter: 'hunter' }[playerClass];
  if (mine) {
    const i = list.findIndex((x) => x.cls === mine);
    if (i >= 0) list[i] = { cls: 'warlock', role: 'dps', race: 'undead', o: { name: 'Ravel', portrait: 'undead-warlock', spot: list[i].o.spot }, at: list[i].at };
  }
  if (playerRole === 'tank') list.splice(0, 1);
  return list;
}

const raidBuffs = (opts) => buffsFromClasses([...roster(opts.role, opts.classId).map((r) => r.cls), opts.classId]);

function spawnRaider(state, api, r) {
  const u = spawnClassMember(state, api, {
    classId: r.cls, role: r.role === 'offtank' ? 'tank' : r.role, spec: r.spec, race: r.race, ...r.o,
    // Raid veterans: better at stepping out of fire than the dungeon party.
    skill: 0.85, range: 30, groupBuffs: raidBuffs(state.opts),
  }, { ...r.at, level: 60 });
  if (r.role === 'offtank') u.ai.type = 'offtank';
  if (r.role === 'tank') u.ai.noPickup = true;
  if (r.role === 'healer') u.ai.tankBias = 0.6;
  return u;
}

const raiders = (state) => state.list.filter((u) => u.alive && u.side === 'player' && (u.kind === 'ally' || u.kind === 'player'));

function dutyFor(state) {
  const { classId, role } = state.opts;
  if (classId === 'hunter') return 'tranq';
  if (classId === 'mage') return 'decurse';
  if (classId === 'priest') return role === 'healer' ? 'heal' : 'dispel';
  return null;
}

export const TRIAL = {
  id: 't5',
  order: 5,
  title: 'The Ember Tyrant',
  place: 'The Molten Throne',
  level: 60,
  levels: [60],
  kind: 'raid',
  blurb: 'A 20-person raid boss in miniature: three phases, class duties, and three and a half minutes of your rotation.',
  rolesFor: (classId) => (classId === 'priest' ? ['dps', 'healer'] : classId === 'warrior' ? ['dps', 'tank'] : ['dps']),
  // Buffs from the raid's classes: Priest (Fortitude, Divine Spirit), Mage (Arcane Intellect),
  // Hunter (Trueshot Aura), Warrior (Battle Shout) and Shaman totems (Mana Spring, Strength of
  // Earth, Grace of Air) — several are raid-wide in Forever.
  groupBuffs: raidBuffs,
  intro(classId, level, role) {
    const duty = classId === 'hunter' ? 'Tranquilizing Shot his Frenzy (the tank cannot survive it for long).'
      : classId === 'mage' ? 'Remove Curse of Ash from raiders (Remove Lesser Curse) before it burns them down.'
        : role === 'healer' ? 'You are on the main tank. Keep Gorrak alive, help the raid through Ember Volley — and make your mana last.'
          : classId === 'priest' ? 'Dispel Searing Shackles (Magic) from raiders.' : role === 'tank' ? 'Tank Vorgrath facing away from the raid; build threat and use defensive cooldowns.' : 'Attack from behind, control your threat and help kill the adds.';
    return {
      text: 'Vorgrath the Ember Tyrant rules the Molten Throne. Twelve raiders stand with you. The fight lasts minutes, not seconds: phase one is his fire, phase two his imps and hounds, phase three a burn while he frenzies. Your damage (or healing) matters — but nobody expects you to carry it alone.',
      goals: ['Defeat Vorgrath', 'Your duty: ' + duty, 'Stay out of Magma Pools'],
      tips: [
        'The Filler autopilot button casts your filler whenever you are idle. It is never required — use it if you like.',
        'Raiders handle duties too, just slower. A missed duty costs time or a death, not an instant wipe.',
        'Too much AoE on the imps pulls them onto you.',
      ],
    };
  },
  arena: {
    w: 70, h: 44, theme: 'molten',
    obstacles: [
      { x: 8, y: 6, r: 3, kind: 'lava', los: false }, { x: 64, y: 6, r: 3.2, kind: 'lava', los: false }, { x: 64, y: 38, r: 3.2, kind: 'lava', los: false },
      { x: 8, y: 38, r: 3, kind: 'lava', los: false }, { x: 36, y: 4, r: 2.4, kind: 'lava', los: false }, { x: 36, y: 40, r: 2.4, kind: 'lava', los: false },
    ],
    decor: [
      { kind: 'lavaCrack', path: 'M2 22 Q 12 18 20 24 T 34 21', w: 0.4 }, { kind: 'lavaCrack', path: 'M70 14 Q 60 20 56 16', w: 0.35 },
      { kind: 'rune', x: 45, y: 22, r: 7, color: '#ff6a1f' }, { kind: 'label', x: 45, y: 13, text: 'The Molten Throne', size: 1 },
    ],
  },
  hud: { party: true, raid: true, meters: true, timer: true, threat: true },
  setup(state, api) {
    const healer = state.opts.role === 'healer';
    spawnPlayer(state, api, { x: healer ? 29 : 27, y: healer ? 21 : 26 });
    for (const r of roster(state.opts.role, state.opts.classId)) {
      const u = spawnRaider(state, api, r);
      // With you healing, the NPC healers ease off: your heals matter, but no single healer decides the fight.
      if (healer && r.role === 'healer') api.applyAura(state, u, u, { id: 't5.share', name: 'Shared duty', hidden: true, permanent: true, mods: { healDone: 0.7 } });
    }
    const boss = api.spawnUnit(state, 't5.tyrant', { x: 45, y: 22 });
    state.script.boss = boss;
    state.script.noPull = true;
    state.script.tankSpot = { x: 49.5, y: 22 };
    state.script.focusId = boss.id;
    state.script.phase = 'pull';
    state.script.pullAt = 3;
    state.script.duty = dutyFor(state);
    state.script.dutyLog = { done: 0, total: 0 };
    api.banner(state, 'Raid: pulling in 3', 'Gorrak tanks. Stand behind or to the side of the boss.', 2.6, 'info');
  },
  onTick(state, api, dt) {
    const s = state.script;
    const boss = s.boss;
    const p = api.player(state);
    const ev = freshEvents(state);
    const tank = state.opts.role === 'tank' ? p : state.list.find((u) => u.role === 'tank' && u.ai && u.ai.type === 'tank' && u.side === 'player');
    for (const e of ev) {
      // Duty resolution.
      if (e.type === 'dispel' || e.type === 'dispelMiss') {
        for (const w of Object.values(s.windows || {})) {
          if (!w.open) continue;
          if (e.type === 'dispel' && w.kind === 'dispel' && w.holder === e.dst && w.aura === e.aura) resolveWindow(state, api, w.id, true, e.src);
          if (e.type === 'dispel' && w.kind === 'tranq' && e.dst === boss.id && e.aura === 't5.frenzy') resolveWindow(state, api, w.id, true, e.src);
        }
      }
      if (e.type === 'auraFade' && (e.aura === 't5.curse' || e.aura === 't5.shackles' || e.aura === 't5.frenzy') && e.reason === 'expired') {
        for (const w of Object.values(s.windows || {})) if (w.open && w.aura === e.aura && (w.holder === e.dst || w.kind === 'tranq')) resolveWindow(state, api, w.id, false, null);
      }
    }
    if (s.phase === 'pull' && state.t >= s.pullAt) {
      s.phase = 'p1';
      s.fightStart = state.t;
      api.engage(state, boss, tank, false);
      api.addThreat(state, boss, tank, 4000);
      for (const r of raiders(state)) if (r.kind === 'ally') api.engage(state, boss, r, false);
      api.say(state, boss, 'You dare climb to my throne? Burn!', 'yell');
      marker(state, api, 'pull', 'Vorgrath');
      s.next = { volley: state.t + 14, pools: state.t + 8, frenzy: state.t + 25, curse: state.t + 16, shackles: state.t + 20, wave: 0 };
    }
    if (!s.fightStart || !boss.alive) return;
    const hp = boss.hp / boss.maxHp;
    if (s.phase === 'p1' && hp < 0.6) {
      s.phase = 'p2';
      s.next.wave = state.t + 2;
      api.banner(state, 'Phase 2', 'Imps and Core Hounds pour from the lava.', 2.6, 'warn');
      api.say(state, boss, 'Children of flame — feed!', 'yell');
      marker(state, api, 'phase', 'Phase 2');
    }
    if (s.phase === 'p2' && hp < 0.25) {
      s.phase = 'p3';
      api.banner(state, 'Phase 3 — burn!', 'He frenzies more often. Use your cooldowns.', 2.6, 'warn');
      api.say(state, boss, 'ENOUGH! I will melt this mountain!', 'yell');
      marker(state, api, 'phase', 'Phase 3');
    }
    const n = s.next;
    const raid = raiders(state);
    const pick = (k, filter) => [...raid.filter(filter || (() => true))].sort(() => state.rng() - 0.5).slice(0, k);
    // Ember Volley: raid-wide fire.
    if (state.t >= n.volley) {
      n.volley = state.t + (s.phase === 'p3' ? 12 : 20);
      for (const r of raid) api.dealDamage(state, boss, r, { amount: 130 + 30 * state.rng(), school: 'fire', kind: 'spell', ability: 't5.volley', noMiss: true });
      api.say(state, boss, 'Vorgrath unleashes an Ember Volley!', 'emote');
    }
    // Magma Pools under three raiders.
    if (state.t >= n.pools) {
      n.pools = state.t + 12;
      for (const v of pick(2, (r) => r.role !== 'tank')) {
        const z = api.spawnZone(state, { shape: { type: 'circle', r: 4 }, x: v.x, y: v.y, owner: boss.id, side: boss.side, telegraph: 2, duration: 8, interval: 1, visual: 'fire', label: 'Magma Pool', school: 'fire', abilityId: 't5.pool', effects: [{ type: 'damage', amount: [260, 300], school: 'fire' }] });
        if (v.id === state.playerId) openWindow(state, api, 'move', 'pool' + z.id, 'Step out of the Magma Pool', { zone: z.id });
      }
    }
    for (const w of Object.values(s.windows || {})) {
      if (!w.open || w.kind !== 'move') continue;
      const z = state.zones.find((x) => x.id === w.zone);
      if (!z || !p) { resolveWindow(state, api, w.id, true, state.playerId); continue; }
      if (z.armed && state.t - z.armAt > 0.6) resolveWindow(state, api, w.id, !G.pointInZone(z, p), state.playerId);
    }
    // Frenzy (Hunter duty: Tranquilizing Shot).
    if (state.t >= n.frenzy) {
      n.frenzy = state.t + (s.phase === 'p3' ? 15 : 30);
      api.applyAura(state, boss, boss, { id: 't5.frenzy', name: 'Frenzy', icon: 'beast-wrath', school: 'fire', duration: 10, dispel: 'enrage', mods: { meleeHaste: 0.5, dmgDone: { melee: 1.25 } } });
      api.say(state, boss, 'Vorgrath goes into a frenzy!', 'emote');
      if (s.duty === 'tranq') openWindow(state, api, 'tranq', 'frenzy' + state.t.toFixed(1), 'Tranquilize the Frenzy', { aura: 't5.frenzy' });
      s.frenzyAt = state.t;
    }
    // Raid fallback: an NPC hunter tranquilizes after a while (slower than a player on it).
    if (boss.auras.some((a) => a.id === 't5.frenzy') && state.t - s.frenzyAt > (s.duty === 'tranq' ? 6 : 3.5)) {
      const npcHunter = raid.find((r) => r.classId === 'hunter' && r.kind === 'ally');
      if (npcHunter || s.duty !== 'tranq') { api.dispelUnit(state, npcHunter || null, boss, ['enrage'], 1, 'buff', 'hunter.tranq'); }
    }
    // Curse of Ash (Mage duty) and Searing Shackles (Priest duty).
    if (state.t >= n.curse) {
      n.curse = state.t + 18;
      for (const v of pick(2, (r) => r.role !== 'tank')) {
        api.applyAura(state, boss, v, { id: 't5.curse', name: 'Curse of Ash', icon: 'skull', school: 'fire', debuff: true, duration: 12, dispel: 'curse', tick: { interval: 2, amount: 100, school: 'fire' } });
        s.dutyLog.curse = (s.dutyLog.curse || 0) + 1;
        if (s.duty === 'decurse') openWindow(state, api, 'dispel', 'curse' + v.id + state.t.toFixed(1), 'Curse of Ash', { holder: v.id, aura: 't5.curse', at: state.t });
      }
    }
    if (state.t >= n.shackles) {
      n.shackles = state.t + 20;
      for (const v of pick(2, (r) => r.role !== 'tank')) {
        api.applyAura(state, boss, v, { id: 't5.shackles', name: 'Searing Shackles', icon: 'shield', school: 'fire', debuff: true, duration: 12, dispel: 'magic', mods: { slow: 0.5 }, tick: { interval: 2, amount: 90, school: 'fire' } });
        if (s.duty === 'dispel' || s.duty === 'heal') openWindow(state, api, 'dispel', 'shackles' + v.id + state.t.toFixed(1), 'Searing Shackles', { holder: v.id, aura: 't5.shackles', at: state.t });
      }
    }
    // NPC fallback for curses and shackles: removed after ~6 s by a raider.
    for (const r of raid) {
      for (const a of [...r.auras]) {
        if ((a.id === 't5.curse' || a.id === 't5.shackles') && state.t - a.appliedAt > 6 && state.rng() < 0.08) {
          const helper = raid.find((x) => x.kind === 'ally' && x.role === 'healer');
          api.dispelUnit(state, helper || null, r, [a.def.dispel], 1, 'debuff', 'npc.cleanse');
        }
      }
    }
    // Phase 2 waves: three imps and a hound.
    if (s.phase === 'p2' && state.t >= n.wave && (s.waves || 0) < 3) {
      n.wave = state.t + 30;
      s.waves = (s.waves || 0) + 1;
      const side = s.waves % 2 ? { x: 55, y: 9 } : { x: 55, y: 35 };
      const spawned = [];
      for (let i = 0; i < 3; i++) spawned.push(api.spawnUnit(state, 't5.imp', { x: side.x - i * 1.5, y: side.y + (i - 1) * 2 }));
      spawned.push(api.spawnUnit(state, 't5.hound', { x: side.x, y: side.y + 3 }));
      const soft = raid.filter((r) => r.role !== 'tank');
      for (const a of spawned) {
        const t = a.templateId === 't5.hound' ? state.list.find((u) => u.ai && u.ai.type === 'offtank' && u.alive) || tank : soft[Math.floor(state.rng() * soft.length)] || tank;
        api.engage(state, a, t);
        api.addThreat(state, a, t, 300);
      }
      api.say(state, boss, 'Rise, embers!', 'yell');
      marker(state, api, 'mechanic', 'Adds', { kind: 'add', id: 'wave' + s.waves });
    }
    // Raid assignments: half the ranged on imps, one melee on the hound, everyone else on the boss.
    // The skull (your suggested target) points at an imp while they live.
    const imps = state.list.filter((u) => u.alive && u.templateId === 't5.imp');
    const hounds = state.list.filter((u) => u.alive && u.templateId === 't5.hound');
    const ranged = raid.filter((r) => r.kind === 'ally' && r.ai && r.ai.type === 'rdps');
    ranged.forEach((r, i) => { r.ai.focusId = i % 2 === 0 && imps.length ? imps[i % imps.length].id : null; });
    const melee = raid.filter((r) => r.kind === 'ally' && r.ai && r.ai.type === 'mdps');
    melee.forEach((r, i) => { r.ai.focusId = i < 2 && hounds.length ? hounds[0].id : null; });
    s.focusId = boss.id;
    s.suggestId = imps.length ? imps[0].id : hounds.length ? hounds[0].id : boss.id;
    // Battle resurrection: once, ten seconds after you fall.
    if (p && !p.alive) {
      s.deadAt = s.deadAt ?? state.t;
      if (!s.rezUsed && state.t - s.deadAt > 10) {
        s.rezUsed = true;
        api.reviveUnit(state, p, 0.4);
        s.deadAt = null;
        s.rezzed = (s.rezzed || 0) + 1;
        api.banner(state, 'Rebirth', 'A raid druid brings you back. That was the only battle resurrection.', 3, 'info');
      }
    }
  },
  objectives(state) {
    const s = state.script;
    const boss = s.boss;
    const st = windowStats(state);
    const out = [{ text: 'Vorgrath', progress: boss.alive ? `${Math.round((boss.hp / boss.maxHp) * 100)} % · ${s.phase === 'p1' ? 'phase 1' : s.phase === 'p2' ? 'phase 2' : s.phase === 'p3' ? 'phase 3' : 'pull'}` : 'defeated', done: !boss.alive }];
    const dutyKinds = { tranq: 'tranq', decurse: 'dispel', dispel: 'dispel', heal: 'dispel' };
    if (s.duty) {
      const d = windowStats(state, dutyKinds[s.duty]);
      out.push({ text: s.duty === 'tranq' ? 'Frenzies tranquilized by you' : s.duty === 'decurse' ? 'Curses removed by you' : 'Shackles dispelled by you', progress: `${d.byPlayer}/${d.total}`, done: false, info: true });
    }
    if (st.total) out.push({ text: 'Magma Pools dodged', progress: `${windowStats(state, 'move').ok}/${windowStats(state, 'move').total}`, done: false, info: true });
    return out;
  },
  checkOutcome(state, api) {
    const s = state.script;
    const p = api.player(state);
    if (!s.boss.alive) return { result: 'victory', reason: 'Vorgrath the Ember Tyrant falls. The Molten Throne is yours.' };
    if (p && !p.alive && s.rezUsed && s.deadAt != null) return { result: 'defeat', reason: 'You died again after the battle resurrection.' };
    const tanks = state.list.filter((u) => u.side === 'player' && u.role === 'tank');
    if (tanks.length && tanks.every((t) => !t.alive)) return { result: 'defeat', reason: 'Both tanks are down — the raid wipes.' };
    if (state.t > 600) return { result: 'defeat', reason: 'Vorgrath outlasted the raid (enrage timer).' };
    return null;
  },
  summary(state) {
    const s = state.script;
    const p = state.units[state.playerId];
    const t = Math.max(1, state.t - (s.fightStart || 0));
    const me = (state.meters.dmg[state.playerId] || 0) + (p && p.petId ? state.meters.dmg[p.petId] || 0 : 0) + state.list.filter((u) => u.ownerId === state.playerId && u.kind === 'guardian').reduce((a, u) => a + (state.meters.dmg[u.id] || 0), 0);
    const healer = state.opts.role === 'healer';
    const rows = state.list.filter((u) => u.side === 'player' && u.kind === 'ally').map((u) => (healer ? state.meters.heal[u.id] || 0 : state.meters.dmg[u.id] || 0));
    const mine = healer ? state.meters.heal[state.playerId] || 0 : me;
    const rank = 1 + rows.filter((x) => x > mine).length;
    const lines = [
      { label: 'Fight time', value: `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}` },
      { label: healer ? 'Your HPS' : 'Your DPS', value: `${Math.round(mine / t)} (rank ${rank} of ${rows.length + 1})` },
    ];
    const kinds = { tranq: ['tranq', 'Frenzies tranquilized'], decurse: ['dispel', 'Curses removed'], dispel: ['dispel', 'Shackles dispelled'], heal: ['dispel', 'Shackles dispelled'] };
    if (s.duty) {
      const [k, label] = kinds[s.duty];
      const d = windowStats(state, k);
      lines.push({ label, value: `${d.byPlayer} by you / ${d.total}` });
    }
    const mv = windowStats(state, 'move');
    if (mv.total) lines.push({ label: 'Magma Pools dodged', value: `${mv.ok}/${mv.total}` });
    lines.push({ label: 'Raid deaths', value: String(state.list.filter((u) => u.side === 'player' && u.kind === 'ally' && !u.alive).length + (s.rezzed || 0)) });
    if (s.rezzed) lines.push({ label: 'Battle resurrection', value: 'Used on you' });
    return lines;
  },
};
