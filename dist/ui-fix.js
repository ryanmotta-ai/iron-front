'use strict';
/* ui-fix: painel de tropas, botões de clima, sem pausa automática, bandeiras. Camada leve por cima do ui.js (não edita os outros arquivos). */
(function(){
const $=id=>document.getElementById(id);
/* 1) o jogo não pausa mais sozinho ao perder o foco/aba */
window.addEventListener('blur',e=>e.stopImmediatePropagation(),true);
document.addEventListener('visibilitychange',e=>e.stopImmediatePropagation(),true);
/* sem tremor de tela: zera o screenShake antes de cada quadro */
const r0=window.render;if(typeof r0==='function')window.render=function(...a){screenShake=0;return r0.apply(this,a)};
/* 2) painel de tropas */
const orders=$('orders');
if(orders){const info=document.createElement('div');info.id='selinfo';info.className='empty';orders.insertBefore(info,orders.querySelector('.ord'));
 const NAMES={rifle:'Fuzileiros',mg:'Metralhadoras',tank:'Tanques',cavalry:'Cavalaria'};
 setInterval(()=>{try{
  const sel=units.filter(u=>selected.has(u.id)&&u.hp>0),n=sel.length;info.classList.toggle('empty',!n);
  if(!n){info.innerHTML='<div class="big"><b>0</b><span>SELECIONADAS</span></div><span>Arraste no campo para selecionar tropas</span>';return}
  const cnt={};let hp=0,mh=0,sup=0,mv=0;for(const u of sel){const k=u.sap?'sapper':u.type;cnt[k]=(cnt[k]||0)+1;hp+=u.hp;mh+=u.maxhp;sup+=u.suppression||0;if(u.moving)mv++}
  const chips=Object.entries(cnt).map(([k,v])=>`<span class="chip"><em>${v}</em>${k==='sapper'?'Pioneiros':NAMES[k]||k}</span>`).join('');
  const f=Math.max(0,Math.min(1,hp/mh)),col=f>.5?'#b8d68b':f>.25?'#e3c463':'#e0705a',sp=sup/n;
  info.innerHTML=`<div class="big"><b>${n}</b><span>${n>1?'SELECIONADAS':'SELECIONADA'}</span></div><div class="chips">${chips}</div><div class="row"><span>VIDA</span><span>${Math.round(f*100)}%</span></div><div class="bar"><i style="width:${f*100}%;background:${col}"></i></div><div class="row"><span>${mv?'EM MARCHA '+mv:'PARADAS'}</span><span>${sp>.8?'SOB FOGO PESADO':sp>.3?'SOB FOGO':'FIRMES'}</span></div>`;
 }catch(e){}},250);
 const s=$('selected');if(s)s.style.display='none'}
/* 3) clima por botões */
const wx=document.createElement('div');wx.id='wxbar';
const KINDS=[['dyn','DINÂMICO'],['clear','LIMPO'],['drizzle','GAROA'],['rain','CHUVA'],['storm','TEMPESTADE']];
wx.innerHTML='<div class="wxb">'+KINDS.map(([k,l])=>`<button data-k="${k}">${l}</button>`).join('')+'</div><div class="wxs" id="wxs"></div>';
const field=$('field')||document.body;field.appendChild(wx);
wx.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!window.PXW)return;const k=b.dataset.k,st=PXW.state;
 if(k==='dyn'){st.fixed=null;st.until=0}else PXW.setKind(k);e.stopPropagation()});
const wtxt=$('weather');
setInterval(()=>{try{const st=window.PXW&&PXW.state;if(!st)return;const cur=st.fixed||'dyn';wx.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.k===cur));$('wxs').textContent=wtxt?wtxt.textContent:''}catch(e){}},300);
/* 4) bandeiras no placar */
function flag(team){const c=document.createElement('canvas');c.width=15;c.height=9;c.className='flag';const g=c.getContext('2d');
 for(let x=0;x<15;x++)for(let y=0;y<9;y++){let col;
  if(team===0){if(x<6&&y<5)col=(y===1&&x%2===1)||(y===3&&x%2===0&&x>0&&x<5)?'#f4f4f0':'#2b3f86';else col=y%2===0?'#b22234':'#f4f4f0'}
  else col=y<3?'#1d1d1d':y<6?'#eeeee6':'#c4271c';
  g.fillStyle=col;g.fillRect(x,y,1,1)}return c}
for(const[sel,t]of[['.team.blue',0],['.team.red',1]]){const el=document.querySelector(sel);if(!el||el.querySelector('canvas.flag'))continue;const f=flag(t);if(t===0)el.insertBefore(f,el.firstChild);else el.appendChild(f)}
/* obras mais rápidas: x1,7 na campanha e x3,2 no sandbox (multiplicador extra, independente do WORKX do fortify.js) */
setInterval(()=>{try{if(window.PXSAP&&PXSAP.cfg)PXSAP.cfg.BUILDX=sandbox?7:1.7}catch(e){}},500);
})();

/* ===== papéis (ataque/defesa) + sandbox em cartões ===== */
(function(){
const $=id=>document.getElementById(id);
const NAMES=['EUA','Alemanha'];
/* seletor de papéis dentro do formulário do sandbox */
const form=document.querySelector('#v-sandbox .menuform');
if(form&&!$('rolesel')){const l=document.createElement('label');l.innerHTML='PAPÉIS NA BATALHA<select id="rolesel"><option value="auto" selected>Sorteio a cada partida</option><option value="a0">EUA atacam · Alemanha defende</option><option value="a1">Alemanha ataca · EUA defendem</option><option value="both">Os dois lados atacam</option></select>';form.appendChild(l)}
function pickRoles(){const m=($('rolesel')||{}).value||'auto';let a;if(m==='both')return['both','both'];a=m==='a0'?0:m==='a1'?1:(Math.random()<.5?0:1);const r=['defend','defend'];r[a]='attack';return r}
const s0=window.setup;
window.setup=function(...a){const r=s0.apply(this,a);try{const roles=pickRoles();window.ROLES=roles;if(window.IronFrontBrain&&IronFrontBrain.setRoles)IronFrontBrain.setRoles(roles);
  if(a[0]!==true&&roles[0]!==roles[1]&&window.toast){const atk=roles[0]==='attack'?0:1;setTimeout(()=>toast(atk===0?'EUA atacam · Alemanha defende':'Alemanha ataca · EUA defendem'),600)}
  }catch(e){}return r};
/* defensor: 18% menos dano (trincheiras, arame e moral) */
const d0=window.damage;if(typeof d0==='function')window.damage=function(u,n,att){if(window.ROLES&&u&&u.type!=='tank'&&ROLES[u.team]==='defend')n*=.82;return d0.call(this,u,n,att)};
/* sandbox: cada select vira um grupo de botões */
if(form){const SEC=[['CAMPO DE BATALHA',['mapselect','gametype']],['EXÉRCITOS',['scale','playerside','difficulty']],['COMANDO',['blueai','redai','rolesel']]];
 const box=document.createElement('div');box.className='sbform';
 for(const[title,ids]of SEC){const sec=document.createElement('section');sec.className='sbsec';sec.innerHTML=`<h4>${title}</h4>`;
  for(const id of ids){const sel=$(id);if(!sel)continue;const lab=sel.parentNode,cap=lab.firstChild.textContent.trim();const g=document.createElement('div');g.className='sbgroup';g.innerHTML=`<span class="sbcap">${cap}</span><div class="sbopts"></div>`;const wrap=g.querySelector('.sbopts');
   const sync=()=>wrap.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v===sel.value));
   for(const o of sel.options){const [m,sub]=o.textContent.split(' · ');const b=document.createElement('button');b.type='button';b.dataset.v=o.value;b.innerHTML=`<b>${m}</b>${sub?`<small>${sub}</small>`:''}`;b.onclick=()=>{sel.value=o.value;sel.dispatchEvent(new Event('change',{bubbles:true}));sync()};wrap.appendChild(b)}
   sel.style.display='none';lab.style.display='none';g.appendChild(lab);sec.appendChild(g);sel.addEventListener('change',sync);sync();setInterval(sync,800)}
  box.appendChild(sec)}
 form.parentNode.insertBefore(box,form)}
})();

/* soldado parado e sem alvo olha para o lado do inimigo (antes ficava de costas, na última direção em que andou) */
(function(){
const u0=window.update;if(typeof u0!=='function')return;
window.update=function(dt){const r=u0.apply(this,arguments);try{for(const u of units){if(u.hp<=0||u.moving||u.target||u.type==='tank'||u===player||u.sapState==='dig'||u.thr>0)continue;
  const want=u.team?Math.PI:0;let d=want-(u.angle||0);d=Math.atan2(Math.sin(d),Math.cos(d));u.angle=(u.angle||0)+d*Math.min(1,dt*6)}}catch(e){}return r}
})();
