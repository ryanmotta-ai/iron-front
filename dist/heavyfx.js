'use strict';
/* Iron Front 1.9 — projétil de morteiro em voo (heavyfx.js). Carrega DEPOIS de shelter.js.
   O poço de morteiro do sappers.js disparava sem projétil visível (só uma partícula de 0,25 s na boca do tubo). Agora:
   - fumaça de boca subindo do tubo e anel de poeira no disparo;
   - a bomba sobe e desce num arco alto (apogeu = 45% da distância, até 160 px) até o ponto de impacto, com rastro curto e
     sombra no chão que encolhe/cresce com a altura — dá para ver de onde vem o fogo e para onde vai;
   - perto do ouvinte (< 520 px), assobio de chegada no último 0,9 s (soundscape.js).
   O som do disparo ("tum" do tubo) é trocado no soundscape.js. ?vida=0 desliga junto com o kit. */
(function(){
if(!window.IFK||!window.PXSAP)return;
const K=IFK,Z=K.Z,hyp=Math.hypot,rnd=(a,b)=>a+Math.random()*(b-a);
const wrap=(name,fn)=>{const orig=window[name];if(typeof orig!=='function'){console.warn('heavyfx.js: função ausente: '+name);return}window[name]=function(...a){return fn(orig,...a)}};
const S=window.PXHFX={on:K.on,version:'1.9',stats:{flights:0,whistles:0,errors:0,gunFlights:0,mgShots:0,mgDrawn:0}};
const wrapOpt=(name,fn)=>{if(typeof window[name]==='function')wrap(name,fn)};
let FL=[],errs=0;
function fail(e){S.stats.errors++;if(++errs<=3)console.error('heavyfx.js:',e);if(errs>=12){S.on=false;console.error('heavyfx.js desligado após erros repetidos')}}
function listener(){return mode==='soldier'&&player?player:cam}
wrap('setup',(orig,...a)=>{FL=[];CS.length=0;DP.length=0;return orig(...a)});
wrap('update',(orig,dt)=>{if(!S.on||!started||ended)return orig(dt);for(const s of shells)s._hf=1;orig(dt);try{   /* o jogo refiltra o array: marca o que já existia */
 /* disparo deste quadro: poço com m.fl recém-marcado e projétil novo do mesmo lado */
 /* canhões e obuseiros (battery.js): o projétil já nasce com origem/duração (ox, oy, T, big), sem adivinhar quem atirou */
 for(const s of shells)if(s.bat&&s.ox!=null&&!s._hf2){s._hf2=1;if(FL.length<80){FL.push({s,ox:s.ox,oy:s.oy,T:s.T||s.t,wh:true,bat:1,big:!!s.big,kind:s.kind});S.stats.gunFlights++}}
 const fresh=shells.filter(s=>!s._hf&&!s.gren&&!s.bomb&&!s.bat&&s.kind!=='smoke');
 if(fresh.length)for(const m of PXSAP.posts){if(!(m.fl>.16))continue;const s=fresh.find(s=>s.team===m.team&&!FL.some(f=>f.s===s));if(!s)continue;
  FL.push({s,ox:m.x,oy:m.y-4,T:s.t,wh:false});S.stats.flights++;
  for(let i=0;i<6;i++)particles.push({x:m.x+rnd(-3,3),y:m.y-6,vx:rnd(-6,6),vy:rnd(-26,-12),t:rnd(.6,1.2),max:1.2,color:i%2?'#c9c7b8':'#a9a798',size:rnd(3,5)});
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;particles.push({x:m.x+Math.cos(a)*6,y:m.y+Math.sin(a)*3,vx:Math.cos(a)*26,vy:Math.sin(a)*12,t:.35,max:.35,color:'#8d7b5a',size:3})}}
 for(const f of FL){if(!shells.includes(f.s)){f.done=true;continue}const L=listener();
  if(!f.wh&&f.s.t<.9&&hyp(f.s.x-L.x,f.s.y-L.y)<520){f.wh=true;S.stats.whistles++;try{window.SNDSCAPE&&SNDSCAPE.whistle&&SNDSCAPE.whistle(f.s.x,f.s.y,Math.max(.3,f.s.t))}catch{}}}
 FL=FL.filter(f=>!f.done);stepFX(dt)}catch(e){fail(e)}});
function draw(c,ox,oy){for(const f of FL){const s=f.s,p=Math.min(1,Math.max(0,1-s.t/f.T)),d=hyp(s.x-f.ox,s.y-f.oy),apex=f.bat?(f.big?Math.min(330,d*.26):Math.min(130,d*.1+10)):Math.min(160,d*.45),h=Math.sin(p*Math.PI)*apex;
  const gx=f.ox+(s.x-f.ox)*p,gy=f.oy+(s.y-f.oy)*p,x=ox+Math.round(gx*Z),y=oy+Math.round((gy-h)*Z);if(x<-10||y<-20||x>vw+10||y>vh+10)continue;
  /* sombra no chão: menor e mais fraca no alto */const sz=h>80?1:2;c.globalAlpha=.25+.35*(1-h/Math.max(1,apex));c.fillStyle='#14160f';c.fillRect(ox+Math.round(gx*Z)-1,oy+Math.round(gy*Z),sz+1,1);c.globalAlpha=1;
  /* rastro e bomba */const p2=Math.max(0,p-.04),h2=Math.sin(p2*Math.PI)*apex,tx=ox+Math.round((f.ox+(s.x-f.ox)*p2)*Z),ty=oy+Math.round((f.oy+(s.y-f.oy)*p2-h2)*Z);
  /* canhão: rastro de 7 quadros que se desfaz (o projétil anda 2–4 px por quadro); o obus tem corpo maior que a bomba de morteiro */
  if(f.bat){c.fillStyle=f.kind==='smoke'?'#e9e8e0':'#c9c7b8';for(let k=1;k<=7;k++){const pk=Math.max(0,p-k*(f.big?.011:.016)),hk=Math.sin(pk*Math.PI)*apex;c.globalAlpha=.6*(1-k/8);c.fillRect(ox+Math.round((f.ox+(s.x-f.ox)*pk)*Z),oy+Math.round((f.oy+(s.y-f.oy)*pk-hk)*Z),1,1)}c.globalAlpha=1;
   c.fillStyle='#1d1f18';c.fillRect(x-1,y-1,f.big?3:2,2);c.fillStyle='#7b8176';c.fillRect(x-1,y-1,1,1);continue}
  c.fillStyle='rgba(200,198,184,.55)';c.fillRect(tx,ty,1,1);c.fillStyle='#22241c';c.fillRect(x-1,y-1,2,2);c.fillStyle='#6f756b';c.fillRect(x-1,y-1,1,1)}}

/* ================= MG pesada (Maxim, Vickers, Browning) =================
   A unidade mg do jogo é um soldado com uma arma leve colada no quadril. Parada (e fora de água, de obra, de socorro…), ela passa a
   operar a arma pesada: tripé (Browning M1917, EUA) ou trenó (Maxim MG 08, Alemanha) sob o corpo, o soldado ajoelhado, camisa d'água
   de 3 px cobrindo a arma baked do sprite, caixa de munição e cinto de pano que anda enquanto atira, tranco extra da arma no tiro,
   cápsulas de latão ejetadas com arco e quicada (e acumuladas no chão por 6 s), poeira levantada pelo sopro da boca e fumaça.
   Tudo em px de arte. Limites: 150 cápsulas, 90 partículas, e nada é criado fora da tela. A pose usa o K.pose do life-kit
   (soldier-life/shelter/sapper/assault continuam mandando quando estão em outra pose: então esta camada não desenha a arma). */
const CS=[],DP=[],TAU=Math.PI*2,SQ=.5,BRASS=['#e0b84a','#c79a32','#f0cf6a'];
function seen(wx,wy,m=60){if(typeof cam==='undefined'||typeof vw==='undefined')return true;const x=vw/2+(wx-cam.x)*Z,y=vh/2+(wy-cam.y)*Z;return x>-m&&y>-m&&x<vw+m&&y<vh+m}
const q16=a=>(window.PX&&PX.dir16)?PX.dir16(a||0):(Math.round((((a||0)%TAU+TAU)%TAU)/TAU*16)%16);
function mgShot(u){if(!seen(u.x,u.y))return;const bk=u.type==='bunker',a=u.angle||0,ca=Math.cos(a),sa=Math.sin(a),q=q16(a),aq=q*TAU/16,cq=Math.cos(aq),sq=Math.sin(aq);
 u._mgT=time;S.stats.mgShots++;
 const gx=bk?u.x*Z+ca*5:u.x*Z+cq*1.5,gy=bk?u.y*Z-3+sa*2:u.y*Z+sq+2;
 for(let i=0;i<2;i++){if(CS.length>=150)CS.shift();const rv=rnd(16,30);   // ejeção para a direita da arma (bunker: para baixo)
  CS.push({x:gx,y:gy,z:rnd(2,4),vx:bk?rnd(-6,6):-sa*rv-ca*4+rnd(-5,5),vy:bk?rnd(4,9):ca*rv*.5+rnd(-3,5),vz:rnd(20,36),b:0,landed:false,life:6,col:BRASS[(Math.random()*3)|0]})}
 const mx=u.x*Z+ca*17,my=u.y*Z+sa*17*SQ+7;
 if(DP.length<88&&Math.random()<.45)for(let i=0;i<2;i++)DP.push({x:mx+rnd(-2,2),y:my+rnd(-1,1),vx:ca*rnd(6,22)+rnd(-8,8),vy:rnd(-8,2),t:0,max:rnd(.35,.7),size:rnd(1.6,2.8),k:0});   // terra levantada rente ao chão
 if(DP.length<88&&Math.random()<.5)DP.push({x:u.x*Z+ca*16,y:u.y*Z+sa*16*SQ-3,vx:ca*8+rnd(-3,3),vy:-rnd(5,12),t:0,max:rnd(.5,.9),size:rnd(1.5,2.4),k:1})}   // fumaça da boca
function stepFX(dt){
 for(let i=CS.length-1;i>=0;i--){const p=CS[i];
  if(!p.landed){p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vz-=170*dt;if(p.z<=0){p.z=0;if(p.b<1&&p.vz<-24){p.vz=-p.vz*.3;p.vx*=.4;p.vy*=.4;p.b++}else p.landed=true}}
  else if((p.life-=dt)<=0){CS[i]=CS[CS.length-1];CS.pop()}}
 for(let i=DP.length-1;i>=0;i--){const p=DP[i];p.t+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.96;if(p.t>=p.max){DP[i]=DP[DP.length-1];DP.pop()}}}
function drawMGfx(c,ox,oy){
 for(const p of CS){const x=ox+Math.round(p.x),y=oy+Math.round(p.y-p.z);if(x<-4||y<-4||x>vw+4||y>vh+4)continue;
  if(p.landed){c.globalAlpha=p.life<1?Math.max(0,p.life):1;c.fillStyle=p.col;c.fillRect(x,y,2,1);c.globalAlpha=1}else{c.fillStyle=p.col;c.fillRect(x,y,1,2)}}
 for(const p of DP){const x=ox+Math.round(p.x),y=oy+Math.round(p.y);if(x<-6||y<-6||x>vw+6||y>vh+6)continue;const k=p.t/p.max,r=Math.max(1,Math.round(p.size*(.8+k*.8)));
  c.globalAlpha=(1-k)*(p.k?.5:.6);c.fillStyle=p.k?'#b9b5a8':'#8d7b5a';c.fillRect(x-(r>>1),y-(r>>1),r,Math.max(1,r-1));c.globalAlpha=1}}

/* arma pesada vista de cima, ao longo do ângulo quantizado q/16 (a mesma conta do sprite do soldado); origem = receptor */
function gunSprite(team,q){return PX.cached(`hfxmg${team}_${q}`,()=>{const c=PX.mk(48,48),g=PX.g2(c),a=q*TAU/16,ca=Math.cos(a),sa=Math.sin(a),nx=-sa,ny=ca,L=nx*-.55+ny*-.83;
 const P=team?{hi:'#9aa497',mid:'#5b655a',lo:'#2d332d',dk:'#1b1f1c',fl:'#3d453d',br:'#6b4a2c'}:{hi:'#a3ae92',mid:'#616b55',lo:'#323a2b',dk:'#1e2219',fl:'#454f3a',br:'#6b4a2c'};
 const pl=(d,o,col)=>{g.fillStyle=col;g.fillRect(24+Math.round(ca*d+nx*o),24+Math.round(sa*d+ny*o),1,1)};
 const shade=o=>{const s=o*L;return s>.3?P.hi:s<-.3?P.lo:P.mid};
 for(let d=-3.5;d<=-1.8;d+=.5){pl(d,-1,P.dk);pl(d,1,P.dk);pl(d,0,P.br)}pl(-3.5,0,P.dk);          // empunhaduras de pistola
 for(let d=-1.5;d<=2.6;d+=.5)for(let o=-1.5;o<=1.5;o+=.5)pl(d,o,Math.abs(o)>1.2||d<-1.2?P.dk:o*L>0?P.hi:P.fl);   // caixa do receptor
 const j0=3,j1=team?13.6:12.8;
 for(let d=j0;d<=j1;d+=.5)for(let o=-1;o<=1;o++)pl(d,o,team&&o===0&&((d*2)|0)%3===0?P.fl:shade(o));        // camisa d'água (a do Maxim é ondulada)
 for(let d=j1;d<=15.4;d+=.5){pl(d,0,d>j1+1.2?P.dk:P.lo);if(d<j1+1.1&&!team){pl(d,-1,P.lo);pl(d,1,P.dk)}}  // cone/bucha da boca
 for(let d=0;d<=2.4;d+=.5)pl(d,-2,P.dk);pl(1,-2.5,P.hi);                                        // bloco de alimentação, à esquerda
 pl(1.4,0,P.hi);pl(1.4,.6,P.hi);                                                               // mira
 const o=PX.outlined(c,.6);return{c:o,ax:25,ay:25}})}
/* tripé (EUA) ou trenó (Alemanha) no chão sob a arma, mais a caixa de munição à esquerda. Origem = receptor; guarda onde ficou a caixa */
function tripodSprite(team,q){return PX.cached(`hfxtp${team}_${q}`,()=>{const c=PX.mk(48,40),g=PX.g2(c),a=q*TAU/16,ca=Math.cos(a),sa=Math.sin(a),OX=24,OY=14,GY=7,
  P={x:OX,y:OY+GY},f={x:ca,y:sa*SQ},r={x:-sa,y:ca*SQ},at=(p,k,v,m)=>({x:p.x+f.x*k+r.x*v*m,y:p.y+f.y*k+r.y*v*m});
 const ln=(p0,p1,col)=>{let x0=Math.round(p0.x),y0=Math.round(p0.y);const x1=Math.round(p1.x),y1=Math.round(p1.y),n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0))||1;g.fillStyle=col;for(let i=0;i<=n;i++)g.fillRect(Math.round(p0.x+(p1.x-p0.x)*i/n),Math.round(p0.y+(p1.y-p0.y)*i/n),1,1)};
 const O={x:OX,y:OY};
 if(!team){const pts=[at(P,8,0,1),at(P,-4,7,1),at(P,-4,-7,1)];                                           // M1917: três pés de ferro
  for(const p of pts){ln(O,p,'#2a2a22');ln({x:O.x,y:O.y+1},{x:p.x,y:p.y+1},'#4b4a3a');g.fillStyle='#8b8670';g.fillRect(Math.round(p.x),Math.round(p.y),2,1)}
  ln(at(P,-1,5,1),at(P,-1,-5,1),'#3a3a2c')}                                                           // travessa traseira
 else{for(const k of[-1,1]){const s0=at(P,-7,k*4,1),s1=at(P,8,k*4,1);ln(s0,s1,'#3f3223');ln({x:s0.x,y:s0.y-1},{x:s1.x,y:s1.y-1},'#6a5538');ln(O,at(P,1,k*4,1),'#2b2b23');g.fillStyle='#22262a';g.fillRect(Math.round(s1.x)-1,Math.round(s1.y)-1,2,2)}   // Maxim 08: patins de trenó
  ln(at(P,8,4,1),at(P,8,-4,1),'#4a3b28')}
 /* caixa de munição (tin) à esquerda da arma: left = (sa,-ca) no plano do chão */
 const bp={x:P.x+sa*9,y:P.y-ca*9*SQ+1},bx=Math.round(bp.x),by=Math.round(bp.y);
 g.fillStyle='rgba(15,18,10,.35)';g.fillRect(bx-3,by+1,7,2);
 g.fillStyle=team?'#6e7468':'#566040';g.fillRect(bx-2,by-2,5,3);g.fillStyle=team?'#98a094':'#7d8b5e';g.fillRect(bx-2,by-2,5,1);g.fillStyle=team?'#3f443d':'#363f26';g.fillRect(bx-2,by,5,1);g.fillStyle='#b69a4a';g.fillRect(bx,by-1,1,1);
 return{c,ax:OX,ay:OY,bx:bx-OX,by:by-2-OY}})}
let SCR=null,scx=null;
function scratch(){if(!SCR){SCR=document.createElement('canvas');SCR.width=SCR.height=72;scx=SCR.getContext('2d');scx.imageSmoothingEnabled=false}return scx}
const mgOk=u=>u.type==='mg'&&u.hp>0&&!u.down&&!u.rs&&!u.sh&&!u.sap&&!u.pinned&&!u.lunge&&!u.moving&&u!==player&&!(window.PXW&&PXW.depth&&PXW.depth(u.x,u.y)>=.25);
function drawMG(c,u,sp,sx,sy,vis,bob,d0){
 const g=scratch(),BX=36,BY=44;g.clearRect(0,0,72,72);
 K.poseU=null;K.poseDy=0;
 const r=d0.call(PHYS,g,u,sp,BX,BY,vis,bob);let pdy=K.poseDy;
 if(!r){K.pose(g,sp,BX,BY,vis,bob,{crouch:1,dy:-1,u});pdy=K.poseDy}     // ajoelhado atrás da arma (−1: mantém a boca perto de onde o clarão do pixel.js nasce)
 K.poseU=null;K.poseDy=0;
 const low=pdy>3.5;                                                    // trincheira/parapeito: só cabeça e ombros, sem arma à vista
 if(u._mgS===undefined)u._mgS=time-1;const dep=time-u._mgS>.4;          // 0,4 s para montar o tripé depois de parar
 const q=q16(u.angle),aq=q*TAU/16,cq=Math.cos(aq),sq=Math.sin(aq),Ox=sx+Math.round(cq*1.5),Oy=sy+bob+pdy+Math.round(sq),back=sq<-.35;
 const t=!low&&dep?tripodSprite(u.team,q):null;
 const gun=()=>{const jolt=u.flash>.035?1:0,gs=gunSprite(u.team,q);c.drawImage(gs.c,Ox-gs.ax-Math.round(cq*jolt),Oy-gs.ay-Math.round(sq*jolt))};
 if(t)c.drawImage(t.c,Ox-t.ax,Oy-t.ay);
 if(!low&&back)gun();
 c.drawImage(SCR,sx-BX,sy-BY);
 if(!low&&!back)gun();
 if(t){/* cinto de pano da caixa ao bloco de alimentação; anda enquanto atira */
  const fx=Ox+Math.round(sq*2.4),fy=Oy+Math.round(-cq*2.4),bx=Ox+t.bx,by=Oy+t.by,mv=time-(u._mgT||-9)<.35?((time*26)|0)%2:0;
  for(let i=0;i<=6;i++){const k=i/6,x=Math.round(bx+(fx-bx)*k),y=Math.round(by+(fy-by)*k-Math.sin(k*Math.PI)*2.2);c.fillStyle=(i+mv)%2?'#c2a64e':'#5f553b';c.fillRect(x,y,1,1)}}
 S.stats.mgDrawn++;return true}
if(window.PHYS&&window.PX&&PX.cached&&PX.outlined)(function(){const d0=PHYS.draw||(()=>false);PHYS.draw=function(c,u,sp,sx,sy,vis,bob){
 if(!S.on||u.type!=='mg'||!mgOk(u)){if(u.type==='mg'&&u.moving)u._mgS=time;return d0.call(PHYS,c,u,sp,sx,sy,vis,bob)}
 try{return drawMG(c,u,sp,sx,sy,vis,bob,d0)}catch(e){fail(e);return d0.call(PHYS,c,u,sp,sx,sy,vis,bob)}}})();
wrapOpt('shoot',(orig,u,target,manual)=>{const r=orig(u,target,manual);try{if(S.on&&(u.type==='mg'||u.type==='bunker'))mgShot(u)}catch(e){fail(e)}return r});

if(window.WW1A){const o0=WW1A.over;WW1A.over=function(c,ox,oy,dt){o0.call(this,c,ox,oy,dt);if(!S.on)return;try{draw(c,ox,oy);drawMGfx(c,ox,oy)}catch(e){fail(e)}}}
S.state=()=>({on:S.on,flying:FL.length,casings:CS.length,dust:DP.length,stats:{...S.stats}});S.flights=()=>FL;S.fx=()=>({CS,DP});
if(window.IronFront)window.IronFront.heavyfx=S;
})();
