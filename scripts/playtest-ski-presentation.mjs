import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(path.join(process.env.PLAYWRIGHT_MODULE_ROOT,'package.json'))('playwright');
const output=process.env.WORLD_AUDIT_DIR??'artifacts/ski-presentation';
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const evidence={errors:[],stages:[],trace:[]};
const page=await browser.newPage({viewport:{width:1000,height:740}});
await page.context().tracing.start({screenshots:true,snapshots:true});
page.on('pageerror',e=>evidence.errors.push(e.message));
const wait=fn=>page.waitForFunction(fn,null,{timeout:120000});
async function capture(stage){
 const data=await page.locator('canvas').evaluate(c=>({...c.dataset}));
 evidence.stages.push({stage,data});
 await page.screenshot({path:path.join(output,stage+'.png')});
 console.log(stage,JSON.stringify(Object.fromEntries(Object.entries(data).filter(([k])=>/skiSole|skiCamera|player$|bigAirPhase|airborne|drawCalls|frameP/i.test(k)))));
 assert.equal(data.bigAirPhase,'idle');
 const screen=data.skiPlayerScreen.split(',').map(Number);
 assert.ok(screen.every(Number.isFinite)&&Math.abs(screen[0])<.85&&Math.abs(screen[1])<.85,'skier must remain framed');
 assert.ok(Number(data.drawCalls)>1,'scene must be rendered');
 const camera=data.skiCameraPosition.split(',').map(Number);
 assert.ok(camera.every(v=>Number.isFinite(v)&&Math.abs(v)<500),'camera finite and local');
 if(data.skiContactActive==='true')assert.ok(Number(data.skiSoleMin)>-.025&&Number(data.skiSoleMin)<.04);
}
try{
 await page.goto(process.env.WORLD_BASE_URL??'http://localhost:3000',{waitUntil:'domcontentloaded',timeout:120000});
 await page.getByRole('button',{name:'Explore world',exact:true}).click({timeout:120000});
 await page.getByRole('button',{name:'Skiing',exact:true}).click({timeout:120000});
 await wait(()=>document.querySelector('canvas')?.dataset.skiContactActive==='true');
 await page.evaluate(()=>{
  window.skiTrace=[];
  window.skiTraceTimer=setInterval(()=>{
   const d=document.querySelector('canvas')?.dataset;
   if(d)window.skiTrace.push({t:performance.now(),player:d.player,air:d.airborne,contact:d.skiContactActive,min:d.skiSoleMin,max:d.skiSoleMax,camera:d.skiCameraPosition,look:d.skiCameraLook,drawCalls:d.drawCalls,phase:d.bigAirPhase});
  },100);
 });
 await capture('01-entry');
 await page.keyboard.down('w');
 await wait(()=>Number(document.querySelector('canvas')?.dataset.player.split(',')[1])>-54);
 await page.keyboard.up('w');
 await capture('02-floor');
 await page.keyboard.down('a');
 await wait(()=>Number(document.querySelector('canvas')?.dataset.player.split(',')[0])>9.5);
 await page.keyboard.up('a');
 await capture('03-right-wall');
 await page.keyboard.down('d');
 await wait(()=>Number(document.querySelector('canvas')?.dataset.player.split(',')[0])<4.5);
 await page.keyboard.up('d');
 await capture('04-left-wall');
 await page.keyboard.down('a');
 await wait(()=>Number(document.querySelector('canvas')?.dataset.player.split(',')[0])>5.5);
 await page.keyboard.up('a');
 await wait(()=>Number(document.querySelector('canvas')?.dataset.speed)<.2);
 await page.keyboard.press('Space');
 await wait(()=>document.querySelector('canvas')?.dataset.airborne==='true');
 await page.screenshot({path:path.join(output,'05-hop-transition.png')});
 await wait(()=>document.querySelector('canvas')?.dataset.skiContactActive==='true');
 await capture('06-landing');
 await page.setViewportSize({width:390,height:844});
 await capture('07-portrait');
 await page.setViewportSize({width:844,height:390});
 await capture('08-landscape');
 assert.deepEqual(evidence.errors,[]);
 const trace=await page.evaluate(()=>window.skiTrace);
 assert.ok(trace.some(v=>v.air==='true'&&v.contact==='false'),'manual hop must disengage snow contact');
 assert.ok(trace.some((v,i)=>v.contact==='true'&&trace.slice(0,i).some(p=>p.air==='true')),'contact must return after landing');
}catch(error){evidence.failure=String(error);throw error;}
finally{
 evidence.trace=await page.evaluate(()=>{clearInterval(window.skiTraceTimer);return window.skiTrace??[]}).catch(()=>[]);
 fs.writeFileSync(path.join(output,'evidence.json'),JSON.stringify(evidence,null,2));
 await page.context().tracing.stop({path:path.join(output,'trace.zip')});
 await browser.close();
}
