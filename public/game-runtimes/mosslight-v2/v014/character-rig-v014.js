const G=window.Sylvaria091;
const {state,DIRS,clamp}=G;

export const CHARACTER_RIG_VERSION='0.14.0';

// The painted frog atlas faces world-up in its unrotated frame. Gameplay angles
// use world-right as zero, so every renderer must apply this basis correction.
const SPRITE_FORWARD_OFFSET=Math.PI/2;
const DEFAULT_FORWARD=Object.freeze({x:1,y:0});
const q=v=>Math.round(v*100000)/100000;
const norm=(x,y)=>{const m=Math.hypot(x,y);return m>1e-7?{x:q(x/m),y:q(y/m),m}:{x:0,y:0,m:0}};
const angleDelta=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));

function activeArc(){
  for(let i=state.slashes.length-1;i>=0;i--){const s=state.slashes[i];if(s?.kind==='arc'&&s.life>0)return s}
  return null;
}
function commandedForward(p,slash=activeArc()){
  if(slash){const d=DIRS[slash.direction]||DEFAULT_FORWARD;return{x:d.x,y:d.y,m:1,source:'attack'}}
  if(p?.dash?.reactive){const d=norm(p.dash.dir?.x||0,p.dash.dir?.y||0);if(d.m)return{...d,source:'dash'}}
  if(p?.dashCharging){const d=norm(p.dashChargeVector?.x||0,p.dashChargeVector?.y||0);if(d.m)return{...d,source:'charge'}}
  const velocity=norm(p?.vx||0,p?.vy||0);if(velocity.m>40)return{...velocity,source:'velocity'};
  const d=DIRS[p?.cutDirection]||DIRS[p?.facing==='left'?'left':'right']||DEFAULT_FORWARD;return{x:d.x,y:d.y,m:1,source:'memory'};
}
function localToWorld(cx,cy,rotation,lx,ly){const c=Math.cos(rotation),s=Math.sin(rotation);return{x:q(cx+lx*c-ly*s),y:q(cy+lx*s+ly*c)}}

function poseFor(p=state.player,slash=activeArc()){
  if(!p)return null;
  const forward=commandedForward(p,slash),facingAngle=Math.atan2(forward.y,forward.x),spriteRotation=facingAngle+SPRITE_FORWARD_OFFSET;
  const base=Math.max(48,p.r*3.05),dashSpeed=p.dash?.speed||0,dashing=Boolean(p.dash?.reactive),charging=Boolean(p.dashCharging);
  const dashStretch=dashing?clamp(.08+dashSpeed/5200,.08,.28):0,chargeCrouch=charging?clamp((p.dashCharge||0)*.11,0,.11):0;
  const attackPhase=slash?.phase||null,windup=attackPhase==='windup'?clamp((slash.phaseTime||0)/(slash.windup||1),0,1):0,recovery=attackPhase==='recovery'?clamp((slash.phaseTime||0)/(slash.recovery||1),0,1):0;
  const recoil=clamp((p.recoil||0)/.14,0,1),attackBrace=windup*.055+(1-recovery)*(attackPhase==='active'?.035:0);
  const bodyW=base*(1-dashStretch*.33+chargeCrouch*.18+attackBrace),bodyH=base*(1+dashStretch*.26-chargeCrouch*.12-attackBrace*.32);
  // Pose bob is intentionally applied once, here. Every attached socket consumes
  // this same body center, so the tongue cannot drift when the frog bobs or recoils.
  const bodyX=q(p.x-forward.x*recoil*2.6),bodyY=q(p.y-(p.pose||0)*1.5-forward.y*recoil*2.6);
  // Atlas mouth sits slightly forward of sprite center. Keep it a fixed local
  // socket instead of moving the root around the body with the tongue sweep angle.
  const mouth=localToWorld(bodyX,bodyY,spriteRotation,0,-bodyH*.075);
  const eyes=localToWorld(bodyX,bodyY,spriteRotation,0,-bodyH*.25);
  const rear=localToWorld(bodyX,bodyY,spriteRotation,0,bodyH*.31);
  return Object.freeze({
    version:CHARACTER_RIG_VERSION,
    root:Object.freeze({x:q(p.x),y:q(p.y)}),
    forward:Object.freeze({x:q(forward.x),y:q(forward.y),source:forward.source}),
    facingAngle:q(facingAngle),spriteRotation:q(spriteRotation),
    body:Object.freeze({x:bodyX,y:bodyY,w:q(bodyW),h:q(bodyH),rotation:q(spriteRotation),foot:q(p.y+p.r*.68)}),
    mouth:Object.freeze(mouth),eyes:Object.freeze(eyes),rear:Object.freeze(rear),
    state:Object.freeze({dashing,charging,attackPhase,windup:q(windup),recovery:q(recovery),recoil:q(recoil)}),
  });
}
function mouthForAttack(s,p=state.player){return poseFor(p,s)?.mouth||null}
function attachmentError(s,p=state.player){const pose=poseFor(p,s);if(!pose||!s)return 0;const root=Math.hypot((s.x??p.x)-pose.root.x,(s.y??p.y)-pose.root.y);return q(root)}

window.SylvariaCharacterRig=Object.freeze({
  version:CHARACTER_RIG_VERSION,
  spriteForwardOffset:SPRITE_FORWARD_OFFSET,
  pose:poseFor,mouthForAttack,attachmentError,
  snapshot:()=>{const s=activeArc(),pose=poseFor(state.player,s);return{version:CHARACTER_RIG_VERSION,pose,activeArc:Boolean(s),attachmentError:s?attachmentError(s,state.player):0}},
});
