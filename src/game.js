'use strict';
// Small dependency-free polygon renderer. All scenery and the mage are 3D meshes.
const canvas=document.querySelector('#world'),ctx=canvas.getContext('2d');
let w=0,h=0,scale=1,angle=0,targetAngle=0,spell='arcane',pulse=-10,now=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const palette={arcane:'#d0e89e',fire:'#ffb16e',ice:'#9fe4ef'};
function resize(){const r=canvas.getBoundingClientRect();w=r.width;h=r.height;const d=Math.min(devicePixelRatio||1,2);canvas.width=w*d;canvas.height=h*d;ctx.setTransform(d,0,0,d,0,0);scale=w/17;}
new ResizeObserver(resize).observe(canvas);
function project([x,y,z]){const c=Math.cos(angle),s=Math.sin(angle),rx=x*c-z*s,rz=x*s+z*c;return [w/2+rx*scale,h*.52+(rz*.66-y*.86)*scale,rz*.86+y*.66];}
let faces=[];
function poly(vertices,color){const p=vertices.map(project);faces.push({p,color,depth:p.reduce((a,v)=>a+v[2],0)/p.length});}
function ring(x,y,z,r1,r2,height,n,colors,rotation=0){for(let i=0;i<n;i++){const a=rotation+i*Math.PI*2/n,b=rotation+(i+1)*Math.PI*2/n;poly([[x+Math.cos(a)*r1,y,z+Math.sin(a)*r1],[x+Math.cos(b)*r1,y,z+Math.sin(b)*r1],[x+Math.cos(b)*r2,y+height,z+Math.sin(b)*r2],[x+Math.cos(a)*r2,y+height,z+Math.sin(a)*r2]],colors[i%colors.length]);}if(r2>0)poly(Array.from({length:n},(_,i)=>[x+Math.cos(rotation+i*Math.PI*2/n)*r2,y+height,z+Math.sin(rotation+i*Math.PI*2/n)*r2]),colors[0]);}
function lineGround(radius,color,width=1,offset=0){ctx.beginPath();for(let i=0;i<=90;i++){const a=i/90*Math.PI*2,p=project([Math.cos(a)*radius,.035,Math.sin(a)*radius]);if(i===0)ctx.moveTo(p[0],p[1]+offset);else ctx.lineTo(p[0],p[1]+offset);}ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
// Seeded placement keeps the map identical between sessions.
let seed=42;function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
const stones=Array.from({length:45},()=>({x:(random()-.5)*20,z:(random()-.5)*30,r:.1+random()*.35,c:random()})).filter(o=>Math.hypot(o.x,o.z)>2.8);
const trees=Array.from({length:42},()=>({x:(random()>.5?1:-1)*(6+random()*4),z:(random()-.5)*30,r:.75+random()*.7,height:2+random()*2}));
function render(ms){now=ms/1000;angle+=(targetAngle-angle)*.035;ctx.clearRect(0,0,w,h);const bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#18322f');bg.addColorStop(.5,'#536957');bg.addColorStop(1,'#263f3d');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);faces=[];
// A ribbon of faceted ground passes through the clearing.
for(let z=-20;z<22;z+=2){poly([[-3,0,z],[2.7,0,z],[3.2,0,z+2],[-2.6,0,z+2]],z%4===0?'#677461':'#6c7965');}
for(let i=0;i<10;i++){const a=i*Math.PI*2/10,b=(i+1)*Math.PI*2/10;poly([[0,.01,0],[Math.cos(a)*3,.01,Math.sin(a)*3],[Math.cos(b)*3,.01,Math.sin(b)*3]],i%2?'#7a8670':'#74806a');}
for(const o of stones)ring(o.x,0,o.z,o.r,o.r*.65,o.r*.6,5,[o.c>.5?'#798479':'#4f6359','#65756b','#839084']);
for(const o of trees){ring(o.x,0,o.z,.14,.1,1.2,5,['#524c39','#675a40']);for(let j=0;j<3;j++)ring(o.x,.65+j*.65,o.z,o.r*(1-j*.22),0,o.height*(.72-j*.12),5,['#244e40','#315e47','#3e6b50','#285640','#467456'],j*.5);}
// Mage: boots, six-sided robe, sleeves, head, broad brim, pointed hat, staff.
const bob=reduced?0:Math.sin(now*2)*.035;
ring(-.24,.03,.15,.18,.17,.25,5,['#283541','#344454']);ring(.24,.03,.15,.18,.17,.25,5,['#283541','#344454']);
ring(0,.19,0,.64,.3,1.25,7,['#43527c','#4c6091','#6374a3','#566994','#3a486f','#344264','#43547e']);
ring(0,.31,0,.65,.62,.09,7,['#c3ad70','#d7c181','#ab945d']);
ring(0,1.13,0,.34,.34,.13,7,['#b89d63','#dcc381','#a78d57']);
ring(-.49,.83,0,.25,.2,.58,5,['#526693','#6679aa','#3f507b']);ring(.49,.83,0,.25,.2,.58,5,['#526693','#6679aa','#3f507b']);
ring(-.53,.9,.12,.13,.12,.18,5,['#d4b091','#edc9a7']);ring(.54,1,.13,.13,.12,.18,5,['#d4b091','#edc9a7']);
ring(0,1.42,0,.24,.24,.4,6,['#e3bd99','#efceaa','#bf967f']);
ring(0,1.68+bob,0,.64,.63,.08,7,['#526593','#697ca9','#3a4a73']);
ring(0,1.76+bob,0,.4,.26,.51,7,['#576b9c','#6f81b0','#40517b']);ring(0,2.27+bob,0,.26,0,.53,7,['#576b9c','#6f81b0','#40517b']);
ring(0,1.79+bob,0,.405,.37,.12,7,['#baa46a','#e0c98c','#baa46a']);
ring(.73,.02,.13,.055,.055,2.05,5,['#8a7051','#b09462','#68583e']);ring(.73,2.03,.13,.16,0,.32,5,['#a9e0c6','#dcf4ce','#7bbfb1']);
faces.sort((a,b)=>a.depth-b.depth);for(const f of faces){ctx.beginPath();f.p.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=f.color;ctx.fill();}
// Ground sigils sit around the robe, with a soft magical staff glow.
lineGround(1.75,'#d8e9ab66',1);lineGround(1.95,'#d8e9ab33',1);
for(let i=0;i<8;i++){const a=i*Math.PI/4,p=project([Math.cos(a)*1.86,.04,Math.sin(a)*1.86]);ctx.save();ctx.translate(p[0],p[1]);ctx.rotate(Math.PI/4);ctx.fillStyle='#d9e8b4aa';ctx.fillRect(-2,-2,4,4);ctx.restore();}
const glow=project([.73,2.3,.13]);const gradient=ctx.createRadialGradient(glow[0],glow[1],0,glow[0],glow[1],34);gradient.addColorStop(0,'#cff5bf60');gradient.addColorStop(1,'#cff5bf00');ctx.fillStyle=gradient;ctx.fillRect(glow[0]-34,glow[1]-34,68,68);
const age=now-pulse;if(age<1.3){ctx.globalAlpha=1-age/1.3;lineGround(.6+age*3.8,palette[spell],3);lineGround(.4+age*3,palette[spell],1);ctx.globalAlpha=1;}
for(let i=0;i<16;i++){const t=reduced?i:now*.18+i*1.87,x=Math.sin(i*23.4)*7,z=Math.cos(i*17.3)*12,y=.4+(t%2),p=project([x,y,z]);ctx.globalAlpha=.25+.35*Math.sin(t*3)**2;ctx.fillStyle='#d3edac';ctx.beginPath();ctx.arc(p[0],p[1],1.2,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
const vignette=ctx.createRadialGradient(w/2,h*.48,w*.15,w/2,h*.5,h*.7);vignette.addColorStop(0,'#081f2300');vignette.addColorStop(1,'#081f23b3');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);requestAnimationFrame(render);}
function cast(){pulse=now;document.querySelector('#hint').textContent={arcane:'비전의 힘이 숲을 감쌉니다',fire:'화염의 힘이 깨어납니다',ice:'차가운 마력이 퍼져나갑니다'}[spell];}
canvas.addEventListener('pointerdown',cast);
document.querySelectorAll('.skill').forEach(button=>button.addEventListener('click',()=>{spell=button.dataset.spell;document.querySelectorAll('.skill').forEach(b=>b.classList.toggle('active',b===button));cast();}));
document.querySelector('#sound').addEventListener('click',()=>{targetAngle+=Math.PI/4;});
requestAnimationFrame(render);
