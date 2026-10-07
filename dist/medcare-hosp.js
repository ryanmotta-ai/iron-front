'use strict';
/* Iron Front 1.11 — hospital de campanha e posto de socorro vivos (medcare-hosp.js). Carrega DEPOIS de medcare.js.
   O soldado que caiu é o MESMO que aparece no catre: mesma nação, mesma atadura (peito, cabeça, braço/perna), fuzil guardado no rack.
   Dentro do hospital (hide() do casualty.js tira o ferido de `units`): este módulo lê PXCAS.wards / PXCAS.hidden / post.beds e desenha
   cada paciente onde a simulação diz que ele está:
   Triagem (catre) ..... deitado, respira, vira a cabeça, mexe o braço; a enfermagem o atende (curativo, pulso, água)
   Transporte .......... dois padioleiros levam a maca entre catre ↔ enfermaria ↔ mesa de cirurgia (caminho por um corredor, maca de pé/deitada)
   Cirurgia ............ o paciente na mesa, cirurgião e instrumentadora (a tenda mostra o interior pela porta)
   Alta ................ (casualty.js demora a devolver à tropa até a cena acabar: PXCAS.cfg.REC) o curado acorda, apoia-se nos cotovelos,
                         senta (tonto, mão na testa), escorrega até o pé do catre e balança as pernas, levanta amparado, põe o capacete,
                         anda até o rack, pega o fuzil, confere o ferrolho, bate continência e sai do hospital rumo ao front;
                         no último quadro a unidade reaparece no jogo exatamente onde a cena terminou (PXCAS.exitFor).
   Posto avançado e campo: a mesma cena em escala menor (posto: 3 catres; campo: levanta do chão e pega o fuzil que estava ao lado).
   ?medcare=0 desliga tudo · ?medhosp=0 só o hospital · PXMCH.state() */
(function(){
if(!window.PXMC||!PXMC.on||!window.PXMED||!window.PXCAS||!window.PXMEDART||!window.PXMCA||!window.IFK)return;
const M=PXMED,C=PXCAS,ART=PXMEDART,A=PXMCA,K=IFK,Z=PX.Z||.5,hyp=Math.hypot,PI=Math.PI;
const H=window.PXMCH={on:!/[?&]medhosp=0/.test(location.search),version:'1.11',errors:0,stats:{patients:0,carries:0,rises:0,errors:0}};
let errs=0;
function fail(e){H.stats.errors++;H.errors++;if(++errs<=3)console.error('medcare-hosp.js:',e);if(errs>=12&&H.on){H.on=false;ART.decorPatients=true;console.error('medcare-hosp.js desligado após erros repetidos (volta o desenho do art-medics.js)')}}
if(!H.on)return;
ART.decorPatients=false;                                 // o hospital pinta os pacientes: o art-medics não "assa" mais os falsos no cenário
const clamp=(v,a,b)=>v<a?a:v>b?b:v,rnd=(a,b)=>a+Math.random()*(b-a);
const hash=(n,s=0)=>{let h=(n*374761393+s*668265263)|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296};
const ease=t=>t<0?0:t>1?1:t*t*(3-2*t);
const chaseAng=(a,b,k)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*k;
const face=t=>t?-1:1;
const mkc=PX.mk,g2=PX.g2,TEAM=PX.TEAM;
const isField=p=>!p.seg;
const d16=a=>Math.round((((a%(2*PI))+2*PI)%(2*PI))/(2*PI/16))%16;

/* ======================================================================================
   GEOMETRIA (px de tela relativos à âncora do posto; x espelhado por face(team))
   ====================================================================================== */
const LF={cots:ART.FIELD.cots.map(k=>[k[0],k[1]]),ward:ART.FIELD.decor.map(k=>[k[0],k[1]]),rack:[10,36],exit:[13,50],lane:31,table:[53,-15],tentIn:[53,-8],wardIn:[3,-8],amb:[72,6],front:1};
const LA={cots:ART.AIDL.cots.map(k=>[k[0],k[1]]),ward:[],rack:[18,27],exit:[22,41],lane:26,table:null,tentIn:null,wardIn:null,amb:null,front:1};
const layOf=p=>isField(p)?LF:LA;
const toW=(p,l)=>({x:p.x+face(p.team)*l[0]/Z,y:p.y+l[1]/Z});           // local px → mundo
const front=t=>t?-1:1;                                                   // sentido do front em x (EUA a leste)
/* saída do curado: ao pé do hospital, já de frente para o front */
C.exitFor=(u,where,p)=>{const f=front(u.team);
 if(where==='field')return{x:u.x+f*14,y:u.y+3,angle:f>0?0:PI};
 const L=layOf(p),w=toW(p,L.exit);return{x:w.x,y:w.y,angle:f>0?0:PI}};

/* ======================================================================================
   ESTADO VISUAL DE CADA PACIENTE
   ====================================================================================== */
const VP=new WeakMap();
function vpOf(u,p){let v=VP.get(u);if(!v){v={u,p,loc:null,at:null,carry:null,t0:time,arr:null,seed:u.id,wv:u.id%3,fceT:0,face:'calm',moveT:time+rnd(2,5),armK:null,stage:null};VP.set(u,v);H.stats.patients++}return v}
const bandOf=(u)=>{const z=u.cz;if(!z||!(z.stab||z.st==='bed'||z.st==='recover'||z.st==='ward'||z.st==='surgery'))return 0;const wv=u.id%3;return wv===0?1:wv===1?2:3};

/* quem está onde (por quadro): catres de triagem, catres da enfermaria (3), mesa e "dentro da tenda"; cada paciente ganha um destino (v.tgt) */
let FRN=0;
const SLOTS=new WeakMap();
function census(p){if(p._mcF===FRN&&p._mc)return p._mc;const L=layOf(p),r={tri:[],ward:[],table:null,inside:[],rec:[],all:[]};
 const cots=ART.cotsOf(p);
 for(const u of p.beds){const i=cots.get(u);if(i==null)continue;r.tri.push({u,i});const v=vpOf(u,p);v.tgt='T'+i}
 if(isField(p)){const w=C.wards.get(p.id);
  const hid=C.hidden.filter(u=>u.cz&&u.cz.h===p);
  const surg=w?w.surg:[],queue=w?w.queue:[];
  const rec=hid.filter(u=>u.cz.st==='recover');
  r.table=surg[0]||null;if(r.table)vpOf(r.table,p).tgt='S';for(const u of surg.slice(1)){r.inside.push(u);vpOf(u,p).tgt='IN'}
  /* enfermaria: 3 catres, prioridade a quem vai levantar, depois a fila (estável: quem já ocupa fica) */
  const want=[...rec,...queue.filter(u=>!rec.includes(u))],slots=SLOTS.get(p)||[null,null,null];SLOTS.set(p,slots);
  for(let i=0;i<3;i++)if(slots[i]&&!want.includes(slots[i]))slots[i]=null;
  for(const u of want){if(slots.includes(u))continue;const k=slots.indexOf(null);if(k>=0)slots[k]=u}
  for(const u of want){const k=slots.indexOf(u);const v=vpOf(u,p);if(k<0){r.inside.push(u);v.tgt='IN'}else v.tgt='W'+k}
  r.ward=slots.map((u,i)=>u?{u,i}:null);r.rec=rec}
 /* quem acabou de aparecer já está no lugar (sem maca); quem mudou de lugar ganha uma maca */
 const all=[...r.tri.map(q=>q.u),...r.ward.filter(Boolean).map(q=>q.u),...(r.table?[r.table]:[]),...r.inside];r.all=all;
 for(const u of all){const v=vpOf(u,p);stepVP(v,p,L)}
 p._mc=r;p._mcF=FRN;return r}
function posOf(L,key){if(key==null)return null;if(key[0]==='T')return L.cots[+key.slice(1)]||L.cots[0];if(key[0]==='W')return L.ward[+key.slice(1)]||L.ward[0];if(key==='S')return L.tentIn;if(key==='IN')return L.wardIn;return null}
function stepVP(v,p,L){if(v.loc==null){v.loc=v.tgt;v.arr=null;return}
 if(v.carry&&time>=v.carry.t0+v.carry.dur){v.loc=v.carry.to;v.carry=null;if(v.loc[0]==='W')v.arr=time}
 if(!v.carry&&v.tgt!==v.loc&&L.ward.length){const a=posOf(L,v.loc),b=posOf(L,v.tgt);
  if(a&&b){startCarry(v,p,L,a,b,v.loc,v.tgt)}else{v.loc=v.tgt}}}
/* ======================================================================================
   TRANSPORTE DE MACA ENTRE LUGARES (visual): pelo corredor ao norte dos catres (entre as tendas e a lona)
   ====================================================================================== */
const SPD=26,LANE_Y=0;
function lanePath(a,b,toTent){/* sai pela cabeceira do catre, sobe ao corredor, anda e desce até o destino (ou entra na tenda) */
 const ya=Array.isArray(a)?a[1]:0,pts=[[a[0],a[1]],[a[0],LANE_Y]];
 if(b[0]!==a[0])pts.push([b[0],LANE_Y]);pts.push([b[0],b[1]]);
 return pts.filter((q,i)=>!i||hyp(q[0]-pts[i-1][0],q[1]-pts[i-1][1])>.5)}
function startCarry(v,p,L,a,b,from,to){/* a e b em px locais; catre = centro, tenda = soleira */
 const fromCot=from[0]==='T'||from[0]==='W',toCot=to[0]==='T'||to[0]==='W';
 const aa=fromCot?[a[0],a[1]-8]:a,bb=toCot?[b[0],b[1]-8]:b;                      // a cabeceira do catre
 const path=lanePath(aa,bb),len=path.reduce((s,q,i)=>i?s+hyp(q[0]-path[i-1][0],q[1]-path[i-1][1]):0,0);
 v.carry={path,len,t0:time,dur:Math.max(1.8,len/SPD)+1.5,from,to};H.stats.carries++}
function carryPos(cr,t){/* 0,75 s para erguer, caminho, 0,75 s para pousar */
 const k=clamp((t-cr.t0-.75)/(cr.dur-1.5),0,1),d=k*cr.len,path=cr.path;let acc=0;
 for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],sl=hyp(b[0]-a[0],b[1]-a[1]);if(d<=acc+sl||i===path.length-1){const q=sl?clamp((d-acc)/sl,0,1):1;return{x:a[0]+(b[0]-a[0])*q,y:a[1]+(b[1]-a[1])*q,dx:b[0]-a[0],dy:b[1]-a[1],k,ph:(t-cr.t0)<.75?0:(t-cr.t0)>cr.dur-.75?2:1}}acc+=sl}
 const e=path[path.length-1];return{x:e[0],y:e[1],dx:0,dy:1,k:1,ph:2}}
/* ======================================================================================
   PACIENTE NO CATRE (animações de repouso) E CENA DE RECUPERAÇÃO
   ====================================================================================== */
/* respiração, olhar, braço: tudo derivado do tempo e da semente, sem estado */
function restLook(u,v,t,attended){const s=v.seed,ph=t*.5+s*.37;
 const breath=Math.sin(t*(u.cz&&u.cz.sev==='critical'?2.8:1.9)+s)>.35?1:0;
 let face='calm',arm='rest';const z=u.cz||{};
 const blink=((t*.9+s*.21)%4.2)<.16;
 if(blink)face='closed';
 const g=(t*.28+s*.113)%5;                                        // ciclo de ~3,5 s: dor / olha de lado / dorme
 if(z.sev==='critical'&&z.st!=='recover')face=g<2.5?'closed':'pain';
 else if(g>3.4&&g<4.1)face=s&1?'turnL':'turnR';
 else if(g<.7&&!blink)face='pain';
 const m=(t*.21+s*.17)%6;
 if(m<.5)arm='chest';else if(m>3.0&&m<3.7)arm='head';else if(m>4.6&&m<5.2)arm='out';
 if(attended){arm='rest';if(!blink)face=g<1.3?'pain':'calm'}
 return{face,arm,breath}}

/* ---------- peças da figura de pé para a cena de recuperação ---------- */
const FIG=(team,view,o)=>A.figure(team,view,o);
function riseFig(team,wv,kind,o={}){const band=wv===1?2:0,bare={bare:true,band,face:o.face||'calm'},T=team,s=o.s|0;const k=`rf${kind}${wv}${JSON.stringify(o)}`;
 switch(kind){
  case'sitFoot':return FIG(T,'F',{k,legs:'sit',torso:{arms:false,dy:1},head:{...bare,dy:1},armL:{pts:[[1,7],[0,9],[1,11]]},armR:{pts:[[7,7],[8,9],[7,11]]},extras:bandage(T,wv,1)});
  case'drink':return FIG(T,'F',{k,legs:'sit',torso:{arms:false,dy:1},head:{...bare,dy:0,face:'calm'},armL:{pts:[[1,7],[0,9],[1,11]]},armR:{pts:[[7,7],[8,5],[5,3]]},extras:(cx,ox,oy,P)=>{bandage(T,wv,1)(cx,ox,oy,P);const x=ox+4,y=oy+2;cx.fillStyle='#7d858c';cx.fillRect(x,y,2,3);cx.fillStyle='#aab1b6';cx.fillRect(x,y,1,1)}});
  case'dizzy':return FIG(T,'F',{k,legs:'sit',torso:{arms:false,dy:1},head:{...bare,dy:1,face:'pain'},armL:{pts:[[1,7],[0,9],[1,11]]},armR:{pts:[[7,7],[8,4],[6,3]]},extras:bandage(T,wv,1)});
  case'stand':return FIG(T,'F',{k,legs:o.step===1?'stepL':o.step===2?'stepR':'stand',torso:{arms:false,dx:o.sway|0},head:{...bare,dx:o.sway|0},armL:o.reach?{pts:[[1,7],[-1,8],[-2,9]]}:{pts:[[1,7],[0,9],[0,11]]},armR:{pts:[[7,7],[8,9],[7,11]]},extras:bandage(T,wv,0)});
  case'helmUp':return FIG(T,'F',{k,legs:'stand',torso:{arms:false},head:{...bare},armL:{pts:[[1,7],[-1,4],[2,1]]},armR:{pts:[[7,7],[9,4],[6,1]]},extras:(cx,ox,oy,P)=>{bandage(T,wv,0)(cx,ox,oy,P);helmetPx(cx,T,ox+1,oy-3)}});
  case'helmOn':return FIG(T,'F',{k,legs:'stand',torso:{arms:false},head:{},armL:{pts:[[1,7],[0,9],[0,11]]},armR:{pts:[[7,7],[8,6],[6,5]]},extras:bandage(T,wv,0,true)});
  case'walkF':return FIG(T,'F',{k,legs:o.step===1?'stepL':o.step===2?'stepR':'stand',torso:{arms:true},head:o.helmet?{}:{...bare},extras:bandage(T,wv,0,o.helmet)});
  case'walkB':return FIG(T,'B',{k,legs:o.step===1?'stepL':o.step===2?'stepR':'stand',torso:{arms:true},head:o.helmet?{}:{...bare}});
  case'walkS':return FIG(T,'S',{k,legs:o.step===1?'stepA':o.step===2?'stepB':'stand',torso:{arms:true},head:o.helmet?{}:{...bare},flip:!!o.flip});
  case'reach':return FIG(T,'B',{k,legs:'stand',torso:{arms:false},head:{},armL:{pts:[[1,7],[0,4],[1,1]]},armR:{pts:[[7,7],[8,4],[7,1]]}});
  case'rifleF':{const pr=o.pr==null?-1:o.pr;return FIG(T,'F',{k,legs:'stand',torso:{arms:false},head:o.h?{dy:o.nod?1:0}:{dy:o.nod?1:0},armL:{pts:[[1,7],[-1,9],[1,10]]},armR:{pts:[[7,7],[9,9],[8,9]]},
   extras:(cx,ox,oy,P)=>{bandage(T,wv,0,true)(cx,ox,oy,P);A.rifleAt(cx,ox+4,oy+9,-.12,T===1,pr,P.s)}})}
  case'salute':return FIG(T,'F',{k,legs:'stand',torso:{arms:false},head:{dy:o.nod?1:0},armL:{pts:[[1,7],[0,9],[1,11]]},armR:{pts:[[7,7],[10,5],[7,2]]},extras:(cx,ox,oy,P)=>{bandage(T,wv,0,true)(cx,ox,oy,P);cx.fillStyle=P.g;cx.fillRect(ox-1,oy+5,1,7);cx.fillStyle=P.o;cx.fillRect(ox-1,oy+10,1,3)}});
  case'rifleS':return FIG(T,'S',{k,legs:o.step===1?'stepA':o.step===2?'stepB':'stand',torso:{arms:true},head:{},flip:!!o.flip,extras:(cx,ox,oy,P)=>{A.rifleAt(cx,ox+(o.flip?4:4),oy+9,o.flip?PI-.2:-.2,T===1,-1,P.s)}});
  case'gnd':return FIG(T,'F',{k,legs:'sit',torso:{arms:false,dy:1},head:{dy:1,face:'pain'},armR:{pts:[[7,7],[8,9],[5,9]]},armL:{pts:[[1,7],[-1,9],[0,11]]},extras:bandage(T,wv,1,true)});
  case'standH':return FIG(T,'F',{k,legs:'stand',torso:{arms:false,dx:o.sway|0},head:{dx:o.sway|0},armL:{pts:[[1,7],[0,9],[1,10]]},armR:{pts:[[7,7],[8,9],[7,10]]},extras:bandage(T,wv,0,true)});
  case'pick':return FIG(T,'S',{k,legs:o.q===2?'stand':'crouch',torso:{arms:true,lean:o.q===2?0:2,dy:o.q===2?0:2},head:{dx:o.q===2?0:2,dy:o.q===2?0:2},flip:!!o.flip,extras:(cx,ox,oy,P)=>{if(o.q===1)A.rifleAt(cx,ox+(o.flip?0:8),oy+13,o.flip?PI+.1:-.1,T===1,-1,P.s)}});
 }}
function helmetPx(cx,team,x,y){const P=A.pal(team);if(team===0){cx.fillStyle=P.h;cx.fillRect(x,y+1,7,2);cx.fillRect(x+1,y,5,1);cx.fillStyle=P.H;cx.fillRect(x+1,y,3,1)}else{cx.fillStyle=P.h;cx.fillRect(x+1,y,5,3);cx.fillRect(x,y+2,7,1);cx.fillStyle=P.H;cx.fillRect(x+2,y,2,1)}}
/* atadura do soldado por cima da figura (peito, braço, perna; a da cabeça já vem na cabeça descoberta) */
function bandage(team,wv,sit,helmeted){return(cx,ox,oy,P)=>{if(wv===0){cx.fillStyle=P.w;cx.fillRect(ox+3,oy+7,3,2);cx.fillStyle='#ffffff';cx.fillRect(ox+3,oy+7,3,1);cx.fillStyle=P.x;cx.fillRect(ox+4,oy+8,1,1)}
 else if(wv===1&&helmeted){cx.fillStyle=P.w;cx.fillRect(ox+2,oy+4,5,1);cx.fillStyle=P.x;cx.fillRect(ox+3,oy+4,1,1)}
 else if(wv===2){cx.fillStyle=P.w;cx.fillRect(ox,oy+8,2,3);cx.fillStyle='#ffffff';cx.fillRect(ox,oy+8,2,1);cx.fillStyle=P.x;cx.fillRect(ox,oy+9,1,1)}}}

/* ======================================================================================
   LINHA DO TEMPO DA ALTA  (tempo em segundos desde o início da cena, escalado para caber)
   ====================================================================================== */
const STG=[['wake',.9],['prop',.55],['half',.45],['sit',.8],['foot',.9],['drink',.7],['stand',1.1],['helm',1.2],['walkR',1.5],['take',.8],['lift',.5],['bolt',.9],['salute',.8],['walkX',1.3]];
const STG_T=STG.reduce((s,q)=>s+q[1],0);
function stageAt(tau,total){const k=tau/total*STG_T;let acc=0;for(const[n,d]of STG){if(k<acc+d)return{n,q:(k-acc)/d,i:STG.findIndex(s=>s[0]===n)};acc+=d}return{n:'walkX',q:1,i:STG.length-1}}
H.stageAt=stageAt;const TAKE_I=STG.findIndex(s=>s[0]==='take');

/* posição (px locais) e quadro do curado a cada instante da cena que acontece num catre (cx,cy = centro do catre) */
function risePlan(L,cx,cy,tau,total,team,wv,seed){
 const st=stageAt(tau,total),q=st.q,foot=[cx,cy+7],stand=[cx,cy+14],rack=[L.rack[0],L.rack[1]+4],atRack=[L.rack[0],L.rack[1]+5],ex=L.exit;
 const out={st:st.n,q,x:cx,y:cy,kind:'cot'};
 const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
 switch(st.n){
  case'wake':case'prop':case'half':case'sit':break;
  case'foot':{const e=ease(q);out.kind='sitFoot';[out.x,out.y]=lerp([cx,cy],[foot[0],foot[1]],e);break}
  case'drink':out.kind='drink';[out.x,out.y]=foot;break;
  case'stand':{out.kind='stand';const e=ease(q);[out.x,out.y]=lerp(foot,stand,e);out.sway=Math.round(Math.sin(q*9)*(1-q)*1.4);out.reach=q<.6;break}
  case'helm':out.kind=q<.55?'helmUp':'helmOn';[out.x,out.y]=stand;break;
  case'walkR':{out.kind='walk';const e=ease(q);[out.x,out.y]=lerp(stand,atRack,e);out.dx=atRack[0]-stand[0];out.dy=atRack[1]-stand[1];out.helmet=true;break}
  case'take':out.kind='reach';[out.x,out.y]=atRack;break;
  case'lift':out.kind='rifleF';out.pr=-1;[out.x,out.y]=atRack;break;
  case'bolt':out.kind='rifleF';out.pr=q<.2?-1:q<.45?2:q<.7?3:-1;[out.x,out.y]=atRack;break;
  case'salute':out.kind='salute';out.nod=q>.6;[out.x,out.y]=atRack;break;
  case'walkX':{out.kind='walkArmed';const e=ease(q);[out.x,out.y]=lerp(atRack,ex,e);out.dx=ex[0]-atRack[0];out.dy=ex[1]-atRack[1];out.helmet=true;break}
 }
 return out}
H.risePlan=risePlan;

/* ======================================================================================
   DESENHO
   ====================================================================================== */
function drawCotPatient(c,team,u,v,cx,cy,t,attended){attended=attended||(v.att!=null&&t-v.att<.4);const look=restLook(u,v,t,attended),band=bandOf(u),sp=A.cotPatient(team,{face:look.face,arm:look.arm,breath:look.breath,band,blood:!band&&!(u.cz&&u.cz.stab),wv:v.wv});c.drawImage(sp.c,cx-sp.ax,cy-sp.ay)}
/* o doente que está sentando: peças sobre o catre (cabeça sobe, tronco cresce, mão na testa) */
function drawRiseOnCot(c,team,u,v,cx,cy,stg,q,t){const wv=v.wv,P=A.pal(team),lerp=(a,b,k)=>a+(b-a)*k;
 if(stg==='wake'){const sp=A.cotPatient(team,{face:q<.3?'closed':q<.6?(v.seed&1?'turnL':'turnR'):'calm',arm:q>.6?'head':'rest',band:bandOf(u),wv,breath:q<.5?1:0});c.drawImage(sp.c,cx-sp.ax,cy-sp.ay);return}
 const base=A.cotPatient(team,{face:'calm',arm:'chest',band:0,wv,breath:0});
 c.drawImage(base.c,0,10,base.c.width,base.c.height-10,cx-base.ax,cy-base.ay+10,base.c.width,base.c.height-10);               // do cobertor para baixo
 const k=stg==='prop'?lerp(.15,.4,q):stg==='half'?lerp(.4,.75,q):1,f=riseFig(team,wv,'dizzy',{face:'pain'});
 const rows=Math.max(1,Math.round(1+3*k)),headY=cy-9+Math.round((1-k)*4);
 c.drawImage(f.c,0,f.ay-13+(4-rows),f.c.width,rows,cx-f.ax,cy-2-rows,f.c.width,rows);                                          // tronco cresce
 c.drawImage(f.c,0,f.ay-19,f.c.width,6,cx-f.ax,headY,f.c.width,6);                                                              // cabeça sobe
 c.fillStyle=A.BL[0];c.fillRect(cx-4,cy-2,9,3);c.fillStyle=A.BL[1];c.fillRect(cx-4,cy-2,9,1);c.fillStyle=A.BL[3];c.fillRect(cx-5,cy-2,1,3);c.fillRect(cx+5,cy-2,1,3);
 if(stg==='sit'&&q>.15&&q<.9){c.fillStyle=P.u;c.fillRect(cx+4,headY+2,1,3);c.fillRect(cx+3,headY,2,2);c.fillStyle=P.s;c.fillRect(cx+3,headY,1,1)}}
function drawActor(c,team,u,v,L,p,bx,by,f,plan){/* o curado fora do catre: sentado no pé, de pé, andando */
 const wv=v.wv,sx=bx+f*Math.round(plan.x),sy=by+Math.round(plan.y);let sp=null;
 const stp=(Math.floor(time*5+v.seed)&3),step=stp===1?1:stp===3?2:0;
 switch(plan.kind){
  case'sitFoot':sp=riseFig(team,wv,'sitFoot');break;
  case'drink':sp=riseFig(team,wv,'drink');break;
  case'stand':sp=riseFig(team,wv,'stand',{sway:plan.sway,reach:plan.reach});break;
  case'helmUp':sp=riseFig(team,wv,'helmUp');break;
  case'helmOn':sp=riseFig(team,wv,'helmOn');break;
  case'walk':case'walkArmed':{const dx=plan.dx*f,dy=plan.dy,armed=plan.kind==='walkArmed';
   if(Math.abs(dx)>=Math.abs(dy)*.75)sp=armed?riseFig(team,wv,'rifleS',{step,flip:dx<0}):riseFig(team,wv,'walkS',{step,flip:dx<0,helmet:true});
   else if(dy>0)sp=armed?riseFig(team,wv,'rifleF',{pr:-1}):riseFig(team,wv,'walkF',{step,helmet:true});else sp=riseFig(team,wv,'walkB',{step,helmet:true});break}
  case'reach':sp=riseFig(team,wv,'reach');break;
  case'rifleF':sp=riseFig(team,wv,'rifleF',{pr:plan.pr});break;
  case'salute':sp=riseFig(team,wv,'salute',{nod:plan.nod});break;}
 if(!sp)return;c.fillStyle='rgba(0,0,0,.22)';c.fillRect(sx-3,sy-1,7,2);c.drawImage(sp.c,sx-sp.ax,sy-sp.ay+1)}

/* maca com o paciente e dois padioleiros (sprites do art-medics: orderly = servente de bata) */
function drawCarry(c,p,v,bx,by,f){const cr=v.carry,pos=carryPos(cr,time),team=p.team,S=ART.sprites;
 if(Math.abs(pos.dx)+Math.abs(pos.dy)>.1){v._cdx=pos.dx;v._cdy=pos.dy}
 const horiz=pos.ph===1&&Math.abs(v._cdx||0)>Math.abs(v._cdy||0),sx=bx+f*Math.round(pos.x),sy=by+Math.round(pos.y);
 const fr=pos.ph===1?[0,1,0,2][Math.floor(time*6+v.seed)&3]:0,pose=pos.ph===1?'walk':'kneel';
 const person=(view,pz,fr_,x,y)=>{const sp=S.person('orderly',team,view,pz,fr_);c.drawImage(sp.c,x-sp.ax,y-sp.ay)};
 if(horiz){const mvE=(v._cdx*f)>0,st=S.stretcherH(team,v.wv,false,!mvE),vw=mvE?'S':'L';
  c.fillStyle='rgba(0,0,0,.2)';c.fillRect(sx-12,sy+4,25,2);
  person(vw,pose,fr,sx-14,sy+5);c.drawImage(st.c,sx-st.ax,sy-1-st.ay);person(vw,pose,[0,2,0,1][Math.floor(time*6+v.seed)&3],sx+14,sy+5)}
 else{const mvN=(v._cdy||1)<0,vw=mvN?'B':'F',st=S.stretcherV(team,v.wv,false,false);
  c.fillStyle='rgba(0,0,0,.2)';c.fillRect(sx-4,sy+7,9,3);
  person(vw,pose,fr,sx,sy-8);c.drawImage(st.c,sx-st.ax,sy+2-st.ay);person(vw,pose,[0,2,0,1][Math.floor(time*6+v.seed)&3],sx,sy+16)}}

/* ======================================================================================
   LIGAÇÕES COM O art-medics.js
   ====================================================================================== */
{const u0=WW1A.under;WW1A.under=function(){FRN++;return u0.apply(this,arguments)}}
H.beds=function(c,p,ox,oy,bx,by,vis,Amap){try{const f=face(p.team),L=layOf(p),t=time,hosp=isField(p),cen=census(p);
 for(const{u,i}of cen.tri){if(!vis&&window.PXW&&PXW.visible&&!PXW.visible(u))continue;const v=vpOf(u,p),k=L.cots[i]||L.cots[0],cx=bx+f*k[0],cy=by+k[1];
  if(u.cz&&u.cz.st==='recover'&&u.cz.rec){const rec=u.cz.rec,plan=risePlan(L,k[0],k[1],t-rec.t0,rec.end-rec.t0,u.team,v.wv,v.seed);
   if(plan.kind==='cot')drawRiseOnCot(c,u.team,u,v,cx,cy,plan.st,plan.q,t);continue}
  if(u.cz&&u.cz.lay&&u.cz.lay.by&&u.cz.lay.by.rs&&u.cz.lay.by.rs.st==='lay'&&t-u.cz.lay.t0<1.5)continue;          // o resgatador ainda o está pousando (desenhado por ele)
  drawCotPatient(c,u.team,u,v,cx,cy,t,false)}
 if(hosp){for(let i=0;i<3;i++){const k=L.ward[i],cx=bx+f*k[0],cy=by+k[1],slot=cen.ward[i];
   if(slot){const u=slot.u,v=vpOf(u,p);if(v.loc!=='W'+i||v.carry)continue;
    if(u.cz&&u.cz.st==='recover'&&u.cz.rec){const rec=u.cz.rec,arrive=v.arr==null?rec.t0:v.arr,plan=risePlan(L,k[0],k[1],t-arrive,Math.max(4,rec.end-arrive),u.team,v.wv,v.seed);
     if(plan.kind==='cot')drawRiseOnCot(c,u.team,u,v,cx,cy,plan.st,plan.q,t);continue}
    drawCotPatient(c,u.team,u,v,cx,cy,t,false)}
   else drawDecorPatient(c,p.team,i,cx,cy,t)}}
 /* rack de armas com os fuzis dos internados */
 let n=0;for(const u of cen.all){const v=vpOf(u,p),z=u.cz;if(z&&z.st==='recover'&&z.rec){const ward=v.loc&&v.loc[0]==='W',arr=ward?(v.arr==null?z.rec.t0:v.arr):z.rec.t0,tot=ward?Math.max(4,z.rec.end-arr):z.rec.end-z.rec.t0,st=stageAt(t-arr,tot);if(st.i>TAKE_I||st.i===TAKE_I&&st.q>.5)continue}n++}
 const rk=A.rack(Math.min(4,n),p.team);c.drawImage(rk.c,bx+f*L.rack[0]-rk.ax,by+L.rack[1]-rk.ay+4);
 return true}catch(e){fail(e);return false}};
/* pacientes de fundo (não são soldados do jogo): convalescentes que lêem, dormem, viram na cama — só quando o catre da enfermaria está vazio */
function drawDecorPatient(c,team,i,cx,cy,t){const look=restLook({cz:null},{seed:i*7+team*3},t,false);
 if(i===2){const s=A.sitting(team,{wv:2,stab:true,wave:null,face:'calm',slump:((t*.4)%5)<.6});c.drawImage(s.c,cx-s.ax,cy+2-s.ay);return}
 const sp=A.cotPatient(team,{face:look.face,arm:look.arm,breath:look.breath,band:i===0?1:3,wv:i});c.drawImage(sp.c,cx-sp.ax,cy-sp.ay)}

H.actors=function(c,p,ox,oy,bx,by,dt){try{const f=face(p.team),L=layOf(p),t=time,cen=census(p);
 /* macas em movimento */
 for(const u of cen.all){const v=vpOf(u,p);if(v.carry)drawCarry(c,p,v,bx,by,f)}
 staffTools(c,p,cen,L,bx,by,f,t);
 /* curados que já saíram do catre (sentados no pé, de pé, andando até o rack e a saída) */
 for(const{u,i}of cen.tri){if(u.cz&&u.cz.st==='recover'&&u.cz.rec){const k=L.cots[i]||L.cots[0],v=vpOf(u,p),rec=u.cz.rec,plan=risePlan(L,k[0],k[1],t-rec.t0,rec.end-rec.t0,u.team,v.wv,v.seed);if(plan.kind!=='cot')drawActor(c,u.team,u,v,L,p,bx,by,f,plan)}}
 for(const s of cen.ward){if(!s)continue;const u=s.u;if(!(u.cz&&u.cz.st==='recover'&&u.cz.rec))continue;const v=vpOf(u,p);if(v.carry||v.loc!=='W'+s.i)continue;
  const k=L.ward[s.i],rec=u.cz.rec,arrive=v.arr==null?rec.t0:v.arr,plan=risePlan(L,k[0],k[1],t-arrive,Math.max(4,rec.end-arrive),u.team,v.wv,v.seed);if(plan.kind!=='cot')drawActor(c,u.team,u,v,L,p,bx,by,f,plan)}
 return true}catch(e){fail(e);return false}};

/* ---------- cirurgia: paciente sobre a mesa da tenda, cirurgião (atrás da mesa), anestesista (cone de éter) e instrumentadora ---------- */
const mr=(c,bx,by,f,lx,ly,w,h,col)=>{c.fillStyle=col;c.fillRect(f>0?bx+lx:bx-lx-w+1,by+ly,w,h)};
H.surgery=function(c,p,bx,by,f,now){try{if(!isField(p))return false;const cen=census(p),u=cen.table;if(!u)return true;const v=vpOf(u,p);if(v.carry||v.loc!=='S')return true;
 const P=A.pal(p.team),T=now,M=(lx,ly,w,h,col)=>mr(c,bx,by,f,lx,ly,w,h,col);
 const age=clamp(1-((u.cz&&u.cz.until||time)-time)/13,0,1),br=Math.sin(T*2.4)>.3?0:1;
 /* paciente de costas: cabeça à esquerda, lençol com mancha crescente, pés para a direita */
 M(49,-19,3,3,P.n);M(49,-18,3,2,P.s);M(52,-18,1,2,P.S);M(48,-18,1,2,'#cbd0c4');
 M(53,-18+br,6,2,'#d9d6c8');M(53,-18+br,6,1,'#f1eee2');M(58,-17,2,1,'#9a937a');
 if(age>.15){M(55,-17+br,Math.round(1+age*2),1,P.x);if(age>.5)M(56,-17+br,1,1,P.X)}
 /* anestesista à esquerda: braço sobre o cone */
 M(44,-22,5,4,'#e8e6dc');M(44,-22,5,1,'#fffaf0');M(45,-19,3,3,P.s);M(46,-19,1,1,P.S);M(48,-18,3,1,'#9aa190');M(50,-18,1,1,'#cfd3d6');
 /* cirurgião atrás da mesa (só tronco e cabeça acima do tampo): touca, máscara, avental; mãos trabalham */
 M(51,-23,6,2,'#e8e6dc');M(51,-23,6,1,'#fffaf0');M(52,-21,4,2,'#dcb690');M(52,-20,4,1,'#cfd3d6');M(50,-19,8,3,'#dcdacf');M(50,-19,8,1,'#f1efe6');M(57,-19,1,3,'#b8b6aa');
 const hx=Math.round(Math.sin(T*5)*1.6),hy=Math.round(Math.cos(T*7)>.3?1:0);
 M(52+hx,-17-hy,1,1,'#e2c6a0');M(55-hx,-17+hy,1,1,'#e2c6a0');if(Math.sin(T*3.2)>.55)M(53,-16-hy,2,1,'#c8d0d4');
 /* instrumentadora à direita, entregando instrumentos */
 M(61,-22,5,2,'#e8e6dc');M(62,-20,3,2,'#dcb690');M(61,-18,5,4,'#6d7f99');M(61,-18,5,1,'#ecebe2');M(60+Math.round(Math.max(0,Math.sin(T*2.6))*1.5),-16,2,1,'#e2c6a0');
 /* lâmpada */
 const fl=(Math.sin(T*9)>.2)?'#fff2b0':'#ffe08a';M(52,-23,5,1,fl);M(53,-24,3,1,'#d9b860');
 return true}catch(e){fail(e);return false}};

/* ---------- alta no campo (ferido leve curado pelo médico): senta, levanta, pega o fuzil que estava ao lado, bate no capacete e segue ---------- */
const FST=[['sit',1.0],['stand',.9],['pick',1.3],['shoulder',.8],['go',.8]],FST_T=FST.reduce((s,q)=>s+q[1],0);
function fieldStage(tau,total){const k=tau/total*FST_T;let acc=0;for(const[n,d]of FST){if(k<acc+d)return{n,q:(k-acc)/d};acc+=d}return{n:'go',q:1}}
H.fieldRise=function(c,u,sx,sy){try{const z=u.cz,rec=z.rec,team=u.team,v=vpOf(u,null),wv=v.wv,f=front(team),tau=time-rec.t0,tot=rec.end-rec.t0,st=fieldStage(tau,tot),q=st.q,band=wv===0?1:wv===1?2:3;
 const X=sx,Y=sy+6,P=A.pal(team);let sp=null,dx=0,dy=0;
 const dvo=A.lyPt(0,0,0);
 if(st.n==='sit'){/* de deitado para sentado: o corpo deitado some conforme o tronco sobe */
  const d=d16(v.ang==null?0:v.ang),body=A.lying(team,{pose:'rest',helmet:'on',band,face:'pain'},0);
  if(q<.45){c.drawImage(body.c,X-body.ax,Y-body.ay-2)}else{sp=A.sitting(team,{wv,stab:true,wave:null,face:q>.8?'calm':'pain',slump:q<.6});c.drawImage(sp.c,X-sp.ax,Y-sp.ay+1)}
  const gear=A.lyingGear(team,0);c.drawImage(gear.c,X-gear.ax,Y-gear.ay-2);return true}
 const rx=X+f*10,ry=Y+3;                                                              // onde o fuzil está no chão, ao lado
 if(st.n==='stand'){sp=riseFig(team,wv,'standH',{sway:Math.round(Math.sin(q*8)*(1-q)*1.2)});dy=0;
  const gear=A.lyingGear(team,0);c.drawImage(gear.c,rx-gear.ax,ry-gear.ay);c.fillStyle='rgba(0,0,0,.22)';c.fillRect(X-3,Y-1,7,2);c.drawImage(sp.c,X-sp.ax,Y-sp.ay+1);return true}
 if(st.n==='pick'){const gear=A.lyingGear(team,0);if(q<.55)c.drawImage(gear.c,rx-gear.ax,ry-gear.ay);                          // curva-se, pega, ergue
  sp=riseFig(team,wv,'pick',{flip:f<0,q:q<.3?0:q<.6?1:2});c.fillStyle='rgba(0,0,0,.22)';c.fillRect(X-3,Y-1,7,2);c.drawImage(sp.c,X-sp.ax,Y-sp.ay+1);return true}
 if(st.n==='shoulder'){sp=riseFig(team,wv,'rifleF',{pr:-1,nod:q>.5,h:1});c.fillStyle='rgba(0,0,0,.22)';c.fillRect(X-3,Y-1,7,2);c.drawImage(sp.c,X-sp.ax,Y-sp.ay+1);return true}
 /* parte: um passo para o front, de fuzil (a unidade volta ao jogo no último quadro, exatamente aqui) */
 const stp=(Math.floor(time*5+v.seed)&3),step=stp===1?1:stp===3?2:0;sp=riseFig(team,wv,'rifleS',{step,flip:f<0});
 const off=Math.round(f*q*14);c.fillStyle='rgba(0,0,0,.22)';c.fillRect(X+off-3,Y-1,7,2);c.drawImage(sp.c,X+off-sp.ax,Y-sp.ay+1);return true}catch(e){fail(e);return false}};

/* ---------- equipe atendendo: a enfermagem do art-medics já anda até os catres ocupados e se inclina (pose 'bend'); aqui vêm os instrumentos e a reação do paciente ---------- */
H.extraCots=function(p){if(!isField(p))return[];const cen=census(p),L=layOf(p),r=[];for(const s of cen.ward){if(!s)continue;const v=vpOf(s.u,p);if(v.loc==='W'+s.i&&!v.carry)r.push(L.ward[s.i])}return r};
function staffTools(c,p,cen,L,bx,by,f,t){const S=ART.staffOf(p);
 for(const s of S){if(s.pose!=='bend'||s.k==='orderly')continue;
  let hit=null,pat=null;
  const cands=[];for(const q of cen.tri)cands.push({k:L.cots[q.i]||L.cots[0],u:q.u});for(const q of cen.ward)if(q)cands.push({k:L.ward[q.i],u:q.u});
  for(const q of cands){if(Math.abs(s.x-q.k[0])<4.5&&Math.abs(s.y-(q.k[1]+11))<5){hit=q.k;pat=q.u;break}}
  if(!hit)continue;const v=vpOf(pat,p);v.att=t;
  const x=bx+f*Math.round(s.x),y=by+Math.round(s.y),cx=bx+f*hit[0],cy=by+hit[1],ph=(t*.9+s.x*.3)%3;
  if(s.k==='doctor'){/* estetoscópio: tubo do pescoço até o peito, que muda de lugar */
   const ex=cx+Math.round(Math.sin(t*1.6)*1.5),ey=cy-1+(ph>1.5?1:0);c.fillStyle='#2b2f33';c.fillRect(x-1,y-9,1,1);c.fillRect(x-2,y-8,1,1);c.fillRect(Math.round((x+ex)/2),Math.round((y-8+ey)/2),1,1);c.fillRect(ex,ey+1,1,1);
   c.fillStyle='#aab1b6';c.fillRect(ex,ey,2,1);c.fillStyle='#f1eee2';c.fillRect(x+f*2,y-8,1,1)}
  else{/* atadura/ cantil: vai e vem sobre o ferimento */
   const k=ph<1?0:ph<2?1:2,wx=cx+Math.round(Math.sin(t*5)*(k===0?2:1)),wy=cy+(k===0?-2:-1);
   if(k<2){c.fillStyle='#f1eee2';c.fillRect(wx,wy,2,1);c.fillStyle='#c4c0b0';c.fillRect(wx,wy+1,2,1);c.fillStyle='#b8302a';if(((t*6)|0)&1)c.fillRect(wx+1,wy,1,1)}
   else{c.fillStyle='#7d858c';c.fillRect(cx+f*2,cy-6,2,3);c.fillStyle='#aab1b6';c.fillRect(cx+f*2,cy-6,1,1)}}}}
H.staff=function(){return false};

/* ======================================================================================
   PADIOLEIROS: carregar (ajoelham, estendem a maca ao lado, rolam o ferido, amarram, erguem juntos) e pousar no catre
   (baixam juntos, passam o ferido para o catre, recolhem a maca). 'ida', 'volta' e 'carry' ficam com o desenho do art-medics.
   ====================================================================================== */
const CVS=new WeakMap();
function sleeveCols(team){return team?['#cfd1c6','#9da094']:['#d9d2b9','#aba489']}
function bArm(c,team,x0,y0,x1,y1,bend){const[u,U]=sleeveCols(team),P=A.pal(team),seg=[];const ex=(x0+x1)/2+bend[0],ey=(y0+y1)/2+bend[1];
 const lp=(a,b,cc,d)=>{a=Math.round(a);b=Math.round(b);cc=Math.round(cc);d=Math.round(d);const dx=Math.abs(cc-a),dy=-Math.abs(d-b),sx=a<cc?1:-1,sy=b<d?1:-1;let e=dx+dy;for(;;){seg.push([a,b]);if(a===cc&&b===d)break;const e2=2*e;if(e2>=dy){e+=dy;a+=sx}if(e2<=dx){e+=dx;b+=sy}}};
 lp(x0,y0,ex,ey);lp(ex,ey,x1,y1);c.fillStyle='#1b1f16';for(const[x,y]of seg){c.fillRect(x,y+1,1,1);c.fillRect(x+1,y,1,1);c.fillRect(x-1,y,1,1)}
 seg.forEach(([x,y],i)=>{c.fillStyle=i<seg.length*.5?u:U;c.fillRect(x,y,1,1)});c.fillStyle=P.s;c.fillRect(Math.round(x1),Math.round(y1),1,1)}
H.crew=function(c,k,p,ox,oy,dt){try{if(k.st!=='load'&&k.st!=='lay')return false;const u=k.u;if(!u||k.st==='dead')return false;
 const S=ART.sprites,V=ART.crewVis(k,p,dt),team=p.team,tm=time;
 if(p.team!==(typeof playerTeam==='number'?playerTeam:0)&&window.PXW&&PXW.visible&&!PXW.visible({team:p.team,x:V.x,y:V.y}))return true;
 let cv=CVS.get(k);if(!cv){cv={};CVS.set(k,cv)}
 const sx=ox+Math.round(V.x*Z),sy=oy+Math.round(V.y*Z);if(sx<-40||sy<-40||sx>vw+40||sy>vh+40)return true;
 const person=(view,pose,fr,x,y)=>{const sp=S.person('bearer',team,view,pose,fr);c.drawImage(sp.c,x-sp.ax,y-sp.ay)};
 const wv=u.id%3,vv=PXMC.vOf(u),band=u.cz&&u.cz.stab?(wv===0?1:wv===1?2:3):0;
 if(k.st==='load'){const kk=clamp(1-Math.max(0,k.t)/M.cfg.LOAD,0,1),ease=ease_=>ease_*ease_*(3-2*ease_);
  const slide=1-ease(clamp((kk-.2)/.3,0,1)),lift=kk>.72?Math.round(ease((kk-.72)/.28)*2):0,off=Math.round(slide*8);       // maca começa 8 px ao lado e desliza para baixo do ferido
  const gy=sy+4+off,stCx=sx,stCy=sy-1+off-lift;
  /* sombra, maca e (a partir de .25) o ferido rolando para cima dela */
  c.fillStyle='rgba(0,0,0,.2)';c.fillRect(sx-12,gy,25,2);
  const hasP=kk>=.5;
  const st=S.stretcherH(team,wv,!hasP,false);c.drawImage(st.c,stCx-st.ax,stCy-st.ay);
  if(kk>=.2&&kk<.5){const q=ease((kk-.2)/.3),px=sx,py=sy+4+Math.round((1-q)*0)-(q>.4&&q<.8?1:0)-Math.round(Math.sin(q*3.14)*2),ang=chaseAng(vv.ang||0,0,q),body=A.lying(team,{pose:'rest',helmet:'on',band,face:'pain'},d16(ang));c.drawImage(body.c,px-body.ax,py-body.ay-1)}
  /* correia sobre o ferido quando já está na maca */
  if(kk>=.5&&kk<.95){const a=kk<.7?(kk-.5)/.2:1;c.fillStyle='#6b5436';c.fillRect(stCx-5,stCy-3,1,Math.round(5*a)+1);c.fillRect(stCx+4,stCy-3,1,Math.round(5*a)+1)}
  /* padioleiros: ajoelhados nas pontas (olham a maca), de pé ao erguer */
  const kneel=kk<.74,fr=kk>.82?[0,1,0,2][Math.floor(tm*5)&3]:0;
  const bx0=sx-14,bx1=sx+14,by=gy+1;
  person('S',kneel?'kneel':'walk',fr,bx0,by);person('L',kneel?'kneel':'walk',fr,bx1,by);
  /* braços: examinam (pulso), rolam, amarram, erguem pelas alças */
  const hy=stCy-1;
  if(kk<.2){bArm(c,team,bx0+2,by-6,sx-5,sy+3,[0,1]);bArm(c,team,bx1-2,by-6,sx+5,sy+3,[0,1])}                           // um confere o pulso no pescoço, o outro o quadril
  else if(kk<.5){const q=(kk-.2)/.3;bArm(c,team,bx0+2,by-6,sx-6,sy+3-Math.round(q*2),[0,-1]);bArm(c,team,bx1-2,by-6,sx+6,sy+3-Math.round(q*2),[0,-1])}  // rolam o corpo
  else if(kk<.72){bArm(c,team,bx0+2,by-6,sx-3,hy+2,[0,1]);bArm(c,team,bx1-2,by-6,sx+3,hy+2,[0,1])}                       // amarram
  else{bArm(c,team,bx0+2,by-6,bx0+4,hy+3,[0,0]);bArm(c,team,bx1-2,by-6,bx1-4,hy+3,[0,0])}                              // seguram as pegas
  if(kk>.12&&kk<.22&&Math.random()<dt*20&&window.particles)particles.push({x:u.x,y:u.y+4,vx:rnd(-6,6),vy:rnd(-4,-1),t:.4,max:.4,color:'#8d7b5a',size:2});
  return true}
 /* pousar: maca vertical sobre o catre */
 const lay=k.lay;if(!lay)return false;const kk=clamp(1-Math.max(0,k.t)/M.cfg.LAY,0,1),ease=e=>e*e*(3-2*e),cot=ART.cotScreen(p,lay.i||0,ox,oy);
 const dropT=ease(clamp(kk/.3,0,1)),slide=ease(clamp((kk-.35)/.4,0,1)),stand=kk>.78;
 const cx=cot[0],cy=cot[1],dir=p.team?-1:1;
 /* paciente: sobre a maca até .4, depois no catre (o mesmo desenho do hospital; ao fim, o beds() assume) */
 const stx=cx+Math.round(slide*10*dir),sty=cy-Math.round((1-dropT)*3);
 const v=vpOf(u,p);
 if(slide<.1){const st=S.stretcherV(team,wv,false,false);c.drawImage(st.c,stx-st.ax,sty+1-st.ay)}
 else{drawCotPatient(c,team,u,v,cx,cy,tm,true);const st=S.stretcherV(team,wv,true,false);c.drawImage(st.c,stx-st.ax,sty+1-st.ay)}
 const pz=stand?'walk':'kneel',fr=stand?[0,1,0,2][Math.floor(tm*5)&3]:0,bxx=stx;
 person('B',pz,fr,bxx,sty-9+(stand?0:2));person('F',pz,fr,bxx,sty+13);
 /* mãos nas alças enquanto baixam e deslizam */
 if(!stand){bArm(c,team,bxx-2,sty-14,stx-3,sty-3,[-1,0]);bArm(c,team,bxx+2,sty+8,stx+3,sty+4,[1,0])}
 return true}catch(e){fail(e);return false}};

H.state=()=>({on:H.on,errors:H.errors,stats:{...H.stats}});
if(window.IronFront)window.IronFront.medhosp=H;
})();
