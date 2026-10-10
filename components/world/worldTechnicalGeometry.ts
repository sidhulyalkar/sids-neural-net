import * as THREE from "three/src/Three.Core.js";
import { GeometryBatch } from "./worldGeometry";
import { terrainHeight } from "@/lib/world/model";
import {
  BALANCE_BEAMS, ROCK_GARDENS, beamRiseAt, rockGardenStones,
} from "@/lib/world/technicalFeatures";

/** One batched mesh, 3 quiet rock patches and 3 beam traversals.
 * The deck geometry samples the same analytic beam support as the rider. */
export function createTechnicalGeometry(scene:THREE.Scene) {
  const batch=new GeometryBatch();
  const rock=new THREE.SphereGeometry(1,7,5);
  const box=new THREE.BoxGeometry(1,1,1);
  const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
  for(const garden of ROCK_GARDENS) {
    // Dense localized sampled ground sheet. Main island terrain is only ~1.3m
    // per vertex, too coarse to show a 0.5m rock bump with contact parity.
    // Closed concentric rings provide a smooth natural oval, no square decal.
    const rings=10,steps=48,points:number[]=[];
    const vertex=(r:number,a:number)=>{
      const along=Math.cos(a)*garden.length*.56*r;
      const side=Math.sin(a)*(garden.halfWidth+1.45)*r;
      const x=garden.center.x+garden.heading.x*along+garden.heading.z*side;
      const z=garden.center.z+garden.heading.z*along-garden.heading.x*side;
      return [x,terrainHeight(x,z)+.024,z];
    };
    for(let ring=0;ring<rings;ring++)
      for(let i=0;i<steps;i++){
        const a=i*2*Math.PI/steps,c=(i+1)*2*Math.PI/steps;
        const inside=ring/rings,outside=(ring+1)/rings;
        const v0=vertex(inside,a),v1=vertex(outside,a);
        const v2=vertex(outside,c),v3=vertex(inside,c);
        points.push(...v0,...v1,...v2,...v0,...v2,...v3);
      }
    const sheet=new THREE.BufferGeometry();
    sheet.setAttribute("position",new THREE.Float32BufferAttribute(points,3));
    sheet.computeVertexNormals();
    batch.add(sheet,garden.zone==="desert"?"#aa8968":"#6f7567",
      V(0,0,0),V(1,1,1));
    sheet.dispose();
    for(const [i,stone] of rockGardenStones(garden).entries()){
      const y=terrainHeight(stone.x,stone.z);
      batch.add(rock,garden.zone==="desert"
        ? (i%3===0?"#c9b9a3":"#ac9a85")
        : (i%3===0?"#8f9387":"#6e8179"),
        V(stone.x,y-0.055,stone.z),
        V(stone.rx*.66,stone.height*.85,stone.rz*.69),
      );
    }
  }
  for(const beam of BALANCE_BEAMS) {
    const dx=beam.end.x-beam.start.x,dz=beam.end.z-beam.start.z;
    const length=Math.hypot(dx,dz),segments=Math.ceil(length/.24);
    const rotation=new THREE.Euler(0,Math.atan2(dx,dz),0);
    for(let i=0;i<segments;i++){
      const s=(i+.5)/segments;
      const x=beam.start.x+dx*s,z=beam.start.z+dz*s;
      const p={x,z};
      const deck=terrainHeight(x,z)+(beamRiseAt(beam,p)??0);
      batch.add(box,i%7===0?"#907258":i%4===0?"#aa906e":"#866d54",
        V(x,deck-.085,z),
        V(beam.halfWidth*2,.17,length/segments+.01),rotation);
    }
    // Tiny natural low-contrast end markers, not floaty glowing gates.
    for(const p of [beam.start,beam.end]) {
      batch.add(rock,"#9c9788",
        V(p.x,terrainHeight(p.x,p.z)-.025,p.z),
        V(.20,.08,.20));
    }
  }
  const geometry=batch.finish();
  const material=new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:.94,metalness:0,side:THREE.DoubleSide,
  });
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name="technical-rock-gardens-and-beams";
  mesh.receiveShadow=true;
  scene.add(mesh);
  return {mesh,dispose(){
    scene.remove(mesh);geometry.dispose();material.dispose();
    box.dispose();rock.dispose();
  }};
}
