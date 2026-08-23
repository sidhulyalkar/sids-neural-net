import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot=process.env.PLAYWRIGHT_MODULE_ROOT;if(!playwrightRoot)throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright=createRequire(path.join(playwrightRoot,'package.json'));const{chromium}=requireFromPlaywright('playwright');
const baseUrl=process.env.SYLVARIA_BASE_URL||'http://127.0.0.1:3000',outputDir=process.env.SYLVARIA_FLOW_DIR||'artifacts/sylvaria-v014-flow';fs.mkdirSync(outputDir,{recursive:true});
const failures=[];const check=(ok,message)=>{if(!ok)failures.push(message)};const near=(a,b,e=.015)=>Math.abs(a-b)<=e;
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}});const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
async function waitForValue(fn,arg=null,timeout=1000){const handle=await page.waitForFunction(fn,arg,{timeout});try{return await handle.jsonValue()}finally{await handle.dispose()}}

await page.goto(`${baseUrl}/game-runtimes/mosslight-v2/index.html?flow-lab=1`,{waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__MOSSLIGHT_PLAYTEST__?.version==='0.13.0'&&window.SylvariaKinetics?.version==='0.13.0'&&window.SylvariaKineticAI?.version==='0.13.0');
await page.click('#start');await page.locator('#c').focus();
await page.evaluate(async()=>{await import('/game-runtimes/mosslight-v2/v014/combat-flow-v014.js');await import('/game-runtimes/mosslight-v2/v014/enemy-flow-v014.js')});
await page.waitForFunction(()=>window.SylvariaFlowCombat?.version==='0.14.0'&&window.SylvariaEnemyFlow?.version==='0.14.0');

// Pressing blade during the committed opening of a dash must queue intent, not bypass commitment.
const preCommit=await page.evaluate(()=>{const play=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091,p=G.state.player;play.clearCombatants();play.labClearGeometry();play.setPlayerPosition(300,330);G.state.slashes=[];p.dash=null;p.dashCooldown=0;p.dashCharging=false;p.dashCharge=0;p.cutCooldown=0;p.vx=0;p.vy=0;p.bladeBuffer=0;p.bladeQueuedDirection=null;const cuts=G.state.stats.cuts;const canvas=document.getElementById('c');canvas?.focus?.();const target=document.activeElement||canvas||document;for(const [type,key,code] of[['keydown',' ','Space'],['keyup',' ','Space'],['keydown','ArrowRight','ArrowRight'],['keyup','ArrowRight','ArrowRight']])target.dispatchEvent(new KeyboardEvent(type,{key,code,bubbles:true,cancelable:true}));return{cuts,afterCuts:G.state.stats.cuts,flow:window.SylvariaFlowCombat.snapshot(),kinetics:window.SylvariaKinetics.snapshot()}});
check(preCommit.kinetics.dashing===true,'minimum Space release did not launch a dash for commitment test');
check(preCommit.afterCuts===preCommit.cuts,`pre-commit blade illegally started immediately: ${preCommit.cuts}->${preCommit.afterCuts}`);
check(preCommit.flow.bladeBuffered===true&&preCommit.flow.bladeQueuedDirection==='right',`pre-commit blade intent was not buffered: ${JSON.stringify(preCommit.flow)}`);
const committedBlade=await waitForValue(base=>{const G=window.Sylvaria091,k=window.SylvariaKinetics.snapshot();if(G.state.stats.cuts<=base||k.arc?.dashCancelled!==true)return false;return{cuts:G.state.stats.cuts,kinetics:k,flow:window.SylvariaFlowCombat.snapshot(),dashEcho:G.state.player.dashEcho}},preCommit.cuts,900);
check(committedBlade.cuts===preCommit.cuts+1,`queued blade should execute exactly once after commitment: ${JSON.stringify(committedBlade)}`);
check(committedBlade.dashEcho>0,'queued blade did not transition through dash-cancel echo');

// A blade input during the last seven recovery ticks is remembered and executes once recovery clears.
const lateRecovery=await page.evaluate(()=>{const G=window.Sylvaria091,p=G.state.player;G.state.slashes=[];p.dash=null;p.dashCooldown=0;p.cutCooldown=5/120;p.bladeBuffer=0;p.bladeQueuedDirection=null;const cuts=G.state.stats.cuts;const canvas=document.getElementById('c');canvas?.focus?.();const target=document.activeElement||canvas||document;for(const type of['keydown','keyup'])target.dispatchEvent(new KeyboardEvent(type,{key:'ArrowUp',code:'ArrowUp',bubbles:true,cancelable:true}));return{cuts,afterCuts:G.state.stats.cuts,flow:window.SylvariaFlowCombat.snapshot()}});
check(lateRecovery.afterCuts===lateRecovery.cuts,'late recovery blade should buffer rather than fire immediately');
check(lateRecovery.flow.bladeBuffered===true&&lateRecovery.flow.bladeQueuedDirection==='up',`late recovery blade was dropped: ${JSON.stringify(lateRecovery.flow)}`);
const recoveredBlade=await waitForValue(base=>{const G=window.Sylvaria091,k=window.SylvariaKinetics.snapshot(),s=G.state.slashes.at(-1);if(G.state.stats.cuts<=base||s?.direction!=='up')return false;return{cuts:G.state.stats.cuts,arc:k.arc,direction:s.direction,flow:window.SylvariaFlowCombat.snapshot()}},lateRecovery.cuts,800);
check(recoveredBlade.cuts===lateRecovery.cuts+1&&recoveredBlade.direction==='up','buffered recovery blade did not execute exactly once in the requested direction');

// Steering can bend a committed dash without touching its scalar exponential decay or distance target.
const dashSteerStart=await page.evaluate(()=>{const G=window.Sylvaria091,p=G.state.player;G.state.slashes=[];p.dash=null;p.dashCooldown=0;p.dashCharging=false;p.dashCharge=0;p.cutCooldown=0;p.vx=0;p.vy=0;G.state.heldMoves.add('d');G.fn.beginDashCharge();p.dashCharge=.42;G.fn.releaseDashCharge();const d=p.dash;G.state.heldMoves.delete('d');G.state.heldMoves.add('w');return{speed:d.speed,distanceTarget:d.distanceTarget,dir:{...d.dir},ticksLeft:d.ticksLeft}});
const dashSteered=await waitForValue(()=>{const G=window.Sylvaria091,p=G.state.player,d=p.dash;if(!d||d.elapsedTicks<5)return false;return{speed:d.speed,distanceTarget:d.distanceTarget,dir:{...d.dir},elapsedTicks:d.elapsedTicks}},null,800);
await page.evaluate(()=>window.Sylvaria091.state.heldMoves.delete('w'));
check(dashSteered.speed<dashSteerStart.speed,`dash scalar speed did not decay: ${dashSteerStart.speed}->${dashSteered.speed}`);
check(near(dashSteered.distanceTarget,dashSteerStart.distanceTarget,.001),`dash steering changed target-distance contract: ${dashSteerStart.distanceTarget}->${dashSteered.distanceTarget}`);
check(dashSteered.dir.x>.9&&dashSteered.dir.y<-.18,`dash course correction was either absent or too loose: ${JSON.stringify(dashSteered.dir)}`);

// Flow changes recovery tempo, not the five-tick parry rule.
const recovery=await page.evaluate(()=>{const G=window.Sylvaria091,p=G.state.player;p.dash=null;p.dashCooldown=0;p.cutCooldown=0;G.state.slashes=[];p.flow=0;G.fn.cut('right');const low=G.state.slashes.at(-1)?.recovery;G.state.slashes=[];p.cutCooldown=0;p.flow=100;G.fn.cut('right');const high=G.state.slashes.at(-1)?.recovery;return{low,high,parryWindow:window.SylvariaKinetics.config.parryWindow}});
check(near(recovery.low,10/120,.00001),`zero-Flow recovery changed unexpectedly: ${recovery.low}`);
check(near(recovery.high,7/120,.00001),`full-Flow recovery did not reach seven ticks: ${recovery.high}`);
check(near(recovery.parryWindow,5/120,.00001),`Flow widened the parry window: ${recovery.parryWindow}`);

// A perfect parry pays tempo back by refunding 100 ms of dash cooldown.
const refundSetup=await page.evaluate(()=>{const play=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091,p=G.state.player;play.setRoom(0,1);play.clearCombatants();play.labClearGeometry();play.setPlayerPosition(300,330);G.state.slashes=[];p.cutCooldown=0;p.flow=0;p.dash=null;p.dashCooldown=.5;play.spawnCounterShot('right',70,{speed:180,pattern:'straight'});return{perfect:G.state.stats.perfectCounters||0,cooldown:p.dashCooldown}});
await page.keyboard.press('ArrowRight');
const refund=await waitForValue(base=>{const G=window.Sylvaria091;if((G.state.stats.perfectCounters||0)<=base)return false;return{perfect:G.state.stats.perfectCounters,cooldown:G.state.player.dashCooldown}},refundSetup.perfect,800);
check(refund.cooldown<refundSetup.cooldown-.08,`perfect parry did not materially refund dash cooldown: ${refundSetup.cooldown}->${refund.cooldown}`);

// Enemy reactions are readable cadence, not hidden probability. Baiting a Strider evade opens a punish window.
const enemySetup=await page.evaluate(()=>{const play=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091;play.setRoom(1,2);play.labClearGeometry();play.setPlayerPosition(300,330);const e=G.state.enemies.find(x=>x.kineticType==='strider');for(const other of G.state.enemies)if(other!==e)other.dead=true;e.x=366;e.y=330;e.state='move';e.arcDodgeCooldown=0;e.kineticEvade=null;e.v014EvadeCycle=false;e.v014PunishTimer=0;G.state.player.cutCooldown=0;return{id:e.id,dodge:window.SylvariaKineticAI.archetypes.strider.dodge,reaction:window.SylvariaKineticAI.archetypes.strider.reaction,dodges:G.state.stats.enemyArcDodges||0}});
check(enemySetup.dodge===100,'v0.14 Strider still uses a hidden dodge percentage');
check(near(enemySetup.reaction,9/120,.00001),`Strider reaction cue is not nine ticks: ${enemySetup.reaction}`);
await page.keyboard.press('ArrowRight');
const evadeCue=await waitForValue(id=>{const G=window.Sylvaria091,e=G.state.enemies.find(x=>x.id===id);if(!e?.kineticEvade)return false;return{state:e.state,cooldown:e.arcDodgeCooldown,cue:e.kineticCue}},enemySetup.id,700);
check(evadeCue.cooldown<=.9+.01&&evadeCue.cooldown>.8,`Strider evade cooldown was not normalized to a learnable cadence: ${JSON.stringify(evadeCue)}`);
const punishOpen=await waitForValue(id=>{const e=window.Sylvaria091.state.enemies.find(x=>x.id===id);if(!e||e.kineticEvade||!(e.v014PunishTimer>0))return false;return{timer:e.v014PunishTimer,state:e.state,x:e.x,y:e.y}},enemySetup.id,1000);
check(punishOpen.timer>0&&punishOpen.timer<=30/120+.001,`Strider did not expose post-evade punish window: ${JSON.stringify(punishOpen)}`);
const punishDamage=await page.evaluate(id=>{const G=window.Sylvaria091,e=G.state.enemies.find(x=>x.id===id);const hp=e.hp;e.v014PunishTimer=Math.max(e.v014PunishTimer,20/120);G.fn.damageEnemy(e,1,{x:1,y:0},{melee:true,arc:true});const punish=hp-e.hp;e.hp=hp;e.dead=false;e.v014PunishTimer=0;G.fn.damageEnemy(e,1,{x:1,y:0},{melee:true,arc:true});const base=hp-e.hp;return{punish,base,timer:e.v014PunishTimer}},enemySetup.id);
check(punishDamage.punish>punishDamage.base*1.3,`bait punish did not materially exceed ordinary blade damage: ${JSON.stringify(punishDamage)}`);
check(punishDamage.timer===0,'one-hit punish window was not consumed by the blade');

for(const error of pageErrors)failures.push(`pageerror: ${error}`);
await page.screenshot({path:path.join(outputDir,'combat-flow-lab-v014.png'),fullPage:true});
const report={preCommit,committedBlade,lateRecovery,recoveredBlade,dashSteer:{start:dashSteerStart,after:dashSteered},recovery,refund:{before:refundSetup,after:refund},enemy:{setup:enemySetup,cue:evadeCue,punishOpen,punishDamage},failures};fs.writeFileSync(path.join(outputDir,'report.json'),JSON.stringify(report,null,2));
await browser.close();
if(failures.length){console.error(`Sylvaria v0.14 combat-flow lab failed with ${failures.length} issue(s):`);for(const failure of failures)console.error(` - ${failure}`);process.exit(1)}
console.log(`Sylvaria v0.14 combat-flow lab PASS · pre-commit blade buffered to tick ${committedBlade.kinetics.arc?.dashCancelled?'4+':'?'} · late recovery input retained · dash bent to (${dashSteered.dir.x.toFixed(2)}, ${dashSteered.dir.y.toFixed(2)}) without changing distance target · full-Flow recovery ${(recovery.high*120).toFixed(0)} ticks · parry refunded ${(refundSetup.cooldown-refund.cooldown).toFixed(3)} s · Strider readable evade + ${(punishDamage.punish/punishDamage.base).toFixed(2)}× bait punish.`);