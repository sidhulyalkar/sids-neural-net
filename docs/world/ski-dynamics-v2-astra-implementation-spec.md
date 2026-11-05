# Sid's iLand Ski Dynamics V2: Astra Implementation Specification

**Status:** Proposed, implementation-ready engineering contract. No skiing runtime code is changed by this specification.
**Owner:** Sid's iLand / Astra
**Prepared:** 2026-11-05
**Repository:** https://github.com/sidhulyalkar/sids-neural-net
**Base snapshot:** PR #153, feat/clean-mountain-halfpipe-only-20261103 @ 364d513f9cb637ab65f5cd2b4d713d0d49878c77
**Dependency:** PR #153 must be stabilized and verified before V2 is eligible for release.
**Reference experience:** https://bonvo.ski/en/ride and https://zfyl.itch.io/bonvo-ride (publicly documented interaction patterns only; do not copy or imply access to proprietary implementation).

## 0. Executive decision

Make skiing in Sid's iLand a continuous, expressive, terrain-connected experience. Prioritize believable momentum, two-way carving, wall-to-wall halfpipe flow, deliberate aerial control and graceful landing over the number of stunt props, game modes, or HUD elements.

**NON-NEGOTIABLE:** This is a FOLLOW-ON program, NOT an expansion of PR #153. Preserve the existing island, world-navigation conventions, waterways, waterfalls, cave roofs and galleries, marine environments, skate and bike courses, Shasta and all other activities. Do not merge or cherry-pick rejected alpine-park/glacier work from PR #152. Do not introduce automatic scored Big Air from free skiing.

Astra must implement small, isolated, reviewable PRs with real browser evidence. No specification checkbox is proof of implementation; record actual test and visual results against the tested commit.

## 1. Baseline facts and mandatory reconfirmation

The following is a **2026-11-05 snapshot**, not an assertion that these remain unchanged. At kickoff Astra MUST re-fetch branches, working tree, PRs, workflows and latest head before editing. Never overwrite other concurrent work.

- Main currently contains a separate base from the staged World changes. Current skiing candidate is draft PR #153 with a head of 364d513f.
- PR #153 depends on PR #142, using the reviewed world and hidden gallery base. It exists to stabilize one clean carved halfpipe, not to ship a broad terrain park.
- Halfpipe code: lib/world/mountainHalfpipe.ts; mesh refinement: components/world/worldMountainHalfpipe.ts; world terrain: lib/world/model.ts; movement: lib/world/activities.ts; rendering and controls: components/world/worldRenderer.ts and components/world/WorldHome.tsx; scored ski jump: lib/world/bigAir.ts.
- As implemented at that snapshot: centerX=7, startZ=-61, endZ=-33, floorHalfWidth=2.3, lipHalfWidth=6.4, featherWidth=1.0, bankRise=7.6, centerCut=2.5, endBlend=4.5. The original prose spec and some PR description numbers differ from the actual model. Treat the model as the observed source, reconcile documentation, and NEVER quietly change geometry to match stale prose.
- The current ordinary ski speed target is 15 world units/s, with a 6.5 world units/s target inside the pipe; ski steering is rate-limited only there, while the global movement solver directs other ski turns almost immediately. Ski speed is primarily a target-speed approach rather than conserved physical velocity.
- The existing separate Ski jump mode requires explicit menu arming and marked-lip crossing. Free skiing and the halfpipe manual pop must not arm or enter that challenge.
- The 2026-11-05 clean halfpipe browser CI failed waiting for the world canvas/Skiing button after clicking Explore world. This never reached the actual ski scenario. Landscape regression had passed. Do not mislabel this as a verified halfpipe physics failure or treat it as a pass.
- Current ski visual uses two simplified planks/poles. Existing terrain contact and normal sampling are already available through world physics/rendering utilities.
- Backside authored timber lines/transfer tests are present. They remain separate from the halfpipe front-face geometry and should be improved only after the core skiing solver qualifies.

**Kickoff gate:** Verify the up-to-date facts, read docs/world/clean-mountain-halfpipe.md, list failed CI steps, and produce a short evidence table containing branch, SHA, green tests, failing tests, protected baseline SHA and screenshots available/missing.

## 2. Goals and explicit non-goals

### P0 goals
1. Smooth edge-to-edge steering on every skiable slope: no sudden direction snap, unnatural speed reset, or hard discontinuity at the halfpipe boundary.
2. Coherent slope acceleration and controlled braking/tucking. No invisible speed boost or physically implausible uphill acceleration.
3. Ground contact from one authoritative sampled surface; visually and collision-wise clean approach, wall, crest/lip, and runout.
4. Wall-to-wall halfpipe ride at modest entry speed, natural wall climbing and turning, deliberate jump with predictable landing.
5. Deterministic time stepping robust to browser frame-rate variation, with safe pauses and context loss handling.
6. Existing Ski jump stays exclusively menu-authorized and works as before; no auto scored flight from unselected terrain.

### P1 goals
7. Independent skis, edging/stance, knee compression, airborne posture, landing absorption, subtle snow spray and tracks.
8. Controller/touch support with an accessible and discoverable, low-clutter ski control scheme.
9. Reliable backside timber ride lines: branch choices, entry, transfers, landing clearances and recoverability.
10. A subtle, optional ghost replay and personal-best descent using deterministic recorded inputs or sampled playback.

### Explicit non-goals
- Replacing the island renderer, moving or scaling the mountain globally, adding a glacier tunnel, rebuilding waterfalls or caves, modifying the arcade/gallery/marine systems.
- Adding many ramps, black marker beams, a new visual obstacle park, or new forest props in the front ski corridor.
- Implementing a full real-world ski biomechanics simulator, damage/injury gameplay, multiplayer, remote leaderboard, telemetry service or paid assets.
- Copying Bonvo source code, assets, level data, or UI. Public control and experience concepts may be independently implemented.
- Changing Run, Skate, Bike, Snorkel, Jet-Ski, Disc Golf or Shasta semantics through shared movement code.
- Claiming hardware-accurate speeds, friction coefficients, physical meters, or biomechanical realism without calibration. World units are engine units.

## 3. Experience contract: player-visible behavior

A new player selects **Skiing**, spawns on a safe downhill approach, and can descend without requiring constant forward input. The controls permit gradual direction changes and free speed management. They can enter the halfpipe, arc toward either wall, climb, turn back, cross the trough and repeat. A deliberate jump charges then releases; merely crossing a lip does not activate Ski Jump scoring or the special Big Air camera. The skier lands with speed and heading consistent with the approach and touchdown, not with an arbitrary position snap.

Outside the halfpipe the same steering inertia remains coherent. On the backside, old authored tree/log features are encountered naturally and can be traversed or skipped. Free-ride users have no intrusive scoreboard. A visitor can enter/exit skiing cleanly and return to every other island interaction.

**Required exact user journey:** Welcome > Explore world > Skiing > approach > enter halfpipe > left wall > return to bottom > right wall > intentional pop > airborne control > clean landing > exit to normal slope > re-enter halfpipe > optional Ski jump (separately armed) > exit mode > another activity. Cover desktop keyboard, gamepad and mobile touch.

## 4. Physics architecture and ownership

Create a ski-specific, pure TypeScript simulation independent of Three.js, React, browser APIs and rendering. Suggested filenames (adapt only with written rationale):

    lib/world/ski/skiTypes.ts
    lib/world/ski/skiControls.ts
    lib/world/ski/skiContact.ts
    lib/world/ski/skiDynamics.ts
    lib/world/ski/skiAir.ts
    lib/world/ski/skiTuning.ts
    lib/world/ski/skiReplay.ts
    components/world/worldSkiAnimation.ts
    components/world/worldSkiEffects.ts

Do NOT copy the existing global stepTravel() function. Put ski-specific state/dynamics behind a flag and call the new solver only when selected activity is 'ski', on the surface, in ordinary free skiing. Preserve specialized rails, external stunt sessions, underwater layers, mode changes, obstacle constraints and recovery mechanics. Keep current solver as rollback path until new branch qualifies.

Suggested state:

    SkiState {
      position: {x, y, z}; velocity: {x, y, z};
      forward: {x, z}; yawRate; edge; lean;
      crouch; jumpCharge; contactNormal: {x, y, z};
      grounded; surfaceId; airtime; landingCooldown;
      lastSafeContact; mode: 'free' | 'rail' | 'air';
    }

Suggested input, normalized and tested independently:

    SkiInput { steer: [-1,1]; tuck: [0,1]; brake: [0,1];
               jumpHeld: boolean; jumpReleased: boolean;
               grab: boolean; airPitch: [-1,1]; airYaw: [-1,1]; }

Keep the existing Travel/Point semantics where practical. Avoid parallel copies of skier position becoming unsynchronized; define one authoritative conversion boundary between SkiState and world runtime. A pure dynamics function must accept ground samples and obstacle queries explicitly via injected interfaces.

## 5. Deterministic time stepping

Use a fixed-step accumulator for ordinary skiing at a nominal 1/120 s physics tick; render interpolation remains separate. A 1/60 s fallback is acceptable if profiled and accepted with the same quality gates. Clamp a single accumulated catch-up window to <=0.20 s with a maximum step count (for example, 24 at 120 Hz). On background tab, pause, long sleep or WebGL context loss, freeze/reinitialize the accumulator without moving the skier through terrain. Do not accelerate or skip large spatial distances by integrating one long frame.

Keep physical elapsed simulation time distinct from wall-clock display time. Input event edges such as jump release must be consumed once, not replayed for every substep. Avoid input loss on tab switches and rapid mode changes. Replay records canonical input per physics tick with version and tuning fingerprint.

At identical input/surface initial conditions, 20, 30, 60 and 120 render FPS should produce nearly identical end positions, headings, takeoff/landing events and speed. Separate scene render throttling must not alter gameplay rates.

## 6. Ground motion model

### Terrain and gravity
Compute the same terrain contact position and surface normal used by the rendered ski pose and collision. For a heightfield h(x,z), sample bounded derivatives using central differences and calculate an upward unit normal proportional to (-dh/dx, 1, -dh/dz). Use stable one-sided samples at world and surface boundaries. Reject/guard nonfinite values and sample uncertainty.

Project gravitational acceleration onto the surface tangent plane, then update horizontal velocity along that tangent. Use the existing game's nominal gravity scale of approximately 14 world units/s² as a compatibility starting point, NOT a measured physical value.

### Steering and edge grip
A/D controls steer *the skis*, not teleport the velocity vector. Model skis' facing direction, forward velocity and lateral slip separately. Convert steering intent to a bounded target yaw rate / curvature affected by speed, edge engagement and contact, then smoothly converge. Apply stronger lateral friction when edging a carve, lower lateral grip for a deliberate skid. Resist instantaneous 180-degree reversing, particularly at high speed. Preserve direction and momentum when input returns to neutral.

Steering behavior must be continuous at the halfpipe influence threshold; do not switch abruptly between the current pipe-specific and generic ski steering laws. Enforce minimum sensible turning radius at higher speeds and a controllable low-speed carve at entry.

### Tuck, braking, and flats
Tuck decreases drag and crouches the avatar; it must NOT create energy without gravity or a bounded, explicit flat-ground propulsion mechanic. Brake increases longitudinal drag and can produce a skid-like visual without reversing direction. If a small skating/pole-push aid is added for flats, cap and label it as assisted propulsion and never apply it automatically uphill. Clamp extreme speed only with a soft, documented, tuneable control law (not hard snapping the state from 15 to 6.5 at the pipe boundary).

All tunables must be centralized with comments about their units and intended gameplay effects; do not spread hidden constants across worldRenderer and activities.

### Bounded energy behavior
A downhill section should generally gain speed without constant input; uphill travel should slow or reverse when energy is depleted. Carving, braking and collision should not spontaneously add energy. Track an approximate mechanical-energy diagnostic (v²/2 + g*y) for development tests and flag unexplained gains beyond the intended bounded assist policy.

## 7. Halfpipe geometry, lips, walls and pumping

**Preserve the actual current geography by default.** The initial V2 work may modify only the existing authored halfpipe's mask, and only after proving other terrain samples stay bit-identical. Any proposed dimension edits require before/after screenshots and a revised contract, not casual tweaks to make a test pass. No edits to streams, the water catchment, mountains outside the existing two patches, arcade roof, museums or nearby Joshua course.

### Shared surface
Terrain height, skier support, terrain normal, rendering mesh, ground collision and camera collision must sample the same authoritative terrain definition. Eliminate T-junctions, inverted triangles, face-normal spikes and mesh-vs-collider seams. The current refineMountainSnow() implementation dynamically subdivides existing indexed terrain; verify topological continuity and correct winding across original and subdivided faces. Preserve neighbor vertex consistency at split boundaries, avoiding cracks when adjacent triangles are not split equally.

### Geometric quality
Demand at least C1 cross-sectional continuity at flat-floor/wall, wall/lip and lip/feather transitions; target C2 where it improves ski contact and is reasonable within the same footprint. Compute finite-difference first-derivative and normal-angle scans along both walls, at multiple z values, with especially dense sampling at mask edges. Validate no sudden curvature reversal that throws skiers off the terrain. Aesthetic lip radius and runout shapes require visual sign-off at fixed camera coordinates.

### Wall-to-wall locomotion
When climbing the wall, the solver should naturally convert kinetic energy to height; when descending, it converts height to speed. A user with sufficient momentum can traverse left-right repeatedly. Steering toward the wall then back inward produces a carved U-turn instead of a collision stop, redirect teleport or uncontrolled launch.

### Pumping
If pumping is added, derive a small assist from deliberate crouch/extension timing near transitions, not from merely entering the pipe. Keep gain bounded, explainable and disabled if the input is neutral. Log work added and make the effect separately tuneable/disableable. Prefer releasing this as a later P1 feature if it risks P0 contact stability.

### Lip departure
A skier may leave the snow naturally because of velocity and terrain geometry; a special pop requires explicit user action. No automatic scoring, Big Air mode, teleports or rocket launch impulses. Prevent face-catching at the crest, clipping through a lip, or snapping back to the top. Swept contact detects transitions from snow support into flight and returns through ground collision.

## 8. Jump, air tricks and landing

Replace the present immediate ski pop with an intentional hold/release action behind the V2 flag. Tapping still produces a small hop. Charging is bounded (provisional 0.0-0.6 s); release creates the impulse only when grounded or within a small validated coyote-time window and not in a modal challenge. Never allow a jump to auto-trigger from ordinary terrain, accidental keyboard repeats, spawning, touching a crest, or leaving a rail.

Air motion retains takeoff velocity and existing gravity convention. Provide limited pitch/yaw control and optional grabs, keeping the first release minimal. Midair steering must not instantly rotate the horizontal velocity toward an arbitrary input vector. Limit aerial angular acceleration and stop rotations on landing. A grab is a visual/trick state, not a physical speed boost.

Land by a swept segment/surface crossing, including steep terrain. Quantify landing quality using velocity alignment with slope tangent, normal impact speed and skier orientation. A bad landing must visibly recover/slow without permanently trapping the player or forcibly teleporting to an unrelated checkpoint. A clean landing should preserve plausible tangential speed and transition immediately back into carving. Test near lip, both walls, runout and generic mountain slopes.

**Separate mode authority:** lib/world/bigAir.ts remains the only scored Ski jump flow; free skiing and manual halfpipe airtime must never set the special armed/flying flags or HUD. Explicit menu selection and crossing the marked lip must continue to function.

## 9. Controls and compatibility

### Keyboard free-ski context
- A / D or left/right arrows: lean/steer left and right, continuous and speed-aware.
- W or up: tuck while descending; permit a tiny explicit pole-push on flats only if approved and separately bounded. Skiing should not require holding W to glide downhill.
- S or down: progressive brake.
- Space: hold to load pop, release to jump. Ignore repeated keydown and clear charge when mode/pause changes.
- Shift in air: grab. Avoid conflict with other activity sprint behavior.
- Esc / M: maintain existing world/menu semantics. Existing Ski jump selection stays separate.
- Camera look drag remains available and may not modify the skier's physical heading unexpectedly.

**Compatibility warning:** The old generic world controls are camera-relative WASD movement. Converting A/D into steer and W/S into tuck/brake is deliberately ski-only. Behind the V2 flag, show one concise first-entry controls hint and update activityConfig('ski'); never quietly change controls for Run, Skate, Bike or other activities. Preserve optional backwards-compatible movement mapping for quick rollback during qualification. Do not steal common keyboard shortcuts when a dialog/input has focus.

### Gamepad
Left stick X steers, right trigger tucks, left trigger brakes, south face button jumps (hold/release), right shoulder grabs in air; right stick camera remains consistent with world navigation. Detect dead zone, per-axis smoothing, disconnects, remap overrides and controls help. Never let simultaneous touch+gamepad input double the impulse.

### Touch
One low-visual-weight left steering/tuck/brake region and one intentional jump/grab control. Keep existing mobile dual-stick movement/camera conventions where possible and adapt only in ski mode. Controls must not cover the halfpipe lips or main downhill sightline. Support landscape and portrait; targets large enough for touch, reduced-motion setting, and actual mobile browser tests.

## 10. Visual and camera specification

### Skier rig
Use a single world-contact frame with two independently positioned ski planks. Compute front/rear contact height from the same sampled surface; no floating uphill ski or tips penetrating the lip. Animate knee compression, subtle torso counter-rotation, edge tilt, ski separation/parallelism, poles and landing absorption. Blend in/out smoothly at neutral speed and across state changes. Do not replace the whole avatar with a new, heavy character framework.

### Snow surface
Maintain the island's restrained natural palette. Improve snow lip shape, ski-track readability and roughness/lighting using inexpensive materials. No glossy plastic terrain, opaque black marker beams, disconnected white sticker meshes or excessive particle fog. Respect protected visual composition near the waterfall and arcade.

### Effects
Snow spray should be emitted from edge contacts when edge load/slip/speed crosses thresholds; size/opacity should reflect the physical event. Leave two short fading ski-track ribbons sampling true contact positions. Prefer pooled, instanced geometries/particles or batched ribbons. Disable or aggressively simplify these on weak devices and under reduced motion. No per-frame material, geometry, array growth or Three.js object creation.

### Chase camera
Add a ski-only chase rig that follows velocity heading with a damped anticipatory lookahead. It should reveal the wall being approached without whipping across the ski path. Smooth pitch, camera boom, and wall occlusion; avoid clipping the mountain or passing through the rider on both walls. Preserve existing gallery, arcade, coast and other game camera framing. No unwanted cinematic cuts in ordinary skiing; Big Air continues to own its separate explicit camera.

### UI
No permanent freestyle HUD or noisy score panels. Show a compact ski controls hint on first entry, optional small speed indicator if demonstrably useful, and a temporary landing/trick callout. Make hints accessible to keyboard and screen-reader users. Preserve current minimal island branding and visual language.

## 11. Backside timber freestyle lines (separate phase)

The existing backsideLogs, timberTop, timberTransfer, timberLanding and timberExit contracts provide a base. Do not move these objects or introduce a larger park as part of physics P0. Later, review branch geometry and landing in three dimensions: accurate tangent, clearance from arcade roof, handoff momentum, safe gap length, realistic landing acceptance and recoverability. The rider should choose between lines rather than automatically snap into every nearby trunk.

Add checks for both authored transfers (ridge-log to bowl-slide; tree-run-slide to ridge-crossing), both directions if applicable, multiple speeds, air/collision handoff, safe avoidance by ordinary free skiers and preservation of the nearby cavern. Any new timber feature needs a small scene manifest, precise coordinates and collision/art sharing, a separate visual review and a separate PR. Never silently reintroduce retired front-face timber kickers.

## 12. Ghost/replay (optional, after physics qualification)

Record deterministic input or low-frequency sampled poses relative to a versioned course and terrain fingerprint; save locally in the browser. A ghost is translucent, unobtrusive, opt-in and does not collide with the player or add a network connection. Replay must disclose incompatible course versions and invalidate old records when terrain or tuning changes. Offer a single simple restart of the same line before considering timed challenges. No account, remote leaderboard or multiplayer required.

## 13. Rendering, stability, security and accessibility budgets

Profile against PR #153 at the same camera route, hardware/viewport and build mode. Required **provisional engineering budgets** (tune after measurement, never fabricate success):
- Ski physics in a typical 60 FPS frame <=1.5 ms p95 on the agreed desktop reference; no unbounded catch-up loop.
- V2 skier and effects add at most 3 draw calls to a desktop free-ski run and 1 on mobile unless evidence shows a justified alternative.
- No new high-resolution streaming textures, network calls, audio autoplay, dynamic code evaluation, third-party telemetry, or browser-wide event listeners without cleanup.
- No growth in active meshes, material instances, scene children, interval handles or input listeners over a ten-minute continuous ski session.
- Measure total frame-time p50/p95/p99, WebGL draw calls, triangles, memory where available, boot time and context-loss recovery; compare before/after at representative desktop and mobile devices.
- Pause/visibility transitions, reduced-motion preference, gamepad disconnect, touchcancel, unmount and Escape must release held controls and not leave the skier charging a jump.
- Motion-sensitive users may turn off camera bob, zoom pulls, particles and exaggerated pitch without disabling primary game mechanics.

## 14. Telemetry and debug contracts

Use a development-only telemetry adapter and optional debug overlay. Expose stable, cheap canvas data attributes where Playwright already reads them; never depend on arbitrary DOM structure inside physical dynamics.

Suggested properties: skiMode, skiV2Enabled, skiGrounded, skiSpeed, skiHeading, skiYawRate, skiEdge, skiSlip, skiContactError, skiTerrainNormal, skiJumpCharge, skiAirState, skiLandingQuality, skiWallSide, skiTimeAccumulator, skiRecoveryCount, skiEnergyDelta, skiPhysicsSteps, skiParticles, skiTrackSegments. Batch DOM writes and do not re-render React each physics tick.

Provide seeded scenario traces (JSON) with physics fingerprint, initial conditions, action timeline, positions and failure reason. Ensure a failed replay emits concise diagnostics; do not conceal collisions/recoveries behind an aggregate PASS.

## 15. Tests and objective acceptance gates

### A. Pure unit/property-based tests
1. Zero input on downhill snow accelerates primarily downhill; same input uphill loses speed. Brake slows; tuck does not create energy.
2. Steering input rotates heading smoothly, lateral slip remains bounded, no instant 180-degree turn, both left/right symmetric.
3. Equal end state within stated tolerances at 20, 30, 60 and 120 rendered FPS; randomized frame jitter and a long pause recover safely.
4. Jump charging releases exactly once, respects max charge, never launches on auto-contact, keyboard repeat, mode switch or stale button release.
5. Trajectory has no NaNs, no extreme positional delta, no negative/infinite state values, no unbounded energy gains.
6. Landings obey swept contact and recover cleanly near steep terrain, both lips and runout; obstacle tops and roof layers are respected.

### B. Halfpipe/terrain tests
7. Exact original terrain heights outside existing pipe/summit masks, with dense world-grid, boundary scans and fixed anchors.
8. Hydrology path, snowmelt basin, waterfall crown/crest/plunge/downstream, gallery rooms, arcade entire roof, underwater reef, Joshua/Redwood routes retain baseline height, collision and navigation.
9. Both wall cross-sections and longitudinal blends have validated C1 gradients, bounded normal changes, no inverted triangles, visible cracks or mesh/contact mismatch.
10. Wall-to-wall repeated trajectories at a range of approach speeds and steering patterns: no invisible blocked step, no accidental flight or teleport.
11. At lower speed skier can turn around naturally; at excessive speed collisions/landings recover without trapping or arbitrary Big Air.
12. Previously suppressed ski-kicker/bowl-small/bowl-medium remain absent both visually and physically; all unaffected ramp and sport facilities still work.

### C. Integration and UI
13. Existing World, Skate, Bike, Jet-Ski, Disc Golf, Shasta, swimming, caves, photos and navigation tests remain green. No change to those modules unless independently justified by a failing preservation test.
14. Ordinary Skiing never sets special Big Air flags or calls a scored flight; Ski jump from menu still arms and launches at the marked lip.
15. Keyboard/gamepad/touch mappings, focus handling, reduced motion, disconnect/reconnect, menu exit and pause resume work.
16. Complete browser user journey from welcome screen to skiing and back works at 1440x900, 390x844 and at least one landscape touch viewport.
17. Compare fixed before/after screenshots from summit, left lip, right lip, front/downhill, runout, backside timber, waterfall/gallery, arcade entrance, underwater reef, redwood loop and mobile. Human review required for snow material, sky/ground clipping, skiers' feet, lip silhouette and camera.
18. Rendered frames contain no JS errors, WebGL shader errors, nonfinite transforms or background geometry leaks.
19. Run a ten-minute continuous browser soak with repeated jumps and activity switches; check recovery counts, frame time and resource leaks.
20. The dedicated halfpipe browser CI must reach a real WebGL canvas and player action, not simply pass on unit geometry or time out at the welcome screen.

### Initial quantitative tolerances (to confirm before P0 implementation)
- At a common scenario endpoint after 20 seconds, positions across 20/30/60/120 FPS within 0.4 world units, heading within 6 degrees, and takeoff/landing event times within 0.10 seconds.
- Terrain mesh/contact vertical discrepancy under 0.03 world units at tested skier contact locations; no negative normal Y in skiable mesh.
- No single ordinary ski frame advances more than the bounded per-tick travel envelope; zero teleports outside explicit activity/region commands.
- No unrequested scored Big Air across at least 1,000 seeded free-ski transitions at different slopes/lips.
- Automated checks must never be loosened to hide real regressions. If target tolerances prove inappropriate, document evidence and obtain explicit sign-off.

## 16. PR implementation and release order

**Gate 0: Baseline qualification (must finish first).**
- Repair/troubleshoot the PR #153 browser-world initialization failure. Distinguish hydration, welcome-click, WebGL startup, permission, slow software rasterizer and test assertion causes using screenshots/console, page errors and explicit state transitions.
- Reconcile stale original pipe dimensions in PR prose with committed values without changing geography.
- Verify same-head unit, typecheck, lint, production build, browser suite and protected snapshots. If any are red, report exactly what remains blocked. Do not merge PR #153 on partial evidence.

**PR V2-1: Pure dynamics contract.**
- Add pure ski state, terrain contact, tuning, deterministic integrator and unit/property traces; leave runtime selection behind OFF-by-default skiV2 flag.
- No visual/terrain changes.

**PR V2-2: Runtime and controls integration.**
- Wire ski-only input adapter and fixed accumulator in worldRenderer, preserve other modes and Big Air authority.
- Desktop keyboard tests and browser acceptance; A/B comparison old/new from identical spawn and input.

**PR V2-3: Halfpipe interaction and lip/contact polish.**
- Address entrance/exit continuity, wall-turning, pop, swept landing and camera occlusion.
- Restrict geometry edits to authored patch after protected-identity proof. Require desktop/mobile screenshot signoff.

**PR V2-4: Skier pose and restrained effects.**
- Ski-specific stance, independent ski contact, edge spray, tracks and low-clutter hints.
- Meet measured draw-call/frame budgets and reduced-motion behavior.

**PR V2-5: Input parity and backside line robustness.**
- Gamepad/mobile mapping, timber transitions, speed tests, full multi-activity regressions.
- Only add new timber features through a separately approved manifest/PR.

**Optional PR V2-6: Ghost and run replay.**
- Local-only replay/ghost after simulation stability, versioned data and compatibility tests.

Each PR must include: purpose, exact baseline SHA, changed-file allowlist, new/updated tests, command outputs with counts, browser video/screenshot evidence, before/after performance table, documented limitations, rollback instructions and a clear merge/no-merge decision. Do not stack experimental physics and unrelated terrain art into one PR.

## 17. Astra working protocol

1. Read this spec, PR #153, docs/world/clean-mountain-halfpipe.md and the exact source files listed in section 1; inspect current Git branch, head, working tree, CI results, and existing project conventions.
2. Produce a baseline evidence report before making any code changes. Never assume the snapshot is still current or overwrite active work.
3. Start a separate branch for each scoped release, rooted on the latest **verified** skiing/world base, and prefer a draft PR until browser acceptance is complete.
4. Implement one vertical slice at a time. Include a pure unit test before connecting complex renderer behavior.
5. When a test fails, preserve the failed trace, investigate cause, and fix code or expectation at the correct layer. Never bypass a failure by adding arbitrary teleports, stronger hidden boosts, extra exceptions to collision, or deleting tests.
6. Verify all protected systems and scope invariants on the exact same commit as the implementation. Use browser artifacts and manual visual assessment for lip/pose/camera quality.
7. Retain the old skiing path behind a reversible feature flag until the V2 system earns sign-off. Record precisely when and why the flag becomes default.
8. Do not claim deployed, production-ready, tested on hardware, or fully implemented until the corresponding verified evidence exists.

## 18. Final definition of done

Skiing is ready only when: (a) the rider feels continuous and controllable over the whole mountain, (b) repeatable two-sided pipe traversals, user-requested jumps and clean landings work without physics tricks, (c) the visible skis remain attached to the exact snow surface and lips, (d) ordinary skiing cannot activate scored Ski jump, (e) all protected island content and other activities are unchanged, (f) desktop/mobile/controller and reduced-motion acceptance passes, (g) current same-SHA CI and browser evidence are green, (h) performance remains within measured budgets, and (i) all PRs are independently reviewable and reversible.

### Handoff prompt for Astra

Implement this specification in the Sid's iLand repository as an isolated, staged upgrade, never as an expansion of the unqualified PR #153. First recheck the actual branch heads and failing browser QA. Report the exact baseline and the smallest blocking gate. Stabilize that gate; then start V2-1 (pure dynamics and deterministic tests), create a draft PR with evidence, and proceed through later stages only when their prerequisites pass. Preserve the island, halfpipe mask, hydrology, galleries, arcade cave, marine world, other sports and menu-authorized Big Air. Deliver verified code and browser artifacts, not just a plan or asserted test pass.
