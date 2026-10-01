'use strict';
/* Iron Front — arte das construções de campo (art-forts). Só desenho: não muda regra nenhuma.
   Carrega DEPOIS de fortify.js / medics.js. Troca os sprites dos canteiros do sappers.js (K[kind].sprite), desenha os bunkers
   prontos (buildings com b.kind 'wood' / 'concrete', escondidos do render genérico), os postos de morteiro (PXSAP.customPosts) e
   as antiaéreas (PXFORT.customAA) com guarnição própria.
   Canteiro por estágio: 0 planta (estacas, fita e cal; a grama sai em leivas conforme o trabalho), 1 escavação (a vala aprofunda e
   a terra vira parapeito do lado do inimigo), 2 estrutura (troncos, fôrmas com vergalhão, sacos subindo), 3 pronto.
   Estilo da casa: paleta curta, luz do canto superior esquerdo, contorno seletivo só nos volumes (PX.outlined), sombra para
   baixo-direita, pontilhado e nada de antisserrilhado. Tudo é sprite em cache (canvas fora da tela); por quadro só drawImage e
   poucas peças móveis (cano, tubo, clarão, guarnição). Lado 0 (EUA) atira para leste; o lado 1 (Alemanha) é espelhado.
   ?arteobras=0 desliga · PXARTF.state() · PXARTF.sheet() (prancha de todos os sprites, para revisão). */
(function(){
if(!window.PX||!window.PXSAP||!window.PXFORT||!PX.outlined)return;
const SAP=PXSAP,FORT=PXFORT,K=SAP.cfg.KIND,Z=PX.Z||.5,TAU=Math.PI*2,hyp=Math.hypot,RD=Math.round;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const g2=c=>c.getContext('2d');
const hs=(i,j,s=0)=>(((Math.imul(i|0,73856093)^Math.imul(j|0,19349663)^Math.imul(s|0,83492791))>>>0)%1009)/1009;
const A=window.PXARTF={on:!/[?&]arteobras=0/.test(location.search),stats:{errors:0,sprites:0,ms:0,frames:0}};
let errs=0;
function fail(e){A.stats.errors++;if(++errs<=3)console.error('art-forts.js:',e);if(errs>=12&&A.on){A.on=false;off();console.error('art-forts.js desligado após erros repetidos')}}

/* ---------- paleta ---------- */
const E=['#15110c','#1d1812','#262019','#30281e','#3a3024','#45392a','#524331','#5f4f38','#6d5b40','#7c6a4a','#8c7a58','#9e8c68'];   // terra, do fundo da vala à crista
const WD=['#241a10','#3b2a1c','#553c25','#6b5034','#86683f','#a3824f','#c4a46e'];                                                // madeira
const BG=['#5c5340','#7a6c4c','#958660','#ab9a70','#b9a97e','#d0c293'];                                                          // sacos de areia (mesmos tons do art.js)
const CN=['#2c302a','#3b3f38','#4c5048','#5e6258','#71756a','#83867a','#95988b','#a7a99c','#b9bbad','#cdcfc1'];                    // concreto
const ST=['#1d2023','#2c3034','#3f454b','#5d646b','#7d858c','#aab1b6','#c9cfd2'];                                                // aço
const GR=['#2c3a20','#384a27','#46582f','#556638','#647443','#78874f'];                                                          // grama / leivas
const OL=['#3c4229','#4f5636','#5c6241','#717a50','#8a9361'];                                                                    // caixas oliva
const BR=['#7d5f23','#b8923a','#d9b556','#f0d27a'];                                                                              // latão
const RUST=['#4a2a18','#6e3c22','#8e5330'];
const TAPE='#e2dcb8',LIME='#d8d6c4',INK='#0f0c08',SOOT='#191612';
const face=t=>t?-1:1;

/* ---------- pincel ---------- */
function P(g){const r=(x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(RD(x),RD(y),w,h)};
 return{g,r,d:(x,y,c)=>r(x,y,1,1,c),
  ell:(cx,cy,rx,ry,c)=>{g.fillStyle=c;const n=Math.floor(ry);for(let j=-n;j<=n;j++){const w=Math.floor(rx*Math.sqrt(Math.max(0,1-(j*j)/((ry+.5)*(ry+.5)))));g.fillRect(RD(cx)-w,RD(cy)+j,w*2+1,1)}},
  ln:(x0,y0,x1,y1,c,dash=0,ph=0)=>PX.pline(g,x0,y0,x1,y1,c,dash,ph)}}
/* sprite em camadas: chão (sem contorno) + volumes (contorno seletivo + sombra projetada) + detalhes finais por cima */
function layered(w,h,ground,obj,o={}){const c=mk(w,h),g=g2(c);if(ground)ground(P(g));
 if(obj){const oc=mk(w,h);obj(P(g2(oc)));const ol=PX.outlined(oc,o.ink??.55);
  if(o.sa!==0){const s=PX.silhouette(ol,'#0b1207',o.sa??.34);g.drawImage(s,-1+(o.sx??2),-1+(o.sy??2))}g.drawImage(ol,-1,-1)}
 if(o.top)o.top(P(g));A.stats.sprites++;return c}
const CACHE=new Map();
function cached(k,fn){let v=CACHE.get(k);if(!v){v=fn();CACHE.set(k,v)}return v}
const flipC=c=>PX.flipX(c);

/* ---------- peças básicas ---------- */
/* saco de areia 5×3 (deitado) ou 3×5 (em pé na parede), com amarração; tone 0..2 escurece */
function bag(p,x,y,v=0,tone=0){const b=tone?BG.map(c=>PX.mix(c,'#3a3324',.12*tone)):BG;x=RD(x);y=RD(y);
 if(!v){p.r(x,y,5,3,b[3]);p.r(x+1,y,3,1,b[5]);p.d(x,y,b[4]);p.r(x+4,y,1,3,b[1]);p.r(x,y+2,5,1,b[1]);p.d(x+4,y+2,b[0]);p.d(x+2,y+1,b[4])}
 else{p.r(x,y,3,5,b[3]);p.r(x,y+1,1,3,b[5]);p.d(x,y,b[4]);p.r(x+2,y,1,5,b[1]);p.r(x,y+4,3,1,b[1]);p.d(x+2,y+4,b[0]);p.d(x+1,y+2,b[4])}}
/* saco furado: areia escorrendo */
function bagBurst(p,x,y){bag(p,x,y,0,1);p.r(x+1,y+1,2,1,BG[1]);p.d(x+2,y+3,BG[4]);p.d(x+3,y+3,BG[3]);p.d(x+1,y+4,BG[2])}
/* tronco visto de cima: horizontal (2 px) ou vertical; topo em luz, base em sombra, nós e topo do corte claro */
function hlog(p,x,y,len,s=0){x=RD(x);y=RD(y);p.r(x,y,len,2,WD[3]);p.r(x,y,len,1,WD[5]);for(let i=1;i<len-1;i++){const n=hs(x+i,y,s);if(n<.18)p.d(x+i,y+1,WD[2]);else if(n>.9)p.d(x+i,y,WD[4])}p.d(x,y,WD[6]);p.d(x,y+1,WD[4]);p.d(x+len-1,y,WD[6]);p.d(x+len-1,y+1,WD[4])}
/* tronco de parede (face à sombra): mais escuro, só um fio de luz no topo */
function wlog(p,x,y,len,s=0){x=RD(x);y=RD(y);p.r(x,y,len,2,WD[2]);p.r(x,y,len,1,WD[4]);for(let i=1;i<len-1;i++){const n=hs(x+i,y,s);if(n<.22)p.d(x+i,y+1,WD[1]);else if(n>.88)p.d(x+i,y,WD[3])}p.d(x,y,WD[5]);p.d(x,y+1,WD[3]);p.d(x+len-1,y,WD[5]);p.d(x+len-1,y+1,WD[3])}
function vlog(p,x,y,len,s=0){x=RD(x);y=RD(y);p.r(x,y,2,len,WD[3]);p.r(x,y,1,len,WD[5]);for(let i=1;i<len;i++){if(hs(x,y+i,s)<.2)p.d(x+1,y+i,WD[2])}p.d(x,y,WD[6]);p.d(x+1,y,WD[5])}
/* ponta de viga (corte do tronco) */
function logEnd(p,x,y){p.d(x,y,WD[6]);p.d(x+1,y,WD[5]);p.d(x,y+1,WD[4]);p.d(x+1,y+1,WD[2])}
/* estaca de piquete com cabeça clara */
function stake(p,x,y){p.r(x,y-3,1,4,WD[3]);p.d(x,y-3,WD[6])}
/* pá cravada / deitada, picareta, carrinho */
function shovel(p,x,y,lying){if(lying){p.r(x,y,5,1,WD[4]);p.r(x+5,y-1,2,3,ST[3]);p.d(x+5,y-1,ST[5])}else{p.r(x,y-5,1,5,WD[4]);p.d(x,y-5,WD[6]);p.r(x-1,y,3,2,ST[3]);p.d(x-1,y,ST[5])}}
function pick(p,x,y){p.ln(x,y,x+5,y-3,WD[4]);p.ln(x+3,y-5,x+7,y-2,ST[3]);p.d(x+3,y-5,ST[5])}
function barrow(p,x,y){p.r(x,y,6,4,WD[3]);p.r(x,y,6,1,WD[5]);p.r(x+1,y+1,4,2,E[7]);p.d(x+2,y+1,E[9]);p.r(x+6,y+1,3,1,WD[4]);p.r(x-1,y+3,2,2,ST[2])}
/* pilha de pranchas (n camadas) e de troncos */
function planks(p,x,y,len,n){for(let i=0;i<n;i++){const yy=y-i,xx=x+(i%2);p.r(xx,yy,len,2,WD[4]);p.r(xx,yy,len,1,WD[5]);p.d(xx+len-1,yy,WD[6]);p.r(xx+2,yy+1,1,1,WD[2])}}
function logPile(p,x,y,len,n){for(let i=0;i<n;i++)hlog(p,x+(i%2),y-i*2,len,i+3)}
/* caixas de munição */
function crate(p,x,y,w=5,h=4,ol=0){const c=ol?OL:[WD[1],WD[2],WD[3],WD[4],WD[5]];p.r(x,y,w,h,c[2]);p.r(x,y,w,1,c[4]);p.r(x+w-1,y+1,1,h-1,c[1]);p.r(x,y+h-1,w,1,c[1]);p.r(x+1,y+1,1,h-2,c[3]);if(w>4)p.d(x+(w>>1),y+1,ol?'#c9b56a':c[3])}
/* projéteis em pé (vistos de cima: ogiva + estojo de latão) */
function shells(p,x,y,n,big){for(let i=0;i<n;i++){const xx=x+i*2;p.r(xx,y,2,big?3:2,BR[1]);p.d(xx,y,BR[3]);p.d(xx+1,y+(big?2:1),BR[0])}}
/* monte de terra com luz no alto-esquerdo; pal = tons (escuro→claro) */
function mound(p,cx,cy,rx,ry,seed,pal=E.slice(4),sod=0){for(let y=-ry-1;y<=ry+1;y++)for(let x=-rx-1;x<=rx+1;x++){const dx=x/(rx+.3),dy=y/(ry+.3),n=hs(x+cx*3,y+cy*5,seed),d=dx*dx+dy*dy+(n-.5)*.35;if(d>1)continue;
  const l=(-dx*.55-dy*.85)*(1-d*.3)+(1-d)*.55+(n-.5)*.3;let i=clamp(Math.floor((l+.6)/1.7*pal.length),0,pal.length-1);
  if(sod&&d<.75&&hs(x,y,seed+9)<sod)p.d(cx+x,cy+y,GR[clamp(i-1,1,5)]);else p.d(cx+x,cy+y,pal[i])}}
/* terra revirada no chão (pontilhado) */
function dirt(p,cx,cy,rx,ry,seed,dens=.6,cols=[E[5],E[6],E[7]]){for(let y=-ry;y<=ry;y++)for(let x=-rx;x<=rx;x++){const d=(x*x)/(rx*rx)+(y*y)/(ry*ry);if(d>1)continue;const n=hs(x+cx,y+cy,seed);if(n<dens*(1-d*.6))p.d(cx+x,cy+y,cols[(n*31|0)%cols.length])}}
/* leivas de grama cortadas, empilhadas */
function sods(p,x,y,n){for(let i=0;i<n;i++){const xx=x+(i%3)*3,yy=y-((i/3)|0)*2;p.r(xx,yy,3,2,GR[3]);p.d(xx,yy,GR[5]);p.d(xx+2,yy+1,E[5])}}
/* tufos de capim */
function tufts(p,cx,cy,rx,ry,seed,n){for(let i=0;i<n;i++){const x=RD(cx+(hs(i,1,seed)*2-1)*rx),y=RD(cy+(hs(i,2,seed)*2-1)*ry);p.d(x,y,GR[4]);p.d(x+1,y-1,GR[5]);p.d(x+1,y,GR[2])}}
/* bandeirinha da facção (pano 4×3 num pau de 6 px) */
function pennant(p,x,y,team){p.r(x,y-6,1,7,WD[2]);p.d(x,y-6,WD[5]);
 if(team===0){p.r(x+1,y-6,4,3,'#f4f4f0');p.r(x+1,y-5,4,1,'#b22234');p.r(x+1,y-6,2,2,'#2b3f86');p.d(x+1,y-6,'#f4f4f0')}
 else{p.r(x+1,y-6,4,1,'#1d1d1d');p.r(x+1,y-5,4,1,'#eeeee6');p.r(x+1,y-4,4,1,'#c4271c')}}

/* ---------- formas de canteiro ---------- */
const inRect=(x,y,rx,ry)=>Math.abs(x)<=rx&&Math.abs(y)<=ry&&!(Math.abs(x)===rx&&Math.abs(y)===ry);
const inEll=(x,y,rx,ry)=>(x*x)/((rx+.4)*(rx+.4))+(y*y)/((ry+.4)*(ry+.4))<=1;
/* planta: estacas nos cantos, fita entre elas, linha de cal; com o trabalho a grama sai em leivas e a terra aparece */
function blueprint(p,o,cx,cy,rx,ry,shape,f,seed){const ins=shape==='rect'?inRect:inEll;
 for(let y=-ry;y<=ry;y++)for(let x=-rx;x<=rx;x++){if(!ins(x,y,rx,ry))continue;const n=hs(x,y,seed);
  if(n<f*1.05)p.d(cx+x,cy+y,n<f*.5?E[5]:(x+y)&1?E[6]:E[7]);else if(!ins(x,y,rx-1,ry-1)&&((x+y)&1))p.d(cx+x,cy+y,LIME)}
 if(shape==='rect'){const C=[[-rx-1,-ry-1],[rx+1,-ry-1],[rx+1,ry+1],[-rx-1,ry+1]];for(let i=0;i<4;i++){const a=C[i],b=C[(i+1)%4];p.ln(cx+a[0],cy+a[1]-2,cx+b[0],cy+b[1]-2,TAPE,2,i)}
  if(o)for(const c of C)stake(o,cx+c[0],cy+c[1])}
 else{const N=8,pts=[];for(let i=0;i<N;i++){const a=i/N*TAU;pts.push([RD(cx+Math.cos(a)*(rx+1)),RD(cy+Math.sin(a)*(ry+1))])}
  for(let i=0;i<N;i++){const a=pts[i],b=pts[(i+1)%N];p.ln(a[0],a[1]-2,b[0],b[1]-2,TAPE,2,i)}if(o)for(const q of pts)stake(o,q[0],q[1])}
 if(f>.15)dirt(p,cx+rx+3,cy-ry+2,2,2,seed+2,f);if(f>.45)dirt(p,cx+rx+3,cy+ry-2,2,2,seed+3,f)}
/* escavação: parede norte à vista (3/4), fundo em sombra junto à parede, beiço claro ao sul; dep = profundidade em px */
function pitHole(p,cx,cy,rx,ry,dep,shape,wall){const ins=shape==='rect'?inRect:inEll;
 for(let y=-ry-1;y<=ry+1;y++)for(let x=-rx-1;x<=rx+1;x++){const X=cx+x,Y=cy+y,n=hs(X,Y,7);
  if(!ins(x,y,rx,ry)){if(ins(x,y,rx+1,ry+1))p.d(X,Y,y>0?(n<.5?E[9]:E[10]):x<0?E[8]:E[7]);continue}
  if(!ins(x,y-dep,rx,ry)){let k=0;while(k<dep&&!ins(x,y-k-1,rx,ry))k++;const kk=dep-1-k;                         // kk: 0 = junto à borda
   p.d(X,Y,wall?wall(x,y,kk):kk===0?E[3]:kk===1?(n<.5?E[4]:E[5]):(n<.6?E[5]:E[6]));continue}
  const sh=!ins(x,y-dep-1,rx,ry)||(!ins(x,y-dep-2,rx,ry)&&n<.6),m=hs(X>>1,Y,9);p.d(X,Y,sh?E[2]:n<.12?E[5]:m<.35?E[3]:n<.55?E[4]:E[3])}}   // fundo: terra solta, marcas de pá
/* parapeito de terra (espólio) ao redor: do lado do inimigo (+x) mais alto */
function spoilRing(p,cx,cy,rx,ry,f,seed,front=1){if(f<=0)return;const hR=1.2+f*1.8;
 for(let a=0;a<TAU;a+=.35){const c=Math.cos(a),s=Math.sin(a),w=front*c>.3?1:c*front<-.5?.35:.65;if(w*f<.12)continue;
  mound(p,RD(cx+c*(rx+2.5+hR*w*.6)),RD(cy+s*(ry+2+hR*w*.5)),Math.max(1,RD(hR*w)),Math.max(1,RD(hR*w*.7)),seed+RD(a*10))}}

/* ---------- canteiros por tipo (lado 0; o lado 1 é espelhado) ---------- */
const prog=s=>{const st=s.stage,nd=s.need;if(!nd||st>=nd.length)return 1;const a=st?nd[st-1]:0;return clamp((s.work-a)/((nd[st]-a)||1),0,1)};
const q4=f=>RD(f*4)/4;
function siteKey(kind,s){return kind+'|'+s.team+'|'+s.stage+'|'+q4(prog(s))}
/* empacota: desenha no lado 0 e espelha para o lado 1 */
function sided(key,team,fn){return cached(key+'|'+team,()=>{const c=cached(key+'|0',fn);return team?flipC(c):c})}

/* BUNKER DE MADEIRA (casa de troncos semienterrada, teto de terra, MG na seteira) */
const BK={w:44,h:38,cx:22,cy:18,rx:11,ry:9};
function bunkerSite(st,f){const{w,h,cx,cy,rx,ry}=BK;
 if(st===0)return layered(w,h,p=>blueprint(p,null,cx,cy,rx,ry,'rect',f,11),o=>{for(const c of[[-rx-1,-ry-1],[rx+1,-ry-1],[rx+1,ry+1],[-rx-1,ry+1]])stake(o,cx+c[0],cy+c[1]);
  if(f>.2)shovel(o,cx-rx-4,cy+ry,1);if(f>.4)pick(o,cx+rx-3,cy+ry+3);if(f>.6)logPile(o,cx-rx-10,cy-ry+3,8,2);if(f>.8)sods(o,cx-rx-9,cy+ry-1,4)},{sa:.25,sx:1,sy:1});
 if(st===1)return layered(w,h,p=>{spoilRing(p,cx,cy,rx,ry,.4+f*.6,13);pitHole(p,cx,cy,rx-1+RD(f),ry-2+RD(f),1+RD(f*2),'rect')},
  o=>{logPile(o,cx-rx-9,cy-ry+3,9,2+RD(f*2));planks(o,cx-rx-9,cy+ry,8,2);if(f>.3)shovel(o,cx+2,cy+ry-1);if(f>.6)barrow(o,cx-rx-1,cy+ry+3)},{sa:.28,sx:1,sy:1});
 if(st===2)return layered(w,h,p=>{spoilRing(p,cx,cy,rx,ry,1,13);pitHole(p,cx,cy,rx,ry,3,'rect')},o=>{
  const n=RD(1+f*3);                                                                                                  // fiadas de troncos já assentadas
  for(let i=0;i<n;i++){hlog(o,cx-rx,cy-ry+i*2-2,rx*2+1,i);hlog(o,cx-rx,cy+ry-i*2-1,rx*2+1,i+5)}
  for(let i=0;i<n;i++){vlog(o,cx+rx-1-i*2,cy-ry,ry*2,i+9)}vlog(o,cx-rx,cy-ry,ry*2-5,4);
  const beams=RD(f*6);for(let i=0;i<beams;i++)vlog(o,cx-rx+3+i*3,cy-ry-1,ry*2+2,i+20);
  logPile(o,cx-rx-9,cy-ry+3,9,Math.max(1,3-RD(f*2)));if(f>.5)for(let i=0;i<3;i++)bag(o,cx-rx-8+i*5,cy+ry+2,0,i&1)},{sa:.3});
 return layered(w,h,p=>{dirt(p,cx,cy+1,rx+6,ry+5,17,.75,[E[6],E[7],E[8]]);dirt(p,cx-rx-5,cy+3,4,3,18,.9,[E[4],E[5]])},null)}
function bunkerBody(team,dm){const{w,h,cx,cy}=BK,fc=1;
 return layered(w,h,p=>{
  dirt(p,cx,cy+2,19,13,21,.8,[E[6],E[7],E[8],E[7]]);                                                                    // chão pisoteado
  for(let x=cx-19;x<cx-11;x++)for(let y=cy+1;y<cy+6;y++){const st=((x-cx)&1)===0;p.d(x,y,y===cy+1?E[2]:st?WD[3]:E[2])}   // degraus da entrada (para a retaguarda)
  p.r(cx-19,cy+6,8,1,E[9]);p.r(cx-19,cy,8,1,E[4])},
 o=>{
  /* teto: troncos cobertos de terra e leivas, monte baixo */
  mound(o,cx-1,cy-3,13,8,31,[E[6],E[7],E[8],E[9],E[10]],.5);
  for(let x=cx-12;x<=cx+9;x+=2)logEnd(o,x,cy+4);                                                                       // pontas das vigas do teto
  o.r(cx-12,cy+5,22,1,E[2]);wlog(o,cx-12,cy+6,22,3);wlog(o,cx-12,cy+8,22,4);                                                                     // parede sul de troncos
  for(let i=0;i<5;i++)bag(o,cx-12+i*5-(i>3?1:0),cy+10,0,i%2);                                                          // fiada de sacos na base
  vlog(o,cx-13,cy+4,7,1);vlog(o,cx+9,cy+4,7,2);
  /* frente (leste): parede de troncos em pé, seteira e sacos de proteção */
  for(let y=cy-9;y<=cy+7;y+=4){vlog(o,cx+10,y,4,y);o.r(cx+12,y+1,2,4,WD[2]);o.d(cx+12,y+1,WD[4])}
  for(let i=0;i<3;i++){bag(o,cx+11,cy-10+i*3,0,i&1);bag(o,cx+11,cy+3+i*3,0,(i+1)&1)}
  o.r(cx+11,cy-2,4,4,INK);o.r(cx+11,cy-2,4,1,E[1]);hlog(o,cx+10,cy-4,6,9);hlog(o,cx+10,cy+2,6,8);                      // seteira (vão escuro com verga e peitoril)
  bag(o,cx+4,cy-9,0,0);bag(o,cx+4,cy-6,0,1);bag(o,cx+5,cy+0,0,0);                                                      // reforço de sacos no teto
  /* retaguarda (oeste): porta com moldura e verga */
  o.r(cx-14,cy-1,2,7,INK);vlog(o,cx-15,cy-1,7,6);vlog(o,cx-12,cy-1,7,7);hlog(o,cx-16,cy-2,6,5);
  /* chaminé do fogareiro e periscópio */
  o.r(cx-6,cy-10,2,3,ST[2]);o.d(cx-6,cy-10,ST[4]);o.d(cx-5,cy-10,INK);o.r(cx+2,cy-8,1,2,ST[3]);o.d(cx+2,cy-8,'#7f9ba3');
  pennant(o,cx-10,cy-6,team)},
 {sa:.36,top:p=>{tufts(p,cx-2,cy-4,10,5,33,9);if(dm)woodDamage(p,dm)}})}
/* dano no bunker de madeira: troncos partidos, sacos rasgados, terra arrancada do teto, buraco e fuligem */
function woodDamage(p,dm){const{cx,cy}=BK;
 p.r(cx-4,cy+6,3,2,E[1]);p.d(cx-5,cy+6,WD[6]);p.d(cx-1,cy+7,WD[6]);bagBurst(p,cx+3,cy+10);p.r(cx+11,cy-10,5,3,E[3]);p.d(cx+12,cy-9,BG[2]);
 dirt(p,cx+1,cy-5,3,2,41,.9,[E[4],E[5],E[3]]);for(const[x,y]of[[cx+16,cy+9],[cx-8,cy+13],[cx+8,cy+14]]){p.r(x,y,2,1,WD[4]);p.d(x,y,WD[6])}
 if(dm<2)return;
 p.ell(cx-2,cy-3,5,3,SOOT);p.ell(cx-2,cy-3,4,2,INK);p.ln(cx-7,cy-5,cx+2,cy-1,WD[4]);p.ln(cx-5,cy-1,cx+1,cy-6,WD[3]);p.d(cx+2,cy-1,WD[6]);p.d(cx-7,cy-5,WD[6]);
 for(let i=0;i<40;i++){const x=RD(cx+(hs(i,3,5)-.5)*30),y=RD(cy+(hs(i,4,5)-.5)*20);if((x+y)&1)p.d(x,y,hs(i,6,5)<.5?SOOT:'#2a241c')}
 p.r(cx-12,cy+6,4,2,E[1]);p.d(cx-9,cy+8,WD[6]);bagBurst(p,cx-7,cy+10);p.r(cx+12,cy+4,3,4,E[2]);
 for(const[x,y]of[[cx-16,cy+11],[cx+17,cy-5],[cx+1,cy+14],[cx-3,cy+15]]){p.r(x,y,3,1,WD[3]);p.d(x,y,WD[6]);p.d(x+1,y+1,E[4])}}

/* CASAMATA DE CONCRETO (bloco escalonado com marcas da fôrma, seteira chanfrada à frente, entrada na retaguarda) */
const PB={w:48,h:40,cx:24,cy:19,rx:12,ry:10};
function pillSite(st,f){const{w,h,cx,cy,rx,ry}=PB;
 if(st===0)return layered(w,h,p=>blueprint(p,null,cx,cy,rx,ry,'rect',f,51),o=>{for(const c of[[-rx-1,-ry-1],[rx+1,-ry-1],[rx+1,ry+1],[-rx-1,ry+1]])stake(o,cx+c[0],cy+c[1]);
  if(f>.25)shovel(o,cx+rx+3,cy+ry);if(f>.5)cementBags(o,cx-rx-10,cy-ry+4,3);if(f>.75)rebar(o,cx-rx-11,cy+ry-2,9)},{sa:.25,sx:1,sy:1});
 if(st===1)return layered(w,h,p=>{spoilRing(p,cx,cy,rx,ry,.4+f*.6,53);pitHole(p,cx,cy,rx-1+RD(f),ry-1,1+RD(f*2.5),'rect');gravel(p,cx-rx-8,cy+ry-3,4,3)},
  o=>{cementBags(o,cx-rx-10,cy-ry+3,3+RD(f*3));rebar(o,cx-rx-11,cy+ry+2,9);if(f>.4)shovel(o,cx+rx-2,cy+ry);if(f>.6)barrow(o,cx-3,cy+ry+3)},{sa:.28,sx:1,sy:1});
 if(st===2)return layered(w,h,p=>{spoilRing(p,cx,cy,rx,ry,1,53);pitHole(p,cx,cy,rx,ry,3,'rect');gravel(p,cx-rx-8,cy+ry-3,4,3)},o=>{
  /* fôrma de pranchas com a malha de vergalhões; o concreto sobe de oeste para leste */
  for(let x=-rx;x<=rx;x++){o.r(cx+x,cy-ry,1,2,(x&3)?WD[4]:WD[2]);o.r(cx+x,cy+ry-1,1,3,(x&3)?WD[3]:WD[2])}o.r(cx-rx,cy-ry,rx*2+1,1,WD[5]);o.r(cx-rx,cy+ry+1,rx*2+1,1,WD[2]);
  for(let y=-ry;y<=ry;y++){o.r(cx-rx,cy+y,2,1,(y&3)?WD[4]:WD[2]);o.r(cx+rx-1,cy+y,2,1,(y&3)?WD[3]:WD[2])}
  const fill=RD((rx*2-3)*f);for(let y=-ry+2;y<=ry-2;y++)for(let x=-rx+2;x<=rx-2;x++){const X=cx+x,Y=cy+y;
   if(x+rx-2<fill)o.d(X,Y,hs(X,Y,5)<.15?CN[5]:(x===-rx+2||y===-ry+2)?CN[7]:CN[6]);else o.d(X,Y,((x&3)===0||(y&3)===0)?RUST[(x+y)&1?1:2]:E[2])}
  o.r(cx+rx-3,cy-3,2,4,WD[1]);                                                                                     // caixa da seteira na fôrma
  cementBags(o,cx-rx-10,cy-ry+3,Math.max(1,4-RD(f*3)));mixer(o,cx-rx-10,cy+ry-4);for(let i=0;i<4;i++)o.ln(cx+rx-3-i,cy-ry-4,cx+rx+1-i,cy-ry+1,ST[3])},{sa:.3});
 return layered(w,h,p=>{dirt(p,cx,cy+1,rx+7,ry+5,57,.7,[E[6],E[7],E[8]]);gravel(p,cx-rx-6,cy+ry,3,2)},null)}
function cementBags(o,x,y,n){for(let i=0;i<n;i++){const xx=x+(i%3)*4,yy=y-((i/3)|0)*2;o.r(xx,yy,4,3,'#c9c6b6');o.r(xx,yy,4,1,'#e2dfd0');o.r(xx+3,yy,1,3,'#9d9a8b');o.d(xx+1,yy+1,'#8f8b7a')}}
function rebar(o,x,y,len){for(let i=0;i<3;i++)o.r(x,y+i,len,1,RUST[i%2+1]);o.d(x+len-1,y,RUST[0])}
function gravel(p,cx,cy,rx,ry){for(let y=-ry;y<=ry;y++)for(let x=-rx;x<=rx;x++){if(x*x/(rx*rx)+y*y/(ry*ry)>1)continue;const n=hs(x+cx,y+cy,8);p.d(cx+x,cy+y,n<.3?CN[3]:n<.6?CN[5]:n<.85?CN[6]:CN[7])}}
function mixer(o,x,y){o.r(x,y,7,4,WD[2]);o.r(x+1,y+1,5,2,CN[5]);o.d(x+2,y+1,CN[7]);o.r(x,y,7,1,WD[4]);o.r(x+7,y+1,2,1,WD[4]);o.r(x+2,y+5,2,2,ST[2])}
function pillBody(team,dm){const{w,h,cx,cy}=PB;
 return layered(w,h,p=>{
  dirt(p,cx,cy+2,21,14,61,.8,[E[6],E[7],E[8],E[7]]);
  for(let x=cx-22;x<cx-16;x++)for(let y=cy+2;y<cy+7;y++){p.d(x,y,y===cy+2?E[2]:((x-cx)&1)?CN[3]:E[2])}p.r(cx-22,cy+7,6,1,E[9])},
 o=>{
  /* terra encostada nas paredes norte e leste (camuflagem e proteção) */
  mound(o,cx-1,cy-11,14,3,63,[E[6],E[7],E[8],E[9]],.55);mound(o,cx+13,cy-2,3,9,64,[E[6],E[7],E[8],E[9]],.4);
  const x0=cx-13,x1=cx+11,y0=cy-10,y1=cy+3,cut=(x,y,ya,yb)=>{const dx=Math.min(x-x0,x1-x),dy=Math.min(y-ya,yb-y);return dx+dy<2};
  /* laje do teto: aresta de luz no noroeste, sombra a leste, manchas de intempérie e musgo junto à terra */
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){if(cut(x,y,y0,y1+6))continue;const n=hs(x,y,3);let c=CN[6];
   if(y===y0||x===x0)c=CN[8];else if(y===y0+1||x===x0+1)c=CN[7];else if(x===x1)c=CN[4];else if(x===x1-1)c=CN[5];else if(y===y1)c=CN[7];
   else if(n<.07)c=CN[5];else if(n>.95)c=CN[7];else if((y-y0)%3===0&&hs(x>>2,y,4)<.5)c=CN[5];
   if(y<y0+3&&hs(x,y,5)<.22)c=y===y0?GR[3]:E[7];o.d(x,y,c)}
  /* parede sul à vista: tábuas da fôrma impressas, furos dos tirantes, escorrido de chuva */
  for(let y=y1+1;y<=y1+6;y++)for(let x=x0;x<=x1;x++){if(cut(x,y,y0,y1+6))continue;const r=y-y1,n=hs(x,y,6);let c=r===1?CN[5]:r===6?CN[1]:CN[3];
   if(r>1&&r<6&&(r&1)===0&&n<.75)c=CN[2];if(r===3&&(x-x0)%6===3)c=CN[0];if(r>1&&r<6&&hs(x,0,7)<.14&&(y&1))c=CN[4];if(x===x1||x===x1-1&&r>1)c=CN[2];o.d(x,y,c)}
  /* laje superior escalonada (segundo degrau de concreto) com sombra projetada */
  const sx0=cx-10,sx1=cx+4,sy0=cy-8,sy1=cy-2;
  for(let y=sy0;y<=sy1+2;y++)for(let x=sx0;x<=sx1;x++){let c;if(y>sy1)c=y===sy1+1?CN[4]:CN[3];else{c=CN[7];if(y===sy0||x===sx0)c=CN[9];else if(x===sx1)c=CN[5];else if(hs(x,y,9)<.06)c=CN[6]}o.d(x,y,c)}
  for(let y=sy0+1;y<=sy1+3;y++)o.d(sx1+1,y,CN[4]);o.r(sx0+1,sy1+3,sx1-sx0+1,1,CN[5]);
  /* seteira chanfrada a leste, sob uma pala de concreto */
  o.r(x1-4,cy-6,7,1,CN[9]);o.r(x1-4,cy-5,7,1,CN[1]);o.r(x1-4,cy-4,6,4,CN[3]);o.r(x1-3,cy-4,5,3,CN[1]);o.r(x1-2,cy-3,5,2,INK);o.r(x1-4,cy,6,1,CN[6]);o.r(x1+1,cy-6,2,7,CN[4]);o.r(x1+1,cy-4,2,3,INK);
  /* entrada na retaguarda: alpendre baixo, porta de aço entreaberta */
  o.r(cx-17,cy-4,4,6,CN[6]);o.r(cx-17,cy-4,4,1,CN[8]);o.r(cx-17,cy-4,1,6,CN[8]);o.r(cx-17,cy+2,4,5,CN[3]);o.r(cx-17,cy+2,4,1,CN[5]);o.r(cx-16,cy+3,2,4,INK);o.r(cx-18,cy+3,1,4,ST[3]);o.d(cx-18,cy+3,ST[5]);
  /* respiro, cúpula do periscópio */
  o.r(cx-7,cy-9,2,2,ST[2]);o.d(cx-7,cy-9,ST[4]);o.ell(cx,cy-5,2,1,CN[4]);o.r(cx-1,cy-5,2,1,ST[1]);o.d(cx-2,cy-6,CN[9]);
  pennant(o,cx-15,cy-5,team)},
 {sa:.42,top:p=>{tufts(p,cx+1,cy-11,11,2,65,8);tufts(p,cx+13,cy-1,2,7,66,4);if(dm)concreteDamage(p,dm)}})}
function concreteDamage(p,dm){const{cx,cy}=PB;const crack=(x,y,n,s)=>{for(let i=0;i<n;i++){p.d(x,y,CN[1]);x+=hs(i,s,1)<.5?1:0;y+=hs(i,s,2)<.6?1:-0;if(hs(i,s,3)<.3)x--}};
 crack(cx-6,cy-10,6,1);crack(cx+7,cy-8,7,2);crack(cx-1,cy+4,5,3);p.r(cx+10,cy-6,2,2,CN[2]);p.d(cx+10,cy-6,E[3]);p.r(cx-13,cy-10,2,2,E[6]);
 for(const[x,y]of[[cx+16,cy+7],[cx-9,cy+12],[cx+6,cy+12]]){p.r(x,y,2,2,CN[5]);p.d(x,y,CN[8]);p.d(x+1,y+1,CN[3])}
 if(dm<2)return;
 p.ell(cx-1,cy-4,6,3,CN[2]);p.ell(cx-1,cy-4,5,2,INK);for(const i of[-3,0,3])p.ln(cx-1+i,cy-6,cx+i+(i>0?1:0),cy-2,RUST[1]);p.ln(cx-5,cy-4,cx+3,cy-3,RUST[0]);p.d(cx-4,cy-6,RUST[2]);p.d(cx+2,cy-6,RUST[2]);
 for(let i=0;i<46;i++){const x=RD(cx+(hs(i,3,7)-.5)*32),y=RD(cy-3+(hs(i,4,7)-.5)*18);if((x+y)&1)p.d(x,y,hs(i,6,7)<.5?SOOT:'#3a3631')}
 crack(cx-12,cy+5,6,4);p.r(cx+11,cy-4,4,4,INK);p.r(cx+12,cy+3,3,3,CN[1]);
 for(const[x,y]of[[cx-18,cy+10],[cx+18,cy-6],[cx+2,cy+13],[cx-4,cy+14],[cx+15,cy+11]]){p.r(x,y,3,2,CN[5]);p.r(x,y,3,1,CN[7]);p.d(x+2,y+1,CN[2])}}

/* ruínas (bunker que caiu): monte afundado, vigas/lajes partidas, fuligem */
function ruinSprite(kind){const conc=kind==='concrete',W0=conc?48:44,H0=conc?40:38,cx=W0>>1,cy=H0>>1;
 return layered(W0,H0,p=>{dirt(p,cx,cy,18,12,71,.85,[E[3],E[4],E[5],SOOT]);p.ell(cx,cy,7,4,E[1]);p.ell(cx-1,cy-1,5,3,INK)},o=>{
  if(conc){for(let i=0;i<9;i++){const x=RD(cx+(hs(i,1,9)-.5)*28),y=RD(cy+(hs(i,2,9)-.5)*18),w=3+(hs(i,3,9)*5|0),h=2+(hs(i,4,9)*3|0);if(Math.abs(x-cx)<5&&Math.abs(y-cy)<3)continue;
   o.r(x,y,w,h,CN[5]);o.r(x,y,w,1,CN[8]);o.r(x+w-1,y,1,h,CN[3]);if(i%3===0)o.ln(x+1,y-2,x+w,y+1,RUST[2])}}
  else{for(let i=0;i<7;i++){const a=hs(i,1,10)*Math.PI,l=6+hs(i,2,10)*8,x=cx+(hs(i,3,10)-.5)*24,y=cy+(hs(i,4,10)-.5)*14;o.ln(x,y,x+Math.cos(a)*l,y+Math.sin(a)*l*.6,WD[3]);o.ln(x,y-1,x+Math.cos(a)*l,y-1+Math.sin(a)*l*.6,WD[5]);o.d(x,y-1,WD[6])}
   for(let i=0;i<4;i++)bagBurst(o,cx-14+i*8,cy+7+(i&1)*2)}},{sa:.3,top:p=>{for(let i=0;i<10;i++){const x=RD(cx+(hs(i,5,11)-.5)*30),y=RD(cy+(hs(i,6,11)-.5)*20);p.d(x,y,E[2])}}})}

/* ABRIGO SUBTERRÂNEO: degraus descendo para o escuro sob verga de madeira, monte de terra e sacos por cima, cortina de gás */
const DG={w:36,h:30,cx:18,cy:15,rx:7,ry:6};
function dugSite(st,f){const{w,h,cx,cy,rx,ry}=DG;
 if(st===0)return layered(w,h,p=>blueprint(p,null,cx,cy,rx,ry,'rect',f,81),o=>{for(const c of[[-rx-1,-ry-1],[rx+1,-ry-1],[rx+1,ry+1],[-rx-1,ry+1]])stake(o,cx+c[0],cy+c[1]);if(f>.3)shovel(o,cx+rx+3,cy+ry);if(f>.6)planks(o,cx-rx-9,cy+ry,7,2)},{sa:.25,sx:1,sy:1});
 if(st===1){const d=1+RD(f*3);return layered(w,h,p=>{spoilRing(p,cx,cy,rx,ry,.5+f*.5,83);pitHole(p,cx,cy,rx,ry-1,d,'rect');
   for(let i=0;i<RD(f*4);i++)p.r(cx-rx+1+i*2,cy-ry+d+1,1,ry*2-d-1,E[5])},                                         // degraus começando no lado da retaguarda
  o=>{planks(o,cx-rx-9,cy+ry+1,8,2+RD(f*2));logPile(o,cx-rx-9,cy-ry+2,8,2);if(f>.4)shovel(o,cx+rx-1,cy+ry+1)},{sa:.28,sx:1,sy:1})}
 return dugBody()}
function dugBody(){const{w,h,cx,cy}=DG;return cached('dugBody',()=>layered(w,h,p=>{
  dirt(p,cx,cy+1,16,11,85,.7,[E[6],E[7],E[8]]);
  /* poço da escada para a retaguarda: degraus escurecendo até a porta */
  for(let x=cx-15;x<=cx-4;x++)for(let y=cy-1;y<=cy+5;y++){const k=(x-(cx-15))/11,edge=y===cy-1||y===cy+5;let c=edge?(y===cy+5?E[9]:E[4]):((x-cx)&1)===0?E[clamp(7-RD(k*6),1,7)]:E[clamp(5-RD(k*5),0,5)];p.d(x,y,c)}
  for(let x=cx-15;x<=cx-4;x+=4){p.d(x,cy,WD[4]);p.d(x,cy+4,WD[4])}},o=>{
  /* monte do abrigo: terra, leivas e sacos */
  mound(o,cx+3,cy-1,11,8,87,[E[6],E[7],E[8],E[9],E[10]],.55);
  for(let i=0;i<4;i++)bag(o,cx-1+i*5,cy-9+(i&1),0,i&1);for(let i=0;i<3;i++)bag(o,cx+1+i*5,cy-6+((i+1)&1),0,(i+1)&1);bag(o,cx+13,cy-2,1,0);bag(o,cx+13,cy+3,1,1);
  /* porta: moldura de troncos (dois esteios e verga), vão negro */
  o.r(cx-4,cy-1,4,7,INK);o.r(cx-4,cy-1,4,1,E[1]);vlog(o,cx-6,cy-2,9,1);vlog(o,cx,cy-2,9,2);hlog(o,cx-7,cy-3,9,3);
  /* cortina de gás enrolada na verga (cobertor com corda) */
  o.r(cx-5,cy-5,6,2,'#6e6550');o.r(cx-5,cy-5,6,1,'#8f866c');o.d(cx-3,cy-5,'#c9c0a0');o.d(cx-3,cy-4,'#c9c0a0');o.r(cx-5,cy+1,1,3,'#5e5644');
  /* chaminé e sino de alarme de gás */
  o.r(cx+7,cy-6,2,3,ST[2]);o.d(cx+7,cy-6,ST[4]);o.d(cx+8,cy-6,INK);o.r(cx-9,cy-5,1,4,WD[2]);o.r(cx-10,cy-6,3,2,BR[1]);o.d(cx-10,cy-6,BR[3])},
 {sa:.34,top:p=>{tufts(p,cx+4,cy-1,9,5,89,8);p.d(cx-2,cy+2,'#3a2f22');p.d(cx-3,cy+3,'#2a2219')}}))}

/* NINHO DE METRALHADORA: ferradura de sacos aberta para a retaguarda, banqueta de tiro, caixas, lata d'água */
const NS={w:34,h:32,cx:17,cy:16,rx:6,ry:5};
function bagRing(o,cx,cy,rx,ry,{gap=Math.PI,gw=1.1,frac=1,course2=true,seed=0}={}){const L=[];
 const N=Math.max(8,RD(TAU*Math.max(rx,ry)/4.2));
 for(let i=0;i<N;i++){const a=i/N*TAU,da=Math.abs(((a-gap+Math.PI*3)%TAU)-Math.PI);if(da<gw/2)continue;L.push({a,da,x:cx+Math.cos(a)*rx,y:cy+Math.sin(a)*ry,v:Math.abs(Math.cos(a))>.7})}
 L.sort((p,q)=>q.da-p.da);const n=RD(L.length*frac),use=L.slice(0,n).sort((p,q)=>p.y-q.y);
 const tn=a=>{const l=Math.cos(a)*.55+Math.sin(a)*.85;return l>.45?2:l>-.35?1:0};                              // luz do noroeste: sacos do sudeste em sombra
 for(const b of use)bag(o,b.x-(b.v?1:2),b.y-(b.v?2:1),b.v?1:0,Math.min(2,tn(b.a)+(hs(RD(b.a*9),seed,3)<.25?1:0)));
 if(course2&&frac>=1)for(const b of use){const a=b.a+TAU/N/2;if(b.da<gw/2+.5||Math.cos(a)<-.1)continue;const x=cx+Math.cos(a)*(rx-.5),y=cy+Math.sin(a)*(ry-.5)-2;bag(o,x-(b.v?1:2),y-(b.v?2:1),b.v?1:0,Math.max(0,tn(a)-1))}}
function nestSite(st,f){const{w,h,cx,cy,rx,ry}=NS;
 if(st===0)return layered(w,h,p=>blueprint(p,null,cx,cy,rx,ry,'ell',f,91),o=>{for(let i=0;i<8;i++){const a=i/8*TAU;stake(o,RD(cx+Math.cos(a)*(rx+1)),RD(cy+Math.sin(a)*(ry+1)))}if(f>.4)shovel(o,cx-rx-4,cy+ry+2,1)},{sa:.25,sx:1,sy:1});
 if(st===1)return layered(w,h,p=>{spoilRing(p,cx,cy,rx,ry,.4+f*.6,93);pitHole(p,cx,cy,rx-1+RD(f),ry-1+RD(f),1+RD(f*2),'ell')},o=>{emptySacks(o,cx-rx-9,cy+ry,3+RD(f*2));if(f>.5)shovel(o,cx+rx+4,cy+ry+2)},{sa:.28,sx:1,sy:1});
 if(st===2)return layered(w,h,p=>{spoilRing(p,cx,cy,rx+1,ry+1,.7,93);pitHole(p,cx,cy,rx,ry,2,'ell')},o=>{bagRing(o,cx,cy,rx+4,ry+4,{frac:.25+f*.7,course2:false,seed:1});emptySacks(o,cx-rx-10,cy+ry+1,Math.max(1,4-RD(f*3)))},{sa:.3});
 return layered(w,h,p=>{dirt(p,cx,cy,rx+8,ry+8,95,.45,[E[6],E[7],E[5]]);pitHole(p,cx,cy,rx,ry,2,'ell');
   p.r(cx+rx-3,cy-2,3,5,WD[3]);p.r(cx+rx-3,cy-2,3,1,WD[5]);p.r(cx+rx-1,cy-1,1,4,WD[2]);                             // banqueta de tiro (prancha)
   for(let i=0;i<5;i++)p.d(cx-2+(hs(i,1,97)*6|0),cy+(hs(i,2,97)*4|0)-1,BR[i&1?1:2])},                                // cápsulas
  o=>{bagRing(o,cx,cy,rx+4,ry+4,{seed:1});
   crate(o,cx-rx+1,cy+ry-2,5,3,1);crate(o,cx-rx+1,cy+ry-5,5,3,1);o.d(cx-rx+3,cy+ry-4,BR[2]);                            // caixas de fita
   o.r(cx-rx+2,cy-ry+1,3,4,'#55603e');o.r(cx-rx+2,cy-ry+1,3,1,'#7c8a58');o.d(cx-rx+3,cy-ry,ST[3]);o.ln(cx-rx+4,cy-ry+3,cx-rx+7,cy-ry+5,'#2d2f28')},   // lata d'água com mangueira
  {sa:.34})}
function emptySacks(o,x,y,n){for(let i=0;i<n;i++){const xx=x+(i%3)*3,yy=y-((i/3)|0)*2;o.r(xx,yy,4,2,BG[2]);o.r(xx,yy,4,1,BG[4]);o.d(xx+3,yy+1,BG[1])}}

/* POÇO DE MORTEIRO: poço redondo com anel de sacos; caixas de granadas na retaguarda (tubo e guarnição são dinâmicos) */
const MO={w:40,h:36,cx:20,cy:18,rx:7,ry:6};
function mortarSite(st,f){const{w,h,cx,cy,rx,ry}=MO;
 if(st===0)return layered(w,h,p=>blueprint(p,null,cx,cy,rx,ry,'ell',f,101),o=>{for(let i=0;i<8;i++){const a=i/8*TAU;stake(o,RD(cx+Math.cos(a)*(rx+1)),RD(cy+Math.sin(a)*(ry+1)))}if(f>.4)pick(o,cx+rx+2,cy+ry+3)},{sa:.25,sx:1,sy:1});
 if(st===1)return layered(w,h,p=>{spoilRing(p,cx,cy,rx,ry,.4+f*.6,103);pitHole(p,cx,cy,rx-1+RD(f),ry-1+RD(f),1+RD(f*2),'ell')},o=>{emptySacks(o,cx-rx-9,cy+ry+1,3);if(f>.5)shovel(o,cx+rx+4,cy+ry+2)},{sa:.28,sx:1,sy:1});
 if(st===2)return layered(w,h,p=>{spoilRing(p,cx,cy,rx+1,ry+1,.7,103);pitHole(p,cx,cy,rx,ry,2,'ell')},o=>{bagRing(o,cx,cy,rx+4,ry+4,{gap:Math.PI,gw:.9,frac:.2+f*.75,course2:false,seed:2});emptySacks(o,cx-rx-10,cy+ry+1,Math.max(1,4-RD(f*3)))},{sa:.3});
 return layered(w,h,p=>{dirt(p,cx,cy,rx+8,ry+8,105,.45,[E[6],E[7],E[5]]);pitHole(p,cx,cy,rx,ry,2,'ell');
   p.ell(cx,cy+1,3,1,E[4]);p.d(cx-2,cy+1,E[6])},                                                                      // marca da placa-base
  o=>{bagRing(o,cx,cy,rx+4,ry+4,{gap:Math.PI,gw:.9,seed:2});
   crate(o,cx-rx-6,cy-ry-6,5,4);crate(o,cx-rx-1,cy-ry-7,5,4,1);o.r(cx-rx,cy-ry-6,3,1,'#c9b56a');
   for(let i=0;i<4;i++){const X=cx+2+i*2,Y=cy+ry+5;o.r(X,Y,1,3,ST[3]);o.d(X,Y,ST[5]);o.d(X,Y+3,OL[1])}},   // granadas de reserva com aletas
  {sa:.34})}

/* ANTIAÉREA: plataforma de pranchas num anel de sacos, nichos de munição (o reparo e a guarnição são dinâmicos) */
const AA={w:38,h:34,cx:19,cy:17,rx:8,ry:7};
function aaSite(st,f){const{w,h,cx,cy,rx,ry}=AA;
 if(st===0)return layered(w,h,p=>blueprint(p,null,cx,cy,rx,ry,'ell',f,111),o=>{for(let i=0;i<8;i++){const a=i/8*TAU;stake(o,RD(cx+Math.cos(a)*(rx+1)),RD(cy+Math.sin(a)*(ry+1)))}if(f>.5)planks(o,cx-rx-9,cy+ry+2,8,2)},{sa:.25,sx:1,sy:1});
 if(st===1)return layered(w,h,p=>{spoilRing(p,cx,cy,rx,ry,.4+f*.6,113);pitHole(p,cx,cy,rx-1+RD(f),ry-1+RD(f),1+RD(f*1.5),'ell')},o=>{planks(o,cx-rx-9,cy+ry+2,8,3);if(f>.5)shovel(o,cx+rx+4,cy+ry+2)},{sa:.28,sx:1,sy:1});
 const deck=p=>{for(let y=-ry+1;y<=ry-1;y++)for(let x=-rx+1;x<=rx-1;x++){if(!inEll(x,y,rx-1,ry-1))continue;const X=cx+x,Y=cy+y;p.d(X,Y,(y&1)?((x+(y>>1)*3)%7===0?WD[1]:WD[3]):hs(X,Y,3)<.2?WD[3]:WD[4])}};
 if(st===2)return layered(w,h,p=>{spoilRing(p,cx,cy,rx+1,ry+1,.7,113);pitHole(p,cx,cy,rx,ry,2,'ell')},o=>{const n=RD(f*(ry*2-1));for(let y=-ry+1;y<-ry+1+n;y++)for(let x=-rx+1;x<=rx-1;x++)if(inEll(x,y,rx-1,ry-1))o.d(cx+x,cy+y,(y&1)?WD[3]:WD[4]);
   bagRing(o,cx,cy,rx+4,ry+4,{gap:Math.PI,gw:.7,frac:f*.8,course2:false,seed:3})},{sa:.3});
 return layered(w,h,p=>{dirt(p,cx,cy,rx+9,ry+8,115,.45,[E[6],E[7],E[5]]);pitHole(p,cx,cy,rx,ry,1,'ell');deck(p);
   for(let i=0;i<6;i++){const a=hs(i,1,117)*TAU;p.r(RD(cx+Math.cos(a)*(rx-2)),RD(cy+Math.sin(a)*(ry-2)),2,1,BR[(i&1)+1])}},  // estojos vazios no estrado
  o=>{bagRing(o,cx,cy,rx+4,ry+4,{gap:Math.PI,gw:.7,seed:3});
   crate(o,cx-rx-8,cy-4,5,4);shells(o,cx-rx-7,cy-4,2,1);crate(o,cx-rx-8,cy+1,5,4,1);crate(o,cx+rx+1,cy+ry+1,5,3)},{sa:.34})}

/* POÇO DE ARTILHARIA: ferradura de sacos e terra aberta para a retaguarda, nichos de munição, beira da rede de camuflagem.
   No estágio 3 o centro fica VAZIO: o battery.js desenha a peça antes deste sprite; o chão do poço vai num passe anterior (pitFloor) */
const GP={f:{w:58,h:40,cx:29,cy:20,rx:19,ry:10},h:{w:66,h:46,cx:33,cy:23,rx:23,ry:12}};
function gunSite(k,st,f){const G=GP[k],{w,h,cx,cy,rx,ry}=G;
 if(st===0)return layered(w,h,p=>blueprint(p,null,cx,cy,rx-4,ry-1,'ell',f,121),o=>{for(let i=0;i<10;i++){const a=i/10*TAU;stake(o,RD(cx+Math.cos(a)*(rx-3)),RD(cy+Math.sin(a)*ry))}if(f>.3)shovel(o,cx-rx,cy+ry+3,1);if(f>.6)planks(o,cx-rx-2,cy-ry-1,10,2)},{sa:.25,sx:1,sy:1});
 if(st===1)return layered(w,h,p=>{spoilRing(p,cx,cy,rx-4,ry-1,.4+f*.6,123);pitHole(p,cx,cy,rx-5+RD(f*2),ry-2+RD(f),1+RD(f*1.5),'ell')},o=>{planks(o,cx-rx-2,cy-ry,10,2+RD(f));if(f>.4)barrow(o,cx-rx,cy+ry+2);if(f>.6)shovel(o,cx+rx-6,cy+ry+3)},{sa:.28,sx:1,sy:1});
 if(st===2)return layered(w,h,p=>{pitFloorDraw(p,G,true)},o=>{gunRing(o,G,.25+f*.7);planks(o,cx-rx-2,cy-ry,10,Math.max(1,3-RD(f*2)))},{sa:.3});
 return layered(w,h,null,o=>{gunRing(o,G,1);for(const sx of[-1,1]){const x=cx-rx*.62,y=cy+sx*(ry-1);crate(o,RD(x)-3,RD(y)+(sx>0?0:-3),5,4);shells(o,RD(x)+3,RD(y)+(sx>0?1:-2),2,1)}},
  {sa:.34,top:p=>camoEdge(p,G)})}
/* chão do poço: terra batida e escura, estrado de pranchas sob as rodas, sulcos da conteira */
function pitFloorDraw(p,G,withDeck){const{cx,cy,rx,ry}=G,irx=rx-2,iry=ry-1;
 for(let y=-iry;y<=iry;y++)for(let x=-irx;x<=irx;x++){if(!inEll(x,y,irx,iry))continue;const X=cx+x,Y=cy+y,n=hs(X,Y,131),edge=!inEll(x,y-1,irx,iry)||!inEll(x,y-2,irx,iry);p.d(X,Y,edge?E[2]:n<.25?E[4]:n<.8?E[5]:E[6])}
 for(let x=-irx+3;x<=irx-3;x++)for(const yy of[-iry+2,iry-2])if(hs(x,yy,133)<.85)p.d(cx+x,cy+yy,(x&1)?WD[3]:WD[4]);    // pranchas sob as rodas
 for(let x=-irx;x<-3;x++){p.d(cx+x,cy-1,E[3]);p.d(cx+x,cy+1,E[3])}                                                     // sulcos da conteira
 if(withDeck)for(let y=-3;y<=3;y++)p.r(cx-6,cy+y,13,1,(y&1)?WD[3]:WD[4])}
function gunRing(o,G,frac){const{cx,cy,rx,ry}=G;
 /* berma de terra por fora e sacos por dentro, aberta para trás (oeste) */
 if(frac>=1)for(let a=-2.3;a<=2.3;a+=.28)mound(o,RD(cx+Math.cos(a)*(rx+4)),RD(cy+Math.sin(a)*(ry+3.5)),3,2,RD(a*10)+140,[E[6],E[7],E[8],E[9]],.45);
 bagRing(o,cx,cy,rx+1,ry+1,{gap:Math.PI,gw:1.5,frac,course2:frac>=1,seed:4})}
function camoEdge(p,G){const{cx,cy,rx,ry}=G;for(let a=-1.9;a<=1.9;a+=.06){const r=1+hs(RD(a*50),1,141)*.12,x=RD(cx+Math.cos(a)*(rx+5)*r),y=RD(cy+Math.sin(a)*(ry+4.5)*r);
  const n=hs(RD(a*50),2,141);if(n<.55)p.d(x,y,n<.25?'#3e4a2a':'#2f3a22');if(n>.8)p.d(x+1,y+1,'#566238')}
 for(const a of[-1.7,-.6,.6,1.7]){const x=RD(cx+Math.cos(a)*(rx+6)),y=RD(cy+Math.sin(a)*(ry+5));p.r(x,y-3,1,4,WD[3]);p.d(x,y-3,WD[6])}}           // estacas da rede
const FLOOR=new Map();
function pitFloor(k){return cached('floor'+k,()=>{const G=GP[k],c=mk(G.w,G.h);pitFloorDraw(P(g2(c)),G,false);return c})}

/* ARAME e SACOS AVULSOS (só a planta; o pronto é desenhado pelo sappers.js como linha contínua) */
function wireBlue(s){const f=q4(prog(s)),L=Math.ceil(s.len*Z),sz=L+14,ax=s.ax,ay=s.ay;return cached(`wire|${f}|${ax.toFixed(2)}|${ay.toFixed(2)}|${L}`,()=>layered(sz,sz,p=>{const o=sz/2;
  for(let t=-L/2;t<=L/2;t++)if((RD(t)&3)<2)p.d(RD(o+ax*t),RD(o+ay*t),TAPE)},o=>{const c=sz/2,n=Math.max(2,RD(L/7)),put=RD(n*f+.49);
  for(let i=0;i<put;i++){const t=-L/2+2+i*(L-4)/(n-1);const x=RD(c+ax*t),y=RD(c+ay*t);o.r(x,y-4,1,5,ST[2]);o.d(x,y-4,ST[4]);o.d(x+1,y-2,ST[3])}   // piquetes de rosca
  const x=RD(c-ax*L/2-ay*4),y=RD(c-ay*L/2+ax*4);o.ell(x,y,2,2,'#2a2f2a');o.ell(x,y,1,1,'#5d6862');o.d(x,y,'#141712');                           // rolo de arame
  if(f>.3){const x2=RD(c+ay*5),y2=RD(c-ax*5);o.r(x2,y2,4,1,WD[4]);o.d(x2+4,y2,ST[3])}},{sa:.25,sx:1,sy:1}))}
function bagBlue(s){const f=q4(prog(s));return cached('sbb|'+f+'|'+s.team,()=>layered(20,28,p=>{for(let y=4;y<24;y++){if(y&1){p.d(5,y,TAPE);p.d(14,y,TAPE)}}for(let x=5;x<=14;x++)if(x&1){p.d(x,3,TAPE);p.d(x,24,TAPE)}},o=>{
  for(const[x,y]of[[5,4],[14,4],[5,25],[14,25]])stake(o,x,y);const n=RD(f*6);for(let i=0;i<n;i++)bag(o,8,20-i*3,1,i&1);emptySacks(o,0,27,2+RD((1-f)*2))},{sa:.25,sx:1,sy:1}))}

/* ---------- liga os sprites dos canteiros ---------- */
const ORIG={};
const isIcon=s=>s.id==null;
function siteSprite(kind,s){const st=Math.min(s.stage,3),f=q4(prog(s)),team=s.team?1:0;
 if(kind==='bunker'){if(isIcon(s)&&st>=3)return cached('ic-bk'+team,()=>bodyFor('wood',team,0));return sided(`bk|${st}|${st>=3?1:f}`,team,()=>bunkerSite(st,f))}
 if(kind==='pillbox'){if(isIcon(s)&&st>=3)return cached('ic-pb'+team,()=>bodyFor('concrete',team,0));return sided(`pb|${st}|${st>=3?1:f}`,team,()=>pillSite(st,f))}
 if(kind==='dugout')return sided(`dg|${st}|${st>=2?1:f}`,team,()=>dugSite(st,f));
 if(kind==='nest')return sided(`ns|${st}|${st>=3?1:f}`,team,()=>nestSite(st,f));
 if(kind==='mortar')return sided(`mo|${st}|${st>=3?1:f}`,team,()=>mortarSite(st,f));
 if(kind==='aa'){if(isIcon(s)&&st>=3)return cached('ic-aa'+team,()=>aaIcon(team));return sided(`aa|${st}|${st>=3?1:f}`,team,()=>aaSite(st,f))}
 if(kind==='gunf'||kind==='gunh'){const k=kind==='gunh'?'h':'f';if(isIcon(s)&&st>=3)return cached('ic-g'+k+team,()=>gunIcon(k,team));return sided(`g${k}|${st}|${st>=3?1:f}`,team,()=>gunSite(k,st,f))}
 if(kind==='wire')return s.stage>=1?EMPTY:wireBlue(s);
 if(kind==='sandbag')return s.stage>=1?EMPTY:bagBlue(s);
 return null}
const EMPTY=mk(1,1);
const KINDS=['bunker','pillbox','dugout','nest','mortar','aa','gunf','gunh','wire','sandbag'];
function hook(){for(const k of KINDS){if(!K[k])continue;ORIG[k]=K[k].sprite;const prev=ORIG[k];
  K[k].sprite=function(s){if(!A.on)return prev?prev(s):EMPTY;try{return siteSprite(k,s)||(prev?prev(s):EMPTY)}catch(e){fail(e);try{return prev?prev(s):EMPTY}catch{return EMPTY}}}}
 /* força os canteiros já existentes a pegar o sprite novo */
 for(const s of SAP.segs){s.sk='';s.spr=null}}
function off(){for(const k in ORIG)if(K[k])K[k].sprite=ORIG[k];SAP.customPosts=false;FORT.customAA=false;for(const s of SAP.segs){s.sk='';s.spr=null}}

/* ---------- ícones das cartas ---------- */
function aaIcon(team){const s=aaSite(3,1),c=mk(s.width,s.height),g=g2(c);g.drawImage(s,0,0);drawAAGun(g,AA.cx,AA.cy,team,{ang:-Math.PI/2-.5*face(team),fl:0},0,true);return c}
function gunIcon(k,team){const G=GP[k],c=mk(G.w,G.h),g=g2(c);g.drawImage(pitFloor(k),0,0);try{const sp=k==='h'?PX.WW1.SPR.howitzer():PX.WW1.SPR.fieldGun();g.drawImage(sp.c,RD(G.cx-sp.c.width/2),RD(G.cy-sp.c.height/2))}catch{}
 g.drawImage(gunSite(k,3,1),0,0);return team?flipC(c):c}

/* ---------- bunkers prontos ---------- */
function bodyFor(kind,team,dm){return cached(`body|${kind}|${team}|${dm}`,()=>{const c=cached(`body|${kind}|0|${dm}`,()=>kind==='concrete'?pillBody(0,dm):bunkerBody(0,dm));
 if(!team)return c;/* lado 1: espelha, mas a bandeira volta a ser a dele (desenha de novo sem espelhar o pano) */
 const raw=kind==='concrete'?pillBody(1,dm):bunkerBody(1,dm);return flipC(raw)})}
const ruinFor=kind=>cached('ruin|'+kind,()=>ruinSprite(kind));
let HID=[],LIVE=new Set();
/* seteira: posição em relação ao centro (lado 0) */
const SLIT={wood:{x:13,y:0,L:5},concrete:{x:13,y:-3,L:5}};
function nearestFoe(b,r){let best=null,bd=r*r;for(const u of units){if(u.team===b.team||u.hp<=0)continue;const d=(u.x-b.x)**2+(u.y-b.y)**2;if(d<bd){bd=d;best=u}}return best}
function drawBunker(c,ox,oy,b){const x=ox+RD(b.x*Z),y=oy+RD(b.y*Z);if(x<-40||y<-40||x>vw+40||y>vh+40)return;
 const team=b.team?1:0,fc=face(team),r=b.maxhp?b.hp/b.maxhp:1,dm=r<.34?2:r<.67?1:0,sp=bodyFor(b.kind==='concrete'?'concrete':'wood',team,dm);
 const conc=b.kind==='concrete',G=conc?PB:BK;c.drawImage(sp,x-(team?sp.width-G.cx:G.cx),y-G.cy);
 /* cano da MG na seteira: segue o alvo dentro de ±50° e recua no tiro */
 const firing=(b.cd||0)>.12,S=SLIT[conc?'concrete':'wood'],mx=x+fc*S.x,my=y+S.y;
 if(firing&&(!b._at||time-b._at>.4)){b._at=time;const e=nearestFoe(b,370);if(e){let a=Math.atan2(e.y-b.y,e.x-b.x),base=team?Math.PI:0,d=((a-base+Math.PI*3)%TAU)-Math.PI;b._aim=base+clamp(d,-.85,.85)}}
 const aim=b._aim??(team?Math.PI:0),ca=Math.cos(aim),sa=Math.sin(aim),L=S.L-(firing&&((time*30)|0)%2?1:0);
 PX.pline(c,mx,my,RD(mx+ca*L),RD(my+sa*L*.8),ST[1]);PX.pline(c,mx,my-1,RD(mx+ca*(L-2)),RD(my-1+sa*(L-2)*.8),ST[3]);
 c.fillStyle=ST[0];c.fillRect(RD(mx+ca*L),RD(my+sa*L*.8),1,1);
 if(firing&&((time*24+b.id)|0)%3!==2){const fx=RD(mx+ca*(L+2)),fy=RD(my+sa*(L+2)*.8);c.fillStyle='#ffb347';c.fillRect(fx-1,fy-1,3,3);c.fillStyle='#fff6cc';c.fillRect(fx,fy,1,1);
  c.fillStyle='#ffd466';c.fillRect(RD(fx+ca*2),RD(fy+sa*2),1,1);c.globalAlpha=.25;c.fillStyle='#ffcf6a';c.fillRect(mx-2,my-2,5,4);c.globalAlpha=1}
 /* fumaça no teto arrombado */
 if(dm===2){for(let i=0;i<3;i++){const k=((time*.45+i/3+b.id*.13)%1),sx=x-fc*2+RD(Math.sin(k*5+i)*2+k*4),sy=y-4-RD(k*14),s=k<.5?2:3;c.globalAlpha=.55*(1-k);c.fillStyle=k<.4?'#3a3631':'#6b665e';c.fillRect(sx,sy,s,s);c.globalAlpha=1}}}
/* ruínas: bunker que saiu de buildings (o canteiro estágio 3 continua em PXSAP.segs com s.b) */
function drawRuins(c,ox,oy){for(const s of SAP.segs){if(!s.b||s.stage<3)continue;if(s.b.hp>0&&LIVE.has(s.b))continue;
 const x=ox+RD(s.x*Z),y=oy+RD(s.y*Z);if(x<-40||y<-40||x>vw+40||y>vh+40)continue;const sp=ruinFor(s.b.kind==='concrete'?'concrete':'wood');c.drawImage(sp,x-(sp.width>>1),y-(sp.height>>1))}}

/* ---------- guarnição: soldadinhos 9×14 no molde da infantaria do art.js (capacete Brodie / Stahlhelm, túnica, perneiras/botas) ---------- */
const HEAD={0:['..hhhhh..','.hHHhhhh.','hHhhhhhhh','.vvvvvvv.','...SSsss.','....ssS..'],1:['..hhhh...','.hHHhhh..','.hhhhhhh.','.hhhhhhhh','.hhSSsss.','..hhssS..']};
const TORSO=['..PuuuU..','.PPuutU..','.PPuuuU..','..pPppP..'];
const LEGS={stand:t=>['..kkK....',t?'..bbb....':'..KKk....','..bbb....'],walk:t=>['..kkK....',t?'.bb.bb...':'.kK.Kk...','.bb..bb..'],kneel:()=>['..kkkkK..','..b..bb..'],sit:()=>['..kkkkk..','.....bb..']};
/* pose: pernas + braços/objetos por cima (coordenadas no quadro 9×14, rosto para leste) */
function manSprite(team,pose){return cached(`man|${team}|${pose}`,()=>{const T=PX.TEAM[team],pal=Object.assign({},T),legs=pose==='kneel'||pose==='raise'||pose==='ears'||pose==='feed'?'kneel':pose==='sit'?'sit':pose==='walk'?'walk':'stand';
 const rows=HEAD[team].concat(TORSO,LEGS[legs](team)),c=mk(12,15),g=g2(c);g.drawImage(PX.fromGrid(rows,pal),1,1);const p=P(g),S=T.s,u=T.u,U=T.U;
 if(pose==='carry'){p.r(6,8,4,2,BR[1]);p.d(9,8,ST[4]);p.d(9,9,ST[3]);p.d(6,9,BR[0]);p.d(6,8,S);p.d(8,10,S)}                 // obus nos braços
 else if(pose==='raise'){p.d(7,6,u);p.d(8,5,u);p.d(9,4,S);p.r(9,2,2,2,ST[3]);p.d(9,2,ST[5]);p.d(10,1,OL[2])}                // granada de morteiro erguida sobre o tubo
 else if(pose==='ears'){p.d(3,4,S);p.d(7,4,S);p.d(2,5,u)}                                                            // mãos nos ouvidos
 else if(pose==='bino'){p.r(8,4,2,1,ST[1]);p.d(10,4,ST[3]);p.d(8,5,S);p.d(7,6,u)}                                     // binóculo
 else if(pose==='point'){p.d(7,7,u);p.d(8,7,u);p.d(9,6,S)}                                                            // aponta
 else if(pose==='sit'){p.d(7,8,S);p.d(8,8,ST[2])}                                                                    // mãos nos volantes
 else if(pose==='feed'){p.d(7,8,u);p.d(8,8,S);p.r(9,8,2,1,BR[2])}
 return PX.outlined(c,.62)})}
function man(c,team,pose,x,y,dir){const sp=manSprite(team,pose),fl=dir<0?cached(`manf|${team}|${pose}`,()=>flipC(sp)):sp;
 c.globalAlpha=.28;c.fillStyle='#0b1207';c.fillRect(x-3,y+1,7,1);c.globalAlpha=1;c.drawImage(fl,x-(dir<0?fl.width-6:6),y-13)}

/* ---------- posto de morteiro (dinâmico) ---------- */
function drawPost(c,ox,oy,m){const x=ox+RD(m.x*Z),y=oy+RD(m.y*Z);if(x<-30||y<-30||x>vw+30||y>vh+30)return;const team=m.team?1:0,fc=face(team);
 if(m.fl>0)m._lf=time;const hot=time-(m._lf??-99)<14,ready=hot&&m.cd<.7&&m.cd>0,a=m.ang??(team?Math.PI:0),ca=Math.cos(a),sa=Math.sin(a),R=(X,Y,w,h,col)=>{c.fillStyle=col;c.fillRect(X,Y,w,h)};
 /* placa-base e tubo inclinado para o alvo (~60° de elevação vistos de cima), bípode à frente */
 const bx=x+fc,by=y+1,tx=RD(bx+ca*4),ty=RD(by+sa*3-7),mx=RD(bx+ca*2.6),my=RD(by+sa*2-4);
 R(bx-3,by,7,2,ST[1]);R(bx-3,by,7,1,ST[3]);R(bx-2,by+2,5,1,E[2]);
 PX.pline(c,mx,my,RD(bx+ca*5-2),by+2,ST[1]);PX.pline(c,mx,my,RD(bx+ca*5+2),by+2,ST[2]);
 PX.pline(c,bx,by,tx,ty,ST[4]);PX.pline(c,bx+1,by,tx+1,ty,ST[2]);PX.pline(c,bx+1,by+1,tx+1,ty+1,ST[1]);R(tx,ty,2,1,INK);R(mx-1,my,3,1,ST[3]);
 /* carregador ajoelhado junto ao tubo (granada erguida antes do disparo, mãos nos ouvidos no tiro); municiador atrás */
 man(c,team,ready?'raise':m.fl>0?'ears':'kneel',x-fc*5,y+3,fc);
 if(m.fl>0){const k=m.fl/.18;R(tx-1,ty-3,4,3,'#ffd466');R(tx,ty-2,2,1,'#fffbe0');R(tx-2,ty-1,1,1,'#ff9b32');R(tx+3,ty-1,1,1,'#ff9b32');R(tx,ty-5,2,2,'#ffb347');
  c.globalAlpha=.55*k;R(tx-2,ty-9,5,4,'#8a857b');R(tx-1,ty-10,3,1,'#b9b3a7');c.globalAlpha=1}
 man(c,team,hot?'carry':'stand',x-fc*15,y+5,fc)}

/* ---------- antiaérea (dinâmica): reparo de pedestal, cano elevado para o avião, guarnição de 3 ---------- */
function drawAAGun(c,x,y,team,a,fl,still){const fc=face(team),ang=a.ang??-Math.PI/2,ca=Math.cos(ang),sa=Math.sin(ang),R=(X,Y,w,h,col)=>{c.fillStyle=col;c.fillRect(X,Y,w,h)};
 /* pedestal cônico aparafusado ao estrado, anel de giro, braços dos assentos */
 R(x-4,y+1,9,2,ST[1]);R(x-4,y+1,9,1,ST[2]);R(x-3,y-1,7,2,ST[2]);R(x-3,y-1,7,1,ST[4]);R(x-1,y-4,3,3,ST[2]);R(x-1,y-4,1,3,ST[4]);R(x+1,y-4,1,3,ST[1]);
 R(x-5,y,2,1,ST[3]);R(x+4,y,2,1,ST[3]);
 const px=x,py=y-4,L=13,rc=fl>0&&!still?1:0,tip=k=>[RD(px+ca*(k-rc)),RD(py+sa*(k-rc)*.85)];
 /* berço com recuperador (grosso) e cano; escudo virado para o avião */
 const[jx,jy]=tip(6),[tx,ty]=tip(L);
 R(RD(px+ca*2)-3,RD(py+sa*2)-1,6,2,ST[3]);R(RD(px+ca*2)-3,RD(py+sa*2)-1,6,1,ST[5]);
 for(const k of[-1,0,1])PX.pline(c,px+RD(-sa*k),py+RD(ca*k),jx+RD(-sa*k),jy+RD(ca*k),k<0?ST[4]:k>0?ST[1]:ST[2]);
 PX.pline(c,jx,jy,tx,ty,ST[3]);PX.pline(c,jx+RD(-sa),jy+RD(ca),tx+RD(-sa),ty+RD(ca),ST[1]);R(tx,ty,1,1,INK);
 R(px-fc*3-1,py+2,3,2,WD[3]);R(px-fc*3-1,py+2,3,1,WD[5]);                                                              // cunhete de cartuchos
 if(fl>0&&!still){const[fx,fy]=tip(L+3);R(fx-1,fy-1,3,3,'#ffb347');R(fx,fy,1,1,'#ffffff');R(RD(fx+ca*2),RD(fy+sa*2),1,1,'#ffd466');
  R(RD(fx-sa*2),RD(fy+ca*2),1,1,'#ff9b32');R(RD(fx+sa*2),RD(fy-ca*2),1,1,'#ff9b32')}}
function drawAA(c,ox,oy,a){const x=ox+RD(a.x*Z),y=oy+RD(a.y*Z);if(x<-34||y<-34||x>vw+34||y>vh+34)return;const team=a.team?1:0,fc=face(team);
 if(a.fl>0)a._lf=time;const hot=time-(a._lf??-99)<6,ca=Math.cos(a.ang??-1.57);
 /* apontador sentado atrás do reparo, observador com binóculo à frente, municiador com o cartucho na entrada */
 man(c,team,'sit',x-fc*6,y-1,fc);
 drawAAGun(c,x,y,team,a,a.fl,false);
 man(c,team,'bino',x+fc*8,y+7,Math.abs(ca)<.25?fc:ca>0?1:-1);
 man(c,team,hot&&((time*2+a.x)|0)%2?'feed':'carry',x-fc*14,y+7,fc);
 if(a.fl>0){c.fillStyle=BR[2];c.fillRect(x-fc*(3+RD((.08-a.fl)*60)),y-3+RD((.08-a.fl)*40),2,1)}}                    // estojo ejetado

/* ---------- passes de desenho ---------- */
function drawPre(c,ox,oy){/* antes de tudo do WW1A.under: chão dos poços de artilharia (a peça vem por cima) e ruínas */
 for(const s of SAP.segs){if(s.stage<3)continue;
  if(s.kind==='gunf'||s.kind==='gunh'){const k=s.kind==='gunh'?'h':'f',G=GP[k],x=ox+RD(s.x*Z),y=oy+RD(s.y*Z);if(x<-40||y<-40||x>vw+40||y>vh+40)continue;const fl=pitFloor(k);
   c.drawImage(s.team?cached('floorf'+k,()=>flipC(fl)):fl,x-(s.team?G.w-G.cx:G.cx),y-G.cy)}}
 drawRuins(c,ox,oy)}
function drawMain(c,ox,oy){
 for(const b of HID)if(b.hp>0)drawBunker(c,ox,oy,b);
 for(const m of SAP.posts)if(m.hp>0)drawPost(c,ox,oy,m);
 for(const a of FORT.aa)if(a.hp>0)drawAA(c,ox,oy,a)}

/* ---------- ligações ---------- */
function install(){
 hook();SAP.customPosts=true;FORT.customAA=true;
 const R0=window.render;if(typeof R0==='function')window.render=function(...a){if(!A.on||!buildings.some(b=>b.kind))return R0.apply(this,a);
  const all=buildings;HID=all.filter(b=>b.kind);LIVE=new Set(HID);buildings=all.filter(b=>!b.kind);try{return R0.apply(this,a)}finally{buildings=all}};
 if(window.WW1A){const under=WW1A.under;WW1A.under=function(c,ox,oy,dt){
   if(A.on)try{drawPre(c,ox,oy)}catch(e){fail(e)}
   under.call(this,c,ox,oy,dt);
   if(!A.on)return;const t0=performance.now();try{drawMain(c,ox,oy)}catch(e){fail(e)}A.stats.ms=A.stats.ms*.95+(performance.now()-t0)*.05;A.stats.frames++}}}
install();
/* fora do render (ex.: minimapa) o LIVE pode ficar velho: zera quando não há bunkers */
A.state=()=>({on:A.on,errors:A.stats.errors,sprites:A.stats.sprites,cache:CACHE.size,ms:+A.stats.ms.toFixed(3),hidden:HID.length,posts:SAP.posts.length,aa:FORT.aa.length});
A.off=()=>{A.on=false;off()};
/* prancha de revisão: todos os sprites ampliados ×k (só para depuração) */
A.sheet=(k=3,bg='#4d5a33')=>{const items=[];const fake=(kind,stage,f,team)=>{const nd=K[kind].need,a=stage?nd[stage-1]:0,b=nd[Math.min(stage,nd.length-1)];return{id:1,kind,stage,team,work:stage>=nd.length?999:a+(b-a)*f,need:nd,len:30,ax:0,ay:1,p:{}}};
 for(const kind of['bunker','pillbox','dugout','nest','mortar','aa','gunf','gunh']){const T=K[kind].target;for(let st=0;st<=T;st++)for(const f of(st<T?[0,.5,1]:[1]))items.push(siteSprite(kind,fake(kind,st,f,0)))}
 for(const t of[0,1])for(let dm=0;dm<3;dm++){items.push(bodyFor('wood',t,dm));items.push(bodyFor('concrete',t,dm))}items.push(ruinFor('wood'),ruinFor('concrete'));
 for(const t of[0,1]){const c=mk(40,36),g=g2(c);g.drawImage(mortarSite(3,1),0,0);drawPost(g,0,0,{team:t,x:20/Z,y:18/Z,hp:1,cd:.3,fl:0,ang:t?Math.PI:0,_lf:time});items.push(c);
  const c2=mk(40,36),g3=g2(c2);g3.drawImage(aaSite(3,1),1,1);drawAA(g3,0,0,{team:t,x:20/Z,y:18/Z,hp:1,ang:-1.2-(t?.8:0),fl:.05});items.push(c2)}
 items.push(gunIcon('f',0),gunIcon('h',1),wireBlue({stage:0,work:3,need:[5],len:42,ax:0,ay:1}),bagBlue({stage:0,work:3,need:[5],team:0}));
 for(const t of[0,1])for(const ps of['stand','walk','kneel','sit','carry','raise','ears','bino','point','feed']){const c=mk(12,16),g=g2(c);man(g,t,ps,6,14,1);items.push(c)}
 const cols=8,cw=70,ch=50,W0=cols*cw*k,H0=Math.ceil(items.length/cols)*ch*k,out=mk(W0,H0),g=g2(out);g.imageSmoothingEnabled=false;g.fillStyle=bg;g.fillRect(0,0,W0,H0);
 items.forEach((it,i)=>{const cx=(i%cols)*cw*k,cy=Math.floor(i/cols)*ch*k;g.drawImage(it,cx+((cw-it.width)>>1)*k,cy+((ch-it.height)>>1)*k,it.width*k,it.height*k)});return out.toDataURL()};
if(window.IronFront)window.IronFront.artForts=A;
})();
