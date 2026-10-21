import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(path.join(process.env.PLAYWRIGHT_MODULE_ROOT,'package.json'))('playwright');
const out='artifacts/world/tube-return';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.WORLD_CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:800,height:600}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('auditImage',(name,data)=>fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data.split(',')[1],'base64')));
 await page.exposeFunction('auditTrace',s=>console.log(JSON.stringify(s)));
 await page.goto(process.env.WORLD_BASE_URL);console.log('Page loaded');
 await page.getByRole('button',{name:'Explore world',exact:true}).click();
 await page.waitForFunction(()=>Number(document.querySelector('canvas')?.dataset.drawCalls)>0,null,{timeout:60000});
 console.log('World rendered');
 await page.getByRole('button',{name:'Skateboarding',exact:true}).click();
 const results={};
 for(const mode of ['reverse','tube']){
  await page.getByRole('button',{name:mode==='reverse'?'Loop · reverse runway':'Hollow log · carve & return',exact:true}).click();
  await page.locator('canvas').focus();console.log('Approach',mode);
  results[mode]=await page.evaluate(mode=>new Promise((resolve,reject)=>{
   const el=document.querySelector('canvas'),pressed=new Set(),trace=[];let frames=0,stage='approach',inverted=false,jumped=false,sawAir=false,jumpSerial=0,cameraSide=0;
   const start=performance.now(),baseline=Number(el.dataset.skateLoopCompletions);
   const key=(k,on)=>{if(on)pressed.add(k);else pressed.delete(k);el.dispatchEvent(new KeyboardEvent(on?'keydown':'keyup',{key:k,code:k===' '?'Space':'Key'+k.toUpperCase(),bubbles:true,cancelable:true}));};
   const release=()=>{for(const k of [...pressed])key(k,false);};
   const finish=(error)=>{release();if(error)reject(Error(error+JSON.stringify(trace)));else resolve({inverted,jumped,sawAir,frames,trace});};
   key('w',true);
   const tick=()=>{
    const d=el.dataset,p=(d.player??'').split(',').map(Number),angle=Number(mode==='reverse'?d.skateLoopAngle:d.skateTunnelAngle);
    const s={stage,p,angle,phase:mode==='reverse'?d.skateLoopPhase:d.skateTunnelPhase,vx:Number(d.skateTunnelAlongSpeed),vt:Number(d.skateTunnelCircumSpeed),air:d.skateTunnelAir,speed:d.speed,result:d.skateLastResult,serial:Number(d.skateResultSerial)};
    trace.push(s);if(++frames%20===0)window.auditTrace(s);
    if(performance.now()-start>240000){finish('Timeout');return;}
    if(mode==='reverse'){
     if(stage==='approach'&&p[0]>25){finish('Missed reverse entrance');return;}
     if(d.skateLoopPhase==='inverting')stage='loop';
     if(stage==='loop'&&!inverted&&angle>2.45&&angle<4.05){inverted=true;window.auditImage('reverse-inverted',el.toDataURL());}
     if(Number(d.skateLoopCompletions)>baseline){finish(inverted?null:'No inversion');return;}
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
     if(stage==='orbit'&&Math.abs(angle)>6.3&&!jumped){jumped=true;jumpSerial=Number(d.skateResultSerial);key(' ',true);stage='jump';}
     else if(stage==='jump'){key(' ',false);sawAir ||= d.skateTunnelAir==='true';if(d.skateTunnelAir==='false'&&Number(d.skateResultSerial)>jumpSerial&&Number(d.skateResultPoints)>0){finish();return;}}
    }
    requestAnimationFrame(tick);
   };requestAnimationFrame(tick);
  }),mode);
 }
 await page.getByRole('button',{name:'Hollow log · bark ride',exact:true}).click();
 await page.locator('canvas').focus();
 results.bark=await page.evaluate(()=>new Promise((resolve,reject)=>{
  const el=document.querySelector('canvas'),trace=[],start=performance.now();
  let stage='settle',frames=0,baseline=0,peak=0,initialY=0;
  const key=(k,on)=>el.dispatchEvent(new KeyboardEvent(on?'keydown':'keyup',{key:k,code:k===' '?'Space':'Key'+k.toUpperCase(),bubbles:true,cancelable:true}));
  const done=error=>{key('w',false);key(' ',false);if(error)reject(Error(error+JSON.stringify(trace)));else resolve({trace,peak,initialY});};
  const tick=()=>{
   const d=el.dataset,s={stage,surface:d.skateTunnelSurface,air:d.skateTunnelAir,y:Number(d.height),p:d.player,serial:Number(d.skateResultSerial),camera:d.skateTunnelCamera};
   trace.push(s);frames++;peak=Math.max(peak,s.y);
   if(performance.now()-start>180000){done('Bark timeout');return;}
   if(stage==='settle'&&frames>=4){
    if(s.surface!=='outer'||s.camera==='true'){done('Exterior contact/camera missing');return;}
    window.auditImage('bark-standing',el.toDataURL());initialY=s.y;baseline=s.serial;stage='jump';key(' ',true);
   }else if(stage==='jump'){
    key(' ',false);
    if(s.serial>baseline&&s.air==='false'){
     if(s.surface!=='outer'||peak<initialY+.5){done('Jump did not land on bark');return;}
     window.auditImage('bark-landed',el.toDataURL());stage='exit';key('w',true);
    }
   }else if(stage==='exit'&&s.surface===''){
    if(s.y<initialY-1||d.airborne!=='true'){done('Bark exit snapped down');return;}
    window.auditImage('bark-runoff',el.toDataURL());done();return;
   }
   requestAnimationFrame(tick);
  };requestAnimationFrame(tick);
 }));
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log('PASS',JSON.stringify(results));
}finally{await browser.close();}
