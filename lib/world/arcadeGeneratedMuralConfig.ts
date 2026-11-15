import {validateCavernMural,type CavernMural} from "./arcadeCavernSurface";

/** Flip to true ONLY after all six vetted WebP files have been installed.
 * Shipping a false default preserves the original SVG/crest artwork, so
 * incomplete image imports can never blank the public arcade.
 */
export const GENERATED_MURAL_TEXTURES_BUNDLED = false as boolean;

export type GeneratedMuralOverlay = Readonly<{
  mural: CavernMural;
  desktop: string;
  mobile: string;
  expectedAspect: number;
  provenance: "owner-supplied-ai";
}>;

/** Deliberately narrow strips where appropriate: image pixels are NEVER
 * stretched to the tall fantasy, sitcom, or sports-panel dimensions.
 * These overlays sit ~6cm or more away from game selection niches.
 */
export const ARCADE_GENERATED_MURAL_OVERLAYS:readonly GeneratedMuralOverlay[]=[
 {
  mural:{id:"generated-sports-fandom",theme:"sports",surface:"right",
   z0:-73.55,z1:-68.72,v0:.18,v1:.50,
   title:"Chelsea / Patriots / Warriors Fan Tribute",
   tags:["CHELSEA","PATRIOTS","WARRIORS"]},
  desktop:"/world/arcade-cavern/generated/sports-fandom.webp",
  mobile:"/world/arcade-cavern/generated/sports-fandom-mobile.webp",
  expectedAspect:3,
  provenance:"owner-supplied-ai",
 },
 {
  mural:{id:"generated-anime-favorites",theme:"anime",surface:"left",
   z0:-80.65,z1:-69.10,v0:.68,v1:.93,
   title:"Anime favorites graffiti frieze",
   tags:["BLUE LOCK","HAIKYU!!","JUJUTSU KAISEN","CHAINSAW MAN",
    "SOLO LEVELING","SHANGRI-LA FRONTIER"]},
  desktop:"/world/arcade-cavern/generated/anime-favorites.webp",
  mobile:"/world/arcade-cavern/generated/anime-favorites-mobile.webp",
  expectedAspect:2172/248,
  provenance:"owner-supplied-ai",
 },
 {
  mural:{id:"generated-tv-comedy",theme:"comedy",surface:"right",
   z0:-75.52,z1:-68.68,v0:.73,v1:.92,
   title:"Comedy favorites panoramic frieze",
   tags:["SOUTH PARK","BOJACK HORSEMAN","RICK AND MORTY","ARCHER",
    "THE BOONDOCKS","COMMUNITY","TRAILER PARK BOYS"]},
  desktop:"/world/arcade-cavern/generated/tv-comedy.webp",
  mobile:"/world/arcade-cavern/generated/tv-comedy-mobile.webp",
  expectedAspect:1774/265,
  provenance:"owner-supplied-ai",
 },
];

export function validateGeneratedMuralOverlays(
 overlays:readonly GeneratedMuralOverlay[]=ARCADE_GENERATED_MURAL_OVERLAYS,
):string[]{
 const errors:string[]=[],ids=new Set<string>(),paths=new Set<string>();
 for(const item of overlays){
  const {mural}=item;
  if(ids.has(mural.id))errors.push("duplicate id "+mural.id);
  ids.add(mural.id);
  const bad=validateCavernMural(mural);
  if(bad)errors.push(mural.id+": "+bad);
  if(!["left","right"].includes(mural.surface))errors.push(mural.id+": not side wall");
  for(const src of [item.desktop,item.mobile]){
   if(!/^\/world\/arcade-cavern\/generated\/[a-z0-9-]+\.webp$/.test(src))
    errors.push(mural.id+": invalid asset path");
   if(paths.has(src))errors.push(mural.id+": repeated asset path");
   paths.add(src);
  }
  // The high side-wall patches must stop before game-cover plaque anchors.
  if(mural.z1> -68.70 && mural.v0<.60)
   errors.push(mural.id+": game plaque clearance");
  const approxHeight=5.3*(mural.v1-mural.v0);
  const actual=(mural.z1-mural.z0)/approxHeight;
  if(Math.abs(actual/item.expectedAspect-1)>.14)
   errors.push(mural.id+": aspect deformation "+actual.toFixed(2));
 }
 return errors;
}
