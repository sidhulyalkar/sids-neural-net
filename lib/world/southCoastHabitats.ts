import {SEA_SURFACE,seaFloorHeight,waterZone} from "./model";

/** Two continuous ecological coast ribbons connected around the arch.
 * IDs are authored landmarks; densities share a fixed GPU budget.
 */
export type SouthFaunaKind =
  | "reef-rock" | "fan-coral" | "anemone" | "seagrass" | "sea-star"
  | "crab" | "lobster" | "nudibranch"
  | "giant-kelp" | "bull-kelp" | "understory" | "urchin" | "abalone"
  | "garibaldi" | "sheephead" | "kelp-bass" | "leopard-shark"
  | "harbor-seal" | "sea-lion" | "sea-otter" | "octopus";
export type SouthSide = "southwest-reef" | "southeast-kelp";
export type SouthPatch = Readonly<{
  id:string;side:SouthSide;x:number;z:number;radius:number;
  population:Partial<Readonly<Record<SouthFaunaKind,number>>>;
}>;
const westKinds={ "reef-rock":10,"fan-coral":12,anemone:10,seagrass:17,
  "sea-star":7,crab:5,lobster:4,nudibranch:5 } as const;
const eastKinds={"giant-kelp":14,"bull-kelp":7,understory:12,urchin:8,
  abalone:5,garibaldi:5,sheephead:3,"kelp-bass":6,
  "leopard-shark":2,"sea-star":5,crab:4,octopus:1} as const;
export const SOUTH_HABITATS:readonly SouthPatch[]=[
  ...[-81,-69,-57,-45,-33,-21,-9].map((x,i)=>({
    id:`southwest-reef-${i+1}`,side:"southwest-reef" as const,
    x,z:-118+(i%3-1)*3,radius:8.8,population:westKinds,
  })),
  ...[43,53,63,73,83].map((x,i)=>({
    id:["waterfall-kelp-garden","otter-urchin-reef","leopard-shark-sand",
      "seal-glide-corridor","octopus-boulder-nook"][i],
    side:"southeast-kelp" as const,x,z:-125-(i%3)*5,radius:9.2,
    population:{...eastKinds,...(i===0?{"sea-lion":2}:{}),
      ...(i===1?{"sea-otter":2}:{}),...(i===3?{"harbor-seal":3}:{}),
      ...(i===4?{"sea-lion":1,"harbor-seal":1}:{}),
    },
  })),
];
function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0;}
function random(seed:number){let n=seed;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
export type SouthHabitatPoint={x:number;y:number;z:number;angle:number;size:number;patchId:string;kind:SouthFaunaKind};
export function southHabitatPoint(p:SouthPatch,kind:SouthFaunaKind,i:number):SouthHabitatPoint {
  if(i<0||!Number.isInteger(i)||i>=(p.population[kind]??0))throw new RangeError("invalid south habitat index");
  const rand=random(hash(p.id+kind+i));
  const size=.72+rand()*.38;
  const isTall=kind==="giant-kelp"||kind==="bull-kelp";
  const clearance=isTall?6.2*size:
    kind==="leopard-shark"?2.2:kind==="sea-lion"?2.5:
    kind==="harbor-seal"?2.2:kind==="sea-otter"?1.7:1.25;
  for(let attempt=0;attempt<64;attempt++){
    const a=rand()*Math.PI*2,r=Math.sqrt(rand())*p.radius;
    const x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;
    if(waterZone({x,z})!=="south-channel")continue;
    const floor=seaFloorHeight(x,z);
    if(floor+clearance+0.4>=SEA_SURFACE)continue;
    return {x,y:floor,z,angle:rand()*Math.PI*2,size,patchId:p.id,kind};
  }
  throw new Error(`No submerged south habitat point: ${p.id}/${kind}/${i}`);
}
export function southHabitatTotals(side:SouthSide){
  const counts:Partial<Record<SouthFaunaKind,number>>={};
  for(const p of SOUTH_HABITATS)if(p.side===side)
    for(const [key,count] of Object.entries(p.population) as [SouthFaunaKind,number][])
      counts[key]=(counts[key]??0)+count;
  return counts;
}
