import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(path.join(process.env.PLAYWRIGHT_MODULE_ROOT,'package.json'))('playwright');
const out='artifacts/world/waterfall-rock-seams';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.WORLD_CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[],results={};
try{
 const page=await browser.newPage({viewport:{width:900,height:700}});page.setDefaultTimeout(120000);page.on('pageerror',e=>{errors.push(e.message);console.log('ERROR',e.message);});
 const frames=async n=>page.evaluate(n=>new Promise(resolve=>{function tick(){if(--n===0)resolve();else requestAnimationFrame(tick);}requestAnimationFrame(tick);}),n);
 await page.goto(process.env.WORLD_BASE_URL+'?nature-start=research-cave');await page.getByRole('button',{name:'Explore world',exact:true}).click();await page.waitForFunction(()=>Number(document.querySelector('canvas')?.dataset.drawCalls)>0);await frames(12);
 for(const [name,dx] of [['front',0],['left',95],['right',-190],['center',95]]){
  if(dx){await page.mouse.move(450,320);await page.mouse.down();await page.mouse.move(450+dx,320,{steps:4});await page.mouse.up();await frames(10);}
  await page.screenshot({path:path.join(out,name+'.png')});console.log('PASS rendered view',name);
 }
 await page.locator('canvas').focus();
 const travel=async(key,target)=>page.evaluate(({key,target})=>new Promise((resolve,reject)=>{
  const c=document.querySelector('canvas');let n=0;c.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));
  function tick(){const z=Number(c.dataset.player.split(',')[1]);if(key==='w'?z<target:z>target){c.dispatchEvent(new KeyboardEvent('keyup',{key,bubbles:true}));resolve({point:c.dataset.player,layer:c.dataset.caveLayer});return;}
   if(++n>150){c.dispatchEvent(new KeyboardEvent('keyup',{key,bubbles:true}));reject(Error('Portal blocked '+c.dataset.player));return;}requestAnimationFrame(tick);
  }requestAnimationFrame(tick);
 }),{key,target});
 results.entry=await travel('w',-35);assert.equal(results.entry.layer,'paper');await page.screenshot({path:path.join(out,'inside.png')});
 results.exit=await travel('s',-28);assert.equal(results.exit.layer,'surface');assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,errors},null,2));console.log('PASS open cave entrance in both directions');
}finally{await browser.close();}
