import * as THREE from "three/src/Three.Core.js";
import {worldFloorHeight} from "@/lib/world/model";
import {MOUNTAIN_HALFPIPE as pipe, mountainHalfpipeInfluence} from "@/lib/world/mountainHalfpipe";

/** Refine the island mesh itself so there is only one visible ski surface. */
export function refineMountainSnow(terrain: THREE.BufferGeometry) {
  const index = terrain.getIndex()!;
  const positions = Array.from(terrain.getAttribute("position").array);
  const colors = Array.from(terrain.getAttribute("color").array);
  const indices: number[] = [];
  const edges = new Map<string, number>();
  const snow = new THREE.Color("#e8f1f4");
  let triangles = 0;
  function middle(a: number, b: number) {
    const key = a < b ? a + "/" + b : b + "/" + a;
    const cached = edges.get(key);
    if (cached !== undefined) return cached;
    const vertex = positions.length / 3;
    const x = (positions[3*a] + positions[3*b])/2;
    const z = (positions[3*a+2] + positions[3*b+2])/2;
    const distance = Math.max(Math.abs(x-pipe.centerX)-pipe.lipHalfWidth-pipe.featherWidth,
      pipe.startZ-z, z-pipe.endZ);
    // The outer row meets the untouched triangles along their straight edges.
    const blend = THREE.MathUtils.clamp(1-distance, 0, 1);
    const y = THREE.MathUtils.lerp((positions[3*a+1]+positions[3*b+1])/2, worldFloorHeight(x,z), blend);
    positions.push(x,y,z);
    for (let k=0;k<3;k++) colors.push((colors[3*a+k]+colors[3*b+k])/2);
    edges.set(key, vertex);
    return vertex;
  }
  function split(a:number,b:number,c:number,depth:number) {
    if (!depth) { indices.push(a,b,c); triangles++; return; }
    const ab=middle(a,b), bc=middle(b,c), ca=middle(c,a);
    split(a,ab,ca,depth-1); split(ab,b,bc,depth-1);
    split(ca,bc,c,depth-1); split(ab,bc,ca,depth-1);
  }
  for(let i=0;i<index.count;i+=3) {
    const a=index.getX(i), b=index.getX(i+1), c=index.getX(i+2);
    const x=(positions[3*a]+positions[3*b]+positions[3*c])/3;
    const z=(positions[3*a+2]+positions[3*b+2]+positions[3*c+2])/3;
    if(Math.abs(x-pipe.centerX)<pipe.lipHalfWidth+pipe.featherWidth+3 &&
       z>pipe.startZ-3 && z<pipe.endZ+3) split(a,b,c,3);
    else indices.push(a,b,c);
  }
  for(let i=0;i<positions.length;i+=3) {
    const x=positions[i], z=positions[i+2], influence=mountainHalfpipeInfluence({x,z});
    if (!influence) continue;
    const wind=1+.012*Math.sin(z*.47+x*.2);
    for (const [k,value] of [snow.r,snow.g,snow.b].entries())
      colors[i+k]=THREE.MathUtils.lerp(colors[i+k],value*wind,influence*.96);
  }
  terrain.deleteAttribute("normal");
  terrain.deleteAttribute("uv"); // Ground uses vertex pigment only.
  terrain.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  terrain.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
  terrain.setIndex(indices);
  terrain.computeVertexNormals();
  return triangles;
}
