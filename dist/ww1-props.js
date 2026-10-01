'use strict';
(function(){
const {clamp,mk,g2,disc,ring,pline,srand,sr,stampCrater,riverX,riverHW,outlined,silhouette}=PX,{BAYER,hash2,vnoise}=PX.noise,WW=PX.WW1,S=1917;
/* Iron Front 0.6 — pintura do mapa por cima do chão iluminado: parapeitos, crateras, arame, cenário e sprites. */
const fr=v=>v-Math.floor(v),R=(c,x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),w,h)},dot=(c,x,y,col)=>{c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),1,1)};
const KB={front:{bag:1,rows:2},support:{bag:.78,rows:2},reserve:{bag:.3,rows:2},sap:{bag:1,rows:2}},HW={front:5,support:4.6,reserve:4.6,sap:3.1},WALL={front:2,support:2,reserve:2,sap:1.6};
WW.KB=KB;

/* ---------- sacos de areia, um a um ---------- */
const BAGC={body:['#b9a97e','#ab9a70','#c2b287'],hi:'#d6c99b',edge:'#7f7151',bot:'#6a5e42',shadow:'rgba(14,11,6,.34)'};
function bag(c,x,y,vert,tone){const bw=vert?3:5,bh=vert?5:3;R(c,x,y,bw,bh,BAGC.body[tone]);R(c,x,y,bw,1,BAGC.hi);if(vert)R(c,x,y,1,bh,BAGC.hi);R(c,x+bw-1,y+1,1,bh-1,BAGC.edge);R(c,x+(vert?0:1),y+bh-1,bw-(vert?0:1),1,BAGC.bot)}
function bagShadow(c,x,y,vert){const bw=vert?3:5,bh=vert?5:3;R(c,x+1,y+1,bw+1,bh+1,BAGC.shadow)}
/* lista de sacos ao longo de uma polilinha; devolve [{x,y,vert,tone}] */
function bagRun(pts,team,kind,kid,rows,off0){const out=[],ps=team?-1:1;let L0=0;
 for(let k=1;k<pts.length;k++){const[ax,ay]=pts[k-1],[bx,by]=pts[k],len=Math.hypot(bx-ax,by-ay);if(!len)continue;const tx=(bx-ax)/len,ty=(by-ay)/len;let nx=-ty,ny=tx;if(nx*ps<0){nx=-nx;ny=-ny}
  const vert=Math.abs(ty)>.62,step=vert?5:5.2;
  for(let t=0;t<len;t+=step){const L=L0+t;if(!(vnoise(L/22,kid+team*3,S+36)<KB[kind].bag))continue;
   for(let r=0;r<rows;r++){const hv=hash2(Math.floor(L/step),r+team*9+kid*5,S+60);if(hv>.93)continue;const st=(r&1)*step*.5,c0=t+st,px=ax+tx*c0+nx*(off0+r*3+1.5),py=ay+ty*c0+ny*(off0+r*3+1.5),bw=vert?3:5,bh=vert?5:3;
    out.push({x:Math.round(px-bw/2),y:Math.round(py-bh/2),vert,tone:Math.floor(hv*3)%3,r})}}
  L0+=len}
 return out}
function parapets(c,G){const list=[];
 for(const team of[0,1])for(const p of WW.teamPaths(team)){const K=KB[p.kind];if(!K)continue;list.push(...bagRun(p.pts,team,p.kind,['front','support','reserve','comm','sap'].indexOf(p.kind),K.rows,HW[p.kind]+WALL[p.kind]+.3))}
 for(const pit of G.pits||[]){const ro=pit.ri+pit.ring,n=Math.round(2*Math.PI*(pit.ri+1)/4.6);for(let r=0;r<pit.rows;r++){const rad=pit.ri+1.5+r*3,m=Math.round(2*Math.PI*rad/(r?5:4.6));
  for(let k=0;k<m;k++){const a=(k+(r&1)*.5)/m*Math.PI*2-Math.PI;if(Math.abs(Math.abs(a)-Math.PI)<pit.open&&false)continue;const ang=a,dx=Math.cos(ang),dy=Math.sin(ang),wx=pit.team?-dx:dx; // aberto para trás
   const rel=Math.atan2(dy,dx*(pit.team?-1:1));if(Math.abs(Math.abs(rel)-Math.PI)<pit.open)continue;
   const vert=Math.abs(dx)>.72;list.push({x:Math.round(pit.cx+dx*rad-(vert?1.5:2.5)),y:Math.round(pit.cy+dy*rad-(vert?2.5:1.5)),vert,tone:Math.floor(hash2(k,r,S+61)*3)%3,r})}}}
 for(const b of list)bagShadow(c,b.x,b.y,b.vert);
 list.sort((a,b)=>a.r-b.r||a.y-b.y);
 for(const b of list)bag(c,b.x,b.y,b.vert,b.tone)}

/* ---------- crateras: em bombardeios (aglomerados), cada vez mais densas perto das linhas ---------- */
/* com WW.CLEAN.on: só alguns buracos velhos e rasos (tom de terra coberta de capim, sem queimado, quase sem água) */
const CR_DENSE={n:440,clusters:14,front:16,clusterP:.68,rMax:15.5,wet:1,scorch:.25,old:false};
function craters(c,G,out){const{w,h,Dm,Dmin}=G,CL=WW.CLEAN||{},K=CL.on&&CL.craters?CL.craters:CR_DENSE,P0=G.P,P=K.old?Object.assign({},P0,{m:['#35331f','#403d29','#4d4832','#5c563d','#6d6649']}):P0;srand(S*13);
 const list=[],clusters=[];
 for(let i=0;i<K.clusters;i++)clusters.push({x:w/2+(sr()-.5)*300,y:30+sr()*(h-60),s:26+sr()*44});
 for(let i=0;i<K.front;i++){const side=i&1,xf=WW.xAt(WW.layout().P.front,30+sr()*740);clusters.push({x:side?w-xf-10+(sr()-.5)*30:xf+10+(sr()-.5)*30,y:30+sr()*(h-60),s:14+sr()*24})}
 let tries=0;while(list.length<K.n&&tries++<6000){let x,y;
  if(clusters.length&&sr()<K.clusterP){const cl=clusters[Math.floor(sr()*clusters.length)],a=sr()*6.283,d=Math.abs((sr()+sr()+sr()-1.5))*cl.s*1.3;x=cl.x+Math.cos(a)*d;y=cl.y+Math.sin(a)*d}else{x=sr()*w;y=sr()*h}
  x=Math.round(x);y=Math.round(y);if(x<8||y<8||x>w-8||y>h-8)continue;
  const i=y*w+x,D=Dm[i],r=Math.max(2.5,2.6+Math.pow(sr(),2.3)*K.rMax*(.55+D*.5));
  if(sr()>Math.pow(D,2.4)*1.05+.012)continue;
  const rv=riverX(y),rh=riverHW(y);if(Math.abs(x-rv)<rh+r*.6)continue;
  if(Dmin[i]<r+9)continue;
  if(list.some(q=>(q.x-x)**2+(q.y-y)**2<(q.r+r)**2*.42))continue;
  list.push({x,y,r,wet:(Math.abs(x-rv)<95?.5:.2)*K.wet})}
 list.sort((a,b)=>b.r-a.r);
 list.forEach((q,n)=>{stampCrater(c,q.x,q.y,q.r,P,{puddle:q.r>(K.old?4.5:6)&&sr()<q.wet,seed:n+1,scorch:q.r<7&&sr()<K.scorch?.7:0});out.craters.push({x:q.x,y:q.y,r:q.r})})}

/* ---------- tufos, pedrinhas e entulho espalhado ---------- */
function specks(c,G){const{w,h,mat,Dm,MT,P}=G;srand(S*7);
 const n=Math.floor(w*h/130);
 for(let k=0;k<n;k++){const x=sr()*w|0,y=sr()*h|0,i=y*w+x,m=mat[i],D=Dm[i],q=sr();
  if(m<=MT.G2){if(q<.6){dot(c,x,y,P.tuft[0]);dot(c,x-1,y-1,P.tuft[0]);dot(c,x+1,y-1,P.tuft[0]);if(sr()<.5)dot(c,x,y-2,P.tuft[1])}else if(q<.78)dot(c,x,y,P.tuft[1]);else if(q<.88&&m===MT.G0)dot(c,x,y,P.flower[sr()<.6?0:1]);else{dot(c,x,y,'#757a6c');dot(c,x+1,y,'#8d9283');dot(c,x,y+1,'#4d5145')}}
  else if(m===MT.MUD){if(D<.5&&q>.3)continue;
   if(q<.3){dot(c,x,y,'#1a140d');dot(c,x+1,y,'#2a2015')}           // torrão escuro
   else if(q<.5){dot(c,x,y,'#8a7a56');dot(c,x-1,y,'#6b5d40')}       // palha
   else if(q<.66){dot(c,x,y,'#6d6a60');dot(c,x+1,y,'#8b887c');dot(c,x,y+1,'#45433c')} // pedra
   else if(q<.685){dot(c,x,y,'#b8923a');dot(c,x+1,y,'#7d5f23')}       // estojo de latão
   else if(q<.86){pline(c,x,y,x+3,y+(sr()<.5?1:-1),'#4a3a28');dot(c,x,y,'#7d6a4a')} // estilhaço de madeira
   else{dot(c,x,y,'#2e3b36');dot(c,x+1,y,'#3d4d46')}}}}           // poça pequena

/* ---------- arame farpado em duas faixas, com aberturas nas estradas ---------- */
function wire(c,G){const Lay=WW.layout(),roads=WW.ROADY;
 for(const team of[0,1])for(const[off,ph,seed]of[[31,0,1],[46,2.3,2]]){
  const pts=[];for(let y=-4;y<=804;y+=10)pts.push([WW.xAt(Lay.P.front,clamp(y,4,796))+off+Math.sin(y/9+ph)*2.4+Math.sin(y/37+ph)*3,y]);
  const gaps=[];for(const ry of roads)gaps.push([ry-12,ry+12]);let gy=90+hash2(seed,team,S)*80;while(gy<760){gaps.push([gy,gy+11+hash2(gy|0,seed,S)*8]);gy+=150+hash2(gy|0,team,S+1)*120}
  const inGap=y=>gaps.some(g=>y>g[0]&&y<g[1]),P=team?pts.map(([x,y])=>[G.w-x,y]):pts;
  /* postes a cada ~8 px */
  const posts=[];let carry=0,L=0;for(let k=1;k<P.length;k++){const[ax,ay]=P[k-1],[bx,by]=P[k],len=Math.hypot(bx-ax,by-ay);for(let d=carry;d<len;d+=8.5){const t=d/len;posts.push({x:ax+(bx-ax)*t+(hash2(posts.length,1,S+seed)-.5)*1.6,y:ay+(by-ay)*t})}carry=(carry+Math.ceil((len-carry)/8.5)*8.5)-len}
  for(let k=1;k<posts.length;k++){const a=posts[k-1],b=posts[k];if(inGap((a.y+b.y)/2))continue;const hv=hash2(k,team*5+seed,S+70);if(hv>.93)continue;
   const dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l,wd=2.6+hv*1.4;
   pline(c,a.x+1,a.y+2,b.x+1,b.y+2,'rgba(12,10,6,.34)');
   pline(c,a.x+nx*wd,a.y+ny*wd,b.x-nx*wd,b.y-ny*wd,'#24271f');pline(c,a.x-nx*wd,a.y-ny*wd,b.x+nx*wd,b.y+ny*wd,'#2b2e25');pline(c,a.x,a.y,b.x,b.y,'#1d2019');
   if(hv>.45){const t=.3+hv*.4;dot(c,a.x+dx*t+nx*wd*(1-2*t),a.y+dy*t+ny*wd*(1-2*t),'#b4baa8')}
   if(hv<.2){const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;ring(c,mx,my,3,2,'#23261e');dot(c,mx-2,my-1,'#a8ae9c')}}
  for(const p of posts){if(inGap(p.y))continue;R(c,p.x+1,p.y+2,2,2,'rgba(12,10,6,.4)');R(c,p.x,p.y-1,2,3,'#5b4a34');dot(c,p.x,p.y-1,'#9b8560');dot(c,p.x+1,p.y+1,'#33281a')}}}

WW.paint=function(c,G,out){
 craters(c,G,out);
 specks(c,G);
 if(!WW.forts||WW.forts())wire(c,G);           // arame pintado só com as fortificações (CLEAN.forts)
 if(WW.scene)WW.scene(c,G,out);
};
WW.art={R,dot,bag,BAGC};
})();
