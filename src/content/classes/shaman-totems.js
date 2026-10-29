// Actual player totems. NPC buffs remain abstract; never stack a placed copy on them.
import * as G from '../../engine/geometry.js';
import { deriveStats, BUFFS } from '../stats.js';
export const activeTotems=(s,u)=>s.list.filter(t=>t.kind==='totem'&&t.ownerId===u.id&&t.alive);
const offsets={earth:[-1.5,1.5],fire:[1.5,1.5],water:[-1.5,-1.5],air:[1.5,-1.5]};
export function dismissTotem(state,api,t){
 for(const a of state.list)for(const aura of [...a.auras])if(aura.srcId===t.id)api.removeAura(state,a,aura,'totem removed');
 api.emit(state,{type:'despawn',dst:t.id});api.removeUnit(state,t);
}
export function summonTotem(ctx,def){
 const {state,u,api,ab}=ctx;
 for(const old of activeTotems(state,u))if(old.meta.element===def.element)dismissTotem(state,api,old);
 const [dx,dy]=offsets[def.element];
 const t=api.spawnUnit(state,{name:ab.name,kind:'totem',side:u.side,ownerId:u.id,level:u.level,
  portrait:'totem-'+def.element,x:u.x+dx,y:u.y+dy,radius:.45,speed:0,maxHp:5,
  flags:{ignoreForVictory:true},meta:{...def,ability:ab.id,manaPaid:api.abilityCost(u,ab)?.mana||0,until:state.t+(def.duration||300),next:state.t+(def.interval||2)},
  hooks:{onTick:totemTick,afterDamageTaken:({state,u,api})=>{if(u.hp<=0)dismissTotem(state,api,u);}}});
 G.collide(state.arena,t);
 if(def.root)for(const e of api.enemiesOf(state,u,e=>e.engaged&&G.dist(e,t)<=10))api.applyAura(state,u,e,{id:'shaman.earthbound',name:'Earthbound',icon:'roots',duration:5,cc:'root',dr:'root',debuff:true,school:'nature'});
 return t;
}
function totemTick({state,u:t,api}){
 const owner=api.U(state,t.ownerId),d=t.meta;
 if(!owner?.alive){dismissTotem(state,api,t);return;}
 if(state.t>d.until+1e-7&&d.next>d.until+1e-7){dismissTotem(state,api,t);return;}
 const members=state.list.filter(a=>a.kind==='player'||a.kind==='ally');
 const groupOf=a=>a.meta.partyGroup??Math.floor(members.indexOf(a)/5);
 const partyOnly=!!(d.heal||d.mana);
 const sameParty=a=>groupOf(a.kind==='pet'?(api.U(state,a.ownerId)||a):a)===groupOf(owner);
 const allies=api.alliesOf(state,owner,a=>a.kind!=='totem'&&G.dist(a,t)<=30&&(!partyOnly||sameParty(a)));
 if(d.buff&&d.buff!=='manaSpring')for(const a of allies){
  if(a.meta.groupBuffs?.includes(d.buff))continue;
  // The strongest in-range totem of a category wins; a tie has one stable owner.
  const peers=state.list.filter(q=>q.alive&&q.kind==='totem'&&q.side===t.side&&q.meta.buff===d.buff&&G.dist(q,a)<=30).sort((x,y)=>y.level-x.level||x.id.localeCompare(y.id));
  if(peers[0]!==t)continue;
  const prior=api.findAura(a,'totem.'+d.buff,t.id);if(prior){prior.remaining=.3;continue;}
  const buff=BUFFS[d.buff]?.[owner.level]||{};
  const opts={classId:a.classId||'shaman',race:a.meta.race||'orc',level:a.level};
  const base=deriveStats(opts),boost=deriveStats({...opts,buffs:buff});
  api.applyAura(state,t,a,{id:'totem.'+d.buff,name:t.name,icon:'shield',duration:.3,unique:'target',mods:{
   statAdd:{ap:boost.stats.ap-base.stats.ap,rap:boost.stats.rap-base.stats.rap,armor:boost.armor-base.armor},
   crit:{physical:boost.stats.critPhys-base.stats.critPhys},dodge:boost.stats.dodge-base.stats.dodge}});
 }
 if(d.slow)for(const e of api.enemiesOf(state,owner,e=>e.engaged&&G.dist(e,t)<=10)){const prior=api.findAura(e,'shaman.earthbind.slow',t.id);if(prior){prior.remaining=.3;continue;}api.applyAura(state,t,e,{id:'shaman.earthbind.slow',name:'Earthbind',icon:'roots',duration:.3,debuff:true,mods:{slow:.5}});}
 if(state.t+1e-8<d.next)return;
 d.next+=d.interval||2;
 const rank=owner.level>=60?60:owner.level>=30?30:10;
 const manaPower=q=>{const o=api.U(state,q.ownerId);return (q.meta.mana?.[o?.level]||0)*(o?.meta.talents?.restorativeMana||1);};
 const strongestFor=a=>state.list.filter(q=>q.alive&&q.kind==='totem'&&q.side===t.side&&q.meta.buff===d.buff&&G.dist(q,a)<=30&&groupOf(api.U(state,q.ownerId)||q)===groupOf(a)).sort((x,y)=>manaPower(y)-manaPower(x)||x.id.localeCompare(y.id))[0]===t;

 if(d.mana)for(const a of allies)if(a.res.mana&&!(d.buff&&a.meta.groupBuffs?.includes(d.buff))&&(!d.buff||strongestFor(a))){const n=(typeof d.mana==='object'?d.mana[rank]:d.mana)*(d.buff==='manaSpring'?(owner.meta.talents?.restorativeMana||1):1);a.res.mana.cur=Math.min(a.res.mana.max,a.res.mana.cur+n);api.emit(state,{type:'resource',src:owner.id,dst:a.id,ability:d.ability,resource:'mana',amount:n});}
 if(d.heal)for(const a of allies)api.healUnit(state,owner,a,{amount:d.heal[rank]*(owner.meta.talents?.restorativeHeal||1),coef:.045*(owner.meta.talents?.restorativeHeal||1),isTick:true,canCrit:false,ability:d.ability});
 if(d.damage){const foe=api.nearest(api.enemiesOf(state,owner,e=>e.engaged&&!e.cc.incap&&G.dist(e,t)<=20&&G.hasLoS(state.arena,t,e)),t);if(foe)api.dealDamage(state,owner,foe,{amount:Array.isArray(d.damage[rank])?d.damage[rank][0]+state.rng()*(d.damage[rank][1]-d.damage[rank][0]):d.damage[rank],coef:.083,school:'fire',ability:d.ability});}
}
export function recallTotems({state,u,api}){
 let refund=0;for(const t of activeTotems(state,u)){refund+=t.meta.manaPaid*.25;dismissTotem(state,api,t);}
 u.res.mana.cur=Math.min(u.res.mana.max,u.res.mana.cur+refund);
}
export function projectTotems({state,u,api,point}){
 for(const t of activeTotems(state,u)){const [dx,dy]=offsets[t.meta.element];t.x=point.x+dx;t.y=point.y+dy;G.collide(state.arena,t);}
}
