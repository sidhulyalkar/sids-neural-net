import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(path.join(process.env.PLAYWRIGHT_MODULE_ROOT,'package.json'))('playwright');
const out='artifacts/world/vehicle-mountain';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.WORLD_CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:800,height:600}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('auditImage',(name,data)=>fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data.split(',')[1],'base64')));
 await page.exposeFunction('auditTrace',s=>console.log(JSON.stringify(s)));
 const results={};
 for(const [label,mode] of [['Skateboarding','skate'],['Mountain biking','bike']]){
  await page.goto(process.env.WORLD_BASE_URL);
  await page.getByRole('button',{name:'Explore world',exact:true}).click();
  await page.waitForFunction(()=>Number(document.querySelector('canvas')?.dataset.drawCalls)>0,null,{timeout:60000});
  await page.getByRole('button',{name:label,exact:true}).click();
  await page.getByRole('button',{name:'Open navigation menu'}).click();
  await page.getByRole('button',{name:'02 Granite ridge Things I build',exact:true}).click();
  await page.locator('canvas').focus();
  const trace=await page.evaluate(()=>new Promise(resolve=>{
   const el=document.querySelector('canvas'),samples=[];let frames=0;
   const key=(type,key)=>el.dispatchEvent(new KeyboardEvent(type,{key,bubbles:true}));
   key('keydown','w');
   const tick=()=>{
    const d=el.dataset;samples.push({point:d.player,mode:d.activity,pitch:Number(d.surfacePitch),gap:Number(d.rideRenderedWheelGap),yaw:Number(d.rideVisualYawError)});
    if(++frames===25){key('keyup','w');key('keydown','s');}
    if(frames===50){key('keyup','s');resolve(samples);return;}
    requestAnimationFrame(tick);
   };requestAnimationFrame(tick);
  }));
  assert.ok(trace.every(s=>s.mode===mode&&Number.isFinite(s.pitch)&&Number.isFinite(s.gap)&&Math.abs(s.yaw)<.005));
  assert.ok(new Set(trace.map(s=>s.point)).size>15,mode+' must move');
  await page.screenshot({path:path.join(out,mode+'-mountain.png')});
  results[mode]=trace;console.log('PASS mountain',mode);
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log('PASS',JSON.stringify(results));
}finally{await browser.close();}
