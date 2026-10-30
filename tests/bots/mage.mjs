// Mage bot policies: competent (uses the class the way guides describe) and careless.
import * as G from '../../src/engine/geometry.js';
import { hpPct, resPct } from '../../src/engine/core.js';
import {
  escapePoint,
  pickTarget,
  approach,
  backOff,
  meleeOn,
  restIfNeeded,
  dodge,
  potions,
  dispelTarget,
  busy,
  tryCast,
  carelessPolicy,
  findAura,
  ccBreakable,
  interruptTarget,
  threatHigh,
  tankOf,
  holdRangedSpot,
} from './common.mjs';

export function competent({ level, spec } = {}) {
  const mem = { pulled: false };
  return (state, ctl) => {
    const me = ctl.me();
    if (!me || !me.alive) return;
    if (dodge(state, ctl)) return;
    if (restIfNeeded(state, ctl)) return;
    potions(state, ctl);
    const t = pickTarget(state, ctl);
    if (!t) return;
    if (me.target !== t.id) ctl.target(t.id);
    const mana = resPct(me, 'mana');
    const hp = hpPct(me);
    const close = meleeOn(state, ctl);
    const tal = (me.meta && me.meta.talents) || {};

    // Emergencies (off the GCD where possible).
    if (hp < 0.25 && ctl.can('mage.iceblock')) {
      ctl.cast('mage.iceblock');
      return;
    }
    if (findAura(me, 'mage.iceblock')) return;
    const kick = interruptTarget(state, ctl, 30);
    if (kick && ctl.can('mage.counterspell', { targetId: kick.id })) ctl.cast('mage.counterspell', { targetId: kick.id });
    if (busy(me)) return;
    // Raid threat: ease off (the tank needs a moment) — Ice Block if it already turned on us.
    const hot = threatHigh(state, ctl);
    if (hot) {
      if (hot.target === me.id && ctl.can('mage.iceblock')) ctl.cast('mage.iceblock');
      return;
    }

    // Control: second attacker gets sheeped; anything in melee gets frozen, then we step back.
    const engaged = ctl.engaged().filter((e) => !ccBreakable(e));
    if (engaged.length >= 2) {
      const grouped = !!tankOf(state, me);
      const extra = engaged.find(
        (e) => e !== t && (e.tags || []).some((x) => x === 'beast' || x === 'humanoid') && !e.cc.incap && e.kind !== 'boss' && (!grouped || e.target === me.id),
      );
      if (extra && ctl.can('mage.poly', { targetId: extra.id }) && !state.list.some((x) => findAura(x, 'mage.poly'))) {
        ctl.cast('mage.poly', { targetId: extra.id });
        return;
      }
    }
    // Kiting: freeze or slow what is in melee, step away, cast while it walks.
    const held = (e) => e.cc.root || e.cc.incap || e.cc.stun;
    const slowed = (e) => held(e) || e.cc.slow >= 0.4;
    if (close.length) {
      if (!close.every(held) && ctl.can('mage.nova')) {
        ctl.cast('mage.nova');
        return;
      }
      if (!close.every(held) && !ctl.can('mage.nova') && t.kind === 'opponent' && ctl.can('mage.coldsnap')) {
        ctl.cast('mage.coldsnap');
        return;
      }
      // Frozen in place: Blink clear (walking out of a Hamstring is too slow).
      if (close.every(held) && ctl.can('mage.blink') && (t.kind === 'opponent' || hp < 0.7)) {
        me.facing = G.angleTo(me, escapePoint(state, ctl, close[0], 20));
        me.move.dir = null;
        me.move.to = null;
        ctl.cast('mage.blink');
        return;
      }
      if (!close.every(slowed) && level >= 30 && ctl.can('mage.cone')) {
        ctl.cast('mage.cone');
        return;
      }
      if (hp < 0.55 && ctl.can('mage.manashield') && !findAura(me, 'mage.manashield')) {
        ctl.cast('mage.manashield');
        return;
      }
      if (hp < 0.45 && !close.every(slowed) && ctl.can('mage.blink')) {
        me.facing = G.angleTo(me, escapePoint(state, ctl, close[0], 20));
        me.move.dir = null;
        me.move.to = null;
        ctl.cast('mage.blink');
        return;
      }
      if (close.every(held) && !me.cc.root && G.dist(me, close[0]) < 8) {
        backOff(state, ctl, close[0], 10);
        return;
      }
      if (hp < 0.6 && close.every(slowed) && !me.cc.root) {
        backOff(state, ctl, close[0], 12);
        return;
      }
      // Cannot get away: fight with instants rather than pushed-back casts.
      const c = close[0];
      if (
        tryCast(ctl, [
          ['mage.icelance', { targetId: c.id }, c.cc.frozen || !!findAura(me, 'mage.fof')],
          ['mage.fireblast', { targetId: c.id }],
          ['mage.ae', undefined, close.length >= 2],
        ])
      )
        return;
    }

    // Hurt and something is closing in: keep the gap.
    const chaser = ctl.engaged().find((e) => e.target === me.id && G.dist(e, me) < 9 && !held(e));
    if (hp < 0.6 && chaser && !me.cc.root && !close.length) {
      backOff(state, ctl, chaser, 10);
      return;
    }

    // Decurse allies.
    const cursed = dispelTarget(state, ctl, ['curse', 'bane']);
    if (cursed && ctl.can('mage.decurse', { targetId: cursed.id })) {
      ctl.cast('mage.decurse', { targetId: cursed.id });
      return;
    }

    // Mana.
    if (mana < 0.4 && ctl.can('mage.gem')) ctl.cast('mage.gem');
    if (mana < 0.12 && !close.length && ctl.can('mage.evocation')) {
      ctl.cast('mage.evocation');
      return;
    }
    if (level >= 60 && spec === 'frost' && !findAura(me, 'mage.icebarrier') && ctl.can('mage.icebarrier')) {
      ctl.cast('mage.icebarrier');
      return;
    }

    if (holdRangedSpot(state, ctl)) return;
    if (approach(state, ctl, t, level >= 30 ? 29 : 27)) return;

    const opts = { targetId: t.id };
    const frozen = t.cc.frozen || !!findAura(me, 'mage.fof');
    const hu = findAura(me, 'mage.hu');
    const lowMana = mana < (level === 10 ? 0.18 : 0.08);
    if (lowMana && !me.autoRanged && me.ab['mage.wand']) {
      ctl.cast('mage.wand');
      return;
    }
    if (lowMana) return;

    if (level === 10) {
      tryCast(ctl, [
        ['mage.fireblast', opts, hpPct(t) < 0.35 || mana > 0.6],
        ['mage.frostbolt', opts],
      ]);
      return;
    }
    const aoe = engaged.filter((e) => G.dist(e, me) <= 10).length >= 3;
    if (aoe && ctl.can('mage.ae')) {
      ctl.cast('mage.ae');
      return;
    }
    // Three or more enemies bunched up somewhere else (adds on the healer): ground AoE.
    const clump = engaged.find((e) => e.kind !== 'boss' && engaged.filter((o) => o.kind !== 'boss' && G.dist(o, e) < 7).length >= 3);
    if (clump && G.dist(me, clump) < 30) {
      const near = engaged.filter((o) => G.dist(o, clump) < 7);
      const c = near.reduce((a, o) => ({ x: a.x + o.x / near.length, y: a.y + o.y / near.length }), { x: 0, y: 0 });
      const ground = spec === 'fire' || spec === 'frostfire' ? 'mage.flamestrike' : 'mage.blizzard';
      if (ctl.can(ground, { point: c })) {
        ctl.cast(ground, { point: c });
        return;
      }
    }
    if (spec === 'fire') {
      if (!mem.combusted && level >= 60 && ctl.can('mage.combustion')) {
        ctl.cast('mage.combustion');
        mem.combusted = true;
      }
      const isc = findAura(t, 'mage.isc', me.id);
      tryCast(ctl, [
        ['mage.pyro', opts, !!hu && hu.stacks >= 3],
        ['mage.pyro', opts, !t.engaged && !mem.pulled],
        ['mage.fireblast', opts],
        ['mage.scorch', opts, tal.impScorch && (!isc || isc.stacks < 5 || isc.remaining < 6) && t.maxHp > me.maxHp],
        ['mage.fireball', opts],
      ]);
    } else if (spec === 'arcane') {
      const st = findAura(me, 'mage.abstack');
      const stacks = st ? st.stacks : 0;
      if (level >= 60 && t.maxHp > me.maxHp * 2 && ctl.can('mage.apower')) {
        ctl.cast('mage.apower');
      }
      tryCast(ctl, [
        ['mage.missiles', opts, !!findAura(me, 'mage.mb')],
        ['mage.awrath', opts],
        ['mage.ablast', opts, stacks < (mana > 0.5 ? 3 : 1)],
        ['mage.fireblast', opts],
        ['mage.missiles', opts, mana > 0.35],
        ['mage.frostbolt', opts],
      ]);
    } else if (spec === 'frostfire') {
      if (!mem.combusted && ctl.can('mage.combustion')) {
        ctl.cast('mage.combustion');
        mem.combusted = true;
      }
      tryCast(ctl, [
        ['mage.icelance', opts, frozen],
        ['mage.pyro', opts, !!hu && hu.stacks >= 3],
        ['mage.fireblast', opts],
        ['mage.ffb', opts],
      ]);
    } else {
      const wc = findAura(t, 'mage.wc', me.id);
      tryCast(ctl, [
        ['mage.icelance', opts, frozen],
        ['mage.cone', undefined, level >= 60 && wc && wc.stacks >= 5 && G.dist(me, t) < 10],
        ['mage.missiles', opts, level >= 60 && !!findAura(me, 'mage.mb')],
        ['mage.ablast', opts, level >= 60 && !findAura(me, 'mage.abstack')],
        ['mage.frostbolt', opts],
      ]);
    }
    mem.pulled = true;
  };
}

export function careless({ level, spec } = {}) {
  const filler =
    level === 10 ? 'mage.frostbolt' : { frost: 'mage.frostbolt', fire: 'mage.fireball', arcane: 'mage.ablast', frostfire: 'mage.ffb' }[spec || 'frost'];
  return carelessPolicy(filler, 28);
}
