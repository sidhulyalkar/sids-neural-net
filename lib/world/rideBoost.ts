/** Skill-shot accelerators: aiming is required, proximity alone never collects.
 * Shared across bike, skis and board; deliberately independent of minigames.
 */
import {DESERT_TRACK_LENGTH,desertTrackSampleAt} from "./desertTrack";
import type {Activity} from "./activities";
import type {Point} from "./model";
export type BoostActivity=Extract<Activity,"bike"|"ski"|"skate">;
export type RideBoostTarget={id:string;activity:BoostActivity;point:Point};
export const RIDE_BOOST_DURATION=2.4;
export const RIDE_BOOST_COOLDOWN=9;
export const RIDE_BOOST_RANGE=32;
export const RIDE_BOOST_TARGETS:readonly RideBoostTarget[]=[
 ...[.13,.38,.69,.9].map((fraction,i)=>({
   id:"joshua-"+i,activity:"bike" as const,
   point:desertTrackSampleAt(DESERT_TRACK_LENGTH*fraction),
 })),
 {id:"snow-ridge",activity:"ski",point:{x:8,z:-50}},
 {id:"snow-shoulder",activity:"ski",point:{x:9,z:-42}},
 {id:"snow-chute",activity:"ski",point:{x:22,z:-48}},
 {id:"grove-rail",activity:"skate",point:{x:-11,z:16}},
 {id:"grove-return",activity:"skate",point:{x:-11,z:1}},
 {id:"skate-ramp",activity:"skate",point:{x:9,z:-18}},
];
export const isBoostActivity=(a:Activity):a is BoostActivity=>
 a==="bike"||a==="ski"||a==="skate";
export type RideBoost={until:number;hitId:string|null;cooldowns:Record<string,number>};
export const initialRideBoost=():RideBoost=>({until:0,hitId:null,cooldowns:{}});
export function canFireRideBoost(target:RideBoostTarget,activity:Activity,
 player:Point,speed:number,now:number,state:RideBoost):boolean{
 return Number.isFinite(now)&&isBoostActivity(activity)&&
  activity===target.activity&&speed>=2.25&&
  Math.hypot(target.point.x-player.x,target.point.z-player.z)<=RIDE_BOOST_RANGE&&
  (state.cooldowns[target.id]??0)<=now;
}
export function fireRideBoost(target:RideBoostTarget,activity:Activity,
 player:Point,speed:number,now:number,state:RideBoost):RideBoost{
 if(!canFireRideBoost(target,activity,player,speed,now,state))return state;
 return {until:Math.max(now,state.until)+RIDE_BOOST_DURATION,
  hitId:target.id,cooldowns:{...state.cooldowns,
   [target.id]:now+RIDE_BOOST_COOLDOWN}};
}
export function activeRideBoost(state:RideBoost,now:number):boolean{
 return state.until>now;
}
