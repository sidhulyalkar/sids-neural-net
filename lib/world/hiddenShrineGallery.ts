import { SEA_SURFACE, maxDiveDepth, seaFloorHeight, type Point } from "./model";

/**
 * The gallery is a second, fully submerged navigation volume BELOW the natural
 * sea floor. Nothing in this module changes the public seabed or coast heights.
 * Room portals and movement bounds share the same authored door graph.
 */
export const SHRINE_GALLERY = {
  entrance: { x: -62, z: 7 } as Point,
  halfRoom: 3.8,
  roomStep: 7.8,
  wallThickness: 0.42,
  doorHalfWidth: 1.18,
  floorY: SEA_SURFACE - 16.7,
  roofY: SEA_SURFACE - 12.7,
  photoCount: 49,
} as const;

/** Explicit vertical separation avoids any coplanar z-fighting at thresholds. */
export const GALLERY_FLOOR_GEOMETRY={
  slabCenterOffset:-.22,
  slabThickness:.45,
  sillCenterOffset:.028,
  sillThickness:.018,
} as const;

export type GalleryPhase = "outside" | "descending" | "inside" | "ascending";
export type GallerySide = "north" | "east" | "south" | "west";
export type GalleryDoor = { from: number; to: number };
export type GalleryPhotoSlot = {
  id: string; roomIndex: number; side: GallerySide;
  x: number; y: number; z: number; yaw: number; width: number;
};

// One meandering, inspectable route. There are no unconnected rooms, and the
// door graph, geometry and collision all derive from this same topology.
export const GALLERY_ROOMS: readonly Point[] = Array.from({ length: 12 }, (_, i) => ({
  x: SHRINE_GALLERY.entrance.x - (i % 4) * SHRINE_GALLERY.roomStep,
  z: SHRINE_GALLERY.entrance.z + Math.floor(i / 4) * SHRINE_GALLERY.roomStep,
}));
export const GALLERY_ROUTE = [0, 1, 2, 3, 7, 6, 5, 4, 8, 9, 10, 11] as const;
export const GALLERY_DOORS: readonly GalleryDoor[] = GALLERY_ROUTE.slice(1).map((to, i) => ({
  from: GALLERY_ROUTE[i], to,
}));

/** The room centers form a fully occupied 4×3 rectilinear grid.
 * One continuous stone foundation eliminates coplanar threshold slabs and
 * guarantees a watertight walking surface throughout all eleven passages.
 */
export function galleryFloorFootprint(){
  const half=SHRINE_GALLERY.roomStep/2;
  const minX=Math.min(...GALLERY_ROOMS.map(r=>r.x))-half;
  const maxX=Math.max(...GALLERY_ROOMS.map(r=>r.x))+half;
  const minZ=Math.min(...GALLERY_ROOMS.map(r=>r.z))-half;
  const maxZ=Math.max(...GALLERY_ROOMS.map(r=>r.z))+half;
  return {
    x:(minX+maxX)/2,z:(minZ+maxZ)/2,
    width:maxX-minX,depth:maxZ-minZ,
    minX,maxX,minZ,maxZ,
  };
}

export type GalleryCeilingTile={
  roomIndex:number;x:number;z:number;width:number;depth:number;
};
/** All ceiling patches are mutually nonoverlapping, with one 2.8m
 * shaft aperture in room zero. A deterministic plan is easier to validate
 * than independent roof slabs and connector pieces in rendering code.
 */
export function galleryCeilingTiles():readonly GalleryCeilingTile[]{
  const size=SHRINE_GALLERY.roomStep;
  const aperture=2.8;
  const strip=(size-aperture)/2;
  const offset=(size+aperture)/4;
  return GALLERY_ROOMS.flatMap((room,roomIndex)=>{
    if(roomIndex!==0)return [{
      roomIndex,x:room.x,z:room.z,width:size,depth:size,
    }];
    return [-1,1].flatMap(sign=>[
      {roomIndex,x:room.x+sign*offset,z:room.z,
        width:strip,depth:size},
      {roomIndex,x:room.x,z:room.z+sign*offset,
        width:aperture,depth:strip},
    ]);
  });
}

export type GalleryThreshold = {
  from:number;to:number;
  x:number;z:number;width:number;depth:number;
};
/** Only decorative raised doorway sills, never a second floor at floor level. */
export function galleryDoorThresholds():readonly GalleryThreshold[]{
  return GALLERY_DOORS.map(({from,to})=>{
    const a=GALLERY_ROOMS[from],b=GALLERY_ROOMS[to];
    const horizontal=Math.abs(a.x-b.x)>1;
    return {
      from,to,x:(a.x+b.x)/2,z:(a.z+b.z)/2,
      width:horizontal?.26:1.75,
      depth:horizontal?1.75:.26,
    };
  });
}

export function galleryDoorSide(roomIndex: number, side: GallerySide): boolean {
  const room = GALLERY_ROOMS[roomIndex];
  return GALLERY_DOORS.some(({ from, to }) => {
    const other = from === roomIndex ? GALLERY_ROOMS[to] :
      to === roomIndex ? GALLERY_ROOMS[from] : null;
    if (!other) return false;
    const dx = other.x - room.x, dz = other.z - room.z;
    return side === "east" ? dx > 0 && Math.abs(dz) < 0.01 :
      side === "west" ? dx < 0 && Math.abs(dz) < 0.01 :
      side === "north" ? dz < 0 && Math.abs(dx) < 0.01 :
      dz > 0 && Math.abs(dx) < 0.01;
  });
}

export function galleryPhotoSlots(): readonly GalleryPhotoSlot[] {
  const sides: GallerySide[] = ["north", "east", "south", "west"];
  const h = SHRINE_GALLERY.halfRoom - 0.12;
  const slots = GALLERY_ROOMS.flatMap((room, roomIndex) =>
    sides.map((side, i) => {
      const hasDoor = galleryDoorSide(roomIndex, side);
      const offset = hasDoor ? (i % 2 ? 2.25 : -2.25) : 0;
      return {
        id: `photo-${String(roomIndex * 4 + i + 1).padStart(3, "0")}`,
        roomIndex, side,
        x: side === "east" ? room.x + h : side === "west" ? room.x - h : room.x + offset,
        z: side === "south" ? room.z + h : side === "north" ? room.z - h : room.z + offset,
        y: SHRINE_GALLERY.floorY + 2.12,
        yaw: side === "north" ? 0 : side === "south" ? Math.PI :
          side === "east" ? -Math.PI / 2 : Math.PI / 2,
        width: hasDoor ? 1.85 : 2.85,
      };
    }));
  // A final photograph belongs to a small entrance alcove rather than being
  // duplicated. Its plinth is entirely inside the first chamber.
  slots.push({
    id: "photo-049", roomIndex: 0, side: "north",
    x: GALLERY_ROOMS[0].x - 2.1,
    z: GALLERY_ROOMS[0].z + 2.05,
    y: SHRINE_GALLERY.floorY + 2.16,
    yaw: -Math.PI / 4, width: 1.6,
  });
  return slots;
}

export function galleryShaftTopY(): number {
  return seaFloorHeight(SHRINE_GALLERY.entrance.x, SHRINE_GALLERY.entrance.z);
}
export function shrineReachable(p: Point, swimDepth: number): boolean {
  return Math.hypot(p.x - SHRINE_GALLERY.entrance.x,
    p.z - SHRINE_GALLERY.entrance.z) < 1.15 &&
    swimDepth >= maxDiveDepth(p) - 0.75 &&
    maxDiveDepth(p) > 2.5;
}

/** Horizontal collision through the authored doors; never phase through rock. */
export function galleryWalkable(p: Point): boolean {
  const inner = SHRINE_GALLERY.halfRoom - 0.46;
  if (GALLERY_ROOMS.some(r => Math.abs(p.x - r.x) <= inner &&
    Math.abs(p.z - r.z) <= inner)) return true;
  return GALLERY_DOORS.some(({ from, to }) => {
    const a = GALLERY_ROOMS[from], b = GALLERY_ROOMS[to];
    if (Math.abs(a.x - b.x) > 1) {
      return Math.abs(p.z - a.z) < SHRINE_GALLERY.doorHalfWidth - .24 &&
        p.x <= Math.max(a.x, b.x) - inner &&
        p.x >= Math.min(a.x, b.x) + inner;
    }
    return Math.abs(p.x - a.x) < SHRINE_GALLERY.doorHalfWidth - .24 &&
      p.z >= Math.min(a.z, b.z) + inner &&
      p.z <= Math.max(a.z, b.z) - inner;
  });
}

/** Swept collision prevents a low frame-rate step from skipping a wall. */
export function galleryConstrainMove(from: Point, to: Point): Point {
  const length = Math.hypot(to.x - from.x, to.z - from.z);
  const steps = Math.max(1, Math.ceil(length / 0.18));
  let current = from;
  for (let i = 1; i <= steps; i++) {
    const proposed = { x: from.x + (to.x - from.x) * i / steps,
      z: from.z + (to.z - from.z) * i / steps };
    if (!galleryWalkable(proposed)) break;
    current = proposed;
  }
  return current;
}
export type GalleryWalkState={point:Point;heading:Point;speed:number};
const GALLERY_WALK_SPEED=2.6;

/** Frame-rate tolerant WALKING, not swimming. Each long frame is broken into
 * small collision-constrained steps, so a slow GPU does not make the exhibit
 * impossible to traverse and no step may tunnel through a closed wall.
 */
export function galleryStepWalk(
  current:GalleryWalkState,input:Point,deltaSeconds:number,
  destination?:Point|null,
):GalleryWalkState{
  const dt=Math.max(0,Math.min(Number.isFinite(deltaSeconds)?deltaSeconds:0,.5));
  const magnitude=Math.hypot(input.x,input.z);
  const walking=magnitude>.001;
  const heading=walking
    ? {x:input.x/magnitude,z:input.z/magnitude}
    : current.heading;
  let point=current.point;
  let speed=Math.max(0,Math.min(GALLERY_WALK_SPEED,current.speed));
  let remaining=dt;
  while(remaining>1e-7){
    const step=Math.min(.04,remaining);
    remaining-=step;
    speed=walking?Math.min(GALLERY_WALK_SPEED,speed+9*step):
      Math.max(0,speed-12*step);
    if(speed<1e-7)continue;
    const limit=destination?Math.hypot(
      destination.x-point.x,destination.z-point.z):Infinity;
    const advance=Math.min(speed*step,limit);
    if(advance<=1e-7){speed=0;break;}
    const next=galleryConstrainMove(point,{
      x:point.x+heading.x*advance,z:point.z+heading.z*advance,
    });
    const moved=Math.hypot(next.x-point.x,next.z-point.z);
    point=next;
    if(moved<advance*.2){speed=0;break;}
  }
  return {point,heading,speed};
}

export function galleryNearShaft(p: Point): boolean {
  return Math.hypot(p.x - SHRINE_GALLERY.entrance.x,
    p.z - SHRINE_GALLERY.entrance.z) < 1.15;
}
