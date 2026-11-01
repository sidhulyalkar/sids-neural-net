/** MediaRecorder formats accepted by the server transcription endpoint.
 * Safari commonly uses MP4; Chromium and Firefox generally use WebM.
 * The capability check decides, never a browser user-agent string.
 */
export const SHASTA_MAX_CLIP_MS=5000;
export const SHASTA_MAX_AUDIO_BYTES=1024*1024;
export const SHASTA_AUDIO_MIMES=[
 "audio/webm;codecs=opus","audio/mp4","audio/webm",
] as const;
export function preferredShastaAudioMime(supported:(mime:string)=>boolean):string|null{
 for(const mime of SHASTA_AUDIO_MIMES){
  try{if(supported(mime))return mime;}catch{/* Some implementations throw. */}
 }
 return null;
}
export function validShastaAudioMime(value:string|null):boolean{
 if(!value)return false;
 return /^audio\/(?:webm|mp4)(?:;\s*codecs=[a-z0-9.,-]+)?$/i.test(value);
}
