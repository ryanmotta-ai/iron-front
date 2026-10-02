/* Strategic decisions are kept separate from rendering and input so both armies
   use the same rules. The commander spends its own supplies; soldiers still
   handle immediate aiming, movement and fire in game.js. */
(function(root){
'use strict';

const baseX=[350,2050];
const direction=[1,-1];
/* papéis por lado: 'attack' (ofensiva contínua em ondas), 'defend' (guarnece trincheiras, contra-ataca quando o atacante enfraquece) ou 'both' (os dois atacam, como antes) */
const roles=['both','both'];

function countNear(units,team,x,y,radius){
  const r2=radius*radius;
  let count=0;
  for(const u of units)if(u.hp>0&&u.team===team&&(u.x-x)**2+(u.y-y)**2<r2)count++;
  return count;
}

function closestEnemy(unit,units,range){
  let best=null,limit=range*range;
  for(const other of units){
    if(other.team===unit.team||other.hp<=0)continue;
    const distance=(other.x-unit.x)**2+(other.y-unit.y)**2;
    if(distance<limit){best=other;limit=distance}
  }
  return best;
}

/* Alvos importantes devem chamar a atenção antes de um soldado qualquer:
   blindados ameaçam romper a linha, metralhadoras travam o avanço e feridos
   podem ser eliminados rapidamente. Isso deixa o fogo automático mais parecido
   com uma decisão de comandante do que com uma busca pelo ponto mais próximo. */
function selectTarget(unit,units,range,canHit){
  let best=null,bestScore=-Infinity,limit=range*range;
  for(const other of units){
    if(other.team===unit.team||other.hp<=0)continue;
    const distance=(other.x-unit.x)**2+(other.y-unit.y)**2;
    if(distance>limit||canHit&&!canHit(unit,other))continue;
    const d=Math.sqrt(distance),health=other.maxhp?1-other.hp/other.maxhp:0;
    let score=(range-d)/range+health*.9;
    if(other.type==='tank')score+=unit.type==='tank'?2.4:-.7;
    if(other.type==='mg')score+=unit.type==='tank'?.4:1.0;
    if(other.type==='bunker')score+=1.4;
    if(other.underFire>0)score+=.25;
    if(other.target===unit)score+=.3;
    if(unit.type==='cavalry'&&other.type==='tank')score-=.8;
    if(score>bestScore){bestScore=score;best=other}
  }
  return best;
}

function segmentBox(a,b,x,y,hw,hh){
  let near=0,far=1;
  for(const [start,delta,min,max] of [[a.x,b.x-a.x,x-hw,x+hw],[a.y,b.y-a.y,y-hh,y+hh]]){
    if(Math.abs(delta)<1e-6){if(start<min||start>max)return false;continue}
    const t1=(min-start)/delta,t2=(max-start)/delta;
    near=Math.max(near,Math.min(t1,t2));far=Math.min(far,Math.max(t1,t2));
    if(near>far)return false;
  }
  return far>=0&&near<=1;
}

function clearShot(shooter,target,decor=[],buildings=[]){
  const left=Math.min(shooter.x,target.x),right=Math.max(shooter.x,target.x);
  const top=Math.min(shooter.y,target.y),bottom=Math.max(shooter.y,target.y);
  for(const b of buildings){
    if(b.hp<=0)continue;
    if(b.x<left-30||b.x>right+30||b.y<top-22||b.y>bottom+22)continue;
    if(b.type==='bunker'&&segmentBox(shooter,target,b.x,b.y,24,22))return false;
    if(b.type==='sandbag'&&segmentBox(shooter,target,b.x,b.y,30,10))return false;
  }
  for(const d of decor){
    if(d.x<left-22||d.x>right+22||d.y<top-12||d.y>bottom+12)continue;
    if(d.type==='ruin'&&segmentBox(shooter,target,d.x,d.y,22,12))return false;
    if(d.type==='tree'){
      const dx=target.x-shooter.x,dy=target.y-shooter.y;
      const t=Math.max(0,Math.min(1,((d.x-shooter.x)*dx+(d.y-shooter.y)*dy)/(dx*dx+dy*dy||1)));
      if((shooter.x+t*dx-d.x)**2+(shooter.y+t*dy-d.y)**2<36)return false;
    }
  }
  return true;
}

function safeShot(shooter,target,units,decor,buildings){
  if(!clearShot(shooter,target,decor,buildings))return false;
  return shooter.type!=='tank'||!units.some(u=>u!==shooter&&u.team===shooter.team&&u.hp>0&&
    (u.x-target.x)**2+(u.y-target.y)**2<70*70);
}

function nearbyTank(unit,units,range){
  let best=null,limit=range*range;
  for(const other of units){
    if(other.team!==unit.team||other.type!=='tank'||other.hp<=0)continue;
    const distance=(other.x-unit.x)**2+(other.y-unit.y)**2;
    if(distance<limit){best=other;limit=distance}
  }
  return best;
}

function nearestFriend(unit,units,range=520){
  let best=null,limit=range*range;
  for(const other of units){
    if(other===unit||other.team!==unit.team||other.hp<=0)continue;
    const distance=(other.x-unit.x)**2+(other.y-unit.y)**2;
    if(distance<limit){best=other;limit=distance}
  }
  return best;
}

function rallyFriend(unit,units,range=420){
  let best=null,bestScore=Infinity;
  for(const other of units){
    if(other===unit||other.team!==unit.team||other.hp<=0||other.hp/other.maxhp<.5||
       (other.suppression||0)>.8||(other.cohesion??1)<.55)continue;
    const distance=Math.hypot(other.x-unit.x,other.y-unit.y);
    if(distance>range||direction[unit.team]*(other.x-unit.x)>-25)continue;
    const score=distance-(other.type==='mg'?35:0);
    if(score<bestScore){bestScore=score;best=other}
  }
  return best;
}

function observedUnits(state){
  const radius=state.visibilityRange;
  if(!Number.isFinite(radius))return state.units;
  const allies=state.units.filter(u=>u.team===state.team&&u.hp>0),limit=radius*radius;
  return state.units.filter(u=>u.team===state.team||u.hp>0&&allies.some(f=>(u.x-f.x)**2+(u.y-f.y)**2<=limit));
}

function rankObjectives(team,points,units){
  return points.filter(p=>p.owner!==team).map(p=>{
    const friends=countNear(units,team,p.x,p.y,160);
    const enemies=countNear(units,1-team,p.x,p.y,160);
    const distance=Math.abs(baseX[team]-p.x);
    const score=(p.owner===-1?7:6)+Math.min(6,friends)*.28-Math.min(12,enemies)*.16-distance/520;
    return {point:p,score,friends,enemies};
  }).sort((a,b)=>b.score-a.score);
}

function threatenedPoint(team,points,units){
  let result=null,highest=0;
  for(const p of points){
    if(p.owner!==team)continue;
    const enemies=countNear(units,1-team,p.x,p.y,210);
    const friends=countNear(units,team,p.x,p.y,150);
    const threat=enemies-friends*.55;
    if(threat>highest){highest=threat;result=p}
  }
  const invaders=units.filter(u=>u.team!==team&&u.hp>0&&Math.abs(u.x-baseX[team])<520);
  if(invaders.length){
    const defenders=units.filter(u=>u.team===team&&u.hp>0&&Math.abs(u.x-baseX[team])<520).length;
    const threat=invaders.length-defenders*.45;
    if(threat>Math.max(1.5,highest)){
      const nearest=invaders.reduce((a,b)=>Math.abs(a.x-baseX[team])<Math.abs(b.x-baseX[team])?a:b);
      result={x:baseX[team]+direction[team]*260,y:nearest.y,name:'BASE',owner:team};highest=threat;
    }
  }
  return {point:result,threat:highest,invasion:result?.name==='BASE'};
}

function trenchSlots(state){
  const slots=[];
  for(const b of [...(state.trenches||[]),...state.buildings]){
    if(b.type!=='trench'||b.hp<=0)continue;
    if(b.team!==state.team&&(!countNear(state.units,state.team,b.x,b.y,160)||countNear(state.units,1-state.team,b.x,b.y,90)))continue;
    const n=b.slots||5;
    for(let i=0;i<n;i++)slots.push({key:`${b.id??`${b.x},${b.y}`}:${i}`,x:n===1?b.x:b.x+(i-2)*18,y:b.y});
  }
  return slots;
}

/* postura por papel: a cada decisão (5 s) a tropa procura o melhor encaixe nas trincheiras que já estão prontas, inclusive as que acabaram de ficar prontas.
   defensor: metralhadoras na vala mais à frente (campo de tiro), fuzileiros na linha principal, 1 em 5 na linha de trás como reserva
   atacante: entre ondas ocupa as valas mais avançadas (base de assalto, até as sapas dos pioneiros); metralhadoras apoiam dali mesmo durante a onda */
function postureSlot(unit,mode,slots,occupied,reserved,span){
  if(unit.type!=='rifle'&&unit.type!=='mg')return null;
  const dir=direction[unit.team];let best=null,bestScore=-Infinity;
  for(const s of slots){
    if(reserved.has(s.key)||(occupied.has(s.key)&&occupied.get(s.key)!==unit.id))continue;
    const travel=Math.hypot(s.x-unit.x,s.y-unit.y);
    if(travel>(mode==='stage'?460:720))continue;
    const f=span.max>span.min?(dir*(s.x-baseX[unit.team])-span.min)/(span.max-span.min):.5;
    const score=mode==='hold'
      ?240-travel*.45-Math.abs(f-(unit.type==='mg'?.92:unit.id%5===0?.25:.68))*190+(travel<18?40:0)
      :240-travel*.55+f*(unit.type==='mg'?120:170)+(travel<18?30:0);
    if(score>bestScore){bestScore=score;best=s}
  }
  if(best)reserved.add(best.key);
  return best;
}

function reserveTrench(unit,target,slots,occupied,reserved,maxTravel){
  if(unit.type==='tank'||unit.type==='cavalry')return null;
  let best=null,bestScore=-Infinity;
  for(const slot of slots){
    if(reserved.has(slot.key)||(occupied.has(slot.key)&&occupied.get(slot.key)!==unit.id))continue;
    const travel=Math.hypot(slot.x-unit.x,slot.y-unit.y);
    if(travel>maxTravel)continue;
    const toTarget=Math.hypot(slot.x-target.x,slot.y-target.y);
    if(toTarget>400)continue;
    const score=250-travel*.85-toTarget*.22+(travel<18?45:0);
    if(score>bestScore){bestScore=score;best=slot}
  }
  if(best)reserved.add(best.key);
  return best;
}

function evadeShells(unit,shells){
  const imminent=shells.filter(shell=>shell.t>0&&shell.t<=2.1&&Math.hypot(unit.x-shell.x,unit.y-shell.y)<shell.r+45);
  if(!imminent.length)return null;
  let best=null,bestRisk=Infinity;
  for(let i=0;i<12;i++){
    const angle=i*Math.PI/6,tx=Math.max(20,Math.min((root.IronFrontWorld?.width||2400)-20,unit.x+Math.cos(angle)*105)),ty=Math.max(20,Math.min((root.IronFrontWorld?.height||1600)-20,unit.y+Math.sin(angle)*105));
    let risk=0;
    for(const shell of shells)if(shell.t>0&&shell.t<=2.1){
      const exposure=Math.max(0,shell.r+28-Math.hypot(tx-shell.x,ty-shell.y));
      risk+=exposure*exposure/(shell.t+.25);
    }
    risk+=Math.hypot(tx-unit.x,ty-unit.y)<55?2000:0;
    if(risk<bestRisk){bestRisk=risk;best={tx,ty}}
  }
  return best;
}

function findCover(unit,enemy,decor,buildings){
  if(!enemy||unit.type==='tank'||unit.type==='cavalry')return null;
  const maxTravel=unit.type==='mg'?120:95;
  let best=null,bestScore=0;
  const candidates=[];
  for(const d of decor)if((d.x-unit.x)**2+(d.y-unit.y)**2<maxTravel*maxTravel)candidates.push({x:d.x,y:d.y,factor:d.type==='ruin'?.55:.78});
  for(const b of buildings)if(b.team===unit.team&&b.type!=='wire'&&(b.x-unit.x)**2+(b.y-unit.y)**2<maxTravel*maxTravel)candidates.push({x:b.x,y:b.y,factor:b.type==='bunker'?.25:b.type==='trench'?.35:.55});
  for(const spot of candidates){
    const travel=Math.hypot(spot.x-unit.x,spot.y-unit.y);
    const firingDistance=Math.hypot(spot.x-enemy.x,spot.y-enemy.y);
    if(firingDistance>390||travel<14)continue;
    const score=(1-spot.factor)*95-travel*.28-Math.max(0,firingDistance-260)*.12;
    if(score>bestScore){bestScore=score;best=spot}
  }
  return best;
}

/* ondas de ofensiva: a cada 70 s um lado ataca por ~24 s (o outro, 35 s depois), sem guarnição parada e ultrapassando a bandeira; o resto do ciclo é posição e desgaste */
const SURGE_CYCLE=70,SURGE_ON=[18,42];
function offensiveSurge(team,time){const r=roles[team];if(r==='defend')return false;if(r==='attack'){const p=(time||0)%SURGE_CYCLE;return p>=8&&p<52}
  const p=((time||0)+(team?SURGE_CYCLE/2:0))%SURGE_CYCLE;return p>=SURGE_ON[0]&&p<SURGE_ON[1]}

function unitOrders(state,objective,secondary,defense){
  const {team,units,points,decor,buildings,time}=state;
  const dir=direction[team],orders=[];
  if(!objective)return orders;
  const surge=offensiveSurge(team,time)&&!defense.invasion;
  const frontFriends=countNear(units,team,objective.x,objective.y,260);
  const frontEnemies=countNear(units,1-team,objective.x,objective.y,260);
  const hold=roles[team]==='defend',counter=hold&&frontFriends>=Math.max(6,frontEnemies*1.5);
  const frontReady=frontFriends>=Math.max(3,frontEnemies*1.15);
  const overrun=frontEnemies>Math.max(4,frontFriends*1.35)&&frontFriends>=3;
  const slots=trenchSlots(state),occupied=new Map(),reserved=new Set(),span={min:Infinity,max:-Infinity};
  for(const sl of slots){const fr=dir*(sl.x-baseX[team]);if(fr<span.min)span.min=fr;if(fr>span.max)span.max=fr}
  for(const slot of slots){
    const occupant=units.find(u=>u.hp>0&&Math.hypot(u.x-slot.x,u.y-slot.y)<10);
    if(occupant)occupied.set(slot.key,occupant.id);
  }
  for(const unit of units){
    if(unit.team!==team||unit.hp<=0||unit.manualUntil>time||unit.dodgeUntil>time||unit.id===state.controlledId)continue;
    if(state.reactionsOnly&&unit.hp/unit.maxhp>=.34&&!(unit.underFire>0)&&!(unit.suppression>.5)&&(unit.cohesion??1)>.55)continue;
    const nearbyEnemy=selectTarget(unit,units,320);
    let tx,ty,role='assalto',reconGoal=null,post=null;
    const localFriends=countNear(units,team,unit.x,unit.y,190)-1;
    const localEnemies=countNear(units,1-team,unit.x,unit.y,190);
    const mobileReserve=unit.type==='rifle'&&unit.id%11===0;
    const pressure=(unit.suppression||0)+Math.max(0,.7-(unit.cohesion??1))*.9;
    const wasPinned=unit.aiRole==='fixado'||unit.aiRole==='reorganização';
    const pinned=unit.type!=='tank'&&unit.type!=='cavalry'&&nearbyEnemy&&
      (pressure>=(localFriends>=3&&localFriends>=localEnemies?1.3:1.15)+(surge?.6:0)||wasPinned&&pressure>.5+(surge?.6:0));
    if(unit.hp/unit.maxhp<.34&&nearbyEnemy){
      const trench=reserveTrench(unit,{x:baseX[team]+dir*160,y:unit.y},slots,occupied,reserved,520);
      tx=trench?.x??baseX[team]+dir*100;ty=trench?.y??unit.y;role=trench?'retirada-trincheira':'recuo';
    }else if(pinned){
      const trench=reserveTrench(unit,nearbyEnemy,slots,occupied,reserved,270);
      const cover=trench?null:findCover(unit,nearbyEnemy,decor,buildings);
      const rally=trench||cover?null:rallyFriend(unit,units);
      tx=trench?.x??cover?.x??(rally?rally.x-dir*25:unit.x);
      ty=trench?.y??cover?.y??rally?.y??unit.y;
      role=rally?'reorganização':'fixado';
    }else if(mobileReserve&&defense.point&&defense.threat>1.5){
      const trench=reserveTrench(unit,defense.point,slots,occupied,reserved,520);
      tx=trench?.x??defense.point.x-dir*65;
      ty=trench?.y??defense.point.y+(unit.id%5-2)*25;
      role=trench?'trincheira':'reforço-defensivo';
    }else if(defense.point&&defense.threat>2&&Math.hypot(unit.x-defense.point.x,unit.y-defense.point.y)<750&&
      (unit.type==='mg'||unit.type==='rifle'&&unit.id%(defense.invasion?2:3)===0||unit.type==='tank'&&defense.invasion)){
      const trench=reserveTrench(unit,defense.point,slots,occupied,reserved,400);
      tx=trench?.x??defense.point.x-dir*(unit.type==='tank'?110:35);
      ty=trench?.y??defense.point.y+(unit.id%5-2)*24;
      role=trench?'trincheira':unit.type==='mg'?'emboscada':'contra-ataque';
    }else if(slots.length&&(roles[team]==='defend'&&!counter&&unit.id%6!==0||roles[team]==='attack'&&(!surge||unit.type==='mg'))&&(post=postureSlot(unit,roles[team]==='defend'?'hold':'stage',slots,occupied,reserved,span))){
      tx=post.x;ty=post.y;role=roles[team]==='defend'?'posição-defensiva':'base-de-assalto';
    }else if(nearbyEnemy&&unit.type!=='tank'&&localEnemies>=2&&localFriends<=1){
      const rally=nearestFriend(unit,units,520);
      tx=rally?.x??baseX[team]+dir*100;ty=rally?.y??unit.y;role='socorro';
    }else{
      if(overrun&&unit.type==='rifle'&&unit.id%2===0){
        tx=objective.x-dir*170;ty=objective.y+(unit.id%7-3)*30;role='reagrupamento';
      }else{
      const garrison=!surge&&(hold?(unit.type==='mg'||unit.type==='rifle'&&unit.id%4!==0):(unit.type==='mg'&&unit.id%4===1||unit.type==='rifle'&&unit.id%6===0))&&Math.abs(unit.x-baseX[team])<(hold?950:750);
      const trench=garrison?reserveTrench(unit,{x:baseX[team]+dir*530,y:unit.y},slots,occupied,reserved,hold?520:360):null;
      if(trench){tx=trench.x;ty=trench.y;role='trincheira'}
      else if(hold&&!counter&&(unit.type==='mg'||unit.type==='rifle'||unit.type==='cavalry'||unit.type==='tank')){
        tx=baseX[team]+dir*(430+(unit.id%6)*28);ty=objective.y+(unit.id%11-5)*34;role='defesa';
      }else{
        const raid=unit.type==='cavalry'||unit.type==='rifle'&&unit.id%7===0;
        const goal=raid&&secondary?secondary:objective;
        const side=unit.id%2?1:-1;
        const scout={x:goal.x-dir*210,y:Math.max(45,Math.min(1555,goal.y+side*220))};
        const recon=unit.type==='cavalry'&&unit.reconGoal!==goal.name&&!nearbyEnemy&&Math.hypot(unit.x-scout.x,unit.y-scout.y)>80;
        const tank=unit.type==='rifle'&&unit.id%5===0&&!nearbyEnemy?nearbyTank(unit,units,210):null;
        const baseFire=(unit.type==='mg'||unit.type==='rifle'&&unit.id%5===1)&&frontEnemies>2&&!frontReady;
        if(recon){
          tx=scout.x;ty=scout.y;role='reconhecimento';
        }else if(mobileReserve&&!frontReady&&!nearbyEnemy&&!surge){
          tx=objective.x-dir*250;ty=objective.y+(unit.id%5-2)*42;role='reserva-movel';
        }else if(baseFire){
          tx=goal.x-dir*(unit.type==='mg'?260:205);ty=goal.y+(unit.id%5-2)*28;role='base-de-fogo';
        }else if(tank&&Math.hypot(tank.x-goal.x,tank.y-goal.y)>210){
          tx=tank.x+dir*75;ty=tank.y+(unit.id%3-1)*32;role='escolta';
        }else if(raid){
          if(unit.type==='cavalry'&&(nearbyEnemy||Math.hypot(unit.x-scout.x,unit.y-scout.y)<=80))reconGoal=goal.name;
          const flankY=Math.max(45,Math.min(1555,goal.y+side*(unit.type==='cavalry'?195:135)));
          if(Math.abs(unit.y-flankY)>48&&Math.abs(unit.x-goal.x)>125){tx=goal.x-dir*170;ty=flankY}
          else{tx=goal.x-dir*25;ty=goal.y+side*25}
          role=unit.type==='cavalry'?'incursão':'flanco';
        }else if(unit.type==='tank'){
          tx=goal.x-dir*55;ty=goal.y+(unit.id%5-2)*30;role='ruptura';
        }else{
          if(surge){tx=goal.x+dir*(45+(unit.id%3)*20);ty=goal.y+(unit.id%11-5)*20;role='ofensiva'}
          else{tx=goal.x-dir*(unit.id%3)*18;ty=goal.y+(unit.id%11-5)*16}
        }
      }
      }
    }
    if(role!=='recuo'&&role!=='retirada-trincheira'&&role!=='trincheira'&&role!=='fixado'&&role!=='reorganização'&&
      (unit.underFire>0||(unit.suppression||0)>.5)&&nearbyEnemy){
      const trench=reserveTrench(unit,nearbyEnemy,slots,occupied,reserved,270);
      if(trench){tx=trench.x;ty=trench.y;role='trincheira'}
      else if(unit.hp/unit.maxhp<.85){
        const cover=findCover(unit,nearbyEnemy,decor,buildings);
        if(cover){tx=cover.x;ty=cover.y;role='cobertura'}
      }
    }
    orders.push({id:unit.id,tx:Math.max(20,Math.min((root.IronFrontWorld?.width||2400)-20,tx)),ty:Math.max(20,Math.min((root.IronFrontWorld?.height||1600)-20,ty)),role,...(reconGoal?{reconGoal}:{})});
  }
  return orders;
}

function choosePurchase(state){
  const {team,units,maxUnits,supplies,defs}=state;
  const own=units.filter(u=>u.team===team&&u.hp>0),remaining=maxUnits-own.length;
  if(remaining<=0)return null;
  const counts={rifle:0,mg:0,tank:0,cavalry:0};
  for(const u of own)counts[u.type]++;
  const enemyTanks=units.filter(u=>u.team!==team&&u.type==='tank'&&u.hp>0).length;
  const reserve=own.length<maxUnits*.28?0:75;
  const affordable=type=>remaining>=defs[type].count&&supplies>=defs[type].cost+reserve;
  /* teto duro de blindados por lado: nunca mais que 3 (2 em partidas pequenas) e só um a mais que os do inimigo */
 const tankCap=Math.min(maxUnits>=120?3:2,enemyTanks+1);
 if(counts.rifle<Math.max(8,Math.ceil(own.filter(u=>!u.sap&&!u.down).length*.5))&&affordable('rifle'))return 'rifle';
  if(counts.tank<tankCap&&affordable('tank')&&own.length>maxUnits*.28)return 'tank';
  if(counts.mg<Math.max(2,Math.floor(own.length/(roles[team]==='defend'?10:18)))&&affordable('mg'))return 'mg';
  if(counts.cavalry<Math.max(2,Math.floor(own.length/22))&&affordable('cavalry'))return 'cavalry';
  if(affordable('rifle'))return 'rifle';
  if(affordable('mg'))return 'mg';
  return null;
}

function chooseSupport(state){
  const {team,units,points,supplies,defs}=state;
  if(supplies<defs.artillery.cost+90)return null;
  const enemies=units.filter(u=>u.team!==team&&u.hp>0);
  const orders=new Map((state.orders||[]).map(o=>[o.id,o]));
  const friendPositions=units.filter(u=>u.team===team&&u.hp>0).map(u=>{
    const order=orders.get(u.id)||(u.order==='move'?u:null);
    const distance=order?Math.hypot(order.tx-u.x,order.ty-u.y):0;
    const travel=Math.min(distance,(defs[u.type]?.speed||47)*4);
    const dx=(distance?order.tx-u.x:0)*travel/(distance||1),dy=(distance?order.ty-u.y:0)*travel/(distance||1);
    return [{x:u.x,y:u.y},{x:u.x+dx/2,y:u.y+dy/2},{x:u.x+dx,y:u.y+dy}];
  });
  const clearFor=(u,halfX,halfY)=>friendPositions.every(path=>path.every(p=>Math.abs(p.x-u.x)>=halfX||Math.abs(p.y-u.y)>=halfY));
  let best=null,bestScore=0;
  for(let i=0;i<enemies.length;i+=Math.max(1,Math.floor(enemies.length/80))){
    const u=enemies[i];
    const nearby=countNear(units,1-team,u.x,u.y,100);
    const nearbyAllies=countNear(units,team,u.x,u.y,100);
    const onFriendlyPoint=(points||[]).some(p=>p.owner===team&&Math.hypot(u.x-p.x,u.y-p.y)<220);
    const score=nearby-nearbyAllies*1.6+(u.type==='tank'?2:0)+(onFriendlyPoint?2.5:0)+(u.underFire>0?.4:0)+(u.id===state.priorityTarget?5:0);
    if(score<=bestScore)continue;
    const artillerySafe=clearFor(u,145,145);
    const inLane=enemies.filter(e=>Math.abs(e.x-u.x)<240&&Math.abs(e.y-u.y)<55).length;
    const fighterSafe=state.airAvailable!==false&&supplies>=defs.fighter.cost+90&&clearFor(u,310,100);
    const fighter=fighterSafe&&inLane>=8;
    if(!artillerySafe&&!fighter)continue;
    best={type:fighter?'fighter':'artillery',x:u.x,y:u.y};bestScore=score;
  }
  if(!best||bestScore<(offensiveSurge(team,state.time)?3:5))return null;
  return best;
}

function chooseDefense(state,defense){
  const {team,units,buildings,supplies,defs}=state;
  const wireCost=defs.wire?.cost??40;
  const own=roles[team]==='defend'?(state.points||[]).filter(q=>q.owner===team).sort((a,b)=>Math.abs(a.x-baseX[team])-Math.abs(b.x-baseX[team]))[0]:null;
  if(!(defense.point||own)||(defense.threat<2&&!own)||supplies<wireCost+70)return null;
  const p=defense.point||own;
  const fortified=buildings.some(b=>b.team===team&&b.type!=='wire'&&Math.hypot(b.x-p.x,b.y-p.y)<105);
  if(fortified)return null;
  const wired=buildings.some(b=>b.team===team&&b.type==='wire'&&Math.hypot(b.x-p.x,b.y-p.y)<150);
  const bunker=defense.threat>5&&supplies>=defs.bunker.cost+150;
  if(bunker)return {type:'bunker',x:p.x-direction[team]*60,y:p.y+50};
  if(defense.threat>3&&!wired&&supplies>=wireCost+70)return {type:'wire',x:p.x-direction[team]*110,y:p.y+55};
  return {type:'sandbag',x:p.x-direction[team]*60,y:p.y+50};
}

function plan(state){
  const observed={...state,units:observedUnits(state)};
  const ranked=rankObjectives(observed.team,observed.points,observed.units);
  const primary=ranked[0]?.point||null,secondary=ranked[1]?.point||null;
  const defense=threatenedPoint(observed.team,observed.points,observed.units);
  const reactive=observed.units.some(u=>u.team===state.team&&(u.hp/u.maxhp<.34||u.underFire>0||u.suppression>.5||(u.cohesion??1)<=.55));
  const orders=state.reactionsOnly&&!reactive?[]:unitOrders(observed,primary||defense.point,secondary,defense);
  return {
    summary:defense.invasion?'Invasão na retaguarda: reserva em defesa':primary?`${primary.name}: ${defense.point?'defesa e ':''}ataque coordenado`:'Defendendo todas as posições',
    orders,
    purchase:choosePurchase(observed),
    support:observed.supportReady?chooseSupport({...observed,orders}):null,
    defense:observed.buildReady?chooseDefense(observed,defense):null,
    reinforce:state.reinforceReady&&state.tickets[state.team]<160&&state.supplies>=state.defs.reinforce.cost+120
  };
}

const api={offensiveSurge,setRoles:r=>{roles[0]=r[0];roles[1]=r[1]},getRoles:()=>[...roles],plan,supportPlan:chooseSupport,findCover,rankObjectives,trenchSlots,evadeShells,selectTarget,clearShot,safeShot};
root.IronFrontBrain=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
