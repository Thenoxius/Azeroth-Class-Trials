// Behaviour tracker. Consumes engine events (every frame) and UI events and
// produces a SessionRecord (see SPEC.md). Gameplay state is never written here;
// this only observes. Plain JS so node tests can drive it too.

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const BUCKET = 15;

export function createTracker(meta) {
  const rec = {
    version: 1,
    id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    ...meta,
    startedAt: new Date().toISOString(),
    realMs: 0,
    pausedMs: 0,
    autoPausedMs: 0,
    simSeconds: 0,
    combatSeconds: 0,
    outcome: null,
    abandoned: false,
    abilities: {},
    categories: {},
    tags: {},
    casts: 0,
    castsCancelledByMove: 0,
    castsInterruptedByEnemy: 0,
    errors: {},
    gcd: { activeSeconds: 0, idleSeconds: 0, utilization: 0, buckets: [] },
    movement: { yards: 0, moveOrders: 0, movingSeconds: 0 },
    pet: {
      present: false,
      commands: { attack: 0, follow: 0, stay: 0, aggressive: 0, defensive: 0, passive: 0, ability: 0, autocast: 0 },
      manualAbilities: 0,
      autocastToggles: 0,
      deaths: 0,
      mendPetCasts: 0,
      damageShare: 0,
    },
    control: { uses: 0, targets: 0, brokenBySelf: 0 },
    defensive: { uses: 0, timely: 0 },
    interrupts: { attempts: 0, success: 0 },
    dispels: { attempts: 0, success: 0 },
    resource: { restCount: 0, restStarts: [], restSeconds: 0, oomSeconds: 0, lowResSeconds: 0, potions: { heal: 0, mana: 0 }, endResPct: null },
    danger: [],
    mechanics: [],
    healing: { done: 0, overheal: 0, overhealPct: 0, onTank: 0, onOthers: 0, onSelf: 0, frameTargets: 0 },
    damage: { done: 0, petDone: 0, taken: 0, deaths: 0, autoRepeat: 0 },
    ui: { pauses: 0, pauseSeconds: 0, autoPauses: 0, speedSeconds: {}, autopilotSeconds: 0, autopilotCasts: 0, tooltips: 0, targeting: 0 },
    moments: [],
    firstActionAt: null,
  };
  // Working state (not stored).
  let lastReal = now();
  let paused = false;
  let autoPaused = false;
  let speed = 1;
  let lastT = 0;
  let lastPos = null;
  let combatStartAt = null;
  let bucket = { t0: 0, active: 0, total: 0 };
  const ccTargets = new Set();
  const openDanger = [];
  const openMech = {};
  const momentList = [];
  let biggestCrit = null;
  let biggestHeal = null;
  const ccBurst = {}; // ability@t -> count of targets controlled by one cast

  function moment(t, kind, system, text, weight = 1) {
    momentList.push({ t, kind, system, text, weight });
  }
  const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  return {
    rec,
    ingest(events, state) {
      const n = now();
      const d = n - lastReal;
      lastReal = n;
      if (paused) {
        rec.pausedMs += d;
        if (autoPaused) rec.autoPausedMs += d;
      } else rec.realMs += d;
      const p = state.units[state.playerId];
      const pid = state.playerId;
      const petId = p ? p.petId : null;
      const mine = (id) => id === pid || id === petId || (id && state.units[id] && state.units[id].ownerId === pid);
      const dt = Math.max(0, state.t - lastT);
      lastT = state.t;
      rec.simSeconds = state.t;
      if (p && p.petId) rec.pet.present = true;
      // --- time-sampled facts
      if (dt > 0 && p) {
        if (!paused) rec.ui.speedSeconds[speed] = (rec.ui.speedSeconds[speed] || 0) + dt;
        if (p.moving) rec.movement.movingSeconds += dt;
        if (lastPos) rec.movement.yards += Math.hypot(p.x - lastPos.x, p.y - lastPos.y);
        lastPos = { x: p.x, y: p.y };
        if (state.combat && p.alive) {
          rec.combatSeconds += dt;
          if (combatStartAt == null) combatStartAt = state.t;
          const active = !!p.casting || p.gcd > 0.01 || (p.autoRanged && p.ranged && p.ranged.kind === 'autoshot');
          if (active) rec.gcd.activeSeconds += dt;
          else rec.gcd.idleSeconds += dt;
          bucket.total += dt;
          if (active) bucket.active += dt;
          if (bucket.total >= BUCKET) {
            rec.gcd.buckets.push({ t0: Math.round(bucket.t0), util: +(bucket.active / bucket.total).toFixed(3) });
            bucket = { t0: rec.combatSeconds, active: 0, total: 0 };
          }
          const m = p.res.mana;
          if (m) {
            const pct = m.cur / m.max;
            if (pct < 0.05) rec.resource.oomSeconds += dt;
            if (pct < 0.2) rec.resource.lowResSeconds += dt;
          }
          if (p.flags.autopilot) rec.ui.autopilotSeconds += dt;
        }
        if (p.casting && p.casting.id === 'item.rest') rec.resource.restSeconds += dt;
      }
      // --- events
      for (const e of events) {
        const t = e.t;
        switch (e.type) {
          case 'castStart':
            if (e.src === pid && e.ability === 'item.rest') {
              rec.resource.restCount++;
              rec.resource.restStarts.push({
                hp: p ? +(p.hp / p.maxHp).toFixed(2) : null,
                res: p && p.res.mana ? +(p.res.mana.cur / p.res.mana.max).toFixed(2) : null,
              });
            }
            break;
          case 'cast': {
            if (e.src !== pid) break;
            const ab = p && p.ab[e.ability];
            rec.casts++;
            rec.abilities[e.ability] = (rec.abilities[e.ability] || 0) + 1;
            if (e.cat) rec.categories[e.cat] = (rec.categories[e.cat] || 0) + 1;
            for (const tg of e.tags || []) rec.tags[tg] = (rec.tags[tg] || 0) + 1;
            if (rec.firstActionAt == null && state.combat && e.ability !== 'item.rest') rec.firstActionAt = combatStartAt != null ? t - combatStartAt : 0;
            const cat = e.cat;
            const tags = e.tags || [];
            if (cat === 'control' || tags.includes('control')) rec.control.uses++;
            if (cat === 'defensive' || tags.includes('defensive')) {
              rec.defensive.uses++;
              const recentDanger = rec.danger.some((x) => t - x.at < 4);
              if ((p && p.hp / p.maxHp < 0.6) || recentDanger) rec.defensive.timely++;
            }
            if (cat === 'interrupt' || tags.includes('interrupt')) rec.interrupts.attempts++;
            if (cat === 'dispel' || tags.includes('dispel')) rec.dispels.attempts++;
            if (e.ability === 'hunter.mendpet') rec.pet.mendPetCasts++;
            if (e.ability === 'item.healpot') rec.resource.potions.heal++;
            if (e.ability === 'item.manapot') rec.resource.potions.mana++;
            // First answer to an unexpected threat.
            for (const dg of openDanger) {
              if (dg.firstAbility || t - dg.at > 12) continue;
              dg.firstAbility = e.ability;
              dg.firstCategory = cat || (ab && ab.category) || null;
              dg.latency = +(t - dg.at).toFixed(2);
            }
            break;
          }
          case 'castStop':
            if (e.src === pid && e.reason === 'moved') rec.castsCancelledByMove++;
            break;
          case 'interrupt':
            if (e.dst === pid) rec.castsInterruptedByEnemy++;
            if (mine(e.src)) {
              rec.interrupts.success++;
              moment(t, 'interrupt', 'utility', `${clock(t)}: you interrupted ${name(state, e.dst)}`, 1.2);
            }
            break;
          case 'dispel':
            if (mine(e.src)) {
              rec.dispels.success++;
              moment(
                t,
                'dispel',
                'teamplay',
                `${clock(t)}: you removed ${e.aura ? prettyAura(state, e) : 'a debuff'} from ${e.dst === pid ? 'yourself' : name(state, e.dst)}`,
                0.8,
              );
            }
            break;
          case 'error':
            if (e.src === pid) rec.errors[e.reason] = (rec.errors[e.reason] || 0) + 1;
            break;
          case 'moveOrder':
            if (e.src === pid) rec.movement.moveOrders++;
            break;
          case 'petCommand':
            if (e.src === pid) {
              if (rec.pet.commands[e.cmd] !== undefined) rec.pet.commands[e.cmd]++;
              if (e.cmd === 'ability') rec.pet.manualAbilities++;
              if (e.cmd === 'autocast') rec.pet.autocastToggles++;
            }
            break;
          case 'auraApply':
            if (mine(e.src) && e.cc && e.dst !== pid && e.dst !== petId) {
              ccTargets.add(e.dst);
              const k = e.ability + '@' + t.toFixed(2);
              ccBurst[k] = (ccBurst[k] || 0) + 1;
              if (ccBurst[k] === 2) moment(t, 'control', 'control', `${clock(t)}: ${abilityName(state, e.ability)} caught two enemies at once`, 1.4);
              else if (ccBurst[k] === 1 && (e.cc || []).some((c) => c === 'incap' || c === 'fear' || c === 'stun'))
                moment(t, 'control', 'control', `${clock(t)}: ${abilityName(state, e.ability)} took ${name(state, e.dst)} out of the fight`, 1);
            }
            break;
          case 'auraFade':
            if (e.reason === 'broken' && mine(e.src) && e.cc) rec.control.brokenBySelf++;
            break;
          case 'damage': {
            if (mine(e.src)) {
              rec.damage.done += e.amount;
              if (e.src === petId || (e.src !== pid && state.units[e.src] && state.units[e.src].ownerId === pid)) rec.damage.petDone += e.amount;
              if (e.src === pid && (e.ability === 'autoshot' || e.ability === 'wand')) rec.damage.autoRepeat += e.amount;
              if (e.crit && e.src === pid && !e.tick && (!biggestCrit || e.amount > biggestCrit.amount))
                biggestCrit = { t, amount: e.amount, ability: e.ability };
            }
            if (e.dst === pid) rec.damage.taken += e.amount;
            break;
          }
          case 'heal':
            if (e.src === pid) {
              rec.healing.done += e.amount;
              rec.healing.overheal += e.overheal || 0;
              const dst = state.units[e.dst];
              if (e.dst === pid) rec.healing.onSelf += e.amount;
              else if (dst && dst.role === 'tank') rec.healing.onTank += e.amount;
              else rec.healing.onOthers += e.amount;
              if (!e.tick && (!biggestHeal || e.amount > biggestHeal.amount) && e.amount > 0)
                biggestHeal = { t, amount: e.amount, ability: e.ability, dst: e.dst };
            }
            break;
          case 'target':
            if (e.src === pid && state.units[e.dst] && state.units[e.dst].side === (p && p.side)) rec.healing.frameTargets++;
            break;
          case 'death':
            if (e.dst === pid) rec.damage.deaths++;
            if (e.dst === petId) rec.pet.deaths++;
            if (e.src && mine(e.src) && state.units[e.dst] && state.units[e.dst].kind === 'boss')
              moment(t, 'kill', 'burst', `${clock(t)}: you landed the killing blow on ${name(state, e.dst)}`, 1.5);
            break;
          case 'evade':
            if (p && p.flags.feigned) moment(t, 'feign', 'utility', `${clock(t)}: Feign Death made ${name(state, e.src)} give up`, 1.2);
            break;
          case 'autopilotCast':
            if (e.src === pid) rec.ui.autopilotCasts++;
            break;
          case 'marker':
            if (e.key === 'danger') {
              const dg = { label: e.label, at: t, latency: null, firstCategory: null, firstAbility: null };
              rec.danger.push(dg);
              openDanger.push(dg);
            } else if (e.key === 'mechanic' && e.data) {
              openMech[e.data.id] = { kind: e.data.kind, id: e.data.id, label: e.label, at: t };
            } else if (e.key === 'mechanicResolved' && e.data) {
              const m = openMech[e.data.id] || { kind: e.data.kind, id: e.data.id, at: t };
              const by =
                e.data.by === pid ? 'you' : e.data.by && state.units[e.data.by] && state.units[e.data.by].ownerId === pid ? 'you' : e.data.by ? 'ally' : null;
              rec.mechanics.push({ kind: m.kind, id: m.id, ok: !!e.data.ok, by, latency: +(t - m.at).toFixed(2) });
              delete openMech[e.data.id];
            }
            break;
          default:
            break;
        }
      }
    },
    ui(type, data = {}) {
      if (type === 'pause') {
        if (!paused) {
          rec.ui.pauses++;
          if (data.why === 'hidden') {
            rec.ui.autoPauses++;
            autoPaused = true;
          }
        }
        paused = true;
      } else if (type === 'resume') {
        paused = false;
        autoPaused = false;
      } else if (type === 'speed') speed = data.speed;
      else if (type === 'tooltip') rec.ui.tooltips++;
      else if (type === 'targeting') rec.ui.targeting++;
    },
    finish(state, extra = {}) {
      if (bucket.total > 3) rec.gcd.buckets.push({ t0: Math.round(bucket.t0), util: +(bucket.active / bucket.total).toFixed(3) });
      const total = rec.gcd.activeSeconds + rec.gcd.idleSeconds;
      rec.gcd.utilization = total > 0 ? +(rec.gcd.activeSeconds / total).toFixed(3) : 0;
      rec.ui.pauseSeconds = +(rec.pausedMs / 1000).toFixed(1);
      rec.control.targets = ccTargets.size;
      rec.pet.damageShare = rec.damage.done > 0 ? +(rec.damage.petDone / rec.damage.done).toFixed(3) : 0;
      rec.healing.overhealPct =
        rec.healing.done + rec.healing.overheal > 0 ? +(rec.healing.overheal / (rec.healing.done + rec.healing.overheal)).toFixed(3) : 0;
      const p = state.units[state.playerId];
      if (p && p.res.mana) rec.resource.endResPct = +(p.res.mana.cur / p.res.mana.max).toFixed(3);
      rec.outcome = extra.abandoned ? 'abandoned' : state.outcome ? state.outcome.result : 'abandoned';
      rec.abandoned = !!extra.abandoned;
      rec.endedAt = new Date().toISOString();
      // Highlight candidates for the optional feedback question.
      const clockT = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
      if (biggestCrit)
        momentList.push({
          t: biggestCrit.t,
          kind: 'crit',
          system: biggestCrit.ability === 'autoshot' ? 'rotation' : 'burst',
          text: `${clockT(biggestCrit.t)}: a ${Math.round(biggestCrit.amount)} critical ${abilityName(state, biggestCrit.ability)}`,
          weight: 1.1,
        });
      if (biggestHeal && biggestHeal.amount > 0)
        momentList.push({
          t: biggestHeal.t,
          kind: 'heal',
          system: 'healing',
          text: `${clockT(biggestHeal.t)}: a ${Math.round(biggestHeal.amount)} ${abilityName(state, biggestHeal.ability)} on ${biggestHeal.dst === state.playerId ? 'yourself' : name(state, biggestHeal.dst)}`,
          weight: 1,
        });
      if (rec.pet.present && rec.pet.damageShare > 0.25)
        momentList.push({
          t: state.t,
          kind: 'pet',
          system: 'pet',
          text: `Your pet dealt ${Math.round(rec.pet.damageShare * 100)} % of your damage`,
          weight: 1,
        });
      const dangerAnswered = rec.danger.find((d) => d.firstAbility && d.latency != null);
      if (dangerAnswered)
        momentList.push({
          t: dangerAnswered.at,
          kind: 'danger',
          system: systemOf(dangerAnswered.firstCategory),
          text: `${clockT(dangerAnswered.at)}: “${dangerAnswered.label}” — you answered with ${abilityName(state, dangerAnswered.firstAbility)}`,
          weight: 1.3,
        });
      if (rec.resource.restCount >= 2)
        momentList.push({ t: state.t, kind: 'rest', system: 'resource', text: `Sitting down to eat and drink ${rec.resource.restCount} times`, weight: 0.7 });
      const top = Object.entries(rec.abilities)
        .filter(([id]) => !id.startsWith('item.'))
        .sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] >= 8)
        momentList.push({ t: state.t, kind: 'rotation', system: 'rotation', text: `Casting ${abilityName(state, top[0])} ${top[1]} times`, weight: 0.8 });
      if (rec.outcome === 'escaped') momentList.push({ t: state.t, kind: 'escape', system: 'mobility', text: 'Getting away along the road', weight: 1.2 });
      // Keep a varied handful: best per system, then by weight.
      const seen = new Set();
      rec.moments = momentList
        .sort((a, b) => b.weight - a.weight)
        .filter((m) => (seen.has(m.system + m.kind) ? false : seen.add(m.system + m.kind)))
        .slice(0, 6)
        .map(({ t, kind, system, text }) => ({ t: +t.toFixed(1), kind, system, text }));
      return { ...rec, ...extra, abandoned: !!extra.abandoned };
    },
  };
}

function name(state, id) {
  const u = state.units[id];
  if (!u) return 'an enemy';
  return u.kind === 'player' ? 'yourself' : u.name;
}
function abilityName(state, id) {
  if (id === 'autoshot') return 'Auto Shot';
  if (id === 'wand') return 'wand shot';
  if (id === 'melee') return 'melee swing';
  const p = state.units[state.playerId];
  const ab = p && p.ab[id];
  if (ab) return ab.name;
  for (const u of state.list) if (u.ab && u.ab[id]) return u.ab[id].name;
  return id;
}
function prettyAura(state, e) {
  const u = state.units[e.dst];
  return (e.aura || '')
    .split('.')
    .pop()
    .replace(/^\w/, (c) => c.toUpperCase());
}
function systemOf(cat) {
  return (
    {
      control: 'control',
      defensive: 'defensive',
      movement: 'mobility',
      interrupt: 'utility',
      dispel: 'teamplay',
      pet: 'pet',
      heal: 'healing',
      utility: 'utility',
    }[cat] || 'rotation'
  );
}
