'use strict';
/* Iron Front 1.12 — desenho da guerra aérea (airwar-view.js). Carrega DEPOIS do airwar.js. Só visual/câmera; a simulação é do airwar.js
   e os aviões em si são desenhados pelo anim-air.js (fonte 'd').
   Retaguarda ...... o espaço aéreo além das bordas do mapa ganha chão: lavouras em retalhos (pasto, terra arada com sulcos, trigo,
                     pousio), cercas vivas, estradas de terra que continuam as do mapa ladeadas de choupos, bosques e uma aldeia com
                     igreja. Gerado uma vez por partida em canvas próprio (sem custo por quadro).
   Aeródromo ....... o fundo do campo é do airfield-art.js (faixa, táxi, hangares, apoio, acampamento) e a vida (pessoas, hélice, poeira) do airfield-life.js;
                     aqui ficam a biruta que segue o vento real e a bandeira da nação. O desenho antigo (airfield()) só entra se o airfield-art.js faltar.
   No ar ........... traçantes (1 em cada 3 projéteis), faíscas e lascas onde o tiro acerta, estouros de antiaérea ("Archie": preto
                     alemão, branco aliado) com clarão, tudo na altura certa (deslocado como o avião, sombra no chão).
   Câmera aérea .... L segue o combate mais quente e, a cada toque, o próximo avião interessante; Shift+L volta ao comando. A câmera
                     pode sair do mapa (aeródromos). Legenda com piloto, avião, vitórias e o que está fazendo.
   Teatro aéreo .... Y mostra/esconde o mapa do teatro (mapa terrestre, frente, aeródromos, aviões, câmera); clique leva a câmera.
   ?guerraaerea=0 desliga tudo junto com o airwar.js · PXAWV.state() */
(function(){
const A=window.PXAW;if(!A||!window.PX)return;
const PX=window.PX,Z=PX.Z||.5,TAU=Math.PI*2,hyp=Math.hypot,clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t,rnd=(a,b)=>a+Math.random()*(b-a);
const SHX=14,SHY=22;                                         // sombra a altura visual 1 (igual ao anim-air)
const V=window.PXAWV={on:A.on,stats:{errors:0,rearMs:0,drawMs:0},cam:{on:false,tgt:null,idx:-1,free:null},map:{show:false}};
let errs=0;function fail(e){V.stats.errors++;if(++errs<=3)console.error('airwar-view.js:',e);if(errs>=12){V.on=false;console.error('airwar-view.js desligado após erros repetidos')}}
const hsh=(x,y,s)=>{let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(s|0,1442695041))|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296};
function vn(x,y,s){const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);return lerp(lerp(hsh(xi,yi,s),hsh(xi+1,yi,s),u),lerp(hsh(xi,yi+1,s),hsh(xi+1,yi+1,s),u),v)}
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const altv=a=>Math.max(0,a.h||0)/(A.cfg.ALTV||900);

/* ======================================================================================
   RETAGUARDA: lavouras, cercas, estradas, bosques, aldeia e o aeródromo (canvas por lado, em pixels de arte)
   ====================================================================================== */
const PAL={grass:['#4b5631','#535f36','#5b673b','#46502e'],plough:['#5e4b33','#6b563a','#544230'],wheat:['#8f8650','#9c9259','#857c49'],fallow:['#646a3f','#6e7346','#5a6038'],
 hedge:'#2e3a22',hedgeH:'#3f4e2c',tree:['#2c3a22','#36472a','#46593a'],road:['#7a6a4c','#6a5c42','#8a7a58'],roof:['#8a3d2c','#a24a34','#6d3023'],slate:['#4b4f55','#5d626a'],wall:['#bfb39a','#a89d86'],
 strip:['#6f7b45','#677340'],track:'#5b5f37',canvas:['#a99f7c','#968c6b','#bdb38f','#7f765a'],dark:'#1d1f18',ink:'#15130f'};
let REAR=[null,null],REARX=[0,0],built=false;
function rect(x,X,Y,w,h,c){x.fillStyle=c;x.fillRect(Math.round(X),Math.round(Y),Math.round(w),Math.round(h))}
function buildRear(only){const t0=performance.now(),TH=A.theatre(),AF=A.airfields();if(!AF[0])return;
 for(let side=0;side<2;side++){if(only!=null&&side!==only)continue;const x0=side?W:TH.x0,x1=side?TH.x1:0,w=Math.ceil((x1-x0)*Z),h=Math.ceil(H*Z),c=mk(w,h),x=c.getContext('2d'),seed=side*977+13;
  REARX[side]=x0;const af=AF[side],B=af.box||{x0:af.x-680,x1:af.x+680,y0:af.y-860,y1:af.y+150};   // área do aeródromo
  const inAF=(px,py,m=0)=>{const wx=px/Z+x0,wy=py/Z;return wx>B.x0-m/Z&&wx<B.x1+m/Z&&wy>B.y0-m/Z&&wy<B.y1+m/Z};
  /* base: ladrilho de capim periódico (gerado uma vez) repetido */
  x.fillStyle=x.createPattern(grassTile(),'repeat');x.fillRect(0,0,w,h);
  /* lavouras: retalhos por subdivisão */
  const fields=[];(function split(X,Y,FW,FH,dp){if(dp>5||FW<70&&FH<70||(dp>2&&hsh(X,Y,seed+dp)<.25)){fields.push([X,Y,FW,FH]);return}
   if(FW>FH){const s=FW*(.35+.3*hsh(X,Y,seed+7));split(X,Y,s,FH,dp+1);split(X+s,Y,FW-s,FH,dp+1)}else{const s=FH*(.35+.3*hsh(Y,X,seed+9));split(X,Y,FW,s,dp+1);split(X,Y+s,FW,FH-s,dp+1)}})(0,0,w,h,0);
  for(const [X,Y,FW,FH] of fields){if(inAF(X+FW/2,Y+FH/2,40))continue;const r=hsh(X|0,Y|0,seed+3),kind=r<.34?'plough':r<.58?'wheat':r<.78?'fallow':'grass';if(kind==='grass')continue;
   const P=PAL[kind],vert=hsh(Y|0,X|0,seed+5)<.5;rect(x,X+2,Y+2,FW-4,FH-4,P[0]);
   for(let k=0;vert?k<FW-4:k<FH-4;k+=kind==='plough'?2:3){const c2=P[(k/(kind==='plough'?2:3)|0)%2?1:2];if(vert)rect(x,X+2+k,Y+2,1,FH-4,c2);else rect(x,X+2,Y+2+k,FW-4,1,c2)}
   if(kind==='wheat')for(let n=0;n<FW*FH/90;n++){const px=X+2+hsh(n,X|0,seed)*(FW-4),py=Y+2+hsh(n,Y|0,seed+1)*(FH-4);rect(x,px,py,1,1,'#b3a86a')}}
  /* cercas vivas nas divisas (com árvores) */
  for(const [X,Y,FW,FH] of fields){if(inAF(X+FW/2,Y+FH/2,60))continue;if(hsh(X|0,Y|0,seed+11)<.45)continue;
   for(let i=0;i<FW;i++){if(inAF(X+i,Y))continue;rect(x,X+i,Y,1,2,PAL.hedge);if(hsh(X+i|0,Y|0,seed)<.08)tree(x,X+i,Y,2+hsh(i,Y|0,seed)*2)}
   for(let j=0;j<FH;j++){if(inAF(X,Y+j))continue;rect(x,X,Y+j,2,1,PAL.hedge);if(hsh(X|0,Y+j|0,seed+2)<.08)tree(x,X,Y+j,2+hsh(j,X|0,seed)*2)}}
  /* bosques */
  for(let b=0;b<5;b++){const bx=hsh(b,1,seed)*w,by=hsh(b,2,seed)*h,br=18+hsh(b,3,seed)*30;if(inAF(bx,by,br+40))continue;for(let n=0;n<br*br/6;n++){const a=hsh(n,b,seed)*TAU,rr=Math.sqrt(hsh(b,n,seed))*br;tree(x,bx+Math.cos(a)*rr,by+Math.sin(a)*rr*.8,2+hsh(n,n,seed)*2.5)}}
  /* estradas: continuam as do mapa, com choupos */
  const ROADS=[185,400,610].map(v=>v*H/1600);
  for(let j2=0;j2<ROADS.length;j2++){const ry=ROADS[j2];for(let i=0;i<w;i++){const yy=ry+Math.sin((i+(side?0:w))/55+j2*2)*3.2+Math.sin(i/170+j2)*6*(side?i/w:1-i/w);
    if(inAF(i,yy,6))continue;                                                       // a estrada contorna o aeródromo
    rect(x,i,yy-3,1,7,PAL.road[1]);rect(x,i,yy-2,1,5,PAL.road[0]);if(hsh(i,j2,seed)<.5)rect(x,i,yy-1,1,1,PAL.road[1]);if(hsh(i,j2+9,seed)<.5)rect(x,i,yy+1,1,1,PAL.road[2]);
    if(i%9===0&&!inAF(i,yy,20)){poplar(x,i,yy-6);poplar(x,i,yy+7)}}}
  /* aldeia com igreja ao longo da estrada do meio */
  {const vy=ROADS[1],vx0=side?w*.62:w*.3;for(let n=0;n<11;n++){const hx=vx0+(n%6)*15+hsh(n,7,seed)*6-40,hy=vy+(n<6?-16:10)+hsh(n,8,seed)*4;if(inAF(hx,hy,30))continue;house(x,hx,hy,hsh(n,9,seed))}
   if(!inAF(vx0+40,vy-30,30))church(x,vx0+40,vy-30)}
  /* o aeródromo */
  if(window.PXAFA&&PXAFA.on)PXAFA.paint(x,af,x0);else airfield(x,af,x0);
  REAR[side]=c}
 if(only==null||REAR[0]&&REAR[1])built=true;V.stats.rearMs=(V.stats.rearMs||0)+Math.round(performance.now()-t0)}
let GT=null;
function grassTile(){if(GT)return GT;const N=256,c=mk(N,N),x=c.getContext('2d'),img=x.createImageData(N,N),d=img.data,G=PAL.grass.map(hex);
 const vw2=(X,Y,s,P)=>{const xi=Math.floor(X),yi=Math.floor(Y),fx=X-xi,fy=Y-yi,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),a=(xi%P+P)%P,b=(yi%P+P)%P,a1=(a+1)%P,b1=(b+1)%P;return lerp(lerp(hsh(a,b,s),hsh(a1,b,s),u),lerp(hsh(a,b1,s),hsh(a1,b1,s),u),v)};
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const n=vw2(i/32,j/32,5,8)*.6+vw2(i/8,j/8,6,32)*.4,k=n<.35?3:n<.55?0:n<.75?1:2,col=G[(hsh(i,j,7)<.08)?2:k],o=(j*N+i)*4;d[o]=col[0];d[o+1]=col[1];d[o+2]=col[2];d[o+3]=255}
 x.putImageData(img,0,0);GT=c;return c}
const TREE=new Map();
function treeSpr(r){r=Math.round(Math.max(1.5,r)*2)/2;let c=TREE.get(r);if(c)return c;const n=Math.ceil(r)*2+4;c=mk(n,n);const x=c.getContext('2d'),o=Math.ceil(r)+1;
 x.fillStyle='rgba(10,14,8,.35)';x.fillRect(o-r+1,o-r+1,Math.round(r*1.6)+1,Math.round(r*1.4)+1);
 for(let j=-Math.ceil(r);j<=Math.ceil(r);j++)for(let i=-Math.ceil(r);i<=Math.ceil(r);i++){if(i*i+j*j>r*r+.5)continue;x.fillStyle=i+j<-r*.5?PAL.tree[2]:i+j>r*.5?PAL.tree[0]:PAL.tree[1];x.fillRect(o+i,o+j,1,1)}
 c.o=o;TREE.set(r,c);return c}
function hex(h){const n=parseInt(h.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255]}
function tree(x,X,Y,r){const s=treeSpr(r);x.drawImage(s,Math.round(X)-s.o,Math.round(Y)-s.o)}
function poplar(x,X,Y){rect(x,X+1,Y,2,2,'rgba(10,14,8,.35)');rect(x,X,Y-4,2,5,PAL.tree[1]);rect(x,X,Y-4,1,4,PAL.tree[2]);rect(x,X+1,Y-1,1,2,PAL.tree[0])}
function house(x,X,Y,r){const roof=r<.6?PAL.roof:PAL.slate;rect(x,X+1,Y+1,10,7,'rgba(10,10,8,.4)');rect(x,X,Y,10,7,PAL.wall[0]);rect(x,X,Y,10,4,roof[0]);rect(x,X,Y,10,1,roof[1]||roof[0]);rect(x,X,Y+3,10,1,roof[2]||roof[0]);rect(x,X+2,Y+5,2,2,PAL.dark);rect(x,X+6,Y+5,2,1,'#6a5f50')}
function church(x,X,Y){rect(x,X+1,Y+1,16,11,'rgba(10,10,8,.4)');rect(x,X,Y,16,10,PAL.wall[1]);rect(x,X,Y,16,5,PAL.slate[0]);rect(x,X,Y,16,1,PAL.slate[1]);rect(x,X+11,Y-6,5,6,PAL.wall[0]);rect(x,X+12,Y-9,3,3,PAL.slate[0]);rect(x,X+13,Y-11,1,2,PAL.slate[1])}
/* aeródromo: pista de grama em faixas, marcas de roda, hangares, barracas, depósitos, casa do comando */
function airfield(x,af,x0){const X=v=>(v-x0)*Z,Yp=v=>v*Z,cx=X(af.x),cy=Yp(af.y),hw=af.half*Z,ww=Math.max(24,(af.w||56)*Z*2);
 /* grama cortada: faixas alternadas na direção da pista */
 for(let i=-hw-30;i<hw+30;i+=6)rect(x,cx+i,cy-ww/2-14,6,ww+28,PAL.strip[((i+hw+30)/6|0)%2]);
 /* marcas de rodas (decolagens e pousos) */
 for(let k=-3;k<=3;k++){const yy=cy+k*3+(k&1);for(let i=-hw;i<hw;i++)if(hsh(i,k,77)<.55)rect(x,cx+i,yy,1,1,PAL.track)}
 /* pátio e caminho de táxi */
 const ty=Yp(af.y-60);for(let i=-hw-10;i<hw+10;i++){if(hsh(i,3,5)<.7)rect(x,cx+i,ty-2,1,4,'#6b6440')}
 for(const s of af.slots){const sx=X(s.x),sy=Yp(s.y);for(let j=sy;j<ty;j++)if(hsh(sx|0,j|0,9)<.6)rect(x,sx-1,j,3,1,'#6b6440');rect(x,sx-9,sy-6,19,13,'#5e6438');rect(x,sx-9,sy-6,19,1,'#69703f')}
 /* hangares Bessonneau (lona sobre arcos de madeira, porta para a pista): ~20 m de vão, 2,5× a envergadura de um caça */
 for(const g of af.hangars){const hx=X(g.x),hy=Yp(g.y),HW=104,HH=58;rect(x,hx-HW/2+4,hy-HH/2+5,HW,HH,'rgba(10,12,8,.4)');
  for(let i=0;i<HW;i++){const rib=i%9===0;for(let j=0;j<HH;j++){const ed=j<2||j>HH-3,c=rib?PAL.canvas[3]:ed?PAL.canvas[1]:j<HH*.35?PAL.canvas[2]:PAL.canvas[0];x.fillStyle=c;x.fillRect(Math.round(hx-HW/2+i),Math.round(hy-HH/2+j),1,1)}}
  rect(x,hx-HW/2,hy-HH/2,HW,1,PAL.canvas[2]);rect(x,hx-HW/2,hy-1,HW,1,PAL.canvas[3]);rect(x,hx-30,hy+HH/2-3,60,4,PAL.dark);rect(x,hx-30,hy+HH/2-4,60,1,'#3a3628');
  for(let k=-1;k<=1;k+=2)rect(x,hx+k*31,hy+HH/2-4,2,5,'#6b5433')}
 /* barracas, casa do comando, depósitos */
 for(const t of af.tents){const tx=X(t.x),ty2=Yp(t.y);rect(x,tx-9,ty2-4,20,13,'rgba(10,12,8,.4)');rect(x,tx-10,ty2-7,19,12,PAL.canvas[0]);rect(x,tx-10,ty2-7,19,4,PAL.canvas[2]);rect(x,tx-1,ty2-7,1,12,PAL.canvas[3]);rect(x,tx-3,ty2+3,4,2,PAL.dark)}
 {const q=af.hq||{x:af.x+590,y:af.y-600},hx=X(q.x)-14,hy=Yp(q.y)-9;rect(x,hx+2,hy+2,30,19,'rgba(10,10,8,.4)');rect(x,hx,hy,30,18,PAL.wall[0]);rect(x,hx,hy,30,8,PAL.roof[0]);rect(x,hx,hy,30,1,PAL.roof[1]);rect(x,hx,hy+7,30,1,PAL.roof[2]);rect(x,hx+5,hy+12,4,4,PAL.dark);rect(x,hx+20,hy+12,4,3,'#6a5f50');rect(x,hx+13,hy+11,4,7,'#5a4a36')}
 {const q=af.dump||{x:af.x-600,y:af.y-600},dx=X(q.x)-12,dy=Yp(q.y)-8;rect(x,dx-3,dy-3,34,20,'#6b6440');for(let n=0;n<15;n++){const bx=dx+(n%5)*4,by=dy+((n/5)|0)*4;rect(x,bx+1,by+1,3,3,'rgba(10,10,8,.4)');rect(x,bx,by,3,3,'#3e4a3a');rect(x,bx,by,1,1,'#6e7a6a')}for(let n=0;n<6;n++){rect(x,dx+22+(n%2)*5,dy+((n/2)|0)*4,4,3,'#6b5433');rect(x,dx+22+(n%2)*5,dy+((n/2)|0)*4,4,1,'#8a6d45')}}
 /* caminhão de combustível */
 {const q=af.truck||{x:af.x-560,y:af.y-420},fx=X(q.x),fy=Yp(q.y);rect(x,fx+1,fy+1,12,6,'rgba(10,10,8,.45)');rect(x,fx,fy,12,5,af.team?'#4f5559':'#4d5534');rect(x,fx+8,fy,4,5,af.team?'#3c4246':'#3b4228');rect(x,fx+1,fy+1,6,3,af.team?'#6a7276':'#66704a')}}

/* ======================================================================================
   ANIMADOS DO AERÓDROMO: biruta, bandeira, mecânicos
   ====================================================================================== */
const MECH=[[],[]];
function afDynamic(c,ox,oy,dt){const AF=A.airfields();if(!AF[0])return;const wv=window.PXW&&PXW.windVec?PXW.windVec():{x:20,y:0,s:.3};
 for(let t=0;t<2;t++){const af=AF[t],sx=ox+Math.round(af.x*Z),sy=oy+Math.round(af.y*Z);if(sx<-400||sx>vw+400||sy<-300||sy>vh+300)continue;
  /* biruta na cabeceira */const bx=ox+Math.round((af.x+(af.dir||1)*af.half*.82)*Z),by=oy+Math.round((af.y+(af.w||56)/2+40)*Z),ws=clamp(hyp(wv.x,wv.y)/40,.15,1),wa=Math.atan2(wv.y,wv.x);
  c.fillStyle=PAL.ink;c.fillRect(bx,by-9,1,10);for(let i=0;i<5;i++){const k=i*ws*1.4,fl=Math.sin(time*7+i)*(1-ws)*.8,px=bx+Math.round(Math.cos(wa)*k+fl),py=by-9+Math.round(Math.sin(wa)*k*.5);c.fillStyle=(i&1)?'#e8e2d0':'#d4532f';c.fillRect(px,py,2,2)}
  /* bandeira */const q=af.hq||{x:af.x+590,y:af.y-600},fx=ox+Math.round(q.x*Z)+18,fy=oy+Math.round(q.y*Z)-6;c.fillStyle='#2a2620';c.fillRect(fx,fy-12,1,14);
  for(let i=0;i<7;i++){const wav=Math.round(Math.sin(time*5-i*.8)*.8);for(let j=0;j<5;j++){c.fillStyle=t?(j<2?'#1a1a1a':j<3?'#e9e6dc':'#b3302b'):(j%2?'#e9e6dc':'#b3302b');if(!t&&i<3&&j<3)c.fillStyle='#2f3f7a';c.fillRect(fx+1+i,fy-12+j+wav,1,1)}}
  /* mecânicos: andam entre os aviões parados, giram a hélice de quem está dando partida (com o airfield-life.js eles são desenhados lá, em escala) */
  if(window.PXAFL&&PXAFL.on)continue;
  const M=MECH[t];if(M.length<5)M.push({x:af.x+rnd(-250,250),y:af.y-rnd(120,260),tx:0,ty:0,t:0,team:t,seed:Math.random()*9});
  const planes=A.planes().filter(a=>a.team===t&&!a.dead&&!a.gone&&!a.air&&(a.st==='park'||a.st==='start'));
  for(const m of M){m.t-=dt;if(m.t<=0){const p=planes.length?planes[(Math.random()*planes.length)|0]:null;const st=p&&p.st==='start';m.tx=p?p.x+Math.cos(p.hd)*(st?22:rnd(-14,14))+rnd(-4,4):af.x+rnd(-250,250);m.ty=p?p.y+Math.sin(p.hd)*(st?22:6)+rnd(-6,6):af.y-rnd(120,260);m.t=rnd(3,8);m.crank=st}
   const dx=m.tx-m.x,dy=m.ty-m.y,d=hyp(dx,dy);if(d>2){m.x+=dx/d*Math.min(d,22*dt);m.y+=dy/d*Math.min(d,22*dt)}
   const px=ox+Math.round(m.x*Z),py=oy+Math.round(m.y*Z);if(px<-4||py<-6||px>vw+4||py>vh+6)continue;const walk=d>2&&((time*6+m.seed)|0)%2;
   c.fillStyle='rgba(10,12,8,.35)';c.fillRect(px,py+1,3,1);c.fillStyle=t?'#5d5a4d':'#6b6550';c.fillRect(px,py-3,2,3);c.fillStyle='#c9a57a';c.fillRect(px,py-4,2,1);c.fillStyle='#3a3a30';c.fillRect(px+(walk?1:0),py,1,1);
   if(m.crank&&d<3&&((time*3)|0)%2){c.fillStyle='#c9a57a';c.fillRect(px+2,py-3,1,1)}}}}

/* ======================================================================================
   NO AR: traçantes, impactos, Archie
   ====================================================================================== */
const SPARK=[];
function drawAirFx(c,ox,oy,dt){const t0=performance.now();
 /* Archie: clarão laranja, depois nuvem que cresce e se desfaz (preta = alemã, clara = aliada), com sombra no chão */
 for(const p of A.archie()){const hv=Math.max(0,p.h)/(A.cfg.ALTV||900),x=ox+Math.round(p.x*Z-SHX*hv),y=oy+Math.round(p.y*Z-SHY*hv);if(x<-20||y<-20||x>vw+20||y>vh+20)continue;
  const k=p.t/p.max,r=Math.max(1,Math.round(2+5*Math.sqrt(k))),dark=p.team===1;
  if(p.t<.12){c.fillStyle='#ffd27a';c.fillRect(x-2,y-2,4,4);c.fillStyle='#fff3c0';c.fillRect(x-1,y-1,2,2);continue}
  const sx2=ox+Math.round(p.x*Z),sy2=oy+Math.round(p.y*Z);c.globalAlpha=.15*(1-k);c.fillStyle='#0b1207';c.fillRect(sx2-r,sy2-1,r*2,2);
  c.globalAlpha=(1-k)*.85;for(let j=-r;j<=r;j++)for(let i=-r;i<=r;i++){const dd=i*i+j*j*1.2;if(dd>r*r)continue;if(dd>r*r*.6&&((i+j+((p.t*8)|0))&1))continue;c.fillStyle=dark?(i+j<0?'#3d3a33':'#23211c'):(i+j<0?'#e3e0d4':'#b9b6aa');c.fillRect(x+i,y+j,1,1)}c.globalAlpha=1}
 /* traçantes */
 for(const b of A.bullets()){if(!b.tr)continue;const hv=Math.max(0,b.h)/(A.cfg.ALTV||900),x=ox+Math.round(b.x*Z-SHX*hv),y=oy+Math.round(b.y*Z-SHY*hv);if(x<-10||y<-10||x>vw+10||y>vh+10)continue;
  const s=hyp(b.vx,b.vy)||1,lx=Math.round(-b.vx/s*4),ly=Math.round(-b.vy/s*4+b.vz/s*2);PX.pline(c,x,y,x+lx,y+ly,b.team?'#ffc58f':'#fff0b0');c.fillStyle='#ffffff';c.fillRect(x,y,1,1)}
 /* faíscas e lascas onde o tiro acerta */
 for(const e of A.hitFx()){for(let i=0;i<5;i++)SPARK.push({x:e.x,y:e.y,h:e.h,vx:rnd(-60,60),vy:rnd(-60,60),t:0,max:rnd(.18,.45),k:i<2?'spark':'chip'})}
 for(let i=SPARK.length-1;i>=0;i--){const s=SPARK[i];s.t+=dt;if(s.t>s.max){SPARK.splice(i,1);continue}s.x+=s.vx*dt;s.y+=s.vy*dt;s.h-=30*dt;
  const hv=Math.max(0,s.h)/(A.cfg.ALTV||900),x=ox+Math.round(s.x*Z-SHX*hv),y=oy+Math.round(s.y*Z-SHY*hv);c.fillStyle=s.k==='spark'?(s.t<.1?'#fff6cc':'#ffb347'):(i&1?'#cfc49c':'#3a3226');c.fillRect(x,y,1,1)}
 if(SPARK.length>300)SPARK.splice(0,SPARK.length-300);
 V.stats.drawMs=V.stats.drawMs*.95+(performance.now()-t0)*.05}

/* ======================================================================================
   CÂMERA AÉREA
   ====================================================================================== */
const C=V.cam;
function interest(a){if(!a||a.dead||a.gone)return -1;let s=a.air?1:0;if(a.mode==='fight')s+=4;if(a.mode==='evade')s+=3.5;if(a.fireOn)s+=2;if(a.flight&&a.flight.kind==='bmb'&&a.flight.phase==='work')s+=3;if(a.flight&&a.flight.kind==='atk'&&a.flight.phase==='work')s+=2.5;
 if(a.st==='roll')s+=2.2;if(a.st==='lineup')s+=1.4;if(a.st==='start'&&(a.gp==='swing'||a.gp==='prime'))s+=1;if(a.mode==='final')s+=1.8;if(a.pilot&&a.pilot.kills>=5)s+=.8;return s}
function nextTarget(){const L=A.planes().filter(a=>!a.dead&&!a.gone&&(a.air||a.st==='roll'||a.st==='taxi'||a.st==='lineup'||a.st==='start'&&a.gp&&a.gp!=='crew')).sort((a,b)=>interest(b)-interest(a));if(!L.length)return null;
 if(C.tgt&&L.length>1){const i=L.indexOf(C.tgt);return L[(i+1)%L.length]}return L[0]}
function camOn(t){C.on=true;C.tgt=t||nextTarget();C.free=null;C.x=null;C.y=null;if(!C.tgt){const af=A.airfields()[playerTeam||0];C.free={x:af.x,y:af.y}}V.map.show=true;showMap()}
function camOff(){C.on=false;C.tgt=null;C.free=null;cam.x=clamp(cam.x,0,W);cam.y=clamp(cam.y,0,H)}
function camTick(dt){if(!C.on)return;if(typeof mode!=='undefined'&&mode==='soldier'){camOff();return}
 let tx,ty;const a=C.tgt;
 if(a&&!a.dead&&!a.gone){const hv=altv(a);tx=a.x-SHX*hv/Z;ty=a.y-SHY*hv/Z}
 else if(a&&(a.dead||a.gone)){C.lost=(C.lost||0)+dt;if(C.lost>2.2){C.lost=0;C.tgt=nextTarget()}tx=cam.x;ty=cam.y}
 else if(C.free){tx=C.free.x;ty=C.free.y}else{C.tgt=nextTarget();return}
 const TH=A.theatre();if(C.x==null){C.x=tx;C.y=ty}const far=hyp(tx-C.x,ty-C.y)>900?3:1;C.x+=(tx-C.x)*Math.min(1,dt*3.5*far);C.y+=(ty-C.y)*Math.min(1,dt*3.5*far);
 cam.x=clamp(C.x,TH.x0+200,TH.x1-200);cam.y=clamp(C.y,TH.y0+150,TH.y1-150)}
const MODE_TXT={fight:'em combate',evade:'fugindo de um caça',zoom:'subindo depois do mergulho',extend:'arrancando para longe',form:'em formação',climbout:'subindo depois de decolar',recover:'saindo do parafuso',spin:'em parafuso!',
 rtb:'voltando ao aeródromo',circuit:'no circuito, esperando a pista',final:'na final para pousar',glide:'motor parado, planando'};
function camLabel(c){if(!C.on||!window.IFK||!IFK.text)return;const a=C.tgt;let s;
 if(a&&!a.dead&&!a.gone){const P=a.pilot,fl=a.flight,st=a.st!=='air'?(a.st==='start'?{crew:'piloto indo ao avião',prime:'mecânico dando os puxões',swing:'girando a hélice',warm:'aquecendo o motor',chocks:'tirando os calços'}[a.gp]||'dando partida':{park:'no pátio',taxi:'taxiando',hold:'esperando a pista',lineup:'alinhando e provando o motor',roll:'corrida de decolagem',rollout:'rolando depois do pouso',taxiin:'taxiando para o pátio'}[a.st]):MODE_TXT[a.mode]||'';
  s=`${a.team?'ALEMANHA':'EUA'} · ${P?P.name:'?'} · ${a.T.name}${P&&P.kills?` · ${P.kills} vit.`:''}${fl?` · ${A.names[fl.kind]||''}`:''} · ${st} · ${Math.round(Math.max(0,a.h)*4)} m`}
 else s=C.free?'TEATRO AÉREO':'ABATIDO';
 const tw=t=>IFK.textW?IFK.textW(t):t.length*4;if(tw(s+'   L PRÓXIMO · SHIFT+L SAIR')<vw-8)s+='   L PRÓXIMO · SHIFT+L SAIR';else if(tw(s)>vw-8)s=s.replace(/ · \d+ m$/,'').replace(/^(EUA|ALEMANHA) · /,'');const w=tw(s);IFK.text(c,s,Math.round(vw/2-w/2),Math.round(vh*.16),'#efe9c8','#14160f')}

/* ======================================================================================
   TEATRO AÉREO (mapa pequeno)
   ====================================================================================== */
let MAP=null,MAPC=null,MW=260,MH=110;
function makeMap(){if(MAP)return;const f=document.getElementById('field')||document.body;MAP=document.createElement('div');MAP.id='airTheatre';
 MAP.innerHTML='<div class="t">TEATRO AÉREO <span>Y fecha · L câmera</span></div>';MAPC=mk(MW,MH);MAP.appendChild(MAPC);f.appendChild(MAP);
 const st=document.createElement('style');st.textContent='#airTheatre{position:absolute;right:12px;top:74px;z-index:6;background:rgba(18,21,15,.88);border:1px solid #4a503a;padding:4px;display:none;image-rendering:pixelated}#airTheatre canvas{display:block;width:'+MW+'px;height:'+MH+'px;cursor:crosshair}#airTheatre .t{font:10px monospace;color:#d8d3b0;margin:0 0 3px 2px;letter-spacing:.5px}#airTheatre .t span{color:#8d9070;margin-left:6px}';document.head.appendChild(st);
 MAPC.addEventListener('click',e=>{const r=MAPC.getBoundingClientRect(),TH=A.theatre(),wx=TH.x0+(e.clientX-r.left)/r.width*(TH.x1-TH.x0),wy=TH.y0+(e.clientY-r.top)/r.height*(TH.y1-TH.y0);
  let best=null,bd=300;for(const a of A.planes())if(!a.dead&&!a.gone&&(a.air||a.st!=='park')){const d=hyp(a.x-wx,a.y-wy);if(d<bd){bd=d;best=a}}
  C.on=true;C.tgt=best;C.free=best?null:{x:wx,y:wy}})}
function showMap(){makeMap();MAP.style.display=V.map.show?'block':'none'}
function drawMap(){if(!MAP||!V.map.show)return;const x=MAPC.getContext('2d'),TH=A.theatre(),sxk=MW/(TH.x1-TH.x0),syk=MH/(TH.y1-TH.y0),X=v=>(v-TH.x0)*sxk,Y=v=>(v-TH.y0)*syk;
 x.fillStyle='#2b3221';x.fillRect(0,0,MW,MH);x.fillStyle='#3d4a2c';x.fillRect(X(0),Y(0),W*sxk,H*syk);x.strokeStyle='#5c6a40';x.strokeRect(X(0)+.5,Y(0)+.5,W*sxk-1,H*syk-1);
 const fr=A.front();x.fillStyle='#8a6a48';for(let y=0;y<H;y+=70)x.fillRect(X(fr),Y(y),1,2);
 for(const af of A.airfields()){if(!af)continue;x.fillStyle=af.team?'#b67765':'#679fae';x.fillRect(X(af.x-af.half),Y(af.y)-1,af.half*2*sxk,3)}
 for(const a of A.planes()){if(a.dead||a.gone||!a.air)continue;x.fillStyle=a.team?(a.mode==='fight'?'#ff9f7a':'#e29a87'):(a.mode==='fight'?'#bff3ff':'#aed6d4');const s=a.T.cls==='f'?1:2;x.fillRect(Math.round(X(a.x))-s+1,Math.round(Y(a.y))-s+1,s+1,s+1)}
 for(const q of A.foreign()){x.fillStyle='#e8d48a';x.fillRect(Math.round(X(q.x)),Math.round(Y(q.y)),2,2)}
 const hw=vw/2/Z,hh=vh/2/Z;x.strokeStyle='rgba(235,230,200,.7)';x.strokeRect(Math.round(X(cam.x-hw))+.5,Math.round(Y(cam.y-hh))+.5,Math.max(2,hw*2*sxk),Math.max(2,hh*2*syk))}

/* ======================================================================================
   LIGAÇÕES
   ====================================================================================== */
const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('airwar-view.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};
wrap('setup',(orig,...a)=>{const r=orig(...a);try{built=false;REAR=[null,null];MECH[0].length=0;MECH[1].length=0;SPARK.length=0;if(C.on)camOff();V.stats.rearMs=0;if(V.on&&A.on)setTimeout(()=>{try{if(!REAR[0])buildRear(0);setTimeout(()=>{try{if(!REAR[1])buildRear(1)}catch(e){fail(e)}},120)}catch(e){fail(e)}},60)}catch(e){fail(e)}return r});
wrap('update',(orig,dt)=>{const r=orig(dt);if(!V.on||!A.on)return r;try{camTick(Math.min(dt,.05))}catch(e){fail(e)}return r});
if(window.WW1A){const u0=WW1A.under,o0=WW1A.over;
 WW1A.under=function(c,ox,oy,dt){const r=u0.apply(this,arguments);if(V.on&&A.on&&typeof started!=='undefined'&&started)try{
   if(!built&&A.airfields()[0]){if(!REAR[0])buildRear(0);else if(!REAR[1])buildRear(1)}
   for(let s=0;s<2;s++){const R=REAR[s];if(!R)continue;const x=ox+Math.round(REARX[s]*Z);if(x>vw||x+R.width<0)continue;c.drawImage(R,x,oy)}
   afDynamic(c,ox,oy,Math.min(.05,dt||.016))}catch(e){fail(e)}return r};
 WW1A.over=function(c,ox,oy,dt){const r=o0.apply(this,arguments);if(V.on&&A.on)try{camLabel(c);drawMap()}catch(e){fail(e)}return r}}
if(window.PLN){const d0=PLN.draw;PLN.draw=function(c,ox,oy,dt){const r=d0.apply(this,arguments);if(V.on&&A.on)try{drawAirFx(c,ox,oy,Math.min(.05,dt||.016))}catch(e){fail(e)}return r}}
window.addEventListener('keydown',e=>{if(!V.on||!A.on||e.repeat)return;const k=(e.key||'').toLowerCase();if(document.querySelector('dialog[open]'))return;const tg=e.target;if(tg&&(tg.tagName==='INPUT'||tg.tagName==='TEXTAREA'||tg.tagName==='SELECT'))return;
 if(typeof started==='undefined'||!started)return;
 if(k==='l'){e.preventDefault();if(e.shiftKey){camOff();return}if(!C.on)camOn();else{C.tgt=nextTarget();C.free=null}}
 else if(k==='y'){e.preventDefault();V.map.show=!V.map.show;showMap()}
 else if(k==='escape'&&C.on){camOff()}});
let hinted=false;wrap('setup',(orig,...a)=>{const r=orig(...a);try{if(!hinted&&typeof started!=='undefined'&&started&&A.on){hinted=true;setTimeout(()=>{try{toast('Guerra aérea: L segue os combates aéreos (Shift+L volta) · Y mostra o teatro aéreo e os aeródromos.')}catch{}},4500)}}catch{}return r});
V.state=()=>({on:V.on,built,rearMs:V.stats.rearMs,drawMs:+V.stats.drawMs.toFixed(3),cam:{on:C.on,tgt:C.tgt?C.tgt.id:null,free:!!C.free},map:V.map.show,sparks:SPARK.length,errors:V.stats.errors});
V.camOn=camOn;V.camOff=camOff;V.next=()=>{C.tgt=nextTarget();return C.tgt};V.buildRear=buildRear;V.rear=()=>REAR;V.rearX=()=>REARX;
if(window.IronFront)window.IronFront.airwarView=V;
})();
