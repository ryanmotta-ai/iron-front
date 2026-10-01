const assert=require('node:assert/strict');const F=require('../dist/formations.js');
const slots=F.slots([{id:1,team:0,hp:100,x:600,y:800,ax:0,ay:1,len:84,slots:8}],0);
assert.equal(slots.length,5);assert.ok(slots.every(p=>p.x===600&&Math.abs(p.y-800)<=42));
assert.equal(F.slots([{team:1,hp:100,x:1,y:1,slots:4}],0).length,0);
const start={x:0,y:0},anchor={x:0,y:100};let p=F.point(anchor,start,1,8,'wedge');assert.equal(p.y,76);assert.equal(p.x,-24);
const points=Array.from({length:8},(_,i)=>F.point({x:100,y:0},start,i,8,'column'));for(let i=0;i<points.length;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)>=24);
const memory={},units=[{id:1,hp:100,x:0,y:0},{id:2,hp:100,x:0,y:20}];
assert.equal(F.select(memory,units,0,{x:180,y:0},'wedge',false),'wedge');
assert.equal(F.select(memory,units,5,{x:180,y:0},'line',false),'wedge','formation remains stable during trial');
F.select(memory,[{...units[0],hp:20}],24,{x:180,y:0},'wedge',false);assert.ok(memory.stats.wedge.value<0,'cohort loss affects learning');
assert.equal(F.select(memory,units,25,{x:180,y:0},'wedge',true),'column');
console.log('Formations: aligned bounded slots, rotated geometry, spacing, stable trials, casualty learning and narrow routes OK');

const pinnedMemory={};F.select(pinnedMemory,units,0,{x:180,y:0},'wedge',false);
F.select(pinnedMemory,[{...units[0],hp:10,pinned:true,manualUntil:30,pinStamp:30},units[1]],24,{x:180,y:0},'wedge',false);
assert.ok(pinnedMemory.stats.wedge.value<0,'supressão automática não exclui perdas da avaliação');
const narrowMemory={};F.select(narrowMemory,units,0,{x:180,y:0},'wedge',false);
F.select(narrowMemory,units,5,{x:180,y:0},'wedge',true);assert.equal(narrowMemory.trial,null,'coluna não recebe o resultado da formação anterior');
