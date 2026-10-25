import {ringSurfaceHeight} from "./surfaceSupport";
import { isWater, SEA_SURFACE, terrainHeight, worldFloorHeight, mountainSurfaceHeight, paperCaveHalfWidth, paperCaveFloorHeight, PAPER_CAVE_SECTIONS, paperCaveCenterX, PAPER_CAVE } from "./model";
export const SNOWMELT_POOL={x:-13,z:-66,radius:3.6,scaleX:1.25} as const;
export const SNOWMELT_PATH = [
  { x: -13, z: -66 },
  { x: -16, z: -61 },
  { x: -20, z: -56 },
  { x: -23, z: -51 },
  { x: -23, z: -46 },
  { x: -21, z: -42 },
] as const;
type WaterPoint = { x: number; y: number; z: number };
/** Sample relief between control points so long chords cannot disappear below terrain. */
function surfaceRibbon(points: WaterPoint[]) {
  const sampled = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const count = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .04);
    for (let j = 1; j <= count; j++) {
      const t = j / count, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      sampled.push({ x, z, y: Math.max(a.y + (b.y - a.y) * t, worldFloorHeight(x, z) + .1) });
    }
  }
  // Small undulations become gently descending reaches, never uphill water.
  for (let i = sampled.length - 2; i >= 0; i--) sampled[i].y = Math.max(sampled[i].y, sampled[i + 1].y + .0001);
  return sampled;
}
export function drainagePoints() {
  const lip = waterfallProfile().lip;
  return surfaceRibbon([...SNOWMELT_PATH.map((p) => ({
    ...p,
    y: terrainHeight(p.x, p.z) + 0.09,
  })), { x: -20, z: -37, y: lip.y + 0.3 },
  { x: -20, z: -34, y: lip.y + 0.15 }, lip]);
}
export const DOWNSTREAM_PATH = [
  { x: -20, z: -25 },
  { x: -21, z: -22 },
  { x: -23, z: -19 },
  { x: -26, z: -15 },
  { x: -29, z: -11 },
  { x: -32, z: -7 },
  { x: -34, z: -4 },
  { x: -36, z: -1 },
] as const;

/** Renderer and drainage share exact contact heights, independent of approach terrain. */
export function waterfallProfile() {
  // The plunge pool is surface terrain. The archive chamber has its own
  // lower support surface and must not flatten this waterfall shoulder.
  const floorY = terrainHeight(-20, -27);
  return {
    floorY,
    lip: { x: -20, z: -30, y: Math.max(floorY + 5.35, terrainHeight(-20, -30) + 0.14) },
    pool: { x: -20, z: -27, y: floorY + 0.22 },
  };
}

/** Pool exit and creek share one height profile; the final reach meets the sea. */
export function downstreamPoints() {
  const poolY = waterfallProfile().pool.y;
  return surfaceRibbon(DOWNSTREAM_PATH.map((p, i) => ({
    ...p,
    y: i === 0 ? poolY : isWater(p) ? SEA_SURFACE + 0.02 : terrainHeight(p.x, p.z) + 0.1,
  })));
}

/** Crown support for the stream where the hillside becomes the archive roof.
 * Each ring follows the same water samples, avoiding a floating stream above a
 * constant-height slab. The center channel is shallow; outer shoulders tie into
 * the surrounding mountain, leaving the interior chamber beneath it. */
export function waterfallCrownRings(): WaterPoint[][] {
  return drainagePoints().filter(p => p.z >= -42).map(p => {
    const section=[[-7,terrainHeight(p.x-7,p.z)+.09],[-3.6,Math.max(p.y+.25,terrainHeight(p.x-3.6,p.z)+.09)],[-1.25,p.y-.07],[1.25,p.y-.07],[3.6,Math.max(p.y+.25,terrainHeight(p.x+3.6,p.z)+.09)],[7,terrainHeight(p.x+7,p.z)+.09]];
    // Sample cross-slope relief instead of intersecting it with broad triangles.
    return Array.from({length:57},(_,i)=>{
      const dx=-7+i*.25,x=p.x+dx;
      const j=Math.max(1,section.findIndex(v=>v[0]>=dx)),a=section[j-1],b=section[j];
      const y=a[1]+(b[1]-a[1])*(dx-a[0])/(b[0]-a[0]);
      return {x,y:Math.max(y,terrainHeight(x,p.z)+.025),z:p.z};
    });
  });
}

let crownCache:ReturnType<typeof waterfallCrownRings>|undefined;
export function waterfallRockHeight(p:{x:number;z:number}):number|null{
 if(p.z < -42 || p.z > -30 || p.x < -30 || p.x > -10)return null;
 return ringSurfaceHeight(crownCache??=waterfallCrownRings(),p);
}
export const COAST_BENCH={x:-29,z:-40} as const;
export const COAST_WHALE={x:-65,z:-43} as const;
export const COAST_FALL={x:-32.15,z:-48} as const;
export function mountainTributaries(){
 return [
  [{x:-13,z:-66},{x:-19,z:-64},{x:-25,z:-60},{x:-28,z:-55},COAST_FALL],
 ].map(path=>surfaceRibbon(path.map(p=>({...p,y:terrainHeight(p.x,p.z)+.11}))));
}

export function paperCaveShellRings():WaterPoint[][]{
  const sections:{x:number;z:number;w:number}[]=[];
  for(let i=1;i<PAPER_CAVE_SECTIONS.length;i++){
    const a=PAPER_CAVE_SECTIONS[i-1],b=PAPER_CAVE_SECTIONS[i],n=Math.ceil(a.z-b.z);
    for(let j=0;j<n;j++){const z=a.z+(b.z-a.z)*j/n;sections.push({z,x:paperCaveCenterX(z),w:paperCaveHalfWidth(z)});}
  }
  sections.push(PAPER_CAVE_SECTIONS.at(-1)!);
  return sections.map(({x,z,w})=>{
    const floor=paperCaveFloorHeight({x,z});
    const roof=Math.min(floor+7,...[-1,-.625,0,.625,1].map(t=>mountainSurfaceHeight(x+w*t,z)-.55));
    const shoulder=Math.min(roof-.45,floor+5.65);
    return [
      {x:x-w,y:floor-.12,z},{x:x-w,y:shoulder,z},
      {x:x-w*.625,y:roof-.18,z},{x,y:roof,z},
      {x:x+w*.625,y:roof-.18,z},{x:x+w,y:shoulder,z},
      {x:x+w,y:floor-.12,z},
    ];
  });
}
let paperRoofCache:WaterPoint[][]|undefined;
export function paperCaveRoofHeight(p:{x:number;z:number}):number|null{
 if(p.z< PAPER_CAVE.backZ||p.z> -30||Math.abs(p.x+20)>6.5)return null;
 return ringSurfaceHeight(paperRoofCache??=paperCaveShellRings(),p);
}
