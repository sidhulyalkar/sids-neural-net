import type {Point} from "./model";

/** Northern Natural-Bridges overlook, on the DRY forest-side shelf east of
 * the skimboarding beach. All world actors use these same authored anchors.
 * Keep the middle open as a walkable discovery clearing. */
export const MYSTIC_GROVE={
 center:{x:37,z:65} as Point,
 revealRadius:38,
 arcsPerSecond:16,
} as const;

export const MYSTIC_TREES:readonly Point[]=[
 {x:31.6,z:63.4},
 {x:33.8,z:69.0},
 {x:39.1,z:70.3},
 {x:43.5,z:66.2},
 {x:41.3,z:60.5},
 {x:38.2,z:58.4},
] as const;

export function mysticGroveDistance(point:Point){
 return Math.hypot(point.x-MYSTIC_GROVE.center.x,
  point.z-MYSTIC_GROVE.center.z);
}
