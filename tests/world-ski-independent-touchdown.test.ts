import test from "node:test";
import assert from "node:assert/strict";
import {SkiSimulation,neutral,tuning} from "../lib/world/ski/simulation";

test("independent-ski touchdown grades the same sole contact used for riding",()=>{
 // Roll and yaw perturb the moment of first contact on a sloped snow face.
 // Whether the touchdown is clean or rough is an outcome, never coerced.
 const terrains=[
  (_x:number,_z:number)=>0,
  (x:number,z:number)=>.045*x+.035*z,
  (x:number,z:number)=>.22*Math.sin(x*.55)+.09*Math.cos(z*.31),
 ];
 let checked=0;
 for(const height of terrains){
  const sim=new SkiSimulation(height,0,0,"independent",false);
  sim.velocity.set(0,0,5);
  for(let tick=0;tick<380;tick++){
   const jump=tick>5&&tick<70;
   const airborne=sim.phase==="air";
   const input={...neutral,jump,steer:airborne&&tick<110?.7:0};
   sim.advance(tuning.dt,()=>input);
   if(sim.landingEvidence){
    // Both footprints must be computed with the actual independent sole
    // model, rather than the provisional 0.23m airborne contact proxy.
    assert.equal(sim.landingEvidence.oneSki,
      sim.contact[0]!==sim.contact[1],
      "touchdown sole mismatch on curved surface");
    assert.ok(Number.isFinite(sim.landingEvidence.upright));
    assert.ok(Number.isFinite(sim.landingEvidence.alignment));
    checked++;
    break;
   }
  }
 }
 assert.ok(checked>=2,"test multiple genuine touchdown surfaces");
});
