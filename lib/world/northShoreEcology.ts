import { northShoreZ, skimOffshore, type SkimPoint } from "./skimboarding";

/** Sandy shallows, not the kelp reef or tropical coral lagoon. The seedless
 * layout is reproducible for screenshot QA and keeps the board run-in clear. */
export type NorthShoreAnimal="baitfish"|"stingray"|"flatfish"|"crab";
export const NORTH_SHORE_COUNTS={baitfish:24,stingray:3,flatfish:5,crab:7} as const;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export function shoreAnimalAnchor(kind:NorthShoreAnimal,index:number):SkimPoint {
  const counts=NORTH_SHORE_COUNTS[kind];
  const i=((index%counts)+counts)%counts;
  const x=kind==="stingray"?[-17,0,17][i]:
    kind==="baitfish"? -24+(i%12)*4.25 :
    kind==="flatfish"? -19+i*9 : -22+i*7.3;
  const offshore=kind==="baitfish"?8+Math.floor(i/12)*10+(i%3)*1.3:
    kind==="stingray"?11+i*4.8:
    kind==="flatfish"?6+(i%3)*3.5:-1.5+(i%2)*1.0;
  return {x,z:northShoreZ(x)+offshore};
}
/** Fish/rays yield to the rider without jumping onto dry sand. */
export function shoreAnimalMotion(kind:NorthShoreAnimal,index:number,
  seconds:number,rider:SkimPoint):SkimPoint {
  const start=shoreAnimalAnchor(kind,index);
  if(kind==="crab")return {
    x:start.x+Math.sin(seconds*.38+index)*.34,
    z:start.z+Math.cos(seconds*.27+index)*.16,
  };
  const radius=kind==="baitfish"?.6:kind==="stingray"?1.4:.3;
  const pace=kind==="baitfish"?.56:kind==="stingray"?.16:.11;
  const phase=seconds*pace+index*2.399;
  let x=start.x+Math.sin(phase)*radius;
  let z=start.z+Math.cos(phase*.7)*radius;
  const dx=x-rider.x,dz=z-rider.z,distance=Math.hypot(dx,dz);
  const avoidance=kind==="baitfish"?4.8:kind==="stingray"?7:3.2;
  if(distance<avoidance){
    const weight=(avoidance-distance)/avoidance;
    const direction=distance>.0001?{x:dx/distance,z:dz/distance}:{x:1,z:0};
    x+=direction.x*weight*(kind==="stingray"?2.2:1.4);
    z+=direction.z*weight*(kind==="stingray"?2.2:1.4);
  }
  x=clamp(x,-27,27);
  const offshore=clamp(z-northShoreZ(x),kind==="baitfish"?5:3,32);
  return {x,z:northShoreZ(x)+offshore};
}
export function shoreLifeVisible(point:SkimPoint):boolean {
  return Math.abs(point.x)<37 && skimOffshore(point)>-22 &&
    skimOffshore(point)<54;
}
