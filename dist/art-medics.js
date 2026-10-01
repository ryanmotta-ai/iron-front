'use strict';
/* Iron Front 1.6 — arte do hospital de campanha, do posto de socorro, dos padioleiros e dos feridos (art-medics.js).
   Carrega DEPOIS de medics.js: liga PXMED.customDraw e assume todo o desenho do socorro. Não mexe na simulação, exceto
   pôr o ferido internado sobre o catre em que é desenhado (u.x/u.y enquanto u.inBed), para o jogo bater com a tela.
   Hospital de campanha .. o posto livre de cada lado (sem p.seg): enfermaria e tenda de cirurgia (marquises de lona com cruz
                           no telhado; mesa de operação iluminada pela lâmpada), fila de catres na triagem, banco dos padioleiros,
                           ambulância na estrada, caixas da Cruz Vermelha, caldeira com vapor, varal de ataduras, sacos de
                           areia contra estilhaços, lona com cruz para os aviões, bandeira da Cruz Vermelha; médico de jaleco,
                           duas enfermeiras (vestido cinza-azulado, avental e véu) e um servente animados.
   Posto de socorro ..... o construído (p.seg): tenda pequena, 3 catres, banco, sacos de areia e um enfermeiro; as 3 etapas
                           da obra (estacas e fita, armação de varas, lona subindo) substituem PXSAP.cfg.KIND.aid.sprite.
   Padioleiros .......... dupla de bata clara com cruz vermelha no peito, nas costas e no capacete (Brodie / Stahlhelm),
                           calça da nação; 4 vistas (lado, frente, costas) × 4 quadros de passo; 'go' = maca enrolada no ombro
                           dos dois, 'load' = ajoelhados → ferido na maca → erguem, 'carry' = maca com o ferido entre eles,
                           'idle' = sentados no banco / de pé fumando. 'dead' = nada.
   Feridos .............. deitados com o uniforme da nação, atadura e mancha de sangue discreta, acenam de vez em quando;
                           cruz piscando (só do seu lado) = precisa de socorro, cruz fixa com seta = padioleiros a caminho.
   Tudo em pixels inteiros, luz do canto superior esquerdo, contorno seletivo; sprites em cache; ~20 drawImage por posto.
   PXMEDART.state() · ?socorro=0 desliga junto com medics.js. */
(function(){
if(!window.PX||!window.PXMED||!PX.WW1||!PX.WW1.kit||!PX.TEAM)return;
const M=PXMED,Z=PX.Z||.5,K=PX.WW1.kit,SPR=PX.WW1.SPR||{},{mk,g2,outlined,fromGrid,flipX,TEAM}=PX,{R,dot,ell,line,spr,put,C}=K;
const LOAD=(M.cfg&&M.cfg.LOAD)||2,TAU=Math.PI*2;
const ART=window.PXMEDART={on:true,errors:0,version:'1.6'};
let errs=0;
function fail(e){ART.errors++;if(++errs<=3)console.error('art-medics.js:',e);if(errs>=12&&ART.on){ART.on=false;M.customDraw=false;console.error('art-medics.js desligado após erros repetidos (volta o desenho simples do medics.js)')}}
const CACHE=new Map(),cached=(k,f)=>{let v=CACHE.get(k);if(!v){v=f();CACHE.set(k,v)}return v};
const hh=(x,y,s)=>((((x*73856093)^(y*19349663)^(s*83492791))>>>0)%1000)/1000;            // ruído fixo por pixel
const BAY=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];const bay=(x,y)=>(BAY[(y&3)*4+(x&3)]+.5)/16; // pontilhado ordenado 4×4
const RED='#b8302a',REDH='#d8524a',WHT='#f1eee2',WOOD=C.wood,TC=C.canvas;
function rot90(src){const c=mk(src.height,src.width),x=g2(c);x.translate(src.height,0);x.rotate(Math.PI/2);x.drawImage(src,0,0);return c}
function flipY(src){const c=mk(src.width,src.height),x=g2(c);x.translate(0,src.height);x.scale(1,-1);x.drawImage(src,0,0);return c}
const face=t=>t?-1:1;
const seen=(x,y,m)=>x>-m&&y>-m&&x<vw+m&&y<vh+m;
const tm=()=>{try{return typeof time==='number'?time:0}catch{return 0}};
const pt=()=>{try{return typeof playerTeam==='number'?playerTeam:0}catch{return 0}};

/* ======================================================================================
   GENTE: padioleiros, médico, enfermeiras, servente (grades 9×14 no estilo da infantaria de art.js)
   ====================================================================================== */
const HEADB={0:{F:['..hwxwh..','.hHxxxhh.','hHhwxwhhh','.vvvvvvv.','..SsssS..','...sss...'],B:['..hwxwh..','.hHxxxhh.','hHhwxwhhh','.vvvvvvv.','..SSSSS..','...SsS...'],S:['..hhxhh..','.hHxxxhh.','hHhhxhhhh','.vvvvvvv.','...SSsss.','....ssS..']},
 1:{F:['...wxw...','..hxxxh..','.hHwxwhh.','hhhhhhhhh','.hSsssSh.','...sss...'],B:['...wxw...','..hxxxh..','.hHwxwhh.','hhhhhhhhh','.hhhhhhh.','...SsS...'],S:['..hhxh...','.hHxxxh..','.hhhxhhh.','.hhhhhhhh','.hhSSsss.','..hhssS..']}};
const HEADO={F:['...www...','..wwwww..','..nnnnn..','..SsssS..','..sssss..','...sss...'],B:['...www...','..wwwww..','..nnnnn..','..nnnnn..','..SnnnS..','...sss...'],S:['..www....','.wwwww...','.nnnnnn..','..nnSss..','...ssss..','....ss...']};
const SMOCK={F:['UuuuxuuuU','tuuxxxuuU','UuuuxuuuU','sUuuuuuUs'],B:['UPuuxuuuU','UuuxxxuuU','UuuuxuuuU','sUuuuuuUs'],S:['..UuuuU..','..UxuuU..','.PUuuuU..','.PUuuuUs.']};
const LEGF=[['.kkK.Kkk.','.kkK.Kkk.','.bbb.bbb.','.........'],['.kkK.Kkk.','.kkK..Kk.','.kkK..bb.','.bbb.....'],['.kkK.Kkk.','.Kkk.Kk..','.Kkk.bb..','.....bbb.']];
const LEGS=[['..kkK....','..kkK....','..bbb....','.........'],['..kkK....','.kkK.Kk..','.kk..Kk..','.bb..bb..'],['..kKk....','..KkK....','..kk.K...','..bb.bb..']];
const legsFor=(t,L)=>L.map(fr=>fr.map((r,i)=>i===1?(t===0?r.replace(/[kK]/g,m=>m==='k'?'K':'k'):r.replace(/[kK]/g,'b')):r));
const KNEEL=['..kkkkkk.','.bkK...k.','.......bb'],SIT=['.kKk.kKk.','.kk...kk.','.bb...bb.'];
const DOC={F:['...nnn...','..nNNnn..','..nnnnn..','..SsssS..','..sssss..','...sss...','CccgcgccC','CcccgcccC','CcccccccC','sCcccccCs','.CcccccC.','.CcC.CcC.'],
 B:['...nnn...','..nnnnn..','..nNnnn..','..nnnnn..','..SnnnS..','...sss...','CcccccccC','CcccccccC','CccCCCccC','sCcccccCs','.CcccccC.','.CcC.CcC.'],
 S:['..nnnn...','.nnNnnn..','.nnnnnn..','..nnSss..','...ssss..','....ss...','..CcccC..','..CcgcC..','..CcccC..','..CcccCs.','..CcccC..','.CccccC..']};
const NUR={F:['..wwwww..','.wwwwwwW.','.wSsssSW.','.wsssssW.','.WWsssWW.','.WW.s.WW.','DaaaxaaaD','daaxxxaad','DaaaxaaaD','sdaaaaads','.Daaaaad.','.Ddaaadd.','.DdddddD.'],
 B:['..wwwww..','.wwwwwwW.','.wwwwwwW.','.wwwwwwW.','.WwwwwwW.','.WWwwwWW.','DdadddadD','dddadaddd','DdddadddD','sddaaadds','.DdddddD.','.DdddddD.','.DdddddD.'],
 S:['..wwww...','.wwwwww..','wwwwSss..','wwwwsss..','WwW.ss...','WW..s....','..dddaa..','..dddax..','..dddaa..','..dddaas.','..Dddaa..','.Ddddaa..','.DddddA..']};
const SHOE={F:[['..e...e..'],['.e....e..'],['..e....e.']],S:[['..e.e....'],['.e...e...'],['...ee....']]};
function medPal(t){const T=TEAM[t];return{h:T.h,H:T.H,v:T.v,s:T.s,S:T.S,k:T.k,K:T.K,b:T.b,t:T.t,u:t?'#cfd1c6':'#d9d2b9',U:t?'#9da094':'#aba489',x:RED,w:WHT,P:'#6b5436',n:'#4a3524'}}
const DOCP={n:'#4a3524',N:'#6b4a30',s:'#dcb690',S:'#ad8763',c:'#eceade',C:'#b8b6aa',g:'#3a3d40',k:'#3b3a36',K:'#2c2b28',b:'#1f1c18'};
const NURP=t=>({w:WHT,W:'#c4c0b0',s:'#e2bd98',S:'#b48d68',d:t?'#5f6e84':'#6d7f99',D:t?'#46536a':'#4f5f77',a:'#ecebe2',A:'#bdbbb0',x:RED,e:'#2a2622'});
const shiftRow=(r,dx)=>dx>0?'.'.repeat(dx)+r.slice(0,r.length-dx):r;
/* corpo: kind 'bearer'|'orderly'|'doctor'|'nurse'; view F/B/S/L (L = perfil para a esquerda); pose walk|kneel|sit|bend; fr 0..2 */
function person(kind,team,view,pose,fr){return cached(`p${kind}${team}${view}${pose}${fr}`,()=>{const v=view==='L'?'S':view;let rows,pal;
 if(kind==='doctor'){pal=DOCP;const L=v==='S'?LEGS:LEGF;rows=DOC[v].concat([L[fr][1],L[fr][2]].map(r=>r))}
 else if(kind==='nurse'){pal=NURP(team);rows=NUR[v].concat(SHOE[v==='S'?'S':'F'][fr])}
 else{pal=medPal(team);const head=kind==='orderly'?HEADO[v]:HEADB[team][v],legs=legsFor(team,v==='S'?LEGS:LEGF)[fr];
  rows=head.concat(SMOCK[v],pose==='kneel'?KNEEL:pose==='sit'?SIT:legs)}
 if(pose==='bend'||pose==='kneel'){/* curvado: cabeça desce 1 linha e avança 1 coluna (perfil) por cima do tronco */
  const head=rows.slice(0,6),body=rows.slice(6),dx=v==='S'?1:0,c=mk(9,rows.length),x=g2(c);x.drawImage(fromGrid(body,pal),0,6);x.drawImage(fromGrid(head.map(r=>shiftRow(r,dx)),pal),0,1);
  if(v==='S'){x.fillStyle=pal.s;x.fillRect(7,pose==='kneel'?11:10,1,1);x.fillRect(8,pose==='kneel'?11:11,1,1)}
  const o=outlined(view==='L'?flipX(c):c);return{c:o,ax:5,ay:o.height-1}}
 const c=fromGrid(rows,pal),o=outlined(view==='L'?flipX(c):c);return{c:o,ax:5,ay:o.height-1}})}
const blitP=(c,sp,x,y)=>c.drawImage(sp.c,x-sp.ax,y-sp.ay);
/* sentado de frente (paciente de braço na tipoia, decoração) */
const SITTER=['...www...','..wwxww..','..nnnnn..','..SsssS..','..sssss..','...sss...','UuuuuuwuU','uuuuuwwuu','UuuuwwwuU','suuuuuuUs','.kKk.kKk.','.kk...kk.','.bb...bb.'];

/* ======================================================================================
   FERIDOS: deitado visto de cima (cabeça à esquerda, 13×5), atadura por variante, cobertor na maca/catre
   ====================================================================================== */
const LIE=['...UuuuS.....','nssuuuuukkkKb','nssuuuuuKKKKb','nsSUuuuukkkKb','...UUUUS.....'];
function lieRows(v,blanket){const g=LIE.map(r=>r.split('')),set=(y,x,ch)=>{if(g[y]&&x>=0&&x<13)g[y][x]=ch};
 if(v===0){set(1,4,'w');set(1,5,'w');set(2,4,'w');set(2,5,'x');set(3,4,'W');set(3,5,'W')}            // atadura no peito
 else if(v===1){set(1,0,'w');set(2,0,'w');set(3,0,'W');set(1,1,'w');set(2,1,'x')}                       // cabeça enfaixada
 else{set(1,9,'w');set(1,10,'x');set(2,9,'W');set(4,4,'w');set(4,5,'w')}                                   // perna e braço
 if(blanket)for(let y=0;y<5;y++)for(let x=6;x<13;x++)set(y,x,x===6?'G':x===10&&y%2?'G':y===0?'g':'h');
 return g.map(r=>r.join(''))}
const lipPal=t=>{const T=TEAM[t];return{n:'#3b2b1e',s:T.s,S:T.S,u:T.u,U:T.U,k:T.k,K:T.K,b:T.b,w:WHT,W:'#c9c5b4',x:'#9a2622',g:'#8f8870',h:'#77705a',G:'#57513f'}};
const lieCanvas=(t,v,bl)=>cached(`lie${t}${v}${bl}`,()=>fromGrid(lieRows(v,bl),lipPal(t)));
const lieV=(t,v)=>cached(`lieV${t}${v}`,()=>rot90(lieCanvas(t,v,1)));                                     // cabeça para cima (catre / maca N-S)
/* caído no chão: capacete ao lado da cabeça, fuzil ao lado; quadro 1 = braço erguido pedindo socorro */
function groundSpr(t,v,fr,fl){return cached(`gw${t}${v}${fr}${fl}`,()=>{const c=mk(18,10),x=g2(c),T=TEAM[t];
 x.fillStyle='#5d645a';x.fillRect(4,9,11,1);x.fillStyle=t?'#7a4a2c':'#8a6238';x.fillRect(1,9,4,1);x.fillRect(12,9,2,1);    // fuzil
 x.drawImage(lieCanvas(t,v,0),4,3);
 x.fillStyle=T.h;x.fillRect(0,4,3,2);x.fillStyle=T.H;x.fillRect(0,4,1,1);x.fillStyle=T.v;x.fillRect(1,6,2,1);               // capacete caído
 if(fr){x.clearRect(7,3,4,1);x.fillStyle=T.U;x.fillRect(7,3,1,1);x.fillStyle=T.u;x.fillRect(8,2,1,1);x.fillRect(8,1,1,1);x.fillStyle=T.s;x.fillRect(8,0,1,1)}
 const o=outlined(fl?flipX(c):c,.6);return{c:o,ax:10,ay:6}})}

/* ======================================================================================
   MACAS
   ====================================================================================== */
/* lateral (L-O): 28×8 — vara de trás, lona, ferido sob cobertor (cabeça para a esquerda = para trás), vara da frente, pés */
function stretcherH(t,v,empty,fl){return cached(`stH${t}${v}${empty}${fl}`,()=>{const c=mk(28,8),x=g2(c);
 R(x,1,2,26,1,WOOD[2]);dot(x,0,2,WOOD[0]);dot(x,27,2,WOOD[0]);
 R(x,6,3,16,1,'#a39b7c');R(x,6,4,16,1,'#8b8468');R(x,6,5,16,1,'#6f6a52');R(x,6,3,1,3,WOOD[1]);R(x,21,3,1,3,WOOD[1]);
 if(!empty)x.drawImage(lieCanvas(t,v,1),8,1);
 R(x,0,6,28,1,WOOD[1]);R(x,0,6,3,1,WOOD[0]);R(x,25,6,3,1,WOOD[0]);dot(x,7,7,WOOD[0]);dot(x,20,7,WOOD[0]);
 const o=outlined(fl?flipX(c):c,.55);return{c:o,ax:15,ay:5}})}
/* longitudinal (N-S): 9×20 — cabeça para o norte; sobe = virada */
function stretcherV(t,v,empty,up){return cached(`stV${t}${v}${empty}${up}`,()=>{const c=mk(9,20),x=g2(c);
 R(x,1,0,1,20,WOOD[2]);R(x,7,0,1,20,WOOD[1]);dot(x,1,0,WOOD[0]);dot(x,7,19,WOOD[0]);
 R(x,2,3,5,13,'#8b8468');R(x,2,3,5,1,'#a39b7c');R(x,1,3,7,1,WOOD[1]);R(x,1,16,7,1,WOOD[1]);
 if(!empty)x.drawImage(lieV(t,v),2,3);
 const o=outlined(up?flipY(c):c,.55);return{c:o,ax:5,ay:10}})}
/* enrolada no ombro (ida) */
const rolledH=()=>cached('rolH',()=>{const c=mk(18,2),x=g2(c);R(x,0,0,18,1,'#a39b7c');R(x,0,1,18,1,'#6f6a52');R(x,0,0,2,2,WOOD[1]);R(x,16,0,2,2,WOOD[1]);return{c:outlined(c,.55),ax:9,ay:1}});
const rolledV=()=>cached('rolV',()=>{const c=mk(2,13),x=g2(c);R(x,0,0,1,13,'#a39b7c');R(x,1,0,1,13,'#6f6a52');R(x,0,0,2,2,WOOD[1]);R(x,0,11,2,2,WOOD[1]);return{c:outlined(c,.55),ax:1,ay:6}});

/* ======================================================================================
   OBJETOS DO HOSPITAL (kit de ww1-spr: contorno seletivo + sombra)
   ====================================================================================== */
const pick2=(X,y,a,b)=>((X+y)&1)?a:b;
/* marquise de lona: telhado de 4 águas visto em 3/4, cruz vermelha, parede frontal com porta; pad = folga para cordas */
function tentDraw(x,W,Hh,o){const p=3,w=W-p*2,ins=o.ins,rb=o.rb,wb=Hh-3,X0=p,ox=X=>X+p;
 for(let y=2;y<=rb;y++){const k=(y-2)/(rb-2),hip=Math.round(ins*(1-k)),fx0=1+ins,fx1=w-2-ins;
  for(let X=1+hip;X<=w-2-hip;X++){let col;
   if(X<fx0)col=pick2(X,y,TC[3],TC[2]);else if(X>fx1)col=k>.5?TC[0]:pick2(X,y,TC[1],TC[0]);
   else col=k<.18?TC[3]:k<.4?pick2(X,y,TC[3],TC[2]):k<.66?TC[2]:k<.85?pick2(X,y,TC[2],TC[1]):TC[1];
   if(X>=fx0&&X<=fx1&&(X-fx0)%6===5&&y>3)col=K.mix(col,TC[0],.35);
   dot(x,ox(X),y,col)}}
 R(x,ox(1+ins),2,w-2-2*ins,1,'#f2ecd8');R(x,ox(1+ins),1,1,1,WOOD[1]);R(x,ox(w-2-ins),1,1,1,WOOD[1]);                    // cumeeira e pontas da vara
 for(let X=1;X<=w-2;X++){dot(x,ox(X),rb+1,X%3===0?TC[1]:TC[2]);dot(x,ox(X),rb+2,'#5e5944')}                              // sanefa recortada e sombra do beiral
 for(let y=rb+3;y<=wb;y++)for(let X=1;X<=w-2;X++){let col=X<3?TC[2]:X>w-4?TC[0]:TC[1];if(X%8===4)col='#8d8468';if(y===wb)col=K.mix(col,'#3a3528',.4);dot(x,ox(X),y,col)}
 R(x,ox(1),wb+1,w-2,1,'#4d4734');for(let X=1;X<w-1;X+=2)dot(x,ox(X),wb+2,'#3a3528');
 if(o.cross){const cw=o.cross,cx=ox(Math.floor(w/2)),cy=Math.round((2+rb)/2)+1,ch=Math.round(cw*.75);
  R(x,cx-cw,cy-ch,cw*2+1,ch*2+1,'#efe9d6');R(x,cx-cw,cy+ch,cw*2+1,1,'#cfc8b0');
  const a=Math.max(1,Math.round(cw*.34));R(x,cx-a,cy-ch+1,a*2+1,ch*2-1,RED);R(x,cx-cw+1,cy-a+1,cw*2-1,a*2-1,RED);R(x,cx-a,cy-ch+1,a*2+1,1,REDH);R(x,cx-cw+1,cy-a+1,cw*2-1,1,REDH)}
 if(o.door){const[d0,d1]=o.door,top=rb+3;R(x,ox(d0),top,d1-d0+1,wb-top+1,'#2b251c');R(x,ox(d0),top,d1-d0+1,1,'#1d1913');
  R(x,ox(d0-1),top-1,d1-d0+3,1,TC[3]);R(x,ox(d0-1),top,d1-d0+3,1,'#8d8468');R(x,ox(d0),top,d1-d0+1,1,TC[2]);            // aba enrolada
  for(let j=0;j<wb-top;j++){dot(x,ox(d0-1),top+1+j,j<3?TC[3]:TC[2]);dot(x,ox(d1+1),top+1+j,j<3?TC[2]:TC[1])}              // abas amarradas
  if(o.inside)o.inside(x,ox(d0),top+1,d1-d0+1,wb-top)}
 if(o.win)for(const wx of o.win){R(x,ox(wx),rb+4,4,2,'#55636a');dot(x,ox(wx),rb+4,'#8fa3aa');R(x,ox(wx),rb+6,4,1,'#8d8468')}
 for(const s of[-1,1]){const ex=s<0?ox(1):ox(w-2),gx=s<0?0:W-1;line(x,ex,rb,gx,Hh-2,'#6b6450');line(x,s<0?ox(1+ins):ox(w-2-ins),3,s<0?1:W-2,Hh-4,'#6b6450');dot(x,gx,Hh-1,WOOD[0]);dot(x,s<0?1:W-2,Hh-3,WOOD[0])}}
/* catres vistos de frente dentro da tenda */
function cotFront(x,X,Y,w,team,v){R(x,X,Y+1,w,2,'#9a937a');R(x,X,Y+1,w,1,'#b9b29a');R(x,X,Y,2,1,'#e6e1d0');dot(x,X+1,Y,'#dcb690');if(v)dot(x,X+3,Y+1,WHT);R(x,X,Y+3,1,1,'#2e2a22');R(x,X+w-1,Y+3,1,1,'#2e2a22')}
const wardTent=()=>spr('med:ward',56,36,(x,W,Hh)=>tentDraw(x,W,Hh,{ins:5,rb:19,cross:6,door:[17,31],win:[5,38],inside:(x,X,Y,w,h)=>{
 R(x,X,Y,w,2,'#3a3226');R(x,X,Y+2,w,h-2,'#2b251c');cotFront(x,X+1,Y+3,6,0,1);cotFront(x,X+w-7,Y+3,6,0,0);
 R(x,X+7,Y,1,3,'#4a4f55');dot(x,X+7,Y+2,'#f0c860');dot(x,X+6,Y+3,'#6a5530');dot(x,X+8,Y+3,'#6a5530');                     // lampião pendurado
 R(x,X+9,Y+1,2,1,WHT);R(x,X+9,Y+2,2,3,'#6d7f99');R(x,X+9,Y+2,2,1,'#ecebe2')}}),{ax:28,ay:34,sh:[3,3]});                // enfermeira lá dentro
const surgTent=()=>spr('med:surg',44,32,(x,W,Hh)=>tentDraw(x,W,Hh,{ins:4,rb:15,cross:4,door:[4,33],inside:(x,X,Y,w,h)=>{
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){const d=Math.hypot(i-w/2,(j-1)*1.8)/(w/2);x.fillStyle=d<.35?'#8a7350':d<.6?pick2(i,j,'#8a7350','#6a5a40'):d<.85?'#5a4a34':'#3a3226';x.fillRect(X+i,Y+j,1,1)}
 const tx=X+Math.floor(w/2)-5,ty=Y+h-5;R(x,tx,ty,11,3,'#ece8da');R(x,tx,ty,11,1,'#fffaf0');R(x,tx,ty+3,1,2,'#3a3d40');R(x,tx+10,ty+3,1,2,'#3a3d40');  // mesa de operação
 dot(x,tx+1,ty,'#dcb690');R(x,tx+2,ty,5,1,'#cbd0c4');R(x,tx+7,ty,3,1,'#8f8870');dot(x,tx+5,ty+1,'#b8302a');                                     // paciente sob o lençol
 R(x,tx+13,ty+1,4,1,'#8f969a');dot(x,tx+14,ty+1,'#dfe6ea');R(x,tx+13,ty+2,1,3,'#3a3d40');R(x,tx+16,ty+2,1,3,'#3a3d40');                         // bandeja de instrumentos
 R(x,X+2,Y+h-6,2,1,WHT);R(x,X+2,Y+h-5,2,4,'#6d7f99');R(x,X+2,Y+h-5,2,2,'#ecebe2');                                                               // enfermeira instrumentadora
 R(x,X+w-4,Y+h-4,3,4,'#4a5056');R(x,X+w-4,Y+h-4,3,1,'#7d858c')}}),{ax:22,ay:30,sh:[3,3]});                                                      // bacia/estufa
const aidTent=()=>spr('med:aidt',36,24,(x,W,Hh)=>tentDraw(x,W,Hh,{ins:3,rb:11,cross:3,door:[11,19],inside:(x,X,Y,w,h)=>{R(x,X,Y,w,h,'#2b251c');cotFront(x,X+1,Y+h-4,6,0,1);dot(x,X+w-2,Y,'#f0c860')}}),{ax:18,ay:22,sh:[2,2]});
/* catre vertical (cabeça ao norte) */
const cot=()=>spr('med:cot',7,15,(x)=>{R(x,0,0,7,15,'#3f4440');R(x,1,1,5,13,'#a39a78');R(x,1,1,1,13,'#b9b08e');R(x,1,1,5,3,'#e6e1d0');R(x,1,1,5,1,'#f4f0e2');R(x,0,15-1,7,1,'#2b2f2b')},{ax:3,ay:7,sh:[1,1],sa:.25});
const bench=()=>spr('med:bench',15,4,(x)=>{R(x,0,0,15,2,WOOD[2]);R(x,0,0,15,1,WOOD[3]);R(x,1,2,1,2,WOOD[0]);R(x,13,2,1,2,WOOD[0]);R(x,0,1,15,1,WOOD[1])},{ax:7,ay:3,sh:[1,1],sa:.25});
const medCrate=k=>spr('med:crate'+k,9,8,(x)=>{const b=k?'#6f5a3a':'#7a5f3c';R(x,0,0,9,8,b);R(x,0,0,9,1,WOOD[3]);R(x,0,0,1,8,WOOD[3]);R(x,8,1,1,7,WOOD[0]);R(x,0,7,9,1,WOOD[0]);
 R(x,2,1,5,5,'#e8e2cf');R(x,4,2,1,3,RED);R(x,3,3,3,1,RED)},{ax:4,ay:7,sh:[2,1]});
function crates(){return spr('med:crates',22,18,(x)=>{const one=(X,Y,k)=>x.drawImage(medCrate(k).c,X,Y);one(0,7,0);one(9,8,1);one(4,0,1);x.fillStyle='#6b5436';x.fillRect(15,4,6,4);x.fillStyle='#86683f';x.fillRect(15,4,6,1);x.fillStyle=WHT;x.fillRect(17,5,2,2)},{out:0,ax:11,ay:17,sh:[2,2]})}
const boiler=()=>spr('med:boil',12,16,(x)=>{R(x,1,13,2,3,'#2b2f33');R(x,8,13,2,3,'#2b2f33');R(x,1,4,9,10,'#4a5056');R(x,1,4,3,10,'#6b7278');R(x,2,4,1,10,'#8a9198');R(x,9,5,1,9,'#2f3338');
 ell(x,5,4,4,1,'#7d858c');dot(x,4,3,'#aab1b6');R(x,4,9,3,3,'#1c1a18');R(x,8,0,2,4,'#2f3338');R(x,8,0,2,1,'#5d646b');R(x,10,8,2,1,'#b8923a');dot(x,11,9,'#b8923a')},{ax:5,ay:15,sh:[2,2]});
const sandH=n=>spr('med:sbh'+n,n*5+3,7,(x)=>{for(let r=0;r<2;r++)for(let k=0;k<n;k++){const X=k*5+(r?2:0),Y=r?0:3;if(X+5>n*5+3)continue;R(x,X,Y,5,3,r?'#ab9a70':'#b9a97e');R(x,X,Y,5,1,'#d0c296');R(x,X,Y+2,5,1,'#7d6e4c');dot(x,X+4,Y+1,'#8f7f5a')}},{ax:(n*5+3)>>1,ay:5,sh:[2,1]});
const sandV=n=>spr('med:sbv'+n,8,n*3+4,(x)=>{for(let k=0;k<n;k++){const Y=k*3,X=k&1;R(x,X,Y,6,4,k&1?'#ab9a70':'#b9a97e');R(x,X,Y,6,1,'#d0c296');R(x,X,Y+3,6,1,'#7d6e4c');R(x,X+5,Y+1,1,2,'#8f7f5a')}},{ax:4,ay:n*3+2,sh:[2,1]});
const marker=()=>spr('med:mark',26,15,(x)=>{for(let y=0;y<15;y++)for(let X=0;X<26;X++){const e=X<1||X>24||y<1||y>13;x.fillStyle=e?'#c9c3ae':hh(X,y,5)<.08?'#cfc9b4':'#ebe7d8';x.fillRect(X,y,1,1)}
 R(x,10,1,6,13,RED);R(x,4,5,18,5,RED);R(x,10,1,6,1,REDH);R(x,4,5,6,1,REDH);R(x,16,5,6,1,REDH);for(const[a,b]of[[0,0],[25,0],[0,14],[25,14]])dot(x,a,b,WOOD[0])},{ax:13,ay:7,sh:[1,1],sa:.15});
const duckV=n=>spr('med:dkv'+n,6,n*2+1,(x)=>{R(x,0,0,1,n*2+1,'#4a3826');R(x,5,0,1,n*2+1,'#4a3826');for(let k=0;k<n;k++){R(x,0,k*2,6,1,k%3?'#7d6340':'#8a7048');dot(x,1,k*2,'#a3875a')}},{out:0,ax:3,ay:n*2,sh:[0,0],sa:0});
const duckH=n=>spr('med:dkh'+n,n*2+1,5,(x)=>{R(x,0,0,n*2+1,1,'#4a3826');R(x,0,4,n*2+1,1,'#4a3826');for(let k=0;k<n;k++){R(x,k*2,0,1,5,k%3?'#7d6340':'#8a7048');dot(x,k*2,1,'#a3875a')}},{out:0,ax:n,ay:2,sh:[0,0],sa:0});
const lantern=()=>spr('med:lant',5,12,(x)=>{R(x,2,3,1,9,WOOD[1]);R(x,2,3,1,9,WOOD[1]);dot(x,1,11,WOOD[0]);dot(x,3,11,WOOD[0]);R(x,2,0,3,1,WOOD[1]);R(x,3,1,1,1,'#2b2f33');R(x,3,2,2,3,'#2b2f33');dot(x,3,3,'#f0c860')},{ax:2,ay:11,sh:[2,1]});
const washLine=()=>spr('med:wash',20,12,(x)=>{R(x,0,0,1,12,WOOD[1]);R(x,19,0,1,12,WOOD[1]);for(let X=1;X<19;X++){const y=1+Math.round(Math.sin(X/19*Math.PI)*2);dot(x,X,y,'#8b8468');
  if(X%3===1){R(x,X,y+1,1,3+(X%2),X===10?'#d9b8ae':'#ece8da');dot(x,X,y+1,'#fffaf0')}}},{ax:10,ay:11,sh:[2,1],sa:.2});
const tarp=(w,h)=>spr('med:tarp'+w+'x'+h,w,h,(x)=>{for(let y=0;y<h;y++)for(let X=0;X<w;X++){const e=X===0||y===0||X===w-1||y===h-1;x.fillStyle=e?'#4f4a39':hh(X,y,9)<.12?'#5c5744':'#67614c';x.fillRect(X,y,1,1)}},{out:0,ax:w>>1,ay:h>>1,sh:[0,0],sa:0});
const bin=()=>spr('med:bin',6,7,(x)=>{R(x,0,1,6,6,'#4a5056');R(x,0,1,2,6,'#6b7278');R(x,0,0,6,1,'#7d858c');R(x,1,0,4,1,'#3a2c22');dot(x,2,0,'#e6e1d0');dot(x,3,0,'#9a2622')},{ax:3,ay:6,sh:[1,1]});
const basin=()=>spr('med:basin',5,3,(x)=>{ell(x,2,1,2,1,'#8f969a');dot(x,2,1,'#c8d6da');dot(x,1,0,'#dfe6ea')},{ax:2,ay:2,sh:[1,1],sa:.2});

/* chão batido sob o hospital: união de elipses com borda pontilhada (cobre a grama e a sebe pintadas) */
function ground(x,cx,cy,blobs,seed){const col=['#5d4e37','#67573d','#716046','#54472f'];
 for(const b of blobs){const x0=Math.floor(b[0]-b[2]-1),x1=Math.ceil(b[0]+b[2]+1),y0=Math.floor(b[1]-b[3]-1),y1=Math.ceil(b[1]+b[3]+1);
  for(let y=y0;y<=y1;y++)for(let X=x0;X<=x1;X++){let d=Math.hypot((X-b[0])/b[2],(y-b[1])/b[3]);d+=(hh(X,y,seed)-.5)*.18;if(d>1)continue;
   const px=cx+X,py=cy+y,edge=d>.78;if(edge&&bay(px,py)>(1-d)/.22)continue;const n=hh(X,y,seed+1);
   x.fillStyle=edge?(n<.5?'#56522f':'#5d4e37'):n<.07?'#4d5a31':n<.35?col[0]:n<.7?col[1]:n<.9?col[2]:col[3];x.fillRect(px,py,1,1)}}}

/* ---------- composição (lado Aliado; o Central é espelho em x, sprites iluminados sem espelhar) ---------- */
const FIELD={W:118,H:92,ax:27,ay:50,
 cots:[[-8,18],[0,18],[8,18]],decor:[[16,18,0],[24,18,1],[32,18,2]],rest:[[[-9,8,'sit'],[-3,8,'sit']],[[6,6,'stand'],[11,6,'smoke']]],
 flag:[31,-12],lamps:[[-12,3],[40,6]],boil:[-14,33],surg:[54,-11],ward:[4,-11]};
const AIDL={W:46,H:46,ax:23,ay:23,cots:[[-8,15],[0,15],[8,15]],decor:[],rest:FIELD.rest,flag:[-17,-3],lamps:[],tent:[-1,2]};
function compose(team,L,draw){const c=mk(L.W,L.H),x=g2(c),f=face(team),ax=team?L.W-1-L.ax:L.ax,ay=L.ay,
 P=(sp,dx,dy,o={})=>put(x,sp,ax+f*dx,ay+dy,{flip:o.dir?(team?o.dir<0:o.dir>0):false});draw(x,P,ax,ay,f);return{c,ax,ay}}
function drawField(x,P,ax,ay,f,team){
 ground(x,ax,ay,[[24*f,-28,56,22],[8*f,18,30,20],[54*f,20,34,18],[-14*f,22,13,17],[74*f,-6,16,14]],team+3);
 P(duckV(7),4,-10);P(duckV(6),54,-10);P(duckH(9),40,10);
 P(tarp(46,17),12,18);
 P(wardTent(),FIELD.ward[0],FIELD.ward[1]);P(surgTent(),FIELD.surg[0],FIELD.surg[1]);
 P(sandV(16),86,-6);P(sandV(6),86,26);P(sandH(12),52,38);P(sandH(4),-20,-10);
 P(SPR.ambulance?SPR.ambulance():bench(),72,4,{dir:1});
 P(marker(),56,24);P(washLine(),76,18);
 P(bench(),-6,8);
 if(SPR.stretcher){P(SPR.stretcher(2),-18,4);P(SPR.stretcher(2),-18,8)}
 P(crates(),-16,22);P(medCrate(1),-6,30);P(boiler(),FIELD.boil[0],FIELD.boil[1]);
 if(SPR.barrels)P(SPR.barrels(2),82,-18);P(bin(),30,-4);P(basin(),20,28);
 for(const l of FIELD.lamps)P(lantern(),l[0],l[1]);
 for(const k of FIELD.cots)P(cot(),k[0],k[1]);
 for(const k of FIELD.decor){P(cot(),k[0],k[1]);const cx=ax+f*k[0],cy=ay+k[1];if(k[2]===2){const s=cached('sitter'+team,()=>{const o=outlined(fromGrid(SITTER,lipPal(team)));return{c:o,ax:5,ay:o.height-1}});blitP(x,s,cx,cy+3)}else x.drawImage(lieV(team,k[2]),cx-2,cy-6)}}
function drawAid(x,P,ax,ay,f,team){
 ground(x,ax,ay,[[0,0,20,13],[0,14,15,9]],team+7);
 P(tarp(26,13),0,15);P(aidTent(),AIDL.tent[0],AIDL.tent[1]);P(sandV(8),19,-1);P(sandH(3),-14,-12);
 P(bench(),-6,8);P(medCrate(0),15,10);P(medCrate(1),-17,11);if(SPR.stretcher)P(SPR.stretcher(2),-15,18);
 for(const k of AIDL.cots)P(cot(),k[0],k[1])}
const fieldBase=t=>cached('fieldB'+t,()=>compose(t,FIELD,(x,P,ax,ay,f)=>drawField(x,P,ax,ay,f,t)));
const aidBase=t=>cached('aidB'+t,()=>compose(t,AIDL,(x,P,ax,ay,f)=>drawAid(x,P,ax,ay,f,t)));

/* cirurgia: cirurgião de gorro e máscara atrás da mesa, mãos trabalhando; lâmpada que oscila (3 quadros, sobre a base) */
function surgFrame(k){return cached('surgF'+k,()=>{const c=mk(16,7),x=g2(c);
 R(x,6,0,3,1,'#e8e6dc');R(x,6,1,3,1,'#dcb690');R(x,6,2,3,1,WHT);R(x,5,3,5,4,'#dcdacf');R(x,5,3,1,4,'#f1efe6');R(x,9,4,1,3,'#b8b6aa');                // cirurgião de gorro e máscara
 const hands=[[[4,6],[10,6]],[[4,4],[10,6]],[[5,6],[11,5]]][k];for(const[a,b]of hands)dot(x,a,b,'#e2c6a0');if(k===1)dot(x,3,4,'#c8d0d4');if(k===2)dot(x,12,5,'#c8d0d4');
 dot(x,13,0,'#3a3d40');dot(x,13,1,k===1?'#ffe08a':'#fff2b0');if(k!==1){dot(x,12,1,'#d9b860');dot(x,14,1,'#d9b860');dot(x,13,2,'#b89a58')}           // lampião pendurado
 return c})}

/* ---------- bandeira da Cruz Vermelha (4 quadros, ondula por colunas) ---------- */
function flagFrame(k){return cached('flagF'+k,()=>{const c=mk(16,30),x=g2(c);R(x,0,1,1,29,'#d9d5b7');R(x,1,1,1,29,'#9a9479');R(x,0,0,2,1,'#cdbf7a');R(x,0,29,3,1,'#3a3528');
 for(let col=0;col<13;col++){const ph=Math.sin(k/4*TAU+col*.7),wv=Math.round(ph*Math.min(1,col/6)),top=2+wv,sh=col<1?-.25:ph>.5&&col>2?.12:ph<-.5&&col>2?-.18:0;
  for(let r=0;r<8;r++){let col0=(col>=5&&col<=7)||(r>=3&&r<=4&&col>=1&&col<=11)?RED:'#f2efe4';if(col0===RED&&(r===0||r===7))col0='#f2efe4';x.fillStyle=sh?K.mix(col0,sh>0?'#ffffff':'#000000',Math.abs(sh)):col0;x.fillRect(2+col,top+r,1,1)}
  x.fillStyle='#8d8878';x.fillRect(2+col,top+8,1,1)}
 return c})}
function drawFlag(c,x,y){const sp=flagFrame(((tm()*5)|0)&3);c.drawImage(sp,x,y-29)}

/* ======================================================================================
   ESTADO VISUAL (por posto / por equipe), sem tocar na simulação
   ====================================================================================== */
const VIS=new WeakMap(),STAFF=new WeakMap();
const isField=p=>!p.seg;
const lay=p=>isField(p)?FIELD:AIDL;
/* catre fixo por paciente (o índice em p.beds muda quando alguém sai) */
const COTS=new WeakMap();
function cotsOf(p){const L=lay(p);let A=COTS.get(p);if(!A){A=new Map();COTS.set(p,A)}for(const u of A.keys())if(!p.beds.includes(u))A.delete(u);
 for(const u of p.beds){if(!A.has(u)){const used=new Set(A.values());let i=0;while(used.has(i)&&i<L.cots.length-1)i++;A.set(u,i)}
  const k=L.cots[A.get(u)]||L.cots[0];u.x=p.x+face(p.team)*k[0]/Z;u.y=p.y+k[1]/Z}return A}
function cotScreen(p,i,ox,oy){const L=lay(p),k=L.cots[i]||L.cots[0];return[ox+Math.round(p.x*Z)+face(p.team)*k[0],oy+Math.round(p.y*Z)+k[1]]}

/* direção da caminhada a partir da velocidade (com histerese) */
function dirOf(V,vx,vy){const s=Math.hypot(vx,vy);if(s<2)return V.dir;if(Math.abs(vx)>=Math.abs(vy)*.7)return vx>0?'E':'W';return vy>0?'S':'N'}
const viewOf=d=>d==='E'?'S':d==='W'?'L':d==='N'?'B':'F';
const FR=[0,1,0,2];

/* ======================================================================================
   PADIOLEIROS
   ====================================================================================== */
function crewVis(c,p,dt){let V=VIS.get(c);const now=tm();if(!V){V={x:c.x,y:c.y,px:c.x,py:c.y,offx:0,offy:0,dir:p.team?'W':'E',mv:0,tx:c.x,ty:c.y,seed:(p.id*7+c.i*3)%5};VIS.set(c,V)}
 const ddt=Math.max(dt,1e-3),vx=(c.x-V.px)/ddt,vy=(c.y-V.py)/ddt,sp=Math.hypot(vx,vy);V.px=c.x;V.py=c.y;
 if(sp>4)V.mv=now+.25;const moving=now<V.mv;if(sp>4&&sp<400)V.dir=dirOf(V,vx,vy);
 let tx=c.x,ty=c.y;
 if(c.st==='idle'&&!moving){const r=lay(p).rest[c.i]||lay(p).rest[0],f=face(p.team);tx=p.x+f*((r[0][0]+r[1][0])/2)/Z;ty=p.y+r[0][1]/Z}
 else if(c.st==='load'&&c.u){tx=c.u.x;ty=c.u.y+6/Z}
 if(Math.hypot(tx-V.tx,ty-V.ty)>5){V.offx+=V.tx-tx;V.offy+=V.ty-ty}                       // salto de alvo vira deslize suave
 const k=Math.exp(-dt*9);V.offx*=k;V.offy*=k;V.tx=tx;V.ty=ty;V.x=tx+V.offx;V.y=ty+V.offy;V.moving=moving;return V}
function drawCrew(c,p,ox,oy,dt){if(c.st==='dead')return;const V=crewVis(c,p,dt),x=ox+Math.round(V.x*Z),y=oy+Math.round(V.y*Z);if(!seen(x,y,40))return;
 if(p.team!==pt()&&window.PXW&&PXW.visible&&!PXW.visible({team:p.team,x:V.x,y:V.y}))return;
 const t=p.team,now=tm(),u=c.u,v=u?(u.id%3):0,f=face(t);
 if(c.st==='idle'&&!V.moving){/* descanso no banco do posto */const r=lay(p).rest[c.i]||lay(p).rest[0],bx=ox+Math.round(p.x*Z),by=oy+Math.round(p.y*Z);
  for(let m=0;m<2;m++){const[dx,dy,pose]=r[m],mx=bx+f*dx+Math.round(V.offx*Z),my=by+dy+Math.round(V.offy*Z);
   if(pose==='sit')blitP(c_,person('bearer',t,'F','sit',0),mx,my);
   else{const sp=person('bearer',t,pose==='smoke'?(t?'L':'S'):'F','walk',0);blitP(c_,sp,mx,my);
    if(pose==='smoke'){const ph=(now*.7+c.i)%3;const hx=mx+(t?-3:3),hy=my-9;c_.fillStyle=ph<.4?'#ffb347':'#c0602a';c_.fillRect(hx,hy,1,1);if(ph>.6&&ph<2.4){c_.globalAlpha=.6;c_.fillStyle='#c9c6bb';c_.fillRect(hx+(ph>1.5?1:0),hy-1-Math.floor(ph*2),1,1);c_.globalAlpha=1}}}}
  return}
 if(c.st==='load'&&u){/* ajoelhados dos dois lados → ferido na maca → erguem */const k=1-Math.max(0,c.t)/LOAD,gy=y+4,on=k>=.45,lift=k>=.8;
  const sp=stretcherH(t,v,!on,t===1),sy=gy-3-(lift?Math.round((k-.8)/.2*2):0);
  c_.drawImage(sp.c,x-sp.ax,sy-sp.ay);
  const pose=lift?'walk':'kneel';blitP(c_,person('bearer',t,'S',pose,0),x-13,gy+(lift?0:0));blitP(c_,person('bearer',t,'L',pose,0),x+13,gy);return}
 const d=V.dir,fr=V.moving?FR[((now*(c.st==='carry'?6:9))+V.seed)&3|0]:0,fr2=V.moving?FR[((now*(c.st==='carry'?6:9))+V.seed+2)&3|0]:0;
 if(c.st==='carry'&&u){
  if(d==='E'||d==='W'){const sp=stretcherH(t,v,false,d==='W'),gy=y+4;c_.drawImage(sp.c,x-sp.ax,gy-9-sp.ay+4);
   const vw_=viewOf(d);blitP(c_,person('bearer',t,vw_,'walk',fr),x-13,gy);blitP(c_,person('bearer',t,vw_,'walk',fr2),x+13,gy)}
  else{const up=d==='N',sp=stretcherV(t,v,false,up),vw_=viewOf(d);blitP(c_,person('bearer',t,vw_,'walk',fr),x,y-3);c_.drawImage(sp.c,x-sp.ax,y-1-sp.ay);blitP(c_,person('bearer',t,vw_,'walk',fr2),x,y+15)}
  return}
 /* ida (ou volta sem ferido): em fila, maca enrolada no ombro dos dois */
 if(d==='E'||d==='W'){const vw_=viewOf(d),r=rolledH(),gy=y+3;blitP(c_,person('bearer',t,vw_,'walk',fr),x-7,gy);blitP(c_,person('bearer',t,vw_,'walk',fr2),x+7,gy);c_.drawImage(r.c,x-r.ax,gy-8-r.ay)}
 else{const vw_=viewOf(d),r=rolledV();blitP(c_,person('bearer',t,vw_,'walk',fr),x,y-3);c_.drawImage(r.c,x+3-r.ax,y-5-r.ay);blitP(c_,person('bearer',t,vw_,'walk',fr2),x,y+9)}}
let c_=null;   // contexto do quadro atual (evita passar por todas as funções)

/* ======================================================================================
   EQUIPE DO HOSPITAL (só visual): médico, 2 enfermeiras, servente; no posto pequeno, 1 enfermeiro
   ====================================================================================== */
function staffOf(p){let S=STAFF.get(p);if(S)return S;const F=isField(p);
 S=F?[{k:'doctor',x:54,y:-6,role:'doc'},{k:'nurse',x:16,y:29,role:'n1'},{k:'nurse',x:4,y:-8,role:'n2'},{k:'orderly',x:-9,y:36,role:'ord'}]:[{k:'bearer',x:13,y:6,role:'med'}];
 for(const s of S){s.tx=s.x;s.ty=s.y;s.wait=Math.random()*2;s.pose='stand';s.dir='S';s.i=0}STAFF.set(p,s0(S));return S}
const s0=S=>S;
function occupiedCots(p){const L=lay(p),A=COTS.get(p),r=[];if(A)for(const i of A.values())r.push(L.cots[i]);return r}
function nextGoal(s,p){const L=lay(p),occ=occupiedCots(p),all=L.cots.concat(L.decor.map(d=>[d[0],d[1]]));s.i++;
 const atCot=k=>{s.tx=k[0];s.ty=k[1]+(isField(p)?11:9);s.after='bend';s.hold=2.5+Math.random()*2};
 if(s.role==='doc'){if(s.i%2){const k=occ.length?occ[s.i%occ.length]:all[s.i%all.length];atCot(k)}else{s.tx=54;s.ty=-6;s.after='stand';s.hold=3+Math.random()*3}}
 else if(s.role==='n1'){const k=occ.length?occ[s.i%occ.length]:all[(s.i*2)%all.length];atCot(k)}
 else if(s.role==='n2'){const seq=[[4,-8,'stand',2],[24,29,'bend',2.5],[-8,34,'side',2],[32,29,'bend',2.5]],q=seq[s.i%seq.length];s.tx=q[0];s.ty=q[1];s.after=q[2];s.hold=q[3]}
 else if(s.role==='ord'){const seq=[[-9,36,'stoke',4],[-2,24,'stand',2]],q=seq[s.i%seq.length];s.tx=q[0];s.ty=q[1];s.after=q[2];s.hold=q[3]}
 else{if(occ.length){atCot(occ[s.i%occ.length])}else{s.tx=13;s.ty=6;s.after='stand';s.hold=3}}}
function staffTick(S,p,dt){for(const s of S){if(s.wait>0){s.wait-=dt;continue}const dx=s.tx-s.x,dy=s.ty-s.y,d=Math.hypot(dx,dy);
 if(d<.6){if(s.pose==='walk'){s.pose=s.after||'stand';s.wait=s.hold||2;continue}nextGoal(s,p);s.pose='walk';continue}
 const v=Math.min(d,dt*(s.k==='doctor'?13:11));s.x+=dx/d*v;s.y+=dy/d*v;s.pose='walk';s.dir=Math.abs(dx)>=Math.abs(dy)*.7?(dx>0?'E':'W'):(dy>0?'S':'N')}}
function drawStaff(S,p,bx,by){const f=face(p.team),now=tm();
 for(const s of S.slice().sort((a,b)=>a.y-b.y)){const x=bx+f*Math.round(s.x),y=by+Math.round(s.y);let d=s.dir;if(f<0&&(d==='E'||d==='W'))d=d==='E'?'W':'E';
  let view='F',pose='walk',fr=0;
  if(s.pose==='walk'){view=viewOf(d);fr=FR[((now*8)+s.x*.1)&3|0]}
  else if(s.pose==='bend'){view='B';pose=((now*.8+s.x)%3)<1.6?'bend':'walk'}
  else if(s.pose==='stoke'){view=f>0?'L':'S';pose=((now*1.2)%2)<1?'bend':'walk'}
  else if(s.pose==='side'){view=f>0?'L':'S'}
  blitP(c_,person(s.k,p.team,view,pose,fr),x,y);
  if(s.k==='nurse'&&s.role==='n2'&&s.pose==='walk'){c_.drawImage(basin().c,x-3,y-7)}}}

/* ======================================================================================
   DESENHO POR CAMADA
   ====================================================================================== */
function under(c,ox,oy,dt){c_=c;const now=tm();
 for(const p of M.posts){const bx=ox+Math.round(p.x*Z),by=oy+Math.round(p.y*Z);const F=isField(p),A=cotsOf(p);if(!seen(bx,by,F?130:50))continue;
  const B=F?fieldBase(p.team):aidBase(p.team);c.drawImage(B.c,bx-B.ax,by-B.ay);const f=face(p.team);
  if(F){/* cirurgia animada e luzes */const sx=bx+f*FIELD.surg[0],sy=by+FIELD.surg[1];c.drawImage(surgFrame(((now*2.2)|0)%3),sx-7,sy-11);
   const bl=bx+f*FIELD.boil[0],bly=by+FIELD.boil[1];c.fillStyle=((now*7)|0)%3?'#e0772a':'#ffb347';c.fillRect(bl-1,bly-5,2,1);
   for(let i=0;i<3;i++){const ph=(now*.6+i/3)%1,px=bl+f*3+Math.round(Math.sin(ph*6+i)*1+ph*3),py=bly-16-Math.round(ph*10);c.globalAlpha=.55*(1-ph);c.fillStyle='#e4e2da';c.fillRect(px,py,ph>.5?2:1,ph>.5?2:1)}c.globalAlpha=1;
   for(const l of FIELD.lamps){const lx=bx+f*l[0],ly=by+l[1];c.fillStyle=((now*3+l[0])|0)%4?'#f0c860':'#ffe9a0';c.fillRect(lx+(f>0?1:-1),ly-8,1,1)}}
  /* internados nos catres */
  const vis=p.team===pt()||!(window.PXW&&PXW.fow&&PXW.fow.on);
  for(const u of p.beds){if(!vis&&window.PXW&&PXW.visible&&!PXW.visible(u))continue;const[cx,cy]=cotScreen(p,A.get(u)||0,ox,oy),cv=lieV(u.team,u.id%3);c.drawImage(cv,cx-2,cy-6);
   if(((now*.5+u.id*.37)%4)<.5){c.fillStyle=TEAM[u.team].u;c.fillRect(cx+(u.id&1?-3:3),cy-2,1,2);c.fillStyle=TEAM[u.team].s;c.fillRect(cx+(u.id&1?-3:3),cy-3,1,1)}}}}  // um mexe o braço de vez em quando
function over(c,ox,oy,dt){c_=c;const now=tm(),P=pt();
 for(const p of M.posts){const bx=ox+Math.round(p.x*Z),by=oy+Math.round(p.y*Z),F=isField(p),f=face(p.team);
  const S=staffOf(p);staffTick(S,p,Math.min(.1,dt||0));
  if(seen(bx,by,F?130:50)){drawStaff(S,p,bx,by);const L=lay(p);drawFlag(c,bx+f*L.flag[0],by+L.flag[1])}
  for(const k of p.crews)drawCrew(k,p,ox,oy,Math.min(.1,dt||.016))}
 /* marcadores de ferido (só do seu lado) */
 for(const u of units){if(!u.down||u.inBed||u.carried||u.team!==P)continue;const cl=u.claimed;if(cl&&cl.st==='load'&&(1-cl.t/LOAD)>=.45)continue;
  const x=ox+Math.round(u.x*Z),y=oy+Math.round(u.y*Z)-11;if(!seen(x,y,10))continue;
  if(cl){const b=Math.round(Math.sin(now*4)*1);R(c,x-2,y-2+b,5,5,'#1b1f16');R(c,x-1,y-1+b,3,3,WHT);c.fillStyle=RED;c.fillRect(x,y-1+b,1,3);c.fillRect(x-1,y+b,3,1);R(c,x-1,y+4+b,3,1,WHT);dot(c,x,y+5+b,WHT)}
  else{const urg=u.bleed-now<15,blink=((now*(urg?5:2.5))|0)%2;if(!blink)continue;R(c,x-3,y-3,7,7,'#1b1f16');R(c,x-2,y-2,5,5,RED);c.fillStyle=WHT;c.fillRect(x,y-2,1,5);c.fillRect(x-2,y,5,1)}}}

/* ---------- PHYS.draw (externo): caído no chão = sprite deitado; na maca / no catre = desenhado aqui nas camadas ---------- */
const DOWNAT=new WeakMap();
function drawDown(c,u,sx,sy){u.hitT=0;if(u.inBed||u.carried)return true;const cl=u.claimed;if(cl&&cl.st==='load'&&(1-cl.t/LOAD)>=.45)return true;
 const now=tm();let t0=DOWNAT.get(u);if(t0==null){t0=now;DOWNAT.set(u,t0)}const age=Math.min(1,(now-t0)/30),rx=2+Math.round(age*3);
 c.globalAlpha=.55;c.fillStyle='#4e1512';ell(c,sx+(u.id&1?-1:1),sy+5,rx,1+(age>.5?1:0),'#4e1512');c.globalAlpha=.7;dot(c,sx+(u.id&1?-2:2),sy+5,'#7d221c');c.globalAlpha=1;
 const fr=((now*.45+u.id*.31)%3)<.45?1:0,sp=groundSpr(u.team,u.id%3,fr,!!(u.id&2));c.drawImage(sp.c,sx-sp.ax,sy+3-sp.ay);return true}

/* ---------- etapas da obra do posto de socorro (sappers.js desenha centrado em s.x, s.y) ---------- */
function aidStage(s){const st=s.stage|0;if(st>=3)return cached('aid1x1',()=>mk(1,1));
 const fr=Math.max(0,Math.min(1,s.work/(s.need[Math.min(st,s.need.length-1)]||1))),b=Math.min(4,Math.floor(fr*5)),t=s.team|0;
 return cached(`aidS${t}${st}${b}`,()=>{const L=AIDL,c=mk(L.W,L.H),x=g2(c),f=face(t),ax=t?L.W-1-L.ax:L.ax,ay=L.ay,P=(sp,dx,dy)=>put(x,sp,ax+f*dx,ay+dy);
  const tape='#e8e6c8',stake=WOOD[1];
  if(st>=1)ground(x,ax,ay,[[0,0,18,11]],t+11);
  if(st===0){/* fita branca e estacas marcando tenda e catres; chegam caixas e lona dobrada */
   const pts=[];for(let X=-15;X<=13;X+=2){pts.push([X,-12],[X,2])}for(let Y=-12;Y<=2;Y+=2){pts.push([-15,Y],[13,Y])}
   const n=Math.round(pts.length*(.2+.8*b/4));for(let i=0;i<n;i++){const[a,bb]=pts[(i*7)%pts.length];dot(x,ax+f*a,ay+bb,tape)}
   for(const[a,bb]of[[-15,-12],[13,-12],[-15,2],[13,2]]){R(x,ax+f*a,ay+bb-2,1,3,stake);dot(x,ax+f*a,ay+bb-2,WOOD[3])}
   if(b>=1)for(const k of L.cots)for(let j=-6;j<=6;j+=3){dot(x,ax+f*k[0]-3,ay+k[1]+j,tape);dot(x,ax+f*k[0]+3,ay+k[1]+j,tape)}
   if(b>=2)P(medCrate(0),15,10);if(b>=3){R(x,ax+f*-17-5,ay+8,10,4,'#a49b80');R(x,ax+f*-17-5,ay+8,10,1,'#cbc2a4');R(x,ax+f*-17-5,ay+11,10,1,'#7d765e')}return c}
  if(st===1){/* armação: varas de pé e cumeeira; lona ainda dobrada no chão */
   const ridge=-17,k=.4+.6*b/4,x0=-10,x1=Math.round(-10+18*k);R(x,ax+Math.min(f*x0,f*x1),ay+ridge,Math.abs(f*x1-f*x0)+1,1,WOOD[2]);
   for(const a of[-14,-10,-1,8,12]){if(a>x1+4)continue;const top=(a===-14||a===12)?-7:ridge;R(x,ax+f*a,ay+top,1,2-top+1,WOOD[1]);dot(x,ax+f*a,ay+top,WOOD[3])}
   line(x,ax+f*-14,ay-7,ax+f*-10,ay+ridge,WOOD[1]);if(x1>=8)line(x,ax+f*12,ay-7,ax+f*8,ay+ridge,WOOD[1]);
   R(x,ax+f*-17-5,ay+8,10,4,'#a49b80');R(x,ax+f*-17-5,ay+8,10,1,'#cbc2a4');P(medCrate(0),15,10);P(sandH(3),-14,-12);return c}
  /* st 2: a lona sobe — a tenda pronta revelada de baixo para cima conforme o progresso; catres ainda empilhados */
  const T=aidTent(),cut=Math.round(T.c.height*(1-(.3+.7*b/4))),tx=ax+f*AIDL.tent[0]-T.ax,ty=ay+AIDL.tent[1]-T.ay;
  R(x,ax+f*-10,ay-17,1,19,WOOD[1]);R(x,ax+f*8,ay-17,1,19,WOOD[1]);R(x,ax+Math.min(f*-10,f*8),ay-17,19,1,WOOD[2]);
  x.drawImage(T.c,0,cut,T.c.width,T.c.height-cut,tx,ty+cut,T.c.width,T.c.height-cut);
  P(sandV(8),19,-1);P(sandH(3),-14,-12);P(medCrate(0),15,10);for(let i=0;i<3;i++){R(x,ax+f*-2-3,ay+12-i*2,7,2,'#3f4440');R(x,ax+f*-2-2,ay+12-i*2,5,1,'#a39a78')}return c})}

/* ======================================================================================
   LIGAÇÕES
   ====================================================================================== */
M.customDraw=true;
if(window.WW1A){const u0=WW1A.under,o0=WW1A.over;
 WW1A.under=function(c,ox,oy,dt){u0.call(this,c,ox,oy,dt);if(!ART.on||!M.on)return;try{under(c,ox,oy,dt||.016)}catch(e){fail(e)}};
 WW1A.over=function(c,ox,oy,dt){o0.call(this,c,ox,oy,dt);if(!ART.on||!M.on)return;try{over(c,ox,oy,dt||.016)}catch(e){fail(e)}}}
if(window.PHYS){const d0=PHYS.draw||(()=>false);PHYS.draw=function(c,u,sp,sx,sy,vis,bob){if(!ART.on||!M.on||!u.down)return d0.call(PHYS,c,u,sp,sx,sy,vis,bob);
 try{return drawDown(c,u,sx,sy)}catch(e){fail(e);return d0.call(PHYS,c,u,sp,sx,sy,vis,bob)}}}
if(window.PXSAP&&PXSAP.cfg&&PXSAP.cfg.KIND&&PXSAP.cfg.KIND.aid){const k=PXSAP.cfg.KIND.aid,old=k.sprite;k.sprite=s=>{if(!ART.on)return old(s);try{return aidStage(s)}catch(e){fail(e);return old(s)}}}
ART.state=()=>({on:ART.on,errors:ART.errors,posts:M.posts.map(p=>({id:p.id,team:p.team,field:isField(p),beds:p.beds.map(u=>(COTS.get(p)||new Map()).get(u)),crews:p.crews.map(c=>c.st+(VIS.get(c)?':'+VIS.get(c).dir:'')).join('/')}))});
ART.sprites={person,stretcherH,stretcherV,groundSpr,fieldBase,aidBase,aidStage,lieV};
})();
