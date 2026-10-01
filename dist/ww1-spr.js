'use strict';
(function(){
const {mk,g2,outlined,silhouette,cached,fromGrid,flipX,mix,disc,ring,pline,srand,sr,TAU,clamp}=PX,{hash2,vnoise,BAYER}=PX.noise,WW=PX.WW1;
/* Iron Front 0.6 — kit de sprites do mapa. Luz no canto superior esquerdo; vista de cima com a fachada sul visível.
   Cada sprite é desenhado uma vez (cache), ganha contorno seletivo e devolve {c, ax, ay, sh}. */
const R=(c,x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),w,h)};
const dot=(c,x,y,col)=>{c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),1,1)};
const ell=(c,cx,cy,rx,ry,col)=>{c.fillStyle=col;for(let j=-Math.floor(ry);j<=Math.floor(ry);j++){const w=Math.floor(rx*Math.sqrt(Math.max(0,1-(j*j)/((ry+.5)*(ry+.5)))));c.fillRect(Math.round(cx)-w,Math.round(cy)+j,w*2+1,1)}};
const line=(c,x0,y0,x1,y1,col)=>pline(c,x0,y0,x1,y1,col);
const H=(n,a,b)=>hash2(n,a,b);
/* sprite com cache: draw(ctx,w,h) → {c,ax,ay,sh}; ax/ay = ponto de apoio no chão (padrão: centro da base) */
function spr(key,w,h,draw,o={}){return cached('w1s:'+key,()=>{const c=mk(w,h),x=g2(c);draw(x,w,h);const out=o.out===0?c:outlined(c,o.out||.55),p=o.out===0?0:1;
 return{c:out,ax:(o.ax!=null?o.ax:w>>1)+p,ay:(o.ay!=null?o.ay:h-2)+p,sh:o.sh||[2,2],sa:o.sa==null?.3:o.sa,key}})}
const shadowOf=sp=>cached('w1sh:'+sp.key,()=>silhouette(sp.c,'#0b1207',sp.sa));
/* desenha com sombra projetada para baixo e à direita */
function put(c,sp0,x,y,o={}){x=Math.round(x);y=Math.round(y);const sp=o.flip?flipSprite(sp0):sp0;if(sp.sa>0&&!o.noShadow){c.drawImage(shadowOf(sp),x-sp.ax+sp.sh[0],y-sp.ay+sp.sh[1])}c.drawImage(sp.c,x-sp.ax,y-sp.ay)}
function flipSprite(sp){return cached('w1f:'+sp.key,()=>({c:flipX(sp.c),ax:sp.c.width-sp.ax-1,ay:sp.ay,sh:sp.sh,sa:sp.sa,key:sp.key+'f'}))}
const flip=sp=>flipSprite(sp);

/* cores comuns */
const C={wood:['#3b2a1c','#5e452e','#86683f','#a98a58'],iron:['#3f454b','#5d646b','#7d858c','#aab1b6'],canvas:['#7d765e','#a49b80','#cbc2a4','#e6dfc6'],brass:['#7d5f23','#b8923a','#d9b556','#f0d27a'],
 olive:['#3a3d2a','#50553a','#6b6f4a','#868b5e'],slate:['#3c4148','#4f555e','#666c76','#808791'],brick:['#5c4538','#7d5a48','#9b7762','#b59a83'],plaster:['#7d7259','#9c9076','#b7aa8f','#d1c6a8'],red:'#b3302b',ink:'#1b1f16'};

/* gira um sprite 90° (horário) — exato em pixels */
function rot90(sp,k=1){return cached('w1r:'+sp.key+k,()=>{const src=sp.c;let c=src;for(let n=0;n<k;n++){const w=c.width,h=c.height,d=mk(h,w),x=g2(d);x.translate(h,0);x.rotate(Math.PI/2);x.drawImage(c,0,0);c=d}
 const w=src.width,h=src.height,ax=sp.ax,ay=sp.ay;let nax=ax,nay=ay;for(let n=0;n<k;n++){const t=nax;nax=(k%2?h:w)-1-nay;nay=t}
 return{c,ax:nax,ay:nay,sh:sp.sh,sa:sp.sa,key:sp.key+'r'+k}})}
PX.WW1.kit={rot90,R,dot,ell,line,spr,put,flip,shadowOf,C,H,fromGrid,mix,disc,ring,pline,srand,sr,TAU,clamp,mk,g2,outlined,silhouette,cached,vnoise,BAYER};
})();
