const G=window.Sylvaria091;
const {W,H,TAU,state,DIRS,clamp,lerp,dist,audio}=G;
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
  arcDegrees:156,
  arcWindup:.058,
  arcActive:.146,
  arcRecovery:.112,
  arcReach:94,
  arcThickness:10,
  reflectSpeed:920,
  perfectReflectSpeed:1120,
});

const BASE_ANGLE=Object.freeze({right:0,down:Math.PI/2,left:Math.PI,up:-Math.PI/2});
const SYNERGY_WEIGHTS=Object.freeze({perfectCounters:1,crosscuts:1,longReturns:1,terrainRoutes:1,hazardKills:1,gasRoutes:2});
const EPS=1e-7;
const q=v=>Math.round(v*100000)/100000;
const mod=a=>((a%TAU)+TAU)%TAU;
const normalize=(x,y)=>{const m=Math.hypot(x,y);return m>EPS?{x:q(x/m),y:q(y/m),m}:{x:0,y:0,m:0}};
const smoothstep=t=>t*t*(3-2*t);

function initKineticPlayer(p){
  if(!p)return;
  p.vx=Number.isFinite(p.vx)?p.vx:0;
  p.vy=Number.isFinite(p.vy)?p.vy:0;
  p.dashCharge=0;
  p.dashCharging=false;
  p.dashChargeVector={x:1,y:0};
  p.dashCooldown=0;
  p.dash=null;
  p.dashEcho=0;
  p.lastDashSegment=null;
  p.swingParity=0;
  p.pose=0;
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

function beginDashCharge(){
  const p=state.player;
  if(!p||state.mode!=='playing'||p.dashCharging||p.dash||p.dashCooldown>0)return false;
  p.dashCharging=true;
  p.dashCharge=0;
  const d=fallbackDirection(p);
  p.dashChargeVector={x:d.x,y:d.y};
  return true;
}

function releaseDashCharge(){
  const p=state.player;
  if(!p||!p.dashCharging)return false;
  p.dashCharging=false;
  if(state.mode!=='playing'){p.dashCharge=0;return false}
  const held=heldVector(),fallback=fallbackDirection(p),d=held.m>0?held:fallback;
  const charge=clamp(Math.max(.12,p.dashCharge),0,1),curve=smoothstep(charge);
  const speed=lerp(KINETIC_CONFIG.dashMinSpeed,KINETIC_CONFIG.dashMaxSpeed,curve)*(p.buffs.rush>0?1.08:1);
  const duration=lerp(KINETIC_CONFIG.dashMinDuration,KINETIC_CONFIG.dashMaxDuration,curve);
  p.vx=q(d.x*speed);p.vy=q(d.y*speed);
  p.dash={timer:duration,duration,dir:{x:d.x,y:d.y},charge,sx:p.x,sy:p.y,tx:p.x,ty:p.y};
  p.lastDashSegment={sx:p.x,sy:p.y,tx:p.x,ty:p.y};
  p.dashCooldown=KINETIC_CONFIG.dashCooldown+curve*.12;
  p.dashCharge=0;
  p.dashEcho=0;
  p.invuln=Math.max(p.invuln,.052+curve*.035);
  state.stats.dashes++;
  state.shake=Math.max(state.shake,1.6+curve*1.8);
  for(let i=0;i<6;i++)F.spawnParticle?.(p.x-d.x*i*4,p.y-d.y*i*4,'#a9ffaf',22+i*4,.22,1.8);
  audio.dash?.(F.mobilityAt(p.x,p.y).type);
  return true;
}

function cancelDashCharge(){const p=state.player;if(p){p.dashCharging=false;p.dashCharge=0}}

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
  if(blocked&&p.dash){p.dash.timer=Math.min(p.dash.timer,.018);state.stats.blockedSteps++}
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

  const input=heldVector();
  if(p.dashCharging){
    p.dashCharge=clamp(p.dashCharge+dt/KINETIC_CONFIG.dashChargeTime,0,1);
    if(input.m>0)p.dashChargeVector={x:input.x,y:input.y};
  }

  const mobility=F.mobilityAt(p.x,p.y),rush=p.buffs.rush>0?1.12:1;
  const onIce=mobility.type==='ice',maxSpeed=KINETIC_CONFIG.moveSpeed*mobility.move*rush;
  const accel=KINETIC_CONFIG.acceleration*(onIce?.46:1)*(p.dashCharging?.82:1);
  const dashControl=p.dash?.34:1;
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
    p.dash.timer-=dt;p.dash.tx=p.x;p.dash.ty=p.y;
    p.lastDashSegment={sx:p.dash.sx,sy:p.dash.sy,tx:p.x,ty:p.y};
    p.trail.push({x:p.x,y:p.y,life:.16,surface:mobility.type});if(p.trail.length>9)p.trail.shift();
    if(p.dash.timer<=0){p.dash=null;p.dashEcho=.09}
  }
  if(Math.hypot(p.x-ox,p.y-oy)>.02)F.applyTerrainHazard(p,'player');else F.applyTerrainHazard(p,'player');
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
  p.dashCharging=true;p.dashCharge=.58;p.dashChargeVector={x:d.x,y:d.y};
  return releaseDashCharge();
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

function cut(direction){
  const p=state.player;if(!p||state.mode!=='playing'||p.cutCooldown>0)return false;
  const center=angleFor(direction),half=KINETIC_CONFIG.arcDegrees*Math.PI/360,sweepDir=p.swingParity%2===0?1:-1;
  p.swingParity++;
  const startAngle=q(center-sweepDir*half),endAngle=q(center+sweepDir*half);
  const flow=clamp(p.flow/100,0,1),windup=KINETIC_CONFIG.arcWindup,active=KINETIC_CONFIG.arcActive,recovery=lerp(KINETIC_CONFIG.arcRecovery,.092,flow);
  const s={kind:'arc',direction,x:p.x,y:p.y,age:0,phase:'windup',phaseTime:0,windup,active,recovery,life:windup+active+recovery,startAngle,endAngle,angle:startAngle,prevAngle:startAngle,sweepDir,activeProgress:0,perfectWindow:.12,reach:KINETIC_CONFIG.arcReach+(p.buffs.edge>0?22:0),inner:18,thickness:KINETIC_CONFIG.arcThickness,width:64,hits:new Set(),gasShearDone:false};
  state.slashes.push(s);p.cutCooldown=s.life+.018;p.cutDirection=direction;p.facing=direction==='left'?'left':direction==='right'?'right':p.facing;p.recoil=.045;state.stats.cuts++;
  audio.cut?.();
  for(let i=0;i<5;i++)F.spawnParticle?.(p.x,p.y,'#efffc9',14+i*2,.18,1.5);
  if(p.dash||p.dashEcho>0)F.tryDashCutIce?.(s);
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
  const tangentWeight=s.activeProgress>.38&&s.activeProgress<.62?.58:.72;
  return normalize(tangent.x*tangentWeight+target.x*(1-tangentWeight),tangent.y*tangentWeight+target.y*(1-tangentWeight));
}
function shotApproaching(shot){const p=state.player,dx=p.x-shot.x,dy=p.y-shot.y,n=normalize(dx,dy),v=normalize(shot.vx,shot.vy);return n.m>0&&v.m>0&&n.x*v.x+n.y*v.y>.06}
function counterShotArc(shot,s){
  if(shot.dead||shot.friendly||!shotApproaching(shot)||!arcSweepContains(s,shot,3))return false;
  const perfect=Math.abs(s.activeProgress-.5)<=s.perfectWindow;
  const v=returnDirection(shot,s),speed=perfect?KINETIC_CONFIG.perfectReflectSpeed:KINETIC_CONFIG.reflectSpeed;
  shot.originPattern||=shot.pattern;shot.friendly=true;shot.beneficiaryId=null;shot.originalOwnerId||=shot.owner?.id||null;shot.owner=null;shot.pattern='return';
  shot.vx=q(v.x*speed);shot.vy=q(v.y*speed);shot.baseSpeed=speed;shot.damage=perfect?3:2;shot.counterQuality=perfect?'perfect':'normal';shot.counterTargetId=null;shot.reflectedTravel=0;shot.pierces=perfect?1:0;shot.hitIds=new Set();shot.color=perfect?'#fffde8':'#a5ffb4';shot.life=1.72;
  state.stats.counters++;if(perfect)state.stats.perfectCounters++;state.player.flow=clamp(state.player.flow+(perfect?18:9),0,100);state.score+=perfect?130:65;
  if(perfect)F.addCallout?.(shot.x,shot.y-14,'SWEET SPOT','#fff5a8');
  audio.counter?.(perfect);return true;
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
  for(const e of state.enemies)if(!e.dead&&!s.hits.has(e.id)&&arcSweepContains(s,e,1)){s.hits.add(e.id);const d=normalize(e.x-s.x,e.y-s.y);F.damageEnemy(e,1,{x:d.x,y:d.y},{melee:true,arc:true,attack:s})}
  if(state.boss&&!state.boss.dead&&!s.hits.has(state.boss.id)&&arcSweepContains(s,state.boss,2)){s.hits.add(state.boss.id);const d=normalize(state.boss.x-s.x,state.boss.y-s.y);F.damageBoss(1,{x:d.x,y:d.y},{melee:true,arc:true,attack:s})}
  shearGasArc(s);
}

function updateSlashes(dt){
  const p=state.player;if(!p){state.slashes=[];return}
  for(const s of state.slashes){
    s.age+=dt;s.life-=dt;s.x=p.x;s.y=p.y;s.phaseTime+=dt;
    if(s.phase==='windup'&&s.phaseTime>=s.windup){s.phaseTime-=s.windup;s.phase='active';s.prevAngle=s.startAngle;s.angle=s.startAngle}
    if(s.phase==='active'){
      s.activeProgress=clamp(s.phaseTime/s.active,0,1);s.prevAngle=s.angle;s.angle=q(lerp(s.startAngle,s.endAngle,s.activeProgress));
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

Object.assign(F,{beginDashCharge,releaseDashCharge,cancelDashCharge,currentAt,heldVector,requestDash,dashStep,repeatCadence,queueMove,consumeMoveQueue,cut,arcSweepContains,fullArcContains,counterShotArc,updateMovement,updateSlashes});

function onSpaceDown(event){if(String(event.key||'').toLowerCase()!==' '&&event.code!=='Space')return;if(event.repeat||state.mode!=='playing')return;event.preventDefault();beginDashCharge()}
function onSpaceUp(event){if(String(event.key||'').toLowerCase()!==' '&&event.code!=='Space')return;event.preventDefault();releaseDashCharge()}
document.addEventListener('keydown',onSpaceDown,true);
document.addEventListener('keyup',onSpaceUp,true);
window.addEventListener?.('blur',cancelDashCharge);

window.SylvariaKinetics=Object.freeze({version:KINETIC_VERSION,config:KINETIC_CONFIG,snapshot:()=>{const p=state.player,s=state.slashes.at(-1);return{version:KINETIC_VERSION,velocity:p?{x:p.vx,y:p.vy,speed:Math.hypot(p.vx,p.vy)}:null,dashCharge:p?.dashCharge||0,dashCharging:Boolean(p?.dashCharging),dashing:Boolean(p?.dash),arc:s?.kind==='arc'?{phase:s.phase,progress:s.activeProgress||0,angle:s.angle,start:s.startAngle,end:s.endAngle,sweepDir:s.sweepDir,reach:s.reach}:null,current:p?currentAt(p.x,p.y):{x:0,y:0}}}});
