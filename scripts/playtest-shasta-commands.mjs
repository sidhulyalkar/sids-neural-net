import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const {chromium}=createRequire(path.join(process.env.PLAYWRIGHT_MODULE_ROOT,'package.json'))('playwright');
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.WORLD_BASE_URL??'http://127.0.0.1:3000');
 await page.getByRole('button',{name:'Explore world',exact:true}).click();
 await page.waitForFunction(()=>Number(document.querySelector('canvas')?.dataset.drawCalls)>0,null,{timeout:60000});
 const data=()=>page.locator('canvas').evaluate(c=>({...c.dataset}));
 assert.equal((await data()).shastaCommand,'come');
 await page.getByRole('button',{name:'Shasta Go',exact:true}).click();
 await page.waitForFunction(()=>['roam','chase'].includes(document.querySelector('canvas')?.dataset.shastaOuting),null,{timeout:15000});
 const start=await data();
 await page.waitForFunction(d=>Number(document.querySelector('canvas')?.dataset.dogDistanceTraveled)>d+4,Number(start.dogDistanceTraveled),{timeout:20000});
 const outing=await data();
 await page.getByRole('button',{name:'Shasta Come',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.shastaCommand==='come',null,{timeout:10000});
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.shastaOuting==='follow',null,{timeout:30000});
 const returned=await data();
 assert.equal(returned.dogCuriosity,'');
 await page.screenshot({path:process.env.WORLD_SCREENSHOT??'/tmp/shasta-recall.png'});
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({outing:{mode:outing.shastaOuting,travel:outing.dogDistanceTraveled},returned:{mode:returned.shastaOuting,travel:returned.dogDistanceTraveled},errors},null,2));
}finally{await browser.close();}
