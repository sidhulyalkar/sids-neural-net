import {cameraSegmentHitsVolume,type CameraPoint} from "./cameraVisibility";
import {terrainHeight} from "./model";
import {GROVE_TUNNEL} from "./skatepark";

/**
 * Conservative visual hull of the genuine fallen-sequoia tunnel.
 * Applies ONLY to beach-camera composition, not collision, skating,
 * rideability, or the authored inside-the-log camera.
 */
export function northShoreLogBlocksView(lens:CameraPoint,focus:CameraPoint):boolean{
 const c=GROVE_TUNNEL.center;
 return cameraSegmentHitsVolume(lens,focus,{
  x:c.x,
  y:terrainHeight(c.x,c.z)+GROVE_TUNNEL.archCenterLift,
  z:c.z,
  rx:GROVE_TUNNEL.halfLength+.55,
  ry:GROVE_TUNNEL.outerRadius+.65,
  rz:GROVE_TUNNEL.outerHalfWidth+.60,
 },.08);
}

export type NorthShoreCameraResult={
 point:CameraPoint;
 clear:boolean;
 adjusted:boolean;
};
/**
 * Retain the authored camera when the log is out of the sightline.
 * Otherwise use a shoreline oblique with its lens safely beside the log;
 * no invisible clipping, geometry hiding, or teleport of the player.
 */
export function resolveNorthShoreCamera(
 desired:CameraPoint,focus:CameraPoint,
 floor:(x:number,z:number)=>number,
):NorthShoreCameraResult{
 if(!northShoreLogBlocksView(desired,focus))
  return {point:{...desired},clear:true,adjusted:false};
 const offsets=[14,-14,19,-19] as const;
 const candidates=offsets.map(dx=>{
  const x=focus.x+dx,z=focus.z-2.5;
  return {x,z,y:Math.max(focus.y+7.0,floor(x,z)+4.5)};
 }).filter(point=>!northShoreLogBlocksView(point,focus));
 candidates.sort((a,b)=>{
  const cost=(p:CameraPoint)=>Math.hypot(p.x-desired.x,p.z-desired.z)*
    .08+Math.abs(p.y-desired.y)*.03;
  return cost(a)-cost(b);
 });
 if(candidates.length)return {point:candidates[0],clear:true,adjusted:true};
 // A rare completely blocked composition stays diagnostically red instead
 // of lying that the camera is visible.
 return {point:{...desired},clear:false,adjusted:false};
}
