# Eagle Ray Passage v1: playable underwater vertical slice

Base: `feat/sequoia-tunnel-skate-loop` (2026-10-24 snapshot).
Implementation branch: `feat/eagle-ray-passage-v1`.

## What ships
- A smooth deep eastern-lagoon bathymetric cut. All sea-floor sampling and the terrain mesh use `seaFloorHeight`, so camera, swimmer clearance, and drawn surface share the same terrain.
- An instanced migration fever of **120 eagle rays** in six vertical strata, plus twelve close-up ray actors in three separately generated silhouettes (eight more eagle rays, one manta and three stingrays): **132 total channel rays** on desktop.
- Four wing cohorts plus one tail instance batch (five draw calls for the fever), with per-frame travel matrices, 15 Hz wing-normal updates, and gently swimmer-aware parting.
- An adaptive mobile cohort of 96 eagle rays, conserving mobile GPU/CPU work while preserving the full deterministic school on desktop.
- Two benthic cleaning pinnacles with instanced rocks, 14 cleaner fish and 10 shrimp. Rays visit via deterministic travelling/approaching/cleaning/foraging states.
- A visibility-gated rendering submodule integrated into the warm reef with explicit disposal, no extra dependencies, no global reactive state, and no changes to land sports, caves, swimming controls, or shoreline masks.
- An initial shoreline-entry coverage sampling contract that exposes unfilled stretches instead of asserting full 360-degree habitat coverage.

## Mathematical geometry
`rayPassageDepth(x,z)` is zero west of x=64 and outside the softened channel envelope. Its maximum trench subtraction is 13.5 world units. The channel center is substantially deeper while both lateral edges remain unchanged. This is not a new water zone: it modifies the existing lagoon `seaFloorHeight()`.

Most underwater snorkeling keeps its existing 10-unit maximum depth. Inside the channel, the dive cap smoothly increases to at most 16 world units, always respecting the same floor-clearance check. The trench's deepest region is an observation feature, not permission to bypass those clamps.

## Render/performance decisions
- 3 morphology source geometries for detailed individuals. All 120 school members share four cloned wing geometries and an instanced tail mesh.
- Wing vertex updates and normal recomputation throttled to 15 Hz; swimming movement matrices remain per-frame and tied to absolute elapsed time.
- Shared low-poly fins/tails, station rocks, cleaner fish, and shrimp are reused/instanced.
- No expensive physics, pathfinding, shader package, assets, or additional renderer.
- Only updates while the tropical lagoon is visible; near-player displacement uses constant work per ray rather than interactions between all pairs. `dispose()` releases owned GPU buffers and materials.

## Verification requirements
1. `npm run typecheck`
2. `npx eslint lib/world/rayPassage.ts components/world/worldRayPassage.ts tests/world-ray-passage.test.ts lib/world/model.ts components/world/worldRenderer.ts --max-warnings=0`
3. `node --import tsx --test tests/world-ray-passage.test.ts tests/world-eagle-fever.test.ts`
4. `node --import tsx --test tests/world-*.test.ts`
5. `npm run build`
6. Desktop and mobile browser pass: jump off lagoon shore, surface swim, dive/deeper/shallower/surface, inspect both cleaning stations, return to land, verify unrelated sports and cave exits.
7. Frame-time and draw-call comparison before/after, including all land and non-lagoon states. Inspect ray silhouette readability, bank turns, fin geometry and rocks from above.

## Explicitly not completed
- Full ocean-wide eight-habitat population.
- Fifteen ray species with individual accurate markings/anatomy (this pass prioritizes a 120-member eagle-ray aggregation).
- Measured physical FPS/performance with real hardware (the 5-draw-call design is a target, not yet a measured result).
- True ecology or measured animal-cleaning reactions (the current paths are procedural visual approximations).
- Qualified in-browser screenshot review and physical phone/desktop performance metrics.
- Complete coastline marine coverage (the survey intentionally reports gaps).

Only merge after CI and visual/interaction signoff. Existing real-video catalog remains independently curated: no placeholder snorkeling videos are fabricated.
