const G=window.Sylvaria091,F=G.fn,state=G.state;
const VERSION='0.13.0',SCHEMA=2,MAX_EVENTS=24000,MAX_TICKS=144000,MAX_BYTES=128*1024;
const ACTION={w:[0,1],a:[2,3],s:[4,5],d:[6,7],arrowup:8,arrowdown:9,arrowleft:10,arrowright:11,space:[12,13]};
let tick=0,active=false,eligible=true,overflowReason=null,events=[],finalized=null,runSerial=0;
const held=new Set;
function invalidate(reason){eligible=false;overflowReason||=reason;active=false}
function push(action){if(!active||state.mode!=='playing')return;if(tick+1>MAX_TICKS){invalidate('duration limit');return}if(events.length>=MAX_EVENTS){invalidate('input event limit');return}events.push({tick:tick+1,action})}
function reset(){tick=0;active=true;eligible=true;overflowReason=null;events=[];finalized=null;held.clear();runSerial++}
function encode(list=events){const out=[];let previous=0;for(const event of list){const delta=event.tick-previous;let value=delta*16+event.action;do{let byte=value%128;value=Math.floor(value/128);if(value)byte|=128;out.push(byte);if(out.length>MAX_BYTES){invalidate('encoded input limit');return Uint8Array.from(out.slice(0,MAX_BYTES))}}while(value);previous=event.tick}return Uint8Array.from(out)}
function base64url(bytes){let binary='';for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function normalizedKey(event){return event.code==='Space'?'space':String(event.key||'').toLowerCase()}
const baseSetup=F.setupRoom;F.setupRoom=(depth,...rest)=>{const result=baseSetup(depth,...rest);if(depth===1&&state.mode==='playing'&&state.worldsCleared===0)reset();return result};
const baseMovement=F.updateMovement;F.updateMovement=(dt)=>{tick++;if(active&&tick>MAX_TICKS)invalidate('duration limit');return baseMovement(dt)};
const baseEnd=F.endRun;F.endRun=(reason)=>{const result=baseEnd?.(reason);if(active){active=false;finalized={tick,eventCount:events.length,reason:String(reason||'run ended')}}return result};
document.addEventListener('keydown',event=>{if(!active||state.mode!=='playing'||event.repeat)return;const key=normalizedKey(event),action=ACTION[key];if(Array.isArray(action)){if(held.has(key))return;held.add(key);push(action[0]);return}if(Number.isInteger(action))push(action)},true);
document.addEventListener('keyup',event=>{if(!active||state.mode!=='playing')return;const key=normalizedKey(event),action=ACTION[key];if(!Array.isArray(action)||!held.has(key))return;held.delete(key);push(action[1])},true);
document.addEventListener('visibilitychange',()=>{if(active&&document.hidden)invalidate('visibility changed')},true);
window.addEventListener?.('blur',()=>{if(active&&held.has('space'))invalidate('focus lost during dash charge')});
function snapshot(){const bytes=encode();return{version:VERSION,schema:SCHEMA,runSerial,tick,active,eligible,overflowReason,durationTicks:finalized?.tick||Math.min(tick,MAX_TICKS),eventCount:events.length,inputBytes:bytes.length,input:base64url(bytes),events:events.map(event=>({...event})),finalized:finalized?{...finalized}:null,limits:{events:MAX_EVENTS,ticks:MAX_TICKS,bytes:MAX_BYTES}}}
function envelope(engineHash,seed=110001){const snap=snapshot();if(!snap.eligible)throw new Error(`ranked replay ineligible: ${snap.overflowReason}`);return{schema:SCHEMA,engineVersion:VERSION,engineHash,seed,durationTicks:snap.durationTicks,input:snap.input}}
window.SylvariaReplay=Object.freeze({version:VERSION,schema:SCHEMA,snapshot,envelope});
