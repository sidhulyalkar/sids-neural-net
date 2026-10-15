/** North shore skimboarding: deterministic geography, swell field and 90-second arcade heat.
 * No DOM/Three dependencies. Visible waves and scoring sample these same equations. */
export type SkimPoint = { x: number; z: number };
export const SKIM_HEAT_SECONDS = 90;
export const SKIM_WAVE_SPACING = 12.5;
export const SKIM_WAVE_SPEED = 3.8;
export const SKIM_BOARDS = [
  { id: "amber", label: "Amber", color: "#b87931", tail: "#292d38", x: -3.3 },
  { id: "aqua", label: "Aqua", color: "#69c6cf", tail: "#69c6cf", x: 0 },
  { id: "lime", label: "Lime", color: "#c6cb59", tail: "#292d38", x: 3.3 },
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
  flightY: number | null;
  launchCooldown: number;
  launchKind: "none" | "flat-pop" | "lip-air";
  waveRideSeconds: number;
  trickDuration: number;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const smooth = (x: number) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const normalize = (v: SkimPoint): SkimPoint => {
  const n = Math.hypot(v.x, v.z);
  return n > 1e-5 ? { x: v.x / n, z: v.z / n } : { x: 0, z: 1 };
};
/** The far shore opposite Granite Ridge; rainforest canopy keeps its inland apron. */
export function northShoreZ(x: number): number {
  return 66 + 12.5 * Math.exp(-((x - 43) ** 2) / 210) + 1.25 * Math.sin(x * 0.085);
}
export function beachBlend(x: number, z: number): number {
  return smooth((z - (northShoreZ(x) - 12)) / 7) * (1 - smooth((Math.abs(x) - 19) / 14));
}
export function skimBeachClearance(p: SkimPoint): boolean {
  return Math.abs(p.x) < 29 && p.z > northShoreZ(p.x) - 12 && p.z < northShoreZ(p.x) + 5;
}
export function boardPoint(index: number): SkimPoint {
  const board = SKIM_BOARDS[index] ?? SKIM_BOARDS[0];
  return { x: board.x, z: northShoreZ(board.x) - 6.1 };
}
export function nearbySkimBoard(p: SkimPoint): number | null {
  // Select the nearest planted board, not the first overlapping pickup zone.
  // The three colors form a compact display, so deterministic proximity matters.
  let nearest: number | null = null, minDistance = 2.15;
  for (let i = 0; i < SKIM_BOARDS.length; i++) {
    const board = boardPoint(i);
    const distance = Math.hypot(p.x - board.x, p.z - board.z);
    if (distance < minDistance) { minDistance = distance; nearest = i; }
  }
  return nearest;
}
export function skimOffshore(p: SkimPoint): number { return p.z - northShoreZ(p.x); }
/** Crest translates toward negative Z. Its exact phase also positions rendered foam. */
export function waveCrestOffshore(index: number, seconds: number): number {
  const repeat = SKIM_WAVE_SPACING * 5;
  return -10 + (((23.4 + index * SKIM_WAVE_SPACING - seconds * SKIM_WAVE_SPEED) % repeat) + repeat) % repeat;
}
/** Longshore phase variation keeps crests irregular, without letting the
 * rendered ribbon drift away from the collision and scoring wave field. */
export function waveCrestAtX(index: number, x: number, seconds: number): number {
  return waveCrestOffshore(index,seconds)
    // Different segments peel across the beach instead of forming
    // mechanically straight, full-width rectangular walls.
    + 1.02*Math.sin(x*.135 + seconds*.33)
    + .38*Math.sin(x*.38 - seconds*.22);
}
/** A shoaling shoulder, steep forward face and short collapsed back.
 * The positive displacement is the *offshore* side of a shoreward-traveling
 * crest. The asymmetric geometry is also sampled by the renderer and board. */
/** Blend surf into open water near the finite north beach edges. */
export function skimSurfEnvelope(x:number):number {
  return 1-smooth((Math.abs(x)-23)/8);
}
export function skimWaveAt(p: SkimPoint, seconds: number): number {
  const offshore = skimOffshore(p);
  if (Math.abs(p.x) > 36 || offshore < -4 || offshore > 40) return 0;
  let crest = 0;
  for (let i = 0; i < 5; i++) {
    const delta = offshore - waveCrestAtX(i, p.x, seconds);
    // The leading (shoreward) face is steep, with a longer smooth swell
    // shoulder behind it. This avoids a row of symmetric raised bars.
    const width = delta < 0 ? 1.8 : 5.4;
    const profile = Math.exp(-Math.pow(delta / width, 2) * 1.75);
    crest = Math.max(crest, profile);
  }
  return crest * smooth((offshore + 3) / 6) * (1-smooth((offshore-34)/6)) * skimSurfEnvelope(p.x);
}
/** Whitewater trails landward of the breaking lip. Breaking intensifies
 * within the shallower half of the north-shore shelf. */
export function skimBreakAmountAt(p: SkimPoint, seconds: number): number {
  const offshore = skimOffshore(p);
  if (Math.abs(p.x) > 32 || offshore < -4 || offshore > 31) return 0;
  let foam=0;
  for(let i=0;i<5;i++){
    const delta=offshore-waveCrestAtX(i,p.x,seconds);
    const trailing=smooth((delta+7)/3)*(1-smooth((delta+.15)/1.1));
    foam=Math.max(foam,trailing);
  }
  return foam * (1-smooth((offshore-19)/13)) * smooth((offshore+2)/5) * skimSurfEnvelope(p.x);
}
/** Swash reaching a thin film across the wet foreshore. */
export function skimWashDepthAt(p: SkimPoint, seconds: number): number {
  const offshore=skimOffshore(p);
  if(Math.abs(p.x)>31 || offshore < -4 || offshore > 12)return 0;
  const spread=1-smooth((offshore-5)/7);
  const onSand=1-smooth((offshore+3.3)/5);
  const pulse=.04+.10*Math.max(skimBreakAmountAt(p,seconds),
    .5+.5*Math.sin(seconds*1.25+p.x*.085));
  return Math.max(0,pulse*spread*onSand);
}
export function skimWaterHeight(p: SkimPoint, seconds: number, seaSurface: number): number {
  const offshore=skimOffshore(p);
  const shoal=1.15+.55*(1-smooth((offshore-10)/22));
  return seaSurface + .035*skimSurfEnvelope(p.x) + skimWaveAt(p, seconds)*shoal;
}
export type SkimSurfaceAt=(p:SkimPoint,seconds:number)=>number;
const waterSupport:SkimSurfaceAt=(p,t)=>skimWaterHeight(p,t,0);
/** Signed distance to the nearest translating crest; a wave index alone is
 * never sufficient to award a catch or a launch. */
export function skimWavePocket(p:SkimPoint,seconds:number){
  const offshore=skimOffshore(p);
  let index=0,delta=Infinity;
  for(let i=0;i<5;i++){
    const d=offshore-waveCrestAtX(i,p.x,seconds);
    if(Math.abs(d)<Math.abs(delta)){delta=d;index=i;}
  }
  return {index,delta,face:skimWaveAt(p,seconds),breaking:skimBreakAmountAt(p,seconds)};
}
export function skimLipCrossing(a:SkimPoint,b:SkimPoint,fromTime:number,toTime:number,
 heading:SkimPoint,speed:number):boolean{
  if(speed<7.5||heading.z<.3||skimOffshore(b)<2||skimOffshore(b)>24)return false;
  const before=skimWavePocket(a,fromTime),after=skimWavePocket(b,toTime);
  return before.index===after.index&&before.delta<-.08&&after.delta>=-.08&&
    after.delta<1.8&&after.face>.65;
}
function launchSkim(s:SkimHeat,p:SkimPoint,t:number,impulse:number,
 kind:SkimHeat["launchKind"],surfaceAt:SkimSurfaceAt):SkimHeat{
 return {...s,air:.025,verticalSpeed:impulse,flightY:surfaceAt(p,t)+.025,
  airElapsed:0,airDuration:2*impulse/13.8,trickStart:0,trickDuration:0,
  spin:0,pendingTrick:null,launchCooldown:1.35,launchKind:kind};
}
export type SkimBoardContact={centerY:number;pitch:number;roll:number;
  noseY:number;tailY:number;leftY:number;rightY:number;wash:number};
/** Five-point planing contact, shared with the render pose. The sand and
 * ocean never compete for the board's support height at the shoreline. */
export function skimBoardContact(
  p:SkimPoint,heading:SkimPoint,seconds:number,seaSurface:number,
  floorAt:(p:SkimPoint)=>number,
):SkimBoardContact {
  const dir=normalize(heading),right={x:dir.z,z:-dir.x};
  const at=(along:number,across:number):SkimPoint=>({
    x:p.x+dir.x*along+right.x*across,
    z:p.z+dir.z*along+right.z*across,
  });
  const sample=(point:SkimPoint)=>{
    const floor=floorAt(point);
    const offshore=skimOffshore(point);
    const wave=skimWaterHeight(point,seconds,seaSurface);
    const swash=skimWashDepthAt(point,seconds);
    // Blend contact across wet sand; no floating across bone-dry inland.
    const wet=offshore>-.8 ? wave :
      Math.min(wave,floor+Math.max(.018,swash));
    return Math.max(floor+.045,wet);
  };
  const noseY=sample(at(.82,0)),tailY=sample(at(-.82,0));
  const leftY=sample(at(0,-.4)),rightY=sample(at(0,.4));
  const pitch=clamp(-Math.atan2(noseY-tailY,1.64),-.58,.58);
  const roll=clamp(Math.atan2(rightY-leftY,.8),-.42,.42);
  // Support a rigid planing footprint at all five samples, including convex
  // crests. Center-only contact let the nose cut straight through the face.
  const centerY=Math.max(sample(p),noseY+Math.tan(pitch)*.82,
    tailY-Math.tan(pitch)*.82,leftY+Math.tan(roll)*.4,rightY-Math.tan(roll)*.4);
  return {centerY,pitch,roll,noseY,tailY,leftY,rightY,
    wash:skimWashDepthAt(p,seconds)};
}
export function idleSkimHeat(): SkimHeat {
  return { phase: "off", board: null, remaining: SKIM_HEAT_SECONDS, score: 0,
    ridePoints: 0, rides: 0, speed: 0, heading: { x: 0, z: 1 }, air: 0,
    verticalSpeed: 0, spin: 0, airElapsed: 0, airDuration: 0,
    trickStart: 0, wrapCooldown: 0, trickCallout: "", trickCalloutTime: 0,
    pendingTrick: null, repeats: {},
    lastTrick: "", waveHits: 0, recovery: 0, flightY:null, launchCooldown:0,
    launchKind:"none",waveRideSeconds:0,trickDuration:0 };
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
    pendingTrick: null,flightY:null,launchCooldown:0,launchKind:"none",waveRideSeconds:0,trickDuration:0 };
}
function commitRide(s: SkimHeat, clean: boolean): SkimHeat {
  const points = Math.round(s.ridePoints * (clean ? 1.2 : 0.35));
  return { ...s, phase: s.remaining <= 0 ? "finished" : "recovering",
    score: s.score + points, rides: s.rides + 1, ridePoints: 0,
    air: 0, verticalSpeed: 0, spin: 0, airElapsed: 0, airDuration: 0,
    trickStart: 0, pendingTrick: null, flightY:null,launchKind:"none",trickDuration:0, trickCallout: clean ? "Clean ride!" : "Wipeout",
    trickCalloutTime: 2.0, recovery: clean ? 0.45 : 1.2,
    lastTrick: clean ? `Clean ride +${points}` : `Wipeout +${points}` };
}
export function skimAction(s: SkimHeat, trick: "pop" | SkimTrick, p: SkimPoint, seconds: number, surfaceAt:SkimSurfaceAt=waterSupport): SkimHeat {
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
    if(s.air>.01||s.speed<4)return s;
    const face=skimWavePocket(p,seconds);
    const lip=face.face>.45&&Math.abs(face.delta)<2.2;
    return launchSkim(s,p,seconds,lip?Math.min(8.2,5.8+s.speed*.16):3.8,
      lip?"lip-air":"flat-pop",surfaceAt);
  }
  if(s.air<=0||s.pendingTrick)return s;
  const remaining=(s.verticalSpeed+Math.sqrt(s.verticalSpeed*s.verticalSpeed+2*13.8*s.air))/13.8;
  // Don't score a last-frame button press with no time for a visible rotation.
  if(remaining<.22)return s;
  return {...s,pendingTrick:trick,trickStart:s.airElapsed,
    trickDuration:Math.max(.18,Math.min(.62,remaining*.84))};
}
const TRICK_POINTS: Record<Exclude<SkimTrick, "wrap">, number> = {
  shuvit: 130, "big-spin": 220, "three-sixty": 280,
};
/** Fixed-step friendly heat logic. Incoming waves add momentum but never teleport the rider.
 * Scoring is paid on landing/ride completion, never merely on pressing a trick key. */
export function stepSkimHeat(
  state: SkimHeat, p: SkimPoint, dt: number, seconds: number,
  steer: number, pumping: boolean, surfaceAt:SkimSurfaceAt=waterSupport,
): { heat: SkimHeat; point: SkimPoint } {
  const step = clamp(dt, 0, .05);
  if (state.phase === "off" || state.phase === "finished") return { heat: state, point: p };
  const remaining = Math.max(0, state.remaining - step);
  let s: SkimHeat = { ...state, remaining,
    wrapCooldown: Math.max(0, state.wrapCooldown - step),
    launchCooldown:Math.max(0,state.launchCooldown-step),
    trickCalloutTime: Math.max(0, state.trickCalloutTime - step) };
  if (s.phase === "recovering") {
    s = { ...s, recovery: Math.max(0, s.recovery - step) };
    if (s.recovery === 0) s.phase = "ready";
  }
  if (s.phase !== "riding") {
    return { heat: remaining === 0 ? { ...s, phase: "finished" } : s, point: p };
  }
  // An accessible, optional return carve starts after meeting a swell.
  // A/D always takes priority, while a neutral stick follows the break
  // back to shore rather than drifting into a distant wipeout.
  const offshoreStart=skimOffshore(p);
  const assist=s.waveHits>0 && offshoreStart>10 && s.heading.z>-.87 &&
    Math.abs(steer)<.15 ? 2.65*step : 0;
  const turn=clamp(steer,-1,1)*(s.air>0?.85:1.75)*step+(s.air>0?0:assist);
  const a=Math.atan2(s.heading.x,s.heading.z)+turn;
  const heading = { x: Math.sin(a), z: Math.cos(a) };
  const wave = skimWaveAt(p, seconds);
  const pocket=skimWavePocket(p,seconds);
  const caught=s.air<.02&&heading.z<-.12&&pocket.delta>-3.6&&pocket.delta<.6&&wave>.16;
  // Momentum comes from riding the shoreward face. Pumping on deep flat water
  // cannot act like a motor; on thin wash it mainly preserves the run-up.
  const pump=pumping&&s.air<.02?(offshoreStart<1?1.6:wave*1.5):0;
  const drive=caught?4.6*wave:0;
  let speed=clamp(s.speed+(pump+drive-.60-Math.abs(steer)*.42)*step,0,16);
  const point={x:p.x+heading.x*speed*step,z:p.z+heading.z*speed*step};
  if(s.air<=0&&s.launchCooldown<=0&&
    skimLipCrossing(p,point,seconds-step,seconds,heading,speed)){
    s=launchSkim({...s,waveHits:s.waveHits+1},point,seconds,
      Math.min(8.2,5.8+speed*.16),"lip-air",surfaceAt);
    s.trickCallout="Lip air! · Q / E / F";s.trickCalloutTime=1.3;
  }
  s.waveRideSeconds+=caught?step:0;
  let air = s.air, verticalSpeed = s.verticalSpeed, spin = s.spin;
  let airElapsed = s.airElapsed;
  let ridePoints = s.ridePoints + wave * speed * step * .6;
  let waveHits = s.waveHits;
  if(wave>.68){
    if(waveHits===0)waveHits=1;
    if(s.heading.z<-.1)ridePoints+=10*step;
  }
  if (air > 0) {
    const flightY=(s.flightY??surfaceAt(p,seconds-step)+air)+verticalSpeed*step-.5*13.8*step*step;
    verticalSpeed -= 13.8 * step;
    s.flightY=flightY;
    air=flightY-surfaceAt(point,seconds);
    airElapsed += step;
    if (s.pendingTrick) {
      // Trick assist finishes a visually complete rotation before landing,
      // without asking the player to time fractional key presses.
      const progress = clamp((airElapsed - s.trickStart) /
        Math.max(.18,s.trickDuration), 0, 1);
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
        if (speed >= 4.1 && spin>=Math.PI*2*.90) {
          ridePoints += bonus;
          const title = trick === "shuvit" ? "Shuv-it" : trick === "big-spin" ? "Big spin" : "360";
          s = { ...s, repeats: { ...s.repeats, [trick]: count + 1 },
            trickCallout: `${title} +${bonus}`, trickCalloutTime: 1.8,
            lastTrick: `${title} landed +${bonus}` };
        } else speed = 0;
      }
      verticalSpeed = spin = 0;
      airElapsed = 0;
      s = { ...s, pendingTrick: null, airDuration: 0, trickStart: 0, flightY:null,trickDuration:0 };
    }
  }
  s = { ...s, speed, heading, air, verticalSpeed, spin, airElapsed, ridePoints, waveHits };
  const offshore = skimOffshore(point);
  const clean = s.air<=0 && offshore < -9 && (s.waveHits > 0 || ridePoints > 35);
  if (clean) s = commitRide(s, true);
  else if (speed < 2 || offshore > 29 || Math.abs(point.x) > 30 || offshore < -15) s = commitRide(s, false);
  else if (remaining === 0) s = commitRide(s, false);
  return { heat: s, point };
}
