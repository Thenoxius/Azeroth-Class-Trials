// Hunter bot policies: competent (pet control, traps, kiting) and careless.
import * as G from '../../src/engine/geometry.js';
import { hpPct, resPct } from '../../src/engine/core.js';
import { pickTarget, approach, backOff, meleeOn, restIfNeeded, dodge, potions, busy, tryCast, findAura, carelessPolicy, interruptTarget, tankOf, threatHigh, holdRangedSpot } from './common.mjs';

export function competent({ level, spec } = {}) {
  const mem = { lastPetCmd: -9 };
  return (state, ctl) => {
    const me = ctl.me();
    if (!me || !me.alive) return;
    const pet = ctl.pet();
    if (findAura(me, 'hunter.fd') && !ctl.inDanger()) {
      // Lie still until nobody is after us any more (but never in fire: moving ends the feign).
      if (!ctl.engaged().some((e) => e.target === me.id) && state.t - mem.fdAt > 2.5) ctl.moveTo(me.x + 0.4, me.y);
      return;
    }
    if (dodge(state, ctl)) return;
    // Pet upkeep out of combat.
    if (!ctl.engaged().length) {
      if (pet && !pet.alive && ctl.can('hunter.revive')) { ctl.stop(); ctl.cast('hunter.revive'); return; }
      if (pet && pet.alive && hpPct(pet) < 0.6 && ctl.can('hunter.mendpet') && !me.casting) { ctl.stop(); ctl.cast('hunter.mendpet'); return; }
      if (me.casting && me.casting.id === 'hunter.mendpet') return;
    }
    if (restIfNeeded(state, ctl, 0.45)) return;
    potions(state, ctl);
    const t = pickTarget(state, ctl);
    if (!t) return;
    if (me.target !== t.id) ctl.target(t.id);
    const hp = hpPct(me);
    const mana = resPct(me, 'mana');
    const close = meleeOn(state, ctl);
    const sv = spec === 'sv' && level >= 30;
    const opts = { targetId: t.id };

    // Groups: Growl off, so the pet does not steal the tank's mobs.
    const tank = tankOf(state, me);
    if (tank && pet && pet.autocast['pet.growl']) ctl.petAuto('pet.growl');
    // Retaliation up: pull the pet back and stop meleeing.
    const retal = !!findAura(t, 't4.retal');
    if (retal && pet && pet.alive && pet.petCmd !== 'follow') { ctl.petCmd('follow'); mem.lastPetCmd = state.t; }
    if (retal) me.autoMelee = false;
    // Pet on our target.
    if (!retal && pet && pet.alive && pet.target !== t.id && state.t - mem.lastPetCmd > 1.5) { ctl.petCmd('attack', t.id); mem.lastPetCmd = state.t; }
    // Emergencies.
    const many = ctl.engaged().filter((e) => e.target === me.id).length;
    if (hp < 0.3 && many >= 1 && pet && pet.alive && ctl.can('hunter.feign')) { ctl.stopCasting(); ctl.stop(); ctl.cast('hunter.feign'); mem.fdAt = state.t; return; }
    const kick = interruptTarget(state, ctl, 15);
    if (kick) {
      if (pet && pet.alive && G.dist(pet, kick) < 6 && ctl.can('hunter.intimidation')) ctl.cast('hunter.intimidation');
      else if (ctl.can('hunter.scatter', { targetId: kick.id })) { ctl.cast('hunter.scatter', { targetId: kick.id }); return; }
    }
    if (t.auras.some((a) => a.def.dispel === 'enrage' && !a.def.debuff) && ctl.can('hunter.tranq', opts)) { ctl.cast('hunter.tranq', opts); return; }
    if (busy(me)) return;
    // Raid threat: Feign Death drops it all.
    if (threatHigh(state, ctl) && ctl.can('hunter.feign')) { ctl.stop(); ctl.cast('hunter.feign'); mem.fdAt = state.t; return; }
    if (pet && pet.alive && hpPct(pet) < 0.35 && ctl.can('hunter.mendpet') && !close.length) { ctl.cast('hunter.mendpet'); return; }

    // A second attacker coming for us: trap it.
    const chaser = ctl.engaged().find((e) => e !== t && e.target === me.id && G.dist(e, me) < 14 && !e.cc.incap);
    if (chaser && ctl.can('hunter.freezetrap')) { ctl.cast('hunter.freezetrap'); return; }

    if (!sv) {
      // Dead zone handling: slow it and step back (the pet usually takes it back).
      if (close.length) {
        const c = close[0];
        const slowed = c.cc.slow >= 0.4 || c.cc.root || c.cc.stun || c.cc.incap;
        // Make room: a trap at your feet (he walks into it) — one control at a time, so a
        // trinket or diminishing returns cannot eat two of them at once.
        const trapPending = state.zones.some((z) => z.owner === me.id && z.trigger === 'enter');
        if (!trapPending && ctl.can('hunter.freezetrap') && !c.cc.incap) { ctl.cast('hunter.freezetrap'); return; }
        if (c.cc.incap && !me.cc.root) { backOff(state, ctl, c, 16); return; }
        if (trapPending && !me.cc.root) { backOff(state, ctl, c, 10); return; }
        if (ctl.can('hunter.frosttrap') && !c.cc.slow) { ctl.cast('hunter.frosttrap'); return; }
        if (!c.cc.incap && ctl.can('hunter.scatter', { targetId: c.id })) { ctl.cast('hunter.scatter', { targetId: c.id }); return; }
        if (t.kind === 'opponent' && hp < 0.3 && ctl.can('hunter.feign')) { ctl.stop(); ctl.cast('hunter.feign'); mem.fdAt = state.t; return; }
        if (!slowed && ctl.can('hunter.wingclip', { targetId: c.id })) { ctl.cast('hunter.wingclip', { targetId: c.id }); return; }
        if (pet && pet.alive && ctl.can('hunter.disengage', { targetId: c.id })) ctl.cast('hunter.disengage', { targetId: c.id });
        // Only kite something that is slowed; otherwise stand and fight in melee.
        if (slowed && !me.cc.root) { backOff(state, ctl, c, 10); return; }
        if (me.move.to) ctl.stop();
        if (ctl.target && me.target !== c.id) ctl.target(c.id);
        if (ctl.can('hunter.raptor', { targetId: c.id })) { ctl.cast('hunter.raptor', { targetId: c.id }); return; }
        if (!me.autoMelee) me.autoMelee = true;
        return;
      }
      // A slowed attacker that is far enough: Concussive keeps it that way.
      const chasing = ctl.engaged().find((e) => e.target === me.id && G.dist(e, me) < 20);
      if (chasing && !chasing.cc.slow && ctl.can('hunter.concussive', { targetId: chasing.id })) { ctl.cast('hunter.concussive', { targetId: chasing.id }); return; }
      if (holdRangedSpot(state, ctl, 26)) return;
      if (approach(state, ctl, t, 33)) return;
      // Dead zone: the pet is tanking right next to us — take a few steps back.
      if (G.dist(me, t) - (t.radius || 0.8) < 9 && !me.cc.root) {
        if (!me.move.to) backOff(state, ctl, t, 6);
        return;
      }
      if (me.move.to && G.dist(me, me.move.to) < 0.5) ctl.stop();
      if (me.move.to) return;
      if (!me.autoRanged) ctl.cast('hunter.autoshot');
      if (!findAura(t, 'hunter.mark', me.id) && ctl.can('hunter.mark', opts)) { ctl.cast('hunter.mark', opts); return; }
      const boss = t.maxHp > me.maxHp * 2;
      if (boss || ctl.engaged().length >= 3) {
        if (ctl.can('hunter.rapidfire')) ctl.cast('hunter.rapidfire');
        if (ctl.can('hunter.bestialwrath')) ctl.cast('hunter.bestialwrath');
      }
      const hawks = state.list.filter((x) => x.alive && x.templateId === 'hunter.hawk' && x.ownerId === me.id).length;
      const aoe = state.list.filter((e) => e.alive && e.side !== me.side && e.engaged && G.dist(e, t) < 8).length >= 3;
      // On Tranquilizing Shot duty, keep enough mana for the next Frenzy (Auto Shot is free).
      if (mana < 0.06 || (state.script.duty === 'tranq' && me.res.mana.cur < 400)) return;
      tryCast(ctl, [
        ['hunter.serpent', opts, !findAura(t, 'hunter.serpent', me.id) && t.hp > me.maxHp * 0.2],
        ['hunter.sniper', opts],
        ['hunter.multishot', opts, aoe],
        ['hunter.hawk', opts, hawks < 2],
        ['hunter.aimed', opts],
        ['hunter.arcane', opts, spec !== 'bm' || mana > 0.5 || level === 10],
      ]);
      return;
    }

    // Survival: open from range, then melee (not into Retaliation).
    if (retal) {
      if (G.dist(me, t) < 9 && !me.cc.root) { backOff(state, ctl, t, 12); return; }
      if (!me.autoRanged && ctl.can('hunter.autoshot')) ctl.cast('hunter.autoshot');
      tryCast(ctl, [['hunter.concussive', opts, !t.cc.slow], ['hunter.serpent', opts, !findAura(t, 'hunter.serpent', me.id)], ['hunter.arcane', opts]]);
      return;
    }
    if (!findAura(t, 'hunter.mark', me.id) && ctl.can('hunter.mark', opts)) { ctl.cast('hunter.mark', opts); return; }
    if (!t.engaged && !findAura(t, 'hunter.serpent', me.id) && ctl.can('hunter.serpent', opts)) { ctl.cast('hunter.serpent', opts); return; }
    // In a group, attack from behind (out of frontal cleaves).
    if (tank && t.target === tank.id) {
      const spot = G.behind(tank, t, (t.radius || 0.8) + 1.4);
      const unsafe = state.zones.some((z) => z.side !== me.side && !z.harmless && G.pointInZone(z, { ...spot, radius: 1 }));
      if (!unsafe && G.dist(me, spot) > 1.6) { ctl.moveTo(spot.x, spot.y); return; }
    } else if (approach(state, ctl, t, 4)) return;
    if (me.move.to && G.dist(me, me.move.to) < 0.6) ctl.stop();
    if (hp < 0.5 && ctl.can('hunter.deterrence')) ctl.cast('hunter.deterrence');
    if ((t.maxHp > me.maxHp * 2 || ctl.engaged().length >= 2) && ctl.can('hunter.rapidfire')) ctl.cast('hunter.rapidfire');
    if (state.script.duty === 'tranq' && me.res.mana.cur < 400) return;
    tryCast(ctl, [
      ['hunter.immotrap', undefined, G.dist(me, t) < 4],
      ['hunter.mongoose', opts],
      ['hunter.counter', opts],
      ['hunter.raptor', opts],
      ['hunter.strider', opts],
      ['hunter.wingclip', opts, t.kind === 'opponent' && !findAura(t, 'hunter.wingclip')],
    ]);
  };
}

export function careless({ level, spec } = {}) {
  if (spec === 'sv' && level >= 30) return carelessPolicy('hunter.raptor', 4);
  return carelessPolicy('hunter.autoshot', 33);
}
