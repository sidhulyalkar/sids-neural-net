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

/** A quiet electrical signal circles the grove one branch link at a time.
 * Pure sampled phase for deterministic playback at any render framerate. */
export const MYSTIC_CIRCUIT={
 secondsPerLink:1.35,
 pulseWidth:.23,
} as const;

export function mysticCircuitPhase(elapsed:number,links:number){
 if(!Number.isFinite(elapsed)||links<=0)return {link:-1,progress:0};
 const cycle=links*MYSTIC_CIRCUIT.secondsPerLink;
 const position=(((elapsed%cycle)+cycle)%cycle)/MYSTIC_CIRCUIT.secondsPerLink;
 return {link:Math.floor(position)%links,progress:position%1};
}

export function mysticCircuitIntensity(
 elapsed:number,link:number,u:number,total:number,reducedMotion=false,
){
 if(reducedMotion)return .32;
 const state=mysticCircuitPhase(elapsed,total);
 if(state.link<0)return .08;
 const previous=(state.link+total-1)%total;
 const travel=link===state.link?
  .87*Math.exp(-Math.pow((u-state.progress)/MYSTIC_CIRCUIT.pulseWidth,2)):0;
 // The previous tree retains a fading echo as the impulse reaches its neighbor.
 const echo=link===previous ? .10*(1-state.progress)*u : 0;
 return Math.min(1,.085+travel+echo);
}
