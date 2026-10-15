/** Canonical jet-ski input mapping for keyboard, touch and accessibility.
 * Reverse always wins over boost; boost alone accelerates forward so a single
 * Shift key or BOOST touch button is sufficient to get moving.
 */
import type {JetSkiInput} from "./jetSkiRace";
export type JetSkiTouchInput={throttle:number;steer:number;brake:boolean};
const clamp=(v:number)=>Math.max(-1,Math.min(1,v));
export function jetSkiControlInput(keys:ReadonlySet<string>,
 touch:JetSkiTouchInput,touchBoost:boolean,speed:number):JetSkiInput{
 const reverse=keys.has("s")||keys.has("arrowdown")||touch.throttle<0;
 const accelerate=keys.has("w")||keys.has("arrowup")||touch.throttle>0;
 const turbo=(keys.has("shift")||touchBoost)&&!reverse;
 const steer=clamp(Number(keys.has("d")||keys.has("arrowright"))-
  Number(keys.has("a")||keys.has("arrowleft"))+touch.steer);
 return {throttle:reverse?-1:accelerate||turbo?1:0,
  steer,brake:reverse&&speed>0,turbo};
}
