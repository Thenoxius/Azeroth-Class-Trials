// Run every tests/*.test.mjs file in its own node process and report.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort();
let failed = 0;
for (const f of files) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [resolve(dir, f)], { encoding: 'utf8' });
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${f} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  if (!ok) console.log((r.stdout || '').slice(-3000) + (r.stderr || '').slice(-3000));
}
console.log(`${files.length - failed}/${files.length} test files passed`);
process.exit(failed ? 1 : 0);
