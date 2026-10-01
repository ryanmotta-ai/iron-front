'use strict';
(function(){
const K=PX.WW1.kit,{R,dot,ell,line,spr,C,H,mix,srand,sr,clamp}=K,A=PX.WW1.SPR=PX.WW1.SPR||{};
/* Iron Front 0.6 — vegetação: choupos em fileira, carvalhos, pomar, salgueiros, sebes e juncos. */
const TREE={ok:['#1e3019','#2d4a26','#42683a','#61894a'],worn:['#2a3020','#3c4a2a','#56683a','#77884d'],sick:['#35331f','#4a4829','#66623a','#86804b']};
function crown(x,blobs,T,dither=true){for(const[bx,by,rx,ry]of blobs)ell(x,bx,by+1.5,rx,ry,T[0]);for(const[bx,by,rx,ry]of blobs)ell(x,bx-.7,by-.5,rx*.9,ry*.9,T[1]);for(const[bx,by,rx,ry]of blobs)ell(x,bx-1.5,by-1.6,rx*.62,ry*.62,T[2]);
 if(dither)for(const[bx,by,rx,ry]of blobs){for(let i=0;i<Math.round(rx*ry*.35);i++){const a=H(Math.round(bx*7),Math.round(by*5),i)*6.283,d=H(i,Math.round(bx),Math.round(by));const px=bx-1.6+Math.cos(a)*rx*.5*d,py=by-2.2+Math.sin(a)*ry*.45*d;dot(x,px,py,T[3])}}}
function trunk(x,cx,y0,len,col){for(let j=0;j<len;j++){dot(x,cx,y0+j,col[0]);dot(x,cx+1,y0+j,col[1])}}
const TR=['#3b2b1e','#5a4330'];
A.poplar=(v=0,tone='ok')=>spr(`poplar${v}${tone}`,16,44,(x)=>{srand(v*13+5);const T=TREE[tone],cx=8,blobs=[];const n=6;for(let i=0;i<n;i++){const t=i/(n-1),ry=4.2-Math.abs(t-.45)*1.4,rx=3.3+Math.sin(t*3.1)*1.9*(1-t*.3);blobs.push([cx+(sr()-.5)*1.4,7+i*5.2,rx,ry+1.2])}
 trunk(x,cx-1,36,6,TR);crown(x,blobs,T)},{ax:8,ay:41,sh:[5,2],sa:.26});
A.oak=(r=10,v=0,tone='ok')=>spr(`oak${r}${v}${tone}`,r*2+8,r*2+10,(x,w,h)=>{srand(v*31+r);const T=TREE[tone],cx=w>>1,cy=r+3,blobs=[[cx,cy,r*.78,r*.72]];for(let i=0;i<5;i++){const a=sr()*6.283,d=sr()*r*.5;blobs.push([cx+Math.cos(a)*d,cy+Math.sin(a)*d*.8,r*(.45+sr()*.25),r*(.4+sr()*.22)])}
 trunk(x,cx-1,cy+r*.6|0,5,TR);crown(x,blobs,T)},{ax:0,ay:0,sh:[3,3],sa:.27});
/* os carvalhos usam âncora no pé */
const _oak=A.oak;A.oak=(r=10,v=0,tone='ok')=>{const s=_oak(r,v,tone);s.ax=(r*2+8>>1)+1;s.ay=Math.round(r+3+r*.6+4)+1;return s};
A.apple=(v=0)=>spr('apple'+v,18,20,(x)=>{srand(v*7+2);const T=TREE.ok,cx=9,cy=8,blobs=[[cx,cy,6,5.5],[cx-3,cy+1,3.5,3.2],[cx+3,cy+1,3.5,3.2]];trunk(x,cx-1,cy+5,4,TR);crown(x,blobs,T);for(let i=0;i<5;i++)dot(x,cx-5+(H(i,v,4)%10),cy-3+(H(i,v,5)%7),'#c2483a')},{ax:9,ay:17,sh:[3,2],sa:.26});
A.willow=(v=0)=>spr('willow'+v,30,30,(x)=>{srand(v*5+9);const T=['#283a24','#3e5a34','#5a7c48','#7a9c5c'],cx=15,cy=11;trunk(x,cx-1,cy+5,10,TR);crown(x,[[cx,cy,11,8],[cx-6,cy+3,6,5],[cx+6,cy+3,6,5]],T);
 for(let i=0;i<22;i++){const X=cx-12+i*1.1,y0=cy+4+(H(i,v,2)%4),len=3+(H(i,v,6)%8);line(x,X,y0,X+(i%3-1)*.6,y0+len,T[i%3])}},{ax:15,ay:24,sh:[4,2],sa:.26});
A.shrub=(v=0)=>spr('shrub'+v,14,11,(x)=>{srand(v*3+1);crown(x,[[7,6,5,4],[4,7,3,3],[10,7,3,3]],['#243520','#364d2c','#4d6a3c','#6a8a4c'])},{ax:7,ay:9,sh:[2,2],sa:.24});
A.hedge=(len=24)=>spr('hedge'+len,len+4,10,(x)=>{const blobs=[];for(let i=0;i<len/4;i++)blobs.push([3+i*4,5+(H(i,len,3)%3-1),3.4,3.6]);crown(x,blobs,['#233421','#334c2a','#496a3a','#688a4c'],true)},{ax:(len+4)>>1,ay:8,sh:[2,2],sa:.22});
A.reeds=()=>spr('reeds',14,12,(x)=>{for(let i=0;i<7;i++){const X=1+i*2,l=5+H(i,1,3)%6;line(x,X,11,X+(i%3-1),11-l,i%2?'#56653a':'#3d4b2a');if(i%3===0)dot(x,X+(i%3-1),11-l,'#8a6b44')}},{ax:7,ay:11,sh:[1,1],sa:.12});
A.burntTree=()=>spr('burntTree',16,22,(x)=>{const c=['#15130f','#2a2620','#4a4338'];for(let j=0;j<16;j++){R(x,7,19-j,2,1,j%3?c[1]:c[0]);dot(x,7,19-j,c[2])}line(x,7,8,3,3,c[1]);line(x,8,10,13,5,c[1]);line(x,8,14,11,11,c[0]);dot(x,3,3,c[2]);dot(x,13,5,c[2]);R(x,5,19,6,2,c[0])},{ax:8,ay:20,sh:[3,2],sa:.25});
})();
