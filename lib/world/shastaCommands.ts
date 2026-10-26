import type {Point} from './model';
export type ShastaCommand = 'go' | 'come';
export type ShastaOuting = {
  command: ShastaCommand; mode: 'follow' | 'roam' | 'chase' | 'return';
  target: number | null; goal: Point | null; until: number; cooldown: number;
};
export const initialShastaOuting = (): ShastaOuting => ({
  command:'come',mode:'follow',target:null,goal:null,until:0,cooldown:0,
});
export function commandShasta(command:ShastaCommand):ShastaOuting {
  return {...initialShastaOuting(),command,mode:command==='go'?'roam':'return'};
}
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);
/** Bounded outings; recall stays latched until another explicit Go. The caller
 * owns collision steering and supplies dry, reachable path validation. */
export function stepShastaOuting(state:ShastaOuting,now:number,dog:Point,player:Point,
  squirrels:readonly (Point|null)[],allowed:boolean,clear:(a:Point,b:Point)=>boolean):ShastaOuting {
  if(!allowed)return initialShastaOuting();
  if(state.command==='come')return {...state,mode:distance(dog,player)<3?'follow':'return',target:null,goal:null};
  if(distance(dog,player)>22)return {...state,mode:'return',target:null,goal:null};
  if(state.mode==='return'&&distance(dog,player)>4)return state;
  if(state.mode==='chase'){
    const prey=state.target===null?null:squirrels[state.target];
    if(prey&&now<state.until&&distance(prey,player)<24&&distance(dog,prey)>1.5&&clear(dog,prey))
      return {...state,goal:{...prey}};
    return {...state,mode:'return',target:null,goal:null,cooldown:now+3};
  }
  if(now>=state.cooldown){
    let target:number|null=null,best=20;
    squirrels.forEach((p,i)=>{if(p&&distance(p,player)<24&&distance(dog,p)<best&&clear(dog,p)){
      target=i;best=distance(dog,p);
    }});
    if(target!==null)return {...state,mode:'chase',target,goal:{...squirrels[target]!},until:now+8};
  }
  if(state.mode==='roam'&&state.goal&&now<state.until&&distance(dog,state.goal)>1.6&&
    distance(state.goal,player)<24&&clear(dog,state.goal))return state;
  // Fixed work, deterministic headings, no random search loop or teleport.
  for(let i=0;i<12;i++){
    const angle=Math.floor(now/6)*2.399963+i*Math.PI/6,radius=7+(i%3)*3;
    const goal={x:player.x+Math.cos(angle)*radius,z:player.z+Math.sin(angle)*radius};
    if(distance(dog,goal)>3&&clear(dog,goal))
      return {...state,mode:'roam',target:null,goal,until:now+6};
  }
  return {...state,mode:'follow',target:null,goal:null};
}
