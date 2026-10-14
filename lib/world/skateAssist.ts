import type {SkateTrickName} from "./skateTricks";

/**
 * Default, forgiving one-button style selection for Sid's World.
 * Pure and deterministic: no randomness, mutable globals or new world props.
 * The normal Flick controls continue to select exact tricks directly.
 */
export type SkateAssistContext={
  attempt:number;
  speed:number;
  inPark:boolean;
  airborne:boolean;
};
const FLOW:readonly SkateTrickName[]=[
  "Ollie","Kickflip","Pop Shuvit","Heelflip","Tre Flip","360 Shuvit",
] as const;

/** A single action always starts with something approachable, then rotates
 * through recognizable silhouettes. A jump already launched by the terrain
 * gets a showier move without a second jump impulse. */
export function selectAssistedSkateTrick(context:SkateAssistContext):SkateTrickName{
 const attempt=Number.isFinite(context.attempt)?Math.max(0,Math.floor(context.attempt)):0;
 const speed=Number.isFinite(context.speed)?Math.max(0,context.speed):0;
 if(context.airborne)return speed>=5?"Tre Flip":"Kickflip";
 if(attempt===0&&speed<4)return "Ollie";
 const offset=context.inPark&&speed>=7?1:0;
 return FLOW[(attempt+offset)%FLOW.length];
}

/** A fast pass through the skatepark occasionally adds a simple body rotation.
 * The spin is additive to an already-allowed pop; not a separate input gate. */
export function assistedSkateSpin(context:SkateAssistContext): -1|0|1 {
 const speed=Number.isFinite(context.speed)?context.speed:0;
 if(speed<6||!context.inPark&&!context.airborne||context.attempt<2||
  context.attempt%4!==2)return 0;
 return context.attempt%8===2?1:-1;
}
