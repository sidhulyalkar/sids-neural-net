export type Landmark = { x: number; y: number; z: number };
export type HandFeatures = { active: boolean; count: number; x: number; y: number; speed: number; pinch: number; separation: number; symmetry: number };
export type FaceExpressionFeatures = { smile: number; browRaise: number; browFurrow: number; eyeWide: number; eyeSquint: number; jawOpen: number; mouthPress: number };
export type FaceFeatures = { active: boolean; yaw: number; pitch: number; roll: number; activity: number; stillness: number; expressions: FaceExpressionFeatures };
const distance = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const palm = (points: Landmark[]) => { const ids = [0, 5, 9, 13, 17]; const valid = ids.map((id) => points[id]).filter(Boolean); return valid.reduce((sum, point) => ({ x: sum.x + point.x / valid.length, y: sum.y + point.y / valid.length, z: sum.z + point.z / valid.length }), { x: 0, y: 0, z: 0 }); };
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const pairMean = (left: number, right: number) => clamp((left + right) * .5);
const zeroExpressions = (): FaceExpressionFeatures => ({ smile: 0, browRaise: 0, browFurrow: 0, eyeWide: 0, eyeSquint: 0, jawOpen: 0, mouthPress: 0 });
export function deriveHandFeatures(hands: Landmark[][], previous: Landmark[] = [], dtSeconds = 1 / 15): HandFeatures {
  if (!hands.length) return { active: false, count: 0, x: 0, y: 0, speed: 0, pinch: 0, separation: 0, symmetry: 0 };
  const palms = hands.map(palm); const center = palms.reduce((sum, point) => ({ x: sum.x + point.x / palms.length, y: sum.y + point.y / palms.length, z: 0 }), { x: 0, y: 0, z: 0 });
  const speeds = palms.map((point, index) => previous[index] ? distance(point, previous[index]) / Math.max(.016, dtSeconds) : 0);
  const pinchValues = hands.map((points) => { const scale = distance(points[0], points[9]); return scale ? 1 - Math.min(1, distance(points[4], points[8]) / scale) : 0; });
  const separation = palms.length > 1 ? Math.min(1, distance(palms[0], palms[1]) * 1.8) : 0;
  const symmetry = speeds.length > 1 ? 1 - Math.min(1, Math.abs(speeds[0] - speeds[1]) / Math.max(.1, speeds[0] + speeds[1])) : 0;
  return { active: true, count: hands.length, x: (center.x - .5) * 2, y: -(center.y - .5) * 2, speed: Math.min(1, speeds.reduce((a, b) => a + b, 0) / speeds.length), pinch: Math.max(...pinchValues), separation, symmetry };
}
export function deriveExpressionFeatures(blendshapes: Record<string, number>): FaceExpressionFeatures {
  const score = (name: string) => clamp(blendshapes[name] ?? 0);
  return {
    smile: pairMean(score('mouthSmileLeft'), score('mouthSmileRight')),
    browRaise: clamp(Math.max(score('browInnerUp'), pairMean(score('browOuterUpLeft'), score('browOuterUpRight')))),
    browFurrow: pairMean(score('browDownLeft'), score('browDownRight')),
    eyeWide: pairMean(score('eyeWideLeft'), score('eyeWideRight')),
    eyeSquint: pairMean(score('eyeSquintLeft'), score('eyeSquintRight')),
    jawOpen: score('jawOpen'),
    mouthPress: pairMean(score('mouthPressLeft'), score('mouthPressRight')),
  };
}
export function deriveFaceFeatures(matrix: number[] | undefined, blendshapes: Record<string, number>, previousActivity = 0): FaceFeatures {
  const values = Object.values(blendshapes); const activity = values.length ? Math.min(1, values.reduce((sum, value) => sum + value, 0) / values.length * 3) : 0;
  const yaw = matrix ? Math.atan2(matrix[8], matrix[10]) : 0; const pitch = matrix ? Math.asin(Math.max(-1, Math.min(1, -matrix[9]))) : 0; const roll = matrix ? Math.atan2(matrix[1], matrix[5]) : 0;
  return { active: !!matrix || values.length > 0, yaw, pitch, roll, activity, stillness: 1 - Math.min(1, Math.abs(activity - previousActivity) * 5), expressions: values.length ? deriveExpressionFeatures(blendshapes) : zeroExpressions() };
}
