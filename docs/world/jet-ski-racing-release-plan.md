# Island Jet-Ski Racing: Product and Release Contract

Status: **draft implementation**, not merged. Owner PR: #94 into `feat/sids-world`.
External inspiration: [Sunwake Rush](https://github.com/js13kGames/sunwake-rush).
We use the general game-design ideas of readable buoy gates, responsive steering,
chase-camera readability and generated 3D visuals. No source or artwork is copied.

## Player experience

Discover a low-profile dock on the lagoon coast, approach on foot, select one of
three watercraft, board and launch into a **two-lap clockwise circuit around the
whole island**. Start from the eastern lagoon, round the northern cape, run down
the rocky western coast, cross the southern offshore passage and return up the
east reef to the dock. The course has 19 ordered gates per lap (38 total).

Crafts: Touring = predictable turning and lower speed; Sport = balanced;
Race = quickest acceleration/peak speed, wider high-speed turns.
Two computer-controlled riders use the same watercraft physics and shoreline
bounds as the player. No warping, rubber-banding or fake finishing.
The compact HUD shows place, current gate, direction/distance, lap, speed and
elapsed time. Escape returns the rider to the dock.

Input: keyboard 1/2/3 choose craft, E boards near dock, WASD or arrows drive,
Escape exits. Coarse-pointer devices get dock, craft, steering, throttle and
brake touch buttons. Space remains reserved for land movement and does nothing
during a watercraft run.

## World integration

- The island's original `WORLD_BOUNDS` and swimming/ecology
  `isWater` semantics remain intact.
- `jetSkiNavigableWater` is a separate bounded domain; the east and west
  coasts follow the world mathematical shorelines, and the north/south crossovers
  require an offshore safety margin beyond the terrain edges.
- North/south seabed aprons slope the visual terrain into the existing ocean
  plane; all raceable crossover gates lie beyond these aprons.
- Player collision does **not** teleport across land. The craft loses speed
  on contact, and the penalty is applied once per impact.
- Buoy credit uses a swept segment intersection with gates in order. Two
  completed laps end the race; race state never manipulates disc-golf scoring.
- Rider, buoys, dock and wakes use procedural meshes and are owned/disposed by
  World renderer. On activity exit, restore normal explorer visibility and
  camera framing.
- This is original arcade handling, **not** a six-contact measured hull model.
  Water bobbing, foam, and banking are cosmetic for now.

## Acceptance checklist before merge

1. World typecheck, strict lint including jet-ski sources, existing World
   contracts and the new jet-ski unit tests pass at the PR head SHA.
2. All gate locations and every sampled segment between them are navigable;
   the track visits both ocean capes and both coastlines, not an east-coast loop.
3. All three craft can accelerate, slow, steer, avoid dry ground and cross every
   gate in order. AI racers finish complete laps under real physics.
4. From the lagoon spawn, users can find the dock, cycle/choose a craft,
   board, follow the first highlighted checkpoint, and return to exploration
   without a stuck keyboard, hidden avatar or stale HUD.
5. Browser QA: desktop keyboard, coarse-pointer touch, resize, reduced-motion
   setting, pause/resume, tab focus, canvas clicks, first gate, north/south
   crossovers, final gate, and dock exit.
6. On-screen camera keeps craft and upcoming gate visible around both shoreline
   bends without clipping ground; apron geometry is not visibly disconnected
   from terrain or ocean.
7. No persistent WebGL leaks on repeated enter/exit or scene unmount.
8. Production security audit/build must pass separately; Next.js dependency
   advisory is already a known unrelated gate failure and must not be ignored
   or suppressed.

## Next milestones, ordered by player value

**P1: Release qualification.** Run World CI, inspect failed job logs, perform
browser regression and repair rough dock/water/apron transitions. Capture both
normal and reduced-motion flight paths.

**P2: Race feel.** Replace the temporary ring wake with speed-scaled foam strips
and spray, add engine audio triggered after user interaction, buoy pass feedback,
a short countdown and restart/finish screen. Consider shallow reef impacts and
dynamic waves only if they are visually and physically consistent.

**P3: Competition.** Allow race difficulty selection, collision-safe AI overtakes,
clear split times and best personal lap / race time. Save times only with user
consent to local browser storage; no accounts or external leaderboard required.

**P4: Island experience.** Add appropriately authored floating docks, optional
side routes through reefs and rock formations, and return-to-shore free ride
without compromising the existing snorkeling, underwater ecology, or disc golf.

Merge policy: keep #94 draft until the checked SHA passes required tests,
production security gate and real browser review. Never assert this release is
live based solely on committed source.
