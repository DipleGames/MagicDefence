const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/game.js'), 'utf8');
for (const [width, height] of [[390, 844], [320, 580], [480, 1040]]) {
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
  const context = vm.createContext({
    document: {
      querySelector: selector => selector === '#world' ? canvas : {addEventListener() {}},
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
      for(const x of [-FIELD.halfWidth,0,FIELD.halfWidth])
      for(const z of [-FIELD.halfDepth,0,FIELD.halfDepth])
      for(let facing=0;facing<4;facing++){
        player.x=x;player.z=z;player.facing=facing*Math.PI/2;render(1000);
        let actorSeen=false;
        for(const face of faces){
          if(face.layer===1){
            actorSeen=true;
            for(const [px,py] of face.p)if(px<0||px>w||py<210||py>h-200)throw Error('Character clipped or behind UI');
          }else if(actorSeen)throw Error('Ground covers character');
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
console.log('PASS: character visibility and ground ordering at all edges, 32 angles, four facings, three viewport sizes; fixed camera and accurate clicks');
