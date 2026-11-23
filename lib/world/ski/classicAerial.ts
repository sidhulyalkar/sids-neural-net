/** A small, deterministic visual trick layer for the *classic* island skier.
 * Does not move the skier, alter snow contact, change the flight trajectory,
 * or opt into the retired Ski V3 simulation.
 */
export type ClassicSkiSpinCommand=-360|-180|180|360;
export type ClassicSkiSpinLanding="none"|"clean"|"short"|"missed";
export type ClassicSkiSpin={
  airborne:boolean;
  heldControl:boolean;
  flipDegrees:number;
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
  airborne:false,heldControl:false,flipDegrees:0,targetDegrees:0,rotationDegrees:0,stance:0,
  landing:"none",latestName:"",latestDegrees:0,completed:0,failed:0,serial:0,
});
export function beginClassicSkiAir(s:ClassicSkiSpin):ClassicSkiSpin{
  if(s.airborne)return s;
  return {...s,airborne:true,heldControl:false,flipDegrees:0,targetDegrees:0,rotationDegrees:0};
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
  input: {spin:number;flip:number}={spin:0,flip:0},
):ClassicSkiSpin{
  if(!state.airborne){
    if(!physicallyAirborne)return state;
    state=beginClassicSkiAir(state);
  }
  if(!physicallyAirborne){
    if(state.heldControl){
      const spin=Math.round(state.rotationDegrees/180)*180;
      const flip=Math.round(state.flipDegrees/360)*360;
      const attempted=Math.abs(state.rotationDegrees)>5||Math.abs(state.flipDegrees)>5;
      const clean=canLandCleanly&&Math.abs(state.rotationDegrees-spin)<=35&&
        Math.abs(state.flipDegrees-flip)<=35&&(spin!==0||flip!==0);
      const name=[spin?Math.abs(spin)+"°":"",flip?
        (flip>0?"Frontflip":"Backflip")+(Math.abs(flip)>360?" ×"+Math.abs(flip/360):""):""].filter(Boolean).join(" + ")||"Partial rotation";
      return {...state,airborne:false,heldControl:false,targetDegrees:0,rotationDegrees:0,flipDegrees:0,
        stance:clean?normalizeStance(state.stance+spin):state.stance,
        latestName:attempted?name:state.latestName,latestDegrees:spin,
        landing:attempted?(clean?"clean":canLandCleanly?"short":"missed"):"none",
        completed:state.completed+Number(attempted&&clean),
        failed:state.failed+Number(attempted&&!clean),serial:state.serial+Number(attempted)};
    }
    if(!state.targetDegrees)return {...state,airborne:false,rotationDegrees:0};
    const residual=Math.abs(state.targetDegrees-state.rotationDegrees);
    const clean=canLandCleanly&&residual<=35;
    const name=Math.abs(state.targetDegrees)+"°"+(clean&&
      normalizeStance(state.stance+state.targetDegrees)===180?" · switch":"");
    return {
      ...state,airborne:false,heldControl:false,flipDegrees:0,targetDegrees:0,rotationDegrees:0,
      stance:clean?normalizeStance(state.stance+state.targetDegrees):state.stance,
      latestName:name,latestDegrees:state.targetDegrees,
      landing:clean?"clean":canLandCleanly?"short":"missed",
      completed:state.completed+Number(clean),failed:state.failed+Number(!clean),
      serial:state.serial+1,
    };
  }
  if(!Number.isFinite(dt)||dt<=0)return state;
  const axis=(value:number)=>Number.isFinite(value)?Math.max(-1,Math.min(1,value)):0;
  const spin=axis(input.spin),flip=axis(input.flip);
  if(spin||flip||state.heldControl){
    return {...state,heldControl:true,targetDegrees:0,
      rotationDegrees:state.rotationDegrees+spin*Math.min(.05,dt)*SPIN_RATE,
      flipDegrees:state.flipDegrees+flip*Math.min(.05,dt)*SPIN_RATE};
  }
  if(!state.targetDegrees)return state;
  const delta=Math.min(.05,dt)*SPIN_RATE;
  const difference=state.targetDegrees-state.rotationDegrees;
  const amount=Math.sign(difference)*Math.min(Math.abs(difference),delta);
  return {...state,rotationDegrees:state.rotationDegrees+amount};
}
export function classicSkiDisplayYaw(s:ClassicSkiSpin):number{
  return (s.stance+s.rotationDegrees)*Math.PI/180;
}
