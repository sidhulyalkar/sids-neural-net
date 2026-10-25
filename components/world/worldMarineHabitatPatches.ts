import * as THREE from "three/src/Three.Core.js";
import { GeometryBatch } from "./worldGeometry";
import { createFishGeometry } from "./worldFaunaGeometry";
import { SEA_SURFACE, seaFloorHeight } from "@/lib/world/model";
import {
  MARINE_HABITAT_PATCHES, marineHabitatPoint,
  marineHabitatCounts, type HabitatPoint, type MarineKind, type ReefZone,
} from "@/lib/world/marineHabitatPatches";

const KINDS: readonly MarineKind[] = [
  "boulder","slab","spire","kelp","sand-ripple",
  "branch-coral","table-coral","fan-coral","anemone",
  "sea-star","urchin","crab","lobster","nudibranch",
  "moray","jelly","reef-fish","baitfish","clownfish","angelfish",
];

/** Low-poly asset family shared between all ecological patches. All props are
 * decorative and non-colliding. Nothing changes ride or swimming contact.
 */
function buildShape(kind: MarineKind): THREE.BufferGeometry {
  if (kind === "reef-fish") return createFishGeometry("rockfish","#ecebca");
  if (kind === "baitfish") return createFishGeometry("anchovy","#b8d5cb");
  const batch = new GeometryBatch();
  const add = (g:THREE.BufferGeometry, c:string, p:[number,number,number],
    s:[number,number,number], r:[number,number,number]=[0,0,0]) => {
    batch.add(g,c,new THREE.Vector3(...p),new THREE.Vector3(...s),new THREE.Euler(...r));
    g.dispose();
  };
  const stone = "#dddddd", pale = "#faf7ee";
  if(kind==="clownfish"||kind==="angelfish"){
    const clown=kind==="clownfish";
    const body=clown?"#e6a24c":"#e8d99d";
    add(new THREE.SphereGeometry(1,12,8),body,[0,0,0],
      clown?[.25,.36,.59]:[.14,.66,.62]);
    // Clownfish white bars are baked into each one-draw geometry.
    if(clown)for(const z of [-.28,.22]){
      add(new THREE.SphereGeometry(1,10,7),"#f8f3dc",[0,0,z],
        [.252,.34,.11]);
    }
    add(new THREE.ConeGeometry(.31,.62,5),clown?"#b96d50":"#ccac74",
      [0,0,-.75],[1,.8,.35],[Math.PI/2,0,0]);
    for(const side of [-1,1]){
      add(new THREE.SphereGeometry(.075,6,5),"#333735",
        [side*(clown?.245:.14),.13,.43],[.7,.7,.7]);
      add(new THREE.ConeGeometry(.32,.72,4),clown?"#be794f":"#e0c68e",
        [side*(clown?.20:.12),.28,-.16],[.36,.70,.62],[0,0,side*.40]);
    }
    if(!clown){
      add(new THREE.ConeGeometry(.44,1.16,4),"#dbc38b",
        [0,.72,-.17],[.60,1,.32],[0,0,.10]);
      add(new THREE.ConeGeometry(.39,.93,4),"#d6bca1",
        [0,-.64,-.19],[.65,.85,.30],[0,0,Math.PI]);
    }
    return batch.finish();
  }
  if (kind === "boulder") {
    add(new THREE.DodecahedronGeometry(1,0),stone,[0,0,0],[1.25,.76,1.02]);
    add(new THREE.IcosahedronGeometry(1,0),"#a7b9b2",[-.29,.22,-.32],[.72,.38,.62]);
  } else if (kind === "slab") {
    add(new THREE.CylinderGeometry(1.18,1.32,.40,6),stone,[0,.2,0],[1.1,1,.81],[0,.3,0]);
    add(new THREE.DodecahedronGeometry(1,0),"#c1c9b9",[.22,.39,0],[.47,.20,.67]);
  } else if (kind === "spire") {
    add(new THREE.CylinderGeometry(.20,.9,2.3,5),stone,[0,1.15,0],[.8,1,.85],[.10,0,.08]);
    add(new THREE.IcosahedronGeometry(1,0),"#b7c5b8",[.16,2.25,0],[.31,.30,.37]);
  } else if (kind === "kelp") {
    add(new THREE.CylinderGeometry(.045,.09,2.7,5),"#b4c5a0",[0,1.35,0],[1,1,1]);
    for(let i=0;i<5;i++) {
      const angle=i*2.399963;
      add(new THREE.ConeGeometry(.31,1.35,4),"#91ba83",
        [Math.sin(angle)*.24,.8+i*.39,Math.cos(angle)*.24],
        [1,.84,1],[Math.cos(angle)*.35,angle,-Math.sin(angle)*.35]);
    }
  } else if (kind === "branch-coral") {
    for(let i=0;i<7;i++) {
      const angle=i*2.399963;
      const x=Math.cos(angle)*.28,z=Math.sin(angle)*.28;
      add(new THREE.CylinderGeometry(.055,.16,1.2,5),i%2?"#f2c6bb":"#d9b7d3",
        [x,.67,z],[1,.65+(i%3)*.18,1],[Math.sin(angle)*.33,0,Math.cos(angle)*-.33]);
      add(new THREE.IcosahedronGeometry(.15,0),"#f8dfc9",
        [x*1.55,1.28+(i%3)*.12,z*1.55],[.85,.55,.85]);
    }
  } else if(kind === "table-coral") {
    add(new THREE.CylinderGeometry(.16,.27,1.03,6),"#d9c1ac",[0,.52,0],[1,1,1]);
    add(new THREE.CylinderGeometry(1.0,.80,.13,9),"#e6c9b4",[0,1.12,0],[1,1,.78]);
    for(let i=0;i<6;i++) {
      const a=i*Math.PI/3;
      add(new THREE.IcosahedronGeometry(.20,0),"#d8acc3",
        [Math.cos(a)*.69,1.20,Math.sin(a)*.54],[1,.38,1]);
    }
  } else if(kind === "fan-coral") {
    add(new THREE.CylinderGeometry(.05,.12,.54,5),"#d9aab9",[0,.27,0],[1,1,1]);
    for(let i=0;i<7;i++) {
      const theta=-1.1+i*2.2/6;
      add(new THREE.CylinderGeometry(.018,.09,1.25,4),
        i%2?"#dbbed2":"#f2aab2",
        [Math.sin(theta)*.45,1.03,0],[1,1,1],[0,0,-theta*.63]);
      add(new THREE.IcosahedronGeometry(.23,0),"#c3a1c6",
        [Math.sin(theta)*.89,1.54-Math.abs(theta)*.17,0],[1.05,1,.18]);
    }
  } else if(kind === "anemone") {
    for(let i=0;i<10;i++) {
      const a=i*2.399963,dist=i%3*.15;
      add(new THREE.ConeGeometry(.13,.82,5),i%2?"#d0b5e0":"#eea4af",
        [Math.sin(a)*dist,.40,Math.cos(a)*dist],
        [.9,.72+(i%3)*.16,.9],[Math.cos(a)*.18,0,-Math.sin(a)*.18]);
    }
  } else if (kind === "sea-star") {
    const outline=new THREE.Shape();
    for(let i=0;i<10;i++) {
      const a=i*Math.PI/5-Math.PI/2,r=i%2?.33:1;
      if(i===0)outline.moveTo(Math.cos(a)*r,Math.sin(a)*r);
      else outline.lineTo(Math.cos(a)*r,Math.sin(a)*r);
    }
    outline.closePath();
    add(new THREE.ExtrudeGeometry(outline,{depth:.07,bevelEnabled:false}),
      "#e7b784",[0,.055,0],[.36,.36,.36],[Math.PI/2,0,0]);
  } else if (kind === "urchin") {
    add(new THREE.IcosahedronGeometry(.40,1),"#9c8099",[0,.39,0],[1,.72,1]);
    for(let i=0;i<12;i++) {
      const a=i*2.399963;
      add(new THREE.ConeGeometry(.065,.55,4),"#b8a0b7",
        [Math.cos(a)*.33,.48+Math.sin(a)*.14,Math.sin(a)*.33],
        [1,1,1],[Math.sin(a)*.3,0,-Math.cos(a)*.3]);
    }
  } else if (kind === "crab" || kind === "lobster") {
    const long=kind==="lobster";
    add(new THREE.IcosahedronGeometry(.52,0),long?"#d18c70":"#cdaa8e",
      [0,.24,0],[.85,.42,long?1.65:1]);
    for(const side of [-1,1]) {
      for(let i=0;i<4;i++)
        add(new THREE.CylinderGeometry(.032,.065,.65,4),"#d9b193",
          [side*(.42+i*.08),.12,(i-1.5)*.22],
          [1,1,1],[0,0,side*.85]);
      add(new THREE.IcosahedronGeometry(.23,0),"#e6b58d",
        [side*.73,.28,.33],[1,.52,.7]);
    }
  } else if (kind === "nudibranch") {
    add(new THREE.SphereGeometry(.49,8,5),"#f5d09d",[0,.18,0],[.48,.33,1.2]);
    for(let i=0;i<6;i++)
      add(new THREE.ConeGeometry(.09,.34,4),i%2?"#d7b2e7":"#dc8b95",
        [i%2?.12:-.12,.45,(i-2.5)*.14],[1,1,1]);
  } else if(kind === "moray") {
    add(new THREE.CylinderGeometry(.16,.27,1.55,7),"#7e9990",
      [0,.25,-.35],[1,1,1],[Math.PI/2-.3,0,0]);
    add(new THREE.IcosahedronGeometry(.29,0),"#a5b2a0",[0,.42,.48],[1,.65,1.4]);
    for(const side of [-1,1])
      add(new THREE.SphereGeometry(.048,5,4),"#2c4143",
        [side*.18,.52,.60],[1,1,1]);
  } else if(kind === "jelly") {
    add(new THREE.SphereGeometry(1,10,5,0,Math.PI*2,0,Math.PI*.53),
      "#c6e9ef",[0,0,0],[.73,.52,.73]);
    for(let i=0;i<6;i++){
      const a=i*2.399963;
      add(new THREE.CylinderGeometry(.025,.015,1.05,4),"#c8b1dc",
        [Math.cos(a)*.29,-.64,Math.sin(a)*.29],[1,1,1]);
    }
  } else if(kind === "sand-ripple") {
    for(let i=0;i<5;i++)
      add(new THREE.TorusGeometry(.36+i*.23,.018,3,14,Math.PI*.70),pale,
        [0,.045,0],[1,.25,1],[-Math.PI/2,0,i*.37]);
  }
  return batch.finish();
}

const coldColors=["#688783","#78918a","#a7a991","#b7b8aa"];
const warmColors=["#e1caa3","#d8aeb7","#b3c7a6","#d6b7d9"];
const fishCold=["#d6b880","#8a9fa0","#b6c8c0","#a4a584"];
const fishWarm=["#f6c17f","#e5ccaa","#a8d8ba","#bba5e4"];

function tint(kind:MarineKind,zone:ReefZone,i:number) {
  const palette=kind==="clownfish"
    ? ["#fff0c4","#ffd8a0"] :
      kind==="angelfish" ? ["#fff4bf","#efd9a1","#eedcba"] :
      kind==="reef-fish"||kind==="baitfish"
      ? zone==="kelp"?fishCold:fishWarm : zone==="kelp"?coldColors:warmColors;
  return new THREE.Color(palette[(i*7+kind.length)%palette.length]);
}
const yOffset=(kind:MarineKind,scale:number)=>{
  if(kind==="kelp"||kind==="branch-coral"||kind==="table-coral"||kind==="fan-coral")return .09;
  if(kind==="boulder")return .71*scale;
  if(kind==="slab")return .14*scale;
  if(kind==="spire")return .08;
  if(kind==="jelly")return 2.5*scale;
  if(kind.endsWith("fish"))return 1.25*scale;
  return .14*scale;
};
type Actor={mesh:THREE.InstancedMesh;kind:MarineKind;poses:HabitatPoint[]};

/** One instanced mesh per geometry family per zone. Visibility stays under
 * the pre-existing kelp and lagoon roots, so inactive coasts incur no draws.
 */
export function createMarineHabitatPatches(kelpRoot:THREE.Group,lagoonRoot:THREE.Group) {
  const geometries=new Map<MarineKind,THREE.BufferGeometry>();
  const material=new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:.88,side:THREE.DoubleSide,
  });
  const jellyMaterial=new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:.81,transparent:true,opacity:.78,
    depthWrite:false,side:THREE.DoubleSide,
  });
  const groups:Actor[]=[];
  const roots={kelp:kelpRoot,lagoon:lagoonRoot};
  const dummy=new THREE.Object3D();
  const place=(actor:Actor,i:number,t:number)=>{
    const p=actor.poses[i],kind=actor.kind,active=kind.endsWith("fish")||kind==="jelly";
    const a=active?t*.32+(i%13)*.37:0;
    const radius=active?(kind==="jelly"?.38:.58):0;
    const x=p.x+Math.cos(a)*radius,z=p.z+Math.sin(a)*radius;
    const floor=seaFloorHeight(x,z);
    const bob=kind==="jelly"?Math.sin(t*.78+i)*.18:active?Math.sin(t*1.45+i)*.075:0;
    const height=yOffset(kind,p.scale);
    const surfaceClearance=kind==="jelly"?.95:.54;
    const y=active?Math.min(SEA_SURFACE-surfaceClearance,floor+height+bob):p.y+height;
    dummy.position.set(x,y,z);
    // Starfish geometry was already laid into the XZ seabed plane at build time.
    dummy.rotation.set(0,p.yaw+(active?a:0),0);
    dummy.scale.setScalar(p.scale);
    dummy.updateMatrix();
    actor.mesh.setMatrixAt(i,dummy.matrix);
  };
  for(const zone of ["kelp","lagoon"] as const) {
    const root=new THREE.Group();
    root.name=`marine-patches-${zone}`;
    roots[zone].add(root);
    for(const kind of KINDS) {
      const patches=MARINE_HABITAT_PATCHES.filter(p=>p.zone===zone&&p.population[kind]);
      if(!patches.length)continue;
      const points:HabitatPoint[]=[];
      for(const patch of patches)
        for(let i=0;i<(patch.population[kind]??0);i++)
          points.push(marineHabitatPoint(patch,kind,i));
      if(!geometries.has(kind))geometries.set(kind,buildShape(kind));
      const mesh=new THREE.InstancedMesh(geometries.get(kind)!,
        kind==="jelly"?jellyMaterial:material,points.length);
      mesh.name=`marine-${zone}-${kind}`;
      mesh.castShadow=false;mesh.receiveShadow=false;
      mesh.frustumCulled=false;
      const actor={mesh,kind,poses:points};
      for(let i=0;i<points.length;i++){
        mesh.setColorAt(i,tint(kind,zone,i));
        place(actor,i,0);
      }
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
      mesh.instanceMatrix.needsUpdate=true;
      root.add(mesh);groups.push(actor);
    }
  }
  let last=-Infinity;
  function update(t:number,reducedMotion=false) {
    if(t-last<.085)return;
    last=t;
    for(const actor of groups) {
      if(!actor.mesh.parent?.parent?.visible)continue;
      if(!actor.kind.endsWith("fish") && actor.kind!=="jelly")continue;
      for(let i=0;i<actor.poses.length;i++)place(actor,i,reducedMotion?0:t);
      actor.mesh.instanceMatrix.needsUpdate=true;
    }
  }
  return {
    counts:{kelp:marineHabitatCounts("kelp"),lagoon:marineHabitatCounts("lagoon")},
    patchCount:MARINE_HABITAT_PATCHES.length,
    drawCalls:{
      kelp:groups.filter(a=>a.mesh.name.startsWith("marine-kelp")).length,
      lagoon:groups.filter(a=>a.mesh.name.startsWith("marine-lagoon")).length,
    },
    update,
    dispose() {
      for(const actor of groups){actor.mesh.parent?.remove(actor.mesh);actor.mesh.dispose();}
      for(const geom of geometries.values())geom.dispose();
      material.dispose();jellyMaterial.dispose();
      kelpRoot.getObjectByName("marine-patches-kelp")?.removeFromParent();
      lagoonRoot.getObjectByName("marine-patches-lagoon")?.removeFromParent();
    },
  };
}
