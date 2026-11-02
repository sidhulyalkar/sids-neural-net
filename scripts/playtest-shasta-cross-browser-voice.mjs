import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const kind=process.env.SHASTA_BROWSER??'chromium';
if(!['chromium','firefox','webkit'].includes(kind))throw Error('unsupported browser kind');
const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error('PLAYWRIGHT_MODULE_ROOT required');
const playwright=createRequire(path.join(root,'package.json'))('playwright');
const browser=await playwright[kind].launch({headless:true,
 ...(kind==='chromium'?{args:['--no-sandbox','--enable-unsafe-swiftshader']}:{}),
});
const out=path.join(process.env.WORLD_AUDIT_DIR??'artifacts/world/shasta-cross-browser',kind);
fs.mkdirSync(out,{recursive:true});
const page=await browser.newPage({viewport:{width:kind==='webkit'?390:1280,height:kind==='webkit'?760:800}});
const errors=[],requests=[];
let providerEnabled=true;
try{
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/world/shasta/transcribe',async route=>{
  const req=route.request();
  requests.push({method:req.method(),type:req.headers()['content-type']??''});
  if(req.method()==='GET'){
   await route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({enabled:providerEnabled})});return;
  }
  const bytes=req.postDataBuffer();
  // WebKit inspection may omit valid streamed Blob request bodies.
  // Also verify the real Blob size at the browser fetch boundary.
  if(bytes)assert.ok(bytes.byteLength>=512);
  assert.ok(/audio\/(mp4|webm)/.test(req.headers()['content-type']??''));
  await route.fulfill({status:200,contentType:'application/json',
   body:JSON.stringify({action:'sit',transcript:'Shasta, sit!'})});
 });
 await page.addInitScript(browserKind=>{
  // Exercise the fallback even on engines that happen to support Web Speech.
  Object.defineProperty(window,'SpeechRecognition',{configurable:true,value:undefined});
  Object.defineProperty(window,'webkitSpeechRecognition',{configurable:true,value:undefined});
  window.__shastaTest={stops:0,started:0,denied:false,postedSize:0,postedType:'',fetchPosts:0,clipIds:[]};
  const originalFetch=window.fetch.bind(window);
  window.fetch=(input,init)=>{
   if(String(input).includes('/api/world/shasta/transcribe')&&init?.method==='POST'){
    window.__shastaTest.postedSize=init.body?.size??0;
    window.__shastaTest.postedType=init.body?.type??'';
    window.__shastaTest.fetchPosts++;
    window.__shastaTest.clipIds.push(init.headers?.['X-Shasta-Voice-Clip']);
   }
   return originalFetch(input,init);
  };
  const fakeStream={
   getTracks(){return [{stop(){window.__shastaTest.stops++;}}];},
  };
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{
   async getUserMedia(){
    if(window.__shastaTest.denied)throw new DOMException('denied','NotAllowedError');
    return fakeStream;
   },
  }});
  class MockMediaRecorder{
   static isTypeSupported(mime){
    // Force Safari's MP4 transport on WebKit and WebM on Firefox/Chromium.
    return browserKind==='webkit'?mime==='audio/mp4':mime==='audio/webm;codecs=opus';
   }
   state='inactive';
   mimeType=browserKind==='webkit'?'audio/mp4':'audio/webm;codecs=opus';
   ondataavailable=null;onstop=null;onerror=null;
   constructor(stream){this.stream=stream;}
   start(){this.state='recording';window.__shastaTest.started++;}
   stop(){
    this.state='inactive';
    queueMicrotask(()=>{
     this.ondataavailable?.({data:new Blob([new Uint8Array(1024)],{type:this.mimeType})});
     this.onstop?.(new Event('stop'));
    });
   }
  }
  Object.defineProperty(window,'MediaRecorder',{configurable:true,value:MockMediaRecorder});
 },kind);
 const readyProbe=page.waitForResponse(response=>
  response.url().includes('/api/world/shasta/transcribe')&&
  response.request().method()==='GET',{timeout:25000});
 await page.goto((process.env.WORLD_BASE_URL??'http://127.0.0.1:3000')+
  '/world/voice-qa',{waitUntil:'domcontentloaded'});
 await readyProbe;
 const nav=page.getByRole('navigation',{name:'Shasta voice quality assurance'});
 await nav.getByRole('button',{name:'Speak a Shasta command'}).waitFor();
 // Firefox's development StrictMode hydration/effect replay can invalidate a
 // click delivered before the initial configuration effect has settled.
 await page.waitForTimeout(150);
 await nav.getByRole('button',{name:'Speak a Shasta command'}).click();
 try{
  await nav.getByRole('button',{name:'Finish Shasta voice recording'}).waitFor({timeout:12000});
 }catch(error){
  const diagnostic=await page.evaluate(()=>({
   text:document.querySelector('[role="status"]')?.textContent,
   hidden:document.hidden,
   state:document.visibilityState,
   mock:window.__shastaTest,
   label:document.querySelector('nav button')?.getAttribute('aria-label'),
  }));
  console.error('SHASTA MICROPHONE START DIAGNOSTIC',JSON.stringify(diagnostic));
  throw error;
 }
 const capture=await page.evaluate(()=>({...window.__shastaTest}));
 assert.equal(capture.started,1);
 await nav.getByRole('button',{name:'Finish Shasta voice recording'}).click();
 await page.waitForFunction(()=>
  document.querySelector('[data-testid="shasta-voice-action"]')?.textContent==='sit',
  null,{timeout:20000});
 await nav.getByRole('button',{name:'Speak a Shasta command'}).waitFor({timeout:12000});
 const uploaded=await page.evaluate(()=>({...window.__shastaTest}));
 assert.equal(uploaded.fetchPosts,1,'exactly one browser fetch per recording');
 assert.match(uploaded.clipIds[0],/^[a-f0-9-]{36}$/i);
 assert.ok(uploaded.postedSize>=512,'browser must submit an audio Blob');
 assert.ok(uploaded.postedType.startsWith('audio/'),'audio MIME must be set');
 assert.ok(uploaded.stops>=1);
 // Permission denied must not submit audio, and a second tap must be retryable.
 await page.evaluate(()=>{window.__shastaTest.denied=true;});
 await nav.getByRole('button',{name:'Speak a Shasta command'}).click();
 await page.getByRole('status').filter({hasText:'Microphone permission was denied'}).first()
  .waitFor({timeout:12000});
 assert.equal((await page.evaluate(()=>window.__shastaTest.fetchPosts)),1);
 await page.screenshot({path:path.join(out,'fallback-and-denial.png')});
 await page.evaluate(()=>{window.__shastaTest.denied=false;});
 await nav.getByRole('button',{name:'Speak a Shasta command'}).click();
 await nav.getByRole('button',{name:'Finish Shasta voice recording'}).waitFor({timeout:12000});
 // Tab hide guarantees track cleanup and no second upload.
 await page.evaluate(()=>{
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
  document.dispatchEvent(new Event('visibilitychange'));
 });
 await nav.getByRole('button',{name:'Speak a Shasta command'}).waitFor({timeout:12000});
 assert.ok((await page.evaluate(()=>window.__shastaTest.stops))>=2);
 assert.equal((await page.evaluate(()=>window.__shastaTest.fetchPosts)),1);
 // Browser's native recognition can exist but fail with a network/service
 // error. The next deliberate tap must use fallback, not dismiss a ghost
 // recognizer instance.
 await page.evaluate(()=>{
  Object.defineProperty(document,'hidden',{configurable:true,value:false});
  Object.defineProperty(window,'SpeechRecognition',{configurable:true,value:
   class FailingSpeechRecognition{
    start(){queueMicrotask(()=>this.onerror?.({error:'network'}));}
    abort(){}
    stop(){}
   },
  });
 });
 await nav.getByRole('button',{name:'Speak a Shasta command'}).click();
 await page.getByRole('status').filter({hasText:'Browser recognition failed'}).first()
  .waitFor({timeout:12000});
 await nav.getByRole('button',{name:'Speak a Shasta command'}).click();
 await nav.getByRole('button',{name:'Finish Shasta voice recording'}).waitFor({timeout:12000});
 await nav.getByRole('button',{name:'Finish Shasta voice recording'}).click();
 await page.waitForFunction(()=>window.__shastaTest?.fetchPosts===2,
  null,{timeout:12000});
 await nav.getByRole('button',{name:'Speak a Shasta command'}).waitFor({timeout:12000});

 // When the server says the paid feature is disabled, no microphone prompt
 // or recording is allowed. New page clears the old session/recognizer.
 providerEnabled=false;
 const probe=page.waitForResponse(r=>r.url().includes('/api/world/shasta/transcribe')&&
  r.request().method()==='GET',{timeout:12000});
 await page.reload({waitUntil:'domcontentloaded'});
 await probe;
 await page.waitForTimeout(150);
 const startedBefore=await page.evaluate(()=>window.__shastaTest.started);
 await nav.getByRole('button',{name:'Speak a Shasta command'}).click();
 await page.getByRole('status').filter({hasText:'Cross-browser voice requires server transcription'}).first()
  .waitFor({timeout:12000});
 assert.equal((await page.evaluate(()=>window.__shastaTest.started)),startedBefore,
  'disabled provider must never open the microphone');
 assert.deepEqual(errors,[]);
 const info={browser:kind,requests,errors,trackStops:await page.evaluate(()=>window.__shastaTest.stops)};
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(info,null,2)+'\n');
 console.log('SHASTA CROSS BROWSER FALLBACK PASS',JSON.stringify(info));
}catch(error){
 await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({browser:kind,requests,errors,error:String(error)},null,2));
 throw error;
}finally{await browser.close();}
