import {isWater,maxDiveDepth,type Point} from "./model";
import {SHRINE_GALLERY} from "./hiddenShrineGallery";

/** Where the diver was immediately before entering the submerged museum. */
export type GallerySwimPose={
  point:Point;
  swimDepth:number;
  targetDepth:number;
  heading:Point;
  yaw:number;
  pitch:number;
  zoom:number;
};

/** Shared-link visitors have no earlier swim to resume. Place them safely
 * in the water above the entrance, never on the museum floor or inside rock.
 */
const shrineFallback:GallerySwimPose={
  point:{...SHRINE_GALLERY.entrance},
  swimDepth:1.1,targetDepth:1.1,
  heading:{x:-1,z:0},yaw:Math.PI/2,pitch:.32,zoom:19,
};

/** Resolve once on exit. Preserve a genuine diver's location, direction,
 * depth and camera; constrain only values that could strand them in terrain.
 * Never mutate the entry snapshot, so repeated gallery trips stay independent.
 */
export function restoreGallerySwimPose(saved:GallerySwimPose|null):GallerySwimPose{
  const valid=!!saved&&Number.isFinite(saved.point.x)&&
    Number.isFinite(saved.point.z)&&isWater(saved.point)&&
    maxDiveDepth(saved.point)>=.52;
  const pose=valid?saved!:shrineFallback;
  const available=maxDiveDepth(pose.point);
  const depth=(value:number)=>Math.min(available,
    Math.max(.52,Number.isFinite(value)?value:1.1));
  const heading=Number.isFinite(pose.heading.x)&&Number.isFinite(pose.heading.z)
    ?pose.heading:shrineFallback.heading;
  return {
    point:{...pose.point},swimDepth:depth(pose.swimDepth),
    targetDepth:depth(pose.targetDepth),heading:{...heading},
    yaw:Number.isFinite(pose.yaw)?pose.yaw:shrineFallback.yaw,
    pitch:Number.isFinite(pose.pitch)?pose.pitch:shrineFallback.pitch,
    zoom:Number.isFinite(pose.zoom)?pose.zoom:shrineFallback.zoom,
  };
}
