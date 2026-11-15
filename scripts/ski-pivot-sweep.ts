import {createTrial,inside,SoleProbe} from "../app/dev/ski-lab/fiveCarve";
import {EarlyEdgeController} from "../app/dev/ski-lab/earlyEdge";
import {tuning} from "../lib/world/ski/simulation";

for(const lead of [0,.5,1,1.5,2,2.5,3]){
 for(const pivot of [false,true,"overhang"] as const){
  const sim=createTrial("independent",pivot),control=new EarlyEdgeController(lead),probe=new SoleProbe();
  let peakGap=0,lowestGap=Infinity,peakPitch=0;
  while(sim.tick<3600&&control.visits<6&&inside(sim.position.x,sim.position.z)){
   sim.advance(tuning.dt,()=>control.input(sim));control.observe(sim);
   probe.update(sim).forEach((gap,i)=>{
    if(sim.phase==="riding"&&sim.contact[i]){
     peakGap=Math.max(peakGap,gap.max);lowestGap=Math.min(lowestGap,gap.min);
     peakPitch=Math.max(peakPitch,Math.abs(sim.pitchOffset[i]));
    }
   });
  }
  console.log(JSON.stringify({lead,pivot,visits:control.visits,ticks:sim.tick,peakGap,lowestGap,peakPitch}));
 }
}
