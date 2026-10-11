import type {Point} from "./model";
import type {DiscGolfState} from "./discGolf";

export type DiscGolfFetch={
 phase:"idle"|"chase"|"found";
 startedAt:number;foundAt:number;
 target:Point|null;
};
export const idleDiscGolfFetch=():DiscGolfFetch=>({
 phase:"idle",startedAt:0,foundAt:0,target:null,
});
export function startDiscGolfFetch(now:number):DiscGolfFetch{
 return {phase:"chase",startedAt:now,foundAt:0,target:null};
}
/** Shasta follows the live disc, reaches its real lie, pauses and sniffs.
 * Never teleports and never changes the player's lie, strokes or physics.
 * An unreachable target safely times out so the dog resumes following. */
export function stepDiscGolfFetch(
 state:DiscGolfFetch,game:DiscGolfState,dog:Point,now:number,
):DiscGolfFetch{
 if(state.phase==="idle")return state;
 if(game.phase==="off"||game.phase==="water"||
    game.phase==="ready"||now-state.startedAt>12)return idleDiscGolfFetch();
 if(state.phase==="found"){
  return now-state.foundAt>=1.35?idleDiscGolfFetch():state;
 }
 const landing=game.phase==="landed"||game.phase==="holed";
 const target=game.phase==="holed"?{x:game.disc.x,z:game.disc.z}:
  landing?game.lie:{x:game.disc.x,z:game.disc.z};
 const distance=Math.hypot(dog.x-target.x,dog.z-target.z);
 if(landing&&distance<1.85)
  return {phase:"found",startedAt:state.startedAt,foundAt:now,target};
 return {...state,target};
}
