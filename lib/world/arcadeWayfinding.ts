import {ARCADE_CAVE,arcadeCaveFloorHeight,terrainHeight,type Point} from "./model";

/** Four discoverable breadcrumbs descending the open Granite Ridge shoulder
 * toward the cavern's real south-facing mouth. All stonework is visual-only:
 * no new ground-height collision, walls, or tunnel-layer intersections. */
export const ARCADE_TRAIL_MARKERS=[
 {id:"ridge-beacon",point:{x:10.4,z:-55.4},height:4.8},
 {id:"switchback-cairn",point:{x:20.8,z:-68.8},height:3.1},
 {id:"cave-overlook",point:{x:20.6,z:-77.2},height:3.6},
 {id:"mouth-waystone",point:{x:20.0,z:-85.4},height:2.45},
] as const;

export const ARCADE_GATE={
 left:{x:ARCADE_CAVE.entrance.x-4.5,z:ARCADE_CAVE.entrance.z-.55},
 right:{x:ARCADE_CAVE.entrance.x+4.5,z:ARCADE_CAVE.entrance.z-.55},
 beacon:{x:ARCADE_CAVE.entrance.x,z:ARCADE_CAVE.entrance.z-.75},
 sign:{x:ARCADE_CAVE.approach.x,z:ARCADE_CAVE.approach.z+.35},
} as const;

export function arcadeTrailStage(point:Point,caveLayer:"surface"|"arcade"|"paper"){
 if(caveLayer==="arcade")return "inside" as const;
 if(caveLayer!=="surface")return "hidden" as const;
 const mouth=Math.hypot(point.x-ARCADE_CAVE.entrance.x,
  point.z-ARCADE_CAVE.entrance.z);
 if(mouth<12)return "entrance" as const;
 if(ARCADE_TRAIL_MARKERS.some(marker=>
  Math.hypot(point.x-marker.point.x,point.z-marker.point.z)<(marker.id==="ridge-beacon"?12:9)))
  return "trail" as const;
 return "hidden" as const;
}

export function arcadeTrailHint(point:Point,caveLayer:"surface"|"arcade"|"paper"){
 const stage=arcadeTrailStage(point,caveLayer);
 return stage==="entrance"?"ARCADE CAVERN · ENTER THE SPLIT STONE":
  stage==="trail"?"AMBER CAIRNS · FOLLOW THE LIGHT TO THE ARCADE":
  "";
}

/** Grounded anchor points help tests reject visually floating beacons. */
export function arcadeTrailFooting(p:Point){
 return terrainHeight(p.x,p.z);
}

/** Safe camera pose on the open outside lip, looking AT the gateway rather
 * than THROUGH the unreconstructed mountain roof behind the portal. Fast
 * travel snaps here before lerping resumes, so the camera never flies inside
 * the terrain while traversing the island from an unrelated biome. */
export function arcadeEntranceCameraPose(){
 const {entrance}=ARCADE_CAVE;
 const floor=arcadeCaveFloorHeight(entrance);
 // A real ~6.3m rear boom at the (-86.4) arrival leaves room to frame
 // the basalt gateway and avoids the 3.7m closeup that clipped the facade.
 const cameraZ=entrance.z-10.7;
 return {
  position:{x:entrance.x,y:Math.max(
   terrainHeight(entrance.x,cameraZ)+4.7,floor+1.9),z:cameraZ},
  look:{x:entrance.x,y:floor+3.55,z:entrance.z-.95},
 };
}
