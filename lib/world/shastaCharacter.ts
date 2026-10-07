/**
 * Shasta character definition.
 *
 * Visual authority: Sid's supplied photo set, viewed across front, side, rear,
 * resting and outdoor/harness poses. Values below are art-direction parameters
 * in normalized world units, not inferred real-world biometric measurements.
 */
export const SHASTA_CHARACTER = {
  identity: {
    name: "Shasta",
    sex: "male",
    type: "husky-mix",
    build: "lean-athletic",
  },
  palette: {
    creamWhite: "#f3eee3",
    brightWhite: "#faf7ef",
    lightTan: "#d8bd98",
    warmTan: "#c6a078",
    sable: "#9a7560",
    saddleDark: "#765b50",
    innerEar: "#d7aa98",
    amberEye: "#b47a2f",
    pupil: "#2d211a",
    pinkBrownNose: "#95645b",
    nail: "#57483f",
  },
  proportions: {
    torso: { x: 0.31, y: 0.36, z: 0.8 },
    chest: { x: 0.31, y: 0.39, z: 0.35 },
    neck: { x: 0.27, y: 0.31, z: 0.29 },
    head: { x: 0.245, y: 0.275, z: 0.29 },
    muzzle: { x: 0.18, y: 0.13, z: 0.39 },
    cheek: { x: 0.105, y: 0.115, z: 0.15 },
    paw: { x: 0.105, y: 0.062, z: 0.155 },
    ear: { x: 0.125, y: 0.42, z: 0.15 },
  },
  coat: {
    // Light face and underside are the dominant read; color is concentrated
    // across the crown, shoulders, spine, upper flanks and tail base.
    saddleCenter: { y: 1.015, z: -0.14, x: 0, sx: 0.255, sy: 0.125, sz: 0.7 },
    saddleSpine: { y: 1.105, z: -0.18, x: 0, sx: 0.17, sy: 0.07, sz: 0.58 },
    shoulderTan: { y: 0.96, z: 0.39, x: 0, sx: 0.285, sy: 0.19, sz: 0.31 },
  },
  face: {
    eyeX: 0.135,
    eyeY: 1.515,
    eyeZ: 1.055,
    pupilZ: 1.079,
    cheekX: 0.155,
    cheekY: 1.355,
    cheekZ: 0.885,
    noseY: 1.34,
    noseZ: 1.285,
  },
  tail: {
    /**
     * Standing-tail silhouette from the photos: broad base, relaxed plume
     * sweeping backward/down, then a soft outward/upward curl near the tip.
     * These six photo-derived points drive one continuous tapered tube so the
     * plume stays smooth and remains one draw call.
     */
    plume: [
      { x: 0.0, y: 1.03, z: -0.76, sx: 0.17, sy: 0.19, sz: 0.24, tone: "warmTan" },
      { x: 0.02, y: 0.9, z: -0.98, sx: 0.19, sy: 0.2, sz: 0.28, tone: "lightTan" },
      { x: 0.06, y: 0.75, z: -1.2, sx: 0.21, sy: 0.21, sz: 0.3, tone: "creamWhite" },
      { x: 0.12, y: 0.67, z: -1.42, sx: 0.225, sy: 0.215, sz: 0.31, tone: "brightWhite" },
      { x: 0.2, y: 0.69, z: -1.61, sx: 0.215, sy: 0.205, sz: 0.29, tone: "brightWhite" },
      { x: 0.27, y: 0.78, z: -1.75, sx: 0.18, sy: 0.175, sz: 0.25, tone: "creamWhite" },
    ] as const,
    restAngleZ: 0.035,
    restAngleY: -0.08,
  },
  rendering: {
    profileVersion: "photo-profile-v3-natural-coat",
    bodySegments: 9,
    bodyRings: 7,
    tailStyle: "continuous-relaxed-plume",
  },
  accessories: {
    harnessInWorld: false,
  },
} as const;

export type ShastaPaletteKey = keyof typeof SHASTA_CHARACTER.palette;

export const SHASTA_PALETTE = SHASTA_CHARACTER.palette;
