// In-fight help: at most a few short hints per fight, each shown once. Pure, so it can be tested.
export const MAX_HINTS = 3;

// Why an ability did not work, and what to do about it.
const WHY = {
  notarget: 'That ability needs a target. Click an enemy, or press Tab.',
  range: 'You are too far away. Move closer to your target.',
  minrange: 'You are too close for that ability. Step back a little.',
  los: 'Something blocks your view of the target. Move until you can see it.',
  nores: 'Not enough resource for that ability. Use a cheaper one, or wait for it to come back.',
  moving: 'That ability has a cast time. Stand still to cast it.',
  behind: 'That ability only works from behind your target.',
  stance: 'That ability needs another stance. Switch stance first.',
  stealth: 'That ability only works from Stealth.',
  combat: 'That ability only works out of combat.',
  cooldown: 'That ability is still on cooldown. The dark sweep on its button shows the time left.',
};

export function createHints() {
  return { shown: new Set(), errors: {}, lastAction: 0, current: null, until: 0 };
}

// Feed the fight's events. Returns the hint to show now, or null.
export function updateHints(h, events, ctx) {
  for (const e of events) {
    if (e.src !== ctx.playerId) continue;
    if (e.type === 'cast' || e.type === 'castStart') h.lastAction = ctx.t;
    if (e.type === 'error' && e.reason) h.errors[e.reason] = (h.errors[e.reason] || 0) + 1;
  }
  if (h.current && ctx.t > h.until) h.current = null;
  if (h.current || !ctx.enabled || h.shown.size >= MAX_HINTS) return h.current;
  const show = (id, text) => {
    if (h.shown.has(id)) return;
    h.shown.add(id);
    h.current = { id, text };
    h.until = ctx.t + 7;
  };
  // A failed press is explained straight away by the error line; the second time, say what to do.
  for (const [reason, n] of Object.entries(h.errors)) if (n >= 2 && WHY[reason]) show('why-' + reason, WHY[reason]);
  if (!h.current && ctx.t > 6 && !ctx.hasTarget && !ctx.anyAction) show('target', 'Click an enemy to target it, or press Tab.');
  if (!h.current && ctx.inCombat && ctx.t - h.lastAction > 10 && !ctx.casting)
    show('idle', 'Press a number key, or click an ability at the bottom of the screen.');
  if (!h.current && ctx.hpPct < 0.3) show('hp', 'Your health is low. Try a defensive ability or a potion, or move away.');
  return h.current;
}

// The first open objective is the one goal to show during the fight.
export const currentGoal = (objectives) => (objectives || []).find((o) => !o.done && !o.failed) || null;
