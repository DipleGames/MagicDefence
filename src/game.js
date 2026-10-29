'use strict';
// Small dependency-free polygon renderer. All scenery and the mage are 3D meshes.
const canvas=document.querySelector('#world'),ctx=canvas.getContext('2d');
let w=0,h=0,scale=1,angle=0,targetAngle=0,spell='arcane',pulse=-10,now=0;
const combat=new DefenceGame();
const player=combat.hero;
let previousFrame=null,meshOrigin=null;
const MOVE_SPEED=3.5;
const FIELD={halfWidth:6,halfDepth:8};
const GROUND=FIELD;
let viewY=0;
let navigation=null;
let paused=false;
let stageRect=null;
let gameTime=0;
const abilities={arcane:{key:'Q',cost:12,cooldown:3},fire:{key:'W',cost:20,cooldown:5},ice:{key:'E',cost:25,cooldown:7},ultimate:{key:'R',cost:50,cooldown:16}};
const readyAt={arcane:0,fire:0,ice:0,ultimate:0};
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
 let remaining=player.speed*dt;
 const startX=player.x,startZ=player.z;
 while(route.length&&remaining>0){const next=route[0],dx=next.x-player.x,dz=next.z-player.z,distance=Math.hypot(dx,dz);
  if(distance<=remaining){player.x=next.x;player.z=next.z;remaining-=distance;route.shift();}else{player.x+=dx/distance*remaining;player.z+=dz/distance*remaining;remaining=0;}}
 const dx=player.x-startX,dz=player.z-startZ,moved=Math.hypot(dx,dz);
 if(moved>1e-7){
  const desired=Math.atan2(dx,dz),difference=Math.atan2(Math.sin(desired-player.facing),Math.cos(desired-player.facing));
  player.facing+=difference*(1-Math.exp(-22*dt));walkCycle+=moved*9;
 }
}
function playerPoint([x,y,z],origin=player){const c=Math.cos(origin.facing||0),s=Math.sin(origin.facing||0);return [origin.x+x*c+z*s,y,origin.z-x*s+z*c];}
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const palette={arcane:'#d0e89e',fire:'#ffb16e',ice:'#9fe4ef',ultimate:'#d6afff'};
function resize(){const r=canvas.getBoundingClientRect();w=r.width;h=r.height;const d=Math.min(devicePixelRatio||1,2);canvas.width=w*d;canvas.height=h*d;ctx.setTransform(d,0,0,d,0,0);fitView();}
new ResizeObserver(resize).observe(canvas);
// Navigation matches the visible stone platform, with enough space for the full character.
function fitView(){
 scale=Math.min(w/48,h/31);viewY=h*.48;
 stageRect={left:w*.055,right:w*.945,top:Math.max(100,h*.14),bottom:h-158};
 navigation={left:(stageRect.left-w/2)/scale+.8,right:(stageRect.right-w/2)/scale-.8,top:(stageRect.top+2.9*.86*scale+8-viewY)/(scale*.66),bottom:(stageRect.bottom-.9*.66*scale-8-viewY)/(scale*.66)};
 const position=nearestDestination(player.x,player.z);
 if(position){player.x=position.x;player.z=position.z;}
 combat.setArena({...navigation,angle});
 if(route.length){const destination=nearestDestination(player.targetX,player.targetZ);player.targetX=destination.x;player.targetZ=destination.z;route=findRoute(destination.x,destination.z)||[];}
}
function groundPoint(px,py){const rx=(px-w/2)/scale,rz=(py-viewY)/(scale*.66),c=Math.cos(angle),s=Math.sin(angle);return [rx*c+rz*s,0,-rx*s+rz*c];}
function project([x,y,z]){x-=camera.x;z-=camera.z;const c=Math.cos(angle),s=Math.sin(angle),rx=x*c-z*s,rz=x*s+z*c;return [w/2+rx*scale,viewY+(rz*.66-y*.86)*scale,rz*.86+y*.66];}
let faces=[];
function poly(vertices,color){const p=vertices.map(v=>project(meshOrigin?playerPoint(v,meshOrigin):v));faces.push({p,color,owner:meshOrigin,layer:meshOrigin?1:0,depth:p.reduce((a,v)=>a+v[2],0)/p.length});}
function ring(x,y,z,r1,r2,height,n,colors,rotation=0){for(let i=0;i<n;i++){const a=rotation+i*Math.PI*2/n,b=rotation+(i+1)*Math.PI*2/n;poly([[x+Math.cos(a)*r1,y,z+Math.sin(a)*r1],[x+Math.cos(b)*r1,y,z+Math.sin(b)*r1],[x+Math.cos(b)*r2,y+height,z+Math.sin(b)*r2],[x+Math.cos(a)*r2,y+height,z+Math.sin(a)*r2]],colors[i%colors.length]);}if(r2>0)poly(Array.from({length:n},(_,i)=>[x+Math.cos(rotation+i*Math.PI*2/n)*r2,y+height,z+Math.sin(rotation+i*Math.PI*2/n)*r2]),colors[0]);}
function lineGround(radius,color,width=1,offset=0,center=player){ctx.beginPath();for(let i=0;i<=90;i++){const a=i/90*Math.PI*2,p=project([center.x+Math.cos(a)*radius,.035,center.z+Math.sin(a)*radius]);if(i===0)ctx.moveTo(p[0],p[1]+offset);else ctx.lineTo(p[0],p[1]+offset);}ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function box(x,y,z,width,height,depth,colors){
 const l=x-width/2,r=x+width/2,f=z-depth/2,b=z+depth/2,t=y+height;
 poly([[l,y,f],[r,y,f],[r,t,f],[l,t,f]],colors[1]);poly([[l,y,b],[r,y,b],[r,t,b],[l,t,b]],colors[1]);
 poly([[l,y,f],[l,y,b],[l,t,b],[l,t,f]],colors[2]);poly([[r,y,f],[r,y,b],[r,t,b],[r,t,f]],colors[2]);poly([[l,t,f],[r,t,f],[r,t,b],[l,t,b]],colors[0]);
}
function screenPoly(points,fill,stroke){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
function ellipse(x,y,rx,ry,color){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
function island(x,y,r,crystal=false){
 const rim=[[x-r,y-r*.15],[x-r*.8,y-r*.6],[x-r*.35,y-r*.73],[x+r*.2,y-r*.66],[x+r*.83,y-r*.42],[x+r,y+r*.18],[x+r*.5,y+r*.53],[x-r*.5,y+r*.45]];
 screenPoly(rim.map(([px,py])=>[px,py+r*.48]),'#7387a5');
 screenPoly([[x-r,y],[x-r*.5,y+r*.82],[x+r*.35,y+r*.95],[x+r,y+r*.2],[x+r*.1,y+r*.26]],'#8a91a8');
 screenPoly([[x-r*.5,y+r*.35],[x-r*.5,y+r*.82],[x,y+r*.91],[x+r*.1,y+r*.3]],'#9ca3b4');
 screenPoly(rim,'#e7a944');screenPoly(rim.map(([px,py])=>[x+(px-x)*.97,py-r*.1]),'#ffd471');
 for(let i=0;i<6;i++){const a=i*Math.PI/3,px=x+Math.cos(a)*r*.65,py=y+Math.sin(a)*r*.3;screenPoly([[px-7,py],[px-4,py-12],[px+7,py-10],[px+10,py+2]],i%2?'#a9a9a1':'#b7b7aa');}
 if(crystal){ellipse(x,y+3,15,7,'#a96e5f55');screenPoly([[x-14,y-7],[x-6,y-23],[x+12,y-19],[x+17,y-2],[x+1,y+12]],'#b339d5');screenPoly([[x-6,y-23],[x+1,y+12],[x-14,y-7]],'#d65de6');screenPoly([[x-6,y-23],[x+12,y-19],[x+1,y+12]],'#9933ce');}
 else{ellipse(x,y-1,r*.4,r*.25,'#88dbe7');ellipse(x-5,y-5,5,2,'#c2f5f4');}
}
function flower(x,y,color){screenPoly([[x-1,y],[x+1,y],[x+2,y-10],[x,y-10]],'#709c53');ellipse(x+4,y-6,4,2,'#93b75c');for(let i=0;i<5;i++){const a=i*Math.PI*.4;ellipse(x+Math.cos(a)*4,y-12+Math.sin(a)*3,3,3,color);}ellipse(x,y-12,2,2,'#ffe68b');}
function drawScenery(){
 const sky=ctx.createLinearGradient(0,0,w,h);sky.addColorStop(0,'#90d3f4');sky.addColorStop(.55,'#b5e8f7');sky.addColorStop(1,'#75bce9');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
 // Soft clouds and rays across the gap between the floating islands.
 for(const [x,y,r] of [[.06,.05,34],[.55,.035,45],[.97,.22,35],[.08,.65,40],[.95,.88,30]]){ctx.save();ctx.filter='blur(9px)';ellipse(w*x,h*y,r*1.6,r*.5,'#edfaff9c');ctx.restore();}
 screenPoly([[w*.38,0],[w*.48,0],[w*.96,h],[w*.64,h]],'#fff9dc18');
 island(w*.065,h*.08,Math.min(90,w*.09));island(w*.94,h*.1,Math.min(70,w*.075),true);
 const {left:l,right:r,top:t,bottom:b}=stageRect;
 // Floating cliff silhouette and warm ochre border beneath the playing surface.
 screenPoly([[l-15,t+19],[l-20,b],[r+17,b],[r+19,t+28],[r-5,t-5],[l+10,t-6]],'#7587a0');
 screenPoly([[l-12,t+7],[l-16,b],[r+14,b],[r+15,t+10],[r-2,t-10],[l+3,t-11]],'#f3bc54');
 screenPoly([[l-7,t],[l-9,b],[r+7,b],[r+8,t+5],[r-8,t-7],[l+9,t-7]],'#ffda7e');
 for(let i=0;i<16;i++){const side=i%2?l-10:r+9,y=t+18+i*Math.max(0,b-t-36)/16;ellipse(side,y,4+i%3,3,i%3?'#efb745':'#ffdf80');if(i%4===0)flower(side,y+6,i%3?'#f3959e':'#a4d4f5');}
 // Small rocks at the entrance to the arena.
 for(let i=0;i<5;i++){const x=l+12+i*19,y=t-3;screenPoly([[x-9,y],[x-5,y-14],[x+6,y-16],[x+12,y-6],[x+6,y+4]],i%2?'#858f9e':'#969da8');}
}
function drawField(){
 const {left:l,right:r,top:t,bottom:b}=stageRect;
 const floor=(points,color)=>poly(points.map(([x,y])=>groundPoint(Math.max(l,Math.min(r,x)),Math.max(t,Math.min(b,y)))),color);
 floor([[l,t],[r,t],[r,b],[l,b]],'#b3a58a');
 const columns=Math.max(4,Math.round(w/145)),tileW=(r-l)/columns,tileH=Math.max(52,Math.min(100,h*.13)),colors=['#c6b99a','#cdbf9d','#b8b19a','#d4c3a0','#bfb196','#c3b599'];
 for(let row=0;t+row*tileH<b;row++)for(let col=0;col<columns;col++){
  const x=l+col*tileW,y=t+row*tileH,skew=(row%2?1:-1)*5;
  floor([[x+1,y+1],[x+tileW-1,y+1],[x+tileW-1,y+tileH-1],[x+1,y+tileH-1]],colors[(row*7+col*3)%colors.length]);
  if((row+col)%4===0)floor([[x+3,y+2],[x+tileW-2,y+2],[x+tileW-2,y+tileH*.25],[x+tileW*.7+skew,y+tileH*.25]],'#ded0ae66');
  if((row*3+col)%5===0){floor([[x+tileW*.15,y+tileH*.62],[x+tileW*.28,y+tileH*.55],[x+tileW*.42,y+tileH*.62],[x+tileW*.3,y+tileH*.73]],'#b1ae96');}
  if((row+col)%3===0){const px=x+tileW*.8,py=y+tileH*.25;floor([[px,py],[px+8,py+5],[px+4,py+12],[px+6,py+5]],'#a69b85');}
 }
 // Riveted repair plates break up the large sandstone slabs.
 for(const [u,v] of [[.55,.22],[.07,.75]]){const x=l+(r-l)*u,y=t+(b-t)*v,tw=tileW*1.4,th=tileH*1.2;
  floor([[x,y],[Math.min(r-2,x+tw),y],[Math.min(r-2,x+tw),y+th],[x,y+th]],'#cda986');
  for(const dx of [4,Math.min(tw,r-x-2)-4])for(const dy of [4,th-4])floor([[x+dx-1,y+dy-1],[x+dx+2,y+dy-1],[x+dx+2,y+dy+2],[x+dx-1,y+dy+2]],'#ead4a5');
 }
}
function drawEnemy(enemy){
 meshOrigin=enemy;const flash=enemy.flashUntil>combat.time,c=flash?'#fff0c5':enemy.color,r=enemy.radius;
 if(enemy.type==='slime'){ring(0,.06,0,r,r*.85,.5,7,[c,'#569660','#95d194']);ring(0,.56,0,r*.85,0,.35,7,[c,'#95d194']);}
 else if(enemy.type==='runner'){ring(0,.12,0,r,r,.5,6,[c,'#ac4f4b','#e79565']);for(const x of [-1,1])for(const z of [-.3,.3])box(x*r,.04,z,.12,.23,.16,[c,'#784447','#a65a4c']);ring(0,.62,0,r*.7,0,.3,5,[c,'#efaf72']);}
 else if(enemy.type==='wisp'||enemy.type==='ember'){const bob=.15+Math.sin(now*3+enemy.id)*.1;ring(0,.5+bob,0,r,0,.9,5,[c,'#c1a1ec','#7558a9']);ring(0,.15+bob,0,0,r,.35,5,[c,'#8e72bd']);}
 else {box(0,.15,0,r*1.5,enemy.boss?1.3:.8,r*1.3,[c,'#637683','#98a6aa']);ring(0,enemy.boss?1.45:1,0,r*.6,r*.55,.6,5,[c,'#bfc8b7','#82949b']);if(enemy.boss){for(const x of [-r,r])ring(x,1.5,0,.3,0,.9,4,[c,'#e4c88c']);}}
 const eyeY=enemy.boss?1.85:enemy.type==='wisp'?.95:.55;
 box(-r*.27,eyeY,r*.75,.12,.12,.05,['#ffee9c','#ffee9c','#ffee9c']);box(r*.27,eyeY,r*.75,.12,.12,.05,['#ffee9c','#ffee9c','#ffee9c']);
 meshOrigin=null;
}
function drawDanger(){
 for(const hazard of combat.hazards){const p=project([hazard.x,0,hazard.z]),progress=(combat.time-hazard.start)/(hazard.resolveAt-hazard.start);ellipse(p[0],p[1],hazard.radius*scale,hazard.radius*scale*.66,'#dc51482b');lineGround(hazard.radius,'#f36a56dd',2,0,hazard);lineGround(hazard.radius*Math.min(1,progress),'#ffdb8dcc',2,0,hazard);}
 for(const enemy of combat.enemies)if(enemy.activeAt>combat.time)lineGround(enemy.radius+.4,'#d8b2efbb',2,0,enemy);
}
function drawCombatOverlay(){
 for(const enemy of combat.enemies){if(enemy.hp<=0)continue;const p=project([enemy.x,enemy.boss?2.9:1.65,enemy.z]),width=enemy.boss?58:30;ctx.fillStyle='#293b45';ctx.fillRect(p[0]-width/2,p[1]-4,width,5);ctx.fillStyle=enemy.boss?'#e2955f':'#df6e65';ctx.fillRect(p[0]-width/2+1,p[1]-3,(width-2)*enemy.hp/enemy.maxHp,3);}
 for(const p of combat.projectiles){const point=project([p.x,.6,p.z]);ellipse(point[0],point[1],p.hostile?5:4,p.hostile?5:4,p.hostile?'#f79565':'#afefff');ellipse(point[0],point[1],2,2,'#fff6cf');}
 ctx.textAlign='center';ctx.font='bold 13px system-ui';for(const number of combat.numbers){const p=project([number.x,1.9+(1-(number.until-combat.time)/.7),number.z]);ctx.fillStyle='#2c344b';ctx.fillText(number.text,p[0]+1,p[1]+1);ctx.fillStyle=number.color;ctx.fillText(number.text,p[0],p[1]);}
}
function updateCombatHud(){
 const set=(selector,text)=>{document.querySelector(selector).textContent=text;};
 set('#hero-level',player.level);set('#portrait-level',player.level);set('#meta-level',String(player.level).padStart(2,'0'));set('#power-value',player.power);set('#speed-value',Math.round(player.speed*100));set('#gold-value',player.gold);set('#armor-value',player.armor);
 set('#health-value',`${Math.ceil(player.hp)} / ${player.maxHp}`);document.querySelector('#health-fill').style.width=`${player.hp/player.maxHp*100}%`;
 const needed=60+30*(player.level-1)+10*(player.level-1)**2,percent=player.xp/needed*100;
 for(const selector of ['#top-xp-fill','#hud-xp-fill'])document.querySelector(selector).style.width=`${percent}%`;
 document.querySelector('#xp-meter').title=`경험치 ${player.xp} / ${needed}`;set('#xp-value',`XP ${player.xp} / ${needed}`);
 set('#stage-number',String(Math.max(1,combat.stage)).padStart(2,'0'));
 set('#wave-status',combat.phase==='defeat'?'도전 종료':combat.phase==='intermission'?`다음 스테이지 ${Math.max(0,Math.ceil(combat.nextStageAt-combat.time))}초`:`남은 적 ${combat.enemies.filter(e=>e.hp>0).length}`);
 const boss=combat.enemies.find(e=>e.boss&&e.hp>0);document.querySelector('#boss-hud').hidden=!boss;
 if(boss){set('#boss-name',boss.name);set('#boss-hp',`${Math.ceil(boss.hp)} / ${boss.maxHp}`);document.querySelector('#boss-fill').style.width=`${boss.hp/boss.maxHp*100}%`;}
 const event=combat.events[combat.events.length-1],toast=document.querySelector('#battle-toast');toast.hidden=!event;if(event){toast.textContent=event.text;toast.dataset.kind=event.kind;}
 if(combat.phase==='defeat'){
  route=[];document.querySelector('#pause-panel').hidden=false;set('#pause-title','도전 종료');set('#pause-summary',`스테이지 ${combat.stage} · Lv.${player.level} · ${combat.kills}마리 처치`);set('#resume','다시 도전 ▶');
 }else{set('#pause-title','잠시 쉬어가기');set('#pause-summary',`스테이지 ${Math.max(1,combat.stage)} · Lv.${player.level}`);set('#resume','계속하기 ▶');}
}
function restartRun(){combat.reset();gameTime=0;pulse=-10;route=[];angle=targetAngle=0;for(const id in readyAt)readyAt[id]=0;}
function render(ms){now=ms/1000;const dt=previousFrame===null?0:Math.min(Math.max(now-previousFrame,0),.1);previousFrame=now;
 if(!paused&&combat.phase!=='defeat'){gameTime+=dt;updateMovement(dt);combat.update(dt);angle+=(targetAngle-angle)*(1-Math.exp(-7*dt));}
 updateAbilityHud();fitView();ctx.clearRect(0,0,w,h);drawScenery();faces=[];
drawField();
for(const enemy of combat.enemies)if(enemy.hp>0)drawEnemy(enemy);
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
faces.sort((a,b)=>a.layer-b.layer||(a.layer===0?0:a.depth-b.depth));const shadows=new Set();let dangerDrawn=false;
for(const f of faces){
 if(f.layer===1&&!dangerDrawn){drawDanger();dangerDrawn=true;}
 if(f.owner&&!shadows.has(f.owner)){const foot=project([f.owner.x,0,f.owner.z]);ellipse(foot[0],foot[1],scale*(f.owner.radius||.75),scale*.26,'#5d574747');shadows.add(f.owner);}
 ctx.beginPath();f.p.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=f.color;ctx.fill();
}
// Ground sigils sit around the robe, with a soft magical staff glow.
if(Math.hypot(player.targetX-player.x,player.targetZ-player.z)>.05){lineGround(.3,'#e4efba',2,0,{x:player.targetX,z:player.targetZ});}
lineGround(.66,'#72d4fcaa',2);lineGround(.8,'#345a7555',1);
const glow=project(playerPoint([.73,2.3,.13]));const gradient=ctx.createRadialGradient(glow[0],glow[1],0,glow[0],glow[1],34);gradient.addColorStop(0,'#cff5bf60');gradient.addColorStop(1,'#cff5bf00');ctx.fillStyle=gradient;ctx.fillRect(glow[0]-34,glow[1]-34,68,68);
const age=gameTime-pulse;if(age<1.3){const color=palette[spell];ctx.globalAlpha=1-age/1.3;
 const radius=spell==='ultimate'?1+age*7:.6+age*3.8;
 lineGround(radius,color,spell==='ultimate'?5:3);lineGround(radius*.78,color,1);
 if(spell==='fire'){for(let i=0;i<8;i++){const a=i*Math.PI/4,p=project([player.x+Math.cos(a)*radius,age*.8,player.z+Math.sin(a)*radius]);ellipse(p[0],p[1],scale*.15,scale*.28,color);}}
 if(spell==='ice'){for(let i=0;i<10;i++){const a=i*Math.PI/5,p=project([player.x+Math.cos(a)*radius,.2,player.z+Math.sin(a)*radius]);screenPoly([[p[0]-4,p[1]],[p[0],p[1]-scale*.55],[p[0]+4,p[1]],[p[0],p[1]+5]],color);}}
 if(spell==='ultimate'){const p=project([player.x,0,player.z]),beam=ctx.createLinearGradient(p[0]-30,0,p[0]+30,0);beam.addColorStop(0,'#d6afff00');beam.addColorStop(.5,'#f8e4ff99');beam.addColorStop(1,'#d6afff00');ctx.fillStyle=beam;ctx.fillRect(p[0]-30,0,60,p[1]);}
 ctx.globalAlpha=1;}
for(let i=0;i<16;i++){const t=reduced?i:now*.18+i*1.87,x=Math.sin(i*23.4)*7,z=Math.cos(i*17.3)*12,y=.4+(t%2),p=project([x,y,z]);ctx.globalAlpha=.25+.35*Math.sin(t*3)**2;ctx.fillStyle='#d3edac';ctx.beginPath();ctx.arc(p[0],p[1],1.2,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
const bar=project([player.x,3.1,player.z]);ctx.fillStyle='#384c44';ctx.fillRect(bar[0]-19,bar[1]-5,38,7);ctx.fillStyle='#63dd64';ctx.fillRect(bar[0]-17,bar[1]-3,34*player.hp/player.maxHp,3);ctx.fillStyle='#247d3b';for(let i=1;i<5;i++)ctx.fillRect(bar[0]-17+i*6.8,bar[1]-3,1,3);
 drawCombatOverlay();
 requestAnimationFrame(render);}
function updateAbilityHud(){
 document.querySelector('#mana-fill').style.width=`${combat.hero.mana/player.maxMana*100}%`;
 document.querySelector('#mana-value').textContent=`${Math.floor(combat.hero.mana)} / ${player.maxMana}`;
 document.querySelectorAll('.skill').forEach(button=>{const id=button.dataset.spell,remaining=Math.max(0,readyAt[id]-gameTime);button.classList.toggle('on-cooldown',remaining>0);button.classList.toggle('no-mana',combat.hero.mana<abilities[id].cost);button.setAttribute('aria-disabled',String(paused||combat.phase!=='fighting'||remaining>0||combat.hero.mana<abilities[id].cost));button.querySelector('.cooldown').textContent=remaining>0?Math.ceil(remaining):'';});
 updateCombatHud();
}
function cast(id=spell){
 const ability=abilities[id];if(paused||combat.phase!=='fighting'||!ability||readyAt[id]>gameTime||combat.hero.mana<ability.cost)return false;
 spell=id;combat.hero.mana-=ability.cost;readyAt[id]=gameTime+ability.cooldown/(1+player.haste);pulse=gameTime;combat.castSpell(id);
 document.querySelectorAll('.skill').forEach(button=>button.classList.toggle('active',button.dataset.spell===id));updateAbilityHud();return true;
}
function moveToPointer(event){
 if(paused||combat.phase==='defeat')return;
 const rect=canvas.getBoundingClientRect(),rx=(event.clientX-rect.left-w/2)/scale,rz=(event.clientY-rect.top-viewY)/(scale*.66);
 const c=Math.cos(angle),s=Math.sin(angle);
 const destination=nearestDestination(camera.x+rx*c+rz*s,camera.z-rx*s+rz*c);if(!destination)return;
 const {x,z}=destination,path=findRoute(x,z);if(!path)return;
 player.targetX=x;player.targetZ=z;route=path;
}
let lastMoveCommand=-Infinity;
canvas.addEventListener('pointermove',event=>{if(event.buttons&2&&event.timeStamp-lastMoveCommand>=70){lastMoveCommand=event.timeStamp;moveToPointer(event);}});
canvas.addEventListener('contextmenu',event=>event.preventDefault());
canvas.addEventListener('pointerdown',event=>{
 if(event.button===2||event.pointerType==='touch'){event.preventDefault();moveToPointer(event);}
 else if(event.button===0)cast();
});
document.querySelectorAll('.skill').forEach(button=>button.addEventListener('click',()=>cast(button.dataset.spell)));
document.querySelector('#sound').addEventListener('click',()=>{if(!paused)targetAngle+=Math.PI/4;});
function setPaused(value){paused=value;document.querySelector('#pause-panel').hidden=!value;document.querySelector('#pause').setAttribute('aria-label',value?'계속하기':'일시 정지');updateAbilityHud();}
document.querySelector('#pause').addEventListener('click',()=>setPaused(!paused));
document.querySelector('#resume').addEventListener('click',()=>{if(combat.phase==='defeat')restartRun();setPaused(false);});
document.addEventListener('keydown',event=>{
 if(event.repeat||event.ctrlKey||event.altKey||event.metaKey||event.isComposing)return;
 if(event.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
 if(event.code==='Escape'){event.preventDefault();if(combat.phase!=='defeat')setPaused(!paused);return;}
 const id={KeyQ:'arcane',KeyW:'fire',KeyE:'ice',KeyR:'ultimate'}[event.code];
 if(id){event.preventDefault();cast(id);}
});
requestAnimationFrame(render);
