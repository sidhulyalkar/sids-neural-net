/** Shared visual and physical specification for the lagoon pier.
 * The deck is a real walking surface that overrides submerged seabed height,
 * without reclassifying surrounding snorkeling water as land. */
import {SEA_SURFACE,type Point,terrainHeight} from "./model";
export const JET_SKI_PIER={
 landX:56.4, rampEndX:59.4, endX:65.2,
 centerZ:12, halfWidth:2.75,
 deckHeight:SEA_SURFACE+0.92,
} as const;
const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
export function jetSkiPierHeight(point:Point):number|null{
 const {x,z}=point,p=JET_SKI_PIER;
 if(x<p.landX||x>p.endX||Math.abs(z-p.centerZ)>p.halfWidth)return null;
 // The first 3m are an accessible shoreline ramp to an elevated deck.
 const landY=terrainHeight(p.landX,p.centerZ);
 const t=smooth((x-p.landX)/(p.rampEndX-p.landX));
 return landY+(p.deckHeight-landY)*t;
}
export function nearJetSkiBoarding(point:Point):boolean{
 const p=JET_SKI_PIER;
 return jetSkiPierHeight(point)!==null&&point.x>=p.rampEndX-.35;
}
