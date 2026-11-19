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

async function auditActiveMotif() {
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
  try {
    const response=await page.goto(TARGET,{waitUntil:'domcontentloaded',timeout:20000});
    assert(response?.ok(),'Animated edition must load');
    const critter=page.locator('[data-frontier-sprite]').first();
    await critter.waitFor({timeout:14000});
    const articleId=await critter.locator('xpath=ancestor::article').getAttribute('data-frontier-story');
    assert(articleId,'Motif must be linked to a real article');
    await page.waitForTimeout(1100);
    // Freeze the moving target only for deterministic browser input coverage.
    await critter.evaluate((node)=>{ node.style.animationPlayState='paused'; });
    await critter.click({timeout:3500});
    assert.equal(await critter.getAttribute('data-popped'),'true','Click must start the satisfying pop animation');
    await page.waitForFunction(([id])=>{
      const json=localStorage.getItem('frontier-personal-radar-v1');
      const history=json ? JSON.parse(json).state?.history : {};
      return (history?.[id]?.ambientPops ?? 0) >= 1
        && (history?.[id]?.ambientAppearances ?? 0) >= 1;
    },[articleId],{timeout:4000});
    await critter.waitFor({state:'detached',timeout:4000});
    const off=page.getByRole('button',{name:'Turn off floating newspaper creatures'});
    await off.click();
    assert.equal(await page.locator('[data-frontier-sprite]').count(),0,
      'Opt-out removes the floating motif');
    await page.reload({waitUntil:'domcontentloaded'});
    assert(await page.getByRole('button',{name:'Turn on floating newspaper creatures'}).count() === 1,
      'Floating creature opt-out must persist');
    return {clickedArticle:articleId,popSaved:true,optOutPersisted:true};
  } finally { await browser.close(); }
}

async function main() {
  const results=[];
  for(const size of [[1440,900],[390,844],[320,740]]) results.push(await audit(...size));
  const interaction=await auditActiveMotif();
  console.log('FRONTIER multi-article edition QA PASS',JSON.stringify({viewports:results,interaction}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
