// Trial 3 — The Sunken Reliquary (dungeon, level 30). A four-person party against
// crimson zealots and Abbot Varnath. The Priest may heal (no NPC healer then).
// Every duty opens a 'mechanic' window telemetry can pair with what you did.
import { registerAbilities, registerTemplates, getTemplate } from '../../engine/registry.js';
import { spawnPlayer, marker, openWindow, resolveWindow, windowStats, freshEvents } from '../common.js';
import { scaled } from '../enemies.js';
import { spawnClassMember } from '../party.js';
import { buffsFromClasses } from '../stats.js';

const APPROX = { status: 'approximation', note: 'Original boss ability for this trial, sized to a real level-30 elite boss.' };

registerAbilities({
  't3.cleave': {
    name: 'Cleave', icon: 'axe', school: 'physical', mechanic: 'physical', category: 'damage', target: 'none', cooldown: 6, fx: 'none',
    desc: 'A sweeping blow at everyone in front of the Abbot.', forever: APPROX,
    onCast: ({ state, u, api }) => { const t = api.U(state, u.target); if (t) u.facing = api.G.angleTo(u, t); },
    effects: [{ type: 'damage', amount: [300, 370], kind: 'melee', aoe: { center: 'self', radius: 8, cone: Math.PI * 0.55, affects: 'enemies' } }],
  },
  't3.censure': {
    name: 'Censure', icon: 'holy-fire', school: 'holy', category: 'control', castTime: 2.5, range: 40, cooldown: 0,
    desc: 'A 2.5 s cast: if it finishes, the target is struck and flees in terror for 4 s. Interrupt it.', forever: APPROX,
    effects: [{ type: 'damage', amount: [200, 240] }, { type: 'aura', aura: { id: 't3.censure', name: 'Censure', icon: 'scream', school: 'holy', debuff: true, duration: 4, cc: 'fear', dr: 'fear', dispel: 'magic' } }],
  },
  't3.faithful.strike': {
    name: 'Zealous Strike', icon: 'sword', school: 'holy', category: 'damage', range: 5, cooldown: 6, mechanic: 'physical',
    desc: 'A holy-charged strike.', forever: APPROX, effects: [{ type: 'damage', amount: [70, 90], kind: 'melee', school: 'holy' }],
  },
});

// Bodies are real level-30 Classic elites (enemies.js: an ordinary mob × the median elite
// ratios, 2.6× health and 3× damage) times the factors below; the initiates are ordinary mobs.
const Z = { side: 'enemy', kind: 'enemy', tags: ['humanoid'], aggroRadius: 0, leash: 90 };
registerTemplates({
  't3.guard': { ...Z, name: 'Zealot Guard', portrait: 'zealot-guard', mob: { elite: true, hp: 1.0, dmg: 1.0, armor: 1.3 }, ai: { type: 'melee' } },
  't3.footman': { ...Z, name: 'Zealot Footman', portrait: 'zealot', mob: { elite: true, hp: 0.85, dmg: 0.85 }, ai: { type: 'melee' } },
  't3.fanatic': { ...Z, name: 'Zealot Fanatic', portrait: 'zealot', mob: { elite: true, hp: 0.85, dmg: 0.95, speed: 1.9, armor: 0.85 }, immune: { taunt: true }, speed: 8, ai: { type: 'melee' } },
  't3.priest': {
    ...Z, name: 'Zealot Priest', portrait: 'zealot-priest', mob: { elite: true, hp: 0.75, dmg: 0.45, caster: true }, tags: ['humanoid', 'caster'],
    abilities: ['npc.heal', 'npc.shadowbolt'],
    ai: { type: 'healer', range: 28, rotation: [{ id: 'npc.heal', target: 'lowestAlly', maxPct: 0.75 }, { id: 'npc.shadowbolt', target: 'randomEnemy', chance: 0.5 }] },
  },
  't3.abbot': {
    ...Z, name: 'Abbot Varnath', portrait: 'abbot', kind: 'boss', radius: 1.3, mob: { elite: true, dmg: 1.3, speed: 2.4, armor: 1.1 },
    immune: { stun: true, incap: true, fear: true, cc: true, taunt: false },
    abilities: ['t3.cleave', 't3.censure'], ai: { type: 'melee', rotation: [{ id: 't3.cleave' }] },
  },
  't3.faithful': { ...Z, name: 'Faithful Initiate', portrait: 'zealot', mob: { hp: 0.4, dmg: 0.45 }, speed: 7.5, abilities: ['t3.faithful.strike'], ai: { type: 'melee', rotation: [{ id: 't3.faithful.strike' }] } },
});

const TRASH = [
  { tpl: 't3.guard', x: 27, y: 15 },
  { tpl: 't3.footman', x: 28, y: 19 },
  { tpl: 't3.fanatic', x: 30, y: 14 },
  { tpl: 't3.priest', x: 32, y: 18.5 },
];
const BOSS_POS = { x: 50, y: 17 };
const TANK_BOSS_SPOT = { x: 53.5, y: 17 };
const TANK_TRASH_SPOT = { x: 24, y: 17 };

const L = 30;
// A real five-player group of level-30 classes (src/content/party.js): a Protection Warrior tank,
// a Combat Rogue and a Warlock, plus a Restoration Shaman — or a Frost Mage when you heal.
function partyRoster(opts) {
  const healer = opts.role === 'healer';
  return [
    { classId: 'warrior', role: 'tank', race: 'orc', name: 'Gorrak', portrait: 'orc-warrior', at: { x: 11, y: 17 } },
    { classId: 'rogue', role: 'dps', race: 'troll', name: 'Zaj’ka', portrait: 'troll-rogue', skill: 0.7, react: 1.2, at: { x: 9, y: 15 } },
    { classId: 'warlock', role: 'dps', race: 'undead', name: 'Mordessa', portrait: 'undead-warlock', skill: 0.7, react: 1.2, at: { x: 7, y: 15 } },
    healer
      ? { classId: 'mage', role: 'dps', spec: 'frost', race: 'troll', name: 'Ilyra', portrait: 'troll-mage', skill: 0.75, at: { x: 7, y: 19 } }
      : { classId: 'shaman', role: 'healer', race: 'orc', name: 'Thalga', portrait: 'orc-shaman', skill: 0.75, react: 1.0, at: { x: 6, y: 20 } },
  ];
}
const partyBuffs = (opts) => buffsFromClasses([...partyRoster(opts).map((m) => m.classId), opts.classId]);
// Abbot Varnath, a level-30 dungeon boss: about three and a half real elites' worth of health.
const BOSS_HP = { dps: 9000, healer: 8000 };
const healerOf = (state) => state.list.find((u) => u.side === 'player' && u.alive && u.role === 'healer');
const party = (state) => state.list.filter((u) => u.side === 'player' && (u.kind === 'ally' || u.kind === 'player'));
const playerHasHumanoidCC = (state) => {
  const p = state.units[state.playerId];
  return !!(p && (p.ab['mage.poly'] || p.ab['hunter.freezetrap']));
};

function brandDef(state) {
  const curse = state.opts.classId === 'mage';
  return {
    id: 't3.brand', name: curse ? 'Curse of Penance' : 'Brand of Zeal', icon: curse ? 'skull' : 'holy-fire', school: 'holy', debuff: true,
    duration: 15, dispel: curse ? 'curse' : 'magic', tick: { interval: 3, amount: 80, school: 'holy' },
  };
}

export const TRIAL = {
  id: 't3',
  order: 3,
  title: 'The Sunken Reliquary',
  place: 'A flooded cathedral of the crimson zealots',
  level: 30,
  levels: [30],
  kind: 'dungeon',
  blurb: 'A five-player dungeon in miniature: a trash pull with a healer to interrupt, then Abbot Varnath. Priests may heal.',
  rolesFor: (classId) => (classId === 'priest' ? ['dps', 'healer'] : ['dps']),
  groupBuffs: partyBuffs,
  intro(classId, level, role) {
    const healer = role === 'healer';
    return {
      text: healer
        ? 'You are the group’s healer. Gorrak tanks, Zaj’ka and Mordessa deal damage. Keep them standing through a zealot pack and Abbot Varnath — your mana has to last.'
        : 'Gorrak tanks, Zaj’ka stabs things, Thalga heals (and her mana is finite — avoidable damage costs the group). You bring damage, control and whatever utility your class has.',
      goals: ['Clear the zealot pack at the stairs', 'Defeat Abbot Varnath', 'Keep the tank and healer alive'],
      tips: [
        'The Zealot Priest’s Flash of Zeal and the Abbot’s Censure can be interrupted.',
        'Fire circles appear under people: step out.',
        classId === 'mage' ? 'The Abbot’s Curse of Penance can be removed with Remove Lesser Curse.' : classId === 'priest' ? 'Brand of Zeal is Magic: Dispel Magic removes it.' : 'You cannot remove the Abbot’s Brand — but you can make sure nobody else needs healing.',
        healer ? 'Click a party frame or press F1–F5 to target. Hover a frame and press a heal key to heal that member. Shields stop pushback.' : 'The skull marks the kill target. A Fanatic will go for the healer: peel it.',
      ],
    };
  },
  arena: {
    w: 64, h: 34, theme: 'crypt',
    obstacles: [
      { x: 18, y: 7, r: 1.5, kind: 'pillar' }, { x: 18, y: 27, r: 1.5, kind: 'pillar' }, { x: 37, y: 7, r: 1.5, kind: 'pillar' },
      { x: 37, y: 27, r: 1.5, kind: 'pillar' }, { x: 45, y: 9, r: 1.3, kind: 'pillar' }, { x: 45, y: 25, r: 1.3, kind: 'pillar' },
    ],
    decor: [
      { kind: 'rune', x: 50, y: 17, r: 6, color: '#a8323a' },
      { kind: 'label', x: 27, y: 10.5, text: 'Stair landing', size: 0.9 },
      { kind: 'label', x: 51, y: 9.5, text: 'Reliquary', size: 0.9 },
      { kind: 'banner', x: 60, y: 6, color: '#8a1d1d' }, { kind: 'banner', x: 60, y: 28, color: '#8a1d1d' },
    ],
  },
  hud: { party: true, meters: true, timer: true, threat: true },
  setup(state, api) {
    const healerRole = state.opts.role === 'healer';
    spawnPlayer(state, api, { x: 8, y: healerRole ? 21 : 13 });
    const members = partyRoster(state.opts).map((m) => spawnClassMember(state, api, { ...m, groupBuffs: partyBuffs(state.opts) }, { ...m.at, level: L }));
    const tank = members[0];
    tank.ai.restSpot = { x: 12, y: 17 };
    for (const t of TRASH) {
      const u = api.spawnUnit(state, scaled(L, getTemplate(t.tpl)), { x: t.x, y: t.y, templateId: t.tpl, group: 'trash' });
      u.meta.trash = true;
    }
    const boss = api.spawnUnit(state, scaled(L, getTemplate('t3.abbot')), { ...BOSS_POS, templateId: 't3.abbot' });
    boss.maxHp = boss.hp = healerRole ? BOSS_HP.healer : BOSS_HP.dps;
    boss.melee = { ...boss.melee, threat: 1 };
    state.script.phase = 'prep';
    state.script.prepEnd = 8;
    state.script.noPull = true; // bots follow the tank; a human may still pull early
    api.banner(state, 'Gorrak pulls in 8 s', playerHasHumanoidCC(state) ? 'Crowd-control one zealot now if you can.' : 'Get into position.', 3, 'info');
  },
  onTick(state, api, dt) {
    const s = state.script;
    const tank = state.list.find((u) => u.role === 'tank' && u.side === 'player');
    const boss = state.list.find((u) => u.templateId === 't3.abbot');
    const ev = freshEvents(state);
    // --- mechanic resolution from this step's events
    for (const e of ev) {
      if (e.type === 'castStart' && e.ability === 'npc.heal') openWindow(state, api, 'interrupt', 'heal' + e.seq, 'Flash of Zeal', { caster: e.src });
      if (e.type === 'castStart' && e.ability === 't3.censure') openWindow(state, api, 'interrupt', 'censure' + e.seq, 'Censure', { caster: e.src });
      if (e.type === 'interrupt') for (const w of Object.values(s.windows || {})) if (w.open && w.kind === 'interrupt' && w.caster === e.dst) resolveWindow(state, api, w.id, true, e.src);
      if (e.type === 'castStop' && e.reason === 'complete') for (const w of Object.values(s.windows || {})) if (w.open && w.kind === 'interrupt' && w.caster === e.src) resolveWindow(state, api, w.id, false, null);
      if (e.type === 'castStop' && e.reason !== 'complete') for (const w of Object.values(s.windows || {})) if (w.open && w.kind === 'interrupt' && w.caster === e.src && e.reason !== 'interrupted') resolveWindow(state, api, w.id, false, null);
      if (e.type === 'dispel' && e.aura === 't3.brand') for (const w of Object.values(s.windows || {})) if (w.open && w.kind === 'dispel' && w.holder === e.dst) resolveWindow(state, api, w.id, true, e.src);
      if (e.type === 'auraFade' && e.aura === 't3.brand' && e.reason === 'expired') for (const w of Object.values(s.windows || {})) if (w.open && w.kind === 'dispel' && w.holder === e.dst) resolveWindow(state, api, w.id, false, null);
    }
    // --- phases
    if (s.phase === 'prep' && state.t >= s.prepEnd) {
      s.phase = 'trash';
      s.pullAt = state.t;
      const priest = state.list.find((u) => u.templateId === 't3.priest');
      state.script.focusId = priest ? priest.id : null;
      state.script.tankSpot = TANK_TRASH_SPOT;
      if (playerHasHumanoidCC(state)) openWindow(state, api, 'cc', 'prepull', 'Crowd control one zealot');
      for (const u of state.list.filter((x) => x.meta.trash && x.alive)) {
        if (u.auras.some((a) => a.def.breakOnDamage)) continue;
        api.engage(state, u, tank, false);
        api.addThreat(state, u, tank, 60);
      }
      api.say(state, tank, 'For the Horde!', 'yell');
      marker(state, api, 'pull', 'Zealot pack');
    }
    if (s.phase === 'trash') {
      const trash = state.list.filter((u) => u.meta.trash);
      // A zealot coming out of crowd control rejoins the fight.
      for (const u of trash) if (u.alive && !u.engaged && !u.evading && !u.auras.some((a) => a.def.breakOnDamage)) api.engage(state, u, tank && tank.alive ? tank : api.player(state), false);
      // Pre-pull CC: counts if a zealot sits in breakable CC within 4 s of the pull.
      const w = s.windows && s.windows.prepull;
      if (w && w.open) {
        const held = trash.find((u) => u.alive && u.auras.some((a) => a.def.breakOnDamage && a.def.debuff));
        if (held) resolveWindow(state, api, 'prepull', true, held.auras.find((a) => a.def.breakOnDamage).srcId);
        else if (state.t - s.pullAt > 4) resolveWindow(state, api, 'prepull', false, null);
      }
      // The Fanatic goes for the healer 5 s in; it cannot be taunted.
      const fan = trash.find((u) => u.templateId === 't3.fanatic');
      const healer = healerOf(state);
      if (fan && fan.alive && healer && !s.fanaticGo && state.t - s.pullAt > 5 && !fan.auras.some((a) => a.def.breakOnDamage)) {
        s.fanaticGo = true;
        api.engage(state, fan, healer);
        fan.threat[healer.id] = Math.max(0, ...Object.values(fan.threat)) * 1.6 + 400;
        fan.target = healer.id;
        api.say(state, fan, 'The heretic healer dies first!', 'yell');
        state.script.focusId = fan.id;
        openWindow(state, api, 'peel', 'fanatic', 'Peel the Fanatic off the healer', { healer: healer.id });
      }
      const pw = s.windows && s.windows.fanatic;
      if (pw && pw.open && fan) {
        const ccd = fan.alive && (fan.cc.stun || fan.cc.incap || fan.cc.fear || fan.cc.root);
        if (!fan.alive || ccd || (fan.target && fan.target !== pw.healer)) {
          const by = !fan.alive ? s.fanKiller : ccd ? (fan.auras.find((a) => a.def.cc && a.def.debuff) || {}).srcId : fan.target;
          resolveWindow(state, api, 'fanatic', true, by);
          if (state.script.focusId === fan.id) state.script.focusId = null;
        } else if (state.t - pw.at > 14) resolveWindow(state, api, 'fanatic', false, null);
      }
      if (trash.every((u) => !u.alive)) {
        s.phase = 'break';
        s.breakEnd = state.t + 12;
        state.script.focusId = null;
        api.banner(state, 'The stairs are clear', 'Abbot Varnath waits in the reliquary. Gorrak pulls in 12 s.', 3, 'info');
        const shaman = state.list.find((u) => u.classId === 'shaman' && u.alive);
        if (shaman) api.say(state, shaman, 'Drinking — give me a moment.', 'say');
      }
    }
    if (s.phase === 'break') {
      for (const a of party(state)) {
        if (a.kind === 'player' || !a.alive) continue;
        a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.08 * dt);
        if (a.res.mana) a.res.mana.cur = Math.min(a.res.mana.max, a.res.mana.cur + a.res.mana.max * 0.1 * dt);
      }
      if (state.t >= s.breakEnd) {
        s.phase = 'boss';
        s.bossAt = state.t;
        s.nextCensure = state.t + 9;
        s.nextCenser = state.t + 7;
        s.nextBrand = state.t + 12;
        state.script.tankSpot = TANK_BOSS_SPOT;
        state.script.focusId = boss.id;
        api.engage(state, boss, tank, false);
        api.addThreat(state, boss, tank, 150);
        api.say(state, boss, 'The tide brings heretics to my altar. Kneel!', 'yell');
        marker(state, api, 'pull', 'Abbot Varnath');
      }
    }
    if (s.phase === 'boss' && boss && boss.alive) {
      const members = party(state).filter((u) => u.alive);
      const nonTank = members.filter((u) => u.role !== 'tank');
      // Censure: interruptible fear.
      if (state.t >= s.nextCensure && !boss.casting) {
        const tgt = nonTank[Math.floor(state.rng() * nonTank.length)];
        if (tgt) {
          boss.facing = api.G.angleTo(boss, tgt);
          api.startCast(state, boss, 't3.censure', { targetId: tgt.id, noAuto: true });
          api.say(state, boss, 'Kneel before the Light!', 'yell');
        }
        s.nextCensure = state.t + 15;
      }
      // Smouldering Censer: fire circles under two party members.
      if (state.t >= s.nextCenser) {
        s.nextCenser = state.t + 12;
        const picks = [...nonTank].sort(() => state.rng() - 0.5).slice(0, 2);
        for (const v of picks) {
          const z = api.spawnZone(state, { shape: { type: 'circle', r: 4 }, x: v.x, y: v.y, owner: boss.id, side: boss.side, telegraph: 2, duration: 6, interval: 1, visual: 'fire', label: 'Smouldering Censer', school: 'fire', abilityId: 't3.censer', effects: [{ type: 'damage', amount: [110, 130], school: 'fire' }] });
          if (v.id === state.playerId) openWindow(state, api, 'move', 'censer' + z.id, 'Step out of the fire', { zone: z.id });
        }
      }
      for (const w of Object.values(s.windows || {})) {
        if (!w.open || w.kind !== 'move') continue;
        const z = state.zones.find((x) => x.id === w.zone);
        const p = api.player(state);
        if (!z || !p) { resolveWindow(state, api, w.id, true, state.playerId); continue; }
        if (z.armed && state.t - z.armAt > 0.6) resolveWindow(state, api, w.id, !api.G.pointInZone(z, p), state.playerId);
      }
      // Brand of Zeal (Curse of Penance when a Mage is in the group).
      if (state.t >= s.nextBrand) {
        s.nextBrand = state.t + 20;
        const tgt = nonTank[Math.floor(state.rng() * nonTank.length)];
        if (tgt) {
          const def = brandDef(state);
          api.applyAura(state, boss, tgt, def);
          api.emit(state, { type: 'say', src: boss.id, text: `${def.name} sears ${tgt.id === state.playerId ? 'you' : tgt.name}!`, kind: 'emote' });
          openWindow(state, api, 'dispel', 'brand' + state.t.toFixed(1), def.name, { holder: tgt.id });
        }
      }
      // Call the Faithful at 50 %.
      if (!s.faithful && boss.hp / boss.maxHp < 0.5) {
        s.faithful = true;
        const healer = healerOf(state) || api.player(state);
        for (let i = 0; i < 3; i++) {
          const f = (api.spawnUnit(state, scaled(L, getTemplate('t3.faithful')), { x: 61, y: i === 1 ? 17 : i === 0 ? 7 : 27, templateId: 't3.faithful' }));
          api.engage(state, f, healer);
          f.threat[healer.id] = 500;
          f.target = healer.id;
        }
        api.say(state, boss, 'Faithful! Silence their healer!', 'yell');
        api.banner(state, 'Call the Faithful', 'Three initiates run for your healer.', 2.6, 'warn');
        openWindow(state, api, 'add', 'faithful', 'Stop the Faithful');
        s.faithfulAt = state.t;
      }
      if (s.faithful) {
        // Skull the adds while they live, then back to the Abbot.
        const live = state.list.filter((u) => u.templateId === 't3.faithful' && u.alive);
        state.script.focusId = live.length ? live[0].id : boss.id;
      }
      if (s.faithful && s.windows.faithful && s.windows.faithful.open) {
        const adds = state.list.filter((u) => u.templateId === 't3.faithful');
        if (adds.every((u) => !u.alive)) resolveWindow(state, api, 'faithful', true, state.playerId);
        else if (state.t - s.faithfulAt > 25) resolveWindow(state, api, 'faithful', false, null);
      }
    }
  },
  onDeath(state, api, u, killer) {
    if (u.templateId === 't3.fanatic') state.script.fanKiller = killer ? killer.ownerId || killer.id : null;
    if (u.side === 'player' && u.kind === 'ally') api.say(state, u, `${u.name} has fallen.`, 'emote');
  },
  objectives(state) {
    const trash = state.list.filter((u) => u.meta.trash);
    const boss = state.list.find((u) => u.templateId === 't3.abbot');
    return [
      { text: 'Zealot pack', progress: `${trash.filter((u) => !u.alive).length}/${trash.length}`, done: trash.every((u) => !u.alive) },
      { text: 'Abbot Varnath', progress: boss && boss.alive ? `${Math.round((boss.hp / boss.maxHp) * 100)} %` : 'defeated', done: boss && !boss.alive },
    ];
  },
  checkOutcome(state, api) {
    const p = api.player(state);
    if (!p || !p.alive) return { result: 'defeat', reason: 'You died in the reliquary.' };
    const tank = state.list.find((u) => u.role === 'tank' && u.side === 'player');
    const healer = state.list.find((u) => u.role === 'healer' && u.side === 'player');
    if (tank && !tank.alive && healer && !healer.alive) return { result: 'defeat', reason: 'Tank and healer are down — the group wipes.' };
    const boss = state.list.find((u) => u.templateId === 't3.abbot');
    if (boss && !boss.alive) return { result: 'victory', reason: 'Abbot Varnath is dead. The reliquary is quiet.' };
    return null;
  },
  summary(state) {
    const p = state.units[state.playerId];
    const lines = [];
    for (const [kind, label] of [['interrupt', 'Interrupts'], ['dispel', 'Dispels'], ['cc', 'Pre-pull CC'], ['peel', 'Fanatic peeled'], ['move', 'Fire dodged'], ['add', 'Faithful stopped']]) {
      const st = windowStats(state, kind);
      if (st.total) lines.push({ label, value: `${st.ok}/${st.total}${kind === 'move' ? '' : ` (you: ${st.byPlayer})`}` });
    }
    const deaths = state.list.filter((u) => u.side === 'player' && u.kind === 'ally' && !u.alive).length;
    lines.push({ label: 'Party deaths', value: String(deaths) });
    if (state.opts.role === 'healer') lines.push({ label: 'Healing done', value: String(Math.round(state.meters.heal[state.playerId] || 0)) });
    else lines.push({ label: 'Damage done', value: String(Math.round((state.meters.dmg[state.playerId] || 0) + (p && p.petId ? state.meters.dmg[p.petId] || 0 : 0))) });
    if (p && p.res.mana) lines.push({ label: 'Mana at the end', value: `${Math.round((p.res.mana.cur / p.res.mana.max) * 100)} %` });
    return lines;
  },
};
