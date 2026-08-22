import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightRoot=process.env.PLAYWRIGHT_MODULE_ROOT;if(!playwrightRoot)throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFromPlaywright=createRequire(path.join(playwrightRoot,'package.json'));const{chromium}=requireFromPlaywright('playwright');
const baseUrl=process.env.SYLVARIA_BASE_URL||'http://127.0.0.1:3000',outputDir=process.env.SYLVARIA_COMPETITIVE_DIR||'artifacts/sylvaria-competitive';fs.mkdirSync(outputDir,{recursive:true});
const failures=[];const assert=(condition,message)=>{if(!condition)failures.push(message)};
const browser=await chromium.launch({headless:true});

// Unconfigured deployment: local play remains immediate while the new continuous controls stay responsive.
{
  const page=await browser.newPage({viewport:{width:1280,height:900}});let ticketRequests=0;
  await page.route('**/api/sylvaria/run-ticket',async route=>{ticketRequests++;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ranked:false,configured:false,error:'not configured'})})});
  await page.goto(`${baseUrl}/game-runtimes/mosslight-v2/index.html?competitive-local=1`,{waitUntil:'networkidle'});
  await page.evaluate(()=>localStorage.removeItem('sid.sylvaria.controls.v013'));
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__MOSSLIGHT_PLAYTEST__?.version==='0.13.0'&&window.SylvariaCompetitive&&window.SylvariaCoach?.version==='0.13.0'&&window.SylvariaInputGuard);
  await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.labClearGeometry());
  const before=await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.snapshot());
  const startedAt=Date.now();await page.click('#start');await page.waitForFunction(()=>window.__MOSSLIGHT_PLAYTEST__.snapshot().mode==='playing');
  assert(Date.now()-startedAt<700,'start run waited on ranked network work');
  await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.labClearGeometry());await page.locator('#c').focus();await page.keyboard.down('d');await page.waitForTimeout(190);await page.keyboard.up('d');const moved=await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.snapshot());
  assert((moved.player?.x??0)>(before.player?.x??0)+20,'continuous movement did not respond while ranked ticket request was failing');
  assert(moved.stats.dashes===before.stats.dashes,'ordinary held movement was incorrectly counted as a dash');
  await page.waitForFunction(()=>window.SylvariaCompetitive.snapshot().current?.ticketError,{timeout:1200});
  assert(ticketRequests===1,`normal run should request one ranked ticket, saw ${ticketRequests}`);
  assert(await page.locator('#targetWrap').isHidden(),'unconfigured leaderboard should not occupy the in-run target rail');

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
  await page.screenshot({path:path.join(outputDir,'local-fallback-v013.png')});
  await page.close();
}

// Learn Controls: glide + charge dash + sweep + reflect, with no ranked ticket request.
{
  const page=await browser.newPage({viewport:{width:1280,height:900}});let ticketRequests=0;
  await page.route('**/api/sylvaria/run-ticket',async route=>{ticketRequests++;await route.fulfill({status:503,contentType:'application/json',body:'{}'})});
  await page.goto(`${baseUrl}/game-runtimes/mosslight-v2/index.html?coach=1`,{waitUntil:'networkidle'});await page.evaluate(()=>localStorage.removeItem('sid.sylvaria.controls.v013'));await page.reload({waitUntil:'networkidle'});
  await page.locator('#explore').focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.SylvariaCoach?.snapshot().enabled===true&&window.__MOSSLIGHT_PLAYTEST__.snapshot().mode==='playing');
  await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.labClearGeometry());
  assert((await page.evaluate(()=>window.SylvariaCoach.snapshot())).forgiving===true,'Learn Controls did not enter forgiving practice state');
  await page.evaluate(()=>{const G=window.Sylvaria091;G.state.player.hp=0;for(const tree of G.state.trees){tree.alive=false;tree.hp=0}G.fn.endRun('forced practice failure')});
  const rescued=await page.evaluate(()=>({mode:window.Sylvaria091.state.mode,hp:window.Sylvaria091.state.player.hp,maxHp:window.Sylvaria091.state.player.maxHp,trees:window.Sylvaria091.state.trees.map(tree=>({alive:tree.alive,hp:tree.hp,maxHp:tree.maxHp}))}));
  assert(rescued.mode==='playing'&&rescued.hp===rescued.maxHp,'practice failure ended the session or did not restore health');
  assert(rescued.trees.every(tree=>tree.alive&&tree.hp===tree.maxHp),'practice failure did not restore protected lilies');

  await page.locator('#c').focus();await page.keyboard.down('d');await page.waitForTimeout(240);await page.keyboard.up('d');await page.waitForFunction(()=>window.SylvariaCoach.snapshot().stage>=1);
  await page.keyboard.down('Space');await page.waitForTimeout(260);await page.keyboard.up('Space');await page.waitForFunction(()=>window.SylvariaCoach.snapshot().stage>=2);
  await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>window.SylvariaCoach.snapshot().stage>=3);
  await page.evaluate(()=>{const p=window.__MOSSLIGHT_PLAYTEST__;p.setRoom(0,1);p.clearCombatants();p.labClearGeometry();p.setPlayerPosition(300,330);p.spawnCounterShot('right',70,{speed:180})});await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>window.SylvariaCoach.snapshot().stage===4,{timeout:1800});
  const learned=await page.evaluate(()=>window.SylvariaCoach.snapshot());
  assert(learned.forgiving===false,'practice forgiveness did not end after the first successful reflect');
  assert(ticketRequests===0,`learn controls must not request ranked tickets, saw ${ticketRequests}`);
  assert(await page.evaluate(()=>window.__MOSSLIGHT_PLAYTEST__.snapshot().mode)==='playing','focused Enter did not remain in Learn Controls mode');
  await page.screenshot({path:path.join(outputDir,'action-coach-v013.png')});await page.close();
}

// Mocked ranked deployment: one live target renders and a completed v0.13 replay can be posted.
{
  const page=await browser.newPage({viewport:{width:1280,height:900}});let posted=false,submitBody=null,ticketRequests=0;
  const firstBoard={configured:true,engineVersion:'0.13.0',engineHash:'a'.repeat(64),seed:110001,entries:[{displayName:'north',score:14200,worldDepth:21,durationTicks:54000,verificationProof:'p1'},{displayName:'lane',score:11340,worldDepth:18,durationTicks:47000,verificationProof:'p2'},{displayName:'cut',score:9900,worldDepth:16,durationTicks:41000,verificationProof:'p3'}]};
  await page.route('**/api/sylvaria/leaderboard',async route=>{const data=posted?{...firstBoard,entries:[{displayName:'tester',score:321,worldDepth:1,durationTicks:60,verificationProof:'posted-proof'},...firstBoard.entries]}:firstBoard;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})});
  await page.route('**/api/sylvaria/run-ticket',async route=>{ticketRequests++;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ranked:true,configured:true,ticket:'mock.ticket.value.abcdefghijklmnopqrstuvwxyz',engineVersion:'0.13.0',engineHash:'a'.repeat(64),seed:110001,expiresAt:Date.now()+600000})})});
  await page.route('**/api/sylvaria/leaderboard/submit',async route=>{submitBody=JSON.parse(route.request().postData()||'{}');posted=true;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({configured:true,verified:true,score:submitBody.claimedScore,worldDepth:1,durationTicks:submitBody.replay?.durationTicks||1,replayHash:'b'.repeat(64),stateHash:'c'.repeat(64),verificationProof:'posted-proof'})})});
  await page.goto(`${baseUrl}/game-runtimes/mosslight-v2/index.html?competitive-mock=1`,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__MOSSLIGHT_PLAYTEST__?.version==='0.13.0'&&document.querySelectorAll('#rankRows li').length>=3);
  const firstRankText=await page.locator('#rankRows li').first().textContent();assert(firstRankText?.includes('north'),'leaderboard target did not render');
  await page.locator('#start').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>window.SylvariaCompetitive.snapshot().current?.ticketReady===true);assert(ticketRequests===1,`focused Start Enter should issue one ticket, saw ${ticketRequests}`);
  await page.waitForFunction(()=>!document.getElementById('targetWrap')?.hidden);
  const targetText=await page.locator('#targetState').textContent();assert(targetText?.includes('#3')&&targetText.includes('to go'),`nearest live leaderboard target was not concise/readable: ${targetText}`);
  await page.waitForTimeout(550);await page.evaluate(()=>window.Sylvaria091.fn.endRun('test complete'));await page.waitForFunction(()=>document.getElementById('rankedState')?.textContent==='ranked replay ready');
  const deltaText=await page.locator('#runDelta').textContent();assert(deltaText?.includes('current board · #4'),`provisional placement missing from post-run feedback: ${deltaText}`);
  await page.fill('#rankName','tester');await page.click('#submitRank');await page.waitForFunction(()=>document.getElementById('rankedState')?.textContent?.includes('verified'));
  assert(submitBody?.replay?.engineVersion==='0.13.0','posted replay did not use v0.13 engine version');
  assert(submitBody?.replay?.schema===2,'posted replay did not use schema 2');
  assert(Number.isInteger(submitBody?.claimedScore),'posted score was not an integer');
  assert((await page.locator('#rankedState').textContent())==='verified · #1','post-submit rank resolution failed');
  await page.screenshot({path:path.join(outputDir,'verified-rank-v013.png')});await page.close();
}

await browser.close();fs.writeFileSync(path.join(outputDir,'report.json'),JSON.stringify({version:'0.13.0',failures},null,2));
if(failures.length){console.error(`Sylvaria v0.13 competitive UX failed with ${failures.length} issue(s):`);for(const failure of failures)console.error(` - ${failure}`);process.exit(1)}
console.log('Sylvaria v0.13 competitive UX PASS: instant local start, continuous movement during network failure, repeat-safe pause/mute, glide-charge-sweep-reflect coaching, practice isolation, one live score chase, schema-2 replay posting, and verified rank resolution verified.');