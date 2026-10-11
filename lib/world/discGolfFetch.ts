import type {Point} from "./model";
import type {DiscGolfState} from "./discGolf";

export const DISC_FETCH_LANDING_HOLD=0.85;
export const DISC_FETCH_POV_DELAY=0.95;
export const DISC_FETCH_FOUND_HOLD=1.65;
export const DISC_FETCH_CHASE_TIMEOUT=14;

export type DiscGolfFetch={
 phase:"idle"|"flight"|"landed"|"chase"|"found";
 startedAt:number;landedAt:number;foundAt:number;
 target:Point|null;
};
export const idleDiscGolfFetch=():DiscGolfFetch=>({
 phase:"idle",startedAt:0,landedAt:0,foundAt:0,target:null,
});
export function startDiscGolfFetch(now:number):DiscGolfFetch{
 // Flight belongs entirely to the disc. Shasta stays with the player until
 // the disc settles and the player has had time to see its landing.
 return {phase:"flight",startedAt:now,landedAt:0,foundAt:0,target:null};
}
/** One deterministic cinematic sequence: disc flight, landing reveal,
 * visible run-up, Shasta POV, then return to the player's normal camera.
 * The dog remains obstacle-aware; this is only a target/timing contract.
 * Water redos and new shots cancel without moving the player's lie. */
export function stepDiscGolfFetch(
 state:DiscGolfFetch,game:DiscGolfState,dog:Point,now:number,
):DiscGolfFetch{
 if(state.phase==="idle")return state;
 if(game.phase==="off"||game.phase==="water"||game.phase==="ready")
  return idleDiscGolfFetch();
 if(state.phase==="found")
  return now-state.foundAt>=DISC_FETCH_FOUND_HOLD?
   idleDiscGolfFetch():state;
 if(game.phase==="flying"){
  // The next throw can happen before a previous fetch animation finishes.
  return state.phase==="flight"?state:idleDiscGolfFetch();
 }
 if(game.phase!=="landed"&&game.phase!=="holed")return idleDiscGolfFetch();
 const target=game.phase==="holed"?
  {x:game.disc.x,z:game.disc.z}:game.lie;
 if(state.phase==="flight")
  return {...state,phase:"landed",landedAt:now,target};
 if(state.phase==="landed")
  return now-state.landedAt>=DISC_FETCH_LANDING_HOLD?
   {...state,phase:"chase",target}:{...state,target};
 if(now-state.landedAt>DISC_FETCH_CHASE_TIMEOUT)
  return idleDiscGolfFetch();
 if(Math.hypot(dog.x-target.x,dog.z-target.z)<1.85)
  return {...state,phase:"found",foundAt:now,target};
 return {...state,target};
}
/** The first camera follows the landing, then watches Shasta start moving
 * before transitioning into his low eye-level viewpoint. */
export function discGolfFetchCameraPhase(
 state:DiscGolfFetch,now:number,reducedMotion=false,
):"off"|"disc"|"landing"|"chase"|"shasta"{
 if(reducedMotion)return "off";
 if(state.phase==="flight")return "disc";
 if(state.phase==="landed")return "landing";
 if(state.phase==="chase")
  return now-state.landedAt-DISC_FETCH_LANDING_HOLD>=DISC_FETCH_POV_DELAY?
   "shasta":"chase";
 if(state.phase==="found")return "shasta";
 return "off";
}
