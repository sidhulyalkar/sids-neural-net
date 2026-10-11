import {DISC_GOLF_HOLES,DISC_GOLF_VERSION} from "./discGolf";

/** One nine-hole round. Live lies and flight physics remain in DiscGolfState. */
export type DiscGolfRound={
 scores:(number|null)[];
 bestTotal:number|null;
};
export const DISC_GOLF_ROUND_KEY="sid-world:disc-golf-round:"+DISC_GOLF_VERSION;
export function emptyDiscGolfRound(bestTotal:number|null=null):DiscGolfRound{
 return {scores:DISC_GOLF_HOLES.map(()=>null),bestTotal};
}
export function discGolfRoundSummary(round:DiscGolfRound){
 const scores=DISC_GOLF_HOLES.map((_,i)=>round.scores[i]??null);
 const holesPlayed=scores.filter((n):n is number=>n!==null).length;
 const strokes=scores.reduce<number>((n,s)=>n+(s??0),0);
 const playedPar=DISC_GOLF_HOLES.reduce((n,h,i)=>n+(scores[i]===null?0:h.par),0);
 const coursePar=DISC_GOLF_HOLES.reduce((n,h)=>n+h.par,0);
 return {
  holesPlayed,holesTotal:DISC_GOLF_HOLES.length,
  strokes,playedPar,coursePar,toPar:strokes-playedPar,
  complete:holesPlayed===DISC_GOLF_HOLES.length,
 };
}
export function recordDiscGolfHole(round:DiscGolfRound,index:number,strokes:number):DiscGolfRound{
 if(!Number.isInteger(index)||index<0||index>=DISC_GOLF_HOLES.length||
    !Number.isInteger(strokes)||strokes<1||strokes>999||
    round.scores[index]!==null)return round;
 const scores=[...round.scores];
 scores[index]=strokes;
 const next:DiscGolfRound={...round,scores};
 const summary=discGolfRoundSummary(next);
 if(summary.complete)
  next.bestTotal=round.bestTotal===null?summary.strokes:Math.min(round.bestTotal,summary.strokes);
 return next;
}
export function nextUnplayedDiscGolfHole(round:DiscGolfRound,afterIndex=-1):number|null{
 for(let n=1;n<=DISC_GOLF_HOLES.length;n++){
  const index=((afterIndex+n)%DISC_GOLF_HOLES.length+DISC_GOLF_HOLES.length)%DISC_GOLF_HOLES.length;
  if(round.scores[index]===null)return index;
 }
 return null;
}
export function loadDiscGolfRound():DiscGolfRound{
 if(typeof window==="undefined")return emptyDiscGolfRound();
 try{
  const raw=window.localStorage.getItem(DISC_GOLF_ROUND_KEY);
  if(!raw)return emptyDiscGolfRound();
  const parsed=JSON.parse(raw) as Partial<DiscGolfRound>;
  if(!Array.isArray(parsed.scores)||parsed.scores.length!==DISC_GOLF_HOLES.length||
    !parsed.scores.every(n=>n===null||
      (Number.isInteger(n)&&typeof n==="number"&&n>=1&&n<=999)))
   return emptyDiscGolfRound();
  const best=typeof parsed.bestTotal==="number"&&
    Number.isInteger(parsed.bestTotal)&&parsed.bestTotal>=DISC_GOLF_HOLES.length&&
    parsed.bestTotal<=DISC_GOLF_HOLES.length*999?parsed.bestTotal:null;
  const round={scores:[...parsed.scores],bestTotal:best};
  const result=discGolfRoundSummary(round);
  // A finished round can only have a real aggregate best.
  if(result.complete)
   round.bestTotal=best===null?result.strokes:Math.min(best,result.strokes);
  return round;
 }catch{return emptyDiscGolfRound();}
}
export function persistDiscGolfRound(round:DiscGolfRound):void{
 if(typeof window==="undefined")return;
 try{window.localStorage.setItem(DISC_GOLF_ROUND_KEY,JSON.stringify(round));}
 catch{/* Storage can be blocked; the in-memory round remains playable. */}
}
