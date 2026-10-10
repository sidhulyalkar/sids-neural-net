import { SEA_SURFACE, seaFloorHeight, maxDiveDepth, waterZone, type Point, type WaterZone } from "./model";

/** Submerged art objects inspired by UC San Diego's trident, never official marks. */
export const UNDERWATER_TRIDENTS=[
  {id:"trident-kelp",point:{x:-49,z:7},zone:"kelp",title:"Foundations",href:"/about"},
  {id:"trident-lagoon",point:{x:71,z:17},zone:"lagoon",title:"Bioengineering",href:"/projects"},
  {id:"trident-grotto",point:{x:81,z:-25},zone:"lagoon",title:"Exploration",href:"/publications"},
] as const satisfies readonly {id:string;point:Point;zone:WaterZone;title:string;href:string}[];
export type UnderwaterTrident=typeof UNDERWATER_TRIDENTS[number];
export function tridentBaseY(t:UnderwaterTrident):number {
 return seaFloorHeight(t.point.x,t.point.z)+0.16;
}
export function tridentReachable(t:UnderwaterTrident):boolean {
 return waterZone(t.point)===t.zone &&
   maxDiveDepth(t.point)>1.8 &&
   tridentBaseY(t)+1.45<SEA_SURFACE-0.35;
}
/** Explicit vertical and dive-mode gating prevents discovery from shore or surface. */
export function nearbyUnderwaterTrident(p:Point,y:number,mode:"land"|"surface"|"dive"):
  UnderwaterTrident|null {
 if(mode!=="dive"||waterZone(p)===null)return null;
 return UNDERWATER_TRIDENTS.find(t=>t.zone===waterZone(p) &&
   Math.hypot(p.x-t.point.x,p.z-t.point.z)<2.8 &&
   Math.abs(y-(tridentBaseY(t)+1))<2.7)??null;
}
