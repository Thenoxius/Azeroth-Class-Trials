// Rogue bot policies: competent (stealth approach, opener from behind, combo-point builders
// and finishers, Slice and Dice, Kick, Evasion / Gouge / Vanish when it goes wrong, rest)
// and careless (walk in, Sinister Strike, Eviscerate at any points, never rest).
import { hpPct } from '../../src/engine/core.js';
import { isBehind } from '../../src/engine/core.js';
import { comboOn } from '../../src/content/classes/rogue.js';
import { pickTarget, approach, restIfNeeded, dodge, potions, busy, tryCast, findAura, interruptTarget } from './common.mjs';

const energy = (me) => (me.res.energy ? me.res.energy.cur : 0);

function attackOn(ctl, me) {
  if (!me.autoMelee && !me.flags.stealthed && ctl.can('rogue.attack')) ctl.cast('rogue.attack');
}
// A spot just behind the target (the side it is not facing).
const behindSpot = (t, d = 1.6) => ({ x: t.x - Math.cos(t.facing || 0) * ((t.radius || 0.8) + d), y: t.y - Math.sin(t.facing || 0) * ((t.radius || 0.8) + d) });

export function competent({ level, spec } = {}) {
  const sp = level >= 20 ? spec || 'combat' : null;
  const builder = level >= 60 && sp === 'assassination' ? 'rogue.mutilate' : level >= 60 && sp === 'subtlety' ? 'rogue.hemo' : null;
  const mem = { sneakFor: null, sneakSince: 0 };
  return (state, ctl) => {
    const me = ctl.me();
    if (!me || !me.alive) return;
    if (dodge(state, ctl)) return;
    const fighting = ctl.engaged().some((e) => e.target === me.id);
    // Rest to near full before a big pull (a packleader or other elite), less before trash.
    const nextT = !fighting && pickTarget(state, ctl);
    const big = nextT && !nextT.engaged && nextT.maxHp > me.maxHp * 0.8;
    if (!fighting && restIfNeeded(state, ctl, big ? 0.9 : 0.9)) return;
    potions(state, ctl);
    const t = pickTarget(state, ctl);
    if (!t) return;
    if (me.target !== t.id) ctl.target(t.id);
    const opts = { targetId: t.id };
    const hp = hpPct(me);
    // Out of combat: stealth, sneak behind, open.
    if (!t.engaged && !fighting) {
      if (!me.flags.stealthed && ctl.can('rogue.stealth.player')) {
        ctl.cast('rogue.stealth.player');
        return;
      }
      if (me.flags.stealthed) {
        const wantBehind = me.melee.dagger;
        // Try to get behind for a few seconds; after that open from wherever we are.
        if (mem.sneakFor !== t.id) {
          mem.sneakFor = t.id;
          mem.sneakSince = state.t;
        }
        const spot = wantBehind && state.t - mem.sneakSince < 6 ? behindSpot(t) : null;
        if (spot && Math.hypot(me.x - spot.x, me.y - spot.y) > 0.8) {
          ctl.moveTo(spot.x, spot.y);
          return;
        }
        if (approach(state, ctl, t, 3)) return;
        if (
          tryCast(ctl, [
            ['rogue.ambush', opts, sp === 'subtlety'],
            ['rogue.backstab', opts, level < 26],
            ['rogue.garrote', opts, sp === 'assassination'],
            ['rogue.cheapshot', opts],
          ])
        )
          return;
        if (energy(me) < 60 && level >= 26 && state.t - mem.sneakSince < 12) return; // wait for energy before opening
      }
    }
    if (approach(state, ctl, t, 3)) return;
    attackOn(ctl, me);
    const kick = interruptTarget(state, ctl, 5);
    if (kick && ctl.can('rogue.kick', { targetId: kick.id })) {
      ctl.cast('rogue.kick', { targetId: kick.id });
      return;
    }
    if (busy(me)) return;
    const cp = comboOn(me, t);
    const attackers = ctl.engaged().filter((e) => e.target === me.id).length;
    const long = t.hp > me.maxHp * 0.8;
    tryCast(ctl, [
      ['rogue.vanish', null, hp < 0.2 && attackers >= 2],
      ['rogue.evasion', null, attackers >= 1 && (hp < 0.3 || (hp < 0.7 && (long || attackers >= 2)))],
      ['rogue.blind', { targetId: (ctl.engaged().find((e) => e !== t && e.target === me.id) || {}).id }, attackers >= 2 && hp < 0.6],
      ['rogue.gouge', opts, hp < 0.3 && attackers === 1 && !findAura(t, 'rogue.gouge')],
      ['rogue.kidney', opts, cp >= 4 && (t.kind === 'opponent' || (t.casting && !t.casting.channel))],
      ['rogue.snd', opts, cp >= 2 && !findAura(me, 'rogue.snd') && long],
      ['rogue.rupture', opts, cp >= 5 && long && !findAura(t, 'rogue.rupture') && t.hp / t.maxHp > 0.4],
      ['rogue.coldblood', null, cp >= 5],
      ['rogue.evis', opts, cp >= 5 || (cp >= 2 && t.hp / t.maxHp < 0.2)],
      ['rogue.bladeflurry', null, attackers >= 2],
      ['rogue.ar', null, long],
      [builder, opts, !!builder],
      ['rogue.backstab', opts, me.melee.dagger && isBehind(me, t)],
      ['rogue.ss', opts],
    ]);
  };
}

export function careless({ level } = {}) {
  return (state, ctl) => {
    const me = ctl.me();
    if (!me || !me.alive) return;
    const t = pickTarget(state, ctl);
    if (!t) return;
    if (me.target !== t.id) ctl.target(t.id);
    if (approach(state, ctl, t, 3)) return;
    attackOn(ctl, me);
    if (busy(me)) return;
    const cp = comboOn(me, t);
    tryCast(ctl, [
      ['rogue.evis', { targetId: t.id }, cp >= 1],
      ['rogue.ss', { targetId: t.id }],
    ]);
  };
}
