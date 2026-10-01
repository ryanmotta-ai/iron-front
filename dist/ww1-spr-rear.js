'use strict';
(function(){
const K=PX.WW1.kit,{R,dot,ell,line,spr,C,H,fromGrid,mix,disc,ring,srand,sr,clamp}=K,A=PX.WW1.SPR=PX.WW1.SPR||{};
/* Iron Front 0.6 — sprites da retaguarda: depósito, caixas, tendas, hospital, cozinha, cavalos, veículos, QG, feno. */
const ST={ink:'#1b1f16'};

/* ---------- depósito de munição: galpão de ferro corrugado com lona remendada ---------- */
A.depot=()=>spr('depot',60,36,(x,w,h)=>{const I=C.iron;
 for(let i=1;i<w-1;i++){const m=i%3;R(x,i,2,1,8,m===0?I[1]:m===1?mix(I[2],I[3],.3):I[2])}
 R(x,1,10,w-2,1,I[3]);R(x,1,11,w-2,1,I[0]);
 for(let i=1;i<w-1;i++){const m=i%3;R(x,i,12,1,10,m===0?I[0]:m===1?mix(I[1],I[2],.35):I[1])}
 R(x,0,22,w,1,'#2b2f33');R(x,1,21,w-2,1,I[0]);
 for(let k=0;k<7;k++){const rx=5+((k*17)%48),rl=2+H(k,1,3)%5;R(x,rx,12+(k%3)*2,1,rl,'#6b4f3a');if(k%2)dot(x,rx+1,12+(k%3)*2,'#7d5d44')}
 R(x,8,13,13,6,'#4d5639');R(x,8,13,13,1,'#6b7550');R(x,8,18,13,1,'#2e3520');R(x,8,13,1,6,'#3a4229');for(let i=0;i<6;i++)dot(x,10+i*2,15+(i%2),'#3a4229');
 R(x,39,3,8,5,'#3b3f44');R(x,39,3,8,1,'#5b6066');
 for(let i=1;i<w-1;i++)R(x,i,23,1,10,i%4<2?'#6b5239':'#7b6246');
 R(x,1,23,w-2,1,'#8a6d48');
 R(x,19,24,22,9,'#15100b');R(x,18,23,1,10,'#a4845a');R(x,41,23,1,10,'#a4845a');R(x,18,23,24,1,'#a4845a');
 R(x,22,28,7,5,'#7a5f3c');R(x,22,28,7,1,'#a9895a');R(x,23,30,5,1,'#5b4630');R(x,31,27,7,6,'#6a5233');R(x,31,27,7,1,'#8d7048');R(x,33,30,4,1,'#4a3826');
 R(x,1,33,w-2,1,'#2e2216');
 for(let i=0;i<5;i++)R(x,4+i*4,25,2,2,H(i,2,4)%2?'#3a2b1c':'#1a130c');
},{ax:30,ay:32,sh:[5,4]});

/* ---------- caixas (pilhas) ---------- */
function crate(x,X,Y,paint){const body=paint?'#5c6241':'#8a6d48',hi=paint?'#7a8257':'#b39a6d',lo=paint?'#3c4229':'#5b4630';R(x,X,Y,7,6,body);R(x,X,Y,7,1,hi);R(x,X,Y,1,6,hi);R(x,X+6,Y+1,1,5,lo);R(x,X,Y+5,7,1,lo);R(x,X+2,Y+2,3,2,paint?'#c9b56a':lo);if(!paint){R(x,X+1,Y+1,5,1,mix(body,hi,.3))}}
A.crates=(n=3)=>spr('crates'+n,7*n+4,16,(x)=>{srand(n*31);for(let i=0;i<n;i++)crate(x,1+i*7,8,i===1);for(let i=0;i<n-1;i++)crate(x,4+i*7,3,(i+n)%2===0)},{ax:(7*n+4)>>1,ay:14,sh:[2,2]});
A.cratesBig=()=>spr('cratesBig',34,22,(x)=>{for(let j=0;j<2;j++)for(let i=0;i<4;i++)crate(x,1+i*7+(j?3:0),14-j*6,(i+j)%3===1);crate(x,8,2,false);crate(x,15,1,true)},{ax:17,ay:20});
/* paleta de projéteis de artilharia em pé (vista de cima: bases de latão) */
A.shells=(cols=6,rows=3)=>spr(`shells${cols}${rows}`,cols*3+4,rows*3+4,(x,w,h)=>{R(x,0,0,w,h,'#3f3024');R(x,0,0,w,1,'#5e452e');R(x,0,h-1,w,1,'#241b12');
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const X=2+i*3,Y=2+j*3;R(x,X,Y,3,3,'#b8923a');dot(x,X,Y,'#f0d27a');dot(x,X+2,Y+2,'#7d5f23');dot(x,X+1,Y+1,'#3a2c12')}},{ax:(cols*3+4)>>1,ay:rows*3+2});
/* pilha de projéteis deitados sob lona */
A.shellDump=()=>spr('shellDump',28,18,(x)=>{R(x,1,4,26,12,'#59603e');R(x,1,4,26,2,'#7a8356');R(x,1,14,26,2,'#353b25');for(let i=0;i<9;i++){const X=3+i*3;R(x,X,6,2,7,'#7d7f70');dot(x,X,6,'#b9bcae');dot(x,X,12,'#b8923a')}
 R(x,1,4,26,1,'#9aa56f');for(let i=0;i<4;i++)dot(x,4+i*7,5+(i%2),'#2a2f1c');R(x,0,8,1,6,'#2a2f1c');R(x,27,8,1,6,'#2a2f1c')},{ax:14,ay:16});
A.barrels=(n=3)=>spr('barrels'+n,n*8+2,11,(x)=>{for(let i=0;i<n;i++){const X=2+i*8;ell(x,X+3,5,3,4,'#5e452e');ell(x,X+3,4,3,3,'#86683f');ell(x,X+3,4,2,2,'#a98a58');dot(x,X+2,3,'#c7ab78');R(x,X,5,1,5,'#3b2a1c')}},{ax:n*4+1,ay:9,sh:[2,2]});
A.sacks=()=>spr('sacks',22,12,(x)=>{srand(7);for(let j=0;j<2;j++)for(let i=0;i<4-j;i++){const X=1+i*5+j*3,Y=6-j*4;ell(x,X+3,Y+2,3,2,'#b7a77f');ell(x,X+2,Y+1,2,1,'#d1c39b');R(x,X+1,Y+3,4,1,'#8a7b58')}},{ax:11,ay:10});
A.logs=()=>spr('logs',18,9,(x)=>{for(let j=0;j<3;j++)for(let i=0;i<4-(j>>1);i++){const X=1+i*4+(j&1)*2,Y=1+j*2;R(x,X,Y,5,2,'#5e452e');R(x,X,Y,5,1,'#86683f');dot(x,X,Y+1,'#d6b87e')}},{ax:9,ay:8});
A.planks=()=>spr('planks',22,9,(x)=>{for(let j=0;j<4;j++){R(x,1+(j&1),1+j*2,18,2,'#86683f');R(x,1+(j&1),1+j*2,18,1,'#b39a6d');dot(x,19+(j&1),2+j*2,'#d6b87e')}R(x,3,0,2,9,'#3b2a1c');R(x,14,0,2,9,'#3b2a1c')},{ax:11,ay:8});
A.wireRolls=()=>spr('wireRolls',24,12,(x)=>{for(let i=0;i<4;i++){const X=3+i*5;ell(x,X,6,3,4,'#2c2f29');ell(x,X,6,2,3,'#5e6258');ell(x,X,6,1,2,'#2c2f29');dot(x,X-1,4,'#b4baa8')}R(x,1,9,22,1,'#1d2019')},{ax:12,ay:10});

/* ---------- tendas ---------- */
A.tentL=(cross=true)=>spr('tentL'+cross,42,30,(x,w,h)=>{const T=C.canvas;
 for(let y=2;y<=10;y++){R(x,2,y,w-4,1,(y<4||(y<7&&(y+0)%2))?T[3]:T[2]);}
 for(let y=12;y<=21;y++){R(x,2,y,w-4,1,y<15?T[2]:y<19?T[1]:T[1])}
 R(x,2,11,w-4,1,T[3]);R(x,2,12,w-4,1,mix(T[2],T[1],.5));
 for(let i=0;i<8;i++){const X=4+i*5;R(x,X,12,1,9,mix(T[1],T[0],.35))}
 R(x,1,3,1,18,T[1]);R(x,w-2,3,1,18,T[0]);
 R(x,2,22,w-4,6,'#8d8468');R(x,2,22,w-4,1,T[1]);R(x,2,27,w-4,1,'#5e5944');
 R(x,17,22,9,6,'#241f18');R(x,16,22,1,6,T[2]);R(x,26,22,1,6,T[0]);R(x,18,23,7,1,'#3a332a');dot(x,19,26,'#4a4233');dot(x,23,25,'#4a4233');
 if(cross){R(x,15,13,12,8,'#efe9d6');R(x,18,14,6,6,'#efe9d6');R(x,19,14,4,6,C.red);R(x,17,16,8,2,C.red);R(x,19,14,4,1,'#d8524a');R(x,17,16,8,1,'#d8524a')}
 for(const X of[3,w-4]){R(x,X,28,2,2,'#3a2b1c')}
},{ax:21,ay:28,sh:[3,3]});
A.tentS=(col='olive')=>spr('tentS'+col,22,17,(x,w,h)=>{const O=col==='olive'?['#3f4530','#596041','#727a55','#8a936a']:['#8b8468','#a49b80','#c2b99b','#dcd3b5'];
 for(let y=1;y<=6;y++)R(x,1,y,w-2,1,O[3-(y>3?1:0)]);R(x,1,7,w-2,1,O[3]);
 for(let y=8;y<=12;y++)R(x,1,y,w-2,1,y<10?O[1]:O[1]);
 for(let i=0;i<4;i++)R(x,3+i*5,8,1,5,O[0]);
 R(x,1,13,w-2,2,O[0]);R(x,8,13,6,2,'#15120d');R(x,1,1,1,12,O[2]);
},{ax:11,ay:15,sh:[2,2]});
A.bell=()=>spr('bell',20,20,(x)=>{ell(x,10,10,9,8,'#7c7656');ell(x,9,9,8,7,'#a49b80');ell(x,8,8,6,5,'#cbc2a4');ell(x,7,7,3,3,'#e6dfc6');for(let k=0;k<8;k++){const a=k/8*6.283;line(x,10,10,10+Math.cos(a)*8,10+Math.sin(a)*7,'#8b8468')}dot(x,10,10,'#3a332a');dot(x,9,9,'#fff8e6');R(x,8,16,4,2,'#241f18')},{ax:10,ay:17,sh:[2,2]});

/* ---------- veículos de saúde ---------- */
A.ambulance=()=>spr('amb',30,15,(x)=>{ // virada para a direita (leste)
 R(x,1,11,6,3,'#1a1712');R(x,21,11,6,3,'#1a1712');R(x,2,12,4,1,'#3c3832');R(x,22,12,4,1,'#3c3832');
 R(x,1,1,19,11,'#b9b199');R(x,1,1,19,2,'#dcd4ba');R(x,1,1,1,11,'#dcd4ba');R(x,19,2,1,10,'#8d8468');R(x,1,11,19,1,'#8d8468');
 R(x,6,3,9,7,'#efe9d6');R(x,9,4,3,5,C.red);R(x,7,6,7,1,C.red);R(x,9,4,3,1,'#d8524a');
 R(x,20,3,7,8,'#5b6049');R(x,20,3,7,2,'#7d8463');R(x,20,10,7,1,'#3a3d2a');R(x,26,4,1,6,'#2b2d20');R(x,21,4,2,6,'#7f9ba3');R(x,21,4,2,1,'#b7d1d8');
 R(x,27,5,2,4,'#3a3d2a');dot(x,28,5,'#d9d2a8');dot(x,28,8,'#d9d2a8');
 R(x,0,0,21,1,'#6f6a55');R(x,1,0,5,1,'#1a1712');R(x,21,0,5,1,'#1a1712');
},{ax:15,ay:13,sh:[3,3]});
A.stretcher=(v=0)=>spr('str'+v,14,7,(x)=>{R(x,0,0,14,1,'#5e452e');R(x,0,6,14,1,'#5e452e');R(x,1,1,12,5,v===2?'#9a9ea0':'#8b8468');
 if(v<2){R(x,2,2,7,3,'#5d6247');R(x,1,2,1,3,'#4a4f38');R(x,9,2,3,3,'#dcb690');R(x,9,2,3,1,'#6b5a3a');R(x,4,2,2,3,'#efe9d6');dot(x,11,3,'#b3302b')}
 else{R(x,3,2,8,3,'#6f7b5a');R(x,4,3,3,1,'#9ba57f')}
 R(x,0,0,1,7,'#3b2a1c');R(x,13,0,1,7,'#3b2a1c')},{ax:7,ay:5,sh:[1,1],sa:.22});
A.cot=()=>spr('cot',13,7,(x)=>{R(x,0,0,13,7,'#4a4f55');R(x,1,1,11,5,'#d9d2bb');R(x,1,1,3,5,'#efe9d6');R(x,4,1,8,5,'#7b8260');R(x,4,1,8,1,'#9aa37d')},{ax:6,ay:5,sh:[1,1],sa:.22});

/* ---------- cozinha de campanha ---------- */
A.kitchen=()=>spr('kitchen',26,15,(x)=>{R(x,4,11,5,4,'#1a1712');R(x,14,11,5,4,'#1a1712');line(x,0,9,5,7,'#5e452e');line(x,0,10,5,8,'#3b2a1c');
 R(x,4,3,14,9,'#4a5056');R(x,4,3,14,2,'#9aa1a8');R(x,4,3,1,9,'#7d858c');R(x,17,4,1,8,'#2b2f33');R(x,4,11,14,1,'#2b2f33');for(const X of[7,11,15])R(x,X,4,1,7,'#2f3338');
 ell(x,11,6,4,2,'#2d3034');ell(x,10,5,3,1,'#6b7278');
 R(x,18,5,5,7,'#2c2f33');R(x,18,5,5,1,'#4c5056');R(x,19,6,3,3,'#e0772a');dot(x,20,7,'#ffd27a');R(x,22,1,2,5,'#1d2024');R(x,22,1,2,1,'#5a6066');R(x,21,0,4,1,'#2a2d30')},{ax:12,ay:13});
A.mess=()=>spr('mess',34,14,(x)=>{R(x,1,0,32,3,'#5e452e');R(x,1,0,32,1,'#86683f');R(x,1,11,32,3,'#5e452e');R(x,1,11,32,1,'#86683f');
 R(x,2,4,30,6,'#9c8560');R(x,2,4,30,1,'#c7ab78');R(x,2,9,30,1,'#6b5539');for(let i=0;i<7;i++){ell(x,4+i*4,7,1,1,'#efe9d6');dot(x,5+i*4,5,'#7d858c')}
 for(const X of[3,29]){R(x,X,2,2,10,'#3b2a1c')}},{ax:17,ay:12,sh:[2,2],sa:.22});
A.waterCart=()=>spr('waterCart',26,13,(x)=>{R(x,4,10,5,3,'#1a1712');R(x,16,10,5,3,'#1a1712');line(x,0,8,4,6,'#5e452e');ell(x,14,5,9,4,'#4b5a66');ell(x,13,4,8,3,'#6a7d8b');ell(x,11,3,4,1,'#9fb4c0');R(x,6,4,1,4,'#2d3a43');R(x,14,1,1,7,'#2d3a43');R(x,21,4,1,4,'#2d3a43')},{ax:13,ay:11});

/* ---------- animais: cavalos parados ---------- */
const HORSE=['.............hh.','...........hhhhh','.bbbbbbbbbbhhhh.','ttBbbbbbbbbbbhh.','tBbbbbbbbbbbb...','.tbbbbbbbbbbb...','..l.l.....l.l...','..d.d.....d.d...'];
const COATS={bay:{b:'#6b4330',B:'#8a5a3e',h:'#5a3a29',t:'#231a14',l:'#4a2f22',d:'#1d1610'},black:{b:'#2e2b2a',B:'#47423f',h:'#262322',t:'#141211',l:'#1d1a19',d:'#0c0b0a'},chest:{b:'#8a5230',B:'#aa6a40',h:'#774629',t:'#5a3820',l:'#6a4026',d:'#2b1a10'},gray:{b:'#9a9b94',B:'#bdbeb6',h:'#8a8b84',t:'#6d6e68',l:'#7d7e77',d:'#3a3a36'}};
A.horse=(coat='bay',graze=false)=>spr(`horse${coat}${graze}`,17,9,(x)=>{const g=fromGrid(graze?['.............','...........hh','.bbbbbbbbbbhhh','ttBbbbbbbbbbhh','tBbbbbbbbbbb.h','.tbbbbbbbbbb.h','..l.l.....l.l.','..d.d.....d.d.']:HORSE,COATS[coat]);x.drawImage(g,0,0);if(!graze)dot(x,14,1,'#e8d9b0');},{ax:8,ay:8,sh:[2,2],sa:.25});
A.picket=(n=4)=>spr('picket'+n,n*18+4,4,(x,w)=>{R(x,0,1,w,1,'#8b8468');for(let i=0;i<=n;i++){R(x,i*18+1,0,2,3,'#3b2a1c');dot(x,i*18+1,0,'#86683f')}},{ax:(n*18+4)>>1,ay:2,sh:[1,1],sa:.15});
A.trough=()=>spr('trough',20,7,(x)=>{R(x,0,0,20,7,'#5e452e');R(x,0,0,20,1,'#86683f');R(x,2,2,16,3,'#35483f');R(x,3,2,8,1,'#5d7a6d');R(x,0,6,20,1,'#3b2a1c')},{ax:10,ay:5});
A.haystack=()=>spr('haystack',24,22,(x)=>{ell(x,12,12,11,9,'#8a7538');ell(x,11,10,10,8,'#b09a4c');ell(x,10,8,7,6,'#cfb862');ell(x,8,6,3,3,'#e6d27e');for(let i=0;i<22;i++){const X=3+(H(i,1,4)%18),Y=5+(H(i,2,4)%13);dot(x,X,Y,H(i,3,4)%2?'#8a7538':'#e0cb72')}R(x,6,19,12,2,'#5a4d22')},{ax:12,ay:19,sh:[3,3]});
A.haybales=(n=3)=>spr('haybales'+n,n*9+3,10,(x)=>{for(let i=0;i<n;i++){const X=1+i*9;R(x,X,2,8,7,'#c0a94f');R(x,X,2,8,2,'#dcc66e');R(x,X,8,8,1,'#8a7538');R(x,X+2,2,1,7,'#6b5a26');R(x,X+5,2,1,7,'#6b5a26')}},{ax:(n*9+3)>>1,ay:9});
A.wagon=()=>spr('wagon',30,15,(x)=>{ // carroça coberta, virada para a direita
 R(x,4,12,5,3,'#1a1712');R(x,18,12,5,3,'#1a1712');line(x,22,9,29,8,'#5e452e');line(x,22,10,29,9,'#3b2a1c');
 R(x,2,2,22,10,'#b6ad92');R(x,2,2,22,3,'#d7cfb4');R(x,2,2,1,10,'#d7cfb4');R(x,23,3,1,9,'#8b8468');R(x,2,11,22,1,'#7d765e');for(let i=0;i<5;i++)R(x,5+i*4,3,1,8,'#9a917a');R(x,2,0,22,1,'#5e452e');R(x,2,12,22,1,'#3b2a1c')},{ax:15,ay:13,sh:[3,3]});
A.cart=()=>spr('cart',18,11,(x)=>{R(x,3,8,4,3,'#1a1712');R(x,11,8,4,3,'#1a1712');R(x,2,1,13,8,'#7a5f3c');R(x,2,1,13,2,'#a4845a');R(x,3,3,11,5,'#4a3826');line(x,14,5,18,4,'#3b2a1c');R(x,4,4,4,3,'#b39a6d');R(x,9,4,4,3,'#8a6d48')},{ax:9,ay:9});

/* ---------- veículos motorizados ---------- */
A.truck=()=>spr('truck',38,17,(x)=>{ // caminhão de lona, virado para a direita
 R(x,3,14,6,3,'#1a1712');R(x,22,14,6,3,'#1a1712');R(x,30,14,5,3,'#1a1712');
 R(x,1,2,24,13,'#8b8468');R(x,1,2,24,4,'#b7ae92');R(x,1,2,1,13,'#b7ae92');for(let i=0;i<6;i++)R(x,4+i*4,3,1,11,'#7d765e');R(x,24,3,1,12,'#5e5944');R(x,1,14,24,1,'#6b6549');
 R(x,26,3,10,11,'#586043');R(x,26,3,10,3,'#7c865e');R(x,26,13,10,1,'#3a4028');R(x,28,4,4,9,'#6f7b52');R(x,32,5,2,7,'#7f9ba3');R(x,32,5,2,1,'#b7d1d8');
 R(x,35,5,2,7,'#3a3d2a');dot(x,36,6,'#e0d8a8');dot(x,36,10,'#e0d8a8');R(x,0,1,25,1,'#4a4632')},{ax:19,ay:15,sh:[4,4]});
A.car=()=>spr('car',22,11,(x)=>{R(x,3,9,4,2,'#1a1712');R(x,15,9,4,2,'#1a1712');R(x,1,2,19,8,'#3b4a3a');R(x,1,2,19,2,'#5b6e57');R(x,1,2,1,8,'#5b6e57');R(x,9,3,6,6,'#7f9ba3');R(x,9,3,6,1,'#b7d1d8');R(x,16,4,4,4,'#2d3a2c');R(x,5,3,4,6,'#c7bc9a');R(x,19,5,2,2,'#e0d8a8');R(x,0,0,21,1,'#27312a')},{ax:11,ay:9,sh:[3,3]});
A.fuel=()=>spr('fuel',17,9,(x)=>{for(let j=0;j<2;j++)for(let i=0;i<4-j;i++){const X=1+i*4+j*2,Y=1+j*3;R(x,X,Y,4,4,'#6b6f3a');R(x,X,Y,4,1,'#9aa056');R(x,X+3,Y+1,1,3,'#3f4322');dot(x,X+1,Y+1,'#d9d2a8')}},{ax:8,ay:8});
A.motorbike=()=>spr('moto',12,6,(x)=>{R(x,1,4,4,2,'#15130f');R(x,7,4,4,2,'#15130f');R(x,3,2,6,3,'#4a4f3d');R(x,3,2,6,1,'#6b7256');R(x,8,1,3,1,'#9aa1a8');R(x,1,3,3,1,'#3a3d2a')},{ax:6,ay:5,sh:[1,1],sa:.22});

/* ---------- quartel-general: casa senhorial com telhado de ardósia, rombo no telhado e entrada ensacada ---------- */
A.hq=()=>spr('hq',64,44,(x,w,h)=>{const S=C.slate;
 for(let y=2;y<=14;y++){R(x,2,y,w-4,1,y<5?S[3]:y<11?S[2]:S[1]);if(y%3===0)for(let i=2;i<w-2;i+=4)dot(x,i+(y%2)*2,y,S[1])}
 R(x,2,15,w-4,1,S[3]);R(x,2,16,w-4,1,S[0]);
 for(let y=17;y<=28;y++){R(x,2,y,w-4,1,y<21?S[1]:S[0]);if(y%3===1)for(let i=2;i<w-2;i+=4)dot(x,i+((y>>1)%2)*2,y,S[0])}
 R(x,1,29,w-2,2,'#2b2f33');
 // rombo no telhado
 R(x,38,19,11,8,'#1a1510');R(x,38,19,11,1,S[3]);for(let i=0;i<4;i++)line(x,39+i*3,19,41+i*3,26,'#5e452e');R(x,43,22,4,5,'#2a2016');
 // chaminés de tijolo
 for(const X of[12,50]){R(x,X,0,6,10,C.brick[1]);R(x,X,0,6,1,C.brick[3]);R(x,X,0,1,10,C.brick[2]);R(x,X+5,0,1,10,C.brick[0]);R(x,X+1,1,4,1,'#15100c')}
 // lucarnas
 for(const X of[10,26]){R(x,X,20,9,7,'#b7aa8f');R(x,X,20,9,1,'#d1c6a8');R(x,X+2,22,5,4,'#1c2530');dot(x,X+2,22,'#7f9ba3');R(x,X-1,19,11,1,S[0])}
 // fachada
 R(x,2,31,w-4,11,'#b7aa8f');R(x,2,31,w-4,1,'#d1c6a8');for(let i=0;i<14;i++)if(H(i,7,7)%3===0)dot(x,4+(H(i,1,9)%54),33+(H(i,2,9)%8),'#9c9076');
 for(const X of[6,18,40,52]){R(x,X,34,7,6,'#243039');R(x,X,34,7,1,'#7f9ba3');R(x,X-1,33,9,1,'#d1c6a8');R(x,X-1,40,9,1,'#7d7259');R(x,X,34,2,6,'#596247');R(x,X+5,34,2,6,'#4a523a');dot(x,X+3,36,'#dfe8ea')}
 R(x,28,33,8,9,'#2e2218');R(x,27,32,10,1,'#d1c6a8');R(x,27,33,1,9,'#d1c6a8');R(x,36,33,1,9,'#7d7259');dot(x,34,38,'#d9b556');
 R(x,24,41,16,2,'#7d7259');R(x,22,43,20,1,'#5a5041');
 // entulho no canto esquerdo e sacos na porta
 for(let i=0;i<10;i++)R(x,2+(H(i,3,5)%8),36+(H(i,4,5)%6),2,1+(i%2),i%2?'#8c8a78':'#5a5041');
 for(let j=0;j<2;j++)for(let i=0;i<4;i++){const X=22+i*5+(j&1)*2,Y=38+j*3;R(x,X,Y,5,3,'#a49468');R(x,X,Y,5,1,'#c9bb8d');R(x,X+4,Y+1,1,2,'#6b6044')}
},{ax:32,ay:40,sh:[5,5]});

/* ---------- mastro e bandeira (a bandeira é animada em tempo de execução) ---------- */
A.flagpole=()=>spr('flagpole',6,40,(x)=>{R(x,2,2,2,36,'#d9d5b7');R(x,2,2,1,36,'#f1eed2');R(x,1,0,4,3,'#cdbf7a');R(x,1,37,4,3,'#6b5a3a');dot(x,1,0,'#f4e9a8')},{ax:3,ay:38,sh:[4,0],sa:.18});
A.phonePole=()=>spr('phonepole',9,22,(x)=>{R(x,4,1,1,20,'#4a3826');R(x,4,1,1,20,'#5e452e');R(x,1,4,7,1,'#3b2a1c');R(x,1,4,7,1,'#5e452e');dot(x,1,3,'#8aa0a0');dot(x,7,3,'#8aa0a0');dot(x,3,3,'#8aa0a0');dot(x,5,3,'#8aa0a0');R(x,3,19,3,2,'#2a1f14')},{ax:4,ay:20,sh:[5,1],sa:.2});
A.sign=(icon='cross')=>spr('sign'+icon,12,16,(x)=>{R(x,5,7,2,8,'#4a3826');R(x,1,1,10,7,'#dcd4ba');R(x,1,1,10,1,'#fff8e6');R(x,1,7,10,1,'#8d8468');R(x,0,1,1,7,'#3b2a1c');R(x,11,1,1,7,'#3b2a1c');
 if(icon==='cross'){R(x,5,2,2,5,C.red);R(x,3,4,6,1,C.red)}else if(icon==='shell'){R(x,5,2,2,4,'#b8923a');dot(x,5,2,'#f0d27a');R(x,4,6,4,1,'#3a2c12')}else if(icon==='food'){ell(x,6,4,3,2,'#6b7278');dot(x,4,3,'#c7ccd0');R(x,5,1,2,1,'#3a3d40')}else if(icon==='gun'){R(x,2,4,8,1,'#2c2f33');R(x,3,5,2,2,'#2c2f33');R(x,8,3,1,2,'#2c2f33')}else{R(x,2,4,7,2,'#3b2a1c');R(x,7,3,2,4,'#3b2a1c')}},{ax:6,ay:14,sh:[2,1],sa:.2});
})();
