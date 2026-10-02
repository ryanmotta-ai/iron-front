'use strict';
/* Iron Front 1.9.2 — obras defensivas contra ataque (works-defense.js). Carrega DEPOIS de works.js. Usa o catálogo do
   sappers/fortify (PXSAP.cfg.KIND + PXFORT.KINDS/SHORT/SUB + planExtra): as obras aparecem na aba DEFESAS e os pioneiros as
   constroem em estágios como as outras. Só atinge o INIMIGO (a regra do arame no game.js): as tropas do dono passam sem efeito.
   Campo minado ..... (◈18/trecho, 6 s por trecho de 30 px, 3 minas por trecho) minas escondidas: só o dono as vê. Pisou (infantaria
                      e cavalaria: raio 9–12 px, varredura do passo; tanque: 19 px) → explode() real (r30, potência 115); contra
                      tanque, esteira rompida: imobilizado ~10 s + dano. Obus/granada/projétil de tanque a até 75% do raio
                      detona as minas (fila, no quadro seguinte). Quem detona um campo o revela ao lado atingido; pioneiros inimigos a
                      menos de 48 px e postos de observação a menos de 240 px também revelam. Minas reveladas ganham bandeirola.
                      O dono recebe "Mina detonada no setor …".
   Desminar .......... (grátis, ◈0) pioneiros varrem um raio de 36 px em 7 s (3 homens): cada mina tem 10% de explodir no rosto
                      deles. A IA desmina campos já revelados perto de suas tropas.
   Valo anticarro .... (◈14/trecho de 36 px, 2 estágios: 8 s + 18 s) tanque inimigo que entra fica atolado: ×0,15 por 7–9 s e 35% de
                      chance de encalhar (×0). Depois ganha 7 s de folga para sair. Infantaria atravessa a ×0,7 (cavalo ×0,55).
   Ouriços ........... (◈24 por peça, 2 estágios: 7 s + 16 s) aço e concreto, 1400 de vida, caixa sólida de 26 px que os tanques
                      inimigos não atravessam (deslizam pela borda, a física faz o contorno); infantaria passa e o tiro também.
   IA: na trégua põe 3 campos nas passagens do arame, 2 valos nas estradas laterais e 2 filas de ouriços (≈ ◈ 340 por lado, pri
   54–57 do plano). Na guerra: tanques inimigos a menos de 800 px → valo à frente da linha; grupo de 6+ a pé → campo minado; com
   2+ tanques → ouriços; desmina; e pede 3 tiros de artilharia (◈70) contra tanque imobilizado/encalhado à vista. Só gasta com a caixa
   acima da reserva de obras (IronFrontEngineering), com 3+ pioneiros livres, no máximo 1 obra de reação por vez (cooldown de 25 s) e
   respeita tetos por facção, independentes do sandbox. Obra de reação sem equipe em 30 s é cancelada e devolvida.
   Os tanques desviam dos ouriços por um caminho planejado (pv.path da física) que evita ruínas/bunkers e troca de lado se travar.
   ?defesas=0 desliga · IronFront.worksDefense.state(). */
(function(){
if(!window.PXSAP||!window.PXFORT||!PXSAP.cfg||!PXSAP.cfg.KIND||!Array.isArray(PXFORT.KINDS))return;
const SAP=PXSAP,K=SAP.cfg.KIND,F=PXFORT,hyp=Math.hypot,mf=Math.floor,mn=Math.min,mx=Math.max,ab=Math.abs,Z=(window.PX&&PX.Z)||.5;
const rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>v<a?a:v>b?b:v;
const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('works-defense.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};

const CFG={
 MINE:{per:3,trig:9,trigCav:12,trigTank:19,r:30,power:115,rTank:30,pTank:70,tankDmg:45,immob:[9,11.5],detect:48,opR:240,
  grace:3,chainR:40,chainP:60,chainF:.75,max:120,perFrame:6,accident:.10,sweep:36,cell:48},
 DITCH:{hw:13,tankF:.15,bog:[7,9],beach:.35,cool:7,inf:.7,cav:.55},
 HEDGE:{hp:1400,half:13,rc:24,k:.8},
 AI:{every:4,react:25,art:35,artCost:70,artRange:700,cap:{mines:90,ditch:14,hedge:12}}
};
const S=window.PXDEF={on:!/[?&]defesas=0/.test(location.search),version:'1.9.2',cfg:CFG,
 stats:{laid:0,triggered:0,killsEnemy:0,killsFriendly:0,tanksImmob:0,bogged:0,beached:0,ditches:0,hedges:0,hedgesBroken:0,tankBlocks:0,detours:0,detourBreaks:0,demined:0,accidents:0,chain:0,aiMines:0,aiDitch:0,aiHedge:0,aiDemine:0,aiArt:0,aiCancel:0,errors:0}};
let MINES=[],DIT=[],HDG=[],PEND=[],GRID=new Map(),MG=new Map(),dirtyG=true,dirtyM=true,mid=0,errs=0,detT=0,aiT=2,DEM=new Set(),lastPT=-1;
let nextReact=[0,0],nextDem=[0,0],nextArt=[0,0],said={};
function fail(e){S.stats.errors++;if(++errs<=3)console.error('works-defense.js:',e);if(errs>=12){S.on=false;console.error('works-defense.js desligado após erros repetidos')}}
const done=s=>{const it=s.p&&s.p.item;if(it){it.done=true;it.seg=s}};
function note(key,msg,gap=3){if(typeof time==='undefined'||time-(said[key]??-99)<gap)return;said[key]=time;try{toast(msg)}catch{}}
const sector=y=>y<533?'NORTE':y<1066?'CENTRO':'SUL';
const minesOf=t=>{let n=0;for(const m of MINES)if(m.team===t)n++;return n};
const hdgOf=t=>{let n=0;for(const h of HDG)if(h.team===t)n++;return n};
const ditOf=t=>{let n=0;for(const d of DIT)if(d.team===t)n++;return n};
const cashOk=(t,c,extra=0)=>{if(typeof sandbox!=='undefined'&&sandbox)return true;const E=window.IronFrontEngineering,res=Math.max(200,(E&&E.state&&E.state(t)&&E.state(t).reserve)||0);return supplies[t]>=c+res+extra};
const pay=(t,c)=>{if(sandbox||!c)return true;if(supplies[t]<c)return false;supplies[t]-=c;return true};

/* ======================================================================================
   SPRITES (pixel art em px de arte; o sappers.js desenha o sprite do trecho centrado na obra)
   ====================================================================================== */
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const R=(g,x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(x,y,w,h)};
const hsh=(i,j)=>((i*73856093^j*19349663)>>>0)%97/97;
const EMPTY=mk(1,1);
const SPR=new Map(),spr=(k,f)=>{let c=SPR.get(k);if(!c){c=f();SPR.set(k,c)}return c};
function ln(g,x0,y0,x1,y1,col,th){const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0))|0;g.fillStyle=col;for(let i=0;i<=n;i++){const f=n?i/n:0;g.fillRect(Math.round(x0+(x1-x0)*f),Math.round(y0+(y1-y0)*f),th||1,th||1)}}
const nrm=(ax,ay,fc)=>{let nx=-ay,ny=ax;if(nx*fc<0||(Math.abs(nx)<1e-6&&ny<0)){nx=-nx;ny=-ny}return[nx,ny]};
const isIcon=s=>!s.p||!s.p.id;
const fr0=s=>clamp(s.work/((s.need&&s.need[Math.min(s.stage|0,s.need.length-1)])||1),0,1);

/* trecho de valo anticarro: 13 px de arte de largura (26 do mundo), berma de terra do lado do inimigo */
function ditchSpr(s){const st=s.stage|0,fr=st>=s.need.length?1:fr0(s),ax=s.ax??1,ay=s.ay??0,len=s.len||36,fc=s.team?-1:1;
 const key='dit|'+st+'|'+(st?0:Math.floor(fr*5))+'|'+Math.round(ax*6)+','+Math.round(ay*6)+'|'+Math.round(len)+'|'+fc;
 return spr(key,()=>{const L=Math.ceil(len*Z)+4,sz=L+20,c=mk(sz,sz),g=c.getContext('2d'),o=sz/2,[nx,ny]=nrm(ax,ay,fc);
  const px=(x,y,col)=>{g.fillStyle=col;g.fillRect(Math.round(x),Math.round(y),1,1)},lit=w=>(-nx*w-ny*w)>0;
  for(let t=-L/2;t<=L/2;t+=.5)for(let w=-9.5;w<=9.5;w+=.5){const x=o+ax*t+nx*w,y=o+ay*t+ny*w,aw=Math.abs(w),i=Math.round(t*2),j=Math.round(w*2),n=hsh(i+50,j+50);
   if(st===0){if(aw>=6.3&&aw<6.9&&(Math.round(t)&1))px(x,y,'#d9e0a6');else if(aw<=5&&t<-L/2+fr*L)px(x,y,n<.5?'#4a3b28':'#56452f');continue}
   if(st===1){if(aw<=3.5)px(x,y,n<.5?'#2b231a':'#33291e');else if(aw<=5.8)px(x,y,lit(w)?'#4a3c2a':'#2f261c');
    else if(w>0&&aw<=9&&n<.85)px(x,y,n<.45?'#7c6a4a':'#6d5b3f');else if(w<0&&aw<=7.4&&n<.4)px(x,y,'#5f4f36');continue}
   if(aw<=3.6)px(x,y,n<.3?'#231c15':'#191410');
   else if(aw<=6.2)px(x,y,lit(w)?(n<.5?'#56462f':'#4d3f2b'):(n<.5?'#2a2218':'#1f1912'));
   else if(w>0&&aw<=9.2&&n<.9)px(x,y,aw<7?'#8a7656':n<.45?'#7c6a4a':'#6d5b3f');
   else if(w<0&&aw<=7.4&&n<.3)px(x,y,'#57492f')}
  if(st>=2)for(let t=-L/2+3;t<=L/2-2;t+=8){const x=Math.round(o+ax*t-nx*7.6),y=Math.round(o+ay*t-ny*7.6);R(g,x,y-2,1,3,'#2a2117');R(g,x,y-3,1,2,'#6b4a2c')}
  return c})}
/* ouriço de aço e concreto (peça de 13 px de arte = 26 do mundo) */
function hedgeSpr(s){const st=s.wreck?9:s.stage|0,fr=st>=s.need.length?1:fr0(s);
 return spr('hdg|'+st+'|'+(st===0?Math.floor(fr*4):0),()=>{const c=mk(16,16),g=c.getContext('2d');
  if(st===9){R(g,3,12,10,2,'#0f100c');R(g,3,10,10,3,'#6b6d62');R(g,4,9,4,2,'#8f9183');ln(g,2,4,6,9,'#33382f',2);ln(g,12,3,9,8,'#33382f',2);R(g,9,7,3,2,'#7a5a3a');return c}
  if(st===0){g.fillStyle='#d9e0a6';for(let x=1;x<15;x+=2){g.fillRect(x,1,1,1);g.fillRect(x,14,1,1)}for(let y=1;y<15;y+=2){g.fillRect(1,y,1,1);g.fillRect(14,y,1,1)}R(g,3,7,Math.round(10*fr),2,'#bdb595');return c}
  R(g,3,13,10,2,'#0f100c');R(g,4,11,8,3,'#9a9c8e');R(g,4,11,8,1,'#c3c5b4');R(g,4,13,8,1,'#6a6c60');
  if(st===1){ln(g,3,10,9,8,'#33382f',2);ln(g,8,9,13,10,'#4a5046',2);R(g,6,7,3,1,'#6f756b');return c}
  ln(g,2,12,12,1,'#33382f',2);ln(g,3,1,13,12,'#33382f',2);R(g,7,1,2,12,'#3c403a');          // três vigas cruzadas
  ln(g,3,11,11,2,'#6f756b',1);ln(g,4,2,12,11,'#5c6358',1);R(g,7,2,1,10,'#7d8478');
  R(g,6,6,4,3,'#272a24');R(g,7,6,2,1,'#8f9788');
  for(const[x,y]of[[2,12],[12,1],[3,1],[13,12],[7,1]])R(g,x,y,1,1,'#7a5a3a');return c})}
/* campo minado: no mundo só o canteiro do dono (fita e estacas). Pronto, o trecho some: as minas são desenhadas à parte */
function mineIconSpr(){return spr('mineIcon',()=>{const c=mk(28,16),g=c.getContext('2d');R(g,0,13,28,1,'#2a2519');
 for(const x of[4,12,20]){R(g,x,9,7,5,'#1f231b');R(g,x+1,8,5,6,'#4a4f3c');R(g,x+2,9,3,3,'#7d8466');R(g,x+3,10,1,1,'#c9d0a8')}
 R(g,24,1,1,12,'#6b4a2c');R(g,25,1,3,3,'#d04a3a');return c})}
function minesSpr(s){const st=s.stage|0;if(isIcon(s))return mineIconSpr();if(st>=1||s.team!==playerTeam)return EMPTY;
 const fr=fr0(s),ax=s.ax??0,ay=s.ay??1,len=s.len||30,key='mnb|'+Math.floor(fr*5)+'|'+Math.round(ax*6)+','+Math.round(ay*6)+'|'+Math.round(len);
 return spr(key,()=>{const L=Math.ceil(len*Z)+6,sz=L+10,c=mk(sz,sz),g=c.getContext('2d'),o=sz/2;
  for(let t=-L/2;t<=L/2;t+=2){const x=Math.round(o+ax*t),y=Math.round(o+ay*t);R(g,x,y,1,1,((t+L)/2|0)%2?'#d04a3a':'#e8e4c8')}
  for(const t of[-L/2,L/2]){const x=Math.round(o+ax*t),y=Math.round(o+ay*t);R(g,x,y-3,1,4,'#6b4a2c');R(g,x,y-3,2,1,'#d04a3a')}
  R(g,2,sz-3,Math.round((sz-4)*fr),1,'#bdb595');return c})}
/* desminar: anel tracejado do raio da varredura (36 px do mundo) */
function demineIconSpr(){return spr('demIcon',()=>{const c=mk(26,20),g=c.getContext('2d');
 for(let a=0;a<28;a+=2){const x=13+Math.round(Math.cos(a/28*6.283)*11),y=10+Math.round(Math.sin(a/28*6.283)*8);R(g,x,y,1,1,'#d9e0a6')}
 R(g,9,12,7,5,'#1f231b');R(g,10,11,5,6,'#4a4f3c');R(g,11,12,3,3,'#7d8466');R(g,12,13,1,1,'#c9d0a8');ln(g,19,3,14,10,'#9aa0a0',1);R(g,19,2,3,2,'#d04a3a');return c})}
function demineSpr(s){const st=s.stage|0;if(isIcon(s))return demineIconSpr();if(st>=1)return EMPTY;const fr=fr0(s),k='dmb|'+Math.floor(fr*8);
 return spr(k,()=>{const R0=Math.round(CFG.MINE.sweep*Z),sz=R0*2+8,c=mk(sz,sz),g=c.getContext('2d'),o=sz>>1;
  for(let a=0;a<48;a++){const x=o+Math.round(Math.cos(a/48*6.283)*R0),y=o+Math.round(Math.sin(a/48*6.283)*R0);if(a&1)R(g,x,y,1,1,'#d9e0a6')}
  for(let a=0;a<48*fr;a++){const x=o+Math.round(Math.cos(a/48*6.283-1.57)*(R0-3)),y=o+Math.round(Math.sin(a/48*6.283-1.57)*(R0-3));R(g,x,y,1,1,'#bdb595')}
  R(g,o,o-3,1,7,'#6b4a2c');R(g,o+1,o-3,3,2,'#d9e0a6');return c})}
/* sprite de uma mina no chão: a sua vista (sem bandeira) e a do inimigo que a descobriu (com bandeirola) */
const MINE_OWN=()=>spr('mineOwn',()=>{const c=mk(9,7),g=c.getContext('2d');R(g,1,1,7,5,'#1f231b');R(g,2,0,5,7,'#1f231b');R(g,2,1,5,5,'#4a4f3c');R(g,3,2,3,3,'#7d8466');R(g,4,3,1,1,'#c9d0a8');return c});
const MINE_REV=()=>spr('mineRev',()=>{const c=mk(12,15),g=c.getContext('2d');R(g,1,9,7,5,'#1f231b');R(g,2,8,5,7,'#1f231b');R(g,2,9,5,5,'#4a4f3c');R(g,3,10,3,3,'#7d8466');R(g,4,11,1,1,'#c9d0a8');
 R(g,8,1,1,11,'#6b4a2c');R(g,9,1,3,3,'#d04a3a');R(g,9,1,3,1,'#f08a74');return c});

/* ======================================================================================
   CATÁLOGO
   ====================================================================================== */
function layMines(s){const t=s.team,C=CFG.MINE;if(minesOf(t)+C.per>C.max){done(s);note('mcap'+t,'Estoque de minas esgotado: o trecho ficou sem minas.');return}
 const ax=s.ax??0,ay=s.ay??1,len=s.len||30,fid=(s.p&&s.p.id)||0;
 for(let i=0;i<C.per;i++){const u=((i+.5)/C.per-.5)*len,w=rnd(-5,5);
  MINES.push({id:++mid,team:t,x:clamp(s.x+ax*u-ay*w+rnd(-1.5,1.5),20,W-20),y:clamp(s.y+ay*u+ax*w+rnd(-1.5,1.5),20,H-20),f:fid,rev:[false,false],t0:time})}
 dirtyM=true;S.stats.laid+=C.per;done(s)}
function addDitch(s){DIT.push({k:'d',s,team:s.team,x:s.x,y:s.y,ax:s.ax??1,ay:s.ay??0,len:s.len||36,hw:CFG.DITCH.hw});dirtyG=true;S.stats.ditches++;done(s)}
function addHedge(s){HDG.push({k:'h',s,team:s.team,x:s.x,y:s.y,hp:CFG.HEDGE.hp,max:CFG.HEDGE.hp,half:CFG.HEDGE.half});dirtyG=true;S.stats.hedges++;done(s)}
/* desminar: varre o raio, cada mina inimiga tem chance de explodir no rosto dos pioneiros */
function sweep(s){const t=s.team,C=CFG.MINE;let n=0,acc=0;
 for(const m of MINES.slice()){if(m.team===t||hyp(m.x-s.x,m.y-s.y)>C.sweep)continue;n++;
  if(Math.random()<C.accident){acc++;S.stats.accidents++;detonate(m,null,'acidente')}else{m.dead=true;MINES.splice(MINES.indexOf(m),1);S.stats.demined++}}
 if(n)dirtyM=true;done(s);
 if(t===playerTeam)note('sw'+t,n?(acc?`Desminagem: ${n-acc} desarmada${n-acc===1?'':'s'}, ${acc} explodiu${acc===1?'':'ram'} nos pioneiros!`:`Desminagem concluída: ${n} mina${n===1?'':'s'} desarmada${n===1?'':'s'}.`):'Desminagem concluída: nenhuma mina na área.',1)}
Object.assign(K,{
 mines:{need:[6],target:1,cost:18,line:1,noAnchor:1,label:'Campo minado (escondido do inimigo): arraste uma linha',sprite:minesSpr,onStage:(s,st)=>{if(st===1)layMines(s)}},
 demine:{need:[7],target:1,cost:0,label:'Desminar (varre 36 px; risco de explosão): clique',box:{hw:14,hh:14},sprite:demineSpr,onStage:(s,st)=>{if(st===1)sweep(s)}},
 ditch:{need:[8,18],target:2,cost:14,line:1,noAnchor:1,step:36,label:'Valo anticarro (atola tanques): arraste uma linha',sprite:ditchSpr,onStage:(s,st)=>{if(st===2)addDitch(s)}},
 hedgehog:{need:[7,16],target:2,cost:24,line:1,noAnchor:1,step:28,label:'Ouriços de aço e concreto (param tanques): arraste uma linha',sprite:hedgeSpr,onStage:(s,st)=>{if(st===2)addHedge(s)}}});
const MY=['mines','ditch','hedgehog','demine'];
for(const k of MY)if(!F.KINDS.includes(k))F.KINDS.push(k);
Object.assign(F.SHORT,{mines:'Minas',ditch:'Valo',hedgehog:'Ouriços',demine:'Desminar'});
Object.assign(F.SUB,{mines:'Escondidas · ◈/trecho',ditch:'Atola tanques · ◈/trecho',hedgehog:'Param tanques · ◈/peça',demine:'Pioneiros varrem a área'});
/* plano da IA na trégua: minas nas passagens do arame (x = FX+115), valos nas estradas laterais e ouriços na estrada central e entre elas */
if(Array.isArray(F.planExtra))F.planExtra.push((t,FX,fc)=>{const it=[];if(!S.on)return it;
 for(const[a,b]of[[396,444],[776,824],[1166,1214]])it.push({kind:'mines',pts:[[FX+fc*115,a],[FX+fc*115,b]],pri:57});
 for(const[a,b]of[[330,430],[1170,1270]])it.push({kind:'ditch',pts:[[FX+fc*88,a],[FX+fc*88,b]],pri:54});
 for(const[a,b]of[[758,842],[560,644]])it.push({kind:'hedgehog',pts:[[FX+fc*66,a],[FX+fc*66,b]],pri:56});
 return it});

/* ======================================================================================
   ÍNDICES ESPACIAIS (rebuild só quando uma obra nasce ou cai)
   ====================================================================================== */
function rebuild(){GRID.clear();
 const add=(o,r)=>{for(let cx=Math.floor((o.x-r)/64);cx<=Math.floor((o.x+r)/64);cx++)for(let cy=Math.floor((o.y-r)/64);cy<=Math.floor((o.y+r)/64);cy++){const k=cx*1000+cy;let a=GRID.get(k);if(!a)GRID.set(k,a=[]);a.push(o)}};
 for(const d of DIT)add(d,d.len/2+d.hw+4);for(const h of HDG)add(h,h.half+CFG.HEDGE.rc+4);dirtyG=false}
function rebuildM(){MG.clear();const c=CFG.MINE.cell;for(const m of MINES){const k=Math.floor(m.x/c)*1000+Math.floor(m.y/c);let a=MG.get(k);if(!a)MG.set(k,a=[]);a.push(m)}dirtyM=false}
function ditchAt(u){const l=GRID.get(mf(u.x/64)*1000+mf(u.y/64));if(!l)return null;
 for(const o of l){if(o.k!=='d'||o.team===u.team)continue;const dx=u.x-o.x,dy=u.y-o.y,al=dx*o.ax+dy*o.ay,ac=-dx*o.ay+dy*o.ax;if(ab(al)<=o.len/2+2&&ab(ac)<=o.hw)return o}return null}
/* ouriço: círculo do tanque contra a caixa; empurra para fora, tira a parte da velocidade que entra e avisa a física (steerAround desliza pela borda) */
function hedgePush(u){const l=GRID.get(mf(u.x/64)*1000+mf(u.y/64));if(!l)return;const rc=CFG.HEDGE.rc;let hit=false;
 for(let it=0;it<2;it++){let any=false;
  for(const o of l){if(o.k!=='h'||o.team===u.team||o.hp<=0)continue;const px=clamp(u.x,o.x-o.half,o.x+o.half),py=clamp(u.y,o.y-o.half,o.y+o.half);let dx=u.x-px,dy=u.y-py;const d2=dx*dx+dy*dy;if(d2>=rc*rc)continue;
   let nx,ny,pen;if(d2>1e-6){const d=Math.sqrt(d2);nx=dx/d;ny=dy/d;pen=rc-d}
   else{const l0=u.x-(o.x-o.half),r0=o.x+o.half-u.x,t0=u.y-(o.y-o.half),b0=o.y+o.half-u.y,m=Math.min(l0,r0,t0,b0);if(m===l0){nx=-1;ny=0}else if(m===r0){nx=1;ny=0}else if(m===t0){nx=0;ny=-1}else{nx=0;ny=1}pen=m+rc}
   u.x=clamp(u.x+nx*pen,15,W-15);u.y=clamp(u.y+ny*pen,15,H-15);any=hit=true;
   const pv=u.pv;if(pv){const vn=pv.vx*nx+pv.vy*ny;if(vn<0){pv.vx-=vn*nx;pv.vy-=vn*ny}const kn=pv.kx*nx+pv.ky*ny;if(kn<0){pv.kx-=kn*nx;pv.ky-=kn*ny}
    const c0=Math.cos(pv.hdg||0),s0=Math.sin(pv.hdg||0);if(pv.sp*(c0*nx+s0*ny)<0)pv.sp*=.85;pv.cnx=nx;pv.cny=ny;pv.cT=time}}
  if(!any)break}
 if(hit){const w=u.wdf||(u.wdf={imm:0,bog:0,beach:false,cool:0});if(!(w.hedgeT>time)){S.stats.tankBlocks++}w.hedgeT=time+1.5}}

/* desvio: o tanque que vai bater numa fila de ouriços ganha um caminho (pv.path, o mesmo que a física segue) pela ponta mais curta */
function segBox(x0,y0,x1,y1,bx0,by0,bx1,by1){let t0=0,t1=1;const dx=x1-x0,dy=y1-y0;
 for(const[p,d,lo,hi]of[[x0,dx,bx0,bx1],[y0,dy,by0,by1]]){if(ab(d)<1e-9){if(p<lo||p>hi)return false}else{let a=(lo-p)/d,b=(hi-p)/d;if(a>b){const q=a;a=b;b=q}if(a>t0)t0=a;if(b<t1)t1=b;if(t0>t1)return false}}return true}
/* sólidos da física (bunker, ruína, tronco grosso) como caixas infladas pelo raio do tanque: o desvio não pode passar por dentro deles */
function solidsNear(u){let st=null;try{st=window.PHYS&&PHYS.on&&PHYS.statics?PHYS.statics():null}catch{}if(!st)return null;const r=[];
 for(const q of st){if(ab(q.x-u.x)>460||ab(q.y-u.y)>460)continue;if(q.k==='bunker'||q.k==='ruin')r.push([q.mx0,q.my0,q.mx1,q.my1]);else if(q.k==='tree'&&q.thick)r.push([q.x-q.r,q.y-q.r,q.x+q.r,q.y+q.r])}
 return r}
function blockedSeg(ax,ay,bx,by,sol,rc){if(!sol)return false;for(const b of sol)if(segBox(ax,ay,bx,by,b[0]-rc,b[1]-rc,b[2]+rc,b[3]+rc))return true;return false}
function detour(u,now){const pv=u.pv;if(!pv||!(u.order==='move'||u.order==='attack'||u.order==='retreat'))return;
 const w=u.wdf;if(w&&(w.imm>now||w.bog>now))return;
 if(pv._dp>now){                                    // desvio em curso: sem sair do lugar por 4 s = lado bloqueado → proíbe-o e replaneja
  const q=pv._dpp;if(q&&now-q.t>=4){if(hyp(u.x-q.x,u.y-q.y)<10){pv._ban=pv._side;pv._banT=now+25;pv._dp=0;pv.path=null;S.stats.detourBreaks++}else{q.x=u.x;q.y=u.y;q.t=now}}
  if(pv._dp>now)return}
 let near=null;for(const h of HDG){if(h.team===u.team||h.hp<=0)continue;if(ab(h.x-u.x)<270&&ab(h.y-u.y)<270)(near||(near=[])).push(h)}if(!near)return;
 const H0=CFG.HEDGE,tx=u.tx,ty=u.ty,dx=tx-u.x,dy=ty-u.y,L=hyp(dx,dy);if(L<30)return;
 const ex=dx/L,ey=dy/L,reach=mn(L,260),R0=H0.half+H0.rc+5;let hit=null;
 for(const h of near)if(segBox(u.x,u.y,u.x+ex*reach,u.y+ey*reach,h.x-R0,h.y-R0,h.x+R0,h.y+R0)){hit=h;break}
 if(!hit)return;
 const cl=[hit],seen=new Set(cl);for(let i=0;i<cl.length;i++)for(const h of HDG)if(h.team===hit.team&&h.hp>0&&!seen.has(h)&&hyp(h.x-cl[i].x,h.y-cl[i].y)<=2*H0.half+10){seen.add(h);cl.push(h)}
 const nx=-ey,ny=ex;let smin=1e9,smax=-1e9,qc=0;
 for(const h of cl){const sn=(h.x-u.x)*nx+(h.y-u.y)*ny;if(sn<smin)smin=sn;if(sn>smax)smax=sn;qc+=(h.x-u.x)*ex+(h.y-u.y)*ey}qc/=cl.length;
 const M=H0.half+H0.rc+14,M0=H0.half+H0.rc+10,sol=solidsNear(u),rc=H0.rc+3,banned=pv._banT>now?pv._ban:-1;let best=null,bc=1e9,bi=0;
 [smin-M,smax+M].forEach((sn,i)=>{if(i===banned)return;const wx=u.x+ex*(qc-M0)+nx*sn,wy=u.y+ey*(qc-M0)+ny*sn;if(wx<30||wx>W-30||wy<30||wy>H-30)return;
  const x2=wx+ex*2*M0,y2=wy+ey*2*M0;let c=hyp(wx-u.x,wy-u.y)+hyp(tx-wx,ty-wy);
  if(blockedSeg(u.x,u.y,wx,wy,sol,rc)||blockedSeg(wx,wy,x2,y2,sol,rc))c+=1e4;else if(blockedSeg(x2,y2,tx,ty,sol,rc))c+=3e3;   // lado com ruína/bunker/tronco no caminho só como último recurso
  if(c<bc){bc=c;best=[wx,wy];bi=i}});
 if(!best)return;                                                                                // p0 antes da fila (sem raspar a quina) e p1 depois dela
 pv.path=[best,[best[0]+ex*2*M0,best[1]+ey*2*M0],[tx,ty]];pv.pi=0;pv.pathT=now+18;pv._dp=now+mx(3,mn(bc,2e3)/22);pv._side=bi;pv._dpp={x:u.x,y:u.y,t:now};S.stats.detours++}

/* ======================================================================================
   MINAS
   ====================================================================================== */
function reveal(m,team){for(const q of MINES)if(q.f===m.f&&q.f)q.rev[team]=true;m.rev[team]=true}
function dirt(x,y){if(typeof particles==='undefined')return;for(let i=0;i<14&&particles.length<800;i++)particles.push({x:x+rnd(-4,4),y:y+rnd(-4,4),vx:rnd(-90,90),vy:rnd(-110,-10),t:rnd(.3,.9),max:.9,color:i%3?'#5b4a36':'#2f281e',size:rnd(2,4)});
 for(let i=0;i<5&&particles.length<800;i++)particles.push({x,y,vx:rnd(-20,20),vy:rnd(-30,-5),t:rnd(.6,1.3),max:1.3,color:'#8a7d62',size:rnd(4,7)})}
function detonate(m,u,why){if(m.dead)return;m.dead=true;const i=MINES.indexOf(m);if(i>=0)MINES.splice(i,1);dirtyM=true;
 const C=CFG.MINE,tank=!!u&&u.type==='tank',st=S.stats;st.triggered++;
 const near=units.filter(v=>v.hp>0&&!v.down&&(v.x-m.x)**2+(v.y-m.y)**2<12100);
 if(u&&u.team!==m.team)reveal(m,u.team);
 try{explode(m.x,m.y,tank?C.rTank:C.r,tank?C.pTank:C.power,m.team)}catch(e){fail(e)}
 dirt(m.x,m.y);
 let ke=0,kf=0;for(const v of near)if(v.hp<=0||v.down){if(v.team===m.team)kf++;else ke++}
 st.killsEnemy+=ke;st.killsFriendly+=kf;
 if(tank){const w=u.wdf||(u.wdf={imm:0,bog:0,beach:false,cool:0});w.imm=time+rnd(C.immob[0],C.immob[1]);w.immT0=time;w.smoke=0;st.tanksImmob++;
  try{damage(u,C.tankDmg,m.team)}catch(e){fail(e)}
  const pv=u.pv;if(pv){pv.sp=0;pv.vx=pv.vy=0;pv.w=0}}
 const at=`no setor ${sector(m.y)}`;
 if(m.team===playerTeam)note('own'+m.id%7,tank?`Mina detonada ${at} (x ${Math.round(m.x)}): esteira de tanque inimigo rompida.`:ke?`Mina detonada ${at} (x ${Math.round(m.x)}): ${ke} baixa${ke>1?'s':''} inimiga${ke>1?'s':''}.`:`Mina detonada ${at} (x ${Math.round(m.x)}).`,1.2);
 else if(u&&u.team===playerTeam)note('vic',tank?'Seu tanque pisou numa mina: esteira rompida!':'Campo minado inimigo! Cuidado onde pisa.',2.5);
 return{kills:ke,friendly:kf}}
/* inimigo na trilha: varredura do passo (dt grande não pula a mina) */
function mineCheck(u,tank){if(!MINES.length)return;const C=CFG.MINE,r=tank?C.trigTank:u.type==='cavalry'?C.trigCav:C.trig,c=C.cell,x0=u._wx,y0=u._wy,x1=u.x,y1=u.y;
 const ex=x1-x0,ey=y1-y0,L2=ex*ex+ey*ey;
 const cx1=mf((mx(x0,x1)+r)/c),cy1=mf((mx(y0,y1)+r)/c),cy0=mf((mn(y0,y1)-r)/c);
 for(let cx=mf((mn(x0,x1)-r)/c);cx<=cx1;cx++)for(let cy=cy0;cy<=cy1;cy++){
  const l=MG.get(cx*1000+cy);if(!l)continue;
  for(const m of l){if(m.dead||m.team===u.team)continue;const f=L2>1e-6?clamp(((m.x-x0)*ex+(m.y-y0)*ey)/L2,0,1):0,dx=m.x-(x0+ex*f),dy=m.y-(y0+ey*f);if(dx*dx+dy*dy<r*r){detonate(m,u,'pisou');return true}}}
 return false}
/* revela: pioneiros inimigos a 48 px e postos de observação a 240 px */
function detect(){if(!MINES.length)return;if(dirtyM)rebuildM();const C=CFG.MINE,c=C.cell;
 for(const u of units){if(!u.sap||u.hp<=0||u.down)continue;const r=C.detect;
  for(let cx=mf((u.x-r)/c);cx<=mf((u.x+r)/c);cx++)for(let cy=mf((u.y-r)/c);cy<=mf((u.y+r)/c);cy++){const l=MG.get(cx*1000+cy);if(!l)continue;
   for(const m of l)if(!m.dead&&m.team!==u.team&&!m.rev[u.team]&&hyp(m.x-u.x,m.y-u.y)<r)reveal(m,u.team)}}
 const ops=window.PXWORKS&&PXWORKS.ops?PXWORKS.ops():null;
 if(ops&&ops.length)for(const o of ops)for(const m of MINES)if(m.team!==o.team&&!m.rev[o.team]&&hyp(m.x-o.x,m.y-o.y)<C.opR)reveal(m,o.team)}
function demClock(){DEM.clear();for(const p of SAP.projects)if(!p.done&&p.kind==='demine')for(const id of p.crew)DEM.add(id)}

/* ======================================================================================
   LAÇO
   ====================================================================================== */
function smoke(u,w,dt){if(Math.random()>dt*5||particles.length>760)return;
 particles.push({x:u.x+rnd(-8,8),y:u.y+rnd(-6,4),vx:rnd(-8,8),vy:rnd(-26,-12),t:1.3,max:1.3,color:w.imm>time?'#3d3a33':'#6b5a40',size:rnd(4,7)})}
function tankFactor(u,dt){let w=u.wdf;const d=ditchAt(u),D=CFG.DITCH;
 if(w&&w.bog>0&&!w.post&&w.bog<=time){w.post=true;w.cool=time+D.cool}                    // a folga para sair vale já no quadro em que o atoleiro acaba
 if(d&&(!w||(!(w.bog>time)&&!(w.cool>time)))){w=u.wdf||(u.wdf={imm:0,bog:0,beach:false,cool:0});w.bog=time+rnd(D.bog[0],D.bog[1]);w.bogT0=time;w.beach=Math.random()<D.beach;w.post=false;S.stats.bogged++;if(w.beach)S.stats.beached++;
  if(d.team===playerTeam)note('bog','Tanque inimigo '+(w.beach?'encalhou':'atolou')+' no valo anticarro!',2);else if(u.team===playerTeam)note('bogv','Seu tanque atolou no valo anticarro inimigo!',2.5);
  const pv=u.pv;if(pv&&w.beach){pv.sp=0;pv.vx=pv.vy=0}}
 if(!w)return 1;let f=1;
 if(w.imm>time){f=0;smoke(u,w,dt)}
 if(w.bog>time){f=Math.min(f,w.beach?0:D.tankF);if(Math.random()<dt*6&&particles.length<760)particles.push({x:u.x+rnd(-16,16),y:u.y+rnd(-8,10),vx:rnd(-40,40),vy:rnd(-60,-10),t:rnd(.4,.8),max:.8,color:'#3a2c1c',size:rnd(2,4)})}
 else if(w.bog>0&&!w.post){w.post=true;w.cool=time+D.cool}
 return f}
function post(dt){const now=time;
 if(dirtyG)rebuild();if(dirtyM)rebuildM();
 if(lastPT!==playerTeam){lastPT=playerTeam;for(const s of SAP.segs)if(s.kind==='mines')s.sk=''}
 for(let n=0;PEND.length&&n<CFG.MINE.perFrame;n++){const m=PEND.shift();if(!m.dead){S.stats.chain++;detonate(m,null,'obus')}}
 if(dirtyM)rebuildM();
 for(let i=0;i<units.length;i++){const u=units[i];if(u.hp<=0)continue;
  if(u._wx===undefined){u._wx=u.x;u._wy=u.y}
  const tank=u.type==='tank';let f=1;
  if(tank)f=tankFactor(u,dt);else if(DIT.length){const d=ditchAt(u);if(d)f=u.type==='cavalry'?CFG.DITCH.cav:CFG.DITCH.inf}
  if(f<1){const dx=u.x-u._wx,dy=u.y-u._wy;
   if(f<=0){u.x=u._wx;u.y=u._wy;u.moving=false;const pv=u.pv;if(pv){pv.sp=0;pv.vx=pv.vy=0;pv.kx=pv.ky=0;pv.w=0;if(u._wh!==undefined)pv.hdg=u._wh}}
   else{u.x=u._wx+dx*f;u.y=u._wy+dy*f}}
  if(tank&&HDG.length){hedgePush(u);detour(u,now)}
  if(MINES.length&&!u.down&&!DEM.has(u.id)&&!(tank&&u.wdf&&u.wdf.imm+CFG.MINE.grace>now))mineCheck(u,tank)}}
function aiMyProjects(t){let n=0;for(const p of SAP.projects)if(!p.done&&p.team===t&&p.src==='ai'&&MY.includes(p.kind))n++;return n}
function trenchNear(t,y){let best=null,bd=1e9;for(const a of fieldTrenches){if(a.team!==t||(a.line&&a.line!=='front'))continue;const d=Math.abs(a.y-y);if(d<bd){bd=d;best=a}}return best}
const enemiesAt=(t,x,y,r)=>{let n=0;for(const u of units)if(u.team!==t&&u.hp>0&&(u.x-x)**2+(u.y-y)**2<r*r)n++;return n};
const nearObj=(arr,x,y,r)=>{for(const o of arr)if(Math.abs(o.x-x)<r&&Math.abs(o.y-y)<r)return true;return false};
function segCount(pts,kind){const k=K[kind];return SAP._.segment(pts,k.step||SAP.cfg.SEG).length}
function aiOrder(t,kind,pts,key){const n=segCount(pts,kind),cost=n*K[kind].cost;if(!cashOk(t,cost,120))return false;
 let p=null;try{p=SAP.project(t,kind,'ai',pts)}catch(e){fail(e)}if(!p)return false;pay(t,cost);S.stats[key]++;nextReact[t]=time+CFG.AI.react;return true}
/* reação na guerra: valo na frente de acesso de tanques, minas contra massa de infantaria, ouriços com 2+ tanques */
const freePioneers=t=>{let n=0;for(const u of units)if(u.team===t&&u.sap&&u.hp>0&&!u.down&&!u.sapJob)n++;return n};
function aiReact(t){if(time<nextReact[t]||time<60||aiMyProjects(t)>=1||freePioneers(t)<3)return;const fc=t?-1:1,A=CFG.AI.cap;   // sem 3 pioneiros livres a obra ficaria parada ocupando uma vaga da engenharia
 const tanks=units.filter(u=>u.team!==t&&u.type==='tank'&&u.hp>0);
 for(const e of tanks){const a=trenchNear(t,e.y),fx=a?a.x:(t?W-720:720),dx=(e.x-fx)*fc;if(dx<-40||dx>800)continue;
  const sx=fx+fc*rnd(60,95),sy=clamp(e.y,150,H-150);if(Math.abs(e.x-sx)<160)continue;
  if(ditOf(t)+3<=A.ditch&&!nearObj(DIT.filter(d=>d.team===t),sx,sy,110)&&!SAP.projects.some(p=>!p.done&&p.team===t&&p.kind==='ditch'&&p.segs.some(s=>Math.abs(s.x-sx)<110&&Math.abs(s.y-sy)<110))){
   if(aiOrder(t,'ditch',[[sx,sy-54],[sx,sy+54]],'aiDitch'))return}
  if(tanks.length>=2&&hdgOf(t)+3<=A.hedge&&!nearObj(HDG.filter(h=>h.team===t),sx-fc*30,sy,90)){
   if(aiOrder(t,'hedgehog',[[sx-fc*30,sy-42],[sx-fc*30,sy+42]],'aiHedge'))return}
  break}
 if(minesOf(t)+6>A.mines)return;
 const foot=units.filter(u=>u.team!==t&&u.hp>0&&u.type!=='tank'&&u.type!=='cavalry'&&!u.sap);
 for(const e of foot){const a=trenchNear(t,e.y),fx=a?a.x:(t?W-720:720),dx=(e.x-fx)*fc;if(dx<130||dx>700)continue;
  let n=0,cy=0;for(const o of foot)if(Math.abs(o.y-e.y)<150&&Math.abs(o.x-e.x)<160){n++;cy+=o.y}if(n<5)continue;cy/=n;
  const sx=fx+fc*rnd(70,105),sy=clamp(cy,150,H-150);if(enemiesAt(t,sx,sy,200)>=3||nearObj(MINES.filter(m=>m.team===t),sx,sy,90))continue;   // ≥4 inimigos a 200 px fariam o sappers.js abandonar a obra
  if(aiOrder(t,'mines',[[sx,sy-30],[sx,sy+30]],'aiMines'))return}}
/* a IA desmina campos já revelados perto das suas tropas (nunca na trégua; um projeto por vez) */
function aiDemine(t){if(time<nextDem[t]||SAP.projects.some(p=>!p.done&&p.team===t&&p.kind==='demine'))return;
 let best=null,bd=1e9;
 for(const m of MINES){if(m.team===t||!m.rev[t])continue;let d=1e9;for(const u of units)if(u.team===t&&u.hp>0&&!u.sap&&u.type!=='tank'){const q=(u.x-m.x)**2+(u.y-m.y)**2;if(q<d)d=q}
  if(d<450*450&&d<bd){bd=d;best=m}}
 if(!best)return;let sx=0,sy=0,n=0;for(const m of MINES)if(m.team!==t&&m.rev[t]&&hyp(m.x-best.x,m.y-best.y)<CFG.MINE.sweep*.8){sx+=m.x;sy+=m.y;n++}
 let p=null;try{p=SAP.project(t,'demine','ai',[[sx/n,sy/n]])}catch(e){fail(e)}
 nextDem[t]=time+10;if(p)S.stats.aiDemine++}
/* tanque imobilizado ou encalhado à vista vira alvo: 3 tiros de artilharia (◈70), a cada 35 s, sem fogo amigo */
function aiHunt(t){if(time<nextArt[t]||(typeof supportCooldown!=='undefined'&&supportCooldown[t]>0))return;const obs=typeof observationRange==='function'?observationRange():700;
 for(const e of units){if(e.team===t||e.type!=='tank'||e.hp<=0||!e.wdf)continue;const w=e.wdf;if(!(w.imm>time+3||(w.beach&&w.bog>time+3)))continue;
  let seen=false,close=false;for(const u of units)if(u.team===t&&u.hp>0){const d=hyp(u.x-e.x,u.y-e.y);if(d<110){close=true;break}if(d<Math.min(obs,CFG.AI.artRange))seen=true}
  if(close||!seen)continue;if(!cashOk(t,CFG.AI.artCost))continue;if(!pay(t,CFG.AI.artCost))continue;let ok=false;
  try{if(window.PXBAT&&typeof PXBAT.mission==='function')ok=PXBAT.mission(t,e.x,e.y,3,45,'he')}catch(e2){fail(e2)}
  if(!ok)for(let i=0;i<3;i++)shells.push({x:e.x+rnd(-45,45),y:e.y+rnd(-45,45),t:2.4+i*.4,r:55,team:t});
  nextArt[t]=time+CFG.AI.art;if(typeof supportCooldown!=='undefined')supportCooldown[t]=Math.max(supportCooldown[t],12);S.stats.aiArt++;return}}
/* obra da IA que ninguém pegou em 30 s (pioneiros mortos ou ocupados) é cancelada e devolvida, liberando a próxima reação */
function aiGC(){for(const p of SAP.projects){if(p.done||p.src!=='ai'||!MY.includes(p.kind)||p.crew.length||time-p.t0<30||!p.segs.every(s=>s.stage===0&&s.work<=0))continue;
  SAP.cancel(p);if(!sandbox)supplies[p.team]+=p.segs.length*K[p.kind].cost;S.stats.aiCancel++}}
function aiTick(){if(F.isPrep&&F.isPrep())return;aiGC();for(let t=0;t<2;t++){if(!aiEnabled[t])continue;aiDemine(t);aiReact(t);aiHunt(t)}}
/* ---------- ligações ---------- */
wrap('setup',(orig,...a)=>{MINES=[];DIT=[];HDG=[];PEND=[];GRID.clear();MG.clear();dirtyG=dirtyM=true;DEM.clear();nextReact=[0,0];nextDem=[0,0];nextArt=[0,0];said={};detT=0;aiT=2;lastPT=-1;return orig(...a)});
wrap('update',(orig,dt)=>{
 if(!S.on||!started||ended||!(dt>0))return orig(dt);
 try{for(let i=0;i<units.length;i++){const u=units[i];u._wx=u.x;u._wy=u.y;if(u.type==='tank'&&u.pv)u._wh=u.pv.hdg}}catch(e){fail(e)}
 orig(dt);
 try{post(dt);
  if((detT-=dt)<=0){detT=.5;demClock();detect()}
  if(!(F.isPrep&&F.isPrep())&&(aiT-=dt)<=0){aiT=CFG.AI.every;aiTick()}
  if(HDG.length&&HDG.some(h=>h.hp<=0)){for(const h of HDG)if(h.hp<=0&&!h.dead){h.dead=true;S.stats.hedgesBroken++;if(h.s){h.s.wreck=1;h.s.sk=''}for(let i=0;i<10&&particles.length<780;i++)particles.push({x:h.x+rnd(-8,8),y:h.y+rnd(-8,8),vx:rnd(-70,70),vy:rnd(-90,-10),t:rnd(.4,1),max:1,color:i%2?'#7a7c70':'#3c403a',size:rnd(2,4)})}
   HDG=HDG.filter(h=>!h.dead);dirtyG=true}
 }catch(e){fail(e)}});
/* explosão: danifica ouriços e detona minas (fila) com granadas, obus e tiros de tanque; carcaça (potência 0) é ignorada */
wrap('explode',(orig,x,y,r,power=100,team=0)=>{orig(x,y,r,power,team);if(!S.on||!(power>0))return;try{
 for(const h of HDG){const dd=hyp(h.x-x,h.y-y);if(dd>r+14)continue;h.hp-=power*(1-dd/(r+14))*CFG.HEDGE.k}
 if(MINES.length&&r>=CFG.MINE.chainR&&power>=CFG.MINE.chainP)for(const m of MINES)if(!m.queued&&!m.dead&&hyp(m.x-x,m.y-y)<r*CFG.MINE.chainF){m.queued=true;PEND.push(m)}}catch(e){fail(e)}});

/* ---------- desenho ---------- */
const visible=u=>{try{return u.team===playerTeam||!window.PXW||!PXW.visible||PXW.visible(u)}catch{return true}};
function drawMines(c,ox,oy){if(!S.on||!MINES.length)return;const pt=playerTeam,own=MINE_OWN(),rev=MINE_REV();
 for(const m of MINES){const mine=m.team===pt;if(!mine&&!m.rev[pt])continue;const x=ox+Math.round(m.x*Z),y=oy+Math.round(m.y*Z);if(x<-14||y<-18||x>vw+14||y>vh+14)continue;
  if(mine)c.drawImage(own,x-4,y-3);else c.drawImage(rev,x-5,y-12)}}
function drawOver(c,ox,oy){if(!S.on)return;
 for(const u of units){const w=u.wdf;if(!w||u.hp<=0||u.type!=='tank')continue;const imm=w.imm>time,bog=w.bog>time;if(!imm&&!bog)continue;if(!visible(u))continue;
  const x=ox+Math.round(u.x*Z),y=oy+Math.round(u.y*Z)-17;if(x<-12||y<-12||x>vw+12||y>vh+12)continue;
  const left=imm?(w.imm-time)/((w.imm-w.immT0)||10):(w.bog-time)/((w.bog-w.bogT0)||8);
  R(c,x-5,y-3,11,8,'#141712');R(c,x-4,y-2,9,6,imm?'#a83a2a':'#5a4630');
  if(imm){for(let i=0;i<5;i++){R(c,x-2+i,y-1+i,1,1,'#f2e8d0');R(c,x+2-i,y-1+i,1,1,'#f2e8d0')}}
  else{R(c,x-3,y,7,1,'#b9a77a');R(c,x-2,y-1,1,1,'#b9a77a');R(c,x+1,y+1,1,1,'#b9a77a');if(w.beach)R(c,x-3,y+2,7,1,'#3a2c1c')}
  R(c,x-4,y+5,Math.max(1,Math.round(9*clamp(left,0,1))),1,imm?'#e0a080':'#c9b26a')}
 for(const h of HDG){if(h.hp>=h.max*.97)continue;const x=ox+Math.round(h.x*Z),y=oy+Math.round(h.y*Z)-9;if(x<-10||y<-10||x>vw+10||y>vh+10)continue;
  const f=clamp(h.hp/h.max,0,1);R(c,x-5,y,11,3,'#141712');R(c,x-4,y+1,Math.max(1,Math.round(9*f)),1,f>.35?'#c9b26a':'#e0705a')}}
if(window.WW1A){const under=WW1A.under,over=WW1A.over;
 WW1A.under=function(c,ox,oy,dt){under.call(this,c,ox,oy,dt);try{drawMines(c,ox,oy)}catch(e){fail(e)}};
 WW1A.over=function(c,ox,oy,dt){over.call(this,c,ox,oy,dt);try{drawOver(c,ox,oy)}catch(e){fail(e)}}}
/* ícone do cartão (48×48): arte própria; o desenho de fortify.js só entende os tipos dele */
const TRIM=new Map();
/* recorta o sprite à caixa dos pixels visíveis (os sprites de linha têm margem) para o ícone ocupar o cartão */
function trim(sp){let t=TRIM.get(sp);if(t)return t;t={sp,x:0,y:0,w:sp.width,h:sp.height};
 try{const g=sp.getContext('2d'),d=g.getImageData(0,0,sp.width,sp.height).data;let x0=1e9,y0=1e9,x1=-1,y1=-1;
  for(let y=0;y<sp.height;y++)for(let x=0;x<sp.width;x++)if(d[(y*sp.width+x)*4+3]>8){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
  if(x1>=0){t.x=x0;t.y=y0;t.w=x1-x0+1;t.h=y1-y0+1}}catch{}
 TRIM.set(sp,t);return t}
function drawIcon(type,c){const cv=c.canvas,w=cv.width,h=cv.height;c.clearRect(0,0,w,h);c.imageSmoothingEnabled=false;
 let sp=null;
 if(type==='mines')sp=mineIconSpr();else if(type==='demine')sp=demineIconSpr();
 else{const k=K[type],fake={stage:k.target,work:999,need:k.need,len:type==='ditch'?36:28,ax:1,ay:0,team:playerTeam,kind:type,p:null};sp=k.sprite(fake)}
 if(!sp||sp.width<2)return;const t=trim(sp),s=Math.max(1,Math.min(Math.floor((w-8)/t.w),Math.floor((h-10)/t.h),4));
 c.globalAlpha=.95;c.drawImage(sp,t.x,t.y,t.w,t.h,Math.round((w-t.w*s)/2),Math.round((h-t.h*s)/2),t.w*s,t.h*s);c.globalAlpha=1}
wrap('icon',(orig,type,c)=>{if(!MY.includes(type))return orig(type,c);try{drawIcon(type,c)}catch(e){fail(e);orig('wire',c)}});

S.state=()=>({on:S.on,mines:[minesOf(0),minesOf(1)],revealed:[MINES.filter(m=>m.rev[0]&&m.team!==0).length,MINES.filter(m=>m.rev[1]&&m.team!==1).length],ditch:[ditOf(0),ditOf(1)],hedgehogs:[hdgOf(0),hdgOf(1)],
 pending:PEND.length,stuckTanks:units.filter(u=>u.type==='tank'&&u.wdf&&(u.wdf.imm>time||u.wdf.bog>time)).length,projects:SAP.projects.filter(p=>!p.done&&MY.includes(p.kind)).map(p=>({team:p.team,kind:p.kind,src:p.src,crew:p.crew.length})),stats:{...S.stats}});
Object.defineProperties(S,{minesList:{get:()=>MINES},ditches:{get:()=>DIT},hedges:{get:()=>HDG}});
S.detonate=detonate;S.post=post;S.aiTick=aiTick;S.aiReact=aiReact;S.aiDemine=aiDemine;S.aiHunt=aiHunt;S.lay=layMines;S.addDitch=addDitch;S.addHedge=addHedge;S.sweep=sweep;S.detect=detect;S.demClock=demClock;S.rebuild=()=>{rebuild();rebuildM()};
S.draw={mines:drawMines,over:drawOver,icon:drawIcon};
if(window.IronFront)window.IronFront.worksDefense=S;
})();
