import {SEA_SURFACE,seaFloorHeight,maxDiveDepth,waterZone,type Point} from "./model";

/**
 * West-coast Sea Glass Archive. Deterministic maze graph and wall topology.
 * Architectural data has no Three.js dependency, so collision and traversability
 * are tested with the same geometry that is rendered.
 */
export const UNDERWATER_BUNKER={
 center:{x:-75.2,z:4},
 grid:6,cell:5.4,
 entranceRow:4,
 wallHeight:3.35,
 photoFrameWidth:2.75,photoFrameHeight:2.05,
} as const;
const {grid,cell,center,entranceRow}=UNDERWATER_BUNKER;
export type BunkerWall={id:string;x:number;z:number;along:"x"|"z";length:number;faces:readonly ("north"|"south"|"east"|"west")[]};
export type BunkerPhotoSlot={id:string;x:number;z:number;y:number;yaw:number;wallId:string};
export type BunkerMaze={
 walls:BunkerWall[];slots:BunkerPhotoSlot[];passages:readonly [number,number][];
 entry:Point;entryY:number;cells:number;photoCapacity:number;
};
const cellId=(r:number,c:number)=>r*grid+c;
const seam=(a:number,b:number)=>[a,b].sort((x,y)=>x-y).join(":");
const mid=(r:number,c:number)=>({
 x:center.x+(c-(grid-1)/2)*cell,
 z:center.z+(r-(grid-1)/2)*cell,
});
export function bunkerEntrance(){
 const p=mid(entranceRow,grid-1);
 return {x:center.x+grid*cell/2,z:p.z};
}
export function bunkerInside(p:Point){
 return Math.abs(p.x-center.x)<grid*cell/2-.25&&
  Math.abs(p.z-center.z)<grid*cell/2-.25;
}
export function bunkerNearby(p:Point,range=43){
 return Math.hypot(p.x-center.x,p.z-center.z)<range;
}
export function bunkerHatchAccessible(p:Point,y:number,mode:string){
 const entry=bunkerEntrance();
 return mode==="dive"&&waterZone(p)==="kelp"&&
  Math.hypot(p.x-entry.x,p.z-entry.z)<5.2&&
  Math.abs(y-(seaFloorHeight(entry.x,entry.z)+1.55))<1.6&&
  y<SEA_SURFACE-1.9;
}
export function bunkerSwimY(p:Point){
 return seaFloorHeight(p.x,p.z)+1.75;
}
export function bunkerDepthIsReachable(p:Point){
 const d=SEA_SURFACE-bunkerSwimY(p);
 return waterZone(p)==="kelp"&&d>=.6&&d<=maxDiveDepth(p)+.05;
}
export function bunkerLayout():BunkerMaze{
 let seed=0x5eac1a55;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const visited=new Set<number>(),open=new Set<string>();
 const start=cellId(entranceRow,grid-1),stack=[start];
 visited.add(start);
 while(stack.length){
  const at=stack[stack.length-1],r=Math.floor(at/grid),c=at%grid;
  const adjacent=[[r-1,c],[r+1,c],[r,c-1],[r,c+1]]
   .filter(([rr,cc])=>rr>=0&&rr<grid&&cc>=0&&cc<grid)
   .map(([rr,cc])=>cellId(rr,cc)).filter(id=>!visited.has(id));
  if(!adjacent.length){stack.pop();continue;}
  const next=adjacent[Math.floor(rand()*adjacent.length)];
  open.add(seam(at,next));visited.add(next);stack.push(next);
 }
 // Four reconnections create meaningful loops without erasing the maze.
 let loops=0;
 for(let r=0;r<grid&&loops<4;r++)for(let c=0;c<grid&&loops<4;c++){
  const at=cellId(r,c);
  for(const next of [c<grid-1?cellId(r,c+1):-1,r<grid-1?cellId(r+1,c):-1]){
   if(next<0||open.has(seam(at,next)))continue;
   if(rand()<.32){open.add(seam(at,next));loops++;}
  }
 }
 const walls:BunkerWall[]=[];
 const add=(along:"x"|"z",boundary:number,at:number,faces:BunkerWall["faces"])=>{
  const isAlongX=along==="x";
  walls.push({id:(isAlongX?"h":"v")+":"+boundary+":"+at,
   x:center.x+(isAlongX?at-(grid-1)/2:boundary-grid/2)*cell,
   z:center.z+(isAlongX?boundary-grid/2:at-(grid-1)/2)*cell,
   along,length:cell,faces});
 };
 for(let boundary=0;boundary<=grid;boundary++)for(let c=0;c<grid;c++){
  if(boundary>0&&boundary<grid&&open.has(seam(cellId(boundary-1,c),cellId(boundary,c))))continue;
  const faces=boundary===0?["south"]:boundary===grid?["north"]:["north","south"];
  add("x",boundary,c,faces as BunkerWall["faces"]);
 }
 for(let boundary=0;boundary<=grid;boundary++)for(let r=0;r<grid;r++){
  if(boundary===grid&&r===entranceRow)continue;
  if(boundary>0&&boundary<grid&&open.has(seam(cellId(r,boundary-1),cellId(r,boundary))))continue;
  const faces=boundary===0?["east"]:boundary===grid?["west"]:["east","west"];
  add("z",boundary,r,faces as BunkerWall["faces"]);
 }
 // The hatch replaces the full east wall with two sealed flanking segments.
 const entry=bunkerEntrance(),gap=2.8;
 for(const side of [-1,1]){
  walls.push({id:"entry-cheek:"+side,x:entry.x,z:entry.z+side*(gap/2+(cell-gap)/4),
   along:"z",length:(cell-gap)/2,faces:["west"]});
 }
 const slots:BunkerPhotoSlot[]=[];
 for(const wall of walls){
  for(const face of wall.faces){
   // The outer flank of the airlock is reserved for seal and handle hardware.
   if(wall.id.startsWith("entry-cheek:"))continue;
   const dx=face==="east"?.16:face==="west"?-.16:0;
   const dz=face==="north"?.16:face==="south"?-.16:0;
   const yaw=face==="east"?Math.PI/2:face==="west"?-Math.PI/2:
    face==="south"?Math.PI:0;
   const point={x:wall.x+dx,z:wall.z+dz};
   slots.push({id:wall.id+":"+face,x:point.x,z:point.z,
    y:seaFloorHeight(point.x,point.z)+1.85,
    yaw,wallId:wall.id});
  }
 }
 return {walls,slots,passages:[...open].map(s=>s.split(":").map(Number) as [number,number]),
  entry,entryY:seaFloorHeight(entry.x,entry.z)+1.55,
  cells:grid*grid,photoCapacity:slots.length};
}
