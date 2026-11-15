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

## 2026-11-15: first exact-browser failures and conservative input/contact corrections

- V4-preview first inherited legacy ski spawn behind the pipe at z=-62.65 and ran downhill into Joshua. The explicit V4 selection now uses (7,-58.5), where the active channel has geometric influence, without changing legacy/V3 spawn.
- The browser first checked edge **after** releasing D; that sampled relaxed contact rather than proving player steering. It now waits for live held-D edge and carve telemetry, while refusing synthetic position/momentum changes.
- A second browser pass proved the skier reached inside the halfpipe but was already at z=-45.86 when a slow software-render snapshot arrived. A new read-only `skiV4Spawn` diagnostic captures the actual command-time location, rather than failing based on the time screenshots take.
- An analytical grade sweep exposed weak S braking on steep slopes: with grade 0.5, speed after 2s was ~6.69 with S versus ~11.33 without. Increasing *shear/ploughing resistance* with a finite 0.5s press-in and 0.25s release ramp locally stopped the same controlled grade near zero, without a maximum-speed clamp. These are provisional game-force coefficients, not snow measurements.
- Genuine user braking and physical halfpipe traversals remain unqualified until exact-browser traces and same-head CI pass. The full 24-config halfpipe audit currently reports zero qualified runs, including unsupported contact patches and multi-unit toe/tail gaps on steep lips.

### 2026-11-15: first browser motion, low-speed control and ready stance

The previous Chrome test confirmed genuine held-D edge force and held-S deceleration, but its slow browser screenshots observed skiing on the coastline, not Granite Ridge. Passing a keyboard responsiveness test is not proof of a usable halfpipe.

A controlled local Ski V4 physics revision now (1) retains the skier at the chosen ski spawn until deliberate W or steering input, (2) increases turning force at low speeds via speed-dependent attack angle, and (3) increases continuous snow rolling/snowplow resistance so speed changes arise from the forces rather than an arbitrary speed clamp. The displayed experimental HUD states when the skier is ready. It does not imply these arbitrary coefficients are measured from physical ski equipment.

The browser qualification now captures starting pose and input telemetry **before** high-latency screenshots; it requires the actual on-screen skier to be at Granite Ridge before motion. A separate geometry budget exposes the incompatible steep-lip dimensions and rigid ski flex limit. Halfpipe crossing and real-device performance remain blockers.

### Release qualification priorities for the next integration

1. **Engine identity and entry:** on /world?ski-engine=v4 the first visible frame must show the skier inside Granite Ridge, zero velocity, planted-ready=true, and an explanatory W/Up to glide cue. Only genuine input may begin the run.
2. **Actual speed versus appearance:** for every held-W, held-D and held-S test, store input, tick, world position, horizontal velocity, edge radians, carve acceleration, skid deceleration, and ski-contact patches before invoking any potentially slow screenshot operation. Never use screenshots as the sole proof of steering forces.
3. **Control and energy balance:** in a level snow run without jumping, braking never increases kinetic energy. A 0.5-grade snowplow should reduce horizontal speed to less than 10% of the same-grade free glide within two seconds after starting at 5 units/s. A clean low-speed edge turn must bend **actual velocity** uphill, not just change the character's facing angle.
4. **Hard halfpipe gate:** the 90-profile geometry budget is diagnostic only. Do not count five turns, claim loaded-ski contact, or label the ridge playable until six alternating grounded bank visits and five traversals are recorded on the same rendered triangle mesh with sole max-gap and penetration within the approved threshold. No manipulations of actual player coordinates to fake a crossing.
5. **Preserved systems:** all galleries, arcade roof, hydrology, reefs, biking, skateboarding, Jet-Ski, skiing Big Air's explicit menu authorization, mobile controls, FRONTIER and homepage retain their original contracts. The V4 branch remains draft.

Verified on preceding head e2d6fb22: the V4 browser accepted physical input and braking but had already reached the coastline, and the full island release gate failed. This document does not imply exact-head acceptance of the latest physics changes.

## 2026-11-15: mechanics audit, phase V4-2 (not released)

**The old 'carveAcceleration' number was an applied lateral command, not clean-carve proof.**
The model's velocity-relative ski heading could differ by 10–16 degrees during
normal steering because the boot pivot was too strong across all speeds.
Research distinguishes edge angle (tilt against snow) from *attack angle*
(ski-to-velocity heading difference). A substantial attack angle is associated
with skidding; real carving requires a loaded, low-slip engaged edge.

Verified engineering references:
- [Alpine Ski Motion Characteristics in Slalom](https://pmc.ncbi.nlm.nih.gov/articles/PMC7739813/), edge angle versus angle of attack and measured carving paths.
- [Calculation of contact pressure between ski and snow during a carved turn](https://pubmed.ncbi.nlm.nih.gov/19558385/), ski bending, shear, and load distribution.
- [Technique-dependent relation between ski curvature, roll and force](https://pmc.ncbi.nlm.nih.gov/articles/PMC10141132/), combined load, edge angle and local bending geometry.

### Revised V4-2 physics and evidence

1. Limit boot pivot at normal riding speeds; permit an explicit progressive low-speed pivot for recovering turns. Reduce edge carve contribution as measured side-slip grows; let cutting/shear friction dominate large attack angles. Do not infer "carve" from A/D commands alone.
2. Scale lateral grip by **actual loaded contact coverage** along the two binding-centered ski patches. A single touching edge station cannot claim full traction. Unsupported ski bindings receive zero carved lateral force.
3. Integrate the centripetal carved force as a heading rotation that preserves horizontal speed exactly for that portion of the force. Projected gravity, snow shear, aerodynamic drag and skidded braking remain explicit separate terms. No maximum-speed cap.
4. Record player-observable regime (`carve`, `skid`, `transition`, `glide`, `unsupported`, `air`), *actual* slip angle, edge radians, carve quality, contact coverage, measured heading rate and measured radius. Intentional S braking must classify as skidding, not carving.
5. Apply V4 snow tracks at sections that **actually carry contact load**, with corresponding physical beam deflection. Do not draw a footprint merely because an unsupported rigid tip is close to terrain. Interpolate bounded V4 subsegments under low frame rate to avoid disconnected grooves; refuse tracks across teleports.
6. Full deterministic tests cover true low-slip right turns, positive outside-ski loading, large-angle skid rejection, zero edge traction when unsupported, speed-monotonic flat carved turns and bounded edge reversal. Real Chromium must validate those same diagnostics from held user input.

### Crucial remaining defects and blocked release gates

- **Ski yaw is still an assisted rate-limited alignment**, not a full inertia/torque solution from independent skis. It must be independently validated for high-speed transitions, fakie and tight halfpipe walls.
- **Grounded support loss is not a ballistic takeoff.** Contact can become zero while the phase remains `riding`. V4 now reports `unsupported` and refuses to call it carving, but natural unassisted lip takeoffs and safe touchdown need a separate solver change.
- Beam flex is bounded geometry adaptation, not calibrated torsional stiffness or real compaction/cutting constitutive snow physics. The published measurements are references for a *game approximation*, not proof of model equivalence.
- The authored halfpipe is still too steep/tight in many orientations: diagnostic 58/90 infeasible configurations and 0/24 qualified five-crossing runs. **Do not claim playable halfpipe or production skiing** on the strength of controlled-slope unit tests.
- Mobile/touch and frame timing on native hardware, visible edge track shape, actual 3D penetration, ankle/boot/knee poses, double-ski stance and active turn-to-turn navigation remain to be qualified. Menu-only Ski Jump must remain unchanged.

No V4 changes may merge or ship to production until on-mountain human playtesting
and same-head GitHub regression evidence qualify all critical gates.
