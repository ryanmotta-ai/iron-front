'use strict';
/* Iron Front — efeitos dos aviões: metralhamento e bombardeio.
   Carrega DEPOIS de pixel.js. pixel.js chama PLN.under (bombas em queda, antes dos aviões) e PLN.draw (clarões, traçantes,
   poeira, ondas de choque, depois dos aviões).
   Metralhamento: duas metralhadoras sincronizadas no nariz (Vickers dos EUA / LMG 08/15 alemãs) disparando em rajadas a cerca de 1080 tiros/min
   no total; a cada 3º tiro um traçante; os impactos levantam terra, poeira e deixam marcas no chão.
   Bombardeio: formação em fila (3 DH-4 / 2 Gotha G.V); cada bomba cai do ponto de lançamento até o alvo em ~1,25 s, com sombra, assobio
   e giro das aletas; a detonação sincroniza com o projétil de game.js (shells[].bomb) e ganha onda de choque, fonte de terra e coluna de fumaça. */
(function(){
const{disc,ring,pline,mk,g2,rotSprite,outlined,flipX,cached,Z}=PX,PL=PX.PLANES;if(!PL)return;
const rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rect=(c,x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h)};
let fx=[],scars=0,ex=0;
const SH=[14,22];                          // paralaxe da sombra (igual a pixel.js)

/* ---------- bombas: EUA = corpo verde-oliva, faixa amarela; Alemanha = aço cinza, aletas em caixa ---------- */
function bombBase(team){const c=mk(15,7),x=g2(c);x.imageSmoothingEnabled=false;
 const B=team?['#2b3138','#46505a','#66717c','#9aa4ad']:['#2a2c1a','#45472c','#64663f','#8d8f63'],F=team?['#20252a','#3a4248','#5a636b']:['#2f3120','#4d5036','#6b6e4a'];
 /* aletas de cauda */
 rect(x,0,0,4,7,F[1]);rect(x,0,0,4,1,F[2]);rect(x,0,6,4,1,F[0]);rect(x,3,1,1,5,F[0]);rect(x,1,2,2,3,F[0]);if(team){rect(x,0,0,1,7,F[2])}
 /* corpo cilindrico, luz em cima */
 for(let i=4;i<15;i++){const top=i<13?1:i<14?2:3,bot=i<13?5:i<14?4:3;for(let j=top;j<=bot;j++)rect(x,i,j,1,1,j===top?B[3]:j===top+1?B[2]:j===bot?B[0]:B[1])}
 rect(x,8,1,2,5,team?'#b3302b':'#d9b556');rect(x,8,1,2,1,team?'#d8524a':'#f0d27a');rect(x,9,5,1,1,team?'#7a1f1b':'#8a6d28');
 rect(x,13,3,1,1,B[3]);
 return c}
/* quadros do mergulho: horizontal, inclinada, quase vertical e de ponta (vista do nariz, aletas em cruz); o time 1 voa para a esquerda */
function bombFrame(team,f){return cached(`bmb${team}${f}`,()=>{
 if(f===3){const c=mk(9,9),x=g2(c);x.imageSmoothingEnabled=false;const col=team?['#2b3138','#66717c','#9aa4ad']:['#2a2c1a','#64663f','#8d8f63'];
  rect(x,3,0,3,9,col[0]);rect(x,0,3,9,3,col[0]);rect(x,3,1,3,7,team?'#3a4248':'#4d5036');rect(x,1,3,7,3,team?'#3a4248':'#4d5036');
  rect(x,2,2,5,5,col[1]);rect(x,3,3,3,3,col[2]);rect(x,3,3,1,1,'#ffffff');rect(x,4,4,1,1,team?'#b3302b':'#d9b556');
  return{c:outlined(c,.55),ax:5,ay:5}}
 const base=bombBase(team),r=rotSprite(base,[0,.62,1.25][f]);let o=outlined(r,.55),ax=Math.floor(r.width/2)+1;if(team){o=flipX(o);ax=o.width-ax-1}return{c:o,ax,ay:Math.floor(r.height/2)+1}})}

function whistle(s){if(typeof soundOn==='undefined'||!soundOn||typeof audio==='undefined'||!audio||s.bomb.w)return;s.bomb.w=1;
 if(Math.hypot(s.x-cam.x,s.y-cam.y)>1300)return;try{const t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(1500,t);o.frequency.exponentialRampToValueAtTime(380,t+s.bomb.fall);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.035,t+.25);g.gain.exponentialRampToValueAtTime(.0001,t+s.bomb.fall);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+s.bomb.fall+.05)}catch{}}

/* posição da bomba (em coordenadas do mundo) e altitude (1 = no avião, 0 = no chão) */
function bombState(s){const b=s.bomb,k=clamp(1-s.t/b.fall,0,1),pk=1-Math.pow(1-k,3);return{k,h:1-k*k,x:b.rx+(s.x-b.rx)*pk,y:b.ry+(s.y-b.ry)*pk}}

/* ---------- partículas ---------- */
function add(p){if(fx.length<900)fx.push(p);return p}
function dirt(x,y,n,power,height){const cols=['#2f281e','#4a3a28','#6b5640','#8a7656','#b39a6d'];for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=rnd(.3,1)*power;add({k:'dirt',x,y,vx:Math.cos(a)*s*.6,vy:Math.sin(a)*s*.3,z:0,vz:rnd(.6,1)*height,t:0,max:rnd(.5,1.1),col:cols[Math.floor(Math.random()*cols.length)],sz:Math.random()<.3?2:1})}}
function puff(x,y,size,life,dx,dy,k='dust',z=0){add({k,x,y,vx:dx,vy:dy,z,vz:0,t:0,max:life,size})}
function scar(x,y){const t=window.PXGAME&&PXGAME.tctx;if(!t||scars>1800)return;scars++;const bx=Math.round(x*Z),by=Math.round(y*Z);t.fillStyle='#17110a';t.fillRect(bx,by,1,1);t.fillStyle='#8a7656';t.fillRect(bx-1,by,1,1);if(Math.random()<.4){t.fillStyle='#2b2118';t.fillRect(bx+1,by+1,1,1)}}

function upd(dt){ex+=dt;
 for(const p of fx){p.t+=dt;p.x+=(p.vx||0)*dt;p.y+=(p.vy||0)*dt;if(p.k==='dirt'){p.z+=p.vz*60*dt;p.vz-=dt*3.2}else if(p.k==='ring'){}else{p.z=(p.z||0)+(p.k==='smoke'||p.k==='col'?6:0)*dt;if(p.vx)p.vx*=.97;if(p.vy)p.vy*=.97}}
 fx=fx.filter(p=>p.t<p.max);
 /* tiros (traçantes) e plumas */
 for(const p of planes){if(p.fl>0)p.fl-=dt;
  if(p.kind==='bomber'&&!(p.delay>0)){p.ec=(p.ec||0)-dt;if(p.ec<=0){p.ec=.22;const d=p.team?-1:1,exh=PL.info('bomber',p.team).exh||[];for(const[ox,oy]of exh)puff(p.x+ox*2-d*6,p.y+oy*2,rnd(1.2,2),rnd(.9,1.5),-d*rnd(20,40),rnd(-4,4),'smoke')}}}}

/* ---------- gancho de fim de bala / de bomba: impactos ---------- */
const origUpdate=window.update;
window.update=function(dt){const dyingB=typeof bullets!=='undefined'?bullets.filter(b=>b.air&&b.t-dt<=0):[],dyingS=typeof shells!=='undefined'?shells.filter(s=>s.bomb&&s.t-dt<=0):[];
 for(const s of shells)if(s.bomb&&s.t<=s.bomb.fall)whistle(s);
 const r=origUpdate.apply(this,arguments);
 for(const b of dyingB){const x=b.x+b.vx*.008,y=b.y+b.vy*.008;dirt(x,y,7+Math.floor(Math.random()*4),34,3.4);puff(x,y,rnd(3,4.6),rnd(.7,1.3),rnd(-8,8),rnd(-5,3),'dust',2);if(Math.random()<.5)puff(x+rnd(-4,4),y+rnd(-3,3),rnd(2.4,3.6),rnd(1,1.8),rnd(-10,10),rnd(-6,2),'dust',3);add({k:'spark',x,y,z:1,t:0,max:.09,vx:0,vy:0});scar(x,y)}
 for(const s of dyingS)bombBlast(s);
 return r};
function bombBlast(s){const R=s.r*.5;dirt(s.x,s.y,46,170,5.5);
 add({k:'ring',x:s.x,y:s.y,t:0,max:.6,r:s.r*1.25,vx:0,vy:0});add({k:'ring',x:s.x,y:s.y,t:-.08,max:.65,r:s.r*.8,vx:0,vy:0,inner:1});
 for(let i=0;i<7;i++)add({k:'col',x:s.x+rnd(-6,6),y:s.y+rnd(-5,5),vx:rnd(-6,6),vy:rnd(-3,3),z:i*4+rnd(0,3),t:-i*.06,max:rnd(2.2,3.4),size:rnd(7,11)-i*.3});
 for(let i=0;i<9;i++)puff(s.x+rnd(-R,R),s.y+rnd(-R,R),rnd(5,9),rnd(1.1,2),rnd(-30,30),rnd(-18,12),'dust',rnd(0,6));
 if(typeof screenShake!=='undefined'&&Math.hypot(s.x-cam.x,s.y-cam.y)<900)screenShake=Math.max(screenShake,4.2)}

/* ---------- desenho ---------- */
const sx=(ox,wx)=>ox+Math.round(wx*Z),sy=(oy,wy)=>oy+Math.round(wy*Z);
function under(c,ox,oy,dt){
 if(typeof shells==='undefined')return;
 for(const s of shells){const b=s.bomb;if(!b||s.t>b.fall)continue;const st=bombState(s),team=b.team?1:0,f=st.k<.16?0:st.k<.45?1:st.k<.78?2:3,dir=team?-1:1;let sp=bombFrame(team,f);
  const bx=sx(ox,st.x),by=sy(oy,st.y);if(bx<-30||by<-30||bx>vw+30||by>vh+30)continue;
  /* sombra no chão: sai do ponto sombra do avião e converge para o alvo */
  const shx=bx+Math.round(SH[0]*st.h),shy=by+Math.round(SH[1]*st.h);c.globalAlpha=.34;const sw=f===3?3:5-f;c.fillStyle='#0b1207';c.fillRect(shx-sw,shy-1,sw*2,3);c.fillRect(shx-sw+1,shy-2,sw*2-2,1);c.fillRect(shx-sw+1,shy+2,sw*2-2,1);c.globalAlpha=1;
  /* corpo em queda: nariz para o chão; antes do impacto fica de ponta */
  c.drawImage(sp.c,bx-sp.ax,by-sp.ay);
  /* rastro fino de ar */
  if(st.k<.7){c.globalAlpha=.3*(1-st.k);rect(c,bx-dir*9-(dir>0?0:0),by-1,4,1,'#d8dccf');c.globalAlpha=1}}
}
function ringFx(c,p,ox,oy){const k=clamp(p.t/p.max,0,1);if(p.t<0)return;const x=sx(ox,p.x),y=sy(oy,p.y),rr=Math.round(p.r*Z*(.25+.85*(1-Math.pow(1-k,2))));c.globalAlpha=(1-k)*(p.inner?.35:.65);
 ring(c,x,y,rr,Math.round(rr*.8),p.inner?'#c9c5b4':'#efe9d0',3,Math.floor(ex*14));ring(c,x,y,Math.max(1,rr-1),Math.max(1,Math.round(rr*.8)-1),p.inner?'#8d8873':'#b9b49c',3,Math.floor(ex*14)+1);c.globalAlpha=1}
function draw(c,ox,oy,dt){upd(dt||0);
 /* clarões do cano, traçantes e cápsulas */
 for(const p of planes){if(p.kind!=='fighter')continue;const x=sx(ox,p.x),y=sy(oy,p.y);if(x<-60||y<-60||x>vw+60||y>vh+60)continue;
  if(p.fl>0){const m=PL.info('fighter',p.team).muzzles,d=p.team?-1:1,big=(p.burst&1)?0:1;const[dx,dy]=m[(p.burst||0)&1]||m[0];const fxp=x+Math.round(dx),fyp=y+Math.round(dy);
   c.globalAlpha=.3;disc(c,fxp+d*2,fyp,5,'#ffcf6a');c.globalAlpha=.16;disc(c,fxp+d*2,fyp,9,'#ffb347');c.globalAlpha=1;
   for(const[off,l,col]of[[-.35,.6,'#ff7a24'],[0,1,'#fff0b0'],[.35,.6,'#ff7a24']]){const a=(d>0?0:Math.PI)+off;pline(c,fxp,fyp,fxp+Math.cos(a)*7*l,fyp+Math.sin(a)*7*l,col)}
   rect(c,fxp-1,fyp-1,3,3,'#ffd466');rect(c,fxp,fyp,1,1,'#ffffff');
   if(Math.random()<.5)add({k:'brass',x:p.x+(m[0][0]*-.5)*2*d,y:p.y+dy*2+rnd(-4,4),vx:-d*rnd(20,50),vy:rnd(20,50),z:4,vz:0,t:0,max:rnd(.35,.6)})}}
 for(const b of bullets){if(!b.air||!b.tr)continue;const x=sx(ox,b.x),y=sy(oy,b.y);if(x<-30||y<-30||x>vw+30||y>vh+30)continue;const sp=Math.hypot(b.vx,b.vy)||1,nx=b.vx/sp,ny=b.vy/sp;
  c.globalAlpha=.3;disc(c,x,y,3,'#ffe9a0');c.globalAlpha=1;
  const cols=['#ffffff','#fff6c8','#ffe27a','#ffc04a','#ff9b32','#e8701f','#b84a18'];for(let i=0;i<7;i++){pline(c,x-nx*i*2.8,y-ny*i*2.8,x-nx*(i+1)*2.8,y-ny*(i+1)*2.8,cols[i]);if(i<4)pline(c,x-nx*i*2.8,y-ny*i*2.8+1,x-nx*(i+1)*2.8,y-ny*(i+1)*2.8+1,cols[Math.min(6,i+2)])}
  rect(c,Math.round(x)-1,Math.round(y)-1,2,2,'#ffffff')}
 /* partículas */
 for(const p of fx){if(p.t<0)continue;const k=p.t/p.max;
  if(p.k==='ring'){ringFx(c,p,ox,oy);continue}
  const x=sx(ox,p.x),y=sy(oy,p.y)-Math.round(p.z||0);if(x<-30||y<-40||x>vw+30||y>vh+30)continue;
  if(p.k==='dirt'){c.globalAlpha=k>.6?1-(k-.6)/.4:1;rect(c,x,y,p.sz,p.sz,p.col);if(p.sz===2&&k<.5)rect(c,x,y,1,1,'#d3c195');c.globalAlpha=1}
  else if(p.k==='brass'){c.globalAlpha=1-k;rect(c,x,y,1,1,'#f0d27a');rect(c,x+1,y+1,1,1,'#b8923a');c.globalAlpha=1}
  else if(p.k==='spark'){rect(c,x-1,y-1,3,3,'#fff6cc');rect(c,x,y-2,1,5,'#ffd27a');rect(c,x-2,y,5,1,'#ffd27a')}
  else{const r=Math.max(1,Math.round((p.size||3)*(1+k*.9)));
   if(p.k==='dust'){c.globalAlpha=(k>.6?.15:k>.3?.32:.5);disc(c,x,y,r,'#a8946c');if(r>2){c.globalAlpha*=.8;disc(c,x-1,y-1,Math.max(1,Math.round(r*.55)),'#c7b48a')}c.globalAlpha=1}
   else if(p.k==='smoke'){c.globalAlpha=k>.7?.18:k>.35?.4:.6;disc(c,x,y,r,'#8d8a82');c.globalAlpha=1}
   else if(p.k==='col'){c.globalAlpha=k>.8?.3:k>.55?.55:.85;disc(c,x,y,r,k<.35?'#2f2c27':k<.65?'#4f4a42':'#7a746a');if(r>3){c.globalAlpha*=.9;disc(c,x-1,y-2,Math.max(1,Math.round(r*.55)),k<.35?'#47423a':k<.65?'#6a645a':'#9a9488')}c.globalAlpha=1}}}}
window.PLN={under,draw};
})();
