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

Input: Enter at pier opens chooser; then pick craft or Free ride. WASD or arrows drive,
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

## Coastal geology and mountain-flight refinement (follow-up)

The original offshore rocks rendered as simple tapered columns and each arch
used a smooth half-torus. Their new procedural geology provides:

- Faceted, asymmetric sea stacks with wave-cut feet, eroded necks, and
  deterministic sandstone, gray stone, and dark basalt stratification.
  Every visible foot remains inside its corresponding physical collision
  radius plus the existing hull clearance; collision envelopes are not inflated.
- Thick uneven open arch crowns replacing both half-tori. Each crown joins the
  real rock legs while leaving the center channel clear for the jet ski.
  Outward-facing triangle normals avoid invisible faces under back-face culling.
  Santa Cruz and Hawaii remain stylized inspirations, not surveyed replicas.
- No remote assets, new runtime downloads, collision shortcuts, or additional
  allocation inside the racing frame loop.
- Dedicated geology unit tests for outward face normals, procedural mesh
  determinism, collision fairness, open arch geometry and course gate coverage.

Mountain jumps now score from the summit-centered ridge reference (7,-61),
versioned separately from older results. The HUD displays landing radius,
horizontal flight length, outward gain, airtime and peak terrain clearance.
Takeoff strength depends on actual ski speed and downhill/ramp drop; pressing
Space while standing no longer creates an artificial forward race jump.

The freeform jump camera follows the actual departure heading; the three
companion birds follow the same heading. Flight physics uses bounded catch-up
substeps under low browser frame rates, without mutating ground movement speed.
Automated tests cover directional flight, honest takeoffs, arch route clearance
and collider/silhouette agreement.

Manual QA remains required: visually inspect both arches while racing,
approaching the north and south passages from either side, and long ski flights
away from the original authored kicker.

## Landmark and water-mechanics tranche (2026-10-11)

New code on this draft branch:

- `jetSkiCourse.ts`: two mandatory sea arch openings aligned with gate 5
  (Santa Cruz–inspired sandstone, northern capes) and gate 14
  (Hawaiian-inspired basalt, southern passage); five offshore sea stacks
  along the Mendocino-like west coast and two basalt shelves. Collision
  footprints are narrower than decorative silhouettes. Route segment checks
  must show clear passage through every gate.
- `worldJetSkiCourseGeometry.ts`: generated irregular stone pillars,
  open wave-cut arch crowns, foam skirts, animated jump-wave rings and
  three wave-surface patches. Geometries/materials disposed on unmount.
- `jetSkiWater.ts`: deterministic regional swell height and slopes,
  stronger chop on the exposed west/south coast, conservative current drift,
  and two authored wave-lip jumps aligned with the racing direction.
- `jetSkiRace.ts`: bounded turbo energy that recharges off boost,
  boosted acceleration and speed, gentle release deceleration, current
  drift, rock impacts, jump cooldown, gravity and landing splash state.
  Steering/roll/pitch remain arcade-friendly, not full rigid-body hull physics.
- World renderer: Shift boost on keyboard or large touch Boost button,
  turquoise turbo meter, named route section cues, wave-aware craft height
  and camera adjustment during jumps.
- World unit tests cover open arches, dry-route avoidance, rock placement,
  wave determinism, boost recharge, controlled airtime and opponent laps.

### Visual/functional review checklist
1. Fly a camera through the **North Natural Bridges** arch, and through
   the **South Lava Window** arch, with a clear overwater opening. No arch
   beam should collide with the craft.
2. In the western Mendocino section verify sea stacks guide a readable
   slalom and that no rock occupies a mandatory checkpoint or route line.
3. Verify moving wave patches line up with visual craft bobbing; ensure
   their opacity and seams do not obscure reef photography or snorkeling.
4. On both desktop and touch, turbo should be useful for a pass and a
   jump but not required to complete either lap. Releasing boost must not
   abruptly clamp speed.
5. Jump zones must have safe water landing surfaces, limited airtime,
   legible camera framing, no repeated instant relaunches, and visible
   landing foam. AI must be capable of completing the same route.
6. Verify no regressions to cave, disc golf, swimming, aquatic fauna,
   beach exploration, or normal keyboard movement.

## Playable race quality pass (2026-10-11)

The latest refinement adds:

- A **single batched instanced-mesh foam trail** with paired turbulent arms.
  It follows the same wave sampler as the craft, fades along the last 1.9
  seconds of driving, and uses darker tints for older foam without allocating
  one WebGL object per segment. The immediate stern ripple is retained.
- A water-following **light beacon on the active mandatory gate**, separate
  from the small markers on other gates. It follows buoy order and hides when
  not racing.
- A **3-second departure countdown**; the player's craft and AI opponents do
  not begin accumulating race time or velocity before GO.
- Short checkpoint/lap messages, plus **8 turbo points per legitimate gate**.
- A retry action (R or touch Retry at finish), a temporary in-session best
  time, and real finish-place ranking based on completion time when multiple
  craft have crossed the line.
- A dedicated `scripts/playtest-jet-ski.mjs` desktop/touch Playwright QA
  script. Syntax is checked in World CI; it is **not automatically run** by
  that workflow because it requires a browser and a running World server.

Browser playtest invocation, after starting the development server and
installing Playwright separately:

```bash
PLAYWRIGHT_MODULE_ROOT=/path/to/playwright WORLD_BASE_URL=http://127.0.0.1:3000 node scripts/playtest-jet-ski.mjs
```

It checks docking, choosing crafts, the start countdown, acceleration and
boost, restarting, returning to exploration, and coarse-pointer boarding
controls. Screenshots and a JSON result are written to
`artifacts/world/jet-ski-playtest`.

**Remaining visual acceptance:** inspect foam trails against real rendered
water, camera transitions through the sea arches, racing buoys versus kelp and
reef decorations, shoreline apron seams, and responsive touch HUD on actual
phones. Do not claim the race is browser-qualified solely because script
syntax and World unit contracts pass.

## Pier, boarding and reverse-control correction (2026-10-11)

**On-foot interaction:** The old dock existed only as visual planks above the
water; the shared walking model still sampled submerged seabed and switched the
avatar into swimming. The new `jetSkiPier.ts` defines the exact deck footprint,
height and 3m shoreline ramp. Both planks and the locomotion ground surface
sample it. Water beyond the deck remains swimmable; the global `isWater` and
the marine ecology classification are unchanged.

Walk down the pier, then **press Enter** at its boarding end. An accessible,
focus-contained chooser displays **Touring**, **Sport**, **Race** and **Free ride**.
The craft preview shows a rider seated on the middle jet ski while the chooser
is open. Escape cancels. Choosing a racing profile starts the synchronized
countdown; Free ride launches without opponents or mandatory gates.
Coarse-pointer users see a **Ride** action at the pier end to open the same
chooser. The old E-to-ride and number-key shortcuts are removed.

**Jet-ski controls:** W/up accelerates; S/down brakes and continues into genuine
reverse (up to 8 world units/s) so the rider can back out of narrow channels.
A/left turns left, D/right turns right. Steering reverses the bow's rotation
when backing, matching typical watercraft maneuvering. Shift or touch Boost
activates turbo; Escape docks, and R retries a timed race.

**Visible waves:** During a jet-ski session, the main ocean mesh gains a
moderately subdivided dynamic surface updated from the *same deterministic wave
field* as the hull, in addition to localized crest patches. The mesh is reset
to its previous flat state after docking. This does not silently modify reef
depth, swim dynamics or the existing surfing contract.

**Required QA:** walk the entire pier (including its shoreline transition),
validate that aquatic mode stays `land` while on the deck, press Enter and
confirm focus/choice, cancel with Escape, choose Free ride and reverse from
a rock; visually inspect ocean displacement, mesh seams and mobile overlap.
`scripts/playtest-jet-ski.mjs` was updated for this flow but must still be
executed against a live browser before merge.

## Post-playtest repair tranche: pier continuity, selection and mountain jumps

**Pier root cause:** Previous deck support began at `x=56.4`, already close
to the east water transition. Approaching from the island could enter aquatic
mode before the foot collided with the dock, and a swimmer could not emerge
onto water-classified dock tiles. The support now starts further inland at
`x=47.5` and slopes to the flat pier; the visible planks and a continuous
underdeck mesh sample the same function. Water-mode movement may step onto
the deck and return to normal walking. Boundary coordinates have a numerical
tolerance shared between rendering and contact. A dry-land-to-outer-pier
movement regression was added; visually inspect the exact join in browser.

**Ride chooser:** The old stack of inline-colored buttons is replaced with a
small, responsive, translucent, design-system CSS card chooser. Enter while
standing on the pier mounts a preview rider, then the user chooses Touring,
Sport, Race or Free Ride. Escape backs out to the pier. Other world activity
controls hide while the chooser or a jet-ski session is active. The choice is
accessible via keyboard focus trapping and touch.

**Mutual exclusion:** `lib/world/gameMode.ts` is the authority for one
active minigame at a time. Jet-ski, ski-jump, disc-golf and Joshua race entry
requests are rejected while another challenge is armed, playing, or choosing.
The React World HUD also disables competing start controls. Normal area
navigation is still an explicit way to exit a current game.

**Ski flying:** The old single ski launch path is no longer required.
Skiers can launch by pressing Space at qualifying mountain elevations, or by
moving fast over downhill terrain/ramp lips. Real travel headings are preserved
during flight. The three birds and their wings rotate with that heading and
the flight is measured as horizontal distance plus radial distance from the
mountain center. The mountain distance is the new record metric, versioned
separately from the legacy marked-lip best. A water touchdown transitions
to swimming instead of snapping the skier onto underwater seabed.

**Browser qualification:** `.github/workflows/jet-ski-browser.yml` runs a
real Chromium/Playwright pier and jet-ski acceptance workflow on the draft PR.
Failures are not suppressed: inspect the Playwright report/screenshots and
repair before promoting the draft. Existing World unit and geometry audits
remain additional, not replacement, evidence.

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

## Boost, wave scale, and input clarity pass (2026-10-11)

- **Single-action BOOST:** Shift alone on desktop, or a held BOOST button on
  touch, drives forward and applies turbo. It no longer depends on pressing W or
  Throttle with another finger. S/down or touch Reverse takes priority over
  boost so riders can escape a rock. W/up, S/down, A/left, D/right and arrow
  keys share one pure mapping across keyboard and touch.
- **Exhaustion feedback:** Once the boost tank drains it locks out new bursts
  instead of stuttering on every simulation substep. Release boost after
  recovering at least 20% charge to rearm it. The HUD differentiates BOOSTING,
  BOOST READY, BOOST LOW and BOOST RECHARGING; charge is an accessible progress
  bar. The touch button communicates active/charging state without relocating
  or overlapping other touch controls.
- **Exposed-water surf:** Deterministic swells reach about 0.9 world units at
  the rough southern cape; sheltered pier water stays roughly 0.25. The main
  race-only ocean surface now uses a denser grid, while craft position, pitch,
  roll and camera look-at track the same sampled surface. Marine ecology,
  diving, snorkeling and ordinary flat-water presentation remain unchanged.
- **Wave-play mechanic:** High-speed boost into a sufficiently steep rising
  swell face can briefly hop the ski, with gravity and a 2.6s launch cooldown.
  It works beyond the two authored wave-lip rings but does not launch in the
  sheltered lagoon or at slow speed. This remains arcade behavior, not a
  hydrodynamics or oceanographic simulation.
- **Focus safety:** Keyboard driving remains available when focus moves to
  controls inside the running World without trapping typing outside it.
  Window blur and hidden-page transitions release held touch/boost inputs.

**Automated acceptance:** pure input resolution tests, deterministic exposed
vs sheltered water height tests, boost depletion/rearm tests, offshore crest
jump tests and desktop Playwright Shift-only acceleration assertion. Existing
physical jet-ski course, pier, rock arch geometry, freeform mountain ski jump,
and activity mutual-exclusion tests remain in the World regression suite.

**Still required before merging:** browser and unit CI at the latest head,
real-device touch multitasking (steer + boost + reverse), offshore wave mesh
visual inspection at normal and low framerates, arch silhouettes from the ski
camera, and long freeform ski-jump follow camera/bird tracking.
