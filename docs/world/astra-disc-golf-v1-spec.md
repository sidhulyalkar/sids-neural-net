# Island Disc Golf v1: moving-chain targets and three-tap throwing

**Status:** First integrated prototype, pending CI and browser playtest. This replaces the *proposed* Granite Counterweight / Nurse Log / Rainforest Light puzzle trilogy as the next gameplay priority. Do not implement those puzzles without renewed direction. World biome, cave, waterfall, bikes, Big Air, Shasta, underwater ecology and website routes remain intact.

## Player experience
A four-hole optional disc-golf course winds through the island rather than erecting a separate minigame building. Press **Disc golf · play** from the activity dock to stand at the first tee. The current set of chains moves predictably within an authored local zone. The player can choose an island hole at any point (except midair), aim relative to the live basket, adjust throw loft, read the wind and take a shot. Shasta can hang out nearby; no extra currency, loot, artificial quest towers or permanent HUD outside the minigame.

The shot is one three-tap gesture, inspired by the *interaction rhythm* of [Sunshine Golf Classic](https://github.com/js13kGames/sunshine-golf-classic), not its source code. Its repo README calls out click-to-start, click-for-power, click-for-accuracy and a wind-influenced flight. **That game’s README explicitly states its game code is all-rights-reserved and not for reuse.** This implementation uses entirely new geometry, dynamics, controls and artwork.

1. Adjust **throw angle** (loft) and **aim offset**. The defaults point toward the current basket. A deliberately limited angle adjustment keeps it intuitive without taking camera control away.
2. Tap **Start pullback** to animate the top power meter up/down. Tap **Lock power** to set the backswing. This stage should feel like pulling a disc into the throwing shoulder.
3. The bottom release meter now sweeps through a narrow pale center zone. Tap **Release disc** near center for a clean straight throw. Early/late imparts a deliberate left/right angular miss.
4. The disc leaves the character’s lie in a continuous time-stepped trajectory under gravity, mild glide, drag and a wind vector *locked on release*, while the basket follows its local animation.
5. A successful shot caught near chain height scores the basket. On any valid ground landing, a restrained warm vertical **golden beam** rises from the precise disc lie. The next throw begins there, not back at the tee.
6. **Water = free redo**, exactly as requested: water contact or island out-of-bounds returns the disc to the last valid lie with no extra stroke and a clear explanation. No irreversible water trap, penalty or teleport to a different hole.
7. When chains catch a disc, report throw count, par comparison and **Next moving basket**. Players can cycle holes directly. Exiting restores regular navigation and removes all challenge markers.

## Initial holes
| Hole | Tee and target neighborhood | Basket motion | Desired moment |
|---|---|---|---|
| Redwood Bend | tee (-6,10), chains (-18,26) | low horizontal sway | Straight-through-the-trees approach with a carefully timed finish |
| Scrub Crosswind | tee (11,27), chains (29,17) | sideways figure eight | Adjust for crosswinds, choose a clean approach |
| Desert Drifter | tee (29,-11), chains (48,-29) | slow shallow orbit | Time a more aggressive angle over desert terrain |
| Coastal Gust | tee (-22,5), chains (-29,21) | periodic shoreline sway | Keep a disc out of the sea; water flight is okay, water *landing* is a free redo |

These are explicit *initial* locations, subject to real browser visual survey. Do not infer physically accurate disc golf distances or professional course certification. Basket movement is an intentional arcade variant, not regulation disc golf.

## Technical modules

- `lib/world/discGolf.ts`: deterministic moving basket trajectories, time-varying wind, shot initiation, bounded fixed substeps, chain-catch and terrain/water resolution, scoring and invalidation. Pure functions; does not import the terrain generator or modify global rider physics.
- `components/world/worldDiscGolfGeometry.ts`: procedural disc, metal pole/rings, 12 instanced hanging chains, conical basket, and one gold landing beam. Dynamic meshes only visible in active minigame. No asset downloads or geometry spikes on every flight.
- `components/world/WorldDiscGolfHUD.tsx`: keyboard-accessible buttons and native range controls for angle and aim; two complementary active meter bars controlled by tap/click. No autoplay sound.
- `components/world/WorldHome.tsx`, `WorldScene.tsx`, `worldRenderer.ts`: thin independent state/shot-serial interface, source of truth in the same World frame, opt-in course start, camera flight framing, beam, exit, no change to ordinary exploration.
- `tests/world-disc-golf.test.ts`: moving targets, wind, aim and release sensitivity, chain capture, terrain support, water refund, four authored holes, geometry disposal.

### Controls
The default World canvas owns WASD/Space/drag. Once disc golf is selected it pauses ordinary locomotion and shows a focused persistent shot HUD. Numeric hole buttons allow switching between four targets, each resetting its own temporary round. Mobile controls must remain 44px-minimum for primary actions. All information remains readable without color or sound.

### Next quality tranche: measured preview and obstacle-aware flight (2026-10-10)

**Implemented in the feature branch, CI and graphical signoff tracked separately:**
- `traceDiscGolfShot` simulates the exact same timestep solver and wind sampling as actual throws, with a fixed **centered release** assumption. The preview is explicitly labeled as an **estimate** since release timing, basket motion and gust phase can change. There is no hidden aim assist or guaranteed catch.
- A single translucent world-space flight line and an estimated ground-contact ring update only when aim/power/loft changes or on a bounded 0.6-second cadence. The estimate never draws a teleport segment back to the tee after a water redo. Both meshes are disposed on scene exit.
- `discGolfTreeContact` uses swept horizontal disc-versus-trunk cylinder intersections **with a vertical height check**, rather than rendering-only tree trunks. A contact earns an ordinary stroke and settles on actual ground, leaving a valid next lie, unlike water which still refunds the shot.
- On a chain catch, the existing instanced metal chain assembly responds with a short damped movement. No extra per-link meshes, sounds or global particles are added.
- The meter component preserves the player's chosen angle and power through incremental World updates; its live preview is throttled by ten-power-percent buckets while the first meter sweeps.
- Dedicated regression checks cover collision between frames, passing safely above low trunks, exact preview/actual parity for a centered release, no fake water-return trajectory, and graphics resource cleanup.

**Still needing actual visual browser validation:** player approach to all four tees, overlap between tree trunks and candidate target sweep paths, readable preview line in the forest, camera clipping while following a disc, whether a tree-contact lie is fairly playable, responsive touch controls, FPS/draw calls, and evidence screenshots. Do not claim the course is visually accepted merely because unit tests pass.

### Backlog after real browser validation
1. **More expressive body animation**: the arm already changes pose for each stage; add smooth follow-through driven by actual meter position, and ensure the disc truly releases from the hand location.
2. **Course-specific obstacles**: validate seeded obstacles and create meaningful but fair tree gaps and rocky ridge lines, never invisible obstacles.
3. **More disc behavior**: opt-in putter/mid/fairway styles, hyzer/anhyzer and modest ground skip only if intuitive base physics is already enjoyable.
4. **Course continuity**: optional hole-completion tally and personal best, no account or global leaderboard.

### Quality gates
- Verify the user can complete all four holes and that actual chain geometry aligns with simulated catch volume.
- Confirm no basket intersects a tree, bypass, Shasta, caves, photography marker or dirt jump. Enforce static/dynamic obstacle clearance in code after surveying.
- Verify reachable game from foot mode regardless of ski/bike context, exit clears the camera and controls, water shot refunds exactly one attempted stroke, moving target remains synchronized with simulation clock, and the beam appears only at valid landings.
- Validate 30/60fps and hidden-tab pause, repeated rounds/disposal and reduced-motion. No screen flash, giant reward overlays or intrusive sound.
- Profile total world draw calls including active disc golf; avoid rendering the chains when not playing. Require screenshots of tee, both meter stages, disc airborne, water redo, chained basket and beam at lie on desktop/mobile.
- Tests, typecheck, lint, build and real browser playtest must pass before release or merging; never call a prototype fully qualified based only on a passing typechecker.
