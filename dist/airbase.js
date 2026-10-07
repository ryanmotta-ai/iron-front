/* Aeródromos como instalações militares + operações aéreas (feedback #1, itens 6, 7 e 8).
   · Cada aeródromo do airwar.js ganha instalações com HP, registradas no PXSTRUCT: pista, 4 hangares, combustível, munição, torre de
     controle e 2 baterias antiaéreas. Podem ser bombardeadas e metralhadas (a pista e as peças estão no espaço aéreo de trás de cada lado).
       pista destruída ......... sem decolagens até a equipe de campo recompor a pista
       combustível destruído .. saídas com pouco combustível (alcance e tempo na missão menores)
       munição destruída ...... aviões saem com metade da carga de tiro e bombas
       hangar destruído ........ perde aviões estacionados e a manutenção atrasa
       torre destruída ......... intervalo de 25 s entre decolagens
       antiaérea destruída .... o aeródromo deixa de atirar: ataques inimigos ficam mais fáceis (entra no groundFire do airwar.js)
     Equipes de campo reparam sozinhas (e reerguem instalação destruída em 2 min) se o aeródromo ficar 25 s sem ser atacado.
   · Painel AIR OPERATIONS: lista os voos do jogador (tipo — fase: Em rota, Em combate, Retornando…); selecionar abre as ações
     (patrulha, ataque ao solo, bombardeio, reconhecimento, interceptação) e o jogador marca o alvo no mapa. O resultado não é garantido:
     interceptação vira combate, antiaérea fere, dano crítico faz retornar, piloto morto perde o avião (tudo do airwar.js).
   · IA aérea: escolhe alvos estratégicos (artilharia, aeródromo, depósitos, QG) pela PXAIRB.plan e evita antiaérea pesada sem escolta.
   Ganchos de 1 linha no airwar.js: aaPosts, dropBomb, strafe e launch. Liga/desliga: ?aerodromo=0 · API: IronFront.airbase. */
(function(){
'use strict';
if(typeof update!=='function'||!window.PXAW||!window.PXSTRUCT)return;
const hyp=Math.hypot,clamp=(v,a,b)=>v<a?a:v>b?b:v,rnd=(a,b)=>a+Math.random()*(b-a);
const A=window.PXAW,T=window.PXSTRUCT;
const S=window.PXAIRB={on:!/[?&]aerodromo=0/.test(location.search),version:'1.0',cfg:{REPAIR_AFTER:25,REPAIR:1.4,RUNWAY_REPAIR:2.6,REBUILD:120,TOWER_GAP:25,PLAN_EVERY:25,AA_AVOID:2},fac:[[],[]],craters:[],lastLaunch:[-99,-99],stats:{runwayHits:0,hangarsLost:0,planesLost:0,blocked:0,aiMissions:0,retasks:0,errors:0},sel:null,arm:null,planAt:[0,0],warn:{}};
let errs=0;
function fail(e){S.stats.errors++;if(++errs<=3)console.error('airbase.js:',e);if(errs>=12){S.on=false;console.error('airbase.js desligado após erros repetidos')}}
const live=a=>a&&!a.dead&&!a.gone;
const C=()=>window.PXCOMM;
Object.assign(T.KIND,{
 runway:{name:'Pista do aeródromo',mat:'earth',hp:900,w:960,h:60,value:55,flam:0,f:1},
 hangar:{name:'Hangar',mat:'wood',hp:520,w:150,h:90,value:45,flam:.8},
 afuel:{name:'Combustível do aeródromo',mat:'steel',hp:420,w:70,h:50,value:45,flam:1},
 amdump:{name:'Munição do aeródromo',mat:'brick',hp:380,w:84,h:60,value:40,flam:.2,f:1},
 tower:{name:'Torre de controle',mat:'canvas',hp:350,w:60,h:50,value:40,flam:.6,f:1},
 aaa:{name:'Bateria antiaérea do aeródromo',mat:'steel',hp:260,w:46,h:40,value:40,flam:0,f:1}});

/* ---------- instalações ---------- */
function build(){
 S.fac=[[],[]];S.craters=[];
 const AF=A.airfields?.()||[];
 for(const team of [0,1]){const f=AF[team];if(!f)continue;const K=T.KIND,mk=(kind,x,y,extra={})=>{const k=K[kind];return Object.assign({kind,team,x,y,hp:k.hp,max:k.hp,dead:false,hit:-99,seed:Math.round(x+y)},extra)};
  S.fac[team].push(mk('runway',f.x,f.y,{w:f.half*2}));
  (f.hangars||[]).forEach((h,i)=>S.fac[team].push(mk('hangar',h.x,h.y,{idx:i})));
  if(f.truck)S.fac[team].push(mk('afuel',f.truck.x,f.truck.y));
  if(f.dump)S.fac[team].push(mk('amdump',f.dump.x,f.dump.y));
  if(f.ops)S.fac[team].push(mk('tower',f.ops.x,f.ops.y));
  const side=team?-1:1;
  S.fac[team].push(mk('aaa',f.x-side*620,f.y-250,{cd:rnd(0,1)}));S.fac[team].push(mk('aaa',f.x+side*420,f.y+170,{cd:rnd(0,1)}))}
}
T.addSource(out=>{for(const team of [0,1])for(const p of S.fac[team])out.push({ref:p,kind:p.kind,team,x:p.x,y:p.y,own:1,knownAll:1,name:T.KIND[p.kind].name})});
const effOf=(team,kind)=>{let m=0;for(const p of S.fac[team])if(p.kind===kind&&p.hp>0)m=Math.max(m,clamp(p.hp/p.max,0,1));return m};
S.eff=effOf;
const runway=team=>S.fac[team].find(p=>p.kind==='runway');
const dead=(team,kind)=>S.fac[team].filter(p=>p.kind===kind&&p.hp<=0).length;

/* ---------- ganchos chamados pelo airwar.js ---------- */
S.aaPosts=()=>{const r=[];for(const team of [0,1])for(const p of S.fac[team])if(p.kind==='aaa'&&p.hp>0&&p.hp>p.max*.15)r.push(p);return r};
S.canLaunch=(team,kind,o)=>{
 if(!S.on)return true;
 const rw=runway(team);if(rw&&rw.hp<=rw.max*.34){if(team===playerTeam&&time-(S.warn.rw||-99)>20){S.warn.rw=time;toast('Pista do aeródromo danificada: sem decolagens até o reparo.')}S.stats.blocked++;return false}
 if(dead(team,'tower')&&time-S.lastLaunch[team]<S.cfg.TOWER_GAP&&kind!=='int'){S.stats.blocked++;return false}
 return true};
S.onLaunch=f=>{
 if(!S.on||!f)return;S.lastLaunch[f.team]=time;const fu=effOf(f.team,'afuel'),am=effOf(f.team,'amdump');
 for(const m of f.m){if(typeof m.fuel==='number')m.fuel=m.T.fuel*(.45+.55*fu);if(am<.999){if(Array.isArray(m.ammo))m.ammo=m.ammo.map(x=>Math.round(x*(.5+.5*am)));if(m.bombs)m.bombs=Math.max(1,Math.round(m.bombs*(.5+.5*am)))}}
 if(fu<.5&&f.team===playerTeam&&time-(S.warn.fu||-99)>40){S.warn.fu=time;toast('Combustível do aeródromo avariado: saídas com tanque parcial.')}
};
function hurtFac(p,raw,kind,team){
 if(p.hp<=0)return;const ent=T.list.find(e=>e.ref===p);
 if(ent)T.damage(ent,raw,kind,team);else p.hp-=raw;p.hit=time;
}
/* bomba em coordenada fora do mapa (o aeródromo fica no espaço aéreo de trás) */
S.bomb=(team,x,y,power,r)=>{
 if(!S.on)return;const foe=1-team,pw=power*2.2;
 for(const p of S.fac[foe]){const w=T.KIND[p.kind].w/2+r,h=T.KIND[p.kind].h/2+r;if(Math.abs(p.x-x)>w||Math.abs(p.y-y)>h)continue;
  hurtFac(p,pw*(1-Math.min(.8,hyp(p.x-x,p.y-y)/(Math.max(w,h)*1.3))),'bomb',team);
  if(p.kind==='runway'){S.stats.runwayHits++;if(S.craters.length<80)S.craters.push({x:clamp(x,p.x-p.w/2,p.x+p.w/2),y:p.y+rnd(-14,14),r:rnd(10,18),team:foe,t:time})}}
 // aviões estacionados no raio da explosão
 try{for(const a of A.planes()){if(a.team!==foe||!live(a)||a.st!=='park')continue;if(hyp(a.x-x,a.y-y)<r*.8&&Math.random()<.65&&A._internals?.down){A._internals.down(a,null,'bomba','break');S.stats.planesLost++}}}catch(e){}
 const rep=C();if(foe===playerTeam&&rep)rep.report(foe,null,'airfield','General, o aeródromo está sob bombardeio!',{kind:'alert',cd:40,speaker:'Oficial do aeródromo',x:x,y:y,short:'AERODROMO ATACADO!'});
 try{if(window.PXAWV?.blast)PXAWV.blast(x,y,r)}catch(e){}
};
S.strafe=(team,x,y)=>{if(!S.on)return;const foe=1-team;for(const p of S.fac[foe]){const k=T.KIND[p.kind];if(Math.abs(p.x-x)>k.w/2+10||Math.abs(p.y-y)>k.h/2+10)continue;hurtFac(p,20,'bullet',team);break}};

/* ---------- efeitos de perda ---------- */
function onStruct(ev){
 if(ev.type!=='destroyed')return;const e=ev.e,p=e.ref;if(!p||p.kind===undefined||!S.fac[p.team]?.includes(p))return;
 if(p.kind==='hangar'){S.stats.hangarsLost++;let n=0;try{for(const a of A.planes()){if(a.team!==p.team||!live(a)||a.st!=='park'||n>=2)continue;if(A._internals?.down){A._internals.down(a,null,'hangar','break');n++;S.stats.planesLost++}}}catch(x){}}
 const c=C();if(c)c.say(p.team,'Oficial do aeródromo',p.team===playerTeam?`General, perdemos ${p.kind==='runway'?'a pista':p.kind==='hangar'?'um hangar':p.kind==='afuel'?'o combustível':p.kind==='amdump'?'a munição':p.kind==='tower'?'a torre':'uma bateria antiaérea'} do aeródromo!`:`${T.KIND[p.kind].name} inimiga destruída.`,'alert',null,{immediate:true});
}
function crews(dt){
 for(const team of [0,1])for(const p of S.fac[team]){
  if(time-p.hit<S.cfg.REPAIR_AFTER)continue;
  if(p.hp>0&&p.hp<p.max){p.hp=Math.min(p.max,p.hp+(p.kind==='runway'?S.cfg.RUNWAY_REPAIR:S.cfg.REPAIR)*dt)}
  else if(p.hp<=0){p.rebuildT=(p.rebuildT||0)+dt;if(p.rebuildT>=S.cfg.REBUILD){p.rebuildT=0;p.hp=p.max*.35;const e=T.list.find(q=>q.ref===p);if(e){e.destroyed=false;e.smoke=0}}}}
 // crateras da pista fecham quando ela volta a ≥ 80 %
 const rw=runway(playerTeam);if(S.craters.length&&S.fac.every(f=>{const r=f.find(p=>p.kind==='runway');return !r||r.hp>r.max*.8}))S.craters.length=0;
}
const _noop=0;void _noop;

/* ---------- IA aérea estratégica ---------- */
function aaNear(team,x,y,r=520){let n=0;for(const e of T.list)if(e.team===team&&!e.destroyed&&(e.kind==='aa'||e.kind==='aaa')&&hyp(e.x-x,e.y-y)<r)n++;return n}
function plan(team){
 const AC_=window.IronFrontAirCommand;if(!AC_||!AC_.request||!aiEnabled[team]||time<S.planAt[team]||time<150)return;S.planAt[team]=time+S.cfg.PLAN_EVERY;
 if(window.PXFORT?.isPrep?.())return;
 const foe=1-team,cand=[];
 for(const e of T.list){if(e.team!==foe||e.destroyed||!T.known(e,team))continue;
  const bombable=['gun','hq','depot','comms','fuel','hospital','medpost','wdepot','hangar','afuel','amdump','runway','tower'].includes(e.kind),strafable=['aa','gun','medpost','wdepot'].includes(e.kind);
  const aa=aaNear(foe,e.x,e.y);let sc=e.value+(e.kind==='gun'?30:0)+(e.kind==='hangar'?15:0)-aa*40;
  if(aa>=S.cfg.AA_AVOID)sc-=80;if(sc<10)continue;cand.push({e,sc,bomb:bombable,strafe:strafable,aa})}
 // aeródromo inimigo vale a pena com ≥3 aviões no chão e antiaérea reduzida
 const parked=A.planes().filter(a=>a.team===foe&&live(a)&&a.st==='park').length;
 cand.sort((a,b)=>b.sc-a.sc);const best=cand.find(c=>c.bomb&&(c.e.value>=40)&&(!(c.e.kind==='hangar'||c.e.kind==='runway'||c.e.kind==='tower')||parked>=3));
 if(best&&A.available(team,'bmb')){const f=AC_.request(team,'bmb',best.e.x,best.e.y,{reason:`Destruir ${best.e.name.toLowerCase()}`});if(f){S.stats.aiMissions++;return}}
 const s=cand.find(c=>c.strafe&&c.aa<S.cfg.AA_AVOID);if(s&&A.available(team,'atk')){const f=AC_.request(team,'atk',s.e.x,s.e.y,{reason:`Atacar ${s.e.name.toLowerCase()}`});if(f)S.stats.aiMissions++}
}

/* ---------- painel AIR OPERATIONS ---------- */
let box=null,hint=null;
const MISS={cap:'Patrulha',int:'Interceptação',esc:'Escolta',atk:'Ataque ao solo',bmb:'Bombardeio',rec:'Reconhecimento'};
const ACT=[['cap','PATRULHA'],['atk','ATAQUE AO SOLO'],['bmb','BOMBARDEIO'],['rec','RECONHECIMENTO'],['int','INTERCEPTAÇÃO']];
function ui(){
 if(box||typeof document==='undefined')return;
 const st=document.createElement('style');st.textContent=`
#airOps{position:absolute;right:.6rem;top:6.1rem;width:min(250px,40vw);background:rgba(10,13,8,.86);color:#e7eadb;font:10px 'IBM Plex Mono',monospace;padding:.35rem .45rem;box-shadow:0 0 0 2px #000;display:none;z-index:5;pointer-events:auto}
#airOps h4{margin:0 0 .25rem;font:700 10px 'IBM Plex Mono',monospace;color:#c5db91;letter-spacing:.08em}
#airOps .fl{display:block;width:100%;text-align:left;font:10px 'IBM Plex Mono',monospace;background:#1d2418;color:#e7eadb;border:0;padding:.2rem .3rem;margin-bottom:2px;cursor:pointer;box-shadow:0 0 0 1px #000}
#airOps .fl.sel{background:#3d4a2a}#airOps .fl small{color:#929b87;display:block}#airOps .fl.cb{border-left:3px solid #d2603e}#airOps .fl.rt{border-left:3px solid #d4b04a}
#airOps .acts{display:flex;flex-wrap:wrap;gap:3px;margin-top:.3rem}#airOps .acts button{font:700 9px 'IBM Plex Mono',monospace;background:#2a3322;color:#e7eadb;border:0;padding:.2rem .35rem;cursor:pointer;box-shadow:0 0 0 1px #000}
#airOps .acts button.off{opacity:.4}#airOps .acts button.armed{background:#6a5a22}
#airHint{position:absolute;left:50%;transform:translateX(-50%);top:6.4rem;background:rgba(80,60,20,.92);color:#fff;font:700 11px 'IBM Plex Mono',monospace;padding:.3rem .7rem;box-shadow:0 0 0 2px #000;display:none;z-index:7}
@media(max-width:700px){#airOps{top:11rem;font-size:9px}}`;
 document.head.append(st);box=document.createElement('div');box.id='airOps';box.setAttribute('aria-label','Operações aéreas');
 hint=document.createElement('div');hint.id='airHint';document.body.append(box,hint);
}
const phaseLabel=f=>{const lead=f.m.find(live);if(f.phase==='start'||f.phase==='assemble')return 'Decolando';if(f.phase==='home')return 'Retornando';
 const fighting=f.m.some(m=>live(m)&&m.air&&m.tgt&&live(m.tgt)&&hyp(m.x-m.tgt.x,m.y-m.tgt.y)<900&&(m.T.cls==='f'||m.mode==='fight'));
 if(fighting)return 'Em combate';if(f.phase==='out')return 'Em rota';return {cap:'Em patrulha',int:'Interceptando',esc:'Escoltando',atk:'Atacando',bmb:'Bombardeando',rec:'Reconhecendo'}[f.kind]||'Em missão'};
const flightName=f=>{const n={};for(const m of f.m)if(live(m))n[m.T.name]=(n[m.T.name]||0)+1;return Object.entries(n).map(([k,v])=>v>1?`${v}× ${k}`:k).join(', ')||'—'};
function canDo(f,kind){const ms=f.m.filter(live);if(!ms.length)return false;
 if(kind==='bmb')return ms.some(m=>m.bombs>0);if(kind==='atk')return ms.some(m=>(m.bombs>0||m.T.guns>0)&&m.T.cls!=='B');if(kind==='rec')return ms.some(m=>m.T.recon);return ms.some(m=>m.T.cls==='f'||m.T.cls==='a'||m.T.guns>0)}
S.retask=(f,kind,x,y)=>{
 if(!f||f.done||!canDo(f,kind)||!MISS[kind])return false;
 const alt=kind==='atk'?380:kind==='rec'?950:kind==='bmb'?950:850;
 f.kind=kind;f.area={x,y,alt,dur:kind==='cap'?70:999};f.alt=alt;f.phase='out';f.until=time+(kind==='cap'?70:999);f.passes=0;f.target=null;
 for(const m of f.m){if(!live(m))continue;m.run=null;m.salvo=0;m.mode='form';m.tgt=null}
 S.stats.retasks++;if(f.team===playerTeam)toast(`${flightName(f)}: ${MISS[kind].toLowerCase()} em ${C()?.gridRef(x,y)||'alvo'}.`);return true};
function paint(){
 ui();if(!box)return;const fl=started&&!ended&&A.on?A.flights().filter(f=>f.team===playerTeam&&!f.done&&f.m.some(live)):[];
 if(!fl.length){S.sel=null;S.arm=null;if(box.style.display!=='none'){box.style.display='none';hint.style.display='none'}return}
 if(S.sel&&!fl.includes(S.sel)){S.sel=null;S.arm=null}
 let html='<h4>AIR OPERATIONS</h4>';
 fl.forEach((f,i)=>{const ph=phaseLabel(f);html+=`<button class="fl${f===S.sel?' sel':''}${ph==='Em combate'?' cb':ph==='Retornando'?' rt':''}" data-i="${i}">${flightName(f)}<small>${MISS[f.kind]||f.kind} · ${ph}</small></button>`});
 if(S.sel){html+='<div class="acts">'+ACT.map(([k,l])=>`<button data-a="${k}" class="${canDo(S.sel,k)?'':'off'}${S.arm===k?' armed':''}">${l}</button>`).join('')+'</div>'}
 if(box._h!==html){box._h=html;box.innerHTML=html;
  for(const b of box.querySelectorAll('.fl'))b.onclick=()=>{S.sel=fl[+b.dataset.i];S.arm=null;box._h='';paint()};
  for(const b of box.querySelectorAll('[data-a]'))b.onclick=()=>{if(b.classList.contains('off')){toast('Esta aeronave não pode cumprir essa missão.');return}S.arm=b.dataset.a;box._h='';paint()}}
 box.style.display='block';
 hint.style.display=S.arm?'block':'none';if(S.arm)hint.textContent=`${MISS[S.arm].toUpperCase()}: clique no mapa para marcar o alvo (ESC cancela)`;
}
function install(){
 const canvas=document.getElementById('game');if(!canvas)return;
 window.addEventListener('pointerdown',ev=>{if(!S.arm||ev.target!==canvas||ev.button!==0||!S.sel)return;
  const r=canvas.getBoundingClientRect();mouse.x=(ev.clientX-r.left)*vw/r.width;mouse.y=(ev.clientY-r.top)*vh/r.height;worldMouse();
  const ok=S.retask(S.sel,S.arm,mouse.wx,mouse.wy);if(ok){S.arm=null;box._h=''}ev.stopImmediatePropagation();ev.preventDefault();paint()},true);
 window.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&S.arm){S.arm=null;if(box)box._h='';paint();ev.stopImmediatePropagation()}},true);
}

/* ---------- desenho: crateras da pista, instalações sem arte própria ---------- */
if(window.WW1A){const over=WW1A.over;WW1A.over=function(c,ox,oy,dt){over.call(this,c,ox,oy,dt);if(!S.on||!started)return;
 try{const Z=(window.PX&&PX.Z)||.5;
  for(const k of S.craters){const x=ox+Math.round(k.x*Z),y=oy+Math.round(k.y*Z);if(x<-20||y<-20||x>vw+20||y>vh+20)continue;c.fillStyle='#2a2218';c.fillRect(x-Math.round(k.r*Z),y-Math.round(k.r*Z*.6),Math.round(k.r*Z*2),Math.round(k.r*Z*1.2));c.fillStyle='#463a2a';c.fillRect(x-Math.round(k.r*Z)+1,y-Math.round(k.r*Z*.6)+1,Math.round(k.r*Z*2)-2,2)}
  for(const team of [0,1])for(const p of S.fac[team]){if(p.kind!=='aaa'||p.hp<=0)continue;const x=ox+Math.round(p.x*Z),y=oy+Math.round(p.y*Z);if(x<-20||y<-20||x>vw+20||y>vh+20)continue;
   c.fillStyle='#14160f';c.fillRect(x-8,y-5,16,10);c.fillStyle='#8a7a58';c.fillRect(x-7,y-4,14,8);c.fillStyle='#3a3e34';c.fillRect(x-3,y-2,6,4);c.fillStyle='#bfc4b0';c.fillRect(x,y-8,1,6)}
 }catch(e){fail(e)}}}

/* ---------- ligações ---------- */
const update0=window.update;let pT=0,cT=0,aT=0;
window.update=function(dt){const r=update0.apply(this,arguments);if(!S.on||!started||ended||!(dt>0))return r;
 try{if(!S.fac[0].length&&!S.fac[1].length&&(A.airfields?.()||[]).some(Boolean))build();
  crews(dt);if((pT-=dt)<=0){pT=.5;paint()}if((aT-=dt)<=0){aT=3;plan(0);plan(1)}}catch(e){fail(e)}return r};
const setup0=window.setup;
window.setup=function(){S.fac=[[],[]];S.craters=[];S.lastLaunch=[-99,-99];S.planAt=[0,0];S.sel=null;S.arm=null;return setup0.apply(this,arguments)};
T.listen(onStruct);
S.state=()=>({on:S.on,fac:S.fac.map(f=>f.map(p=>({k:p.kind,hp:Math.round(p.hp),max:p.max}))),craters:S.craters.length,stats:{...S.stats}});
window.IronFront=window.IronFront||{};window.IronFront.airbase=S;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
