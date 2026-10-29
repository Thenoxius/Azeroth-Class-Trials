import fs from 'node:fs';
import {runTrial,dummyEncounter,dps} from '../tests/bots/harness.mjs';
import {buildsOf} from '../tests/bots/calibrate.mjs';
import * as warrior from '../tests/bots/warrior.mjs';
import * as rogue from '../tests/bots/rogue.mjs';
const rows=[];
for(const [classId,bot] of Object.entries({warrior,rogue}))for(const b of buildsOf(classId)){
 const runs=[1,2,3,4,5].map(seed=>runTrial({...b,seed,encounter:dummyEncounter({level:b.level,duration:120}),policy:bot.competent(b)}));
 rows.push({...b,dps:Math.round(runs.reduce((n,r)=>n+dps(r),0)/runs.length*10)/10,min:Math.round(Math.min(...runs.map(r=>dps(r)))),max:Math.round(Math.max(...runs.map(r=>dps(r))))});
}
console.table(rows);fs.writeFileSync(new URL('../../damage-scaling.json', import.meta.url),JSON.stringify(rows,null,2));
