'use strict';
/* Iron Front 1.9 — paisagem sonora dinâmica (soundscape.js). Carrega por último (depois de soldier-feel.js).
   Tudo sintetizado (Web Audio), sem arquivos. Apoia-se no ganho mestre do assault.js (a concussão continua abafando tudo).
   Mixer ......... barramentos armas / explosões / vozes / ambiente → mixIn → mestre; limitador (compressor −10 dB, 12:1) entre o
                   mestre e a saída, para dezenas de tiros e explosões juntos não estourarem; reverb por convolução com IR
                   sintetizado (2,2 s) — longe soa mais "molhado" que perto.
   Espaço ........ ouvinte = jogador no modo soldado, senão a câmera. Ganho 1/(1+(d/r0)^1.6), passa-baixa do ar
                   16000·e^(−d/650) Hz, panorama pela posição, atraso acústico de (d−250)/340 s (até 3 s): o clarão chega antes.
   Armas ......... cada arma tem timbre: Springfield × Gewehr 98 (estalo, corpo e soco diferentes), Browning M1917 × MG 08
                   (cadência e corpo), submetralhadora, pistola, escopeta, canhão de tanque. Variação de afinação/filtro/ganho a
                   cada tiro (sem repetição idêntica). Antes só 12% dos tiros a < 450 px soavam; agora todos os audíveis
                   disputam vozes com prioridade (jogador 10 > obus 6 > morteiro 4 > MG 3 > fuzil 2) e limite por barramento
                   (16 armas, 6 explosões, 2 vozes), roubando a voz mais fraca.
   Explosões ..... por tamanho (granada / morteiro-tanque / obus) e distância: estalo + corpo grave descendo + soco + ronco
                   final; perto há detritos caindo; longe só o trovão rolando com ecos.
   Ducking ....... explosão a < 400 px abaixa armas (−6 dB) e ambiente (−12 dB) por um instante.
   Intensidade ... integrador com vazamento (τ 6 s) do que acontece perto (I) e no mapa (G). Calmo: vento audível e pássaros
                   (depois de 25 s sem explosão perto). Caos: o leito de fogo distante e o ronco de artilharia sobem com G.
   Vozes ......... gritos curtos por formantes (serra + 3 passa-bandas + ruído de consoante) para os gritos do life-kit:
                   "MEDIC!", "SANI!", "GRENADE!", "DECKUNG!"… voz própria por soldado (f0 150–230 Hz), no máximo 2 juntas.
   ?som2=0 desliga (volta o som antigo) · IronFront.soundscape.state() (vozes, descartes, roubos, nós/s, intensidade). */
(function(){
const hyp=Math.hypot,rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>v<a?a:v>b?b:v;
const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('soundscape.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};
const CFG={MIX:.55,R0:{gun:160,mg:220,boom:400,voice:180},MAXD:{gun:1400,boom:3200,voice:800},BUS:{gun:16,boom:6,voice:2},GAP:.05,
 PRI:{player:10,howitzer:6,mortar:4,mg:3,rifle:2,voice:5},TAU:6,CALM_BIRDS:25,DUCK:{gun:.5,amb:.25,voice:.7}};
const S=window.SNDSCAPE={on:!/[?&]som2=0/.test(location.search),version:'1.9',cfg:CFG,
 stats:{voices:0,dropped:0,stolen:0,nodes:0,shots:0,booms:0,shouts:0,errors:0,peakI:0,peakG:0}};
let A=null,MIX=null,BUS={},REV=null,NOISE=null,PINK=null,BROWN=null,AMB=null,errs=0,mute=0,I=0,G=0,lastBoomNear=-99,lastGap=0,nodesT=0,nodesN=0;
const ACT={gun:[],boom:[],voice:[]};
function fail(e){S.stats.errors++;if(++errs<=3)console.error('soundscape.js:',e);if(errs>=20){S.on=false;console.error('soundscape.js desligado após erros repetidos')}}
const live=()=>{try{return S.on&&soundOn&&audio&&audio.state!=='closed'}catch{return false}};
const node=n=>{S.stats.nodes++;nodesN++;return n};

/* ---------- montagem ---------- */
function buf(kind,dur=2){const n=Math.ceil(A.sampleRate*dur),b=A.createBuffer(1,n,A.sampleRate),d=b.getChannelData(0);let b0=0,b1=0,b2=0,last=0;
 for(let i=0;i<n;i++){const w=Math.random()*2-1;if(kind==='white')d[i]=w;else if(kind==='pink'){b0=.997*b0+w*.029;b1=.985*b1+w*.032;b2=.95*b2+w*.048;d[i]=(b0+b1+b2+w*.02)*1.4}
  else{last=(last+.02*w)/1.02;d[i]=last*3.5}}return b}
function ir(dur=2.2){const n=Math.ceil(A.sampleRate*dur),b=A.createBuffer(2,n,A.sampleRate);for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);let lp=0;
 for(let i=0;i<n;i++){const t=i/A.sampleRate;if(t<.008){d[i]=0;continue}lp+=(Math.random()*2-1-lp)*.35;d[i]=lp*Math.exp(-t/.5)*.9}}return b}
function init(){if(A===audio&&MIX)return true;if(!audio)return false;A=audio;
 MIX=A.createGain();MIX.gain.value=CFG.MIX;MIX.connect(A.destination);                                  // o assault.js redireciona para o mestre
 try{const m=A.__ifm;if(m&&!m.__lim){const lim=A.createDynamicsCompressor();lim.__raw=1;lim.threshold.value=-10;lim.knee.value=6;lim.ratio.value=12;lim.attack.value=.002;lim.release.value=.2;
   m.disconnect();m.connect(lim);lim.connect(A.destination);m.__lim=lim}}catch(e){fail(e)}
 REV=A.createConvolver();REV.buffer=ir();const rg=A.createGain();rg.gain.value=.55;REV.connect(rg);rg.connect(MIX);
 for(const k of ['gun','boom','voice','amb']){const g=A.createGain(),dk=A.createGain();g.gain.value={gun:.8,boom:.9,voice:.85,amb:.5}[k];g.connect(dk);dk.connect(MIX);BUS[k]={g,dk}}
 NOISE=buf('white');PINK=buf('pink');BROWN=buf('brown');startAmb();return true}

/* ---------- espaço ---------- */
function listener(){return mode==='soldier'&&player?player:cam}
function space(x,y,kind){const L=listener(),d=hyp(x-L.x,y-L.y),r0=CFG.R0[kind]||160;return {d,gain:1/(1+Math.pow(d/r0,1.6)),lp:clamp(16000*Math.exp(-d/650),500,16000),pan:clamp((x-L.x)/600,-1,1)*.8,delay:Math.min(3,Math.max(0,d-250)/340),wet:clamp(.15+d/2200,.15,.8)}}
/* cadeia de saída de uma voz: (fonte) → filtro do ar → ganho → pan → barramento (+ envio de reverb) */
function chain(bus,sp,vol,t){const lp=node(A.createBiquadFilter());lp.type='lowpass';lp.frequency.value=sp.lp;const g=node(A.createGain());g.gain.value=vol;
 let out=g;if(A.createStereoPanner){const p=node(A.createStereoPanner());p.pan.value=sp.pan;g.connect(p);out=p}
 lp.connect(g);out.connect(BUS[bus].g);const s=node(A.createGain());s.gain.value=sp.wet*.6;out.connect(s);s.connect(REV);return {inp:lp,g}}
/* limite de vozes por barramento com prioridade; devolve false se a voz não deve tocar */
function claim(bus,pri,dur,t){const L=ACT[bus],now=A.currentTime;for(let i=L.length-1;i>=0;i--)if(L[i].end<=now)L.splice(i,1);
 if(L.length>=CFG.BUS[bus]){let w=0;for(let i=1;i<L.length;i++)if(L[i].pri<L[w].pri)w=i;if(L[w].pri>=pri){S.stats.dropped++;return null}
  const v=L.splice(w,1)[0];try{v.g.gain.cancelScheduledValues(now);v.g.gain.setTargetAtTime(0,now,.005);v.stop(now+.03)}catch{}S.stats.stolen++}
 const v={pri,end:t+dur,g:null,srcs:[],stop(tt){for(const s of this.srcs)try{s.stop(tt)}catch{}}};L.push(v);S.stats.voices++;return v}
function noiseSrc(b,t,dur){const s=node(A.createBufferSource());s.buffer=b;s.start(t,Math.random()*(b.duration-dur-.05>0?b.duration-dur-.05:0),dur+.05);return s}
function env(g,t,a,peak,dec,curve='exp'){g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(peak,t+a);if(curve==='exp')g.gain.exponentialRampToValueAtTime(.0001,t+a+dec);else g.gain.linearRampToValueAtTime(0,t+a+dec)}
/* camada de ruído filtrado (estalo, corpo, cauda) */
function layer(out,b,t,type,f,q,a,peak,dec,f2){const s=noiseSrc(b,t,a+dec),fl=node(A.createBiquadFilter()),g=node(A.createGain());fl.type=type;fl.frequency.setValueAtTime(f,t);if(f2)fl.frequency.exponentialRampToValueAtTime(f2,t+a+dec);if(q)fl.Q.value=q;
 env(g,t,a,peak,dec);s.connect(fl);fl.connect(g);g.connect(out);return s}
function thump(out,t,f0,f1,dur,peak){const o=node(A.createOscillator()),g=node(A.createGain());o.type='sine';o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+dur);env(g,t,.004,peak,dur);o.connect(g);g.connect(out);o.start(t);o.stop(t+dur+.05);return o}

/* ---------- armas ---------- */
const GUN={rifle0:{crack:2500,body:520,q:.9,f0:120,f1:45,tail:.55,tg:.15},rifle1:{crack:2000,body:400,q:.8,f0:95,f1:38,tail:.7,tg:.17},
 mg0:{crack:2600,body:470,q:1,f0:105,f1:48,tail:.25,tg:.1,short:1},mg1:{crack:2200,body:360,q:.9,f0:85,f1:40,tail:.3,tg:.12,short:1},
 smg:{crack:3000,body:650,q:1.2,f0:150,f1:70,tail:.25,tg:.08,short:1,v:.7},pistol:{crack:3200,body:700,q:1.1,f0:160,f1:80,tail:.3,tg:.08,v:.6},
 shotgun:{crack:1600,body:300,q:.7,f0:80,f1:35,tail:.8,tg:.22,v:1.2},tank:{crack:1500,body:220,q:.7,f0:60,f1:28,tail:1.2,tg:.3,v:1.6}};
function gunKey(u,manual){if(u.type==='tank')return 'tank';if(manual&&u===player){if(weapon==='mg')return 'mg'+u.team;if(weapon==='smg'||weapon==='pistol'||weapon==='shotgun')return weapon}return (u.type==='mg'?'mg':'rifle')+u.team}
function gunshot(u,manual){if(!live()||!init())return;const sp=space(u.x,u.y,u.type==='mg'?'mg':'gun');if(sp.d>CFG.MAXD.gun)return;
 const isP=u===player&&mode==='soldier',now=A.currentTime;if(!isP&&now-lastGap<CFG.GAP&&sp.d>200)return;lastGap=now;
 const k=gunKey(u,manual),R=GUN[k]||GUN.rifle0,pri=isP?CFG.PRI.player:u.type==='tank'?CFG.PRI.mortar:u.type==='mg'?CFG.PRI.mg:CFG.PRI.rifle,pr=pri*(1-sp.d/CFG.MAXD.gun)**2+(isP?10:0);
 const t=now+sp.delay,far=clamp((sp.d-150)/450,0,1),v=claim('gun',pr,R.tail+.3,t);if(!v)return;S.stats.shots++;
 const vol=sp.gain*(R.v||1)*(isP?1.1:.9)*rnd(.85,1.15),c=chain('gun',sp,vol,t);v.g=c.g;const det=rnd(.94,1.06);
 if(far<1)v.srcs.push(layer(c.inp,NOISE,t,'highpass',R.crack*det,0,.001,.9*(1-far),.012));
 v.srcs.push(layer(c.inp,NOISE,t,'bandpass',R.body*det*(1-.5*far),R.q,.002,.6,R.short?.07:.16));
 if(far<.8)v.srcs.push(thump(c.inp,t,R.f0*det,R.f1,R.short?.05:.08,.5*(1-far)));
 v.srcs.push(layer(c.inp,PINK,t,'lowpass',far>.5?600:900,0,.01,R.tg*(1+far*1.5),R.tail*(1+far)));
 bump(u.x,u.y,u.type==='mg'?.06:.12)}

/* ---------- explosões ---------- */
function boom(x,y,r){if(!live()||!init())return;const sp=space(x,y,'boom');if(sp.d>CFG.MAXD.boom)return;
 const size=r<40?0:r<80?1:2,pri=[CFG.PRI.rifle+1,CFG.PRI.mortar,CFG.PRI.howitzer][size]*(1-sp.d/CFG.MAXD.boom)**2+(sp.d<150?6:0),now=A.currentTime,t=now+sp.delay;
 const dur=[1.2,2,3.8][size],v=claim('boom',pri,dur,t);if(!v)return;S.stats.booms++;
 const far=clamp((sp.d-200)/700,0,1),vol=sp.gain*[.7,1,1.25][size]*rnd(.9,1.1),c=chain('boom',sp,vol,t);v.g=c.g;
 if(far<1)v.srcs.push(layer(c.inp,NOISE,t,'highpass',1000,0,.001,.8*(1-far),[.005,.006,.008][size]));
 v.srcs.push(layer(c.inp,BROWN,t,'lowpass',[1200,900,700][size]*(1-.6*far),0,.003,1,[.4,.9,1.6][size],[300,180,120][size]));
 v.srcs.push(thump(c.inp,t,[70,55,45][size],[35,28,22][size],[.25,.5,1][size],.8));
 if(size)v.srcs.push(layer(c.inp,BROWN,t+.1,'lowpass',250,0,.3,.35,[1.6,3.5][size-1]));
 if(far<.5){const n=[7,12,20][size];for(let i=0;i<n;i++){const tt=t+.15+Math.random()*[.9,1.5,2.5][size];v.srcs.push(layer(c.inp,NOISE,tt,'bandpass',rnd(2000,4000),3,.001,.12,.004))}}
 else{for(const [dt,gk] of [[.35,.3],[.9,.15]])v.srcs.push(layer(c.inp,BROWN,t+dt,'lowpass',far>.8?250:400,0,.05,gk,.8))}
 if(sp.d<400){duck(size)}bump(x,y,[.5,.9,1.5][size]);if(sp.d<800)lastBoomNear=time}
function duck(size){const now=A.currentTime,back=[.4,.8,1.2][size];for(const [k,lv] of [['gun',CFG.DUCK.gun],['amb',CFG.DUCK.amb],['voice',CFG.DUCK.voice]]){const g=BUS[k].dk.gain;
 g.cancelScheduledValues(now);g.setValueAtTime(g.value,now);g.linearRampToValueAtTime(lv,now+.01);g.setTargetAtTime(1,now+.05,back)}}

/* ---------- vozes por formantes ---------- */
const VOW={a:[750,1250,2600],e:[500,1800,2500],i:[300,2250,3000],o:[500,900,2500],u:[350,800,2300],y:[300,2000,2800]};
function shout(txt,u){if(!live()||!init())return;const sp=space(u.x,u.y,'voice');if(sp.d>CFG.MAXD.voice)return;const now=A.currentTime,t=now+sp.delay*.5;
 const word=String(txt).toLowerCase().replace(/[^a-zäöüß ]/g,''),seg=[];
 for(const ch of word){const c=ch==='ä'?'e':ch==='ö'?'o':ch==='ü'?'u':ch;if(VOW[c])seg.push({v:c,d:.09});else if('sz'.includes(c))seg.push({n:'s',d:.1});else if('kgtdpb'.includes(c))seg.push({n:'k',d:.03});else if('mn'.includes(c))seg.push({v:'u',d:.05,m:.4});else if(c==='r')seg.push({v:'e',d:.05,r:1});else if(c===' ')seg.push({gap:1,d:.06});else seg.push({n:'h',d:.03})}
 const total=seg.reduce((a,s)=>a+s.d,0);if(!total)return;const v=claim('voice',CFG.PRI.voice*(1-sp.d/CFG.MAXD.voice)+(u===player?5:0),total+.2,t);if(!v)return;S.stats.shouts++;
 const vol=sp.gain*.55,c=chain('voice',sp,vol,t);v.g=c.g;const seed=(u.id*9301+49297)%233280/233280,f0=150+seed*80,fm=.92+seed*.16;
 const o=node(A.createOscillator());o.type='sawtooth';o.frequency.setValueAtTime(f0*1.1,t);o.frequency.linearRampToValueAtTime(f0*.95,t+total);
 const vib=node(A.createOscillator()),vg=node(A.createGain());vib.frequency.value=5.5;vg.gain.value=f0*.03;vib.connect(vg);vg.connect(o.frequency);
 const src=node(A.createGain());o.connect(src);const F=[0,1,2].map(i=>{const f=node(A.createBiquadFilter());f.type='bandpass';f.Q.value=[8,10,12][i];src.connect(f);const g=node(A.createGain());g.gain.value=[1,.6,.35][i];f.connect(g);g.connect(c.inp);return f});
 const amp=src.gain;amp.setValueAtTime(0,t);let tt=t;
 for(const s of seg){if(s.v){const fs=VOW[s.v];F.forEach((f,i)=>f.frequency.setValueAtTime(fs[i]*fm,tt));amp.linearRampToValueAtTime(s.m||1,tt+.015);amp.setValueAtTime(s.m||1,tt+s.d-.01)}
  else{amp.linearRampToValueAtTime(s.gap?0:.15,tt+.01);if(s.n)v.srcs.push(layer(c.inp,NOISE,tt,s.n==='s'?'highpass':'bandpass',s.n==='s'?4500:s.n==='k'?2000:1500,s.n==='s'?0:2,.004,s.n==='s'?.35:.4,s.d))}tt+=s.d}
 amp.linearRampToValueAtTime(0,tt+.06);o.start(t);vib.start(t);o.stop(tt+.1);vib.stop(tt+.1);v.srcs.push(o,vib)}
if(window.IFK)IFK.voice=(key,u)=>{try{if(S.on)shout(IFK.lang(u.team,key),u)}catch(e){fail(e)}};

/* ---------- ambiente e intensidade ---------- */
function bump(x,y,w){const L=listener(),d=hyp(x-L.x,y-L.y);I+=w*Math.max(0,1-d/1500);G+=w}
function startAmb(){const now=A.currentTime,mk=(b,type,f,q,vol)=>{const s=A.createBufferSource();s.buffer=b;s.loop=true;const fl=A.createBiquadFilter();fl.type=type;fl.frequency.value=f;if(q)fl.Q.value=q;const g=A.createGain();g.gain.value=vol;s.connect(fl);fl.connect(g);g.connect(BUS.amb.g);s.start(now,Math.random());return {s,fl,g}};
 AMB={wind:mk(PINK,'bandpass',400,.7,.05),bed:mk(BROWN,'lowpass',600,0,.015),rumble:mk(BROWN,'lowpass',120,0,.02),birdAt:A.currentTime+rnd(3,8),thumpAt:A.currentTime+rnd(2,6)}}
function bird(){const now=A.currentTime,n=3+(Math.random()*5|0),pan=rnd(-.8,.8);for(let i=0;i<n;i++){const t=now+i*rnd(.08,.14),o=node(A.createOscillator()),g=node(A.createGain());o.type='sine';o.frequency.setValueAtTime(rnd(2400,2800),t);o.frequency.exponentialRampToValueAtTime(rnd(4000,4700),t+.04);
  env(g,t,.004,rnd(.012,.025),.05);let out=g;if(A.createStereoPanner){const p=node(A.createStereoPanner());p.pan.value=pan;g.connect(p);out=p}o.connect(g);out.connect(BUS.amb.g);o.start(t);o.stop(t+.08)}}
function ambTick(dt){const k=Math.exp(-dt/CFG.TAU);I*=k;G*=k;const In=I/(I+2),Gn=G/(G+6);S.stats.peakI=Math.max(S.stats.peakI,In);S.stats.peakG=Math.max(S.stats.peakG,Gn);
 if(!live()||!AMB)return;const now=A.currentTime,calm=1-clamp((In-.15)/.35,0,1),wx=window.PXW&&PXW.windVec?PXW.windVec().s||0:.3,st=.15;
 AMB.wind.g.gain.setTargetAtTime((.03+.05*calm)*(.6+wx),now,st);AMB.wind.fl.frequency.setTargetAtTime(380+Math.sin(time*.07)*180+Math.sin(time*.09+1)*90,now,.5);
 AMB.bed.g.gain.setTargetAtTime(.012+.08*Gn,now,.4);AMB.rumble.g.gain.setTargetAtTime(.015+.1*Gn,now,.6);
 if(calm>.75&&time-lastBoomNear>CFG.CALM_BIRDS&&now>AMB.birdAt){AMB.birdAt=now+rnd(3,8);bird()}
 if(Gn>.15&&now>AMB.thumpAt){AMB.thumpAt=now+rnd(1.5,6)/(.4+Gn);/* tiro de artilharia muito distante */const c={inp:BUS.amb.g};layer(c.inp,BROWN,now,'lowpass',180,0,.05,.12*Gn+.03,1.4)}
 if(time-nodesT>=1){S.nodesPerSec=nodesN/(time-nodesT||1);nodesT=time;nodesN=0}
 MIX.gain.setTargetAtTime(soundOn?CFG.MIX:0,now,.05)}
S.calm=()=>1-clamp((I/(I+2)-.15)/.35,0,1);

/* ---------- ligações ---------- */
wrap('shoot',(orig,u,target,manual=false)=>{if(!S.on)return orig(u,target,manual);const nb=bullets.length,ns=shells.length;mute++;
 try{return orig(u,target,manual)}finally{mute--;try{if(bullets.length>nb||shells.length>ns)gunshot(u,manual)}catch(e){fail(e)}}});
wrap('explode',(orig,x,y,r,power=100,team=0)=>{if(!S.on)return orig(x,y,r,power,team);mute++;try{return orig(x,y,r,power,team)}finally{mute--;try{boom(x,y,r)}catch(e){fail(e)}}});
wrap('sound',(orig,kind)=>{if(S.on&&mute&&(kind==='shot'||kind==='boom'))return;return orig(kind)});
wrap('update',(orig,dt)=>{orig(dt);try{if(S.on&&dt>0)ambTick(dt)}catch(e){fail(e)}});
wrap('setup',(orig,...a)=>{I=0;G=0;lastBoomNear=-99;return orig(...a)});
S.state=()=>({on:S.on,live:live(),voices:Object.fromEntries(Object.entries(ACT).map(([k,v])=>[k,v.length])),intensity:+(I/(I+2)).toFixed(2),global:+(G/(G+6)).toFixed(2),calm:+S.calm().toFixed(2),nodesPerSec:Math.round(S.nodesPerSec||0),stats:{...S.stats}});
S.gunshot=gunshot;S.boom=boom;S.shout=shout;S.space=space;S.init=init;
if(window.IronFront)window.IronFront.soundscape=S;
})();
