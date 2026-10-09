'use strict';
/* Iron Front 1.15 — selecionar avião no aeródromo e mandar decolar (airsel.js). Carrega DEPOIS do airbase.js/airsite.js.
   Clique esquerdo num avião parado (modo Comandante) seleciona; Shift soma outro; clique fora desmarca; Esc desmarca.
   Painel: SUBIR VOO (patrulha/missão padrão do avião) e as missões que o avião sabe fazer (clique no mapa escolhe o alvo).
   Clique direito no mapa com avião selecionado manda a missão armada (ou a padrão) para o ponto.
   Usa IronFrontAirCommand.request (custo, cooldown, clima, aliados no alvo) com {pick:[aviões]}; o airwar.js lança exatamente esses aviões.
   Liga/desliga: ?selaviao=0 · API: IronFront.airsel */
(function(){
const A=window.PXAW,C=window.IronFrontAirCommand;if(!A||!C||!C.request)return;
if(/[?&]selaviao=0/.test(location.search))return;
const NAME={cap:'Patrulha',atk:'Ataque ao solo',bmb:'Bombardeio',rec:'Reconhecimento'};
const hyp=Math.hypot,clamp=(v,a,b)=>v<a?a:v>b?b:v;
const S=window.PXSEL={on:true,sel:[],armed:null,stats:{selected:0,orders:0,denied:0,errors:0}};
let errs=0;function fail(e){S.stats.errors++;if(++errs<=3)console.error('airsel.js:',e);if(errs>=8){S.on=false;hide()}}
const live=a=>a&&!a.dead&&!a.gone;
const parked=a=>live(a)&&a.st==='park'&&a.team===playerTeam;
function readyWhy(a){if(!live(a))return 'destruído';if(a.st!=='park')return 'já está em voo';if(!a.pilot||!a.pilot.alive)return 'sem piloto';if(a.pilot.busy)return 'piloto em outra saída';if(a.ready>time)return 'em serviço/rearmando';return ''}
function kinds(a){const T=a.T,r=[];if(T.cls==='f')r.push('cap');if(T.cls==='f'||T.bombs)r.push('atk');if(T.bombs)r.push('bmb');if(T.recon)r.push('rec');if(!r.length)r.push('atk');return r}
function common(list){return list.length?kinds(list[0]).filter(k=>list.every(a=>kinds(a).includes(k))):[]}
function front(){return A.front()}
function autoTarget(kind,team,y){const f=front();return kind==='cap'?{x:f,y:clamp(y,120,GH-120)}:kind==='rec'?{x:clamp(f+(team?-1:1)*400,100,W-100),y:clamp(y,120,GH-120)}:null}

/* ---------- painel ---------- */
const box=document.createElement('div');box.id='airSelPanel';box.hidden=true;
const style=document.createElement('style');style.textContent='#airSelPanel{position:absolute;left:50%;bottom:150px;transform:translateX(-50%);z-index:30;background:rgba(24,28,20,.93);border:1px solid #8f9a63;color:#e4e0c0;font:12px monospace;padding:9px 11px;min-width:250px;max-width:340px;pointer-events:auto;box-shadow:0 3px 14px #000a}#airSelPanel b{color:#f0e6a8}#airSelPanel .row{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}#airSelPanel button{font:12px monospace;background:#3a4530;color:#eee9c4;border:1px solid #7f8b57;padding:5px 8px;cursor:pointer}#airSelPanel button:hover{background:#4d5b3d}#airSelPanel button.go{background:#6d7d36;color:#fff;font-weight:bold}#airSelPanel button.on{outline:2px solid #ffe28a}#airSelPanel button:disabled{opacity:.45;cursor:not-allowed}#airSelPanel .why{color:#d9a27c;margin-top:5px}#airSelPanel .hint{color:#b9c096;margin-top:5px}';
document.head.append(style);(document.getElementById('field')||document.body).append(box);
let sig='';
function hide(){box.hidden=true;sig=''}
function render(){
 if(!S.on||!S.sel.length){hide();return}
 const ok=S.sel.filter(a=>!readyWhy(a)),why=S.sel.map(readyWhy).filter(Boolean),ks=common(ok.length?ok:S.sel);
 const a0=S.sel[0],cost=window.IronFrontAirPolicy?.cost||{};
 const s=[S.sel.map(a=>a.id+readyWhy(a)).join(','),S.armed,ks.join(),Math.floor(time*2)].join('|');   /* refaz a cada 0,5 s */
 if(s===sig)return;sig=s;box.hidden=false;box.replaceChildren();
 const h=document.createElement('div');h.innerHTML=S.sel.length>1?`<b>${S.sel.length} aviões selecionados</b>`:`<b>${a0.T.name}</b> · ${a0.sq||''}<br>Piloto: ${a0.pilot?a0.pilot.name:'—'}${a0.pilot&&a0.pilot.kills?` · ${a0.pilot.kills} vitória(s)`:''}`;box.append(h);
 const row=document.createElement('div');row.className='row';
 const def=ks[0],t=def&&autoTarget(def,playerTeam,a0.y);
 const go=document.createElement('button');go.className='go';go.textContent=def?`▲ SUBIR VOO${t?'':' · '+NAME[def]}`:'▲ SUBIR VOO';go.disabled=!ok.length||!def;
 go.onclick=ev=>{ev.stopPropagation();if(t)fire(def,t.x,t.y);else{S.armed=def;sig='';hint(`${NAME[def]}: clique no mapa para escolher o alvo.`)}};row.append(go);
 for(const k of ks){if(k===def&&t)continue;const b=document.createElement('button');b.textContent=`${NAME[k]}${cost[k]?` ◈${cost[k]}`:''}`;b.disabled=!ok.length;if(S.armed===k)b.className='on';
  b.onclick=ev=>{ev.stopPropagation();S.armed=S.armed===k?null:k;sig='';if(S.armed)hint(`${NAME[k]}: clique no mapa para escolher o alvo (clique direito também serve).`)};row.append(b)}
 const x=document.createElement('button');x.textContent='✕';x.title='Desmarcar (Esc)';x.onclick=ev=>{ev.stopPropagation();clear()};row.append(x);box.append(row);
 if(why.length){const w=document.createElement('div');w.className='why';w.textContent='Indisponível: '+[...new Set(why)].join(', ');box.append(w)}
 else if(S.armed){const w=document.createElement('div');w.className='hint';w.textContent=`Missão armada: ${NAME[S.armed]}. Clique no mapa.`;box.append(w)}
 else{const w=document.createElement('div');w.className='hint';w.textContent='Clique direito no mapa para enviar ao alvo.';box.append(w)}
}
function hint(t){try{toast(t)}catch(e){}}
function clear(){S.sel.length=0;S.armed=null;hide()}

/* ---------- ordem ---------- */
function fire(kind,x,y){
 const ok=S.sel.filter(a=>!readyWhy(a));if(!ok.length){S.stats.denied++;hint('Nenhum avião selecionado está pronto: '+(S.sel.map(readyWhy).find(Boolean)||'indisponível')+'.');return null}
 const mine=kinds(ok[0]);if(!mine.includes(kind)){hint(`${ok[0].T.name} não faz ${NAME[kind].toLowerCase()}.`);return null}
 const f=C.request(playerTeam,kind,x,y,{manual:true,pick:ok,n:ok.length,reason:`${NAME[kind]} ordenada pelo comandante`});
 if(!f){S.stats.denied++;hint(C.grounded()?'Sem condições de voo.':window.PXFORT?.isPrep?.()?'Aviação aguarda o início do combate.':'Saída negada: suprimentos, aliados na área do alvo, pista ou limite de aviões no ar.');return null}
 S.stats.orders++;hint(`${NAME[kind]}: ${f.m.length} avião(ões) decolando.`);clear();return f}

/* ---------- entrada do mouse (captura, antes do game.js e do orders.js) ---------- */
function canvasPoint(ev,canvas){const r=canvas.getBoundingClientRect();mouse.x=(ev.clientX-r.left)*vw/r.width;mouse.y=(ev.clientY-r.top)*vh/r.height;worldMouse();return{x:mouse.wx,y:mouse.wy}}
function pick(p){let best=null,bd=1e9;for(const a of A.planes()){if(!parked(a))continue;const R=Math.max(26,(a.T.span||20)/2+10),d=hyp(a.x-p.x,a.y-p.y);if(d<R&&d<bd){bd=d;best=a}}return best}
function install(){
 const canvas=document.getElementById('game');if(!canvas)return;
 window.addEventListener('pointerdown',ev=>{
  if(!S.on||ev.target!==canvas||!started||ended||mode!=='commander'||placement)return;
  try{const p=canvasPoint(ev,canvas);
   if(ev.button===2){if(!S.sel.length)return;const ok=S.sel.filter(a=>!readyWhy(a)),ks=common(ok.length?ok:S.sel),beyond=playerTeam?p.x<front():p.x>front(),k=S.armed||(ks[0]==='cap'&&beyond&&ks.includes('atk')?'atk':ks[0]);   /* direito além da frente: ataque ao solo */if(k)fire(k,clamp(p.x,30,W-30),clamp(p.y,30,GH-30));ev.stopImmediatePropagation();ev.preventDefault();return}
   if(ev.button!==0)return;
   const a=pick(p);S.last={p,cam:[cam.x,cam.y,cam.z],hit:a&&a.id};
   if(a){const i=S.sel.indexOf(a);if(ev.shiftKey){if(i>=0)S.sel.splice(i,1);else S.sel.push(a)}else{S.sel.length=0;S.sel.push(a)}S.armed=null;S.stats.selected++;sig='';if(window.selected)selected.clear();render();ev.stopImmediatePropagation();ev.preventDefault();return}
   if(S.sel.length&&S.armed){fire(S.armed,clamp(p.x,30,W-30),clamp(p.y,30,GH-30));ev.stopImmediatePropagation();ev.preventDefault();return}
   if(S.sel.length&&!ev.shiftKey)clear()
  }catch(e){fail(e)}},true);
 canvas.addEventListener('pointermove',ev=>{if(!S.on||!started||mode!=='commander'||placement)return;try{const p=canvasPoint(ev,canvas);canvas.style.cursor=pick(p)?'pointer':''}catch(e){}});
 window.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&S.sel.length)clear()},true);
}
install();

/* ---------- desenho: anel no avião selecionado ---------- */
if(window.WW1A){const over=WW1A.over;WW1A.over=function(c,ox,oy,dt){const r=over.call(this,c,ox,oy,dt);if(!S.on||!S.sel.length)return r;
 try{const Z=PX.Z||.5;c.save();for(const a of S.sel){if(!live(a))continue;const x=ox+a.x*Z,y=oy+a.y*Z;if(x<-60||x>vw+60||y<-60||y>vh+60)continue;
  const R=Math.max(18,(a.T.span||20)*Z*.62),pulse=.5+.5*Math.sin(time*5);c.strokeStyle=readyWhy(a)?'#d98a6a':'#f4e28a';c.lineWidth=2;c.setLineDash([6,4]);c.lineDashOffset=-time*14;c.beginPath();c.ellipse(x,y,R*1.25,R*.8,0,0,Math.PI*2);c.stroke();c.setLineDash([]);
  c.fillStyle='#f4e28a';c.globalAlpha=.55+.4*pulse;c.beginPath();c.moveTo(x,y-R*.8-4);c.lineTo(x-5,y-R*.8-12);c.lineTo(x+5,y-R*.8-12);c.closePath();c.fill();c.globalAlpha=1}
  c.restore()}catch(e){fail(e)}return r}}

/* ---------- atualização ---------- */
const hud0=window.hud;window.hud=function(...args){const r=hud0.apply(this,args);try{if(S.on){S.sel=S.sel.filter(a=>live(a)&&(a.st==='park'||!S.sel.length));if(S.sel.length&&S.sel.every(a=>a.st!=='park'))clear();if(mode!=='commander'||!started||ended)clear();render()}}catch(e){fail(e)}return r};
const setup0=window.setup;window.setup=function(...args){const r=setup0.apply(this,args);clear();S.stats.selected=S.stats.orders=S.stats.denied=0;return r};
S.state=()=>({on:S.on,sel:S.sel.map(a=>a.id),armed:S.armed,...S.stats});S.pick=pick;S.fire=fire;S.select=list=>{S.sel=list.slice();sig='';render()};S.clear=clear;S.readyWhy=readyWhy;
window.IronFront=window.IronFront||{};window.IronFront.airsel=S;
})();
