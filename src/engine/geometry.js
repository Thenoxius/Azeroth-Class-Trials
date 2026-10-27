// Battlefield geometry. Units are in yards; the arena is a rectangle with
// circular obstacles (pillars, trees, rocks) that block movement and sight.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);

export function norm(x, y) {
  const l = Math.hypot(x, y);
  return l > 1e-9 ? { x: x / l, y: y / l } : { x: 0, y: 0 };
}

// Distance from a's centre to b's edge: the number range checks use.
export const edgeDist = (a, b) => Math.max(0, dist(a, b) - (b.radius || 0));

export function segHitsCircle(ax, ay, bx, by, cx, cy, r) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((cx - ax) * dx + (cy - ay) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(ax + t * dx - cx, ay + t * dy - cy) < r;
}

export function hasLoS(arena, a, b) {
  for (const o of arena.obstacles || []) {
    if (o.los === false) continue;
    if (segHitsCircle(a.x, a.y, b.x, b.y, o.x, o.y, o.r)) return false;
  }
  return true;
}

// Push a unit out of obstacles and keep it inside the arena.
export function collide(arena, u) {
  for (const o of arena.obstacles || []) {
    if (o.solid === false) continue;
    const d = Math.hypot(u.x - o.x, u.y - o.y);
    const min = o.r + (u.radius || 0.5);
    if (d < min) {
      const n = d > 1e-6 ? { x: (u.x - o.x) / d, y: (u.y - o.y) / d } : { x: 1, y: 0 };
      u.x = o.x + n.x * min;
      u.y = o.y + n.y * min;
    }
  }
  const r = u.radius || 0.5;
  u.x = clamp(u.x, r, arena.w - r);
  u.y = clamp(u.y, r, arena.h - r);
}

export function pointInZone(z, p) {
  const s = z.shape || { type: 'circle', r: 5 };
  const dx = p.x - z.x, dy = p.y - z.y;
  const d = Math.hypot(dx, dy);
  const pr = p.radius || 0;
  if (s.type === 'circle') return d <= s.r + pr * 0.5;
  if (s.type === 'ring') return d <= s.r + pr * 0.5 && d >= (s.inner || 0) - pr * 0.5;
  if (s.type === 'cone') {
    if (d > s.range + pr * 0.5) return false;
    if (d < 1e-6) return true;
    let da = Math.atan2(dy, dx) - s.dir;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    return Math.abs(da) <= s.angle / 2;
  }
  if (s.type === 'rect') return Math.abs(dx) <= s.w / 2 && Math.abs(dy) <= s.h / 2;
  return false;
}

// Nearest point outside a zone, for AI that steps out of fire.
export function escapePoint(z, p, margin = 1.5) {
  const s = z.shape || { type: 'circle', r: 5 };
  if (s.type === 'cone') {
    // step sideways out of the cone
    const side = s.dir + Math.PI / 2;
    const d = Math.hypot(p.x - z.x, p.y - z.y);
    const off = Math.tan(s.angle / 2) * Math.max(d, 2) + margin + 2;
    const sgn = Math.sin(Math.atan2(p.y - z.y, p.x - z.x) - s.dir) >= 0 ? 1 : -1;
    return { x: p.x + Math.cos(side) * off * sgn, y: p.y + Math.sin(side) * off * sgn };
  }
  if (s.type === 'rect') {
    const ox = p.x - z.x, oy = p.y - z.y;
    const ex = s.w / 2 - Math.abs(ox), ey = s.h / 2 - Math.abs(oy);
    if (ex < ey) return { x: z.x + Math.sign(ox || 1) * (s.w / 2 + margin), y: p.y };
    return { x: p.x, y: z.y + Math.sign(oy || 1) * (s.h / 2 + margin) };
  }
  const n = norm(p.x - z.x, p.y - z.y);
  const dir = n.x === 0 && n.y === 0 ? { x: 1, y: 0 } : n;
  const r = s.r + margin;
  return { x: z.x + dir.x * r, y: z.y + dir.y * r };
}

// Step out of zone z without landing in any of the others: z's own escape point when it is
// clear, else the nearest clear point on rings around p (overlapping pools otherwise bounce
// a unit between them).
export function escapeClear(z, zones, p, margin = 1.5, bounds = null) {
  const clear = (q) => (!bounds || (q.x >= 1 && q.y >= 1 && q.x <= bounds.w - 1 && q.y <= bounds.h - 1)) && !zones.some((o) => pointInZone(o, { x: q.x, y: q.y, radius: (p.radius || 0) + margin }));
  const own = escapePoint(z, p, margin);
  if (zones.length < 2 || clear(own)) return own;
  let best = null, bd = Infinity;
  for (let d = 2; d <= 16; d += 2) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const q = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d };
      if (clear(q) && d < bd) { bd = d; best = q; }
    }
    if (best) break;
  }
  return best || own;
}

// Point at distance `d` from `to`, on the far side from `from`.
export function behind(from, to, d) {
  const n = norm(to.x - from.x, to.y - from.y);
  return { x: to.x + n.x * d, y: to.y + n.y * d };
}

export function towards(from, to, d) {
  const n = norm(to.x - from.x, to.y - from.y);
  return { x: from.x + n.x * d, y: from.y + n.y * d };
}
