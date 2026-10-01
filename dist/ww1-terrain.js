'use strict';
(function(){
const {Z,TAU,clamp,mk,g2,disc,pline,stampCrater,riverX,riverHW,ROADS,srand,sr}=PX;
const {BAYER,hash2,vnoise,fbm,pk}=PX.noise,WW=PX.WW1;
/* Iron Front 0.6 — terreno de "A Última Trincheira".
   Em vez de faixas de ruído, o chão é um MAPA DE ALTURA iluminado pelo canto superior esquerdo: trincheiras,
   parapeitos, crateras, sulcos de arado e as margens do rio ganham volume sozinhos, e a cor de cada material
   vem de uma rampa de 4–5 tons com dithering de Bayer. A destruição cresce da retaguarda para a terra de ninguém
   (com WW.CLEAN o campo começa só desgastado — é o combate que abre as crateras). */
const SEED=1917;
const HEX=a=>a.map(v=>pk(v));
const MATS=[],MT={};
function def(name,ramp,gain,dith){MT[name]=MATS.length;MATS.push({ramp:HEX(ramp),gain,dith,n:ramp.length})}
/* rampas: índice 0 = mais escuro … último = mais claro */
def('G0',['#2c3c25','#37492d','#445a36','#546c41','#667f4f'],.85,.6);          // campo são
def('G1',['#313b27','#3e492f','#4d5837','#5e6a42','#707d50'],.85,.6);          // campo castigado
def('G2',['#3a3828','#494632','#595439','#6b6544','#7f774f'],.85,.6);          // capim seco / queimado
def('MUD',['#221b14','#2f251b','#3f3226','#54432f','#6b5640'],1.05,.55);       // lama de terra de ninguém
def('ROAD',['#44382a','#574736','#6c5a44','#836f56','#9a866a'],.8,.5);
def('WATER',['#27372f','#31453b','#415649','#587060'],0,.9);
def('BANK',['#1f1913','#2b2319','#3a2e20','#4d3d2b'],.9,.9);
def('PLOW',['#33261b','#45331f','#5a432b','#6f5538','#876b4a'],1.4,.5);
def('CROP',['#2a4424','#355a2c','#447137','#588a44','#72a257'],1,.6);
def('WHEAT',['#6c5d2e','#85743a','#a08d48','#bca65a','#d4c172'],1,.6);
def('FLOOR',['#17110b','#21180f','#2d2216','#3b2d1e','#4b3b28'],.7,.45);      // chão da trincheira
def('DUCK',['#3f2f20','#574330','#705840','#8b7252','#a48b66'],.6,.25);        // passadiço de tábuas
def('REV',['#2a1f15','#3a2b1c','#4f3b27','#67503a','#816850'],.8,.35);         // revestimento de madeira
def('SAND',['#4a412c','#6b6044','#8f8260','#9e9069','#ab9d74','#c4b688'],.12,0);        // sacos de areia
def('STEP',['#3a2b1d','#4e3c28','#654f35','#7d6546','#957b58'],.5,.35);        // degrau de tiro
def('PUDDLE',['#1f2b26','#2a3b34','#3a5047','#56705f'],0,.6);
def('GRAVEL',['#3b3a34','#4d4b43','#615e53','#77736a','#8d8880'],.7,.9);
def('STONE',['#4b4a42','#605e53','#76745f','#8c8a78','#a3a08f'],.9,.6);
def('CHAR',['#14110d','#1d1914','#292219','#362d22','#453a2c'],.9,.9);
def('FOAM',['#6f7e72','#8d9c8f','#afbdb0'],0,.7);
def('RAIL',['#30353a','#4b5157','#6a7178','#8c949b'],.5,.2);
def('SLEEP',['#241a12','#33261a','#46352a','#5a4635'],.6,.4);
def('STRAW',['#6a5a30','#85733f','#a18d4d','#bda65f','#d6c27a'],.6,.8);

const P={seed:SEED,
 g:['#2c3c25','#37492d','#445a36','#546c41','#667f4f'],
 m:['#2f2a22','#3b352b','#4b4336','#5e5545','#74695a'],
 r:['#6c5a44','#836f56','#9a866a'],
 w:['#27372f','#31453b','#415649','#587060'],
 foam:'#9fae9f',spark:'#cfe0d4',bank:['#2b2319','#3a2e20'],
 tuft:['#243520','#7e9a52'],flower:['#c7b15e','#a66a52'],
 tree:['#22351f','#31502a','#476e38','#689050'],trunk:['#3f2f22','#5c4632'],dead:['#3a3127','#5d4d3c'],ruin:['#7f6252','#9b7762','#5a453b'],deadRate:.6,pine:0,snow:0};

const DT_DENSE=[[0,1],[195,1],[238,.82],[276,.64],[314,.52],[374,.38],[450,.22],[500,.1],[560,.03],[600,0]],CL=WW.CLEAN||{},DT=CL.on&&CL.dt?CL.dt:DT_DENSE,DRY=CL.on&&CL.dry||1;
function dcurve(u){for(let i=1;i<DT.length;i++)if(u<=DT[i][0]){const a=DT[i-1],b=DT[i];return a[1]+(b[1]-a[1])*(u-a[0])/(b[0]-a[0])}return 0}
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};

function gen(W,H){
 const w=W*Z|0,h=H*Z|0,N=w*h,cv=mk(w,h),c=g2(cv),Lay=WW.layout();
 const Hm=new Float32Array(N),mat=new Uint8Array(N),vr=new Float32Array(N),Dm=new Float32Array(N);
 /* ruído em grade de 2 px com interpolação bilinear */
 const ST=2,gw=Math.ceil(w/ST)+2,gh=Math.ceil(h/ST)+2,FT=new Float32Array(gw*gh),F3=new Float32Array(gw*gh),FM=new Float32Array(gw*gh),FR=new Float32Array(gw*gh);
 for(let gy=0;gy<gh;gy++)for(let gx=0;gx<gw;gx++){const x=gx*ST,y=gy*ST,i=gy*gw+gx;FT[i]=fbm(x/70,y/70,SEED,3);F3[i]=fbm(x/34,y/34,SEED+31,3);FM[i]=fbm(x/13,y/13,SEED+5,2);FR[i]=1-Math.abs(2*fbm(x/19,y/19,SEED+77,3)-1)}
 const samp=(F,x,y)=>{const fx=x/ST,fy=y/ST,ix=fx|0,iy=fy|0,ax=fx-ix,ay=fy-iy,i=iy*gw+ix;return F[i]*(1-ax)*(1-ay)+F[i+1]*ax*(1-ay)+F[i+gw]*(1-ax)*ay+F[i+gw+1]*ax*ay};
 const G={w,h,N,Hm,mat,vr,Dm,MT,MATS,P,samp,FT,F3,FM,FR,Lay,smooth,
  /* helpers para o conteúdo: altera altura/material num disco ou retângulo */
  at:(x,y)=>(y|0)*w+(x|0),
  put(x,y,m,v,dh){x|=0;y|=0;if(x<0||y<0||x>=w||y>=h)return;const i=y*w+x;if(m!=null)mat[i]=m;if(v!=null)vr[i]=v;if(dh)Hm[i]+=dh},
  bump(cx,cy,rx,ry,hh,m,v){const x0=Math.max(0,Math.floor(cx-rx-1)),x1=Math.min(w-1,Math.ceil(cx+rx+1)),y0=Math.max(0,Math.floor(cy-ry-1)),y1=Math.min(h-1,Math.ceil(cy+ry+1));
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const d=Math.hypot((x+.5-cx)/rx,(y+.5-cy)/ry);if(d>=1)continue;const k=(1-d*d);Hm[y*w+x]+=hh*k;if(m!=null&&d<.8){mat[y*w+x]=m;if(v!=null)vr[y*w+x]=v}}},
  rect(x0,y0,ww,hh,m,v,dh){for(let y=Math.max(0,y0|0);y<Math.min(h,(y0+hh)|0);y++)for(let x=Math.max(0,x0|0);x<Math.min(w,(x0+ww)|0);x++){const i=y*w+x;if(m!=null)mat[i]=m;if(v!=null)vr[i]=typeof v==='function'?v(x,y):v;if(dh)Hm[i]+=typeof dh==='function'?dh(x,y):dh}}};

 /* ---------- 1. chão: grama, lama e relevo, por grau de destruição ---------- */
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,B=BAYER[(y&3)*4+(x&3)],n1=samp(FT,x,y),n3=samp(F3,x,y),nm=samp(FM,x,y),fr=samp(FR,x,y),u=Math.abs(x+.5-w/2),D=clamp(dcurve(u)+(n3-.5)*.45,0,1);Dm[i]=D;
  let ht=(n1-.5)*6+(nm-.5)*1.1;
  if(D+(n3-.5)*.4+(B-.5)*.22>.56){mat[i]=MT.MUD;const wet=vnoise(x/23,y/23,SEED+61);vr[i]=clamp(n1*.42+nm*.3+wet*.36-.12+(fr-.5)*.5,0,1);ht+=(fr-.5)*1.8*D;if((!CL.on||CL.puddle)&&D>.86&&vnoise(x/15,y/15,SEED+90)>.83){mat[i]=MT.PUDDLE;vr[i]=clamp(.25+vnoise(x/5,y/5,SEED+91)*.6,0,1);ht=Math.min(ht,-1.4)}}
  else{const tf=D*3.4*DRY+(B-.5)*.9+(n3-.5)*.8,tier=clamp(Math.floor(tf),0,2);mat[i]=tier;vr[i]=clamp((n1-.12)*1.45+(nm-.5)*.55,0,1)}
  Hm[i]=ht}

 /* ---------- 2. conteúdo do terreno (campos, estradas, rio, trincheiras, posições de tiro) ---------- */
 if(WW.ground)WW.ground(G);

 /* ---------- 3. iluminação: inclinação da altura → tom da rampa, com dithering ordenado ---------- */
 const img=c.createImageData(w,h),d=new Uint32Array(img.data.buffer);
 for(let y=0;y<h;y++){const ya=(y<h-1?y+1:y)*w,yb=(y>0?y-1:y)*w;for(let x=0;x<w;x++){const i=y*w+x,M=MATS[mat[i]],xa=x<w-1?x+1:x,xb=x>0?x-1:x,s=(Hm[ya+xa]-Hm[yb+xb])*.5,B=BAYER[(y&3)*4+(x&3)];
  const t=vr[i]*(M.n-1)+s*M.gain+.5+(B-.5)*M.dith;d[i]=M.ramp[clamp(Math.floor(t),0,M.n-1)]}}
 c.putImageData(img,0,0);

 /* ---------- 4. pintura sobre o chão: crateras, detalhes, sprites ---------- */
 const out={canvas:cv,decor:[],sparkles:G.sparkles||[],P,craters:[],ambient:[]};
 if(WW.paint)WW.paint(c,G,out);
 return out}

const orig=PX.genTerrain;
PX.genTerrain=function(key,W,H){return key===WW.MAPKEY?gen(W,H):orig(key,W,H)};
WW.G={MATS,MT,P,dcurve,smooth,HEX,DT_DENSE};
})();
