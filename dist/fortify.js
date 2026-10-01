'use strict';
/* Iron Front 1.5 — fortificação de campo: fase de preparação, catálogo de construções e IA construtora.
   Carrega DEPOIS de sappers.js e assault.js (e antes do ui-art.js). Usa o sistema de obras do sappers.js (projetos em estágios,
   pioneiros, âncoras de trincheira) e acrescenta tipos novos; peças de artilharia viram baterias tripuladas do battery.js
   (PXBAT.addGun). Não altera game.js: envolve setup / update / shoot / aiGrenade / grenade / runCommander / place /
   protectedBy / explode / makeCards / icon e desenha em WW1A.under/over.
   Preparação ... "A Última Trincheira" sem fortificações (PX.WW1.CLEAN.forts=false): 300 s de trégua com barreira no centro,
                  sem tiro nem apoio; cada lado recebe um orçamento e TODA a infantaria ajuda a cavar (equipes de até 6).
                  Ao fim: apito, a barreira cai e o comando da IA assume as posições construídas.
   Catálogo ..... trincheira de tiro, de comunicação, arame, sacos de areia, ninho de MG (com guarnição), bunker de madeira,
                  casamata de concreto, abrigo subterrâneo, poço de morteiro, antiaérea, canhão de campanha 75 mm e obuseiro.
   IA ........... plano de defesa em profundidade (primeira linha em zigue-zague com arame à frente, MGs cruzando fogo, abrigos,
                  bunkers, linha de apoio com morteiros, artilharia e antiaérea na retaguarda), construído por prioridade com o
                  orçamento; depois da trégua repõe o que for destruído e reforça a defesa antiaérea se for atacada do ar.
   ?preparo=N muda a duração (0 desliga) · ?fortificar=0 desliga a camada · PXFORT.state(). */
(function(){
if(!window.PX||!window.PXSAP)return;
const SAP=window.PXSAP,K=SAP.cfg.KIND,Z=PX.Z||.5,hyp=Math.hypot,TAU=Math.PI*2;
const rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>v<a?a:v>b?b:v;
const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('fortify.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};
const rect=(c,x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h)};
const face=t=>t?-1:1;
const qs=new URLSearchParams(location.search);

const CFG={
 PREP:qs.has('preparo')?Math.max(0,+qs.get('preparo')||0):300,
 BUDGET:4500,
 WORKX:2.6,                                  // ritmo de obra na trégua: toda a tropa cavando, sem fogo inimigo
 WORKX_WAR:1.6,                              // ritmo dos pioneiros depois da trégua
 BARRIER:[1130,1270],
 FX:720,                                     // linha de frente planejada (lado 0; o lado 1 é espelhado)
 PREP_CREW:6,
 AA:{range:430,cd:.25,hit:{fighter:.22,bomber:.2},hp:{fighter:2,bomber:3},recon:22,hpPost:300},   // um caça cruza o alcance em ~2 s: ~50% de abate por antiaérea
 GUNHP:520
};
const S=window.PXFORT={on:!/[?&]fortificar=0/.test(location.search),version:'1.5',cfg:CFG,stats:{errors:0,built:0,rebuilt:0,downed:0,aaShots:0}};
let PH={on:false,end:0,warned:0},AAS=[],GUNS=[],DUGS=[],POSTED=[],QUEUE=[[],[]],DONE=[[],[]],auto=[false,false],bT=[0,0],rT=0,errs=0,airSeen=[-99,-99],banner=null;
function fail(e){S.stats.errors++;if(++errs<=3)console.error('fortify.js:',e);if(errs>=12){S.on=false;console.error('fortify.js desligado após erros repetidos')}}
function pay(team,n){if(sandbox)return true;if(supplies[team]<n)return false;supplies[team]-=n;return true}
const noForts=()=>{try{return map==='trenches'&&PX.WW1&&PX.WW1.CLEAN&&PX.WW1.CLEAN.forts===false}catch{return false}};
const active=()=>S.on&&noForts();
const X=(t,x)=>t?W-x:x;
const dry=(x,y)=>!(window.PXW&&PXW.depth&&PXW.depth(x,y)>=.12);
function dryAt(x,y){for(let k=0;k<12;k++){const yy=y+(k%2?1:-1)*Math.ceil(k/2)*18;if(dry(x,yy))return[x,clamp(yy,40,H-40)]}return[x,y]}

/* ======================================================================================
   CATÁLOGO (tipos novos no sistema de obras do sappers.js)
   ====================================================================================== */
const mkc=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const hsh=(i,j)=>((i*73856093^j*19349663)>>>0)%97/97;
const EMPTY=mkc(1,1);
/* desenho do canteiro em pixels de arte: 0 planta tracejada (com a obra crescendo), 1 escavação, 2 estrutura, 3 pronto */
function siteSprite(s,shape,R){const st=s.stage,need=s.need[Math.min(st,s.need.length-1)],fr=st>=s.need.length?1:clamp(s.work/need,0,1),sz=R*2+10,c=mkc(sz,sz),g=c.getContext('2d'),o=sz>>1;
 const px=(x,y,col)=>{g.fillStyle=col;g.fillRect(o+x,o+y,1,1)};
 const inside=(x,y,r)=>shape==='rect'?Math.abs(x)<=r&&Math.abs(y)<=r*.8:x*x+y*y<=r*r;
 for(let y=-R-4;y<=R+4;y++)for(let x=-R-4;x<=R+4;x++){const n=hsh(x+50,y+50);
  if(st===0){const edge=inside(x,y,R)&&!inside(x,y,R-1);if(edge&&((x+y)&1))px(x,y,'#d9e0a6');else if(inside(x,y,R*fr))px(x,y,n<.5?'#4a3b28':'#56452f');continue}
  if(inside(x,y,R-1))px(x,y,st===1?(n<.5?'#2b231a':'#33291e'):'#221c15');
  else if(inside(x,y,R+.5))px(x,y,x+y<0?'#4d3f2b':'#1f1912');
  else if(inside(x,y,R+3)&&n<.75)px(x,y,n<.4?'#6d5b3f':'#5f4f36')}
 return{c,g,o,px,st}}
function bunkerSprite(s){const r=siteSprite(s,'rect',11),{g,o,st}=r;if(st>=2){g.fillStyle='#6b5436';g.fillRect(o-11,o-9,22,2);g.fillRect(o-11,o+7,22,2);g.fillRect(o-11,o-9,2,18);g.fillRect(o+9,o-9,2,18);
 g.fillStyle='#8a6d45';for(let i=-8;i<=8;i+=4)g.fillRect(o+i,o-7,1,14)}return r.c}
function pillSprite(s){const r=siteSprite(s,'rect',12),{g,o,st}=r;if(st>=2){g.fillStyle='#9a9c8e';g.fillRect(o-12,o-10,24,2);g.fillRect(o-12,o+8,24,2);g.fillRect(o-12,o-10,2,20);g.fillRect(o+10,o-10,2,20);
 g.fillStyle='#6b5436';for(let i=-9;i<=9;i+=3)g.fillRect(o+i,o-8,1,16)}return r.c}
function dugSprite(s){const r=siteSprite(s,'rect',7),{g,o,st}=r;if(st>=2){g.fillStyle='#5f4f36';g.fillRect(o-9,o-9,18,4);g.fillStyle='#0c0a08';g.fillRect(o-3,o-3,6,6);
 g.fillStyle='#7d6340';g.fillRect(o-4,o-4,8,1);g.fillRect(o-4,o-4,1,7);g.fillRect(o+3,o-4,1,7)}return r.c}
function ringSprite(s,R){const r=siteSprite(s,'circle',R),{g,o,st}=r;if(st>=3)g.clearRect(o-R+1,o-R+1,R*2-2,R*2-2);                 // peça pronta: o battery.js desenha a arma no poço
 if(st>=2)for(let a=0;a<64;a++){const x=Math.round(Math.cos(a/64*TAU)*(R+2)),y=Math.round(Math.sin(a/64*TAU)*(R+2)*.85);
 g.fillStyle=(a&3)?'#b5a57c':'#8f8060';g.fillRect(o+x,o+y,2,2)}return r.c}
function lineBlueprint(s){if(s.stage>=1)return EMPTY;const L=Math.ceil(s.len*Z),sz=L+8,c=mkc(sz,sz),g=c.getContext('2d'),o=sz/2;g.fillStyle='#d9e0a6';
 for(let t=-L/2;t<=L/2;t+=3){g.fillRect(Math.round(o+s.ax*t),Math.round(o+s.ay*t),1,1)}const f=clamp(s.work/s.need[0],0,1);g.fillStyle='#6b5436';
 for(let t=-L/2;t<-L/2+L*f;t+=6)g.fillRect(Math.round(o+s.ax*t)-1,Math.round(o+s.ay*t)-1,2,3);return c}
function pointBlueprint(s){if(s.stage>=1)return EMPTY;const c=mkc(12,20),g=c.getContext('2d');g.fillStyle='#d9e0a6';for(let y=0;y<20;y+=2){g.fillRect(0,y,1,1);g.fillRect(11,y,1,1)}
 const h=Math.round(16*clamp(s.work/s.need[0],0,1));g.fillStyle='#b5a57c';g.fillRect(3,18-h,6,h);return c}

function anchorAt(s,o){return SAP.addAnchor(s,o)}
function bldAt(s,type,dx=0,dy=0){const b=newBuilding(type,s.team,clamp(s.x+dx,20,W-20),clamp(s.y+dy,20,H-20));return b}
Object.assign(K,{
 comm:{need:[8,20],target:2,cost:6,line:1,anchorLine:'comm',label:'Trincheira de comunicação: arraste uma linha'},
 wire:{need:[5],target:1,cost:18,line:1,step:42,noAnchor:1,label:'Arame farpado: arraste uma linha',sprite:lineBlueprint,onStage:s=>{SAP.lineB(bldAt(s,'wire'),s.ax,s.ay,s.len)}},
 sandbag:{need:[5],target:1,cost:30,label:'Sacos de areia (parede de frente para o inimigo): clique',box:{hw:9,hh:16},sprite:pointBlueprint,onStage:s=>{SAP.bag(s.team,s.x,s.y,true,0,1,32)}},
 bunker:{need:[12,30,55],target:3,cost:200,label:'Bunker de madeira com MG: clique',box:{hw:24,hh:22},sprite:bunkerSprite,
  onStage:(s,st)=>{if(st===2)anchorAt(s,{hw:22,hh:20,slots:2,pk:.9,line:'front'});if(st===3){const b=bldAt(s,'bunker');b.kind='wood';s.b=b;built(s)}}},
 pillbox:{need:[15,40,80],target:3,cost:340,label:'Casamata de concreto com MG: clique',box:{hw:26,hh:24},sprite:pillSprite,
  onStage:(s,st)=>{if(st===2)anchorAt(s,{hw:24,hh:22,slots:2,pk:.95,line:'front'});if(st===3){const b=bldAt(s,'bunker');b.kind='concrete';b.hp=b.maxhp=2400;s.b=b;built(s)}}},
 dugout:{need:[10,26],target:2,cost:70,label:'Abrigo subterrâneo: clique',box:{hw:16,hh:14},sprite:dugSprite,
  onStage:(s,st)=>{if(st===2){anchorAt(s,{hw:16,hh:13,slots:3,pk:.95,line:'support'});DUGS.push(s);built(s)}}},
 aa:{need:[10,24,40],target:3,cost:180,label:'Antiaérea: clique',box:{hw:16,hh:16},sprite:s=>ringSprite(s,8),
  onStage:(s,st)=>{if(st===3){AAS.push({s,team:s.team,x:s.x,y:s.y,hp:CFG.AA.hpPost,cd:1,ang:-Math.PI/2,fl:0});built(s)}}},
 gunf:{need:[14,34,60],target:3,cost:240,label:'Canhão de campanha 75 mm: clique',box:{hw:22,hh:18},sprite:s=>ringSprite(s,11),onStage:(s,st)=>gunStage(s,st,'f')},
 gunh:{need:[16,40,70],target:3,cost:320,label:'Obuseiro 155 mm: clique',box:{hw:24,hh:20},sprite:s=>ringSprite(s,13),onStage:(s,st)=>gunStage(s,st,'h')}});
K.trench.label='Trincheira de tiro: arraste uma linha';
K.nest.label='Ninho de metralhadora (com guarnição): clique';K.nest.cost=150;
K.mortar.label='Poço de morteiro: clique';
function gunStage(s,st,k){if(st!==3)return;const b=window.PXBAT&&typeof PXBAT.addGun==='function'?PXBAT.addGun(s.team,s.x,s.y,k):null;
 if(b){GUNS.push({s,b,team:s.team,x:s.x,y:s.y,hp:CFG.GUNHP});built(s)}else if(s.team===playerTeam)toast('Sem artilharia tripulada neste mapa: a peça ficou sem guarnição.')}
/* ninho de MG: a guarnição vem junto (a mais próxima livre, ou um esquadrão novo pela estrada) */
const nestStage=(s,st)=>{if(st===2)anchorAt(s,{hw:20,hh:18,slots:2,pk:.9,line:'front'});if(st!==3)return;const fc=face(s.team);
 SAP.bag(s.team,s.x+fc*20,s.y,true,0,1,40);s.bags=1;
 let crew=units.filter(u=>u.team===s.team&&u.type==='mg'&&u.hp>0&&!u.post&&u!==player).sort((a,b)=>hyp(a.x-s.x,a.y-s.y)-hyp(b.x-s.x,b.y-s.y)).slice(0,3).filter(u=>hyp(u.x-s.x,u.y-s.y)<900);
 if(crew.length<2){const rx=PX.WW1&&PX.WW1.reinforceX?PX.WW1.reinforceX(s.team):X(s.team,350),n0=units.length;squad('mg',s.team,rx,clamp(s.y,120,H-120),3);crew=units.slice(n0)}
 crew.forEach((u,i)=>{u.post={x:s.x-fc*6,y:s.y+(i-1)*9,s};POSTED.push(u)});built(s)};
K.nest.onStage=nestStage;
function built(s){S.stats.built++;const it=s.p.item;if(it){it.done=true;it.seg=s}}
const KINDS=['trench','comm','wire','sandbag','nest','bunker','pillbox','dugout','aid','mortar','aa','gunf','gunh'];
const SHORT={trench:'Trincheira',comm:'Comunicação',wire:'Arame',sandbag:'Sacos de areia',nest:'Ninho de MG',bunker:'Bunker',pillbox:'Casamata',dugout:'Abrigo',mortar:'Morteiro',aa:'Antiaérea',gunf:'Canhão 75',gunh:'Obuseiro 155'};
const SUB={trench:'Linha de tiro · ◈/trecho',comm:'Ligação · ◈/trecho',wire:'Linha · ◈/trecho',sandbag:'Parapeito avulso',nest:'Com guarnição de 3',bunker:'Madeira · MG · 1000',pillbox:'Concreto · MG · 2400',dugout:'Protege do bombardeio',mortar:'Fogo indireto 620 px',aa:'Derruba aviões',gunf:'Bateria tripulada',gunh:'Bateria pesada'};

/* ======================================================================================
   IA CONSTRUTORA — plano de defesa em profundidade
   ====================================================================================== */
function plan(t){const fc=face(t),FX=X(t,CFG.FX),it=[],J=()=>rnd(-14,14);
 const add=(kind,pts,pri,line)=>it.push({kind,pts:pts.map(([x,y])=>dryAt(clamp(x,30,W-30),clamp(y,40,H-40))),pri,line});
 /* 1 primeira linha: baías em zigue-zague, em lotes de ~240 px, do centro para os flancos */
 const zz=[];for(let y=70,i=0;y<=1530;y+=60,i++)zz.push([FX+(i%2?10:-10)*fc,y]);
 for(let i=0;i<zz.length-1;i+=4){const ch=zz.slice(i,i+5);if(ch.length>1)add('trench',ch,10+Math.abs(ch[0][1]-800)/800,'front')}
 /* 2 metralhadoras cruzando fogo nos pontos de acesso */
 for(const y of[220,520,800,1080,1380])add('nest',[[FX+fc*2,y+J()]],20+Math.abs(y-800)/1000);
 /* 3 arame 115 px à frente, com passagens nas estradas */
 for(const[a,b]of[[70,380],[460,760],[840,1150],[1230,1530]]){add('wire',[[FX+fc*115,a],[FX+fc*115,b]],30)}
 /* 4 artilharia na retaguarda (posições da antiga linha de baterias quando o mapa as oferece) */
 let gp=[];try{gp=(PX.WW1.layout().gunsPlan||[]).map(g=>({k:g.k,x:g.x*2+4,y:g.y*2}))}catch{}
 if(!gp.length)gp=[{k:'f',x:330,y:420},{k:'f',x:330,y:800},{k:'f',x:330,y:1180},{k:'h',x:240,y:600},{k:'h',x:240,y:1000}];
 gp.forEach((g,i)=>add(g.k==='h'?'gunh':'gunf',[[X(t,g.x),g.y]],(g.k==='h'?60:40)+i*.1));
 /* 5 abrigos logo atrás da linha, bunkers nos flancos, casamata no centro */
 for(const y of[330,660,940,1270])add('dugout',[[FX-fc*45,y+J()]],45);
 for(const y of[640,960])add('bunker',[[FX-fc*4,y]],48);
 add('pillbox',[[FX-fc*18,800]],52);
 /* 6 linha de apoio com morteiros e ligações */
 for(const y of[420,800,1180])add('mortar',[[FX-fc*150,y+J()]],50);
 for(const y of[610,990])add('aa',[[X(t,400),y]],55);
 const sup=[];for(let y=180,i=0;y<=1420;y+=70,i++)sup.push([FX-fc*(95+(i%2?8:-8)),y]);
 for(let i=0;i<sup.length-1;i+=5)add('comm',sup.slice(i,i+6),65,'support');
 for(const y of[400,800,1200])add('comm',[[FX-fc*95,y+30],[FX-fc*50,y+40],[FX-fc*12,y+30]],70,'comm');
 add('aa',[[X(t,300),800]],75);
 for(const f of S.planExtra)try{for(const e of f(t,FX,fc))add(e.kind,e.pts,e.pri,e.line)}catch(e){fail(e)}
 return it.filter(i=>K[i.kind]).sort((a,b)=>a.pri-b.pri)}
function startBuilder(t){QUEUE[t]=plan(t);DONE[t]=[];bT[t]=0;EXTRA[t]=false}
/* sobrou trégua e dinheiro: segunda leva — 2ª faixa de arame, linha de reserva, ninhos intermediários, mais abrigos e antiaérea */
let EXTRA=[false,false];
function plan2(t){const fc=face(t),FX=X(t,CFG.FX),it=[],add=(kind,pts,pri,line)=>it.push({kind,pts:pts.map(([x,y])=>dryAt(clamp(x,30,W-30),clamp(y,40,H-40))),pri,line});
 for(const y of[360,660,940,1240])add('nest',[[FX+fc*2,y]],1);
 for(const[a,b]of[[70,380],[460,760],[840,1150],[1230,1530]]){add('wire',[[FX+fc*165,a],[FX+fc*165,b]],2)}
 for(const y of[200,520,800,1100,1400])add('dugout',[[FX-fc*110,y]],3);
 const res=[];for(let y=220,i=0;y<=1380;y+=70,i++)res.push([FX-fc*(190+(i%2?8:-8)),y]);for(let i=0;i<res.length-1;i+=5)add('comm',res.slice(i,i+6),4,'support');
 for(const y of[300,1300])add('aa',[[X(t,430),y]],5);
 for(const y of[600,1000])add('mortar',[[FX-fc*170,y]],6);
 return it}
function costOf(it){const k=K[it.kind];return k.line?SAP._.segment(it.pts,k.step||SAP.cfg.SEG).length*k.cost:k.cost}
function liveFort(t){return SAP.projects.filter(p=>!p.done&&p.team===t&&p.src==='fort')}
function builderTick(t){
 const q=QUEUE[t];if(!q.length&&PH.on&&!PH.deploy&&!EXTRA[t]&&(sandbox||supplies[t]>400)){EXTRA[t]=true;q.push(...plan2(t))}if(!q.length)return;const workers=units.filter(u=>u.team===t&&u.sap&&u.hp>0).length;
 const maxA=PH.on?clamp(Math.ceil(workers/5),2,14):clamp(Math.ceil(workers/3),1,4);
 let act=liveFort(t).length;
 while(q.length&&act<maxA){const it=q[0],c=costOf(it);if(!pay(t,c))break;q.shift();
  const p=SAP.project(t,it.kind,'fort',it.pts,{keep:true,line:it.line});if(p){p.item=it;it.p=p;DONE[t].push(it);act++}}}
/* depois da trégua: repõe o que caiu e responde ao ataque aéreo */
function maintain(t){const fc=face(t);
 for(const it of DONE[t]){if(!it.done||it.requeued)continue;const s=it.seg;let lost=false;
  if(s&&s.b&&s.b.hp<=0)lost=true;
  if((it.kind==='gunf'||it.kind==='gunh')&&s&&!GUNS.some(g=>g.s===s))lost=true;
  if(it.kind==='aa'&&s&&!AAS.some(a=>a.s===s))lost=true;
  if(lost){it.requeued=true;QUEUE[t].unshift({kind:it.kind,pts:it.pts,pri:0,line:it.line});S.stats.rebuilt++}}
 if(time-airSeen[t]<30&&AAS.filter(a=>a.team===t).length+QUEUE[t].filter(i=>i.kind==='aa').length<5){
  QUEUE[t].unshift({kind:'aa',pts:[dryAt(X(t,CFG.FX-260),rnd(250,1350))],pri:0});airSeen[t]=-99}}

/* ======================================================================================
   ANTIAÉREA, PEÇAS, ABRIGOS, GUARNIÇÕES
   ====================================================================================== */
function aaTick(dt){if(PH.on)return;const A=CFG.AA,FLP=window.PXFL&&typeof PXFL.planes==='function'?PXFL.planes():[];
 for(const a of AAS){a.fl=Math.max(0,a.fl-dt);a.cd-=dt;if(a.cd>0)continue;a.cd=A.cd;let tgt=null,bd=A.range;
  for(const p of planes){if(p.team===a.team||p.delay>0||p.downed)continue;const d=hyp(p.x-a.x,p.y-a.y);if(d<bd){bd=d;tgt=p}}
  let rec=null;if(!tgt)for(const p of FLP){if(p.team===a.team||p.st==='down')continue;const d=hyp(p.x-a.x,p.y-a.y);if(d<bd){bd=d;rec=p}}
  const T=tgt||rec;if(!T){a.ang+=(-Math.PI/2-a.ang)*Math.min(1,dt*2);continue}
  if(T.team!==a.team)airSeen[a.team]=time;
  a.ang=Math.atan2(T.y-a.y-60,T.x-a.x);a.fl=.08;S.stats.aaShots++;
  particles.push({x:T.x+rnd(-26,26),y:T.y-30+rnd(-20,20),vx:rnd(-6,6),vy:rnd(-6,0),t:.7,max:.7,color:'#3d3a33',size:6});
  if(Math.random()<.2&&hyp(a.x-cam.x,a.y-cam.y)<700)sound('shot');
  if(tgt){if(Math.random()<(A.hit[tgt.kind]||.07)){tgt.ahp=(tgt.ahp??(A.hp[tgt.kind]||3))-1;particles.push({x:tgt.x,y:tgt.y,vx:0,vy:0,t:.2,max:.2,color:'#ffd27a',size:5});if(tgt.ahp<=0)downPlane(tgt,a.team)}}
  else if(rec&&window.PXFL&&typeof PXFL.hitPlane==='function'&&Math.random()<.12)PXFL.hitPlane(rec,A.recon,a.team)}
 AAS=AAS.filter(a=>a.hp>0)}
function downPlane(p,by){p.downed=true;S.stats.downed++;
 for(let i=0;i<18;i++)particles.push({x:p.x,y:p.y,vx:rnd(-60,60),vy:rnd(-60,30),t:rnd(.4,1.1),max:1.1,color:i%2?'#ff9b32':'#3d3a33',size:rnd(3,7)});
 shells.push({x:clamp(p.x+(p.team?-60:60),20,W-20),y:clamp(p.y+30,20,H-20),t:1.4,r:40,power:60,team:by});
 if(p.kind==='bomber')shells=shells.filter(s=>!(s.bomb&&s.bomb.team===p.team&&Math.abs(s.bomb.ry-p.y)<70&&s.t>s.bomb.fall));
 p.x=p.team?-9999:W+9999;
 try{toast(by===playerTeam?'Avião inimigo abatido pela antiaérea!':'Nossa aviação perdeu um avião para a antiaérea inimiga.')}catch{}
 if(typeof teamKills!=='undefined')teamKills[by]++}
function postsTick(){for(const u of POSTED){if(u.hp<=0||!u.post)continue;if(u.manualUntil>time&&u.manualUntil!==u.postStamp){u.post=null;continue}
 if(!hold()&&aiEnabled[u.team]&&window.IronFrontBrain?.operations){u.post=null;if(u.manualUntil===u.postStamp)u.manualUntil=0;continue}
 const d=hyp(u.x-u.post.x,u.y-u.post.y);if(d>10){u.tx=u.post.x;u.ty=u.post.y;u.order='move'}else if(u.order==='attack'){u.order='hold';u.tx=u.x;u.ty=u.y}
 u.manualUntil=u.postStamp=time+3;u.aiRole=u.type==='mg'?'ninho':'guarnição'}
 POSTED=POSTED.filter(u=>u.hp>0&&u.post)}

/* ======================================================================================
   FASE DE PREPARAÇÃO
   ====================================================================================== */
function tempSappers(){for(const u of units)if((u.type==='rifle'||u.type==='mg')&&u.hp>0&&!u.sap&&!u.post){u.sap=1;u.sapTmp=1}}
function startPrep(){PH.on=true;PH.end=time+CFG.PREP;PH.warned=0;PH.deploy=CFG.PREP<=40;SAP.hold=true;if(window.PXAS)PXAS.hold=true;
 SAP.cfg.CREW=CFG.PREP_CREW;SAP.cfg.WORKX=CFG.WORKX;SAP.cfg.MAXPROJ.player=40;SAP.cfg.MAXSEGS=170;SAP.cfg.MAXBAGS=90;K.trench.anchorLine='front';
 if(!sandbox){supplies[0]=CFG.BUDGET;supplies[1]=CFG.BUDGET}tempSappers();
 for(let t=0;t<2;t++){auto[t]=!!aiEnabled[t];if(auto[t])startBuilder(t);else{QUEUE[t]=[];DONE[t]=[]}}
 toast(`Preparação: ${Math.round(CFG.PREP)} s de trégua. Construa sua defesa (aba DEFESAS) — a IA inimiga está fortificando.`)}
function releaseTemp(){for(const u of units){if(!u.sapTmp)continue;u.sap=0;u.sapTmp=0;if(u.sapJob){for(const p of SAP.projects){const i=p.crew.indexOf(u.id);if(i>=0)p.crew.splice(i,1)}u.sapJob=null;u.sapState=''}
  if(u.manualUntil===u.sapStamp)u.manualUntil=0}}
/* 40 s antes do apito: a tropa larga as pás e ocupa o que foi construído — primeira linha, ligações, apoio e abrigos */
const LINEPRI={front:0,sap:1,comm:2,support:3};
function deploy(){PH.deploy=true;releaseTemp();
 for(let t=0;t<2;t++){const slots=[];let gn=0;
  for(const a of fieldTrenches){if(a.team!==t)continue;const n=a.slots||1;for(let i=0;i<n;i++)slots.push({x:a.x+(n>1?(i-(n-1)/2)*10:0),y:a.y,pri:LINEPRI[a.line]??2})}
  slots.sort((a,b)=>a.pri-b.pri||Math.abs(a.y-800)-Math.abs(b.y-800));
  const free=units.filter(u=>u.team===t&&u.hp>0&&(u.type==='rifle'||u.type==='mg')&&!u.sap&&!u.post&&!(u===player&&mode==='soldier'));
  for(const sl of slots){if(!free.length)break;let bi=0,bd=Infinity;for(let i=0;i<free.length;i++){const d=hyp(free[i].x-sl.x,free[i].y-sl.y);if(d<bd){bd=d;bi=i}}
   const u=free.splice(bi,1)[0];u.tx=sl.x+rnd(-3,3);u.ty=sl.y+rnd(-3,3);u.order='move';u.target=null;u.aiRole='guarnição';u.manualUntil=u.depStamp=PH.end+4;
   /* metade da primeira linha fica de guarnição depois do apito (o resto o comando usa para atacar) */
   if(sl.pri===0&&(gn++)%2===0&&u.type==='rifle'){u.post={x:u.tx,y:u.ty};u.postStamp=u.manualUntil;POSTED.push(u)}}}
 toast('40 s para o apito: a tropa larga as pás e ocupa as posições.')}
function endPrep(){if(!PH.on)return;PH.on=false;SAP.hold=false;if(window.PXAS)PXAS.hold=false;
 SAP.cfg.CREW=3;SAP.cfg.WORKX=CFG.WORKX_WAR;SAP.cfg.MAXPROJ.player=8;K.trench.anchorLine=undefined;
 releaseTemp();
 try{SAP.refreshFront()}catch{}try{window.PXAS&&PXAS.refresh&&PXAS.refresh()}catch{}
 for(let t=0;t<2;t++)aiDecisionTimer[t]=0;
 whistleAll();toast('A trégua acabou! A barreira caiu — às armas!')}
function whistleAll(){const a=(()=>{try{return soundOn&&audio?audio:null}catch{return null}})();if(!a)return;
 for(let i=0;i<5;i++)try{const t=a.currentTime+i*.22+Math.random()*.1,o=a.createOscillator(),l=a.createOscillator(),lg=a.createGain(),g=a.createGain();o.frequency.value=2600+Math.random()*400;l.frequency.value=26;lg.gain.value=200;
  l.connect(lg);lg.connect(o.frequency);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.04,t+.03);g.gain.setValueAtTime(.04,t+.8);g.gain.linearRampToValueAtTime(0,t+.95);o.connect(g);g.connect(a.destination);o.start(t);l.start(t);o.stop(t+1);l.stop(t+1)}catch{}}
function prepTick(){if(!PH.on)return;const left=PH.end-time;
 if(left<=40&&!PH.deploy)deploy();
 if(left<=10&&!PH.warned){PH.warned=1;toast('10 segundos para o fim da trégua! Tropas às posições.')}
 if(left<=0)endPrep()}
function playerAuto(){const t=playerTeam;if(auto[t]){toast('O plano automático já está em andamento.');return}auto[t]=true;startBuilder(t);toast('Plano automático: os oficiais de engenharia vão fortificar o seu lado.')}

/* ---------- faixa de preparação (HUD) ---------- */
function ensureBanner(){if(banner)return banner;banner=document.createElement('div');banner.id='prepbanner';
 banner.style.cssText='position:fixed;top:62px;left:50%;transform:translateX(-50%);z-index:40;display:none;gap:8px;align-items:center;padding:6px 10px;background:rgba(20,23,18,.92);border:2px solid #c5db91;color:#e8e4c8;font:12px Silkscreen,monospace;letter-spacing:.5px;white-space:nowrap';
 banner.innerHTML='<span id="preptxt"></span><button id="prepauto" style="font:inherit;background:#2a3324;color:#e8e4c8;border:1px solid #849371;padding:2px 6px;cursor:pointer">PLANO AUTOMÁTICO</button><button id="prepgo" style="font:inherit;background:#4a3a1c;color:#ffe9a6;border:1px solid #c9a24a;padding:2px 6px;cursor:pointer">PRONTO (P)</button>';
 document.body.append(banner);banner.querySelector('#prepauto').onclick=playerAuto;banner.querySelector('#prepgo').onclick=()=>{if(PH.on)PH.end=Math.min(PH.end,time+3)};return banner}
function bannerTick(){try{const b=ensureBanner(),show=PH.on&&started&&!ended&&document.body.dataset.screen!=='title';b.style.display=show?'flex':'none';if(!show)return;
 const left=Math.max(0,PH.end-time),m=Math.floor(left/60),s=Math.floor(left%60),q=QUEUE[playerTeam].length,mine=SAP.projects.filter(p=>!p.done&&p.team===playerTeam).length;
 b.querySelector('#preptxt').textContent=`PREPARAÇÃO ${m}:${String(s).padStart(2,'0')} · ${mine} obra${mine===1?'':'s'}${q?` · ${q} na fila`:''}`;b.querySelector('#prepauto').style.display=auto[playerTeam]?'none':''}catch{}}

/* ======================================================================================
   LAÇO
   ====================================================================================== */
function tick(dt){
 if(!active()||!started||ended)return;
 prepTick();
 if(PH.on){if(!PH.deploy)tempSappers();
  for(const u of units){
   /* ninguém marcha contra a barreira: blindados e cavalaria ficam estacionados; ordem de ataque vira espera */
   const manual=u.team===playerTeam&&!aiEnabled[u.team]&&u.manualUntil>time&&u.manualUntil!==u.sapStamp;
   if(!u.sap&&!manual&&(u.order==='attack'||u.type==='tank'||u.type==='cavalry')){u.order='hold';u.tx=u.x;u.ty=u.y;u.target=null;u.chargeActive=false}
   const lim=CFG.BARRIER[u.team]-(u.type==='tank'?face(u.team)*40:0),over=u.team?u.x<lim:u.x>lim;
   if(over){u.x=lim;if(u.order==='move'&&(u.team?u.tx<lim:u.tx>lim)){u.order='hold';u.tx=u.x;u.ty=u.y}}}
  for(const b of bullets)b.t=-1;
  if(window.PXBAT&&PXBAT.batteries)for(const b of PXBAT.batteries)if(b.queue&&b.queue.length)b.queue.length=0;     // nem tiro de inquietação
  if(planes.length)planes.length=0}
 for(let t=0;t<2;t++){if(aiEnabled[t]&&!auto[t]){auto[t]=true;startBuilder(t)}if(!auto[t])continue;bT[t]-=dt;if(bT[t]<=0){bT[t]=1;builderTick(t)}}
 rT-=dt;if(rT<=0){rT=5;if(!PH.on)for(let t=0;t<2;t++)if(aiEnabled[t]||auto[t])maintain(t)}
 aaTick(dt);postsTick();
 for(const g of GUNS)if(g.hp<=0&&!g.gone){g.gone=true;if(window.PXBAT)PXBAT.removeGun(g.b);explodeFx(g.x,g.y)}GUNS=GUNS.filter(g=>!g.gone)}
function explodeFx(x,y){for(let i=0;i<20;i++)particles.push({x,y,vx:rnd(-90,90),vy:rnd(-90,40),t:rnd(.4,1.2),max:1.2,color:i%3?'#6b5a40':'#3d3a33',size:rnd(3,8)})}
function reset(){PH={on:false,end:0,warned:0,deploy:false};AAS=[];GUNS=[];DUGS=[];POSTED=[];QUEUE=[[],[]];DONE=[[],[]];auto=[false,false];bT=[0,0];rT=5;airSeen=[-99,-99];
 SAP.hold=false;if(window.PXAS)PXAS.hold=false;SAP.cfg.CREW=3;SAP.cfg.WORKX=CFG.WORKX_WAR;SAP.cfg.MAXPROJ.player=8;K.trench.anchorLine=undefined;
 if(active()&&started&&CFG.PREP>0)startPrep()}

/* ======================================================================================
   DESENHO
   ====================================================================================== */
function drawUnder(c,ox,oy){if(!active())return}
function drawOver(c,ox,oy){if(!active())return;
 if(PH.on){/* barreira da trégua: estacas e fita no centro do mapa */
  for(const wx of[(CFG.BARRIER[0]+CFG.BARRIER[1])/2]){const x=ox+Math.round(wx*Z);if(x<-4||x>vw+4)continue;
   for(let y=-((oy%6+6)%6);y<vh;y+=6)rect(c,x,y,1,3,((y-oy)/6|0)%2?'#e8e4c8':'#c0503a');
   for(let wy=40;wy<H;wy+=80){const y=oy+Math.round(wy*Z);if(y<-12||y>vh+4)continue;rect(c,x-1,y-6,2,7,'#6b5436');rect(c,x+1,y-6,4,2+(((time*3+wy)|0)%2),'#e8e4c8')}}}
 if(!S.customAA)for(const a of AAS){const x=ox+Math.round(a.x*Z),y=oy+Math.round(a.y*Z);if(x<-10||y<-10||x>vw+10||y>vh+10)continue;
  rect(c,x-3,y-2,6,4,'#3b3f36');rect(c,x-2,y-3,4,2,'#5a5f52');const ca=Math.cos(a.ang),sa=Math.sin(a.ang);
  for(let i=0;i<7;i++)rect(c,Math.round(x+ca*i),Math.round(y-2+sa*i*.7),1,1,i<5?'#2b2e28':'#555a4c');
  if(a.fl>0)rect(c,Math.round(x+ca*7)-1,Math.round(y-2+sa*5)-1,3,3,'#ffeab0')}}

/* ======================================================================================
   ENTRADA DO JOGADOR: cartas de DEFESAS = catálogo de obras (os pioneiros constroem)
   ====================================================================================== */
function setMode(kind){placement=null;SAP.ui.mode=SAP.ui.mode===kind?null:kind;SAP.ui.drag=null;makeCards();
 const h=document.getElementById('placehint');if(h)h.textContent=SAP.ui.mode?`${K[kind].label} · ◈ ${sandbox?'∞':K[kind].cost}${K[kind].line?'/trecho':''} · ESC cancela`:'Escolha uma unidade e posicione no campo';
 if(SAP.ui.mode)toast(`${SHORT[kind]}: ${K[kind].line?'arraste uma linha no campo':'clique no campo'}. Os pioneiros constroem.`)}
const ICON=new Map();
function iconFor(kind){if(ICON.has(kind))return ICON.get(kind);const fake={stage:K[kind].target,work:999,need:K[kind].need,len:30,ax:0,ay:1,team:playerTeam,kind,p:{}};let c=null;
 try{if(kind==='trench'||kind==='comm'||kind==='wire'||kind==='sandbag'||kind==='nest'||kind==='mortar')c=null;else c=K[kind].sprite(fake)}catch{}ICON.set(kind,c);return c}
wrap('makeCards',orig=>{orig();try{const box=document.getElementById('cards');if(box){const two=S.on&&tab==='build';box.style.flexWrap=two?'wrap':'';box.style.maxWidth=two?'37rem':'';box.style.rowGap=two?'.25rem':''}
 if(!S.on||tab!=='build')return;box.replaceChildren();
 KINDS.filter(k=>K[k]).forEach((kind,i)=>{const k=K[kind],b=document.createElement('button');b.className='card'+(SAP.ui.mode===kind?' active':'');
  b.innerHTML=`<canvas width="48" height="48"></canvas><b>${SHORT[kind]}</b><small>${SUB[kind]}</small><span class="cost">◈ ${sandbox?'∞':k.cost}</span>${i<10?`<kbd>${(i+1)%10}</kbd>`:''}`;
  b.style.minWidth='5.9rem';b.style.height='2.9rem';b.onclick=()=>setMode(kind);box.append(b);const cv=b.querySelector('canvas'),g=cv.getContext('2d');icon(kind,g)})}catch(e){fail(e)}});
wrap('icon',(orig,type,c)=>{if(!KINDS.includes(type))return orig(type,c);
 const base={trench:'trench',comm:'trench',wire:'wire',sandbag:'sandbag',nest:'mg',bunker:'bunker',pillbox:'bunker',mortar:'artillery',gunf:'artillery',gunh:'artillery',aa:'fighter',dugout:'trench'}[type];
 orig(base,c);const sp=iconFor(type);if(sp&&sp.width>1){const cv=c.canvas;c.imageSmoothingEnabled=false;const s=Math.min(2,(cv.width-12)/sp.width);c.globalAlpha=.9;c.drawImage(sp,(cv.width-sp.width*s)/2,(cv.height-sp.height*s)/2+4,sp.width*s,sp.height*s);c.globalAlpha=1}});
window.addEventListener('keydown',e=>{if(!S.on||e.repeat||document.querySelector('dialog[open]')||typeof started==='undefined'||!started||ended)return;const k=e.key.toLowerCase();
 if(k==='p'&&PH.on){PH.end=Math.min(PH.end,time+3);toast('Pronto: a trégua acaba em 3 s.');return}
 if(mode==='commander'&&tab==='build'&&/^[0-9]$/.test(k)){const i=(+k+9)%10,kind=KINDS.filter(k=>K[k])[i];if(kind){e.stopImmediatePropagation();setMode(kind)}}},true);

/* ======================================================================================
   LIGAÇÕES COM O JOGO
   ====================================================================================== */
const hold=()=>PH.on&&active();
wrap('setup',(orig,...a)=>{const r=orig(...a);try{reset()}catch(e){fail(e)}return r});
wrap('update',(orig,dt)=>{let prog=null;if(hold())prog=points.map(p=>[p.progress,p.owner]);const s0=[supplies[0],supplies[1]];orig(dt);
 /* o teto de 2400 do jogo vale para a renda, não para apagar o orçamento da preparação */
 if(active()&&!sandbox)for(let t=0;t<2;t++)if(s0[t]>2400&&supplies[t]===2400)supplies[t]=s0[t]+incomeFor(t);
 try{if(prog)points.forEach((p,i)=>{p.progress=prog[i][0];p.owner=prog[i][1]});tick(dt);bannerTick()}catch(e){fail(e)}});
wrap('shoot',(orig,u,...a)=>{if(hold()){u.cd=(defs[u.type]&&defs[u.type].rate)||1;return}return orig(u,...a)});
wrap('aiGrenade',(orig,...a)=>{if(hold())return;return orig(...a)});
wrap('grenade',orig=>{if(hold()){toast('Trégua: nada de granadas antes do apito.');return}return orig()});
wrap('runCommander',(orig,team)=>{if(hold())return;return orig(team)});
const SUPPORT=['artillery','bomber','fighter','gas','recon','reinforce'];
wrap('spend',(orig,type,...a)=>{if(hold()&&SUPPORT.includes(type)&&type!=='reinforce')return false;return orig(type,...a)});     // também barra o reconhecimento automático do frontline.js
wrap('callFighter',(orig,...a)=>{if(hold())return;return orig(...a)});
wrap('callBomber',(orig,...a)=>{if(hold())return;return orig(...a)});
wrap('place',(orig,x,y)=>{if(hold()&&placement&&['artillery','bomber','fighter','gas','recon'].includes(placement)){toast('Trégua: apoio indisponível durante a preparação.');return}return orig(x,y)});
wrap('protectedBy',(orig,u)=>{let f=orig(u);if(!S.on||u.type==='tank'||!DUGS.length)return f;
 for(const s of DUGS)if(Math.abs(s.x-u.x)<16&&Math.abs(s.y-u.y)<13){f=Math.min(f,.15);break}return f});
wrap('explode',(orig,x,y,r,power=100,team=0)=>{orig(x,y,r,power,team);if(!S.on)return;try{
 for(const a of AAS){const d=hyp(a.x-x,a.y-y);if(d<r+8)a.hp-=power*(1-d/(r+8))*1.3}
 for(const g of GUNS){const d=hyp(g.x-x,g.y-y);if(d<r+10)g.hp-=power*(1-d/(r+10))*1.2}}catch(e){fail(e)}});
if(window.PXBAT&&typeof PXBAT.mission==='function'){const m=PXBAT.mission;PXBAT.mission=function(...a){if(hold())return false;return m.apply(this,a)}}
SAP.canBuild=(team,x,y)=>!hold()||(team?x>=CFG.BARRIER[1]+20:x<=CFG.BARRIER[0]-20);
Object.defineProperty(SAP,'buildMsg',{get:()=>hold()?'Trégua: construa só do seu lado da barreira.':null,configurable:true});
if(window.WW1A){const under=WW1A.under,over=WW1A.over;
 WW1A.under=function(c,ox,oy,dt){under.call(this,c,ox,oy,dt);try{drawUnder(c,ox,oy)}catch(e){fail(e)}};
 WW1A.over=function(c,ox,oy,dt){over.call(this,c,ox,oy,dt);try{drawOver(c,ox,oy)}catch(e){fail(e)}}}

S.state=()=>({on:S.on,active:active(),prep:PH.on?+(PH.end-time).toFixed(1):0,queue:QUEUE.map(q=>q.length),done:DONE.map(d=>d.filter(i=>i.done).length),auto:[...auto],
 forts:SAP.projects.filter(p=>!p.done&&p.src==='fort').length,aa:AAS.length,guns:GUNS.length,dugouts:DUGS.length,posted:POSTED.length,anchors:[0,1].map(t=>fieldTrenches.filter(a=>a.team===t).length),
 buildings:[0,1].map(t=>buildings.filter(b=>b.team===t).length),supplies:supplies.map(Math.round),stats:{...S.stats}});
S.planExtra=[];S.KINDS=KINDS;S.SHORT=SHORT;S.SUB=SUB;S.isPrep=()=>hold();S.endPrep=endPrep;S.startPrep=startPrep;S.plan=plan;S.tick=tick;S.reset=reset;S.auto=playerAuto;S.downPlane=downPlane;
Object.defineProperties(S,{phase:{get:()=>PH},aa:{get:()=>AAS},guns:{get:()=>GUNS},queue:{get:()=>QUEUE}});
if(window.IronFront)window.IronFront.fortify=S;
})();
