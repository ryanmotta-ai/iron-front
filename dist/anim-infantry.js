'use strict';
/* Iron Front — refino das animações da infantaria (anim-infantry.js). Carrega DEPOIS de todas as camadas que envolvem PHYS.draw
   (physics, sappers, assault, medics, art-medics, casualty, soldier-life, classes, shelter, heavyfx, anim-air): este é o invólucro
   mais externo. Só visual: não mexe em posição, tiro, dano, recarga nem IA.
   Técnica: os quadros novos são COMPOSTOS a partir das mesmas grades de art.js (cabeça/tronco/pernas por nação, armas desenhadas por
   partes) e cacheados por (pose, subquadro, direção 16, nação, tipo, granadas). Para os estados que este arquivo melhora, o sprite
   novo SUBSTITUI o sprite base e a cadeia interna é chamada com ele — máscara de gás (assault), recortes de trincheira (soldier-life),
   insígnias de classe (classes), abrigo, socorro etc. continuam valendo sobre o quadro novo. Geometria idêntica à do art.js
   (28×28 + contorno = 30×30, âncora 15,16), então o clarão do pixel.js, o recorte d'água e o K.pose seguem certos.
   Poses: marcha em 8 quadros (balanço de cabeça/tronco, fuzil que acompanha o passo, ombros que balançam de frente e de costas) ·
   passo curto de quem arranca ou está parando (P_AMBLE, inclinado para a frente quando acelera) · corrida em 8 (passada longa, tronco inclinado) para ondas de assalto,
   retirada e quem anda rápido · fuzil no ombro voltado ao alvo, coice (ombro recua, boca sobe) e manejo do ferrolho entre tiros
   (Springfield / Gewehr 98: mão ao ferrolho, sobe-atrás-frente-baixa, estojo ejetado) · ajoelhado atirando de abrigo · recarga com
   lâmina (fases idênticas às do pixel.js, para o estojo e a lâmina saírem no quadro certo) · arremesso de granada em 6 tempos
   (puxa o pino, braço atrás, armado por cima, solta exatamente quando o jogo lança, acompanha, recupera) · respiração e olhadas
   para os lados de quem está parado · giro sem salto (o ângulo exibido sai e chega com suavidade, passando pelas direções intermediárias; no tiro trava no real) ·
   passada própria de cada soldado (u.gt.sl do gait.js) e fase do passo travada na distância (u._wp), com passo mais curto a baixa velocidade ·
   alívio de 0,5 s ao parar (o fuzil desce) ·
   rastejar de quem está fixado (assault.js) com cotovelos e joelhos alternados · queda de morte em 4 tempos (tranco na direção da
   bala, joelhos cedem, tomba) que termina EXATAMENTE no sprite de cadáver do art.js, na posição do deslize do pixel.js.
   ?animinf=0 desliga · PXINF.state() · PXINF.sheet() desenha a folha de contatos de todos os quadros. */
(function(){
if(!window.PX||!PX.fromGrid||!PX.outlined)return;
const {TAU,mk,g2,fromGrid,outlined,flipX,rotSprite,TEAM,corpseSprite,dir8,dir16}=PX;
const S=window.PXINF={on:!/[?&]animinf=0/.test(location.search),version:'1.0',
 stats:{errors:0,built:0,drawn:0,own:0,deferred:0,falls:0,crawl:0,casings:0,ms:0,frames:0}};
let errs=0;
function fail(e){S.stats.errors++;if(++errs<=3)console.error('anim-infantry.js:',e);if(errs>=12&&S.on){S.on=false;restoreAll();console.error('anim-infantry.js desligado após erros repetidos')}}
const clamp=(v,a,b)=>v<a?a:v>b?b:v,hyp=Math.hypot;

/* ======================================================================================
   GRADES (cópia fiel do art.js: as funções lá são privadas)
   ====================================================================================== */
const TORSO_F=['UuuuuuuuU','tuppuppuT','UuuuuuuuU','.pPpppPp.'],TORSO_B=['UuuuuuuuU','tuPPPPPuT','UuPppPPuU','.pPpppPp.'],TORSO_S=['..PuuuU..','.PPuutU..','.PPuuuU..','..pPppP..'];
const HEAD={0:{front:['..hhhhh..','.hHHHhhh.','hHhhhhhhh','.vvvvvvv.','..SsssS..','...sss...'],back:['..hhhhh..','.hHHHhhh.','hHhhhhhhh','.vvvvvvv.','..SSSSS..','...SsS...'],side:['..hhhhh..','.hHHhhhh.','hHhhhhhhh','.vvvvvvv.','...SSsss.','....ssS..']},
1:{front:['...hhh...','..hHHhh..','.hHhhhhh.','hhhhhhhhh','.hSsssSh.','...sss...'],back:['...hhh...','..hHHhh..','.hHhhhhh.','hhhhhhhhh','.hhhhhhh.','...SsS...'],side:['..hhhh...','.hHHhhh..','.hhhhhhh.','.hhhhhhhh','.hhSSsss.','..hhssS..']}};
const TORSO={front:TORSO_F,back:TORSO_B,side:TORSO_S};
const GW={wood:'#8a6238',woodD:'#5e4028',steel:'#5d645a',steelH:'#9aa190',steelD:'#33372f',brass:'#d9b548',brassH:'#f2d878',gap:'#1a1c17',walnut:'#7a4a2c',walnutD:'#4f2f1c'};
const MODEL=[{rifle:'rifle'},{rifle:'g98'}];
const RL_TILT=[.5,.6,.6,.6,.5,.2];
const pal=t=>{const p=Object.assign({},TEAM[t]);p.T=p.t;return p};
const PAL=[pal(0),pal(1)];

/* Springfield / Gewehr 98 por partes (igual ao art.js; mão opcional: sem pele = arma solta, caindo) */
function drawRifle(x,cx,cy,a,de,pr,skin){const co=Math.cos(a),si=Math.sin(a),W=GW;
 const P=(f,s,d,col)=>{x.fillStyle=col;x.fillRect(Math.round(cx+co*f-si*s),Math.round(cy+si*f+co*s+d),1,1)},
 R=(f0,f1,s0,s1,d,col)=>{for(let f=f0;f<=f1+.01;f+=.5)for(let s=s0;s<=s1+.01;s+=.5)P(f,s,d,col)},Hd=(f,s,d)=>{if(skin)P(f,s,d,skin)};
 const wd=de?W.walnut:W.wood,wdd=de?W.walnutD:W.woodD,open=pr>=1&&pr<=3?1:pr===4?.5:0,up=pr>=0&&pr<=4,bf=-open*3;
 R(-5,-1.5,-.5,.5,0,wd);R(-5,-1.5,.5,.5,0,wdd);P(-5.5,0,0,W.steelD);if(de){P(-2,0,1,wd);P(-6,0,0,W.steelD)}
 R(-1,3,-.5,.5,0,W.steel);if(open)R(0,2.5,-.5,.5,0,W.gap);
 R(bf-.5,bf+2,0,0,up?-1:0,W.steelH);
 P(bf+.5,1.5,up?-1:0,W.steelH);P(bf+.5,2.5,up?-1:0,W.steelH);if(up){P(bf+.5,3.5,-2,W.steelH);P(bf+.5,3.5,-1,W.steelD)}else if(de)P(bf+.5,3,1,W.steelH);
 R(3,de?10:8,-.5,.5,0,wd);R(3,de?10:8,.5,.5,0,wdd);if(de){P(6,0,0,W.steelH);P(9,0,0,W.steelH);P(10.5,0,0,W.steelD);R(11,12,0,0,0,W.steel);P(11,0,-1,W.steelD)}else{P(8.5,0,0,W.steelD);R(9,12,0,0,0,W.steel)}P(12,0,0,W.steelD);P(11.5,0,-1,W.steelD);
 P(1,0,1,W.steelD);P(2,0,1,W.steelD);if(de)P(1.5,0,2,W.steelD);
 if(pr===2){R(-.5,3.5,0,0,-2,W.steelH);for(let i=0;i<5;i++)P(i*.75,0,-3,W.brass);P(1.5,0,-3,W.brassH)}
 if(pr===3){R(-.5,3.5,0,0,-2,W.steelH);P(.5,0,-3,W.brass);P(2.5,0,-3,W.brass)}
 if(pr===2)Hd(1.5,0,-4);else if(pr===3)Hd(1.5,0,-2);else if(up)Hd(bf+.5,3.5,-1);else Hd(-1.5,0,0);Hd(5.5,0,1)}
/* metralhadora carregada (igual ao drawGun 'mg' do art.js) */
function drawMG(x,cx,cy,a){const c=Math.cos(a),s=Math.sin(a);for(const[f,t,col]of[[-3,1,'#8a6238'],[1,13,'#59605a'],[3,9,'#9aa190']]){x.fillStyle=col;for(let d=f;d<=t;d+=.5){const px=Math.round(cx+c*d),py=Math.round(cy+s*d);x.fillRect(px,py,1,1);if(d>1&&d<11)x.fillRect(px,py+(Math.abs(s)>.7?0:1),1,1)}}}
function beltGrenades(x,team,facing,ox,oy){const P=(a,b,col)=>{x.fillStyle=col;x.fillRect(ox+a,oy+b,1,1)};
 for(const sx of facing==='side'?[3]:[1,6]){if(team===0){P(sx,8,'#4e5632');P(sx+1,8,'#7d8a54');P(sx,9,'#3b4225');P(sx+1,9,'#4e5632');P(sx,7,'#9a9a84')}
  else{P(sx,7,'#767b80');P(sx+1,7,'#9aa0a5');P(sx,8,'#5d6267');P(sx+1,8,'#767b80');P(sx,9,'#d3bf95');P(sx,10,'#bca677')}}}
function grenadeInHand(x,team,hx,hy){if(team===0){x.fillStyle='#4e5632';x.fillRect(hx-1,hy-3,3,3);x.fillStyle='#7d8a54';x.fillRect(hx-1,hy-3,1,2);x.fillStyle='#9a9a84';x.fillRect(hx,hy-4,1,1)}
 else{x.fillStyle='#d3bf95';x.fillRect(hx,hy-2,1,3);x.fillStyle='#767b80';x.fillRect(hx-1,hy-4,3,2);x.fillStyle='#9aa0a5';x.fillRect(hx-1,hy-4,1,1)}}
function pline(x,x0,y0,x1,y1,col){x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);const dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let e=dx+dy;x.fillStyle=col;for(;;){x.fillRect(x0,y0,1,1);if(x0===x1&&y0===y1)break;const e2=2*e;if(e2>=dy){e+=dy;x0+=sx}if(e2<=dx){e+=dx;y0+=sy}}}

/* ======================================================================================
   PERNAS — desenhadas por estado de cada perna (as grades originais têm só 3 quadros)
   frente/costas: perna esq. nas colunas 1–3, dir. 5–7. Estados: 'st' parado (bota na linha 2), 'fw' à frente (mais perto da câmera:
   desce uma linha), 'bk' atrás (calcanhar erguido: estreita e sobe), 'lf' no ar (joelho dobrado, bota sob o joelho), 'hi' joelho alto.
   De costas o "à frente" fica mais longe da câmera: os papéis de fw/bk trocam.
   perfil (virado para a direita; o art.js espelha para a esquerda): tabelas de 13 colunas com o quadril nas colunas 6–7.
   L = perna, B = bota; a perna de trás usa as cores escuras e é desenhada antes.
   ====================================================================================== */
const SW=[ /* marcha, perna de perto, 8 tempos: contato, carga, passagem, impulso, ponta, recolhe, cruza, estende */
['......LL.....','.......LL....','........LL...','........BBB..'],
['......LL.....','.......LL....','.......LL....','.......BBB...'],
['......LL.....','......LL.....','......BBB....','.............'],
['......LL.....','......LL.....','.....LL......','.....BB......'],
['......LL.....','.....LL......','....LL.......','...BB........'],
['......LL.....','.....LL......','.....BB......','.............'],
['......LL.....','.......L.....','......BB.....','.............'],
['......LL.....','.......LL....','........BB...','.............']];
const SR=[ /* corrida: passada mais longa, calcanhar sobe atrás, joelho alto à frente */
['......LL.....','.......LL....','.........LL..','.........BBB.'],
['......LL.....','.......LL....','.......LL....','......BBB....'],
['......LL.....','.....LL......','....LL.......','...BB........'],
['......LL.....','....LL.......','..LL.........','.BB..........'],
['......LL.....','....LLL......','....BB.......','.............'],
['......LLLL...','.........L...','........BB...','.............'],
['......LLL....','........LL...','.........BB..','.............'],
['......LL.....','.......LL....','.........LL..','..........BB.']];
const SS=['......LL.....','......LL.....','......BBB....','.............'];
/* passo curto (quem arranca, desacelera ou anda devagar): a mesma marcha com o alcance das pernas pela metade, derivada da tabela SW */
function shrinkRow(r,k){const o=Array(13).fill('.');for(let i=0;i<r.length;i++){const ch=r[i];if(ch==='.')continue;const ni=Math.round(6.5+(i-6.5)*k);if(o[ni]!=='B')o[ni]=ch}return o.join('')}
const SWA=SW.map(rows=>rows.map((r,j)=>j===0?r:shrinkRow(r,.5)));
const SK=[ /* ajoelhado (perfil): joelho de trás no chão, canela deitada; perna da frente com canela vertical */
'......LLLL...','..BBLLL..L...','.........BB..'];
/* frente/costas por tempo: [esq, dir] */
const FW=[['fw','bk'],['fw','lf'],['st','st'],['bk','fw'],['bk','fw'],['lf','fw'],['st','st'],['fw','bk']];
const FWA=[['fw','st'],['st','st'],['st','st'],['st','fw'],['st','fw'],['st','st'],['st','st'],['fw','st']];
const FR=[['fw','bk'],['fw','hi'],['st','lf'],['bk','fw'],['bk','fw'],['hi','fw'],['lf','st'],['fw','bk']];
function legCols(team,row,left){/* cores da linha (perneira dos EUA = tons trocados; Alemanha = cano da bota) */
 const p=PAL[team];if(row===1)return team===0?(left?[p.K,p.K,p.k]:[p.k,p.K,p.K]):[p.b,p.b,p.b];
 if(row>=2&&team===1)return[p.b,p.b,p.b];return left?[p.k,p.k,p.K]:[p.K,p.k,p.k]}
function legFront(x,team,ox,oy,left,st){const c0=left?1:5,b=PAL[team].b,px=(i,j,col)=>{x.fillStyle=col;x.fillRect(ox+c0+i,oy+j,1,1)};
 const full=j=>{const cl=legCols(team,j,left);for(let i=0;i<3;i++)px(i,j,cl[i])},inner=(j,col)=>{const i0=left?1:0;px(i0,j,col||legCols(team,j,left)[i0]);px(i0+1,j,col||legCols(team,j,left)[i0+1])};
 if(st==='st'){full(0);full(1);for(let i=0;i<3;i++)px(i,2,b)}
 else if(st==='fw'){full(0);full(1);full(2);for(let i=0;i<3;i++)px(i,3,b)}
 else if(st==='bk'){full(0);inner(1);inner(2,b)}
 else if(st==='lf'){full(0);inner(1,b)}
 else if(st==='hi'){full(0);for(let i=0;i<3;i++)px(i,1,b)}}
function legSide(x,team,ox,oy,rows,far){const p=PAL[team];for(let j=0;j<rows.length;j++){const r=rows[j];for(let i=0;i<r.length;i++){const ch=r[i];if(ch==='.')continue;
 let col;if(ch==='B')col=p.b;else if(j===1)col=team===0?(far?p.k:p.K):p.b;else if(j>=2&&team===1)col=p.b;else col=far?p.K:(r[i+1]==='L'?p.k:p.K);
 if(col===p.b){if(far)col=mixc(p.b,'#000000',.3);else if(r[i-1]!==ch&&r[i-1]!=='L'&&r[i-1]!=='B')col=mixc(p.b,'#8a8470',.28)}x.fillStyle=col;x.fillRect(ox+i-3,oy+j,1,1)}}}
const MIX=new Map();function mixc(a,b,t){const k=a+b+t;let v=MIX.get(k);if(!v){v=PX.mix(a,b,t);MIX.set(k,v)}return v}

/* ======================================================================================
   COMPOSIÇÃO DE UM QUADRO
   o = {legs:'stand'|'walk'|'amble'|'run'|'kneel'|'buckle', lf, udy (tronco), tsx (balanço lateral, de frente/costas), lean (0–2), hdx/hdy (cabeça), headF (vista da cabeça),
        gun:{m:'carry'|'aim'|'recoil'|'bolt'|'reload'|'throw'|'drop'|'none', pr, dy, dx, tilt}, thr (braço da granada)}
   ====================================================================================== */
const GRID=new Map();
function grid(team,part,facing){const k=team+part+facing;let c=GRID.get(k);if(!c){c=fromGrid(part==='h'?HEAD[team][facing]:TORSO[facing],PAL[team]);GRID.set(k,c)}return c}
function compose(team,type,d,o,gren){
 const a=d*TAU/16,s=Math.sin(a),co=Math.cos(a),facing=s>.55?'front':s<-.55?'back':'side',flip=facing==='side'&&co<0,back=facing==='back';
 /* corpo num quadro 17×18 com a grade 9×14 na origem (4,1): sobra para inclinar e para as pernas compridas */
 const B=mk(17,18),b=g2(B),OX=4,OY=1,udy=o.udy||0;
 const L=o.legs||'stand',lf=(o.lf||0)&7;
 if(facing==='side'){
  if(L==='kneel'||L==='buckle')legSide(b,team,OX,OY+11+(L==='buckle'?1:0),SK,false);
  else{const T=L==='run'?SR:L==='amble'?SWA:SW,near=L==='stand'?SS:T[lf],farR=L==='stand'?SS:T[(lf+4)&7];legSide(b,team,OX,OY+10,farR,true);legSide(b,team,OX,OY+10,near,false)}}
 else{
  if(L==='kneel'||L==='buckle'){const y=OY+11+(L==='buckle'?1:0);legFront(b,team,OX,y,true,'lf');legFront(b,team,OX,y-1,false,'st')}
  else{const T=L==='run'?FR:L==='amble'?FWA:FW,pr=L==='stand'?['st','st']:T[lf],sw=st=>back?(st==='fw'?'bk':st==='bk'?'fw':st):st;legFront(b,team,OX,OY+10,true,sw(pr[0]));legFront(b,team,OX,OY+10,false,sw(pr[1]))}}
 /* tronco e cabeça (com balanço, inclinação e cabeça solta para olhar/tranco) */
 const lean=o.lean||0,tdx=facing==='side'?(lean>=2?1:0):0,hdx=(o.hdx||0)+(facing==='side'?(lean>=1?1:0):0),hdy=(o.hdy||0)+(facing!=='side'&&lean>=2?1:0);
 const T=grid(team,'t',facing),tsx=facing==='side'?0:(o.tsx||0);if(udy<0)b.drawImage(T,0,3,9,1,OX+tdx,OY+9,9,1);/* corpo subiu: a linha do cinto se repete para não abrir buraco */
 b.drawImage(T,OX+tdx+tsx,OY+6+udy);
 const hf=o.headF||facing;let H=grid(team,'h',hf);if(o.headFlip)H=flipX(H);b.drawImage(H,OX+hdx+tsx,OY+hdy+udy);
 if(gren&&type==='rifle')beltGrenades(b,team,facing,OX+tdx,OY+udy);
 const body=flip?flipX(B):B;
 /* quadro final 28×28 como no art.js: arma atrás do corpo quando de costas, à frente nos outros casos */
 const c=mk(28,28),x=g2(c),sk=PAL[team].s,g=o.gun||{m:'carry'},de=team===1,tilt=co>=0?1:-1;
 const hx=14+co*1.5,hy=15+s+(back?-1:0)+udy;
 const gun=()=>{if(g.m==='none')return;if(type==='mg'){drawMG(x,hx+(g.dx||0)*co,hy+(g.dy||0),a+(g.tilt||0)*tilt);return}
  switch(g.m){
  case 'carry':drawRifle(x,hx,hy+(g.dy||0),a+(g.tilt||0)*tilt,de,-1,sk);break;
  case 'aim':drawRifle(x,hx+co*1.5,hy-1,a,de,-1,sk);break;
  case 'recoil':drawRifle(x,hx+co*.5,hy-1-(facing==='side'?0:1),a-(facing==='side'?.16*tilt:0),de,-1,sk);break;
  case 'bolt':drawRifle(x,hx+co*1,hy+(g.dy||0),a,de,g.pr,sk);break;
  case 'reload':drawRifle(x,14+co*.5,16.5+s*.4+udy,a+tilt*RL_TILT[g.pr],de,g.pr,sk);break;
  case 'throw':drawRifle(x,14+co*.5,17+s*.4+udy,a+tilt*.75,de,null,sk);break;
  case 'drop':drawRifle(x,hx+co*(g.dx||0),hy+(g.dy||0),a+tilt*(g.tilt||0),de,-1,g.hand?sk:null);break}};
 const behind=s<-.35&&g.m!=='reload'&&g.m!=='throw';
 if(behind)gun();
 x.drawImage(body,9-OX,8-OY);
 if(!behind)gun();
 if(o.thr!=null)throwArm(x,team,a,o.thr,udy,lean&&facing==='side'?co:0);
 return{c:outlined(c),ax:15,ay:16}}
/* braço do arremesso: posição da mão relativa ao ombro (13,15) em 6 tempos; granada na mão até soltar */
const THR=[[2,-1],[-4,-3],[-2,-8],[4,-6],[6,-1],[3,1]];
function throwArm(x,team,a,th,udy,lx){const co=Math.cos(a),si=Math.sin(a),T=PAL[team],sx=13+Math.round(lx),sy=15+udy,h=THR[th];
 const hx=Math.round(sx+h[0]*(Math.abs(co)<.3?.6:Math.sign(co)||1)+(th>=3?si*0:0)),hy=Math.round(sy+h[1]+(th>=3?si*2:0));
 pline(x,sx,sy,hx,hy,T.u);pline(x,sx,sy+1,hx,hy+1,T.U);
 if(th<3)grenadeInHand(x,team,hx,hy);
 x.fillStyle=T.s;x.fillRect(hx,hy,1,1);if(th===3||th===4)x.fillRect(hx+Math.round(co),hy+Math.round(si),1,1)}

/* ======================================================================================
   CATÁLOGO DE POSES → opções de composição (subquadro = índice)
   ====================================================================================== */
const P_IDLE=0,P_WALK=1,P_RUN=2,P_AIM=3,P_KAIM=4,P_RL=5,P_KRL=6,P_THR=7,P_DIE=8,P_AMBLE=9,P_AMBLEF=10;
const BOLT=[{m:'aim'},{m:'recoil'},{m:'bolt',pr:0,dy:0},{m:'bolt',pr:1,dy:0},{m:'bolt',pr:4,dy:0},{m:'bolt',pr:-1,dy:0}];
const WALK_BOB=[1,0,0,0,1,0,0,0],RUN_BOB=[1,0,-1,0,1,0,-1,0],RUN_GUN=[1,0,-1,0,1,0,-1,0];
/* o fuzil não é parte rígida do corpo: desce um quadro DEPOIS do tronco e a boca balança com o passo; de frente/costas os ombros trocam de lado */
const WALK_GDY=[0,1,0,0,0,1,0,0],WALK_TILT=[.1,.05,-.03,-.07,.1,.05,-.03,-.07],WALK_SWAY=[0,1,1,0,0,-1,-1,0];
function poseOpts(pose,sub,facing,co){
 switch(pose){
 case P_IDLE:{/* 0 parado · 1 expira (fuzil desce 1) · 2/3 olha para um lado e para o outro */
  if(sub===1)return{gun:{m:'carry',dy:1}};
  if(sub===2||sub===3){if(facing==='side')return{headF:sub===2?'front':'back'};return{headF:'side',headFlip:sub===3}}
  return{}}
 case P_WALK:return{legs:'walk',lf:sub,udy:WALK_BOB[sub],tsx:WALK_SWAY[sub],gun:{m:'carry',dy:WALK_GDY[sub],tilt:facing==='side'?WALK_TILT[sub]:WALK_TILT[sub]*.5}};
 case P_AMBLE:return{legs:'amble',lf:sub,udy:sub===0||sub===4?1:0,gun:{m:'carry',dy:WALK_GDY[sub],tilt:facing==='side'?WALK_TILT[sub]*.5:0}};
 case P_AMBLEF:return{legs:'amble',lf:sub,udy:sub===0||sub===4?1:0,lean:1,hdy:facing!=='side'?1:0,gun:{m:'carry',dy:0,tilt:facing==='side'?-.05:0}};
 case P_RUN:return{legs:'run',lf:sub,udy:RUN_BOB[sub],lean:2,gun:{m:'carry',dy:RUN_GUN[sub]*0,tilt:facing==='side'?-.42:0,dx:0}};
 case P_AIM:return Object.assign({gun:BOLT[sub]},sub===0&&facing==='side'?{hdy:1}:sub===1?{hdx:facing==='side'?-1:0,hdy:facing==='side'?0:-1}:{});
 case P_KAIM:return Object.assign({legs:'kneel',udy:2,gun:BOLT[sub]},sub===0&&facing==='side'?{hdy:1}:sub===1?{hdx:facing==='side'?-1:0}:{});
 case P_RL:return{gun:{m:'reload',pr:sub},hdy:sub>=1&&sub<=4&&facing!=='back'?1:0};
 case P_KRL:return{legs:'kneel',udy:2,gun:{m:'reload',pr:sub},hdy:sub>=1&&sub<=4&&facing!=='back'?1:0};
 case P_THR:{const lean=[0,0,0,1,2,1][sub];return{gun:{m:'throw'},thr:sub,lean,hdx:facing==='side'&&(sub===1||sub===2)?-1:0,udy:sub===0||sub===5?1:0}}
 case P_DIE:{if(sub===0)return{gun:{m:'drop',dy:1,tilt:.5,hand:true},hdy:facing==='side'?0:-1,hdx:facing==='side'?-1:0};
  return{legs:'buckle',udy:3,hdy:1,hdx:facing==='side'?1:0,gun:{m:'drop',dy:5,dx:2,tilt:1.25}}}}
 return{}}
const FC=new Map();
function frame(team,type,d,pose,sub,gren){const key=((((pose*8+sub)*16+d)*2+team)*2+(type==='mg'?1:0))*2+(gren?1:0);let v=FC.get(key);
 if(!v){const a=d*TAU/16,s=Math.sin(a),facing=s>.55?'front':s<-.55?'back':'side';v=compose(team,type,d,poseOpts(pose,sub,facing,Math.cos(a)),gren);FC.set(key,v);S.stats.built++}return v}

/* ======================================================================================
   RASTEJAR (fixado pelo fogo, assault.js): grades deitadas de bruços, cabeça para a direita como os cadáveres do art.js,
   pré-giradas pelo RotSprite (16 direções, cache). 0/1 = cotovelo e joelho alternados, 2 = deitado mirando.
   ====================================================================================== */
const PRONE=[[
'........................',
'.............UUs........',
'..b.........Uu..........',
'.bkkk..ppuuuuUhhh.......',
'bkKkk.ppPPPPuuhHhh......',
'.kKK..ppPPPPuuhhhh......',
'..kkkkppPPPPuuUhhh......',
'...KkkpppuuuuUusswwwgggg',
'....Kkk.................',
'.....bb.................',
'........................'],[
'........................',
'....bb..................',
'...Kkk..................',
'.bkkkk.ppuuuuUhhh.......',
'bkKkk.ppPPPPuuhHhh......',
'.kKK..ppPPPPuuhhhh......',
'..kkk.ppPPPPuuUhhh......',
'.....kpppuuuuUuwwwgggg..',
'............UUss........',
'........................',
'........................'],[
'........................',
'........................',
'.b...........UUs........',
'bkkk...ppuuuuUhhh.......',
'kKkk..ppPPPPuuhHhh......',
'.KK...ppPPPPuuhhhh......',
'bkkkk.ppPPPPuuUhhh......',
'.kkkkkpppuuuuUusswwwgggg',
'........................',
'........................',
'........................']];
const PC=new Map();
function proneSprite(team,d,v){const key=(v*16+d)*2+team;let r=PC.get(key);if(r)return r;
 const p=Object.assign({},TEAM[team],{w:'#7a5536',g:'#8d9484',T:TEAM[team].t,P:'#6a5337',p:'#8a6c45'}),base=fromGrid(PRONE[v],p);
 const rb=rotSprite(base,d*TAU/16),ob=outlined(rb,.6);r={c:ob,ax:Math.floor(ob.width/2),ay:Math.floor(ob.height/2)};PC.set(key,r);S.stats.built++;return r}

/* ======================================================================================
   QUEDA DE MORTE: tranco → joelhos cedem → tomba (RotSprite pré-girado do corpo dobrado, sem arma) → cadáver do art.js
   ====================================================================================== */
const TIP=new Map();
function tipSprite(src,q){/* q = ângulo de giro quantizado em 1/16 de volta, cache por canvas de origem */let m=TIP.get(src);if(!m){m=new Map();TIP.set(src,m)}let r=m.get(q);if(r)return r;
 const rb=rotSprite(src,q*TAU/16),N=rb.width;r={c:rb,ax:N>>1,ay:N>>1};m.set(q,r);S.stats.built++;return r}
const FALLS=[],HIDE=new Set(),DYING=new WeakSet();let ALL=null;
const FD={jolt:.08,buckle:.21,tip1:.33,tip2:.41},FB={jolt:.06,tip1:.2,tip2:.3};
function registerFall(u){
 const c=corpses[corpses.length-1];if(!c||Math.abs(c.x-u.x)>=1||Math.abs(c.y-u.y)>=1||c.fl)return;
 if(u.down||u.pinned||u.sh||(u.pv&&u.pv.stun>.05)||(window.PXW&&PXW.depth(u.x,u.y)>=.25))return;
 const fa=u._fa!=null?u._fa:(u.angle||0),blast=hyp(c.sx||0,c.sy||0)>4.2,ms=u.mask&&window.PXAS&&PXAS.on&&PXAS.maskedSprite;
 FALLS.push({c,u,team:u.team,type:u.type,d:dir16(fa),gren:u.gren>0,t0:time,blast,mask:!!ms,x:u.x,y:u.y});HIDE.add(c);DYING.add(u);S.stats.falls++;
 if(FALLS.length>40){const f=FALLS.shift();HIDE.delete(f.c)}}
function eased(c){if(c.born==null)return 1;const pr=clamp((time-c.born)/.3,0,1);return 1-(1-pr)*(1-pr)}
function drawFalls(ctx,ox,oy){
 for(let i=FALLS.length-1;i>=0;i--){const F=FALLS[i],c=F.c,el=time-F.t0,D=F.blast?FB:FD;
  if(el>=D.tip2||el<0||(ALL||corpses).indexOf(c)<0){HIDE.delete(c);FALLS.splice(i,1);continue}
  const e=eased(c),slx=Math.round((c.sx||0)*e),sly=Math.round((c.sy||0)*e),cx=ox+Math.round(c.x*.5)+slx,cy=oy+Math.round(c.y*.5)+sly;
  if(cx<-40||cy<-40||cx>vw+40||cy>vh+40)continue;
  const ux=ox+Math.round(F.x*.5)+slx,uy=oy+Math.round(F.y*.5)+sly;
  let st=el<D.jolt?0:!F.blast&&el<D.buckle?1:el<D.tip1?2:3;
  const sh=PX.shadowSprite(5,2);
  if(st<2){let sp=frame(F.team,F.type,F.d,P_DIE,st,F.gren);if(F.mask)sp=PXAS.maskedSprite(sp,F.team);
   ctx.drawImage(sh.c,ux-sh.ax,uy+6-sh.ay);ctx.drawImage(sp.c,ux-sp.ax,uy-sp.ay);continue}
  /* tombando (1º tempo): gira o corpo dobrado para o lado onde a cabeça vai cair — no máximo ~57°, para quem cai de cara para a câmera
     não aparecer de ponta-cabeça; o centro já vai deslizando para o cadáver */
  if(st===2){let src=frame(F.team,F.type,F.d,P_DIE,1,false);if(F.mask)src=PXAS.maskedSprite(src,F.team);
   let th=Math.atan2(Math.sin(c.angle||0),Math.cos(c.angle||0))+Math.PI/2;th=Math.atan2(Math.sin(th),Math.cos(th));
   const q=Math.round(clamp(th*.5,-1,1)/(TAU/16)),tp=tipSprite(src.c,q),lift=F.blast?-4:0,px=Math.round(ux+(cx-ux)*.45),py=Math.round(uy+(cy-uy)*.45)+1+lift;
   ctx.globalAlpha=.8;ctx.drawImage(sh.c,px-sh.ax,py+4-sh.ay);ctx.globalAlpha=1;ctx.drawImage(tp.c,px-tp.ax,py-tp.ay);continue}
  /* 2º tempo: já é o sprite do cadáver (o mesmo que o pixel.js vai desenhar), ainda 2 px no ar — no quadro seguinte assenta no chão */
  const cs=corpseSprite(F.team,dir8(c.angle||0),((c.id||0)*5+F.team*3)&3);ctx.drawImage(cs.c,cx-cs.ax,cy-cs.ay-(F.blast?3:2))}}

/* ======================================================================================
   ESCOLHA DA POSE POR UNIDADE (só leitura do estado do jogo)
   ====================================================================================== */
const rlTime=()=>(typeof weapons!=='undefined'&&weapons.rifle&&weapons.rifle.reload)||2.6;
function soldierPlayer(u){return typeof player!=='undefined'&&u===player&&typeof mode!=='undefined'&&mode==='soldier'}
function lifePose(u){const L=u.lf;if(!L||!window.PXLIFE||!PXLIFE.on)return false;return !!(L.water||L.pose||L.duck>time||L.trip>time||L.climb>time)}
/* corrida e passada: a decisão fica num lugar só, para o passo (track) e o quadro (choose) concordarem */
const runOf=u=>u.type==='mg'?(u._v>40||u.order==='retreat'):(u.aiRole==='assalto'||u.order==='retreat'||u._v>(window.PXGAIT?PXGAIT.cfg.RUNV:54)||u.lunge2>time);
const strideOf=(u,run)=>(u.type==='mg'?(run?30:22):(run?32:24))*(u.gt?u.gt.sl:1);
const angd=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
function track(u){/* fase do passo travada na distância percorrida (u._wp, em ciclos; passo mais curto a baixa velocidade), velocidade suavizada,
   ângulo exibido com giro gradual (arranca com a velocidade angular e chega devagar) */
 const t=time;if(u._it===undefined){u._it=t;u._wx=u.x;u._wy=u.y;u._wd=(u.id*7.3)%24;u._wp=u._wd/24;u._v=0;u._fw=0;u._mov=false;u._stT=-9;u._mvT=-9;u._am=false;u._fa=u.angle||0;return}
 const dt=t-u._it;u._it=t;const dd=hyp(u.x-u._wx,u.y-u._wy);u._wx=u.x;u._wy=u.y;
 if(dd<30){u._wd+=dd;if(dt>0)u._v+=(dd/dt-u._v)*Math.min(1,dt*6);
  u._wp+=dd/(strideOf(u,runOf(u))*(.74+.26*clamp(u._v/47,0,1.1)))}else u._v=0;
 const mv=!!u.moving;if(mv!==u._mov){u._mov=mv;if(mv)u._mvT=t;else u._stT=t}
 const tg=u.angle||0;if(u.flash>0||soldierPlayer(u)||dt<=0||dt>.5){u._fa=tg;u._fw=0;return}
 const df=angd(tg,u._fa);if(Math.abs(df)<.02){u._fa=tg;u._fw=0;return}
 u._fw+=(clamp(df*8,-11,11)-u._fw)*Math.min(1,dt*22);const st=u._fw*dt;
 if(Math.abs(st)>=Math.abs(df)){u._fa=tg;u._fw=0}else u._fa+=st}
function choose(u){
 const me=soldierPlayer(u),t=time;
 if(me&&(typeof weapon==='undefined'||weapon!=='rifle'))return null;
 const d=dir16(u._fa),gren=u.gren>0,life=lifePose(u);
 if(u.type==='mg'){if(!u.moving)return null;return frame(u.team,'mg',d,runOf(u)?P_RUN:P_WALK,Math.floor(u._wp*8)&7,false)}
 /* granada: o jogo lança com thr ≤ .28 (p ≈ .49) — o quadro de soltar começa exatamente aí */
 if(u.thr>0){const p=1-u.thr/.55,sub=p<.16?0:p<.33?1:p<.4909?2:p<.62?3:p<.8?4:5;return frame(u.team,'rifle',d,P_THR,sub,gren)}
 const kneel=!life&&!u.moving&&(u.sheltered||(u.suppression||0)>.75)&&!me;
 if(me){if(typeof reload!=='undefined'&&reload>0)return null}
 else if(u.rl>0){const ph=clamp(Math.floor((1-u.rl/rlTime())*6),0,5);return frame(u.team,'rifle',d,kneel?P_KRL:P_RL,ph,gren)}
 if(u.moving){const run=runOf(u),sub=Math.floor(u._wp*8)&7;
  if(run)return frame(u.team,'rifle',d,P_RUN,sub,gren);
  if(u._am){if(u._v>27)u._am=false}else if(u._v<19)u._am=true;      // passo curto: arrancando, freando ou devagar (histerese 19/27 u/s)
  return frame(u.team,'rifle',d,u._pose=u._am?(t-u._mvT<.55?P_AMBLEF:P_AMBLE):P_WALK,sub,gren)}      // inclinado para a frente só nos primeiros 0,55 s depois de arrancar (sem derivada da velocidade: não pisca)
 const since=t-(u._shotT==null?-99:u._shotT),tgt=u.target&&u.target.hp>0;
 if(since<1.6||tgt){let sub=0;if(since<1.6){sub=since<.09?1:since<.3?0:since<.42?2:since<.56?3:since<.7?4:since<.84?5:0;
   if(sub>=2&&!(u.ammo>0)&&!me)sub=0;if(sub===3&&u._bp!==u._shotT){u._bp=u._shotT;casing(u)}}
  return frame(u.team,'rifle',d,kneel?P_KAIM:P_AIM,sub,gren)}
 /* parado: respiração (o fuzil sobe e desce com o peito) e uma olhada para os lados de vez em quando */
 const ph=(t*.31+u.id*.137)%1,g=(t+u.id*3.7)%9.5;let sub=ph>.56?1:0;if(t-u._stT<.45)sub=1;else if(g<1.3&&!me)sub=g<.65?2:3;   // acabou de parar: solta o ar, o fuzil desce
 return frame(u.team,'rifle',d,P_IDLE,sub,gren)}

/* estojos ejetados pelo ferrolho entre tiros (o pixel.js só os solta na recarga) */
const CAS=[];
function casing(u){if(CAS.length>60)return;const a=u._fa||0,ca=Math.cos(a),sa=Math.sin(a),side=ca>=0?1:-1;
 CAS.push({x:u.x+ca*3,y:u.y+sa*3,z:7,vx:-sa*22*side+(Math.random()-.5)*10,vy:ca*22*side*.4-6,vz:38+Math.random()*16,t:0});S.stats.casings++}
function drawCasings(ctx,ox,oy,dt){for(let i=CAS.length-1;i>=0;i--){const p=CAS[i];p.t+=dt;if(p.t>1.6){CAS.splice(i,1);continue}
 if(p.z>0){p.vz-=260*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.z<=0){p.z=0;p.vx*=.3;p.vy*=.3}}
 const x=ox+Math.round(p.x*.5),y=oy+Math.round(p.y*.5-p.z*.5);if(x<0||y<0||x>=vw||y>=vh)continue;
 ctx.globalAlpha=p.t>1.1?(1.6-p.t)/.5:1;ctx.fillStyle=p.z>0?((p.t*30|0)&1?'#f2d878':'#c79a32'):'#b8923a';ctx.fillRect(x,y,1,1)}ctx.globalAlpha=1}

/* tinta de acerto com o sprite NOVO (o pixel.js pintaria a silhueta do sprite base por cima: pose errada por 0,16 s) */
const TINT=new WeakMap();
function tint(sp,col){let m=TINT.get(sp.c);if(!m){m={};TINT.set(sp.c,m)}return m[col]||(m[col]=PX.silhouette(sp.c,col))}
let hitFresh=false;
function takeHit(u){hitFresh=false;if(u.hitT>0){u._ht=u.hitT;u._htT=time;u.hitT=0;hitFresh=true}const r=u._ht?u._ht-(time-u._htT):0;if(r<=0){u._ht=0;return 0}return r}
function giveHitBack(u){if(u._ht){const r=u._ht-(time-u._htT);if(r>0&&!(u.hitT>0))u.hitT=r;u._ht=0}}

/* ======================================================================================
   LIGAÇÕES
   ====================================================================================== */
const restore=[];function restoreAll(){HIDE.clear();FALLS.length=0;for(const u of(typeof units!=='undefined'?units:[]))giveHitBack(u)}
const wrapG=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('anim-infantry.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};
wrapG('shoot',(orig,u,target,manual)=>{const r=orig(u,target,manual);try{if(S.on&&u&&(u.type==='rifle')&&u.flash>0)u._shotT=time}catch(e){fail(e)}return r});
wrapG('damage',(orig,u,n,att)=>{const alive=u&&u.hp>0;const r=orig(u,n,att);try{if(S.on&&alive&&u.hp<=0&&(u.type==='rifle'||u.type==='mg'))registerFall(u)}catch(e){fail(e)}return r});
wrapG('setup',(orig,...a)=>{FALLS.length=0;HIDE.clear();CAS.length=0;const r=orig(...a);warm();return r});
/* pré-aquecimento: monta os quadros mais comuns aos poucos (≤ 2 ms por quadro de animação), para o contorno (getImageData) não cair no meio da batalha */
let WQ=null;function warm(){if(WQ)return;WQ=[];for(const[p,n]of[[P_WALK,8],[P_IDLE,2],[P_AMBLE,8],[P_AIM,6],[P_RUN,8],[P_RL,6],[P_AMBLEF,8],[P_KAIM,6],[P_THR,6],[P_IDLE+0,4]])for(let s=0;s<n;s++)for(let d=0;d<16;d++)for(let t=0;t<2;t++)WQ.push([t,d,p,s]);
 const step=()=>{if(!S.on||!WQ.length){WQ=null;return}const t0=performance.now();try{while(WQ.length&&performance.now()-t0<2){const[t,d,p,s]=WQ.shift();frame(t,'rifle',d,p,s,true);frame(t,'rifle',d,p,s,false)}}catch(e){fail(e);WQ=null;return}requestAnimationFrame(step)};requestAnimationFrame(step)}
/* durante a queda o cadáver real some do laço de desenho do pixel.js (só neste render; o array volta intacto) */
wrapG('render',(orig,...a)=>{if(!S.on||!HIDE.size||typeof corpses==='undefined')return frameT(orig,a);const keep=corpses;let r;
 try{ALL=keep;corpses=keep.filter(c=>!HIDE.has(c))}catch(e){fail(e);return frameT(orig,a)}
 try{r=frameT(orig,a)}finally{corpses=keep;ALL=null}return r});
/* medição amostrada (1 render a cada 16): o próprio performance.now() por soldado custaria mais que a camada */
let acc=0,lastR=0;function frameT(orig,a){PROF=S.stats.frames%16===0;const t0=performance.now();acc=0;accD=0;const r=orig(...a);S.stats.frames++;if(PROF){S.stats.ms=S.stats.ms*.8+(acc-accD)*.2;S.stats.chain=(S.stats.chain||0)*.8+accD*.2}PROF=false;lastR=performance.now()-t0;return r}
if(window.WW1A){const u0=WW1A.under,o0=WW1A.over;
 WW1A.under=function(c,ox,oy,dt){const r=u0.apply(this,arguments);if(S.on&&FALLS.length){const t0=performance.now();try{drawFalls(c,ox,oy)}catch(e){fail(e)}acc+=performance.now()-t0}return r};
 WW1A.over=function(c,ox,oy,dt){const r=o0.apply(this,arguments);if(S.on&&CAS.length)try{drawCasings(c,ox,oy,Math.min(.05,dt||.016))}catch(e){fail(e)}return r}}
if(!window.PHYS)window.PHYS={on:false,draw:()=>false};
{const d0=PHYS.draw||(()=>false);PHYS.draw=function(c,u,sp,sx,sy,vis,bob){
 if(!S.on||(u.type!=='rifle'&&u.type!=='mg'))return d0.call(PHYS,c,u,sp,sx,sy,vis,bob);
 const t0=PROF?performance.now():0;let r;
 try{r=drawInf(c,u,sp,sx,sy,vis,bob,d0)}catch(e){fail(e);giveHitBack(u);r=d0.call(PHYS,c,u,sp,sx,sy,vis,bob)}
 if(PROF)acc+=performance.now()-t0;return r}}
let accD=0,PROF=false;function D0(d0,c,u,sp,sx,sy,vis,bob){if(!PROF)return d0.call(PHYS,c,u,sp,sx,sy,vis,bob);const t=performance.now(),r=d0.call(PHYS,c,u,sp,sx,sy,vis,bob);accD+=performance.now()-t;return r}
function drawInf(c,u,sp,sx,sy,vis,bob,d0){
 if(u.hp<=0&&DYING.has(u)){u.hitT=0;return true}               // morreu neste quadro: a queda já está no chão (WW1A.under)
 track(u);
 let wet=u._dw;if(u.x!==u._dx||u.y!==u._dy){u._dx=u.x;u._dy=u.y;wet=u._dw=!!(window.PXW&&PXW.depth(u.x,u.y)>=.25)}   // profundidade só quando anda
 if(u.down||u.rs||u.sh||(u.sap&&(u.sapState==='dig'||u.sapState==='prone'||u.sapState==='fight'||u.sapProne>time))||u.lunge||(u.pv&&u.pv.stun>.05)||wet||u.hp<=0||(soldierPlayer(u)&&window.PXCAS&&PXCAS.playerBusy&&PXCAS.playerBusy())||(soldierPlayer(u)&&window.PXAS&&PXAS.player&&PXAS.player.prone)){
  giveHitBack(u);S.stats.deferred++;return D0(d0,c,u,sp,sx,sy,vis,bob)}
 if(u.pinned&&window.PXAS&&PXAS.on){/* rastejando / deitado sob fogo */
  const v=u.moving?((u._wd/9)|0)&1:2,ps=proneSprite(u.team,dir16(u._fa),v),hr=takeHit(u);let ox=0,oy=0;if(hr>0&&!hitFresh){const k=hr/.16;ox=Math.round((u.hx||0)*1.6*k);oy=Math.round((u.hy||0)*1.6*k)}
  c.drawImage(ps.c,sx+ox-ps.ax,sy+oy-ps.ay+4);if(hr>0){c.globalAlpha=hr>.1?.92:.4;c.drawImage(tint(ps,hr>.1?'#ffffff':'#ff4a3a'),sx+ox-ps.ax,sy+oy-ps.ay+4);c.globalAlpha=1}
  S.stats.crawl++;S.stats.own++;return true}
 const my=choose(u);
 if(!my){giveHitBack(u);S.stats.deferred++;return D0(d0,c,u,sp,sx,sy,vis,bob)}
 const hr=takeHit(u);if(hr>0&&!hitFresh){const k=hr/.16;sx+=Math.round((u.hx||0)*1.6*k);sy+=Math.round((u.hy||0)*1.6*k)}
 const r=D0(d0,c,u,my,sx,sy,vis,bob);
 if(!r)c.drawImage(my.c,0,0,my.c.width,vis,sx-my.ax,sy-my.ay+bob,my.c.width,vis);
 if(hr>0){const ms=u.mask&&window.PXAS&&PXAS.on?PXAS.maskedSprite(my,u.team):my;c.globalAlpha=hr>.1?.92:.4;c.drawImage(tint(ms,hr>.1?'#ffffff':'#ff4a3a'),0,0,ms.c.width,vis,sx-ms.ax,sy-ms.ay+bob,ms.c.width,vis);c.globalAlpha=1}
 S.stats.drawn++;return true}

/* ======================================================================================
   ESTADO E FOLHA DE CONTATOS
   ====================================================================================== */
S.state=()=>({on:S.on,version:S.version,cache:{frames:FC.size,prone:PC.size,tips:TIP.size},falls:FALLS.length,hidden:HIDE.size,casings:CAS.length,
 msPerFrame:+S.stats.ms.toFixed(3),lastRender:+lastR.toFixed(2),stats:{...S.stats}});
S._acc=()=>[acc,accD];S._choose=choose;S._track=track;S._drawFalls=drawFalls;S._hide=HIDE;S.frame=frame;S.prone=proneSprite;S.falls=FALLS;S.P={IDLE:P_IDLE,WALK:P_WALK,RUN:P_RUN,AIM:P_AIM,KAIM:P_KAIM,RL:P_RL,KRL:P_KRL,THR:P_THR,DIE:P_DIE,AMBLE:P_AMBLE,AMBLEF:P_AMBLEF};
/* folha: linhas = pose×subquadro, colunas = 16 direções; escala inteira; devolve dataURL */
S.sheet=(team=0,dirs=[0,2,4,6,8,10,12,14],scale=3,type='rifle')=>{const rows=[];
 for(const[p,n]of[[P_IDLE,4],[P_WALK,8],[P_AMBLE,8],[P_AMBLEF,8],[P_RUN,8],[P_AIM,6],[P_KAIM,6],[P_RL,6],[P_THR,6],[P_DIE,2]])for(let s=0;s<n;s++)rows.push([p,s]);
 const cw=30,ch=30,W=cw*(dirs.length+1),H=ch*rows.length+40*2,cv=mk(W*scale,H*scale),x=g2(cv);x.imageSmoothingEnabled=false;x.fillStyle='#4a5236';x.fillRect(0,0,cv.width,cv.height);
 rows.forEach(([p,s],j)=>{dirs.forEach((d,i)=>{const sp=frame(team,type,d,p,s,true);x.drawImage(sp.c,0,0,30,30,(i*cw)*scale,(j*ch)*scale,30*scale,30*scale);
  /* ponto onde o pixel.js acende o clarão */if(p===P_AIM||p===P_KAIM){const a=d*TAU/16;x.fillStyle='#ff00ff';x.fillRect(Math.round((i*cw+15+Math.cos(a)*14))*scale,Math.round((j*ch+16+Math.sin(a)*14+1))*scale,scale,scale)}})});
 let y=rows.length*ch;for(let v=0;v<3;v++)for(let i=0;i<4;i++){const sp=proneSprite(team,i*4,v);x.drawImage(sp.c,0,0,sp.c.width,sp.c.height,((v*4+i)*36)*scale/1.5|0,y*scale,sp.c.width*scale/1.5|0,sp.c.height*scale/1.5|0)}
 return cv.toDataURL()};
if(window.IronFront)window.IronFront.animInf=S;
})();
