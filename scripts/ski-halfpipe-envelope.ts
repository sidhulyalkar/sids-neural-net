import {mkdirSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import {Float32BufferAttribute,PlaneGeometry,Vector3} from "three/src/Three.Core.js";
import {WORLD_BOUNDS as bounds,worldFloorHeight} from "../lib/world/model";
import {MOUNTAIN_HALFPIPE as pipe} from "../lib/world/mountainHalfpipe";
import {refineMountainSnow} from "../components/world/worldMountainHalfpipe";
import {renderedSnowHeight} from "../lib/world/ski/renderedSnow";
import {SkiSimulation,neutral,tuning} from "../lib/world/ski/simulation";
import {SkiHalfpipeQualification} from "../lib/world/ski/halfpipeQualification";
import {EarlyEdgeController} from "../app/dev/ski-lab/earlyEdge";
import {inside} from "../app/dev/ski-lab/fiveCarve";

type Config={lead:number;targetYaw:number;startZ:number;initialVx:number};
const out=process.env.SKI_ENVELOPE_DIR??"artifacts/ski-halfpipe-envelope";
mkdirSync(out,{recursive:true});

// Compare controller inputs on the *same* triangle mesh the island renders,
// not an analytic pipe surface that can disagree between vertices.
const geometry=new PlaneGeometry(bounds.maxX-bounds.minX,
  bounds.maxZ-bounds.minZ,142,132);
geometry.rotateX(-Math.PI/2);
geometry.translate((bounds.minX+bounds.maxX)/2,0,
  (bounds.minZ+bounds.maxZ)/2);
const positions=geometry.getAttribute("position");
for(let i=0;i<positions.count;i++)
  positions.setY(i,worldFloorHeight(positions.getX(i),positions.getZ(i)));
geometry.setAttribute("color",
  new Float32BufferAttribute(new Float32Array(positions.count*3),3));
refineMountainSnow(geometry);
const height=renderedSnowHeight(geometry,worldFloorHeight);
const heading=new Vector3(0,0,1);
const configs:Config[]=[];
for(const startZ of [-58,-56])
  for(const initialVx of [4.5,6])
    for(const lead of [1,1.75,2.5])
      for(const targetYaw of [1.2,1.5])
        configs.push({startZ,initialVx,lead,targetYaw});

function run(c:Config){
  const sim=new SkiSimulation(height,pipe.centerX,c.startZ,"independent");
  sim.velocity.set(c.initialVx,0,3.5);
  sim.setHeading(0,1);
  const controller=new EarlyEdgeController(c.lead);
  const qualification=new SkiHalfpipeQualification();
  const sampled:string[]=[];
  let maxSpeed=0,maxLateralSpeed=0,airTicks=0,firstBankTick=-1,
    minBankSpeed=Infinity;
  let exit="time-limit";
  for(let step=0;step<1500;step++){
    // Steering target is bounded; no position, force, collision, jump or
    // camera overrides after initialization. These are *not* autopilot inputs
    // used in the production world.
    controller.input(sim);
    heading.set(0,0,1).applyQuaternion(sim.rotation);
    const angle=Math.atan2(heading.x,heading.z);
    const goal=controller.steeringBank*c.targetYaw;
    const error=Math.atan2(Math.sin(goal-angle),Math.cos(goal-angle));
    const input={...neutral,steer:Math.max(-1,Math.min(1,2*error))};
    sim.advance(tuning.dt,()=>input,s=>{
      const speed=Math.hypot(s.velocity.x,s.velocity.z);
      qualification.observe({tick:s.tick,x:s.position.x,z:s.position.z,
        vx:s.velocity.x,speed,
        grounded:s.phase==="riding"&&s.contact.some(Boolean)});
    });
    controller.observe(sim);
    const speed=Math.hypot(sim.velocity.x,sim.velocity.z);
    maxSpeed=Math.max(maxSpeed,speed);
    maxLateralSpeed=Math.max(maxLateralSpeed,Math.abs(sim.velocity.x));
    if(sim.phase==="air")airTicks++;
    if(qualification.metrics.leftVisits+qualification.metrics.rightVisits>0){
      if(firstBankTick<0)firstBankTick=sim.tick;
      minBankSpeed=Math.min(minBankSpeed,speed);
    }
    if(sim.tick%10===0)sampled.push([
      sim.tick,sim.position.x,sim.position.y,sim.position.z,
      sim.velocity.x,sim.velocity.y,sim.velocity.z,speed,
      sim.edge,sim.grip,input.steer,sim.phase,
      Number(sim.contact[0]),Number(sim.contact[1]),
      qualification.metrics.bankCrossings
    ].join(","));
    if(qualification.metrics.bankCrossings>=5){exit="five-traversals";break;}
    if(!inside(sim.position.x,sim.position.z)){exit="footprint";break;}
  }
  const m=qualification.metrics;
  return {...c,visits:m.leftVisits+m.rightVisits,
    left:m.leftVisits,right:m.rightVisits,traversals:m.bankCrossings,
    reversals:m.lateralReversals,controllerVisits:controller.visits,
    ticks:sim.tick,exit,finalX:sim.position.x,finalZ:sim.position.z,
    airTicks,firstBankTick,
    minBankSpeed:Number.isFinite(minBankSpeed)?minBankSpeed:null,
    maxSpeed,maxLateralSpeed,
    qualified:m.bankCrossings>=5&&exit==="five-traversals"&&airTicks===0,
    sampled};
}
const results=configs.map(run);
const ordered=results.slice().sort((a,b)=>
  b.traversals-a.traversals||b.visits-a.visits||
  b.finalZ-a.finalZ||a.airTicks-b.airTicks);
const header="tick,x,y,z,vx,vy,vz,speed,edge,grip,steer,phase,leftContact,rightContact,bankCrossings";
ordered.slice(0,3).forEach((r,i)=>{
  writeFileSync(join(out,`rank-${i+1}-trace.csv`),
    [header,...r.sampled].join("\n")+"\n");
});
const summary=results.map(({sampled,...r})=>r);
writeFileSync(join(out,"summary.json"),JSON.stringify({
  schema:"iland-ski-halfpipe-rendered-mesh-envelope-v1",
  inputModel:"bounded heading-target early reversal, NOT enabled in gameplay",
  source:"full-world rendered snow triangles",
  fixedStepHz:1/tuning.dt,
  criteria:"five observed physical alternate bank crossings, no air ticks",
  qualifiedCount:summary.filter(r=>r.qualified).length,
  results:summary
},null,2)+"\n");
console.table(ordered.slice(0,12).map(r=>({
  lead:r.lead,yaw:r.targetYaw,startZ:r.startZ,vx:r.initialVx,
  crossings:r.traversals,visits:r.visits,exit:r.exit,
  ticks:r.ticks,air:r.airTicks,bankSpeed:r.minBankSpeed?.toFixed(2)??"n/a"
})));
console.log("QUALIFIED:",summary.filter(r=>r.qualified).length,"/",summary.length);
geometry.dispose();
