import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three/src/Three.Core.js";
import {
  RAY_PASSAGE, RAY_PASSAGE_CAST, rayPassageDepth,
  sampleRayPassage, marineEntryCoverage,
} from "../lib/world/rayPassage";
import {
  SEA_SURFACE, seaFloorHeight, waterZone,
  coastlineX, eastCoastlineX,
} from "../lib/world/model";
import { northShoreZ } from "../lib/world/skimboarding";
import { createRayPassage } from "../components/world/worldRayPassage";

test("south arch trench is smooth and original snorkeling shores are not carved", () => {
  assert.ok(rayPassageDepth(17,-127)>17,"deep south-arch centerpiece");
  for(const [x,z] of [[82,8],[0,8],[-52,8],[58,8],[17,-96],[17,-166],[60,-127],[17,80]]) {
    assert.equal(rayPassageDepth(x,z),0,`original reef or outside passage: ${x},${z}`);
  }
  for(let x=-15;x<=54;x+=.5)for(let z=-165;z<=-97;z+=.5) {
    const a=rayPassageDepth(x,z),b=rayPassageDepth(x+.1,z+.1);
    assert.ok(Number.isFinite(a)&&a>=0&&a<=17.5);
    assert.ok(Math.abs(a-b)<.55,`bathymetry seam at ${x} ${z}`);
  }
  assert.ok(seaFloorHeight(17,-127)<seaFloorHeight(17,-160)-10);
  assert.equal(waterZone({x:17,z:-127}),"south-channel");
  assert.equal(waterZone({x:-52,z:8}),"kelp");
  assert.equal(waterZone({x:75,z:8}),"lagoon");
});

test("southern arch ray visitors remain swimmable and above shared seabed", () => {
  assert.equal(RAY_PASSAGE_CAST.length,12);
  assert.deepEqual([...new Set(RAY_PASSAGE_CAST.map(r=>r.kind))].sort(),["eagle","manta","stingray"]);
  assert.equal(new Set(RAY_PASSAGE_CAST.map(r=>r.id)).size,RAY_PASSAGE_CAST.length);
  const behaviours=new Set<string>();
  for (const ray of RAY_PASSAGE_CAST)for(let t=0;t<=420;t+=2) {
    const pose=sampleRayPassage(ray,t,seaFloorHeight,SEA_SURFACE);
    assert.deepEqual(sampleRayPassage(ray,t,seaFloorHeight,SEA_SURFACE),pose);
    assert.ok(Object.values(pose).filter(v=>typeof v==="number").every(Number.isFinite),ray.id);
    assert.equal(waterZone(pose),"south-channel",ray.id);
    assert.ok(pose.y>=seaFloorHeight(pose.x,pose.z)+(ray.kind==="stingray"?.39:.84),
      `${ray.id} under floor at ${t}`);
    assert.ok(pose.y<=SEA_SURFACE-.7,ray.id);
    assert.ok(pose.x<39&&pose.x>-8&&pose.z>-166&&pose.z<-96,ray.id);
    behaviours.add(pose.activity);
    if (pose.activity==="cleaning") {
      assert.ok(ray.cleaningStation!==null,ray.id);
      const p=RAY_PASSAGE.stations[ray.cleaningStation!];
      assert.ok(Math.hypot(p.x-pose.x,p.z-pose.z)<3.5,ray.id);
    }
  }
  assert.ok(behaviours.has("cleaning"));
  assert.ok(behaviours.has("travelling"));
  assert.ok(behaviours.has("foraging"));
});

test("submerged ray geometry has three morphologies, animates and disposes", () => {
  const lagoon=new THREE.Group();
  const lifecycle=createRayPassage(lagoon);
  assert.equal(lifecycle.count,108);
  const root=lagoon.getObjectByName("eagle-ray-cleaning-passage")!;
  assert.ok(root);
  for(const spec of RAY_PASSAGE_CAST) {
    const g=root.getObjectByName(spec.id)!;
    assert.ok(g,"ray exists "+spec.id);
    const mesh=g.children.find(obj=>obj instanceof THREE.Mesh) as THREE.Mesh;
    const attr=mesh.geometry.getAttribute("position");
    assert.ok(attr.count>400);
    for(let i=0;i<attr.count;i++)
      assert.ok([attr.getX(i),attr.getY(i),attr.getZ(i)].every(Number.isFinite));
  }
  const widths=RAY_PASSAGE_CAST.filter(s=>["eagle","manta","stingray"].includes(s.kind)).reduce((out,s)=>{
    if(out[s.kind])return out;
    const g=root.getObjectByName(s.id)!;
    const mesh=g.children[0] as THREE.Mesh;
    out[s.kind]=(mesh.geometry.boundingBox ?? (mesh.geometry.computeBoundingBox(),mesh.geometry.boundingBox))!
      .max.x;
    return out;
  },{} as Record<string,number>);
  assert.ok(widths.manta>widths.eagle&&widths.eagle>widths.stingray);
  const eagle=root.getObjectByName("passage-eagle-1")!.children[0] as THREE.Mesh;
  const before=(eagle.geometry.getAttribute("position") as THREE.BufferAttribute).getY(95);
  lifecycle.update(28);
  const after=(eagle.geometry.getAttribute("position") as THREE.BufferAttribute).getY(95);
  assert.notEqual(before,after);
  assert.ok(root.getObjectByName("ray-cleaning-pinnacles") instanceof THREE.InstancedMesh);
  assert.ok(root.getObjectByName("ray-cleaner-wrasses") instanceof THREE.InstancedMesh);
  assert.ok(root.getObjectByName("station-cleaner-shrimp") instanceof THREE.InstancedMesh);
  lifecycle.dispose();
  assert.equal(lagoon.children.length,0);
});

test("360-degree shore-entry audit truthfully reports gaps until habitat infill",()=>{
  const entries=[
    ...[-70,-30,0,20,60,90].flatMap(z=>[
      {x:coastlineX(z)-1.5,z},{x:eastCoastlineX(z)+1.5,z},
    ]),
    ...[-25,0,25].map(x=>({x,z:northShoreZ(x)+1.5})),
  ];
  const survey=marineEntryCoverage(entries);
  assert.equal(survey.length,entries.length);
  assert.ok(survey.some(p=>p.covered));
  assert.ok(survey.some(p=>!p.covered),"unfilled coastline must not pass the survey");
  assert.ok(survey.every(p=>Number.isFinite(p.distance)&&p.distance>=0&&p.nearest));
});
