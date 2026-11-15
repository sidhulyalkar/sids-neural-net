import assert from "node:assert/strict";
import test from "node:test";
import {SkiSimulation,neutral,tuning} from "../lib/world/ski/simulation";
import {SkiTrickQualification} from "../lib/world/ski/trickQualification";

function runTrick(steerDuration:number,fps:number){
  const sim=new SkiSimulation((_x:number,z:number)=>-.18*z,0,0,"independent");
  sim.velocity.z=5;
  const observer=new SkiTrickQualification();
  let airTicks=0;
  const events=[] as NonNullable<ReturnType<typeof observer.observe>>[];
  for(let frame=0;frame<fps*2;frame++){
    sim.advance(1/fps,tick=>{
      const air=sim.phase==="air";
      if(air)airTicks++;
      return {...neutral,jump:tick<63,
        steer:Number(air&&airTicks<=steerDuration),
        grab:air&&airTicks<20};
    },(s,input)=>{
      const result=observer.observe(s,input);
      if(result)events.push(result);
    });
  }
  return {sim,observer,events};
}

test("actual charged 180 and 360 are recognized identically across render FPS",()=>{
  for(const [duration,label] of [[47,"180"],[94,"360"]] as const){
    let expected;
    for(const fps of [20,30,60,120]){
      const {sim,observer,events}=runTrick(duration,fps);
      assert.equal(sim.tick,240);
      assert.equal(events.length,1);
      const event=events[0];
      assert.equal(event.name,label);
      assert.equal(event.landing,"clean");
      assert.equal(event.qualified,true);
      assert.ok(event.inputSteeringTicks>=8);
      assert.ok(event.touchdownTick>event.takeoffTick);
      assert.equal(observer.serial,1);
      assert.ok(Math.abs(Math.abs(event.yawRadians)-
        (label==="180"?Math.PI:2*Math.PI))<.38);
      const signature={...event,yawRadians:Number(event.yawRadians.toFixed(8))};
      if(expected)assert.deepEqual(signature,expected);
      else expected=signature;
    }
  }
});

test("an incomplete user spin never claims a completed 180 or 360",()=>{
  const {events,observer}=runTrick(10,60);
  assert.equal(events.length,1);
  assert.equal(events[0].name,null);
  assert.equal(events[0].qualified,false);
  assert.equal(observer.serial,0);
});

test("passive charged hop has a landing record but zero credited spins",()=>{
  const {events,observer}=runTrick(0,30);
  assert.equal(events.length,1);
  assert.equal(events[0].name,null);
  assert.equal(events[0].inputSteeringTicks,0);
  assert.equal(observer.serial,0);
});

test("observer cannot label standing skier as a trick",()=>{
  const sim=new SkiSimulation(()=>0,0,0,"independent");
  const observer=new SkiTrickQualification();
  for(let i=0;i<240;i++)
    sim.advance(tuning.dt,()=>neutral,(s,input)=>{
      assert.equal(observer.observe(s,input),null);
    });
  assert.equal(observer.latest,null);
  assert.equal(observer.serial,0);
});
