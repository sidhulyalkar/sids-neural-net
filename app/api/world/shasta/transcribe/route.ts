import {allowShastaVoiceRequest,readShastaAudio,transcribeShastaAudio} from "@/lib/world/shastaTranscribeServer";
import {validShastaAudioMime} from "@/lib/world/shastaVoiceCapture";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const json=(value:object,status=200)=>Response.json(value,{status,headers:{
 "Cache-Control":"no-store","X-Content-Type-Options":"nosniff",
}});
function configured(){
 return process.env.SHASTA_VOICE_TRANSCRIPTION_ENABLED==="true"&&
  !!process.env.OPENAI_API_KEY?.trim();
}
export async function GET(){
 return json({enabled:configured()});
}
export async function POST(request:Request){
 if(!configured())return json({error:"not_configured"},503);
 const url=new URL(request.url);
 const origin=request.headers.get("origin");
 // No cross-origin uploads. Not a replacement for external WAF quotas.
 if(!origin||origin!==url.origin||
  (request.headers.get("sec-fetch-site")&&!["same-origin","none"].includes(
   request.headers.get("sec-fetch-site")!)))
  return json({error:"invalid_origin"},403);
 const mime=request.headers.get("content-type");
 if(!validShastaAudioMime(mime))return json({error:"invalid_format"},415);
 const ip=(request.headers.get("x-forwarded-for")??"unknown").split(",")[0].trim().slice(0,80);
 if(!allowShastaVoiceRequest(ip))return json({error:"rate_limited"},429);
 try{
  const bytes=await readShastaAudio(request.body,request.headers.get("content-length"));
  const result=await transcribeShastaAudio(bytes,mime!,process.env.OPENAI_API_KEY!);
  return json(result);
 }catch(error){
  const msg=error instanceof Error?error.message:"";
  if(msg==="audio_too_large"||msg==="audio_too_small"||msg==="missing_audio"||
   msg==="invalid_clip")return json({error:msg},400);
  // Never echo provider errors, transcripts, audio, or credentials.
  return json({error:"transcription_failed"},502);
 }
}
