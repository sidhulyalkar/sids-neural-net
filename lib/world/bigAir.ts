import type { Point } from "./model";

/** Survey-led ridge-to-valley ski flight. No model imports: terrain may use
 * the sculpted takeoff without creating a circular module dependency. */
export const BIG_AIR = {
  id:"alpine-big-air",version:"ridge-flight-v1",
  lip:{x:-2,z:-49},start:{x:-2,z:-65},heading:{x:0,z:1},
  halfWidth:1.45,minSpeed:8.5,gravity:14,
  maxFlightSeconds:8,runout:{minZ:-13,maxZ:5,halfWidth:4.3},
} as const;
export type BigAirPhase="idle"|"armed"|"flying"|"landed"|"missed";
export type BigAirState={
 phase:BigAirPhase;point:Point;y:number;verticalSpeed:number;
 horizontalSpeed:number;distance:number;airtime:number;
 takeoffY:number;reason?:string;landingQuality?: "clean"|"rough";
};
export const idleBigAir=():BigAirState=>({
 phase:"idle",point:{...BIG_AIR.start},y:0,verticalSpeed:0,
 horizontalSpeed:0,distance:0,airtime:0,takeoffY:0,
});
export const armBigAir=():BigAirState=>({
 ...idleBigAir(),phase:"armed",
});
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const smooth=(a:number,b:number,v:number)=>{
 const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);
};
const local=(p:Point)=>{
 const dx=p.x-BIG_AIR.lip.x,dz=p.z-BIG_AIR.lip.z;
 return {along:dx*BIG_AIR.heading.x+dz*BIG_AIR.heading.z,
   side:dx*BIG_AIR.heading.z-dz*BIG_AIR.heading.x};
};
/** Raised compacted-snow takeoff, smooth approach and receiving edge.
 * All modes see this one physical surface, not a floating launch prop. */
export function bigAirTerrainOffset(p:Point):number {
 const {along,side}=local(p);
 if(along<-7||along>2.5||Math.abs(side)>4)return 0;
 const width=1-smooth(1.5,3.6,Math.abs(side));
 const approach=smooth(-6,-2.8,along)*(1-smooth(0,2.5,along));
 const crown=smooth(-2.3,-.45,along)*(1-smooth(.12,2.2,along));
 return width*(.22*approach+.80*crown);
}
export function bigAirClearance(p:Point):boolean {
 const {along,side}=local(p);
 // Keep just the approach, lip and recovery patch open. Don't clear
 // the whole overhead aerial corridor of the island's forests.
 return (along>=-18&&along<=3&&Math.abs(side)<=3.7) ||
   (p.z>=-13&&p.z<=5&&Math.abs(p.x-BIG_AIR.lip.x)<4.3);
}
export function bigAirCrossedLip(from:Point,to:Point,heading:Point,
 mode:string,speed:number,alreadyArmed:boolean):boolean {
 if(!alreadyArmed||mode!=="ski"||speed<BIG_AIR.minSpeed)return false;
 const a=local(from),b=local(to);
 if(!(a.along<0&&b.along>=0&&b.along<.85))return false;
 const cross=-a.along/(b.along-a.along);
 const lateral=a.side+(b.side-a.side)*cross;
 return Math.abs(lateral)<=BIG_AIR.halfWidth &&
   (heading.x*BIG_AIR.heading.x+heading.z*BIG_AIR.heading.z)>.92;
}
export function launchBigAir(point:Point,groundY:number,
 speed:number):BigAirState {
 const horizontalSpeed=clamp(speed,8.5,20);
 const verticalSpeed=11.4+Math.min(2.6,horizontalSpeed*.11);
 return {phase:"flying",point:{...point},y:groundY+.04,
  takeoffY:groundY,verticalSpeed,horizontalSpeed,distance:0,airtime:0};
}
export type SurfaceSample=(p:Point)=>number;
export function advanceBigAir(state:BigAirState,dt:number,
 ground:SurfaceSample,isWater:(p:Point)=>boolean):BigAirState {
 if(state.phase!=="flying")return state;
 if(!Number.isFinite(dt)||dt<0||dt>.12)
   return {...state,phase:"missed",reason:"Flight timing interrupted"};
 let result={...state,point:{...state.point}};
 // Short deterministic substeps, with swept segment-to-ground contact
 // interpolation. A skipped rendering frame cannot tunnel through the hill.
 let remaining=dt;
 while(remaining>1e-9&&result.phase==="flying"){
   const step=Math.min(.0125,remaining);remaining-=step;
   const prev={...result.point},yBefore=result.y;
   const next={
     x:prev.x+BIG_AIR.heading.x*result.horizontalSpeed*step,
     z:prev.z+BIG_AIR.heading.z*result.horizontalSpeed*step,
   };
   const velocityNext=result.verticalSpeed-BIG_AIR.gravity*step;
   const yNext=yBefore+(result.verticalSpeed+velocityNext)*step*.5;
   const beforeMargin=yBefore-ground(prev),afterMargin=yNext-ground(next);
   result.airtime+=step;
   if(isWater(next)){
     result={...result,point:next,y:yNext,phase:"missed",
       reason:"Water landing",distance:result.distance+result.horizontalSpeed*step,
       verticalSpeed:velocityNext};
     break;
   }
   if(afterMargin<=0&&result.airtime>.1){
     const f=clamp(beforeMargin/Math.max(1e-8,beforeMargin-afterMargin),0,1);
     const point={x:prev.x+(next.x-prev.x)*f,z:prev.z+(next.z-prev.z)*f};
     const distance=result.distance+result.horizontalSpeed*step*f;
     const safe=distance>=28&&distance<85&&
       Math.abs(point.x-BIG_AIR.lip.x)<BIG_AIR.runout.halfWidth &&
       point.z>=BIG_AIR.runout.minZ&&point.z<=BIG_AIR.runout.maxZ;
     result={...result,point,y:ground(point),verticalSpeed:0,distance,
       airtime:result.airtime-step*(1-f),
       phase:safe?"landed":"missed",
       landingQuality:safe?"clean":undefined,
       reason:safe?undefined:"Outside the receiving slope"};
     break;
   }
   result={...result,point:next,y:yNext,verticalSpeed:velocityNext,
     distance:result.distance+result.horizontalSpeed*step};
   if(result.airtime>BIG_AIR.maxFlightSeconds||result.distance>115){
     result={...result,phase:"missed",reason:"Outside flight envelope"};
   }
 }
 return result;
}

export const BIG_AIR_BIRDS=[
  {id:"scarlet-macaw",kind:"macaw",color:"#d65347",wing:"#edbf42",side:-1},
  {id:"blue-gold-macaw",kind:"macaw",color:"#3f88b3",wing:"#d8ac44",side:1},
  {id:"green-parrot",kind:"parrot",color:"#5caa75",wing:"#407d69",side:1},
] as const;
export type BirdPosition=Point&{y:number;yaw:number;wingBeat:number;scale:number};
export function bigAirBirdPositions(state:BigAirState,time:number):BirdPosition[] {
 if(state.phase!=="flying")return [];
 return BIG_AIR_BIRDS.map((b,i)=>{
  const offset=i===2?5.6:3.5,forward=i===2?2.4:4.1;
  const flap=Math.sin(time*(i===2?9:7.5)+i*1.9);
  return {x:state.point.x+b.side*offset+Math.sin(time*1.7+i)*.22,
   z:state.point.z+forward+Math.sin(time*.8+i)*.45,
   y:state.y+1.25+i*.30+Math.sin(time*2.5+i)*.32,
   yaw:0,wingBeat:flap,scale:i===2?.69:1};
 });
}
export function bigAirBirdCallout(distance:number):string|null {
 const milestone=Math.floor(Math.max(0,distance)/10)*10;
 if(milestone<10)return null;
 return (milestone%20===0?"Blue-and-gold macaw":"Scarlet macaw")+
   " · "+milestone+" m";
}
