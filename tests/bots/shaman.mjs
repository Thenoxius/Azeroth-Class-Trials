import {hpPct,resPct} from '../../src/engine/core.js';
import {activeTotems} from '../../src/content/classes/shaman-totems.js';
import {dodge,restIfNeeded,potions,busy,holdRangedSpot,findAura,pickTarget,approach,interruptTarget,backOff,meleeOn} from './common.mjs';
export function competent({role,spec}={}){return (s,c)=>{
 const p=c.me();if(!p?.alive)return;if(dodge(s,c))return;if(!c.engaged().length&&restIfNeeded(s,c,.92))return;potions(s,c);
 const healer=role==='healer'||spec==='resto',melee=spec==='enhancement';
 if(healer&&c.engaged().some(e=>e.kind==='boss')&&holdRangedSpot(s,c,18))return;
 if(c.engaged().length&&c.can('race.bloodfury'))c.cast('race.bloodfury');
 if(p.auras.some(a=>a.def.debuff&&['curse','bane'].includes(a.def.dispel))&&c.can('race.shattercurse'))c.cast('race.shattercurse');
 if(busy(p))return;
 const it=interruptTarget(s,c,20);if(it&&c.can('shaman.es',{targetId:it.id})){c.cast('shaman.es',{targetId:it.id});return;}
 const cast=(id,t)=>c.can(id,t?{targetId:t.id}:{})&&c.cast(id,t?{targetId:t.id}:{}).ok;
 const allies=c.allies().filter(a=>a.alive&&a.kind!=='pet').sort((a,b)=>hpPct(a)-hpPct(b)),a=allies[0];
 if(healer){
  if(resPct(p,'mana')<.45&&cast('shaman.manatide'))return;
  if(a&&hpPct(a)<.3&&cast('shaman.ns'))return;
  if(a&&hpPct(a)<.45&&cast('shaman.lhw',a))return;
  if(a&&hpPct(a)<.92&&!findAura(a,'shaman.riptide',p.id)&&cast('shaman.riptide',a))return;
  if(allies.filter(a=>hpPct(a)<.8).length>=3&&cast('shaman.ch',a))return;
  if(a&&hpPct(a)<.88&&cast('shaman.hw',a))return;
 }else if(hpPct(p)<.3&&cast('shaman.lhw',p))return;
 else if(hpPct(p)<.5&&cast('shaman.hw',p))return;
 if(!healer&&!findAura(p,'shaman.lightshield')&&cast('shaman.lightshield'))return;
 if(!healer&&!findAura(p,melee?'shaman.windfury':'shaman.rockbiter')&&cast(melee?'shaman.windfury':'shaman.rockbiter'))return;
 if(healer&&!findAura(p,'shaman.watershield')&&cast('shaman.watershield'))return;
 if(healer){
  // Stay behind the tank; deploy support without walking into a pack.
  const active=activeTotems(s,p);
  if(c.engaged().length&&!active.some(q=>q.meta.element==='water')&&cast('shaman.spring'))return;
  const hurt=allies.find(a=>hpPct(a)<.9&&c.dist(a)>35);if(hurt)approach(s,c,hurt,30);
  return;
 }
 const t=pickTarget(s,c);if(!t)return;if(p.target!==t.id)c.target(t.id);
 if(t.flags.fleeing&&cast('shaman.fr',t))return;
 if(approach(s,c,t,melee||resPct(p,'mana')<.2?3:23))return;
 if(!healer&&!p.autoMelee&&(melee||c.dist(t)<5))cast('shaman.attack');
 const active=activeTotems(s,p);
 const missing=(element)=>!active.some(q=>q.meta.element===element&&c.dist(q,p)<25);
 if(c.engaged().length){
  if(missing('fire')&&cast('shaman.searing'))return;
  if(missing('earth')&&cast(melee?'shaman.strength':'shaman.earthbind'))return;
  if(missing('water')&&cast('shaman.spring'))return;
  if(melee&&missing('air')&&cast('shaman.grace'))return;
 }
 if(healer)return;
 if(!melee&&resPct(p,'mana')>.3&&p.level>10&&meleeOn(s,c).length){const close=meleeOn(s,c)[0];if(!close.cc.root&&cast('shaman.earthbind'))return;if(close.cc.root&&c.dist(close)<8&&!p.cc.root){backOff(s,c,close,10);return;}}
 if(c.engaged().filter(e=>c.dist(e)<10).length>=2&&cast('shaman.nova'))return;
 if(melee){if(cast('shaman.rage'))return;if(cast('shaman.stormstrike',t))return;if(cast('shaman.es',t))return;
  if((findAura(p,'shaman.maelstrom')?.stacks||0)>=5)cast('shaman.lb',t);return;}
 if(c.engaged().length&&cast('shaman.em'))return;
 if(!findAura(t,'shaman.fs',p.id)&&cast('shaman.fs',t))return;
 if(cast('shaman.lava',t))return;
 cast('shaman.lb',t);
};}
export function careless(){return(s,c)=>{const p=c.me();if(!p?.alive||busy(p))return;const t=pickTarget(s,c);if(!t)return;c.target(t.id);if(approach(s,c,t,20))return;c.cast('shaman.lb',{targetId:t.id});};}
