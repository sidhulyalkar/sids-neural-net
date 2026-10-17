import type {CavernArtTheme} from "./arcadeCavernSurface";

/** Every shipped replacement graphic has to be local, documented and reviewed
 * in the real cavern. A missing asset is not quietly treated as approved art.
 * Additional recognizable characters/logos require approved artwork and
 * provenance before being added to this production manifest. */
export type ArcadeMuralArtwork = Readonly<{
  src: string;
  authorship: "original"|"licensed"|"permission";
  attribution: string;
  opacity: number;
  revision: number;
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
 },
};

export const ARCADE_MURAL_IMAGE_RULES = {
 maxMasterEdge:4096,
 atlasEdge:2048,
 preferredCompressedFormat:"ktx2" as const,
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
  if(!/^\/world\/arcade-cavern\/[a-z0-9/_-]+\.(?:png|webp|svg|ktx2)$/.test(entry.src))
   problems.push(theme+": invalid or remote asset path");
  if(seen.has(entry.src))problems.push(theme+": duplicate image path");
  seen.add(entry.src);
  if(!entry.attribution.trim())problems.push(theme+": missing attribution");
  if(!Number.isInteger(entry.revision)||entry.revision<1)
   problems.push(theme+": invalid version");
  if(!(entry.opacity>0&&entry.opacity<=1))
   problems.push(theme+": invalid opacity");
 }
 return problems;
}
