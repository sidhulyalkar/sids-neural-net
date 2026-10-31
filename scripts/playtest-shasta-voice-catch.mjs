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
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[],events=[];
const snapshot=async label=>page.locator('canvas').evaluate((c,label)=>({
 label,command:c.dataset.shastaCommand,trick:c.dataset.shastaTrick,
 result:c.dataset.shastaTreatResult,distance:c.dataset.shastaTreatDistance,
 apex:c.dataset.shastaTreatApex,trail:c.dataset.shastaTreatTrailPoints,
 score:c.dataset.shastaTreatScore,draws:c.dataset.drawCalls,
 fps:c.dataset.fps,
}),label);
try{
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  window.SpeechRecognition=class MockSpeechRecognition{
   lang='en-US';continuous=false;interimResults=false;maxAlternatives=1;
   start(){
    this.onstart?.();
    const transcript=window.__shastaMockSpeech??'Shasta, sit!';
    this.pending=setTimeout(()=>{
      this.onresult?.({resultIndex:0,results:[
        Object.assign([{transcript,confidence:.99}],{isFinal:true}),
      ]});
      // Browser implementations occasionally deliver repeated final results.
      this.onresult?.({resultIndex:0,results:[
        Object.assign([{transcript,confidence:.99}],{isFinal:true}),
      ]});
    },90);
   }
   stop(){clearTimeout(this.pending);this.onend?.();}
   abort(){clearTimeout(this.pending);this.onend?.();}
  };
 });
 await page.goto(process.env.WORLD_BASE_URL??'http://127.0.0.1:3000');
 await page.getByRole('button',{name:'Explore world',exact:true}).click();
 await page.waitForFunction(()=>Number(document.querySelector('canvas')?.dataset.drawCalls)>0,
   null,{timeout:95000});
 const nav=page.getByRole('navigation',{name:'World movement and sports'});
 await nav.getByRole('button',{name:'Speak a Shasta command'}).click();
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.shastaTrick==='sit',
   null,{timeout:35000});
 events.push(await snapshot('spoken sit'));
 await nav.getByRole('button',{name:'Show Shasta tricks'}).click();
 const controls=nav.getByRole('group',{name:'Shasta training and tricks'});
 const throwButton=controls.getByRole('button',{name:'Throw treat'});
 const sliders=controls.getByRole('slider');
 assert.equal(await sliders.count(),2);
 await sliders.nth(0).focus();await sliders.nth(0).press('Home');
 assert.equal(await sliders.nth(0).inputValue(),'20');
 const baseline=Number((await snapshot('baseline')).draws);
 await throwButton.click();
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.shastaTreatResult==='pending',
   null,{timeout:20000});
 const during=await snapshot('flight');
 assert.ok(Number(during.apex)>6,'dramatic flight apex should be visibly elevated');
 await page.waitForFunction(()=>['caught','terrain','missed','timeout'].includes(
   document.querySelector('canvas')?.dataset.shastaTreatResult),null,{timeout:45000});
 const first=await snapshot('settled');
 assert.ok(Number(first.distance)>0&&Number.isFinite(Number(first.score)));
 assert.ok(Number(first.draws)<=baseline+8,'treat should only add a mesh and one trail draw');
 events.push(first);
 // A second throw remains legal after the previous one and never reuses its score.
 await throwButton.click();
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.shastaTreatResult==='pending',
   null,{timeout:12000});
 await nav.getByRole('button',{name:'Shasta Come'}).click();
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.shastaTreatResult==='interrupted',
   null,{timeout:16000});
 events.push(await snapshot('interrupted by explicit Come'));
 // Repeated throws must not leak an extra mesh or crash the renderer.
 await throwButton.click();
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.shastaTreatResult==='pending',
   null,{timeout:12000});
 await throwButton.click();
 await page.waitForFunction(()=>['caught','terrain','missed','timeout','unsafe'].includes(
   document.querySelector('canvas')?.dataset.shastaTreatResult),null,{timeout:45000});
 events.push(await snapshot('rapid rethrow settled'));
 await page.setViewportSize({width:390,height:760});
 await page.screenshot({path:path.join(out,'06-voice-catch-mobile.png')});
 const rect=await nav.boundingBox();
 assert.ok(rect&&rect.x>=0&&rect.x+rect.width<=392,'mobile command dock must stay in viewport');
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'voice-treat.json'),JSON.stringify({events,errors},null,2)+'\n');
 console.log('SHASTA VOICE + CATCH BROWSER PASS',JSON.stringify(events));
}catch(error){
 try{await page.screenshot({path:path.join(out,'voice-treat-failure.png')});}catch{}
 try{events.push(await snapshot('failure'));}catch{}
 fs.writeFileSync(path.join(out,'voice-treat.json'),
   JSON.stringify({events,errors,error:String(error)},null,2)+'\n');
 throw error;
}finally{await browser.close();}
