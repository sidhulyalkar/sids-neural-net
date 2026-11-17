import assert from "node:assert/strict";
import test from "node:test";
import {Float32BufferAttribute,PlaneGeometry,Vector3} from "three/src/Three.Core.js";
import {SkiSimulation,SKI_SNOW_BASELINE,SKI_SNOW_EXPERIMENT,
 neutral,tuning} from "../lib/world/ski/simulation";
import {WORLD_BOUNDS as bounds,worldFloorHeight} from "../lib/world/model";
import {MOUNTAIN_HALFPIPE as pipe} from "../lib/world/mountainHalfpipe";
import {refineMountainSnow} from "../components/world/worldMountainHalfpipe";
import {renderedSnowHeight} from "../lib/world/ski/renderedSnow";
import {EarlyEdgeController} from "../app/dev/ski-lab/earlyEdge";
import {inside} from "../app/dev/ski-lab/fiveCarve";
import {SkiHalfpipeQualification} from "../lib/world/ski/halfpipeQualification";

const snapshot=(sim:SkiSimulation)=>[
 ...sim.position,...sim.velocity,...sim.rotation,...sim.load,
 ...sim.contact.map(Number),sim.edge,sim.grip,sim.tick,sim.phase
];

test("unflagged simulation and explicit snow baseline are bit-for-bit identical",()=>{
 const height=(x:number,z:number)=>.12*x-.08*z;
 const a=new SkiSimulation(height,7,-55,"independent");
 const b=new SkiSimulation(height,7,-55,"independent",false,undefined,
   {...SKI_SNOW_BASELINE});
 a.velocity.set(4.5,0,2.5);b.velocity.copy(a.velocity);
 for(let tick=0;tick<600;tick++){
  const input={...neutral,steer:Math.cos(tick/55),tuck:tick%100<50};
  a.advance(tuning.dt,()=>input);b.advance(tuning.dt,()=>input);
  assert.deepEqual(snapshot(a),snapshot(b),"physics drift at tick "+tick);
 }
});

test("invalid snow coefficient overrides fail closed",()=>{
 for(const bad of [
  {carveAlignment:-.1},{carveAlignment:1.1},{snowContactDrag:-.01},
  {snowContactDrag:.31},{engagedGrip:13},{contactForceScale:2.1},
  {maxTurn:4.1},{maxTurn:NaN}
 ]){
  assert.throws(()=>new SkiSimulation(()=>0,0,0,"independent",
    false,undefined,bad));
 }
});

test("edge-loaded snow resistance is dissipative on level ground",()=>{
 const baseline=new SkiSimulation(()=>0,0,0,"independent");
 const snow=new SkiSimulation(()=>0,0,0,"independent",
   false,undefined,SKI_SNOW_EXPERIMENT);
 baseline.velocity.set(4.5,0,2.5);snow.velocity.copy(baseline.velocity);
 for(let tick=0;tick<300;tick++){
  const input={...neutral,steer:tick%100<50?1:-1};
  const before=snow.velocity.length();
  snow.advance(tuning.dt,()=>input);
  baseline.advance(tuning.dt,()=>input);
  assert.ok(snow.velocity.length()<=before+1e-8,
    "snow must not add kinetic energy");
  assert.ok(snow.position.toArray().every(Number.isFinite));
 }
 assert.ok(snow.velocity.length()<baseline.velocity.length());
});

test("opt-in snow contact completes six real bank visits on triangulated island snow",()=>{
 const mesh=new PlaneGeometry(bounds.maxX-bounds.minX,
  bounds.maxZ-bounds.minZ,142,132);
 mesh.rotateX(-Math.PI/2);
 mesh.translate((bounds.minX+bounds.maxX)/2,0,
  (bounds.minZ+bounds.maxZ)/2);
 const pos=mesh.getAttribute("position");
 for(let i=0;i<pos.count;i++)
  pos.setY(i,worldFloorHeight(pos.getX(i),pos.getZ(i)));
 mesh.setAttribute("color",
  new Float32BufferAttribute(new Float32Array(pos.count*3),3));
 refineMountainSnow(mesh);
 const height=renderedSnowHeight(mesh,worldFloorHeight);
 const sim=new SkiSimulation(height,pipe.centerX,-60,
  "independent",false,undefined,SKI_SNOW_EXPERIMENT);
 sim.velocity.set(4.5,0,2.5);sim.setHeading(0,1);
 const controller=new EarlyEdgeController(1);
 const observed=new SkiHalfpipeQualification();
 const forward=new Vector3();
 let minSpeed=Infinity,airTicks=0;
 try{
  for(let tick=0;tick<1500;tick++){
   controller.input(sim);
   forward.set(0,0,1).applyQuaternion(sim.rotation);
   const goal=controller.steeringBank*1.5;
   const angle=Math.atan2(forward.x,forward.z);
   const difference=Math.atan2(Math.sin(goal-angle),Math.cos(goal-angle));
   const input={...neutral,steer:Math.max(-1,Math.min(1,2*difference))};
   sim.advance(tuning.dt,()=>input,s=>{
    observed.observe({tick:s.tick,x:s.position.x,z:s.position.z,
      vx:s.velocity.x,speed:Math.hypot(s.velocity.x,s.velocity.z),
      grounded:s.phase==="riding"&&s.contact.some(Boolean)});
   });
   controller.observe(sim);
   minSpeed=Math.min(minSpeed,Math.hypot(sim.velocity.x,sim.velocity.z));
   if(sim.phase==="air")airTicks++;
   if(observed.metrics.bankCrossings>=5)break;
   if(!inside(sim.position.x,sim.position.z))break;
  }
  assert.equal(observed.metrics.bankCrossings,5,
    "requires five grounded opposite-bank crossings with no synthetic counter");
  assert.equal(observed.metrics.leftVisits+observed.metrics.rightVisits,6);
  assert.equal(airTicks,0,"no artificial pop is allowed");
  assert.ok(minSpeed>1,
    "a successful traverse must not rely on nearly standing still");
 }finally{mesh.dispose();}
});
