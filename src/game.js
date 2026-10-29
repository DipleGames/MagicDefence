'use strict';
// Small dependency-free polygon renderer. All scenery and the mage are 3D meshes.
const canvas=document.querySelector('#world'),ctx=canvas.getContext('2d');
let w=0,h=0,scale=1,angle=0,targetAngle=0,spell='arcane',pulse=-10,now=0;
const player={x:0,z:0,targetX:0,targetZ:0,facing:0};
let previousFrame=null,meshOrigin=null;
const MOVE_SPEED=3.5;
const FIELD={halfWidth:6,halfDepth:8};
const GROUND=FIELD;
let viewY=0;
let navigation=null;
const camera={x:0,z:0};
const obstacles=[];
let route=[];
function walkable(x,z){
 const c=Math.cos(angle),s=Math.sin(angle),rx=x*c-z*s,rz=x*s+z*c;
 const inside=navigation?rx>=navigation.left-1e-8&&rx<=navigation.right+1e-8&&rz>=navigation.top-1e-8&&rz<=navigation.bottom+1e-8:Math.abs(x)<=FIELD.halfWidth&&Math.abs(z)<=FIELD.halfDepth;
 return inside && !obstacles.some(o=>Math.abs(x-o.x)<o.w/2+.7 && Math.abs(z-o.z)<o.d/2+.7);}
// Visibility graph: exact straight segments and obstacle corners, without grid snapping.
function clearSegment(a,b){
 if(!walkable(a.x,a.z)||!walkable(b.x,b.z))return false;
 for(const o of obstacles){
  let enter=0,exit=1;
  for(const [axis,half] of [['x',o.w/2+.7],['z',o.d/2+.7]]){
   const delta=b[axis]-a[axis],low=o[axis]-half,high=o[axis]+half;
   if(Math.abs(delta)<1e-10){if(a[axis]<=low||a[axis]>=high){enter=2;break;}}
   else{let t1=(low-a[axis])/delta,t2=(high-a[axis])/delta;if(t1>t2)[t1,t2]=[t2,t1];enter=Math.max(enter,t1);exit=Math.min(exit,t2);}
  }
  if(enter<exit)return false;
 }
 return true;
}
function findRoute(x,z){
 const start={x:player.x,z:player.z},goal={x,z};
 if(clearSegment(start,goal))return [goal];
 const nodes=[start,goal];
 for(const o of obstacles)for(const sx of [-1,1])for(const sz of [-1,1]){
  const point={x:o.x+sx*(o.w/2+.72),z:o.z+sz*(o.d/2+.72)};
  if(walkable(point.x,point.z))nodes.push(point);
 }
 const cost=nodes.map(()=>Infinity),previous=[],visited=new Set();cost[0]=0;
 while(true){let current=-1;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(current<0||cost[i]<cost[current]))current=i;
  if(current<0||!Number.isFinite(cost[current]))return null;
  if(current===1)break;visited.add(current);
  for(let i=0;i<nodes.length;i++){if(visited.has(i)||!clearSegment(nodes[current],nodes[i]))continue;
   const distance=cost[current]+Math.hypot(nodes[i].x-nodes[current].x,nodes[i].z-nodes[current].z);
   if(distance<cost[i]){cost[i]=distance;previous[i]=current;}
  }
 }
 const path=[];for(let i=1;i!==0;i=previous[i])path.push(nodes[i]);return path.reverse();
}
function nearestDestination(x,z){
 if(navigation){
  const c=Math.cos(angle),s=Math.sin(angle),rx=Math.max(navigation.left,Math.min(navigation.right,x*c-z*s)),rz=Math.max(navigation.top,Math.min(navigation.bottom,x*s+z*c));
  x=rx*c+rz*s;z=-rx*s+rz*c;
 }else{x=Math.max(-FIELD.halfWidth,Math.min(FIELD.halfWidth,x));z=Math.max(-FIELD.halfDepth,Math.min(FIELD.halfDepth,z));}
 const candidates=[{x,z}];
 for(const o of obstacles){const left=o.x-o.w/2-.72,right=o.x+o.w/2+.72,top=o.z-o.d/2-.72,bottom=o.z+o.d/2+.72;
  const px=Math.max(left,Math.min(right,x)),pz=Math.max(top,Math.min(bottom,z));
  candidates.push({x:left,z:pz},{x:right,z:pz},{x:px,z:top},{x:px,z:bottom});
 }
 return candidates.filter(p=>walkable(p.x,p.z)).sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z))[0];
}
let walkCycle=0;
function updateMovement(dt){
 let remaining=MOVE_SPEED*dt;
 const startX=player.x,startZ=player.z;
 while(route.length&&remaining>0){const next=route[0],dx=next.x-player.x,dz=next.z-player.z,distance=Math.hypot(dx,dz);
  if(distance<=remaining){player.x=next.x;player.z=next.z;remaining-=distance;route.shift();}else{player.x+=dx/distance*remaining;player.z+=dz/distance*remaining;remaining=0;}}
 const dx=player.x-startX,dz=player.z-startZ,moved=Math.hypot(dx,dz);
 if(moved>1e-7){
  const desired=Math.atan2(dx,dz),difference=Math.atan2(Math.sin(desired-player.facing),Math.cos(desired-player.facing));
  player.facing+=difference*(1-Math.exp(-22*dt));walkCycle+=moved*9;
 }
}
function playerPoint([x,y,z]){const c=Math.cos(player.facing),s=Math.sin(player.facing);return [player.x+x*c+z*s,y,player.z-x*s+z*c];}
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const palette={arcane:'#d0e89e',fire:'#ffb16e',ice:'#9fe4ef'};
function resize(){const r=canvas.getBoundingClientRect();w=r.width;h=r.height;const d=Math.min(devicePixelRatio||1,2);canvas.width=w*d;canvas.height=h*d;ctx.setTransform(d,0,0,d,0,0);fitView();}
new ResizeObserver(resize).observe(canvas);
// The entire green canvas is the map. Reserve only enough room to keep the model on screen.
function fitView(){
 scale=Math.min(w/17,h/26);viewY=h*.52;
 navigation={left:(-w/2)/scale+1.05,right:(w/2)/scale-1.05,top:(2.9*.86*scale+10-viewY)/(scale*.66),bottom:(h-.9*.66*scale-8-viewY)/(scale*.66)};
 const position=nearestDestination(player.x,player.z);
 if(position){player.x=position.x;player.z=position.z;}
 if(route.length){const destination=nearestDestination(player.targetX,player.targetZ);player.targetX=destination.x;player.targetZ=destination.z;route=findRoute(destination.x,destination.z)||[];}
}
function groundPoint(px,py){const rx=(px-w/2)/scale,rz=(py-viewY)/(scale*.66),c=Math.cos(angle),s=Math.sin(angle);return [rx*c+rz*s,0,-rx*s+rz*c];}
function project([x,y,z]){x-=camera.x;z-=camera.z;const c=Math.cos(angle),s=Math.sin(angle),rx=x*c-z*s,rz=x*s+z*c;return [w/2+rx*scale,viewY+(rz*.66-y*.86)*scale,rz*.86+y*.66];}
let faces=[];
function poly(vertices,color){const p=vertices.map(v=>project(meshOrigin?playerPoint(v):v));faces.push({p,color,layer:meshOrigin?1:0,depth:p.reduce((a,v)=>a+v[2],0)/p.length});}
function ring(x,y,z,r1,r2,height,n,colors,rotation=0){for(let i=0;i<n;i++){const a=rotation+i*Math.PI*2/n,b=rotation+(i+1)*Math.PI*2/n;poly([[x+Math.cos(a)*r1,y,z+Math.sin(a)*r1],[x+Math.cos(b)*r1,y,z+Math.sin(b)*r1],[x+Math.cos(b)*r2,y+height,z+Math.sin(b)*r2],[x+Math.cos(a)*r2,y+height,z+Math.sin(a)*r2]],colors[i%colors.length]);}if(r2>0)poly(Array.from({length:n},(_,i)=>[x+Math.cos(rotation+i*Math.PI*2/n)*r2,y+height,z+Math.sin(rotation+i*Math.PI*2/n)*r2]),colors[0]);}
function lineGround(radius,color,width=1,offset=0,center=player){ctx.beginPath();for(let i=0;i<=90;i++){const a=i/90*Math.PI*2,p=project([center.x+Math.cos(a)*radius,.035,center.z+Math.sin(a)*radius]);if(i===0)ctx.moveTo(p[0],p[1]+offset);else ctx.lineTo(p[0],p[1]+offset);}ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function box(x,y,z,width,height,depth,colors){
 const l=x-width/2,r=x+width/2,f=z-depth/2,b=z+depth/2,t=y+height;
 poly([[l,y,f],[r,y,f],[r,t,f],[l,t,f]],colors[1]);poly([[l,y,b],[r,y,b],[r,t,b],[l,t,b]],colors[1]);
 poly([[l,y,f],[l,y,b],[l,t,b],[l,t,f]],colors[2]);poly([[r,y,f],[r,y,b],[r,t,b],[r,t,f]],colors[2]);poly([[l,t,f],[r,t,f],[r,t,b],[l,t,b]],colors[0]);
}
function drawField(){
 poly([groundPoint(0,0),groundPoint(w,0),groundPoint(w,h),groundPoint(0,h)],'#75a952');
 // Sparse flat grass strokes give depth without adding obstacles or tile seams.
 for(let x=-5;x<6;x+=2)for(let z=-7;z<8;z+=2){
  const shift=Math.sin(x*17+z*31)*.6;
  poly([[x+shift,.005,z],[x+shift+.07,.005,z-.23],[x+shift+.13,.005,z+.1]],'#7eaf5a');
 }
}
function render(ms){now=ms/1000;const dt=previousFrame===null?0:Math.min(Math.max(now-previousFrame,0),.1);previousFrame=now;updateMovement(dt);angle+=(targetAngle-angle)*(1-Math.exp(-7*dt));fitView();ctx.clearRect(0,0,w,h);const bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#6f9f4e');bg.addColorStop(.5,'#75a952');bg.addColorStop(1,'#75a952');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);faces=[];
drawField();
// Mage: boots, six-sided robe, sleeves, head, broad brim, pointed hat, staff.
meshOrigin=player;
const stride=!reduced&&route.length?Math.sin(walkCycle)*.12:0;
const bob=reduced?0:route.length?Math.abs(Math.sin(walkCycle))*.055:Math.sin(now*2)*.035;
ring(-.24,.03, .15+stride,.18,.17,.25,5,['#283541','#344454']);ring(.24,.03,.15-stride,.18,.17,.25,5,['#283541','#344454']);
ring(0,.19,0,.64,.3,1.25,7,['#43527c','#4c6091','#6374a3','#566994','#3a486f','#344264','#43547e']);
ring(0,.31,0,.65,.62,.09,7,['#c3ad70','#d7c181','#ab945d']);
ring(0,1.13,0,.34,.34,.13,7,['#b89d63','#dcc381','#a78d57']);
ring(-.49,.83,0,.25,.2,.58,5,['#526693','#6679aa','#3f507b']);ring(.49,.83,0,.25,.2,.58,5,['#526693','#6679aa','#3f507b']);
ring(-.53,.9,.12,.13,.12,.18,5,['#d4b091','#edc9a7']);ring(.54,1,.13,.13,.12,.18,5,['#d4b091','#edc9a7']);
ring(0,1.42,0,.24,.24,.4,6,['#e3bd99','#efceaa','#bf967f']);
box(-.09,1.61,.225,.055,.065,.025,['#243143','#243143','#243143']);box(.09,1.61,.225,.055,.065,.025,['#243143','#243143','#243143']);
ring(0,1.68+bob,0,.64,.63,.08,7,['#526593','#697ca9','#3a4a73']);
ring(0,1.76+bob,0,.4,.26,.51,7,['#576b9c','#6f81b0','#40517b']);ring(0,2.27+bob,0,.26,0,.53,7,['#576b9c','#6f81b0','#40517b']);
ring(0,1.79+bob,0,.405,.37,.12,7,['#baa46a','#e0c98c','#baa46a']);
ring(.73,.02,.13,.055,.055,2.05,5,['#8a7051','#b09462','#68583e']);ring(.73,2.03,.13,.16,0,.32,5,['#a9e0c6','#dcf4ce','#7bbfb1']);
meshOrigin=null;
// Ground is always drawn before actors; a large ground polygon must never hide the mage.
faces.sort((a,b)=>a.layer-b.layer||a.depth-b.depth);for(const f of faces){ctx.beginPath();f.p.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=f.color;ctx.fill();}
// Ground sigils sit around the robe, with a soft magical staff glow.
if(Math.hypot(player.targetX-player.x,player.targetZ-player.z)>.05){lineGround(.3,'#e4efba',2,0,{x:player.targetX,z:player.targetZ});}
lineGround(1.75,'#d8e9ab66',1);lineGround(1.95,'#d8e9ab33',1);
for(let i=0;i<8;i++){const a=i*Math.PI/4,p=project([player.x+Math.cos(a)*1.86,.04,player.z+Math.sin(a)*1.86]);ctx.save();ctx.translate(p[0],p[1]);ctx.rotate(Math.PI/4);ctx.fillStyle='#d9e8b4aa';ctx.fillRect(-2,-2,4,4);ctx.restore();}
const glow=project(playerPoint([.73,2.3,.13]));const gradient=ctx.createRadialGradient(glow[0],glow[1],0,glow[0],glow[1],34);gradient.addColorStop(0,'#cff5bf60');gradient.addColorStop(1,'#cff5bf00');ctx.fillStyle=gradient;ctx.fillRect(glow[0]-34,glow[1]-34,68,68);
const age=now-pulse;if(age<1.3){ctx.globalAlpha=1-age/1.3;lineGround(.6+age*3.8,palette[spell],3);lineGround(.4+age*3,palette[spell],1);ctx.globalAlpha=1;}
for(let i=0;i<16;i++){const t=reduced?i:now*.18+i*1.87,x=Math.sin(i*23.4)*7,z=Math.cos(i*17.3)*12,y=.4+(t%2),p=project([x,y,z]);ctx.globalAlpha=.25+.35*Math.sin(t*3)**2;ctx.fillStyle='#d3edac';ctx.beginPath();ctx.arc(p[0],p[1],1.2,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
const vignette=ctx.createRadialGradient(w/2,h*.48,w*.15,w/2,h*.5,h*.7);vignette.addColorStop(0,'#081f2300');vignette.addColorStop(1,'#244e2028');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);requestAnimationFrame(render);}
function cast(){pulse=now;document.querySelector('#hint').textContent={arcane:'비전의 힘이 초원을 감쌉니다',fire:'화염의 힘이 깨어납니다',ice:'차가운 마력이 퍼져나갑니다'}[spell];}
function moveToPointer(event){
 const rect=canvas.getBoundingClientRect(),rx=(event.clientX-rect.left-w/2)/scale,rz=(event.clientY-rect.top-viewY)/(scale*.66);
 const c=Math.cos(angle),s=Math.sin(angle);
 const destination=nearestDestination(camera.x+rx*c+rz*s,camera.z-rx*s+rz*c);if(!destination)return;
 const {x,z}=destination,path=findRoute(x,z);if(!path)return;
 player.targetX=x;player.targetZ=z;route=path;
 document.querySelector('#hint').textContent='지정한 위치로 이동합니다';
}
let lastMoveCommand=-Infinity;
canvas.addEventListener('pointermove',event=>{if(event.buttons&2&&event.timeStamp-lastMoveCommand>=70){lastMoveCommand=event.timeStamp;moveToPointer(event);}});
canvas.addEventListener('contextmenu',event=>event.preventDefault());
canvas.addEventListener('pointerdown',event=>{
 if(event.button===2||event.pointerType==='touch'){event.preventDefault();moveToPointer(event);}
 else if(event.button===0)cast();
});
document.querySelectorAll('.skill').forEach(button=>button.addEventListener('click',()=>{spell=button.dataset.spell;document.querySelectorAll('.skill').forEach(b=>b.classList.toggle('active',b===button));cast();}));
document.querySelector('#sound').addEventListener('click',()=>{targetAngle+=Math.PI/4;});
requestAnimationFrame(render);
