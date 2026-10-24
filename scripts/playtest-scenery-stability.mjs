import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(path.join(process.env.PLAYWRIGHT_MODULE_ROOT,'package.json'))('playwright');
const out='artifacts/world/scenery-stability';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.WORLD_CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[],results=[];
try{
 const page=await browser.newPage({viewport:{width:1000,height:700}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.WORLD_BASE_URL);
 await page.getByRole('button',{name:'Explore world',exact:true}).click();
 await page.waitForFunction(()=>Number(document.querySelector('canvas')?.dataset.drawCalls)>0,null,{timeout:60000});
 await page.getByRole('button',{name:'Skateboarding',exact:true}).click();
 await page.getByRole('button',{name:'Show sport shortcuts',exact:true}).click();
 await page.getByRole('button',{name:'Skatepark',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.skatePark==='true');
 for(const [mode,label] of [['skate','Skateboarding'],['bike','Mountain biking']]){
  if(mode==='bike')await page.getByRole('button',{name:label,exact:true}).click();
  await page.locator('canvas').focus();
  const trace=await page.evaluate(()=>new Promise(resolve=>{
   const canvas=document.querySelector('canvas'),samples=[];let frames=0;
   canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'w',bubbles:true}));
   canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'a',bubbles:true}));
   function tick(){const d=canvas.dataset;samples.push({mode:d.activity,point:d.player,height:Number(d.height),coastal:Number(d.coastalCameraCutaways),scenery:Number(d.discGolfCameraCutaways)});
    if(++frames===18){for(const key of ['w','a'])canvas.dispatchEvent(new KeyboardEvent('keyup',{key,bubbles:true}));resolve(samples);return;}requestAnimationFrame(tick);
   }requestAnimationFrame(tick);
  }));
  assert.ok(trace.every(s=>s.mode===mode&&Number.isFinite(s.height)&&s.coastal===0&&s.scenery===0));results.push(...trace);
  for(const [i,dx] of [0,-160,300].entries()){
   if(dx){await page.mouse.move(500,320);await page.mouse.down();await page.mouse.move(500+dx,335,{steps:8});await page.mouse.up();}
   await page.screenshot({path:path.join(out,mode+'-'+i+'.png')});
  }
  console.log('PASS intact scenery while riding and orbiting',mode);
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
}finally{await browser.close();}
