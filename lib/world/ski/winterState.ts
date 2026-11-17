/** Pure lifecycle for Ski V5's optional winter presentation.
 * Transition interpolation never changes the authoritative terrain surface.
 * Callers prepare/swap the matching render+collision surface atomically before
 * allowing a ski simulation tick, and release it only after phase=normal.
 */
export type WinterPhase = "normal" | "arriving" | "winter" | "departing";
export type WinterState = Readonly<{ phase: WinterPhase; blend: number }>;
export const INITIAL_WINTER_STATE: WinterState = Object.freeze({phase:"normal",blend:0});
export const WINTER_ARRIVAL_SECONDS = 2.4;
export const WINTER_DEPARTURE_SECONDS = 1.5;

const clamp01 = (v: number) => Math.max(0,Math.min(1,v));

/** Airborne exits must retain snow support until the landing is resolved.
 * Re-entering during the reverse transition resumes smoothly from its
 * existing blend. No frame-size-dependent overshoot or stale async timers.
 */
export function advanceWinter(
  previous: WinterState,
  deltaSeconds: number,
  skiing: boolean,
  safeToRestore: boolean,
): WinterState {
  const dt=Number.isFinite(deltaSeconds)?Math.max(0,Math.min(deltaSeconds,.25)):0;
  const current=clamp01(previous.blend);
  if(skiing){
    const blend=clamp01(current+dt/WINTER_ARRIVAL_SECONDS);
    return {blend,phase:blend===1?"winter":"arriving"};
  }
  if(!safeToRestore && previous.phase!=="normal"){
    return {blend:current,phase:previous.phase==="departing"?"arriving":previous.phase};
  }
  const blend=clamp01(current-dt/WINTER_DEPARTURE_SECONDS);
  return {blend,phase:blend===0?"normal":"departing"};
}
export const winterNeedsResources = (state:WinterState) => state.phase!=="normal";
