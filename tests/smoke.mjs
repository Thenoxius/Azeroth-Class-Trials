import { registerAbilities, registerTemplates } from '../src/engine/registry.js';
import { createBattle, step, spawnUnit, playerCast, drainEvents, player } from '../src/engine/core.js';

registerAbilities({
  'test.frostbolt': { name: 'Frostbolt', school: 'frost', castTime: 2.5, cost: { mana: 25 }, range: 30, category: 'damage',
    projectile: { speed: 28 }, effects: [{ type: 'damage', amount: [40, 50], coef: 0.8 }, { type: 'aura', aura: { id: 'chill', debuff: true, duration: 5, mods: { slow: 0.4 } } }] },
  'test.nova': { name: 'Frost Nova', school: 'frost', target: 'none', cooldown: 25, cost: { mana: 40 }, category: 'control',
    effects: [{ type: 'damage', amount: [10, 12], aoe: { center: 'self', radius: 10 } }, { type: 'aura', aoe: { center: 'self', radius: 10 }, aura: { id: 'nova', debuff: true, duration: 8, cc: 'root', frozen: true, breakDamage: 0.15, breakDamagePct: true, dr: 'root' } }] },
  'test.claw': { name: 'Claw', school: 'physical', mechanic: 'physical', range: 5, cooldown: 6, effects: [{ type: 'damage', amount: [8, 12] }] },
});
registerTemplates({
  wolf: { name: 'Wolf', side: 'enemy', maxHp: 220, melee: { min: 8, max: 12, speed: 2 }, ai: { type: 'melee', rotation: [{ id: 'test.claw' }] }, abilities: ['test.claw'], aggroRadius: 12 },
});
const enc = {
  id: 'smoke', arena: { w: 60, h: 34, obstacles: [{ x: 30, y: 17, r: 2 }] },
  setup(state, api) {
    const p = api.spawnUnit(state, { name: 'Mage', side: 'player', kind: 'player', isPlayer: true, maxHp: 300, resources: { mana: 600 }, stats: { sp: 20 }, regen: { spirit: 4 }, abilities: ['test.frostbolt', 'test.nova'], x: 20, y: 12 });
    state.playerId = p.id;
    api.spawnUnit(state, 'wolf', { x: 45, y: 17 });
  },
  checkOutcome(state, api) {
    const p = api.player(state);
    if (!p.alive) return { result: 'defeat' };
    if (state.list.filter(u => u.side === 'enemy' && u.alive).length === 0) return { result: 'victory' };
  },
};
const s = createBattle(enc, { seed: 7 });
const wolf = s.list.find(u => u.name === 'Wolf');
const counts = {};
for (let i = 0; i < 1200 && !s.outcome; i++) {
  const p = player(s);
  if (!p.casting && p.gcd <= 0) {
    if (wolf.alive && Math.hypot(wolf.x - p.x, wolf.y - p.y) < 8 && !p.cds['test.nova']) playerCast(s, 'test.nova');
    else playerCast(s, 'test.frostbolt', { targetId: wolf.id });
  }
  step(s, 0.05);
  for (const e of drainEvents(s)) { counts[e.type] = (counts[e.type] || 0) + 1; if (e.type==='error' && counts.error<3) console.log(e.text); if (['damage','death','auraApply','auraFade'].includes(e.type)) console.log(s.t.toFixed(1), e.type, e.ability||e.aura, e.amount||'', e.crit?'CRIT':'', e.src, '->', e.dst); }
}
console.log('outcome', s.outcome, 't', s.t.toFixed(1), 'playerHp', player(s).hp, 'mana', Math.round(player(s).res.mana.cur));
console.log(counts);
