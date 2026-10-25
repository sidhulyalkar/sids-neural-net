/** Stabilized, readable third-person camera framing for Shasta's fetch.
 * Separate the camera's tracking anchor from his IK, terrain stepping, and
 * procedural root oscillations. Only the underlying dog navigation matters.
 */
export type ShastaCameraPoint={x:number;y:number;z:number};
export type ShastaCameraAnchor={
 point:ShastaCameraPoint;heading:number;
};
export type ShastaCameraShot={
 camera:ShastaCameraPoint;look:ShastaCameraPoint;boom:number;
};
const blend=(dt:number,rate:number)=>1-Math.exp(-Math.max(0,Math.min(dt,.10))*rate);
const finite=(v:number)=>Number.isFinite(v)?v:0;
export function stepShastaCameraAnchor(
 previous:ShastaCameraAnchor|null,
 dog:ShastaCameraPoint,heading:number,dt:number,
):ShastaCameraAnchor{
 const target={x:finite(dog.x),y:finite(dog.y),z:finite(dog.z)};
 const targetHeading=finite(heading);
 if(!previous||Math.hypot(previous.point.x-target.x,
  previous.point.z-target.z)>24){
  return {point:target,heading:targetHeading};
 }
 // Camera lag is intentionally gentler in elevation than in XZ. This
 // prevents rough micro-terrain from making an eye-height view vibrate.
 const a=blend(dt,5.5),yAlpha=blend(dt,3.6);
 const p=previous.point;
 const headingDelta=Math.atan2(Math.sin(targetHeading-previous.heading),
  Math.cos(targetHeading-previous.heading));
 return {
  point:{x:p.x+(target.x-p.x)*a,
   y:p.y+(target.y-p.y)*yAlpha,z:p.z+(target.z-p.z)*a},
  heading:previous.heading+headingDelta*blend(dt,3.8),
 };
}
export function shastaCameraShot(
 anchor:ShastaCameraAnchor,mode:"chase"|"shasta",
 floor:(x:number,z:number)=>number,
):ShastaCameraShot{
 const {x,y,z}=anchor.point;
 const fx=Math.sin(anchor.heading),fz=Math.cos(anchor.heading);
 const sx=fz,sz=-fx;
 // Both modes show Shasta and some world context, rather than placing the
 // lens directly at his nose. The latter made small head/terrain movements
 // occupy the whole screen during disc-golf fetches.
 const boom=mode==="chase"?11.7:7.6;
 const side=mode==="chase"?2.8:1.5;
 const lift=mode==="chase"?8.2:4.6;
 const cameraX=x-fx*boom+sx*side,cameraZ=z-fz*boom+sz*side;
 const cameraY=Math.max(y+lift,floor(cameraX,cameraZ)+
  (mode==="chase"?4.5:3.0));
 const ahead=mode==="chase"?3.0:1.9;
 return {
  camera:{x:cameraX,y:cameraY,z:cameraZ},
  look:{x:x+fx*ahead,y:y+1.15,z:z+fz*ahead},
  boom,
 };
}
