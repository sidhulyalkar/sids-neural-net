import type {Point} from "./model";

/**
 * One restrained, snow-carved halfpipe on Granite Ridge's forward ski face.
 * No glacier tunnels, linked terrain park, rails, jumps or scene-wide effects.
 *
 * Local longitudinal +Z goes downhill, away from the upper mountain summit.
 * A *separate*, contained summit lift provides a little extra vertical descent.
 * World geography and existing waterways remain wholly unaffected elsewhere.
 */
export const MOUNTAIN_HALFPIPE={
  centerX:13.5,
  startZ:-57.5,
  endZ:-36,
  floorHalfWidth:1.25,
  lipHalfWidth:3.55,
  featherWidth:1.25,
  bankRise:3.1,
  centerCut:.42,
  endBlend:3.3,
} as const;

export const MOUNTAIN_SUMMIT={
  // Offset west from the arcade's x≈16 roof, and keep the photo at (1,-66)
  // outside the altered terrain. No elevation change over either museum.
  centerX:8,
  centerZ:-67,
  radiusX:3.8,
  radiusZ:4.5,
  rise:3.25,
} as const;

/** The legacy wooden takeoffs in the photographed face conflict with
 * the single sculpted snow run. Their ids remain in the old route manifest
 * for compatibility, but art, contact and automatic impulses are removed.
 * Features outside this local face retain their established behavior. */
export const SUPPRESSED_FACE_KICKERS=[
  "ski-kicker","bowl-small","bowl-medium",
] as const;
export function suppressedFaceKicker(id:string):boolean{
  return (SUPPRESSED_FACE_KICKERS as readonly string[]).includes(id);
}

const clamp01=(x:number)=>Math.min(1,Math.max(0,x));
export const smoothFace=(x:number)=>{
 const t=clamp01(x);
 return t*t*(3-2*t);
};

/** Smooth zero outside the strictly authored rectangle. No cut touches the
 * western pool, waterfall shoulder, arcade shaft or Joshua riding terrain. */
export function mountainHalfpipeInfluence(p:Point):number{
 const h=MOUNTAIN_HALFPIPE;
 const lateral=Math.abs(p.x-h.centerX);
 if(p.z<=h.startZ||p.z>=h.endZ||
    lateral>=h.lipHalfWidth+h.featherWidth)return 0;
 const entry=smoothFace((p.z-h.startZ)/h.endBlend);
 const exit=smoothFace((h.endZ-p.z)/h.endBlend);
 const feather=1-smoothFace(
   (lateral-h.lipHalfWidth)/h.featherWidth);
 return entry*exit*feather;
}

export function mountainHalfpipeBank(p:Point):number{
 const h=MOUNTAIN_HALFPIPE;
 const lateral=Math.abs(p.x-h.centerX);
 const t=(lateral-h.floorHalfWidth)/
   (h.lipHalfWidth-h.floorHalfWidth);
 // Genuinely flat central bottom and smooth zero-gradient wall crest.
 return h.bankRise*smoothFace(t);
}

/** A continuous, carver-friendly channel. The center preserves the mountain
 * longitudinal grade; only its cross-section and the bank above it change. */
export function carveMountainHalfpipe(
 p:Point,unmodifiedHeight:number,centerHeight:(z:number)=>number,
):number{
 const influence=mountainHalfpipeInfluence(p);
 if(influence<=0)return unmodifiedHeight;
 const target=centerHeight(p.z)-MOUNTAIN_HALFPIPE.centerCut+
   mountainHalfpipeBank(p);
 return unmodifiedHeight+(target-unmodifiedHeight)*influence;
}

export function mountainSummitBoost(p:Point):number{
 const s=MOUNTAIN_SUMMIT;
 const a=Math.abs((p.x-s.centerX)/s.radiusX);
 const b=Math.abs((p.z-s.centerZ)/s.radiusZ);
 if(a>=1||b>=1)return 0;
 // Compactly supported dome. Exact zero at the patch boundary.
 const dome=(1-smoothFace(a))*(1-smoothFace(b));
 return s.rise*dome;
}

export function mountainFaceEditDelta(
 p:Point,baseHeight:number,centerHeight:(z:number)=>number,
):number{
 return carveMountainHalfpipe(p,baseHeight,centerHeight)-baseHeight+
   mountainSummitBoost(p);
}

/** Clear the entire natural approach, pipe, and receiving slope of
 * procedurally placed trees and boulders, without touching mountain caves
 * or any waterfall/stream coordinate outside this bounded ski face. */
export function mountainHalfpipeApproachClearance(p:Point):boolean{
 const h=MOUNTAIN_HALFPIPE;
 return Math.abs(p.x-h.centerX)<=h.lipHalfWidth+h.featherWidth+1.0 &&
   p.z>=h.startZ-3.0&&p.z<=h.endZ+3.0;
}
export function withinMountainHalfpipe(p:Point):boolean{
 return mountainHalfpipeInfluence(p)>.35;
}

/** Deliberate gentle pop is allowed in selected ski mode, but the halfpipe
 * never invents an automatic jump or the older scored Big Air experience. */
export function halfpipeManualPopEligible(
 p:Point,mode:string,speed:number,grounded:boolean,
):boolean{
 return mode==="ski"&&grounded&&Number.isFinite(speed)&&speed>=3.1&&
   withinMountainHalfpipe(p);
}

/** Snapshot of protected geology. These footprints are explicit release
 * invariants, not approximate suggestions. */
export const MOUNTAIN_PROTECTED_ANCHORS={
  meltwaterSource:{x:-13,z:-66},
  fernWaterfall:{x:-20,z:-24},
  waterfallApproach:{x:-20,z:-33.8},
  coastalStream:{x:-27,z:-11},
  arcadeEntrance:{x:16,z:-82},
  arcadeInterior:{x:16,z:-72},
  westCanyon:{x:-67,z:-52},
  joshuaRoute:{x:26,z:-39},
  bigAirMarkedLip:{x:-2,z:-49},
} as const;
