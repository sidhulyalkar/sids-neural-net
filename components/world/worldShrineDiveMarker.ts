import * as THREE from "three/src/Three.Core.js";
import { GeometryBatch } from "./worldGeometry";
import { seaFloorHeight } from "@/lib/world/model";
import { SHRINE_DIVE_MARKER } from "@/lib/world/shrineCoralWayfinding";

/** The four letters are small vector-carved strokes, not a texture or
 * downloaded font. They stay legible from either desktop or mobile underwater
 * and do not depend on a network asset loading successfully.
 */
const GLYPHS={
  D:[[[.10,0],[.10,1],[.60,1],[.85,.80],[.85,.20],[.60,0],[.10,0]]],
  I:[[[.13,1],[.85,1]],[[.49,1],[.49,0]],[[.13,0],[.85,0]]],
  V:[[[.08,1],[.49,0],[.90,1]]],
  E:[[[.83,1],[.10,1],[.10,0],[.83,0]],[[.10,.50],[.73,.50]]],
} as const;

const DOWNWARD_CUE=[
  [[0,-.24],[0,-.69]],
  [[-.25,-.49],[0,-.73],[.25,-.49]],
] as const;

/** A gently leaned, weathered, coral-inlaid stone marker near the final reef
 * arrow. It asks visitors to dive deeper, without an intrusive overlay.
 * Two static batched meshes, zero new colliders, no bloom or per-frame work.
 */
export function createShrineDiveMarker(parent:THREE.Group){
  const marker=SHRINE_DIVE_MARKER;
  const root=new THREE.Group();
  root.name="shrine-dive-depth-cue";
  root.position.set(marker.point.x,
    seaFloorHeight(marker.point.x,marker.point.z)+
      marker.baseAboveSeabed+marker.height/2,
    marker.point.z);
  root.rotation.order="YXZ";
  root.rotation.y=Math.atan2(marker.facing.x,marker.facing.z);
  root.rotation.x=marker.leanRadians;
  root.userData.word=marker.text;
  root.userData.target="wooden-shrine-descent";
  parent.add(root);

  const rounded=new THREE.Shape();
  const w=marker.width/2,h=marker.height/2,c=.16;
  rounded.moveTo(-w+c,-h);
  rounded.lineTo(w-c,-h);
  rounded.quadraticCurveTo(w,-h,w,-h+c);
  rounded.lineTo(w,h-c);
  rounded.quadraticCurveTo(w,h,w-c,h);
  rounded.lineTo(-w+c,h);
  rounded.quadraticCurveTo(-w,h,-w,h-c);
  rounded.lineTo(-w,-h+c);
  rounded.quadraticCurveTo(-w,-h,-w+c,-h);
  const panelGeo=new THREE.ExtrudeGeometry(rounded,{
    depth:.15,steps:1,bevelEnabled:true,bevelSize:.055,
    bevelThickness:.038,bevelSegments:1,curveSegments:3,
  });
  panelGeo.translate(0,0,-.075);
  const boxGeo=new THREE.BoxGeometry(1,1,1);
  const rodGeo=new THREE.CylinderGeometry(.79,.84,1,7,1);
  const beadGeo=new THREE.IcosahedronGeometry(1,0);
  const geometries=[panelGeo,boxGeo,rodGeo,beadGeo];

  const stoneBatch=new GeometryBatch();
  const coralBatch=new GeometryBatch();
  const pos=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
  const dims=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
  const zero=new THREE.Euler();
  stoneBatch.add(panelGeo,"#53594f",pos(0,0,0),dims(1,1,1),zero);
  // Slightly recessed dark face gives the branches real contrast.
  stoneBatch.add(boxGeo,"#35453f",pos(0,0,.095),
    dims(marker.width-.25,marker.height-.24,.03),zero);
  for(const x of [-1.10,1.10]){
    stoneBatch.add(boxGeo,"#66645a",pos(x,-.97,-.15),
      dims(.28,.57,.27),zero);
  }
  // Antique shell inlay mirrors the discreet coral arrow trail.
  for(const x of [-1,1]){
    stoneBatch.add(boxGeo,"#bd9b79",pos(x*(w-.13),0,.126),
      dims(.032,marker.height-.24,.042),zero);
  }

  let segmentCount=0;
  const vertical=new THREE.Vector3(0,1,0);
  const carve=(strokes:readonly (readonly (readonly number[])[])[],
    originX:number,sizeX:number,originY:number,sizeY:number,color:string)=>{
    for(const path of strokes){
      for(let i=1;i<path.length;i++){
        const a=pos(originX+path[i-1][0]*sizeX,
          originY+path[i-1][1]*sizeY,.19);
        const b=pos(originX+path[i][0]*sizeX,
          originY+path[i][1]*sizeY,.19);
        const delta=b.clone().sub(a),length=delta.length();
        if(length<1e-6)continue;
        const quaternion=new THREE.Quaternion().setFromUnitVectors(
          vertical,delta.normalize());
        coralBatch.add(rodGeo,color,a.clone().add(b).multiplyScalar(.5),
          dims(.066,length,.066),new THREE.Euler().setFromQuaternion(quaternion));
        segmentCount++;
      }
    }
  };
  for(const [index,letter] of (["D","I","V","E"] as const).entries()){
    carve(GLYPHS[letter],-1.37+index*.76,.65,-.05,.68,
      index%2?"#eed0a6":"#e2b58c");
  }
  carve(DOWNWARD_CUE,0,1,0,1,"#e8a381");
  // A few tiny polyp tips create a living reef finish without obscuring glyphs.
  for(let i=0;i<8;i++){
    const x=-1.40+i*.38;
    coralBatch.add(beadGeo,i%2?"#d99b82":"#e7c9a2",
      pos(x,.73,.21),dims(.038,.048,.035),zero);
  }

  const stoneMaterial=new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:.95,metalness:0,side:THREE.DoubleSide,
  });
  const coralMaterial=new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:.76,metalness:0,
    emissive:"#553323",emissiveIntensity:.10,side:THREE.DoubleSide,
  });
  const meshes=[
    new THREE.Mesh(stoneBatch.finish(),stoneMaterial),
    new THREE.Mesh(coralBatch.finish(),coralMaterial),
  ];
  meshes[0].name="dive-marker-weathered-stone";
  meshes[1].name="dive-marker-coral-word-and-down-arrow";
  for(const mesh of meshes){
    mesh.castShadow=false;
    mesh.receiveShadow=true;
    root.add(mesh);
  }
  return {
    root,text:marker.text,segmentCount,
    dispose(){
      root.removeFromParent();
      for(const mesh of meshes)mesh.geometry.dispose();
      for(const mat of [stoneMaterial,coralMaterial])mat.dispose();
      for(const geo of geometries)geo.dispose();
    },
  };
}
