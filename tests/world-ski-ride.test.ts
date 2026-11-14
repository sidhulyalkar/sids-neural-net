import assert from "node:assert/strict";
import test from "node:test";
import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";
import { SkiSimulation, neutral, tuning } from "../lib/world/ski/simulation";
import { renderedSnowHeight } from "../lib/world/ski/renderedSnow";

test("snow follows the triangles on both sides of the diagonal and skips holes",()=>{
  const geometry=new BufferGeometry();
  geometry.setAttribute("position",new Float32BufferAttribute([0,0,-50,2,0,-50,0,0,-48,2,4,-48],3));
  geometry.setIndex([0,1,2,1,3,2]);
  const height=renderedSnowHeight(geometry,()=>-20);
  assert.equal(height(.5,-49.5),0);
  assert.equal(height(1.5,-48.5),2);
  assert.equal(height(1,-49),0);
  assert.equal(height(-.1,-50),-20);
  geometry.dispose();
});

test("linked carves reverse actual cross-slope velocity over a continuous descent",()=>{
  for(const entry of [3,5,7]){
    const sim=new SkiSimulation((_x,z)=>-.25*z,0,0,"independent");
    sim.velocity.z=entry;
    for(let turn=0;turn<5;turn++){
      const steer=turn%2?-1:1;
      const start=sim.position.z;
      for(let i=0;i<(turn===0?80:160);i++)sim.advance(tuning.dt,()=>({...neutral,steer}));
      assert.ok(steer*sim.velocity.x>1);
      assert.ok(sim.position.z>start);
      assert.ok(sim.contact.some(Boolean));
    }
  }
});

test("charged input trace lands a half and full rotation at four render cadences",()=>{
  for(const duration of [47,94]){
    let reference:number[]|undefined;
    for(const fps of [20,30,60,120]){
      const sim=new SkiSimulation((_x,z)=>-.18*z,0,0,"independent");
      sim.velocity.z=5;
      let airTicks=0, sweptAngle=0;
      const step=(tick:number)=>{
        const air=sim.phase==="air";
        if(air){sweptAngle+=sim.angular.y*tuning.dt;airTicks++;}
        return {...neutral,jump:tick<63,steer:Number(air&&airTicks<=duration),grab:air&&airTicks<20};
      };
      for(let frame=0;frame<fps*2;frame++)sim.advance(1/fps,step);
      assert.equal(sim.landing,"clean");
      assert.ok(Math.abs(sweptAngle-(duration===47?Math.PI:2*Math.PI))<.2);
      const forward=new Vector3(0,0,1).applyQuaternion(sim.rotation);
      assert.ok((duration===47?-1:1)*forward.z>.9);
      if(reference)assert.deepEqual(sim.position.toArray(),reference);
      reference=sim.position.toArray();
    }
  }
});

test("a skier moving over a convex lip departs with no jump input",()=>{
  const height=(_x:number,z:number)=>z<0?.35*z:-.9*z;
  const sim=new SkiSimulation(height,0,-4,"independent");
  sim.velocity.set(0,2.8,8);
  let flightTicks=0;
  for(let tick=0;tick<220;tick++){
    sim.advance(tuning.dt,()=>neutral);
    if(sim.phase==="air")flightTicks++;
  }
  assert.ok(flightTicks>1);
  assert.notEqual(sim.landing,"none");
});
