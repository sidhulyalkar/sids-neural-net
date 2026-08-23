import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot=process.env.PLAYWRIGHT_MODULE_ROOT;if(!playwrightRoot)throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright=createRequire(path.join(playwrightRoot,'package.json'));const{chromium}=requireFromPlaywright('playwright');
const baseUrl=process.env.SYLVARIA_BASE_URL||'http://127.0.0.1:3000',outputDir=process.env.SYLVARIA_FLOW_DIR||'artifacts/sylvaria-v014-flow';fs.mkdirSync(outputDir,{recursive:true});
const failures=[];const check=(ok,message)=>{if(!ok)failures.push(message)};const near=(a,b,e=.02)=>Math.abs(a-b)<=e;
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}});const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
async function waitForValue(fn,arg=null,timeout=1200){const handle=await page.waitForFunction(fn,arg,{timeout});try{return await handle.jsonValue()}finally{await handle.dispose()}}

await page.goto(`${baseUrl}/game-runtimes/mosslight-v2/index.html?accuracy-lab=1`,{waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__MOSSLIGHT_PLAYTEST__?.version==='0.13.0'&&window.SylvariaKinetics?.version==='0.13.0');
await page.click('#start');await page.locator('#c').focus();
await page.evaluate(async()=>{
  await import('/game-runtimes/mosslight-v2/v014/combat-flow-v014.js');
  await import('/game-runtimes/mosslight-v2/v014/enemy-flow-v014.js');
  await import('/game-runtimes/mosslight-v2/v014/flow-presentation-v014.js');
});
await page.waitForFunction(()=>window.SylvariaFlowCombat?.version==='0.14.0'&&window.SylvariaEnemyFlow?.version==='0.14.0'&&window.SylvariaFlowPresentation?.version==='0.14.0');

// Reachable metadata must describe the controls players can actually produce, including the 0.12 tap floor.
const envelopes=await page.evaluate(()=>{const f=window.SylvariaFlowCombat.snapshot();return{speed:f.dashSpeedEnvelope,distance:f.dashDistanceEnvelope,steerMax:f.dashSteerMaxRadians}});
check(envelopes.distance.tapMin>81.02&&envelopes.distance.tapMin<81.021,`tap dash distance envelope is stale: ${JSON.stringify(envelopes)}`);
check(envelopes.distance.fullMax===154,`full dash distance envelope is stale: ${JSON.stringify(envelopes)}`);
check(envelopes.speed.tapMin>1323&&envelopes.speed.tapMin<1325,`tap dash opening speed is stale: ${JSON.stringify(envelopes)}`);
check(envelopes.speed.fullMax>1977&&envelopes.speed.fullMax<1979,`full dash opening speed is stale: ${JSON.stringify(envelopes)}`);
check(near(envelopes.steerMax,.38,.00001),`committed dash steering cap is stale: ${JSON.stringify(envelopes)}`);

async function runNeutralDash(charge,{steerKey=null}={}){
  const start=await page.evaluate(charge=>{const play=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091,p=G.state.player;play.clearCombatants();play.labClearGeometry();play.setPlayerPosition(360,340);G.state.heldMoves.clear();G.state.heldOrder=[];p.dash=null;p.dashCooldown=0;p.dashCharging=false;p.dashCharge=0;p.vx=0;p.vy=0;p.lastDashAccuracy=null;G.state.heldMoves.add('d');G.fn.beginDashCharge();p.dashCharge=charge;G.fn.releaseDashCharge();const d=p.dash;G.state.heldMoves.delete('d');return{x:p.x,y:p.y,target:d.distanceTarget,speed:d.speed,ticks:d.totalTicks}},charge);
  if(steerKey)await page.evaluate(key=>window.Sylvaria091.state.heldMoves.add(key),steerKey);
  const end=await waitForValue(()=>{const G=window.Sylvaria091,p=G.state.player,flow=window.SylvariaFlowCombat.snapshot();if(p.dash||!flow.lastDashAccuracy)return false;return{x:p.x,y:p.y,accuracy:flow.lastDashAccuracy}},null,1600);
  if(steerKey)await page.evaluate(key=>window.Sylvaria091.state.heldMoves.delete(key),steerKey);
  return{start,end};
}

const minimumDash=await runNeutralDash(.12);
check(near(minimumDash.end.accuracy.distanceTarget,envelopes.distance.tapMin,.02),`tap dash did not use reachable minimum target: ${JSON.stringify(minimumDash)}`);
check(near(minimumDash.end.accuracy.pathTravel,minimumDash.end.accuracy.distanceTarget,.03),`minimum neutral dash path missed solved target: ${JSON.stringify(minimumDash)}`);
check(near(minimumDash.end.accuracy.displacement,minimumDash.end.accuracy.distanceTarget,.03),`straight minimum dash displacement missed solved target: ${JSON.stringify(minimumDash)}`);
check(minimumDash.end.accuracy.maxSteerAngle===0,`straight tap dash accumulated steering: ${JSON.stringify(minimumDash.end.accuracy)}`);

const maximumDash=await runNeutralDash(1);
check(near(maximumDash.end.accuracy.pathTravel,154,.03),`full neutral dash path should be 154 px: ${JSON.stringify(maximumDash)}`);
check(near(maximumDash.end.accuracy.displacement,154,.03),`straight full dash displacement should be 154 px: ${JSON.stringify(maximumDash)}`);
check(maximumDash.end.accuracy.maxSteerAngle===0,`straight full dash accumulated steering: ${JSON.stringify(maximumDash.end.accuracy)}`);

// Hold orthogonal steering for the full burst. The completed authoritative record must show
// visible course correction, never exceed the 0.38 rad leash, and preserve scalar velocity.
const steeredDash=await runNeutralDash(.42,{steerKey:'w'}),steeredAccuracy=steeredDash.end.accuracy;
check(near(steeredAccuracy.pathTravel,steeredAccuracy.distanceTarget,.04),`steered neutral dash path missed solved target: ${JSON.stringify(steeredAccuracy)}`);
check(steeredAccuracy.displacement<=steeredAccuracy.pathTravel+.01,'curved dash displacement exceeded path length');
check(steeredAccuracy.maxSteerAngle>=.34&&steeredAccuracy.maxSteerAngle<=envelopes.steerMax+.001,`completed dash escaped committed steering leash: ${JSON.stringify(steeredAccuracy)}`);
check(steeredAccuracy.maxVelocityAlignmentError<.02,`actual dash velocity diverged from committed dash direction: ${JSON.stringify(steeredAccuracy)}`);
check(steeredAccuracy.maxScalarSpeedError<.2,`WASD injected extra scalar speed during dash: ${JSON.stringify(steeredAccuracy)}`);

// Measure the parry cooldown refund against authoritative simulation time so natural cooldown decay is separated from the reward.
const refundBefore=await page.evaluate(()=>{const play=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091,p=G.state.player;play.setRoom(0,1);play.clearCombatants();play.labClearGeometry();play.setPlayerPosition(300,330);G.state.slashes=[];p.cutCooldown=0;p.flow=0;p.dash=null;p.dashCooldown=2;play.spawnCounterShot('right',70,{speed:180,pattern:'straight'});return{counter:G.state.stats.perfectCounters||0,cooldown:p.dashCooldown,time:G.state.totalTime}});
await page.keyboard.press('ArrowRight');
const refundAfter=await waitForValue(base=>{const G=window.Sylvaria091;if((G.state.stats.perfectCounters||0)<=base)return false;return{counter:G.state.stats.perfectCounters,cooldown:G.state.player.dashCooldown,time:G.state.totalTime}},refundBefore.counter,900);
const elapsed=refundAfter.time-refundBefore.time,expectedRefundCooldown=Math.max(0,refundBefore.cooldown-elapsed-.1);
check(near(refundAfter.cooldown,expectedRefundCooldown,.012),`parry cooldown reward is not 100 ms after natural decay: ${JSON.stringify({refundBefore,refundAfter,elapsed,expectedRefundCooldown})}`);

// Presentation must acknowledge buffered intent and earned Flow without changing simulation.
const bufferPresentation=await page.evaluate(()=>{const G=window.Sylvaria091,p=G.state.player;p.flow=82;p.bladeBuffer=7/120;p.bladeQueuedDirection='left';G.fn.render();return window.SylvariaFlowPresentation.snapshot()});
check(bufferPresentation.overlay===true&&bufferPresentation.bufferCues>=1,`buffered blade input is still visually silent: ${JSON.stringify(bufferPresentation)}`);
check(bufferPresentation.flow===82,`Flow presentation lost authoritative Flow value: ${JSON.stringify(bufferPresentation)}`);

// A spent Strider evade must visibly advertise its one-hit punish window before damage is dealt.
const punishPresentation=await page.evaluate(()=>{const play=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091;play.setRoom(1,2);play.labClearGeometry();play.setPlayerPosition(300,330);const e=G.state.enemies.find(x=>x.kineticType==='strider');for(const other of G.state.enemies)if(other!==e)other.dead=true;e.x=430;e.y=330;e.kineticEvade=null;e.v014PunishTimer=30/120;G.state.player.flow=82;G.state.player.bladeBuffer=0;G.state.player.bladeQueuedDirection=null;G.fn.render();return{enemy:{id:e.id,timer:e.v014PunishTimer},presentation:window.SylvariaFlowPresentation.snapshot()}});
check(punishPresentation.presentation.punishCues>=1,`post-evade punish state is not visible: ${JSON.stringify(punishPresentation)}`);
await page.screenshot({path:path.join(outputDir,'strider-punish-window-v014.png'),fullPage:true});

for(const error of pageErrors)failures.push(`pageerror: ${error}`);
const report={envelopes,minimumDash,maximumDash,steeredDash,refund:{before:refundBefore,after:refundAfter,elapsed,expectedRefundCooldown},presentation:{buffer:bufferPresentation,punish:punishPresentation},failures};
fs.writeFileSync(path.join(outputDir,'accuracy-report.json'),JSON.stringify(report,null,2));
await browser.close();
if(failures.length){console.error(`Sylvaria v0.14 accuracy lab failed with ${failures.length} issue(s):`);for(const failure of failures)console.error(` - ${failure}`);process.exit(1)}
console.log(`Sylvaria v0.14 accuracy lab PASS · reachable dash envelope ${envelopes.distance.tapMin.toFixed(2)}–${envelopes.distance.fullMax.toFixed(0)} px at ${envelopes.speed.tapMin.toFixed(1)}–${envelopes.speed.fullMax.toFixed(1)} opening px/s · actual minimum/full paths ${minimumDash.end.accuracy.pathTravel.toFixed(2)}/${maximumDash.end.accuracy.pathTravel.toFixed(2)} px · steered path ${steeredAccuracy.pathTravel.toFixed(2)} px at ${(steeredAccuracy.maxSteerAngle*180/Math.PI).toFixed(1)}° max bend · velocity alignment/scalar contracts verified · parry cooldown refund 100 ms · combat-state readability cues verified.`);
