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

    const firstRating=cards.first().locator('[data-frontier-wheel-rating="true"]');
    const button=firstRating.getByRole('button',{name:/Rate interest in/});
    await button.click();
    const knob=firstRating.getByRole('slider',{name:/Interest level for/});
    const starting=Number(await knob.getAttribute('aria-valuenow'));
    assert(starting >= 1 && starting <= 10,'Wheel needs a bounded explicit draft');
    await knob.scrollIntoViewIfNeeded();
    await page.waitForFunction(() =>
      document.querySelector('[data-frontier-wheel-rating] [role="slider"]')?.dataset.wheelReady === 'true'
    ,null,{timeout:4000});
    const bounds=await knob.boundingBox();
    assert(bounds,'Wheel should have on-screen geometry');
    await page.mouse.move(bounds.x + bounds.width/2,bounds.y + bounds.height/2);
    await page.mouse.wheel(0,-120);
    await page.waitForFunction(([start])=>{
      const el=document.querySelector('[data-frontier-wheel-rating] [role="slider"]');
      return el && Number(el.getAttribute('aria-valuenow')) > start;
    },[starting],{timeout:4000}).catch(async (cause) => {
      const diagnostic = await page.evaluate(() => {
        const el=document.querySelector('[data-frontier-wheel-rating] [role="slider"]');
        const box=el?.getBoundingClientRect();
        return {
          ready:el?.dataset.wheelReady, value:el?.getAttribute('aria-valuenow'),
          scrollY:scrollY, viewport:[innerWidth,innerHeight],
          bounds:box ? {x:box.x,y:box.y,width:box.width,height:box.height} : null,
          wheelTarget:document.elementFromPoint(box ? box.x+box.width/2 : 0, box ? box.y+box.height/2 : 0)?.tagName,
        };
      });
      throw new Error('Wheel input was not accepted: '+JSON.stringify(diagnostic)+'; '+cause.message);
    });
    assert.equal(Number(await knob.getAttribute('aria-valuenow')),Math.min(starting+1,10),
      'One deliberate wheel step should tune interest by one');
    const selected=Number(await knob.getAttribute('aria-valuenow'));
    await firstRating.getByRole('button',{name:new RegExp('Save '+selected+'/10')}).click();
    assert((await button.textContent()).includes(selected+'/10'),
      'An explicit confirmation must save the selected interest value');
    const firstId=await cards.first().getAttribute('data-frontier-story');

    // Wheel can only affect the intentionally opened dial. It must never
    // steal native scroll when the user is reading the edition.
    await page.evaluate(() => window.scrollTo({top:0,behavior:'instant'}));
    await page.mouse.move(width-8,Math.min(height-12,650));
    await page.mouse.wheel(0,480);
    await page.waitForFunction(() => window.scrollY > 15, null, {timeout:4000});
    const saved=page.locator(`article[data-frontier-story="${firstId}"] [data-frontier-wheel-rating]`);
    assert((await saved.textContent()).includes(selected+'/10'),
      'Normal scroll must not modify the saved rating');

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
    const restored=page.locator(`article[data-frontier-story="${firstId}"] [data-frontier-wheel-rating]`);
    await page.waitForFunction(([id,score])=>{
      const e=document.querySelector(`article[data-frontier-story="${id}"] [data-frontier-wheel-rating]`);
      return Boolean(e && e.textContent.includes(score+'/10'));
    },[firstId,selected],{timeout:5000});
    assert((await restored.textContent()).includes(selected+'/10'),
      'Rating must persist through the existing local preference history');
    assert.equal(errors.length,0,'No browser runtime exceptions: '+errors.join(' / '));
    return {width,stories:await cards.count(),savedScore:selected,overflow:widthInfo.content-widthInfo.viewport};
  } finally { await browser.close(); }
}

async function main() {
  const results=[];
  for(const size of [[1440,900],[390,844],[320,740]]) results.push(await audit(...size));
  console.log('FRONTIER multi-article edition QA PASS',JSON.stringify(results));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
