const G=window.Sylvaria091;
const {state}=G,F=G.fn;

export const CHARGE_INTENT_VERSION='0.14.0';
export const CHARGE_INTENT_CONFIG=Object.freeze({retargetTicks:24});
const MOVE_KEYS=new Set(['w','a','s','d']),q=v=>Math.round(v*100000)/100000;
const norm=(x,y)=>{const m=Math.hypot(x,y);return m>1e-7?{x:q(x/m),y:q(y/m),m}:{x:0,y:0,m:0}};
const same=(a,b)=>Boolean(a&&b&&Math.abs(a.x-b.x)<.02&&Math.abs(a.y-b.y)<.02);

function clearIntent(p){if(!p)return;p.v014ChargeCommittedVector=null;p.v014ChargeCandidateVector=null;p.v014ChargeCandidateTicks=0;p.v014ChargeImmediateCommit=false}
function seedIntent(p){if(!p?.dashCharging)return;const held=F.heldVector?.(),source=held?.m?held:norm(p.dashChargeVector?.x||0,p.dashChargeVector?.y||0);if(source?.m)p.v014ChargeCommittedVector={x:source.x,y:source.y}}

const inheritedSetup=F.setupRoom;
F.setupRoom=(...args)=>{const result=inheritedSetup(...args);clearIntent(state.player);return result};
if(state.player)clearIntent(state.player);

const inheritedBegin=F.beginDashCharge;
F.beginDashCharge=(...args)=>{const result=inheritedBegin?.(...args);if(result&&state.player?.dashCharging){clearIntent(state.player);seedIntent(state.player)}return result};

function moveKey(event){const key=String(event.key||'').toLowerCase();return MOVE_KEYS.has(key)?key:null}
window.addEventListener?.('keydown',event=>{if(!moveKey(event))return;const p=state.player;if(p?.dashCharging)p.v014ChargeImmediateCommit=true},true);

const inheritedMovement=F.updateMovement;
F.updateMovement=(dt)=>{
  const p=state.player,inputBefore=p?.dashCharging?F.heldVector?.():null;
  if(p?.dashCharging&&!p.v014ChargeCommittedVector)seedIntent(p);
  const result=inheritedMovement(dt);
  if(!p?.dashCharging)return result;
  let committed=norm(p.v014ChargeCommittedVector?.x||p.dashChargeVector?.x||0,p.v014ChargeCommittedVector?.y||p.dashChargeVector?.y||0);
  const input=inputBefore?.m?inputBefore:F.heldVector?.();
  if(p.v014ChargeImmediateCommit&&input?.m){
    committed=norm(input.x,input.y);p.v014ChargeCommittedVector={x:committed.x,y:committed.y};p.v014ChargeCandidateVector=null;p.v014ChargeCandidateTicks=0;
  }else if(!input?.m){
    p.v014ChargeCandidateVector=null;p.v014ChargeCandidateTicks=0;
  }else if(same(input,committed)){
    p.v014ChargeCandidateVector=null;p.v014ChargeCandidateTicks=0;
  }else{
    const candidate=norm(input.x,input.y);
    if(same(candidate,p.v014ChargeCandidateVector))p.v014ChargeCandidateTicks=(p.v014ChargeCandidateTicks||0)+1;
    else{p.v014ChargeCandidateVector={x:candidate.x,y:candidate.y};p.v014ChargeCandidateTicks=1}
    if(p.v014ChargeCandidateTicks>=CHARGE_INTENT_CONFIG.retargetTicks){committed=candidate;p.v014ChargeCommittedVector={x:candidate.x,y:candidate.y};p.v014ChargeCandidateVector=null;p.v014ChargeCandidateTicks=0}
  }
  p.v014ChargeImmediateCommit=false;
  if(committed.m)p.dashChargeVector={x:committed.x,y:committed.y};
  return result;
};

function heldSetForVector(v){const keys=new Set();if(v.x<-.25)keys.add('a');else if(v.x>.25)keys.add('d');if(v.y<-.25)keys.add('w');else if(v.y>.25)keys.add('s');return keys}
const inheritedRelease=F.releaseDashCharge;
F.releaseDashCharge=()=>{
  const p=state.player;if(!p?.dashCharging)return inheritedRelease?.();
  const committed=norm(p.v014ChargeCommittedVector?.x||p.dashChargeVector?.x||0,p.v014ChargeCommittedVector?.y||p.dashChargeVector?.y||0);if(!committed.m)return inheritedRelease?.();
  const realHeld=state.heldMoves;state.heldMoves=heldSetForVector(committed);
  try{return inheritedRelease?.()}finally{state.heldMoves=realHeld;clearIntent(p)}
};

window.SylvariaChargeIntent=Object.freeze({
  version:CHARGE_INTENT_VERSION,
  config:CHARGE_INTENT_CONFIG,
  snapshot:()=>({
    version:CHARGE_INTENT_VERSION,
    committed:state.player?.v014ChargeCommittedVector?{...state.player.v014ChargeCommittedVector}:null,
    candidate:state.player?.v014ChargeCandidateVector?{...state.player.v014ChargeCandidateVector}:null,
    candidateTicks:state.player?.v014ChargeCandidateTicks||0,
    charging:Boolean(state.player?.dashCharging),
    displayed:state.player?.dashChargeVector?{...state.player.dashChargeVector}:null,
  }),
});
