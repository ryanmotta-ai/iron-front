'use strict';
/* Iron Front — aviões históricos de 1918, vistos de cima (nariz para +x; o time 1 é espelhado).
   time 0 = Estados Unidos (AEF Air Service):
     caça     SPAD S.XIII  (Hispano-Suiza 8B, duas Vickers no capô, fuselagem de compensado envernizado, asas em verde-oliva, rondel 1918 azul-branco-vermelho)
     bombardeiro  Airco DH-4 "Liberty Plane" (motor Liberty V-12, radiador frontal, artilheiro com anel Scarff + Lewis duplas)
   time 1 = Império Alemão (Luftstreitkräfte):
     caça     Fokker D.VII (Mercedes D.IIIa, caixa-radiador, 2 LMG 08/15, asas com estampa de losangos, Balkenkreuz, capô vermelho estilo Jasta 11)
     bombardeiro  Gotha G.V (2 Mercedes D.IVa em nacelas, torre de proa e dorsal, asas de 23,7 m com losangos)
   Escala ~6 px/m (caças) e ~5,2 px/m (bombardeiros); 1 px de arte = 2 unidades de mundo.
   Sobrescreve PX.planeSprite e PX.drawIcon (cartas) e exporta PX.PLANES (medidas para as armas e bombas). Carregar antes de pixel.js. */
(function(){
const PX=window.PX;if(!PX||!PX.outlined)return;
const{mk,g2,mix,cached,outlined,silhouette,flipX}=PX;
const hash=(x,y,s)=>{let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(s|0,1442695041))|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296};
const cl=(v,a,b)=>Math.max(a,Math.min(b,v));

/* ---------- ferramentas de pixel ---------- */
function canvas(w,h){const c=mk(w,h),x=g2(c);x.imageSmoothingEnabled=false;return{c,x,w,h}}
const R=(x,a,b,w,h,col)=>{x.fillStyle=col;x.fillRect(Math.round(a),Math.round(b),w,h)};
const P=(x,a,b,col)=>{x.fillStyle=col;x.fillRect(Math.round(a),Math.round(b),1,1)};
function L(x,x0,y0,x1,y1,col){x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);const dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let e=dx+dy;x.fillStyle=col;for(;;){x.fillRect(x0,y0,1,1);if(x0===x1&&y0===y1)break;const e2=2*e;if(e2>=dy){e+=dy;x0+=sx}if(e2<=dx){e+=dx;y0+=sy}}}
function E(x,cx,cy,rx,ry,col){x.fillStyle=col;for(let j=-Math.floor(ry);j<=Math.floor(ry);j++){const w=Math.floor(rx*Math.sqrt(Math.max(0,1-(j*j)/((ry+.5)*(ry+.5)))));x.fillRect(Math.round(cx)-w,Math.round(cy)+j,w*2+1,1)}}
/* preenche uma forma definida por inside(i,j); col(i,j,e) recebe as bordas {t,b,l,r} para luz em cima-esquerda */
function shape(o,x0,y0,w,h,inside,col){const m=[];for(let j=-1;j<=h;j++){m[j+1]=[];for(let i=-1;i<=w;i++)m[j+1][i+1]=(i>=0&&j>=0&&i<w&&j<h)&&inside(i,j)}
 const at=(i,j)=>m[j+1][i+1];for(let j=0;j<h;j++)for(let i=0;i<w;i++){if(!at(i,j))continue;const e={t:!at(i,j-1),b:!at(i,j+1),l:!at(i-1,j),r:!at(i+1,j)};const c=col(i,j,e);if(c){o.x.fillStyle=c;o.x.fillRect(x0+i,y0+j,1,1)}}}
/* retângulo de cantos arredondados (asas, estabilizadores) */
const rr=(w,h,r)=>(i,j)=>{const dx=i<r?r-i-.5:i>=w-r?i-(w-r)+.5:0,dy=j<r?r-j-.5:j>=h-r?j-(h-r)+.5:0;return dx*dx+dy*dy<=r*r+.35};
/* losangos de quatro/cinco cores (estampa de fábrica alemã), com linhas escuras entre as células */
const LOZ=['#7d8b70','#8f8897','#a8946e','#61745a','#7c6458'];
function lozenge(i,j,seed=1,size=4.6){const yy=j/(size*.78),row=Math.floor(yy),xx=i/size-(row&1)*.5,col=Math.floor(xx),fx=xx-col,fy=yy-row,id=hash(col,row,seed),k=Math.floor(id*5),edge=fx<.14||fy<.17;return edge?mix(LOZ[k],'#20231b',.42):mix(LOZ[k],'#4a4e3c',.16)}
/* hélice: parado (duas pás) ou em rotação (disco translúcido) */
function prop(o,cx,cy,len,spin,blade='#8a6238',tip='#d9b556'){const x=o.x;
 if(spin){x.globalAlpha=.22;E(x,cx,cy,1.7,len/2,'#c9ccc2');x.globalAlpha=.34;E(x,cx,cy,1.1,len/2-1,'#dfe2d6');x.globalAlpha=1;R(x,cx,cy-len/2,1,len,'rgba(255,255,255,.35)');x.globalAlpha=.6;P(x,cx,cy-len/2,tip);P(x,cx,cy+len/2-1,tip);x.globalAlpha=1}
 else{R(x,cx-1,cy-len/2,2,len,blade);R(x,cx-1,cy-len/2,1,len,mix(blade,'#fff',.25));R(x,cx-1,cy-len/2,2,1,tip);R(x,cx-1,cy+len/2-1,2,1,tip);P(x,cx,cy,'#2a2d30')}}
/* rondel americano 1918 (azul externo, branco, vermelho no centro) */
function usRoundel(x,cx,cy,r){E(x,cx,cy,r,r,'#23407a');E(x,cx,cy,r*.72,r*.72,'#e9e6d8');E(x,cx,cy,r*.38,r*.38,'#b3302b')}
/* cruz de Balkenkreuz 1918: braços retos pretos com filete branco */
function balkenkreuz(x,cx,cy,s){const a=s/2;R(x,cx-a-1,cy-1-(s>8?1:0),s+2,3+(s>8?2:0),'#e9e6d8');R(x,cx-1-(s>8?1:0),cy-a-1,3+(s>8?2:0),s+2,'#e9e6d8');R(x,cx-a,cy-(s>8?1:0),s,1+(s>8?2:0),'#15130f');R(x,cx-(s>8?1:0),cy-a,1+(s>8?2:0),s,'#15130f')}
const INKC='#15130f';

/* ================= SPAD S.XIII (EUA) ================= */
function spad(spin){const W=60,H=56,o=canvas(W,H),x=o.x,cy=28;
 const OD=['#3e3f29','#575838','#6f7049','#8b8c5e','#a4a574'],WOOD=['#6b4f2e','#85653a','#a07c48','#bb965b'],BLUE=['#1e3568','#2b4a8a','#4468a8','#6b8ac4'];
 /* asa inferior (mais escura, deslocada pela paralaxe) */
 shape(o,26,7,8,46,rr(8,46,2),(i,j,e)=>e.t?OD[2]:e.b||e.r?OD[0]:OD[1]);
 /* estabilizador e profundores */
 shape(o,7,19,8,18,rr(8,18,2),(i,j,e)=>{const hinge=i===3;return hinge?OD[0]:e.t||e.l?OD[3]:e.b||e.r?OD[1]:OD[2]});
 R(x,7,27,8,2,OD[1]);
 /* deriva e leme (vistos de topo) com listras 1918: azul (dobradiça), branco, vermelho (borda de fuga) */
 R(x,3,27,2,2,'#b3302b');R(x,5,27,2,2,'#e9e6d8');R(x,7,27,3,2,'#2b4a8a');R(x,3,28,7,1,'rgba(0,0,0,.25)');
 /* fuselagem: compensado envernizado */
 shape(o,6,22,42,13,(i,j)=>{const fx=i+6,hw=fx<18?.5+(fx-6)/12*2:fx<30?2.6:fx<44?3.2:Math.max(1.2,3.2-(fx-44)*1.1);return Math.abs(j+22-cy+.5)<=hw},(i,j,e)=>{const d=(j+22-cy+.5);return e.t?WOOD[3]:e.b?WOOD[0]:d<-1?WOOD[2]:d>1?WOOD[1]:WOOD[2]});
 for(let k=0;k<9;k++)R(x,10+k*3,cy-2,1,5,'rgba(60,40,20,.28)');            // cavernas
 /* cockpit, piloto */
 R(x,17,cy-2,5,4,'#15100b');E(x,20,cy,1.6,1.6,'#d6b48a');R(x,19,cy-1,2,1,'#3a2a1a');P(x,21,cy,'#6b4f2e');L(x,23,cy-2,23,cy+1,'#7f9ba3');
 /* capô azul + Vickers */
 shape(o,30,cy-4,16,8,(i,j)=>{const hw=i<12?3.6:3.6-(i-11)*.7;return Math.abs(j+.5-4)<=hw},(i,j,e)=>e.t?BLUE[3]:e.b?BLUE[0]:j<3?BLUE[2]:BLUE[1]);
 R(x,32,cy-2,10,1,BLUE[3]);
 for(const dy of[-2,1]){R(x,35,cy+dy,9,1,'#20242a');P(x,44,cy+dy,'#0c0d0f');R(x,34,cy+dy,2,1,'#6d737a')}
 /* radiador frontal em colmeia e cubo */
 R(x,46,cy-3,2,7,'#8a7a4a');for(let j=0;j<7;j+=2)P(x,46,cy-3+j,'#b29a5e');R(x,46,cy-3,2,1,'#c9b378');R(x,47,cy-3,1,7,'#5e4e2a');
 R(x,48,cy-1,2,3,'#b8923a');P(x,48,cy-1,'#f0d27a');
 /* rodas e eixo do trem de pouso */
 R(x,36,cy-9,5,2,INKC);R(x,36,cy+8,5,2,INKC);P(x,37,cy-9,'#5a5d52');P(x,37,cy+8,'#5a5d52');L(x,38,cy-8,38,cy-4,'#3a3326');L(x,38,cy+4,38,cy+8,'#3a3326');
 /* asa superior: verde-oliva, nervuras e ailerons */
 shape(o,25,4,9,48,rr(9,48,2),(i,j,e)=>{let c=e.t?OD[4]:e.l?OD[3]:e.b?OD[0]:e.r?OD[1]:OD[2];if(i===2&&(j<14||j>33))c=OD[0];if(!e.t&&!e.b&&!e.l&&!e.r&&j%6===2&&i>2)c=OD[1];return c});
 R(x,26,cy-2,7,4,OD[2]);                                                           // seção central
 usRoundel(x,29.5,12.5,4.2);usRoundel(x,29.5,43.5,4.2);
 /* montantes em N e cabanes */
 for(const yy of[cy-14,cy+14,cy-5,cy+5]){R(x,26,yy,1,2,INKC);R(x,32,yy,1,2,INKC)}
 L(x,26,cy-14,32,cy-5,'rgba(25,25,18,.45)');L(x,26,cy+14,32,cy+5,'rgba(25,25,18,.45)');
 prop(o,51,cy,17,spin);
 return o.c}

/* ================= Fokker D.VII (Alemanha) ================= */
function d7(spin){const W=64,H=58,o=canvas(W,H),x=o.x,cy=29;
 const RED=['#5a1612','#8a211a','#b3302b','#d4584c'],GRY=['#5d666c','#7d878e','#9ba6ac','#b9c2c7'],OD=['#3b3d2d','#575a42','#6d7056'];
 /* asa inferior: corda curta, deslocada */
 shape(o,30,6,6,47,rr(6,47,2),(i,j,e)=>lozenge(i+30,j+6,4,4.6));
 shape(o,30,6,6,47,rr(6,47,2),(i,j,e)=>e.b||e.r?'rgba(18,20,14,.55)':e.t?'rgba(255,255,240,.18)':null);
 /* estabilizador (quase retangular) */
 shape(o,9,19,8,21,rr(8,21,2),(i,j,e)=>{const base=lozenge(i+9,j+19,7,3.9);return e.t||e.l?mix(base,'#fff',.22):e.b||e.r?mix(base,'#000',.45):i===3?mix(base,'#000',.4):base});
 /* deriva e leme: leme quadrado branco/vermelho */
 R(x,4,28,4,2,'#e9e6d8');R(x,8,28,2,2,RED[2]);R(x,4,28,1,2,RED[1]);R(x,4,30,6,1,'rgba(0,0,0,.25)');
 /* fuselagem angular: cinza-azulado, traseira vermelha, capô vermelho */
 shape(o,7,24,44,11,(i,j)=>{const fx=i+7,hw=fx<14?.6+(fx-7)/7*1.6:fx<30?2.4:fx<44?2.8:2.8;return Math.abs(j+24-cy+.5)<=hw},(i,j,e)=>{const fx=i+7,d=j+24-cy+.5;const tail=fx<17,base=tail?RED:GRY;return e.t?base[3]:e.b?base[0]:d<-.8?base[2]:base[1]});
 for(let k=0;k<7;k++)R(x,17+k*3,cy-2,1,4,'rgba(30,38,44,.3)');
 /* cockpit aberto, piloto */
 R(x,24,cy-2,5,4,'#15120e');E(x,26,cy,1.6,1.6,'#d6b48a');R(x,25,cy-1,2,1,'#3a3b2a');R(x,23,cy-2,1,4,'#6f8a94');
 /* capô vermelho + duas LMG 08/15 + caixa-radiador */
 shape(o,36,cy-4,14,8,(i,j)=>{const hw=i<11?3.7:3.7-(i-10)*.3;return Math.abs(j+.5-4)<=hw},(i,j,e)=>e.t?RED[3]:e.b?RED[0]:j<3?RED[2]:RED[1]);
 R(x,37,cy-2,9,1,RED[3]);
 for(const dy of[-2,1]){R(x,39,cy+dy,10,1,'#20242a');P(x,49,cy+dy,'#0c0d0f');R(x,38,cy+dy,2,1,'#72787e')}
 R(x,50,cy-4,3,9,GRY[2]);R(x,50,cy-4,3,1,GRY[3]);R(x,52,cy-4,1,9,GRY[0]);for(let j=-3;j<=3;j+=2)P(x,51,cy+j,GRY[0]);
 R(x,53,cy-1,2,3,'#b8923a');P(x,53,cy-1,'#f0d27a');
 /* trem de pouso */
 R(x,40,cy-10,5,2,INKC);R(x,40,cy+9,5,2,INKC);P(x,41,cy-10,'#5a5d52');P(x,41,cy+9,'#5a5d52');L(x,42,cy-9,42,cy-4,'#2b2a22');L(x,42,cy+4,42,cy+9,'#2b2a22');
 /* asa superior: losangos, corda larga e compensadores dos ailerons */
 shape(o,28,3,11,53,rr(11,53,2),(i,j,e)=>{const base=lozenge(i+28,j+3,4,4.6);let c=e.t||e.l?mix(base,'#fff',.26):e.b||e.r?mix(base,'#000',.42):base;if((i===3)&&(j<17||j>35))c=mix(base,'#000',.4);if(!e.t&&!e.b&&!e.l&&!e.r&&j%7===3&&i>3)c=mix(base,'#000',.2);return c});
 R(x,26,3,2,3,OD[2]);R(x,26,cy+24,2,3,OD[2]);R(x,26,3,1,3,INKC);R(x,26,cy+24,1,3,INKC);        // hastes de compensação
 balkenkreuz(x,33,11,7);balkenkreuz(x,33,47,7);
 /* interplanares e cabanes */
 for(const yy of[cy-15,cy+15,cy-6,cy+6]){R(x,30,yy,1,2,INKC);R(x,36,yy,1,2,INKC)}
 L(x,30,cy-15,36,cy-6,'rgba(25,25,18,.4)');L(x,30,cy+15,36,cy+6,'rgba(25,25,18,.4)');
 prop(o,57,cy,18,spin,'#9a6b3a','#b8923a');
 return o.c}

/* ================= Airco DH-4 "Liberty Plane" (EUA) ================= */
function dh4(spin){const W=90,H=80,o=canvas(W,H),x=o.x,cy=40;
 const OD=['#3e3f29','#575838','#6f7049','#8b8c5e','#a4a574'],MT=['#3b3f43','#5d646b','#7d858c','#aab1b6'];
 /* asa inferior */
 shape(o,36,8,9,65,rr(9,65,2),(i,j,e)=>e.t?OD[2]:e.b||e.r?OD[0]:OD[1]);
 /* estabilizador, profundores, deriva com listras */
 shape(o,14,26,11,28,rr(11,28,3),(i,j,e)=>{const hinge=i===5;return hinge?OD[0]:e.t||e.l?OD[3]:e.b||e.r?OD[1]:OD[2]});
 R(x,14,cy-1,11,2,OD[1]);
 R(x,8,cy-1,3,2,'#b3302b');R(x,11,cy-1,3,2,'#e9e6d8');R(x,14,cy-1,4,2,'#2b4a8a');
 /* fuselagem */
 shape(o,12,cy-5,58,10,(i,j)=>{const fx=i+12,hw=fx<26?.7+(fx-12)/14*2.6:fx<48?3.4:fx<62?3.6:Math.max(1.6,3.6-(fx-62)*.6);return Math.abs(j+cy-5-cy+.5)<=hw},(i,j,e)=>{const d=j+cy-5-cy+.5;return e.t?OD[4]:e.b?OD[0]:d<-1?OD[3]:d>1?OD[1]:OD[2]});
 for(let k=0;k<12;k++)R(x,16+k*3,cy-2,1,4,'rgba(35,36,22,.3)');
 /* cockpit do observador com anel Scarff e duas Lewis apontando para trás */
 R(x,30,cy-3,7,6,'#15100b');E(x,33,cy,3,3,'#2a2c22');E(x,33,cy,2,2,'#15100b');E(x,34,cy,1.3,1.3,'#d6b48a');ring(x,33,cy,3.4);
 R(x,22,cy-2,9,1,'#20242a');R(x,22,cy+1,9,1,'#20242a');P(x,22,cy-2,'#0c0d0f');P(x,22,cy+1,'#0c0d0f');R(x,30,cy-3,2,6,'#6b6a49');
 /* cockpit do piloto sob a asa, metralhadora Marlin */
 R(x,46,cy-2,4,4,'#15100b');E(x,48,cy,1.3,1.3,'#d6b48a');
 /* motor Liberty: cabeçotes e escapamentos, capô metálico */
 shape(o,54,cy-4,14,8,(i,j)=>Math.abs(j+.5-4)<=(i<11?3.6:3.6-(i-10)*.6),(i,j,e)=>e.t?MT[3]:e.b?MT[0]:j<3?MT[2]:MT[1]);
 for(let k=0;k<4;k++){R(x,57+k*2,cy-3,1,1,'#8a6238');R(x,57+k*2,cy+2,1,1,'#8a6238')}
 R(x,62,cy-1,4,2,'#2a2d30');P(x,66,cy-1,'#0c0d0f');
 /* radiador frontal retangular em colmeia */
 R(x,68,cy-5,3,11,'#7d7456');R(x,68,cy-5,3,1,'#b0a474');R(x,70,cy-5,1,11,'#4a4330');for(let j=-4;j<=4;j+=2)P(x,69,cy+j,'#4a4330');
 R(x,71,cy-1,2,3,'#b8923a');P(x,71,cy-1,'#f0d27a');
 /* rodas */
 R(x,52,cy-14,6,2,INKC);R(x,52,cy+13,6,2,INKC);P(x,53,cy-14,'#5a5d52');P(x,53,cy+13,'#5a5d52');L(x,55,cy-12,55,cy-5,'#2b2a22');L(x,55,cy+12,55,cy+5,'#2b2a22');
 /* asa superior */
 shape(o,34,5,10,70,rr(10,70,2),(i,j,e)=>{let c=e.t?OD[4]:e.l?OD[3]:e.b?OD[0]:e.r?OD[1]:OD[2];if(i===2&&(j<22||j>47))c=OD[0];if(!e.t&&!e.b&&!e.l&&!e.r&&j%7===3&&i>2)c=OD[1];return c});
 R(x,35,cy-4,8,8,OD[3]);R(x,35,cy-4,8,1,OD[4]);                                     // seção central
 usRoundel(x,39,14,4.6);usRoundel(x,39,66,4.6);
 /* montantes: duas baias por lado */
 for(const yy of[cy-32,cy-19,cy-7,cy+7,cy+19,cy+32-2]){R(x,35,yy,1,2,INKC);R(x,43,yy,1,2,INKC)}
 L(x,35,cy-19,43,cy-7,'rgba(25,25,18,.4)');L(x,35,cy+19,43,cy+7,'rgba(25,25,18,.4)');L(x,35,cy-32,43,cy-19,'rgba(25,25,18,.35)');L(x,35,cy+30,43,cy+19,'rgba(25,25,18,.35)');
 prop(o,75,cy,21,spin,'#8a6238','#d9b556');
 return o.c}
function ring(x,cx,cy,r){x.fillStyle='#4a4d3a';const n=20;for(let k=0;k<n;k++){const a=k/n*Math.PI*2;x.fillRect(Math.round(cx+Math.cos(a)*r),Math.round(cy+Math.sin(a)*r),1,1)}}

/* ================= Gotha G.V (Alemanha) ================= */
function gotha(spin){const W=132,H=126,o=canvas(W,H),x=o.x,cy=63;
 const PLY=['#6b4f2e','#85653a','#a07c48','#bb965b'],MT=['#3b3f43','#5d646b','#7d858c','#aab1b6'],GR=['#3f4636','#565e49','#6e7760'];
 /* asa inferior, deslocada pela paralaxe */
 shape(o,47,13,14,101,rr(14,101,2),(i,j,e)=>{const base=lozenge(i+47,j+13,6,4.8);return e.b||e.r?mix(base,'#000',.42):e.t?mix(base,'#fff',.08):mix(base,'#000',.3)});
 /* cauda: estabilizador largo, profundores, deriva */
 shape(o,14,cy-20,18,40,rr(18,40,3),(i,j,e)=>{const base=lozenge(i+14,j+cy-20,9,4.4);return e.t||e.l?mix(base,'#fff',.24):e.b||e.r?mix(base,'#000',.45):i===7?mix(base,'#000',.4):base});
 R(x,14,cy-1,18,2,'rgba(20,22,16,.45)');
 R(x,4,cy-1,10,3,'#e9e6d8');R(x,4,cy-1,10,1,'#f7f5ea');R(x,4,cy+1,10,1,'rgba(0,0,0,.25)');R(x,4,cy-1,2,3,'#c9c5b4');
 /* fuselagem de madeira com painéis */
 shape(o,12,cy-6,78,12,(i,j)=>{const fx=i+12,hw=fx<34?1.1+(fx-12)/22*3.5:fx<70?4.6:Math.max(2.4,4.6-(fx-70)*.3);return Math.abs(j+cy-6-cy+.5)<=hw},(i,j,e)=>{const d=j+cy-6-cy+.5;return e.t?PLY[3]:e.b?PLY[0]:d<-1.5?PLY[2]:d>1.5?PLY[1]:PLY[2]});
 for(let k=0;k<18;k++)R(x,16+k*4,cy-4,1,8,'rgba(60,40,20,.25)');
 /* posições de tiro: proa (anel duplo), dorsal e nariz envidraçado */
 R(x,80,cy-3,10,6,'#2b2a22');E(x,86,cy,3,3,'#15100b');ring(x,86,cy,3.6);R(x,88,cy-1,4,1,'#20242a');R(x,88,cy+0,4,1,'#20242a');E(x,85,cy,1.2,1.2,'#d6b48a');
 R(x,62,cy-3,8,6,'#15100b');ring(x,66,cy,3.6);E(x,66,cy,2.2,2.2,'#2a2c22');E(x,66,cy,1.2,1.2,'#d6b48a');R(x,58,cy-1,7,1,'#20242a');R(x,58,cy,7,1,'#20242a');
 R(x,40,cy-3,6,6,'#15100b');E(x,43,cy,1.6,1.6,'#d6b48a');                          // cockpit do piloto
 /* nacelas do motor com radiadores e tubos */
 for(const dy of[-27,27]){const ny=cy+dy;
  R(x,54,ny-2,18,4,PLY[1]);                                                          // trave entre as asas
  shape(o,58,ny-5,21,10,(i,j)=>{const hw=i<2?2.4:i<15?4.6:4.6-(i-14)*.55;return Math.abs(j+.5-5)<=hw},(i,j,e)=>e.t?'#8a9070':e.b?'#2e3324':j<4?'#6b7157':'#565c46');R(x,60,ny-1,14,1,'rgba(30,34,24,.4)');
  for(let k=0;k<5;k++){R(x,62+k*3,ny-3,1,1,'#8a6238');R(x,62+k*3,ny+2,1,1,'#8a6238')}
  R(x,79,ny-6,5,12,'#7b7456');R(x,79,ny-6,5,1,'#b0a474');R(x,83,ny-6,1,12,'#4a4330');for(let j=-5;j<=5;j+=2)P(x,80,ny+j,'#4a4330');
  R(x,84,ny-1,2,3,'#b8923a');P(x,84,ny-1,'#f0d27a');
  prop(o,88,ny,25,spin,'#8a6238','#d9b556');
  R(x,68,ny+(dy<0?-9:7),5,2,INKC);P(x,69,ny+(dy<0?-9:7),'#5a5d52')}               // rodas
 /* asa superior */
 shape(o,44,4,14,118,rr(14,118,2),(i,j,e)=>{const base=lozenge(i+44,j+4,6,4.8);let c=e.t||e.l?mix(base,'#fff',.26):e.b||e.r?mix(base,'#000',.42):base;if(i===3&&(j<30||j>87))c=mix(base,'#000',.4);if(!e.t&&!e.b&&!e.l&&!e.r&&j%9===4&&i>3)c=mix(base,'#000',.22);return c});
 R(x,45,cy-5,12,10,PLY[2]);R(x,45,cy-5,12,1,PLY[3]);                               // passagem central
 balkenkreuz(x,51,22,11);balkenkreuz(x,51,104,11);
 for(const yy of[cy-52,cy-40,cy-27-8,cy-14,cy+12,cy+26+6,cy+38,cy+50]){R(x,45,yy,1,2,INKC);R(x,57,yy,1,2,INKC)}
 for(const s of[-1,1]){L(x,45,cy+s*52,57,cy+s*40,'rgba(25,25,18,.35)');L(x,45,cy+s*40,57,cy+s*14,'rgba(25,25,18,.35)')}
 return o.c}

/* ================= exportação ================= */
const MODELS={
 fighter:{0:{name:'SPAD S.XIII',draw:spad,muz:[[44,-2],[44,1]]},1:{name:'Fokker D.VII',draw:d7,muz:[[49,-2],[49,1]]}},
 bomber:{0:{name:'Airco DH-4',draw:dh4,exh:[[56,0]]},1:{name:'Gotha G.V',draw:gotha,exh:[[58,-27],[58,27]]}}};
function planeSprite(kind,team,prop){team=team?1:0;kind=kind==='bomber'?'bomber':'fighter';const spin=!!prop;
 return cached(`pln${kind}${team}${spin?1:0}`,()=>{const m=MODELS[kind][team],base=m.draw(spin);let o=outlined(base,.55);const sh=silhouette(o,'#0b1207',.3);if(team)o=flipX(o);
  const s=team?flipX(sh):sh;return{c:o,sh:s,ax:Math.floor(o.width/2),ay:Math.floor(o.height/2),name:m.name,bw:base.width}})}
/* medidas em px de arte a partir do centro do sprite (eixo para +x); o time 1 e espelhado */
function info(kind,team){team=team?1:0;kind=kind==='bomber'?'bomber':'fighter';return cached(`plninfo${kind}${team}`,()=>{const m=MODELS[kind][team],sp=planeSprite(kind,team,false),cx=sp.bw/2,fl=v=>team?-v:v;
  return{name:m.name,w:sp.c.width,h:sp.c.height,
   muzzles:(m.muz||[]).map(([mx,my])=>[fl(mx-cx),my]),exh:(m.exh||[]).map(([ex,ey])=>[fl(ex-cx),ey])}})}
PX.planeSprite=planeSprite;
PX.PLANES={MODELS,info,draw:{spad,d7,dh4,gotha}};

/* ícones das cartas (56×56): o avião do lado do jogador, reduzido; o bombardeio leva bombas */
const origDrawIcon=PX.drawIcon;
PX.drawIcon=function(type,x2,team=0){if(type!=='fighter'&&type!=='bomber')return origDrawIcon(type,x2,team);
 const c=mk(56,56),x=g2(c);x.imageSmoothingEnabled=false;
 x.fillStyle='#1a2017';x.fillRect(2,0,52,56);x.fillRect(0,2,56,52);x.fillStyle='#2a3324';x.fillRect(3,3,50,50);x.fillStyle='#323d2a';x.fillRect(3,3,50,2);x.fillRect(3,3,2,50);x.fillStyle='#232b1f';x.fillRect(3,51,50,2);x.fillRect(51,3,2,50);
 const sp=planeSprite(type,team,false),s=type==='fighter'?1:(team?.42:.6),w=sp.c.width*s,h=sp.c.height*s,ox=Math.round(28-w/2),oy=Math.round(type==='fighter'?28-h/2:22-h/2);
 x.drawImage(sp.sh,0,0,sp.sh.width,sp.sh.height,ox+3,oy+3,w,h);x.drawImage(sp.c,0,0,sp.c.width,sp.c.height,ox,oy,w,h);
 if(type==='bomber'){for(let i=0;i<3;i++){const bx=15+i*13;x.fillStyle='#15130f';x.fillRect(bx,38,6,14);x.fillStyle=team?'#6d7058':'#6f7049';x.fillRect(bx+1,39,4,12);x.fillStyle=team?'#8d9076':'#8b8c5e';x.fillRect(bx+1,39,1,12);x.fillStyle='#d9b556';x.fillRect(bx+1,44,4,1);x.fillStyle='#15130f';x.fillRect(bx,50,6,2)}}
 x2.clearRect(0,0,56,56);x2.drawImage(c,0,0)};
})();
