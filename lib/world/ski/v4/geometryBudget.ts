import {MOUNTAIN_HALFPIPE,mountainHalfpipeBank} from "../../mountainHalfpipe";
import {SKI_V4_TUNING} from "./core";

/** Conservative 1D contact feasibility diagnostic.
 * For a ski angled across a curved wall, an undeformed, nonpenetrating
 * straight sole is an affine line in the wall's cross-section.
 * Minimize the RANGE between that line and the snow. This is a LOWER BOUND
 * on the maximum visible gap; 3D ski torsion, boot load and beam bending
 * can make real contact harder, never easier than arbitrary independent flex.
 * Does not modify the mountain, snow, or solver.
 */
export function minRigidSoleClearance(height:(x:number)=>number,
  center:number,projectedHalfLength:number,stations=64){
  if(!Number.isFinite(center)||!Number.isFinite(projectedHalfLength)||
     projectedHalfLength<0||!Number.isInteger(stations)||stations<4)
    throw Error("Finite center, nonnegative projected length and at least four stations required");
  if(projectedHalfLength===0)return {rigidMaxGap:0,optimalSlope:0};
  const offsets=Array.from({length:stations+1},(_,i)=>projectedHalfLength*(2*i/stations-1));
  const heights=offsets.map(s=>height(center+s));
  const range=(slope:number)=>{
    let lo=Infinity,hi=-Infinity;
    for(let i=0;i<heights.length;i++){
      const r=heights[i]-slope*offsets[i];
      lo=Math.min(lo,r);hi=Math.max(hi,r);
    }
    return hi-lo;
  };
  let lower=-25,upper=25;
  for(let iter=0;iter<90;iter++){
    const a=lower+(upper-lower)/3,b=upper-(upper-lower)/3;
    if(range(a)<range(b))upper=b;else lower=a;
  }
  const slope=(lower+upper)/2;
  return {rigidMaxGap:range(slope),optimalSlope:slope};
}
export type SkiGeometryBudget={
  side:"left"|"right";bankFraction:number;crossAngleDegrees:number;
  rigidMaxGap:number;unavoidableFlexGap:number;withinBudget:boolean;
  nominalSlopeDegrees:number;radiusOfCurvature:number;
};
export function evaluateCurrentHalfpipeBudget():SkiGeometryBudget[]{
  const h=MOUNTAIN_HALFPIPE;
  const field=(x:number)=>mountainHalfpipeBank({x,z:(h.startZ+h.endZ)/2});
  const results:SkiGeometryBudget[]=[];
  const cell=h.lipHalfWidth-h.floorHalfWidth;
  const eps=0.001;
  for(const side of [-1,1] as const){
    for(const u of [.05,.2,.35,.5,.7,.85,.9,.95,.98]){
      const x=h.centerX+side*(h.floorHalfWidth+u*cell);
      const grad=(field(x+eps)-field(x-eps))/(2*eps);
      const second=(field(x+eps)-2*field(x)+field(x-eps))/(eps*eps);
      const curvature=Math.abs(second)/Math.pow(1+grad*grad,1.5);
      for(const deg of [15,30,45,60,90]){
        const projectedHalfLength=SKI_V4_TUNING.skiHalfLength*Math.sin(deg*Math.PI/180);
        const gap=minRigidSoleClearance(field,x,projectedHalfLength);
        const unavoidable=Math.max(0,gap.rigidMaxGap-2*SKI_V4_TUNING.maxSoleFlex);
        results.push({
          side:side<0?"left":"right",bankFraction:u,crossAngleDegrees:deg,
          rigidMaxGap:gap.rigidMaxGap,unavoidableFlexGap:unavoidable,
          withinBudget:unavoidable<=SKI_V4_TUNING.contactTolerance,
          nominalSlopeDegrees:Math.atan(Math.abs(grad))*180/Math.PI,
          radiusOfCurvature:curvature>1e-10?1/curvature:Infinity,
        });
      }
    }
  }
  return results;
}
