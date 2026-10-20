import {
  isWater, REGIONS, MEMORY_POINTS, terrainHeight, distance, type Point,
} from "./model";
import { biomeAt, understoryDensityAt } from "./biomes";
import { sportClearance } from "./activities";

/**
 * Reproducible land-coverage survey, not a claim every cell is finished.
 * Candidate infill cells are actionable review tasks. Open vistas, beach,
 * mountain rock and active riding space are deliberately distinct categories.
 */
export type OccupancyClass =
  | "water" | "sport" | "discovery" | "alpine-open" | "beach-open"
  | "desert-open" | "forest" | "ecotone" | "needs-review";
export type OccupancyCell = Point & {
  height: number;
  biome: string;
  slope: number;
  moisture: number;
  understory: number;
  category: OccupancyClass;
};
export const OCCUPANCY_DOMAIN = {
  minX: -34, maxX: 58, minZ: -86, maxZ: 52,
} as const;
export function auditIslandCells(step = 6): OccupancyCell[] {
  if (!Number.isFinite(step) || step < 3 || step > 12)
    throw new Error("Survey cell size must be 3–12 world units");
  const result: OccupancyCell[] = [];
  for (let z = OCCUPANCY_DOMAIN.minZ; z <= OCCUPANCY_DOMAIN.maxZ; z += step)
    for (let x = OCCUPANCY_DOMAIN.minX; x <= OCCUPANCY_DOMAIN.maxX; x += step) {
      const p = {x,z};
      const b = biomeAt(p), density = understoryDensityAt(p);
      let category: OccupancyClass;
      if (isWater(p)) category = "water";
      else if (sportClearance(p)) category = "sport";
      else if (REGIONS.some(r=>distance(p,r.point)<5) ||
        MEMORY_POINTS.some(m=>distance(p,m.point)<3.5)) category = "discovery";
      else if (b.weights.alpine > 0.55) category = "alpine-open";
      else if (b.weights["cold-beach"] > 0.55) category = "beach-open";
      else if (b.weights.desert > 0.40) category = "desert-open";
      else if (b.weights.redwood > 0.30 || b.weights.rainforest > 0.30)
        category = "forest";
      else if (density > 0.2) category = "ecotone";
      else category = "needs-review";
      result.push({
        x,z,height:terrainHeight(x,z),biome:b.primary,
        slope:b.slope,moisture:b.moisture,understory:density,category,
      });
    }
  return result;
}
export function summarizeIsland(cells: readonly OccupancyCell[]) {
  const counts: Partial<Record<OccupancyClass,number>> = {};
  for (const cell of cells) counts[cell.category]=(counts[cell.category]??0)+1;
  const land = cells.length-(counts.water??0);
  const candidate = counts["needs-review"]??0;
  return {
    cells:cells.length, land, counts,
    reviewCandidates:candidate,
    reviewShare:land ? candidate/land : 0,
    // Only the sampling proxy, not a measured rendered foliage occupancy.
    method:"deterministic biome/terrain/route coverage proxy; requires browser visual signoff",
  };
}
