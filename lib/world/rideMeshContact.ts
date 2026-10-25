import type {Point} from "./model";
export const RIDE_TERRAIN_GRID={x:142,z:132} as const;
/** Sample the exact two triangles of a Three.js PlaneGeometry grid
 * (indices a,b,d and b,c,d after rotateX(-PI/2)). A bilinear height
 * sampler would describe a different surface than the one rendered. */
export function terrainMeshHeight(
 point:Point,values:Float32Array,
 bounds:{minX:number;maxX:number;minZ:number;maxZ:number},
 segmentsX:number=RIDE_TERRAIN_GRID.x,segmentsZ:number=RIDE_TERRAIN_GRID.z,
):number{
 if(!Number.isFinite(point.x)||!Number.isFinite(point.z)||
  values.length!==(segmentsX+1)*(segmentsZ+1)||segmentsX<1||segmentsZ<1)
  return NaN;
 const sx=Math.max(0,Math.min(segmentsX,
  (point.x-bounds.minX)*segmentsX/(bounds.maxX-bounds.minX)));
 const sz=Math.max(0,Math.min(segmentsZ,
  (point.z-bounds.minZ)*segmentsZ/(bounds.maxZ-bounds.minZ)));
 // Preserve exact boundary vertices, selecting the final cell at u/v=1.
 const ix=Math.min(segmentsX-1,Math.floor(sx));
 const iz=Math.min(segmentsZ-1,Math.floor(sz));
 const u=sx-ix,v=sz-iz,stride=segmentsX+1;
 const a=iz*stride+ix,d=a+1,b=a+stride,c=b+1;
 if(u+v<=1)return values[a]*(1-u-v)+values[d]*u+values[b]*v;
 return values[b]*(1-u)+values[d]*(1-v)+values[c]*(u+v-1);
}
