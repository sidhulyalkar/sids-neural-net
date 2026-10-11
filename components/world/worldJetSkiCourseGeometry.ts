import * as THREE from "three/src/Three.Core.js";
import {SEA_SURFACE} from "@/lib/world/model";
import {JET_SKI_ARCHES,JET_SKI_ROCKS,type JetSkiRock} from "@/lib/world/jetSkiCourse";
import {JET_SKI_JUMPS,jetSkiWaterSample} from "@/lib/world/jetSkiWater";

/** Procedurally sculpted sea stacks and fully open arches. Collision is
 * controlled by jetSkiCourse's narrow leg/stack footprints, not arch ceilings.
 * Nothing touches existing reef, snorkel, or land physics geometry. */
export function createJetSkiCoastGeometry(scene:THREE.Scene){
 const root=new THREE.Group();
 root.name="World racing coast arches, sea stacks and volcanic shelves";
 scene.add(root);
 const materials={
  sandstone:new THREE.MeshStandardMaterial({color:"#ae9171",roughness:1,flatShading:true}),
  "sea-stack":new THREE.MeshStandardMaterial({color:"#777d77",roughness:1,flatShading:true}),
  basalt:new THREE.MeshStandardMaterial({color:"#323e41",roughness:.97,flatShading:true}),
 } as const;
 const foam=new THREE.MeshBasicMaterial({color:"#c6eff0",transparent:true,opacity:.65,depthWrite:false,side:THREE.DoubleSide});
 function stackGeometry(rock:JetSkiRock){
  const sides=9,levels=6;
  const positions:number[]=[];
  const indices:number[]=[];
  const seed=rock.point.x*2.17+rock.point.z*.92;
  for(let j=0;j<levels;j++){
   const t=j/(levels-1),taper=1-.4*t+.05*Math.sin(t*11+seed);
   for(let i=0;i<sides;i++){
    const a=i/sides*Math.PI*2;
    const jitter=1+.11*Math.sin(seed+i*4.7+j*1.9);
    const radius=rock.radius*taper*jitter;
    positions.push(Math.cos(a)*radius,
     SEA_SURFACE-1.2+rock.height*t,
     Math.sin(a)*radius);
   }
  }
  for(let j=0;j<levels-1;j++)for(let i=0;i<sides;i++){
   const a=j*sides+i,b=j*sides+(i+1)%sides;
   const c=(j+1)*sides+i,d=(j+1)*sides+(i+1)%sides;
   indices.push(a,b,c,b,d,c);
  }
  for(let i=1;i<sides-1;i++)indices.push((levels-1)*sides,
   (levels-1)*sides+i,(levels-1)*sides+i+1);
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geo.setIndex(indices);geo.computeVertexNormals();
  return geo;
 }
 for(const rock of JET_SKI_ROCKS){
  const mesh=new THREE.Mesh(stackGeometry(rock),materials[rock.kind]);
  mesh.position.set(rock.point.x,0,rock.point.z);
  mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.name=rock.id;root.add(mesh);
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
  // Upper half of an eroded ring. Both feet align with physical rock legs.
  const upper=new THREE.Mesh(new THREE.TorusGeometry(
   arch.span/2,1.9,7,32,Math.PI),mat);
  upper.position.y=4.2;
  upper.castShadow=true;upper.receiveShadow=true;
  group.add(upper);
  // Eroded ledges accent the opening, but never span the water below the arch.
  for(const side of [-1,1]){
   const shoulder=new THREE.Mesh(new THREE.DodecahedronGeometry(2.3,0),mat);
   shoulder.position.set(side*arch.span*.44,4.9,0);
   shoulder.scale.set(1.4,1.5,1.12);
   shoulder.castShadow=true;group.add(shoulder);
  }
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
 return {root,update,dispose,rockCount:JET_SKI_ROCKS.length,archCount:JET_SKI_ARCHES.length};
}
