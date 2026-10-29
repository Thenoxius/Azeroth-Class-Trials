// Warrior bot policies: competent (Charge in, stance use, rage spending, Execute, Victory Rush,
// rest between pulls) and careless (walk in, auto-attack and Heroic Strike, never rest).
import { hpPct } from '../../src/engine/core.js';
import { pickTarget, approach, restIfNeeded, dodge, potions, busy, tryCast, findAura, interruptTarget } from './common.mjs';
import * as G from '../../src/engine/geometry.js';

const rage = (me) => (me.res.rage ? me.res.rage.cur : 0);

function attackOn(ctl, me) {
  if (!me.autoMelee && ctl.can('warrior.attack')) ctl.cast('warrior.attack');
}

export function competent({ level, spec, role } = {}) {
  const tank = role === 'tank' || spec === 'prot';
  return (state, ctl) => {
    const me = ctl.me();
    if (!me || !me.alive) return;
    if (dodge(state, ctl)) return;
    // No self-heal before Victory Rush: rest to near full between pulls.
    if (restIfNeeded(state, ctl, 0.9)) return;
    potions(state, ctl);
    const t = pickTarget(state, ctl);
    if (!t) return;
    if (me.target !== t.id) ctl.target(t.id);
    const opts = { targetId: t.id };
    const d = G.dist(me, t) - (t.radius || 0.8) - (me.radius || 0.5);
    // Open with Charge (Battle Stance, out of combat) or Intercept (Berserker, in combat).
    if (d > 8 && d < 24 && !busy(me)) {
      if (ctl.can('warrior.charge', opts)) { ctl.cast('warrior.charge', opts); return; }
      if (ctl.can('warrior.intercept', opts)) { ctl.cast('warrior.intercept', opts); return; }
    }
    if (approach(state, ctl, t, 4)) return;
    attackOn(ctl, me);
    const kick = interruptTarget(state, ctl, 5);
    if (kick && tryCast(ctl, [['warrior.pummel', { targetId: kick.id }], ['warrior.shieldbash', { targetId: kick.id }]])) return;
    if (busy(me)) return;
    const hp = hpPct(me);
    const crowd = ctl.engaged().filter((e) => e.target === me.id && G.dist(e, me) < 8).length;
    const execute = t.hp / t.maxHp <= 0.2;
    if (tank) {
      tryCast(ctl, [
        ['warrior.shieldwall', null, hp < 0.25],
        ['warrior.laststand', null, hp < 0.3],
        ['warrior.taunt', opts, t.target !== me.id && t.engaged],
        ['warrior.shieldblock', null, crowd >= 1 && !findAura(me, 'warrior.shieldblock')],
        ['warrior.shieldslam', opts],
        ['warrior.revenge', opts],
        ['warrior.thunderclap', null, crowd >= 2 && !findAura(t, 'warrior.tc')],
        ['warrior.demoshout', null, crowd >= 2 && !findAura(t, 'warrior.demo')],
        ['warrior.sunder', opts, (findAura(t, 'warrior.sunder') || { stacks: 0 }).stacks < 5 || rage(me) > 40],
        ['warrior.hs', opts, !me.nextSwing && rage(me) > 45],
        ['warrior.bloodrage', null, rage(me) < 20 && hp > 0.5],
        ['warrior.battleshout', null, !findAura(me, 'warrior.battleshout')],
      ]);
      return;
    }
    tryCast(ctl, [
      ['warrior.vr', opts, hp < 0.8],
      ['warrior.intimidate', null, crowd >= 3 && hp < 0.5],
      ['warrior.retaliation', null, crowd >= 3],
      ['warrior.deathwish', null, t.kind === 'boss' || t.kind === 'opponent' || crowd >= 2],
      ['warrior.recklessness', null, (t.kind === 'boss' || t.kind === 'opponent') && execute],
      ['warrior.execute', opts, execute],
      ['warrior.ms', opts],
      ['warrior.bt', opts],
      ['warrior.overpower', opts],
      ['warrior.ww', null, crowd >= 2 || level >= 60],
      ['warrior.rend', opts, level < 60 && !findAura(t, 'warrior.rend') && t.maxHp > me.maxHp * 0.3 && !execute],
      ['warrior.slam', opts, !me.moving],
      ['warrior.thunderclap', null, crowd >= 3],
      ['warrior.hamstring', opts, t.kind === 'opponent' && !findAura(t, 'warrior.hamstring')],
      ['warrior.cleave', opts, !me.nextSwing && crowd >= 2 && rage(me) > 40],
      ['warrior.hs', opts, !me.nextSwing && rage(me) > (level >= 60 ? 50 : 35)],
      ['warrior.bloodrage', null, rage(me) < 15 && hp > 0.5],
      ['warrior.battleshout', null, !findAura(me, 'warrior.battleshout') && rage(me) >= 10],
    ]);
  };
}

export function careless({ level, spec, role } = {}) {
  return (state, ctl) => {
    const me = ctl.me();
    if (!me || !me.alive) return;
    const t = pickTarget(state, ctl);
    if (!t) return;
    if (me.target !== t.id) ctl.target(t.id);
    if (approach(state, ctl, t, 4)) return;
    attackOn(ctl, me);
    if (busy(me)) return;
    if (!me.nextSwing && ctl.can('warrior.hs', { targetId: t.id })) ctl.cast('warrior.hs', { targetId: t.id });
  };
}
