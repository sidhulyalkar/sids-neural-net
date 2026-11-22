import assert from "node:assert/strict";
import test from "node:test";
import {SnowTracks} from "../components/world/skiSnowTracks";
import {SkiSimulation,tuning,neutral} from "../lib/world/ski/simulation";

test("loaded skis mark separate contact paths and replay clears pooled ribbons",()=>{
 const flat=()=>0,sim=new SkiSimulation(flat,0,0,"independent"),tracks=new SnowTracks(flat);
 sim.velocity.z=4;
 for(let i=0;i<60;i++){sim.advance(tuning.dt,()=>neutral);tracks.update(sim);}
 const geometry=tracks.mesh.geometry,count=geometry.drawRange.count;
 assert.ok(count>=12);
 const positions=geometry.getAttribute("position");
 assert.ok(positions.getX(0)*positions.getX(6)<0);
 sim.phase="air";tracks.update(sim);
 sim.tick+=721;tracks.update(sim);
 assert.equal(geometry.drawRange.count,count);
 assert.equal(tracks.mesh.visible,false);
 tracks.reset();assert.equal(geometry.drawRange.count,0);tracks.dispose();
});
