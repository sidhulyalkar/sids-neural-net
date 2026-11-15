import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const {chromium}=createRequire(path.join(process.env.PLAYWRIGHT_MODULE_ROOT,"package.json"))("playwright");
const dir=process.env.WORLD_PLAYER_SPIN_DIR??"artifacts/world-player-spin";
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000/world";
fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({
  args:["--no-sandbox","--enable-unsafe-swiftshader","--use-angle=swiftshader"]
});
const results=[],errors=[];
async function attempt(degrees){
  const name=String(degrees),output=path.join(dir,name);
  fs.mkdirSync(output,{recursive:true});
  // Keep CSS layout desktop-sized while limiting SwiftShader pixel work.
  // This is browser evidence, not a hardware FPS measurement.
  const page=await browser.newPage({viewport:{width:850,height:610},deviceScaleFactor:.5});
  const pageErrors=[];
  page.on("pageerror",error=>pageErrors.push(error.message));
  const inputs=[];
  const track=(input,data)=>inputs.push({input,...data});
  await page.addInitScript(()=>{
    const frames={},history=[];
    window.skiSpinAudit={frames,history};
    let hadFlight=false,lastTick=-1;
    const native=window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame=callback=>native(t=>{
      callback(t);
      const c=document.querySelector('canvas[role="application"][data-ski-tick]');
      if(!c)return;
      const d=c.dataset,tick=Number(d.skiTick);
      if(tick===lastTick||!Number.isFinite(tick))return;
      lastTick=tick;
      const m={
        tick,phase:d.skiRidePhase,
        spin:Number(d.skiAirSpinRadians),omega:Number(d.skiAngularY),
        steer:Number(d.skiInputSteer),jump:d.skiInputJump,
        landing:d.skiLanding,score:d.skiTrickName,
        serial:Number(d.skiTrickSerial),qualified:d.skiTrickQualified,
        inputTicks:Number(d.skiTrickInputTicks),
        contact:d.skiContactActive,bigAir:d.bigAirPhase,
        leftBank:Number(d.skiLeftBankVisits),
        rightBank:Number(d.skiRightBankVisits),
        crossings:Number(d.skiBankCrossings)
      };
      history.push(m);
      const frameName=m.phase==="charging"&&!frames.charge?"charge":
        m.phase==="air"&&!frames.takeoff?"takeoff":
        m.phase==="air"&&Math.abs(m.spin)>1.4&&!frames.rotation?"rotation":
        hadFlight&&m.phase!=="air"&&m.landing!=="none"&&!frames.touchdown?"touchdown":null;
      if(m.phase==="air")hadFlight=true;
      if(frameName)frames[frameName]={data:{...d},png:c.toDataURL("image/png")};
    });
  });
  let passed=false,reason="",last={};
  const capture=async()=>{
    const audit=await page.evaluate(()=>window.skiSpinAudit).catch(()=>null);
    for(const [stage,frame] of Object.entries(audit?.frames??{})){
      fs.writeFileSync(path.join(output,stage+".png"),
        Buffer.from(frame.png.split(",")[1],"base64"));
      fs.writeFileSync(path.join(output,stage+".json"),JSON.stringify(frame.data,null,2));
    }
    fs.writeFileSync(path.join(output,"trace.json"),JSON.stringify({
      targetDegrees:degrees,inputs,history:audit?.history??[],pageErrors,last,
      passed,reason
    },null,2)+"\n");
  };
  const state=async()=>page.locator('canvas[role="application"]').first().evaluate(c=>({...c.dataset}));
  const until=(predicate,arg,timeout=120000)=>page.waitForFunction(predicate,arg,
    {timeout,polling:"raf"});
  try{
    await page.goto(base,{timeout:120000});
    await page.getByRole("button",{name:"Explore world",exact:true}).click({timeout:120000});
    await page.getByRole("button",{name:"Skiing",exact:true}).click({timeout:60000});
    await until(()=>document.querySelector('canvas[role="application"]')?.dataset.skiRidePhase==="riding");
    const start=await state();
    assert.equal(start.bigAirPhase,"idle","Ski Jump must be unarmed");
    const startTick=Number(start.skiTick);
    await page.keyboard.down("Space");
    track("Space down",{atTick:startTick});
    await until(n=>{
      const d=document.querySelector('canvas[role="application"]')?.dataset;
      return d&&Number(d.skiTick)>=n&&d.skiRidePhase==="charging";
    },startTick+65);
    const release=await state();
    // Begin the real A-key spin before releasing the jump charge.
    // Under SwiftShader there can be 30 physics ticks between two browser
    // observation frames: waiting to *notice* flight previously cost
    // 60+ airborne ticks and made a clean 180 physically impossible.
    await page.keyboard.down("a");
    track("a down",{atTick:Number(release.skiTick)});
    await page.keyboard.up("Space");
    track("Space up",{atTick:Number(release.skiTick)});
    await until(()=>{
      const d=document.querySelector('canvas[role="application"]')?.dataset;
      return !!d&&(d.skiRidePhase==="air"||d.skiLanding!=="none");
    });
    const lift=await state();
    assert.equal(lift.skiRidePhase,"air","must observe actual airborne input");
    // Real D-key countersteer is required to arrest angular rate before
    // landing. A spin number without a controlled, clean touchdown is not
    // a trick. The predicted braking arc for the 6/s angular response is
    // about 0.4-0.6 radians at full speed.
    const radians=degrees*Math.PI/180;
    const target=await until(goal=>{
      const d=document.querySelector('canvas[role="application"]')?.dataset;
      if(!d)return false;
      if(d.skiRidePhase!=="air"&&d.skiLanding!=="none")return "landed-before-target";
      const anticipated=Math.abs(Number(d.skiAirSpinRadians))+
        Math.abs(Number(d.skiAngularY))*.05;
      return d.skiRidePhase==="air"&&anticipated>=goal-.30?"countersteer":false;
    },radians,120000);
    const approach=await target.jsonValue();
    if(approach!=="countersteer")
      throw Error("airtime ended before the commanded rotation");
    const brakeStart=await state();
    await page.keyboard.up("a");
    track("a up",{atTick:Number(brakeStart.skiTick),
      yaw:Number(brakeStart.skiAirSpinRadians),
      omega:Number(brakeStart.skiAngularY)});
    await page.keyboard.down("d");
    track("d down",{atTick:Number(brakeStart.skiTick)});
    await until(()=>{
      const d=document.querySelector('canvas[role="application"]')?.dataset;
      return d&&(Number(d.skiAngularY)<=1||d.skiRidePhase!=="air");
    },null,120000);
    const brakeEnd=await state();
    await page.keyboard.up("d");
    track("d up",{atTick:Number(brakeEnd.skiTick),
      yaw:Number(brakeEnd.skiAirSpinRadians),
      omega:Number(brakeEnd.skiAngularY)});
    await until(()=>{
      const d=document.querySelector('canvas[role="application"]')?.dataset;
      return d&&d.skiRidePhase!=="air"&&d.skiLanding!=="none"&&
        Number(d.skiTrickTouchdownTick)>0;
    },null,120000);
    last=await state();
    assert.equal(last.bigAirPhase,"idle","no unauthorized Ski Jump at touchdown");
    assert.ok(Number(last.skiTrickInputTicks)>=8,"real A-key steering must be observed");
    assert.equal(last.skiTrickLanding,"clean","trick must land cleanly");
    assert.equal(last.skiTrickName,name,name+" label requires measured fixed-step yaw");
    assert.equal(last.skiTrickQualified,"true",name+" must be genuinely scored");
    assert.ok(Number(last.skiTrickSerial)>=1,"scored event serial must increment");
    assert.deepEqual(pageErrors,[],"browser must not throw runtime exceptions");
    passed=true;reason="qualified clean "+name+" from real keyboard input";
  }catch(e){
    reason=String(e?.message??e);
    last=await state().catch(()=>last);
    errors.push({degrees,error:reason});
  }finally{
    await page.keyboard.up("a").catch(()=>{});
    await page.keyboard.up("d").catch(()=>{});
    await page.keyboard.up("Space").catch(()=>{});
    await capture().catch(e=>errors.push({degrees,evidenceError:String(e)}));
    results.push({degrees,passed,reason,inputCount:inputs.length,
      spin:last.skiAirSpinRadians,landing:last.skiTrickLanding,
      score:last.skiTrickName,qualified:last.skiTrickQualified,
      scoreSerial:last.skiTrickSerial,
      inputSteeringTicks:last.skiTrickInputTicks,
      landingMetrics:{
        impact:last.skiLandingImpact,upright:last.skiLandingUpright,
        alignment:last.skiLandingAlignment,angularRate:last.skiLandingAngularRate,
        oneSki:last.skiLandingOneSki
      },
      errors:pageErrors});
    await page.close().catch(()=>{});
  }
}
try{
  for(const degrees of [180,360])await attempt(degrees);
}finally{
  await browser.close();
  fs.writeFileSync(path.join(dir,"summary.json"),JSON.stringify({
    schema:"iland-real-keyboard-spin-browser-v1",
    realInput:true,assisted:false,physicsModified:false,
    qualifiedBoth:results.every(r=>r.passed),results,errors
  },null,2)+"\n");
  console.log("SKI-PLAYER-TRICK-QUALIFICATION",JSON.stringify(results));
}
assert.ok(results.length===2,"both player spin attempts must run");
assert.ok(results.every(r=>r.passed),"both 180 and 360 must have clean player-executed score");
