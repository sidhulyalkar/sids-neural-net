import * as THREE from "three/src/Three.Core.js";
import { GeometryBatch } from "./worldGeometry";
import { seaFloorHeight, SEA_SURFACE } from "@/lib/world/model";
export type CoralForm =
  | "massive"
  | "branching"
  | "digitate"
  | "table"
  | "foliose"
  | "encrusting"
  | "mushroom"
  | "fan"
  | "whip";
export const CORAL_FORMS: readonly CoralForm[] = [
  "massive",
  "branching",
  "digitate",
  "table",
  "foliose",
  "encrusting",
  "mushroom",
  "fan",
  "whip",
];
export function createReefGarden(root: THREE.Group) {
  const sphere = new THREE.SphereGeometry(1, 8, 5),
    stem = new THREE.CylinderGeometry(0.65, 1, 1, 5),
    plate = new THREE.CylinderGeometry(1, 1, 0.12, 10);
  const batch = new GeometryBatch(),
    v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const add = (
    g: THREE.BufferGeometry,
    c: string,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    r = 0,
  ) => batch.add(g, c, v(x, y, z), v(sx, sy, sz), new THREE.Euler(0, 0, r));
  let seed = 518;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const palette = ["#9e83ad", "#789873", "#c5ac75", "#a28277", "#728b9a"];
  for (let i = 0; i < 125; i++) {
    // Four compositions: garden, bommie, open channel with isolated heads, outer slope.
    const zone = i % 4,
      angle = rand() * Math.PI * 2,
      r = rand() * (zone === 1 ? 3.3 : 7);
    const center =
      zone === 0
        ? { x: 66, z: 9 }
        : zone === 1
          ? { x: 73, z: 24 }
          : zone === 2
            ? { x: 76, z: -5 }
            : { x: 85, z: 12 };
    if (zone === 2 && i % 12 !== 2) continue;
    const x = center.x + Math.cos(angle) * r,
      z = center.z + Math.sin(angle) * r,
      y = seaFloorHeight(x, z) + 0.08;
    const size = 0.3 + rand() * 0.65,
      color = palette[i % palette.length];
    const form =
      zone === 3
        ? i % 2
          ? "table"
          : "foliose"
        : CORAL_FORMS[i % CORAL_FORMS.length];
    if (form === "massive" || form === "encrusting")
      add(
        sphere,
        color,
        x,
        y + (form === "encrusting" ? 0.08 : size * 0.4),
        z,
        size,
        form === "encrusting" ? 0.12 : size * 0.7,
        size * 0.85,
      );
    else if (form === "table" || form === "mushroom") {
      add(
        stem,
        color,
        x,
        y + size * 0.4,
        z,
        size * 0.18,
        size * 0.8,
        size * 0.18,
      );
      add(plate, color, x, y + size * 0.85, z, size, size, size * 0.8);
    } else if (form === "foliose") {
      for (let j = 0; j < 4; j++)
        add(
          plate,
          color,
          x + Math.cos(j) * size * 0.2,
          y + j * size * 0.17,
          z + Math.sin(j) * size * 0.2,
          size * (1 - j * 0.1),
          0.6,
          size * 0.7,
          j * 0.15,
        );
    } else
      for (let j = 0; j < 6; j++) {
        const a = j * 2.4,
          dx = Math.cos(a) * size * 0.5,
          dz = Math.sin(a) * size * 0.5;
        add(
          stem,
          color,
          x + dx,
          y + size * (form === "whip" ? 1 : 0.5),
          z + (form === "fan" ? 0 : dz),
          0.04,
          size * (form === "whip" ? 2 : 1),
          0.04,
          form === "fan" ? (j - 2.5) * 0.3 : Math.cos(a) * 0.3,
        );
        if (form === "branching") {
          add(
            stem,
            color,
            x + dx + 0.08,
            y + size * 0.82,
            z + dz,
            0.025,
            size * 0.4,
            0.025,
            -0.6,
          );
          add(
            stem,
            color,
            x + dx - 0.08,
            y + size * 0.85,
            z + dz,
            0.025,
            size * 0.4,
            0.025,
            0.6,
          );
        }
      }
  }
  const coralGeo = batch.finish(),
    mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
    });
  const coral = new THREE.Mesh(coralGeo, mat);
  coral.name = "lagoon-coral-garden";
  root.add(coral);
  // One batched body plus two moving front flippers keeps the turtle to three draws.
  const body = new GeometryBatch();
  body.add(sphere, "#7d8050", v(0, 0, 0), v(0.64, 0.3, 0.86));
  body.add(sphere, "#c2b386", v(0, -0.15, 0), v(0.58, 0.12, 0.8));
  body.add(sphere, "#939c6d", v(0, 0, 0.98), v(0.21, 0.18, 0.3));
  body.add(sphere, "#939c6d", v(0, -0.1, -0.87), v(0.065, 0.055, 0.2));
  for (const side of [-1, 1]) {
    body.add(
      sphere,
      "#aab080",
      v(side * 0.43, -0.1, -0.7),
      v(0.22, 0.055, 0.38),
    );
    body.add(
      sphere,
      "#242e28",
      v(side * 0.15, 0.06, 1.12),
      v(0.035, 0.035, 0.028),
    );
  }
  for (let i = 0; i < 5; i++)
    body.add(
      sphere,
      "#555f41",
      v(Math.sin(i * 2.4) * 0.3, 0.26, Math.cos(i * 2.4) * 0.42),
      v(0.18, 0.035, 0.2),
    );
  const bodyGeo = body.finish(),
    turtle = new THREE.Group();
  turtle.add(new THREE.Mesh(bodyGeo, mat));
  const finMat = new THREE.MeshStandardMaterial({
    color: "#939c6d",
    roughness: 0.9,
  });
  const fins = [-1, 1].map((side) => {
    const pivot = new THREE.Group(),
      fin = new THREE.Mesh(sphere, finMat);
    fin.scale.set(0.7, 0.06, 0.22);
    fin.position.x = side * 0.45;
    pivot.add(fin);
    pivot.position.set(side * 0.45, -0.03, 0.3);
    turtle.add(pivot);
    return pivot;
  });
  turtle.name = "lagoon-sea-turtle";
  turtle.position.set(79, SEA_SURFACE - 1.4, 20);
  root.add(turtle);
  stem.dispose();
  plate.dispose();
  return {
    update(t: number) {
      if (!root.visible) return;
      const a = t * 0.085;
      turtle.position.set(
        73 + Math.cos(a) * 6,
        Math.min(
          SEA_SURFACE - 1.4,
          seaFloorHeight(73 + Math.cos(a) * 6, 20 + Math.sin(a) * 7) + 2.4,
        ),
        20 + Math.sin(a) * 7,
      );
      // Face the tangent of the elliptical path, with the head along local +Z.
      turtle.rotation.y = Math.atan2(-6 * Math.sin(a), 7 * Math.cos(a));
      fins.forEach(
        (f, i) =>
          (f.rotation.z = (i ? 1 : -1) * (0.2 + Math.sin(t * 1.5) * 0.38)),
      );
    },
    dispose() {
      root.remove(coral, turtle);
      [sphere, coralGeo, bodyGeo].forEach((g) => g.dispose());
      mat.dispose();
      finMat.dispose();
    },
  };
}
