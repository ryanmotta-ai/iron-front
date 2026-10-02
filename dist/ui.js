'use strict';
/* Iron Front 1.0 — camada de interface. Carrega por último e NÃO altera a lógica de jogo: envolve
   setMode / finish / render / update e sobrescreve handlers de botões para montar a tela inicial,
   a campanha, o modo história, o sandbox, as opções e o menu de pausa. */
(function(){
const $=id=>document.getElementById(id),A=UIArt,root=document.documentElement,body=document.body;
const DIFF={easy:'Recruta',normal:'Veterano',hard:'General'},WX={overcast:'Nublado',dynamic:'Variável',clear:'Limpo',drizzle:'Garoa',rain:'Chuva',storm:'Tempestade',fog:'Neblina'},MAPN={trenches:'A última trincheira',forest:'Floresta de ferro',winter:'Inverno sem fim'};

/* ================= progresso e opções ================= */
const KEY='ironfront.save.v1',DEF={campaign:{done:{}},story:{done:0},opts:{sound:0,ui:1,hints:1,mini:1,shake:1}};
function load(){try{const s=JSON.parse(localStorage.getItem(KEY)||'null')||{};return{campaign:{done:Object.assign({},s.campaign&&s.campaign.done)},story:{done:+(s.story&&s.story.done)||0},opts:Object.assign({},DEF.opts,s.opts)}}catch{return JSON.parse(JSON.stringify(DEF))}}
let save=load();const store=()=>{try{localStorage.setItem(KEY,JSON.stringify(save))}catch{}};

/* ================= conteúdo: campanha e história ================= */
const OPS=[
 {id:'c1',name:'Amanhecer no arame',map:'trenches',thumb:'trenches',scale:80,diff:'easy',wx:'clear',side:0,txt:'Primeiro contato com a linha alemã. O arame farpado ainda está intacto e a artilharia inimiga é rara. Rompa as linhas e capture a bandeira na base alemã, protegendo sua retaguarda.'},
 {id:'c2',name:'Chuva de ferro',map:'trenches',thumb:'rain',scale:160,diff:'normal',wx:'rain',side:0,txt:'A chuva encharca as trincheiras e atola os reforços. Quem segurar o terreno alto mantém a logística. Cuidado com as crateras alagadas.'},
 {id:'c3',name:'Neblina na mata',map:'forest',thumb:'forest',scale:160,diff:'normal',wx:'overcast',side:0,txt:'A neblina esconde tudo além de poucas dezenas de metros. A floresta oferece cobertura, mas também emboscadas. Use metralhadoras nas clareiras.'},
 {id:'c4',name:'Noite de trovões',map:'forest',thumb:'storm',scale:160,diff:'hard',wx:'storm',side:0,txt:'Tempestade sobre a floresta. Raios atingem tanques e aviões ficam em solo. O comandante inimigo é um general: não espere piedade.'},
 {id:'c5',name:'Nevasca do norte',map:'winter',thumb:'winter',scale:160,diff:'normal',wx:'dynamic',side:0,txt:'Nevascas e neblina gelada no extremo norte da frente. O tempo muda sem aviso; acompanhe a previsão no canto da tela.'},
 {id:'c6',name:'A grande ofensiva',map:'trenches',thumb:'trenches',scale:320,diff:'hard',wx:'dynamic',side:0,txt:'A maior batalha da frente. Mais de trezentos homens de cada lado e um general do outro lado. Tudo o que você aprendeu vale agora.'}];
const CH=[
 {id:'s1',name:'Primeira noite',map:'trenches',scale:80,diff:'easy',wx:'clear',side:0,mode:'soldier',pt:'us',
  txt:'"17 de abril. Chegamos ao anoitecer, eu e mais sete do pelotão. O sargento disse que a trincheira fica a meia hora de marcha, mas a lama tornou tudo mais longo.\n\nPrecisamos tomar as três posições antes do amanhecer. Fico na linha, fuzil na mão. Se eu cair, outro assume o meu lugar."',
  goals:['Capture a bandeira na base alemã','Você começa como soldado · TAB volta ao comando'],epi:'Amanhecer. A bandeira inimiga caiu. Nossa base resistiu. Escrevi à minha mãe que estou bem.'},
 {id:'s2',name:'Cartas para casa',map:'trenches',scale:80,diff:'normal',wx:'drizzle',side:0,mode:'commander',pt:'cap',
  txt:'"O capitão me promoveu a sargento depois da última noite. Agora quem decide onde cada esquadrão cava sou eu.\n\nGaroa fina desde cedo. Dê ordens, construa defesas e compre reforços quando o caixa permitir. O inimigo já sabe onde estamos."',
  goals:['Comande o pelotão a partir do mapa','Use AVANÇAR, DEFENDER e as formações (F / C)'],epi:'Seguramos o setor. Mandei uma carta longa, dessas que não falam de medo.'},
 {id:'s3',name:'Lama',map:'trenches',scale:160,diff:'normal',wx:'rain',side:0,mode:'commander',pt:'us',
  txt:'"Três dias de chuva. A água subiu até o joelho nas trincheiras de comunicação e os reforços chegam atolados.\n\nAgora a batalha é grande: cento e sessenta homens de cada lado. Mantenha a linha e não deixe o arame cair."',
  goals:['Resista e capture os pontos com chuva forte','Observe o alagamento e a logística no canto'],epi:'A lama engoliu botas e ferramentas, mas ninguém recuou.'},
 {id:'s4',name:'A floresta fecha',map:'forest',scale:160,diff:'normal',wx:'overcast',side:0,mode:'soldier',pt:'us',
  txt:'"Mandaram-nos pela floresta. A neblina cobre tudo e a gente só enxerga o que está a dez passos.\n\nFico com o fuzil novamente. Dizem que há tanques alemães perto da estrada. Se ouvir o motor, avise."',
  goals:['Avance na floresta com visibilidade reduzida','Tanques aliados podem ser assumidos com E'],epi:'Saímos da mata com menos gente, mas com o caminho aberto.'},
 {id:'s5',name:'Do outro lado',map:'winter',scale:160,diff:'normal',wx:'dynamic',side:1,mode:'commander',pt:'de',
  txt:'"Inverno. Desta vez acordei do outro lado da terra de ninguém: cabo Weber, Império Alemão, mesma lama, mesmo frio, outra bandeira.\n\nO homem do outro lado da trincheira também escreve cartas para casa. É o que a guerra nos deixa de igual."',
  goals:['Comande o Império Alemão no inverno','Capture a bandeira na base dos EUA'],epi:'Fim da campanha. Duas bandeiras, a mesma lama. Que este inverno seja o último.'}];

/* ================= estado da execução ================= */
let run=null,wasRunning=false,hintTimer=0,mmLast='';
const inBattle=()=>body.dataset.screen==='battle';
const dlgOpen=()=>!!document.querySelector('dialog[open]');
const snd=k=>{try{if(soundOn&&typeof sound==='function')sound(k)}catch{}};

/* ================= ícones e escala ================= */
function paintIcons(el){(el||document).querySelectorAll('[data-ico]').forEach(n=>n.style.setProperty('--ico',`url(${A.iconURL(n.dataset.ico)})`))}
function setIcon(n,name){n.dataset.ico=name;n.style.setProperty('--ico',`url(${A.iconURL(name)})`)}
function applyOpts(){
 const o=save.opts;root.style.setProperty('--ui',o.ui);body.classList.toggle('nohints',!+o.hints);body.classList.toggle('nomini',!+o.mini);
 const big=innerHeight>=900||+o.ui>=1.5;root.style.setProperty('--mmw',(big?256:128)+'px');
 document.querySelectorAll('#optionsDlg .seg[data-opt]').forEach(s=>{const v=String(o[s.dataset.opt]);s.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.v===v||(+b.dataset.v===+v)))});
 const so=soundOn?'sndon':'sndoff';setIcon($('sound'),so);setIcon($('title-sound'),so);
 const done=Object.keys(save.campaign.done).length;$('save-info').textContent=`Campanha ${done}/${OPS.length} · História ${save.story.done}/${CH.length}`;
 $('sub-campaign').textContent=done?`${done} de ${OPS.length} concluídas`:`${OPS.length} operações`;
 $('sub-story').textContent=save.story.done>=CH.length?'Campanha encerrada':save.story.done?`Capítulo ${save.story.done+1} de ${CH.length}`:`${CH.length} capítulos`}
function setSound(on){soundOn=!!on;save.opts.sound=on?1:0;store();if(on){try{soundInit()}catch{};snd('click')}applyOpts()}
function toggleFS(){try{if(document.fullscreenElement)document.exitFullscreen();else root.requestFullscreen()}catch{}}

/* ================= tela inicial ================= */
let logo=null,logoTimer=0;
let logoS=0;
function buildLogo(){
 const s=innerHeight<620?3:4;if(s===logoS)return;logoS=s;
 const L=A.buildLogo(2,s);logo=L;const c=$('logo');c.width=L.w;c.height=L.h;c.style.width=`calc(${L.w} * var(--k))`;c.style.height=`calc(${L.h} * var(--k))`;
 $('title').style.setProperty('--menuTop',`calc(${5+L.h+8} * var(--k))`);
 clearInterval(logoTimer);let t=0;const g=c.getContext('2d');logoTimer=setInterval(()=>{if(body.dataset.screen!=='title')return;t+=.09;L.draw(t);g.clearRect(0,0,L.w,L.h);g.drawImage(L.canvas,0,0)},90);L.draw(0);g.drawImage(L.canvas,0,0)}
addEventListener('resize',()=>buildLogo());
function showTitle(view='main'){
 body.dataset.screen='title';$('title').dataset.view='main';try{IFTitle.start($('scene'))}catch(e){console.error(e)}
 applyOpts();go(view)}
function go(view){
 $('title').dataset.view=view;
 if(view==='campaign')renderCampaign();else if(view==='story')renderStory();else if(view==='sandbox'){}
 setTimeout(()=>{const first=view==='main'?document.querySelector('#mainmenu .mbtn'):view==='campaign'?document.querySelector('#opgrid .op.sel')||document.querySelector('#opgrid .op:not(.locked)'):view==='story'?document.querySelector('#chlist button.sel'):$('start');if(first&&!dlgOpen())first.focus({preventScroll:true})},30)}

/* ---- campanha ---- */
let selOp=0;
const unlocked=i=>i===0||!!save.campaign.done[OPS[i-1].id];
function renderCampaign(){
 const first=OPS.findIndex((o,i)=>!save.campaign.done[o.id]&&unlocked(i));if(!(selOp>=0)||!unlocked(selOp))selOp=first<0?0:first;
 if(!renderCampaign.init){renderCampaign.init=true;selOp=first<0?0:first}
 const g=$('opgrid');g.replaceChildren();
 OPS.forEach((o,i)=>{const b=document.createElement('button'),done=!!save.campaign.done[o.id],lock=!unlocked(i);
  b.className='op'+(lock?' locked':'')+(done?' done':'')+(i===selOp?' sel':'');b.dataset.i=i;
  const cv=A.mapThumb(o.thumb,96,56,i+3);const skull=n=>Array.from({length:3},(_,k)=>`<span class="ico" style="--ico:url(${A.iconURL(k<n?'skull':'crate')});opacity:${k<n?1:.18}"></span>`).join('');
  b.innerHTML=`<span class="n"><span>OPERAÇÃO ${String(i+1).padStart(2,'0')}</span><span class="ico" style="--ico:url(${A.iconURL(lock?'lock':done?'check':'star')})"></span></span>`;
  cv.removeAttribute('style');b.insertBefore(cv,b.firstChild);
  const t=document.createElement('span');t.className='t';t.textContent=o.name;b.append(t);
  const sk=document.createElement('span');sk.className='sk';sk.innerHTML=skull({easy:1,normal:2,hard:3}[o.diff]);b.append(sk);
  b.onclick=()=>{if(lock){snd('click');return}selOp=i;renderCampaign();snd('click')};
  b.ondblclick=()=>{if(!lock){selOp=i;startOp(i)}};
  g.append(b)});
 const o=OPS[selOp],done=save.campaign.done[o.id];
 $('opinfo').innerHTML=`<div><span class="eyebrow">OPERAÇÃO ${String(selOp+1).padStart(2,'0')} DE ${OPS.length}</span><h3>${o.name}</h3><p>${o.txt}</p><div class="chips"><span class="chip">MAPA <b>${MAPN[o.map]}</b></span><span class="chip">CLIMA <b>${WX[o.wx]}</b></span><span class="chip">ESCALA <b>${o.scale}</b></span><span class="chip">INIMIGO <b>${DIFF[o.diff]}</b></span><span class="chip">VOCÊ <b>${o.side?'Alemanha':'EUA'}</b></span></div></div><div class="go"><small>${done?`CONCLUÍDA · ${done.time} · ${done.kills} BAIXAS INIMIGAS`:'Conquista: proteja sua base e capture a bandeira inimiga'}</small><button class="primary" id="op-go">${done?'JOGAR DE NOVO':'INICIAR OPERAÇÃO'} <span>▶</span></button></div>`;
 $('op-go').onclick=()=>startOp(selOp)}
function startOp(i){const o=OPS[i];run={kind:'campaign',idx:i,cfg:{map:o.map,type:'conquest',scale:o.scale,diff:o.diff,wx:o.wx,side:o.side,mode:'commander'}};launch(run.cfg)}

/* ---- história ---- */
let selCh=0,typeT=0;
const chUnlocked=i=>i<=save.story.done;
function renderStory(){
 if(!renderStory.init){renderStory.init=true;selCh=Math.min(save.story.done,CH.length-1)}
 const l=$('chlist');l.replaceChildren();
 CH.forEach((c,i)=>{const li=document.createElement('li'),b=document.createElement('button'),lock=!chUnlocked(i),done=i<save.story.done;
  b.className=(i===selCh?'sel':'')+(lock?' locked':'');b.innerHTML=`<span class="num">${i+1}</span><span class="ct">${c.name}<small>${done?'CONCLUÍDO':lock?'BLOQUEADO':'DISPONÍVEL'}</small></span><span class="ico" style="--ico:url(${A.iconURL(lock?'lock':done?'check':'star')})"></span>`;
  b.onclick=()=>{if(lock){snd('click');return}selCh=i;renderStory();snd('click')};li.append(b);l.append(li)});
 const c=CH[selCh];$('brief-eb').textContent=`CAPÍTULO ${selCh+1} DE ${CH.length}`;$('brief-title').textContent=c.name;
 $('brief-meta').textContent=`${MAPN[c.map]} · ${WX[c.wx]} · ${DIFF[c.diff]} · ${c.side?'Alemanha':'EUA'} · ${c.mode==='soldier'?'Começa como soldado':'Começa no comando'}`;
 const pc=$('portrait').getContext('2d');pc.imageSmoothingEnabled=false;pc.clearRect(0,0,32,32);pc.drawImage(A.portrait(c.pt),0,0);
 $('brief-goals').innerHTML=c.goals.map(g=>`<li>${g}</li>`).join('');
 const p=$('brief-text');clearInterval(typeT);p.textContent='';p.classList.add('writing');let n=0;const full=c.txt;
 typeT=setInterval(()=>{n+=2;p.textContent=full.slice(0,n);if(n>=full.length){clearInterval(typeT);p.classList.remove('writing')}},24);
 p.onclick=()=>{clearInterval(typeT);p.textContent=full;p.classList.remove('writing')};
 $('brief-go').onclick=()=>startCh(selCh)}
function startCh(i){const c=CH[i];run={kind:'story',idx:i,cfg:{map:c.map,type:'conquest',scale:c.scale,diff:c.diff,wx:c.wx,side:c.side,mode:c.mode}};launch(run.cfg)}

/* ================= entrada e saída da batalha ================= */
function setForm(cfg){
 $('mapselect').value=cfg.map;$('gametype').value=cfg.type;$('scale').value=cfg.scale;$('difficulty').value=cfg.diff;$('playerside').value=String(cfg.side);
 $('blueai').value=cfg.side===0?'off':'on';$('redai').value=cfg.side===0?'on':'off';const w=$('weathersel');if(w)w.value=cfg.wx}
function launch(cfg){
 setForm(cfg);enterBattle();
 if(cfg.mode==='soldier'){try{setMode('soldier',false)}catch{}}
 toast(run&&run.kind==='story'?`Capítulo ${run.idx+1}: ${CH[run.idx].name}`:run&&run.kind==='campaign'?`Operação ${run.idx+1}: ${OPS[run.idx].name}`:'Proteja sua bandeira e capture a base inimiga na retaguarda.')}
function enterBattle(){
 try{IFTitle.stop()}catch{}
 setup();body.classList.toggle('is-sandbox',!!sandbox);body.dataset.run=(run&&run.kind)||'sandbox';body.dataset.screen='battle';body.classList.remove('qg-open');dispatchEvent(new Event('resize'));flashHint();syncMode();
 const t=$('toast');t.classList.remove('show');void t.offsetWidth;applyOpts()}
function toTitle(view='main'){
 try{$('result').close()}catch{}try{$('menu').close()}catch{}
 started=false;running=false;ended=false;document.getElementById('status').textContent='PREPARAÇÃO';
 try{setup(true)}catch(e){console.error(e)}
 showTitle(view)}
function syncMode(){body.dataset.mode=mode;$('hintline').classList.remove('fade')}
function flashHint(){const h=$('hintline');h.classList.remove('fade');clearTimeout(hintTimer);hintTimer=setTimeout(()=>h.classList.add('fade'),9000)}

/* ================= pausa, resultado e opções ================= */
function openPause(){if(!started||ended||dlgOpen())return;wasRunning=running;if(running)pause();
 /* U14: o ícone de reiniciar usa a bandeira do lado do jogador (pode mudar no meio da batalha) */
 try{const ic=document.querySelector('#pm-restart .ico');if(ic&&A.flagIconURL)ic.style.setProperty('--ico',`url(${A.flagIconURL(typeof playerTeam!=='undefined'?playerTeam:0)})`)}catch{}
 $('menu').showModal()}
function closePause(){$('menu').close()}
$('menu').addEventListener('close',()=>{if(wasRunning&&started&&!ended&&!running&&!dlgOpen())pause();wasRunning=false});
$('pm-continue').onclick=closePause;
$('pm-options').onclick=()=>$('optionsDlg').showModal();
$('pm-guide').onclick=()=>$('guide').showModal();
$('pm-restart').onclick=()=>{wasRunning=false;$('menu').close();if(run&&run.cfg)launch(run.cfg);else{enterBattle()}};
$('pm-quit').onclick=()=>{wasRunning=false;toTitle(run&&run.kind!=='sandbox'?run.kind:'main')};
$('settings').onclick=openPause;
$('btn-options').onclick=()=>$('optionsDlg').showModal();
$('btn-guide').onclick=()=>$('guide').showModal();
$('start').onclick=()=>{run={kind:'sandbox',cfg:null};enterBattle();toast('Proteja sua bandeira e capture a base inimiga na retaguarda.')};
const _finish=window.finish;
window.finish=function(win){
 _finish.apply(this,arguments);
 const note=$('resultnote'),next=$('nextop'),retry=$('retry'),rs=$('restart');note.textContent='';next.hidden=true;next.innerHTML=(run&&run.kind==='story'?'PRÓXIMO CAPÍTULO':'PRÓXIMA OPERAÇÃO')+' <span>▶</span>';retry.hidden=!run||run.kind==='sandbox';
 const fmt=`${String(Math.floor(time/60)).padStart(2,'0')}:${String(Math.floor(time%60)).padStart(2,'0')}`;
 if(run&&run.kind==='campaign'){rs.textContent='MENU DA CAMPANHA';
  if(win){const o=OPS[run.idx],prev=save.campaign.done[o.id];save.campaign.done[o.id]={time:fmt,kills:teamKills[playerTeam]};store();
   note.textContent=run.idx+1<OPS.length?`Operação ${run.idx+1} concluída. Operação ${run.idx+2} liberada.`:'Campanha concluída. Fim da frente ocidental.';next.hidden=run.idx+1>=OPS.length;next.onclick=()=>{selOp=run.idx+1;$('result').close();toTitle('campaign')}}
  else note.textContent='A operação pode ser repetida quantas vezes quiser.'}
 else if(run&&run.kind==='story'){rs.textContent='MENU DA HISTÓRIA';
  if(win){const c=CH[run.idx];save.story.done=Math.max(save.story.done,run.idx+1);store();note.textContent=c.epi;next.hidden=run.idx+1>=CH.length;next.onclick=()=>{selCh=run.idx+1;$('result').close();toTitle('story')}}
  else note.textContent='O capítulo pode ser repetido quando quiser.'}
 else{rs.textContent='NOVA OPERAÇÃO'}
 applyOpts()};
$('restart').onclick=()=>{$('result').close();toTitle(run&&run.kind!=='sandbox'?run.kind:'sandbox')};
$('retry').onclick=()=>{$('result').close();if(run&&run.cfg)launch(run.cfg)};
document.querySelectorAll('#optionsDlg .seg[data-opt]').forEach(s=>s.querySelectorAll('button').forEach(b=>b.onclick=()=>{
 const k=s.dataset.opt,v=b.dataset.v;if(k==='sound'){setSound(+v===1);return}save.opts[k]=(k==='ui')?+v:+v;store();applyOpts()}));
$('opt-fs').onclick=toggleFS;$('title-fs').onclick=toggleFS;
let resetArm=0;$('opt-reset').onclick=function(){if(!resetArm){resetArm=setTimeout(()=>{resetArm=0;this.textContent='APAGAR'},3000);this.textContent='CONFIRMAR?';return}clearTimeout(resetArm);resetArm=0;this.textContent='APAGAR';save.campaign.done={};save.story.done=0;store();selOp=0;selCh=0;renderCampaign.init=false;renderStory.init=false;applyOpts()};
$('sound').onclick=()=>setSound(!soundOn);$('title-sound').onclick=()=>setSound(!soundOn);
$('qgtoggle').onclick=()=>body.classList.toggle('qg-open');$('qgclose').onclick=()=>body.classList.remove('qg-open');

/* ================= navegação por teclado ================= */
addEventListener('keydown',e=>{
 if(body.dataset.screen==='title'&&!dlgOpen()){
  if(e.key==='Escape'){if($('title').dataset.view!=='main'){e.preventDefault();go('main')}return}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){const list=$('title').dataset.view==='main'?[...document.querySelectorAll('#mainmenu .mbtn')]:null;
   if(list){e.preventDefault();const i=list.indexOf(document.activeElement),n=e.key==='ArrowDown'?(i+1)%list.length:(i-1+list.length)%list.length;list[i<0?0:n].focus();snd('click')}}
  return}
 if(inBattle()){
  if(e.key==='Escape'&&!dlgOpen()){if(typeof placement!=='undefined'&&placement)return;e.preventDefault();openPause();return}
  if((e.key==='h'||e.key==='H')&&!e.repeat&&!dlgOpen()&&mode==='commander')body.classList.toggle('qg-open')}
},true);
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('#title button,dialog button');if(b)snd('click')});
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>go('main'));

/* ================= envoltórios do jogo ================= */
const _render=window.render,_minimap=window.minimap,_update=window.update,_setMode=window.setMode;
window.render=function(){if(body.dataset.screen==='title')return;return _render.apply(this,arguments)};
window.minimap=function(){if(body.dataset.screen==='title')return;return _minimap.apply(this,arguments)};
window.update=function(dt){_update.call(this,dt);if(!+save.opts.shake)screenShake=0};
window.setMode=function(){const r=_setMode.apply(this,arguments);syncMode();flashHint();return r};
/* ícone de pausa acompanha o estado */
setInterval(()=>{const want=(typeof running!=='undefined'&&running)?'pause':'play';const p=$('pause');if(p.dataset.ico!==want)setIcon(p,want)},150);
addEventListener('resize',()=>applyOpts());

/* a dica de posicionamento só aparece quando há algo a posicionar */
(function(){const ph=$('placehint'),idle='Escolha uma unidade e posicione no campo';const f=()=>ph.classList.toggle('idle',ph.textContent===idle);new MutationObserver(f).observe(ph,{childList:true,characterData:true,subtree:true});f()})();
/* ================= inicialização ================= */
try{if($('menu').open)$('menu').close()}catch{}
paintIcons();
if(+save.opts.sound)soundOn=true;
try{IFTitle.onSound(k=>{if(soundOn&&typeof audio!=='undefined'&&audio)snd(k)})}catch{}
buildLogo();
/* a arte do logo é montada uma vez; o relógio do letreiro segue o tamanho da tela */
showTitle('main');
/* primeira interação libera o áudio */
addEventListener('pointerdown',()=>{if(soundOn){try{soundInit()}catch{}}},{once:true});
window.IFUI={go,launch,toTitle,showTitle,save:()=>save,run:()=>run};
})();
