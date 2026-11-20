const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const TARGET = process.env.FRONTIER_EDITION_AUDIT_URL || 'http://127.0.0.1:3000/frontier';

async function audit(width,height) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport:{width,height}, reducedMotion:'reduce' });
  const errors = [];
  const requests = [];
  page.on('pageerror',e => errors.push(e.message));
  page.on('request',req => {
    if (req.url().includes('/api/frontier/feed')) requests.push(req.url());
  });
  try {
    const result = await page.goto(TARGET,{waitUntil:'domcontentloaded',timeout:15000});
    assert(result?.ok(), 'The default Frontier edition must load');
    const edition = page.locator('[data-frontier-edition="multi-article"]');
    await edition.waitFor();
    const cards = page.locator('#frontier-stories article');
    assert((await cards.count()) >= 2, 'The default Frontier must show multiple independently navigable stories');
    assert.equal(await page.locator('canvas').count(),0, 'Cold edition cannot start WebGL');
    assert.equal(requests.length,0, 'Cold navigation cannot start a live feed search');
    const links = page.locator('#frontier-stories article h2 a');
    assert((await links.count()) >= 2,'Every story must have its own original source');
    for (const url of await links.evaluateAll(nodes => nodes.slice(0,5).map(n => n.getAttribute('href')))) {
      assert(/^https?:\/\//.test(url || ''),'Original source links must be actual HTTP(S) URLs');
    }
    const initialTitle = await cards.first().locator('h2').textContent();
    assert(initialTitle?.trim(),'Edition stories need real source titles');

    const widthInfo = await page.evaluate(() => ({viewport:innerWidth,content:document.documentElement.scrollWidth}));
    assert(widthInfo.content <= widthInfo.viewport + 2, 'Default edition overflows horizontally: '+JSON.stringify(widthInfo));

    assert.equal(await page.locator('[data-frontier-wheel-rating]').count(),0,
      'The explicit numeric interest dial must be removed from the edition');
    assert.equal(await page.locator('[data-frontier-sprite]').count(),0,
      'Reduced-motion preference must suppress autonomous floating ornaments');
    const initialScroll=await page.evaluate(()=>window.scrollY);
    await page.mouse.move(width-8,Math.min(height-12,650));
    await page.mouse.wheel(0,420);
    await page.waitForFunction(([before])=>window.scrollY > before + 12,[initialScroll],{timeout:4000});
    const firstId=await cards.first().getAttribute('data-frontier-story');

    await page.evaluate(() => window.scrollTo({top:0,behavior:'instant'}));
    await page.mouse.move(width-8,Math.min(height-12,650));
    await page.mouse.wheel(0,480);
    await page.waitForFunction(() => window.scrollY > 15, null, {timeout:4000});
    await page.evaluate(() => window.scrollTo({top:0,behavior:'instant'}));
    fs.mkdirSync(path.resolve('artifacts/frontier/edition'),{recursive:true});
    await page.screenshot({path:path.resolve(`artifacts/frontier/edition/edition-${width}.png`),
      fullPage:true,animations:'disabled'});

    const research=page.getByRole('button',{name:'Research',exact:true});
    await research.click();
    assert.equal(await research.getAttribute('aria-pressed'),'true','Category buttons must actually select a new edition lens');
    await page.getByRole('button',{name:'Everything',exact:true}).click();
    assert((await cards.count()) >= 2,'Returning to all stories must restore the multi-article edition');

    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator(`article[data-frontier-story="${firstId}"]`).waitFor({timeout:8000});
    assert.equal(await page.locator('[data-frontier-wheel-rating]').count(),0,
      'Reload must not resurrect the old numeric rating panel');
    assert.equal(errors.length,0,'No browser runtime exceptions: '+errors.join(' / '));
    return {width,stories:await cards.count(),ambientSuppressed:true,overflow:widthInfo.content-widthInfo.viewport};
  } finally { await browser.close(); }
}

async function auditActiveSwarm() {
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
  const errors=[];
  page.on('pageerror',(error)=>errors.push(error.message));
  try {
    const response=await page.goto(TARGET,{waitUntil:'domcontentloaded',timeout:20000});
    assert(response?.ok(),'Animated signal edition must load');
    const oldHero=page.getByText('The frontier, in context.');
    assert.equal(await oldHero.count(),0,'Remove the oversized editorial introduction');
    assert.equal(await page.getByText(/AN EDITION OF THINGS WORTH UNDERSTANDING/i).count(),0,
      'No marketing kicker may remain');
    const first=page.locator('#frontier-stories article').first();
    const firstId=await first.getAttribute('data-frontier-story');
    assert(firstId,'A real article must own its swarm');
    await first.locator('[data-frontier-ambient-layer="swarm"]').waitFor({timeout:13000});
    await page.waitForFunction(()=>
      document.querySelectorAll('#frontier-stories article:first-child [data-frontier-sprite]').length >= 9,
      undefined,{timeout:6000});
    const count=await first.locator('[data-frontier-sprite]').count();
    assert.equal(count,9,'Desktop article must have a real nine-object swarm');
    const patterns=await first.locator('[data-flight-pattern]').evaluateAll(
      (nodes)=>nodes.map((node)=>node.getAttribute('data-flight-pattern')));
    assert(new Set(patterns).size >= 4,'Different physics paths must be visible together');

    const firstSprite=first.locator('[data-frontier-sprite]').first();
    await firstSprite.evaluate((node)=>{node.style.animationPlayState='paused';});
    await firstSprite.click({timeout:4000});
    assert.equal(await firstSprite.getAttribute('data-popped'),'true','Click triggers the local burst');
    // Unpause the short exit animation after the deterministic click.
    await firstSprite.evaluate((node)=>{node.style.removeProperty('animation-play-state');});
    await firstSprite.waitFor({state:'detached',timeout:5000});
    const recorded=await page.evaluate((id)=>{
      const state=JSON.parse(localStorage.getItem('frontier-personal-radar-v1')).state;
      return {seen:state.history[id]?.ambientAppearances,pops:state.history[id]?.ambientPops};
    },firstId);
    assert(recorded.seen>=9 && recorded.pops===1,
      'Individual clicks must record both opportunity count and successful pop: '+JSON.stringify(recorded));

    const clear=first.locator('[data-frontier-clear-article]');
    assert.equal(await clear.textContent(),'','Clear oval must have no visible text');
    await clear.click({timeout:4000});
    assert.equal(await clear.getAttribute('data-cleared'),'true','Clear oval is a one-time explicit preference');
    await page.waitForTimeout(1150);
    assert.equal(await first.locator('[data-frontier-sprite]').count(),0,
      'Clear all must remove the entire article swarm, including moving bugs');
    const cleared=await page.evaluate((id)=>{
      const state=JSON.parse(localStorage.getItem('frontier-personal-radar-v1')).state;
      const entry=state.history[id];
      return {cleared:entry?.ambientClearedAt,reaction:entry?.reaction,
        meaningfulInteractions:state.profile.meaningfulInteractions};
    },firstId);
    assert(cleared.cleared && cleared.reaction==='love',
      'Clear-all must explicitly prioritize that article: '+JSON.stringify(cleared));

    await page.reload({waitUntil:'domcontentloaded'});
    const savedOval=page.locator(`article[data-frontier-story="${firstId}"] [data-frontier-clear-article]`);
    await savedOval.waitFor();
    assert.equal(await savedOval.getAttribute('data-cleared'),'true',
      'Strong preference persists without bringing back the swarm');

    const off=page.getByRole('button',{name:'Turn off floating newspaper creatures'});
    await off.click();
    assert.equal(await page.locator('[data-frontier-sprite]').count(),0,'Opt-out removes active swarms');
    await page.reload({waitUntil:'domcontentloaded'});
    assert.equal(await page.getByRole('button',{name:'Turn on floating newspaper creatures'}).count(),1,
      'Preference to suppress swarms must persist');
    assert.deepEqual(errors,[],'No browser runtime failures');
    return {initialSwarm:count,uniquePaths:new Set(patterns).size,clearPersists:true,optOutPersists:true};
  } finally { await browser.close(); }
}

async function auditCompactSwarm() {
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'no-preference'});
  try {
    await page.goto(TARGET,{waitUntil:'domcontentloaded',timeout:20000});
    const first=page.locator('#frontier-stories article').first();
    await first.locator('[data-frontier-ambient-layer="swarm"]').waitFor({timeout:13000});
    assert.equal(await first.locator('[data-frontier-sprite]').count(),5,
      'Mobile must have five moving sprites per visible article');
    assert.equal(await page.locator('[data-frontier-wheel-rating]').count(),0);
    const viewport=await page.evaluate(()=>({
      width:innerWidth,scrollWidth:document.documentElement.scrollWidth
    }));
    assert(viewport.scrollWidth <= viewport.width+2,
      'Swarm sprites must not create horizontal scrolling: '+JSON.stringify(viewport));
    return {mobileSwarm:5,overflow:viewport.scrollWidth-viewport.width};
  } finally { await browser.close(); }
}

async function main() {
  const results=[];
  for(const size of [[1440,900],[390,844],[320,740]]) results.push(await audit(...size));
  const interaction=await auditActiveSwarm();
  const mobile=await auditCompactSwarm();
  console.log('FRONTIER multi-article edition QA PASS',JSON.stringify({viewports:results,interaction,mobile}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
