'use strict';
/* Iron Front 1.13 — arte do aeródromo (airfield-art.js). Carrega ANTES do airwar-view.js (que chama PXAFA.paint ao montar o fundo da retaguarda). Só desenho:
   o canvas de cada lado (pixels de arte, 1 u = 0,5 px) é pintado uma vez por partida. Um aeródromo de 1917–18, campo de grama sem pista de concreto:
   Campo ......... pasto aparado e salpicado de flores miúdas, cercado de arame farpado e cerca viva com choupos, portão e estrada de terra.
   Faixa ......... pista de pouso aparada em faixas de corte, balizas brancas nas bordas, "T" de lona, marcas de roda e terra batida na cabeceira.
   Táxi .......... pista de táxi, corredor central e faixas entre as fileiras em terra batida e cascalho, com as sulcos de roda; manchas de óleo sob cada vaga.
   Hangares ...... EUA: Bessonneau de lona com arcos, tirantes e estacas; Alemanha: galpão de madeira com telhado de papel alcatroado camuflado.
   Apoio ......... barraca de operações com mastro de rádio e mastro de bandeira, tendas de pilotos, depósito de combustível (latas de 4 galões, tambores,
                   cisterna), depósito de bombas atrás de taludes de terra, ninhos de metralhadora antiaérea com sacos de areia, caminhões e carro de comando.
   Acampamento ... na retaguarda do campo: barracões Adrian, refeitório, cozinha de campanha, latrinas, varal, caminhões e tendas.
   O desenho acompanha o layout do airwar.js (vagas, faixas de táxi, hangares); ?guerraaerea=0 desliga tudo · PXAFA.paint(ctx,af,x0) */
(function(){
const A=window.PXAW,PX=window.PX;if(!A||!PX)return;
const Z=PX.Z||.5,TAU=Math.PI*2,hyp=Math.hypot,clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t;
const S=window.PXAFA={on:A.on,version:'1.13',stats:{ms:0}};
const hs=(x,y,s=0)=>{let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(s|0,1442695041))|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296};
function vn(x,y,s){const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);return lerp(lerp(hs(xi,yi,s),hs(xi+1,yi,s),u),lerp(hs(xi,yi+1,s),hs(xi+1,yi+1,s),u),v)}
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const HEX=new Map(),hexv=h=>{let v=HEX.get(h);if(!v){const n=parseInt(h.slice(1),16);v=[(n>>16)&255,(n>>8)&255,n&255];HEX.set(h,v)}return v};
const MIX=new Map(),mixc=(a,b,t)=>{const k=a+b+Math.round(t*64);let r=MIX.get(k);if(!r){const A2=hexv(a),B2=hexv(b),q=Math.round(t*64)/64;r='#'+A2.map((v,i)=>Math.round(lerp(v,B2[i],q)).toString(16).padStart(2,'0')).join('');MIX.set(k,r)}return r};
const P=(c,x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)))};
const SH=(c,x,y,w,h,a=.36)=>{c.fillStyle='rgba(10,12,8,'+a+')';c.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)))};
/* retângulo com luz de cima-esquerda: realce em cima/esquerda, sombra embaixo/direita */
function slab(c,x,y,w,h,col,hi,lo){P(c,x,y,w,h,col);P(c,x,y,w,1,hi||mixc(col,'#ffffff',.25));P(c,x,y,1,h,hi||mixc(col,'#ffffff',.18));P(c,x,y+h-1,w,1,lo||mixc(col,'#000000',.35));P(c,x+w-1,y,1,h,lo||mixc(col,'#000000',.28))}

/* ======================================================================================
   BASE: o campo aparado, a faixa, as pistas de táxi
   ====================================================================================== */
const FIELD=['#58653a','#607040','#69784a','#525e36','#73834c'];
let FT=null;
/* ladrilho periódico de capim aparado (256×256, gerado uma vez): ruído de baixa e alta frequência, pontos claros e escuros e florzinhas raras */
function fieldTile(){if(FT)return FT;const N=256,c=mk(N,N),g=c.getContext('2d'),img=g.createImageData(N,N),d=img.data,F=FIELD.map(hexv);
 const pv=(X,Y,sd,Pd)=>{const xi=Math.floor(X),yi=Math.floor(Y),fx=X-xi,fy=Y-yi,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),a=((xi%Pd)+Pd)%Pd,b=((yi%Pd)+Pd)%Pd,a1=(a+1)%Pd,b1=(b+1)%Pd;return lerp(lerp(hs(a,b,sd),hs(a1,b,sd),u),lerp(hs(a,b1,sd),hs(a1,b1,sd),u),v)};
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const n=pv(i/32,j/32,1,8)*.5+pv(i/9,j/9,2,28)*.3+hs(i,j,3)*.2;const k=n<.3?3:n<.44?0:n<.6?1:n<.78?2:4,sp=hs(i,j,4);let col=F[k];
  if(sp<.035)col=[133,148,90];else if(sp>.972)col=[58,70,40];else if(sp>.9992)col=[238,230,176];else if(sp>.9986)col=[226,196,84];
  const o=(j*N+i)*4;d[o]=col[0];d[o+1]=col[1];d[o+2]=col[2];d[o+3]=255}
 g.putImageData(img,0,0);FT=c;return c}
function fieldBase(K){const{c,af,X,Y}=K,gx0=Math.round(X(af.x-905)),gx1=Math.round(X(af.x+905)),gy0=Math.max(0,Math.round(Y(af.y-985))),gy1=Math.round(Y(af.y+275)),w=gx1-gx0,h=gy1-gy0,cv=mk(w,h),g=cv.getContext('2d'),F=9;
 g.fillStyle=g.createPattern(fieldTile(),'repeat');g.fillRect(0,0,w,h);
 /* borda esfumada nos quatro lados (o campo se mistura ao capim de fora) */
 g.globalCompositeOperation='destination-out';
 const edge=(x,y,ww,hh,x1,y1,x2,y2)=>{const gr=g.createLinearGradient(x1,y1,x2,y2);gr.addColorStop(0,'rgba(0,0,0,1)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(x,y,ww,hh)};
 edge(0,0,F,h,0,0,F,0);edge(w-F,0,F,h,w,0,w-F,0);if(gy0>0)edge(0,0,w,F,0,0,0,F);edge(0,h-F,w,F,0,h,0,h-F);
 c.drawImage(cv,gx0,gy0)}
/* trilha de terra batida (largura em u). road: leito de terra e cascalho; ruts: capim gasto com dois sulcos de roda e manchas de terra (faixas de táxi em campo aberto) */
const EARTH=['#7d6f50','#726548','#88795b','#665a40','#938565'],WORN=['#7f7a52','#8a8458','#6f6a46'];
function track(K,pts,wu,o={}){const{c}=K,hw=wu*Z/2,E=EARTH.map(hexv),Wn=WORN.map(hexv),seed=o.seed||5,ruts=!!o.ruts;let n=0;
 for(let s=0;s<pts.length-1;s++){const[ax,ay]=pts[s],[bx,by]=pts[s+1],dx=bx-ax,dy=by-ay,L=hyp(dx,dy),nx=-dy/L,ny=dx/L;
  for(let t=0;t<L;t+=1){const px=ax+dx*t/L,py=ay+dy*t/L,jit=(vn(t/11+n,s*7,seed)-.5)*(ruts?3.4:2),wob=vn(t/23+n,s*3,seed+5);
   for(let w=-hw-1.5;w<=hw+1.5;w+=1){const ww=w+jit,aw=Math.abs(ww);if(aw>hw+1)continue;const x=Math.round(px+w*nx),y=Math.round(py+w*ny),r=hs(x,y,seed+2);
    let col=null;if(ruts){const rut=Math.abs(aw-hw*.5)<1.1&&wob>.22,k=1-aw/hw;
     if(rut&&r<.8)col=E[3];else if(rut)col=E[1];else if(r<.16*k+.05)col=Wn[r<.08?0:r<.12?1:2];else if(r>.992)col=[146,136,112];
     if(!col)continue;c.globalAlpha=rut?.72:.55}
    else{const edge=aw>hw-1.2;if(edge&&hs(x,y,seed+1)<.5)continue;const rut2=Math.abs(aw-hw*.5)<.7;col=E[r<.3?3:r<.55?1:r<.85?0:2];if(rut2)col=E[3];else if(r>.965)col=[150,140,118];c.globalAlpha=1}
    c.fillStyle='rgb('+col[0]+','+col[1]+','+col[2]+')';c.fillRect(x,y,1,1)}}n++}c.globalAlpha=1}
/* faixa de pouso aparada */
function strip(K){const{c,af,X,Y}=K,d=af.dir,x0=af.x-af.half,hw=af.w/2,gx=X(x0-30),gy=Y(af.y-hw-8),gw=(af.half*2+60)*Z,gh=(hw*2+16)*Z;
 for(let i=0;i<gw;i+=1){const band=(Math.floor(i/7)&1),nx=Math.round(gx+i);for(let j=0;j<gh;j++){const ny=Math.round(gy+j),r=hs(nx,ny,11),edge=j<3||j>gh-4;let col=band?'#74834a':'#80905a';if(r<.08)col=band?'#6b7a42':'#76864f';else if(r>.94)col='#92a066';if(edge){if(hs(nx,ny,12)<.5)continue;col='#657240'}c.fillStyle=col;c.fillRect(nx,ny,1,1)}}
 /* terra batida e capim gasto na cabeceira de partida (onde os aviões alinham e provam o motor) e no ponto de toque */
 const xs=X(af.x-d*af.half),wearZone=(zx0,len,amount)=>{for(let i=0;i<len*Z;i++)for(let j=-26*Z;j<26*Z;j++){const px=Math.round(X(zx0)+(d>0?i:-i)),py=Math.round(Y(af.y)+j),n=vn(px/8,py/8,13)*.6+hs(px,py,14)*.4;if(n>1-amount*(1-Math.abs(j)/(26*Z)*.55)){c.fillStyle=n>.93?'#8a7a58':'#7d6f50';c.globalAlpha=.7;c.fillRect(px,py,1,1);c.globalAlpha=1}}};
 wearZone(af.x-d*af.half+d*8,150,.5);wearZone(af.x-d*(af.half-90)+d*10,110,.3);
 /* sulcos de roda ao longo da corrida */
 for(const off of[-9,9])for(let i=0;i<af.half*2*Z;i+=1){if(hs(i,off,15)<.62){const px=Math.round(X(x0)+i),py=Math.round(Y(af.y+off));c.globalAlpha=.4;c.fillStyle='#4a5a2c';c.fillRect(px,py,1,1);c.globalAlpha=1}}}
/* balizas de borda (pano branco em haste), painéis de canto e o "T" de lona */
function signals(K){const{c,af,X,Y}=K,d=af.dir,hw=af.w/2+10,x0=af.x-af.half,x1=af.x+af.half;
 for(let u=x0;u<=x1;u+=100)for(const sY of[-1,1]){const px=Math.round(X(u)),py=Math.round(Y(af.y+sY*hw));P(c,px+1,py+1,2,2,'rgba(10,12,8,.4)');P(c,px,py-4,1,5,'#3a2f22');P(c,px,py-5,3,3,'#f0ece0');P(c,px,py-5,3,1,'#ffffff');P(c,px+2,py-3,1,1,'#c9c4b2')}
 for(const[ux,sY]of[[x0-14,-1],[x0-14,1],[x1+14,-1],[x1+14,1]]){const px=Math.round(X(ux)),py=Math.round(Y(af.y+sY*(hw+4)));SH(c,px+2,py+2,8,8,.4);P(c,px,py,8,8,'#efe9d8');P(c,px,py,8,1,'#ffffff');P(c,px,py+7,8,1,'#b8b19c');P(c,px+3,py+1,2,6,'#2a2620');P(c,px+1,py+3,6,2,'#2a2620')}
 /* T de lona, ao sul do ponto de toque: a barra do T fica no lado para onde se pousa (contra o vento) */
 {const tx=af.x-d*(af.half-210),ty=af.y+af.w/2+78,px=Math.round(X(tx)),py=Math.round(Y(ty)),L=16,sd=d>0?1:-1;
  SH(c,px-L+2,py+2,L*2,3,.35);P(c,px-L,py-1,L*2,3,'#f3eee0');P(c,px-L,py-1,L*2,1,'#ffffff');
  SH(c,px+sd*L+1,py-6,4,13,.35);P(c,px+sd*L-(sd<0?0:0),py-6,3,13,'#f3eee0');P(c,px+sd*L,py-6,1,13,'#ffffff');
  for(const k of[-L,L])P(c,px+k,py+2,1,3,'#3a2f22')}}
/* corredor, faixas de táxi, pista de táxi paralela, ligações à cabeceira e saída de cada vaga */
function taxiways(K){const{c,af,X,Y}=K,d=af.dir,ty=af.y+af.TY,xs=af.x-d*af.half,Q=(x,y)=>[X(x),Y(y)];
 track(K,[Q(af.x-af.half-110,ty),Q(af.x+af.half+110,ty)],34,{seed:21});
 track(K,[Q(af.x,ty),Q(af.x,af.y+af.lanes[2])],70,{seed:22,ruts:1});
 for(let i=0;i<3;i++)track(K,[Q(af.x-af.bayMax+10,af.y+af.lanes[i]),Q(af.x+af.bayMax-10,af.y+af.lanes[i])],50,{seed:23+i,ruts:1});
 const hx=xs-d*72;track(K,[Q(hx,ty),Q(hx,af.y-18)],34,{seed:30});track(K,[Q(hx,af.y),Q(xs+d*120,af.y)],36,{seed:31,ruts:1});
 track(K,[Q(af.x-d*(af.half-120)+d*30,af.y-60),Q(af.x,af.y-64),Q(af.x,ty)],34,{seed:32,ruts:1});
 for(const s of af.slots){const T=A.types[s.tk],fy=s.y+T.len/2,ly=s.row>0?af.y+af.lanes[s.row-1]:ty;track(K,[Q(s.x,fy-6),Q(s.x,ly)],24,{seed:33+s.row,ruts:1})}
 /* terra pisada à frente das portas dos hangares */
 for(const g of af.hangars){const hx2=Math.round(X(g.x)),hy2=Math.round(Y(g.y+95));for(let j=-14;j<=18;j++)for(let i=-70;i<=70;i++){const e=(i*i)/(72*72)+(j*j)/(17*17);if(e>1)continue;if(hs(hx2+i,hy2+j,36)<.62*(1-e)+.1){const r=hs(hx2+i,hy2+j,37);c.fillStyle=r<.4?'#6a5e43':r<.8?'#7a6d4e':'#8a7d5e';c.globalAlpha=.8;c.fillRect(hx2+i,hy2+j,1,1);c.globalAlpha=1}}}}
/* desgaste sob cada vaga: capim pisado, mancha de óleo, estacas de amarração */
function slotWear(K){const{c,af,X,Y}=K;
 for(const s of af.slots){const T=A.types[s.tk],cx=X(s.x),cy=Y(s.y),w=T.span*Z*.62,h=T.len*Z*.62;
  for(let j=-h;j<=h;j+=1)for(let i=-w;i<=w;i+=1){const r=(i*i)/(w*w)+(j*j)/(h*h);if(r>1)continue;const px=Math.round(cx+i),py=Math.round(cy+j);if(hs(px,py,40)<.5*(1-r)+.18){c.fillStyle=hs(px,py,41)<.5?'#8a7e5c':'#7c7152';c.globalAlpha=.55;c.fillRect(px,py,1,1);c.globalAlpha=1}}
  const ox=Math.round(cx-1),oy=Math.round(cy+T.len*Z*.1);c.globalAlpha=.55;P(c,ox-1,oy,4,3,'#2c241a');P(c,ox,oy+3,2,2,'#2c241a');c.globalAlpha=1;
  for(const k of[-1,1]){const px=Math.round(cx+k*(T.span*Z/2-3)),py=Math.round(cy-2);P(c,px,py,1,1,'#2a2318');SH(c,px+1,py+1,1,1,.4)}}}

/* ======================================================================================
   ESTRUTURAS
   ====================================================================================== */
function tree(c,x,y,r){x=Math.round(x);y=Math.round(y);SH(c,x-r+2,y-r+3,r*2+1,r*2,.34);for(let j=-r;j<=r;j++)for(let i=-r;i<=r;i++){const q=i*i+j*j;if(q>r*r+.5)continue;c.fillStyle=(i+j<-r*.4)?'#46593a':(i+j>r*.55)?'#27341e':hs(x+i,y+j,50)<.35?'#394a2c':'#33422a';c.fillRect(x+i,y+j,1,1)}
 for(let k=0;k<r*2;k++){const i=Math.round((hs(x,y,51+k)-.5)*r*2),j=Math.round((hs(y,x,52+k)-.5)*r*2);if(i*i+j*j<r*r)P(c,x+i,y+j,1,1,'#5a6e44')}}
function poplar(c,x,y,h=9){x=Math.round(x);y=Math.round(y);SH(c,x+2,y-1,2,h-2,.3);for(let j=0;j<h;j++){const w=j<2||j>h-3?1:2;c.fillStyle=j<h*.4?'#4f6440':'#344a2a';c.fillRect(x,y-j,w,1);if(w===2){c.fillStyle='#27381f';c.fillRect(x+1,y-j,1,1)}}}
/* tenda de campanha redonda (sino): cunhas de lona, mastro central, estacas */
function bell(c,x,y,r,col='#b9ae8a'){x=Math.round(x);y=Math.round(y);SH(c,x-r+2,y-r+3,r*2+1,r*2,.38);for(let j=-r;j<=r;j++)for(let i=-r;i<=r;i++){if(i*i+j*j>r*r+.5)continue;const a=Math.atan2(j,i),k=((a+Math.PI)/TAU*10|0)&1,lit=(i+j<0);c.fillStyle=lit?(k?mixc(col,'#ffffff',.22):mixc(col,'#ffffff',.1)):(k?mixc(col,'#000000',.2):mixc(col,'#000000',.3));c.fillRect(x+i,y+j,1,1)}
 P(c,x,y,1,1,'#3a2f22');for(let a=0;a<8;a++){const px=Math.round(x+Math.cos(a/8*TAU)*(r+2)),py=Math.round(y+Math.sin(a/8*TAU)*(r+2));P(c,px,py,1,1,'#2c2418')}}
/* barraca retangular de cumeeira (marquise): duas águas, abas laterais, porta */
function marquee(c,x,y,w,h,col='#b6ab88'){SH(c,x+3,y+4,w,h,.38);for(let j=0;j<h;j++){const k=j/h;c.fillStyle=k<.5?mixc(col,'#ffffff',.2-k*.3):mixc(col,'#000000',(k-.5)*.7);c.fillRect(Math.round(x),Math.round(y+j),w,1)}
 P(c,x,y+h/2-.5,w,1,mixc(col,'#ffffff',.4));P(c,x,y,1,h,mixc(col,'#000000',.25));P(c,x+w-1,y,1,h,mixc(col,'#000000',.3));P(c,x+w/2-2,y+h-3,4,3,'#2a2620');
 for(let i=0;i<w;i+=6){P(c,x+i,y-1,1,1,'#2c2418');P(c,x+i,y+h,1,1,'#2c2418')}}
/* cabana de madeira de duas águas */
function hut(c,x,y,w,h,roof='#7a4a30',wall='#bba98a'){SH(c,x+3,y+4,w,h,.4);P(c,x,y,w,h,wall);for(let j=0;j<h;j++){const k=j/h;c.fillStyle=k<.5?mixc(roof,'#ffffff',.16-k*.2):mixc(roof,'#000000',(k-.5)*.5);c.fillRect(Math.round(x),Math.round(y+j),w,1)}
 P(c,x,y+h/2-.5,w,1,mixc(roof,'#ffffff',.3));for(let i=0;i<w;i+=3)P(c,x+i,y+1,1,h-2,mixc(roof,'#000000',.12));P(c,x,y,w,1,mixc(roof,'#ffffff',.3));P(c,x,y+h-1,w,1,mixc(roof,'#000000',.45));P(c,x,y,1,h,mixc(roof,'#ffffff',.1));P(c,x+w-1,y,1,h,mixc(roof,'#000000',.4))}
/* barracão Adrian: casco arqueado de chapa ondulada (visto de cima: faixas longitudinais), porta e chaminé */
function adrian(c,x,y,w,h){SH(c,x+3,y+4,w,h,.4);for(let j=0;j<h;j++){const u=(j+.5)/h,tone=u<.5?mixc('#8a8e86','#d2d4cc',(.5-u)*1.4):mixc('#8a8e86','#4a4e48',(u-.5)*1.4);c.fillStyle=tone;c.fillRect(Math.round(x),Math.round(y+j),w,1)}
 for(let i=2;i<w;i+=3)P(c,x+i,y+1,1,h-2,'rgba(30,34,30,.25)');P(c,x,y,w,1,'#cfd2c8');P(c,x,y+h-1,w,1,'#3e423c');P(c,x,y,1,h,'#5e625a');P(c,x+w-1,y,1,h,'#3a3e38');P(c,x+w-3,y+h/2-1,3,3,'#2a2620');P(c,x+4,y+1,2,2,'#2a2a28');SH(c,x+4,y+3,2,1,.3)}
/* lona esticada sobre um tapume (varal de roupa, cobertura de depósito) */
function crate(c,x,y,w,h,col='#8a6d45'){SH(c,x+1,y+1,w,h,.4);slab(c,x,y,w,h,col);if(w>3&&h>3){P(c,x+1,y+h/2,w-2,1,mixc(col,'#000000',.25))}}
function drum(c,x,y,col){x=Math.round(x);y=Math.round(y);SH(c,x,y+1,4,4,.38);for(const[i,j]of[[1,0],[2,0],[0,1],[1,1],[2,1],[3,1],[0,2],[1,2],[2,2],[3,2],[1,3],[2,3]])P(c,x+i,y+j,1,1,(i+j<3)?mixc(col,'#ffffff',.28):(i+j>4)?mixc(col,'#000000',.32):col);P(c,x+1,y+1,1,1,mixc(col,'#ffffff',.5))}
/* latas de gasolina de 4 galões em caixotes: pilhas de quadrados claros */
function tins(c,x,y,nx,ny){SH(c,x+2,y+2,nx*4,ny*4,.36);for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const px=x+i*4,py=y+j*4;P(c,px,py,4,4,'#9a8b62');P(c,px,py,4,1,'#c4b584');P(c,px,py+3,4,1,'#5e5438');P(c,px+1,py+1,2,2,'#7a6c48');P(c,px+1,py+1,1,1,'#c9532f')}}
/* sacos de areia em arco (ninho de metralhadora, taludes) */
function sandbags(c,cx,cy,r,gap=0){for(let a=0;a<TAU;a+=.28){const aa=a-gap;if(gap&&Math.abs(((a+Math.PI)%TAU)-Math.PI)<gap)continue;const x=Math.round(cx+Math.cos(a)*r),y=Math.round(cy+Math.sin(a)*r*.82);SH(c,x,y+1,3,2,.4);P(c,x,y,3,2,((a*7|0)&1)?'#a99a72':'#b9aa82');P(c,x,y,3,1,'#cfc29a')}}
/* caminhão visto de cima (frente para a direita se dir>0) */
function lorry(c,x,y,dir,team,len=26){x=Math.round(x);y=Math.round(y);const col=team?'#5a6050':'#69703f',canvas=team?'#8a8d7a':'#a9a37a',w=11;SH(c,x+2,y+3,len,w,.4);
 const bx=dir>0?x:x+9,cabx=dir>0?x+len-9:x;
 P(c,bx,y,len-9,w,canvas);for(let i=2;i<len-9;i+=4)P(c,bx+i,y+1,1,w-2,mixc(canvas,'#000000',.2));P(c,bx,y,len-9,1,mixc(canvas,'#ffffff',.3));P(c,bx,y+w-1,len-9,1,mixc(canvas,'#000000',.3));
 P(c,cabx,y+1,9,w-2,col);P(c,cabx,y+1,9,1,mixc(col,'#ffffff',.25));P(c,cabx+(dir>0?5:1),y+2,3,w-4,'#3a4650');P(c,cabx+(dir>0?5:1),y+2,1,w-4,'#7a8a96');
 for(const wy of[y-1,y+w-1]){P(c,bx+2,wy,3,2,'#1a1a18');P(c,cabx+3,wy,3,2,'#1a1a18')}}
function car(c,x,y,dir,team){x=Math.round(x);y=Math.round(y);const col=team?'#4a4e48':'#5a5d3c';SH(c,x+2,y+2,12,6,.4);P(c,x,y,12,6,col);P(c,x,y,12,1,mixc(col,'#ffffff',.25));P(c,x+(dir>0?6:2),y+1,4,4,'#2e3a44');P(c,x+(dir>0?6:2),y+1,1,4,'#6e7e8a');for(const wy of[y-1,y+5]){P(c,x+1,wy,3,1,'#1a1a18');P(c,x+8,wy,3,1,'#1a1a18')}}
function bowser(c,x,y,dir,team){x=Math.round(x);y=Math.round(y);lorry(c,x,y,dir,team,26);const tx=dir>0?x:x+9;for(let j=0;j<9;j++)for(let i=0;i<17;i++){const u=j/9;c.fillStyle=u<.3?'#8b9187':u<.7?'#6f766c':'#4a4f48';c.fillRect(tx+i,y+1+j,1,1)}P(c,tx+2,y+4,13,1,'#aab0a6');P(c,tx+8,y+1,2,2,'#2a2a28');P(c,tx+14,y+3,2,3,'#c9532f')}
function mast(c,x,y,h=18){x=Math.round(x);y=Math.round(y);SH(c,x+2,y,1,h,.3);P(c,x,y-h+8,1,h,'#2e2a22');for(const[dx,dy]of[[-16,-6],[16,-6],[-14,8],[14,8]]){const n=Math.max(Math.abs(dx),Math.abs(dy));for(let i=0;i<=n;i+=2)P(c,x+dx*i/n,y+dy*i/n,1,1,'rgba(20,20,16,.6)');P(c,x+dx,y+dy,1,1,'#2e2a22')}}
function post(c,x,y,h=4){P(c,Math.round(x),Math.round(y-h),1,h,'#3a2f22');SH(c,Math.round(x)+1,Math.round(y),1,1,.35)}
function fence(c,pts,h=3){for(let s=0;s<pts.length-1;s++){const[ax,ay]=pts[s],[bx,by]=pts[s+1],L=hyp(bx-ax,by-ay);for(let t=0;t<L;t+=1){const x=ax+(bx-ax)*t/L,y=ay+(by-ay)*t/L;if(t%14<1)post(c,x,y,h);else if(t%2<1){c.globalAlpha=.55;P(c,x,y-h+1,1,1,'#cfcab8');P(c,x,y-1,1,1,'#cfcab8');c.globalAlpha=1}}}}
function hedge(c,pts,seed=0){for(let s=0;s<pts.length-1;s++){const[ax,ay]=pts[s],[bx,by]=pts[s+1],L=hyp(bx-ax,by-ay);for(let t=0;t<L;t+=1){const x=ax+(bx-ax)*t/L,y=ay+(by-ay)*t/L,r=hs(Math.round(x),Math.round(y),seed+60);P(c,x,y-1,1,3,r<.4?'#2b3a22':r<.8?'#344a2a':'#3f5632');if(r>.93)P(c,x,y-2,1,1,'#546e40')}}}

/* hangar Bessonneau (EUA): abóbada de lona sobre arcos de madeira — vista de cima: costelas, painéis costurados, cumeeira clara, lona remendada e suja de chuva, tirantes e estacas */
function bessonneau(c,x,y,nz=0){const W=110,D=92;SH(c,x+6,y+7,W,D,.44);
 const base=['#bab28f','#ada583','#9f9778','#908969','#7e775c','#6b654d'];
 for(let i=0;i<W;i++){const u=i/(W-1),curve=Math.cos((u-.34)*Math.PI*.95),k=clamp(Math.floor((1-curve)*5.2),0,5);
  for(let j=0;j<D;j++){let col=base[k];const rib=(j+3)%9===0,hi=(j+3)%9===1,seam=(i+4)%15===0;
   if(rib)col=mixc(col,'#000000',.2);else if(hi)col=mixc(col,'#ffffff',.08);else if(seam)col=mixc(col,'#000000',.08);
   const wx=x+i+nz,wy=y+j+nz*.7,mil=vn(wx/9,wy/23,75),streak=vn(wx/2.2,wy/40,76);
   if(mil>.62)col=mixc(col,'#59623a',.12+.12*(mil-.62)*3);if(streak>.7&&j>8)col=mixc(col,'#000000',.08);if(j<5)col=mixc(col,'#000000',.07);
   const r=hs(wx,wy,70);if(r<.045)col=mixc(col,'#ffffff',.1);else if(r>.965)col=mixc(col,'#000000',.1);c.fillStyle=col;c.fillRect(x+i,y+j,1,1)}}
 /* cumeeira, remendos de lona nova, costuras de corda */
 P(c,x+W*.42,y,2,D,'#cfc7a4');P(c,x+W*.42+2,y,1,D,'#9a9272');P(c,x,y,W,1,'#cfc7a4');
 for(const[px,py,w,h,t]of[[W*.16,D*.28,13,9,.5],[W*.62,D*.5,11,12,.4],[W*.33,D*.68,15,8,.55],[W*.78,D*.2,9,8,.3]]){for(let j=0;j<h;j++)for(let i=0;i<w;i++){c.fillStyle=mixc('#d6cda8','#9b926f',t+hs(i,j,77)*.12);c.fillRect(Math.round(x+px+i),Math.round(y+py+j),1,1)}P(c,x+px,y+py,w,1,'#6f684d');P(c,x+px,y+py+h-1,w,1,'#6f684d');P(c,x+px,y+py,1,h,'#6f684d');P(c,x+px+w-1,y+py,1,h,'#6f684d')}
 /* empena sul: beiral, vergas e porta de correr aberta */
 P(c,x,y+D-3,W,3,'#5d563f');P(c,x,y+D-3,W,1,'#7e775a');
 P(c,x+9,y+D-17,W-18,15,'#17150f');P(c,x+9,y+D-17,W-18,2,'#3a362a');P(c,x+9,y+D-3,W-18,1,'#2a2820');
 for(let i=0;i<W-18;i+=11)P(c,x+9+i,y+D-17,1,15,'#2a2820');
 for(const sd of[0,1]){const px=sd?x+W-18:x+3;P(c,px,y+D-17,15,16,'#a89e79');P(c,px,y+D-17,15,1,'#c9bf9a');for(let q=0;q<15;q+=4)P(c,px+q,y+D-16,1,15,'#7a7152');P(c,px+(sd?14:0),y+D-17,1,16,'#4a4430');P(c,px,y+D-2,15,1,'#4a4430')}
 /* tirantes e estacas dos dois lados */
 for(let k=0;k<5;k++){const py=y+7+k*17;for(const sd of[-1,1]){const bx=sd<0?x:x+W,ex=bx+sd*11;for(let t=0;t<=11;t+=1)P(c,bx+sd*t,py+t*.62,1,1,'rgba(26,22,14,.75)');P(c,ex,py+7,1,2,'#3a2f22');P(c,ex-(sd>0?0:0),py+9,1,1,'rgba(10,12,8,.4)')}}
 for(const[bx,by]of[[x-2,y-1],[x+W+1,y-1]])P(c,bx,by,1,3,'#3a2f22')}
/* galpão de madeira alemão: duas águas de papel alcatroado com camuflagem de manchas, empena sul com porta de correr, anexo de oficina e exaustor */
function flughalle(c,x,y,nz=0){const W=118,D=96;SH(c,x+6,y+7,W,D,.44);
 for(let j=0;j<D;j++)for(let i=0;i<W;i++){const west=i<W/2,wx=x+i+nz,wy=y+j+nz*.7,r=hs(wx,wy,72),strip=(j+2)%5===0,seam=(i+3)%11===0;let col=west?'#7a6850':'#574936';
  const cam=vn(wx/12,wy/10,73),cam2=vn(wx/5,wy/6,74);if(cam<.36)col=west?'#5f6c45':'#46523a';else if(cam>.7)col=west?'#463d33':'#352d26';if(cam2>.78)col=mixc(col,'#000000',.1);
  if(strip)col=mixc(col,'#000000',.24);else if((j+2)%5===1)col=mixc(col,'#ffffff',.06);if(seam)col=mixc(col,'#000000',.08);
  if(j<4)col=mixc(col,'#000000',.1);if(r<.05)col=mixc(col,'#ffffff',.08);else if(r>.97)col=mixc(col,'#000000',.1);c.fillStyle=col;c.fillRect(x+i,y+j,1,1)}
 P(c,x+W/2-1,y,3,D,'#241f19');P(c,x+W/2-2,y,1,D,'#9a8a6a');P(c,x,y,W,1,'#a89878');P(c,x,y,1,D,'#8a7a5c');P(c,x+W-1,y,1,D,'#241f19');P(c,x,y+D-3,W,3,'#3a3226');P(c,x,y+D-3,W,1,'#6a5e48');
 P(c,x+9,y+D-18,W-18,16,'#14120d');for(let i=0;i<W-18;i+=6)P(c,x+9+i,y+D-18,1,16,'#2e2a20');P(c,x+9,y+D-18,W-18,2,'#4a4434');P(c,x+9,y+D-3,W-18,1,'#2a2820');
 for(const sd of[0,1]){const px=sd?x+W-22:x+5;P(c,px,y+D-18,15,17,'#6e5f44');for(let q=0;q<15;q+=3)P(c,px+q,y+D-17,1,16,'#4a3e2c');P(c,px,y+D-18,15,1,'#8a7a5c')}
 /* exaustor de ventilação e chaminé da oficina */
 P(c,x+W-30,y+16,7,7,'#767268');P(c,x+W-30,y+16,7,1,'#a39f92');P(c,x+W-30,y+22,7,1,'#403d36');P(c,x+W-28,y+10,3,6,'#3a3630');P(c,x+W-28,y+10,3,1,'#6a665c');
 for(let k=0;k<3;k++)P(c,x+W-27+k,y+6-k*3,2,2,'rgba(190,190,180,'+(.34-.1*k)+')');
 hut(c,x+W,y+D-36,22,34,'#5e5446','#8a7e66')}
/* entulho e material de apoio à frente dos hangares: tambores, caixotes, motor num cavalete, hélices encostadas, bancada, escada, lona estendida */
function clutter(K,g){const{c,X,Y,team,sg}=K,hx=Math.round(X(g.x)),hy=Math.round(Y(g.y)),W=team?118:110,D=team?96:92,fx=hx-W/2,fy=hy-D/2+D+3;
 const r=hs(Math.round(g.x),Math.round(g.y),120);
 for(let j=0;j<2;j++)for(let i=0;i<3;i++)drum(c,fx-12+i*5,fy+2+j*5,['#4a5a3a','#7a3a2a','#4a4e56'][(i+j+Math.round(r*3))%3]);
 crate(c,fx+W+4,fy+1,8,6);crate(c,fx+W+4,fy+8,8,5,'#7a5e3a');crate(c,fx+W+13,fy+3,6,6,'#9a7d52');
 /* motor num cavalete, coberto por lona */
 slab(c,fx+W*.2,fy+3,10,5,'#6e5a3a');P(c,fx+W*.2+1,fy-2,8,5,'#59603e');P(c,fx+W*.2+1,fy-2,8,1,'#7a8250');P(c,fx+W*.2+3,fy,2,2,'#2a2620');
 /* hélices encostadas e escada */
 for(let k=0;k<3;k++){const px=fx+W*.62+k*3;for(let t=0;t<9;t++)P(c,px+t*.3,fy+9-t,1,1,k&1?'#8a5a30':'#6e4a28')}
 for(let t=0;t<10;t++){P(c,fx+W*.78-0,fy+9-t,1,1,'#7a5e3a');P(c,fx+W*.78+4,fy+9-t,1,1,'#7a5e3a');if(t%3===0)P(c,fx+W*.78,fy+9-t,5,1,'#6a4e2e')}
 /* lona estendida no chão com peças de asa */
 SH(c,fx+W*.4+2,fy+8,18,7,.28);P(c,fx+W*.4,fy+6,18,7,'#8f8760');P(c,fx+W*.4,fy+6,18,1,'#b3aa7d');for(let k=0;k<18;k+=4)P(c,fx+W*.4+k,fy+7,1,5,'#6e6648')}
const HCACHE=[[],[]];
function hangarAt(K,g){const{c,X,Y,team}=K,hx=Math.round(X(g.x)),hy=Math.round(Y(g.y)),v=(Math.round(g.x/100)&1);
 if(!HCACHE[team][v]){const pad=16,cv=mk(160,130),cc=cv.getContext('2d');if(team)flughalle(cc,pad,pad,v*173);else bessonneau(cc,pad,pad,v*173);HCACHE[team][v]={cv,pad}}
 const H=HCACHE[team][v];c.drawImage(H.cv,hx-(team?59:55)-H.pad,hy-(team?48:46)-H.pad);clutter(K,g)}
/* barraca de operações: cabana de comando com mastro de rádio, mastro de bandeira, mesa de sinais e tendas de pilotos */
function opsPost(K){const{c,af,X,Y,team,sg}=K,ox=Math.round(X(af.ops.x)),oy=Math.round(Y(af.ops.y));
 hut(c,ox-20,oy-12,40,24,team?'#5a4a3a':'#7a4a30',team?'#a89d86':'#bba98a');P(c,ox-4,oy+4,8,8,'#2a2620');P(c,ox+10,oy-3,6,5,'#2e3a44');P(c,ox-16,oy-3,6,5,'#2e3a44');P(c,ox+6,oy-14,3,4,'#6e6a5e');P(c,ox+6,oy-17,2,3,'#9a968a');
 mast(c,ox+sg*34,oy-6,20);
 /* mastro de bandeira (a bandeira é animada pelo airwar-view) */
 P(c,ox+sg*26-1,oy+9,3,2,'#6e6a5e');
 for(let i=0;i<3;i++)bell(c,ox+sg*(-10+i*18),oy+36+(i&1)*6,7,team?'#9a9a82':'#b9ae8a');
 /* mesa de sinais com painéis de lona */
 slab(c,ox-34,oy+14,10,6,'#8a6d45');P(c,ox-33,oy+15,3,2,'#f0ece0');P(c,ox-29,oy+15,3,2,'#c9532f');
 car(c,ox+sg*26,oy+22,sg,team)}
/* depósito de combustível e óleo: latas, tambores, cisterna; depósito de bombas e munição atrás de taludes */
function dumps(K){const{c,af,X,Y,team,sg}=K,fx=Math.round(X(af.truck.x)),fy=Math.round(Y(af.truck.y));
 tins(c,fx-34,fy-14,6,3);tins(c,fx-34,fy+2,6,2);for(let j=0;j<3;j++)for(let i=0;i<5;i++)drum(c,fx-4+i*5,fy-14+j*5,['#4a5a3a','#7a3a2a','#4a4e56'][(i+j)%3]);
 P(c,fx-36,fy-16,26,1,'rgba(10,12,8,.28)');bowser(c,fx-12,fy+16,-sg,team);
 /* talude de terra em U com caixotes de bomba */
 const bx=Math.round(X(af.dump.x)),by=Math.round(Y(af.dump.y));for(let j=-14;j<=14;j++)for(let i=-18;i<=18;i++){const e=Math.abs(i)>14||j<-9||j>11;if(!e||j>11&&Math.abs(i)<12)continue;const r=hs(bx+i,by+j,80);c.fillStyle=r<.3?'#5e5238':r<.7?'#6e6244':'#7d7152';c.fillRect(bx+i,by+j,1,1)}
 for(let j=0;j<3;j++)for(let i=0;i<6;i++){P(c,bx-12+i*4,by-6+j*5,3,4,'#3f4638');P(c,bx-12+i*4,by-6+j*5,3,1,'#6a725e');P(c,bx-12+i*4,by-5+j*5,1,1,'#c9a53f')}}
/* ninho de metralhadora antiaérea: anel de sacos de areia, tripé com o fuzil-metralhadora, caixa de munição, sentinela */
function aaNest(c,x,y,team){x=Math.round(x);y=Math.round(y);P(c,x-6,y-5,13,11,'rgba(54,46,30,.55)');sandbags(c,x,y,6,0);P(c,x-1,y-1,3,3,'#3a3d3a');P(c,x,y-3,1,5,'#20231f');P(c,x-4,y+1,3,2,'#4a5a3a');P(c,x+3,y-1,2,2,'#7a6c48')}
/* o acampamento da retaguarda */
function camp(K){const{c,af,X,Y,team,sg}=K,cx=Math.round(X(af.x-sg*1135)),cy=Math.round(Y(af.y-480));
 /* clareira de terra e vala de drenagem */
 for(let j=-110;j<=100;j++)for(let i=-130;i<=130;i++){const e=(i*i)/(130*130)+(j*j)/(105*105);if(e>1)continue;if(hs(cx+i,cy+j,90)<.55*(1-e)+.1){c.fillStyle=hs(cx+i,cy+j,91)<.5?'#76694b':'#6a5e43';c.globalAlpha=.7;c.fillRect(cx+i,cy+j,1,1);c.globalAlpha=1}}
 for(let k=0;k<4;k++)adrian(c,cx-100+(k&1)*0,cy-90+k*24,56,15);                              // barracões dos praças e oficiais
 hut(c,cx-30,cy-76,50,22,team?'#5a4a3a':'#7a4a30',team?'#a89d86':'#bba98a');P(c,cx+10,cy-82,3,6,'#6e6a5e');                 // refeitório
 for(let k=0;k<3;k++)P(c,cx+10+k,cy-86-k*3,2,2,'rgba(200,200,190,'+(.4-.1*k)+')');
 marquee(c,cx+30,cy-72,26,14,team?'#9a9a82':'#b6ab88');P(c,cx+50,cy-76,3,4,'#3a3d3a');                                      // cozinha de campanha
 for(let k=0;k<5;k++){bell(c,cx-82+k*20,cy+18+(k&1)*5,7,team?'#9a9a82':'#b9ae8a')}
 /* varal de roupa */
 for(let i=0;i<46;i+=1)if(i%3<2)P(c,cx+20+i,cy+16,1,1,'rgba(40,36,28,.6)');for(let k=0;k<7;k++)P(c,cx+22+k*6,cy+17,3,4,k%3?'#d8d2bf':'#9aa08a');post(c,cx+20,cy+20,5);post(c,cx+66,cy+20,5);
 /* latrina, banheiro, poço, lenha, carroça-pipa */
 hut(c,cx+60,cy+30,10,8,'#4e4a3a','#7a7058');hut(c,cx+74,cy+30,8,8,'#4e4a3a','#7a7058');
 for(let j=0;j<3;j++)for(let i=0;i<8;i++)P(c,cx-20+i*3,cy+36+j*2,3,2,(i+j)&1?'#8a6238':'#6a4a2a');
 lorry(c,cx-60,cy+52,1,team);lorry(c,cx-24,cy+52,1,team);car(c,cx+14,cy+54,1,team);
 for(let k=0;k<3;k++)tree(c,cx-124+k*4,cy-60+k*34,5+k%2)}
function perimeter(K){const{c,af,X,Y,team,sg}=K,x0=X(af.x-895),x1=X(af.x+895),y0=Math.max(2,Y(af.y-975)),y1=Y(af.y+262),gate=X(af.x+sg*420);
 /* cerca viva e arame farpado ao redor; portão e estrada de terra ao sul */
 hedge(K.c,[[x0,y1],[gate-18,y1]],1);hedge(c,[[gate+18,y1],[x1,y1]],2);hedge(c,[[x0,y0+40],[x0,y1]],3);hedge(c,[[x1,y0+40],[x1,y1]],4);
 fence(c,[[x0+6,y1-5],[gate-24,y1-5]]);fence(c,[[gate+24,y1-5],[x1-6,y1-5]]);fence(c,[[x0+6,y0+40],[x0+6,y1-5]]);fence(c,[[x1-6,y0+40],[x1-6,y1-5]]);
 for(let u=x0;u<x1;u+=22){if(Math.abs(u-gate)<30)continue;if(hs(u|0,1,95)<.5)poplar(c,u+hs(u|0,2,96)*8,y1+3,9+hs(u|0,3,97)*5)}
 for(let v=y0+60;v<y1;v+=24){if(hs(v|0,4,98)<.5)poplar(c,x0-2,v,9+hs(v|0,5,99)*5);if(hs(v|0,6,100)<.5)poplar(c,x1+3,v,9+hs(v|0,7,101)*5)}
 /* portão com guarita */
 P(c,gate-16,y1-9,2,9,'#3a2f22');P(c,gate+14,y1-9,2,9,'#3a2f22');P(c,gate-16,y1-9,7,1,'#5a4a36');P(c,gate+9,y1-9,7,1,'#5a4a36');hut(c,gate+20,y1-14,9,9,'#4e4a3a','#8a7e66');
 track(K,[[gate,y1+30],[gate,y1-4],[gate-6,y1-60]],26,{seed:110});
 /* postes de telefone até a barraca de operações */
 const ox=X(af.ops.x);for(let k=0;k<9;k++){const px=ox+sg*28+sg*k*0,py=Y(af.ops.y)+30+k*22;post(c,ox+sg*36,py,8)}}
function windSock(K){const{c,af,X,Y}=K,px=Math.round(X(af.x+af.dir*af.half*.82)),py=Math.round(Y(af.y+af.w/2+40));SH(c,px+2,py+1,2,2,.4);P(c,px,py-9,1,10,'#2a2620');P(c,px-1,py-10,3,1,'#6e6a5e')}

S.paint=function(c,af,x0){const t0=performance.now(),team=af.team,sg=team?-1:1,K={c,af,x0,team,sg,X:v=>(v-x0)*Z,Y:v=>v*Z},st=S.stats.steps=S.stats.steps||{};
 const step=(n,f)=>{const t=performance.now();f();st[n]=+((st[n]||0)+performance.now()-t).toFixed(1)};
 step('campo',()=>fieldBase(K));step('taxi',()=>taxiways(K));step('faixa',()=>strip(K));step('vagas',()=>slotWear(K));step('sinais',()=>signals(K));
 step('acampamento',()=>camp(K));step('depositos',()=>dumps(K));step('hangares',()=>{for(const g of af.hangars)hangarAt(K,g)});step('operacoes',()=>opsPost(K));
 /* ninhos antiaéreos nos cantos do campo e junto aos hangares */
 for(const[ux,uy]of[[af.x-sg*820,af.y+190],[af.x+sg*820,af.y+190],[af.x+sg*840,af.y-780],[af.x-sg*860,af.y-780]])aaNest(c,K.X(ux),K.Y(uy),team);
 step('cerca',()=>perimeter(K));windSock(K);
 /* caminhões estacionados junto aos hangares */
 lorry(c,K.X(af.x-380),K.Y(af.y-790),1,team);lorry(c,K.X(af.x+380),K.Y(af.y-790),-1,team);
 S.stats.ms+=performance.now()-t0};
if(window.IronFront)window.IronFront.airfieldArt=S;
})();
