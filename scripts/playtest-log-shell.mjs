import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(path.join(process.env.PLAYWRIGHT_MODULE_ROOT,'package.json'))('playwright');
const out='artifacts/world/log-shell';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.WORLD_CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.WORLD_BASE_URL);
 await page.getByRole('button',{name:'Explore world',exact:true}).click();
 await page.waitForFunction(()=>Number(document.querySelector('canvas')?.dataset.drawCalls)>0,null,{timeout:60000});
 await page.getByRole('button',{name:'Skateboarding',exact:true}).click();
 await page.getByRole('button',{name:'Hollow log · carve & return',exact:true}).click();
 await page.locator('canvas').focus();
 const result=await page.evaluate(()=>new Promise((resolve,reject)=>{
  const el=document.querySelector('canvas'),pressed=new Set(),trace=[],start=performance.now();
  let stage='around-mouth',held=0,frames=0;
  const baseline=Number(el.dataset.rideRecoveryCount);
  const key=(k,on)=>{if(pressed.has(k)===on)return;if(on)pressed.add(k);else pressed.delete(k);el.dispatchEvent(new KeyboardEvent(on?'keydown':'keyup',{key:k,code:'Key'+k.toUpperCase(),bubbles:true,cancelable:true}));};
  const done=error=>{for(const k of [...pressed])key(k,false);if(error)reject(Error(error+JSON.stringify(trace)));else resolve({trace,held});};
  const tick=()=>{
   const d=el.dataset,p=d.player.split(',').map(Number),y=Number(d.height);
   if(++frames%8===0)trace.push({stage,p,y,surface:d.skateTunnelSurface,recoveries:Number(d.rideRecoveryCount)});
   if(performance.now()-start>180000){done('Side approach timed out');return;}
   if(stage==='around-mouth'&&p[1]<54.2)stage='alongside';
   if(stage==='alongside'&&p[0]<.8)stage='press-bark';
   key('d',stage==='around-mouth');
   key('w',stage==='alongside'||(stage==='press-bark'&&p[0]>1));
   key('s',stage==='press-bark'&&p[0]<-1);
   key('a',stage==='press-bark');
   // Sliding along the bark and leaving around its open end is valid.
   if(stage==='press-bark'&&held>=10&&Math.abs(p[0])>5.4){done();return;}
   if(stage==='press-bark'&&p[1]>55.8){
    held++;
    if(p[1]>56.5||y<.8||d.skateTunnelSurface==='inner'||Number(d.rideRecoveryCount)>baseline){done('Crossed bark, sank, or recovered through wall');return;}
    if(held>=64){done();return;}
   }
   requestAnimationFrame(tick);
  };requestAnimationFrame(tick);
 }));
 assert.ok(result.held>=10);assert.deepEqual(errors,[]);
 await page.screenshot({path:path.join(out,'pressing-bark.png')});
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
 console.log('PASS',JSON.stringify(result));
}finally{await browser.close();}
