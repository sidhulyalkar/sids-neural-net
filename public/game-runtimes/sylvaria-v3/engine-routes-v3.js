import{SylvariaEngine as SaplineEngine}from'./engine-sapline-v3.js';
import{BARK_RAIL}from'./config-v3.js';
import{BARK_RAILS,ROUTE_ANCHORS}from'./routes-v3.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;

// BarkRail is a one-way sloped tree surface. It exists in authoritative physics,
// not only presentation, so organic routes remain honest at high traversal speed.
export class SylvariaEngine extends SaplineEngine{
  freshStats(){return{...super.freshStats(),barkRailLandings:0,masteryRailLandings:0}}

  reset(play=true){
    const snap=super.reset(play);
    this.installRouteTopology();
    return this.snapshot();
  }

  installRouteTopology(){
    this.world.rails=BARK_RAILS.map(rail=>({...rail}));
    this.world.anchors=[...(this.world.anchors||[]),...ROUTE_ANCHORS.map(anchor=>({...anchor}))];
    const boss=this.world.boss;
    if(boss){
      boss.name='CROWN GIRDLER';
      boss.kind='girdler';
      boss.w=154;boss.h=132;
      boss.machineMounted=true;
      boss.clampCount=3;
    }
  }

  railPoint(rail,t){return{x:lerp(rail.ax,rail.bx,t),y:lerp(rail.ay,rail.by,t)}}

  railYAtX(rail,x){
    const dx=rail.bx-rail.ax;if(Math.abs(dx)<1e-6)return null;
    const t=(x-rail.ax)/dx;if(t<0||t>1)return null;
    return{y:lerp(rail.ay,rail.by,t),t};
  }

  anchorPosition(anchor){
    if(anchor?.rail){
      const rail=(this.world.rails||[]).find(item=>item.id===anchor.rail);if(!rail)return null;
      return this.railPoint(rail,clamp(anchor.t??.5,0,1));
    }
    return super.anchorPosition(anchor);
  }

  collideVertical(dy){
    const p=this.state.player,oldY=p.y,prevBottom=oldY+p.h/2,intendedBottom=oldY+dy+p.h/2,previousGround=p.groundId;
    const inherited=super.collideVertical(dy);
    if(dy<0||p.dropTimer>0||!(this.world.rails?.length))return inherited;

    const inheritedSurface=inherited?p.y+p.h/2:Infinity;
    let best=null,bestY=Infinity;
    for(const rail of this.world.rails){
      const minX=Math.min(rail.ax,rail.bx)-BARK_RAIL.endpointMargin,maxX=Math.max(rail.ax,rail.bx)+BARK_RAIL.endpointMargin;
      if(p.x<minX||p.x>maxX)continue;
      const hit=this.railYAtX(rail,clamp(p.x,Math.min(rail.ax,rail.bx),Math.max(rail.ax,rail.bx)));if(!hit)continue;
      const surface=hit.y-(rail.thickness||BARK_RAIL.defaultThickness)/2;
      if(prevBottom>surface+BARK_RAIL.landingTolerance||intendedBottom<surface)continue;
      if(surface<bestY){bestY=surface;best=rail}
    }
    if(!best||bestY>inheritedSurface+.5)return inherited;

    p.y=bestY-p.h/2;p.vy=0;p.onGround=true;p.groundId=best.id;p.coyote=this.moveCoyote?.()??.11;p.airDash=true;
    if(previousGround!==best.id){
      this.state.stats.barkRailLandings++;
      if(best.route==='mastery')this.state.stats.masteryRailLandings++;
      this.emit('barkRailLand',{railId:best.id,route:best.route});
    }
    return best;
  }

  snapshot(){
    const snap=super.snapshot();
    return{...snap,rails:(this.world.rails||[]).map(rail=>({...rail}))};
  }
}
