import {
 DISC_GOLF_HOLES,discGolfThrow,stepDiscGolf,startDiscGolf,recommendDiscGolfPower,
 discGolfRouteLength,traceDiscGolfShot,
} from "./discGolf";
import {
 REGIONS,MEMORY_POINTS,distance,
 coastlineX,eastCoastlineX,caveObstacles,PAPER_CAVE,ARCADE_CAVE,type Point,
} from "./model";
import {BOULDER_HOLDS,RIDE_RAMPS,FALLEN_LOGS} from "./activities";
import {biomeAt} from "./biomes";
import {discGolfSurfaceHeight,discGolfSurfaceIsWater} from "./discGolfSurface";
import {jetSkiPierHeight} from "./jetSkiPier";

export type DiscGolfFairwayRisk=
 "over-water"|"steep-target"|"steep-fairway"|"landmark-clearance"|
 "large-elevation-change"|"steep-tee"|"crowded-tee"|"crowded-green"|
 "coastal-tee"|"coastal-green"|"short-first-shot"|"first-shot-water"|
 "unsafe-gate"|"short-leg"|"missed-gate-from-staging";
export type DiscGolfFairwayAudit={
 hole:number;id:string;name:string;par:number;
 distance:number;routeDistance:number;legDistances:number[];
 gateCount:number;gateClearance:number[];gateSlope:number[];
 gateReachable:boolean[];
 climb:number;teeBiome:string;basketBiome:string;
 maxSlope:number;teeSlope:number;basketSlope:number;waterSamples:number;
 teeCoastMargin:number;greenCoastMargin:number;
 teeFeatureClearance:number;greenFeatureClearance:number;
 teeSupport:"pier"|"terrain";
 firstShotDistance:number;firstShotPower:number;firstShotPhase:string;
 nearbyLandmarks:string[];risks:DiscGolfFairwayRisk[];
};

export function discGolfLocalSlope(p:Point):number{
 return Math.hypot(
  (discGolfSurfaceHeight({x:p.x+.5,z:p.z})-
   discGolfSurfaceHeight({x:p.x-.5,z:p.z})),
  (discGolfSurfaceHeight({x:p.x,z:p.z+.5})-
   discGolfSurfaceHeight({x:p.x,z:p.z-.5})));
}
function distanceToLine(p:Point,a:Point,b:Point):number{
 const dx=b.x-a.x,dz=b.z-a.z,len=dx*dx+dz*dz;
 const t=len>0?Math.max(0,Math.min(1,
  ((p.x-a.x)*dx+(p.z-a.z)*dz)/len)):0;
 return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);
}
const fixedTrees=[
 {x:-10,z:6,radius:1.4},{x:3,z:1,radius:1.5},
 {x:-5,z:-7,radius:1.7},{x:17,z:15,radius:1.1},
 {x:-13,z:23,radius:1.2},
];
/** Authored geometry only. Seeded instances are handled by the actual
 * environment clearances; this audit cannot certify a rendered flyway. */
export function discGolfFixedFeatureClearance(p:Point):number{
 const results:number[]=[
  ...BOULDER_HOLDS.map(x=>distance(p,x)-x.radius),
  ...RIDE_RAMPS.map(x=>distance(p,x.point)-x.radius),
  ...FALLEN_LOGS.map(x=>distanceToLine(p,x.a,x.b)-x.radius),
  ...fixedTrees.map(x=>distance(p,x)-x.radius),
  // Only portal walls reach the outdoor course; museum walls are underground.
  ...caveObstacles().filter(x=>x.x<0?Math.abs(x.z-PAPER_CAVE.z)<1.5:Math.abs(x.z-ARCADE_CAVE.entrance.z)<1.5).map(x=>distance(p,x)-x.radius),
  // Region/photo labels are semantic landmarks, not solid collision
  // objects. On the raised pier they do not obstruct the tee circle.
  ...(jetSkiPierHeight(p)===null?
    REGIONS.map(x=>distance(p,x.point)-4):[]),
  ...(jetSkiPierHeight(p)===null?
    MEMORY_POINTS.map(x=>distance(p,x.point)-3):[]),
 ];
 // Canyon stone columns are authored outside the general tree scatter.
 for(const side of [-1,1]){
  for(let i=0;i<8;i++){
   const p0={x:29+side*(4.6+Math.sin(i)*.5),z:24+i*2.8};
   results.push(distance(p,p0)-1.3);
  }
 }
 return Math.min(...results);
}
function coastMargin(p:Point){
 return Math.min(p.x-coastlineX(p.z),eastCoastlineX(p.z)-p.x);
}
function firstShot(holeIndex:number){
 let s=startDiscGolf(holeIndex,discGolfSurfaceHeight,5);
 const tee={...s.lie};
 const power=recommendDiscGolfPower(s,24,0,discGolfSurfaceHeight,
   discGolfSurfaceIsWater,-1.4);
 s=discGolfThrow(s,{power,loft:24,aimOffset:0,accuracy:0},discGolfSurfaceHeight);
 for(let i=0;i<230&&s.phase==="flying";i++){
  s=stepDiscGolf(s,.05,discGolfSurfaceHeight,discGolfSurfaceIsWater,-1.4);
 }
 return {
  distance:s.phase==="water"?0:Math.hypot(s.disc.x-tee.x,s.disc.z-tee.z),
  power,phase:s.phase,
 };
}

/** Cheap, deterministic review baseline. A straight centerline is NOT a
 * guaranteed throwing corridor and this never validates rendered tree trunks,
 * rocks, waterfall meshes, flying lines, camera occlusion or playability.
 * Physical fairway signoff still needs a real browser survey. */
export function auditDiscGolfFairways():DiscGolfFairwayAudit[]{
 return DISC_GOLF_HOLES.map((hole,i)=>{
  const length=distance(hole.tee,hole.target);
  const waypoints=[hole.tee,...hole.gates.map(g=>g.point),hole.target];
  const legDistances=waypoints.slice(1).map((p,j)=>distance(waypoints[j],p));
  const gateClearance=hole.gates.map(g=>discGolfFixedFeatureClearance(g.point));
  const gateSlope=hole.gates.map(g=>discGolfLocalSlope(g.point));
  const gateReachable=hole.gates.map((gate,index)=>{
   const previous=waypoints[index],direction={
    x:gate.point.x-previous.x,z:gate.point.z-previous.z};
   const len=Math.hypot(direction.x,direction.z)||1;
   // This is a laboratory simulation from a plausible lie on the approach
   // side. It must never be described as full physical playtest coverage.
   const at={x:gate.point.x-direction.x/len*14,
    z:gate.point.z-direction.z/len*14};
   // A legitimate gate may require a shorter/longer layup when approached
   // from a mountain slope. Search plausible lies, then run the SAME
   // physical flight and swept crossing as gameplay. Never award by proximity.
   const stages=[at,...[9,19,25].map(d=>({
    x:gate.point.x-direction.x/len*d,
    z:gate.point.z-direction.z/len*d,
   }))];
   for(const [stageIndex,lie] of stages.entries()){
    if(discGolfSurfaceIsWater(lie))continue;
    const init={...startDiscGolf(i,discGolfSurfaceHeight,5),
      phase:"landed" as const,gatesCleared:index,lie,
      disc:{...lie,y:discGolfSurfaceHeight(lie)+.16}};
    const lofts=stageIndex===0?[18,26,34]:[12,20,30,40];
    const powers=stageIndex===0?[28,44,60,76,92]:[18,30,44,60,78];
    for(const loft of lofts)for(const power of powers){
     const trace=traceDiscGolfShot(init,
      {power,loft,aimOffset:0,accuracy:0},
      discGolfSurfaceHeight,discGolfSurfaceIsWater,-1.4);
     if(trace.gatesCleared>index)return true;
    }
   }
   return false;
  });
  let maxSlope=0,waterSamples=0;
  for(let step=0;step<24;step++){
   const j=Math.min(waypoints.length-2,
    Math.floor(step*(waypoints.length-1)/24));
   const local=(step*(waypoints.length-1)/24)-j;
   const p={x:waypoints[j].x+(waypoints[j+1].x-waypoints[j].x)*local,
    z:waypoints[j].z+(waypoints[j+1].z-waypoints[j].z)*local};
   if(discGolfSurfaceIsWater(p))waterSamples++;
   const sx=discGolfSurfaceHeight({x:p.x+.5,z:p.z})-
     discGolfSurfaceHeight({x:p.x-.5,z:p.z});
   const sz=discGolfSurfaceHeight({x:p.x,z:p.z+.5})-
     discGolfSurfaceHeight({x:p.x,z:p.z-.5});
   maxSlope=Math.max(maxSlope,Math.hypot(sx,sz));
  }
  const nearTarget=(p:Point)=>distance(p,hole.target)<6;
  const nearbyLandmarks=[
   ...REGIONS.filter(r=>nearTarget(r.point)).map(r=>r.id),
   ...MEMORY_POINTS.filter(m=>nearTarget(m.point)).map(m=>"photo:"+m.id),
  ];
  const basketSlope=discGolfLocalSlope(hole.target);
  const teeSlope=discGolfLocalSlope(hole.tee);
  const teeSupport=jetSkiPierHeight(hole.tee)===null?"terrain" as const:"pier" as const;
  const teeCoastMargin=coastMargin(hole.tee);
  const greenCoastMargin=coastMargin(hole.target);
  const teeFeatureClearance=discGolfFixedFeatureClearance(hole.tee);
  const greenFeatureClearance=discGolfFixedFeatureClearance(hole.target);
  const opening=firstShot(i);
  const climb=discGolfSurfaceHeight(hole.target)-
   discGolfSurfaceHeight(hole.tee);
  const risks:DiscGolfFairwayRisk[]=[];
  if(waterSamples>0)risks.push("over-water");
  if(basketSlope>2.2)risks.push("steep-target");
  if(maxSlope>3.8)risks.push("steep-fairway");
  if(nearbyLandmarks.length>0)risks.push("landmark-clearance");
  if(Math.abs(climb)>16)risks.push("large-elevation-change");
  if(teeSlope>1.35)risks.push("steep-tee");
  if(teeFeatureClearance<2)risks.push("crowded-tee");
  if(greenFeatureClearance<2)risks.push("crowded-green");
  // A constructed raised deck is safe as a tee despite a negative
  // analytic island coastline margin. Do not hide the real margin value.
  if(teeCoastMargin<6&&teeSupport!=="pier")risks.push("coastal-tee");
  if(greenCoastMargin<6)risks.push("coastal-green");
  if(opening.distance<7)risks.push("short-first-shot");
  if(opening.phase==="water")risks.push("first-shot-water");
  if(gateClearance.some(v=>v<1.2)||gateSlope.some(v=>v>2.2))
   risks.push("unsafe-gate");
  if(legDistances.some(v=>v<14))risks.push("short-leg");
  if(gateReachable.some(v=>!v))risks.push("missed-gate-from-staging");
  return {hole:i+1,id:hole.id,name:hole.name,par:hole.par,
   distance:Math.round(length*10)/10,
   routeDistance:Math.round(discGolfRouteLength(hole)*10)/10,
   legDistances:legDistances.map(v=>Math.round(v*10)/10),
   gateCount:hole.gates.length,
   gateClearance:gateClearance.map(v=>Math.round(v*10)/10),
   gateSlope:gateSlope.map(v=>Math.round(v*100)/100),
   gateReachable,
   climb:Math.round(climb*10)/10,
   teeBiome:biomeAt(hole.tee).primary,
   basketBiome:biomeAt(hole.target).primary,
   maxSlope:Math.round(maxSlope*100)/100,
   teeSlope:Math.round(teeSlope*100)/100,
   basketSlope:Math.round(basketSlope*100)/100,
   teeCoastMargin:Math.round(teeCoastMargin*10)/10,
   greenCoastMargin:Math.round(greenCoastMargin*10)/10,
   teeSupport,
   teeFeatureClearance:Math.round(teeFeatureClearance*10)/10,
   greenFeatureClearance:Math.round(greenFeatureClearance*10)/10,
   firstShotDistance:Math.round(opening.distance*10)/10,
   firstShotPower:opening.power,
   firstShotPhase:opening.phase,
   waterSamples,nearbyLandmarks,risks};
 });
}
