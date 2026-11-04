import type {Point} from "./model";

/**
 * Authored alpine riding zones. Distances are stylized world units.
 * No renderer dependency: collision, mesh generation, QA and route planning
 * all read the same analytic dimensions and feature coordinates.
 */
export const ALPINE_HALFPIPE={
  centerX:29, startZ:-74, endZ:-45,
  floorHalfWidth:2.05, rimHalfWidth:6.25,
  outerFeather:2.15, bankHeight:3.55,
} as const;

export const GLACIER_PASSAGE={
  westX:-15, eastX:7, centerZ:-81,
  innerHalfWidth:2.5, outerHalfWidth:3.12,
  clearanceHeight:4.9, cutDepth:4.15,
  entranceBlend:3.4,
} as const;

export const ALPINE_KICKERS=[
  {id:"alpine-tabletop",point:{x:29,z:-46.8},heading:{x:0,z:1},radius:3.05,lift:6.8},
  {id:"alpine-transfer-hip",point:{x:20.5,z:-55.4},heading:{x:.24,z:.97077},radius:2.8,lift:5.2},
] as const;

export const ALPINE_FEATURE_BOXES=[
  {id:"alpine-flat-box",from:{x:18,z:-47.6},to:{x:18.5,z:-40.6},halfWidth:.88,lift:.78},
] as const;

export const ALPINE_RAIL_CHAINS=[
  {id:"alpine-serpent",radius:.12,
    points:[{x:21.5,z:-73},{x:22,z:-70},{x:22.6,z:-67.8},{x:22.5,z:-65.5},
      {x:21.8,z:-63.6},{x:21.7,z:-61.5},{x:22.15,z:-59.3}],
    heights:[.8,.96,1.1,1.08,.92,.83,.73]},
  {id:"alpine-rainbow",radius:.14,
    points:[{x:17.5,z:-54},{x:17.8,z:-52.75},{x:18.1,z:-51.5},
      {x:18.4,z:-50.25},{x:18.7,z:-49}],
    heights:[.6,.96,1.28,.96,.6]},
  {id:"alpine-box-spine",radius:.26,
    points:[{x:18,z:-47.6},{x:18.1,z:-45.85},{x:18.25,z:-44.1},
      {x:18.4,z:-42.35},{x:18.5,z:-40.6}],
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

export function glacierEntrance(p:Point):"west"|"east"|null{
  const g=GLACIER_PASSAGE;
  if(Math.abs(p.z-g.centerZ)>g.innerHalfWidth+.5)return null;
  if(Math.abs(p.x-g.westX)<1.3)return "west";
  if(Math.abs(p.x-g.eastX)<1.3)return "east";
  return null;
}

export function glacierCeilingHeight(p:Point,floor:(p:Point)=>number):number|null{
  if(!insideGlacierPassage(p))return null;
  const g=GLACIER_PASSAGE;
  const s=Math.abs(p.z-g.centerZ)/g.innerHalfWidth;
  return floor({x:p.x,z:g.centerZ})+
    g.clearanceHeight*Math.sqrt(Math.max(0,1-s*s));
}

/** Rail and box clearance also reserves a full-length safe approach/runout.
 * This protects authored features from procedural trunks and boulder scatter. */
export function alpineSportClearance(p:Point):boolean{
  if(alpineHalfpipeStrength(p)>.01)return true;
  if(insideGlacierPassage(p,4.4))return true;
  if(ALPINE_KICKERS.some(k=>
    Math.abs(p.x-k.point.x)<4.5&&p.z>k.point.z-6&&p.z<k.point.z+14))return true;
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
