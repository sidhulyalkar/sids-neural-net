import {parseShastaVoiceCommand} from "./shastaVoice";
import {SHASTA_MAX_AUDIO_BYTES,validShastaAudioMime} from "./shastaVoiceCapture";

type ProviderResponse={text?:unknown};
export type ShastaTranscriptionResult={transcript:string;action:ReturnType<typeof parseShastaVoiceCommand>};
const BUCKETS=new Map<string,{minute:number;count:number;day:number;daily:number}>();
const RECENT_CLIPS=new Map<string,number>();
/** A bounded, short-lived replay guard. No audio/transcripts are retained. */
export function firstShastaVoiceClip(ip:string,id:string,now=Date.now()){
 if(!/^[a-f0-9-]{36}$/i.test(id))return false;
 if(RECENT_CLIPS.size>1000){
  for(const [k,t] of RECENT_CLIPS)if(now-t>60000)RECENT_CLIPS.delete(k);
  if(RECENT_CLIPS.size>1000)RECENT_CLIPS.clear();
 }
 const key=ip+":"+id,seen=RECENT_CLIPS.get(key);
 if(seen!==undefined&&now-seen<60000)return false;
 RECENT_CLIPS.set(key,now);return true;
}

/** Best-effort per-worker rate limiting. A distributed WAF/KV quota is
 * still necessary for public high-volume production deployments.
 */
export function allowShastaVoiceRequest(key:string,now=Date.now()){
 if(BUCKETS.size>4096){
  for(const [id,b] of BUCKETS)if(now-b.day>86400000)BUCKETS.delete(id);
  if(BUCKETS.size>4096)BUCKETS.clear();
 }
 const minute=Math.floor(now/60000),day=Math.floor(now/86400000);
 const current=BUCKETS.get(key);
 const count=current?.minute===minute?current.count:0;
 const daily=current?.day===day?current.daily:0;
 if(count>=8||daily>=80)return false;
 BUCKETS.set(key,{minute,count:count+1,day,daily:daily+1});
 return true;
}
export async function readShastaAudio(
 body:ReadableStream<Uint8Array>|null,sizeHeader:string|null,
):Promise<Uint8Array>{
 if(!body)throw new Error("missing_audio");
 const stated=sizeHeader?Number(sizeHeader):0;
 if(!Number.isFinite(stated)||stated>SHASTA_MAX_AUDIO_BYTES)throw new Error("audio_too_large");
 const reader=body.getReader(),parts:Uint8Array[]=[];
 let total=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   total+=value.byteLength;
   if(total>SHASTA_MAX_AUDIO_BYTES)throw new Error("audio_too_large");
   parts.push(value);
  }
 }catch(error){void reader.cancel();throw error;}
 finally{reader.releaseLock();}
 if(total<512)throw new Error("audio_too_small");
 const out=new Uint8Array(total);let offset=0;
 for(const p of parts){out.set(p,offset);offset+=p.byteLength;}
 return out;
}
export async function transcribeShastaAudio(
 bytes:Uint8Array,mime:string,apiKey:string,
 fetcher:typeof fetch=fetch,
):Promise<ShastaTranscriptionResult>{
 if(!validShastaAudioMime(mime)||bytes.length<512||bytes.length>SHASTA_MAX_AUDIO_BYTES)
  throw new Error("invalid_clip");
 const form=new FormData();
 const extension=mime.toLowerCase().includes("mp4")?"mp4":"webm";
 form.append("file",new Blob([Uint8Array.from(bytes)],{type:mime}),"shasta-command."+extension);
 form.append("model","gpt-transcribe");
 // GPT-Transcribe uses a languages array rather than the legacy
 // singular language parameter. Autodetect is safer than an ambiguous raw
 // multipart encoding when requesting one short English command.
 form.append("prompt","Short command to a husky named Shasta: come, go, sit, down, stay, jump, spin left, spin right, roll left, roll right, shake left paw, shake right paw, catch the treat.");
 const response=await fetcher("https://api.openai.com/v1/audio/transcriptions",{
  method:"POST",body:form,headers:{Authorization:"Bearer "+apiKey},
  signal:AbortSignal.timeout(12000),cache:"no-store",
 });
 if(!response.ok)throw new Error("transcription_upstream_unavailable");
 const json=await response.json() as ProviderResponse;
 const text=typeof json.text==="string"?json.text.trim().slice(0,180):"";
 const action=parseShastaVoiceCommand(text);
 // Keep arbitrary speech from escaping this tiny game-command endpoint.
 return {transcript:action?text:"",action};
}
