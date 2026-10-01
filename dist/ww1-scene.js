'use strict';
(function(){
const WW=PX.WW1,K=WW.kit,{put,rot90,H,R,dot,line,ring,ell,mix}=K,A=WW.SPR,S=1917,PWD=1200;
const Lay=()=>WW.layout(),rail=y=>28+3.5*Math.sin(y/130);
const commNear=y=>WW.COMMY.some(c=>Math.abs(c-y)<11);
/* WW.CLEAN (ww1-layout.js): retaguarda mais legível e terra de ninguém quase intacta; on:false = cena densa antiga.
   lim(n) = quantos de um grupo decorativo ficam; pick(i) = mantém ~CLEAN.rear de uma sequência (determinístico) */
/* FORTS: CLEAN.forts — false = sem trincheiras, abrigos das linhas, ninhos, morteiros, sapas e baterias pintados (fase de preparação) */
const FORTS=()=>!WW.forts||WW.forts();
const CL=WW.CLEAN||{},RQ=CL.on?CL.rear:1,NM=CL.on&&CL.nml||null,lim=n=>CL.on?Math.max(1,Math.round(n*RQ)):n,pick=i=>!CL.on||Math.floor(i*RQ)!==Math.floor((i-1)*RQ);
/* Iron Front 0.6 — a cena: onde fica cada lugar do campo de batalha (lado Aliado; o Central é espelho).
   logística · artilharia · reserva · apoio · linha de frente · arame · terra de ninguém (A, B e C). */

/* corpos no chão: mesma arte do jogo, amortecida pela lama */
const MUTE=new WeakMap();
function muted(sp){let m=MUTE.get(sp.c);if(!m){const c=K.mk(sp.c.width,sp.c.height),x=K.g2(c);x.drawImage(sp.c,0,0);x.globalCompositeOperation='source-atop';x.fillStyle='rgba(26,21,14,.42)';x.fillRect(0,0,c.width,c.height);m={c,ax:sp.ax,ay:sp.ay,sh:[0,0],sa:0,key:'mute'+MUTE.size};MUTE.set(sp.c,m)}return m}

/* ---------- listas de posições reutilizadas pelo relevo e pela pintura ---------- */
let PLAN=null;
function plan(){if(PLAN)return PLAN;const P=Lay().P,dug=[],dugS=[];if(!FORTS())return PLAN={dug,dugS};   // abrigos só existem com as linhas
 for(let y=44;y<=770;y+=58)if(!commNear(y))dug.push({x:WW.xAt(P.reserve,y)-13,y});
 for(let y=70;y<=740;y+=96)if(!commNear(y)&&Math.abs(y-400)>30)dugS.push({x:WW.xAt(P.support,y)-11,y});
 return PLAN={dug,dugS}}

/* ---------- relevo extra: bonde de munição, posições de tiro, abrigos, pátios ---------- */
WW.groundExtra=function(G,h){const{rails,apron,pit}=h,{w,MT}=G,Lyt=Lay(),pl=plan();
 for(const team of[0,1]){const X=x=>team?w-x:x,mp=pts=>pts.map(([x,y])=>[X(x),y]);
  rails(G,mp([[124,30],[124,770]]),1.3);rails(G,mp([[99,154],[124,154]]),1.3);
  G.rect(team?w-104:38,78,66,62,MT.GRAVEL,(x,y)=>.3+.4*H(x,y,S+70),0);            // pátio do depósito
  G.rect(team?w-50:30,60,20,100,MT.GRAVEL,(x,y)=>.2+.4*H(x,y,S+71),0);            // plataforma e cascalho do cais
  apron(G,X(70),540,30,22,1.2);apron(G,X(72),632,34,30,1.1);apron(G,X(70),725,30,22,1.1);apron(G,X(66),420,34,24,.9);apron(G,X(250),325,22,26,1.4);apron(G,X(250),525,22,26,1.4);
  for(const g of Lyt.guns){const ri=g.k==='h'?14:11;pit(G,X(g.x),g.y,ri,6,.6,team,{deck:true,depth:2.3});rails(G,mp([[124,g.y],[g.x-ri-6,g.y]]),1.3);apron(G,X(g.x-8),g.y,38,30,1.3)}
  for(const m of Lyt.mortars)pit(G,X(m.x),m.y,6,4,.6,team,{depth:2.2});
  for(const n of Lyt.nests)pit(G,X(n.x+2),n.y,4,3,.55,team,{depth:2.4});
  if(FORTS())for(const y of Lyt.sapY){const s=Lyt.P.sap[Lyt.sapY.indexOf(y)],e=s[s.length-1];pit(G,X(e[0]+2),e[1],3,3,.55,team,{depth:2.4})}
  for(const d of pl.dug)G.bump(X(d.x-2),d.y,11,8,2.3,MT.MUD,.42);
  for(const d of pl.dugS)G.bump(X(d.x-2),d.y,9,6,1.9,MT.MUD,.42);
  if(FORTS())G.bump(X(Lyt.post.x-7),Lyt.post.y,13,10,2.6,MT.MUD,.4)}};

/* ---------- pintura ---------- */
WW.scene=function(c,G,out){const items=[],over=[],Lyt=Lay(),P=Lyt.P,pl=plan();
 const add=(sp,x,y,o={})=>items.push(Object.assign({sp,x:Math.round(x),y:Math.round(y)},o));
 const addC=(sp,cx,cy,o={})=>add(sp,cx+sp.ax-sp.c.width/2,cy+sp.ay-sp.c.height/2,o);
 const dec=(x,y,type,size,s)=>out.decor.push({x:x*2,y:y*2,type,size,s:s||((x*131+y*17)|0)});
 const amb=o=>out.ambient.push(o);

 for(const team of[0,1]){
  const X=x=>team?PWD-x:x,F=team?{flip:true}:{},AT=(sp,x,y,o={})=>addC(sp,X(x),y,Object.assign({},o,team&&o.dir?{flip:true}:{})),
  at=(sp,x,y,o={})=>add(sp,X(x),y,Object.assign({},o,team&&o.dir?{flip:true}:{}));
  /* ===== LOGÍSTICA ===== */
  // cais ferroviário, vagões em descarga e trem de socorro
  addC(A.platform(),X(44),112);
  for(const[k,y]of[[1,104],[2,146]].slice(0,lim(2)))addC(A.railWagon(k),X(rail(y)),y);
  addC(A.locomotive(),X(rail(262)),262);for(const[k,y]of[[0,306],[1,346],[2,386]].slice(0,CL.on?1:3))addC(A.railWagon(k),X(rail(y)),y);
  amb({t:'steam',x:X(rail(262)),y:240,team});
  addC(A.buffer(),X(rail(30)),18);addC(A.buffer(),X(rail(778)),786);
  // depósito de munição
  addC(A.depot(),X(72),98);addC(A.cratesBig(),X(56),129);addC(A.crates(3),X(84),129);addC(A.shells(6,3),X(70),136);addC(A.barrels(3),X(96),133);addC(A.sacks(),X(46),140);
  addC(A.sign('shell'),X(40),150);addC(A.narrowWagon ? rot90(A.narrowWagon()) : A.narrowWagon(),X(110),154);
  addC(A.shellDump(),X(58),68);addC(A.crates(2),X(92),70);addC(A.cratesBig(),X(44),82);
  // hospital de campanha
  for(const y of[224,262].slice(0,lim(2)))addC(A.tentL(true),X(66),y);
  addC(A.sign('cross'),X(42),208);
  for(const[v,y]of[[0,232],[1,244],[0,256],[2,268]].slice(0,lim(4)))addC(A.stretcher(v),X(95),y);
  for(const y of[244,254].slice(0,lim(2)))addC(A.cot(),X(49),y);
  for(const y of[292,310].slice(0,lim(2)))addC(A.ambulance(),X(84),y,{dir:1});addC(A.bell(),X(49),280);
  // pátio de viaturas
  for(const[x,y]of[[68,336],[66,354]].slice(0,lim(2)))addC(A.truck(),X(x),y,{dir:1});addC(A.fuel(),X(42),324);for(const y of[328,340].slice(0,lim(2)))addC(A.motorbike(),X(94),y,{dir:1});
  // quartel-general
  addC(A.hq(),X(66),420);add(A.flagpole(),X(102),446);amb({t:'flag',x:X(102),y:446-36,team,big:true});
  for(const[x,y]of[[50,460],[82,462]].slice(0,lim(2)))addC(A.car(),X(x),y,{dir:1});addC(A.sign('flag'),X(100),392);
  // acampamento: poço, latrina, varal, barracas
  for(const[sp,x,y]of[[A.well(),48,482],[A.latrine(),94,494],[A.bell(),44,500],[A.laundry(),68,502],[A.bell(),92,476]].slice(0,lim(5)))addC(sp,X(x),y);
  // cozinha e refeitório
  addC(A.kitchen(),X(54),540);amb({t:'smoke',x:X(54)+(team?-9:9),y:527,team});
  for(const y of[548,564].slice(0,lim(2)))addC(A.mess(),X(82),y);
  for(const[sp,x,y]of[[A.logs(),42,560],[A.sign('food'),40,532],[A.waterCart(),92,580],[A.sacks(),96,528]].slice(0,lim(4)))addC(sp,X(x),y);
  // cavalariça: cordas, cavalos, feno, carroças
  const rows=lim(2);addC(A.picket(3),X(66),602);if(rows>1)addC(A.picket(3),X(66),638);
  const coats=['bay','black','chest','gray','bay'];
  for(let i=0;i<4;i++){addC(A.horse(coats[(i+team)%4],false),X(42+i*15),610,{dir:1});if(rows>1)addC(A.horse(coats[(i+2+team)%4],i===2),X(44+i*15),646,{dir:1})}
  addC(A.trough(),X(96),620);
  for(const[sp,x,y,o]of[[A.haybales(3),92,650],[A.haystack(),52,676],[A.wagon(),50,664,{dir:1}],[A.sign('horse'),100,596],[A.haystack(),88,684],[A.cart(),80,664,{dir:1}],[A.wagon(),60,700,{dir:1}]].slice(0,lim(7)))addC(sp,X(x),y,o);
  // pátio dos engenheiros
  for(const[sp,x,y]of[[A.planks(),46,724],[A.wireRolls(),94,724],[A.tentS('olive'),62,762],[A.duckboards(),50,742],[A.logs(),72,722],[A.sacks(),74,742],[A.barrels(2),94,744]].slice(0,lim(7)))addC(sp,X(x),y);
  /* ===== ARTILHARIA ===== */
  Lyt.guns.forEach((g,i)=>{const big=g.k==='h';
   /* o canhão em si é desenhado ao vivo por battery-extra.js (tubo giratório e recuo) */
   AT(A.ammoBoxes(),g.x-(big?14:12),g.y+(big?17:14));AT(A.shells(4,2),g.x-26,g.y-14);AT(A.shellsLoose(),g.x-24,g.y+12);AT(A.crewHut(),g.x-6,g.y+32);
   if(i%2===0)AT(A.camoNet(big?54:48,big?40:36,i+team*7),g.x+2,g.y,{z:3});
   AT(rot90(A.narrowWagon()),g.x-34,g.y,{});
   amb({t:'gun',x:X(g.x+(big?22:16)),y:g.y,team,big});
  });
  Lyt.guns.forEach((g,i)=>{if(i%(CL.on?4:2))return;/* parelhas: menos com CLEAN */AT(A.horse(i%4?'black':'bay',false),g.x+40,g.y-4,{dir:1});AT(A.horse('chest',false),g.x+40,g.y+5,{dir:1});AT(A.cart(),g.x+58,g.y,{dir:1})});
  for(const[x,y]of[[206,150],[212,430],[204,690],[246,230],[242,770],[232,118]]){add(A.oak(8+((x+y)%3),(x+y)%4,'worn'),X(x),y);dec(X(x),y,'tree',20,x+y)}
  addC(A.shellDump(),X(240),36);addC(A.shellDump(),X(240),772);if(FORTS()){addC(A.sign('gun'),X(214),220);addC(A.sign('gun'),X(214),560)}if(!CL.on){addC(A.cratesBig(),X(258),50);addC(A.barrels(3),X(260),760)}
  addC(A.hedge(40),X(170),412);addC(A.hedge(36),X(176),196);addC(A.hedge(32),X(180),622);
  addC(A.shellDump(),X(136),166);addC(A.crates(3),X(138),198);addC(A.shells(6,3),X(150),178);
  addC(A.narrowWagon(),X(124),120);addC(A.narrowWagon(),X(124),400);addC(A.narrowWagon(),X(124),650);
  // pátio dos tanques
  for(const[sp,x,y]of[[A.sign('tank'),228,512],[A.fuel(),232,312],[A.tentS('canvas'),236,300],[A.tentS('olive'),234,560],[A.barrels(3),240,544]].slice(0,lim(5)))addC(sp,X(x),y);
  /* ===== RESERVA ===== */
  for(const d of pl.dug){AT(A.dugout(),d.x+3,d.y+2)}
  for(let i=0;i<pl.dug.length;i++){if(!pick(i))continue;const d=pl.dug[i],k=i%5;
   if(k===0)AT(A.bell(),d.x-20,d.y+4);else if(k===1){AT(A.campfire(),d.x-14,d.y+6);amb({t:'fire',x:X(d.x-14),y:d.y+5,team})}else if(k===2)AT(A.rifles(),d.x-12,d.y+6);else if(k===3)AT(A.tentS('olive'),d.x-18,d.y+3);else AT(A.barrels(2),d.x-14,d.y+4)}
  /* ===== APOIO ===== */
  for(const d of pl.dugS)AT(A.dugout(),d.x+2,d.y+2);
  AT(A.tentS('canvas'),Lyt.post.x-24,Lyt.post.y-12);if(FORTS())AT(A.dugout(),Lyt.post.x-4,Lyt.post.y+2);add(A.flagpole(),X(Lyt.post.x-14),Lyt.post.y+10);amb({t:'flag',x:X(Lyt.post.x-14),y:Lyt.post.y+10-36,team});AT(A.phonePole(),Lyt.post.x-22,Lyt.post.y+16);
  for(const m of Lyt.mortars){AT(A.mortar(),m.x+1,m.y+1);AT(A.ammoBoxes(),m.x-10,m.y+8)}
  if(FORTS())for(const[i,y]of[[0,186],[1,402],[2,610]])AT(A.maxim(),WW.xAt(P.support,y)+10,y+3,{dir:1});
  /* ===== LINHA DE FRENTE: ninhos de metralhadora, postos de escuta e detalhes das baías ===== */
  for(const n of Lyt.nests){AT(A.maxim(),n.x+4,n.y+1,{dir:1});AT(A.ammoBoxes(),n.x-2,n.y+8)}
  if(FORTS())Lyt.P.sap.forEach((s,i)=>{const e=s[s.length-1];AT(A.periscope(),e[0]+1,e[1]);AT(A.lewis(),e[0]+3,e[1]+2,{dir:1})});
  const ps=team?-1:1;
  if(FORTS())for(const kind of['front','support']){const pts=team?WW.mirror(P[kind]):P[kind];let n=0;
   for(const[x,y,dx,dy]of WW.sample(pts,kind==='front'?21:33)){n++;const hv=H(n,team*3+(kind==='front'?1:2),S+90);let nx=-dy,ny=dx;if(nx*ps<0){nx=-nx;ny=-ny}
    const hwid=kind==='front'?5:4.6,rx=x-nx*(hwid-2),ry=y-ny*(hwid-2),ex=x+nx*(hwid+2.4),ey=y+ny*(hwid+2.4);
    if(commNear(y))continue;
    if(hv<.13)add(A.ladder(9),rx,ry+4);else if(hv<.30)add(A.ammoBoxes(),rx+(team?2:-2),ry+2);else if(hv<.38)add(A.periscope(),ex,ey);else if(hv<.44)add(A.trenchSign(),rx,ry+3);else if(hv<.49)add(A.rifles(),rx,ry+3);else if(hv<.52&&kind==='front')add(A.brazier(),rx,ry+3)}}
  /* ===== ÁRVORES E VEGETAÇÃO DA RETAGUARDA ===== */
  for(let y=20;y<790;y+=34){if(WW.ROADY.some(r=>Math.abs(r-y)<13))continue;if(H(y,team,S+80)>.78)continue;const tone=y%3===0?'worn':'ok';add(A.poplar(y%4,tone),X(113+(H(y,1,3)%3-1)),y+10);dec(X(113),y+10,'tree',18,y+team)}
  for(let y=86,n=0;y<740;y+=27){if(H(y,team,S+81)>.8||!pick(n++))continue;add(A.apple(y%3),X(8+(y%2)*8),y+6);dec(X(10),y+6,'tree',14,y)}
  for(const[x,y]of[[20,404],[30,452],[102,432],[38,600],[104,560],[100,700],[18,560],[24,690]]){add(A.oak(9+((x+y)%4),(x*3+y)%5),X(x),y);dec(X(x),y,'tree',22,x+y)}
  for(const[x,y,l]of[[30,58,30],[90,58,28],[70,752,50],[24,752,24]])addC(A.hedge(l),X(x),y);
  for(const[x,y]of[[122,78],[122,690],[122,760],[150,44],[154,758]])add(A.shrub((x+y)%4),X(x),y);
 }

 /* ===== TERRA DE NINGUÉM ===== */
 const W2=1200,BX=(x)=>x,mid=W2/2;
 // marcos: A (fazenda em ruínas), B (vilarejo na ponte), C (igreja)
 /* árvore dos marcos: com CLEAN, carvalho vivo (pouco castigado) no lugar da árvore morta */
 const lmTree=(v,x,y)=>{if(NM&&NM.liveTrees){add(A.oak(8+v,v+1,'worn'),x,y);dec(x,y,'tree',18,x+y)}else add(A.deadTree(v),x,y)};
 add(A.ruinFarm(),446,178);add(A.ruinBarn(),512,234);add(A.well(),484,214);add(A.fence(3),440,216);add(A.wallSeg(18),430,190);add(A.rubble(1),418,212);lmTree(0,498,166);add(A.tombs(),470,236);
 dec(426,160,'ruin',20);dec(446,158,'ruin',20);dec(466,164,'ruin',20);dec(506,222,'ruin',20);dec(520,224,'ruin',20);
 add(A.ruinFarm(),662,362);add(A.ruinBarn(),652,458);add(A.wallSeg(22),516,352);add(A.rubble(2),536,440);add(A.rubble(3),628,392);lmTree(1,668,412);if(!NM||NM.carts)add(A.cartWreck(),500,436);add(A.well(),690,396);
 dec(640,344,'ruin',20);dec(662,340,'ruin',20);dec(684,344,'ruin',20);dec(640,438,'ruin',20);dec(660,440,'ruin',20);dec(520,346,'ruin',20);
 add(A.ruinChurch(),762,566);add(A.tombs(),700,626);add(A.tombs(),775,634);lmTree(2,700,570);add(A.wallSeg(20),726,640);add(A.rubble(0),790,596);
 dec(740,540,'ruin',22);dec(762,540,'ruin',22);dec(784,540,'ruin',22);dec(738,520,'ruin',22);dec(770,520,'ruin',22);
 // ponte(s)
 for(const yy of PX.ROADS){const bx=Math.round(PX.riverX(yy));items.push({sp:A.bridge(),x:bx,y:yy,z:-1,noShadow:true})}
 // árvores (mortas no visual denso; com CLEAN poucas, vivas ou pouco castigadas, e alguns tocos), cercas e restos de material
 const rnd=(a)=>H(a,7,S+95),cap=(k,d)=>NM?NM[k]:d;let nT=0,nS=0;
 for(let i=0;i<46;i++){const x=440+rnd(i)*320,y=30+H(i,2,S+95)*740,rv=PX.riverX(y),rh=PX.riverHW(y);if(Math.abs(x-rv)<rh+5)continue;if(G.Dmin[(y|0)*G.w+(x|0)]<14)continue;
  if(NM){if(i%3!==1&&nT<NM.trees){nT++;add(A.oak(8+(i%3),i%5,i%4?'worn':'ok'),x,y);dec(x,y,'tree',18,i)}else if(i%3===1&&nS<NM.stumps){nS++;add(A.stump(),x,y)}continue}
  if(i%3===0){add(A.deadTree(i%3),x,y);dec(x,y,'tree',14,i)}else if(i%3===1)add(A.stump(),x,y);else add(A.burntTree(),x,y)}
 for(let i=0,n=0;i<14&&n<cap('fences',14);i++){const y=40+rnd(i+200)*720,x=420+rnd(i+300)*360;if(Math.abs(x-PX.riverX(y))<PX.riverHW(y)+8)continue;if(G.Dmin[(y|0)*G.w+(x|0)]<14)continue;add(A.fence(3+(i%3)),x,y);n++}
 const junk=[A.helmet(0),A.helmet(1),A.rifleDown(),A.pack(),A.dud(),A.brokenCrate(),A.wheel()];
 for(let i=0,n=0;i<110&&n<cap('junk',110);i++){const y=30+rnd(i+400)*740,x=415+rnd(i+500)*370,rv=PX.riverX(y);if(Math.abs(x-rv)<PX.riverHW(y)+3)continue;if(G.Dmin[(y|0)*G.w+(x|0)]<12)continue;const sp=junk[Math.floor(H(i,8,S+96)*junk.length)],fl=H(i,9,S+96)>.5;add(sp,x,y,{flip:fl});n++}
 for(let i=0,n=0;i<34&&n<cap('corpses',34);i++){const y=30+rnd(i+600)*740,x=420+rnd(i+700)*360,rv=PX.riverX(y);if(Math.abs(x-rv)<PX.riverHW(y)+4)continue;if(G.Dmin[(y|0)*G.w+(x|0)]<12)continue;
  const team=x>mid?1:0,sp=muted(PX.corpseSprite(team,Math.floor(H(i,3,S+97)*8),Math.floor(H(i,4,S+97)*4)));add(sp,x,y,{noShadow:true,z:-2});n++}
 // carcaças: tanques queimados, avião abatido, carroças, cavalos (com CLEAN nada disso — nem o fogo/fumaça ligados a elas)
 for(const[team,d,x,y]of[[0,1,500,300],[1,9,690,470],[0,14,478,520],[1,5,712,140]].slice(0,cap('wrecks',4))){add(PX.wreckSprite(team,d),x,y);amb({t:'fire',x,y:y-2,team,big:true});dec(x,y,'ruin',22)}
 if(cap('plane',1)){add(A.planeCrash(),540,330);amb({t:'smoke',x:546,y:322,team:0})}
 for(const[x,y]of[[660,260],[520,640]].slice(0,cap('carts',2)))add(A.cartWreck(),x,y);
 for(const[x,y]of[[470,420],[700,340],[650,700]].slice(0,cap('horses',3)))add(A.horseDead(),x,y);
 if(cap('crates',1))add(A.cratesBig(),610,470);
 for(const[v,x,y]of[[4,430,640],[5,770,340]].slice(0,cap('rubble',2)))add(A.rubble(v),x,y);
 // juncos e vegetação às margens do rio
 for(let y=10;y<800;y+=18){const rv=PX.riverX(y),rh=PX.riverHW(y);if(H(y,1,S+98)<.5)add(A.reeds(),rv-rh-3+H(y,2,S)*3,y);if(H(y,3,S+98)<.45)add(A.reeds(),rv+rh+3-H(y,4,S)*3,y+4)}
 for(const[x,y]of[[616,110],[600,250],[548,460],[580,540],[640,700],[560,740]])add(A.willow(x%3),x,y);

 /* ---- desenho: camadas por profundidade ---- */
 items.sort((a,b)=>(a.z||0)-(b.z||0)||a.y-b.y);
 for(const it of items)put(c,it.sp,it.x,it.y,{flip:it.flip,noShadow:it.noShadow});
 /* cabos do telégrafo */
 for(const team of[0,1]){const X=x=>team?PWD-x:x;const poles=[];for(let y=30;y<780;y+=62)poles.push(y);
  for(const y of poles){put(c,A.phonePole(),X(99),y+20)}
  for(let i=1;i<poles.length;i++){const a=poles[i-1]+20-18,b=poles[i]+20-18;for(const dx of[-1,1]){let lx=X(99)+dx,ly=a;for(let t=1;t<=8;t++){const yy=a+(b-a)*t/8,sag=Math.sin(t/8*Math.PI)*2;K.pline(c,lx,ly,X(99)+dx,yy+sag,'rgba(24,20,14,.42)');lx=X(99)+dx;ly=yy+sag}}}}
 out.items=items.length};
})();
