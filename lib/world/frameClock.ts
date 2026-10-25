/** Monotone simulation elapsed-time increments despite browser RAF clock
 * discontinuities. A negative delta is never a valid physics timestep. */
export function boundedWorldFrameDelta(now:number,previous:number):number{
 if(!Number.isFinite(now)||!Number.isFinite(previous))return 0;
 return Math.min(.5,Math.max(0,(now-previous)/1000));
}
/** A stale future timestamp is clock corruption, not an eternal cooldown.
 * Negative infinite "never used" sentinels also remain ready. */
export function rideCooldownReady(now:number,last:number,cooldown:number):boolean{
 if(!Number.isFinite(now))return false;
 if(last===-Infinity)return true;
 if(!Number.isFinite(last))return false;
 if(last>now)return true;
 return now-last>Math.max(0,cooldown);
}
