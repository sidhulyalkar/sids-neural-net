import type { BufferGeometry } from "three";
import { MOUNTAIN_HALFPIPE as pipe } from "../mountainHalfpipe";

// Index the actual refined terrain once. Within each cell the planes use
// barycentric coordinates, so even triangles crossing a cell boundary agree
// with the vertices sent to WebGL.
export function renderedSnowHeight(mesh: BufferGeometry, fallback: (x:number,z:number)=>number) {
  const minX = -13, width = 35, minZ = pipe.startZ - 6, depth = pipe.endZ + 6 - minZ;
  const cells = Array.from({length: width * depth}, () => [] as number[]);
  const planes: number[][] = [];
  const vertices = mesh.getAttribute("position");
  const index = mesh.getIndex();
  if (!index) throw new Error("Indexed island terrain required");
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i), b = index.getX(i+1), c = index.getX(i+2);
    const x = vertices.getX(a), z = vertices.getZ(a), y = vertices.getY(a);
    const bx = vertices.getX(b)-x, bz = vertices.getZ(b)-z;
    const cx = vertices.getX(c)-x, cz = vertices.getZ(c)-z;
    const x0 = Math.max(0,Math.floor(x+Math.min(0,bx,cx)-minX));
    const x1 = Math.min(width-1,Math.floor(x+Math.max(0,bx,cx)-minX));
    const z0 = Math.max(0,Math.floor(z+Math.min(0,bz,cz)-minZ));
    const z1 = Math.min(depth-1,Math.floor(z+Math.max(0,bz,cz)-minZ));
    const det = bx*cz-bz*cx;
    if (x0>x1 || z0>z1 || Math.abs(det)<1e-12) continue;
    const id = planes.push([x,z,y,cz/det,-cx/det,-bz/det,bx/det,vertices.getY(b)-y,vertices.getY(c)-y])-1;
    for (let row=z0; row<=z1; row++) for (let col=x0; col<=x1; col++) cells[row*width+col].push(id);
  }
  let last = -1;
  function sample(id:number,x:number,z:number) {
    const p=planes[id], dx=x-p[0], dz=z-p[1];
    const u=dx*p[3]+dz*p[4], v=dx*p[5]+dz*p[6];
    return u>=-1e-8 && v>=-1e-8 && u+v<=1+1e-8 ? p[2]+u*p[7]+v*p[8] : NaN;
  }
  return (x:number,z:number) => {
    if(last>=0){
      const height=sample(last,x,z);
      if(Number.isFinite(height)) return height;
    }
    const col=Math.floor(x-minX), row=Math.floor(z-minZ);
    if(col>=0 && col<width && row>=0 && row<depth) for(const id of cells[row*width+col]){
      const height=sample(id,x,z);
      if(Number.isFinite(height)){last=id; return height;}
    }
    return fallback(x,z);
  };
}
