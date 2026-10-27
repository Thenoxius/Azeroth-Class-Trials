// Visual feedback derived from engine events: floating combat text, spell
// beams, rings, blink puffs, impact flashes, speech bubbles and red error text.
// Times are simulation seconds, so effects freeze while the game is paused.

const LIFE = { float: 1.25, beam: 0.28, ring: 0.55, puff: 0.45, flash: 0.32, heal: 0.8, bubble: 3.2, error: 1.6, cc: 1.4 };

export function createFx() {
  return { seq: 0, floaters: [], effects: [], bubbles: {}, errors: [], log: [] };
}

function add(list, item, max = 80) {
  list.push(item);
  if (list.length > max) list.splice(0, list.length - max);
}

export function ingestFx(fx, events, state) {
  const pid = state.playerId;
  const P = state.units[pid];
  const petId = P ? P.petId : null;
  const mine = (id) => id === pid || id === petId;
  const t = state.t;
  for (const e of events) {
    const dst = e.dst ? state.units[e.dst] : null;
    const src = e.src ? state.units[e.src] : null;
    switch (e.type) {
      case 'damage': {
        if (!dst) break;
        const fromMe = mine(e.src);
        const toMe = mine(e.dst);
        if (!fromMe && !toMe && !(dst.kind === 'boss' && src && src.side === 'player')) break;
        if (!fromMe && !toMe) break;
        const text = e.amount > 0 ? String(e.amount) + (e.crit ? '!' : '') : e.absorbed ? 'Absorb' : '0';
        add(fx.floaters, { id: ++fx.seq, x: dst.x, y: dst.y, t0: t, text, kind: toMe ? 'taken' : e.src === petId ? 'pet' : e.tick ? 'tick' : 'dealt', crit: e.crit, school: e.school, jitter: (fx.seq % 5) - 2 });
        if (e.absorbed && e.amount > 0 && toMe) add(fx.floaters, { id: ++fx.seq, x: dst.x, y: dst.y, t0: t + 0.05, text: `(${e.absorbed} absorbed)`, kind: 'absorb', jitter: 1 });
        break;
      }
      case 'heal': {
        if (!dst || e.amount <= 0) break;
        if (!mine(e.src) && !mine(e.dst)) break;
        if (e.tick && !mine(e.src)) break;
        add(fx.floaters, { id: ++fx.seq, x: dst.x, y: dst.y, t0: t, text: '+' + e.amount + (e.crit ? '!' : ''), kind: 'heal', crit: e.crit, jitter: (fx.seq % 5) - 2 });
        if (!e.tick) add(fx.effects, { id: ++fx.seq, type: 'heal', x: dst.x, y: dst.y, t0: t, dur: LIFE.heal, school: 'holy' });
        break;
      }
      case 'miss':
        if (dst && (mine(e.src) || mine(e.dst))) add(fx.floaters, { id: ++fx.seq, x: dst.x, y: dst.y, t0: t, text: e.resist ? 'Resist' : 'Miss', kind: 'miss', jitter: 0 });
        break;
      case 'immune':
        if (dst && (mine(e.src) || mine(e.dst))) add(fx.floaters, { id: ++fx.seq, x: dst.x, y: dst.y, t0: t, text: 'Immune', kind: 'miss', jitter: 0 });
        break;
      case 'interrupt':
        if (dst) {
          add(fx.floaters, { id: ++fx.seq, x: dst.x, y: dst.y, t0: t, text: 'Interrupted', kind: 'cc', jitter: 0 });
          add(fx.effects, { id: ++fx.seq, type: 'flash', x: dst.x, y: dst.y, t0: t, dur: LIFE.flash, school: 'arcane', r: 2.2 });
        }
        break;
      case 'dispel':
        if (dst) add(fx.floaters, { id: ++fx.seq, x: dst.x, y: dst.y, t0: t, text: 'Dispelled', kind: 'cc', jitter: 0 });
        break;
      case 'auraApply':
        if (dst && e.cc && e.name && (mine(e.src) || mine(e.dst) || dst.kind === 'boss')) add(fx.floaters, { id: ++fx.seq, x: dst.x, y: dst.y, t0: t, text: e.name, kind: 'cc', jitter: 0 });
        break;
      case 'auraFade':
        if (dst && e.cc && e.reason === 'broken' && e.name) add(fx.floaters, { id: ++fx.seq, x: dst.x, y: dst.y, t0: t, text: e.name + ' broke', kind: 'miss', jitter: 0 });
        break;
      case 'cast': {
        if (!src) break;
        const ab = src.ab && src.ab[e.ability];
        if (!ab) break;
        const school = ab.school || 'physical';
        const tgt = e.dst ? state.units[e.dst] : null;
        if (ab.fx === 'ring' || (ab.target === 'none' && !ab.fx && ab.effects && ab.effects.some((x) => x.aoe && x.aoe.center === 'self'))) {
          const r = ab.fxRadius || (ab.effects.find((x) => x.aoe) || { aoe: { radius: 8 } }).aoe.radius;
          add(fx.effects, { id: ++fx.seq, type: 'ring', x: src.x, y: src.y, t0: t, dur: LIFE.ring, school, r: typeof r === 'number' ? r : 8 });
        } else if (ab.fx === 'point' || (ab.target === 'point' && e.x != null)) {
          add(fx.effects, { id: ++fx.seq, type: 'ring', x: e.x ?? src.x, y: e.y ?? src.y, t0: t, dur: LIFE.ring, school, r: ab.fxRadius || 6 });
        } else if (tgt && tgt !== src && !ab.projectile && ab.fx !== 'none') {
          if (ab.mechanic === 'physical' && !ab.ranged) add(fx.effects, { id: ++fx.seq, type: 'flash', x: tgt.x, y: tgt.y, t0: t, dur: LIFE.flash, school, r: 1.3 });
          else add(fx.effects, { id: ++fx.seq, type: 'beam', x: src.x, y: src.y, x2: tgt.x, y2: tgt.y, t0: t, dur: LIFE.beam, school: ab.ranged && school === 'physical' ? 'arrow' : school });
        } else if (ab.fx === 'self' || (tgt === src && (ab.category === 'defensive' || ab.category === 'buff' || ab.category === 'cooldown'))) {
          add(fx.effects, { id: ++fx.seq, type: 'flash', x: src.x, y: src.y, t0: t, dur: LIFE.flash * 1.6, school, r: 2 });
        }
        break;
      }
      case 'teleport':
        if (e.mode === 'blink' || e.mode === 'back' || e.mode === 'toTarget') {
          add(fx.effects, { id: ++fx.seq, type: 'puff', x: e.fx, y: e.fy, t0: t, dur: LIFE.puff, school: 'arcane' });
          add(fx.effects, { id: ++fx.seq, type: 'puff', x: e.x, y: e.y, t0: t, dur: LIFE.puff, school: 'arcane' });
        }
        break;
      case 'impact':
        add(fx.effects, { id: ++fx.seq, type: 'flash', x: e.x, y: e.y, t0: t, dur: LIFE.flash, school: e.visual || 'arcane', r: 1.1 });
        break;
      case 'zoneTrigger': {
        const u = state.units[e.dst];
        if (u) add(fx.effects, { id: ++fx.seq, type: 'ring', x: u.x, y: u.y, t0: t, dur: LIFE.ring, school: e.visual === 'trap' ? 'frost' : e.visual || 'frost', r: 3 });
        break;
      }
      case 'say':
        if (e.src) fx.bubbles[e.src] = { text: e.text, t0: t, kind: e.kind };
        add(fx.log, { t, kind: e.kind === 'yell' ? 'yell' : 'say', text: (src ? src.name : '') + (e.kind === 'emote' ? ' ' : ': ') + e.text.replace(src ? src.name + ' ' : '', '') });
        break;
      case 'error':
        if (e.src === pid && e.text) add(fx.errors, { id: ++fx.seq, text: e.text, t0: t }, 3);
        break;
      default:
        break;
    }
    const line = logLine(e, state, mine);
    if (line) add(fx.log, line, 120);
  }
}

export function pruneFx(fx, t) {
  fx.floaters = fx.floaters.filter((f) => t - f.t0 < LIFE.float);
  fx.effects = fx.effects.filter((f) => t - f.t0 < f.dur);
  fx.errors = fx.errors.filter((f) => t - f.t0 < LIFE.error);
  for (const k of Object.keys(fx.bubbles)) if (t - fx.bubbles[k].t0 > LIFE.bubble) delete fx.bubbles[k];
}

export const FX_LIFE = LIFE;

function nm(state, id, mine) {
  if (!id) return 'Something';
  if (id === state.playerId) return 'You';
  const u = state.units[id];
  if (!u) return '?';
  return mine(id) ? 'Your ' + (u.kind === 'pet' ? 'pet' : u.name) : u.name;
}
function abName(state, srcId, abId) {
  if (!abId) return '';
  if (abId === 'melee') return 'melee';
  if (abId === 'autoshot') return 'Auto Shot';
  if (abId === 'wand') return 'Shoot';
  const u = state.units[srcId];
  const ab = u && u.ab && u.ab[abId];
  return ab ? ab.name : abId.split('.').pop();
}

function logLine(e, state, mine) {
  const t = state.t;
  switch (e.type) {
    case 'damage': {
      if (!mine(e.src) && !mine(e.dst) && !(state.units[e.dst] && state.units[e.dst].side === 'player' && e.amount > 0 && !e.tick)) return null;
      const who = nm(state, e.src, mine);
      const what = abName(state, e.src, e.ability);
      const tgt = e.dst === state.playerId ? 'you' : nm(state, e.dst, mine);
      const abs = e.absorbed ? ` (${e.absorbed} absorbed)` : '';
      return { t, kind: mine(e.dst) ? 'hurt' : mine(e.src) ? 'hit' : 'other', text: `${who}${what && what !== 'melee' ? ' ' + what : ''} ${e.crit ? 'crits' : 'hits'} ${tgt} for ${e.amount}${abs}${e.school && e.school !== 'physical' ? ' ' + e.school : ''}.` };
    }
    case 'heal':
      if (!mine(e.src) && !mine(e.dst)) return null;
      if (e.tick && e.amount === 0) return null;
      return { t, kind: 'heal', text: `${nm(state, e.src, mine)} ${abName(state, e.src, e.ability)} heals ${e.dst === state.playerId ? 'you' : nm(state, e.dst, mine)} for ${e.amount}${e.overheal ? ` (${e.overheal} over)` : ''}.` };
    case 'interrupt':
      return { t, kind: 'cc', text: `${nm(state, e.src, mine)} interrupted ${nm(state, e.dst, mine)}'s ${abName(state, e.dst, e.interrupted)}.` };
    case 'death':
      return { t, kind: 'death', text: `${nm(state, e.dst, mine)} ${e.dst === state.playerId ? 'die' : 'dies'}.` };
    case 'auraApply':
      if (!e.cc || !e.name) return null;
      return { t, kind: 'cc', text: `${nm(state, e.dst, mine)} ${e.dst === state.playerId ? 'are' : 'is'} afflicted by ${e.name}.` };
    case 'dispel':
      return { t, kind: 'heal', text: `${nm(state, e.src, mine)} removed ${e.aura.split('.').pop()} from ${nm(state, e.dst, mine)}.` };
    case 'evade':
      return { t, kind: 'other', text: `${nm(state, e.src, mine)} evades and returns home.` };
    case 'flee':
      return null;
    case 'aggro':
      if (!state.units[e.src] || state.units[e.src].side !== 'enemy') return null;
      return { t, kind: 'aggro', text: `${nm(state, e.src, mine)} attacks ${e.dst === state.playerId ? 'you' : nm(state, e.dst, mine)}!` };
    default:
      return null;
  }
}
