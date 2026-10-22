import * as THREE from "three/src/Three.Core.js";
import {SEA_SURFACE} from "@/lib/world/model";
import {JET_SKI_ARCHES,JET_SKI_ROCKS,isJetSkiArchSupport} from "@/lib/world/jetSkiCourse";
import {createSeaArchGeometry,createSeaStackGeometry} from "./worldCoastalRockGeometry";
import {JET_SKI_JUMPS,jetSkiWaterSample} from "@/lib/world/jetSkiWater";

/** Procedurally sculpted sea stacks and fully open arches. Collision is
 * controlled by jetSkiCourse's narrow leg/stack footprints, not arch ceilings.
 * Nothing touches existing reef, snorkel, or land physics geometry. */
export function createJetSkiCoastGeometry(scene:THREE.Scene){
 const root=new THREE.Group();
 root.name="World racing coast arches, sea stacks and volcanic shelves";
 scene.add(root);
 const materials={
  sandstone:new THREE.MeshStandardMaterial({color:"#ffffff",vertexColors:true,roughness:1,flatShading:true}),
  "sea-stack":new THREE.MeshStandardMaterial({color:"#ffffff",vertexColors:true,roughness:1,flatShading:true}),
  basalt:new THREE.MeshStandardMaterial({color:"#ffffff",vertexColors:true,roughness:.97,flatShading:true}),
 } as const;
 const foam=new THREE.MeshBasicMaterial({color:"#c6eff0",transparent:true,opacity:.65,depthWrite:false,side:THREE.DoubleSide});
 for(const rock of JET_SKI_ROCKS){
  // The arch mesh now contains its own two feet and crown. Retaining the
  // former full-height stack meshes produced overlapping, hanging curtains
  // across the opening. Keep their collision circles and water foam intact.
  if(!isJetSkiArchSupport(rock)){
   const mesh=new THREE.Mesh(createSeaStackGeometry(rock),materials[rock.kind]);
   mesh.position.set(rock.point.x,0,rock.point.z);
   mesh.castShadow=true;mesh.receiveShadow=true;
   mesh.name=rock.id;root.add(mesh);
  }
  const ring=new THREE.Mesh(new THREE.RingGeometry(rock.radius+.3,
   rock.radius+1.05,16),foam);
  ring.rotation.x=-Math.PI/2;
  ring.position.set(rock.point.x,SEA_SURFACE+.045,rock.point.z);
  root.add(ring);
 }
 for(const arch of JET_SKI_ARCHES){
  const group=new THREE.Group();
  group.name=arch.id;
  group.position.set(arch.center.x,SEA_SURFACE,arch.center.z);
  group.rotation.y=arch.heading;
  const mat=materials[arch.kind];
  const bridge=new THREE.Mesh(createSeaArchGeometry(arch),mat);
  bridge.name=arch.id+"-continuous-sea-arch";
  bridge.castShadow=true;
  bridge.receiveShadow=true;
  group.add(bridge);
  // Both bridge ends physically overlap their collision-authoritative legs.
  // The center channel has neither a hidden mesh nor an invisible collider.
  root.add(group);
 }
 const jumpMat=new THREE.MeshBasicMaterial({
  color:"#b8edfa",transparent:true,opacity:.5,side:THREE.DoubleSide,depthWrite:false,
 });
 const crests=JET_SKI_JUMPS.map(jump=>{
  const ring=new THREE.Mesh(new THREE.TorusGeometry(3.1,.13,4,20,Math.PI*1.5),jumpMat);
  ring.rotation.x=-Math.PI/2;
  ring.position.set(jump.point.x,SEA_SURFACE+.08,jump.point.z);
  ring.name=jump.id;root.add(ring);
  return ring;
 });
 const waveMat=new THREE.MeshStandardMaterial({
  color:"#86cbd5",transparent:true,opacity:.46,
  roughness:.42,metalness:.08,side:THREE.DoubleSide,depthWrite:false,
 });
 // Small animated waterfield patches at two jumps and at the western stacks.
 // Rebuild vertex height from the SAME wave sampler as the craft.
 const patches=[
  {x:27,z:87.5,size:28},{x:-5,z:-127,size:34},{x:-61,z:-25,size:32},
 ].map(p=>{
  const geometry=new THREE.PlaneGeometry(p.size,p.size,16,16);
  geometry.rotateX(-Math.PI/2);
  const obj=new THREE.Mesh(geometry,waveMat);
  obj.position.set(p.x,SEA_SURFACE+.095,p.z);
  obj.frustumCulled=false;root.add(obj);
  return obj;
 });
 function update(time:number,racing:boolean){
  crests.forEach((crest,i)=>{
   crest.visible=racing;
   crest.position.y=SEA_SURFACE+.09+
    jetSkiWaterSample(JET_SKI_JUMPS[i].point,time).height;
   crest.scale.setScalar(1+.07*Math.sin(time*2+i));
  });
  patches.forEach(mesh=>{
   mesh.visible=racing;
   if(!racing)return;
   const position=mesh.geometry.attributes.position;
   for(let i=0;i<position.count;i++){
    const x=mesh.position.x+position.getX(i);
    const z=mesh.position.z+position.getZ(i);
    position.setY(i,jetSkiWaterSample({x,z},time).height);
   }
   position.needsUpdate=true;
   mesh.geometry.computeVertexNormals();
  });
 }
 function dispose(){
  root.traverse(child=>{
   if(!(child instanceof THREE.Mesh))return;
   child.geometry.dispose();
  });
  [...Object.values(materials),foam,jumpMat,waveMat].forEach(m=>m.dispose());
  scene.remove(root);
 }
 return {root,update,dispose,rockCount:JET_SKI_ROCKS.length,
  visibleStackCount:JET_SKI_ROCKS.filter(rock=>!isJetSkiArchSupport(rock)).length,
  archCount:JET_SKI_ARCHES.length};
}
