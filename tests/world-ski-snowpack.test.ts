import assert from "node:assert/strict";
import test from "node:test";
import {
  BARE_SNOWPACK,GROOMED_SNOWPACK,authorSnowpack,makeSnowpack,
  snowResponse,snowSurfaceLabel,uniformSnowpack
} from "../lib/world/ski/snowpack";
import {SkiV4Physics,NEUTRAL_V4_INPUT,SKI_V4_TUNING} from "../lib/world/ski/v4/core";

test("no authored snow means zero strata, sink and ski/snow forces",()=>{
  const p=authorSnowpack(7,-55,18,0,1);
  assert.deepEqual(p,BARE_SNOWPACK);
  assert.deepEqual(snowResponse(p),{
    edgeFactor:0,shearFactor:0,brakeFactor:0,dragFactor:0,estimatedSink:0,
  });
  assert.equal(snowSurfaceLabel(p),"bare");
  assert.equal(uniformSnowpack(0).totalDepth,0);
});
test("authored strata remain bounded, deterministic and spatially varied",()=>{
  const p=authorSnowpack(7,-50,20,1,1);
  assert.deepEqual(p,authorSnowpack(7,-50,20,1,1));
  assert.ok(p.powderDepth>0&&p.packedDepth>0);
  assert.ok(p.packedDepth>p.powderDepth,"groomed halfpipe needs hardpack under powder");
  assert.ok(p.totalDepth<2);
  const mountain=authorSnowpack(-2,-70,24,1,0);
  assert.notDeepEqual(mountain,p);
  assert.ok(mountain.powderDepth>0);
  const rim=authorSnowpack(13.2,-50,20,1,1);
  assert.ok(rim.ice>p.ice,"wind-scoured rim has more glazed crust");
  const thin=authorSnowpack(-2,-70,24,.2,0);
  assert.ok(thin.totalDepth<mountain.totalDepth);
  for(let x=-80;x<=80;x+=7)for(let z=-90;z<=80;z+=13){
    const value=authorSnowpack(x,z,20,.9,.4);
    assert.ok(Number.isFinite(value.totalDepth)&&value.totalDepth>=0&&value.totalDepth<4);
    assert.ok(value.crust>=0&&value.crust<=1&&value.ice>=0&&value.ice<=1);
  }
});
test("soft powder increases resistive glide and estimate of compression",()=>{
  const powder=makeSnowpack(1,.8,.2,.08,.01);
  const packed=GROOMED_SNOWPACK;
  const p=snowResponse(powder),h=snowResponse(packed);
  assert.ok(p.dragFactor>h.dragFactor);
  assert.ok(p.estimatedSink>h.estimatedSink);
  assert.ok(p.brakeFactor>h.brakeFactor);
  assert.equal(h.dragFactor,1);
  assert.equal(h.edgeFactor,1);
  assert.ok(p.estimatedSink<=powder.powderDepth);
});
test("exposed ice reduces cutting-edge capacity without creating propulsion",()=>{
  const glass=makeSnowpack(1,.01,.3,.92,.94);
  const regular=snowResponse(GROOMED_SNOWPACK);
  const icy=snowResponse(glass);
  assert.ok(icy.edgeFactor<regular.edgeFactor);
  assert.ok(icy.shearFactor<regular.shearFactor);
  assert.ok(icy.brakeFactor<regular.brakeFactor);
  assert.equal(snowSurfaceLabel(glass),"ice");
  assert.equal(snowSurfaceLabel(makeSnowpack(1,.4,.45,.1,.03)),"powder");
});
test("physics selects local powder depth for resistance, never changes snow geometry",()=>{
  const surface=(_x:number,z:number)=>-.08*z;
  const hard=makeSnowpack(1,.01,.7,.65,.02);
  const soft=makeSnowpack(1,.8,.18,.05,.01);
  const a=new SkiV4Physics(surface,0,0,undefined,()=>1,()=>hard);
  const b=new SkiV4Physics(surface,0,0,undefined,()=>1,()=>soft);
  a.setHeading(0,1);b.setHeading(0,1);
  a.setHorizontalVelocity(0,5);b.setHorizontalVelocity(0,5);
  for(let i=0;i<80;i++){
    a.advance(SKI_V4_TUNING.dt,()=>({...NEUTRAL_V4_INPUT}));
    b.advance(SKI_V4_TUNING.dt,()=>({...NEUTRAL_V4_INPUT}));
  }
  assert.ok(b.telemetry.powderDepth>a.telemetry.powderDepth);
  assert.ok(b.telemetry.estimatedSink>a.telemetry.estimatedSink);
  assert.ok(b.telemetry.snowResistance>a.telemetry.snowResistance);
  assert.ok(Math.hypot(b.velocity.x,b.velocity.z) <
    Math.hypot(a.velocity.x,a.velocity.z),"powder glide must lose more speed");
  assert.ok(Math.abs(b.position.y-surface(b.position.x,b.position.z))<.2,
    "snow depth does not add a floating second collision surface");
});
test("material under left/right edges keeps independent depth",()=>{
  const surface=()=>0;
  const pack=(x:number)=>x<0?
    makeSnowpack(1,.55,.25,.1,.02):
    makeSnowpack(1,.02,.7,.75,.17);
  const sim=new SkiV4Physics(surface,0,0,undefined,()=>1,pack);
  sim.setHeading(0,1);sim.setHorizontalVelocity(0,3);
  sim.advance(SKI_V4_TUNING.dt,()=>({...NEUTRAL_V4_INPUT}));
  assert.ok(sim.contact[0].snowpack.powderDepth>sim.contact[1].snowpack.powderDepth);
  assert.ok(sim.contact[0].estimatedSink>sim.contact[1].estimatedSink);
  assert.ok(sim.contact.every(c=>c.snowpack.totalDepth>0));
});
