import type {SkiInput,SkiSimulation} from "./simulation";

export type SkiSpinName="180"|"360"|null;
export type SkiSpinLanding="clean"|"rough"|"crash";
export type SkiTrickEvidence={
  serial:number;
  takeoffTick:number;touchdownTick:number;
  inputSteeringTicks:number;airborneTicks:number;
  yawRadians:number;name:SkiSpinName;landing:SkiSpinLanding;
  qualified:boolean;
};

/** Recognizes player-controlled aerial rotations from fixed-physics ticks.
 * The actual simulation owns the landing classifier and integrated yaw.
 * This observer does not add torque, airtime, points, or assisted tricks.
 * A label is *qualified* only after a clean touchdown, enough genuine
 * steering input, and a completed half/full rotation within tolerance. */
export class SkiTrickQualification{
  latest:SkiTrickEvidence|null=null;
  serial=0;
  private inAir=false;
  private takeoffTick=-1;
  private steeringTicks=0;
  private airborneTicks=0;

  observe(sim:SkiSimulation,input:SkiInput):SkiTrickEvidence|null{
    if(sim.phase==="air"){
      if(!this.inAir){
        this.takeoffTick=sim.tick;
        this.steeringTicks=0;
        this.airborneTicks=0;
      }
      this.inAir=true;
      this.airborneTicks++;
      if(Math.abs(input.steer)>.35)this.steeringTicks++;
      return null;
    }
    if(!this.inAir)return null;
    this.inAir=false;
    if(sim.landing==="none")return null;
    const radians=sim.airSpinRadians;
    const angle=Math.abs(radians);
    const error180=Math.abs(angle-Math.PI);
    const error360=Math.abs(angle-2*Math.PI);
    const name:SkiSpinName=this.steeringTicks>=8&&this.airborneTicks>=12
      ?(error180<.38&&error180<=error360?"180":
        error360<.38?"360":null)
      :null;
    const qualified=name!==null&&sim.landing==="clean";
    if(qualified)this.serial++;
    const evidence:SkiTrickEvidence={
      serial:this.serial,takeoffTick:this.takeoffTick,touchdownTick:sim.tick,
      inputSteeringTicks:this.steeringTicks,airborneTicks:this.airborneTicks,
      yawRadians:radians,name,landing:sim.landing,qualified,
    };
    this.latest=evidence;
    return evidence;
  }
}
