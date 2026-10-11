import * as THREE from "three/src/Three.Core.js";
import {JET_SKI_DOCK,JET_SKI_GATES,JET_SKI_START} from "@/lib/world/jetSkiRace";
import {SEA_SURFACE} from "@/lib/world/model";
/** Lightweight dock and race markings, entirely independent of marine ecology. */
export function createJetSkiDock(scene:THREE.Scene){
 const root=new THREE.Group();scene.add(root);
 const wood=new THREE.MeshStandardMaterial({color:"#876a48",roughness:.88});
 const hullColors=["#f3c24d","#e96c48","#39bdc5"];
 const make=(material:THREE.Material,size:[number,number,number],position:[number,number,number],parent:THREE.Object3D=root)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);
  mesh.position.set(...position);parent.add(mesh);return mesh;
 };
 for(let i=0;i<7;i++){
  make(wood,[1.25,.22,5.5],[57.6+i*1.1,SEA_SURFACE+.8,JET_SKI_DOCK.z]);
 }
 for(const z of [JET_SKI_DOCK.z-2.2,JET_SKI_DOCK.z+2.2]){
  for(const x of [58,61,64])make(wood,[.23,2.9,.23],[x,SEA_SURFACE-.45,z]);
 }
 const skis:THREE.Group[]=[];
 hullColors.forEach((color,i)=>{
  const ski=new THREE.Group();root.add(ski);
  ski.position.set(67+i*1.9,SEA_SURFACE+.17,JET_SKI_DOCK.z-2.4+i*2.25);
  const hull=new THREE.Mesh(new THREE.CapsuleGeometry(.48,1.55,4,8),
   new THREE.MeshStandardMaterial({color,metalness:.18,roughness:.38}));
  hull.rotation.x=Math.PI/2;ski.add(hull);
  make(new THREE.MeshStandardMaterial({color:"#222c30"}),[.65,.35,.7],[0,.45,.05],ski);
  make(new THREE.MeshStandardMaterial({color:"#263e49"}),[1,.1,.13],[0,.72,.2],ski);
  skis.push(ski);
 });
 const buoyMaterial=new THREE.MeshStandardMaterial({color:"#fa9b3f",emissive:"#ab3e10",emissiveIntensity:.25});
 const buoyGeo=new THREE.SphereGeometry(.42,9,6);
 const buoys=JET_SKI_GATES.map(g=>{
  const marker=new THREE.Mesh(buoyGeo,buoyMaterial);
  marker.position.set(g.x,SEA_SURFACE+.55,g.z);
  marker.visible=false;root.add(marker);return marker;
 });
 const activeSki=new THREE.Group();root.add(activeSki);
 const craft=new THREE.Mesh(new THREE.CapsuleGeometry(.51,1.4,5,10),
  new THREE.MeshStandardMaterial({color:"#f3c24d",metalness:.23,roughness:.37}));
 craft.rotation.x=Math.PI/2;activeSki.add(craft);
 make(new THREE.MeshStandardMaterial({color:"#24333c"}),[.75,.4,.65],[0,.42,0],activeSki);
 activeSki.visible=false;
 return {root,skis,buoys,activeSki,start:JET_SKI_START};
}
