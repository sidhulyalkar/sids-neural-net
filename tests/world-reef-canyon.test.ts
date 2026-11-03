import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import * as THREE from "three/src/Three.Core.js";
import {
  MOSS_CANYON,PAPER_CAVE,SEA_SURFACE,waterZone,seaFloorHeight,
  maxDiveDepth,regionLanding,
} from "../lib/world/model";
import {
  REEF_CANYON,REEF_CANYON_ROCKS,reefCanyonNear,
  reefCanyonQualification,reefCanyonCorridorClear,
  reefCanyonConstrainSwim,
} from "../lib/world/reefCanyon";
import {createMossCanyonReef} from "../components/world/worldMossCanyonReef";

test("Moss Canyon is submerged and the separate skate Canyon Flow still exists",()=>{
  assert.equal(waterZone(MOSS_CANYON.center),"kelp");
  assert.ok(reefCanyonQualification());
  assert.equal(REEF_CANYON_ROCKS.length,16);
  assert.deepEqual(regionLanding("canyon"),{
    x:MOSS_CANYON.center.x,z:MOSS_CANYON.startZ-3.2,
  });
  assert.ok(maxDiveDepth(regionLanding("canyon"))>3);
  const sport=readFileSync(new URL("../lib/world/skatepark.ts",import.meta.url),"utf8");
  assert.match(sport,/export const CANYON_FLOW/);
  const home=readFileSync(new URL("../components/world/WorldHome.tsx",import.meta.url),"utf8");
  assert.match(home,/skateDestination: ride/);
  assert.match(home,/ride === "canyon-flow"/);
});

test("eight two-sided rock stations make a 6m+ continuous clear swim corridor",()=>{
  for(let i=0;i<REEF_CANYON.segments;i++){
    const z=REEF_CANYON.startZ+i*REEF_CANYON.spacing;
    const middle={x:REEF_CANYON.center.x,z};
    assert.ok(reefCanyonCorridorClear(middle));
    assert.ok(reefCanyonNear(middle));
    const east=REEF_CANYON_ROCKS.find(w=>w.index===i&&w.side===1)!;
    const west=REEF_CANYON_ROCKS.find(w=>w.index===i&&w.side===-1)!;
    const lane=east.point.x-east.radius-(west.point.x+west.radius);
    assert.ok(lane>=REEF_CANYON.clearHalfWidth*2-.6);
    assert.ok(lane>2*REEF_CANYON.swimmerRadius+3.8);
    for(const wall of [east,west]){
      assert.equal(waterZone(wall.point),"kelp");
      assert.ok(wall.topY<SEA_SURFACE-REEF_CANYON.minSurfaceClearance);
      assert.ok(Math.abs(wall.floorY-
        seaFloorHeight(wall.point.x,wall.point.z))<1e-8);
    }
  }
});

test("divers cannot clip through rock but swimmers glide over fully submerged crowns",()=>{
  const wall=REEF_CANYON_ROCKS[4];
  const center={x:REEF_CANYON.center.x,z:wall.point.z};
  const deepY=(wall.floorY+wall.topY)/2;
  const stopped=reefCanyonConstrainSwim(center,wall.point,deepY);
  assert.ok(Math.hypot(stopped.x-wall.point.x,stopped.z-wall.point.z)>=
    wall.radius+REEF_CANYON.swimmerRadius-.02);
  assert.ok(Math.hypot(stopped.x-wall.point.x,stopped.z-wall.point.z)<
    Math.hypot(center.x-wall.point.x,center.z-wall.point.z));
  assert.deepEqual(reefCanyonConstrainSwim(center,wall.point,
    SEA_SURFACE-.45),wall.point);
  const away={x:0,z:0};
  assert.deepEqual(reefCanyonConstrainSwim(away,{x:1,z:1},deepY),
    {x:1,z:1});
});

test("snorkel reef is lightweight, source-accurate and cleanly disposable",()=>{
  const root=new THREE.Group();
  const reef=createMossCanyonReef(root);
  assert.equal(reef.rockCount,16);
  assert.equal(reef.coralCount,64);
  assert.equal(reef.anemoneCount,32);
  assert.equal(reef.root.name,"submerged-moss-canyon-reef");
  assert.equal(reef.root.children.length,3);
  assert.ok(reef.maxTop<SEA_SURFACE-REEF_CANYON.minSurfaceClearance);
  let vertices=0;
  for(const item of reef.root.children){
    assert.ok(item instanceof THREE.Mesh);
    const mesh=item as THREE.Mesh;
    const positions=mesh.geometry.getAttribute("position");
    assert.equal(mesh.geometry.getAttribute("color").count,positions.count);
    assert.ok((mesh.material as THREE.MeshStandardMaterial).vertexColors);
    vertices+=positions.count;
  }
  assert.ok(vertices<120000,"reef details must stay within a mobile geometry budget");
  reef.dispose();
  assert.equal(root.children.length,0);
});

test("canyon uses existing kelp gate, protected swim collision and underwater arrival",()=>{
  const scene=readFileSync(new URL("../components/world/worldRenderer.ts",import.meta.url),"utf8");
  assert.match(scene,/createMossCanyonReef\(reefRoot\)/);
  assert.match(scene,/mossCanyonReef\.dispose\(\)/);
  assert.match(scene,/reefCanyonConstrainSwim\(player,swimAttempt\.point,playerY\)/);
  assert.match(scene,/reefCanyonConstrainSwim\(player,\{/);
  assert.match(scene,/camera\.position\.y,true\)/);
  assert.match(scene,/arrivalIsCanyon\?"dive":"land"/);
  assert.match(scene,/reefRoot\.visible = aquatic !== "land" && currentWaterZone === "kelp"/);
  assert.doesNotMatch(scene,/const canyonStone: Instance\[\]/);
});
