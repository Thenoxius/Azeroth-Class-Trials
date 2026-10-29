import {hpPct,resPct} from '../../src/engine/core.js';
import {dodge,restIfNeeded,potions,busy,holdRangedSpot,findAura} from './common.mjs';
export function competent(){return (s,c)=>{
 const p=c.me();if(!p?.alive)return;if(dodge(s,c))return;if(!c.engaged().length&&restIfNeeded(s,c,.5))return;potions(s,c);
 if(c.engaged().some(e=>e.kind==='boss')&&holdRangedSpot(s,c,18))return;
 if(busy(p))return;
 const allies=c.allies().filter(a=>a.alive&&a.kind!=='pet').sort((a,b)=>hpPct(a)-hpPct(b));const t=allies[0];if(!t)return;
 const go=id=>c.can(id,{targetId:t.id})&&c.cast(id,{targetId:t.id}).ok;
 if(resPct(p,'mana')<.45&&go('shaman.manatide'))return;
 if(hpPct(t)<.3&&go('shaman.ns'))return;
 if(hpPct(t)<.45&&go('shaman.lhw'))return;
 if(hpPct(t)<.92&&!findAura(t,'shaman.riptide',p.id)&&go('shaman.riptide'))return;
 if(allies.filter(a=>hpPct(a)<.8).length>=3&&go('shaman.ch'))return;
 if(hpPct(t)<.88)go('shaman.hw');
};}
export function careless(){return(s,c)=>{const p=c.me();if(!p?.alive||busy(p))return;const t=c.allies().find(a=>a.role==='tank'&&a.alive);if(t)c.cast('shaman.hw',{targetId:t.id});};}
