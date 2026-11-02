import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { visualArchive } from "../src/data/visualArchive";
import { SEA_SURFACE, isWater, maxDiveDepth, seaFloorHeight } from "../lib/world/model";
import {
  SHRINE_GALLERY, GALLERY_DOORS, GALLERY_ROOMS, GALLERY_ROUTE,
  galleryDoorSide, galleryPhotoSlots, galleryConstrainMove,
  galleryWalkable, galleryNearShaft, galleryShaftTopY, shrineReachable,
  galleryFloorFootprint, galleryDoorThresholds, galleryCeilingTiles,
  GALLERY_FLOOR_GEOMETRY, galleryStepWalk,
} from "../lib/world/hiddenShrineGallery";

test("the shrine is a discoverable WEST-coast underwater entrance near the UCSD trident",()=>{
  const p=SHRINE_GALLERY.entrance;
  assert.ok(isWater(p));
  assert.ok(Math.hypot(p.x+58,p.z-7)<8);
  assert.ok(maxDiveDepth(p)>2.5);
  assert.equal(galleryShaftTopY(),seaFloorHeight(p.x,p.z));
  assert.equal(shrineReachable(p,maxDiveDepth(p)),true);
  assert.equal(shrineReachable(p,0),false);
  assert.equal(shrineReachable({x:p.x+5,z:p.z},maxDiveDepth(p)),false);
  assert.equal(galleryNearShaft(p),true);
});

test("all twelve rooms are below both the sea surface and natural seabed",()=>{
  assert.equal(GALLERY_ROOMS.length,12);
  assert.equal(new Set(GALLERY_ROOMS.map(p=>p.x+","+p.z)).size,12);
  for(const p of GALLERY_ROOMS){
    assert.ok(isWater(p),"room stays offshore");
    assert.ok(SHRINE_GALLERY.roofY<seaFloorHeight(p.x,p.z)-.5,
      "gallery roof must remain buried beneath seabed");
    assert.ok(SHRINE_GALLERY.roofY<SEA_SURFACE-8);
    assert.ok(SHRINE_GALLERY.roofY-SHRINE_GALLERY.floorY>3.5);
  }
});

test("one shared authored door graph connects every gallery room in both directions",()=>{
  assert.equal(GALLERY_ROUTE.length,GALLERY_ROOMS.length);
  assert.equal(new Set(GALLERY_ROUTE).size,GALLERY_ROOMS.length);
  assert.equal(GALLERY_DOORS.length,GALLERY_ROOMS.length-1);
  for(const d of GALLERY_DOORS){
    const a=GALLERY_ROOMS[d.from],b=GALLERY_ROOMS[d.to];
    assert.ok(Math.abs(Math.hypot(a.x-b.x,a.z-b.z)-SHRINE_GALLERY.roomStep)<1e-7);
    const horizontal=Math.abs(a.x-b.x)>1;
    const side=horizontal?(b.x>a.x?"east":"west"):(b.z>a.z?"south":"north");
    const reverse=horizontal?(b.x>a.x?"west":"east"):(b.z>a.z?"north":"south");
    assert.ok(galleryDoorSide(d.from,side));
    assert.ok(galleryDoorSide(d.to,reverse));
    for(let i=0;i<=100;i++){
      const to={x:a.x+(b.x-a.x)*i/100,z:a.z+(b.z-a.z)*i/100};
      assert.ok(galleryWalkable(to),`door blocked: ${d.from}→${d.to} at ${i}`);
    }
    assert.deepEqual(galleryConstrainMove(a,b),b);
    assert.deepEqual(galleryConstrainMove(b,a),a);
  }
});


test("one monolithic floor covers every room and all eleven doorway crossings",()=>{
  const floor=galleryFloorFootprint();
  const area=floor.width*floor.depth;
  assert.ok(Math.abs(area-SHRINE_GALLERY.roomStep**2*12)<1e-7);
  const within=(p:{x:number;z:number})=>
    p.x>=floor.minX-1e-8&&p.x<=floor.maxX+1e-8&&
    p.z>=floor.minZ-1e-8&&p.z<=floor.maxZ+1e-8;
  for(const room of GALLERY_ROOMS)assert.ok(within(room));
  for(const {from,to} of GALLERY_DOORS){
    const a=GALLERY_ROOMS[from],b=GALLERY_ROOMS[to];
    for(let i=0;i<=20;i++){
      const t=i/20;
      assert.ok(within({x:a.x*(1-t)+b.x*t,z:a.z*(1-t)+b.z*t}));
    }
  }
  const slabTop=GALLERY_FLOOR_GEOMETRY.slabCenterOffset+
    GALLERY_FLOOR_GEOMETRY.slabThickness/2;
  const sillBottom=GALLERY_FLOOR_GEOMETRY.sillCenterOffset-
    GALLERY_FLOOR_GEOMETRY.sillThickness/2;
  assert.ok(sillBottom-slabTop>=.01,
    "Raised door trim must have positive vertical separation from slab top");
  const sills=galleryDoorThresholds();
  assert.equal(sills.length,GALLERY_DOORS.length);
  for(const sill of sills){
    assert.ok(within(sill));
    assert.ok(sill.width>0&&sill.depth>0);
    assert.ok((sill.width<.4)!==(sill.depth<.4),
      "A sill crosses one doorway axis only");
  }
});

test("disjoint ceiling patches cover the whole grid except the entrance shaft",()=>{
  const tiles=galleryCeilingTiles();
  assert.equal(tiles.length,GALLERY_ROOMS.length+3);
  const floor=galleryFloorFootprint();
  const apertureArea=2.8**2;
  const tileArea=tiles.reduce((sum,t)=>sum+t.width*t.depth,0);
  assert.ok(Math.abs(tileArea-(floor.width*floor.depth-apertureArea))<1e-6);
  const EPS=1e-7;
  for(let i=0;i<tiles.length;i++){
    const a=tiles[i];
    assert.ok(a.width>0&&a.depth>0);
    for(let j=i+1;j<tiles.length;j++){
      const b=tiles[j];
      const overlapX=Math.min(a.x+a.width/2,b.x+b.width/2)-
        Math.max(a.x-a.width/2,b.x-b.width/2);
      const overlapZ=Math.min(a.z+a.depth/2,b.z+b.depth/2)-
        Math.max(a.z-a.depth/2,b.z-b.depth/2);
      assert.ok(overlapX<=EPS||overlapZ<=EPS,
        `Coplanar ceiling overlap between patches ${i} and ${j}`);
    }
  }
  for(const patch of tiles){
    const xGap=Math.abs(patch.x-SHRINE_GALLERY.entrance.x)-
      patch.width/2-1.4;
    const zGap=Math.abs(patch.z-SHRINE_GALLERY.entrance.z)-
      patch.depth/2-1.4;
    assert.ok(xGap>=-EPS||zGap>=-EPS,
      "The underwater shrine shaft must remain open");
  }
});

test("rendered foundation has one slab and detailed gilded picture frames",()=>{
  const source=readFileSync(new URL("../components/world/worldHiddenShrineGallery.ts",import.meta.url),"utf8");
  assert.match(source,/const floor=galleryFloorFootprint\(\)/);
  assert.match(source,/GALLERY_FLOOR_GEOMETRY\.slabCenterOffset/);
  assert.match(source,/galleryCeilingTiles\(\)/);
  assert.match(source,/galleryDoorThresholds\(\)/);
  assert.doesNotMatch(source,/add\(r\.x,bottom-\.22/);
  assert.doesNotMatch(source,/Stone bridge plates close/);
  assert.match(source,/const ornamentBead=new THREE\.SphereGeometry/);
  assert.match(source,/const ornamentStroke=new THREE\.CylinderGeometry/);
  assert.match(source,/carvedStroke\(/);
  assert.match(source,/halfW\+\.16/);
  assert.match(source,/photoTargets\.push\(m\)/);
  assert.doesNotMatch(source,/fillText\(slots\[i\]\.id/);
});

test("gallery walking crosses a real doorway consistently at 5, 20 and 60 FPS",()=>{
  const start=GALLERY_ROOMS[0];
  const simulate=(fps:number)=>{
    let state={
      point:{...start},heading:{x:-1,z:0},speed:0,
    };
    for(let i=0;i<Math.round(3.6*fps);i++){
      state=galleryStepWalk(state,{x:-1,z:0},1/fps);
      assert.ok(galleryWalkable(state.point),"Walk collision remains inside gallery");
    }
    return state;
  };
  const at5=simulate(5),at20=simulate(20),at60=simulate(60);
  for(const state of [at5,at20,at60])
    assert.ok(start.x-state.point.x>7.4,
      "Walking must reach the next chamber in 3.6 seconds");
  assert.ok(Math.abs(at5.point.x-at60.point.x)<.18,
    "Real travel distance must be mostly independent of rendering FPS");
  assert.ok(Math.abs(at20.point.x-at60.point.x)<.18);
});

test("gallery walking collision prevents tunneling into a closed neighboring room",()=>{
  const start=GALLERY_ROOMS[0];
  let state={point:{...start},heading:{x:0,z:1},speed:0};
  for(let i=0;i<25;i++){
    state=galleryStepWalk(state,{x:0,z:1},.2);
    assert.ok(galleryWalkable(state.point));
  }
  assert.ok(state.point.z<start.z+SHRINE_GALLERY.halfRoom,
    "No movement through the sealed south wall");
  assert.equal(galleryStepWalk(state,{x:0,z:0},.2).speed,0);
});

test("solid walls stop a diver from crossing between disconnected neighboring rooms",()=>{
  const from=GALLERY_ROOMS[0],other=GALLERY_ROOMS[4];
  assert.ok(!galleryDoorSide(0,"south"));
  const attempted=galleryConstrainMove(from,other);
  assert.ok(attempted.z<from.z+SHRINE_GALLERY.halfRoom,
    "no through-wall movement even on long time steps");
  assert.ok(attempted.z>from.z);
  assert.ok(!galleryWalkable({x:from.x+SHRINE_GALLERY.halfRoom+1,z:from.z}));
});

test("all actual archive photographs appear exactly once in the hidden cave",()=>{
  const slots=galleryPhotoSlots();
  assert.equal(slots.length,SHRINE_GALLERY.photoCount);
  assert.equal(new Set(slots.map(p=>p.id)).size,49);
  assert.deepEqual(slots.map(p=>p.id).sort(),visualArchive.map(p=>p.id).sort());
  for(const photo of slots){
    assert.ok(photo.roomIndex>=0&&photo.roomIndex<GALLERY_ROOMS.length);
    assert.ok(photo.width>=1.5);
    assert.ok(photo.y<SHRINE_GALLERY.roofY);
    assert.ok(photo.y>SHRINE_GALLERY.floorY);
  }
});

test("render integration keeps opaque wall architecture and cavern-specific dive logic",()=>{
  const scene=readFileSync(new URL("../components/world/worldHiddenShrineGallery.ts",import.meta.url),"utf8");
  const runtime=readFileSync(new URL("../components/world/worldRenderer.ts",import.meta.url),"utf8");
  assert.match(scene,/sealed-stone-photo-gallery/);
  assert.match(scene,/opaque-gallery-stone-shell/);
  assert.match(scene,/CanvasTexture/);
  assert.doesNotMatch(scene,/MeshPhysicalMaterial|transmission:|transparent:\s*true|opacity:\s*0\.\d/i);
  assert.match(runtime,/galleryPhase==="descending"/);
  assert.match(runtime,/galleryConstrainMove/);
  assert.match(runtime,/hiddenShrineGallery\.interior\.visible=galleryPhase!=="outside"/);
  assert.match(runtime,/terrain\.setIndex\(keep\)/);
  assert.match(runtime,/hiddenShrineGallery\.dispose\(\)/);
});
