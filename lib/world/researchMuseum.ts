import {
  PAPER_CAVE,paperCaveHalfWidth,paperCaveFloorHeight,
  paperCaveInside, type Point,
} from "./model";

/** Three authored rooms under the existing waterfall. The eight paper
 * records are still canonical; placement is determined by index only.
 * A perpendicular viewing pose and 0.6m standing circle are reserved for
 * every frame. Doors have a 5+m central passage with no picture overlap.
 */
export type MuseumPaperSlot={
  id:string;index:number;roomIndex:number;
  side:"west"|"east"|"back";
  x:number;y:number;z:number;yaw:number;
};
export const RESEARCH_MUSEUM_VIEW={
  artWidth:1.60,artHeight:1.63,
  frameWidth:1.83,frameHeight:1.92,
  centerAboveFloor:1.73,
  standingDistance:2.1,
  clearRadius:.60,
} as const;

export const RESEARCH_MUSEUM_SLOTS:readonly MuseumPaperSlot[]=
  [...PAPER_CAVE.chambers.flatMap((room,roomIndex)=>
    (["west","east"] as const).map((side,j)=>{
      const offset=paperCaveHalfWidth(room.centerZ)-.19;
      return {
        id:`paper-${roomIndex*2+j+1}`,
        index:roomIndex*2+j,roomIndex,side,
        x:PAPER_CAVE.x+(side==="west"?-offset:offset),
        y:paperCaveFloorHeight({x:PAPER_CAVE.x,z:room.centerZ})+
          RESEARCH_MUSEUM_VIEW.centerAboveFloor,
        z:room.centerZ,
        yaw:side==="west"?Math.PI/2:-Math.PI/2,
      };
    })
  ),
  ...([-1.30,1.30] as const).map((offset,j)=>({
    id:`paper-${7+j}`,index:6+j,roomIndex:2,
    side:"back" as const,
    x:PAPER_CAVE.x+offset,
    y:paperCaveFloorHeight({x:PAPER_CAVE.x,z:PAPER_CAVE.backZ+1})+
      RESEARCH_MUSEUM_VIEW.centerAboveFloor,
    z:PAPER_CAVE.backZ+.41,
    yaw:0,
  }))];

export function museumPaperViewpoint(slot:MuseumPaperSlot):Point{
  return {
    x:slot.x+Math.sin(slot.yaw)*RESEARCH_MUSEUM_VIEW.standingDistance,
    z:slot.z+Math.cos(slot.yaw)*RESEARCH_MUSEUM_VIEW.standingDistance,
  };
}
export function researchMuseumLayoutValid():boolean{
  if(PAPER_CAVE.chambers.length!==3||RESEARCH_MUSEUM_SLOTS.length!==8)
    return false;
  const seen=new Set<string>();
  for(const slot of RESEARCH_MUSEUM_SLOTS){
    if(seen.has(slot.id))return false;
    seen.add(slot.id);
    const p=museumPaperViewpoint(slot);
    if(!paperCaveInside(p))return false;
    const w=paperCaveHalfWidth(p.z);
    if(Math.abs(p.x-PAPER_CAVE.x)+RESEARCH_MUSEUM_VIEW.clearRadius>
      w-.47)return false;
    if(p.z<PAPER_CAVE.backZ+1||p.z>-31)return false;
    const thresholds=PAPER_CAVE.thresholds;
    if(thresholds.some(z=>Math.abs(z-slot.z)<
      RESEARCH_MUSEUM_VIEW.frameWidth*.65))return false;
  }
  for(let room=0;room<3;room++){
    if(RESEARCH_MUSEUM_SLOTS.filter(s=>s.roomIndex===room).length<
      (room===2?4:2))return false;
  }
  return true;
}
