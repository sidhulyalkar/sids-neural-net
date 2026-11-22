import {PlaneGeometry,Float32BufferAttribute,Vector3} from "three";
import {WORLD_BOUNDS as b,worldFloorHeight} from "../lib/world/model";
import {refineMountainSnow} from "../components/world/worldMountainHalfpipe";
import {renderedSnowHeight} from "../lib/world/ski/renderedSnow";
import {SkiSimulation,neutral,tuning} from "../lib/world/ski/simulation";
import {SKI_HALF_WIDTH,SKI_HALF_LENGTH,SKI_SOLE_Y} from "../components/world/worldSkiContact";
const g=new PlaneGeometry(b.maxX-b.minX,b.maxZ-b.minZ,142,132);
g.rotateX(-Math.PI/2);g.translate((b.minX+b.maxX)/2,0,(b.minZ+b.maxZ)/2);
const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,worldFloorHeight(p.getX(i),p.getZ(i)));
g.setAttribute("color",new Float32BufferAttribute(new Float32Array(p.count*3),3));refineMountainSnow(g);
const height=renderedSnowHeight(g,worldFloorHeight);
const sim=new SkiSimulation(height,7,-61.05,"independent");
const costs:number[]=[], minima=[Infinity,Infinity], maxima=[-Infinity,-Infinity], sums=[0,0], counts=[0,0];
const q=new Vector3();const phases=new Set<string>();let ticks=0;
for(;ticks<1500;ticks++){
 const start=performance.now();sim.advance(tuning.dt,()=>({...neutral,steer:.65*Math.sin(ticks/80),tuck:true}));
 costs.push(performance.now()-start);phases.add(sim.phase);
 if(sim.position.z>-30||sim.position.z<-64||sim.position.x>18.5||sim.position.x<-10)break;
 if(sim.phase==="air")continue;
 sim.soles.forEach((pose,i)=>{
  if(!sim.contact[i])return;
  for(let j=0;j<=64;j++)for(const edge of [-1,0,1]){
   q.set(edge*SKI_HALF_WIDTH,SKI_SOLE_Y,(j/32-1)*SKI_HALF_LENGTH).applyQuaternion(pose.rotation).add(pose.position);
   const clearance=q.y-height(q.x,q.z);minima[i]=Math.min(minima[i],clearance);maxima[i]=Math.max(maxima[i],clearance);sums[i]+=clearance;counts[i]++;
  }
 });
}
costs.sort((a,b)=>a-b);
console.log(JSON.stringify({ticks,end:sim.position.toArray(),minima,maxima,means:sums.map((s,i)=>s/counts[i]),phases:[...phases],p50:costs[Math.floor(costs.length*.5)],p95:costs[Math.floor(costs.length*.95)]}));
