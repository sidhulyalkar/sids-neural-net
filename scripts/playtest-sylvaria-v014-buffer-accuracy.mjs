import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot=process.env.PLAYWRIGHT_MODULE_ROOT;if(!playwrightRoot)throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright=createRequire(path.join(playwrightRoot,'package.json'));const{chromium}=requireFromPlaywright('playwright');
const baseUrl=process.env.SYLVARIA_BASE_URL||'http://127.0.0.1:3000',outputDir=process.env.SYLVARIA_FLOW_DIR||'artifacts/sylvaria-v014-flow';fs.mkdirSync(outputDir,{recursive:true});
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1100,height:780}});const failures=[];const check=(ok,msg)=>{if(!ok)failures.push(msg)};const near=(a,b,e=.04)=>Math.abs(a-b)<=e;
async function waitForValue(fn,arg=null,timeout=1200){const h=await page.waitForFunction(fn,arg,{timeout});try{return await h.jsonValue()}finally{await h.dispose()}}

await page.goto(`${baseUrl}/game-runtimes/mosslight-v2/index.html?buffer-accuracy-lab=1`,{waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__MOSSLIGHT_PLAYTEST__?.version==='0.14.0'&&window.SylvariaCombat014?.version==='0.14.0'&&window.SylvariaFlowCombat?.version==='0.14.0');await page.click('#start');await page.locator('#c').focus();

const setup=await page.evaluate(()=>{const play=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091,p=G.state.player;play.clearCombatants();play.labClearGeometry();play.setPlayerPosition(360,340);G.state.heldMoves.clear();G.state.heldOrder=[];p.dash=null;p.dashCharging=false;p.dashCharge=0;p.dashCooldown=5/120;p.dashBuffer=0;p.dashBufferHeld=false;p.dashBufferReleased=false;p.vx=0;p.vy=0;p.lastDashAccuracy=null;return{dashes:G.state.stats.dashes}});
await page.keyboard.down('d');await page.keyboard.press('Space');
const queued=await page.evaluate(()=>({flow:window.SylvariaFlowCombat.snapshot(),kinetics:window.SylvariaKinetics.snapshot(),dashes:window.Sylvaria091.state.stats.dashes}));
check(queued.kinetics.dashBuffered===true||queued.kinetics.dashBuffer>0,`Space was not buffered during recovery: ${JSON.stringify(queued)}`);
check(queued.dashes===setup.dashes,'buffered Space launched before cooldown became legal');

const launched=await waitForValue(base=>{const G=window.Sylvaria091,p=G.state.player,d=p.dash;if(G.state.stats.dashes!==base+1||!d)return false;return{dir:{...d.dir},speed:d.speed,distanceTarget:d.distanceTarget,elapsedTicks:d.elapsedTicks,dashes:G.state.stats.dashes}},setup.dashes,900);
check(launched.dir.x>.98&&Math.abs(launched.dir.y)<.03,`buffered dash lost held east direction: ${JSON.stringify(launched)}`);
await page.keyboard.up('d');
const ended=await waitForValue(()=>{const G=window.Sylvaria091,p=G.state.player,f=window.SylvariaFlowCombat.snapshot();if(p.dash||!f.lastDashAccuracy)return false;return{accuracy:f.lastDashAccuracy,dashes:G.state.stats.dashes}},null,1400);
check(ended.dashes===setup.dashes+1,`buffered dash executed more than once: ${JSON.stringify(ended)}`);
check(near(ended.accuracy.pathTravel,ended.accuracy.distanceTarget),`buffered dash path does not match solved target: ${JSON.stringify(ended.accuracy)}`);
check(near(ended.accuracy.displacement,ended.accuracy.distanceTarget),`straight buffered dash displacement does not match target: ${JSON.stringify(ended.accuracy)}`);

const report={setup,queued,launched,ended,failures};fs.writeFileSync(path.join(outputDir,'buffer-accuracy-report.json'),JSON.stringify(report,null,2));await browser.close();
if(failures.length){console.error(`Sylvaria v0.14 buffered-dash accuracy failed with ${failures.length} issue(s):`);for(const f of failures)console.error(` - ${f}`);process.exit(1)}
console.log(`Sylvaria v0.14 buffered-dash accuracy PASS · one queued dash traveled ${ended.accuracy.pathTravel.toFixed(3)} px against ${ended.accuracy.distanceTarget.toFixed(3)} px solved target.`);