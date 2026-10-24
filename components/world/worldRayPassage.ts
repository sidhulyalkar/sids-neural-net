import * as THREE from "three/src/Three.Core.js";
import { seaFloorHeight, SEA_SURFACE } from "@/lib/world/model";
import {
  RAY_PASSAGE, RAY_PASSAGE_CAST, sampleRayPassage, type RayKind,
} from "@/lib/world/rayPassage";
import { createFishGeometry } from "./worldFaunaGeometry";
import { EAGLE_FEVER_COUNT, EAGLE_FEVER_COHORTS, EAGLE_FEVER_MOBILE_COUNT, sampleEagleFever } from "@/lib/world/rayFever";

/** Three anatomical families: no scaled copies of a single generic ray wing.
 * Small local vertex buffers animate at 15Hz; species-specific meshes own them,
 * while shared tail, rock, fish geometries and materials are reused.
 */
function createDisc(kind: RayKind): THREE.BufferGeometry {
  const segments = 48, rings = 5;
  const span = kind === "manta" ? 2.4 : kind === "eagle" ? 1.64 : 1.24;
  const length = kind === "manta" ? 1.25 : kind === "eagle" ? 1.13 : 1.18;
  const points: number[] = [], colors: number[] = [], faces: number[] = [];
  const top = new THREE.Color(kind === "manta" ? "#344451" : kind === "eagle" ? "#647b76" : "#aa967e");
  const under = new THREE.Color("#c8c9b5");
  const spots = new THREE.Color("#e8ead5");
  for (const side of [1, -1]) {
    const base = points.length / 3;
    for (let ring = 0; ring <= rings; ring++) {
      const r = ring / rings;
      for (let j = 0; j < segments; j++) {
        const angle = j / segments * Math.PI * 2;
        const sn = Math.sin(angle), cs = Math.cos(angle);
        const x = span * r * sn * (kind === "eagle" ? .83 + .17 * Math.abs(sn) : 1);
        // Eagle wings sweep backward, mantas have broad chevrons; stingrays are round.
        const z = length * r * cs - (kind === "eagle" ? .29 : kind === "manta" ? .13 : .02) * r * Math.abs(sn);
        const y = side > 0 ? .025 + .14 * (1-r*r) : -.025 - .06 * (1-r*r);
        points.push(x,y,z);
        const spotted = kind === "eagle" && side > 0 && r > .27 &&
          Math.sin(x*23+z*7)*Math.sin(z*29-x*2) > .56;
        const color = side < 0 ? under : spotted ? spots : top;
        colors.push(color.r,color.g,color.b);
      }
    }
    for (let ring = 0; ring < rings; ring++) {
      for (let j = 0; j < segments; j++) {
        const a = base + ring * segments + j;
        const b = base + ring * segments + (j+1) % segments;
        const c = a + segments, d = b + segments;
        if (side > 0) faces.push(a,c,b,b,c,d);
        else faces.push(a,b,c,b,d,c);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.Float32BufferAttribute(points,3));
  geo.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
  geo.setIndex(faces);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

export function createRayPassage(lagoonRoot: THREE.Group) {
  const root = new THREE.Group();
  root.name = "eagle-ray-cleaning-passage";
  lagoonRoot.add(root);
  const source = {
    eagle: createDisc("eagle"),
    manta: createDisc("manta"),
    stingray: createDisc("stingray"),
  } as const;
  const rayMat = new THREE.MeshStandardMaterial({
    vertexColors: true, side: THREE.DoubleSide,
    roughness: .82, metalness: .03,
  });
  const tailMat = new THREE.MeshStandardMaterial({color:"#677474",roughness:.92});
  const tailGeo = new THREE.CylinderGeometry(.012,.028,1,6);
  const hornGeo = new THREE.SphereGeometry(1,8,6);
  const rays = RAY_PASSAGE_CAST.map(spec => {
    const group = new THREE.Group();
    group.name = spec.id;
    const geometry = source[spec.kind].clone();
    const body = new THREE.Mesh(geometry,rayMat);
    body.castShadow = false;
    group.add(body);
    const tail = new THREE.Mesh(tailGeo,tailMat);
    tail.rotation.x = Math.PI / 2;
    const len = spec.kind === "manta" ? .85 : spec.kind === "eagle" ? 2.2 : 2.45;
    tail.scale.set(1,len,1);
    tail.position.z = -1.08-len*.48;
    tail.castShadow = false;
    group.add(tail);
    if (spec.kind === "manta") {
      for (const side of [-1,1]) {
        const horn = new THREE.Mesh(hornGeo,tailMat);
        horn.position.set(side*.36, .03, 1.1);
        horn.scale.set(.14,.095,.39);
        horn.rotation.y = side*.3;
        group.add(horn);
      }
    }
    root.add(group);
    return {spec,group,body,geometry,base:new Float32Array(geometry.getAttribute("position").array)};
  });


  // One fever is 120 eagle rays, rendered in four flapping cohorts.
  // Each cohort is ONE instanced draw for all bodies in that phase.
  // A fifth instanced draw provides all the narrow trailing tails.
  // This avoids 120 groups, 120 materials, per-individual normal rebuilds
  // and O(N^2) boids while preserving layered movement around swimmers.
  const feverSource=new Float32Array(source.eagle.getAttribute("position").array);
  const feverGeometries=Array.from({length:EAGLE_FEVER_COHORTS},()=>source.eagle.clone());
  const feverBodies=feverGeometries.map((geometry,cohort)=>{
    const count=Math.ceil((EAGLE_FEVER_COUNT-cohort)/EAGLE_FEVER_COHORTS);
    const mesh=new THREE.InstancedMesh(geometry,rayMat,count);
    mesh.name=`eagle-fever-bodies-${cohort}`;
    mesh.castShadow=false;mesh.receiveShadow=false;mesh.frustumCulled=false;
    const tint=new THREE.Color();
    for(let slot=0;slot<count;slot++){
      const index=slot*EAGLE_FEVER_COHORTS+cohort;
      tint.setRGB(0.80+(index%7)*.023,0.85+(index%5)*.016,0.90+(index%3)*.025);
      mesh.setColorAt(slot,tint);
    }
    if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    root.add(mesh);
    return mesh;
  });
  const feverTails=new THREE.InstancedMesh(tailGeo,tailMat,EAGLE_FEVER_COUNT);
  feverTails.name="eagle-fever-tails";
  feverTails.castShadow=false;feverTails.receiveShadow=false;
  feverTails.frustumCulled=false;
  root.add(feverTails);
  // Fewer visible bodies on small screens; the underlying fever remains
  // deterministic and desktop retains all 120 members.
  const mobileFever=typeof window!=="undefined" &&
    window.matchMedia("(max-width: 700px)").matches;
  const activeFever=mobileFever?EAGLE_FEVER_MOBILE_COUNT:EAGLE_FEVER_COUNT;
  const tailRotation=new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
  const orientation=new THREE.Quaternion();
  for (let cohort=0;cohort<EAGLE_FEVER_COHORTS;cohort++)
    feverBodies[cohort].count=Math.ceil((activeFever-cohort)/EAGLE_FEVER_COHORTS);
  feverTails.count=activeFever;

  const rockGeo = new THREE.IcosahedronGeometry(1,1);
  const rocksMat = new THREE.MeshStandardMaterial({color:"#75857b",roughness:.97});
  const rocks = new THREE.InstancedMesh(rockGeo,rocksMat,24);
  rocks.name = "ray-cleaning-pinnacles";
  const fishGeo = createFishGeometry("anchovy","#acd3c7");
  const fishMat = new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:.76,side:THREE.DoubleSide,
  });
  const cleaners = new THREE.InstancedMesh(fishGeo,fishMat,14);
  cleaners.name = "ray-cleaner-wrasses";
  const shrimpGeo = new THREE.SphereGeometry(1,5,4);
  const shrimpMat = new THREE.MeshStandardMaterial({color:"#f4bd9f",roughness:.82});
  const shrimp = new THREE.InstancedMesh(shrimpGeo,shrimpMat,10);
  shrimp.name = "station-cleaner-shrimp";
  for (const mesh of [rocks,cleaners,shrimp]) {
    mesh.castShadow=false;mesh.receiveShadow=false;mesh.frustumCulled=false;
    root.add(mesh);
  }
  const dummy = new THREE.Object3D();
  for (let i=0; i<24; i++) {
    const station=RAY_PASSAGE.stations[Math.floor(i/12)];
    const n=i%12, angle=n*2.399963;
    const radius=.65+Math.sqrt(n/12)*2.05;
    const x=station.x+Math.cos(angle)*radius;
    const z=station.z+Math.sin(angle)*radius;
    const size=.37+(n%5)*.13;
    dummy.position.set(x,seaFloorHeight(x,z)+size*.42,z);
    dummy.rotation.set(.1*n,angle,.03*n);
    dummy.scale.set(size,size*(.9+n%3*.13),size*.9);
    dummy.updateMatrix(); rocks.setMatrixAt(i,dummy.matrix);
  }
  rocks.instanceMatrix.needsUpdate=true;
  let last=-Infinity;
  function update(seconds:number,reducedMotion=false,observer?:{x:number;y:number;z:number}) {
    if (!lagoonRoot.visible || !root.visible) return;
    if (seconds-last < 1/15) return;
    last=seconds;
    const t=reducedMotion?0:seconds;

    // Animated school: one matrix write per visible body and tail.
    // Four shared wing buffers ripple independently instead of cloning
    // and recomputing 120 wing geometries.
    for(let cohort=0;cohort<EAGLE_FEVER_COHORTS;cohort++){
      const geometry=feverGeometries[cohort];
      const positions=geometry.getAttribute("position") as THREE.BufferAttribute;
      const flap=Math.sin(t*1.22+cohort*Math.PI/2);
      for(let v=0;v<positions.count;v++){
        const x=feverSource[v*3];
        positions.setY(v,feverSource[v*3+1]+
          Math.pow(Math.min(1,Math.abs(x)/1.64),1.6)*flap*.19);
      }
      positions.needsUpdate=true;
      geometry.computeVertexNormals();
      const mesh=feverBodies[cohort];
      for(let slot=0;slot<mesh.count;slot++){
        const index=slot*EAGLE_FEVER_COHORTS+cohort;
        const pose=sampleEagleFever(index,t,seaFloorHeight,SEA_SURFACE,observer);
        dummy.position.set(pose.x,pose.y,pose.z);
        dummy.rotation.set(0,pose.yaw,pose.roll);
        dummy.scale.setScalar(pose.size);
        dummy.updateMatrix();
        mesh.setMatrixAt(slot,dummy.matrix);
        orientation.copy(dummy.quaternion);
        dummy.position.set(
          pose.x-Math.sin(pose.yaw)*1.86*pose.size,
          pose.y,
          pose.z-Math.cos(pose.yaw)*1.86*pose.size,
        );
        dummy.quaternion.copy(orientation).multiply(tailRotation);
        dummy.scale.set(1,2.1*pose.size,1);
        dummy.updateMatrix();
        feverTails.setMatrixAt(index,dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate=true;
    }
    feverTails.instanceMatrix.needsUpdate=true;
    for (const ray of rays) {
      const pose=sampleRayPassage(ray.spec,t,seaFloorHeight,SEA_SURFACE);
      ray.group.visible=pose.visible;
      ray.group.position.set(pose.x,pose.y,pose.z);
      ray.group.rotation.set(0,pose.yaw,pose.bank);
      const positions=ray.geometry.getAttribute("position") as THREE.BufferAttribute;
      const phase=Math.sin(pose.wingPhase);
      const span=ray.spec.kind==="manta"?2.4:ray.spec.kind==="eagle"?1.64:1.24;
      for (let i=0; i<positions.count; i++) {
        const x=ray.base[i*3];
        const flap=Math.pow(Math.min(1,Math.abs(x)/span),1.6)*phase*.19;
        positions.setY(i,ray.base[i*3+1]+flap);
      }
      positions.needsUpdate=true;
      ray.geometry.computeVertexNormals();
    }
    for (let i=0; i<14; i++) {
      const station=RAY_PASSAGE.stations[Math.floor(i/7)];
      const angle=t*.48+i*2.4;
      const radius=.7+.24*(i%3);
      const x=station.x+Math.cos(angle)*radius;
      const z=station.z+Math.sin(angle)*radius;
      dummy.position.set(x,seaFloorHeight(x,z)+1.2+.19*Math.sin(t+i),z);
      dummy.rotation.set(0,-angle,0);
      dummy.scale.set(.19,.19,.19);
      dummy.updateMatrix();cleaners.setMatrixAt(i,dummy.matrix);
    }
    cleaners.instanceMatrix.needsUpdate=true;
    for (let i=0; i<10; i++) {
      const station=RAY_PASSAGE.stations[Math.floor(i/5)];
      const a=i*2.399963+t*.07;
      const x=station.x+Math.cos(a)*(.4+i%3*.16);
      const z=station.z+Math.sin(a)*(.4+i%3*.16);
      dummy.position.set(x,seaFloorHeight(x,z)+.3+.06*Math.sin(t+i),z);
      dummy.scale.set(.075,.035,.11);
      dummy.rotation.set(0,a,0);
      dummy.updateMatrix();shrimp.setMatrixAt(i,dummy.matrix);
    }
    shrimp.instanceMatrix.needsUpdate=true;
  }
  // Construct valid matrices before a reef becomes visible.
  const initiallyVisible=lagoonRoot.visible;
  lagoonRoot.visible=true;
  update(0,true);
  lagoonRoot.visible=initiallyVisible;
  return {
    count:rays.length+EAGLE_FEVER_COUNT,
    feverCount:EAGLE_FEVER_COUNT,
    visibleFeverCount:activeFever,
    feverDrawCalls:EAGLE_FEVER_COHORTS+1,
    update,
    dispose() {
      lagoonRoot.remove(root);
      for (const ray of rays)ray.geometry.dispose();
      for (const g of Object.values(source))g.dispose();
      for (const g of feverGeometries)g.dispose();
      for (const g of [rockGeo,tailGeo,hornGeo,fishGeo,shrimpGeo])g.dispose();
      for (const m of [rayMat,tailMat,rocksMat,fishMat,shrimpMat])m.dispose();
      for(const instance of [rocks,cleaners,shrimp,feverTails,...feverBodies])instance.dispose();
    },
  };
}
