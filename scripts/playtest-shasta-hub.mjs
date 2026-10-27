import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw new Error('PLAYWRIGHT_MODULE_ROOT required');
const {chromium}=createRequire(path.join(root,'package.json'))('playwright');
const out=process.env.WORLD_AUDIT_DIR??'artifacts/world/shasta-hub';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,
 args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[],snapshots=[];
let page;
const record=async label=>{
 const data=await page.locator('canvas').evaluate(c=>({...c.dataset}));
 const item={label,action:data.shastaTrick,phase:data.shastaTrickPhase,
  outing:data.shastaOuting,carrying:data.shastaCarrying,
  catches:data.shastaCatchCount,drawCalls:data.drawCalls};
 snapshots.push(item);return item;
};
try{
 page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.WORLD_BASE_URL??'http://127.0.0.1:3000');
 const explore=page.getByRole('button',{name:'Explore world',exact:true});
 await explore.click();
 await page.waitForFunction(()=>Number(document.querySelector('canvas')?.dataset.drawCalls)>0,
  null,{timeout:95000});
 const nav=page.getByRole('navigation',{name:'World movement and sports'});
 assert.equal(await nav.isVisible(),true);
 const menu=nav.getByRole('button',{name:'Open navigation menu'});
 assert.equal(await menu.count(),1);
 assert.equal((await menu.innerText()).trim(),'');
 const toggle=nav.getByRole('button',{name:'Show Shasta tricks'});
 await toggle.click();
 assert.equal(await nav.getByRole('button',{name:'Hide Shasta tricks'}).getAttribute('aria-expanded'),'true');
 assert.equal(await nav.getByRole('button',{name:'Shake left paw'}).isVisible(),true);
 await nav.getByRole('button',{name:'Sit',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.shastaTrickPhase==='hold'&&
 document.querySelector('canvas')?.dataset.shastaTrick==='sit',null,{timeout:25000});
 await record('sit held');
 await page.screenshot({path:path.join(out,'01-shasta-sit.png')});
 await nav.getByRole('button',{name:'Roll left'}).click();
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.shastaTrick==='roll-left',null,{timeout:15000});
 await record('left roll');
 await nav.getByRole('button',{name:'Shake right paw'}).click();
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.shastaTrick==='shake-right',
  null,{timeout:15000});
 await record('right paw interrupts roll');
 await nav.getByRole('button',{name:'Park it'}).click();
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.shastaTrick==='park-it',
  null,{timeout:15000});
 await record('park it approach');
 await page.screenshot({path:path.join(out,'02-shasta-park-it.png')});
 await nav.getByRole('button',{name:'Shasta Come'}).click();
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.shastaCommand==='come'&&
 document.querySelector('canvas')?.dataset.shastaTrickPhase==='idle',null,{timeout:15000});
 await record('recall interrupts park');
 // Mobile drawer must remain in the viewport and its trigger stay reachable.
 await page.setViewportSize({width:390,height:750});
 const rect=await nav.boundingBox();
 assert.ok(rect&&rect.x>=0&&rect.x+rect.width<=392);
 assert.ok(await nav.getByRole('button',{name:'Hide Shasta tricks'}).isVisible());
 await page.screenshot({path:path.join(out,'03-mobile-shasta-hub.png')});
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'trace.json'),JSON.stringify({snapshots,errors},null,2)+'\n');
 console.log('SHASTA HUB BROWSER PASS',JSON.stringify({snapshots,errors}));
}catch(e){
 try{await page?.screenshot({path:path.join(out,'failure.png')});}catch{}
 fs.writeFileSync(path.join(out,'trace.json'),JSON.stringify({snapshots,errors,error:String(e)},null,2)+'\n');
 throw e;
}finally{await browser.close();}
