const G=window.Sylvaria091,F=G.fn,state=G.state;
const VERSION='0.11.0',SCHEMA=1,ACTION={w:[0,1],a:[2,3],s:[4,5],d:[6,7],arrowup:8,arrowdown:9,arrowleft:10,arrowright:11};
let tick=0,active=false,events=[],finalized=null,runSerial=0;
const recordedHeld=new Set;
function push(action){if(!active||state.mode!=='playing')return;const targetTick=tick+1;events.push({tick:targetTick,action});}
function reset(){tick=0;active=true;events=[];finalized=null;recordedHeld.clear();runSerial++;}
function encode(list=events){const out=[];let previous=0;for(const event of list){const delta=event.tick-previous;let value=delta*16+event.action;do{let byte=value%128;value=Math.floor(value/128);if(value)byte|=128;out.push(byte)}while(value);previous=event.tick}return Uint8Array.from(out)}
function base64url(bytes){let binary='';for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
const baseSetup=F.setupRoom;F.setupRoom=(depth,...rest)=>{const result=baseSetup(depth,...rest);if(depth===1&&state.mode==='playing'&&state.worldsCleared===0)reset();return result};
const baseMovement=F.updateMovement;F.updateMovement=(dt)=>{tick++;return baseMovement(dt)};
const baseEnd=F.endRun;F.endRun=(reason)=>{const result=baseEnd?.(reason);if(active){active=false;finalized={tick,eventCount:events.length,reason:String(reason||'run ended')}}return result};
document.addEventListener('keydown',event=>{if(!active||state.mode!=='playing'||event.repeat)return;const key=String(event.key||'').toLowerCase();const move=ACTION[key];if(Array.isArray(move)){if(recordedHeld.has(key))return;recordedHeld.add(key);push(move[0]);return}const cut=ACTION[key];if(Number.isInteger(cut))push(cut)},true);
document.addEventListener('keyup',event=>{if(!active||state.mode!=='playing')return;const key=String(event.key||'').toLowerCase(),move=ACTION[key];if(!Array.isArray(move)||!recordedHeld.has(key))return;recordedHeld.delete(key);push(move[1])},true);
function snapshot(){const bytes=encode();return{version:VERSION,schema:SCHEMA,runSerial,tick,active,durationTicks:finalized?.tick||tick,eventCount:events.length,inputBytes:bytes.length,input:base64url(bytes),events:events.map(event=>({...event})),finalized:finalized?{...finalized}:null}}
function envelope(engineHash,seed=110001){const snap=snapshot();return{schema:SCHEMA,engineVersion:VERSION,engineHash,seed,durationTicks:snap.durationTicks,input:snap.input}}
window.SylvariaReplay=Object.freeze({version:VERSION,schema:SCHEMA,snapshot,envelope});
