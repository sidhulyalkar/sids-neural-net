# Eagle Ray Passage v1: playable underwater vertical slice

Base: `feat/sequoia-tunnel-skate-loop` (2026-10-24 snapshot).
Implementation branch: `feat/eagle-ray-passage-v1`.

## What ships
- A smooth eastern-lagoon bathymetric cut. All sea-floor sampling and the terrain mesh use `seaFloorHeight`, so camera, swimmer clearance, and drawn surface share the same terrain.
- Twelve ray actors in three separately generated silhouettes: eight eagle rays, one manta, and three bottom-dwelling stingrays.
- Two benthic cleaning pinnacles with instanced rocks, 14 cleaner fish and 10 shrimp. Rays visit via deterministic travelling/approaching/cleaning/foraging states.
- A visibility-gated rendering submodule integrated into the warm reef with explicit disposal, no extra dependencies, no global reactive state, and no changes to land sports, caves, swimming controls, or shoreline masks.
- An initial shoreline-entry coverage sampling contract that exposes unfilled stretches instead of asserting full 360-degree habitat coverage.

## Mathematical geometry
`rayPassageDepth(x,z)` is zero west of x=64 and outside the softened channel envelope. Its maximum trench subtraction is 4.35 world units. This is not a new water zone: it modifies the existing lagoon `seaFloorHeight()`.

Underwater snorkeling keeps its present maximum dive depth and minimum floor clearance. The trench's deepest region is an observation feature, not permission to bypass those clamps.

## Render/performance decisions
- 3 morphology source geometries, cloned only where independently animated by per-ray flapping.
- Geometry animation throttled to 15 Hz, tied to absolute elapsed time.
- Shared low-poly fins/tails, station rocks, cleaner fish, and shrimp are reused/instanced.
- No expensive physics, pathfinding, shader package, assets, or additional renderer.
- Only updates while the tropical lagoon is visible. `dispose()` releases owned GPU buffers and materials.

## Verification requirements
1. `npm run typecheck`
2. `npx eslint lib/world/rayPassage.ts components/world/worldRayPassage.ts tests/world-ray-passage.test.ts lib/world/model.ts components/world/worldRenderer.ts --max-warnings=0`
3. `node --import tsx --test tests/world-ray-passage.test.ts`
4. `node --import tsx --test tests/world-*.test.ts`
5. `npm run build`
6. Desktop and mobile browser pass: jump off lagoon shore, surface swim, dive/deeper/shallower/surface, inspect both cleaning stations, return to land, verify unrelated sports and cave exits.
7. Frame-time and draw-call comparison before/after, including all land and non-lagoon states. Inspect ray silhouette readability, bank turns, fin geometry and rocks from above.

## Explicitly not completed
- Full ocean-wide eight-habitat population.
- Fifteen ray species with individual accurate markings/anatomy.
- True ecology or measured animal-cleaning reactions (the current paths are procedural visual approximations).
- Qualified in-browser screenshot review and physical phone/desktop performance metrics.
- Complete coastline marine coverage (the survey intentionally reports gaps).

Only merge after CI and visual/interaction signoff. Existing real-video catalog remains independently curated: no placeholder snorkeling videos are fabricated.
