'use strict';
(function(){
/* Iron Front 0.6 — geometria do mapa "A Última Trincheira" (Fronte Ocidental, 1917).
   Este arquivo só tem dados e geometria (nada de canvas): a mesma definição alimenta a arte (ww1-terrain.js),
   a cobertura das trincheiras (game.js), o alagamento (weather.js) e o ponto de nascimento das tropas.
   Coordenadas em PIXELS DE ARTE (1200×800, 1 px = 2 unidades do mundo) para o lado Aliado (esquerda);
   o lado Central é o espelho (x → 1200 − x). Visto da esquerda para a direita:
   logística → artilharia → reserva → apoio → linha de frente → arame → terra de ninguém (com o rio) → e o espelho. */
const PW=1200,PH=(window.IronFrontWorld?.height||1600)/2,YS=PH/800,MAPKEY='trenches';
const rng=seed=>{let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}};
const mirror=pts=>pts.map(([x,y])=>[PW-x,y]);

/* faixas do mapa (x em px de arte, lado Aliado) — o HUD mostra o setor sob a câmera */
const ZONES=[
 {id:'log',x0:0,x1:126,name:'RETAGUARDA · LOGÍSTICA'},
 {id:'art',x0:126,x1:226,name:'BATERIA DE ARTILHARIA'},
 {id:'res',x0:226,x1:305,name:'LINHA DE RESERVA'},
 {id:'sup',x0:305,x1:344,name:'LINHA DE APOIO'},
 {id:'fre',x0:344,x1:384,name:'LINHA DE FRENTE'},
 {id:'wir',x0:384,x1:440,name:'ARAME FARPADO'},
 {id:'nml',x0:440,x1:760,name:'TERRA DE NINGUÉM'}];
function zoneAt(worldX,worldY){const px=worldX/2,m=px>PW/2?PW-px:px,team=px>PW/2?1:0;for(const z of ZONES)if(m>=z.x0&&m<z.x1)return{id:z.id,name:z.name,team:z.id==='nml'?-1:team};return{id:'nml',name:'TERRA DE NINGUÉM',team:-1}}

const X={front:362,support:324,reserve:286,main:106,rail:28};      // eixos principais
const ROADY=[185,400,610];                                        // estradas leste-oeste (as mesmas pontes do terreno antigo)
const COMMY=[95,185,290,400,505,610,710];                         // trincheiras de comunicação (as 3 do meio seguem as estradas)

function zigzag(r,o){const pts=[];let y=o.y0,k=0;
 while(y<o.y1){const b=o.x+o.a1*Math.sin(y/o.p1+o.ph)+o.a2*Math.sin(y/o.p2+o.ph*2);pts.push([Math.round(b+(k&1?1:-1)*o.amp*(.7+r()*.6)),Math.round(y)]);y+=o.s0+r()*(o.s1-o.s0);k++}
 pts.push([Math.round(o.x+o.a1*Math.sin(o.y1/o.p1+o.ph)+o.a2*Math.sin(o.y1/o.p2+o.ph*2)),o.y1]);return pts}
function xAt(pts,y){for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];if(y>=a[1]&&y<=b[1]){const t=(y-a[1])/Math.max(1,b[1]-a[1]);return a[0]+(b[0]-a[0])*t}}return pts[pts.length-1][0]}
function commTrench(r,xa,xb,y,amp,step){const pts=[[xa,y]];let x=xa+step*.7,k=0;while(x<xb-step*.5){pts.push([Math.round(x),Math.round(y+(k&1?1:-1)*amp*(.6+r()*.8))]);x+=step*(.85+r()*.4);k++}pts.push([xb,y]);return pts}

function buildBase(){
 const r=rng(1917),P={};
 /* linhas paralelas: a de frente é a mais recortada (baías de tiro e traveses), a de reserva a mais calma */
 P.front=zigzag(r,{x:X.front,y0:4,y1:796,s0:15,s1:28,amp:7,a1:9,p1:74,ph:1,a2:5,p2:29});
 P.support=zigzag(r,{x:X.support,y0:4,y1:796,s0:24,s1:38,amp:8,a1:7,p1:96,ph:2.2,a2:4,p2:41});
 P.reserve=zigzag(r,{x:X.reserve,y0:4,y1:796,s0:34,s1:52,amp:6,a1:6,p1:120,ph:.4,a2:3,p2:53});
 /* trincheiras de comunicação: da reserva até a frente, em zigue-zague */
 P.comm=COMMY.map(y=>{const xa=xAt(P.reserve,y),xb=xAt(P.front,y);return commTrench(r,xa,xb,y,5,15)});
 /* ponta avançada: postos de escuta, fora do arame interno */
 const sapY=[248,556];
 P.sap=sapY.map(y=>{const xf=xAt(P.front,y);return[[xf,y],[xf+14,y+4],[xf+27,y-3],[xf+39,y+1]]});
 /* ninhos de metralhadora no saliente da frente, morteiros e posto de comando no apoio */
 const nestY=[112,292,498,702];
 const nests=nestY.map(y=>({x:Math.round(xAt(P.front,y))+9,y}));
 const mortarY=[152,352,552,752];
 const mortars=mortarY.map(y=>({x:Math.round(xAt(P.support,y))+8,y}));
 const post={x:Math.round(xAt(P.support,400))-4,y:400};
 /* baterias: 6 canhões espalhados */
 const guns=[{x:170,y:90,k:'f'},{x:148,y:238,k:'h'},{x:176,y:328,k:'f'},{x:152,y:472,k:'f'},{x:180,y:574,k:'h'},{x:150,y:716,k:'f'}];
 /* sem fortificações (CLEAN.forts:false): as linhas P continuam como geometria de referência (setores, arame da física),
    mas nada disso existe no chão — sem canhões, ninhos nem morteiros; cada lado constrói os seus na preparação */
 if(!forts())return{P,nests:[],mortars:[],post,guns:[],sapY,nestY,mortarY,gunsPlan:guns,nestsPlan:nests,mortarsPlan:mortars};
 return{P,nests,mortars,post,guns,sapY,nestY,mortarY}}
function build(){const b=buildBase();const path=p=>p.map(([x,y])=>[x,y*YS]);for(const k of ['front','support','reserve'])b.P[k]=path(b.P[k]);for(const k of ['comm','sap'])b.P[k]=b.P[k].map(path);const seen=new Set();for(const k of ['nests','mortars','guns','gunsPlan','nestsPlan','mortarsPlan'])for(const p of b[k]||[])if(!seen.has(p)){p.y*=YS;seen.add(p)}b.post.y*=YS;for(const k of ['sapY','nestY','mortarY'])b[k]=b[k].map(y=>y*YS);return b}
let L=null;const layout=()=>L||(L=build());
function railPts(){const p=[];for(let y=-4;y<=PH+4;y+=12)p.push([X.rail+3.5*Math.sin(y/130),y]);return p}

/* amostra uma polilinha a cada `step` px: [x,y,dirx,diry] */
function sample(pts,step){const out=[];let carry=0;for(let i=1;i<pts.length;i++){const[ax,ay]=pts[i-1],[bx,by]=pts[i],len=Math.hypot(bx-ax,by-ay);if(!len)continue;const dx=(bx-ax)/len,dy=(by-ay)/len;let d=carry;for(;d<len;d+=step)out.push([ax+dx*d,ay+dy*d,dx,dy]);carry=d-len}return out}
const teamPts=(pts,team)=>team?mirror(pts):pts;
const cat={front:['front'],support:['support'],reserve:['reserve'],comm:['comm'],sap:['sap']};
function teamPaths(team){const{P}=layout(),out=[];
 for(const k of['front','support','reserve'])out.push({kind:k,team,pts:teamPts(P[k],team)});
 for(const p of P.comm)out.push({kind:'comm',team,pts:teamPts(p,team)});
 for(const p of P.sap)out.push({kind:'sap',team,pts:teamPts(p,team)});
 return out}

/* cobertura jogável: âncoras ao longo de todas as trincheiras (mundo = 2× px). Cada âncora cobre uma caixa
   pequena (hw×hh) e oferece um lugar só — a IA ocupa as posições uma a uma. */
let ANCH=null;
function fieldTrenches(){if(!forts())return[];if(ANCH)return ANCH;ANCH=[];
 for(let team=0;team<2;team++)for(const path of teamPaths(team)){const step=path.kind==='comm'?10:9;let n=0;
  for(const[x,y]of sample(path.pts,step))ANCH.push({id:`field-${team}-${path.kind}-${Math.round(path.pts[0][1])}-${n++}`,type:'trench',team,x:Math.round(x*2),y:Math.round(y*2),hp:Infinity,hw:16,hh:16,slots:1,line:path.kind})}
 return ANCH}

/* posições de nascimento (em unidades do mundo): a frente recebe a maior parte, depois apoio e reserva */
let SPOTS=null;
/* área de reunião na retaguarda (sem fortificações): campo aberto entre a bateria e a reserva (px de arte 165–280 → mundo
   330–560), y 75–725, fugindo das estradas, das árvores/sebes da bateria e do pátio dos tanques. Espelhado para os Centrais. */
const ASSY={x0:165,x1:280,y0:75,y1:725,step:7,road:9,
 obst:[[206,150,12],[212,430,12],[204,690,12],[246,230,12],[242,770,12],[232,118,12],[170,412,24],[176,196,22],[180,622,20],
  [236,300,11],[232,312,9],[240,544,9],[234,560,11],[228,512,9],[252,325,17],[252,525,17],[240,36,12],[240,772,12]]};
function assembly(team){const rr=rng(71+team),out=[];
 for(let y=ASSY.y0;y<=ASSY.y1;y+=ASSY.step)for(let x=ASSY.x0;x<=ASSY.x1;x+=ASSY.step){const px=x+(rr()-.5)*4,py=y+(rr()-.5)*4;
  if(ROADY.some(ry=>Math.abs(py-ry)<ASSY.road))continue;if(ASSY.obst.some(([ox,oy,r])=>(px-ox)**2+(py-oy)**2<r*r))continue;out.push([team?PW-px:px,py])}
 for(let i=out.length-1;i>0;i--){const j=Math.floor(rr()*(i+1));[out[i],out[j]]=[out[j],out[i]]}
 return out.map(([x,y])=>[x,y*YS])}
function spots(){if(SPOTS)return SPOTS;SPOTS=[[],[]];
 if(!forts()){for(let team=0;team<2;team++)SPOTS[team]=assembly(team).map(([x,y])=>[Math.round(x*2),Math.round(y*2)]);return SPOTS}
 for(let team=0;team<2;team++){const{P}=layout(),f=sample(teamPts(P.front,team),11),s=sample(teamPts(P.support,team),13),q=sample(teamPts(P.reserve,team),15),rr=rng(33+team),shuf=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(rr()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
  const bag=[shuf(f),shuf(s),shuf(q)],ci=[0,0,0],out=[];
  for(let n=0;n<900;n++){const m=n%10,pick=m<5?0:m<8?1:2,a=bag[pick];out.push(a[ci[pick]++%a.length])}
  SPOTS[team]=out.map(([x,y])=>[x*2,y*2])}
 return SPOTS}
function spawn(team,i){const a=spots()[team];return a[i%a.length]}
const ASSY_MG=[[272,112],[272,292],[272,498],[272,702]];   // metralhadoras esperam na borda da área de reunião
function nestSpots(team){if(!forts())return ASSY_MG.map(([x,y])=>[(team?PW-x:x)*2,y*2*YS]);return layout().nests.map(n=>[(team?PW-n.x:n.x)*2,n.y*2])}
function tankSpots(team){const x=team?PW-252:252;return[[x*2,650*YS],[x*2,1050*YS]]}
function cavalrySpot(team,i){const x=(team?PW-74:74)*2;return[x+((i*37)%60)-30,(1150+((i*53)%260))*YS]}
const reinforceX=team=>team?2400-216:216;

/* construções iniciais do jogo (sem trincheira: as trincheiras já estão pintadas e dão cobertura) */
function startBuildings(team){if(!forts())return[];const{P,post}=layout(),out=[];
 out.push({type:'bunker',x:(team?PW-post.x:post.x)*2-2*(team?-6:6),y:post.y*2});
 for(const y of[300,600,820,1040,1300].map(y=>y*YS)){const px=xAt(P.front,y/2)+17;out.push({type:'sandbag',x:(team?PW-px:px)*2,y:y+8})}
 return out}

/* campo "limpo": a terra de ninguém começa quase intacta (capim seco pisoteado, poucos buracos velhos) e é o combate
   que a transforma — crateras de pixel.js, chuva enchendo buracos (weather.js), sapadores cavando (sappers.js).
   on:false restaura o visual antigo (lama alagada, 440 crateras, carcaças, corpos e retaguarda cheia).
   dt = desgaste por distância ao centro (u, px de arte): leve no meio, um pouco mais perto do arame e da frente. */
const CLEAN={on:true,
 dt:[[0,.42],[120,.44],[170,.52],[205,.6],[250,.58],[290,.44],[330,.3],[400,.16],[480,.06],[560,0]],
 dry:1.3,                                       // capim mais seco/pisoteado onde há desgaste (multiplica o degrau G0→G1→G2)
 puddle:false,                                  // poças d'água na lama da terra de ninguém
 craters:{n:56,clusters:3,front:6,clusterP:.35,rMax:6.5,wet:.05,scorch:0,old:true}, // buracos velhos e rasos
 nml:{trees:10,stumps:4,fences:5,junk:0,corpses:0,wrecks:0,plane:0,carts:0,horses:0,rubble:0,crates:0,liveTrees:true},
 rear:.5,                                       // fração dos adereços puramente decorativos mantidos na retaguarda
 /* fortificações pintadas (trincheiras, sacos, ninhos, arame, 12 posições de bateria, morteiros, abrigos das linhas).
    false = a partida começa sem elas (fase de preparação: cada lado constrói as suas); true = linhas pintadas como antes.
    Independe de `on`. Ler antes do 1º layout()/terreno — os caches (layout, âncoras, nascimentos) não se refazem. */
 forts:false};
const forts=()=>!!CLEAN.forts;

window.PX=window.PX||{};
PX.WW1={CLEAN,forts,ASSY,railPts,MAPKEY,PW,PH,YS,ZONES,X,ROADY:ROADY.map(y=>y*YS),COMMY:COMMY.map(y=>y*YS),layout,sample,xAt,mirror,teamPaths,fieldTrenches,spawn,nestSpots,tankSpots,cavalrySpot,reinforceX,startBuildings,zoneAt,rng};
})();
