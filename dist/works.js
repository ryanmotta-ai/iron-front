'use strict';
/* Iron Front 1.9 — obras novas para o modo construtor (works.js). Carrega DEPOIS de aviation.js. Usa o catálogo do sappers/fortify
   (PXSAP.cfg.KIND + PXFORT.KINDS/SHORT/SUB): as obras aparecem na aba DEFESAS e os pioneiros as constroem como as outras.
   Toca individual ..... (◈8, 4 s de obra) buraco de atirador para 1 homem na terra de ninguém: vira cobertura (âncora) como a
                         trincheira, sem precisar de uma linha. Serve para segurar o terreno ganho até a sapa chegar.
   Depósito de munição . (◈90) caixotes sob lona: a cada 5 s, infantaria a até 140 px completa o pente e recupera 1 granada; MG
                         esfria a camisa; peças de artilharia a até 180 px recebem +2 projéteis. Estoque de 80 (repõe 1 a cada 6 s).
                         Atingido por explosão forte, explode junto (raio 90): fica longe da linha de frente.
   Posto de observação . (◈80) buraco de sacos com periscópio: revela a névoa num raio de 520 px para o seu lado e corrige a
                         artilharia a até 480 px dele (dispersão −40%, soma com observador e avião).
   Cavalo de frisa ..... (◈22, 5 s) obstáculo portátil de estacas e arame: um trecho de arame curto (freia quem passa) que dá para
                         fechar uma brecha ou o fundo de uma trincheira tomada.
   A IA põe 2 depósitos e 1 posto de observação no plano da trégua e pioneiros cavam tocas à frente na guerra.
   ?obras=0 desliga · IronFront.works.state(). */
(function(){
if(!window.PXSAP||!window.PXFORT||!PXSAP.cfg||!PXSAP.cfg.KIND)return;
const K=PXSAP.cfg.KIND,F=PXFORT,hyp=Math.hypot,rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>v<a?a:v>b?b:v;
const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('works.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};
const CFG={DEPOT:{r:140,gr:180,every:5,stock:80,restock:6,hp:300,boomPow:60,boomR:90},OP:{fog:520,art:480,spread:.6}};
const S=window.PXWORKS={on:!/[?&]obras=0/.test(location.search),version:'1.9',cfg:CFG,stats:{foxholes:0,depots:0,ops:0,chevaux:0,resupplied:0,grenades:0,shellsGiven:0,depotBlasts:0,opCorrected:0,errors:0}};
let DEP=[],OPS=[],errs=0,tickT=0,restT=0;
function fail(e){S.stats.errors++;if(++errs<=3)console.error('works.js:',e);if(errs>=12){S.on=false;console.error('works.js desligado após erros repetidos')}}
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const R=(g,x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(x,y,w,h)};
const done=s=>{const it=s.p&&s.p.item;if(it){it.done=true;it.seg=s}};

/* ---------- sprites (px de arte; o sappers.js desenha centrado na obra) ---------- */
const SPR=new Map(),spr=(k,f)=>{let c=SPR.get(k);if(!c){c=f();SPR.set(k,c)}return c};
function stake(g,w,h,fr){/* fita de marcação da obra + barra de progresso */g.fillStyle='#d9e0a6';for(let x=1;x<w-1;x+=2){g.fillRect(x,1,1,1);g.fillRect(x,h-2,1,1)}R(g,2,(h>>1)-1,Math.round((w-4)*fr),2,'#bdb595')}
function foxSpr(s){const st=s.stage|0,fr=clamp(s.work/(s.need[0]||1),0,1);return spr('fox'+st+(st?0:Math.floor(fr*4)),()=>{const c=mk(14,12),g=c.getContext('2d');
 if(!st){stake(g,14,12,fr);return c}R(g,3,3,8,6,'#2a2519');R(g,4,4,6,4,'#1d1a12');for(const [x,y] of [[2,2],[5,1],[8,1],[11,2],[1,5],[12,5],[2,8],[11,8]])R(g,x,y,2,2,'#a0926a');R(g,5,1,4,1,'#c4b78e');return c})}
function depotSpr(s){if(s.wreck)return spr('depW',()=>{const c=mk(22,18),g=c.getContext('2d');for(const [x,y,w] of [[3,9,5],[10,11,7],[15,7,4],[6,5,3]]){R(g,x,y,w,2,'#2b241b');R(g,x,y,w,1,'#4a3a28')}R(g,8,8,4,3,'#1c1a16');return c});
 const st=s.stage|0,fr=clamp(s.work/(s.need[Math.min(st,s.need.length-1)]||1),0,1);return spr('dep'+st+(st?0:Math.floor(fr*4)),()=>{const c=mk(22,18),g=c.getContext('2d');
 if(!st){stake(g,22,18,fr);return c}for(const [x,y] of [[3,8],[9,8],[15,8],[6,4],[12,4]]){R(g,x,y,6,5,'#6b4a2c');R(g,x,y,6,1,'#8a6a44');R(g,x+2,y+2,2,1,'#c9b26a')}
 if(st>=2){R(g,2,2,18,4,'#5d6249');R(g,2,2,18,1,'#7d8466');R(g,1,6,1,7,'#3f2c1a');R(g,20,6,1,7,'#3f2c1a')}R(g,2,14,18,2,'#a0926a');return c})}
function opSpr(s){const st=s.stage|0,fr=clamp(s.work/(s.need[Math.min(st,s.need.length-1)]||1),0,1);return spr('op'+st+(st?0:Math.floor(fr*4)),()=>{const c=mk(18,16),g=c.getContext('2d');
 if(!st){stake(g,18,16,fr);return c}R(g,4,5,10,7,'#2a2519');for(let x=2;x<16;x+=3){R(g,x,3,3,2,'#a0926a');R(g,x,12,3,2,'#978962')}R(g,2,5,2,7,'#a0926a');R(g,14,5,2,7,'#a0926a');
 if(st>=2){R(g,8,1,1,6,'#3c403a');R(g,7,0,3,1,'#6f756b');R(g,8,1,1,1,'#bcd2d8')}return c})}
function chevSpr(s){const st=s.stage|0;return spr('chev'+st,()=>{const c=mk(18,10),g=c.getContext('2d');if(!st){stake(g,18,10,clamp(s.work/(s.need[0]||1),0,1));return c}
 for(let k=0;k<3;k++){const x=2+k*5;R(g,x,2,1,6,'#6b4a2c');R(g,x+3,2,1,6,'#6b4a2c');R(g,x+1,4,2,1,'#553a24')}R(g,1,4,16,1,'#553a24');g.fillStyle='#222c28';for(let x=1;x<17;x+=2)g.fillRect(x,3+(x%4===1?0:3),1,1);return c})}

/* ---------- catálogo ---------- */
Object.assign(K,{
 foxhole:{need:[4],target:1,cost:8,label:'Toca individual: clique',box:{hw:8,hh:8},sprite:foxSpr,
  onStage:(s,st)=>{if(st>=1){PXSAP.addAnchor(s,{hw:9,hh:9,slots:1,pk:.75,line:'front'});S.stats.foxholes++;done(s)}}},
 depot:{need:[8,18],target:2,cost:90,label:'Depósito de munição (longe da frente): clique',box:{hw:14,hh:11},sprite:depotSpr,
  onStage:(s,st)=>{if(st===2){DEP.push({s,team:s.team,x:s.x,y:s.y,hp:CFG.DEPOT.hp,stock:CFG.DEPOT.stock});S.stats.depots++;done(s)}}},
 op:{need:[8,20],target:2,cost:80,label:'Posto de observação: clique',box:{hw:10,hh:9},sprite:opSpr,
  onStage:(s,st)=>{if(st===2){PXSAP.addAnchor(s,{hw:10,hh:9,slots:1,pk:.85,line:'support'});OPS.push({s,team:s.team,x:s.x,y:s.y,hp:250});S.stats.ops++;done(s)}}},
 chevaux:{need:[5],target:1,cost:22,label:'Cavalo de frisa (obstáculo portátil): clique',box:{hw:10,hh:6},sprite:chevSpr,
  onStage:(s,st)=>{if(st>=1){const b=newBuilding('wire',s.team,s.x,s.y);try{PXSAP.lineB&&PXSAP.lineB(b,0,1,30)}catch{}b.chev=1;S.stats.chevaux++;done(s)}}}});
for(const k of ['foxhole','depot','op','chevaux'])if(!F.KINDS.includes(k))F.KINDS.push(k);
Object.assign(F.SHORT,{foxhole:'Toca',depot:'Munição',op:'Observação',chevaux:'Frisa'});
Object.assign(F.SUB,{foxhole:'Cobertura de 1 homem',depot:'Remuniciar · explode se atingido',op:'Revela e corrige artilharia',chevaux:'Fecha brechas'});
/* plano da IA na trégua: 2 depósitos na retaguarda e 1 posto de observação perto da frente, no centro */
if(Array.isArray(F.planExtra))F.planExtra.push((t,FX,fc)=>[{kind:'depot',pts:[[FX-fc*300,600]],pri:48},{kind:'depot',pts:[[FX-fc*300,1000]],pri:60},{kind:'op',pts:[[FX-fc*40,800]],pri:44}]);

/* ---------- efeitos ---------- */
function resupply(){for(const d of DEP){if(d.stock<=0)continue;
 for(const u of units){if(u.team!==d.team||u.hp<=0||u.down||d.stock<=0)continue;if((u.x-d.x)**2+(u.y-d.y)**2>CFG.DEPOT.r**2)continue;
  if(u===player&&mode==='soldier'){let got=false;for(const k in magazines){const m=weapons[k]&&weapons[k].mag;if(m&&magazines[k]<m){magazines[k]=m;got=true}}if(weapon in magazines&&ammo<weapons[weapon].mag){ammo=weapons[weapon].mag;got=true}
   const base=u.cls==='grenadier'?6:u.cls==='assault'?4:2;if((u.gren||0)<base){u.gren=(u.gren||0)+1;got=true;S.stats.grenades++}if(got){d.stock--;S.stats.resupplied++;try{toast('Depósito: munição e granada repostas.')}catch{}}continue}
  let used=false;if(u.type==='rifle'&&u.ammo!==undefined&&u.ammo<5){u.ammo=5;u.rl=0;used=true}
  const base=u.cls==='grenadier'?6:u.cls==='assault'?4:u.cls==='medic'?0:u.type==='rifle'?2:0;if((u.gren||0)<base){u.gren=(u.gren||0)+1;used=true;S.stats.grenades++}
  if(u.type==='mg'&&u.atr&&u.atr.heat>0){u.atr.heat=Math.max(0,u.atr.heat-.3);used=true}
  if(used){d.stock--;S.stats.resupplied++}}
 if(window.PXBAT&&PXBAT.batteries)for(const b of PXBAT.batteries){if(b.team!==d.team||d.stock<=0||b.ammo==null)continue;if((b.x-d.x)**2+(b.y-d.y)**2>CFG.DEPOT.gr**2)continue;const cap=b._cap||(b._cap=Math.max(b.ammo,18));if(b.ammo<cap){b.ammo+=2;d.stock-=2;S.stats.shellsGiven+=2}}}}
function revealOP(){const f=window.PXW&&PXW.fow;if(!f||!f.on||!f.grid)return;const Rr=CFG.OP.fog,ch=Math.ceil(H/64);
 for(const o of OPS){if(o.team!==f.team)continue;for(let y=Math.max(0,Math.floor((o.y-Rr)/64));y<=Math.min(ch-1,Math.floor((o.y+Rr)/64));y++)for(let x=Math.max(0,Math.floor((o.x-Rr)/64));x<=Math.min(f.cw-1,Math.floor((o.x+Rr)/64));x++)if(hyp(x*64+32-o.x,y*64+32-o.y)<Rr)f.grid[y*f.cw+x]=1}}
if(window.PXBAT&&PXBAT.mission){const o=PXBAT.mission;PXBAT.mission=function(team,x,y,count,spread,kind,cb,strict){
 if(S.on&&kind!=='smoke'&&OPS.some(p=>p.team===team&&hyp(p.x-x,p.y-y)<CFG.OP.art)){spread*=CFG.OP.spread;S.stats.opCorrected++}return o.call(this,team,x,y,count,spread,kind,cb,strict)}}
/* pioneiros da IA cavam tocas à frente da própria linha quando o setor está parado */
let foxT=40;function aiFox(dt){if((foxT-=dt)>0)return;foxT=35;for(let t=0;t<2;t++){if(!aiEnabled[t]||!PXSAP.project)continue;const f=t?-1:1,front=fieldTrenches.filter(a=>a.team===t&&a.line==='front');if(!front.length)continue;
  const a=front[(Math.random()*front.length)|0],x=a.x+f*rnd(70,130),y=a.y+rnd(-20,20);if(units.some(u=>u.team!==t&&u.hp>0&&hyp(u.x-x,u.y-y)<220))continue;
  try{if(sandbox||supplies[t]>=K.foxhole.cost+60){if(PXSAP.project(t,'foxhole','ai',[[x,y]])&&!sandbox)supplies[t]-=K.foxhole.cost}}catch{}}}

/* ---------- ligações ---------- */
wrap('setup',(orig,...a)=>{DEP=[];OPS=[];tickT=0;restT=0;foxT=40;return orig(...a)});
wrap('update',(orig,dt)=>{orig(dt);if(!S.on||!started||ended||!(dt>0))return;try{
 if((tickT-=dt)<=0){tickT=CFG.DEPOT.every;resupply()}
 if((restT-=dt)<=0){restT=CFG.DEPOT.restock;for(const d of DEP)d.stock=Math.min(CFG.DEPOT.stock,d.stock+1)}
 revealOP();if(!(F.isPrep&&F.isPrep()))aiFox(dt);
 DEP=DEP.filter(d=>d.hp>0&&!(d.s&&d.s.dead));OPS=OPS.filter(o=>o.hp>0&&!(o.s&&o.s.dead))}catch(e){fail(e)}});
wrap('explode',(orig,x,y,r,power=100,team=0)=>{orig(x,y,r,power,team);if(!S.on)return;try{
 for(const d of DEP.slice()){const dd=hyp(d.x-x,d.y-y);if(dd>r+14)continue;d.hp-=power*(1-dd/(r+14))*1.4;if(d.hp<=0&&!d.boom){d.boom=1;if(d.s)d.s.wreck=1;S.stats.depotBlasts++;if(d.team===playerTeam)try{toast('Depósito de munição atingido: explosão secundária!')}catch{}
   setTimeout(()=>{try{explode(d.x,d.y,CFG.DEPOT.boomR,CFG.DEPOT.boomPow*2.5,1-d.team)}catch{}},0)}}
 for(const o of OPS){const dd=hyp(o.x-x,o.y-y);if(dd<r+10)o.hp-=power*(1-dd/(r+10))}}catch(e){fail(e)}});
/* desenho: estoque do depósito (só o seu lado) */
if(window.WW1A){const o0=WW1A.over;WW1A.over=function(c,ox,oy,dt){o0.call(this,c,ox,oy,dt);if(!S.on)return;try{const Z=(window.PX&&PX.Z)||.5;
 for(const d of DEP){if(d.team!==playerTeam)continue;const x=ox+Math.round(d.x*Z),y=oy+Math.round(d.y*Z)+8;if(x<-20||y<-20||x>vw+20||y>vh+20)continue;const f=d.stock/CFG.DEPOT.stock;
  c.fillStyle='#14160f';c.fillRect(x-7,y,14,3);c.fillStyle=f>.3?'#c9b26a':'#e0705a';c.fillRect(x-6,y+1,Math.max(1,Math.round(12*f)),1)}}catch(e){fail(e)}}}

S.state=()=>({on:S.on,depots:DEP.map(d=>({team:d.team,stock:d.stock,hp:Math.round(d.hp)})),ops:OPS.map(o=>({team:o.team,x:o.x|0,y:o.y|0})),stats:{...S.stats}});
S.depots=()=>DEP;S.ops=()=>OPS;S.resupply=resupply;
if(window.IronFront)window.IronFront.works=S;
})();
