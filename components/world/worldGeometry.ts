import * as THREE from "three/src/Three.Core.js";
/** Bake static colored parts into one draw, retaining real geometry and lighting. */
export class GeometryBatch {
  private positions: number[] = [];
  private colors: number[] = [];
  private normals: number[] = [];
  add(
    g: THREE.BufferGeometry,
    color: string,
    p: THREE.Vector3,
    scale: THREE.Vector3,
    rotation = new THREE.Euler(),
  ) {
    const source = g.index ? g.toNonIndexed() : g.clone();
    source.applyMatrix4(
      new THREE.Matrix4().compose(
        p,
        new THREE.Quaternion().setFromEuler(rotation),
        scale,
      ),
    );
    if (!source.getAttribute("normal")) source.computeVertexNormals();
    const n = source.getAttribute("normal");
    const a = source.getAttribute("position"),
      c = new THREE.Color(color);
    for (let i = 0; i < a.count; i++) {
      this.positions.push(a.getX(i), a.getY(i), a.getZ(i));
      this.colors.push(c.r, c.g, c.b);
      this.normals.push(n.getX(i), n.getY(i), n.getZ(i));
    }
    source.dispose();
  }
  finish() {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(this.positions, 3),
    );
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.colors, 3));
    // Preserve transformed smooth normals from the source. Recomputing after
    // de-indexing turns every rounded animal/rock into disconnected flat faces.
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.normals, 3));
    g.computeBoundingSphere();
    return g;
  }
}
export function ringSurface(
  rings: readonly (readonly THREE.Vector3[])[],
  close = false,
) {
  const p: number[] = [];
  for (let r = 0; r < rings.length - 1; r++)
    for (let j = 0; j < rings[r].length - (close ? 0 : 1); j++) {
      const k = (j + 1) % rings[r].length;
      const a = rings[r][j],
        b = rings[r + 1][j],
        c = rings[r + 1][k],
        d = rings[r][k];
      for (const v of [a, b, c, a, c, d]) p.push(v.x, v.y, v.z);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}
export function ribbon(
  points: readonly THREE.Vector3[],
  widths: readonly number[],
) {
  return ringSurface(
    points.map((p, i) => {
      const a = points[Math.max(0, i - 1)],
        b = points[Math.min(points.length - 1, i + 1)];
      const dx = b.x - a.x,
        dz = b.z - a.z,
        l = Math.hypot(dx, dz) || 1;
      return [
        new THREE.Vector3(
          p.x + ((dz / l) * widths[i]) / 2,
          p.y,
          p.z - ((dx / l) * widths[i]) / 2,
        ),
        new THREE.Vector3(
          p.x - ((dz / l) * widths[i]) / 2,
          p.y,
          p.z + ((dx / l) * widths[i]) / 2,
        ),
      ];
    }),
  );
}
