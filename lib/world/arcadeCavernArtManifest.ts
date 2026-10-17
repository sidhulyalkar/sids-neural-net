import {ARCADE_SPORTS_MURALS} from "./arcadeMuralsSports";
import {ARCADE_ANIME_MURALS} from "./arcadeMuralsAnime";
import {ARCADE_COMEDY_MURALS} from "./arcadeMuralsComedy";
import {ARCADE_IDENTITY_MURALS} from "./arcadeMuralsIdentity";
import {validateCavernMural,type CavernMural} from "./arcadeCavernSurface";
export const ARCADE_CAVERN_MURALS:readonly CavernMural[]=[
 ...ARCADE_COMEDY_MURALS,...ARCADE_SPORTS_MURALS,
 ...ARCADE_ANIME_MURALS,...ARCADE_IDENTITY_MURALS,
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
