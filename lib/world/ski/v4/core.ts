/** Ski V4: deterministic ski/snow force prototype. World units and coefficients
 * are game-tuning parameters, not experimentally measured snow properties.
 * The renderer is NOT allowed to determine motion or invent ski contact.
 */
export type Vec2={x:number;z:number};
export type Vec3={x:number;y:number;z:number};
export type Surface=(x:number,z:number)=>number;
export type SkiV4Phase="riding"|"charging"|"air"|"stumble"|"crash"|"recovery";
export type SkiV4Landing="none"|"clean"|"rough"|"crash";
export type SkiV4Input={steer:number;brake:number;tuck:boolean;jump:boolean;pitch:number;roll:number;grab:boolean};
export const NEUTRAL_V4_INPUT:Readonly<SkiV4Input>={steer:0,brake:0,tuck:false,jump:false,pitch:0,roll:0,grab:false};
export const SKI_V4_TUNING=Object.freeze({
  revision:1,dt:1/120,gravity:9.81,sidecutRadius:7.5,maxEdge:0.82,edgeRise:4.4,
  maxSkiAttack:0.53,attackRise:5.6,carveMu:0.86,skidMu:0.62,
  skidVelocityScale:1.15,baseSnowResistance:0.18,airDrag:0.008,
  wedgeAngle:0.70,snowplowMu:0.72,rollInertia:0.14,
  bootStance:0.23,skiHalfLength:1.275,skiHalfWidth:0.095,
  maxSoleFlex:0.16,contactTolerance:0.05,chargeMax:0.68,
  minPop:3.3,maxPop:5.5,airSpinRate:7.2,airFlipRate:4.6,
});
const clamp=(n:number,low:number,high:number)=>Math.min(high,Math.max(low,n));
const radians=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const mag=(v:Vec2)=>Math.hypot(v.x,v.z);
export type SkiV4Contact={
  side:-1|1;boot:Vec3;normal:Vec3;load:number;loaded:boolean;
  edgeAngle:number;contactFraction:number;contactStations:number;
  supportStart:number;supportEnd:number;minGap:number;meanGap:number;maxGap:number;
  maxBend:number; pitch:number;crossSlope:number;
  /** 17 stations, with actual snow-clearance and constrained ski deflection. */
  sections:{along:number;gap:number;flex:number;load:number}[];
};
export type SkiV4Telemetry={
  tick:number;speed:number;edgeRadians:number;attackRadians:number;carveAcceleration:number;
  skidDeceleration:number;gravityAcceleration:Vec2;leftLoad:number;rightLoad:number;
  snowResistance:number;powerToSnow:number;heading:number;phase:SkiV4Phase;
};
export type SnowSample={height:number;dx:number;dz:number;normal:Vec3};

/** Central-difference slope from the SAME triangle-exact heightfield as the
 * island mesh. Sampling only in this utility keeps callers deterministic. */
export function sampleSnow(height:Surface,x:number,z:number):SnowSample{
  const epsilon=.09;
  const dx=(height(x+epsilon,z)-height(x-epsilon,z))/(2*epsilon);
  const dz=(height(x,z+epsilon)-height(x,z-epsilon))/(2*epsilon);
  const denom=Math.hypot(dx,1,dz);
  return {height:height(x,z),dx,dz,normal:{x:-dx/denom,y:1/denom,z:-dz/denom}};
}
function frame(yaw:number){return {f:{x:Math.sin(yaw),z:Math.cos(yaw)},r:{x:Math.cos(yaw),z:-Math.sin(yaw)}};}
const solveLoad=(signedEdge:number,speed:number)=>clamp(.5+.29*clamp(signedEdge,-1,1)*speed/(speed+2.5),.2,.8);

/** A contact model centered at each binding, using the real rendered surface.
 * A ski's extreme tip cannot become the only supported contact patch: the
 * loaded patch is limited to stations close to the boot. Beyond that, a
 * tip/tail can explicitly bridge or overhang without inventing support.
 * Finite bending is *also* reported to the renderer, not independently faked.
 */
export function solveSkiContact(height:Surface,point:Vec2,yaw:number,
  edgeAngle:number,side:-1|1,load:number):SkiV4Contact{
  const t=SKI_V4_TUNING,basis=frame(yaw),x=point.x+side*t.bootStance*basis.r.x,
    z=point.z+side*t.bootStance*basis.r.z;
  const terrain=sampleSnow(height,x,z),half=.44;
  const pitch=(height(x+basis.f.x*half,z+basis.f.z*half)-height(x-basis.f.x*half,z-basis.f.z*half))/(2*half);
  const crossSlope=terrain.dx*basis.r.x+terrain.dz*basis.r.z;
  const sections:SkiV4Contact["sections"]=[];
  let nearBootMax=-Infinity;
  for(let j=0;j<=16;j++){
    const along=(j/8-1)*t.skiHalfLength;
    if(Math.abs(along)>.43)continue;
    const sx=x+basis.f.x*along,sz=z+basis.f.z*along;
    for(const w of [-t.skiHalfWidth,0,t.skiHalfWidth]){
      const px=sx+basis.r.x*w,pz=sz+basis.r.z*w;
      const need=height(px,pz)-(terrain.height+along*pitch+w*(crossSlope+Math.tan(edgeAngle)));
      nearBootMax=Math.max(need,nearBootMax);
    }
  }
  // Constraint is evaluated at the loaded binding patch rather than the tip.
  // Deflection subsequently resolves smaller surrounding penetration and
  // reports any unsupported severe ridge rather than translating the athlete.
  const heave=Math.max(0,nearBootMax)+.008;
  const rollSlope=Math.tan(clamp(edgeAngle,-1.15,1.15));
  let min=Infinity,max=-Infinity,sum=0,patches=0,maxBend=0;
  let supportStart=Infinity,supportEnd=-Infinity;
  for(let j=0;j<=16;j++){
    const along=(j/8-1)*t.skiHalfLength;
    const sx=x+basis.f.x*along,sz=z+basis.f.z*along;
    let needed=-Infinity;
    for(const w of [-t.skiHalfWidth,0,t.skiHalfWidth]){
      const px=sx+basis.r.x*w,pz=sz+basis.r.z*w;
      needed=Math.max(needed,height(px,pz)-(terrain.height+heave+along*pitch+w*(crossSlope+rollSlope)));
    }
    // The binding must never flex away from the boot; exposed tips can bend
    // only in a physically limited range. Favor smooth center-dominant flex.
    const supportWeight=Math.min(1,Math.max(0,(t.skiHalfLength-Math.abs(along))/.34));
    const bindingWeight=Math.min(1,Math.abs(along)/.19);
    const flex=clamp(needed,-t.maxSoleFlex,t.maxSoleFlex)*supportWeight*bindingWeight;
    maxBend=Math.max(maxBend,Math.abs(flex));
    const gap=Math.max(-.15,-needed+flex);
    min=Math.min(min,gap);max=Math.max(max,gap);sum+=gap;
    const inBoot=Math.abs(along)<=.43;
    const active=inBoot&&Math.abs(gap)<=t.contactTolerance;
    if(active){patches++;supportStart=Math.min(supportStart,along);supportEnd=Math.max(supportEnd,along);}
    sections.push({along,gap,flex,load:active?load:0});
  }
  const loaded=patches>=1;
  return {side,boot:{x,y:terrain.height+heave,z},normal:terrain.normal,load:loaded?load:0,
    loaded,edgeAngle,contactFraction:patches/5,contactStations:patches,
    supportStart:loaded?supportStart:0,supportEnd:loaded?supportEnd:0,
    minGap:min,meanGap:sum/17,maxGap:max,maxBend,pitch,crossSlope,sections};
}
export class SkiV4Physics{
  position:Vec3;
  velocity:Vec3={x:0,y:0,z:0};
  yaw=0;
  yawRate=0;
  edgeAngle=0;
  attackAngle=0;
  readonly contact:[SkiV4Contact,SkiV4Contact];
  phase:SkiV4Phase="riding";
  landing:SkiV4Landing="none";
  charge=0;grab=false;airSpinRadians=0;airPitchRadians=0;airRollRadians=0;
  airYawRate=0;airPitchRate=0;airRollRate=0;
  tick=0;remainder=0;droppedSeconds=0;
  edge=0;pressure=0;grip=0;
  readonly telemetry:SkiV4Telemetry={tick:0,speed:0,edgeRadians:0,attackRadians:0,
    carveAcceleration:0,skidDeceleration:0,gravityAcceleration:{x:0,z:0},
    leftLoad:.5,rightLoad:.5,snowResistance:0,powerToSnow:0,heading:0,phase:"riding"};
  private heldJump=false;
  private phaseAge=0;
  private readonly initSurface:SnowSample;
  constructor(private readonly surface:Surface,x:number,z:number,
    private readonly constrain?:(from:Vec2,to:Vec2)=>Vec2){
    this.initSurface=sampleSnow(surface,x,z);
    this.position={x,y:this.initSurface.height,z};
    this.contact=[solveSkiContact(surface,{x,z},0,0,-1,.5),solveSkiContact(surface,{x,z},0,0,1,.5)];
    this.velocity.y=0;
  }
  setHeading(x:number,z:number){if(Math.hypot(x,z)>.001)this.yaw=Math.atan2(x,z);}
  setHorizontalVelocity(x:number,z:number){
    this.velocity.x=x;this.velocity.z=z;
    const h=sampleSnow(this.surface,this.position.x,this.position.z);
    this.velocity.y=h.dx*x+h.dz*z;
  }
  advance(seconds:number,inputAt:(tick:number)=>SkiV4Input,
    afterStep?:(sim:SkiV4Physics,input:SkiV4Input)=>void){
    if(!Number.isFinite(seconds)||seconds<=0)return;
    this.droppedSeconds+=Math.max(0,seconds-.25);
    this.remainder+=Math.min(seconds,.25);
    while(this.remainder+1e-12>=SKI_V4_TUNING.dt){
      const input=inputAt(this.tick);this.step(input);
      this.remainder=Math.max(0,this.remainder-SKI_V4_TUNING.dt);
      afterStep?.(this,input);
    }
  }
  private reposition(dx:number,dz:number){
    const x0=this.position.x,z0=this.position.z;
    const wanted={x:x0+dx,z:z0+dz};
    const p=this.constrain?this.constrain({x:x0,z:z0},wanted):wanted;
    this.position.x=p.x;this.position.z=p.z;
    // Obstacles remove velocity into their normal instead of accumulating
    // unbounded speed while a player is standing against a mountain prop.
    const blockX=wanted.x-p.x,blockZ=wanted.z-p.z;
    const blocked=blockX*blockX+blockZ*blockZ;
    if(blocked>1e-10){
      const into=Math.max(0,(this.velocity.x*blockX+this.velocity.z*blockZ)/blocked);
      this.velocity.x-=into*blockX;this.velocity.z-=into*blockZ;
    }
  }
  private updateContacts(speed:number){
    const loadLeft=solveLoad(this.edgeAngle/SKI_V4_TUNING.maxEdge,speed);
    const point={x:this.position.x,z:this.position.z};
    this.contact[0]=solveSkiContact(this.surface,point,this.yaw,this.edgeAngle,-1,loadLeft);
    this.contact[1]=solveSkiContact(this.surface,point,this.yaw,this.edgeAngle,1,1-loadLeft);
    const norm=this.contact[0].load+this.contact[1].load;
    this.pressure=norm;
    this.grip=norm*SKI_V4_TUNING.carveMu*Math.abs(Math.sin(this.edgeAngle));
  }
  private step(input:SkiV4Input){
    const t=SKI_V4_TUNING,dt=t.dt;
    this.tick++;
    this.phaseAge+=dt;
    const steer=clamp(Number.isFinite(input.steer)?input.steer:0,-1,1);
    const brake=clamp(Number.isFinite(input.brake)?input.brake:0,0,1);
    const released=this.heldJump&&!input.jump;
    this.heldJump=Boolean(input.jump);
    if(this.phase==="air"){
      // Aerial rotation remains input-driven and is dynamically independent
      // of ski-snow forces. Preserve takeoff horizontal momentum.
      const spin=steer*t.airSpinRate;
      this.airYawRate=spin;this.airPitchRate=clamp(input.pitch,-1,1)*t.airFlipRate;
      this.airRollRate=clamp(input.roll,-1,1)*t.airFlipRate;
      this.grab=Boolean(input.grab);
      this.airPitchRadians+=this.airPitchRate*dt;
      this.airRollRadians+=this.airRollRate*dt;
      this.airSpinRadians+=spin*dt;
      this.yaw+=spin*dt;
      this.velocity.y-=t.gravity*dt;
      this.reposition(this.velocity.x*dt,this.velocity.z*dt);
      this.position.y+=this.velocity.y*dt;
      const snow=this.surface(this.position.x,this.position.z);
      if(this.position.y<=snow&&this.velocity.y<=0){
        const speed=mag(this.velocity);
        const forward=frame(this.yaw).f;
        const align=speed>.25?Math.abs((this.velocity.x*forward.x+this.velocity.z*forward.z)/speed):1;
        const impact=-this.velocity.y;
        const upright=Math.cos(this.airPitchRadians)*Math.cos(this.airRollRadians);
        this.landing=impact>9||align<.45||upright<.45?"crash":impact>6.8||align<.74||upright<.8?"rough":"clean";
        this.phase=this.landing==="crash"?"crash":this.landing==="rough"?"stumble":"riding";
        this.phaseAge=0;this.position.y=snow;
        this.airPitchRadians=0;this.airRollRadians=0;this.grab=false;
        this.airYawRate=this.airPitchRate=this.airRollRate=0;
        const sample=sampleSnow(this.surface,this.position.x,this.position.z);
        this.velocity.y=sample.dx*this.velocity.x+sample.dz*this.velocity.z;
      }
      this.telemetry.tick=this.tick;this.telemetry.speed=mag(this.velocity);
      this.telemetry.phase=this.phase;return;
    }
    const recovering=this.phase==="crash"||this.phase==="stumble"||this.phase==="recovery";
    if(recovering&&this.phaseAge>(this.phase==="crash"?1.1:.55)){
      this.phase=this.phase==="crash"?"recovery":"riding";this.phaseAge=0;
    }
    const impaired=this.phase==="crash"||this.phase==="stumble"||this.phase==="recovery";
    const targetEdge=impaired?0:steer*t.maxEdge;
    this.edgeAngle+=clamp(targetEdge-this.edgeAngle,-t.edgeRise*dt,t.edgeRise*dt);
    this.edge=this.edgeAngle/t.maxEdge;
    const speed=mag(this.velocity);
    const snow=sampleSnow(this.surface,this.position.x,this.position.z);
    this.updateContacts(speed);
    // Reconcile contact under each boot. Do not use the highest tip/lip as a
    // fictitious support point for the entire skier.
    const supporting=this.contact.filter(x=>x.loaded);
    const support=supporting.length?supporting.reduce((a,b)=>a+b.boot.y*b.load,0)/
      supporting.reduce((a,b)=>a+b.load,0):snow.height;
    this.position.y=Math.max(snow.height,support-.008);
    const slopeNorm=1+snow.dx*snow.dx+snow.dz*snow.dz;
    const gx=-t.gravity*snow.dx/slopeNorm,gz=-t.gravity*snow.dz/slopeNorm;
    const normalAcceleration=t.gravity/Math.sqrt(slopeNorm);
    // Carve centripetal acceleration acts perpendicular to actual velocity:
    // it changes the path, never injects forward kinetic energy.
    const sinEdge=Math.sin(this.edgeAngle);
    const contactRatio=clamp(this.pressure,0,1);
    const requestedCarve=(speed*speed/t.sidecutRadius)*Math.abs(sinEdge);
    const maxCarve=normalAcceleration*t.carveMu*contactRatio;
    const carved=impaired?0:Math.sign(sinEdge)*Math.min(requestedCarve,maxCarve);
    const travelForward=speed>.08?{x:this.velocity.x/speed,z:this.velocity.z/speed}:frame(this.yaw).f;
    const perpendicular={x:travelForward.z,z:-travelForward.x};
    const targetAttack=impaired?0:steer*(.045+brake*(t.maxSkiAttack-.045));
    this.attackAngle+=clamp(targetAttack-this.attackAngle,-t.attackRise*dt,t.attackRise*dt);
    // Ski yaw follows momentum but can be twisted relative to it by the boot;
    // this produces real shearing forces rather than teleporting velocity.
    const oldYaw=this.yaw;
    if(speed>.14){
      const targetYaw=Math.atan2(this.velocity.x,this.velocity.z)+this.attackAngle;
      this.yaw+=clamp(radians(targetYaw,this.yaw),-2.8*dt,2.8*dt);
    }
    this.yawRate=radians(this.yaw,oldYaw)/dt;
    const skiRight=frame(this.yaw).r;
    const lateralSlip=this.velocity.x*skiRight.x+this.velocity.z*skiRight.z;
    const shearLimit=t.skidMu*normalAcceleration*contactRatio;
    const shear=clamp(-lateralSlip*t.skidVelocityScale,-shearLimit,shearLimit);
    const contactSpeed=speed>.08?speed:0;
    const wedge=t.wedgeAngle*brake;
    // A wedge puts the two skis at opposing angles; their transverse shear
    // largely cancels, while the longitudinal work is strictly dissipative.
    const wedgeResistance=normalAcceleration*t.snowplowMu*contactRatio*
      Math.sin(wedge)**2*(1+0.3*Math.abs(steer));
    const snowResistance=contactSpeed>0?t.baseSnowResistance+wedgeResistance:0;
    const aerodynamic=t.airDrag*speed*speed*(input.tuck?.52:1);
    const resistance=impaired?2.3+snowResistance:snowResistance+aerodynamic;
    const forceX=gx+carved*perpendicular.x+shear*skiRight.x-resistance*travelForward.x;
    const forceZ=gz+carved*perpendicular.z+shear*skiRight.z-resistance*travelForward.z;
    const before={x:this.velocity.x,z:this.velocity.z};
    this.velocity.x+=forceX*dt;
    this.velocity.z+=forceZ*dt;
    // Opposing snow forces cannot carry velocity through zero and reverse it.
    const slopeFree={x:before.x+gx*dt,z:before.z+gz*dt};
    if(before.x*before.x+before.z*before.z>.00001&&
      this.velocity.x*before.x+this.velocity.z*before.z<-.000001&&
      slopeFree.x*before.x+slopeFree.z*before.z>=0){
      this.velocity.x=0;this.velocity.z=0;
    }
    this.reposition(this.velocity.x*dt,this.velocity.z*dt);
    const afterSnow=sampleSnow(this.surface,this.position.x,this.position.z);
    this.position.y=afterSnow.height;
    this.velocity.y=afterSnow.dx*this.velocity.x+afterSnow.dz*this.velocity.z;
    if(!impaired&&input.jump){
      this.phase="charging";
      this.charge=Math.min(t.chargeMax,this.charge+dt);
    }
    if(released&&this.phase==="charging"){
      this.phase="air";this.phaseAge=0;
      const ratio=this.charge/t.chargeMax;
      this.velocity.y+=t.minPop+(t.maxPop-t.minPop)*ratio;
      this.position.y+=.009;
      this.airSpinRadians=0;this.airPitchRadians=0;this.airRollRadians=0;
      this.airYawRate=this.airPitchRate=this.airRollRate=0;
      this.charge=0;this.landing="none";
    }
    this.telemetry.tick=this.tick;this.telemetry.speed=mag(this.velocity);
    this.telemetry.edgeRadians=this.edgeAngle;this.telemetry.attackRadians=this.attackAngle;
    this.telemetry.carveAcceleration=carved;this.telemetry.skidDeceleration=wedgeResistance;
    this.telemetry.gravityAcceleration={x:gx,z:gz};
    this.telemetry.leftLoad=this.contact[0].load;this.telemetry.rightLoad=this.contact[1].load;
    this.telemetry.snowResistance=resistance;
    this.telemetry.powerToSnow=Math.max(0,-shear*lateralSlip)+resistance*speed;
    this.telemetry.heading=this.yaw;this.telemetry.phase=this.phase;
  }
}
