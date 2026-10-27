// Trial 2 (unexpected danger): control and positioning beat filler spam.
import { trialMatrix, assertTrial } from './bots/trial-suite.mjs';

assertTrial(trialMatrix('t2', { seeds: 6 }), { label: 't2' });
console.log('t2 ok');
