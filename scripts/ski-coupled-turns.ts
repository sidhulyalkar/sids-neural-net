import {mkdirSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import {Float32BufferAttribute,PlaneGeometry,Vector3} from "three/src/Three.Core.js";
import {WORLD_BOUNDS as bounds,worldFloorHeight} from "../lib/world/model";
import {MOUNTAIN_HALFPIPE as h} from "../lib/world/mountainHalfpipe";
import {refineMountainSnow} from "../components/world/worldMountainHalfpipe";
import {renderedSnowHeight} from "../lib/world/ski/renderedSnow";
import {SkiSimulation,tuning,neutral,type SkiCarveSettings} from "../lib/world/ski/simulation";
import {SkiHalfpipeQualification} from "../lib/world/ski/halfpipeQualification";
import {EarlyEdgeController} from "../app/dev/ski-lab/earlyEdge";
import {inside} from "../app/dev/ski-lab/fiveCarve";

const out=process.env.SKI_COUPLED_AUDIT_DIR??"artifacts/ski-coupled-turns";
mkdirSync(out,{recursive:true});
const geometry=new PlaneGeometry(bounds.maxX-bounds.minX,
 bounds.maxZ-bounds.minZ,142,132);
geometry.rotateX(-Math.PI/2);
geometry.translate((bounds.minX+bounds.maxX)/2,0,
 (bounds.minZ+bounds.maxZ)/2);
const p=geometry.getAttribute("position");
for(let i=0;i<p.count;i++)p.setY(i,worldFloorHeight(p.getX(i),p.getZ(i)));
geometry.setAttribute("color",
 new Float32BufferAttribute(new Float32Array(p.count*3),3));
refineMountainSnow(geometry);
const height=renderedSnowHeight(geometry,worldFloorHeight);
type Config={startZ:number;vx:number;vz:number;lead:number;yaw:number;tuck:boolean;
  profile:string;settings:Partial<SkiCarveSettings>};
const profiles:{id:string;settings:Partial<SkiCarveSettings>}[]=[
 {id:"baseline",settings:{}},
 {id:"grip",settings:{engagedGrip:9,contactForceScale:1.5,maxTurn:3}},
 {id:"edge-partial",settings:{carveAlignment:.35,engagedGrip:9,contactForceScale:1.5,maxTurn:3.4}},
 {id:"edge-full",settings:{carveAlignment:1,engagedGrip:9,contactForceScale:1.5,maxTurn:3.4}},
 {id:"edge-balanced",settings:{carveAlignment:.7,engagedGrip:6,contactForceScale:1,maxTurn:2.6}},
 {id:"edge-with-drag",settings:{carveAlignment:.5,engagedGrip:9,contactForceScale:1.5,maxTurn:3.4,drag:.04}},
 {id:"snow-resistance-04",settings:{carveAlignment:.5,engagedGrip:9,contactForceScale:1.5,maxTurn:3.4,snowContactDrag:.04}},
 {id:"snow-resistance-07",settings:{carveAlignment:.5,engagedGrip:9,contactForceScale:1.5,maxTurn:3.4,snowContactDrag:.07}},
 {id:"snow-resistance-10",settings:{carveAlignment:.5,engagedGrip:9,contactForceScale:1.5,maxTurn:3.4,snowContactDrag:.10}},
];
const variants:Config[]=[];
for(const startZ of [-60,-58])
 for(const vx of [4.5,5.5])
  for(const vz of [2.5,3.5])
   for(const lead of [.5,1,1.5,2])
    for(const yaw of [.9,1.2,1.5])
     for(const tuck of [false,true])
      for(const profile of profiles)
       variants.push({startZ,vx,vz,lead,yaw,tuck,
        profile:profile.id,settings:profile.settings});
const forward=new Vector3(0,0,1);
function run(c:Config){
 const sim=new SkiSimulation(height,h.centerX,c.startZ,"independent",false,undefined,c.settings);
 sim.velocity.set(c.vx,0,c.vz);
 sim.setHeading(0,1);
 const controller=new EarlyEdgeController(c.lead);
 const observed=new SkiHalfpipeQualification();
 const visits:{tick:number;side:string;x:number;z:number;speed:number}[]=[];
 const trace:string[]=[];
 let airTicks=0,exit="tick-limit",lowestSpeed=Infinity,peakSpeed=0;
 for(let i=0;i<1500;i++){
  controller.input(sim);
  forward.set(0,0,1).applyQuaternion(sim.rotation);
  const yaw=Math.atan2(forward.x,forward.z);
  const goal=controller.steeringBank*c.yaw;
  const error=Math.atan2(Math.sin(goal-yaw),Math.cos(goal-yaw));
  const steer=Math.max(-1,Math.min(1,2*error));
  const input={...neutral,steer,tuck:c.tuck};
  sim.advance(tuning.dt,()=>input,s=>{
   const count=observed.metrics.leftVisits+observed.metrics.rightVisits;
   const speed=Math.hypot(s.velocity.x,s.velocity.z);
   observed.observe({tick:s.tick,x:s.position.x,z:s.position.z,
     vx:s.velocity.x,speed,
     grounded:s.phase==="riding"&&s.contact.some(Boolean)});
   const newCount=observed.metrics.leftVisits+observed.metrics.rightVisits;
   if(newCount>count)visits.push({tick:s.tick,
     side:observed.metrics.lastBank??"",x:s.position.x,z:s.position.z,speed});
  });
  controller.observe(sim);
  const speed=Math.hypot(sim.velocity.x,sim.velocity.z);
  lowestSpeed=Math.min(lowestSpeed,speed);peakSpeed=Math.max(peakSpeed,speed);
  if(sim.phase==="air")airTicks++;
  if(sim.tick%15===0)
   trace.push([sim.tick,sim.position.x,sim.position.z,
     sim.velocity.x,sim.velocity.z,speed,sim.grip,sim.edge,
     steer,Number(c.tuck),observed.metrics.bankCrossings].join(","));
  if(observed.metrics.bankCrossings>=5){exit="five-crossings";break;}
  if(!inside(sim.position.x,sim.position.z)){exit="footprint";break;}
 }
 const m=observed.metrics;
 const reason=Math.abs(sim.position.x-h.centerX)>h.lipHalfWidth?"lateral":
   sim.position.z>h.endZ?"downhill":sim.position.z<h.startZ?"uphill":"other";
 return {...c,crossings:m.bankCrossings,visits:visits.length,
  lateralReversals:m.lateralReversals,airTicks,
  exit,exitSide:reason,ticks:sim.tick,
  endX:sim.position.x,endZ:sim.position.z,
  lowestSpeed,peakSpeed,bankEvents:visits,
  qualified:exit==="five-crossings"&&airTicks===0,
  trace};
}
const trials=variants.map(run);
const best=trials.slice().sort((a,b)=>
 b.crossings-a.crossings||b.visits-a.visits||
 (a.exit==="five-crossings"?-1:0)-(b.exit==="five-crossings"?-1:0)||
 b.endZ-a.endZ||a.airTicks-b.airTicks);
const header="tick,x,z,vx,vz,speed,grip,edge,steer,tuck,crossings";
best.slice(0,10).forEach((v,i)=>writeFileSync(join(out,"rank-"+(i+1)+".csv"),
 [header,...v.trace].join("\n")+"\n"));
const summary=trials.map(({trace,...v})=>v);
writeFileSync(join(out,"summary.json"),JSON.stringify({
 schema:"iland-ski-joint-physics-control-v1",
 source:"same refined actual island snow, 120Hz, 9 A/B physics profiles x 192 input schedules",
 criterion:"five opposite-bank grounded crossings, zero unintended flight",
 note:"Research-only input replay. No dynamic coefficients or steering automation is wired into the production game.",
 total:summary.length,qualifiedCount:summary.filter(v=>v.qualified).length,
 byProfile:profiles.map(p=>({id:p.id,number:summary.filter(v=>v.profile===p.id).length,
   maxCrossings:Math.max(...summary.filter(v=>v.profile===p.id).map(v=>v.crossings)),
   qualified:summary.filter(v=>v.profile===p.id&&v.qualified).length})),
 results:summary
},null,2)+"\n");
console.table(best.slice(0,18).map(v=>({
 profile:v.profile,lead:v.lead,yaw:v.yaw,z:v.startZ,vx:v.vx,vz:v.vz,
 tuck:v.tuck,passes:v.crossings,visits:v.visits,
 exit:v.exitSide,air:v.airTicks,
 low:v.lowestSpeed.toFixed(2),endZ:v.endZ.toFixed(2)
})));
console.log("SKI-COUPLED-TURN-SWEEP",summary.length,
 "qualified",summary.filter(v=>v.qualified).length);
geometry.dispose();
