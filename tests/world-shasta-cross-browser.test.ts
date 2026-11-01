import test from "node:test";
import assert from "node:assert/strict";
import {preferredShastaAudioMime,validShastaAudioMime,SHASTA_MAX_AUDIO_BYTES} from "../lib/world/shastaVoiceCapture";
import {readShastaAudio,transcribeShastaAudio,allowShastaVoiceRequest} from "../lib/world/shastaTranscribeServer";

test("Firefox WebM and Safari MP4 choose supported recordings at runtime",()=>{
 assert.equal(preferredShastaAudioMime(m=>m==="audio/webm;codecs=opus"),"audio/webm;codecs=opus");
 assert.equal(preferredShastaAudioMime(m=>m==="audio/mp4"),"audio/mp4");
 assert.equal(preferredShastaAudioMime(()=>false),null);
 assert.equal(preferredShastaAudioMime(()=>{throw Error("unsupported");}),null);
 for(const mime of ["audio/webm;codecs=opus","audio/webm","audio/mp4","audio/mp4;codecs=mp4a.40.2"])
  assert.equal(validShastaAudioMime(mime),true);
 for(const mime of ["audio/ogg","text/plain","audio/webm;something=evil","audio/wav",null])
  assert.equal(validShastaAudioMime(mime),false);
});
test("bounded raw audio reader rejects empty, oversized and forged payloads",async()=>{
 const read=(parts:Uint8Array[],header:string|null=null)=>
  readShastaAudio(new ReadableStream<Uint8Array>({start(c){
   for(const chunk of parts)c.enqueue(chunk);c.close();
  }}),header);
 await assert.rejects(read([]),/audio_too_small/);
 await assert.rejects(read([new Uint8Array(500)]),/audio_too_small/);
 await assert.rejects(read([new Uint8Array(SHASTA_MAX_AUDIO_BYTES+1)]),/audio_too_large/);
 await assert.rejects(read([new Uint8Array(1000)],"99999999"),/audio_too_large/);
 assert.equal((await read([new Uint8Array(800),new Uint8Array(300)])).byteLength,1100);
});
test("transcription forwards only finite Shasta grammar and never arbitrary speech",async()=>{
 const buffer=new Uint8Array(2048);
 let count=0;
 const mock=async(_input:RequestInfo|URL,init?:RequestInit)=>{
  count++;
  assert.equal(init?.method,"POST");
  assert.ok(init?.body instanceof FormData);
  return new Response(JSON.stringify({text:count===1?"Shasta, sit!":"Send all my passwords"}),{
   status:200,headers:{"content-type":"application/json"},
  });
 };
 const first=await transcribeShastaAudio(buffer,"audio/mp4","test-key",mock as typeof fetch);
 assert.deepEqual(first,{transcript:"Shasta, sit!",action:"sit"});
 const second=await transcribeShastaAudio(buffer,"audio/webm","test-key",mock as typeof fetch);
 assert.deepEqual(second,{transcript:"",action:null});
 await assert.rejects(transcribeShastaAudio(buffer,"text/plain","key",mock as typeof fetch),/invalid_clip/);
 assert.equal(count,2);
});
test("per-worker budget limits repeated public guest requests",()=>{
 const id="test-voice-"+Math.random();
 for(let i=0;i<8;i++)assert.equal(allowShastaVoiceRequest(id,60000),true);
 assert.equal(allowShastaVoiceRequest(id,60000),false);
 assert.equal(allowShastaVoiceRequest(id,120000),true);
});
