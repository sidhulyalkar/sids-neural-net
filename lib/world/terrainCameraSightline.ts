/** Camera-only terrain line-of-sight safety for ground-bound mountain bikes.
 * The rider's collision surface and gameplay velocity are never modified.
 * A clear lens alone does not mean a clear view: a ridge between lens and
 * avatar can fill the viewport even with perfectly planted wheels.
 */
export type SightPoint={x:number;y:number;z:number};
export type TerrainShot={point:SightPoint;clear:boolean;adjusted:boolean;lift:number;boomRatio:number};

const valid=(p:SightPoint)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z);
const SAMPLE_COUNT=24;
const CLEARANCE=.40;
function requiredLift(lens:SightPoint,focus:SightPoint,floor:(x:number,z:number)=>number):number{
 let raise=0;
 for(let i=0;i<=SAMPLE_COUNT;i++){
  const t=i/SAMPLE_COUNT;
  // Near the rider, the authored eye focus is already above the body and
  // ground; moving the lens cannot fix a focal point below its own surface.
  if(t>=.96)break;
  const x=lens.x+(focus.x-lens.x)*t,z=lens.z+(focus.z-lens.z)*t;
  const ground=floor(x,z);
  if(!Number.isFinite(ground))continue;
  const rayY=lens.y+(focus.y-lens.y)*t;
  raise=Math.max(raise,(ground+CLEARANCE-rayY)/(1-t));
 }
 return Math.max(0,raise);
}
export function terrainSightlineClear(
 lens:SightPoint,focus:SightPoint,floor:(x:number,z:number)=>number,
):boolean{
 return valid(lens)&&valid(focus)&&requiredLift(lens,focus,floor)<.015;
}
export function resolveBikeTerrainSightline(
 lens:SightPoint,focus:SightPoint,floor:(x:number,z:number)=>number,
):TerrainShot{
 if(!valid(lens)||!valid(focus))
  return {point:{...lens},clear:false,adjusted:false,lift:0,boomRatio:1};
 if(terrainSightlineClear(lens,focus,floor))
  return {point:{...lens},clear:true,adjusted:false,lift:0,boomRatio:1};
 let best:TerrainShot|null=null,bestCost=Infinity;
 // Try the intended boom first. If a steep bank requires a ridiculous lift,
 // shorten the lens-to-rider distance rather than levitating far overhead.
 for(const ratio of [1,.85,.7,.55,.4]){
  const p={x:focus.x+(lens.x-focus.x)*ratio,
   y:focus.y+(lens.y-focus.y)*ratio,
   z:focus.z+(lens.z-focus.z)*ratio};
  const baseLift=Math.max(0,floor(p.x,p.z)+1.2-p.y);
  p.y+=baseLift;
  const lift=requiredLift(p,focus,floor)+.035;
  const candidate={x:p.x,y:p.y+lift,z:p.z};
  const penalty=(1-ratio)*15+Math.max(0,lift+baseLift)*.60;
  if(penalty<bestCost){
   bestCost=penalty;
   best={point:candidate,clear:terrainSightlineClear(candidate,focus,floor),
    adjusted:true,lift:lift+baseLift,boomRatio:ratio};
  }
 }
 return best!;
}
