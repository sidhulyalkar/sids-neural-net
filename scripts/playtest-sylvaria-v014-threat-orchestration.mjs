import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot=process.env.PLAYWRIGHT_MODULE_ROOT;if(!playwrightRoot)throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright=createRequire(path.join(playwrightRoot,'package.json'));const{chromium}=requireFromPlaywright('playwright');
const baseUrl=process.env.SYLVARIA_BASE_URL||'http://127.0.0.1:3000',outputDir=process.env.SYLVARIA_THREAT_DIR||'artifacts/sylvaria-v014-threat';fs.mkdirSync(outputDir,{recursive:true});
const failures=[];const check=(ok,message)=>{if(!ok)failures.push(message)};
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}});const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
async function waitForValue(fn,arg=null,timeout=1800){const handle=await page.waitForFunction(fn,arg,{timeout});try{return await handle.jsonValue()}finally{await handle.dispose()}}

await page.goto(`${baseUrl}/game-runtimes/mosslight-v2/index.html?threat-lab=1`,{waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__MOSSLIGHT_PLAYTEST__?.version==='0.13.0'&&window.SylvariaKinetics?.version==='0.13.0'&&window.SylvariaKineticAI?.version==='0.13.0');
await page.click('#start');await page.locator('#c').focus();
await page.evaluate(async()=>{
  await import('/game-runtimes/mosslight-v2/v014/combat-flow-v014.js');
  await import('/game-runtimes/mosslight-v2/v014/enemy-flow-v014.js');
  await import('/game-runtimes/mosslight-v2/v014/threat-manager-v014.js');
});
await page.waitForFunction(()=>window.SylvariaFlowCombat?.version==='0.14.0'&&window.SylvariaEnemyFlow?.version==='0.14.0'&&window.SylvariaThreatManager?.version==='0.14.0');

// All 30 fixed rooms carry explicit authored scheduler profiles.
const profiles=await page.evaluate(()=>window.SylvariaThreatManager.profiles.map((p,i)=>({room:i+1,...p})));
check(profiles.length===30,`expected 30 threat profiles, saw ${profiles.length}`);
check(profiles.every(p=>p.gapMin>=6&&p.gapMax<=12&&p.gapMin<=p.gapMax),'a room escaped the six-to-twelve tick telegraph cadence');
check(profiles[0].gapMin>profiles[10].gapMin&&profiles[10].gapMin>profiles[20].gapMin,`act cadence did not tighten across rooms 1/11/21: ${JSON.stringify([profiles[0],profiles[10],profiles[20]])}`);
check(profiles[0].budget<profiles[10].budget&&profiles[10].budget<profiles[28].budget,`phrase budget did not escalate across the roster: ${JSON.stringify([profiles[0],profiles[10],profiles[28]])}`);

// Room 29 is the maximum mixed fixed encounter. Force one kinetic enemy of each role ready on the same tick.
const mixedSetup=await page.evaluate(()=>{
  const play=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091;play.setRoom(28,29);play.labClearGeometry();play.setPlayerPosition(300,330);
  const keep=new Set();
  for(const kind of['skimmer','strider','sniper','shellback']){const e=G.state.enemies.find(x=>x.kineticType===kind&&!keep.has(x.id));if(e)keep.add(e.id)}
  for(const e of G.state.enemies){if(!keep.has(e.id)){e.dead=true;continue}e.state='move';e.clock=.00001;e.telegraph=0;e.kineticEvade=null;e.evade=null;e.counterStagger=0;e.arcDodgeCooldown=99;e.v014PunishTimer=0}
  return{ids:[...keep],profile:window.SylvariaThreatManager.snapshot().profile};
});
check(mixedSetup.ids.length===4,`room 29 did not expose all four kinetic roles: ${JSON.stringify(mixedSetup)}`);
const mixed=await waitForValue(()=>{const s=window.SylvariaThreatManager.snapshot();return s.releases.length>=4?{tick:s.tick,releases:s.releases.slice(-4),profile:s.profile}:false},null,2400);
const mixedRoles=mixed.releases.map(r=>r.role),mixedGaps=mixed.releases.slice(1).map((r,i)=>r.tick-mixed.releases[i].tick);
check(JSON.stringify(mixedRoles)===JSON.stringify(['coverage','engage','precision','heavy']),`room 29 call-and-response order was ${JSON.stringify(mixedRoles)}`);
check(mixedGaps.every(g=>g>=mixed.profile.gapMin&&g<=mixed.profile.gapMax),`room 29 stagger gaps escaped profile ${JSON.stringify({mixedGaps,profile:mixed.profile,releases:mixed.releases})}`);
check(new Set(mixed.releases.map(r=>r.tick)).size===mixed.releases.length,'multiple heavy telegraphs released on the same authoritative tick');

// Live queue proof: a Strider becoming ready after the lead Skimmer must take the response beat ahead of a second waiting Skimmer.
const liveQueueSetup=await page.evaluate(()=>{
  const play=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091;play.setRoom(28,29);play.labClearGeometry();play.setPlayerPosition(300,330);
  const skimmers=G.state.enemies.filter(e=>e.kineticType==='skimmer').slice(0,2),strider=G.state.enemies.find(e=>e.kineticType==='strider');const keep=new Set([...skimmers.map(e=>e.id),strider?.id].filter(Boolean));
  for(const e of G.state.enemies){if(!keep.has(e.id)){e.dead=true;continue}e.state='move';e.telegraph=0;e.kineticEvade=null;e.evade=null;e.counterStagger=0;e.arcDodgeCooldown=99;e.v014PunishTimer=0;e.clock=e===strider?99:.00001}
  return{skimmerIds:skimmers.map(e=>e.id),striderId:strider?.id||null,profile:window.SylvariaThreatManager.snapshot().profile};
});
check(liveQueueSetup.skimmerIds.length===2&&Boolean(liveQueueSetup.striderId),`late responder setup incomplete: ${JSON.stringify(liveQueueSetup)}`);
const leadCoverage=await waitForValue(()=>{const s=window.SylvariaThreatManager.snapshot();return s.releases.length>=1?{count:s.releases.length,release:s.releases.at(-1),gateTick:s.gateTick}:false},null,1200);
check(leadCoverage.release.role==='coverage',`lead beat was not coverage: ${JSON.stringify(leadCoverage)}`);
await page.evaluate(id=>{const e=window.Sylvaria091.state.enemies.find(x=>x.id===id);if(e)e.clock=.00001},liveQueueSetup.striderId);
const lateResponse=await waitForValue(base=>{const s=window.SylvariaThreatManager.snapshot();if(s.releases.length<=base)return false;return{releases:s.releases.slice(-2),queue:s.queue,tick:s.tick}},leadCoverage.count,1500);
check(lateResponse.releases[0].role==='coverage'&&lateResponse.releases[1].role==='engage',`late Strider failed to steal response beat: ${JSON.stringify(lateResponse)}`);
check(lateResponse.releases[1].id===liveQueueSetup.striderId,`response beat went to wrong engage actor: ${JSON.stringify(lateResponse)}`);

// Room 1 only permits a small two-beat phrase. A third heavy request must cross a real phrase rest.
const earlySetup=await page.evaluate(()=>{
  const play=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091;play.setRoom(0,1);play.clearCombatants();play.labClearGeometry();play.setPlayerPosition(300,330);
  const ids=[play.spawnTestEnemy('drone',610,250,'threat-coverage'),play.spawnTestEnemy('skidder',610,330,'threat-engage'),play.spawnTestEnemy('foreman',610,410,'threat-precision')];
  for(const id of ids){const e=G.state.enemies.find(x=>x.id===id);e.state='move';e.clock=.00001;e.telegraph=0;e.evade=null;e.counterStagger=0;e.evadeCooldown=99}
  return{ids,profile:window.SylvariaThreatManager.snapshot().profile};
});
const early=await waitForValue(()=>{const s=window.SylvariaThreatManager.snapshot();return s.releases.length>=3?{tick:s.tick,releases:s.releases.slice(-3),profile:s.profile}:false},null,3000);
const earlyGaps=early.releases.slice(1).map((r,i)=>r.tick-early.releases[i].tick);
check(earlyGaps[0]>=early.profile.gapMin&&earlyGaps[0]<=early.profile.gapMax,`room 1 first duet gap invalid: ${JSON.stringify({earlyGaps,early})}`);
check(earlyGaps[1]>=early.profile.gapMin+early.profile.restTicks,`room 1 third threat did not cross a phrase rest: ${JSON.stringify({earlyGaps,profile:early.profile,releases:early.releases})}`);

// Final boss and support pressure share the same phrase budget instead of independent clocks.
const bossSetup=await page.evaluate(()=>{
  const play=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091;play.setRoom(29,30);play.labClearGeometry();play.setPlayerPosition(300,330);
  const support=G.state.enemies.find(e=>e.kineticType==='skimmer');
  for(const e of G.state.enemies){if(e!==support)e.dead=true}
  if(support){support.state='move';support.clock=.00001;support.telegraph=0;support.kineticEvade=null;support.evade=null;support.counterStagger=0;support.arcDodgeCooldown=99}
  const b=G.state.boss;if(b){b.dead=false;b.state='move';b.clock=.00001;b.telegraph=0;b.counterStagger=0;b.recover=0}
  return{supportId:support?.id||null,bossId:b?.id||null,profile:window.SylvariaThreatManager.snapshot().profile};
});
check(Boolean(bossSetup.supportId&&bossSetup.bossId),`final boss coordination setup incomplete: ${JSON.stringify(bossSetup)}`);
const bossPhrase=await waitForValue(()=>{const s=window.SylvariaThreatManager.snapshot();return s.releases.length>=2?{tick:s.tick,releases:s.releases.slice(-2),profile:s.profile}:false},null,2200);
const bossGap=bossPhrase.releases[1].tick-bossPhrase.releases[0].tick;
check(bossPhrase.releases.some(r=>r.boss===true&&r.role==='heavy'),`boss never entered heavy threat budget: ${JSON.stringify(bossPhrase)}`);
check(bossPhrase.releases.some(r=>r.role==='coverage'),`support coverage never entered boss phrase: ${JSON.stringify(bossPhrase)}`);
check(bossGap>=bossPhrase.profile.gapMin&&bossGap<=bossPhrase.profile.gapMax,`boss/support telegraphs did not share final-room cadence: ${JSON.stringify({bossGap,bossPhrase})}`);
check(bossPhrase.releases[0].tick!==bossPhrase.releases[1].tick,'boss and support telegraphed on the same authoritative tick');

// A newly opened post-evade punish window gates the live waiting queue once, without erasing pressure already in flight.
const graceSetup=await page.evaluate(()=>{
  const play=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091;play.setRoom(28,29);play.labClearGeometry();play.setPlayerPosition(300,330);
  const selected=G.state.enemies.filter(e=>e.kineticType).slice(0,4);for(const e of G.state.enemies){if(!selected.includes(e)){e.dead=true;continue}e.state='move';e.clock=.00001;e.telegraph=0;e.kineticEvade=null;e.evade=null;e.counterStagger=0;e.arcDodgeCooldown=99;e.v014PunishTimer=0}
  return selected.map(e=>e.id);
});
const queueBeforeGrace=await waitForValue(()=>{const s=window.SylvariaThreatManager.snapshot();return s.releases.length>=1&&s.queue.filter(item=>!item.armed).length>=2?{tick:s.tick,gateTick:s.gateTick,queue:s.queue,releases:s.releases}:false},null,1600);
await page.evaluate(id=>{const e=window.Sylvaria091.state.enemies.find(x=>x.id===id);if(e)e.v014PunishTimer=30/120},graceSetup.at(-1));
const grace=await waitForValue(()=>{const s=window.SylvariaThreatManager.snapshot();if(!s.punishWindowActive||s.punishGraceUntil<=s.tick||!s.queue.length)return false;return{tick:s.tick,gateTick:s.gateTick,punishGraceUntil:s.punishGraceUntil,queue:s.queue,releases:s.releases}},null,900);
check(grace.gateTick>=grace.punishGraceUntil,`fresh punish window did not move the threat gate: ${JSON.stringify(grace)}`);
check(grace.queue.every(item=>!item.armed),`a new queued threat armed inside punish grace: ${JSON.stringify(grace.queue)}`);
check(grace.releases.length===queueBeforeGrace.releases.length,'punish grace deleted or admitted pressure on its opening edge');
check((grace.punishGraceUntil-grace.tick)<=mixed.profile.punishGraceTicks+1,'punish grace became a sliding invulnerability window');
const firstAfterGrace=await waitForValue(base=>{const s=window.SylvariaThreatManager.snapshot();if(s.releases.length<=base.count)return false;return{release:s.releases.at(-1),tick:s.tick,graceUntil:base.graceUntil}}, {count:queueBeforeGrace.releases.length,graceUntil:grace.punishGraceUntil},1800);
check(firstAfterGrace.release.tick>=grace.punishGraceUntil,`next telegraph escaped punish grace: ${JSON.stringify(firstAfterGrace)}`);

for(const error of pageErrors)failures.push(`pageerror: ${error}`);
await page.screenshot({path:path.join(outputDir,'rhythmic-threat-orchestration-v014.png'),fullPage:true});
const report={profiles,mixedSetup,mixed:{...mixed,roles:mixedRoles,gaps:mixedGaps},liveQueue:{setup:liveQueueSetup,lead:leadCoverage,response:lateResponse},earlySetup,early:{...early,gaps:earlyGaps},boss:{setup:bossSetup,phrase:bossPhrase,gap:bossGap},grace:{before:queueBeforeGrace,open:grace,firstAfterGrace},failures};
fs.writeFileSync(path.join(outputDir,'threat-report.json'),JSON.stringify(report,null,2));
await browser.close();
if(failures.length){console.error(`Sylvaria v0.14 threat orchestration failed with ${failures.length} issue(s):`);for(const failure of failures)console.error(` - ${failure}`);process.exit(1)}
console.log(`Sylvaria v0.14 threat orchestration PASS · 30 authored profiles · room 29 ${mixedRoles.join(' → ')} at ${mixedGaps.join('/')} tick gaps · late Strider stole response beat · room 1 phrase break ${earlyGaps[1]} ticks · boss/support gap ${bossGap} ticks · punish grace gate verified.`);
