import type { Point } from "./model";

/** One tangent-continuous capsule loop shared by terrain, planting and travel. */
export const DESERT_TRACK = { cx: 37, radius: 5, north: -43, south: -13, tread: 2.2, clearance: 3.35 } as const;
export type Segment = "north-berm" | "south-berm" | "west-rollers" | "east-return";
const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v-a)/(b-a)));
  return t*t*(3-2*t);
};
export function desertTrackFrame(p: Point) {
  const { cx, radius, north, south } = DESERT_TRACK;
  let center: Point, tangent: Point, segment: Segment;
  if (p.z < north || p.z > south) {
    const z = p.z < north ? north : south;
    const dx = p.x-cx, dz = p.z-z, len = Math.max(1e-6, Math.hypot(dx,dz));
    const nx = dx/len, nz = dz/len;
    center = {x: cx+radius*nx, z: z+radius*nz};
    tangent = {x: -nz, z: nx};
    segment = p.z < north ? "north-berm" : "south-berm";
  } else if (p.x < cx) {
    center = {x:cx-radius,z:p.z}; tangent={x:0,z:-1}; segment="west-rollers";
  } else {
    center = {x:cx+radius,z:p.z}; tangent={x:0,z:1}; segment="east-return";
  }
  const dx=p.x-center.x, dz=p.z-center.z;
  // Positive normal is outside the loop, on both straights and both arcs.
  const lateral=dx*tangent.z-dz*tangent.x;
  return {center,tangent,lateral,distance:Math.hypot(dx,dz),segment};
}
export function desertTrackClearance(p: Point) {
  return p.x>=24 && p.x<=50 && p.z>=-55 && p.z<=-2 &&
    desertTrackFrame(p).distance < DESERT_TRACK.clearance;
}
export function desertTrackHeightOffset(p: Point) {
  if (p.x<23 || p.x>51 || p.z< -56 || p.z>-1) return 0;
  const frame=desertTrackFrame(p);
  if (frame.distance>7) return 0;
  // Packed-earth tread and broad feathered outside shoulders, not a wall.
  let offset=-0.12*(1-smooth(1.1,3.5,frame.distance));
  if (frame.segment==="north-berm" || frame.segment==="south-berm") {
    const cap=frame.segment==="north-berm" ? DESERT_TRACK.north : DESERT_TRACK.south;
    offset+=0.95*smooth(0,3.5,Math.abs(p.z-cap))*
      smooth(-0.5,2.6,frame.lateral)*(1-smooth(3.4,6.5,frame.lateral));
  }
  // Progressive rollers on west line, earthen launch crest on east return.
  for (const [x,z,h,w] of [
    [32,-38,0.58,2.8], [32,-31,0.86,2.8], [32,-24,0.74,2.8],
    [32,-17,0.52,2.8], [42,-26.5,0.85,2.5],
  ]) {
    const dx=(p.x-x)/w, dz=(p.z-z)/2.8;
    offset+=h*Math.exp(-1.65*(dx*dx+dz*dz));
  }
  return offset;
}
export function desertTrackTreadBlend(p: Point) {
  if (p.x<24 || p.x>50 || p.z< -55 || p.z>-2) return 0;
  return 1-smooth(1.5,3.5,desertTrackFrame(p).distance);
}
export function desertTrackCenterline(steps=24): Point[] {
  const {cx:c,radius:r,north:n,south:s}=DESERT_TRACK;
  const result: Point[]=[];
  for(let i=0;i<=steps;i++) result.push({x:c-r,z:s+(n-s)*i/steps});
  for(let i=1;i<=steps;i++){const a=Math.PI+Math.PI*i/steps;result.push({x:c+r*Math.cos(a),z:n+r*Math.sin(a)});}
  for(let i=1;i<=steps;i++) result.push({x:c+r,z:n+(s-n)*i/steps});
  for(let i=1;i<=steps;i++){const a=Math.PI*i/steps;result.push({x:c+r*Math.cos(a),z:s+r*Math.sin(a)});}
  return result;
}
