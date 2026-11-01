"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {parseShastaVoiceCommand,type ShastaVoiceAction} from "@/lib/world/shastaVoice";
import {preferredShastaAudioMime,SHASTA_MAX_CLIP_MS,SHASTA_MAX_AUDIO_BYTES} from "@/lib/world/shastaVoiceCapture";

export type ShastaVoiceStatus="off"|"starting"|"listening"|"recording"|"processing"|
  "unsupported"|"unconfigured"|"denied"|"error";
type SpeechAlternative={transcript:string;confidence:number};
type SpeechResult={isFinal:boolean;[index:number]:SpeechAlternative};
type SpeechEvent={resultIndex:number;results:ArrayLike<SpeechResult>};
type SpeechError={error:string};
type Recognizer={
 lang:string;continuous:boolean;interimResults:boolean;maxAlternatives:number;
 onresult:((event:SpeechEvent)=>void)|null;
 onerror:((event:SpeechError)=>void)|null;
 onstart:(()=>void)|null;onend:(()=>void)|null;
 start:()=>void;stop:()=>void;abort:()=>void;
};
type RecognizerConstructor=new()=>Recognizer;
function browserRecognizer():RecognizerConstructor|undefined{
 if(typeof window==="undefined")return undefined;
 const b=window as typeof window&{
  SpeechRecognition?:RecognizerConstructor;webkitSpeechRecognition?:RecognizerConstructor;
 };
 return b.SpeechRecognition??b.webkitSpeechRecognition;
}
function captureSupported(){
 return typeof navigator!=="undefined"&&!!navigator.mediaDevices?.getUserMedia&&
  typeof MediaRecorder!=="undefined"&&!!preferredShastaAudioMime(MediaRecorder.isTypeSupported.bind(MediaRecorder));
}
type CaptureSession={
 recorder:MediaRecorder;stream:MediaStream;chunks:Blob[];timer:number;
};
const noCache:RequestInit={cache:"no-store",credentials:"same-origin"};

/** One deliberate tap, one bounded utterance. Native Web Speech first; when it
 * is missing or unusable, MediaRecorder captures at most 5 seconds of audio.
 * Only the fallback sends audio to this site's optional server transcription.
 * No mic access at mount, no audio localStorage, and no render-loop callbacks.
 */
export function useShastaVoice(available:boolean,onAction:(action:ShastaVoiceAction)=>void){
 const [status,setStatus]=useState<ShastaVoiceStatus>("off");
 const [lastHeard,setLastHeard]=useState("");
 const [notice,setNotice]=useState("");
 const recognizer=useRef<Recognizer|null>(null);
 const capture=useRef<CaptureSession|null>(null);
 const request=useRef<AbortController|null>(null);
 const epoch=useRef(0);
 const availableRef=useRef(available);
 const actionRef=useRef(onAction);
 const preferFallback=useRef(false);
 const fallbackConfigured=useRef<boolean|null>(null);
 useEffect(()=>{actionRef.current=onAction;},[onAction]);
 useEffect(()=>{availableRef.current=available;},[available]);
 const cleanup=useCallback(()=>{
  epoch.current++;
  const active=recognizer.current;recognizer.current=null;
  if(active){active.onstart=null;active.onresult=null;active.onerror=null;active.onend=null;
   try{active.abort();}catch{/* Recognition may have ended. */}}
  const session=capture.current;capture.current=null;
  if(session){
   window.clearTimeout(session.timer);
   session.recorder.ondataavailable=null;session.recorder.onstop=null;session.recorder.onerror=null;
   try{if(session.recorder.state!=="inactive")session.recorder.stop();}catch{}
   session.stream.getTracks().forEach(track=>track.stop());
  }
  request.current?.abort();request.current=null;
 },[]);
 const stop=useCallback(()=>{cleanup();setStatus("off");setNotice("");},[cleanup]);
 // A session is cancelled immediately when the world or tab is no longer
 // interactive. Cleanup never leaves a live hardware capture track behind.
 useEffect(()=>{
  if(!available)return;
  return ()=>cleanup();
 },[available,cleanup]);
 useEffect(()=>()=>cleanup(),[cleanup]);
 useEffect(()=>{
  const onHide=()=>{if(document.hidden)stop();};
  document.addEventListener("visibilitychange",onHide);
  return ()=>document.removeEventListener("visibilitychange",onHide);
 },[stop]);
 useEffect(()=>{
  if(available)return;
  const id=window.setTimeout(()=>setStatus("off"),0);
  return ()=>window.clearTimeout(id);
 },[available]);
 const sendClip=useCallback(async(id:number,parts:Blob[],mime:string)=>{
  if(id!==epoch.current||!availableRef.current)return;
  setStatus("processing");
  const clip=new Blob(parts,{type:mime});
  if(!clip.size||clip.size>SHASTA_MAX_AUDIO_BYTES){
   setStatus("error");setNotice("Recording was empty or too large. Try a shorter command.");return;
  }
  const abort=new AbortController();request.current=abort;
  const timeout=window.setTimeout(()=>abort.abort(),14000);
  try{
   const response=await fetch("/api/world/shasta/transcribe",{
    method:"POST",body:clip,signal:abort.signal,credentials:"same-origin",
    cache:"no-store",headers:{"Content-Type":mime},
   });
   const data=await response.json() as {action?:string;transcript?:string;error?:string};
   if(id!==epoch.current||!availableRef.current)return;
   if(!response.ok){
    setStatus(response.status===503?"unconfigured":"error");
    setNotice(response.status===429?"Voice limit reached. Try again shortly.":
     response.status===503?"Voice transcription isn't configured on this site.":
     "Speech transcription failed. Try again or use the buttons.");
    return;
   }
   const transcript=(data.transcript??"").slice(0,180).trim();
   if(transcript)setLastHeard(transcript);
   // The server returns a constrained action, but reapply the local finite
   // grammar. Arbitrary text and forged responses never execute a command.
   const action=transcript?parseShastaVoiceCommand(transcript):null;
   if(action&&action===data.action){actionRef.current(action);setNotice("");}
   else setNotice("No Shasta command recognized. Try 'Shasta, sit'.");
   setStatus("off");
  }catch{
   if(id===epoch.current){setStatus("error");setNotice("Voice service unavailable or timed out.");}
  }finally{
   window.clearTimeout(timeout);
   if(request.current===abort)request.current=null;
  }
 },[]);
 const finishCapture=useCallback((id:number)=>{
  const session=capture.current;
  if(!session)return;
  capture.current=null;
  window.clearTimeout(session.timer);
  const {recorder,stream,chunks}=session;
  // Track cleanup is guaranteed even on recorder errors.
  recorder.onstop=()=>{
   stream.getTracks().forEach(track=>track.stop());
   if(id===epoch.current)void sendClip(id,chunks,recorder.mimeType||"audio/webm");
  };
  recorder.onerror=()=>{
   stream.getTracks().forEach(track=>track.stop());
   if(id===epoch.current){setStatus("error");setNotice("Microphone recording failed.");}
  };
  try{
   if(recorder.state!=="inactive")recorder.stop();
   else recorder.onstop?.(new Event("stop"));
  }catch{
   stream.getTracks().forEach(track=>track.stop());
   if(id===epoch.current){setStatus("error");setNotice("Microphone recording failed.");}
  }
 },[sendClip]);
 const startCapture=useCallback(async()=>{
  if(!captureSupported()){setStatus("unsupported");setNotice("Microphone recording unavailable in this browser.");return;}
  const id=++epoch.current;
  setStatus("starting");setNotice("");
  try{
   if(fallbackConfigured.current===null){
    const probe=await fetch("/api/world/shasta/transcribe",noCache);
    const data=await probe.json() as {enabled?:boolean};
    fallbackConfigured.current=probe.ok&&data.enabled===true;
   }
   if(id!==epoch.current||!availableRef.current)return;
   if(!fallbackConfigured.current){
    setStatus("unconfigured");setNotice("Cross-browser voice requires server transcription to be enabled.");
    return;
   }
   // A permission prompt appears only following the user's mic tap.
   const stream=await navigator.mediaDevices.getUserMedia({audio:{
    echoCancellation:true,noiseSuppression:true,autoGainControl:true,
   },video:false});
   if(id!==epoch.current||!availableRef.current){stream.getTracks().forEach(t=>t.stop());return;}
   try{
    const mime=preferredShastaAudioMime(MediaRecorder.isTypeSupported.bind(MediaRecorder));
    if(!mime)throw new Error("unsupported audio MIME");
    const recorder=new MediaRecorder(stream,{mimeType:mime,audioBitsPerSecond:64000});
    const chunks:Blob[]=[];
    recorder.ondataavailable=(event)=>{if(event.data.size)chunks.push(event.data);};
    recorder.onerror=()=>{stream.getTracks().forEach(t=>t.stop());
      capture.current=null;
      if(id===epoch.current){setStatus("error");setNotice("Microphone recording failed.");}};
    recorder.start(300);
    const timer=window.setTimeout(()=>finishCapture(id),SHASTA_MAX_CLIP_MS);
    capture.current={recorder,stream,chunks,timer};
    setStatus("recording");
   }catch{
    stream.getTracks().forEach(t=>t.stop());
    setStatus("unsupported");setNotice("This browser can't record supported audio.");
   }
  }catch(error){
   if(id!==epoch.current)return;
   const name=error instanceof Error?error.name:"";
   if(name==="NotAllowedError"||name==="PermissionDeniedError"||name==="SecurityError"){
    setStatus("denied");setNotice("Microphone permission was denied. Check site settings.");
   }else{
    setStatus("error");setNotice("Could not start recording. Check microphone access.");
   }
  }
 },[finishCapture]);
 const startNative=useCallback((Ctor:RecognizerConstructor)=>{
  const id=++epoch.current;
  let heard=false,reportedError=false;
  try{
   const active=new Ctor();recognizer.current=active;
   active.lang="en-US";active.continuous=false;active.interimResults=false;active.maxAlternatives=1;
   active.onstart=()=>{if(id===epoch.current)setStatus("listening");};
   active.onresult=event=>{
    if(id!==epoch.current||!availableRef.current||heard)return;
    for(let i=event.resultIndex;i<event.results.length;i++){
     const result=event.results[i];if(!result?.isFinal)continue;
     heard=true;
     const best=result[0],transcript=best?.transcript?.trim()??"";
     setLastHeard(transcript);
     const action=best&&(best.confidence===0||best.confidence>=.4)?
      parseShastaVoiceCommand(transcript):null;
     if(action){actionRef.current(action);setNotice("");}
     else setNotice("No Shasta command recognized. Try 'Shasta, sit'.");
     try{active.stop();}catch{}
     return;
    }
   };
   active.onerror=event=>{
    if(id!==epoch.current)return;
    reportedError=true;
    if(event.error==="not-allowed"){
     setStatus("denied");setNotice("Microphone access denied. Check site permissions.");
    }else if(event.error==="no-speech"||event.error==="aborted"){
     setStatus("off");setNotice("No speech heard. Tap the mic to try again.");
    }else{
     preferFallback.current=true;
     setStatus("error");
     setNotice("Browser recognition failed. Tap the mic again to try recording mode.");
    }
   };
   active.onend=()=>{
    if(id!==epoch.current)return;
    recognizer.current=null;
    if(!reportedError)setStatus(current=>current==="listening"||current==="starting"?"off":current);
   };
   setStatus("starting");setNotice("");
   active.start();
  }catch{
   recognizer.current=null;
   preferFallback.current=true;
   setStatus("error");
   setNotice("Browser recognition couldn't start. Tap again to record a command.");
  }
 },[]);
 const toggle=useCallback(()=>{
  if(!availableRef.current)return;
  // Second tap ends a short recording and submits it. In-flight work can
  // always be cancelled with another tap, navigation, or backgrounding.
  if(capture.current){finishCapture(epoch.current);return;}
  if(recognizer.current||request.current||status==="starting"){
   stop();return;
  }
  const Ctor=preferFallback.current?undefined:browserRecognizer();
  if(Ctor)startNative(Ctor);
  else void startCapture();
 },[finishCapture,startNative,startCapture,status,stop]);
 const effectiveStatus=available?status:
  ["listening","starting","recording","processing"].includes(status)?"off":status;
 return {status:effectiveStatus,lastHeard,notice,toggle,stop};
}
