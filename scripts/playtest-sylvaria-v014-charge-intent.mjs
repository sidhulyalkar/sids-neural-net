import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot=process.env.PLAYWRIGHT_MODULE_ROOT;if(!playwrightRoot)throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright=createRequire(path.join(playwrightRoot,'package.json'));const{chromium}=requireFromPlaywright('playwright');
const baseUrl=process.env.SYLVARIA_BASE_URL||'http://127.0.0.1:3000',outputDir=process.env.SYLVARIA_FLOW_DIR||'artifacts/sylvaria-v014-flow';fs.mkdirSync(outputDir,{recursive:true});
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1100,height:780}});const failures=[];const check=(ok,msg)=>{if(!ok)failures.push(msg)};
async function waitForValue(fn,arg=null,timeout=1000){const h=await page.waitForFunction(fn,arg,{timeout});try{return await h.jsonValue()}finally{await h.dispose()}}

await page.goto(`${baseUrl}/game-runtimes/mosslight-v2/index.html?charge-intent-lab=1`,{waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__MOSSLIGHT_PLAYTEST__?.version==='0.13.0');await page.click('#start');await page.locator('#c').focus();
await page.evaluate(async()=>{await import('/game-runtimes/mosslight-v2/v014/combat-flow-v014.js')});
await page.waitForFunction(()=>window.SylvariaFlowCombat?.version==='0.14.0');

await page.evaluate(()=>{const play=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091,p=G.state.player;play.clearCombatants();play.labClearGeometry();play.setPlayerPosition(440,360);G.state.heldMoves.clear();G.state.heldOrder=[];p.dash=null;p.dashCooldown=0;p.vx=210;p.vy=0;p.dashCharging=false;p.dashCharge=0});

// Charge northwest while existing momentum points east. Release movement keys first,
// then Space. The launched direction must follow the stored charge indicator, not momentum.
await page.keyboard.down('a');await page.keyboard.down('w');await page.keyboard.down('Space');
await page.waitForFunction(()=>{const p=window.Sylvaria091.state.player;return p.dashCharging&&p.dashCharge>.28&&p.dashChargeVector.x<-.65&&p.dashChargeVector.y<-.65},{timeout:900});
const charged=await page.evaluate(()=>({flow:window.SylvariaFlowCombat.snapshot(),velocity:{x:window.Sylvaria091.state.player.vx,y:window.Sylvaria091.state.player.vy}}));
await page.keyboard.up('a');await page.keyboard.up('w');
await page.waitForTimeout(18);
const beforeRelease=await page.evaluate(()=>({flow:window.SylvariaFlowCombat.snapshot(),held:[...window.Sylvaria091.state.heldMoves],velocity:{x:window.Sylvaria091.state.player.vx,y:window.Sylvaria091.state.player.vy}}));
await page.keyboard.up('Space');
const launched=await waitForValue(()=>{const p=window.Sylvaria091.state.player,d=p.dash;if(!d)return false;return{dir:{...d.dir},speed:d.speed,charge:d.charge,held:[...window.Sylvaria091.state.heldMoves]}},null,600);
const inv=Math.SQRT1_2;
check(charged.flow.dashChargeVector.x<-.65&&charged.flow.dashChargeVector.y<-.65,`charge indicator did not lock northwest: ${JSON.stringify(charged)}`);
check(beforeRelease.held.length===0,`movement keys were not actually released before Space: ${JSON.stringify(beforeRelease)}`);
check(Math.abs(launched.dir.x+inv)<.03&&Math.abs(launched.dir.y+inv)<.03,`Space release ignored stored charge direction: ${JSON.stringify({charged,beforeRelease,launched})}`);
check(launched.held.length===0,`v0.14 leaked synthetic held movement after release: ${JSON.stringify(launched)}`);

const report={charged,beforeRelease,launched,failures};fs.writeFileSync(path.join(outputDir,'charge-intent-report.json'),JSON.stringify(report,null,2));
await browser.close();
if(failures.length){console.error(`Sylvaria v0.14 charge-intent lab failed with ${failures.length} issue(s):`);for(const f of failures)console.error(` - ${f}`);process.exit(1)}
console.log(`Sylvaria v0.14 charge-intent PASS · released WASD before Space and preserved northwest dash vector (${launched.dir.x.toFixed(3)}, ${launched.dir.y.toFixed(3)}).`);