import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot=process.env.PLAYWRIGHT_MODULE_ROOT;if(!playwrightRoot)throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright=createRequire(path.join(playwrightRoot,'package.json'));const{chromium}=requireFromPlaywright('playwright');
const baseUrl=process.env.SYLVARIA_BASE_URL||'http://127.0.0.1:3000',outputDir=process.env.SYLVARIA_COMPETITIVE_DIR||'artifacts/sylvaria-competitive';fs.mkdirSync(outputDir,{recursive:true});
const failures=[];const assert=(condition,message)=>{if(!condition)failures.push(message)};
const browser=await chromium.launch({headless:true});

// Unconfigured deployment: local play must remain immediate and controls must stay sane.
{
  const page=await browser.newPage({viewport:{width:1280,height:900}});let ticketRequests=0;
  await page.route('**/api/sylvaria/run-ticket',async route=>{ticketRequests++;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ranked:false,configured:false,error:'not configured'})})});
  await page.goto(`${baseUrl}/game-runtimes/mosslight-v2/index.html?competitive-local=1`,{waitUntil:'networkidle'});
  await page.evaluate(()=>localStorage.removeItem('sid.sylvaria.controls.v011'));
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__MOSSLIGHT_PLAYTEST__?.version==='0.11.1'&&window.SylvariaCompetitive&&window.SylvariaCoach&&window.SylvariaInputGuard);
  const before=await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.snapshot());
  const startedAt=Date.now();await page.click('#start');await page.waitForFunction(()=>window.__MOSSLIGHT_PLAYTEST__.snapshot().mode==='playing');
  assert(Date.now()-startedAt<700,'start run waited on ranked network work');
  await page.locator('#c').focus();await page.keyboard.press('d');await page.waitForTimeout(120);const moved=await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.snapshot());
  assert((moved.player?.x??0)>(before.player?.x??0)+20,'movement did not respond while ranked ticket request was failing');
  await page.waitForFunction(()=>window.SylvariaCompetitive.snapshot().current?.ticketError,{timeout:1200});
  assert(ticketRequests===1,`normal run should request one ranked ticket, saw ${ticketRequests}`);

  await page.keyboard.press('p');assert(await page.evaluate(()=>window.Sylvaria091.state.mode)==='paused','P did not pause');
  await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'p',repeat:true,bubbles:true})));
  assert(await page.evaluate(()=>window.Sylvaria091.state.mode)==='paused','repeat P unexpectedly resumed the game');
  await page.keyboard.press('p');assert(await page.evaluate(()=>window.Sylvaria091.state.mode)==='playing','second intentional P did not resume');
  const muted=await page.evaluate(()=>window.Sylvaria091.state.muted);
  await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'m',repeat:true,bubbles:true})));
  assert(await page.evaluate(()=>window.Sylvaria091.state.muted)===muted,'repeat M changed mute state');

  await page.evaluate(()=>window.Sylvaria091.fn.endRun('test complete'));await page.waitForFunction(()=>!document.getElementById('gameOver')?.classList.contains('hidden'));
  await page.waitForFunction(()=>document.getElementById('rankedState')?.textContent?.includes('local run'));
  assert((await page.locator('#runDelta').textContent())!=='','post-run personal feedback was empty');
  await page.screenshot({path:path.join(outputDir,'local-fallback.png')});
  await page.close();
}

// Learn Controls: keyboard navigation must activate the focused control exactly once and never request a ranked ticket.
{
  const page=await browser.newPage({viewport:{width:1280,height:900}});let ticketRequests=0;
  await page.route('**/api/sylvaria/run-ticket',async route=>{ticketRequests++;await route.fulfill({status:503,contentType:'application/json',body:'{}'})});
  await page.goto(`${baseUrl}/game-runtimes/mosslight-v2/index.html?coach=1`,{waitUntil:'networkidle'});await page.evaluate(()=>localStorage.removeItem('sid.sylvaria.controls.v011'));await page.reload({waitUntil:'networkidle'});
  await page.locator('#explore').focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.SylvariaCoach?.snapshot().enabled===true&&window.__MOSSLIGHT_PLAYTEST__.snapshot().mode==='playing');
  await page.locator('#c').focus();await page.keyboard.press('d');await page.waitForFunction(()=>window.SylvariaCoach.snapshot().stage>=1);await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>window.SylvariaCoach.snapshot().stage>=2);
  await page.evaluate(()=>{const p=window.__MOSSLIGHT_PLAYTEST__;p.setRoom(1,2);p.clearCombatants();p.spawnCounterShot('right',72,{speed:180})});await page.waitForTimeout(40);await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>window.SylvariaCoach.snapshot().stage===4,{timeout:1800});
  assert(ticketRequests===0,`learn controls must not request ranked tickets, saw ${ticketRequests}`);
  assert(await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.snapshot().mode)==='playing','focused Enter did not remain in Learn Controls mode');
  await page.screenshot({path:path.join(outputDir,'action-coach.png')});await page.close();
}

// Mocked ranked deployment: targets render and a completed replay posts without blocking play.
{
  const page=await browser.newPage({viewport:{width:1280,height:900}});let posted=false,submitBody=null,ticketRequests=0;
  const firstBoard={configured:true,engineVersion:'0.11.1',engineHash:'a'.repeat(64),seed:110001,entries:[{displayName:'north',score:14200,worldDepth:21,durationTicks:54000,verificationProof:'p1'},{displayName:'lane',score:11340,worldDepth:18,durationTicks:47000,verificationProof:'p2'},{displayName:'cut',score:9900,worldDepth:16,durationTicks:41000,verificationProof:'p3'}]};
  await page.route('**/api/sylvaria/leaderboard',async route=>{const data=posted?{...firstBoard,entries:[{displayName:'tester',score:321,worldDepth:1,durationTicks:60,verificationProof:'posted-proof'},...firstBoard.entries]}:firstBoard;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})});
  await page.route('**/api/sylvaria/run-ticket',async route=>{ticketRequests++;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ranked:true,configured:true,ticket:'mock.ticket.value.abcdefghijklmnopqrstuvwxyz',engineVersion:'0.11.1',engineHash:'a'.repeat(64),seed:110001,expiresAt:Date.now()+600000})})});
  await page.route('**/api/sylvaria/leaderboard/submit',async route=>{submitBody=JSON.parse(route.request().postData()||'{}');posted=true;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({configured:true,verified:true,score:submitBody.claimedScore,worldDepth:1,durationTicks:submitBody.replay?.durationTicks||1,replayHash:'b'.repeat(64),stateHash:'c'.repeat(64),verificationProof:'posted-proof'})})});
  await page.goto(`${baseUrl}/game-runtimes/mosslight-v2/index.html?competitive-mock=1`,{waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelectorAll('#rankRows li').length>=3);
  const firstRankText=await page.locator('#rankRows li').first().textContent();assert(firstRankText?.includes('north'),'leaderboard target did not render');
  await page.locator('#start').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>window.SylvariaCompetitive.snapshot().current?.ticketReady===true);assert(ticketRequests===1,`focused Start Enter should issue one ticket, saw ${ticketRequests}`);
  await page.waitForTimeout(550);await page.evaluate(()=>window.Sylvaria091.fn.endRun('test complete'));await page.waitForFunction(()=>document.getElementById('rankedState')?.textContent==='ranked replay ready');
  await page.fill('#rankName','tester');await page.click('#submitRank');await page.waitForFunction(()=>document.getElementById('rankedState')?.textContent?.includes('verified'));
  assert(submitBody?.replay?.engineVersion==='0.11.1','posted replay did not use current engine version');
  assert(Number.isInteger(submitBody?.claimedScore),'posted score was not an integer');
  assert((await page.locator('#rankedState').textContent())==='verified · #1','post-submit rank resolution failed');
  await page.screenshot({path:path.join(outputDir,'verified-rank.png')});await page.close();
}

await browser.close();fs.writeFileSync(path.join(outputDir,'report.json'),JSON.stringify({failures},null,2));
if(failures.length){console.error(`Sylvaria competitive UX failed with ${failures.length} issue(s):`);for(const failure of failures)console.error(` - ${failure}`);process.exit(1)}
console.log('Sylvaria v0.11.1 competitive UX PASS: instant local start, graceful ranked fallback, repeat-safe pause/mute, keyboard-safe menu activation, action-driven coaching, practice isolation, leaderboard targets, replay posting, and rank resolution verified.');
