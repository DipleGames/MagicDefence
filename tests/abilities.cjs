const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const events={},elements=new Map();
const element=()=>({style:{},classList:{toggle(){}},setAttribute(){},addEventListener(){}});
const buttons=['arcane','fire','ice','ultimate'].map(id=>({...element(),dataset:{spell:id},querySelector:()=>({textContent:''})}));
const canvas={getContext:()=>({}),addEventListener(){}};
const context=vm.createContext({document:{querySelector:id=>{if(id==='#world')return canvas;if(!elements.has(id))elements.set(id,element());return elements.get(id);},querySelectorAll:()=>buttons,addEventListener:(name,handler)=>events[name]=handler},matchMedia:()=>({matches:false}),ResizeObserver:class{observe(){}},requestAnimationFrame(){}});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../src/game.js'),'utf8'),context);
const run=code=>vm.runInContext(code,context);
const press=code=>events.keydown({code,preventDefault(){}});
for(const [key,id] of [['KeyQ','arcane'],['KeyW','fire'],['KeyE','ice'],['KeyR','ultimate']]){
 run('mana=100;gameTime=100');press(key);assert.equal(run('spell'),id);assert.equal(run('mana'),100-run(`abilities.${id}.cost`));const remaining=run('mana');press(key);assert.equal(run('mana'),remaining,'cooldown blocks repeat casts');assert(run(`readyAt.${id}>gameTime`));
}
run('gameTime=200;mana=0');assert.equal(run("cast('arcane')"),false,'insufficient mana');
run('mana=100;paused=true');press('KeyQ');assert.equal(run('mana'),100,'pause blocks skills');press('Escape');assert.equal(run('paused'),false);press('KeyQ');assert.equal(run('mana'),88);
run('gameTime=300;mana=100');events.keydown({code:'KeyW',repeat:true});assert.equal(run('mana'),100,'held key does not repeatedly cast');events.keydown({code:'KeyW',target:{closest:()=>true}});assert.equal(run('mana'),100,'typing does not cast');
console.log('PASS: QWER bindings, four abilities, mana costs, cooldown, pause, repeated keys and text inputs');
