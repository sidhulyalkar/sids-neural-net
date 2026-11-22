/** Presentation and pointer geometry for the disc golf launch rail.
 * Deliberately pure so mouse, touch, stylus and keyboard release agree.
 * The physics uses the resulting ordinary DiscShot power, not a new rule. */
export const DISC_GOLF_RAIL_MIN=4;
export const DISC_GOLF_RAIL_MAX=100;
export const DISC_GOLF_RAIL_WINDOW=6;
export const clampDiscGolfRail=(v:number)=>
 Math.min(DISC_GOLF_RAIL_MAX,Math.max(DISC_GOLF_RAIL_MIN,v));
export function discGolfRailPower(clientX:number,left:number,width:number):number{
 if(![clientX,left,width].every(Number.isFinite)||width<=0)
  return DISC_GOLF_RAIL_MIN;
 return clampDiscGolfRail(Math.round((clientX-left)/width*100));
}
export function discGolfRailIdeal(suggested:number){
 const ideal=clampDiscGolfRail(Math.round(suggested));
 const low=Math.max(DISC_GOLF_RAIL_MIN,ideal-DISC_GOLF_RAIL_WINDOW);
 const high=Math.min(DISC_GOLF_RAIL_MAX,ideal+DISC_GOLF_RAIL_WINDOW);
 return {ideal,low,high};
}
export function discGolfRailStatus(power:number,suggested:number):
 "in-zone"|"near"|"outside"{
 const delta=Math.abs(clampDiscGolfRail(power)-clampDiscGolfRail(suggested));
 return delta<=DISC_GOLF_RAIL_WINDOW?"in-zone":delta<=17?"near":"outside";
}
