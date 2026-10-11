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
 // All racers share a light procedural model, preserving the project's
 // no-external-asset world aesthetic. Independent groups allow turning/lean.
 const riderSuit=new THREE.MeshStandardMaterial({color:"#24414c",roughness:.8});
 const helmetMat=new THREE.MeshStandardMaterial({color:"#fff1cf",roughness:.4});
 const buildCraft=(color:string)=>{
  const group=new THREE.Group();root.add(group);
  const hull=new THREE.Mesh(new THREE.CapsuleGeometry(.51,1.4,5,10),
   new THREE.MeshStandardMaterial({color,metalness:.23,roughness:.37}));
  hull.rotation.x=Math.PI/2;group.add(hull);
  make(new THREE.MeshStandardMaterial({color:"#24333c"}),[.75,.4,.65],[0,.42,0],group);
  make(riderSuit,[.48,.6,.37],[0,.96,-.2],group);
  const helmet=new THREE.Mesh(new THREE.SphereGeometry(.26,9,7),helmetMat);
  helmet.position.set(0,1.39,-.16);group.add(helmet);
  make(riderSuit,[1.0,.13,.14],[0,.81,.25],group);
  return {group,hull};
 };
 const playerCraft=buildCraft("#f3c24d");
 const activeSki=playerCraft.group;
 const opponents=[buildCraft("#e96c48").group,buildCraft("#39bdc5").group];
 opponents.forEach(g=>{g.visible=false;});
 activeSki.visible=false;
 const wakeMaterial=new THREE.MeshBasicMaterial({
  color:"#e3ffff",transparent:true,opacity:.58,depthWrite:false,
  side:THREE.DoubleSide,
 });
 const wake=new THREE.Mesh(new THREE.RingGeometry(.7,1.04,24,1,Math.PI*.12,Math.PI*1.76),wakeMaterial);
 wake.rotation.x=-Math.PI/2;
 wake.position.y=SEA_SURFACE+.055;
 wake.visible=false;root.add(wake);
 return {root,skis,buoys,activeSki,activeHull:playerCraft.hull,opponents,wake,start:JET_SKI_START};
}
