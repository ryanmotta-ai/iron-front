'use strict';
/* Iron Front 0.4 — clima: chuva, alagamento e complicações de logística.
   Carrega depois de pixel.js. Não altera a lógica do jogo: envolve update / protectedBy / explode / setup
   e desenha por meio dos ganchos (PXW) que o pixel.js chama. */
(function(){
const {Z,INK,clamp,mk,g2,disc,ring,pline,hex2rgb,riverX,riverHW,ROADS}=PX;
const $$=id=>document.getElementById(id),rnd=(a,b)=>a+Math.random()*(b-a);
const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('weather.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};
const CS=16,RAIN=.0016,EVAP=.0022,KFLOW=.12;
let GW=0,GH=0,low,water,baseW,dry,drawn,dirty,CWn=0,CHn=0,waterCv=null,wctx=null,pal=null,info=null,chunkCursor=0,simAcc=0;
const wx={mode:'dynamic',phase:'clear',I:0,startAt:1e9,rainEnd:0,peak:.8,dur:100,flash:0,nextFlash:0,flood:0,pen:[0,0],snow:false,amb:null,noted:{}};
let drops=[],splashes=[],ripples=[],spray=[];

function h2(x,y,s){let h=Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(s|0,1442695041)|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296}
function vn(x,y,s){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),a=h2(xi,yi,s),b=h2(xi+1,yi,s),c=h2(xi,yi+1,s),d=h2(xi+1,yi+1,s);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
const mixc=(a,b,t)=>{const A=hex2rgb(a),B=hex2rgb(b);return'#'+[0,1,2].map(i=>Math.round(A[i]+(B[i]-A[i])*t).toString(16).padStart(2,'0')).join('')};
const pk=(c,a=255)=>{const[r,g,b]=hex2rgb(c);return((a<<24)|(b<<16)|(g<<8)|r)>>>0};
const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5].map(v=>(v+.5)/16);
const cellOf=(x,y)=>clamp(Math.floor(y/CS),0,GH-1)*GW+clamp(Math.floor(x/CS),0,GW-1);
/* profundidade efetiva: água acumulada ou leito do rio; pontes ficam secas */
function depth(x,y){if(!low)return 0;const i=cellOf(x,y);return dry[i]?0:Math.max(water[i],baseW[i])}

/* ---------- campo de água ---------- */
function reset(inf){info=inf||info;GW=Math.ceil(W/CS);GH=Math.ceil(H/CS);const n=GW*GH;low=new Float32Array(n);water=new Float32Array(n);baseW=new Float32Array(n);dry=new Uint8Array(n);drawn=new Float32Array(n);mud=new Float32Array(n);drawnMud=new Float32Array(n);fow.cw=Math.ceil(W/64);fow.grid=new Uint8Array(fow.cw*Math.ceil(H/64));
CWn=Math.ceil(W*Z/64);CHn=Math.ceil(H*Z/64);dirty=new Uint8Array(CWn*CHn);const P=info&&info.P;wx.snow=!!(P&&P.snow);
for(let cy=0;cy<GH;cy++)for(let cx=0;cx<GW;cx++){const i=cy*GW+cx,xw=cx*CS+CS/2,yw=cy*CS+CS/2;let l=.1+.5*vn(cx/5,cy/5,3)*(.6+.4*vn(cx/2.2,cy/2.2,9));l+=clamp(1-(Math.abs(xw-W/2)-280)/260,0,1)*.14;
const ay=yw/2,dxa=Math.abs(xw/2-riverX(ay)),hw=riverHW(ay);if(dxa<hw*.55)baseW[i]=.72;else if(dxa<hw)baseW[i]=.42;else if(dxa<hw+3)baseW[i]=.15;if(dxa<hw+16)l+=(1-dxa/(hw+16))*.5;
for(const yy of ROADS)if(Math.abs(xw-riverX(yy)*2)<108&&Math.abs(yw-yy*2)<42){dry[i]=1;baseW[i]=0}
low[i]=l}
if(info&&info.craters)for(const c of info.craters)basin(c.x*2,c.y*2,(c.r+2)*2.6,.9);
{const trl=[];if(typeof map!=='undefined'&&map==='trenches'&&window.PX&&PX.WW1){for(const a of PX.WW1.fieldTrenches())trl.push([a.x,a.y,a.hw+5,a.hh+5])}else for(let side=0;side<2;side++)for(let yw=70;yw<H-70;yw+=90)trl.push([(side===0?720:1700)+Math.sin(yw/140)*40,yw,54,24]);
const sunk=new Set();for(const[xw,yw,hw,hh]of trl)for(let cy=Math.floor((yw-hh)/CS);cy<=Math.floor((yw+hh)/CS);cy++)for(let cx=Math.floor((xw-hw)/CS);cx<=Math.floor((xw+hw)/CS);cx++){if(cx<0||cy<0||cx>=GW||cy>=GH)continue;const i=cy*GW+cx;if(!dry[i])sunk.add(i)}for(const i of sunk)low[i]+=.6}
waterCv=mk(W*Z,H*Z);wctx=g2(waterCv);
if(P){const w=P.w;pal={rim:pk('#2c2418',210),wet:pk('#16110a',64),t3:pk(mixc(w[3],'#8a7652',.5),232),t2:pk(mixc(w[3],'#6f5f3f',.3),238),t1:pk(mixc(w[2],'#5a4a30',.35),242),t0:pk(mixc(w[1],'#3a2f20',.35),246),hi:pk(mixc(w[3],'#e6f0ee',.55),240)}}
const sel=$$('weathersel'),m=sel?sel.value:'dynamic';wx.mode=m;wx.phase='clear';wx.I=0;wx.flash=0;wx.nextFlash=rnd(10,25);wx.noted={};wx.flood=0;wx.pen=[0,0];simAcc=0;drops=[];splashes=[];ripples=[];spray=[];
if(m==='clear')wx.startAt=1e9;else if(m==='rain'){wx.startAt=6;wx.peak=.85;wx.dur=170}else if(m==='storm'){wx.startAt=6;wx.peak=1.25;wx.dur=230}else{wx.startAt=rnd(40,75);wx.peak=rnd(.6,1);wx.dur=rnd(80,140)}initKinds(m)}
function basin(xw,yw,R,amt){const c0=Math.floor((xw-R)/CS),c1=Math.floor((xw+R)/CS),r0=Math.floor((yw-R)/CS),r1=Math.floor((yw+R)/CS);for(let cy=r0;cy<=r1;cy++)for(let cx=c0;cx<=c1;cx++){if(cx<0||cy<0||cx>=GW||cy>=GH)continue;const d=Math.hypot(cx*CS+CS/2-xw,cy*CS+CS/2-yw);if(d<R)low[cy*GW+cx]+=amt*(1-d/R)}}

function simWater(dt){if(wx.snow||!low)return;const I=wx.I,n=GW*GH,d=new Float32Array(n);
for(let i=0;i<n;i++){if(dry[i]||baseW[i]>.3){water[i]=0;continue}let w=water[i];if(I>.02)w+=RAIN*I*(.7+low[i]*.5)*dt;else if(w>0)w=Math.max(0,w-EVAP*dt*(1+.4*Math.min(1,w)));water[i]=w}
for(let it=0;it<2;it++){d.fill(0);for(let cy=0;cy<GH;cy++)for(let cx=0;cx<GW;cx++){const i=cy*GW+cx;if(dry[i]||baseW[i]>.3)continue;const hi_=water[i]-low[i];for(const j of[cx<GW-1?i+1:-1,cy<GH-1?i+GW:-1]){if(j<0||dry[j]||baseW[j]>.3)continue;const dh=hi_-(water[j]-low[j]);if(dh>0){const q=Math.min(KFLOW*dh,water[i]*.25);d[i]-=q;d[j]+=q}else{const q=Math.min(-KFLOW*dh,water[j]*.25);d[j]-=q;d[i]+=q}}}
for(let i=0;i<n;i++)water[i]=Math.max(0,water[i]+d[i])}
let land=0,wet=0;const CPX=64/(CS*Z);for(let i=0;i<n;i++){if(dry[i]||baseW[i]>.3)continue;land++;if(water[i]>=.25)wet++;if(Math.abs(water[i]-drawn[i])>.035){const cy=(i/GW)|0,cx=i%GW;dirty[Math.floor(cy/CPX)*CWn+Math.floor(cx/CPX)]=1}}
wx.flood=land?wet/land:0}

/* ---------- camadas visuais ---------- */
function drawChunk(cx,cy){const x0=cx*64,y0=cy*64,w=Math.min(64,W*Z-x0),h=Math.min(64,H*Z-y0);if(w<=0||h<=0)return;const img=wctx.createImageData(w,h),d32=new Uint32Array(img.data.buffer),s=pal;
for(let py=0;py<h;py++)for(let px=0;px<w;px++){const X=x0+px,Y=y0+py,fx=X/8-.5,fy=Y/8-.5,ix=Math.floor(fx),iy=Math.floor(fy),ax=fx-ix,ay=fy-iy,i00=clamp(iy,0,GH-1)*GW+clamp(ix,0,GW-1),i10=clamp(iy,0,GH-1)*GW+clamp(ix+1,0,GW-1),i01=clamp(iy+1,0,GH-1)*GW+clamp(ix,0,GW-1),i11=clamp(iy+1,0,GH-1)*GW+clamp(ix+1,0,GW-1);
const mv=mud?mud[i00]:0;let v=water[i00]*(1-ax)*(1-ay)+water[i10]*ax*(1-ay)+water[i01]*(1-ax)*ay+water[i11]*ax*ay;if(dry[i00]&&dry[i11])v=0;v+=(vn(X/5,Y/5,21)-.5)*.3*Math.min(1,v*5);const th=BAYER[(Y&3)*4+(X&3)];let col=0;
if(v>.17){col=v<.22?s.rim:v<.33?s.t3:v<.55?s.t2:v<.85?s.t1:s.t0;if(v>.3&&h2(X,Y,77)<.03)col=s.hi}else if((v>.04||mv>.2)&&th<Math.max(v/.17,(mv-.1)*.9)*.9)col=s.wet;
d32[py*w+px]=col}
wctx.putImageData(img,x0,y0);const CPX=64/(CS*Z);for(let cyy=Math.floor(y0/(CS*Z));cyy<Math.min(GH,Math.ceil((y0+h)/(CS*Z)));cyy++)for(let cxx=Math.floor(x0/(CS*Z));cxx<Math.min(GW,Math.ceil((x0+w)/(CS*Z)));cxx++){drawn[cyy*GW+cxx]=water[cyy*GW+cxx];drawnMud[cyy*GW+cxx]=mud[cyy*GW+cxx]}}
function under(ox,oy,fdt){if(!wctx||wx.snow)return;let budget=6;for(let k=0;k<dirty.length&&budget>0;k++){const idx=(chunkCursor+k)%dirty.length;if(dirty[idx]){dirty[idx]=0;drawChunk(idx%CWn,(idx/CWn)|0);budget--;chunkCursor=idx+1}}
ctx.drawImage(waterCv,ox,oy);
for(const r of ripples){const k=1-r.t/r.max,rad=1+k*r.size;ctx.globalAlpha=(1-k)*.85;ring(ctx,ox+Math.round(r.x*Z),oy+Math.round(r.y*Z),rad,rad*.55,'#d8e6e4');}ctx.globalAlpha=1;
if(wx.I>.03&&running){const tries=Math.floor(wx.I*vw*vh/14000+Math.random());for(let i=0;i<tries;i++){const sx=Math.random()*vw,sy=Math.random()*vh,wx_=(sx-ox)/Z,wy_=(sy-oy)/Z;if(depth(wx_,wy_)>=.2&&splashes.length<220)splashes.push({x:wx_,y:wy_,t:.4,max:.4})}}
for(const s of splashes){const k=1-s.t/s.max,rad=k*4+.5;ctx.globalAlpha=(1-k)*.9;ring(ctx,ox+Math.round(s.x*Z),oy+Math.round(s.y*Z),rad,rad*.6,'#dcebea');if(k<.3){ctx.fillStyle='#eef6f5';ctx.fillRect(ox+Math.round(s.x*Z),oy+Math.round(s.y*Z)-1,1,1)}}ctx.globalAlpha=1}
/* linha d'água no corpo de quem está vadeando/nadando */
function waterline(c,x,y,rx,deep,id){const t=time*3+id,tone=deep?'rgba(70,90,84,.94)':'rgba(96,110,92,.88)';c.fillStyle=tone;c.fillRect(x-rx,y,rx*2+1,2);c.fillRect(x-rx+1,y-1,rx*2-1,1);c.fillRect(x-rx+1,y+2,rx*2-1,1);c.fillStyle='rgba(206,224,220,.9)';const o=Math.floor(t)%4;c.fillRect(x-rx+1+o,y-1,2,1);c.fillRect(x+rx-3-o,y+1,2,1);
c.globalAlpha=.6;const k=(t*.7)%1;ring(c,x,y+1,rx+1+k*3,1+k*1.5,'#dcebea');c.globalAlpha=1}
function wake(c,x,y,deep){c.globalAlpha=deep?.55:.4;c.fillStyle=deep?'#4a5c56':'#66745f';c.fillRect(x-17,y+3,35,9);c.fillRect(x-19,y+5,39,5);c.globalAlpha=.8;const k=(time*1.4)%1;ring(c,x,y+7,14+k*6,5+k*2.5,'#d8e6e4');c.globalAlpha=1}

function over(ox,oy,fdt){const I=wx.I;fogPass(ox,oy);const SL=clamp(windVec().x/60*.5,-.6,.6);if(wx.snow){if(I>.03){ctx.globalAlpha=.12*Math.min(1,I);ctx.fillStyle='#dfe8ee';ctx.fillRect(0,0,vw,vh);ctx.globalAlpha=1;const n=Math.floor(I*vw*vh/500);while(drops.length<n)drops.push({x:Math.random()*vw,y:Math.random()*vh,v:rnd(70,130)});if(drops.length>n)drops.length=n;for(const d of drops){if(running){d.x+=SL*1.6*d.v*fdt;d.y+=d.v*fdt}if(d.y>vh){d.y=-2;d.x=Math.random()*vw}if(d.x<0)d.x=vw;ctx.fillStyle=d.v>100?'#ffffff':'#dfe8ee';ctx.fillRect(d.x|0,d.y|0,d.v>100?2:1,1);ctx.fillRect((d.x+1)|0,(d.y+1)|0,1,1)}}return}
for(const p of spray){ctx.globalAlpha=Math.min(1,p.t/.25);ctx.fillStyle=p.c;ctx.fillRect(ox+Math.round(p.x*Z),oy+Math.round(p.y*Z),p.s,p.s)}ctx.globalAlpha=1;
if(I<=.02)return;
const n=Math.floor(Math.min(1.3,I)*vw*vh/650);while(drops.length<n)drops.push({x:Math.random()*vw,y:Math.random()*vh,v:rnd(240,380),l:2+Math.floor(Math.random()*3)});if(drops.length>n)drops.length=n;
for(const d of drops){if(running){d.y+=d.v*fdt;d.x+=SL*d.v*fdt}if(d.y>vh){d.y=-d.l-2;d.x=Math.random()*(vw+40)}if(d.x<-4)d.x+=vw+8;ctx.globalAlpha=d.v>320?.7:.45;pline(ctx,d.x,d.y,d.x-d.l*SL,d.y-d.l,d.v>320?'#d3e3ee':'#9fb7c8')}ctx.globalAlpha=1;
if(wx.flash>0){ctx.globalAlpha=wx.flash>.2?.5:wx.flash>.1?.28:.14;ctx.fillStyle='#eaf2ff';ctx.fillRect(0,0,vw,vh);ctx.globalAlpha=1}drawBolts(ox,oy)}

/* ---------- clima e efeitos no jogo ---------- */
function stepWeather(dt){const t=time;
stepKinds(dt);const target=wx.targetRain;wx.I+=clamp(target-wx.I,-dt/16,dt/14);if(wx.I<.005&&target===0)wx.I=0;
if(wx.cur==='storm'&&wx.I>.8&&running&&!wx.snow){wx.nextFlash-=dt;if(wx.nextFlash<=0){wx.nextFlash=rnd(9,24);strike()}}
if(wx.flash>0)wx.flash=Math.max(0,wx.flash-dt);for(const b of bolts)b.t-=dt;bolts=bolts.filter(b=>b.t>0);
/* chuva ambiente */
try{if(typeof soundOn!=='undefined'&&soundOn&&typeof audio!=='undefined'&&audio){if(!wx.amb){const len=audio.sampleRate*2,buf=audio.createBuffer(1,len,audio.sampleRate),dd=buf.getChannelData(0);for(let i=0;i<len;i++)dd[i]=Math.random()*2-1;const src=audio.createBufferSource();src.buffer=buf;src.loop=true;const f=audio.createBiquadFilter();f.type='bandpass';f.frequency.value=2600;f.Q.value=.6;const g=audio.createGain();g.gain.value=0;src.connect(f);f.connect(g);g.connect(audio.destination);src.start();wx.amb=g}wx.amb.gain.value=wx.snow?0:.05*clamp(wx.I,0,1.3);if(!wx.ambW){const len=audio.sampleRate*2,buf=audio.createBuffer(1,len,audio.sampleRate),dd=buf.getChannelData(0);for(let i=0;i<len;i++)dd[i]=Math.random()*2-1;const src=audio.createBufferSource();src.buffer=buf;src.loop=true;const f=audio.createBiquadFilter();f.type='lowpass';f.frequency.value=420;const g=audio.createGain();g.gain.value=0;src.connect(f);f.connect(g);g.connect(audio.destination);src.start();wx.ambW=g}wx.ambW.gain.value=.045*clamp(windVec().s,0,1.3)}else{if(wx.amb)wx.amb.gain.value=0;if(wx.ambW)wx.ambW.gain.value=0}}catch{}}
const speedOf=(u,d)=>{let f;if(u.type==='tank')f=d<.12?1:d<.25?.85:d<.55?.55:d<.78?.3:.12;else{f=d<.12?1:d<.25?.92:d<.55?.72:.45;if(u.type==='cavalry'&&d>=.25)f*=.85}return f*(1-.12*Math.min(1,wx.I))*(1-(u.type==='tank'?.3:.2)*mudAt(u.x,u.y))};
function floodedShare(team){let own=0,fl=0;for(const p of points){if(p.owner!==team)continue;own++;let m=0;for(const[dx,dy]of[[0,0],[60,0],[-60,0],[0,60],[0,-60]])m=Math.max(m,depth(p.x+dx,p.y+dy));if(m>=.3)fl++}return own?fl/own:0}
const moneyMode=()=>typeof supplies!=='undefined'&&Array.isArray(supplies)?'arr':typeof money==='number'?'num':'none';
wrap('update',(orig,dt)=>{if(!low)return orig(dt);const s0=serial,mm=moneyMode(),m0=mm==='arr'?supplies.slice():mm==='num'?money:0;
for(const u of units){u._wx=u.x;u._wy=u.y}
orig(dt);
stepWeather(dt);simAcc+=dt;if(simAcc>=.25){simWater(simAcc);simMud(simAcc);updateFow();simAcc=0}
const I=wx.I,bogBase=wx.snow?0:1;
for(const u of units){
 if(u._wx===undefined){/* recém-chegado: reforços e esquadrões atolam conforme a chuva e o alagamento */
  if(!wx.snow&&(I>.12||depth(u.x,u.y)>=.25)){const edge=u.x<380||u.x>2020,b=(edge?rnd(2.5,5.5):rnd(0,2))*(.35+Math.min(1.2,I))+depth(u.x,u.y)*6;if(b>1.2){u._bog=time+b;u._bx=u.x;u._by=u.y}}
  continue}
 if(u._bog>time){u.x=u._bx;u.y=u._by;u.moving=false;if(Math.random()<dt*9)spray.push({x:u.x+rnd(-8,8),y:u.y+rnd(2,10),vx:rnd(-30,30),vy:rnd(-55,-20),t:.5,s:1+(Math.random()<.4),c:['#4a3c28','#6b583a','#8a7652'][(Math.random()*3)|0]});continue}
 const d=depth(u.x,u.y);let f=speedOf(u,d);if(wx.snow)f=1-.1*Math.min(1,I);
 if(f<.999){u.x=u._wx+(u.x-u._wx)*f;u.y=u._wy+(u.y-u._wy)*f}
 if(d>=.55&&u.type!=='tank'&&u.cd>0)u.cd+=dt*.7;
 exhaust(u,d,dt);if(u.moving)track(u,d);
 if(d>=.25&&u.moving&&ripples.length<140&&Math.random()<dt*(u.type==='tank'?7:5))ripples.push({x:u.x,y:u.y+(u.type==='tank'?8:6),t:.7,max:.7,size:u.type==='tank'?9:5});
 if(u.type==='tank'&&d>=.78&&u.moving&&Math.random()<dt*10)spray.push({x:u.x+rnd(-14,14),y:u.y+rnd(6,14),vx:rnd(-40,40),vy:rnd(-70,-25),t:.55,s:2,c:'#6b583a'})}
for(const b of buildings){if(b.type==='bunker'&&depth(b.x,b.y)>=.55&&b.cd<.3)b.cd=.3;if((b.type==='trench'||b.type==='sandbag')&&depth(b.x,b.y)>=.55)b.hp-=dt*3}
trackBudget=70;{const wv=windVec();for(const s of shells){s.x+=wv.x*dt*.15;s.y+=wv.y*dt*.15}}
for(const r of ripples)r.t-=dt;ripples=ripples.filter(r=>r.t>0);for(const s of splashes)s.t-=dt;splashes=splashes.filter(s=>s.t>0);for(const p of spray){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=120*dt;p.t-=dt}spray=spray.filter(p=>p.t>0);
/* logística: a chuva e o alagamento das posições reduzem a renda de suprimentos */
const pen=[0,1].map(t=>clamp((wx.snow?.15:.28)*Math.min(1,I)+(wx.snow?0:.4*floodedShare(t)),0,.7));wx.pen=pen;
if(mm==='arr'){for(let t=0;t<2;t++){const dd=supplies[t]-m0[t];if(dd>0&&dd<60)supplies[t]-=dd*pen[t]}}else if(mm==='num'){const dd=money-m0;if(dd>0&&dd<60)money-=dd*pen[0]}
if(pen[0]>.12&&!wx.noted.log){wx.noted.log=1;toast('Logística comprometida: a renda de suprimentos caiu e os reforços chegam atolados.')}
if(wx.flood>.05&&!wx.noted.flood){wx.noted.flood=1;toast('Campo alagando! Infantaria vai nadar, tanques atolar e trincheiras perder proteção.')}});
wrap('protectedBy',(orig,u)=>{let f=orig(u);const d=depth(u.x,u.y);if(d>=.25&&u.type!=='tank'){if(f<1)f=f+(1-f)*clamp((d-.2)/.5,0,.9);if(d>=.55)f=Math.min(1.3,f*1.2)}return f});
wrap('explode',(orig,x,y,r,power,team)=>{orig(x,y,r,power,team);if(r>=40&&low)basin(x,y,r*.9,.55)});
wrap('setup',(orig,demo)=>{const r=orig(demo);reset(window.PXGAME&&PXGAME.base);return r});
wrap('minimap',orig=>{const r=orig();updatePill();return r});

/* ---------- CLIMA 2.0: tipos de tempo, previsão, neblina, vento, raios, lama e rastros ---------- */
let mud,drawnMud,bolts=[],fogPat=null,trackBudget=70;const fow={on:false,team:0,grid:null,cw:0,R:0};
const KIND={clear:{rain:0,fog:0,cloud:0,wind:.15},overcast:{rain:0,fog:.1,cloud:.35,wind:.3},drizzle:{rain:.35,fog:.25,cloud:.55,wind:.25},rain:{rain:.85,fog:.2,cloud:.8,wind:.5},storm:{rain:1.25,fog:.12,cloud:1,wind:.9},fog:{rain:0,fog:1,cloud:.45,wind:.05}};
const NAMES={clear:'TEMPO LIMPO',overcast:'NUBLADO',drizzle:'GAROA',rain:'CHUVA',storm:'TEMPESTADE',fog:'NEBLINA'},SNOWN={clear:'FRIO',overcast:'NUBLADO',drizzle:'NEVE FRACA',rain:'NEVE',storm:'NEVASCA',fog:'NEBLINA GELADA'};
const ICON={clear:'☀',overcast:'☁',drizzle:'☂',rain:'☂',storm:'⚡',fog:'≋'},DUR={clear:[40,70],overcast:[25,50],drizzle:[40,70],rain:[60,110],storm:[45,80],fog:[50,90]};
const TRANS={clear:[['overcast',.45],['overcast',.2],['drizzle',.25],['rain',.1]],overcast:[['drizzle',.3],['rain',.3],['overcast',.15],['clear',.25]],drizzle:[['rain',.35],['overcast',.3],['clear',.2],['overcast',.15]],rain:[['storm',.3],['drizzle',.3],['overcast',.3],['clear',.1]],storm:[['rain',.5],['drizzle',.3],['overcast',.2]],fog:[['clear',.4],['overcast',.4],['drizzle',.2]]};
const MSG={clear:'O tempo abriu.',overcast:'O céu fechou.',drizzle:'Começou a garoar.',rain:'Começou a chover forte. As áreas baixas vão alagar.',storm:'Tempestade! Raios, vento forte e aviões em solo.',fog:'Neblina densa: a visibilidade despencou.'},MSGS={drizzle:'Começou a nevar.',rain:'Nevada forte.',storm:'Nevasca! Vento forte e aviões em solo.',fog:'Neblina gelada: a visibilidade despencou.'};
const kname=k=>(wx.snow?SNOWN:NAMES)[k];
function pickNext(from){let r=Math.random(),acc=0;for(const[k,p]of TRANS[from]){acc+=p;if(r<=acc)return k}return TRANS[from][0][0]}
function setKind(k,announce){if(k==='fog')k='overcast';wx.cur=k;if(!wx.fixed){const d=DUR[k];wx.until=time+rnd(d[0],d[1]);wx.next=pickNext(k);wx.noted2=false}if(announce&&(time>1))toast(wx.snow&&MSGS[k]?MSGS[k]:MSG[k])}
function initKinds(m){wx.cur='clear';wx.next='clear';wx.until=1e9;wx.noted2=false;wx.targetRain=0;wx.cloud=0;wx.fog=0;wx.wS=.15;wx.wAng=Math.PI+rnd(-.6,.6);wx.override=null;wx.mud=0;bolts=[];
if(m==='dynamic'){wx.fixed=null;wx.until=rnd(25,45);wx.next=pickNext('clear')}else wx.fixed=['clear','drizzle','rain','storm','fog'].includes(m)?m:'clear'}
function stepKinds(dt){const t=time;
if(wx.fixed){if(wx.cur!==wx.fixed&&t>=3)setKind(wx.fixed,true)}
else{if(t>=wx.until)setKind(wx.next,true);else if(!wx.noted2&&wx.until-t<12&&wx.next!==wx.cur){wx.noted2=true;toast('Previsão: '+kname(wx.next).toLowerCase()+' chegando em instantes.')}}
const K=KIND[wx.cur];wx.targetRain=wx.override!=null?wx.override:K.rain*(wx.snow?.9:1);
wx.fog+=clamp(K.fog-wx.fog,-dt*.04,dt*.035);wx.cloud+=clamp(K.cloud-wx.cloud,-dt*.06,dt*.06);
const ws=K.wind*(.85+.3*Math.sin(t*.13));wx.wS+=clamp(ws-wx.wS,-dt*.05,dt*.05);wx.wAng+=dt*.03*Math.sin(t*.31+1)}
/* vento em unidades de mundo por segundo; s = intensidade com rajadas (0..~1.3) */
function windVec(){const s=wx.wS*(1+.25*Math.sin(time*1.9)*Math.sin(time*.43)),sp=s*60;return{x:Math.cos(wx.wAng)*sp,y:Math.sin(wx.wAng)*sp,s}}
const grounded=()=>(wx.cur==='storm'&&wx.I>.9)||wx.fog>.7;
const fogEff=()=>0;/* neblina removida do jogo */
/* neblina: 3 camadas de ruído tileável em pixel (dithering de Bayer), com paralaxe e deriva do vento */
function vnT(x,y,per,s){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),m=a=>((a%per)+per)%per,a=h2(m(xi),m(yi),s),b=h2(m(xi+1),m(yi),s),c=h2(m(xi),m(yi+1),s),d=h2(m(xi+1),m(yi+1),s);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
function makeFog(){const S=160,out=[],col=pk('#d8e1e4');for(const th of[.47,.57,.67]){const c=mk(S,S),x=g2(c),img=x.createImageData(S,S),d=new Uint32Array(img.data.buffer);
for(let y=0;y<S;y++)for(let xx=0;xx<S;xx++){let v=0,a=.5,n=0;for(let o=0;o<3;o++){const f=5<<o;v+=vnT(xx/S*f,y/S*f,f,31+o*7)*a;n+=a;a*=.5}v/=n;if(v+(BAYER[(y&3)*4+(xx&3)]-.5)*.1>th)d[y*S+xx]=col}
x.putImageData(img,0,0);out.push(ctx.createPattern(c,'repeat'))}return out}
function fogPass(ox,oy){if(wx.cloud>.03){const a=Math.ceil(wx.cloud*3)/3*(wx.snow?.16:.3);ctx.fillStyle=wx.snow?`rgba(70,84,100,${a})`:`rgba(16,28,44,${a})`;ctx.fillRect(0,0,vw,vh)}
const fe=fogEff();if(fe<=.04)return;if(!fogPat)fogPat=makeFog();const wv=windVec();
ctx.globalAlpha=Math.ceil(fe*4)/4*.16;ctx.fillStyle='#b4c2c6';ctx.fillRect(0,0,vw,vh);
for(let i=0;i<3;i++){const a=clamp((fe-.1*i)*(.42+.05*i),0,.55)*(wx.cur==='fog'?1:.6);if(a<=.02)continue;ctx.globalAlpha=a;const px=Math.round(ox*(.85+.05*i)+time*wv.x*.05*(1+i*.6)),py=Math.round(oy*(.85+.05*i)+time*wv.y*.05*(1+i*.6));ctx.save();ctx.translate(px,py);ctx.fillStyle=fogPat[i];ctx.fillRect(-px,-py,vw,vh);ctx.restore()}ctx.globalAlpha=1}
/* névoa de guerra: com pouca visibilidade, inimigos longe das suas tropas somem (e a mira fica mais curta) */
function updateFow(){const fe=fogEff();fow.team=typeof playerTeam==='number'?playerTeam:0;fow.on=fe>=.25&&units.some(u=>u.team===fow.team&&u.hp>0);if(!fow.on||!fow.grid)return;
const R=760+(230-760)*clamp((fe-.25)/.75,0,1);fow.R=R;fow.grid.fill(0);const ch=Math.ceil(H/64),rc=Math.ceil((R+45)/64);
for(const u of units){if(u.team!==fow.team||u.hp<=0)continue;const cx=Math.floor(u.x/64),cy=Math.floor(u.y/64);for(let y=Math.max(0,cy-rc);y<=Math.min(ch-1,cy+rc);y++)for(let x=Math.max(0,cx-rc);x<=Math.min(fow.cw-1,cx+rc);x++){if(Math.hypot(x*64+32-u.x,y*64+32-u.y)<R+45)fow.grid[y*fow.cw+x]=1}}}
function visible(u){if(!fow.on||u.team===fow.team)return true;return fow.grid[Math.floor(u.y/64)*fow.cw+Math.floor(u.x/64)]===1}
wrap('nearest',(orig,u,range)=>orig(u,range*(1-.5*fogEff())));
/* aviões não decolam em tempestade ou neblina densa */
wrap('choose',(orig,type)=>{if(grounded()&&(type==='fighter'||type==='bomber')){toast('Sem condições de voo: os aviões ficam em solo.');return}return orig(type)});
wrap('callFighter',(orig,...a)=>{if(grounded())return;return orig(...a)});
/* lama: o solo encharca com a chuva e seca devagar */
const mudAt=(x,y)=>mud&&!wx.snow?mud[cellOf(x,y)]:0;
function simMud(dt){if(wx.snow||!mud)return;const n=mud.length,up=wx.I>.05?wx.I*dt*.006:0,dn=wx.I>.05?0:dt*.0008,CPX=64/(CS*Z);let land=0,sum=0;
for(let i=0;i<n;i++){if(dry[i]||baseW[i]>.3)continue;land++;let m=mud[i];m=up?Math.min(1,m+up*(.8+low[i]*.4)):Math.max(0,m-dn);mud[i]=m;sum+=m;if(Math.abs(m-drawnMud[i])>.08){const cy=(i/GW)|0,cx=i%GW;dirty[Math.floor(cy/CPX)*CWn+Math.floor(cx/CPX)]=1}}
wx.mud=land?sum/land:0}
/* rastros: pegadas de soldados e marcas de esteira ficam gravadas no terreno enlameado */
function track(u,d){if(trackBudget<=0||d>=.55)return;const m=mudAt(u.x,u.y);if(m<.3&&!(d>=.12&&d<.55))return;const g=window.PXGAME&&PXGAME.tctx;if(!g)return;const tk=u.type==='tank',thr=tk?7:26;if(!u._tk){u._tk={x:u.x,y:u.y};return}
const dx=u.x-u._tk.x,dy=u.y-u._tk.y,dd=Math.hypot(dx,dy);if(dd<thr)return;const a=Math.atan2(dy,dx),cs=Math.cos(a),sn=Math.sin(a);u._tk.x=u.x;u._tk.y=u.y;trackBudget--;
g.fillStyle=wx.snow?'rgba(70,86,96,.5)':'rgba(26,18,10,.5)';
if(tk){for(const sd of[-1,1]){const px=Math.round((u.x-sn*sd*9)*Z),py=Math.round((u.y+cs*sd*9)*Z);g.fillRect(px,py,3,1);g.fillStyle=wx.snow?'rgba(70,86,96,.28)':'rgba(26,18,10,.28)';g.fillRect(px+(cs>.5?0:1),py+1,2,1);g.fillStyle=wx.snow?'rgba(70,86,96,.5)':'rgba(26,18,10,.5)'}}
else{u._ft=-(u._ft||1);g.fillRect(Math.round((u.x-sn*u._ft*2.5)*Z),Math.round((u.y+cs*u._ft*2.5+5)*Z),1,1)}}
/* quem nada por muito tempo se exaurre e se afoga */
function exhaust(u,d,dt){if(u.type==='tank')return;if(d>=.55){u._swim=(u._swim||0)+dt;if(u._swim>10){u._drown=(u._drown||0)+dt*3;if(u._drown>=6){u._drown=0;if(!wx.noted.swim){wx.noted.swim=1;toast('Soldados exaustos se afogam: tire a infantaria da água funda.')}damage(u,6,2)}}}else if(u._swim>0)u._swim=Math.max(0,u._swim-dt*2)}
/* raio: clarão, traço visível e dano em área (prefere alvos altos, como tanques) */
function strike(){const pool=units.filter(u=>u.hp>0);let tx,ty;if(pool.length&&Math.random()<.7){const tanks=pool.filter(u=>u.type==='tank'),u=tanks.length&&Math.random()<.4?tanks[(Math.random()*tanks.length)|0]:pool[(Math.random()*pool.length)|0];tx=u.x+rnd(-70,70);ty=u.y+rnd(-70,70)}else{tx=rnd(200,W-200);ty=rnd(200,H-200)}
tx=clamp(tx,30,W-30);ty=clamp(ty,30,H-30);const pts=[],n=12;for(let i=0;i<=n;i++){const k=i/n,j=(1-k)*26+4;pts.push([tx+(rnd(-60,60))*(1-k)+rnd(-j,j)*(i<n?1:0),ty-520+k*520])}
const br=[];for(let b=0;b<2;b++){const s=pts[3+((Math.random()*5)|0)],q=[s];let px=s[0],py=s[1];const dir=Math.random()<.5?-1:1;for(let i=0;i<4;i++){px+=dir*rnd(10,26);py+=rnd(22,44);q.push([px,py])}br.push(q)}
bolts.push({pts,br,t:.28});wx.flash=.3;if(typeof screenShake!=='undefined')screenShake=Math.max(screenShake,1.8);
explode(tx,ty,46,110,2);const cam_=typeof cam!=='undefined'?Math.hypot(cam.x-tx,cam.y-ty):300;setTimeout(()=>{if(typeof soundOn!=='undefined'&&soundOn)sound('boom')},Math.min(1600,cam_*1.1))}
function drawBolts(ox,oy){for(const b of bolts){const on=b.t>.2||(b.t<.14&&b.t>.07);if(!on)continue;const S=p=>[ox+Math.round(p[0]*Z),oy+Math.round(p[1]*Z)];
const line=(q,col,dx)=>{for(let i=1;i<q.length;i++){const a=S(q[i-1]),c=S(q[i]);pline(ctx,a[0]+dx,a[1],c[0]+dx,c[1],col)}};
ctx.globalAlpha=.5;line(b.pts,'#8fb4ff',-1);line(b.pts,'#8fb4ff',1);ctx.globalAlpha=1;line(b.pts,'#ffffff',0);for(const q of b.br){ctx.globalAlpha=.7;line(q,'#dbe8ff',0);ctx.globalAlpha=1}}}

/* ---------- interface ---------- */
const field=$$('field');let pill=null;
if(field){pill=document.createElement('div');pill.id='wxpill';field.append(pill)}
const form=document.querySelector('.menuform');
if(form&&!$$('weathersel')){const l=document.createElement('label');l.innerHTML='CLIMA<select id="weathersel"><option value="dynamic" selected>Variável · com previsão</option><option value="clear">Tempo limpo</option><option value="drizzle">Garoa</option><option value="rain">Chuva</option><option value="storm">Tempestade com raios</option></select>';form.append(l)}
function updatePill(){if(!pill)return;const I=wx.I,pct=Math.round(I*100),fl=Math.round(wx.flood*100),mu=Math.round((wx.mud||0)*100),lg=Math.round(Math.max(wx.pen[0],wx.pen[1])*100),wv=windVec();
const arrows=['→','↘','↓','↙','←','↖','↑','↗'],arrow=arrows[Math.round(((Math.atan2(wv.y,wv.x)+Math.PI*2)%(Math.PI*2))/(Math.PI/4))%8],kmh=Math.round(wv.s*45),fg=Math.round(wx.fog*100);
const l1=`${ICON[wx.cur]} ${kname(wx.cur)}${wx.cur==='fog'?' '+fg+'%':I>.02?' '+pct+'%':''}${wx.fog>.15&&wx.cur!=='fog'?' · NEBLINA '+fg+'%':''}`;
let fc='';if(!wx.fixed&&wx.next!==wx.cur){const s=Math.max(0,Math.ceil(wx.until-time));fc=` · PREVISÃO: ${kname(wx.next)} EM ${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}
const l2=`VENTO ${arrow} ${kmh} km/h${fc}`,parts=[];if(!wx.snow&&fl>0)parts.push('ALAGADO '+fl+'%');if(!wx.snow&&mu>3)parts.push('LAMA '+mu+'%');if(lg>0)parts.push('LOGÍSTICA −'+lg+'%');if(grounded())parts.push('AVIÕES EM SOLO');if(fow.on)parts.push('VISÃO '+Math.round(fow.R)+'m');
pill.textContent=[l1,l2].concat(parts.length?[parts.join(' · ')]:[]).join('\n');pill.className=I>.02||wx.fog>.3?'wet':''}
window.PXW={get fow(){return fow},get mudGrid(){return mud},depth,mudAt,waterline,wake,under,over,reset,visible,windVec,state:wx,get flood(){return wx.flood},sim:simWater,strike,setKind:k=>{wx.fixed=k;setKind(k,true)},setRain(v){wx.override=v;wx.I=v}};
reset(window.PXGAME&&PXGAME.base);
})();
