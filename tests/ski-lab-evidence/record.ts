import {writeFileSync} from "node:fs";
import {Vector3} from "three";
import {createTrial,SoleProbe,bank,inside,trialInput} from "../../app/dev/ski-lab/fiveCarve";
import {tuning} from "../../lib/world/ski/simulation";
const sim=createTrial(),probe=new SoleProbe(),forward=new Vector3(),right=new Vector3();
let target=1,visits=0;
const rows=[];
for(let i=0;i<120*30;i++){
 const input=trialInput(sim,target);
 sim.advance(tuning.dt,()=>input);
 const {x,y,z}=sim.position;
 const grounded=sim.contact.some(Boolean)&&sim.phase==="riding";
 const b=bank(x,z,grounded);
 if(b===target){visits++;target=-target;}
 const soles=probe.update(sim);
 forward.set(0,0,1).applyQuaternion(sim.rotation);right.set(1,0,0).applyQuaternion(sim.rotation);
 rows.push([sim.tick,input.steer,x,y,z,sim.velocity.x,sim.velocity.y,sim.velocity.z,sim.phase,...sim.contact,
  Math.atan2(forward.x,forward.z),sim.velocity.length(),sim.velocity.dot(right),sim.edge,sim.pressure,sim.grip,
  ...soles.flatMap(g=>[g.min,g.mean,g.max]),visits]);
 if(visits===6||!inside(x,z))break;
}
const header="tick,steer,x,y,z,vx,vy,vz,phase,left,right,heading,speed,slip,edge,pressure,grip,Lmin,Lmean,Lmax,Rmin,Rmean,Rmax,visits";
writeFileSync(new URL("./trajectory.csv",import.meta.url),[header,...rows.map(r=>r.join(","))].join("\n")+"\n");
console.log({ticks:sim.tick,visits,exit:!inside(sim.position.x,sim.position.z)});
