import type {Point} from './model';
import {coastlineX} from './model';
import {COAST_WHALE} from './hydrology';
export type OceanObservation={stillFor:number;time:number;cooldown:number;sightings:number;phase:'quiet'|'spout'|'breach'|'splash'};
export const idleOceanObservation=():OceanObservation=>({stillFor:0,time:0,cooldown:0,sightings:0,phase:'quiet'});
export function advanceOceanObservation(s:OceanObservation,dt:number,input:{point:Point;speed:number;look:Point;eligible:boolean}):OceanObservation{
 const delta=Math.max(0,Math.min(.5,Number.isFinite(dt)?dt:0));if(!delta)return s;
 if(s.phase!=='quiet'){const time=s.time+delta;if(time>=10)return {...s,time:0,phase:'quiet',cooldown:80,stillFor:0};return {...s,time,phase:time<2?'spout':time<6?'breach':'splash'};}
 const dx=COAST_WHALE.x-input.point.x,dz=COAST_WHALE.z-input.point.z;
 const facing=(dx*input.look.x+dz*input.look.z)/((Math.hypot(dx,dz)||1)*(Math.hypot(input.look.x,input.look.z)||1));
 const coastal=input.point.x>coastlineX(input.point.z)-.4&&input.point.x<coastlineX(input.point.z)+16&&input.point.z>-72&&input.point.z<2;
 const watching=input.eligible&&coastal&&input.speed<.18&&facing>.6;
 const cooldown=Math.max(0,s.cooldown-delta),stillFor=watching?s.stillFor+delta:0;
 if(watching&&stillFor>=8&&cooldown===0)return {...s,phase:'spout',time:0,stillFor:0,cooldown:0,sightings:s.sightings+1};
 return {...s,stillFor,cooldown};
}
