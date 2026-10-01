'use strict';
/* Iron Front 1.3 — sangue realista.
   Camada independente, carregada depois de pixel.js/physics.js/sappers.js. Envolve damage / explode / update / setup e desenha por
   dois ganchos de uma linha no pixel.js (BLOOD.under depois do terreno, BLOOD.over depois das partículas). Nada de tanque: só carne.

   · ferida ........ névoa na entrada, leque de gotas na saída (na direção do tiro) que caem com gravidade e deixam respingos no chão
   · morte ......... 3–5 jatos arteriais em arco, poça que cresce sob o corpo por ~10 s, arrasto se morreu correndo, cachos em explosão
   · feridos ....... abaixo de 60% de vida pingam (mais andando), com mancha escura no uniforme
   · água .......... sem mancha no chão: nuvem rosada que se dilui e vai com a correnteza (se a física 1.1 estiver ligada)
   · secagem ....... o sangue nasce vermelho vivo e brilhante (camadas "molhadas" que somem em ~25 s) sobre uma camada seca, marrom-escura;
                     chuva lava a camada seca; cratera de explosão apaga o que cobre
   Liga/desliga: ?sangue=0 (desliga) · ?sangue=1 (moderado) · ?sangue=2 (padrão) · BLOOD.on / BLOOD.level. API de teste: IronFront.blood. */
(function(){
const PXO=window.PX;if(!PXO){console.warn('blood.js: PX ausente');return}
const Z=PXO.Z,TAU=Math.PI*2,mix=PXO.mix,disc=PXO.disc;
const qs=new URLSearchParams(location.search);
const lv0=qs.has('sangue')?Math.max(0,Math.min(2,+qs.get('sangue')||0)):2;
const B={on:lv0>0,level:lv0||2,stats:{hits:0,kills:0,peakP:0,peakPools:0,errors:0}};
const MAXP=650,MAXPOOL=120,G=420,GEN_T=6,NGEN=4,FADE=13,WETA=.75;
const rnd=(a,b)=>a+Math.random()*(b-a),g3=()=>(Math.random()+Math.random()+Math.random()-1.5)/1.5,clamp=(v,a,b)=>v<a?a:v>b?b:v;
const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('blood.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};
const fail=e=>{B.stats.errors++;console.warn('blood.js:',e);if(B.stats.errors>4){B.on=false;console.warn('blood.js: desligado após erros repetidos')}};

/* ---------- paleta: do vermelho vivo (fino) ao quase preto (grosso); a camada seca é a mesma escurecida ---------- */
const WET=['#b3171e','#94121a','#7a0f16','#5e0b11','#45080d'],DRY=WET.map(c=>mix(c,'#2a0907',.5)),ART='#d3212a',SPEC='#e8564a';
const hash=(x,y,s)=>{let h=(x*374761393+y*668265263+s*982451653)|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296};

/* ---------- camadas de chão: uma seca + NGEN "molhadas" que rodam a cada GEN_T s e somem em ~FADE s; 1 px = 1 px do terreno (Z=.5) ---------- */
let dry=null,dctx=null,gens=[],gi=0,cw=0,ch=0,washT=0;
function mkLayer(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return{c,g:c.getContext('2d'),t0:-1e9}}
function alloc(w,h){cw=w;ch=h;const d=mkLayer(w,h);dry=d.c;dctx=d.g;gens=[];for(let i=0;i<NGEN;i++)gens.push(mkLayer(w,h));gi=0;gens[0].t0=time;washT=0}
function ensure(){const t=terrain;if(!t)return false;if(!dry||cw!==t.width||ch!==t.height)alloc(t.width,t.height);return true}
function stamp(tx,ty,w,h,ci,a){const g=gens[gi].g;g.globalAlpha=a;g.fillStyle=WET[ci];g.fillRect(tx,ty,w,h);dctx.globalAlpha=a*.9;dctx.fillStyle=DRY[ci];dctx.fillRect(tx,ty,w,h)}
function stampWet(tx,ty,col,a){const g=gens[gi].g;g.globalAlpha=a;g.fillStyle=col;g.fillRect(tx,ty,1,1)}
function stampDisc(cx,cy,r,ci,a){for(let dy=-r;dy<=r;dy++){const w=Math.floor(Math.sqrt(r*r-dy*dy+.25));stamp(cx-w,cy+dy,w*2+1,1,ci,a)}}
function eraseDisc(cx,cy,r,a){for(const l of[dctx,...gens.map(x=>x.g)]){l.globalCompositeOperation='destination-out';l.globalAlpha=a;l.fillStyle='#000';for(let dy=-r;dy<=r;dy++){const w=Math.floor(Math.sqrt(r*r-dy*dy+.25));l.fillRect(cx-w,cy+dy,w*2+1,1)}l.globalCompositeOperation='source-over'}}

/* ---------- partículas (x,y no chão, z = altura): gota 'd', névoa 'm', cacho 'c', nuvem na água 'w' ---------- */
let parts=[],pools=[],bleeders=[],bctx=null;
const depthAt=(x,y)=>window.PXW?PXW.depth(x,y):0;
function flowVec(x,y){try{const f=window.IronFront&&IronFront.physics&&IronFront.physics.flowAt;if(f){const v=f(x,y);return v||{x:0,y:0}}}catch(e){}return{x:0,y:8}}
function drop(x,y,z,a,sp,vz,big,k='d'){if(parts.length>=MAXP)return;parts.push({k,x,y,z,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,vz,t:2,s:big?2:1,ci:big?1:Math.random()<.35?0:Math.random()<.6?1:2})}
function spray(x,y,z,ang,spread,n,sp0,sp1,vz0,vz1,bigP){for(let i=0;i<n;i++)drop(x,y,z+rnd(-2,2),ang+g3()*spread,rnd(sp0,sp1),rnd(vz0,vz1),Math.random()<bigP)}
function mist(x,y,z,a,sp,r,life,al){if(parts.length>=MAXP)return;parts.push({k:'m',x,y,z,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,vz:rnd(-4,18),t:life,max:life,r,al})}
function cloud(x,y,r0,life,vx,vy,al=.3){if(parts.length>=MAXP)return;parts.push({k:'w',x,y,z:0,vx,vy,vz:0,t:life,max:life,r:r0,al})}
function chunk(x,y,z,a,sp,vz){if(parts.length>=MAXP)return;parts.push({k:'c',x,y,z,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,vz,t:2.5,b:0})}

/* respingo no chão: 1 px vivo + rastro curto na direção do voo + satélites nos maiores; na lama é absorvido, na água vira nuvem */
function splat(x,y,vx,vy,size,ci){if(!dry)return;const tx=Math.round(x*Z),ty=Math.round(y*Z);if(tx<1||ty<1||tx>=cw-2||ty>=ch-2)return;
 const m=window.PXW&&PXW.mudAt?PXW.mudAt(x,y):0,al=m>.3?.7:.95,sp=Math.hypot(vx,vy);
 stamp(tx,ty,size,size,size>1?2:ci,al);
 if(sp>110){const nx=vx/sp,ny=vy/sp,L=sp>210?3:sp>150?2:1;for(let i=1;i<=L;i++)stamp(Math.round(tx+nx*i),Math.round(ty+ny*i*.8),1,1,1,al*(1-i*.18))}
 if(size>1){for(let i=0;i<2;i++)if(Math.random()<.65)stamp(tx+Math.round(rnd(-3,3)),ty+Math.round(rnd(-2,2)),1,1,1,al*.8)}}
function land(p){const x=p.x,y=p.y;if(depthAt(x,y)>=.15){if(Math.random()<.4)cloud(x,y,1.5,rnd(.9,1.6),rnd(-3,3),rnd(-3,3),.26);return}
 if(p.k==='d'&&p.s<2&&Math.random()<.4)return;
 if(p.k==='c'){splat(x,y,p.vx,p.vy,2,3);stamp(Math.round(x*Z)-1,Math.round(y*Z)-1,3,2,3,.55);return}
 splat(x,y,p.vx,p.vy,p.s,p.ci)}

function addPool(x,y,rmax){if(!dry)return;if(pools.length>=MAXPOOL)pools.shift();const s=Math.random()*1e4|0;
 pools.push({x:Math.round(x*Z),y:Math.round(y*Z)+1,r:1,rd:0,rmax,seed:s,nx:0,a1:rnd(0,TAU),a2:rnd(0,TAU),a3:rnd(0,TAU),l1:rnd(.05,.14),l2:rnd(.04,.11),l3:rnd(.02,.07)})}
const lobe=(p,th)=>1+p.l1*Math.sin(2*th+p.a1)+p.l2*Math.sin(3*th+p.a2)+p.l3*Math.sin(5*th+p.a3);
function poolStep(p){const rn=p.r,rp=p.rd,R=Math.ceil(rn*1.3)+1;
 for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){const d=Math.hypot(dx,dy*1.18),lim=lobe(p,Math.atan2(dy,dx));if(d>rn*lim||d<=rp*lim)continue;
  const edge=d>rn*lim-1.15,tx=p.x+dx,ty=p.y+dy;if(edge&&hash(tx,ty,p.seed)<.24)continue;stamp(tx,ty,1,1,edge?0:1,edge?.72:.88)}
 if(rn>3)stampDisc(p.x,p.y,Math.max(1,Math.round(rn*.52)),3,.11);
 p.rd=rn}
function smear(x,y,dx,dy,len){if(!dry)return;const tx=x*Z,ty=y*Z;for(let i=1;i<=len;i++){const px=Math.round(tx+dx*i),py=Math.round(ty+dy*i*.8);stamp(px,py,1,1,i<len*.6?2:1,.85);if(i%2===0)stamp(px+(Math.round(-dy)),py+(Math.round(dx)),1,1,1,.6)}}

/* ---------- eventos ---------- */
function hitDirOf(u,att){if(bctx){const dx=u.x-bctx.x,dy=u.y-bctx.y,l=Math.hypot(dx,dy)||1;return{x:dx/l,y:dy/l,blast:true}}
 let best=null,bd=2000;for(const b of bullets){if(!b.damage||b.team!==att)continue;const d=(b.x-u.x)**2+(b.y-u.y)**2;if(d<bd){bd=d;best=b}}
 if(best){const l=Math.hypot(best.vx,best.vy)||1;return{x:best.vx/l,y:best.vy/l}}const a=rnd(0,TAU);return{x:Math.cos(a),y:Math.sin(a)}}
function wound(u,n,att){const I=B.level/2,dir=hitDirOf(u,att),dead=u.hp<=0,blast=!!dir.blast,ang=Math.atan2(dir.y,dir.x),wet=depthAt(u.x,u.y)>=.25,ox=u.x,oy=u.y-2,oz=13;
 B.stats.hits++;u.bl=Math.min(1,(u.bl||0)+n/u.maxhp*1.4);
 const cnt=Math.min(22,Math.round((1.5+n/9)*(blast?1.6:1)*I)+(dead?3:0));
 if(wet){for(let i=0;i<Math.min(6,1+n/10);i++)cloud(ox+rnd(-4,4),oy+rnd(-2,4),rnd(1.5,3),rnd(1.2,2.4),rnd(-5,5),rnd(-5,5),.3)}
 else{
  /* entrada: névoa fina para trás; saída: leque de gotas no sentido do tiro + névoa */
  mist(ox-dir.x*3,oy-dir.y*3,oz,ang+Math.PI,rnd(6,26),rnd(1.5,2.5),rnd(.22,.4),.3*I);
  spray(ox+dir.x*3,oy+dir.y*3,oz,ang,blast?.95:.42,cnt,blast?90:70,blast?270:230,25,blast?170:130,n>18?.22:.06);
  for(let i=0;i<Math.min(6,1+Math.round(n/13*I));i++)mist(ox+dir.x*4,oy+dir.y*4,oz+rnd(-3,4),ang+g3()*.5,rnd(24,80),rnd(1.5,3),rnd(.3,.6),.32*I);
  if(Math.random()<.6)spray(ox,oy+3,6,rnd(0,TAU),3,1,6,42,10,55,.05)}/* gotas que caem rente ao soldado */
 if(!dead)return;
 B.stats.kills++;
 const c=corpses[corpses.length-1],has=c&&Math.abs(c.x-u.x)<1&&Math.abs(c.y-u.y)<1,sx=has&&c.sx?c.sx:0,sy=has&&c.sy?c.sy:0;
 if(wet||(has&&c.fl)){bleeders.push({x:ox,y:oy,ang,t:0,n:5,gap:.55,next:.05,water:true});return}
 /* jatos arteriais: 3–5 pulsos, cada um mais fraco que o anterior */
 bleeders.push({x:ox,y:oy,ang,t:0,n:3+(Math.random()<.5?1:0)+(n>25?1:0),gap:.42,next:.12,k0:1,water:false,blast});
 const big=clamp(3.8+n/14,4.6,7.6)*rnd(.85,1.15)*(0.8+.2*I),px=u.x+sx/Z,py=u.y+sy/Z;
 addPool(px,py,big);
 if(!blast&&u.moving)smear(u.x,u.y+2,dir.x,dir.y,Math.round(rnd(4,8)));/* morreu correndo: arrasto no sentido da queda */
 if(blast){for(let i=0;i<Math.round(rnd(7,11)*I);i++)mist(ox,oy,rnd(4,14),rnd(0,TAU),rnd(20,95),rnd(2.5,5),rnd(.5,1),.4*I);
  spray(ox,oy,10,ang,1.6,Math.round(11*I),60,250,40,190,.2);
  for(let i=0;i<Math.round(rnd(2,5)*I);i++)chunk(ox,oy,10,ang+g3()*1.4,rnd(40,150),rnd(70,150));
  addPool(px+rnd(-7,7),py+rnd(-5,5),rnd(2.5,4.5))}}
function pulse(b){const k=b.n/5;spray(b.x,b.y,11,b.ang,b.blast?2.4:1.5,Math.max(2,Math.round((2+b.n*1.1)*B.level/2)),25+b.n*8,75+b.n*14,110,190,.15);
 if(Math.random()<.7)mist(b.x,b.y,14,b.ang+g3(),rnd(8,30),rnd(1.5,2.5),rnd(.3,.5),.26)}

/* ---------- passo: partículas, jatos, poças, pingos de feridos, lavagem pela chuva ---------- */
function step(dt){if(!ensure())return;
 const t=time;if(t-gens[gi].t0>GEN_T){gi=(gi+1)%NGEN;const l=gens[gi];l.g.globalCompositeOperation='source-over';l.g.clearRect(0,0,cw,ch);l.t0=t}else if(t<gens[gi].t0){for(const l of gens){l.g.clearRect(0,0,cw,ch);l.t0=-1e9}gens[gi].t0=t}
 for(let i=bleeders.length-1;i>=0;i--){const b=bleeders[i];b.t+=dt;if(b.t<b.next)continue;
  if(b.water){cloud(b.x+rnd(-3,3),b.y+rnd(-2,3),rnd(2,4),rnd(1.6,3),rnd(-4,4),rnd(-4,4),.3);b.n--;b.next=b.t+.3;if(b.t>6||b.n<-14)bleeders.splice(i,1);continue}
  pulse(b);b.n--;b.next=b.t+b.gap*rnd(.85,1.2);if(b.n<=0)bleeders.splice(i,1)}
 for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.t-=dt;
  if(p.k==='w'){const f=flowVec(p.x,p.y);p.x+=(p.vx+f.x*.5)*dt;p.y+=(p.vy+f.y*.5)*dt;p.r+=dt*2.2;if(p.t<=0)parts.splice(i,1);continue}
  if(p.k==='m'){p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vx*=1-2.2*dt;p.vy*=1-2.2*dt;p.r+=dt*7;if(window.PXW){const w=PXW.windVec();p.x+=w.x*dt*.3;p.y+=w.y*dt*.3}if(p.t<=0)parts.splice(i,1);continue}
  p.vz-=G*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
  if(p.z<=0||p.t<=0){if(p.k==='c'&&p.b<1&&p.vz<-60){p.b++;p.z=0;p.vz=-p.vz*.32;p.vx*=.5;p.vy*=.5;splat(p.x,p.y,p.vx,p.vy,2,3);continue}land(p);parts.splice(i,1)}}
 for(let i=pools.length-1;i>=0;i--){const p=pools[i];if(p.r>=p.rmax){poolStep(p);stampWet(p.x-Math.round(p.r*.35),p.y-Math.round(p.r*.32),SPEC,.9);stampWet(p.x-Math.round(p.r*.35)+1,p.y-Math.round(p.r*.32),SPEC,.6);pools.splice(i,1);continue}
  p.nx-=dt;if(p.nx>0)continue;p.nx=.12;p.r=Math.min(p.rmax,p.r+(.22+(p.rmax-p.r)*.11)*1.2);poolStep(p)}
 const I=B.level/2;
 for(let i=0;i<units.length;i++){const u=units[i];if(!u.bl||u.hp<=0||u.type==='tank')continue;const fr=1-u.hp/u.maxhp;if(fr<.4)continue;
  u._bd=(u._bd||0)+(u.moving?1.7:.5)*fr*I*dt;if(u._bd>=1){u._bd=0;const x=u.x+rnd(-3,3),y=u.y+rnd(2,7);
   if(depthAt(u.x,u.y)>=.25){if(Math.random()<.5)cloud(x,y,1.5,rnd(1,1.8),rnd(-3,3),rnd(-3,3),.22)}else splat(x,y,rnd(-20,20),rnd(-20,20),Math.random()<.22?2:1,2)}}
 washT-=dt;if(washT<=0){washT=1.5;const I2=window.PXW&&PXW.state?PXW.state.I:0;if(I2>.12){dctx.globalCompositeOperation='destination-out';dctx.globalAlpha=clamp(.03*I2,0,.05);dctx.fillStyle='#000';dctx.fillRect(0,0,cw,ch);dctx.globalCompositeOperation='source-over'}}
 if(parts.length>B.stats.peakP)B.stats.peakP=parts.length;if(pools.length>B.stats.peakPools)B.stats.peakPools=pools.length}

/* ---------- desenho (chamado de dentro do pixel.js; nunca propaga exceção, senão o laço de animação pararia) ---------- */
function under(c,ox,oy){if(!B.on)return;try{if(!ensure())return;
 const sx=Math.max(0,-ox),sy=Math.max(0,-oy),sw=Math.min(cw-sx,vw-ox-sx),sh=Math.min(ch-sy,vh-oy-sy);if(sw<=0||sh<=0)return;
 c.globalAlpha=1;c.drawImage(dry,sx,sy,sw,sh,ox+sx,oy+sy,sw,sh);
 for(let i=0;i<NGEN;i++){const l=gens[i],age=time-l.t0,a=clamp(1-(age-3)/FADE,0,1);if(a<=0.01)continue;c.globalAlpha=a*WETA;c.drawImage(l.c,sx,sy,sw,sh,ox+sx,oy+sy,sw,sh)}
 c.globalAlpha=1}catch(e){c.globalAlpha=1;fail(e)}}
const rc=(c,x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h)};
function over(c,ox,oy){if(!B.on)return;try{const w2x=x=>ox+Math.round(x*Z),w2y=y=>oy+Math.round(y*Z),m=30;
 for(const p of parts){const x=w2x(p.x),y=w2y(p.y)-Math.round(p.z*Z);if(x<-m||y<-m||x>vw+m||y>vh+m)continue;
  if(p.k==='d'){const sp=Math.hypot(p.vx,p.vy+p.vz*.5);c.globalAlpha=1;rc(c,x,y,p.s,p.s,WET[p.ci]);if(sp>170)rc(c,x-Math.round(p.vx/sp),y-Math.round((p.vy-p.vz*.5)/sp),1,1,WET[2]);continue}
  if(p.k==='c'){c.globalAlpha=1;rc(c,x,y,2,2,WET[3]);rc(c,x,y,1,1,WET[0]);continue}
  const k=p.t/p.max;c.globalAlpha=clamp(p.al*k,0,1);disc(c,x,y,Math.max(1,Math.round(p.r)),p.k==='w'?'#b03a44':'#a8141a')}
 c.globalAlpha=1;
 for(const u of units){if(!u.bl||u.hp<=0||u.type==='tank'||u.bl<.12)continue;if(window.PXW&&!PXW.visible(u))continue;const x=w2x(u.x),y=w2y(u.y);if(x<-m||y<-m||x>vw+m||y>vh+m)continue;if(depthAt(u.x,u.y)>=.55)continue;
  const n=Math.min(6,2+Math.round(u.bl*5)),s=u.id*97;for(let i=0;i<n;i++){const hx=hash(i,1,s),hy=hash(i,2,s);rc(c,x-2+Math.floor(hx*5),y-11+Math.floor(hy*6),1+(i%3===0?1:0),1,i&1?'#7a0f14':'#56090d')}}
 c.globalAlpha=1}catch(e){c.globalAlpha=1;fail(e)}}

/* ---------- ligações ---------- */
wrap('damage',(orig,u,n,att)=>{const live=B.on&&u&&u.hp>0&&u.type!=='tank'&&n>=1.5;orig(u,n,att);if(live&&ensure())try{wound(u,n,att)}catch(e){fail(e)}});
wrap('explode',(orig,x,y,r,power=100,team=0)=>{const prev=bctx;bctx={x,y};try{orig(x,y,r,power,team)}finally{bctx=prev}
 if(B.on&&dry&&r>=40&&!gblast)try{const cx=Math.round(x*Z),cy=Math.round(y*Z),rad=Math.max(4,Math.round(r*Z*(power?.36:.3)));eraseDisc(cx,cy,Math.round(rad*1.7),.45);eraseDisc(cx,cy,rad+1,1)}catch(e){fail(e)}});
wrap('update',(orig,dt)=>{orig(dt);if(B.on)try{step(dt)}catch(e){fail(e)}});
function reset(){parts.length=0;pools.length=0;bleeders.length=0;dry=null;gens=[];for(const u of units){u.bl=0;u._bd=0}}
wrap('setup',(orig,demo)=>{const r=orig(demo);reset();return r});

Object.assign(B,{under,over,reset,step,wound,addPool,splat,
 /* teste/demonstração: fere a unidade como se um tiro viesse do ângulo dado; dead força a morte */
 hit(u,n,ang=0,dead=false){bctx=null;const a=Math.cos(ang),b=Math.sin(ang),bl={damage:1,team:u.team?0:1,x:u.x-a*4,y:u.y-b*4,vx:a*600,vy:b*600,t:1};bullets.push(bl);damage(u,dead?u.hp+n:n,u.team?0:1);bullets.splice(bullets.indexOf(bl),1)}});
Object.defineProperties(B,{parts:{get:()=>parts},pools:{get:()=>pools},bleeders:{get:()=>bleeders},layers:{get:()=>({dry,gens,gi})}});
window.IronFront=window.IronFront||{};window.IronFront.blood=B;window.BLOOD=B;
})();
