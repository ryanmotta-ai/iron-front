'use strict';
/* Iron Front 1.9.3 — obras de logística e comunicação (works-logistics.js). Carrega DEPOIS de works.js. Usa o catálogo do
   sappers/fortify (PXSAP.cfg.KIND + PXFORT.KINDS/SHORT/SUB + planExtra): as obras aparecem na aba DEFESAS e os pioneiros as
   constroem em estágios como as outras. Não edita nenhum outro arquivo: tudo entra por wrap de window.* e por PXSAP/PXFORT.
   Passadiço de tábuas .. (linha, ◈8 por trecho de 32 px) quem pisa nele ignora a lama (a célula de lama sob o passadiço vale 0
                          durante o update, então o clima E a física de inércia enxergam chão firme) e perde só metade da lentidão
                          da água rasa. A IA o estende ao longo da estrada de reforço quando chove ou há lama.
   Linha telefônica ..... (linha, ◈5 por trecho de 40 px, postes e fio) cadeia de trechos intactos ligando QG, depósito ou posto de
                          observação (works.js) a uma bateria (battery.js). Pedido de fogo originado em posto de observação,
                          observador ou avião só chega na hora se a fonte estiver ligada a uma bateria; sem linha a ordem é
                          adiada 12 s (corredor a pé) e cai com dispersão ×1,2. Pedido do comando (carta do jogador, IA geral) não
                          muda. Explosão corta trechos (lâmpada vermelha + toast); pioneiros reparam (◈2) — a IA e o jogador.
                          O posto de observação da IA passa a pedir fogo sozinho (3 tiros, a cada 40 s) e depende da linha.
   Cozinha de campanha .. (◈70, 2 estágios, fumaça de chaminé) a até 130 px: coesão +0,02/s, supressão −0,12/s extra, fôlego do
                          jogador +4/s (PXGEAR.st, escrita em runtime pelo objeto exportado) e ferido leve sangra à metade e volta à
                          luta em 25 s. Atende até 16 homens por vez; explode com tiro de obus (260 de vida).
   Posto de franco-atirador (◈60, 2 estágios, aço com fresta) o atirador designado (u.cls==='marksman') que ocupa o posto ganha
                          alcance ×1,3 e 55% menos dano; a IA guarnece com atirador ocioso (nunca na trégua). 320 de vida.
   ?logistica=0 desliga (as obras nem entram no catálogo) · IronFront.worksLogistics.state(). */
(function(){
if(!window.PXSAP||!window.PXFORT||!PXSAP.cfg||!PXSAP.cfg.KIND||!Array.isArray(PXFORT.KINDS))return;
const SAP=PXSAP,K=SAP.cfg.KIND,F=PXFORT,hyp=Math.hypot,Z=(window.PX&&PX.Z)||.5;
const rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>v<a?a:v>b?b:v;
const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('works-logistics.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};
const perf=()=>(typeof performance!=='undefined'?performance.now():Date.now());

const CFG={
 PLANK:{step:32,cost:8,need:[4],hwE:12,hp:70,maxSegs:16,mudMin:.12,rainMin:.25,chunk:4},
 PHONE:{step:40,cost:5,need:[3],linkSeg:18,linkTerm:40,delay:12,spreadK:1.2,obsR:150,fixCost:2,fixNeed:2.5,maxSegs:20,cutPow:60,cutK:.9,fixWait:40},
 KITCHEN:{cost:70,need:[8,16],r:130,coh:.02,supp:.12,stam:4,bleedK:.5,heal:25,cap:16,hp:260},
 SNIPER:{cost:60,need:[8,20],hp:320,rangeK:1.3,dmgK:.45,occR:14,assignR:900},
 OPCALL:{every:40,teamEvery:20,see:520,count:3,spread:65,cluster:4,clusterR:120,safe:90},
 QG:{x:132,y:840},
 AI:{every:8,reserve:200,kitchenMin:60,autoRepairHuman:true}};
const S=window.PXLOGI={on:!/[?&]logistica=0/.test(location.search),version:'1.9.3',cfg:CFG,
 stats:{planks:0,plankBroken:0,phones:0,cuts:0,repairs:0,fast:0,slow:0,deferred:0,opCalls:0,kitchens:0,fed:0,healed:0,snipers:0,sniperLong:0,sniperHits:0,errors:0},
 perf:{n:0,sum:0,max:0}};
if(!S.on){S.state=()=>({on:false});if(window.IronFront)window.IronFront.worksLogistics=S;return}
let errs=0;
function fail(e){S.stats.errors++;if(++errs<=3)console.error('works-logistics.js:',e);if(errs>=12){S.on=false;console.error('works-logistics.js desligado após erros repetidos')}}
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const R=(g,x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(x,y,w,h)};
const EMPTY=mk(1,1);
const hsh=(i,j)=>((i*73856093^j*19349663)>>>0)%97/97;
const sayAt={};
function note(key,msg,gap=6){if(typeof time==='undefined'||time-(sayAt[key]??-99)<gap)return;sayAt[key]=time;try{toast(msg)}catch{}}
const isPrep=()=>!!(F.isPrep&&F.isPrep());
const face=t=>t?-1:1;
const Xt=(t,x)=>t?W-x:x;
const wx=()=>window.PXW&&PXW.state;
function reserveOf(t){return Math.max(CFG.AI.reserve,(window.IronFrontEngineering&&IronFrontEngineering.state&&IronFrontEngineering.state(t)?.reserve)||0)}
function sappersOf(t){let n=0;for(const u of units)if(u.sap&&u.team===t&&u.hp>0)n++;return n}
function enemiesNear(t,x,y,r){let n=0;const r2=r*r;for(const e of units)if(e.team!==t&&e.hp>0&&!e.down&&(e.x-x)**2+(e.y-y)**2<r2)n++;return n}
const dryOK=(x,y)=>!(window.PXW&&PXW.depth&&PXW.depth(x,y)>=.12);

/* ---------- estado ---------- */
let PL=[],PH=[],KIT=[],SNP=[],MINE=[],PEND=[],NET=[null,null],PGRID=new Map(),DEB=[],SAV=new Float32Array(256),ZC=new Int32Array(256),MARK=new Uint32Array(Math.ceil(W/16)*Math.ceil(H/16)+16),MFR=0,PRE=[];
let plankCd=[0,0],netT=0,kitA=0,snipT=0,garT=0,opT=0,aiT=20,cleanT=0,HQ=0,ORIG=null,EXT=null,opTeamCd=[0,0],IDX=new Map();
const GW=Math.ceil(W/16),cellOf=(x,y)=>clamp(Math.floor(y/16),0,Math.ceil(H/16)-1)*GW+clamp(Math.floor(x/16),0,GW-1);   // mesma grade de 16 px do weather.js

/* ======================================================================================
   SPRITES (pixel art; o sappers.js desenha centrado na obra, em pixels de arte = mundo × PX.Z)
   ====================================================================================== */
const SPR=new Map();
function spr(key,f){let c=SPR.get(key);if(!c){if(SPR.size>500)SPR.clear();c=f();SPR.set(key,c)}return c}
function stake(g,w,h,fr){g.fillStyle='#d9e0a6';for(let x=1;x<w-1;x+=2){g.fillRect(x,1,1,1);g.fillRect(x,h-2,1,1)}R(g,2,(h>>1)-1,Math.round((w-4)*fr),2,'#bdb595')}
const workFr=s=>clamp(s.work/(s.need[Math.min(s.stage|0,s.need.length-1)]||1),0,1);
/* canvas quadrado para obra em linha: pinta por (t ao longo do eixo, w de través) sem girar o canvas */
function lineCanvas(s,half,paint){const L=Math.max(6,Math.round((s.len||30)*Z)),sz=L+16,o=sz/2,c=mk(sz,sz),g=c.getContext('2d'),ax=s.ax??0,ay=s.ay??1,nx=-ay,ny=ax;
 for(let t=-L/2;t<=L/2;t+=.5)for(let w=-half;w<=half;w+=.5){const col=paint(t,w,L);if(col){g.fillStyle=col;g.fillRect(Math.round(o+ax*t+nx*w),Math.round(o+ay*t+ny*w),1,1)}}
 return c}
const angKey=s=>Math.round(Math.atan2(s.ay??1,s.ax??0)*20);
function plankSpr(s){const st=s.stage|0,rec=s.lg,fin=st>=s.need.length;
 if(!fin){const fr=workFr(s);return spr(`pkb|${angKey(s)}|${Math.floor(fr*5)}|${Math.round(s.len)}`,()=>lineCanvas(s,5,(t,w,L)=>{const u=t+L/2;
  if(Math.abs(Math.abs(w)-4.2)<.3&&(Math.floor(u)&1))return'#d9e0a6';if(Math.abs(w)<3.2&&u<fr*L)return Math.floor(u/2.4)%2?'#6b5232':'#56452f';return null}))}
 const dead=rec&&rec.dead;
 return spr(`pk|${angKey(s)}|${dead?1:0}|${Math.round(s.len)}`,()=>lineCanvas(s,4.4,(t,w,L)=>{const u=t+L/2,bi=Math.floor(u/2.4),fr=u/2.4-bi,aw=Math.abs(w);
  if(dead){if(hsh(bi,Math.round(w*2))<.62)return null;return aw>3.3?'#2e231a':'#4a3826'}
  if(aw>=3.3)return(bi&1)?'#4a3826':'#3d2e1f';                         // longarinas laterais
  if(fr<.28)return'#1a140d';                                              // vão entre tábuas: o chão escuro aparece
  if(w<-1.7&&fr<.5)return'#a78659';                                       // luz do canto superior esquerdo
  if(aw>2.2&&aw<3&&fr>.58&&fr<.74)return'#bfb59a';                        // pregos
  const k=hsh(bi,7);return k<.33?'#7a5c3a':k<.66?'#6e5233':'#85653f'}))}

/* linha telefônica: postes de madeira no início de cada trecho (e no fim do último), fio com flecha, lâmpada de estado */
const LAMP={ok:'#7fe08a',orphan:'#f0c060',cut:'#e0705a',foe:'#8c908a'};
function bres(g,x0,y0,x1,y1,col,sag){const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0))|0||1;g.fillStyle=col;for(let i=0;i<=n;i++){const f=i/n;g.fillRect(Math.round(x0+(x1-x0)*f),Math.round(y0+(y1-y0)*f+(sag?sag*4*f*(1-f):0)),1,1)}}
function pole(g,x,y,lamp){R(g,x-1,y,3,1,'#2b2218');R(g,x,y-6,1,6,'#5a4430');R(g,x-1,y-6,3,1,'#7a5e3e');R(g,x-1,y-7,1,1,'#a9c4cc');R(g,x+1,y-7,1,1,'#a9c4cc');if(lamp)R(g,x,y-8,1,1,lamp)}
function phoneSpr(s){const rec=s.lg,st=!rec?'icon':rec.st,fin=(s.stage|0)>=s.need.length;
 if(!fin){const fr=workFr(s);return spr(`phb|${angKey(s)}|${Math.floor(fr*5)}|${Math.round(s.len)}`,()=>{const L=Math.max(6,Math.round(s.len*Z)),sz=L+16,o=sz/2,c=mk(sz,sz),g=c.getContext('2d'),ax=s.ax,ay=s.ay;
  g.fillStyle='#d9e0a6';for(let t=-L/2;t<=L/2;t+=2)g.fillRect(Math.round(o+ax*t),Math.round(o+ay*t),1,1);
  const f=Math.round(fr*L);g.fillStyle='#6b5436';for(let t=-L/2;t<-L/2+f;t+=5)g.fillRect(Math.round(o+ax*t)-1,Math.round(o+ay*t)-5,1,5);return c})}
 const foe=rec&&rec.team!==playerTeam,lamp=foe?LAMP.foe:st==='icon'?LAMP.ok:LAMP[st]||LAMP.orphan;
 return spr(`ph|${angKey(s)}|${st}|${foe?1:0}|${rec&&rec.last?1:0}|${Math.round(s.len)}`,()=>{const L=Math.max(6,Math.round((s.len||40)*Z)),sz=L+16,o=sz/2,c=mk(sz,sz),g=c.getContext('2d'),ax=s.ax??0,ay=s.ay??1;
  const x0=o-ax*L/2,y0=o-ay*L/2+2,x1=o+ax*L/2,y1=o+ay*L/2+2;
  g.globalAlpha=.28;g.fillStyle='#14100a';for(let t=0;t<=L;t+=2){g.fillRect(Math.round(x0+(x1-x0)*t/L),Math.round(y0+(y1-y0)*t/L)+1,1,1)}g.globalAlpha=1;   // sombra tracejada no chão
  const tx0=Math.round(x0),ty0=Math.round(y0)-6,tx1=Math.round(x1),ty1=Math.round(y1)-6;
  if(st==='cut'){const f=.4,mx0=x0+(x1-x0)*f,my0=y0+(y1-y0)*f-6,mx1=x0+(x1-x0)*(1-f),my1=y0+(y1-y0)*(1-f)-6;
   bres(g,tx0,ty0,mx0,my0,'#2b302a',.8);bres(g,mx0,my0,mx0,my0+4,'#2b302a');bres(g,tx1,ty1,mx1,my1,'#2b302a',.8);bres(g,mx1,my1,mx1,my1+5,'#2b302a');
   R(g,Math.round(mx0)-1,Math.round(my0)+4,2,1,'#c9a24a');R(g,Math.round(mx1),Math.round(my1)+5,2,1,'#c9a24a')}
  else{bres(g,tx0,ty0,tx1,ty1,'#2b302a',1.5);bres(g,tx0,ty0-1,tx1,ty1-1,'rgba(150,170,160,.35)',1.5)}
  pole(g,Math.round(x0),Math.round(y0),lamp);if(rec?rec.last:true)pole(g,Math.round(x1),Math.round(y1),null);return c})}
function fixSpr(s){const fin=(s.stage|0)>=s.need.length;if(fin)return EMPTY;return spr('fx'+Math.floor(workFr(s)*4),()=>{const c=mk(14,12),g=c.getContext('2d');stake(g,14,12,workFr(s));R(g,5,3,4,4,'#2b302a');R(g,6,4,2,2,'#c9a24a');return c})}

/* cozinha de campanha (26×22 px de arte; chaminé em x=12, y=0) */
function kitchenSpr(s){const st=s.stage|0,fr=workFr(s);
 if(s.wreck)return spr('kitW',()=>{const c=mk(26,22),g=c.getContext('2d');for(const[x,y,w,h]of[[4,12,7,3],[12,14,9,3],[8,8,4,2],[16,9,3,2]]){R(g,x,y,w,h,'#2b241b');R(g,x,y,w,1,'#4a3a28')}R(g,9,11,5,3,'#1c1a16');R(g,18,6,1,5,'#33372f');return c});
 return spr('kit'+st+(st?0:Math.floor(fr*4)),()=>{const c=mk(26,22),g=c.getContext('2d');
  R(g,1,18,24,3,'rgba(20,24,16,.35)');
  if(!st){stake(g,26,22,fr);for(let i=0;i<Math.round(fr*4);i++)R(g,8+i*3,12,2,2,'#7a6a52');return c}
  R(g,3,16,20,2,'#a0926a');                                                     // chão batido
  R(g,3,9,1,8,'#4a3a28');R(g,22,9,1,8,'#4a3a28');                               // mastros do toldo
  if(st>=2){R(g,2,4,22,5,'#8a8260');R(g,2,4,22,1,'#a69c76');for(let x=4;x<24;x+=4)R(g,x,5,1,4,'#6f6a4e');R(g,2,9,22,1,'#5a553e')}   // toldo de lona
  R(g,8,10,8,6,'#33372f');R(g,8,10,8,1,'#555a4c');R(g,9,13,3,2,'#0c0a08');R(g,10,14,1,1,'#e8943a');  // fogão de ferro e boca
  if(st>=2){R(g,12,0,2,10,'#2a2d27');R(g,11,0,4,1,'#4a4e45');R(g,11,1,1,1,'#555a4c')}  // chaminé
  R(g,17,11,5,4,'#242621');R(g,17,11,5,1,'#6b6f63');R(g,18,12,3,1,'#8a6a44');   // panela grande
  R(g,3,14,6,3,'#6b4a2c');R(g,3,14,6,1,'#8a6a44');R(g,4,13,1,1,'#d9d5b7');R(g,6,13,1,1,'#d9d5b7');   // mesa com pratos
  R(g,21,16,4,4,'#6b4a2c');R(g,21,16,4,1,'#8a6a44');R(g,22,18,2,1,'#c9b26a');   // caixote de ração
  return c})}

/* posto de franco-atirador (18×16; a fresta olha para o inimigo: EUA a leste, Alemanha a oeste) */
function sniperSpr(s){const st=s.stage|0,fr=workFr(s),tm=s.team?1:0;
 if(s.wreck)return spr('snpW',()=>{const c=mk(18,16),g=c.getContext('2d');R(g,3,6,12,6,'#1d1a14');R(g,2,5,5,2,'#4a4e45');R(g,10,9,6,2,'#3c403a');R(g,6,3,3,2,'#555a4c');R(g,8,7,3,2,'#0c0a08');return c});
 return spr(`snp${st}${tm}${st?0:Math.floor(fr*4)}`,()=>{const c=mk(18,16),g=c.getContext('2d'),e=tm?-1:1;
  if(!st){stake(g,18,16,fr);return c}
  R(g,3,5,12,8,'#2a2519');R(g,4,6,10,6,'#1d1a12');for(let x=2;x<16;x+=3){R(g,x,3,3,2,'#a0926a');R(g,x,13,3,2,'#978962')}   // cova com sacos
  if(st>=2){R(g,3,4,12,7,'#4b524f');R(g,3,4,12,1,'#8c9693');R(g,3,10,12,1,'#2a2f2d');R(g,3,4,1,7,'#707975');R(g,14,4,1,7,'#2c312f');    // caixa de aço
   for(const[x,y]of[[5,5],[8,5],[11,5],[5,9],[12,9]])R(g,x,y,1,1,'#aab2ae');                                                            // rebites
   const fx=e>0?13:3;R(g,fx,6,2,3,'#0c0e0c');R(g,fx+(e>0?0:1),7,1,1,'#bcd2d8');                                                         // fresta e brilho da luneta
   R(g,6,6,4,3,'#59615d');R(g,6,6,4,1,'#78827e');for(const[x,y]of[[10,5],[4,8]])R(g,x,y,2,1,'#5d6a4a')}                                  // escotilha e mancha de camuflagem
  return c})}

/* ======================================================================================
   CATÁLOGO
   ====================================================================================== */
/* trecho de linha pronto sai de PXSAP.segs (o catálogo do fortify conta todos os segmentos contra o limite de obras da engenharia da IA) e é desenhado aqui */
const unseg=s=>{const L=SAP.segs,i=L?L.indexOf(s):-1;if(i>=0)L.splice(i,1)};
const LINEK=new Set(['plank','phone','phonefix']);
const doneItem=s=>{const it=s.p&&s.p.item;if(it){it.done=true;it.seg=s}};
const lineRec=(s,extra)=>({s,team:s.team,x:s.x,y:s.y,ax:s.ax,ay:s.ay,len:s.len,dead:false,...extra});
function defKind(id,def){if(K[id]){console.warn('works-logistics.js: tipo já existe: '+id);return false}K[id]=def;if(!F.KINDS.includes(id)&&!def.hidden)F.KINDS.push(id);return true}
defKind('plank',{need:CFG.PLANK.need,target:1,cost:CFG.PLANK.cost,line:1,step:CFG.PLANK.step,noAnchor:1,label:'Passadiço de tábuas (ignora a lama): arraste uma linha',sprite:plankSpr,
 onStage:(s,st)=>{s.stage=2;const r=lineRec(s,{hp:CFG.PLANK.hp,last:s.p.segs[s.p.segs.length-1]===s});s.lg=r;PL.push(r);S.stats.planks++;rebuildPlanks();unseg(s);if(r.last)doneItem(s)}});
defKind('phone',{need:CFG.PHONE.need,target:1,cost:CFG.PHONE.cost,line:1,step:CFG.PHONE.step,noAnchor:1,label:'Linha telefônica de campanha (QG/posto → bateria): arraste uma linha',sprite:phoneSpr,
 onStage:(s,st)=>{s.stage=2;const r=lineRec(s,{cut:false,st:'orphan',last:s.p.segs[s.p.segs.length-1]===s});s.lg=r;PH.push(r);S.stats.phones++;netT=0;unseg(s);if(r.last)doneItem(s)}});
defKind('phonefix',{hidden:1,need:[CFG.PHONE.fixNeed],target:1,cost:CFG.PHONE.fixCost,box:{hw:10,hh:8},sprite:fixSpr,
 onStage:(s,st)=>{s.stage=2;unseg(s);const r=s.p.fixRec;if(r&&!r.dead&&r.cut){r.cut=false;r.cutT=0;r.st='orphan';r.spr=null;netT=0;S.stats.repairs++;
   if(r.team===playerTeam)note('fix','Linha telefônica emendada pelos pioneiros.',4)}}});
defKind('kitchen',{need:CFG.KITCHEN.need,target:2,cost:CFG.KITCHEN.cost,label:'Cozinha de campanha (longe da frente): clique',box:{hw:15,hh:12},sprite:kitchenSpr,
 onStage:(s,st)=>{if(st===2){KIT.push({s,team:s.team,x:s.x,y:s.y,hp:CFG.KITCHEN.hp,fed:0,t0:time});S.stats.kitchens++;doneItem(s)}}});
defKind('sniper',{need:CFG.SNIPER.need,target:2,cost:CFG.SNIPER.cost,label:'Posto de franco-atirador (aço com fresta): clique',box:{hw:11,hh:9},sprite:sniperSpr,
 onStage:(s,st)=>{if(st===2){SNP.push({s,team:s.team,x:s.x,y:s.y,hp:CFG.SNIPER.hp,res:null,occ:null,next:time+2,t0:time});S.stats.snipers++;doneItem(s)}}});
Object.assign(F.SHORT,{plank:'Passadiço',phone:'Telefone',kitchen:'Cozinha',sniper:'Atirador'});
Object.assign(F.SUB,{plank:'Ignora a lama · ◈/trecho',phone:'Liga QG/posto à bateria · ◈/trecho',kitchen:'Fôlego, moral e feridos leves',sniper:'Alcance e blindagem'});

/* ======================================================================================
   PASSADIÇO: a lama sob as tábuas vale 0 durante o update (weather.js e a física leem o mesmo vetor), e a água rasa pesa metade
   ====================================================================================== */
function rebuildPlanks(){PL=PL.filter(p=>!p.dead);PGRID=new Map();const hw=CFG.PLANK.hwE;
 for(const p of PL){const ex=Math.abs(p.ax)*p.len/2+Math.abs(p.ay)*hw+4,ey=Math.abs(p.ay)*p.len/2+Math.abs(p.ax)*hw+4;
  for(let cx=Math.floor((p.x-ex)/64);cx<=Math.floor((p.x+ex)/64);cx++)for(let cy=Math.floor((p.y-ey)/64);cy<=Math.floor((p.y+ey)/64);cy++){const k=cx*1024+cy;let l=PGRID.get(k);if(!l)PGRID.set(k,l=[]);l.push(p)}}
}
function plankAt(x,y){const l=PGRID.get(Math.floor(x/64)*1024+Math.floor(y/64));if(!l)return null;
 for(const p of l){const dx=x-p.x,dy=y-p.y,al=dx*p.ax+dy*p.ay,ac=-dx*p.ay+dy*p.ax;if(Math.abs(al)<=p.len/2+3&&Math.abs(ac)<=CFG.PLANK.hwE)return p}return null}
const dFac=(tank,d)=>tank?(d<.12?1:d<.25?.85:d<.55?.55:d<.78?.3:.12):(d<.12?1:d<.25?.92:d<.55?.72:.45);   // fatores de água do weather.js (speedOf)
const OFF=[[0,0],[3,3],[-3,3],[3,-3],[-3,-3]];
/* zera a lama só nas células sob quem está no passadiço (não em todas as tábuas): o weather.js repinta o terreno em blocos de 64 px
   quando a lama de uma célula muda de uma vez, então zerar o passadiço inteiro custaria render a cada passo de simulação */
function plankPre(){PRE.length=0;if(!PL.length)return null;const w=window.PXW;if(!w)return null;
 const wet=!!(w.depth&&(w.flood===undefined||w.flood>.002)),mud=!!(w.mudGrid&&((w.state&&w.state.mud)||0)+((w.state&&w.state.I)||0)>.005);   // tempo seco: nada a fazer
 if(!wet&&!mud)return null;let n=0;const g=mud?w.mudGrid:null;if(mud)MFR++;
 for(const u of units){if(u.hp<=0||!plankAt(u.x,u.y))continue;if(wet)PRE.push(u,u.x,u.y);
  if(mud)for(let i=0;i<5;i++){const x=u.x+OFF[i][0],y=u.y+OFF[i][1];if(i&&!plankAt(x,y))continue;const k=cellOf(x,y);if(MARK[k]===MFR)continue;MARK[k]=MFR;
   if(n>=ZC.length){const z=new Int32Array(n*2);z.set(ZC);ZC=z;const sv=new Float32Array(n*2);sv.set(SAV);SAV=sv}ZC[n]=k;SAV[n]=g[k];g[k]=0;n++}}
 return n?{g,n}:null}
function plankPost(pk,dt){
 if(pk){const g=pk.g,dry=!(PXW.state&&PXW.state.I>.05);for(let i=0;i<pk.n;i++){const k=ZC[i];let m=SAV[i];if(dry)m=Math.max(0,m-dt*.0008);g[k]=Math.min(1,m+g[k])}}   // a chuva que caiu no quadro soma; a secagem é emulada
 if(PRE.length&&window.PXW&&PXW.depth){for(let i=0;i<PRE.length;i+=3){const u=PRE[i];if(u.hp<=0||u._bog>time)continue;const d=PXW.depth(u.x,u.y);if(d<.12||d>=.55)continue;
   const tank=u.type==='tank',f0=dFac(tank,d),r=(1-(1-f0)*.5)/f0,dx=u.x-PRE[i+1],dy=u.y-PRE[i+2],mag=hyp(dx,dy),sp=(defs[u.type]&&defs[u.type].speed)||47;
   if(mag<.01||mag>sp*dt*4)continue;const k=Math.min(r-1,(sp*dt*.6)/mag);u.x=clamp(u.x+dx*k,15,W-15);u.y=clamp(u.y+dy*k,15,H-15)}}
 PRE.length=0}

/* ======================================================================================
   LINHA TELEFÔNICA: grafo de trechos intactos + terminais (QG, depósito, posto de observação, bateria)
   ====================================================================================== */
const batAlive=b=>b.crew?b.crew.some(c=>c.alive):true;
const anyBat=t=>!!(window.PXBAT&&PXBAT.batteries&&PXBAT.batteries.some(b=>b.team===t&&batAlive(b)));
const batPos=b=>b.cx!==undefined?{x:b.cx*2,y:b.cy*2}:{x:b.x,y:b.y};
function terminals(t){const T=[{k:'qg',x:t?W-CFG.QG.x:CFG.QG.x,y:CFG.QG.y}];
 if(window.PXWORKS&&PXWORKS.on){for(const d of PXWORKS.depots())if(d.team===t&&d.hp>0)T.push({k:'dep',x:d.x,y:d.y,o:d});for(const o of PXWORKS.ops())if(o.team===t&&o.hp>0)T.push({k:'op',x:o.x,y:o.y,o})}
 if(window.PXBAT&&PXBAT.batteries)for(const b of PXBAT.batteries)if(b.team===t&&batAlive(b)){const p=batPos(b);T.push({k:'bat',x:p.x,y:p.y,o:b})}
 return T}
function segDist(px,py,e){const dx=e[2]-e[0],dy=e[3]-e[1],l2=dx*dx+dy*dy,f=l2?clamp(((px-e[0])*dx+(py-e[1])*dy)/l2,0,1):0;return hyp(px-e[0]-dx*f,py-e[1]-dy*f)}
const endsOf=r=>[r.x-r.ax*r.len/2,r.y-r.ay*r.len/2,r.x+r.ax*r.len/2,r.y+r.ay*r.len/2];
function recompute(){
 for(let t=0;t<2;t++){const segs=PH.filter(r=>r.team===t&&!r.cut&&!r.dead),T=terminals(t),n=segs.length,N=n+T.length,par=new Int16Array(N);
  for(let i=0;i<N;i++)par[i]=i;const find=i=>{while(par[i]!==i){par[i]=par[par[i]];i=par[i]}return i},uni=(a,b)=>{a=find(a);b=find(b);if(a!==b)par[a]=b};
  const E=segs.map(endsOf),L2=CFG.PHONE.linkSeg**2;
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const a=E[i],b=E[j];if(Math.abs(segs[i].x-segs[j].x)>segs[i].len+CFG.PHONE.linkSeg*2||Math.abs(segs[i].y-segs[j].y)>segs[i].len+CFG.PHONE.linkSeg*2)continue;
   if((a[0]-b[0])**2+(a[1]-b[1])**2<=L2||(a[0]-b[2])**2+(a[1]-b[3])**2<=L2||(a[2]-b[0])**2+(a[3]-b[1])**2<=L2||(a[2]-b[2])**2+(a[3]-b[3])**2<=L2)uni(i,j)}
  for(let k=0;k<T.length;k++)for(let i=0;i<n;i++)if(segDist(T[k].x,T[k].y,E[i])<=CFG.PHONE.linkTerm)uni(n+k,i);
  const info=new Map(),get=r=>{let o=info.get(r);if(!o)info.set(r,o={bat:0,qg:false,src:0,segs:[],terms:[]});return o};
  for(let i=0;i<n;i++)get(find(i)).segs.push(segs[i]);
  for(let k=0;k<T.length;k++){const o=get(find(n+k)),q=T[k];q.root=find(n+k);o.terms.push(q);if(q.k==='bat')o.bat++;else{o.src++;if(q.k==='qg')o.qg=true}}
  for(let i=0;i<n;i++){const o=info.get(find(i)),st=o.bat>0?'ok':'orphan';if(segs[i].st!==st){segs[i].st=st;segs[i].spr=null}}
  NET[t]={segs,T,info,hq:!!info.get(T[0].root)&&info.get(T[0].root).bat>0}}
}
const termLinked=(t,q)=>{const N=NET[t];if(!N)return false;const o=N.info.get(q.root);return !!o&&o.bat>0};
function opLinked(t,op){const N=NET[t];if(!N)return false;const q=N.T.find(x=>x.o===op);return !!q&&termLinked(t,q)}
function hqLinked(t){const N=NET[t];return !!(N&&N.hq)}
function nearLinked(t,x,y,Rr){const N=NET[t];if(!N)return false;
 for(const r of N.segs)if(r.st==='ok'&&hyp(r.x-x,r.y-y)<=Rr+r.len/2)return true;
 for(const q of N.T)if(q.k!=='bat'&&termLinked(t,q)&&hyp(q.x-x,q.y-y)<=Rr)return true;return false}
function cutRec(r,quiet){if(r.cut||r.dead)return;r.cut=true;r.st='cut';r.cutT=time;r.spr=null;S.stats.cuts++;netT=0;
 for(let i=0;i<8;i++)particles.push({x:r.x+rnd(-8,8),y:r.y+rnd(-6,2),vx:rnd(-40,40),vy:rnd(-60,-10),t:rnd(.2,.5),max:.5,color:i&1?'#ffd27a':'#fffbe0',size:2});
 if(!quiet){if(r.team===playerTeam)note('cut','Linha telefônica cortada! Pedidos de fogo corrigidos vão atrasar até os pioneiros repararem.',4)}}
function cutAt(x,y,r,power){if(power<CFG.PHONE.cutPow)return;for(const rec of PH){if(rec.cut||rec.dead)continue;if(segDist(x,y,endsOf(rec))<r*CFG.PHONE.cutK)cutRec(rec)}}

/* ---------- pedidos de fogo: quem corrige precisa de linha até uma bateria ---------- */
function spotters(t,x,y,origin){const L=[];
 if(origin){L.push({k:'op',o:origin});return L}
 if(window.PXWORKS&&PXWORKS.on){const A=(PXWORKS.cfg&&PXWORKS.cfg.OP&&PXWORKS.cfg.OP.art)||480;for(const o of PXWORKS.ops())if(o.team===t&&hyp(o.x-x,o.y-y)<A)L.push({k:'op',o})}
 try{const u=window.PXCLS&&PXCLS.on&&PXCLS.observerOf&&PXCLS.observerOf(t,x,y);if(u)L.push({k:'obs',u})}catch{}
 try{if(window.PXAIR&&PXAIR.on&&PXAIR.spotterOver&&PXAIR.spotterOver(t,x,y))L.push({k:'air'})}catch{}
 try{if(window.PXFL&&PXFL.on&&PXFL.spotted&&PXFL.spotted(t,x,y))L.push({k:'air'})}catch{}
 return L}
function isLinked(t,sp){recompute();for(const s of sp){if(s.k==='op'&&opLinked(t,s.o))return true;if(s.k==='obs'&&nearLinked(t,s.u.x,s.u.y,CFG.PHONE.obsR))return true;if(s.k==='air'&&hqLinked(t))return true}return false}
const mission0=window.PXBAT&&PXBAT.mission;
if(mission0)PXBAT.mission=function(team,x,y,count,spread,kind,cb,strict){
 if(!S.on||HQ>0||strict||cb||kind==='smoke'||!(PXBAT.active&&PXBAT.active())||!anyBat(team))return mission0.apply(this,arguments);   // sem peça do lado não há linha a cobrar: o battery.js trata o pedido como sempre
 let sp;try{sp=spotters(team,x,y,ORIG)}catch(e){fail(e);return mission0.apply(this,arguments)}
 if(!sp.length)return mission0.apply(this,arguments);
 let ok;try{ok=isLinked(team,sp)}catch(e){fail(e);ok=true}
 if(ok){S.stats.fast++;return mission0.apply(this,arguments)}
 S.stats.slow++;S.stats.deferred++;PEND.push({at:time+CFG.PHONE.delay,team,x,y,count,spread,kind,cb,strict});
 if(team===playerTeam)note('late','Sem linha telefônica até a bateria: o pedido de fogo corrigido leva ~'+CFG.PHONE.delay+' s e cai mais disperso.',25);
 return true};
wrap('place',(orig,...a)=>{HQ++;try{return orig(...a)}finally{HQ--}});             // a carta de artilharia do jogador sai do comando: linha direta
wrap('runCommander',(orig,...a)=>{HQ++;try{return orig(...a)}finally{HQ--}});      // o comando da IA também
function pendTick(){if(!PEND.length||!mission0)return;const keep=[];
 for(const p of PEND){if(time<p.at){keep.push(p);continue}try{mission0.call(PXBAT,p.team,p.x,p.y,p.count,p.spread*CFG.PHONE.spreadK,p.kind,p.cb,p.strict)}catch(e){fail(e)}}
 PEND=keep}
/* o posto de observação da IA pede fogo sozinho: é o pedido que depende da linha */
function opPick(o){let best=null,bs=0;const O=CFG.OPCALL,vis=o.team===playerTeam&&window.PXW&&PXW.visible?PXW.visible:null;
 for(const e of units){if(e.team===o.team||e.hp<=0||e.down||e.type==='cavalry')continue;const d=hyp(e.x-o.x,e.y-o.y);if(d>O.see||d<140)continue;if(vis&&!vis(e))continue;
  let s=e.type==='mg'?O.cluster+2:0;if(!s&&e.type!=='tank'){let n=0;for(const q of units)if(q.team===e.team&&q.hp>0&&(q.x-e.x)**2+(q.y-e.y)**2<O.clusterR**2)n++;s=n}
  if(s<O.cluster)continue;let safe=true;for(const q of units)if(q.team===o.team&&q.hp>0&&(q.x-e.x)**2+(q.y-e.y)**2<O.safe**2){safe=false;break}if(!safe)continue;if(s>bs){bs=s;best=e}}
 return best}
function opFire(){if(!window.PXWORKS||!PXWORKS.on||!PXBAT||!PXBAT.mission||!(PXBAT.active&&PXBAT.active())||isPrep())return;
 for(const o of PXWORKS.ops()){if(o.hp<=0||!aiEnabled[o.team]||time<(o.lgCd||0)||time<opTeamCd[o.team])continue;const tg=opPick(o);if(!tg){o.lgCd=time+6;continue}
  o.lgCd=time+CFG.OPCALL.every;opTeamCd[o.team]=time+CFG.OPCALL.teamEvery;ORIG=o;try{PXBAT.mission(o.team,tg.x,tg.y,CFG.OPCALL.count,CFG.OPCALL.spread,'he');S.stats.opCalls++}finally{ORIG=null}}}

/* ======================================================================================
   COZINHA
   ====================================================================================== */
function revive(u){u.down=false;u.inBed=0;u.carried=false;u.claimed=null;u.cz=null;u.lgK=0;u.hp=Math.max(u.hp,u.maxhp*.4);u.order='hold';u.tx=u.x;u.ty=u.y;u.manualUntil=0;u.aiRole='';u.suppression=0;u.cohesion=Math.max(.5,u.cohesion??1);u.target=null}
function kitchenTick(dt){const C=CFG.KITCHEN,r2=C.r*C.r;
 for(const k of KIT){if(k.hp<=0)continue;let n=0;
  for(const u of units){if(u.team!==k.team||u.hp<=0||(u.x-k.x)**2+(u.y-k.y)**2>r2)continue;
   if(u.down){const z=u.cz;if(!z||z.sev!=='light'||u.carried||u.claimed||u.inBed||z.hid||z.res)continue;if(n>=C.cap)break;n++;u.bleed=(u.bleed||time+60)+dt*(1-C.bleedK);u.lgK=(u.lgK||0)+dt;
    if(u.lgK>=C.heal){revive(u);S.stats.healed++;k.fed++;if(u.team===playerTeam)note('heal','Cozinha de campanha: um ferido leve se recuperou e voltou à luta.',8)}continue}
   if(n>=C.cap)break;n++;
   if(u.type!=='tank'){u.cohesion=Math.min(1,(u.cohesion??1)+dt*C.coh);u.suppression=Math.max(0,(u.suppression||0)-dt*C.supp)}
   if(u===player&&typeof mode!=='undefined'&&mode==='soldier'&&window.PXGEAR&&PXGEAR.on&&PXGEAR.st&&PXGEAR.cfg&&PXGEAR.cfg.ST)PXGEAR.st.s=Math.min(PXGEAR.cfg.ST.MAX,PXGEAR.st.s+dt*C.stam)}
  S.stats.fed+=n?dt*n:0}}

/* ======================================================================================
   POSTO DE FRANCO-ATIRADOR
   ====================================================================================== */
function byId(id){return IDX.get(id)}
const idleU=u=>u.order==='hold'&&!u.target;
function pickMarksman(p){let best=null,bs=Infinity;
 for(const u of units){if(u.team!==p.team||u.cls!=='marksman'||u.hp<=0||u.down||u.rs||u.sap||u.thr>0||(u===player&&mode==='soldier'))continue;
  if(u.lgPost&&u.lgPost!==p&&u.lgPost.hp>0)continue;if(u.manualUntil>time&&u.manualUntil!==u.lgStamp)continue;const d=hyp(u.x-p.x,u.y-p.y);if(d>CFG.SNIPER.assignR)continue;
  const sc=d+(idleU(u)?0:400);if(sc<bs){bs=sc;best=u}}
 return best}
function garrison(){const prep=isPrep();
 for(const p of SNP){if(p.hp<=0)continue;let u=p.res!=null?byId(p.res):null;
  if(u&&(u.hp<=0||u.down||u.rs||!u.cls||u.sap||prep||(u.manualUntil>time&&u.manualUntil!==u.lgStamp)||(u===player&&mode==='soldier'))){if(u&&u.manualUntil===u.lgStamp)u.manualUntil=0;if(u)u.lgPost=null;u=null;p.res=null}
  if(!u&&!prep&&time>=p.next){p.next=time+2;u=pickMarksman(p);if(u){p.res=u.id;u.lgPost=p}}
  if(u){const d=hyp(u.x-p.x,u.y-p.y);if(d>6){u.tx=p.x;u.ty=p.y;u.order='move'}else if(u.order==='move'){u.order='hold';u.tx=u.x;u.ty=u.y}u.manualUntil=u.lgStamp=time+3}}}
function occupants(){for(const u of units)if(u._lgIn)u._lgIn=null;
 for(const p of SNP){p.occ=null;if(p.hp<=0)continue;for(const u of units){if(u.team!==p.team||u.cls!=='marksman'||u.hp<=0||u.down||(u.x-p.x)**2+(u.y-p.y)**2>CFG.SNIPER.occR**2)continue;p.occ=u;u._lgIn=p;break}}}
const natMark=u=>{try{return PXCLS.cfg.NAT[u.team?1:0].mark.range}catch{return 340}};
function longTarget(u,Rr){let best=null,bs=0;const lo=natMark(u)*.97,sight=typeof sightRange==='function'?sightRange(Rr):Rr,vis=u.team===playerTeam&&window.PXW&&PXW.visible?PXW.visible:null;
 for(const e of units){if(e.team===u.team||e.hp<=0||e.down||e.type==='tank')continue;const d=hyp(e.x-u.x,e.y-u.y);if(d<=lo||d>sight)continue;if(vis&&!vis(e))continue;
  const s=(e.type==='mg'?3:e.cls==='observer'?2.5:e.cls==='grenadier'||e.cls==='marksman'?2:1)*(1-d/sight*.5);if(s>bs){bs=s;best=e}}
 return best}
function sniperTick(){for(const p of SNP){const u=p.occ;if(!u||p.hp<=0)continue;
  if(u.cd>0||u.rs||u.rl>0||u.thr>0||(u.suppression||0)>=1)continue;const Rr=natMark(u)*CFG.SNIPER.rangeK,tg=longTarget(u,Rr);if(!tg)continue;
  const Br=window.IronFrontBrain;if(Br&&Br.safeShot&&!Br.safeShot(u,tg,units,decor,buildings))continue;
  const n0=bullets.length;EXT={u,R:Rr};try{shoot(u,tg)}finally{EXT=null}
  if(bullets.length>n0){S.stats.sniperLong++;if(u.ammo!==undefined&&--u.ammo<=0)u.rl=2.4}}}
wrap('shoot',(orig,u,target,manual)=>{if(!EXT||EXT.u!==u)return orig(u,target,manual);const n0=bullets.length,r=orig(u,target,manual);
 for(let i=n0;i<bullets.length;i++){const b=bullets[i];if(b.team===u.team&&b.damage>0){const sp=hyp(b.vx,b.vy)||800;b.t=Math.max(b.t,EXT.R/sp);b.xlong=1}}return r});
wrap('damage',(orig,u,n,a)=>{if(u&&u._lgIn&&u._lgIn.hp>0&&n>0){n*=CFG.SNIPER.dmgK;S.stats.sniperHits++}return orig(u,n,a)});

/* ======================================================================================
   IA: plano na trégua (planExtra) e reação em guerra
   ====================================================================================== */
function gunPlan(t){let gp=[];try{gp=(PX.WW1.layout().gunsPlan||[]).map(g=>({x:g.x*2+4,y:g.y*2}))}catch{}
 if(!gp.length)gp=[{x:330,y:420},{x:330,y:800},{x:330,y:1180},{x:240,y:600},{x:240,y:1000}];return gp.map(g=>({x:Xt(t,g.x),y:g.y}))}
const nearest=(list,x,y)=>list.reduce((b,g)=>(!b||hyp(g.x-x,g.y-y)<hyp(b.x-x,b.y-y))?g:b,null);
if(Array.isArray(F.planExtra))F.planExtra.push((t,FX,fc)=>{const qg={x:Xt(t,CFG.QG.x),y:CFG.QG.y},gp=gunPlan(t),g1=nearest(gp,qg.x,qg.y),opP={x:FX-fc*40,y:800},g2=nearest(gp,opP.x,opP.y),out=[];
 out.push({kind:'kitchen',pts:[[FX-fc*250,800]],pri:58},{kind:'sniper',pts:[[FX-fc*14,520]],pri:53},{kind:'sniper',pts:[[FX-fc*14,1080]],pri:54});
 if(g1)out.push({kind:'phone',pts:[[qg.x,qg.y],[g1.x,g1.y]],pri:62});
 if(g2)out.push({kind:'phone',pts:[[opP.x,opP.y],[g2.x,g2.y]],pri:66});
 return out});
function startProject(t,kind,pts,extra,free){const k=K[kind],n=k.line?SAP._.segment(pts,k.step||SAP.cfg.SEG).length:1,cost=n*k.cost;if(!n)return null;
 if(!sandbox&&supplies[t]<cost+(free?0:reserveOf(t)))return null;   // reparo (◈2) não espera a reserva: fio cortado é o que mais atrasa a artilharia
 const p=SAP.project(t,kind,'logi',pts,{keep:true});if(!p)return null;if(!sandbox)supplies[t]-=cost;if(extra)Object.assign(p,extra);MINE.push({p,kind,team:t,t0:time,cost,rec:extra&&extra.fixRec||null});return p}
const liveOf=(t,pred)=>MINE.filter(m=>m.team===t&&!m.p.done&&(!pred||pred(m)));
const phoneSegs=t=>PH.filter(r=>r.team===t&&!r.dead).length+liveOf(t,m=>m.kind==='phone').reduce((n,m)=>n+m.p.segs.length,0);
function repairs(t){const hum=t===playerTeam&&!aiEnabled[t];if(hum&&!CFG.AI.autoRepairHuman)return false;
 if(liveOf(t,m=>m.kind==='phonefix').length>=2)return false;
 const cuts=PH.filter(r=>r.team===t&&r.cut&&!r.dead&&!MINE.some(m=>m.rec===r&&!m.p.done)&&(time-r.cutT>CFG.PHONE.fixWait||enemiesNear(t,r.x,r.y,180)<2)).sort((a,b)=>a.cutT-b.cutT);
 const r=cuts[0];if(!r)return false;return !!startProject(t,'phonefix',[[r.x,r.y]],{fixRec:r},true)}
function phoneLink(t){const bats=PXBAT&&PXBAT.batteries?PXBAT.batteries.filter(b=>b.team===t&&batAlive(b)):[];if(!bats.length||phoneSegs(t)>=CFG.PHONE.maxSegs)return false;
 recompute();const N=NET[t];if(!N)return false;
 const srcs=[];const q0=N.T[0];if(!termLinked(t,q0))srcs.push(q0);for(const q of N.T)if(q.k==='op'&&!termLinked(t,q))srcs.push(q);
 for(const q of srcs){const o=N.info.get(q.root),from=[{x:q.x,y:q.y}];if(o)for(const r of o.segs){const e=endsOf(r);from.push({x:e[0],y:e[1]},{x:e[2],y:e[3]})}
  const to=[];for(const b of N.T)if(b.k==='bat')to.push({x:b.x,y:b.y});for(const [root,inf] of N.info)if(inf.bat>0)for(const r of inf.segs){const e=endsOf(r);to.push({x:e[0],y:e[1]},{x:e[2],y:e[3]})}
  let bd=Infinity,bf=null,bt=null;for(const a of from)for(const b of to){const d=hyp(a.x-b.x,a.y-b.y);if(d<bd){bd=d;bf=a;bt=b}}
  if(!bf||bd<12||bd>760)continue;
  if(startProject(t,'phone',[[bf.x,bf.y],[bt.x,bt.y]]))return true}
 return false}
function lane(t){const fc=face(t),w=wx();let fy=800;try{const op=IronFrontBrain&&IronFrontBrain.lastPlans&&IronFrontBrain.lastPlans[t]&&IronFrontBrain.lastPlans[t].operation;if(op)fy=op.y}catch{}
 const roads=(window.PX&&PX.WW1&&PX.WW1.ROADY?PX.WW1.ROADY:[185,400,610]).map(v=>v*2),y=roads.reduce((b,r)=>Math.abs(r-fy)<Math.abs(b-fy)?r:b,roads[0]);
 const fr=fieldTrenches.filter(a=>a.team===t&&a.line==='front'),fx=(fr.length?fr.reduce((n,a)=>n+a.x,0)/fr.length:Xt(t,720))-fc*30;return{y,x0:Xt(t,340),x1:fx,fc}}
function planks(t){const w=wx();if(time<plankCd[t]||!w||w.snow||!(w.I>CFG.PLANK.rainMin||(w.mud||0)>CFG.PLANK.mudMin)||sappersOf(t)<3)return false;
 const n=PL.filter(p=>p.team===t&&!p.dead).length+liveOf(t,m=>m.kind==='plank').reduce((a,m)=>a+m.p.segs.length,0);if(n>=CFG.PLANK.maxSegs)return false;
 const L=lane(t),st=CFG.PLANK.step;let k=0,x=L.x0+L.fc*st/2;
 const has=(x,y)=>PL.some(p=>!p.dead&&hyp(p.x-x,p.y-y)<st*.75)||liveOf(t,m=>m.kind==='plank').some(m=>m.p.segs.some(s=>hyp(s.x-x,s.y-y)<st*.75));
 while((x-L.x1)*L.fc<0&&has(x,L.y)&&k++<80)x+=L.fc*st;if((x-L.x1)*L.fc>=0)return false;
 const xs=x-L.fc*st/2,xe=clamp(xs+L.fc*st*CFG.PLANK.chunk,40,W-40);if(enemiesNear(t,x,L.y,260)>=3)return false;
 const ok=!!startProject(t,'plank',[[xs,L.y],[(xe-L.x1)*L.fc>0?L.x1:xe,L.y]]);if(ok)plankCd[t]=time+25;return ok}   // folga entre trechos: a cozinha e os postos também entram na fila
function kitchen(t){const alive=KIT.filter(k=>k.team===t&&k.hp>0).length+liveOf(t,m=>m.kind==='kitchen').length;if(alive>=(supplies[t]>700||sandbox?2:1)||time<CFG.AI.kitchenMin)return false;
 let stress=0;for(const u of units)if(u.team===t&&u.hp>0&&(u.down||(u.cohesion??1)<.55||(u.suppression||0)>.9))stress++;if(stress<5&&!(alive===0&&time>150))return false;
 let fy=800;try{const op=IronFrontBrain.lastPlans[t].operation;if(op)fy=op.y}catch{}
 let x=Xt(t,430),y=clamp(fy+rnd(-150,150),420,1180);if(!dryOK(x,y)){y=clamp(y+(y>800?-200:200),420,1180)}if(enemiesNear(t,x,y,400)>0)return false;
 return !!startProject(t,'kitchen',[[x,y]])}
function sniper(t){const mk=units.filter(u=>u.team===t&&u.cls==='marksman'&&u.hp>0&&!u.sap).length,have=SNP.filter(p=>p.team===t&&p.hp>0).length+liveOf(t,m=>m.kind==='sniper').length;
 if(!mk||have>=Math.min(2,mk)||time<50)return false;const fc=face(t),fr=fieldTrenches.filter(a=>a.team===t&&a.line==='front');if(!fr.length)return false;
 for(let tries=0;tries<6;tries++){const a=fr[(Math.random()*fr.length)|0],x=a.x-fc*18,y=a.y+rnd(-20,20);
  if(SNP.some(p=>p.team===t&&p.hp>0&&hyp(p.x-x,p.y-y)<150)||liveOf(t,m=>m.kind==='sniper').some(m=>hyp(m.p.segs[0].x-x,m.p.segs[0].y-y)<150))continue;
  if(enemiesNear(t,x,y,170)>0||!dryOK(x,y))continue;return !!startProject(t,'sniper',[[x,y]])}
 return false}
/* mesmo teto da engenharia da IA (engineering.js: min(4, pioneiros/3) obras vivas): não ocupa a vaga de quem constrói a trincheira */
const freeSlots=t=>Math.min(4,Math.max(1,Math.floor(sappersOf(t)/3)))-SAP.projects.filter(p=>!p.done&&p.team===t&&p.kind!=='phonefix').length;
function aiPlan(t){const sap=sappersOf(t);if(!sap)return;
 for(const m of MINE)if(m.team===t&&!m.p.done&&m.kind!=='phonefix'&&!m.p.crew.length&&time-m.t0>150&&m.p.segs.every(s=>s.stage===0)){SAP.cancel(m.p);if(!sandbox)supplies[t]+=m.cost;m.dropped=1}   // obra que nunca teve equipe: devolve o dinheiro
 if(repairs(t))return;if(liveOf(t,m=>m.kind!=='phonefix').length>=1||freeSlots(t)<=0)return;
 phoneLink(t)||planks(t)||kitchen(t)||sniper(t)}
function aiTick(dt){if((aiT-=dt)>0)return;aiT=CFG.AI.every;if(isPrep())return;
 for(let t=0;t<2;t++){if(!aiEnabled[t]&&!(t===playerTeam&&CFG.AI.autoRepairHuman))continue;try{if(aiEnabled[t])aiPlan(t);else{if(sappersOf(t)&&!liveOf(t,m=>m.kind==='phonefix').length)repairs(t)}}catch(e){fail(e)}}}

/* ======================================================================================
   LAÇO E LIGAÇÕES
   ====================================================================================== */
function tick(dt){
 if((netT-=dt)<=0){netT=.5;recompute()}
 kitA+=dt;if(kitA>=.5){kitchenTick(kitA);kitA=0}     // passo de 0,5 s com o tempo real acumulado (o quadro de 1/30 s não fecha 0,5 s)
 if((snipT-=dt)<=0){snipT=.25;occupants();sniperTick()}
 if((garT-=dt)<=0){garT=.5;IDX=new Map();for(const u of units)IDX.set(u.id,u);garrison()}
 if((opT-=dt)<=0){opT=1;opFire()}
 pendTick();aiTick(dt);
 if((cleanT-=dt)<=0){cleanT=1;
  {const P=SAP.projects;if(P)for(let i=P.length-1;i>=0;i--){const p=P[i];if(p.done&&LINEK.has(p.kind))P.splice(i,1)}}   // projeto de linha pronto sai da lista (os trechos já saíram de PXSAP.segs)
  MINE=MINE.filter(m=>!(m.p.done&&time-m.t0>60)&&!m.dropped);
  KIT=KIT.filter(k=>{if(k.hp>0)return true;return false});SNP=SNP.filter(p=>{if(p.hp>0)return true;if(p.occ)p.occ._lgIn=null;return false});
  for(const m of MINE)if(m.kind==='phonefix'&&!m.p.done&&!m.p.crew.length&&time-m.t0>90){SAP.cancel(m.p);m.dropped=1;if(!sandbox)supplies[m.team]+=CFG.PHONE.fixCost}}}
wrap('setup',(orig,...a)=>{for(const k in S.stats)S.stats[k]=0;S.perf.n=0;S.perf.sum=0;S.perf.max=0;PL=[];PH=[];KIT=[];SNP=[];MINE=[];PEND=[];NET=[null,null];PGRID=new Map();DEB=[];PRE.length=0;plankCd=[0,0];netT=0;kitA=0;snipT=0;garT=0;opT=1;aiT=20;cleanT=1;HQ=0;ORIG=null;EXT=null;opTeamCd=[0,0];IDX=new Map();
 for(const k in sayAt)delete sayAt[k];for(const u of units)u._lgIn=null;return orig(...a)});
wrap('update',(orig,dt)=>{if(!S.on||typeof started==='undefined'||!started||ended||!(dt>0))return orig(dt);
 let t0=perf(),g=null;try{g=plankPre()}catch(e){fail(e)}
 let t1=perf();try{orig(dt)}finally{t1=perf()-t1;try{plankPost(g,dt)}catch(e){fail(e)}}
 try{tick(dt)}catch(e){fail(e)}
 const ms=perf()-t0-t1,P=S.perf;P.n++;P.sum+=ms;if(ms>P.max)P.max=ms});
wrap('explode',(orig,x,y,r,power=100,team=0)=>{orig(x,y,r,power,team);if(!S.on)return;try{
 cutAt(x,y,r,power);
 let moved=false;for(const p of PL){if(p.dead)continue;const d=hyp(p.x-x,p.y-y);if(d>r+8)continue;p.hp-=power*(1-d/(r+8));if(p.hp<=0){p.dead=true;p.spr=null;DEB.push(p);if(DEB.length>40)DEB.shift();S.stats.plankBroken++;moved=true}}if(moved)rebuildPlanks();
 for(const k of KIT){const d=hyp(k.x-x,k.y-y);if(d>=r+10)continue;k.hp-=power*(1-d/(r+10))*1.2;if(k.hp<=0&&!k.wreck){k.wreck=1;k.s.wreck=1;k.s.sk='';if(k.team===playerTeam)note('kitD','Cozinha de campanha destruída.',6)}}
 for(const p of SNP){const d=hyp(p.x-x,p.y-y);if(d>=r+8)continue;p.hp-=power*(1-d/(r+8))*.8;if(p.hp<=0&&!p.wreck){p.wreck=1;p.s.wreck=1;p.s.sk='';if(p.res!=null){const u=byId(p.res);if(u){u.lgPost=null;if(u.manualUntil===u.lgStamp)u.manualUntil=0}}if(p.team===playerTeam)note('snpD','Posto de franco-atirador destruído.',6)}}}catch(e){fail(e)}});
/* desenho: trechos prontos de passadiço e telefone (saíram de PXSAP.segs), fumaça da chaminé e lâmpada piscando nas linhas cortadas do jogador */
function drawUnder(c,ox,oy){
 const m=22;
 for(const p of DEB){const x=ox+Math.round(p.x*Z),y=oy+Math.round(p.y*Z);if(x<-m||y<-m||x>vw+m||y>vh+m)continue;const sp=p.spr||(p.spr=plankSpr(p.s));c.drawImage(sp,x-(sp.width>>1),y-(sp.height>>1))}
 for(const p of PL){const x=ox+Math.round(p.x*Z),y=oy+Math.round(p.y*Z);if(x<-m||y<-m||x>vw+m||y>vh+m)continue;const sp=p.spr||(p.spr=plankSpr(p.s));c.drawImage(sp,x-(sp.width>>1),y-(sp.height>>1))}
 for(const r of PH){const x=ox+Math.round(r.x*Z),y=oy+Math.round(r.y*Z);if(x<-m-4||y<-m-8||x>vw+m+4||y>vh+m+8)continue;const sp=r.spr||(r.spr=phoneSpr(r.s));c.drawImage(sp,x-(sp.width>>1),y-(sp.height>>1))}}
function drawOver(c,ox,oy){
 for(const k of KIT){if(k.hp<=0)continue;const x=ox+Math.round(k.x*Z)-1,y=oy+Math.round(k.y*Z)-11;if(x<-20||y<-30||x>vw+20||y>vh+20)continue;
  const wv=window.PXW&&PXW.windVec?PXW.windVec():{x:0,y:0};
  for(let i=0;i<6;i++){const a=((time*.55+i/6+k.x*.013)%1),px=x+Math.round(Math.sin(time*1.6+i*1.9)*1.5+wv.x*a*.05),py=y-Math.round(a*17),sz=1+Math.floor(a*3);c.globalAlpha=(1-a)*.6;c.fillStyle=a<.4?'#d3d6d0':'#9aa09a';c.fillRect(px-(sz>>1),py,sz,sz)}c.globalAlpha=1;
  if(((time*7+k.x)|0)%3)c.fillStyle='#ffb04a',c.fillRect(x-3,y+15,1,1)}
 if(((time*2)|0)%2)for(const r of PH){if(!r.cut||r.dead||r.team!==playerTeam)continue;const x=ox+Math.round(r.x*Z),y=oy+Math.round(r.y*Z)-9;if(x<-5||y<-5||x>vw+5||y>vh+5)continue;c.fillStyle='#14100a';c.fillRect(x-2,y-1,5,5);c.fillStyle='#e0705a';c.fillRect(x-1,y,3,3)}}
if(window.WW1A){const u0=WW1A.under,o0=WW1A.over;WW1A.under=function(c,ox,oy,dt){u0.call(this,c,ox,oy,dt);if(!S.on)return;try{drawUnder(c,ox,oy)}catch(e){fail(e)}};
 WW1A.over=function(c,ox,oy,dt){o0.call(this,c,ox,oy,dt);if(!S.on)return;try{drawOver(c,ox,oy)}catch(e){fail(e)}}}

S.state=()=>{recompute();return{on:S.on,planks:PL.filter(p=>!p.dead).length,
 phone:[0,1].map(t=>({segs:PH.filter(r=>r.team===t&&!r.dead).length,cut:PH.filter(r=>r.team===t&&r.cut).length,hq:hqLinked(t),ops:(NET[t]?NET[t].T.filter(q=>q.k==='op').map(q=>termLinked(t,q)):[])})),
 kitchens:KIT.filter(k=>k.hp>0).map(k=>({team:k.team,hp:Math.round(k.hp),fed:Math.round(k.fed)})),
 snipers:SNP.filter(p=>p.hp>0).map(p=>({team:p.team,hp:Math.round(p.hp),manned:!!p.occ,reserved:p.res!=null})),
 pending:PEND.length,projects:MINE.filter(m=>!m.p.done).map(m=>({team:m.team,kind:m.kind})),stats:{...S.stats},perf:{n:S.perf.n,avgMs:S.perf.n?+(S.perf.sum/S.perf.n).toFixed(4):0,maxMs:+S.perf.max.toFixed(3)}}};
S.planks=()=>PL;S.phones=()=>PH;S.kitchens=()=>KIT;S.snipers=()=>SNP;S.mine=()=>MINE;S.pending=()=>PEND;S.net=t=>{recompute();return NET[t]};
S.cutRec=cutRec;S.cutAt=cutAt;S.recompute=recompute;S.plankAt=plankAt;S.rebuildPlanks=rebuildPlanks;S.tick=tick;S.kitchenTick=kitchenTick;S.sniperTick=sniperTick;S.garrison=garrison;S.occupants=occupants;
S.aiPlan=aiPlan;S.opFire=opFire;S.spotters=spotters;S.isLinked=isLinked;S.repairs=repairs;S.phoneLink=phoneLink;S.planksAI=planks;S.kitchenAI=kitchen;S.sniperAI=sniper;S.startProject=startProject;S.sprites={plankSpr,phoneSpr,kitchenSpr,sniperSpr};
if(window.IronFront)window.IronFront.worksLogistics=S;
})();
