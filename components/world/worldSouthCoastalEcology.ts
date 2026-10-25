import * as THREE from "three/src/Three.Core.js";
import {GeometryBatch} from "./worldGeometry";
import {buildShape} from "./worldMarineHabitatPatches";
import {SEA_SURFACE,seaFloorHeight} from "@/lib/world/model";
import {SOUTH_HABITATS,southHabitatPoint,southHabitatTotals,
  type SouthFaunaKind,type SouthHabitatPoint,type SouthSide} from "@/lib/world/southCoastHabitats";

/** Southern Californian life is stylized, not a photorealistic identification
 * model. Existing coral/invertebrate morphologies are shared with east/west.
 */
const common:Partial<Record<SouthFaunaKind,Parameters<typeof buildShape>[0]>>={
  "reef-rock":"boulder","fan-coral":"fan-coral","anemone":"anemone",
  "seagrass":"kelp","sea-star":"sea-star","crab":"crab",
  "lobster":"lobster","nudibranch":"nudibranch","urchin":"urchin",
};
function southGeometry(kind:SouthFaunaKind):THREE.BufferGeometry {
  const reused=common[kind];
  if(reused)return buildShape(reused);
  const b=new GeometryBatch();
  const add=(g:THREE.BufferGeometry,c:string,p:[number,number,number],
    sc:[number,number,number],rot:[number,number,number]=[0,0,0])=>{
    b.add(g,c,new THREE.Vector3(...p),new THREE.Vector3(...sc),new THREE.Euler(...rot));
    g.dispose();
  };
  const cone=(radius:number,length:number,color:string,p:[number,number,number],
    rotation:[number,number,number]=[0,0,0])=>{
    add(new THREE.ConeGeometry(radius,length,5),color,p,[1,1,1],rotation);
  };
  const blob=(color:string,p:[number,number,number],scale:[number,number,number])=>
    add(new THREE.SphereGeometry(1,9,6),color,p,scale);
  if(kind==="giant-kelp"||kind==="bull-kelp"){
    const bull=kind==="bull-kelp";
    add(new THREE.CylinderGeometry(.046,.095,bull?4.7:5.1,5),
      "#738b53",[0,bull?2.35:2.55,0],[1,1,1]);
    if(bull) blob("#9dbd73",[0,4.92,0],[.28,.42,.26]);
    for(let i=0;i<(bull?4:10);i++){
      const a=i*2.399963,r=bull?.13:.22;
      const h=bull?4.7+i*.07:.8+i*.44;
      cone(bull?.30:.23,bull?1.9:1.5,"#9abc7f",
        [Math.sin(a)*r,h,Math.cos(a)*r],
        [Math.cos(a)*.35,a,Math.sin(a)*-.35]);
    }
  }else if(kind==="understory"){
    for(let i=0;i<6;i++){
      const a=i*2.399963;
      cone(.18,1.0+(i%3)*.19,"#7fa778",
        [Math.cos(a)*.17,.50,Math.sin(a)*.17],[Math.sin(a)*.24,a,Math.cos(a)*.20]);
    }
  }else if(kind==="abalone"){
    blob("#8b867e",[0,.16,0],[.45,.20,.68]);
    blob("#b9bda4",[0,.28,.03],[.30,.08,.49]);
    for(let i=0;i<5;i++)blob("#dccab6",[.25,.27,(i-2)*.19],[.035,.04,.05]);
  }else if(kind==="octopus"){
    blob("#998374",[0,.45,.05],[.45,.49,.45]);
    for(let i=0;i<8;i++){
      const a=i*2.399963;
      add(new THREE.CylinderGeometry(.045,.14,1.45,5),"#a4908c",
        [Math.cos(a)*.46,.23,Math.sin(a)*.46],[1,1,1],
        [Math.sin(a)*.32,a,Math.cos(a)*-.38]);
    }
    for(const side of [-1,1])blob("#222d2a",[side*.20,.63,.37],[.052,.065,.052]);
  }else if(kind==="sea-otter"||kind==="harbor-seal"||kind==="sea-lion"){
    const otter=kind==="sea-otter",lion=kind==="sea-lion";
    const c=otter?"#8c705a":lion?"#ab9277":"#9b9d91";
    blob(c,[0,.10,0],otter?[.36,.27,.85]:lion?[.55,.50,1.22]:[.45,.36,1.02]);
    blob(c,[0,.22,otter?.76:.84],[otter?.32:.40,.33,.41]);
    blob("#e7d7be",[0,.13,otter?1.02:1.18],[.22,.13,.22]);
    for(const side of [-1,1]){
      blob("#243638",[side*.21,.36,otter?.96:1.10],[.055,.06,.055]);
      add(new THREE.ConeGeometry(.23,.78,5),c,
        [side*(otter?.37:.51),-.12,-.16],[1,1,1],[0,0,side*.85]);
    }
    if(otter)blob(c,[0,-.01,-1.12],[.18,.15,.52]);
    else {
      for(const side of [-1,1])blob(c,[side*.20,-.05,-1.18],[.24,.08,.46]);
    }
  }else{
    // A clear body silhouette and tail family for California reef fish and
    // leopard sharks, with individually colored parts baked into each source.
    const shark=kind==="leopard-shark",gar=kind==="garibaldi",
      sheep=kind==="sheephead";
    const c=gar?"#ed8a39":sheep?"#b78a8d":
      kind==="kelp-bass"?"#839e82":"#a6afa5";
    blob(c,[0,.14,0],shark?[.34,.33,1.30]:
      gar?[.24,.52,.62]:sheep?[.24,.44,.78]:[.34,.35,.75]);
    blob(shark?"#e6e3ce":"#ddcbb3",[0,-.08,.15],
      shark?[.28,.10,.88]:[.18,.10,.45]);
    cone(shark?.38:.33,shark?1.3:.81,c,[0,.05,shark?-1.59:-.84],
      [Math.PI/2,0,0]);
    cone(shark?.26:.21,shark?.77:.59,c,[0,shark?.55:.53,-.33],
      [0,0,Math.PI]);
    for(const side of [-1,1]){
      blob("#303b3a",[side*(shark?.31:.21),.25,shark?.88:.42],[.05,.05,.06]);
      cone(shark?.19:.16,shark?.58:.47,c,[side*.31,-.04,-.28],
        [0,0,side*.92]);
    }
    if(shark)for(let i=0;i<12;i++){
      const a=i*2.4;
      blob("#566b66",[Math.sin(a)*.21,.36+(i%2)*.11,
        -.85+(i%6)*.30],[.095,.04,.12]);
    }
  }
  return b.finish();
}
const KINDS=[...new Set(SOUTH_HABITATS.flatMap(p=>
  Object.keys(p.population) as SouthFaunaKind[]))];
type Batch={kind:SouthFaunaKind,mesh:THREE.InstancedMesh,
  points:SouthHabitatPoint[],side:SouthSide};
const swimmers=new Set<SouthFaunaKind>(["sea-lion","harbor-seal","sea-otter",
  "garibaldi","sheephead","kelp-bass","leopard-shark"]);
const growth=new Set<SouthFaunaKind>(["giant-kelp","bull-kelp","understory"]);
const palette=(kind:SouthFaunaKind)=>new THREE.Color(
  kind==="reef-rock"?"#9da59a":kind==="fan-coral"?"#ddb8cf":
  kind==="anemone"?"#dcb3b6":kind==="seagrass"?"#819d81":
  kind==="giant-kelp"?"#76a66a":kind==="bull-kelp"?"#8dbe77":
  kind==="understory"?"#7aa17b":"#ffffff");
const groundOffset=(kind:SouthFaunaKind,size:number)=>{
  if(kind==="reef-rock")return .64*size;
  if(kind==="sea-star")return .10;
  if(["crab","lobster","urchin","abalone","octopus"].includes(kind))return .10;
  if(swimmers.has(kind))return (kind==="sea-lion"?2.75:
    kind==="harbor-seal"?2.55:kind==="sea-otter"?1.9:1.4);
  return .05;
};

/** Draw call cost is bounded by organism families, not population.
 * The rocks and plants have no collision contacts; existing landscape
 * and sports movement still own all physical surfaces.
 */
export function createSouthCoastalEcology(parent:THREE.Group){
  const root=new THREE.Group();root.name="south-coastal-ecology";
  parent.add(root);
  const geometry=new Map<SouthFaunaKind,THREE.BufferGeometry>();
  const material=new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:.86,side:THREE.DoubleSide,
  });
  const batches:Batch[]=[];
  const dummy=new THREE.Object3D();
  const set=(b:Batch,i:number,t:number)=>{
    const p=b.points[i],move=swimmers.has(b.kind);
    const speed=b.kind==="sea-lion"?.94:b.kind==="harbor-seal"?.66:
      b.kind==="sea-otter"?.32:b.kind==="leopard-shark"?.48:.64;
    const phi=t*speed+i*2.4;
    const radius=!move?0:b.kind==="sea-lion"?3.0:
      b.kind==="harbor-seal"?2.6:b.kind==="leopard-shark"?3.7:
      b.kind==="sea-otter"?1.1:1.65;
    const x=p.x+Math.cos(phi)*radius,z=p.z+Math.sin(phi)*radius;
    const floor=seaFloorHeight(x,z);
    const bob=move?Math.sin(t*1.1+i)*.14:0;
    const y=move?Math.min(SEA_SURFACE-.8,
      floor+groundOffset(b.kind,p.size)+bob):
      p.y+groundOffset(b.kind,p.size);
    dummy.position.set(x,y,z);
    // Motion tangent on the x=cos(phi), z=sin(phi) route points toward
    // local +Z at yaw=-phi; wrong sign made dolphins/fish slide sideways.
    dummy.rotation.set(0,move?-phi:p.angle,
      growth.has(b.kind)?Math.sin(t*.45+i)*.035:
      move?Math.sin(t*.78+i)*.045:0);
    dummy.scale.setScalar(p.size);
    dummy.updateMatrix();b.mesh.setMatrixAt(i,dummy.matrix);
  };
  for(const side of ["southwest-reef","southeast-kelp"] as const){
    const sub=new THREE.Group();sub.name=side;root.add(sub);
    for(const kind of KINDS){
      const points:SouthHabitatPoint[]=[];
      for(const patch of SOUTH_HABITATS)if(patch.side===side)
        for(let i=0;i<(patch.population[kind]??0);i++)
          points.push(southHabitatPoint(patch,kind,i));
      if(!points.length)continue;
      if(!geometry.has(kind))geometry.set(kind,southGeometry(kind));
      const batch:Batch={kind,points,side,
        mesh:new THREE.InstancedMesh(geometry.get(kind)!,material,points.length)};
      batch.mesh.name=`south-${side}-${kind}`;
      batch.mesh.frustumCulled=false;batch.mesh.castShadow=false;
      batch.mesh.receiveShadow=false;
      const color=palette(kind);
      for(let i=0;i<points.length;i++){
        set(batch,i,0);
        batch.mesh.setColorAt(i,color.clone().multiplyScalar(.88+(i%7)*.027));
      }
      batch.mesh.instanceMatrix.needsUpdate=true;
      if(batch.mesh.instanceColor)batch.mesh.instanceColor.needsUpdate=true;
      sub.add(batch.mesh);batches.push(batch);
    }
  }
  let last=-Infinity;
  function update(time:number,observer?:{x:number;z:number},reducedMotion=false) {
    // Coldwater west and kelp east independently cull by observation distance.
    for(const side of ["southwest-reef","southeast-kelp"] as const){
      const sub=root.getObjectByName(side)!;
      const patches=SOUTH_HABITATS.filter(p=>p.side===side);
      sub.visible=!observer || patches.some(p=>
        Math.hypot(observer.x-p.x,observer.z-p.z)<65);
    }
    if(!parent.visible || time-last<1/12)return;
    last=time;
    for(const b of batches){
      if(!b.mesh.parent?.visible||!swimmers.has(b.kind)&&!growth.has(b.kind))continue;
      for(let i=0;i<b.points.length;i++)set(b,i,reducedMotion?0:time);
      b.mesh.instanceMatrix.needsUpdate=true;
    }
  }
  return {
    update,
    counts:{southwest:southHabitatTotals("southwest-reef"),
      southeast:southHabitatTotals("southeast-kelp")},
    draws:batches.length,
    dispose() {
      parent.remove(root);
      for(const b of batches){b.mesh.dispose();b.mesh.removeFromParent();}
      for(const geo of geometry.values())geo.dispose();
      material.dispose();
    },
  };
}
