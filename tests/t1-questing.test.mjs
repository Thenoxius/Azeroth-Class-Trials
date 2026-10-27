// Trial 1 (questing) at both levels: competent bots win, careless bots (never rest) lose.
import { trialMatrix, assertTrial } from './bots/trial-suite.mjs';

for (const level of [10, 30]) {
  console.log(`— Trial 1 at level ${level}`);
  assertTrial(trialMatrix('t1', { level, seeds: 5 }), { label: `t1 L${level}` });
}
console.log('t1 ok');
