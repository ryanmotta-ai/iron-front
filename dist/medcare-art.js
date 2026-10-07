'use strict';
/* Iron Front 1.11 — arte do refino médico (medcare-art.js). Carrega DEPOIS de anim-infantry.js e ANTES de medcare.js.
   Só gera sprites (cache) — não toca em estado do jogo. Tudo em pixels inteiros, luz do canto superior esquerdo, contorno seletivo
   (PX.outlined), as mesmas grades de cabeça/tronco/pernas e as mesmas paletas por nação do art.js, para o soldado de cada cena ser
   o MESMO soldado que o jogador viu cair (capacete, uniforme, braçadeira, atadura).
   O que oferece (window.PXMCA):
   - fig(team,view,o) .......... figura de pé/ajoelhada/sentada (vista F frente, B costas, S perfil p/ a direita; flip p/ a esquerda) montada
                                 por peças: cabeça (capacete / descoberta, rosto: calmo, gritando, dor, olhos fechados), tronco com ou sem
                                 braços, pernas por estado, braços como polilinhas de 1 px (ombro → mão), objeto na mão (fuzil, cantil...)
   - lying(team,o,dir16) ....... corpo deitado de costas, visto de cima, cabeça à esquerda antes de girar (RotSprite, 16 direções, cache);
                                 os braços/joelhos que se mexem são desenhados por cima (armUp, kneeUp) em coordenadas de tela
   - sheet(team) ............... folha de contato de todos os quadros (para revisar a arte ampliada)
   ?medcare=0 desliga junto com medcare.js. */
(function(){
if(!window.PX||!PX.fromGrid||!PX.outlined||!PX.rotSprite||!PX.TEAM)return;
const {TAU,mk,g2,fromGrid,outlined,flipX,rotSprite,TEAM,mix}=PX;
const A=window.PXMCA={version:'1.11',errors:0,built:0};
const hyp=Math.hypot,clamp=(v,a,b)=>v<a?a:v>b?b:v;
const CACHE=new Map(),cached=(k,f)=>{let v=CACHE.get(k);if(!v){v=f();CACHE.set(k,v);A.built++}return v};
A.cache=CACHE;

/* ======================================================================================
   PALETA (a do art.js + peças do socorro: atadura, sangue, couro, lona)
   ====================================================================================== */
function pal(t){const T=TEAM[t];return Object.assign({},T,{T:T.t,
 w:'#f1eee2',W:'#c4c0b0',x:'#b8302a',X:'#7d1f1c',r:'#d8524a',          // atadura branca / sombra, cruz e sangue vivo / seco, vermelho claro
 n:'#4a3524',N:'#6b4a30',                                                // cabelo
 e:'#2b221b',m:'#5a2321',M:'#8a3a34',                                   // olho, boca aberta, língua
 g:'#5d645a',G:'#9aa190',                                                // metal do fuzil / brilho
 o:'#8a6238',O:'#5e4028',                                                // madeira
 c:'#bdb595',C:'#8b8468',                                                // lona
 L:'#6b5436',l:'#8a6c45',                                                // couro
 y:'#d9b548'})}                                                          // latão
const PAL=[pal(0),pal(1)];A.pal=t=>PAL[t];

/* ======================================================================================
   PEÇAS — cabeças (9×6), troncos (9×4) e pernas por estado. Cada grade é 9 colunas; o corpo em pé tem 6+4+4 linhas.
   ====================================================================================== */
const HELM={0:{F:['..hhhhh..','.hHHHhhh.','hHhhhhhhh','.vvvvvvv.','..SsssS..','...sss...'],B:['..hhhhh..','.hHHHhhh.','hHhhhhhhh','.vvvvvvv.','..SSSSS..','...SsS...'],S:['..hhhhh..','.hHHhhhh.','hHhhhhhhh','.vvvvvvv.','...SSsss.','....ssS..']},
 1:{F:['...hhh...','..hHHhh..','.hHhhhhh.','hhhhhhhhh','.hSsssSh.','...sss...'],B:['...hhh...','..hHHhh..','.hHhhhhh.','hhhhhhhhh','.hhhhhhh.','...SsS...'],S:['..hhhh...','.hHHhhh..','.hhhhhhh.','.hhhhhhhh','.hhSSsss.','..hhssS..']}};
const BARE={F:['..nnnnn..','.nNnnnnn.','.nsssssn.','..SsssS..','..sssss..','...sss...'],
 B:['..nnnnn..','.nNnnnnn.','.nnnnnnn.','..nnnnn..','..SnnnS..','...SsS...'],
 S:['..nnnn...','.nNnnnn..','.nnssss..','.nSsssss.','..SsssS..','...ssS...']};
/* bandagens de cabeça (por cima da cabeça descoberta): faixa na testa / cabeça toda enfaixada */
const HBAND={F:['.........','.........','.wwwwwww.','.WwxwwwW.','.........','.........'],
 B:['.........','.........','.wwwwwww.','.WwwwwwW.','.........','.........'],
 S:['.........','.........','.wwwwww..','.wwxwwww.','.........','.........']};
const HBAND2={F:['..wwwww..','.wwwwwww.','.wWwxwWw.','..SsssS..','..sssss..','...sss...'],B:['..wwwww..','.wwwwwww.','.wwwwwww.','..wwwww..','..SwwwS..','...SsS...'],S:['..wwww...','.wwwwww..','.wwxwww..','.wSsssss.','..SsssS..','...ssS...']};
/* troncos: com mangas (como no art.js) e sem mangas (o braço é desenhado à parte) */
const TORSO={F:['UuuuuuuuU','tuppuppuT','UuuuuuuuU','.pPpppPp.'],B:['UuuuuuuuU','tuPPPPPuT','UuPppPPuU','.pPpppPp.'],S:['..PuuuU..','.PPuutU..','.PPuuuU..','..pPppP..']};
const TORSO0={F:['.uuuuuuu.','.uppuppu.','.uuuuuuu.','.pPpppPp.'],B:['.uuuuuuu.','.uPPPPPu.','.uPppPPu.','.pPpppPp.'],S:['..PuuuU..','.PPuuuU..','.PPuuuU..','..pPppP..']};
const SHOULDER={F:[[0,0],[8,0]],B:[[0,0],[8,0]],S:[[4,1],[4,1]]};   // ombros (col,linha) do tronco: [esq. da tela, dir. da tela]

/* pernas: cada estado devolve linhas de 9 colunas. k/K = calça (perneira nos EUA), b = bota */
const LEG={
 F:{stand:['.kkK.Kkk.','.kkK.Kkk.','.bbb.bbb.','.........'],
    stepL:['.kkK.Kkk.','.kkK.Kkk.','.kkK.bbb.','.bbb.....'],              // perna esquerda à frente
    stepR:['.kkK.Kkk.','.kkK.Kkk.','.bbb.kkK.','.....bbb.'],
    kneel:['.kkKkKkk.','.kkK.Kkk.','.bbb.bbb.'],                           // ajoelhado (de frente, joelhos no chão: canela some)
    sit:['kkkKkKkkk','.kkK.Kkk.','.kkK.Kkk.','.bbb.bbb.'],                  // sentado na beira (coxas para a câmera)
    crouch:['.kkKkKkk.','kkK...Kkk','.bb...bb.'],
    spread:['.kkK.Kkk.','kkK...Kkk','kk.....kk','bb.....bb']},
 B:{stand:['.kkK.Kkk.','.kkK.Kkk.','.bbb.bbb.','.........'],
    stepL:['.kkK.Kkk.','.kkK.Kkk.','.bbb.kkK.','.....bbb.'],
    stepR:['.kkK.Kkk.','.kkK.Kkk.','.kkK.bbb.','.bbb.....'],
    kneel:['.kkKkKkk.','.kkK.Kkk.','.bbb.bbb.'],
    crouch:['.kkKkKkk.','kkK...Kkk','.bb...bb.']},
 S:{stand:['..kkK....','..kkK....','..bbb....','.........'],
    stepA:['..kkK....','.kkK.Kk..','.kk..Kk..','.bb..bb..'],
    stepB:['..kKk....','..KkK....','..kk.K...','..bb.bb..'],
    kneel:['..kkkkkk.','.bkK...k.','.......bb'],
    sit:['..kkkkkkk','..kK...kk','......bbb'],
    crouch:['..kkkkk..','.kkK..Kk.','.bb...bb.']}};
const LEGSTYLE=(t,rows,view)=>rows.map((r,i)=>i===1?(t===0?r.replace(/[kK]/g,m=>m==='k'?'K':'k'):r.replace(/[kK]/g,'b')):r);   // EUA: perneira enrolada; Alemanha: cano da bota

/* ======================================================================================
   COMPOSIÇÃO DE UMA FIGURA
   o = {head:{v:'F'|'B'|'S'|null (usa a vista do corpo), dx,dy, bare:bool, face:'calm'|'shout'|'pain'|'closed'|'eyes', band:0|1|2, flip:bool},
        torso:{dy,dx,arms:bool (com mangas)}, legs:'stand'|..., legDy,
        armL,armR: null (sem braço, se torso sem mangas) | {to:[dx,dy], bend:[dx,dy]?, hold:'rifle'|... }  (dx,dy relativos ao ombro)
        extras:(ctx,ox,oy)=>void   (desenha objetos por cima, coordenadas do canto da grade)}
   Saída: {c,ax,ay}  — ax,ay = pé (centro da linha da bota) no canvas já contornado
   ====================================================================================== */
const OX=5,OY=6,FW=19,FH=26;          // origem da grade no canvas de trabalho (sobra em volta para braços erguidos e maca)
function pline(x,x0,y0,x1,y1,col){x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);const dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let e=dx+dy;x.fillStyle=col;for(;;){x.fillRect(x0,y0,1,1);if(x0===x1&&y0===y1)break;const e2=2*e;if(e2>=dy){e+=dy;x0+=sx}if(e2<=dx){e+=dx;y0+=sy}}}
let x=null;     // contexto de trabalho atual (pline usa)
const px=(cx,col,a,b)=>{cx.fillStyle=col;cx.fillRect(a,b,1,1)};
/* braço: polilinha de pontos (relativos ao canto da grade) — manga clara na ida, escura na volta, mão em pele no fim */
function armLine(cx,t,pts,o={}){const P=PAL[t];x=cx;for(let i=0;i<pts.length-1;i++){const[a,b]=pts[i],[c,d]=pts[i+1];pline(cx,a,b,c,d,i===0?P.u:(o.dark?P.U:P.u))}
 const[hx,hy]=pts[pts.length-1];px(cx,o.glove||P.s,Math.round(hx),Math.round(hy));if(o.hand2)px(cx,P.s,Math.round(hx)+o.hand2[0],Math.round(hy)+o.hand2[1]);
 if(o.cuff){const[a,b]=pts[pts.length-2];px(cx,P.U,Math.round((a+hx)/2),Math.round((b+hy)/2))}}
function gridAt(cx,rows,p,ox,oy,mirror){const img=fromGrid(rows,p);cx.drawImage(mirror?flipX(img):img,ox,oy)}

function figure(team,view,o={}){
 const key=o.k?`fk${team}${view}${o.k}`:`fig${team}${view}${JSON.stringify(o)}`;
 return cached(key,()=>{const c=mk(FW,FH),cx=g2(c),P=PAL[team],H=o.head||{},T=o.torso||{},v=view;
  const legs=o.legs||'stand',lgSet=LEG[v==='B'?'B':v==='S'?'S':'F'],lg=lgSet[legs]||lgSet.stand,rows=LEGSTYLE(team,lg,v);
  const ldy=o.legDy||0;gridAt(cx,rows,P,OX,OY+10+ldy);
  const tr=(T.arms===false?TORSO0:TORSO)[v];
  if(T.lean&&v==='S')tr.forEach((r,i)=>gridAt(cx,[r],P,OX+(T.dx||0)+Math.round(T.lean*(3-i)/3),OY+6+(T.dy||0)+i));          // inclinado para a frente: as linhas de cima avançam mais que o cinto
  else gridAt(cx,tr,P,OX+(T.dx||0),OY+6+(T.dy||0));
  /* cabeça */
  const hv=H.v||v;let hrows;
  if(H.bare){hrows=BARE[hv].slice();if(H.band===1)hrows=hrows.map((r,i)=>HBAND[hv][i]==='.........'?r:overlay(r,HBAND[hv][i]));else if(H.band===2)hrows=HBAND2[hv].slice()}
  else hrows=HELM[team][hv].slice();
  if(H.crop)hrows=hrows.slice(0,H.crop);                                  // cabeça baixa vista de frente: só a cúpula do capacete aparece
  const hx=OX+(H.dx||0),hy=OY+(H.dy||0)+(T.dy||0);gridAt(cx,hrows,P,hx,hy,H.flip);
  face(cx,hv,H,hx,hy,P);
  /* braços */
  if(o.armL)armLine(cx,team,o.armL.pts.map(p=>[OX+p[0],OY+p[1]]),o.armL);
  if(o.armR)armLine(cx,team,o.armR.pts.map(p=>[OX+p[0],OY+p[1]]),o.armR);
  if(o.extras)o.extras(cx,OX,OY,P);
  const out=outlined(v==='S'&&o.flip?flipX(c):c,.6);
  return{c:out,ax:OX+5,ay:OY+13+ldy}})}
function overlay(a,b){let r='';for(let i=0;i<a.length;i++)r+=b[i]!=='.'?b[i]:a[i];return r}
/* rosto: olhos e boca por cima da cabeça descoberta (de frente e de perfil); o capacete esconde os olhos */
function face(cx,hv,H,hx,hy,P){if(!H.bare||hv==='B')return;const f=H.face||'calm';
 if(hv==='F'){const ey=hy+3,ex1=hx+3,ex2=hx+5;
  if(f==='closed'){px(cx,P.S,ex1,ey);px(cx,P.S,ex2,ey)}else if(f==='eyes'||f==='calm'||f==='shout'||f==='pain'){px(cx,P.e,ex1,ey);px(cx,P.e,ex2,ey)}
  if(f==='pain'){px(cx,P.S,ex1,ey-1);px(cx,P.S,ex2,ey-1);px(cx,P.m,hx+4,hy+4)}
  if(f==='shout'){px(cx,P.m,hx+3,hy+4);px(cx,P.m,hx+4,hy+4);px(cx,P.m,hx+5,hy+4);px(cx,P.M,hx+4,hy+5)}
  if(f==='calm'||f==='closed')px(cx,P.S,hx+4,hy+4)}
 else if(hv==='S'){const ex=hx+(H.flip?2:6),ey=hy+3;px(cx,f==='closed'?P.S:P.e,ex,ey);if(f==='shout'){px(cx,P.m,ex+(H.flip?-1:1),hy+4);px(cx,P.m,ex+(H.flip?-1:1),hy+5)}}}
A.figure=figure;A.parts={HELM,BARE,TORSO,TORSO0,LEG,SHOULDER,OX,OY,FW,FH};

/* ======================================================================================
   CORPO DEITADO DE COSTAS (visto de cima), cabeça à ESQUERDA antes de girar. Pintado por retângulos e linhas (poses = parâmetros);
   RotSprite gira para 16 direções (cache). Braço que acena, joelho que sobe e boca aberta são sobrepostos em coordenadas de TELA
   (em pixel art "para cima" na tela também é "para cima" no espaço: o braço erguido sai sempre na vertical, qualquer que seja o rumo do corpo).
   pose: 'rest' braços ao longo do corpo · 'clutch' mão na ferida, joelho dobrado · 'limp' desmaiado (cabeça de lado, braço solto)
   o.helmet: 'off' (capacete ao lado) | 'on' | 'none' · o.band: 0 nada | 1 peito | 2 cabeça | 3 perna/braço · o.face
   ====================================================================================== */
const LW=20,LH=17,LCX=10,LCY=8;                 // canvas de trabalho e centro de giro (a RotSprite gira em torno do centro do canvas)
function R(cx,a,b,w,h,col){cx.fillStyle=col;cx.fillRect(a,b,w,h)}
const lit=(c,k=.2)=>mix(c,'#ffffff',k),shd=(c,k=.25)=>mix(c,'#000000',k);
function lyingBase(team,pose,o){const c=mk(LW,LH),cx=g2(c),P=PAL[team],Yc=8;      // eixo do corpo na linha 8
 /* pernas (x 10→15): perna de cima (y 5..7) e de baixo (y 9..11) */
 const leg=(y,bend,top)=>{R(cx,10,y,3,3,P.k);R(cx,10,y,3,1,lit(P.k,.12));R(cx,10,y+2,3,1,P.K);
  if(!bend){R(cx,13,y,2,3,P.K);R(cx,13,y,2,1,P.k);R(cx,13,y+2,2,1,shd(P.b,.1));R(cx,15,y,2,3,P.b);R(cx,15,y,2,1,lit(P.b,.22));px(cx,shd(P.b,.35),16,y+2)}
  else{/* joelho dobrado: o pé volta para o lado, com a bota apontando para fora do corpo */const up=top?-1:1,ky=top?y-1:y+1;R(cx,13,ky,2,3,P.K);R(cx,13,ky,2,1,P.k);R(cx,13,top?y-4:y+3,3,3,P.K);R(cx,13,top?y-4:y+3,3,1,P.k);R(cx,12,top?y-6:y+5,4,2,P.b);R(cx,12,top?y-6:y+5,4,1,lit(P.b,.22))}};
 if(pose==='clutch'){leg(Yc+1,false,false);leg(Yc-3,true,true)}else if(pose==='limp'){leg(Yc+1,false,false);leg(Yc-3,false,true)}else{leg(Yc+1,false,false);leg(Yc-3,false,true)}
 /* tronco x 5..9, y 4..11 */
 R(cx,5,Yc-4,6,8,P.u);R(cx,5,Yc-4,6,1,lit(P.u,.2));R(cx,5,Yc+3,6,1,P.U);R(cx,10,Yc-4,1,8,P.U);
 R(cx,9,Yc-3,1,6,P.P);R(cx,8,Yc-3,1,6,P.p);                                                                          // cinto no quadril
 for(let i=0;i<4;i++){px(cx,P.p,6+i,Yc-3+i);px(cx,P.P,6+i,Yc+2-i)}                                                   // alças do equipamento cruzadas no peito
 px(cx,P.U,7,Yc);px(cx,P.U,7,Yc+1);px(cx,P.u,8,Yc);
 if(o.band===1){R(cx,6,Yc-1,3,3,P.w);R(cx,6,Yc-1,3,1,'#ffffff');R(cx,8,Yc-1,1,3,P.W);px(cx,P.x,7,Yc);px(cx,P.X,7,Yc+1)}
 if(o.band===3){R(cx,11,Yc+2,3,2,P.w);R(cx,11,Yc+2,3,1,'#ffffff');px(cx,P.x,12,Yc+3)}
 /* braços */
 const arm=(y,top,mode)=>{if(mode==='side'){R(cx,5,y,7,1,P.u);R(cx,5,y,7,1,P.u);R(cx,5,y+(top?1:-1),7,1,P.U);px(cx,P.s,12,y);px(cx,P.S,12,y+(top?1:-1));px(cx,P.s,13,y);if(top)px(cx,P.T,7,y)}
  else if(mode==='belly'){R(cx,5,y,4,1,P.u);R(cx,8,Yc-3,2,3,P.u);R(cx,8,Yc-3,2,1,lit(P.u,.15));R(cx,8,Yc-1,2,2,P.s);px(cx,P.x,7,Yc);px(cx,P.X,7,Yc+1)}
  else if(mode==='flung'){R(cx,0,y-1,7,1,P.u);R(cx,0,y,7,1,P.U);px(cx,P.s,-1+1,y-1);px(cx,P.s,0,y)}};
 arm(Yc-5,true,pose==='clutch'?'belly':pose==='limp'?'flung':'side');arm(Yc+4,false,'side');
 /* cabeça (cabelo à esquerda, rosto para cima) */
 const hx=0,hy=Yc-2;
 R(cx,hx,hy,5,5,P.s);R(cx,hx,hy,1,5,P.n);R(cx,hx+1,hy-1,2,7,P.n);R(cx,hx+3,hy-1,1,7,P.s);px(cx,P.N,hx+1,hy);px(cx,P.N,hx+1,hy+1);
 R(cx,hx+4,hy+1,1,3,P.S);R(cx,hx+5,hy+1,1,3,P.s);R(cx,hx+5,hy+3,1,1,P.S);
 px(cx,o.face==='closed'?P.S:P.e,hx+2,hy+1);px(cx,o.face==='closed'?P.S:P.e,hx+2,hy+3);
 if(o.face==='shout'){R(cx,hx+4,hy+2,1,2,P.m)}else if(o.face==='pain'){px(cx,P.m,hx+4,hy+2)}else px(cx,P.S,hx+4,hy+2);
 if(o.band===2){R(cx,hx,hy,3,5,P.w);R(cx,hx+1,hy-1,2,1,P.w);R(cx,hx+3,hy,1,5,P.W);px(cx,P.x,hx+1,hy+2);px(cx,P.X,hx+1,hy+3)}
 if(o.helmet==='on'){R(cx,hx,hy-1,4,7,P.h);R(cx,hx,hy-1,4,2,P.H);R(cx,hx+3,hy-1,1,7,P.v)}
 return c}
const LCACHE=new Map();
function lying(team,o={},d16=0){o=Object.assign({pose:'rest',helmet:'off',band:0,face:'calm'},o);
 const key=`ly${team}${o.pose}${o.helmet}${o.band}${o.face}${d16}`;
 return cached(key,()=>{const base=lyingBase(team,o.pose,o),ob=outlined(rotSprite(base,d16*TAU/16),.6);
  return{c:ob,ax:Math.floor(ob.width/2),ay:Math.floor(ob.height/2),d16}})}
/* ponto do corpo (coordenadas locais de lyingBase, relativas ao centro de giro) → deslocamento na tela depois de girar d16 */
function lyPt(d16,lx,ly){const a=d16*TAU/16,co=Math.cos(a),si=Math.sin(a),X=lx-LCX,Y=ly-LCY;return[Math.round(X*co-Y*si),Math.round(X*si+Y*co)]}
A.lying=lying;A.lyPt=lyPt;A.LY={LW,LH,LCX,LCY,Yc:8};

/* ---------- equipamento caído (capacete e fuzil ao lado do corpo), girado junto com o corpo ---------- */
function gearBase(team){const c=mk(LW,LH),cx=g2(c),P=PAL[team],Yc=8;
 /* fuzil deitado paralelo ao corpo, do lado de baixo: coronha de madeira, caixa, cano de aço */
 const y=Yc+6,wd=team?'#7a4a2c':'#8a6238',wdd=team?'#4f2f1c':'#5e4028';
 R(cx,3,y,5,2,wd);R(cx,3,y,5,1,lit(wd,.15));R(cx,3,y+1,5,1,wdd);R(cx,8,y,3,1,P.g);R(cx,8,y+1,3,1,shd(P.g,.35));px(cx,P.G,9,y);R(cx,11,y,7,1,P.G);R(cx,11,y+1,7,1,P.g);px(cx,shd(P.g,.5),17,y);px(cx,wd,10,y+1);
 /* capacete virado, ao lado da cabeça (do lado de cima) */
 const hx=1,hy=Yc-7;
 if(team===0){R(cx,hx,hy,6,3,P.h);R(cx,hx+1,hy-1,4,1,P.h);R(cx,hx,hy+2,6,1,shd(P.h,.3));R(cx,hx+1,hy,3,1,P.H);px(cx,P.H,hx+1,hy-1)}
 else{R(cx,hx,hy,5,3,P.h);R(cx,hx+1,hy-1,3,1,P.h);R(cx,hx,hy+2,6,1,shd(P.h,.3));R(cx,hx+1,hy,2,1,P.H);px(cx,P.h,hx+5,hy+1)}
 return c}
function lyingGear(team,d16){return cached(`lg${team}${d16}`,()=>{const ob=outlined(rotSprite(gearBase(team),d16*TAU/16),.6);return{c:ob,ax:Math.floor(ob.width/2),ay:Math.floor(ob.height/2),d16}})}
/* braço erguido (aceno / pedido de socorro) em coordenadas de tela, saindo do ombro: h = altura 0..3 do cotovelo, sw = balanço lateral -3..3 */
function armUp(team,h,sw,o={}){return cached(`au${team}${h}${sw}${o.glove||''}${o.thumb?1:0}`,()=>{const c=mk(15,17),cx=g2(c),P=PAL[team],ox=6,oy=15;
 const ex=Math.round(sw*.35),ey=-Math.max(1,h)-1,hx=sw,hy=-(h*2+2);
 for(const d of[0,1]){pline(cx,ox+d,oy,ox+ex+d,oy+ey,P.u);pline(cx,ox+ex+d,oy+ey,ox+hx+d,oy+hy,P.U)}px(cx,P.u,ox+ex,oy+ey);
 R(cx,ox+hx,oy+hy-1,2,2,o.glove||P.s);px(cx,P.S,ox+hx+1,oy+hy);if(o.thumb){px(cx,P.s,ox+hx+2,oy+hy-1);px(cx,P.s,ox+hx+2,oy+hy-2)}else{px(cx,P.s,ox+hx-1,oy+hy-2);px(cx,P.s,ox+hx+1,oy+hy-2);px(cx,P.s,ox+hx+2,oy+hy-1)}
 const out=outlined(c,.6);return{c:out,ax:ox+1,ay:oy+1}})}
A.lyingGear=lyingGear;A.armUp=armUp;

/* ---------- ferido leve sentado de frente, apertando a ferida; wave = null (braço caído) ou balanço -2..2 do braço erguido ---------- */
function sitting(team,o={}){const k=`sit${team}${o.wv|0}${o.stab?1:0}${o.wave==null?'n':o.wave}${o.face||'pain'}${o.slump?1:0}`;
 return figure(team,'F',{k,legs:'sit',torso:{arms:false,dy:o.slump?1:0},head:{dy:o.slump?1:0,dx:o.slump?(o.wv===1?-1:1):0},
  armR:{pts:[[7,7],[8,9],[5,9]],glove:PAL[team].s},
  armL:o.wave==null?{pts:[[1,7],[0,9],[1,11]]}:{pts:[[1,7],[-1,4],[o.wave-2,0]],hand2:[1,0]},
  extras:(cx,ox,oy,P)=>{const wv=o.wv|0,sl=o.slump?1:0;
   if(o.face==='shout'){px(cx,P.m,ox+4,oy+5+sl);px(cx,P.M,ox+4,oy+6+sl)}else{px(cx,P.S,ox+3,oy+4+sl);px(cx,P.S,ox+5,oy+4+sl)}
   const bx=wv===0?ox+3:wv===1?ox+5:ox+2,by=wv===0?oy+7+sl:wv===1?oy+3+sl:oy+11;
   if(o.stab){R(cx,bx,by,3,2,P.w);R(cx,bx,by,3,1,'#ffffff');px(cx,P.x,bx+1,by+1)}else{R(cx,bx,by,2,2,P.X);px(cx,P.x,bx,by)}}})}
A.sitting=sitting;

/* ---------- bolsa do médico (aberta no chão: ataduras, tesoura, cantil) ---------- */
function medBag(open){return cached('bag'+(open?1:0),()=>{const c=mk(11,7),cx=g2(c);
 R(cx,0,2,9,4,'#5d6240');R(cx,0,2,9,1,'#7d8458');R(cx,0,5,9,1,'#3f4430');R(cx,0,2,1,4,'#4a4f33');R(cx,3,3,3,3,'#f1eee2');R(cx,4,3,1,3,'#b8302a');R(cx,3,4,3,1,'#b8302a');
 if(open){R(cx,0,0,9,2,'#6e744c');R(cx,0,0,9,1,'#8a9164');R(cx,1,1,3,1,'#f1eee2');R(cx,5,1,2,1,'#c4c0b0');px(cx,'#9aa190',8,1);px(cx,'#9aa190',9,0)}
 return{c:outlined(c,.55),ax:6,ay:7}})}
/* atadura em volta do ferimento, desenhada por cima do corpo em coordenadas de tela: n = 0..1 (quanto já foi enrolado) */
function wrapBand(cx,x,y,n,vertical){const w=Math.max(1,Math.round(1+n*3));R(cx,x-1,y-1,vertical?w:3,vertical?3:w,'#f1eee2');R(cx,x-1,y-1,vertical?1:3,vertical?3:1,'#ffffff');if(w>2)px(cx,'#b8302a',x,y)}
A.medBag=medBag;A.wrapBand=wrapBand;

/* ======================================================================================
   HOSPITAL — paciente no catre (vertical, cabeça para cima), fuzil, rack de armas
   ====================================================================================== */
const BL=['#76705c','#8d8670','#5c5848','#45423a'];          // cobertor de lã: base, dobra clara, sombra, borda
/* paciente deitado no catre 7×15 (tela 11×19, catre centrado em (5,9)): cabeça no travesseiro, ombros de fora, cobertor do peito para baixo.
   o = {face:'calm'|'closed'|'pain'|'turnL'|'turnR'|'shout', band:0|1|2|3 (0 nada · 1 peito · 2 cabeça · 3 braço/perna), arm:'rest'|'chest'|'up'|'drink'|'head'|'out', breath:0|1, wv:0|1|2, blood:bool (mancha antes do curativo)} */
function cotPatient(team,o={}){const key=`cp${team}${o.face||'calm'}${o.band|0}${o.arm||'rest'}${o.breath|0}${o.blood?1:0}${o.wv|0}${o.sit?1:0}`;
 return cached(key,()=>{const c=mk(13,21),cx=g2(c),P=PAL[team],ox=3,oy=2;       // (ox,oy) = canto do catre
  const face=o.face||'calm',wv=o.wv|0,sk=P.s,sd=P.S;
  /* ombros e tronco (túnica) */
  R(cx,ox,oy+6,7,3,P.u);R(cx,ox,oy+6,7,1,lit(P.u,.18));R(cx,ox,oy+8,7,1,P.U);R(cx,ox-1,oy+6,1,3,P.U);R(cx,ox+7,oy+6,1,3,P.U);
  px(cx,P.p,ox+2,oy+7);px(cx,P.p,ox+4,oy+7);                                       // alças do equipamento
  /* cobertor: do peito para baixo, com dobra e pés fazendo volume */
  const by=oy+8+(o.breath?-0:0);
  R(cx,ox-1,by+1,9,12,BL[0]);R(cx,ox-1,by+1,9,1,BL[1]);R(cx,ox-1,by+12,9,1,BL[2]);R(cx,ox-1,by+1,1,12,BL[3]);R(cx,ox+7,by+1,1,12,BL[3]);
  for(let i=0;i<4;i++)R(cx,ox+(i%2?1:4),by+3+i*2,2,1,BL[1]);R(cx,ox-1,by+3,9,1,BL[1]);                         // dobra do cobertor + listras de lã
  R(cx,ox+1,by+11,2,2,BL[0]);R(cx,ox+4,by+11,2,2,BL[0]);px(cx,BL[1],ox+1,by+11);px(cx,BL[1],ox+4,by+11);       // pés sob o cobertor
  if(o.breath){R(cx,ox,oy+7,7,1,lit(P.u,.28));R(cx,ox-1,by+1,9,1,lit(BL[1],.15))}
  /* cabeça no travesseiro */
  const hx=ox+1,hy=oy+1;R(cx,hx,hy+1,5,5,sk);R(cx,hx+1,hy,3,7,sk);R(cx,hx,hy+1,5,2,P.n);R(cx,hx+1,hy,3,1,P.n);px(cx,P.N,hx+1,hy+1);px(cx,P.N,hx+3,hy);R(cx,hx,hy+3,1,2,P.S);R(cx,hx+4,hy+3,1,2,P.S);R(cx,hx+1,hy+6,3,1,sd);
  const ey=hy+3;
  if(face==='turnL'||face==='turnR'){const sg=face==='turnL'?-1:1;R(cx,hx+(sg>0?3:0),hy+2,2,3,P.n);px(cx,P.e,hx+(sg>0?2:3)+(sg>0?0:-0),ey)}
  else{px(cx,face==='closed'?sd:P.e,hx+1,ey);px(cx,face==='closed'?sd:P.e,hx+3,ey)}
  if(face==='pain'){px(cx,sd,hx+1,ey-1);px(cx,sd,hx+3,ey-1);px(cx,P.m,hx+2,hy+5)}else if(face==='shout'){R(cx,hx+1,hy+5,3,1,P.m);px(cx,P.M,hx+2,hy+6)}else if(face==='calm'||face==='closed'){px(cx,sd,hx+2,hy+5)}
  /* curativo do soldado: peito / cabeça / braço / perna */
  if(o.band===1){R(cx,ox+1,oy+6,5,3,P.w);R(cx,ox+1,oy+6,5,1,'#ffffff');R(cx,ox+1,oy+8,5,1,P.W);px(cx,P.x,ox+3,oy+7);px(cx,P.X,ox+4,oy+7)}
  else if(o.band===2){R(cx,hx,hy,5,3,P.w);R(cx,hx+1,hy-1,3,1,P.w);R(cx,hx,hy+2,5,1,P.W);px(cx,P.x,hx+2,hy+1);px(cx,P.X,hx+3,hy+1)}
  else if(o.band===3){R(cx,ox-1,oy+7,1,3,P.w);R(cx,ox+7,oy+7,1,0,P.w);R(cx,ox+1,by+8,5,2,P.w);R(cx,ox+1,by+8,5,1,'#ffffff');px(cx,P.x,ox+3,by+9)}
  else if(o.blood){const bx=wv===0?ox+3:wv===1?hx+2:ox+3,byy=wv===0?oy+7:wv===1?hy+1:by+9;R(cx,bx,byy,2,2,P.X);px(cx,P.x,bx,byy)}
  /* braços */
  const armc=(x0,y0,x1,y1)=>{pline(cx,x0,y0,x1,y1,P.u);px(cx,P.s,x1,y1)};
  switch(o.arm){
   case'chest':armc(ox-1,oy+7,ox+3,oy+9);armc(ox+7,oy+7,ox+4,oy+9);break;                    // mãos sobre o peito
   case'up':armc(ox+7,oy+7,ox+9,oy+2);px(cx,P.u,ox+8,oy+5);px(cx,P.s,ox+9,oy+1);break;      // braço erguido (pedindo / acenando)
   case'drink':armc(ox+7,oy+7,ox+6,oy+3);R(cx,ox+5,oy+3,2,2,'#7d858c');px(cx,'#aab1b6',ox+5,oy+3);break;   // cantil na boca
   case'head':armc(ox-1,oy+7,ox-1,oy+3);px(cx,P.s,ox,oy+3);break;                           // mão na testa
   case'out':armc(ox+7,oy+7,ox+9,oy+9);armc(ox-1,oy+7,ox-1,oy+10);break;
   default:armc(ox-1,oy+7,ox-1,oy+10);armc(ox+7,oy+7,ox+7,oy+10)}
  return{c:outlined(c,.55),ax:ox+3+1,ay:oy+7+1}})}                          // âncora no centro do catre (como o spr('med:cot'): ax 3, ay 7)

/* fuzil Springfield / Gewehr 98 por partes (copiado do anim-infantry: lá é privado). a = ângulo da mira; pr = fase do ferrolho (-1 normal, 0..4 abrindo/carregando) */
const GW={wood:'#8a6238',woodD:'#5e4028',steel:'#5d645a',steelH:'#9aa190',steelD:'#33372f',brass:'#d9b548',gap:'#1a1c17',walnut:'#7a4a2c',walnutD:'#4f2f1c'};
function rifleAt(x,cx,cy,a,de,pr,skin){const co=Math.cos(a),si=Math.sin(a),W=GW;
 const Pp=(f,s,d,col)=>{x.fillStyle=col;x.fillRect(Math.round(cx+co*f-si*s),Math.round(cy+si*f+co*s+d),1,1)},
 Rr=(f0,f1,s0,s1,d,col)=>{for(let f=f0;f<=f1+.01;f+=.5)for(let s=s0;s<=s1+.01;s+=.5)Pp(f,s,d,col)};
 const wd=de?W.walnut:W.wood,wdd=de?W.walnutD:W.woodD,open=pr>=1&&pr<=3?1:pr===4?.5:0,up=pr>=0&&pr<=4,bf=-open*3;
 Rr(-5,-1.5,-.5,.5,0,wd);Rr(-5,-1.5,.5,.5,0,wdd);Pp(-5.5,0,0,W.steelD);if(de){Pp(-2,0,1,wd);Pp(-6,0,0,W.steelD)}
 Rr(-1,3,-.5,.5,0,W.steel);if(open)Rr(0,2.5,-.5,.5,0,W.gap);Rr(bf-.5,bf+2,0,0,up?-1:0,W.steelH);
 Pp(bf+.5,1.5,up?-1:0,W.steelH);Pp(bf+.5,2.5,up?-1:0,W.steelH);if(up){Pp(bf+.5,3.5,-2,W.steelH);Pp(bf+.5,3.5,-1,W.steelD)}
 Rr(3,de?10:8,-.5,.5,0,wd);Rr(3,de?10:8,.5,.5,0,wdd);if(de){Pp(6,0,0,W.steelH);Pp(9,0,0,W.steelH);Pp(10.5,0,0,W.steelD);Rr(11,12,0,0,0,W.steel)}else{Pp(8.5,0,0,W.steelD);Rr(9,12,0,0,0,W.steel)}Pp(12,0,0,W.steelD);
 Pp(1,0,1,W.steelD);Pp(2,0,1,W.steelD);
 if(skin){Pp(-1.5,0,0,skin);Pp(5.5,0,1,skin)}}
A.rifleAt=rifleAt;
/* rack de armas (6×13): estrutura de madeira com até 4 fuzis encostados; n = quantos; hole = índice que acaba de ser pego (some) */
function rack(n,team){return cached(`rk${n}${team}`,()=>{const c=mk(15,16),cx=g2(c);
 R(cx,1,14,13,1,'#3a2c1e');R(cx,2,2,1,13,'#6b4a30');R(cx,12,2,1,13,'#6b4a30');R(cx,2,5,11,1,'#8a6238');R(cx,2,10,11,1,'#8a6238');px(cx,'#a37a48',2,5);px(cx,'#a37a48',12,5);
 for(let i=0;i<Math.min(4,n);i++){const x0=3+i*2;                                   // fuzis encostados (cano para cima, coronha no chão)
  for(let y=1;y<14;y++){cx.fillStyle=y<5?'#5d645a':y<10?'#8a6238':'#6b4a30';cx.fillRect(x0,y,1,1)}px(cx,'#9aa190',x0,1);px(cx,'#33372f',x0+1,5)}
 return{c:outlined(c,.55),ax:8,ay:16}})}
A.cotPatient=cotPatient;A.rack=rack;A.BL=BL;
/* ======================================================================================
   FOLHA DE CONTATO — desenha uma lista de [rótulo, sprite] ampliada (inteiro) sobre um canvas e devolve o canvas
   ====================================================================================== */
A.sheet=function(items,scale=5,cols=8,bg='#4a5236'){const cw=Math.max(...items.map(i=>i[1].c.width))+6,ch=Math.max(...items.map(i=>i[1].c.height))+10,rows=Math.ceil(items.length/cols),
  cv=mk(cw*cols*scale,ch*rows*scale),g=g2(cv);g.imageSmoothingEnabled=false;g.fillStyle=bg;g.fillRect(0,0,cv.width,cv.height);
  items.forEach(([lab,sp],i)=>{const X=(i%cols)*cw,Y=((i/cols)|0)*ch;g.save();g.scale(scale,scale);g.drawImage(sp.c,X+3,Y+4);g.restore();
   g.fillStyle='#fff';g.font='9px monospace';g.fillText(lab,X*scale+2,(Y+ch)*scale-3)});return cv};
})();
