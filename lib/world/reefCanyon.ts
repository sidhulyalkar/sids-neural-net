import {MOSS_CANYON,SEA_SURFACE,constrainMove,maxDiveDepth,
  seaFloorHeight,waterZone,type Point,type Obstacle} from "./model";

/** The original above-ground canyon is rebuilt as a true snorkelable reef
 * corridor. Rock contacts are 3D: swimmers can glide ABOVE the walls and
 * cannot clip THROUGH them when diving alongside the coral.
 * Skatepark Canyon Flow remains an independent, unchanged sport feature.
 */
export type ReefCanyonRock={
  id:string;side:-1|1;index:number;point:Point;floorY:number;
  height:number;radius:number;topY:number;
};

export const REEF_CANYON={
  ...MOSS_CANYON,
  swimmerRadius:.45,
  minSurfaceClearance:.95,
  cameraClearance:.28,
} as const;

export const REEF_CANYON_ROCKS:readonly ReefCanyonRock[]=
  ([-1,1] as const).flatMap(side=>
    Array.from({length:REEF_CANYON.segments},(_,i)=>{
      const z=REEF_CANYON.startZ+i*REEF_CANYON.spacing;
      const x=REEF_CANYON.center.x+side*
        (REEF_CANYON.rimHalfWidth+.30*Math.sin(i*.82+side));
      const floorY=seaFloorHeight(x,z);
      const depth=SEA_SURFACE-floorY;
      const height=Math.min(REEF_CANYON.maxWallHeight,
        Math.max(2.2,depth-REEF_CANYON.minSurfaceClearance-.55),
        3.45+.48*Math.sin(i*.82+side*.7));
      const radius=REEF_CANYON.wallRadius+.20*Math.sin(i*1.23+side);
      return {
        id:`reef-canyon-${side<0?"west":"east"}-${i+1}`,
        side,index:i,point:{x,z},floorY,height,radius,
        topY:floorY+height,
      };
    })
  );

export function reefCanyonNear(point:Point,margin=0):boolean{
  const zMid=REEF_CANYON.startZ+
    (REEF_CANYON.segments-1)*REEF_CANYON.spacing/2;
  const halfLength=(REEF_CANYON.segments-1)*REEF_CANYON.spacing/2;
  return Math.abs(point.x-REEF_CANYON.center.x)<
    REEF_CANYON.rimHalfWidth+3+margin &&
    Math.abs(point.z-zMid)<halfLength+4+margin;
}

/** Only seabed rocks at the swimmer's actual height block travel.
 * Avoiding obstacles entirely in stepSwim caused visual body-through-rock
 * clipping; globally enabling them incorrectly blocked the sea surface.
 */
export function reefCanyonConstrainSwim(
 from:Point,to:Point,swimmerY:number,camera=false
):Point{
 if(!reefCanyonNear(from,4)&&!reefCanyonNear(to,4))return to;
 const radius=camera?REEF_CANYON.cameraClearance:REEF_CANYON.swimmerRadius;
 const active:Obstacle[]=REEF_CANYON_ROCKS.filter(r=>
   swimmerY<=r.topY+radius &&
   swimmerY>=r.floorY-.45 &&
   // Keep the sweep affordable and avoid distant landmarks.
   Math.abs(r.point.x-from.x)<15&&Math.abs(r.point.z-from.z)<22
 ).map(r=>({...r.point,radius:Math.max(.2,r.radius+radius-.45),
   topY:r.topY}));
 if(!active.length)return to;
 return constrainMove(from,to,active);
}

export function reefCanyonCorridorClear(p:Point):boolean{
 if(!reefCanyonNear(p))return false;
 return REEF_CANYON_ROCKS.every(r=>
   Math.hypot(p.x-r.point.x,p.z-r.point.z)>
   r.radius+REEF_CANYON.swimmerRadius+.12);
}

export function reefCanyonQualification():boolean{
 const c=REEF_CANYON;
 const mid={x:c.center.x,z:c.center.z};
 if(waterZone(mid)!=="kelp"||maxDiveDepth(mid)<4)return false;
 for(let i=0;i<c.segments;i++){
   const z=c.startZ+i*c.spacing;
   const p={x:c.center.x,z};
   if(!reefCanyonCorridorClear(p)||maxDiveDepth(p)<4)return false;
   const walls=REEF_CANYON_ROCKS.filter(r=>r.index===i);
   if(walls.length!==2)return false;
   for(const wall of walls){
     if(waterZone(wall.point)!=="kelp")return false;
     if(wall.topY>=SEA_SURFACE-c.minSurfaceClearance)return false;
     if(Math.abs(wall.floorY-seaFloorHeight(wall.point.x,wall.point.z))>1e-9)
       return false;
   }
 }
 return true;
}
