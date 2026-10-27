// Screenshot the built page with headless Edge.
//   node scripts/shot.mjs <hash> <out.png> [width] [height] [virtualTimeMs]
// Needs the preview server on :8642 (or pass a file URL via SHOT_BASE).
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const [hash = '', out = 'scratch/shot.png', w = '1440', h = '900', vt = '4000'] = process.argv.slice(2);
const base = process.env.SHOT_BASE || 'http://localhost:8642/preview.html';
const url = base + (hash ? '#' + hash : '');
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const file = resolve(out);
execFileSync(edge, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--window-size=${w},${h}`, `--virtual-time-budget=${vt}`, `--screenshot=${file}`, url], { stdio: 'ignore' });
console.log('saved', file, 'for', url);
