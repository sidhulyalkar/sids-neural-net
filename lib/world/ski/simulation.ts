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
  constructor(private readonly height:Surface,x:number,z:number){
    this.position.set(x,height(x,z),z);
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
    this.side.set(.23,0,0).applyQuaternion(this.rotation);
    let support=-Infinity;
    for(let i=0;i<2;i++){
      const sign=i===0?-1:1;
      const sole=this.height(x+sign*this.side.x,z+sign*this.side.z)-sign*this.side.y;
      this.contact[i]=this.position.y-sole<=.035;
      support=Math.max(support,sole);
    }
    return support;
  }
  private step(input:SkiInput){
    const dt=tuning.dt;
    this.previous.copy(this.position);
    this.age+=dt;
    this.tick++;
    this.sample();
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
        this.position.y=support;
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
      if(this.position.y-support>.04&&this.velocity.dot(this.normal)>.15&&!impaired){
        this.phase="air";this.charge=0;
      }else this.position.y=support;
    }
  }
}
