import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot=process.env.PLAYWRIGHT_MODULE_ROOT;if(!playwrightRoot)throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright=createRequire(path.join(playwrightRoot,'package.json'));const{chromium}=requireFromPlaywright('playwright');
const baseUrl=process.env.SYLVARIA_BASE_URL||'http://127.0.0.1:3000',outputDir=process.env.SYLVARIA_FLOW_DIR||'artifacts/sylvaria-v014-flow';fs.mkdirSync(outputDir,{recursive:true});
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1100,height:780}});const failures=[];const check=(ok,msg)=>{if(!ok)failures.push(msg)};
async function waitForValue(fn,arg=null,timeout=1000){const h=await page.waitForFunction(fn,arg,{timeout});try{return await h.jsonValue()}finally{await h.dispose()}}

await page.goto(`${baseUrl}/game-runtimes/mosslight-v2/index.html?charge-intent-lab=1`,{waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__MOSSLIGHT_PLAYTEST__?.version==='0.14.0'&&window.SylvariaCombat014?.version==='0.14.0'&&window.SylvariaFlowCombat?.version==='0.14.0'&&window.SylvariaChargeIntent?.version==='0.14.0');await page.click('#start');await page.locator('#c').focus();

const resetChargeLab=async()=>page.evaluate(()=>{const play=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091,p=G.state.player;play.clearCombatants();play.labClearGeometry();play.setPlayerPosition(440,360);G.state.heldMoves.clear();G.state.heldOrder=[];p.dash=null;p.dashCooldown=0;p.vx=210;p.vy=0;p.dashCharging=false;p.dashCharge=0;p.dashBuffer=0;p.dashBufferHeld=false;p.dashBufferReleased=false;p.v014ChargeReleaseGrace=0;p.v014ChargeReleaseVector=null;p.v014ChargeCommittedVector=null;p.v014ChargeCandidateVector=null;p.v014ChargeCandidateTicks=0;p.v014ChargeImmediateCommit=false});

// Chord release: the diagonal shown during charge must survive ordinary sequential key-up ordering.
await resetChargeLab();
await page.keyboard.down('a');await page.keyboard.down('w');await page.keyboard.down('Space');
await page.waitForFunction(()=>{const p=window.Sylvaria091.state.player,i=window.SylvariaChargeIntent.snapshot();return p.dashCharging&&p.dashCharge>.28&&i.committed?.x<-.65&&i.committed?.y<-.65&&p.dashChargeVector.x<-.65&&p.dashChargeVector.y<-.65},{timeout:900});
const charged=await page.evaluate(()=>({flow:window.SylvariaFlowCombat.snapshot(),intent:window.SylvariaChargeIntent.snapshot(),velocity:{x:window.Sylvaria091.state.player.vx,y:window.Sylvaria091.state.player.vy}}));
await page.keyboard.up('a');await page.keyboard.up('w');await page.waitForTimeout(18);
const beforeRelease=await page.evaluate(()=>({flow:window.SylvariaFlowCombat.snapshot(),intent:window.SylvariaChargeIntent.snapshot(),held:[...window.Sylvaria091.state.heldMoves],velocity:{x:window.Sylvaria091.state.player.vx,y:window.Sylvaria091.state.player.vy}}));
await page.keyboard.up('Space');
const launched=await waitForValue(()=>{const p=window.Sylvaria091.state.player,d=p.dash;if(!d)return false;return{dir:{...d.dir},speed:d.speed,charge:d.charge,held:[...window.Sylvaria091.state.heldMoves]}},null,600);
const inv=Math.SQRT1_2;
check(charged.intent.committed.x<-.65&&charged.intent.committed.y<-.65,`charge intent did not lock northwest: ${JSON.stringify(charged)}`);
check(beforeRelease.held.length===0,`movement keys were not actually released before Space: ${JSON.stringify(beforeRelease)}`);
check(beforeRelease.intent.committed.x<-.65&&beforeRelease.intent.committed.y<-.65&&beforeRelease.flow.dashChargeVector.x<-.65&&beforeRelease.flow.dashChargeVector.y<-.65,`sequential key-up collapsed remembered diagonal: ${JSON.stringify(beforeRelease)}`);
check(Math.abs(launched.dir.x+inv)<.03&&Math.abs(launched.dir.y+inv)<.03,`Space release ignored committed charge direction: ${JSON.stringify({charged,beforeRelease,launched})}`);
check(launched.held.length===0,`v0.14 leaked synthetic held movement after release: ${JSON.stringify(launched)}`);

// Deliberate retarget: releasing only A while continuing to hold W must become north only after the fixed retarget dwell.
await resetChargeLab();
await page.keyboard.down('a');await page.keyboard.down('w');await page.keyboard.down('Space');
await page.waitForFunction(()=>{const p=window.Sylvaria091.state.player,i=window.SylvariaChargeIntent.snapshot();return p.dashCharging&&p.dashCharge>.22&&i.committed?.x<-.65&&i.committed?.y<-.65},{timeout:900});
await page.keyboard.up('a');
const pendingRetarget=await page.evaluate(()=>({intent:window.SylvariaChargeIntent.snapshot(),held:[...window.Sylvaria091.state.heldMoves]}));
await page.waitForFunction(()=>{const i=window.SylvariaChargeIntent.snapshot();return i.committed&&Math.abs(i.committed.x)<.05&&i.committed.y<-.95&&i.candidateTicks===0},{timeout:800});
const retargeted=await page.evaluate(()=>({flow:window.SylvariaFlowCombat.snapshot(),intent:window.SylvariaChargeIntent.snapshot(),held:[...window.Sylvaria091.state.heldMoves]}));
await page.keyboard.up('Space');
const retargetLaunch=await waitForValue(()=>{const p=window.Sylvaria091.state.player,d=p.dash;if(!d)return false;return{dir:{...d.dir},speed:d.speed,charge:d.charge,held:[...window.Sylvaria091.state.heldMoves]}},null,600);
await page.keyboard.up('w');
check(pendingRetarget.held.length===1&&pendingRetarget.held[0]==='w',`deliberate retarget did not leave only W held: ${JSON.stringify(pendingRetarget)}`);
check(pendingRetarget.intent.committed.x<-.65&&pendingRetarget.intent.committed.y<-.65,`partial key release retargeted before dwell: ${JSON.stringify(pendingRetarget)}`);
check(Math.abs(retargeted.intent.committed.x)<.05&&retargeted.intent.committed.y<-.95,`held W never became committed north intent: ${JSON.stringify(retargeted)}`);
check(Math.abs(retargetLaunch.dir.x)<.03&&retargetLaunch.dir.y<-.97,`held W did not retarget charged dash after dwell: ${JSON.stringify({retargeted,retargetLaunch})}`);

const report={charged,beforeRelease,launched,pendingRetarget,retargeted,retargetLaunch,failures};fs.writeFileSync(path.join(outputDir,'charge-intent-report.json'),JSON.stringify(report,null,2));
await browser.close();
if(failures.length){console.error(`Sylvaria v0.14 charge-intent lab failed with ${failures.length} issue(s):`);for(const f of failures)console.error(` - ${f}`);process.exit(1)}
console.log(`Sylvaria v0.14 charge-intent PASS · chord release preserved northwest (${launched.dir.x.toFixed(3)}, ${launched.dir.y.toFixed(3)}) · deliberate retarget launched north (${retargetLaunch.dir.x.toFixed(3)}, ${retargetLaunch.dir.y.toFixed(3)}).`);