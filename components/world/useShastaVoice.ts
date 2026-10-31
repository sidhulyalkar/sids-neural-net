"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {parseShastaVoiceCommand,type ShastaVoiceAction} from "@/lib/world/shastaVoice";

export type ShastaVoiceStatus="off"|"listening"|"unsupported"|"denied"|"error";
type SpeechAlternative={transcript:string;confidence:number};
type SpeechResult={isFinal:boolean;[index:number]:SpeechAlternative};
type SpeechEvent={resultIndex:number;results:ArrayLike<SpeechResult>};
type SpeechError={error:string};
type Recognizer={
 lang:string;continuous:boolean;interimResults:boolean;maxAlternatives:number;
 onresult:((event:SpeechEvent)=>void)|null;
 onerror:((event:SpeechError)=>void)|null;
 onend:(()=>void)|null;
 start:()=>void;stop:()=>void;abort:()=>void;
};
type RecognizerConstructor=new()=>Recognizer;
function browserRecognizer():RecognizerConstructor|undefined {
  if(typeof window==="undefined")return undefined;
  const browser=window as unknown as {
    SpeechRecognition?:RecognizerConstructor;webkitSpeechRecognition?:RecognizerConstructor;
  };
  return browser.SpeechRecognition??browser.webkitSpeechRecognition;
}

/** Single utterance per explicit tap. No audio buffers, external SDK or render-loop listeners. */
export function useShastaVoice(available:boolean,onAction:(action:ShastaVoiceAction)=>void){
  const [status,setStatus]=useState<ShastaVoiceStatus>("off");
  const [lastHeard,setLastHeard]=useState("");
  const recognizer=useRef<Recognizer|null>(null);
  const epoch=useRef(0);
  const availableRef=useRef(available);
  const onActionRef=useRef(onAction);
  useEffect(()=>{onActionRef.current=onAction;},[onAction]);
  useEffect(()=>{availableRef.current=available;},[available]);
  const stop=useCallback(()=>{
    epoch.current++;
    const active=recognizer.current;
    recognizer.current=null;
    if(active){active.onresult=null;active.onerror=null;active.onend=null;
      try{active.abort();}catch{/* Browser may have already stopped. */}}
    setStatus("off");
  },[]);
  // Cancelling the resource belongs in the effect cleanup. Deriving the
  // exposed status from the active resource avoids effect-driven state updates.
  useEffect(()=>{
    if(!available)return;
    return ()=>{
      epoch.current++;
      const active=recognizer.current;recognizer.current=null;
      if(active){active.onresult=null;active.onerror=null;active.onend=null;
        try{active.abort();}catch{/* Already stopped. */}}
    };
  },[available]);
  useEffect(()=>()=>{epoch.current++;const active=recognizer.current;
    recognizer.current=null;if(active){active.onresult=null;active.onerror=null;active.onend=null;
      try{active.abort();}catch{/* Browser shutdown. */}}
  },[]);
  const toggle=useCallback(()=>{
    if(recognizer.current){stop();return;}
    if(!availableRef.current)return;
    const Constructor=browserRecognizer();
    if(!Constructor){setStatus("unsupported");return;}
    const id=++epoch.current;
    let heard=false;
    try{
      const active=new Constructor();
      recognizer.current=active;
      active.lang="en-US";active.continuous=false;
      active.interimResults=false;active.maxAlternatives=1;
      active.onresult=(event)=>{
        if(id!==epoch.current||!availableRef.current||heard)return;
        for(let i=event.resultIndex;i<event.results.length;i++){
          const result=event.results[i];
          if(!result?.isFinal)continue;
          heard=true;
          const best=result[0];
          const transcript=best?.transcript?.trim()??"";
          setLastHeard(transcript);
          const action=transcript && (best.confidence===0||best.confidence>=.4)
            ?parseShastaVoiceCommand(transcript):null;
          if(action)onActionRef.current(action);
          try{active.stop();}catch{/* Recognition already ended. */}
          return;
        }
      };
      active.onerror=(event)=>{
        if(id!==epoch.current)return;
        setStatus(event.error==="not-allowed"||event.error==="service-not-allowed"?
          "denied":event.error==="no-speech"||event.error==="aborted"?"off":"error");
      };
      active.onend=()=>{
        if(id!==epoch.current)return;
        recognizer.current=null;
        setStatus(previous=>previous==="listening"?"off":previous);
      };
      active.start();
      setStatus("listening");
    }catch{
      recognizer.current=null;
      setStatus("error");
    }
  },[stop]);
  const effectiveStatus=available&&recognizer.current?status:
    status==="listening"?"off":status;
  return {status:effectiveStatus,lastHeard,toggle,stop};
}
