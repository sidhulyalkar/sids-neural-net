const G=window.Sylvaria091;
const {state,clamp,lerp}=G,F=G.fn;

export const FLOW_VERSION='0.14.0';
export const FLOW_CONFIG=Object.freeze({
  bladeBuffer:7/120,
  dashCommitTicks:4,
  dashSteerBlend:.055,
  parryDashRefund:12/120,
  recoveryTicksAtFullFlow:7,
});

const q=v=>Math.round(v*100000)/100000;
const normalize=(x,y)=>{const m=Math.hypot(x,y);return m>1e-7?{x:q(x/m),y:q(y/m),m}:{x:0,y:0,m:0}};

function initFlowPlayer(p){
  if(!p)return;
  p.bladeBuffer=0;
  p.bladeQueuedDirection=null;
}

const inheritedSetup=F.setupRoom;
F.setupRoom=(...args)=>{
  const result=inheritedSetup(...args);
  initFlowPlayer(state.player);
  return result;
};
if(state.player)initFlowPlayer(state.player);

function queueBlade(direction){
  const p=state.player;if(!p)return false;
  p.bladeBuffer=FLOW_CONFIG.bladeBuffer;
  p.bladeQueuedDirection=direction;
  return true;
}

function canReleaseQueuedBlade(p){
  if(!p?.bladeQueuedDirection||p.bladeBuffer<=0||p.cutCooldown>0)return false;
  if(p.dash?.reactive&&p.dash.elapsedTicks<FLOW_CONFIG.dashCommitTicks)return false;
  return true;
}

function steerCommittedDash(p){
  if(!p?.dash?.reactive)return;
  const input=F.heldVector?.();if(!input?.m)return;
  const b=FLOW_CONFIG.dashSteerBlend,d=p.dash.dir;
  const steered=normalize(d.x*(1-b)+input.x*b,d.y*(1-b)+input.y*b);
  if(steered.m)p.dash.dir={x:steered.x,y:steered.y};
}

const inheritedCut=F.cut;
F.cut=(direction)=>{
  const p=state.player;if(!p||state.mode!=='playing')return false;
  const preCommit=Boolean(p.dash?.reactive&&p.dash.elapsedTicks<FLOW_CONFIG.dashCommitTicks);
  if(preCommit)return queueBlade(direction);
  if(p.cutCooldown>0){
    if(p.cutCooldown<=FLOW_CONFIG.bladeBuffer)return queueBlade(direction);
    return false;
  }
  const before=state.slashes.length,result=inheritedCut(direction);
  if(!result)return false;
  p.bladeBuffer=0;p.bladeQueuedDirection=null;
  const s=state.slashes.length>before?state.slashes.at(-1):null;
  if(s?.kind==='arc'){
    const flow=clamp((p.flow||0)/100,0,1),desired=lerp(10/120,FLOW_CONFIG.recoveryTicksAtFullFlow/120,flow),delta=Math.max(0,(s.recovery||0)-desired);
    if(delta>0){s.recovery=q(desired);s.life=q(Math.max(0,s.life-delta));p.cutCooldown=q(Math.max(0,p.cutCooldown-delta))}
  }
  return true;
};

const inheritedMovement=F.updateMovement;
F.updateMovement=(dt)=>{
  const p=state.player;
  if(p)steerCommittedDash(p);
  const result=inheritedMovement(dt);
  if(!p)return result;
  if(p.bladeBuffer>0)p.bladeBuffer=Math.max(0,p.bladeBuffer-dt);
  if(p.bladeBuffer<=0&&!canReleaseQueuedBlade(p)){
    if(p.bladeBuffer<=0)p.bladeQueuedDirection=null;
    return result;
  }
  if(canReleaseQueuedBlade(p)){
    const direction=p.bladeQueuedDirection;p.bladeQueuedDirection=null;p.bladeBuffer=0;F.cut(direction);
  }
  return result;
};

const inheritedSlashes=F.updateSlashes;
F.updateSlashes=(dt)=>{
  const before=state.stats.perfectCounters||0,result=inheritedSlashes(dt),after=state.stats.perfectCounters||0;
  if(state.player&&after>before){
    const refund=(after-before)*FLOW_CONFIG.parryDashRefund;
    state.player.dashCooldown=q(Math.max(0,(state.player.dashCooldown||0)-refund));
  }
  return result;
};

window.SylvariaFlowCombat=Object.freeze({
  version:FLOW_VERSION,
  config:FLOW_CONFIG,
  snapshot:()=>({
    version:FLOW_VERSION,
    bladeBuffered:Boolean(state.player?.bladeQueuedDirection&&state.player?.bladeBuffer>0),
    bladeBuffer:state.player?.bladeBuffer||0,
    bladeQueuedDirection:state.player?.bladeQueuedDirection||null,
    dashCommitTicks:FLOW_CONFIG.dashCommitTicks,
    dashSteerBlend:FLOW_CONFIG.dashSteerBlend,
    parryDashRefund:FLOW_CONFIG.parryDashRefund,
  }),
});
