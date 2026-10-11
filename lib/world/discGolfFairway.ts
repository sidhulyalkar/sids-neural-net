import {DISC_GOLF_HOLES} from "./discGolf";
import {REGIONS,MEMORY_POINTS,isWater,terrainHeight,distance,type Point} from "./model";
import {biomeAt} from "./biomes";

export type DiscGolfFairwayRisk=
 "over-water"|"steep-target"|"steep-fairway"|"landmark-clearance"|"large-elevation-change";
export type DiscGolfFairwayAudit={
 hole:number;id:string;name:string;par:number;
 distance:number;climb:number;teeBiome:string;basketBiome:string;
 maxSlope:number;basketSlope:number;waterSamples:number;
 nearbyLandmarks:string[];risks:DiscGolfFairwayRisk[];
};

/** Cheap, deterministic review baseline. A straight centerline is NOT a
 * guaranteed throwing corridor and this never validates rendered tree trunks,
 * rocks, waterfall meshes, flying lines, camera occlusion or playability.
 * Physical fairway signoff still needs a real browser survey. */
export function auditDiscGolfFairways():DiscGolfFairwayAudit[]{
 return DISC_GOLF_HOLES.map((hole,i)=>{
  const length=distance(hole.tee,hole.target);
  let maxSlope=0,waterSamples=0;
  for(let step=0;step<=24;step++){
   const t=step/24;
   const p={x:hole.tee.x+(hole.target.x-hole.tee.x)*t,
    z:hole.tee.z+(hole.target.z-hole.tee.z)*t};
   if(isWater(p))waterSamples++;
   const sx=terrainHeight(p.x+.5,p.z)-terrainHeight(p.x-.5,p.z);
   const sz=terrainHeight(p.x,p.z+.5)-terrainHeight(p.x,p.z-.5);
   maxSlope=Math.max(maxSlope,Math.hypot(sx,sz));
  }
  const nearTarget=(p:Point)=>distance(p,hole.target)<6;
  const nearbyLandmarks=[
   ...REGIONS.filter(r=>nearTarget(r.point)).map(r=>r.id),
   ...MEMORY_POINTS.filter(m=>nearTarget(m.point)).map(m=>"photo:"+m.id),
  ];
  const basketPoint=hole.target;
  const basketSlope=Math.hypot(
   terrainHeight(basketPoint.x+.5,basketPoint.z)-terrainHeight(basketPoint.x-.5,basketPoint.z),
   terrainHeight(basketPoint.x,basketPoint.z+.5)-terrainHeight(basketPoint.x,basketPoint.z-.5));
  const climb=terrainHeight(hole.target.x,hole.target.z)-
   terrainHeight(hole.tee.x,hole.tee.z);
  const risks:DiscGolfFairwayRisk[]=[];
  if(waterSamples>0)risks.push("over-water");
  if(basketSlope>2.2)risks.push("steep-target");
  if(maxSlope>3.8)risks.push("steep-fairway");
  if(nearbyLandmarks.length>0)risks.push("landmark-clearance");
  if(Math.abs(climb)>16)risks.push("large-elevation-change");
  return {hole:i+1,id:hole.id,name:hole.name,par:hole.par,
   distance:Math.round(length*10)/10,climb:Math.round(climb*10)/10,
   teeBiome:biomeAt(hole.tee).primary,
   basketBiome:biomeAt(hole.target).primary,
   maxSlope:Math.round(maxSlope*100)/100,
   basketSlope:Math.round(basketSlope*100)/100,
   waterSamples,nearbyLandmarks,risks};
 });
}
