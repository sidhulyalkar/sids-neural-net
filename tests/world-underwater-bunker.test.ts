import test from "node:test";
import assert from "node:assert/strict";
import {visualArchive} from "../src/data/visualArchive";
import {getWorldContent} from "../lib/world/content";
import {SEA_SURFACE,maxDiveDepth,waterZone,WORLD_BOUNDS,seaFloorHeight} from "../lib/world/model";
import {bunkerLayout,bunkerInside,bunkerHatchAccessible,bunkerDepthIsReachable,
 bunkerNearby,bunkerSwimY,UNDERWATER_BUNKER} from "../lib/world/underwaterBunker";

test("Sea Glass photo maze preserves every archived photograph, one per wall face",()=>{
 const layout=bunkerLayout();
 const archive=getWorldContent().galleryPhotos;
 assert.equal(archive.length,visualArchive.length);
 assert.equal(archive.length,49,"the current Visual Archive has 49 verified photos");
 assert.ok(layout.photoCapacity>=archive.length,
  "all photos require independent physical wall displays");
 assert.equal(new Set(archive.map(p=>p.id)).size,archive.length);
 assert.equal(new Set(layout.slots.map(p=>p.id)).size,layout.slots.length);
 assert.ok(layout.slots.every(p=>Number.isFinite(p.x+p.y+p.z+p.yaw)));
});
test("Every maze cell is reachable from the airlock with loops, no sealed rooms",()=>{
 const layout=bunkerLayout(),visited=new Set<number>(),stack=[UNDERWATER_BUNKER.entranceRow*
   UNDERWATER_BUNKER.grid+UNDERWATER_BUNKER.grid-1];
 const graph=new Map<number,number[]>();
 for(const [a,b] of layout.passages){
  graph.set(a,[...(graph.get(a)??[]),b]);
  graph.set(b,[...(graph.get(b)??[]),a]);
 }
 while(stack.length){
  const id=stack.pop()!;
  if(visited.has(id))continue;
  visited.add(id);
  stack.push(...(graph.get(id)??[]));
 }
 assert.equal(visited.size,layout.cells);
 assert.equal(layout.cells,36);
 assert.ok(layout.passages.length>=layout.cells-1+2,"include loop routes");
 assert.deepEqual(bunkerLayout(),layout,"layout must be fully deterministic");
});
test("Bunker placement remains within the western kelp zone and diving range",()=>{
 const layout=bunkerLayout();
 assert.equal(waterZone(layout.entry),"kelp");
 assert.ok(layout.entry.x>WORLD_BOUNDS.minX&&layout.entry.x<WORLD_BOUNDS.maxX);
 assert.ok(bunkerNearby({x:-58,z:7},11),"hatch belongs near UCSD trident");
 assert.ok(!bunkerInside(layout.entry),"the entrance must be outside the gallery");
 for(const slot of layout.slots){
  assert.ok(slot.x>WORLD_BOUNDS.minX+.05&&slot.x<WORLD_BOUNDS.maxX);
  assert.ok(slot.z>WORLD_BOUNDS.minZ+.05&&slot.z<WORLD_BOUNDS.maxZ);
  assert.equal(waterZone(slot),"kelp");
  assert.ok(bunkerDepthIsReachable(slot),`unreachable exhibit ${slot.id}`);
  assert.ok(slot.y<SEA_SURFACE-.4,"art must be below ocean surface");
 }
 const atDoor={x:layout.entry.x+1,z:layout.entry.z};
 assert.equal(bunkerHatchAccessible(atDoor,layout.entryY,"land"),false);
 assert.equal(bunkerHatchAccessible(atDoor,SEA_SURFACE-.1,"dive"),false);
 assert.equal(bunkerHatchAccessible(atDoor,layout.entryY,"dive"),true);
 assert.ok(SEA_SURFACE-layout.entryY<=maxDiveDepth(layout.entry)+.1);
 assert.ok(Math.abs(bunkerSwimY(layout.entry)-seaFloorHeight(layout.entry.x,layout.entry.z)-1.75)<.001);
});
test("Walls, frames and passages use consistent cell-aligned geometry",()=>{
 const layout=bunkerLayout();
 assert.equal(new Set(layout.walls.map(w=>w.id)).size,layout.walls.length);
 assert.ok(layout.walls.every(w=>w.length>1.1));
 assert.equal(layout.walls.filter(w=>w.id.startsWith("entry-cheek:")).length,2);
 for(const p of layout.slots)assert.ok(layout.walls.some(w=>w.id===p.wallId));
 // At every connected pair the separating wall must be absent.
 const grid=UNDERWATER_BUNKER.grid;
 for(const [a,b] of layout.passages){
  const rowA=Math.floor(a/grid),colA=a%grid;
  const rowB=Math.floor(b/grid),colB=b%grid;
  if(rowA===rowB){
   const border=Math.max(colA,colB);
   assert.ok(!layout.walls.some(w=>w.id===`v:${border}:${rowA}`));
  }else{
   const border=Math.max(rowA,rowB);
   assert.ok(!layout.walls.some(w=>w.id===`h:${border}:${colA}`));
  }
 }
});
