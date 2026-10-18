import type {CavernArtTheme} from "./arcadeCavernSurface";

/** Every shipped replacement graphic has to be local, documented and reviewed
 * in the real cavern. A missing asset is not quietly treated as approved art.
 * Additional recognizable characters/logos require approved artwork and
 * provenance before being added to this production manifest. */
export type ArcadeMuralArtwork = Readonly<{
  src: string;
  authorship: "original"|"licensed"|"permission"|"third-party-trademark";
  attribution: string;
  opacity: number;
  revision: number;
  presentation?: "original-texture" | "shasta-photo-stencil" | "sports-crest-composite";
  supportingSources?: readonly string[];
}>;

export const ARCADE_MURAL_ART_ASSETS:Partial<
 Record<CavernArtTheme,ArcadeMuralArtwork>
> = {
 identity: {
  src:"/world/arcade-cavern/hero/sids-underground.svg",
  authorship:"original",
  attribution:"Original authored in-project graffiti title graphic",
  opacity:1,
  revision:1,
  presentation:"original-texture",
 },
 sports: {
  src:"/world/arcade-cavern/sports/chelsea-crest.png",
  supportingSources:[
   "/world/arcade-cavern/sports/patriots-crest.png",
   "/world/arcade-cavern/sports/warriors-crest.png",
  ],
  authorship:"third-party-trademark",
  attribution:"Chelsea FC / New England Patriots / Golden State Warriors; source images from frertommy/team-logos (ESPN public team crest sources), for fan tribute; trademark ownership retained by respective teams",
  opacity:1,
  revision:1,
  presentation:"sports-crest-composite",
 },
 neural: {
  src:"/world/arcade-cavern/science/mindforge-brain.svg",
  authorship:"original",
  attribution:"Original authored SVG brain, neural circuits and Mind Forge graffiti for Sid's World",
  opacity:1,revision:1,presentation:"original-texture",
 },
 "sport-anime": {
  src:"/world/arcade-cavern/sport-anime/striker-setpoint.svg",
  authorship:"original",
  attribution:"Original authored sports-anime graffiti tribute with soccer and volleyball illustrations",
  opacity:1,revision:1,presentation:"original-texture",
 },
 anime: {
  src:"/world/arcade-cavern/anime/raid-ascend.svg",
  authorship:"original",
  attribution:"Original fantasy progression and rift mural, not a licensed anime character portrait",
  opacity:1,revision:1,presentation:"original-texture",
 },
 comedy: {
  src:"/world/arcade-cavern/comedy/out-of-this-world.svg",
  authorship:"original",
  attribution:"Original sci-fi portal graffiti with fan title tributes, not character likeness artwork",
  opacity:1,revision:1,presentation:"original-texture",
 },
 shasta: {
  // Verified personal visual-archive image: Shasta sitting on the trail.
  src:"/visual-archive/web/photo-037.webp",
  authorship:"permission",
  attribution:"Existing personal website photo archive, photo-037 (Shasta on trail)",
  opacity:1,
  revision:1,
  presentation:"shasta-photo-stencil",
 },
};

export const ARCADE_MURAL_IMAGE_RULES = {
 maxMasterEdge:4096,
 atlasEdge:2048,
 preferredCompressedFormat:"webp" as const,
 requireAlpha:true,
 requireAttribution:true,
} as const;

export function validateArcadeMuralAssets(
 assets:Partial<Record<CavernArtTheme,ArcadeMuralArtwork>> =
 ARCADE_MURAL_ART_ASSETS,
):string[]{
 const problems:string[]=[];
 const seen=new Set<string>();
 for(const [theme,entry] of Object.entries(assets)){
  if(!entry)continue;
  const localArt=/^\/world\/arcade-cavern\/[a-z0-9/_-]+\.(?:png|webp|svg)$/.test(entry.src);
  const photoArchive=theme==="shasta"&&
   entry.presentation==="shasta-photo-stencil"&&
   entry.src==="/visual-archive/web/photo-037.webp";
  if(!localArt&&!photoArchive)
   problems.push(theme+": invalid or remote asset path");
  if(seen.has(entry.src))problems.push(theme+": duplicate image path");
  seen.add(entry.src);
  const extras=entry.supportingSources??[];
  if(entry.presentation==="sports-crest-composite"&&
    (theme!=="sports"||extras.length!==2))
    problems.push(theme+": sports artwork requires three distinct crest assets");
  for(const url of extras){
   if(!/^\/world\/arcade-cavern\/[a-z0-9/_-]+\.(?:png|webp|svg)$/.test(url))
    problems.push(theme+": invalid supporting source");
   if(seen.has(url))problems.push(theme+": duplicate supporting source");
   seen.add(url);
  }
  if(!entry.attribution.trim())problems.push(theme+": missing attribution");
  if(!Number.isInteger(entry.revision)||entry.revision<1)
   problems.push(theme+": invalid version");
  if(!(entry.opacity>0&&entry.opacity<=1))
   problems.push(theme+": invalid opacity");
 }
 return problems;
}
