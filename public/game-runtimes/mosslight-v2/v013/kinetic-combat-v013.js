const G=window.Sylvaria091;
const {W,H,TAU,FIXED_DT,state,DIRS,clamp,lerp,dist,audio}=G;
const F=G.fn;

export const KINETIC_VERSION='0.13.0';
export const KINETIC_CONFIG=Object.freeze({
  moveSpeed:238,
  acceleration:1880,
  braking:12.5,
  turnGrip:15.5,
  dashChargeTime:.68,
  dashMinSpeed:520,
  dashMaxSpeed:960,
  dashMinDuration:.09,
  dashMaxDuration:.18,
  dashCooldown:.48,
  dashBuffer:.10,
  dashDecay:.90483742,
  dashTicksMin:12,
  dashTicksMax:22,
  dashDistanceMin:78,
  dashDistanceMax:154,
  dashCancelTicks:4,
  arcDegrees:156,
  arcWindup:3/120,
  arcActive:15/120,
  arcRecovery:10/120,
  arcReach:94,
  arcThickness:10,
  parryWindow:5/120,
  reflectSpeed:920,
  perfectReflectSpeed:1160,
});

const BASE_ANGLE=Object.freeze({right:0,down:Math.PI/2,left:Math.PI,up:-Math.PI/2});
const SYNERGY_WEIGHTS=Object.freeze({perfectCounters:1,crosscuts:1,longReturns:1,terrainRoutes:1,hazardKills:1,gasRoutes:2});
const EPS=1e-7;
const q=v=>Math.round(v*100000)/100000;
const mod=a=>((a%TAU)+TAU)%TAU;
const normalize=(x,y)=>{const m=Math.hypot(x,y);return m>EPS?{x:q(x/m),y:q(y/m),m}:{x:0,y:0,m:0}};
const smoothstep=t=>t*t*(3-2*t);

function signalHitStop(kind,ticks){
  state.hitStopSerial=(state.hitStopSerial||0)+1;
  state.hitStopKind=kind;
  state.hitStopTicks=ticks;
  state.shake=Math.max(state.shake,kind==='parry'?5.2:kind==='armor'?3.3:2.2);
}

function initKineticPlayer(p){
  if(!p)return;
  p.vx=Number.isFinite(p.vx)?p.vx:0;
  p.vy=Number.isFinite(p.vy)?p.vy:0;
  p.dashCharge=0;
  p.dashCharging=false;
  p.dashChargeVector={x:1,y:0};
  p.dashCooldown=0;
  p.dashBuffer=0;
  p.dashBufferHeld=false;
  p.dashBufferReleased=false;
  p.dashQueuedCharge=.18;
  p.dash=null;
  p.dashEcho=0;
  p.lastDashSegment=null;
  p.swingParity=0;
  p.pose=0;
  state.bladeTrails=[];
  state.moveQueue=null;
  state.moveRepeatTimer=0;
}

const inheritedSetup=F.setupRoom;
F.setupRoom=(...args)=>{
  const result=inheritedSetup(...args);
  initKineticPlayer(state.player);
  return result;
};
if(state.player)initKineticPlayer(state.player);

function heldVector(){
  let x=0,y=0;
  if(state.heldMoves.has('a'))x-=1;
  if(state.heldMoves.has('d'))x+=1;
  if(state.heldMoves.has('w'))y-=1;
  if(state.heldMoves.has('s'))y+=1;
  return normalize(x,y);
}

function fallbackDirection(p){
  const held=heldVector();
  if(held.m>0)return held;
  const velocity=normalize(p.vx,p.vy);
  if(velocity.m>28)return velocity;
  const d=DIRS[p.cutDirection]||DIRS[p.facing==='left'?'left':'right']||DIRS.right;
  return{x:d.x,y:d.y,m:1};
}

function queueDashBuffer(held=true){
  const p=state.player;if(!p)return false;
  p.dashBuffer=KINETIC_CONFIG.dashBuffer;
  p.dashBufferHeld=held;
  p.dashBufferReleased=!held;
  p.dashQueuedCharge=Math.max(.18,p.dashCharge||0);
  return true;
}

function beginDashCharge(){
  const p=state.player;
  if(!p||state.mode!=='playing'||p.dashCharging)return false;
  if(p.dash||p.dashCooldown>0)return queueDashBuffer(true);
  p.dashCharging=true;
  p.dashCharge=0;
  p.dashBuffer=0;
  p.dashBufferHeld=false;
  p.dashBufferReleased=false;
  const d=fallbackDirection(p);
  p.dashChargeVector={x:d.x,y:d.y};
  return true;
}

function launchDash(p,charge,d){
  const curve=smoothstep(clamp(charge,0,1));
  const ticks=Math.round(lerp(KINETIC_CONFIG.dashTicksMin,KINETIC_CONFIG.dashTicksMax,curve));
  const decay=KINETIC_CONFIG.dashDecay;
  const distance=lerp(KINETIC_CONFIG.dashDistanceMin,KINETIC_CONFIG.dashDistanceMax,curve)*(p.buffs.rush>0?1.08:1);
  const speed=q(distance*(1-decay)/(FIXED_DT*(1-Math.pow(decay,ticks))));
  const duration=ticks*FIXED_DT;
  p.vx=q(d.x*speed);p.vy=q(d.y*speed);
  p.dash={timer:duration,duration,dir:{x:d.x,y:d.y},charge,curve,sx:p.x,sy:p.y,tx:p.x,ty:p.y,reactive:true,speed,decay,ticksLeft:ticks,totalTicks:ticks,elapsedTicks:0,distanceTarget:distance};
  p.lastDashSegment={sx:p.x,sy:p.y,tx:p.x,ty:p.y};
  p.dashCooldown=KINETIC_CONFIG.dashCooldown+curve*.10;
  p.dashCharge=0;
  p.dashBuffer=0;
  p.dashBufferHeld=false;
  p.dashBufferReleased=false;
  p.dashEcho=0;
  p.invuln=Math.max(p.invuln,5/120+curve*2/120);
  state.stats.dashes++;
  state.shake=Math.max(state.shake,1.6+curve*1.8);
  for(let i=0;i<6;i++)F.spawnParticle?.(p.x-d.x*i*4,p.y-d.y*i*4,'#a9ffaf',22+i*4,.22,1.8);
  audio.dash?.(F.mobilityAt(p.x,p.y).type);
  return true;
}

function releaseDashCharge(){
  const p=state.player;if(!p)return false;
  if(!p.dashCharging){if(p.dashBuffer>0){p.dashBufferHeld=false;p.dashBufferReleased=true;return true}return false}
  p.dashCharging=false;
  if(state.mode!=='playing'){p.dashCharge=0;return false}
  const held=heldVector(),fallback=fallbackDirection(p),d=held.m>0?held:fallback;
  const charge=clamp(Math.max(.12,p.dashCharge),0,1);
  return launchDash(p,charge,d);
}

function cancelDashCharge(){const p=state.player;if(p){p.dashCharging=false;p.dashCharge=0;p.dashBuffer=0;p.dashBufferHeld=false;p.dashBufferReleased=false}}

function currentAt(x,y){
  const patch=F.terrainAt(x,y,false);
  if(!patch||patch.type!=='water')return{x:0,y:0};
  const angle=patch.phase+Math.sin(state.roomTime*.82+patch.phase)*.32;
  const strength=52+Math.sin(state.roomTime*1.13+patch.phase*1.7)*14;
  return{x:q(Math.cos(angle)*strength),y:q(Math.sin(angle)*strength)};
}

function moveAxis(p,dx,dy){
  let blocked=false;
  if(Math.abs(dx)>EPS){const nx=clamp(q(p.x+dx),28,W-28);if(F.positionClear(nx,p.y,p.r))p.x=nx;else{p.vx=0;blocked=true}}
  if(Math.abs(dy)>EPS){const ny=clamp(q(p.y+dy),80,H-32);if(F.positionClear(p.x,ny,p.r))p.y=ny;else{p.vy=0;blocked=true}}
  if(blocked&&p.dash){p.dash.ticksLeft=0;p.dash.timer=0;state.stats.blockedSteps++}
}

function updateSynergyClock(dt){
  if(state.synergyTimer>0){state.synergyTimer=Math.max(0,state.synergyTimer-dt);if(state.synergyTimer===0)state.synergyChain=0}
  if(state.verdantTimer>0)state.verdantTimer=Math.max(0,state.verdantTimer-dt);
  if(!state.synergyLastStats)state.synergyLastStats={};
  for(const [key,weight] of Object.entries(SYNERGY_WEIGHTS)){
    const now=state.stats[key]||0,last=state.synergyLastStats[key]||0;
    if(now>last)window.SylvariaSynergy?.awardSynergy?.(key,(now-last)*weight);
    state.synergyLastStats[key]=now;
  }
}

function updateMovement(dt){
  const p=state.player;if(!p)return;
  if(p.dashCooldown>0)p.dashCooldown=Math.max(0,p.dashCooldown-dt);
  if(p.cutCooldown>0)p.cutCooldown=Math.max(0,p.cutCooldown-dt);
  if(p.invuln>0)p.invuln=Math.max(0,p.invuln-dt);
  if(p.hazardCooldown>0)p.hazardCooldown=Math.max(0,p.hazardCooldown-dt);
  if(p.recoil>0)p.recoil=Math.max(0,p.recoil-dt);
  if(p.dashEcho>0)p.dashEcho=Math.max(0,p.dashEcho-dt);
  for(const k of Object.keys(p.buffs))p.buffs[k]=Math.max(0,p.buffs[k]-dt);
  updateSynergyClock(dt);

  if(p.dashBuffer>0){
    p.dashBuffer=Math.max(0,p.dashBuffer-dt);
    if(!p.dash&&!p.dashCharging&&p.dashCooldown<=0){
      const release=p.dashBufferReleased,held=p.dashBufferHeld,queued=p.dashQueuedCharge||.18;
      p.dashBuffer=0;p.dashBufferReleased=false;p.dashBufferHeld=false;
      beginDashCharge();
      if(release&&!held){p.dashCharge=Math.max(.18,queued);releaseDashCharge()}
    }
  }

  const input=heldVector();
  if(p.dashCharging){
    p.dashCharge=clamp(p.dashCharge+dt/KINETIC_CONFIG.dashChargeTime,0,1);
    if(input.m>0)p.dashChargeVector={x:input.x,y:input.y};
  }

  if(p.dash?.reactive){
    const steer=input.m>0?input:{x:0,y:0,m:0},base=KINETIC_CONFIG.moveSpeed*.18;
    p.vx=q(p.dash.dir.x*p.dash.speed+steer.x*base);
    p.vy=q(p.dash.dir.y*p.dash.speed+steer.y*base);
  }

  const mobility=F.mobilityAt(p.x,p.y),rush=p.buffs.rush>0?1.12:1;
  const onIce=mobility.type==='ice',maxSpeed=KINETIC_CONFIG.moveSpeed*mobility.move*rush;
  const accel=KINETIC_CONFIG.acceleration*(onIce?.46:1)*(p.dashCharging?.82:1);
  const dashControl=p.dash?.22:1;
  if(input.m>0){
    const tx=input.x*maxSpeed,ty=input.y*maxSpeed,blend=Math.min(1,KINETIC_CONFIG.turnGrip*dt*dashControl);
    p.vx=q(p.vx+(tx-p.vx)*blend+input.x*accel*dt*.16*dashControl);
    p.vy=q(p.vy+(ty-p.vy)*blend+input.y*accel*dt*.16*dashControl);
    if(Math.abs(input.x)>EPS)p.facing=input.x<0?'left':'right';
  }else if(!p.dash){
    const drag=Math.max(0,1-(onIce?2.2:KINETIC_CONFIG.braking)*dt);
    p.vx=q(p.vx*drag);p.vy=q(p.vy*drag);
  }

  if(!p.dash){const speed=Math.hypot(p.vx,p.vy);if(speed>maxSpeed&&speed>EPS){p.vx=q(p.vx/speed*maxSpeed);p.vy=q(p.vy/speed*maxSpeed)}}
  const current=currentAt(p.x,p.y);p.vx=q(p.vx+current.x*dt*.8);p.vy=q(p.vy+current.y*dt*.8);

  const ox=p.x,oy=p.y;
  moveAxis(p,p.vx*dt,p.vy*dt);
  if(p.dash){
    p.dash.tx=p.x;p.dash.ty=p.y;
    p.lastDashSegment={sx:p.dash.sx,sy:p.dash.sy,tx:p.x,ty:p.y};
    p.trail.push({x:p.x,y:p.y,life:.16,surface:mobility.type});if(p.trail.length>9)p.trail.shift();
    if(p.dash.reactive){
      p.dash.elapsedTicks++;p.dash.ticksLeft--;p.dash.speed=q(p.dash.speed*p.dash.decay);p.dash.timer=Math.max(0,p.dash.ticksLeft*FIXED_DT);
      if(p.dash.ticksLeft<=0){p.dash=null;p.dashEcho=11/120}
    }else{p.dash.timer-=dt;if(p.dash.timer<=0){p.dash=null;p.dashEcho=11/120}}
  }
  F.applyTerrainHazard(p,'player');
  p.pose=0;
  p.x=q(p.x);p.y=q(p.y);p.vx=q(p.vx);p.vy=q(p.vy);
}

function requestDash(key){
  if(!state.player||state.mode!=='playing')return false;
  state.lastMoveKey=key;state.moveQueue=null;return true;
}
function dashStep(dir){
  const p=state.player;if(!p||state.mode!=='playing'||p.dashCooldown>0)return false;
  const d=normalize(dir?.x||0,dir?.y||0);if(!d.m)return false;
  return launchDash(p,.58,d);
}
function repeatCadence(){return 0}
function queueMove(){state.moveQueue=null;return false}
function consumeMoveQueue(){state.moveQueue=null;return false}

function angleFor(direction){return BASE_ANGLE[direction]??0}
function directedDistance(from,to,dir){return dir>0?mod(to-from):mod(from-to)}
function angleInsideTickSweep(from,to,a,dir,pad){
  const span=directedDistance(from,to,dir),forward=directedDistance(from,a,dir),behind=directedDistance(a,from,dir);
  return forward<=span+pad||behind<=pad;
}
function fullArcContains(s,o,padExtra=0){
  const dx=o.x-s.x,dy=o.y-s.y,r=Math.hypot(dx,dy),objectR=o.r||0;
  if(r<s.inner-objectR||r>s.reach+objectR+padExtra)return false;
  const a=Math.atan2(dy,dx),pad=Math.asin(Math.min(.94,(s.thickness+objectR+padExtra)/Math.max(10,r)));
  return angleInsideTickSweep(s.startAngle,s.endAngle,a,s.sweepDir,pad);
}
function arcSweepContains(s,o,padExtra=0){
  if(s.phase!=='active')return false;
  const dx=o.x-s.x,dy=o.y-s.y,r=Math.hypot(dx,dy),objectR=o.r||0;
  if(r<s.inner-objectR||r>s.reach+objectR+padExtra)return false;
  const a=Math.atan2(dy,dx),pad=Math.asin(Math.min(.94,(s.thickness+objectR+padExtra)/Math.max(10,r)));
  return angleInsideTickSweep(s.prevAngle,s.angle,a,s.sweepDir,pad);
}

function cancelDashIntoBlade(p){
  if(!p.dash?.reactive||p.dash.elapsedTicks<KINETIC_CONFIG.dashCancelTicks)return false;
  const carry=Math.max(KINETIC_CONFIG.moveSpeed*.72,p.dash.speed*.34),d=p.dash.dir;
  p.vx=q(d.x*carry);p.vy=q(d.y*carry);p.dash=null;p.dashEcho=13/120;return true;
}

function cut(direction){
  const p=state.player;if(!p||state.mode!=='playing'||p.cutCooldown>0)return false;
  const dashCancelled=cancelDashIntoBlade(p),center=angleFor(direction),span=KINETIC_CONFIG.arcDegrees*Math.PI/180,sweepDir=p.swingParity%2===0?1:-1,lead=.48;
  p.swingParity++;
  const startAngle=q(center-sweepDir*lead),endAngle=q(startAngle+sweepDir*span);
  const flow=clamp(p.flow/100,0,1),windup=dashCancelled?2/120:KINETIC_CONFIG.arcWindup,active=KINETIC_CONFIG.arcActive,recovery=lerp(KINETIC_CONFIG.arcRecovery,8/120,flow);
  const s={kind:'arc',direction,x:p.x,y:p.y,age:0,phase:'windup',phaseTime:0,windup,active,recovery,life:windup+active+recovery,startAngle,endAngle,angle:startAngle,prevAngle:startAngle,sweepDir,activeProgress:0,perfectWindow:0,parryWindow:KINETIC_CONFIG.parryWindow,reach:KINETIC_CONFIG.arcReach+(p.buffs.edge>0?22:0),inner:18,thickness:KINETIC_CONFIG.arcThickness,width:64,hits:new Set(),gasShearDone:false,dashCancelled};
  state.slashes.push(s);p.cutCooldown=s.life+1/120;p.cutDirection=direction;p.facing=direction==='left'?'left':direction==='right'?'right':p.facing;p.recoil=.035;state.stats.cuts++;
  audio.cut?.();
  for(let i=0;i<5;i++)F.spawnParticle?.(p.x,p.y,'#efffc9',14+i*2,.18,1.5);
  if(dashCancelled||p.dashEcho>0)F.tryDashCutIce?.(s);
  return true;
}

function hostileTargets(){const list=state.enemies.filter(e=>!e.dead);if(state.boss&&!state.boss.dead)list.push(state.boss);return list}
function returnDirection(shot,s){
  const rx=shot.x-s.x,ry=shot.y-s.y,rn=normalize(rx,ry),tangent=s.sweepDir>0?{x:-rn.y,y:rn.x}:{x:rn.y,y:-rn.x};
  let target=null,best=Infinity;
  for(const e of hostileTargets()){
    const dx=e.x-shot.x,dy=e.y-shot.y,n=normalize(dx,dy);if(!n.m)continue;
    const alignment=tangent.x*n.x+tangent.y*n.y,score=Math.hypot(dx,dy)-alignment*120+(e.id===shot.originalOwnerId?-45:0);
    if(score<best){best=score;target=n}
  }
  if(!target)return tangent;
  return normalize(tangent.x*.58+target.x*.42,tangent.y*.58+target.y*.42);
}
function shotApproaching(shot){const p=state.player,dx=p.x-shot.x,dy=p.y-shot.y,n=normalize(dx,dy),v=normalize(shot.vx,shot.vy);return n.m>0&&v.m>0&&n.x*v.x+n.y*v.y>.06}
function counterShotArc(shot,s){
  if(shot.dead||shot.friendly||s.phaseTime>=s.parryWindow||!shotApproaching(shot)||!arcSweepContains(s,shot,4))return false;
  const v=returnDirection(shot,s),speed=KINETIC_CONFIG.perfectReflectSpeed;
  shot.originPattern||=shot.pattern;shot.friendly=true;shot.beneficiaryId=null;shot.originalOwnerId||=shot.owner?.id||null;shot.owner=null;shot.pattern='return';
  shot.vx=q(v.x*speed);shot.vy=q(v.y*speed);shot.baseSpeed=speed;shot.damage=3;shot.counterQuality='perfect';shot.counterTargetId=null;shot.reflectedTravel=0;shot.pierces=1;shot.hitIds=new Set();shot.color='#fffde8';shot.life=1.72;
  state.stats.counters++;state.stats.perfectCounters++;state.player.flow=clamp(state.player.flow+18,0,100);state.score+=130;
  F.addCallout?.(shot.x,shot.y-14,'PARRY','#fff5a8');signalHitStop('parry',4);audio.counter?.(true);return true;
}

function shearGasArc(s){
  const p=state.player;if(s.gasShearDone||(!p.dash&&p.dashEcho<=0))return false;
  const cloud=state.gasClouds.find(c=>arcSweepContains(s,c,Math.max(6,c.r*.34)));if(!cloud)return false;
  const d={x:Math.cos(s.angle),y:Math.sin(s.angle)},verdant=state.verdantTimer>0,push=verdant?36:26;
  cloud.x=clamp(q(cloud.x+d.x*push),36,W-36);cloud.y=clamp(q(cloud.y+d.y*push),88,H-35);cloud.maxR=Math.min(102,cloud.maxR+(verdant?15:8));cloud.maxLife=Math.min(4.7,(cloud.maxLife||cloud.life)+(verdant?.5:.28));cloud.life=Math.min(cloud.maxLife,cloud.life+(verdant?.5:.28));s.gasShearDone=true;state.stats.gasShears=(state.stats.gasShears||0)+1;
  F.addCallout?.(cloud.x,cloud.y-cloud.r*.55,'SPORE SWEEP','#c6ff9b');window.SylvariaSynergy?.awardSynergy?.('gas-shear',verdant?2:1);return true;
}

function applyArcWorldHits(s){
  for(const i of state.debris)if(!i.dead&&!s.hits.has(i.id)&&arcSweepContains(s,i)){s.hits.add(i.id);if(--i.hp<=0)F.breakDeadwood(i)}
  for(const i of state.brittle)if(!i.dead&&!s.hits.has(i.id)&&arcSweepContains(s,i)){s.hits.add(i.id);if(--i.hp<=0)F.breakBrittle(i,false)}
  for(const b of state.foliage)if(!b.cut&&arcSweepContains(s,b,2)){b.cut=true;state.stats.grassCut++;state.score+=2;F.maybeReleaseGrassCache(state.terrain.find(p=>p.id===b.patchId))}
  for(const m of state.mushrooms)if(!m.cut&&!s.hits.has(m.id)&&arcSweepContains(s,m,2)){s.hits.add(m.id);F.cutMushroom(m)}
  for(const e of state.enemies)if(!e.dead&&!s.hits.has(e.id)&&arcSweepContains(s,e,1)){
    s.hits.add(e.id);const d=normalize(e.x-s.x,e.y-s.y),blocks=state.stats.shellBlocks||0,hp=e.hp;F.damageEnemy(e,1,{x:d.x,y:d.y},{melee:true,arc:true,attack:s});
    if(e.hp<hp)signalHitStop((state.stats.shellBlocks||0)>blocks?'armor':'enemy',(state.stats.shellBlocks||0)>blocks?2:1);
  }
  if(state.boss&&!state.boss.dead&&!s.hits.has(state.boss.id)&&arcSweepContains(s,state.boss,2)){s.hits.add(state.boss.id);const d=normalize(state.boss.x-s.x,state.boss.y-s.y),hp=state.boss.hp;F.damageBoss(1,{x:d.x,y:d.y},{melee:true,arc:true,attack:s});if(state.boss.hp<hp)signalHitStop('enemy',1)}
  shearGasArc(s);
}

function updateBladeTrails(dt){
  if(!state.bladeTrails)state.bladeTrails=[];
  for(const t of state.bladeTrails)t.life-=dt;
  state.bladeTrails=state.bladeTrails.filter(t=>t.life>0);
}

function updateSlashes(dt){
  const p=state.player;if(!p){state.slashes=[];state.bladeTrails=[];return}
  updateBladeTrails(dt);
  for(const s of state.slashes){
    s.age+=dt;s.life-=dt;s.x=p.x;s.y=p.y;s.phaseTime+=dt;
    if(s.phase==='windup'&&s.phaseTime>=s.windup){s.phaseTime-=s.windup;s.phase='active';s.prevAngle=s.startAngle;s.angle=s.startAngle}
    if(s.phase==='active'){
      s.activeProgress=clamp(s.phaseTime/s.active,0,1);s.prevAngle=s.angle;s.angle=q(lerp(s.startAngle,s.endAngle,s.activeProgress));
      state.bladeTrails.push({x:s.x,y:s.y,from:s.prevAngle,to:s.angle,reach:s.reach,inner:s.inner,life:.095,maxLife:.095,sweepDir:s.sweepDir});if(state.bladeTrails.length>12)state.bladeTrails.shift();
      for(const shot of state.shots)if(!shot.dead&&!shot.friendly)counterShotArc(shot,s);
      applyArcWorldHits(s);
      if(s.phaseTime>=s.active){s.phaseTime-=s.active;s.phase='recovery';s.prevAngle=s.endAngle;s.angle=s.endAngle}
    }
    if(s.phase==='recovery'&&s.phaseTime>=s.recovery)s.life=0;
  }
  state.slashes=state.slashes.filter(s=>s.life>0);
}

const inheritedShots=F.updateShots;
F.updateShots=(dt)=>{
  const scale=1.10+Math.min(.08,Math.max(0,state.worldDepth-1)*.0028);
  for(const shot of state.shots){if(shot.dead||shot.friendly||shot.v013Scaled)continue;shot.v013Scaled=true;shot.vx=q(shot.vx*scale);shot.vy=q(shot.vy*scale);if(Number.isFinite(shot.baseSpeed))shot.baseSpeed=q(shot.baseSpeed*scale)}
  inheritedShots(dt);
};

Object.assign(F,{beginDashCharge,releaseDashCharge,cancelDashCharge,currentAt,heldVector,requestDash,dashStep,repeatCadence,queueMove,consumeMoveQueue,cut,arcSweepContains,fullArcContains,counterShotArc,updateMovement,updateSlashes,signalHitStop});

function onSpaceDown(event){if(String(event.key||'').toLowerCase()!==' '&&event.code!=='Space')return;if(event.repeat||state.mode!=='playing')return;event.preventDefault();beginDashCharge()}
function onSpaceUp(event){if(String(event.key||'').toLowerCase()!==' '&&event.code!=='Space')return;event.preventDefault();releaseDashCharge()}
document.addEventListener('keydown',onSpaceDown,true);
document.addEventListener('keyup',onSpaceUp,true);
window.addEventListener?.('blur',cancelDashCharge);

window.SylvariaKinetics=Object.freeze({version:KINETIC_VERSION,config:KINETIC_CONFIG,snapshot:()=>{const p=state.player,s=state.slashes.at(-1);return{version:KINETIC_VERSION,velocity:p?{x:p.vx,y:p.vy,speed:Math.hypot(p.vx,p.vy)}:null,dashCharge:p?.dashCharge||0,dashCharging:Boolean(p?.dashCharging),dashBuffer:p?.dashBuffer||0,dashBuffered:Boolean(p?.dashBuffer>0),dashing:Boolean(p?.dash),dash:p?.dash?{speed:p.dash.speed||Math.hypot(p.vx,p.vy),ticksLeft:p.dash.ticksLeft??0,distanceTarget:p.dash.distanceTarget??0,elapsedTicks:p.dash.elapsedTicks??0}:null,arc:s?.kind==='arc'?{phase:s.phase,phaseTime:s.phaseTime,progress:s.activeProgress||0,angle:s.angle,start:s.startAngle,end:s.endAngle,sweepDir:s.sweepDir,reach:s.reach,parryWindow:s.parryWindow,dashCancelled:Boolean(s.dashCancelled)}:null,bladeTrails:state.bladeTrails?.length||0,hitStop:{serial:state.hitStopSerial||0,kind:state.hitStopKind||null,ticks:state.hitStopTicks||0},current:p?currentAt(p.x,p.y):{x:0,y:0}}}});