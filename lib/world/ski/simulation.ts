import {createSkiContact,fitSkiContact,SKI_HALF_LENGTH,SKI_HALF_WIDTH,SKI_STANCE,SKI_SOLE_Y} from "../../../components/world/worldSkiContact";
import {Matrix4, Quaternion, Vector3} from "three";

// iLand prototype tuning in world units and seconds. No Bonvo measurements.
export const tuning = Object.freeze({
  version: 2, dt: 1/120, gravity: 12, drag: .012, flatGrip: .65, engagedGrip: 6, edgeResponse: 5,
  brake: 7, maxTurn: 2.6, maxCharge: .65, pop: 6, spin: 8, flip: 6,
});
export type SkiInput = { steer:number; pitch:number; roll:number; tuck:boolean; brake:boolean; jump:boolean; grab:boolean };
export const neutral:SkiInput = {steer:0,pitch:0,roll:0,tuck:false,brake:false,jump:false,grab:false};
type Surface = (x:number,z:number)=>number;
type Phase = "riding"|"charging"|"air"|"stumble"|"crash"|"recovery";
const up=new Vector3(0,1,0);
const clamp=(v:number)=>Math.max(-1,Math.min(1,v));

export class SkiSimulation {
  readonly position=new Vector3();
  readonly previous=new Vector3();
  readonly velocity=new Vector3();
  readonly rotation=new Quaternion();
  readonly angular=new Vector3();
  readonly normal=new Vector3();
  readonly contact=[false,false];
  phase:Phase="riding";
  landing:"none"|"clean"|"rough"|"crash"="none";
  tick=0;
  remainder=0;
  charge=0;
  edge=0;
  pressure=0;
  grip=0;
  grab=false;
  impact=0;
  private held=false;
  private age=0;
  private yaw=0;
  private turn=0;
  private readonly forward=new Vector3();
  private readonly side=new Vector3();
  private readonly axis=new Vector3();
  private readonly basis=new Matrix4();
  private readonly delta=new Quaternion();
  readonly soles=[createSkiContact(),createSkiContact()];
  readonly load=[.5,.5];
  private readonly sampleHeight=(p:{x:number;z:number})=>this.height(p.x,p.z);
  readonly pitchOffset=[0,0];
  private readonly pitchRate=[0,0];
  private readonly pivotStation=[0,0];
  private readonly supports=[0,0];
  private readonly solePoint=new Vector3();
  constructor(private readonly height:Surface,x:number,z:number,readonly footprint:boolean|"independent"=false,readonly pivotEnabled=false){
    this.position.set(x,height(x,z),z);
    if(footprint)this.position.y=this.sample();
    this.previous.copy(this.position);
  }
  advance(seconds:number,inputAt:(tick:number)=>SkiInput){
    if(!Number.isFinite(seconds)||seconds<=0)return;
    this.remainder+=Math.min(seconds,.25);
    while(this.remainder+1e-12>=tuning.dt){
      this.step(inputAt(this.tick));
      this.remainder=Math.max(0,this.remainder-tuning.dt);
    }
  }
  interpolate(out:Vector3){
    return out.lerpVectors(this.previous,this.position,this.remainder/tuning.dt);
  }
  private sample(){
    const {x,z}=this.position;
    const d=.05;
    this.normal.set(this.height(x-d,z)-this.height(x+d,z),2*d,
      this.height(x,z-d)-this.height(x,z+d)).normalize();
    if(this.footprint==="independent"&&this.phase!=="air"){
      const heading=this.solePoint.set(0,0,1).applyQuaternion(this.rotation);
      for(let i=0;i<2;i++){
        const pose=fitSkiContact(this.position,heading,2*i-1,this.sampleHeight,this.soles[i],true,this.pitchOffset[i],this.pivotStation[i]);
        this.supports[i]=pose.position.y;
      }
      // Alternate outside ski carries more load as the signed edge builds.
      const supportDelta=this.supports[0]-this.supports[1];
      const reach=.45;
      const left=Math.max(0,Math.min(1,.5+.32*this.edge+supportDelta/(2*reach)));
      this.load[0]=left;this.load[1]=1-left;
      const support=Math.max(Math.max(...this.supports)-reach,left*this.supports[0]+(1-left)*this.supports[1]);
      for(let i=0;i<2;i++){
        this.contact[i]=support-this.supports[i]<=reach&&this.load[i]>0;
        this.soles[i].position.y=Math.max(this.supports[i],support-reach);
      }
      this.normal.copy(this.soles[0].up).multiplyScalar(left).addScaledVector(this.soles[1].up,1-left).normalize();
      return support;
    }
    this.side.set(.23,0,0).applyQuaternion(this.rotation);
    let support=-Infinity;
    for(let i=0;i<2;i++){
      const sign=i===0?-1:1;
      let sole=this.height(x+sign*this.side.x,z+sign*this.side.z)-sign*this.side.y;
      if(this.footprint){
        sole=-Infinity;
        for(let j=0;j<=16;j++)for(let w=-1;w<=1;w++){
          const p=this.solePoint.set(sign*SKI_STANCE+w*SKI_HALF_WIDTH,SKI_SOLE_Y,
            (j/8-1)*SKI_HALF_LENGTH).applyQuaternion(this.rotation);
          sole=Math.max(sole,this.height(x+p.x,z+p.z)-p.y);
        }
      }
      this.supports[i]=sole;
      this.contact[i]=this.position.y-sole<=.035;
      support=Math.max(support,sole);
    }
    return support;
  }
  private unsupportedBoot(){
    // A loaded patch under either binding can still carry the skier.
    for(let i=0;i<2;i++){
      const sole=this.soles[i];
      if(this.load[i]>.05&&sole.supportStart<=.12&&sole.supportEnd>=-.12)return false;
    }
    return true;
  }
  private settle(support:number){
    this.position.y=support;
    if(this.footprint===true)for(let i=0;i<2;i++)this.contact[i]=support-this.supports[i]<=.035;
  }
  private step(input:SkiInput){
    const dt=tuning.dt;
    this.previous.copy(this.position);
    this.age+=dt;
    this.tick++;
    this.sample();
    if(this.pivotEnabled&&this.footprint==="independent"){
      for(let i=0;i<2;i++){
        const sole=this.soles[i];
        // Closest end of the support interval to the loaded binding.
        const arm=Math.max(sole.supportStart,Math.min(0,sole.supportEnd));
        const loaded=this.phase!=="air"&&this.contact[i];
        this.pivotStation[i]=loaded?arm:0;
        const torque=loaded?-arm*this.load[i]*tuning.gravity:0;
        this.pitchRate[i]+=(torque-12*this.pitchOffset[i]-5*this.pitchRate[i])*dt;
        this.pitchOffset[i]=Math.max(-.35,Math.min(.35,this.pitchOffset[i]+this.pitchRate[i]*dt));
      }
    }
    const released=this.held&&!input.jump;
    this.held=input.jump;
    if(this.phase==="air"){
      this.grab=input.grab;
      this.angular.lerp(this.axis.set(clamp(input.pitch)*tuning.flip,clamp(input.steer)*tuning.spin,
        clamp(input.roll)*tuning.flip),1-Math.exp(-6*dt));
      const rate=this.angular.length();
      if(rate>0)this.rotation.multiply(this.delta.setFromAxisAngle(this.axis.copy(this.angular).normalize(),rate*dt)).normalize();
      this.velocity.y-=tuning.gravity*dt;
      this.position.addScaledVector(this.velocity,dt);
      const support=this.sample();
      if(this.position.y<=support && this.velocity.dot(this.normal)<=0){
        this.impact=-this.velocity.dot(this.normal);
        this.forward.set(0,0,1).applyQuaternion(this.rotation);
        this.axis.copy(this.velocity).projectOnPlane(this.normal);
        const align=Math.abs(this.forward.dot(this.axis.normalize()));
        const upright=this.axis.copy(up).applyQuaternion(this.rotation).dot(this.normal);
        const oneSki=this.contact[0]!==this.contact[1];
        this.landing=upright<.45||align<.45||this.impact>13||rate>6?"crash":
          upright<.8||align<.8||this.impact>8||rate>3||oneSki?"rough":"clean";
        this.phase=this.landing==="crash"?"crash":this.landing==="rough"?"stumble":"riding";
        this.age=0;
        this.yaw=Math.atan2(this.forward.x,this.forward.z);
        this.velocity.projectOnPlane(this.normal);
        this.settle(this.footprint==="independent"?this.sample():support);
        this.angular.set(0,0,0);
        this.grab=false;
      }
      return;
    }
    const impaired=this.phase==="crash"||this.phase==="stumble"||this.phase==="recovery";
    if(impaired&&this.age>(this.phase==="crash"?1.1:.55)){
      this.phase=this.phase==="crash"?"recovery":"riding";this.age=0;
    }
    this.velocity.projectOnPlane(this.normal);
    const speed=this.velocity.length();
    this.turn+=((impaired?0:clamp(input.steer))*Math.min(tuning.maxTurn,10/Math.max(2,speed))-this.turn)*(1-Math.exp(-5*dt));
    this.yaw+=this.turn*dt;
    this.forward.set(Math.sin(this.yaw),0,Math.cos(this.yaw)).projectOnPlane(this.normal).normalize();
    this.side.crossVectors(this.normal,this.forward).normalize();
    this.velocity.addScaledVector(this.axis.set(0,-tuning.gravity,0).projectOnPlane(this.normal),dt);
    // Signed edge passes through flat during a direction change.
    this.edge+=((impaired?0:clamp(input.steer))-this.edge)*(1-Math.exp(-tuning.edgeResponse*dt));
    const lateral=this.velocity.dot(this.side);
    const alignment=Math.abs(this.velocity.dot(this.forward))/Math.max(.01,this.velocity.length());
    // Load proxy combines normal gravity and turning demand; squat unloads the edge.
    this.pressure=Math.max(0,this.normal.y)+Math.min(1,Math.abs(this.turn)*speed/tuning.gravity);
    this.grip=tuning.flatGrip+tuning.engagedGrip*Math.abs(this.edge)*this.pressure*
      (.25+.75*alignment)*(1-.45*this.charge/tuning.maxCharge);
    this.velocity.addScaledVector(this.side,-lateral*(1-Math.exp(-this.grip*dt)));
    this.velocity.multiplyScalar(Math.exp(-dt*(tuning.drag*speed*(input.tuck?.55:1)+(impaired?2:0))));
    if(input.brake)this.velocity.multiplyScalar(Math.max(0,1-tuning.brake*dt/Math.max(.001,this.velocity.length())));
    const target=this.delta.setFromRotationMatrix(this.basis.makeBasis(this.side,this.normal,this.forward));
    if(this.phase!=="crash")this.rotation.slerp(target,1-Math.exp(-(impaired?3:15)*dt));
    if(!impaired&&input.jump){this.charge=Math.min(tuning.maxCharge,this.charge+dt);this.phase="charging";}
    if(released&&this.phase==="charging"){
      this.velocity.addScaledVector(this.normal,2+tuning.pop*this.charge/tuning.maxCharge);
      this.phase="air";this.age=0;this.charge=0;
    }
    this.position.addScaledVector(this.velocity,dt);
    const support=this.sample();
    if(this.phase!=="air"){
      const separation=this.position.y-support;
      const departing=this.velocity.dot(this.normal)>.15;
      const lostSupport=this.footprint==="independent"&&this.unsupportedBoot()&&
        separation>tuning.gravity*dt*dt+.008;
      if(!impaired&&departing&&(separation>.04||lostSupport)){
        this.phase="air";this.charge=0;this.age=0;
        this.contact.fill(false);this.load.fill(0);
      }else this.settle(support);
    }
  }
}
