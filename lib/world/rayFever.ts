/** A mass eagle-ray aggregation without per-ray collision or O(N^2) boids.
 * The school is a moving volume, not a 2D sheet or one synchronous animation.
 * Independently sampled bands stay deterministic across pause/re-entry.
 */
export const EAGLE_FEVER_COUNT = 120;
export const EAGLE_FEVER_COHORTS = 4;
export const EAGLE_FEVER_MOBILE_COUNT = 96;
export const EAGLE_FEVER_MIN_CLEARANCE = 0.65;

export type EagleFeverPose = {
  x: number; y: number; z: number; yaw: number; roll: number;
  flap: number; size: number; depthBand: number;
};
export type FeverSample = (x: number, z: number) => number;

/** Four lanes across the corridor, six depth strata and five staggered
 * longitudinal bands. No neighbors are searched during playback.
 * World-space +Z is the migration direction, consistent with ray mesh heads.
 */
export function sampleEagleFever(
  index: number, seconds: number,
  floorAt: FeverSample, seaSurface: number,
): EagleFeverPose {
  if (!Number.isInteger(index) || index < 0 || index >= EAGLE_FEVER_COUNT)
    throw new RangeError("Invalid eagle fever index");
  const t=Number.isFinite(seconds)?Math.max(0,seconds):0;
  const row=Math.floor(index/24);
  const within=index%24;
  const depthBand=Math.floor(within/4);
  const column=within%4;
  const wobble=Math.sin(index*2.399963);
  const x=82 + (column-1.5)*3.2 + wobble*.42
    + Math.sin(t*.056 + row*.85)*1.1;
  const z=-27 + row*16 + (depthBand%2)*1.3
    + Math.cos(index*1.618)*1.5
    + Math.sin(t*.038 + row*.65)*4.8;
  // Exact depths are world units; schoolmembers glide both over and below
  // the snorkeler while the deepest silhouettes stay above the same seabed
  // used by terrain meshes and diving collision.
  const targetDepth=2.6 + depthBand*2.8
    + .25*Math.sin(t*.4 + index*.6);
  const depth=Math.min(targetDepth,Math.max(.85,
    seaSurface-floorAt(x,z)-EAGLE_FEVER_MIN_CLEARANCE));
  const y=seaSurface-depth;
  return {
    x,y,z,
    yaw:Math.sin(t*.075+row*.7)*.12 + (column-1.5)*.015,
    roll:Math.sin(t*.3+index*.8)*.065,
    flap:t*(1.15+(index%7)*.024)+(index%4)*Math.PI/2,
    size:.72+.2*(.5+.5*Math.sin(index*11.7)),
    depthBand,
  };
}
