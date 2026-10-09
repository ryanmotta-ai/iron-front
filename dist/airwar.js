'use strict';
/* Iron Front 1.12/1.13 — guerra aérea (airwar.js): esquadrilhas que decolam de aeródromos, cumprem missões e combatem entre si.
   Núcleo da simulação (sem desenho: o airwar-view.js desenha, o anim-air.js põe os aviões na tela). Carrega DEPOIS do anim-air.js.

   TEATRO AÉREO .... o mapa terrestre (W×H) continua igual; o espaço aéreo se estende 2500 u (AIRX) além de cada borda, onde ficam os
                     aeródromos (EUA a oeste, Alemanha a leste), como na guerra real, 10–30 km atrás das linhas. Altitude h em u
                     (1 u ≈ 4 m na vertical); o chão é h=0; teto de serviço 1300–1750 u.
   VOO ............. ponto-massa 3D integrado pelo VETOR velocidade (sem ângulos de Euler: loop, Immelmann e split-S passam pela
                     vertical sem singularidade). Sustentação = g·n ao longo do "para cima" do avião (vetor U, transportado a cada
                     passo); o piloto rola U até a direção de sustentação pedida (taxa de rolagem do tipo; o Camel rola mais rápido
                     para a direita, torque do rotativo) e puxa n ≤ min(n do piloto, n estrutural, n de estol = (v/vst)²).
                     Potência excedente Ps = P_disp·acelerador·f(h) − parasita·(v/vmax)³ − induzido·(vb/v)·(1+kT·(n²−1)):
                     calibrado por tipo com vmax, velocidade de melhor subida, razão de subida, teto e tempo de curva sustentada
                     (T360). dv/dt ao longo da trajetória = g·Ps/v; a gravidade entra como vetor. Estol com n acima do disponível;
                     parafuso para piloto fraco (Camel mais propenso). Mergulho com arrasto crescente por tipo (SPAD mergulha mais).
   PILOTOS ......... perícia 0–1 (novato, veterano, ás): tempo de reação, varredura do céu, erro de mira, distância em que abre fogo,
                     tolerância a g, disciplina de energia. Avistamento: alcance 900–1400 u, ponto cego atrás/embaixo (dois-lugares
                     têm o observador olhando a cauda), "o huno vem do sol" (quem ataca de dentro do sol é visto muito mais tarde),
                     ala avisa ala. Vitórias contadas; 5 vitórias = ás.
   COMBATE ......... duas metralhadoras sincronizadas fixas (Vickers / LMG 08/15, ~8 tiros/s cada, munição real por arma, engasgo
                     ~1/700 tiros, 2–6 s para desengasgar); metralhador traseiro (Lewis / Parabellum, carregadores de 97); projéteis
                     3D próprios (não entram em bullets[]). Mira com antecipação. Manobras: perseguição pura/antecipada/atrasada,
                     yo-yo alto contra ultrapassagem, mergulho-e-subida (boom & zoom) com vantagem de energia, curva de quebra
                     contra quem está na cauda, tesoura emergente, split-S/espiral para fugir, arrancada para casa (extend).
   DANO ............ cada impacto cai num componente conforme o ângulo: piloto (ferido / morto → parafuso), motor (perde potência,
                     fumaça, para → planeio), radiador (vaza, o motor funde ~30 s depois), tanque (fogo: quase sempre fatal),
                     comandos (rolagem e g limitados), estrutura (com g alto a asa cede), metralhador. Abatido → queda animada do
                     anim-air (fogo, parafuso, asa arrancada ou pouso forçado), paraquedas alemães, prisioneiro se cai do outro lado.
   AERÓDROMOS ...... campo de grama de 1918 (airfield-art.js pinta, airfield-life.js anima): faixa de 960 u contra o vento, pista de táxi, corredor e
                     faixas entre três fileiras de vagas por esquadrilha, hangares ao fundo. Ciclo completo e UM avião de cada vez na faixa (rwBusy): o piloto
                     (pessoa com roteiro) anda, faz o pré-voo e sobe na cabine; o mecânico dá os puxões, gira a hélice e o motor pega (rpm 0–1); aquecimento,
                     calços fora, táxi em fila em arcos, ponto de espera, alinha, prova o motor, corrida (cauda sobe, rotação em 1,2·vst, ~5 s), subida,
                     reunião da formação sobre o campo, missão, regresso pela perna de vento, final com rampa de 5°, toque, rolagem, táxi de volta à vaga,
                     o piloto desce e conta ao mecânico-chefe, rearmar/reabastecer/consertar. Pista ocupada → circuito; final desalinhada → arremetida.
   MISSÕES ......... patrulha (CAP) sobre a frente, interceptação, escolta, ataque ao solo (rasante + bombas de 12,5 kg),
                     bombardeio (DH-4 / Gotha em formação, bombas pelo planefx), reconhecimento (abre a névoa do lado dele).
                     Quartel-general aéreo de cada lado decide sozinho; o jogador pode mandar missões pelo painel (airwar-view.js).
                     Na trégua: só patrulha e reconhecimento, sem tiro.
   SOLO × AR ....... metralhadoras inimigas atiram em quem passa baixo; postos antiaéreos (obra 'aa') e a "Archie" da frente
                     estouram perto de quem cruza as linhas. Aviões antigos (cartas de caça/bombardeiro, aviation.js, frontline.js)
                     são alvos legítimos dos caças daqui.
   ?guerraaerea=0 desliga · PXAW.state() · PXAW.cfg · PXAW.order(time,tipo,x,y) */
(function(){
if(!window.PX)return;
const TAU=Math.PI*2,hyp=Math.hypot,rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t;
const GH=(window.IronFrontWorld&&window.IronFrontWorld.ground)||H;   // altura da frente terrestre; abaixo dela (até H) fica a faixa dos aeródromos
const adiff=(a,b)=>{let d=(a-b)%TAU;if(d>Math.PI)d-=TAU;else if(d<-Math.PI)d+=TAU;return d};
const pick=a=>a[(Math.random()*a.length)|0];
const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('airwar.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};
/* vetores 3D (x leste, y sul, z para cima; destro: x×y=z) */
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],len3=a=>Math.sqrt(dot(a,a));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=a=>{const l=len3(a)||1;return[a[0]/l,a[1]/l,a[2]/l]},sc=(a,k)=>[a[0]*k,a[1]*k,a[2]*k],add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const ZUP=[0,0,1];

/* ======================================================================================
   PARÂMETROS
   ====================================================================================== */
const CFG={
 G:90,                       // gravidade do teatro (u/s²): fixa o raio de curva e a troca altura ↔ velocidade
 AIRX:1500,                  // espaço aéreo além de cada borda do mapa (u): o campo de batalha é um só, o resto é folga para o voo e a câmera
 AFX:600,                    // centro de cada aeródromo, a esta distância da borda lateral — DENTRO do mapa, na faixa aérea ao sul (y > IronFrontWorld.ground)
 ALTV:900,                   // altitude → "altura visual" do anim-air (sombra e ordem de desenho)
 MV:950,BLIFE:.42,           // projétil de metralhadora: velocidade de boca, vida (alcance ~400 u)
 JAM:1/700,JAMT:[2,6],        // engasgo por tiro e tempo para desengasgar
 SPOT:[900,500],              // alcance de avistamento: base + perícia
 FORGET:7,                    // esquece inimigo não visto há N s
 MAXAIR:14,                   // aviões no ar por lado (teto)
 FINAL:800,               // comprimento da perna final (u antes do ponto de toque); a entrada pode ficar além da borda do mapa
 TAXI:36,ROLLA:26,HALF:330,   // taxiamento (u/s), aceleração na corrida (u/s²: ~5 s até a rotação), meia pista (u)
 GP:{walk:30,run:48,climb:2.4,prime:[1.8,2.7],kick:.9,swing:1.7,warm:[2.6,4.2],chocks:1.5,runup:1.8,debrief:[9,16]},   // solo: passo e corrida do piloto, embarque, partida (puxões, giro, aquecimento), calços, prova do motor (s)
 REARM:[20,34],REPAIR:3.2,    // rearmar/reabastecer (s); s por ponto de dano
 REPLACE:100,PILOT_REPLACE:90,// avião e piloto novos depois de uma perda (s)
 HQ:2,                        // decisões do quartel-general aéreo (s)
 CAP_EVERY:[18,30],REC_EVERY:[60,95],ATK_EVERY:[85,130],BMB_EVERY:[140,200],
 GROUND_MG:{r:330,h:260,p:.045},  // metralhadora inimiga em quem passa baixo: alcance, altura máx., impactos por s
 FLAK:{r:430,every:1.1,p:.09},    // posto antiaéreo: alcance, cadência por posto, chance de estilhaço por estouro
 ARCHIE:{every:[1.6,3.2],p:.012}, // "Archie" da frente sobre quem cruza para o lado inimigo
 TRUCE_GUNS:false};
const S=window.PXAW={on:!/[?&]guerraaerea=0/.test(location.search),version:'1.12',cfg:CFG,
 stats:{errors:0,sorties:[0,0],kills:[0,0],losses:[0,0],rounds:0,hits:0,killsBehind:0,killsUnseen:0,killsTotal:0,landings:0,landingCrashes:0,goArounds:0,flamers:0,
  forced:0,spins:0,jams:0,engagements:0,engageTime:0,groundHits:0,bombs:0,strafe:0,flakHits:0,foreignKills:0,recon:0,missions:{}},log:[]};
let errs=0;
function fail(e){S.stats.errors++;if(++errs<=3)console.error('airwar.js:',e);if(errs>=14&&S.on){S.on=false;console.error('airwar.js desligado após erros repetidos')}}

/* ======================================================================================
   TIPOS (1918). vmax/vst em u/s (≈1,15 × km/h), C = razão de subida (u/s), ceil (u), T360 = curva sustentada (s),
   nmax = g do piloto/estrutura, roll (rad/s), dk = arrasto acima de vmax (menor = mergulha melhor), vne = limite de mergulho
   ====================================================================================== */
const TYPES={
 spad:   {vis:'spad',   name:'SPAD S.XIII',      cls:'f',team:0,vmax:250,vst:105,vb:.58,C:34,ceil:1650,T360:4.9,nmax:5.4,roll:2.7,dk:.45,vne:560,guns:2,rate:8,ammo:400,rear:0,hitR:9,str:11,eng:4,rad:1,crew:1,fuel:250,boom:1},
 fokker: {vis:'fokker', name:'Fokker D.VII',     cls:'f',team:1,vmax:232,vst:90, vb:.56,C:42,ceil:1750,T360:4.4,nmax:5.0,roll:2.6,dk:.95,vne:510,guns:2,rate:8,ammo:500,rear:0,hitR:9,str:8,eng:4,rad:1,crew:1,fuel:250,hang:1},
 camel:  {vis:'camel',  name:'Sopwith Camel',    cls:'f',team:0,vmax:214,vst:84, vb:.55,C:31,ceil:1450,T360:3.5,nmax:5.0,roll:3.0,dk:1.15,vne:450,guns:2,rate:8,ammo:500,rear:0,hitR:9,str:7,eng:4,rad:0,crew:1,fuel:220,torque:1,spin:2.2,bombs:4,bk:'small'},
 halb:   {vis:'halb',   name:'Halberstadt CL.II',cls:'2',team:1,vmax:190,vst:84, vb:.56,C:26,ceil:1350,T360:5.3,nmax:4.2,roll:2.0,dk:1.0,vne:430,guns:1,rate:8,ammo:500,rear:1,hitR:10,str:9,eng:5,rad:1,crew:2,fuel:280,bombs:4,bk:'small'},
 salmson:{vis:'salmson',name:'Salmson 2A2',      cls:'2',team:0,vmax:212,vst:92, vb:.56,C:27,ceil:1500,T360:5.9,nmax:3.8,roll:1.6,dk:1.0,vne:440,guns:1,rate:8,ammo:400,rear:2,hitR:10,str:8,eng:5,rad:0,crew:2,fuel:300,recon:1},
 breguet:{vis:'breguet',name:'Breguet 14',       cls:'2',team:0,vmax:208,vst:95, vb:.56,C:24,ceil:1400,T360:6.4,nmax:3.8,roll:1.5,dk:.95,vne:450,guns:1,rate:8,ammo:400,rear:2,hitR:11,str:10,eng:5,rad:1,crew:2,fuel:300,recon:1,bombs:6,bk:'light'},
 rumpler:{vis:'rumpler',name:'Rumpler C.IV',     cls:'2',team:1,vmax:196,vst:85, vb:.56,C:25,ceil:1750,T360:6.2,nmax:3.8,roll:1.5,dk:1.0,vne:430,guns:1,rate:8,ammo:500,rear:1,hitR:10,str:8,eng:5,rad:1,crew:2,fuel:320,recon:1},
 dfw:    {vis:'dfw',    name:'DFW C.V',          cls:'2',team:1,vmax:178,vst:82, vb:.56,C:22,ceil:1300,T360:6.3,nmax:3.8,roll:1.5,dk:1.05,vne:420,guns:1,rate:8,ammo:500,rear:1,hitR:10,str:8,eng:5,rad:1,crew:2,fuel:300,recon:1},
 dh4:    {vis:'dh4',    name:'Airco DH-4',       cls:'b',team:0,vmax:230,vst:100,vb:.56,C:22,ceil:1500,T360:7.6,nmax:3.5,roll:1.2,dk:.9,vne:460,guns:2,rate:8,ammo:500,rear:2,hitR:12,str:11,eng:5,rad:1,crew:2,fuel:340,bombs:4,bk:'heavy'},
 gotha:  {vis:'gotha',  name:'Gotha G.V',        cls:'B',team:1,vmax:161,vst:84, vb:.56,C:14,ceil:1500,T360:11,nmax:2.8,roll:.6,dk:1.1,vne:330,guns:0,rate:0,ammo:0,rear:3,hitR:17,str:18,eng:9,rad:1,crew:3,fuel:380,bombs:6,bk:'huge',nose:1}};
/* bombas: raio e poder do shell que o jogo detona (o planefx anima a queda) */
const BOMB={small:{r:40,p:90},light:{r:60,p:100},heavy:{r:78,p:115},huge:{r:95,p:130}};
/* derivados do desempenho (u/s): parasita Cp, induzido Ci, potência disponível P0, fator de curva kT, queda de potência com a altitude */
for(const k in TYPES){const T=TYPES[k],r=T.vb,vb=T.vmax*r,Cp=T.C/(1+3*r**4-4*r**3),Ci=3*Cp*r**3,P0=Cp+Ci*r,w=TAU/T.T360,ns2=1+(w*vb/CFG.G)**2;
 T.key=k;T.VB=vb;T.Cp=Cp;T.Ci=Ci;T.P0=P0;T.kT=T.C/(Ci*(ns2-1));T.pwCeil=(Cp*r**3+Ci)/P0;T.nSus=Math.sqrt(ns2)}
/* medidas desenhadas no solo (u; 5,5 px de arte por metro, 1 u = 0,5 px): [envergadura, comprimento]; assentos = deslocamento à frente do centro com o avião
   estacionado (voltado para o sul), da frente para trás; ps = índice do piloto (no Gotha o artilheiro do nariz vai à frente) */
const DIM={spad:[96,74],fokker:[100,74],camel:[98,68],halb:[124,80],salmson:[136,84],breguet:[140,88],rumpler:[130,90],dfw:[128,86],dh4:[150,104],gotha:[275,138]};
const SEAT={spad:[-6],fokker:[-6],camel:[-5],halb:[5,-10],salmson:[-4,-16],breguet:[-4,-15],rumpler:[5,-13],dfw:[4,-14],dh4:[1,-11],gotha:[42,21,-18]};
for(const k in TYPES){const T=TYPES[k];T.span=DIM[k][0];T.len=DIM[k][1];T.seat=SEAT[k];T.ps=k==='gotha'?1:0}
const ROSTER=[
 [{sq:'94th Aero',  types:['spad','spad','spad','spad'],role:'f'},
  {sq:'148th Aero', types:['camel','camel'],role:'a'},
  {sq:'1st Aero',   types:['salmson','breguet'],role:'r'},
  {sq:'11th Aero',  types:['dh4','dh4'],role:'b'}],
 [{sq:'Jasta 12',   types:['fokker','fokker','fokker','fokker'],role:'f'},
  {sq:'Schlasta 2', types:['halb','halb'],role:'a'},
  {sq:'FA(A) 240',  types:['rumpler','dfw'],role:'r'},
  {sq:'Bogohl 3',   types:['gotha','gotha'],role:'b'}]];
const NAMES=[
 {rank:['Lt.','1st Lt.','Capt.'],first:['James','Frank','Harold','Walter','Elliott','Reed','Lloyd','Douglas','Eddie','Hamilton','Field','Jacques','Sumner','Wilbert','Murray','Thomas','Howard','George','Clayton','Jesse'],
  last:['Hartley','Coolidge','Winslow','Chambers','Kindley','Springs','Landis','Baer','Vaughn','Cook','Swaab','Hunter','Biddle','Putnam','White','Easterbrook','Holden','Stone','Kirby','Mercer','Fairfield','Quincy','Barlow','Whitmore']},
 {rank:['Ltn.','Oblt.','Vzfw.','Uffz.'],first:['Karl','Friedrich','Otto','Wilhelm','Ernst','Hans','Fritz','Josef','Walter','Paul','Rudolf','Heinrich','Max','Erich','Kurt','Emil','Ludwig','August','Gustav','Bruno'],
  last:['Brandt','Kessler','Vogt','Lehmann','Hartmann','Seidel','Krause','Wendt','Bauer','Engel','Fischer','Scholz','Pfeiffer','Neumann','Thiel','Wolff','Böhme','Schulte','Albrecht','Kühn','Raabe','Steinbach','Holzer','Reinhardt']}];

/* ======================================================================================
   ESTADO
   ====================================================================================== */
let HFX=[],AC=[],AB=[],FL=[],AF=[null,null],PILOTS=[[],[]],HQ=[null,null],ARCH=[],seq=0,flSeq=0,FRONT=1200,FOREIGN=[],FPREV=new WeakMap(),ORD=[[],[]];
const TH=()=>({x0:-CFG.AIRX,x1:W+CFG.AIRX,y0:-160,y1:H+160});
const truce=()=>!!(window.PXFORT&&typeof PXFORT.isPrep==='function'&&PXFORT.isPrep());
const ownSide=(team,x)=>team?x>FRONT:x<FRONT;
const live=a=>a&&!a.dead&&!a.gone;
const airborne=a=>live(a)&&a.air;

function newPilot(team,skill){const N=NAMES[team],sk=skill!=null?skill:clamp(.32+Math.random()*.42+(Math.random()<.12?.25:0),.15,.97);
 const p=Object.assign(mkPerson('pilot',team),{id:++seq,team,name:`${pick(N.rank)} ${pick(N.first)} ${pick(N.last)}`,skill:sk,kills:0,wounded:0,alive:true,busy:false,restUntil:0,sorties:0});PILOTS[team].push(p);if(AF[team])placeAt(p,resSpot(team,PILOTS[team].length));return p}
function newAircraft(team,tk,sq,slot){const T=TYPES[tk];
 const a={id:++seq,team,tk,T,sq,slot,pilot:null,gunner:T.rear?{skill:rnd(.35,.8),alive:true}:null,
  x:0,y:0,h:0,V:[0,0,0],U:[0,0,1],hd:team?Math.PI:0,air:false,st:'park',ready:time+rnd(2,8),dead:false,gone:false,
  ammo:new Array(T.guns).fill(T.ammo),jam:new Array(T.guns).fill(0),gcd:0,rearAmmo:T.rear?97:0,drums:T.rear?6:0,rcd:0,reload:0,
  fuel:T.fuel,power:1,engHp:T.eng,strHp:T.str,ctlHp:3,dmg:0,fire:0,leak:0,smoke:0,n:1,thr:1,D:null,nLim:2,mode:'',tgt:null,threat:null,
  known:new Map(),think:0,flight:null,path:null,pi:0,gv:0,pose:{hd:team?Math.PI:0,bank:0,pitch:11},spin:0,fireOn:false,burst:0,lastHitBy:null,lastHitT:-9,seenBy:new Set(),
  zoomT:0,landTry:0,engOn:false,startT:0,bombs:T.bombs||0,kills:0,rollRate:T.roll,tStart:0,cause:'',
  eng:'off',rpm:0,gp:'',gt:0,chocks:true,seats:Array.from({length:T.crew-1},()=>mkPerson('obs',team))};
 AC.push(a);return a}

/* ======================================================================================
   AERÓDROMOS
   ====================================================================================== */
/* Aeródromo de 1918 (campo de grama, sem pista de concreto nem faixas pintadas): faixa de pouso aparada e marcada com balizas brancas, "T" de lona
   contra o vento, biruta, hangares Bessonneau (EUA) ou de madeira (Alemanha) ao fundo, três fileiras de estacionamento por esquadrilha com um
   corredor central de terra batida, faixas de táxi entre as fileiras e uma pista de táxi paralela (TY) a norte da faixa. Coordenadas relativas ao
   centro (x,y): faixa em y=0, fileiras de aviões voltados para o sul, hangares em y≈-870. O avião sai para a faixa à frente (ou para o corredor), desce
   até a TY e segue até a cabeceira (ponto de espera); volta pelo flanco norte da faixa, sobe o corredor e entra na vaga de frente para o campo. */
const AISLE=130,BAYMAX=480;
function makeAirfield(team){const x=team?W-CFG.AFX:CFG.AFX,y=H-80,wv=window.PXW&&PXW.windVec?PXW.windVec():{x:-1,y:0};
 const dir=(team?-1:1);                          // campo dentro do mapa: sempre rumo à frente (a perna final entra pela borda e nunca sobrevoa o aeródromo inimigo); o vento só mexe na biruta          // decola contra o vento (sem vento: rumo à frente)
 const f={team,x,y,dir,half:CFG.HALF,w:120,slots:[],busyRw:0,landing:null,queue:[],hangars:[],tents:[],flag:team,
  TY:-80,rows:[-175,-300,-425],lanes:[-238,-363,-490],aisle:AISLE,bayMax:BAYMAX,hy:-610,compact:true};
 const bays=[];for(const r of[0,1,2])for(const s of[-1,1])bays.push({r,s,cur:AISLE});let bi=0;
 for(const g of ROSTER[team])for(const tk of g.types){const T=TYPES[tk],need=Math.round(T.span*1.05+30);   /* asas do desenho passam um pouco da envergadura: folga proporcional */
  while(bi<bays.length-1&&bays[bi].cur+need>BAYMAX)bi++;const b=bays[bi],cx=b.s*(b.cur+T.span/2);b.cur+=need;
  f.slots.push({x:x+cx,y:y+f.rows[b.r],row:b.r,side:b.s,tk,sq:g.sq,role:g.role,ac:null})}
 for(let i=0;i<4;i++)f.hangars.push({x:x+(i<2?-1:1)*(i%2?130:345),y:y+f.hy});
 f.ops={x:x+(team?-1:1)*(BAYMAX+55),y:y-150};f.res={x:f.ops.x+(team?1:-1)*10,y:f.ops.y+70};     // barraca de operações e pilotos de reserva
 f.hq={x:f.ops.x,y:f.ops.y};f.dump={x:x-(team?-1:1)*(BAYMAX+35),y:y-470};f.truck={x:x-(team?-1:1)*(BAYMAX+35),y:y-250};
 f.box={x0:x-BAYMAX-95,x1:x+BAYMAX+95,y0:y-745,y1:y+75};
 return f}
function rwStart(f){return f.x-f.dir*f.half}                         // cabeceira de decolagem
function rwTouch(f){return f.x-f.dir*(f.half-(f.compact?150:90))}                     // ponto de toque do pouso
function slotPose(a){const s=a.slot;a.x=s.x;a.y=s.y;a.h=0;a.hd=Math.PI/2;a.V=[0,0,0];a.air=false;a.pose={hd:Math.PI/2,bank:0,pitch:11}}

/* ---- pessoas no solo: pilotos e observadores (posição, passo e roteiro; o airwar-view/airfield-crew só desenha) ---- */
let pseq=0;                                                            // semente dos gestos de cada pessoa (sem sortear: o fluxo aleatório dos duelos não muda)
function mkPerson(role,team){return{role,team,x:0,y:0,hd:Math.PI/2,act:'idle',t0:0,spd:0,wph:0,moving:false,plane:null,seat:-1,q:[],ph:(++pseq*2.39996)%9,spot:null}}
const pgo=(p,pts,spd,act)=>p.q.push({k:'go',pts:pts.map(q=>q.slice()),spd,act}),pwait=(p,t,act)=>p.q.push({k:'wait',t,act}),pdo=(p,fn)=>p.q.push({k:'do',fn});
function pTick(p,dt){if(p.act==='seat'&&p.plane){p.x=p.plane.x;p.y=p.plane.y;p.moving=false;return}
 for(let guard=0;guard<6;guard++){const s=p.q[0];
  if(!s){if(p.act==='walk'||p.act==='run'||p.act==='inspect'||p.act==='climbout'||p.act==='debrief'){p.act='idle';p.t0=time}p.moving=false;return}
  if(s.k==='do'){p.q.shift();s.fn(p);continue}
  if(s.k==='wait'){if(s.t0==null){s.t0=time;p.act=s.act||'idle';p.t0=time;p.dur=s.t;p.moving=false}if(time-s.t0>=s.t){p.q.shift();continue}return}
  if(!s.on){s.on=1;p.act=s.act||'walk';p.t0=time;p.spd=s.spd}
  const q=s.pts[0];if(!q){p.q.shift();continue}
  const dx=q[0]-p.x,dy=q[1]-p.y,d=hyp(dx,dy),st=p.spd*dt;
  if(d<=st){p.x=q[0];p.y=q[1];p.wph+=d;s.pts.shift();if(!s.pts.length){p.q.shift();continue}return}
  p.x+=dx/d*st;p.y+=dy/d*st;p.wph+=st;p.hd=Math.atan2(dy,dx);p.moving=true;return}}
function placeAt(p,q){p.x=q[0];p.y=q[1];p.q.length=0;p.act='idle';p.moving=false;p.plane=null;p.t0=time}
/* onde o piloto e o observador esperam (entre as asas, ao lado do próprio avião) e onde ficam os pilotos de reserva */
function spotFor(a,k){const s=a.slot,T=a.T,sd=k?-1:1,h=((a.id*7919+k*131)%97)/97;return[s.x+sd*(T.span/2+17+h*8),s.y-8+h*28]}
function resSpot(team,i){const r=AF[team].res,c=team?-1:1;return[r.x-c*(i%4)*20+((i*37)%11),r.y+Math.floor(i/4)*22+((i*53)%9)]}
const seatPt=(a,i)=>[a.slot.x,a.slot.y+a.T.seat[i]];
const boardPt=(a,i)=>[a.slot.x+17,a.slot.y+a.T.seat[i]+3];                  // no flanco esquerdo (leste), junto à raiz da asa
function crewList(a){const T=a.T,c=[{p:a.pilot,seat:T.ps}];a.seats.forEach((o,i)=>c.push({p:o,seat:i<T.ps?i:i+1}));return c}
/* pré-voo: toca a asa, olha o motor e a hélice, volta ao assento */
function inspectPts(a){const s=a.slot,T=a.T;return[[s.x+T.span*.34,s.y+3],[s.x+10,s.y+T.len/2+13],boardPt(a,T.ps)]}
/* caminhos de táxi (curvas por arcos: o avião não gira no lugar) */
function roundPath(P,r){if(P.length<3)return P.map(q=>q.slice());const out=[P[0].slice()];
 for(let i=1;i<P.length-1;i++){const a=P[i-1],b=P[i],c=P[i+1],d1=hyp(b[0]-a[0],b[1]-a[1]),d2=hyp(c[0]-b[0],c[1]-b[1]);if(d1<1||d2<1){out.push(b.slice());continue}
  const k=Math.min(r,d1*.5,d2*.5),p1=[b[0]+(a[0]-b[0])/d1*k,b[1]+(a[1]-b[1])/d1*k],p2=[b[0]+(c[0]-b[0])/d2*k,b[1]+(c[1]-b[1])/d2*k],n=Math.max(4,Math.ceil(k/4));
  for(let j=0;j<=n;j++){const t=j/n,u=1-t;out.push([u*u*p1[0]+2*u*t*b[0]+t*t*p2[0],u*u*p1[1]+2*u*t*b[1]+t*t*p2[1]])}}
 out.push(P[P.length-1].slice());return out}
const holdPt=f=>[rwStart(f)-f.dir*56,f.y+f.TY];
function outPath(a){const af=AF[a.team],s=a.slot,ty=af.y+af.TY,P=[[a.x,a.y]];
 if(s.row>0){const ly=af.y+af.lanes[s.row-1];P.push([s.x,ly],[af.x,ly],[af.x,ty])}else P.push([s.x,ty]);
 P.push(holdPt(af));return roundPath(P,46)}
function lineupPath(a){const af=AF[a.team],h=holdPt(af),xs=rwStart(af);return roundPath([[a.x,a.y],[h[0],af.y],[xs+af.dir*46,af.y]],50)}
function inPath(a){const af=AF[a.team],s=a.slot,d=af.dir,ty=af.y+af.TY,ny=af.y+(af.compact?-30:-64),ahead=(af.x-a.x)*d>30,P=[[a.x,a.y]];
 if(ahead)P.push([a.x+d*40,ny],[af.x,ny]);else P.push([a.x+d*60,ny],[a.x+d*60,ny-34],[af.x,ny-34]);
 P.push([af.x,ty],[af.x,af.y+af.lanes[s.row]],[s.x,af.y+af.lanes[s.row]],[s.x,s.y]);return roundPath(P,46)}

/* ======================================================================================
   MODELO DE VOO
   ====================================================================================== */
function Ps(a,v,n){const T=a.T,h=Math.max(0,a.h),pw=1-(1-T.pwCeil)*Math.pow(clamp(h/T.ceil,0,1.25),1.6),x=v/T.vmax,over=Math.max(0,x-1);
 const P=T.P0*a.thr*a.power*pw*(a.fuel>0?1:0),par=T.Cp*x*x*x*(1+T.dk*over*3)*(a.power<=0?1.15:1),ind=T.Ci*(T.VB/Math.max(30,v))*(n<=1?n*n:1+T.kT*(n*n-1));
 return P-par-ind}
/* um passo de voo: D (direção desejada, unitária), nLim (g que o piloto aceita) → rola U, puxa n, integra V e posição */
function fly(a,dt){const T=a.T;let V=a.V,v=len3(V);if(v<20){V=sc(nrm(V[0]||V[1]||V[2]?V:[Math.cos(a.hd),Math.sin(a.hd),0]),20);v=20}
 const f=sc(V,1/v);
 /* U transportado (⊥ f) */
 let U=sub(a.U,sc(f,dot(a.U,f)));if(len3(U)<1e-3){const up0=sub(ZUP,sc(f,f[2]));U=len3(up0)>1e-3?up0:[Math.cos(a.hd+Math.PI/2),Math.sin(a.hd+Math.PI/2),0]}U=nrm(U);
 /* comando: aceleração lateral para virar a velocidade até D + compensação da gravidade */
 let nCmd=1,Ld=U;
 if(a.spin>0){/* parafuso: gira em torno da vertical, nariz para baixo, sustentação quase nula */
  a.spin-=dt;const rr=3.2*(a.spinDir||1);U=nrm(add(sc(U,Math.cos(rr*dt)),sc(cross(f,U),Math.sin(rr*dt))));const wantF=nrm([Math.cos(a.hd+rr*.5)*.45,Math.sin(a.hd+rr*.5)*.45,-.89]);
  V=add(sc(V,1-dt*1.2),sc(wantF,v*dt*1.2));V=sc(nrm(V),lerp(v,T.vst*.95,Math.min(1,dt*.8)));nCmd=.4;
  if(a.spin<=0&&a.mode==='spin')a.mode='recover'}
 else{let D=a.D||f,da=clamp(dot(D,f),-1,1),ang=Math.acos(da);
  /* inversão grande: o piloto faz curva nivelada para o lado do alvo (manobra vertical só quando pedida: a.vert) */
  if(ang>1.45&&!a.vert){const fh=[f[0],f[1],0],lh=len3(fh)||1,s1=Math.sign(f[0]*D[1]-f[1]*D[0])||(a.turnSide||1);a.turnSide=s1;const nx=-f[1]/lh*s1,ny=f[0]/lh*s1;
   D=nrm([nx*.85+f[0]/lh*.15,ny*.85+f[1]/lh*.15,D[2]*.5]);da=clamp(dot(D,f),-1,1);ang=Math.acos(da)}
  let dp=sub(D,sc(f,da));
  if(len3(dp)<1e-3)dp=ang>1.5?(a.h>220?U:sub(ZUP,sc(f,f[2]))):[0,0,0];
  /* maior curva que cabe no g disponível (piloto e estol) sem deixar de segurar a gravidade: |dn·v·w + g⊥| ≤ n·g */
  const dn=len3(dp)>1e-6?nrm(dp):[0,0,0],gp=sub([0,0,CFG.G],sc(f,CFG.G*f[2])),nE=Math.max(1.02,Math.min(a.nLim,(v/T.vst)**2*.98)),bq=dot(dn,gp),cq=dot(gp,gp)-(nE*CFG.G)**2;
  const wmax=Math.max(0,(-bq+Math.sqrt(Math.max(0,bq*bq-cq)))/v),wDes=Math.min(ang*(a.gain||3.2),wmax);
  const A=add(sc(dn,v*wDes),gp);const al=len3(A);
  nCmd=al/CFG.G;Ld=al>1e-6?sc(A,1/al):U}
 /* rolagem: gira U em torno de f até Ld, no máximo roll·dt (Camel: torque para a direita) */
 const sinr=dot(cross(U,Ld),f),cosr=dot(U,Ld),th=Math.atan2(sinr,cosr);
 let rr=a.rollRate*(a.ctlHp<=0?.4:a.ctlHp<2?.75:1)*(a.pilot&&a.pilot.wounded?.75:1);if(T.torque)rr*=th>0?1.3:.8;
 const ts=clamp(th,-rr*dt,rr*dt);if(a.spin<=0&&nCmd>.15)U=nrm(add(sc(U,Math.cos(ts)),sc(cross(f,U),Math.sin(ts))));
 /* g aplicado: o piloto só puxa forte depois de rolar; estol e limites */
 const rem=Math.abs(th-ts),pull=rem>1.2?.25:rem>.5?lerp(1,.25,(rem-.5)/.7):1;
 const nAvail=(v/T.vst)**2*(a.strHp<T.str*.4?.85:1),nPil=a.nLim*(a.ctlHp<=0?.55:1);
 let n=a.spin>0?.4:Math.min(Math.max(nCmd*pull,Math.min(nCmd,1)),nPil,nAvail);
 /* parafuso: pedindo mais g que o disponível, devagar, piloto fraco */
 if(a.spin<=0&&nCmd>nAvail*1.1&&v<T.vst*1.05&&a.pilot&&Math.random()<dt*(T.spin||1)*(1-a.pilot.skill)*.9){a.spin=rnd(.9,1.6)+(1-a.pilot.skill)*1.8;a.spunT=time;a.spinDir=Math.random()<.5?-1:1;a.mode='spin';S.stats.spins++}
 /* falha estrutural: g alto com estrutura ferida ou acima do limite de mergulho */
 const strK=a.strHp/T.str;if(a.air&&(n>T.nmax*(.75+.6*strK)||v>T.vne*(.85+.15*strK))&&Math.random()<dt*4){a.n=n;return down(a,a.lastHitBy,'estrutura','break')}
 a.n=n;
 const at=CFG.G*Ps(a,v,n)/v;
 V=add(V,sc(add(add(sc(f,at),sc(U,CFG.G*n)),[0,0,-CFG.G]),dt));
 a.V=V;a.U=U;a.x+=V[0]*dt;a.y+=V[1]*dt;a.h+=V[2]*dt;
 const vh=hyp(V[0],V[1]);if(vh>2)a.hd=Math.atan2(V[1],V[0]);
 a.fuel-=dt*(.35+.65*a.thr)}
/* pose para o anim-air: rumo, inclinação lateral (ângulo de U em torno de f a partir do "para cima" local), arfagem */
function poseOf(a){const v=len3(a.V);if(!a.air||v<1)return a.pose;const f=sc(a.V,1/v),up0=sub(ZUP,sc(f,f[2])),l=len3(up0);
 let bank=a.pose.bank;if(l>.05){const u0=sc(up0,1/l),r0=cross(u0,f);bank=Math.atan2(dot(a.U,r0),dot(a.U,u0))*180/Math.PI}
 const pitch=Math.asin(clamp(f[2],-1,1))*180/Math.PI;a.pose={hd:a.hd,bank,pitch};return a.pose}

/* ======================================================================================
   PILOTO: avistamento, decisão, manobra
   ====================================================================================== */
const SUN=nrm([-.45,-.55,.85]);                                     // sol de cima-esquerda (igual ao anim-air)
function enemiesOf(team){const r=[];for(const b of AC)if(b.team!==team&&airborne(b))r.push(b);for(const q of FOREIGN)if(q.team!==team)r.push(q);return r}
function spot(a,dt){const P=a.pilot,sk=P?P.skill:.4,R=CFG.SPOT[0]+CFG.SPOT[1]*sk,f=nrm(a.V);
 for(const e of enemiesOf(a.team)){const dx=e.x-a.x,dy=e.y-a.y,dz=e.h-a.h,d=Math.sqrt(dx*dx+dy*dy+dz*dz);if(d>R)continue;
  if(a.known.has(e)&&time-a.known.get(e)<1.5){a.known.set(e,time);continue}
  const dir=[dx/d,dy/d,dz/d];let p=d<220?1:(1-d/R)**.7*(.35+.65*sk);
  if(dot(dir,f)<-.45&&!(a.gunner&&a.gunner.alive))p*=dz<0?.25:.4;  // cauda e embaixo: ponto cego (o observador vê a cauda)
  if(dot(dir,SUN)>.93)p*=.15;                                         // vem de dentro do sol
  if(Math.random()<p*Math.min(1,dt*2.2)){a.known.set(e,time);if(a.flight)for(const m of a.flight.m)if(m!==a&&live(m)&&!m.known.has(e))m.known.set(e,time-CFG.FORGET+1.5)}}
 for(const [e,t] of a.known)if(time-t>CFG.FORGET||e.dead||e.gone||(e.air===false))a.known.delete(e)}
const energy=a=>a.h+(len3(a.V)**2)/(2*CFG.G);
/* ponto de mira com antecipação (velocidade do alvo, queda do projétil) */
function leadPoint(a,e,skillErr){const P=[a.x,a.y,a.h],T0=[e.x,e.y,e.h],Ve=e.V||[0,0,0],mv=CFG.MV+len3(a.V)*.6;let t=len3(sub(T0,P))/mv;
 for(let i=0;i<2;i++){const L=add(T0,sc(Ve,t*(1+skillErr)));t=len3(sub(L,P))/mv}
 const L=add(T0,sc(Ve,t*(1+skillErr)));L[2]+=.5*CFG.G*t*t;return{L,t}}
function threatOn(a){/* quem está na minha cauda com o nariz em mim */let best=null,bs=0;const f=nrm(a.V);
 for(const [e] of a.known){if(!e.V||e.T&&e.T.cls!=='f'&&e.T.cls!=='2')continue;const r=sub([a.x,a.y,a.h],[e.x,e.y,e.h]),d=len3(r);if(d>520||d<1)continue;
  const ef=nrm(e.V),onMe=dot(ef,sc(r,1/d)),behind=-dot(f,sc(r,1/d));if(onMe<.8)continue;const s=onMe*(1-d/520)*(.6+.4*behind);if(s>bs){bs=s;best=e}}
 return best}
function chooseTarget(a,allowFight){let best=null,bs=-1;const role=a.flight?a.flight.kind:'cap',esc=a.flight&&a.flight.escortOf;
 for(const [e] of a.known){if(!e.air&&e.air!==undefined)continue;const d=hyp(e.x-a.x,e.y-a.y,(e.h||0)-a.h);if(d>1300)continue;
  let s=1-d/1300;const ec=e.T?e.T.cls:e.cls||'f';
  if(role==='int'||role==='cap')s*=ec==='b'||ec==='B'?1.8:ec==='2'?1.5:1;
  if(esc){const E=esc.lead();if(E&&hyp(e.x-E.x,e.y-E.y)>650)s*=.25;else s*=1.6}
  let n=0;for(const m of AC)if(m!==a&&m.team===a.team&&m.tgt===e&&airborne(m))n++;s/=1+n*.7;    // não amontoar no mesmo alvo
  if(e.threatTo===a)s*=1.5;if(s>bs){bs=s;best=e}}
 return allowFight?best:null}
function wantDisengage(a){const T=a.T,ammo=a.ammo.reduce((x,y)=>x+y,0),full=T.guns*T.ammo;
 return a.fuel<T.fuel*.22||(full>0&&ammo<full*.1&&T.cls==='f')||a.dmg>.6||(a.pilot&&a.pilot.wounded>1)||a.leak>0||a.power<.55}
const homeDir=a=>{const f=AF[a.team];return nrm([f.x-a.x,f.y-a.y,0])};

/* decisão (no ritmo da perícia) */
function decide(a){const P=a.pilot,sk=P?P.skill:.4;a.think=time+lerp(.65,.22,sk)*rnd(.8,1.2);
 if(a.mode==='spin'||a.st!=='air')return;
 const fl=a.flight,role=fl?fl.kind:'cap',fighter=a.T.cls==='f',guns=!truce()||CFG.TRUCE_GUNS;
 a.threat=threatOn(a);if(a.threat)a.threat.threatTo=a;
 if((a.mode==='rtb'||a.mode==='circuit')&&a.threat&&guns&&hyp(a.threat.x-a.x,a.threat.y-a.y)<330&&a.power>0){a.mode='evade';a.tgt=null;return}
 if(a.mode==='rtb'||a.mode==='circuit'||a.mode==='final'||a.mode==='glide'||a.mode==='climbout'||a.mode==='recover')return;
 if(fl&&(fl.phase==='start'||fl.phase==='assemble')&&a.liftT&&time-a.liftT<60&&!(a.threat&&hyp(a.threat.x-a.x,a.threat.y-a.y,a.threat.h-a.h)<200)){a.tgt=null;if(a.mode==='fight'||a.mode==='evade'||a.mode==='zoom'||a.mode==='extend')a.mode='form';return}   // recém-decolado: reúne e sobe rumo à missão, sem sair caçando (só reage se já estiver sendo atacado de perto)
 if(wantDisengage(a)){a.mode=a.threat&&hyp(a.threat.x-a.x,a.threat.y-a.y)<300?'evade':'extend';a.tgt=null;if(a.mode==='extend')a.extendT=time+8;return}
 if(a.threat&&guns&&hyp(a.threat.x-a.x,a.threat.y-a.y,a.threat.h-a.h)<380){a.mode='evade';a.tgt=null;const r=Math.random(),e=(1-sk)*.32;if(r<e*.45)a.panicT=time+rnd(.6,1.3);else if(r<e)a.flipT=time+rnd(.8,1.6);return}
 if(fighter&&guns&&role!=='atk'&&role!=='rec'){const t=chooseTarget(a,true);if(t){if(a.tgt!==t){a.tgt=t;a.engT=time;if(!fl||!fl.engaged){if(fl)fl.engaged=time;S.stats.engagements++}}a.mode=a.mode==='zoom'&&a.zoomT>time?'zoom':'fight';return}}
 if(role==='atk'&&fighter&&a.threat&&guns){a.mode='evade';return}
 a.tgt=null;if(a.mode==='fight'||a.mode==='evade'||a.mode==='zoom'||a.mode==='extend'&&a.extendT<time||a.mode==='')a.mode='form'}

/* manobra (todo quadro): escolhe D, nLim, acelerador, e se atira */
function steer(a,dt){const T=a.T,P=a.pilot,sk=P?P.skill:.4,v=len3(a.V),f=nrm(a.V),pos=[a.x,a.y,a.h];
 a.fireOn=false;a.gain=3.2;a.thr=1;a.vert=0;
 const fl=a.flight;let D=f,nl=T.nSus*1.15;
 const gk=P?lerp(2.3,T.nmax,sk):3.2;                               // g que este piloto aguenta numa curva de quebra
 switch(a.mode){
 case 'fight':{const e=a.tgt;if(!e||e.dead||e.gone){a.mode='form';break}
  const r=sub([e.x,e.y,e.h],pos),d=len3(r),rn=sc(r,1/d),nose=Math.acos(clamp(dot(f,rn),-1,1)),eV=e.V||[0,0,0],ev=len3(eV),closure=-(dot(sub(eV,a.V),rn));
  const myE=energy(a),eE=e.V?energy(e):e.h+ev*ev/(2*CFG.G);
  /* mergulho-e-subida: com sobra de energia, tipo bom de mergulho, e o alvo não está na nossa cauda */
  if(T.boom&&myE>eE+170&&d>260&&!a.threat){const {L}=leadPoint(a,e,0);D=nrm(sub(L,pos));nl=T.nSus*1.3;if(d<300)a.zoomT=time+1.6}
  else if(a.zoomT>time&&d<420){D=nrm([f[0]*.6,f[1]*.6,.8]);nl=T.nSus*1.4;a.mode='zoom'}
  else if(d>480){const dz=clamp((e.h+90-a.h)/400,-.5,.6);D=nrm([rn[0],rn[1],rn[2]+dz]);nl=T.nSus*1.2}
  else if(d<130&&closure>-20){/* colado na cauda: tira o motor, sobe de lado (não atropela nem atira no próprio estilhaço) */const lag=sub([e.x,e.y,e.h],sc(eV,.6));D=nrm(add(nrm(sub(lag,pos)),[0,0,.55]));a.thr=.3;nl=T.nSus*1.3;a.vert=1}
  else if(closure>110&&d<240&&nose>.5){/* ultrapassagem iminente: yo-yo alto + perseguição atrasada */const lag=sub([e.x,e.y,e.h],sc(eV,.45));D=nrm(add(sc(nrm(sub(lag,pos)),1),[0,0,.45]));a.thr=.55;nl=gk}
  else{const err=a.lerr||0,{L}=leadPoint(a,e,err),ld=nrm(sub(L,pos));D=nose<.45?ld:nrm(add(rn,sc(ld,.3)));if(nose<.6)a.gain=lerp(4.5,9,sk);nl=nose>.1&&d<380?gk:Math.min(gk,T.nSus*1.5);/* puxa forte para pôr a antecipação (tiro de deflexão) */if(a.T.hang&&nose>.6&&v<T.VB)D=nrm(add(D,[0,0,.25]))}
  aimFire(a,e,d);break}
 case 'zoom':a.vert=1;D=nrm([f[0]*.55,f[1]*.55,.85]);nl=T.nSus*1.3;if(a.zoomT<time||v<T.vst*1.35){a.mode='form';a.zoomT=0}break;
 case 'evade':{const e=a.threat;if(!e||e.dead||e.gone){a.mode='form';break}
  const r=sub([e.x,e.y,e.h],pos),d=len3(r),fh=nrm([f[0],f[1],0]),rh=[r[0],r[1],0],side=Math.sign(fh[0]*rh[1]-fh[1]*rh[0])||1;
  if(T.cls!=='f'){/* dois-lugares/bombardeiro: zigue-zague que dá tiro ao metralhador e rumo de casa */const hd=homeDir(a),w=Math.sin(time*2.2+a.id)*.9;D=nrm([hd[0]*Math.cos(w)-hd[1]*Math.sin(w),hd[0]*Math.sin(w)+hd[1]*Math.cos(w),-.12]);nl=T.nSus*1.3;break}
  if(v<T.vst*1.35&&a.h>320&&sk>.35){D=nrm([fh[0]*.25,fh[1]*.25,-1]);nl=gk;a.vert=1}                              // sem velocidade: split-S / espiral
  else if(a.panicT>time){D=nrm([fh[0],fh[1],-.05]);nl=1.2}                                                        // pânico: nivela as asas (dá o tiro ao atacante)
  else{const sd=a.flipT>time?-side:side,ang=sd*1.75,c=Math.cos(ang),s=Math.sin(ang);D=nrm([fh[0]*c-fh[1]*s,fh[0]*s+fh[1]*c,a.h>200?-.18:.05]);nl=gk}   // curva de quebra para dentro do atacante (o novato às vezes inverte na hora errada)
  /* ele passou à frente: inverte e ataca */if(dot(f,sc(r,1/d))>.6&&d<350&&T.cls==='f'&&!wantDisengage(a)){a.mode='fight';a.tgt=e;a.threat=null}
  break}
 case 'extend':{let hd=homeDir(a);const w=a.away;if(w&&!w.dead&&!w.gone&&!wantDisengage(a)){const r=[a.x-w.x,a.y-w.y,0],l=hyp(r[0],r[1])||1;hd=[r[0]/l*.8+hd[0]*.2,r[1]/l*.8+hd[1]*.2,0]}
  const dw=w&&!w.dead?hyp(w.x-a.x,w.y-a.y):999;D=nrm([hd[0],hd[1],dw<650&&a.h>260?-.4:v>T.VB*1.2&&a.h<1300?.16:a.h>160?-.1:.02]);nl=T.nSus;if(a.extendT<time){a.away=null;a.mode=wantDisengage(a)?'rtb':a.flight?'form':'';}break}
 case 'rtb':case 'circuit':case 'final':case 'glide':{const r=landing(a,dt);D=r.D;nl=r.nl;a.thr=r.thr;break}
 case 'spin':D=f;break;
 case 'climbout':{/* subida reta na direção da pista até ter altura e velocidade para virar */const af=AF[a.team],bk=af.compact?clamp((a.h-18)/45,0,1):0;D=nrm([af.dir*(1-.8*bk),-.95*bk,v>T.VB*.85?.22:.08]);nl=1.25;   /* campo no mapa: curva para o lado do campo de batalha logo após a pista, sem sobrevoar o aeródromo inimigo */a.thr=1;if(a.h>140&&v>T.VB*.8)a.mode='form';break}
 case 'recover':{/* saiu do parafuso: mergulho reto até ganhar velocidade, depois volta */D=nrm([f[0],f[1],a.h>90?-.5:.15]);nl=1.6;a.thr=1;if(v>T.VB*.95||a.h<60&&v>T.vst*1.3)a.mode='';break}
 default:{/* em formação ou guiando a missão */const r=missionSteer(a,dt);D=r.D;nl=r.nl;a.thr=r.thr;if(r.fire)aimFire(a,r.fire,hyp(r.fire.x-a.x,r.fire.y-a.y,r.fire.h-a.h))}}
 /* fora do combate: nunca perto do estol (o ala que passou da posição não corta o motor abaixo de 1,3 vst) */
 if(a.mode!=='fight'&&a.mode!=='evade'&&a.mode!=='zoom'&&a.mode!=='final'&&a.mode!=='glide'&&a.mode!=='spin'&&v<T.vst*1.3){a.thr=1;nl=Math.min(nl,1.25);D=nrm([D[0],D[1],Math.min(D[2],-.12)])}
 /* fora do combate: sobe na velocidade de melhor subida (nada de pendurar na hélice perto do estol) */
 if(a.mode!=='fight'&&a.mode!=='evade'&&a.mode!=='zoom'&&a.mode!=='final'&&a.mode!=='spin'&&D[2]>0&&v<T.VB*1.05){D=nrm([D[0],D[1],Math.min(D[2],Math.max(-.12,(v/T.VB-.9)*2.2))])}
 /* energia: lento demais, alivia o g e baixa o nariz (o ás percebe antes); piso de altitude em combate */
 if(a.mode==='fight'||a.mode==='evade'||a.mode==='zoom'){const vmin=T.VB*lerp(.7,.92,sk)*(T.boom?1.28:1);   /* o SPAD briga rápido (energia), o Fokker aceita briga lenta */
 if(v<vmin){nl=Math.min(nl,lerp(1.3,T.nSus,clamp((v-T.vst)/(vmin-T.vst),0,1)));D=nrm(add(D,[0,0,-.35*(1-v/vmin)*3]))}
  const fh=lerp(110,190,sk);if(a.h<fh)D=nrm(add(D,[0,0,(fh-a.h)/fh*1.2]))}
 /* chão: perseguição não mergulha a pique perto do chão; recuperação a tempo (raio de saída do mergulho), puxando para onde a asa já
    aponta (perto da vertical qualquer lado serve, e rolar antes custaria o segundo que falta) */
 if(a.mode==='fight'&&D[2]<-.6&&a.h<650){D=nrm([D[0],D[1],-.6])}
 if(a.mode!=='final'&&!(a.mode==='glide'&&a.h<60)){const sink=-a.V[2],rPull=v*v/(CFG.G*Math.max(1.5,T.nmax-1)),need=Math.max(0,-f[2])*rPull*lerp(1.7,1.25,sk)+35,
   floor=a.mode==='form'&&fl&&fl.kind==='atk'&&fl.phase==='work'?28:70,tau=sink>1?a.h/sink:99;
  if(sink>5&&a.h<need||tau<lerp(1.2,2.2,sk)||a.h<floor&&a.V[2]<10){const Uh=[a.U[0],a.U[1],0],lu=len3(Uh);
   D=f[2]<-.55&&lu>.3?nrm([Uh[0]/lu,Uh[1]/lu,.35]):a.U[2]>.25?nrm(add(f,sc(a.U,1.6))):nrm([f[0],f[1],.9]);nl=T.nmax;a.thr=1;a.vert=1;a.pullUp=time}}   /* inclinado com a asa para cima: puxa sem rolar */
 const B=TH();if(a.x<B.x0+150||a.x>B.x1-150||a.y<B.y0+120||a.y>B.y1-120){const c=nrm([(B.x0+B.x1)/2-a.x,(B.y0+B.y1)/2-a.y,0]);D=nrm(add(D,sc(c,1.4)))}
 /* não colidir com companheiros */
 for(const b of AC){if(b===a||!airborne(b)||b.team!==a.team)continue;const dx=a.x-b.x,dy=a.y-b.y,dz=a.h-b.h,d2=dx*dx+dy*dy+dz*dz;if(d2<45*45&&d2>1){const k=1/Math.sqrt(d2);D=nrm(add(D,[dx*k*.8,dy*k*.8,a.h<220?Math.max(0,dz*k*.8)+.2:dz*k*.8+.2]))}}
 a.D=D;a.nLim=Math.max(1.1,nl)}

/* ======================================================================================
   ARMAS
   ====================================================================================== */
function aimFire(a,e,d){if(truce()&&!CFG.TRUCE_GUNS)return;const T=a.T;if(!T.guns||d>700)return;const P=a.pilot,sk=P?P.skill:.4;
 const range=lerp(430,250,sk),cone=lerp(.11,.04,sk);if(d>range||d<40)return;
 const {L}=leadPoint(a,e,a.lerr||0),ld=nrm(sub(L,[a.x,a.y,a.h])),err=Math.acos(clamp(dot(nrm(a.V),ld),-1,1));
 if(err<cone||(a.burst>0&&err<cone*1.8)){a.fireOn=true;a.fd=d}}
function shootGuns(a,dt){const T=a.T;a.gcd-=dt;if(a.burst>0)a.burst-=dt;
 if(a.fireOn&&a.burst<=0){a.burst=rnd(.35,1.1);const sk=a.pilot?a.pilot.skill:.4;a.lerr=(Math.random()<.5?-1:1)*rnd(.05,.12+(1-sk)*.4)}
 if(!(a.fireOn||a.burst>0)||a.gcd>0||!T.guns)return;
 a.gcd=1/T.rate;const sk=a.pilot?a.pilot.skill:.4,sp=.016+(1-sk)*.03;let any=false;
 /* tremor do nariz: erro de pontaria correlacionado na rajada (vibração, ar turbulento, mão do piloto) */
 const wa=.018+(1-sk)*.055,wk=Math.min(1,(1/T.rate)*4);a.wob=a.wob||[0,0,0];for(let i=0;i<3;i++)a.wob[i]+=(rnd(-wa,wa)*1.7-a.wob[i])*wk;
 const f=nrm(add(nrm(a.V),a.wob));
 for(let g=0;g<T.guns;g++){if(a.jam[g]>time||a.ammo[g]<=0)continue;a.ammo[g]--;any=true;
  if(Math.random()<CFG.JAM){a.jam[g]=time+rnd(...CFG.JAMT);S.stats.jams++;if(a.team===playerTeam&&Math.random()<.15)note(a.team,`${a.pilot?a.pilot.name:'Piloto'}: metralhadora engasgada!`,'jam',25)}
  const dir=nrm(add(f,[rnd(-sp,sp),rnd(-sp,sp),rnd(-sp,sp)])),off=(g?1:-1)*3;
  bullet(a,a.x-f[1]*off+f[0]*24,a.y+f[0]*off+f[1]*24,a.h+f[2]*24,add(sc(dir,CFG.MV),a.V),(a.gcd>0&&(++a.trc||(a.trc=1))%3===0))}
 if(any){S.stats.fireD=(S.stats.fireD||0)+(a.fd||0);S.stats.fireN=(S.stats.fireN||0)+1;if(nearCam(a,800)&&Math.random()<.18)try{sound('shot')}catch{}}}
function bullet(a,x,y,h,V,tr,g){if(AB.length>900)return;S.stats.rounds++;AB.push({x,y,h,vx:V[0],vy:V[1],vz:V[2],t:CFG.BLIFE,team:a.team,by:a,tr:!!tr,g:!!g})}
/* metralhador traseiro (e o de proa do Gotha): arco, antecipação, carregadores */
function gunner(a,dt){const g=a.gunner;if(!g||!g.alive||!a.air||(truce()&&!CFG.TRUCE_GUNS))return;const T=a.T;
 if(a.reload>0){a.reload-=dt;if(a.reload<=0){a.rearAmmo=97;a.drums--}return}
 if(a.rearAmmo<=0){if(a.drums>0)a.reload=rnd(2.6,4);return}
 a.rcd-=dt;if(a.rcd>0)return;
 const f=nrm(a.V);let best=null,bd=340;
 for(const [e] of a.known){if(!e.V&&!e.foreign)continue;const r=[e.x-a.x,e.y-a.y,(e.h||0)-a.h],d=len3(r);if(d>bd||d<20)continue;const c=dot(nrm(r),f);if(c>(T.nose?1.1:-.15)&&!T.nose)continue;bd=d;best=e}
 a.gunAng=best?Math.atan2(best.y-a.y,best.x-a.x):null;
 if(!best)return;
 const shots=T.rear;a.rcd=1/(9*(shots>=3?1:shots>=2?1.1:.9));a.rearAmmo-=1;   /* Lewis/Parabellum: um cano por vez na mira */
 const err=(1-g.skill)*rnd(-.4,.4),{L}=leadPoint(a,best,err),dir=nrm(sub(L,[a.x,a.y,a.h])),sp=.045+(1-g.skill)*.045;   /* atira de uma plataforma que balança e venta */
 bullet(a,a.x,a.y,a.h+4,add(sc(nrm(add(dir,[rnd(-sp,sp),rnd(-sp,sp),rnd(-sp,sp)])),CFG.MV*.95),a.V),Math.random()<.4,1)}
/* projéteis: movimento, colisão com aviões (esfera por tipo), chão */
function stepBullets(dt){const targets=[];for(const b of AC)if(airborne(b))targets.push(b);for(const q of FOREIGN)targets.push(q);
 for(let i=AB.length-1;i>=0;i--){const b=AB[i];const x0=b.x,y0=b.y,h0=b.h;b.vz-=CFG.G*.5*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.h+=b.vz*dt;b.t-=dt;
  if(b.t<=0||b.h<=0){AB.splice(i,1);continue}
  const dx=b.x-x0,dy=b.y-y0,dz=b.h-h0,L2=dx*dx+dy*dy+dz*dz||1;
  for(const e of targets){if(e.team===b.team||e===b.by)continue;const R=e.T?e.T.hitR:e.hitR||18,ex=e.x-x0,ey=e.y-y0,ez=(e.h||0)-h0;
   if(Math.abs(ex)>R+60&&Math.abs(ex-dx)>R+60)continue;
   const t=clamp((ex*dx+ey*dy+ez*dz)/L2,0,1),cx=x0+dx*t-e.x,cy=y0+dy*t-e.y,cz=h0+dz*t-(e.h||0);if(cx*cx+cy*cy+cz*cz>R*R)continue;
   AB.splice(i,1);S.stats.hits++;if(b.g&&Math.random()<.5){if(HFX.length<60)HFX.push({x:e.x,y:e.y,h:e.h||0,t:time,team:e.team});break}   /* metralhador traseiro: rajada curta de plataforma instável, metade só fura lona */
   if(e.foreign)hitForeign(e,b.by);else hit(e,b.by,[b.vx,b.vy,b.vz]);break}}}

/* ======================================================================================
   DANO
   ====================================================================================== */
function hit(a,by,bv){if(!live(a))return;const T=a.T,f=nrm(a.V),fromBehind=dot(nrm(bv),f)>.35;
 if(HFX.length<60)HFX.push({x:a.x,y:a.y,h:a.h,t:time,team:a.team});                                  // faíscas/lascas para o airwar-view
 a.lastHitBy=by;a.lastHitT=time;if(by&&!a.known.has(by)&&Math.random()<.7)a.known.set(by,time);
 if(by&&!by.foreign)by.seenBy.add(a);
 const r=Math.random(),P=a.pilot;
 /* distribuição do impacto: de trás o piloto e o tanque ficam mais expostos, de frente o motor protege */
 const W=fromBehind?[.12,.1,.09,.14,.4,.15]:[.07,.26,.08,.1,.37,.12];let k=0,acc=W[0];while(r>acc&&k<W.length-1)acc+=W[++k];
 a.dmg=Math.min(1,a.dmg+.035);
 if(k===0&&P){if(Math.random()<.42){P.wounded++;if(P.wounded>=2||Math.random()<.26)return down(a,by,'piloto','spin')}}
 else if(k===1){a.engHp--;a.power=Math.max(0,a.engHp/T.eng)**.6;a.smoke=Math.max(a.smoke,.4);if(T.rad&&Math.random()<.35)a.leak=a.leak||time+rnd(18,40);if(a.engHp<=0){a.power=0;a.mode='glide'}}
 else if(k===2){if(Math.random()<.14){a.fire=time;S.stats.flamers++;return down(a,by,'fogo','dive')}}
 else if(k===3){a.ctlHp--;}
 else if(k===4){a.strHp--;if(a.strHp<=0)return down(a,by,'estrutura','break')}
 else if(a.gunner&&a.gunner.alive&&Math.random()<.35){a.gunner.alive=false}
 else if(T.guns&&Math.random()<.25){a.jam[(Math.random()*T.guns)|0]=time+rnd(3,9)}
 if(a.mode!=='evade'&&a.T.cls==='f'&&by&&!by.foreign&&a.st==='air'&&a.mode!=='glide'){a.threat=by;a.mode='evade'}}
/* abatido: crédito, queda animada (anim-air), prisioneiro / paraquedas */
function down(a,by,cause,mode){if(!live(a))return;a.dead=true;a.air=false;a.cause=cause;const T=a.T,P=a.pilot;
 S.stats.losses[a.team]++;if(a.flight)a.flight.lost=(a.flight.lost||0)+1;
 const killer=by&&!by.foreign&&by.team!==a.team?by:null;
 if(killer){S.stats.kills[killer.team]++;S.stats.killsTotal++;killer.kills++;if(killer.pilot){killer.pilot.kills++;if(killer.pilot.kills===5)note(killer.team,`${killer.pilot.name} (${killer.T.name}) é ás: 5 vitórias!`,'ace'+killer.pilot.id,0,true)}
  const f=nrm(a.V),r=nrm([a.x-killer.x,a.y-killer.y,a.h-killer.h]);if(dot(f,r)>.35)S.stats.killsBehind++;if(!a.seenBy.has(killer)&&!a.known.has(killer))S.stats.killsUnseen++;
  if(killer.engT){S.stats.engageTime+=time-killer.engT}}
 S.log.push({t:+time.toFixed(1),team:a.team,type:T.key,cause,by:killer?killer.T.key:by&&by.foreign?'foreign':by?'ground':'?',x:a.x|0,y:a.y|0,h:a.h|0,mode:a.mode,v:Math.round(len3(a.V)),pitch:Math.round(poseOf(a).pitch),spun:a.spunT?+(time-a.spunT).toFixed(1):null});if(S.log.length>200)S.log.shift();
 const enemySide=!ownSide(a.team,a.x)&&a.x>0&&a.x<W;
 if(P){if(cause==='piloto'||cause==='fogo'&&Math.random()<.85||cause==='estrutura'&&Math.random()<.7)P.alive=false;else if(enemySide&&Math.random()<.8){P.alive=false;P.captured=true}P.busy=false}
 a.pilot=null;
 const mm=mode||(a.power<=0&&a.h<260?'glide':'dive');if(mm==='glide')S.stats.forced++;
 const who=P?P.name:T.name,side=a.team===playerTeam;
 note(a.team,side?`${who} (${T.name}) foi abatido${cause==='fogo'?' em chamas':''}${killer&&killer.pilot?` por ${killer.pilot.name}`:''}.`:`${T.name} inimigo abatido${killer&&killer.pilot?` por ${killer.pilot.name}`:''}.`,'down',4);
 crashVisual(a,killer?killer.team:1-a.team,cause,mm);
 if(a.slot)a.slot.lostAt=time;a.gone=true}
function crashVisual(a,byTeam,cause,mode){const pose=poseOf(a),av=Math.max(0,a.h)/CFG.ALTV,PXA=window.PXAIR;
 const off=a.x<0||a.x>W||a.y<0||a.y>H;
 if(PXA&&typeof PXA.crashFrom==='function'){try{PXA.crashFrom(a,{x:a.x,y:a.y,alt:av,hd:pose.hd,bank:pose.bank,pitch:pose.pitch,v:len3(a.V),type:a.T.vis,team:a.team},byTeam,cause,mode,{burn:cause==='fogo'||!!a.fire,soft:mode==='glide',off});return}catch(e){fail(e)}}
 /* sem anim-air: explode no chão onde caiu (só dentro do mapa) */
 if(!off&&typeof shells!=='undefined')shells.push({x:clamp(a.x,20,W-20),y:clamp(a.y,20,H-20),t:Math.min(2.5,a.h/120+.3),r:40,power:60,team:byTeam})}
/* alvos antigos (aviões do jogo, aviation.js, frontline.js): só "pontos de vida" */
function hitForeign(q,by){q.hp-=1;if(q.hp>0)return;if(q.done)return;q.done=true;S.stats.foreignKills++;if(by&&by.pilot)by.pilot.kills++;if(by)by.kills++;S.stats.kills[q.team?0:1]++;
 try{if(window.PXAIR&&PXAIR.crash)PXAIR.crash(q.ref,by?by.team:1-q.team,'abatido')}catch(e){fail(e)}
 note(q.team,q.team===playerTeam?'Aeronave nossa abatida por caça inimigo.':'Caça abateu aeronave inimiga.','fdown',5)}
function collectForeign(dt){FOREIGN.length=0;const add1=(ref,src,alt,cls,hp)=>{const vis=alt;const gx=ref.x+14*vis/(PX.Z||.5)*.5*2,gy=ref.y+22*vis/(PX.Z||.5)*.5*2;
  const pr=FPREV.get(ref);const V=pr&&dt>0?[(gx-pr.x)/dt,(gy-pr.y)/dt,0]:[0,0,0];FPREV.set(ref,{x:gx,y:gy});
  let q=ref._awq;if(!q){q=ref._awq={foreign:1,ref,src,team:ref.team?1:0,hp,cls,hitR:cls==='b'||cls==='B'?24:17}}q.x=gx;q.y=gy;q.h=alt*CFG.ALTV;q.V=V;q.air=true;if(!q.done)FOREIGN.push(q)};
 try{if(typeof planes!=='undefined')for(const p of planes){if(p.delay>0||p.downed)continue;add1(p,'g',p.kind==='bomber'?1:.8,p.kind==='bomber'?'b':'f',p.kind==='bomber'?14:6)}
  const A=window.PXAIR&&typeof PXAIR.air==='function'?PXAIR.air():[];for(const p of A){if(p.dead||p.wait>0)continue;add1(p,'a',p.role==='spot'?.7:p.role==='atk'?.4:.76,p.role==='cap'?'f':'2',p.role==='cap'?6:9)}
  const F=window.PXFL&&typeof PXFL.planes==='function'?PXFL.planes():[];for(const p of F){if(p.st==='down'||p.dead)continue;add1(p,'f',(p.alt||46)/38,'2',9)}}catch(e){fail(e)}}

/* ======================================================================================
   SOLO × AR: metralhadoras, antiaérea, Archie
   ====================================================================================== */
let groundT=0;
function groundFire(dt){groundT-=dt;if(groundT>0)return;groundT=.25;const st=.25,GM=CFG.GROUND_MG;
 const aa=aaPosts();
 for(const a of AC){if(!airborne(a)||truce())continue;
  /* metralhadoras inimigas: só quem passa baixo sobre elas */
  if(a.h<GM.h&&a.x>0&&a.x<W){let n=0;for(const u of units)if(u.team!==a.team&&u.hp>0&&u.type==='mg'&&!u.down&&hyp(u.x-a.x,u.y-a.y)<GM.r)n++;
   if(n&&Math.random()<1-Math.pow(1-GM.p*(1-a.h/GM.h),n*st*1)){S.stats.groundHits++;hit(a,null,[0,0,1])}}
  /* antiaérea */
  for(const p of aa){if(p.team===a.team)continue;const d=hyp(p.x-a.x,p.y-a.y);if(d>CFG.FLAK.r)continue;p.cd=(p.cd||0)-st;if(p.cd>0)continue;p.cd=CFG.FLAK.every*rnd(.8,1.2);
   archie(a,p.team);if(Math.random()<CFG.FLAK.p*(1-d/CFG.FLAK.r*.5)){S.stats.flakHits++;hit(a,null,[0,0,1]);if(Math.random()<.4)hit(a,null,[0,0,1])}}
  /* Archie da frente: quem cruza para o lado inimigo */
  if(a.x>0&&a.x<W&&!ownSide(a.team,a.x)&&Math.abs(a.x-FRONT)<900&&a.h>200){a.arch=(a.arch||0)-st;if(a.arch<=0){a.arch=rnd(...CFG.ARCHIE.every);archie(a,1-a.team);if(Math.random()<CFG.ARCHIE.p)hit(a,null,[0,0,1])}}}}
function archie(a,team){if(ARCH.length>90)ARCH.shift();const f=nrm(a.V),lead=rnd(.1,.9);ARCH.push({x:a.x+f[0]*len3(a.V)*lead+rnd(-50,50),y:a.y+f[1]*len3(a.V)*lead+rnd(-50,50),h:a.h+rnd(-40,40),t:0,team,max:rnd(3.5,5)});
 if(nearCam(a,900)&&Math.random()<.3)try{sound('boom')}catch{}}
function aaPosts(){const r=[];try{const sp=window.IronFront&&IronFront.sappers;const segs=sp&&sp.segs;if(segs)for(const s of segs)if(s.kind==='aa'&&(s.stage>=3||s.done))r.push(s)}catch{}if(window.PXAIRB&&PXAIRB.on)for(const p of PXAIRB.aaPosts())r.push(p);return r}

/* ======================================================================================
   ESQUADRILHAS (voos) E MISSÕES
   ====================================================================================== */
const MNAME={cap:'Patrulha',int:'Interceptação',esc:'Escolta',atk:'Ataque ao solo',bmb:'Bombardeio',rec:'Reconhecimento'};
function newFlight(team,kind,members,area,extra){const f=Object.assign({id:++flSeq,team,kind,m:members,area,hurry:kind==='int',alt:area.alt||900,phase:'start',t0:time,until:time+(area.dur||70),wp:null,lost:0,
  lead(){return this.m.find(x=>live(x)&&x.st==='air')||null}},extra||{});
 members.forEach((a,i)=>{a.flight=f;a.fi=i;a.mode='form';a.st='start';a.startT=time;a.pilot.busy=true;a.pilot.sorties++;a.sortieT=time;beginStart(a,i*1.4+rnd(0,.6))});
 FL.push(f);S.stats.sorties[team]+=members.length;S.stats.missions[kind]=(S.stats.missions[kind]||0)+1;
 if(team===playerTeam)note(team,`${MNAME[kind]}: ${members.length} ${members[0].T.name} decolando do aeródromo.`,'fl'+f.id,0);
 return f}
function ready(team,cls,role){const r=[];for(const a of AC){if(a.team!==team||!live(a)||a.st!=='park'||a.ready>time||!a.pilot||a.pilot.busy||!a.pilot.alive)continue;if(cls&&!cls.includes(a.T.cls))continue;if(role&&a.slot.role!==role)continue;r.push(a)}return r}
const nAir=team=>AC.filter(a=>a.team===team&&live(a)&&a.st!=='park').length;
function launch(team,kind,x,y,o={}){if(nAir(team)>=CFG.MAXAIR)return null;if(window.PXAIRB&&PXAIRB.on&&!PXAIRB.canLaunch(team,kind,o))return null;
 let pool,n;
 if(o.pick&&o.pick.length){pool=o.pick.filter(a=>a.team===team&&live(a)&&a.st==='park'&&a.ready<=time&&a.pilot&&!a.pilot.busy&&a.pilot.alive);n=pool.length}   /* aviões escolhidos pelo jogador (airsel.js) */
 else if(kind==='cap'||kind==='int'||kind==='esc'){n=o.n||(kind==='int'?2:3);pool=ready(team,['f'],'f');if(pool.length<n)pool=pool.concat(ready(team,['f'],'a'))}   /* Camels americanos (17º/148º Aero) também caçavam */
 else if(kind==='atk'){pool=ready(team,null,'a');n=o.n||3}
 else if(kind==='rec'){pool=ready(team,null,'r').filter(a=>a.T.recon);n=1}
 else if(kind==='bmb'){pool=ready(team,null,'b');if(!pool.length)pool=ready(team,null,'r').filter(a=>a.T.bombs);n=o.n||pool.length}
 if(!pool||!pool.length)return null;pool.sort((a,b)=>(b.pilot.skill+b.pilot.kills*.05)-(a.pilot.skill+a.pilot.kills*.05));
 const m=pool.slice(0,Math.max(1,Math.min(n,pool.length,CFG.MAXAIR-nAir(team))));if(m.length<(kind==='cap'&&!o.pick?2:1))return null;
 const alt=o.alt||(kind==='atk'?380:kind==='rec'?(m[0].T.key==='rumpler'?1250:950):kind==='bmb'?(m[0].T.cls==='B'?1050:950):kind==='int'?850:rnd(850,1150));
 const f=newFlight(team,kind,m,{x,y,alt,dur:kind==='cap'?rnd(55,80):kind==='int'?45:kind==='rec'?999:999},o.extra);
 if(o.target)f.target=o.target;if(window.PXAIRB&&PXAIRB.on)PXAIRB.onLaunch(f);return f}
/* escolta acompanha outro voo */
function launchEscort(team,of,n){const f=launch(team,'esc',of.area.x,of.area.y,{n,extra:{escortOf:of},alt:of.alt+120});if(f)of.escort=f;return f}

/* rota da missão do líder e posição dos alas */
function missionSteer(a,dt){const f=a.flight,T=a.T,v=len3(a.V),fw=nrm(a.V),pos=[a.x,a.y,a.h];let D=fw,nl=T.nSus*1.1,thr=1,fire=null;
 if(!f){if(!a.home0)a.home0={x:a.x,y:a.y,h:Math.max(500,a.h)};const ang=time*.4+a.id,tx=a.home0.x+Math.cos(ang)*380-a.x,ty=a.home0.y+Math.sin(ang)*260-a.y,tl=hyp(tx,ty)||1;return{D:nrm([tx/tl,ty/tl,clamp((a.home0.h-a.h)/300,-.4,.4)]),nl,thr}}
 const L=f.lead();
 if(L&&L!==a&&f.phase!=='start'){/* ala: posição em escalão atrás do líder, casa a velocidade */
  const i=a.fi,lf=nrm([L.V[0],L.V[1],0]),rt=[-lf[1],lf[0],0],side=i%2?1:-1,row=Math.ceil(i/2);
  const slot=add(add([L.x,L.y,L.h],sc(lf,-70*row)),add(sc(rt,side*62*row),[0,0,12*row]));
  const tgt=add(slot,sc(L.V,.8)),r=sub(tgt,pos),d=len3(r);D=nrm(add(sc(nrm(r),Math.min(1,d/120)),sc(nrm(L.V),1-Math.min(1,d/120))));
  const vL=len3(L.V),ahead=dot(r,nrm(L.V));thr=clamp(.75+ahead/220+(vL-v)/120,.35,1);nl=T.nSus*1.4;
  if(f.kind==='bmb'&&f.phase==='work'&&a.bombs>0)bombRelease(a,f);
  if(f.kind==='atk'&&f.phase==='work')return attackRun(a,f,dt);
  return{D,nl,thr,fire}}
 /* líder */
 const wp=f.wp,goTo=(x,y,h)=>{const r=[x-a.x,y-a.y,0],d=hyp(r[0],r[1]),dz=clamp((h-a.h)/300,-.45,.55);return{D:nrm([r[0]/(d||1),r[1]/(d||1),dz]),d}};
 switch(f.phase){
 case 'assemble':{const af=AF[a.team],ang=time*.35,{D:dd}=goTo(af.x+Math.cos(ang)*420,af.y-380+Math.sin(ang)*210,Math.max(260,f.alt*.45));D=dd;thr=.82;break}
 case 'out':{const t=f.target&&live(f.target)?f.target:null,X=t?t.x:f.area.x,Y=t?t.y:f.area.y;const r=goTo(X,Y,f.alt);D=r.D;thr=f.kind==='bmb'||f.kind==='rec'?.92:.95;
  if(f.escortOf){const E=f.escortOf.lead();if(E){const r2=goTo(E.x-Math.cos(E.hd)*60,E.y-Math.sin(E.hd)*60,E.h+130);D=r2.D;thr=clamp(.7+(r2.d-120)/400,.5,1)}}
  break}
 case 'work':{
  if(f.kind==='cap'||f.kind==='int'||f.kind==='esc'){/* órbita de patrulha (oval) */const c=f.target&&live(f.target)?f.target:f.area,ang=(time-f.t0)*.42*(f.team?-1:1);
   if(f.escortOf){const E=f.escortOf.lead();if(E){const r2=goTo(E.x-Math.cos(E.hd)*70,E.y-Math.sin(E.hd)*70,E.h+140);D=r2.D;thr=clamp(.7+(r2.d-120)/400,.5,1);break}}
   const r=goTo(c.x+Math.cos(ang)*360,c.y+Math.sin(ang)*230,f.alt);D=r.D;thr=.85}
  else if(f.kind==='rec'){/* rota de fotografia sobre a retaguarda inimiga */if(!f.wp){const dir=a.team?-1:1,x0=f.area.x,ys=[f.area.y-260,f.area.y+260];f.wp=[[x0,ys[0]],[x0+dir*420,ys[1]],[x0-dir*80,f.area.y]];f.wi=0}
   const p=f.wp[f.wi];if(p){const r=goTo(p[0],p[1],f.alt);D=r.D;thr=.9;if(r.d<120)f.wi++}else f.phase='home';reveal(a)}
  else if(f.kind==='bmb'){/* corrida de bombardeio reta e nivelada */const r=goTo(f.area.x,f.area.y,f.alt);D=nrm([r.D[0],r.D[1],r.D[2]*.3]);thr=.92;if(a.bombs>0)bombRelease(a,f);if(f.m.every(m=>!live(m)||m.bombs<=0||m.st!=='air'))f.phase='home'}
  else if(f.kind==='atk')return attackRun(a,f,dt);
  break}
 case 'home':{const af=AF[a.team],r=goTo(af.x,af.y,Math.max(300,f.alt*.6));D=r.D;thr=.9;if(r.d<900){for(const m of f.m)if(live(m)&&m.st==='air'&&m.mode!=='glide')m.mode='rtb'}break}}
 return{D,nl,thr,fire}}
/* ataque ao solo: mergulho raso, rajada no ponto, bombas, sai baixo e volta */
function attackRun(a,f,dt){const T=a.T,pos=[a.x,a.y,a.h],fw=nrm(a.V);
 if(!a.run){const tx=f.area.x+rnd(-90,90),ty=f.area.y+rnd(-120,120);a.run={tx,ty,stage:'in',t:time}}
 const R=a.run,dx=R.tx-a.x,dy=R.ty-a.y,d=hyp(dx,dy);let D,thr=1,nl=T.nSus*1.5;
 if(R.stage==='in'){const hh=d>600?f.alt:lerp(70,f.alt,clamp((d-150)/450,0,1));D=nrm([dx/d,dy/d,clamp((hh-a.h)/150,-.6,.4)]);if(d<160)R.stage='strafe'}
 else if(R.stage==='strafe'){D=nrm([dx/(d||1),dy/(d||1),clamp((45-a.h)/120,-.5,.3)]);strafe(a,dt);if(a.bombs>0&&d<70){dropBomb(a,R.tx,R.ty);if(a.bombs>0)dropBomb(a,R.tx+rnd(-30,30),R.ty+rnd(-30,30))}
  if(dot([dx,dy,0],fw)<0||d>260)R.stage='out',R.t=time}
 else{const hd=homeDir(a);D=nrm([hd[0],hd[1],a.h<220?.35:0]);if(time-R.t>4){a.run=null;f.passes=(f.passes||0)+1;if(f.passes>=f.m.length*2||a.ammo.every(x=>x<60))f.phase='home'}}
 return{D,nl,thr}}
function strafe(a,dt){if(truce())return;a.sgcd=(a.sgcd||0)-dt;if(a.sgcd>0)return;a.sgcd=.07;const f=nrm(a.V),hd=Math.atan2(f[1],f[0]);
 const g=a.ammo.findIndex(x=>x>0);if(g<0)return;a.ammo[g]--;S.stats.strafe++;
 /* rajada pelo chão à frente do avião: projétil do jogo curto (dano igual ao do caça antigo) */
 const lead=a.h/Math.max(.2,-f[2]||.25)*.6,gx=a.x+Math.cos(hd)*clamp(lead,40,220),gy=a.y+Math.sin(hd)*clamp(lead,40,220);
 if(gx<5||gx>W-5||gy<5||gy>H-5){if(window.PXAIRB&&PXAIRB.on)PXAIRB.strafe(a.team,gx,gy);return}
 bullets.push({x:gx-Math.cos(hd)*40,y:gy-Math.sin(hd)*40+rnd(-8,8),vx:Math.cos(hd)*900,vy:Math.sin(hd)*900+rnd(-60,60),t:.07,team:a.team,damage:20,friendlyFire:true,air:true,tr:Math.random()<.4})}
function dropBomb(a,tx,ty){if(a.bombs<=0||truce())return;a.bombs--;S.stats.bombs++;const B=BOMB[a.T.bk||'small'],av=Math.max(0,a.h)/CFG.ALTV,Z=PX.Z||.5;
 const fall=clamp(Math.sqrt(2*Math.max(30,a.h)/CFG.G)*.55,.8,2.4),x=clamp(tx,20,W-20),y=clamp(ty,20,H-20);
 if(tx<0||tx>W||ty<0||ty>H){if(window.PXAIRB&&PXAIRB.on)PXAIRB.bomb(a.team,tx,ty,B.p,B.r);return}
 shells.push({x,y,t:fall,r:B.r,power:B.p,team:a.team,bomb:{rx:a.x-14*av/Z,ry:a.y-22*av/Z,fall,team:a.team}})}
/* bombardeiro: solta quando o ponto de impacto previsto (com a deriva da velocidade) passa sobre o alvo */
function bombRelease(a,f){const fw=nrm(a.V),v=len3(a.V),fall=clamp(Math.sqrt(2*Math.max(30,a.h)/CFG.G)*.55,.8,2.4),ix=a.x+a.V[0]*fall*.85,iy=a.y+a.V[1]*fall*.85;
 const sk=a.pilot?a.pilot.skill:.4,tx=f.area.x+(a.fi||0)*30,ty=f.area.y;if(hyp(ix-tx,iy-ty)<60+(1-sk)*60||(a.salvo&&time-a.salvo<2.4)){if(!a.salvo)a.salvo=time;a.bcd=(a.bcd||0)-1/30;if(a.bcd<=0){a.bcd=.35;dropBomb(a,ix+rnd(-25,25)*(1.4-sk),iy+rnd(-25,25)*(1.4-sk))}}}
/* reconhecimento: abre a névoa do próprio lado sob a rota */
function reveal(a){S.stats.recon+=1/30;const fw=window.PXW&&PXW.fow;if(!fw||!fw.on||!fw.grid||fw.team!==a.team||a.x<0||a.x>W)return;const R=300,ch=Math.ceil(H/64);
 for(let y=Math.max(0,Math.floor((a.y-R)/64));y<=Math.min(ch-1,Math.floor((a.y+R)/64));y++)for(let x=Math.max(0,Math.floor((a.x-R)/64));x<=Math.min(fw.cw-1,Math.floor((a.x+R)/64));x++)if(hyp(x*64+32-a.x,y*64+32-a.y)<R)fw.grid[y*fw.cw+x]=1}

/* ======================================================================================
   POUSO: regresso, circuito, final, toque
   ====================================================================================== */
const dd0=(a,tx,ty)=>hyp(tx-a.x,ty-a.y);
function landing(a,dt){const af=AF[a.team],T=a.T,dir=af.dir,td=rwTouch(af),v=len3(a.V);let D=nrm(a.V),nl=T.nSus*1.3,thr=.7;
 const FL=CFG.FINAL||800,iaf=[td-dir*FL,af.y];                                   // ponto de entrada da final: 800 u antes do toque, alinhado com a pista (chega pela perna de vento, do lado em que o avião está)
 if(a.mode==='rtb'||a.mode==='glide'){const gl=a.mode==='glide'||a.power<=0;
  const r=[iaf[0]-a.x,iaf[1]-a.y],d=hyp(r[0],r[1]),rf=[td-a.x,af.y-a.y],dfd=hyp(rf[0],rf[1]);
  if(gl){/* sem motor: planeia direto para o campo; não chega → pouso forçado onde der */D=nrm([rf[0]/dfd,rf[1]/dfd,-.11]);thr=0;
   if(dfd<500&&a.h<140){a.mode='final'}else if(a.h<10)return forced(a);return{D,nl,thr}}
  if(!a.lp||time-a.lp.t>90)a.lp={side:-1,t:time,st:0};const L=a.lp;let tx,ty;
  if(L.st===0){tx=iaf[0]-dir*30;ty=af.y+L.side*440;if(hyp(tx-a.x,ty-a.y)<240)L.st=1}                 // 1ª perna: ao lado da entrada da final; 2ª: curva para a final
  if(L.st===1){tx=iaf[0]+dir*220;ty=af.y}
  const al1=(a.x-td)*dir,hh=L.st===1?clamp(-al1*.09+30,70,260):dd0(a,tx,ty)>1400?Math.max(380,Math.min(a.h,700)):220,rr=[tx-a.x,ty-a.y],dd=hyp(rr[0],rr[1]);D=nrm([rr[0]/(dd||1),rr[1]/(dd||1),clamp((hh-a.h)/300,-.35,.3)]);thr=L.st===1&&v>T.vst*1.5?0:.8;       // na perna final já desce pela rampa e tira potência: chega ao toque devagar
  if(L.st===1){const al0=(a.x-td)*dir,lt0=Math.abs(a.y-af.y);
   if(al0>-FL-120&&al0<-300&&lt0<230&&Math.cos(Math.atan2(a.V[1],a.V[0])-(dir>0?0:Math.PI))>.55){a.lp=null;if(rwBusy(af,a)){a.mode='circuit';a.circT=time}else{a.mode='final'}}
   else if(al0>=-300){a.lp=null;a.mode='circuit';a.circT=time}}
  return{D,nl,thr}}
 if(a.mode==='circuit'){const ang=(time-a.circT)*.45,{x,y}=af;D=nrm([x+Math.cos(ang)*560-a.x,y-260+Math.sin(ang)*380-a.y,clamp((260-a.h)/200,-.3,.3)]);thr=.7;
  if(!rwBusy(af,a)&&time-a.circT>4){a.mode='rtb';a.lp=null}return{D,nl,thr}}
 /* final: alinha com a pista, rampa de 5°, velocidade 1,3 vst, arredonda perto do chão */
 const along=(a.x-td)*dir,lat=a.y-af.y,hT=Math.max(0,-along)*.09,flare=a.h<14;
 D=nrm([dir*220,-lat*1.1,flare?-4:Math.max(-70,-20+(hT-a.h)*.9)]);thr=a.power<=0?0:clamp(.35+(T.vst*1.3-v)/50,0,.85);nl=T.nSus*1.3;
 if(a.h<6&&Math.abs(lat)<50&&along>(af.compact?-90:-200)&&along<300&&v<T.vst*1.8)return touchdown(a);
 if(a.power>0&&(along>320||Math.abs(lat)>150&&along>-500)){S.stats.goArounds++;a.mode='circuit';a.circT=time;a.landTry++}
 return{D,nl,thr}}
function touchdown(a){const af=AF[a.team],v=len3(a.V),hard=-a.V[2]>38||v>a.T.vst*1.6;a.air=false;a.h=0;a.st='rollout';a.gv=hyp(a.V[0],a.V[1]);a.mode='';
 if(hard&&Math.random()<.45+(a.dmg*.5)){S.stats.landingCrashes++;a.dead=true;a.gone=true;a.cause='pouso';note(a.team,`${a.T.name} capotou no pouso.`,'cap',8);if(a.pilot){a.pilot.busy=false;if(Math.random()<.25)a.pilot.alive=false;else a.pilot.wounded=1}a.pilot=null;
  if(a.slot)a.slot.lostAt=time;crashVisual(a,1-a.team,'pouso','glide');return{D:nrm(a.V),nl:1,thr:0}}
 S.stats.landings++;return{D:nrm(a.V),nl:1,thr:0}}
function forced(a){S.stats.forced++;a.power=0;down(a,a.lastHitBy,'pouso forçado','glide');return{D:[1,0,0],nl:1,thr:0}}

/* ======================================================================================
   SOLO: motor, taxiamento, corrida, rolagem pós-pouso, estacionamento
   ====================================================================================== */
/* a faixa está ocupada? (um avião de cada vez: corrida, alinhado, pouso na final, rolando, ainda sobre a faixa ao taxiar, ou nos primeiros metros de subida) */
function rwBusy(af,self){for(const b of AC){if(b===self||b.team!==af.team||!live(b))continue;
  if(b.st==='lineup'||b.st==='roll'||b.st==='rollout')return b;
  if(b.st==='taxiin'&&b.y>af.y-92&&Math.abs(b.x-af.x)<af.half+90)return b;
  if(b.air&&(b.mode==='final'||b.mode==='climbout'&&b.h<26&&Math.abs(b.y-af.y)<140&&Math.abs(b.x-af.x)<af.half+260))return b}
 return null}
/* avião logo à frente no caminho (mesma faixa de táxi ou cruzamento): espera, sem passar por cima */
function inFront(a){const c=Math.cos(a.hd),s=Math.sin(a.hd);
 for(const b of AC){if(b===a||b.team!==a.team||!live(b)||b.air)continue;if(b.st==='park'||b.st==='start')continue;
  if((a.st==='taxi'&&(b.st==='lineup'||b.st==='roll')||a.st==='lineup'&&b.st==='taxi')&&Math.abs(b.y-a.y)>45)continue;   // faixa de táxi × cabeceira: só se cruzam de verdade (evita um esperar o outro 14 s)
  const rx=b.x-a.x,ry=b.y-a.y,fw=rx*c+ry*s,lt=Math.abs(-rx*s+ry*c);
  if(fw>0&&fw<(a.T.len+b.T.len)/2+34&&lt<(a.T.span+b.T.span)*.28||fw>-10&&hyp(rx,ry)<(a.T.span/2+b.T.len/2+14))return b}   // na mesma faixa de táxi, ou cruzando à frente
 return null}
/* segue a.path com limite de curva (sem freio, sem giro no lugar) e dá o passo; true ao chegar ao fim */
function taxiStep(a,dt,spd){const bl=inFront(a);
 if(bl){a.blockT=(a.blockT||0)+dt;if(a.blockT<(a.st==='taxiin'?5:14)){a.gv*=Math.max(0,1-dt*4);a.pose={hd:a.hd,bank:0,pitch:11};return false}}else a.blockT=0;
 let P=a.path[a.pi];while(P&&a.pi<a.path.length-1&&hyp(P[0]-a.x,P[1]-a.y)<9){a.pi++;P=a.path[a.pi]}
 if(!P)return true;const dx=P[0]-a.x,dy=P[1]-a.y,d=hyp(dx,dy),last=a.pi>=a.path.length-1;
 if(last&&d<3){a.gv=0;return true}
 const want=Math.atan2(dy,dx)+(a.st==='lineup'?0:Math.sin(time*1.3+a.id)*.09),dh=adiff(want,a.hd),mx=1.25*dt;a.hd+=clamp(dh,-mx,mx);
 const tgt=spd*clamp(1.2-Math.abs(dh)*1.1,.35,1)*(last?clamp(d/40,.25,1):1);a.gv+=(tgt-a.gv)*Math.min(1,dt*1.6);
 const st=Math.min(d,a.gv*dt);a.x+=Math.cos(a.hd)*st;a.y+=Math.sin(a.hd)*st;a.pose={hd:a.hd,bank:0,pitch:11};return false}
/* regime do motor: rpm 0–1 (a hélice do airwar-view gira por aqui). Parado = 0; puxões à mão são pulsos curtos; rotativo do Camel pisca no solo */
function engine(a,dt){const T=a.T;let tgt=0,tau=.6;
 if(a.air){tgt=a.power>0&&a.fuel>0?Math.min(1,.55+.45*a.thr)*Math.min(1,.4+a.power):0;tau=.5}
 else if(a.eng==='run'){
  if(a.st==='roll')tgt=1;else if(a.st==='lineup')tgt=a.gp==='runup'?((time-a.gt)%CFG.GP.runup<CFG.GP.runup*.55?.84:.4):.42;
  else if(a.st==='rollout')tgt=.3;else tgt=a.gp==='chocks'?.52:.4;
  if(T.torque&&(a.st==='taxi'||a.st==='taxiin'||a.st==='hold'))tgt=((time*2.1+a.id*.37)%1)<.5?.6:.28;       // corta e liga o rotativo (interruptor de "blip")
  tau=tgt>a.rpm?(tgt>.7?.9:.5):.45}
 else tau=a.st==='start'&&(a.gp==='prime'||a.gp==='swing')?.2:.9;
 a.rpm+=(tgt-a.rpm)*Math.min(1,dt/tau);if(a.rpm<.004&&tgt===0)a.rpm=0;a.engOn=a.rpm>.04&&(a.eng==='run'||a.air)}     // fumaça e som do motor só com o motor ligado (os puxões giram a hélice mas não são o motor)
/* ---- partida: o piloto vem, faz o pré-voo, sobe; o mecânico dá os puxões, "contato", gira a hélice; aquecimento, calços fora ---- */
function beginStart(a,delay){const GP=CFG.GP,hur=!!(a.flight&&a.flight.hurry),sp=hur?GP.run:GP.walk;a.gp='crew';a.gt=time;a.swN=0;a.eng='off';a.chocks=true;a.kicked=false;
 crewList(a).forEach(({p,seat},i)=>{if(!p)return;p.q.length=0;p.plane=null;if(p.act==='seat'||p.act==='climb')p.act='idle';p.seat=seat;
  const b=boardPt(a,seat);pwait(p,delay+i*.8,'idle');pgo(p,[b],sp,hur?'run':'walk');
  if(!hur&&i===0)pgo(p,inspectPts(a),GP.walk*.75,'inspect');
  pdo(p,q=>{q.plane=a;q.x=b[0];q.y=b[1]});pwait(p,GP.climb*(i?.9:1)*(hur?.7:1),'climb');pdo(p,q=>{q.act='seat';q.t0=time})})}
function startSeq(a,dt){const GP=CFG.GP,T=a.T,el=time-a.gt;
 if(!a.pilot||!a.pilot.alive){a.st='park';a.gp='';a.flight=null;return}
 switch(a.gp){
 case 'crew':if(crewList(a).every(c=>!c.p||c.p.act==='seat')){a.gp='prime';a.gt=time;a.primeN=0;a.primeT=(T.torque?rnd(1.2,1.8):rnd(...GP.prime))*(a.flight&&a.flight.hurry?.65:1)}break;
 case 'prime':{const n=Math.floor(el/.9);if(n>a.primeN&&el<a.primeT){a.primeN=n;a.rpm=Math.max(a.rpm,.085)}      // puxões com o contato aberto ("switch off, suck in")
  if(el>=a.primeT){a.gp='swing';a.gt=time;a.kicked=false}break}
 case 'swing':{if(!a.kicked&&el>=GP.kick){a.kicked=true;a.rpm=Math.max(a.rpm,.1);
   if(Math.random()<(T.torque?.78:.55)+.13*a.swN){a.eng='run';a.gp='warm';a.gt=time;a.warmT=a.flight&&a.flight.hurry?rnd(1.6,2.6):rnd(...GP.warm);S.stats.starts=(S.stats.starts||0)+1}else a.swN++}
  else if(a.kicked&&el>=GP.swing){a.gt=time;a.kicked=false}break}                                   // o motor não pegou: outra tentativa
 case 'warm':if(el>=a.warmT){a.gp='chocks';a.gt=time}break;
 case 'chocks':if(el>=GP.chocks*(a.flight&&a.flight.hurry?.7:1)){a.chocks=false;a.st='taxi';a.gp='';a.path=outPath(a);a.pi=1;a.gv=0}break}}
/* regresso ao estacionamento: motor cortado, o piloto desce, vai ao relatório na barraca de operações e volta para perto do avião */
function crewOut(a,kind){const GP=CFG.GP;
 crewList(a).forEach(({p,seat},i)=>{if(!p||p.act!=='seat')return;const b=boardPt(a,seat),fy=a.slot.y+a.T.len/2+26;
  p.q.length=0;p.plane=a;p.seat=seat;p.act='idle';pwait(p,GP.climb*.9+i*.6,'climbout');pdo(p,q=>{q.plane=null;q.seat=-1;q.x=b[0];q.y=b[1]});
  const home=spotFor(a,i?1:0);
  if(i===0&&kind){pgo(p,[[b[0]+10,fy],[a.slot.x+24,fy]],GP.walk,'walk');pwait(p,rnd(...GP.debrief)*.7,'debrief');pgo(p,[[home[0],fy],home],GP.walk,'walk')}   // conta ao mecânico-chefe o que o motor fez
  else pgo(p,[[b[0]+8,b[1]+16],home],GP.walk*.8,'walk')})}
function ground(a,dt){const af=AF[a.team],T=a.T,GP=CFG.GP;
 switch(a.st){
 case 'park':slotPose(a);
  if(a.pilot&&!a.pilot.alive){a.pilot=null}
  if(!a.pilot){const p=PILOTS[a.team].find(p=>p.alive&&!p.busy&&!p.assigned&&p.restUntil<time);if(p){a.pilot=p;p.assigned=true;p.q.length=0;p.plane=null;pgo(p,[spotFor(a,0)],GP.walk,'walk')}}
  break;
 case 'start':slotPose(a);startSeq(a,dt);break;
 case 'taxi':if(taxiStep(a,dt,a.flight&&a.flight.hurry?CFG.TAXI*1.2:CFG.TAXI)){a.st='hold';a.gv=0;a.holdT=time}break;
 case 'hold':{a.gv=0;a.pose={hd:a.hd,bank:0,pitch:11};if(!rwBusy(af,a)&&!AC.some(b=>b!==a&&b.team===a.team&&live(b)&&b.st==='hold'&&(b.holdT<a.holdT||b.holdT===a.holdT&&b.id<a.id))){   /* fila: o primeiro a chegar ao ponto de espera é o primeiro a entrar */a.st='lineup';a.gp='';a.path=lineupPath(a);a.pi=1}break}   // um de cada vez: só entra na faixa com ela livre
 case 'lineup':{if(a.gp!=='runup'){if(taxiStep(a,dt,CFG.TAXI)){a.gp='runup';a.gt=time;a.gv=0}}
  else{a.hd+=adiff(af.dir>0?0:Math.PI,a.hd)*Math.min(1,dt*4);a.gv=0;a.y+=(af.y-a.y)*Math.min(1,dt*3);a.pose={hd:a.hd,bank:0,pitch:11};if(time-a.gt>=GP.runup){a.st='roll';a.gp='';a.rollT=time}}break}   // prova de motor
 case 'roll':{const vr=T.vst*1.2,k=T.cls==='B'?.62:T.cls==='b'?.82:1;a.gv+=CFG.ROLLA*k*a.power*(1-.3*Math.min(1,a.gv/vr)**2)*dt;
  a.x+=af.dir*a.gv*dt;a.y+=(af.y-a.y)*Math.min(1,dt*2);a.hd=af.dir>0?0:Math.PI;
  a.pose={hd:a.hd,bank:0,pitch:11*clamp((vr*.62-a.gv)/(vr*.3),0,1)+(a.gv>vr*.93?3:0)};                                   // cauda sobe, depois a rotação
  if(a.gv>=vr){const c=Math.cos(.04),sn=Math.sin(.04);a.air=true;a.st='air';a.V=[af.dir*a.gv*c,0,a.gv*sn];a.U=nrm([-sn*af.dir,0,c]);a.h=1.4;a.mode='climbout';a.tStart=time;a.liftT=time;
   const f=a.flight;if(f&&f.phase==='start')f.phase='assemble';if(f&&!f.tUp)f.tUp=time}break}
 case 'rollout':{a.gv=Math.max(0,a.gv-(16+.26*a.gv)*dt);a.x+=Math.cos(a.hd)*a.gv*dt;a.y+=Math.sin(a.hd)*a.gv*dt+(af.y-a.y)*Math.min(1,dt);a.pose={hd:a.hd,bank:0,pitch:a.gv<a.T.vst*.7?11:5};
  if(a.gv<CFG.TAXI*1.1){a.st='taxiin';a.path=inPath(a);a.pi=1}break}
 case 'taxiin':if(taxiStep(a,dt,CFG.TAXI))parkIn(a);break}}
function parkIn(a){const T=a.T,kind=a.flight&&a.flight.kind;a.st='park';a.eng='off';crewOut(a,kind);a.chocks=true;a.gp='out';a.gt=time;a.flight=null;a.mode='';a.tgt=null;a.threat=null;a.known.clear();a.run=null;a.salvo=0;
 const rep=Math.round((a.dmg+(T.eng-a.engHp)/T.eng+(T.str-a.strHp)/T.str)*20);a.ready=time+rnd(...CFG.REARM)+rep*CFG.REPAIR;
 if(typeof S.service==='function'){a.ready=Infinity;a.serviceWaiting=true;slotPose(a);S.service(a);return}
 finishService(a)}
function finishService(a){const T=a.T;a.serviceWaiting=false;
 a.ammo.fill(T.ammo);a.jam.fill(0);a.fuel=T.fuel;a.bombs=T.bombs||0;a.rearAmmo=T.rear?97:0;a.drums=T.rear?6:0;a.engHp=T.eng;a.strHp=T.str;a.ctlHp=3;a.power=1;a.dmg=0;a.leak=0;a.smoke=0;a.landTry=0;a.fire=0;
 if(a.gunner&&!a.gunner.alive)a.gunner={skill:rnd(.3,.6),alive:true};
 if(a.pilot){a.pilot.busy=false;if(a.pilot.wounded){a.pilot.restUntil=time+60*a.pilot.wounded;a.pilot.wounded=0;a.pilot.assigned=false;a.pilot=null}}
 slotPose(a)}

/* ======================================================================================
   QUARTEL-GENERAL AÉREO (cada lado)
   ====================================================================================== */
function hqInit(team){return{team,next:{cap:time+rnd(4,10),rec:time+rnd(20,40),atk:time+rnd(70,110),bmb:time+rnd(120,170)},t:0,auto:!window.IronFrontAirCommand}}   /* com o comando do battle-air-command.js (custo e teto), o QG daqui fica só para as ordens */
function intruders(team){const r=[];for(const e of enemiesOf(team)){if(e.x>-200&&e.x<W+200&&ownSide(team,e.x)||hyp(e.x-AF[team].x,e.y-AF[team].y)<900)r.push(e)}return r}
function groundTarget(team,depth){/* concentração inimiga: grade de 160 u, pesos por tipo; depth>0 prefere a retaguarda */const cells=new Map();
 for(const u of units){if(u.team===team||u.hp<=0)continue;const k=Math.floor(u.x/160)+','+Math.floor(u.y/160);const w=u.type==='tank'?4:u.type==='mg'?2.5:u.type==='cavalry'?1.5:1;let c=cells.get(k);if(!c)cells.set(k,c={n:0,x:0,y:0});c.n+=w;c.x+=u.x*w;c.y+=u.y*w}
 for(const b of buildings){if(b.team===team||b.hp<=0)continue;const w=b.type==='bunker'?6:b.type==='trench'?1.5:0;if(!w)continue;const k=Math.floor(b.x/160)+','+Math.floor(b.y/160);let c=cells.get(k);if(!c)cells.set(k,c={n:0,x:0,y:0});c.n+=w;c.x+=b.x*w;c.y+=b.y*w}
 let best=null,bs=0;for(const c of cells.values()){const x=c.x/c.n,y=c.y/c.n,deep=(team?FRONT-x:x-FRONT);let s=c.n*(1+clamp(deep/600,-.4,1)*(depth||0));if(s>bs){bs=s;best={x,y}}}
 return best}
function hqTick(dt){for(let t=0;t<2;t++){const Q=HQ[t];if(!Q)continue;Q.t-=dt;if(Q.t>0)continue;Q.t=CFG.HQ;
 /* ordens do jogador primeiro */
 /* ordens do jogador: esperam até 25 s por aviões prontos */
 {const keep=[];for(const o of ORD[t]){const f=doOrder(t,o.kind,o.x,o.y);if(f){if(t===playerTeam&&o.waited)note(t,`${MNAME[o.kind]}: aviões prontos, decolando.`,'okac',2);continue}if(time-o.t<25){if(!o.waited&&t===playerTeam)note(t,`${MNAME[o.kind]}: aguardando aviões prontos no aeródromo.`,'waitac',4);o.waited=1;keep.push(o)}else if(t===playerTeam)note(t,`Sem aviões prontos para ${MNAME[o.kind]||o.kind}.`,'noac',3)}ORD[t]=keep}
 if(!Q.auto)continue;
 const tr=truce();
 /* interceptação: invasores sobre o nosso lado e ninguém indo atrás deles */
 for(const e of intruders(t)){const busy=FL.some(f=>f.team===t&&(f.kind==='int'||f.kind==='cap')&&f.phase!=='home'&&f.m.some(m=>live(m)&&(m.tgt===e||hyp(m.x-e.x,m.y-e.y)<700)));if(busy||tr&&!CFG.TRUCE_GUNS)continue;
  launch(t,'int',e.x,e.y,{target:e});break}
 /* patrulha permanente sobre a frente */
 const caps=FL.filter(f=>f.team===t&&f.kind==='cap'&&f.phase!=='home').length;
 if(caps<2&&time>Q.next.cap){const y=lerp(GH*.2,GH*.8,Math.random()),x=FRONT+(t?1:-1)*rnd(-150,250);if(launch(t,'cap',x,y))Q.next.cap=time+rnd(...CFG.CAP_EVERY)}
 /* reconhecimento (com escolta se sobrar caça) */
 if(time>Q.next.rec){Q.next.rec=time+rnd(...CFG.REC_EVERY);const x=FRONT+(t?-1:1)*rnd(350,700),y=lerp(GH*.25,GH*.75,Math.random());const f=launch(t,'rec',x,y);if(f&&ready(t,['f'],'f').length>=4)launchEscort(t,f,2)}
 if(tr)continue;
 /* ataque ao solo e bombardeio */
 if(time>Q.next.atk){Q.next.atk=time+rnd(...CFG.ATK_EVERY);const g=groundTarget(t,0);if(g)launch(t,'atk',g.x,g.y)}
 if(time>Q.next.bmb){Q.next.bmb=time+rnd(...CFG.BMB_EVERY);const g=groundTarget(t,1);if(g){const f=launch(t,'bmb',g.x,g.y);if(f&&ready(t,['f'],'f').length>=3)launchEscort(t,f,3)}}}}
function doOrder(team,kind,x,y,o={}){if(kind==='esc'){const of=FL.find(f=>f.team===team&&(f.kind==='bmb'||f.kind==='rec')&&f.phase!=='home'&&!f.escort);return of?launchEscort(team,of,o.n||3):null}
 if(kind==='int'){let best=null,bd=1e9;for(const e of enemiesOf(team)){const d=hyp(e.x-x,e.y-y);if(d<bd){bd=d;best=e}}return launch(team,'int',x,y,best&&bd<700?{...o,target:best}:o)}
 return launch(team,kind,x,y,o)}

/* ======================================================================================
   LAÇO
   ====================================================================================== */
function flightTick(dt){for(const f of FL){const alive=f.m.filter(live);if(!alive.length){f.done=true;continue}
 const L=f.lead();
 if(f.phase==='assemble'){const up=alive.filter(m=>m.st==='air');if(up.length===alive.filter(m=>m.st!=='park').length&&L&&L.h>Math.min(260,f.alt*.4)||time-(f.tUp||f.t0)>48||time-f.t0>190)f.phase='out'}
 else if(f.phase==='out'&&L){const t=f.target&&live(f.target)?f.target:null,X=t?t.x:f.area.x,Y=t?t.y:f.area.y;if(f.escortOf){const E=f.escortOf;if(E.phase==='work'||E.phase==='home'||E.done)f.phase='work'}
  else if(hyp(L.x-X,L.y-Y)<(f.kind==='bmb'?650:450)){f.phase='work';f.until=time+(f.kind==='cap'?f.area.dur||70:f.kind==='int'?40:999)}}
 else if(f.phase==='work'){if(time>f.until&&f.kind!=='bmb'&&f.kind!=='rec'&&f.kind!=='atk')f.phase='home';if(f.escortOf&&(f.escortOf.done||f.escortOf.phase==='home'&&!f.escortOf.lead()))f.phase='home';
  if(f.kind==='int'&&f.target&&(f.target.dead||f.target.done)&&!alive.some(m=>m.tgt))f.phase='home'}
 if(alive.every(m=>m.st==='park'))f.done=true;
 /* sozinho e sem nada a fazer: volta */
 if(f.phase!=='start'&&f.phase!=='home'&&alive.every(m=>m.st==='air'&&wantDisengage(m)))f.phase='home'}
 FL=FL.filter(f=>!f.done)}
function frontTick(){/* frente = meio entre o 85º percentil x dos EUA e o 15º dos alemães */const a=[],b=[];for(const u of units){if(u.hp<=0||u.type==='tank')continue;(u.team?b:a).push(u.x)}
 if(a.length>4&&b.length>4){a.sort((x,y)=>x-y);b.sort((x,y)=>x-y);FRONT=clamp((a[Math.floor(a.length*.85)]+b[Math.floor(b.length*.15)])/2,W*.25,W*.75)}}
let frontT=0,replT=0;
function replace(dt){replT-=dt;if(replT>0)return;replT=3;
 for(let t=0;t<2;t++){for(const s of AF[t].slots){if(s.ac&&live(s.ac))continue;if(s.lostAt==null)s.lostAt=time;if(time-s.lostAt>CFG.REPLACE&&(!S.authorizeReplacement||S.authorizeReplacement(t,s))){const a=newAircraft(t,s.tk,s.sq,s);s.ac=a;s.lostAt=null;slotPose(a);a.ready=time+rnd(5,15);a.seats.forEach((o,k)=>placeAt(o,spotFor(a,k+1)));note(t,`${a.T.name} novo entregue ao ${s.sq}.`,'repl',20)}}
  const alivePilots=PILOTS[t].filter(p=>p.alive).length,need=AF[t].slots.length;if(alivePilots<need){PILOTS[t].lastNew=PILOTS[t].lastNew||time;if(time-PILOTS[t].lastNew>CFG.PILOT_REPLACE&&(!S.authorizePilot||S.authorizePilot(t))){newPilot(t,rnd(.2,.45));PILOTS[t].lastNew=time}}}
 for(let t=0;t<2;t++)for(const p of PILOTS[t])if(p.assigned&&!AC.some(a=>a.pilot===p&&live(a)))p.assigned=false}
function crewTick(dt){for(const t of PILOTS)for(const p of t)if(p.alive)pTick(p,dt);for(const a of AC)if(live(a))for(const o of a.seats)pTick(o,dt)}
function step(dt){
 frontT-=dt;if(frontT<=0){frontT=3;frontTick()}
 collectForeign(dt);hqTick(dt);flightTick(dt);replace(dt);
 crewTick(dt);
 for(const a of AC){if(!live(a))continue;
  if(!a.air){ground(a,dt);engine(a,dt);continue}
  engine(a,dt);
  if(a.leak&&time>a.leak){a.power=Math.max(0,a.power-dt*.2);a.smoke=1;if(a.power<=0&&a.mode!=='glide'){a.mode='glide';note(a.team,`${a.pilot?a.pilot.name:a.T.name}: motor fundiu, planando.`,'seize',10)}}
  if(a.fuel<=0&&a.mode!=='glide'){a.power=0;a.mode='glide'}
  if(time>=a.think)try{spot(a,Math.max(dt,.25));decide(a)}catch(e){fail(e)}
  steer(a,dt);
  const n=dt>.022?2:1;for(let i=0;i<n&&live(a)&&a.air;i++)fly(a,dt/n);
  if(!live(a)||!a.air)continue;
  if(a.h<=0){if(a.mode==='final'||a.mode==='glide'&&a.h>-5&&len3(a.V)<a.T.vst*1.7&&-a.V[2]<45){if(a.mode==='final')touchdown(a);else forced(a)}else down(a,a.lastHitBy,'chão',a.power<=0?'glide':'dive');continue}
  if(a.fire)a.smoke=1;
  shootGuns(a,dt);gunner(a,dt);poseOf(a)}
 stepBullets(dt);groundFire(dt);
 for(const p of ARCH)p.t+=dt;ARCH=ARCH.filter(p=>p.t<p.max);
 AC=AC.filter(a=>!a.gone||time-(a.goneT||(a.goneT=time))<.5)}
/* avisos (toasts) com cadência por chave */
const said={};
function note(team,msg,key,gap,always){try{if(typeof toast!=='function'||typeof playerTeam==='undefined')return;if(!always&&team!==playerTeam&&!/inimigo/.test(msg))return;const k=key||msg;if(gap&&time-(said[k]??-99)<gap)return;said[k]=time;S.log.push({t:+time.toFixed(1),msg});toast(msg)}catch{}}
const nearCam=(a,r)=>typeof cam!=='undefined'&&hyp(a.x-cam.x,a.y-cam.y)<r;

/* ======================================================================================
   PARTIDA, LIGAÇÕES
   ====================================================================================== */
function reset(){AC=[];AB=[];FL=[];ARCH=[];FOREIGN.length=0;ORD=[[],[]];PILOTS=[[],[]];seq=0;flSeq=0;FRONT=W/2;frontT=0;replT=0;
 for(const k of Object.keys(S.stats))if(typeof S.stats[k]==='number')S.stats[k]=0;S.stats.sorties=[0,0];S.stats.kills=[0,0];S.stats.losses=[0,0];S.stats.missions={};S.log=[];
 for(let t=0;t<2;t++){AF[t]=makeAirfield(t);HQ[t]=hqInit(t);
  /* pilotos: 2 ases, alguns veteranos, o resto novato/médio */
  const n=AF[t].slots.length;for(let i=0;i<n+3;i++)newPilot(t,i<2?rnd(.82,.95):i<6?rnd(.6,.8):null);
  for(const s of AF[t].slots){const a=newAircraft(t,s.tk,s.sq,s);s.ac=a;slotPose(a);const p=PILOTS[t].find(p=>!p.assigned);if(p){a.pilot=p;p.assigned=true;placeAt(p,spotFor(a,0))}a.seats.forEach((o,k)=>placeAt(o,spotFor(a,k+1)))}}}
wrap('setup',(orig,...a)=>{const r=orig(...a);try{reset()}catch(e){fail(e)}return r});
wrap('update',(orig,dt)=>{const r=orig(dt);if(!S.on||!(dt>0)||typeof started==='undefined'||!started||ended)return r;
 const t0=performance.now();try{if(!AF[0])reset();step(Math.min(dt,.05))}catch(e){fail(e)}S.ms=(S.ms||0)*.95+(performance.now()-t0)*.05;return r});

/* ======================================================================================
   API
   ====================================================================================== */
S.planes=()=>AC;                       // para o anim-air (fonte 'd') e o airwar-view
S.available=(team,kind)=>{
 if(!S.on||nAir(team)>=CFG.MAXAIR)return false;
 if(['cap','int','esc'].includes(kind))return ready(team,['f'],'f').length+ready(team,['f'],'a').length>=(kind==='cap'?2:1)&&
  (kind!=='esc'||FL.some(f=>f.team===team&&!f.done&&['bmb','rec'].includes(f.kind)&&f.phase!=='home'&&!f.escort));
 if(kind==='atk')return ready(team,null,'a').length>0;
 if(kind==='rec')return ready(team,null,'r').some(a=>a.T.recon);
 if(kind==='bmb')return ready(team,null,'b').length>0||ready(team,null,'r').some(a=>a.T.bombs);
 return false;
};
S.bullets=()=>AB;S.hitFx=()=>{const r=HFX;HFX=[];return r};S.archie=()=>ARCH;S.flights=()=>FL;S.airfields=()=>AF;S.pilots=()=>PILOTS;S.front=()=>FRONT;S.theatre=TH;S.types=TYPES;S.names=MNAME;
S.hq=t=>HQ[t];S.poseOf=poseOf;S.foreign=()=>FOREIGN;
S.people=()=>{const r=[];for(const t of PILOTS)for(const p of t)if(p.alive)r.push(p);for(const a of AC)if(live(a))for(const o of a.seats)r.push(o);return r};   // pilotos e observadores (o desenho pula quem está sentado)
S.seated=(a,i)=>{const p=i===(a.T.ps||0)?a.pilot:a.seats[i<(a.T.ps||0)?i:i-1];return !!p&&(a.air&&a.st==='air'||p.act==='seat'&&p.plane===a||p.act==='climb'&&p.plane===a)};
S.order=(team,kind,x,y)=>{if(!MNAME[kind])return false;ORD[team].push({kind,x,y,t:typeof time==='number'?time:0});if(HQ[team])HQ[team].t=0;return true};
S.dispatch=(team,kind,x,y,o={})=>S.on&&MNAME[kind]&&Number.isFinite(x)&&Number.isFinite(y)?doOrder(team,kind,x,y,o):null;
S.completeService=(a,seconds)=>{if(!a.serviceWaiting||a.dead||a.gone)return false;finishService(a);a.ready=time+Math.max(0,seconds);return true};
S.setAuto=(team,on)=>{if(HQ[team])HQ[team].auto=!!on};
S.state=()=>{const air=AC.filter(airborne),st=S.stats;return{on:S.on,version:S.version,ms:+(S.ms||0).toFixed(3),airborne:[0,1].map(t=>air.filter(a=>a.team===t).length),
 parked:[0,1].map(t=>AC.filter(a=>a.team===t&&live(a)&&a.st==='park').length),flights:FL.map(f=>({id:f.id,team:f.team,kind:f.kind,phase:f.phase,n:f.m.filter(live).length})),
 bullets:AB.length,front:Math.round(FRONT),kills:st.kills.slice(),losses:st.losses.slice(),roundsPerKill:st.killsTotal?Math.round(st.rounds/st.killsTotal):null,
 hitRate:st.rounds?+(st.hits/st.rounds).toFixed(3):0,stats:JSON.parse(JSON.stringify(st))}};
/* testes: avião solto no ar, sem aeródromo */
S._spawn=(team,tk,x,y,h,hd,v,skill)=>{const a=newAircraft(team,tk,'teste',{x,y,role:'f'});a.eng='run';a.rpm=.85;a.pilot=newPilot(team,skill);a.pilot.busy=true;a.x=x;a.y=y;a.h=h;a.hd=hd;a.V=[Math.cos(hd)*v,Math.sin(hd)*v,0];a.U=[0,0,1];a.air=true;a.st='air';a.mode='form';a.engOn=true;return a};
S._internals={inFront,fly,steer,decide,spot,Ps,leadPoint,stepBullets,hit,down,step,reset,landing,ground,poseOf,TYPES,flightTick,launch,rwBusy,seatPt,boardPt,outPath,inPath,lineupPath,AC:()=>AC,setFront:x=>{FRONT=x},nrm,len3};
if(window.IronFront)window.IronFront.airwar=S;
})();
