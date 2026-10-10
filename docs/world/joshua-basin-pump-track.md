# Joshua basin: continuous bike loop and biome coverage contract

This tranche adds a playable dirt circuit without changing island scale, the cave layers,
the waterfall drainage chain, the lagoon or the rainforest footprint.

## Geometry and traversal

- **Authoritative source:** `lib/world/desertTrack.ts`. One clockwise capsule:
  west rollers at x=32, two tangent five-meter end turns at z=-43 and z=-13,
  east return at x=42, then south-turn closure. Avoid a figure-eight crossover.
- **Ground support:** `terrainHeight` applies smooth trail cuts, progressive
  rollers, outside banked dirt berms and the east-side launch crest. No floating
  timber ramp is rendered over the east-side dirt jump.
- **Physics:** `groundHeight` and bike movement sample that same heightfield.
  `rampImpulseAt` remains the explicit launch trigger at the east dirt crest.
- **Materials:** terra-cotta compacted tread color is sampled from the identical
  centerline distance in `worldRenderer`; the terrain mesh is modestly refined
  to resolve broad shoulders without creating many independent draw calls.
- **Plant exclusions:** `sportClearance` uses the actual track centerline and
  reserves the whole riding lane from random foliage and collision objects.
  Authored climbing holds east of the loop stay distinct from the dirt route.

## Ecotones and coverage

- The Joshua basin deliberately stays open: Joshua trees and low weathered
  talus frame the route; no large boulder stacks obstruct the track.
- Six longitudinal batches in `createHabitats` now cover previously vacant
  foothill and meadow regions. `understoryDensityAt` is derived from biome,
  beach, slope and soil properties, suppressing shrubs on water, sand, steep
  alpine slopes and the center of the desert biome.
- Forest and rainforest tree bands are still separate from scrub. Keep the
  existing rainforest persistence contract so entire canopies do not pop on
  distance thresholds.

## Acceptance and visual QA

1. Select bike and ride the west rollers north, the north banked hairpin,
   the east-side launch and the south turn back to the beginning.
2. Verify tires contact the modeled surface, the berms are smooth, and no
   Joshua tree or rock prevents a complete lap. Check jump height/landing.
3. Walk through the valley and both biome boundaries: desert remains dry,
   rainforest retains lush canopy, western redwood area reads differently,
   transition valleys have nonuniform grasses/scrub.
4. Check roof, portals, waterfall drainage and reef for visual regressions.
5. Run `node --import tsx --test tests/world-*.test.ts`,
   `npm run typecheck`, `npm run check:world3d` and browser QA at desktop/mobile.
   The independent World Landscape Regression workflow is **supplemental**;
   it does not waive the existing Website CI security-audit gate.

This is deterministic arcade riding, not a promise of fully physical bike suspension.
Future ride dynamics should be separately qualified by visual/browser playtesting.
