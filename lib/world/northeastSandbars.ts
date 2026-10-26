/** Stylized lagoon geography, not a surveyed reproduction of Moorea. */
export const NORTHEAST_SANDBARS = [
 {id:'east-whipray-sandbar',x:68,z:50,radius:7,depth:1.85},
 {id:'east-blacktip-channel',x:84,z:61,radius:7,depth:2.8},
 {id:'east-baby-turtle-meadow',x:69,z:94,radius:7,depth:2.15},
 {id:'east-giant-clam-garden',x:86,z:89,radius:6,depth:2.4},
] as const;
export function sandbarWeight(x:number,z:number,b:typeof NORTHEAST_SANDBARS[number]){
 const t=Math.max(0,Math.min(1,(Math.hypot(x-b.x,z-b.z)/b.radius-.45)/.55));
 return 1-t*t*(3-2*t);
}
export function northeastSandFloor(x:number,z:number,floor:number,sea:number){
 let y=floor;
 for(const bank of NORTHEAST_SANDBARS){
  const weight=sandbarWeight(x,z,bank);
  // Broad ripples are physical but small enough for smooth swimming contact.
  const ripple=.035*Math.sin(x*2.4+Math.sin(z*.48)*.8);
  y+=(sea-bank.depth+ripple-y)*weight;
 }
 return y;
}
