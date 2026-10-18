import type {CavernMural} from "./arcadeCavernSurface";
/** The panoramic image gallery and the photo-backed Shasta vignette remain clear of
 * the three interactive game panels on the rear wall. */
export const ARCADE_IDENTITY_MURALS:readonly CavernMural[]=[
 {id:"panorama-photo-gallery",theme:"feature-gallery",surface:"back",
  z0:-63.32,z1:-63.32,u0:.22,u1:.78,v0:.625,v1:.88,
  title:"Rear panoramic photo gallery",tags:["photo","panorama"]},
 {id:"shasta-rear-portrait",theme:"shasta",surface:"back",
  z0:-63.32,z1:-63.32,u0:0,u1:.31,v0:.12,v1:.60,
  title:"SHASTA / THE ADVENTURE CONTINUES",tags:["SHASTA","TRAILS"]},
];
