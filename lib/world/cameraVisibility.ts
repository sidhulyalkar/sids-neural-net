/** Lightweight 3D camera occlusion field from the island's authored geometry.
 * Volumes are conservative ellipsoids matching procedural foliage extents.
 * A 2D spatial hash culls candidates; segment tests still use full 3D.
 * This never affects avatar collisions, throw trajectories or scoring.
 */
export type CameraPoint={x:number;y:number;z:number};
export type CameraVolume=CameraPoint&{rx:number;ry:number;rz:number};
export type CameraPose={point:CameraPoint;clear:boolean;adjusted:boolean;blocking:number};
const CELL=9;
const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
const dist=(a:CameraPoint,b:CameraPoint)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const key=(x:number,z:number)=>x+","+z;
const valid=(v:CameraPoint)=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z);

/** Exact intersection of a view segment with an expanded ellipsoid. */
export function cameraSegmentHitsVolume(a:CameraPoint,b:CameraPoint,v:CameraVolume,
 padding=.12):boolean{
 const rx=Math.max(.01,v.rx+padding),ry=Math.max(.01,v.ry+padding),
  rz=Math.max(.01,v.rz+padding);
 const px=(a.x-v.x)/rx,py=(a.y-v.y)/ry,pz=(a.z-v.z)/rz;
 const dx=(b.x-a.x)/rx,dy=(b.y-a.y)/ry,dz=(b.z-a.z)/rz;
 const A=dx*dx+dy*dy+dz*dz;
 if(A<1e-14)return px*px+py*py+pz*pz<=1;
 const B=2*(px*dx+py*dy+pz*dz),C=px*px+py*py+pz*pz-1;
 const D=B*B-4*A*C;
 if(D<0)return false;
 const root=Math.sqrt(D);
 // Leave the last 20cm before the player uncounted: grazing a helmet or
 // brush directly touching the avatar must not flip the camera every tick.
 return (-B-root)/(2*A)<.985 && (-B+root)/(2*A)>0;
}
export class CameraVisibilityField {
 private readonly volumes:readonly CameraVolume[];
 private readonly grid=new Map<string,number[]>();
 constructor(volumes:readonly CameraVolume[]){
  this.volumes=volumes.filter(v=>valid(v)&&v.rx>0&&v.ry>0&&v.rz>0);
  for(let i=0;i<this.volumes.length;i++){
   const v=this.volumes[i];
   for(let x=Math.floor((v.x-v.rx-.5)/CELL);x<=Math.floor((v.x+v.rx+.5)/CELL);x++)
    for(let z=Math.floor((v.z-v.rz-.5)/CELL);z<=Math.floor((v.z+v.rz+.5)/CELL);z++){
     const k=key(x,z),arr=this.grid.get(k);
     if(arr)arr.push(i);else this.grid.set(k,[i]);
    }
  }
 }
 /** Only evaluate volumes that overlap this segment's XZ bounding rectangle. */
 private candidates(a:CameraPoint,b:CameraPoint):number[]{
  const ids=new Set<number>();
  const minX=Math.floor((Math.min(a.x,b.x)-.6)/CELL);
  const maxX=Math.floor((Math.max(a.x,b.x)+.6)/CELL);
  const minZ=Math.floor((Math.min(a.z,b.z)-.6)/CELL);
  const maxZ=Math.floor((Math.max(a.z,b.z)+.6)/CELL);
  for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++)
   for(const id of this.grid.get(key(x,z))??[])ids.add(id);
  return [...ids];
 }
 /** Check the actual camera lens and two avatar silhouette points.
  * Camera must not be *inside* foliage, even if a view ray appears clear.
  */
 blockers(camera:CameraPoint,focus:CameraPoint):number{
  if(!valid(camera)||!valid(focus))return Infinity;
  const candidates=this.candidates(camera,focus);
  let hits=0;
  for(const id of candidates){
   const v=this.volumes[id];
   if(cameraSegmentHitsVolume(camera,camera,v,.7)){hits+=3;continue;}
   if(cameraSegmentHitsVolume(camera,focus,v,.18))hits++;
   // Lower torso and both shoulders form a small camera-space visibility
   // fan. A single center ray can be clear while a giant crown still fills
   // nearly the whole screen around the player's silhouette.
   if(cameraSegmentHitsVolume(camera,
     {x:focus.x,y:focus.y-.85,z:focus.z},v,.14))hits++;
   const nx=camera.x-focus.x,nz=camera.z-focus.z;
   const length=Math.hypot(nx,nz)||1;
   const sx=-nz/length*.65,sz=nx/length*.65;
   if(cameraSegmentHitsVolume(camera,
     {x:focus.x+sx,y:focus.y-.12,z:focus.z+sz},v,.14))hits++;
   if(cameraSegmentHitsVolume(camera,
     {x:focus.x-sx,y:focus.y-.12,z:focus.z-sz},v,.14))hits++;
  }
  return hits;
 }
 clear(camera:CameraPoint,focus:CameraPoint):boolean{
  return this.blockers(camera,focus)===0;
 }
 /** Local, ordered search around the authored third-person pose:
  * maintain basket-first framing whenever visible, otherwise orbit/lift/
  * tighten the boom. Only the static 3D occluder field is queried.
  */
 resolve(desired:CameraPoint,focus:CameraPoint,
  floor:(x:number,z:number)=>number,previous?:CameraPoint):CameraPose{
  if(!valid(desired)||!valid(focus))return {point:{...desired},clear:false,adjusted:false,blocking:Infinity};
  const dx=desired.x-focus.x,dz=desired.z-focus.z;
  const radius=Math.max(1,Math.hypot(dx,dz));
  const baseAngle=Math.atan2(dx,dz);
  const angles=[0,-.27,.27,-.56,.56,-.95,.95,-1.35,1.35,Math.PI];
  const elevations=[0,4,9,16,23];
  const ranges=[1,.82,.64,.44];
  const original={...desired,y:Math.max(desired.y,floor(desired.x,desired.z)+3.2)};
  if(this.clear(original,focus))
   return {point:original,clear:true,adjusted:false,blocking:0};
  let best=original,bestCost=Infinity,bestBlocks=Infinity;
  for(const ratio of ranges){
   for(const lift of elevations){
    for(const angle of angles){
     const heading=baseAngle+angle;
     const x=focus.x+Math.sin(heading)*radius*ratio;
     const z=focus.z+Math.cos(heading)*radius*ratio;
     const y=Math.max(desired.y+lift,floor(x,z)+3.2);
     const sample={x,y,z};
     const blocks=this.blockers(sample,focus);
     // Strong visibility preference, then preserve the intended throw
     // direction and silhouette size; use the prior clean shot as a
     // tie-break to avoid snapping between symmetric sides.
     const cost=blocks*10000+Math.abs(angle)*8+
      Math.abs(1-ratio)*11+lift*.48+
      Math.max(0,y-desired.y-lift)*.6+
      (previous?clamp(dist(previous,sample),0,50)*.045:0);
     if(cost<bestCost){best=sample;bestCost=cost;bestBlocks=blocks;}
    }
   }
  }
  return {point:best,clear:bestBlocks===0,adjusted:true,blocking:bestBlocks};
 }
}
