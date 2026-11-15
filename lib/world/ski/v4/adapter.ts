/** Compatibility boundary for Sid's existing skiing visuals and activity UI.
 * Only SkiV4Physics advances skier motion. SkiSimulation is inherited solely
 * to preserve the pre-existing renderer's structural contract; super.advance
 * is deliberately never called. This is a non-release experiment until the
 * old long-ski presentation matches physical contact at the halfpipe lips.
 */
import {Euler,Vector3} from "three/src/Three.Core.js";
import {fitSkiContact} from "@/components/world/worldSkiContact";
import {SkiSimulation,type SkiInput} from "../simulation";
import {SkiV4Physics,type SkiV4Input,type SkiV4Contact} from "./core";

const UP=new Vector3(0,1,0);
export class SkiV4Simulation extends SkiSimulation{
  readonly v4:SkiV4Physics;
  readonly engine="snow-forces-v4" as const;
  readonly visualContactMismatch=[0,0];
  private readonly contactSurface:(x:number,z:number)=>number;
  private started=false;
  private readonly from=new Vector3();
  private readonly to=new Vector3();
  private readonly euler=new Euler(0,0,0,"YXZ");
  constructor(height:(x:number,z:number)=>number,x:number,z:number,
    constrain?:(from:Vector3,to:Vector3)=>{x:number;z:number}){
    super(height,x,z,"independent",false,constrain);
    this.contactSurface=height;
    this.v4=new SkiV4Physics(height,x,z,constrain?
      (from,to)=>constrain(this.from.set(from.x,height(from.x,from.z),from.z),
        this.to.set(to.x,height(to.x,to.z),to.z)):undefined);
    this.sync();
  }
  override setHeading(x:number,z:number){
    super.setHeading(x,z);
    this.v4.setHeading(x,z);
    if(!this.started){
      this.v4.setHorizontalVelocity(this.velocity.x,this.velocity.z);
      this.started=true;
    }
    this.sync();
  }
  override advance(seconds:number,inputAt:(tick:number)=>SkiInput,
    afterStep?:(sim:SkiSimulation,input:SkiInput)=>void){
    if(!this.started){
      this.v4.setHorizontalVelocity(this.velocity.x,this.velocity.z);
      this.started=true;
    }
    let latest:SkiInput={steer:0,pitch:0,roll:0,tuck:false,brake:false,jump:false,grab:false};
    this.v4.advance(seconds,tick=>{
      latest=inputAt(tick);
      const input:SkiV4Input={steer:latest.steer,pitch:latest.pitch,
        roll:latest.roll,tuck:latest.tuck,brake:latest.brake?1:0,
        jump:latest.jump,grab:latest.grab};
      return input;
    },()=>{
      this.sync();
      afterStep?.(this,latest);
    });
    this.sync();
  }
  private sync(){
    const p=this.v4;
    this.position.set(p.position.x,p.position.y,p.position.z);
    this.velocity.set(p.velocity.x,p.velocity.y,p.velocity.z);
    if(p.phase==="air")this.rotation.setFromEuler(
      this.euler.set(p.airPitchRadians,p.yaw,p.airRollRadians,"YXZ"));
    else this.rotation.setFromAxisAngle(UP,p.yaw);
    this.angular.set(p.phase==="air"?p.airPitchRate:0,
      p.phase==="air"?p.airYawRate:0,
      p.phase==="air"?p.airRollRate:0);
    this.phase=p.phase;this.landing=p.landing;this.tick=p.tick;
    this.remainder=p.remainder;this.droppedSeconds=p.droppedSeconds;
    this.charge=p.charge;this.edge=p.edge;this.pressure=p.pressure;
    this.grip=p.grip;this.grab=p.grab;this.airSpinRadians=p.airSpinRadians;
    this.contact[0]=p.contact[0].loaded;this.contact[1]=p.contact[1].loaded;
    this.load[0]=p.contact[0].load;this.load[1]=p.contact[1].load;
    const forward={x:Math.sin(p.yaw),z:Math.cos(p.yaw)};
    for(let i=0;i<2;i++){
      const source=p.contact[i] as SkiV4Contact;
      const fit=fitSkiContact({x:p.position.x,z:p.position.z},forward,
        i===0?-1:1,({x,z})=>this.contactSurface(x,z),this.soles[i],true);
      // The *measured* discrepancy is retained: never claim visual matching by
      // replacing the rigid ski with an unconstrained painted snow ribbon.
      this.visualContactMismatch[i]=Math.abs(fit.position.y-source.boot.y);
    }
    this.normal.set((p.contact[0].normal.x+p.contact[1].normal.x)*.5,
      (p.contact[0].normal.y+p.contact[1].normal.y)*.5,
      (p.contact[0].normal.z+p.contact[1].normal.z)*.5).normalize();
  }
}
