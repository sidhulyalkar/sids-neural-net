import {mkdirSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import {Float32BufferAttribute,PlaneGeometry} from "three/src/Three.Core.js";
import {WORLD_BOUNDS as bounds,winterWorldFloorHeight as worldFloorHeight} from "../lib/world/model";
import {MOUNTAIN_HALFPIPE as pipe} from "../lib/world/mountainHalfpipe";
import {refineMountainSnow} from "../components/world/worldMountainHalfpipe";
import {renderedSnowHeight} from "../lib/world/ski/renderedSnow";
import {SkiV4Physics,NEUTRAL_V4_INPUT,SKI_V4_TUNING} from "../lib/world/ski/v4/core";
import {SkiHalfpipeQualification} from "../lib/world/ski/halfpipeQualification";

const out=process.env.SKI_V4_AUDIT_DIR??"artifacts/ski-v4/halfpipe";
mkdirSync(out,{recursive:true});
const mesh=new PlaneGeometry(bounds.maxX-bounds.minX,bounds.maxZ-bounds.minZ,142,132);
mesh.rotateX(-Math.PI/2);
mesh.translate((bounds.minX+bounds.maxX)/2,0,(bounds.minZ+bounds.maxZ)/2);
const positions=mesh.getAttribute("position");
for(let i=0;i<positions.count;i++)
  positions.setY(i,worldFloorHeight(positions.getX(i),positions.getZ(i)));
mesh.setAttribute("color",new Float32BufferAttribute(new Float32Array(positions.count*3),3));
refineMountainSnow(mesh);
const height=renderedSnowHeight(mesh,worldFloorHeight);
const clamp=(n:number)=>Math.max(-1,Math.min(1,n));
const near=(x:number,z:number)=>Math.abs(x-pipe.centerX)<=pipe.lipHalfWidth&&
  z>=pipe.startZ&&z<=pipe.endZ;
const configs:{startZ:number;vx:number;lead:number;angle:number}[]=[];
for(const startZ of [-58,-56])
 for(const vx of [3.5,5])
  for(const lead of [.5,1.5,2.5])
   for(const angle of [1.15,1.45])configs.push({startZ,vx,lead,angle});
function run(cfg:typeof configs[number]){
  const sim=new SkiV4Physics(height,pipe.centerX,cfg.startZ);
  sim.setHeading(0,1);sim.setHorizontalVelocity(cfg.vx,3);
  const check=new SkiHalfpipeQualification();
  const entries:string[]=[];
  const threshold=pipe.floorHalfWidth+.8;
  let target=1,reversalTick=-1,maxSpeed=0,maxGap=-Infinity,minGap=Infinity;
  let unsupportedTicks=0,airTicks=0,exit="timeout";
  for(let i=0;i<2400;i++){
    const side=target*(sim.position.x-pipe.centerX);
    if(target*sim.velocity.x>0&&side>=threshold-cfg.lead&&side<threshold
       &&reversalTick<0)reversalTick=sim.tick;
    const desired=(reversalTick<0?target:-target)*cfg.angle;
    const delta=Math.atan2(Math.sin(desired-sim.yaw),Math.cos(desired-sim.yaw));
    const input={...NEUTRAL_V4_INPUT,steer:clamp(delta*1.7)};
    sim.advance(SKI_V4_TUNING.dt,()=>input);
    const speed=Math.hypot(sim.velocity.x,sim.velocity.z);
    maxSpeed=Math.max(maxSpeed,speed);
    const gaps=sim.contact.map(x=>x.maxGap);
    maxGap=Math.max(maxGap,...gaps);
    minGap=Math.min(minGap,...sim.contact.map(x=>x.minGap));
    if(!sim.contact.some(x=>x.loaded))unsupportedTicks++;
    if(sim.phase==="air")airTicks++;
    check.observe({tick:sim.tick,x:sim.position.x,z:sim.position.z,
      vx:sim.velocity.x,speed,grounded:sim.phase!=="air"&&sim.contact.some(x=>x.loaded)});
    if(i%12===0)entries.push([sim.tick,sim.position.x,sim.position.y,sim.position.z,
      sim.velocity.x,sim.velocity.z,speed,sim.edgeAngle,sim.telemetry.carveAcceleration,
      sim.telemetry.skidDeceleration,
      sim.contact[0].contactStations,sim.contact[1].contactStations,
      sim.contact[0].maxGap,sim.contact[1].maxGap,
      check.metrics.bankCrossings].join(","));
    const newBank=check.metrics.lastBank==="left"?-1:check.metrics.lastBank==="right"?1:0;
    if(newBank&&newBank===target){target=-target;reversalTick=-1;}
    if(check.metrics.bankCrossings>=5){exit="five-crossings";break;}
    if(!near(sim.position.x,sim.position.z)){exit="footprint";break;}
  }
  const visits=check.metrics.leftVisits+check.metrics.rightVisits;
  return {...cfg,exit,visits,crossings:check.metrics.bankCrossings,
    reversals:check.metrics.lateralReversals,unsupportedTicks,airTicks,maxSpeed,
    maxGap,minGap,finalX:sim.position.x,finalZ:sim.position.z,ticks:sim.tick,
    qualified:exit==="five-crossings"&&airTicks===0&&unsupportedTicks===0,
    entries};
}
const results=configs.map(run);
const ranked=results.slice().sort((a,b)=>b.crossings-a.crossings||
  b.visits-a.visits||a.unsupportedTicks-b.unsupportedTicks);
const header="tick,x,y,z,vx,vz,speed,edge,carve,brake,leftPatches,rightPatches,leftGap,rightGap,crossings";
for(const [i,r] of ranked.slice(0,3).entries())
  writeFileSync(join(out,`rank-${i+1}-trace.csv`),[header,...r.entries].join("\n")+"\n");
writeFileSync(join(out,"report.json"),JSON.stringify({source:"rendered mountain triangle mesh",
  sha:process.env.GITHUB_SHA??"local",dt:SKI_V4_TUNING.dt,
  gate:"5 actual alternate crossings with valid boot support, no flight",
  qualifiedCount:results.filter(x=>x.qualified).length,
  runs:results.map(({entries,...row})=>row)},null,2)+"\n");
console.table(ranked.slice(0,8).map(({startZ,vx,lead,angle,visits,crossings,maxSpeed,maxGap,unsupportedTicks,exit})=>
 ({startZ,vx,lead,angle,visits,crossings,maxSpeed:maxSpeed.toFixed(2),
   maxGap:maxGap.toFixed(3),unsupportedTicks,exit})));
console.log("SKI V4 HALFPIPE AUDIT:",results.filter(x=>x.qualified).length,"/",results.length,
  "qualified; no synthetic bank visits or terrain changes");
mesh.dispose();
