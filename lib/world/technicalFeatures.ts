import type { Point } from "./model";

/** Deterministic rideable microterrain, separate from decoration and challenges.
 * model.ts imports this module, so it must never import runtime model functions. */
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const smooth=(a:number,b:number,x:number)=>{
  const t=clamp((x-a)/(b-a),0,1);
  return t*t*(3-2*t);
};
export const ROCK_GARDENS=[
  {id:"joshua-pump-rocks",zone:"desert",center:{x:35,z:-46},length:8,halfWidth:1.9,
    heading:{x:0,z:1},seed:13,strength:0.19},
  {id:"granite-return-rocks",zone:"desert",center:{x:43,z:-51},length:9,halfWidth:1.75,
    heading:{x:0,z:-1},seed:29,strength:0.22},
  {id:"redwood-root-weave",zone:"redwood",center:{x:-11,z:18},length:7.5,halfWidth:1.8,
    heading:{x:0,z:-1},seed:47,strength:0.16},
] as const;
export type RockGarden=(typeof ROCK_GARDENS)[number];
export type Stone=Point & {height:number;rx:number;rz:number;kind:"rideable"};
export function rockGardenStones(garden:RockGarden):Stone[]{
  return Array.from({length:11},(_,i)=>{
    const along=(i/10-.5)*(garden.length-1.0);
    // Uneven two lines: deliberately leave a cleaner 0.45m center corridor.
    const side=((i*7+garden.seed)%13-6)/6*garden.halfWidth;
    const x=garden.center.x+garden.heading.x*along+garden.heading.z*side;
    const z=garden.center.z+garden.heading.z*along-garden.heading.x*side;
    return {x,z,rx:.51+(i%3)*.17,rz:.57+(i%4)*.12,
      height:garden.strength*(.55+(i%4)*.13),kind:"rideable"};
  });
}
const RAISED_STONES=ROCK_GARDENS.map(g=>({g,stones:rockGardenStones(g)}));

/** Every visible protruding rock follows this continuous heightfield:
 * no colliders pretending embedded stones are vertical impassable boulders. */
export function rockGardenHeightOffset(p:Point):number {
  let rise=0;
  for(const {g,stones} of RAISED_STONES){
    if(Math.abs(p.x-g.center.x)>g.halfWidth+2.2 ||
      Math.abs(p.z-g.center.z)>g.length/2+2.2)continue;
    for(const rock of stones){
      const dx=(p.x-rock.x)/rock.rx,dz=(p.z-rock.z)/rock.rz;
      if(dx*dx+dz*dz>4)continue;
      rise+=rock.height*Math.exp(-2*(dx*dx+dz*dz));
    }
  }
  return rise;
}

export const BALANCE_BEAMS=[
  {id:"redwood-easy",start:{x:-17,z:8},end:{x:-11,z:9},
    halfWidth:.55,rise:.34,entry:1.35},
  {id:"redwood-narrow",start:{x:-18,z:15},end:{x:-12,z:14},
    halfWidth:.42,rise:.44,entry:1.6},
  {id:"scrub-rail",start:{x:18,z:7},end:{x:23,z:7},
    halfWidth:.48,rise:.33,entry:1.2},
] as const;
export type BalanceBeam=(typeof BALANCE_BEAMS)[number];
export function beamLocal(beam:BalanceBeam,p:Point){
  const dx=beam.end.x-beam.start.x,dz=beam.end.z-beam.start.z;
  const length=Math.hypot(dx,dz);
  const fx=dx/length,fz=dz/length;
  const px=p.x-beam.start.x,pz=p.z-beam.start.z;
  return {along:px*fx+pz*fz,side:px*fz-pz*fx,length};
}
export function beamRiseAt(beam:BalanceBeam,p:Point):number|null {
  const {along,side,length}=beamLocal(beam,p);
  if(along < -1e-7 || along > length+1e-7 ||
    Math.abs(side)>beam.halfWidth+1e-7)return null;
  // Endpoint interpolation has subnanometer floating-point drift.
  const s=clamp(along,0,length);
  // Roll-on and roll-off lower to zero without teleport or height discontinuity.
  const easing=smooth(0,beam.entry,s)*
    (1-smooth(length-beam.entry,length,s));
  return beam.rise*easing;
}
/** Compute a point's supported height using the SAME elevation as the mesh.
 * Caller supplies already sculpted terrain height to avoid a module cycle. */
export function beamSupportHeight(p:Point,terrain:number):number|null {
  let supported:number|null=null;
  for(const beam of BALANCE_BEAMS) {
    const rise=beamRiseAt(beam,p);
    if(rise!==null)supported=Math.max(supported??-Infinity,terrain+rise);
  }
  return supported;
}
export function technicalFeatureClearance(p:Point):boolean {
  for(const beam of BALANCE_BEAMS){
    const {along,side,length}=beamLocal(beam,p);
    if(along>=-1.8&&along<=length+1.8&&Math.abs(side)<1.75)return true;
  }
  return ROCK_GARDENS.some(g=>Math.abs(p.x-g.center.x)<g.halfWidth+1.2 &&
    Math.abs(p.z-g.center.z)<g.length/2+1.2);
}
