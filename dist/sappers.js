'use strict';
/* Iron Front 1.2 — sapadores / pioneiros e fortificação de campo em tempo real.
   Carrega DEPOIS de physics.js (e antes do ui-art.js). Não altera game.js: envolve setup / update / newUnit / protectedBy /
   explode / makeCards / icon e desenha dentro de WW1A.under/over e PHYS.draw, como battery.js e physics.js já fazem.
   Pioneiros são fuzileiros (type 'rifle') com u.sap=1: pás e marretas nas costas, agacham para cavar e deitam quando alvejados.
   Toda obra é um PROJETO (cadeia de segmentos de ~30 px) com 3 estágios por segmento:
     1  vala rasa / toca de raposa ... quem está dentro recebe 30% de redução de dano
     2  trincheira funcional ......... entra em fieldTrenches + trenchGrid (proteção e parapeito do motor, slots da IA)
     3  parapeito de sacos de areia .. newBuilding('sandbag'): obstáculo físico que barra balas e estilhaços (Pilar 2)
   IA: consolida crateras conquistadas (frontline creep), cava sapas em zigue-zague rumo ao centro e repara arame e sacos.
   Jogador: B (modo comandante) alterna ordem de campo: trincheira (arrastar linha) → ninho de MG → posto de morteiro.
   Desliga com ?sapadores=0 na URL ou PXSAP.on=false. Coordenadas em unidades do mundo; desenho em pixels de arte (PX.Z). */
(function(){
if(!window.PX)return;
const Z=PX.Z||.5,hyp=Math.hypot;
const rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>v<a?a:v>b?b:v;
const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('sappers.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};
const rect=(c,x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h)};

/* ---------- parâmetros ---------- */
const CFG={
 SEG:30,                                    // comprimento de um segmento de obra (px do mundo)
 HALFW:8,                                   // meia largura da vala
 KIND:{                                     // trabalho acumulado (s·equipe de 3) para fechar cada estágio · estágio-alvo
  trench:{need:[10,25,40],target:3,cost:10,line:1},
  sap:{need:[10,25],target:2,cost:6,line:1},
  nest:{need:[12,28,45],target:3,cost:110},
  mortar:{need:[12,28,45],target:3,cost:130},
  repair:{need:[12],target:1}},
 CREW:3,                                    // sapadores por projeto
 WORKX:1.6,                                 // multiplicador do ritmo de obra (fortify.js acelera na trégua)
 FIGHT:.35,                                 // quem está trocando tiros ainda contribui um pouco
 STAGE1:.7,                                 // fator de dano dentro da vala rasa (30% de redução)
 PRONE:.75,                                 // fator extra de quem está deitado
 MAXPROJ:{ai:2,player:4},
 MAXSEGS:44,                                // segmentos de trincheira dinâmica por facção (protectedBy varre fieldTrenches)
 MAXBAGS:30,                                // sacos de areia de sapadores por facção
 AI_DT:5,
 SAP_LEGS:7,
 MORTAR:{range:620,min:160,cd:6.5,r:44,power:95},
 SQUAD_START:2                              // esquadrões de 3 pioneiros por facção no início
};
const S=window.PXSAP={on:!/[?&]sapadores=0/.test(location.search),version:'1.2',cfg:CFG,stats:{errors:0},cAt:[-99,-99],boughtAt:[-99,-99]};
let P=[],SEGS=[],POSTS=[],FXD=[],TRK=new Map(),BR=[],FRONT=[724,1676],aiT=[1.5,4],hk=0,sec=0,pid=0,toastAt=0,errs=0;
const UI={mode:null,drag:null};
const face=t=>t?-1:1;
const cost=n=>{try{return defs[n]?defs[n].cost:0}catch{return 0}};
function fail(e){S.stats.errors++;if(++errs<=3)console.error('sappers.js:',e);if(errs>=12){S.on=false;console.error('sappers.js desligado após erros repetidos')}}
function pay(team,n){if(sandbox||!n)return true;if(supplies[team]<n)return false;supplies[team]-=n;return true}
function say(team,msg){if(team!==playerTeam||time-toastAt<2.5)return;toastAt=time;try{toast(msg)}catch{}}

/* ======================================================================================
   GEOMETRIA (pura; testada em tests/sappers.test.cjs)
   ====================================================================================== */
/* polilinha → segmentos de ~step com centro, eixo unitário e comprimento */
function segment(pts,step=CFG.SEG){const out=[];
 for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],dx=b[0]-a[0],dy=b[1]-a[1],L=hyp(dx,dy);if(L<1)continue;
  const n=Math.max(1,Math.round(L/step)),ax=dx/L,ay=dy/L,len=L/n;
  for(let k=0;k<n;k++){const f=(k+.5)/n;out.push({x:a[0]+dx*f,y:a[1]+dy*f,ax,ay,len})}}
 return out}
/* sapa em zigue-zague: pernas diagonais que avançam fx por perna e alternam o lado (±dy) — nunca um corredor reto enfileirável */
function zigzag(x0,y0,fc,legs,first=1,fx=38,dy=48){const pts=[[x0,y0]];let x=x0,y=y0,s=first;
 for(let i=0;i<legs;i++){x+=fc*fx;y+=s*dy;pts.push([x,y]);s=-s}return pts}
/* caixa alinhada que envolve o retângulo girado (meio comprimento hl, meia largura hw) */
function bbox(ax,ay,hl,hw){return{hw:Math.max(10,Math.abs(ax)*hl+Math.abs(ay)*hw),hh:Math.max(10,Math.abs(ay)*hl+Math.abs(ax)*hw)}}
const gkey=(x,y)=>Math.floor(x/128)+','+Math.floor(y/128);          // chave do trenchGrid/coverGrid do game.js
/* ritmo de obra por homens trabalhando: 1 → 45%, 2 → 78%, 3+ → 100% (os estágios de 10/25/40 s valem para 3) */
function rate(k){if(k>3)return 1+Math.min(k-3,4)*.15;k=clamp(k,0,3);return k>=2?.78+(k-2)*.22:k>=1?.45+(k-1)*.33:k*.45}
/* normal do segmento que aponta para o inimigo */
function enemyNormal(ax,ay,fc){let nx=-ay,ny=ax;if(nx*fc<0||(Math.abs(nx)<1e-6&&ny<0)){nx=-nx;ny=-ny}return[nx,ny]}

/* ======================================================================================
   PROJETOS
   ====================================================================================== */
function mkSeg(p,g){const k=CFG.KIND[p.kind],hl=g.len/2,big=!k.line,b=big?(k.box||{hw:20,hh:18}):bbox(g.ax,g.ay,hl,CFG.HALFW);
 const s={id:++pid,p,team:p.team,kind:p.kind,x:clamp(g.x,20,W-20),y:clamp(g.y,20,H-20),ax:g.ax,ay:g.ay,len:g.len,hw:b.hw,hh:b.hh,need:k.need,work:0,stage:0,anchor:null,spr:null,sk:''};
 SEGS.push(s);return s}
function project(team,kind,src,pts,opt={}){
 const k=CFG.KIND[kind];if(!k)return null;
 const geo=k.line?segment(pts,k.step||CFG.SEG):[{x:pts[0][0],y:pts[0][1],ax:0,ay:1,len:CFG.SEG}];
 if(!geo.length)return null;
 const p={id:++pid,team,kind,src,keep:!!opt.keep,line:opt.line||k.anchorLine||'sap',segs:[],crew:[],cur:0,target:k.target,done:false,t0:time,rep:opt.rep||null,extend:!!opt.extend,legs:opt.legs||0,side:opt.side||1,shelled:-99,smoke:false};
 for(const g of geo)p.segs.push(mkSeg(p,g));P.push(p);return p}
const segsOf=team=>{let n=0;for(const s of SEGS)if(s.team===team&&s.anchor)n++;return n};
const bagsOf=team=>{let n=0;for(const s of SEGS)if(s.team===team&&s.bags)n+=s.bags;return n};
const live=team=>P.filter(p=>!p.done&&p.team===team);
function curSeg(p){while(p.cur<p.segs.length&&p.segs[p.cur].stage>=p.target)p.cur++;return p.segs[p.cur]||null}
function release(u){if(!u)return;u.sapJob=null;u.sapState='';if(u.manualUntil===u.sapStamp){u.manualUntil=0;u.order='hold';u.tx=u.x;u.ty=u.y}}
function finish(p){p.done=true;for(const id of p.crew)release(byId(id));p.crew=[];
 if(p.src==='player')say(p.team,p.kind==='trench'?'Trincheira de ligação concluída.':p.kind==='nest'?'Ninho de metralhadora pronto.':p.kind==='mortar'?'Posto de morteiro pronto.':'Obra concluída.')}
function cancel(p){p.done=true;for(const id of p.crew)release(byId(id));p.crew=[];
 SEGS=SEGS.filter(s=>s.p!==p||s.stage>0)}
let IDX=new Map();const byId=id=>IDX.get(id);

/* ---------- estágios ---------- */
/* sacos de areia: numa linha norte-sul a parede fica de frente para o inimigo (vertical, 16×32), não de lado */
function bag(team,x,y,vert,ax=0,ay=1,len=32){const b=newBuilding('sandbag',team,clamp(x,20,W-20),clamp(y,20,H-20));if(vert)lineB(b,ax,ay,len);return b}
/* obra em linha (parapeito, arame): o prédio guarda o eixo e o comprimento do trecho; a caixa de colisão acompanha o eixo e os
   trechos vizinhos se emendam no desenho (o pixel.js não desenha esses — ver wrap de render) */
function lineB(b,ax,ay,len,th){th=th||(b.type==='wire'?12:9);const hl=len/2+2;b.vert=1;b.ax=ax;b.ay=ay;b.len=len;
 b.bw=Math.max(th,Math.abs(ax)*hl+Math.abs(ay)*th);b.bh=Math.max(th,Math.abs(ay)*hl+Math.abs(ax)*th);b._spr=null;return b}
function addAnchor(s,o={}){const team=s.team,a={id:`sap-${team}-${s.id}`,type:'trench',team,x:Math.round(s.x),y:Math.round(s.y),hp:Infinity,hw:o.hw||s.hw,hh:o.hh||s.hh,slots:o.slots||1,line:o.line||s.p.line||'sap',
  ax:s.ax,ay:s.ay,len:CFG.KIND[s.kind].line?s.len:undefined,bw:o.hw||s.hw,bh:o.hh||s.hh,pk:o.pk??.85};
 fieldTrenches.push(a);const k=gkey(a.x,a.y);if(!trenchGrid.has(k))trenchGrid.set(k,[]);trenchGrid.get(k).push(a);s.anchor=a;
 if(window.PHYS&&typeof PHYS.rebuild==='function')PHYS.rebuild();return a}
function stageUp(s){
 s.stage++;const p=s.p,team=s.team,K=CFG.KIND[s.kind];
 if(K.onStage){K.onStage(s,s.stage);return}
 if(s.kind==='repair'){if(p.rep){const b=newBuilding(p.rep,team,s.x,s.y);if(p.vert)lineB(b,p.vert.ax,p.vert.ay,p.vert.len);say(team,p.rep==='wire'?'Arame farpado reinstalado.':'Sacos de areia recolocados.')}return}
 if(s.stage===2&&!s.anchor)addAnchor(s);        // trincheira funcional: vira âncora de cobertura do motor
 if(s.stage===3){const fc=face(team),[nx,ny]=enemyNormal(s.ax,s.ay,fc);
  if(s.kind==='trench'&&bagsOf(team)<CFG.MAXBAGS){bag(team,s.x+nx*12,s.y+ny*12,true,s.ax,s.ay,s.len);s.bags=1}
  if(s.kind==='nest'){bag(team,s.x+fc*20,s.y,true);s.bags=1;
   const mg=units.filter(u=>u.team===team&&u.type==='mg'&&u.hp>0&&u!==player).sort((a,b)=>hyp(a.x-s.x,a.y-s.y)-hyp(b.x-s.x,b.y-s.y))[0];
   if(mg&&hyp(mg.x-s.x,mg.y-s.y)<700){mg.tx=s.x;mg.ty=s.y;mg.order='move';mg.target=null;mg.manualUntil=time+30;mg.aiRole='ninho'}}
  if(s.kind==='mortar')POSTS.push({id:++pid,team,x:s.x,y:s.y,hp:260,cd:3,fl:0,ang:fc>0?0:Math.PI})}}

/* ======================================================================================
   SAPADORES
   ====================================================================================== */
function sappers(team){const r=[];for(const u of units)if(u.sap&&u.team===team&&u.hp>0)r.push(u);return r}
const overridden=u=>u.manualUntil>time&&u.manualUntil!==u.sapStamp;                       // ordem manual do jogador por cima
function freeSapper(u){return !u.sapJob&&(u.sapFree||0)<=time&&!overridden(u)&&!(u===player&&mode==='soldier')}
function assign(){
 IDX=new Map();for(const u of units)IDX.set(u.id,u);
 /* obras do jogador primeiro; obras da IA de um lado sem IA ficam paradas (e devolvem os pioneiros) até a IA voltar */
 for(const p of [...P].sort((a,b)=>(b.src==='player')-(a.src==='player'))){if(p.done)continue;
  if(p.src!=='player'&&!p.keep&&!aiEnabled[p.team]){if(p.crew.length){for(const id of p.crew)release(byId(id));p.crew=[]}continue}
  p.crew=p.crew.filter(id=>{const u=byId(id);if(!u||u.hp<=0)return false;
   if(overridden(u)){u.sapJob=null;u.sapState='';u.sapFree=time+25;return false}
   if(u===player&&mode==='soldier'){u.sapJob=null;u.sapState='';return false}
   return true});
  const s=curSeg(p);if(!s){if(p.extend&&extendSap(p))continue;finish(p);continue}
  if(p.src!=='player'&&!p.keep){p.idle=p.crew.length?0:(p.idle||0)+.5;p.hot=enemiesNear(p.team,s.x,s.y,200)>=4?(p.hot||0)+.5:0;
   if(p.idle>45||p.hot>20){cancel(p);continue}}
  const want=p.kind==='repair'?2:CFG.CREW;if(p.crew.length>=want)continue;
  const pool=sappers(p.team).filter(freeSapper).sort((a,b)=>hyp(a.x-s.x,a.y-s.y)-hyp(b.x-s.x,b.y-s.y));
  for(const u of pool){if(p.crew.length>=want)break;if(hyp(u.x-s.x,u.y-s.y)>1500)break;u.sapJob=p.id;u.sapHp=u.hp;p.crew.push(u.id)}}
 /* IA: pioneiros ociosos esperam atrás da primeira linha em vez de irem para o assalto */
 for(let t=0;t<2;t++){if(!aiEnabled[t])continue;const fx=FRONT[t],fc=face(t);
  for(const u of sappers(t)){if(!freeSapper(u))continue;
   if((u.x-(fx-fc*60))*fc>0){u.tx=fx-fc*rnd(90,140);u.ty=clamp(u.y,120,H-120);u.order='move'}
   else if(u.order==='attack'){u.order='hold';u.tx=u.x;u.ty=u.y}
   u.manualUntil=u.sapStamp=time+2}}}
function spotFor(s,i,n,fc){const along=(i-(n-1)/2)*14,[nx,ny]=enemyNormal(s.ax,s.ay,fc),back=s.kind==='nest'||s.kind==='mortar'?14:7;
 return[clamp(s.x+s.ax*along-nx*back,15,W-15),clamp(s.y+s.ay*along-ny*back,15,H-15)]}
function crewTick(p,dt){
 const s=curSeg(p);if(!s)return;const fc=face(p.team),n=p.crew.length;let dig=0;
 let quit=false;
 for(let i=0;i<n;i++){const u=byId(p.crew[i]);if(!u||u.hp<=0)continue;
  if(overridden(u)){u.sapJob=null;u.sapState='';u.sapFree=time+25;p.crew[i]=-1;quit=true;continue}
  u.manualUntil=u.sapStamp=time+1.2;
  if(u.hp<(u.sapHp??u.hp)-.5||u.suppression>1)u.sapProne=time+rnd(1.6,2.4);      // alvejado: interrompe a obra e deita
  u.sapHp=u.hp;
  if((u.sapEvade||0)>time){u.sapState='walk';continue}
  if(((u.id+sec*7)|0)%4===0)for(const sh of shells){if(sh.team===u.team||sh.kind==='smoke'||sh.t>2.6)continue;const d=hyp(u.x-sh.x,u.y-sh.y);
   if(d<sh.r+18){const k=(sh.r+45-d)/(d||1);u.tx=clamp(u.x+(u.x-sh.x)*k-fc*20,15,W-15);u.ty=clamp(u.y+(u.y-sh.y)*k,15,H-15);u.order='move';u.sapEvade=time+2.2;u.sapState='walk';break}}
  if((u.sapProne||0)>time){u.order='hold';u.tx=u.x;u.ty=u.y;u.sapState='prone';continue}
  const[sx,sy]=spotFor(s,i,n,fc);
  if(hyp(u.x-sx,u.y-sy)>16){                                  // o motor só anda se faltar mais de 12 px
  u.tx=sx;u.ty=sy;u.order='move';u.sapState='walk';continue}
  u.order='hold';u.tx=u.x;u.ty=u.y;
  if(u.target&&u.target.hp>0){u.sapState='fight';dig+=CFG.FIGHT}
  else{u.sapState='dig';dig++;u.angle=Math.atan2(s.y-u.y,s.x-u.x);if(Math.random()<dt*3.2)spoil(u,s,fc)}}
 if(quit)p.crew=p.crew.filter(id=>id>0);
 s.work+=dt*rate(dig)*(CFG.WORKX||1)*(CFG.BUILDX||1);/* obras mais rápidas: x1,7 na campanha, x3,2 no sandbox */
 while(s.stage<p.target&&s.work>=s.need[s.stage])stageUp(s)}
/* terra jogada para o lado do inimigo (é assim que o parapeito nasce) */
function spoil(u,s,fc){if(FXD.length>320)return;const[nx,ny]=enemyNormal(s.ax,s.ay,fc);
 for(let i=0;i<3;i++)FXD.push({x:u.x+rnd(-3,3),y:u.y+rnd(-2,2),z:4,vx:nx*rnd(18,44)+rnd(-10,10),vy:ny*rnd(18,44)+rnd(-10,10),vz:rnd(30,60),t:rnd(.5,.9),col:i?'#5b4a33':'#7a664a'});
 if(soundOn&&Math.random()<.18&&hyp(u.x-cam.x,u.y-cam.y)<260)sound('click')}

/* ======================================================================================
   POSTO DE MORTEIRO
   ====================================================================================== */
function postsTick(dt){for(const m of POSTS){m.cd-=dt;m.fl=Math.max(0,m.fl-dt);if(m.cd>0)continue;m.cd=1;
 let crewed=false;for(const u of units)if(u.team===m.team&&u.hp>0&&u.type!=='tank'&&u.type!=='cavalry'&&Math.abs(u.x-m.x)<40&&Math.abs(u.y-m.y)<40){crewed=true;break}
 if(!crewed)continue;const C=CFG.MORTAR;let best=null,bd=Infinity;
 for(const e of units){if(e.team===m.team||e.hp<=0)continue;const d=hyp(e.x-m.x,e.y-m.y);if(d<C.min||d>C.range)continue;if(window.PXW&&m.team===playerTeam&&!PXW.visible(e))continue;
  const sc=d*(e.type==='tank'?1.8:1)*(protectedBy(e)<.8?1.4:1);if(sc<bd){bd=sc;best=e}}
 if(!best)continue;let risky=false;for(const f of units)if(f.team===m.team&&f.hp>0&&hyp(f.x-best.x,f.y-best.y)<C.r+20){risky=true;break}
 if(risky)continue;const d=hyp(best.x-m.x,best.y-m.y);m.ang=Math.atan2(best.y-m.y,best.x-m.x);m.fl=.18;m.cd=C.cd;
 shells.push({x:best.x+rnd(-26,26),y:best.y+rnd(-26,26),t:1.3+d/560,r:C.r,power:C.power,team:m.team});
 particles.push({x:m.x,y:m.y-4,vx:0,vy:-18,t:.25,max:.25,color:'#ffeab0',size:5});
 if(hyp(m.x-cam.x,m.y-cam.y)<500)sound('shot')}
 POSTS=POSTS.filter(m=>m.hp>0)}

/* ======================================================================================
   BRECHAS: arame e sacos destruídos (o jogo apaga o prédio; aqui fica a memória de onde estavam)
   ====================================================================================== */
function trackBreaches(){const seen=new Set();
 for(const b of buildings){if(b.type!=='wire'&&b.type!=='sandbag')continue;seen.add(b.id);if(!TRK.has(b.id))TRK.set(b.id,{type:b.type,team:b.team,x:b.x,y:b.y,vert:b.vert?{ax:b.ax??0,ay:b.ay??1,len:b.len||32}:null})}
 for(const[id,b]of TRK)if(!seen.has(id)){TRK.delete(id);BR.push({...b,t:time})}
 BR=BR.filter(r=>time-r.t<180&&!buildings.some(b=>b.type===r.type&&Math.abs(b.x-r.x)<25&&Math.abs(b.y-r.y)<25)).slice(-24)}

/* ======================================================================================
   IA DOS PIONEIROS
   ====================================================================================== */
function enemiesNear(team,x,y,r){let n=0;for(const u of units)if(u.team!==team&&u.hp>0&&(u.x-x)**2+(u.y-y)**2<r*r)n++;return n}
function covered(x,y,r){for(const t of fieldTrenches)if(Math.abs(t.x-x)<r&&Math.abs(t.y-y)<r)return true;
 for(const s of SEGS)if(s.stage>0||!s.p.done)if(Math.abs(s.x-x)<r&&Math.abs(s.y-y)<r)return true;return false}
/* A. repara a brecha mais próxima da linha (sob fumaça se o inimigo estiver olhando) */
function planRepair(team){const fc=face(team);
 const list=BR.filter(r=>r.team===team&&time-r.t>8&&(r.x-FRONT[team])*fc<280&&!P.some(p=>!p.done&&p.kind==='repair'&&hyp(p.segs[0].x-r.x,p.segs[0].y-r.y)<30)&&enemiesNear(team,r.x,r.y,300)===0)
  .sort((a,b)=>b.t-a.t);
 const r=list[0];if(!r)return false;if(!pay(team,Math.round(cost(r.type)*.5)))return false;
 const p=project(team,'repair','repair',[[r.x,r.y]],{rep:r.type});if(!p)return false;p.vert=r.vert;
 if(enemiesNear(team,r.x,r.y,480)>0&&window.PXBAT&&typeof PXBAT.mission==='function'&&pay(team,30)){
  if(PXBAT.mission(team,r.x+fc*90,r.y,2,30,'smoke'))p.smoke=true;else if(!sandbox)supplies[team]+=30}
 return true}
/* B. consolidação: grupo avançado em terra de ninguém sem inimigo por perto → une as crateras com valas */
function planCreep(team){if(time<45)return false;const fc=face(team),fx=FRONT[team],ex=FRONT[1-team],cells=new Map();
 for(const u of units){if(u.team!==team||u.hp<=0||u.sap||u.type==='tank'||u.type==='cavalry')continue;
  if((u.x-fx)*fc<90||(u.x-fx)*fc>650||(ex-u.x)*fc<170)continue;const k=Math.floor(u.x/150)+','+Math.floor(u.y/150);let c=cells.get(k);if(!c)cells.set(k,c={n:0,x:0,y:0,h:0});c.n++;c.x+=u.x;c.y+=u.y;if(!u.moving)c.h++}
 let best=null;for(const c of cells.values())if(c.n>=5&&c.h>=3&&(!best||c.n>best.n))best=c;if(!best)return false;
 const cx=best.x/best.n,cy=best.y/best.n;if(enemiesNear(team,cx,cy,300)>0||covered(cx,cy,100))return false;
 let cr=allCraters.filter(c=>hyp(c.x-cx,c.y-cy)<150).sort((a,b)=>hyp(a.x-cx,a.y-cy)-hyp(b.x-cx,b.y-cy)).slice(0,4).sort((a,b)=>a.y-b.y);
 let pts=[];for(const c of cr){const q=[c.x,c.y];if(!pts.length||hyp(q[0]-pts[pts.length-1][0],q[1]-pts[pts.length-1][1])<120)pts.push(q)}
 if(pts.length<2)pts=[[cx-fc*10,cy-55],[cx+fc*10,cy+55]];
 let segs=segment(pts);if(segs.length>6){pts=pts.slice(0,3);segs=segment(pts)}
 if(segsOf(team)+segs.length>CFG.MAXSEGS||!pay(team,segs.length*8))return false;
 return !!project(team,'trench','creep',pts)}
/* C. sapa em zigue-zague a partir da trincheira principal rumo ao centro do mapa */
function planSap(team){if(time<40||P.some(p=>!p.done&&p.team===team&&p.kind==='sap'))return false;if(segsOf(team)>CFG.MAXSEGS-6)return false;
 const fc=face(team),Brain=window.IronFrontBrain;let fy=800;
 try{const op=Brain?.lastPlans?.[team]?.operation;
  if(op)fy=op.y;else{const f=Brain&&Brain.rankObjectives?Brain.rankObjectives(team,points,units)[0]:null;if(f&&f.point)fy=f.point.y}}catch{}
 fy=clamp(fy+rnd(-120,120),160,H-160);
 let a=null,bd=Infinity;for(const t of fieldTrenches){if(t.team!==team||(t.line&&t.line!=='front'))continue;const d=Math.abs(t.y-fy)+Math.abs(t.x-FRONT[team])*.3;if(d<bd){bd=d;a=t}}
 const x0=a?a.x+fc*16:FRONT[team]+fc*16,y0=a?a.y:fy,side=Math.random()<.5?1:-1,pts=zigzag(x0,y0,fc,2,side);
 const n=segment(pts).length;if(!pay(team,n*CFG.KIND.sap.cost))return false;
 const p=project(team,'sap','sap',pts,{extend:true,legs:2,side});if(p)p.head=pts[pts.length-1];return !!p}
function extendSap(p){const fc=face(p.team),h=p.head;if(!h||p.legs>=CFG.SAP_LEGS)return false;
 if((1200-h[0])*fc<60||enemiesNear(p.team,h[0],h[1],240)>=3||segsOf(p.team)>=CFG.MAXSEGS)return false;
 const pts=zigzag(h[0],h[1],fc,1,p.legs%2?-p.side:p.side),g=segment(pts);if(!pay(p.team,g.length*CFG.KIND.sap.cost))return false;
 for(const s of g)p.segs.push(mkSeg(p,s));p.legs++;p.head=pts[1];return true}
/* contra-tática: sapadores inimigos cavando à vista atraem fogo de morteiro/artilharia */
/* só obras que ameaçam a própria linha (sapa chegando, crateras consolidadas perto) e no máximo a cada 40 s por facção */
function planCounter(team){if(supportCooldown[team]>0||time-(S.cAt[team]??-99)<40)return;const obs=typeof observationRange==='function'?observationRange():700;
 for(const p of P){if(p.done||p.team===team||time-p.shelled<45||p.crew.length<2)continue;const s=curSeg(p);if(!s||s.work<2)continue;
  if(Math.abs(s.x-FRONT[team])>520)continue;
  let seen=false;for(const u of units)if(u.team===team&&u.hp>0&&hyp(u.x-s.x,u.y-s.y)<Math.min(obs*.8,480)){seen=true;break}if(!seen)continue;
  for(const u of units)if(u.team===team&&u.hp>0&&hyp(u.x-s.x,u.y-s.y)<110)return;           // aliado perto demais
  if(!pay(team,70))return;let ok=false;
  if(window.PXBAT&&typeof PXBAT.mission==='function')ok=PXBAT.mission(team,s.x,s.y,2,65,'he');
  if(!ok)for(let i=0;i<2;i++)shells.push({x:s.x+rnd(-65,65),y:s.y+rnd(-65,65),t:2.6+i*.4,r:55,team});
  p.shelled=time;S.cAt[team]=time;supportCooldown[team]=Math.max(supportCooldown[team],14);
  if(p.team===playerTeam)say(p.team,'Fogo inimigo sobre seus sapadores!');return}}
function aiTick(team){
 const managed=window.IronFrontEngineering&&window.PXFORT?.on;
 if(!managed)planCounter(team);
 const crew=sappers(team);
 if(!crew.length){if(time>25&&(S.boughtAt?.[team]??-99)+75<time&&(sandbox||supplies[team]>=cost('sapper')+30)&&units.filter(u=>u.team===team).length+3<=maxUnits&&pay(team,cost('sapper'))){
  (S.boughtAt||(S.boughtAt=[-99,-99]))[team]=time;const rx=window.PX&&PX.WW1&&map==='trenches'?PX.WW1.reinforceX(team):(team?W-350:350);squad('sapper',team,rx,clamp(800+rnd(-200,200),180,H-180))}return}
 if(managed||live(team).length>=CFG.MAXPROJ.ai)return;
 planRepair(team)||planCreep(team)||(crew.length>=2&&planSap(team))}

/* ======================================================================================
   LAÇO
   ====================================================================================== */
function tick(dt){
 if(!S.on||!started||ended)return;sec+=dt;
 hk-=dt;if(hk<=0){hk=.5;assign()}else{IDX.size||assign()}
 for(const p of P)if(!p.done&&p.crew.length)crewTick(p,dt);
 postsTick(dt);
 for(const f of FXD){f.t-=dt;f.x+=f.vx*dt;f.y+=f.vy*dt;f.vz-=260*dt;f.z=Math.max(0,f.z+f.vz*dt);if(!f.z){f.vx*=.5;f.vy*=.5}}FXD=FXD.filter(f=>f.t>0);
 for(let t=0;t<2;t++){if(!aiEnabled[t]||S.hold)continue;aiT[t]-=dt;if(aiT[t]<=0){aiT[t]=CFG.AI_DT;aiTick(t)}}
 if(((sec*2)|0)!==((sec*2-dt*2)|0))trackBreaches();
 if(P.length>60)P=P.filter(p=>!p.done)}
function reset(){
 P=[];SEGS=[];POSTS=[];FXD=[];TRK=new Map();BR=[];aiT=[1.5,4];hk=0;sec=0;UI.mode=null;UI.drag=null;IDX=new Map();S.boughtAt=[-99,-99];S.cAt=[-99,-99];
 for(let t=0;t<2;t++){const f=fieldTrenches.filter(a=>a.team===t&&(!a.line||a.line==='front'));
  FRONT[t]=f.length?f.reduce((n,a)=>n+a.x,0)/f.length:(t?1700:720)}
 /* pioneiros iniciais: os fuzileiros mais recuados de cada lado recebem pá, marreta e rolos de arame */
 for(let t=0;t<2;t++){const fc=face(t),pool=units.filter(u=>u.team===t&&u.type==='rifle').sort((a,b)=>(a.x-b.x)*fc);
  for(const u of pool.slice(0,CFG.SQUAD_START*3))u.sap=1}
 trackBreaches()}

/* ======================================================================================
   DESENHO
   ====================================================================================== */
const mkc=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
function segSprite(s){const K=CFG.KIND[s.kind];if(K.sprite){const kk=s.stage+'|'+Math.min(4,Math.floor(s.work/s.need[Math.min(s.stage,s.need.length-1)]*5));if(s.sk===kk&&s.spr)return s.spr;s.sk=kk;return s.spr=K.sprite(s)}
 const k=s.stage+'|'+(s.stage?0:Math.min(4,Math.floor(s.work/s.need[0]*5)))+'|'+s.kind;if(s.sk===k&&s.spr)return s.spr;s.sk=k;
 const big=s.kind==='nest'||s.kind==='mortar'||s.kind==='repair',L=Math.ceil(s.len*Z),sz=(big?26:L+18)|0,c=mkc(sz,sz),g=c.getContext('2d'),cx=sz/2,cy=sz/2;
 const fc=face(s.team),[nx,ny]=enemyNormal(s.ax,s.ay,fc),st=s.stage,fr=st?1:s.work/s.need[0];
 const px=(x,y,col)=>{g.fillStyle=col;g.fillRect(Math.round(x),Math.round(y),1,1)};
 const h=(i,j)=>((i*73856093^j*19349663)>>>0)%97/97;                                  // ruído fixo por pixel
 if(big){const R=s.kind==='repair'?4:6;
  for(let y=-R-3;y<=R+3;y++)for(let x=-R-3;x<=R+3;x++){const d=hyp(x,y);
   if(st===0){if(Math.abs(d-R)<.6&&((x+y)&1))px(cx+x,cy+y,'#d9e0a6');if(d<R*fr)px(cx+x,cy+y,'#4a3b28');continue}
   if(d<R-1)px(cx+x,cy+y,d<R-2.5?'#211b14':'#2e261b');else if(d<R+.5)px(cx+x,cy+y,'#3a2f22');else if(d<R+2.5&&h(x,y)<.75)px(cx+x,cy+y,(x*nx+y*ny)>0?'#6d5b3f':'#5f4f36')}
  if(st>=2&&s.kind!=='repair')for(let x=-R+2;x<=R-2;x+=2)px(cx+x,cy,'#7d6340');
  return s.spr=c}
 /* luz do canto superior esquerdo (como o mapa de altura): a parede do lado da luz fica clara, a oposta em sombra */
 const lit=w=>(nx*w*-1+ny*w*-1)>0;
 for(let t=-L/2;t<=L/2;t+=.5)for(let w=-7.5;w<=7.5;w+=.5){const x=cx+s.ax*t+nx*w,y=cy+s.ay*t+ny*w,aw=Math.abs(w),i=Math.round(t*2),j=Math.round(w*2),n=h(i,j);
  if(st===0){if(aw>=3.5&&aw<4&&(Math.round(t)&1))px(x,y,'#d9e0a6');if(aw<=2&&t<-L/2+fr*L)px(x,y,n<.5?'#4a3b28':'#56452f');continue}
  if(st===1){if(aw<=1.5)px(x,y,'#261f17');else if(aw<=2.5)px(x,y,lit(w)?'#4a3c2a':'#2f261c');
   else if(aw<=4.5&&n<.85)px(x,y,w>0?(n<.45?'#7c6a4a':'#6d5b3f'):(n<.4?'#5f4f36':'#6a5a3e'));else if(w>4.5&&w<=6&&n<.4)px(x,y,'#5f4f36');continue}
  if(aw<=2)px(x,y,(Math.round(t)&1)===0&&aw<=1.5?(n<.5?'#5e4a31':'#6b5538'):'#231c15');           // pranchas (duckboards) sobre o fundo
  else if(aw<=3.5)px(x,y,lit(w)?(n<.5?'#56462f':'#4d3f2b'):'#1f1912');
  else if(aw<=5.5&&n<.9)px(x,y,w>0?(n<.45?'#7c6a4a':'#6d5b3f'):(n<.4?'#5f4f36':'#665538'));
  else if(aw<=7.5&&n<.3)px(x,y,w>0?'#6d5b3f':'#57492f')}
 return s.spr=c}
let postSpr=[null,null];
function postSprite(team){if(postSpr[team])return postSpr[team];const c=mkc(20,20),g=c.getContext('2d');
 for(let y=-9;y<=9;y++)for(let x=-9;x<=9;x++){const d=hyp(x,y);if(d<=9&&d>6.5){g.fillStyle=((x+y*3)&3)?'#b5a57c':'#8f8060';g.fillRect(10+x,10+y,1,1)}else if(d<=6.5){g.fillStyle=d<4?'#262019':'#3a2f22';g.fillRect(10+x,10+y,1,1)}}
 g.fillStyle='#8f8060';for(let i=-8;i<=8;i+=4)g.fillRect(10+i,10-9+Math.abs(i)/3|0,2,1);return postSpr[team]=c}
const hsh2=(i,j)=>((i*73856093^j*19349663)>>>0)%97/97;
function lineSprite(b,dm){const L=b.len*Z+3,ax=b.ax??0,ay=b.ay??1,nx=-ay,ny=ax,sz=Math.ceil(L)+12,c=mkc(sz,sz),g=c.getContext('2d'),o=sz/2,R=Math.round;
 if(b.type==='wire'){/* estacas a cada ~8 px e duas espirais cruzadas entre elas */
  for(let t=-L/2;t<=L/2;t+=.4){for(let k=0;k<3;k++){const w=3.5*Math.sin(t*1.1+k*2.1),x=o+ax*t+nx*w,y=o+ay*t+ny*w;if(dm&&hsh2(R(t*2),k+5)<dm*.3)continue;
    g.fillStyle=k===1?'#4a5450':(R(t*2)&3)?'#1f2824':'#5d6862';g.fillRect(R(x),R(y),1,1)}}
  for(let t=-L/2+2;t<=L/2;t+=7){const x=R(o+ax*t),y=R(o+ay*t);g.fillStyle='#2a2117';g.fillRect(x+1,y-3,1,6);g.fillStyle='#675740';g.fillRect(x,y-4,1,7);g.fillStyle='#8a7656';g.fillRect(x,y-4,1,1)}
  return c}
 /* parapeito: duas fiadas de sacos desencontradas ao longo do eixo */
 for(let k=0;k<3;k++)for(let t=-L/2-1+(k%2?1.5:0);t<=L/2+1;t+=3){if(dm&&hsh2(R(t*3),k)<dm*.28)continue;const w=(k-1)*2.6,x=R(o+ax*t+nx*w)-2,y=R(o+ay*t+ny*w)-1;
  g.fillStyle='#5c5340';g.fillRect(x,y,4,3);g.fillStyle=k===1?'#bcac82':k?'#a99970':'#b5a57c';g.fillRect(x,y,4,2);g.fillStyle='#c4b78e';g.fillRect(x+1,y,2,1)}
 return c}
let VB=[];
function drawBags(c,ox,oy){for(const b of VB){if(b.hp<=0)continue;const x=ox+Math.round(b.x*Z),y=oy+Math.round(b.y*Z),m=b.len*Z;if(x<-m||y<-m||x>vw+m||y>vh+m)continue;
 const f=b.hp/b.maxhp,dm=f<.34?2:f<.67?1:0;if(!b._spr||b._dm!==dm){b._spr=lineSprite(b,dm);b._dm=dm}const sp=b._spr;
 if(b.type==='sandbag'){c.globalAlpha=.3;c.drawImage(sp,x-(sp.width>>1)+1,y-(sp.height>>1)+2);c.globalAlpha=1}
 c.drawImage(sp,x-(sp.width>>1),y-(sp.height>>1))}}
function drawGround(c,ox,oy){drawBags(c,ox,oy);
 if(!S.on)return;const m=30;
 for(const s of SEGS){const x=ox+Math.round(s.x*Z),y=oy+Math.round(s.y*Z);if(x<-m||y<-m||x>vw+m||y>vh+m)continue;const sp=segSprite(s);c.drawImage(sp,x-(sp.width>>1),y-(sp.height>>1))}
 if(!S.customPosts)for(const p of POSTS){const x=ox+Math.round(p.x*Z),y=oy+Math.round(p.y*Z);if(x<-m||y<-m||x>vw+m||y>vh+m)continue;const sp=postSprite(p.team);c.drawImage(sp,x-10,y-10);
  const tx=Math.round(Math.cos(p.ang)*4),ty=Math.round(Math.sin(p.ang)*4)-2;pix(c,x,y,x+tx,y+ty,'#2b2e28');rect(c,x+tx,y+ty,1,1,'#555a4c');rect(c,x-1,y+1,3,1,'#44483d');
  if(p.fl>0){rect(c,x+tx-1,y+ty-2,3,2,'#ffeab0');rect(c,x+tx,y+ty-3,1,1,'#fffbe0')}}}
function pix(c,x0,y0,x1,y1,col){const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0))|0;c.fillStyle=col;for(let i=0;i<=n;i++){const f=n?i/n:0;c.fillRect(Math.round(x0+(x1-x0)*f),Math.round(y0+(y1-y0)*f),1,1)}}
function drawOver(c,ox,oy){
 if(!S.on)return;
 for(const f of FXD){const x=ox+Math.round(f.x*Z),y=oy+Math.round((f.y-f.z)*Z);if(x<0||y<0||x>=vw||y>=vh)continue;rect(c,x,y,1,1,f.col)}
 /* barra de progresso da obra ativa: estágio atual em cor cheia, marcações dos 3 estágios */
 for(const p of P){if(p.done||(!p.crew.length&&p.team!==playerTeam))continue;const s=p.segs[p.cur];if(!s)continue;
  const x=ox+Math.round(s.x*Z),y=oy+Math.round(s.y*Z)-12;if(x<-20||y<-20||x>vw+20||y>vh+20)continue;
  if(p.team!==playerTeam&&window.PXW&&!PXW.visible({team:p.team,x:s.x,y:s.y}))continue;
  const tot=s.need[p.target-1],f=clamp(s.work/tot,0,1),w=15;rect(c,x-8,y-1,w+2,4,'#141712');rect(c,x-7,y,w,2,'#3b4431');
  rect(c,x-7,y,Math.max(1,Math.round(w*f)),2,p.team?'#e0a080':'#a8d0dc');for(let i=0;i<p.target-1;i++)rect(c,x-7+Math.round(w*s.need[i]/tot),y,1,2,'#141712')}
 /* ordem de campo do jogador */
 if(UI.mode&&mode==='commander'&&mouse.over){const col=isLine(UI.mode)?'#d5dfab':'#e8d58c';
  if(UI.drag){const a=UI.drag,b=clampLine(a,{x:mouse.wx,y:mouse.wy}),LK=CFG.KIND[UI.mode]||CFG.KIND.trench,n=segment([[a.x,a.y],[b.x,b.y]],LK.step||CFG.SEG).length;
   pix(c,ox+Math.round(a.x*Z),oy+Math.round(a.y*Z),ox+Math.round(b.x*Z),oy+Math.round(b.y*Z),col);
   for(const g of segment([[a.x,a.y],[b.x,b.y]],LK.step||CFG.SEG)){rect(c,ox+Math.round(g.x*Z)-1,oy+Math.round(g.y*Z)-1,3,3,'#141712');rect(c,ox+Math.round(g.x*Z),oy+Math.round(g.y*Z),1,1,col)}
   hint(`${label(UI.mode).split(':')[0]}: ${n} trecho${n>1?'s':''} · ◈ ${sandbox?'∞':n*LK.cost} · solte para ordenar`)}
  else{const x=Math.round(mouse.x),y=Math.round(mouse.y);c.globalAlpha=.8;
   if(isLine(UI.mode)){rect(c,x-4,y,9,1,col);rect(c,x,y-4,1,9,col)}
   else{for(let a=0;a<24;a++){if(a&1)continue;const r=UI.mode==='nest'?10:8;rect(c,x+Math.round(Math.cos(a/24*6.283)*r),y+Math.round(Math.sin(a/24*6.283)*r),1,1,col)}rect(c,x-1,y-1,3,3,col)}
   c.globalAlpha=1}}}
function hint(s){const h=document.getElementById('placehint');if(h&&h.textContent!==s)h.textContent=s}
const MODES=['trench','nest','mortar'],isLine=k=>!!(CFG.KIND[k]&&CFG.KIND[k].line),label=k=>(CFG.KIND[k]&&CFG.KIND[k].label)||MNAME[k]||k,MNAME={trench:'Cavar trincheira de ligação: arraste uma linha',nest:'Ninho de metralhadora: clique no local',mortar:'Posto de morteiro: clique no local'};
function modeHint(){if(!UI.mode){hint('Escolha uma unidade e posicione no campo');return}
 hint(`ORDEM DE CAMPO · ${label(UI.mode)} · ◈ ${sandbox?'∞':CFG.KIND[UI.mode].cost}${isLine(UI.mode)?'/trecho':''} · B troca · ESC cancela`)}

/* sapador: pá e marreta nas costas; agachado quando cava; deitado quando alvejado */
const ROT=new WeakMap();
function rot90(src){let r=ROT.get(src);if(r)return r;r=mkc(src.height,src.width);const g=r.getContext('2d');g.translate(src.height,0);g.rotate(Math.PI/2);g.drawImage(src,0,0);ROT.set(src,r);return r}
function drawSapper(c,u,sp,sx,sy,vis,bob,orig){
 if(u.pv&&u.pv.stun>.05)return orig();
 const w=sp.c.width,x0=sx-sp.ax,y0=sy-sp.ay+bob,st=u.sapState;
 if(st==='prone'&&(u.sapProne||0)>time){const r=rot90(sp.c);c.drawImage(r,sx-(r.width>>1),sy-(r.height>>1)+3);return true}
 const ca=Math.cos(u.angle||0),sa=Math.sin(u.angle||0);
 if(st==='dig'&&vis>6){const ph=(time*2.6+u.id*.37)%1,up=ph<.45;
  c.drawImage(sp.c,0,0,w,vis-3,x0,y0+3,w,vis-3);                                          // agachado: pernas somem na vala
  const hx=sx+Math.round(ca*2),hy=sy-2,ex=sx+Math.round(ca*(up?5:7)),ey=sy+(up?-4:1)+Math.round(sa*2);
  pix(c,hx,hy,ex,ey,'#6b5436');rect(c,ex-(ca<0?1:0),ey,2,2,'#9aa0a0');return true}
 if(!orig())c.drawImage(sp.c,0,0,w,vis,x0,y0,w,vis);
 const bx=sx-Math.round(ca*3),by=sy-7+bob;                                                // pá nas costas + rolo de arame
 pix(c,bx-1,by+5,bx+2,by,'#6b5436');rect(c,bx+2,by-1,2,2,'#9aa0a0');rect(c,sx+Math.round(-sa*3)-1,sy-2+bob,2,2,'#7b7f7a');
 return true}

/* ======================================================================================
   ENTRADA DO JOGADOR (B = ordem de campo)
   ====================================================================================== */
function clampLine(a,b){const dx=b.x-a.x,dy=b.y-a.y,L=hyp(dx,dy),k=L>360?360/L:1;return{x:a.x+dx*k,y:a.y+dy*k}}
function friendlyGround(x,y){if(sandbox)return true;if(playerTeam?x>W-850:x<850)return true;
 if(points.some(p=>p.owner===playerTeam&&hyp(p.x-x,p.y-y)<240))return true;return units.some(u=>u.team===playerTeam&&u.hp>0&&hyp(u.x-x,u.y-y)<260)}
function playerOrder(kind,pts){
 const team=playerTeam;if(!sappers(team).length){toast('Sem pioneiros. Compre um esquadrão de Pioneiros na aba Unidades (5).');return null}
 if(live(team).filter(p=>p.src==='player').length>=CFG.MAXPROJ.player){toast(`Pioneiros ocupados: até ${CFG.MAXPROJ.player} obras ao mesmo tempo.`);return null}
 if(!pts.every(q=>friendlyGround(q[0],q[1])&&(!S.canBuild||S.canBuild(team,q[0],q[1])))){toast(S.buildMsg||'Obra precisa de tropas aliadas por perto ou território aliado.');return null}
 const K=CFG.KIND[kind],n=K.line?segment(pts,K.step||CFG.SEG).length:1;if(K.line&&!K.noAnchor&&segsOf(team)+n>CFG.MAXSEGS){toast('Limite de trincheiras de campo atingido.');return null}
 if(!pay(team,n*CFG.KIND[kind].cost)){toast('Suprimentos insuficientes para a obra.');return null}
 const p=project(team,kind,'player',pts,{line:K.anchorLine});if(p){hk=0;sound('click');toast(K.label&&!MNAME[kind]?`Pioneiros a caminho: ${K.label.split(':')[0].toLowerCase()}.`:kind==='trench'?`Pioneiros a caminho: ${n} trecho${n>1?'s':''} de trincheira.`:kind==='nest'?'Pioneiros a caminho do ninho de metralhadora.':'Pioneiros a caminho do posto de morteiro.')}
 return p}
function evPos(e){const r=canvas.getBoundingClientRect();mouse.x=(e.clientX-r.left)*vw/r.width;mouse.y=(e.clientY-r.top)*vh/r.height;worldMouse();return{x:clamp(mouse.wx,20,W-20),y:clamp(mouse.wy,20,H-20)}}
window.addEventListener('pointerdown',e=>{if(!S.on||!UI.mode||e.target!==canvas||!started||ended||mode!=='commander')return;
 if(placement){UI.mode=null;UI.drag=null;return}                                          // carta escolhida tem prioridade
 e.stopImmediatePropagation();e.preventDefault();const q=evPos(e);
 if(e.button===2){const p=P.find(p=>!p.done&&p.src==='player'&&p.segs.some(s=>s.stage<p.target&&hyp(s.x-q.x,s.y-q.y)<26));
  if(p){cancel(p);toast('Obra cancelada.')}else{UI.mode=null;UI.drag=null}modeHint();return}if(e.button!==0)return;
 if(isLine(UI.mode))UI.drag=q;else playerOrder(UI.mode,[[q.x,q.y]])},true);
window.addEventListener('pointerup',e=>{if(!UI.drag)return;const a=UI.drag;UI.drag=null;if(e.target===canvas)evPos(e);const b=clampLine(a,{x:clamp(mouse.wx,20,W-20),y:clamp(mouse.wy,20,H-20)});
 if(hyp(b.x-a.x,b.y-a.y)<20){toast('Arraste uma linha para marcar a trincheira.');modeHint();return}playerOrder(isLine(UI.mode)?UI.mode:'trench',[[a.x,a.y],[b.x,b.y]]);modeHint()},true);
window.addEventListener('keydown',e=>{if(!S.on||e.repeat||document.querySelector('dialog[open]')||!started||ended)return;
 if(mode!=='commander'){if(UI.mode){UI.mode=null;UI.drag=null}return}
 const k=e.key.toLowerCase();
 if(k==='b'){const i=UI.mode?MODES.indexOf(UI.mode)+1:0;UI.mode=MODES[i]||null;UI.drag=null;if(UI.mode&&placement){placement=null;makeCards()}modeHint();toast(UI.mode?`Ordem de campo: ${MNAME[UI.mode]} (◈ ${sandbox?'∞':CFG.KIND[UI.mode].cost}${UI.mode==='trench'?'/trecho':''}). B troca · ESC cancela`:'Ordem de campo encerrada.');e.preventDefault()}
 else if(e.key==='Escape'&&UI.mode){e.stopImmediatePropagation();e.preventDefault();UI.mode=null;UI.drag=null;modeHint();toast('Ordem de campo cancelada.')}
 else if(e.key==='5'&&tab==='units'){e.stopImmediatePropagation();choose('sapper')}},true);

/* ======================================================================================
   LIGAÇÕES COM O JOGO
   ====================================================================================== */
defs.sapper={name:'Pioneiros',sub:'Esquadrão · 3 sapadores · obras (B)',cost:90,count:3,hp:100,speed:47,range:220,rate:1.8,damage:26};
wrap('newUnit',(orig,type,team,x,y)=>{if(type!=='sapper')return orig(type,team,x,y);const u=orig('rifle',team,x,y);u.sap=1;u.gren=1;return u});
wrap('setup',(orig,...a)=>{const r=orig(...a);try{reset()}catch(e){fail(e)}return r});
wrap('update',(orig,dt)=>{orig(dt);try{tick(dt)}catch(e){fail(e)}});
wrap('render',(orig,...a)=>{if(!buildings.some(b=>b.vert))return orig(...a);const all=buildings;VB=all.filter(b=>b.vert);buildings=all.filter(b=>!b.vert);try{return orig(...a)}finally{buildings=all;VB=[]}});
wrap('protectedBy',(orig,u)=>{let f=orig(u);if(!S.on||u.type==='tank')return f;
 if(f>CFG.STAGE1)for(const s of SEGS)if(s.stage===1&&Math.abs(s.x-u.x)<s.hw&&Math.abs(s.y-u.y)<s.hh){f=CFG.STAGE1;break}
 if(u.sap&&(u.sapProne||0)>time)f*=CFG.PRONE;return f});
wrap('explode',(orig,x,y,r,power=100,team=0)=>{orig(x,y,r,power,team);if(!S.on)return;try{
 for(const s of SEGS){if(s.stage>=s.p.target)continue;const d=hyp(s.x-x,s.y-y);if(d>=r)continue;const floor=s.stage?s.need[s.stage-1]:0;s.work=Math.max(floor,s.work-7*(1-d/r)*power/150)}
 for(const m of POSTS){const d=hyp(m.x-x,m.y-y);if(d<r+10)m.hp-=power*(1-d/(r+10))*1.4}}catch(e){fail(e)}});
wrap('makeCards',orig=>{orig();try{if(tab!=='units')return;const d=defs.sapper,b=document.createElement('button');b.className='card'+(placement==='sapper'?' active':'');
 b.innerHTML=`<canvas width="48" height="48"></canvas><b>${d.name}</b><small>${d.sub}</small><span class="cost">◈ ${sandbox?'∞':d.cost}</span><kbd>5</kbd>`;b.onclick=()=>choose('sapper');
 document.getElementById('cards').append(b);icon('sapper',b.querySelector('canvas').getContext('2d'))}catch(e){fail(e)}});
wrap('icon',(orig,type,c)=>{if(type!=='sapper')return orig(type,c);orig('rifle',c);const cv=c.canvas,k=cv.width/56;
 const p=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(Math.round(x*k),Math.round(y*k),Math.max(1,Math.round(w*k)),Math.max(1,Math.round(h*k)))};
 for(let i=0;i<14;i++){p(34+i,40-i*1.6,2,2,'#1a2017');p(35+i,40-i*1.6,1,1,'#8a6a44')}p(47,14,5,5,'#1a2017');p(48,15,3,3,'#b9bfbf')});
if(window.WW1A){const under=WW1A.under,over=WW1A.over;
 WW1A.under=function(c,ox,oy,dt){under.call(this,c,ox,oy,dt);try{drawGround(c,ox,oy)}catch(e){fail(e)}};
 WW1A.over=function(c,ox,oy,dt){over.call(this,c,ox,oy,dt);try{drawOver(c,ox,oy)}catch(e){fail(e)}}}
if(!window.PHYS)window.PHYS={on:false,draw:()=>false};
{const orig=PHYS.draw||(()=>false);PHYS.draw=function(c,u,sp,sx,sy,vis,bob){const o=()=>orig.call(PHYS,c,u,sp,sx,sy,vis,bob);if(!u.sap||!S.on)return o();
 try{return drawSapper(c,u,sp,sx,sy,vis,bob,o)}catch(e){fail(e);return o()}}}

S.state=()=>({on:S.on,projects:P.filter(p=>!p.done).map(p=>({id:p.id,team:p.team,kind:p.kind,src:p.src,segs:p.segs.length,cur:p.cur,crew:p.crew.length,stage:p.segs[p.cur]?.stage??p.target})),
 segs:SEGS.length,anchors:[segsOf(0),segsOf(1)],bags:[bagsOf(0),bagsOf(1)],posts:POSTS.length,breaches:BR.length,sappers:[sappers(0).length,sappers(1).length],errors:S.stats.errors,front:[...FRONT],mode:UI.mode});
S.order=(kind,pts,team=playerTeam)=>team===playerTeam?playerOrder(kind,pts):project(team,kind,'ai',pts);
S.bag=bag;S.lineB=lineB;S.cancel=cancel;S.addAnchor=addAnchor;S.project=project;S.refreshFront=()=>{for(let t=0;t<2;t++){const f=fieldTrenches.filter(a=>a.team===t&&a.line==='front');if(f.length)FRONT[t]=f.reduce((n,a)=>n+a.x,0)/f.length}};S.tick=tick;S.reset=reset;S.aiTick=aiTick;
Object.defineProperties(S,{projects:{get:()=>P},segs:{get:()=>SEGS},posts:{get:()=>POSTS},breaches:{get:()=>BR},ui:{get:()=>UI}});
S._={segment,zigzag,bbox,gkey,rate,enemyNormal};S._stage=stageUp;
if(window.IronFront)window.IronFront.sappers=S;
})();
