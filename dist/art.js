'use strict';
(function(){
/* Iron Front 0.4 — pipeline de pixel art.
   Regra de ouro: 1 pixel de arte = 1 pixel do canvas interno. O canvas interno é ampliado por um
   fator INTEIRO (nearest-neighbor), então todo pixel tem o mesmo tamanho na tela.
   Mundo (W×H unidades) → canvas interno: Z pixels por unidade (0,5 → 2 unidades por pixel de arte).
   Todo sprite é desenhado uma vez (cache) e aplicado com drawImage em coordenadas inteiras. */
const TAU=Math.PI*2,Z=.5,INK='#1b1f16';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const g2=c=>c.getContext('2d',{willReadFrequently:true});
const hex2rgb=h=>{h=h.replace('#','');return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]};
const rgb2hex=(r,g,b)=>'#'+[r,g,b].map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('');
const mix=(a,b,t)=>{const A=hex2rgb(a),B=hex2rgb(b);return rgb2hex(A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t)};
const pack=h=>{const[r,g,b]=hex2rgb(h);return(0xff000000|(b<<16)|(g<<8)|r)>>>0};
let _s=1;const srand=n=>{_s=(n>>>0)||1},sr=()=>{_s=(Math.imul(_s,1664525)+1013904223)>>>0;return _s/4294967296};
const cache=new Map();const cached=(k,fn)=>{let v=cache.get(k);if(!v){v=fn();cache.set(k,v)}return v};
function box(x,col){return(a,b,w,h,c)=>{x.fillStyle=c||col;x.fillRect(a,b,w,h)}}
function fromGrid(rows,pal){const c=mk(rows[0].length,rows.length),x=g2(c);for(let j=0;j<rows.length;j++)for(let i=0;i<rows[j].length;i++){const col=pal[rows[j][i]];if(col){x.fillStyle=col;x.fillRect(i,j,1,1)}}return c}
function flipX(src){const c=mk(src.width,src.height),x=g2(c);x.translate(src.width,0);x.scale(-1,1);x.drawImage(src,0,0);return c}
function plot(x,a,b,col){x.fillStyle=col;x.fillRect(Math.round(a),Math.round(b),1,1)}
function pline(x,x0,y0,x1,y1,col,dash=0,phase=0){x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);const dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let e=dx+dy,n=0;x.fillStyle=col;for(;;){if(!dash||((n+phase)%(dash*2)<dash))x.fillRect(x0,y0,1,1);if(x0===x1&&y0===y1)break;const e2=2*e;if(e2>=dy){e+=dy;x0+=sx}if(e2<=dx){e+=dx;y0+=sy}n++}}
function disc(x,cx,cy,r,col){cx=Math.round(cx);cy=Math.round(cy);r=Math.round(r);if(r<=0){x.fillStyle=col;x.fillRect(cx,cy,1,1);return}x.fillStyle=col;for(let j=-r;j<=r;j++){const w=Math.floor(Math.sqrt(r*r+r*.8-j*j));x.fillRect(cx-w,cy+j,w*2+1,1)}}
/* anel em pixels (elipse por passos de ângulo), com tracejado opcional que "anda" com phase */
function ring(x,cx,cy,rx,ry,col,dash=0,phase=0){x.fillStyle=col;const n=Math.max(16,Math.ceil(TAU*Math.max(rx,ry)*1.2));let lx=1e9,ly=1e9,k=0;for(let i=0;i<n;i++){const a=i/n*TAU,px=Math.round(cx+Math.cos(a)*rx),py=Math.round(cy+Math.sin(a)*ry);if(px===lx&&py===ly)continue;lx=px;ly=py;if(!dash||((k+phase)%(dash*2)<dash))x.fillRect(px,py,1,1);k++}}

/* ---------- contorno seletivo (sel-out): a cor do contorno é a do pixel vizinho escurecida ---------- */
function outlined(src,k=.62){const w=src.width,h=src.height,W2=w+2,H2=h+2,out=mk(W2,H2),o=g2(out);o.drawImage(src,1,1);const im=o.getImageData(0,0,W2,H2),d=im.data,s=new Uint8ClampedArray(d),ink=hex2rgb(INK);
for(let y=0;y<H2;y++)for(let x=0;x<W2;x++){const i=(y*W2+x)*4;if(s[i+3])continue;let best=-1,bl=1e9;for(const[dx,dy]of[[0,-1],[-1,0],[1,0],[0,1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=W2||ny>=H2)continue;const j=(ny*W2+nx)*4;if(s[j+3]>128){const l=s[j]+s[j+1]+s[j+2];if(l<bl){bl=l;best=j}}}
if(best>=0){d[i]=s[best]*(1-k)+ink[0]*k;d[i+1]=s[best+1]*(1-k)+ink[1]*k;d[i+2]=s[best+2]*(1-k)+ink[2]*k;d[i+3]=255}}
o.putImageData(im,0,0);return out}
/* silhueta para sombras */
function silhouette(src,col,alpha=1){const c=mk(src.width,src.height),x=g2(c);x.drawImage(src,0,0);x.globalCompositeOperation='source-in';x.fillStyle=col;x.globalAlpha=alpha;x.fillRect(0,0,c.width,c.height);return c}

/* ---------- rotação estilo RotSprite: Scale2x ×2, rotação por vizinho mais próximo, amostra no centro ---------- */
function epx(cv){const w=cv.width,h=cv.height,im=g2(cv).getImageData(0,0,w,h),o=new ImageData(w*2,h*2),s=new Uint32Array(im.data.buffer),d=new Uint32Array(o.data.buffer),W2=w*2;
for(let y=0;y<h;y++)for(let x=0;x<w;x++){const P=s[y*w+x],A=y>0?s[(y-1)*w+x]:P,B=x<w-1?s[y*w+x+1]:P,C=x>0?s[y*w+x-1]:P,D=y<h-1?s[(y+1)*w+x]:P;let p1=P,p2=P,p3=P,p4=P;
if(C===A&&C!==D&&A!==B)p1=A;if(A===B&&A!==C&&B!==D)p2=B;if(D===C&&D!==B&&C!==A)p3=C;if(B===D&&B!==A&&D!==C)p4=D;const j=y*2*W2+x*2;d[j]=p1;d[j+1]=p2;d[j+W2]=p3;d[j+W2+1]=p4}
const out=mk(W2,h*2);g2(out).putImageData(o,0,0);return out}
function rotSprite(src,ang){const big=epx(epx(src)),BW=big.width,BH=big.height,N=Math.ceil(Math.hypot(src.width,src.height))+2,out=mk(N,N),o=g2(out),od=o.createImageData(N,N),dd=new Uint32Array(od.data.buffer),bs=new Uint32Array(g2(big).getImageData(0,0,BW,BH).data.buffer),cs=Math.cos(ang),sn=Math.sin(ang);
for(let y=0;y<N;y++)for(let x=0;x<N;x++){const fx=(x+.5-N/2)*4,fy=(y+.5-N/2)*4,sx=Math.floor(cs*fx+sn*fy+BW/2),sy=Math.floor(-sn*fx+cs*fy+BH/2);if(sx>=0&&sy>=0&&sx<BW&&sy<BH)dd[y*N+x]=bs[sy*BW+sx]}
o.putImageData(od,0,0);return out}
const dir16=a=>Math.round(((a%TAU)+TAU)%TAU/(TAU/16))%16,dir8=a=>Math.round(((a%TAU)+TAU)%TAU/(TAU/8))%8;

/* ---------- paletas de facção (identificadores de jogabilidade: azul = Aliados, vermelho = Centrais) ---------- */
const TEAM=[
{v:'#4a5330',u:'#8a8452',U:'#615d38',k:'#7b7548',K:'#57532f',h:'#707a4a',H:'#a3b074',t:'#58a8ea',P:'#7a6d47',p:'#b5a677',b:'#4a3524',s:'#dcb690',S:'#ad8763',hull:'#5e8aa8',hullH:'#8fb9d2',hullD:'#3e6480',hullDD:'#294357',mark:'#b3ecf7',coat:'#7a5335',coatD:'#573822',blanket:'#9ad6e6',wing:'#7fa8b3',wingD:'#56808c'},
{v:'#3a403b',u:'#6f7869',U:'#474e44',k:'#636c58',K:'#434a3c',h:'#5b625c',H:'#929a93',t:'#ea6650',P:'#2b211a',p:'#5e4730',b:'#1b1916',s:'#dcb690',S:'#ad8763',hull:'#a5604a',hullH:'#cd8a6c',hullD:'#7a4130',hullDD:'#4d281f',mark:'#f4a488',coat:'#4d372b',coatD:'#33241b',blanket:'#e0866c',wing:'#b48b73',wingD:'#89614c'}];
const WOOD='#7a5536',WOODD='#553a24',STEEL='#3c403a',STEELH='#6f756b';

/* ---------- infantaria: 3 vistas desenhadas à mão (frente / costas / perfil), pernas em 4 quadros ---------- */
/* uniformes da época: EUA (time 0) = lã cáqui-oliva, capacete M1917 "Brodie" de aba larga, perneiras enroladas;
   Alemanha (time 1) = feldgrau, Stahlhelm M1916 (cúpula funda com abas laterais e cobre-nuca), botas pretas de cano alto.
   O acento colorido (t) é a braçadeira de identificação da facção (azul = EUA, vermelho = Alemanha). */
const TORSO_F=['UuuuuuuuU','tuppuppuT','UuuuuuuuU','.pPpppPp.'],TORSO_B=['UuuuuuuuU','tuPPPPPuT','UuPppPPuU','.pPpppPp.'],TORSO_S=['..PuuuU..','.PPuutU..','.PPuuuU..','..pPppP..'];
const HEAD={0:{front:['..hhhhh..','.hHHHhhh.','hHhhhhhhh','.vvvvvvv.','..SsssS..','...sss...'],back:['..hhhhh..','.hHHHhhh.','hHhhhhhhh','.vvvvvvv.','..SSSSS..','...SsS...'],side:['..hhhhh..','.hHHhhhh.','hHhhhhhhh','.vvvvvvv.','...SSsss.','....ssS..']},
1:{front:['...hhh...','..hHHhh..','.hHhhhhh.','hhhhhhhhh','.hSsssSh.','...sss...'],back:['...hhh...','..hHHhh..','.hHhhhhh.','hhhhhhhhh','.hhhhhhh.','...SsS...'],side:['..hhhh...','.hHHhhh..','.hhhhhhh.','.hhhhhhhh','.hhSSsss.','..hhssS..']}};
const FRONT=t=>HEAD[t].front.concat(TORSO_F),BACK=t=>HEAD[t].back.concat(TORSO_B),SIDE=t=>HEAD[t].side.concat(TORSO_S);
const LEGF=[['.kkK.Kkk.','.kkK.Kkk.','.bbb.bbb.','.........'],['.kkK.Kkk.','.kkK..Kk.','.kkK..bb.','.bbb.....'],['.kkK.Kkk.','.Kkk.Kk..','.Kkk.bb..','.....bbb.']];
const LEGB=LEGF;
const LEGS=[['..kkK....','..kkK....','..bbb....','.........'],['..kkK....','.kkK.Kk..','.kk..Kk..','.bb..bb..'],['..kKk....','..KkK....','..kk.K...','..bb.bb..']];
/* pernas por nação: EUA = perneira enrolada (faixas claras/escuras), Alemanha = bota preta de cano alto */
const legsFor=(t,L)=>L.map(fr=>fr.map((r,i)=>i===1?(t===0?r.replace(/[kK]/g,m=>m==='k'?'K':'k'):r.replace(/[kK]/g,'b')):r));
const FRAMES=[0,1,0,2];
const fromRows=(rows,team)=>fromGrid(rows,TEAM[team]);
/* granadas no cinto: EUA = Mk II "abacaxi" (corpo oliva estriado); Alemanha = Stielhandgranate (cabo de madeira claro + cabeça cinza) */
function beltGrenades(c,team,facing){const x=g2(c),P=(a,b,col)=>{x.fillStyle=col;x.fillRect(a,b,1,1)};
const spots=facing==='side'?[3]:[1,6];
for(const sx of spots){if(team===0){P(sx,8,'#4e5632');P(sx+1,8,'#7d8a54');P(sx,9,'#3b4225');P(sx+1,9,'#4e5632');P(sx,7,'#9a9a84')}
else{P(sx,7,'#767b80');P(sx+1,7,'#9aa0a5');P(sx,8,'#5d6267');P(sx+1,8,'#767b80');P(sx,9,'#d3bf95');P(sx,10,'#bca677')}}}
function bodyCanvas(team,facing,frame,top=false,gr=false){const up=(facing==='side'?SIDE:facing==='back'?BACK:FRONT)(team),lg=legsFor(team,facing==='side'?LEGS:LEGF),rows=top?up:up.concat(lg[frame]),pal=Object.assign({},TEAM[team]);pal.T=pal.t;const c=fromGrid(rows,pal);if(gr)beltGrenades(c,team,facing);return c}
function gunParts(kind){return kind==='smg'?[[-2,0,'#8a6238'],[0,7,'#5d645a'],[1,3,'#8b9282']]:kind==='pistol'?[[0,4,'#6a7166'],[-1,0,'#8a6238']]:kind==='mg'?[[-3,1,'#8a6238'],[1,13,'#59605a'],[3,9,'#9aa190']]:kind==='saber'?[[0,2,'#8a6238'],[2,13,'#d6dccf']]:kind==='lance'?[[-4,2,'#8a6238'],[2,19,'#b18a52'],[19,22,'#e3e8da']]:[[-3,1,'#8a6238'],[1,12,'#5d645a'],[2,6,'#9aa190']]}
function drawGun(x,cx,cy,a,kind){const c=Math.cos(a),s=Math.sin(a);for(const[f,t,col]of gunParts(kind)){x.fillStyle=col;for(let d=f;d<=t;d+=.5){const px=Math.round(cx+c*d),py=Math.round(cy+s*d);x.fillRect(px,py,1,1);if(kind==='mg'&&d>1&&d<11){x.fillRect(px,py+(Math.abs(s)>.7?0:1),Math.abs(s)>.7?1:1,1)}}}}
/* ---------- armas americanas da Grande Guerra, desenhadas por partes ----------
   fuzil Springfield M1903 (carregador de lâmina, 5 tiros) · fuzil automático BAR M1918 (pente reto, 20) ·
   pistola Colt M1911 (carregador de 7). Eixos locais: f = ao longo da mira, s = lateral (direita da mira),
   d = pendurado na vertical da tela (pente, empunhadura, guarda-mato não giram com a mira).
   ph = fase da recarga (null = empunhada normal). Mãos em cor de pele mostram quem mexe em quê. */
const GW={wood:'#8a6238',woodD:'#5e4028',steel:'#5d645a',steelH:'#9aa190',steelD:'#33372f',brass:'#d9b548',brassH:'#f2d878',gap:'#1a1c17',walnut:'#7a4a2c',walnutD:'#4f2f1c'};
const RL_N={rifle:6,smg:5,pistol:5},RL_TILT={rifle:[.5,.6,.6,.6,.5,.2],smg:[.45,.5,.5,.5,.25],pistol:[.4,.45,.45,.4,.15]};
function drawWeapon(x,cx,cy,a,kind,ph,skin){const co=Math.cos(a),si=Math.sin(a),W=GW,pr=ph==null?-1:ph,
P=(f,s,d,col)=>{x.fillStyle=col;x.fillRect(Math.round(cx+co*f-si*s),Math.round(cy+si*f+co*s+d),1,1)},
R=(f0,f1,s0,s1,d,col)=>{for(let f=f0;f<=f1+.01;f+=.5)for(let s=s0;s<=s1+.01;s+=.5)P(f,s,d,col)},
V=(f,d0,n,col,top)=>{for(let i=0;i<n;i++)P(f,0,d0+i,i===0&&top?top:col)},
Hd=(f,s,d)=>P(f,s,d,skin);
if(kind==='rifle'||kind==='g98'){/* Springfield M1903 / Gewehr 98 Mauser: ferrolho com alavanca, carregador de lâmina com 5 cartuchos */
const de=kind==='g98',wd=de?W.walnut:W.wood,wdd=de?W.walnutD:W.woodD,open=pr>=1&&pr<=3?1:pr===4?.5:0,up=pr>=0&&pr<=4,bf=-open*3;
R(-5,-1.5,-.5,.5,0,wd);R(-5,-1.5,.5,.5,0,wdd);P(-5.5,0,0,W.steelD);if(de){P(-2,0,1,wd);P(-6,0,0,W.steelD)}/* coronha (G98: empunhadura de pistola) */
R(-1,3,-.5,.5,0,W.steel);if(open)R(0,2.5,-.5,.5,0,W.gap);/* caixa da culatra (janela aberta) */
R(bf-.5,bf+2,0,0,up?-1:0,W.steelH);/* corpo do ferrolho */
P(bf+.5,1.5,up?-1:0,W.steelH);P(bf+.5,2.5,up?-1:0,W.steelH);if(up){P(bf+.5,3.5,-2,W.steelH);P(bf+.5,3.5,-1,W.steelD)}else if(de)P(bf+.5,3,1,W.steelH);/* alavanca (G98: dobrada para baixo) */
R(3,de?10:8,-.5,.5,0,wd);R(3,de?10:8,.5,.5,0,wdd);if(de){P(6,0,0,W.steelH);P(9,0,0,W.steelH);P(10.5,0,0,W.steelD);R(11,12,0,0,0,W.steel);P(11,0,-1,W.steelD)}else{P(8.5,0,0,W.steelD);R(9,12,0,0,0,W.steel)}P(12,0,0,W.steelD);P(11.5,0,-1,W.steelD);/* guarda-mão e cano (G98: anéis e bocal) */
P(1,0,1,W.steelD);P(2,0,1,W.steelD);if(de)P(1.5,0,2,W.steelD);/* guarda-mato (G98: caixa do carregador saliente) */
if(pr===2){R(-.5,3.5,0,0,-2,W.steelH);for(let i=0;i<5;i++)P(i*.75,0,-3,W.brass);P(1.5,0,-3,W.brassH)}/* lâmina cheia sobre a janela */
if(pr===3){R(-.5,3.5,0,0,-2,W.steelH);P(.5,0,-3,W.brass);P(2.5,0,-3,W.brass)}/* cartuchos sendo empurrados */
Hd(...(pr===2?[1.5,0,-4]:pr===3?[1.5,0,-2]:up?[bf+.5,3.5,-1]:[-1.5,0,0]));Hd(5.5,0,1)}
else if(kind==='smg'){/* BAR M1918 (slot 2 dos EUA): pente reto embaixo, empunhadura dianteira, cano aletado com compensador */
const m=[0,3,4,1,0][Math.max(0,pr)],ch=pr===4?-1.5:1,fresh=pr>=2&&m>0;
R(-4.5,-1.5,-.5,.5,0,W.wood);R(-4.5,-1.5,.5,.5,0,W.woodD);/* coronha */
R(-1,3,-.5,.5,0,W.steelD);R(-1,3,0,0,-1,W.steel);P(ch,0,-2,W.steelH);/* caixa e alça de armar */
P(-.5,0,1,W.wood);P(-.5,0,2,W.wood);P(-1,0,3,W.woodD);/* empunhadura de pistola */
R(3.5,7,-.5,.5,0,W.steel);for(let f=3.5,i=0;f<=7;f+=1,i++)P(f,0,0,i%2?W.steelD:W.steelH);R(7.5,9.5,-.5,.5,0,W.steelD);P(8.5,0,-1,W.steel);P(9.5,0,0,W.steelD);/* cano e compensador */
P(4.5,0,1,W.wood);P(4.5,0,2,W.woodD);/* empunhadura dianteira */
if(pr===2){P(1.5,0,1,W.gap);P(2.5,0,1,W.gap);P(1.5,0,2,W.gap);P(2.5,0,2,W.gap)}/* alojamento vazio */
for(let i=0;i<4;i++){const d=1+m+i;P(1.5,0,d,fresh&&!i?W.brass:W.steel);P(2.5,0,d,W.steelD)}/* pente de 20 cartuchos */
Hd(-.5,0,2);Hd(...(pr===0?[2,0,6]:pr===1?[2,0,8]:pr===2?[2,0,9]:pr===3?[2,0,6.5]:pr===4?[-.5,0,-1]:[4.5,0,2]))}
else if(kind==='pistol'){/* Colt M1911: ferrolho trava aberto ao esvaziar, pente de 7 cai pela empunhadura */
const back=pr===0?-1.5:0,m=[0,2,3,1,0][Math.max(0,pr)];
R(-1+back,4+back,0,0,0,W.steelH);R(-1+back,4+back,.5,.5,0,W.steel);P(4.5,0,0,W.steelD);P(-1.5+back,0,0,W.steelD);/* ferrolho e cão */
if(pr===0)R(2,4,0,0,0,W.gap);/* cano exposto com o ferrolho travado atrás */
P(-.5+back,0,-1,W.steelD);P(4+back,0,-1,W.steelD);/* alças de mira */
P(-.5,0,1,W.wood);P(-1,0,2,W.wood);P(1,0,1,W.steelD);/* empunhadura e guarda-mato */
V(-1,3+m,2,W.steelD,pr>=2&&m>0?W.brass:null);/* pente de 7 */
Hd(-.5,0,1);if(pr>=0)Hd(...(pr===0?[-1,0,5]:pr===1?[-1,0,7]:pr===2?[-1,0,8]:pr===3?[-1,0,5]:[.5,0,-1]))}
else if(kind==='mp18'){/* Bergmann MP 18: coronha de nogueira, camisa do cano perfurada e tambor "caracol" de 32 tiros preso ao lado */
const k=[0,2.5,3,1,0][Math.max(0,pr)],ds=-3.5-k,ch=pr===4?-1.5:.5,fresh=pr>=2&&k>0;
R(-5,-1.5,-.5,.5,0,W.walnut);R(-5,-1.5,.5,.5,0,W.walnutD);P(-5.5,0,0,W.steelD);/* coronha */
R(-1,2,-.5,.5,0,W.steelD);R(-1,2,0,0,-1,W.steel);P(ch,1.5,0,W.steelH);/* caixa e alça de armar (lado direito) */
R(2.5,7.5,-.5,.5,0,W.steel);for(let f=3;f<=7;f+=1)P(f,0,0,W.gap);R(8,9,0,0,0,W.steelD);P(9.5,0,0,W.steelD);/* camisa perfurada e cano */
P(-.5,0,1,W.steelD);P(-1.5,0,1,W.walnut);/* gatilho e cabo */
if(pr===2){P(1.2,-1.5,0,W.gap);P(1.2,-2,0,W.gap)}/* alojamento vazio */
const dc=(f,s)=>{for(let i=-1.5;i<=1.5;i+=.5)for(let j=-1.5;j<=1.5;j+=.5)if(i*i+j*j<=2.6)P(f+i,s+j,0,W.steelD)};
R(1,1.5,ds+1.5,-.5,0,W.steelD);dc(1.2,ds);P(1.2,ds,0,W.steel);P(.7,ds-.5,0,W.steelH);if(fresh)P(2.7,ds,0,W.brass);/* tambor de 32 cartuchos */
Hd(-1.5,0,0);Hd(...(pr===0?[1.2,ds,0]:pr===1?[1.2,ds-1.5,0]:pr===2?[1.2,ds-2,0]:pr===3?[1.2,ds-1,0]:pr===4?[-.5,1.8,0]:[5,0,1]))}
else if(kind==='p08'){/* Luger P08: ferrolho articulado (joelho) no dorso, cano fino, empunhadura inclinada, pente de 8 */
const m=[0,2,3,1,0][Math.max(0,pr)],up=pr===0?1:pr===4?.6:0;
R(-1,2,0,0,0,W.steelH);R(-1,2,.5,.5,0,W.steel);R(2.5,5,0,0,0,W.steelD);P(5,0,-1,W.steelD);/* ferrolho e cano longo */
if(up){P(-1.5,0,-1,W.steel);P(-1,0,-2,W.steelH);P(0,0,-2,W.steelH);if(up===1)P(1,0,-1,W.gap)}else{P(-1,0,-1,W.steelH);P(-.5,0,-1,W.steel)}/* joelho do ferrolho (aberto ao esvaziar) */
P(-.5,0,1,W.walnut);P(-1,0,2,W.walnut);P(-1.5,0,3,W.walnutD);P(1,0,1,W.steelD);/* empunhadura inclinada e guarda-mato */
V(-1.5,4+m,2,W.steelD,pr>=2&&m>0?W.brass:null);/* pente de 8 */
Hd(-.5,0,1);if(pr>=0)Hd(...(pr===0?[-1.5,0,6]:pr===1?[-1.5,0,8]:pr===2?[-1.5,0,9]:pr===3?[-1.5,0,6]:[-.5,0,-2]))}
}
/* modelo de arma por nação: a "vaga" (rifle/smg/pistol) é a mesma, o desenho muda */
const MODEL=[{rifle:'rifle',smg:'smg',pistol:'pistol'},{rifle:'g98',smg:'mp18',pistol:'p08'}];
/* arremesso de granada (th = 0 recuar o braço, 1 por cima da cabeça, 2 soltar): braço + granada na mão */
function drawThrow(x,team,a,th){const co=Math.cos(a),si=Math.sin(a),T=TEAM[team],sx=13,sy=15,H=[[-co*4,-5],[co*1,-8],[co*6,-3+si*2]][th],hx=Math.round(sx+H[0]),hy=Math.round(sy+H[1]);
pline(x,sx,sy,hx,hy,T.u);pline(x,sx,sy+1,hx,hy+1,T.U);
if(th<2){if(team===0){x.fillStyle='#4e5632';x.fillRect(hx-1,hy-3,3,3);x.fillStyle='#7d8a54';x.fillRect(hx-1,hy-3,1,2);x.fillStyle='#9a9a84';x.fillRect(hx,hy-4,1,1)}
else{x.fillStyle='#d3bf95';x.fillRect(hx,hy-2,1,3);x.fillStyle='#767b80';x.fillRect(hx-1,hy-4,3,2);x.fillStyle='#9aa0a5';x.fillRect(hx-1,hy-4,1,1)}}
x.fillStyle=T.s;x.fillRect(hx,hy,1,1);if(th===2)x.fillRect(hx+Math.round(co),hy+Math.round(si),1,1)}
function infantrySprite(team,type,d,frame,gun,ph,th,gr){return cached(`inf${team}${type}${d}${frame}${gun}${ph==null?'':'r'+ph}${th==null?'':'t'+th}${gr?'g':''}`,()=>{const a=d*TAU/16,s=Math.sin(a),co=Math.cos(a),facing=s>.55?'front':s<-.55?'back':'side',c=mk(28,28),x=g2(c);let body=bodyCanvas(team,facing,frame,false,!!gr&&type==='rifle');if(facing==='side'&&co<0)body=flipX(body);
const kind=type==='mg'?'mg':gun||'rifle',hx=14+co*1.5,hy=15+s*1+ (facing==='back'?-1:0);
if(RL_N[kind]&&type!=='mg'){const sk=TEAM[team].s,mdl=MODEL[team][kind],tilt=(co>=0?1:-1);
if(th!=null){x.drawImage(body,9,8);drawWeapon(x,14+co*.5,17+s*.4,a+tilt*.75,mdl,null,sk);drawThrow(x,team,a,th)}
else if(ph!=null){/* recarregando: arma baixada diante do corpo, sempre à frente dele */x.drawImage(body,9,8);drawWeapon(x,14+co*.5,16.5+s*.4,a+tilt*RL_TILT[kind][ph],mdl,ph,sk)}
else{if(s<-.35)drawWeapon(x,hx,hy,a,mdl,null,sk);x.drawImage(body,9,8);if(s>=-.35)drawWeapon(x,hx,hy,a,mdl,null,sk)}}
else{if(s<-.35)drawGun(x,hx,hy,a,kind);x.drawImage(body,9,8);if(s>=-.35)drawGun(x,hx,hy,a,kind);}
const o=outlined(c);return{c:o,ax:15,ay:16}})}

/* ---------- cavalaria: cavalo (rotacionado por RotSprite) + cavaleiro em pé + sabre/lança ---------- */
function horseBase(team,ph){const c=mk(30,14),x=g2(c),R=box(x),T=TEAM[team],hi=mix(T.coat,'#ffffff',.2),L=mix(T.coatD,'#000000',.15);
R(3,6,4,2,T.coatD);R(1,7,3,2,T.coatD);/* cauda */
for(let j=-3;j<=3;j++){const w=Math.round(7*Math.sqrt(1-(j/3.7)*(j/3.7)));R(13-w,7+j,w*2,1,j<0?hi:j>1?T.coatD:T.coat)}/* corpo */
R(19,4,4,5,T.coat);R(19,4,4,1,hi);R(19,4,1,5,T.coatD);/* pescoço */
R(22,5,6,3,T.coat);R(22,5,6,1,hi);R(26,5,3,3,T.coatD);R(22,4,1,1,T.coatD);R(24,4,1,1,T.coatD);/* cabeça */
R(9,4,5,6,T.blanket);R(10,5,3,4,'#2a211a');/* manta + sela */
if(ph===0){R(21,2,1,3,L);R(23,1,1,3,L);R(21,9,1,3,L);R(23,10,1,3,L);R(4,2,1,3,L);R(6,1,1,3,L);R(4,9,1,3,L);R(6,10,1,3,L)}else{R(16,2,1,3,L);R(18,3,1,2,L);R(16,9,1,3,L);R(18,9,1,2,L);R(8,2,1,3,L);R(10,3,1,2,L);R(8,9,1,3,L);R(10,9,1,2,L)}
return c}
function cavalrySprite(team,d,ph,charge){return cached(`cav${team}${d}${ph}${charge}`,()=>{const a=d*TAU/16,s=Math.sin(a),co=Math.cos(a),facing=s>.55?'front':s<-.55?'back':'side',c=mk(48,48),x=g2(c);
const hr=rotSprite(horseBase(team,ph),a);x.drawImage(hr,24-Math.floor(hr.width/2),27-Math.floor(hr.height/2));
let body=bodyCanvas(team,facing,0,true);if(facing==='side'&&co<0)body=flipX(body);
const kind=charge?'lance':'saber';if(s<-.35)drawGun(x,24+co*2,19+s*2,a,kind);x.drawImage(body,20,13);if(s>=-.35)drawGun(x,24+co*2,19+s*2,a,kind);
return{c:outlined(c),ax:25,ay:27}})}

/* ---------- tanque: casco + esteiras animadas + torre; 16 direções por RotSprite ---------- */
function tankBase(team,ph,wreck){const c=mk(40,24),x=g2(c),R=box(x),T=TEAM[team];
const hull=wreck?'#3a3733':T.hull,hh=wreck?'#55504a':T.hullH,hd=wreck?'#23211f':T.hullD,hdd=wreck?'#171614':T.hullDD,mark=wreck?'#6b4a2a':T.mark;
for(const y0 of[2,17]){R(8,y0,25,5,'#1c2018');R(9,y0+1,23,3,'#323829');R(9,y0+1,23,1,'#454c3a');for(let k=0;k<9;k++){const xx=9+((k*3+ph)%24);if(xx<32)R(xx,y0+2,1,2,'#151913')}
x.clearRect(8,y0,1,1);x.clearRect(8,y0+4,1,1);x.clearRect(32,y0,1,1);x.clearRect(32,y0+4,1,1);R(10,y0,1,5,'#5a6249');R(30,y0,1,5,'#5a6249')}
R(10,6,20,12,hdd);R(11,7,18,10,hull);R(11,7,18,1,hh);R(11,7,1,10,hh);R(11,16,18,1,hd);R(28,7,1,10,hd);
for(let i=0;i<4;i++)R(12,8+i*2,4,1,hd);R(17,8,1,8,hd);R(26,8,3,8,hh);R(26,8,1,8,hd);
R(13,7,2,1,mark);R(13,16,2,1,mark);
if(wreck){for(let i=0;i<14;i++){const px=11+Math.floor(((i*7)%18)),py=7+((i*5)%10);R(px,py,2,1,'#141312')}R(14,9,5,4,'#241f1b')}
const cx=wreck?17:20,cy=12,rr=30;for(let j=-5;j<=5;j++)for(let i=-5;i<=5;i++){const d2=i*i+j*j;if(d2>rr)continue;const edge=d2>rr-9;let col=edge?hdd:hull;if(!edge){const l=(-i-j)/8;col=l>.55?hh:l<-.55?hd:hull}
x.fillStyle=wreck?mix(col,'#15130f',.5):col;x.fillRect(cx+i,cy+j,1,1)}
R(cx-1,cy-2,3,3,wreck?'#1b1a18':hd);R(cx,cy-1,1,1,mark);
if(wreck){R(cx+4,cy-1,9,2,'#1f1f1c');R(cx+4,cy-1,9,1,'#34342f')}else{R(cx+4,cy-1,14,2,'#23271f');R(cx+4,cy-1,14,1,'#4a5145');R(cx+16,cy-2,3,4,'#181b15');R(cx+5,cy-2,2,4,hd)}
return c}
function tankSprite(team,d,ph){return cached(`tk${team}${d}${ph}`,()=>{const r=rotSprite(tankBase(team,ph,false),d*TAU/16);return{c:outlined(r),ax:Math.floor(r.width/2)+1,ay:Math.floor(r.height/2)+1}})}
function wreckSprite(team,d){return cached(`wr${team}${d}`,()=>{const r=rotSprite(tankBase(team,0,true),d*TAU/16);return{c:outlined(r),ax:Math.floor(r.width/2)+1,ay:Math.floor(r.height/2)+1}})}

/* ---------- corpos no chão: poses desenhadas à mão (cabeça à direita), 4 variações, 8 direções ---------- */
const CORPSE_A=[ /* de bruços, braço dobrado para cima, fuzil ao lado */
'..................',
'...........UUu....',
'..........UuuUs...',
'.bkkk..ppuuuuUhhh.',
'bkKkk.ppPPPPuuhHhh',
'bkKK..ppPPPPuuhhhS',
'.kkkkkppPPPPuuUhhh',
'..KkkkpppuuuuUs...',
'.......UUUUUU.....',
'..wwwwwwwggggg....',
'..................'];
const CORPSE_B=[ /* de costas, braços abertos, capacete caído */
'..................',
'....UUUU..........',
'...UuuuuUs........',
'.bkkk.ppuuuu......',
'bkKkkkpptuuuUSssh.',
'bkKKkkpppuuuuSssHh',
'.kkkk.pptuuuuSssh.',
'..KKkkppuuuu......',
'...UuuuuUs....hh..',
'....UUUU.....hHhh.',
'..................'];
function corpseSprite(team,d8,v=0){return cached(`cp${team}${d8}${v}`,()=>{const pal=Object.assign({},TEAM[team],{w:'#7a5536',g:'#8d9484',T:TEAM[team].t,P:'#6a5337',p:'#8a6c45'}),base=fromGrid((v&2?CORPSE_B:CORPSE_A),pal),body=v&1?(()=>{const c=mk(base.width,base.height),x=g2(c);x.translate(0,base.height);x.scale(1,-1);x.drawImage(base,0,0);return c})():base,
a=d8*TAU/8,rb=rotSprite(body,a),ob=outlined(rb,.6),N=ob.width+8,c=mk(N,N),x=g2(c);
/* mancha escura no chão: elipse suave e uniforme, alinhada à pose */
const st=mk(24,14),sx=g2(st);sx.fillStyle='rgba(14,12,8,.2)';for(let j=-5;j<=5;j++){const w=Math.round(10*Math.sqrt(1-(j*j)/(5.6*5.6)));sx.fillRect(12-w,7+j,w*2,1)}sx.fillStyle='rgba(14,12,8,.14)';for(let k=0;k<9;k++){sx.fillRect(2+((k*7)%20),2+((k*5)%10),1,1)}
const rs=rotSprite(st,a);x.drawImage(rs,Math.floor(N/2-rs.width/2),Math.floor(N/2-rs.height/2));
x.drawImage(ob,Math.floor(N/2-ob.width/2),Math.floor(N/2-ob.height/2));
/* destaque de luz no capacete/ombros para dar volume */
return{c,ax:Math.floor(N/2),ay:Math.floor(N/2)}})}
function shadowSprite(rx,ry,alpha=.32){return cached(`sh${rx}${ry}${alpha}`,()=>{const c=mk(rx*2+1,ry*2+1),x=g2(c);x.fillStyle=`rgba(15,20,10,${alpha})`;for(let j=-ry;j<=ry;j++){const w=Math.floor(rx*Math.sqrt(Math.max(0,1-(j*j)/((ry+.5)*(ry+.5)))));x.fillRect(rx-w,ry+j,w*2+1,1)}return{c,ax:rx,ay:ry}})}
function ringSprite(rx,ry,col){return cached(`rg${rx}${ry}${col}`,()=>{const c=mk(rx*2+3,ry*2+3),x=g2(c);ring(x,rx+1,ry+1,rx,ry,col);return{c,ax:rx+1,ay:ry+1}})}

/* ---------- estruturas ---------- */
function trenchSprite(){return cached('trench',()=>{const c=mk(56,26),x=g2(c),R=box(x);
R(2,3,52,20,'#6b5a3c');R(3,2,50,1,'#8b7853');R(2,3,1,20,'#8b7853');R(2,22,52,1,'#4c3f29');R(53,4,1,19,'#4c3f29');x.clearRect(2,3,1,1);x.clearRect(53,3,1,1);x.clearRect(2,22,1,1);x.clearRect(53,22,1,1);
R(5,6,46,15,'#241e15');R(5,6,46,2,'#120f0a');R(5,19,46,2,'#4a3d29');R(6,8,44,11,'#5a4830');R(6,8,44,1,'#75603f');R(6,18,44,1,'#3d3120');
for(let k=6;k<50;k+=4)R(k,9,1,9,'#3d3120');for(let k=8;k<50;k+=11)R(k,9,2,9,'#6d5838');
for(let k=0;k<11;k++){const o=k%2;R(3+k*5,o,5,4,o?'#a8976e':'#b7a67c');R(3+k*5,o,5,1,'#cfc192');R(3+k*5,o+3,5,1,'#6e6045');R(3+k*5+4,o,1,4,'#7b6d4d')}
for(let k=0;k<6;k++){const o=k%2;R(5+k*9,22+o,6,3,o?'#9a8a62':'#a8976e');R(5+k*9,22+o,6,1,'#bcae84');R(5+k*9,24+o,6,1,'#5f5339')}
return{c,ax:28,ay:13}})}
function sandbagSprite(dmg=0){return cached('sb'+dmg,()=>{const c=mk(34,14),x=g2(c),R=box(x);for(let r=0;r<3;r++)for(let k=0;k<6;k++){const off=(r%2)*2,xx=2+k*5+off-(r%2?0:0),yy=2+r*3;if(xx+5>32)continue;R(xx,yy,5,3,r%2?'#ab9a70':'#b9a97e');R(xx,yy,5,1,'#d0c293');R(xx+4,yy,1,3,'#7e7050');R(xx,yy+2,5,1,'#7a6c4c')}
x.fillStyle='rgba(15,20,10,.3)';x.fillRect(3,11,29,2);const o=outlined(c,.55);return dmg?degrade(o,dmg):{c:o,ax:18,ay:8}})}
function wireSprite(dmg=0){return cached('wr'+dmg,()=>{const c=mk(39,18),x=g2(c),R=box(x);x.fillStyle='rgba(15,20,10,.28)';x.fillRect(3,14,34,2);
for(const px of[3,34]){R(px,3,2,11,'#6b5a40');R(px,3,1,11,'#8a7656');R(px-1,2,4,2,'#3e3221')}
for(let row=0;row<2;row++){const y0=6+row*3;let lx=6,ly=y0;for(let i=1;i<=8;i++){const nx=6+i*3.4,ny=y0+(i%2?5:0);pline(x,lx,ly,nx,ny,'#2a2f2a');pline(x,lx+1,ly,nx+1,ny,'#727a6d',2);if(i%2===0){plot(x,nx,ny-1,'#c9cdc0');plot(x,nx+2,ny+1,'#c9cdc0')}lx=nx;ly=ny}}
const o=outlined(c,.5);return dmg?degrade(o,dmg):{c:o,ax:20,ay:10}})}
function bunkerSprite(team,dmg=0){return cached(`bk${team}${dmg}`,()=>{const c=mk(36,30),x=g2(c),R=box(x),T=TEAM[team];x.fillStyle='rgba(15,20,10,.3)';x.fillRect(5,24,26,4);
R(5,4,25,20,'#838878');R(5,4,25,1,'#b3b7a8');R(5,4,1,20,'#a4a899');R(5,23,25,1,'#5d6257');R(29,4,1,20,'#646a5d');
R(6,5,23,18,'#8f9485');for(let i=0;i<18;i++){const px=7+((i*11)%21),py=6+((i*7)%15);R(px,py,1,1,i%2?'#a3a798':'#767b6d')}R(6,13,23,1,'#767b6d');R(17,5,1,8,'#767b6d');R(11,14,1,9,'#767b6d');
R(30,7,3,14,'#595e52');R(30,7,3,1,'#767b6d');R(30,11,3,5,'#12140d');R(32,12,4,2,'#22251e');R(32,12,4,1,'#4c5146');
R(8,6,5,3,'#b09f76');R(8,6,5,1,'#cfc192');R(13,6,4,3,'#a39268');R(8,20,4,3,'#a39268');R(8,20,4,1,'#cfc192');
R(22,7,1,6,T.hullDD);R(23,7,4,3,T.mark);R(23,7,4,1,mix(T.mark,'#ffffff',.3));
const o=outlined(c,.6);return dmg?degrade(o,dmg):{c:o,ax:19,ay:16}})}
function degrade(sp,level){const c=mk(sp.width,sp.height),x=g2(c);x.drawImage(sp,0,0);const im=x.getImageData(0,0,c.width,c.height),d=im.data;srand(77+level);for(let i=0;i<d.length;i+=4){if(d[i+3]&&sr()<.07*level){d[i]*=.42;d[i+1]*=.42;d[i+2]*=.42}if(d[i+3]&&sr()<.03*level*level)d[i+3]=0}x.putImageData(im,0,0);return{c,ax:Math.floor(c.width/2),ay:Math.floor(c.height/2)}}
function structureSprite(type,team,hpRatio=1){const dm=hpRatio<.34?2:hpRatio<.67?1:0;if(type==='trench'){const s=trenchSprite();return dm?cached(`trd${dm}`,()=>degrade(s.c,dm)):s}
if(type==='sandbag'){return sandbagSprite(dm)}if(type==='wire')return wireSprite(dm);const s=bunkerSprite(team,dm);return team?cached('bkf'+dm,()=>({c:flipX(s.c),ax:s.c.width-s.ax-1,ay:s.ay})):s}

/* ---------- aviões biplano (vistos de cima, voando para a direita; espelhados para o time 1) ---------- */
function planeBase(kind,team,prop){const T=TEAM[team];if(kind==='fighter'){const c=mk(44,38),x=g2(c),R=box(x);
R(14,1,8,36,T.wing);R(14,1,8,1,mix(T.wing,'#fff',.35));R(14,36,8,1,T.wingD);R(21,1,1,36,T.wingD);
R(18,4,7,30,mix(T.wing,'#ffffff',.14));R(18,4,7,1,mix(T.wing,'#fff',.45));R(24,4,1,30,T.wingD);
for(const y of[7,14,23,30])R(17,y,1,2,'#3b3126');
R(4,16,32,6,'#6d6b52');R(4,16,32,1,'#908d70');R(4,21,32,1,'#46452f');R(33,15,5,8,'#3a3d33');R(33,15,5,1,'#5d6152');
R(1,10,5,18,T.wing);R(1,10,5,1,mix(T.wing,'#fff',.35));R(0,17,3,4,T.wingD);
R(24,17,4,4,'#20231b');R(25,18,2,2,'#7a8170');
disc(x,26,7,2,'#e9e6d2');disc(x,26,7,1,T.mark);disc(x,26,30,2,'#e9e6d2');disc(x,26,30,1,T.mark);
R(38,17,3,1,'#2a2c25');R(38,21,3,1,'#2a2c25');
if(prop){R(40,10,1,18,'#d8d8cc');x.globalAlpha=.4;R(39,10,3,18,'#b9bdb0');x.globalAlpha=1}else{R(40,14,1,10,'#d8d8cc');R(39,17,3,4,'#a9ada0')}
return c}
const c=mk(62,54),x=g2(c),R=box(x);
R(22,2,12,50,T.wing);R(22,2,12,1,mix(T.wing,'#fff',.35));R(22,51,12,1,T.wingD);R(33,2,1,50,T.wingD);
R(28,6,8,42,mix(T.wing,'#ffffff',.14));R(28,6,8,1,mix(T.wing,'#fff',.45));R(35,6,1,42,T.wingD);
for(const y of[9,17,26,35,43])R(26,y,1,2,'#3b3126');
R(6,23,44,8,'#7b7a5c');R(6,23,44,1,'#a19e7d');R(6,30,44,1,'#4c4b34');
R(46,24,8,6,'#8fa6a2');R(46,24,8,1,'#c4d8d5');R(48,25,1,4,'#56706f');R(4,14,8,24,T.wing);R(4,14,8,1,mix(T.wing,'#fff',.35));R(1,24,4,6,T.wingD);
R(40,25,5,4,'#20231b');
for(const y of[9,42]){R(18,y,12,7,'#3f4338');R(18,y,12,1,'#666a5c');R(17,y+1,2,5,'#2a2d25');if(prop){R(15,y-3,1,13,'#d8d8cc');x.globalAlpha=.4;R(14,y-3,3,13,'#b9bdb0');x.globalAlpha=1}else{R(15,y+1,1,5,'#d8d8cc')}}
disc(x,31,11,2,'#e9e6d2');disc(x,31,11,1,T.mark);disc(x,31,42,2,'#e9e6d2');disc(x,31,42,1,T.mark);
return c}
function planeSprite(kind,team,prop){return cached(`pl${kind}${team}${prop}`,()=>{let o=outlined(planeBase(kind,team,prop),.55);if(team)o=flipX(o);return{c:o,ax:Math.floor(o.width/2),ay:Math.floor(o.height/2),sh:silhouette(o,'#0e1409',.3)}})}

/* ---------- mini fonte 3×5 para as letras dos objetivos e outros textos curtos ---------- */
const GLYPH={A:['010','101','111','101','101'],B:['110','101','110','101','110'],C:['011','100','100','100','011'],'0':['111','101','101','101','111'],'1':['010','110','010','010','111'],'2':['110','001','010','100','111'],'3':['110','001','110','001','110'],'4':['101','101','111','001','001'],'5':['111','100','110','001','110'],'6':['011','100','111','101','111'],'7':['111','001','010','010','010'],'8':['111','101','111','101','111'],'9':['111','101','111','001','110']};
function glyph(x,ch,gx,gy,col){const g=GLYPH[ch];if(!g)return;x.fillStyle=col;for(let j=0;j<5;j++)for(let i=0;i<3;i++)if(g[j][i]==='1')x.fillRect(gx+i,gy+j,1,1)}

/* ---------- ícones das cartas (canvas 56×56, ampliação inteira) ---------- */
const ICONS={artillery:['....oo....','...occo...','...occo...','...occo...','...oCCo...','..oCCCCo..','..oSSSSo..','..oSSSSo..','..oSSSSo..','..oBBBBo..','..oBBBBo..','...oooo...'],
reinforce:['...oooo...','...oppo...','.ooopppooo.','oppppppppo','oppppppppo','.ooopppooo.','...oppo...','...oppo...','...oooo...']};
function iconCanvas(type,team=0){const c=mk(56,56),x=g2(c);x.imageSmoothingEnabled=false;x.fillStyle='#1a2017';x.fillRect(2,0,52,56);x.fillRect(0,2,56,52);x.fillStyle='#2a3324';x.fillRect(3,3,50,50);x.fillStyle='#323d2a';x.fillRect(3,3,50,2);x.fillRect(3,3,2,50);x.fillStyle='#232b1f';x.fillRect(3,51,50,2);x.fillRect(51,3,2,50);const put=(sp,ox,oy,s)=>{x.drawImage(sp.c||sp,0,0,(sp.c||sp).width,(sp.c||sp).height,Math.round(28-(sp.ax||(sp.width/2))*s+ox),Math.round(28-(sp.ay||(sp.height/2))*s+oy),(sp.c||sp).width*s,(sp.c||sp).height*s)};
if(type==='rifle')put(infantrySprite(team,'rifle',team?1:15,0,'rifle',null,null,true),0,-2,3);else if(type==='mg')put(infantrySprite(team,'mg',team?8:0,0,'mg'),team?4:-4,-2,3);else if(type==='tank'){const tk=(window.PX&&PX.tankSprite||tankSprite)(team,team?6:2,0);put(tk,0,0,1)}else if(type==='cavalry')put(cavalrySprite(team,team?8:0,0,false),0,0,2);
else if(type==='trench')put(structureSprite('trench',0),0,0,1);else if(type==='sandbag')put(structureSprite('sandbag',0),0,0,1.0);else if(type==='wire')put(structureSprite('wire',0),0,0,1);else if(type==='bunker')put(structureSprite('bunker',0),0,0,1.5>1?1:1);
else if(type==='fighter')put(planeSprite('fighter',0,false),0,0,1);
else if(type==='artillery'){const pal={o:INK,c:'#c9b27a',C:'#e0cf9b',S:'#8a9668',B:'#b58a45'};x.drawImage(fromGrid(ICONS.artillery,pal),0,0,10,12,18,4,30,36);x.fillStyle='#ffb347';for(const[a,b]of[[6,44],[12,49],[24,46],[36,50],[44,45]])x.fillRect(a,b,4,4);x.fillStyle='#e4e8b8';for(const[a,b]of[[9,47],[30,49],[41,47]])x.fillRect(a,b,3,3)}
else if(type==='bomber'){for(let i=0;i<3;i++){const bx=9+i*15;x.fillStyle=INK;x.fillRect(bx,10,10,4);x.fillStyle='#6f7b58';x.fillRect(bx+1,14,8,22);x.fillStyle='#8f9b74';x.fillRect(bx+1,14,3,22);x.fillStyle=INK;x.fillRect(bx,36,10,3);x.fillStyle='#c9b27a';x.fillRect(bx+2,38,6,6);x.fillStyle='#b85b3a';x.fillRect(bx+1,18,8,3)}}
else if(type==='reinforce'){const pal={o:INK,p:'#c5db91'};x.drawImage(fromGrid(ICONS.reinforce,pal),0,0,10,9,8,7,40,36);x.fillStyle='#e9f3c4';x.fillRect(24,14,8,3)}
return c}
function drawIcon(type,x2,team=0){x2.clearRect(0,0,56,56);x2.drawImage(iconCanvas(type,team),0,0)}

Object.assign(window.PX=window.PX||{},{RL_N,Z,INK,TAU,clamp,mk,g2,pline,disc,ring,glyph,dir16,dir8,FRAMES,infantrySprite,cavalrySprite,tankSprite,wreckSprite,corpseSprite,shadowSprite,ringSprite,structureSprite,planeSprite,drawIcon,iconCanvas,hex2rgb,pack,box,cached,outlined,silhouette,srand,sr,trenchSprite,wireSprite,mix,plot,fromGrid,flipX,rotSprite,TEAM,degrade});
})();
