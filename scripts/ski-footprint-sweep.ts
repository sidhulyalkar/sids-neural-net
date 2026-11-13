import {createTrial,inside,SoleProbe} from "../app/dev/ski-lab/fiveCarve";
import {EarlyEdgeController} from "../app/dev/ski-lab/earlyEdge";
import {tuning} from "../lib/world/ski/simulation";

for(const footprint of [false,true,"independent"] as const)for(const lead of [0,.5,1,1.5,2,2.5,3]){
 const sim=createTrial(footprint),controller=new EarlyEdgeController(lead),probe=new SoleProbe();
 let worstFrame;
 let worstInPipeGap=0,worstGap=0,lowestGap=Infinity;
 while(sim.tick<3600&&controller.visits<6&&inside(sim.position.x,sim.position.z)){
  sim.advance(tuning.dt,()=>controller.input(sim));controller.observe(sim);
  probe.update(sim).forEach((g,i)=>{
   if(sim.phase==="riding"&&sim.contact[i]){
    worstInPipeGap=Math.max(worstInPipeGap,g.insideMax);
    if(g.max>worstGap){
     worstFrame={tick:sim.tick,side:i===0?"left":"right",x:sim.position.x,z:sim.position.z,load:sim.load[i],...g};
     worstGap=g.max;
    }lowestGap=Math.min(lowestGap,g.min);
   }
  });
 }
 console.log(JSON.stringify({footprint,lead,ticks:sim.tick,visits:controller.visits,worstGap,worstInPipeGap,lowestGap,worstFrame}));
}
