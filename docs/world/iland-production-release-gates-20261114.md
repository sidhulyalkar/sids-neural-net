# Sid's iLand: Production Readiness and Rendering-Bounds Audit
**Review checkpoint:** PR #171 stacked on Ski V3 PR #170. This document is an engineering acceptance contract, **not** proof of deployment readiness. No merge or production deploy without authorization.

## Current implemented work to inspect
- PR #170 at `a5d3a20e`: V3 skiing with a reversible flag, renderer, independent ski-to-snow fitting, test/telemetry and runout.
- PR #171: wet-sand skimboarding, 11 region-specific Cairn narratives, batched redwood understory, species-specific fauna gait, Redwood tunnel browser trajectory, Disc Golf camera evidence.
- `e4f741ba` tightens geometric consistency: the old timber-loop zone rectangle missed portions of the western offset spiral; now `insideSkateLoopFootprint` follows the exact 2D parametric projection used by `skateLoopSample`. The bowl's separate decorative bark apron now lies above (not coincident with) the deck and omits triangles across the eastern split. Mesh-level tests compare full tread and understructure against the physics pose, sample bank triangles between vertices, and check bark clearance.
- `db4610ea` revises outdated QA: the big-air browser test now explicitly arms Ski Jump through the existing UI instead of assuming that an unarmed free-ski hop enters scored Big Air. It captures airborne pixels and flight telemetry on the same RAF. The clean-halfpipe browser remains spatially strict but tolerates slower SwiftShader frames, with a separate no-progress failure.
- Existing detailed review: [iLand excellence Astra handoff](./iland-excellence-astra-review-handoff-20261114.md).

## Authoritative world geometry: no hidden alternate coordinate systems

| Feature | Authoritative contract | Renderer contract and risks |
| --- | --- | --- |
| Redwood skate bowl | `lib/world/skatepark.ts`: park center (-6,40), halfWidth 14, halfDepth 12; bowl center (-12,40), floor radius 2.12, rim radius 5.65, bark radius 6.85, height 2.62; `skateParkSurface`, `redwoodBowlBankRise` | `worldSkateGroveGeometry.ts`: main 96×84 vertex deck. Decorative bark MUST NOT create wheel collision or coincide with deck; the eastern split must be an actual open passage. Test bank triangle interpolation vs analytic wheel height, not just vertex agreement |
| Full timber loop | `SKATE_LOOP`: center (19,51), radius 3.75, radiusY 4.35, width 3.45, west exit shift 4.5, north lane shift 6. The spiral is **open**, not a closed vertical torus | `skateLoopSample` owns tangent/right/up and tread pose. 144-segment cedar skin, bark backing, coping and end runouts must remain consistently behind/contacting that pose. `insideSkateLoopFootprint` now determines actual semantic zone for the displaced exit |
| Hollow sequoia tunnel | Center (0,59.1), halfLength 5.35, inner radius 2.85, inner halfWidth 2.61, taper .02 | `sequoiaTubePoint` and `skateTunnelSample` own all inside-surface pose. Inner skin and physics must share sampled coordinate, with real open mouths. No accidental second heightfield supporting the ceiling; 3D ride state must hand back cleanly |
| Meadow flow | Connector x [-11,35], z [34.9,64] with an x-dependent northern limit; flow x [7.4,25.6], z centered 39.4 ±4.5 | Every rendered triangle must lie on an actually rideable, nonwater support region; cells straddling a clipping boundary can produce visible wedges, so sample edges not only centers |
| Granite Ridge skiing | `mountainHalfpipe.ts` for authored face and `ski/simulation.ts` + `ski/renderedSnow.ts` for V3 | Independent soles, bank turn radius, snow mesh triangles, animation and post-run handoff. Do NOT change streams, waterfall, protected mountain back face, or global terrain to hide a ski-contact error |
| Ski Jump | `bigAir.ts`: marked lip (-2,-49), run-up (-2,-65), min launch speed 8.5; **requires menu arming** | `bigAirPhase` must remain idle during ordinary unarmed skiing; authorized flight and birds tested separately from V3 free-ski airborne `skiRidePhase` |
| North Shore skimboard | `skimboarding.ts` wet/dry contact, wave and wash samples | No sustained board ride or water wake over dry sand. Align water animation, contact and shore geometry; test transitions across actual sampled surface |

**Scene invariants:** Physics has a single authoritative contact surface per active medium. A rendered decorative shell never silently adds a second collider. Every interactive feature has an open approach, controllable traversal, recoverable exit and compatible camera. Do not count a name/zone label as proof of physical entry, a simulated pose as proof of rendered pixels, or a software-renderer measurement as a hardware frame-rate guarantee.

## CI: factual release blockers and separation of concerns

The earlier `476d1cc` checks reported:
- Redwood Skate Grove, Island Recovery, Ski Camera/Contact, World Landscape, FRONTIER, North Shore, Hidden Gallery and several other checks passed.
- Clean Halfpipe failed: at 75 seconds the SwiftShader browser recorded downhill motion within the pipe (speed 6.5 world units/s, z progressed to about -45) but did not reach the required exit z > -44. The authored feature itself was not shown to be stuck; retain the actual endpoint assertion, add stalled-position evidence.
- Jet-Ski Browser Acceptance failed **after** the Disc Golf camera correction: its `playtest-mountain-jump.mjs` still expected an unarmed ski session to create a scored Big Air flight. This contradicted `shouldLaunchAuthoredSkiJump`. The new test follows the real menu arming and marked-lip contract.
- Never label the Jet-Ski water vehicle itself broken solely because the combined workflow failed another sport's test.
- Test evidence for `e4f741ba` passed the World Landscape Regression unit stage, including the new bowl/loop geometry checks. Reconfirm the **latest** head's entire CI, including bundle, visual browser QA, mobile coverage and legacy Ski V3 flag-off configuration.

Always attach exact SHA, test duration, GPU/software-renderer identity, screenshot or video, and a meaningful failure trace.

## Specific defects for Astra to investigate using actual frames

**P0. Skate bowl and loop visual acceptance**
1. Record a genuine single-button grove roll-in, bowl wall carve, eastern split exit and landing at slow, medium and fast speeds.
2. Record front and side views of the timber loop at entry, inverted (angle ≈π), exit and return to ordinary steering. Inspect board wheels, body orientation, coping collision, visible silhouette, support backing and approach rails.
3. Inspect the bark/apron after `e4f741ba`: no black flickering, material clipping, double-layer wood, empty triangle holes, phantom walls or intersecting roots. Compare the rendered mesh with wheel-ground contact, especially halfway between surface grid vertices.
4. Test simultaneous Q/E grabs, manual, trick scoring, high-speed carve and first-person/third-person camera collision where applicable. All evaluations must use actual keyboard/gamepad inputs and frame-aligned screenshots.
5. Check whether the decorative or physically sampled loop bounds overlap neighboring structures, navigation volumes, tree collisions or camera blockers. Log numerical bounds and the position of each mismatch before changing the art.

**P0. Ski V3 release qualification**
1. Quantify real sole support versus cosmetic tip/tail overhang; inherited peak gaps were ~0.65 world units. Avoid arbitrary mesh offsets and global terrain reshaping.
2. Run controllable bank-to-bank halfpipe turns, fall/recover, keyboard 180/360, charged release, actual touchdown and V3→exploration continuity. Capture synchronized telemetry and video.
3. Qualify actual GPU/WebGL smoothness on normal desktop and mobile, distinct from software CI frames. Review 20, 30, 60 and 120 FPS physics/control parity where feasible.
4. Confirm flag-off legacy, flag-on V3, and separately menu-authorized Ski Jump behave correctly with no unrequested scored flight.

**P1. Remaining sports and camera review**
- Disc Golf: second-shot rendered camera and player framing must be visible; preserve reporting of conservative occlusion proxy disagreement, and inspect the real screenshot.
- Jet-Ski: independently test water contact, free-ride, boost, steering, race gates and docking.
- Mountain bike: trail boundaries, ride recovery, wheels touching terrain, jump/landing and camera clipping.
- Skimboard: wet foreshore launch, wash/water planing, surf face, trick, touchdown, dry-sand cutoff and beach foreground obstruction.
- Redwood sequoia hollow log: all inside-surface frames, tangent steering, exit, recoverable fall, real scene/geometry clearances.
- Swimming, snorkeling, gallery and Arcade Cavern: avoid underwater z-fighting, floor flashes, clipping, blocked exits and distracting HUD overlaps.
- Cairns: mobile focus/scroll, genuine media, coherent stories and correct deep links for all 11 region IDs.
- Wildlife: habitat-appropriate placement and movement, no interpenetration or repeated identical animation, no excessive draw calls or obstructed sport corridors.

## Suggested split for token-constrained Astra

**Astra task A (top priority, visual evidence only):** `Review PR #171 and docs/world/iland-production-release-gates-20261114.md. In a hardware browser, ride the Redwood bowl, entire offset timber loop and hollow tunnel. Produce one evidence packet: screenshot/frame, actual input and telemetry, observed flaw, source file/line, priority. Do not rewrite physics or add scenery before identifying a reproduced defect. Do not merge.`

**Astra task B (after A):** `Review Ski V3 PR #170 and stacked #171. Collect exact-head unit/CI, hardware FPS, authentic keyboard 180/360, ski-to-snow clearance, bank-to-bank carving and clean handoff. Make only clearly justified local fixes to the existing draft branch, preserve the flag. Report pass/fail for each gate.`

**Astra task C (after code release gates):** `Review 11 Cairn stories, photography links, research provenance and adjacent flora/fauna visuals. Select three highest-value improvements supported by genuine media; implement without modifying sports/terrain physics. Verify mobile and accessibility.`

Keep results on the relevant existing draft PR, not a cascade of overlapping exploratory PRs. Once gates pass, request authorization for merge and production rollout with a reversible flag and measured post-deploy smoke checks.

## Gate matrix before release
- [ ] Full workflow suites pass on **one identical head SHA**, including Website CI, World Landscape, Redwood Skate Grove, North Shore, Ski, Island Recovery and the bundled Jet-Ski/Disc Golf/Big Air suite.
- [ ] Authored 3D skate loop and tunnel visibly match wheel/body/camera poses at entry, inverted, exit and recovery.
- [ ] Redwood bowl has no visible z-fighting/overlays, and physics and triangulated rendering agree within tested tolerance.
- [ ] Ski V3 controlled tricks/contact/halfpipe and flag-off fallback independently qualified.
- [ ] Desktop hardware and representative mobile hardware frames reviewed; poor SwiftShader frame time is disclosed, not treated as hardware performance.
- [ ] No unrelated regressions in protected geography, waterfall research museum, reef corridor, arcade, photography, FRONTIER or home navigation.
- [ ] Link, keyboard, focus, reduced-motion and accessible UI smoke tests; no unexpected modal lockout.
- [ ] Explicit decision on feature flag, rollback path and production verification; user authorizes release.
