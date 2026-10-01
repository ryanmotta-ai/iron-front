'use strict';
(function(){
const {clamp,riverX,riverHW,ROADS}=PX,{BAYER,hash2,vnoise}=PX.noise,WW=PX.WW1,S=1917;
/* Iron Front 0.6 — relevo e materiais do mapa: campos, estradas, ferrovia, rio, trincheiras e posições de tiro.
   Tudo aqui escreve no mapa de altura / materiais (G); as cores saem da iluminação em ww1-terrain.js. */
const fr=v=>v-Math.floor(v),FORTS=()=>!WW.forts||WW.forts();   // CLEAN.forts:false → nenhuma trincheira cavada no chão
const mx=(x,w)=>Math.min(x,w-1-x);          // espelho: o lado Central usa a mesma forma

/* rasteriza uma polilinha como cápsula: cb(i,x,y,dist,lat,L,seg) para cada pixel até a distância R */
function stroke(G,pts,R,cb){const{w,h}=G;let L0=0;
 for(let k=1;k<pts.length;k++){const[ax,ay]=pts[k-1],[bx,by]=pts[k],len=Math.hypot(bx-ax,by-ay);if(!len)continue;const dx=(bx-ax)/len,dy=(by-ay)/len,nx=-dy,ny=dx;
  const x0=Math.max(0,Math.floor(Math.min(ax,bx)-R)),x1=Math.min(w-1,Math.ceil(Math.max(ax,bx)+R)),y0=Math.max(0,Math.floor(Math.min(ay,by)-R)),y1=Math.min(h-1,Math.ceil(Math.max(ay,by)+R));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const px=x+.5-ax,py=y+.5-ay,t=clamp(px*dx+py*dy,0,len),ex=px-dx*t,ey=py-dy*t,d=Math.hypot(ex,ey);if(d>R)continue;cb(y*w+x,x,y,d,ex*nx+ey*ny,L0+t,k,ex,ey)}
  L0+=len}}
const mirrorPts=(pts,w)=>pts.map(([x,y])=>[w-x,y]);
const both=(pts,w)=>[pts,mirrorPts(pts,w)];

/* ---------- campos de cultivo na retaguarda ---------- */
const FIELDS=[ // x,y,w,h,tipo,direção (lado Aliado)
 [0,0,56,54,'wheat','v'],[58,0,60,54,'plow','h'],[0,752,50,48,'crop','h'],[52,752,66,48,'wheat','v'],
 [112,0,22,60,'crop','v'],[112,748,22,52,'plow','v']];
function fields(G){const{w,mat,vr,Hm,MT}=G;
 for(const side of[0,1])for(const[fx,fy,fw,fh,kind,dir]of FIELDS){const x0=side?w-fx-fw:fx;
  for(let y=fy;y<fy+fh;y++)for(let x=x0;x<x0+fw;x++){const i=y*w+x,row=dir==='h'?y:x,st=row%3,j=hash2(row,Math.floor((dir==='h'?x:y)/19),S);
   if(kind==='plow'){mat[i]=MT.PLOW;vr[i]=st===1?.72:st===0?.3:.5;Hm[i]+=st===1?1:0}
   else if(kind==='crop'){if(st===1&&j>.06){mat[i]=MT.CROP;vr[i]=.35+.4*hash2(x,y,S)}else{mat[i]=MT.PLOW;vr[i]=.25}Hm[i]+=st===1?.8:0}
   else{if(st!==0&&j>.05){mat[i]=MT.WHEAT;vr[i]=.3+.5*hash2(x>>1,y>>1,S+1)}else{mat[i]=MT.PLOW;vr[i]=.42}Hm[i]+=st!==0?.6:0}}}}

/* ---------- estradas ---------- */
function roads(G){const{w,h,mat,vr,Hm,Dm,MT}=G,roadMat=(i,ad,hw,x,y)=>{
  mat[i]=MT.ROAD;const rut=Math.abs(ad-hw*.5)<.75,crown=ad<hw*.16;let v=.5+(vnoise(x/7,y/7,S+12)-.5)*.35+(hash2(x,y,S)-.5)*.1;if(rut)v=.14+hash2(x,y,S+3)*.1;else if(crown)v=.82;vr[i]=clamp(v,0,1);Hm[i]-=rut?1.15:.55};
 const edge=(i,x,y)=>{if(hash2(x,y,S+6)>.5){mat[i]=MT.ROAD;vr[i]=.08;Hm[i]-=.2}};
 /* estradas leste-oeste, dos dois lados, até a ponte central */
 for(let j=0;j<3;j++)for(let x=0;x<w;x++){const m=mx(x,w);if(m<WW.X.main)continue;const yc=WW.ROADY[j]+Math.sin(m/55+j*2)*3.2,hw=4.3+(vnoise(m/9,j*5,S)-.5)*1.6;
  for(let y=Math.floor(yc-hw-2);y<=Math.ceil(yc+hw+2);y++){if(y<0||y>=h)continue;const i=y*w+x,ad=Math.abs(y+.5-yc);
   const D=Dm[i],keep=!FORTS()||D<.55||vnoise(x/14,y/14,S+9)>(D-.5)*1.15;if(!keep)continue;   // sem fortificações a estrada corre inteira
   if(ad<hw)roadMat(i,ad,hw,x,y);else if(ad<hw+1.3)edge(i,x,y)}}
 /* estrada principal norte-sul, com leve ondulação, e desvios para a bateria */
 const mainPts=[];for(let y=-4;y<=h+4;y+=6)mainPts.push([WW.X.main+Math.sin(y/70)*3.5+Math.sin(y/23)*1,y]);
 for(const pts of both(mainPts,w))stroke(G,pts,6,(i,x,y,d,lat)=>{const hw=4.4;if(d<hw)roadMat(i,Math.abs(lat),hw,x,y);else if(d<hw+1.3)edge(i,x,y)});
 return mainPts}

/* ---------- ferrovia: lastro, dormentes e trilhos ---------- */
function rails(G,pts,gauge){const{mat,vr,Hm,MT}=G;
 stroke(G,pts,gauge+3.2,(i,x,y,d,lat,L)=>{const a=Math.abs(lat);
  if(a<gauge+2.5){mat[i]=MT.GRAVEL;vr[i]=.35+hash2(x,y,S+2)*.4;Hm[i]+=.4-a*.05;
   if(a<gauge+1.2&&fr(L/3.1)<.5){mat[i]=MT.SLEEP;vr[i]=.3+hash2(Math.floor(L/3.1),0,S)*.5}
   if(Math.abs(a-gauge)<.6){mat[i]=MT.RAIL;vr[i]=lat<0?.75:.45;Hm[i]+=.2}}
  else if(a<gauge+3.2&&hash2(x,y,S+8)>.55){mat[i]=MT.GRAVEL;vr[i]=.15}})}

/* ---------- rio, pontes e margens (mesma forma de terrain.js, para o clima e o vau continuarem valendo) ---------- */
function river(G,out){const{w,h,mat,vr,Hm,MT}=G;
 for(let y=0;y<h;y++){const rx=riverX(y),rhw=riverHW(y);for(let x=Math.floor(rx-rhw-12);x<=Math.ceil(rx+rhw+12);x++){if(x<0||x>=w)continue;const i=y*w+x,th=BAYER[(y&3)*4+(x&3)],dx=Math.abs(x-rx+(vnoise(x/6,y/6,S+3)-.5)*2.6);
   if(dx<rhw){const depth=1-dx/rhw,stream=vnoise(x/3,y/15,S+8)>.74?1:0;mat[i]=MT.WATER;vr[i]=clamp((1-depth)*1.2-stream*.3+(th-.5)*.15,0,1);Hm[i]=-2.4;
    if(dx>rhw-1.5&&hash2(x,y,S)>.45){mat[i]=MT.FOAM;vr[i]=hash2(x,y,S+1)}}
   else if(dx<rhw+4.2){const t=(dx-rhw)/4.2;mat[i]=MT.BANK;vr[i]=.3+hash2(x,y,S+4)*.3+t*.25;Hm[i]=-2.4*(1-t*t)+Hm[i]*t*t*.6}}}
 for(let i=0;i<260;i++){const y=(hash2(i,1,S)*h)|0,x=Math.round(riverX(y)+(hash2(i,2,S)-.5)*riverHW(y)*1.5);out.sparkles.push({x,y,ph:hash2(i,3,S)*2})}}

/* ---------- trincheiras: baías de tiro em zigue-zague, parapeito de sacos no lado inimigo ---------- */
const KIND={front:{hw:5,wall:2,depth:3.6,eAmp:3.1,rAmp:1.9,bag:1,rows:2,rev:1},support:{hw:4.6,wall:2,depth:3.3,eAmp:2.6,rAmp:1.8,bag:.78,rows:2,rev:.9},reserve:{hw:4.6,wall:2,depth:3.1,eAmp:1.9,rAmp:1.7,bag:.3,rows:2,rev:.55},comm:{hw:3.3,wall:1.7,depth:2.9,eAmp:1.2,rAmp:1.2,bag:0,rows:0,rev:.35},sap:{hw:3.1,wall:1.6,depth:2.9,eAmp:2.3,rAmp:1.2,bag:1,rows:2,rev:.6}};
const KIDS=['front','support','reserve','comm','sap'];
/* textura de sacos de areia: dd = distância a partir da borda interna, L = posição ao longo do parapeito */
function sandbag(G,i,x,y,nside){const{mat,vr,Hm,MT}=G,j=Math.floor(y/3),a=x+((j&1)?2:0),col=Math.floor(a/5),ua=a-col*5,vv=y-j*3,hv=hash2(col,j+nside*7,S+21);
 if(hv>.955)return false;
 mat[i]=MT.SAND;let k=2+Math.floor(hv*3)%3;if(ua===0)k=0;else if(vv===0)k=5;else if(vv===2)k=1;
 vr[i]=k/5;Hm[i]+=.3;return true}

function trenches(G,out){const{w,h,N,mat,vr,Hm,MT}=G,Dmin=new Float32Array(N).fill(99),Tl=new Float32Array(N),Tlat=new Float32Array(N),Tk=new Uint8Array(N),Ts=new Float32Array(N),Tt=new Uint8Array(N);
 if(!FORTS()){G.Dmin=Dmin;G.Tl=Tl;G.Tk=Tk;G.Tt=Tt;return Dmin}   // sem linhas: o chão fica como o campo desgastado em volta
 const paths=[...WW.teamPaths(0),...WW.teamPaths(1)];
 for(const path of paths){const K=KIND[path.kind],kid=KIDS.indexOf(path.kind),ps=path.team?-1:1;
  stroke(G,path.pts,K.hw+K.wall+8,(i,x,y,d,lat,L,seg,ex)=>{if(d<Dmin[i]){Dmin[i]=d;Tl[i]=L;Tlat[i]=lat;Tk[i]=kid;Tt[i]=path.team;Ts[i]=path.kind==='comm'?0:d>.01?clamp(ex*ps/d,-1,1):0}})}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,d0=Dmin[i];if(d0>18)continue;const kid=Tk[i],K=KIND[KIDS[kid]],L=Tl[i],side=Ts[i],team=Tt[i],B=BAYER[(y&3)*4+(x&3)];
  const dw=d0+(vnoise(x/5,y/5,S+14)-.5)*1.1,base=Hm[i];
  if(dw<K.hw){ /* chão */
   Hm[i]=-K.depth+(vnoise(x/3,y/3,S+15)-.5)*.3;const a=Math.abs(Tlat[i]);
   if(K.bag>0&&side>.15&&dw>K.hw-1.9){mat[i]=MT.STEP;vr[i]=fr(L/3.4)<.5?.6:.42;Hm[i]+=.85}
   else if(a<K.hw-1.3){const kk=Math.floor(L/3),f=fr(L/3);
    if(hash2(kk,kid,S+30)>.955){mat[i]=MT.FLOOR;vr[i]=.35}
    else if(vnoise(x/6,y/6,S+31)>.9){mat[i]=MT.PUDDLE;vr[i]=.35+hash2(x,y,S)*.4;Hm[i]-=.4}
    else{mat[i]=MT.DUCK;vr[i]=f<.34?.02:.36+(f<.5?.2:0)+.3*hash2(kk,kid+3,S+32)}}
   else{mat[i]=MT.FLOOR;vr[i]=.3+.4*vnoise(x/4,y/4,S+33)}
  }else if(dw<K.hw+K.wall){ /* parede */
   const t=(dw-K.hw)/K.wall,e=t*t*(3-2*t);Hm[i]=-K.depth*(1-e)+base*e;
   if(hash2(kid,Math.floor(L/40),S+34)<K.rev){mat[i]=MT.REV;vr[i]=fr(L/1.7)<.5?.62:.34}else{mat[i]=MT.MUD;vr[i]=.22+vnoise(x/3,y/3,S+35)*.3}
  }else{ /* terra escavada em volta: parapeito do lado inimigo, parados atrás */
   const dd=dw-K.hw-K.wall,amp=K.rAmp+(K.eAmp-K.rAmp)*G.smooth(-.3,.6,side),enemy=side>.22,bagW=K.rows*3;
   const useBag=K.bag>0&&enemy&&vnoise(L/22,kid+team*3,S+36)<K.bag;
   const top=useBag?bagW+.4:1.4,prof=dd<1.4?amp*Math.pow(dd/1.4,.7):dd<top?amp:amp*Math.exp(-(dd-top)/(2.2+amp));
   if(dd<14)Hm[i]+=prof;
   if(dd<1.6&&B>.4){mat[i]=MT.MUD;vr[i]=.42+hash2(x,y,S+37)*.3}
   else if(useBag&&dd<bagW){if(!sandbag(G,i,x,y,team)){mat[i]=MT.MUD;vr[i]=.3+hash2(x,y,S+38)*.25}}}
 }
 G.Dmin=Dmin;G.Tl=Tl;G.Tk=Tk;G.Tt=Tt;return Dmin}

/* manchas de terra batida / lama ao redor de uma posição */
function apron(G,cx,cy,rx,ry,k=1){const{w,h,mat,vr,MT}=G;
 for(let y=Math.max(0,Math.floor(cy-ry));y<Math.min(h,Math.ceil(cy+ry));y++)for(let x=Math.max(0,Math.floor(cx-rx));x<Math.min(w,Math.ceil(cx+rx));x++){const d=Math.hypot((x+.5-cx)/rx,(y+.5-cy)/ry);if(d>=1)continue;const B=BAYER[(y&3)*4+(x&3)],i=y*w+x;if(mat[i]===MT.WATER||mat[i]===MT.BANK)continue;
  if((1-d)*k+(B-.5)*.6>.22&&mat[i]<=MT.G2){mat[i]=MT.MUD;vr[i]=.28+vnoise(x/4,y/4,S+40)*.5}}}

/* posição de tiro circular, aberta para o lado de trás (oeste para os Aliados) */
function pit(G,cx,cy,ri,ring,open,team,opts={}){const{w,h,mat,vr,Hm,MT}=G,ro=ri+ring;(G.pits||(G.pits=[])).push({cx,cy,ri,ring,open,team,rows:Math.max(1,Math.round(ring/3))});
 for(let y=Math.max(0,Math.floor(cy-ro-2));y<Math.min(h,Math.ceil(cy+ro+2));y++)for(let x=Math.max(0,Math.floor(cx-ro-2));x<Math.min(w,Math.ceil(cx+ro+2));x++){const dx=x+.5-cx,dy=y+.5-cy,d=Math.hypot(dx,dy)+(vnoise(x/4,y/4,S+50)-.5)*.7,i=y*w+x;if(d>ro+2)continue;
  const ang=Math.atan2(dy,dx*(team?-1:1)),opening=Math.abs(Math.abs(ang)-Math.PI)<open;
  if(d<ri){Hm[i]=-(opts.depth||2.4);if(opts.deck&&d<ri-1.5){mat[i]=MT.DUCK;vr[i]=.35+.3*hash2(Math.floor(dx/2.2),Math.floor(dy/2.2),S+51)}else{mat[i]=MT.FLOOR;vr[i]=.3+.4*vnoise(x/4,y/4,S+52)}}
  else if(d<ro){if(opening){Hm[i]=-(opts.depth||2.4)*(1-(d-ri)/ring);mat[i]=MT.MUD;vr[i]=.25+hash2(x,y,S)*.3;continue}
   Hm[i]+=Math.min(2.4,(d-ri)*1.6+1);if(!sandbag(G,i,x,y,team)){mat[i]=MT.MUD;vr[i]=.3+hash2(x,y,S+53)*.25}}
  else if(d<ro+2)Hm[i]+=(ro+2-d)*.5}}

WW.ground=function(G){const out={sparkles:[]};G.out=out;
 const mainPts=roads(G);G.mainPts=mainPts;
 fields(G);
 rails(G,both(WW.railPts?WW.railPts():[[WW.X.rail,-4],[WW.X.rail,804]],G.w)[0],2.2);
 rails(G,both(WW.railPts?WW.railPts():[[WW.X.rail,-4],[WW.X.rail,804]],G.w)[1],2.2);
 river(G,out);
 trenches(G,out);
 if(WW.groundExtra)WW.groundExtra(G,{stroke,rails,apron,pit,sandbag,both,mirrorPts});
 G.sparkles=out.sparkles};
WW.gx={stroke,apron,pit,sandbag,rails,both,mirrorPts,mx,fr,S};
})();
