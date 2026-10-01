'use strict';
(function(){
const K=PX.WW1.kit,{R,dot,ell,line,spr,C,H,fromGrid,mix,disc,ring,srand,sr,clamp,mk,g2}=K,A=PX.WW1.SPR=PX.WW1.SPR||{};
/* Iron Front 0.6 — sprites de guerra: artilharia, trincheira, terra de ninguém, ruínas, ponte e ferrovia. */

/* ---------- artilharia (viradas para leste; o lado Central usa a versão espelhada) ---------- */
A.fieldGun=()=>spr('fieldGun',34,16,(x)=>{
 line(x,11,6,1,2,'#3b2a1c');line(x,11,7,1,3,'#5e452e');line(x,11,9,1,13,'#3b2a1c');line(x,11,8,1,12,'#5e452e');           // cauda (duas varas abertas)
 R(x,7,0,9,2,'#262016');R(x,7,0,9,1,'#5a4a34');R(x,7,14,9,2,'#262016');R(x,7,14,9,1,'#5a4a34');                              // rodas (vistas de cima)
 R(x,10,3,4,10,'#4a5056');R(x,10,3,1,10,'#8a9198');R(x,13,3,1,10,'#2b2f33');                                                  // berço
 R(x,4,6,7,4,'#3d4247');R(x,4,6,7,1,'#6b7278');R(x,4,9,7,1,'#24282c');                                                       // culatra
 R(x,14,7,16,3,'#5d646b');R(x,14,7,16,1,'#aab1b6');R(x,14,9,16,1,'#2f3338');R(x,26,6,5,5,'#454b51');R(x,26,6,5,1,'#7d858c');R(x,30,7,3,3,'#22262a');  // tubo e freio de boca
 R(x,15,4,2,8,'#7d858c');R(x,15,4,1,8,'#c2c8cc');R(x,16,4,1,8,'#3f454b');dot(x,15,3,'#3f454b');dot(x,15,12,'#3f454b');        // escudo
 R(x,8,4,2,2,'#b8923a');dot(x,8,4,'#f0d27a')},{ax:17,ay:13,sh:[3,3]});
A.howitzer=()=>spr('howitzer',44,22,(x)=>{
 line(x,14,9,1,3,'#3b2a1c');line(x,14,10,1,4,'#5e452e');line(x,14,12,1,18,'#3b2a1c');line(x,14,11,1,17,'#5e452e');R(x,1,3,2,16,'#3b2a1c');R(x,1,3,1,16,'#5e452e');
 R(x,7,0,13,3,'#221d13');R(x,7,0,13,1,'#5a4a34');R(x,7,19,13,3,'#221d13');R(x,7,19,13,1,'#5a4a34');
 R(x,12,3,7,16,'#454b51');R(x,12,3,1,16,'#8a9198');R(x,18,3,1,16,'#24282c');
 R(x,5,8,9,6,'#3a3f44');R(x,5,8,9,1,'#6b7278');R(x,5,13,9,1,'#1f2225');
 R(x,18,8,20,5,'#5d646b');R(x,18,8,20,1,'#b4bbc0');R(x,18,12,20,1,'#2a2e32');R(x,25,7,2,7,'#3f454b');R(x,32,7,2,7,'#3f454b');R(x,37,8,5,5,'#454b51');R(x,37,8,5,1,'#7d858c');R(x,41,9,2,3,'#1f2225');
 R(x,18,4,2,14,'#7d858c');R(x,18,4,1,14,'#c2c8cc');R(x,19,4,1,14,'#3f454b');
 R(x,9,6,2,2,'#b8923a');dot(x,9,6,'#f0d27a');R(x,22,14,8,2,'#3b2a1c')},{ax:22,ay:17,sh:[4,4]});
/* rede de camuflagem translúcida sobre a posição */
A.camoNet=(w=44,h=34,seed=1)=>spr(`camo${w}${h}${seed}`,w,h,(x)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++){const dx=(i-w/2)/(w/2),dy=(j-h/2)/(h/2),d=dx*dx+dy*dy+(H(i,j,seed)-.5)*.45;if(d>1)continue;
  const v=H(i>>2,j>>2,seed+5),net=((i+j)%5===0)||((i-j+50)%5===0);if(v>.7)x.fillStyle='rgba(62,74,42,.85)';else if(net&&d>.25)x.fillStyle='rgba(38,42,28,.55)';else if(v<.2&&d>.5)x.fillStyle='rgba(84,92,54,.6)';else continue;x.fillRect(i,j,1,1)}},{out:0,ax:w>>1,ay:h>>1,sh:[3,3],sa:.1});
A.ammoBoxes=()=>spr('ammoBoxes',14,8,(x)=>{R(x,0,2,6,5,'#5c6241');R(x,0,2,6,1,'#7a8257');R(x,5,3,1,4,'#3c4229');R(x,7,1,6,6,'#8a6d48');R(x,7,1,6,1,'#b39a6d');R(x,12,2,1,4,'#5b4630');dot(x,2,4,'#c9b56a')},{ax:7,ay:7,sh:[1,1]});
A.shellsLoose=()=>spr('shellsLoose',16,7,(x)=>{for(let i=0;i<4;i++){const X=1+i*3.5;R(x,X,1+(i%2),2,5,'#7d7f70');dot(x,X,1+(i%2),'#b9bcae');R(x,X,5+(i%2),2,1,'#b8923a')}},{ax:8,ay:6,sh:[1,1]});
A.crewHut=()=>spr('crewHut',26,18,(x)=>{ell(x,13,11,12,7,'#3a2b1c');ell(x,13,9,11,6,'#6b5a3a');ell(x,12,8,9,4,'#82704a');for(let i=0;i<14;i++)dot(x,4+(H(i,1,3)%18),5+(H(i,2,3)%9),H(i,3,3)%2?'#4d5a33':'#9ab060');R(x,10,13,7,3,'#15100b');R(x,9,13,1,3,'#86683f');R(x,17,13,1,3,'#86683f');R(x,9,12,9,1,'#a98a58')},{ax:13,ay:16,sh:[3,3]});

/* ---------- metralhadoras e morteiros ---------- */
A.maxim=()=>spr('maxim',16,10,(x)=>{ // virada para leste
 line(x,4,5,0,1,'#2c2f33');line(x,4,5,0,9,'#2c2f33');line(x,5,5,1,1,'#3f454b');line(x,5,5,1,9,'#3f454b');                 // tripé
 R(x,3,3,7,4,'#4a5056');R(x,3,3,7,1,'#8a9198');R(x,3,6,7,1,'#24282c');R(x,10,4,5,2,'#5d646b');R(x,10,4,5,1,'#aab1b6');R(x,14,3,2,4,'#2f3338');   // camisa d'água e cano
 R(x,1,4,3,2,'#22262a');R(x,5,7,4,2,'#8a6d48');R(x,5,7,4,1,'#b39a6d');dot(x,4,4,'#c2c8cc')},{ax:8,ay:8,sh:[2,2],sa:.25});
A.mortar=()=>spr('mortar',12,12,(x)=>{ell(x,6,7,5,4,'#3a3f44');ell(x,6,6,5,3,'#59606a');line(x,3,10,8,1,'#2a2e32');line(x,4,10,9,1,'#4a5056');R(x,7,1,3,3,'#6b7278');dot(x,7,1,'#aab1b6');R(x,1,9,3,2,'#b8923a')},{ax:6,ay:10,sh:[2,2],sa:.25});
A.lewis=()=>spr('lewis',12,6,(x)=>{R(x,1,2,4,3,'#6d4a30');R(x,4,2,7,2,'#4a5056');R(x,4,2,7,1,'#aab1b6');R(x,6,0,3,2,'#3f454b');R(x,9,4,1,2,'#22262a')},{ax:6,ay:5,sh:[1,1],sa:.2});

/* ---------- detalhes de trincheira ---------- */
A.dugout=()=>spr('dugout',16,13,(x)=>{ // entrada de abrigo: moldura de madeira na encosta
 R(x,1,2,14,10,'#4a3a26');R(x,1,2,14,2,'#6b5539');R(x,2,4,12,8,'#5e452e');R(x,4,5,8,7,'#0d0a06');R(x,3,4,1,8,'#86683f');R(x,12,4,1,8,'#3b2a1c');R(x,3,4,10,1,'#a98a58');R(x,4,11,8,1,'#2a1f14');
 for(let i=0;i<6;i++)dot(x,2+(H(i,5,5)%12),2+(H(i,6,5)%2),'#7d6a4a');R(x,5,6,6,1,'#241b12');R(x,7,8,2,3,'#3a2c1c');dot(x,9,7,'#e0a84a')},{ax:8,ay:11,sh:[2,2]});
A.ladder=(h=9)=>spr('ladder'+h,5,h,(x)=>{R(x,0,0,1,h,'#6b5539');R(x,4,0,1,h,'#6b5539');R(x,0,0,1,h,'#86683f');for(let j=1;j<h;j+=2)R(x,1,j,3,1,'#a98a58')},{ax:2,ay:h-1,sh:[1,1],sa:.2});
A.trenchSign=()=>spr('trenchSign',10,9,(x)=>{R(x,4,4,1,5,'#3b2a1c');R(x,0,0,9,4,'#c7bc9a');R(x,8,1,1,2,'#c7bc9a');dot(x,9,2,'#c7bc9a');R(x,0,3,8,1,'#7d765e');R(x,1,1,5,1,'#3b2a1c');R(x,2,2,3,1,'#b3302b')},{ax:5,ay:8,sh:[1,1],sa:.22});
A.periscope=()=>spr('periscope',5,9,(x)=>{R(x,1,0,3,2,'#3f454b');R(x,2,1,1,1,'#7f9ba3');R(x,2,2,1,5,'#5e452e');R(x,1,7,3,2,'#3f454b');dot(x,1,7,'#8a9198')},{ax:2,ay:8,sh:[1,1],sa:.2});
A.rifles=()=>spr('rifles',12,9,(x)=>{line(x,1,8,5,1,'#6d4a30');line(x,5,8,5,1,'#8a6238');line(x,9,8,5,1,'#6d4a30');dot(x,5,0,'#aab1b6');dot(x,4,1,'#3f454b');dot(x,6,1,'#3f454b');R(x,1,7,9,1,'#3b2a1c')},{ax:6,ay:8,sh:[1,1],sa:.2});
A.brazier=()=>spr('brazier',9,9,(x)=>{ell(x,4,5,4,3,'#2c2f33');ell(x,4,4,3,2,'#0f0f0d');ell(x,4,4,2,1,'#c65a1e');dot(x,4,4,'#ffd27a');R(x,2,7,1,2,'#22262a');R(x,6,7,1,2,'#22262a')},{ax:4,ay:8,sh:[1,2],sa:.25});
A.campfire=()=>spr('campfire',13,10,(x)=>{ell(x,6,6,5,3,'#2a2118');ell(x,6,5,4,2,'#0f0c08');for(const[a,b]of[[2,4],[9,4],[3,8],[8,8],[1,6],[11,6]])dot(x,a,b,'#8c8a78');line(x,3,7,9,4,'#5e452e');line(x,9,7,3,4,'#3b2a1c');ell(x,6,5,2,1,'#c65a1e');dot(x,6,5,'#ffd27a')},{ax:6,ay:8,sh:[1,1],sa:.2});
A.latrine=()=>spr('latrine',12,14,(x)=>{R(x,1,4,10,9,'#6b5539');R(x,1,4,10,2,'#86683f');R(x,1,12,10,1,'#3b2a1c');R(x,4,7,4,6,'#15100b');R(x,0,3,12,2,'#4a3826');R(x,0,3,12,1,'#7d6a4a')},{ax:6,ay:12,sh:[2,2]});
A.laundry=()=>spr('laundry',30,10,(x)=>{R(x,0,0,1,10,'#3b2a1c');R(x,29,0,1,10,'#3b2a1c');line(x,0,1,29,2,'#8b8468');for(let i=0;i<5;i++){const X=3+i*5,col=['#efe9d6','#8ea0a8','#c7bc9a','#efe9d6','#7b8260'][i];R(x,X,2,4,4+(i%2),col);R(x,X,2,4,1,mix(col,'#fff',.35));R(x,X+3,3,1,3+(i%2),mix(col,'#000',.25))}},{ax:15,ay:9,sh:[1,2],sa:.18});
A.bench=()=>spr('bench',16,5,(x)=>{R(x,0,0,16,2,'#86683f');R(x,0,0,16,1,'#a98a58');R(x,1,2,2,3,'#3b2a1c');R(x,13,2,2,3,'#3b2a1c')},{ax:8,ay:4,sh:[1,1],sa:.2});
A.duckboards=()=>spr('duckboards',18,8,(x)=>{for(let j=0;j<3;j++){R(x,0,j*3,18,2,'#86683f');R(x,0,j*3,18,1,'#a98a58');for(let i=2;i<18;i+=5)dot(x,i,j*3+1,'#3b2a1c')}},{ax:9,ay:7,sh:[1,1],sa:.2});

/* ---------- terra de ninguém ---------- */
A.deadTree=(v=0)=>spr('deadTree'+v,26,34,(x,w,h)=>{srand(v*17+3);const cx=13;
 const T=['#2b2219','#4a3b2c','#6b5a45','#8a7a60'];
 for(let j=0;j<24;j++){const tw=j<8?2:3,off=Math.round(Math.sin(j/6+v)*1);R(x,cx-1+off,h-3-j,tw,1,T[1]);dot(x,cx-1+off,h-3-j,T[2]);dot(x,cx+tw-2+off,h-3-j,T[0])}
 // topo estilhaçado
 const top=h-3-24;for(let k=0;k<3;k++){const X=cx-2+k*2;line(x,X,top+2,X+(k-1)*2,top-2-k%2*2,T[1]);dot(x,X+(k-1)*2,top-2-k%2*2,T[3])}
 for(let b=0;b<4;b++){const by=h-10-b*5,dir=(b+v)%2?1:-1,len=3+H(b,v,3)%5;line(x,cx,by,cx+dir*len,by-len*.7,T[1]);dot(x,cx+dir*len,by-len*.7,T[2]);if(len>5)line(x,cx+dir*3,by-2,cx+dir*(len+1),by-5,T[0])}
 R(x,cx-3,h-4,7,2,'#2a2118');R(x,cx-2,h-4,2,1,'#6b5a45')},{ax:13,ay:31,sh:[4,2],sa:.28});
A.stump=()=>spr('stump',10,9,(x)=>{ell(x,5,6,4,2,'#3b2d1f');R(x,2,2,6,5,'#5e4a34');R(x,2,2,1,5,'#8a7a60');R(x,7,3,1,4,'#2b2219');dot(x,3,1,'#6b5a45');dot(x,6,0,'#4a3b2c');dot(x,5,1,'#8a7a60');R(x,2,7,6,1,'#241b12')},{ax:5,ay:7,sh:[2,1]});
A.fence=(n=4)=>spr('fence'+n,n*8+4,9,(x,w)=>{for(let i=0;i<=n;i++){const X=1+i*8,lean=H(i,n,2)%3-1;R(x,X+lean,1+(i%2),2,7-(i%2),'#5e452e');dot(x,X+lean,1+(i%2),'#a98a58');}
 for(let i=0;i<n;i++){if(H(i,n,4)%4===0)continue;const X=2+i*8;line(x,X,3+(i%2),X+8,4+(H(i,1,3)%2),'#2b2e27');line(x,X,6,X+8,6+(i%2),'#2b2e27');if(H(i,2,3)%2)dot(x,X+4,4,'#aeb4a4')}},{ax:(n*8+4)>>1,ay:7,sh:[1,2],sa:.2});
A.helmet=(team=0)=>spr('helmet'+team,7,6,(x)=>{const c=team?['#5d4c49','#8d7770']:['#3f6680','#8ab6cf'];ell(x,3,3,3,2,c[0]);ell(x,2,2,2,1,c[1]);R(x,0,4,7,1,mix(c[0],'#000',.35))},{ax:3,ay:4,sh:[1,1],sa:.22});
A.rifleDown=()=>spr('rifleDown',12,4,(x)=>{R(x,0,1,4,2,'#6d4a30');R(x,4,1,7,1,'#3f454b');dot(x,4,1,'#aab1b6');dot(x,1,1,'#8a6238')},{ax:6,ay:2,sh:[1,1],sa:.2});
A.pack=()=>spr('pack',9,8,(x)=>{R(x,0,0,9,7,'#5d5a3f');R(x,0,0,9,1,'#7d7a58');R(x,0,6,9,1,'#3a3826');R(x,2,1,1,6,'#3f3d2b');R(x,6,1,1,6,'#3f3d2b');R(x,3,3,3,3,'#6b6a49')},{ax:4,ay:6,sh:[1,1],sa:.22});
A.dud=()=>spr('dud',12,7,(x)=>{ell(x,6,4,5,2,'#4f5648');R(x,1,2,10,4,'#5a6150');R(x,1,2,10,1,'#8a9279');R(x,9,2,2,4,'#b8923a');dot(x,11,3,'#e0a84a');R(x,0,3,2,2,'#7d7f70')},{ax:6,ay:5,sh:[1,1],sa:.22});
A.brokenCrate=()=>spr('brokenCrate',12,9,(x)=>{R(x,0,4,5,4,'#6b5233');R(x,0,4,5,1,'#a98a58');R(x,6,2,6,2,'#86683f');R(x,7,5,5,3,'#5e452e');line(x,3,1,9,0,'#86683f');dot(x,5,6,'#c9b56a');dot(x,9,7,'#b8923a')},{ax:6,ay:8,sh:[1,1],sa:.22});
A.wheel=()=>spr('wheel',11,11,(x)=>{ring(x,5,5,4,4,'#3b2a1c');ring(x,5,5,3,3,'#6b5539');for(let k=0;k<4;k++){const a=k/4*Math.PI*2;line(x,5,5,5+Math.cos(a)*4,5+Math.sin(a)*4,'#5e452e')}dot(x,5,5,'#8a9198')},{ax:5,ay:8,sh:[1,1],sa:.2});
A.cartWreck=()=>spr('cartWreck',26,16,(x)=>{R(x,3,4,14,9,'#4a3826');R(x,3,4,14,1,'#7d6a4a');for(let i=0;i<5;i++)R(x,4+i*3,5,1,7,'#2a1f14');line(x,17,7,25,3,'#5e452e');line(x,17,10,24,14,'#3b2a1c');ring(x,19,12,3,3,'#3b2a1c');dot(x,19,12,'#8a9198');R(x,5,12,9,2,'#2b2118')},{ax:13,ay:13,sh:[2,2],sa:.25});
A.horseDead=()=>spr('horseDead',19,9,(x)=>{ell(x,9,5,8,3,'#5a3a29');ell(x,8,4,7,2,'#6b4330');ell(x,16,5,2,2,'#4a2f22');line(x,4,7,1,8,'#3a2418');line(x,7,7,5,9,'#3a2418');line(x,12,3,16,0,'#4a2f22');line(x,14,3,18,1,'#4a2f22');line(x,1,4,0,3,'#231a14')},{ax:9,ay:7,sh:[1,1],sa:.25});
/* avião biplano destruído */
A.planeCrash=()=>spr('planeCrash',36,26,(x)=>{const w1='#7a7a62',w2='#5b5c47',dk='#2a2b20';
 R(x,4,3,11,8,w1);R(x,4,3,11,1,'#a19f82');R(x,4,10,11,1,w2);line(x,4,3,6,10,dk);line(x,9,4,8,11,dk);R(x,8,11,1,3,dk);
 R(x,9,14,18,4,'#6d6b52');R(x,9,14,18,1,'#908d70');R(x,9,17,18,1,'#3c3b2b');line(x,27,14,32,17,'#3c3b2b');R(x,27,15,4,2,'#20231b');
 R(x,17,17,9,7,w1);R(x,17,17,9,1,'#a19f82');line(x,17,17,19,23,dk);line(x,24,17,22,24,dk);
 R(x,2,16,5,5,'#2a2b20');ring(x,4,18,2,2,'#c9c5a0');dot(x,4,18,'#e9e6d2');for(let i=0;i<8;i++)dot(x,3+(H(i,7,6)%28),2+(H(i,8,6)%22),H(i,9,6)%2?dk:'#8c8a78');dot(x,20,12,'#7d7a58');line(x,13,12,20,14,dk)},{ax:18,ay:22,sh:[2,2]});
/* pilhas de entulho */
A.rubble=(v=0)=>spr('rubble'+v,22,12,(x)=>{srand(v*9+1);const tones=['#5a4538','#7d6252','#9b7762','#b59a83','#5a5041','#8c8a78'];for(let i=0;i<26;i++){const X=1+(sr()*18|0),Y=2+(sr()*8|0),w=1+(sr()*4|0),h=1+(sr()*2|0),t=tones[sr()*6|0];R(x,X,Y,w,h,t);R(x,X,Y,w,1,mix(t,'#fff',.25))}
 R(x,3,9,16,2,'#2b2118')},{ax:11,ay:10,sh:[2,2],sa:.25});

/* ---------- ruínas ---------- */
function brickWall(x,X,Y,w,h,B,seed){for(let j=0;j<h;j++)for(let i=0;i<w;i++){const off=(j>>1)&1?3:0,brick=(i+off)%6===0||j%3===0,hi=(i+j*2)%9===0;dot(x,X+i,Y+j,brick?B[2]:hi?B[3]:B[1])}R(x,X,Y,w,1,B[3])}
A.ruinFarm=()=>spr('ruinFarm',70,48,(x)=>{const B=['#3b2a22','#7d6252','#5a4538','#b59a83'];
 // parede norte (alta, com dente de serra), parede oeste, parede sul baixa
 brickWall(x,4,4,46,16,B,1);R(x,4,4,46,1,'#d1c2b0');for(let i=0;i<46;i++){const cut=Math.round(Math.abs(Math.sin(i/7+1))*3+(H(i,2,2)%2)*(i>20?4:0));if(cut)x.clearRect(4+i,4,1,cut)}
 R(x,14,9,7,7,'#0e0c08');R(x,14,9,7,1,'#d1c2b0');R(x,32,10,6,6,'#0e0c08');R(x,32,10,6,1,'#d1c2b0');
 brickWall(x,4,4,6,40,B,2);x.clearRect(4,4,6,4);x.clearRect(4,4,3,9);x.clearRect(6,30+0,4,2);R(x,4,42,10,2,'#2a2118');
 brickWall(x,36,30,30,8,B,3);for(let i=0;i<30;i++){const cut=(H(i,1,3)%3)+(i>16?2:0);x.clearRect(36+i,30,1,cut)}
 R(x,36,37,30,1,'#2a2118');
 // vigas do telhado caídas e laje
 line(x,12,20,36,42,'#5e452e');line(x,13,20,37,42,'#3b2a1c');line(x,24,20,48,40,'#5e452e');line(x,40,22,58,38,'#6b5233');
 R(x,14,30,18,10,'#3a3026');for(let i=0;i<30;i++){dot(x,14+(H(i,4,4)%18),30+(H(i,5,4)%10),H(i,6,4)%2?'#8c8a78':'#5a4538')}
 for(let i=0;i<20;i++)R(x,48+(H(i,1,8)%18),38+(H(i,2,8)%8),2,1,i%2?'#7d6252':'#5a4538')},{ax:35,ay:44,sh:[5,5]});
A.ruinBarn=()=>spr('ruinBarn',56,36,(x)=>{const B=['#3b2a22','#6b5a45','#4a3c2c','#a19078'];
 for(let i=0;i<7;i++)R(x,2+i*8,4,7,22,i%2?'#6b5233':'#5e452e');for(let i=0;i<7;i++)R(x,2+i*8,4,1,22,'#8a6d48');R(x,2,4,54,2,'#3b2a1c');
 for(let i=0;i<54;i++){const cut=(H(i,6,6)%9)+(i>30?4:0);x.clearRect(2+i,4,1,cut)}
 R(x,18,12,14,14,'#0e0c08');R(x,17,11,16,1,'#86683f');R(x,17,11,1,15,'#86683f');R(x,33,11,1,15,'#3b2a1c');
 line(x,8,4,30,20,'#8a6d48');line(x,9,4,31,20,'#5e452e');line(x,46,4,36,18,'#8a6d48');R(x,2,26,54,3,'#3b2a1c');for(let i=0;i<14;i++)R(x,2+(H(i,2,9)%50),29+(H(i,3,9)%5),3,1,i%2?'#5e452e':'#86683f')},{ax:28,ay:30,sh:[4,4]});
A.ruinChurch=()=>spr('ruinChurch',86,70,(x)=>{const B=['#2b2622','#8a8578','#615c50','#b9b3a3'];
 // nave: duas paredes laterais sem telhado e abside
 brickWall(x,14,20,58,6,B,1);R(x,14,20,58,1,'#d8d2c2');
 brickWall(x,10,20,7,44,B,2);x.clearRect(10,20,7,6);x.clearRect(10,34,4,5);R(x,10,62,10,2,'#2a2622');
 brickWall(x,69,20,7,44,B,3);x.clearRect(69,20,7,14);x.clearRect(72,36,4,4);R(x,66,62,10,2,'#2a2622');
 R(x,17,26,52,36,'#3a352c');for(let i=0;i<70;i++)dot(x,17+(H(i,1,5)%52),26+(H(i,2,5)%36),H(i,3,5)%3?'#4a4438':'#6b6558');
 for(let k=0;k<2;k++){const X=20+k*26;R(x,X,27,18,5,'#7d5a3c');R(x,X,27,18,1,'#a4845a');R(x,X,31,18,1,'#3b2a1c')}          // bancos caídos
 // torre (toco)
 brickWall(x,28,0,30,22,B,4);R(x,28,0,30,1,'#d8d2c2');x.clearRect(28,0,9,5);x.clearRect(50,0,8,9);x.clearRect(40,0,5,3);
 R(x,38,6,10,12,'#0b0a08');R(x,38,6,10,1,'#d8d2c2');R(x,39,18,8,1,'#0b0a08');R(x,41,8,4,1,'#8a8578');
 R(x,28,21,30,2,'#2b2622');
 // sino caído
 ell(x,38,50,4,3,'#7d5f23');ell(x,37,49,3,2,'#b8923a');dot(x,36,48,'#f0d27a');R(x,35,52,6,1,'#3a2c12')},{ax:43,ay:62,sh:[6,6]});
A.tombs=()=>spr('tombs',30,14,(x)=>{for(let i=0;i<4;i++){const X=1+i*7,lean=(i%2)-0;R(x,X,2+lean,4,9,'#8c8a78');R(x,X,2+lean,4,1,'#c4c2b4');R(x,X+3,3+lean,1,8,'#5f5d52');if(i%3===0){R(x,X+1,0+lean,2,4,'#8c8a78')}}R(x,0,12,30,2,'#3a4a2a')},{ax:15,ay:12,sh:[2,2],sa:.22});
A.wallSeg=(len=16)=>spr('wallSeg'+len,len+4,11,(x)=>{const B=['#3b2a22','#7d6252','#5a4538','#b59a83'];brickWall(x,2,1,len,8,B,5);for(let i=0;i<len;i++){x.clearRect(2+i,1,1,(H(i,len,3)%3))}R(x,2,9,len,1,'#2a2118')},{ax:(len+4)>>1,ay:9,sh:[2,2]});
A.well=()=>spr('well',14,14,(x)=>{ell(x,7,8,6,5,'#5a5041');ell(x,7,7,6,4,'#8c8a78');ell(x,6,6,4,2,'#b9b7a8');ell(x,7,7,3,2,'#0f1512');dot(x,6,6,'#3a4a44');R(x,1,3,1,7,'#5e452e');R(x,12,3,1,7,'#5e452e');R(x,1,2,12,1,'#86683f')},{ax:7,ay:11,sh:[2,2]});

/* ---------- ponte de madeira com estacas, parcialmente destruída (mesmo tamanho da ponte antiga: 104×42) ---------- */
A.bridge=()=>spr('bridge',104,42,(x)=>{
 x.fillStyle='rgba(8,14,12,.40)';x.fillRect(6,12,96,30);
 R(x,4,6,96,28,'#33261a');
 for(let k=0;k<17;k++){const xx=5+k*5.6|0,tone=k%3;if(k===6||k===11){ // tábuas quebradas
   R(x,xx,7,5,9,tone===0?'#8a6d48':'#7d6140');R(x,xx,7,5,1,'#b39a6d');R(x,xx,24,5,9,tone===0?'#7d6140':'#947650');R(x,xx+2,16,2,8,'#0d1210');line(x,xx,15,xx+4,19,'#5e452e');continue}
  R(x,xx,7,5,26,tone===0?'#8a6d48':tone===1?'#7d6140':'#947650');R(x,xx,7,5,1,'#b39a6d');R(x,xx,32,5,1,'#5b4630');R(x,xx+4,7,1,26,'#4a3826')}
 R(x,4,4,96,3,'#5a4630');R(x,4,4,96,1,'#8a6d48');R(x,4,33,96,3,'#4a3826');R(x,4,33,96,1,'#6e553a');
 for(let k=0;k<9;k++){if(k===4)continue;R(x,4+k*12,1,3,7,'#46351f');R(x,4+k*12,1,3,1,'#7b6443');R(x,4+k*12,33,3,7,'#3a2b19');R(x,4+k*12,33,3,1,'#6e553a')}
 R(x,0,8,5,24,'#5e4a33');R(x,99,8,5,24,'#5e4a33');
 for(let i=0;i<4;i++){R(x,6+i*4,10+i,3,2,'#b9a97e');R(x,6+i*4,10+i,3,1,'#d6c99b')}                        // sacos na cabeceira
 R(x,46,1,12,3,'#3b2a1c');line(x,56,4,62,9,'#3b2a1c');line(x,42,3,36,8,'#5e452e');
 R(x,70,18,7,3,'#b9a97e');R(x,70,18,7,1,'#d6c99b');R(x,74,21,5,3,'#b9a97e')},{ax:52,ay:21,sh:[0,0],sa:0,out:.55});

/* ---------- ferrovia ---------- */
A.locomotive=()=>spr('loco',18,46,(x)=>{ // virada para cima (norte)
 R(x,0,6,3,30,'#15120e');R(x,15,6,3,30,'#15120e');R(x,0,8,1,26,'#3a352d');R(x,17,8,1,26,'#3a352d');
 R(x,3,4,12,22,'#3a4046');R(x,3,4,12,2,'#7d858c');R(x,3,4,2,22,'#6b7278');R(x,13,5,2,21,'#1f2327');for(let i=0;i<4;i++)R(x,3,8+i*5,12,1,'#20252a');
 ell(x,9,3,4,3,'#2a2e33');ell(x,9,2,3,2,'#555c63');R(x,7,0,4,4,'#15181b');R(x,6,0,6,1,'#7d858c');
 R(x,4,26,10,12,'#6b4a30');R(x,4,26,10,2,'#8a6238');R(x,3,37,12,1,'#3f2c1c');R(x,5,30,8,6,'#241b12');R(x,6,31,6,4,'#0f0c08');dot(x,8,33,'#e0772a');
 R(x,3,38,12,7,'#2e3236');R(x,3,38,12,1,'#5a6066');for(let i=0;i<8;i++)dot(x,4+(H(i,3,3)%10),39+(H(i,4,3)%5),H(i,5,3)%2?'#15130e':'#4a4a48');R(x,5,44,8,1,'#15120e');
 R(x,2,1,2,4,'#b8923a');R(x,14,1,2,4,'#b8923a')},{ax:9,ay:40,sh:[4,3]});
A.railWagon=(v=0)=>spr('railWagon'+v,16,40,(x)=>{ // vagão coberto, eixo norte-sul
 R(x,0,3,2,34,'#15120e');R(x,14,3,2,34,'#15120e');
 const c=v===1?['#56594a','#6d7160','#8a8e7a']:v===2?['#5e452e','#7a5a3c','#9a7550']:['#4a3a2a','#6b5233','#8a6d48'];
 R(x,2,3,12,34,c[1]);R(x,2,3,12,2,c[2]);R(x,2,3,2,34,c[2]);R(x,12,4,2,33,c[0]);R(x,2,36,12,1,c[0]);
 for(let i=0;i<6;i++)R(x,4,6+i*5,8,1,c[0]);R(x,5,17,6,8,c[0]);R(x,5,17,6,1,c[2]);
 if(v===2){R(x,3,4,10,32,'#6d7a52');R(x,3,4,10,2,'#8a9870');for(let i=0;i<5;i++)R(x,3,8+i*6,10,1,'#4a5538')}
 R(x,6,0,4,3,'#2a2118');R(x,6,37,4,3,'#2a2118')},{ax:8,ay:32,sh:[4,3]});
A.platform=()=>spr('platform',14,60,(x)=>{R(x,0,0,14,60,'#5e452e');R(x,0,0,14,60,'#6b5233');for(let j=0;j<20;j++)R(x,0,j*3,14,1,j%2?'#86683f':'#7a5f3c');R(x,0,0,1,60,'#a98a58');R(x,13,0,1,60,'#3b2a1c');for(const j of[4,30,54])R(x,1,j,12,3,'#3b2a1c')},{ax:7,ay:56,sh:[3,3]});
A.narrowWagon=()=>spr('narrowWagon',12,20,(x)=>{R(x,0,1,2,18,'#15120e');R(x,10,1,2,18,'#15120e');R(x,2,2,8,16,'#6b5233');R(x,2,2,8,1,'#a98a58');R(x,2,2,1,16,'#86683f');R(x,3,4,6,4,'#b8923a');R(x,3,4,6,1,'#f0d27a');R(x,3,10,6,4,'#5c6241');R(x,3,10,6,1,'#7a8257')},{ax:6,ay:16,sh:[2,2]});
A.buffer=()=>spr('buffer',12,7,(x)=>{R(x,0,3,12,4,'#3a2b1c');R(x,0,3,12,1,'#6b5539');R(x,2,0,8,4,'#b3302b');R(x,2,0,8,1,'#d8524a');R(x,1,3,1,3,'#15120e')},{ax:6,ay:6,sh:[2,2]});
})();
