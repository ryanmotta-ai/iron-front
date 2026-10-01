'use strict';
(function(){
/* Iron Front 0.7 — artilharia tripulada (fases A–E do plano).
   As 12 posições de bateria do mapa "trenches" (PX.WW1.layout().guns, espelhadas para o lado Central) viram entidades
   com guarnição de 4 homens. Uma missão de fogo (PXBAT.mission) é repartida entre as baterias em condições de atirar;
   cada peça percorre o ciclo apontar → municiar → cordel → disparo → recuo → ejeção, e o projétil só sai da boca
   do canhão: o tempo de voo depende da distância real e o som chega com atraso (340 m/s) e assobio de aproximação.
   Fase D: no modo soldado, E perto de uma peça aliada assume o canhão (retículo WASD, clique dispara, 1/2/3 troca a munição).
   Fase E: HE (cratera), shrapnel (estoura no ar, inútil contra quem está na trincheira) e fumaça (cortina que cega os tiros).
   Contra-bateria: quem dispara muito é localizado e vira alvo; a guarnição corre para o abrigo.
   Coordenadas internas em pixels de arte (mundo = 2×), como ww1-ambient.js. Sem alocação por quadro no desenho. */
const rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rect=(c,x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h)};
/* ciclo por tipo de peça (s): apontar, municiar, cordel, disparo, recuo, ejeção, pausa até fechar 4,8 s / 7,5 s */
const CYC={f:{aim:.6,load:1.4,ready:.3,fire:.15,recoil:.4,eject:.8,total:4.8,ammo:32,r:70,power:150},
           h:{aim:.6,load:2.6,ready:.3,fire:.15,recoil:.4,eject:1.4,total:7.5,ammo:18,r:95,power:210}};
const PHASES=['aim','load','ready','fire','recoil','eject'];
const UNI=[{u:'#6f7448',h:'#4c5236',d:'#3b3426'},{u:'#6a6f77',h:'#474c53',d:'#2c2f33'}]; // EUA cáqui-oliva · Alemanha feldgrau
/* cadência conforme os servidores vivos: 4 → 100%, 3 → 70%, 2 → 40%, 1 → 20%, 0 → inoperante */
const crewRate=n=>[0,.2,.4,.7,1][clamp(n,0,4)];
/* tempo de voo: 1,8 s a ~400 m, 4,2 s a ~1800 m (obuseiro voa em arco mais alto: +0,3 s) */
const flightTime=(d,big)=>1.8+2.4*clamp((d-400)/1400,-.3,1.3)+(big?.3:0);
const SOUND_V=340;

/* tipos de projétil: alcance/dano relativos ao CYC da peça */
const KINDS=['he','shrap','smoke'],KNAME={he:'ALTO-EXPLOSIVO',shrap:'SHRAPNEL',smoke:'FUMAÇA'};
const RANGE={f:{min:150,max:1500},h:{min:350,max:2000}};
let B=[],DEP=[],WG=[],cmdKind=['he','he'],parts=[],flashes=[],casings=[],snd=[],smokes=[],harass=6,lostToast=0,active=false,G=null,cbHeat=[0,0],cbCool=[0,0],cbToast=0;

function build(){
 B=[];DEP=[];WG=[];cmdKind=['he','he'];parts=[];flashes=[];casings=[];snd=[];smokes=[];G=null;cbHeat=[0,0];cbCool=[0,0];harass=rnd(4,8);
 const WW=window.PX&&PX.WW1;
 active=typeof map!=='undefined'&&map==='trenches'&&!!WW;if(!active)return;
 const L=WW.layout(),PW=WW.PW;
 for(const team of[0,1])L.guns.forEach((g,i)=>mkGun(team,g,i));
 for(const team of[0,1]){const X=x=>team?PW-x:x;DEP.push({team,x:X(72),y:98,hp:450,max:450,dead:false,burn:0});WG.push({team,st:'idle',pts:null,i:0,x:0,y:0,b:null,chk:rnd(1,3)})}}
/* uma peça (g em pixels de arte, no espaço do lado 0: g.x cresce para a frente; g.k 'f' campanha / 'h' obuseiro) */
function mkGun(team,g,i){const PW=PX.WW1.PW;
  const big=g.k==='h',d=team?-1:1,ml=big?22:16,cx=team?PW-(g.x+2):g.x+2,cy=g.y,
   mk=(role,hx,hy)=>({role,hp:100,alive:true,x:hx,y:hy,hx,hy,px:cx-d*26,py:cy-14});
  B.push({team,i,big,d,cx,cy,mx:team?PW-(g.x+ml):g.x+ml,my:cy,off:0,ang:d>0?0:Math.PI,cfg:big?CYC.h:CYC.f,
   crew:[mk('gunner',cx-d*2,cy-11),mk('loader',cx-d*11,cy+8),mk('carrier',cx-d*26,cy-14),mk('firer',cx-d*19,cy+1)],
   ammo:(big?CYC.h:CYC.f).ammo,queue:[],ph:null,t:0,cool:0,recoil:0,shotT:99,tgt:null,phase:0,refill:0,sp:{shrap:big?5:8,smoke:big?3:4},spT:0,hot:-99,shelter:0,ri:big?14:11,gx:g.x});const b=B[B.length-1];gunGeom(b);return b}
/* peças construídas durante a partida (fortify.js): coordenadas do mundo; devolve a bateria ou null */
function addGun(team,wx,wy,kind){if(!active||!window.PX||!PX.WW1)return null;const PW=PX.WW1.PW,ax=wx*.5;
 const b=mkGun(team,{x:team?PW-ax-2:ax-2,y:Math.round(wy*.5),k:kind==='h'?'h':'f'},B.length);if(b)b.built=1;return b}
function removeGun(b){const i=B.indexOf(b);if(i<0)return false;B.splice(i,1);for(const w of WG)if(w.b===b){w.st='idle';w.b=null;w.chk=2}return true}

/* ---------- canhão vivo: carro fixo + tubo desenhado à parte (gira em azimute e recua no berço) ---------- */
const GUN={f:{fn:'fieldGun',clr:[19,6,17,7],pv:[18,9],len:17,th:3,mb:6},h:{fn:'howitzer',clr:[22,7,23,8],pv:[21,11],len:22,th:5,mb:7}};
const TUBE={3:['#aab1b6','#5d646b','#2f3338'],5:['#b4bbc0','#8a9198','#5d646b','#4a5056','#2a2e32']};
const BODY={};
function spriteOf(big){const A=PX.WW1&&PX.WW1.SPR;return A?(big?A.howitzer():A.fieldGun()):null}
function bodyOf(big){const k=big?'h':'f';if(BODY[k])return BODY[k];const sp=spriteOf(big),K=PX.WW1.kit,g=GUN[k],c=K.mk(sp.c.width,sp.c.height),x=K.g2(c);
 x.drawImage(sp.c,0,0);x.clearRect(g.clr[0],g.clr[1],g.clr[2],g.clr[3]);
 return BODY[k]={c,ax:sp.ax,ay:sp.ay,sh:sp.sh,sa:sp.sa,key:'batbody-'+k}}
/* posição do sprite (mesma conta de ww1-scene: addC + round) → pivô do tubo em pixels de arte */
function gunGeom(b){try{const sp=spriteOf(b.big),g=GUN[b.big?'h':'f'],w=sp.c.width,x0=Math.round(b.cx+sp.ax-w/2),y0=Math.round(b.cy+sp.ay-sp.c.height/2),flip=b.team===1,
  tlx=x0-(flip?w-sp.ax-1:sp.ax),tly=y0-sp.ay;
  b.gx0=x0;b.gy0=y0;b.pvx=tlx+(flip?w-1-g.pv[0]:g.pv[0]);b.pvy=tly+g.pv[1];b.len=g.len;b.live=true;tubeTip(b)}catch{b.live=false}}
function tubeTip(b){if(!b.live)return;b.mx=b.pvx+Math.cos(b.ang)*b.len;b.my=b.pvy+Math.sin(b.ang)*b.len}
const angDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const alive=b=>{let n=0;for(const c of b.crew)if(c.alive)n++;return n};
const operational=b=>alive(b)>0&&(b.ammo>0||b.ph!==null);

/* ---------- missão de fogo ---------- */
/* Reparte `count` tiros entre as baterias operacionais do lado. Devolve false só se o mapa não tem baterias (o jogo
   cai no bombardeio abstrato antigo); true se a ordem foi tratada (inclusive quando todas as peças estão silenciadas). */
function mission(team,x,y,count,spread,kind,cb=false,strict=false){
 if(!active)return false;
 const ready=B.filter(b=>b.team===team&&operational(b));
 if(strict){
  if(kind!=='smoke')return false;
  const capacity=b=>Math.max(0,Math.min(b.ammo-b.queue.filter(j=>j.real).length,
   b.sp.smoke-b.queue.filter(j=>j.kind==='smoke').length-(b.tgt?.kind==='smoke'&&b.ph!==null&&b.ph<3?1:0)));
  const available=ready.filter(b=>capacity(b)>0&&time>=b.shelter);
  if(available.reduce((n,b)=>n+capacity(b),0)<count)return false;
  for(let k=0;k<count;k++){
   const b=available.filter(b=>capacity(b)>0).sort((a,b)=>a.queue.length-b.queue.length)[0];
   b.queue.push({x:x+rnd(-spread,spread),y:y+rnd(-spread,spread),at:time+1+k*.25,real:true,kind:'smoke',cb:false});
  }
  return true;
 }
 if(!kind)kind=cmdKind[team]||'he';
 if(!ready.length){if(!cb&&typeof sandbox!=='undefined'&&!sandbox&&typeof defs!=='undefined'&&defs.artillery){supplies[team]+=defs.artillery.cost}
  if(team===playerTeam&&typeof toast==='function')toast('Nenhuma bateria operacional: guarnições eliminadas ou sem munição. Custo devolvido.');return true}
 ready.sort((a,b)=>a.queue.length-b.queue.length||(a.ph?1:0)-(b.ph?1:0));
 if(kind==='auto')kind=openInfantry(team,x,y)>=4&&Math.random()<.5?'shrap':'he';   // a IA escolhe shrapnel contra infantaria a descoberto
 const line=rnd(.7,1.2);   // tempo até o comando chegar às peças por telefone de campanha
 for(let k=0;k<count;k++){const b=ready[k%ready.length];
  b.queue.push({x:x+rnd(-spread,spread),y:y+rnd(-spread,spread),at:time+line+rnd(0,.35)+Math.floor(k/ready.length)*.2,real:true,kind:kind!=='he'&&b.sp[kind]<=0?'he':kind,cb})}
 return true}

function openInfantry(team,x,y){if(typeof units==='undefined'||typeof protectedBy!=='function')return 0;let n=0;for(const u of units)if(u.team!==team&&u.type!=='tank'&&Math.abs(u.x-x)<120&&Math.abs(u.y-y)<120&&protectedBy(u)>.6)n++;return n}
function startCycle(b,job){b.tgt=job;b.ph=0;b.t=0;if(job.real)b.ammo--;const a=Math.atan2(job.y-b.cy*2,job.x-b.cx*2);b.aimA=a}
/* 1.9 (pesados): recuo hidropneumático — o tubo sai de uma vez (≈1,4 quadros) e volta devagar ao bater em bateria; o carro dá um tranco de 1 px.
   Vale para o desenho (drawGun) e para a conta de quadros nos testes. t = segundos desde o disparo (b.shotT). */
const RC_OUT=.045,RC_END=.75;
function recoilOf(b){const t=b.shotT;if(!(t<RC_END))return 0;const pk=b.big?8:6;return pk*(t<RC_OUT?t/RC_OUT:Math.exp(-(t-RC_OUT)*4.6))}
/* só gasta partícula extra se a peça está perto da tela (o jogo tem até 20 peças atirando ao mesmo tempo) */
function nearView(wx,wy){if(typeof cam==='undefined'||typeof vw==='undefined')return true;const z=PX.Z||.5;return Math.abs(wx-cam.x)<vw/z*.5+200&&Math.abs(wy-cam.y)<vh/z*.5+200}
function fireShot(b){
 const job=b.tgt,cfg=b.cfg,mxw=b.mx*2,myw=b.my*2;
 b.recoil=cfg===CYC.h?8:6;b.shotT=0;
 flashes.push({x:b.mx,y:b.my,dir:b.d,t:0,max:.16,big:b.big});
 if(nearView(mxw,myw)){const ca=Math.cos(b.ang||0),sa=Math.sin(b.ang||0),nx=-sa,ny=ca,gx=b.mx+ca*3,gy=b.my+5;
  /* onda de choque no chão em frente à boca (anel de poeira) e leque de terra levantada na direção do tiro */
  parts.push({x:gx+ca*3,y:gy,vx:0,vy:0,t:0,max:b.big?.46:.36,size:b.big?17:12,k:'ring'});
  const nd=b.big?9:6;for(let i=0;i<nd;i++){const sp=rnd(14,40),sd=rnd(-1,1);parts.push({x:gx+rnd(-2,2),y:gy+rnd(-1,1),vx:ca*sp*.7+nx*sd*sp*.9,vy:(sa*sp*.7+ny*sd*sp*.9)*.55-rnd(0,6),t:0,max:rnd(.5,1.1),size:rnd(2,3.8),k:'dust'})}
  /* freio de boca do obuseiro: duas golfadas laterais */
  if(b.big)for(const sg of[-1,1])parts.push({x:b.mx-ca*5,y:b.my-sa*5,vx:nx*sg*rnd(14,22)+ca*4,vy:ny*sg*rnd(14,22)*.6+sa*4,t:0,max:rnd(.5,.9),size:rnd(3,4.4),k:'gun'});
  /* o cano continua a fumar: sopros finos (ver tickBattery) */
  b.wisp=1.7}
 const n=b.big?7:5;
 for(let i=0;i<n;i++)parts.push({x:b.mx+b.d*rnd(0,6),y:b.my+rnd(-2,2),vx:b.d*rnd(6,20),vy:-rnd(2,8),t:0,max:rnd(1.4,2.4),size:b.big?rnd(3.4,5):rnd(2.4,3.8),k:'gun'});
 /* anel de poeira do choque no chão, em volta das rodas e do anel de sacos */
 const ring=b.big?14:11;for(let i=0;i<12;i++){const a=i/12*6.283;parts.push({x:b.cx+Math.cos(a)*4,y:b.cy+3+Math.sin(a)*2,vx:Math.cos(a)*ring*rnd(.8,1.3),vy:Math.sin(a)*ring*.45*rnd(.8,1.3),t:0,max:rnd(.6,1.1),size:rnd(2,3.6),k:'dust'})}
 casings.push({x:b.cx-b.d*6,y:b.cy+6,z:0,vx:-b.d*rnd(8,14),vy:rnd(2,8),vz:rnd(26,38),t:0,ph:b.big?1:0,wait:cfg.recoil+.05,life:40,landed:false});
 if(casings.length>40)casings.shift();
 if(job.real){const d0=Math.hypot(job.x-mxw,job.y-myw),ft=flightTime(d0,b.big),kind=job.kind||'he';
  if(kind!=='he')b.sp[kind]=Math.max(0,b.sp[kind]-1);
  const r=kind==='shrap'?Math.round(cfg.r*1.15):kind==='smoke'?58:cfg.r,power=kind==='shrap'?Math.round(cfg.power*.6):kind==='smoke'?0:cfg.power;
  shells.push({x:job.x,y:job.y,t:ft,r,power,team:b.team,bat:true,kind,man:!!job.manual,ox:mxw,oy:myw,T:ft,big:b.big});   // ox/oy/T/big: origem e duração para o arco em heavyfx.js
  if(!job.cb){cbHeat[b.team]+=b.big?1.4:1;b.hot=time}}
 gunSound(mxw,myw,b.big)}

/* ---------- som ---------- */
function gunSound(wx,wy,big){if(typeof soundOn==='undefined'||!soundOn||typeof audio==='undefined'||!audio)return;
 const d=Math.hypot(wx-cam.x,wy-cam.y);if(d>2600)return;
 snd.push({t:Math.min(d/SOUND_V,5),k:'shot',vol:clamp(1.15-d/2200,.12,1),big})}
function playShot(vol,big){try{const a=audio,now=a.currentTime,dur=big?1.1:.8,len=Math.ceil(a.sampleRate*dur),buf=a.createBuffer(1,len,a.sampleRate),dt=buf.getChannelData(0);
 for(let i=0;i<len;i++)dt[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.2);
 const src=a.createBufferSource(),lp=a.createBiquadFilter(),g=a.createGain();src.buffer=buf;lp.type='lowpass';lp.frequency.value=big?140:180;g.gain.value=.3*vol;src.connect(lp);lp.connect(g);g.connect(a.destination);src.start();src.stop(now+dur);
 /* estalo estridente do ar comprimido */
 const len2=Math.ceil(a.sampleRate*.07),b2=a.createBuffer(1,len2,a.sampleRate),d2=b2.getChannelData(0);for(let i=0;i<len2;i++)d2[i]=(Math.random()*2-1)*Math.pow(1-i/len2,3);
 const s2=a.createBufferSource(),hp=a.createBiquadFilter(),g2=a.createGain();s2.buffer=b2;hp.type='highpass';hp.frequency.value=1600;g2.gain.value=.12*vol;s2.connect(hp);hp.connect(g2);g2.connect(a.destination);s2.start();s2.stop(now+.07)}catch{}}
function playWhistle(vol){try{const a=audio,now=a.currentTime,o=a.createOscillator(),g=a.createGain(),f=a.createBiquadFilter();
 o.type='sawtooth';o.frequency.setValueAtTime(2300,now);o.frequency.exponentialRampToValueAtTime(820,now+1.15);f.type='bandpass';f.frequency.value=1500;f.Q.value=2.2;
 g.gain.setValueAtTime(.001,now);g.gain.linearRampToValueAtTime(.05*vol,now+.35);g.gain.linearRampToValueAtTime(.085*vol,now+1.1);g.gain.exponentialRampToValueAtTime(.001,now+1.25);
 o.connect(f);f.connect(g);g.connect(a.destination);o.start();o.stop(now+1.3)}catch{}}
function playTink(vol){try{const a=audio,now=a.currentTime,o=a.createOscillator(),g=a.createGain();o.type='triangle';o.frequency.setValueAtTime(3100,now);o.frequency.exponentialRampToValueAtTime(1900,now+.12);
 g.gain.setValueAtTime(.04*vol,now);g.gain.exponentialRampToValueAtTime(.001,now+.14);o.connect(g);g.connect(a.destination);o.start();o.stop(now+.14)}catch{}}

/* ---------- simulação ---------- */
function crewMove(b,dt){
 /* cada servidor anda até seu posto; o portador vai da pilha de projéteis ao municiador durante o municiamento */
 const ph=b.ph!==null?PHASES[b.ph]:'',p=b.t/(b.cfg[ph]||1);
 const hid=time<b.shelter;
 for(const c of b.crew){if(!c.alive)continue;let tx=c.hx,ty=c.hy;
  if(hid){tx=b.cx-b.d*(8+b.crew.indexOf(c)*3);ty=b.cy+30}
  else if(c.role==='carrier'){
   const L=b.crew[1],fromX=c.px,fromY=c.py,toX=L.hx-b.d*4,toY=L.hy-3;
   if(ph==='load'){const k=clamp(p*1.6,0,1);tx=fromX+(toX-fromX)*k;ty=fromY+(toY-fromY)*k}
   else if(ph==='aim'){tx=fromX;ty=fromY}
   else if(ph==='ready'||ph==='fire'||ph==='recoil'){tx=toX;ty=toY}}
  c.x+=(tx-c.x)*Math.min(1,dt*9);c.y+=(ty-c.y)*Math.min(1,dt*9)}}
function tickBattery(b,dt){
 const n=alive(b),man=!!G&&G.b===b,can=n>0||man,f=n>0?crewRate(n):man?.3:0,hid=time<b.shelter;b.recoil=Math.max(0,b.recoil-dt*(b.cfg===CYC.h?20:15));b.shotT+=dt;
 if(b.live&&b.aimA!==undefined){const base=b.d>0?0:Math.PI,want=clamp(angDiff(b.aimA,base),-.6,.6);b.off+=(want-b.off)*Math.min(1,dt*(man?9:3.5));b.ang=base+b.off;tubeTip(b)}
 if(b.wisp>0){b.wisp-=dt;if(Math.random()<dt*7)parts.push({x:b.mx+rnd(-1,1),y:b.my+rnd(-1,1),vx:rnd(-3,3)+b.d*2,vy:-rnd(5,11),t:0,max:rnd(.9,1.5),size:rnd(1.4,2.4),k:'smoke'})}
 b.spT+=dt;if(b.spT>50){b.spT=0;if(n>0&&!DEP[b.team].dead){const mx=b.big?[5,3]:[8,4];if(b.sp.shrap<mx[0])b.sp.shrap++;if(b.sp.smoke<mx[1])b.sp.smoke++}}
 if(b.ph===null){
  b.cool=Math.max(0,b.cool-dt);
  if(can&&f>0&&!hid&&b.cool<=0&&b.queue.length&&b.queue[0].at<=time&&b.ammo>0)startCycle(b,b.queue.shift());
  else if(!can)b.queue.length=0;
 }else if(hid&&!man&&b.ph<3){   // obus a caminho: a guarnição larga a peça e corre para o abrigo
  const j=b.tgt;if(j&&j.real)b.ammo++;if(j&&j.real&&!j.hold)b.queue.unshift(j);b.ph=null;b.tgt=null;b.t=0;
 }else{
  const name=PHASES[b.ph],dur=b.cfg[name]/(name==='fire'||name==='recoil'?1:Math.max(f,.2));
  b.t+=dt;
  if(b.t>=dur&&b.tgt&&b.tgt.hold&&!b.tgt.go&&PHASES[b.ph]==='ready')b.t=dur;     // peça carregada, cordel esticado: espera o disparo do jogador
  else if(b.t>=dur){b.ph++;b.t=0;
   if(b.ph>=PHASES.length){b.ph=null;b.tgt=null;b.cool=Math.max(0,b.cfg.total-(b.cfg.aim+b.cfg.load+b.cfg.ready+b.cfg.fire+b.cfg.recoil+b.cfg.eject))/Math.max(f,.2)}
   else if(PHASES[b.ph]==='fire')fireShot(b)
   else if(PHASES[b.ph]==='eject'&&b.live&&nearView(b.cx*2,b.cy*2)){   // culatra aberta: sopro de gás e fumaça saindo pela traseira
    const ca=Math.cos(b.ang),sa=Math.sin(b.ang);for(let i=0;i<(b.big?4:3);i++)parts.push({x:b.pvx-ca*3+rnd(-1,1),y:b.pvy-sa*3-1+rnd(-1,1),vx:-ca*rnd(3,9)+rnd(-3,3),vy:-rnd(4,10),t:0,max:rnd(.9,1.6),size:rnd(2,3.2),k:'gun'})}}}
 crewMove(b,dt)}
function tick(dt){
 if(!active)return;
 for(const b of B)tickBattery(b,dt);
 /* tiros de hostilização: uma peça dispara sem alvo de verdade, só para manter a frente barulhenta */
 if(typeof started!=='undefined'&&started){harass-=dt;if(harass<=0){harass=rnd(5,12);
  const ok=B.filter(b=>operational(b)&&b.ph===null&&!b.queue.length&&b.cool<=0);if(ok.length){const b=ok[Math.floor(Math.random()*ok.length)];b.queue.push({x:0,y:0,at:time,real:false})}}}
 /* assobio de aproximação ≈1,2 s antes do impacto */
 for(const s of shells){if(!s.bat||s.wh||s.t>1.2)continue;s.wh=1;
  if(typeof soundOn!=='undefined'&&soundOn&&audio){const d=Math.hypot(s.x-cam.x,s.y-cam.y);if(d<1700)playWhistle(clamp(1.1-d/1700,.15,1))}}
 /* som com atraso acústico */
 for(let i=snd.length-1;i>=0;i--){const s=snd[i];s.t-=dt;if(s.t<=0){if(typeof soundOn!=='undefined'&&soundOn&&audio)playShot(s.vol,s.big);snd.splice(i,1)}}

 counterBattery(dt);tickSmoke(dt);alertCrews();crewHits(dt);reinforce(dt);logistics(dt);
 /* partículas, clarões e cápsulas */
 for(const p of parts){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.985;p.vy*=.99;p.t+=dt}
 for(let i=parts.length-1;i>=0;i--)if(parts[i].t>=parts[i].max){parts[i]=parts[parts.length-1];parts.pop()}
 if(parts.length>320)parts.splice(0,parts.length-320);
 for(const f of flashes)f.t+=dt;for(let i=flashes.length-1;i>=0;i--)if(flashes[i].t>=flashes[i].max)flashes.splice(i,1);
 for(let i=casings.length-1;i>=0;i--){const c=casings[i];
  if(c.wait>0){c.wait-=dt;continue}
  if(!c.landed){c.x+=c.vx*dt;c.y+=c.vy*dt;c.z+=c.vz*dt;c.vz-=150*dt;c.vx*=.99;
   if(c.z<=0){c.z=0;if(Math.abs(c.vz)>22){c.vz=-c.vz*.35;c.vx*=.5;c.vy*=.5;tink(c)}else{c.landed=true;c.vz=0;tink(c)}}
   if(c.ph===0&&Math.random()<dt*10)parts.push({x:c.x,y:c.y-c.z,vx:rnd(-2,2),vy:-rnd(6,12),t:0,max:rnd(.8,1.4),size:rnd(1.2,2),k:'smoke'})}
  else{c.life-=dt;if(c.life<=0)casings.splice(i,1)}}}
function tink(c){if(typeof soundOn==='undefined'||!soundOn||!audio)return;const d=Math.hypot(c.x*2-cam.x,c.y*2-cam.y);if(d<500)playTink(clamp(1-d/500,.1,1))}

/* ---------- abrigo, balas perdidas, reposição de guarnição ---------- */
/* assobio de obus inimigo a caminho da bateria: a guarnição corre para o abrigo (crewHut) e leva bem menos dano */
function alertCrews(){if(typeof shells==='undefined'||!shells.length)return;
 for(const s of shells){if(s.t<=0||s.t>1.6||s.gren||s.power===0&&s.kind!=='smoke')continue;
  for(const b of B){if(s.team===b.team||time<b.shelter-s.t)continue;if(Math.hypot(s.x-b.cx*2,s.y-b.cy*2)<s.r+70)b.shelter=Math.max(b.shelter,time+s.t+1.3)}}}
function hurtCrew(b,c,n){if(!c.alive)return;c.hp-=n;
 if(c.hp<=0){c.alive=false;c.dead=true;
  if(b.team===playerTeam&&time-lostToast>6&&typeof toast==='function'){lostToast=time;toast(alive(b)?'Artilheiro aliado caiu! A bateria perdeu cadência.':'Bateria aliada silenciada: guarnição eliminada. Mande um fuzileiro assumir a peça.')}}}
/* metralhamento de caças e tiros perdidos atingem os servidores ao ar livre; cavalaria inimiga os atropela/sabra */
function crewHits(dt){if(typeof bullets==='undefined')return;
 for(const b of B){const bx=b.cx*2,by=b.cy*2,k=time<b.shelter?.25:1;
  for(const bu of bullets){if(!(bu.damage>0)||bu.team===b.team||bu.t<=0||Math.abs(bu.x-bx)>60||Math.abs(bu.y-by)>60)continue;
   for(const c of b.crew)if(c.alive&&Math.abs(bu.x-c.x*2)<6&&Math.abs(bu.y-c.y*2)<6){hurtCrew(b,c,bu.damage*k);bu.t=0;break}}
  if(typeof units!=='undefined')for(const u of units){if(u.team===b.team||u.type!=='cavalry'||u.hp<=0||Math.abs(u.x-bx)>50||Math.abs(u.y-by)>50)continue;
   for(const c of b.crew)if(c.alive&&Math.hypot(u.x-c.x*2,u.y-c.y*2)<16)hurtCrew(b,c,70*dt*k)}}}
/* um fuzileiro aliado parado junto a uma peça com baixas assume o posto vago; a IA manda reservistas para as peças silenciadas */
function reinforce(dt){if(typeof units==='undefined')return;
 for(const b of B){if(alive(b)>=4)continue;const bx=b.cx*2,by=b.cy*2;
  for(const u of units){if(u.team!==b.team||u.type!=='rifle'||u.hp<=0||u===player)continue;
   if(Math.abs(u.x-bx)>64||Math.abs(u.y-by)>64||Math.hypot(u.x-bx,u.y-by)>60)continue;
   if(time-(u._bs||-9)>.3||Math.hypot(u.x-u._ax,u.y-u._ay)>25){u._bt=0;u._ax=u.x;u._ay=u.y}     // parado (±25) junto à peça; zera se saiu e voltou
   u._bs=time;u._bt=(u._bt||0)+dt;
   if(u._bt>=2.5){const c=b.crew.find(x=>!x.alive);if(!c)break;
    c.alive=true;c.dead=false;c.hp=100;c.x=u.x/2;c.y=u.y/2;u.hp=0;u._bt=0;       // o soldado vira servidor de peça
    if(b.team===playerTeam&&typeof toast==='function')toast('Fuzileiro assumiu um posto na bateria ('+alive(b)+'/4).');break}}}
 for(const t of[0,1]){rfT[t]-=dt;if(rfT[t]>0||typeof aiEnabled==='undefined'||!aiEnabled[t])continue;rfT[t]=9;
  const need=B.filter(b=>b.team===t&&alive(b)<4);if(!need.length||units.filter(u=>u.team===t).length<24)continue;
  need.sort((a,b)=>alive(a)-alive(b));const b=need[0],bx=b.cx*2,by=b.cy*2;let best=null,bd=1e9;
  for(const u of units){if(u.team!==t||u.type!=='rifle'||u.hp<=0||u===player||u.manualUntil>time)continue;const d=Math.hypot(u.x-bx,u.y-by);if(d<bd&&d<900){bd=d;best=u}}
  if(best){best.tx=bx-b.d*34;best.ty=by+18;best.order='move';best.manualUntil=time+16;best.aiRole='artilheiro';best.target=null}}}
const rfT=[4,7];

/* ---------- logística: depósito de munição e bonde Decauville ---------- */
/* o bonde sai do depósito, segue o trilho principal (x=124) e o ramal de cada peça, entrega projéteis e volta. Sem depósito, sem reposição. */
function wagonPath(team,b,PW){const X=x=>team?PW-x:x;return[[X(99),154],[X(124),154],[X(124),b.cy],[X(b.gx-b.ri-6),b.cy]]}
function logistics(dt){
 for(const d of DEP)if(d.dead&&Math.random()<dt*7)parts.push({x:d.x+rnd(-7,7),y:d.y-4+rnd(-4,3),vx:rnd(-2,2)+4,vy:-rnd(10,20),t:0,max:rnd(2,3.4),size:rnd(3,5.5),k:'black'});
 for(const w of WG){
  if(w.st==='idle'){w.chk-=dt;if(w.chk>0||DEP[w.team].dead)continue;w.chk=1.5;
   let pick=null,r=2;for(const b of B)if(b.team===w.team&&alive(b)>0){const q=b.ammo/b.cfg.ammo;if(q<r&&q<.75){r=q;pick=b}}
   if(pick){w.b=pick;w.pts=wagonPath(w.team,pick,PX.WW1.PW);w.i=1;w.x=w.pts[0][0];w.y=w.pts[0][1];w.st='out'}
   continue}
  const tgt=w.pts[w.i];let dx=tgt[0]-w.x,dy=tgt[1]-w.y,l=Math.hypot(dx,dy),step=44*dt;
  w.hor=Math.abs(dx)>Math.abs(dy);
  if(l<=step){w.x=tgt[0];w.y=tgt[1];
   if(w.st==='out'){if(++w.i>=w.pts.length){const b=w.b;b.ammo=Math.min(b.cfg.ammo,b.ammo+(b.big?8:12));if(b.sp.shrap<(b.big?5:8))b.sp.shrap++;if(b.sp.smoke<(b.big?3:4))b.sp.smoke++;w.pts=w.pts.slice().reverse();w.i=1;w.st='back'}}
   else if(++w.i>=w.pts.length){w.st='idle';w.chk=2}}
  else{w.x+=dx/l*step;w.y+=dy/l*step}}}
function hitDepot(x,y,r,power){for(const d of DEP){if(d.dead)continue;const dd=Math.hypot(d.x*2-x,d.y*2-y),rr=r+34;if(dd>=rr)continue;
  d.hp-=power*1.7*(1-dd/rr);
  if(d.hp<=0){d.dead=true;parts.push({x:d.x,y:d.y,vx:0,vy:0,t:0,max:.3,size:16,k:'burst'});
   if(typeof toast==='function')toast(d.team===playerTeam?'Depósito de munição aliado destruído! As baterias só terão o que já está nos paióis.':'Depósito de munição inimigo destruído!')}}}

/* ---------- fase E: shrapnel e fumaça ---------- */
function nearFx(wx,wy,shake,snd){if(typeof cam==='undefined')return;const d=Math.hypot(wx-cam.x,wy-cam.y);
 if(d<520){if(typeof screenShake!=='undefined')screenShake=Math.max(screenShake,shake);if(snd&&typeof sound==='function')sound(snd)}}
/* chamado pelo laço de projéteis do jogo; devolve true se o tipo trata a própria detonação (HE cai no explode padrão) */
function detonate(s){
 if(s.kind==='shrap'){
  const ax=s.x/2,ay=s.y/2-10;    // estoura ≈8 m acima do chão: sem cratera, chuva de esferas de chumbo em cone
  if(typeof units!=='undefined'&&typeof damage==='function')for(const u of units){const d=Math.hypot(u.x-s.x,u.y-s.y);if(d>=s.r)continue;
   const pb=typeof protectedBy==='function'?protectedBy(u):1,k=u.type==='tank'?.04:pb<=.36?.08:pb<1?.55:1;   // trincheira e bunker quase anulam
   damage(u,s.power*Math.sqrt(1-d/s.r)*k*rnd(.7,1.15),s.team)}
  blast(s.x,s.y,s.r*.8,s.power*.6);
  parts.push({x:ax,y:ay,vx:0,vy:0,t:0,max:.14,size:9,k:'burst'});
  for(let i=0;i<5;i++)parts.push({x:ax+rnd(-3,3),y:ay+rnd(-2,2),vx:rnd(-5,5),vy:rnd(-3,1),t:0,max:rnd(1.2,2),size:rnd(3,5),k:'gun'});
  for(let i=0;i<26;i++)parts.push({x:ax+rnd(-3,3),y:ay,vx:rnd(-30,30),vy:rnd(28,70),t:0,max:rnd(.25,.5),size:1,k:'spark'});
  for(let i=0;i<10;i++){const a=rnd(0,6.283),rr=Math.sqrt(Math.random())*s.r*.4;parts.push({x:s.x/2+Math.cos(a)*rr,y:s.y/2+Math.sin(a)*rr*.6,vx:rnd(-4,4),vy:-rnd(1,5),t:0,max:rnd(.4,.8),size:rnd(1.6,2.6),k:'dust'})}
  nearFx(s.x,s.y,1.6,'boom');return true}
 if(s.kind==='smoke'){for(let i=0;i<3;i++)addSmoke(s.x+rnd(-42,42),s.y+rnd(-30,30),s.team);
  if(smokes.length>24)smokes.splice(0,smokes.length-24);
  nearFx(s.x,s.y,.6,null);if(typeof soundOn!=='undefined'&&soundOn&&audio&&Math.hypot(s.x-cam.x,s.y-cam.y)<900)playShot(.25,false);return true}
 return false}
function addSmoke(x,y,team){const pf=[];for(let i=0;i<7;i++)pf.push({a:rnd(0,6.283),d:Math.sqrt(Math.random()),s:rnd(.45,.8)});smokes.push({x,y,team,r:12,rmax:rnd(52,66),t:0,max:34,pf})}
const smokeA=c=>Math.min(1,c.t/1.5)*Math.min(1,(c.max-c.t)/8);
function tickSmoke(dt){if(!smokes.length)return;const wv=window.PXW&&PXW.windVec?PXW.windVec():{x:0,y:0};
 for(let i=smokes.length-1;i>=0;i--){const c=smokes[i];c.t+=dt;c.r+=(c.rmax-c.r)*Math.min(1,dt*.7);c.x+=wv.x*dt*.18;c.y+=wv.y*dt*.18;if(c.t>=c.max)smokes.splice(i,1)}}
/* a cortina impede o tiro direto: um tiro de IA cujo caminho cruza fumaça densa erra em 3 de 4 casos (ver shoot() em game.js) */
function smokeBlocks(u,t){if(!smokes.length)return false;const dx=t.x-u.x,dy=t.y-u.y,l2=dx*dx+dy*dy||1;
 for(const c of smokes){if(smokeA(c)<.35)continue;const k=clamp(((c.x-u.x)*dx+(c.y-u.y)*dy)/l2,0,1),px=u.x+dx*k-c.x,py=u.y+dy*k-c.y;if(px*px+py*py<c.r*c.r*.6)return true}return false}

/* ---------- contra-bateria ---------- */
/* quem atira muito é localizado pelos postos de observação: a IA inimiga responde sobre a peça mais quente e a guarnição corre para o abrigo */
function counterBattery(dt){
 if(typeof started==='undefined'||!started||typeof aiEnabled==='undefined')return;
 for(const t of[0,1]){cbHeat[t]=Math.max(0,cbHeat[t]-dt*.12);
  if(cbHeat[t]<5||time<cbCool[t]||!aiEnabled[1-t])continue;
  let hot=null;for(const b of B)if(b.team===t&&time-b.hot<40&&(!hot||b.hot>hot.hot))hot=b;
  if(!hot){cbHeat[t]=0;continue}
  if(!mission(1-t,hot.cx*2,hot.cy*2,4,55,'he',true)){cbCool[t]=time+15;continue}
  cbCool[t]=time+45;cbHeat[t]=1.5;hot.shelter=time+9;
  if(G&&G.b===hot)G.warn=time+9;
  if(t===playerTeam&&typeof toast==='function'&&time-cbToast>8){cbToast=time;toast('CONTRA-BATERIA! O inimigo localizou a peça — artilheiros, abriguem-se!')}}}

/* ---------- fase D: operação manual (tecla E no modo soldado) ---------- */
function manning(){if(!G)return false;
 if(!active||typeof mode==='undefined'||mode!=='soldier'||typeof player==='undefined'||player!==G.u||G.u.hp<=0){release();return false}return true}
function release(msg){if(!G)return;const b=G.b,j=b.tgt;
 if(j&&j.hold&&!j.go&&b.ph!==null&&b.ph<3){b.ammo++;b.ph=null;b.tgt=null;b.t=0}    // devolve o projétil ao paiol se ninguém disparou
 else if(j&&j.hold)j.hold=false;
 G=null;if(msg&&typeof toast==='function')toast(msg)}
function take(u){
 if(!active||G||!u||u.type==='tank')return false;
 let best=null,bd=120;for(const b of B){if(b.team!==playerTeam)continue;const d=Math.hypot(u.x-b.cx*2,u.y-b.cy*2);if(d<bd){bd=d;best=b}}
 if(!best)return false;
 const rg=RANGE[best.big?'h':'f'];
 G={b:best,u,ax:best.mx*2+best.d*Math.min(700,rg.max*.5),ay:best.my*2,kind:'he',lock:true,warn:0,lim:null};
 toast(alive(best)?'Você assumiu o canhão. WASD move o retículo · clique dispara · 1/2/3 munição · E sai.':'Guarnição eliminada: você opera sozinho, com cadência reduzida.');
 return true}
function fireNow(){const b=G.b,j=b.tgt;
 if(!j||!j.hold){toast(b.ammo<=0?'Sem projéteis no paiol desta peça!':'Peça ainda se preparando…');return}
 if(b.ph!==2){toast(b.ph<2?'Municiando… aguarde a peça ficar pronta.':'Peça em recuo.');return}
 if(j.go)return;
 if(G.kind!=='he'&&b.sp[G.kind]<=0){toast('Sem '+KNAME[G.kind].toLowerCase()+' nesta peça.');return}
 const d=Math.hypot(G.ax-b.mx*2,G.ay-b.my*2),sp=d*.022+4;
 j.x=G.ax+rnd(-sp,sp);j.y=G.ay+rnd(-sp,sp);j.kind=G.kind;j.manual=true;j.go=true}
function manTick(dt,u){
 const b=G.b,rg=RANGE[b.big?'h':'f'],mxw=b.mx*2,myw=b.my*2;
 const tx=b.cx*2-b.d*38,ty=b.cy*2+26;u.x+=(tx-u.x)*Math.min(1,dt*6);u.y+=(ty-u.y)*Math.min(1,dt*6);u.moving=false;
 const sp=(keys.Shift?640:260)*dt,dx=(keys.d||keys.ArrowRight?1:0)-(keys.a||keys.ArrowLeft?1:0),dy=(keys.s||keys.ArrowDown?1:0)-(keys.w||keys.ArrowUp?1:0);
 G.ax=clamp(G.ax+dx*sp,20,W-20);G.ay=clamp(G.ay+dy*sp,20,H-20);
 const vx=G.ax-mxw,vy=G.ay-myw,d=Math.hypot(vx,vy)||1;G.lim=d>rg.max?'max':d<rg.min?'min':null;
 if(G.lim){const k=(G.lim==='max'?rg.max:rg.min)/d;G.ax=mxw+vx*k;G.ay=myw+vy*k}
 u.angle=Math.atan2(G.ay-u.y,G.ax-u.x);b.aimA=Math.atan2(G.ay-myw,G.ax-mxw);
 cam.x+=(G.ax-cam.x)*Math.min(1,dt*4);cam.y+=(G.ay-cam.y)*Math.min(1,dt*4);
 /* o municiador já deixa a peça carregada e com o cordel esticado; o jogador só escolhe o momento */
 if(b.ph===null&&b.cool<=0&&b.ammo>0&&!b.queue.length)startCycle(b,{hold:true,real:true,x:G.ax,y:G.ay,kind:G.kind});
 if(mouse.down){if(!G.lock){G.lock=true;fireNow()}}else G.lock=false}
function key(k){const l=k.length===1?k.toLowerCase():k;
 if(l==='e'){release('Você deixou o canhão.');return true}
 if(l==='1'||l==='2'||l==='3'){const kind=KINDS[+l-1];G.kind=kind;toast('Munição: '+KNAME[kind]+(kind==='he'?'':' ('+G.b.sp[kind]+' restantes)'));return true}
 if(l==='r'){toast('O municiador recarrega sozinho — espere a peça ficar PRONTA.');return true}
 return l==='g'||l==='f'||l==='c'}

/* ---------- desenho em tela: fumaça e HUD óptico ---------- */
const PHN=['APONTANDO','MUNICIANDO','PRONTA — FOGO!','DISPARO','RECUO','EJETANDO CÁPSULA'];
function txt(c,s,x,y,col,al){c.textAlign=al||'left';c.fillStyle='#000';c.fillText(s,x+1,y+1);c.fillStyle=col;c.fillText(s,x,y)}
function drawSmokeScreen(c){
 const Z=PX.Z,ox=Math.round(vw/2-cam.x*Z),oy=Math.round(vh/2-cam.y*Z);
 for(const s of smokes){const a=smokeA(s);if(a<=.02)continue;const x=ox+Math.round(s.x*Z),y=oy+Math.round(s.y*Z),R=s.r*Z;if(!onScreen(x,y,R+16,vw,vh))continue;
  for(const p of s.pf){const px=Math.round(x+Math.cos(p.a)*p.d*R*.7),py=Math.round(y+Math.sin(p.a)*p.d*R*.5),pr=Math.max(2,Math.round(R*p.s));
   c.globalAlpha=.42*a;PX.disc(c,px,py,pr,'#cfcec6');c.globalAlpha=.3*a;PX.disc(c,px-1,py-1,Math.max(1,Math.round(pr*.6)),'#ecebe3')}}
 c.globalAlpha=1}
/* alvo marcado assim que a ordem sai (antes de a peça atirar); depois o projétil em voo usa a marca do próprio jogo */
function drawMarkers(c){const Z=PX.Z,ox=Math.round(vw/2-cam.x*Z),oy=Math.round(vh/2-cam.y*Z);
 c.save();c.lineWidth=1;c.setLineDash([3,3]);
 for(const b of B){const own=b.team===playerTeam,one=j=>{if(!j||!j.real||j.hold)return;
   const x=ox+Math.round(j.x*Z),y=oy+Math.round(j.y*Z),r=Math.max(3,Math.round((j.kind==='smoke'?58:j.kind==='shrap'?b.cfg.r*1.15:b.cfg.r)*Z*(.92+Math.sin(time*5)*.05)));
   if(!onScreen(x,y,r+4,vw,vh))return;c.strokeStyle=own?'rgba(157,216,106,.8)':'rgba(255,179,71,.9)';c.beginPath();c.arc(x,y,r,0,6.283);c.stroke()};
  if(b.ph!==null&&b.ph<3)one(b.tgt);for(const j of b.queue)one(j)}
 c.setLineDash([]);
 if(typeof mode!=='undefined'&&mode==='commander'&&placement==='artillery'){c.font='bold 7px monospace';c.textAlign='center';const s='MUNIÇÃO [T]: '+KNAME[cmdKind[playerTeam]];c.fillStyle='#000';c.fillText(s,vw/2+1,vh-15);c.fillStyle='#f4e7b0';c.fillText(s,vw/2,vh-16)}
 c.restore()}

function hudDraw(){
 const c=ctx;if(!c||!active)return;
 drawSmokeScreen(c);drawMarkers(c);
 const u=clamp(Math.round(vw/640),1,3);   // o HUD acompanha o tamanho do canvas
 c.save();c.scale(u,u);hudBody(c,vw/u,vh/u,u);c.restore()}
function hudBody(c,vw,vh,u){
 c.save();c.font='bold 7px monospace';c.textBaseline='alphabetic';
 if(!manning()){
  if(typeof mode!=='undefined'&&mode==='soldier'&&typeof player!=='undefined'&&player&&player.type!=='tank'&&started){
   for(const b of B)if(b.team===playerTeam&&Math.hypot(player.x-b.cx*2,player.y-b.cy*2)<120){txt(c,'[E] ASSUMIR O CANHÃO',vw/2,vh-14,'#f4e7b0','center');break}}
  c.restore();return}
 const Z=PX.Z,ox=Math.round(vw*u/2-cam.x*Z),oy=Math.round(vh*u/2-cam.y*Z),sx=x=>(ox+Math.round(x*Z))/u,sy=y=>(oy+Math.round(y*Z))/u;
 const b=G.b,mxw=b.mx*2,myw=b.my*2,dxm=G.ax-mxw,dym=G.ay-myw,dist=Math.hypot(dxm,dym),ready=b.ph===2,noAmmo=b.ph===null&&b.ammo<=0;
 const col=noAmmo?'#ff6b5e':ready?'#9dff8a':'#ffd166',rad=G.kind==='shrap'?b.cfg.r*1.15:G.kind==='smoke'?58:b.cfg.r,R=Math.max(3,Math.round(rad*Z/u));
 /* linha de tiro do cano ao retículo */
 c.strokeStyle='rgba(255,240,180,.35)';c.lineWidth=1;c.setLineDash([2,3]);c.beginPath();c.moveTo(sx(mxw),sy(myw));c.lineTo(sx(G.ax),sy(G.ay));c.stroke();c.setLineDash([]);
 /* retículo: círculo da área atingida + cruz de goniômetro */
 const rx=sx(G.ax),ry=sy(G.ay);c.strokeStyle=col;c.lineWidth=1;c.beginPath();c.arc(rx,ry,R,0,6.283);c.stroke();
 c.beginPath();c.moveTo(rx-R-4,ry);c.lineTo(rx-3,ry);c.moveTo(rx+3,ry);c.lineTo(rx+R+4,ry);c.moveTo(rx,ry-R-4);c.lineTo(rx,ry-3);c.moveTo(rx,ry+3);c.lineTo(rx,ry+R+4);c.stroke();
 /* faixa do goniômetro (milésimos) */
 const mils=((Math.atan2(dxm,-dym)/6.283185+1)%1)*6400,sw=Math.min(vw-24,250),x0=Math.round(vw/2-sw/2),ppm=sw/200;
 c.fillStyle='rgba(18,16,10,.72)';c.fillRect(x0,6,sw,15);c.strokeStyle='#d9c88a';
 c.beginPath();for(let m=Math.ceil((mils-100)/10)*10;m<=mils+100;m+=10){const x=Math.round(x0+sw/2+(m-mils)*ppm),maj=((m%50)+50)%50===0;c.moveTo(x+.5,21);c.lineTo(x+.5,maj?14:18)}c.stroke();
 c.fillStyle='#ff6b5e';c.fillRect(Math.round(vw/2),6,1,15);
 for(let m=Math.ceil((mils-100)/50)*50;m<=mils+100;m+=50){const x=Math.round(x0+sw/2+(m-mils)*ppm);txt(c,String(((m%6400)+6400)%6400),x,12,'#d9c88a','center')}
 txt(c,'AZ '+Math.round(mils)+' mil',vw/2,31,'#f4e7b0','center');
 /* painel inferior */
 const pw=Math.min(vw-16,236),px=Math.round(vw/2-pw/2),py=vh-46,ft=flightTime(dist,b.big),elev=Math.round(b.big?180+dist*.45:40+dist*.3),n=alive(b);
 c.fillStyle='rgba(18,16,10,.78)';c.fillRect(px,py,pw,40);c.strokeStyle='#8a7a4a';c.strokeRect(px+.5,py+.5,pw-1,39);
 txt(c,(b.big?'OBUSEIRO':'CANHÃO DE CAMPANHA')+'  ·  GUARNIÇÃO '+n+'/4',px+5,py+9,'#d9c88a');
 txt(c,'DIST '+Math.round(dist)+' m   ELEV '+elev+' mil   VOO '+ft.toFixed(1)+' s'+(G.lim==='max'?'  (ALC. MÁX)':G.lim==='min'?'  (ALC. MÍN)':''),px+5,py+19,'#f4e7b0');
 KINDS.forEach((k,i)=>{const cnt=k==='he'?b.ammo:b.sp[k],sel=G.kind===k,x=px+5+i*74;
  c.fillStyle=sel?'rgba(230,200,110,.35)':'rgba(255,255,255,.06)';c.fillRect(x-2,py+22,71,8);
  txt(c,'['+(i+1)+'] '+(k==='he'?'HE':k==='shrap'?'SHRAP':'FUMAÇA')+' '+cnt,x,py+29,sel?'#fff0b0':cnt?'#b9b39a':'#7a4a44')});
 txt(c,noAmmo?'SEM PROJÉTEIS':PHN[b.ph===null?0:b.ph]+(b.ph===null?'…':''),px+5,py+38,col);
 if(G.warn>time&&Math.floor(time*4)%2===0)txt(c,'CONTRA-BATERIA! ABRIGUE-SE  ·  [E] sai da peça',vw/2,44,'#ff6b5e','center');
 c.restore()}

/* ---------- baixas na guarnição (explosões e bombardeios) ---------- */
function blast(x,y,r,power){if(!active)return;
 for(const b of B)for(const c of b.crew){if(!c.alive)continue;const d=Math.hypot(c.x*2-x,c.y*2-y);if(d>=r)continue;
  hurtCrew(b,c,power*(1-d/r)*.9*(time<b.shelter?.15:1))}
 hitDepot(x,y,r,power)}

/* ---------- desenho ---------- */
/* servidor da peça: figura de ~7×12 px no estilo da infantaria (capacete Brodie/Stahlhelm, túnica com luz à esquerda, cinto,
   perneiras), com pose por função e fase do ciclo: o chefe gira o volante de pontaria, o portador corre com o obus nos braços,
   o municiador recebe, encaixa e soca o projétil e abre a culatra na ejeção, o disparador estica o cordel e tapa os ouvidos no tiro */
const PAL=[{u:'#6f7448',hi:'#878c5c',sh:'#565a37',h:'#4c5236',hh:'#646b48',d:'#3b3426',belt:'#4a3a22',boot:'#2a2118',pt:'#6a5b3d'},
           {u:'#6a6f77',hi:'#838891',sh:'#52565d',h:'#474c53',hh:'#5f656c',d:'#2c2f33',belt:'#1e1d1b',boot:'#1b1a18',pt:'#3a3d42'}];
const SKIN='#d9b48f',SKD='#b8936f',SHELL='#c9a24a',SHD='#8e7030',SHT='#7d7f70';
function soldier(c,x,y,team,cr,b){
 const P=PAL[team],d=b.d,R=Math.round;
 if(!cr.alive){rect(c,x-4,y-1,8,3,P.sh);rect(c,x-3,y-1,6,2,P.u);rect(c,x+(d>0?3:-5),y-1,2,2,P.h);rect(c,x-4,y+2,8,1,'rgba(0,0,0,.28)');return}
 const ph=b.ph!==null?PHASES[b.ph]:'',pr=b.ph!==null?b.t/(b.cfg[ph]||1):0;
 const mv=Math.hypot(cr.x-(cr._lx??cr.x),cr.y-(cr._ly??cr.y))>.04;cr._lx=cr.x;cr._ly=cr.y;
 const sk=b.shotT,duck=sk<.55&&time>=b.shelter;if(sk<.12)x-=d;      // pesados: o sopro da boca empurra a guarnição 1 px e todos se agacham até o recuo acabar
 const step=mv?((time*10+b.i)|0)%2:0,kneel=duck||cr.role==='gunner'||(cr.role==='loader'&&(ph==='load'||ph==='eject'));
 rect(c,x-3,y+1,7,1,'rgba(0,0,0,.3)');                                                    // sombra
 /* pernas: agachado (joelho no chão) ou de pé/caminhando */
 if(kneel){rect(c,x-2,y-1,3,2,P.sh);rect(c,x+(d>0?1:-2),y-2,2,3,P.u);rect(c,x-3,y,2,1,P.boot);rect(c,x+(d>0?2:-3),y,2,1,P.boot)}
 else{rect(c,x-2,y-3,2,3+(step?-1:0),P.sh);rect(c,x,y-3,2,3-(step?0:1),P.u);rect(c,x-2,y-1+(step?-1:0),2,1,P.pt);rect(c,x,y-1-(step?0:1),2,1,P.pt);
  rect(c,x-2,y,2,1,P.boot);rect(c,x,y-(step?0:1),2,1,P.boot)}
 const by=kneel?y-2:y-3;                                                                  // base do tronco
 rect(c,x-2,by-5,5,5,P.u);rect(c,x-2,by-5,1,5,P.hi);rect(c,x+2,by-5,1,5,P.sh);rect(c,x-2,by-2,5,1,P.belt);   // túnica e cinto
 rect(c,x-1,by-7,3,2,SKIN);rect(c,x+(d>0?1:-1),by-6,1,1,SKD);rect(c,x+(d>0?2:-2),by-7,1,1,SKIN);      // rosto e nariz
 if(team===0){rect(c,x-3,by-8,7,1,P.h);rect(c,x-2,by-9,5,1,P.h);rect(c,x-1,by-10,3,1,P.hh)}          // Brodie: aba larga
 else{rect(c,x-2,by-9,5,2,P.h);rect(c,x-1,by-10,3,1,P.hh);rect(c,x-(d>0?3:-3)+(d>0?0:0),by-8,1,2,P.h);rect(c,x+(d>0?-3:3),by-8,1,2,P.h)} // Stahlhelm: saia
 const sx=x+d*2,sy=by-4;                                                                  // ombro do lado da peça
 const arm=(x0,y0,x1,y1)=>{c.fillStyle=P.u;const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0))|0;for(let i=0;i<=n;i++)c.fillRect(R(x0+(x1-x0)*i/(n||1)),R(y0+(y1-y0)*i/(n||1)),1,1);rect(c,R(x1),R(y1),1,1,SKIN)};
 if(cr.role==='gunner'){/* volante de pontaria: a mão gira em círculo enquanto aponta */
  const a=ph==='aim'?time*14:0,hx=sx+d*3+R(Math.cos(a)*1.2),hy=sy+1+R(Math.sin(a)*1.2);
  rect(c,sx+d*3-1,sy,3,3,'#3c4045');rect(c,sx+d*3,sy+1,1,1,'#7d858c');arm(sx,sy,hx,hy);arm(sx-d,sy+1,sx+d*2,sy+2)}
 else if(cr.role==='carrier'){/* corre do paiol ao municiador com o obus abraçado */
  const has=ph==='load'&&pr<.62;if(has){rect(c,sx+d*1,sy-1,2,5,SHELL);rect(c,sx+d*1,sy-2,2,1,SHT);rect(c,sx+d*1+(d>0?1:0),sy,1,4,SHD);arm(sx-d,sy,sx+d*2,sy+1);arm(sx,sy+2,sx+d*2,sy+3)}
  else{arm(sx,sy,sx+d,sy+3);arm(sx-d*3,sy,sx-d*3,sy+3)}}
 else if(cr.role==='loader'){
  if(ph==='load'&&pr>.35&&pr<.62){const k=(pr-.35)/.27,px=sx+d*(2+R(k*3));rect(c,px,sy,4*d>0?4:4,2,SHELL);rect(c,d>0?px+3:px,sy,1,2,SHT);arm(sx,sy,px,sy+1);arm(sx,sy+1,px+d*2,sy+2)}  // encaixa o projétil
  else if(ph==='load'&&pr>=.62){const l=R(Math.sin((pr-.62)/.38*Math.PI)*3);c.fillStyle='#8a6d48';c.fillRect(d>0?sx+1:sx-9-l,sy+1,8+l,1);rect(c,d>0?sx+9+l:sx-10-l,sy,1,3,'#6b5436');arm(sx,sy,sx+d*(2+l),sy+1)} // soquete
  else if(ph==='eject'){const k=Math.min(1,pr*2.5);arm(sx,sy,sx+d*R(2+k*2),sy-1+R(k*2));arm(sx-d,sy+1,sx+d*2,sy+2)}                // alavanca da culatra
  else{arm(sx,sy,sx+d*2,sy+2);arm(sx-d,sy+1,sx+d,sy+3)}}
 else{/* disparador: cordel esticado; no disparo puxa forte e protege o ouvido */
  const pull=ph==='fire'||ph==='recoil';
  if(ph==='ready'||pull){const hx=x-d*(pull?6:4),hy=sy+1;arm(sx-d*2,sy,hx,hy);c.fillStyle='#d8d2b8';const tx=b.cx-b.d*12,x0=Math.min(hx,tx),x1=Math.max(hx,tx);c.fillRect(x0,hy,x1-x0,1);
   if(pull){rect(c,x-1,by-7,1,2,SKIN);rect(c,x+1,by-7,1,2,SKIN)}else arm(sx,sy,sx+d,sy+3)}
  else{arm(sx,sy,sx+d,sy+3);arm(sx-d*3,sy,sx-d*3,sy+3)}}
 /* tiro: todos abaixam e levam as mãos aos ouvidos (o chefe já gira o volante; o disparador já tapa) */
 if(duck&&cr.role!=='firer'&&cr.role!=='gunner'){rect(c,x-2,by-7,1,2,SKIN);rect(c,x+2,by-7,1,2,SKIN);rect(c,x-2,by-6,1,1,SKD);rect(c,x+2,by-6,1,1,SKD)}}
/* paiol de campanha junto às peças construídas (no mapa fortificado o paiol já vem pintado) */
const AMMO=[null,null];
function ammoSprite(team){if(AMMO[team])return AMMO[team];const cv=document.createElement('canvas');cv.width=16;cv.height=12;const g=cv.getContext('2d');
 const r=(x,y,w,h,col)=>{g.fillStyle=col;g.fillRect(x,y,w,h)};
 r(0,9,16,3,'rgba(0,0,0,.25)');r(1,3,7,6,'#5c4a30');r(1,3,7,1,'#7a6644');r(2,5,5,1,'#3e3220');r(9,4,6,5,'#6b5638');r(9,4,6,1,'#8a7350');r(10,6,4,1,'#4a3c26');
 for(let i=0;i<4;i++){r(2+i*3,0,2,4,SHELL);r(2+i*3,0,2,1,SHT);r(3+i*3,1,1,3,SHD)}r(0,8,16,1,'#3a3122');AMMO[team]=cv;return cv}
function drawPart(c,ox,oy,p){const x=ox+Math.round(p.x),y=oy+Math.round(p.y),k=p.t/p.max;let r=Math.max(1,Math.round(p.size*(1+k*.7))),a,c0,c1;
 if(p.k==='spark'){c.globalAlpha=1-k*.6;rect(c,x,y,1,1,k<.4?'#fff2b8':'#e3a94a');c.globalAlpha=1;return}
 if(p.k==='burst'){c.globalAlpha=.85*(1-k);PX.disc(c,x,y,Math.round(p.size*(.6+k)),'#fff6d0');c.globalAlpha=1;return}
 if(p.k==='ring'){const e=1-(1-k)*(1-k),rx=Math.max(2,Math.round(p.size*(.35+e*.9))),ry=Math.max(1,Math.round(rx*.38));c.globalAlpha=.55*(1-k);if(PX.ring)PX.ring(c,x,y,rx,ry,'#a89870');c.globalAlpha=.3*(1-k);if(PX.ring)PX.ring(c,x,y,Math.max(1,rx-2),Math.max(1,ry-1),'#d1c39a');c.globalAlpha=1;return}
 if(p.k==='gun'){a=k>.75?.25:k>.45?.5:.78;c0='#a8a496';c1='#d3cfc1';r=Math.max(1,Math.round(p.size*(1+k*1.1)))}
 else if(p.k==='smoke'){a=k>.6?.2:.5;c0='#8d8a82';c1='#b7b3a9'}
 else if(p.k==='black'){a=k>.7?.22:k>.4?.5:.8;c0='#2b2926';c1='#46423d';r=Math.max(1,Math.round(p.size*(1+k*1.2)))}
 else{a=k>.6?.12:k>.3?.3:.55;c0='#7c6a4c';c1='#9b8860'}
 c.globalAlpha=a;PX.disc(c,x,y,r,c0);if(r>2)PX.disc(c,x-1,y-1,Math.max(1,Math.round(r*.55)),c1);c.globalAlpha=1}
function drawFlash(c,ox,oy,f){const x=ox+Math.round(f.x),y=oy+Math.round(f.y),ph=f.t/f.max,L=f.big?35:26,d=f.dir;
 if(ph<.5){c.globalAlpha=.3;PX.disc(c,x+d*5,y,f.big?20:13,'#ffcf6a');c.globalAlpha=.16;PX.disc(c,x+d*5,y,f.big?32:20,'#ff7a24');c.globalAlpha=1;
  /* cone duplo: externo laranja (#ff7a24) e núcleo incandescente (#fff0b0) */
  for(const[off,l,col]of[[-.55,.5,'#ff7a24'],[-.3,.78,'#ff7a24'],[0,1,'#fff0b0'],[.3,.78,'#ff7a24'],[.55,.5,'#ff7a24']]){const a=(d>0?0:Math.PI)+off*(d>0?1:-1);PX.pline(c,x,y,x+Math.cos(a)*L*l,y+Math.sin(a)*L*l,col);if(Math.abs(off)<.4)PX.pline(c,x,y+1,x+Math.cos(a)*L*l*.8,y+1+Math.sin(a)*L*l*.8,col==='#fff0b0'?'#fff0b0':'#ffb347')}
  rect(c,x-3,y-3,7,7,'#ffd466');rect(c,x-2,y-2,5,5,'#fff0b0');if(f.big)rect(c,x-1,y-1,3,3,'#ffffff')}
 else{rect(c,x,y-1,3,3,'#ff9b32');rect(c,x+d*4,y,3,1,'#ffd27a')}}
function drawCasing(c,ox,oy,s){if(s.wait>0)return;const x=ox+Math.round(s.x),y=oy+Math.round(s.y-s.z);
 if(!s.landed)rect(c,x,y,1,s.ph?3:2,'#e0b84a');else{rect(c,x,y,s.ph?3:2,1,'#c79a32');rect(c,x,y,1,1,'#f0cf6a')}}
/* canhão vivo: carro fixo + tubo que gira até o alvo e recua no berço hidropneumático */
function drawGun(c,ox,oy,b){if(!b.live)return;const X=b;const K=PX.WW1.kit,g=GUN[b.big?'h':'f'];
 const rr=recoilOf(b),kick=Math.round(rr*.18)*-b.d;   // o carro também dá um tranco de 1 px para trás
 K.put(c,bodyOf(b.big),ox+X.gx0+kick,oy+X.gy0,{flip:b.team===1});
 const a=X.ang,ca=Math.cos(a),sa=Math.sin(a),rc=rr*.85,x0=ox+X.pvx+kick-ca*rc,y0=oy+X.pvy-sa*rc,x1=x0+ca*g.len,y1=y0+sa*g.len,cols=TUBE[g.th],h=(g.th-1)/2,R=Math.round;
 c.globalAlpha=.3;for(let k=-1;k<=1;k++)PX.pline(c,R(x0+3),R(y0+3+k),R(x1+3),R(y1+3+k),'#0b1207');c.globalAlpha=1;
 for(let k=-h;k<=h;k++){const oxk=R(-sa*k),oyk=R(ca*k);PX.pline(c,R(x0)+oxk,R(y0)+oyk,R(x1)+oxk,R(y1)+oyk,cols[k+h])}
 const bx=x1-ca*g.mb,by=y1-sa*g.mb,hb=h+1;   // freio de boca
 for(let k=-hb;k<=hb;k++){const oxk=R(-sa*k),oyk=R(ca*k);PX.pline(c,R(bx)+oxk,R(by)+oyk,R(x1)+oxk,R(y1)+oyk,k<0?'#7d858c':k>0?'#22262a':'#454b51')}
 rect(c,R(x1)-1,R(y1)-1,2,2,'#15171a')}
function drawWagon(c,ox,oy,w){if(w.st==='idle')return;const A=PX.WW1.SPR,K=PX.WW1.kit,sp=w.hor?K.rot90(A.narrowWagon()):A.narrowWagon(),x=ox+Math.round(w.x),y=oy+Math.round(w.y);
 if(!onScreen(x,y,30,vw,vh))return;c.drawImage(sp.c,Math.round(x-sp.c.width/2),Math.round(y-sp.c.height/2));
 if(w.st==='out')for(let i=0;i<3;i++)rect(c,x-2+i*2,y-2,1,3,'#c9a24a')}
function drawDepotRuin(c,ox,oy,d){if(!d.dead)return;const x=ox+Math.round(d.x),y=oy+Math.round(d.y);if(!onScreen(x,y,40,vw,vh))return;
 c.globalAlpha=.78;rect(c,x-15,y-10,30,20,'#1d1a16');rect(c,x-11,y-7,22,13,'#33291f');c.globalAlpha=1;
 for(let i=0;i<4;i++){const f=Math.floor(time*8+i*3)%3;rect(c,x-10+i*6,y-3+(i%2)*3,2,2+f,i%2?'#ff9b32':'#ffd466')}}
function drawGround(c,ox,oy){
 if(!active)return;
 for(const b of B)if(b.built){const x=ox+Math.round(b.crew[2].px),y=oy+Math.round(b.crew[2].py);if(onScreen(x,y,30,vw,vh))c.drawImage(ammoSprite(b.team),x-8+(b.d>0?-4:4),y-6)}
 for(const d of DEP)drawDepotRuin(c,ox,oy,d);
 for(const w of WG)drawWagon(c,ox,oy,w);
 for(const b of B){if(onScreen(ox+b.cx,oy+b.cy,60,vw,vh))drawGun(c,ox,oy,b)}}
const onScreen=(x,y,m,vwv,vhv)=>x>-m&&y>-m&&x<vwv+m&&y<vhv+m;
function draw(c,ox,oy){
 if(!active)return;
 /* só desenha o que está na tela; o relógio do ciclo já correu em tick() */
 for(const b of B){const sx=ox+b.cx,sy=oy+b.cy;if(!onScreen(sx,sy,60,vw,vh))continue;
  for(const cr of b.crew)soldier(c,ox+Math.round(cr.x),oy+Math.round(cr.y),b.team,cr,b)}
 for(const s of casings)if(onScreen(ox+s.x,oy+s.y,8,vw,vh))drawCasing(c,ox,oy,s);
 for(const p of parts){const x=ox+p.x,y=oy+p.y;if(onScreen(x,y,16,vw,vh))drawPart(c,ox,oy,p)}
  for(const f of flashes){const x=ox+f.x,y=oy+f.y;if(onScreen(x,y,50,vw,vh))drawFlash(c,ox,oy,f)}}

function cycleKind(){const t=playerTeam,b=B.filter(x=>x.team===t);let k=KINDS[(KINDS.indexOf(cmdKind[t])+1)%3];
 if(k!=='he'&&!b.some(x=>x.sp[k]>0))k='he';cmdKind[t]=k;if(typeof toast==='function')toast('Artilharia: '+KNAME[k]+(k==='he'?'':' ('+b.reduce((n,x)=>n+x.sp[k],0)+' disponíveis)'))}
window.addEventListener('keydown',e=>{if(!active||e.repeat||document.querySelector('dialog[open]')||typeof mode==='undefined'||mode!=='commander')return;if(e.key==='t'||e.key==='T'){cycleKind();e.preventDefault()}},true);
window.PXBAT={addGun,removeGun,cycleKind,recoilOf,get fx(){return{parts,flashes,casings}},ammoKind:t=>cmdKind[t],hitDepot,get depots(){return DEP},get wagons(){return WG},steps:{alertCrews,crewHits,reinforce,logistics},coverActive:(team,y)=>smokes.some(c=>c.team===team&&smokeA(c)>.35&&Math.abs(c.y-y)<220),mission,tick,blast,draw,build,crewRate,flightTime,detonate,smokeBlocks,take,manning,manTick,key,release,active:()=>active,
 get batteries(){return B},status:team=>{const r=B.filter(b=>b.team===team);return{total:r.length,operational:r.filter(operational).length,crew:r.reduce((n,b)=>n+alive(b),0),ammo:r.reduce((n,b)=>n+b.ammo,0),depot:!DEP[team].dead}}};

/* ---------- ligações com o jogo ---------- */
const wrapFn=(name,fn)=>{const orig=window[name];if(typeof orig!=='function')return;window[name]=function(...a){return fn(orig,...a)}};
wrapFn('setup',(orig,...a)=>{const r=orig(...a);build();return r});
wrapFn('update',(orig,dt)=>{orig(dt);tick(dt)});
wrapFn('render',(orig,...a)=>{const r=orig(...a);hudDraw();return r});
wrapFn('explode',(orig,x,y,r,power=100,team=0)=>{orig(x,y,r,power,team);if(r>=30)blast(x,y,r,power)});
if(window.WW1A){const under=WW1A.under;WW1A.under=function(c,ox,oy,dt){under.call(this,c,ox,oy,dt);drawGround(c,ox,oy)};const over=WW1A.over;WW1A.over=function(c,ox,oy,dt){over.call(this,c,ox,oy,dt);draw(c,ox,oy)}}
build();
})();
