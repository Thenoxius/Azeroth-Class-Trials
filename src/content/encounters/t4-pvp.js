// Trial 4 — Battleground Duel (level 60). Best of three against Sergeant Aldric Vane,
// a Human Warrior who adapts between rounds to what you did — and says so.
// Diminishing returns are on (kind 'opponent').
import { registerAbilities, registerTemplates, registerBehavior } from '../../engine/registry.js';
import * as G from '../../engine/geometry.js';
import { spawnPlayer, marker, openWindow, resolveWindow, windowStats, freshEvents } from '../common.js';
import { deriveStats } from '../stats.js';

// Aldric: a Human Arms Warrior at 60 built with the same Classic rules as you — base stats,
// fresh dungeon-blue gear (our estimate), Battle Shout (+140 AP, datamined) and Arms crit talents.
const ALDRIC = deriveStats({ classId: 'warrior', race: 'human', level: 60, gear: { str: 120, agi: 60, sta: 150, armor: 3400, critPhys: 0.03, hit: 0.03 } });

const APPROX = { status: 'approximation', note: 'Classic Warrior tool used by an NPC opponent; numbers are ours.' };
const ROUND_SECONDS = 75;
const START = { player: { x: 6, y: 14 }, foe: { x: 38, y: 16 } };

registerAbilities({
  't4.charge': {
    name: 'Charge', icon: 'dash', school: 'physical', mechanic: 'physical', category: 'movement', range: 25, minRange: 8, cooldown: 15, gcd: 0, noRoot: true,
    desc: 'Rushes you and stuns for 1 s. Only at the start of a round.', forever: APPROX,
    effects: [{ type: 'teleport', mode: 'toTarget' }, { type: 'aura', aura: { id: 't4.charge', name: 'Charge Stun', icon: 'dash', debuff: true, duration: 1, cc: 'stun' } }],
  },
  't4.intercept': {
    name: 'Intercept', icon: 'dash', school: 'physical', mechanic: 'physical', category: 'movement', range: 25, minRange: 8, cooldown: 30, gcd: 0, noRoot: true,
    desc: 'Leaps to you and stuns for 3 s.', forever: APPROX,
    effects: [{ type: 'teleport', mode: 'toTarget' }, { type: 'aura', aura: { id: 't4.intercept', name: 'Intercept Stun', icon: 'dash', debuff: true, duration: 3, cc: 'stun', dr: 'stun' } }],
  },
  't4.hamstring': {
    name: 'Hamstring', icon: 'wing-clip', school: 'physical', mechanic: 'physical', category: 'control', range: 5, cooldown: 0,
    desc: 'Slows you by 50 % for 15 s.', forever: APPROX,
    effects: [{ type: 'damage', amount: [60, 70], kind: 'melee' }, { type: 'aura', aura: { id: 't4.hamstring', name: 'Hamstring', icon: 'wing-clip', debuff: true, duration: 15, mods: { slow: 0.5 } } }],
  },
  't4.ms': {
    name: 'Mortal Strike', icon: 'sword', school: 'physical', mechanic: 'physical', category: 'damage', range: 5, cooldown: 6,
    desc: 'A heavy strike; healing on you is halved for 10 s.', forever: APPROX,
    effects: [{ type: 'damage', amount: [470, 540], kind: 'melee' }, { type: 'aura', aura: { id: 't4.ms', name: 'Mortal Wound', icon: 'sword', debuff: true, duration: 10, mods: { healTaken: 0.5 } } }],
  },
  't4.pummel': {
    name: 'Pummel', icon: 'shield', school: 'physical', mechanic: 'physical', category: 'interrupt', range: 5, cooldown: 10, gcd: 0,
    desc: 'Interrupts your spell and locks that school for 4 s.', forever: APPROX, effects: [{ type: 'interrupt', lockout: 4 }],
  },
  't4.brage': {
    name: 'Berserker Rage', icon: 'beast-wrath', school: 'physical', mechanic: 'physical', category: 'defensive', target: 'self', cooldown: 30, gcd: 0,
    desc: 'Immune to Fear for 10 s.', forever: APPROX,
    effects: [{ type: 'aura', to: 'self', aura: { id: 't4.brage', name: 'Berserker Rage', icon: 'beast-wrath', duration: 10, onApply: ({ u }) => { u.immune.fear = true; }, onRemove: ({ u }) => { u.immune.fear = false; } } }],
  },
  't4.shout': {
    name: 'Intimidating Shout', icon: 'scream', school: 'physical', mechanic: 'physical', category: 'control', target: 'none', cooldown: 60, fx: 'ring', fxRadius: 8,
    desc: 'You (and your pet) flee in fear for 6 s.', forever: APPROX,
    effects: [{ type: 'aura', aoe: { center: 'self', radius: 8, affects: 'enemies' }, aura: { id: 't4.shout', name: 'Intimidating Shout', icon: 'scream', debuff: true, duration: 6, cc: 'fear', dr: 'fear', breakDamage: 0.08, breakDamagePct: true } }],
  },
  't4.disarm': {
    name: 'Disarm', icon: 'sword', school: 'physical', mechanic: 'physical', category: 'control', range: 5, cooldown: 60,
    desc: 'Knocks your melee weapons away for 8 s: no melee attacks or weapon strikes.', forever: APPROX,
    effects: [{ type: 'aura', aura: { id: 't4.disarm', name: 'Disarmed', icon: 'sword', debuff: true, duration: 8, cc: 'disarm', dr: 'disarm' } }],
  },
  't4.retal': {
    name: 'Retaliation', icon: 'shield-wall', school: 'physical', mechanic: 'physical', category: 'defensive', target: 'self', cooldown: 999, gcd: 0,
    desc: 'For 15 s he strikes back at every melee attack against him. Stop hitting him in melee (pets too).', forever: APPROX,
    effects: [{
      type: 'aura', to: 'self',
      aura: {
        id: 't4.retal', name: 'Retaliation', icon: 'shield-wall', duration: 15,
        onHolderDamaged: ({ state, u, api, src, pk }) => {
          if (!src || !src.alive || pk.kind !== 'melee' || src.side === u.side) return;
          if (state.t - (u.meta.lastRetal || -9) < 0.4) return;
          u.meta.lastRetal = state.t;
          api.dealDamage(state, u, src, { amount: 260 + 80 * state.rng(), kind: 'melee', school: 'physical', ability: 't4.retal', noAvoid: true });
        },
      },
    }],
  },
  't4.reck': {
    name: 'Recklessness', icon: 'axe', school: 'physical', mechanic: 'physical', category: 'cooldown', target: 'self', cooldown: 999, gcd: 0,
    desc: 'All-in: much higher crit chance, but he takes 20 % more damage for 15 s.', forever: APPROX,
    effects: [{ type: 'aura', to: 'self', aura: { id: 't4.reck', name: 'Recklessness', icon: 'axe', duration: 15, mods: { crit: 0.6, dmgTaken: { all: 1.2 } } } }],
  },
  't4.bandage': {
    name: 'Heavy Runecloth Bandage', icon: 'bandage', school: 'physical', mechanic: 'physical', category: 'heal', target: 'self', cooldown: 60, noPushback: true,
    desc: 'Bandages himself when he gets distance: 2000 health over 8 s, stopped by damage.', forever: APPROX,
    channel: { duration: 8, ticks: 8, effects: [] },
    onChannelStart: ({ u }) => { u.casting.startHp = u.hp; },
    onTick: ({ state, u, api }) => {
      if (u.casting && u.hp < u.casting.startHp - 1) { api.cancelCast(state, u, 'damaged'); return; }
      u.hp = Math.min(u.maxHp, u.hp + 250);
      if (u.casting) u.casting.startHp = u.hp;
    },
  },
});

registerTemplates({
  't4.aldric': {
    name: 'Sergeant Aldric Vane', portrait: 'human-warrior', side: 'enemy', kind: 'opponent', classId: 'warrior', tags: ['humanoid'], level: 60, radius: 0.9,
    // Players fight each other on the player attack table (no glancing or crushing blows).
    maxHp: ALDRIC.maxHp, armor: ALDRIC.armor, speed: 7, melee: { min: 140, max: 210, speed: 3.5, coef: 3.5 / 14 },
    stats: { ap: ALDRIC.stats.ap + 140, critPhys: ALDRIC.stats.critPhys + 0.05, dodge: ALDRIC.stats.dodge, parry: 0.05, hit: 0.03 },
    abilities: ['t4.charge', 't4.intercept', 't4.hamstring', 't4.ms', 't4.pummel', 't4.brage', 't4.shout', 't4.reck', 't4.bandage', 't4.disarm', 't4.retal'],
    ai: { type: 'duelist', interval: 0.1 }, flags: { noEvade: true, noLeash: true, playerLike: true },
  },
});

// ---------------------------------------------------------------- the duelist

registerBehavior('duelist', (state, u, api) => {
  const s = state.script;
  const prof = s.adapt || {};
  const p = api.player(state);
  if (!p || !p.alive || s.between) { u.move.to = null; return; }
  if (u.casting) return;
  const pet = p.petId && api.U(state, p.petId);
  // Target: the player — or the pet, when the pet was the main pressure last round.
  let t = p;
  if (prof.pet && pet && pet.alive && state.t - s.roundStart < 8) t = pet;
  // Feign Death fools him: he turns on the pet, or waits.
  if (p.flags.feigned) {
    if (pet && pet.alive) t = pet;
    else { u.move.to = null; return; }
  }
  if (u.target !== t.id) u.target = t.id;
  if (!u.engaged) api.engage(state, u, p);
  const d = G.dist(u, t) - (t.radius || 0.8);
  const cast = (id, targetId) => api.canCast(state, u, id, { targetId: targetId || t.id, noAuto: true }).ok && api.startCast(state, u, id, { targetId: targetId || t.id, noAuto: true }).ok;
  const hp = u.hp / u.maxHp;
  // Melee pressure (Survival, or a pet chewing on him): Retaliation.
  const meleeOnHim = state.list.filter((x) => x.alive && x.side !== u.side && x.target === u.id && x.melee && x.autoMelee && G.dist(x, u) < 6).length;
  if (meleeOnHim && hp < 0.7 && !api.findAura(u, 't4.retal') && cast('t4.retal')) {
    api.say(state, u, 'Come on then — hit me!', 'yell');
    openWindow(state, api, 'counterplay', 'retal' + s.round, 'Retaliation: stop hitting him in melee', { since: state.t });
    return;
  }
  // Burst when low (earlier if you saved your defensives last round).
  if (hp < (prof.lateDefensives ? 0.5 : 0.3)) cast('t4.reck');
  // Bandage when he has distance and you are not on him.
  if (hp < 0.6 && d > 26 && state.t - u.lastHostileT > 3 && cast('t4.bandage')) return;
  // Interrupt casts — faster if you hard-cast in his face last round.
  if (p.casting && p.casting.ab.mechanic !== 'physical' && G.dist(u, p) < 6.5) {
    s.castSeenAt = s.castSeenAt ?? state.t;
    if (state.t - s.castSeenAt >= (prof.hardcast ? 0.15 : 0.7) && cast('t4.pummel', p.id)) { s.castSeenAt = null; return; }
  } else s.castSeenAt = null;
  // Fear immunity before closing in, if you opened with fear last round.
  if (prof.ccOpen && d < 12 && !api.findAura(u, 't4.brage') && cast('t4.brage')) {
    if (!s.baitSaid) { s.baitSaid = true; api.say(state, u, 'Not this time.', 'yell'); openWindow(state, api, 'counterplay', 'bait' + s.round, 'Berserker Rage: wait before you fear', { since: state.t }); }
  }
  // Gap closers.
  if (d > 8 && d <= 25) {
    if (!s.charged && cast('t4.charge')) { s.charged = true; return; }
    const rootedRecently = state.t - (s.lastRootBreak || -99) < 3;
    const holdIntercept = prof.kite && !rootedRecently && hp > 0.35;
    if (!holdIntercept && cast('t4.intercept')) return;
  }
  // Scatter the pet and you with a shout when the pet was the problem, or when he is in trouble.
  if (d <= 6 && ((prof.pet && pet && pet.alive && G.dist(u, pet) < 8) || hp < 0.4) && cast('t4.shout')) return;
  if (d <= 5) {
    u.move.to = null;
    if (t === p && !api.findAura(p, 't4.hamstring') && cast('t4.hamstring')) return;
    // Disarm whoever is beating on him with melee weapons (Survival Hunters).
    if (t === p && p.melee && p.autoMelee && (p.ab['hunter.raptor'] || p.ab['hunter.mongoose']) && p.meta.spec === 'sv' && cast('t4.disarm')) return;
    if (cast('t4.ms')) return;
    if (prof.kite && t === p && (api.auraRemaining(p, 't4.hamstring') < 5) && cast('t4.hamstring')) return;
    return;
  }
  u.move.to = G.towards(t, u, (t.radius || 0.8) + 1.2);
});

// ---------------------------------------------------------------- round bookkeeping

function resetRound(state, api) {
  const s = state.script;
  const p = api.player(state);
  const foe = s.foe;
  for (const u of [p, foe, p && api.U(state, p.petId)].filter(Boolean)) {
    if (!u.alive) api.reviveUnit(state, u, 1);
    u.hp = u.maxHp;
    for (const r of Object.values(u.res)) r.cur = r === u.res.rage ? 0 : r.max;
    for (const a of [...u.auras]) if (!a.def.permanent) api.removeAura(state, u, a, 'removed');
    u.cds = {};
    u.casting = null;
    u.dr = {};
    u.move.to = null;
    u.move.dir = null;
  }
  p.x = START.player.x; p.y = START.player.y;
  foe.x = START.foe.x; foe.y = START.foe.y;
  foe.immune.fear = false;
  const pet = p.petId && api.U(state, p.petId);
  if (pet) { pet.x = p.x - 1.5; pet.y = p.y + 1.5; pet.petCmd = 'follow'; pet.target = null; pet.ai.mem.attackOrder = null; }
  if (p.meta.gems !== undefined) p.meta.gems = 3;
  p.flags.sor = false;
  s.charged = false;
  s.baitSaid = false;
  s.track = { castsInMelee: 0, casts: 0, ccAtContact: false, contactAt: null, kiteTime: 0, chaseTime: 0, petDmg: 0, myDmg: 0, defEarly: 0, defLate: 0, pummeled: 0 };
}

function endRound(state, api, winner, why) {
  const s = state.script;
  s.results.push({ round: s.round, winner, why });
  s.between = true;
  s.nextRoundAt = state.t + 4;
  const p = api.player(state);
  const foe = s.foe;
  if (p && p.alive) p.casting = null;
  if (foe.alive) foe.casting = null;
  api.banner(state, winner === 'player' ? `Round ${s.round}: yours` : `Round ${s.round}: Aldric’s`, why, 3.2, winner === 'player' ? 'good' : 'warn');
  // Learn from the round that just ended.
  const tr = s.track;
  const totalDmg = tr.petDmg + tr.myDmg;
  const next = {
    hardcast: tr.casts >= 3 && tr.castsInMelee / tr.casts > 0.35,
    ccOpen: tr.ccAtContact,
    kite: tr.chaseTime > 0 && tr.kiteTime / tr.chaseTime > 0.45,
    pet: totalDmg > 0 && tr.petDmg / totalDmg > 0.35,
    lateDefensives: tr.defLate > tr.defEarly,
  };
  s.adapt = next;
  const lines = [];
  if (next.hardcast) lines.push('Aldric keeps his distance, watching your hands.');
  if (next.ccOpen) lines.push('Aldric grins: “I know your opener now.”');
  if (next.kite) lines.push('Aldric stops chasing blindly — he will save Intercept for when your snares are gone.');
  if (next.pet) lines.push('Aldric eyes your pet first this time.');
  if (next.lateDefensives) lines.push('Aldric plans to go all-in earlier.');
  s.adaptLines = lines;
}

export const TRIAL = {
  id: 't4',
  order: 4,
  title: 'Battleground Duel',
  place: 'The stables of Thornfield Basin',
  level: 60,
  levels: [60],
  kind: 'pvp',
  blurb: 'Best of three against a Warrior who learns from every round — and tells you what he learned.',
  rolesFor: () => ['dps'],
  intro(classId) {
    return {
      text: 'A contested battleground node. Sergeant Aldric Vane guards the stables: a Mortal Strike Warrior with Charge, Intercept, Hamstring, Pummel, Intimidating Shout and a PvP trinket. Best of three rounds. Between rounds he adapts to how you played — and he says how.',
      goals: ['Win two rounds', 'A round ends at a death, or after 75 s on health percentage'],
      tips: [
        'Diminishing returns apply: the same kind of control lasts shorter each time.',
        'Pillars and crates block line of sight — for him as well as for you.',
        classId === 'priest' ? 'Fear Ward blocks his Intimidating Shout once.' : classId === 'mage' ? 'Blink breaks his stuns and roots; he will Pummel spells cast in his face.' : 'Your pet keeps him busy — he may decide to deal with it first.',
      ],
    };
  },
  arena: {
    w: 44, h: 30, theme: 'basin',
    obstacles: [
      { x: 16, y: 9, r: 1.6, kind: 'pillar' }, { x: 16, y: 21, r: 1.6, kind: 'pillar' }, { x: 28, y: 9, r: 1.6, kind: 'pillar' },
      { x: 28, y: 21, r: 1.6, kind: 'pillar' }, { x: 22, y: 19.5, r: 1.3, kind: 'crate' },
    ],
    decor: [{ kind: 'node', x: 22, y: 15 }, { kind: 'label', x: 22, y: 3, text: 'Stables', size: 1 }, { kind: 'banner', x: 41, y: 4, color: '#2a5aa8' }, { kind: 'banner', x: 3, y: 26, color: '#8a1d1d' }],
  },
  flags: { pvpDR: true },
  hud: { party: false, meters: true, timer: true, threat: false },
  setup(state, api) {
    spawnPlayer(state, api, START.player);
    const foe = api.spawnUnit(state, 't4.aldric', { ...START.foe });
    state.script.foe = foe;
    state.script.round = 1;
    state.script.results = [];
    state.script.adapt = {};
    state.script.roundStart = 2;
    state.script.between = true;
    state.script.nextRoundAt = 2;
    resetRound(state, api);
    api.banner(state, 'Round 1', 'Sergeant Aldric Vane draws his greatsword.', 2, 'info');
  },
  onTick(state, api, dt) {
    const s = state.script;
    const p = api.player(state);
    const foe = s.foe;
    const ev = freshEvents(state);
    foe.immune.damage = !!s.between;
    if (p) p.immune.damage = !!s.between;
    if (s.between) {
      if (state.t >= s.nextRoundAt && s.results.length < 3 && !decided(s)) {
        if (s.results.length) { s.round = s.results.length + 1; resetRound(state, api); }
        s.between = false;
        s.roundStart = state.t;
        api.engage(state, foe, p);
        marker(state, api, 'danger', `Round ${s.round}`);
        if (s.round > 1) {
          api.banner(state, `Round ${s.round}`, (s.adaptLines && s.adaptLines[0]) || 'Aldric resets his stance.', 3.2, 'info');
          for (const l of s.adaptLines || []) api.say(state, foe, l, 'emote');
          if (s.adapt.hardcast) openWindow(state, api, 'counterplay', 'pummel' + s.round, 'He will Pummel casts in melee', { since: state.t });
          if (s.adapt.kite) openWindow(state, api, 'counterplay', 'intercept' + s.round, 'He holds Intercept for your snares', { since: state.t });
          if (s.adapt.pet && p.petId) openWindow(state, api, 'counterplay', 'pet' + s.round, 'He goes for your pet', { since: state.t });
          if (s.adapt.lateDefensives) openWindow(state, api, 'counterplay', 'reck' + s.round, 'Early Recklessness', { since: state.t });
        }
      }
      return;
    }
    // --- observe the player this round (for next round's adaptation)
    const tr = s.track;
    const dist = G.dist(p, foe);
    if (dist < 7 && tr.contactAt == null) tr.contactAt = state.t;
    if (!foe.cc.stun && !foe.cc.incap && !foe.cc.fear) { tr.chaseTime += dt; if (dist > 8) tr.kiteTime += dt; }
    for (const e of ev) {
      if (e.type === 'castStart' && e.src === p.id && e.castTime > 0) { tr.casts++; if (dist < 7) tr.castsInMelee++; }
      if (e.type === 'auraApply' && e.dst === foe.id && e.cc && (e.src === p.id || e.src === p.petId)) {
        if (tr.contactAt != null && state.t - tr.contactAt < 4 && !s.firstCc) { tr.ccAtContact = true; }
        s.firstCc = true;
      }
      if (e.type === 'immune' && e.dst === foe.id && e.aura && s.windows && s.windows['bait' + s.round] && s.windows['bait' + s.round].open) resolveWindow(state, api, 'bait' + s.round, false, null);
      if (e.type === 'auraFade' && e.dst === foe.id && e.aura === 't4.brage' && s.windows && s.windows['bait' + s.round] && s.windows['bait' + s.round].open) resolveWindow(state, api, 'bait' + s.round, true, p.id);
      if (e.type === 'auraFade' && e.dst === foe.id && e.cc && (Array.isArray(e.cc) ? e.cc.includes('root') : e.cc === 'root')) s.lastRootBreak = state.t;
      if (e.type === 'damage' && e.dst === foe.id) { if (e.src === p.petId) tr.petDmg += e.amount; else if (e.src === p.id) tr.myDmg += e.amount; }
      if (e.type === 'interrupt' && e.src === foe.id) tr.pummeled++;
      if (e.type === 'damage' && e.ability === 't4.retal') tr.retalHits = (tr.retalHits || 0) + 1;
      if (e.type === 'cast' && e.src === p.id && e.cat === 'defensive') { if (p.hp / p.maxHp > 0.6) tr.defEarly++; else tr.defLate++; }
    }
    // PvP trinket: breaks a long control effect once per round (saved for long CC when he learned your opener).
    if (!s.trinketAt || state.t - s.trinketAt >= 120) {
      // Like a real warrior: the trinket is for sheep, fear and long stuns — never for a root.
      const cc = foe.auras.filter((a) => a.def.cc && a.def.debuff && ['stun', 'incap', 'fear'].some((c) => [].concat(a.def.cc).includes(c)));
      const long = cc.find((a) => a.remaining > (s.adapt.ccOpen ? 5 : 3));
      if (long && state.t - long.appliedAt > 0.8) {
        s.trinketAt = state.t;
        for (const a of cc) api.removeAura(state, foe, a, 'trinket');
        api.say(state, foe, 'Aldric breaks free with his Insignia!', 'emote');
      }
    }
    // --- round end
    const elapsed = state.t - s.roundStart;
    if (!p.alive) endRound(state, api, 'foe', 'You fell.');
    else if (!foe.alive) endRound(state, api, 'player', 'Aldric is down.');
    else if (elapsed >= ROUND_SECONDS) {
      const ph = p.hp / p.maxHp;
      const fh = foe.hp / foe.maxHp;
      endRound(state, api, ph >= fh ? 'player' : 'foe', `Time: ${Math.round(ph * 100)} % vs ${Math.round(fh * 100)} % health.`);
    }
    if (s.between) {
      // Close counterplay windows from the round that just ended.
      const won = s.results[s.results.length - 1].winner === 'player';
      for (const w of Object.values(s.windows || {})) {
        if (!w.open || w.kind !== 'counterplay') continue;
        if (w.id.startsWith('pummel')) resolveWindow(state, api, w.id, s.track.pummeled <= 1, p.id);
        else if (w.id.startsWith('retal')) resolveWindow(state, api, w.id, (s.track.retalHits || 0) <= 3, p.id);
        else if (w.id.startsWith('pet')) resolveWindow(state, api, w.id, !!(p.petId && api.U(state, p.petId) && api.U(state, p.petId).alive), p.id);
        else resolveWindow(state, api, w.id, won, p.id);
      }
    }
  },
  objectives(state) {
    const s = state.script;
    const out = [1, 2, 3].map((n) => {
      const r = s.results.find((x) => x.round === n);
      return { text: `Round ${n}`, progress: r ? (r.winner === 'player' ? 'won' : 'lost') : n === s.round && !s.between ? `${Math.max(0, Math.ceil(ROUND_SECONDS - (state.t - s.roundStart)))} s left` : '—', done: !!(r && r.winner === 'player') };
    });
    return out;
  },
  checkOutcome(state) {
    const s = state.script;
    const w = s.results.filter((r) => r.winner === 'player').length;
    const l = s.results.filter((r) => r.winner === 'foe').length;
    if (w >= 2 && s.between) return { result: 'victory', reason: `You won the duel ${w}–${l}.` };
    if (l >= 2 && s.between) return { result: 'defeat', reason: `Aldric won the duel ${l}–${w}.` };
    return null;
  },
  summary(state) {
    const s = state.script;
    const lines = s.results.map((r) => ({ label: `Round ${r.round}`, value: `${r.winner === 'player' ? 'Won' : 'Lost'} — ${r.why}` }));
    const st = windowStats(state, 'counterplay');
    if (st.total) lines.push({ label: 'His adaptations beaten', value: `${st.ok}/${st.total}` });
    lines.push({ label: 'His trinket', value: s.trinketAt ? `used at ${Math.round(s.trinketAt)} s` : 'never needed' });
    const adapt = Object.entries(s.adapt || {}).filter(([, v]) => v).map(([k]) => ({ hardcast: 'Pummel watch', ccOpen: 'Opener baited', kite: 'Intercept held', pet: 'Pet first', lateDefensives: 'Early burst' })[k]);
    if (adapt.length) lines.push({ label: 'What he learned last', value: adapt.join(', ') });
    return lines;
  },
};

function decided(s) {
  const w = s.results.filter((r) => r.winner === 'player').length;
  const l = s.results.filter((r) => r.winner === 'foe').length;
  return w >= 2 || l >= 2;
}
