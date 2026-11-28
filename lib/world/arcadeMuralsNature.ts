import type {CavernMural} from "./arcadeCavernSurface";

/** The entrance keeps real alpine photography above playable game covers.
 * The left wall now holds personalized comedy and sports-anime pieces, while
 * Shasta's real photograph remains on the protected rear wall. */
export const ARCADE_NATURE_MURALS:readonly CavernMural[]=[
 {id:"wild-places-scenic-wall",theme:"nature-gallery",surface:"right",
  z0:-80.55,z1:-75.65,v0:.56,v1:.95,title:"WILD PLACES",
  tags:["GLACIERS","MOUNTAINS","RIVERS","WATERFALLS","FORESTS"]},
 {id:"my-games-gallery",theme:"game-gallery",surface:"right",
  z0:-80.45,z1:-73.68,v0:.11,v1:.54,title:"PLAY MY GAMES",
  tags:["UNICORN STAMPEDE","UNIRICO","STRETCHICORN"]},
 {id:"wild-places-rear",theme:"nature-gallery",surface:"back",
  z0:-63.32,z1:-63.32,u0:.69,u1:1,v0:.12,v1:.60,
  title:"ALPINE TO COAST",tags:["GLACIERS","PINES","CANYONS","WATER"]},
] as const;
