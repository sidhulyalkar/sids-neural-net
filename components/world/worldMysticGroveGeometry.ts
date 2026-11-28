import * as THREE from "three/src/Three.Core.js";
import {GeometryBatch} from "./worldGeometry";
import {MYSTIC_GROVE,MYSTIC_TREES,mysticGroveDistance} from "@/lib/world/mysticGrove";
import {isWater,type Point} from "@/lib/world/model";
import {sportClearance} from "@/lib/world/activities";
import {skimBeachClearance} from "@/lib/world/skimboarding";
import {discGolfOpeningClearance,discGolfCourseClearance} from "@/lib/world/discGolf";

/**
 * A coast-redwood-inspired "living circuit": six rooted trees carry the existing
 * neural dendrites and inter-branch lightning. Broken granite, bark, moss,
 * fern fronds and tiny teal fungi tell the story without a glowing floor slab.
 *
 * Static, non-colliding scenery only. One batched mesh per material; no
 * per-instance mesh allocation, postprocessing, new lights or texture fetches.
 * Supports the exact same world terrain, leaving the central discovery clearing
 * and every sporting route unobstructed.
 */
export function createWorldMysticGroveGeometry(
 scene:THREE.Scene,
 support:(p:Point)=>number,
 tips:readonly (readonly THREE.Vector3[])[],
){
 const root=new THREE.Group();
 root.name="Mystic Grove · living circuitry";
 const bark=new GeometryBatch(),understory=new GeometryBatch(),luminous=new GeometryBatch();
 const sources:THREE.BufferGeometry[]=[
  new THREE.CylinderGeometry(.76,1,1,7),
  new THREE.IcosahedronGeometry(1,0),
  new THREE.ConeGeometry(1,1,5),
  new THREE.SphereGeometry(1,7,5),
 ];
 const [wood,stone,leaf,cap]=sources;
 const up=new THREE.Vector3(0,1,0);
 const origin=new THREE.Vector3();
 const scale=new THREE.Vector3();
 const rotation=new THREE.Euler();
 const axis=new THREE.Vector3();
 const q=new THREE.Quaternion();
 const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
 const add=(batch:GeometryBatch,g:THREE.BufferGeometry,color:string,
  p:THREE.Vector3,sx:number,sy:number,sz:number,ry=0,rx=0,rz=0)=>{
  batch.add(g,color,p,new THREE.Vector3(sx,sy,sz),
   new THREE.Euler(rx,ry,rz));
 };
 const beam=(batch:GeometryBatch,color:string,
  a:THREE.Vector3,b:THREE.Vector3,r:number)=>{
  axis.subVectors(b,a);
  const len=axis.length();
  if(len<.001)return;
  origin.copy(a).add(b).multiplyScalar(.5);
  scale.set(r,len,r);
  q.setFromUnitVectors(up,axis.multiplyScalar(1/len));
  rotation.setFromQuaternion(q);
  batch.add(wood,color,origin,scale,rotation);
 };
 const clear=(p:Point)=>
  !isWater(p)&&!skimBeachClearance(p)&&!sportClearance(p)&&
  !discGolfOpeningClearance(p,1)&&!discGolfCourseClearance(p,1);
 let roots=0,fronds=0,stones=0,spores=0,canopy=0;

 // Buttressed, weathered coastal trees with angular lichen-lined cambium.
 // Their silhouettes join, not replace, the existing high dendrite geometry.
 for(const [i,site] of MYSTIC_TREES.entries()){
  const y=support(site);
  const base=V(site.x,y+.06,site.z);
  const middle=V(site.x+.12*Math.sin(i*1.9),y+1.65,site.z+.10*Math.cos(i*1.2));
  const crown=V(site.x+.17*Math.sin(i*1.9),y+3.35,site.z+.15*Math.cos(i*1.2));
  beam(bark,i%2?"#365c59":"#385450",base,middle,.48);
  beam(bark,"#466e64",middle,crown,.29);
  beam(bark,"#779385",V(site.x+.05,y+.40,site.z+.02),
   V(middle.x+.08,y+2.34,middle.z+.07),.045);
  for(let j=0;j<5;j++){
   const a=i*.39+j*Math.PI*2/5;
   const x=site.x+Math.cos(a)*1.22,z=site.z+Math.sin(a)*1.22;
   const p={x,z};
   if(!clear(p))continue;
   beam(bark,"#425951",V(site.x,y+.94,site.z),
    V(x,support(p)+.09,z),.15);
   // Moss hugs root fans, not a floating carpet.
   add(understory,stone,j%2?"#4d7261":"#667c64",
    V(x,support(p)+.07,z),.38,.11,.24,a);
   roots++;
  }
  // Tiered open coastal crowns, readable while approaching from the
  // shoreline. Swept evergreen sprays frame rather than obscure the actual
  // electrical branch endpoints; the silhouette varies by tree and tip.
  for(const [j,tip] of (tips[i]??[]).entries()){
   const theta=i*1.35+j*2.399;
   const reach=.36+(j%3)*.09;
   const intermediate=V(
    crown.x+(tip.x-crown.x)*.62,
    crown.y+(tip.y-crown.y)*.62-.19,
    crown.z+(tip.z-crown.z)*.62);
   if(j%2===0){
    // Slim charcoal-larch wood inside the foliage, no fabricated collider.
    beam(bark,i%2?"#375c52":"#426963",
     V(crown.x,crown.y-.12,crown.z),intermediate,.085);
   }
   for(let layer=0;layer<3;layer++){
    const w=.46+.12*(2-layer),h=.65+.10*(layer%2);
    const across=.24+layer*.20;
    const p=V(intermediate.x+Math.cos(theta+layer*.8)*across,
     intermediate.y+layer*.33-.18,
     intermediate.z+Math.sin(theta+layer*.8)*across);
    add(understory,leaf,(layer+j)%3===0?"#64897e":
     layer%2?"#47736d":"#89a598",
     p,w,h,.36,theta+layer*.55,
     .12*Math.sin(theta+layer),-.18*Math.cos(theta));
    canopy++;
   }
   for(let k=0;k<3;k++){
    const a=theta+k*Math.PI*2/3;
    const endpoint=V(tip.x+Math.cos(a)*reach,
     tip.y-.18+(k%2)*.28,tip.z+Math.sin(a)*reach);
    beam(understory,k===0?"#638e80":k===1?"#47766f":"#7ba290",
     V(tip.x,tip.y-.25,tip.z),endpoint,.055);
   }
   // Small sculpted foliage clusters preserve the bright tip anchor.
   add(understory,leaf,j%3===0?"#4a786f":j%3===1?"#74948a":"#3c6864",
    V(tip.x,tip.y-.36,tip.z),.27,.43,.27,
    theta,.16*Math.sin(theta));
   canopy++;
  }
  // Slope-following ferns/mushrooms establish a forest-floor microhabitat.
  for(let j=0;j<7;j++){
   const angle=i*1.17+j*2.3999632;
   const dist=1.9+(j%3)*.45;
   const x=site.x+Math.cos(angle)*dist,z=site.z+Math.sin(angle)*dist;
   const p={x,z};
   if(!clear(p)||mysticGroveDistance(p)<2.7)continue;
   const py=support(p);
   const fernHeight=.39+(j%3)*.12;
   for(let k=0;k<5;k++){
    const a=angle+k*Math.PI*2/5;
    add(understory,leaf,k%2?"#436e5c":"#729178",
     V(x+Math.cos(a)*.19,py+fernHeight*.47,
       z+Math.sin(a)*.19),.105,fernHeight,.22,a,
     .33*Math.sin(a),-.35*Math.cos(a));
    fronds++;
   }
   if(j%2===0){
    beam(understory,"#837f6c",V(x,py+.03,z),V(x,py+.24,z),.046);
    add(luminous,cap,i%2?"#a2ead1":"#d5f5b0",
     V(x,py+.24,z),.25,.12,.25);
    spores++;
   }
  }
 }

 // An incomplete ring of *small* embedded granite shards. No walk-blocking
 // pedestal or flat, bright disk under the player's navigation marker.
 for(let i=0;i<26;i++){
  const angle=i*Math.PI*2/26;
  const radius=3.05+.15*Math.sin(i*2.8);
  const x=MYSTIC_GROVE.center.x+Math.cos(angle)*radius;
  const z=MYSTIC_GROVE.center.z+Math.sin(angle)*radius;
  const p={x,z};
  if(!clear(p)||i%7===0)continue;
  const y=support(p);
  add(understory,stone,i%3===0?"#7c938d":i%3===1?"#909c8e":"#777f7e",
   V(x,y+.055,z),.24,.11,.38,angle+.45);
  if(i%5===0){
   // Tiny rune inlay rather than a glowing UI or a blinding ritual circle.
   beam(luminous,"#a2ebce",V(x-.11,y+.145,z),
    V(x+.09,y+.149,z+.07),.017);
  }
  stones++;
 }

 // Spark-like quartz growths, close to the trees, never on the walking hub.
 for(const [i,site] of MYSTIC_TREES.entries()){
  for(let j=0;j<3;j++){
   const a=i*1.7+j*2.4;
   const r=1.45+(j%2)*.25;
   const x=site.x+Math.cos(a)*r,z=site.z+Math.sin(a)*r,p={x,z};
   if(!clear(p)||mysticGroveDistance(p)<2.65)continue;
   const y=support(p);
   add(luminous,stone,j%2?"#6bbaae":"#a0dfc6",
    V(x,y+.19,z),.12,.29,.13,a,.14);
   spores++;
  }
 }

 const mats:THREE.MeshStandardMaterial[]=[];
 const geometries:THREE.BufferGeometry[]=[];
 const render=(batch:GeometryBatch,name:string,
  material:THREE.MeshStandardMaterial)=>{
  const g=batch.finish();
  geometries.push(g);mats.push(material);
  const mesh=new THREE.Mesh(g,material);
  mesh.name=name;
  mesh.castShadow=false;mesh.receiveShadow=true;
  root.add(mesh);
 };
 render(bark,"mystic-rooted-bark",new THREE.MeshStandardMaterial({
  vertexColors:true,roughness:.98,flatShading:true,side:THREE.DoubleSide,
 }));
 render(understory,"mystic-fern-moss-and-granite",new THREE.MeshStandardMaterial({
  vertexColors:true,roughness:.95,flatShading:true,side:THREE.DoubleSide,
 }));
 render(luminous,"mystic-quartz-and-biological-glow",new THREE.MeshStandardMaterial({
  vertexColors:true,roughness:.63,metalness:.07,side:THREE.DoubleSide,
  emissive:"#3d8174",emissiveIntensity:.22,
 }));
 sources.forEach(g=>g.dispose());
 scene.add(root);
 return {
  root,
  diagnostics:{trees:MYSTIC_TREES.length,roots,fronds,stones,spores,
   canopy,drawCalls:root.children.length,
   triangles:geometries.reduce((n,g)=>
    n+g.getAttribute("position").count/3,0)},
  dispose(){
   scene.remove(root);
   geometries.forEach(g=>g.dispose());
   mats.forEach(m=>m.dispose());
  },
 };
}
