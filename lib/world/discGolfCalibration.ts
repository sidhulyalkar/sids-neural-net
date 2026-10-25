/** Calibration entry point for real tracked flight observations. This tool
 * does NOT manufacture coefficients from disc speed/glide marketing ratings.
 * Accepts time-aligned 3D measurements in metres and actual release data,
 * then fits a *small* parameter subset with held-out error reporting.
 */
import {DISC_GOLF_AERO_PROFILES,type AeroDisc,
 type DiscGolfFlightStyle,type DiscGolfReleaseStyle} from "./discGolfAerodynamics";
import {initializeRigidDisc,stepRigidDisc,type V3,type RigidFlight} from "./discGolfRigidBody";
export type FlightSample={timeSeconds:number;position:V3};
export type MeasuredDiscThrow={
 discStyle:DiscGolfFlightStyle;releaseStyle:DiscGolfReleaseStyle;
 initialPosition:V3;headingRadians:number;launchDegrees:number;
 bankDegrees:number;noseDegrees:number;spinRpm:number;speedMps:number;
 windMps:V3;samples:readonly FlightSample[];
};
export type CalibrationResult={profile:AeroDisc;trainingRmseMeters:number;
 validationRmseMeters:number;sampleCount:number;
 status:"nominal"|"candidate-not-validated"};
const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
export function validateMeasuredThrow(t:MeasuredDiscThrow):void{
 if(t.samples.length<5)throw new Error("At least five airborne 3D samples are required");
 if(t.samples.length>500)throw new Error("Too many tracked samples");
 const numbers=[...Object.values(t.initialPosition),t.headingRadians,t.launchDegrees,
  t.bankDegrees,t.noseDegrees,t.spinRpm,t.speedMps,...Object.values(t.windMps)];
 if(!numbers.every(Number.isFinite))throw new Error("Non-finite release parameter");
 if(t.speedMps<=0||t.speedMps>65||t.spinRpm<0||t.spinRpm>2000)
  throw new Error("Release speed/spin outside supported physics envelope");
 let last=-1;
 for(const sample of t.samples){
  if(!Number.isFinite(sample.timeSeconds)||sample.timeSeconds<=last||
     sample.timeSeconds<0||sample.timeSeconds>12||
     !Object.values(sample.position).every(Number.isFinite))
    throw new Error("Samples must have finite, increasing flight times");
  last=sample.timeSeconds;
 }
}
export function simulateDiscObservations(
 t:MeasuredDiscThrow,profile:AeroDisc=DISC_GOLF_AERO_PROFILES[t.discStyle],
):FlightSample[]{
 validateMeasuredThrow(t);
 const heading=t.headingRadians,launch=t.launchDegrees*Math.PI/180;
 const spin=t.spinRpm,dir={x:Math.sin(heading),z:Math.cos(heading)};
 let state:RigidFlight={
  rigid:initializeRigidDisc(heading,t.launchDegrees+t.noseDegrees,
    t.bankDegrees,spin,t.releaseStyle,t.discStyle),
  velocity:{x:dir.x*t.speedMps*Math.cos(launch),
   y:t.speedMps*Math.sin(launch),z:dir.z*t.speedMps*Math.cos(launch)},
  spinRpm:spin,discStyle:t.discStyle,releaseStyle:t.releaseStyle,model:profile,
 };
 let position={...t.initialPosition},time=0;
 const result:FlightSample[]=[];
 for(const observation of t.samples){
  while(time<observation.timeSeconds-1e-10){
   const dt=Math.min(.0125,observation.timeSeconds-time);
   const next=stepRigidDisc(state,t.windMps,dt);
   state=next.state;
   position={x:position.x+state.velocity.x*dt,
    y:position.y+state.velocity.y*dt,z:position.z+state.velocity.z*dt};
   time+=dt;
  }
  result.push({timeSeconds:observation.timeSeconds,position:{...position}});
 }
 return result;
}
function error(t:MeasuredDiscThrow,profile:AeroDisc,indexes:readonly number[]):number{
 const path=simulateDiscObservations(t,profile);
 let squared=0;
 for(const i of indexes){
  const a=path[i].position,b=t.samples[i].position;
  squared+=(a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2;
 }
 return Math.sqrt(squared/Math.max(1,indexes.length));
}
/** Coordinate search produces only a *candidate* fit. It does not imply
 * scientific validation; that requires separate throwers and wind records.
 * Never fit inertia and moments simultaneously to a single sparse throw. */
export function fitRecordedDiscThrow(t:MeasuredDiscThrow,passes=2):CalibrationResult{
 validateMeasuredThrow(t);
 const profile={...DISC_GOLF_AERO_PROFILES[t.discStyle]};
 const end=Math.max(4,Math.floor(t.samples.length*.8));
 const train=Array.from({length:end},(_,i)=>i);
 const held=Array.from({length:t.samples.length-end},(_,i)=>end+i);
 const keys=["lift0","drag0","moment0"] as const;
 const scales={lift0:.075,drag0:.045,moment0:.013};
 let best=error(t,profile,train);
 for(let pass=0;pass<clamp(passes,0,5);pass++){
  for(const key of keys){
   let chosen=profile[key],score=best;
   for(const direction of [-1,1]){
    const trial={...profile,[key]:clamp(profile[key]+
     direction*scales[key]/(pass+1),key==="moment0"?-.06:.015,
     key==="moment0"?.06:key==="drag0"?.5:.65)};
    const value=error(t,trial,train);
    if(value<score){score=value;chosen=trial[key];}
   }
   profile[key]=chosen;best=score;
  }
 }
 return {profile,trainingRmseMeters:best,
  validationRmseMeters:error(t,profile,held),
  sampleCount:t.samples.length,status:passes>0?"candidate-not-validated":"nominal"};
}
