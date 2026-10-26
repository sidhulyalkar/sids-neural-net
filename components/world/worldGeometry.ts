import * as THREE from "three/src/Three.Core.js";
/** Bake static colored parts into one draw, retaining real geometry and lighting. */
export class GeometryBatch {
  private positions: number[] = [];
  private parts: {start:number;count:number;min:number[];max:number[]}[] = [];
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
    source.computeBoundingBox();
    this.parts.push({start:this.positions.length/3,count:source.getAttribute("position").count,
      min:source.boundingBox!.min.toArray(),max:source.boundingBox!.max.toArray()});
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
    g.userData.cameraParts=this.parts;
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
/** Smooth, shared-vertex surface for continuous terrain-like ring grids.
 * Unlike the flat-shaded triangle soup returned by ringSurface, adjacent
 * mountain samples share normals. Geometry stays at the exact authored Y.
 */
export function indexedRingSurface(
  rings:readonly (readonly THREE.Vector3[])[],
):THREE.BufferGeometry {
  const columns=rings[0]?.length??0;
  if(rings.length<2||columns<2||rings.some(row=>row.length!==columns))
    throw new Error("Indexed ring surface requires a rectangular grid");
  const positions:number[]=[],faces:number[]=[];
  for(const row of rings)for(const p of row){
    if(![p.x,p.y,p.z].every(Number.isFinite))
      throw new Error("Non-finite mountain surface vertex");
    positions.push(p.x,p.y,p.z);
  }
  for(let r=0;r<rings.length-1;r++)for(let c=0;c<columns-1;c++){
    const a=r*columns+c,b=(r+1)*columns+c;
    faces.push(a,b,b+1,a,b+1,a+1);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  g.setIndex(faces);
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
