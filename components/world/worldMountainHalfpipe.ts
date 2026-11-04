import * as THREE from "three/src/Three.Core.js";
import {terrainHeight} from "@/lib/world/model";
import {biomeAt,BIOME_COLORS} from "@/lib/world/biomes";
import {
  MOUNTAIN_HALFPIPE,mountainHalfpipeInfluence,mountainHalfpipeBank,
} from "@/lib/world/mountainHalfpipe";

/**
 * One skiable snow feature. Vertex positions sample precisely the same
 * heightfield as ski physics. No scene-wide grid, cave, rails, posts, lights
 * or new downloads. Only the snow skin and two restrained coping traces.
 */
export function createWorldMountainHalfpipe(scene:THREE.Scene){
  const h=MOUNTAIN_HALFPIPE;
  const minX=h.centerX-h.lipHalfWidth-h.featherWidth,
    maxX=h.centerX+h.lipHalfWidth+h.featherWidth;
  const nx=84,nz=108;
  const vertices:number[]=[],colors:number[]=[];
  const pale=new THREE.Color("#eaf3f5"),
    lip=new THREE.Color("#d3e7ec"),
    center=new THREE.Color("#f7faf9");
  // The overlay must not look like a pasted-on white rectangle. Its edges
  // resolve toward the *same authored biome pigment* as the base terrain.
  // Cache biome samples so the unindexed triangle mesh never repeats work.
  const palette=Object.fromEntries(Object.entries(BIOME_COLORS)
    .map(([key,value])=>[key,new THREE.Color(value)]));
  const nodeCache=new Map<string,ReturnType<typeof sample>>();
  function sample(x:number,z:number){
    const influence=mountainHalfpipeInfluence({x,z});
    const y=terrainHeight(x,z)+.035+.05*Math.sqrt(influence);
    const base=new THREE.Color(0,0,0);
    const biome=biomeAt({x,z});
    for(const [id,weight] of Object.entries(biome.weights)){
      const pigment=palette[id];
      if(pigment&&weight>0)base.add(pigment.clone().multiplyScalar(weight));
    }
    const normalBank=mountainHalfpipeBank({x,z})/Math.max(.01,h.bankRise);
    const snow=pale.clone().lerp(center,1-normalBank)
      .lerp(lip,normalBank*.48);
    const snowMask=Math.min(1,Math.pow(influence,.68)*.97);
    const color=base.lerp(snow,snowMask);
    const corduroy=Math.sin(x*7.8+z*.055)*.022;
    const wind=Math.sin(z*.47+x*.2)*.012;
    const tint=1+(corduroy+wind)*snowMask;
    return {p:[x,y,z],c:[color.r*tint,color.g*tint,color.b*tint]};
  }
  const v=(x:number,z:number)=>{
    const key=x.toFixed(7)+":"+z.toFixed(7);
    let node=nodeCache.get(key);
    if(!node){node=sample(x,z);nodeCache.set(key,node)}
    return node;
  };
  const emit=(node:ReturnType<typeof v>)=>{
    vertices.push(...node.p);colors.push(...node.c);
  };
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const x0=minX+(maxX-minX)*i/nx,
      x1=minX+(maxX-minX)*(i+1)/nx;
    const z0=h.startZ+(h.endZ-h.startZ)*j/nz,
      z1=h.startZ+(h.endZ-h.startZ)*(j+1)/nz;
    const mid={x:(x0+x1)*.5,z:(z0+z1)*.5};
    if(mountainHalfpipeInfluence(mid)<.016)continue;
    const a=v(x0,z0),b=v(x1,z0),c=v(x1,z1),d=v(x0,z1);
    // Counterclockwise from above: snow receives upward-facing normals.
    for(const node of [a,c,b,a,d,c])emit(node);
  }
  const surface=new THREE.BufferGeometry();
  surface.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
  surface.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
  surface.computeVertexNormals();surface.computeBoundingSphere();
  const snowMaterial=new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:.96,metalness:0,side:THREE.DoubleSide,
  });
  const snow=new THREE.Mesh(surface,snowMaterial);
  snow.name="granite-ridge-single-carved-halfpipe";
  snow.receiveShadow=true;snow.castShadow=false;
  scene.add(snow);

  // A thin compressed-snow lip traces each wall and dissolves into its in-run.
  // One shared buffer and draw call, with no posts, rails or floating kickers.
  const rimVertices:number[]=[],rimColors:number[]=[];
  const rimColor=new THREE.Color("#c9e2e9");
  for(const side of [-1,1]){
    const x=h.centerX+side*(h.lipHalfWidth-.23);
    for(let k=0;k<68;k++){
      const z0=h.startZ+(h.endZ-h.startZ)*k/68,
        z1=h.startZ+(h.endZ-h.startZ)*(k+1)/68;
      const mid=(z0+z1)/2;
      if(mountainHalfpipeInfluence({x,z:mid})<.35)continue;
      const a0=[x,terrainHeight(x,z0)+.12,z0],
        a1=[x,terrainHeight(x,z1)+.12,z1],
        b0=[x+side*.095,terrainHeight(x+side*.095,z0)+.12,z0],
        b1=[x+side*.095,terrainHeight(x+side*.095,z1)+.12,z1];
      const rimFace=side>0?[a0,a1,b1,a0,b1,b0]:[a0,b1,a1,a0,b0,b1];
      for(const p of rimFace){
        rimVertices.push(...p);
        rimColors.push(rimColor.r,rimColor.g,rimColor.b);
      }
    }
  }
  const rimGeo=new THREE.BufferGeometry();
  rimGeo.setAttribute("position",new THREE.Float32BufferAttribute(rimVertices,3));
  rimGeo.setAttribute("color",new THREE.Float32BufferAttribute(rimColors,3));
  rimGeo.computeVertexNormals();rimGeo.computeBoundingSphere();
  const rimMat=new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:.91,metalness:0,side:THREE.DoubleSide,
  });
  const coping=new THREE.Mesh(rimGeo,rimMat);
  coping.name="granite-ridge-halfpipe-snow-coping";
  coping.castShadow=false;coping.receiveShadow=true;scene.add(coping);
  return {
    snow,coping,triangles:(vertices.length+rimVertices.length)/9,
    dispose(){
      scene.remove(snow);scene.remove(coping);
      surface.dispose();rimGeo.dispose();
      snowMaterial.dispose();rimMat.dispose();
    },
  };
}
