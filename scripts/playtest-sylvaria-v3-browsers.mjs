import fs from'node:fs';import path from'node:path';import{createRequire}from'node:module';
const root=process.env.PLAYWRIGHT_MODULE_ROOT;if(!root)throw new Error('PLAYWRIGHT_MODULE_ROOT required');const requirePW=createRequire(path.join(root,'package.json')),{chromium,firefox,webkit}=requirePW('playwright');
const base=process.env.ARCADE_BASE_URL||'http://127.0.0.1:3000',out=process.env.SYLVARIA_BROWSER_DIR||'artifacts/sylvaria-v3-browser-matrix';fs.mkdirSync(out,{recursive:true});
const engines=[['chrome-stable',chromium,{channel:'chrome'}],['chromium',chromium,{}],['firefox',firefox,{}],['webkit',webkit,{}]],report=[];let failed=false;
for(const[name,type,options]of engines){let browser;const errors=[];try{
  browser=await type.launch({headless:true,...options});const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:2});page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto(`${base}/game-runtimes/sylvaria-v3/index.html?browser=${name}`,{waitUntil:'networkidle'});if(!response?.ok())throw new Error(`HTTP ${response?.status()}`);
  await page.waitForFunction(()=>window.__SYLVARIA_V3__?.version==='3.1.0-alpha.1',{timeout:30000});await page.click('#start');
  const before=await page.evaluate(()=>window.__SYLVARIA_V3__.snapshot());const x0=before.player.x;await page.keyboard.down('ArrowRight');await page.waitForTimeout(90);await page.keyboard.up('ArrowRight');const moved=await page.evaluate(()=>window.__SYLVARIA_V3__.snapshot());
  await page.evaluate(()=>{const g=window.__SYLVARIA_V3__,p=g.state.player;Object.assign(p,{x:430,y:6190,vx:0,vy:-40,facing:1,onGround:false,groundId:null,attack:null,attackCooldown:0,airDash:false,vineId:null,sapline:null,saplineCooldown:0,sameAnchorCooldown:0,lastSaplineAnchor:null});});await page.keyboard.down('KeyW');await page.waitForTimeout(65);const tether=await page.evaluate(()=>window.__SYLVARIA_V3__.snapshot());await page.keyboard.up('KeyW');await page.waitForTimeout(35);const released=await page.evaluate(()=>window.__SYLVARIA_V3__.snapshot());
  const canvas=await page.locator('#game').boundingBox(),valid=before.mode==='playing'&&before.bindings.tether==='KeyW'&&moved.player.x>x0+8&&tether.player.sapline?.anchorId==='knot-root-l1'&&released.player.sapline===null&&canvas?.width>900&&errors.length===0;
  if(!valid)throw new Error(`v3.1 browser contract failed ${JSON.stringify({before,moved,tether,released,canvas,errors})}`);
  await page.screenshot({path:path.join(out,`${name}-sylvaria-v31.png`),fullPage:true});report.push({name,ok:true,anchor:tether.player.sapline.anchorId,release:{vx:released.player.vx,vy:released.player.vy},errors});
}catch(error){failed=true;report.push({name,ok:false,error:String(error?.message||error),errors})}finally{await browser?.close()}}
fs.writeFileSync(path.join(out,'v31-browser-report.json'),JSON.stringify(report,null,2));if(failed){console.error('Sylvaria v3.1 browser matrix failed');for(const r of report.filter(x=>!x.ok))console.error(` - ${r.name}: ${r.error}`);process.exit(1)}
console.log(`Sylvaria v3.1 browser matrix PASS · Arrow movement + Sapline attach/release · ${report.map(r=>r.name).join(' · ')}`);
