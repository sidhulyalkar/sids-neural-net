/** RAF timestamps can precede a resume timestamp during expensive initialization.
 * Never extrapolate physics or exponential camera smoothing backwards in time. */
export function worldFrameDelta(seconds:number):number {
  return Number.isFinite(seconds)?Math.max(0,Math.min(seconds,.05)):0;
}
