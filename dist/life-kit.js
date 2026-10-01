'use strict';
/* Iron Front 1.9 — kit compartilhado do passe de "vida" (life-kit.js). Carrega DEPOIS de soldier-hud.js e ANTES de
   casualty.js / classes.js / soldier-life.js / soldier-feel.js / soundscape.js.
   O que oferece (window.IFK):
   - text(c,s,x,y,col,sh) .... fonte 3×5 completa (A–Z, 0–9, ! ? [ ] . , : - + / ') em pixels inteiros; sh = cor da sombra
   - shout(u,txt,dur,col) .... grito curto sobre a cabeça de uma unidade (segue a unidade). Limite global e por unidade,
                                para não poluir; WW1A.over desenha. Os gritos carregam informação (onde há ferido, granada, MG).
   - voice(kind,u) ........... pede uma voz ao soundscape (se houver); kinds: medic, grenade, down, mg, help, advance, hold, reload
   - lang(team) .............. textos por nação (EUA em inglês, Alemanha em alemão: é o que os soldados gritariam)
   - pose(c,sp,sx,sy,vis,bob,o) desenha o sprite da unidade com poses por recorte: o.crouch (perde 3 px de perna e desce 3),
                                o.low (só cabeça e ombros acima do parapeito), o.cut (linhas finais cortadas), o.dx/o.dy
   - inTrench(u) / trenchOf(u) trecho de trincheira (campo ou obra) que contém a unidade
   - w2s(x,y) ................ projeção mundo → tela do pixel.js (ox+round(x*Z)), igual ao resto do jogo
   ?vida=0 desliga todos os módulos 1.9 que dependem do kit. */
(function(){
if(!window.PX)return;
const Z=PX.Z||.5;
const K=window.IFK={on:!/[?&]vida=0/.test(location.search),version:'1.9',Z};

/* ---------- fonte 3×5 ---------- */
const F={A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',E:'111100110100111',F:'111100110100100',
G:'011100101101011',H:'101101111101101',I:'111010010010111',J:'001001001101010',K:'101101110101101',L:'100100100100111',
M:'101111111101101',N:'110101101101101',O:'010101101101010',P:'110101110100100',Q:'010101101110011',R:'110101110101101',
S:'011100010001110',T:'111010010010010',U:'101101101101111',V:'101101101101010',W:'101101111111101',X:'101101010101101',
Y:'101101010010010',Z:'111001010100111','0':'111101101101111','1':'010110010010111','2':'110001010100111','3':'110001110001110',
'4':'101101111001001','5':'111100110001110','6':'011100111101111','7':'111001010010010','8':'111101111101111','9':'111101111001110',
'!':'010010010000010','?':'110001010000010','[':'110100100100110',']':'011001001001011','.':'000000000000010',',':'000000000010100',
':':'000010000010000','-':'000000111000000','+':'000010111010000','/':'001001010100100',"'":'010010000000000',' ':'000000000000000',
'Ä':'101010101111101','Ö':'101010101101010','Ü':'101000101101111','Ã':'011110010101111','Ç':'011100100011010','É':'001010111110111','Í':'001010010010111','Ó':'001010101101010','Ú':'001000101101111','Ê':'010101111110111','Õ':'011110010101010','Á':'001010111101101','Â':'010101010111101'};
K.textW=s=>s.length*4-1;
K.text=function(c,s,x,y,col,sh){s=String(s).toUpperCase();x=Math.round(x);y=Math.round(y);
 for(let pass=sh?0:1;pass<2;pass++){c.fillStyle=pass?col:sh;const o=pass?0:1;
  for(let k=0;k<s.length;k++){const g=F[s[k]];if(!g)continue;for(let j=0;j<5;j++)for(let i=0;i<3;i++)if(g[j*3+i]==='1')c.fillRect(x+k*4+i+o,y+j+o,1,1)}}};

/* ---------- textos por nação ---------- */
const L=[{medic:'MEDIC!',help:'HELP ME!',hold:'HOLD ON!',grab:'GOT YOU!',grenade:'GRENADE!',down:'GET DOWN!',mg:'MG!',
 cover:'COVER ME!',move:'MOVE!',reload:'RELOADING!',pain:'AGH!',arty:'INCOMING!',clear:'CLEAR!',target:'TARGET!',water:'KEEP IT DRY!'},
 {medic:'SANI!',help:'HILFE!',hold:'HALT AUS!',grab:'HAB DICH!',grenade:'GRANATE!',down:'DECKUNG!',mg:'MG!',
 cover:'FEUERSCHUTZ!',move:'LOS!',reload:'NACHLADEN!',pain:'ARGH!',arty:'ARTILLERIE!',clear:'FREI!',target:'ZIEL!',water:'GEWEHR HOCH!'}];
K.lang=(team,key)=>(L[team?1:0][key])||key;

/* ---------- gritos ---------- */
const SH=[];K.shouts=SH;
K.shout=function(u,key,dur=1.5,col){if(!K.on||!u||u.hp<=0)return false;if(u._shT&&time-u._shT<2.5)return false;
 if(SH.length>=10){/* troca o mais velho só se este estiver perto da câmera */const far=Math.hypot(u.x-cam.x,u.y-cam.y)>500;if(far)return false;SH.shift()}
 u._shT=time;SH.push({u,txt:K.lang(u.team,key),key,t0:time,dur,col:col||(key==='medic'||key==='help'||key==='pain'?'#f2d6c8':'#efe9c8')});
 if(K.voice)try{K.voice(key,u)}catch{}return true};
K.voice=null;     // o soundscape.js preenche
function drawShouts(c,ox,oy){for(let i=SH.length-1;i>=0;i--){const s=SH[i],age=time-s.t0;if(age>s.dur||s.u.hp<=0){SH.splice(i,1);continue}
  const w=K.textW(s.txt),x=ox+Math.round(s.u.x*Z)-(w>>1),y=oy+Math.round(s.u.y*Z)-22-Math.round(Math.min(age,.25)*8);
  if(x<-w||y<-10||x>vw+4||y>vh+4)continue;c.globalAlpha=age>s.dur-.3?Math.max(0,(s.dur-age)/.3):1;
  c.fillStyle='rgba(18,20,14,.72)';c.fillRect(x-2,y-2,w+4,9);c.fillRect(x+(w>>1)-1,y+7,3,1);K.text(c,s.txt,x,y,s.col);c.globalAlpha=1}}

/* ---------- poses por recorte do sprite ---------- */
K.pose=function(c,sp,sx,sy,vis,bob,o={}){const w=sp.c.width,foot=sp.ay+8;let v=Math.min(vis,sp.c.height),dy=(o.dy||0)+bob,dx=o.dx||0;
 if(o.low){v=Math.min(v,sp.ay-(o.low>1?3:0));dy+=foot-v-2}   // low=1: capacete e ombros acima do parapeito; low=2: só o capacete
 else if(o.crouch){v=Math.min(v,foot-3);dy+=3}               // ajoelhado / agachado: perde a canela e desce
 if(o.cut)v=Math.min(v,foot-o.cut);
 K.poseU=o.u||null;K.poseDy=dy-bob;
 if(v<=0)return true;c.drawImage(sp.c,0,0,w,v,sx-sp.ax+dx,sy-sp.ay+dy,w,v);return true};
/* desenho padrão do pixel.js (para quem precisa desenhar por cima do sprite e devolver true) */
K.plain=(c,sp,sx,sy,vis,bob)=>{K.poseU=null;K.poseDy=0;c.drawImage(sp.c,0,0,sp.c.width,vis,sx-sp.ax,sy-sp.ay+bob,sp.c.width,vis);return true};

/* ---------- bandeiras nacionais em pixels (EUA 1917: 13 listras + cantão; Império Alemão: preto-branco-vermelho) ---------- */
K.flagPx=function(team,c,r,W,H){if(team===0){if(c<Math.ceil(W*.42)&&r<Math.ceil(H*7/13))return (r+c)%2===1&&r<Math.ceil(H*7/13)-1&&c>0?'#f4f4f0':'#2b3f86';
  return Math.floor(r*13/H)%2===0?'#b22234':'#f4f4f0'}
 if(team===1)return r<H/3?'#1d1d1d':r<2*H/3?'#eeeee6':'#c4271c';return r<H/2?'#b7baa0':'#a1a48a'};

/* ---------- trincheiras ---------- */
K.trenchOf=function(u){if(typeof trenchGrid==='undefined')return null;
 for(let gx=-1;gx<=1;gx++)for(let gy=-1;gy<=1;gy++){const l=trenchGrid.get((Math.floor(u.x/128)+gx)+','+(Math.floor(u.y/128)+gy));if(!l)continue;
  for(const t of l)if(Math.abs(t.x-u.x)<(t.hw||52)&&Math.abs(t.y-u.y)<(t.hh||22))return t}
 for(const b of buildings)if(b.type==='trench'&&Math.abs(b.x-u.x)<52&&Math.abs(b.y-u.y)<22)return b;
 return null};
K.inTrench=u=>!!K.trenchOf(u);
/* prioridade do E no modo soldado: módulos registram "eu trato o E agora"; o soldier-tactics.js (saque) cede a vez */
K.ePri=[];K.ePriority=()=>{try{return K.on&&K.ePri.some(f=>f())}catch{return false}};
K.w2s=(x,y,ox,oy)=>[ox+Math.round(x*Z),oy+Math.round(y*Z)];

/* desenho dos gritos por cima de tudo do campo */
if(window.WW1A){const o0=WW1A.over;WW1A.over=function(c,ox,oy,dt){o0.call(this,c,ox,oy,dt);if(!K.on)return;try{drawShouts(c,ox,oy)}catch(e){if(!K._err){K._err=1;console.error('life-kit.js:',e)}}}}
const s0=window.setup;if(typeof s0==='function')window.setup=function(...a){SH.length=0;return s0.apply(this,a)};
})();
