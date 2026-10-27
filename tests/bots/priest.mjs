// Priest bot policies: Shadow damage, Discipline/Holy healing, and careless versions.
import * as G from '../../src/engine/geometry.js';
import { hpPct, resPct } from '../../src/engine/core.js';
import { pickTarget, approach, meleeOn, restIfNeeded, dodge, potions, dispelTarget, busy, tryCast, findAura, carelessPolicy, interruptTarget, threatHigh, holdRangedSpot } from './common.mjs';

const inForm = (me) => !!findAura(me, 'priest.sf');

export function competent({ level, spec, role } = {}) {
  if (role === 'healer' && level >= 30) return healer({ level, spec });
  return (state, ctl) => {
    const me = ctl.me();
    if (!me || !me.alive) return;
    if (dodge(state, ctl)) return;
    if (restIfNeeded(state, ctl)) return;
    potions(state, ctl);
    const t = pickTarget(state, ctl);
    if (!t) return;
    if (me.target !== t.id) ctl.target(t.id);
    const hp = hpPct(me);
    const mana = resPct(me, 'mana');
    const close = meleeOn(state, ctl);
    const self = { targetId: me.id };
    const opts = { targetId: t.id };
    const kick = interruptTarget(state, ctl, 24);
    if (kick && ctl.can('priest.silence', { targetId: kick.id })) ctl.cast('priest.silence', { targetId: kick.id });
    if (busy(me)) return;
    // Raid threat: Fade, or ease off for a moment.
    if (threatHigh(state, ctl)) { if (ctl.can('priest.fade')) ctl.cast('priest.fade'); else { if (!me.autoRanged) ctl.cast('priest.wand'); return; } }
    if (!findAura(me, 'priest.tow') && ctl.can('priest.touch') && !ctl.engaged().length) { ctl.cast('priest.touch'); return; }
    // Duels: Fear Ward yourself before a fear-capable opponent closes in.
    if (t.kind === 'opponent' && !findAura(me, 'priest.fw') && ctl.can('priest.fearward', self)) { ctl.cast('priest.fearward', self); return; }
    if (t.kind === 'opponent' && close.length && ctl.can('priest.scream')) { ctl.cast('priest.scream'); return; }
    // Shield before the pull and whenever it is free.
    if (!findAura(me, 'priest.ws') && (hp < 0.8 || !t.engaged) && ctl.can('priest.pws', self)) { ctl.cast('priest.pws', self); return; }
    if (close.length >= 2 && ctl.can('priest.scream')) { ctl.cast('priest.scream'); return; }
    const debuffed = dispelTarget(state, ctl, ['magic']);
    if (debuffed && ctl.can('priest.dispel', { targetId: debuffed.id })) { ctl.cast('priest.dispel', { targetId: debuffed.id }); return; }
    if (!inForm(me)) {
      if (hp < 0.35 && ctl.can('priest.flash', self)) { ctl.cast('priest.flash', self); return; }
      if (hp < 0.6 && !findAura(me, 'priest.renew') && ctl.can('priest.renew', self)) { ctl.cast('priest.renew', self); return; }
      if (hp < 0.3 && level === 10 && ctl.can('priest.lheal', self)) { ctl.cast('priest.lheal', self); return; }
    }
    if (mana < 0.3 && hp > 0.75 && ctl.can('priest.darksac')) ctl.cast('priest.darksac');
    if (holdRangedSpot(state, ctl, 18)) return;
    if (approach(state, ctl, t, level >= 30 ? 19 : 27)) return;
    const lowMana = mana < (level === 10 ? 0.25 : 0.1);
    const wandIt = () => { if (!me.autoRanged) ctl.cast('priest.wand'); };
    if (lowMana) { wandIt(); return; }
    if (level === 10) {
      const r = tryCast(ctl, [
        ['priest.mb', opts, !t.engaged || mana > 0.5],
        ['priest.swp', opts, !findAura(t, 'priest.swp', me.id)],
        ['priest.smite', opts, mana > 0.65],
      ]);
      if (!r) wandIt();
      return;
    }
    const r = tryCast(ctl, [
      ['priest.ve', opts, !findAura(t, 'priest.ve', me.id)],
      ['priest.swp', opts, !findAura(t, 'priest.swp', me.id)],
      ['priest.swd', opts, hpPct(t) < 0.2 || (hp > 0.6 && t.kind !== 'boss')],
      ['priest.mb', opts],
      ['priest.dp', opts, !findAura(t, 'priest.dp', me.id) && mana > 0.3],
      ['priest.mf', opts, mana > 0.2 || level >= 60],
    ]);
    if (!r && !me.casting) wandIt();
  };
}

// Healer: triage by missing health, tank first, dispels, mana awareness.
function healer({ level, spec }) {
  const holy = spec === 'holy';
  return (state, ctl) => {
    const me = ctl.me();
    if (!me || !me.alive) return;
    if (dodge(state, ctl)) return;
    const party = state.list.filter((u) => u.alive && u.side === me.side && !u.hidden && u.kind !== 'pet' && u.kind !== 'guardian');
    const tank = party.find((u) => u.role === 'tank');
    const inFight = ctl.engaged().length > 0;
    if (!inFight && restIfNeeded(state, ctl, 0.5)) return;
    potions(state, ctl);
    const mana = resPct(me, 'mana');
    // Boss fights: hold a spot behind the boss (anchored on the main tank), never in front of it.
    const boss = ctl.engaged().find((e) => e.kind === 'boss');
    if (boss) { if (holdRangedSpot(state, ctl, 18)) return; }
    // Otherwise stay within range of everyone (roughly the party's centre).
    const far = boss ? [] : party.filter((u) => G.dist(u, me) > 36);
    if (far.length && !me.casting) {
      const c = party.reduce((a, u) => ({ x: a.x + u.x / party.length, y: a.y + u.y / party.length }), { x: 0, y: 0 });
      ctl.moveTo(c.x, c.y);
      return;
    }
    if (me.move.to && !far.length) ctl.stop();
    // Cancel an overheal-bound slow heal.
    if (me.casting && !me.casting.channel && me.casting.ab.category === 'heal') {
      const tgt = state.units[me.casting.targetId];
      if (tgt && hpPct(tgt) > 0.97 && me.casting.remaining > 0.3) ctl.stopCasting();
    }
    if (busy(me)) return;
    const onMe = ctl.engaged().filter((e) => e.target === me.id && e.kind !== 'boss');
    if (onMe.length && ctl.can('priest.fade')) ctl.cast('priest.fade');
    if (onMe.length && !findAura(me, 'priest.ws') && ctl.can('priest.pws', { targetId: me.id })) { ctl.cast('priest.pws', { targetId: me.id }); return; }
    if (onMe.filter((e) => G.dist(e, me) < 8).length >= 2 && ctl.can('priest.scream')) { ctl.cast('priest.scream'); return; }
    const hurt = party.map((u) => ({ u, p: hpPct(u), d: u.maxHp - u.hp })).sort((a, b) => a.p - b.p);
    const worst = hurt[0];
    const lowCount = hurt.filter((h) => h.p < 0.7).length;
    const go = (id, u) => { if (u && ctl.can(id, { targetId: u.id })) { ctl.cast(id, { targetId: u.id }); return true; } return false; };
    // Emergencies first.
    if (worst && worst.p < 0.35) {
      if (!findAura(worst.u, 'priest.ws') && go('priest.pws', worst.u)) return;
      if (go('priest.penance', worst.u)) return;
      if (go('priest.flash', worst.u)) return;
    }
    // Dispels.
    const sick = dispelTarget(state, ctl, ['magic']);
    if (sick && go('priest.dispel', sick)) return;
    const dis = dispelTarget(state, ctl, ['disease']);
    if (dis && (go('priest.abolish', dis) || go('priest.cure', dis))) return;
    // Group damage.
    if (lowCount >= 3) {
      if (go('priest.pom', worst.u)) return;
      if (party.filter((u) => G.dist(u, me) < 10 && hpPct(u) < 0.75).length >= 3 && ctl.can('priest.nova')) { ctl.cast('priest.nova'); return; }
      if (mana > 0.25 && go('priest.poh', worst.u)) return;
    }
    // Tank upkeep.
    if (tank && inFight) {
      if (!findAura(tank, 'priest.ws') && !findAura(tank, 'priest.pws') && (!holy || hpPct(tank) < 0.8) && go('priest.pws', tank)) return;
      if (!findAura(tank, 'priest.renew', me.id) && hpPct(tank) < 0.95 && go('priest.renew', tank)) return;
      if (holy && !findAura(tank, 'priest.pom') && go('priest.pom', tank)) return;
    }
    if (worst && worst.p < 0.85) {
      const big = worst.d > me.maxHp * 0.45;
      if (big && level >= 60 && mana > 0.2) {
        if (ctl.can('priest.innerfocus') && worst.d > me.maxHp * 0.6) ctl.cast('priest.innerfocus');
        if (go('priest.gheal', worst.u)) return;
      }
      if (worst.p < 0.55 && go('priest.penance', worst.u)) return;
      if (holy && worst.u !== me && hpPct(me) < 0.85 && go('priest.binding', worst.u)) return;
      if (!findAura(worst.u, 'priest.renew', me.id) && worst.p > 0.6 && go('priest.renew', worst.u)) return;
      if (go('priest.heal', worst.u)) return;
      if (go('priest.flash', worst.u)) return;
    }
    // Nothing to heal: wand the focus target.
    const t = pickTarget(state, ctl, { pull: false });
    if (t && inFight && !me.autoRanged && G.dist(me, t) < 30) { ctl.target(t.id); ctl.cast('priest.wand'); }
  };
}

export function careless({ level, spec, role } = {}) {
  if (role === 'healer' && level >= 30) {
    // Spams the main heal on the tank; no triage, no dispels, no mana planning.
    return (state, ctl) => {
      const me = ctl.me();
      if (!me || !me.alive || busy(me)) return;
      const tank = state.list.find((u) => u.alive && u.side === me.side && u.role === 'tank');
      const tgt = tank || me;
      const f = state.build.filler;
      if (hpPct(tgt) < 0.9 && ctl.can(f, { targetId: tgt.id })) ctl.cast(f, { targetId: tgt.id });
    };
  }
  return carelessPolicy(level === 10 ? 'priest.smite' : 'priest.mf', level === 10 ? 27 : 19);
}
