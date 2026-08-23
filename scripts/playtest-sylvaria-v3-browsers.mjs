import fs from'node:fs';import path from'node:path';import{createRequire}from'node:module';
const root=process.env.PLAYWRIGHT_MODULE_ROOT;if(!root)throw new Error('PLAYWRIGHT_MODULE_ROOT required');const requirePW=createRequire(path.join(root,'package.json')),{chromium,firefox,webkit}=requirePW('playwright');
const base=process.env.ARCADE_BASE_URL||'http://127.0.0.1:3000',out=process.env.SYLVARIA_BROWSER_DIR||'artifacts/sylvaria-v3-browser-matrix';fs.mkdirSync(out,{recursive:true});
const engines=[['chrome-stable',chromium,{channel:'chrome'}],['chromium',chromium,{}],['firefox',firefox,{}],['webkit',webkit,{}]],report=[];let failed=false;
for(const[name,type,options]of engines){let browser;const errors=[];try{
  browser=await type.launch({headless:true,...options});const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:2});page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto(`${base}/game-runtimes/sylvaria-v3/index.html?browser=${name}`,{waitUntil:'networkidle'});if(!response?.ok())throw new Error(`HTTP ${response?.status()}`);
  await page.waitForFunction(()=>window.__SYLVARIA_V3__?.version==='3.2.0-alpha.1',{timeout:30000});await page.locator('#start').click();await page.waitForFunction(()=>window.__SYLVARIA_V3__?.snapshot().mode==='playing',{timeout:5000});
  // Headless WebKit may throttle requestAnimationFrame immediately after page activation.
  // Cross-browser qualification therefore uses real Playwright key events but advances
  // the public authoritative 120 Hz stepper explicitly. Focused Chromium qualification
  // separately exercises the live RAF loop.
  const before=await page.evaluate(()=>window.__SYLVARIA_V3__.snapshot()),x0=before.player.x;
  await page.keyboard.down('ArrowRight');const rightHeld=await page.evaluate(()=>window.__SYLVARIA_V3__.input.is('right'));const moved=await page.evaluate(()=>window.__SYLVARIA_V3__.step(12));await page.keyboard.up('ArrowRight');const rightReleased=await page.evaluate(()=>!window.__SYLVARIA_V3__.input.is('right'));
  const rail=await page.evaluate(()=>{const g=window.__SYLVARIA_V3__,r=g.world.rails.find(v=>v.id==='rail-root-safe-a'),x=535,h=g.engine.railYAtX(r,x),surface=h.y-r.thickness/2,p=g.state.player;Object.assign(p,{x,y:surface-75,vx:0,vy:420,onGround:false,groundId:null,airDash:false,vineId:null,sapline:null,dropTimer:0});return g.step(18)});
  await page.evaluate(()=>{const g=window.__SYLVARIA_V3__,p=g.state.player;Object.assign(p,{x:430,y:6190,vx:0,vy:-40,facing:1,onGround:false,groundId:null,attack:null,attackCooldown:0,airDash:false,vineId:null,sapline:null,saplineCooldown:0,sameAnchorCooldown:0,lastSaplineAnchor:null});});
  await page.keyboard.down('KeyW');const tetherHeld=await page.evaluate(()=>window.__SYLVARIA_V3__.input.is('tether'));const tether=await page.evaluate(()=>window.__SYLVARIA_V3__.step(8));await page.keyboard.up('KeyW');const tetherReleasedInput=await page.evaluate(()=>!window.__SYLVARIA_V3__.input.is('tether'));const released=await page.evaluate(()=>window.__SYLVARIA_V3__.step(1));
  const canvas=await page.locator('#game').boundingBox(),valid=before.mode==='playing'&&before.bindings.tether==='KeyW'&&before.rails?.length>=17&&rightHeld&&rightReleased&&moved.player.x>x0+8&&rail.player.groundId==='rail-root-safe-a'&&tetherHeld&&tetherReleasedInput&&tether.player.sapline?.anchorId==='knot-root-l1'&&released.player.sapline===null&&released.player.vy<0&&canvas?.width>900&&errors.length===0;
  if(!valid)throw new Error(`v3.2 browser contract failed ${JSON.stringify({before,rightHeld,rightReleased,moved,rail,tetherHeld,tetherReleasedInput,tether,released,canvas,errors})}`);
  await page.screenshot({path:path.join(out,`${name}-sylvaria-v32.png`),fullPage:true});report.push({name,ok:true,input:{rightHeld,rightReleased,tetherHeld,tetherReleasedInput},movement:{from:x0,to:moved.player.x},rail:rail.player.groundId,anchor:tether.player.sapline.anchorId,release:{vx:released.player.vx,vy:released.player.vy},errors});
}catch(error){failed=true;report.push({name,ok:false,error:String(error?.message||error),errors})}finally{await browser?.close()}}
fs.writeFileSync(path.join(out,'v32-browser-report.json'),JSON.stringify(report,null,2));if(failed){console.error('Sylvaria v3.2 browser matrix failed');for(const r of report.filter(x=>!x.ok))console.error(` - ${r.name}: ${r.error}`);process.exit(1)}
console.log(`Sylvaria v3.2 browser matrix PASS · real Arrow/W input + authoritative movement + BarkRail + Sapline · ${report.map(r=>r.name).join(' · ')}`);
