import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(path.join(process.env.PLAYWRIGHT_MODULE_ROOT,'package.json'))('playwright');
const out='artifacts/world/research-museum';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.WORLD_CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[],failedAssets=[],results=[];
try{
 const page=await browser.newPage({viewport:{width:1000,height:700}});page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/world/research/')&&r.status()>=400)failedAssets.push(r.url());});page.setDefaultTimeout(120000);
 const open=async name=>{await page.goto(process.env.WORLD_BASE_URL+'?nature-start='+name);await page.getByRole('button',{name:'Explore world',exact:true}).click();await page.waitForFunction(()=>Number(document.querySelector('canvas')?.dataset.drawCalls)>0);await page.locator('canvas').focus();};
 await open('research-cave');
 const move=async(x,z)=>page.evaluate(({x,z})=>new Promise((resolve,reject)=>{
  const c=document.querySelector('canvas'),held=new Set();let n=0;
  function keys(wanted){for(const k of ['w','a','s','d'])if(wanted.has(k)!==held.has(k)){c.dispatchEvent(new KeyboardEvent(wanted.has(k)?'keydown':'keyup',{key:k,bubbles:true}));if(wanted.has(k))held.add(k);else held.delete(k);}}
  const tick=()=>{const [px,pz]=c.dataset.player.split(',').map(Number),dx=x-px,dz=z-pz;
   if(Math.hypot(dx,dz)<.35){keys(new Set());resolve({target:[x,z],point:[px,pz],layer:c.dataset.caveLayer,figures:c.dataset.researchFigures});return;}
   if(++n>450){keys(new Set());reject(Error('Stuck '+JSON.stringify({target:[x,z],point:[px,pz],layer:c.dataset.caveLayer})));return;}
   const wanted=new Set();if(Math.abs(dx)>.18)wanted.add(dx>0?'d':'a');if(Math.abs(dz)>.18)wanted.add(dz>0?'s':'w');keys(wanted);requestAnimationFrame(tick);
  };requestAnimationFrame(tick);
 }),{x,z});
 const route=[[-20,-38.5],[-23.4,-41],[-23.4,-50.5],[-20,-55],[-16.6,-58],[-16.6,-67.5],[-20,-73]];
 for(const [i,p] of route.entries()){const r=await move(...p);assert.equal(r.layer,'paper');assert.equal(r.figures,'9');results.push(r);if([0,3,6].includes(i))await page.screenshot({path:path.join(out,'room-'+(1+Math.floor(i/3))+'.png')});console.log('PASS museum waypoint',JSON.stringify(r));}
 await page.getByRole('button',{name:'Explore the research papers',exact:true}).click();assert.equal(await page.locator('a:has-text("Open paper ↗")').count(),9);await page.keyboard.press('Escape');await page.locator('canvas').focus();
 for(const p of [...route].reverse().slice(1))results.push(await move(...p));results.push(await move(-20,-28));assert.equal(results.at(-1).layer,'surface');console.log('PASS museum exit');
 for(const name of ['fern-crown','snowmelt-pool','coastal-falls']){await open(name);await page.screenshot({path:path.join(out,name+'.png')});assert.equal(await page.locator('canvas').getAttribute('data-mountain-streams'),'2');console.log('PASS scenery',name);}
 assert.deepEqual(errors,[]);assert.deepEqual(failedAssets,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,errors,failedAssets},null,2));
}finally{await browser.close();}
