import {
  maxDiveDepth, seaFloorHeight, waterZone, type Point,
} from "./model";
import { UNDERWATER_TRIDENTS } from "./artifacts";
import { SHRINE_GALLERY } from "./hiddenShrineGallery";

/** Natural, deliberately subtle coral art pointing to the concealed timber
 * shrine. All guidance is world geometry, not labels, UI arrows or colliders.
 * This model is shared by rendering and tests to prevent drifting layouts.
 */
const westernTrident=UNDERWATER_TRIDENTS.find(t=>t.id==="trident-kelp");
if(!westernTrident)throw new Error("Western trident is required for shrine wayfinding");

export const SHRINE_CORAL_WAYFINDING={
  shrine:SHRINE_GALLERY.entrance,
  trident:westernTrident.point,
  stages:[.20,.40,.61,.80] as const,
  maxCoralRadius:.43,
  maxCoralHeight:.95,
  /** Leave the dive opening and the four timber shrine posts unobstructed. */
  shrineClearance:2.85,
  minSeabedDepth:3.5,
  maxVisualDistance:27,
} as const;

export type ShrineCoralGuide={
  id:string;
  point:Point;
  forward:Point;
  /** Slightly different each step so the reef feels organically grown. */
  size:number;
  richness:number;
};

const from=SHRINE_CORAL_WAYFINDING.trident;
const to=SHRINE_CORAL_WAYFINDING.shrine;
const distance=Math.hypot(to.x-from.x,to.z-from.z);
const forward={x:(to.x-from.x)/distance,z:(to.z-from.z)/distance};
const side={x:-forward.z,z:forward.x};

export const SHRINE_CORAL_GUIDES:readonly ShrineCoralGuide[]=
  SHRINE_CORAL_WAYFINDING.stages.map((t,i)=>{
    const naturalDrift=[.18,-.28,.21,-.12][i];
    return {
      id:`shrine-coral-arrow-${i+1}`,
      point:{
        x:from.x+(to.x-from.x)*t+side.x*naturalDrift,
        z:from.z+(to.z-from.z)*t+side.z*naturalDrift,
      },
      forward,
      size:[.70,.83,.96,1.05][i],
      richness:i+1,
    };
  });

/** Nine organic coral colonies form an arrow without one literal arrow mesh.
 * Forward is along the shaft, lateral is across its two arrowhead wings.
 */
export const CORAL_ARROW_COLONIES=[
  {forward:-1.10,lateral:0,scale:.81},
  {forward:-.66,lateral:-.035,scale:.85},
  {forward:-.23,lateral:.02,scale:.91},
  {forward:.20,lateral:0,scale:.90},
  {forward:.35,lateral:-.76,scale:.84},
  {forward:.65,lateral:-.39,scale:.81},
  {forward:.99,lateral:0,scale:1.08},
  {forward:.65,lateral:.42,scale:.83},
  {forward:.35,lateral:.78,scale:.81},
] as const;

export function coralColonyPositions(guide:ShrineCoralGuide){
  const lateral={x:-guide.forward.z,z:guide.forward.x};
  return CORAL_ARROW_COLONIES.map((colony,i)=>{
    const irregularity=.045*Math.sin(i*2.7+guide.richness);
    const along=(colony.forward+irregularity)*guide.size;
    const across=(colony.lateral+.025*Math.cos(i*3.2))*guide.size;
    const x=guide.point.x+guide.forward.x*along+lateral.x*across;
    const z=guide.point.z+guide.forward.z*along+lateral.z*across;
    return {
      point:{x,z},seabedY:seaFloorHeight(x,z),
      radius:SHRINE_CORAL_WAYFINDING.maxCoralRadius*colony.scale*guide.size,
      index:i,
    };
  });
}

/** An understated carved, coral-inlaid DIVE marker sits off the last
 * approach line, facing back toward the arriving swimmer. It is a genuine
 * world object, never a fixed HUD label or a collider.
 */
export const SHRINE_DIVE_MARKER={
  text:"DIVE",
  point:{
    x:from.x+(to.x-from.x)*.77+side.x*2.65,
    z:from.z+(to.z-from.z)*.77+side.z*2.65,
  } as Point,
  facing:{x:-forward.x,z:-forward.z} as Point,
  width:3.38,
  height:1.72,
  baseAboveSeabed:.24,
  leanRadians:-.22,
  label:"DIVE",
} as const;

/** Conservative bounds check for the entire tilted marker, not just center.
 * The protective margin includes its carved rim and seabed rock footing.
 */
export function shrineDiveMarkerValid():boolean{
  const marker=SHRINE_DIVE_MARKER;
  const shrine=SHRINE_CORAL_WAYFINDING.shrine;
  const halfDiagonal=Math.hypot(marker.width/2,marker.height/2)+.24;
  const clear=Math.hypot(marker.point.x-shrine.x,marker.point.z-shrine.z);
  if(clear-halfDiagonal<SHRINE_CORAL_WAYFINDING.shrineClearance)return false;
  if(waterZone(marker.point)!=="kelp"||maxDiveDepth(marker.point)<5)return false;
  const approach={
    x:SHRINE_CORAL_WAYFINDING.trident.x-marker.point.x,
    z:SHRINE_CORAL_WAYFINDING.trident.z-marker.point.z,
  };
  const approachLength=Math.hypot(approach.x,approach.z);
  if((approach.x*marker.facing.x+approach.z*marker.facing.z)/
    approachLength<.95)return false;
  const last=SHRINE_CORAL_GUIDES.at(-1)!;
  // Marker sits to the side of the final arrow, not atop its living colonies.
  for(const coral of coralColonyPositions(last)){
    if(Math.hypot(coral.point.x-marker.point.x,coral.point.z-marker.point.z)-
      coral.radius<marker.width*.31)return false;
  }
  return true;
}

export function shrineCoralLayoutValid():boolean{
  const shrine=SHRINE_CORAL_WAYFINDING.shrine;
  const trident=SHRINE_CORAL_WAYFINDING.trident;
  const dist=Math.hypot(trident.x-shrine.x,trident.z-shrine.z);
  if(dist<18||dist>34)return false;
  if(!shrineDiveMarkerValid())return false;
  if(SHRINE_CORAL_GUIDES.length!==4)return false;
  let previous=Infinity;
  for(const guide of SHRINE_CORAL_GUIDES){
    if(waterZone(guide.point)!=="kelp"||
      maxDiveDepth(guide.point)<SHRINE_CORAL_WAYFINDING.minSeabedDepth)return false;
    const d=Math.hypot(guide.point.x-shrine.x,guide.point.z-shrine.z);
    if(d>=previous)return false;
    previous=d;
    for(const coral of coralColonyPositions(guide)){
      if(waterZone(coral.point)!=="kelp")return false;
      const clear=Math.hypot(coral.point.x-shrine.x,coral.point.z-shrine.z);
      if(clear-coral.radius<SHRINE_CORAL_WAYFINDING.shrineClearance)
        return false;
    }
    const dot=guide.forward.x*(shrine.x-guide.point.x)+
      guide.forward.z*(shrine.z-guide.point.z);
    if(dot<=0)return false;
  }
  return true;
}
