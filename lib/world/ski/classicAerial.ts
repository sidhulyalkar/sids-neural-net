/** A small, deterministic visual trick layer for the *classic* island skier.
 * Does not move the skier, alter snow contact, change the flight trajectory,
 * or opt into the retired Ski V3 simulation.
 */
export type ClassicSkiSpinCommand=-360|-180|180|360;
export type ClassicSkiSpinLanding="none"|"clean"|"short"|"missed";
export type ClassicSkiSpin={
  airborne:boolean;
  targetDegrees:number;
  rotationDegrees:number;
  /** 180 denotes riding switch relative to actual travel, not reversed velocity. */
  stance:0|180;
  landing:ClassicSkiSpinLanding;
  latestName:string;
  latestDegrees:number;
  completed:number;
  failed:number;
  serial:number;
};
export const initialClassicSkiSpin=():ClassicSkiSpin=>({
  airborne:false,targetDegrees:0,rotationDegrees:0,stance:0,
  landing:"none",latestName:"",latestDegrees:0,completed:0,failed:0,serial:0,
});
export function beginClassicSkiAir(s:ClassicSkiSpin):ClassicSkiSpin{
  if(s.airborne)return s;
  return {...s,airborne:true,targetDegrees:0,rotationDegrees:0};
}
/** Each physical press adds an intentional half/full-turn. Opposite presses
 * do not cancel an underway trick and repeat events must be filtered upstream.
 */
export function queueClassicSkiSpin(
  s:ClassicSkiSpin,degrees:ClassicSkiSpinCommand,
):ClassicSkiSpin{
  if(!s.airborne)return s;
  if(s.targetDegrees!==0&&Math.sign(degrees)!==Math.sign(s.targetDegrees))return s;
  const requested=s.targetDegrees+degrees;
  if(Math.abs(requested)>720)return s;
  return {...s,targetDegrees:requested};
}
const SPIN_RATE=720; // 180 in .25 seconds, 360 in .5 seconds
function normalizeStance(v:number):0|180{
  const degrees=((Math.round(v/180)*180)%360+360)%360;
  return degrees===180?180:0;
}
export function advanceClassicSkiSpin(
  state:ClassicSkiSpin,dt:number,physicallyAirborne:boolean,
  canLandCleanly=true,
):ClassicSkiSpin{
  if(!state.airborne)return physicallyAirborne?beginClassicSkiAir(state):state;
  if(!physicallyAirborne){
    if(!state.targetDegrees)return {...state,airborne:false,rotationDegrees:0};
    const residual=Math.abs(state.targetDegrees-state.rotationDegrees);
    const clean=canLandCleanly&&residual<=35;
    const name=Math.abs(state.targetDegrees)+"°"+(clean&&
      normalizeStance(state.stance+state.targetDegrees)===180?" · switch":"");
    return {
      ...state,airborne:false,targetDegrees:0,rotationDegrees:0,
      stance:clean?normalizeStance(state.stance+state.targetDegrees):state.stance,
      latestName:name,latestDegrees:state.targetDegrees,
      landing:clean?"clean":canLandCleanly?"short":"missed",
      completed:state.completed+Number(clean),failed:state.failed+Number(!clean),
      serial:state.serial+1,
    };
  }
  if(!Number.isFinite(dt)||dt<=0||!state.targetDegrees)return state;
  const delta=Math.min(.05,dt)*SPIN_RATE;
  const difference=state.targetDegrees-state.rotationDegrees;
  const amount=Math.sign(difference)*Math.min(Math.abs(difference),delta);
  return {...state,rotationDegrees:state.rotationDegrees+amount};
}
export function classicSkiDisplayYaw(s:ClassicSkiSpin):number{
  return (s.stance+s.rotationDegrees)*Math.PI/180;
}
