'use strict';
/* Iron Front 0.4 — camada de pixel art.
   Carrega DEPOIS de game.js e troca a renderização antiga (canvas 2D com rotate/scale/arc, escala 1,5×
   e zoom contínuo) por um pipeline de pixels inteiros. Não altera a lógica de jogo: só envolve
   (wrap) damage / explode / shoot / update / setMode / setup para gerar efeitos visuais. */
(function(){
const {RL_N,Z,INK,TAU,clamp,mk,g2,pline,disc,ring,glyph,dir16,dir8,FRAMES,infantrySprite,cavalrySprite,tankSprite,wreckSprite,corpseSprite,shadowSprite,ringSprite,structureSprite,planeSprite,drawIcon,genTerrain,stampCrater}=PX;
/* medidas do tanque de cada nação (Renault FT / A7V), vindas de tanks.js; valores do tanque antigo como reserva */
const TK=t=>(PX.TANKS&&PX.TANKS[t])||{muzzle:24,shadow:[16,7],ring:[18,9],hpY:17};
const MW=128,MH=85,$$=id=>document.getElementById(id);
let lvl=2,cmdLvl=2,pxs=2,dpr=1,ox=0,oy=0,fdt=.016,lastFrame=performance.now(),lastWheel=0;
let flashes=[],hurt=0,blastCtx=null,blasts=[],wrecks=[],fx=[],flakes=[],sparkles=[],tctx=null,terrainP=null,craterCount=0,miniTex=null,miniDirty=true,miniAt=0;
const terrainCache={},rnd=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.floor(Math.random()*a.length)],isMobile=()=>innerWidth<=750;
const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('pixel.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};
const rect=(c,x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h)};

/* ---------- grade de pixels: canvas interno ampliado por fator inteiro; zoom = trocar o fator ---------- */
function clampCam(){if(window.PXAW?.on&&mode==='commander'){const b=PXAW.theatre();cam.x=clamp(cam.x,b.x0,b.x1);cam.y=clamp(cam.y,b.y0,b.y1);return}const hw=vw/2/Z,hh=vh/2/Z;cam.x=W<=hw*2?W/2:clamp(cam.x,hw,W-hw);cam.y=H<=hh*2?H/2:clamp(cam.y,hh,H-hh)}
function pxResize(){const f=$$('field'),cw=f.clientWidth||960,ch=f.clientHeight||540;dpr=window.devicePixelRatio||1;pxs=Math.max(1,Math.round(lvl*dpr));vw=Math.ceil(cw*dpr/pxs);vh=Math.ceil(ch*dpr/pxs);canvas.width=vw;canvas.height=vh;canvas.style.width=vw*pxs/dpr+'px';canvas.style.height=vh*pxs/dpr+'px';cam.z=Z*pxs/dpr/1.5;clampCam()}
function camOff(){ox=Math.round(vw/2-cam.x*Z);oy=Math.round(vh/2-cam.y*Z)}
function pxWorldMouse(){camOff();mouse.wx=(mouse.x-ox)/Z;mouse.wy=(mouse.y-oy)/Z}
const w2x=x=>ox+Math.round(x*Z),w2y=y=>oy+Math.round(y*Z);
function setLevel(n,anchor){n=clamp(n,1,4);if(n===lvl)return;const wx=mouse.wx,wy=mouse.wy;lvl=n;if(mode==='commander')cmdLvl=lvl;pxResize();if(anchor&&mouse.over&&mode==='commander'){mouse.x=mouse.cx*dpr/pxs;mouse.y=mouse.cy*dpr/pxs;cam.x=wx-(mouse.x-vw/2)/Z;cam.y=wy-(mouse.y-vh/2)/Z;clampCam()}pxWorldMouse()}

/* ---------- terreno ---------- */
let curBase=null;function loadTerrain(){let base=terrainCache[map];if(!base)base=terrainCache[map]=genTerrain(map,W,H);curBase=base;const c=mk(base.canvas.width,base.canvas.height);tctx=g2(c);tctx.drawImage(base.canvas,0,0);terrain=c;decor=base.decor;sparkles=base.sparkles;terrainP=base.P;craterCount=0;miniDirty=true;flakes=[]}

/* ---------- efeitos ---------- */
function puff(x,y,size,life=rnd(1.4,2.4),vy=rnd(-24,-10)){if(fx.length<700)fx.push({k:'smoke',x,y,vx:rnd(-8,8),vy,t:life,max:life,size})}
function dust(u){if(fx.length<700)fx.push({k:'dust',x:u.x-Math.cos(u.angle)*14+rnd(-5,5),y:u.y-Math.sin(u.angle)*14+rnd(-4,4)+6,vx:rnd(-6,6),vy:rnd(-8,-2),t:.55,max:.55,size:u.type==='tank'?7:5})}
function fxUpdate(dt){
hurt=Math.max(0,hurt-dt);for(const u of units){if(u.flash>0)u.flash=Math.max(0,u.flash-dt);if(u.hitT>0)u.hitT=Math.max(0,u.hitT-dt);if(u.moving&&(u.type==='tank'||u.type==='cavalry')&&Math.random()<dt*(u.type==='tank'?9:11))dust(u);if(u.type==='tank'&&u.hp<u.maxhp*.5&&Math.random()<dt*(u.hp<u.maxhp*.25?7:3))puff(u.x-Math.cos(u.angle)*10,u.y-Math.sin(u.angle)*10,rnd(7,11),rnd(1,1.8))}
for(const w of wrecks){w.t-=dt;w.smoke-=dt;if(w.smoke<=0){w.smoke=rnd(.12,.3);puff(w.x+rnd(-8,8),w.y+rnd(-6,6),rnd(8,13),rnd(1.4,2.4),rnd(-30,-16))}}wrecks=wrecks.filter(w=>w.t>0);
for(const b of blasts)b.t+=dt;blasts=blasts.filter(b=>b.t<b.dur);
for(const p of fx){if(window.PXW&&(p.k==='smoke'||p.k==='dust')){const wv=PXW.windVec();p.x+=wv.x*dt*.5;p.y+=wv.y*dt*.5}if(p.g)p.vy+=p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.t-=dt;p.vx*=.97;p.vy*=.97}fx=fx.filter(p=>p.t>0)}
function drawBlast(b){const p=b.t/b.dur,R=b.r*Z,cx=w2x(b.x),cy=w2y(b.y);
if(p<.14){const k=p/.14;disc(ctx,cx,cy,R*(.35+.3*k),'#fff8d8');ring(ctx,cx,cy,R*(.5+.6*k),R*(.5+.6*k)*.85,'#ffe9a0')}
else if(p<.5){const k=(p-.14)/.36,e=1-Math.pow(1-k,2);disc(ctx,cx,cy+1,R*(.55+.3*e),'#8c2f1f');disc(ctx,cx,cy,R*(.5+.28*e),'#d8571f');disc(ctx,cx-1,cy-1,R*(.38+.22*e)*(1-k*.35),'#f5a235');disc(ctx,cx-1,cy-2,R*(.22+.12*e)*(1-k*.7),'#ffe08a')}
if(p>.28){const k=(p-.28)/.72,a=k<.55?1:k<.75?.66:k<.9?.4:.2,sr=R*(.5+.3*k),yy=cy-k*R*.35;ctx.globalAlpha=a;disc(ctx,cx,yy,sr,'#3a3631');disc(ctx,cx-1,yy-1,sr*.78,'#57524b');disc(ctx,cx-2,yy-2,sr*.45,'#7a746a');ctx.globalAlpha=1}}
function drawFx(p){const x=w2x(p.x),y=w2y(p.y),k=p.t/p.max;if(x<-20||y<-20||x>vw+20||y>vh+20)return;
if(p.k==='smoke'){const age=1-k,r=Math.max(1,Math.round(p.size*Z*(1+age*.55))),a=age>.78?.25:age>.58?.5:age>.3?.75:1;ctx.globalAlpha=a*.92;disc(ctx,x,y,r,age<.3?'#423e39':age<.6?'#6b665e':'#9a948a');if(r>2)disc(ctx,x-1,y-1,Math.max(1,Math.round(r*.55)),age<.3?'#5e5952':age<.6?'#8a857b':'#b9b3a7');ctx.globalAlpha=1;return}
if(p.k==='hit'){const f=p.t/p.max,r=f>.5?3:2;rect(ctx,x-1,y-1,2,2,'#fffbe0');rect(ctx,x-r,y,r*2,1,'#ffd27a');rect(ctx,x,y-r,1,r*2,'#ffd27a');if(f>.5){rect(ctx,x-2,y-2,1,1,'#ffb347');rect(ctx,x+2,y+2,1,1,'#ffb347');rect(ctx,x+2,y-2,1,1,'#ffb347');rect(ctx,x-2,y+2,1,1,'#ffb347')}return}
if(p.k==='px'){ctx.globalAlpha=k>.3?1:k/.3;const s=p.size||1;rect(ctx,x,y,s,s,p.color);ctx.globalAlpha=1;return}
if(p.k==='num'){const t=p.txt;let gx=x-((t.length*4+4)>>1);ctx.globalAlpha=k>.3?1:k/.3;for(const[col,o]of[['#1b1f16',1],[p.color,0]]){rect(ctx,gx+o,y+2+o,3,1,col);let cx=gx+4;for(const ch of t){glyph(ctx,ch,cx+o,y+o,col);cx+=4}}ctx.globalAlpha=1;return}
if(p.k==='dust'){const r=Math.max(1,Math.round(p.size*Z*(1.1-k*.2)));ctx.globalAlpha=k>.6?.7:k>.3?.45:.22;disc(ctx,x,y,r,terrainP&&terrainP.snow?'#dfe8e6':'#a08d6a');ctx.globalAlpha=1;return}
ctx.globalAlpha=k>.5?1:k>.25?.7:.4;const s=Math.max(1,Math.round(p.size*Z));rect(ctx,x,y,s,s,p.color);ctx.globalAlpha=1}
/* clarão do cano em 2 estágios: pico (cone + núcleo + brilho no chão) e rescaldo (brasas) */
function flashFx(x,y,a,big,ph,seed){const L=big?22:12,j=(i)=>Math.sin(seed*12.9898+i*78.233)*.12;
if(ph<.45){ctx.globalAlpha=.2;disc(ctx,x,y,big?18:10,'#ffcf6a');ctx.globalAlpha=.12;disc(ctx,x,y,big?26:15,'#ffb347');ctx.globalAlpha=1;
const rays=[-.62,-.4,-.2,0,.2,.4,.62];for(let i=0;i<rays.length;i++){const off=rays[i]+j(i),m=Math.abs(rays[i]),l=L*(m<.1?1:m<.3?.82:m<.5?.55:.34)*(1+j(i+9)),col=m<.1?'#fff6cc':m<.3?'#ffd466':m<.5?'#ffa83a':'#ff7a24';pline(ctx,x,y,x+Math.cos(a+off)*l,y+Math.sin(a+off)*l,col);if(m<.3)pline(ctx,x+Math.cos(a+off+1.57)*.7,y+Math.sin(a+off+1.57)*.7,x+Math.cos(a+off)*l*.8,y+Math.sin(a+off)*l*.8,col)}
for(const off of[Math.PI/2,-Math.PI/2,Math.PI/2+.5,-Math.PI/2-.5])pline(ctx,x,y,x+Math.cos(a+off)*(big?9:4),y+Math.sin(a+off)*(big?9:4),'#ff9b32');
const r=big?3:2;rect(ctx,x-r,y-r,r*2+1,r*2+1,'#ffd466');rect(ctx,x-r+1,y-r+1,r*2-1,r*2-1,'#fffbe0');if(big)rect(ctx,x-1,y-1,3,3,'#ffffff')}
else{const l=big?13:6;for(const off of[-.4,-.15,.15,.4])pline(ctx,x,y,x+Math.cos(a+off)*l*.7,y+Math.sin(a+off)*l*.7,'#ff6a24');pline(ctx,x,y,x+Math.cos(a)*l,y+Math.sin(a)*l,'#ffb347');rect(ctx,x-1,y-1,big?3:2,big?3:2,'#ffd27a')}}
/* feedback de acerto */
const flashCache=new WeakMap();
function tinted(sp,col){let m=flashCache.get(sp.c);if(!m){m={};flashCache.set(sp.c,m)}return m[col]||(m[col]=PX.silhouette(sp.c,col))}
function hitDir(u,att){if(blastCtx){const dx=u.x-blastCtx.x,dy=u.y-blastCtx.y,l=Math.hypot(dx,dy)||1;return{x:dx/l,y:dy/l,blast:true}}
let best=null,bd=2000;for(const b of bullets){if(!b.damage||b.team!==att)continue;const d=(b.x-u.x)**2+(b.y-u.y)**2;if(d<bd){bd=d;best=b}}
if(best){const l=Math.hypot(best.vx,best.vy)||1;return{x:best.vx/l,y:best.vy/l}}return null}
function hitFx(u,n,dir,dead){const tk=u.type==='tank',dx=dir?dir.x:rnd(-1,1),dy=dir?dir.y:rnd(-1,1),px_=-dy,py_=dx;
if(tk){if(n<4)return;u.hitT=.08;for(let i=0;i<5&&fx.length<700;i++){const s=rnd(50,120),q=rnd(-70,70);fx.push({k:'px',x:u.x+rnd(-8,8),y:u.y+rnd(-6,6),vx:-dx*s+px_*q,vy:-dy*s+py_*q,t:rnd(.18,.4),max:.4,color:pick(['#fff3c2','#ffd27a','#ffb347']),size:1})}puff(u.x,u.y,rnd(4,6),.6,-8);return}
u.hitT=.16;u.hx=dx;u.hy=dy;const strong=dir&&dir.blast;
if(fx.length<690){fx.push({k:'dust',x:u.x,y:u.y-2,vx:dx*24,vy:dy*24-6,t:.45,max:.45,size:5});
if(n>=3){const drops=['#b3342c','#d9513f','#8a231f','#e86a52'],cnt=dead?16:Math.min(9,3+Math.round(n/9));for(let i=0;i<cnt;i++){const s=rnd(70,strong?220:170),q=rnd(-70,70);fx.push({k:'px',x:u.x+rnd(-2,2),y:u.y-3+rnd(-2,2),vx:dx*s+px_*q,vy:dy*s+py_*q-rnd(0,30),t:rnd(.4,.85),max:.85,color:pick(drops),size:i%3===0?2:1})}}
fx.push({k:'hit',x:u.x-dx*4,y:u.y-3,vx:0,vy:0,t:.09,max:.09})
if(dead)puff(u.x,u.y,rnd(6,9),rnd(.8,1.3),-10)}
if(dead&&tctx){tctx.fillStyle='rgba(84,26,22,.5)';const bx=Math.round(u.x*Z),by=Math.round(u.y*Z);for(let i=0;i<9;i++)tctx.fillRect(bx+Math.round(dx*(2+i*.7)+rnd(-3,3)),by+Math.round(dy*(2+i*.7)+rnd(-2,2)),1+(i%4===0),1)}
if(u===player&&!dead){hurt=.4;screenShake=Math.max(screenShake,3);fx.push({k:'num',x:u.x,y:u.y-22,vx:0,vy:-34,t:.9,max:.9,txt:String(Math.round(n)),color:'#ff6b5a'})}}
function muzzleWorld(u){const a=u.angle,L=u.type==='tank'?TK(u.team).muzzle*2:26;return{x:u.x+Math.cos(a)*L,y:u.y+Math.sin(a)*L+(u.type==='tank'?0:2)}}

/* ---------- renderização ---------- */
const blit=(sp,x,y)=>ctx.drawImage(sp.c,x-sp.ax,y-sp.ay);
/* recarga: fase atual (0..RL_N-1) de quem recarrega; o jogador usa o tempo global, a IA o tempo do próprio soldado */
function reloadOf(u){if(u.type==='tank'||u.type==='cavalry'||u.type==='mg')return null;let kind,p;if(u===player&&mode==='soldier'){if(!reload)return null;kind=weapon;p=1-reload/weapons[weapon].reload}else if(u.rl>0){kind='rifle';p=1-u.rl/weapons.rifle.reload}else return null;const n=RL_N[kind];return{kind,ph:clamp(Math.floor(p*n),0,n-1)}}
/* a cada fase nova: cápsula ejetada, lâmina/pente que cai e o clique correspondente (som só do jogador) */
function reloadFx(){for(const u of units){const r=reloadOf(u);if(!r){if(u._rph!=null)u._rph=null;continue}if(u._rph===r.ph)continue;u._rph=r.ph;if(fx.length>660)continue;
const a=u.angle||0,ca=Math.cos(a),sa=Math.sin(a),x=u.x+ca*3,y=u.y+sa*3,me=u===player&&mode==='soldier',toss=(vx,vy,col,size,t)=>fx.push({k:'px',x,y:y-1,vx,vy,t,max:t,color:col,size,g:260}),snd=k=>{if(me)sound(k)};
if(r.kind==='rifle'){if(r.ph===1){toss(-sa*55+rnd(-8,8),ca*55-75,'#e0b84a',1,.6);snd('bolt')}else if(r.ph===2)snd('click');else if(r.ph===4){toss(-sa*45+rnd(-10,10),ca*45-85,'#b8ad6a',2,.75);snd('click')}else if(r.ph===5)snd('bolt')}
else{if(r.ph===1){toss(rnd(-14,14),-20,r.kind==='smg'?'#4a5045':'#6f756b',2,.7);snd('mag')}else if(r.ph===3)snd('mag');else if(r.ph===4)snd('bolt')}}}
function unitSprite(u){const d=dir16(u.angle||0);if(u.type==='tank')return tankSprite(u.team,d,u.moving?Math.floor(time*10+u.id)%3:0);if(u.type==='cavalry')return cavalrySprite(u.team,d,u.moving?Math.floor(time*(u.chargeActive?14:9)+u.id)%2:0,!!u.chargeActive);return infantrySprite(u.team,u.type,d,u.moving?FRAMES[Math.floor(time*8+u.id)%4]:0,u===player&&mode==='soldier'?weapon:'rifle',(reloadOf(u)||{}).ph,u.thr>0?Math.min(2,Math.floor((1-u.thr/.55)*3)):null,u.gren>0)}
/* bandeira do país dono do ponto: EUA = 13 listras + cantão azul com estrelas; Império Alemão = preto-branco-vermelho; neutro = pano liso.
   O pano ondula por colunas (mais com vento) e ganha luz/sombra nas dobras. */
const FLAG_W=15,FLAG_H=9,shadeMemo=new Map(),shade=(col,k)=>{const key=col+k;let v=shadeMemo.get(key);if(!v){v=PX.mix(col,k>0?'#ffffff':'#000000',Math.abs(k));shadeMemo.set(key,v)}return v};
function flagColor(owner,c,r){if(owner===0){if(c<6&&r<5)return(r===1&&c%2===1)||(r===3&&c%2===0&&c>0&&c<5)?'#f4f4f0':'#2b3f86';return r%2===0?'#b22234':'#f4f4f0'}
if(owner===1)return r<3?'#1d1d1d':r<6?'#eeeee6':'#c4271c';return r<4?'#b7baa0':'#a1a48a'}
function drawFlag(p){const x=w2x(p.x),y=w2y(p.y),ws=window.PXW?PXW.windVec().s:.3,own=p.owner===0||p.owner===1?p.owner:-1;
rect(ctx,x-3,y+2,7,2,'#22261d');rect(ctx,x-2,y+1,5,2,'#7b7d6e');rect(ctx,x-1,y-20,2,22,'#d9d5b7');rect(ctx,x-1,y-20,1,22,'#f1eed2');rect(ctx,x-2,y-22,4,2,'#cdbf7a');
for(let c=0;c<FLAG_W;c++){const ph=Math.sin(time*(3+ws*5)+c*.75),wv=Math.round(ph*(c>2?1:0)*(c/9+.3)*(.5+ws*1.3)),top=y-19+wv,k=c<1?-.55:ph>.55&&c>2?.14:ph<-.55&&c>2?-.2:0;
for(let r=0;r<FLAG_H;r++){const col=flagColor(own,c,r);rect(ctx,x+1+c,top+r,1,1,k?shade(col,k):col)}rect(ctx,x+1+c,top+FLAG_H,1,1,shade(flagColor(own,c,FLAG_H-1),-.35))}
const wv=Math.round(Math.sin(time*(3+ws*5)+1)*.6*(.5+ws));glyph(ctx,p.name,x-1,y-28+wv,'#16190f');glyph(ctx,p.name,x-2,y-29+wv,'#f7f5dc')}
/* granada de mão em voo: sobe em arco, gira (a alemã é de cabo), pousa e fica com o pavio em brasa até explodir */
function drawGrenade(s,gx,gy){let x,y,x0,y0,landed;if(s.gx!==undefined){x0=w2x(s.gx);y0=w2y(s.gy);const zH=Math.max(0,Math.round((s.gz||0)*Z));x=x0;y=y0-zH;landed=(s.gz||0)<=0.5&&Math.hypot(s.gvx||0,s.gvy||0)<6}else{const el=s.dur-s.t,k=clamp(el/s.fl,0,1);landed=el>=s.fl;const ox=w2x(s.ox),oy=w2y(s.oy);x0=Math.round(ox+(gx-ox)*k);y0=Math.round(oy+(gy-oy)*k);const h=landed?0:Math.round(Math.sin(k*Math.PI)*13+(1-k)*6);x=x0;y=y0-h}
ctx.globalAlpha=.4;rect(ctx,x0-1,y0,3,1,'#0f140a');ctx.globalAlpha=1;
if(s.team===0){rect(ctx,x-1,y-2,3,3,'#4e5632');rect(ctx,x-1,y-2,1,2,'#8b9a5c');rect(ctx,x,y+1,2,1,'#3b4225');rect(ctx,x,y-3,1,1,'#c8c8b4')}
else{const v=landed?0:((time*14+s.seed)|0)%2;if(v){rect(ctx,x-3,y-1,2,2,'#767b80');rect(ctx,x-3,y-1,1,1,'#9aa0a5');rect(ctx,x-1,y,3,1,'#d3bf95')}else{rect(ctx,x-1,y-3,2,2,'#767b80');rect(ctx,x-1,y-3,1,1,'#9aa0a5');rect(ctx,x,y-1,1,3,'#d3bf95')}}
if(landed&&((time*16+s.seed)|0)%2===0){rect(ctx,x,y-(s.team===0?4:2),1,1,'#ffe08a');rect(ctx,x+1,y-(s.team===0?5:3),1,1,'#fff6cc')}}
function dashedRect(x0,y0,x1,y1,col,phase){pline(ctx,x0,y0,x1,y0,col,4,phase);pline(ctx,x1,y0,x1,y1,col,4,phase);pline(ctx,x1,y1,x0,y1,col,4,phase);pline(ctx,x0,y1,x0,y0,col,4,phase)}
function pxRender(){
const now=performance.now();fdt=Math.min(.05,(now-lastFrame)/1000);lastFrame=now;
flashes.length=0;ctx.imageSmoothingEnabled=false;camOff();if(screenShake){ox+=Math.round(rnd(-screenShake,screenShake)/1.5);oy+=Math.round(rnd(-screenShake,screenShake)/1.5)}
ctx.fillStyle=terrainP?terrainP.g[0]:'#343d2a';ctx.fillRect(0,0,vw,vh);if(terrain)ctx.drawImage(terrain,ox,oy);
if(sparkles.length&&terrainP){for(const s of sparkles){const f=(time*1.4+s.ph)%2;if(f>.22)continue;const x=ox+s.x,y=oy+s.y;if(x<0||y<0||x>=vw||y>=vh)continue;rect(ctx,x,y,1,1,terrainP.spark)}}
if(window.BLOOD)BLOOD.under(ctx,ox,oy);
if(window.PXW)PXW.under(ox,oy,fdt);
if(window.WW1A)WW1A.under(ctx,ox,oy,fdt);
const m=48,seen=(x,y)=>x>-m&&y>-m&&x<vw+m&&y<vh+m;
for(const c of corpses){let x=w2x(c.x),y=w2y(c.y);if(c.born!=null){const pr=clamp((time-c.born)/.3,0,1),e=1-(1-pr)*(1-pr);x+=Math.round(c.sx*e);y+=Math.round(c.sy*e)}if(!seen(x,y))continue;const cs=corpseSprite(c.team,dir8(c.angle||0),((c.id||0)*5+c.team*3)&3);
if(c.fl){/* boiando: balança, água por cima, afunda e some no fim */const sk=1-clamp(c.t/12,0,1),bob=c.fl>1?Math.round(Math.sin(time*2.2+c.id)):0,dp=c.fl>1,k=(time*.7+c.id*.37)%1;
ctx.globalAlpha=.55*(1-sk);ring(ctx,x,y+2,10+k*5,3+k*2,'#dcebea');ctx.globalAlpha=(1-sk)*.95;ctx.drawImage(cs.c,x-cs.ax,y-cs.ay+bob+Math.round(sk*2));
const tn=tinted(cs,dp?'#46584f':'#62705a');ctx.globalAlpha=(dp?.5:.36)+sk*.4;ctx.drawImage(tn,x-cs.ax,y-cs.ay+bob+Math.round(sk*2));ctx.globalAlpha=(1-sk)*.8;ring(ctx,x,y+bob+3,7,2,'#b9ccc6')}
else{ctx.globalAlpha=clamp(c.t/30,0,1);blit(cs,x,y)}ctx.globalAlpha=1}
for(const w of wrecks){const x=w2x(w.x),y=w2y(w.y);if(!seen(x,y))continue;blit(wreckSprite(w.team,w.d),x,y);if(((time*8+w.x)|0)%3!==0)rect(ctx,x-3+(((time*5)|0)%4),y-2,2,2,'#ff9a2e');rect(ctx,x+1,y-1,2,1,'#ffd36a')}
for(const b of buildings){const x=w2x(b.x),y=w2y(b.y);if(!seen(x,y))continue;blit(structureSprite(b.type,b.team,b.hp/b.maxhp),x,y)}
for(const p of points){const x=w2x(p.x),y=w2y(p.y);if(!seen(x,y))continue;const col=p.owner===0?'#8ebaca':p.owner===1?'#cf8e79':'#c2c7a5';ctx.globalAlpha=.1;disc(ctx,x,y,45,col);ctx.globalAlpha=1;ring(ctx,x,y,45,45,col,4,Math.floor(time*6));ring(ctx,x,y,44,44,col,4,Math.floor(time*6)+4)}
const sorted=units.slice().sort((a,b)=>a.y-b.y);
for(const u of sorted){if(window.PXW&&!PXW.visible(u))continue;const x=w2x(u.x),y=w2y(u.y);if(!seen(x,y))continue;const tk=u.type==='tank',cv=u.type==='cavalry',sp=unitSprite(u),sel=selected.has(u.id)||u===player&&mode==='soldier';
const wd=window.PXW?PXW.depth(u.x,u.y):0,wet=wd>=.25&&!tk,deepW=wd>=.55;
if(tk){if(wd>=.25)PXW.wake(ctx,x,y,deepW);blit(shadowSprite(TK(u.team).shadow[0],TK(u.team).shadow[1],.3),x+1,y+5)}else if(!wet){if(cv)blit(shadowSprite(10,4),x,y+6);else blit(shadowSprite(5,2),x,y+6)}
if(sel)blit(ringSprite(tk?TK(u.team).ring[0]:cv?12:7,tk?TK(u.team).ring[1]:cv?5:3,u===player?'#dcec9c':'#8dc8d4'),x,y+(tk?5:6));
let sx=x,sy=y;if(u.hitT>0){const k=u.hitT/.16;sx+=Math.round((u.hx||0)*1.6*k);sy+=Math.round((u.hy||0)*1.6*k)}
if(u.flash>0&&!cv){const rk=tk?Math.round(2.4*u.flash/.13):(u.flash>.035?1:0);sx-=Math.round(Math.cos(u.angle)*rk);sy-=Math.round(Math.sin(u.angle)*rk)}
let vis=sp.c.height,bob=0;if(wet){const cut=cv?(deepW?9:5):(deepW?6:3);vis=sp.ay+(cv?9:7)-cut+1;bob=deepW?Math.round(Math.sin(time*5+u.id)):0}
if(!(window.PHYS&&PHYS.draw&&PHYS.draw(ctx,u,sp,sx,sy,vis,bob)))ctx.drawImage(sp.c,0,0,sp.c.width,vis,sx-sp.ax,sy-sp.ay+bob,sp.c.width,vis);
if(u.hitT>0&&!tk){ctx.globalAlpha=u.hitT>.1?.92:.4;const tn=tinted(sp,u.hitT>.1?'#ffffff':'#ff4a3a');ctx.drawImage(tn,0,0,tn.width,vis,sx-sp.ax,sy-sp.ay+bob,tn.width,vis);ctx.globalAlpha=1}
if(wet)PXW.waterline(ctx,sx,sy-sp.ay+vis+bob,cv?10:6,deepW,u.id)
if(u.flash>0&&!cv){const L=tk?TK(u.team).muzzle:14,ph=1-u.flash/(tk?.13:.07);flashes.push([Math.round(sx+Math.cos(u.angle)*L),Math.round(sy+Math.sin(u.angle)*L+(tk?0:1)),u.angle,tk,ph,u.id*7+Math.floor(time*50)])}
if(sel){const by=y-(tk?TK(u.team).hpY:cv?20:18),f=clamp(u.hp/u.maxhp,0,1),n=Math.max(1,Math.round(12*f));rect(ctx,x-7,by,14,4,INK);rect(ctx,x-6,by+1,12,2,'#3b4431');rect(ctx,x-6,by+1,n,2,f>.5?'#b8d68b':f>.25?'#e3c463':'#e0705a');rect(ctx,x-6,by+1,n,1,f>.5?'#d8ecb0':f>.25?'#f3de8a':'#f09a86')}
if(u===player&&mode==='soldier'){const ay=y-(tk?TK(u.team).hpY+7:25)+Math.round(Math.sin(time*6));rect(ctx,x-3,ay,7,1,INK);rect(ctx,x-2,ay,5,1,'#dcec9c');rect(ctx,x-2,ay+1,5,1,'#dcec9c');rect(ctx,x-1,ay+2,3,1,'#dcec9c');rect(ctx,x,ay+3,1,1,'#dcec9c')}
if(selected.has(u.id)&&u.order==='move')pline(ctx,x,y,w2x(u.tx),w2y(u.ty),'rgba(169,201,145,.6)',2,Math.floor(time*6))}
for(const p of points){const x=w2x(p.x),y=w2y(p.y);if(!seen(x,y))continue;drawFlag(p);rect(ctx,x-14,y+9,29,5,INK);rect(ctx,x-13,y+10,27,3,'#3a3f32');const len=Math.round(Math.abs(p.progress)/100*27);if(len)rect(ctx,p.progress<0?x-13:x+14-len,y+10,len,3,p.progress<0?'#7eb1bf':'#cb8c78');rect(ctx,x,y+9,1,5,'#d9d5b7')}
for(const b of bullets){const x=w2x(b.x),y=w2y(b.y);if(!seen(x,y))continue;const sp=Math.hypot(b.vx,b.vy)||1,nx=b.vx/sp,ny=b.vy/sp;if(b.ricochet){pline(ctx,x-nx*5,y-ny*5,x,y,'#fff4b8');rect(ctx,x,y,1,1,'#ffffff')}else if(b.damage){const L=b.friendlyFire?6:5,c1=b.team?'#ffc58f':'#ffeeb0',c2=b.team?'#d98a52':'#dcae56',c3=b.team?'#8c4f30':'#8a6a34';pline(ctx,x-nx*L*.35,y-ny*L*.35,x,y,c1);pline(ctx,x-nx*L*.7,y-ny*L*.7,x-nx*L*.35,y-ny*L*.35,c2);pline(ctx,x-nx*L,y-ny*L,x-nx*L*.7,y-ny*L*.7,c3);rect(ctx,x,y,1,1,'#ffffff')}else{pline(ctx,x-nx*5,y-ny*5,x,y,'#ffb347');rect(ctx,x-1,y-1,2,2,'#fff3c2')}}
for(const b of blasts)if(seen(w2x(b.x),w2y(b.y)))drawBlast(b);
for(const p of fx)drawFx(p);for(const f of flashes)flashFx(...f);
for(const p of particles){const x=w2x(p.x),y=w2y(p.y),k=p.t/p.max;if(!seen(x,y))continue;ctx.globalAlpha=k>.5?1:k>.25?.7:.4;const s=Math.max(1,Math.round(p.size*Z));rect(ctx,x,y,s,s,p.color);ctx.globalAlpha=1}
if(window.BLOOD)BLOOD.over(ctx,ox,oy);
if(window.PLN)PLN.under(ctx,ox,oy,fdt);
for(const p of planes){const x=w2x(p.x),y=w2y(p.y),sp=planeSprite(p.kind,p.team,((time*18)|0)%2===0);if(x<-90||x>vw+90||y<-90||y>vh+90)continue;ctx.drawImage(sp.sh,x-sp.ax+14,y-sp.ay+22);blit(sp,x,y)}
if(window.PLN)PLN.draw(ctx,ox,oy,fdt);
for(const p of planes)if(p.kind==='fighter'){ctx.globalAlpha=.75;dashedRect(w2x(p.tx-250),w2y(p.y-55),w2x(p.tx+250),w2y(p.y+55),p.team?'#e29a87':'#aed6d4',Math.floor(time*8));ctx.globalAlpha=1}
for(const s of shells){const x=w2x(s.x),y=w2y(s.y);if(s.gren){if(seen(x,y)||seen(w2x(s.ox),w2y(s.oy)))drawGrenade(s,x,y);continue}if(!seen(x,y))continue;const col=s.team!==playerTeamSafe()?'#ff8f7a':'#f0c27b',r=Math.round(s.r*Z*(.8+Math.sin(time*6)*.05));ctx.globalAlpha=.09;disc(ctx,x,y,r,col);ctx.globalAlpha=1;ring(ctx,x,y,r,r,col,3,Math.floor(time*12));rect(ctx,x-4,y,9,1,col);rect(ctx,x,y-4,1,9,col)}
if(placement&&mode==='commander'&&mouse.over){const x=Math.round(mouse.x),y=Math.round(mouse.y),tm=playerTeamSafe();ctx.globalAlpha=.72;if(defs[placement].count){const sp=placement==='tank'?tankSprite(tm,tm?8:0,0):placement==='cavalry'?cavalrySprite(tm,tm?8:0,0,false):infantrySprite(tm,placement,tm?8:0,0,'rifle');blit(sp,x,y)}else if(defs[placement].hp)blit(structureSprite(placement,tm,1),x,y);else{const col='#d5dfab';if(placement==='fighter')dashedRect(x-125,y-28,x+125,y+27,col,Math.floor(time*8));else{const r=placement==='bomber'?90:48;ctx.globalAlpha=.08;disc(ctx,x,y,r,col);ctx.globalAlpha=.85;ring(ctx,x,y,r,r,col,4,Math.floor(time*8))}}ctx.globalAlpha=1}
if(window.WW1A)WW1A.over(ctx,ox,oy,fdt);
if(window.PXW)PXW.over(ox,oy,fdt);
if(terrainP&&terrainP.snow){while(flakes.length<90)flakes.push({x:Math.random()*vw,y:Math.random()*vh,vx:rnd(-10,-3),vy:rnd(14,30),big:Math.random()<.25});for(const f of flakes){if(running){f.x+=f.vx*fdt;f.y+=f.vy*fdt}if(f.y>vh){f.y=-2;f.x=Math.random()*vw}if(f.x<-2)f.x=vw;rect(ctx,Math.floor(f.x),Math.floor(f.y),f.big?2:1,f.big?2:1,f.big?'#ffffff':'#e8f0f0')}}
if(drag){const x0=Math.round(Math.min(drag.x,mouse.x)),y0=Math.round(Math.min(drag.y,mouse.y)),x1=Math.round(Math.max(drag.x,mouse.x)),y1=Math.round(Math.max(drag.y,mouse.y));ctx.globalAlpha=.16;rect(ctx,x0,y0,x1-x0,y1-y0,'#c5db91');ctx.globalAlpha=1;rect(ctx,x0,y0,x1-x0+1,1,'#c5db91');rect(ctx,x0,y1,x1-x0+1,1,'#c5db91');rect(ctx,x0,y0,1,y1-y0+1,'#c5db91');rect(ctx,x1,y0,1,y1-y0+1,'#c5db91')}
if(mode==='soldier'&&mouse.over){const x=Math.round(mouse.x),y=Math.round(mouse.y);for(const[col,o]of[[INK,1],['#eff4cf',0]]){rect(ctx,x-5+o,y+o,3,1,col);rect(ctx,x+3+o,y+o,3,1,col);rect(ctx,x+o,y-5+o,1,3,col);rect(ctx,x+o,y+3+o,1,3,col)}rect(ctx,x,y,1,1,'#ff8c6a')}
if(hurt>0){const a=Math.min(1,hurt/.4)*.5;for(const[t,k]of[[5,1],[9,.5],[13,.25]]){ctx.globalAlpha=a*k;rect(ctx,0,0,vw,t,'#b3261e');rect(ctx,0,vh-t,vw,t,'#b3261e');rect(ctx,0,t,t,vh-2*t,'#b3261e');rect(ctx,vw-t,t,t,vh-2*t,'#b3261e')}ctx.globalAlpha=1}
pxWorldMouse()}
/* o lado do jogador pode mudar (troca de facção); sem a variável, assume Aliados */
function playerTeamSafe(){try{return typeof playerTeam==='number'?playerTeam:0}catch{return 0}}
function pxMinimap(){const now=performance.now();if(terrain&&(!miniTex||miniDirty&&now-miniAt>1500)){if(!miniTex)miniTex=mk(MW,MH);const mc=g2(miniTex);mc.imageSmoothingEnabled=true;mc.imageSmoothingQuality='high';mc.drawImage(terrain,0,0,MW,MH);miniDirty=false;miniAt=now}
const sx=MW/W,sy=MH/H;mini.imageSmoothingEnabled=false;mini.fillStyle=terrainP?terrainP.g[0]:'#343d2a';mini.fillRect(0,0,MW,MH);if(miniTex)mini.drawImage(miniTex,0,0);
for(const u of units){if(window.PXW&&!PXW.visible(u))continue;mini.fillStyle=u.team?'#e08a72':'#8fd0e0';const s=u.type==='tank'?2:1;mini.fillRect(Math.round(u.x*sx),Math.round(u.y*sy),s,s)}
for(const p of points){const x=Math.round(p.x*sx),y=Math.round(p.y*sy);mini.fillStyle=INK;mini.fillRect(x-3,y-3,7,7);mini.fillStyle=p.owner===0?'#98d8e2':p.owner===1?'#eca18b':'#e5e9c8';mini.fillRect(x-2,y-2,5,5)}
const vx=Math.round((cam.x-vw/2/Z)*sx),vy=Math.round((cam.y-vh/2/Z)*sy),vwm=Math.round(vw/Z*sx),vhm=Math.round(vh/Z*sy);mini.fillStyle='#e4eac0';mini.fillRect(vx,vy,vwm,1);mini.fillRect(vx,vy+vhm,vwm+1,1);mini.fillRect(vx,vy,1,vhm);mini.fillRect(vx+vwm,vy,1,vhm)}

/* ---------- ligações com o jogo ---------- */
const origResize=window.resize;window.removeEventListener('resize',origResize);window.resize=pxResize;window.worldMouse=pxWorldMouse;window.generateTerrain=loadTerrain;window.render=pxRender;window.minimap=pxMinimap;
window.icon=(type,c)=>{const cv=c.canvas;if(cv.width!==56){cv.width=56;cv.height=56}drawIcon(type,cv.getContext('2d'),playerTeamSafe())};
wrap('setMode',(orig,next,notify)=>{const prev=mode;orig(next,notify);if(mode==='soldier'&&prev!=='soldier'){cmdLvl=lvl;lvl=isMobile()?2:3}else if(mode==='commander'){lvl=cmdLvl}canvas.style.cursor=mode==='soldier'?'none':'crosshair';pxResize();pxWorldMouse()});
wrap('setup',(orig,demo)=>{cmdLvl=isMobile()?1:2;lvl=cmdLvl;blasts=[];wrecks=[];fx=[];const r=orig(demo);blasts=[];wrecks=[];fx=[];pxResize();return r});
wrap('update',(orig,dt)=>{const dying=bullets.filter(b=>b.damage&&b.t-dt<=0);orig(dt);for(const b of dying){if(b.t<-.5||fx.length>650||Math.random()<.45)continue;fx.push({k:'dust',x:b.x,y:b.y,vx:rnd(-14,14),vy:rnd(-16,-4),t:.35,max:.35,size:4});for(let i=0;i<2;i++)fx.push({k:'px',x:b.x,y:b.y,vx:rnd(-50,50),vy:rnd(-55,-15),t:.3,max:.3,color:pick(['#8a7656','#5b4a36','#b9a47a']),size:1})}fxUpdate(dt);reloadFx();for(const s of shells)if(s.gren&&!s.ld&&s.dur-s.t>=s.fl){s.ld=1;puff(s.x,s.y+2,rnd(3,5),rnd(.5,.8),rnd(-12,-4))}clampCam()});
wrap('damage',(orig,u,n,att)=>{const alive=u.hp>0;orig(u,n,att);if(!alive||n<=0)return;const dead=u.hp<=0,dir=hitDir(u,att);
if(dead&&u.type==='tank'){wrecks.push({x:u.x,y:u.y,team:u.team,d:dir16(u.angle||0),t:60,smoke:0});if(wrecks.length>30)wrecks.shift()}
hitFx(u,n,dir,dead);
if(dead&&u.type!=='tank'){const c=corpses[corpses.length-1];if(c&&Math.abs(c.x-u.x)<1&&Math.abs(c.y-u.y)<1){c.born=time;c.id=u.id;c.t=120;const wd=window.PXW?PXW.depth(u.x,u.y):0;if(wd>=.25){const a=rnd(0,TAU),v=rnd(1.5,4);c.fl=wd>=.55?2:1;c.t=55;c.dx=Math.cos(a)*v;c.dy=Math.sin(a)*v*.6}const d=dir||{x:rnd(-1,1),y:rnd(-1,1)},amp=dir&&dir.blast?5:3;c.sx=d.x*amp;c.sy=d.y*amp;if(dir)c.angle=Math.atan2(d.y,d.x)+rnd(-.5,.5)}}});
wrap('shoot',(orig,u,target,manual)=>{const n0=particles.length;orig(u,target,manual);if(particles.length>n0)particles.length=n0;if(u.type==='cavalry')return;const tk=u.type==='tank',a=u.angle,m=muzzleWorld(u),ca=Math.cos(a),sa=Math.sin(a);u.flash=tk?.13:.07;
if(tk){for(let k=0;k<3;k++)puff(m.x+ca*10,m.y+sa*10,rnd(5,8),rnd(.7,1.2),rnd(-12,-3));for(let k=0;k<4;k++)fx.push({k:'dust',x:u.x+ca*20+rnd(-16,16)-sa*8*(k-1.5),y:u.y+sa*20+rnd(-10,10)+8+ca*8*(k-1.5),vx:ca*rnd(6,30)+rnd(-20,20),vy:sa*rnd(6,30)+rnd(-14,14),t:.55,max:.55,size:rnd(5,8)});if(u===player)screenShake=Math.max(screenShake,2.8)}
else{const kind=u.type==='mg'?'mg':(manual&&u===player?weapon:'rifle');if(fx.length<690){if(kind!=='mg'||Math.random()<.4)fx.push({k:'smoke',x:m.x,y:m.y,vx:ca*26+rnd(-6,6),vy:sa*26-8+rnd(-6,6),t:.75,max:.75,size:rnd(4,6)});
const s=rnd(40,75);fx.push({k:'px',x:u.x+ca*4,y:u.y+sa*4-2,vx:-sa*s+rnd(-12,12),vy:ca*s-14+rnd(-12,12),t:.65,max:.65,color:pick(['#e0b84a','#c79a32','#f0cf6a']),size:1})}
if(u===player&&(weapon==='rifle'||weapon==='pistol'))screenShake=Math.max(screenShake,1.7)}});
wrap('explode',(orig,x,y,r,power=100,team=0)=>{const n0=particles.length,prevB=blastCtx;blastCtx={x,y};orig(x,y,r,power,team);blastCtx=prevB;if(particles.length>n0)particles.length=n0;
if(window.PHYS&&PHYS.skipBlastFx&&PHYS.skipBlastFx(x,y))return;blasts.push({x,y,r,t:0,dur:.5+r/300});const dirt=['#2f281e','#5b4a36','#7d6a4d','#b9a47a'];for(let i=0;i<26&&particles.length<800;i++)particles.push({x,y,vx:rnd(-130,130),vy:rnd(-130,130),t:rnd(.35,1.5),max:1.5,color:i%4===0?'#ffd98a':pick(dirt),size:rnd(2,5)});
for(let i=0;i<2+Math.round(r/30);i++)puff(x+rnd(-r*.35,r*.35),y+rnd(-r*.35,r*.35),rnd(r*.13,r*.22),rnd(1.4,2.4),rnd(-26,-9));
if(r>=40&&!gblast&&craterCount<200&&terrainP&&tctx){craterCount++;stampCrater(tctx,Math.round(x*Z),Math.round(y*Z),Math.max(4,r*Z*(power?.36:.3)),terrainP,{seed:craterCount*3+1,scorch:1.1});miniDirty=true}});
/* rastreia a posição do cursor em px CSS (para o zoom ancorado) */
const trackPointer=e=>{const r=canvas.getBoundingClientRect();mouse.cx=e.clientX-r.left;mouse.cy=e.clientY-r.top};
canvas.addEventListener('pointermove',trackPointer);canvas.addEventListener('pointerdown',trackPointer);
/* a roda do mouse troca o fator inteiro de pixels (capturada antes do handler antigo, que escalava de forma contínua) */
$$('field').addEventListener('wheel',e=>{if(e.target!==canvas)return;e.preventDefault();e.stopPropagation();const now=performance.now();if(now-lastWheel<130)return;lastWheel=now;setLevel(lvl+(e.deltaY>0?-1:1),true)},{capture:true,passive:false});
window.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]'))return;if(e.key==='='||e.key==='+')setLevel(lvl+1,true);if(e.key==='-'||e.key==='_')setLevel(lvl-1,true)});
const tf=$$('touchfire');if(tf)tf.onpointerdown=e=>{e.preventDefault();if(player){const enemy=nearest(player,500);if(enemy){mouse.wx=enemy.x;mouse.wy=enemy.y;camOff();mouse.x=w2x(enemy.x);mouse.y=w2y(enemy.y)}}mouse.down=true;e.target.setPointerCapture(e.pointerId)};
$$('minimap').width=MW;$$('minimap').height=MH;
window.addEventListener('resize',()=>{pxResize();pxWorldMouse()});
window.PXGAME={get tctx(){return tctx},get base(){return curBase},get zoom(){return lvl},setLevel,get pxs(){return pxs}};
/* o estado inicial do jogo foi montado com a arte antiga: refaz com o novo terreno */
cmdLvl=isMobile()?1:2;lvl=cmdLvl;pxResize();setup(true);
})();
