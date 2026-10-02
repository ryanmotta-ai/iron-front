'use strict';
/* Iron Front — refino da aviação (anim-air.js). Carrega por último (depois de heavyfx.js). Só visual/sonoro + a queda dos abatidos.
   Sprites ........ cada avião é um modelo 3D simples em metros (asas, fuselagem de revolução, empenagem, montantes, rodas, cabeças)
                    "rasterizado" por raio em pixels inteiros, já na orientação pedida (rumo 64 passos × inclinação lateral × arfagem):
                    sem rotação de canvas em tempo de desenho. Luz do sol de cima-esquerda por normal, sombra projetada da asa de
                    cima na de baixo, borda clara em cima/esquerda e contorno seletivo do art.js. Cache preguiçoso com orçamento por
                    quadro (≤ ~3 ms); enquanto o quadro novo não sai, usa o último do avião.
                    EUA: SPAD S.XIII (caça), Sopwith Camel (ataque, rotativo Clerget), Breguet 14 (observação), Salmson 2A2 (reconh.),
                    Airco DH-4 (bombardeiro). Alemanha: Fokker D.VII (losangos, sem estais), Halberstadt CL.II (cabine única, radiador na
                    asa), DFW C.V (escape "chifre"), Rumpler C.IV (pontas enflechadas), Gotha G.V (bimotor de hélices propulsoras).
                    Rondel dos EUA 1918 (vermelho fora, azul, centro branco; leme vermelho-branco-azul a partir do montante) e
                    Balkenkreuz 1918 de filete branco.
   Voo ............ rumo suavizado pela velocidade real; inclinação lateral = atan(v·ω/g) com mola própria de cada avião (Camel
                    nervoso com torque para a direita, Gotha pesado), arfagem no mergulho/recuperação do metralhamento, altitude
                    → deslocamento, tamanho do borrão e opacidade da sombra (sol cima-esquerda), turbulência, pequenas correções de
                    rota, hélice com disco borrado (pás com efeito estroboscópico), fumaça de escape por motor (rícino azulado no
                    rotativo), metralhador traseiro girando a arma para o caça inimigo mais perto.
   Queda .......... parafuso, mergulho em chamas, asa arrancada (pedaço cai girando) ou planeio com arrasto no chão; fogo no motor,
                    rastro preto crescente, destroços, paraquedas Heinecke (alemães, ~40%; aliados quase nunca), impacto com
                    explode() moderado no local, cratera e destroço queimando por minutos (chamas + coluna de fumaça → brasas →
                    esqueleto carbonizado gravado no terreno).
   Ganchos ........ PXAIR.crash(p,by,causa) (fortify downPlane); abates do aviation.js (caça → aviões do jogo e papéis próprios:
                    a explosão agendada por ele é removida e a nossa acontece no impacto); reconhecimento do frontline.js
                    ('down' → assumimos a queda e o dano no impacto).
   ?aviao=0 desliga · PXAIR.anim.state() / PXAIR.state().anim */
(function(){
const PX=window.PX;
const P=window.PXAIR||(window.PXAIR={});
const OFF=/[?&]aviao=0/.test(location.search);
const A0={on:false,version:'1.0',stats:{errors:0,builds:0,crashes:0,wrecks:0,chutes:0,takeovers:0}};
P.anim=A0;
if(OFF||!PX||!PX.mk||!PX.outlined||!PX.pack){P.anim.state=()=>({on:false});return}
const {mk,g2,outlined,pack,mix}=PX;
const Z=PX.Z||.5,TAU=Math.PI*2,D2R=Math.PI/180,R2D=180/Math.PI;
const rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,k)=>a+(b-a)*k,hyp=Math.hypot;
const adiff=(a,b)=>{let d=(a-b)%TAU;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d};
const hash=(x,y,s)=>{let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(s|0,1442695041))|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296};
function vn(x,y,s){const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
 return lerp(lerp(hash(xi,yi,s),hash(xi+1,yi,s),u),lerp(hash(xi,yi+1,s),hash(xi+1,yi+1,s),u),v)}
const S=A0;S.on=true;
let errs=0;
function fail(e){S.stats.errors++;if(++errs<=3)console.error('anim-air.js:',e);if(errs>=12&&S.on){S.on=false;console.error('anim-air.js desligado após erros repetidos');try{shutdown()}catch{}}}

/* ======================================================================================
   1 · RASTERIZADOR DE MODELOS (metros → pixels)
   ====================================================================================== */
const PPM=5.5;                                         // pixels de arte por metro (≈ planes.js)
const YN=64;                                           // passos de rumo
const BANKS=[-180,-150,-120,-90,-70,-52,-36,-22,-10,0,10,22,36,52,70,90,120,150];
const PITS=[-80,-66,-52,-38,-26,-15,-6,0,8,18,28];
const LS=(()=>{const v=[-.45,-.55,.85],l=hyp(...v);return v.map(a=>a/l)})();   // sol: cima-esquerda, alto
const INKC='#15130f';
let DK=0;                                              // tom extra devolvido pelas texturas
let RF={w:0,cut:0,frag:0,cutY:99,off:null,nohead:0};  // bandeiras da renderização corrente
/* tons: -3..+2 a partir da cor-base (paleta limitada, misturas fixas) */
const TONE=new Map();
function tone(h,k){const key=h+k;let v=TONE.get(key);if(v===undefined){v=pack(k<0?mix(h,'#141210',[0,.2,.36,.52][-k]):k>0?mix(h,'#fff4d6',[0,.15,.3][k]):h);TONE.set(key,v)}return v}
const PALI=new Map(),PAL=[];
const pid=h=>{let i=PALI.get(h);if(i===undefined){i=PAL.length;PAL.push(h);PALI.set(h,i)}return i};
function rot(psi,th,phi){const cy=Math.cos(psi),sy=Math.sin(psi),cp=Math.cos(th),sp=Math.sin(th),cr=Math.cos(phi),sr=Math.sin(phi);
 /* R = Rz(ψ)·Ry(θ)·Rx(φ): φ>0 asa direita para baixo, θ>0 nariz para cima, ψ = ângulo de tela */
 const Ry=[[cp,0,-sp],[0,1,0],[sp,0,cp]],Rx=[[1,0,0],[0,cr,sr],[0,-sr,cr]],Rz=[[cy,-sy,0],[sy,cy,0],[0,0,1]];
 const m=(A,B)=>A.map((r,i)=>[0,1,2].map(j=>r[0]*B[0][j]+r[1]*B[1][j]+r[2]*B[2][j]));return m(Rz,m(Ry,Rx))}
const mul=(R,v)=>[R[0][0]*v[0]+R[0][1]*v[1]+R[0][2]*v[2],R[1][0]*v[0]+R[1][1]*v[1]+R[1][2]*v[2],R[2][0]*v[0]+R[2][1]*v[1]+R[2][2]*v[2]];
const mulT=(R,v)=>[R[0][0]*v[0]+R[1][0]*v[1]+R[2][0]*v[2],R[0][1]*v[0]+R[1][1]*v[1]+R[2][1]*v[2],R[0][2]*v[0]+R[1][2]*v[1]+R[2][2]*v[2]];

/* ---------- texturas e insígnias ---------- */
const C={W:'#e9e6d8',K:INKC,RED:'#b3302b',BLU:'#23407a',LIN:'#cfc49c',OD:'#575838',PC10:'#5b5634',MET:'#7d858c',ALU:'#b2b5ae',WOOD:'#6b4f2e',LEA:'#5a3d22',RAD:'#76705a',TIRE:'#1e1e1b'};
const FR=['#b5a47a','#7e8a55','#4e5935','#6f4b2d','#33312a'];            // camuflagem francesa de 5 cores
const LOZ=['#7d8b70','#8f8897','#a8946e','#61745a','#7c6458'],LOZU=['#b7b6aa','#c0b8ad','#cfc6ad','#a9b2a3','#b8a99c'],LOZN=['#3f4651','#4a4558','#525b54','#373f3d','#574d4a'];
function camoFR(x,y,s){const n=vn(x/1.15,y/1.15,s)*.62+vn(x/.48,y/.48,s+9)*.38;return FR[clamp(Math.floor(n*5.6-.3),0,4)]}
function loz(x,y,s,pal){const i=x*PPM,j=y*PPM,size=4.6,yy=j/(size*.78),row=Math.floor(yy),xx=i/size-(row&1)*.5,col=Math.floor(xx),fx=xx-col,fy=yy-row,k=Math.floor(hash(col,row,s)*5),c=pal[k];
 if(fx<.13||fy<.16)DK-=1;return c}
function splinter(x,y,s,a,b){const u=x*.8+y*.6,v=-x*.6+y*.8,cu=Math.floor(u/1.5),cv=Math.floor(v/1.2),h=hash(cu,cv,s),ang=h*TAU,fu=u/1.5-cu-.5,fv=v/1.2-cv-.5;return (fu*Math.cos(ang)+fv*Math.sin(ang))>(hash(cu,cv,s+3)-.5)*.5?a:b}
function ply(x,y,base){const g=vn(x*.9,y*14,5);if(g>.72)DK-=1;else if(g<.18)DK+=1;return base}
function usRoundel(x,y,cx,cy,r){const d=hyp(x-cx,y-cy);return d>r?null:d<r*.36?C.W:d<r*.7?C.BLU:C.RED}
function cross(x,y,cx,cy,s,border=1){const dx=Math.abs(x-cx),dy=Math.abs(y-cy),w=s*.24,b=s*.13;if((dx<=s&&dy<=w)||(dy<=s&&dx<=w))return C.K;if(border&&((dx<=s+b&&dy<=w+b)||(dy<=s+b&&dx<=w+b)))return C.W;return null}

/* ---------- construtores de peças ---------- */
function M(o){return Object.assign({parts:[],lines:[],pts:{props:[],rings:[],eng:[],exh:[],cock:[]},cutY:3},o)}
/* asa: o={z,le,ch,half,sw(enflechamento na ponta),rl,rt(raios de canto bordo de ataque/fuga),dih,cuts:[[y0,y1,prof]],cen:[meia-largura,prof],ail:[desde,fração],top,und,tag,horn} */
function wingIn(o,x,y,s){if(s>0&&y<0||s<0&&y>=0)return false;const v=Math.abs(y);if(RF.cut&&y*RF.cut>RF.cutY)return false;if(RF.frag&&!(y*RF.frag>RF.cutY))return false;
 const LE=o.le-o.sw*Math.min(v,o.half)/o.half,a=LE-x;if(a<0||a>o.ch)return false;
 if(v>o.half){return !!o.horn&&v<=o.half+o.horn&&a>o.ch*.66}
 const e=o.half-v,rl=o.rl,rt=o.rt;
 if(e<rl&&a<rl&&(rl-a)*(rl-a)+(rl-e)*(rl-e)>rl*rl)return false;
 if(e<rt&&o.ch-a<rt&&(rt-(o.ch-a))*(rt-(o.ch-a))+(rt-e)*(rt-e)>rt*rt)return false;
 if(o.cuts)for(const c of o.cuts)if(y>=c[0]&&y<=c[1]&&a>o.ch-c[2])return false;
 if(o.cen&&v<o.cen[0]&&a>o.ch-o.cen[1])return false;return true}
function wingCol(o,x,y,top){const v=Math.abs(y),LE=o.le-o.sw*Math.min(v,o.half)/o.half,u=(LE-x)/o.ch;DK=0;
 const frame=(v%.55)<.11||Math.abs(u-.18)<.06||Math.abs(u-.64)<.06||u<.05||u>.95||v>o.half-.1;
 let c=top?o.top(x,y,u,v):o.und(x,y,u,v);
 if(top&&u<.08)DK+=1;if(u>.93)DK-=1;if(o.ail&&v>o.ail[0]&&Math.abs(u-(1-o.ail[1]))<.045)DK-=1;
 if(RF.w)return char(c,frame,x,y,1);return c}
function char(c,frame,x,y,fabric){const n=vn(x*2.2,y*2.2,7);
 if(RF.w===2){if(fabric&&!frame)return null;if(!fabric&&n>.62&&!frame)return null;DK=0;return n>.5?'#2b251e':'#3a3127'}
 if(fabric&&!frame&&n>.58)return null;DK-=n>.4?1:0;return mix(c,'#1d1a15',.55+n*.3)}
function wing(m,o){const tb=Math.tan((o.dih||0)*D2R),sides=o.dih?[1,-1]:[0],ext=o.half+(o.horn||0)+.1;
 for(const s of sides)m.parts.push({k:'P',kind:'wing',tag:o.tag,z0:o.z,a:0,b:s*tb,bb:[o.le-o.ch-o.sw-.1,o.le+.1,s>0?0:-ext,s<0?0:ext,o.z-.05,o.z+ext*tb+.05],
  test:(x,y)=>wingIn(o,x,y,s),col:(x,y,top)=>wingCol(o,x,y,top),cast:o.tag==='U',recv:o.tag!=='U',o});
 m.cutY=Math.max(m.cutY,0)&&o.tag==='U'?o.half*.42:m.cutY;return o}
/* empenagem horizontal (estabilizador + profundor) */
function tailplane(m,o){o.tag='T';o.dih=0;o.ail=null;const top=o.top,und=o.und;o.top=(x,y,u,v)=>{const c=top(x,y,u,v);if(Math.abs(u-(o.hinge||.55))<.06)DK-=1;return c};o.und=(x,y,u,v)=>{const c=und(x,y,u,v);if(Math.abs(u-(o.hinge||.55))<.06)DK-=1;return c};
 m.parts.push({k:'P',kind:'tail',tag:'T',z0:o.z,a:0,b:0,bb:[o.le-o.ch-o.sw-.1,o.le+.1,-o.half-.1,o.half+.1,o.z-.05,o.z+.05],test:(x,y)=>!RF.frag&&wingInT(o,x,y),col:(x,y,top)=>{DK=0;const v=Math.abs(y),u=(o.le-o.sw*v/o.half-x)/o.ch;let c=top?o.top(x,y,u,v):o.und(x,y,u,v);if(top&&u<.1)DK+=1;if(RF.w)return char(c,u<.06||u>.94||(v%.5)<.1,x,y,1);return c},recv:true})}
function wingInT(o,x,y){const v=Math.abs(y);if(v>o.half)return false;const LE=o.le-o.sw*v/o.half,a=LE-x;if(a<0||a>o.ch)return false;const e=o.half-v,rl=o.rl,rt=o.rt;
 if(e<rl&&a<rl&&(rl-a)**2+(rl-e)**2>rl*rl)return false;if(e<rt&&o.ch-a<rt&&(rt-(o.ch-a))**2+(rt-e)**2>rt*rt)return false;return true}
/* corpo de revolução (fuselagem, nacela, carenagem): st=[[x,meia-largura,meia-altura]...]; col(x,ang,cap) ang 0 = topo, +π/2 = lado direito */
function body(m,o){const fw=o.kind==='nac'?1:1.28,fh=o.kind==='nac'?1:1.12,st=o.st.map(a=>[a[0],a[1]*fw,a[2]*fh]),xa=st[0][0],xb=st[st.length-1][0];let mw=0,mh=0;for(const s of st){mw=Math.max(mw,s[1]);mh=Math.max(mh,s[2])}
 const prof=x=>{if(x<=xa)return[st[0][1],st[0][2]];for(let i=1;i<st.length;i++)if(x<=st[i][0]){const a=st[i-1],b=st[i],k=(x-a[0])/((b[0]-a[0])||1);return[a[1]+(b[1]-a[1])*k,a[2]+(b[2]-a[2])*k]}return[st[st.length-1][1],st[st.length-1][2]]};
 const y0=o.y0||0,z0=o.z0||0;m.parts.push({k:'B',kind:o.kind||'body',y0,z0,xa,xb,prof,col:o.col,bb:[xa,xb,y0-mw,y0+mw,z0-mh,z0+mh],recv:true,eng:o.eng==null?99:o.eng})}
/* superfície vertical (deriva/leme, rodas): plano y=y0, test(x,z), col(x,z,lado) */
function vert(m,o){m.parts.push({k:'V',kind:o.kind||'fin',y0:o.y0||0,test:o.test,col:o.col,bb:o.bb,recv:true})}
function sphere(m,c,r,col,kind='head'){m.parts.push({k:'S',kind,c,r,col,bb:[c[0]-r,c[0]+r,c[1]-r,c[1]+r,c[2]-r,c[2]+r]})}
function line(m,a,b,col,kind='strut'){m.lines.push({a,b,col,kind})}
function wheel(m,x,y,z,r){vert(m,{kind:'wheel',y0:y,bb:[x-r,x+r,y-.05,y+.05,z-r,z+r],test:(xx,zz)=>(xx-x)**2+(zz-z)**2<=r*r,col:(xx,zz)=>{DK=0;const d=hyp(xx-x,zz-z);if(RF.w===2&&d>r*.5)return null;return d<r*.28?'#8a887c':d<r*.62?'#3a3a34':C.TIRE}})}
/* montante interplanar: dois tubos (frente/trás) */
function struts(m,ys,xl,xu,zl,zu,col=C.WOOD,wires=1){for(const y of ys){line(m,[xl[0],y,zl],[xu[0],y,zu],col);line(m,[xl[1],y,zl],[xu[1],y,zu],col);if(wires){line(m,[xl[0],Math.sign(y)*.35,zl+.1],[xu[1],y,zu],'#2a2a24','wire')}}}
/* textura de fuselagem padrão: topo/lados/baixo, capô de motor, cabines, marcas laterais */
function bodyTex(o){return(x,ang,cap)=>{DK=0;const aa=Math.abs(ang);
 if(cap>0)return o.cap?o.cap(x,ang):C.RAD;if(cap<0)return o.tailc||C.K;
 if(o.cock&&!RF.w)for(const c of o.cock)if(x>=c[0]&&x<=c[1]&&aa<(c[2]||.62)){const rim=x-c[0]<.08||c[1]-x<.08||aa>(c[2]||.62)-.14;return rim?'#4a3420':'#15100b'}
 let col;if(o.cowl&&x>o.cowl[0]){col=typeof o.cowl[1]==='function'?o.cowl[1](x,ang):o.cowl[1];if(Math.abs((x-o.cowl[0])%.45)<.05)DK-=1}
 else{const s=ang*.48;col=o.mark&&o.mark(x,s,aa);if(!col)col=aa<.95?o.top(x,s):aa<2.25?(o.side||o.top)(x,s):o.bot}
 if(RF.w){const fr=(x*1.9%1+1)%1<.18||Math.abs(aa-.9)<.12||Math.abs(aa-2.3)<.12;if(o.cowl&&x>o.cowl[0]){DK-=1;return mix(col,'#1b1a18',RF.w===2?.75:.5)}return char(col,fr,x,ang,0)}
 return col}}

/* ======================================================================================
   2 · OS AVIÕES (dimensões reais aproximadas, em metros)
   ====================================================================================== */
const head=(m,x,z,col=C.LEA)=>{sphere(m,[x,0,z+.06],.22,(xx,yy,zz)=>{DK=0;return RF.nohead?null:zz>.06+z&&Math.abs(yy)<.1&&xx<x?'#2a1d12':col});m.pts.cock.push([x,0,z])};
const usRud=x=>x>-.12?C.RED:x>-.24?C.W:C.BLU;   // listras do leme a partir do montante (x relativo ao montante)
const MODELS={
spad(){const m=M({name:'SPAD S.XIII',len:6.3,span:8.25});
 body(m,{st:[[-4.15,.05,.12],[-3.6,.16,.24],[-2.5,.3,.38],[-1.2,.4,.48],[-.4,.43,.52],[.8,.44,.52],[1.6,.42,.48],[2.05,.4,.42],[2.12,.36,.36]],eng:.9,
  col:bodyTex({top:(x,s)=>camoFR(x,s,3),side:(x,s)=>camoFR(x,s+3,3),bot:C.LIN,cowl:[.9,(x,a)=>Math.abs(a)>2.2?'#5f665c':'#7f8a78'],cock:[[-.95,-.25]],cap:(x,a)=>((a*6|0)&1)?'#5d5848':C.RAD,
   mark:(x,s,aa)=>x>-2.2&&x<-1.6&&aa>1&&aa<2.1?'#c9b48a':null})});
 head(m,-.55,.62);line(m,[.3,-.12,.53],[1.6,-.12,.46],'#22252a','gun');line(m,[.3,.12,.53],[1.6,.12,.46],'#22252a','gun');
 const rt=(x,y)=>usRoundel(x,Math.abs(y),.27,3.05,.6);
 wing(m,{tag:'U',z:.98,le:.95,ch:1.38,half:4.12,sw:0,rl:.22,rt:.3,ail:[2.4,.3],top:(x,y)=>rt(x,y)||camoFR(x,y,11),und:(x,y)=>rt(x,y)||C.LIN});
 wing(m,{tag:'L',z:-.3,le:.68,ch:1.2,half:3.9,sw:0,rl:.2,rt:.25,dih:1.5,top:(x,y)=>camoFR(x,y,13),und:(x,y)=>usRoundel(x,Math.abs(y),.08,2.9,.55)||C.LIN});
 tailplane(m,{z:.06,le:-3.2,ch:.95,half:1.45,sw:.1,rl:.4,rt:.25,top:(x,y)=>camoFR(x,y,17),und:()=>C.LIN});
 vert(m,{bb:[-4.4,-3.4,-.05,.05,0,1.1],test:(x,z)=>z>=0&&z<=1.02*Math.sqrt(Math.max(0,1-((x+3.95)/.45)**2))&&x>-4.38,col:(x,z)=>{DK=0;if(RF.w)return char(C.K,0,x,z,0);return x<-3.92?usRud(x+3.92):camoFR(x,z,21)}});
 struts(m,[-2.45,2.45],[.55,-.4],[.75,-.3],-.24,.98);line(m,[.6,-.35,.42],[.7,-.32,.98],C.WOOD);line(m,[.6,.35,.42],[.7,.32,.98],C.WOOD);line(m,[-.2,-.35,.42],[-.1,-.32,.98],C.WOOD);line(m,[-.2,.35,.42],[-.1,.32,.98],C.WOOD);
 wheel(m,1,-.8,-1.15,.33);wheel(m,1,.8,-1.15,.33);line(m,[1,-.8,-1.15],[1,.8,-1.15],'#2b2a22');for(const y of[-.75,.75]){line(m,[.45,y*.4,-.45],[1,y,-1.15],'#2b2a22');line(m,[1.45,y*.4,-.45],[1,y,-1.15],'#2b2a22')}
 m.pts.props.push({p:[2.22,0,0],r:1.25});m.pts.eng.push([1.45,0,.1]);m.pts.exh.push([.85,-.45,-.05],[.85,.45,-.05]);return m},
fokker(){const m=M({name:'Fokker D.VII',len:6.95,span:8.9});
 const fus=(x,s)=>{const n=vn(x*.7,s*5,4);return x<-3.05?'#d9d4c2':n>.55?'#4b5a3a':'#5d6b46'};
 body(m,{st:[[-4.75,.05,.14],[-4.2,.14,.24],[-3,.28,.38],[-1.6,.38,.5],[-.6,.42,.56],[.6,.43,.56],[1.5,.42,.52],[2.2,.4,.46],[2.32,.36,.4]],eng:1,
  col:bodyTex({top:fus,side:fus,bot:'#9fb0b5',cowl:[1,(x,a)=>Math.abs(a)>2.3?'#7a1f18':'#ad2a20'],cock:[[-.95,-.25]],cap:(x,a)=>((a*7|0)&1)?'#6f777b':'#9aa2a6',
   mark:(x,s,aa)=>aa>1&&aa<2.2?cross(x,Math.abs(s)-.76,-3.55,0,.32):null})});
 head(m,-.55,.66,'#3a2a1a');line(m,[.2,-.11,.57],[1.45,-.11,.5],'#20232a','gun');line(m,[.2,.11,.57],[1.45,.11,.5],'#20232a','gun');
 const kx=(x,y)=>cross(x,Math.abs(y),.15,3.45,.5);
 wing(m,{tag:'U',z:1,le:1,ch:1.65,half:4.45,sw:.05,rl:.14,rt:.14,horn:.18,ail:[2.9,.3],top:(x,y)=>kx(x,y)||loz(x,y,4,LOZ),und:(x,y)=>kx(x,y)||loz(x,y,5,LOZU)});
 wing(m,{tag:'L',z:-.3,le:.85,ch:1.35,half:3.5,sw:0,rl:.2,rt:.2,top:(x,y)=>loz(x,y,6,LOZ),und:(x,y)=>cross(x,Math.abs(y),.18,2.55,.42)||loz(x,y,8,LOZU)});
 wing(m,{tag:'X',z:-1.08,le:1.18,ch:.4,half:.95,sw:0,rl:.1,rt:.1,top:(x,y)=>loz(x,y,9,LOZ),und:()=>'#9fb0b5'});            // eixo-asa "sustentador"
 tailplane(m,{z:.12,le:-3.5,ch:1.05,half:1.45,sw:.35,rl:.12,rt:.22,top:(x,y)=>fus(x+1.5,y),und:()=>'#9fb0b5'});
 vert(m,{bb:[-4.95,-3.8,-.05,.05,0,1.15],test:(x,z)=>z>=0&&x>-4.92&&x<-3.85&&z<=(x<-4.42?1.05*Math.sqrt(Math.max(0,1-((x+4.42)/.5)**2))+.0:1.05*(x+3.85)/-.57),col:(x,z)=>{DK=0;if(RF.w)return char(C.K,0,x,z,0);return x<-4.4?(cross(x,z,-4.62,.5,.3)||C.W):'#c9c4b0'}});
 for(const y of[-2.65,2.65]){line(m,[.7,y,-.28],[.75,y,1],'#3a3d2e');line(m,[-.25,y,-.28],[-.3,y,1],'#3a3d2e');line(m,[-.25,y,-.28],[.75,y,1],'#3a3d2e')}   // montantes em N, sem estais
 for(const y of[-.3,.3]){line(m,[.7,y,.45],[.6,y*1.3,1],'#3a3d2e');line(m,[-.1,y,.45],[.2,y*1.3,1],'#3a3d2e')}
 wheel(m,1.1,-.88,-1.18,.34);wheel(m,1.1,.88,-1.18,.34);for(const y of[-.7,.7]){line(m,[.5,y*.5,-.45],[1.1,y,-1.08],'#2b2a22');line(m,[1.5,y*.5,-.45],[1.1,y,-1.08],'#2b2a22')}
 m.pts.props.push({p:[2.44,0,0],r:1.4});m.pts.eng.push([1.5,0,.15]);m.pts.exh.push([1.15,.47,.22]);return m},
camel(){const m=M({name:'Sopwith Camel',len:5.72,span:8.53});
 body(m,{st:[[-3.9,.05,.12],[-3.3,.15,.22],[-2.2,.28,.36],[-1,.4,.48],[0,.43,.5],[.8,.45,.5],[1.15,.48,.48],[1.68,.49,.49],[1.84,.42,.42]],eng:1.15,
  col:bodyTex({top:()=>C.PC10,side:(x,s)=>x>.2?ply(x,s,'#8a6a40'):C.PC10,bot:C.LIN,cowl:[1.15,(x,a)=>Math.abs(a)>2.4?'#80847e':C.ALU],cock:[[-.88,-.2]],
   cap:(x,a)=>{const r=Math.abs(a);return((a*4.5+9|0)%2)?'#4b4741':'#2a2826'}})});
 body(m,{kind:'hump',z0:.38,st:[[-.2,.02,.02],[.15,.22,.14],[.9,.21,.14],[1.12,.12,.06]],col:bodyTex({top:()=>C.PC10,bot:C.PC10})});                  // a "corcova"
 head(m,-.5,.62);line(m,[.85,-.1,.5],[1.42,-.1,.47],'#20232a','gun');line(m,[.85,.1,.5],[1.42,.1,.47],'#20232a','gun');
 const rt=(x,y)=>usRoundel(x,Math.abs(y),.16,3.2,.58);
 wing(m,{tag:'U',z:1.1,le:.85,ch:1.37,half:4.26,sw:.1,rl:.3,rt:.6,cen:[.42,.55],ail:[2.6,.3],top:(x,y)=>rt(x,y)||C.PC10,und:(x,y)=>rt(x,y)||C.LIN});
 wing(m,{tag:'L',z:-.38,le:.45,ch:1.37,half:4.26,sw:.1,rl:.3,rt:.6,dih:5,ail:[2.6,.3],top:()=>C.PC10,und:(x,y)=>usRoundel(x,Math.abs(y),-.22,3.1,.55)||C.LIN});
 tailplane(m,{z:.08,le:-2.95,ch:.85,half:1.5,sw:.2,rl:.42,rt:.35,top:()=>C.PC10,und:()=>C.LIN});
 vert(m,{bb:[-4.1,-3.2,-.05,.05,0,.95],test:(x,z)=>z>=0&&x>-4.05&&x<-3.25&&z<=.88*Math.sqrt(Math.max(0,1-((x+3.7)/.42)**2))+(x>-3.6?.1:0),col:(x,z)=>{DK=0;if(RF.w)return char(C.K,0,x,z,0);return x<-3.7?usRud(x+3.7):C.PC10}});
 struts(m,[-2.55,2.55],[.25,-.75],[.65,-.35],-.38+2.55*Math.tan(5*D2R),1.1);for(const y of[-.3,.3]){line(m,[.75,y,.45],[.75,y*1.2,1.1],C.WOOD);line(m,[.05,y,.45],[.05,y*1.2,1.1],C.WOOD)}
 wheel(m,.85,-.78,-1.1,.32);wheel(m,.85,.78,-1.1,.32);for(const y of[-.7,.7]){line(m,[.3,y*.4,-.45],[.85,y,-1.1],'#2b2a22');line(m,[1.3,y*.4,-.45],[.85,y,-1.1],'#2b2a22')}
 m.pts.props.push({p:[1.95,0,0],r:1.3,rotary:1});m.pts.eng.push([1.45,0,0]);m.pts.exh.push([1.35,0,-.45]);return m},
halb(){const m=M({name:'Halberstadt CL.II',len:7.3,span:10.77});
 const tp=(x,y)=>splinter(x,y,2,'#4f5a35','#6e5866');
 body(m,{st:[[-4.6,.05,.1],[-4,.12,.2],[-2.8,.28,.4],[-1.4,.45,.6],[-.2,.5,.65],[.9,.48,.6],[1.8,.42,.5],[2.6,.36,.4],[2.72,.3,.32]],eng:1.6,
  col:bodyTex({top:tp,side:(x,s)=>ply(x,s,'#a9a98c'),bot:'#a7b3ae',cowl:[1.6,'#6d7158'],cock:[[-1.8,-.1,.66]],cap:()=>'#2d2f2a',
   mark:(x,s,aa)=>aa>1&&aa<2.2?cross(x,Math.abs(s)-.8,-3.1,0,.3):null})});
 head(m,-.35,.72,'#3a2a1a');head(m,-1.45,.72,'#4a3a26');m.pts.rings.push([-1.45,0,.68]);line(m,[1.2,-.1,.62],[2.2,-.1,.5],'#20232a','gun');
 const kx=(x,y)=>cross(x,Math.abs(y),.2,4.4,.55);
 wing(m,{tag:'U',z:1.15,le:1.1,ch:1.65,half:5.38,sw:.35,rl:.3,rt:.95,ail:[3.3,.28],top:(x,y)=>kx(x,y)||(Math.abs(y)<.42&&x>-.3?'#5a5547':tp(x,y)),und:(x,y)=>kx(x,y)||'#a7b3ae'});
 wing(m,{tag:'L',z:-.25,le:.85,ch:1.4,half:5.1,sw:.3,rl:.3,rt:.75,dih:2,top:tp,und:(x,y)=>cross(x,Math.abs(y),.12,4.1,.5)||'#a7b3ae'});
 tailplane(m,{z:.28,le:-3.75,ch:.8,half:1.5,sw:.25,rl:.3,rt:.3,top:tp,und:()=>'#a7b3ae'});
 vert(m,{bb:[-4.8,-3.9,-.05,.05,0,1],test:(x,z)=>z>=0&&x>-4.75&&x<-3.95&&z<=.85*Math.sqrt(Math.max(0,1-((x+4.35)/.42)**2))+.05,col:(x,z)=>{DK=0;if(RF.w)return char(C.K,0,x,z,0);return cross(x,z,-4.35,.42,.26)||C.W}});
 struts(m,[-3.2,3.2],[.65,-.35],[.95,-.2],-.25+3.2*Math.tan(2*D2R),1.15);for(const y of[-.35,.35]){line(m,[.95,y,.5],[.9,y*1.2,1.15],C.WOOD);line(m,[.2,y,.55],[.25,y*1.2,1.15],C.WOOD)}
 wheel(m,1.2,-.9,-1.25,.36);wheel(m,1.2,.9,-1.25,.36);for(const y of[-.8,.8]){line(m,[.6,y*.4,-.5],[1.2,y,-1.25],'#2b2a22');line(m,[1.7,y*.4,-.45],[1.2,y,-1.25],'#2b2a22')}
 m.pts.props.push({p:[2.86,0,0],r:1.4});m.pts.eng.push([1.9,0,.2]);m.pts.exh.push([1.55,.5,.35]);return m},
breguet(){const m=M({name:'Breguet 14',len:8.87,span:14.36});
 body(m,{st:[[-5.9,.05,.12],[-5.2,.15,.25],[-3.6,.32,.45],[-1.8,.45,.62],[-.2,.52,.72],[1.2,.55,.75],[2.4,.55,.72],[2.95,.52,.62],[3.02,.5,.56]],eng:1.5,
  col:bodyTex({top:(x,s)=>camoFR(x,s,31),side:(x,s)=>camoFR(x,s+4,31),bot:C.LIN,cowl:[1.5,(x,a)=>Math.abs(a)>2.2?'#6f7472':'#9aa09c'],cock:[[.15,.7],[-1.25,-.45]],cap:(x,a)=>((Math.abs(a)*5|0)&1)?'#5a5544':'#7d7660'})});
 head(m,.42,.82);head(m,-.85,.8);m.pts.rings.push([-.85,0,.76]);
 const rt=(x,y)=>usRoundel(x,Math.abs(y),.45,5.6,.75);
 wing(m,{tag:'U',z:1.25,le:1.35,ch:1.85,half:7.18,sw:.45,rl:.3,rt:.55,ail:[4.5,.28],top:(x,y)=>rt(x,y)||camoFR(x,y,33),und:(x,y)=>rt(x,y)||C.LIN});
 wing(m,{tag:'L',z:-.35,le:1.1,ch:1.7,half:6.8,sw:.4,rl:.3,rt:.5,dih:1.5,top:(x,y,u)=>{if(u>.8&&Math.abs(y)>.8)DK-=1;return camoFR(x,y,35)},und:(x,y)=>usRoundel(x,Math.abs(y),.15,5.3,.7)||C.LIN});
 tailplane(m,{z:.15,le:-4.6,ch:1.2,half:2.2,sw:.3,rl:.5,rt:.4,top:(x,y)=>camoFR(x,y,37),und:()=>C.LIN});
 vert(m,{bb:[-6.2,-5,-.05,.05,0,1.3],test:(x,z)=>z>=0&&x>-6.15&&x<-5.05&&z<=1.15*Math.sqrt(Math.max(0,1-((x+5.6)/.56)**2)),col:(x,z)=>{DK=0;if(RF.w)return char(C.K,0,x,z,0);return x<-5.6?usRud(x+5.6):camoFR(x,z,39)}});
 struts(m,[-2.9,2.9,-5.4,5.4],[.85,-.4],[1.15,-.2],-.3,1.25);for(const y of[-.4,.4]){line(m,[1.2,y,.6],[1.2,y,1.25],C.WOOD);line(m,[.1,y,.65],[.1,y,1.25],C.WOOD)}
 line(m,[1.7,-.56,.5],[1.85,-.56,1.05],'#3b3f43');line(m,[1.7,.56,.5],[1.85,.56,1.05],'#3b3f43');
 wheel(m,1.5,-1,-1.45,.4);wheel(m,1.5,1,-1.45,.4);for(const y of[-.9,.9]){line(m,[.8,y*.45,-.6],[1.5,y,-1.45],'#2b2a22');line(m,[2.2,y*.45,-.6],[1.5,y,-1.45],'#2b2a22')}
 m.pts.props.push({p:[3.16,0,0],r:1.5});m.pts.eng.push([2.2,0,.2]);m.pts.exh.push([1.85,-.56,1.05],[1.85,.56,1.05]);return m},
dfw(){const m=M({name:'DFW C.V',len:7.87,span:13.27});
 body(m,{st:[[-5,.05,.1],[-4.4,.14,.22],[-3,.3,.42],[-1.4,.45,.62],[0,.52,.7],[1.4,.5,.65],[2.4,.45,.55],[2.92,.38,.42],[3,.32,.34]],eng:1.6,
  col:bodyTex({top:(x,s)=>ply(x,s,'#a49c84'),side:(x,s)=>x>.8&&x<1.6&&s<-.5?'#5f5b4c':ply(x,s,'#b0a78c'),bot:'#9fb0b5',cowl:[1.6,'#5f6466'],cock:[[.2,.75],[-1.5,-.8]],cap:()=>'#2f312d',
   mark:(x,s,aa)=>aa>1&&aa<2.2?cross(x,Math.abs(s)-.82,-3.6,0,.32):null})});
 head(m,.45,.8,'#3a2a1a');head(m,-1.15,.78,'#4a3a26');m.pts.rings.push([-1.15,0,.74]);
 line(m,[2.05,0,.55],[2.12,0,1.42],'#2f3336');                                                                      // escape "chifre de rinoceronte"
 const kx=(x,y)=>cross(x,Math.abs(y),.5,5.3,.62);
 wing(m,{tag:'U',z:1.22,le:1.35,ch:1.75,half:6.63,sw:.35,rl:.6,rt:.6,ail:[4.3,.28],top:(x,y)=>kx(x,y)||loz(x,y,12,LOZ),und:(x,y)=>kx(x,y)||loz(x,y,13,LOZU)});
 wing(m,{tag:'L',z:-.3,le:1.1,ch:1.55,half:6,sw:.3,rl:.55,rt:.55,dih:1.5,top:(x,y)=>loz(x,y,14,LOZ),und:(x,y)=>cross(x,Math.abs(y),.25,4.9,.55)||loz(x,y,15,LOZU)});
 tailplane(m,{z:.15,le:-3.95,ch:1,half:1.9,sw:.2,rl:.5,rt:.5,top:(x,y)=>loz(x,y,16,LOZ),und:()=>'#c9c6b6'});
 vert(m,{bb:[-5.2,-4.1,-.05,.05,0,1.15],test:(x,z)=>z>=0&&x>-5.15&&x<-4.15&&z<=1.02*Math.sqrt(Math.max(0,1-((x+4.65)/.5)**2)),col:(x,z)=>{DK=0;if(RF.w)return char(C.K,0,x,z,0);return cross(x,z,-4.7,.48,.3)||C.W}});
 struts(m,[-2.8,2.8,-5.3,5.3],[.85,-.3],[1.15,-.1],-.3,1.22);for(const y of[-.38,.38]){line(m,[1.2,y,.6],[1.2,y,1.22],C.WOOD);line(m,[.15,y,.62],[.15,y,1.22],C.WOOD)}
 wheel(m,1.45,-.95,-1.4,.38);wheel(m,1.45,.95,-1.4,.38);for(const y of[-.85,.85]){line(m,[.8,y*.45,-.6],[1.45,y,-1.4],'#2b2a22');line(m,[2.1,y*.45,-.55],[1.45,y,-1.4],'#2b2a22')}
 m.pts.props.push({p:[3.13,0,0],r:1.45});m.pts.eng.push([2.2,0,.3]);m.pts.exh.push([2.12,0,1.42]);return m},
salmson(){const m=M({name:'Salmson 2A2',len:8.5,span:11.75});
 body(m,{st:[[-5.6,.05,.1],[-5,.15,.22],[-3.4,.3,.42],[-1.6,.42,.58],[0,.48,.65],[1.4,.5,.62],[2.3,.56,.58],[2.7,.57,.57],[2.86,.48,.48]],eng:2,
  col:bodyTex({top:(x,s)=>camoFR(x,s,41),side:(x,s)=>camoFR(x,s+5,41),bot:C.LIN,cowl:[2,(x,a)=>Math.abs(a)>2.3?'#6f7472':'#a2a6a0'],cock:[[.1,.6],[-1.6,-1]],
   cap:(x,a)=>((a*4.5+9|0)%2)?'#3e3c37':'#5e5a50'})});
 head(m,.35,.75);head(m,-1.3,.72);m.pts.rings.push([-1.3,0,.68]);
 const rt=(x,y)=>usRoundel(x,Math.abs(y),.35,4.6,.7);
 wing(m,{tag:'U',z:1.2,le:1.2,ch:1.75,half:5.88,sw:.1,rl:.25,rt:.3,ail:[3.8,.28],top:(x,y)=>rt(x,y)||camoFR(x,y,43),und:(x,y)=>rt(x,y)||C.LIN});
 wing(m,{tag:'L',z:-.3,le:.95,ch:1.6,half:5.6,sw:.1,rl:.25,rt:.3,dih:2,top:(x,y)=>camoFR(x,y,45),und:(x,y)=>usRoundel(x,Math.abs(y),.15,4.4,.65)||C.LIN});
 tailplane(m,{z:.15,le:-4.35,ch:1.05,half:2,sw:.25,rl:.45,rt:.35,top:(x,y)=>camoFR(x,y,47),und:()=>C.LIN});
 vert(m,{bb:[-5.85,-4.8,-.05,.05,0,1.15],test:(x,z)=>z>=0&&x>-5.8&&x<-4.85&&z<=1.05*Math.sqrt(Math.max(0,1-((x+5.3)/.5)**2)),col:(x,z)=>{DK=0;if(RF.w)return char(C.K,0,x,z,0);return x<-5.3?usRud(x+5.3):camoFR(x,z,49)}});
 struts(m,[-2.4,2.4,-4.6,4.6],[.75,-.4],[1,-.25],-.25,1.2);for(const y of[-.4,.4]){line(m,[1.05,y,.6],[1.05,y,1.2],C.WOOD);line(m,[-.1,y,.62],[-.1,y,1.2],C.WOOD)}
 wheel(m,1.6,-.95,-1.35,.38);wheel(m,1.6,.95,-1.35,.38);for(const y of[-.85,.85]){line(m,[.9,y*.45,-.55],[1.6,y,-1.35],'#2b2a22');line(m,[2.3,y*.45,-.5],[1.6,y,-1.35],'#2b2a22')}
 m.pts.props.push({p:[3,0,0],r:1.45});m.pts.eng.push([2.4,0,.1]);m.pts.exh.push([2.2,-.55,-.25],[2.2,.55,-.25]);return m},
rumpler(){const m=M({name:'Rumpler C.IV',len:8.4,span:12.66});
 body(m,{st:[[-5.4,.05,.1],[-4.8,.13,.2],[-3.2,.3,.42],[-1.6,.44,.6],[0,.5,.68],[1.4,.48,.62],[2.4,.42,.52],[2.9,.36,.4],[3,.3,.32]],eng:1.6,
  col:bodyTex({top:(x,s)=>splinter(x,s,5,'#58624a','#6f5c69'),side:(x,s)=>ply(x,s,'#9fb0b5'),bot:'#a8b9bd',cowl:[1.6,'#5f6466'],cock:[[.15,.7],[-1.5,-.85]],cap:()=>'#2f312d',
   mark:(x,s,aa)=>aa>1&&aa<2.2?cross(x,Math.abs(s)-.8,-3.7,0,.32):null})});
 head(m,.42,.78,'#3a2a1a');head(m,-1.15,.76,'#4a3a26');m.pts.rings.push([-1.15,0,.72]);line(m,[1.9,.45,.45],[2,.45,1.05],'#2f3336');
 const kx=(x,y)=>cross(x,Math.abs(y),-.2,5.2,.6);
 wing(m,{tag:'U',z:1.25,le:1.4,ch:1.7,half:6.33,sw:.95,rl:.75,rt:.3,ail:[4.2,.28],top:(x,y)=>kx(x,y)||loz(x,y,22,LOZ),und:(x,y)=>kx(x,y)||loz(x,y,23,LOZU)});
 wing(m,{tag:'L',z:-.3,le:1,ch:1.45,half:5.6,sw:.55,rl:.55,rt:.3,dih:1.5,top:(x,y)=>loz(x,y,24,LOZ),und:(x,y)=>cross(x,Math.abs(y),-.1,4.6,.52)||loz(x,y,25,LOZU)});
 tailplane(m,{z:.18,le:-3.95,ch:1.25,half:1.9,sw:.1,rl:.8,rt:.8,hinge:.5,top:(x,y)=>loz(x,y,26,LOZ),und:()=>'#c9c6b6'});             // cauda "Rumpler" arredondada
 vert(m,{bb:[-5.6,-4.5,-.05,.05,0,1.15],test:(x,z)=>z>=0&&x>-5.55&&x<-4.55&&z<=1*Math.sqrt(Math.max(0,1-((x+5.05)/.5)**2)),col:(x,z)=>{DK=0;if(RF.w)return char(C.K,0,x,z,0);return cross(x,z,-5.05,.45,.3)||C.W}});
 struts(m,[-2.7,2.7,-4.9,4.9],[.75,-.35],[1.15,-.1],-.25,1.25);for(const y of[-.38,.38]){line(m,[1.2,y,.6],[1.25,y,1.25],C.WOOD);line(m,[.15,y,.62],[.2,y,1.25],C.WOOD)}
 wheel(m,1.45,-.95,-1.4,.38);wheel(m,1.45,.95,-1.4,.38);for(const y of[-.85,.85]){line(m,[.8,y*.45,-.6],[1.45,y,-1.4],'#2b2a22');line(m,[2.1,y*.45,-.55],[1.45,y,-1.4],'#2b2a22')}
 m.pts.props.push({p:[3.13,0,0],r:1.45});m.pts.eng.push([2.2,0,.3]);m.pts.exh.push([2,.45,1.05]);return m},
dh4(){const m=M({name:'Airco DH-4',len:9.35,span:12.92});
 body(m,{st:[[-6.3,.05,.1],[-5.6,.14,.22],[-4,.32,.45],[-2,.46,.62],[-.2,.5,.68],[1.5,.5,.66],[2.6,.48,.6],[3,.45,.55],[3.06,.42,.5]],eng:1.6,
  col:bodyTex({top:()=>C.OD,side:()=>'#62633f',bot:C.LIN,cowl:[1.6,(x,a)=>Math.abs(a)>2.2?'#5d646b':'#848c92'],cock:[[-.2,.35],[-2.65,-1.85]],cap:(x,a)=>((Math.abs(a)*5|0)&1)?'#5a5544':'#7d7660'})});
 head(m,.08,.78);head(m,-2.25,.74);m.pts.rings.push([-2.25,0,.7]);line(m,[.6,-.28,.6],[2,-.28,.58],'#20232a','gun');
 const rt=(x,y)=>usRoundel(x,Math.abs(y),.35,5.2,.72);
 wing(m,{tag:'U',z:1.3,le:1.25,ch:1.75,half:6.46,sw:0,rl:.25,rt:.32,ail:[4,.3],top:(x,y)=>rt(x,y)||C.OD,und:(x,y)=>rt(x,y)||C.LIN});
 wing(m,{tag:'L',z:-.35,le:1,ch:1.65,half:6.46,sw:0,rl:.25,rt:.32,dih:3,ail:[4,.3],top:()=>C.OD,und:(x,y)=>usRoundel(x,Math.abs(y),.15,5.1,.68)||C.LIN});
 tailplane(m,{z:.15,le:-4.95,ch:1.25,half:2.3,sw:.25,rl:.45,rt:.35,top:()=>C.OD,und:()=>C.LIN});
 vert(m,{bb:[-6.6,-5.4,-.05,.05,0,1.3],test:(x,z)=>z>=0&&x>-6.55&&x<-5.45&&z<=1.15*Math.sqrt(Math.max(0,1-((x+6)/.55)**2))+(x>-5.9?.08:0),col:(x,z)=>{DK=0;if(RF.w)return char(C.K,0,x,z,0);return x<-6?usRud(x+6):C.OD}});
 struts(m,[-2.6,2.6,-5,5],[.75,-.5],[1.05,-.3],-.3,1.3);for(const y of[-.4,.4]){line(m,[1.1,y,.6],[1.1,y,1.3],C.WOOD);line(m,[-.1,y,.62],[-.1,y,1.3],C.WOOD)}
 wheel(m,1.6,-1,-1.45,.4);wheel(m,1.6,1,-1.45,.4);for(const y of[-.9,.9]){line(m,[.9,y*.45,-.6],[1.6,y,-1.45],'#2b2a22');line(m,[2.3,y*.45,-.55],[1.6,y,-1.45],'#2b2a22')}
 m.pts.props.push({p:[3.2,0,0],r:1.5});m.pts.eng.push([2.2,0,.3]);m.pts.exh.push([1.85,-.52,.55],[1.85,.52,.55]);return m},
gotha(){const m=M({name:'Gotha G.V',len:11.86,span:23.7});
 const kx=(x,y)=>cross(x,Math.abs(y),-.1,9.6,.95);
 body(m,{st:[[-7.6,.06,.12],[-6.8,.18,.25],[-4.5,.45,.6],[-2,.62,.8],[0,.68,.85],[2,.68,.85],[3.6,.6,.75],[4.25,.5,.6],[4.35,.42,.5]],eng:99,
  col:bodyTex({top:(x,s)=>ply(x,s,'#8f7448'),side:(x,s)=>ply(x,s,'#9a7c4c'),bot:'#7d8788',cock:[[3.45,4.2],[1.6,2.35],[-2.05,-1.3]],cap:()=>'#6b5636',
   mark:(x,s,aa)=>aa>1&&aa<2.2?cross(x,Math.abs(s)-.9,-5.2,0,.42):null})});
 head(m,3.85,.92,'#3a2a1a');head(m,1.95,.92);head(m,-1.65,.9,'#4a3a26');m.pts.rings.push([3.85,0,.86],[-1.65,0,.86]);
 const cut=[[-4.4,-1.9,1.15],[1.9,4.4,1.15]];
 wing(m,{tag:'U',z:1.6,le:1.4,ch:2.7,half:11.85,sw:.2,rl:.4,rt:.55,cuts:cut,ail:[8,.26],top:(x,y)=>kx(x,y)||loz(x,y,31,LOZN),und:(x,y)=>kx(x,y)||loz(x,y,32,LOZN)});
 wing(m,{tag:'L',z:-.9,le:1.2,ch:2.5,half:10.9,sw:.2,rl:.4,rt:.5,cuts:cut,dih:1,top:(x,y)=>loz(x,y,33,LOZN),und:(x,y)=>cross(x,Math.abs(y),-.1,8.8,.85)||loz(x,y,34,LOZN)});
 for(const s of[-1,1]){body(m,{kind:'nac',y0:s*3.15,z0:.35,eng:-2,st:[[-1.05,.16,.18],[-.6,.42,.48],[.6,.5,.56],[1.6,.48,.52],[2.2,.38,.42],[2.32,.32,.35]],
   col:bodyTex({top:()=>'#5f6a59',side:()=>'#55604f',bot:'#3f4639',cap:(x,a)=>((Math.abs(a)*5|0)&1)?'#4a4535':'#6e6852',tailc:'#2c3028'})});
  line(m,[0,s*3.15,.85],[0,s*3.15,1.6],C.WOOD);line(m,[.9,s*3.15,.85],[.9,s*3.15,1.6],C.WOOD);line(m,[0,s*3.15,-.15],[0,s*3.15,-.9],C.WOOD);line(m,[.9,s*3.15,-.15],[.9,s*3.15,-.9],C.WOOD);
  m.pts.props.push({p:[-1.25,s*3.15,.35],r:1.55,pusher:1});m.pts.eng.push([.5,s*3.15,.7]);m.pts.exh.push([1,s*3.15,.85]);
  wheel(m,.7,s*3.15-.42,-1.65,.48);wheel(m,.7,s*3.15+.42,-1.65,.48);line(m,[.2,s*3.15,-.1],[.7,s*3.15,-1.65],'#2b2a22');line(m,[1.3,s*3.15,-.1],[.7,s*3.15,-1.65],'#2b2a22')}
 tailplane(m,{z:.3,le:-5.9,ch:1.6,half:2.9,sw:.25,rl:.5,rt:.4,top:(x,y)=>loz(x,y,35,LOZN),und:()=>'#6a7273'});
 vert(m,{bb:[-8,-6.3,-.05,.05,0,1.6],test:(x,z)=>z>=0&&x>-7.95&&x<-6.35&&z<=1.5*Math.sqrt(Math.max(0,1-((x+7.15)/.8)**2)),col:(x,z)=>{DK=0;if(RF.w)return char(C.K,0,x,z,0);return x<-7.2?(cross(x,z,-7.55,.7,.32)||C.W):loz(x,z,36,LOZN)}});
 struts(m,[-6.4,6.4,-9.6,9.6],[1,-.9],[1.2,-.8],-.9+.1,1.6);
 m.cutY=6.6;return m}};
const MODEL=new Map();
function model(type){let m=MODEL.get(type);if(m)return m;m=MODELS[type]();let R=0;
 for(const p of m.parts){const b=p.bb;for(const x of[b[0],b[1]])for(const y of[b[2],b[3]])for(const z of[b[4],b[5]])R=Math.max(R,hyp(x,y,z))}
 for(const pr of m.pts.props)R=Math.max(R,hyp(...pr.p)+pr.r);m.R=R;m.N=2*Math.ceil(R*PPM)+4;MODEL.set(type,m);return m}

/* ---------- raio × peça ---------- */
const H={t:0,x:0,y:0,z:0,nx:0,ny:0,nz:1,c:null};
function hitPart(p,q,k,hit){
 if(p.k==='P'){const den=k[2]-p.a*k[0]-p.b*k[1];if(Math.abs(den)<1e-5)return false;const t=(p.z0+p.a*q[0]+p.b*q[1]-q[2])/den;if(t<=hit.t)return false;const x=q[0]+t*k[0],y=q[1]+t*k[1];if(!p.test(x,y))return false;
  const n=[-p.a,-p.b,1],nz=n[0]*RW[2][0]+n[1]*RW[2][1]+n[2]*RW[2][2];const c=p.col(x,y,nz>0);if(!c)return false;hit.t=t;hit.x=x;hit.y=y;hit.z=q[2]+t*k[2];hit.nx=n[0];hit.ny=n[1];hit.nz=1;hit.c=c;hit.dk=DK;return true}
 if(p.k==='V'){const den=k[1];if(Math.abs(den)<1e-5)return false;const t=(p.y0-q[1])/den;if(t<=hit.t)return false;const x=q[0]+t*k[0],z=q[2]+t*k[2];if(!p.test(x,z))return false;
  const ny=RW[2][1];const c=p.col(x,z,ny>0);if(!c)return false;hit.t=t;hit.x=x;hit.y=p.y0;hit.z=z;hit.nx=0;hit.ny=1;hit.nz=0;hit.c=c;hit.dk=DK;return true}
 if(p.k==='S'){const dx=q[0]-p.c[0],dy=q[1]-p.c[1],dz=q[2]-p.c[2],b=dx*k[0]+dy*k[1]+dz*k[2],cc=dx*dx+dy*dy+dz*dz-p.r*p.r,ds=b*b-cc;if(ds<0)return false;const t=-b+Math.sqrt(ds);if(t<=hit.t)return false;
  const x=q[0]+t*k[0],y=q[1]+t*k[1],z=q[2]+t*k[2];const c=p.col(x,y,z);if(!c)return false;hit.t=t;hit.x=x;hit.y=y;hit.z=z;hit.nx=x-p.c[0];hit.ny=y-p.c[1];hit.nz=z-p.c[2];hit.c=c;hit.dk=DK;return true}
 /* corpo de revolução: quadrática iterada na seção da estação + tampas */
 const ky=k[1],kz=k[2],qy=q[1]-p.y0,qz=q[2]-p.z0,kk=ky*ky+kz*kz;let got=false;
 if(kk>1e-6){let t=-(qy*ky+qz*kz)/kk,x=q[0]+t*k[0],ok=true,w=1,h=1;
  for(let it=0;it<3;it++){const pr=p.prof(clamp(x,p.xa,p.xb));w=pr[0];h=pr[1];const A=(ky/w)**2+(kz/h)**2,B=2*(qy*ky/(w*w)+qz*kz/(h*h)),Cc=(qy/w)**2+(qz/h)**2-1,ds=B*B-4*A*Cc;if(ds<0){ok=false;break}t=(-B+Math.sqrt(ds))/(2*A);x=q[0]+t*k[0]}
  if(ok&&x>=p.xa&&x<=p.xb&&t>hit.t){const yy=qy+t*ky,zz=qz+t*kz,ang=Math.atan2(yy/w,zz/h);const c=p.col(x,ang,0);if(c){hit.t=t;hit.x=x;hit.y=yy+p.y0;hit.z=zz+p.z0;hit.nx=0;hit.ny=yy/(w*w);hit.nz=zz/(h*h);hit.c=c;hit.dk=DK;got=true}}}
 if(Math.abs(k[0])>1e-4)for(const s of[1,-1]){const xe=s>0?p.xb:p.xa,t=(xe-q[0])/k[0];if(t<=hit.t)continue;const yy=qy+t*ky,zz=qz+t*kz,pr=p.prof(xe);if((yy/pr[0])**2+(zz/pr[1])**2>1)continue;
  const c=p.col(xe,Math.atan2(yy,zz),s);if(!c)continue;hit.t=t;hit.x=xe;hit.y=yy+p.y0;hit.z=zz+p.z0;hit.nx=s;hit.ny=0;hit.nz=0;hit.c=c;hit.dk=DK;got=true}
 return got}
let RW=null;                       // matriz corrente (para as texturas saberem o lado visível)

/* ---------- construção de um quadro ---------- */
function build(type,yi,bi,pi,fl){const t0=performance.now(),m=model(type),N=m.N,Cn=N/2,psi=yi/YN*TAU,phi=BANKS[bi]*D2R,th=PITS[pi]*D2R,R=rot(psi,th,phi);RW=R;
 RF={w:fl==='w'?1:fl==='k'?2:0,cut:fl==='cL'?-1:fl==='cR'?1:0,frag:fl==='fL'?-1:fl==='fR'?1:0,cutY:m.cutY,off:null,nohead:fl==='w'||fl==='k'};
 if(RF.frag){const U=m.parts.find(p=>p.tag==='U').o;RF.off=[U.le-U.ch/2,RF.frag*(m.cutY+U.half)/2,U.z*.5]}
 const zb=new Float32Array(N*N).fill(-1e9),cb=new Int32Array(N*N).fill(-1),tb=new Int8Array(N*N),k=[R[2][0],R[2][1],R[2][2]],Lb=mulT(R,LS),off=RF.off;
 const casters=m.parts.filter(p=>p.cast);
 for(const p of m.parts){if(RF.frag&&p.kind!=='wing')continue;if(RF.w&&p.kind==='head')continue;
  /* caixa da peça na tela */
  let i0=1e9,i1=-1e9,j0=1e9,j1=-1e9;const b=p.bb;for(const x of[b[0],b[1]])for(const y of[b[2],b[3]])for(const z of[b[4],b[5]]){const v=mul(R,off?[x-off[0],y-off[1],z-off[2]]:[x,y,z]);i0=Math.min(i0,v[0]);i1=Math.max(i1,v[0]);j0=Math.min(j0,v[1]);j1=Math.max(j1,v[1])}
  i0=clamp(Math.floor(Cn+i0*PPM)-1,0,N-1);i1=clamp(Math.ceil(Cn+i1*PPM)+1,0,N-1);j0=clamp(Math.floor(Cn+j0*PPM)-1,0,N-1);j1=clamp(Math.ceil(Cn+j1*PPM)+1,0,N-1);
  for(let j=j0;j<=j1;j++){const sy=(j+.5-Cn)/PPM;for(let i=i0;i<=i1;i++){const sx=(i+.5-Cn)/PPM,idx=j*N+i;
   const q=[R[0][0]*sx+R[1][0]*sy,R[0][1]*sx+R[1][1]*sy,R[0][2]*sx+R[1][2]*sy];if(off){q[0]+=off[0];q[1]+=off[1];q[2]+=off[2]}
   H.t=zb[idx];if(!hitPart(p,q,k,H))continue;
   /* luz: normal no mundo (virada para a câmera) · sol; sombra da asa de cima */
   let n=mul(R,[H.nx,H.ny,H.nz]);const nl=hyp(n[0],n[1],n[2])||1;if(n[2]<0)n=[-n[0],-n[1],-n[2]];const ndl=(n[0]*LS[0]+n[1]*LS[1]+n[2]*LS[2])/nl,r=(.42+.58*Math.max(0,ndl))/(.42+.58*LS[2]);
   let tn=H.dk+(r<.6?-2:r<.86?-1:r<1.12?0:r<1.26?1:2);
   if(p.recv&&casters.length&&!RF.w){for(const cp of casters){if(cp===p)continue;const den=Lb[2]-cp.a*Lb[0]-cp.b*Lb[1];if(Math.abs(den)<1e-4)continue;const s=(cp.z0+cp.a*H.x+cp.b*H.y-H.z)/den;if(s>.05&&cp.test(H.x+s*Lb[0],H.y+s*Lb[1])){tn-=1;break}}}
   zb[idx]=H.t;cb[idx]=pid(H.c);tb[idx]=clamp(tn,-3,2)}}}
 /* montantes, estais, armas: linhas com teste de profundidade */
 const lp=[];for(const L of m.lines){if(RF.frag&&!(L.a[1]*RF.frag>RF.cutY&&L.b[1]*RF.frag>RF.cutY))continue;if(RF.cut&&(L.a[1]*RF.cut>RF.cutY||L.b[1]*RF.cut>RF.cutY))continue;
  if(RF.w&&(L.kind==='wire'||hash(L.a[0]*9|0,L.a[1]*9|0,3)<.35))continue;
  const a=mul(R,off?[L.a[0]-off[0],L.a[1]-off[1],L.a[2]-off[2]]:L.a),b=mul(R,off?[L.b[0]-off[0],L.b[1]-off[1],L.b[2]-off[2]]:L.b);
  const x0=Math.floor(Cn+a[0]*PPM),y0=Math.floor(Cn+a[1]*PPM),x1=Math.floor(Cn+b[0]*PPM),y1=Math.floor(Cn+b[1]*PPM),n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0),1);
  for(let s=0;s<=n;s++){const i=Math.round(x0+(x1-x0)*s/n),j=Math.round(y0+(y1-y0)*s/n);if(i<0||j<0||i>=N||j>=N)continue;const idx=j*N+i,d=a[2]+(b[2]-a[2])*s/n;if(d<zb[idx]-.04)continue;lp.push(idx,pid(RF.w?'#2a241d':L.col),L.kind==='wire'?-1:0);zb[idx]=d}}
 /* passada de borda: claro em cima/esquerda, escuro embaixo/direita (luz cima-esquerda) */
 const img=new ImageData(N,N),d32=new Uint32Array(img.data.buffer);
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const idx=j*N+i,c=cb[idx];if(c<0)continue;let t=tb[idx];
  if((j===0||cb[idx-N]<0)||(i===0||cb[idx-1]<0))t+=1;else if(zb[idx-N]>zb[idx]+.35||zb[idx-1]>zb[idx]+.35)t-=1;if((j===N-1||cb[idx+N]<0)||(i===N-1||cb[idx+1]<0))t-=1;
  d32[idx]=tone(PAL[c],clamp(t,-3,2))}
 for(let i=0;i<lp.length;i+=3)d32[lp[i]]=tone(PAL[lp[i+1]],lp[i+2]);
 const cv=mk(N,N);g2(cv).putImageData(img,0,0);const o=outlined(cv,.55);
 /* pontos especiais na tela (px a partir da âncora) */
 const P2=(v,thr=.3)=>{const w=mul(R,off?[v[0]-off[0],v[1]-off[1],v[2]-off[2]]:v),i=Math.floor(Cn+w[0]*PPM),j=Math.floor(Cn+w[1]*PPM),idx=j*N+i,vis=i<0||j<0||i>=N||j>=N||cb[idx]<0||w[2]>=zb[idx]-thr;return{x:w[0]*PPM,y:w[1]*PPM,z:w[2],vis}};
 const pts={props:m.pts.props.map(pr=>{const c=P2(pr.p,.6),u=mul(R,[0,pr.r,0]),v=mul(R,[0,0,pr.r]);return{x:c.x,y:c.y,ux:u[0]*PPM,uy:u[1]*PPM,vx:v[0]*PPM,vy:v[1]*PPM,vis:c.vis,rotary:pr.rotary,pusher:pr.pusher,fz:mul(R,[1,0,0])[2]}}),
  rings:m.pts.rings.map(v=>P2(v,.5)),eng:m.pts.eng.map(v=>P2(v,9)),exh:m.pts.exh.map(v=>P2(v,9)),cock:m.pts.cock.map(v=>P2(v,9))};
 S.stats.builds++;S.buildMs=(S.buildMs||0)+(performance.now()-t0);
 return{c:o,ax:Cn+1,ay:Cn+1,pts,N:N+2,sh:[]}}
/* sombra: silhueta com borrão de pixel (anel pontilhado) conforme a altura */
function shadowOf(sp,lvl){if(sp.sh[lvl])return sp.sh[lvl];const s=sp.c,w=s.width,h=s.height,pad=2,W2=w+pad*2,H2=h+pad*2,src=g2(s).getImageData(0,0,w,h).data,out=new ImageData(W2,H2),d=new Uint32Array(out.data.buffer),m=new Uint8Array(W2*H2);
 for(let j=0;j<h;j++)for(let i=0;i<w;i++)if(src[(j*w+i)*4+3]>100)m[(j+pad)*W2+i+pad]=1;
 const col=pack('#0b1207');
 for(let j=0;j<H2;j++)for(let i=0;i<W2;i++){const idx=j*W2+i;if(m[idx]){if(lvl===2&&((i+j)&1)&&!(m[idx-1]&&m[idx+1]&&m[idx-W2]&&m[idx+W2]))continue;d[idx]=col;continue}
  if(!lvl)continue;let near=0;for(let dy=-lvl;dy<=lvl;dy++)for(let dx=-lvl;dx<=lvl;dx++){if(Math.abs(dx)+Math.abs(dy)>lvl)continue;const ii=i+dx,jj=j+dy;if(ii>=0&&jj>=0&&ii<W2&&jj<H2&&m[jj*W2+ii])near=1}
  if(near&&((i+j)&1))d[idx]=col}
 const c=mk(W2,H2);g2(c).putImageData(out,0,0);sp.sh[lvl]=c;return c}
/* cache com orçamento */
const SPR=new Map();let budget=0;
const qi=(arr,v)=>{let b=0,bd=1e9;for(let i=0;i<arr.length;i++){const d=Math.abs(arr[i]-v);if(d<bd){bd=d;b=i}}return b};
function wrapDeg(a){a=((a+180)%360+360)%360-180;return a}
function sprite(type,hd,bank,pitch,fl='',force=false){const yi=((Math.round(hd/TAU*YN)%YN)+YN)%YN,bi=qi(BANKS,wrapDeg(bank)),pi=qi(PITS,clamp(pitch,-80,28)),key=type+'|'+yi+'|'+bi+'|'+pi+'|'+fl;
 let s=SPR.get(key);if(s)return s;if(!force&&budget<=0)return null;const t=performance.now();s=build(type,yi,bi,pi,fl);budget-=performance.now()-t;SPR.set(key,s);
 if(SPR.size>900){let n=0;for(const k of SPR.keys()){SPR.delete(k);if(++n>=120)break}}return s}

/* ======================================================================================
   3 · VOO (estado visual de cada aeronave)
   ====================================================================================== */
const TY={
 spad:{cls:'f',K:52,z:.62,maxB:72,turb:1,eng:'v8',f:118,chute:.02,crew:1,R:44,PW:65},
 fokker:{cls:'f',K:44,z:.66,maxB:70,turb:1,eng:'i6',f:96,chute:.42,crew:1,R:44,PW:65},
 camel:{cls:'f',K:95,z:.42,maxB:80,turb:1.45,torque:7,eng:'rot',f:70,chute:.02,crew:1,R:44,PW:65},
 halb:{cls:'2',K:30,z:.62,maxB:56,turb:.9,eng:'i6',f:92,chute:.36,crew:2,R:48,PW:75},
 breguet:{cls:'2',K:20,z:.7,maxB:46,turb:.75,eng:'v12',f:84,chute:.02,crew:2,R:48,PW:75},
 dfw:{cls:'2',K:22,z:.7,maxB:46,turb:.75,eng:'i6',f:88,chute:.36,crew:2,R:48,PW:75},
 salmson:{cls:'2',K:24,z:.66,maxB:48,turb:.8,eng:'rad',f:100,chute:.02,crew:2,R:48,PW:75},
 rumpler:{cls:'2',K:22,z:.7,maxB:46,turb:.75,eng:'i6',f:86,chute:.36,crew:2,R:48,PW:75},
 dh4:{cls:'b',K:16,z:.75,maxB:40,turb:.6,eng:'v12',f:78,chute:.02,crew:2,R:54,PW:85},
 gotha:{cls:'B',K:6,z:.85,maxB:26,turb:.4,eng:'twin',f:62,chute:.3,crew:3,R:66,PW:105}};
const SHX=14,SHY=22;                                  // sombra a altura 1 (igual a pixel.js/planefx)
const VPS=new Map();let CR=[],WR=[],PU=[],CH=[],FG=[],DB=[],BM=[],TR=[];
const srcType=(p,src)=>src==='g'?(p.kind==='bomber'?(p.team?'gotha':'dh4'):(p.team?'fokker':'spad')):src==='a'?({cap:['spad','fokker'],atk:['camel','halb'],spot:['breguet','dfw']}[p.role]||['spad','fokker'])[p.team?1:0]:(p.team?'rumpler':'salmson');
function rawPos(p,src){return src==='f'?[p.x,p.y-(p.alt||0)/Z]:[p.x,p.y]}
function newVP(p,src){const type=srcType(p,src),T=TY[type],[x,y]=rawPos(p,src),hd=src==='a'?(p.hd||0):src==='f'?(p.ang||0):(p.team?Math.PI:0);
 return{p,src,type,T,team:p.team?1:0,x,y,px:x,py:y,hd,ws:0,bank:0,bv:0,pitch:0,pv:0,alt:src==='f'?(p.alt||46)/38:T.cls==='b'||T.cls==='B'?1:.8,t:0,seed:Math.random()*99,prop:Math.random()*6,rpm:1,gun:Math.PI+(p.team?0:Math.PI),ex:0,sm:0,spr:null,ox:0,oy:0,bob:0,lastX:x,lastY:y,v:0}}
function targets(vp,dt){const p=vp.p,T=vp.T;let alt=T.cls==='b'||T.cls==='B'?1:.8,pitch=0;
 if(vp.src==='g'&&p.kind==='fighter'){const dir=p.team?-1:1,d=(p.tx-p.x)*dir;
  if(d>620){alt=.82}else if(d>250){const k=(620-d)/370;alt=lerp(.82,.26,k);pitch=-24*Math.sin(Math.min(1,k*1.3)*Math.PI*.5)}
  else if(d>-250){alt=.24;pitch=-8+Math.sin(vp.t*3.1+vp.seed)*3}
  else if(d>-640){const k=(-250-d)/390;alt=lerp(.24,.82,k);pitch=24*Math.sin(Math.min(1,k*1.6)*Math.PI*.5)*(1-k*.6)}
 }else if(vp.src==='a'){if(p.role==='atk'&&p.L){const L=p.L,dx=L.x1-L.x0,dy=L.y1-L.y0,len=hyp(dx,dy)||1,s=((p.x-L.x0)*dx+(p.y-L.y0)*dy)/len;
   if(s<-300){alt=.55}else if(s<-40){const k=(s+300)/260;alt=lerp(.55,.2,k);pitch=-20*Math.sin(k*Math.PI*.5+.3)}else if(s<len+40){alt=.2;pitch=-6+Math.sin(vp.t*2.4+vp.seed)*3}else{const k=Math.min(1,(s-len-40)/400);alt=lerp(.2,.65,k);pitch=20*(1-k)}}
  else if(p.role==='spot')alt=p.phase==='orbit'?.68:.74;else alt=.76}
 else if(vp.src==='f')alt=(p.alt||46)/38;
 return{alt,pitch}}
function vpTick(vp,dt){const p=vp.p,T=vp.T,[rx,ry]=rawPos(p,vp.src);vp.t+=dt;
 /* pequenas correções de rota (aviões do jogo voam reto): deslocamento lateral suave */
 let ox=0,oy=0;if(vp.src==='g'||(vp.src==='a'&&p.role==='atk')){const A=(T.cls==='B'?1.4:T.cls==='b'?2.6:5)*T.turb*Math.min(1,vp.t/1.2),w=vp.t,s=vp.seed,o=A*(Math.sin(w*.83+s)+.45*Math.sin(w*2.1+s*2.3));const h0=vp.src==='g'?(p.team?Math.PI:0):Math.atan2(p.uy||0,p.ux||1);ox=-Math.sin(h0)*o;oy=Math.cos(h0)*o}
 const x=rx+ox,y=ry+oy,dx=x-vp.x,dy=y-vp.y,d=hyp(dx,dy);vp.ox=ox;vp.oy=oy;
 if(d>(3000*dt+60)){vp.x=x;vp.y=y;vp.ws=0;vp.bank*=.3;vp.bv=0;if(vp.src==='a'&&p.hd!=null)vp.hd=p.hd;vp.v=0;return}
 vp.lastX=vp.x;vp.lastY=vp.y;vp.x=x;vp.y=y;const v=d/dt;vp.v+=(v-vp.v)*Math.min(1,dt*5);
 if(d>.01){const h=Math.atan2(dy,dx),dh=adiff(h,vp.hd)*Math.min(1,dt*(T.cls==='B'?7:12));const w=dh/dt;vp.hd=adiff(vp.hd+dh,0);vp.ws+=(w-vp.ws)*Math.min(1,dt*5)}else vp.ws*=Math.max(0,1-dt*3);
 const tg=targets(vp,dt),turb=T.turb*(Math.sin(vp.t*1.7+vp.seed)+.6*Math.sin(vp.t*3.9+vp.seed*2)+.3*Math.sin(vp.t*7.3+vp.seed));
 let bt=Math.atan(vp.v*vp.ws/230)*R2D;bt=clamp(bt,-T.maxB,T.maxB)+turb*2.2+(T.torque||0)*(.5+.5*Math.sin(vp.t*.7+vp.seed));
 const K=T.K,Dm=2*Math.sqrt(K)*(T.torque?.42:.8);vp.bv+=(K*(bt-vp.bank)-Dm*vp.bv)*dt;vp.bank+=vp.bv*dt;vp.bank=clamp(vp.bank,-89,89);
 const pt=tg.pitch-Math.abs(vp.bank)*.04+turb*.8,Kp=K*.6;vp.pv+=(Kp*(pt-vp.pitch)-2*Math.sqrt(Kp)*.9*vp.pv)*dt;vp.pitch+=vp.pv*dt;
 vp.alt+=(tg.alt+turb*.008-vp.alt)*Math.min(1,dt*1.8);
 vp.bob=Math.round(Math.sin(vp.t*2.05+vp.seed)*.95*Math.min(1,T.turb));
 vp.prop+=dt*(T.eng==='rot'?61:T.eng==='twin'?48:57)*vp.rpm;
 /* metralhador traseiro: aponta para o caça inimigo mais perto, senão vigia a cauda balançando */
 if(model(vp.type).pts.rings.length){let tg2=null,bd=520;for(const q of VPS.values())if(q.team!==vp.team&&q.T.cls==='f'){const dd=hyp(q.x-vp.x,q.y-vp.y);if(dd<bd){bd=dd;tg2=q}}
  const want=tg2?Math.atan2(tg2.y-vp.y,tg2.x-vp.x):vp.hd+Math.PI+Math.sin(vp.t*.6+vp.seed)*.9;vp.gun+=adiff(want,vp.gun)*Math.min(1,dt*(tg2?6:1.5));
  if(tg2&&bd<330&&(vp.fire=(vp.fire||0)-dt)<=0){vp.fire=rnd(.07,.12);if(TR.length<120)TR.push({x:vp.x,y:vp.y,a:vp.gun+rnd(-.08,.08),t:0,max:.22,team:vp.team})}}
 /* escape e fumaça de dano */
 emitExhaust(vp,dt)}
function emitExhaust(vp,dt){const sp=vp.spr;if(!sp)return;const T=vp.T,p=vp.p,dmg=vp.src==='g'&&p.ahp!=null;vp.ex+=dt*(T.eng==='rot'?16:T.eng==='twin'?9:10);
 const vis=Math.abs(vp.x-cam.x)<vw/Z*.75&&Math.abs(vp.y-cam.y)<vh/Z*.75;if(!vis){vp.ex=0;return}
 while(vp.ex>=1){vp.ex--;for(const e of sp.pts.exh){const wx=vp.x+(e.x)/Z+rnd(-1,1),wy=vp.y+(e.y+vp.bob)/Z+rnd(-1,1),b=-Math.cos(vp.hd)*30,c=-Math.sin(vp.hd)*30;
  if(T.eng==='rot')puff(wx,wy,0,b,c,rnd(.7,1.1),1,2.6,Math.random()<.2?'oilD':'oil',.42);else puff(wx,wy,0,b,c,rnd(.45,.7),1,2,'exh',.3)}}
 if(dmg){vp.sm+=dt*12;while(vp.sm>=1){vp.sm--;const e=sp.pts.eng[0]||{x:0,y:0};puff(vp.x+e.x/Z,vp.y+e.y/Z,0,-Math.cos(vp.hd)*25,-Math.sin(vp.hd)*25,rnd(1,1.6),1.5,4,'dark',.45)}}}

/* ---------- partículas próprias (fumaça, chamas) ---------- */
const PCOL={exh:'#8b877c',oil:'#7d8590',oilD:'#5d6168',dark:'#3a3732',black:'#1b1916',grey:'#57534b',pale:'#8b877c',fire:'#ff9a2e',fire2:'#ffd45a',dust:'#a8946c',ember:'#ff7a24'};
function puff(x,y,z,vx,vy,life,r0,r1,c,a,vz=0){if(PU.length>=520)PU.shift();PU.push({x,y,z,vx,vy,vz,t:0,max:life,r0,r1,c,a})}
function puTick(dt){const w=window.PXW&&PXW.windVec?PXW.windVec():{x:0,y:0};for(const p of PU){p.t+=dt;p.x+=(p.vx+w.x*.6)*dt;p.y+=(p.vy+w.y*.6)*dt;p.z+=p.vz*dt;p.vx*=Math.max(0,1-dt*1.8);p.vy*=Math.max(0,1-dt*1.8)}PU=PU.filter(p=>p.t<p.max)}
const PUFF=new Map();
function puffSpr(r,c){const k=c+r;let s=PUFF.get(k);if(s)return s;const n=r*2+1,cv=mk(n,n),x=g2(cv);const base=PCOL[c]||c,hi=mix(base,'#ffffff',.18),lo=mix(base,'#000000',.25);
 for(let j=-r;j<=r;j++)for(let i=-r;i<=r;i++){const d=Math.sqrt(i*i+j*j);if(d>r+.3)continue;const rim=d>r-.9;if(rim&&((i+j)&1))continue;x.fillStyle=(i+j<-r*.5)?hi:(i+j>r*.6)?lo:base;x.fillRect(i+r,j+r,1,1)}
 s={c:cv,r};PUFF.set(k,s);return s}
function flameSpr(sz,f){const k='fl'+sz+f;let s=PUFF.get(k);if(s)return s;const w=3+sz*2,h=5+sz*3,cv=mk(w,h),x=g2(cv);
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){const u=(i+.5)/w*2-1,v=1-(j+.5)/h,n=hash(i,j+f*7,sz*13+f),wd=(1-v)*.95+.05+(n-.5)*.35;if(Math.abs(u)>wd)continue;
  const c=Math.abs(u)<wd*.4&&v<.55?(v<.25?'#fff4c0':'#ffd45a'):Math.abs(u)<wd*.75?'#ff9a2e':'#c8461c';if(v>.8&&n<.5)continue;x.fillStyle=c;x.fillRect(i,j,1,1)}
 s={c:cv,ax:w>>1,ay:h-1};PUFF.set(k,s);return s}

/* ======================================================================================
   4 · QUEDA, PARAQUEDAS, DESTROÇOS
   ====================================================================================== */
const TAKEN=new WeakSet();
function startCrash(p,src,by,cause,vp){if(!vp)vp=VPS.get(p)||newVP(p,src);VPS.delete(p);TAKEN.add(p);
 const T=vp.T,cls=T.cls,r=Math.random();let mode=cls==='B'?(r<.5?'glide':r<.82?'dive':'break'):cls==='f'?(r<.38?'spin':r<.72?'dive':'break'):(r<.34?'dive':r<.6?'spin':r<.84?'glide':'break');
 for(const m of['spin','dive','break','glide'])if(/^test/.test(cause)&&cause.includes(m))mode=m;const fch=/^test.*chute/.test(cause);
 const burn=Math.random()<(mode==='dive'?.9:mode==='spin'?.55:mode==='glide'?.6:.45),h0=clamp(vp.alt,.35,1.3),side=Math.random()<.5?-1:1;
 const T0=(mode==='glide'?5.6:mode==='spin'?3.8:mode==='dive'?2.4:3.1)*(.62+.42*h0)*(cls==='B'?1.25:1);
 const sp=Math.max(120,vp.v||(vp.src==='g'?p.v||400:p.v||200));
 const c={type:vp.type,T,team:vp.team,x:vp.x,y:vp.y,h:h0,h0,hd:vp.hd,crs:vp.hd,bank:vp.bank,pitch:vp.pitch,sp,sp0:sp,mode,burn,fire:burn?.3:0,t:0,T0,side,by:by==null?1-vp.team:by,cause,
  yawR:0,cut:mode==='break'?side:0,seed:Math.random()*99,prop:vp.prop,spr:vp.spr,ex:0,fx:0,skid:0,gun:vp.gun,bail:[],src,dead:false};
 for(let i=0;i<T.crew;i++){const ok=fch||Math.random()<T.chute;if(ok&&h0>.42)c.bail.push({at:.35+i*.45+Math.random()*.45,i})}
 if(mode==='break')wingOff(c);
 for(let i=0;i<9;i++)debris(c,rnd(80,160));
 CR.push(c);S.stats.crashes++;return c}
function wingOff(c){const U=model(c.type).parts.find(p=>p.tag==='U').o,yy=c.side*(model(c.type).cutY+U.half)/2;
 const ox=-Math.sin(c.hd)*yy,oy=Math.cos(c.hd)*yy;FG.push({type:c.type,x:c.x+ox*PPM/Z/PPM*1,y:c.y+oy*PPM/Z/PPM*1,h:c.h,hd:c.hd,bank:c.bank,pitch:0,yr:rnd(2,4)*c.side,br:rnd(260,420)*c.side,vx:Math.cos(c.hd)*c.sp*.35,vy:Math.sin(c.hd)*c.sp*.35,t:0,side:c.side,spr:null})}
function debris(c,v){const a=Math.random()*TAU,s=rnd(.3,1)*v;if(DB.length<160)DB.push({x:c.x,y:c.y,h:c.h,vx:Math.cos(a)*s+Math.cos(c.hd)*c.sp*.4,vy:Math.sin(a)*s+Math.sin(c.hd)*c.sp*.4,vh:rnd(-.1,.25),t:0,col:Math.random()<.5?'#2a2620':(Math.random()<.5?'#cfc49c':'#ff9a2e'),sz:Math.random()<.3?2:1})}
const gpos=(x,y,h)=>[x+SHX*h/Z,y+SHY*h/Z];       // ponto do chão sob o avião (onde a sombra encosta)
function crTick(c,dt){const fch=/^test.*chute/.test(c.cause);c.t+=dt;const k=Math.min(1,c.t/c.T0),e=c.mode==='glide'?1:c.mode==='dive'?1.7:1.45;
 if(!c.skid){c.h=c.h0*(1-Math.pow(k,e));
  if(c.mode==='spin'){c.yawR+=(3.6*c.side-c.yawR)*Math.min(1,dt*1.3);c.hd+=c.yawR*dt;c.crs+=c.yawR*.33*dt;c.pitch+=(-62-c.pitch)*Math.min(1,dt*2.5);c.bank=c.side*22+Math.sin(c.t*4.2)*16;c.sp+=(70-c.sp)*Math.min(1,dt*1.2)}
  else if(c.mode==='dive'){c.pitch+=(-60-c.pitch)*Math.min(1,dt*1.6);c.bank+=c.side*48*dt;c.hd+=Math.sin(c.t*2.3)*.15*dt;c.crs=c.hd;c.sp+=(Math.min(520,c.sp0*1.15)-c.sp)*Math.min(1,dt*.8)}
  else if(c.mode==='break'){c.bank+=c.side*330*dt;c.pitch+=(-38-c.pitch)*Math.min(1,dt*2);c.hd+=c.side*.9*dt;c.crs+=c.side*.4*dt;c.sp+=(190-c.sp)*Math.min(1,dt*1.5)}
  else{c.pitch=-11+Math.sin(c.t*1.7)*3;c.bank=Math.sin(c.t*.95+c.seed)*16+c.side*9;c.hd+=c.side*.12*dt;c.crs=c.hd;c.sp+=(Math.max(110,c.sp0*.7)-c.sp)*Math.min(1,dt*.6)}
  c.x+=Math.cos(c.crs)*c.sp*dt;c.y+=Math.sin(c.crs)*c.sp*dt;
  if(c.h<=0||k>=1){c.h=0;if(c.mode==='glide'){c.skid=1;c.pitch=-2;c.bank*=.3;c.sp=Math.max(c.sp*.6,90);dustBurst(c.x,c.y,8);try{sound('boom')}catch{}}else return impact(c)}}
 else{c.sp-=dt*240;c.x+=Math.cos(c.hd)*c.sp*dt;c.y+=Math.sin(c.hd)*c.sp*dt;furrow(c);if(Math.random()<dt*20)puff(c.x+rnd(-6,6),c.y+rnd(-4,4),0,rnd(-10,10),rnd(-8,2),rnd(.8,1.4),3,7,'dust',.45,8);if(c.sp<=15)return impact(c)}
 /* fogo, fumaça e tripulação */
 c.fire=c.burn?Math.min(1,c.fire+dt*.7):0;const sp=c.spr;
 if(sp){c.ex+=dt*(c.burn?30:16);while(c.ex>=1){c.ex--;const e=sp.pts.eng[Math.floor(Math.random()*sp.pts.eng.length)]||{x:0,y:0},wx=c.x+e.x/Z+rnd(-2,2),wy=c.y+e.y/Z+rnd(-2,2),gr=Math.min(1,c.t/1.5);
  if(c.burn){puff(wx,wy,0,rnd(-8,8),rnd(-8,8),rnd(2.2,3.4),2+gr*1.5,6+gr*3,Math.random()<.75?'black':'dark',.6+gr*.2,rnd(4,10));if(Math.random()<.6)puff(wx,wy,0,rnd(-20,20),rnd(-20,20),rnd(.18,.32),1,2,Math.random()<.5?'fire':'fire2',.85)}
  else puff(wx,wy,0,rnd(-6,6),rnd(-6,6),rnd(2,3),2+gr,5.5+gr*2.5,Math.random()<.6?'dark':'grey',.62,rnd(2,6))}}
 if(Math.random()<dt*3)debris(c,60);
 for(const b of c.bail)if(!b.done&&c.t>=b.at){b.done=1;if(c.h>.3){const ck=sp&&sp.pts.cock[b.i]||{x:0,y:0};CH.push({x:c.x+ck.x/Z,y:c.y+ck.y/Z,h:c.h,vx:Math.cos(c.crs)*c.sp*.25,vy:Math.sin(c.crs)*c.sp*.25,t:0,open:0,team:c.team,seed:Math.random()*9,land:0,fail:!fch&&Math.random()<.08});S.stats.chutes++}}}
function dustBurst(x,y,n){for(let i=0;i<n;i++)puff(x+rnd(-10,10),y+rnd(-6,6),0,rnd(-40,40),rnd(-25,15),rnd(.9,1.6),3,8,'dust',.5,rnd(4,12))}
function furrow(c){const t=window.PXGAME&&PXGAME.tctx;if(!t)return;const bx=Math.round(c.x*Z),by=Math.round(c.y*Z),nx=-Math.sin(c.hd),ny=Math.cos(c.hd);
 for(let s=-2;s<=2;s++){t.fillStyle=Math.abs(s)===2?'#4a3a28':'#211a12';t.fillRect(Math.round(bx+nx*s),Math.round(by+ny*s),1,1)}}
function impact(c){c.dead=true;const x=clamp(c.x,20,W-20),y=clamp(c.y,20,H-20),T=c.T;
 try{window.explode(x,y,T.R,T.PW,c.by)}catch(e){fail(e)}
 scorch(x,y,T.cls==='B'?13:T.cls==='f'?8:10);dustBurst(x,y,6);
 for(let i=0;i<14;i++){const a=Math.random()*TAU,s=rnd(40,150);DB.push({x,y,h:.02,vx:Math.cos(a)*s,vy:Math.sin(a)*s*.7,vh:rnd(.25,.6),t:0,col:Math.random()<.4?'#2a2620':Math.random()<.5?'#5a5547':'#ff9a2e',sz:Math.random()<.4?2:1,ground:1})}
 const hd=c.mode==='spin'?Math.random()*TAU:c.hd;WR.push({type:c.type,team:c.team,x,y,hd,t:0,seed:c.seed,bank:c.mode==='glide'?0:(Math.random()<.5?-10:10),cut:c.cut||(Math.random()<.4?(Math.random()<.5?-1:1):0),big:T.cls==='B',spr:null,ex:0});
 S.stats.wrecks++;if(WR.length>14)stampWreck(WR.shift())}
function scorch(x,y,r){const t=window.PXGAME&&PXGAME.tctx;if(!t)return;const bx=Math.round(x*Z),by=Math.round(y*Z);
 for(let j=-r;j<=r;j++)for(let i=-r;i<=r;i++){const d=Math.sqrt(i*i+j*j*1.6)/r,n=hash(i+bx,j+by,5);if(d>1||n<d*.9)continue;t.fillStyle=d<.5?(n>.6?'#14110d':'#1d1812'):(n>.5?'#2a2219':'#33291d');t.fillRect(bx+i,by+j,1,1)}}
function stampWreck(w){const t=window.PXGAME&&PXGAME.tctx;if(!t)return;const s=sprite(w.type,w.hd,w.bank,-6,'k',true);t.drawImage(s.c,Math.round(w.x*Z)-s.ax,Math.round(w.y*Z)-s.ay)}
function fgTick(f,dt){f.t+=dt;f.h-=dt*(.09+.05*Math.sin(f.t*5));f.hd+=f.yr*dt;f.bank+=f.br*dt;f.x+=f.vx*dt;f.y+=f.vy*dt;f.vx*=1-dt*.8;f.vy*=1-dt*.8;
 if(f.h<=0){f.dead=true;const t=window.PXGAME&&PXGAME.tctx;if(t){const s=sprite(f.type,f.hd,0,0,f.side>0?'fR':'fL',true);t.drawImage(s.c,Math.round(f.x*Z)-s.ax,Math.round(f.y*Z)-s.ay)}dustBurst(f.x,f.y,3)}}
function chTick(c,dt){c.t+=dt;const w=window.PXW&&PXW.windVec?PXW.windVec():{x:0,y:0};
 if(c.land){c.land+=dt;if(c.land>28)c.dead=true;return}
 if(!c.open&&c.t>.5&&!c.fail)c.open=.001;if(c.open)c.open=Math.min(1,c.open+dt*2.2);
 const vh=c.open?lerp(.22,.028,c.open):Math.min(.45,.12+c.t*.45);c.h-=vh*dt;c.vx*=1-dt*(c.open?1.5:.3);c.vy*=1-dt*(c.open?1.5:.3);c.x+=(c.vx+w.x*(c.open?.8:.2))*dt;c.y+=(c.vy+w.y*(c.open?.8:.2))*dt;
 if(c.h<=0){c.h=0;c.land=.001;if(!c.open)c.dead=true}}
function dbTick(d,dt){d.t+=dt;d.vh-=dt*1.1;d.h=Math.max(0,d.h+d.vh*dt*(d.ground?.5:1));d.x+=d.vx*dt;d.y+=d.vy*dt;d.vx*=1-dt*.9;d.vy*=1-dt*.9;
 if(d.h<=0&&(d.vh<0||d.t>.3)){d.dead=true;const t=window.PXGAME&&PXGAME.tctx;if(t&&d.col!=='#ff9a2e'){t.fillStyle=d.col;t.fillRect(Math.round(d.x*Z),Math.round(d.y*Z),d.sz,1)}}}
/* destroço no chão: fogo forte → fogo baixo → brasa → frio (gravado no terreno) */
function wFire(w){const t=w.t;return t<45?1:t<130?1-(t-45)/85*.72:t<270?.28*(1-(t-130)/140):0}
function wrTick(w,dt){w.t+=dt;const f=wFire(w);if(w.t>300){w.dead=true;stampWreck(w);return}
 const near=Math.abs(w.x-cam.x)<vw/Z*.9&&Math.abs(w.y-cam.y)<vh/Z*.9;if(!near)return;
 w.ex+=dt*(1.2+f*(w.big?10:6.5));while(w.ex>=1){w.ex--;const r=w.big?rnd(-14,14):rnd(-7,7),x=w.x+Math.cos(w.hd)*r,y=w.y+Math.sin(w.hd)*r;
  if(f>.02)puff(x,y,rnd(0,4),rnd(-6,6),rnd(-4,2),rnd(4,6.5)*(f>.3?1:.7),f>.3?2.5:1.5,f>.3?(w.big?11:8.5):5,f>.55?'black':f>.25?'dark':'grey',f>.3?.62:.38,rnd(18,30));
  else puff(x,y,0,rnd(-3,3),rnd(-3,1),rnd(3,4.5),1,3.2,'pale',.36,rnd(10,16))}}
function trTick(dt){for(const t of TR)t.t+=dt;TR=TR.filter(t=>t.t<t.max)}
/* bombas de 25 kg do ataque ao solo (aviation.js agenda o shell; aqui só a queda visível) */
function bmTick(dt){for(const b of BM)b.t+=dt;BM=BM.filter(b=>b.t<b.max)}

/* ======================================================================================
   5 · LIGAÇÕES COM O JOGO
   ====================================================================================== */
const PXFLp=()=>window.PXFL&&typeof PXFL.planes==='function'&&PXFL.on!==false?PXFL.planes():[];
const AIRp=()=>typeof P.air==='function'?P.air():[];
const known=new WeakSet();
function takeShell(fn){for(let i=shells.length-1;i>=0;i--){const s=shells[i];if(!known.has(s)&&fn(s)){shells.splice(i,1);return true}}return false}
function postUpdate(dt,airSnap){
 /* 1 · abates feitos por outros módulos */
 for(const p of planes)if(p.downed&&!TAKEN.has(p)){const vp=VPS.get(p);if(vp){takeShell(s=>s.r===40&&s.power===60&&Math.abs(s.x-clamp(vp.x,20,W-20))<90&&Math.abs(s.y-clamp(vp.y+30,20,H-20))<90);startCrash(p,'g',1-p.team,'caça',vp);S.stats.takeovers++}else TAKEN.add(p)}
 if(planes.some(p=>TAKEN.has(p)))planes=planes.filter(p=>!TAKEN.has(p));
 for(const p of airSnap)if(p.dead&&!TAKEN.has(p)){const vp=VPS.get(p);takeShell(s=>s.r===40&&s.power===60&&Math.abs(s.x-clamp(p.x+Math.cos(p.hd)*60,20,W-20))<12&&Math.abs(s.y-clamp(p.y+Math.sin(p.hd)*60+30,20,H-20))<12);startCrash(p,'a',1-p.team,'abatido',vp);S.stats.takeovers++}
 for(const p of PXFLp())if(p.st==='down'&&!TAKEN.has(p)){p.dead=true;startCrash(p,'f',1-p.team,'flak');S.stats.takeovers++}
 /* bombas do ataque ao solo: shell novo de r40/90 perto de um Camel/Halberstadt */
 for(const s of shells)if(!known.has(s)&&s.r===40&&s.power===90&&s.t>=.85){let best=null,bd=90;for(const vp of VPS.values())if(vp.src==='a'&&vp.p.role==='atk'){const d=hyp(vp.x-s.x,vp.y-s.y);if(d<bd){bd=d;best=vp}}if(best)BM.push({x0:best.x,y0:best.y,x1:s.x,y1:s.y,t:0,max:s.t,team:best.team})}
 for(const s of shells)known.add(s);
 /* 2 · estado visual de quem voa */
 const seen=new Set();
 for(const p of planes){if(p.delay>0||p.downed)continue;let vp=VPS.get(p);if(!vp){vp=newVP(p,'g');VPS.set(p,vp)}else vpTick(vp,dt);seen.add(p)}
 for(const p of AIRp()){if(p.dead||p.wait>0)continue;let vp=VPS.get(p);if(!vp){vp=newVP(p,'a');VPS.set(p,vp)}else vpTick(vp,dt);seen.add(p)}
 for(const p of PXFLp()){if(p.st==='down'||p.dead)continue;let vp=VPS.get(p);if(!vp){vp=newVP(p,'f');VPS.set(p,vp)}else vpTick(vp,dt);seen.add(p)}
 for(const p of VPS.keys())if(!seen.has(p))VPS.delete(p);
 /* 3 · simulação das quedas e do que sobra */
 for(const c of CR)crTick(c,dt);CR=CR.filter(c=>!c.dead);
 for(const f of FG)fgTick(f,dt);FG=FG.filter(f=>!f.dead);
 for(const c of CH)chTick(c,dt);CH=CH.filter(c=>!c.dead);
 for(const d of DB)dbTick(d,dt);DB=DB.filter(d=>!d.dead);
 for(const w of WR)wrTick(w,dt);WR=WR.filter(w=>!w.dead);
 puTick(dt);trTick(dt);bmTick(dt);engineSound(dt)}

/* ---------- desenho ---------- */
let OX=0,OY=0;const sx=x=>OX+Math.round(x*Z),sy=y=>OY+Math.round(y*Z);
const onS=(x,y,m)=>x>-m&&y>-m&&x<vw+m&&y<vh+m;
function vpSprite(o,type,hd,bank,pitch,fl){const s=sprite(type,hd,bank,pitch,fl,!o.spr);if(s)o.spr=s;return o.spr}
function drawShadow(c,o,h,ground){const sp=o.spr;if(!sp)return;const lvl=h>.85?2:h>.42?1:0,shd=shadowOf(sp,lvl),x=sx(o.x)+Math.round(SHX*h),y=sy(o.y)+Math.round(SHY*h);
 if(!onS(x,y,sp.N))return;c.globalAlpha=clamp(.5-.14*h,.3,.5);c.drawImage(shd,x-sp.ax-2,y-sp.ay-2);c.globalAlpha=1}
function under(c,ox,oy){OX=ox;OY=oy;
 for(const vp of VPS.values())if(vp.spr)drawShadow(c,vp,vp.alt);
 for(const k of CR)drawShadow(c,k,k.h);
 for(const f of FG)drawShadow(c,f,f.h);
 c.fillStyle='#0b1207';for(const ch of CH){const x=sx(ch.x)+Math.round(SHX*ch.h),y=sy(ch.y)+Math.round(SHY*ch.h);if(!onS(x,y,10))continue;c.globalAlpha=.28;if(ch.open&&!ch.land){c.fillRect(x-3,y-1,7,3);c.fillRect(x-2,y-2,5,5)}else c.fillRect(x,y,2,1);c.globalAlpha=1}
 for(const b of BM){const k=clamp(b.t/b.max,0,1),h=1-k*k,x=sx(lerp(b.x0,b.x1,k))+Math.round(SHX*.2*h),y=sy(lerp(b.y0,b.y1,k))+Math.round(SHY*.2*h);c.globalAlpha=.3;c.fillStyle='#0b1207';c.fillRect(x-1,y,3,1);c.globalAlpha=1}}
function groundLayer(c,ox,oy){OX=ox;OY=oy;
 for(const w of WR){const x=sx(w.x),y=sy(w.y);if(!onS(x,y,90))continue;const s=sprite(w.type,w.hd,w.bank,-6,w.t>150?'k':'w',!w.spr);if(s)w.spr=s;if(w.spr)c.drawImage(w.spr.c,x-w.spr.ax,y-w.spr.ay)}
 for(const ch of CH)if(ch.land){const x=sx(ch.x),y=sy(ch.y);if(!onS(x,y,10))continue;const a=ch.land>22?1-(ch.land-22)/6:1;c.globalAlpha=clamp(a,0,1);
  const k=Math.min(1,ch.land/1.2);c.fillStyle='#d9d4c2';c.fillRect(x+1,y-1,Math.round(3+k*4),2);c.fillStyle='#b9b29c';c.fillRect(x+2,y+1,Math.round(2+k*4),1);c.fillStyle=ch.team?'#6d6b55':'#5e6b4a';c.fillRect(x-1,y-1,2,2);c.fillStyle='#c9a57a';c.fillRect(x-2,y-1,1,1);c.globalAlpha=1}}
function drawPuffs(c){for(const p of PU){const k=p.t/p.max,x=sx(p.x),y=sy(p.y)-Math.round(p.z*Z*2);if(!onS(x,y,16))continue;const r=Math.max(1,Math.round(p.r0+(p.r1-p.r0)*Math.sqrt(k))),s=puffSpr(Math.min(12,r),p.c);c.globalAlpha=p.a*(1-k)*(k<.08?k/.08:1);c.drawImage(s.c,x-s.r,y-s.r)}c.globalAlpha=1}
function drawProp(c,x,y,pr,phase,on){if(!pr.vis&&pr.fz>-.3)return;const cx=x+pr.x,cy=y+pr.y;
 if(on){/* disco translúcido pontilhado + pontas + duas pás "estroboscópicas" */
  const ext=Math.ceil(Math.max(Math.abs(pr.ux)+Math.abs(pr.vx),Math.abs(pr.uy)+Math.abs(pr.vy))),det=pr.ux*pr.vy-pr.vx*pr.uy;
  if(Math.abs(det)>.6){const fr=(time*30|0)&1;c.fillStyle='#d8dccc';for(let j=-ext;j<=ext;j++)for(let i=-ext;i<=ext;i++){if(((i+j+fr)&1))continue;const px=i+.5-(cx%1),py=j+.5-(cy%1),a=(px*pr.vy-py*pr.vx)/det,b=(py*pr.ux-px*pr.uy)/det,rr=a*a+b*b;if(rr>1)continue;c.globalAlpha=rr>.72?.42:.16;c.fillRect(Math.floor(cx)+i,Math.floor(cy)+j,1,1)}}
  else{const n=hyp(pr.ux,pr.uy)||1,fx=Math.round(-pr.uy/n),fy=Math.round(pr.ux/n);c.globalAlpha=.42;PX.pline(c,cx-pr.ux,cy-pr.uy,cx+pr.ux,cy+pr.uy,'#dfe2d4');c.globalAlpha=.22;PX.pline(c,cx-pr.ux+fx,cy-pr.uy+fy,cx+pr.ux+fx,cy+pr.uy+fy,'#dfe2d4');c.globalAlpha=.6;c.fillStyle='#e8d9a0';c.fillRect(Math.floor(cx-pr.ux),Math.floor(cy-pr.uy),1,1);c.fillRect(Math.floor(cx+pr.ux),Math.floor(cy+pr.uy),1,1)}
  const a=phase,bx=pr.ux*Math.cos(a)+pr.vx*Math.sin(a),by=pr.uy*Math.cos(a)+pr.vy*Math.sin(a);c.globalAlpha=.45;PX.pline(c,cx-bx*.9,cy-by*.9,cx+bx*.9,cy+by*.9,'#3a2c1c');c.globalAlpha=1}
 else{const a=phase,bx=pr.ux*Math.cos(a)+pr.vx*Math.sin(a),by=pr.uy*Math.cos(a)+pr.vy*Math.sin(a);PX.pline(c,cx-bx,cy-by,cx+bx,cy+by,'#7a5530');c.fillStyle='#2a2d30';c.fillRect(Math.floor(cx),Math.floor(cy),1,1)}
 if(pr.rotary&&on&&((time*24|0)%3===0)){c.fillStyle='#e8e2c8';c.fillRect(Math.floor(cx-pr.ux*.25),Math.floor(cy-pr.uy*.25),1,1)}}
function drawGunner(c,x,y,sp,gun){for(const r of sp.pts.rings){if(!r.vis)continue;const gx=Math.floor(x+r.x),gy=Math.floor(y+r.y),ca=Math.cos(gun),sa=Math.sin(gun);
 c.fillStyle='#202226';for(let i=1;i<=5;i++)c.fillRect(Math.round(gx+ca*i),Math.round(gy+sa*i),1,1);c.fillStyle='#0c0d0f';c.fillRect(Math.round(gx+ca*5),Math.round(gy+sa*5),1,1);
 c.fillStyle='#4a3a26';c.fillRect(gx-1,gy-1,2,2);c.fillStyle='#6b5233';c.fillRect(gx-1,gy-1,1,1)}}
function drawFlames(c,x,y,sp,f,seed){if(f<=0)return;const fr=((time*14+seed)|0)%4,sz=f>.7?2:f>.35?1:0;for(const e of sp.pts.eng){const fs=flameSpr(sz,fr);c.drawImage(fs.c,Math.floor(x+e.x)-fs.ax,Math.floor(y+e.y)-fs.ay)}}
function drawPlane(c,o,type,hd,bank,pitch,fl,bob,gun,engOn,fire){const sp=vpSprite(o,type,hd,bank,pitch,fl);if(!sp)return;const x=sx(o.x),y=sy(o.y)+bob;if(!onS(x,y,sp.N/2+4))return;
 const pz=[],pf=[];for(const pr of sp.pts.props)(pr.pusher?pz:pf).push(pr);
 for(const pr of pz)drawProp(c,x,y,pr,o.prop,engOn);
 c.drawImage(sp.c,x-sp.ax,y-sp.ay);
 for(const pr of pf)drawProp(c,x,y,pr,o.prop,engOn);
 if(gun!=null&&sp.pts.rings.length)drawGunner(c,x,y,sp,gun);
 if(fire)drawFlames(c,x,y,sp,fire,o.seed||0)}
function drawAir(c,ox,oy){OX=ox;OY=oy;const t0=performance.now();budget=3;
 /* fumaça das colunas e rastros (no ar), chamas no chão */
 for(const w of WR){const f=wFire(w);if(f<=.02)continue;const x=sx(w.x),y=sy(w.y);if(!onS(x,y,60))continue;const n=w.big?4:2+Math.round(f*1.5),fr=(time*12|0);
  for(let i=0;i<n;i++){const r=(hash(i,3,w.seed*10|0)-.5)*(w.big?26:13),fs=flameSpr(f>.6&&i<2?2:f>.3?1:0,(fr+i)%4),fx=x+Math.round(Math.cos(w.hd)*r),fy=y+Math.round(Math.sin(w.hd)*r)+1;
   if(f<.3&&((fr+i)%3))continue;c.drawImage(fs.c,fx-fs.ax,fy-fs.ay)}
  if(f<.3){c.fillStyle=(fr&1)?'#ff7a24':'#c8461c';c.fillRect(x+((fr>>1)%5)-2,y,1,1)}}
 drawPuffs(c);
 for(const b of BM){const k=clamp(b.t/b.max,0,1),x=sx(lerp(b.x0,b.x1,k)),y=sy(lerp(b.y0,b.y1,k));if(!onS(x,y,8))continue;c.fillStyle=INKC;c.fillRect(x-1,y-1,3,2);c.fillStyle=b.team?'#5d666c':'#64663f';c.fillRect(x-1,y-1,2,1)}
 for(const d of DB){if(d.h<=0)continue;const x=sx(d.x)-Math.round(0),y=sy(d.y);if(!onS(x,y,4))continue;c.fillStyle=d.col;c.fillRect(x,y,d.sz,d.sz>1&&((time*20|0)&1)?1:d.sz)}
 for(const ch of CH)if(!ch.land){const x=sx(ch.x),y=sy(ch.y);if(!onS(x,y,12))continue;drawChute(c,x,y,ch)}
 for(const f of FG){const s=sprite(f.type,f.hd,f.bank,0,f.side>0?'fR':'fL',!f.spr);if(s)f.spr=s;if(f.spr){const x=sx(f.x),y=sy(f.y);if(onS(x,y,40))c.drawImage(f.spr.c,x-f.spr.ax,y-f.spr.ay)}}
 /* traçantes do metralhador traseiro */
 for(const t of TR){const k=t.t/t.max,d=60+k*240,x=sx(t.x+Math.cos(t.a)*d),y=sy(t.y+Math.sin(t.a)*d);if(!onS(x,y,8))continue;PX.pline(c,x,y,x-Math.round(Math.cos(t.a)*4),y-Math.round(Math.sin(t.a)*4),t.team?'#ffc58f':'#ffeeb0');c.fillStyle='#fff';c.fillRect(x,y,1,1)}
 /* aviões: os mais baixos primeiro */
 const L=[];for(const vp of VPS.values())L.push([vp.alt,vp,0]);for(const k of CR)L.push([k.h,k,1]);L.sort((a,b)=>a[0]-b[0]);
 for(const [,o,isC] of L){if(isC){const fl=o.cut?(o.cut>0?'cR':'cL'):'';o.prop+=(o.burn?.18:.12);drawPlane(c,o,o.type,o.hd,o.bank,o.pitch,fl,0,o.gun,false,o.fire)}
  else drawPlane(c,o,o.type,o.hd,o.bank,o.pitch,'',o.bob,o.gun,true,0)}
 const ms=performance.now()-t0,net=ms-(3-Math.max(0,budget));S.drawMs=S.drawMs==null?ms:S.drawMs*.95+ms*.05;S.drawNet=S.drawNet==null?net:S.drawNet*.95+net*.05}
function drawChute(c,x,y,ch){const sw=Math.round(Math.sin(ch.t*1.6+ch.seed)*1.2);
 if(!ch.open){const f=(time*10|0)&1;c.fillStyle=INKC;c.fillRect(x-1,y-1,3,3);c.fillStyle=ch.team?'#7d7458':'#6b7a52';c.fillRect(x-1+f,y-1,2,2);if(ch.t>.5&&!ch.fail){c.fillStyle='#e9e6d8';c.fillRect(x-1,y-3-f,2,2)}return}
 const k=ch.open,r=Math.max(1,Math.round(1+3.5*k)),cx=x+sw,cy=y-4-Math.round(k*2);
 c.fillStyle='#4a4a40';for(const s of[-1,1])PX.pline(c,cx+s*r,cy+1,x,y,'rgba(60,60,52,.8)');
 for(let j=-r;j<=Math.round(r*.7);j++)for(let i=-r;i<=r;i++){const d=i*i+j*j*1.6;if(d>r*r+.5)continue;const g=Math.floor((Math.atan2(j,i)+Math.PI)/TAU*8)&1;c.fillStyle=(i+j>r*.4)?(g?'#a9a28c':'#b9b29c'):(g?'#d9d4c2':'#efeadc');c.fillRect(cx+i,cy+j,1,1)}
 c.fillStyle='#6b6656';c.fillRect(cx,cy-Math.round(r*.2),1,1);
 c.fillStyle=INKC;c.fillRect(x-1,y,2,3);c.fillStyle=ch.team?'#7d7458':'#6b7a52';c.fillRect(x-1,y,1,2);c.fillStyle='#c9a57a';c.fillRect(x-1,y-1,2,1)}
/* indicadores que os módulos de origem desenhavam junto do avião (setor do observador e do reconhecimento) */
function indicators(c,ox,oy){OX=ox;OY=oy;const pt=typeof playerTeam==='number'?playerTeam:0,col=pt?'#e29a87':'#aed6d4';
 for(const p of AIRp())if(p.role==='spot'&&!p.dead&&p.team===pt&&p.phase==='orbit'&&P.cfg&&P.cfg.SPOT){c.globalAlpha=.35;const R=Math.round(P.cfg.SPOT.see*Z),cx=sx(p.cx),cy=sy(p.cy);c.fillStyle=col;for(let k=0;k<48;k++){const a=k/48*TAU+time*.2;if(k%2)c.fillRect(cx+Math.round(Math.cos(a)*R),cy+Math.round(Math.sin(a)*R*.75),2,1)}c.globalAlpha=1}
 const FC=window.PXFL&&PXFL.cfg&&PXFL.cfg.AIR;if(FC)for(const p of PXFLp())if(p.st!=='down'&&!p.dead&&p.team===pt){c.globalAlpha=.4;PX.ring(c,sx(p.x),sy(p.y),Math.round(FC.SEC*Z),Math.round(FC.SEC*Z*.8),col,4,Math.floor(time*6));c.globalAlpha=1}
 /* antena de rádio arrastada (peso na ponta) dos observadores */
 for(const vp of VPS.values())if(vp.src==='f'||(vp.src==='a'&&vp.p.role==='spot')){const x=sx(vp.x),y=sy(vp.y)+vp.bob,bx=-Math.cos(vp.hd),by=-Math.sin(vp.hd);c.globalAlpha=.7;for(let i=4;i<14;i++){const s=Math.sin(time*3+i*.5)*i*.08;c.fillStyle='#bdb8a2';c.fillRect(Math.round(x+bx*i-by*s),Math.round(y+by*i+bx*s+i*.15),1,1)}c.globalAlpha=1}}

/* ======================================================================================
   6 · SOM DO MOTOR (síntese leve: duas vozes para os aviões mais perto)
   ====================================================================================== */
let VO=null,sndT=0;
function engineSound(dt){if((sndT-=dt)>0)return;sndT=.1;try{
 const live=typeof soundOn!=='undefined'&&soundOn&&typeof audio!=='undefined'&&audio&&audio.state!=='closed';if(!live){if(VO)for(const v of VO)v.g.gain.setTargetAtTime(0,audio?audio.currentTime:0,.1);return}
 if(!VO){VO=[];for(let i=0;i<2;i++){const o1=audio.createOscillator(),o2=audio.createOscillator(),lf=audio.createOscillator(),lg=audio.createGain(),f=audio.createBiquadFilter(),g=audio.createGain(),am=audio.createGain(),pn=audio.createStereoPanner?audio.createStereoPanner():null;
   o1.type='sawtooth';o2.type='square';lf.type='sine';lf.frequency.value=9;lg.gain.value=0;f.type='lowpass';f.Q.value=2.2;f.frequency.value=600;g.gain.value=0;am.gain.value=.6;
   o1.connect(f);o2.connect(f);f.connect(am);lf.connect(lg);lg.connect(am.gain);am.connect(g);if(pn){g.connect(pn);pn.connect(audio.destination)}else g.connect(audio.destination);
   o1.start();o2.start();lf.start();VO.push({o1,o2,lf,lg,f,g,pn})}}
 const Lr=typeof mode!=='undefined'&&mode==='soldier'&&player?player:cam,now=audio.currentTime,cand=[];
 for(const vp of VPS.values())cand.push({x:vp.x,y:vp.y,T:vp.T,vx:vp.x-vp.lastX,vy:vp.y-vp.lastY,dive:Math.max(0,-vp.pitch),on:1});
 for(const k of CR)cand.push({x:k.x,y:k.y,T:k.T,vx:Math.cos(k.crs)*k.sp*.04,vy:Math.sin(k.crs)*k.sp*.04,dive:Math.max(0,-k.pitch)*1.6,on:k.burn?.7:1});
 for(const q of cand)q.d=hyp(q.x-Lr.x,q.y-Lr.y);cand.sort((a,b)=>a.d-b.d);
 for(let i=0;i<VO.length;i++){const v=VO[i],q=cand[i];if(!q||q.d>1400){v.g.gain.setTargetAtTime(0,now,.15);continue}
  const T=q.T,rx=(q.x-Lr.x)/(q.d||1),ry=(q.y-Lr.y)/(q.d||1),vr=(q.vx*rx+q.vy*ry)/.04,dop=clamp(1-vr/1400,.8,1.25),f=T.f*dop*(1+q.dive/120);
  v.o1.frequency.setTargetAtTime(f,now,.08);v.o2.frequency.setTargetAtTime(T.eng==='twin'?f*1.018:f*.5,now,.08);v.lf.frequency.setTargetAtTime(T.eng==='rot'?f/7.5:T.eng==='twin'?2.3:f/12,now,.1);
  v.lg.gain.setTargetAtTime(T.eng==='rot'?.45:T.eng==='twin'?.3:.12,now,.1);v.f.frequency.setTargetAtTime(clamp(16000*Math.exp(-q.d/420),280,2400),now,.1);
  v.g.gain.setTargetAtTime(.032*q.on/(1+Math.pow(q.d/380,1.7))*(T.cls==='B'?1.4:1),now,.12);if(v.pn)v.pn.pan.setTargetAtTime(clamp((q.x-Lr.x)/700,-.85,.85),now,.1)}}catch(e){VO=null;fail(e)}}

/* ======================================================================================
   7 · GANCHOS
   ====================================================================================== */
const wrapG=(name,fn)=>{const orig=window[name];if(typeof orig!=='function')return null;window[name]=function(...a){return fn(orig,...a)};return orig};
let SAVED=null;
const restorePlanes=()=>{if(SAVED){planes=SAVED;SAVED=null}};
wrapG('update',(orig,dt)=>{restorePlanes();if(!S.on||!(dt>0))return orig(dt);const snap=AIRp().slice();const r=orig(dt);try{if(typeof started==='undefined'||started)postUpdate(dt,snap)}catch(e){fail(e)}return r});
wrapG('render',(orig,...a)=>{try{return orig(...a)}finally{restorePlanes()}});
wrapG('setup',(orig,...a)=>{VPS.clear();CR=[];WR=[];PU=[];CH=[];FG=[];DB=[];BM=[];TR=[];SAVED=null;return orig(...a)});
let shifted=[];
if(window.PLN){const u0=PLN.under,d0=PLN.draw;
 PLN.under=function(c,ox,oy,dt){if(S.on)try{under(c,ox,oy)}catch(e){fail(e)}const r=u0.call(this,c,ox,oy,dt);if(S.on&&!SAVED){SAVED=planes;planes=[]}return r};
 PLN.draw=function(c,ox,oy,dt){restorePlanes();if(!S.on)return d0.call(this,c,ox,oy,dt);try{drawAir(c,ox,oy)}catch(e){fail(e)}
  /* clarões do cano no lugar do sprite (desvio de correção de rota + balanço) */
  shifted.length=0;for(const p of planes){const vp=VPS.get(p);if(vp){const dx=vp.ox,dy=vp.oy+vp.bob/Z;p.x+=dx;p.y+=dy;shifted.push(p,dx,dy)}}
  try{return d0.call(this,c,ox,oy,dt)}finally{for(let i=0;i<shifted.length;i+=3){shifted[i].x-=shifted[i+1];shifted[i].y-=shifted[i+2]}shifted.length=0}}}
if(window.WW1A){const u0=WW1A.under,o0=WW1A.over;
 WW1A.under=function(c,ox,oy,dt){const r=u0.call(this,c,ox,oy,dt);if(S.on)try{groundLayer(c,ox,oy)}catch(e){fail(e)}return r};
 WW1A.over=function(c,ox,oy,dt){if(!S.on)return o0.call(this,c,ox,oy,dt);
  /* esconde os sprites antigos do aviation.js e do frontline.js (a lógica deles continua igual) */
  const A=AIRp(),F=PXFLp(),a=A.splice(0),f=F.splice(0);try{return o0.call(this,c,ox,oy,dt)}finally{A.push(...a);F.push(...f);try{indicators(c,ox,oy)}catch(e){fail(e)}}}}
function shutdown(){restorePlanes();/* quedas em andamento: o dano não se perde */for(const c of CR)try{window.explode(clamp(c.x,20,W-20),clamp(c.y,20,H-20),c.T.R,c.T.PW,c.by)}catch{}CR=[];if(VO)for(const v of VO)try{v.g.gain.value=0}catch{}}

/* ---------- API ---------- */
P.crash=function(p,by,cause){if(!S.on||!p)return false;try{if(TAKEN.has(p))return true;
 const src=p.role?'a':p.st!==undefined&&p.alt!==undefined?'f':'g';
 if(src==='g'){p.downed=true;if(p.kind==='bomber'&&typeof shells!=='undefined')shells=shells.filter(s=>!(s.bomb&&s.bomb.team===p.team&&Math.abs(s.bomb.ry-p.y)<70&&s.t>s.bomb.fall));planes=planes.filter(q=>q!==p);if(SAVED)SAVED=SAVED.filter(q=>q!==p)}
 else if(src==='a')p.dead=true;else{p.dead=true;p.hp=0;p.st='down'}
 startCrash(p,src,by,cause||'');return true}catch(e){fail(e);return false}};
const st0=typeof P.state==='function'?P.state:null;
S.state=()=>({on:S.on,flying:[...VPS.values()].map(v=>({type:v.type,src:v.src,team:v.team,x:v.x|0,y:v.y|0,alt:+v.alt.toFixed(2),bank:Math.round(v.bank),pitch:Math.round(v.pitch),hd:+v.hd.toFixed(2)})),
 crashes:CR.map(c=>({type:c.type,mode:c.mode,burn:c.burn,h:+c.h.toFixed(2),t:+c.t.toFixed(1),bail:c.bail.length})),wrecks:WR.map(w=>({type:w.type,t:Math.round(w.t),fire:+wFire(w).toFixed(2)})),
 chutes:CH.length,frags:FG.length,puffs:PU.length,sprites:SPR.size,drawMs:+(S.drawMs||0).toFixed(3),drawNetMs:+(S.drawNet||0).toFixed(3),buildMsTotal:Math.round(S.buildMs||0),stats:{...S.stats}});
P.state=function(){const b=st0?st0.apply(this,arguments):{};try{b.anim=S.state()}catch{}return b};
S.sprite=sprite;S.models=Object.keys(MODELS);S.TY=TY;S.build=build;S.list=()=>({vps:VPS,crashes:CR,wrecks:WR,chutes:CH});
if(window.IronFront)window.IronFront.animAir=S;
})();
