import{SylvariaEngine as FeelEngine}from'./engine-feel-v3.js';
import{SAPLINE}from'./config-v3.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const norm=(x,y)=>{const m=Math.hypot(x,y)||1;return{x:x/m,y:y/m}};

// Sapline is intentionally a physics layer, not a canned grapple animation.
// The player keeps spring-generated tangential velocity. Adaptive damping acts
// only on radial motion near rest length so the line settles without becoming a
// floaty bungee or silently erasing a skilled sling trajectory.
export class SylvariaEngine extends FeelEngine{
  freshStats(){return{...super.freshStats(),saplineAttaches:0,saplineLaunches:0,maxSaplineSpeed:0,maxSaplineEnergy:0}}

  makePlayer(){
    return{
      ...super.makePlayer(),
      sapline:null,
      saplineCooldown:0,
      sameAnchorCooldown:0,
      lastSaplineAnchor:null,
      saplineCandidate:null,
      saplineCandidateTangent:null,
    };
  }

  anchorPosition(anchor){
    if(!anchor)return null;
    if(anchor.platform){
      const platform=this.findPlatform(anchor.platform);
      if(!platform||platform.broken)return null;
      return{x:platform.x+(anchor.offsetX||0),y:platform.y+(platform.flex||0)*16+(anchor.offsetY||0)};
    }
    return{x:anchor.x,y:anchor.y};
  }

  saplineAim(){
    const p=this.state.player,d=this.input.direction();
    if(d.x||d.y)return d;
    return norm(p.facing*.22,-1);
  }

  releaseTangentFor(pos){
    const p=this.state.player,dx=pos.x-p.x,dy=pos.y-p.y,rad=norm(dx,dy);
    const a={x:-rad.y,y:rad.x},b={x:rad.y,y:-rad.x};
    const speed=Math.hypot(p.vx,p.vy),guide=speed>70?norm(p.vx,p.vy):norm(p.facing*.7,-.45);
    return a.x*guide.x+a.y*guide.y>=b.x*guide.x+b.y*guide.y?a:b;
  }

  findSaplineAnchor(){
    const p=this.state.player,aim=this.saplineAim();let best=null,bestScore=Infinity;
    for(const anchor of this.world.anchors||[]){
      if(anchor.id===p.lastSaplineAnchor&&p.sameAnchorCooldown>0)continue;
      const pos=this.anchorPosition(anchor);if(!pos)continue;
      const dx=pos.x-p.x,dy=pos.y-p.y,dist=Math.hypot(dx,dy);
      if(dist<SAPLINE.minAttachDistance||dist>SAPLINE.maxRange)continue;
      const ux=dx/dist,uy=dy/dist,dot=ux*aim.x+uy*aim.y;
      if(dot<SAPLINE.acquireDot)continue;
      const score=dist+(1-dot)*SAPLINE.directionPenalty+Math.max(0,dy)*SAPLINE.belowPenalty;
      if(score<bestScore){bestScore=score;best={anchor,pos,dist}}
    }
    p.saplineCandidate=best?.anchor.id||null;
    p.saplineCandidateTangent=best?this.releaseTangentFor(best.pos):null;
    return best;
  }

  startSapline(){
    const p=this.state.player;if(p.sapline||p.saplineCooldown>0||this.state.mode!=='playing')return false;
    const target=this.findSaplineAnchor();if(!target)return false;
    if(p.vineId)this.releaseVine(false);
    const rest=clamp(target.dist*SAPLINE.attachRestRatio,SAPLINE.minLength,target.dist),extension=Math.max(0,target.dist-rest);
    p.sapline={anchorId:target.anchor.id,rest,attachDistance:target.dist,extension,peakExtension:extension,energy:.5*SAPLINE.spring*extension*extension,damping:SAPLINE.dampingFree,age:0};
    p.onGround=false;p.groundId=null;p.coyote=0;p.wallDir=0;p.wallId=null;p.saplineCandidateTangent=null;
    this.state.stats.saplineAttaches++;
    this.spawnFx(target.pos.x,target.pos.y,'#9cf0b8',8,90);
    this.emit('saplineAttach',{anchorId:target.anchor.id});
    return true;
  }

  releaseSapline(launch=true){
    const p=this.state.player,tether=p.sapline;if(!tether)return false;
    const anchor=(this.world.anchors||[]).find(item=>item.id===tether.anchorId),pos=this.anchorPosition(anchor);
    let extension=tether.extension||0,boost=0;
    if(launch&&pos&&tether.age>=1/30){
      const dx=pos.x-p.x,dy=pos.y-p.y,dist=Math.hypot(dx,dy)||1,ux=dx/dist,uy=dy/dist;
      extension=Math.max(extension,dist-tether.rest);
      boost=Math.min(SAPLINE.releaseBoostMax,Math.max(0,extension)*SAPLINE.releaseBoostPerPx);
      p.vx+=ux*boost;p.vy+=uy*boost;
      // Loaded releases from an anchor above the guardian get a crisp vertical
      // snap, but the spring/tangent velocity remains the dominant trajectory.
      if(pos.y<p.y-24&&extension>18)p.vy=Math.min(p.vy,-Math.min(455,SAPLINE.releaseUpFloor+boost*.28));
      const speed=Math.hypot(p.vx,p.vy);
      if(speed>SAPLINE.maxReleaseSpeed){const k=SAPLINE.maxReleaseSpeed/speed;p.vx*=k;p.vy*=k}
      if(extension>12){this.state.stats.saplineLaunches++;this.emit('saplineLaunch',{anchorId:tether.anchorId,extension,energy:tether.energy||0,speed:Math.hypot(p.vx,p.vy)})}
    }
    p.lastSaplineAnchor=tether.anchorId;p.sameAnchorCooldown=SAPLINE.sameAnchorCooldown;p.saplineCooldown=SAPLINE.detachCooldown;p.sapline=null;p.saplineCandidate=null;p.saplineCandidateTangent=null;
    if(launch)this.spawnFx(p.x,p.y,'#9cf0b8',7,100);
    this.emit('saplineRelease',{launch,extension,boost});
    return true;
  }

  updateSapline(dt){
    const p=this.state.player,tether=p.sapline;if(!tether)return;
    const anchor=(this.world.anchors||[]).find(item=>item.id===tether.anchorId),pos=this.anchorPosition(anchor);
    if(!pos){this.releaseSapline(false);return}
    tether.age+=dt;tether.rest=Math.max(SAPLINE.minLength,tether.rest-SAPLINE.reelSpeed*dt);
    const dx=pos.x-p.x,dy=pos.y-p.y,dist=Math.hypot(dx,dy)||1,ux=dx/dist,uy=dy/dist;
    const extension=Math.max(0,dist-tether.rest),radialVelocity=p.vx*ux+p.vy*uy;
    const settleByExtension=1-clamp(extension/SAPLINE.settleExtension,0,1);
    const settleBySpeed=clamp(Math.abs(radialVelocity)/SAPLINE.settleRadialSpeed,0,1);
    const damping=lerp(SAPLINE.dampingFree,SAPLINE.dampingSettle,settleByExtension*settleBySpeed);
    const springAccel=clamp(extension*SAPLINE.spring-radialVelocity*damping,0,SAPLINE.maxAccel);
    const tx=-uy,ty=ux,pump=this.input.axisX();
    p.vx+=(ux*springAccel+tx*pump*SAPLINE.tangentAccel)*dt;
    p.vy+=(uy*springAccel+ty*pump*SAPLINE.tangentAccel)*dt;
    const speed=Math.hypot(p.vx,p.vy);
    if(speed>SAPLINE.maxReleaseSpeed){const k=SAPLINE.maxReleaseSpeed/speed;p.vx*=k;p.vy*=k}
    if(extension>12&&uy<-.15){p.onGround=false;p.groundId=null}
    const energy=.5*SAPLINE.spring*extension*extension;
    tether.extension=extension;tether.peakExtension=Math.max(tether.peakExtension||0,extension);tether.energy=energy;tether.damping=damping;tether.tangent=this.releaseTangentFor(pos);
    this.state.stats.maxSaplineSpeed=Math.max(this.state.stats.maxSaplineSpeed,Math.hypot(p.vx,p.vy));
    this.state.stats.maxSaplineEnergy=Math.max(this.state.stats.maxSaplineEnergy,energy);
  }

  startAirDash(){if(this.state.player.sapline)this.releaseSapline(false);super.startAirDash()}

  tryGrabVine(){const grabbed=super.tryGrabVine();if(grabbed&&this.state.player.sapline)this.releaseSapline(false);return grabbed}

  hurtPlayer(sourceX,amount=1){if(this.state.player.sapline)this.releaseSapline(false);super.hurtPlayer(sourceX,amount)}

  respawnFromFall(){if(this.state.player.sapline)this.releaseSapline(false);super.respawnFromFall();const p=this.state.player;p.sapline=null;p.saplineCandidate=null;p.saplineCandidateTangent=null;p.saplineCooldown=0;p.sameAnchorCooldown=0}

  updatePlayer(dt){
    const p=this.state.player;
    p.saplineCooldown=Math.max(0,(p.saplineCooldown||0)-dt);
    p.sameAnchorCooldown=Math.max(0,(p.sameAnchorCooldown||0)-dt);
    if(!p.sapline&&this.input.take('tether'))this.startSapline();
    const tetheredBefore=!!p.sapline,canopyStepBefore=p.airDash;
    super.updatePlayer(dt);
    // A taut line can skim a ledge for one simulation tick. That contact must not
    // become a free Canopy Step refill; release the Sapline and make a committed
    // landing, Bark Grip, or Downstrike rebound to restore aerial mobility.
    if(tetheredBefore&&p.sapline&&!canopyStepBefore)p.airDash=false;
    if(!p.sapline){if(this.input.is('tether'))this.findSaplineAnchor();else{p.saplineCandidate=null;p.saplineCandidateTangent=null}return}
    if(!this.input.is('tether')){this.releaseSapline(true);return}
    this.updateSapline(dt);
  }

  snapshot(){
    const snap=super.snapshot(),p=this.state.player,tether=p.sapline;
    const anchor=tether?(this.world.anchors||[]).find(item=>item.id===tether.anchorId):null,pos=this.anchorPosition(anchor);
    return{
      ...snap,
      player:{...snap.player,sapline:tether?{anchorId:tether.anchorId,rest:tether.rest,extension:tether.extension,peakExtension:tether.peakExtension,energy:tether.energy,damping:tether.damping,tangent:tether.tangent,age:tether.age,anchor:pos}:null,saplineCandidate:p.saplineCandidate,saplineCandidateTangent:p.saplineCandidateTangent},
      anchors:(this.world.anchors||[]).map(item=>({id:item.id,...this.anchorPosition(item)})),
    };
  }
}
