import * as THREE from "three/src/Three.Core.js";
import { GeometryBatch } from "./worldGeometry";
import {
  SHRINE_CORAL_GUIDES, coralColonyPositions,
  SHRINE_CORAL_WAYFINDING,
} from "@/lib/world/shrineCoralWayfinding";

/** Quiet underwater directional art, grown out of clustered coral colonies.
 * The arrow shapes are only legible from above and at swimming distance.
 * Two merged GPU batches, no animation loop, no collisions or extra lights.
 */
export function createShrineCoralWayfinding(reefRoot:THREE.Group){
  const root=new THREE.Group();
  root.name="shrine-coral-arrow-trail";
  root.visible=true;
  reefRoot.add(root);

  const rockGeo=new THREE.IcosahedronGeometry(1,1);
  const polypGeo=new THREE.IcosahedronGeometry(1,1);
  const stemGeo=new THREE.CylinderGeometry(.82,1,1,6,1);
  const crownGeo=new THREE.IcosahedronGeometry(1,0);
  const sourceGeometry=[rockGeo,polypGeo,stemGeo,crownGeo];
  const reefBatch=new GeometryBatch();
  const coralBatch=new GeometryBatch();
  const palette=[
    "#d47d72", // living salmon coral
    "#e9a778", // warm gold/orange heads
    "#be718a", // muted rose
    "#e1bc9a", // pale cream tips
    "#b97d78", // weathered pink branches
  ];
  const point=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
  const size=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
  const zero=new THREE.Euler();
  const shaft=new THREE.Vector3(0,1,0);
  let colonyCount=0;
  let branchCount=0;

  for(const [stage,guide] of SHRINE_CORAL_GUIDES.entries()){
    const colonies=coralColonyPositions(guide);
    for(const colony of colonies){
      const {x,z}=colony.point;
      const floor=colony.seabedY;
      const radius=colony.radius;
      const n=colony.index;
      const baseColor=palette[(stage+n*2)%palette.length];
      const tipColor=palette[(stage+n*2+3)%palette.length];
      // Small irregular substrate footprint, not a floating sand decal.
      reefBatch.add(rockGeo,stage%2?"#68736c":"#697773",
        point(x,floor+.078,z),size(radius*1.10,.15,radius*1.04),zero);
      coralBatch.add(polypGeo,baseColor,
        point(x,floor+.19+radius*.19,z),
        size(radius*.92,radius*.73,radius*.94),zero);
      // A small bush of bifurcating branches makes each dot read as living
      // coral rather than a flat painted waypoint.
      const count=2+(n+stage)%2;
      for(let b=0;b<count;b++){
        const angle=(b/count)*Math.PI*2+n*.67+stage*.26;
        const length=(.23+.075*((n+b+stage)%3))*guide.size;
        const dx=Math.cos(angle),dz=Math.sin(angle);
        const start=point(
          x+dx*radius*.22,
          floor+.23+radius*.22,
          z+dz*radius*.22,
        );
        const end=point(
          x+dx*radius*.58,
          Math.min(floor+SHRINE_CORAL_WAYFINDING.maxCoralHeight,
            start.y+length),
          z+dz*radius*.58,
        );
        const delta=end.clone().sub(start);
        const len=delta.length();
        const rotation=new THREE.Euler().setFromQuaternion(
          new THREE.Quaternion().setFromUnitVectors(shaft,delta.normalize()));
        coralBatch.add(stemGeo,baseColor,start.add(end).multiplyScalar(.5),
          size(.056*guide.size,len,.056*guide.size),rotation);
        coralBatch.add(crownGeo,tipColor,end,
          size(.098*guide.size,.095*guide.size,.094*guide.size),zero);
        branchCount++;
      }
      colonyCount++;
    }
  }

  const materialRock=new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:.98,metalness:0,side:THREE.DoubleSide,
  });
  const materialCoral=new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:.88,metalness:0,side:THREE.DoubleSide,
  });
  const batches=[
    new THREE.Mesh(reefBatch.finish(),materialRock),
    new THREE.Mesh(coralBatch.finish(),materialCoral),
  ];
  batches[0].name="shrine-arrow-rock-footprints";
  batches[1].name="shrine-arrow-living-coral";
  for(const mesh of batches){
    mesh.castShadow=false;
    mesh.receiveShadow=true;
    root.add(mesh);
  }

  return {
    root,
    count:SHRINE_CORAL_GUIDES.length,
    colonyCount,
    branchCount,
    dispose(){
      root.removeFromParent();
      for(const mesh of batches)mesh.geometry.dispose();
      for(const material of [materialRock,materialCoral])material.dispose();
      for(const geometry of sourceGeometry)geometry.dispose();
    },
  };
}
