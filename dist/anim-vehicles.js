'use strict';
/* Iron Front — anim-vehicles.js: refino de animação de BLINDADOS e CAVALARIA (camada só visual; não mexe em dano, tiro nem IA).
   Carrega por último (depois de physics.js e das demais camadas). Liga-se por envoltórios (wrap) externos:
   PHYS.draw (desenha tanque/cavalo quando é o estado "normal"; senão repassa), update (relógio da simulação e partículas),
   damage (morte de tanque → sequência de destruição; morte de cavalo → empinar/cair), shoot (coice/clarão do canhão),
   setup (zera tudo), WW1A.under/over (camadas de chão e de ar).
   Tanques: casco de 16 direções com fase de esteira POR LADO (as duas giram em sentidos opostos no pivô), andando por distância;
     Renault FT com TORRE GIRATÓRIA de 32 direções (mira o alvo, recuo do cano), sombra própria da torre, balanço da suspensão
     (mesma regra do physics.js: casco fatiado ao meio), escape, poeira/lama das esteiras, marcas no chão seco, vibração do motor,
     clarão do canhão em 2 estágios + anel de poeira, MGs piscando nas casamatas do A7V, cicatrizes de impacto, fumaça e fogo com dano.
   Destruição: clarão interno, jato de fogo pela escotilha, munição detonando (cook-off), torre do FT arrancada (às vezes), chapas
     e elos de esteira voando, mancha de queimado no chão, carcaça em chamas → fumaça → brasa, e a carcaça FICA (depois dos 60 s do pixel.js).
   Cavalaria: passo/trote/galope (4 tempos com fase de suspensão), cavaleiro no ritmo, sabre erguido na carga (EUA) / lança em riste
     com flâmula (Ulanos), poeira dos cascos; morte: cavalo empina, cai de lado, esperneia e fica no chão; cavaleiro arremessado.
   Regras: pixels inteiros, sem rotação no desenho (RotSprite pré-calculado e cacheado), luz de cima-esquerda, paleta da casa.
   ?animveh=0 desliga. PXVEH.state() devolve contadores. Erros no desenho nunca escapam (12 erros → desliga). */
(function(){
const PX=window.PX;
const V=window.PXVEH={on:!/[?&]animveh=0/.test(location.search),version:'1.0',stats:{errors:0,tanksDrawn:0,cavDrawn:0,hulls:0,turrets:0,horses:0,deaths:0,horseDeaths:0,cookoffs:0,turretsPopped:0,drawMs:0,tickMs:0,peakMs:0},state:()=>({on:V.on})};
if(!PX||!PX.rotSprite||!PX.TANKS||!PX.TEAM||!window.PHYS||!V.on)return;
const{TAU,mk,g2,mix,rotSprite,outlined,silhouette,TEAM,fromGrid}=PX,Z=PX.Z||.5;
const clamp=(v,a,b)=>v<a?a:v>b?b:v,rnd=(a,b)=>a+Math.random()*(b-a),hyp=Math.hypot,frac=v=>v-Math.floor(v);
const angDiff=(a,b)=>{let d=(a-b)%TAU;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d};
const dir16=a=>Math.round(((a%TAU)+TAU)%TAU/(TAU/16))%16,dir32=a=>Math.round(((a%TAU)+TAU)%TAU/(TAU/32))%32;
const rect=(c,x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h)};
let errs=0;function fail(e){V.stats.errors++;if(++errs<=3)console.error('anim-vehicles.js:',e);if(errs>=12){V.on=false;console.error('anim-vehicles.js desligado após erros repetidos')}}
const wrap=(name,fn)=>{const o=window[name];if(typeof o!=='function')return;window[name]=function(...a){return fn(o,...a)}};
/* cópia para canvas sem willReadFrequently (fica na GPU; drawImage barato a cada quadro) */
const gpu=src=>{const c=document.createElement('canvas');c.width=src.width;c.height=src.height;const x=c.getContext('2d');x.drawImage(src,0,0);return c};
const spin=(base,ang)=>{const r=rotSprite(base,ang);return{c:gpu(outlined(r)),ax:(r.width>>1)+1,ay:(r.height>>1)+1}};
const store=new Map(),memo=(k,fn)=>{let v=store.get(k);if(!v){v=fn();store.set(k,v)}return v};

/* ============ arte do Renault FT (cópia fiel do tanks.js, separada em CASCO sem torre + TORRE avulsa) ============ */
const hx=(r,g,b)=>'#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
const lum=c=>{const[r,g,b]=PX.hex2rgb(c);return r*.3+g*.59+b*.11};
const wreckCol=c=>{const l=lum(c);return mix(mix(c,hx(l*1.05,l*.97,l*.88),.6),'#0e0c0a',.2)};
const mapPal=(o,f)=>{const r={};for(const k in o)r[k]=Array.isArray(o[k])?o[k].map(v=>Array.isArray(v)?v.map(f):f(v)):f(o[k]);return r};
const hash=(x,y,s)=>{let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(s|0,1442695041))|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296};
const vnoise=(x,y,s)=>{const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),a=hash(xi,yi,s),b=hash(xi+1,yi,s),c=hash(xi,yi+1,s),d=hash(xi+1,yi+1,s);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v};
const fbm=(x,y,s)=>vnoise(x,y,s)*.65+vnoise(x*2.1+7,y*2.1+3,s+11)*.35;
function pen(c){const x=g2(c);x.imageSmoothingEnabled=false;return{c,x,p(a,b,col){x.fillStyle=col;x.fillRect(a,b,1,1)},r(a,b,w,h,col){x.fillStyle=col;x.fillRect(a,b,w,h)},e(a,b,w=1,h=1){x.clearRect(a,b,w,h)},m(a,b,rows,col){x.fillStyle=col;for(let j=0;j<rows.length;j++)for(let i=0;i<rows[j].length;i++)if(rows[j][i]==='#')x.fillRect(a+i,b+j,1,1)}}}
function zdome(R,cx,cy,r,pal,o){const re=r+.3;for(let j=Math.floor(cy-re);j<=Math.ceil(cy+re);j++)for(let i=Math.floor(cx-re);i<=Math.ceil(cx+re);i++){const nx=(i+.5-cx)/re,ny=(j+.5-cy)/re,rr=Math.sqrt(nx*nx+ny*ny);if(rr>1)continue;const ux=nx/(rr||1),uy=ny/(rr||1),s=-(ux*.62+uy*.78);let col,z;if(rr>o.out){z=0;col=s>-.2?pal.outL:pal.outD}else if(rr>o.sh){z=1;const sd=s+(((i+j)&1)?.1:-.1);col=sd>.45?pal.hh:sd>-.1?pal.h:sd>-.55?pal.o:pal.d}else{z=2;col=pal.roof}if(o.ov){const v=o.ov(i,j,z,col);if(v)col=v}R.p(i,j,col)}}
function discP(R,cx,cy,r,col){const re=r+.3;for(let j=Math.floor(cy-re);j<=Math.ceil(cy+re);j++)for(let i=Math.floor(cx-re);i<=Math.ceil(cx+re);i++){const nx=(i+.5-cx)/re,ny=(j+.5-cy)/re;if(nx*nx+ny*ny<=1)R.p(i,j,col)}}
function trackP(R,p,x0,x1,y,h,ph){for(let i=x0;i<=x1;i++){const k=(((i-ph)%3)+3)%3;for(let j=0;j<h;j++){const lv=j===0?0:j===h-1?2:1;R.p(i,y+j,p.tk[k][lv])}}}
function louver(R,x,y,w,h,a,b,c){for(let i=0;i<w;i++)R.r(x+i,y,1,h,i&1?a:b);if(c)R.r(x,y,w,1,c)}
const DIG={'4':['#.#','#.#','###','..#','..#'],'7':['###','..#','.#.','.#.','.#.']};
function sootN(R,x,y,w,h,seed,thr,sc,c1,c2){R.x.globalCompositeOperation='source-atop';for(let j=0;j<h;j++)for(let i=0;i<w;i++){const n=fbm((x+i)/sc,(y+j)/sc,seed);if(n>thr)R.p(x+i,y+j,n>thr+.09?c2:c1)}R.x.globalCompositeOperation='source-over'}
function blastP(R,cx,cy,r,seed,c1,c2){R.x.globalCompositeOperation='source-atop';for(let j=Math.floor(cy-r-2);j<=Math.ceil(cy+r+2);j++)for(let i=Math.floor(cx-r-2);i<=Math.ceil(cx+r+2);i++){const d=Math.hypot(i+.5-cx,(j+.5-cy)*1.05)+(fbm(i/2.6,j/2.6,seed)-.5)*r*.9;if(d<r*.5)R.p(i,j,c2);else if(d<r*.85)R.p(i,j,c1);else if(d<r&&((i+j)&1))R.p(i,j,c1)}R.x.globalCompositeOperation='source-over'}
const MK0=(TEAM[0]&&TEAM[0].mark)||'#b3ecf7';
const FT={ol:'#646b3a',olH:'#838a50',olHH:'#a7ae6b',olD:'#474e2b',olDD:'#2e351b',st:'#3b3e35',stD:'#23251d',stH:'#6b7062',stHH:'#9ca292',rust:'#8a5a34',rustD:'#5a3a22',soot:'#231e19',soot2:'#100d0a',ember:'#b4562a',wood:'#7c5a38',woodH:'#a27c4b',woodD:'#553a24',wh:'#d9d7c3',whD:'#a9a792',glass:'#12140d',pit:'#191b14',mk:MK0,mkH:mix(MK0,'#ffffff',.55),mkD:mix(MK0,'#0b1a26',.45),tk:[['#7d7a63','#5d5a47','#3a382d'],['#524f3d','#403e30','#2b2a21'],['#1b1c16','#1b1c16','#1b1c16']]};
const FTW=mapPal(FT,wreckCol);FTW.soot='#3a342d';FTW.soot2='#1f1b17';FTW.mk=mix(FTW.mk,'#0e0c0a',.55);FTW.mkH=mix(FTW.mkH,'#0e0c0a',.55);FTW.mkD=mix(FTW.mkD,'#0e0c0a',.4);FTW.wh=mix(FTW.wh,'#0e0c0a',.45);
function ftPlane(R,p,x,y,w,h,bev){for(let j=0;j<h;j++)for(let i=0;i<w;i++){let c=p.ol;if(bev){if(j===0||(bev===2&&i===0))c=p.olH;else if(j===h-1||(bev===2&&i===w-1))c=p.olD}R.p(x+i,y+j,c)}}
function ftWheel(R,p,x,y,w,big){for(let j=0;j<5;j++)for(let i=0;i<w;i++){if((j===0||j===4)&&(i===0||i===w-1))continue;const c=j===0||i===0?p.stH:j===4||i===w-1?p.stD:p.st;R.p(x+i,y+j,c)}R.p(x+1,y,p.stHH);R.p(x+2,y,p.stHH);
if(big){R.r(x+2,y+2,2,1,p.stD);R.p(x+1,y+2,p.stH);R.p(x+4,y+2,p.stH);R.p(x+2,y+1,p.stH);R.p(x+3,y+3,p.stH);R.p(x+2,y+2,p.woodD);R.p(x+3,y+2,p.stD)}else{R.p(x+2,y+2,p.stD);R.p(x+1,y+2,p.stHH);R.p(x+3,y+1,p.stH);R.p(x+3,y+3,p.stD)}}
/* casco do FT sem a torre: tA/tB = fase da esteira de cima (lado esquerdo do tanque) e de baixo; v: 0 novo, 1 avariado, 2 carcaça (anel da torre aberto) */
function ftHull(tA,tB,v){
const wr=v===2,p=wr?FTW:FT,c=mk(58,26),R=pen(c);R.x.translate(9,3);
R.r(1,6,9,8,p.pit);R.r(1,6,9,2,p.st);R.r(1,12,9,2,p.st);R.r(1,6,9,1,p.stH);R.r(1,13,9,1,p.stD);R.r(0,6,2,8,p.st);R.r(0,6,1,8,p.stH);R.p(0,13,p.stD);R.p(1,13,p.stD);
R.r(2,8,1,4,p.stH);R.r(6,8,1,4,p.stH);R.p(3,8,p.st);R.p(4,9,p.st);R.p(4,10,p.st);R.p(5,11,p.st);R.p(5,8,p.st);R.p(3,11,p.st);R.p(8,9,p.stHH);R.p(8,10,p.stD);R.p(9,9,p.stD);R.p(9,10,p.stD);R.p(3,6,p.stHH);R.p(7,6,p.stHH);R.p(3,12,p.stH);R.p(7,12,p.stH);R.e(0,6);R.e(0,13);
trackP(R,p,12,36,0,3,wr?0:tA);trackP(R,p,12,36,17,3,wr?0:tB);
if(wr)for(const[a,b]of[[17,0],[22,1],[27,0],[31,2],[15,18],[21,19],[26,17],[31,18]]){R.p(a,b,p.tk[2][0]);R.p(a+1,b,p.tk[2][0])}
ftPlane(R,p,12,3,22,2,1);ftPlane(R,p,12,15,22,2,1);R.r(12,4,22,1,p.olD);R.r(12,16,22,1,p.olD);R.r(12,15,22,1,p.ol);R.r(12,3,22,1,p.olH);for(let i=13;i<34;i+=3){R.p(i,3,p.olHH);R.p(i,16,p.olDD)}
for(const y0 of[0,15]){ftWheel(R,p,8,y0,5,false);ftWheel(R,p,34,y0,6,true)}
ftPlane(R,p,9,5,29,10,2);for(let j=5;j<15;j++){R.p(35,j,((j+35)&1)?p.ol:p.olD);R.p(36,j,p.olD);R.p(37,j,((j+37)&1)?p.olD:p.olDD)}R.r(36,5,2,1,p.ol);
for(let i=11;i<35;i+=3){R.p(i,5,p.olHH);R.p(i,14,p.olDD)}
louver(R,10,5,6,2,p.ol,p.olD,p.olH);louver(R,10,13,6,2,p.olD,p.olDD,null);R.r(16,5,1,10,p.olDD);R.m(10,8,DIG['4'],p.wh);R.m(14,8,DIG['7'],p.wh);
R.r(13,3,7,2,p.st);R.r(13,3,7,1,p.stH);R.r(13,4,7,1,p.stD);R.p(13,3,p.soot);R.p(13,4,p.soot);R.p(14,3,p.rustD);R.p(15,4,p.rustD);R.p(16,4,p.rust);R.p(19,3,p.stHH);R.p(19,4,p.stD);
R.r(25,3,9,1,p.stH);R.r(31,4,3,1,p.st);R.p(25,4,p.woodD);R.p(26,4,p.woodD);R.p(28,4,p.stD);R.r(33,3,1,2,p.stD);
R.r(13,15,6,2,p.wood);R.r(13,15,6,1,p.woodH);R.r(13,16,6,1,p.woodD);R.p(15,15,p.stHH);R.p(13,16,p.stD);R.p(18,16,p.stD);for(let i=0;i<6;i++){R.p(26+i,15,i&1?p.wood:p.woodH);R.p(26+i,16,i&1?p.woodD:p.wood)}R.p(32,15,p.woodD);R.p(32,16,p.woodD);
R.r(31,6,5,8,p.olH);R.r(31,6,5,1,p.olHH);R.r(31,13,5,1,p.ol);R.r(35,6,1,8,p.olD);R.r(31,6,1,8,p.olDD);R.p(33,7,p.stHH);R.p(33,12,p.stHH);R.r(36,7,2,1,p.glass);R.r(36,12,2,1,p.glass);
R.r(38,5,1,2,p.st);R.r(38,13,1,2,p.st);R.p(38,5,p.stHH);R.p(38,13,p.stHH);
R.r(36,5,2,2,p.mk);R.r(36,13,2,2,p.mk);R.p(37,6,p.mkD);R.p(37,14,p.mkD);R.p(0,7,p.mk);R.p(0,12,p.mk);R.p(1,7,p.mkD);R.p(1,12,p.mkD);
/* anel da torre (sempre coberto pela torre; aparece se ela for arrancada) */
discP(R,22,10,6.2,p.olDD);discP(R,22,10,5.2,p.stD);
if(v===1){sootN(R,0,2,40,18,31,.7,3.4,p.rustD,p.soot);for(const[a,b]of[[12,9],[30,14],[8,7]]){R.r(a,b,2,1,'#0a0806');R.p(a,b-1,p.stH);R.p(a+2,b,p.rust)}}
if(wr){sootN(R,0,2,40,18,12,.64,3.2,p.rustD,p.rust);sootN(R,0,2,40,18,71,.66,4.6,p.soot,p.soot);blastP(R,22,10,6.6,5,p.soot,p.soot2);blastP(R,12,9,3.5,8,p.soot,p.soot2);blastP(R,33,12,3,9,p.soot,p.soot2);
 discP(R,22,10,5.2,'#0a0806');discP(R,22,10,3.6,'#050403');for(const[a,b]of[[17,8],[18,13],[22,4],[26,6],[27,13],[21,15],[24,15]])R.p(a,b,p.stH);R.p(16,10,p.ember);R.p(23,9,p.ember);R.p(20,11,'#7a2a12');
 for(const[a,b]of[[12,9],[33,10],[30,14]]){R.r(a,b,2,2,'#0a0806');R.p(a-1,b-1,p.stH);R.p(a+2,b,p.stD);R.p(a,b+2,p.soot2);R.p(a+1,b-1,p.rust)}
 R.e(22,3,5,1);R.r(22,4,5,1,p.soot2);R.r(23,2,4,1,p.olD);R.r(24,1,3,1,p.ol);R.e(20,17,7,3);R.r(20,17,3,1,p.soot2);R.r(24,18,3,2,p.tk[1][2]);R.p(22,18,p.ember);R.r(28,20,6,2,p.ol);R.r(28,20,6,1,p.olH);R.r(29,21,5,1,p.olDD);R.p(31,20,p.soot)}
return c}
/* torre Berliet + canhão Puteaux 37 mm em canvas 44×14 com o pivô no centro exato (canto 22,7 = centro do domo); rec = recuo do cano (px) */
function ftTurret(rec,v){
const wr=v===2,p=wr?FTW:FT,c=mk(44,14),R=pen(c);R.x.translate(0,-3);
zdome(R,22,10,6,{outL:p.olD,outD:p.olDD,hh:p.olHH,h:p.olH,o:p.ol,d:p.ol,roof:p.olH},{out:.84,sh:.64,ov:(i,j,z,col)=>{if(i>=24&&i<=25&&z>0)return col===p.olDD||col===p.olD?p.mkD:col===p.olHH?p.mkH:p.mk;if(i>=24&&i<=25&&z===2)return p.mk}});
for(const[a,b]of[[17,7],[17,12],[19,5],[19,14],[26,5],[26,14],[27,8],[27,11]])R.p(a,b,p.olHH);
discP(R,22,11,3,p.olD);zdome(R,21,10,3,{outL:p.olHH,outD:p.olDD,hh:p.olHH,h:p.olH,o:p.ol,d:p.ol,roof:p.ol},{out:.78,sh:.5});
R.r(19,8,4,4,p.olH);R.r(19,8,4,1,p.olHH);R.r(19,11,4,1,p.ol);R.p(19,8,p.ol);R.p(22,8,p.olH);R.p(19,11,p.olD);R.p(22,11,p.olD);R.p(19,9,p.olDD);R.p(19,10,p.olDD);R.p(22,9,p.stHH);R.p(21,10,p.olD);
R.p(20,7,p.olD);R.p(21,7,p.olD);R.p(20,12,p.olDD);R.p(21,12,p.olDD);R.p(18,9,p.olD);R.p(18,10,p.olD);R.p(23,9,p.olDD);R.p(23,10,p.olDD);
R.r(28,8,3,4,p.ol);R.r(28,8,3,1,p.olH);R.r(28,11,3,1,p.olD);R.r(30,8,1,4,p.olD);R.p(28,8,p.olHH);
R.r(31,8,5,4,p.st);R.r(31,8,5,1,p.stHH);R.r(31,9,5,1,p.stH);R.r(31,11,5,1,p.stD);R.r(35,8,1,4,p.stD);R.p(33,10,p.stD);
if(!wr){const b=-rec;R.r(36+b,9,5,2,p.st);R.r(36+b,9,5,1,p.stH);R.r(36+b,10,5,1,p.stD);R.r(41+b,8,2,4,p.st);R.r(41+b,8,2,1,p.stHH);R.r(42+b,9,1,2,p.stD);R.r(41+b,11,2,1,p.stD);R.p(41+b,9,p.stH);if(rec)R.p(41+b,10,'#ffb347')}
if(v===1)sootN(R,15,3,29,14,44,.7,3,p.rustD,p.soot);
if(wr){sootN(R,15,3,29,14,12,.6,3.2,p.rustD,p.rust);blastP(R,21,10,5.5,5,p.soot,p.soot2);R.r(19,8,4,4,p.soot2);R.r(20,9,2,2,'#050403');R.p(19,8,p.soot);R.p(22,8,p.soot);R.p(23,7,p.ember);R.p(18,12,p.rust);R.r(25,5,2,2,'#0a0806');R.p(24,4,p.stH);
 R.r(36,9,3,2,p.st);R.r(36,9,3,1,p.stH);R.r(39,10,3,2,p.stD);R.r(39,10,3,1,p.st);R.p(41,11,p.soot2);R.p(41,10,p.rust)}
return c}

/* ============ caches de sprites ============ */
/* A7V: as bases do tanks.js (uma por fase) só diferem nos pixels das esteiras; metade de cima de uma fase + metade de baixo da outra */
const a7Base=ph=>{PX.tankSprite(1,0,ph);return PX.cached(`tnb1_${ph}_0`,()=>null)};
function a7Hull(tA,tB,v){const A=a7Base(tA),B=a7Base(tB);if(!A||!B)return null;const c=mk(A.width,A.height),x=g2(c),h=A.height>>1;x.drawImage(A,0,0,A.width,h,0,0,A.width,h);x.drawImage(B,0,h,A.width,A.height-h,0,h,A.width,A.height-h);
 if(v===1){const R=pen(c),p={rustD:'#5a3a22',soot:'#231e19'};R.x.translate(8,3);sootN(R,0,3,58,22,33,.71,3.6,p.rustD,p.soot);for(const[a,b]of[[24,8],[10,18],[40,17],[33,20]]){R.r(a,b,2,1,'#0a0806');R.p(a,b-1,'#a4aa9a')}}
 return c}
const hullSprite=(t,d,a,b,v)=>memo(`h${t}${d}${a}${b}${v}`,()=>{V.stats.hulls++;const base=t?a7Hull(a,b,v):ftHull(a,b,v);return base?spin(base,d*TAU/16):PX.tankSprite(t,d,a)});
const turretSprite=(d,rec,v)=>memo(`t${d}${rec}${v}`,()=>{V.stats.turrets++;const s=spin(ftTurret(rec,v),d*TAU/32);s.sh=gpu(silhouette(s.c,'#141a10'));return s});
/* carcaça do FT no cache do tanks.js passa a ser o casco SEM torre (a torre é desenhada à parte: no lugar, ou arrancada no chão).
   O objeto cacheado é mutado (getters preguiçosos), então o laço de carcaças do pixel.js passa a usá-lo sem editar aquele arquivo.
   As carcaças decorativas do mapa já foram pintadas no terreno antes deste arquivo carregar. */
try{for(let d=0;d<16;d++){const o=PX.cached(`tnw0_${d}`,()=>({}));let real=null;const get=()=>real||(real=hullSprite(0,d,0,0,2));
 Object.defineProperty(o,'c',{get:()=>get().c,configurable:true});Object.defineProperty(o,'ax',{get:()=>get().ax,configurable:true});Object.defineProperty(o,'ay',{get:()=>get().ay,configurable:true})}}catch(e){fail(e)}
/* geometria (px de arte, a partir do centro do sprite, eixo +x = frente) */
const G=[{piv:2,muz:21,trk:8.5,trkX:-9,rear:-20,ex:[[-7,-6.5]],fire:[[2,0],[-8,-3],[-8,3]],hw:17},
 {piv:0,muz:35,trk:12.5,trkX:-22,rear:-28,ex:[[-20.5,-2.5],[-20.5,1.5]],fire:[[11,0],[-15,0],[-8,0],[4,0]],mg:[[-14.5,-11,0,-1],[3.5,-11,0,-1],[-14.5,10.5,0,1],[3.5,10.5,0,1],[-28,-7,-1,0],[-28,6,-1,0]],hw:25}];
/* ponto local (px de arte) → deslocamento de tela pela direção quantizada */
const rot=(lx,ly,d,n)=>{const a=d*TAU/n,c=Math.cos(a),s=Math.sin(a);return[lx*c-ly*s,lx*s+ly*c]};

/* ============ cavalaria: cavalo procedural com andaduras + cavaleiro (grades do art.js) ============ */
const HEAD={0:{front:['..hhhhh..','.hHHHhhh.','hHhhhhhhh','.vvvvvvv.','..SsssS..','...sss...'],back:['..hhhhh..','.hHHHhhh.','hHhhhhhhh','.vvvvvvv.','..SSSSS..','...SsS...'],side:['..hhhhh..','.hHHhhhh.','hHhhhhhhh','.vvvvvvv.','...SSsss.','....ssS..']},
1:{front:['...hhh...','..hHHhh..','.hHhhhhh.','hhhhhhhhh','.hSsssSh.','...sss...'],back:['...hhh...','..hHHhh..','.hHhhhhh.','hhhhhhhhh','.hhhhhhh.','...SsS...'],side:['..hhhh...','.hHHhhh..','.hhhhhhh.','.hhhhhhhh','.hhSSsss.','..hhssS..']}};
const TORSO={front:['UuuuuuuuU','tuppuppuT','UuuuuuuuU','.pPpppPp.'],back:['UuuuuuuuU','tuPPPPPuT','UuPppPPuU','.pPpppPp.'],side:['..PuuuU..','.PPuutU..','.PPuuuU..','..pPppP..']};
const riderCanvas=(t,f,flip)=>memo(`r${t}${f}${flip}`,()=>{const pal=Object.assign({},TEAM[t]);pal.T=pal.t;const c=fromGrid(HEAD[t][f].concat(TORSO[f]),pal);return flip?PX.flipX(c):c});
/* pernas: [hx (quadril), lado (-1 esquerda/cima, +1 direita/baixo), defasagem no ciclo] por andadura; duty = fração de apoio */
const GAIT=[null,{legs:[[-5,-1,0],[5,-1,.25],[-5,1,.5],[5,1,.75]],duty:.66,R:1.5,frames:6,stride:26},
 {legs:[[5,-1,0],[-5,1,0],[5,1,.5],[-5,-1,.5]],duty:.44,R:2,frames:6,stride:34},
 {legs:[[-5,-1,0],[-5,1,.11],[5,-1,.36],[5,1,.48]],duty:.33,R:4,frames:8,stride:48}];
const legState=(g,off,ph)=>{const G2=GAIT[g],f=frac(ph-off);if(f<G2.duty){const s=f/G2.duty;return[G2.R*(1-2*s),4,true]}const s=(f-G2.duty)/(1-G2.duty),e=s*s*(3-2*s);return[-G2.R+2*G2.R*e,g===3?2+Math.round(Math.abs(1-2*s)*1.6):3,false]};
/* quadro do cavalo (olhando +x), canvas 38×20, centro (19,10): g 0 parado,1 passo,2 trote,3 galope; pose 'rear' = empinando */
function horseBase(t,g,fi,pose){
const T=TEAM[t],c=mk(38,20),x=g2(c),P=(a,b,col)=>{x.fillStyle=col;x.fillRect(a,b,1,1)},R=(a,b,w,h,col)=>{x.fillStyle=col;x.fillRect(a,b,w,h)};
const coat=T.coat,hi=mix(coat,'#ffffff',.2),hh=mix(coat,'#ffffff',.34),dk=T.coatD,leg=mix(T.coat,'#ffffff',.06),hoof='#120d0a',mane=mix(T.coatD,'#000000',.45);
const cy=10,bx=17,rear=pose==='rear',G2=GAIT[g],ph=g?fi/G2.frames:0;
let e=1,tl=4,tw=0;/* extensão do pescoço, cauda (comprimento, ondulação) */
if(g===3){e=Math.round(1+Math.cos(TAU*(ph-.42)));tl=6;tw=1}else if(g===2){e=1;tl=5;tw=.6}else if(g===1){e=1+(fi%3===0?1:0);tl=4;tw=.4}else{e=fi===2?0:1;tl=4;tw=fi===1?1.2:0}
if(rear){e=-1;tl=5;tw=1}
/* pernas (antes do corpo; a raiz fica sob a barriga) */
const legs=g?G2.legs:[[-5,-1,0],[5,-1,0],[-5,1,0],[5,1,0]];
for(let i=0;i<4;i++){const[hx0,sd,off]=legs[i];let dx=0,len=4;
 if(g){[dx,len]=legState(g,off,ph);dx=Math.round(dx)}else if(fi===1&&i===2){dx=-1}
 if(rear){if(hx0>0){dx=3+((fi+i)&1);len=2+((fi+i+1)&1)}else{dx=-1;len=3}}
 const x0=bx+hx0,y0=cy+sd*3,x1=x0+dx,y1=y0+sd*len;PX.pline(x,x0,y0,x1,y1,leg);P(x0,y0,dk);P(x1,y1,hoof);if(len>=3)P(x0+Math.round(dx*.4),y0+sd,mix(leg,'#ffffff',.12))}
/* cauda */
for(let k=1;k<=tl;k++){const yy=cy+Math.round(Math.sin(fi*1.7+k*.9)*tw*(k/tl));P(bx-8-k,yy,k===tl?mix(mane,coat,.3):mane);if(k<=2)P(bx-8-k,yy+(k&1?-1:1),mane)}
/* corpo: elipse com quartos e paletas um pouco mais largos */
for(let j=-3;j<=3;j++){const w=Math.round(8.3*Math.sqrt(1-(j/3.8)*(j/3.8)));for(let i=-w;i<w;i++){let col=j<=-2?hi:j>=2?dk:coat;if(j===-3&&i>-w+2&&i<w-3)col=hh;if(j===-2&&(i===-w||i===w-1))col=coat;if(j===3&&(i===-w||i===w-1))col=leg;P(bx+i,cy+j,col)}}
for(const[i0,i1]of[[-7,-4],[3,6]]){for(let i=i0;i<=i1;i++){P(bx+i,cy-4,i===i0||i===i1?coat:hi);P(bx+i,cy+4,i===i0||i===i1?leg:dk)}}
for(let i=-6;i<5;i++)if(i<-3||i>2)P(bx+i,cy,mix(coat,dk,.35));/* espinha */
/* pescoço e cabeça (estica e recolhe no galope) */
const nx0=bx+7,nx1=bx+9+e;for(let i=nx0;i<=nx1;i++){P(i,cy-1,hi);P(i,cy,coat);P(i,cy+1,dk);P(i,cy,i>nx0?mane:coat)}
const hx0=nx1+1;for(let i=0;i<5;i++){const xx=hx0+i,mz=i>=3;P(xx,cy-1,mz?coat:hi);P(xx,cy,mz?(i===4?dk:coat):coat);P(xx,cy+1,mz?dk:coat)}
P(hx0+4,cy-1,dk);P(hx0+4,cy+1,leg);P(hx0,cy-2,dk);P(hx0,cy+2,leg);P(hx0+1,cy-2,mane);/* orelhas, focinho */
P(hx0+1,cy,mix(coat,'#000000',.45));P(hx0+2,cy-1,'#2a1d14');P(hx0+2,cy+1,'#2a1d14');/* testeira e freio */
/* manta (cor da facção), sela e botas do cavaleiro; rear: sem cavaleiro */
R(bx-3,cy-3,6,7,T.blanket);R(bx-3,cy+3,6,1,mix(T.blanket,'#000000',.35));R(bx-3,cy-3,6,1,mix(T.blanket,'#ffffff',.25));
R(bx-2,cy-2,4,5,'#6b4a2e');R(bx-2,cy-2,4,1,'#9a6e44');R(bx-2,cy-2,1,5,'#8a603a');R(bx-2,cy+2,4,1,'#4a3220');P(bx+2,cy,'#b08050');P(bx-3,cy,'#3a2618');
if(!rear){P(bx,cy-4,T.k);P(bx+1,cy-4,'#1f1a14');P(bx,cy+4,T.K);P(bx+1,cy+4,'#1f1a14')}
return c}
/* cavalo morto, deitado de lado (pernas para +y), tw = quadro de espernear */
function horseDeadBase(t,tw){
const T=TEAM[t],c=mk(40,24),x=g2(c),P=(a,b,col)=>{x.fillStyle=col;x.fillRect(a,b,1,1)};
const coat=mix(T.coat,'#3a2c22',.25),hi=mix(coat,'#ffffff',.14),dk=mix(T.coatD,'#000000',.1),leg=mix(T.coatD,'#000000',.2),hoof='#17120e',mane=mix(T.coatD,'#000000',.45),cy=10,bx=18;
for(const[hx0,dx0]of[[-6,-1],[-3,1],[5,1],[8,2]]){const k=tw&&(hx0===5||hx0===-6)?1:0;PX.pline(x,bx+hx0,cy+3,bx+hx0+dx0+k,cy+9-k,leg);P(bx+hx0+dx0+k,cy+9-k,hoof)}
for(let k=1;k<=5;k++)P(bx-9-k,cy+1+(k>3?1:0),mane);
for(let j=-3;j<=4;j++){const w=Math.round(8.6*Math.sqrt(1-(j/4.6)*(j/4.6)));for(let i=-w;i<w;i++)P(bx+i,cy+j,j<=-2?hi:j>=3?dk:coat)}
for(let i=-5;i<5;i++)P(bx+i,cy-3,mane);/* crina/costas */
for(let i=8;i<=11;i++){P(bx+i,cy-1,hi);P(bx+i,cy,coat);P(bx+i,cy+1,dk)}
for(let i=12;i<=16;i++){P(bx+i,cy,coat);P(bx+i,cy+1,i>14?dk:coat);P(bx+i,cy-1,i<14?hi:coat)}P(bx+16,cy,dk);P(bx+12,cy-2,dk);P(bx+13,cy+1,'#0f0b08');
x.fillStyle=T.blanket;x.fillRect(bx-3,cy-3,6,3);x.fillStyle=mix(T.blanket,'#000000',.35);x.fillRect(bx-3,cy,6,1);x.fillStyle='#3b2a1c';x.fillRect(bx-2,cy-2,4,2);
P(bx,cy+2,'#5a4330');P(bx,cy+3,'#2a1d14');/* estribo caído */
return c}
const horseSprite=(t,d,g,fi,pose)=>memo(`c${t}${d}${g}${fi}${pose}`,()=>{V.stats.horses++;return spin(horseBase(t,g,fi,pose),d*TAU/16)});
const deadHorse=(t,d,tw,side)=>memo(`dh${t}${d}${tw}${side}`,()=>{let b=horseDeadBase(t,tw);if(side<0){const c=mk(b.width,b.height),x=g2(c);x.translate(0,b.height);x.scale(1,-1);x.drawImage(b,0,0);b=c}return spin(b,d*TAU/16)});
/* armas do cavaleiro (mesmo traço do art.js: segmentos ao longo do ângulo) */
function weapon(x,cx,cy,a,parts){const c=Math.cos(a),s=Math.sin(a);for(const[f,t,col]of parts){x.fillStyle=col;for(let d=f;d<=t;d+=.5)x.fillRect(Math.round(cx+c*d),Math.round(cy+s*d),1,1)}}
const SABER=[[0,2,'#8a6238'],[2,12,'#d6dccf']],LANCE=[[-4,2,'#8a6238'],[2,19,'#b18a52'],[19,22,'#e3e8da']];
/* sprite completo 48×48 (âncora 25,27 como o art.js): cavalo girado + cavaleiro em pé por cima, com quique e pose da arma */
function cavSprite(t,d,g,fi,pose){return memo(`v${t}${d}${g}${fi}${pose}`,()=>{
const a=d*TAU/16,s=Math.sin(a),co=Math.cos(a),facing=s>.55?'front':s<-.55?'back':'side',c=mk(48,48),x=g2(c);x.imageSmoothingEnabled=false;
const G2=GAIT[g],ph=g?fi/G2.frames:0;let hb=0,rb=0;
if(g===3){let sup=0;for(const l of G2.legs)if(legState(3,l[2],ph)[2])sup++;hb=sup===0?-1:0;rb=frac(ph-.36)<.5?0:-1}
else if(g===2){rb=ph<.5?-1:0;hb=frac(ph+.22)<.5?0:-1}else if(g===1)rb=fi%3===1?-1:0;
const hr=horseSprite(t,d,g,fi,'n').c;x.drawImage(hr,24-(hr.width>>1),27-(hr.height>>1)+hb);
const sx=Math.round(co*-2.2),sy=Math.round(s*-2.2),rx=20+sx,ry=13+sy+hb+rb,body=riderCanvas(t,facing,facing==='side'&&co<0?1:0);
const fw=co>=0?1:-1,hx=24+sx+co*2,hy=19+sy+hb+rb+s*2;let draw;
if(t===0){if(pose===1)draw=()=>{weapon(x,hx-fw*1,hy-4,-Math.PI/2+fw*.42,SABER);if(fi%4===1)x.fillStyle='#ffffff',x.fillRect(Math.round(hx-fw+Math.cos(-Math.PI/2+fw*.42)*9),Math.round(hy-4+Math.sin(-Math.PI/2+fw*.42)*9),1,1)};
 else if(pose===2)draw=()=>weapon(x,hx,hy,a,SABER);else draw=()=>weapon(x,hx-fw,hy-1,-Math.PI/2-fw*.55,SABER)}
else{const la=pose?a:-Math.PI/2-fw*.22,L=pose?LANCE:[[-3,1,'#8a6238'],[1,14,'#b18a52'],[14,16,'#e3e8da']],pd=pose?16:11;
 draw=()=>{weapon(x,hx,hy,la,L);const lc=Math.cos(la),ls=Math.sin(la),px0=hx+lc*pd,py0=hy+ls*pd,nx=-ls,ny=lc,fl=(fi&1)?1:0;/* flâmula preta e branca dos Ulanos */
  for(let k=0;k<3;k++){const bx=Math.round(px0-lc*k+(pose?0:-fw*k*.6)),by=Math.round(py0-ls*k+(pose?fl*(k>0?1:0):0));x.fillStyle='#e8e6d6';x.fillRect(bx+Math.round(nx*(pose?1:0)),by+(pose?0:1),1,1);x.fillStyle='#1d1d1d';x.fillRect(bx+Math.round(nx*(pose?2:0))+(pose?0:(fl?-1:0)),by+(pose?Math.round(ny):2),1,1)}}}
if(s<-.35)draw();x.drawImage(body,rx,ry);if(s>=-.35)draw();
return{c:gpu(outlined(c)),ax:25,ay:27}})}

/* ============ partículas (pools próprios) ============ */
const PU=[],MAXP=900;/* k: 0 fumaça, 1 poeira, 2 faísca, 3 torrão/lasca (z), 4 brasa, 5 traçante, 6 clarão, 7 jato de fogo */
function add(k,x,y,z,vx,vy,vz,t,s,col,lay){if(PU.length>=MAXP)return null;const p={k,x,y,z,vx,vy,vz,t,max:t,s,col,lay,st:0};PU.push(p);return p}
const SMK=['#2a2622','#3d3833','#57524b','#7a746a','#9a948a'],EXH=['#55595e','#6d7177','#888c90','#a3a6a8'];
const puffMemo=new Map();function puffSpr(r,c1,c2){const k=r+c1+c2;let s=puffMemo.get(k);if(!s){const c=mk(r*2+3,r*2+3),x=g2(c);PX.disc(x,r+1,r+1,r,c1);if(r>1)PX.disc(x,r,r,Math.max(1,Math.round(r*.55)),c2);s=gpu(c);puffMemo.set(k,s)}return s}
let windX=0,windY=0;
function tickParts(dt){for(let i=PU.length-1;i>=0;i--){const p=PU[i];p.t-=dt;if(p.t<=0){if(p.k===3&&p.stamp)stampBit(p);PU[i]=PU[PU.length-1];PU.pop();continue}
 if(p.k===0||p.k===1||p.k===4){p.x+=(p.vx+windX*.6)*dt;p.y+=(p.vy+windY*.6)*dt;const dr=p.k===1?Math.exp(-2.2*dt):Math.exp(-.9*dt);p.vx*=dr;p.vy*=dr;if(p.k===4)p.vy-=8*dt}
 else{p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.k===3||p.k===2){p.z+=p.vz*dt;p.vz-=(p.k===2?160:300)*dt;if(p.z<=0){p.z=0;if(p.k===3){if(p.stamp&&!p.st){stampBit(p);p.st=1;p.t=0}else{p.vz=-p.vz*.25;p.vx*=.4;p.vy*=.4;if(Math.abs(p.vz)<10){p.vx=p.vy=p.vz=0}}}else{p.vz=-p.vz*.3;p.vx*=.5;p.vy*=.5}}}
  else if(p.k===7){p.z+=p.vz*dt;p.vz*=Math.exp(-2*dt)}}}}
/* pedacinho que cai fica no chão (pintado no terreno; orçamento por segundo) */
let stampBudget=0;function stampBit(p){const g=window.PXGAME&&PXGAME.tctx;if(!g||stampBudget<=0)return;stampBudget--;g.fillStyle=p.col;g.fillRect(Math.round(p.x*Z),Math.round(p.y*Z),p.s>1?2:1,1)}
function drawParts(c,ox,oy,lay){for(let i=0;i<PU.length;i++){const p=PU[i];if(p.lay!==lay)continue;if(p.k<2&&p.t<p.max*.12)continue;const x=ox+Math.round(p.x*Z),y=oy+Math.round((p.y-p.z)*Z);if(x<-30||y<-40||x>vw+30||y>vh+30)continue;const age=1-p.t/p.max;
 if(p.k===0){const r=Math.max(1,Math.round(p.s*(1+age*1.1))),tone=p.col===1?EXH:SMK,ix=p.col===1?Math.min(3,Math.floor(age*3.2)):Math.min(4,Math.floor(age*4.5)+(p.col===2?2:0));c.globalAlpha=age>.8?.16:age>.6?.32:age>.35?.52:.74;const kk=r*8+ix;if(p.lk!==kk){p.lk=kk;p.ls=puffSpr(r,tone[Math.min(tone.length-1,ix)],tone[Math.min(tone.length-1,ix+1)])}c.drawImage(p.ls,x-r-1,y-r-1)}
 else if(p.k===1){const r=Math.max(1,Math.round(p.s*(.6+age*.8)));c.globalAlpha=age>.7?.2:age>.4?.38:.55;if(p.lk!==r){p.lk=r;p.ls=puffSpr(r,p.col,p.col2||p.col)}c.drawImage(p.ls,x-r-1,y-r-1)}
 else if(p.k===2){c.globalAlpha=1;rect(c,x,y,1,1,age<.3?'#fff3c2':age<.6?'#ffb347':'#c8501c');if(p.z>0&&age<.5){const tx=Math.round(-p.vx*Z*.03),ty=Math.round((-p.vy+p.vz)*Z*.03);if(tx||ty)rect(c,x+tx,y+ty,1,1,'#ff8a2a')}}
 else if(p.k===3){c.globalAlpha=1;if(p.z>2)rect(c,ox+Math.round(p.x*Z),oy+Math.round(p.y*Z),1,1,'rgba(15,18,10,.45)');rect(c,x,y,p.s,p.s>1&&((p.t*20|0)&1)?1:p.s,p.col)}
 else if(p.k===4){c.globalAlpha=age>.7?.5:1;rect(c,x,y,1,1,((p.t*30|0)&1)?'#ffcf5a':'#e0641e')}
 else if(p.k===5){c.globalAlpha=1;const l=hyp(p.vx,p.vy)||1;PX.pline(c,x,y,x-Math.round(p.vx/l*3),y-Math.round(p.vy/l*3),'#ffe9a0');rect(c,x,y,1,1,'#ffffff')}
 else if(p.k===6){const k=age;c.globalAlpha=1;const r=Math.round(p.s*(k<.35?1:.6));if(k<.35){c.globalAlpha=.25;c.drawImage(puffSpr(r+3,'#ffcf6a','#ffcf6a'),x-r-4,y-r-4);c.globalAlpha=1;rect(c,x-r,y,r*2+1,1,'#ffd466');rect(c,x,y-r,1,r*2+1,'#ffd466');rect(c,x-1,y-1,3,3,'#fffbe0')}else{rect(c,x-1,y-1,3,3,'#ff8a2a');rect(c,x,y,1,1,'#ffd466')}}
 else if(p.k===7){const h=Math.round(p.s*(1-age*.5));c.globalAlpha=1;for(let j=0;j<h;j++){const w=j<h*.3?2:1,col=j<h*.25?'#fff2b0':j<h*.55?'#ffcf5a':j<h*.8?'#ff8f2a':'#c8401c';rect(c,x-w+((hash(j,p.t*20|0,3)*2)|0)-1+1,y-j,w*2-1,1,col)}}}
 c.globalAlpha=1}
/* chama de pixel (lingueta tremulando); h em px */
function flame(c,x,y,h,seed){const f=(time*14+seed*3.7)|0;for(let i=-1;i<=1;i++){const hh=Math.max(1,Math.round(h*(i?.6:1)*(.7+hash(i,f,seed)*.5)));for(let j=0;j<hh;j++){const q=j/hh;rect(c,x+i,y-j,1,1,q>.8?'#fff2b0':q>.55?'#ffcf5a':q>.25?'#ff8f2a':'#c8401c')}}
 if(hash(f,seed,9)>.6)rect(c,x+((hash(f,seed,5)*3)|0)-1,y-h-1,1,1,'#ffd98a')}

/* ============ estado por tanque ============ */
const tst=u=>u._vh||(u._vh={pa:0,pb:0,lx:u.x,ly:u.y,lh:null,va:null,vf:0,scars:[],ex:rnd(0,.3),du:0,tm:0,mud:0,mg:0,mgB:0,v:0,acc:0});
function aimOf(u){if(u===player&&typeof mode!=='undefined'&&mode==='soldier'&&typeof mouse!=='undefined')return Math.atan2(mouse.wy-u.y,mouse.wx-u.x);const t=u.target;if(t&&t.hp>0&&hyp(t.x-u.x,t.y-u.y)<520)return Math.atan2(t.y-u.y,t.x-u.x);return null}
const hdgOf=u=>u.pv&&u.pv.hdg===u.pv.hdg?u.pv.hdg:(u.angle||0);
const groundAt=(x,y)=>{const W2=window.PXW;return{d:W2?W2.depth(x,y):0,m:W2&&W2.mudAt?W2.mudAt(x,y):0}};
const snowy=()=>!!(window.PXGAME&&PXGAME.base&&PXGAME.base.P&&PXGAME.base.P.snow);
function emitWorld(u,lx,ly,d){const[dx,dy]=rot(lx,ly,d,16);return[u.x+dx/Z,u.y+dy/Z]}
function tickTank(u,dt){const s=tst(u),t=u.team?1:0,g=G[t],h=hdgOf(u),d=dir16(h);if(s.lh===null)s.lh=h;
 const dx=u.x-s.lx,dy=u.y-s.ly,jump=dx*dx+dy*dy>90*90,f=jump?0:dx*Math.cos(h)+dy*Math.sin(h),dh=jump?0:angDiff(h,s.lh);s.lx=u.x;s.ly=u.y;s.lh=h;
 const bog=u.atr&&u.atr.bog>time,v=dt>0?f/dt:0;s.acc=s.acc*.9+(v-s.v)*.1;s.v+=(v-s.v)*Math.min(1,dt*6);
 s.pa+=(f+dh*g.hw)/2;s.pb+=(f-dh*g.hw)/2;if(bog){s.pa+=dt*26;s.pb+=dt*26}
 /* torre do FT: gira até o alvo (manivela: ~1,7 rad/s); sem alvo, volta devagar para a frente */
 if(t===0){const aim=aimOf(u);if(s.va===null)s.va=h;const want=aim===null?h:aim,rate=aim===null?.8:1.7,e=angDiff(want,s.va);s.va+=clamp(e,-rate*dt,rate*dt)}
 if(s.vf>0)s.vf=Math.max(0,s.vf-dt);
 const G0=groundAt(u.x,u.y),wet=G0.d>=.12,mud=G0.m>.3||bog,sp=Math.abs(s.v),mov=sp>4||Math.abs(dh)>dt*.15;
 /* escape: marcha lenta = baforadas em par; acelerando/atolado = fumaça escura e grossa */
 s.ex-=dt;if(s.ex<=0){const hard=bog||s.acc>.6,idle=!mov;s.ex=bog?.08:hard?.11:idle?(((time*1.3+u.id)|0)%2?.22:.6):.22;
  for(const[ex,ey]of g.ex){const[wx,wy]=emitWorld(u,ex,ey,d),[bx,by]=rot(-1,0,d,16);add(0,wx,wy,6,bx*rnd(10,22)+rnd(-4,4),by*rnd(10,22)-rnd(6,14),0,hard?rnd(1.1,1.7):rnd(.7,1.1),hard?rnd(2,3):rnd(1,2),hard?2:1,1)}}
 /* esteiras: poeira no seco, pó na neve, torrões na lama; nada na água */
 if(!wet&&(mov||bog)){s.du-=dt*(bog?3:clamp(sp/18,.4,2.2));if(s.du<=0){s.du=.2;
  for(const sd of[-1,1]){const[wx,wy]=emitWorld(u,g.trkX,sd*g.trk,d),[bx,by]=rot(-1,sd*.3,d,16);
   if(mud){for(let k=0;k<(bog?3:2);k++){const p=add(3,wx+rnd(-4,4),wy+rnd(-3,3),rnd(4,8),bx*rnd(20,60)+rnd(-15,15),by*rnd(20,60)+rnd(-15,15),rnd(40,95),1.4,Math.random()<.4?2:1,Math.random()<.5?'#2a2017':'#3f3020',1);if(p)p.stamp=1}}
   else{const sn=snowy();const p=add(1,wx+rnd(-3,3),wy+rnd(-2,2)+4,0,bx*rnd(6,16)+rnd(-5,5),by*rnd(6,16)+rnd(-8,-2),0,rnd(.9,1.5),rnd(3,5)*(t?1.25:1),sn?'#dfe8e6':Math.random()<.5?'#a08d6a':'#8f7d5c',0);if(p)p.col2=sn?'#f4f8f6':'#b5a57c';
    if(Math.random()<.35)add(3,wx,wy,2,bx*rnd(30,60)+rnd(-20,20),by*rnd(30,60)+rnd(-20,20),rnd(20,50),.8,1,sn?'#c9d4d2':'#6b5a40',1)}}}
  /* marcas das sapatas no chão seco (o weather.js já marca a lama/água) */
  if(!mud&&!bog){s.tm+=Math.abs(f);if(s.tm>5){s.tm=0;markTrack(u,h,t)}}}
 /* MGs do A7V: rajadas curtas para o lado do alvo (só visual) */
 if(t===1){s.mg=Math.max(0,s.mg-dt);if(s.mg<=0){const tg=u.target;if(tg&&tg.hp>0&&tg.type!=='tank'&&hyp(tg.x-u.x,tg.y-u.y)<330&&Math.random()<.5){s.mg=rnd(.5,.9);s.mgB=time}else s.mg=rnd(.6,1.6);if(s.mgB!==time)s.mgB=-9}}
 /* avaria: fumaça do cofre do motor, fogo e faíscas com o casco muito batido */
 const hp=u.hp/u.maxhp;if(hp<.6&&Math.random()<dt*(hp<.3?9:4)){const[fx,fy]=g.fire[t?2:1],[wx,wy]=emitWorld(u,fx,fy,d);add(0,wx+rnd(-3,3),wy,8,rnd(-4,4),rnd(-16,-8),0,rnd(1.4,2.2),rnd(2,4),hp<.3?0:2,1)}
 if(hp<.3&&Math.random()<dt*4){const[fx,fy]=g.fire[1],[wx,wy]=emitWorld(u,fx,fy,d);add(4,wx+rnd(-3,3),wy,6,rnd(-6,6),rnd(-30,-14),0,rnd(.4,.8),1,0,1)}}
function markTrack(u,h,t){const g=window.PXGAME&&PXGAME.tctx;if(!g||stampBudget<=0)return;stampBudget--;const G2=G[t],c=Math.cos(h),s=Math.sin(h),sn=snowy(),w=t?4:3;
 g.fillStyle=sn?'rgba(150,160,170,.16)':'rgba(32,24,14,.12)';
 for(const sd of[-1,1]){const cx=u.x*Z+(-s)*sd*G2.trk+c*(G2.rear*.4),cy=u.y*Z+c*sd*G2.trk+s*(G2.rear*.4);for(let k=-((w-1)>>1);k<=(w>>1);k++)g.fillRect(Math.round(cx-s*k),Math.round(cy+c*k),1,1)}}

/* ============ desenho do tanque ============ */
function tiltOf(pv){let p=pv.pt+(pv.pa||0);const t=time-pv.pk;if(t>=0&&t<.3)p+=(pv.pkA||1)*Math.exp(-7*t)*Math.cos(TAU*5*t)*.9;return clamp(p,-1.3,1.3)}
const FLASH=[];/* clarões do quadro (coordenadas de tela), desenhados na camada de cima */
function drawTank(c,u,sx,sy){const s=tst(u),t=u.team?1:0,g=G[t],pv=u.pv,h=hdgOf(u),d=dir16(h),hp=u.hp/u.maxhp,dv=hp<.4?1:0;
 const sp=hullSprite(t,d,((Math.floor(s.pa)%3)+3)%3,((Math.floor(s.pb)%3)+3)%3,dv);
 let x0=sx-sp.ax,y0=sy-sp.ay;const qa=d*TAU/16,qc=Math.cos(qa),qs=Math.sin(qa);
 /* coice: o casco recua 1-2 px na direção oposta ao tiro (torre do FT: cano recua) */
 if(s.vf>0){const k=s.vf/.2,fa=t?qa:(s.va??qa),rk=Math.round(k*(t?2:1.4));x0-=Math.round(Math.cos(fa)*rk);y0-=Math.round(Math.sin(fa)*rk)}
 /* motor em marcha lenta: tremor de 1 px intermitente */
 else if(Math.abs(s.v)<3&&!(u.atr&&u.atr.bog>time)&&((time*15+u.id*7)|0)%5===0)y0+=1;
 else if(u.atr&&u.atr.bog>time&&((time*20)|0)%2)x0+=((time*40)|0)%2?1:-1;
 const amp=pv&&PHYS.on?Math.round(clamp(tiltOf(pv),-1.3,1.3)*1.6):0,cs=Math.cos(h),sn=Math.sin(h);let tdy=0;
 if(!amp)c.drawImage(sp.c,x0,y0);
 else if(Math.abs(cs)>=Math.abs(sn)){const cut=sp.ax,fr=cs>0,w=sp.c.width,H=sp.c.height;c.drawImage(sp.c,0,0,cut,H,x0,y0+(fr?amp:-amp),cut,H);c.drawImage(sp.c,cut,0,w-cut,H,x0+cut,y0+(fr?-amp:amp),w-cut,H);tdy=-amp}
 else{tdy=Math.round(sn*amp*.6);c.drawImage(sp.c,x0,y0+tdy)}
 const cx=x0+sp.ax,cy=y0+sp.ay;
 /* cicatrizes de impacto (pixels no casco, giram com a direção quantizada) */
 for(const sc of s.scars){const[ox_,oy_]=rot(sc[0],sc[1],d,16),px=Math.round(cx+ox_),py=Math.round(cy+oy_+(amp?(sc[0]>=0?tdy:-tdy):0));rect(c,px,py,1,1,'#0c0a08');rect(c,px-1,py-1,1,1,sc[2]?'#9ca292':'#6b7062');if(time-sc[3]<.25)rect(c,px,py,1,1,'#fff3c2')}
 /* torre do FT (32 direções) com sombra própria para baixo-direita */
 let mx,my,ma;
 if(t===0){const va=s.va??h,td=dir32(va),rec=s.vf>.14?2:s.vf>.06?1:0,ts=turretSprite(td,rec,dv),px=cx+Math.round(qc*g.piv),py=cy+Math.round(qs*g.piv)+tdy;
  c.globalAlpha=.42;c.drawImage(ts.sh,px-ts.ax+1,py-ts.ay+1);c.globalAlpha=1;c.drawImage(ts.c,px-ts.ax,py-ts.ay);
  const ta=td*TAU/32;ma=ta;mx=px+Math.round(Math.cos(ta)*(g.muz+.5));my=py+Math.round(Math.sin(ta)*(g.muz+.5))}
 else{ma=qa;mx=cx+Math.round(qc*(g.muz-.5));my=cy+Math.round(qs*(g.muz-.5))}
 if(s.vf>0)FLASH.push(mx,my,ma,1-s.vf/.2,t,u.id);
 /* MGs do A7V piscando nas casamatas do lado do alvo */
 if(t===1&&s.mgB>0&&s.mg>0&&u.target){const ta=Math.atan2(u.target.y-u.y,u.target.x-u.x);for(const m of g.mg){const[nx,ny]=rot(m[2],m[3],d,16);if(nx*Math.cos(ta)+ny*Math.sin(ta)<.35)continue;if(((time*24+m[0])|0)%3)continue;const[ox_,oy_]=rot(m[0],m[1],d,16),px=Math.round(cx+ox_+nx*2),py=Math.round(cy+oy_+ny*2);rect(c,px,py,1,1,'#fffbe0');rect(c,px+Math.round(nx),py+Math.round(ny),1,1,'#ffd466');if(((time*24)|0)%2)rect(c,px+Math.round(nx*2),py+Math.round(ny*2),1,1,'#ff9b32')}}
 /* fogo saindo das venezianas quando muito avariado */
 if(hp<.3){const[ox_,oy_]=rot(g.fire[1][0],g.fire[1][1],d,16);flame(c,Math.round(cx+ox_),Math.round(cy+oy_),3+((hp<.15)?2:0),u.id)}
 V.stats.tanksDrawn++}
/* clarão do canhão: estágio 1 = estrela branca + cone + jatos laterais; estágio 2 = bola laranja e brasas */
function drawFlash(c,x,y,a,k,t,id){const ca=Math.cos(a),sa=Math.sin(a),big=t===1,L=big?20:15,j=i=>hash(i,id,(time*50)|0)*.25;
 if(k<.4){c.globalAlpha=.22;c.drawImage(puffSpr(big?12:9,'#ffcf6a','#ffcf6a'),x-(big?13:10),y-(big?13:10));c.globalAlpha=1;
  for(const[o,m,col]of[[0,1,'#fff6cc'],[-.22,.75,'#ffd466'],[.22,.75,'#ffd466'],[-.5,.45,'#ffa83a'],[.5,.45,'#ffa83a']]){const l=L*m*(1+j(o*10));PX.pline(c,x,y,x+Math.round(Math.cos(a+o)*l),y+Math.round(Math.sin(a+o)*l),col)}
  for(const o of[Math.PI/2,-Math.PI/2])PX.pline(c,x,y,x+Math.round(Math.cos(a+o)*(big?6:4)),y+Math.round(Math.sin(a+o)*(big?6:4)),'#ff9b32');
  rect(c,x-2,y-2,5,5,'#ffd466');rect(c,x-1,y-1,3,3,'#fffbe0');rect(c,x,y,1,1,'#ffffff')}
 else if(k<.8){const r=k<.6?3:2,fx=x+Math.round(ca*4),fy=y+Math.round(sa*4);rect(c,fx-r,fy-r+1,r*2+1,r*2-1,'#d8571f');rect(c,fx-r+1,fy-r,r*2-1,r*2+1,'#d8571f');rect(c,fx-r+1,fy-r+1,r*2-1,r*2-1,'#f5a235');rect(c,fx-1,fy-1,2,2,'#ffe08a')}}

/* ============ destruição de tanque ============ */
const WR=[],DEB=[];/* carcaças sob meu controle (todas as mortes) e destroços no chão */
function scorch(x,y,t){const g=window.PXGAME&&PXGAME.tctx;if(!g)return;const cx=Math.round(x*Z),cy=Math.round(y*Z),rx=t?30:24,ry=t?16:13,sd=(Math.random()*1e4)|0;
 for(let j=-ry-3;j<=ry+3;j++)for(let i=-rx-4;i<=rx+4;i++){const r=Math.hypot(i/rx,j/ry)+(fbm(i/5,j/5,sd)-.5)*.55;if(r>1)continue;const q=r<.45?.42:r<.75?.28:.16;if(r>.8&&((i+j)&1))continue;g.fillStyle=`rgba(18,12,8,${q})`;g.fillRect(cx+i,cy+j,1,1)}}
function tankDeath(u){const s=tst(u),t=u.team?1:0,g=G[t],d=dir16(u.angle||0),now=time,big=nearCam(u.x,u.y);V.stats.deaths++;
 const pop=t===0&&Math.random()<.6;const W2={x:u.x,y:u.y,t,d,va:s.va??(u.angle||0),t0:now,pop,cook:rnd(6,10),seed:(Math.random()*999)|0,tx:u.x,ty:u.y,tz:0,tvx:0,tvy:0,tvz:0,td:dir32(s.va??0),tland:pop?0:1,nf:0};
 WR.push(W2);if(WR.length>26){const o=WR.shift();bake(o)}
 scorch(u.x,u.y,t);
 const fp=g.fire[0],[cx,cy]=emitWorld(u,fp[0],fp[1],d);
 /* clarão interno + jato de fogo vertical pela escotilha/anel da torre */
 add(6,cx,cy,8,0,0,0,.3,t?9:7,0,1);for(let k=0;k<(t?10:8);k++)add(7,cx+rnd(-3,3),cy+rnd(-2,2),4,rnd(-6,6),rnd(-6,6),rnd(90,170),rnd(.35,.8),rnd(5,10),0,1);
 /* torre arrancada (FT) ou chapas do teto (A7V), escotilhas, elos de esteira e estilhaços */
 if(pop){V.stats.turretsPopped++;const a=rnd(0,TAU),v=rnd(22,42);W2.tvx=Math.cos(a)*v;W2.tvy=Math.sin(a)*v*.7;W2.tvz=rnd(170,230);W2.tz=6;W2.spin=rnd(-14,14)}
 const plates=t?4:2;for(let k=0;k<plates;k++){const a=rnd(0,TAU),v=rnd(40,110);const p=add(3,cx,cy,8,Math.cos(a)*v,Math.sin(a)*v*.7,rnd(110,220),3.5,2,t?(Math.random()<.5?'#5c6152':'#7d6a46'):'#474e2b',1);if(p){p.plate=1;p.stamp=1}}
 for(let k=0;k<14;k++){const a=rnd(0,TAU),v=rnd(30,140);const p=add(3,u.x+rnd(-10,10),u.y+rnd(-6,6),4,Math.cos(a)*v,Math.sin(a)*v*.7,rnd(60,190),2.5,Math.random()<.4?2:1,k%3?'#23251d':'#3b3e35',1);if(p)p.stamp=1}
 for(let k=0;k<22;k++){const a=rnd(0,TAU),v=rnd(60,200);add(2,cx,cy,8,Math.cos(a)*v,Math.sin(a)*v*.7,rnd(60,200),rnd(.5,1.1),1,0,1)}
 for(let k=0;k<6;k++)add(0,u.x+rnd(-12,12),u.y+rnd(-7,7),rnd(6,16),rnd(-10,10),rnd(-30,-14),0,rnd(1.8,2.8),rnd(3,5),0,1);
 if(big&&typeof screenShake!=='undefined')screenShake=Math.max(screenShake,4)}
const nearCam=(x,y)=>typeof cam!=='undefined'&&Math.abs(x-cam.x)<vw/Z*.6&&Math.abs(y-cam.y)<vh/Z*.6;
/* intensidade do fogo pelo tempo de vida: inferno → chamas → brasa (fumaça fina eterna) */
const fireK=a=>a<4?1:a<45?1-(a-4)/41*.6:a<90?.4-(a-45)/45*.32:0;
function tickWrecks(dt){for(const w of WR){const a=time-w.t0,g=G[w.t],fk=fireK(a);
 if(w.pop&&!w.tland){w.tx+=w.tvx*dt;w.ty+=w.tvy*dt;w.tz+=w.tvz*dt;w.tvz-=330*dt;w.td=(w.td+Math.round(w.spin*dt*3)+32)%32;if(w.tz<=0){w.tz=0;if(w.tvz<-60){w.tvz=-w.tvz*.28;w.tvx*=.45;w.tvy*=.45;w.spin*=.4;dustRing(w.tx,w.ty,6,.7)}else{w.tland=1;dustRing(w.tx,w.ty,8,1);const p=Math.random();if(p<.5&&window.sound&&nearCam(w.tx,w.ty))sound('thud')}}}
 /* munição detonando: estalos com faíscas, traçantes e baforadas, mais frequentes no começo */
 if(a>.25&&a<w.cook&&Math.random()<dt*(a<2.5?5:2.2)*(1-a/w.cook*.6)){V.stats.cookoffs++;const fp=g.fire[(Math.random()*g.fire.length)|0],[ox_,oy_]=rot(fp[0],fp[1],w.d,16),x=w.x+ox_/Z,y=w.y+oy_/Z;
  add(6,x,y,6,0,0,0,.12,rnd(3,5),0,1);for(let k=0;k<7;k++){const an=rnd(0,TAU),v=rnd(50,150);add(2,x,y,6,Math.cos(an)*v,Math.sin(an)*v*.7,rnd(40,160),rnd(.3,.7),1,0,1)}
  if(Math.random()<.45){const an=rnd(0,TAU),v=rnd(260,380);add(5,x,y,6,Math.cos(an)*v,Math.sin(an)*v,0,rnd(.12,.3),1,0,1)}
  add(0,x,y,8,rnd(-6,6),rnd(-24,-10),0,rnd(1.2,2),rnd(3,5),0,1);if(Math.random()<.3&&window.sound&&nearCam(x,y))sound(Math.random()<.5?'shot':'ping')}
 /* coluna de fumaça (preta com fogo, cinza na brasa) e brasas subindo */
 w.nf-=dt;if(w.nf<=0){w.nf=fk>0?.1+(1-fk)*.22:rnd(1.2,2.6);const fp=g.fire[(Math.random()*Math.min(2,g.fire.length))|0],[ox_,oy_]=rot(fp[0],fp[1],w.d,16);
  add(0,w.x+ox_/Z+rnd(-3,3),w.y+oy_/Z,10,rnd(-4,4),-rnd(26,42)*(fk>0?1:.6),0,fk>0?rnd(2.6,3.8):rnd(2,3),fk>0?rnd(2,3.4)*(.7+fk*.5):rnd(1.5,2.2),fk>.2?0:2,1);
  if(fk>.15&&Math.random()<.7)add(4,w.x+ox_/Z+rnd(-3,3),w.y+oy_/Z,8,rnd(-8,8),rnd(-40,-20),0,rnd(.6,1.2),1,0,1)}}}
function dustRing(x,y,n,s){const sn=snowy();for(let k=0;k<n;k++){const a=k/n*TAU+rnd(-.2,.2),v=rnd(30,60)*s;const p=add(1,x+Math.cos(a)*4,y+Math.sin(a)*3,0,Math.cos(a)*v,Math.sin(a)*v*.6-4,0,rnd(.6,1),rnd(2,4)*s,sn?'#dfe8e6':'#9a8866',0);if(p)p.col2=sn?'#f4f8f6':'#b5a57c'}}
/* carcaça além do teto da lista: pinta no terreno (fica para sempre, sem fumaça) */
function bake(w){const g=window.PXGAME&&PXGAME.tctx;if(!g)return;try{const sp=PX.wreckSprite(w.t,w.d);g.drawImage(sp.c,Math.round(w.x*Z)-sp.ax,Math.round(w.y*Z)-sp.ay);if(w.t===0){const ts=turretSprite(w.td,0,2),[px,py]=w.pop?[w.tx*Z,w.ty*Z]:[w.x*Z+Math.cos(w.d*TAU/16)*2,w.y*Z+Math.sin(w.d*TAU/16)*2];g.drawImage(ts.c,Math.round(px)-ts.ax,Math.round(py)-ts.ay)}}catch(e){fail(e)}}
/* desenha: casco próprio quando o pixel.js já descartou a carcaça (60 s); torre no lugar/no chão; fogo nos pontos quentes */
function drawWreckGround(c,ox,oy){for(const w of WR){const a=time-w.t0,x=ox+Math.round(w.x*Z),y=oy+Math.round(w.y*Z);if(x<-60||y<-60||x>vw+60||y>vh+60)continue;
 if(a>=59.98){const sp=PX.wreckSprite(w.t,w.d);c.drawImage(sp.c,x-sp.ax,y-sp.ay)}
 if(w.t===0&&w.pop&&w.tland){const ts=turretSprite(w.td,0,2),tx=ox+Math.round(w.tx*Z),ty=oy+Math.round(w.ty*Z);c.globalAlpha=.35;c.drawImage(ts.sh,tx-ts.ax+1,ty-ts.ay+2);c.globalAlpha=1;c.drawImage(ts.c,tx-ts.ax,ty-ts.ay)}
 if(a>=59.98&&w.t===0&&!w.pop)wreckTurret(c,w,x,y)}}
function wreckTurret(c,w,x,y){const ts=turretSprite(w.td,0,2),qa=w.d*TAU/16,px=x+Math.round(Math.cos(qa)*2),py=y+Math.round(Math.sin(qa)*2);c.globalAlpha=.4;c.drawImage(ts.sh,px-ts.ax+1,py-ts.ay+1);c.globalAlpha=1;c.drawImage(ts.c,px-ts.ax,py-ts.ay)}
/* antes das unidades (logo depois do laço de carcaças do pixel.js): torre sobre a carcaça "nova" */
function drawPre(c,ox,oy){for(const w of WR){const a=time-w.t0;if(a>=59.98||w.t!==0||w.pop)continue;const x=ox+Math.round(w.x*Z),y=oy+Math.round(w.y*Z);if(x<-60||y<-60||x>vw+60||y>vh+60)continue;wreckTurret(c,w,x,y)}}
function drawWreckAir(c,ox,oy){for(const w of WR){const a=time-w.t0,g=G[w.t],x=ox+Math.round(w.x*Z),y=oy+Math.round(w.y*Z);if(x<-80||y<-90||x>vw+80||y>vh+60)continue;const fk=fireK(a);
 if(w.pop&&!w.tland){const ts=turretSprite(w.td,0,2),tx=ox+Math.round(w.tx*Z),ty=oy+Math.round(w.ty*Z);c.globalAlpha=.3;c.drawImage(ts.sh,tx-ts.ax,ty-ts.ay+2);c.globalAlpha=1;c.drawImage(ts.c,tx-ts.ax,ty-ts.ay-Math.round(w.tz*Z))}
 if(fk>0){const n=fk>.6?g.fire.length:fk>.3?2:1;for(let i=0;i<n;i++){const fp=g.fire[i],[ox_,oy_]=rot(fp[0],fp[1],w.d,16);{const fh=Math.max(2,Math.round((i?5:8)*fk*(w.pop&&i===0?1.3:1)+(a<3?4:0)));c.globalAlpha=.18;c.drawImage(puffSpr(fh>6?5:3,'#ff9a2e','#ffcf5a'),x+Math.round(ox_)-(fh>6?6:4),y+Math.round(oy_)-(fh>6?7:5));c.globalAlpha=1;flame(c,x+Math.round(ox_),y+Math.round(oy_),fh,w.seed+i);if(fh>5){flame(c,x+Math.round(ox_)-2,y+Math.round(oy_)+1,fh-3,w.seed+i+7);flame(c,x+Math.round(ox_)+2,y+Math.round(oy_),fh-2,w.seed+i+13)}}}}
 else if(((time*3+w.seed)|0)%4===0){const[ox_,oy_]=rot(g.fire[0][0],g.fire[0][1],w.d,16);rect(c,x+Math.round(ox_),y+Math.round(oy_),1,1,'#c8501c')}}}

/* ============ cavalaria ============ */
const cst=u=>u._vc||(u._vc={lx:u.x,ly:u.y,v:0,ph:0,g:0,hit:-9});
function tickCav(u,dt){const s=cst(u),dx=u.x-s.lx,dy=u.y-s.ly,dd=hyp(dx,dy),jump=dd>80;s.lx=u.x;s.ly=u.y;const v=jump||dt<=0?s.v:dd/dt;s.v+=(v-s.v)*Math.min(1,dt*7);
 const g=s.v<5?0:s.v<36?1:s.v<72?2:3;if(g!==s.g){if(g&&s.g)s.ph=frac(s.ph);s.g=g}if(!g)return;
 const G2=GAIT[g],p0=s.ph;s.ph+=(jump?0:dd)/G2.stride;
 /* poeira de cada casco ao apoiar (cruzou o início do apoio no ciclo) */
 const G0=groundAt(u.x,u.y);if(G0.d>=.12||g<2)return;const mud=G0.m>.3,sn=snowy(),a=u.angle||0,ca=Math.cos(a),sa=Math.sin(a);
 for(const[hx0,sd,off]of G2.legs){if(Math.floor(p0-off)===Math.floor(s.ph-off))continue;if(Math.random()<(g===2?.6:.45))continue;
  const lx=hx0-2+G2.R,ly=sd*6,wx=u.x+(lx*ca-ly*sa)/Z,wy=u.y+(lx*sa+ly*ca)/Z;
  if(mud){const p=add(3,wx,wy,2,-ca*rnd(20,50)+rnd(-12,12),-sa*rnd(20,50)+rnd(-12,12),rnd(30,60),.9,1,'#2f2418',1);if(p)p.stamp=Math.random()<.3?1:0}
  else{const p=add(1,wx,wy+3,0,-ca*rnd(8,18)+rnd(-5,5),-sa*rnd(8,18)-rnd(2,7),0,rnd(.45,.8),g===3?rnd(2,3.2):rnd(1.5,2.4),sn?'#dfe8e6':'#a08d6a',0);if(p)p.col2=sn?'#f4f8f6':'#b5a57c'}}}
function drawCav(c,u,sx,sy,vis,bob){const s=cst(u),t=u.team?1:0,d=dir16(u.angle||0),g=s.g,G2=GAIT[g];let fi=0;
 if(g)fi=Math.floor(frac(s.ph)*G2.frames)%G2.frames;else{const k=((time*.7+u.id*.37)|0)%7;fi=k===3?1:k===5?2:0}
 const pose=u.chargeActive&&g>=2?(time-s.hit<.28?2:1):(time-s.hit<.28?2:0),sp=cavSprite(t,d,g,fi,pose);
 c.drawImage(sp.c,0,0,sp.c.width,vis,sx-sp.ax,sy-sp.ay+bob,sp.c.width,vis);V.stats.cavDrawn++}
/* morte do cavalo: empina (0–0,4 s), cai de lado (poeira), esperneia e fica */
const HD=[];
function horseDeath(u){const s=cst(u),a=u.angle||0;V.stats.horseDeaths++;const side=Math.random()<.5?-1:1;
 HD.push({x:u.x,y:u.y,t:u.team?1:0,a,d:dir16(a),side,t0:time,lunge:Math.min(1,s.v/90)});if(HD.length>48)HD.shift();
 /* o cavaleiro (cadáver de infantaria criado pelo jogo) é arremessado para a frente, mais longe se galopava */
 const cp=typeof corpses!=='undefined'?corpses[corpses.length-1]:null;if(cp&&Math.abs(cp.x-u.x)<1&&Math.abs(cp.y-u.y)<1){const L=9+Math.min(1,s.v/90)*15,ca=Math.cos(a),sa=Math.sin(a);cp.sx=Math.round(ca*L-sa*side*-3);cp.sy=Math.round(sa*L+ca*side*-3);cp.angle=a+rnd(-.4,.4);if(cp.born==null)cp.born=time}}
function drawHorses(c,ox,oy){for(let i=0;i<HD.length;i++){const h=HD[i],a=time-h.t0,x=ox+Math.round(h.x*Z),y=oy+Math.round(h.y*Z);if(x<-40||y<-40||x>vw+40||y>vh+40)continue;
 const fade=a>200?clamp(1-(a-200)/30,0,1):1;if(fade<=0)continue;c.globalAlpha=fade;
 if(a<.42){const lift=Math.round(Math.sin(a/.42*Math.PI)*3),f=((a*14)|0)%2,sp=horseSprite(h.t,h.d,0,f,'rear'),dx=Math.round(Math.cos(h.a)*a*h.lunge*9),dy=Math.round(Math.sin(h.a)*a*h.lunge*9);c.drawImage(PX.shadowSprite(10,4).c,x+dx-10,y+dy+2);c.drawImage(sp.c,x+dx-sp.ax,y+dy-sp.ay-lift)}
 else{const tw=a<3&&((a*(a<1.2?9:4))|0)%2?1:0,sp=deadHorse(h.t,h.d,tw,h.side),k=clamp((a-.42)/.18,0,1),dx=Math.round(Math.cos(h.a)*(.42*h.lunge*9+k*2)-Math.sin(h.a)*h.side*k*2),dy=Math.round(Math.sin(h.a)*(.42*h.lunge*9+k*2)+Math.cos(h.a)*h.side*k*2);
  if(!h.dust&&a>.55){h.dust=1;h.x+=dx/Z*0;dustRing(h.x+Math.cos(h.a)*(.42*h.lunge*9+2)/Z,h.y+Math.sin(h.a)*(.42*h.lunge*9+2)/Z,9,.8)}
  c.drawImage(sp.c,x+dx-sp.ax,y+dy-sp.ay+(k<1?-1:0))}
 c.globalAlpha=1}}

/* ============ ligações ============ */
const PF={under:0,over:0,tank:0,cav:0,n:0};V.prof=()=>{const n=PF.n||1,r={};for(const k in PF)r[k]=k==='n'?PF.n:+(PF[k]/n).toFixed(3);for(const k in PF)PF[k]=0;return r};
let frame=0,preFrame=-1,lastOx=0,lastOy=0;
if(window.WW1A){const u0=WW1A.under,o0=WW1A.over;
 WW1A.under=function(c,ox,oy,dt){u0.call(this,c,ox,oy,dt);frame++;lastOx=ox;lastOy=oy;if(!V.on)return;const t0=performance.now();try{drawHorses(c,ox,oy);drawWreckGround(c,ox,oy);drawParts(c,ox,oy,0)}catch(e){fail(e)}const dt0=performance.now()-t0;V.stats.drawMs+=dt0;PF.under+=dt0};
 WW1A.over=function(c,ox,oy,dt){o0.call(this,c,ox,oy,dt);if(!V.on){FLASH.length=0;return}const t0=performance.now();try{if(preFrame!==frame){preFrame=frame;drawPre(c,ox,oy)}drawParts(c,ox,oy,1);drawWreckAir(c,ox,oy);for(let i=0;i<FLASH.length;i+=6)drawFlash(c,FLASH[i],FLASH[i+1],FLASH[i+2],FLASH[i+3],FLASH[i+4],FLASH[i+5])}catch(e){fail(e)}FLASH.length=0;PF.over+=performance.now()-t0;PF.n++;
  const ms=V.stats.drawMs+performance.now()-t0;V.stats.frameMs=ms;V.stats.peakMs=Math.max(V.stats.peakMs*.995,ms);V.stats.avgMs=(V.stats.avgMs||ms)*.95+ms*.05;V.stats.drawMs=0}}
const plain=u=>!(u.down||u.sap||u.sh||u.mask||u.pinned||u.lunge||u.stunned);
{const d0=PHYS.draw||(()=>false);PHYS.draw=function(c,u,sp,sx,sy,vis,bob){
 if(V.on&&preFrame!==frame){preFrame=frame;try{drawPre(c,lastOx,lastOy)}catch(e){fail(e)}}
 if(!V.on||u.hp<=0||(u.type!=='tank'&&u.type!=='cavalry'))return d0.call(PHYS,c,u,sp,sx,sy,vis,bob);
 const t0=performance.now();try{
  if(u.type==='tank'){drawTank(c,u,sx,sy);const q=performance.now()-t0;V.stats.drawMs+=q;PF.tank+=q;return true}
  if(plain(u)&&!(u.pv&&u.pv.stun>.05)){drawCav(c,u,sx,sy,vis,bob);const q=performance.now()-t0;V.stats.drawMs+=q;PF.cav+=q;return true}}catch(e){fail(e)}
 V.stats.drawMs+=performance.now()-t0;return d0.call(PHYS,c,u,sp,sx,sy,vis,bob)}}
wrap('update',(orig,dt)=>{const r=orig(dt);if(!V.on||!(dt>0))return r;const t0=performance.now();try{
 stampBudget=Math.min(60,stampBudget+dt*120);if(window.PXW&&PXW.windVec){const w=PXW.windVec();windX=w.x;windY=w.y}
 for(const u of units){if(u.hp<=0)continue;if(u.type==='tank')tickTank(u,dt);else if(u.type==='cavalry')tickCav(u,dt)}
 tickWrecks(dt);tickParts(dt)}catch(e){fail(e)}V.stats.tickMs=V.stats.tickMs*.9+(performance.now()-t0)*.1;return r});
wrap('damage',(orig,u,n,att)=>{const alive=u&&u.hp>0,r=orig(u,n,att);if(!V.on||!alive)return r;try{
 if(u.type==='tank'){if(u.hp<=0)tankDeath(u);else if(n>=4){const s=tst(u),t=u.team?1:0,L=t?24:17,Wd=t?11:8;let lx=rnd(-L,L),ly=rnd(-Wd,Wd);
   if(lastBlast&&time-lastBlast.t<.05){const hd=hdgOf(u),bx=lastBlast.x-u.x,by=lastBlast.y-u.y,ll=hyp(bx,by)||1;lx=clamp((bx*Math.cos(hd)+by*Math.sin(hd))/ll*L,-L,L);ly=clamp((-bx*Math.sin(hd)+by*Math.cos(hd))/ll*Wd,-Wd,Wd)}
   s.scars.push([Math.round(lx),Math.round(ly),Math.random()<.5?1:0,time]);if(s.scars.length>12)s.scars.shift();
   if(n>=15){const d=dir16(hdgOf(u)),[wx,wy]=emitWorld(u,lx,ly,d);for(let k=0;k<6;k++){const a=rnd(0,TAU),v=rnd(40,120);add(2,wx,wy,8,Math.cos(a)*v,Math.sin(a)*v*.7,rnd(30,120),rnd(.3,.6),1,0,1)}add(0,wx,wy,8,rnd(-5,5),-14,0,1.2,3,0,1);const p=add(3,wx,wy,8,rnd(-60,60),rnd(-50,30),rnd(60,120),1.5,1,'#3b3e35',1);if(p)p.stamp=1}}}
 else if(u.type==='cavalry'&&u.hp<=0)horseDeath(u)}catch(e){fail(e)}return r});
let lastBlast=null;wrap('explode',(orig,x,y,r,power,team)=>{const prev=lastBlast;lastBlast={x,y,t:time};const res=orig(x,y,r,power,team);lastBlast=prev&&time-prev.t<.05?prev:{x,y,t:time};return res});
wrap('shoot',(orig,u,target,manual)=>{const f0=u&&u.flash,r=orig(u,target,manual);if(!V.on||!u)return r;try{
 if(u.type==='tank'&&u.flash>=.12&&u.flash!==f0){const s=tst(u),t=u.team?1:0,a=u.angle||0;u.flash=0;s.vf=.2;if(t===0)s.va=a;
  /* anel de poeira levantado pela onda de boca no chão + fumaça empurrada para a frente */
  const g=G[t],h=hdgOf(u),ma=t?h:a,mx=u.x+Math.cos(t?h:h)*g.piv/Z+Math.cos(ma)*g.muz/Z,my=u.y+Math.sin(h)*g.piv/Z+Math.sin(ma)*g.muz/Z;
  const G0=groundAt(mx,my);if(G0.d<.12)dustRing(mx+Math.cos(ma)*8,my+Math.sin(ma)*8+6,12,1.2);
  for(let k=0;k<4;k++)add(0,mx+Math.cos(ma)*rnd(4,14),my+Math.sin(ma)*rnd(4,14),6,Math.cos(ma)*rnd(30,60)+rnd(-8,8),Math.sin(ma)*rnd(30,60)-rnd(4,10),0,rnd(.9,1.5),rnd(2,4),2,1)}
 else if(u.type==='cavalry'&&!manual)cst(u).hit=time}catch(e){fail(e)}return r});
wrap('setup',(orig,...a)=>{const r=orig(...a);PU.length=0;WR.length=0;HD.length=0;DEB.length=0;FLASH.length=0;queueWarm();return r});
/* pré-aquecimento dos sprites em fatias ociosas (sem travar quadro) */
let warm=[],warmT=0;function queueWarm(){warm=[];for(let d=0;d<16;d++)for(const t of[0,1]){warm.push(()=>hullSprite(t,d,0,0,0));warm.push(()=>cavSprite(t,d,3,0,0))}for(let d=0;d<32;d++)warm.push(()=>turretSprite(d,0,0));
 for(let d=0;d<16;d++)for(const t of[0,1])for(let f=1;f<8;f++)warm.push(()=>cavSprite(t,d,3,f,0));for(let d=0;d<16;d++)for(const t of[0,1])for(let a=0;a<3;a++)for(let b=0;b<3;b++)if(a||b)warm.push(()=>hullSprite(t,d,a,b,0));for(let d=0;d<16;d++)for(const t of[0,1]){for(let f=0;f<8;f++)warm.push(()=>cavSprite(t,d,3,f,1));for(let f=0;f<6;f++){warm.push(()=>cavSprite(t,d,2,f,0));warm.push(()=>cavSprite(t,d,1,f,0))}for(let f=0;f<3;f++)warm.push(()=>cavSprite(t,d,0,f,0))}if(!warmT)warmT=setTimeout(stepWarm,400)}
function stepWarm(){warmT=0;const t0=performance.now();try{while(warm.length&&performance.now()-t0<3)warm.shift()()}catch(e){fail(e);warm=[]}if(warm.length)warmT=setTimeout(stepWarm,40)}
queueWarm();
V.state=()=>({on:V.on,parts:PU.length,wrecks:WR.length,horses:HD.length,cache:store.size,warm:warm.length,stats:{...V.stats}});
V.spr={hullSprite,turretSprite,cavSprite,deadHorse,horseSprite};V.wrecks=()=>WR;V.parts=()=>PU;V.deadHorses=()=>HD;
if(window.IronFront)window.IronFront.vehicles=V;
})();
