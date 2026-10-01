/* Focused human-AI validation plus the existing browser integration suite. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const S=require('../dist/squad-mind.js'),L=require('../dist/learning.js');
const u=(id,extra={})=>({id,team:0,type:'rifle',hp:100,maxhp:100,x:700,y:480,cohesion:1,...extra});
const group={id:4,task:'avanço-alternado'},members=[u(1,{cls:'medic'}),u(2,{rs:{}}),u(3)];
let state={team:0,time:0,units:members,trenches:[]};
assert.equal(S.update(group,members,state).leader,3);
for(const member of members.slice(0,2))assert.equal(S.apply(member,{tx:900,ty:480,role:'assalto'},0,null),false);
members[2].rs={};state.time=5;assert.equal(S.update(group,members,state).leader,null);
const learner=L.create(),op={sector:{id:1},best:400,style:{name:'flank'}};
state={team:0,time:10,visibilityRange:350,units:[u(10),u(90,{team:1,type:'tank'})],points:[],trenches:[],knownEnemies:[]};
L.begin(learner,op,state,[10]);assert.equal(learner.trial.context,'aberto/neblina/infantaria','inimigo invisível não altera contexto');
state.time=20;op.best=50;L.finish(learner,op,state,true);assert.equal(learner.contexts['aberto/neblina/infantaria'].flank.trials,1);
state.knownEnemies=[{id:90,type:'tank',x:900,y:480,at:20}];L.begin(learner,op,state,[10]);assert.equal(learner.trial.context,'aberto/neblina/blindados');
console.log('Human AI: médicos, resgate, liderança e aprendizado sem contatos invisíveis OK');
if(!process.argv.includes('--browser-only'))for(const file of fs.readdirSync(path.join(__dirname,'../tests')).filter(f=>f.endsWith('.test.cjs'))){const r=cp.spawnSync(process.execPath,[path.join(__dirname,'../tests',file)],{encoding:'utf8'});process.stdout.write(r.stdout);process.stderr.write(r.stderr);assert.equal(r.status,0,file)}
process.env.NODE_PATH='C:/Users/ryan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';require('node:module').Module._initPaths();
require('./verify-battle.cjs');
