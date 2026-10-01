'use strict';
(function(){
const {disc,pline,ring}=PX,WW=PX.WW1,rnd=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.floor(Math.random()*a.length)];
/* Iron Front 0.6 — vida do campo de batalha: bandeiras ao vento, fumaça da cozinha, fogueiras, vapor do trem,
   canhões da bateria disparando, sinalizadores sobre a terra de ninguém, ratos nas trincheiras e o setor sob a câmera.
   Tudo em pixels inteiros; posições em pixels de arte (as mesmas do terreno). */
let E=[],parts=[],flares=[],rats=[],guns=[],clock=0,nextShot=4,nextFlare=14,lastSector='',sectorAt=0,active=false,flashes=[];
const rect=(c,x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h)};
const wind=()=>window.PXW?PXW.windVec():{x:6,y:0,s:.3};

function init(base){E=[];parts=[];flares=[];rats=[];guns=[];flashes=[];clock=0;nextShot=rnd(2,5);nextFlare=rnd(10,20);
 active=typeof map!=='undefined'&&map==='trenches'&&base&&base.ambient;if(!active)return;
 E=base.ambient.map(a=>Object.assign({ph:Math.random()*6.28,acc:Math.random()},a));
 guns=E.filter(a=>a.t==='gun');
 /* ratos: seguem as linhas de frente e de apoio (sem fortificações não há trincheira para eles) */
 if(!WW.forts||WW.forts())for(const team of[0,1])for(const kind of['front','support','reserve']){const pts=WW.teamPaths(team).find(p=>p.kind===kind).pts,smp=WW.sample(pts,4);for(let i=0;i<6;i++)rats.push({smp,i:Math.floor(Math.random()*smp.length),dir:Math.random()<.5?1:-1,wait:rnd(0,4),v:rnd(10,18),f:0,ox:rnd(-2.5,2.5)})}}

function puff(x,y,o={}){if(parts.length>260)return;const w=wind();parts.push(Object.assign({x,y,vx:rnd(-2,2)+w.x*.25,vy:-rnd(8,15),t:0,max:rnd(2.2,3.4),size:rnd(2,3.4),k:'smoke'},o))}
function upd(dt){clock+=dt;
 for(const e of E){e.acc+=dt;
  if(e.t==='smoke'&&e.acc>.26){e.acc=0;puff(e.x+rnd(-.6,.6),e.y,{size:rnd(1.8,2.8)})}
  else if(e.t==='steam'&&e.acc>.2){e.acc=0;puff(e.x+rnd(-1,1),e.y,{k:'steam',vy:-rnd(12,20),size:rnd(2.2,3.6),max:rnd(1.5,2.4)})}
  else if(e.t==='fire'){if(e.acc>(e.big?.17:.4)){e.acc=0;puff(e.x+rnd(-1,1),e.y-2,{k:e.big?'black':'smoke',size:e.big?rnd(2.6,4):rnd(1.4,2.2),vy:-rnd(14,24),max:rnd(1.8,3)})}}}
 for(const p of parts){const w=wind();p.x+=(p.vx+w.x*.05)*dt;p.y+=p.vy*dt;p.vx*=.985;p.vy*=.99;p.t+=dt}
 parts=parts.filter(p=>p.t<p.max);
 for(const f of flashes)f.t+=dt;flashes=flashes.filter(f=>f.t<f.max);
 /* artilharia: uma bateria dispara de tempos em tempos */
 nextShot-=dt;if(nextShot<=0&&guns.length&&!(window.PXBAT&&PXBAT.active())){nextShot=rnd(1.2,3.6);const g=pick(guns),dir=g.team?-1:1,L=g.big?4:2;fireGun(g,dir)}
 /* sinalizadores */
 nextFlare-=dt;if(nextFlare<=0){nextFlare=rnd(18,42);flares.push({x:rnd(470,730),y:rnd(90,710),h:0,t:0,max:rnd(6,8.5),dx:rnd(2,6)})}
 for(const f of flares){f.t+=dt;f.h=Math.min(46,f.t*44)*(f.t<1.1?1:1-(f.t-1.1)/(f.max*2.2));f.x+=f.dx*dt*.6}
 flares=flares.filter(f=>f.t<f.max);
 for(const r of rats){if(r.wait>0){r.wait-=dt;r.f=0;continue}r.f+=dt*r.v;const step=Math.floor(r.f);if(step>=1){r.f-=step;r.i+=r.dir*step;if(r.i<0||r.i>=r.smp.length){r.i=clamp(r.i,0,r.smp.length-1);r.dir*=-1}if(Math.random()<.04)r.wait=rnd(1,5);if(Math.random()<.02)r.dir*=-1}}}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function fireGun(g,dir){flashes.push({x:g.x,y:g.y,dir,t:0,max:.16,big:g.big});const k=g.big?5:3;for(let i=0;i<k;i++)puff(g.x+dir*rnd(0,6),g.y+rnd(-2,2),{k:'gun',vx:dir*rnd(6,20),vy:-rnd(2,8),size:g.big?rnd(3.4,5):rnd(2.4,3.8),max:rnd(1.3,2.2)});
 for(let i=0;i<4;i++)puff(g.x-dir*rnd(4,12),g.y+rnd(-7,7),{k:'dust',vx:-dir*rnd(4,14),vy:-rnd(0,4),size:rnd(2.4,4),max:rnd(.8,1.4)});
 if(typeof soundOn!=='undefined'&&soundOn&&typeof sound==='function'&&Math.random()<.4&&Math.hypot(g.x*2-cam.x,g.y*2-cam.y)<1100)sound('boom')}

function flag(c,x,y,team,big){const cols=team?['#b8654b','#dd8b6f','#8a4530']:['#5d92b5','#8ab6cf','#3f6d8d'],w=wind(),s=w.s,Wd=big?21:15,Hh=big?12:9,t=typeof time==='number'?time:clock;
 const NF=window.IFK&&IFK.flagPx;   /* 1.9: bandeira nacional (life-kit.js) no lugar do pano azul/vermelho liso */
 for(let k=0;k<Wd;k++){const wv=Math.round(Math.sin(t*(3+s*5)+k*.7)*(k>2?1:0)*(k/9+.3)*(.5+s*1.3)),top=y+wv;if(NF){for(let r=0;r<Hh;r++)rect(c,x+1+k,top+r,1,1,k<1?'#151812':NF(team?1:0,k-1,r,Wd-1,Hh));if(k>0)rect(c,x+1+k,top+Hh,1,1,'rgba(0,0,0,.25)');continue}rect(c,x+1+k,top,1,Hh,k<1?'#151812':cols[0]);rect(c,x+1+k,top,1,1,cols[1]);rect(c,x+1+k,top+Hh-1,1,1,cols[2]);if(big&&k>2&&k<Wd-2){if(Hh>9&&k%5===3)rect(c,x+1+k,top+4,1,3,'#e9e4c8')}if(k>Wd-5&&k%2===0)rect(c,x+1+k,top+Hh-1+(k%4===0?1:0),1,1,cols[2])}}
function flame(c,x,y,big,ph){const h=(big?6:4)+Math.round(Math.sin(clock*14+ph)*1.2+Math.sin(clock*23+ph*2)*.8),w=big?3:2;
 c.globalAlpha=.16;disc(c,x,y-1,big?11:7,'#ff9b32');c.globalAlpha=.1;disc(c,x,y-1,big?17:11,'#ff7a24');c.globalAlpha=1;
 rect(c,x-w,y-h+2,w*2+1,h-1,'#c0471a');rect(c,x-w+1,y-h+1,w*2-1,h,'#ee8a2a');rect(c,x-1,y-h,3,h,'#ffd27a');rect(c,x,y-h-1,1,2,'#ffd27a');rect(c,x,y-2,1,2,'#fff6cc')}
function drawPart(c,ox,oy,p){const x=ox+Math.round(p.x),y=oy+Math.round(p.y),k=p.t/p.max;let r=Math.max(1,Math.round(p.size*(1+k*.7)));
 let a,c0,c1;
 if(p.k==='smoke'){a=k>.75?.22:k>.5?.45:k>.25?.62:.72;c0=k<.4?'#8d8a82':'#a9a59b';c1=k<.4?'#b7b3a9':'#c9c5ba'}
 else if(p.k==='steam'){a=k>.7?.25:k>.4?.5:.78;c0='#c9ccc6';c1='#eceee8'}
 else if(p.k==='black'){a=k>.75?.25:k>.5?.5:.8;c0='#2b2926';c1='#46423d'}
 else if(p.k==='gun'){a=k>.75?.25:k>.45?.5:.75;c0='#a8a496';c1='#d3cfc1';r=Math.max(1,Math.round(p.size*(1+k*1.1)))}
 else{a=k>.6?.14:k>.3?.3:.5;c0='#7c6a4c';c1='#9b8860'}
 c.globalAlpha=a;disc(c,x,y,r,c0);if(r>2)disc(c,x-1,y-1,Math.max(1,Math.round(r*.55)),c1);c.globalAlpha=1}
function drawFlash(c,ox,oy,f){const x=ox+Math.round(f.x),y=oy+Math.round(f.y),ph=f.t/f.max,L=f.big?15:10,d=f.dir;
 if(ph<.5){c.globalAlpha=.28;disc(c,x+d*3,y,f.big?17:11,'#ffcf6a');c.globalAlpha=.16;disc(c,x+d*3,y,f.big?27:17,'#ffb347');c.globalAlpha=1;
  for(const[off,l,col]of[[-.5,.55,'#ff7a24'],[-.25,.8,'#ffa83a'],[0,1,'#fff0b0'],[.25,.8,'#ffa83a'],[.5,.55,'#ff7a24']]){const a=(d>0?0:Math.PI)+off*(d>0?1:-1);pline(c,x,y,x+Math.cos(a)*L*l,y+Math.sin(a)*L*l,col);if(Math.abs(off)<.3)pline(c,x,y+1,x+Math.cos(a)*L*l*.85,y+1+Math.sin(a)*L*l*.85,col)}
  rect(c,x-2,y-2,5,5,'#ffd466');rect(c,x-1,y-1,3,3,'#fffbe0')}
 else{rect(c,x,y-1,3,3,'#ff9b32');rect(c,x+d*3,y,2,1,'#ffd27a')}}
function drawFlare(c,ox,oy,f){const x=ox+Math.round(f.x),y=oy+Math.round(f.y-f.h),fade=f.t>f.max-1.8?Math.max(0,(f.max-f.t)/1.8):1;
 c.globalAlpha=.055*fade;disc(c,x,y+f.h,90,'#fff2c0');c.globalAlpha=.06*fade;disc(c,x,y+f.h,62,'#fff2c0');c.globalAlpha=.07*fade;disc(c,x,y+f.h,36,'#fff6d6');c.globalAlpha=1;
 for(let i=1;i<7;i++){c.globalAlpha=(1-i/7)*.6*fade;rect(c,x+(i>3?1:0),y+i*2,1,1,'#ffd98a')}c.globalAlpha=1;
 rect(c,x-1,y-1,3,3,'#fff6cc');rect(c,x,y-2,1,5,'#ffffff');rect(c,x-2,y,5,1,'#ffffff')}
function drawRat(c,ox,oy,r){const s=r.smp[r.i];if(!s)return;const x=ox+Math.round(s[0]+r.ox),y=oy+Math.round(s[1]);const d=r.dir;rect(c,x,y,3,2,'#3a2b20');rect(c,x+(d>0?3:-1),y,1,1,'#5a4232');rect(c,x+(d>0?-2:3),y+1,2,1,'#8a6a5a');rect(c,x+(d>0?1:0),y-1,1,1,'#6b5040')}

window.WW1A={
 under(c,ox,oy,dt){if(!active)return;upd(dt||0);
  for(const r of rats){const x=ox+r.smp[clamp(r.i,0,r.smp.length-1)][0],y=oy+r.smp[clamp(r.i,0,r.smp.length-1)][1];if(x<-8||y<-8||x>vw+8||y>vh+8)continue;drawRat(c,ox,oy,r)}
  for(const e of E){if(e.t!=='fire')continue;const x=ox+Math.round(e.x),y=oy+Math.round(e.y);if(x<-20||y<-20||x>vw+20||y>vh+20)continue;flame(c,x,y,!!e.big,e.ph)}},
 over(c,ox,oy,dt){if(!active)return;
  for(const e of E){if(e.t!=='flag')continue;const x=ox+Math.round(e.x)+1,y=oy+Math.round(e.y);if(x<-30||y<-30||x>vw+30||y>vh+30)continue;flag(c,x,y,e.team,e.big)}
  for(const p of parts){const x=ox+p.x,y=oy+p.y;if(x<-16||y<-16||x>vw+16||y>vh+16)continue;drawPart(c,ox,oy,p)}
  for(const f of flashes){const x=ox+f.x,y=oy+f.y;if(x<-40||y<-40||x>vw+40||y>vh+40)continue;drawFlash(c,ox,oy,f)}
  for(const f of flares){const x=ox+f.x,y=oy+f.y;if(x<-130||y<-130||x>vw+130||y>vh+200)continue;drawFlare(c,ox,oy,f)}},
 init};

/* ---------- rótulo do setor sob a câmera ---------- */
function sectorLabel(){const top=document.querySelector('.fieldtop');if(!top)return null;let el=document.getElementById('sector');if(!el){el=document.createElement('span');el.id='sector';el.style.cssText='margin-left:auto;color:#c5db91;letter-spacing:1px';const wx=document.getElementById('weather');top.insertBefore(el,wx||null);if(wx)wx.style.marginLeft='0'}return el}
function updSector(){if(!active){const el=document.getElementById('sector');if(el)el.textContent='';return}
 const el=sectorLabel();if(!el)return;const z=WW.zoneAt(cam.x,cam.y),name=z.team<0?z.name:z.name+(z.team?' · CENTRAIS':' · ALIADOS');if(name!==lastSector){lastSector=name;el.textContent='◈ '+name}}
setInterval(updSector,300);

/* ligações: reinicia ao começar uma partida; o primeiro quadro já usa o terreno carregado */
const origSetup=window.setup;window.setup=function(...a){const r=origSetup.apply(this,a);init(window.PXGAME&&PXGAME.base);lastSector='';return r};
init(window.PXGAME&&PXGAME.base);
})();
