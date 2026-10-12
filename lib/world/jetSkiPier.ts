/** Continuous beach-to-pier walking surface. Every renderer board and land
 * contact query shares this geometry; nearby open ocean stays swimmable.
 * Begin well inland of eastCoastlineX(12), not just at the water edge. */
import {SEA_SURFACE,type Point,terrainHeight} from "./model";
export const JET_SKI_PIER={
 landX:47.5,rampEndX:61.5,endX:68,
 centerZ:12,halfWidth:3.05,
 deckHeight:SEA_SURFACE+1.15,
} as const;
const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
/** A wide, walk-on shore connector with no submerged footfall. */
export function jetSkiPierHeight(point:Point):number|null{
 const {x,z}=point,p=JET_SKI_PIER;
 if(x<p.landX||x>p.endX||Math.abs(z-p.centerZ)>p.halfWidth)return null;
 // Ramp begins at the true terrain height, then eases onto the level deck.
 const landY=terrainHeight(p.landX,p.centerZ);
 const t=smooth((x-p.landX)/(p.rampEndX-p.landX));
 return landY+(p.deckHeight-landY)*t;
}
export function nearJetSkiBoarding(point:Point):boolean{
 const p=JET_SKI_PIER;
 return jetSkiPierHeight(point)!==null&&point.x>=p.rampEndX-.8;
}
