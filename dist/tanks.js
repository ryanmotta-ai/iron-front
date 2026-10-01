'use strict';
/* Iron Front — tanques históricos de 1918, pixel art detalhado.
   time 0 = Estados Unidos (AEF / Tank Corps): Renault FT (torre Berliet fundida, canhão Puteaux 37 mm).
   time 1 = Império Alemão: A7V Sturmpanzerwagen (canhão Maxim-Nordenfelt 57 mm, 6 MG 08).
   Carregar DEPOIS de art.js e ANTES de pixel.js. Sobrescreve PX.tankSprite / PX.wreckSprite e exporta PX.TANKS.
   Todas as medidas de PX.TANKS estão em PIXELS DE ARTE (1 px = 2 unidades de mundo), medidas a partir do
   CENTRO do canvas de cada sprite (a âncora {ax,ay} devolvida). Sem antialias; paleta fixa por tanque. */
(function(){
const PX=window.PX;if(!PX||!PX.rotSprite)return;
const{TAU,mk,g2,mix,cached,outlined,rotSprite,hex2rgb,TEAM}=PX;

/* ================= utilidades ================= */
const hx=(r,g,b)=>'#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
const lum=c=>{const[r,g,b]=hex2rgb(c);return r*.3+g*.59+b*.11};
/* carcaça: dessatura e escurece (paleta própria, não um filtro por pixel) */
const wreckCol=c=>{const l=lum(c);return mix(mix(c,hx(l*1.05,l*.97,l*.88),.6),'#0e0c0a',.2)};
const mapPal=(o,f)=>{const r={};for(const k in o)r[k]=Array.isArray(o[k])?o[k].map(v=>Array.isArray(v)?v.map(f):f(v)):f(o[k]);return r};
/* PRNG local determinístico (não mexe em PX.srand) */
function rng(seed){let s=seed>>>0||1;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}}
const hash=(x,y,s)=>{let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(s|0,1442695041))|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296};
const vnoise=(x,y,s)=>{const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),a=hash(xi,yi,s),b=hash(xi+1,yi,s),c=hash(xi,yi+1,s),d=hash(xi+1,yi+1,s);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v};
const fbm=(x,y,s)=>vnoise(x,y,s)*.65+vnoise(x*2.1+7,y*2.1+3,s+11)*.35;

function pen(c){const x=g2(c);x.imageSmoothingEnabled=false;
return{c,x,
p(a,b,col){x.fillStyle=col;x.fillRect(a,b,1,1)},
r(a,b,w,h,col){x.fillStyle=col;x.fillRect(a,b,w,h)},
e(a,b,w=1,h=1){x.clearRect(a,b,w,h)},
/* linha de pixels com máscara de texto: rows de strings, '#' = pixel */
m(a,b,rows,col,ch='#'){x.fillStyle=col;for(let j=0;j<rows.length;j++)for(let i=0;i<rows[j].length;i++)if(rows[j][i]===ch)x.fillRect(a+i,b+j,1,1)}}}
const BAY=[.125,.625,.875,.375];
/* domo por zonas (estilo pixel art clássico): contorno escuro, ombro com luz em cima-esquerda e topo plano.
   pal={outL,outD,hh,h,o,d,roof}; o={out,sh,ov(i,j,zona,cor)} */
function zdome(R,cx,cy,r,pal,o){const re=r+.3;
for(let j=Math.floor(cy-re);j<=Math.ceil(cy+re);j++)for(let i=Math.floor(cx-re);i<=Math.ceil(cx+re);i++){
const nx=(i+.5-cx)/re,ny=(j+.5-cy)/re,rr=Math.sqrt(nx*nx+ny*ny);if(rr>1)continue;
const ux=nx/(rr||1),uy=ny/(rr||1),s=-(ux*.62+uy*.78);let col,z;
if(rr>o.out){z=0;col=s>-.2?pal.outL:pal.outD}
else if(rr>o.sh){z=1;const sd=s+(((i+j)&1)?.1:-.1);col=sd>.45?pal.hh:sd>-.1?pal.h:sd>-.55?pal.o:pal.d}
else{z=2;col=pal.roof}
if(o.ov){const v=o.ov(i,j,z,col);if(v)col=v}
R.p(i,j,col)}}
/* disco cheio (sombra projetada, aros) */
function disc(R,cx,cy,r,col){const re=r+.3;for(let j=Math.floor(cy-re);j<=Math.ceil(cy+re);j++)for(let i=Math.floor(cx-re);i<=Math.ceil(cx+re);i++){const nx=(i+.5-cx)/re,ny=(j+.5-cy)/re;if(nx*nx+ny*ny<=1)R.p(i,j,col)}}
/* faixa de esteira: passo 3, deslocamento 1 px por fase (3 fases = 1 passo → laço perfeito), sempre para +x */
function track(R,p,x0,x1,y,h,ph){
for(let i=x0;i<=x1;i++){const k=(((i-ph)%3)+3)%3;
for(let j=0;j<h;j++){const lv=j===0?0:j===h-1?2:1;R.p(i,y+j,p.tk[k][lv])}}}
/* grade de venezianas (colunas alternadas) */
function louver(R,x,y,w,h,a,b,c){for(let i=0;i<w;i++){R.r(x+i,y,1,h,i&1?a:b)}if(c)R.r(x,y,w,1,c)}
const DIG={'0':['###','#.#','#.#','#.#','###'],'1':['.#.','##.','.#.','.#.','###'],'2':['###','..#','###','#..','###'],'3':['###','..#','###','..#','###'],'4':['#.#','#.#','###','..#','..#'],'5':['###','#..','###','..#','###'],'6':['###','#..','###','#.#','###'],'7':['###','..#','.#.','.#.','.#.'],'8':['###','#.#','###','#.#','###'],'9':['###','#.#','###','..#','###']};
function number(R,x,y,s,col){for(let i=0;i<s.length;i++)R.m(x+i*4,y,DIG[s[i]],col)}
/* mancha de fuligem por ruído (só sobre pixels já desenhados): duas camadas de tom */
function sootN(R,x,y,w,h,seed,thr,sc,c1,c2){R.x.globalCompositeOperation='source-atop';for(let j=0;j<h;j++)for(let i=0;i<w;i++){const n=fbm((x+i)/sc,(y+j)/sc,seed);if(n>thr)R.p(x+i,y+j,n>thr+.09?c2:c1)}R.x.globalCompositeOperation='source-over'}
/* mancha de explosão radial: núcleo escuro, franja pontilhada (só sobre pixels já desenhados) */
function blast(R,cx,cy,r,seed,c1,c2){R.x.globalCompositeOperation='source-atop';for(let j=Math.floor(cy-r-2);j<=Math.ceil(cy+r+2);j++)for(let i=Math.floor(cx-r-2);i<=Math.ceil(cx+r+2);i++){const d=Math.hypot(i+.5-cx,(j+.5-cy)*1.05)+(fbm(i/2.6,j/2.6,seed)-.5)*r*.9;if(d<r*.5)R.p(i,j,c2);else if(d<r*.85)R.p(i,j,c1);else if(d<r&&((i+j)&1))R.p(i,j,c1)}R.x.globalCompositeOperation='source-over'}

/* ================= RENAULT FT (time 0) ================= */
const MK0=(TEAM&&TEAM[0]&&TEAM[0].mark)||'#b3ecf7';
const FT={
ol:'#646b3a',olH:'#838a50',olHH:'#a7ae6b',olD:'#474e2b',olDD:'#2e351b',
st:'#3b3e35',stD:'#23251d',stH:'#6b7062',stHH:'#9ca292',
rust:'#8a5a34',rustD:'#5a3a22',soot:'#231e19',soot2:'#100d0a',ember:'#b4562a',
wood:'#7c5a38',woodH:'#a27c4b',woodD:'#553a24',
wh:'#d9d7c3',whD:'#a9a792',glass:'#12140d',pit:'#191b14',
mk:MK0,mkH:mix(MK0,'#ffffff',.55),mkD:mix(MK0,'#0b1a26',.45),
tk:[['#7d7a63','#5d5a47','#3a382d'],['#524f3d','#403e30','#2b2a21'],['#1b1c16','#1b1c16','#1b1c16']]};
const FTW=mapPal(FT,wreckCol);
FTW.soot='#3a342d';FTW.soot2='#1f1b17';
FTW.mk=mix(FTW.mk,'#0e0c0a',.55);FTW.mkH=mix(FTW.mkH,'#0e0c0a',.55);FTW.mkD=mix(FTW.mkD,'#0e0c0a',.4);FTW.wh=mix(FTW.wh,'#0e0c0a',.45);
/* retângulo de pintura oliva com chanfro de luz (bev: 1 = só topo/base, 2 = também esquerda/direita) */
function ftPlane(R,p,x,y,w,h,bev){for(let j=0;j<h;j++)for(let i=0;i<w;i++){let c=p.ol;if(bev){if(j===0||(bev===2&&i===0))c=p.olH;else if(j===h-1||(bev===2&&i===w-1))c=p.olD}R.p(x+i,y+j,c)}}
/* roda com 5x5 (sem quinas) ou 6x5 (roda guia grande) */
function ftWheel(R,p,x,y,w,big){
for(let j=0;j<5;j++)for(let i=0;i<w;i++){if((j===0||j===4)&&(i===0||i===w-1))continue;
const c=j===0||i===0?p.stH:j===4||i===w-1?p.stD:p.st;R.p(x+i,y+j,c)}
R.p(x+1,y,p.stHH);R.p(x+2,y,p.stHH);
if(big){R.r(x+2,y+2,2,1,p.stD);R.p(x+1,y+2,p.stH);R.p(x+4,y+2,p.stH);R.p(x+2,y+1,p.stH);R.p(x+3,y+3,p.stH);R.p(x+2,y+2,p.woodD);R.p(x+3,y+2,p.stD)}
else{R.p(x+2,y+2,p.stD);R.p(x+1,y+2,p.stHH);R.p(x+3,y+1,p.stH);R.p(x+3,y+3,p.stD)}}

function ftBase(ph,wreck){
const p=wreck?FTW:FT,c=mk(58,26),R=pen(c);
R.x.translate(9,3);/* coordenadas locais: x 0..39 (cauda 0..9), y 0..19; eixo de tiro em y=9.5 */

/* ---- cauda (queue): treliça de aço para cruzar trincheiras ---- */
R.r(1,6,9,8,p.pit);
R.r(1,6,9,2,p.st);R.r(1,12,9,2,p.st);R.r(1,6,9,1,p.stH);R.r(1,13,9,1,p.stD);
R.r(0,6,2,8,p.st);R.r(0,6,1,8,p.stH);R.p(0,13,p.stD);R.p(1,13,p.stD);
R.r(2,8,1,4,p.stH);R.r(6,8,1,4,p.stH);/* travessas */
R.p(3,8,p.st);R.p(4,9,p.st);R.p(4,10,p.st);R.p(5,11,p.st);R.p(5,8,p.st);R.p(3,11,p.st);/* contraventamento em X */
R.p(8,9,p.stHH);R.p(8,10,p.stD);R.p(9,9,p.stD);R.p(9,10,p.stD);/* pino de engate */
R.p(3,6,p.stHH);R.p(7,6,p.stHH);R.p(3,12,p.stH);R.p(7,12,p.stH);/* rebites */
R.e(0,6);R.e(0,13);

/* ---- esteiras: as sapatas "andam" com ph (passo 3, 1 px por fase) ---- */
for(const y0 of[0,17])track(R,p,12,36,y0,3,wreck?0:ph);
if(wreck){/* sapatas faltando (esteira rompida) */
for(const[a,b]of[[17,0],[22,1],[27,0],[31,2],[15,18],[21,19],[26,17],[31,18]]){R.p(a,b,p.tk[2][0]);R.p(a+1,b,p.tk[2][0])}}

/* ---- paralamas sobre as esteiras ---- */
ftPlane(R,p,12,3,22,2,1);ftPlane(R,p,12,15,22,2,1);
R.r(12,4,22,1,p.olD);R.r(12,16,22,1,p.olD);R.r(12,15,22,1,p.ol);R.r(12,3,22,1,p.olH);
for(let i=13;i<34;i+=3){R.p(i,3,p.olHH);R.p(i,16,p.olDD)}/* rebites do paralama */

/* ---- rodas: motriz traseira e guia dianteira grande ---- */
for(const y0 of[0,15]){ftWheel(R,p,8,y0,5,false);ftWheel(R,p,34,y0,6,true)}

/* ---- convés do casco ---- */
ftPlane(R,p,9,5,29,10,2);
for(let j=5;j<15;j++){R.p(35,j,((j+35)&1)?p.ol:p.olD);R.p(36,j,p.olD);R.p(37,j,((j+37)&1)?p.olD:p.olDD)}R.r(36,5,2,1,p.ol);/* glacis inclinado (degradê pontilhado até a sombra) */
for(let i=11;i<35;i+=3){R.p(i,5,p.olHH);R.p(i,14,p.olDD)}/* fileiras de rebites do convés */
/* compartimento do motor: persianas do radiador + placa de número */
louver(R,10,5,6,2,p.ol,p.olD,p.olH);louver(R,10,13,6,2,p.olD,p.olDD,null);
R.r(16,5,1,10,p.olDD);/* junta entre motor e compartimento de combate */
number(R,10,8,'47',p.wh);
/* cano de escape (silencioso) sobre o paralama traseiro */
R.r(13,3,7,2,p.st);R.r(13,3,7,1,p.stH);R.r(13,4,7,1,p.stD);R.p(13,3,p.soot);R.p(13,4,p.soot);R.p(14,3,p.rustD);R.p(15,4,p.rustD);R.p(16,4,p.rust);R.p(19,3,p.stHH);R.p(19,4,p.stD);
/* pá presa ao paralama (cabo + lâmina) */
R.r(25,3,9,1,p.stH);R.r(31,4,3,1,p.st);R.p(25,4,p.woodD);R.p(26,4,p.woodD);R.p(28,4,p.stD);R.r(33,3,1,2,p.stD);
/* caixa de ferramentas e cabo de reboque no paralama direito */
R.r(13,15,6,2,p.wood);R.r(13,15,6,1,p.woodH);R.r(13,16,6,1,p.woodD);R.p(15,15,p.stHH);R.p(13,16,p.stD);R.p(18,16,p.stD);
for(let i=0;i<6;i++){R.p(26+i,15,i&1?p.wood:p.woodH);R.p(26+i,16,i&1?p.woodD:p.wood)}R.p(32,15,p.woodD);R.p(32,16,p.woodD);

/* ---- frente: escotilha do motorista (duas folhas) + fendas de visão ---- */
R.r(31,6,5,8,p.olH);R.r(31,6,5,1,p.olHH);R.r(31,13,5,1,p.ol);R.r(35,6,1,8,p.olD);
R.r(31,6,1,8,p.olDD);R.p(33,7,p.stHH);R.p(33,12,p.stHH);
R.r(36,7,2,1,p.glass);R.r(36,12,2,1,p.glass);/* fendas do motorista */
R.r(38,5,1,2,p.st);R.r(38,13,1,2,p.st);R.p(38,5,p.stHH);R.p(38,13,p.stHH);/* argolas de reboque */

R.r(36,5,2,2,p.mk);R.r(36,13,2,2,p.mk);R.p(37,6,p.mkD);R.p(37,14,p.mkD);R.p(0,7,p.mk);R.p(0,12,p.mk);R.p(1,7,p.mkD);R.p(1,12,p.mkD);/* marcas da facção nos cantos */
/* ---- torre Berliet redonda fundida ---- */
const tx=22,ty=10;
disc(R,tx+1,ty+1,6,p.olD);/* sombra projetada no convés */
zdome(R,tx,ty,6,{outL:p.olD,outD:p.olDD,hh:p.olHH,h:p.olH,o:p.ol,d:p.ol,roof:p.olH},{out:.84,sh:.64,ov:(i,j,z,col)=>{if(i>=24&&i<=25&&z>0)return col===p.olDD||col===p.olD?p.mkD:col===p.olHH?p.mkH:p.mk;if(i>=24&&i<=25&&z===2)return p.mk}});
/* rebites no ombro da torre */
for(const[a,b]of[[17,7],[17,12],[19,5],[19,14],[26,5],[26,14],[27,8],[27,11]])R.p(a,b,p.olHH);
/* cúpula do comandante com escotilha circular, dobradiça e 4 fendas de visão */
disc(R,22,11,3,p.olD);
zdome(R,21,10,3,{outL:p.olHH,outD:p.olDD,hh:p.olHH,h:p.olH,o:p.ol,d:p.ol,roof:p.ol},{out:.78,sh:.5});
R.r(19,8,4,4,p.olH);R.r(19,8,4,1,p.olHH);R.r(19,11,4,1,p.ol);R.p(19,8,p.ol);R.p(22,8,p.olH);R.p(19,11,p.olD);R.p(22,11,p.olD);
R.p(19,9,p.olDD);R.p(19,10,p.olDD);R.p(22,9,p.stHH);R.p(21,10,p.olD);/* dobradiça e puxador */
R.p(20,7,p.olD);R.p(21,7,p.olD);R.p(20,12,p.olDD);R.p(21,12,p.olDD);R.p(18,9,p.olD);R.p(18,10,p.olD);R.p(23,9,p.olDD);R.p(23,10,p.olDD);/* fendas de visão (fechadas) */

/* ---- canhão Puteaux 37 mm: mantelete, luva e cano curto e grosso (boca para +x) ---- */
R.r(28,8,3,4,p.ol);R.r(28,8,3,1,p.olH);R.r(28,11,3,1,p.olD);R.r(30,8,1,4,p.olD);R.p(28,8,p.olHH);
R.r(31,8,5,4,p.st);R.r(31,8,5,1,p.stHH);R.r(31,9,5,1,p.stH);R.r(31,11,5,1,p.stD);R.r(35,8,1,4,p.stD);R.p(33,10,p.stD);/* luva de recuo grossa */
R.r(36,9,5,2,p.st);R.r(36,9,5,1,p.stH);R.r(36,10,5,1,p.stD);/* cano curto */
R.r(41,8,2,4,p.st);R.r(41,8,2,1,p.stHH);R.r(42,9,1,2,p.stD);R.r(41,11,2,1,p.stD);R.p(41,9,p.stH);/* freio/anel da boca */

if(wreck)ftWreck(R,p);
return c}

function ftWreck(R,p){
/* fuligem: manchas grandes de incêndio por cima da pintura */
sootN(R,0,2,40,18,12,.64,3.2,p.rustD,p.rust);
sootN(R,0,2,40,18,71,.66,4.6,p.soot,p.soot);
blast(R,21,10,5.5,5,p.soot,p.soot2);blast(R,12,9,3.5,8,p.soot,p.soot2);blast(R,33,12,3,9,p.soot,p.soot2);
/* escotilha da cúpula arrancada/aberta: buraco preto, tampa torta */
R.r(19,8,4,4,p.soot2);R.r(20,9,2,2,'#050403');R.p(19,8,p.soot);R.p(22,8,p.soot);R.p(19,11,p.soot);R.p(22,11,p.soot);
R.r(17,8,1,4,p.olD);R.r(17,9,1,1,p.olH);R.p(23,7,p.ember);R.p(18,12,p.rust);
/* buracos de impacto com borda de metal rasgado */
for(const[a,b]of[[25,5],[12,9],[33,10],[21,14],[30,14]]){R.r(a,b,2,2,'#0a0806');R.p(a-1,b-1,p.stH);R.p(a+2,b,p.stD);R.p(a,b+2,p.soot2);R.p(a+1,b-1,p.rust)}
/* cano do canhão torto e partido */
R.e(36,8,7,4);R.r(36,9,3,2,p.st);R.r(36,9,3,1,p.stH);R.r(39,10,3,2,p.stD);R.r(39,10,3,1,p.st);R.p(41,11,p.soot2);R.p(41,10,p.rust);
/* paralama rasgado, placa solta ao lado do casco, esteira rompida */
R.e(22,3,5,1);R.r(22,4,5,1,p.soot2);R.r(23,2,4,1,p.olD);R.r(24,1,3,1,p.ol);
R.e(20,17,7,3);R.r(20,17,3,1,p.soot2);R.r(24,18,3,2,p.tk[1][2]);R.p(22,18,p.ember);
R.r(28,20,6,2,p.ol);R.r(28,20,6,1,p.olH);R.r(29,21,5,1,p.olDD);R.p(31,20,p.soot)}
/* ================= A7V (time 1) ================= */
const MK1=(TEAM&&TEAM[1]&&TEAM[1].mark)||'#f4a488';
/* níveis de luz por cor de camuflagem: [sombra, base, luz, brilho de rebite] */
const lv3=c=>[mix(c,'#0b0d08',.42),c,mix(c,'#ffffff',.24),mix(c,'#ffffff',.55)];
const A7={
/* camuflagem: [sombra, base, luz, rebite] */
g:lv3('#777d71'),   /* feldgrau */
o:lv3('#a08e58'),   /* ocre */
b:lv3('#6f5239'),   /* marrom */
m:lv3('#62744a'),   /* verde-musgo */
st:'#3a3d35',stD:'#22241e',stH:'#6d7263',stHH:'#a4aa9a',
seam:'#2a2d26',rust:'#8a5a34',rustD:'#5a3a22',soot:'#231e19',soot2:'#100d0a',ember:'#b4562a',
wood:'#7c5a38',woodH:'#a27c4b',woodD:'#553a24',
k:'#15171a',w:'#e8e6d6',glass:'#0c0e0a',
mk:MK1,mkH:mix(MK1,'#ffffff',.4),mkD:mix(MK1,'#3a0f08',.45),
tk:[['#8a846b','#67634f','#423f32'],['#5d5944','#494735','#33322a'],['#252620','#252620','#252620']],
tkN:[['#b0a98d','#8a856c','#5c5744'],['#77725a','#5d5a45','#403e31'],['#2c2d26','#2c2d26','#2c2d26']]};
const A7W=mapPal(A7,wreckCol);
A7W.soot='#3a342d';A7W.soot2='#1f1b17';
for(const k of['g','o','b','m'])A7W[k]=A7W[k].map(c=>mix(c,'#352f29',.5));/* camuflagem queimada: tons próximos */
A7W.mk=mix(A7W.mk,'#0e0c0a',.5);A7W.mkH=mix(A7W.mkH,'#0e0c0a',.5);A7W.mkD=mix(A7W.mkD,'#0e0c0a',.4);A7W.w=mix(A7W.w,'#0e0c0a',.5);
/* manchas de camuflagem irregulares (deformação de domínio para bordas angulosas) */
const a7Class=(x,y)=>{const wx=x+vnoise(x/6,y/6,3)*4,wy=y+vnoise(x/6+9,y/6,8)*4,a=fbm(wx/7.2,wy/7.2,5),b=fbm(wx/6.6+30,wy/6.6+9,19),m=fbm(wx/7+70,wy/7+50,43);return b>.66?2:a>.575?1:m>.58?3:0};
const a7Col=(p,cl,lv)=>[p.g,p.o,p.b,p.m][cl][lv];
const a7At=(p,x,y,lv)=>a7Col(p,a7Class(x,y),lv);
/* preenche um retângulo com camuflagem; lv(i,j) → 0 sombra, 1 base, 2 luz */
function a7Fill(R,p,x,y,w,h,lv){for(let j=0;j<h;j++)for(let i=0;i<w;i++){let L=lv(i,j);const f=L-Math.floor(L);L=Math.floor(L);if(f>BAY[((y+j)&1)*2+((x+i)&1)])L++;R.p(x+i,y+j,a7At(p,x+i,y+j,Math.min(2,L)))}}
/* esteira Holt: sapatas largas; nariz inclinado mais claro na frente (x>=46); traseira arredondada */
function a7Track(R,p,y0,ph,up){
for(let i=6;i<=51;i++){const k=(((i-ph)%3)+3)%3,tb=i>=46?p.tkN:p.tk;
for(let j=0;j<5;j++){const lv=j===0?0:j===4?2:1;R.p(i,y0+j,tb[k][lv])}}
for(let j=0;j<5;j++){const lim=47+(up?j:4-j);for(let i=lim+1;i<=51;i++)R.e(i,y0+j)}
R.e(6,y0);R.e(6,y0+4);R.e(7,y0+(up?0:4));
/* cubos: roda motriz atrás, rolete central e roda-guia inclinada na frente */
const hy=y0+2;R.p(8,hy,p.stHH);R.p(9,hy,p.stD);R.p(27,hy,p.stH);R.p(26,hy,p.stD);R.p(47,hy,p.stHH);R.p(48,hy,p.stD)}

/* elemento elevado: camuflagem com luz em cima/esquerda e sombra projetada à direita/abaixo */
function a7Raise(R,p,x,y,w,h){R.r(x-1,y-1,1,h+1,p.seam);R.r(x-1,y-1,w+1,1,p.seam);a7Fill(R,p,x,y,w,h,(i,j)=>i===0||j===0?2:(i===w-1||j===h-1)?0:1);R.r(x+w,y+1,1,h,p.seam);R.r(x+1,y+h,w,1,p.seam)}
/* fileira de rebites (pontos claros, 1 px) */
function a7Rivets(R,p,x0,x1,y,step,lv){for(let i=x0;i<=x1;i+=step)R.p(i,y,a7At(p,i,y,lv))}
/* escotilha circular 4x4 com dobradiça e puxador */
function a7Hatch(R,p,x,y){R.r(x,y,4,4,p.seam);R.r(x+1,y,2,1,a7At(p,x+1,y,2));R.r(x+1,y+1,2,2,a7At(p,x+1,y+1,1));R.r(x+1,y+3,2,1,a7At(p,x+1,y+3,0));R.p(x,y+1,p.stHH);R.p(x+3,y+2,p.stHH)}
const XMASK=['..##..','..##..','######','######','..##..','..##..'];
function a7Cross(R,p,ox,oy){for(let j=-1;j<8;j++)for(let i=-1;i<8;i++){const on=XMASK[j]&&XMASK[j][i]==='#';let near=false;if(!on)for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const r=XMASK[j+dj];if(r&&r[i+di]==='#')near=true}
if(on)R.p(ox+i,oy+j,p.k);else if(near)R.p(ox+i,oy+j,p.w)}}
/* metralhadora MG 08 (Maxim) num ninho do costado; dir = -1 (lado superior, cano para cima) ou +1 (inferior) */
function a7MG(R,p,x,dir){const y=dir<0?6:19;
R.r(x,y,5,3,p.stD);R.r(x,dir<0?y:y+2,5,1,p.stH);R.r(x+1,y+1,3,1,p.k);R.p(x,y,p.stHH);R.p(x+4,dir<0?y:y+2,p.st);/* ninho blindado com escudo */
const by=dir<0?3:22;R.r(x+2,by,2,3,p.stD);R.r(x+2,by,1,3,p.stH);R.p(x+3,dir<0?by:by+2,p.k);R.p(x+2,dir<0?by:by+2,p.stHH)}

function a7Base(ph,wreck){
const p=wreck?A7W:A7,c=mk(72,34),R=pen(c);
R.x.translate(8,3);/* local: x 0..55 (canhão até 62), y 0..27; eixo de tiro em y=13.5 */

/* ---- esteiras Holt compridas com nariz inclinado ---- */
a7Track(R,p,0,wreck?0:ph,true);a7Track(R,p,23,wreck?0:ph,false);
if(wreck){for(const[a,b]of[[12,1],[20,3],[33,0],[40,2],[9,25],[18,23],[30,26],[38,24]]){R.p(a,b,p.tk[2][0]);R.p(a+1,b,p.tk[2][0])}}

/* ---- costados blindados (faixas inclinadas: superior clara, inferior escura) e teto ---- */
a7Fill(R,p,2,5,50,4,(i,j)=>j===0?2:j===1?1.75:j===2?1.25:0.25);
a7Fill(R,p,2,19,50,4,(i,j)=>j===0?.5:j===1?.25:0);
a7Fill(R,p,2,9,46,10,(i,j)=>j===0?2:j===9?0:1);
R.e(2,5);R.e(2,22);/* quinas traseiras chanfradas */
R.e(3,5);R.e(3,22);
/* rebites ao longo dos costados; juntas de placas do teto traseiro */
a7Rivets(R,p,5,46,6,3,3);for(let i=5;i<47;i+=3)R.p(i,21,p.seam);
R.r(15,9,1,10,p.seam);R.r(9,9,1,3,p.seam);R.r(9,16,1,3,p.seam);
a7Rivets(R,p,4,14,10,2,3);a7Rivets(R,p,4,14,17,2,0);

/* ---- proa inclinada com quinas chanfradas (face para a direita, escura) ---- */
for(let j=0;j<12;j++){const w=j===0||j===11?4:j===1||j===10?5:6;for(let i=0;i<w;i++)R.p(47+i,7+j,a7At(p,47+i,7+j,i===0?1:0))}
for(const y of[10,17])R.r(48,y,2,1,p.glass);
for(let j=9;j<=18;j+=3)R.p(49,j,a7At(p,49,j,2));
R.r(47,7,1,12,p.seam);R.r(51,8,1,10,p.seam);
R.r(50,5,2,2,p.stD);R.p(50,5,p.stH);R.p(51,6,p.k);/* argola de reboque dianteira */
R.r(50,20,2,2,p.stD);R.p(50,20,p.stH);R.p(51,21,p.k);

/* ---- cofre do motor (elevado): persianas nas pontas + Balkenkreuz ---- */
a7Raise(R,p,17,9,18,10);
for(let i=0;i<4;i++){R.r(18+i,11,1,6,i&1?a7At(p,18+i,12,2):p.seam);R.r(30+i,11,1,6,i&1?a7At(p,30+i,12,2):p.seam)}
a7Rivets(R,p,19,33,10,2,3);a7Rivets(R,p,19,33,17,2,0);
a7Cross(R,p,23,11);/* Balkenkreuz: cruz preta com borda branca */

/* ---- cabine elevada do comandante/motorista (Kommandantenturm) ---- */
a7Raise(R,p,35,8,12,12);
R.r(37,21,10,1,p.seam);/* sombra longa da cabine sobre o costado */
a7Fill(R,p,45,9,2,10,()=>0);R.r(45,9,1,10,p.seam);
for(const y of[10,12,15,17])R.p(46,y,p.glass);/* fendas de visão frontais */
R.r(41,9,2,10,p.mk);R.r(41,9,1,10,p.mkH);R.r(41,18,2,1,p.mkD);/* faixa da facção (salmão) */
a7Hatch(R,p,37,12);/* escotilha do comandante */

a7Rivets(R,p,37,43,11,2,3);a7Rivets(R,p,37,43,16,2,0);

/* ---- convés traseiro: escapamentos, escotilha, ganchos, marcas da facção ---- */
R.r(7,11,2,2,p.stD);R.r(7,11,2,1,p.stH);R.p(7,12,p.soot);R.r(7,15,2,2,p.stD);R.r(7,15,2,1,p.stH);R.p(7,16,p.soot);
a7Hatch(R,p,11,12);
R.r(3,9,2,2,p.mk);R.r(3,17,2,2,p.mk);R.p(4,10,p.mkD);R.p(4,18,p.mkD);/* cantos da facção */
R.r(0,12,3,4,p.stD);R.r(1,13,1,2,p.seam);R.p(0,12,p.stH);R.p(1,12,p.stH);/* gancho de reboque traseiro */

/* ---- 6 metralhadoras MG 08: 2 por lado + 2 atrás ---- */
for(const x of[11,29]){a7MG(R,p,x,-1);a7MG(R,p,x,1)}
for(const y of[6,19]){R.r(3,y,3,3,p.stD);R.r(3,y,3,1,p.stH);R.p(4,y+1,p.k);R.r(0,y+1,3,1,p.stD);R.p(0,y+1,p.k);R.p(1,y+1,p.stH)}
/* caixas de ferramentas/munição e rolo de cabo nos costados */
R.r(19,6,7,2,p.wood);R.r(19,6,7,1,p.woodH);R.r(19,7,7,1,p.woodD);R.p(22,6,p.stHH);R.p(19,7,p.stD);R.p(25,7,p.stD);
R.r(21,20,6,2,p.stH);R.r(21,21,6,1,p.stD);R.p(23,20,p.stHH);R.p(25,20,p.stHH);
for(let i=0;i<5;i++){R.p(36+i,20+0,i&1?p.woodH:p.wood);R.p(36+i,21,i&1?p.woodD:p.wood)}
R.r(7,19,2,3,p.stD);R.p(7,19,p.stH);/* lanterna/cunha */
/* lama e desgaste */
for(const[a,b,cc]of[[15,21,p.woodD],[16,22,p.woodD],[29,22,p.woodD],[42,21,p.woodD],[33,5,p.woodD],[10,7,p.woodD],[25,22,p.woodD]])R.p(a,b,cc);

/* ---- canhão Maxim-Nordenfelt 57 mm: mantelete, luva de recuo e cano (boca para +x) ---- */
R.r(52,11,4,6,p.stD);R.r(52,11,4,1,p.stHH);R.r(52,12,1,4,p.stH);R.r(55,12,1,4,p.k);R.r(52,16,4,1,p.k);R.r(53,12,2,4,p.st);R.e(52,11);R.e(55,11);R.e(52,16);R.e(55,16);
R.r(56,12,3,4,p.st);R.r(56,12,3,1,p.stH);R.r(56,15,3,1,p.stD);
R.r(59,13,4,2,p.st);R.r(59,13,4,1,p.stH);R.r(59,14,4,1,p.stD);R.r(62,12,1,4,p.stD);R.p(62,12,p.stHH);

if(wreck)a7Wreck(R,p);
return c}
function a7Wreck(R,p){
/* ferrugem e fuligem por cima da camuflagem */
sootN(R,0,3,58,22,12,.68,3.4,p.rustD,p.rust);
sootN(R,0,3,58,22,77,.68,5,p.soot,p.soot);
blast(R,39,14,6,5,p.soot,p.soot2);blast(R,29,13,5,8,p.soot,p.soot2);blast(R,11,14,4,9,p.soot,p.soot2);/* cabine, cofre do motor e traseira queimados */
/* cabine: escotilha arrancada, buraco no teto e fendas rasgadas */
R.r(37,12,4,4,p.soot2);R.r(38,13,2,2,'#050403');R.p(37,11,p.stH);R.p(40,16,p.rust);R.r(36,11,1,5,p.stD);R.p(36,12,p.stH);R.p(40,11,p.ember);
/* buraco de impacto no cofre (atravessa a cruz) */
R.r(28,12,3,3,'#0a0806');R.p(27,11,p.stH);R.p(31,11,p.stD);R.p(27,15,p.stD);R.p(30,15,p.rust);R.p(29,16,p.soot2);
/* mais impactos */
for(const[a,b]of[[8,14],[22,6],[42,20],[50,13]]){R.r(a,b,2,2,'#0a0806');R.p(a-1,b-1,p.stH);R.p(a+2,b+1,p.stD);R.p(a,b-1,p.rust)}
/* costado inferior rasgado e placa solta ao lado do casco */
R.e(40,21,6,2);R.r(40,21,6,1,p.soot2);R.p(41,20,p.stH);R.p(44,20,p.stD);
R.r(18,28,8,2,p.g[0]);R.r(18,28,8,1,p.g[1]);R.r(20,29,6,1,p.seam);R.p(22,28,p.stHH);R.p(25,29,p.soot2);
/* canos das MG quebrados */
R.e(13,3,2,2);R.e(31,22,2,3);R.r(31,22,2,1,p.stD);
/* canhão partido e torto */
R.e(56,12,7,4);R.r(56,12,3,4,p.st);R.r(56,12,3,1,p.stH);R.r(59,14,3,2,p.stD);R.r(59,14,3,1,p.st);R.p(61,15,p.soot2);R.p(61,14,p.rust)}
/* ================= exportação ================= */
const norm=(team,d,ph)=>[team?1:0,((Math.round(d)%16)+16)%16,((Math.round(ph||0)%3)+3)%3];
function sprite(team,d,ph,wreck){
/* base pré-desenhada (olhando para +x) cacheada; só a rotação é por direção. Mesma mecânica do original:
   RotSprite → contorno seletivo → âncora no centro do canvas */
const base=cached(`tnb${team}_${ph}_${wreck?1:0}`,()=>team===0?ftBase(ph,wreck):a7Base(ph,wreck));
const r=rotSprite(base,d*TAU/16);return{c:outlined(r),ax:Math.floor(r.width/2)+1,ay:Math.floor(r.height/2)+1}}
PX.tankSprite=(team,d,ph)=>{[team,d,ph]=norm(team,d,ph);return cached(`tnk${team}_${d}_${ph}`,()=>sprite(team,d,ph,false))};
PX.wreckSprite=(team,d)=>{[team,d]=norm(team,d,0);return cached(`tnw${team}_${d}`,()=>sprite(team,d,0,true))};
/* Metadados em PIXELS DE ARTE (1 px = 2 unidades de mundo), medidos a partir do centro/âncora do sprite ({ax,ay}), com o eixo de tiro para +x.
   len/wid = casco sem o canhão (o FT inclui a cauda, o A7V inclui o gancho traseiro); shadow/ring/wake = raios [rx,ry] das elipses;
   muzzle = distância do centro à boca do canhão;
   top[d] = distância do centro ao ponto mais alto do CASCO (contorno incluso) em cada uma das 16 direções (sem o canhão);
   hpY = px acima do centro para o TOPO da barra de vida (4 px de altura) sem tocar o casco em nenhuma direção (= max(top)+4).
   Barra colada ao tanque: by = y - top[d] - 5. */
PX.TANKS={
0:{name:'Renault FT',len:40,wid:20,shadow:[21,9],ring:[24,12],hpY:27,muzzle:23,wake:[20,11],top:[11,14,17,20,21,20,17,14,11,17,21,23,21,23,21,17]},
1:{name:'A7V',len:53,wid:28,shadow:[28,12],ring:[32,16],hpY:33,muzzle:35,wake:[28,15],top:[15,21,25,29,29,29,25,21,15,21,25,26,26,26,25,21]}};
})();
