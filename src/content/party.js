// NPC party and raid members as real classes. Each member is built from a class kit (stats,
// abilities, talents, resources) and played by the engine's group behaviours (tank, mdps,
// rdps, allyHealer: positioning, target choice, human-ish reaction times) with the class's own
// priority list below. Interrupts and dodging depend on ai.skill / ai.react, so NPCs stay fallible.
import { KIT as hunter } from './classes/hunter.js';
import { KIT as mage } from './classes/mage.js';
import { KIT as priest } from './classes/priest.js';
import { KIT as warrior } from './classes/warrior.js';
import { KIT as rogue, comboOn } from './classes/rogue.js';
import { KIT as warlock } from './classes/warlock.js';
import { KIT as shaman } from './classes/shaman.js';

export const NPC_KITS = { warrior, rogue, warlock, shaman, hunter, mage, priest };

const aura = (u, id, srcId) => u.auras.find((a) => a.id === id && (!srcId || a.srcId === srcId));
const pct = (u, k) => (u.res[k] ? u.res[k].cur / u.res[k].max : 0);
const cur = (u, k) => (u.res[k] ? u.res[k].cur : 0);
const hp = (u) => u.hp / u.maxHp;
const deficit = (u) => u.maxHp - u.hp;
const isBoss = (t) => !!t && t.kind === 'boss';
const foesNear = (s, u, p, r) => s.list.filter((e) => e.side !== u.side && e.alive && e.engaged && Math.hypot(e.x - p.x, e.y - p.y) <= r).length;
const hurtNear = (s, u, p, r, below) => s.list.filter((a) => a.side === u.side && a.alive && a.kind !== 'pet' && hp(a) < below && Math.hypot(a.x - p.x, a.y - p.y) <= r).length;
// A party member carrying a debuff of this dispel type for longer than our reaction time.
// Mana is finite, so healers dispel the tanks, healers and anyone in trouble first; others wait.
const needsCleanse = (s, u, type) => s.list.find((a) => a.side === u.side && a.alive && a.kind !== 'pet' && Math.hypot(a.x - u.x, a.y - u.y) <= 36
  && (u.role !== 'healer' || a.role === 'tank' || a.role === 'healer' || hp(a) < 0.6)
  && a.auras.some((x) => x.def.debuff && x.def.dispel === type && s.t - (x.appliedAt ?? s.t) > (u.ai.react ?? 1)));
// Threat on the target as a share of whoever holds it (for Feint).
const threatShare = (u, t) => { const h = t.threat && t.target && t.threat[t.target]; return h ? (t.threat[u.id] || 0) / h : 0; };

// Priority lists per class. `kick` is the chance to use an interrupt on a cast in progress.
function rotationFor(classId, L, d) {
  const kick = d.kickChance ?? 0.35;
  switch (classId) {
    case 'warrior': return [
      { id: 'warrior.laststand', target: 'self', when: (s, u) => hp(u) < 0.2 },
      { id: 'warrior.shieldwall', target: 'self', when: (s, u) => hp(u) < 0.3 },
      { id: 'warrior.shieldbash', when: (s, u, t) => !!t.casting && s.rng() < kick },
      { id: 'warrior.bloodrage', target: 'self', when: (s, u) => cur(u, 'rage') < 25 && hp(u) > 0.5 },
      // Rage-starved priorities of a Classic tank: five Sunders first, then Shield Slam and Revenge
      // (cheap threat), Shield Block when the hits start to hurt, then keep Sunder from dropping.
      { id: 'warrior.sunder', when: (s, u, t) => { const a = aura(t, 'warrior.sunder'); return !a || a.stacks < 5; } },
      { id: 'warrior.shieldslam' },
      { id: 'warrior.revenge' },
      { id: 'warrior.shieldblock', target: 'self', when: (s, u, me, t) => t.target === u.id && hp(u) < 0.8 && !aura(u, 'warrior.shieldblock') },
      { id: 'warrior.thunderclap', when: (s, u) => foesNear(s, u, u, 8) >= 3 },
      { id: 'warrior.demoshout', when: (s, u, t) => !aura(t, 'warrior.demo') && (isBoss(t) || foesNear(s, u, u, 10) >= 3) },
      { id: 'warrior.sunder', when: (s, u, t) => { const a = aura(t, 'warrior.sunder'); return !a || a.remaining < 8; } },
      { id: 'warrior.cleave', when: (s, u, t) => cur(u, 'rage') >= 45 && foesNear(s, u, t, 5) >= 2 },
      { id: 'warrior.hs', when: (s, u) => cur(u, 'rage') >= 45 },
    ];
    case 'rogue': return [
      { id: 'rogue.kick', when: (s, u, t) => !!t.casting && s.rng() < kick },
      { id: 'rogue.evasion', target: 'self', when: (s, u) => hp(u) < 0.45 && s.list.some((e) => e.alive && e.target === u.id && e.side !== u.side) },
      { id: 'rogue.feint', when: (s, u, t) => t.target !== u.id && threatShare(u, t) > 0.85 },
      { id: 'rogue.ar', target: 'self', when: (s, u, me, t) => isBoss(t) },
      { id: 'rogue.bladeflurry', target: 'self', when: (s, u, me, t) => isBoss(t) || foesNear(s, u, t, 5) >= 2 },
      { id: 'rogue.snd', when: (s, u, t) => !aura(u, 'rogue.snd') && comboOn(u, t) >= 3 && hp(t) > 0.25 },
      { id: 'rogue.evis', when: (s, u, t) => { const cp = comboOn(u, t), snd = aura(u, 'rogue.snd'); return cp >= 5 || (cp >= 4 && snd && snd.remaining > 6) || (cp >= 2 && hp(t) < 0.12); } },
      { id: 'rogue.ss', when: (s, u, t) => comboOn(u, t) < 5 },
    ];
    case 'warlock': {
      const curse = d.curse === 'coe' ? 'warlock.coe' : d.curse === 'cor' ? 'warlock.cor' : null;
      return [
        { id: 'warlock.lifetap', target: 'self', when: (s, u) => pct(u, 'mana') < 0.35 && hp(u) > 0.6 },
        ...(curse ? [{ id: curse, when: (s, u, t) => !aura(t, curse) && (isBoss(t) || t.maxHp > 4 * u.maxHp) }] : []),
        { id: 'warlock.corruption', when: (s, u, t) => !aura(t, 'warlock.corruption', u.id) && hp(t) > 0.25 },
        { id: 'warlock.agony', when: (s, u, t) => !aura(t, 'warlock.agony', u.id) && hp(t) > 0.4 },
        { id: 'warlock.immolate', when: (s, u, t) => !aura(t, 'warlock.immolate', u.id) && isBoss(t) && hp(t) > 0.2 },
        { id: 'warlock.sb' },
      ];
    }
    // Healers pick the heal that fits the gap (as raid healers do to make their mana last):
    // big heals only for big deficits, the fast heal for emergencies.
    case 'shaman': {
      const big = L >= 60 ? 1500 : 330, ch = L >= 60 ? 600 : 9e9;
      return [
        { id: 'shaman.manatide', target: 'self', when: (s, u) => pct(u, 'mana') < 0.4 },
        { id: 'shaman.ns', target: 'self', when: (s, u, me, t) => hp(t) < 0.25 },
        { id: 'shaman.hw', when: (s, u) => !!aura(u, 'shaman.ns') },
        { id: 'shaman.lhw', when: (s, u, t) => hp(t) < 0.4 },
        { id: 'shaman.riptide', when: (s, u, t) => !aura(t, 'shaman.riptide', u.id) && deficit(t) > big * 0.6 },
        { id: 'shaman.ch', when: (s, u, t) => s.list.filter((a) => a.side === u.side && a.alive && a.kind !== 'pet' && deficit(a) > ch && Math.hypot(a.x - t.x, a.y - t.y) <= 12).length >= 3 },
        { id: 'shaman.hw', when: (s, u, t) => deficit(t) > big },
      ];
    }
    case 'priest': {
      const big = L >= 60 ? 2000 : 9e9, mid = L >= 60 ? 900 : 500, small = L >= 60 ? 700 : 250;
      return [
        { id: 'priest.dispel', target: (s, u) => needsCleanse(s, u, 'magic') },
        { id: 'priest.pws', when: (s, u, t) => t.role === 'tank' && !aura(t, 'priest.ws') && hp(t) < 0.6 },
        { id: 'priest.pom', when: (s, u, t) => t.role === 'tank' },
        { id: 'priest.flash', when: (s, u, t) => hp(t) < 0.35 },
        { id: 'priest.gheal', when: (s, u, t) => deficit(t) > big },
        { id: 'priest.heal', when: (s, u, t) => deficit(t) > mid },
        { id: 'priest.renew', when: (s, u, t) => !aura(t, 'priest.renew', u.id) && deficit(t) > small },
      ];
    }
    case 'mage': return [
      { id: 'mage.counterspell', when: (s, u, t) => !!t.casting && s.rng() < kick },
      { id: 'mage.decurse', target: (s, u) => needsCleanse(s, u, 'curse') },
      { id: 'mage.evocation', target: 'self', when: (s, u) => pct(u, 'mana') < 0.15 },
      { id: 'mage.gem', target: 'self', when: (s, u) => pct(u, 'mana') < 0.55 },
      { id: 'mage.icelance', when: (s, u, t) => !!aura(u, 'mage.fof') || !!t.cc.frozen },
      { id: 'mage.frostbolt' },
    ];
    case 'hunter': return [
      { id: 'hunter.mark', when: (s, u, t) => !aura(t, 'hunter.mark') && (isBoss(t) || t.maxHp > 4 * u.maxHp) },
      { id: 'hunter.rapidfire', target: 'self', when: (s, u, me, t) => isBoss(t) },
      { id: 'hunter.serpent', when: (s, u, t) => !aura(t, 'hunter.serpent', u.id) && pct(u, 'mana') > 0.3 && hp(t) > 0.3 },
      { id: 'hunter.aimed' },
      { id: 'hunter.multishot', when: (s, u, t) => foesNear(s, u, t, 8) >= 2 },
      { id: 'hunter.arcane', when: (s, u) => pct(u, 'mana') > 0.5 },
    ];
    default: return [];
  }
}

const BEHAVIOUR = { tank: 'tank', healer: 'allyHealer' };
const MELEE = { warrior: true, rogue: true };

// def: { classId, role ('tank' | 'dps' | 'healer'), spec, race, name, portrait, react, skill,
//        kickChance, curse, spot, groupBuffs }
export function classMemberTemplate(state, level, def) {
  const kit = NPC_KITS[def.classId];
  const b = kit.build({ level, spec: def.spec, role: def.role === 'healer' ? 'healer' : 'dps', trialId: state.opts.trialId, groupBuffs: def.groupBuffs || [], race: def.race, npc: true });
  const ai = {
    type: BEHAVIOUR[def.role] || (MELEE[def.classId] ? 'mdps' : 'rdps'),
    react: def.react ?? 1.1, skill: def.skill ?? 0.8, spot: def.spot,
    range: def.range ?? 28,
    rotation: rotationFor(def.classId, level, def),
    ...(def.role === 'tank' ? { taunt: 'warrior.taunt' } : {}),
  };
  const template = { ...b.template, meta:{...b.template.meta,groupBuffs:def.groupBuffs||[]}, name: def.name, portrait: def.portrait || b.template.portrait, side: 'player', kind: 'ally', classId: def.classId, role: def.role, level, ai, flags: { ...(b.template.flags || {}), wandMacro: false } };
  delete template.isPlayer;
  return { template, tweaks: b.tweaks || {} };
}

export function spawnClassMember(state, api, def, at) {
  const { template, tweaks } = classMemberTemplate(state, at.level ?? state.encounter.level, def);
  const u = api.spawnUnit(state, template, { x: at.x, y: at.y });
  for (const [id, tw] of Object.entries(tweaks)) if (u.ab[id]) u.ab[id] = { ...u.ab[id], ...tw };
  if (def.classId === 'mage') u.meta.gems = 3;
  return u;
}
