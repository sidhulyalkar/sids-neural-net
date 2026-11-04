import type {Point} from "./model";

/**
 * Authored alpine riding zones. Distances are stylized world units.
 * No renderer dependency: collision, mesh generation, QA and route planning
 * all read the same analytic dimensions and feature coordinates.
 */
export const ALPINE_HALFPIPE={
  centerX:-24, startZ:-84, endZ:-66,
  floorHalfWidth:2.05, rimHalfWidth:6.25,
  outerFeather:2.15, bankHeight:3.55,
} as const;

export const GLACIER_PASSAGE={
  westX:-15, eastX:7, centerZ:-81,
  innerHalfWidth:2.5, outerHalfWidth:3.12,
  clearanceHeight:4.9, cutDepth:4.15,
  entranceBlend:3.4,
} as const;

/** Rocky ribs are intentionally outside sport clearances. The art and
 * geology layers use one manifest to avoid mismatched placements. */
export const ALPINE_ROCK_RIBS=[
  [-27,-74,3.9],[-25,-68,4.5],[-29,-61,5.1],[-23,-58,3.5],
  [-24,-45,4.0],[-18,-76,2.9],[-9,-89,2.5],[12,-89,3.2],
  [15,-55,2.8],[17,-36,2.7],[39,-65,3.0],[42,-57,3.7],
  [38,-49,3.2],[35,-37,2.9],
] as const;

export const ALPINE_KICKERS=[
  {id:"alpine-tabletop",point:{x:-24,z:-79.2},heading:{x:0,z:-1},radius:3.05,lift:6.8},
  {id:"alpine-transfer-hip",point:{x:-16,z:-56},heading:{x:.08,z:.99679},radius:2.8,lift:5.2},
] as const;

export const ALPINE_FEATURE_BOXES=[
  {id:"alpine-flat-box",from:{x:-11.3,z:-69.7},to:{x:-11.7,z:-76.7},halfWidth:.88,lift:.78},
] as const;

export const ALPINE_RAIL_CHAINS=[
  {id:"alpine-serpent",radius:.12,
    points:[{x:-13.2,z:-65},{x:-12.9,z:-67.6},{x:-12.6,z:-69.9},{x:-13.2,z:-72.0},
      {x:-14.1,z:-74.0},{x:-14.6,z:-76.3},{x:-14.1,z:-78.5}],
    heights:[.8,.96,1.1,1.08,.92,.83,.73]},
  {id:"alpine-rainbow",radius:.14,
    points:[{x:-9.8,z:-64},{x:-10.05,z:-65.4},{x:-10.3,z:-66.8},
      {x:-10.55,z:-68.2},{x:-10.8,z:-69.6}],
    heights:[.6,.96,1.28,.96,.6]},
  {id:"alpine-box-spine",radius:.26,
    points:[{x:-11.3,z:-69.7},{x:-11.4,z:-71.45},{x:-11.5,z:-73.2},
      {x:-11.6,z:-74.95},{x:-11.7,z:-76.7}],
    heights:[.78,.78,.78,.78,.78]},
] as const;

export const ALPINE_PARK_RAILS=ALPINE_RAIL_CHAINS.flatMap(chain=>
  chain.points.slice(0,-1).map((a,index)=>({
    id:chain.id+"-"+index,a,b:chain.points[index+1],
    role:"sport" as const,radius:chain.radius,
    lift:chain.heights[index],liftEnd:chain.heights[index+1],
    chainId:chain.id,segment:index,
  })));

const clamp01=(n:number)=>Math.max(0,Math.min(1,n));
export const smooth01=(v:number)=>{const t=clamp01(v);return t*t*(3-2*t);};

export function alpineHalfpipeStrength(p:Point):number{
  const h=ALPINE_HALFPIPE;
  if(p.z<h.startZ||p.z>h.endZ||Math.abs(p.x-h.centerX)>h.rimHalfWidth+h.outerFeather)return 0;
  const entry=smooth01((p.z-h.startZ)/3);
  const exit=1-smooth01((p.z-(h.endZ-3))/3);
  const side=1-smooth01((Math.abs(p.x-h.centerX)-h.rimHalfWidth)/h.outerFeather);
  return entry*exit*side;
}

/** The two carved sidewalls have a smooth derivative at floor and lip. */
export function halfpipeBankRise(p:Point):number{
  const h=ALPINE_HALFPIPE;
  const lateral=Math.abs(p.x-h.centerX);
  return h.bankHeight*smooth01(
    (lateral-h.floorHalfWidth)/(h.rimHalfWidth-h.floorHalfWidth));
}

/**
 * Sculpt the true surface rather than displaying a separate floaty halfpipe.
 * The centerline is the untouched natural longitudinal grade, while the
 * cross-section blends into the original mountain at every outer edge.
 */
export function alpineHalfpipeHeight(
  p:Point,base:number,centerline:(z:number)=>number,
):number{
  const influence=alpineHalfpipeStrength(p);
  if(influence===0)return base;
  return base+(centerline(p.z)+halfpipeBankRise(p)-base)*influence;
}

export function glacierPassageStrength(p:Point):number{
  const g=GLACIER_PASSAGE;
  if(p.x<g.westX-g.entranceBlend||p.x>g.eastX+g.entranceBlend||
    Math.abs(p.z-g.centerZ)>g.outerHalfWidth+2)return 0;
  const along=smooth01((p.x-(g.westX-g.entranceBlend))/(g.entranceBlend*2))*
    (1-smooth01((p.x-(g.eastX-g.entranceBlend))/(g.entranceBlend*2)));
  const across=1-smooth01(
    (Math.abs(p.z-g.centerZ)-g.innerHalfWidth)/(g.outerHalfWidth+2-g.innerHalfWidth));
  return along*across;
}

/** A snow-cut slot makes room for the ice vault. Both portals feather into
 * normal ground, and the passage remains a single skiable heightfield. */
export function glacierPassageHeight(p:Point,base:number):number{
  return base-GLACIER_PASSAGE.cutDepth*glacierPassageStrength(p);
}

export function insideGlacierPassage(p:Point,margin=0):boolean{
  const g=GLACIER_PASSAGE;
  return p.x>=g.westX-margin&&p.x<=g.eastX+margin&&
    Math.abs(p.z-g.centerZ)<=g.innerHalfWidth+margin;
}

/** Prevent skiing THROUGH either solid ice wall. Approaching from a mouth
 * remains continuous, and free-roaming outside the tunnel is unchanged.
 * Wall contact is resolved in the same x/z space as the mesh footprint.
 */
export function glacierConstrainSkiMove(from:Point,to:Point,radius=.42):Point{
  const g=GLACIER_PASSAGE;
  if(to.x<g.westX||to.x>g.eastX)return to;
  const previous=from.z-g.centerZ,next=to.z-g.centerZ;
  const inside=Math.abs(previous)<g.innerHalfWidth;
  const safe=g.innerHalfWidth-radius;
  if(inside)return {x:to.x,z:g.centerZ+Math.max(-safe,Math.min(safe,next))};
  // A side approach hits the ice rather than tunneling through its wall.
  if(Math.abs(next)<g.innerHalfWidth+radius&&
    Math.abs(previous)>=g.innerHalfWidth){
    const sign=previous<0?-1:1;
    return {x:to.x,z:g.centerZ+sign*(g.innerHalfWidth+radius)};
  }
  return to;
}

export function glacierEntrance(p:Point):"west"|"east"|null{
  const g=GLACIER_PASSAGE;
  if(Math.abs(p.z-g.centerZ)>g.innerHalfWidth+.5)return null;
  if(Math.abs(p.x-g.westX)<1.3)return "west";
  if(Math.abs(p.x-g.eastX)<1.3)return "east";
  return null;
}

/** The exact inner blue-ice vault. The renderer MUST sample this profile,
 * so overhead physics and the translucent mesh cannot silently drift apart.
 * The outer shell is decorative; its thickness never reduces player headroom. */
export function glacierVaultHeight(
  p:Point,centerFloorY:number,outer=false,
):number|null{
  const g=GLACIER_PASSAGE;
  const half=outer?g.outerHalfWidth:g.innerHalfWidth;
  const lateral=Math.abs(p.z-g.centerZ)/half;
  if(lateral>1)return null;
  return centerFloorY+g.clearanceHeight*
    Math.sqrt(Math.max(0,1-lateral*lateral))+(outer?.38:0);
}
export function glacierCeilingHeight(p:Point,floor:(p:Point)=>number):number|null{
  if(!insideGlacierPassage(p))return null;
  return glacierVaultHeight(p,floor({x:p.x,z:GLACIER_PASSAGE.centerZ}));
}
/** Grade of the analytic halfpipe wall, excluding its natural downhill
 * component. C1 at the floor and lip; no artificial speed impulses. */
export function halfpipeBankSlope(p:Point):number{
  const h=ALPINE_HALFPIPE;
  const dx=p.x-h.centerX,t=Math.abs(dx);
  const start=h.floorHalfWidth,end=h.rimHalfWidth;
  // Roundoff from subtracting world coordinates must not turn a truly
  // horizontal C1 edge into a microscopic, nonzero slope.
  if(t<=start+1e-8||t>=end-1e-8)return 0;
  const u=(t-start)/(end-start);
  return (dx<0?-1:1)*h.bankHeight*6*u*(1-u)/(end-start);
}

/** Rail and box clearance also reserves a full-length safe approach/runout.
 * This protects authored features from procedural trunks and boulder scatter. */
export function alpineSportClearance(p:Point):boolean{
  if(alpineHalfpipeStrength(p)>.01)return true;
  if(insideGlacierPassage(p,4.4))return true;
  if(ALPINE_KICKERS.some(k=>{
    const dx=p.x-k.point.x,dz=p.z-k.point.z;
    const along=dx*k.heading.x+dz*k.heading.z;
    const sideways=Math.abs(dx*k.heading.z-dz*k.heading.x);
    return along>-6&&along<14&&sideways<4.5;
  }))return true;
  for(const chain of ALPINE_RAIL_CHAINS){
    for(let i=0;i<chain.points.length-1;i++){
      const a=chain.points[i],b=chain.points[i+1];
      const vx=b.x-a.x,vz=b.z-a.z,l2=vx*vx+vz*vz;
      const t=clamp01(((p.x-a.x)*vx+(p.z-a.z)*vz)/l2);
      if(Math.hypot(p.x-a.x-t*vx,p.z-a.z-t*vz)<2.5)return true;
    }
  }
  return false;
}

/** A low, tapered deck with the exact support required by the visible box.
 * Soft end transitions avoid snapping the rider onto an invisible step. */
export function alpineBoxSupport(p:Point,base:number):number{
  let elevation=0;
  for(const box of ALPINE_FEATURE_BOXES){
    const dx=box.to.x-box.from.x,dz=box.to.z-box.from.z;
    const l2=dx*dx+dz*dz;
    const t=((p.x-box.from.x)*dx+(p.z-box.from.z)*dz)/l2;
    const d=Math.abs((p.x-box.from.x)*dz-(p.z-box.from.z)*dx)/Math.sqrt(l2);
    const along=smooth01((t+.08)/.18)*(1-smooth01((t-.90)/.18));
    const across=1-smooth01((d-box.halfWidth*.72)/(box.halfWidth*.34));
    elevation=Math.max(elevation,box.lift*along*across);
  }
  return base+elevation;
}

export function alpineFeatureZone(p:Point):"halfpipe"|"glacier"|"terrain-park"|null{
  if(insideGlacierPassage(p))return "glacier";
  if(alpineHalfpipeStrength(p)>.4)return "halfpipe";
  if(alpineSportClearance(p))return "terrain-park";
  return null;
}
