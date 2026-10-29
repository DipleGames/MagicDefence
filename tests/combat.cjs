const assert=require('node:assert/strict');
const {DefenceGame,stagePlan,stats,xpRequired,TYPES}=require('../src/combat.js');
const advance=(g,seconds)=>{for(let i=0;i<Math.ceil(seconds/.02);i++)g.update(.02);};
for(let stage=1;stage<=100;stage++){
 const plan=stagePlan(stage);assert.equal(plan.boss,stage%10===0);assert.equal(plan.types.filter(t=>TYPES[t].boss).length,stage%10===0?1:0);
}
assert(!stagePlan(2).types.includes('runner'));assert(stagePlan(3).types.includes('runner'));assert(stagePlan(5).types.includes('wisp'));assert(stagePlan(7).types.includes('tank'));
assert.equal(stagePlan(10).types[0],'guardian');assert.equal(stagePlan(20).types[0],'ember');assert.equal(stagePlan(30).types[0],'storm');assert.equal(stagePlan(40).types[0],'guardian');
{
 const g=new DefenceGame();advance(g,2.1);assert.equal(g.stage,1);assert.equal(g.enemies.length,5);
 const enemy=g.enemies[0],xp=g.hero.xp,gold=g.hero.gold;
 g.damageEnemy(enemy,1e6);assert.equal(g.kills,1);const gained=g.hero.xp,paid=g.hero.gold;g.damageEnemy(enemy,1e6);assert.equal(g.hero.xp,gained);assert.equal(g.hero.gold,paid);assert(paid>gold&&gained>xp);
 g.enemies.slice(1).forEach(e=>g.damageEnemy(e,1e6));g.update(.02);assert.equal(g.phase,'intermission');assert.equal(g.stage,1);assert.equal(g.hero.level,2);assert.equal(g.hero.xp,24);assert.equal(g.hero.maxHp,184);assert.equal(g.hero.power,30);
 advance(g,2.5);assert.equal(g.stage,1);advance(g,.6);assert.equal(g.stage,2);assert.equal(g.phase,'fighting');
}
{
 const g=new DefenceGame();const sameHero=g.hero;g.gainXp(60+100+160+17);assert.equal(g.hero.level,4);assert.equal(g.hero.xp,17);assert.equal(g.hero.maxMana,124);assert.equal(g.hero.armor,11);assert(g.hero.hp<=g.hero.maxHp);g.reset();assert.equal(g.hero,sameHero);assert.equal(g.hero.level,1);assert.equal(g.stage,0);
}
{
 const g=new DefenceGame();g.startStage(10);const boss=g.enemies.find(e=>e.boss);g.enemies.filter(e=>!e.boss).forEach(e=>g.damageEnemy(e,1e6));g.update(.02);assert.equal(g.phase,'fighting','boss still alive');g.damageEnemy(boss,1e6);g.update(.02);assert.equal(g.phase,'intermission');assert.equal(g.hazards.length,0);advance(g,3.1);assert.equal(g.stage,11);
}
{
 const g=new DefenceGame();g.startStage(1);g.enemies.forEach(e=>{e.x=0;e.z=0;e.hp=e.maxHp=100;e.activeAt=0;e.nextAttack=100;});assert.equal(g.castSpell('ice'),5);assert(g.enemies.every(e=>e.slowedUntil===3));const hp=g.enemies[0].hp;g.castSpell('arcane');assert(g.enemies[0].hp<hp);g.castSpell('ultimate');assert(g.kills>0);
}
{
 const g=new DefenceGame();g.startStage(1);g.damageHero(21);assert.equal(g.hero.hp,140);g.damageHero(100);assert.equal(g.hero.hp,140,'hit grace prevents burst stacking');advance(g,.5);g.damageHero(1e6);assert.equal(g.phase,'defeat');const time=g.time;advance(g,10);assert.equal(g.time,time,'defeat freezes simulation');assert.equal(g.stage,1);
}
{
 const g=new DefenceGame();g.startStage(10);g.enemies.filter(e=>!e.boss).forEach(e=>g.damageEnemy(e,1e6));const boss=g.enemies.find(e=>e.boss);boss.nextAttack=100;boss.activeAt=100;
 g.addHazard(boss,{x:0,z:0},2,.5);advance(g,.4);assert.equal(g.hero.hp,160,'telegraph does no early damage');g.hero.x=6;advance(g,.2);assert.equal(g.hero.hp,160,'moving avoids hazard');
 g.addHazard(boss,g.hero,2,.5);advance(g,.6);assert(g.hero.hp<160,'standing in warning takes damage');
}
{
 const g=new DefenceGame();g.startStage(1);g.enemies=[{...g.enemies[0],x:3,z:0,hp:10,maxHp:10,activeAt:0,nextAttack:100,speed:0}];g.nextAttackAt=100;g.shoot(g.hero,g.enemies[0],20,false,100);g.update(.1);assert.equal(g.kills,1,'swept projectile hit does not tunnel');assert.equal(g.phase,'intermission');
}
{
 // No injected kills: baseline auto-attacks can complete the introductory stage.
 const g=new DefenceGame();for(let i=0;i<3000&&g.stage<2&&g.phase!=='defeat';i++)g.update(.02);assert.equal(g.stage,2);assert.equal(g.kills,5);assert.equal(g.hero.level,2);
}
{
 const g=new DefenceGame();g.startStage(10);const boss=g.enemies.find(e=>e.boss);g.addHazard(boss,g.hero,2,.5);g.damageEnemy(boss,1e7);g.update(.02);assert.equal(g.hazards.length,0,'killing a boss cancels its pending attacks even with escorts alive');assert.equal(g.phase,'fighting');
}
{
 const g=new DefenceGame();g.startStage(1);const enemy=g.enemies[0];enemy.x=12;enemy.z=0;enemy.activeAt=0;const hp=enemy.hp;g.castSpell('arcane');assert.equal(enemy.hp,hp,'range-limited spells cannot hit distant enemies');
}
for(let level=1;level<100;level++){assert(xpRequired(level+1)>xpRequired(level));assert(stats(level+1).maxHp>stats(level).maxHp);assert(stats(level+1).power>stats(level).power);}
console.log('PASS: 100 stage plans, boss cadence/rotation, complete-stage transitions, XP and multi-level growth, rewards once, real auto-attack clear, skills/slow, telegraphs, swept hits, death/restart');
