export type OceanObservation={stillFor:number;time:number;cooldown:number;sightings:number;phase:'quiet'|'spout'|'breach'|'splash'};
export const idleOceanObservation=():OceanObservation=>({stillFor:0,time:0,cooldown:0,sightings:0,phase:'quiet'});
/** Standing up cancels the encounter immediately; a new seat starts a fresh wait. */
export function stopOceanObservation(s:OceanObservation):OceanObservation{
 return s.phase==='quiet'&&s.stillFor===0&&s.time===0&&s.cooldown===0?s:{...idleOceanObservation(),sightings:s.sightings};
}
/** Bench-only timer: no island position, velocity, or gaze tracking. */
export function advanceOceanObservation(s:OceanObservation,dt:number,input:{seated:boolean}):OceanObservation{
 if(!input.seated)return stopOceanObservation(s);
 const delta=Math.max(0,Math.min(.5,Number.isFinite(dt)?dt:0));if(!delta)return s;
 if(s.phase!=='quiet'){const time=s.time+delta;if(time>=10)return {...s,time:0,phase:'quiet',cooldown:80,stillFor:0};return {...s,time,phase:time<2?'spout':time<6?'breach':'splash'};}
 const cooldown=Math.max(0,s.cooldown-delta),stillFor=s.stillFor+delta;
 if(stillFor>=8&&cooldown===0)return {...s,phase:'spout',time:0,stillFor:0,cooldown:0,sightings:s.sightings+1};
 return {...s,stillFor,cooldown};
}
