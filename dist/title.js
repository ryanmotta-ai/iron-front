'use strict';
/* Iron Front 0.9 — cena da tela inicial: interior de um bunker da Primeira Guerra olhando a terra de ninguém
   pela seteira, ao entardecer. Tudo procedural em pixels inteiros: camadas em cache + efeitos animados
   + mapa de luz quantizado com dithering de Bayer. */
(function(){
const U=UIArt,{hash,bay,mk,g2,R,clamp,text,textW,mixc}=U;
const P={
 wood:['#0e0905','#1b1108','#2c1c0e','#412b15','#5a3d1e','#7a5529','#9c7238'],
 iron:['#0c0f12','#171c21','#242b32','#36404a','#4f5c68','#71808d','#9aa8b3'],
 sand:['#1a170e','#352f1b','#574d2e','#7a6c40','#9c8b55','#bfae78','#e0d0a0'],
 olive:['#12140a','#21250f','#353b17','#4c5522','#66722f','#85943f'],
 cnv:['#1b170f','#322a1a','#544830','#7a6b48','#a08f66'],
 rust:['#2a1208','#4a200d','#6b3113','#8c4519'],
 sky:['#060a1c','#0c1230','#181a46','#2b1f52','#47295a','#7a3a58','#b5523f','#dc7a3a','#f2a848','#ffd27a'],
 ink:'#06080b'
};
const at=(a,i)=>a[clamp(i|0,0,a.length-1)];
let cv=null,cx=null,W=480,H=270,K=3,running=false,raf=0,lastT=0,tm=0,acc=0;
let LY={},lay={},L2={},ev={flares:[],tracers:[],puffs:[],plumes:[],motes:[],drips:[],smoke:[],birds:[],plane:null,rat:null,steam:[]};
let mx=0,my=0,tx=0,ty=0,flash=0,flashX=0.5,shake=0,dustT=0,lanSway=0,lanVel=0,nextFlash=2.2,nextFlare=5,nextTracer=9,nextPlane=22,nextBird=16,nextRat=11,nextDrip=1,nextBoom=-1,soundCb=null;
let lm=null;
const FULL=true;/* janela panorâmica: sem a mesa, o soldado e a tralha do bunker */

/* ===== blocos de construção ===== */
function plankV(c,x,y,w,h,seed,ramp=P.wood,tone=0){
 const b=2+(hash(seed,1,3)*2|0)+tone;R(c,x,y,w,h,at(ramp,b));
 for(let i=0;i<w;i++){const g=hash(seed,i,5);if(g>.5){for(let j=0;j<h;j++)if(hash(seed+i,j>>2,9)>.45)R(c,x+i,y+j,1,1,at(ramp,b-1))}else if(g<.14)R(c,x+i,y,1,h,at(ramp,b+1))}
 R(c,x,y,1,h,at(ramp,b+1));R(c,x+w-1,y,1,h,at(ramp,b-2));
 if(hash(seed,2,2)>.55){const ky=y+5+(hash(seed,3,4)*(h-14)|0);R(c,x+2,ky,3,4,at(ramp,b-2));R(c,x+3,ky+1,1,2,at(ramp,b+1))}
 R(c,x+(w>>1),y+2,1,1,P.iron[5]);R(c,x+(w>>1),y+h-3,1,1,P.iron[5])}
function plankH(c,x,y,w,h,seed,ramp=P.wood,tone=0){
 const b=2+(hash(seed,1,3)*2|0)+tone;R(c,x,y,w,h,at(ramp,b));
 for(let j=0;j<h;j++){const g=hash(seed,j,5);if(g>.5){for(let i=0;i<w;i++)if(hash(i>>2,seed+j,9)>.4)R(c,x+i,y+j,1,1,at(ramp,b-1))}else if(g<.15)R(c,x,y+j,w,1,at(ramp,b+1))}
 R(c,x,y,w,1,at(ramp,b+2));R(c,x,y+h-1,w,1,at(ramp,b-2));
 for(let k=0;k<Math.floor(w/26);k++)if(hash(seed,k,7)>.6){const kx=x+6+k*26+(hash(seed,k,1)*10|0);R(c,kx,y+1,4,Math.max(1,h-3),at(ramp,b-2));R(c,kx+1,y+2,2,Math.max(1,h-5),at(ramp,b+1))}}
function beamH(c,x,y,w,h,seed){plankH(c,x,y,w,h,seed,P.wood,1);R(c,x,y,w,1,P.wood[6]);R(c,x,y+h-2,w,2,P.wood[1]);
 for(let bx=x+10;bx<x+w-6;bx+=34+(hash(seed,bx,2)*22|0)){R(c,bx,y+1,5,h-2,P.iron[2]);R(c,bx,y+1,1,h-2,P.iron[4]);R(c,bx+4,y+1,1,h-2,P.iron[1]);R(c,bx+2,y+3,1,1,P.iron[6]);R(c,bx+2,y+h-4,1,1,P.iron[6])}}
function beamV(c,x,y,w,h,seed){plankV(c,x,y,w,h,seed,P.wood,1);R(c,x,y,1,h,P.wood[6]);R(c,x+w-2,y,2,h,P.wood[1]);
 for(let by=y+12;by<y+h-6;by+=40+(hash(seed,by,2)*24|0)){R(c,x+1,by,w-2,5,P.iron[2]);R(c,x+1,by,w-2,1,P.iron[4]);R(c,x+1,by+4,w-2,1,P.iron[1]);R(c,x+(w>>1),by+2,1,1,P.iron[6])}}
function sandbag(c,x,y,w=22,h=11,seed=0){
 const b=2+(hash(seed,0,1)*2|0),s=P.sand;
 R(c,x+1,y,w-2,h,at(s,b));R(c,x,y+2,w,h-4,at(s,b));
 R(c,x+2,y,w-4,1,at(s,b+2));R(c,x+1,y+1,w-2,1,at(s,b+1));R(c,x,y+2,1,2,at(s,b+1));
 R(c,x+1,y+h-1,w-2,1,at(s,b-2));R(c,x+2,y+h-2,w-4,1,at(s,b-1));R(c,x+w-1,y+3,1,h-6,at(s,b-2));
 R(c,x+3,y+3,1,h-6,at(s,b-1));R(c,x+w-5,y+3,1,h-6,at(s,b-1));
 for(let i=0;i<(w*h/11|0);i++){const px=x+2+(hash(seed,i,3)*(w-4)|0),py=y+2+(hash(seed,i,4)*(h-4)|0);R(c,px,py,1,1,at(s,b+(i&1?1:-1)))}}
function sandWall(c,x0,y0,x1,y1,seed,bw=22,bh=11){
 let r=0;for(let y=y1-bh;y>y0-bh;y-=bh-2){const off=(r&1)*(bw>>1);for(let x=x0-off-bw;x<x1;x+=bw-2)sandbag(c,x,y,bw,bh,seed+r*31+((x/bw)|0));r++}}
function corrug(c,x,y,w,h,seed){const cols=[3,4,5,4,3,2];
 for(let i=0;i<w;i++){const ph=(x+i)%6;for(let j=0;j<h;j++){let ci=cols[ph];const n=hash(x+i,j>>1,seed);let col=P.iron[ci];
  if(n>.93)col=P.rust[2+(n>.97?1:0)-1];else if(n<.04)col=P.iron[Math.max(0,ci-2)];
  if(hash((x+i)>>2,j>>3,seed+5)>.88&&j>h*.35)col=P.rust[(ph>>1)+0];R(c,x+i,y+j,1,1,col)}}
 for(let bx=x+8;bx<x+w-4;bx+=38){for(const by of[y+3,y+h-5]){R(c,bx,by,3,3,P.iron[1]);R(c,bx,by,2,2,P.iron[5])}}
 R(c,x,y,w,1,P.iron[6]);R(c,x,y+h-1,w,1,P.iron[0])}
function ell(c,cx,cy,rx,ry,col){c.fillStyle=col;for(let j=-ry;j<=ry;j++){const w=Math.floor(rx*Math.sqrt(Math.max(0,1-(j*j)/((ry+.5)*(ry+.5)))));c.fillRect(Math.round(cx)-w,Math.round(cy)+j,w*2+1,1)}}
function pline(c,x0,y0,x1,y1,col){x0|=0;y0|=0;x1|=0;y1|=0;const dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let err=dx+dy;c.fillStyle=col;for(;;){c.fillRect(x0,y0,1,1);if(x0===x1&&y0===y1)break;const e2=2*err;if(e2>=dy){err+=dy;x0+=sx}if(e2<=dx){err+=dx;y0+=sy}}}

/* ===== layout ===== */
function layout(){
 const narrow=W<420;
 LY.winX0=narrow?Math.round(W*.12):12;LY.winX1=W-12;LY.winW=LY.winX1-LY.winX0;
 LY.winY0=Math.round(H*.05);LY.winY1=H-Math.round(H*.085);LY.winH=LY.winY1-LY.winY0;
 LY.ledge=LY.winY1;LY.floor=H-2;LY.hy=Math.round(LY.winH*.56);
 LY.sx=LY.winX1-46;LY.posts=[Math.round(LY.winX0+LY.winW*.36),Math.round(LY.winX0+LY.winW*.7)]}

/* ===== camadas externas (vista pela seteira) ===== */
const PAD=12;
function buildSky(w,h){const cv=mk(w,h),c=g2(cv),hy=LY.hy+PAD;
 for(let y=0;y<h;y++){const f=clamp(y/hy,0,1),v=Math.pow(f,1.05)*(P.sky.length-1),i=Math.floor(v),t=v-i;
  for(let x=0;x<w;x++)R(c,x,y,1,1,bay(x,y)<t?P.sky[Math.min(i+1,P.sky.length-1)]:P.sky[i])}
 for(let i=0;i<90;i++){const x=hash(i,1,4)*w|0,y=hash(i,2,4)*hy*.62|0;R(c,x,y,1,1,i%5===0?'#ffe8b8':i%3===0?'#9fb0ff':'#cfd8ff')}
 // lua crescente encoberta
 const mxp=Math.round(w*.2),myp=Math.round(hy*.2);ell(c,mxp,myp,6,6,'#d8d4c0');ell(c,mxp+3,myp-1,6,6,P.sky[2]);R(c,mxp-4,myp-2,1,2,'#fff6d8');
 return cv}
function cloudBand(w,h,seed,tone){const cv=mk(w,h),c=g2(cv),dark=tone?'#0d0b22':'#171432',mid=tone?'#22183a':'#2a1d48';
 for(let n=0;n<Math.round(w/46);n++){const cx=hash(n,seed,1)*w,cy=h*.35+hash(n,seed,2)*h*.3,rx=22+hash(n,seed,3)*34,ry=4+hash(n,seed,4)*6;
  for(let j=-ry;j<=ry;j++){const ww=Math.floor(rx*Math.sqrt(1-(j*j)/((ry+.5)*(ry+.5)))+hash(j,n,seed)*6);
   for(let i=-ww;i<=ww;i++){const px=(cx+i+w)%w,py=cy+j;const lit=(j+ry)/(2*ry);let col=lit>.55?bay(px,py)<(lit-.5)*1.5*(tone?.6:1)?at(['#7a3a58','#b5523f','#dc7a3a'],Math.floor(lit*3-1)):mid:(lit<.25?dark:mid);R(c,px,py|0,1,1,col)}}}
 return cv}
function buildFar(w,h){const cv=mk(w,h),c=g2(cv),hy=LY.hy+PAD,base='#150f20',rim='#4a2836';
 const prof=x=>Math.round(hy-5-Math.sin(x/47+1)*4-Math.sin(x/19)*2-Math.sin(x/9.3)*.8);
 for(let x=0;x<w;x++){const y=prof(x);R(c,x,y,1,h-y,base);R(c,x,y,1,1,rim);if(bay(x,y)<.4)R(c,x,y+1,1,1,'#2a1a2a')}
 // linha de árvores mortas
 for(let x=2;x<w;x+=3+(hash(x,1,8)*5|0)){const y=prof(x),th=5+(hash(x,2,8)*9|0);R(c,x,y-th,1,th,'#120c1a');for(let b=1;b<th-1;b+=3){const d=hash(x,b,3)>.5?1:-1;R(c,x+d,y-th+b,1,1,'#120c1a');if(b<th-3)R(c,x+d*2,y-th+b-1,1,1,'#120c1a')}}
 // igreja em ruínas
 const ch=(cx)=>{const y=prof(cx);R(c,cx-9,y-13,18,13,'#0f0a18');R(c,cx-9,y-13,18,1,rim);
  for(let i=0;i<7;i++)R(c,cx-8+i,y-13-i,1,1,'#0f0a18');for(let i=0;i<7;i++)R(c,cx-8+i,y-14-i,1,1,rim);
  R(c,cx+3,y-34,6,34,'#0f0a18');R(c,cx+3,y-34,1,34,rim);R(c,cx+5,y-40,2,6,'#0f0a18');R(c,cx+4,y-37,1,3,'#0f0a18');R(c,cx+8,y-36,1,3,'#0f0a18');R(c,cx+6,y-44,1,5,'#0f0a18');
  R(c,cx+4,y-28,2,4,'#e0843c');R(c,cx-6,y-9,2,4,'#dc7a3a');R(c,cx-2,y-9,2,4,'#b5523f');R(c,cx+1,y-9,1,4,'#dc7a3a');
  for(let i=0;i<5;i++)R(c,cx-9+i*4,y-14-(hash(i,cx,5)*3|0),2,2,'#0f0a18')};
 ch(Math.round(w*.3));
 // moinho quebrado
 const wm=Math.round(w*.76),wy=prof(wm);for(let j=0;j<22;j++){const hw=Math.round(5-j*.12);R(c,wm-hw,wy-j,hw*2,1,'#0f0a18');R(c,wm-hw,wy-j,1,1,rim)}
 R(c,wm-6,wy-24,12,3,'#0f0a18');R(c,wm-3,wy-27,6,3,'#0f0a18');
 for(const[dx,dy,l]of[[-1,-1,14],[1,-1,12],[1,1,10],[-1,1,4]]){for(let i=2;i<l;i++)R(c,wm+dx*i,wy-22+dy*i,1,1,'#0f0a18')}
 // casas do vilarejo
 for(const hx of[.44,.49,.535,.58,.63,.9]){const x=Math.round(w*hx),y=prof(x),ww=7+(hash(hx*100,1,1)*5|0),hh=6+(hash(hx*100,2,1)*4|0);
  R(c,x,y-hh,ww,hh,'#110b19');for(let i=0;i<=ww/2;i++)R(c,x+i,y-hh-i*.6|0,ww-i*2,1,'#110b19');R(c,x,y-hh,ww,1,rim);
  if(hx<.64){R(c,x+2,y-hh+2,2,2,'#f2a848');if(ww>8)R(c,x+ww-4,y-hh+2,2,2,'#dc7a3a')}}
 return cv}
function buildMid(w,h){const cv=mk(w,h),c=g2(cv),hy=LY.hy+PAD,top=hy+5;
 const prof=x=>Math.round(top+Math.sin(x/33)*2.5+Math.sin(x/12+2)*1.2);
 const g=['#140e15','#1c1219','#27171d','#331f22','#44282a'];
 for(let x=0;x<w;x++){const y=prof(x);for(let j=y;j<h;j++){const t=(j-y)/(h-y);let i=t<.12?4:t<.4?3:t<.7?2:1;if(bay(x,j)<((t*6)%1)*.4&&i<4)i++;
   R(c,x,j,1,1,g[clamp(i-(t>.8?1:0),0,4)])}
  R(c,x,y,1,1,'#5a2e30')}
 // trincheira: zigue-zague com sacos de areia
 for(let x=0;x<w;x+=2){const y=prof(x)+9+Math.round(Math.sin(x/5)*1.3);R(c,x,y,3,3,'#07050a');R(c,x,y-1,3,1,'#4a3a2a');if(x%6===0)R(c,x,y-2,3,2,'#6a5536')}
 // cerca de arame
 for(let x=3;x<w;x+=13){const y=prof(x)+20;R(c,x,y-8,1,9,'#0b070d');R(c,x,y-8,1,1,'#3a2a2a')}
 for(let x=3;x<w-13;x+=13){const y=prof(x)+20;for(let s=0;s<3;s++){const yy=y-7+s*3;for(let i=0;i<13;i++)if(i%2===0)R(c,x+i,yy+(i%4===0?0:1),1,1,'#0b070d')}}
 // árvores mortas
 const dead=(x,y,hgt,seed)=>{R(c,x,y-hgt,2,hgt,'#0a060d');R(c,x,y-hgt,1,hgt,'#3a2228');
  for(let b=3;b<hgt-2;b+=4){const d=hash(seed,b,1)>.5?1:-1,l=3+(hash(seed,b,2)*6|0);for(let i=1;i<=l;i++)R(c,x+(d>0?1+i:-i),y-hgt+b-(i>>1),1,1,'#0a060d')}};
 dead(Math.round(w*.14),prof(w*.14)+24,44,1);dead(Math.round(w*.52),prof(w*.52)+18,30,2);dead(Math.round(w*.88),prof(w*.88)+22,38,3);
 // carcaça de tanque
 const tx=Math.round(w*.64),ty=prof(tx)+17;R(c,tx-15,ty-9,30,9,'#0a060d');R(c,tx-12,ty-14,20,6,'#0a060d');R(c,tx-15,ty-9,30,1,'#4a2a2c');R(c,tx-12,ty-14,20,1,'#4a2a2c');R(c,tx+8,ty-12,12,2,'#0a060d');R(c,tx-18,ty-7,4,3,'#0a060d');
 for(let i=-14;i<15;i+=3)R(c,tx+i,ty-1,2,2,'#140c14');
 // crateras com aro iluminado
 for(const[cx,cy,rx]of[[.3,30,10],[.77,26,12],[.44,34,7]]){const x=Math.round(w*cx),y=prof(x)+cy;ell(c,x,y,rx,3,'#3a2326');ell(c,x,y+1,rx-2,2,'#07050a')}
 // postes de telégrafo
 for(const px of[.4,.93]){const x=Math.round(w*px),y=prof(x)+16;R(c,x,y-34,2,34,'#0a060d');R(c,x-5,y-33,12,2,'#0a060d');R(c,x-4,y-30,10,1,'#0a060d');R(c,x,y-34,1,34,'#3a2228')}
 return cv}
function buildNear(w,h){const cv=mk(w,h),c=g2(cv),y0=h-34;
 const prof=x=>Math.round(y0+10+Math.sin(x/21)*3+Math.sin(x/7)*1.2);
 for(let x=0;x<w;x++){const y=prof(x);R(c,x,y,1,h-y,'#0c0810');R(c,x,y,1,1,'#3a2228');if(bay(x,y)<.35)R(c,x,y+1,1,1,'#1d1319')}
 // rolos de arame farpado
 const coil=(x,y,r)=>{for(let a=0;a<14;a++){const an=a/14*Math.PI*2;R(c,x+Math.cos(an)*r*1.6,y+Math.sin(an)*r,1,1,'#05040a')}
  for(let i=-r*1.6;i<=r*1.6;i+=3){ell(c,x+i,y,1,r,'#05040a')}R(c,x-r*1.6,y-r,r*3.2,1,'#2a1a20');
  for(let i=0;i<r*3;i++)R(c,x-r*1.6+hash(i,x,2)*r*3.2|0,y-r+hash(i,y,3)*r*2|0,1,1,'#8a8a90')};
 for(const[px,py,r]of[[.06,14,7],[.3,12,8],[.52,18,6],[.75,13,9],[.96,16,7]])coil(Math.round(w*px),y0+py+8,r);
 // piquetes de parafuso
 for(const px of[.12,.22,.41,.6,.68,.86]){const x=Math.round(w*px),y=prof(x);R(c,x,y-18,2,20,'#05040a');R(c,x,y-18,1,18,'#3a2a30');for(let i=0;i<5;i++){R(c,x+(i&1?2:-1),y-18+i*2,1,1,'#05040a')}}
 // capacete no chão e cruz de madeira
 const hx=Math.round(w*.38),hy=prof(hx)+6;ell(c,hx,hy,4,2,'#0c0f08');R(c,hx-5,hy+1,10,1,'#0c0f08');R(c,hx-3,hy-2,3,1,'#4a5522');
 const kx=Math.round(w*.83),ky=prof(kx);R(c,kx,ky-14,2,16,'#0a0608');R(c,kx-4,ky-10,10,2,'#0a0608');R(c,kx,ky-14,1,16,'#4a3a2a');R(c,kx-4,ky-10,10,1,'#4a3a2a');
 return cv}

/* ===== paredes e estrutura do bunker ===== */
function buildWall(){
 const cv=mk(W,H),c=g2(cv),{winX0,winX1,winY0,winY1,floor,ledge}=LY;
 // tábuas de fundo
 for(let x=0,i=0;x<W;x+=11,i++)plankV(c,x,0,11,floor+2,i*7+3,P.wood,0);
 // parede de sacos de areia sob a seteira
 sandWall(c,-10,ledge+8,W+10,floor+8,11);
 // ferro corrugado acima da seteira
 corrug(c,winX0-18,13,winX1-winX0+30,winY0-13-9,5);
 // viga da verga
 beamH(c,winX0-18,winY0-12,winX1-winX0+30,12,4);
 // coluna esquerda e direita
 beamV(c,winX0-18,winY0-12,10,ledge-winY0+22,6);
 // abertura
 c.clearRect(winX0,winY0,winX1-winX0,winY1-winY0);
 // bordas internas (espessura do muro)
 R(c,winX0,winY0,winX1-winX0,3,P.wood[1]);R(c,winX0,winY0+3,winX1-winX0,1,P.wood[2]);
 R(c,winX0,winY0,3,winY1-winY0,P.wood[1]);R(c,winX0+3,winY0+3,1,winY1-winY0-3,P.wood[2]);
 // montantes centrais
 for(const[k,px]of (FULL?[]:LY.posts).entries()){beamV(c,px-3,winY0,7,winY1-winY0,20+k*5);
  for(let s=0;s<4;s++){const by=winY0+14+(hash(k,s,6)*(winY1-winY0-30)|0);R(c,px-3+(s&1?0:3),by,2,2,P.wood[0]);R(c,px-4,by+1,1,1,P.wood[5])}
  if(k===0){R(c,px-2,winY1-28,3,8,P.wood[1]);R(c,px-6,winY1-24,5,2,P.wood[5])}}
 // travessas em X entre o primeiro e o segundo montante
 const a=LY.posts[0]+4,b=LY.posts[1]-4;for(let i=0;i<=(FULL?-1:b-a);i++){const y=winY0+4+Math.round(i*((winY1-winY0-14)/(b-a)));R(c,a+i,y,2,1,P.wood[3]);R(c,a+i,y+1,2,1,P.wood[1])}
 // pilha de sacos no canto esquerdo da seteira
 if(!FULL)sandWall(c,winX0,winY1-26,winX0+44,winY1+2,71,20,10);
 // vigas do teto
 for(let x=0;x<W;x+=3)R(c,x,0,3,14,P.wood[1]);beamH(c,-4,0,W+8,12,1);
 for(let x=16;x<W;x+=58){beamV(c,x,10,8,10,30+x)}
 R(c,0,12,W,2,P.wood[0]);R(c,0,14,W,1,P.wood[2]);
 // moldura esquerda (poste de canto)
 beamV(c,0,0,9,LY.floor+4,17);
 return cv}

/* ===== props de primeiro plano (ficam na frente do soldado) ===== */
function buildFore(){
 const cv=mk(W,H),c=g2(cv),{winX0,winX1,winW,ledge,floor}=LY,fy=floor;
 // piso de pranchas
 const fh=H-fy;for(let r=0;r<3;r++){const y0=fy+Math.round(r*fh/3),hh=Math.round(fh/3)+(r===2?2:0);
  for(let x=-((r*9)%18);x<W;x+=18){plankH(c,x,y0,18,hh,r*131+((x/18)|0),P.wood,r===0?0:-1);R(c,x,y0,1,hh,P.wood[0])}R(c,0,y0,W,1,P.wood[0])}
 R(c,0,fy,W,1,P.wood[1]);
 // poças
 for(const[px,py,rx]of[[.12,.55,22],[.46,.75,16],[.78,.62,26]]){const x=Math.round(W*px),y=fy+Math.round(fh*py);ell(c,x,y,rx,4,'#07090e');ell(c,x,y,rx-2,3,'#10151f');ell(c,x-3,y-1,rx-8,1,'#1c2a3a')}
 // parapeito (bancada da seteira)
 for(let x=winX0-18;x<W;x+=26)plankH(c,x,ledge,26,6,200+x,P.wood,1);
 R(c,winX0-18,ledge,W,1,P.wood[6]);R(c,winX0-18,ledge+6,W,2,P.wood[1]);
 for(let x=winX0-18;x<W;x+=26)plankH(c,x,ledge+6,26,5,310+x,P.wood,-1);
 R(c,winX0-18,ledge+11,W,1,P.wood[0]);
 if(FULL)return cv;
 // itens na bancada
 const ly=ledge;
 // binóculos no estojo
 R(c,winX0+70,ly-6,14,7,P.cnv[2]);R(c,winX0+70,ly-6,14,1,P.cnv[4]);R(c,winX0+70,ly,14,1,P.cnv[0]);R(c,winX0+76,ly-7,2,3,P.iron[2]);
 // fileira de granadas Mk II
 for(let i=0;i<5;i++){const gx=winX0+100+i*7;R(c,gx,ly-7,5,7,P.olive[2]);R(c,gx,ly-7,5,1,P.olive[4]);R(c,gx+1,ly-9,3,2,P.iron[3]);R(c,gx+4,ly-7,1,7,P.olive[0]);for(let k=0;k<3;k++){R(c,gx+1,ly-6+k*2,3,1,P.olive[1])}R(c,gx+2,ly-11,1,2,P.iron[5])}
 // caneca de lata
 const mxp=LY.sx-56;R(c,mxp,ly-8,7,8,P.iron[4]);R(c,mxp,ly-8,7,1,P.iron[6]);R(c,mxp+1,ly-7,1,7,P.iron[6]);R(c,mxp+6,ly-7,1,7,P.iron[2]);R(c,mxp+7,ly-6,2,4,P.iron[5]);R(c,mxp+8,ly-5,1,2,P.iron[1]);R(c,mxp+1,ly-8,5,1,'#5a3116');
 // caderno e lápis
 R(c,winX0+38,ly-2,16,3,'#c9bd98');R(c,winX0+38,ly-2,16,1,'#ebe2c6');R(c,winX0+38,ly,16,1,'#6a5d3c');R(c,winX0+42,ly-3,9,1,'#dcd2b0');R(c,winX0+56,ly-1,7,1,'#d6a840');R(c,winX0+62,ly-1,1,1,'#a03a2a');
 // telefone de campanha (manivela)
 const tx=winX0+4;R(c,tx,ly-13,16,13,P.wood[3]);R(c,tx,ly-13,16,1,P.wood[6]);R(c,tx,ly-1,16,1,P.wood[0]);R(c,tx+1,ly-12,14,1,P.wood[5]);R(c,tx+3,ly-10,10,5,P.iron[1]);R(c,tx+4,ly-9,8,3,'#1f2a1a');R(c,tx+4,ly-9,8,1,'#40533a');R(c,tx+14,ly-9,4,2,P.iron[5]);R(c,tx+17,ly-9,1,6,P.iron[5]);R(c,tx+2,ly-4,4,1,P.iron[5]);R(c,tx+10,ly-4,4,2,P.iron[4]);R(c,tx+2,ly-15,12,2,P.iron[2]);R(c,tx+1,ly-16,3,2,P.iron[3]);R(c,tx+11,ly-16,3,2,P.iron[3]);
 // suporte da vela (garrafa)
 const vx=winX0+Math.round(winW*.56);R(c,vx,ly-9,4,9,'#0f3a2a');R(c,vx,ly-9,1,9,'#2f8a5a');R(c,vx+1,ly-11,2,2,'#0f3a2a');R(c,vx,ly-1,4,1,'#07160f');R(c,vx+1,ly-13,2,3,'#ece4c9');
 // ==== mesa de mapa ====
 const tbx=winX0+Math.round(winW*.05)+8,tby=fy-2;
 R(c,tbx,tby-32,80,5,P.wood[5]);R(c,tbx,tby-32,80,1,P.wood[6]);R(c,tbx,tby-28,80,2,P.wood[1]);
 for(const px of[tbx+3,tbx+72]){R(c,px,tby-27,5,29,P.wood[3]);R(c,px,tby-27,1,29,P.wood[5]);R(c,px+4,tby-27,1,29,P.wood[1])}
 R(c,tbx+8,tby-10,64,3,P.wood[2]);R(c,tbx+8,tby-10,64,1,P.wood[4]);
// mapa grande pregado na parede, com alfinetes e barbante
 const mpx=tbx-6,mpy=fy-120,mw=88,mh=56;
 R(c,mpx-2,mpy-2,mw+4,mh+4,P.wood[1]);R(c,mpx,mpy,mw,mh,'#cdbf95');R(c,mpx,mpy,mw,1,'#eadfb6');R(c,mpx,mpy+mh-1,mw,1,'#8f8257');R(c,mpx,mpy,1,mh,'#e0d4a8');R(c,mpx+mw-1,mpy,1,mh,'#a4966a');
 for(let i=0;i<220;i++){R(c,mpx+1+(hash(i,1,9)*(mw-2)|0),mpy+1+(hash(i,2,9)*(mh-2)|0),1,1,hash(i,3,9)>.5?'#b8aa7c':'#a89a6c')}
 for(let i=0;i<mw;i++){const y=mpy+26+Math.round(Math.sin(i/9)*6+Math.sin(i/3.3)*1);R(c,mpx+i,y,1,2,'#5a86a8');R(c,mpx+i,y,1,1,'#7ea6c4')}
 for(let k=0;k<3;k++){const y0=mpy+10+k*3;for(let i=0;i<34;i++){R(c,mpx+6+i,y0+((i>>1)%2),1,1,'#3a2a1a')}}
 for(let k=0;k<3;k++){const y0=mpy+40+k*3;for(let i=0;i<32;i++){R(c,mpx+50+i,y0+((i>>1)%2),1,1,'#8a2a1a')}}
 for(let i=0;i<12;i++){R(c,mpx+10+(hash(i,4,2)*70|0),mpy+5+(hash(i,5,2)*14|0),2,2,'#6a8a52')}
 text(c,'A',mpx+14,mpy+6,'#3a2a1a',1);text(c,'B',mpx+44,mpy+20,'#3a2a1a',1);text(c,'C',mpx+66,mpy+44,'#3a2a1a',1);
 const pins=[[16,14,'#2a60a0'],[24,18,'#2a60a0'],[36,12,'#2a60a0'],[58,44,'#b03a2a'],[68,40,'#b03a2a'],[74,48,'#b03a2a'],[46,26,'#e8c040']];
 for(const[px,py,col]of pins){R(c,mpx+px,mpy+py,3,3,col);R(c,mpx+px,mpy+py,1,1,mixc(col,'#ffffff',.6));R(c,mpx+px+2,mpy+py+2,1,1,mixc(col,'#000000',.5))}
 for(let i=0;i<46;i++){R(c,mpx+16+Math.round(i*(42/46)),mpy+14+Math.round(i*(30/46)),1,1,'#a02a1e')}
 for(let i=0;i<24;i++){R(c,mpx+36+Math.round(i*(32/24)),mpy+12+Math.round(i*(28/24)),1,1,'#a02a1e')}
 R(c,mpx+mw/2-1,mpy-4,3,3,P.iron[5]);
 // papéis e caixa de lápis sobre a mesa
 R(c,tbx+10,tby-34,14,2,'#d4c9a2');R(c,tbx+12,tby-35,12,1,'#ece3c4');R(c,tbx+28,tby-36,6,4,P.wood[4]);R(c,tbx+28,tby-36,6,1,P.wood[6]);R(c,tbx+36,tby-34,4,2,'#a03a2a');
 // lampião de mesa + documentos
 R(c,tbx+58,tby-44,8,12,P.iron[2]);R(c,tbx+58,tby-44,8,1,P.iron[5]);R(c,tbx+59,tby-43,6,8,'#f2a848');R(c,tbx+60,tby-42,4,5,'#ffe9a0');R(c,tbx+57,tby-45,10,1,P.iron[3]);R(c,tbx+60,tby-47,4,2,P.iron[3]);R(c,tbx+58,tby-33,8,1,P.iron[1]);
 // ==== oficial sentado ====
 const ox=tbx-2,oy=tby-32;
 R(c,ox-14,oy-2,14,3,P.wood[4]);R(c,ox-12,oy+1,2,22,P.wood[2]);R(c,ox-2,oy+1,2,22,P.wood[2]);// banco
 R(c,ox-12,oy-22,11,20,P.olive[2]);R(c,ox-12,oy-22,11,1,P.olive[4]);R(c,ox-12,oy-22,1,20,P.olive[4]);R(c,ox-2,oy-22,1,20,P.olive[0]);// torso
 R(c,ox-15,oy-2,3,12,P.olive[1]);R(c,ox-11,oy-2,13,8,P.olive[2]);R(c,ox-11,oy+6,4,16,P.olive[1]);R(c,ox-2,oy+6,4,16,P.olive[1]);R(c,ox-12,oy+20,6,3,'#0e0905');R(c,ox-2,oy+20,7,3,'#0e0905');
 R(c,ox-9,oy-28,9,8,'#6a452e');R(c,ox-9,oy-28,2,8,'#8a5d42');R(c,ox-2,oy-26,1,4,'#3a261a');R(c,ox-5,oy-24,3,1,'#2a1a10');
 R(c,ox-11,oy-31,13,5,P.olive[3]);R(c,ox-13,oy-27,17,2,P.olive[1]);R(c,ox-10,oy-33,9,2,P.olive[4]);R(c,ox-11,oy-31,1,5,P.olive[5]);R(c,ox-13,oy-25,17,1,P.olive[0]);
 R(c,ox-3,oy-16,14,3,P.olive[3]);R(c,ox+8,oy-16,3,3,'#8a5d42');
 // ==== estante/rifle rack ====
 const rx=winX0+Math.round(winW*.44);
 R(c,rx,fy-44,42,4,P.wood[4]);R(c,rx,fy-44,42,1,P.wood[6]);R(c,rx,fy-18,42,4,P.wood[4]);R(c,rx,fy-18,42,1,P.wood[6]);R(c,rx-2,fy-46,3,46,P.wood[3]);R(c,rx+41,fy-46,3,46,P.wood[3]);
 for(let i=0;i<4;i++){const gx=rx+5+i*9;R(c,gx,fy-44,2,44,P.wood[3]);R(c,gx+2,fy-44,1,44,P.wood[1]);R(c,gx-1,fy-56,4,14,P.wood[2]);R(c,gx-1,fy-56,1,14,P.wood[4]);R(c,gx,fy-59,2,4,P.iron[3]);R(c,gx+1,fy-60,1,2,P.iron[5])}
 for(let i=0;i<4;i++){const gx=rx+5+i*9;R(c,gx,fy-44,2,4,P.iron[3])}
 R(c,rx+22,fy-42,18,5,P.canvas?P.cnv[2]:'#544830');R(c,rx+22,fy-42,18,1,P.cnv[4]);
 // ==== caixas de munição + barril ====
 const bx=winX0+Math.round(winW*.63);
 const crate=(x,y,w,h,seed,lab)=>{R(c,x,y,w,h,P.wood[3]);R(c,x,y,w,1,P.wood[6]);R(c,x,y,1,h,P.wood[5]);R(c,x+w-1,y,1,h,P.wood[1]);R(c,x,y+h-1,w,1,P.wood[0]);
  R(c,x+2,y,2,h,P.wood[2]);R(c,x+w-4,y,2,h,P.wood[2]);for(let k=0;k<h;k+=5)R(c,x,y+k,w,1,P.wood[2]);R(c,x+w-8,y+2,5,1,P.iron[4]);if(lab)text(c,lab,x+Math.round((w-textW(lab))/2),y+Math.round((h-7)/2),'#c9bd98',1,'#1b1108')};
 crate(bx,fy-22,50,22,1,'MUNIÇÃO');crate(bx+4,fy-42,42,20,2,'MK II');crate(bx+38,fy-58,16,16,3,'');R(c,bx+39,fy-62,14,4,P.iron[3]);
 // barril de água
 const brx=bx-24;R(c,brx,fy-26,18,26,P.wood[3]);R(c,brx,fy-26,18,1,P.wood[5]);R(c,brx+1,fy-26,3,26,P.wood[5]);R(c,brx+14,fy-26,4,26,P.wood[1]);for(const yy of[fy-22,fy-8])R(c,brx-1,yy,20,2,P.iron[3]),R(c,brx-1,yy,20,1,P.iron[5]);
 // ==== fogão de ferro ====
 const sx=W-58,sy=fy+2;R(c,sx,sy-28,34,28,P.iron[2]);R(c,sx,sy-28,34,2,P.iron[5]);R(c,sx,sy-28,2,28,P.iron[4]);R(c,sx+32,sy-28,2,28,P.iron[0]);
 for(let i=0;i<4;i++)R(c,sx+4+i*8,sy-2,4,2,P.iron[1]);R(c,sx+5,sy-22,14,12,P.iron[0]);R(c,sx+6,sy-21,12,10,'#7a2a0c');R(c,sx+6,sy-16,12,5,'#d8601a');R(c,sx+8,sy-13,8,3,'#ffb247');
 R(c,sx+22,sy-24,8,4,P.iron[0]);R(c,sx+23,sy-23,6,2,P.iron[4]);R(c,sx+26,sy-44,5,20,P.iron[2]);R(c,sx+26,sy-44,1,20,P.iron[5]);R(c,sx+30,sy-44,1,20,P.iron[0]);R(c,sx+24,sy-28,9,2,P.iron[3]);
 // chaleira
 R(c,sx+2,sy-36,14,8,P.iron[3]);R(c,sx+2,sy-36,14,1,P.iron[6]);R(c,sx+3,sy-35,2,7,P.iron[6]);R(c,sx+16,sy-34,4,2,P.iron[3]);R(c,sx+5,sy-39,8,1,P.iron[5]);R(c,sx+6,sy-40,6,1,P.iron[5]);
 // lenha empilhada
 for(let i=0;i<6;i++)ell(c,sx-12+(i%3)*6,sy-3-Math.floor(i/3)*5,3,2,i%2?P.wood[4]:P.wood[3]);
 // ==== parede esquerda: placa, máscara de gás, capacete, calendário ====
 R(c,10,190,54,26,P.wood[2]);R(c,10,190,54,1,P.wood[5]);R(c,10,215,54,1,P.wood[0]);text(c,'SETOR 7',14,193,'#d9cfae',1,'#1b1108');text(c,'POSTO AVANCADO',14,202,'#8f8660',1,'#1b1108');text(c,'BAIXE A VOZ',14,209,'#8f8660',1,'#1b1108');
 R(c,12,182,2,2,P.iron[5]);R(c,60,182,2,2,P.iron[5]);
 // máscara de gás pendurada
 R(c,12,150,2,4,P.iron[4]);R(c,7,154,12,16,P.cnv[2]);R(c,7,154,12,2,P.cnv[4]);R(c,7,168,12,2,P.cnv[0]);R(c,9,158,8,4,P.iron[1]);R(c,10,159,2,2,'#7fa0a0');R(c,14,159,2,2,'#7fa0a0');R(c,11,163,4,5,P.iron[2]);
 // capacete M1917 no prego
 R(c,34,142,2,4,P.iron[5]);ell(c,35,150,9,4,P.olive[3]);R(c,26,148,18,2,P.olive[2]);ell(c,35,148,6,3,P.olive[4]);R(c,26,152,18,1,P.olive[0]);R(c,30,147,4,1,P.olive[5]);
 // calendário
 R(c,78,140,22,28,'#d8ceb0');R(c,78,140,22,6,'#8f2a1f');R(c,78,140,22,1,'#b33a2a');text(c,'1917',81,141,'#f2e8c8',1);
 for(let j=0;j<4;j++)for(let i=0;i<5;i++)R(c,80+i*4,149+j*4,2,2,hash(i,j,4)>.7?'#8f2a1f':'#7a7358');R(c,88,138,2,3,P.iron[5]);
 // quadro de avisos/fotografia
 R(c,106,150,14,18,P.wood[4]);R(c,107,151,12,16,'#d2c7a4');R(c,109,153,8,7,'#4a4a3a');ell(c,113,156,2,2,'#b98a64');R(c,110,162,6,3,'#7a6a4a');
 return cv}

/* ===== soldado (visto de trás, apoiado na bancada) — desenhado num sprite próprio com contorno ===== */
let solTmp=null,solSil=null;
function drawSoldier(c,t,rim){
 const W0=64,H0=84,ox=32,oy=78;
 if(!solTmp){solTmp=mk(W0,H0);solSil=mk(W0,H0)}
 const g=g2(solTmp);g.clearRect(0,0,W0,H0);
 const cyc=t%14,up=cyc<8.2||cyc>12.6,smoke=cyc>9.4&&cyc<12,br=Math.round(Math.sin(t*1.6)*.6+.5);
 const look=cyc<8?Math.round(Math.sin(cyc*.8)*2):0;
 const o=P.olive,st=['#1b211f','#2e3835','#4a5a55','#72847d','#a4b4ac'],sx=ox,ly=oy;
 // pá de trincheira e mochila
 R(g,sx+7,ly-26+br,2,18,P.iron[2]);R(g,sx+7,ly-26+br,1,18,P.iron[4]);
 R(g,sx-11,ly-30+br,22,22,P.cnv[2]);R(g,sx-11,ly-30+br,22,2,P.cnv[4]);R(g,sx-11,ly-28+br,2,18,P.cnv[3]);R(g,sx+9,ly-28+br,2,18,P.cnv[0]);
 for(const dx of[-5,4])R(g,sx+dx,ly-30+br,2,22,P.cnv[1]);
 // rolo de cobertor sobre os ombros
 R(g,sx-15,ly-39+br,30,6,P.cnv[3]);R(g,sx-15,ly-39+br,30,2,P.cnv[4]);R(g,sx-15,ly-35+br,30,1,P.cnv[1]);R(g,sx-16,ly-38+br,2,4,P.cnv[2]);R(g,sx+14,ly-38+br,2,4,P.cnv[0]);
 for(const dx of[-9,0,8])R(g,sx+dx,ly-39+br,1,6,P.cnv[1]);
 // ombros
 R(g,sx-14,ly-46+br,28,9,o[2]);R(g,sx-14,ly-46+br,28,2,o[4]);R(g,sx-15,ly-44+br,2,8,o[3]);R(g,sx+13,ly-44+br,2,8,o[0]);R(g,sx-3,ly-46+br,6,9,o[1]);
 // pescoço
 R(g,sx-3,ly-51+br,7,6,'#4a3020');R(g,sx-3,ly-51+br,2,6,'#6a4630');R(g,sx-3,ly-47+br,7,1,'#2e1c12');
 // cabeça + capacete
 const hx=sx+look,hy=ly-58+br;
 R(g,hx-5,hy+5,10,3,'#4a3020');
 R(g,hx-4,hy-7,8,1,st[4]);R(g,hx-6,hy-6,12,1,st[4]);R(g,hx-7,hy-5,14,4,st[3]);R(g,hx-8,hy-1,16,3,st[2]);
 R(g,hx-7,hy-6,2,4,st[4]);R(g,hx+5,hy-5,3,6,st[1]);R(g,hx-2,hy-7,3,2,'#d6e2dc');
 R(g,hx-12,hy+2,24,1,st[3]);R(g,hx-13,hy+3,26,1,st[2]);R(g,hx-12,hy+4,24,1,st[1]);R(g,hx-10,hy+5,20,1,st[0]);R(g,hx-12,hy+2,2,1,st[4]);
 // braços
 if(up){
  for(let i=0;i<=16;i++){const a=i/16,yy=ly-32+br-Math.round(a*26);R(g,sx-18+Math.round(a*9),yy,4,4,o[2]);R(g,sx+14-Math.round(a*8),yy,4,4,o[2]);if(i<4){R(g,sx-18,yy,1,4,o[1]);R(g,sx+17,yy,1,4,o[0])}}
  R(g,hx-10,hy-6+6,5,7,P.iron[1]);R(g,hx-10,hy-6+6,1,7,P.iron[4]);R(g,hx+6,hy-6+6,5,7,P.iron[1]);R(g,hx+10,hy-6+6,1,7,P.iron[0]);
  R(g,hx-9,hy+3,18,3,P.iron[1]);R(g,hx-9,hy+3,18,1,P.iron[3]);
  R(g,hx-12,hy+8,3,3,'#9a6a4a');R(g,hx+10,hy+8,3,3,'#8a5a3a');
 }else{
  R(g,sx-19,ly-44+br,4,14,o[2]);R(g,sx-19,ly-44+br,1,14,o[1]);R(g,sx+15,ly-44+br,4,14,o[2]);
  R(g,sx+14,ly-52+br,5,6,o[2]);R(g,sx+14,ly-54+br,4,3,'#9a6a4a');R(g,sx+17,ly-54+br,4,1,'#ece4c9');
 }
 // luz de contorno (fogo no horizonte, à esquerda)
 for(let i=0;i<6;i++)R(g,hx-8+i,hy-5+(i>>2),1,1,rim);R(g,hx-12,hy+2,1,1,rim);R(g,sx-14,ly-46+br,1,9,rim);R(g,sx-15,ly-44+br,1,6,rim);
 // contorno escuro em volta de toda a silhueta
 const sg=g2(solSil);sg.clearRect(0,0,W0,H0);sg.globalCompositeOperation='source-over';sg.drawImage(solTmp,0,0);sg.globalCompositeOperation='source-in';sg.fillStyle='#06080b';sg.fillRect(0,0,W0,H0);sg.globalCompositeOperation='source-over';
 const dx0=LY.sx-ox,dy0=LY.ledge-oy;
 for(const[ax,ay]of[[-1,0],[1,0],[0,-1],[0,1]])c.drawImage(solSil,dx0+ax,dy0+ay);
 c.drawImage(solTmp,dx0,dy0);
 return{ember:!up?{x:LY.sx+17,y:LY.ledge-54+br}:null,smoking:smoke,head:{x:LY.sx+look,y:LY.ledge-58+br}}}

/* ===== lanternas (dinâmicas) ===== */
function drawLantern(c,x,y,t,sway,big){
 const ang=sway*1, w=big?12:8,h=big?16:11;
 const top=LY.winY0-12;// corrente presa na viga da verga
 // corrente
 let px=x-ang*(y-14)*.6,py=14;for(let i=0;i<=(y-14)/3;i++){const k=i/((y-14)/3||1),nx=x-ang*(y-14)*.6+ang*(y-14)*.6*k,ny=14+i*3;R(c,nx,ny,1,2,i%2?P.iron[5]:P.iron[3])}
 const lx=Math.round(x-w/2),ly=Math.round(y);
 R(c,lx+1,ly-3,w-2,3,P.iron[2]);R(c,lx+2,ly-5,w-4,2,P.iron[3]);R(c,lx+w/2-1,ly-7,2,2,P.iron[5]);R(c,lx,ly,w,1,P.iron[1]);
 R(c,lx+1,ly+1,w-2,h-2,'#ffd27a');R(c,lx+2,ly+2,w-4,h-5,'#fff3c0');R(c,lx+w/2-1,ly+4,2,h-9,'#ffffff');
 R(c,lx,ly,1,h,P.iron[4]);R(c,lx+w-1,ly,1,h,P.iron[1]);R(c,lx+w/2,ly,1,h,P.iron[2]);R(c,lx,ly+h-1,w,2,P.iron[2]);R(c,lx+1,ly+h+1,w-2,1,P.iron[0])}

/* ===== eventos dinâmicos ===== */
const hyAbs=()=>LY.winY0-PAD+LY.hy+PAD;// horizonte em coords de tela
function addFlash(){flash=1;flashX=.12+Math.random()*.8;const gx=LY.winX0+flashX*LY.winW;
 const n=8+(Math.random()*8|0);for(let i=0;i<n;i++)ev.plumes.push({x:gx+(Math.random()*12-6),y:hyAbs()+4,vx:(Math.random()-.5)*40,vy:-(25+Math.random()*50),t:.6+Math.random()*.6,max:1.1,s:1+(Math.random()*2|0)});
 ev.puffs.push({x:gx,y:hyAbs()-2,t:3,max:3,r:2,s:1});
 nextBoom=.55+Math.random()*.25}
function thump(amount){shake=Math.max(shake,amount);lanVel+=(Math.random()<.5?-1:1)*amount*.06;
 for(let i=0;i<14;i++)ev.drips.push({x:Math.random()*W,y:16,vy:10+Math.random()*24,a:1,dust:1,t:1.4+Math.random()})}
function addFlare(){const gx=LY.winX0+30+Math.random()*(LY.winW-80);ev.flares.push({x:gx,y:hyAbs()+8,phase:0,vy:-78-Math.random()*20,ap:LY.winY0+14+Math.random()*26,t:0,life:11,ph:Math.random()*6,trail:[]})}
function addTracers(){const dir=Math.random()<.5?1:-1,sx=dir>0?LY.winX0:LY.winX1,yy=hyAbs()+6+Math.random()*10,n=5+(Math.random()*5|0);for(let i=0;i<n;i++)ev.tracers.push({x:sx-dir*i*(22+Math.random()*10),y:yy+Math.random()*3,vx:dir*(260+Math.random()*60),vy:-(Math.random()*7),col:i%3===0?'#ff6a3a':'#ffe680'})}
function addBirds(){const dir=Math.random()<.5?1:-1,n=4+(Math.random()*4|0),y0=LY.winY0+8+Math.random()*26;for(let i=0;i<n;i++)ev.birds.push({x:(dir>0?LY.winX0-10:LY.winX1+10)-dir*i*7,y:y0+Math.random()*10,vx:dir*(24+Math.random()*10),ph:Math.random()*6})}

/* ===== iluminação ===== */
function buildLight(){
 const n=W*H;lm={base:new Float32Array(n),cur:new Float32Array(n),warm:new Float32Array(n),cool:new Float32Array(n)};
 lm.dc=mk(W,H);lm.dx=g2(lm.dc);lm.di=lm.dx.createImageData(W,H);lm.gc=mk(W,H);lm.gx=g2(lm.gc);lm.gi=lm.gx.createImageData(W,H);
 const {winX0,winX1,winY0,winY1}=LY;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const dx=(x-W*.55)/(W*.62),dy=(y-H*.5)/(H*.62);let d=.64+dx*dx*.12+dy*dy*.14;
  // janela (vista externa): pouca escuridão
  const ex=Math.min(x-winX0,winX1-x),ey=Math.min(y-winY0,winY1-y);
  if(ex>=0&&ey>=0){d=.05+Math.max(0,(6-Math.min(ex,ey)))*.02}
  lm.base[y*W+x]=d}}
function addLight(L){const r=L.r,x0=Math.max(0,Math.floor(L.x-r)),x1=Math.min(W-1,Math.ceil(L.x+r)),y0=Math.max(0,Math.floor(L.y-r)),y1=Math.min(H-1,Math.ceil(L.y+r)),r2=r*r,cur=lm.cur,wm=lm.warm,cl=lm.cool;
 for(let y=y0;y<=y1;y++){const dy=y-L.y,row=y*W;for(let x=x0;x<=x1;x++){const dx=x-L.x,d2=dx*dx+dy*dy;if(d2>=r2)continue;const t=1-Math.sqrt(d2)/r,f=t*t*L.i;cur[row+x]-=f;if(L.warm)wm[row+x]+=f*L.warm;if(L.cool)cl[row+x]+=f*L.cool}}}
function applyLight(){
 const {cur,warm,cool}=lm,di=lm.di.data,gi=lm.gi.data,n=W*H;
 for(let i=0;i<n;i++){const x=i%W,y=(i/W)|0,b=bay(x,y);let d=cur[i];d=d<.04?.04:d>.94?.94:d;
  const q=Math.floor(d*7+b)/7,a=q*.9*255;const o=i*4;di[o]=6;di[o+1]=8;di[o+2]=18;di[o+3]=a;
  const g=warm[i],c2=cool[i];let ga=0,r=0,gg=0,bb=0;
  if(g>.025){const gq=Math.floor(g*5+b)/5;ga=gq*.46*255;r=255;gg=158;bb=62}
  if(c2>.04&&ga<8){const cq=Math.floor(c2*4+b)/4;ga=cq*.3*255;r=110;gg=150;bb=255}
  gi[o]=r;gi[o+1]=gg;gi[o+2]=bb;gi[o+3]=ga}
 lm.dx.putImageData(lm.di,0,0);lm.gx.putImageData(lm.gi,0,0)}

/* ===== quadro ===== */
function frame(t,dt){
 // parallax suavizado
 mx+=(tx-mx)*Math.min(1,dt*3);my+=(ty-my)*Math.min(1,dt*3);
 flash=Math.max(0,flash-dt*2.6);shake=Math.max(0,shake-dt*6);
 lanVel+=-lanSway*2.4*dt;lanVel*=Math.pow(.55,dt);lanSway+=lanVel*dt*4;lanSway=clamp(lanSway,-.6,.6);
 // agendamento
 nextFlash-=dt;if(nextFlash<=0){addFlash();nextFlash=1.4+Math.random()*3.5}
 nextFlare-=dt;if(nextFlare<=0){addFlare();nextFlare=5+Math.random()*6}
 nextTracer-=dt;if(nextTracer<=0){addTracers();nextTracer=3+Math.random()*5}
 nextBird-=dt;if(nextBird<=0){addBirds();nextBird=20+Math.random()*24}
 nextPlane-=dt;if(nextPlane<=0){ev.plane={x:LY.winX1+20,y:LY.winY0+18+Math.random()*18,vx:-32};nextPlane=34+Math.random()*30}
 if(nextBoom>0){nextBoom-=dt;if(nextBoom<=0){nextBoom=-1;thump(.5);if(soundCb)soundCb('boom')}}
 nextRat-=dt;if(nextRat<=0&&!ev.rat&&!FULL){ev.rat={x:-10,y:LY.floor+Math.round((H-LY.floor)*.55),vx:70,ph:0};nextRat=18+Math.random()*20}
 nextDrip-=dt;if(nextDrip<=0){ev.drips.push({x:LY.winX0-40,y:18,vy:0,a:1,t:3});nextDrip=2.4+Math.random()*3}

 const sh=shake>.05?Math.round((Math.random()-.5)*shake*1.6):0,shy=shake>.05?Math.round((Math.random()-.5)*shake*1.2):0;
 const c=cx;c.setTransform(1,0,0,1,sh,shy);c.fillStyle='#05070b';c.fillRect(-4,-4,W+8,H+8);
 const {winX0,winY0,winW,winH,hy}=LY;
 const off=(f)=>[Math.round(-mx*f)-PAD,Math.round(-my*f*.6)-PAD];
 // ---- vista externa ----
 c.save();c.beginPath();c.rect(winX0,winY0,winW,winH);c.clip();
 let [ox,oy]=off(1.2);c.drawImage(lay.sky,winX0+ox,winY0+oy);
 // clarão do horizonte
 if(flash>0){const gx=winX0+flashX*winW,r=70+flash*60;for(let y=hyAbs()-50;y<hyAbs()+8;y++)for(let x=Math.round(gx-r);x<gx+r;x++){const d=Math.hypot((x-gx)/r,(y-hyAbs())/ (r*.5));if(d<1&&bay(x,y)<(1-d)*flash*.85)R(c,x,y,1,1,d<.35?'#fff2c0':d<.65?'#f2a848':'#b5523f')}}
 // nuvens à deriva
 for(const[i,cl,sp,yo,al]of[[0,lay.cloudA,1.6,4,1],[1,lay.cloudB,3.2,22,1]]){const w=cl.width,o2=off(1.6+i*.3);let px=Math.round(-((t*sp)%w));c.globalAlpha=al;c.drawImage(cl,winX0+o2[0]+px,winY0+o2[1]+yo);c.drawImage(cl,winX0+o2[0]+px+w,winY0+o2[1]+yo);c.globalAlpha=1}
 // holofote
 {const ax=winX0+winW*.1,ay=hyAbs()+4,th=Math.sin(t*.28)*.55+.25;for(let y=ay;y>winY0-2;y-=1){const dd=ay-y,cxp=ax+Math.tan(th)*dd,hw=1+dd*.13;for(let x=Math.floor(cxp-hw);x<=cxp+hw;x++){const u=1-Math.abs(x-cxp)/hw;if(bay(x,y)<u*.22)R(c,x,y,1,1,'#b8d0e0')}}}
 // avião
 if(ev.plane){const p=ev.plane;p.x+=p.vx*dt;const px=Math.round(p.x),py=Math.round(p.y);R(c,px,py,14,2,'#0a0714');R(c,px-3,py-1,3,4,'#0a0714');R(c,px+4,py-3,1,8,'#0a0714');R(c,px+3,py-3,3,1,'#0a0714');R(c,px+3,py+5,3,1,'#0a0714');R(c,px+14,py-1,1,4,'#2a2030');R(c,px-3,py-2,1,1,'#0a0714');if(px<winX0-30)ev.plane=null}
 // pássaros
 for(const b of ev.birds){b.x+=b.vx*dt;b.ph+=dt*9;const f=Math.sin(b.ph)>0;R(c,b.x,b.y+(f?0:1),1,1,'#0a0714');R(c,b.x-1,b.y+(f?1:0),1,1,'#0a0714');R(c,b.x+1,b.y+(f?1:0),1,1,'#0a0714')}
 ev.birds=ev.birds.filter(b=>b.x>winX0-20&&b.x<LY.winX1+20);
 [ox,oy]=off(2.4);c.drawImage(lay.far,winX0+ox,winY0+oy);
 // fogo nas casas e fumaça
 for(const hx of[.44,.49,.535,.58]){const fx=winX0+ox+PAD*0+Math.round((LY.winW+24)*hx)+3,fy=winY0+oy+hyAbs()-winY0-0;
  for(let i=0;i<3;i++){const fl=Math.sin(t*9+hx*40+i*2);R(c,fx+i*2-2,hyAbs()+oy+PAD-14-((fl>0)?1:0)-i,2,3+(fl>.4?1:0),i===1?'#ffd27a':'#dc7a3a')}}
 if(Math.random()<dt*9){for(const hx of[.47,.56,.6])ev.smoke.push({x:winX0+ox+Math.round((LY.winW+24)*hx),y:hyAbs()+oy+PAD-14,vx:-4-Math.random()*6,vy:-(6+Math.random()*6),t:5,max:5,s:2+(Math.random()*2|0)})}
 for(const s of ev.smoke){s.x+=s.vx*dt;s.y+=s.vy*dt;s.t-=dt;const a=s.t/s.max,sz=Math.round(s.s+(1-a)*7);c.globalAlpha=clamp(a*.75,0,.75);R(c,s.x-sz/2,s.y-sz/2,sz,sz,a>.6?'#3a2230':'#221826');c.globalAlpha=1}
 ev.smoke=ev.smoke.filter(s=>s.t>0);
 // plumas de terra das explosões
 for(const p of ev.plumes){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=90*dt;p.t-=dt;const a=clamp(p.t/p.max*1.4,0,1);R(c,p.x,p.y,p.s,p.s,a>.6?'#4a2a22':'#22151a')}
 ev.plumes=ev.plumes.filter(p=>p.t>0&&p.y<hyAbs()+10);
 for(const p of ev.puffs){p.t-=dt;const a=p.t/p.max;p.y-=6*dt;p.r+=dt*6;c.globalAlpha=clamp(a,0,.7);ell(c,p.x,p.y,Math.round(p.r*1.3),Math.round(p.r),'#2a1a26');c.globalAlpha=1}
 ev.puffs=ev.puffs.filter(p=>p.t>0);
 [ox,oy]=off(4);c.drawImage(lay.mid,winX0+ox,winY0+oy);
 warMid(c,t,dt);
 // traçantes
 for(const tr of ev.tracers){tr.x+=tr.vx*dt;tr.y+=tr.vy*dt;const dx=Math.sign(tr.vx);for(let i=0;i<5;i++)R(c,tr.x-dx*i,tr.y,1,1,i<2?tr.col:'#7a3a28');}
 ev.tracers=ev.tracers.filter(tr=>tr.x>winX0-40&&tr.x<LY.winX1+40);
 // sinalizadores
 for(const f of ev.flares){f.t+=dt;if(f.phase===0){f.y+=f.vy*dt;f.trail.push([f.x,f.y]);if(f.trail.length>14)f.trail.shift();if(f.y<=f.ap){f.phase=1;f.vy=7}}else{f.y+=f.vy*dt;f.x+=Math.sin(f.t*1.3+f.ph)*5*dt}
  if(f.phase===0){f.trail.forEach(([x,y],i)=>{c.globalAlpha=i/f.trail.length*.8;R(c,x,y,1,1,'#e8e0d0')});c.globalAlpha=1;R(c,f.x,f.y,1,2,'#fff')}
  else{const fl=.75+.25*Math.sin(f.t*31)*Math.sin(f.t*17),fade=f.t>f.life-2?(f.life-f.t)/2:1;f.fl=fl*fade;const fx=Math.round(f.x),fy=Math.round(f.y);
   c.globalAlpha=clamp(fade,0,1);for(let i=1;i<=22;i++){const ty=fy+i*1.2;if(bay(fx,ty)<1-i/22)R(c,fx+Math.round(Math.sin(i*.4+f.t)*.6),ty,1,1,'#90a0b0')}
   R(c,fx-2,fy-2,5,5,'#ffeeb8');R(c,fx-1,fy-1,3,3,'#ffffff');R(c,fx-4,fy,9,1,'#ffe6a0');R(c,fx,fy-4,1,9,'#ffe6a0');if(fl>.85){R(c,fx-6,fy,13,1,'#fff0c8');R(c,fx,fy-6,1,13,'#fff0c8')}c.globalAlpha=1}}
 ev.flares=ev.flares.filter(f=>f.t<f.life);
 [ox,oy]=off(6.5);c.drawImage(lay.near,winX0+ox,winY0+oy+2);
 warFront(c,t,dt);
 c.restore();

 // ---- parede ----
 c.drawImage(lay.wall,0,0);
 // ---- soldado ----
 const rimc=flash>.3?'#ffd27a':'#e0843c';
 const sold=FULL?{}:drawSoldier(c,t,rimc);
 c.drawImage(lay.fore,0,0);
 // lanterna principal e lâmpada de parede
 const lanX=LY.winX0+22,lanY=58;
 if(!FULL)drawLantern(c,lanX+lanSway*18,lanY,t,lanSway,true);
 // chama da vela, brasa do fogão, chaleira, fumaça do cigarro
 const vx=LY.winX0+Math.round(LY.winW*.56)+2,vy=LY.ledge-13,fl=Math.sin(t*14)+Math.sin(t*23);
 if(!FULL){R(c,vx,vy-2+(fl>.6?-1:0),1,2,'#ffffff');R(c,vx,vy-1,1,1,'#ffd27a');R(c,vx-1,vy,3,1,'#f2a848')}
 // vapor da chaleira
 if(!FULL&&Math.random()<dt*8)ev.steam.push({x:W-58+19,y:LY.floor+2-40,vx:(Math.random()-.5)*4,vy:-(8+Math.random()*6),t:2.2,max:2.2});
 for(const s of ev.steam){s.x+=s.vx*dt;s.y+=s.vy*dt;s.t-=dt;c.globalAlpha=clamp(s.t/s.max,0,1)*.6;R(c,s.x,s.y,2,2,'#c8ced4');c.globalAlpha=1}ev.steam=ev.steam.filter(s=>s.t>0);
 if(sold.ember){const e=sold.ember;R(c,e.x+3,e.y,1,1,'#ff6a2a');if(Math.sin(t*4)>.2)R(c,e.x+3,e.y,1,1,'#ffd27a');if(sold.smoking&&Math.random()<dt*10)ev.smoke.push({x:e.x+3,y:e.y-2,vx:-3+Math.random()*2,vy:-(5+Math.random()*3),t:3.4,max:3.4,s:2,inside:1})}
 // fumaça do cigarro (interior)
 for(const s of ev.smoke)if(s.inside){}
 // gotas e poeira do teto
 for(const d of ev.drips){if(d.dust){d.vy+=14*dt;d.y+=d.vy*dt;d.t-=dt;c.globalAlpha=clamp(d.t,0,1)*.7;R(c,d.x,d.y,1,1,'#b8a880');c.globalAlpha=1}
  else{d.vy+=110*dt;d.y+=d.vy*dt;R(c,d.x,d.y,1,2,'#6a8aa8');if(d.y>=LY.floor+6){d.t=0;ev.puffs.push({x:d.x,y:LY.floor+8,t:.6,max:.6,r:1,ripple:1})}}}
 ev.drips=ev.drips.filter(d=>d.t>0&&d.y<H);
 // rato
 if(ev.rat){const r=ev.rat;r.x+=r.vx*dt;r.ph+=dt*22;const f=Math.sin(r.ph)>0,rx=Math.round(r.x),ry=r.y;R(c,rx,ry,7,3,'#1a1410');R(c,rx+6,ry+1,3,2,'#241c16');R(c,rx+8,ry,1,1,'#ff5a4a');R(c,rx-4,ry+2,4,1,'#3a2a20');R(c,rx+1,ry+3,1,f?2:1,'#0d0a08');R(c,rx+5,ry+3,1,f?1:2,'#0d0a08');R(c,rx+5,ry-1,2,1,'#3a2a20');if(r.x>W+10)ev.rat=null}

 // ---- iluminação ----
 lm.cur.set(lm.base);lm.warm.fill(0);lm.cool.fill(0);
 const f1=.93+.07*Math.sin(t*13)*Math.sin(t*5.3),f2=.9+.1*Math.sin(t*17+1)*Math.sin(t*7),fs=.85+.15*Math.sin(t*3.1+2);
 if(!FULL){addLight({x:lanX+lanSway*18,y:lanY+7,r:150,i:.98*f1,warm:1});
 addLight({x:LY.winX0+Math.round(LY.winW*.05)+8+66,y:LY.floor-62,r:92,i:.85*f2,warm:1});
 addLight({x:W-58+12,y:LY.floor-14,r:66,i:.6*fs,warm:1});
 addLight({x:vx,y:vy,r:38,i:.55*f2,warm:1});
 addLight({x:14,y:118,r:70,i:.5*f1,warm:1})}
 if(sold.ember)addLight({x:sold.ember.x+3,y:sold.ember.y,r:10,i:.4,warm:1});
 // janela (fria) e fogo do horizonte (quente)
 addLight({x:LY.winX0+LY.winW*.5,y:LY.winY1-6,r:190,i:.46,cool:1});
 addLight({x:LY.winX0+LY.winW*.3,y:hyAbs()-6,r:150,i:.42*(.85+.15*Math.sin(t*6.1)*Math.sin(t*2.3)),warm:.8});
 if(flash>0)addLight({x:LY.winX0+flashX*LY.winW,y:hyAbs(),r:240,i:.75*flash,warm:1.2});
 for(const f of ev.flares)if(f.phase===1)addLight({x:f.x,y:f.y,r:170,i:.6*(f.fl||0),cool:1,warm:.3});
 warLights(t);
 applyLight();
 c.drawImage(lm.dc,0,0);c.globalCompositeOperation='lighter';c.drawImage(lm.gc,0,0);c.globalCompositeOperation='source-over';
 // poeira em suspensão nos feixes de luz
 for(const m of ev.motes){m.x+=m.vx*dt+Math.sin(t*.7+m.ph)*3*dt;m.y+=m.vy*dt;if(m.y<LY.winY0-10||m.y>LY.floor||m.x<0||m.x>W){m.x=LY.winX0+Math.random()*LY.winW;m.y=LY.winY0+Math.random()*LY.winH}
  const ix=m.x|0,iy=m.y|0;if(ix<0||iy<0||ix>=W||iy>=H)continue;const li=lm.warm[iy*W+ix]+lm.cool[iy*W+ix];
  if(li>.05){c.globalAlpha=clamp(li*1.3,0,.85);R(c,ix,iy,1,1,lm.cool[iy*W+ix]>lm.warm[iy*W+ix]?'#cfe0ff':'#ffe2a0');c.globalAlpha=1}}
 // bloom do lampião
 if(!FULL){c.globalAlpha=.22;ell(c,lanX+lanSway*18,lanY+7,14,14,'#ffb347');c.globalAlpha=.2;ell(c,lanX+lanSway*18,lanY+7,8,8,'#ffe2a0');c.globalAlpha=1}
 c.setTransform(1,0,0,1,0,0)}

/* ===== guerra viva: o bunker vira uma seteira panorâmica sobre a terra de ninguém =====
   soldados em carga (e caindo), tanques, explosões com coluna de terra, esquadrilhas, fogueiras, holofotes, névoa e brasas.
   Tudo por profundidade d (0 = horizonte, 1 = pé da janela): y = gY(d), escala inteira 1 ou 2. */
const Wr={sol:[],tanks:[],exp:[],deb:[],sm:[],emb:[],forms:[],fires:[],fog:[],beams:[],nextSol:0,nextExp:.4,nextTank:3,nextForm:7,ready:0};
const gY=d=>hyAbs()+8+(LY.winY1-hyAbs()-34)*d,scl=d=>d<.3?1:2,SIL='#0b070e',RIM='#6a3828';
const rr=(a,b)=>a+Math.random()*(b-a);
function spawnSol(init){const dir=Math.random()<.5?1:-1,d=rr(.06,.9);Wr.sol.push({x:init?LY.winX0+Math.random()*LY.winW:(dir>0?LY.winX0-8:LY.winX1+8),d,dir,u:scl(d),v:rr(15,27)*(.55+d*.6),ph:Math.random()*6,st:0,t:0})}
function warInit(){Wr.ready=1;Wr.sol=[];Wr.tanks=[];Wr.exp=[];Wr.deb=[];Wr.sm=[];Wr.emb=[];Wr.forms=[];
 Wr.fires=[];for(let i=0;i<5;i++)Wr.fires.push({f:.06+.88*(i+Math.random()*.7)/5,d:rr(.05,.6),seed:Math.random()*9});
 Wr.fog=[];for(let i=0;i<7;i++)Wr.fog.push({x:Math.random()*LY.winW,d:rr(.05,.8),rx:rr(60,120),ry:rr(5,9),vx:rr(2,6)});
 Wr.beams=[{f:.16,sp:.23,ph:0},{f:.86,sp:.19,ph:2.4},{f:.5,sp:.15,ph:4}];
 for(let i=0;i<22;i++)spawnSol(true)}
function addExp(x,d,big){const s=scl(d),y=gY(d);Wr.exp.push({x,y,s,d,t:0,big:big?1:0,dur:big?2.8:1.9,seed:Math.random()*9,hmax:Math.min(90,(big?60:34)*s)});
 for(let i=0;i<(big?18:10);i++)Wr.deb.push({x,y:y-2,vx:rr(-60,60)*(big?1.4:1),vy:-rr(40,big?150:100),t:rr(.5,1.3)});
 for(const o of Wr.sol)if(o.st===0&&Math.abs(o.x-x)<(big?40:26)*s&&Math.abs(o.d-d)<(big?.2:.12)){o.st=1;o.t=0}
 if(big){flash=Math.max(flash,.45);flashX=clamp((x-LY.winX0)/LY.winW,.05,.95);if(Math.random()<.4){thump(.4);if(soundCb)soundCb('boom')}}}
function ringE(c,x,y,rx,ry,col){c.fillStyle=col;for(let a=0;a<48;a++){const an=a/48*6.2832;c.fillRect(Math.round(x+Math.cos(an)*rx),Math.round(y+Math.sin(an)*ry),1,1)}}
function drawSol(c,o,alpha){const u=o.u,x=Math.round(o.x),y=Math.round(gY(o.d)),dir=o.dir;c.globalAlpha=alpha;
 const px=(a,b,w,h,cc)=>R(c,x+(dir>0?a:-a-w)*u,y+b*u,w*u,h*u,cc);
 if(o.st===0){const l=Math.round(Math.sin(o.ph)*1.6);
  px(-2,-9,1,4,SIL);px(-1,-8,3,5,SIL);px(0,-11,3,2,SIL);px(-1,-12,4,1,'#2a1c22');px(1,-8,1,1,RIM);
  px(-1+l,-3,1,3,SIL);px(1-l,-3,1,3,SIL);px(2,-6,1,1,SIL);px(3,-7,2,1,SIL);px(5,-8,2,1,SIL);px(7,-10,1,2,'#8a8a94');px(0,-12,2,1,RIM)}
 else{const k=Math.min(1,o.t/.25);if(k<1){px(-1,-7+Math.round(k*4),3,5-Math.round(k*3),SIL);px(0,-10+Math.round(k*7),3,2,SIL);px(-1,-3,1,3,SIL);px(1,-3,2,3,SIL)}
  else{px(-4,-2,8,2,SIL);px(4,-3,3,2,SIL);px(-5,-1,2,1,SIL);px(-3,-3,5,1,RIM);px(-6,-4,1,1,'#8a8a94');px(-7,-3,5,1,'#17101a')}}
 c.globalAlpha=1}
function drawTank(c,o,t){const u=o.u,x=Math.round(o.x),y=Math.round(gY(o.d)),dir=o.dir,px=(a,b,w,h,cc)=>R(c,x+(dir>0?a:-a-w)*u,y+b*u,w*u,h*u,cc);
 for(let j=0;j<9;j++){const hw=7+j;px(-hw,-10+j,hw*2,1,SIL)}
 px(-16,-2,32,2,SIL);for(let k=0;k<16;k++)if((k+Math.floor(o.tr))&1)px(-16+k*2,-1,1,1,'#2e1c1c');
 px(-5,-14,10,4,SIL);px(-5,-14,10,1,RIM);px(-7,-10,14,1,RIM);px(5,-13,16,2,SIL);px(5,-13,16,1,'#3a2a30');px(-14,-6,3,1,SIL);
 if(((t*9)|0)%3)px(-16,-8,2,1,'#f08a2a');
 if(o.fl>0)for(let i=0;i<3;i++)px(21+i*2,-13-(i===1?1:0),2-(i>>1),2+(i&1),i?'#ffb347':'#fff2c0')}
function drawFire(c,x,y,u,t,seed){for(let i=-3;i<=3;i++){const h=Math.round((6-Math.abs(i)*1.3+Math.sin(t*11+i*1.7+seed)*2)*u);if(h<=0)continue;
  R(c,x+i*u,y-h,u,h,'#b5421f');R(c,x+i*u,y-Math.round(h*.7),u,Math.round(h*.7),'#f08a2a');R(c,x+i*u,y-Math.round(h*.35),u,Math.round(h*.35),'#ffd27a')}
 R(c,x-4*u,y,8*u,Math.max(1,u),'#1a0c0c')}
function drawPlane(c,p,t){const s=p.s,x=Math.round(p.x),y=Math.round(p.y),dir=p.dir,px=(a,b,w,h,cc)=>R(c,x+(dir>0?a:-a-w)*s,y+b*s,w*s,h*s,cc);
 const col='#0a0714';px(-8,-1,16,2,col);px(8,-1,1,2,col);px(-10,-3,3,3,col);px(-3,-5,9,1,'#4a2836');px(-3,2,9,1,col);px(-1,-4,1,6,col);px(4,-4,1,6,col);px(9,-2+(((t*30)|0)&1),1,3,'#6a5a6a')}
function warMid(c,t,dt){if(!Wr.ready)warInit();
 const cxm=LY.winX0+LY.winW*.5;
 Wr.nextSol-=dt;if(Wr.nextSol<=0){Wr.nextSol=.3;if(Wr.sol.length<34)spawnSol(false)}
 Wr.nextExp-=dt;if(Wr.nextExp<=0){const big=Math.random()<.3,f=Math.random()<.7?(Math.random()<.5?rr(.03,.3):rr(.7,.97)):rr(.3,.7);addExp(LY.winX0+f*LY.winW,rr(.04,.85),big);Wr.nextExp=rr(.35,1.1)}
 Wr.nextTank-=dt;if(Wr.nextTank<=0){Wr.nextTank=rr(14,22);if(Wr.tanks.length<2){const dir=Math.random()<.5?1:-1,d=rr(.18,.55);Wr.tanks.push({x:dir>0?LY.winX0-40:LY.winX1+40,d,dir,u:scl(d),tr:0,fire:rr(2,4),fl:0})}}
 Wr.nextForm-=dt;if(Wr.nextForm<=0){Wr.nextForm=rr(20,34);const dir=Math.random()<.5?1:-1,y0=LY.winY0+10+Math.random()*Math.max(8,LY.hy*.45),burn=Math.random()<.5?1:-1;
  for(let i=0;i<3;i++)Wr.forms.push({x:(dir>0?LY.winX0-14:LY.winX1+14)-dir*i*24,y:y0+(i%2?7:-3)+i*2,dir,s:1,vx:dir*rr(20,24),vy:0,burn:i===burn?0:-1,fall:0})}
 for(const o of Wr.sol){o.t+=dt;if(o.st===0){o.x+=o.dir*o.v*dt;o.ph+=dt*(8+o.v*.1);const dist=Math.abs(o.x-cxm)/LY.winW;if(dist<.3&&Math.random()<dt*.45||Math.random()<dt*.012){o.st=1;o.t=0}}}
 Wr.sol=Wr.sol.filter(o=>o.st?o.t<16:(o.x>LY.winX0-14&&o.x<LY.winX1+14));
 for(const k of Wr.tanks){k.x+=k.dir*7*dt;k.tr+=dt*10;k.fl=Math.max(0,k.fl-dt);k.fire-=dt;if(k.fire<=0){k.fire=rr(3,6);k.fl=.14;const tx=clamp(k.x+k.dir*rr(90,220),LY.winX0+10,LY.winX1-10);setTimeout(()=>{if(Wr.ready)addExp(tx,clamp(k.d+rr(-.1,.1),.03,.9),Math.random()<.4)},380)}}
 Wr.tanks=Wr.tanks.filter(k=>k.x>LY.winX0-60&&k.x<LY.winX1+60);
 for(const e of Wr.exp){e.t+=dt;const p=e.t/e.dur;if(p>.22&&p<.8&&Math.random()<dt*16)Wr.sm.push({x:e.x+rr(-3,3)*e.s,y:e.y-e.hmax*clamp((p-.1)*1.8,0,1)*rr(.5,1),vx:rr(-5,8),vy:-rr(6,14),t:rr(3.2,5.5),max:5.5,s:rr(3,6)*e.s*.8})}
 Wr.exp=Wr.exp.filter(e=>e.t<e.dur);
 for(const f of Wr.forms){f.x+=f.vx*dt;if(f.burn>=0){f.burn+=dt;if(f.burn>3){f.fall+=dt;f.vy+=18*dt;f.y+=f.vy*dt}if(Math.random()<dt*20)Wr.sm.push({x:f.x-f.dir*8,y:f.y,vx:-f.dir*rr(0,6),vy:-rr(0,5),t:3,max:3,s:rr(2,4)})}
  if(f.fall>0&&f.y>hyAbs()-1){f.dead=1;addExp(f.x,0,true)}}
 Wr.forms=Wr.forms.filter(f=>!f.dead&&f.x>LY.winX0-60&&f.x<LY.winX1+60);
 for(const b of Wr.deb){b.x+=b.vx*dt;b.y+=b.vy*dt;b.vy+=170*dt;b.t-=dt}Wr.deb=Wr.deb.filter(b=>b.t>0);
 for(const f of Wr.fires){if(Math.random()<dt*10)Wr.sm.push({x:LY.winX0+f.f*LY.winW+rr(-3,3),y:gY(f.d)-10,vx:rr(2,9),vy:-rr(8,16),t:4.5,max:4.5,s:rr(3,6)});if(Math.random()<dt*14&&Wr.emb.length<90)Wr.emb.push({x:LY.winX0+f.f*LY.winW+rr(-4,4),y:gY(f.d)-6,vx:rr(6,26),vy:-rr(10,30),t:rr(2,5),ph:Math.random()*6})}
 for(const f of Wr.forms)drawPlane(c,f,t);
 const items=[];for(const o of Wr.sol)items.push([o.d,0,o]);for(const k of Wr.tanks)items.push([k.d,1,k]);for(const f of Wr.fires)items.push([f.d,2,f]);
 items.sort((a,b)=>a[0]-b[0]);
 for(const[,ty,o]of items){if(ty===0)drawSol(c,o,o.st&&o.t>13?clamp((16-o.t)/3,0,1):1);else if(ty===1)drawTank(c,o,t);else drawFire(c,Math.round(LY.winX0+o.f*LY.winW),Math.round(gY(o.d)),scl(o.d),t,o.seed)}
 for(const e of Wr.exp){const p=e.t/e.dur,s=e.s,x=Math.round(e.x),y=Math.round(e.y);
  if(p<.3){const k=p/.3;c.globalAlpha=(1-k)*.55;ringE(c,x,y,(8+k*36)*s,(2+k*8)*s,'#d8b890');c.globalAlpha=1}
  if(p>.03&&p<.72){const k=clamp((p-.03)/.3,0,1),fade=p<.5?1:1-(p-.5)/.22,hg=Math.round(e.hmax*k*fade);
   for(let j=0;j<hg;j++){const w=Math.max(2,Math.round((2.2+j/Math.max(1,hg)*5.5+p*3)*s*.9)),jt=Math.round(Math.sin(j*.7+e.seed)*s),l=x-(w>>1)+jt;
    if(bay(j,x)>.82*(1-fade*.3)&&j>hg*.5)continue;R(c,l,y-j,w,1,j<hg*.18?'#5a3220':'#25161a');R(c,l,y-j,1,1,'#7a4026')}}
  if(p<.5){const k=p/.5,r=Math.round((6+k*10)*s*(e.big?1.35:1)),cy=Math.round(y-k*10*s);c.globalAlpha=1-k*.75;
   if(p<.12){ell(c,x,y-4*s,Math.round((6+p*70)*s*.7),Math.round((4+p*40)*s*.7),'#fff2c0')}
   ell(c,x,cy,Math.round(r*1.2),Math.round(r*.8),'#a33a1c');ell(c,x,cy,r,Math.round(r*.66),'#e0701f');ell(c,x,cy-1,Math.round(r*.6),Math.round(r*.4),'#ffb347');ell(c,x,cy-1,Math.round(r*.3),Math.round(r*.2),'#ffeeb0');c.globalAlpha=1}}
 for(const b of Wr.deb){R(c,b.x,b.y,1,1,b.t>.5?'#ffb347':'#3a2418')}}
function warFront(c,t,dt){
 for(const s of Wr.sm){s.x+=s.vx*dt;s.y+=s.vy*dt;s.t-=dt;s.vx*=.995;const a=s.t/s.max,sz=Math.round(s.s+(1-a)*8);c.globalAlpha=clamp(a*.7,0,.7);R(c,s.x-sz/2,s.y-sz/2,sz,sz,a>.75?'#6a3a2c':a>.45?'#2e1e24':'#1c141c');c.globalAlpha=1}
 Wr.sm=Wr.sm.filter(s=>s.t>0&&s.y>LY.winY0-10);
 for(const g of Wr.fog){g.x+=g.vx*dt;if(g.x>LY.winW+g.rx)g.x=-g.rx;c.globalAlpha=.1;ell(c,Math.round(LY.winX0+g.x),Math.round(gY(g.d)),Math.round(g.rx),Math.round(g.ry),'#5a3a44');c.globalAlpha=1}
 for(const b of Wr.beams){const ax=LY.winX0+LY.winW*b.f,ay=gY(.08),th=Math.sin(t*b.sp+b.ph)*.8;for(let y=Math.round(ay);y>LY.winY0;y--){const dd=ay-y,cxp=ax+Math.tan(th)*dd,hw=1+dd*.09;for(let x=Math.floor(cxp-hw);x<=cxp+hw;x++){const u=1-Math.abs(x-cxp)/hw;if(bay(x,y)<u*.17)R(c,x,y,1,1,'#b8c8e8')}}}
 for(const e of Wr.emb){e.x+=(e.vx+Math.sin(t*2+e.ph)*6)*dt;e.y+=e.vy*dt;e.t-=dt;if(Math.sin(t*20+e.ph*7)>-.4)R(c,Math.round(e.x),Math.round(e.y),1,1,e.t>1.2?'#ffb347':'#c8501f')}
 Wr.emb=Wr.emb.filter(e=>e.t>0&&e.x<LY.winX1)}
function warLights(t){
 for(const e of Wr.exp){const p=e.t/e.dur;if(p<.6)addLight({x:e.x,y:e.y-8*e.s,r:Math.min(150,(40+e.big*40)*e.s+20),i:.85*(1-p/.6),warm:1.3})}
 for(const f of Wr.fires)addLight({x:LY.winX0+f.f*LY.winW,y:gY(f.d)-6,r:46*scl(f.d)+10,i:.55*(.85+.15*Math.sin(t*9+f.seed)),warm:1});
 for(const k of Wr.tanks)if(k.fl>0)addLight({x:k.x+k.dir*20*k.u,y:gY(k.d)-12*k.u,r:60,i:.6,warm:1.2})}

/* ===== controle ===== */
function sizeCanvas(){
 const dpr=window.devicePixelRatio||1,pw=cv.parentElement.clientWidth||innerWidth,ph=cv.parentElement.clientHeight||innerHeight,Wd=pw*dpr,Hd=ph*dpr;
 let k=Math.max(1,Math.round(Wd/480));if(Math.floor(Hd/k)<210)k=Math.max(1,Math.floor(Hd/210));
 const w=Math.ceil(Wd/k),h=Math.ceil(Hd/k);
 if(w===W&&h===H&&k===K&&lay.wall)return false;
 K=k;W=w;H=h;cv.width=W;cv.height=H;cv.style.width=(W*K/dpr)+'px';cv.style.height=(H*K/dpr)+'px';cx=g2(cv);
 layout();Wr.ready=0;const ww=LY.winW+PAD*2,wh=LY.winH+PAD*2;
 lay.sky=buildSky(ww,wh);lay.cloudA=cloudBand(LY.winW*2,48,3,0);lay.cloudB=cloudBand(LY.winW*2,44,9,1);lay.far=buildFar(ww,wh);lay.mid=buildMid(ww,wh);lay.near=buildNear(ww,wh);
 lay.wall=buildWall();lay.fore=buildFore();buildLight();
 ev.motes=[];const N=Math.min(90,Math.round(W*H/2000));for(let i=0;i<N;i++)ev.motes.push({x:Math.random()*W,y:Math.random()*H*.8,vx:(Math.random()-.5)*4,vy:-1-Math.random()*3,ph:Math.random()*6});
 document.documentElement.style.setProperty('--k',(K/dpr)+'px');document.documentElement.style.setProperty('--kint',String(K));
 return true}
function loop(ts){if(!running)return;raf=requestAnimationFrame(loop);const dt=Math.min(.05,(ts-lastT)/1000||.016);lastT=ts;acc+=dt;const step=W*H>260000?1/24:1/30;
 if(acc<step)return;const d=acc;acc=0;tm+=d;try{frame(tm,d)}catch(e){console.error('title frame',e);stop()}}
function start(canvas){cv=canvas||cv;if(!cv)return;running=true;sizeCanvas();lastT=performance.now();acc=0;cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
 if(!start.bound){start.bound=true;addEventListener('resize',()=>{if(running){sizeCanvas()}});addEventListener('pointermove',e=>{tx=(e.clientX/innerWidth-.5)*2;ty=(e.clientY/innerHeight-.5)*2})}}
function stop(){running=false;cancelAnimationFrame(raf)}
window.IFTitle={start,stop,thump,get k(){return K},onSound(fn){soundCb=fn},get running(){return running},get logoScale(){return K}};
})();
