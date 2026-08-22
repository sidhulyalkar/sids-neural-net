import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot = process.env.PLAYWRIGHT_MODULE_ROOT;
if (!playwrightRoot) throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright = createRequire(path.join(playwrightRoot, 'package.json'));
const { chromium } = requireFromPlaywright('playwright');
const baseUrl = process.env.SYLVARIA_BASE_URL || 'http://127.0.0.1:3000';
const outputDir = process.env.SYLVARIA_SYNERGY_DIR || 'artifacts/sylvaria-synergy';
fs.mkdirSync(outputDir, { recursive: true });
const failures = [], consoleErrors = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
const snap = () => page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.snapshot());
const setRoom = (depth) => page.evaluate((d) => window.__MOSSLIGHT_PLAYTEST__.setRoom((d - 1) % 30, d), depth);
const cleanLab = async (depth = 1) => page.evaluate((d) => { const p=window.__MOSSLIGHT_PLAYTEST__; p.setRoom((d-1)%30,d); p.clearCombatants(); p.labClearGeometry(); }, depth);

await page.goto(`${baseUrl}/game-runtimes/mosslight-v2/index.html?interaction-lab=1`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__MOSSLIGHT_PLAYTEST__?.version === '0.11.1' && window.SylvariaSynergy?.version === '0.10.0');
await page.click('#start');
await page.waitForFunction(() => window.__MOSSLIGHT_PLAYTEST__.snapshot().mode === 'playing');

// 1. A real wave-origin reflect physically crosses a poison mushroom and blooms gas.
await cleanLab(4);
const returnSetup = await page.evaluate(() => {
  const p=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091;
  p.setPlayerPosition(190,320);
  p.spawnTestEnemy('foreman',780,320,'wave-source');
  p.placeMushroom('venomcap',360,320);
  const mushroom=G.state.mushrooms.at(-1);
  p.spawnCounterShot('right',68,{ownerId:'wave-source',speed:180});
  const shot=G.state.shots.at(-1); shot.pattern='wave'; shot.patternAmp=36; shot.patternFreq=7;
  return { mushroomId:mushroom.id, before:window.SylvariaSynergy.snapshot() };
});
await page.locator('#c').focus();
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(210);
const returnEcology = await page.evaluate((id) => {
  const G=window.Sylvaria091,m=G.state.mushrooms.find(x=>x.id===id),gas=G.state.gasClouds.at(-1);
  return { mushroomCut:m?.cut, gasMaxR:gas?.maxR, gasR:gas?.r, gasLife:gas?.maxLife, synergy:window.SylvariaSynergy.snapshot(), stats:G.state.stats };
}, returnSetup.mushroomId);
assert(returnEcology.mushroomCut, 'wave-origin reflected projectile did not trigger poison mushroom');
assert(returnEcology.synergy.mushroomReturns > returnSetup.before.mushroomReturns, 'return-mushroom interaction was not recorded');
assert(returnEcology.gasMaxR > 64, `wave-origin toxic bloom was not amplified beyond base radius: ${returnEcology.gasMaxR}`);

// 2. Gas shearing requires a committed dash-cut and moves the actual cloud.
await cleanLab(4);
const shearSetup = await page.evaluate(() => {
  const p=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091;
  p.setPlayerPosition(220,320); p.placeMushroom('venomcap',252,320);
  const m=G.state.mushrooms.at(-1); p.triggerMushroom(m.id);
  const gas=G.state.gasClouds.at(-1);
  return { id:gas.id, x:gas.x, maxR:gas.maxR, shears:window.SylvariaSynergy.snapshot().gasShears };
});
await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.dash('right'));
await page.waitForTimeout(18);
await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.cut('right'));
await page.waitForTimeout(95);
const shearAfter = await page.evaluate((id) => { const g=window.Sylvaria091.state.gasClouds.find(x=>x.id===id); return { x:g?.x, maxR:g?.maxR, synergy:window.SylvariaSynergy.snapshot() }; }, shearSetup.id);
assert((shearAfter.x ?? shearSetup.x) > shearSetup.x + 14, `committed right dash-cut did not directionally shear gas: ${shearSetup.x} -> ${shearAfter.x}`);
assert(shearAfter.synergy.gasShears > shearSetup.shears, 'gas shear was not recorded');

// 3. Gas is real unsafe evade space and has a measurable hazard score.
await cleanLab(7);
const hazardSpace = await page.evaluate(() => {
  const p=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091;
  p.setPlayerPosition(180,320); p.placeMushroom('venomcap',500,320); const m=G.state.mushrooms.at(-1); p.triggerMushroom(m.id);
  const gas=G.state.gasClouds.at(-1);
  return {
    gas:{x:gas.x,y:gas.y,r:gas.r},
    score:window.SylvariaSynergy.hazardScoreAt(gas.x,gas.y,{type:'surveyor',r:15}),
    safeInGas:G.fn.evadeDestinationSafe(gas.x,gas.y,15),
    safeAway:G.fn.evadeDestinationSafe(760,500,15),
  };
});
assert(hazardSpace.score > 5, `active gas did not produce meaningful hazard score: ${hazardSpace.score}`);
assert(hazardSpace.safeInGas === false, 'gas-filled destination was still accepted as safe evade space');
assert(hazardSpace.safeAway === true, 'clean remote destination was unexpectedly rejected');

// 4. Cautious AI should reduce predictive local hazard score during ordinary movement.
await cleanLab(7);
const steerBefore = await page.evaluate(() => {
  const p=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091;
  p.setPlayerPosition(180,320); p.placeMushroom('venomcap',500,320); const m=G.state.mushrooms.at(-1); p.triggerMushroom(m.id);
  p.spawnTestEnemy('foreman',500,320,'hazard-aware-foreman');
  const e=G.state.enemies.find(x=>x.id==='hazard-aware-foreman'); e.state='move'; e.clock=99; e.telegraph=0; e.evade=null; e.evadeCooldown=99;
  return { x:e.x,y:e.y,score:window.SylvariaSynergy.hazardScoreAt(e.x,e.y,e) };
});
await page.waitForTimeout(330);
const steerAfter = await page.evaluate(() => { const G=window.Sylvaria091,e=G.state.enemies.find(x=>x.id==='hazard-aware-foreman'); return { x:e?.x,y:e?.y,score:e?window.SylvariaSynergy.hazardScoreAt(e.x,e.y,e):null }; });
assert(steerAfter.score !== null && steerAfter.score < steerBefore.score, `cautious enemy did not reduce hazard score: ${steerBefore.score} -> ${steerAfter.score}`);

// 5. The first boss bulldozes overlapping route geometry without minting player loot.
await setRoom(10);
const bulldozeBefore = await page.evaluate(() => {
  const G=window.Sylvaria091,b=G.state.boss;
  G.state.brittle.push({id:'boss-lab-rubble',x:b.x+3,y:b.y,r:18,hp:2,dead:false,angle:0,phase:0,secret:false});
  return { room:G.state.room.title, discoveries:G.state.stats.discoveries, pickups:G.state.pickups.length, bulldozes:G.state.stats.bossBulldozes||0 };
});
await page.waitForTimeout(80);
const bulldozeAfter = await page.evaluate(() => { const G=window.Sylvaria091; return { dead:G.state.brittle.find(x=>x.id==='boss-lab-rubble')?.dead, discoveries:G.state.stats.discoveries, pickups:G.state.pickups.length, bulldozes:G.state.stats.bossBulldozes||0 }; });
assert(bulldozeBefore.room === 'Surveyor', `room 10 should be Surveyor, got ${bulldozeBefore.room}`);
assert(bulldozeAfter.dead, 'boss did not bulldoze overlapping brittle rubble');
assert(bulldozeAfter.bulldozes > bulldozeBefore.bulldozes, 'boss bulldoze was not recorded');
assert(bulldozeAfter.discoveries === bulldozeBefore.discoveries && bulldozeAfter.pickups === bulldozeBefore.pickups, 'boss bulldoze incorrectly generated player exploration rewards');

// 6. Three real perfect reflects at high Flow activate the inherited short flow state while return speed stays protected.
await cleanLab(2);
await page.evaluate(() => {
  const p=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091;
  p.setPlayerPosition(190,320); G.state.player.flow=80;
  p.spawnTestEnemy('mech',900,120,'flow-anchor');
  const anchor=G.state.enemies.find(x=>x.id==='flow-anchor'); anchor.state='recover'; anchor.clock=99; anchor.counterStagger=99;
});
const perfectSpeeds=[];
for(let i=0;i<3;i++){
  await page.evaluate(() => window.__MOSSLIGHT_PLAYTEST__.spawnCounterShot('right',68,{speed:180}));
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(24);
  const speed=await page.evaluate(() => { const s=window.Sylvaria091.state.shots.find(x=>x.friendly); return s?.speed ?? Math.hypot(s?.vx||0,s?.vy||0); });
  perfectSpeeds.push(speed);
  await page.waitForTimeout(205);
}
const flowState = await page.evaluate(() => ({ synergy:window.SylvariaSynergy.snapshot(), perfectCounters:window.Sylvaria091.state.stats.perfectCounters, flow:window.Sylvaria091.state.player.flow }));
assert(perfectSpeeds.every((speed)=>speed>=1000&&speed<=1080), `high-Flow qualification altered protected perfect-return speed: ${JSON.stringify(perfectSpeeds)}`);
assert(flowState.perfectCounters >= 3, `three perfect reflects were not recorded: ${flowState.perfectCounters}`);
assert(flowState.synergy.verdantTimer > 0 && flowState.synergy.flowActivations > 0, `real perfect-reflect chain did not activate flow state: ${JSON.stringify(flowState)}`);

// 7. Threat-priority calculation produces one imminent hostile priority without changing projectiles.
await cleanLab(2);
const threat = await page.evaluate(() => {
  const p=window.__MOSSLIGHT_PLAYTEST__;
  p.setPlayerPosition(220,320); p.spawnCounterShot('right',150,{speed:180}); p.spawnCounterShot('right',78,{speed:260});
  return window.SylvariaSynergy.snapshot();
});
assert(Number.isFinite(threat.threatTti) && threat.threatTti > 0, `nearest-threat selector did not produce time-to-impact: ${JSON.stringify(threat)}`);

await page.waitForTimeout(500);
const final = await snap();
assert(final.shots.length <= 128 && final.pendingShots <= 72, `projectile caps violated under interaction load: ${final.shots.length}/${final.pendingShots}`);
assert(final.fps >= 42, `interaction lab FPS below 42: ${final.fps.toFixed(1)}`);
await page.screenshot({ path:path.join(outputDir,'v0111-interaction-lab.png'), fullPage:true });
await setRoom(10); await page.waitForTimeout(900); await page.screenshot({ path:path.join(outputDir,'v0111-surveyor.png'), fullPage:true });

const report={ returnEcology,shearSetup,shearAfter,hazardSpace,steerBefore,steerAfter,bulldozeBefore,bulldozeAfter,perfectSpeeds,flowState,threat,final,consoleErrors,failures };
fs.writeFileSync(path.join(outputDir,'report-v0111-interactions.json'),JSON.stringify(report,null,2));
await browser.close();
if(consoleErrors.length)failures.push(...consoleErrors.map((e)=>`console error: ${e}`));
if(failures.length){console.error(`Sylvaria v0.11.1 interaction lab failed with ${failures.length} issue(s):`);for(const failure of failures)console.error(` - ${failure}`);process.exit(1)}
console.log(`Sylvaria v0.11.1 interaction lab PASS: return-triggered poison, committed gas shear, gas-aware evade space, cautious hazard steering, boss bulldoze without loot, real-event Flow activation, threat priority, protected projectile caps, and ${final.fps.toFixed(1)} FPS verified.`);