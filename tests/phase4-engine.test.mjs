// Phase 4 engine gates (Warrior stances, Rogue stealth and positional abilities).
import assert from 'node:assert/strict';
import { isBehind, reasonText } from '../src/engine/core.js';

const t = { x: 0, y: 0, facing: 0 }; // facing +x
assert.equal(isBehind({ x: -3, y: 0 }, t), true, 'directly behind');
assert.equal(isBehind({ x: 3, y: 0 }, t), false, 'in front');
assert.equal(isBehind({ x: -1, y: 3 }, t), true, 'behind-side');
assert.equal(isBehind({ x: 1, y: 3 }, t), false, 'front-side');
assert.equal(reasonText('behind'), 'You must be behind your target');
assert.equal(reasonText('stance'), 'Wrong stance');
assert.equal(reasonText('stealth'), 'You must be stealthed');
console.log('phase4 engine ok');
