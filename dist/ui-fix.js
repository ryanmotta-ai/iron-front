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
  if(!n){info.innerHTML='<span class="idle">Sem seleção: as ordens valem para toda a tropa. Arraste no campo para selecionar.</span>';return}
  const cnt={};let hp=0,mh=0,sup=0,mv=0;for(const u of sel){const k=u.sap?'sapper':u.type;cnt[k]=(cnt[k]||0)+1;hp+=u.hp;mh+=u.maxhp;sup+=u.suppression||0;if(u.moving)mv++}
  const chips=Object.entries(cnt).map(([k,v])=>`<span class="chip"><em>${v}</em>${k==='sapper'?'Engenheiros de Campo':NAMES[k]||k}</span>`).join('');
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

/* ======================================================================================
   Passe de polish 1.9 (U2, U7–U10, U12): canto superior esquerdo, aviso de preparação, renda,
   cartões (atalhos, ícone do Socorro, altura da barra) e Guia de Campo. Só mexe em DOM/estilo e
   envolve window.hud / window.icon; não altera regras do jogo.
   ====================================================================================== */
(function(){
const $=id=>document.getElementById(id),root=document.documentElement;
const IFX=window.IFUIFix={};

/* ---- U2: fieldtop + clima + pílula do tempo em UMA coluna (nunca se sobrepõem); botões de clima só no sandbox (CSS: body[data-run]) ---- */
try{const field=$('field'),ft=document.querySelector('.fieldtop'),wp=$('wxpill'),wb=$('wxbar');
 if(field&&!$('toplefts')){const tl=document.createElement('div');tl.id='toplefts';field.insertBefore(tl,ft||field.firstChild);[ft,wp,wb].forEach(n=>{if(n)tl.appendChild(n)})}}catch(e){console.error('ui-fix toplefts',e)}

/* ---- U7: aviso de preparação abaixo dos marcadores A/B/C e toast abaixo do aviso ---- */
setInterval(()=>{try{const b=$('prepbanner'),t=$('toast'),o=$('objectives');if(!t)return;
 if(b&&b.style.display!=='none'&&o){let top=Math.round(o.getBoundingClientRect().bottom+6);const bh=b.getBoundingClientRect().height,bl=b.getBoundingClientRect();
  /* se o canto superior esquerdo (tempo, clima) chegar até o aviso, ele desce abaixo desses blocos */
  for(let k=0;k<4;k++){let hit=null;for(const e of document.querySelectorAll('#toplefts>*')){const r=e.getBoundingClientRect();if(r.width<2||r.height<2||getComputedStyle(e).display==='none')continue;
    if(r.left<bl.right&&r.right>bl.left&&r.top<top+bh&&r.bottom>top)hit=r}
   if(!hit)break;top=Math.round(hit.bottom+6)}
  if(b.style.top!==top+'px')b.style.top=top+'px';
  t.style.top=Math.round(top+bh+6)+'px'}
 else if(t.style.top)t.style.top=''}catch(e){}},100);

/* ---- U9: renda curta ("+12/s"), igual ao painel da IA; o texto longo estourava o painel de suprimentos ---- */
IFX.shortIncome=s=>String(s).replace(/ por segundo$/,'/s');
const hud0=window.hud;
if(typeof hud0==='function')window.hud=function(){const r=hud0.apply(this,arguments);try{const i=$('income');if(i){const t=IFX.shortIncome(i.textContent);if(t!==i.textContent)i.textContent=t}}catch(e){}return r};

/* ---- U10: ícone do cartão Socorro (a obra "aid" não tinha base de ícone em fortify.js) ---- */
const icon0=window.icon;
if(typeof icon0==='function')window.icon=function(type,c){
 if(type!=='aid')return icon0.apply(this,arguments);
 const k=c.canvas.width/48,p=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(Math.round(x*k),Math.round(y*k),Math.max(1,Math.round(w*k)),Math.max(1,Math.round(h*k)))};
 c.clearRect(0,0,c.canvas.width,c.canvas.height);
 p(7,38,34,4,'rgba(0,0,0,.35)');                                   // sombra
 for(let i=0;i<9;i++)p(12+i*2,15+i,24-i*4,1,i%2?'#b9b28a':'#cfc8a0'); // telhado da tenda (degraus)
 p(10,24,28,15,'#cfc8a0');p(10,24,28,2,'#e4ddb8');p(10,37,28,2,'#8f8966');   // paredes de lona
 p(20,29,8,10,'#2a2a20');p(21,30,6,9,'#14140f');                    // porta
 p(8,24,2,15,'#6b5a36');p(38,24,2,15,'#6b5a36');                    // mastros
 p(19,14,10,10,'#14140f');p(20,15,8,8,'#f2efe4');p(23,16,2,6,'#c0302a');p(21,18,6,2,'#c0302a'); // painel com a cruz vermelha
 p(35,31,6,8,'#6a6e60');p(36,32,4,2,'#f2efe4');p(37,32,2,6,'#c0302a')};     // maca encostada

/* ---- U10: atalhos dos cartões sem tecla (⇧1…⇧9, por e.code: Shift+6 vira 'Dead' no ABNT2), dica no cartão, altura real da barra ---- */
const cards=$('cards');
function tagCards(){let n=0;cards.querySelectorAll('.card').forEach(c=>{const b=c.querySelector('b'),s=c.querySelector('small'),k=c.querySelector('kbd');
  c.title=(b?b.textContent:'')+(s&&s.textContent?' · '+s.textContent:'');
  if(k)return;if(++n>9)return;const x=document.createElement('kbd');x.className='kx';x.dataset.n=String(n);x.textContent='⇧'+n;c.appendChild(x)})}
if(cards){let q=0;new MutationObserver(()=>{if(q)return;q=1;queueMicrotask(()=>{q=0;try{tagCards()}catch(e){}})}).observe(cards,{childList:true});try{tagCards()}catch(e){}}
addEventListener('keydown',e=>{if(!e.shiftKey||e.ctrlKey||e.altKey||e.metaKey||e.repeat)return;const m=/^Digit([1-9])$/.exec(e.code||'');if(!m)return;
 if(typeof mode==='undefined'||mode!=='commander'||typeof started==='undefined'||!started||ended||document.querySelector('dialog[open]'))return;
 const k=document.querySelector('#cards .card kbd.kx[data-n="'+m[1]+'"]');if(k){e.preventDefault();e.stopImmediatePropagation();k.parentNode.click()}},true);
try{const hb=$('hotbar'),set=()=>root.style.setProperty('--hbh',(hb.getBoundingClientRect().height||0)+'px');new ResizeObserver(set).observe(hb);set()}catch(e){}

/* ---- U12: Guia de Campo (o HTML estático do index.html está desatualizado; é substituído aqui) ---- */
const K=(...a)=>'<b>'+a.map(x=>'<kbd>'+x+'</kbd>').join('')+'</b>';
const L=(keys,txt)=>'<li>'+keys+'<span>'+txt+'</span></li>';
const SUB=t=>'<b class="sub" style="display:block">'+t+'</b>';
IFX.guideHTML=[
'<section><h3>Comandante</h3><ul class="keylist">',
 L(K('ARRASTAR'),'seleciona tropas da sua facção.'),
 L(K('CLIQUE DIR.'),'move ou ataca com a seleção.'),
 L(K('WASD'),'câmera (as bordas da tela também). <kbd>RODA</kbd> ou <kbd>+</kbd> <kbd>-</kbd> dão zoom.'),
 L(K('F','C'),'formar linha ou coluna. Sem seleção, vale para todo o exército (como Avançar, Defender e Recuar).'),
 L(K('V'),'ataque geral: pistola Very e apitos, os pelotões saem da trincheira. <kbd>SHIFT+V</kbd> acrescenta cortina de fumaça. Recarga de 90 s; não vale durante a preparação.'),
 L(K('B'),'ordem de campo para os engenheiros de campo: trincheira de ligação (arraste), ninho de MG ou posto de morteiro (clique). B troca, ESC cancela.'),
 L(K('T'),'troca a munição das baterias: alto-explosivo, shrapnel ou fumaça.'),
 L(K('P'),'pronto: encerra a preparação em 3 s.'),
 L(K('H'),'painel do quartel-general (ordem de batalha e suprimento inimigo).'),
 L(K('TAB'),'vira soldado. <kbd>ESPAÇO</kbd> pausa, <kbd>ESC</kbd> cancela ou abre o menu.'),
'</ul></section>',
'<section><h3>Soldado</h3><ul class="keylist">',
 L(K('WASD'),'move. O mouse mira, o clique atira. <kbd>BOTÃO DIR.</kbd> ou <kbd>SHIFT</kbd> fazem mira focada (a câmera avança na direção da mira).'),
 L(K('1','2','3','4'),'fuzil, arma automática (fuzil automático ou submetralhadora), pistola e Winchester 1897 (escopeta). EUA: Springfield M1903, BAR M1918, Colt M1911. Alemanha: Gewehr 98, MP 18, Luger P08.'),
 L(K('R','G'),'recarrega; lança uma granada (o fuzileiro comum leva 2; a quantidade varia com a classe). Com alarme de gás, G põe a máscara; <kbd>M</kbd> a coloca ou tira.'),
 L(K('Z'),'deita ou levanta: menos exposto, mas rasteja.'),
 L(K('Q'),'golpe corpo a corpo (0,8 s entre golpes).'),
 L(K('X'),'carga de baioneta: só com o fuzil, 2,2 s de corrida e 10 s de recarga.'),
 L(K('H'),'<i>segure parado</i>: curativo de campo em 2,2 s, +35 de vida. São 2 curativos, com 30 s entre eles.'),
 L(K('T'),'apito (25 s de recarga): quem está a até 260 px sai da supressão, ganha +30% de velocidade por 6 s e avança.'),
 L(K('F'),'ordem na mira para o esquadrão mais próximo: fogo de supressão contra MG ou bunker inimigo, guarnecer trincheira própria ou avançar em chão aberto.'),
 L(K('E'),'uma ação por vez; a dica <kbd>[E]</kbd> sobre o alvo e na linha de dicas diz qual: socorrer ou arrastar ferido, assumir a MG, descer ao abrigo, saquear cadáver, assumir o canhão ou o tanque aliado.'),
'</ul></section>',
'<section><h3>Socorro, MG e abrigo</h3>',
'<p>'+SUB('Feridos')+'O ferido grave fica imóvel e chama por socorro; o leve rasteja até a cobertura; o crítico perde a consciência. <kbd>E</kbd> perto de um aliado caído agarra e arrasta: você anda a 40% e não atira. <kbd>E</kbd> de novo solta. Perto de um posto, a entrega é automática. Médico (braçadeira da Cruz Vermelha): <kbd>E</kbd> faz primeiros socorros, 4,5 s parado.</p>',
'<p>Cadeia médica: campo, posto avançado (obra Socorro), ambulância e hospital de campanha. O relatório final conta resgatados, evacuados e baixas por ferimento.</p>',
'<p>Se você cair, <kbd>E</kbd> pede socorro; passados 3 s você pode assumir outro combatente.</p>',
'<p>'+SUB('Metralhadora')+'<kbd>E</kbd> a até 26 px de uma MG aliada assume a arma: fita de 250 tiros, recarga de 6,5 s, no tripé (não anda). <kbd>E</kbd> devolve o seu soldado.</p>',
'<p>'+SUB('Abrigo e bunker')+'<kbd>E</kbd> na entrada de um abrigo aliado desce ou sobe. Sob barragem a infantaria se abriga sozinha (até 4 homens, que recebem 8% do dano). Num bunker, a MG só dispara com guarnição dentro.</p>',
'<p>'+SUB('Sob fogo')+'Tiros que passam perto suprimem: a mira treme e se abre, a visão balança. Abaixe-se (<kbd>Z</kbd>) ou procure cobertura. Em água funda não dá para atirar.</p>',
'</section>',
'<section><h3>Construção &amp; apoio</h3>',
'<p>Cartões da barra inferior: as teclas <kbd>1</kbd> a <kbd>0</kbd> escolhem os dez primeiros; cartões sem tecla mostram <kbd>⇧1</kbd>, <kbd>⇧2</kbd>… (Shift mais o número). Tropas nascem no seu território. Defesas só perto das suas tropas. <kbd>ESC</kbd> cancela.</p>',
'<p>'+SUB('Tropas')+'Fuzileiros, metralhadoras, tanque, cavalaria, engenheiros de campo (obras, <kbd>5</kbd>), tropas de assalto (<kbd>7</kbd>) e seção de especialistas (<kbd>8</kbd>: médico, granadeiro, atirador designado e observador de artilharia).</p>',
'<p>'+SUB('Defesas')+'Cada cartão é uma obra: os engenheiros de campo constroem. Trincheira, ligação, arame e sacos de areia se arrastam em linha; ninho de MG, bunker, casamata, abrigo, posto de socorro e peças de artilharia se clicam no lugar.</p>',
'<p>'+SUB('Preparação')+'As operações começam com 300 s de trégua e uma barreira no centro. Construa à vontade, use PLANO AUTOMÁTICO ou <kbd>P</kbd>. Cerca de 40 s antes do apito a tropa larga as pás e ocupa as posições.</p>',
'<p>'+SUB('Artilharia e ar')+'As baterias da retaguarda disparam de verdade (o projétil leva 2 a 4 s); o morteiro mostra o obus em voo. <kbd>T</kbd> troca a munição; soldado perto da peça aliada assume o canhão com <kbd>E</kbd>: WASD move o retículo, clique dispara, 1/2/3 escolhem HE, shrapnel ou fumaça. Bombardeios e caças atingem a área marcada depois de alguns segundos; há fogo amigo. Observador e avião de reconhecimento reduzem a dispersão.</p>',
'</section>',
'<section><h3>Vitória &amp; painéis</h3>',
'<p>As duas bandeiras ficam na retaguarda: EUA à esquerda e Alemanha à direita. Proteja sua base e capture a inimiga mantendo mais combatentes próximos. Na Conquista, controlar as duas bases vence a operação; perder todos os reforços também causa derrota. Cada base controlada rende 4 suprimentos por segundo.</p>',
'<p>O botão de IA liga ou desliga cada comandante. A IA prioriza alvos perigosos, busca abrigo, reúne soldados, ocupa trincheiras, faz reconhecimento e responde a invasões. O painel do quartel-general (<kbd>H</kbd>) mostra o suprimento inimigo e a ordem de batalha.</p>',
'</section>'].join('');
IFX.keysLine='WASD mover · TAB trocar modo · Mouse mirar · 1–4 armas<br>R recarregar · G granada · Z deitar · X baioneta · E interagir (veja o Guia de Campo)';
try{const g=document.querySelector('#guide .guidegrid');if(g)g.innerHTML=IFX.guideHTML;const kl=document.querySelector('#v-sandbox .keys');if(kl)kl.innerHTML=IFX.keysLine}catch(e){console.error('ui-fix guia',e)}
})();
