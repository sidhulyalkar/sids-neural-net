import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(path.join(process.env.PLAYWRIGHT_MODULE_ROOT,'package.json'))('playwright');
const out='artifacts/world/coastal-nature';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.WORLD_CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[],results={};
try{
 const page=await browser.newPage({viewport:{width:1000,height:700}});page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('auditImage',(name,data)=>fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data.split(',')[1],'base64')));
 const open=async scene=>{await page.goto(process.env.WORLD_BASE_URL+'?nature-start='+scene);await page.getByRole('button',{name:'Explore world',exact:true}).click();await page.waitForFunction(()=>Number(document.querySelector('canvas')?.dataset.drawCalls)>0,null,{timeout:60000});await page.locator('canvas').focus();};
 await open('ocean-bench');await page.getByRole('button',{name:'Sit & watch the ocean · E',exact:true}).click();
 results.bench=await page.evaluate(()=>new Promise((resolve,reject)=>{
  const el=document.querySelector('canvas'),phases=new Set();let frames=0,captured=false,breachFrames=0;
  const tick=()=>{const d=el.dataset;phases.add(d.whalePhase);if(d.whalePhase==='breach'&&++breachFrames>=4&&!captured){captured=true;window.auditImage('whale-breach',el.toDataURL());}
   if(d.whalePhase==='splash'){resolve({seated:d.oceanSeated,sightings:d.whaleSightings,onScreen:d.whaleOnScreen,phases:[...phases]});return;}
   if(++frames>220){reject(Error('No whale: '+JSON.stringify({...d})));return;}requestAnimationFrame(tick);
  };requestAnimationFrame(tick);
 }));
 assert.equal(results.bench.seated,'true');assert.equal(results.bench.onScreen,'true');assert.ok(results.bench.phases.includes('breach'));
 await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.oceanSeated==='false');console.log('PASS bench and whale');
 await open('fern-crown');
 results.crown=await page.evaluate(()=>new Promise(resolve=>{const el=document.querySelector('canvas'),trace=[];let frames=0;el.dispatchEvent(new KeyboardEvent('keydown',{key:'w',bubbles:true}));const tick=()=>{const d=el.dataset;trace.push({point:d.player,layer:d.caveLayer,gap:Number(d.playerSurfaceGap),dogGap:Number(d.dogSupportGap),rock:d.waterfallRockHeight});if(++frames===22){el.dispatchEvent(new KeyboardEvent('keyup',{key:'w',bubbles:true}));window.auditImage('rock-contact',el.toDataURL());resolve(trace);return;}requestAnimationFrame(tick);};requestAnimationFrame(tick);}));
 assert.ok(results.crown.every(s=>s.layer==='surface'&&s.gap>=-.03&&s.dogGap>=-.001));console.log('PASS rock support');
 await open('research-cave');
 results.cave=await page.evaluate(()=>new Promise((resolve,reject)=>{const el=document.querySelector('canvas');let frames=0;el.dispatchEvent(new KeyboardEvent('keydown',{key:'w',bubbles:true}));const tick=()=>{const d=el.dataset,p=d.player.split(',').map(Number);if(p[1]<-37.5){el.dispatchEvent(new KeyboardEvent('keyup',{key:'w',bubbles:true}));window.auditImage('research-cave',el.toDataURL());resolve({layer:d.caveLayer,point:d.player,figures:d.researchFigures,screens:JSON.parse(d.paperFigureScreens)});return;}if(++frames>180){reject(Error('Cave entry failed '+JSON.stringify({...d})));return;}requestAnimationFrame(tick);};requestAnimationFrame(tick);}));
 assert.equal(results.cave.layer,'paper');assert.equal(results.cave.figures,'3');
 await page.getByRole('button',{name:'Explore the research papers',exact:true}).click();const papers=page.locator('a[href^="/papers/"]');assert.ok(await papers.count()>=3);results.paperLinks=await papers.evaluateAll(as=>as.map(a=>a.getAttribute('href')));console.log('PASS cave entry and paper links');
 await open('coastal-falls');await page.screenshot({path:path.join(out,'coastal-falls.png')});assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log('PASS coastal nature');
}finally{await browser.close();}
