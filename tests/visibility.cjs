const {DefenceGame}=require('../src/combat.js');
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/game.js'), 'utf8');
for (const [width, height] of [[1280,720], [1920,1080], [2560,1440], [800,600]]) {
  const handlers = {};
  const ctx = new Proxy({
    createLinearGradient: () => ({addColorStop() {}}),
    createRadialGradient: () => ({addColorStop() {}}),
  }, {get: (object, key) => object[key] || (() => {})});
  const canvas = {
    getContext: () => ctx,
    getBoundingClientRect: () => ({width, height, left: 10, top: 20}),
    addEventListener: (name, handler) => { handlers[name] = handler; },
  };
  const context = vm.createContext({DefenceGame,
    document: {
      querySelector: selector => selector === '#world' ? canvas : {addEventListener() {},style:{},dataset:{},setAttribute() {}},
      addEventListener() {},
      querySelectorAll: () => [],
    },
    matchMedia: () => ({matches: false}),
    ResizeObserver: class { constructor(callback) { this.callback = callback; } observe() { this.callback(); } },
    devicePixelRatio: 1,
    requestAnimationFrame() {},
  });
  const run = code => vm.runInContext(code, context);
  run(source);
  run(`
    for(let i=0;i<32;i++){
      angle=targetAngle=i*Math.PI/16;
      fitView();
      for(const px of [0,w/2,w])
      for(const py of [0,h/2,h])
      for(let facing=0;facing<4;facing++){
        const ground=groundPoint(px,py),destination=nearestDestination(ground[0],ground[2]);
        player.x=destination.x;player.z=destination.z;player.facing=facing*Math.PI/2;render(1000);
        let actorSeen=false;
        for(const face of faces){
          if(face.layer===1){
            actorSeen=true;
            for(const [px,py] of face.p)if(px<0||px>w||py<0||py>h)throw Error('Character clipped: '+px+', '+py+' in '+w+'x'+h);
          }else {
            if(actorSeen)throw Error('Ground covers character');
            for(const [px,py] of face.p)if(px<stageRect.left-1e-6||px>stageRect.right+1e-6||py<stageRect.top-1e-6||py>stageRect.bottom+1e-6)throw Error('Tiles extend beyond visible platform');
          }
        }
        if(!actorSeen)throw Error('Character missing');
      }
    }
  `);
  assert(run('camera.x===0 && camera.z===0'), 'camera stays fixed');
  run('player.x=0;player.z=0;angle=targetAngle=Math.PI/4;fitView()');
  const point = run('project([2,0,3])');
  handlers.pointerdown({button: 2, clientX: point[0]+10, clientY: point[1]+20, preventDefault() {}});
  assert(run('Math.abs(player.targetX-2)<1e-9 && Math.abs(player.targetZ-3)<1e-9'), 'click matches resized/rotated ground');
}
console.log('PASS: character visibility and ground ordering at all edges, 32 angles, four facings, four PC viewport sizes; visible-platform navigation, fixed camera and accurate clicks');
