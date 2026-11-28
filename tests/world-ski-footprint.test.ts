import assert from "node:assert/strict";
import test from "node:test";
import {SkiSimulation,neutral,tuning} from "../lib/world/ski/simulation";
import {SKI_SOLE_Y} from "../components/world/worldSkiContact";

test("a ridge under a ski tip supports the rider before the binding reaches it",()=>{
 const surface=(_x:number,z:number)=>Math.max(0,1-Math.abs(z-1.275)*8);
 const sim=new SkiSimulation(surface,0,0,true);
 assert.ok(Math.abs(sim.position.y+SKI_SOLE_Y-1)<1e-10);
 sim.advance(tuning.dt,()=>neutral);
 assert.ok(sim.contact.every(Boolean));
});
test("outside edge support can lift just one ski",()=>{
 const sim=new SkiSimulation((x)=>x>.30?.3:0,0,0,true);
 sim.advance(tuning.dt,()=>neutral);
 assert.deepEqual(sim.contact,[false,true]);
});

test("independent supports keep boot elevations distinct and unload the low ski at the travel limit",()=>{
 const sim=new SkiSimulation(x=>x<0?.9:0,0,0,"independent");
 assert.equal(sim.load[0]+sim.load[1],1);
 assert.deepEqual(sim.contact,[true,false]);
 assert.ok(sim.soles[0].position.y>sim.soles[1].position.y);
 assert.ok(sim.position.y-sim.soles[1].position.y<=.450001);
});
