(function(root){
'use strict';
const cost={cap:90,int:90,esc:60,rec:70,atk:160,bmb:240};
const cooldown={cap:80,int:35,esc:35,rec:95,atk:100,bmb:160};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function service(a){
 const T=a.T,engine=clamp(1-a.engHp/T.eng,0,1),structure=clamp(1-a.strHp/T.str,0,1),controls=clamp(1-a.ctlHp/3,0,1);
 const damage=clamp(a.dmg||0,0,1),ammo=1-a.ammo.reduce((s,n)=>s+n,0)/Math.max(1,T.ammo*T.guns),fuel=clamp(1-a.fuel/T.fuel,0,1);
 const repair=Math.ceil(engine*65+structure*55+controls*35+damage*25+(a.leak?15:0));
 return {repair,cost:repair+Math.ceil(Math.max(0,ammo)*10+fuel*8),seconds:24+Math.ceil(engine*65+structure*55+controls*45+damage*35+(a.leak?15:0))};
}
function replacement(T){return T.cls==='B'?360:T.cls==='b'?320:T.cls==='f'?240:280}
function clear(own,x,y,r=220){return own.every(u=>{
 for(const k of [0,.25,.5,1]){const dx=(u.tx??u.x)-u.x,dy=(u.ty??u.y)-u.y,d=Math.hypot(dx,dy)||1,step=Math.min(d,180)*k;
 if(Math.hypot(u.x+dx/d*step-x,u.y+dy/d*step-y)<r)return false}return true;
})}
function target(s){const cells=new Map();
 for(const e of s.contacts||[]){if(s.time-e.at>10||e.hp<=0)continue;const k=Math.floor(e.x/180)+','+Math.floor(e.y/180),w=e.type==='tank'?4:e.type==='mg'?3:1;let c=cells.get(k);if(!c)cells.set(k,c={x:0,y:0,n:0,count:0});c.x+=e.x*w;c.y+=e.y*w;c.n+=w;c.count++}
 return [...cells.values()].map(c=>({...c,x:c.x/c.n,y:c.y/c.n})).filter(c=>clear(s.own,c.x,c.y)).sort((a,b)=>(b.n-Math.abs(b.y-s.y)/300)-(a.n-Math.abs(a.y-s.y)/300))[0]||null;
}
function choose(s){if(s.grounded||s.preparing||s.own.filter(u=>!u.sap&&!u.med).length<12)return null;
 const ready=k=>s.available?.[k]!==false&&s.time>=(s.next[k]||0)&&!s.flights.some(f=>f.kind===k&&f.phase!=='home'&&!f.done);
 if(s.intruder&&ready('int'))return {kind:'int',x:s.intruder.x,y:s.intruder.y,reason:'Aeronave inimiga sobre nossa linha'};
 if(s.reconPoint&&ready('rec'))return {kind:'rec',x:clamp(s.reconPoint.x,100,s.width-100),y:s.reconPoint.y,reason:'Infantaria pediu reconhecimento do acesso lateral; informem resistência'};
 if(ready('cap'))return {kind:'cap',x:s.front,y:s.y,reason:'Protejam o setor da operação',n:2};
 const g=target(s);
 if(ready('rec')&&(!g||['recon','prepare','muster'].includes(s.phase)))return {kind:'rec',x:clamp(s.front+(s.team?-1:1)*400,100,s.width-100),y:s.y,reason:'Reconheçam a rota do avanço'};
 if(g&&g.n>=9&&ready('bmb')&&['prepare','advance','counter'].includes(s.phase))return {kind:'bmb',x:g.x,y:g.y,n:1,reason:'Concentração inimiga confirmada; aliados fora da área'};
 if(g&&g.n>=5&&ready('atk'))return {kind:'atk',x:g.x,y:g.y,n:2,reason:'Neutralizem a posição marcada pela infantaria'};
 if(ready('rec'))return {kind:'rec',x:clamp(s.front+(s.team?-1:1)*400,100,s.width-100),y:s.y,reason:'Observem o setor e informem os contatos'};
 return null;
}
const api={cost,cooldown,service,replacement,clear,target,choose};root.IronFrontAirPolicy=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
