import test from "node:test";
import assert from "node:assert/strict";
import {ARCADE_CAVE,arcadeCaveFloorHeight,caveHalfWidth} from "../lib/world/model";
import {ARCADE_CAVERN_MURALS,validateArcadeArtManifest} from "../lib/world/arcadeCavernArtManifest";
import {caveArtRing,sampleCavernArt,validateCavernMural} from "../lib/world/arcadeCavernSurface";

test("Curated wall program honors the corrected shonen/isekai/sports anime favorites",()=>{
 assert.deepEqual(validateArcadeArtManifest(ARCADE_CAVERN_MURALS),[]);
 assert.equal(ARCADE_CAVERN_MURALS.length,5);
 const ids=ARCADE_CAVERN_MURALS.map(m=>m.id);
 assert.deepEqual(ids,["out-of-this-world","home-stand","raid-ascend",
  "striker-setpoint","sids-underground"]);
 const anime=ARCADE_CAVERN_MURALS.find(m=>m.theme==="anime")!;
 const sports=ARCADE_CAVERN_MURALS.find(m=>m.theme==="sport-anime")!;
 for(const favorite of ["SOLO LEVELING","JUJUTSU KAISEN","CHAINSAW MAN",
  "FIRE FORCE","KAIJU NO. 8","TOWER OF GOD","HELL'S PARADISE",
  "SHANGRI-LA FRONTIER"])assert.ok(anime.tags.includes(favorite));
 for(const favorite of ["BLUE LOCK","HAIKYU!!"])
  assert.ok(sports.tags.includes(favorite));
 for(const muted of ["VINLAND SAGA","FULLMETAL ALCHEMIST"])
  assert.ok(!ARCADE_CAVERN_MURALS.some(m=>m.tags.some(t=>t.includes(muted))));
 assert.ok(ARCADE_CAVERN_MURALS.every(m=>!validateCavernMural(m)));
});

test("Curved graffiti is projected into interior of exact 17-shell ring segments",()=>{
 for(let index=0;index<=16;index++){
  const ring=caveArtRing(index);
  assert.equal(ring.length,7);
  for(const p of ring)assert.ok([p.x,p.y,p.z].every(Number.isFinite));
  const w=caveHalfWidth(ring[0].z);
  assert.ok(Math.abs(ring[0].x-(16-w))<.00001);
  assert.ok(Math.abs(ring[6].x-(16+w))<.00001);
 }
 for(const mural of ARCADE_CAVERN_MURALS){
  for(let i=0;i<=10;i++){
   const t=i/10,z=mural.z0+(mural.z1-mural.z0)*t;
   for(let j=0;j<=8;j++){
    const v=mural.v0+(mural.v1-mural.v0)*j/8;
    const p=sampleCavernArt(mural.surface,z,t,v,.056);
    assert.ok(p, "missing "+mural.id+" "+i+" "+j);
    const a=p!.position,n=p!.normal;
    assert.ok([a.x,a.y,a.z,n.x,n.y,n.z].every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(n.x,n.y,n.z)-1)<.00001);
    if(mural.surface==="left")assert.ok(n.x>.20);
    if(mural.surface==="right")assert.ok(n.x<-.20);
    if(mural.surface==="back")assert.ok(a.y>
      arcadeCaveFloorHeight(ARCADE_CAVE.wall)+4.2);
   }
  }
 }
});

test("Floor paint uses underground support, not mountain topography",()=>{
 for(const z of [-78,-75.5,-72,-68,-65.2]){
  for(const u of [.1,.25,.5,.75,.9]){
   const floor=sampleCavernArt("floor",z,u,.35,.056)!;
   assert.ok(Math.abs(floor.position.y-
    (arcadeCaveFloorHeight({x:floor.position.x,z})-.024))<1e-6);
   const ceiling=sampleCavernArt("ceiling",z,u,.35,.056)!;
   assert.ok(ceiling.position.y>floor.position.y+3);
  }
 }
});
test("No invalid, clipping, nonfinite or game-occluding mural descriptors",()=>{
 const first=ARCADE_CAVERN_MURALS[0];
 assert.match(validateCavernMural({...first,id:"",title:""})!,/invalid/);
 assert.match(validateCavernMural({...first,z1:-62})!,/bounds/);
 assert.match(validateCavernMural({...first,z1:-66})!,/sightline/);
 assert.match(validateCavernMural({...first,v1:NaN})!,/nonfinite/);
 assert.equal(sampleCavernArt("left",-90,.5,.5),null);
 assert.equal(sampleCavernArt("right",-70,.5,.5,-.1),null);
 assert.deepEqual(validateArcadeArtManifest([first,first]),["duplicate "+first.id]);
});
