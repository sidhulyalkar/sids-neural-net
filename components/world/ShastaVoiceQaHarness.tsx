"use client";
import {useCallback,useState} from "react";
import {useShastaVoice} from "@/components/world/useShastaVoice";
import type {ShastaVoiceAction} from "@/lib/world/shastaVoice";

/** Dev-only host: same voice hook, no 3D/WebGL dependency. */
export default function ShastaVoiceQaHarness(){
 const [action,setAction]=useState<ShastaVoiceAction|null>(null);
 const onAction=useCallback((value:ShastaVoiceAction)=>setAction(value),[]);
 const voice=useShastaVoice(true,onAction);
 return <main style={{fontFamily:"sans-serif",padding:24}}>
  <h1>Shasta microphone QA</h1>
  <nav aria-label="Shasta voice quality assurance">
   <button type="button" onClick={voice.toggle}
    aria-pressed={["recording","listening","processing","starting"].includes(voice.status)}
    aria-label={voice.status==="recording"?"Finish Shasta voice recording":
     voice.status==="processing"?"Cancel Shasta transcription":
     voice.status==="listening"||voice.status==="starting"?"Stop Shasta voice control":
     "Speak a Shasta command"}>Microphone</button>
   <button type="button" onClick={voice.stop}>Cancel</button>
  </nav>
  <div role="status">{voice.notice||voice.status}</div>
  <output data-testid="shasta-voice-action">{action??"none"}</output>
 </main>;
}
