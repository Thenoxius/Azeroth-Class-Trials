import assert from 'node:assert/strict';import {KITS,trialSupports} from '../src/content/index.js';import {runTrial} from './bots/harness.mjs';import {competent} from './bots/shaman.mjs';
assert.throws(()=>KITS.shaman.build({level:10}));assert.equal(trialSupports('t1','shaman'),false);
for(const [trialId,level] of [['t3',30],['t5',60]])for(const seed of [1,2,3]){
 const r=runTrial({classId:'shaman',trialId,level,spec:'resto',role:'healer',seed,policy:competent(),maxSeconds:420});console.log(trialId,seed,r.outcome,r.t);assert.equal(r.outcome?.result,'victory');assert.ok(r.meters.heal[r.player.id]>0);
}
console.log('shaman preview ok');
