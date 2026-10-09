import * as THREE from "three/src/Three.Core.js";
import { GeometryBatch } from "./worldGeometry";
import { biomeAt, DESERT_FORMATIONS, smooth } from "@/lib/world/biomes";
import { BOULDER_HOLDS, sportClearance } from "@/lib/world/activities";
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
    inDryWash(p) ||
    BOULDER_HOLDS.some((h) => distance(p, h) < h.radius + 2) ||
    sportClearance(p) ||
    REGIONS.some((r) => distance(p, r.point) < 3) ||
    MEMORY_POINTS.some((r) => distance(p, r.point) < 2.5) ||
    isWater(p);
  // Granite forms: rounded joint blocks, coherent burial and a readable open slot.
  const granite = new GeometryBatch();
  for (const f of DESERT_FORMATIONS) {
    const y = terrainHeight(f.x, f.z);
    if (f.id === "balanced") {
      add(granite, sphere, "#a58c79", f.x, y + 1.2, f.z, 1.1, 1.7, 1);
      add(granite, sphere, "#c4a795", f.x + 0.2, y + 3.7, f.z, 2.3, 1.6, 1.6);
    } else
      for (let i = 0; i < (f.id === "joints" ? 6 : 3); i++) {
        const dx = ((i % 3) - 1) * f.sx * 0.55,
          dz = Math.floor(i / 3) * f.sz * 0.5;
        add(
          granite,
          sphere,
          i % 2 ? "#bbaa91" : "#c4b299",
          f.x + dx,
          y + f.sy * 0.28 + (i > 2 ? 2.5 : 0),
          f.z + dz,
          f.sx * 0.7,
          f.sy * 0.7,
          f.sz * 0.65,
          0,
          0.1 * i,
        );
      }
    obstacles.push({ x: f.x, z: f.z, radius: Math.min(f.sx, f.sz) * 0.8 });
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
  finish(granite, "desert-granite");
  // Desert is divided into chunks so distant detail does not pop as one biome root.
  for (let row = 0; row < 3; row++) {
    const b = new GeometryBatch(),
      center = { x: 43, z: -49 + row * 20 };
    for (let i = 0; i < 45; i++) {
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
      if (upper && i % 3 === 0) {
        const h = 2.5 + random() * 2;
        stem(b, "#716356", V(x, y, z), V(x, y + h, z), 0.19);
        const arms = (Math.floor(i / 3) + row) % 5; // Juvenile through sparse multi-arm crowns.
        for (let a = 0; a < Math.max(1, arms); a++) {
          const angle = a * 2.3 + i,
            reach = arms === 0 ? 0 : 0.65 + random() * 0.6,
            end = V(
              x + Math.cos(angle) * reach,
              y + h + 0.5 + random(),
              z + Math.sin(angle) * reach,
            );
          stem(b, "#716356", V(x, y + h * 0.65, z), end, 0.13);
          for (let j = 0; j < 16; j++) {
            const theta = j * 2.4;
            add(
              b,
              leaf,
              j % 2 ? "#68735a" : "#8c9270",
              end.x + Math.cos(theta) * 0.2,
              end.y,
              end.z + Math.sin(theta) * 0.2,
              0.085,
              0.7,
              0.06,
              Math.cos(theta) * 0.7,
              theta,
              Math.sin(theta) * 0.7,
            );
          }
          add(
            b,
            leaf,
            "#9c896a",
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
  const canopyPerches: { x: number; z: number; y: number }[] = [];
  // Layered redwood understory and tropical canopy, each split into compact chunks.
  for (const region of ["redwood", "rainforest"] as const)
    for (let row = 0; row < 2; row++) {
      const b = new GeometryBatch(),
        center =
          region === "redwood"
            ? { x: -5, z: row * 22 }
            : { x: 43, z: 18 + row * 20 };
      for (let i = 0; i < 60; i++) {
        const x = center.x + (random() - 0.5) * 27,
          z = center.z + (random() - 0.5) * 23,
          p = { x, z };
        const sample = biomeAt(p);
        const suitability = sample.weights[region] * (0.65 + 0.35 * sample.moisture)
          * (0.3 + 0.7 * sample.substrate.soil) * (1 - smooth(0.65, 1.5, sample.slope));
        if (clear(p) || random() > suitability) continue;
        const y = terrainHeight(x, z);
        // Leaf litter follows the actual ground and shares the existing plant batch.
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
        } else if (region === "rainforest" && i % 5 === 0) {
          const h = 7 + random() * 6;
          canopyPerches.push({ x, z, y: y + h - 1.4 });
          stem(b, "#756954", V(x, y, z), V(x, y + h, z), 0.35);
          // Fauna perches connect to this actual trunk, below its crown.
          stem(b, "#756954", V(x, y + h - 1.4, z), V(x + 2, y + h - 1.4, z), 0.12);
          for (let j = 0; j < 4; j++) {
            const a = j * 1.57;
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
              x + Math.cos(a) * 1.5,
              y + h,
              z + Math.sin(a) * 1.5,
              2.5,
              1.25,
              2.4,
            );
          }
          stem(
            b,
            "#536243",
            V(x + 1, y + h - 1, z),
            V(x + 0.8, y + 1, z + 0.6),
            0.04,
          );
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
              x, y + h * (0.5 + j * 0.1), z, 0.8, 1.3, 0.8,
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
  // Low-count canopy silhouettes: articulated limbs and branch attachment, no expensive rigs.
  const animals = new GeometryBatch();
  for (const [i, perch] of canopyPerches.slice(0, 2).entries()) {
    const { z } = perch, x = perch.x + 1;
    if (i === 0) {
      // Sloth hangs below the branch: compact trunk, long hooked limbs, short face.
      const y = perch.y - 0.6;
      add(animals, sphere, "#a2987b", x, y, z, 0.36, 0.38, 0.27);
      add(animals, sphere, "#c0b99f", x + 0.3, y + 0.08, z + 0.1, 0.23, 0.21, 0.2);
      for (const side of [-1, 1]) {
        for (const front of [-1, 1]) {
          const knee = V(x + side * 0.42, y + 0.2, z + front * 0.22);
          stem(animals, "#8e856c", V(x + side * 0.2, y, z + front * 0.12), knee, 0.065);
          stem(animals, "#8e856c", knee, V(x + side * 0.55, perch.y + 0.05, z), 0.055);
        }
        add(animals, sphere, "#675c4b", x + 0.34 + side * 0.07, y + 0.12, z + 0.28, 0.06, 0.035, 0.025);
      }
    } else {
      // White-faced monkey sits above its support with bent legs and a curved tail.
      const y = perch.y + 0.4;
      add(animals, sphere, "#574b3d", x, y, z, 0.24, 0.36, 0.23);
      add(animals, sphere, "#d0c6a6", x, y + 0.38, z + 0.06, 0.22, 0.22, 0.2);
      add(animals, sphere, "#b5a587", x, y + 0.31, z + 0.22, 0.13, 0.1, 0.1);
      for (const side of [-1, 1]) {
        add(animals, sphere, "#a39174", x + side * 0.23, y + 0.38, z + 0.03, 0.07, 0.09, 0.045);
        stem(animals, "#574b3d", V(x + side * 0.15, y + 0.12, z), V(x + side * 0.3, perch.y + 0.06, z), 0.055);
        stem(animals, "#574b3d", V(x + side * 0.14, y - 0.2, z), V(x + side * 0.34, y - 0.14, z + 0.15), 0.075);
        stem(animals, "#574b3d", V(x + side * 0.34, y - 0.14, z + 0.15), V(x + side * 0.2, perch.y + 0.03, z), 0.06);
      }
      let from = V(x, y - 0.2, z - 0.17);
      for (let j = 1; j <= 8; j++) {
        const t = j / 8, to = V(x + Math.sin(t * 2.7) * 0.65, y - 0.2 - t * 0.7, z - 0.17 - t * 0.5);
        stem(animals, "#574b3d", from, to, 0.055 * (1 - t * 0.5));
        from = to;
      }
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
  const birdPerch = canopyPerches[2];
  if (birdPerch) {
    const bx = birdPerch.x, bz = birdPerch.z, by = birdPerch.y + 0.3;
    add(animals, sphere, "#343d35", bx + 1, by, bz, 0.2, 0.28, 0.3);
    add(
      animals,
      sphere,
      "#363e31",
      bx + 1,
      by + 0.25,
      bz + 0.15,
      0.17,
      0.17,
      0.19,
    );
    add(
      animals,
      sphere,
      "#c6aa54",
      bx + 1,
      by + 0.25,
      bz + 0.4,
      0.12,
      0.13,
      0.32,
    );
    add(
      animals,
      sphere,
      "#d7d1aa",
      bx + 1,
      by + 0.02,
      bz + 0.15,
      0.14,
      0.19,
      0.15,
    );
  }
  finish(animals, "rainforest-canopy-fauna");
  sphere.dispose();
  branch.dispose();
  leaf.dispose();
  blade.dispose();
  return {
    update(camera: Point) {
      for (const r of roots)
        r.mesh.visible =
          distance(camera, r.center) < r.radius + (r.mesh.visible ? 26 : 18);
    },
    dispose() {
      for (const m of meshes) scene.remove(m);
      resources.forEach((g) => g.dispose());
      material.dispose();
    },
  };
}
