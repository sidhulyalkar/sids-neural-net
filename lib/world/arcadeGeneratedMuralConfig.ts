import {validateCavernMural,sampleCavernArt,type CavernMural,type CavernArtTheme} from "./arcadeCavernSurface";

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
  /** Hide authored variants only after their generated replacements load. */
  replacesThemes: readonly CavernArtTheme[];
}>;

/** Deliberately narrow strips where appropriate: image pixels are NEVER
 * stretched to the tall fantasy, sitcom, or sports-panel dimensions.
 * These overlays sit ~6cm or more away from game selection niches.
 */
export const ARCADE_GENERATED_MURAL_OVERLAYS:readonly GeneratedMuralOverlay[]=[
 {
  mural:{id:"generated-sports-fandom",theme:"sports",surface:"right",
   z0:-73.55,z1:-68.72,v0:.24,v1:.46,
   title:"Chelsea / Patriots / Warriors Fan Tribute",
   tags:["CHELSEA","PATRIOTS","WARRIORS"]},
  desktop:"/world/arcade-cavern/generated/sports-fandom.webp",
  mobile:"/world/arcade-cavern/generated/sports-fandom-mobile.webp",
  expectedAspect:3,
  provenance:"owner-supplied-ai",
  replacesThemes:["sports"],
 },
 {
  mural:{id:"generated-anime-favorites",theme:"anime",surface:"left",
   z0:-80.65,z1:-69.10,v0:.26,v1:.45,
   title:"Anime favorites graffiti frieze",
   tags:["BLUE LOCK","HAIKYU!!","JUJUTSU KAISEN","CHAINSAW MAN",
    "SOLO LEVELING","SHANGRI-LA FRONTIER"]},
  desktop:"/world/arcade-cavern/generated/anime-favorites.webp",
  mobile:"/world/arcade-cavern/generated/anime-favorites-mobile.webp",
  expectedAspect:2172/248,
  provenance:"owner-supplied-ai",
  replacesThemes:["anime","sport-anime"],
 },
 {
  mural:{id:"generated-tv-comedy",theme:"comedy",surface:"right",
   z0:-75.52,z1:-68.68,v0:.57,v1:.75,
   title:"Comedy favorites panoramic frieze",
   tags:["SOUTH PARK","BOJACK HORSEMAN","RICK AND MORTY","ARCHER",
    "THE BOONDOCKS","COMMUNITY","TRAILER PARK BOYS"]},
  desktop:"/world/arcade-cavern/generated/tv-comedy.webp",
  mobile:"/world/arcade-cavern/generated/tv-comedy-mobile.webp",
  expectedAspect:1774/265,
  provenance:"owner-supplied-ai",
  replacesThemes:["comedy","sitcom"],
 },
];

/** Measure the actual mapped wall surface rather than treating normalized v as
 * a flat 5.3-meter wall. The lower facet and roof have different distances.
 */
const pointDistance=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>
 Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export function measureGeneratedMuralAspect(mural:CavernMural){
 if(mural.surface!=="left"&&mural.surface!=="right")return null;
 const side=mural.surface;
 const along=(a:number,b:number,axis:"z"|"v",fixed:number)=>{
  let distance=0;
  let last:ReturnType<typeof sampleCavernArt>=null;
  for(let i=0;i<=12;i++){
   const value=a+(b-a)*i/12;
   const p=sampleCavernArt(side,
    axis==="z"?value:fixed,.5,axis==="v"?value:fixed,.056);
   if(!p)return null;
   if(last)distance+=pointDistance(last.position,p.position);
   last=p;
  }
  return distance;
 };
 const widths=[.15,.5,.85].map(t=>along(mural.z0,mural.z1,"z",
  mural.v0+(mural.v1-mural.v0)*t));
 const heights=[.15,.5,.85].map(t=>along(mural.v0,mural.v1,"v",
  mural.z0+(mural.z1-mural.z0)*t));
 if([...widths,...heights].some(v=>v===null||v===0))return null;
 const width=widths.reduce<number>((a,b)=>a+(b??0),0)/widths.length;
 const height=heights.reduce<number>((a,b)=>a+(b??0),0)/heights.length;
 return {width,height,aspect:width/height};
}

export function validateGeneratedMuralOverlays(
 overlays:readonly GeneratedMuralOverlay[]=ARCADE_GENERATED_MURAL_OVERLAYS,
):string[]{
 const errors:string[]=[],ids=new Set<string>(),paths=new Set<string>();
 const replaced=new Set<CavernArtTheme>();
 for(const item of overlays){
  const {mural}=item;
  if(!item.replacesThemes.length)errors.push(mural.id+": missing replacement themes");
  for(const theme of item.replacesThemes){
   if(replaced.has(theme))errors.push(mural.id+": duplicate replacement "+theme);
   replaced.add(theme);
  }
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
  const physical=measureGeneratedMuralAspect(mural);
  if(!physical)errors.push(mural.id+": invalid physical sampler");
  else if(Math.abs(physical.aspect/item.expectedAspect-1)>.20)
   errors.push(mural.id+": actual wall aspect deformation "+
    physical.aspect.toFixed(2)+" vs "+item.expectedAspect.toFixed(2));
 }
 return errors;
}
