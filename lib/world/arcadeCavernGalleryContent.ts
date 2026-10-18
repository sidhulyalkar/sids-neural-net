/** Photos already published in this website's visual archive, curated after
 * inspecting the actual thumbnail subjects rather than guessing by filename.
 * All imagery is first-party and served locally. Keep covers from the
 * corresponding first-party game repos in the arcade-cavern directory. */
export const SHASTA_PHOTOS=[
 "photo-002","photo-033","photo-034","photo-037","photo-039",
 "photo-040","photo-042","photo-043","photo-044",
 "photo-045","photo-047","photo-048","photo-049",
] as const;
export const NATURE_PHOTOS=[
 "photo-001","photo-004","photo-005","photo-006",
 "photo-007","photo-008","photo-009","photo-010",
 "photo-011","photo-012","photo-014","photo-015",
] as const;
export const CAVERN_GAME_ART=[
 {id:"unicorn-stampede",label:"UNICORN STAMPEDE",
  src:"/world/arcade-cavern/games/unicorn-stampede-guide.svg",
  provenance:"Unicorn Stampede project / docs/how-to-play.svg",
  nature:"project guide artwork"},
 {id:"unirico",label:"uniRico",
  src:"/world/arcade-cavern/games/unirico-banner.svg",
  provenance:"uniRico project / docs/banner.svg",
  nature:"official game banner"},
 {id:"stretchicorn",label:"STRETCHICORN",
  src:"/world/arcade-cavern/games/stretchicorn-hero.png",
  provenance:"Stretchicorn project / docs/stretchicorn-title-v017.png",
  nature:"official game title artwork"},
] as const;
/**
 * Artwork source of truth for the cavern. To replace the temporary website
 * gallery with a new album, change the local image paths below. No 3D geometry,
 * photo layout code or shader needs updating. Use files under /public, not
 * remote URLs. Photo lists may contain fewer than the current 13/12 examples.
 *
 * `heroIndex` chooses the largest image in the Shasta collage; images can be
 * reordered freely. The rear banner becomes a three-photo panorama.
 */
export const CAVERN_PHOTO_ALBUMS={
 shasta:{
  images:SHASTA_PHOTOS.map(id=>archivePhotoPath(id,id==="photo-037")),
  heroIndex:3,
 },
 nature:{
  images:NATURE_PHOTOS.map(id=>archivePhotoPath(id)),
 },
 feature:{
  images:[
   archivePhotoPath("photo-004"),
   archivePhotoPath("photo-009"),
   archivePhotoPath("photo-014"),
  ],
 },
} as const;

export function validateCavernPhotoAlbums(
 albums:typeof CAVERN_PHOTO_ALBUMS=CAVERN_PHOTO_ALBUMS,
):string[]{
 const issues:string[]=[];
 for(const [group,data] of Object.entries(albums)){
  if(data.images.length===0)issues.push(group+": empty album");
  if(data.images.length>25)issues.push(group+": keep a curated set of up to 25 images per static wall");
  if(new Set(data.images).size!==data.images.length)issues.push(group+": duplicate images");
  for(const src of data.images){
   if(!/^\/(?!\/)(?:[a-z0-9_-]+\/)+[a-z0-9_-]+\.(?:png|jpe?g|webp|avif)$/.test(src))
    issues.push(group+": nonlocal/unsupported source "+src);
  }
 }
 if(albums.shasta.heroIndex<0||
  albums.shasta.heroIndex>=albums.shasta.images.length)
  issues.push("shasta: hero index outside album");
 return issues;
}

/** Stable left/rear/right layout aligned with the interactive game targets.
 * This is deliberately NOT the editorial order of the poster gallery. */
export const CAVERN_GAME_PANEL_ART=[
 CAVERN_GAME_ART[2],CAVERN_GAME_ART[1],CAVERN_GAME_ART[0],
] as const;
export function archivePhotoPath(id:string,full=false){
 if(!/^photo-\d{3}$/.test(id))throw Error("Invalid visual archive id");
 return "/visual-archive/"+(full?"web/":"thumbs/")+
  id+(full?".webp":"-thumb.webp");
}
