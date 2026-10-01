/* Allied squad signs and a bridge to the game's native ammunition depots. */
(function(){
'use strict';
if(!window.IronFrontBrain)return;
const H=window.IronFrontHuman={on:!/[?&]humanizar=0/.test(location.search)};
Object.defineProperty(H,'supplyPosts',{get:()=>window.PXWORKS?.on?PXWORKS.depots().filter(p=>p.hp>0):[]});
Object.defineProperty(H,'stats',{get:()=>window.PXWORKS?.state().stats||{}});
function draw(c,ox,oy){if(!H.on||!started||window.IronFront.tactics?.visible===false)return;
 const plan=IronFrontBrain.lastPlans[playerTeam],own=new Map(units.filter(u=>u.team===playerTeam).map(u=>[u.id,u]));
 c.save();for(const g of plan?.squadMind||[]){const u=own.get(g.leader);if(!u||u.hp<=0||u.down)continue;const x=ox+Math.round(u.x*.5),y=oy+Math.round(u.y*.5);if(x<-15||y<-15||x>vw+15||y>vh+15)continue;
  c.fillStyle=g.state==='reorganizando'?'#edb371':g.state==='abalado'?'#e68c7b':'#d8e6a1';c.fillRect(x-3,y-12,6,1);c.fillRect(x-2,y-11,4,1);c.fillRect(x-1,y-10,2,1);
  c.fillStyle='#192219';c.fillRect(x-5,y-17,10,2);c.fillStyle=g.morale<.45?'#e79b70':'#abd68a';c.fillRect(x-5,y-17,Math.round(g.morale*10),2);
 }
 c.restore();
}
if(window.WW1A){const over0=WW1A.over||(()=>{});WW1A.over=function(c,ox,oy,...a){const r=over0.call(this,c,ox,oy,...a);draw(c,ox,oy);return r}}
const panel=document.getElementById('aiPanel'),info=document.createElement('p');info.id='squadStatus';panel?.append(info);
const hud0=window.hud;window.hud=function(...a){const r=hud0.apply(this,a),p=IronFrontBrain.lastPlans[playerTeam];
 if(!H.on){info.textContent='';return r}const groups=p?.squadMind||[],recovering=groups.filter(g=>g.state==='reorganizando').length,report=p?.intelligence||[];
 const active=groups.find(g=>['fixar-flanquear','limpeza-trincheira','reabastecimento','patrulha-retornando'].includes(g.task));
 info.textContent=groups.length?`Esquadrões: ${groups.length} · reorganizando: ${recovering} · líderes ativos: ${groups.filter(g=>g.leader!==null).length}. ${active?.note||'Liderança e moral coordenando as tropas'}. Relatos: ${report.length}; posições antigas: ${report.filter(e=>e.status==='ultima-posicao').length}.`:'';return r};
H.draw=draw;
})();
