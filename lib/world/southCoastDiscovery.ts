import {SOUTH_HABITATS, type SouthPatch} from "./southCoastHabitats";
import {waterZone, type Point} from "./model";

/** World-space southern field guide. Only the authored ecology determines labels:
 * the Eagle Ray Passage does not rename the separate reef and kelp gardens.
 */
export type SouthCoastDiscovery = Readonly<{
  id:string;
  label:string;
  kind:"reef"|"kelp"|"ray"|"open-water";
}>;

const KELP_NAMES:Readonly<Record<string,string>>={
  "waterfall-kelp-garden":"Waterfall Kelp Garden",
  "otter-urchin-reef":"Otter and Urchin Reef",
  "leopard-shark-sand":"Leopard Shark Sands",
  "seal-glide-corridor":"Seal and Sea Lion Corridor",
  "octopus-boulder-nook":"Octopus Boulder Garden",
};
const closest=(point:Point):SouthPatch|null=>{
  let best:SouthPatch|null=null,score=Infinity;
  for(const patch of SOUTH_HABITATS){
    const distance=Math.hypot(point.x-patch.x,point.z-patch.z);
    const normalized=distance/patch.radius;
    if(normalized<score){best=patch;score=normalized;}
  }
  // Avoid pretending a remote, unpopulated ocean patch is a named wildlife habitat.
  return score<=1.65?best:null;
};
export function southCoastDiscoveryAt(point:Point):SouthCoastDiscovery|null{
  if(waterZone(point)!=="south-channel")return null;
  const patch=closest(point);
  if(patch?.side==="southwest-reef")
    return {id:patch.id,kind:"reef",label:"Southwest Rocky Reef"};
  if(patch?.side==="southeast-kelp")
    return {id:patch.id,kind:"kelp",label:KELP_NAMES[patch.id]??"California Kelp Forest"};
  if(Math.hypot((point.x-17)/25,(point.z+127)/35)<1.15)
    return {id:"eagle-ray-passage",kind:"ray",label:"Eagle Ray Passage"};
  return {id:"southern-open-water",kind:"open-water",label:"Southern Open Water"};
}
export function southCoastDiscoveryHint(
  discovery:SouthCoastDiscovery|null,feverCount:number,
):string{
  if(!discovery)return "South Coast · Dive to explore";
  switch(discovery.kind){
    case "reef":return discovery.label+" · Reef gardens and invertebrates";
    case "kelp":return discovery.label+" · Explore the kelp sanctuary";
    case "ray":return discovery.label+" · "+Math.max(0,Math.floor(feverCount))+" eagle rays · Dive to explore";
    case "open-water":return discovery.label+" · Dive to explore";
  }
}
