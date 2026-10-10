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

## October 2026: authored dirt jumps and rainforest wildlife

Three jump features now share one contract in `lib/world/desertTrack.ts`:
- `desert-table`: x=32, z=-27, heading north, gentle rollable tabletop with raised landing
- `desert-hip`: x=42, z=-39, heading south, progressive return-line dirt lip
- `desert-step`: x=42, z=-26.5, heading south, larger step-up with a clear landing

`lib/world/activities.ts` derives the jump triggers from that same feature
array. All three are dirt terrain, so `rampSurface` deliberately returns null:
there must never be a timber deck hovering over a dirt lip. The runtime launch
trigger remains bike/skate directional and speed-gated. Each takeoff/landing
must pass the global <1.0 height-unit-per-distance grade audit.

**Rainforest:** `RAINFOREST_CANOPY_WILDLIFE` anchors a sloth, two colorful
macaws and two toucans to modeled branches at fixed canopy coordinates.
`worldHabitats.ts` adds subdued heliconia/red-orange flower clusters within
suitable rainforest planting patches. Animal meshes are statically batched;
they are not a procedural free-flying flock. Avoid overpopulating this region.

**Photography source integrity:** the present Visual Archive has 49 photos
and does **not** include a sloth image. The sloth mesh references the intended
photographic subject aesthetically, but there is no sloth-photo discovery link
until that actual image is ingested with a valid archive ID. Never substitute
an unrelated photograph, fabricated source, or placeholder link.

**Shasta:** `shastaCharacter.ts` v4 defines shallow almond-shaped rim, iris
and pupil geometry positioned at the measured surface of the modeled head
ellipsoid. Keep rim-to-skull spacing, frontal read and side-view protrusion
regressions. Do not add large sclera or volumetric eyebrows.

Additional visual acceptance steps:
- Ride all three dirt jumps at slow and fast speeds, confirm proper takeoff,
  airtime, landing support and safe runout, then finish a full lap
- View macaw blue wings/red torso, blue-yellow macaw, both toucan bills,
  and the sloth from the forest trail; ensure vegetation does not occlude
  everything from ground level
- Inspect Shasta's eyes at front and side at rest and while following;
  confirm no spherical protrusion or artificial staring appearance
- Record desktop/mobile frame behavior and look for sudden geometry pop.
