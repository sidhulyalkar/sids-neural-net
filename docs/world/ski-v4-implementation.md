# Ski Dynamics V4: snow-force redesign (experimental, draft)

This replaces *grounded skiing physics*, not the island's ecosystems, mountain hydrology, museum, skating/biking, homepage, or explicit Ski Jump authorization. Do not merge or deploy to production from this draft. The opt-in browser route is `/world?ski-engine=v4`; the ordinary mode is unchanged until separately approved.

## Findings from the actual V3 implementation

- Ski V3 `simulation.ts` directly integrates `yaw += turn*dt`. Its edge variable primarily changes sideways damping, and its brake is a separate post-hoc velocity multiplier. This does not derive skier turning from the loaded snow edge.
- Its `SkiVisualSole` changes presentation only, with a .18-unit bend. The old 2.55-unit rigid ski recorded up to .87 units of toe/tail clearance on the halfpipe. Minimum clearance alone cannot qualify contact.
- The pipe rises 7.6 units in 4.1 units of bank width. Wall angles approach 75 degrees and the lip curvature radius becomes very small. The existing geometry needs its own ski-length/curvature qualification.
- The production Vercel preview previously lacked `NEXT_PUBLIC_SKI_V3=1`; the existing feature flag was not set. V4 must be explicit per URL to remove ambiguity. A READY deployment is not a physics qualification.
- The prior V3 five-carve lab yielded 1/6 bank visits and 0/5 bank traversals. The test proves *that controller failed*, not that all inputs must fail.

## V4 physical model

- At 120 fixed ticks/s, sample the exact triangulated rendered-snow heightfield as a deterministic scalar surface. Estimate normals using symmetric spatial derivatives. Do not derive physics from raster frames or from camera orientation.
- Give each ski its own ±0.23 lateral boot anchor, 17 longitudinal contact stations and 3 width samples per station, ±0.095. Use a binding-centered constraint. A distant high tip is **not** allowed to count as the loaded binding patch. Report per-ski loaded fraction, penetration, maximum gap, support interval and finite flex (≤0.16 world units). Flex is bounded; physically impossible overhangs must remain visibly/reportably unqualified.
- Player steering commands a signed ski edge angle with a bounded response rate, not a magical world-space heading. Edge load and sidecut radius generate a centripetal force perpendicular to actual travel, capped by the available normal load and snow traction.
- Longitudinal motion is accelerated by gravity projected onto the *actual* snow slope, with glide resistance and quadratic air drag. A clean carving force is perpendicular to travel and does no direct longitudinal work. Speed reduces by turning across/uphill or through dissipative snow shear.
- `S` progressively introduces a snowplow wedge and, with steering, an attack/slip angle. Forces dissipate speed and can settle the skier without relying on a top-speed clamp. `W` tucks to reduce aerodynamic drag. The control mapping is a prototype, not a measurement from Bonvo.
- Keep aerodynamic and snow resistance as game-tuned coefficients; neither pretends to be a laboratory-measured snow constitutive law. No shooting targets, boosts, or auto Big Air.
- Airborne physics owns its own 3D velocity, rotation/charged hop and touchdown classification. The existing trick qualification observer reads the same tick-aligned V4 state. A trick is not scored from a screenshot or proxy animation.

## Architectural boundary

- `lib/world/ski/v4/core.ts`: independent fixed-step dynamics, edge forces, snow contact, jump state and telemetry. No renderer, browser, or legacy `stepTravel()` dependence.
- `lib/world/ski/v4/adapter.ts`: compatibility facade to the current Three.js skier renderer. The old `SkiSimulation` step is never called when V4 is selected. The adapter records the difference between authoritative V4 boot support and the existing rigid-ski visual pose; it must not quietly relabel this mismatch a physics PASS.
- `components/world/worldRenderer.ts`: minimal opt-in switch, normalized skier-relative input, separate V4 telemetry and an experimental status tag. All other world activities and the old Ski V3/legacy flags must retain current behavior.

## Test order / non-negotiable release gate

1. **Force invariants:** stable neutral glide; mirrored left/right edging; lateral acceleration does not inject forward energy on flat terrain; progressive brake stops on flat; turn-across-fall-line reduces speed relative to straight descent; stable one-contact, two-contact and no-contact behavior.
2. **Determinism:** replay the same per-tick steering/brake/jump inputs at simulated 20, 30, 60, 120Hz including jitter; no frame-rate dependency or lost input after tab blur.
3. **Physical contact:** per-ski min/mean/max gaps against *rendered triangles*, station pressure and support intervals under the binding. Zero penetration beyond small tolerance near loaded contact. If bank curvature cannot support the selected ski length/flex, FAIL instead of inventing attachment.
4. **Halfpipe:** six actual alternating bank visits (five crossings), input-only (no scripted position or velocity), controlled speed and stop before runout, consistent ski contact and chase-camera visibility. This is **not yet proven** by flat-slope unit tests.
5. **Aerial:** player-executed 180/360, genuine takeoff, airborne input, landings and recoveries, including switch landings; no Ski Jump mode unless explicitly selected.
6. **Browser and native devices:** verify the exact selected engine in WebGL, portrait and landscape, keyboard/touch/gamepad, screenshots with actual skis touching snow, native desktop GPU and iOS/Android frame p50/p95/p99. No SwiftShader frame metrics claimed as hardware evidence.
7. **Integration:** all prior world, gallery, waterfall, shoreline, nature, Shasta, biking and skating regressions plus the current homepage and FRONTIER/site gates. Compare candidate exact SHA against master and previous iLand preview before release approval.

## Known limitations of the first V4 slice

- The core force law and binding-centered contact are implemented and unit-tested on controlled planes. It is an *independent real physics prototype*, not a final validated ski simulator.
- The adapter currently reuses the rigid V3 ski pose renderer; a large offset between its pose and physical V4 boot contact is an **open visualization blocker**. The contact telemetry exposes it rather than hiding it. A ski beam/contact material and real leg-boot binding constraints remain work.
- Existing terrain bank radii and the full rendered-mesh halfpipe controller need measured V4 trial results. Do not alter protected mountain/hydrology to hide excessive curvatures.
- A dedicated browser check must prove the opt-in V4 route and normal Skiing menu, not an invisible test harness. Running V4 on a Vercel preview must be expressly identified as an experiment.
