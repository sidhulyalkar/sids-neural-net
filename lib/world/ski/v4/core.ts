/** Ski V4: deterministic ski/snow force prototype. World units and coefficients
 * are game-tuning parameters, not experimentally measured snow properties.
 * The renderer is NOT allowed to determine motion or invent ski contact.
 */
export type Vec2={x:number;z:number};
export type Vec3={x:number;y:number;z:number};
export type Surface=(x:number,z:number)=>number;
export type SnowCoverage=(x:number,z:number)=>number;
export type V4SurfaceMode="snow"|"mixed"|"ground"|"air";
export type SkiV4Phase="riding"|"charging"|"air"|"stumble"|"crash"|"recovery";
export type SkiV4Landing="none"|"clean"|"rough"|"crash";
export type SkiV4TurnRegime="glide"|"carve"|"transition"|"skid"|"unsupported"|"air"|"ground";
export type SkiV4Input={steer:number;brake:number;tuck:boolean;jump:boolean;pitch:number;roll:number;grab:boolean};
export const NEUTRAL_V4_INPUT:Readonly<SkiV4Input>={steer:0,brake:0,tuck:false,jump:false,pitch:0,roll:0,grab:false};
export const SKI_V4_TUNING=Object.freeze({
  revision:1,dt:1/120,gravity:9.81,sidecutRadius:2.7,maxEdge:0.82,edgeRise:4.4,
  maxSkiAttack:0.53,attackRise:5.6,carveMu:0.86,skidMu:0.62,
  skidVelocityScale:1.25,baseSnowResistance:0.28,airDrag:0.055,
  wedgeAngle:0.70,snowplowMu:2.35,brakeRise:2,brakeRelease:4,rollInertia:0.14,
  bootStance:0.23,skiHalfLength:1.275,skiHalfWidth:0.095,
  maxSoleFlex:0.16,contactTolerance:0.05,groundSpeed:3.4,
  groundResponse:5.8,groundYawRate:2.8,chargeMax:0.68,
  minPop:3.3,maxPop:5.5,airSpinRate:7.2,airFlipRate:4.6,
});
const clamp=(n:number,low:number,high:number)=>Math.min(high,Math.max(low,n));
const radians=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const mag=(v:Vec2)=>Math.hypot(v.x,v.z);
export type SkiV4Contact={
  side:-1|1;boot:Vec3;normal:Vec3;load:number;loaded:boolean;
  /** Geometry can support a boot on rock; only snowLoad supplies ski-edge force. */
  snowFraction:number;snowLoad:number;
  edgeAngle:number;contactFraction:number;contactStations:number;
  /** Contact on the actual cutting edge, not just the nearest ski-base corner. */
  edgeContactFraction:number;edgeContactStations:number;
  supportStart:number;supportEnd:number;minGap:number;meanGap:number;maxGap:number;
  maxBend:number; pitch:number;crossSlope:number;
  /** 17 stations, with actual snow-clearance and constrained ski deflection. */
  sections:{along:number;gap:number;flex:number;load:number}[];
};
export type SkiV4Telemetry={
  tick:number;speed:number;edgeRadians:number;attackRadians:number;carveAcceleration:number;
  skidDeceleration:number;gravityAcceleration:Vec2;leftLoad:number;rightLoad:number;
  snowResistance:number;powerToSnow:number;heading:number;phase:SkiV4Phase;
  /** True measured velocity-versus-ski angle, not an input request. */
  actualSlipRadians:number;carveQuality:number;contactCoverage:number;
  observedTurnRate:number;observedTurnRadius:number|null;turnRegime:SkiV4TurnRegime;
  surfaceMode:V4SurfaceMode;snowCoverage:number;
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
  const snow=sampleSnow(height,x,z),span=.44;
  const localPitch=(height(x+basis.f.x*span,z+basis.f.z*span)-
    height(x-basis.f.x*span,z-basis.f.z*span))/(2*span);
  const crossSlope=snow.dx*basis.r.x+snow.dz*basis.r.z;
  const rollSlope=crossSlope+Math.tan(clamp(edgeAngle,-1.15,1.15));
  // Cache exact snow heights once per ski/tick; fit multiple beam poses
  // without repeating expensive triangle lookups.
  const along=Array.from({length:17},(_,j)=>t.skiHalfLength*(j/8-1));
  const halfWidth=t.skiHalfWidth, width=[-halfWidth,0,halfWidth];
  const field=along.map(s=>width.map(w=>height(x+basis.f.x*s+basis.r.x*w,
    z+basis.f.z*s+basis.r.z*w)-snow.height));
  const flexWeight=(s:number)=>Math.min(1,Math.abs(s)/.18)*
    Math.min(1,Math.max(0,(t.skiHalfLength-Math.abs(s))/.34));
  let bestPitch=localPitch,bestLift=Infinity,bestCost=Infinity;
  const pitchStep=Math.max(.12,Math.abs(localPitch)*.14);
  // A ski may rotate about the boot before lifting the rider. Choose the
  // lowest nonpenetrating support with a cost for gratuitous pitch motion.
  for(let n=-7;n<=7;n++){
    const pitch=localPitch+n*pitchStep;
    let required=-Infinity;
    for(let j=0;j<=16;j++)for(let k=0;k<3;k++){
      const needed=field[j][k]-pitch*along[j]-rollSlope*width[k];
      required=Math.max(required,needed-t.maxSoleFlex*flexWeight(along[j]));
    }
    const lift=Math.max(0,required)+.008;
    const cost=lift*lift+.06*(pitch-localPitch)**2;
    if(cost<bestCost){bestCost=cost;bestLift=lift;bestPitch=pitch;}
  }
  let flex=along.map((s,j)=>{
    const needed=Math.max(...field[j].map((h,k)=>h-bestPitch*s-rollSlope*width[k]));
    return clamp(needed-bestLift,-t.maxSoleFlex,t.maxSoleFlex)*flexWeight(s);
  });
  // Constrain the entire physical sole envelope, including tips and both
  // edges. Do not truncate negative penetration to a reassuring metric.
  let correction=0;
  for(let j=0;j<=16;j++)for(let k=0;k<3;k++){
    const clearance=bestLift+bestPitch*along[j]+rollSlope*width[k]+flex[j]-field[j][k];
    correction=Math.max(correction,.008-clearance);
  }
  const lift=bestLift+Math.max(0,correction);
  const sections:SkiV4Contact["sections"]=[];
  let min=Infinity,max=-Infinity,sum=0,patches=0,edgePatches=0,maxBend=0;
  let supportStart=Infinity,supportEnd=-Infinity;
  for(let j=0;j<=16;j++){
    const s=along[j];
    const gaps=width.map((w,k)=>lift+bestPitch*s+rollSlope*w+flex[j]-field[j][k]);
    const closest=Math.min(...gaps);
    min=Math.min(min,closest);max=Math.max(max,...gaps);
    sum+=gaps.reduce((a,b)=>a+b,0)/3;
    maxBend=Math.max(maxBend,Math.abs(flex[j]));
    const active=Math.abs(s)<=.43&&closest<=t.contactTolerance;
    // Edge contact must not be inferred from the *opposite* ski-base edge
    // touching. On a cambered bank that would invent traction despite the
    // downhill cutting edge floating above the rendered snow.
    const cuttingEdgeIndex=Math.abs(edgeAngle)<.1?-1:rollSlope>=0?0:2;
    const edgeGap=cuttingEdgeIndex<0?closest:gaps[cuttingEdgeIndex];
    if(active&&edgeGap<=t.contactTolerance)edgePatches++;
    if(active){patches++;supportStart=Math.min(supportStart,s);supportEnd=Math.max(supportEnd,s);}
    sections.push({along:s,gap:closest,flex:flex[j],load:active?load:0});
  }
  const loaded=patches>0;
  return {side,boot:{x,y:snow.height+lift,z},normal:snow.normal,load:loaded?load:0,
    loaded,snowFraction:1,snowLoad:loaded?load:0,edgeAngle,
    contactFraction:patches/5,contactStations:patches,
    edgeContactFraction:edgePatches/5,edgeContactStations:edgePatches,
    supportStart:loaded?supportStart:0,supportEnd:loaded?supportEnd:0,
    minGap:min,meanGap:sum/17,maxGap:max,maxBend,pitch:bestPitch,crossSlope,sections};
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
  brakeEngagement=0;
  surfaceSnowCoverage=1;
  /** Player-controlled ski activity starts in a planted stance until first command. */
  awaitingStart=true;
  readonly telemetry:SkiV4Telemetry={tick:0,speed:0,edgeRadians:0,attackRadians:0,
    carveAcceleration:0,skidDeceleration:0,gravityAcceleration:{x:0,z:0},
    leftLoad:.5,rightLoad:.5,snowResistance:0,powerToSnow:0,heading:0,phase:"riding",
    actualSlipRadians:0,carveQuality:0,contactCoverage:1,
    observedTurnRate:0,observedTurnRadius:null,turnRegime:"glide",
    surfaceMode:"snow",snowCoverage:1};
  private heldJump=false;
  private phaseAge=0;
  private readonly initSurface:SnowSample;
  constructor(private readonly surface:Surface,x:number,z:number,
    private readonly constrain?:(from:Vec2,to:Vec2)=>Vec2,
    // Synthetic test slopes default to snow. The island always supplies the
    // real, triangle-interpolated snow attribute; unknown rendered snow is zero.
    private readonly groundSnowCoverage:SnowCoverage=()=>1){
    this.initSurface=sampleSnow(surface,x,z);
    this.position={x,y:this.initSurface.height,z};
    this.contact=[solveSkiContact(surface,{x,z},0,0,-1,.5),solveSkiContact(surface,{x,z},0,0,1,.5)];
    this.position.y=this.supportHeight(this.initSurface.height);
    this.velocity.y=0;
  }
  setHeading(x:number,z:number){if(Math.hypot(x,z)>.001)this.yaw=Math.atan2(x,z);}
  setHorizontalVelocity(x:number,z:number){
    this.velocity.x=x;this.velocity.z=z;
    if(Math.hypot(x,z)>.1)this.awaitingStart=false;
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
    // The *material* beneath each ski, including its loaded binding patch,
    // determines whether the edge may cut snow. Merely touching any height
    // field is not evidence of ski traction.
    const basis=frame(this.yaw);
    for(const contact of this.contact){
      // Only the physically engaged edge may claim snow material. A ski
      // straddling snow and rock must NOT carve on the rock-facing edge.
      const localEdge=Math.abs(contact.edgeAngle)<.1?0:
        contact.crossSlope+Math.tan(contact.edgeAngle)>=0?
          -SKI_V4_TUNING.skiHalfWidth:SKI_V4_TUNING.skiHalfWidth;
      let coverage=0;
      for(const s of [-.3,0,.3]){
        const x=contact.boot.x+basis.f.x*s+basis.r.x*localEdge;
        const z=contact.boot.z+basis.f.z*s+basis.r.z*localEdge;
        const v=this.groundSnowCoverage(x,z);
        coverage+=Number.isFinite(v)?clamp(v,0,1)/3:0;
      }
      contact.snowFraction=coverage;
      contact.snowLoad=contact.loaded?contact.load*coverage:0;
    }
    this.surfaceSnowCoverage=clamp(
      (this.contact[0].snowFraction+this.contact[1].snowFraction)*.5,0,1);
    const norm=this.contact[0].load+this.contact[1].load;
    this.pressure=norm;
    const covered=this.contact.reduce((sum,c)=>sum+c.snowLoad*c.edgeContactFraction,0);
    this.grip=covered*SKI_V4_TUNING.carveMu*Math.abs(Math.sin(this.edgeAngle));
  }
  private updateSurfaceTelemetry(){
    const coverage=this.surfaceSnowCoverage;
    this.telemetry.snowCoverage=coverage;
    this.telemetry.surfaceMode=coverage<.08?"ground":coverage>.92?"snow":"mixed";
  }
  private supportHeight(snowHeight:number){
    const supports=this.contact.filter(s=>s.loaded);
    if(supports.length===0)return snowHeight;
    const sum=supports.reduce((value,s)=>value+s.load,0);
    return Math.max(snowHeight,supports.reduce((value,s)=>value+s.boot.y*s.load,0)/sum-.008);
  }
  private step(input:SkiV4Input){
    const t=SKI_V4_TUNING,dt=t.dt;
    this.tick++;
    this.phaseAge+=dt;
    const steer=clamp(Number.isFinite(input.steer)?input.steer:0,-1,1);
    const brake=clamp(Number.isFinite(input.brake)?input.brake:0,0,1);
    // Weight transfer into a braking wedge takes time, and releasing the edge
    // is quicker. A high drag coefficient represents snow ploughing, not air drag.
    const snowBrake=brake*this.surfaceSnowCoverage;
    this.brakeEngagement+=clamp(snowBrake-this.brakeEngagement,
      -t.brakeRelease*dt,t.brakeRise*dt);
    const released=this.heldJump&&!input.jump;
    this.heldJump=Boolean(input.jump);
    // Only the explicit run-ready stance is held on an initially steep slope.
    // After first input, freely integrate real snow forces and gravity.
    if(this.awaitingStart&&this.phase==="riding"){
      if(Math.abs(steer)>.15||Math.abs(input.pitch)>.15||input.tuck||input.jump)
        this.awaitingStart=false;
      else{
        this.updateContacts(0);this.updateSurfaceTelemetry();
        this.velocity.x=0;this.velocity.y=0;this.velocity.z=0;
        this.position.y=this.supportHeight(this.surface(this.position.x,this.position.z));
        this.telemetry.tick=this.tick;this.telemetry.speed=0;
        this.telemetry.carveAcceleration=0;this.telemetry.skidDeceleration=0;
        this.telemetry.observedTurnRate=0;this.telemetry.observedTurnRadius=null;
        this.telemetry.actualSlipRadians=0;this.telemetry.carveQuality=0;
        this.telemetry.contactCoverage=this.pressure;
        this.telemetry.turnRegime=this.pressure>0?"glide":"unsupported";
        this.telemetry.phase=this.phase;
        return;
      }
    }
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
      this.telemetry.carveAcceleration=0;this.telemetry.skidDeceleration=0;
      this.telemetry.snowResistance=0;this.telemetry.powerToSnow=0;
      this.telemetry.carveQuality=0;this.telemetry.contactCoverage=0;
      this.telemetry.actualSlipRadians=0;this.telemetry.observedTurnRate=0;
      this.telemetry.observedTurnRadius=null;this.telemetry.turnRegime="air";
      this.telemetry.surfaceMode="air";this.telemetry.snowCoverage=0;
      this.telemetry.phase=this.phase;return;
    }
    const recovering=this.phase==="crash"||this.phase==="stumble"||this.phase==="recovery";
    if(recovering&&this.phaseAge>(this.phase==="crash"?1.1:.55)){
      this.phase=this.phase==="crash"?"recovery":"riding";this.phaseAge=0;
    }
    const impaired=this.phase==="crash"||this.phase==="stumble"||this.phase==="recovery";
    // Determine snow under BOTH bindings before requesting an edge. Leaving
    // snow gently retires the edge; physical snow forces are gated immediately.
    this.updateContacts(mag(this.velocity));
    this.updateSurfaceTelemetry();
    const snowBlend=this.surfaceSnowCoverage;
    const groundBlend=1-snowBlend;
    const targetEdge=impaired?0:steer*t.maxEdge*snowBlend;
    this.edgeAngle+=clamp(targetEdge-this.edgeAngle,-t.edgeRise*dt,t.edgeRise*dt);
    this.edge=this.edgeAngle/t.maxEdge;
    const speed=mag(this.velocity);
    const snow=sampleSnow(this.surface,this.position.x,this.position.z);
    this.updateContacts(speed);this.updateSurfaceTelemetry();
    // Reconcile contact under each boot. Do not use the highest tip/lip as a
    // fictitious support point for the entire skier.
    this.position.y=this.supportHeight(snow.height);
    const slopeNorm=1+snow.dx*snow.dx+snow.dz*snow.dz;
    const gx=-t.gravity*snow.dx/slopeNorm,gz=-t.gravity*snow.dz/slopeNorm;
    const normalAcceleration=t.gravity/Math.sqrt(slopeNorm);
    // Carve centripetal acceleration acts perpendicular to actual velocity:
    // it changes the path, never injects forward kinetic energy.
    const sinEdge=Math.sin(this.edgeAngle);
    const contactRatio=clamp(this.contact.reduce((n,c)=>n+c.snowLoad*c.edgeContactFraction,0),0,1);
    const requestedCarve=(speed*speed/t.sidecutRadius)*Math.abs(sinEdge);
    const maxCarve=normalAcceleration*t.carveMu*contactRatio;
    const carvedRequested=impaired?0:Math.sign(sinEdge)*Math.min(requestedCarve,maxCarve);
    const travelForward=speed>.08?{x:this.velocity.x/speed,z:this.velocity.z/speed}:frame(this.yaw).f;
    // Progressive boot attack at lower speeds, with real lateral shearing
    // rather than assigning velocity or setting a hard maximum speed.
    // Near-parallel skis carve at cruising speed. Boot pivot assists only
    // when moving slowly, otherwise even a held edge becomes a skidded turn.
    const pivotAttack=.025+.24*clamp((2.5-speed)/2.5,0,1);
    const targetAttack=impaired?0:steer*snowBlend*
      (pivotAttack+this.brakeEngagement*(t.maxSkiAttack-pivotAttack));
    this.attackAngle+=clamp(targetAttack-this.attackAngle,-t.attackRise*dt,t.attackRise*dt);
    // Ski yaw follows momentum but can be twisted relative to it by the boot;
    // this produces real shearing forces rather than teleporting velocity.
    const oldYaw=this.yaw;
    if(speed>.14&&snowBlend>.01){
      const targetYaw=Math.atan2(this.velocity.x,this.velocity.z)+this.attackAngle;
      this.yaw+=clamp(radians(targetYaw,this.yaw),-2.8*dt,2.8*dt)*snowBlend;
    }
    // On grass/rock this is ordinary avatar turning, not ski edging.
    this.yaw+=steer*t.groundYawRate*dt*groundBlend;
    this.yawRate=radians(this.yaw,oldYaw)/dt;
    const skiRight=frame(this.yaw).r;
    const lateralSlip=this.velocity.x*skiRight.x+this.velocity.z*skiRight.z;
    const skiForward=frame(this.yaw).f;
    const skiLongitudinal=this.velocity.x*skiForward.x+this.velocity.z*skiForward.z;
    const actualSlipRadians=Math.atan2(lateralSlip,Math.max(.1,Math.abs(skiLongitudinal)));
    // Carved lateral force is credible only with an edge aligned to travel.
    // A large velocity-relative attack angle transitions to snow cutting/skid.
    const carveQuality=clamp((.28-Math.abs(actualSlipRadians))/.22,0,1)*snowBlend;
    const carved=carvedRequested*carveQuality;
    const shearLimit=t.skidMu*normalAcceleration*contactRatio;
    const shear=clamp(-lateralSlip*t.skidVelocityScale,-shearLimit,shearLimit);
    const contactSpeed=speed>.08?speed:0;
    const wedge=t.wedgeAngle*this.brakeEngagement;
    // A wedge puts the two skis at opposing angles; their transverse shear
    // largely cancels, while the longitudinal work is strictly dissipative.
    const wedgeResistance=normalAcceleration*t.snowplowMu*contactRatio*
      Math.sin(wedge)**2*(1+0.3*Math.abs(steer));
    const snowResistance=contactSpeed>0?t.baseSnowResistance*contactRatio+wedgeResistance:0;
    const aerodynamic=t.airDrag*speed*speed*(input.tuck?.52:1);
    const resistance=impaired?2.3+snowResistance:snowResistance+aerodynamic;
    const before={x:this.velocity.x,z:this.velocity.z};
    // Exact centripetal rotation: the carved portion redirects momentum
    // without injecting forward kinetic energy through Euler integration.
    const carveStep=speed>.08?carved*dt/speed:0;
    const cosTurn=Math.cos(carveStep),sinTurn=Math.sin(carveStep);
    const rotatedX=before.x*cosTurn+before.z*sinTurn;
    const rotatedZ=before.z*cosTurn-before.x*sinTurn;
    // Bare ground uses deliberate W/S forward/back locomotion, with smooth
    // acceleration and deceleration, NOT an invisible ski-edge turn. Ground
    // grip is complementary to painted snow coverage through the transition.
    const groundDesired=clamp(input.pitch,-1,1)*t.groundSpeed;
    const groundHeading=frame(this.yaw).f;
    const groundX=groundHeading.x*groundDesired;
    const groundZ=groundHeading.z*groundDesired;
    const groundAx=(groundX-before.x)*t.groundResponse*groundBlend;
    const groundAz=(groundZ-before.z)*t.groundResponse*groundBlend;
    const forceX=gx*snowBlend+shear*skiRight.x-resistance*travelForward.x+groundAx;
    const forceZ=gz*snowBlend+shear*skiRight.z-resistance*travelForward.z+groundAz;
    this.velocity.x=rotatedX+forceX*dt;
    this.velocity.z=rotatedZ+forceZ*dt;
    // Opposing snow forces cannot carry velocity through zero and reverse it.
    const slopeFree={x:before.x+gx*dt,z:before.z+gz*dt};
    if(before.x*before.x+before.z*before.z>.00001&&
      this.velocity.x*before.x+this.velocity.z*before.z<-.000001&&
      slopeFree.x*before.x+slopeFree.z*before.z>=0){
      this.velocity.x=0;this.velocity.z=0;
    }
    this.reposition(this.velocity.x*dt,this.velocity.z*dt);
    const afterSnow=sampleSnow(this.surface,this.position.x,this.position.z);
    const supportBeforeMove=this.position.y;
    // Rendering and forces consume the same CURRENT boot patches. Never report
    // yesterday's ski contact after the skier has moved into another bank.
    this.updateContacts(mag(this.velocity));this.updateSurfaceTelemetry();
    this.position.y=this.supportHeight(afterSnow.height);
    this.velocity.y=(this.position.y-supportBeforeMove)/dt;
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
    // Shear is dissipative even without S braking: this is a skidded turn.
    const skidShearDecel=speed>.08?Math.max(0,-shear*lateralSlip)/speed:0;
    this.telemetry.carveAcceleration=carved;
    this.telemetry.skidDeceleration=wedgeResistance+skidShearDecel;
    this.telemetry.gravityAcceleration={x:gx,z:gz};
    this.telemetry.leftLoad=this.contact[0].load;this.telemetry.rightLoad=this.contact[1].load;
    // Distinguish snow friction from aerodynamic drag and crash damping.
    this.telemetry.snowResistance=snowResistance;
    this.telemetry.powerToSnow=Math.max(0,-shear*lateralSlip)+snowResistance*speed;
    const newSpeed=mag(this.velocity);
    const deltaHeading=Math.atan2(before.z*this.velocity.x-before.x*this.velocity.z,
      before.x*this.velocity.x+before.z*this.velocity.z);
    const observedTurnRate=speed>.3&&newSpeed>.3?deltaHeading/dt:0;
    const observedTurnRadius=Math.abs(observedTurnRate)>.001?
      newSpeed/Math.abs(observedTurnRate):null;
    this.telemetry.actualSlipRadians=actualSlipRadians;
    this.telemetry.carveQuality=carveQuality;
    this.telemetry.contactCoverage=contactRatio;
    this.telemetry.observedTurnRate=observedTurnRate;
    this.telemetry.observedTurnRadius=observedTurnRadius;
    this.telemetry.turnRegime=this.telemetry.surfaceMode==="ground"?"ground":
      contactRatio<.01?"unsupported":
      this.brakeEngagement>.25||Math.abs(actualSlipRadians)>.2?"skid":
      Math.abs(this.edgeAngle)>.13&&Math.abs(carved)>.1&&
      Math.abs(actualSlipRadians)<.10&&contactRatio>.45?"carve":
      Math.abs(this.edgeAngle)>.08?"transition":"glide";
    this.telemetry.heading=this.yaw;this.telemetry.phase=this.phase;
  }
}
