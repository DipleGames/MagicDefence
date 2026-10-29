/* Pure combat simulation shared by the browser and Node regression tests. */
(function(root){
'use strict';
const TYPES={
 slime:{name:'이끼 슬라임',hp:52,damage:8,speed:1.3,xp:12,gold:4,color:'#78b877',radius:.5},
 runner:{name:'가시 추적자',hp:44,damage:11,speed:2.35,xp:14,gold:5,color:'#cf715c',radius:.43},
 wisp:{name:'수정 사수',hp:62,damage:13,speed:1.15,xp:18,gold:6,color:'#9c7bc5',radius:.45},
 thrower:{name:'바위 투척병',hp:76,damage:14,speed:1.35,xp:18,gold:6,color:'#bc945b',radius:.6},
 tank:{name:'석갑 수호병',hp:160,damage:20,speed:1.0,xp:26,gold:9,color:'#82949d',radius:.7},
 guardian:{name:'고대 석상왕',hp:660,damage:26,speed:1.05,xp:180,gold:80,color:'#b79967',radius:1.25,boss:true},
 ember:{name:'잿불 대마도사',hp:600,damage:24,speed:1.15,xp:180,gold:80,color:'#dd7955',radius:1.1,boss:true},
 storm:{name:'폭풍의 파수꾼',hp:630,damage:28,speed:1.35,xp:180,gold:80,color:'#75adbf',radius:1.15,boss:true}
};
const SPELLS={arcane:{base:18,ratio:1.25,radius:4},fire:{base:32,ratio:1.8,radius:4.8},ice:{base:14,ratio:.9,radius:4.5},ultimate:{base:80,ratio:3.8,radius:8}};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function stats(level){const n=level-1;return {maxHp:160+24*n,maxMana:100+8*n,power:24+6*n,armor:5+2*n,speed:Math.min(4.3,3.5+.04*n),manaRegen:7+.3*n,attackInterval:.85/(1+.04*n),haste:Math.min(.3,.015*n)};}
function xpRequired(level){const n=level-1;return 60+30*n+10*n*n;}
function stagePlan(stage){
 if(!Number.isInteger(stage)||stage<1)throw Error('Stage must be a positive integer');
 const boss=stage%10===0;
 if(boss)return {stage,boss:true,types:[['guardian','ember','storm'][(Math.floor(stage/10)-1)%3],...Array.from({length:Math.min(6,2+Math.floor(stage/10))},(_,i)=>['thrower','slime','runner'][i%3])]};
 const pool=['slime'];if(stage>=2)pool.push('thrower');if(stage>=3)pool.push('runner');if(stage>=5)pool.push('wisp');if(stage>=7)pool.push('tank');
 return {stage,boss:false,types:Array.from({length:Math.min(24,4+stage)},(_,i)=>pool[(i+stage-1)%pool.length])};
}
class DefenceGame{
 constructor(){this.reset();}
 reset(){
  const fresh={x:0,z:0,targetX:0,targetZ:0,facing:0,level:1,xp:0,gold:0,hp:160,mana:100,...stats(1)};
  if(this.hero)Object.assign(this.hero,fresh);else this.hero=fresh;
  this.time=0;this.stage=0;this.phase='intermission';this.nextStageAt=2;this.enemies=[];this.projectiles=[];this.hazards=[];this.numbers=[];this.events=[];this.nextAttackAt=0;this.invulnerableUntil=0;this.kills=0;this.nextId=1;
  this.arena={left:-15,right:15,top:-8,bottom:8,angle:0};
 }
 setArena(arena){this.arena={...arena};for(const enemy of this.enemies)Object.assign(enemy,this.clampPoint(enemy));}
 clampPoint(point){const a=this.arena,c=Math.cos(a.angle),s=Math.sin(a.angle),rx=Math.max(a.left,Math.min(a.right,point.x*c-point.z*s)),rz=Math.max(a.top,Math.min(a.bottom,point.x*s+point.z*c));return {x:rx*c+rz*s,z:-rx*s+rz*c};}
 notify(text,kind='info'){this.events.push({text,kind,until:this.time+3});if(this.events.length>5)this.events.shift();}
 startStage(stage){
  this.stage=stage;this.phase='fighting';this.projectiles=[];this.hazards=[];this.enemies=[];
  const plan=stagePlan(stage),a=this.arena,c=Math.cos(a.angle),s=Math.sin(a.angle);
  plan.types.forEach((type,i)=>{
   // Spawn around the perimeter, with a minimum separation from the hero.
   const t=(i+.5)/plan.types.length*Math.PI*2,rx=(a.left+a.right)/2+Math.cos(t)*(a.right-a.left)*.43,rz=(a.top+a.bottom)/2+Math.sin(t)*(a.bottom-a.top)*.43;
   let p={x:rx*c+rz*s,z:-rx*s+rz*c};
   if(distance(p,this.hero)<4){let best=p;for(const x of [a.left,a.right])for(const z of [a.top,a.bottom]){const candidate={x:x*c+z*s,z:-x*s+z*c};if(distance(candidate,this.hero)>distance(best,this.hero))best=candidate;}p=best;}
   const base=TYPES[type],growth=1+.12*(stage-1),attackGrowth=1+.075*(stage-1),hp=Math.round(base.hp*growth);
   this.enemies.push({...base,...p,type,id:this.nextId++,hp,maxHp:hp,damage:Math.round(base.damage*attackGrowth),speed:base.speed*Math.min(1.65,1+.015*(stage-1)),xp:Math.round(base.xp*(1+.06*(stage-1))),gold:Math.round(base.gold*(1+.04*(stage-1))),facing:0,nextAttack:this.time+2+i*.12,activeAt:this.time+1.2,slowedUntil:0,flashUntil:0});
  });
  this.notify(plan.boss?`BOSS · ${this.enemies[0].name}`:`STAGE ${String(stage).padStart(2,'0')}` ,plan.boss?'boss':'stage');
 }
 gainXp(amount){
  this.hero.xp+=amount;
  while(this.hero.xp>=xpRequired(this.hero.level)){
   this.hero.xp-=xpRequired(this.hero.level);const oldMax=this.hero.maxHp,oldMana=this.hero.maxMana;this.hero.level++;Object.assign(this.hero,stats(this.hero.level));
   this.hero.hp=Math.min(this.hero.maxHp,this.hero.hp+this.hero.maxHp-oldMax+this.hero.maxHp*.15);this.hero.mana=Math.min(this.hero.maxMana,this.hero.mana+this.hero.maxMana-oldMana+this.hero.maxMana*.15);
   this.notify(`LEVEL UP · Lv.${this.hero.level}  체력 +24 · 마법 공격력 +6`,'level');
  }
 }
 damageEnemy(enemy,amount){
  if(enemy.hp<=0)return false;enemy.hp=Math.max(0,enemy.hp-amount);enemy.flashUntil=this.time+.13;
  this.numbers.push({x:enemy.x,z:enemy.z,text:String(Math.round(amount)),color:'#fff1b2',until:this.time+.65});
  if(enemy.hp===0){this.kills++;this.hero.gold+=enemy.gold;this.gainXp(enemy.xp);return true;}return false;
 }
 damageHero(raw){
  if(this.phase!=='fighting'||this.time<this.invulnerableUntil)return;
  const amount=Math.max(1,Math.round(raw*100/(100+this.hero.armor)));this.hero.hp=Math.max(0,this.hero.hp-amount);this.invulnerableUntil=this.time+.45;
  this.numbers.push({x:this.hero.x,z:this.hero.z,text:`−${amount}`,color:'#ff8d7c',until:this.time+.7});
  if(this.hero.hp===0){this.phase='defeat';this.projectiles=[];this.hazards=[];this.notify('도전 종료','defeat');}
 }
 castSpell(id){
  if(this.phase!=='fighting')return 0;const ability=SPELLS[id];if(!ability)return 0;const damage=Math.round(ability.base+this.hero.power*ability.ratio);let hits=0;
  for(const enemy of this.enemies){if(enemy.hp<=0||enemy.activeAt>this.time||distance(enemy,this.hero)>ability.radius+enemy.radius)continue;
   this.damageEnemy(enemy,damage);hits++;
   if(id==='ice')enemy.slowedUntil=this.time+3;
  }return hits;
 }
 shoot(from,to,damage,hostile,speed=8,offset=0){const angle=Math.atan2(to.z-from.z,to.x-from.x)+offset;this.projectiles.push({x:from.x,z:from.z,vx:Math.cos(angle)*speed,vz:Math.sin(angle)*speed,damage,hostile,speed,targetId:to.id,life:5});}
 lobRock(enemy,point){const duration=Math.max(.65,distance(enemy,point)/9);this.projectiles.push({kind:'rock',x:enemy.x,z:enemy.z,startX:enemy.x,startZ:enemy.z,targetX:point.x,targetZ:point.z,elapsed:0,duration,radius:1.1,damage:enemy.damage,hostile:true,life:duration+.1});}
 addHazard(enemy,point,radius,delay=1){this.hazards.push({x:point.x,z:point.z,radius,damage:enemy.damage*1.5,resolveAt:this.time+delay,start:this.time,sourceId:enemy.id});}
 bossAttack(enemy){
  if(enemy.type==='guardian'){this.addHazard(enemy,this.hero,2.4,1.1);this.addHazard(enemy,enemy,3,1.3);}
  if(enemy.type==='ember'){for(const offset of [-.35,0,.35])this.shoot(enemy,this.hero,enemy.damage,true,4.5,offset);this.addHazard(enemy,this.hero,1.8,1.2);}
  if(enemy.type==='storm'){for(let i=0;i<10;i++)this.shoot(enemy,{x:enemy.x+Math.cos(i*Math.PI/5),z:enemy.z+Math.sin(i*Math.PI/5)},enemy.damage,true,3.4);this.addHazard(enemy,this.hero,2,1);}
 }
 update(dt){
  if(!Number.isFinite(dt)||dt<=0||this.phase==='defeat')return;dt=Math.min(dt,.1);this.time+=dt;
  this.hero.mana=Math.min(this.hero.maxMana,this.hero.mana+this.hero.manaRegen*dt);
  this.numbers=this.numbers.filter(n=>n.until>this.time);this.events=this.events.filter(e=>e.until>this.time);
  if(this.phase==='intermission'){if(this.time>=this.nextStageAt)this.startStage(this.stage+1);return;}
  for(const enemy of this.enemies){
   if(this.phase==='defeat')break;
   if(enemy.hp<=0||this.time<enemy.activeAt)continue;
   const dx=this.hero.x-enemy.x,dz=this.hero.z-enemy.z,d=Math.hypot(dx,dz),ranged=enemy.type==='wisp'||enemy.type==='thrower',range=ranged?7:enemy.radius+.6;
   enemy.facing=Math.atan2(dx,dz);
   if(enemy.windup){
    if(this.time>=enemy.windup.fireAt){
     if(enemy.type==='thrower')this.lobRock(enemy,enemy.windup);
     else for(const offset of [-.11,.11])this.shoot(enemy,enemy.windup,enemy.damage,true,5.8,offset);
     enemy.windup=null;enemy.nextAttack=this.time+(enemy.type==='thrower'?2.6:1.8);
    }
    continue;
   }
   const direction=d>range?1:ranged&&d<4?-1:0;
   if(direction&&d>0){const step=Math.min(direction>0?d-range:4-d,enemy.speed*(enemy.slowedUntil>this.time?.4:1)*dt);Object.assign(enemy,this.clampPoint({x:enemy.x+dx/d*step*direction,z:enemy.z+dz/d*step*direction}));}
   if(this.time>=enemy.nextAttack){
    if(enemy.boss){this.bossAttack(enemy);enemy.nextAttack=this.time+3.8;}
    else if(ranged&&d<=12){enemy.windup={x:this.hero.x,z:this.hero.z,fireAt:this.time+(enemy.type==='thrower'?.6:.45)};}
    else if(d<=range+.1){this.damageHero(enemy.damage);enemy.nextAttack=this.time+1.2;}
   }
  }
  if(this.phase==='defeat')return;
  // Nearest target auto attack continues while moving; skills provide crowd control and burst.
  const target=this.enemies.filter(e=>e.hp>0&&e.activeAt<=this.time&&distance(e,this.hero)<=8).sort((a,b)=>distance(a,this.hero)-distance(b,this.hero))[0];
  if(target&&this.time>=this.nextAttackAt){this.shoot(this.hero,target,Math.round(this.hero.power*.85),false,10);this.nextAttackAt=this.time+this.hero.attackInterval;}
  for(const p of this.projectiles){
   if(p.kind==='rock'){
    p.elapsed+=dt;const progress=Math.min(1,p.elapsed/p.duration);p.x=p.startX+(p.targetX-p.startX)*progress;p.z=p.startZ+(p.targetZ-p.startZ)*progress;
    if(progress>=1){if(distance(this.hero,{x:p.targetX,z:p.targetZ})<=p.radius+.35)this.damageHero(p.damage);p.life=0;}else p.life=p.duration-p.elapsed;
    continue;
   }
   if(!p.hostile){const target=this.enemies.find(e=>e.id===p.targetId&&e.hp>0);if(target){const d=distance(p,target);if(d>0){p.vx=(target.x-p.x)/d*p.speed;p.vz=(target.z-p.z)/d*p.speed;}}}
   const old={x:p.x,z:p.z};p.x+=p.vx*dt;p.z+=p.vz*dt;p.life-=dt;
   const targets=p.hostile?[this.hero]:this.enemies.filter(e=>e.hp>0&&e.activeAt<=this.time);
   for(const t of targets){const vx=p.x-old.x,vz=p.z-old.z,length=vx*vx+vz*vz,f=length?Math.max(0,Math.min(1,((t.x-old.x)*vx+(t.z-old.z)*vz)/length)):0;
    if(Math.hypot(old.x+vx*f-t.x,old.z+vz*f-t.z)<(t.radius||.45)+.15){if(p.hostile)this.damageHero(p.damage);else this.damageEnemy(t,p.damage);p.life=0;break;}
   }
  }
  if(this.phase==='defeat'){this.projectiles=[];this.hazards=[];return;}
  this.projectiles=this.projectiles.filter(p=>p.life>0);
  for(const hazard of this.hazards){if(hazard.resolveAt<=this.time){const source=this.enemies.find(e=>e.id===hazard.sourceId&&e.hp>0);if(source&&distance(hazard,this.hero)<=hazard.radius+.35)this.damageHero(hazard.damage);}}
  this.hazards=this.hazards.filter(h=>h.resolveAt>this.time&&this.enemies.some(e=>e.id===h.sourceId&&e.hp>0));
  this.enemies=this.enemies.filter(e=>e.hp>0);
  if(this.phase==='fighting'&&this.enemies.length===0){
   const reward=20+this.stage*4;this.gainXp(reward);this.hero.gold+=10+this.stage*2;
   this.hero.hp=Math.min(this.hero.maxHp,this.hero.hp+this.hero.maxHp*.2);this.hero.mana=Math.min(this.hero.maxMana,this.hero.mana+this.hero.maxMana*.25);
   this.projectiles=[];this.hazards=[];this.phase='intermission';this.nextStageAt=this.time+3;this.notify(`STAGE ${this.stage} CLEAR · 경험치 +${reward}`,'clear');
  }
 }
}
if(typeof module!=='undefined'&&module.exports)module.exports={DefenceGame,TYPES,SPELLS,stats,xpRequired,stagePlan};else root.DefenceGame=DefenceGame;
})(typeof globalThis!=='undefined'?globalThis:this);
