const assert=require('node:assert/strict');
const {DefenceGame}=require('../src/combat.js');
const advance=(g,t)=>{for(let i=0;i<Math.ceil(t/.01);i++)g.update(.01);};
function arena(points){const g=new DefenceGame();g.startStage(1);g.enemies=points.map((p,i)=>({...g.enemies[i],...p,hp:500,maxHp:500,activeAt:0,nextAttack:1e6,speed:0}));g.nextAttackAt=1e6;return g;}
{
 const g=arena([{x:3,z:0},{x:6,z:0}]);g.castSpell('arcane',{x:10,z:0});assert.equal(g.enemies[0].hp,500,'Q cannot hit instantly');const q=g.projectiles[0];assert.equal(q.kind,'arcane');assert.equal(q.vz,0);advance(g,.25);assert.equal(g.enemies[0].hp,442);assert.equal(g.enemies[1].hp,500,'Q stops at first target');assert.equal(g.projectiles.length,0);
}
{
 const g=arena([{x:5,z:0}]);g.castSpell('arcane',{x:10,z:0});g.enemies[0].z=3;advance(g,1);assert.equal(g.enemies[0].hp,500,'Q is dodgeable and does not home');assert.equal(g.projectiles.length,0,'Q expires at max range');
}
{
 const g=arena([{x:4,z:0},{x:-4,z:0}]);g.castSpell('fire',{x:4,z:0});advance(g,.6);assert.equal(g.enemies[0].hp,500);advance(g,.15);assert.equal(g.enemies[0].hp,439,'meteor impacts at aimed point');assert.equal(g.enemies[1].hp,500,'W is not centered on hero');advance(g,.5);assert.equal(g.enemies[0].hp,425,'burn damages after impact');g.enemies[0].z=5;const hp=g.enemies[0].hp;advance(g,1);assert.equal(g.enemies[0].hp,hp,'leaving burn area avoids ticks');
}
{
 const g=arena([{x:14,z:0}]);g.castSpell('fire',{x:100,z:0});assert.equal(g.effects[0].x,9,'W has a target range limit');
}
{
 const g=arena([{x:7,z:0}]);g.hero.targetX=-5;g.castSpell('ice',{x:10,z:0});assert.equal(g.hero.x,5,'E immediately blinks five units toward cursor');assert.equal(g.hero.targetX,5,'old move target is replaced');assert(g.invulnerableUntil>g.time);assert.equal(g.enemies[0].hp,500);assert(g.projectiles.some(p=>p.kind==='blinkBolt'));advance(g,.2);assert.equal(g.enemies[0].hp,464,'E fires one nearby homing bolt');
}
{
 const g=arena([{x:-10,z:-5}]);g.hero.x=14;g.castSpell('ice',{x:30,z:0});assert.equal(g.hero.x,15,'E respects arena edge');assert.equal(g.projectiles.length,0,'no enemy nearby means no extra bolt');
}
{
 const g=arena([{x:4,z:0},{x:10,z:.7},{x:7,z:4},{x:-4,z:0}]);g.castSpell('ultimate',{x:20,z:0});advance(g,.5);assert(g.enemies.every(e=>e.hp===500),'R charges before damaging');advance(g,.15);assert.equal(g.enemies[0].hp,309);assert.equal(g.enemies[1].hp,309,'R pierces all targets in its line');assert.equal(g.enemies[2].hp,500);assert.equal(g.enemies[3].hp,500,'R does not hit behind caster');advance(g,.4);assert.equal(g.enemies[0].hp,309,'R damage applies once');
}
{
 const g=arena([{x:7,z:0}]);g.castSpell('fire',{x:7,z:0});g.damageHero(1e6);assert.equal(g.effects.length,0,'death clears outstanding spell effects');const hp=g.enemies[0].hp;advance(g,2);assert.equal(g.enemies[0].hp,hp);
}
console.log('PASS: aimed Q travel/first-hit/miss, ranged W impact/burn/escape, immediate E blink/bounds/bolt, charged piercing R direction and single damage');
