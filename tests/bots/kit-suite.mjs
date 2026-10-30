// Shared kit test: every build builds, every bar ability can be cast, dummy DPS is in
// the calibrated band and careless play never beats competent play.
import assert from 'node:assert/strict';
import { buildsOf, castability, dummyDps, timeToOom, table } from './calibrate.mjs';

// Sanity bands (single-target dummy of the same level with real Classic armor, 120 s, mana
// included). Not balance targets: damage follows from the datamined ranks and Classic rules,
// so classes may differ (see design/kits.md). A build outside the band points at a bug.
export const DPS_BAND = { 10: [9, 30], 30: [45, 110], 60: [230, 520] };

export function runKitSuite(classId, bots, situational = {}) {
  const rows = [];
  const best = {};
  for (const b of buildsOf(classId)) {
    const bad = castability(b, situational);
    assert.deepEqual(bad, [], `${classId} ${b.level} ${b.spec}: uncastable abilities`);
    const c = dummyDps(b, bots.competent(b));
    const k = dummyDps(b, bots.careless(b));
    const oom = timeToOom(b, bots.careless(b), 400);
    rows.push({
      build: `${b.level} ${b.spec || '-'}`,
      dps: c.dps.toFixed(1),
      careless: k.dps.toFixed(1),
      manaEnd: c.manaEnd == null ? '-' : c.manaEnd.toFixed(2),
      oomCareless: oom ? oom.toFixed(0) + 's' : '-',
    });
    const [lo, hi] = DPS_BAND[b.level];
    assert.ok(c.dps >= lo && c.dps <= hi, `${classId} ${b.level} ${b.spec}: dummy DPS ${c.dps.toFixed(1)} outside ${lo}–${hi}`);
    assert.ok(k.dps <= c.dps * 1.05, `${classId} ${b.level} ${b.spec}: careless (${k.dps.toFixed(1)}) beats competent (${c.dps.toFixed(1)})`);
    best[b.level] = Math.max(best[b.level] || 0, c.dps);
  }
  table(rows, ['build', 'dps', 'careless', 'manaEnd', 'oomCareless']);
  return { rows, best };
}
