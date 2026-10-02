/* Stable random blueprints. Geometry and priorities adapt without rerolling every decision. */
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const layouts=[
 {id:'zigzag',name:'Linha em zigue-zague',shape:'zigzag',depth:95,spread:0,amplitude:20,weights:{trench:.5,comm:.4}},
 {id:'redoubts',name:'Redutos separados',shape:'redoubts',depth:125,spread:45,amplitude:30,weights:{nest:.7,bunker:.5,dugout:.4}},
 {id:'depth',name:'Defesa em profundidade',shape:'depth',depth:175,spread:0,amplitude:16,weights:{comm:.8,dugout:.6,mortar:.4}},
 {id:'staggered',name:'Posições escalonadas',shape:'staggered',depth:115,spread:30,amplitude:38,weights:{nest:.5,trench:.3}},
 {id:'crescent',name:'Flancos reforçados',shape:'crescent',depth:135,spread:50,amplitude:24,weights:{nest:.6,wire:.4,bunker:.5}},
 {id:'dispersed',name:'Defesa dispersa',shape:'dispersed',depth:145,spread:65,amplitude:28,weights:{dugout:.7,aid:.3,comm:.5}}
];
function random(seed,key){let h=(seed^Math.imul(key+1,374761393))>>>0;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296}
function select(seed=Math.floor(Math.random()*4294967296),id){seed=seed>>>0;const p=layouts.find(p=>p.id===id)||layouts[Math.floor(random(seed,0)*layouts.length)];return {...p,seed,weights:{...p.weights}}}
function samples(pts,step=24){const out=[];for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step));for(let k=0;k<n;k++)out.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n])}out.push(pts.at(-1));return out}
function safe(pts,c){return samples(pts).every(([x,y])=>c.dry(x,y)&&!(c.enemies||[]).some(e=>Math.hypot(x-e.x,y-e.y)<240)&&
 !(c.shells||[]).some(e=>e.t>0&&e.t<8&&e.kind!=='smoke'&&Math.hypot(x-e.x,y-e.y)<(e.r||65)+60)&&
 !(c.obstacles||[]).some(o=>o.hp!==0&&o.type!=='trench'&&o.type!=='wire'&&Math.abs(x-o.x)<(o.bw||o.size*.5||22)+8&&Math.abs(y-o.y)<(o.bh||o.size*.5||22)+8))}
function frontOffset(p,lane){
 if(p.shape==='depth')return -22;
 if(p.shape==='redoubts')return lane%2?-38:12;
 if(p.shape==='staggered')return (lane%3-1)*p.amplitude;
 if(p.shape==='crescent')return Math.abs(lane-2)*18-28;
 if(p.shape==='dispersed')return (random(p.seed,lane+11)-.5)*60;
 return 0;
}
function preparation(p,c){
 const W=c.width||2400,H=c.height||1600,d=c.team?-1:1,front=c.front??(c.team?W-720:720),out=[],span=H/5;
 const add=(kind,pts,pri,line)=>{if(!c.catalog||c.catalog[kind])out.push({kind,pts:pts.map(([x,y])=>[clamp(x,40,W-40),clamp(y,40,H-40)]),pri,line,layout:p.id})};
 for(let lane=0;lane<5;lane++){
  const y=(lane+.5)*span,fx=front+d*frontOffset(p,lane),shift=(random(p.seed,lane+30)-.5)*24;
  if(c.second){
   add('dugout',[[fx-d*(p.depth+40),y+shift]],3);
   add('comm',[[fx-d*p.depth,y-span*.23],[fx-d*(p.depth+24),y],[fx-d*p.depth,y+span*.23]],4,'support');
   if(lane%2===0)add('nest',[[fx-d*30,y+span*.22]],2);
   continue;
  }
  let pts;
  if(p.shape==='redoubts')pts=[[fx-d*32,y-65],[fx,y-65],[fx+d*12,y],[fx,y+65],[fx-d*32,y+65]];
  else if(p.shape==='dispersed')pts=[[fx-d*12,y-78],[fx+d*22,y-35],[fx-d*12,y+12],[fx+d*12,y+70]];
  else {const half=p.shape==='depth'?span*.37:span*.43;pts=Array.from({length:5},(_,i)=>[fx+d*(i%2?p.amplitude:-p.amplitude),y-half+i*half/2])}
  add('trench',pts,10+Math.abs(lane-2)*.8,'front');
  add('nest',[[fx+d*8,y+(lane%2?1:-1)*(48+p.spread)]],20+Math.abs(lane-2)*.3);
  // Leave real corridors through every belt of wire at roads and squad exits.
  const cuts=[...(c.roads||[]),y],lo=Math.max(45,lane*span+24),hi=Math.min(H-45,(lane+1)*span-24);let intervals=[[lo,hi]];
  for(const road of cuts)intervals=intervals.flatMap(([a,b])=>road+48<=a||road-48>=b?[[a,b]]:[[a,Math.max(a,road-48)],[Math.min(b,road+48),b]].filter(([a,b])=>b-a>32));
  for(const [a,b] of intervals)add('wire',[[fx+d*110,a],[fx+d*110,b]],30);
  add('dugout',[[fx-d*(55+p.depth*.25),y+shift]],42);
  if(lane===1||lane===3||p.shape==='crescent'&&(lane===0||lane===4))add('bunker',[[fx-d*18,y]],47);
  if(lane===2)add('pillbox',[[fx-d*48,y]],53);
  if(lane%2===0)add('mortar',[[fx-d*(p.depth+55),y-shift]],50);
  add('comm',[[fx-d*p.depth,y+shift],[fx-d*p.depth*.55,y+28],[fx-d*20,y+shift]],60,'comm');
  if(p.shape==='depth'||p.shape==='staggered')add('comm',[[fx-d*p.depth,y-span*.3],[fx-d*(p.depth+18),y],[fx-d*p.depth,y+span*.3]],64,'support');
 }
 if(!c.second){if(c.artillery!==false)for(const [i,g] of (c.guns||[]).entries())add(g.k==='h'?'gunh':'gunf',[[c.team?W-g.x:g.x,g.y]],(g.k==='h'?58:40)+i*.1);
  for(const lane of [1,3])add('aa',[[front-d*(p.depth+180),(lane+.5)*span]],56);
 }
 return out.sort((a,b)=>a.pri-b.pri);
}
function sites(p,kind,s,front,back,c){
 const W=c.width||2400,H=c.height||1600,d=c.team?-1:1,baseY=s.y+(s.id%2?24:-24),fx=front-d*back;
 return [0,-1,1].map((side,index)=>{
  const jitter=(random(p.seed,s.id*17+index+80)-.5)*18;
  const x=clamp(fx+d*(Math.min(25,frontOffset(p,s.id))*.4+side*12),80,W-80),y=clamp(baseY+side*45+jitter,80,H-80);
  let pts=[[x,y]];
  if(kind==='trench'){
   if(p.shape==='redoubts')pts=[[x-d*20,y-35],[x,y-35],[x+d*16,y],[x,y+35],[x-d*20,y+35]];
   else if(p.shape==='staggered'||p.shape==='dispersed')pts=[[x-d*10,y-40],[x+d*18,y],[x-d*10,y+40]];
   else pts=[[x,y-42],[x+d*(p.shape==='zigzag'?18:0),y],[x,y+42]];
  }
  if(kind==='comm'){
   const target=(c.assets||[]).filter(a=>a.kind==='trench'&&Math.hypot(a.x-x,a.y-y)<240&&d*(a.x-x)>10).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];
   if(!target)return null;pts=[[x,y],[x+d*35,(y+target.y)/2],[target.x,target.y]];
  }
  return {x,y,pts,layout:p.id};
 }).filter(Boolean);
}
const api={layouts:layouts.map(p=>({id:p.id,name:p.name})),select,preparation,sites,safe,samples};root.IronFrontLayouts=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
