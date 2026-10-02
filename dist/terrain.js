'use strict';
(function(){
const {Z,TAU,clamp,hex2rgb,pack,mk,g2,box,cached,outlined,silhouette,disc,srand,sr,trenchSprite,wireSprite}=PX;
/* Iron Front 0.4 — terreno em pixel art.
   O terreno é pintado em resolução nativa de arte (1 pixel = 1/Z unidades do mundo) com dithering
   ordenado (matriz de Bayer) entre faixas de tom, em vez de pontilhado aleatório e elipses suavizadas. */
const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5].map(v=>(v+.5)/16);
function hash2(x,y,s){let h=Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(s|0,1442695041)|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296}
const LAT=new Map();function lattice(s){let t=LAT.get(s);if(!t){t=new Float32Array(65536);for(let i=0;i<65536;i++)t[i]=hash2(i&255,i>>8,s);LAT.set(s,t)}return t}
function vnoise(x,y,s){const t=lattice(s),xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),x0=xi&255,x1=(xi+1)&255,y0=(yi&255)<<8,y1=((yi+1)&255)<<8,a=t[x0+y0],b=t[x1+y0],c=t[x0+y1],d=t[x1+y1];return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
function fbm(x,y,s,o=3){let t=0,a=.5,f=1,n=0;for(let i=0;i<o;i++){t+=vnoise(x*f,y*f,s+i*17)*a;n+=a;a*=.5;f*=2}return t/n}

const TERRAIN={
trenches:{seed:11,g:['#343d2a','#3f4931','#4b5637','#586340','#687350'],m:['#3a3024','#483b2c','#584838','#69573f','#7c6849'],r:['#6a5b3e','#86764f','#9d8d65'],w:['#27414a','#32535d','#426d78','#5f8c94'],foam:'#c4dad6',spark:'#e8f4f1',bank:['#3f3829','#514834'],tuft:['#2b3422','#77834f'],flower:['#c7b15e','#a66a52'],
 tree:['#2c3c26','#3b5030','#4f6a3c','#6d8a4c'],trunk:['#3f2f22','#5c4632'],dead:['#3a3127','#5d4d3c'],ruin:['#7f6252','#9b7762','#5a453b'],deadRate:.45,pine:0,snow:0},
forest:{seed:23,g:['#222d1d','#2b3924','#35472b','#415636','#4f6642'],m:['#352c20','#423728','#524536','#635444','#766553'],r:['#62583c','#7b6f4f','#918462'],w:['#213b40','#2b4c53','#386069','#527e86'],foam:'#b4cdc9',spark:'#dcebe8',bank:['#2f2b20','#3f382a'],tuft:['#1e2819','#5f7a43'],flower:['#b9a954','#8c5d6a'],
 tree:['#1f3221','#2a4a2d','#3b6238','#548149'],trunk:['#3a2b1f','#553f2c'],dead:['#362e25','#564839'],ruin:['#757766','#8f9180','#555848'],deadRate:.12,pine:.6,snow:0},
winter:{seed:37,g:['#8597a0','#97a9b1','#adbcc1','#c5d2d4','#e0e9e8'],m:['#5d6461','#6f7773','#838b86','#979e98','#abb1ab'],r:['#8f9a9b','#a2acac','#b6bfbf'],w:['#3c6075','#4b7489','#6a93a6','#94b9c9'],foam:'#eaf3f3',spark:'#ffffff',bank:['#6c7a7d','#7f8c8e'],tuft:['#6e7f88','#f2f7f6'],flower:['#f2f7f6','#c6d6dc'],
 tree:['#445e57','#587369','#7a9690','#c3d3d1'],trunk:['#4a3f38','#6a5b50'],dead:['#4b4641','#72695f'],ruin:['#84878a','#9fa3a5','#62666a'],deadRate:.25,pine:.75,snow:1}};
const riverX=y=>(1190+Math.sin(y*2/160)*70)/2,riverHW=y=>14+3*Math.sin(y*.09+1)+1.5*Math.sin(y*.23);
const ROADS=[185,400,610].map(y=>y*(window.IronFrontWorld?.height||1600)/1600);

function pk(col,a=255){const[r,g,b]=hex2rgb(col);return((a<<24)|(b<<16)|(g<<8)|r)>>>0}
function px(c,x,y,col){c.fillStyle=col;c.fillRect(x,y,1,1)}

/* cratera com iluminação no canto superior esquerdo; usada no terreno inicial e em cada explosão */
function stampCrater(c,cx,cy,r,P,o={}){const R=Math.ceil(r*(o.scorch?2:1.35))+3,sz=R*2+1,img=c.createImageData(sz,sz),d=new Uint32Array(img.data.buffer),M=P.m.map(v=>pk(v)),seed=o.seed||1,wat=o.puddle?P.w.map(v=>pk(v)):null;
for(let j=-R;j<=R;j++)for(let i=-R;i<=R;i++){const dist=Math.hypot(i,j)||.001,ang=Math.atan2(j,i),rr=r*(1+.15*Math.sin(ang*3+seed)+.09*Math.sin(ang*5+seed*1.7)+.05*Math.sin(ang*9+seed*.3)),t=dist/rr,th=BAYER[((j+R)&3)*4+((i+R)&3)],s=(-i-j)*.7071/dist;let col=0;
if(t<.5){col=wat?wat[s>.3?0:1]:(s>.35?M[0]:M[1])}else if(t<.8){const v=s*.8+(th-.5)*.6;col=wat&&t<.68?wat[v>.2?1:v>-.3?2:3]:(v>.35?M[0]:v>0?M[1]:v>-.4?M[2]:M[3])}
else if(t<1.05){const v=s*.9+(th-.5)*.5;col=v>.35?M[4]:v>-.15?M[3]:v>-.5?M[2]:M[1]}
else if(t<1.5&&(o.scorch||t<1.25)){const lim=o.scorch?(1.75-t)*(o.scorch):(1.25-t)*1.4;if(th<lim*.75)col=pk('#15120c',o.scorch?120:90)}
if(col)d[(j+R)*sz+(i+R)]=col}
const st=mk(sz,sz);g2(st).putImageData(img,0,0);c.drawImage(st,cx-R,cy-R)}

function bridgeSprite(){return cached('bridge',()=>{const c=mk(104,42),x=g2(c),R=box(x);
x.fillStyle='rgba(8,14,12,.42)';x.fillRect(6,12,96,30);R(4,6,96,28,'#3b2c1c');
for(let k=0;k<17;k++){const xx=5+k*5.6|0,tone=k%3;R(xx,7,5,26,tone===0?'#8a6d48':tone===1?'#7d6140':'#947650');R(xx,7,5,1,'#b39a6d');R(xx,32,5,1,'#5b4630');R(xx+4,7,1,26,'#4a3826')}
R(4,4,96,3,'#5a4630');R(4,4,96,1,'#8a6d48');R(4,33,96,3,'#4a3826');R(4,33,96,1,'#6e553a');
for(let k=0;k<9;k++){R(4+k*12,1,3,7,'#46351f');R(4+k*12,1,3,1,'#7b6443');R(4+k*12,33,3,7,'#3a2b19');R(4+k*12,33,3,1,'#6e553a')}
R(0,8,5,24,'#5e4a33');R(99,8,5,24,'#5e4a33');
return{c:outlined(c,.55),ax:53,ay:21}})}

function treeSprite(kind,r,P,seed){srand(seed);const S=r*2+12,c=mk(S,S+8),x=g2(c),cx=S/2|0,cy=r+5,T=P.tree;
if(kind==='dead'){const tr=P.dead;for(let j=0;j<r*1.5;j++){px(x,cx,cy+r*.4+j-r*.5|0,j%3?tr[0]:tr[1]);if(j<r*1.2)px(x,cx+1,cy+r*.4+j-r*.5|0,tr[1])}
 for(let b=0;b<5;b++){const a=-Math.PI/2+(b-2)*.55+(sr()-.5)*.3,len=r*(.7+sr()*.5);for(let k=1;k<len;k++)px(x,Math.round(cx+Math.cos(a)*k),Math.round(cy-r*.2+Math.sin(a)*k),k%2?tr[1]:tr[0])}
 return{c:outlined(c,.55),ax:cx+1,ay:cy+1}}
if(kind==='pine'){const tiers=Math.max(3,Math.round(r/3));for(let i=0;i<tiers;i++){const w=Math.round(r*(1-i*.6/tiers)),top=cy-r*.9+i*(r*1.4/tiers),hgt=Math.round(r*1.15),tone=Math.min(2,1+(i>tiers/2?1:0));
 for(let j=0;j<hgt;j++){const hw=Math.round(w*(j+1)/hgt);for(let k=-hw;k<=hw;k++){let col=k<-hw*.35?T[tone+1]:k>hw*.45?T[0]:T[tone];if(P.snow&&j<hgt*.4&&((k+j+i)&1||j<2))col=T[3];px(x,cx+k,Math.round(top+j),col)}}}
 for(let j=0;j<4;j++)px(x,cx,cy+r*.55+j|0,P.trunk[0]);return{c:outlined(c,.5),ax:cx+1,ay:cy+1}}
for(let j=0;j<4;j++){px(x,cx,cy+r*.6+j|0,P.trunk[0]);px(x,cx+1,cy+r*.6+j|0,P.trunk[1])}
const blobs=[];const n=4+Math.floor(r/4);for(let i=0;i<n;i++){const a=sr()*TAU,dd=sr()*r*.45;blobs.push([cx+Math.cos(a)*dd,cy+Math.sin(a)*dd*.8,r*(.5+sr()*.25)])}blobs.push([cx,cy,r*.72]);
for(const[bx,by,br]of blobs)disc(x,bx,by+1.5,br,T[0]);for(const[bx,by,br]of blobs)disc(x,bx-.8,by-.5,br*.88,T[1]);
for(const[bx,by,br]of blobs)disc(x,bx-1.6,by-1.8,br*.6,T[2]);
const hi=mk(S,S+8),hx=g2(hi);for(const[bx,by,br]of blobs)disc(hx,bx-2.3,by-2.6,br*.32,T[3]);
const hd=hx.getImageData(0,0,hi.width,hi.height).data;for(let j=0;j<hi.height;j++)for(let i=0;i<hi.width;i++)if(hd[(j*hi.width+i)*4+3]&&BAYER[(j&3)*4+(i&3)]<.42)px(x,i,j,T[3]);
for(let i=0;i<r*2;i++){const a=sr()*TAU,dd=sr()*r*.9;px(x,Math.round(cx+Math.cos(a)*dd-1),Math.round(cy+Math.sin(a)*dd*.8+2),T[0])}
return{c:outlined(c,.55),ax:cx+1,ay:cy+1}}

function ruinSprite(P,seed){srand(seed);const c=mk(46,30),x=g2(c),R=box(x),B=P.ruin;
for(let i=0;i<30;i++){px(x,6+(sr()*34|0),20+(sr()*8|0),sr()<.5?B[2]:B[0])}
R(10,14,28,9,B[0]);for(let j=0;j<9;j++)for(let i=0;i<28;i++){const brick=(i+((j>>1)&1)*3)%6===0||j%3===0;px(x,10+i,14+j,brick?B[2]:((i+j)%5===0?B[1]:B[0]))}
R(10,14,28,1,B[1]);for(let i=0;i<28;i++)if(sr()<.32)x.clearRect(10+i,14,1,1+(sr()<.4?1:0));for(let i=0;i<6;i++)x.clearRect(10+(sr()*28|0),14,2,1);
R(4,4,7,20,B[0]);for(let j=0;j<20;j++)for(let i=0;i<7;i++){const brick=(i+((j>>1)&1)*3)%5===0||j%3===0;px(x,4+i,4+j,brick?B[2]:((i*2+j)%7===0?B[1]:B[0]))}
R(4,4,7,1,B[1]);x.clearRect(4,4,2,2);x.clearRect(9,4,2,3);x.clearRect(6,7,1,1);
R(11,22,27,2,'#2a2c25');R(12,24,25,1,'#1f211b');
for(let i=0;i<14;i++){const rx=30+(sr()*14|0),ry=22+(sr()*6|0);px(x,rx,ry,B[1]);px(x,rx+1,ry,B[0]);px(x,rx,ry+1,B[2])}
R(24,18,4,4,'#1f211b');R(25,18,2,1,'#15170f');
const s=mk(52,36),sx=g2(s);sx.drawImage(silhouette(c,'#0e1409',.3),5,5);sx.drawImage(outlined(c,.55),1,1);
return{c:s,ax:25,ay:17}}

/* gera o terreno e devolve {canvas, decor, sparkles, P} — tudo em coordenadas de arte (1 px = 2 unidades) */
function genTerrain(key,W,H){const P=TERRAIN[key],w=W*Z,h=H*Z,cv=mk(w,h),c=g2(cv),img=c.createImageData(w,h),d=new Uint32Array(img.data.buffer),seed=P.seed,G=P.g.map(v=>pk(v)),M=P.m.map(v=>pk(v)),RD=P.r.map(v=>pk(v)),WA=P.w.map(v=>pk(v)),BK=P.bank.map(v=>pk(v)),FO=pk(P.foam),SP=pk(P.spark),sparkles=[];
const mid=w/2,winter=P.snow;
const ST=3,gw=Math.ceil(w/ST)+2,gh=Math.ceil(h/ST)+2,FT=new Float32Array(gw*gh),F3=new Float32Array(gw*gh),FM=new Float32Array(gw*gh);
for(let gy=0;gy<gh;gy++)for(let gx=0;gx<gw;gx++){const x=gx*ST,y=gy*ST,i=gy*gw+gx;FT[i]=fbm(x/64,y/64,seed,3)*.72+fbm(x/17,y/17,seed+9,2)*.28;F3[i]=fbm(x/38,y/38,seed+31,3);FM[i]=fbm(x/30,y/30,seed+5,2)}
const samp=(F,x,y)=>{const fx=x/ST,fy=y/ST,ix=fx|0,iy=fy|0,ax=fx-ix,ay=fy-iy,i=iy*gw+ix;return F[i]*(1-ax)*(1-ay)+F[i+1]*ax*(1-ay)+F[i+gw]*(1-ax)*ay+F[i+gw+1]*ax*ay};
for(let y=0;y<h;y++){const rx=riverX(y),rhw=riverHW(y),nearRoad=ROADS.some(r=>Math.abs(y-r)<12);for(let x=0;x<w;x++){const th=BAYER[(y&3)*4+(x&3)],t=samp(FT,x,y),n3=samp(F3,x,y);
const dc=Math.abs(x-mid),mudBase=clamp(1-(dc-140)/200,0,1),ms=mudBase*.85+n3*.42-.2;let col;
if(ms+(th-.5)*.3>.56){col=M[clamp(Math.floor(samp(FM,x,y)*3.8+.9+(th-.5)*1.1),0,4)]}
else col=G[clamp(Math.floor((t-.12)*6.2+(th-.5)*1.2),0,4)];
if(nearRoad)for(let j=0;j<ROADS.length;j++){const yr=ROADS[j]+Math.sin(x/55+j*2)*3.2,dr=Math.abs(y-yr);if(dr>6)continue;const hw=4.3+(vnoise(x/9,j*5,seed)-.5)*1.6;if(dr<hw){if(dr>hw-1&&th>.5)continue;col=Math.abs(dr-1.9)<.6?RD[0]:RD[1+((x*7+y*3+th*9|0)&1)]}}
const adx=Math.abs(x-rx);if(adx<rhw+8){const dx=Math.abs(x-rx+(vnoise(x/6,y/6,seed+3)-.5)*2.6);
if(dx<rhw){const depth=1-dx/rhw,stream=vnoise(x/3,y/15,seed+8)>.74?1:0;let k=clamp(Math.floor((1-depth)*3.9+(th-.5)*.9)-stream,0,3);col=WA[k];if(dx>rhw-1.6&&hash2(x,y,seed)>.42)col=FO;else if(hash2(x,y,seed+5)<.011)col=SP}
else if(dx<rhw+3.4){if(dx<rhw+1.4)col=BK[0];else if(th>.45)col=BK[1]}}
d[y*w+x]=col}}
/* Faíscas animadas da água: escolhidas agora, desenhadas pelo jogo */
for(let i=0;i<260;i++){const y=(hash2(i,1,seed)*h)|0,x=Math.round(riverX(y)+(hash2(i,2,seed)-.5)*riverHW(y)*1.5);sparkles.push({x,y,ph:hash2(i,3,seed)*2})}
c.putImageData(img,0,0);
/* tufos de grama, pedrinhas e flores */
srand(seed*7);const specks=Math.floor(w*h/260);for(let i=0;i<specks;i++){const x=sr()*w|0,y=sr()*h|0;if(Math.abs(x-riverX(y))<riverHW(y)+5)continue;const k=sr();
 if(k<.68){px(c,x,y,P.tuft[0]);px(c,x-1,y-1,P.tuft[0]);px(c,x+1,y-1,P.tuft[0]);if(sr()<.45)px(c,x,y-2,P.tuft[1])}
 else if(k<.86){px(c,x,y,P.tuft[1])}
 else if(k<.94&&!winter){px(c,x,y,P.flower[sr()<.6?0:1])}
 else{px(c,x,y,'#757a6c');px(c,x+1,y,'#8d9283');px(c,x,y+1,'#4d5145');px(c,x+1,y+1,'#585d50')}}
/* crateras do terreno de ninguém */
const craters=[];srand(seed*13);for(let i=0;i<120;i++){const x=sr()*w|0,y=sr()*h|0,r=4+sr()*sr()*15;if(Math.abs(x-riverX(y))<riverHW(y)+r+6)continue;const near=Math.abs(x-mid)<220;if(!near&&sr()<.45)continue;craters.push({x,y,r});stampCrater(c,x,y,r,P,{puddle:r>7&&sr()<.35,seed:i+1})}
/* pontes */
const br=bridgeSprite();for(const yy of ROADS){c.drawImage(br.c,Math.round(riverX(yy))-br.ax,yy-br.ay)}
/* trincheiras de comunicação, trincheiras e arame */
const tr=trenchSprite(),wr=wireSprite(0);for(let side=0;side<2;side++){let prev=null;for(let yw=70;yw<H-70;yw+=90){const xw=(side===0?720:1700)+Math.sin(yw/140)*40,ax=xw/2,ay=yw/2;
 if(prev&&Math.abs(prev.x-ax)<24){const yA=prev.y+10,yB=ay-10,xm=Math.round((prev.x+ax)/2)+14;for(let yy=yA;yy<=yB;yy++){px(c,xm-3,yy,'#8b7853');for(let k=-2;k<=2;k++)px(c,xm+k,yy,k===-2?'#120f0a':k===2?'#4a3d29':'#2c241a');px(c,xm+3,yy,'#4c3f29')}}
 prev={x:ax,y:ay};c.drawImage(tr.c,Math.round(ax)-tr.ax,Math.round(ay)-tr.ay);if(yw%180<100)c.drawImage(wr.c,Math.round(ax+(side===0?55:-55))-wr.ax,Math.round(ay)-wr.ay)}}
/* decoração: árvores e ruínas (também definem a cobertura) */
srand(seed*19);const decor=[],n=key==='forest'?240:65;for(let i=0;i<n;i++){const x=sr()*W,y=sr()*H;if(Math.abs(x-1200)<180||x>650&&x<780||x>1640&&x<1780)continue;if(Math.abs(x/2-riverX(y/2))<riverHW(y/2)+9)continue;decor.push({x,y,type:sr()>.26?'tree':'ruin',size:12+sr()*17,s:(sr()*1e6)|0})}
decor.sort((a,b)=>a.y-b.y);
for(const dd of decor){const ax=Math.round(dd.x/2),ay=Math.round(dd.y/2);if(dd.type==='tree'){const r=Math.round(dd.size/2+2),kind=P.deadRate&&hash2(dd.s,4,seed)<P.deadRate?'dead':hash2(dd.s,5,seed)<P.pine?'pine':'round',sp=treeSprite(kind,r,P,dd.s+1);
 const sh=silhouette(sp.c,'#0b1207',.28);c.drawImage(sh,ax-sp.ax+Math.round(r*.6),ay-sp.ay+Math.round(r*.45));c.drawImage(sp.c,ax-sp.ax,ay-sp.ay)}
 else{const sp=ruinSprite(P,dd.s+3);c.drawImage(sp.c,ax-sp.ax,ay-sp.ay)}}
/* pequenas propriedades: estacas, caixotes e barris perto das linhas */
srand(seed*29);for(let i=0;i<46;i++){const side=i%2,ax=(side?1700:720)/2+(sr()-.5)*150,ay=40+sr()*(h-80);if(Math.abs(ax-riverX(ay))<riverHW(ay)+8)continue;const k=sr();
 if(k<.4){for(let s=0;s<3;s++){px(c,ax+s*4,ay,'#6b5a40');px(c,ax+s*4,ay-1,'#8a7656');px(c,ax+s*4,ay+1,'#2b2418')}}
 else if(k<.7){c.fillStyle='#2b2418';c.fillRect(ax-1,ay-1,8,7);c.fillStyle='#8a6d48';c.fillRect(ax,ay-2,6,5);c.fillStyle='#b39a6d';c.fillRect(ax,ay-2,6,1);c.fillStyle='#5b4630';c.fillRect(ax,ay+2,6,1);c.fillRect(ax+2,ay-2,1,5)}
 else{disc(c,ax+3,ay+1,3,'#2b2418');disc(c,ax+3,ay,2,'#6d5a3f');px(c,ax+2,ay-1,'#b39a6d');px(c,ax+3,ay+1,'#3c3020')}}
return{canvas:cv,decor,sparkles,P,craters}}

PX.noise={BAYER,hash2,vnoise,fbm,pk,px};PX.TERRAIN=TERRAIN;PX.genTerrain=genTerrain;PX.riverX=riverX;PX.riverHW=riverHW;PX.ROADS=ROADS;PX.stampCrater=stampCrater;
})();
