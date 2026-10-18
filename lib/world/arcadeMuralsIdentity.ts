import type {CavernMural} from "./arcadeCavernSurface";
/** The main wordmark and the photo-backed Shasta vignette remain clear of
 * the three interactive game panels on the rear wall. */
export const ARCADE_IDENTITY_MURALS:readonly CavernMural[]=[
 {id:"sids-underground",theme:"identity",surface:"back",
  z0:-63.32,z1:-63.32,u0:.22,u1:.78,v0:.625,v1:.88,
  title:"SID'S UNDERGROUND",tags:["PLAY","EXPLORE","DISCOVER"]},
 {id:"shasta-rear-portrait",theme:"shasta",surface:"back",
  z0:-63.32,z1:-63.32,u0:0,u1:.31,v0:.12,v1:.60,
  title:"SHASTA / THE ADVENTURE CONTINUES",tags:["SHASTA","TRAILS"]},
];
