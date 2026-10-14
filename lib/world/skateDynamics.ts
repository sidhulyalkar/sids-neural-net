/**
 * Original arcadey skateboard rolling model. Units are Sid's World units/s.
 * Gravity along the local surface grade, rolling resistance, acceleration,
 * carve response and boost coast-down are explicitly separate quantities.
 */
const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
export type SkateRollingInput={
 speed:number; dt:number; pushing:boolean; riseAhead:number;
 maxSpeed:number; boosted:boolean;
};
/** Stable under variable FPS (caller physics dt is capped to 50ms). */
export function skateRollingSpeed({
 speed,dt,pushing,riseAhead,maxSpeed,boosted,
}:SkateRollingInput):number{
 if(!Number.isFinite(speed)||!Number.isFinite(riseAhead)||!Number.isFinite(maxSpeed))
  return 0;
 const h=clamp(dt,0,.05);
 const v=Math.max(0,speed);
 const grade=clamp(riseAhead,-1.35,1.35);
 // A rolling rider accelerates downhill while still having to push to
 // maintain momentum on the flat. Grade is sampled from actual wheel support.
 const gradeForce=-5.5*grade;
 const pushForce=pushing?(boosted?17.0:8.2):0;
 const rollingResistance=(pushing?.72:1.2)+v*.045;
 const next=Math.max(0,v+(gradeForce+pushForce-rollingResistance)*h);
 const limit=Math.max(0,maxSpeed)*(1+Math.max(0,-grade)*.12);
 // Preserve residual momentum after a target boost expires. Never snap.
 return Math.max(0,Math.min(next,Math.max(limit,v-2.8*h)));
}
export function skateLean(speed:number,turnAngle:number):number{
 if(!Number.isFinite(speed)||!Number.isFinite(turnAngle))return 0;
 return clamp(turnAngle,-1,1)*clamp(speed/11,0,1)*.19;
}
