import * as THREE from "three/src/Three.Core.js";
import { GeometryBatch } from "./worldGeometry";

type Profile = readonly (readonly [z: number, width: number, height: number])[];
/** Longitudinal cross-sections make the peduncle and snout part of the body. */
function profileBody(profile: Profile, sides = 12) {
  const p: number[] = [], indices: number[] = [];
  for (const [z, width, height] of profile)
    for (let j = 0; j < sides; j++) {
      const angle = j / sides * Math.PI * 2;
      p.push(Math.cos(angle) * width, Math.sin(angle) * height, z);
    }
  for (let i = 0; i < profile.length - 1; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j, b = i * sides + (j + 1) % sides;
      indices.push(a, b, a + sides, b, b + sides, a + sides);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** Thin closed fin in the YZ plane. Polygon triangulation preserves fork notches. */
function fin(points: readonly (readonly [number, number])[], thickness = .025) {
  const shape = new THREE.Shape();
  points.forEach(([y, z], i) => i ? shape.lineTo(y, z) : shape.moveTo(y, z));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, steps: 1 });
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const y = p.getX(i), z = p.getY(i), x = p.getZ(i) - thickness / 2;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

export function createFishBodyGeometry() {
  return profileBody([[-1, 0, 0], [-.9, .13, .17], [-.65, .38, .46],
    [-.3, .8, .88], [.1, 1, 1], [.5, .82, .83], [.85, .42, .46], [1, 0, 0]]);
}
export function createCaudalFinGeometry() {
  return fin([[0, .08], [.95, -.9], [.45, -.76], [0, -.4], [-.45, -.76], [-.95, -.9]], .08);
}
export function createDorsalFinGeometry() {
  return fin([[0, .7], [1, -.3], [.36, -.5], [0, -.8]], .1);
}
export function createPectoralFinGeometry() {
  return fin([[0, .65], [1, -.8], [.28, -.55], [0, -.3]], .1);
}

/** One draw per fish, with true swept fins, forked tail, and paired eyes. */
export function createFishGeometry(kind: "anchovy" | "rockfish", color: string) {
  const batch = new GeometryBatch(), body = createFishBodyGeometry();
  const slender = kind === "anchovy", width = slender ? .19 : .42, height = slender ? .12 : .3;
  const add = (g: THREE.BufferGeometry, c: string, p: number[], s: number[], r = new THREE.Euler()) => {
    batch.add(g, c, new THREE.Vector3(...p), new THREE.Vector3(...s), r); g.dispose();
  };
  add(body, color, [0, 0, 0], [width, height, slender ? 1.22 : .9]);
  add(createCaudalFinGeometry(), color, [0, 0, slender ? -1.12 : -.86], [1, slender ? .28 : .38, .45]);
  add(createDorsalFinGeometry(), color, [0, height * .7, -.08], [1, slender ? .16 : .28, .42]);
  for (const side of [-1, 1]) {
    add(createPectoralFinGeometry(), color, [side * width * .75, 0, .15], [1, .3, .25], new THREE.Euler(0, 0, -side * 1.1));
    add(new THREE.SphereGeometry(1, 6, 4), "#172125", [side * width * .63, height * .2, slender ? .88 : .65], [.023, .023, .023]);
  }
  return batch.finish();
}

/** Shared leopard/blacktip architecture: no cone fins or attached snout blobs. */
export function createSharkGeometry(kind: "leopard" | "blacktip") {
  const batch = new GeometryBatch(), color = kind === "leopard" ? "#7f8f86" : "#82958f";
  const add = (g: THREE.BufferGeometry, c = color, p = [0, 0, 0], s = [1, 1, 1], r = new THREE.Euler()) => {
    batch.add(g, c, new THREE.Vector3(...p), new THREE.Vector3(...s), r); g.dispose();
  };
  const body = profileBody([[-1.85, 0, 0], [-1.65, .07, .09], [-1.2, .17, .16],
    [-.55, .35, .27], [.15, .43, .3], [.8, .37, .27], [1.35, .26, .18], [1.8, .11, .075], [1.99, 0, 0]]);
  add(body);
  add(fin([[.2, .32], [.84, -.18], [.46, -.32], [.2, -.63]]));
  add(fin([[.11, -1], [.34, -1.18], [.1, -1.39]]));
  add(fin([[.08, -1.63], [.77, -2.29], [.6, -2.26], [.04, -1.99], [-.44, -2.23], [-.32, -1.93], [-.08, -1.63]]));
  for (const side of [-1, 1]) {
    add(fin([[0, .55], [.85, -.42], [.46, -.35], [0, -.15]]), color, [side * .3, -.05, 0], [1, 1, 1], new THREE.Euler(0, 0, -side * Math.PI / 2));
    add(new THREE.SphereGeometry(1, 6, 4), "#131d1d", [side * .223, .08, 1.4], [.028, .03, .036]);
  }
  if (kind === "blacktip") {
    add(fin([[.84, -.18], [.66, -.04], [.63, -.26]], .026), "#263634");
    for (const side of [-1, 1]) add(fin([[.85, -.42], [.62, -.16], [.62, -.38]], .026), "#263634", [side * .3, -.05, 0], [1, 1, 1], new THREE.Euler(0, 0, -side * Math.PI / 2));
  }
  const result = batch.finish(), colors = result.getAttribute("color");
  // Body triangles are first; sample their Y for a continuous pale underside.
  const bodyVertexCount = (9 - 1) * 12 * 6, vertices = result.getAttribute("position");
  const top = new THREE.Color(color), belly = new THREE.Color("#b4beb5"), saddle = new THREE.Color("#465750");
  for (let i = 0; i < bodyVertexCount; i++) {
    const marked = kind === "leopard" && vertices.getY(i) > .12 && Math.cos(vertices.getZ(i) * 14) > .15;
    const c = vertices.getY(i) < -.04 ? belly : marked ? saddle : top;
    colors.setXYZ(i, c.r, c.g, c.b);
  }
  return result;
}

/** XY planform, negative Z crown becomes upward thickness after X rotation. */
export function createRayWingGeometry() {
  const outline = new THREE.Shape();
  outline.moveTo(0, 1.05);
  outline.bezierCurveTo(.32, .96, 1.18, .62, 1.46, .05);
  outline.bezierCurveTo(1.08, -.18, .52, -.58, 0, -.72);
  outline.bezierCurveTo(-.52, -.58, -1.08, -.18, -1.46, .05);
  outline.bezierCurveTo(-1.18, .62, -.32, .96, 0, 1.05);
  const edge = outline.getPoints(8).slice(0, -1), n = edge.length;
  const p: number[] = [0, 0, -.12], indices: number[] = [];
  for (const scale of [.25, .5, .75, 1])
    for (const v of edge) p.push(v.x * scale, v.y * scale, -.12 * (1 - scale * scale));
  for (let j = 0; j < n; j++) indices.push(0, 1 + j, 1 + (j + 1) % n);
  for (let ring = 0; ring < 3; ring++) for (let j = 0; j < n; j++) {
    const a = 1 + ring * n + j, b = 1 + ring * n + (j + 1) % n;
    indices.push(a, a + n, b, b, a + n, b + n);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setIndex(indices); g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}
