import type {CavernMural} from "./arcadeCavernSurface";

/** Photo-first layout. The entrance LEFT wall is Shasta's gallery; the
 * remaining rock celebrates the user's real travels and published games.
 * No anime/television imagery is mounted in the arcade in this edition. */
export const ARCADE_NATURE_MURALS:readonly CavernMural[]=[
 {id:"shasta-photo-gallery",theme:"shasta-gallery",surface:"left",
  z0:-80.65,z1:-68.15,v0:.12,v1:.91,title:"SHASTA / TRAIL COMPANION",
  tags:["SHASTA","SNOW","TRAILS","BEACH","SUNSET"]},
 {id:"wild-places-scenic-wall",theme:"nature-gallery",surface:"right",
  z0:-80.55,z1:-68.16,v0:.57,v1:.95,title:"WILD PLACES",
  tags:["GLACIERS","MOUNTAINS","RIVERS","WATERFALLS","FORESTS"]},
 {id:"my-games-gallery",theme:"game-gallery",surface:"right",
  z0:-80.45,z1:-73.68,v0:.11,v1:.54,title:"PLAY MY GAMES",
  tags:["UNICORN STAMPEDE","UNIRICO","STRETCHICORN"]},
 {id:"wild-places-rear",theme:"nature-gallery",surface:"back",
  z0:-63.32,z1:-63.32,u0:.69,u1:1,v0:.12,v1:.60,
  title:"ALPINE TO COAST",tags:["GLACIERS","PINES","CANYONS","WATER"]},
] as const;
