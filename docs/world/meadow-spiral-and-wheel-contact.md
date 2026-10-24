# Meadow spiral and wheel contact

## Intent
Move Moss Canyon away from the forest skatepark, connect the meadow rail lines to a timber bridge and downhill roll-in, and replace the closed-looking timber ring with an open spiral matching Sid's reference images. Ride the loop through ordinary momentum, with no stunt key. Keep bike tires on the actual mountain surface.

## Shared layout
- Moss Canyon: center (46, -76), eight paired rock/moss outcrops from z=-85 at 2.8-unit spacing. Region navigation and rendered obstacle positions share `MOSS_CANYON`.
- Meadow route: original linked rails preserved; six-point bridge line extends from (24.8,38) to (30.5,49.5). A separate return rail follows the meadow edge.
- Timber bridge: x=29.7–32.3, z=40–50, supported by a smooth embankment. Both planks and wheels sample `skateParkSurface`. This is a grounded bridge feature, not an underpass.
- Roll-in: (29,51), 1.85-unit smooth hill, westbound toward (19,51). Existing gravity-based rolling acceleration supplies speed. A fast-travel destination faces the approach; no additional keyboard action.
- Spiral: 3.75 horizontal / 4.35 vertical radii, 3.45-wide timber track, 4.5-unit westward drift and 6-unit lateral separation. The exit continues slightly south of west on its own ten-unit runway.
- The meadow clearance reservation excludes scenery from the authored track area. Existing bowl and hollow trunk remain in place.

## Contact and movement
`skateLoopSample` supplies position, tangent, full orthonormal frame, lateral lane placement, and a wheelbase curvature correction. The cedar tread, backing, edging, planks, and rider use this same geometry. Momentum integration uses bounded 8ms substeps, tangential arcade gravity (3 units/s²) and rolling drag, with no speed floor. Underpowered riders roll back to the entry; completed riders retain the exit tangent and regain free control. The entry still requires an aligned swept crossing at >=0.8 units/s; 8.4 units/s is the recommended completion speed.

The shared tire solver also fits the four skateboard wheels, eliminating the floating roll-in seen during browser review. The bike solver fits the real 0.5858-unit tire radius, 0.5 axle elevation and 1.92 wheelbase to two sampled tire envelopes. It replaces the old highest-terrain-sample lift and arbitrary 0.2-unit elevation. Local pitch is applied after heading (YXZ), with wheel spin around its local axle. Both contacts are checked on planar slopes at all headings and on the real mountain surface. Approximate measured cost in this environment: 1.1ms per solve.

## Qualification
- 344 World unit tests pass after integration with the existing Arcade Cavern artwork.
- Typecheck, focused strict lint and the Next production build pass.
- Browser acceptance starts at the ordinary roll-in menu destination and drives with W. It verifies real entry, inverted traversal, completion scoring, movement after release, uphill/downhill bike contact, and the relocated canyon arrival. Frame-synchronous canvas capture records inversion; the camera views through the open side of the spiral.
- Local browser evidence is written to `artifacts/world/sequoia-loop-browser/`. Remote CI and preview review remain release gates; this update does not merge to production.
