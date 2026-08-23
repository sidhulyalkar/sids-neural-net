import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root=process.env.PLAYWRIGHT_MODULE_ROOT;if(!root)throw new Error('PLAYWRIGHT_MODULE_ROOT is required');
const requireFrom=createRequire(path.join(root,'package.json'));const{chromium,firefox,webkit}=requireFrom('playwright');
const baseUrl=process.env.ARCADE_BASE_URL||'http://127.0.0.1:3000',outputDir=process.env.SYLVARIA_BROWSER_DIR||'artifacts/sylvaria-browser-matrix';fs.mkdirSync(outputDir,{recursive:true});
const engines=[['chrome-stable',chromium,{channel:'chrome'}],['chromium',chromium,{}],['firefox',firefox,{}],['webkit',webkit,{}]],report=[];let failed=false;
for(const[name,type,options]of engines){let browser;const errors=[];try{
  browser=await type.launch({headless:true,...options});const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto(`${baseUrl}/game-runtimes/mosslight-v2/index.html?browser=${name}`,{waitUntil:'networkidle'});if(!response?.ok())throw new Error(`HTTP ${response?.status()}`);
  await page.waitForFunction(()=>window.__MOSSLIGHT_PLAYTEST__?.version==='0.14.0'&&window.SylvariaCombat014?.version==='0.14.0'&&window.SylvariaCharacterRig?.version==='0.14.0',{timeout:30000});
  await page.click('#start');await page.locator('#c').focus();
  const sample=await page.evaluate(()=>{const play=window.__MOSSLIGHT_PLAYTEST__,G=window.Sylvaria091,p=G.state.player;play.clearCombatants();play.labClearGeometry();play.setPlayerPosition(420,350);G.state.slashes=[];p.cutCooldown=0;G.fn.cut('right');G.fn.render();const s=G.state.slashes.at(-1),rig=window.SylvariaCharacterRig.pose(p,s),kinetic=window.SylvariaKineticPresentation.snapshot(),pond=window.SylvariaPondRenderer?.snapshot?.();return{version:play.version,rig,kinetic,pond,ranked:window.SylvariaCompetitive?.snapshot?.().rankedDisabledReason||null}});
  const mouthError=Math.hypot((sample.kinetic.tongueMouth?.x??999)-sample.rig.mouth.x,(sample.kinetic.tongueMouth?.y??999)-sample.rig.mouth.y);
  if(sample.version!=='0.14.0'||mouthError>=.01||sample.kinetic.tongueAttachmentError>=.01||!sample.ranked)throw new Error(`v0.14 rig contract failed ${JSON.stringify({mouthError,sample})}`);
  await page.screenshot({path:path.join(outputDir,`${name}-sylvaria-v014.png`),fullPage:true});report.push({name,ok:true,mouthError,pond:sample.pond?.mode||null,errors});
}catch(error){failed=true;report.push({name,ok:false,error:String(error?.message||error),errors})}finally{await browser?.close()}}
fs.writeFileSync(path.join(outputDir,'v014-browser-report.json'),JSON.stringify(report,null,2));
if(failed){console.error('Sylvaria v0.14 browser matrix failed');for(const row of report.filter(r=>!r.ok))console.error(` - ${row.name}: ${row.error}`);process.exit(1)}
console.log(`Sylvaria v0.14 browser matrix PASS · ${report.map(r=>`${r.name}:${r.pond||'fallback'}:${r.mouthError.toFixed(3)}px`).join(' · ')}`);