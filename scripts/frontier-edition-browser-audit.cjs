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
    const palette=await edition.evaluate(node=>{
      const style=getComputedStyle(node);
      return {paper:style.getPropertyValue('--paper').trim(),
        ink:style.getPropertyValue('--ink').trim(),
        accent:style.getPropertyValue('--accent').trim(),
        colorScheme:style.colorScheme};
    });
    assert.deepEqual(palette,{paper:'#fffcf6',ink:'#243247',
      accent:'#783b4b',colorScheme:'light'},
      'Warm eggshell, ink navy and restrained maroon are required: '+JSON.stringify(palette));
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
    if(widthInfo.content > widthInfo.viewport+2) {
      const offenders=await page.evaluate(()=>Array.from(document.querySelectorAll('body *'))
        .map(el=>({tag:el.tagName,classes:typeof el.className==='string'?el.className.slice(0,90):'',
          right:Math.round(el.getBoundingClientRect().right),
          left:Math.round(el.getBoundingClientRect().left)}))
        .filter(el=>el.right>innerWidth+2 || el.left < -2).slice(0,16));
      assert.fail('Default edition overflows horizontally: '+JSON.stringify({widthInfo,offenders}));
    }

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
      document.querySelectorAll('#frontier-stories article:first-child [data-frontier-sprite]').length >= 18,
      undefined,{timeout:6000});
    const count=await first.locator('[data-frontier-sprite]').count();
    assert.equal(count,18,'Desktop article must have eighteen independent sprites');
    const patterns=await first.locator('[data-flight-pattern]').evaluateAll(
      (nodes)=>nodes.map((node)=>node.getAttribute('data-flight-pattern')));
    assert(new Set(patterns).size >= 4,'Different physics paths must be visible together');
    const colorSteps = await first.locator('[data-color-step]').evaluateAll(
      nodes => nodes.map(node => node.getAttribute('data-color-step')));
    assert(new Set(colorSteps).size >= 5,'Swarm must have varied bright color families');
    assert.equal(await page.locator('[data-frontier-lightning-cursor]').count(),1,
      'The Frontier lightning cursor must be mounted exactly once');
    assert.equal(await page.locator('[data-frontier-whip-cursor]').count(),0,
      'The old rainbow whip must no longer be present');

    const reticleToggle=page.getByRole('button',{name:'Show lightning aim reticle'});
    const reticle=page.locator('[data-frontier-lightning-reticle]');
    assert.equal(await reticleToggle.getAttribute('aria-pressed'),'false',
      'Default mode hides the aim guide and keeps lightning skill-based');
    assert.equal(await page.locator('[data-frontier-lightning-cursor]').getAttribute('data-aim-enabled'),
      'false','The reticle must not render visibly by default');
    await reticleToggle.click();
    assert.equal(await reticleToggle.getAttribute('aria-pressed'),'true',
      'The user can explicitly enable an aiming guide');
    assert.equal(await page.locator('[data-frontier-lightning-cursor]').getAttribute('data-aim-enabled'),'true');
    await page.mouse.move(720,410);
    await page.waitForFunction(() => {
      const target=document.querySelector('[data-frontier-lightning-reticle]');
      return Boolean(target && getComputedStyle(target).opacity==='1' &&
        getComputedStyle(target).display!=='none');
    },undefined,{timeout:2000});
    await reticleToggle.click();
    assert.equal(await reticleToggle.getAttribute('aria-pressed'),'false');
    assert.equal(await reticle.evaluate(el=>getComputedStyle(el).display),'none',
      'Disabled reticle is fully hidden, not merely faded');
    assert.equal(await page.evaluate(()=>localStorage.getItem('frontier-lightning-aim-reticle')),'off',
      'The hidden default is stored after a user choice');

    // Every click emits lightning at its true cursor origin; the far tip
    // determines hit or miss. Nothing may snap to a nearby bubble.
    const missBox=await page.locator('[data-frontier-edition] header').first().boundingBox();
    assert(missBox,'Masthead must offer an empty-space test');
    const miss={x:Math.round(missBox.x+missBox.width/2),y:Math.round(missBox.y+missBox.height/2)};
    await page.mouse.click(miss.x,miss.y);
    const missedBolt=page.locator('[data-frontier-lightning-strike]').last();
    await missedBolt.waitFor({timeout:2000});
    assert.equal(await missedBolt.getAttribute('data-lightning-start-x'),String(miss.x));
    assert.equal(await missedBolt.getAttribute('data-lightning-start-y'),String(miss.y));
    const missTip=await missedBolt.evaluate(el=>({
      x:Number(el.getAttribute('data-lightning-end-x')),
      y:Number(el.getAttribute('data-lightning-end-y'))
    }));
    assert(Math.hypot(missTip.x-miss.x,missTip.y-miss.y)>110,
      'The far tip must extend visibly away from the cursor');
    await page.waitForTimeout(225);
    assert.equal(await missedBolt.getAttribute('data-lightning-hit'),'false',
      'An empty-space shot must not claim an impact');
    const initialPops=await page.evaluate(id=>{
      const state=JSON.parse(localStorage.getItem('frontier-personal-radar-v1')).state;
      return state.history[id]?.ambientPops??0;
    },firstId);
    assert.equal(initialPops,0,'A miss must never count as article interest');
    const darkCanvas=await page.locator('[data-frontier-edition]').evaluate(el=>
      getComputedStyle(el).backgroundColor);
    assert(darkCanvas!=='rgb(247, 243, 234)','Canvas must no longer be eggshell');

    // Freeze the first swarm for deterministic hit geometry. Pick a bubble
    // with a clear, clickable EMITTER position down/right from its body.
    await first.locator('[data-frontier-sprite]').evaluateAll(nodes=>{
      for (const node of nodes) node.style.animationPlayState='paused';
    });
    const targetIndex=await first.locator('[data-frontier-sprite]').evaluateAll(nodes=>{
      return nodes.findIndex(node=>{
        const body=node.querySelector('[data-frontier-sprite-body]');
        if(!body) return false;
        const b=body.getBoundingClientRect();
        const from={x:Math.round(b.left+b.width/2+116),y:Math.round(b.top+b.height/2+92)};
        if(from.x>=innerWidth-16||from.y>=innerHeight-16||from.x<130||from.y<106)return false;
        const under=document.elementFromPoint(from.x,from.y);
        return !under?.closest('a,button,input,select,textarea,summary,[role="button"]');
      });
    });
    assert(targetIndex>=0,'At least one visible sprite must have a safe offset firing origin');
    const target=first.locator('[data-frontier-sprite]').nth(targetIndex);
    // Keep the specific DOM identity. The nth() locator will otherwise
    // select the NEXT sprite as soon as the struck one is removed.
    const struckNode=await target.elementHandle();
    assert(struckNode,'Expected a mounted creature for the deterministic strike');
    const bodyBounds=await target.locator('[data-frontier-sprite-body]').boundingBox();
    assert(bodyBounds,'Bubble glyph must have a visible body');
    const aimTip={x:Math.round(bodyBounds.x+bodyBounds.width/2),y:Math.round(bodyBounds.y+bodyBounds.height/2)};
    const fireAt={x:aimTip.x+116,y:aimTip.y+92};
    await target.evaluate(node=>{
      const capture={clickedAt:0,impactedAt:0,poppedAtClick:false};
      Object.assign(window,{__frontierLightningAudit:capture});
      node.addEventListener('frontier-lightning-impact',()=>{
        capture.impactedAt=performance.now();
      },{once:true});
    });
    await page.mouse.click(fireAt.x,fireAt.y);
    const bolt=page.locator('[data-frontier-lightning-strike]').last();
    await bolt.waitFor({timeout:2000});
    const branchCount=await bolt.locator('path').count();
    assert(branchCount>=48,
      'A true galvanic strike must carry trunk, forks and thin dendritic arbor');
    const tip=await bolt.evaluate(el=>({
      startX:Number(el.getAttribute('data-lightning-start-x')),
      startY:Number(el.getAttribute('data-lightning-start-y')),
      endX:Number(el.getAttribute('data-lightning-end-x')),
      endY:Number(el.getAttribute('data-lightning-end-y'))
    }));
    assert.equal(tip.startX,fireAt.x,'The lightning emitter begins at the cursor');
    assert.equal(tip.startY,fireAt.y,'The lightning emitter begins at the cursor');
    assert(Math.abs(tip.endX-aimTip.x)<=1&&Math.abs(tip.endY-aimTip.y)<=1,
      'Only the distant tip should reach the target bubble');
    await page.waitForFunction(()=>Boolean(window.__frontierLightningAudit?.impactedAt),
      undefined,{timeout:2000});
    assert.equal(await struckNode.evaluate(node=>node.getAttribute('data-popped')),'true',
      'A real far-tip collision must pop the bubble');
    assert.equal(await bolt.getAttribute('data-lightning-hit'),'true');
    await struckNode.evaluate(node=>{node.style.removeProperty('animation-play-state');});
    await page.waitForFunction(node=>!node.isConnected,struckNode,{timeout:5000});
    await struckNode.dispose();
    const recorded=await page.evaluate(id=>{
      const state=JSON.parse(localStorage.getItem('frontier-personal-radar-v1')).state;
      return {
        seen:state.history[id]?.ambientAppearances,
        pops:state.history[id]?.ambientPops,
        shots:state.history[id]?.lightningShots,
        hits:state.history[id]?.lightningHits,
        guidedShots:state.history[id]?.lightningGuidedShots,
        guidedHits:state.history[id]?.lightningGuidedHits,
      };
    },firstId);
    assert(recorded.seen>=18&&recorded.pops===1,
      'Only a far-tip hit, not the cursor or electric forks, may increment a pop: '+JSON.stringify(recorded));
    assert.equal(recorded.shots,1,'The non-UI intentional shot should count as one local gameplay attempt');
    assert.equal(recorded.hits,1,'Only a real far-tip collision should count as a gameplay success');
    assert.equal(recorded.guidedShots,0,'Aim-disabled default shots must remain in the unguided cohort');
    assert.equal(recorded.guidedHits,0,'A default unguided shot must not be labeled assisted');

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
    // Zustand persist rehydrates on the client after the server-first DOM is
    // visible; never mistake that initial false frame for lost saved state.
    await page.waitForFunction(id=>{
      const article=Array.from(document.querySelectorAll('[data-frontier-story]'))
        .find(node=>node.getAttribute('data-frontier-story')===id);
      return article?.querySelector('[data-frontier-clear-article]')
        ?.getAttribute('data-cleared')==='true';
    },firstId,{timeout:7000});
    assert.equal(await savedOval.getAttribute('data-cleared'),'true',
      'Strong preference persists after local hydration');

    const off=page.getByRole('button',{name:'Turn off floating newspaper creatures'});
    await off.click();
    assert.equal(await page.locator('[data-frontier-sprite]').count(),0,'Opt-out removes active swarms');
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'Turn on floating newspaper creatures'})
      .waitFor({state:'visible',timeout:7000});
    assert.equal(await page.getByRole('button',{name:'Turn on floating newspaper creatures'}).count(),1,
      'Preference to suppress swarms must persist after hydration');
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
    assert.equal(await first.locator('[data-frontier-sprite]').count(),10,
      'Mobile must have ten moving sprites per visible article');
    assert.equal(await page.locator('[data-frontier-wheel-rating]').count(),0);
    const viewport=await page.evaluate(()=>({
      width:innerWidth,scrollWidth:document.documentElement.scrollWidth
    }));
    assert(viewport.scrollWidth <= viewport.width+2,
      'Swarm sprites must not create horizontal scrolling: '+JSON.stringify(viewport));
    return {mobileSwarm:10,overflow:viewport.scrollWidth-viewport.width};
  } finally { await browser.close(); }
}

async function auditFocusPalette() {
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:840},reducedMotion:'reduce'});
  try {
    const url=new URL(TARGET);
    url.pathname='/frontier/read';
    const response=await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:20000});
    assert(response?.ok(),'Single-article Focus reader must load');
    const reader=page.locator('[data-frontier-reader="true"]');
    await reader.waitFor();
    const palette=await reader.evaluate(node=>{
      const style=getComputedStyle(node);
      return {ink:style.getPropertyValue('--ink').trim(),
        accent:style.getPropertyValue('--accent').trim(),
        colorScheme:style.colorScheme};
    });
    assert.deepEqual(palette,{ink:'#243247',accent:'#783b4b',colorScheme:'light'},
      'Focus and the edition must share the same accessible paper/ink identity');
    const focusDark=await reader.evaluate(node=>getComputedStyle(node).backgroundColor);
    assert(focusDark!=='rgb(247, 243, 234)','Focus canvas must be midnight navy');
    const focusSheet=await reader.locator('article').first().evaluate(node=>getComputedStyle(node).backgroundColor);
    assert.equal(focusSheet,'rgb(255, 252, 246)','Focused article stays ivory on a dark canvas');
    assert((await page.locator('h1').count())>=1,'Focus reader retains its readable article');
    assert(await page.locator('main').count()>=1,'Focus reader retains main page structure');
    return {palette,reachable:true};
  } finally { await browser.close(); }
}

async function main() {
  const results=[];
  for(const size of [[1440,900],[390,844],[320,740]]) results.push(await audit(...size));
  const interaction=await auditActiveSwarm();
  const mobile=await auditCompactSwarm();
  const focus=await auditFocusPalette();
  console.log('FRONTIER multi-article edition QA PASS',JSON.stringify({viewports:results,interaction,mobile,focus}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
