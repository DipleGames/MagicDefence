const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = vm.createContext({document:{querySelector:()=>({getContext(){}})}});
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/game.js'), 'utf8');
vm.runInContext(source.slice(0, source.indexOf('const reduced=')), context);
const run = code => vm.runInContext(code, context);
run('player.x=.13;player.z=.27;route=findRoute(3.17,1.11)');
assert.equal(run('route.length'), 1, 'open ground uses one exact straight segment');
run('updateMovement(.1)');
assert(Math.abs(run('Math.hypot(player.x-.13,player.z-.27)')-.35)<1e-9);
assert(run('player.facing>0 && player.facing<Math.atan2(3.17-.13,1.11-.27)'), 'turn interpolates');
run('for(let i=0;i<200;i++)updateMovement(.016)');
assert(run('player.x===3.17 && player.z===1.11 && route.length===0'), 'exact stop without overshoot');
// Use an explicit fixture to retain coverage of the reusable path planner.
run('obstacles.push({x:-2.5,z:-3,w:2,d:1.5});player.x=-2.5;player.z=0;route=findRoute(-2.5,-7)');
assert(run('route && route.length>1'), 'obstacle needs a detour');
run('let prior={x:player.x,z:player.z};for(const next of route){if(!clearSegment(prior,next))throw Error("unsafe path");prior=next;}');
run('for(let i=0;i<600;i++){updateMovement(.016);if(!walkable(player.x,player.z))throw Error("collision");}');
assert.equal(run('player.z'), -7);
assert(run('walkable(...Object.values(nearestDestination(-2.5,-3)))'), 'blocked click resolves to nearby floor');
assert(run('nearestDestination(100,100).x===18 && nearestDestination(100,100).z===28'));
run('player.x=0;player.z=0;route=findRoute(4,0);updateMovement(.1);route=findRoute(-4,1);for(let i=0;i<300;i++)updateMovement(.016)');
assert(run('player.x===-4 && player.z===1'), 'mid-move command replaces old route');
run('obstacles.length=0;route=findRoute(15,24)');
assert.equal(run('route.length'),1,'expanded field has no obstacles');
run('for(let i=0;i<1500;i++)updateMovement(.016)');
assert(run('player.x===15 && player.z===24'),'distant field destination is reachable');
// Deterministic broad coverage of fractional destinations and detours.
run(`let seed=7;function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
for(let i=0;i<150;i++){
 const destination=nearestDestination(rnd()*36-18,rnd()*56-28);
 const path=findRoute(destination.x,destination.z);if(!path)throw Error('unreachable valid destination');
 let a={x:player.x,z:player.z};for(const b of path){if(!clearSegment(a,b))throw Error('unsafe segment');a=b;}
 route=path;for(let j=0;j<1500&&route.length;j++){updateMovement(.02);if(!walkable(player.x,player.z))throw Error('collision');}
 if(route.length||Math.hypot(player.x-destination.x,player.z-destination.z)>1e-8)throw Error('arrival');
}`);
console.log('PASS: straight movement, speed, smooth facing, precise arrival, obstacle avoidance, blocked clicks, retargeting, 150 fractional routes');
