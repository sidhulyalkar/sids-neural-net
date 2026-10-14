/** North shore skimboarding: deterministic geography, swell field and 90-second arcade heat.
 * No DOM/Three dependencies. Visible waves and scoring sample these same equations. */
export type SkimPoint = { x: number; z: number };
export const SKIM_HEAT_SECONDS = 90;
export const SKIM_WAVE_SPACING = 12.5;
export const SKIM_WAVE_SPEED = 3.8;
export const SKIM_BOARDS = [
  { id: "amber", label: "Amber", color: "#b87931", tail: "#292d38", x: -10 },
  { id: "aqua", label: "Aqua", color: "#69c6cf", tail: "#69c6cf", x: 0 },
  { id: "lime", label: "Lime", color: "#c6cb59", tail: "#292d38", x: 10 },
] as const;
export type SkimTrick = "shuvit" | "big-spin" | "three-sixty" | "wrap";
/** Ergonomic left-hand tricks. Keep HUD prompts and key handling in sync. */
export const SKIM_TRICK_KEYS: Readonly<Record<string, Exclude<SkimTrick, "wrap">>> =
  Object.freeze({ q: "shuvit", e: "big-spin", f: "three-sixty" });
export function skimTrickForKey(key: string): Exclude<SkimTrick, "wrap"> | null {
  return SKIM_TRICK_KEYS[key.toLowerCase()] ?? null;
}
export type SkimPhase = "off" | "ready" | "riding" | "recovering" | "finished";
export type SkimHeat = {
  phase: SkimPhase;
  board: number | null;
  remaining: number;
  score: number;
  ridePoints: number;
  rides: number;
  speed: number;
  heading: SkimPoint;
  air: number;
  verticalSpeed: number;
  spin: number;
  airElapsed: number;
  airDuration: number;
  trickStart: number;
  wrapCooldown: number;
  trickCallout: string;
  trickCalloutTime: number;
  pendingTrick: SkimTrick | null;
  repeats: Partial<Record<SkimTrick, number>>;
  lastTrick: string;
  waveHits: number;
  recovery: number;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const smooth = (x: number) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const normalize = (v: SkimPoint): SkimPoint => {
  const n = Math.hypot(v.x, v.z);
  return n > 1e-5 ? { x: v.x / n, z: v.z / n } : { x: 0, z: 1 };
};
/** The far shore opposite Granite Ridge; rainforest canopy keeps its inland apron. */
export function northShoreZ(x: number): number {
  return 47.5 + 12.5 * Math.exp(-((x - 43) ** 2) / 210) + 1.25 * Math.sin(x * 0.085);
}
export function beachBlend(x: number, z: number): number {
  return smooth((z - 29) / 10) * (1 - smooth((Math.abs(x) - 19) / 14));
}
export function skimBeachClearance(p: SkimPoint): boolean {
  return Math.abs(p.x) < 21 && p.z > 32 && p.z < northShoreZ(p.x) + 5;
}
export function boardPoint(index: number): SkimPoint {
  const board = SKIM_BOARDS[index] ?? SKIM_BOARDS[0];
  return { x: board.x, z: northShoreZ(board.x) - 6.1 };
}
export function nearbySkimBoard(p: SkimPoint): number | null {
  for (let i = 0; i < SKIM_BOARDS.length; i++) {
    const b = boardPoint(i);
    if (Math.hypot(p.x - b.x, p.z - b.z) < 3.4) return i;
  }
  return null;
}
export function skimOffshore(p: SkimPoint): number { return p.z - northShoreZ(p.x); }
/** Crest translates toward negative Z. Its exact phase also positions rendered foam. */
export function waveCrestOffshore(index: number, seconds: number): number {
  const repeat = SKIM_WAVE_SPACING * 5;
  return 2.2 + (((11.2 + index * SKIM_WAVE_SPACING - seconds * SKIM_WAVE_SPEED) % repeat) + repeat) % repeat;
}
export function skimWaveAt(p: SkimPoint, seconds: number): number {
  const offshore = skimOffshore(p);
  if (Math.abs(p.x) > 40 || offshore < -2 || offshore > 37) return 0;
  let crest = 0;
  for (let i = 0; i < 5; i++) {
    const d = Math.abs(offshore - waveCrestOffshore(i, seconds));
    crest = Math.max(crest, smooth(1 - d / 2.7));
  }
  return crest * smooth((offshore + 1) / 5);
}
export function skimWaterHeight(p: SkimPoint, seconds: number, seaSurface: number): number {
  return seaSurface + 0.1 + skimWaveAt(p, seconds) * 0.72;
}
export function idleSkimHeat(): SkimHeat {
  return { phase: "off", board: null, remaining: SKIM_HEAT_SECONDS, score: 0,
    ridePoints: 0, rides: 0, speed: 0, heading: { x: 0, z: 1 }, air: 0,
    verticalSpeed: 0, spin: 0, airElapsed: 0, airDuration: 0,
    trickStart: 0, wrapCooldown: 0, trickCallout: "", trickCalloutTime: 0,
    pendingTrick: null, repeats: {},
    lastTrick: "", waveHits: 0, recovery: 0 };
}
export function pickupSkimBoard(p: SkimPoint, index: number, previous: SkimHeat): SkimHeat {
  if (previous.phase !== "off" && previous.phase !== "finished") return previous;
  if (nearbySkimBoard(p) !== index) return previous;
  return { ...idleSkimHeat(), phase: "ready", board: index };
}
export function startSkimRide(state: SkimHeat, p: SkimPoint, speed: number, heading: SkimPoint): SkimHeat {
  const shore = skimOffshore(p);
  if (state.phase !== "ready" || speed < 3.6 || shore < -13 || shore > 1 ||
      Math.abs(p.x) > 24 || normalize(heading).z < 0.2) return state;
  return { ...state, phase: "riding", speed: Math.max(7, speed * 1.05),
    heading: normalize(heading), ridePoints: 0, waveHits: 0, air: 0,
    verticalSpeed: 0, spin: 0, airElapsed: 0, airDuration: 0, trickStart: 0,
    pendingTrick: null };
}
function commitRide(s: SkimHeat, clean: boolean): SkimHeat {
  const points = Math.round(s.ridePoints * (clean ? 1.2 : 0.35));
  return { ...s, phase: s.remaining <= 0 ? "finished" : "recovering",
    score: s.score + points, rides: s.rides + 1, ridePoints: 0,
    air: 0, verticalSpeed: 0, spin: 0, airElapsed: 0, airDuration: 0,
    trickStart: 0, pendingTrick: null, trickCallout: clean ? "Clean ride!" : "Wipeout",
    trickCalloutTime: 2.0, recovery: clean ? 0.45 : 1.2,
    lastTrick: clean ? `Clean ride +${points}` : `Wipeout +${points}` };
}
export function skimAction(s: SkimHeat, trick: "pop" | SkimTrick, p: SkimPoint, seconds: number): SkimHeat {
  if (s.phase !== "riding") return s;
  const wave = skimWaveAt(p, seconds);
  if (trick === "wrap") {
    if (s.air > 0 || s.speed < 5.5 || wave < 0.25 || s.wrapCooldown > 0) return s;
    const count = s.repeats.wrap ?? 0;
    return { ...s, heading: normalize({ x: s.heading.x * .4, z: -Math.abs(s.heading.z) - .6 }),
      ridePoints: s.ridePoints + Math.round(175 * (1 + wave * .8) / (1 + count * .35)),
      repeats: { ...s.repeats, wrap: count + 1 }, waveHits: s.waveHits + 1,
      wrapCooldown: 1.15, trickCallout: "Wave wrap!", trickCalloutTime: 1.6,
      lastTrick: "Wave wrap" };
  }
  if (trick === "pop") {
    return s.air > 0.01 || s.speed < 4 ? s :
      { ...s, air: .025, verticalSpeed: wave > .45 ? 4.9 : 3.8,
        airElapsed: 0, airDuration: 2 * (wave > .45 ? 4.9 : 3.8) / 13.8,
        trickStart: 0, spin: 0, pendingTrick: null };
  }
  if (s.air <= 0 || s.pendingTrick) return s;
  return { ...s, pendingTrick: trick, trickStart: s.airElapsed };
}
const TRICK_POINTS: Record<Exclude<SkimTrick, "wrap">, number> = {
  shuvit: 130, "big-spin": 220, "three-sixty": 280,
};
/** Fixed-step friendly heat logic. Incoming waves add momentum but never teleport the rider.
 * Scoring is paid on landing/ride completion, never merely on pressing a trick key. */
export function stepSkimHeat(
  state: SkimHeat, p: SkimPoint, dt: number, seconds: number,
  steer: number, pumping: boolean,
): { heat: SkimHeat; point: SkimPoint } {
  const step = clamp(dt, 0, .05);
  if (state.phase === "off" || state.phase === "finished") return { heat: state, point: p };
  const remaining = Math.max(0, state.remaining - step);
  let s: SkimHeat = { ...state, remaining,
    wrapCooldown: Math.max(0, state.wrapCooldown - step),
    trickCalloutTime: Math.max(0, state.trickCalloutTime - step) };
  if (s.phase === "recovering") {
    s = { ...s, recovery: Math.max(0, s.recovery - step) };
    if (s.recovery === 0) s.phase = "ready";
  }
  if (s.phase !== "riding") {
    return { heat: remaining === 0 ? { ...s, phase: "finished" } : s, point: p };
  }
  const turn = clamp(steer, -1, 1) * (s.air > 0 ? .85 : 1.75) * step;
  const a = Math.atan2(s.heading.x, s.heading.z) + turn;
  const heading = { x: Math.sin(a), z: Math.cos(a) };
  const wave = skimWaveAt(p, seconds);
  let speed = clamp(s.speed + ((pumping && s.air < .02 ? 1.9 : 0) +
    wave * (s.heading.z < 0 ? 3.4 : 1.5) - .75 - Math.abs(steer) * .55) * step, 0, 16);
  let air = s.air, verticalSpeed = s.verticalSpeed, spin = s.spin;
  let airElapsed = s.airElapsed;
  let ridePoints = s.ridePoints + wave * speed * step * .6;
  let waveHits = s.waveHits;
  if (wave > .68 && s.heading.z < -.1) {
    ridePoints += 10 * step;
    waveHits = Math.max(1, waveHits);
  }
  if (air > 0) {
    air += verticalSpeed * step;
    verticalSpeed -= 13.8 * step;
    airElapsed += step;
    if (s.pendingTrick) {
      // Trick assist finishes a visually complete rotation before landing,
      // without asking the player to time fractional key presses.
      const progress = clamp((airElapsed - s.trickStart) /
        Math.max(0.12, s.airDuration - s.trickStart), 0, 1);
      spin = 2 * Math.PI * smooth(progress);
    }
    if (air <= 0) {
      air = 0;
      const trick = s.pendingTrick;
      if (trick && trick !== "wrap") {
        const count = s.repeats[trick] ?? 0;
        const bonus = Math.round(TRICK_POINTS[trick] *
          (1 + wave * .6) / (1 + count * .4));
        // A controlled touchdown requires forward momentum and a complete airborne window.
        if (speed >= 4.1) {
          ridePoints += bonus;
          const title = trick === "shuvit" ? "Shuv-it" : trick === "big-spin" ? "Big spin" : "360";
          s = { ...s, repeats: { ...s.repeats, [trick]: count + 1 },
            trickCallout: `${title} +${bonus}`, trickCalloutTime: 1.8,
            lastTrick: `${title} landed +${bonus}` };
        } else speed = 0;
      }
      verticalSpeed = spin = 0;
      airElapsed = 0;
      s = { ...s, pendingTrick: null, airDuration: 0, trickStart: 0 };
    }
  }
  const point = { x: p.x + heading.x * speed * step, z: p.z + heading.z * speed * step };
  s = { ...s, speed, heading, air, verticalSpeed, spin, airElapsed, ridePoints, waveHits };
  const offshore = skimOffshore(point);
  const clean = offshore < -9 && (s.waveHits > 0 || ridePoints > 35);
  if (clean) s = commitRide(s, true);
  else if (speed < 2 || offshore > 29 || Math.abs(point.x) > 30 || offshore < -15) s = commitRide(s, false);
  else if (remaining === 0) s = commitRide(s, false);
  return { heat: s, point };
}
