import {
  SEA_SURFACE, SOUTH_CHANNEL_SHORE_Z, WORLD_BOUNDS,
  coastlineX, eastCoastlineX, waterZone, type Point,
} from "./model";

/** Supports every dry stretch of the island's south water edge.
 * The original land movement remains bounded; the swim transition happens
 * only after a grounded outward attempt at the last land cell.
 */
export function southCoastDryShore(x:number):boolean {
  const z=SOUTH_CHANNEL_SHORE_Z;
  return Number.isFinite(x) && x>coastlineX(z)+3.2 && x<eastCoastlineX(z)-3.2;
}
export function southCoastEntry(
  point:Point, intended:Point, isSurface:boolean, isGrounded:boolean,
):Point|null {
  if(!isSurface || !isGrounded || !southCoastDryShore(point.x) ||
     point.z>SOUTH_CHANNEL_SHORE_Z+.72 || point.z<SOUTH_CHANNEL_SHORE_Z-.05 ||
     intended.z>-.15 || waterZone(point)!==null)return null;
  const intoWater={x:Math.max(WORLD_BOUNDS.minX,Math.min(WORLD_BOUNDS.maxX,point.x)),
    z:SOUTH_CHANNEL_SHORE_Z-.38};
  return waterZone(intoWater)==="south-channel"?intoWater:null;
}
/** Shallow landing cell inside the island, reached by ordinary surface swim.
 * Stepping out is blocked while diving until the character surfaces.
 */
export function southCoastLanding(point:Point):Point|null {
  if(point.z<SOUTH_CHANNEL_SHORE_Z || !southCoastDryShore(point.x))return null;
  return {x:point.x,z:Math.min(SOUTH_CHANNEL_SHORE_Z+.35,point.z)};
}
export const SOUTH_ENTRY_SURFACE_Y=SEA_SURFACE-.42;
