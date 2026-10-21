import * as THREE from "three/src/Three.Core.js";
import type {CameraVolume} from "@/lib/world/cameraVisibility";
import { GeometryBatch } from "./worldGeometry";
import { biomeAt, DESERT_FORMATIONS, smooth, understoryDensityAt } from "@/lib/world/biomes";
import { BOULDER_HOLDS, sportClearance } from "@/lib/world/activities";
import { discGolfOpeningClearance, discGolfCourseClearance } from "@/lib/world/discGolf";
import { RAINFOREST_CANOPY_WILDLIFE, RAINFOREST_REPTILES, DESERT_ECOLOGY_ANCHORS } from "@/lib/world/ecology";
import { skimBeachClearance } from "@/lib/world/skimboarding";
import { DESERT_JUMPS, desertGapBypassPoints, jumpWorld } from "@/lib/world/desertTrack";
import {
  terrainHeight,
  distance,
  isWater,
  REGIONS,
  MEMORY_POINTS,
  type Point,
  type Obstacle,
} from "@/lib/world/model";
/** Batched ecological compositions; seeded candidates are stable across quality/camera changes. */
export function createHabitats(scene: THREE.Scene, obstacles: Obstacle[]) {
  const cameraOccluders:CameraVolume[]=[];
  const resources: THREE.BufferGeometry[] = [],
    meshes: THREE.Mesh[] = [];
  const sphere = new THREE.SphereGeometry(1, 8, 5),
    branch = new THREE.CylinderGeometry(0.7, 1, 1, 5),
    leaf = new THREE.ConeGeometry(1, 1, 4);
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0, 0);
  bladeShape.quadraticCurveTo(-0.36, 0.45, 0, 1);
  bladeShape.quadraticCurveTo(0.36, 0.45, 0, 0);
  const blade = new THREE.ShapeGeometry(bladeShape, 2);
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  let seed = 171;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const add = (
    b: GeometryBatch,
    g: THREE.BufferGeometry,
    c: string,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    rx = 0,
    ry = 0,
    rz = 0,
  ) => b.add(g, c, V(x, y, z), V(sx, sy, sz), new THREE.Euler(rx, ry, rz));
  const stem = (
    b: GeometryBatch,
    c: string,
    a: THREE.Vector3,
    d: THREE.Vector3,
    r: number,
  ) => {
    const delta = d.clone().sub(a);
    b.add(
      branch,
      c,
      a.clone().add(d).multiplyScalar(0.5),
      V(r, delta.length(), r),
      new THREE.Euler().setFromQuaternion(
        new THREE.Quaternion().setFromUnitVectors(
          V(0, 1, 0),
          delta.normalize(),
        ),
      ),
    );
  };
  const roots: { mesh: THREE.Mesh; center: Point; radius: number }[] = [];
  const finish = (b: GeometryBatch, label: string) => {
    const g = b.finish();
    if (!g.getAttribute("position").count) {
      g.dispose();
      return;
    }
    resources.push(g);
    g.computeBoundingBox();
    const bounds = g.boundingBox!;
    const center = { x: (bounds.min.x + bounds.max.x) / 2, z: (bounds.min.z + bounds.max.z) / 2 };
    const radius = Math.hypot(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) / 2;
    const m = new THREE.Mesh(g, material);
    m.name = label;
    m.receiveShadow = true;
    scene.add(m);
    meshes.push(m);
    roots.push({ mesh: m, center, radius });
    return m;
  };
  const washX = (z: number) => 27 + -z * 0.08 + Math.sin(z * 0.11) * 1.6;
  const inDryWash = (p: Point) => p.z > -52 && p.z < -4 && Math.abs(p.x - washX(p.z)) < 1.4;
  const clear = (p: Point) =>
    discGolfOpeningClearance(p,1.6) ||
    inDryWash(p) ||
    BOULDER_HOLDS.some((h) => distance(p, h) < h.radius + 2) ||
    sportClearance(p) ||
    skimBeachClearance(p) ||
    REGIONS.some((r) => distance(p, r.point) < 3) ||
    MEMORY_POINTS.some((r) => distance(p, r.point) < 2.5) ||
    isWater(p);
  // Granite forms: rounded joint blocks, coherent burial and a readable open slot.
  const granite = new GeometryBatch();
  for (const f of DESERT_FORMATIONS) {
    const y = terrainHeight(f.x, f.z);
    // Three small, buried rock shoulders replace the towering boulder stacks.
    for (let i = 0; i < 3; i++) {
      const dx = (i - 1) * f.sx * 0.55;
      add(granite, sphere, i % 2 ? "#bbaa91" : "#c4b299",
        f.x + dx, terrainHeight(f.x + dx, f.z) + f.sy * 0.22, f.z,
        f.sx * 0.52, f.sy * 0.46, f.sz * 0.58, 0, i * 0.19);
    }
    obstacles.push({ x: f.x, z: f.z, radius: Math.min(f.sx, f.sz) * 0.65 });
    for (let j = 0; j < 16; j++) {
      const a = j * 2.4,
        r = f.sx * (0.8 + random() * 0.6);
      const x = f.x + Math.cos(a) * r,
        z = f.z + Math.sin(a) * r;
      add(
        granite,
        sphere,
        "#ae9977",
        x,
        terrainHeight(x, z) + 0.1,
        z,
        0.2 + random() * 0.3,
        0.15,
        0.25,
      );
    }
  }
  // A dry gravel corridor guides the approach without inventing a water source.
  // Sparse ground-hugging grus breaks the edge; vegetation shares this footprint.
  for (let i = 0; i < 120; i++) {
    const z = -5 - random() * 46, x = washX(z) + (random() - 0.5) * 2.4;
    if (biomeAt({ x, z }).weights.desert < 0.12 || sportClearance({ x, z })) continue;
    add(granite, sphere, i % 3 ? "#d7c6a5" : "#bca987", x, terrainHeight(x, z) + 0.025, z,
      0.08 + random() * 0.22, 0.035, 0.1 + random() * 0.24);
  }
  // True lowered gap interiors: gravel wash / dead Joshua skeleton below the
  // airborne route. These share the existing static habitat material/batch.
  // They are visually grounded on the same analytic terrain as bike contact.
  for(const jump of DESERT_JUMPS) {
    if(jump.kind!=="gap")continue;
    const center=(jump.gapStart+jump.gapEnd)/2;
    for(let i=0;i<26;i++) {
      const along=jump.gapStart+0.35+(i%13)/12*(jump.gapEnd-jump.gapStart-0.7);
      const side=(((i*7)%11)-5)/5*2.35;
      const p=jumpWorld(jump,along,side);
      const y=terrainHeight(p.x,p.z);
      add(granite,sphere,i%4===0?"#a9987c":i%3===0?"#cbb99c":"#b4a58b",
        p.x,y+0.025,p.z,0.11+(i%4)*0.042,0.035,0.13+(i%5)*0.035);
    }
    if(jump.obstacle==="fallen-joshua") {
      const a=jumpWorld(jump,center,-1.65),b=jumpWorld(jump,center,1.65);
      const left=V(a.x,terrainHeight(a.x,a.z)+0.22,a.z);
      const right=V(b.x,terrainHeight(b.x,b.z)+0.18,b.z);
      stem(granite,"#978b75",left,right,0.20);
      for(let k=0;k<5;k++) {
        const base=jumpWorld(jump,center,-1.4+k*0.7);
        const tip=jumpWorld(jump,center+((k%2)?0.85:-1.1),-1.6+k*0.7);
        stem(granite,k%2?"#7d725f":"#a79a81",
          V(base.x,terrainHeight(base.x,base.z)+0.2,base.z),
          V(tip.x,terrainHeight(tip.x,tip.z)+0.56,tip.z),0.065);
      }
    } else {
      // Exposed grus bank strata read as an arroyo without fabricating a
      // perennial water source in the Mojave basin.
      for(const side of [-1,1])for(let k=0;k<6;k++) {
        const p=jumpWorld(jump,jump.gapStart+k*(jump.gapEnd-jump.gapStart)/5,side*2.75);
        add(granite,sphere,k%2?"#d6c1a1":"#c2ab8b",p.x,
          terrainHeight(p.x,p.z)+0.04,p.z,0.24,0.13,0.39,0,k*0.37);
      }
    }
    // Worn bare-earth bypass turnouts read from the same authored polyline.
    const bypass=desertGapBypassPoints(jump);
    for(const [i,p] of bypass.entries()) {
      if(i===0||i===bypass.length-1)continue;
      add(granite,sphere,"#b3a084",p.x,terrainHeight(p.x,p.z)+0.02,
        p.z,0.32,0.027,0.43,0,i*0.3);
    }
  }
  // Basking reptiles, small coiled snakes and one roadrunner are intentionally
  // still life. They never become bike hazards, threats or chase targets.
  for(const [i,animal] of DESERT_ECOLOGY_ANCHORS.entries()){
    const {x,z}=animal.point,y=terrainHeight(x,z)+.08;
    if(isWater(animal.point)||sportClearance(animal.point))continue;
    if(animal.kind==="sidewinder"||animal.kind==="rattlesnake"){
      const length=animal.kind==="sidewinder"?13:17;
      let previous=V(x+.4,y,z);
      for(let j=1;j<=length;j++){
        const t=j/length,angle=t*Math.PI*3.8+i,rad=.44*(1-t*.75);
        const next=V(x+Math.cos(angle)*rad,y+.08,z+Math.sin(angle)*rad);
        stem(granite,j%4===0?"#867b60":"#ad9976",previous,next,
          .08*(1-t*.35));previous=next;
      }
      add(granite,sphere,"#a89679",previous.x,previous.y,previous.z,.13,.09,.18);
      for(const side of [-1,1])
        add(granite,sphere,"#342e25",previous.x+side*.078,previous.y+.047,
          previous.z+.09,.022,.022,.018);
    } else if(animal.kind==="roadrunner"){
      add(granite,sphere,"#6d6257",x,y+.54,z,.22,.25,.49);
      add(granite,sphere,"#817668",x,y+.9,z+.37,.15,.17,.19);
      add(granite,leaf,"#bca97e",x,y+.86,z+.64,.10,.10,.31,Math.PI/2);
      for(const side of [-1,1]){
        stem(granite,"#8d6b53",V(x+side*.10,y+.32,z),
          V(x+side*.13,y+.04,z+.07),.033);
        stem(granite,"#7b705c",V(x+side*.12,y+.51,z-.3),
          V(x+side*.24,y+.61,z-1.0),.05);
      }
    } else {
      const big=animal.kind==="chuckwalla";
      add(granite,sphere,big?"#867f66":"#b5a27c",x,y+.17,z,
        big?.37:.26,big?.22:.12,big?.53:.45);
      add(granite,sphere,"#9b8f70",x,y+.20,z+.49,.17,.13,.23);
      for(const side of [-1,1]){
        for(const front of [-1,1])
          stem(granite,"#7c765b",V(x+side*.23,y+.16,z+front*.26),
            V(x+side*.42,y+.04,z+front*.4),.048);
        add(granite,sphere,"#2f3027",x+side*.11,y+.28,z+.64,.025,.025,.022);
      }
      let prev=V(x,y+.12,z-.40);
      for(let t=1;t<=7;t++){
        const next=V(x+Math.sin(t*.33)*.10,y+.1-t*.009,z-.4-t*.18);
        stem(granite,big?"#85795e":"#ab9d7e",prev,next,.09*(1-t/9));
        prev=next;
      }
    }
  }
  finish(granite, "desert-granite");
  // Desert is divided into chunks so distant detail does not pop as one biome root.
  for (let row = 0; row < 3; row++) {
    const b = new GeometryBatch(),
      center = { x: 43, z: -49 + row * 20 };
    for (let i = 0; i < 90; i++) {
      const x = 24 + random() * 32,
        z = center.z - 10 + random() * 20,
        p = { x, z },
        sample = biomeAt(p);
      if (
        clear(p) ||
        random() > sample.weights.desert * (1 - smooth(0.5, 1.3, sample.slope)) * 0.9 ||
        DESERT_FORMATIONS.some((f) => distance(p, f) < f.sx + 1)
      )
        continue;
      const y = terrainHeight(x, z),
        upper = z < -22;
      if (upper && i % 2 === 0) {
        const h = 2.5 + random() * 2;
        stem(b, "#847666", V(x, y, z), V(x, y + h, z), 0.19);
        // Bark ribs on irregular branching trunks, blue-green spiky crowns.
        for(let rib=0;rib<5;rib++){
          const a=rib*2.4+i*.31;
          stem(b,rib%2?"#6c6255":"#998775",
            V(x+Math.cos(a)*.17,y+.3,z+Math.sin(a)*.17),
            V(x+Math.cos(a)*.17,y+h*.74,z+Math.sin(a)*.17),.018);
        }
        const arms = 2 + (Math.floor(i / 3) + row) % 3; // Juvenile through sparse multi-arm crowns.
        for (let a = 0; a < arms; a++) {
          const angle = a * 2.3 + i,
            reach = arms === 0 ? 0 : 0.65 + random() * 0.6,
            end = V(
              x + Math.cos(angle) * reach,
              y + h + 0.5 + random(),
              z + Math.sin(angle) * reach,
            );
          stem(b, a%2===0?"#837565":"#93816c", V(x, y + h * 0.65, z), end, 0.13);
          for (let j = 0; j < 16; j++) {
            const theta = j * 2.4;
            add(
              b,
              leaf,
              j%3===0?"#a2a783":j%3===1?"#667c70":"#85967b",
              end.x + Math.cos(theta) * 0.2,
              end.y,
              end.z + Math.sin(theta) * 0.2,
              0.075,
              0.87,
              0.07,
              Math.cos(theta) * 0.7,
              theta,
              Math.sin(theta) * 0.7,
            );
          }
          add(
            b,
            leaf,
            "#a39a7d",
            end.x,
            end.y - 0.28,
            end.z,
            0.3,
            0.45,
            0.3,
            Math.PI,
          );
        }
        obstacles.push({ x, z, radius: 0.2 });
      } else if (upper && sample.elevation > 6 && i % 4 === 1) {
        // Sparse dry woodland softens the climb from Joshua basin to alpine talus.
        const h = 1.6 + random() * 1.4;
        stem(b, "#716356", V(x, y, z), V(x, y + h, z), 0.12);
        for (let j = 0; j < 3; j++) {
          const a = j * 2.4;
          const end = V(x + Math.cos(a) * 0.55, y + h * (0.6 + j * 0.15), z + Math.sin(a) * 0.55);
          stem(b, "#716356", V(x, y + h * 0.4, z), end, 0.07);
          add(b, sphere, "#68735a", end.x, end.y, end.z, 0.6, 0.65, 0.5);
        }
        obstacles.push({ x, z, radius: 0.15 });
      } else if (!upper && i % 9 === 2) {
        // A few ribbed barrel cacti share the plant batch and leave the wash open.
        add(b, sphere, "#8e9574", x, y + 0.3, z, 0.25, 0.36, 0.25);
        for (let j = 0; j < 7; j++) {
          const a = j * Math.PI * 2 / 7;
          add(b, sphere, "#aeb394", x + Math.cos(a) * 0.19, y + 0.3, z + Math.sin(a) * 0.19, 0.075, 0.32, 0.075);
        }
      } else if (!upper && i % 4 === 0) {
        for (let j = 0; j < 6; j++) {
          const a = j * 2.4;
          stem(
            b,
            "#7c705e",
            V(x, y, z),
            V(
              x + Math.cos(a) * 0.55,
              y + 1.8 + random(),
              z + Math.sin(a) * 0.55,
            ),
            0.035,
          );
        }
      } else if (!upper && i % 4 === 1) {
        stem(b, "#8e9574", V(x, y, z), V(x, y + 1.1, z), 0.12);
        for (let j = 0; j < 4; j++) {
          const a = j * 1.7;
          stem(
            b,
            "#aeb394",
            V(x, y + 0.5, z),
            V(
              x + Math.cos(a) * 0.5,
              y + 0.9 + random() * 0.5,
              z + Math.sin(a) * 0.5,
            ),
            0.12,
          );
        }
      } else {
        for (let j = 0; j < 4; j++) {
          const a = j * 2.3;
          stem(
            b,
            "#716356",
            V(x, y, z),
            V(x + Math.cos(a) * 0.35, y + 0.4, z + Math.sin(a) * 0.35),
            0.025,
          );
          add(
            b,
            sphere,
            "#858666",
            x + Math.cos(a) * 0.35,
            y + 0.4,
            z + Math.sin(a) * 0.35,
            0.24,
            0.17,
            0.22,
          );
        }
      }
    }
    finish(b, `desert-plants-${row}`);
  }
  // Ecotones cover unoccupied foothills and valley interiors without making
  // forests, the arid bike loop or alpine slopes look uniformly planted.
  // Six narrow strips keep spatial bounds and frustum culling predictable.
  for (let row = 0; row < 6; row++) {
    const b = new GeometryBatch();
    for (let i = 0; i < 240; i++) {
      const x = -29 + random() * 85;
      const z = -59 + row * 18 + random() * 18;
      const p = { x, z };
      const sample = biomeAt(p);
      const patch = 0.7 + 0.3 * Math.sin(x * 0.23 + z * 0.18) ** 2;
      if (clear(p) || random() > understoryDensityAt(p) * patch) continue;
      const y = terrainHeight(x, z), h = 0.25 + random() * 0.72;
      const count = 3 + Math.floor(random() * 3);
      for (let j = 0; j < count; j++) {
        const a = j * 2.399 + i;
        const scrub = sample.weights["coastal-scrub"] > 0.35;
        const lx = x + Math.cos(a) * 0.24, lz = z + Math.sin(a) * 0.24;
        add(b, blade, scrub
            ? (j % 2 ? "#7e8762" : "#87916b")
            : (j % 2 ? "#62845d" : "#769168"),
          lx, terrainHeight(lx, lz) + 0.035, lz,
          0.19 + random() * 0.14, h, 0.15, 0.55, a, 0);
      }
    }
    finish(b, `scrub-ecotone-${row}`);
  }
  const canopyPerches: { x: number; z: number; y: number }[] = [];
  // Layered redwood understory and tropical canopy. Rainforest gets three
  // overlapping spatial bands so canopy continuity survives long walks without
  // turning the whole biome into one giant geometry batch.
  for (const region of ["redwood", "rainforest"] as const) {
    const rows = region === "rainforest" ? 3 : 2;
    for (let row = 0; row < rows; row++) {
      const b = new GeometryBatch(),
        center =
          region === "redwood"
            ? { x: -5, z: row * 22 }
            : { x: 44, z: 14 + row * 16 };
      const candidates = region === "rainforest" ? 88 : 60;
      for (let i = 0; i < candidates; i++) {
        const x = center.x + (random() - 0.5) * 27,
          z = center.z + (random() - 0.5) * 23,
          p = { x, z };
        const sample = biomeAt(p);
        const suitability = region === "rainforest"
          ? Math.min(
              1,
              sample.weights.rainforest *
                (0.9 + 0.35 * sample.moisture) *
                (0.55 + 0.45 * sample.substrate.soil) *
                (1 - smooth(1.0, 2.2, sample.slope)),
            )
          : sample.weights.redwood *
            (0.65 + 0.35 * sample.moisture) *
            (0.3 + 0.7 * sample.substrate.soil) *
            (1 - smooth(0.65, 1.5, sample.slope));
        if (clear(p) || random() > suitability) continue;
        const y = terrainHeight(x, z);
        // Intermittent heliconia / bromeliad colors enrich only the tropical
        // understory. Use actual leaf geometry rather than oversized balloons.
        if (region === "rainforest" && i % 11 === 0) {
          const h = 1.1 + random() * 0.8;
          stem(b, "#486647", V(x, y, z), V(x, y + h, z), 0.045);
          for (let k = 0; k < 5; k++) {
            const a = k * 2.399 + i;
            add(b, blade, k % 2 ? "#4f864d" : "#72965a", x, y + h * 0.32, z,
              0.55, 1.1, 0.28, Math.PI * 0.36, a, 0);
          }
          for (let k = 0; k < 3; k++) {
            const a = k * 2.094;
            add(b, leaf, k === 2 ? "#f5a34c" : "#d8504e",
              x + Math.cos(a) * 0.14, y + h + k * 0.11,
              z + Math.sin(a) * 0.14, 0.20, 0.39, 0.17,
              Math.sin(a) * 0.22, a, Math.cos(a) * 0.22);
          }
        }
        if(region==="rainforest" && i%13===2){
          // Occasional orchid and bromeliad clusters provide small pockets of
          // magenta/yellow rather than uniformly saturated giant flower props.
          const h=.6+random()*.5;
          stem(b,"#58764e",V(x,y,z),V(x,y+h,z),.035);
          for(let j=0;j<5;j++){
            const theta=j*Math.PI*2/5;
            add(b,leaf,j%2?"#b35e9b":"#de8dba",
              x+Math.cos(theta)*.12,y+h+j*.035,z+Math.sin(theta)*.12,
              .16,.32,.13,0,theta);
          }
          add(b,sphere,"#f2c56a",x,y+h+.17,z,.085,.11,.08);
        }
        // Leaf litter follows the actual ground and shares the existing plant batch.
        if (region === "redwood") {
          // Redwood duff: fallen needles and tiny twig fragments lie ON the
          // sampled forest floor, rather than suspended canopy geometry.
          for(let j=0;j<9;j++){
            const angle=i*1.7+j*2.4;
            const lx=x+Math.cos(angle)*(.25+(j%3)*.28);
            const lz=z+Math.sin(angle)*(.25+(j%3)*.28);
            add(b,blade,j%3?"#806c50":"#967653",
              lx,terrainHeight(lx,lz)+.038,lz,.045,.26+(j%2)*.11,.035,
              Math.PI*.49,angle,0);
          }
        }
        if (region === "rainforest")
          for (let j = 0; j < 3; j++) {
            const lx = x + Math.cos(j * 2.4 + i) * 0.55, lz = z + Math.sin(j * 2.4 + i) * 0.55;
            add(b, blade, j % 2 ? "#77684d" : "#655c42", lx, terrainHeight(lx, lz) + 0.035, lz,
              0.2, 0.5, 0.2, Math.PI / 2, 0, j + i);
          }
        if (region === "rainforest" && i % 7 === 0) {
          const h = 4 + random() * 3;
          stem(b, "#827456", V(x, y, z), V(x + 0.4, y + h, z), 0.18);
          for (let j = 0; j < 7; j++) {
            const a = (j * Math.PI * 2) / 7;
            add(
              b,
              blade,
              "#5a7944",
              x + 0.4,
              y + h,
              z,
              0.85,
              2.6,
              0.8,
              Math.cos(a) * 1.3,
              a,
              Math.sin(a) * 1.3,
            );
          }
          obstacles.push({ x, z, radius: 0.22 });
        } else if (region === "rainforest" && i % 4 === 0) {
          const h = 10 + random() * 8;
          canopyPerches.push({ x, z, y: y + h - 1.6 });
          stem(b, "#756954", V(x, y, z), V(x, y + h, z), 0.42);
          // Fauna perches connect to this actual trunk, below its crown.
          stem(b, "#756954", V(x, y + h - 1.6, z), V(x + 2.3, y + h - 1.6, z), 0.13);
          // Single compact camera proxy for this authored crown cluster.
          // The merged vegetation draw call is not raycast every frame.
          cameraOccluders.push({x,y:y+h-.3,z,rx:5.6,ry:2.6,rz:5.6});
          for (let j = 0; j < 6; j++) {
            const a = j * Math.PI / 3;
            stem(
              b,
              "#756954",
              V(x + Math.cos(a), y, z + Math.sin(a)),
              V(x, y + 1.4, z),
              0.15,
            );
            add(
              b,
              sphere,
              j % 2 ? "#547347" : "#436340",
              x + Math.cos(a) * 1.9,
              y + h - 0.2 + Math.sin(a * 2) * 0.35,
              z + Math.sin(a) * 1.9,
              3.0,
              1.55,
              2.9,
            );
            // Every prominent leaf belongs to a real branch tip, not a
            // freestanding shape several metres above the ground.
            const tip=V(x+Math.cos(a)*2.1,y+h+.25,z+Math.sin(a)*2.1);
            stem(b,"#596b45",V(x,y+h-.2,z),tip,.055);
            for(const tilt of [-.18,.18])
              add(b,blade,j%2?"#5d854d":"#477340",
                tip.x,tip.y,tip.z,1.0,2.45,.75,
                Math.PI*(.28+tilt),a,tilt);
          }
          stem(
            b,
            "#536243",
            V(x + 1, y + h - 1, z),
            V(x + 0.8, y + 1, z + 0.6),
            0.04,
          );
          // Lianas are anchored to this trunk and over a real branch. They
          // hang down toward the understory without crossing the ground.
          if(i%8===0){
            const top=V(x+1.5,y+h-1.55,z);
            stem(b,"#4d6943",V(x,y+h-1.6,z),top,.07);
            let previous=top;
            for(let k=1;k<=9;k++){
              const t=k/9;
              const v=V(x+1.5+Math.sin(t*4.2+i)*.28,
                y+h-1.55-t*Math.min(5,h*.44),
                z+Math.sin(t*3.1+i)*.26);
              stem(b,"#527445",previous,v,.045*(1-t*.25));
              if(k%3===0)add(b,blade,"#66894f",
                v.x,v.y,v.z,.24,.65,.22,.4,i+t,0);
              previous=v;
            }
          }
          // Small epiphyte rosettes attach to the trunk, never float beside it.
          for (let j = 0; j < 5; j++) {
            const a = j * 2.4;
            add(b, blade, "#6b8054", x + 0.22, y + h * 0.42, z,
              0.2, 0.65, 0.2, Math.cos(a) * 0.8, a, Math.sin(a) * 0.8);
          }
          obstacles.push({ x, z, radius: 0.42 });
        } else if (region === "rainforest" && i % 3 === 0) {
          // Broad-leaf midstory gives the forest a second silhouette beneath the canopy.
          const h = 0.8 + random() * 1.2;
          stem(b, "#697054", V(x, y, z), V(x, y + h, z), 0.035);
          for (let j = 0; j < 5; j++) {
            const a = j * 2.4 + i;
            add(b, blade, j % 2 ? "#436340" : "#63874b",
              x, y + h * (0.5 + j * 0.1), z, 1.05, 1.8, 1.0,
              Math.PI * 0.35, a, 0.25);
          }
        } else {
          const size = 0.4 + random() * 0.6;
          for (let j = 0; j < 4; j++) {
            const a = (j * Math.PI * 2) / 4;
            const tip = V(
              x + Math.cos(a) * size,
              y + size * 0.35,
              z + Math.sin(a) * size,
            );
            stem(b, "#567343", V(x, y + 0.05, z), tip, 0.013);
            for (let k = 1; k < 4; k++) {
              const f = k / 4;
              for (const side of [-1, 1])
                add(
                  b,
                  blade,
                  region === "redwood" ? "#51734b" : "#63874b",
                  x + Math.cos(a) * size * f,
                  y + size * 0.35 * f,
                  z + Math.sin(a) * size * f,
                  0.16 * (1 - f * 0.6),
                  0.28 * (1 - f * 0.4),
                  0.2,
                  0.9,
                  a + side * 0.6,
                  side * 0.7,
                );
            }
          }
          if (region === "redwood" && i % 8 === 0)
            add(b, sphere, "#c6b04d", x + 0.4, y + 0.09, z, 0.07, 0.07, 0.23);
        }
      }
      finish(b, `${region}-plants-${row}`);
    }
  }
  // Representative California companions to coast redwoods. Every trunk
  // starts on the sampled terrain; branch-supported crowns distinguish live
  // oak, tanoak, madrone and Douglas-fir instead of cloning the same cone.
  const natives=new GeometryBatch();
  // A few hand-composed California tree locations can all be disqualified
  // as neighboring disc-golf fairways and skate features evolve. Deterministic
  // spare candidates guarantee the redwood woodland is still represented,
  // without ever planting a trunk on a protected sport route.
  const species=["oak","tanoak","madrone","fir"] as const;
  const nativeLocations=[
   {x:-18,z:10,kind:"oak"},{x:-12,z:16,kind:"tanoak"},
   {x:-6,z:29,kind:"madrone"},{x:4,z:19,kind:"fir"},
   {x:-19,z:31,kind:"oak"},{x:6,z:-4,kind:"fir"},
   {x:-2,z:34,kind:"tanoak"},{x:-20,z:1,kind:"madrone"},
   ...Array.from({length:128},(_,i)=>({
    x:-17+(i*13)%32,
    z:-24+(i*19)%49,
    kind:species[i%species.length],
   })),
  ] as const;
  const nativePlaced:Point[]=[];
  for(const [index,t] of nativeLocations.entries()){
    if(nativePlaced.length>=8)break;
    const p={x:t.x,z:t.z};
    if(isWater(p)||clear(p)||discGolfCourseClearance(p,1.6)||
      biomeAt(p).weights.redwood<.18||
      nativePlaced.some(other=>distance(p,other)<5.5))continue;
    nativePlaced.push(p);
    const y=terrainHeight(t.x,t.z),h=t.kind==="fir"?11.5:6.5+index%3;
    const bark=t.kind==="madrone"?"#9a624b":
      t.kind==="oak"?"#665a48":"#6d5945";
    stem(natives,bark,V(t.x,y,t.z),V(t.x,y+h*.85,t.z),t.kind==="fir"?.28:.36);
    if(t.kind==="fir"){
      cameraOccluders.push({x:t.x,y:y+h*.69,z:t.z,rx:3.4,ry:h*.43,rz:3.4});
      for(let level=0;level<6;level++){
        const height=y+h*(.34+level*.105),reach=2.7-level*.32;
        for(let j=0;j<5;j++){
          const a=j*Math.PI*2/5+index*.2;
          const end=V(t.x+Math.cos(a)*reach,height-.25,t.z+Math.sin(a)*reach);
          stem(natives,"#675d4c",V(t.x,height,t.z),end,.075);
          add(natives,leaf,level%2?"#456c58":"#56775e",
            end.x,end.y+.65,end.z,.7,1.65,.7,0,a,0);
        }
      }
    }else{
      cameraOccluders.push({x:t.x,y:y+h*.70,z:t.z,rx:3.7,ry:h*.25,rz:3.7});
      for(let j=0;j<7;j++){
        const a=j*2.399+index*.36;
        const reach=1.4+(j%3)*.43;
        const end=V(t.x+Math.cos(a)*reach,y+h*(.63+(j%2)*.1),
          t.z+Math.sin(a)*reach);
        stem(natives,bark,V(t.x,y+h*.49,t.z),end,.1);
        const foliage=t.kind==="oak"?"#506b50":
          t.kind==="madrone"?"#43715a":"#6a7f53";
        add(natives,sphere,foliage,end.x,end.y+.32,end.z,
          1.15,.87,1.05);
      }
    }
    obstacles.push({x:t.x,z:t.z,radius:.38});
  }
  finish(natives,"california-native-trees");

  // Local coastal-rainforest weather is geographically confined. A soft,
  // small cloudbank is high above the canopy, while rain streaks descend only
  // in this biome. One batched mesh and one line draw call, no global storm.
  const weather=new GeometryBatch();
  const rainVertices:number[]=[];
  for(let cluster=0;cluster<4;cluster++){
    const x=38+(cluster%2)*9,z=25+Math.floor(cluster/2)*14;
    const centerY=terrainHeight(x,z)+23;
    for(let puff=0;puff<5;puff++){
      const a=puff*2.399+cluster;
      add(weather,sphere,puff%2?"#bbc8c8":"#d1d6d2",
        x+Math.cos(a)*2.6,centerY+Math.sin(a)*.55,
        z+Math.sin(a)*2.4,3.1,1.05,2.8);
    }
    for(let n=0;n<55;n++){
      const px=x+(random()-.5)*13,pz=z+(random()-.5)*13;
      const p={x:px,z:pz};
      if(isWater(p)||biomeAt(p).weights.rainforest<.42)continue;
      const base=terrainHeight(px,pz);
      const top=base+4+random()*14;
      rainVertices.push(px,top,pz,px-.09,top-.65-random()*.4,pz+.06);
    }
  }
  finish(weather,"rainforest-cloud-bank");
  const rainGeometry=new THREE.BufferGeometry();
  rainGeometry.setAttribute("position",
    new THREE.Float32BufferAttribute(rainVertices,3));
  rainGeometry.computeBoundingSphere();
  const rainMaterial=new THREE.LineBasicMaterial({
    color:"#bfd3d7",transparent:true,opacity:.38,depthWrite:false,
  });
  const rain=new THREE.LineSegments(rainGeometry,rainMaterial);
  rain.name="rainforest-local-rain";
  scene.add(rain);
  // Low-count canopy silhouettes: articulated limbs and branch attachment, no expensive rigs.
  const animals = new GeometryBatch();
  // One restrained white-faced monkey. The photographic sloth encounter
  // below replaces the earlier duplicate, round-bodied generic sloth.
  const monkeyPerch=canopyPerches[1];
  if(monkeyPerch) {
    const x=monkeyPerch.x+1,z=monkeyPerch.z,y=monkeyPerch.y+0.4;
    add(animals,sphere,"#574b3d",x,y,z,.24,.36,.23);
    add(animals,sphere,"#d0c6a6",x,y+.38,z+.06,.22,.22,.20);
    add(animals,sphere,"#b5a587",x,y+.31,z+.22,.13,.10,.10);
    for(const side of [-1,1]){
      stem(animals,"#574b3d",V(x+side*.15,y+.12,z),
        V(x+side*.3,monkeyPerch.y+.06,z),.055);
      stem(animals,"#574b3d",V(x+side*.14,y-.20,z),
        V(x+side*.2,monkeyPerch.y+.03,z+.15),.065);
    }
    let previous=V(x,y-.2,z-.17);
    for(let k=1;k<=8;k++){
      const t=k/8,to=V(x+Math.sin(t*2.7)*.65,
        y-.2-t*.7,z-.17-t*.5);
      stem(animals,"#574b3d",previous,to,.055*(1-t*.5));previous=to;
    }
  }
  for (const [x, z] of [
    [42, 31],
    [48, 39],
  ]) {
    if (clear({ x, z }) || biomeAt({ x, z }).weights.rainforest < 0.35) continue;
    const y = terrainHeight(x, z) + 0.12;
    add(animals, sphere, "#628444", x, y, z, 0.2, 0.12, 0.22);
    add(animals, sphere, "#799255", x, y + 0.1, z + 0.12, 0.16, 0.1, 0.13);
    for (const side of [-1, 1]) {
      add(
        animals,
        sphere,
        "#486e3e",
        x + side * 0.19,
        y - 0.02,
        z - 0.1,
        0.12,
        0.08,
        0.2,
      );
      add(
        animals,
        sphere,
        "#202b20",
        x + side * 0.09,
        y + 0.18,
        z + 0.19,
        0.028,
        0.03,
        0.028,
      );
    }
  }
  // Authored wildlife lives on actual branch forks. The previous lone toucan
  // was almost indistinguishable from a dark blob at walking distance.
  // Five restrained hero perches give the biome a clear sloth/bird silhouette.
  for (const [i, wildlife] of RAINFOREST_CANOPY_WILDLIFE.entries()) {
    const { x, z } = wildlife.point;
    const weight = biomeAt({ x, z }).weights.rainforest;
    if (weight < 0.30) continue;
    const ground = terrainHeight(x, z);
    const by = ground + wildlife.height;
    const bx = x + 1.35, bz = z + 0.35;
    stem(animals, "#6d6250", V(x, ground, z), V(x, by + 0.65, z), 0.21);
    stem(animals, "#6d6250", V(x, by - 0.55, z), V(bx + 0.25, by, bz), 0.12);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2;
      add(animals, sphere, k % 2 ? "#386b45" : "#4e7b46",
        x + Math.cos(a) * 1.1, by + 1.15, z + Math.sin(a) * 1.1,
        1.35, 0.69, 1.13);
    }
    if (wildlife.kind === "macaw") {
      const scarlet = i === 1;
      const body = scarlet ? "#c53e38" : "#d9af46";
      const wing = scarlet ? "#285ca5" : "#2869ad";
      // Head/white cheek patch, coupled wings, long tapered tail and hooked beak.
      add(animals, sphere, body, bx, by + 0.40, bz, 0.27, 0.42, 0.30);
      add(animals, sphere, body, bx, by + 0.81, bz + 0.10, 0.23, 0.23, 0.23);
      add(animals, sphere, "#f0e4c8", bx, by + 0.83, bz + 0.29, 0.15, 0.12, 0.042);
      add(animals, sphere, "#292b24", bx, by + 0.72, bz + 0.34, 0.105, 0.09, 0.12);
      for (const side of [-1, 1]) {
        add(animals, leaf, wing, bx + side * 0.25, by + 0.35, bz - 0.08,
          0.15, 0.62, 0.19, side * 0.25, 0, side * 0.12);
        add(animals, sphere, "#1d211d", bx + side * 0.105, by + 0.90, bz + 0.31, 0.020, 0.025, 0.017);
        stem(animals, "#3a3329", V(bx + side * 0.09, by + 0.12, bz),
          V(bx + side * 0.09, by - 0.08, bz + 0.09), 0.028);
        stem(animals, wing, V(bx + side * 0.08, by + 0.10, bz - 0.21),
          V(bx + side * 0.16, by - 0.73, bz - 0.6), 0.065);
      }
      add(animals, sphere, scarlet ? "#e1ad49" : "#379e77",
        bx, by + 0.40, bz + 0.24, 0.19, 0.21, 0.10);
    } else if (wildlife.kind === "toucan") {
      add(animals, sphere, "#292d2a", bx, by + 0.33, bz, 0.25, 0.36, 0.24);
      add(animals, sphere, "#232c28", bx, by + 0.70, bz + 0.06, 0.21, 0.24, 0.20);
      add(animals, sphere, "#e6d5ab", bx, by + 0.45, bz + 0.22, 0.16, 0.28, 0.11);
      // Oversized colorful beak is the defining toucan silhouette.
      add(animals, leaf, "#e7a83f", bx, by + 0.62, bz + 0.46,
        0.18, 0.31, 0.65, Math.PI * 0.5, 0, 0);
      add(animals, sphere, "#da5834", bx, by + 0.52, bz + 0.74, 0.085, 0.10, 0.18);
      for (const side of [-1, 1]) {
        add(animals, sphere, "#72a5a1", bx + side * 0.15, by + 0.78, bz + 0.18,
          0.045, 0.052, 0.03);
        add(animals, sphere, "#151a18", bx + side * 0.15, by + 0.78, bz + 0.206,
          0.018, 0.025, 0.016);
      }
    } else if(wildlife.kind==="parrot") {
      const body=i===5?"#3d9a65":"#709f4b";
      add(animals,sphere,body,bx,by+.31,bz,.22,.32,.24);
      add(animals,sphere,i===5?"#57b879":"#e0b651",
        bx,by+.66,bz+.08,.20,.20,.20);
      add(animals,leaf,"#d4a35a",bx,by+.59,bz+.28,
        .09,.14,.21,Math.PI/2);
      for(const side of [-1,1]){
        add(animals,leaf,side===1?"#287b68":"#416d90",
          bx+side*.20,by+.28,bz-.13,.17,.43,.18,side*.24,0);
        add(animals,sphere,"#202c27",bx+side*.13,
          by+.76,bz+.23,.022,.024,.018);
        stem(animals,"#3f5141",V(bx+side*.08,by+.12,bz-.1),
          V(bx+side*.11,by-.45,bz-.40),.035);
      }
    } else {
      // One photo-informed sloth clings sideways to a lichen-covered trunk.
      // No nonexistent archive image ID is minted for this encounter.
      const sy=by-0.64;
      // Inclined elongated torso, pale cheeks, charcoal eye mask and long
      // gray-beige rough fur follow the actual supplied photograph.
      add(animals,sphere,"#a8a28d",bx-.16,sy,bz,.36,.63,.33,0,0,-.31);
      add(animals,sphere,"#c9bea3",bx+.10,sy+.32,bz+.28,.27,.24,.19);
      add(animals,sphere,"#5c554d",bx+.14,sy+.30,bz+.43,.16,.12,.045);
      add(animals,sphere,"#302b29",bx+.18,sy+.27,bz+.478,.045,.041,.028);
      for(let hair=0;hair<13;hair++){
        const a=hair*2.4,length=.17+(hair%4)*.06;
        const start=V(bx-.16+Math.cos(a)*.25,
          sy-.30+(hair%5)*.16,bz+Math.sin(a)*.25);
        stem(animals,hair%2?"#b1aa95":"#c4bba5",start,
          V(start.x+.04,start.y-length,start.z+.04),.014);
      }
      // Signature extended front arm reaches high around the trunk.
      stem(animals,"#a7a08b",V(bx+.06,sy+.30,bz),
        V(x+.50,by+.15,z+.05),.105);
      stem(animals,"#b4ac97",V(x+.50,by+.15,z+.05),
        V(x+.12,by+.65,z-.05),.081);
      for (const side of [-1, 1]) {
        for (const front of [-1, 1]) {
          const elbow = V(bx + side * 0.39, sy + front * 0.15, bz + front * 0.14);
          stem(animals, "#827762", V(bx + side * 0.2, sy, bz), elbow, 0.067);
          stem(animals, "#827762", elbow, V(bx + side * 0.43, by + 0.06, bz), 0.052);
        }
        add(animals, sphere, "#675a48", bx + side * 0.115, sy + 0.24,
          bz + 0.426, 0.067, 0.085, 0.024);
      }
    }
  }
  // Small yellow/green eyelash vipers and thick-bodied boas rest on explicit
  // support limbs. Not a source of combat or movement collision. No anaconda
  // is mislabeled as native to Manuel Antonio.
  for(const reptile of RAINFOREST_REPTILES){
    const {x,z}=reptile.point;
    if(biomeAt(reptile.point).weights.rainforest<.30)continue;
    const y=terrainHeight(x,z)+reptile.height;
    // Authored reptiles must rest on a supported branch. The previous small
    // isolated limb started mid-air and gave the illusion of floating snakes.
    stem(animals,"#665b49",V(x,terrainHeight(x,z),z),V(x,y+.28,z),.24);
    stem(animals,"#665b49",V(x-.75,y+.10,z),V(x+1.75,y+.10,z),.20);
    stem(animals,"#665b49",V(x,y-.85,z),V(x+.88,y+.10,z),.14);
    const heavy=reptile.kind==="boa"||reptile.kind==="anaconda";
    const radius=reptile.kind==="anaconda"?.98:heavy?.72:.42;
    let prev=V(x+.42+radius,y+.18,z);
    const segments=reptile.kind==="anaconda"?30:heavy?22:14;
    for(let j=1;j<=segments;j++){
      const t=j/segments,a=t*Math.PI*(heavy?3.6:2.7);
      const next=V(x+.42+Math.cos(a)*radius*(1-t*.2),
        y+.18+Math.sin(t*Math.PI)*.10,
        z+Math.sin(a)*radius*.5);
      stem(animals,heavy&&j%4===0?"#5d5947":reptile.color,
        prev,next,heavy?(reptile.kind==="anaconda"?.16:.09)*(1-t*.35):.047*(1-t*.35));
      prev=next;
    }
    add(animals,sphere,reptile.color,prev.x,prev.y,prev.z,
      heavy?.15:.09,.07,heavy?.19:.14);
    for(const side of [-1,1])
      add(animals,sphere,"#292b25",prev.x+side*.06,
        prev.y+.026,prev.z+.10,.017,.017,.014);
    if(reptile.kind==="eyelash-viper")for(const side of [-1,1])
      stem(animals,reptile.color,V(prev.x+side*.065,prev.y+.07,prev.z+.08),
        V(prev.x+side*.079,prev.y+.18,prev.z+.11),.022);
  }
  finish(animals, "rainforest-canopy-fauna");
  sphere.dispose();
  branch.dispose();
  leaf.dispose();
  blade.dispose();
  return {
    cameraOccluders:cameraOccluders as readonly CameraVolume[],
    update(_camera: Point, elapsed=0) {
      // Subtle falling motion independent of FPS, contained within the wet
      // region and using no per-frame buffer mutations or allocations.
      rain.position.y=-((elapsed*1.85)%1.8);
      // These are already a handful of large static batches. Let Three.js frustum
      // culling handle them instead of toggling entire biome chunks at a short
      // distance threshold, which caused rainforest rows to visibly disappear.
      for (const r of roots) r.mesh.visible = true;
    },
    dispose() {
      for (const m of meshes) scene.remove(m);
      scene.remove(rain);
      rainGeometry.dispose();rainMaterial.dispose();
      resources.forEach((g) => g.dispose());
      material.dispose();
    },
  };
}
