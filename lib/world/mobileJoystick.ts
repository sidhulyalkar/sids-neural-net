export type JoystickVector = Readonly<{ x: number; y: number }>;

/** Dead-zoned, normalized analog stick; positive y is forward/up. */
export function sampleMobileJoystick(
  clientX:number, clientY:number, centerX:number, centerY:number,
  radius:number, deadZone=0.13,
):JoystickVector {
  if(![clientX,clientY,centerX,centerY,radius,deadZone].every(Number.isFinite) ||
     radius<=0 || deadZone<0 || deadZone>=1) return {x:0,y:0};
  const x=(clientX-centerX)/radius, y=(centerY-clientY)/radius;
  const distance=Math.hypot(x,y);
  if(distance<=deadZone)return {x:0,y:0};
  const magnitude=(Math.min(distance,1)-deadZone)/(1-deadZone);
  return {x:x/distance*magnitude,y:y/distance*magnitude};
}
