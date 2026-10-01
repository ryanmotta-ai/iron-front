'use strict';
/* Iron Front 0.9 — arte da interface: fonte bitmap 5x7, ícones 12x12, logo em metal,
   miniaturas de mapa e retratos. Tudo procedural, em pixels inteiros (sem antialias). */
(function(){
const hash=(x,y,s=0)=>{let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(s|0,1274126177))|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296};
const BAY=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5].map(v=>(v+.5)/16);
const bay=(x,y)=>BAY[(y&3)*4+(x&3)];
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=Math.max(1,w|0);c.height=Math.max(1,h|0);return c};
const g2=c=>{const x=c.getContext('2d');x.imageSmoothingEnabled=false;return x};
const R=(c,x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),w,h)};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hex=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const mixc=(a,b,t)=>{const A=hex(a),B=hex(b);return'#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('')};

/* ---------- fonte 5x7 (maiúsculas, números e pontuação) ---------- */
const F5={
A:'01110 10001 10001 11111 10001 10001 10001',B:'11110 10001 10001 11110 10001 10001 11110',C:'01110 10001 10000 10000 10000 10001 01110',
D:'11110 10001 10001 10001 10001 10001 11110',E:'11111 10000 10000 11110 10000 10000 11111',F:'11111 10000 10000 11110 10000 10000 10000',
G:'01110 10001 10000 10111 10001 10001 01111',H:'10001 10001 10001 11111 10001 10001 10001',I:'01110 00100 00100 00100 00100 00100 01110',
J:'00111 00010 00010 00010 00010 10010 01100',K:'10001 10010 10100 11000 10100 10010 10001',L:'10000 10000 10000 10000 10000 10000 11111',
M:'10001 11011 10101 10101 10001 10001 10001',N:'10001 11001 10101 10011 10001 10001 10001',O:'01110 10001 10001 10001 10001 10001 01110',
P:'11110 10001 10001 11110 10000 10000 10000',Q:'01110 10001 10001 10001 10101 10010 01101',R:'11110 10001 10001 11110 10100 10010 10001',
S:'01111 10000 10000 01110 00001 00001 11110',T:'11111 00100 00100 00100 00100 00100 00100',U:'10001 10001 10001 10001 10001 10001 01110',
V:'10001 10001 10001 10001 10001 01010 00100',W:'10001 10001 10001 10101 10101 11011 10001',X:'10001 10001 01010 00100 01010 10001 10001',
Y:'10001 10001 01010 00100 00100 00100 00100',Z:'11111 00001 00010 00100 01000 10000 11111',
0:'01110 10001 10011 10101 11001 10001 01110',1:'00100 01100 00100 00100 00100 00100 01110',2:'01110 10001 00001 00010 00100 01000 11111',
3:'11110 00001 00001 01110 00001 00001 11110',4:'00010 00110 01010 10010 11111 00010 00010',5:'11111 10000 11110 00001 00001 10001 01110',
6:'00110 01000 10000 11110 10001 10001 01110',7:'11111 00001 00010 00100 01000 01000 01000',8:'01110 10001 10001 01110 10001 10001 01110',
9:'01110 10001 10001 01111 00001 00010 01100',
'.':'00000 00000 00000 00000 00000 00110 00110',',':'00000 00000 00000 00000 00110 00100 01000','-':'00000 00000 00000 11111 00000 00000 00000',
':':'00000 00110 00110 00000 00110 00110 00000','/':'00001 00010 00010 00100 01000 01000 10000','!':'00100 00100 00100 00100 00100 00000 00100',
'\'':'00100 00100 01000 00000 00000 00000 00000','·':'00000 00000 00100 01110 00100 00000 00000','*':'00000 10101 01110 11111 01110 10101 00000',
'?':'01110 10001 00001 00110 00100 00000 00100','Ç':'01110 10001 10000 10000 10000 01110 00100','Ã':'01010 00000 01110 10001 11111 10001 10001',
'Õ':'01010 00000 01110 10001 10001 10001 01110','Á':'00110 00000 01110 10001 11111 10001 10001','É':'00110 00000 11111 10000 11110 10000 11111',
'Ó':'00110 00000 01110 10001 10001 10001 01110','Ê':'00100 01010 11111 10000 11110 10000 11111','Í':'00110 00000 01110 00100 00100 00100 01110',
'Â':'00100 01010 01110 10001 11111 10001 10001','Ú':'00110 00000 10001 10001 10001 10001 01110','Ô':'00100 01010 01110 10001 10001 10001 01110'
};
const GL={};for(const k in F5)GL[k]=F5[k].split(' ').map(r=>r.split('').map(Number));
function textW(s,sc=1){return s.length?s.length*6*sc-sc:0}
function text(c,s,x,y,col,sc=1,shadow){s=String(s).toUpperCase();let cx=x;for(const ch of s){const g=GL[ch];if(g){for(let j=0;j<7;j++)for(let i=0;i<5;i++)if(g[j][i]){if(shadow)R(c,cx+i*sc+sc,y+j*sc+sc,sc,sc,shadow);}
  if(g)for(let j=0;j<7;j++)for(let i=0;i<5;i++)if(g[j][i])R(c,cx+i*sc,y+j*sc,sc,sc,col)}cx+=6*sc}}

/* ---------- ícones 12x12 ---------- */
const IC={k:'#0b0d08',w:'#ece4c9',g:'#d9b556',G:'#f0d27a',y:'#8a6a24',r:'#e0836b',R:'#8f3524',b:'#7fc0d6',B:'#2f6a7e',s:'#a6b1b9',S:'#57626c',o:'#c3b27c',O:'#5a4e31',n:'#8d6834',N:'#34230f',e:'#a5d06f',E:'#4a6a2a',d:'#3a3f2c'};
const ICONS={
flag:['kk..........','kGkkkkkkkkk.','kgBBbbrrrrrk','kgBbBbwwwwwk','kgbBbBrrrrrk','kgBBbbwwwwwk','kgkkkkkkkkk.','kg..........','kg..........','kg..........','kyk.........','kkkk........'],
book:['.kkkkk.kkkk.','kwwwwkkwwwwk','kwkkwkkwkkwk','kwwwwkkwwwwk','kwkkwkkwkkwk','kwwwwkkwwwwk','kwkkwkkwwwwk','kwwwwkkwwwwk','kggggkkggggk','kyyyykkyyyyk','.kkkkk.kkkk.','............'],
crate:['............','..kkkkkkkk..','.koooooooook','kooOoooOooOk','koOoooooOook','kooooOoooook','kOoooooOoook','kooOoooooOok','koooooOooook','.kOOOOOOOOk.','..kkkkkkkk..','............'],
gear:['.....kk.....','..kk.kk.kk..','.kgkkggkkgk.','..kggggggk..','.kgggkkgggk.','kkggkwwkggkk','kkggkwwkggkk','.kgggkkgggk.','..kggggggk..','.kgkkggkkgk.','..kk.kk.kk..','.....kk.....'],
help:['...kkkkkk...','..kwwwwwwk..','.kwkkkkkkwk.','.kwk....kwk.','.....kkkwk..','....kwwwk...','...kwwk.....','...kwk......','............','...kwk......','...kwk......','....kk......'],
sndon:['............','.....k......','....kg...k..','.kkkkg....k.','.kggkg.k..k.','.kggkg..k.k.','.kggkg..k.k.','.kggkg.k..k.','.kkkkg....k.','....kg...k..','.....k......','............'],
sndoff:['............','.....k......','....kg......','.kkkkg.k..k.','.kggkg..kk..','.kggkg..kk..','.kggkg.k..k.','.kggkg......','.kkkkg......','....kg......','.....k......','............'],
pause:['............','..kkk..kkk..','.kwwwkkwwwk.','.kwwwkkwwwk.','.kwwwkkwwwk.','.kwwwkkwwwk.','.kwwwkkwwwk.','.kwwwkkwwwk.','.kwwwkkwwwk.','..kkk..kkk..','............','............'],
play:['............','..kk........','..kwkk......','..kwwwkk....','..kwwwwwkk..','..kwwwwwwwk.','..kwwwwwkk..','..kwwwkk....','..kwkk......','..kk........','............','............'],
menu:['............','............','.kkkkkkkkkk.','.kwwwwwwwwk.','.kkkkkkkkkk.','............','.kkkkkkkkkk.','.kwwwwwwwwk.','.kkkkkkkkkk.','............','............','............'],
ai:['....kk......','...kGGk..kk.','..kGGGGk.kgk','.kkGggGkkgk.','kgkGggGkgk..','.kkkGGkkk...','...kggk.....','..kgggk.....','.kkggkk.....','kgkkkkgk....','.kk..kk.....','............'],
qg:['.kkkkkkkkk..','.kwwwwwwwk..','.kwkkkkkwk..','.kwwwwwwwk..','.kwkkkkwwk..','.kwwwwwwwk..','.kwkkkkkwk..','.kwwwwwwwk..','.kwkkkwwwk..','.kwwwwwwwk..','.kkkkkkkkk..','............'],
close:['............','.kk......kk.','.kwk....kwk.','..kwk..kwk..','...kwkkwk...','....kwwk....','....kwwk....','...kwkkwk...','..kwk..kwk..','.kwk....kwk.','.kk......kk.','............'],
lock:['....kkkk....','...kSssSk...','...kS..Sk...','...kS..Sk...','.kkkkkkkkkk.','.kggggggggk.','.kgggkkgggk.','.kgggkkgggk.','.kgggkkgggk.','.kggggggggk.','.kkkkkkkkkk.','............'],
check:['............','..........kk','.........kek','........kek.','.......kek..','kk....kek...','kek..kek....','.kekkek.....','..keek......','...kk.......','............','............'],
star:['.....kk.....','.....kGk....','....kGGGk...','kkkkkGGGkkkk','kGGGGGGGGGGk','.kGGGGGGGGk.','..kGGGGGGk..','..kGGGGGGk..','.kGGGkkGGGk.','.kGGk..kGGk.','.kkk....kkk.','............'],
skull:['...kkkkkk...','..kwwwwwwk..','.kwwwwwwwwk.','.kwkkwwkkwk.','.kwkkwwkkwk.','.kwwwwwwwwk.','..kwwkkwwk..','..kwwwwwwk..','...kwkwkwk..','...kkkkkkk..','............','............'],
arrow:['............','............','......kk....','......kwk...','kkkkkkkwwk..','kwwwwwwwwwk.','kwwwwwwwwwk.','kkkkkkkwwk..','......kwk...','......kk....','............','............'],
helmet:['............','...kkkkkk...','..kssssssk..','.kssSssssSk.','.kssssssssk.','kkkkkkkkkkkk','kSSssssssSSk','.kkkkkkkkkk.','............','............','............','............'],
fs:['............','.kkkk..kkkk.','.kwwk..kwwk.','.kwk....kwk.','.kk......kk.','............','............','.kk......kk.','.kwk....kwk.','.kwwk..kwwk.','.kkkk..kkkk.','............'],
cmd:['............','.kkk....kkk.','kwwwk..kwwwk','kwSwk..kwSwk','kwwwkkkkwwwk','kwwwkSSkwwwk','.kkkkkkkkkk.','.kSk....kSk.','.kSk....kSk.','.kkk....kkk.','............','............'],
cross:['............','....kkkk....','....kRRk....','....kRRk....','.kkkkRRkkkk.','.kRRRRRRRRk.','.kRRRRRRRRk.','.kkkkRRkkkk.','....kRRk....','....kRRk....','....kkkk....','............']
};
const iconCache={};
function icon(name,scale=1){const key=name+'@'+scale;if(iconCache[key])return iconCache[key];const rows=ICONS[name]||ICONS.star,c=mk(12*scale,12*scale),x=g2(c);rows.forEach((row,j)=>{for(let i=0;i<12;i++){const ch=row[i];if(ch&&ch!=='.'&&IC[ch])R(x,i*scale,j*scale,scale,scale,IC[ch])}});return iconCache[key]=c}
const iconURL=(n,s=1)=>icon(n,s).toDataURL();
/* ícone de bandeira da facção (12x12): usa a bandeira nacional de IFK.flagPx (life-kit.js, que carrega depois deste arquivo, por isso a leitura é preguiçosa).
   Sem IFK devolve o ícone 'flag' antigo. Não é cacheado: o jogador pode trocar de lado no meio da batalha. */
function flagIconURL(team){
 const K=window.IFK;if(!K||typeof K.flagPx!=='function')return iconURL('flag');
 const c=mk(12,12),x=g2(c);R(x,1,0,1,12,IC.g);R(x,1,0,1,1,IC.G);R(x,1,10,2,2,IC.y);
 R(x,2,1,10,6,IC.k);for(let r=0;r<4;r++)for(let q=0;q<8;q++)R(x,3+q,2+r,1,1,K.flagPx(team?1:0,q,r,8,4));
 return c.toDataURL()}

/* ---------- logo: IRON / FRONT em placas de metal ---------- */
const LET={
I:['######','######','..##..','..##..','..##..','..##..','..##..','######','######'],
R:['#####.','######','##..##','##..##','#####.','####..','##.##.','##..##','##..##'],
O:['.####.','######','##..##','##..##','##..##','##..##','##..##','######','.####.'],
N:['##..##','###.##','######','######','##.###','##..##','##..##','##..##','##..##'],
F:['######','######','##....','##....','#####.','#####.','##....','##....','##....'],
T:['######','######','..##..','..##..','..##..','..##..','..##..','..##..','..##..']
};
const STEEL=['#f4f8fb','#cfd8df','#a3b0ba','#7a8894','#56626d','#37414a','#1f262d'];
const BRASS=['#fff0b8','#f6cf6a','#dba23a','#b37424','#85501a','#56320f','#2e1a08'];
function wordMask(word,s,gap){const cols=word.length*6,w=cols*s+(word.length-1)*gap,h=9*s,m=new Uint8Array(w*h);let ox=0;for(const ch of word){const L=LET[ch];for(let j=0;j<9;j++)for(let i=0;i<6;i++)if(L[j][i]==='#')for(let y=0;y<s;y++)for(let x=0;x<s;x++)m[(j*s+y)*w+ox+i*s+x]=1;ox+=6*s+gap}return{w,h,m}}
function metalWord(word,s,gap,ramp,seed,rust){
 const {w,h,m}=wordMask(word,s,gap),pad=4,W=w+pad*2+3,H=h+pad*2+4,out=new Array(W*H).fill(null);
 const at=(x,y)=>x<0||y<0||x>=w||y>=h?0:m[y*w+x];
 const ink='#07090b',shadow='#04050a';
 // sombra extrudada (3 px para baixo e para a direita)
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(m[y*w+x])for(let d=1;d<=3;d++){const px=x+pad+d,py=y+pad+d;if(px<W&&py<H)out[py*W+px]=shadow}
 // contorno
 for(let y=-1;y<=h;y++)for(let x=-1;x<=w;x++)if(!at(x,y)){let n=0;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]])if(at(x+dx,y+dy))n=1;if(n){const px=x+pad,py=y+pad;if(px>=0&&py>=0&&px<W&&py<H)out[py*W+px]=ink}}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(!m[y*w+x])continue;
  let dt=0;while(dt<9&&at(x,y-dt-1))dt++;let db=0;while(db<9&&at(x,y+db+1))db++;let dl=0;while(dl<9&&at(x-dl-1,y))dl++;let dr=0;while(dr<9&&at(x+dr+1,y))dr++;
  let idx;
  if(dt===0)idx=0;else if(dl===0&&dt<7)idx=1;else if(dt<=2)idx=1;
  else if(db===0)idx=6;else if(dr===0)idx=5;else if(db===1)idx=5;
  else{const f=y/h+(bay(x,y)-.5)*.22;idx=f<.42?2:f<.72?3:4}
  const streak=hash(y,seed,7);if(idx>=2&&idx<=4){if(streak>.86)idx=Math.max(1,idx-1);else if(streak<.1)idx=Math.min(5,idx+1)}
  if(idx>=2&&idx<=4&&hash(x>>1,y>>1,seed+5)>.965)idx=Math.max(1,idx-2);
  if(rust&&idx>=2&&hash(x>>2,y>>1,seed+11)>.88&&y>h*.35)idx=Math.min(5,idx+1);
  out[(y+pad)*W+x+pad]=ramp[idx];
  if(rust&&idx>=2&&idx<=4&&hash(x,y,seed+13)>.93)out[(y+pad)*W+x+pad]=['#6b2f12','#8a3c14','#a8521c'][(x+y)%3]}
 // rebites nos cantos de cada bloco
 const cs=s;for(let cj=0;cj<9;cj++)for(let ci=0;ci<word.length*6;ci++){const ox=ci*s+Math.floor(ci/6)*gap;const solid=(a,b)=>at(ox+a*s,b*s);
  const L=LET[word[Math.floor(ci/6)]],lc=ci%6;if(L[cj][lc]!=='#')continue;
  const up=cj>0&&L[cj-1][lc]==='#',lf=lc>0&&L[cj][lc-1]==='#';
  if(!up&&!lf){const rx=ox+Math.floor(s/2)-1+pad,ry=cj*s+Math.floor(s/2)-1+pad;out[ry*W+rx]=ramp[0];out[(ry+1)*W+rx+1]=ramp[5];out[ry*W+rx+1]=ramp[2];out[(ry+1)*W+rx]=ramp[2]}}
 return{W,H,px:out,w,h,pad}}
function buildLogo(lines,sc){
 const s=sc||4,gap=Math.max(2,s);
 let a,b,sub;
 const iron=metalWord('IRON',s,gap,STEEL,3,false),front=metalWord('FRONT',s,gap,BRASS,9,true);
 const subTxt='PIXEL BATTLEFIELD';const subW=textW(subTxt)+30,subH=15;
 let W,H,place;
 if(lines===2){W=Math.max(iron.W,front.W,subW)+6;H=iron.H+front.H-6+subH+5;place=[[Math.round((W-iron.W)/2),0,iron],[Math.round((W-front.W)/2),iron.H-7,front]]}
 else{W=iron.W+front.W+2+10;H=front.H+subH+5;place=[[0,0,iron],[iron.W+8,0,front]]}
 const cv=mk(W,H),c=g2(cv);
 const base=[];// pixels animáveis: [x,y,cor]
 for(const[ox,oy,m]of place)for(let y=0;y<m.H;y++)for(let x=0;x<m.W;x++){const col=m.px[y*m.W+x];if(col)base.push([ox+x,oy+y,col])}
 // placa do subtítulo
 const sx=Math.round((W-subW)/2),sy=H-subH;
 const plate=()=>{R(c,sx,sy,subW,subH,'#07090b');R(c,sx+1,sy+1,subW-2,subH-2,'#56320f');R(c,sx+2,sy+2,subW-4,subH-4,'#1b1f16');R(c,sx+2,sy+2,subW-4,1,'#3a4028');
  for(const rx of[sx+3,sx+subW-5])for(const ry of[sy+3,sy+subH-5]){R(c,rx,ry,2,2,'#b37424');R(c,rx,ry,1,1,'#f6cf6a')}
  text(c,subTxt,sx+16,sy+4,'#f0d27a',1,'#000');  const st=icon('star');c.drawImage(st,0,0,12,12,sx+3,sy+2,11,11);c.drawImage(st,0,0,12,12,sx+subW-14,sy+2,11,11)};
 // rastro de luz (brilho que passa)
 function draw(t){c.clearRect(0,0,W,H);const band=((t*38)%(W+H+120))-60;
  for(const[x,y,col]of base){const d=Math.abs((x+y*.7)-band);let cc=col;if(d<4&&col!=='#07090b'&&col!=='#04050a')cc=mixc(col,'#ffffff',d<2?.55:.28);R(c,x,y,1,1,cc)}
  plate()}
 draw(0);
 return{canvas:cv,w:W,h:H,draw}}

/* ---------- miniaturas dos mapas (para a tela de campanha) ---------- */
function mapThumb(kind,w=96,h=56,seed=1){
 const cv=mk(w,h),c=g2(cv),hz=Math.round(h*.4);
 const skies={trenches:['#2a2350','#4a2a55','#7a3a52','#b2523f','#e0843c'],forest:['#10192a','#1c2a3a','#2c4048','#4a6458','#7a8c6c'],winter:['#6d8aa8','#8fa9bf','#b3c6d3','#d3dee6','#eef3f5'],storm:['#0a0d18','#141a2c','#232b40','#34405a','#56647e'],rain:['#232a30','#303a40','#404c52','#56645f','#6f7c72']}[kind]||[];
 const ground={trenches:['#3a2e1c','#4d3d25','#66502f'],forest:['#1a2a1a','#26401f','#355a2a'],winter:['#9db0b8','#c2d0d6','#e8eff2'],storm:['#1a1f1a','#252c22','#33402c'],rain:['#2a2e22','#3c4230','#4d5540']}[kind];
 for(let y=0;y<hz;y++)for(let x=0;x<w;x++){const f=y/hz*(skies.length-1),i=Math.floor(f),t=f-i;R(c,x,y,1,1,bay(x,y)<t?skies[Math.min(i+1,skies.length-1)]:skies[i])}
 // nuvens
 for(let i=0;i<14;i++){const x=hash(i,seed,1)*w,y=hash(i,seed,2)*hz*.7,l=8+hash(i,seed,3)*18;R(c,x,y,l,2,kind==='winter'?'#ffffffaa':'#00000044');R(c,x+2,y-1,l-5,1,kind==='winter'?'#ffffff88':'#00000033')}
 // colinas
 const hill=(base,amp,col,sd)=>{for(let x=0;x<w;x++){const y=Math.round(base+Math.sin(x/11+sd)*amp+Math.sin(x/5.3+sd*2)*amp*.4);R(c,x,y,1,h-y,col)}};
 hill(hz-3,3,kind==='winter'?'#9fb3bd':kind==='forest'?'#15281a':'#2a1f24',seed);
 // terreno
 for(let y=hz;y<h;y++)for(let x=0;x<w;x++){const t=(y-hz)/(h-hz),i=t<.33?0:t<.66?1:2;let col=ground[i];if(hash(x,y,seed+4)>.93)col=ground[Math.min(2,i+1)];if(bay(x,y)<((t*3)%1)*.5&&i<2)col=ground[i+1];R(c,x,y,1,1,col)}
 if(kind==='trenches'||kind==='storm'||kind==='rain'){
  for(let k=0;k<3;k++){const y=hz+6+k*10;for(let x=0;x<w;x++){const tri=Math.abs(((x+k*5)%16)-8)/8,yy=Math.round(y+tri*3);R(c,x,yy,1,2,'#120d08');R(c,x,yy-1,1,1,'#7a6238');if(x%9===0){R(c,x,yy-4,1,4,'#2a1d10');R(c,x+1,yy-3,2,1,'#8a8a8a')}}}
  for(let i=0;i<7;i++){const x=hash(i,seed,8)*w,y=hz+4+hash(i,seed,9)*(h-hz-8);R(c,x,y,5,2,'#120d08');R(c,x+1,y-1,3,1,'#6b5530')}
  if(kind!=='rain'){for(let i=0;i<3;i++){const x=12+i*31+hash(i,seed,5)*8;for(let j=0;j<9;j++)R(c,x+Math.sin(j*.6)*2,hz-4-j*2,3,3,j<3?'#3a2c2c':'#2a2024')}}}
 if(kind==='forest'){
  for(let row=0;row<3;row++)for(let i=0;i<13;i++){const sz=7+row*3,x=i*8+row*3+hash(i,row,seed)*3,y=hz+1+row*10;R(c,x+sz/2-1,y+sz+1,2,3,'#2a1c10');for(let j=0;j<4;j++){const ww=Math.round(2+j*sz/3.2);R(c,x+(sz-ww)/2,y+j*2.6,ww,3,['#2b5a2e','#22492a','#1b3a22','#14301b'][j])}}
  for(let y=hz+4;y<h;y+=3)for(let x=0;x<w;x++)if(bay(x,y)<.18)R(c,x,y,1,1,'#9fb4a055')}
 if(kind==='winter'){
  for(let row=0;row<2;row++)for(let i=0;i<7;i++){const sz=8+row*4,x=i*14+row*6+hash(i,row,seed)*4,y=hz+2+row*13;R(c,x+sz/2-1,y+sz+1,2,3,'#3a2c20');for(let j=0;j<4;j++){const ww=Math.round(2+j*sz/3.2);R(c,x+(sz-ww)/2,y+j*2.6,ww,3,j%2?'#e8eff2':'#2f5a46');R(c,x+(sz-ww)/2,y+j*2.6,ww,1,'#ffffff')}}
  for(let i=0;i<60;i++)R(c,hash(i,seed,6)*w,hash(i,seed,7)*h,1,1,'#ffffffcc')}
 if(kind==='storm'){for(let i=0;i<2;i++){let x=20+i*50,y=0;c.fillStyle='#fff6c0';while(y<hz+4){c.fillRect(x,y,1,2);x+=Math.round(hash(y,i,3)*3-1.5);y+=2}}}
 if(kind==='rain'||kind==='storm'){for(let i=0;i<70;i++){const x=hash(i,seed,11)*w,y=hash(i,seed,12)*h;R(c,x,y,1,3,'#b8c8d488');R(c,x-1,y+3,1,1,'#b8c8d455')}}
 // vinheta e borda
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const d=Math.max(Math.abs(x-w/2)/(w/2),Math.abs(y-h/2)/(h/2));if(d>.82&&bay(x,y)<(d-.82)*4)R(c,x,y,1,1,'#05070a')}
 return cv}

/* ---------- retratos 32x32 ---------- */
function portrait(kind){
 const cv=mk(32,32),c=g2(cv);
 const skin=['#4a2f22','#8a5d42','#b98a64','#d9b08a'],K='#07090b';
 const us=kind==='us',de=kind==='de',cap=kind==='cap';
 const cloth=us?['#1f2413','#33391c','#4c5428','#6b7438']:de?['#1d2124','#2e3438','#444d50','#5d6a6b']:['#231d16','#3a2f22','#57462f','#7a6244'];
 R(c,0,0,32,32,us?'#1d2a33':de?'#2a2322':'#2a2a1e');for(let y=0;y<32;y++)for(let x=0;x<32;x++)if(bay(x,y)<y/32*.35)R(c,x,y,1,1,us?'#26384a':de?'#3a2e2a':'#3a3a28');
 // ombros
 R(c,3,25,26,7,cloth[1]);R(c,2,27,28,5,cloth[1]);R(c,5,25,22,2,cloth[2]);R(c,14,24,4,3,cloth[0]);
 R(c,8,27,1,5,cloth[0]);R(c,23,27,1,5,cloth[0]);
 for(let i=0;i<4;i++)R(c,11+i*3,27+(i%2),1,1,'#c4a64a');
 // pescoço e rosto
 R(c,13,20,6,6,skin[1]);R(c,13,22,6,2,skin[0]);
 R(c,9,9,14,13,skin[2]);R(c,9,9,3,13,skin[3]);R(c,21,10,2,12,skin[1]);R(c,10,20,12,2,skin[1]);
 R(c,8,12,1,6,K);R(c,23,12,1,6,K);R(c,9,21,2,1,K);R(c,21,21,2,1,K);R(c,11,22,10,1,K);R(c,9,19,1,2,K);R(c,22,19,1,2,K);
 // olhos e boca
 R(c,11,14,3,2,'#f0e6d0');R(c,18,14,3,2,'#f0e6d0');R(c,12,14,2,2,K);R(c,19,14,2,2,K);R(c,11,13,4,1,skin[0]);R(c,18,13,4,1,skin[0]);
 R(c,15,16,2,3,skin[1]);R(c,13,20,6,1,skin[0]);R(c,14,20,4,1,'#6a3a30');
 if(de||cap){R(c,12,18,8,2,'#3a2a1a');R(c,11,19,2,1,'#3a2a1a');R(c,19,19,2,1,'#3a2a1a')}else R(c,12,21,8,1,skin[1]);
 // capacete
 if(us){R(c,5,7,22,4,cloth[2]);R(c,8,3,16,5,cloth[2]);R(c,10,2,12,2,cloth[3]);R(c,4,9,24,2,cloth[1]);R(c,4,10,24,1,K);R(c,8,2,1,6,K);R(c,23,2,1,6,K);R(c,10,1,12,1,K);R(c,5,6,1,3,K);R(c,26,6,1,3,K);R(c,9,4,4,1,cloth[3]);R(c,9,11,14,1,cloth[0]);for(let x=9;x<23;x+=2)R(c,x,12,1,1,cloth[0])}
 else if(de){R(c,7,3,18,8,cloth[2]);R(c,9,2,14,2,cloth[3]);R(c,6,9,20,3,cloth[1]);R(c,6,12,3,7,cloth[1]);R(c,23,12,3,7,cloth[1]);R(c,6,2,1,10,K);R(c,25,2,1,10,K);R(c,9,1,14,1,K);R(c,6,19,3,1,K);R(c,23,19,3,1,K);R(c,10,4,5,1,cloth[3]);R(c,22,6,2,2,'#c4a64a');R(c,9,11,14,1,cloth[0])}
 else{R(c,7,4,18,5,cloth[2]);R(c,5,8,22,3,cloth[1]);R(c,9,3,14,2,cloth[3]);R(c,14,6,4,3,'#c4a64a');R(c,6,3,1,7,K);R(c,25,3,1,7,K);R(c,9,2,14,1,K);R(c,4,11,24,1,K);R(c,5,10,22,1,cloth[0]);R(c,4,8,1,3,K);R(c,27,8,1,3,K)}
 // contorno externo
 R(c,0,0,32,1,K);R(c,0,31,32,1,K);R(c,0,0,1,32,K);R(c,31,0,1,32,K);
 return cv}

window.UIArt={hash,BAY,bay,mk,g2,R,clamp,hex,mixc,text,textW,icon,iconURL,flagIconURL,ICONS,buildLogo,mapThumb,portrait,IC};
})();
