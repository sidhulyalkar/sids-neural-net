# World Challenges v1: riding terrain, field puzzles, racing and alpine big air

**Status: IN DEVELOPMENT.** Scoped 2026-10-10. Owner: World lead / Astra integration.
The ledger below distinguishes implementation from remaining visual qualification.

## Implementation ledger (2026-10-10)

- **P1 technical-trail prototype implemented on `feat/sids-world`:**
  `lib/world/technicalFeatures.ts` authoritatively defines three deterministic
  compact rock gardens (two Joshua lines, one redwood weave) and three
  low taper-ended beams (two redwood, one scrub). Terrain mesh overlay,
  small stones and plank geometry share the analytic heights used by
  rider support. All visuals are baked into **one extra mesh**, with
  explicit disposal and corridor clearance. This is a first terrain
  prototype, not a claim of high-fidelity bike suspension or tire physics.
- **P2 Joshua Adventure Lap MVP implemented:** `lib/world/trials.ts`
  contains ordered 12-gate swept crossing validation, direction,
  mode, continuity, corridor and gap-bypass fairness checks. The existing
  World dock offers an opt-in Joshua Lap start, a compact running
  timer/checkpoint HUD, finish/retry and a versioned local personal best.
  Stakes appear beside the actual shared track route. The app does not
  require signup or offer a global leaderboard. The release is contingent
  on both CI and manual browser riding/UX signoff.
- **P0 ski-flight *preliminary survey* scripted:** `scripts/audit-ski-flight.ts`
  tests plausible run-ins, headings and initial ballistic trajectories
  against analytic terrain, coasts, caves, existing destination markers
  and sport corridors, exporting a machine-readable CI artifact.
  It **does not** prove any landing corridor safe against vegetation,
  3D scene props or camera clipping. A first playable Big Air jump has since
  been implemented; these remain independent browser-release gates.
- **P3 Alpine Big Air implemented as an opt-in first playable prototype:**
  an extended downhill run-in begins around (-2,-65), with the ski lip at
  (-2,-49). The continuous compacted-snow takeoff is a terrain height offset
  sampled by feet/skis and by a high-resolution localized snow mesh; a
  narrow footprint preserves the adjacent bowl-small kicker's approach
  and landing grade. `lib/world/bigAir.ts` owns forward swept takeoff
  qualification, minimum approach speed, bounded launch impulse, fixed
  ≤12.5ms substeps, swept real-heightfield touchdown, distance/airtime
  scoring, stop conditions and safe exit status. The World UI offers
  **Alpine Big Air · start**, real flight distance, a locally stored
  versioned best *successful landing*, and retry/explore.
- **Browser QA extended:** `scripts/playtest-world.mjs` now attempts
  actual ski launch by W input, captures approach/macaw-flight/landing,
  asserts 3 bird companions, visible named distance callouts, a clean
  landing and a range bounded by the terrain survey. World CI syntax-checks
  the script; **actual graphical browser execution is still pending**.
- **Bird escort (requested):** two macaws and a green parrot fly in a
  3-bird formation alongside the skier **only in Big Air free flight**.
  `worldBigAirBirds.ts` uses three instanced geometry batches, with
  animated wingbeats and no shadows or automatic audio. Subtle named
  macaw **text** callouts report 10-world-unit distance milestones;
  the HUD shows the continuously measured distance. An optional **Bird
  distance voice** toggle explicitly enables local browser speech synthesis
  of the same milestones, capped to one call per ten units with old
  queued audio cancelled. Default is silent, external voices/files are
  not downloaded, and if the browser lacks speech support the text remains.
  These are
  stylized birds accompanying a skier across this fictional multi-biome
  world, not a natural alpine ecological claim. There is no synthesized
  custom animal voice asset. Browser TTS is optional and generic.
- **Qualification remains required:** continuous real-browser ride/flight
  screenshots, mobile HUD fit, real camera framing, bird visibility,
  landing-site vegetation, frustum/draw-call budgets, Shasta ground
  behavior and full runout recovery. Game distance is expressed in
  virtual world meters, not measured GPS distance.
- **Not yet implemented:** environmental puzzles (granite counterweight,
  deadwood bridge, canopy light), alpine slalom, ghost replay,
  and technical-section speed trials.
- **CI evidence:** [World Landscape Regression run 38085071146](https://github.com/sidhulyalkar/sids-neural-net/actions/runs/38085071146)
  passed **93/93** world tests, TypeScript, strict lint, existing scene
  validation and all three generated audit reports. The ski-flight survey
  found **4 provisionally clear candidates** out of 45 coarse ballistic
  cases; the current top trajectory, (-2,-49) -> (-2,-4.3), travels
  approximately **44.7 world units**. That is NOT a physically/visually
  approved ski-flying receiving slope.
- **Go/no-go:** physical browser preview inspection for beams and rocks,
  at least one manually completed non-cheating lap, mobile review,
  terrain/vegetation/camera clearance along the ski jump path, and actual
  island renderer draw/triangle budgets remain necessary. Site-wide
  security/FRONTIER failures are separately tracked, never bypassed.


Authority: [world biome master](astra-world-biome-master-spec.md) governs terrain, cave, waterfall and region identity. [island expansion vNext](astra-island-expansion-vnext-spec.md) governs Joshua lap, gapped jumps, ecology, fish, tridents and budgets. This document is newest authority only for **optional World challenges, technical features, time trials and alpine distance-jump gameplay**.

## 1. Product goals and creative constraints

World Mode remains a visually grounded, personal exploratory portfolio. Add reasons to interact with its terrain and move between regions. Challenges are **discoverable but never mandatory**, and no puzzle should gate personal content, an existing arcade game, the Paper Archive or a website navigation path.

Design from exploration, not from collectible gamification:
- One evocative shape or physical situation communicates each activity: a cairn and start flags for a time trial, low hewn timber for a beam, eroded rock for a technical descent, a snowy run-in and sculpted jump for big air.
- Every puzzle teaches an observable local rule, then invites experimentation and at least two possible approaches. No arbitrary passwords, glowing rune walls, giant trophy pillars, particle fireworks, grinding currency, streaks, intrusive floating instructional prose, or Zelda imitation.
- Optional challenge UI: one small contextual prompt when near the actual start and a compact overlay during an active run. End-of-run: time/distance, personal best and restart/leave. No persistent heads-up display in free exploration.
- Choose material variety over prop count. Natural rocks and fallen wood should have visual weight and interact with the existing wheel/skis/feet contact model. Challenge props do not invent changes to slope, surface or collider state.
- Discovery anchors should connect lightly to *actual* interests (mountain biking, ski jumping, climbing, signal processing, bioengineering) without forcing a portfolio link after every checkpoint. Personal projects remain available through their existing routes.
- Retain direct movement, controls, reduced-motion support, fall recovery, Shasta following, cave and waterfall geometry, existing data provenance, island biome distinction and accessible alternate navigation.

## 2. As-built facts and integration seams (read source when implementing)

Current branch feat/sids-world, planned against `cf3413d2d3fdcbf1cfe068f968d70742ce3b8929`.
- `DESERT_TRACK_LENGTH ≈ 305.4886` is one closed loop in `lib/world/desertTrack.ts`. Three riding chapters include safe tabletop, excavated dead-Joshua and dry-arroyo gaps. `desertTrackFrame(p).s` is cumulative centerline distance. `desertTrackGroundRoute()` is an independent walkable/slow route around both pits. Existing bypasses must remain.
- `lib/world/activities.ts` owns `stepTravel`, `rampImpulseAt`, `rampImpulseCrossing`, `stepAirborne`, `RIDE_RAMPS`, `FALLEN_LOGS` and `SPORT_ROUTES`. Existing ski `config.speed` is 15 before slope modulation; `stepAirborne` uses vertical acceleration 14 and `rampImpulseAt` caps launch impulse at 9. **These physics are arcade-like, not physically measured skiing.**
- `lib/world/model.ts` terrain is an analytic Gaussian mountain plus authored drainage and cave entrance cuts. World bounds: x[-92,94], z[-96,58]. Arcade cave is centered near (16,-82) and waterfall/Paper Archive around (-20,-30). Ski bowl route follows x≈1 from z=-59 towards z=-8. Redwood grove centered near (0,8). Desert basin lies east, with long course using roughly x≈10..55 and z≈-60..9. Rainforest occupies northeast and the coasts are x≈-34 and x≈58.
- Current alpine ramps: `ski-kicker` (8,-47), `bowl-small` (1,-51), `bowl-medium` (1,-37), `bowl-large` (1,-22), `tree-kicker` (-9,-44). Existing fallen sport logs include `bowl-slide`, `tree-run-slide`, `ridge-log` and `grove-log`.
- `components/world/worldRenderer.ts` owns the render frame, camera and event dispatch, and exceeds 4,000 lines. **Do not add puzzle evaluation loops, timekeeping logic or long-run animation meshes directly to it.** Route a small adapter into a pure challenge engine and independent feature builders.
- `components/world/WorldHome.tsx` has the menu/dock/dialog, region navigation, accessibility and existing photograph/project panels. The challenge HUD belongs to a thin component, not new permanent generic nav chrome.
- Current worst-combined-scene budget remains **<100 draw calls**; typical active biome ≲70, <90,000 visible triangles and ≲100 renderables where possible. Profile against the actual *current* branch, not historical screenshots.

## 3. World-level placement master plan

All coordinates below are **planning neighborhoods**, not approved exact positions. Mandatory terrain height, grade, exclusion, water, cave, sport-clearance, view-frustum and screenshot audit must choose final authored points.

| Place and neighborhood | Challenge role | Existing anchors / caution | Primary mode |
| --- | --- | --- | --- |
| Joshua basin (x24..55, z-57..-8) | full-lap timer, optional rock gardens, quick berm/technical section | sample by course arclength and avoid two gap runouts, track branches, passing lanes and log bypasses | bike; skate on qualified sections |
| Scrub margin (x12..24, z0..18) | optional low stone-line and 2–3 timber balance beams | retain direct route to grove and neural region, do not crowd the wide lap return | bike/skate/on foot |
| Redwood grove and deadwood (x-18..8, z-12..30) | balance trail, low log crossing, balance-and-weight puzzle | preserve walkable path to /about and existing grove ramp | walk, bike, skateboard |
| Upper alpine / open bowl (x-9..13, z-63..-25) | slalom, jump progression, large ski-flying run-in | must not carve above Arcade cave, sever meltwater, or obstruct established tree line | ski |
| Lower open scrub or meadow (tentative x8..25, z0..25) | planned big-air receiving slope and safe runout | protected against grove trunks, neural markers, desert outer lap, coast and shallow water | ski |
| Fern Falls approach (x-25..-13, z-35..-19) | subtle meltwater side-channel puzzle | existing glacier -> creek chain and research-paper cave remain intact | walk |
| Rainforest canopy trail (x30..55, z28..50) | branch/light/water observation puzzle and optional canopy crossing | do not damage flora, photo-sloth tree or modeled snakes/birds | walk |
| Kelp/lagoon underwater | pack-shape observation/current gates | physical tridents accessible independently, reef fauna cannot be hunted/collected | snorkel/dive |

The goal is varied reasons to travel through existing places, not two new biomes filled with artificial challenge landmarks. Every new feature gets a human-readable `region`, `approach`, `recovery`, `bypass`, `material budget` and `exclusion` footprint.

## 4. Technical riding: authentic low-cost features

### 4.1 Three rock-garden families

1. **Desert chunder** (easier): a lightly rocky straight with 8–14 uneven embedded stones and two natural lines. Some stones are rideable heightfield bumps; out-of-line boulders are actual side obstacles.
2. **Granite squeeze** (intermediate): 2–3 larger rounded embedded stones and a narrow but visually clear route, followed by a neutral rolling exit. Optional low roll/drop. Never place directly before a real gap lip.
3. **Redwood root-and-rock weave** (technical): tree roots and wet-looking but non-slippery-looking stone patches, staggered line choice and one fallen-log rollover. Avoid pretending the player can bounce an entire bike tire over tall separate collision cylinders.

Each family has a deterministic seed, a bounded oriented footprint, lane choice, grade envelope, obstacle list, rider eligibility and explicit approach/exit. Make rideable stones through a localized smooth heightfield modifier that both `terrainHeight` and the mesh sample; stones which should stop a wheel use matching physical collider volumes. Respect frame-step swept collisions and no repeat impulse when clipping stone edges.

Target authored prototype: 3 patches, each approximately 6–12 world units along-course and 2–5 wide. Final values from riding tests. Material budget: reuse existing granite geometry and vertex-color batches; do not add a mesh per pebble.

### 4.2 Narrow timber balances / low bridges

- A **Redwood Deadwood Traverse** of 2 short log beams and one optional connecting boulder; the first beam nearly flush with ground, second elevated a modest safe amount. Slight fork in route gives difficulty choice.
- One low **scrub-crossing rail** or fallen beam next to the Joshua loop, but outside the measured lap's time-trial corridor.
- Optional traversable narrow stone spine near climbing ledges after the initial test passes.

Physics must distinguish **support** from scenery: entering a beam from its ramped end, continuous surface height sampled from its centerline/width, edge fall-off to the actual ground and safe recovery. Current `groundHeight` knows ramps/boulders but not beams. Implement a local beam support resolver integrated into `stepTravel`/render foot-wheel contact, not a floating mesh with no real surface. The rider should have a forgiving lateral window, mild balance cues through animation and steering, and no forced instant fail/reset. Do not add a QTE to stay on the log.

Balance challenge scoring rewards uninterrupted beam distance, low steering oscillation, and clean exits; normalize by difficulty. Walking bypass guaranteed. Bike/skate eligibility only after geometry clearance and visible wheel-ground agreement.

### 4.3 Natural rock rolls and small drops

Two hand-authored sloped granite ledges for downhill/skate (never random repeating boulders); low optional drop, landing with slope consistent with surface contact, and a bypass. No friction values claiming real tires or braking. Existing bike/board slope bug regressions must remain green.

## 5. Optional timed challenges: start gates, checkpoints, replay

### 5.1 Joshua Full Lap time trial

One authenticated-on-client, **local personal best** around the existing ~305.5-unit track. Start point must be outside immediate rock gardens, ramps and two gap takeoffs; choose via centerline arclength after measurement. Challenge route tracks `desertTrackFrame.s` and authored ordered checkpoint planes on the centerline:
- 10–14 evenly distributed **meaningful gates** plus close-together checks around possible shortcut/bypass divergences, sparse visually (two wooden stakes/soil-colored flags or stones, not laser rings).
- Use **swept segment-plane intersections** from previous/current position to confirm crossing; never rely solely on player being within a radial checkpoint zone at a frame sample.
- Reject wrong-way crossing, jumping over a gate outside altitude bounds, skipping checkpoints, teleport/menu transfer, leaving the designated corridor for a long enough grace distance, or pausing and reentering the world with a stored active timer. Provide clear "run invalidated" feedback and a quick retry.
- Gaps are optional expert shortcuts? The normal **official route** should explicitly declare whether two authored bypasses are legal. Recommendation: separate "Adventure Lap" (both bypasses allowed, slower path; novice-inclusive) and "Gap Sprint" (must cross both lips; expert). NEVER compare times across different course variants.
- A clock begins on crossing the start plane after an optional 3-2-1 countdown and stops on finish gate, only after all required checkpoints. Stable monotonic simulation time, no frames-as-time. Do not count menus or tab inactivity as competitive run time.
- Show current time, checkpoint number and optional split difference to personal best; bottom corner HUD only while active. On exit: elapsed, misses/penalties, personal best, Retry/Explore, no giant trophy cutscene.
- A local **ghost** may replay the previous best path at a bounded 8–10 Hz, compressed position/heading/time samples, visually distinct and optionally disabled. No reusing existing Shasta companion for a ghost and no live multilateral leaderboard.

### 5.2 Technical Section time trial

60–90 world units of an authored rock-and-berm line on the Joshua course, with precision gates and optional short branching routes. Grade and rock collider physics should matter. Personal best saved under a distinct versioned ID, never mixed with Full Lap records.

### 5.3 Alpine tree-run slalom

An independent gate sequence through existing x≈-9 tree-run with 2 alternative difficulty channels. Ski mode only; a missed gate invalidates a competitive record, but user can continue skiing. Trees remain natural and not unfair collision traps.

## 6. Big Air: signature ridge-to-valley ski flight

**Creative goal:** a dramatic ski jump where the player accelerates downhill, leaves a sculpted snow-and-earth lip, gets a panoramic chase/side camera as the island opens beneath, and lands on a broad far meadow or snowfield. The world should feel traversed by air, not as if a giant spring appeared under the skis.

**Do not advertise a literal full-island crossing until geometry supports it.** Existing bounds are 186x154; launch/gravity/collision and terrain relief limit a credible safe flight. First target a ridge-to-lower-valley airborne trajectory visually spanning multiple regions, **approximately 45–80 world units**, then measure actual feasible range before selecting distances or metal score thresholds. A longer flight is a version 2 option contingent on extending safe land and camera/render distance.

### 6.1 Placement and visual language

Preliminary flight corridor: upper/open mountain bowl, with run-in from z≈-60..-40 and northeast/north lower valley as candidate landing. **Not authorized coordinates** until signed terrain section and visual audit. Preserve:
- Arcade cave roof/entrance at x≈16,z≈-82.
- Snowmelt and Fern Falls watershed west of the bowl.
- Open bowl medium/large existing kickers (x1,-37 and x1,-22); do not create overlapping launch triggers.
- Redwood grove at (0,8), neural marker at (30,-5), desert outer return, both coastlines, all existing meaningful interactive routes.
- Public exploration must not be directed into a tree, water shelf, cave rock, NPC or photo marker at expected landing velocities.

The run-in needs (1) long accelerating incline, (2) one gentle compressional hollow, (3) smooth convex takeoff leading to a clear raised lip and (4) **independent broad, descending receiving slope** with 20+ units of clean runout. A bright natural edge, snow berm and sparse flag posts make the ramp readable from distance. Do not add vertical steel ski-jump towers or floating snow decks to disguise terrain problems.

### 6.2 Challenge-local flight dynamics, not a global physics rewrite

Current `stepAirborne` gravity=14 and launch impulse max 9. **These cannot fly dramatically far enough** at normal ski velocities. Add a distinct opt-in `bigAirFlight` mode with validated arc mechanics and clear constraints:
- Ski mode and physically correct approach/heading across one swept lip plane are required.
- Build approach velocity from actual run-in speed plus an opt-in crouch/extension timing mechanic. Space already controls actions/grinds: only reinterpret contextually while a Big Air attempt is armed. No global control change.
- Challenge may use higher bounded launch vertical speed and existing downhill horizontal travel (initial hypothesis roughly 16–24 launch units/s and 16–23 horizontal units/s, pending calibration). Keep gravity physically continuous; don't silently reduce it to make the flight work. Use a dedicated local state/impulse and explicit release velocity.
- Integrate (x,z,y,verticalVelocity) with stable fixed physics increments or bounded substeps, **swept landing collision** to catch contact even if a render frame skips the ground surface. No instantaneous teleport along an arc. If input steering midair exists, it is limited and explained via body angle/air control.
- Run-time performance and camera must work when airborne high above the ordinary surface: chase distance/zoom, pitch smoothing, fog clipping, shadow disabling at extreme distance, audio optional, no camera passing through mountain.
- Flight scoring: horizontal distance projected from launch along flight vector, total airtime as separate field, `landingQuality` based on real slope alignment/impact velocity and whether fully in landing/runout polygon. Off-axis or water impact is a **safe failed attempt** with in-world recovery, not infinite flight or crash loop.
- No boost exploit by reverse approaches, re-crossing plane, resetting mode midair, or arbitrary manual jump repeats.
- **Fallback**: skip challenge and ski ordinary bowl; recovery button returns to safe takeoff if desired; Shasta waits safely at the launch/landing area and does not follow into the sky.

### 6.3 Progressive ski jump line

Before the headline jump, the existing bowl already has small/medium/large ramps. Wrap them into an optional training sequence: 3 distance gates, stable landing feedback and one deliberately scary but safe final launch. Do not add more jumps until existing geometry is actually qualified.

**Update 2026-10-10:** The Granite, Deadwood and Rainforest Light puzzle trilogy is **deferred at user request**. Its experience spec remains archival design exploration, not a delivery requirement. The new near-term gameplay milestone is [Island Disc Golf v1](astra-disc-golf-v1-spec.md), with moving chain baskets, wind, three-tap double meter, landing beacon and free water redos. Do not implement the trilogy unless explicitly requested later.

## 7. Five environmental puzzles, no borrowed game assets

**The three v1 puzzles are now specified in detail by [Astra Puzzle Trilogy: Experience-First Design Contract](astra-puzzle-trilogy-experience-spec.md).** That document supersedes the older one-row descriptions below where they differ. Puzzles remain *design-complete, not implemented*. Build **three for v1**, then evaluate engagement before adding the other two. All puzzles have explicit local rules, visible cause/effect, multiple solution paths, reset, optional hint and bypass, with no mandatory website gating or narrative filler.

| Puzzle / world area | Player observes | Interacts / solves | Alternate solution or accessibility |
| --- | --- | --- | --- |
| **Granite Counterweight / Balanced Ridge** (survey dry ridge shoulder) | naturally tilted granite slab, pivot, near/far depressions and four loose stones | arrange weight by lever arm, with two legitimately different stone combinations leveling a walkable crossing | follow the longer natural ridge route; no exclusive project-page access |
| **Deadwood Bridge / Nurse Log** (survey north redwood gully) | existing fallen tree, slightly unstable span and a smaller bracing branch near two root notches | wedge a *small* branch below a **fixed main log**, or attempt the narrow balance crossing unbraced | walk around the gully, with no forced fall, teleport or puzzle lock |
| **Rainforest Light / Canopy Window** (survey canopy trail) | broad hanging fronds shade root steps and dappled forest floor | move leaf occluders to expose the route, or observe the path from a higher root perch | longer existing forest trail remains usable; foliage blocks sunlight rather than reflecting magical light |
| **Meltwater Diversion** (Fern Falls side rill) | two small low-profile stone deflectors affecting a tiny *side* flow | align outlets to fill a little shallow basin | use high bank stepping stones to reach end point directly; NEVER alter original snowmelt->falls discharge |
| **Reef Current** (clear lagoon channel) | floating marker oscillates within authored tide flow while a shoal splits | rotate two submerged natural rock vanes to guide buoy through marker | follow a separate swim-through path; tridents always independently accessible |

**Important:** These are game puzzles in a stylized physics system, not claims to simulate true fluids/optics/wood statics. The interaction rules should be visible, reversible and consistent. Do not make living animals or coral collectible or interactive hazards. Use local cues and subtle geometry, not loot chests.

Puzzle completion reward: reveal a scenic overlook, optional photo/story/project insight where contextually relevant, a new optional route, or a one-line challenge-log entry. No requirement to clear them to access the website.

## 8. System architecture and state contracts

Small focused pure modules:
- `lib/world/challenges.ts`: typed registry, authored location, gating, difficulty, prerequisites = none, rules, output.
- `lib/world/challengeEngine.ts`: deterministic `start/arm/crossCheckpoint/tick/pause/finish/abort/restart` state machine, tick time from simulation with explicit pause/resume, path gates validated with swept crossing and ordered IDs.
- `lib/world/challengePersistence.ts`: locally stored, versioned JSON bests/attempt preferences with schema validation, disabled cleanly on storage errors, no backend/analytics unless separately consented. Distinct records per course variant, physics version, difficulty and activity.
- `lib/world/trials.ts`: sample technical lap checkpoints by `desertTrackSampleAt`, route witness checks, skip/shortcut detection, local time and optional replay format.
- `lib/world/bigAir.ts`: pure jump trigger, airborne trajectory, collision/landing outcomes, target score, recovery.
- `lib/world/technicalFeatures.ts`: rock-garden/beam definitions and shared terrain/obstacle/support footprint math.
- `lib/world/puzzles.ts`: small per-puzzle deterministic reducer and state snapshots, reset rules, alternate solutions.
- `components/world/worldChallengeGeometry.ts`: shared instanced rocks, timbers, small markers and puzzle geometry; one update handle per active cluster.
- `components/world/WorldChallengeHUD.tsx`: contextual UI and results panel, accessible focus and keyboard, touch controls.
- `components/world/worldRenderer.ts`: thin adapter exposing player position/heading/velocity/airborne/cave layer and consuming challenge geometry/physics deltas. Do not duplicate spatial math here.
- `components/world/WorldHome.tsx`: challenge launch, optional help and result surfaces within existing world navigation. No second menu architecture.

Illustrative types (implementation must reconcile existing `Point`):
```ts
type ChallengeId =
  | "joshua-adventure-lap" | "joshua-gap-sprint" | "joshua-technical"
  | "alpine-slalom" | "alpine-big-air" | "redwood-balance"
  | "granite-counterweight" | "deadwood-bridge"
  | "rainforest-light" | "meltwater-diversion" | "reef-current";

type ChallengeStatus = "idle" | "armed" | "countdown" | "running"
  | "complete" | "invalidated" | "aborted";

type ChallengeGate = {
  id: string;
  point: Point;
  forward: Point;
  halfWidth: number;
  minY?: number;
  maxY?: number;
  order: number;
};

type ChallengeAttempt = {
  challengeId: ChallengeId;
  status: ChallengeStatus;
  elapsedMs: number;
  checkpointIndex: number;
  penalties: string[];
  mode: "bike" | "ski" | "skate" | "run" | "dive";
};
```

Do not introduce a mutable client global singleton or a new physics engine. Use a bounded state ref updated from world simulation and event snapshots sent to React at low cadence (3–5 Hz during trials and on state transition), not every animation frame.

## 9. Design and scoring principles

- **Progression:** all challenges discoverable at any time; an optional Field Log shows local personal bests, 0% completion is a valid way to enjoy world mode. Three soft difficulty levels but no XP trees.
- **Fair competition:** world speed/physics change increments version of each benchmark. Future games must not reuse previous record tables or claim cross-version comparable times. No global leaderboard unless a secure dedicated opt-in backend is justified.
- **Reset:** no hard screen reload; clear only local session state, put explorer at a safe start, retain camera and interaction focus. Teleporting during a timed run always aborts/invalidate.
- **Shasta:** remain alive as world companion, waits safely outside gap/launch zones and does not become a puzzle switch or required checkpoint.
- **Photographic/portfolio links:** puzzle success may offer an accurately grounded relevant page but must never fabricate research history.
- **Accessibility:** field notes describe input, high-contrast checkpoint cues, toggle/hint availability, gamepad later if truly supported, keyboard focus, touch-safe UI, reduced-motion static alternatives. Time trial leaderboard is not required to browse any content.

## 10. Performance and quality budget

- Prefer `GeometryBatch` and instanced repeated rocks/wood. Static challenge pieces cost 1–3 incremental draw calls per visible chunk; no per-pebble React components.
- Only active puzzle uses frequent transform changes, on a bounded component count. Never evaluate all island puzzles every render frame.
- World gates should be shallow instanced props with no massive transparent flags. Terrain patches should be generated deterministically and cleared by correct sport/cave/waterfall masks.
- Ghost: <=10 samples/s of gameplay time, limited buffer length <=90 s for technical route and <=240 s for full lap, optional interpolation; no unbounded memory recording.
- Fix-update physics rate for ski flight; prevent allocations in critical hot path. When the player flies over chunks, frustum culling must consider **camera**, not the biome at ground position, preserving scenery below.
- Keep current visible targets: <100 draw calls worst-combined boundary, ≲70 typical, <90k triangles typical, proper disposal, adaptive DPR, paused-hidden-tab no updates. If these cannot all hold simultaneously, document measured exceptions before accepting any new visual props.
- Separate timing of physics, challenge engine, rendering and UI; snapshot p50/p95 frame times before and after each tranche and include mobile portrait.

## 11. Acceptance tests and browser evidence

**Technical features**
- Scene mesh support equals analytic support: rocks with intended wheel contact never ghost through rider, all beam entry ends reachable on run/ride, no beam teleports or hovering.
- 3 different rock-garden profiles; real line choice and distinct difficulty; no blocked approach/runout from the 305.5 loop or both excavated gaps.
- 2 balance beams playable without forced snap; falling off recovers by ordinary movement. Child-friendly walking bypass available.
- Full render-batch determinism, low collision counts and no NaNs.

**Timed competitions**
- Checkpoint crossing order and direction verified with adversarial sparse dt and swept crossing tests.
- Circumventing the start, shortcutting or teleporting cannot set records; bypass permitted only for declared Adventure variant.
- Pause, hidden tab, death/reset, region jump, mode change and re-entry have explicit fair timer/abort behavior.
- Persist and reload best time through versioned localStorage with unavailable-storage fallback. Ghost never exceeds cap and is hidden on preference.
- Full lap and technical section clearable by an ordinary player without demanding gap proficiency.

**Big-air**
- Separate true jump-plane from regular `rampImpulseAt`; run-in graded and aligned; measured speed graph with multiple inputs.
- Sweep up to 60/30/15 Hz render timing with the same fixed physics result within tolerance. Flight continues without surface snapping or ceiling/cave collision.
- Flight crosses selected mountain-to-valley sightline, lands on clear soil/snow and has generous runout. Under/over/off-axis attempts fail safely. No water forced.
- Distance and airtime reflect actual simulated trajectory, not arbitrary animation or a fixed achievement. Reverse approach, repeating launch, tricking Space, or changing mode cannot stack impulse.
- Recorded cinematic side/chase/landing screenshots and one continuous 30+ second video of run-in, launch, landing and recovery, including high and low quality.

**Puzzles**
- Three first-shipped puzzles each have discoverable local clues, reversible state, alternate solve path, no softlock, bypass to all normal content, simple reset, and deterministic behavior across scene remount.
- Existing waterfall remains the same drainage chain; Arcade cave roof and game niches survive untouched; Paper Archive entrance and photo memories reachable.
- Each puzzle offers one meaningful action beyond clicking a static completion badge.

**Browser matrix**
- Chrome, Firefox (desktop), a touch viewport, desktop keyboard only, reduced motion, hidden tab/resume, route navigation, world restart, context loss, and mobile DPR reduction.
- Screenshot before/after rock garden and beam from a rider approach angle, checkpoint markers from moving bike, large ski jump from lip/side/landing and puzzle initial/solved states.
- No claims of complete release from unit tests alone.

## 12. Prioritized delivery sequence and stop criteria

**P0. Survey / compatibility contracts** (required): sample ski run-in/landing trajectories, inspect route clearance and protected content, create candidate footprints and baseline 4 camera screenshots; approve real coordinates **before writing terrain patches**.

**P1. Technical-trail MVP:** one desert rock garden, one Redwood balance beam, shared support/collision sampler, one tutorial-sized mastery line; visual and movement unit tests.

**P2. Reusable challenge engine:** pure state machine, ordered swept checkpoint gates, versioned local personal best, minimal contextual overlay; first **Joshua Full Lap** Adventure variant playable start-to-finish. No in-world leaderboard.

**P3. Big Air:** measured mountain run-in and receiving slope, opt-in ski flight mechanics, chase/side camera, flight distance scoring and forgiving recovery. Reject if no real safe landing corridor exists.

**P4. Puzzle trilogy:** Granite Counterweight, Deadwood Bridge, Rainforest Light Gap. Reuse challenge engine and interactive prop system; other two puzzles remain backlog until player feedback.

**P5. Extended runs:** Joshua Gap Sprint, Technical Section, alpine slalom and additional rock/root/beam variations. Implement only if P1–P4 meet perf and browser tests.

**P6. Integration review:** prune earlier conflicting route props, correct camera/pop-in issues, optimize device quality levels, write walkthrough/controls, capture actual playtest evidence, merge only when unrelated security gates and browser regressions are resolved.

Per tranche: open a small reviewable commit, state implemented versus pending, world typecheck + lint + test suite + runtime screenshots, explicitly note measured perf, and never mark features complete because they appear in a registry.

## 13. Release definition of done

1. Desert track remains 305+ units with its genuine two gaps and separate legal bypass.
2. At least three distinct rideable natural rock/wood features, including a real low balance traversal, are playable and can be bypassed.
3. Joshua Full Lap adventure timing is accurate, shortcut-resistant and saves a local personal best; no unsupported global competition claims.
4. Big Air has a visibly shaped downhill approach, a continuous physically sampled long flight and safe valley landing, with honest distance and replayable attempts.
5. Three nature-based puzzles reward observation and experimentation; none blocks access to other website content.
6. World remains stable with snow, Shasta, rock climbing, Arcade cave, Fern Falls, Paper Archive, rainforest and underwater scenes intact.
7. Full testing, manual visual approval and performance measurements support the work.
