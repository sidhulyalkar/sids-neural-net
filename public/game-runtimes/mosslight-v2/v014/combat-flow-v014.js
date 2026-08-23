const G=window.Sylvaria091;
const {state,clamp,lerp,FIXED_DT}=G,F=G.fn,BASE_KINETICS=window.SylvariaKinetics;

export const FLOW_VERSION='0.14.0';
export const FLOW_CONFIG=Object.freeze({bladeBuffer:7/120,dashCommitTicks:4,dashSteerBlend:.055,dashSteerMaxRadians:.38,parryDashRefund:12/120,recoveryTicksAtFullFlow:7,minimumReleaseCharge:.12,chargeReleaseGraceTicks:4});
const q=v=>Math.round(v*100000)/100000;
const normalize=(x,y)=>{const m=Math.hypot(x,y);return m>1e-7?{x:q(x/m),y:q(y/m),m}:{x:0,y:0,m:0}};
const smoothstep=t=>t*t*(3-2*t);
const angleDelta=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
const solvedOpeningSpeed=(distance,ticks,decay=BASE_KINETICS.config.dashDecay)=>q(distance*(1-decay)/(FIXED_DT*(1-Math.pow(decay,ticks))));
const dashSpecForCharge=charge=>{const curve=smoothstep(clamp(charge,0,1)),ticks=Math.round(lerp(BASE_KINETICS.config.dashTicksMin,BASE_KINETICS.config.dashTicksMax,curve)),distance=q(lerp(BASE_KINETICS.config.dashDistanceMin,BASE_KINETICS.config.dashDistanceMax,curve));return Object.freeze({charge:q(charge),curve:q(curve),ticks,distance,openingSpeed:solvedOpeningSpeed(distance,ticks)})};
const TAP_DASH=dashSpecForCharge(FLOW_CONFIG.minimumReleaseCharge),FULL_DASH=dashSpecForCharge(1);
export const DASH_DISTANCE_ENVELOPE=Object.freeze({tapMin:TAP_DASH.distance,fullMax:FULL_DASH.distance});
export const DASH_SPEED_ENVELOPE=Object.freeze({tapMin:TAP_DASH.openingSpeed,fullMax:FULL_DASH.openingSpeed});
const MOVE_KEYS=new Set(['w','a','s','d']);

function clearChargeReleaseGrace(p){if(!p)return;p.v014ChargeReleaseGrace=0;p.v014ChargeReleaseVector=null}
function initFlowPlayer(p){if(!p)return;p.bladeBuffer=0;p.bladeQueuedDirection=null;p.lastDashAccuracy=null;p.lastParryDashRefund=null;clearChargeReleaseGrace(p)}
const inheritedSetup=F.setupRoom;
F.setupRoom=(...args)=>{const result=inheritedSetup(...args);initFlowPlayer(state.player);return result};
if(state.player)initFlowPlayer(state.player);

function queueBlade(direction){const p=state.player;if(!p)return false;p.bladeBuffer=FLOW_CONFIG.bladeBuffer;p.bladeQueuedDirection=direction;return true}
function canReleaseQueuedBlade(p){if(!p?.bladeQueuedDirection||p.bladeBuffer<=0||p.cutCooldown>0)return false;if(p.dash?.reactive&&p.dash.elapsedTicks<FLOW_CONFIG.dashCommitTicks)return false;return true}
function steerCommittedDash(p){
  if(!p?.dash?.reactive)return;const input=F.heldVector?.();if(!input?.m)return;
  const dash=p.dash,d=dash.dir;if(!dash.v014LaunchDir)dash.v014LaunchDir={x:d.x,y:d.y};
  const b=FLOW_CONFIG.dashSteerBlend,proposed=normalize(d.x*(1-b)+input.x*b,d.y*(1-b)+input.y*b);if(!proposed.m)return;
  const launchAngle=Math.atan2(dash.v014LaunchDir.y,dash.v014LaunchDir.x),proposedAngle=Math.atan2(proposed.y,proposed.x),delta=clamp(angleDelta(launchAngle,proposedAngle),-FLOW_CONFIG.dashSteerMaxRadians,FLOW_CONFIG.dashSteerMaxRadians),angle=launchAngle+delta;
  dash.dir={x:q(Math.cos(angle)),y:q(Math.sin(angle))};
}
function heldSetForVector(v){const keys=new Set();if(!v)return keys;if(v.x<-.25)keys.add('a');else if(v.x>.25)keys.add('d');if(v.y<-.25)keys.add('w');else if(v.y>.25)keys.add('s');return keys}
function moveKey(event){const key=String(event.key||'').toLowerCase();return MOVE_KEYS.has(key)?key:null}
function onFlowMoveKeyUp(event){
  if(!moveKey(event))return;const p=state.player;if(!p?.dashCharging||p.v014ChargeReleaseGrace>0)return;
  const remembered=normalize(p.dashChargeVector?.x||0,p.dashChargeVector?.y||0);if(!remembered.m)return;
  p.v014ChargeReleaseVector={x:remembered.x,y:remembered.y};p.v014ChargeReleaseGrace=FLOW_CONFIG.chargeReleaseGraceTicks;
}
function onFlowMoveKeyDown(event){if(!moveKey(event))return;const p=state.player;if(p?.dashCharging)clearChargeReleaseGrace(p)}
window.addEventListener?.('keyup',onFlowMoveKeyUp,true);
window.addEventListener?.('keydown',onFlowMoveKeyDown,true);

const inheritedReleaseDashCharge=F.releaseDashCharge;
F.releaseDashCharge=()=>{
  const p=state.player;if(!p?.dashCharging)return inheritedReleaseDashCharge();
  const held=F.heldVector?.();
  if(held?.m){const result=inheritedReleaseDashCharge();clearChargeReleaseGrace(p);return result}
  const remembered=normalize(p.dashChargeVector?.x||0,p.dashChargeVector?.y||0);if(!remembered.m){const result=inheritedReleaseDashCharge();clearChargeReleaseGrace(p);return result}
  const realHeld=state.heldMoves;state.heldMoves=heldSetForVector(remembered);
  try{return inheritedReleaseDashCharge()}finally{state.heldMoves=realHeld;clearChargeReleaseGrace(p)}
};
function onFlowSpaceUp(event){if(String(event.key||'').toLowerCase()!==' '&&event.code!=='Space')return;if(state.mode!=='playing')return;F.releaseDashCharge()}
window.addEventListener?.('keyup',onFlowSpaceUp,true);
function consumeReleasedDashBuffer(p,dt){if(!p||p.dash||p.dashCharging||!p.dashBufferReleased||p.dashBufferHeld||!(p.dashBuffer>0))return false;const cooldownAfter=Math.max(0,(p.dashCooldown||0)-dt),bufferAfter=Math.max(0,p.dashBuffer-dt);if(cooldownAfter>0||bufferAfter<=0)return false;const queued=p.dashQueuedCharge||.18;p.dashCooldown=0;p.dashBuffer=0;p.dashBufferReleased=false;p.dashBufferHeld=false;F.beginDashCharge();if(!p.dashCharging)return false;p.dashCharge=Math.max(.18,queued);F.releaseDashCharge();return Boolean(p.dash)}

const inheritedCut=F.cut;
F.cut=(direction)=>{const p=state.player;if(!p||state.mode!=='playing')return false;const preCommit=Boolean(p.dash?.reactive&&p.dash.elapsedTicks<FLOW_CONFIG.dashCommitTicks);if(preCommit)return queueBlade(direction);if(p.cutCooldown>0){if(p.cutCooldown<=FLOW_CONFIG.bladeBuffer)return queueBlade(direction);return false}const before=state.slashes.length,result=inheritedCut(direction);if(!result)return false;p.bladeBuffer=0;p.bladeQueuedDirection=null;const s=state.slashes.length>before?state.slashes.at(-1):null;if(s?.kind==='arc'){const flow=clamp((p.flow||0)/100,0,1),desired=lerp(10/120,FLOW_CONFIG.recoveryTicksAtFullFlow/120,flow),delta=Math.max(0,(s.recovery||0)-desired);if(delta>0){s.recovery=q(desired);s.life=q(Math.max(0,s.life-delta));p.cutCooldown=q(Math.max(0,p.cutCooldown-delta))}}return true};

const inheritedMovement=F.updateMovement;
F.updateMovement=(dt)=>{
  const p=state.player;if(p)consumeReleasedDashBuffer(p,dt);const dashRef=p?.dash?.reactive?p.dash:null;if(p)steerCommittedDash(p);
  const chargeReleaseVector=p?.dashCharging&&p.v014ChargeReleaseGrace>0&&p.v014ChargeReleaseVector?{...p.v014ChargeReleaseVector}:null;
  if(dashRef&&!Number.isFinite(dashRef.v014PathTravel)){dashRef.v014PathTravel=0;dashRef.v014MaxSteerAngle=0;dashRef.v014MaxVelocityAlignmentError=0;dashRef.v014MaxScalarSpeedError=0}
  const ox=p?.x??0,oy=p?.y??0,expectedSpeed=dashRef?.speed??0,expectedDir=dashRef?{x:dashRef.dir.x,y:dashRef.dir.y}:null;
  const held=dashRef?state.heldMoves:null;if(dashRef)state.heldMoves=new Set();let result;try{result=inheritedMovement(dt)}finally{if(dashRef)state.heldMoves=held}
  if(chargeReleaseVector&&p?.dashCharging){p.dashChargeVector={...chargeReleaseVector};p.v014ChargeReleaseGrace=Math.max(0,(p.v014ChargeReleaseGrace||0)-1);if(p.v014ChargeReleaseGrace<=0)p.v014ChargeReleaseVector=null}
  if(dashRef&&p){
    dashRef.v014PathTravel=q((dashRef.v014PathTravel||0)+Math.hypot(p.x-ox,p.y-oy));
    if(expectedDir){
      const launch=dashRef.v014LaunchDir||expectedDir,launchAngle=Math.atan2(launch.y,launch.x),dirAngle=Math.atan2(expectedDir.y,expectedDir.x),velocityAngle=Math.atan2(p.vy,p.vx),velocityMagnitude=Math.hypot(p.vx,p.vy);
      dashRef.v014MaxSteerAngle=Math.max(dashRef.v014MaxSteerAngle||0,Math.abs(angleDelta(launchAngle,dirAngle)));
      dashRef.v014MaxVelocityAlignmentError=Math.max(dashRef.v014MaxVelocityAlignmentError||0,Math.abs(angleDelta(dirAngle,velocityAngle)));
      dashRef.v014MaxScalarSpeedError=Math.max(dashRef.v014MaxScalarSpeedError||0,Math.abs(velocityMagnitude-expectedSpeed));
    }
    if(!p.dash){p.lastDashAccuracy={distanceTarget:q(dashRef.distanceTarget||0),pathTravel:q(dashRef.v014PathTravel||0),displacement:q(Math.hypot(p.x-dashRef.sx,p.y-dashRef.sy)),totalTicks:dashRef.totalTicks||0,maxSteerAngle:q(dashRef.v014MaxSteerAngle||0),maxVelocityAlignmentError:q(dashRef.v014MaxVelocityAlignmentError||0),maxScalarSpeedError:q(dashRef.v014MaxScalarSpeedError||0)}}
  }
  if(!p)return result;if(p.bladeBuffer>0)p.bladeBuffer=Math.max(0,p.bladeBuffer-dt);if(p.bladeBuffer<=0&&!canReleaseQueuedBlade(p)){if(p.bladeBuffer<=0)p.bladeQueuedDirection=null;return result}if(canReleaseQueuedBlade(p)){const direction=p.bladeQueuedDirection;p.bladeQueuedDirection=null;p.bladeBuffer=0;F.cut(direction)}return result;
};

const inheritedSlashes=F.updateSlashes;
F.updateSlashes=(dt)=>{
  const before=state.stats.perfectCounters||0,result=inheritedSlashes(dt),after=state.stats.perfectCounters||0,p=state.player;
  if(p&&after>before){
    const count=after-before,refund=q(count*FLOW_CONFIG.parryDashRefund),beforeCooldown=q(p.dashCooldown||0),afterCooldown=q(Math.max(0,beforeCooldown-refund));
    p.dashCooldown=afterCooldown;
    p.lastParryDashRefund={counter:after,count,refund,beforeCooldown,afterCooldown,time:q(state.totalTime),worldDepth:state.worldDepth,dashing:Boolean(p.dash)};
  }
  return result;
};

window.SylvariaFlowCombat=Object.freeze({version:FLOW_VERSION,config:FLOW_CONFIG,dashDistanceEnvelope:DASH_DISTANCE_ENVELOPE,dashSpeedEnvelope:DASH_SPEED_ENVELOPE,snapshot:()=>({version:FLOW_VERSION,bladeBuffered:Boolean(state.player?.bladeQueuedDirection&&state.player?.bladeBuffer>0),bladeBuffer:state.player?.bladeBuffer||0,bladeQueuedDirection:state.player?.bladeQueuedDirection||null,dashCommitTicks:FLOW_CONFIG.dashCommitTicks,dashSteerBlend:FLOW_CONFIG.dashSteerBlend,dashSteerMaxRadians:FLOW_CONFIG.dashSteerMaxRadians,parryDashRefund:FLOW_CONFIG.parryDashRefund,chargeReleaseGraceTicks:FLOW_CONFIG.chargeReleaseGraceTicks,chargeReleaseGrace:state.player?.v014ChargeReleaseGrace||0,dashDistanceEnvelope:DASH_DISTANCE_ENVELOPE,dashSpeedEnvelope:DASH_SPEED_ENVELOPE,dashChargeVector:state.player?.dashChargeVector?{...state.player.dashChargeVector}:null,lastDashAccuracy:state.player?.lastDashAccuracy||null,lastParryDashRefund:state.player?.lastParryDashRefund||null})});