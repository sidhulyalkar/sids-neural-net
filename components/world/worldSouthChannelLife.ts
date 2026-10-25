import * as THREE from "three/src/Three.Core.js";
import { seaFloorHeight, SEA_SURFACE } from "@/lib/world/model";
import { createFishGeometry } from "./worldFaunaGeometry";

/** Sparse volcanic-arch reef, authored as three observable microhabitats.
 * This is intentionally separate from both legacy snorkeling reefs.
 * All ground patches use the exact same seabed as the southern swim solver.
 */
export const SOUTH_REEF_COUNTS = {
  fish: 72, grass: 112, coral: 48,
  anemones: 66, seaStars: 21, crabs: 18,
  lobsters: 10, nudibranchs: 25,
} as const;
const habitats = [
  { x: -7, z: -125 }, // rocky west approach, away from steep dry apron
  { x: 37, z: -133 }, // volcanic wall / cleaner-fish edge
  { x: 20, z: -153 }, // deeper outer rubble garden
] as const;

export function createSouthChannelLife(parent: THREE.Group) {
  const root = new THREE.Group();
  root.name = "southern-arch-reef-gardens";
  parent.add(root);
  const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [];
  const geometry=<T extends THREE.BufferGeometry>(g:T)=>{geometries.push(g);return g};
  const material=<T extends THREE.Material>(m:T)=>{materials.push(m);return m};
  const mat=(color:string)=>material(new THREE.MeshStandardMaterial({
    color,roughness:.91,metalness:.02,side:THREE.DoubleSide,
  }));
  const stone=geometry(new THREE.IcosahedronGeometry(1,1));
  const grassGeo=geometry(new THREE.ConeGeometry(1,1,4));
  const tentacle=geometry(new THREE.CylinderGeometry(.035,.13,1,5));
  const star=geometry(new THREE.IcosahedronGeometry(1,0));
  const coralGeo=geometry(new THREE.CylinderGeometry(.68,1,1,6));
  const dot=geometry(new THREE.SphereGeometry(1,7,5));
  const fishGeo=geometry(createFishGeometry("rockfish","#b6cda7"));
  const fishMat=material(new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:.85,side:THREE.DoubleSide,
  }));
  const mk=(name:string,g:THREE.BufferGeometry,m:THREE.Material,n:number)=>{
    const inst=new THREE.InstancedMesh(g,m,n);
    inst.name=name;inst.castShadow=false;inst.receiveShadow=false;
    inst.frustumCulled=false;root.add(inst);
    return inst;
  };
  const grasses=mk("southern-channel-seagrass",grassGeo,mat("#638875"),SOUTH_REEF_COUNTS.grass);
  const coral=mk("southern-channel-corals",coralGeo,mat("#9b8896"),SOUTH_REEF_COUNTS.coral);
  const anemones=mk("southern-channel-anemones",tentacle,mat("#b693a1"),SOUTH_REEF_COUNTS.anemones);
  const stars=mk("southern-channel-sea-stars",star,mat("#c7a16f"),SOUTH_REEF_COUNTS.seaStars);
  const crabs=mk("southern-channel-rock-crabs",stone,mat("#ba9071"),SOUTH_REEF_COUNTS.crabs);
  const lobsters=mk("southern-channel-spiny-lobsters",dot,mat("#a86955"),SOUTH_REEF_COUNTS.lobsters);
  const nudis=mk("southern-channel-nudibranchs",dot,mat("#e2b986"),SOUTH_REEF_COUNTS.nudibranchs);
  const fish=mk("southern-channel-fish",fishGeo,fishMat,SOUTH_REEF_COUNTS.fish);
  const dummy=new THREE.Object3D();
  let seed=3347;
  const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  const position=(index:number,spread=9)=>{
    const base=habitats[index%habitats.length];
    for(let attempt=0;attempt<24;attempt++){
      const a=rnd()*Math.PI*2,rad=Math.sqrt(rnd())*spread;
      const p={x:base.x+Math.cos(a)*rad,z:base.z+Math.sin(a)*rad};
      if(seaFloorHeight(p.x,p.z)<SEA_SURFACE-2.15)return p;
    }
    // Guaranteed submerged fallback if a later terrain sculpt moves the reef.
    return {x:20,z:-145};
  };
  const place=(mesh:THREE.InstancedMesh,index:number,x:number,y:number,z:number,sx:number,sy:number,sz:number,angle:number)=>{
    dummy.position.set(x,y,z);dummy.rotation.set(0,angle,0);
    dummy.scale.set(sx,sy,sz);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);
  };
  for(let i=0;i<grasses.count;i++){
    const p=position(i,10),h=seaFloorHeight(p.x,p.z);
    const size=.46+rnd()*.64;
    place(grasses,i,p.x,h+size*.5,p.z,.12,size,.12,rnd()*6.28);
  }
  for(let i=0;i<coral.count;i++){
    const p=position(i,8),h=seaFloorHeight(p.x,p.z);
    const size=.28+rnd()*.7;
    place(coral,i,p.x,h+size*.4,p.z,size*.58,size*.8,size*.65,rnd()*6.28);
  }
  for(let i=0;i<anemones.count;i++){
    const p=position(i,7),h=seaFloorHeight(p.x,p.z);
    const len=.22+rnd()*.53;
    place(anemones,i,p.x,h+len*.5,p.z,.7,len,.7,rnd()*6.28);
  }
  for(let i=0;i<stars.count;i++){
    const p=position(i,11),h=seaFloorHeight(p.x,p.z);
    place(stars,i,p.x,h+.05,p.z,.17,.055,.18,rnd()*6.28);
  }
  for(let i=0;i<crabs.count;i++){
    const p=position(i,9),h=seaFloorHeight(p.x,p.z);
    place(crabs,i,p.x,h+.11,p.z,.20,.11,.15,rnd()*6.28);
  }
  for(let i=0;i<lobsters.count;i++){
    const p=position(i,7),h=seaFloorHeight(p.x,p.z);
    place(lobsters,i,p.x,h+.19,p.z,.19,.16,.40,rnd()*6.28);
  }
  for(let i=0;i<nudis.count;i++){
    const p=position(i,8),h=seaFloorHeight(p.x,p.z);
    place(nudis,i,p.x,h+.045,p.z,.11,.07,.20,rnd()*6.28);
  }
  for(const instance of [grasses,coral,anemones,stars,crabs,lobsters,nudis])
    instance.instanceMatrix.needsUpdate=true;

  const fishCoords=Array.from({length:fish.count},(_,i)=>{
    const home=habitats[i%habitats.length];
    return {home,i,height:1.1+rnd()*.85,theta:rnd()*Math.PI*2};
  });
  let last=-Infinity;
  function update(seconds:number,reducedMotion=false) {
    if(!parent.visible||!root.visible)return;
    if(seconds-last<1/12)return;
    last=seconds;
    const t=reducedMotion?0:seconds;
    for(const f of fishCoords){
      const a=f.theta+t*(.72+(f.i%5)*.055);
      const x=f.home.x+Math.cos(a)*(1.4+(f.i%7)*.31);
      const z=f.home.z+Math.sin(a)*(1.4+(f.i%7)*.31);
      const y=Math.min(SEA_SURFACE-.5,seaFloorHeight(x,z)+f.height);
      place(fish,f.i,x,y,z,.34,.34,.34,-a+Math.PI/2);
    }
    fish.instanceMatrix.needsUpdate=true;
  }
  // Populate valid matrices even if the group is initially hidden.
  const wasVisible=parent.visible;
  parent.visible=true;update(0,true);parent.visible=wasVisible;
  return {
    counts:SOUTH_REEF_COUNTS,
    update,
    dispose(){
      parent.remove(root);
      for(const mesh of [grasses,coral,anemones,stars,crabs,lobsters,nudis,fish])mesh.dispose();
      for(const g of geometries)g.dispose();
      for(const m of materials)m.dispose();
    },
  };
}
