import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { terrainHeight, distance, isWater, REGIONS,
  ARCADE_CAVE, PAPER_CAVE } from "../lib/world/model";
import { sportClearance } from "../lib/world/activities";

/** Preliminary geometry-only ski-flying corridor survey. No launch boost
 * is implemented here; this is evidence for selecting a safe runout. */
const launches=[
  {x:-2,z:-49},{x:1,z:-47},{x:5,z:-47},
  {x:1,z:-40},{x:5,z:-39},
];
const headings=[{x:0,z:1},{x:.18,z:.984},{x:.36,z:.933}];
const norm=(h:{x:number;z:number})=>{
  const d=Math.hypot(h.x,h.z);return {x:h.x/d,z:h.z/d};
};
const modes=[{h:15,v:13},{h:18,v:16},{h:21,v:18}];
type Case={from:{x:number;z:number},heading:{x:number;z:number},
  hSpeed:number,vSpeed:number,range:number,airtime:number,
  landing:{x:number;z:number},fromY:number,toY:number,
  risky:boolean,reasons:string[]};
const cases:Case[]=[];
for(const from of launches)for(const hd of headings)for(const mode of modes) {
  const heading=norm(hd),fromY=terrainHeight(from.x,from.z);
  let y=fromY+.12,vertical=mode.v;
  const dt=.02;
  let landing={...from},t=0,found=false;
  for(let i=1;i<750;i++) {
    t=i*dt;
    const p={x:from.x+heading.x*mode.h*t,
      z:from.z+heading.z*mode.h*t};
    vertical-=14*dt;
    y+=vertical*dt;
    if(isWater(p))break;
    if(y<=terrainHeight(p.x,p.z)&&t>.25){
      landing=p;found=true;break;
    }
  }
  if(!found)continue;
  const toY=terrainHeight(landing.x,landing.z);
  const range=distance(from,landing),reasons:string[]=[];
  if(sportClearance(landing))reasons.push("existing sport corridor");
  if(REGIONS.some(r=>distance(landing,r.point)<5))
    reasons.push("existing destination marker");
  if(distance(landing,ARCADE_CAVE.entrance)<12)reasons.push("arcade cave buffer");
  if(distance(landing,PAPER_CAVE)<12)reasons.push("paper cave buffer");
  if(landing.z>12)reasons.push("redwood / rainforest approach");
  if(range<35)reasons.push("flight too short");
  if(range>85)reasons.push("flight needs more landscape/camera survey");
  const caseValue={from,heading,hSpeed:mode.h,vSpeed:mode.v,
    range,airtime:t,landing,fromY,toY,
    risky:reasons.length>0,reasons};
  cases.push(caseValue);
}
const viable=cases.filter(c=>!c.risky).sort((a,b)=>b.range-a.range);
const dir=process.env.WORLD_AUDIT_DIR??"artifacts/world";
mkdirSync(dir,{recursive:true});
const document={
  note:"Preliminary 2D free flight; does not include trees, rocks, landing slope, camera, or player controls. No jump feature has been approved.",
  gravity:14,stepSeconds:.02,
  candidates:cases.length,provisionalClear:viable.length,
  proposed:viable.slice(0,8),cases,
};
writeFileSync(join(dir,"ski-flying-candidate-audit.json"),
  JSON.stringify(document,null,2)+"\n");
console.log(JSON.stringify({cases:cases.length,provisionalClear:viable.length,
  best:viable[0]??null},null,2));
