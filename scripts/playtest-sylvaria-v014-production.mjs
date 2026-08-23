import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot=process.env.PLAYWRIGHT_MODULE_ROOT;if(!playwrightRoot)throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright=createRequire(path.join(playwrightRoot,'package.json'));const{chromium}=requireFromPlaywright('playwright');
const baseUrl=process.env.SYLVARIA_BASE_URL||'http://127.0.0.1:3000',outputDir=process.env.SYLVARIA_FLOW_DIR||'artifacts/sylvaria-v014-flow';fs.mkdirSync(outputDir,{recursive:true});
const failures=[];const check=(ok,message)=>{if(!ok)failures.push(message)};const near=(a,b,e=.015)=>Math.abs(a-b)<=e;
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1360,height:920}});const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
async function waitForValue(fn,arg=null,timeout=1800){const handle=await page.waitForFunction(fn,arg,{timeout});try{return await handle.jsonValue()}finally{await handle.dispose()}}

await page.goto(`${baseUrl}/game-runtimes/mosslight-v2/index.html?production-v014-lab=1`,{waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__MOSSLIGHT_PLAYTEST__?.version==='0.14.0'&&window.SylvariaCombat014?.version==='0.14.0'&&window.SylvariaCharacterRig?.version==='0.14.0'&&window.SylvariaThreatManager?.version==='0.14.0'&&window.SylvariaBossFlow?.version==='0.14.0');
const boot=await page.evaluate(()=>({play:window.__MOSSLIGHT_PLAYTEST__.snapshot(),competitive:window.SylvariaCompetitive?.snapshot?.(),entry:window.SylvariaCombat014?.version,script:[...document.scripts].map(s=>s.getAttribute('src')).filter(Boolean)}));
check(boot.play.version==='0.14.0'&&boot.play.engineVersion==='0.14.0',`public shell did not expose v0.14 identity: ${JSON.stringify(boot.play)}`);
check(boot.play.visual?.unifiedCharacterRig===true&&boot.play.visual?.attachedReactiveBlade===true,'public v0.14 snapshot did not advertise unified character ownership');
check(Boolean(boot.competitive?.rankedDisabledReason),`changed authoritative physics still appeared rankable: ${JSON.stringify(boot.competitive)}`);
check(boot.script.some(src=>src?.includes('v014-entry.js')),'public page did not boot v014-entry.js');
await page.click('#start');await page.locator('#c').focus();

// One shared pose must answer both "where is Sprid?" and "where does the tongue begin?"
const directions=['right','up','left','down'];const rigDirections=[];
for(const direction of directions){
  const sample=await page.evaluate(direction=>{const play=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091,p=G.state.player;play.clearCombatants();play.labClearGeometry();play.setPlayerPosition(430,350);G.state.slashes=[];G.state.heldMoves.clear();p.cutCooldown=0;p.dash=null;p.dashCharging=false;p.vx=0;p.vy=0;G.fn.cut(direction);G.fn.render();const s=G.state.slashes.at(-1),rig=window.SylvariaCharacterRig.pose(p,s),visual=window.SylvariaKineticPresentation.snapshot();return{direction,root:{x:p.x,y:p.y},slashRoot:{x:s.x,y:s.y},rig,visual}},direction);
  const mouthError=Math.hypot((sample.visual.tongueMouth?.x??9999)-sample.rig.mouth.x,(sample.visual.tongueMouth?.y??9999)-sample.rig.mouth.y),rootError=Math.hypot(sample.slashRoot.x-sample.root.x,sample.slashRoot.y-sample.root.y);
  rigDirections.push({...sample,mouthError,rootError});
  check(mouthError<.01,`${direction} tongue did not originate at rig mouth: ${mouthError}`);
  check(rootError<.01,`${direction} authoritative slash root detached from player: ${rootError}`);
  check(sample.visual.tongueAttachmentError<.01,`${direction} presentation reported attachment error ${sample.visual.tongueAttachmentError}`);
}
const expected={right:[1,0],up:[0,-1],left:[-1,0],down:[0,1]};
for(const sample of rigDirections){const [x,y]=expected[sample.direction];check(near(sample.rig.forward.x,x,.001)&&near(sample.rig.forward.y,y,.001),`${sample.direction} frog body faced wrong command vector: ${JSON.stringify(sample.rig.forward)}`)}

// The attachment must remain coherent while simulation moves underneath an active sweep.
const movingAttachment=await page.evaluate(()=>{const play=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091,p=G.state.player;play.clearCombatants();play.labClearGeometry();play.setPlayerPosition(360,340);G.state.slashes=[];G.state.heldMoves.clear();p.cutCooldown=0;p.vx=0;p.vy=0;G.fn.cut('right');G.state.heldMoves.add('d');return{x:p.x,y:p.y}});
const movingSample=await waitForValue(start=>{const G=window.Sylvaria091,p=G.state.player,s=G.state.slashes.at(-1);if(!s||s.phase!=='active'||p.x<=start.x+4)return false;G.fn.render();const rig=window.SylvariaCharacterRig.pose(p,s),visual=window.SylvariaKineticPresentation.snapshot();return{player:{x:p.x,y:p.y},slash:{x:s.x,y:s.y,phase:s.phase},rig,visual}},movingAttachment,1200);
await page.evaluate(()=>window.Sylvaria091.state.heldMoves.delete('d'));
check(Math.hypot(movingSample.slash.x-movingSample.player.x,movingSample.slash.y-movingSample.player.y)<.01,`moving arc root lagged behind frog: ${JSON.stringify(movingSample)}`);
check(Math.hypot(movingSample.visual.tongueMouth.x-movingSample.rig.mouth.x,movingSample.visual.tongueMouth.y-movingSample.rig.mouth.y)<.01,'moving tongue mouth diverged from rig socket');

// Perfect-parry mobility reward is exactly 100 ms at the moment the reward is applied.
const refundSetup=await page.evaluate(()=>{const play=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091,p=G.state.player;play.setRoom(0,1);play.labClearGeometry();play.setPlayerPosition(300,330);for(const e of G.state.enemies)e.dead=true;const dummy=play.spawnTestEnemy('drone',850,120,'refund-anchor');const de=G.state.enemies.find(e=>e.id===dummy);if(de){de.clock=99;de.state='move';de.evadeCooldown=99}G.state.slashes=[];G.state.heldMoves.clear();G.state.heldOrder=[];p.cutCooldown=0;p.flow=0;p.dash=null;p.dashCooldown=2;p.dashBuffer=0;p.dashBufferHeld=false;p.dashBufferReleased=false;p.dashCharging=false;p.lastParryDashRefund=null;play.spawnCounterShot('right',70,{speed:180,pattern:'straight'});return{counter:G.state.stats.perfectCounters||0,cooldown:p.dashCooldown}},null);
await page.keyboard.press('ArrowRight');
const refund=await waitForValue(base=>{const G=window.Sylvaria091,r=G.state.player.lastParryDashRefund;if(!r||r.counter<=base)return false;return{receipt:r,currentCooldown:G.state.player.dashCooldown,room:G.state.worldDepth}},refundSetup.counter,1200);
check(near(refund.receipt.refund,.1,.00001),`parry receipt was not 100 ms: ${JSON.stringify(refund)}`);
check(near(refund.receipt.beforeCooldown-refund.receipt.afterCooldown,.1,.00001),`parry applied wrong cooldown delta: ${JSON.stringify(refund)}`);
check(refund.receipt.dashing===false&&refund.room===1,`refund measurement was contaminated by dash or room transition: ${JSON.stringify(refund)}`);

// Boss offense must be earned. Five phase-three telegraph dash-cuts crack five guard segments,
// then the explicit core opening amplifies blade damage while live pressure is left intact.
const boss=await page.evaluate(()=>{const play=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091;play.setRoom(29,30);play.labClearGeometry();play.setPlayerPosition(300,330);for(const e of G.state.enemies)e.dead=true;const b=G.state.boss;b.phase=3;b.v014LastPhase=3;b.v014GuardMax=5;b.v014Guard=5;b.v014PunishTimer=0;b.state='telegraph';b.telegraph=.5;b.clock=.5;const shotsBefore=G.state.shots.length;const guard=[];for(let i=0;i<5;i++){b.state='telegraph';b.telegraph=.5;G.fn.damageBoss(0,null,{arc:true,melee:true,attack:{dashCancelled:true}});guard.push(b.v014Guard)}G.fn.render();const opened=window.SylvariaBossFlow.snapshot(),presentation=window.SylvariaFlowPresentation.snapshot(),hp=b.hp;G.fn.damageBoss(1,{x:1,y:0},{arc:true,melee:true});const bladeDamage=hp-b.hp;return{guard,opened,presentation,bladeDamage,shotsBefore,shotsAfter:G.state.shots.length,state:b.state,telegraph:b.telegraph}});
check(JSON.stringify(boss.guard)===JSON.stringify([4,3,2,1,0]),`boss guard did not break deterministically: ${JSON.stringify(boss.guard)}`);
check(boss.opened.boss?.punishTimer>0&&boss.state==='recover'&&boss.telegraph===0,`boss core did not open cleanly: ${JSON.stringify(boss)}`);
check(boss.bladeDamage>1.3,`open-core blade did not receive punish multiplier: ${boss.bladeDamage}`);
check(boss.shotsAfter===boss.shotsBefore,'boss guard break deleted live projectiles');
check(boss.presentation.bossCues>=1,'boss guard/opening had no entity-local presentation cue');

// Deep encounter pressure must arrive as a phrase rather than a same-tick pile.
const threatSetup=await page.evaluate(()=>{const play=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091;play.setRoom(28,29);play.labClearGeometry();play.setPlayerPosition(300,330);const keep=[];for(const kind of['skimmer','strider','sniper','shellback']){const e=G.state.enemies.find(x=>x.kineticType===kind&&!keep.includes(x.id));if(e)keep.push(e.id)}for(const e of G.state.enemies){if(!keep.includes(e.id)){e.dead=true;continue}e.state='move';e.clock=.00001;e.telegraph=0;e.kineticEvade=null;e.evade=null;e.counterStagger=0;e.arcDodgeCooldown=99;e.v014PunishTimer=0}return{ids:keep,profile:window.SylvariaThreatManager.snapshot().profile}});
check(threatSetup.ids.length===4,`room 29 did not expose four kinetic roles: ${JSON.stringify(threatSetup)}`);
const threat=await waitForValue(()=>{const s=window.SylvariaThreatManager.snapshot();return s.releases.length>=4?{profile:s.profile,releases:s.releases.slice(-4)}:false},null,2600);
const roles=threat.releases.map(r=>r.role),gaps=threat.releases.slice(1).map((r,i)=>r.tick-threat.releases[i].tick);
check(JSON.stringify(roles)===JSON.stringify(['coverage','engage','precision','heavy']),`deep call-and-response order failed: ${JSON.stringify(roles)}`);
check(gaps.every(g=>g>=threat.profile.gapMin&&g<=threat.profile.gapMax),`deep threat gaps escaped room cadence: ${JSON.stringify({gaps,profile:threat.profile})}`);
check(new Set(threat.releases.map(r=>r.tick)).size===4,'heavy commitments collided on the same simulation tick');

// Leave an action-state beauty fixture showing the real production stack.
await page.evaluate(()=>{const play=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091,p=G.state.player;play.setRoom(1,2);play.labClearGeometry();play.setPlayerPosition(390,350);for(const e of G.state.enemies)if(e.kineticType!=='strider')e.dead=true;G.state.slashes=[];p.cutCooldown=0;p.flow=78;G.fn.cut('right')});
await page.waitForFunction(()=>window.Sylvaria091.state.slashes.at(-1)?.phase==='active',{timeout:900});
await page.evaluate(()=>window.Sylvaria091.fn.render());
await page.screenshot({path:path.join(outputDir,'production-v014-unified-rig.png'),fullPage:true});

for(const error of pageErrors)failures.push(`pageerror: ${error}`);
const report={boot,rigDirections,movingSample,refund:{setup:refundSetup,result:refund},boss,threat:{...threat,roles,gaps},failures};fs.writeFileSync(path.join(outputDir,'production-report.json'),JSON.stringify(report,null,2));
await browser.close();
if(failures.length){console.error(`Sylvaria v0.14 production integration failed with ${failures.length} issue(s):`);for(const failure of failures)console.error(` - ${failure}`);process.exit(1)}
console.log(`Sylvaria v0.14 production PASS · unified frog/tongue rig in 4 directions and motion · exact ${(refund.receipt.refund*1000).toFixed(0)} ms parry refund · boss guard ${boss.guard.join('→')} with core punish · room 29 ${roles.join(' → ')} at ${gaps.join('/')} tick gaps · ranked v0.13 submission safely disabled.`);