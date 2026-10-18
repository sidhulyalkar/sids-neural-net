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
