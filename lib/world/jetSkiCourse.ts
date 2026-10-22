/** Authored coastal race landmarks. Original geometry is inspired by the
 * sandstone sea arch of Santa Cruz, Mendocino sea stacks and Hawaiian basalt.
 * These are stylized island features, not real surveyed formations. */
import type {Point} from "./model";
export type JetSkiRockKind="sandstone"|"sea-stack"|"basalt";
export type JetSkiRock={id:string;kind:JetSkiRockKind;point:Point;
 radius:number;height:number;};
export type JetSkiArch={id:string;kind:"sandstone"|"basalt";
 center:Point;span:number;height:number;heading:number;gateIndex:number;};
export const JET_SKI_ARCHES:readonly JetSkiArch[]=[
 // Route bends westward through the northern cape at gate 5.
 // This 21m offshore relocation clears the skimboard sightline without
 // removing physical arch legs or decoupling the actual race checkpoint.
 {id:"natural-bridges",kind:"sandstone",center:{x:0,z:117},
  span:19,height:13,heading:Math.PI/2,gateIndex:4},
 // The southern ocean passage is a darker, more fractured lava coastline.
 {id:"lava-window",kind:"basalt",center:{x:17,z:-127},
  span:18,height:12,heading:Math.PI/2,gateIndex:13},
];
export const JET_SKI_ROCKS:readonly JetSkiRock[]=[
 // Both arch legs are true physical obstacles. The openings stay clear.
 {id:"natural-bridge-north",kind:"sandstone",point:{x:0,z:126.5},radius:2.6,height:13},
 {id:"natural-bridge-south",kind:"sandstone",point:{x:0,z:107.5},radius:2.6,height:13},
 {id:"lava-window-north",kind:"basalt",point:{x:17,z:-118},radius:2.7,height:12},
 {id:"lava-window-south",kind:"basalt",point:{x:17,z:-136},radius:2.7,height:12},
 // Mendocino-like eroded sentinels straddling (not blocking) the western line.
 {id:"mendocino-needle-a",kind:"sea-stack",point:{x:-74,z:34},radius:3.3,height:18},
 {id:"mendocino-needle-b",kind:"sea-stack",point:{x:-47,z:19},radius:3,height:13},
 {id:"mendocino-needle-c",kind:"sea-stack",point:{x:-74,z:-17},radius:3.6,height:22},
 {id:"mendocino-needle-d",kind:"sea-stack",point:{x:-48,z:-51},radius:2.7,height:15},
 {id:"mendocino-needle-e",kind:"sea-stack",point:{x:-73,z:-73},radius:2.8,height:12},
 // South-coast volcanic fragments create silhouettes beyond the race line.
 {id:"lava-shelf-west",kind:"basalt",point:{x:-8,z:-141},radius:3.1,height:8},
 {id:"lava-shelf-east",kind:"basalt",point:{x:40,z:-140},radius:3.7,height:10},
];
/** Link the *rendered* arch feet with the existing leg colliders without
 * relying on naming quirks (natural-bridges vs natural-bridge-north). */
export function isJetSkiArchSupport(rock:JetSkiRock):boolean{
 return JET_SKI_ARCHES.some(arch=>{
  if(rock.kind!==arch.kind)return false;
  const dx=rock.point.x-arch.center.x,dz=rock.point.z-arch.center.z;
  // Three.js positive yaw maps local +X to (cos(yaw), -sin(yaw)).
  const along=dx*Math.cos(arch.heading)-dz*Math.sin(arch.heading);
  const lateral=dx*Math.sin(arch.heading)+dz*Math.cos(arch.heading);
  return Math.abs(Math.abs(along)-arch.span*.5)<.45&&Math.abs(lateral)<.45;
 });
}
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
/** Physical hull radius is approximately 0.6m. */
export function jetSkiRockAt(point:Point,extraRadius=.65):JetSkiRock|null{
 for(const rock of JET_SKI_ROCKS){
  if(Math.hypot(point.x-rock.point.x,point.z-rock.point.z)<
    rock.radius+extraRadius)return rock;
 }
 return null;
}
/** Test a segment, not only its endpoints, so authored gates and AI routes
 * never tunnel through or require flying across a solid sea stack. */
export function jetSkiSegmentClear(a:Point,b:Point,margin=1):boolean{
 const dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz;
 for(const rock of JET_SKI_ROCKS){
  const t=den<1e-9?0:clamp(((rock.point.x-a.x)*dx+
    (rock.point.z-a.z)*dz)/den,0,1);
  if(Math.hypot(a.x+dx*t-rock.point.x,a.z+dz*t-rock.point.z)<
    rock.radius+margin)return false;
 }
 return true;
}

/** Short route identity cues keyed to the next checkpoint index. */
export function jetSkiSectionName(gateIndex:number):string{
 if(gateIndex<2)return "Lagoon Sprint";
 if(gateIndex<4)return "Northern Swell";
 if(gateIndex===4)return "Natural Bridges";
 if(gateIndex<7)return "Outer Cape";
 if(gateIndex<12)return "Mendocino Stacks";
 if(gateIndex<14)return "South Surge";
 if(gateIndex===14)return "Lava Window";
 return "Reef Return";
}
