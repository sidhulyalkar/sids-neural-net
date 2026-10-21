import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(path.join(process.env.PLAYWRIGHT_MODULE_ROOT,'package.json'))('playwright');
const out='artifacts/world/center-jumps';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.WORLD_CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:800,height:600}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('auditImage',(name,data)=>fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data.split(',')[1],'base64')));
 await page.exposeFunction('auditTrace',s=>console.log(JSON.stringify(s)));
 const results={};
 for(const mode of ['forward','reverse','tube']){
  const ride=mode==='tube'?'hollow-log':mode==='reverse'?'loop-reverse':'loop-rollin';
  await page.goto(process.env.WORLD_BASE_URL+'?skate-start='+ride);
  await page.getByRole('button',{name:'Explore world',exact:true}).click();
  await page.waitForFunction(()=>Number(document.querySelector('canvas')?.dataset.drawCalls)>0,null,{timeout:60000});
  await page.locator('canvas').focus();console.log('Approach',mode);
  results[mode]=await page.evaluate(mode=>new Promise((resolve,reject)=>{
   const el=document.querySelector('canvas'),pressed=new Set(),trace=[];let frames=0,stage='approach',inverted=false,jumped=false,sawAir=false,jumpSerial=0,cameraSide=0;
   const start=performance.now(),baseline=Number(el.dataset.skateLoopCompletions);
   const key=(k,on)=>{if(on)pressed.add(k);else pressed.delete(k);el.dispatchEvent(new KeyboardEvent(on?'keydown':'keyup',{key:k,code:k===' '?'Space':'Key'+k.toUpperCase(),bubbles:true,cancelable:true}));};
   const release=()=>{for(const k of [...pressed])key(k,false);};
   const finish=(error)=>{release();if(error)reject(Error(error+JSON.stringify(trace)));else resolve({inverted,jumped,sawAir,frames,trace});};
   key('w',true);
   const tick=()=>{
    const d=el.dataset,p=(d.player??'').split(',').map(Number),angle=Number(mode!=='tube'?d.skateLoopAngle:d.skateTunnelAngle);
    const s={stage,p,angle,phase:mode!=='tube'?d.skateLoopPhase:d.skateTunnelPhase,vx:Number(d.skateTunnelAlongSpeed),vt:Number(d.skateTunnelCircumSpeed),air:d.skateTunnelAir,speed:d.speed,result:d.skateLastResult,serial:Number(d.skateResultSerial)};
    trace.push(s);if(++frames%20===0)window.auditTrace(s);
    if(performance.now()-start>240000){finish('Timeout');return;}
    if(mode!=='tube'){
     if(d.skateLoopPhase==='inverting')stage='loop';
     if(stage==='loop'&&!jumped&&angle>2.45&&angle<4.05){
      inverted=true;jumped=true;key(' ',true);window.auditImage(mode+'-takeoff',el.toDataURL());
     }else if(jumped){key(' ',false);sawAir ||= Number(d.rideAirHeight)>.1;}
     if(Number(d.skateLoopCompletions)>baseline){finish(inverted&&sawAir?null:'Missing loop jump');return;}
    }else{
     if(stage==='approach'&&d.skateTunnelPhase==='wall-ride'){stage='carve';key('a',true);}
     if(d.skateTunnelPhase==='wall-ride'){
      const side=Number(d.skateTunnelCameraSide);
      if(cameraSide&&side!==cameraSide){finish('Camera switched mouths');return;}
      if(side)cameraSide=side;
      if(side*Number(d.skateTunnelCameraX)<5.99){finish('Camera entered wood');return;}
     }
     if(stage==='carve'&&(Math.abs(s.vx)<.8||s.vx>0)){key('a',false);stage='orbit';}
     if(stage==='orbit'||stage==='jump'){
      // Correct longitudinal drift using real steering, including coarse GPU frames.
      const error=s.vx+p[0]*1.2;key('a',error<-.8);key('d',error>.8);
     }
     if(stage!=='approach'&&d.skateTunnelPhase==='free'){finish('Premature tube exit');return;}
     if(!inverted&&Math.abs(angle)>2.65){inverted=true;window.auditImage('tube-inverted',el.toDataURL());}
     if(stage==='orbit'&&Math.abs(angle)>2.65&&!jumped){jumped=true;jumpSerial=Number(d.skateResultSerial);key(' ',true);stage='jump';}
     else if(stage==='jump'){key(' ',false);sawAir ||= d.skateTunnelAir==='true';if(sawAir&&d.skateTunnelAir==='false'){if(Math.abs(angle)>.12){finish('Landing missed center');return;}window.auditImage('tube-centered',el.toDataURL());finish();return;}}
    }
    requestAnimationFrame(tick);
   };requestAnimationFrame(tick);
  }),mode);
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log('PASS',JSON.stringify(results));
}finally{await browser.close();}
