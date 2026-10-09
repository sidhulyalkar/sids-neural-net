import { terrainHeight } from "./model";
export const SNOWMELT_PATH = [
  { x: -13, z: -66 },
  { x: -16, z: -61 },
  { x: -20, z: -56 },
  { x: -23, z: -51 },
  { x: -23, z: -46 },
  { x: -21, z: -41 },
] as const;
export function drainagePoints() {
  return SNOWMELT_PATH.map((p) => ({
    ...p,
    y: terrainHeight(p.x, p.z) + 0.09,
  }));
}
export const DOWNSTREAM_PATH = [
  { x: -20, z: -25 },
  { x: -21, z: -22 },
  { x: -23, z: -19 },
  { x: -26, z: -15 },
  { x: -29, z: -11 },
  { x: -32, z: -7 },
] as const;
