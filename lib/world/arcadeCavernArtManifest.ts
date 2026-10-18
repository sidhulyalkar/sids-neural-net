import {ARCADE_SPORTS_MURALS} from "./arcadeMuralsSports";
import {ARCADE_IDENTITY_MURALS} from "./arcadeMuralsIdentity";
import {validateCavernMural,type CavernMural} from "./arcadeCavernSurface";
export const ARCADE_CAVERN_MURALS:readonly CavernMural[]=[
 {id:"alpine-water",theme:"nature",surface:"left",z0:-80.45,z1:-75.2,
  v0:.12,v1:.51,title:"ALPINE WATER",tags:["lake","ice"]},
 ...ARCADE_SPORTS_MURALS,
 {id:"wild-country",theme:"nature",surface:"right",z0:-73.15,z1:-68.1,
  v0:.10,v1:.51,title:"WILD COUNTRY",tags:["mountains","forest"]},
 {id:"shasta-trail-companion",theme:"shasta",surface:"right",z0:-78.45,z1:-74.65,
  v0:.11,v1:.50,title:"SHASTA · TRAIL COMPANION",tags:["dog","trail"]},
 ...ARCADE_IDENTITY_MURALS,
];
export function validateArcadeArtManifest(murals:readonly CavernMural[]){
 const ids=new Set<string>(),problems:string[]=[];
 for(const mural of murals){
  if(ids.has(mural.id))problems.push("duplicate "+mural.id);
  ids.add(mural.id);
  const error=validateCavernMural(mural);
  if(error)problems.push(mural.id+": "+error);
 }
 return problems;
}
