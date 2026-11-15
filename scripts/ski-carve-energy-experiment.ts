import {mkdirSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import {Float32BufferAttribute,PlaneGeometry,Vector3} from "three/src/Three.Core.js";
import {WORLD_BOUNDS as b,worldFloorHeight} from "../lib/world/model";
import {MOUNTAIN_HALFPIPE as pipe} from "../lib/world/mountainHalfpipe";
import {refineMountainSnow} from "../components/world/worldMountainHalfpipe";
import {renderedSnowHeight} from "../lib/world/ski/renderedSnow";
import {SkiSimulation,SKI_CARVE_BASELINE,neutral,tuning,type SkiCarveSettings}
  from "../lib/world/ski/simulation";
import {SkiHalfpipeQualification} from "../lib/world/ski/halfpipeQualification";
import {EarlyEdgeController} from "../app/dev/ski-lab/earlyEdge";
import {inside} from "../app/dev/ski-lab/fiveCarve";

const out=process.env.SKI_CARVE_AUDIT_DIR??"artifacts/ski-carve-energy";
mkdirSync(out,{recursive:true});
const geom=new PlaneGeometry(b.maxX-b.minX,b.maxZ-b.minZ,142,132);
geom.rotateX(-Math.PI/2);
geom.translate((b.minX+b.maxX)/2,0,(b.minZ+b.maxZ)/2);
const p=geom.getAttribute("position");
for(let i=0;i<p.count;i++)
  p.setY(i,worldFloorHeight(p.getX(i),p.getZ(i)));
geom.setAttribute("color",
  new Float32BufferAttribute(new Float32Array(p.count*3),3));
refineMountainSnow(geom);
const height=renderedSnowHeight(geom,worldFloorHeight);
const view=new Vector3(0,0,1);
type Variant={id:string;settings:Partial<SkiCarveSettings>;startZ:number;initialVx:number};
const variants:Variant[]=[];
for(const startZ of [-58,-56]){
 for(const initialVx of [4.5,6]){
  variants.push({id:"baseline",settings:{},startZ,initialVx});
  for(const maxTurn of [2.6,3,3.4]){
   for(const contactForceScale of [1,1.25,1.5]){
    for(const engagedGrip of [6,9]){
     variants.push({id:"bounded-grid",settings:{maxTurn,contactForceScale,
       engagedGrip,edgeResponse:5},startZ,initialVx});
    }
   }
  }
 }
}
function run(v:Variant){
 const sim=new SkiSimulation(height,pipe.centerX,v.startZ,"independent",
   false,undefined,v.settings);
 sim.velocity.set(v.initialVx,0,3.5);
 sim.setHeading(0,1);
 const ctl=new EarlyEdgeController(1);
 const banks=new SkiHalfpipeQualification();
 const trace:string[]=[];
 let airTicks=0,minSpeed=Infinity,maxSpeed=0,
   slipIntegral=0,edgeIntegral=0,progressAtFirstBank:null|number=null;
 let exit="tick-limit";
 for(let step=0;step<1500;step++){
  ctl.input(sim);view.set(0,0,1).applyQuaternion(sim.rotation);
  const target=ctl.steeringBank*1.2;
  const error=Math.atan2(
   Math.sin(target-Math.atan2(view.x,view.z)),
   Math.cos(target-Math.atan2(view.x,view.z)));
  const input={...neutral,steer:Math.max(-1,Math.min(1,2*error))};
  sim.advance(tuning.dt,()=>input,s=>{
   const speed=Math.hypot(s.velocity.x,s.velocity.z);
   banks.observe({tick:s.tick,x:s.position.x,z:s.position.z,
     vx:s.velocity.x,speed,
     grounded:s.phase==="riding"&&s.contact.some(Boolean)});
  });
  ctl.observe(sim);
  if(sim.phase==="air")airTicks++;
  const horizontal=Math.hypot(sim.velocity.x,sim.velocity.z);
  minSpeed=Math.min(minSpeed,horizontal);
  maxSpeed=Math.max(maxSpeed,horizontal);
  view.set(1,0,0).applyQuaternion(sim.rotation);
  slipIntegral+=Math.abs(sim.velocity.dot(view))*tuning.dt;
  edgeIntegral+=Math.abs(sim.edge)*tuning.dt;
  if(banks.metrics.leftVisits+banks.metrics.rightVisits && progressAtFirstBank===null)
   progressAtFirstBank=sim.position.z-v.startZ;
  if(sim.tick%12===0)
    trace.push([sim.tick,sim.position.x,sim.position.z,
      sim.velocity.x,sim.velocity.z,horizontal,
      sim.edge,sim.grip,input.steer,
      banks.metrics.bankCrossings,sim.phase].join(","));
  if(banks.metrics.bankCrossings>=5){exit="five-crossings";break;}
  if(!inside(sim.position.x,sim.position.z)){exit="footprint";break;}
 }
 const m=banks.metrics;
 return {...v,settings:{...SKI_CARVE_BASELINE,...v.settings},
   crossings:m.bankCrossings,visits:m.leftVisits+m.rightVisits,
   left:m.leftVisits,right:m.rightVisits,reversals:m.lateralReversals,
   ticks:sim.tick,endX:sim.position.x,endZ:sim.position.z,
   exit,airTicks,minSpeed,maxSpeed,slipIntegral,edgeIntegral,
   progressAtFirstBank,trace,
   qualified:m.bankCrossings>=5&&airTicks===0&&exit==="five-crossings"};
}
const trials=variants.map(run);
const ranked=trials.slice().sort((a,b)=>
 b.crossings-a.crossings||b.visits-a.visits||
 b.endZ-a.endZ||a.airTicks-b.airTicks);
const header="tick,x,z,vx,vz,speed,edge,grip,steer,crossings,phase";
ranked.slice(0,5).forEach((r,i)=>writeFileSync(join(out,"rank-"+(i+1)+".csv"),
 [header,...r.trace].join("\n")+"\n"));
const summary=trials.map(({trace,...v})=>v);
writeFileSync(join(out,"summary.json"),JSON.stringify({
 schema:"iland-ski-carve-energy-ab-v1",
 exactGeometry:"refined rendered triangular island surface",
 baseline:SKI_CARVE_BASELINE,dt:tuning.dt,
 comparison:"same input controller, initial conditions and geometry; vary only bounded solver coefficients",
 note:"DIAGNOSTIC ONLY: no autoplay, automatic pop or shipping tuning without real browser qualification",
 qualifiedCount:summary.filter(r=>r.qualified).length,
 baselineResults:summary.filter(r=>r.id==="baseline"),
 results:summary
},null,2)+"\n");
console.table(ranked.slice(0,16).map(r=>({
  turn:r.settings.maxTurn,force:r.settings.contactForceScale,
  grip:r.settings.engagedGrip,z:r.startZ,vx:r.initialVx,
  traversals:r.crossings,visits:r.visits,exit:r.exit,
  ticks:r.ticks,air:r.airTicks,minSpeed:r.minSpeed.toFixed(2),
  slip:r.slipIntegral.toFixed(2)
})));
console.log("SKI-CARVE-SWEEP",summary.length,
  "qualified",summary.filter(r=>r.qualified).length);
geom.dispose();
