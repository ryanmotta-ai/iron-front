'use strict';
/* Iron Front 1.9 — feridos, resgate por companheiros e cadeia médica (casualty.js).
   Carrega DEPOIS de art-medics.js, soldier-tactics.js e life-kit.js. Usa o MESMO estado de caído do medics.js (u.down /
   u.bleed): não cria um terceiro. Por cima dele:
   Ferido ......... gravidade sorteada ao cair: leve (35%: rasteja sozinho até cobertura, sangra 1,5× mais devagar), grave
                    (45%: imóvel, chama por socorro de tempos em tempos), crítico (20%: perde a consciência em 3–8 s, sangra
                    mais rápido). Em trincheira/cratera o sangramento corre a 45%; estabilizado por médico, quase para.
   Companheiros ... a cada 0,5 s os fuzileiros a até 130 px de um ferido avaliam ajudar: moral (coesão), supressão, inimigos
                    perto, ordem atual (quem está no assalto tende a seguir em frente) e o grito do ferido. No máximo 4 resgates
                    simultâneos por lado (médicos não contam). O resgate é físico: corre até ele → ajoelha e agarra (1,1 s)
                    → arrasta de costas a 40% da velocidade, de frente para o ferido → cobertura atrás (trincheira própria,
                    cratera) ou posto a até 450 px → entrega (catre do posto) ou deixa abrigado para os padioleiros.
                    Explosão perto ou supressão extrema interrompem: larga o ferido e se joga no chão.
   Médicos ........ (u.cls==='medic', classes.js) procuram feridos a até 300 px, sem limite de vagas; primeiros socorros em
                    4,5 s ajoelhados: o ferido leve volta à luta com 35% da vida; o grave/crítico fica estabilizado (+90 s e
                    sangramento quase parado) esperando a maca.
   Cadeia ......... campo → posto avançado (obra "Socorro", p.seg): triagem de 6–9 s; leve volta (85%), crítico morre
                    mais (30%); o resto segue de ambulância (14–22 s) → hospital de campanha (posto base): triagem no catre,
                    enfermaria (10 leitos), 2 cirurgiões em paralelo por prioridade (crítico → grave → leve), estoque de 24
                    kits (+1 a cada 20 s; sem estoque: cirurgia 1,6× mais lenta e mais mortes). Desfechos: volta ao combate,
                    incapacitado (baixa permanente), evacuado (baixa; 50% voltam da convalescença como reforço em 120 s)
                    ou morte. Quem está na enfermaria sai de `units` (não ocupa vaga de tropa, não é desenhado).
   Modo soldado ... E perto de um aliado caído: agarrar e arrastar (você anda a 40% e não atira); E de novo larga; chegando
                    a um posto, entrega sozinho. Médico jogador: E aplica primeiros socorros (4,5 s parado).
   ?feridos=0 desliga · IronFront.casualty.state() · PXCAS.stats. */
(function(){
if(!window.PXMED||!window.IFK)return;
const M=PXMED,K=IFK,Z=K.Z,hyp=Math.hypot;
const Policy=window.IronFrontSupport;
const rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>v<a?a:v>b?b:v;
const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('casualty.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};
const CFG={SCAN:.5,BUDDY_R:130,MEDIC_R:300,MAXBUDDY:4,DRAG:.4,GRAB:1.1,AID:4.5,AID_BLEED:90,HAND_R:30,ABORT_SUPP:1.55,
 SEV:{light:.35,serious:.45,critical:.2},BLEEDX:{light:1.5,serious:1,critical:.65},CRAWL:9,COVER_SLOW:.55,STAB_SLOW:.4,
 POST_T:[6,9],TRIAGE_T:[4,6],TRANSIT:[14,22],SURG:[10,16],DOCTORS:2,STOCK:24,RESTOCK:20,WARD:10,CONVAL:120,CONVAL_P:.5,
 OUT_POST:{light:[.85,.03],serious:[.3,.1],critical:[.05,.3]},                 // [volta, morre]; o resto vai ao hospital
 OUT_HOSP:{light:[.85,.07,.06,.02],serious:[.55,.15,.2,.1],critical:[.2,.2,.3,.3]}};  // [volta, incapacitado, evacuado, morre]
const RANK={critical:3,serious:2,light:1};
const S=window.PXCAS={on:!/[?&]feridos=0/.test(location.search)&&K.on,version:'1.9',cfg:CFG,
 stats:{wounded:0,crawled:0,buddyStarts:0,buddyDone:0,aborted:0,medicAid:0,fieldReturn:0,postReturn:0,hospReturn:0,transfers:0,
  incapacitated:0,evacuated:0,convalesced:0,died:0,playerDrags:0,toCrew:0,errors:0}};
const LOG=[];function log(ev,u,extra){LOG.push({t:Math.round(time*10)/10,ev,id:u&&u.id,team:u&&u.team,sev:u&&u.cz&&u.cz.sev,...extra});if(LOG.length>80)LOG.shift()}
let errs=0,scanT=0,HID=[],WARDS=new Map(),CONV=[],PD=null;   // PD = arraste do jogador
function fail(e){S.stats.errors++;if(++errs<=3)console.error('casualty.js:',e);if(errs>=12){S.on=false;console.error('casualty.js desligado após erros repetidos')}}
const own=t=>t===playerTeam;
const back=t=>t?1:-1;                                   // direção da própria retaguarda em x (EUA a oeste, Alemanha a leste)
function enemiesNear(team,x,y,r){let n=0;const r2=r*r;for(const e of units)if(e.team!==team&&e.hp>0&&!e.down&&(e.x-x)**2+(e.y-y)**2<r2)n++;return n}
const soldierP=u=>u===player&&mode==='soldier';

/* ======================================================================================
   FERIDO
   ====================================================================================== */
function sevRoll(){const r=Math.random();return r<CFG.SEV.light?'light':r<CFG.SEV.light+CFG.SEV.serious?'serious':'critical'}
function initWound(u){const sev=sevRoll();u.cz={sev,st:'down',at:time,ko:sev==='critical'?time+rnd(3,8):Infinity,callT:time+rnd(1.5,4),stab:false,cover:false,res:null,dropT:-9,crawl:null};
 const left=(u.bleed||time+60)-time;u.bleed=time+left*CFG.BLEEDX[sev];S.stats.wounded++;
 if(sev!=='critical')K.shout(u,'pain',1);return u.cz}
function inCover(u){try{return protectedBy(u)<.5}catch{return false}}
function crawlGoal(u){/* trincheira própria mais perto até 160 px, senão cratera até 100 px, senão 60 px para trás */
 let best=null,bd=160*160;for(const t of fieldTrenches){if(t.team!==u.team)continue;const d=(t.x-u.x)**2+(t.y-u.y)**2;if(d<bd){bd=d;best={x:t.x,y:t.y}}}
 if(!best){bd=100*100;for(const c of allCraters){const d=(c.x-u.x)**2+(c.y-u.y)**2;if(d<bd){bd=d;best={x:c.x,y:c.y}}}}
 return best||{x:clamp(u.x+back(u.team)*60,20,W-20),y:u.y}}
function woundTick(u,dt){const z=u.cz;if(z.st==='bed')return;
 const conscious=time<z.ko;if(!conscious&&z.st!=='ko'&&z.st!=='drag'){z.st='ko'}
 /* sangramento: cobertura e estabilização seguram o relógio do medics.js (u.bleed é absoluto) */
 if(z.cover)u.bleed+=dt*CFG.COVER_SLOW;
 if(z.stab)u.bleed+=dt*CFG.STAB_SLOW;
 if(z.res||u.claimed||u.carried)return;
 if(!conscious)return;
 /* leve: rasteja sozinho até cobertura */
 if(z.sev==='light'&&!z.cover){if(!z.crawl){z.crawl=crawlGoal(u);z.st='crawl';S.stats.crawled++}
  const dx=z.crawl.x-u.x,dy=z.crawl.y-u.y,d=hyp(dx,dy);
  if(d<6){z.cover=true;if(z.cover){z.st='cover';z.crawl=null}}
  if(!z.cover&&d>=6){const s=Math.min(d,CFG.CRAWL*dt);u.x+=dx/d*s;u.y+=dy/d*s;u.angle=Math.atan2(dy,dx)}}
 /* chama por socorro */
 if(time>z.callT&&z.sev!=='critical'){z.callT=time+rnd(6,12);if(K.shout(u,u.bleed-time<20?'help':'medic',1.6))z.called=time}}

/* ======================================================================================
   RESGATE (IA)
   ====================================================================================== */
const BUDDY={medic:1,rifle:.6,assault:.35,grenadier:.5,marksman:.4,observer:.35};
function canRescue(r){return r.type==='rifle'&&r.hp>r.maxhp*.35&&!r.down&&!r.rs&&!soldierP(r)&&!r.sapJob&&!r.pinned&&!r.post&&!(r.cls==='observer'&&r.obs)&&
 !r.sap&&!(r.manualUntil>time)&&!(window.PXBAT&&PXBAT.isCrew&&PXBAT.isCrew(r))}
function score(r,w,d){const base=BUDDY[r.cls||'rifle']??.55;let s=base*(.4+.6*(r.cohesion??1))*(1-Math.min(1,(r.suppression||0)/1.2));
 const en=enemiesNear(r.team,w.x,w.y,150);s*=en===0?1:en===1?.5:.15;
 if(w.cz.called&&time-w.cz.called<4)s*=1.4;
 if(r.order==='attack'&&/avan|ruptura|escolta|assalto/.test(r.aiRole||''))s*=.5;
 s*=1-d/(r.cls==='medic'?CFG.MEDIC_R:CFG.BUDDY_R)*.5;return s}
function scan(){const busy=[0,0];for(const u of units)if(u.rs&&u.cls!=='medic')busy[u.team]++;
 const patients=Policy?units.filter(w=>w.down&&w.cz).sort((a,b)=>(a.bleed-time)/RANK[a.cz.sev]-(b.bleed-time)/RANK[b.cz.sev]||a.id-b.id):units;
 for(const w of patients){if(!w.down||!w.cz||w.inBed||w.carried)continue;if(w.cz.st!=='drag'&&!w.cz.cover&&inCover(w)){w.cz.cover=true;if(w.cz.st==='down'||w.cz.st==='crawl'){w.cz.st='cover';w.cz.crawl=null}}
  if(w.cz.res||time<w.cz.dropT||w.claimed&&!crewFar(w))continue;
  let best=null,bs=0;
  for(const r of units){if(r.team!==w.team||!canRescue(r))continue;const med=r.cls==='medic',R=med?CFG.MEDIC_R:CFG.BUDDY_R,d=hyp(r.x-w.x,r.y-w.y);if(d>R)continue;
   if(!med&&busy[r.team]>=CFG.MAXBUDDY||r.medAvoid?.id===w.id&&r.medAvoid.until>time)continue;
   const triage=Policy?Policy.triage(M.context(r.team,r),r,w,47,med?CFG.AID:CFG.GRAB):0;if(!Number.isFinite(triage))continue;
   if(Policy&&med&&w.cz.stab&&w.cz.cover)continue;
   const s=score(r,w,d)*(Policy?1+Math.max(0,triage)*.05:1);if(s>bs){bs=s;best=r}}
  if(best&&(Policy&&best.cls==='medic'||Math.random()<Math.min(1,bs))){start(best,w);if(best.cls!=='medic')busy[best.team]++}}}
/* a maca ainda está longe (> 160 px): quem está perto começa o socorro; a maca segue o ferido e assume quando chega */
const crewFar=w=>{const c=w.claimed;return !!c&&c.st==='go'&&c.x!=null&&hyp(c.x-w.x,c.y-w.y)>160};
const crewHere=w=>{const c=w.claimed;return !!c&&c.st!=='buddy'&&(c.st!=='go'||c.x!=null&&hyp(c.x-w.x,c.y-w.y)<40)};
function start(r,w){log('rescue',w,{by:r.id,cls:r.cls||'rifle',crew:!!w.claimed});r.rs={w,st:'go',t:0,t0:time,dest:null,progress:time,lastDistance:hyp(r.x-w.x,r.y-w.y),resume:{tx:r.tx,ty:r.ty,order:r.order,role:r.aiRole}};if(!w.claimed)w.claimed={st:'buddy',t:0,by:r};w.cz.res=r;S.stats.buddyStarts++;
 K.shout(r,r.cls==='medic'?'hold':'cover',1.3)}
function release(r,ok,why){const w=r.rs&&r.rs.w,resume=r.rs?.resume,human=r.manualUntil>time&&r.manualUntil!==r.rescueStamp;if(why){S.why[why]=(S.why[why]||0)+1}r.rs=null;
 if(!human){r.aiRole=resume?.role||'';r.manualUntil=0;r.order=resume?.order||'hold';r.tx=resume?.tx??r.x;r.ty=resume?.ty??r.y}r.rescueStamp=0;
 if(w&&w.cz){w.cz.res=null;if(w.claimed&&w.claimed.st==='buddy')w.claimed=null;if(!ok)w.cz.dropT=time+6;if(w.cz.st==='drag')w.cz.st=w.cz.cover?'cover':'down'}}
function abort(r,why){S.stats.aborted++;log('abort',r,{why});const w=r.rs&&r.rs.w;if(w)r.medAvoid={id:w.id,until:time+35};release(r,false,'abortou: '+why);r.suppression=Math.max(r.suppression||0,1.6);
 if(r.pv)r.pv.stun=Math.max(r.pv.stun||0,.4);K.shout(r,'down',1.2);if(w&&own(w.team)&&why)S.lastAbort=why}
function chooseDest(r,w){let best=null,bd=450*450;
 const ctx=Policy?M.context(r.team,r):null;
 for(const p of M.posts){if(p.team!==r.team||p.hp<=0||Policy&&!M.capacity(p))continue;const d=(p.x-w.x)**2+(p.y-w.y)**2;if(d>450*450)continue;const weighted=d+(Policy?Policy.risk(ctx,p)*12000:0);if(weighted<bd){bd=weighted;best={x:p.x,y:p.y+16,kind:'post',post:p}}}
 if(best&&bd<260*260)return best;
 /* cobertura atrás: trincheira própria ou cratera, no máximo 220 px e não mais perto do inimigo */
 let cv=null,cd=220*220;const bx=back(r.team);
 for(const t of fieldTrenches){if(t.team!==r.team||t.hp<=0||Policy&&Policy.risk(ctx,t)>5)continue;if((t.x-w.x)*bx<-10)continue;const d=(t.x-w.x)**2+(t.y-w.y)**2;if(d<cd){cd=d;cv={x:t.x,y:t.y,kind:'cover'}}}
 if(!cv)for(const c of allCraters){if((c.x-w.x)*bx<0)continue;const d=(c.x-w.x)**2+(c.y-w.y)**2;if(d<Math.min(cd,140*140)){cd=d;cv={x:c.x,y:c.y,kind:'cover'}}}
 if(inCover(w)&&!best)return {x:w.x,y:w.y,kind:'here'};
 return cv||best||{x:clamp(w.x+bx*110,20,W-20),y:w.y,kind:'back'}}
function handOver(r,w,dest){const p=dest.post;
 if(dest.kind==='post'&&p&&p.hp>0&&p.beds.length<M.cfg.BEDS){const b=M.bedPos(p,p.beds.length);p.beds.push(w);w.x=b.x;w.y=b.y;w.claimed=null;w.cz.res=null;w.cz.st='bed';
  w.inBed=time+1e6;w.cz.bedEnd=time+rnd(...(p.seg?CFG.POST_T:CFG.TRIAGE_T));w.cz.post=p}
 else{w.cz.cover=dest.kind!=='back'||inCover(w);w.cz.st=w.cz.cover?'cover':'down'}
 S.stats.buddyDone++;log('handover',w,{to:dest.kind,st:w.cz&&w.cz.st})}
function rescueTick(r,dt){const z=r.rs,w=z.w;
 if(r.manualUntil>time&&r.manualUntil!==r.rescueStamp){release(r,false,'ordem do jogador');return}
 if(r.hp<=0||r.down){release(r,false,'resgatador caiu');return}
 if(!w||w.hp<=0||!w.down||w.inBed||w.carried||crewHere(w)){if(w&&crewHere(w)&&w.cz&&w.cz.st==='drag')S.stats.toCrew++;release(r,true,!w||w.hp<=0?'ferido morreu':!w.down?'ferido levantou':crewHere(w)||w.carried?'maca chegou':'leito');return}
 r.target=null;r.cd=Math.max(r.cd||0,.4);r.manualUntil=r.rescueStamp=time+1;r.aiRole='socorro';r.dodgeUntil=0;
 if((r.suppression||0)>CFG.ABORT_SUPP&&Math.random()<dt*1.5){abort(r,'supressão');return}
 if(z.st==='go'){const d=hyp(w.x-r.x,w.y-r.y);if(d<z.lastDistance-5){z.lastDistance=d;z.progress=time}
  if(Policy&&time-z.progress>12){r.medAvoid={id:w.id,until:time+35};release(r,false,'rota bloqueada');return}
  const goal=Policy?Policy.route(M.context(r.team,r),r,w):w;r.order='move';r.tx=goal.x;r.ty=goal.y;
  if(d<11){if(soldierP(w)){release(r,true);return}/* o soldier-tactics levanta o jogador com um aliado a < 20 px */
   z.st='grab';z.t=CFG.GRAB;r.order='hold';r.tx=r.x;r.ty=r.y;K.shout(r,'grab',1)}
  else if(time-z.t0>30)release(r,false,'não chegou');return}
 r.order='hold';r.tx=r.x;r.ty=r.y;r.angle=Math.atan2(w.y-r.y,w.x-r.x);
 if(z.st==='grab'){z.t-=dt;if(z.t>0)return;
  if(r.cls==='medic'&&!w.cz.stab&&(inCover(w)||enemiesNear(r.team,w.x,w.y,150)===0)){z.st='aid';z.t=CFG.AID;return}
  z.dest=chooseDest(r,w);if(z.dest.kind==='here'){w.cz.cover=true;if(r.cls==='medic'&&!w.cz.stab){z.st='aid';z.t=CFG.AID}else{release(r,true)}return}
  z.st='drag';w.cz.st='drag';return}
 if(z.st==='aid'){z.t-=dt;if(Math.random()<dt*3)particles.push({x:w.x+rnd(-3,3),y:w.y-2,vx:0,vy:-8,t:.3,max:.3,color:'#efeee2',size:2});
  if(z.t>0)return;stabilize(w,r);if(w.down&&!inCover(w)&&w.cz.sev!=='light'){z.dest=chooseDest(r,w);if(z.dest.kind!=='here'){z.st='drag';w.cz.st='drag';return}}
  release(r,true);return}
 if(z.st==='drag'){if(Policy&&z.dest.kind==='post'&&(z.dest.post.hp<=0||z.dest.post.beds.length>=M.cfg.BEDS))z.dest=chooseDest(r,w);
  const D=z.dest,dx=D.x-r.x,dy=D.y-r.y,d=hyp(dx,dy),goal=Policy?Policy.route(M.context(r.team,r),r,D):D;r.order='move';r.tx=goal.x;r.ty=goal.y;
  if(d<(D.kind==='post'?CFG.HAND_R:12)){handOver(r,w,D);release(r,true);return}}}
/* o ferido acompanha quem arrasta: atrás dele no sentido da marcha, e a poeira marca o rastro */
function trail(r,w,tx,ty,dt){const dx=tx-r.x,dy=ty-r.y,d=hyp(dx,dy)||1;w.x=r.x-dx/d*8;w.y=r.y-dy/d*8;w.angle=Math.atan2(dy,dx);
 if(r.moving!==false&&Math.random()<dt*5)particles.push({x:w.x+rnd(-2,2),y:w.y+4,vx:rnd(-6,6),vy:rnd(-4,0),t:.5,max:.5,color:'#8d7b5a',size:3})}
function stabilize(w,by){const z=w.cz;S.stats.medicAid++;z.stab=true;w.bleed=Math.max(w.bleed,time)+CFG.AID_BLEED;
 if(z.sev==='light'){returnToFight(w,'field');return}
 if(z.sev==='critical')z.sev='serious';K.shout(by,'clear',1)}

/* ======================================================================================
   CADEIA MÉDICA: posto avançado → ambulância → hospital de campanha
   ====================================================================================== */
function hospitalOf(team){let h=null;for(const p of M.posts)if(p.team===team&&!p.seg&&p.hp>0){h=p;break}return h}
function ward(p){let w=WARDS.get(p.id);if(!w){w={p,queue:[],surg:[],stock:CFG.STOCK,rest:time};WARDS.set(p.id,w)}return w}
function hide(u){const i=units.indexOf(u);if(i>=0)units.splice(i,1);u.cz.hid=true;HID.push(u);try{selected.delete(u.id)}catch{}}
function unhide(u,x,y){const i=HID.indexOf(u);if(i>=0)HID.splice(i,1);u.x=x;u.y=y;if(u.pv){u.pv.vx=u.pv.vy=u.pv.kx=u.pv.ky=0}u._qx=x;u._qy=y;units.push(u)}
function clearDown(u){u.down=false;u.inBed=0;u.carried=false;u.claimed=null;u.cz=null}
function returnToFight(u,where,p){log('return',u,{where});const hid=u.cz&&u.cz.hid,fh=where==='field';clearDown(u);
 u.hp=Math.max(u.hp,u.maxhp*(fh?.35:.6));u.order='hold';u.manualUntil=0;u.aiRole='';u.suppression=0;u.cohesion=Math.max(.5,u.cohesion??1);u.target=null;
 if(hid){const f=p?back(p.team):0;unhide(u,clamp(p.x-f*28+rnd(-8,8),20,W-20),clamp(p.y+26+rnd(-6,6),20,H-20))}
 u.tx=u.x;u.ty=u.y;
 S.stats[fh?'fieldReturn':where==='post'?'postReturn':'hospReturn']++;
 if(own(u.team)&&!fh)say(`Socorro: um soldado voltou à luta (${S.stats.postReturn+S.stats.hospReturn} pelos postos).`)}
function die(u){log('die',u);if(u.cz&&u.cz.hid){const i=HID.indexOf(u);if(i>=0)HID.splice(i,1);tickets[u.team]=Math.max(0,tickets[u.team]-1);u.hp=0;S.stats.died++;return}
 clearDown(u);S.stats.died++;damage(u,9999)}
function removeLoss(u,kind){/* baixa sem corpo no campo: incapacitado ou evacuado */
 if(u.cz&&u.cz.hid){const i=HID.indexOf(u);if(i>=0)HID.splice(i,1)}else{const i=units.indexOf(u);if(i>=0)units.splice(i,1)}
 tickets[u.team]=Math.max(0,tickets[u.team]-1);u.hp=0;const team=u.team;u.down=false;
 log(kind,u,{why:u._why});if(kind==='evac'){S.stats.evacuated++;CONV.push({team,at:time+CFG.CONVAL})}else S.stats.incapacitated++}
function roll(p){const r=Math.random();let a=0;for(let i=0;i<p.length;i++){a+=p[i];if(r<a)return i}return p.length}
function bedsTick(){for(const p of M.posts){for(let i=p.beds.length-1;i>=0;i--){const u=p.beds[i];if(p.beds.indexOf(u)!==i||u.hp<=0){p.beds.splice(i,1);continue}if(!u.cz)initWound(u);const z=u.cz;
  if(z.st!=='bed'){z.st='bed';z.res=null;u.inBed=time+1e6;z.bedEnd=time+rnd(...(p.seg?CFG.POST_T:CFG.TRIAGE_T));z.post=p;continue}
  u.inBed=time+1e6;if(time<z.bedEnd)continue;
  p.beds.splice(i,1);u.inBed=0;
  if(p.seg){const o=CFG.OUT_POST[z.sev],k=roll(o);if(k===0)returnToFight(u,'post',p);else if(k===1)die(u);else transfer(u,p)}
  else toWard(u,p)}}}
function transfer(u,from){const h=hospitalOf(u.team);S.stats.transfers++;log('transfer',u);if(!h){u._why='sem hospital';hide(u);removeLoss(u,'evac');return}
 hide(u);u.cz.st='transit';u.cz.until=time+rnd(...CFG.TRANSIT);u.cz.h=h}
function toWard(u,h){const w=ward(h);if(!u.cz.hid)hide(u);if(w.queue.length+w.surg.length>=CFG.WARD){u._why='enfermaria lotada';removeLoss(u,'evac');return}
 u.cz.st='ward';u.cz.h=h;w.queue.push(u);w.queue.sort(byPri)}
const byPri=(a,b)=>RANK[b.cz.sev]-RANK[a.cz.sev]||a.cz.at-b.cz.at;
function wardsTick(){for(const [id,w] of WARDS){const p=w.p;
  if(!M.posts.includes(p)||p.hp<=0){for(const u of [...w.queue,...w.surg])removeLoss(u,'evac');WARDS.delete(id);continue}
  if(time-w.rest>CFG.RESTOCK){w.rest=time;w.stock=Math.min(CFG.STOCK,w.stock+1)}
  for(let i=w.surg.length-1;i>=0;i--){const u=w.surg[i];if(time<u.cz.until)continue;w.surg.splice(i,1);
   const o=CFG.OUT_HOSP[u.cz.sev].slice();if(u.cz.low){o[0]*=.8;o[3]*=1.5}const k=roll(o);
   if(k===0)returnToFight(u,'hosp',p);else if(k===1)removeLoss(u,'incap');else if(k===2)removeLoss(u,'evac');else die(u)}
  while(w.surg.length<CFG.DOCTORS&&w.queue.length){w.queue.sort(byPri);const u=w.queue.shift();
   u.cz.st='surgery';u.cz.low=w.stock<=0;u.cz.until=time+rnd(...CFG.SURG)*(u.cz.low?1.6:1);if(w.stock>0)w.stock--;w.surg.push(u)}}}
function hiddenTick(){for(const u of HID.slice()){const z=u.cz;if(!z)continue;
  if(z.st==='transit'&&time>=z.until){if(z.h&&M.posts.includes(z.h)&&z.h.hp>0)toWard(u,z.h);else removeLoss(u,'evac')}}
 for(let i=CONV.length-1;i>=0;i--){const c=CONV[i];if(time<c.at)continue;CONV.splice(i,1);if(Math.random()<CFG.CONVAL_P){tickets[c.team]++;S.stats.convalesced++;
   if(own(c.team))say('Convalescença: um soldado evacuado voltou como reforço.')}}}
let sayAt=-99;function say(m){if(time-sayAt<8)return;sayAt=time;try{toast(m)}catch{}}

function positionMedics(){if(!Policy)return;for(const r of units){if(r.cls!=='medic'||r.rs||!canRescue(r))continue;
 const ctx=M.context(r.team,r),near=units.filter(u=>u.team===r.team&&u.hp>0&&!u.down&&!u.sap&&u.cls!=='medic'&&hyp(u.x-r.x,u.y-r.y)<450);
 let goal=null,score=Infinity;for(const u of near){const p={x:clamp(u.x+back(r.team)*85,20,W-20),y:u.y};let cost=hyp(p.x-r.x,p.y-r.y)*.02+Policy.risk(ctx,p)*4;
  cost+=units.filter(other=>other!==r&&other.team===r.team&&other.cls==='medic'&&!other.down&&hyp(other.tx-p.x,other.ty-p.y)<55).length*2;
  if(cost<score){score=cost;goal=p}}
 if(!goal){const p=M.posts.filter(p=>p.team===r.team&&p.hp>0).sort((a,b)=>hyp(a.x-r.x,a.y-r.y)-hyp(b.x-r.x,b.y-r.y))[0];goal=p?{x:p.x,y:p.y+40}:{x:r.x,y:r.y}}
 const p=Policy.route(ctx,r,goal);r.tx=p.x;r.ty=p.y;r.order=hyp(goal.x-r.x,goal.y-r.y)>24?'move':'hold';r.target=null;r.aiRole='apoio-medico';
 }}

/* ======================================================================================
   JOGADOR: arrastar / primeiros socorros (E)
   ====================================================================================== */
function nearDown(r,R=22){let best=null,bd=R*R;for(const w of units){if(w===r||!w.down||w.team!==r.team||w.inBed||w.carried)continue;if(w.claimed&&w.claimed.st!=='buddy')continue;
 const d=(w.x-r.x)**2+(w.y-r.y)**2;if(d<bd){bd=d;best=w}}return best}
function playerKey(){if(!S.on||mode!=='soldier'||!player||player.type!=='rifle'||player.down||player.isDowned)return false;
 if(PD){if(PD.st==='aid'){PD=null;return true}dropPlayer(false);return true}
 const w=nearDown(player);if(!w)return false;if(!w.cz)initWound(w);
 if(w.cz.res&&w.cz.res!==player)release(w.cz.res,true);
 w.claimed={st:'buddy',t:0,by:player};w.cz.res=player;
 if(player.cls==='medic'&&!w.cz.stab){PD={w,st:'aid',t:CFG.AID,x:player.x,y:player.y};toast('Primeiros socorros… fique parado.');return true}
 PD={w,st:'grab',t:.6};w.cz.st='drag';S.stats.playerDrags++;toast('Arrastando o ferido · E solta · leve até um posto de socorro ou trincheira.');return true}
function dropPlayer(delivered){if(!PD)return;const w=PD.w;PD=null;if(!w||!w.cz)return;
 if(!delivered){w.cz.cover=inCover(w);w.cz.st=w.cz.cover?'cover':'down';w.cz.res=null;if(w.claimed&&w.claimed.st==='buddy')w.claimed=null;
  if(w.cz.cover)toast('Ferido deixado abrigado: os padioleiros vão buscá-lo.')}}
function playerTick(dt){if(!PD)return;const w=PD.w;
 if(mode!=='soldier'||!player||player.hp<=0||player.down||!w||w.hp<=0||!w.down||w.inBed){if(w&&w.cz){w.cz.res=null;if(w.claimed&&w.claimed.st==='buddy')w.claimed=null}PD=null;return}
 player.cd=Math.max(player.cd||0,.25);
 if(PD.st==='aid'){if(hyp(player.x-PD.x,player.y-PD.y)>3){toast('Primeiros socorros interrompidos.');w.cz.res=null;w.claimed=null;PD=null;return}
  PD.t-=dt;if(PD.t<=0){stabilize(w,player);if(w.cz){w.cz.res=null;w.claimed=null}PD=null;toast(w.down?'Ferido estabilizado: aguenta até a maca.':'Curativo feito: ele voltou à luta.')}return}
 if(PD.st==='grab'){PD.t-=dt;if(PD.t<=0)PD.st='drag';return}
 /* sentido da marcha = último deslocamento do jogador; parado, o ferido fica onde está */
 const mx=player.x-(PD.lx??player.x),my=player.y-(PD.ly??player.y);if(mx*mx+my*my>.01){PD.dx=mx;PD.dy=my}PD.lx=player.x;PD.ly=player.y;
 if(PD.dx==null){PD.dx=player.x-w.x;PD.dy=player.y-w.y}trail(player,w,player.x+PD.dx*50,player.y+PD.dy*50,dt);player.angle=Math.atan2(w.y-player.y,w.x-player.x);
 for(const p of M.posts)if(p.team===player.team&&p.hp>0&&hyp(p.x-player.x,p.y+16-player.y)<CFG.HAND_R+8){handOver(player,w,{kind:'post',post:p,x:p.x,y:p.y});PD=null;
  toast(w.cz&&w.cz.st==='bed'?'Ferido entregue ao posto de socorro.':'Posto lotado: ferido deixado ao lado para os padioleiros.');return}}
S.playerKey=playerKey;K.ePri.push(()=>S.on&&mode==='soldier'&&player&&(!!PD||player.type==='rifle'&&!player.down&&!!nearDown(player)));S.playerBusy=()=>!!PD;
window.addEventListener('keydown',e=>{if((e.key||'').toLowerCase()!=='e'||e.repeat)return;if(document.querySelector('dialog[open]'))return;
 try{if(playerKey()){e.preventDefault();e.stopImmediatePropagation()}}catch(err){fail(err)}},true);

/* ======================================================================================
   LIGAÇÕES
   ====================================================================================== */
const PRE=[];
function reset(){LOG.length=0;S.why={};HID=[];WARDS=new Map();CONV=[];PD=null;scanT=0;for(const k in S.stats)S.stats[k]=0}
function tick(dt){
 for(const u of units){if(u.down){if(!u.cz)initWound(u);if(!soldierP(u))woundTick(u,dt)}else if(u.cz&&!u.cz.hid)u.cz=null}
 for(const r of units)if(r.rs)rescueTick(r,dt);
 for(const r of PRE){if(r.hp>0&&r.rs&&r.rs.st==='drag'&&r.rs.w){trail(r,r.rs.w,r.tx,r.ty,dt)}}
 playerTick(dt);
 if((scanT-=dt)<=0){scanT=CFG.SCAN;scan();positionMedics()}
 bedsTick();wardsTick();hiddenTick()}
wrap('setup',(orig,...a)=>{const r=orig(...a);try{reset()}catch(e){fail(e)}return r});
wrap('update',(orig,dt)=>{if(!S.on||!started||ended)return orig(dt);
 /* arrastar é lento: escala o deslocamento de quem arrasta (o jogo e a física moveram à velocidade normal) */
 PRE.length=0;for(const r of units)if(r.rs&&(r.rs.st==='drag'||r.rs.st==='grab'||r.rs.st==='aid')){r._cax=r.x;r._cay=r.y;PRE.push(r)}
 const pl=PD&&player?{x:player.x,y:player.y,f:PD.st==='drag'?CFG.DRAG:0}:null;
 orig(dt);
 try{for(const r of PRE){const f=r.rs&&r.rs.st==='drag'?CFG.DRAG:0;r.x=r._cax+(r.x-r._cax)*f;r.y=r._cay+(r.y-r._cay)*f}
  if(pl&&player){player.x=pl.x+(player.x-pl.x)*pl.f;player.y=pl.y+(player.y-pl.y)*pl.f}
  tick(dt)}catch(e){fail(e)}});
wrap('explode',(orig,x,y,r,power=100,team=0)=>{orig(x,y,r,power,team);if(!S.on)return;try{
 for(const u of units){if(!u.rs||u.cls==='medic'&&Math.random()<.5)continue;const d=hyp(u.x-x,u.y-y);if(d<r*1.3&&Math.random()<.55)abort(u,'explosão')}
 if(PD&&player&&hyp(player.x-x,player.y-y)<r*1.2){toast('A explosão te jogou no chão: você largou o ferido.');dropPlayer(false)}}catch(e){fail(e)}});
/* relatório médico na tela de resultado */
wrap('finish',(orig,win)=>{orig(win);try{if(!S.on)return;const s=S.stats,el=document.getElementById('resulttext');if(!el)return;
 el.textContent+=` Socorro: ${s.wounded} feridos graves · ${s.buddyDone} resgatados por companheiros · ${s.fieldReturn+s.postReturn+s.hospReturn} voltaram à luta · ${s.evacuated} evacuados · ${s.incapacitated} incapacitados · ${s.died} morreram dos ferimentos.`}catch(e){fail(e)}});

/* ---------- desenho: quem socorre ajoelha / arrasta de costas; o ferido arrastado vai deitado no rastro ---------- */
if(window.PHYS){const d0=PHYS.draw||(()=>false);PHYS.draw=function(c,u,sp,sx,sy,vis,bob){
 if(!S.on)return d0.call(PHYS,c,u,sp,sx,sy,vis,bob);
 try{const z=u.rs,pd=PD&&u===player;
  if(z&&(z.st==='grab'||z.st==='aid')||pd&&PD.st!=='drag')return K.pose(c,sp,sx,sy,vis,bob,{crouch:1,u});
  if(z&&z.st==='drag'||pd)return K.pose(c,sp,sx,sy,vis,bob,{crouch:1,u,dy:((time*6+u.id)|0)%2?0:-1});
 }catch(e){fail(e)}
 return d0.call(PHYS,c,u,sp,sx,sy,vis,bob)}}
function drawOver(c,ox,oy){if(mode!=='soldier'||!player||player.down)return;
 const w=PD?null:nearDown(player,30);let txt=null,x,y;
 if(PD){txt=PD.st==='aid'?'SOCORRENDO...':'[E] SOLTAR';x=player.x;y=player.y}
 else if(w&&player.type==='rifle'){txt=player.cls==='medic'&&w.cz&&!w.cz.stab?'[E] PRIMEIROS SOCORROS':'[E] ARRASTAR';x=w.x;y=w.y}
 if(!txt)return;const sx=ox+Math.round(x*Z)-(K.textW(txt)>>1),sy=oy+Math.round(y*Z)+9;c.fillStyle='rgba(18,20,14,.75)';c.fillRect(sx-2,sy-2,K.textW(txt)+4,9);K.text(c,txt,sx,sy,'#e9e3b4');
 if(PD&&PD.st==='aid'){const f=1-PD.t/CFG.AID;c.fillStyle='#2b2f24';c.fillRect(sx,sy+8,K.textW(txt),2);c.fillStyle='#d8ecb0';c.fillRect(sx,sy+8,Math.round(K.textW(txt)*f),2)}}
if(window.WW1A){const o0=WW1A.over;WW1A.over=function(c,ox,oy,dt){o0.call(this,c,ox,oy,dt);if(!S.on)return;try{drawOver(c,ox,oy)}catch(e){fail(e)}}}

S.state=()=>({on:S.on,stats:{...S.stats},down:[0,1].map(t=>units.filter(u=>u.team===t&&u.down).length),
 rescuers:units.filter(u=>u.rs).map(u=>({id:u.id,cls:u.cls||'rifle',st:u.rs.st})),hidden:HID.map(u=>({id:u.id,st:u.cz&&u.cz.st,sev:u.cz&&u.cz.sev})),
 wards:[...WARDS.values()].map(w=>({team:w.p.team,queue:w.queue.length,surgery:w.surg.length,stock:w.stock})),conval:CONV.length,player:PD?PD.st:null});
S.log=LOG;S.why={};S.reset=reset;S.tick=tick;S.start=start;S.release=release;S.initWound=initWound;S.chooseDest=chooseDest;
Object.defineProperty(S,'hidden',{get:()=>HID});Object.defineProperty(S,'wards',{get:()=>WARDS});
if(window.IronFront)window.IronFront.casualty=S;
})();
