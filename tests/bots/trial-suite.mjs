// Shared trial test: every class (and role) × seeds with competent and careless bots.
import assert from 'node:assert/strict';
import { KITS, CLASS_ORDER, trialById } from '../../src/content/index.js';
import { runTrial } from './harness.mjs';
import { table } from './calibrate.mjs';
import * as mage from './mage.mjs';
import * as hunter from './hunter.mjs';
import * as priest from './priest.mjs';

import * as warrior from './warrior.mjs';
import * as rogue from './rogue.mjs';
import * as shaman from './shaman.mjs';
export const BOTS = { mage, hunter, priest, warrior, rogue, shaman };

export function trialMatrix(trialId, { level, seeds = 8, maxSeconds = 600, specs = {}, roles } = {}) {
  const trial = trialById(trialId);
  const lvl = level ?? trial.level;
  const out = [];
  for (const classId of CLASS_ORDER) {
    const kit = KITS[classId];
    const roleList = roles ? roles(classId) : trial.rolesFor(classId);
    for (const role of roleList) {
      const specList = specs[classId] || ((kit.specsFor ? kit.specsFor(lvl, role) : kit.specs[lvl]) || []).map((s) => s.id);
      for (const spec of specList.length ? specList : [null]) {
        for (const mode of ['competent', 'careless']) {
          const res = [];
          for (let seed = 1; seed <= seeds; seed++) {
            const b = { classId, level: lvl, spec, role };
            const r = runTrial({ ...b, trialId, seed, policy: BOTS[classId][mode](b), maxSeconds });
            const me = r.player;
            res.push({
              win: r.outcome && r.outcome.result === 'victory',
              result: r.outcome ? r.outcome.result : 'timeout',
              t: r.t,
              hp: me && me.alive ? me.hp / me.maxHp : 0,
              taken: r.meters.taken[r.state.playerId] || 0,
              state: r.state,
            });
          }
          const wins = res.filter((x) => x.win);
          const ts = wins.map((x) => x.t).sort((a, b) => a - b);
          out.push({
            classId,
            spec,
            role,
            mode,
            n: res.length,
            wins: wins.length,
            winRate: wins.length / res.length,
            medianT: ts.length ? ts[Math.floor(ts.length / 2)] : null,
            avgHp: res.reduce((a, x) => a + x.hp, 0) / res.length,
            avgTaken: res.reduce((a, x) => a + x.taken, 0) / res.length,
            results: res.map((x) => x.result).join(','),
          });
        }
      }
    }
  }
  table(
    out.map((r) => ({
      build: `${r.classId} ${r.spec || ''} ${r.role}`,
      mode: r.mode,
      wins: `${r.wins}/${r.n}`,
      medianT: r.medianT ? r.medianT.toFixed(0) + 's' : '-',
      avgHp: r.avgHp.toFixed(2),
      taken: Math.round(r.avgTaken),
      results: r.results.slice(0, 60),
    })),
    ['build', 'mode', 'wins', 'medianT', 'avgHp', 'taken', 'results'],
  );
  return out;
}

// Targets from design/trials.md: competent ≥ 75 % for every class (averaged over its
// specs and roles; no single build under 60 %), careless clearly worse. With an NPC healer
// topping you up, end-of-fight health hides standing in fire, so taking more than twice
// the damage of competent play also counts.
export function assertTrial(rows, { minCompetent = 0.75, minBuild = 0.6, label = '' } = {}) {
  for (const cls of [...new Set(rows.map((r) => r.classId))]) {
    const mine = rows.filter((r) => r.classId === cls && r.mode === 'competent');
    const avg = mine.reduce((a, r) => a + r.winRate, 0) / mine.length;
    assert.ok(avg >= minCompetent, `${label} ${cls}: competent win rate ${(avg * 100).toFixed(0)} % averaged over its builds`);
  }
  for (const r of rows.filter((x) => x.mode === 'competent')) {
    assert.ok(r.winRate >= minBuild, `${label} ${r.classId} ${r.spec || ''} ${r.role}: competent win rate ${(r.winRate * 100).toFixed(0)} %`);
    const c = rows.find((x) => x.mode === 'careless' && x.classId === r.classId && x.spec === r.spec && x.role === r.role);
    assert.ok(
      c.winRate < r.winRate || c.avgHp < r.avgHp - 0.15 || (c.medianT && r.medianT && c.medianT > r.medianT * 1.25) || c.avgTaken > r.avgTaken * 2,
      `${label} ${r.classId} ${r.spec || ''}: careless play is not clearly worse`,
    );
  }
}
