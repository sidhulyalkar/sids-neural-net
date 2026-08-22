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

// Derived speed metadata must describe the geometric solver actually shipping in v0.14.
const speedEnvelope=await page.evaluate(()=>window.SylvariaFlowCombat.snapshot().dashSpeedEnvelope);
check(speedEnvelope.neutralMin>1274&&speedEnvelope.neutralMin<1275,`neutral minimum dash opening speed is stale: ${JSON.stringify(speedEnvelope)}`);
check(speedEnvelope.neutralMax>1977&&speedEnvelope.neutralMax<1979,`neutral maximum dash opening speed is stale: ${JSON.stringify(speedEnvelope)}`);

async function runNeutralDash(charge,{steerKey=null}={}){
  const start=await page.evaluate(charge=>{const play=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091,p=G.state.player;play.clearCombatants();play.labClearGeometry();play.setPlayerPosition(360,340);G.state.heldMoves.clear();G.state.heldOrder=[];p.dash=null;p.dashCooldown=0;p.dashCharging=false;p.dashCharge=0;p.vx=0;p.vy=0;p.lastDashAccuracy=null;G.state.heldMoves.add('d');G.fn.beginDashCharge();p.dashCharge=charge;G.fn.releaseDashCharge();const d=p.dash;G.state.heldMoves.delete('d');return{x:p.x,y:p.y,target:d.distanceTarget,speed:d.speed,ticks:d.totalTicks}},charge);
  if(steerKey)await page.evaluate(key=>window.Sylvaria091.state.heldMoves.add(key),steerKey);
  const mid=steerKey?await waitForValue(()=>{const G=window.Sylvaria091,p=G.state.player,d=p.dash;if(!d||d.elapsedTicks<6)return false;return{dir:{...d.dir},speed:d.speed,vx:p.vx,vy:p.vy,elapsedTicks:d.elapsedTicks}},null,900):null;
  const end=await waitForValue(()=>{const G=window.Sylvaria091,p=G.state.player,flow=window.SylvariaFlowCombat.snapshot();if(p.dash||!flow.lastDashAccuracy)return false;return{x:p.x,y:p.y,accuracy:flow.lastDashAccuracy}},null,1400);
  if(steerKey)await page.evaluate(key=>window.Sylvaria091.state.heldMoves.delete(key),steerKey);
  return{start,mid,end};
}

const minimumDash=await runNeutralDash(.12);
check(near(minimumDash.end.accuracy.pathTravel,minimumDash.end.accuracy.distanceTarget,.03),`minimum neutral dash path missed solved target: ${JSON.stringify(minimumDash)}`);
check(near(minimumDash.end.accuracy.displacement,minimumDash.end.accuracy.distanceTarget,.03),`straight minimum dash displacement missed solved target: ${JSON.stringify(minimumDash)}`);

const maximumDash=await runNeutralDash(1);
check(near(maximumDash.end.accuracy.pathTravel,154,.03),`full neutral dash path should be 154 px: ${JSON.stringify(maximumDash)}`);
check(near(maximumDash.end.accuracy.displacement,154,.03),`straight full dash displacement should be 154 px: ${JSON.stringify(maximumDash)}`);

const steeredDash=await runNeutralDash(.42,{steerKey:'w'});
const velocityMagnitude=Math.hypot(steeredDash.mid.vx,steeredDash.mid.vy),dirAngle=Math.atan2(steeredDash.mid.dir.y,steeredDash.mid.dir.x),velocityAngle=Math.atan2(steeredDash.mid.vy,steeredDash.mid.vx);
check(near(steeredDash.end.accuracy.pathTravel,steeredDash.end.accuracy.distanceTarget,.04),`steered neutral dash path missed solved target: ${JSON.stringify(steeredDash.end.accuracy)}`);
check(steeredDash.end.accuracy.displacement<=steeredDash.end.accuracy.pathTravel+.01,'curved dash displacement exceeded path length');
check(Math.abs(dirAngle)>=.22&&Math.abs(dirAngle)<=.48,`six-tick dash bend left the committed-control envelope: ${dirAngle} rad`);
check(Math.abs(velocityAngle-dirAngle)<.015,`actual dash velocity diverged from committed dash direction: dir ${dirAngle}, velocity ${velocityAngle}`);
check(Math.abs(velocityMagnitude-steeredDash.mid.speed)<.15,`WASD injected extra scalar speed during dash: velocity ${velocityMagnitude}, scalar ${steeredDash.mid.speed}`);

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
const report={speedEnvelope,minimumDash,maximumDash,steeredDash:{...steeredDash,dirAngle,velocityAngle,velocityMagnitude},refund:{before:refundBefore,after:refundAfter,elapsed,expectedRefundCooldown},presentation:{buffer:bufferPresentation,punish:punishPresentation},failures};
fs.writeFileSync(path.join(outputDir,'accuracy-report.json'),JSON.stringify(report,null,2));
await browser.close();
if(failures.length){console.error(`Sylvaria v0.14 accuracy lab failed with ${failures.length} issue(s):`);for(const failure of failures)console.error(` - ${failure}`);process.exit(1)}
console.log(`Sylvaria v0.14 accuracy lab PASS · neutral dash envelope ${speedEnvelope.neutralMin.toFixed(1)}–${speedEnvelope.neutralMax.toFixed(1)} px/s · minimum/full paths ${minimumDash.end.accuracy.pathTravel.toFixed(2)}/${maximumDash.end.accuracy.pathTravel.toFixed(2)} px · steered path ${steeredDash.end.accuracy.pathTravel.toFixed(2)} px at ${(Math.abs(dirAngle)*180/Math.PI).toFixed(1)}° bend · parry cooldown refund 100 ms · combat-state readability cues verified.`);