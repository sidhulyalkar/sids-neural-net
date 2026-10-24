import {CameraVisibilityField,type CameraPoint,type CameraPose} from './cameraVisibility';
const moved=(a:CameraPoint,b:CameraPoint)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)>.3;
/** Reposition the lens; never mutate scenery to make a shot clear. */
export function createFreeCamera(field:CameraVisibilityField,floor:(x:number,z:number)=>number){
 let cached:{desired:CameraPoint;focus:CameraPoint;pose:CameraPose}|null=null;
 return {
  resolve(desired:CameraPoint,focus:CameraPoint){
   if(!cached||moved(cached.desired,desired)||moved(cached.focus,focus)){
    const pose=field.resolve(desired,focus,floor,cached?.pose.point);
    cached={desired:{...desired},focus:{...focus},pose};
   }
   return cached.pose;
  },
  reset(){cached=null;},
 };
}
