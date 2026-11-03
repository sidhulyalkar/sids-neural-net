# Sid’s iLand: world-architecture and visual-quality audit

**Date:** 2026-11-03  
**Scope:** Primary island world, navigation, reef habitats, disc golf, archives,
browser quality gates and integration boundaries. This is a source-level audit,
not a claim that all 1,133 repository files were manually reviewed.  
**Feature branch:** `feat/hidden-subsea-shrine-gallery-20261101` (PR #142)

## Source inventory and design risks

- Repository tree: approximately **1,133 tracked files** at audit start.
- `components/world/worldRenderer.ts`: **7,487 lines** before this pass.
  It owns world generation, multiple sports, UI diagnostics, camera rigs,
  water/land mode switching, galleries and large sections of cleanup. This is
  the strongest refactoring opportunity. Editing it for a new reef or museum
  has a larger regression surface than necessary.
- `lib/world/model.ts`: authoritative region, coastal, heightfield, world
  boundaries and cave support. Moving a landmark here without updating
  rendering, collision and menu travel consistently previously created stale
  features and phantom obstacles.
- Two distinct “canyon” experiences must remain distinct:
  `MOSS_CANYON` is the recreational underwater reef, whereas
  `CANYON_FLOW` in `lib/world/skatepark.ts` is the skateboard line.
- `lib/world/discGolf.ts` uses one predictable arcade integrator for release
  and prediction. The six-DOF rigid-disc and ground-contact modules remain
  experimental/research alternatives; swapping them into live play without
  calibrating outcomes would change the game feel and invalidate regression
  expectations.

## P0: correctness and visitor navigation

1. **Canyon scene mismatch (addressed in this branch):** Original Moss Canyon
   was composed of land rocks added to global land obstacles. Water navigation
   ignores those objects. Replace with a true west-shelf reef, height-aware
   swept swim collision, and an explicitly water-mode canyon menu arrival.
   Never extend those rock collisions above the water surface.
2. **Waterfall research museum was not actually multi-room (addressed):**
   Original code put eight authentic publication cards on one wall at z≈-35,
   inside a six-meter tunnel. Extend one continuous floor and shell through
   three chambers, distribute eight source-backed papers, add broad arches,
   keep the waterfall portal and publication links intact, and give visitors
   a forward (-Z) arrival heading. Avoid overlapping floor slabs.
3. **Frisbee north boundary (addressed):** A hardcoded `z > 57` made legal
   northern-island throws out of bounds. Qualify against the full island
   coordinate envelope instead.
4. **Frisbee tree-contact lie (addressed):** Repeated hits from inside an
   obstacle or a next lie overlapping a second tree/water can strand the
   player. Use outgoing-inside rejection and a deterministic dry, clear
   alternative lie; preserve a free redo when none exists.
5. **Release gate (outstanding):** Keep the branch in draft until focused
   world tests, actual Chromium navigation and security/dependency checks
   pass. Browser artifacts must prove images, geology and controls, not just
   report successful scene construction.

## P1: architecture and rendering

- Split `worldRenderer.ts` into independently owned systems:
  `worldSceneAssembly` (static geometry and ownership),
  `worldNavigation` (ground/water/cave layer transitions),
  `worldCameraController` (priority stack and occlusion),
  `worldDiscGolfRuntime` (flight, preview, fetch handoff),
  `worldMuseumRuntime` (gallery room/interaction state), and
  `worldDiagnostics` (small sampled QA/debug surface).
- Define one authored data contract per landmark shared by visual geometry,
  collisions, approach camera, region travel, and tests. Avoid copying
  coordinates across renderer code, UI and model helpers.
- Group static reef and museum ornamentation in GPU batches rather than
  dozens of per-decoration draw calls. Keep meshes/framing separated where
  individual objects must be clickable.
- On resource teardown, dispose geometries, textures and materials. Test
  repeated island entry/exit and WebGL context restoration, especially with
  original-resolution gallery images.
- Prioritize *cross-room* and *cross-mode* camera testing: software rendering
  and mobile low-FPS conditions have caused indoor camera clipping and
  apparent floor flicker even with successful geometry tests.
- Ensure navigation/collision matches the actual 3D vertical support: 2D
  world bounds cannot represent above-rock swimming, underground galleries,
  or inverted skating loops by themselves.

## P1: visual quality

- Moss Canyon: broad unobstructed swimming center, irregular stacked stones,
  coral fans, cream/salmon anemone tentacles, clearly submerged upper rock
  contours, and no artificial reef colliders.
- Waterfall museum: three coherent, warm-lit spaces, source-backed papers on
  side/back walls, identical eye-level frontal viewing poses, carved arches,
  gilded frames, and a single continuous floor. Preserve the secret waterfall
  entrance and direct links from `/publications`.
- Across the island, prevent z-fighting by checking *rendered* relative depth
  and geometry overlap, not solely coordinate coincidence.
- Prefer high-quality close-up materials and controlled LOD/texture residency
  over increasing all scene complexity. Mobile should retain recognizability
  without full-resolution geometry everywhere.

## P2: next optimization milestones

1. Instrument p50/p95 frame time and GPU resource count by biome and device
   class, including camera movement through the new reef and museum rooms.
2. Add scripted full-path snorkeling and 3D camera clearance tests for all
   authored reefs, not just Moss Canyon.
3. Capture actual room-specific screenshots and diff floor, walls, text and
   photo surfaces separately. Detect empty/offscreen paper panels.
4. Measure all nine disc-golf holes across varied frame rates and terrain
   collisions; validate preview-to-actual agreement and fetch handoff.
5. Revisit coral tentacle animation only after confirmed static geometry and
   mobile budget. A small synchronized sway is preferable to per-polyp
   independent CPU updates.
6. Move scene creation and per-frame updates behind explicit lifecycle APIs
   with deterministic seeded inputs and no unseen geometry allocation.

## Acceptance criteria

- Underwater canyon has a continuous >= 4m clear centerline, every rock
  safely submerged, all decorative reef meshes batched and disposable.
- Diving *through* the canyon cannot pass through exposed rock geometry at
  the swimmer's depth, while near-surface motion above rock crowns is free.
- Three museum rooms connect through unobstructed arches; all eight real
  publication records have clickable, clear sightlines and website links.
- Frisbee contact cannot create invalid or inaccessible new throws and legal
  north-island shots are not rejected by stale geometry limits.
- Typecheck, lint, all world tests, procedural world audit and browser
  walkthroughs pass before merge; the full project security audit is not
  silently waived.

**Do not merge based on source/unit proof alone.** Manual mobile and
underwater screenshot quality review remains an explicit gate.
