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
let page;
const errors=[];
try{
 page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',e=>errors.push(e.message));
 // Deterministic speech transcript; no real microphone required in CI.
 await page.addInitScript(()=>{
  window.SpeechRecognition=class MockSpeechRecognition{
   lang='en-US';continuous=false;interimResults=false;maxAlternatives=1;
   start(){
    const text=window.__shastaMockSpeech??'Shasta, sit!';
    this.pending=setTimeout(()=>{
      this.onresult?.({resultIndex:0,results:[
        Object.assign([{transcript:text,confidence:.99}],{isFinal:true}),
      ]});
    },80);
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
 const microphone=nav.getByRole('button',{name:'Speak a Shasta command'});
 assert.equal(await microphone.isVisible(),true);
 await microphone.click();
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.shastaTrick==='sit',
   null,{timeout:25000});
 // Voice uses exactly the same animation state as the button path.
 const spoken=await page.locator('canvas').evaluate(c=>({
   trick:c.dataset.shastaTrick,phase:c.dataset.shastaTrickPhase}));
 assert.equal(spoken.trick,'sit');
 await nav.getByRole('button',{name:'Show Shasta tricks'}).click();
 const controls=nav.getByRole('group',{name:'Shasta training and tricks'});
 assert.equal(await controls.getByRole('button',{name:'Throw treat'}).isVisible(),true);
 await controls.getByRole('slider').first().fill('40');
 await controls.getByRole('button',{name:'Throw treat'}).click();
 await page.waitForFunction(()=>['pending','caught','missed'].includes(
   document.querySelector('canvas')?.dataset.shastaTreatResult),null,{timeout:10000});
 await page.waitForFunction(()=>['caught','missed'].includes(
   document.querySelector('canvas')?.dataset.shastaTreatResult),null,{timeout:25000});
 const result=await page.locator('canvas').evaluate(c=>({
   outcome:c.dataset.shastaTreatResult,distance:Number(c.dataset.shastaTreatDistance),
   score:Number(c.dataset.shastaTreatScore),phase:c.dataset.shastaTreatPhase,
   draws:Number(c.dataset.drawCalls)}));
 assert.ok(Number.isFinite(result.distance)&&result.distance>0);
 assert.ok(Number.isFinite(result.score)&&result.score>=0);
 assert.ok(result.outcome==='caught'||result.score===0);
 assert.ok(Number.isFinite(result.draws)&&result.draws>0);
 await page.getByRole('status').filter({hasText:'world m'}).first().waitFor({timeout:10000});
 await page.screenshot({path:path.join(out,'05-voice-treat-catch.png')});
 // Mobile never requires users to reopen the drawer to see a shot result.
 await page.setViewportSize({width:390,height:760});
 await page.screenshot({path:path.join(out,'06-voice-catch-mobile.png')});
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'voice-treat.json'),
   JSON.stringify({spoken,result,errors},null,2)+'\n');
 console.log('SHASTA VOICE + CATCH BROWSER PASS',JSON.stringify({spoken,result}));
}catch(e){
 try{await page?.screenshot({path:path.join(out,'voice-treat-failure.png')});}catch{}
 throw e;
}finally{await browser.close();}
