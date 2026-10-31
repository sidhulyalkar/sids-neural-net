# Shasta motion v2: fidelity, reliability, and mobile qualification

**Status:** implementation and evaluation roadmap; not a claim of Shasta-exact motion.  
**Stack:** PR #131 security -> #130 mobile island HUD -> #132 articulated Shasta prototype.  
**Release:** retain draft / no deploy until the P0 gate and visual review pass.

## Goal and non-goals

**Goal:** Shasta should read as an individual husky, with grounded, anatomically
credible and smoothly interruptible behavior, even on 15 FPS mobile browsers
or uneven island terrain. A click producing the expected string in a
`data-*` field is not sufficient proof.

**Not the goal:** full muscle simulation, clinical-grade canine biomechanics,
a physics engine rewrite, remote model inference during play, or adopting
unlicensed third-party animation assets. Match Shasta's identifiable
silhouette and behavior using owned references before aiming for
photorealism.

## Current architecture: known limits

- `lib/world/shastaTricks.ts` owns command state and authored pose curves.
  `lib/world/shastaGait.ts` owns gait phases and a lightweight two-segment
  per-leg render approximation. `components/world/worldRenderer.ts` applies
  these to instanced geometry.
- Even with 8 visible limb segments, the hind **stifle plus hock** and the
  fore **elbow plus wrist** are not independently solved; the spine and
  shoulder girdle remain a single mass. These are styled animations, not an
  anatomically complete skeleton.
- Every planted paw should be represented in world coordinates. Current
  lower-body compensation reduces penetration on level terrain, but rolling,
  mixed terrain normals, steep slopes, abrupt interruption, and root motion
  still need specific evidence.
- Trick actions were previously coupled to a 50 ms-per-frame physics step.
  v2 adds a bounded, pause-aware action clock and suppresses residual
  running gait during stationary poses. Verify these in real browsers.
- The retired Park it action, its approach planner, UI control, and browser
  contract have been deleted. Browser QA now focuses on grounded spins and
  the remaining tricks. A stationary full-body pirouette or simultaneous
  four-paw hop is a failure.

## Quality ladder and required evidence

| Priority | Capability | Acceptance evidence | Release criterion |
| --- | --- | --- | --- |
| P0 | Correct state machine, sign-safe angles and finite poses | Unit tests at 10/15/30/60/120 Hz, left/right mirror, interrupt/restart/hold, pause/unpause and grounded sequential spins | No failing focused unit or TypeScript/ESLint checks |
| P0 | Regression-safe integration | Actual Shasta Hub, dual-stick, sports hub, world landscape, full website unit and build gates | Shasta changes do not introduce new red checks relative to the qualified base |
| P0 | Visible posture transitions | Time-labeled 6-frame contact sheets for sit, down, both paw shakes, both rolls, jump, both spin directions and snow zooms | No obvious rigid standing-cartwheel, floating paw, sudden root jump or ankle-through-ground pose |
| P1 | Stable 3D feet and COM | Measure each planted foot's world-space displacement vs support plane; capture contact state, center of mass and support polygon | Target: stationary paw slide <= 0.06 world units over any 0.25 sec stance interval on level ground |
| P1 | Consistent timing / orientation | Replayed scripted action trace at 15/30/60 FPS, both device orientations, interrupt during each trick | Target: active trick duration within 0.12 s of authored duration; no unplanned 180-degree orientation snap |
| P1 | Lightweight rendering | Shasta-only instanced mesh counts, draw calls, average CPU update cost and garbage collection samples | Target: <= 0.35 ms typical companion pose update on target desktop; no per-frame heap allocations in leg/head loop; avoid extra draw calls |
| P2 | Real articulated dog | Hierarchical rig with shoulder/scapula, fore elbow/carpus, hip/stifle/hock, cervical/thoracic/lumbar spine, tail chain and ears; contact-aware IK | Joint-range tests, believable side/front silhouette across all poses |
| P2 | Reference-fitting | Own Shasta videos, calibrated 2D keypoint tracks and multi-view reprojection | Annotated keyframe reference and per-action timing scores; visually approved by owner |
| P3 | Personality and terrain | Snow and sand bursts, circling, tail/ears/howl, chase/return, terrain-aware traction and feet | Separate transitions and energy states, no command starvation or long uninterruptible script |

Numerical budgets here are **proposed engineering targets**, not validated
dog biomechanical standards. Benchmark the baseline on actual devices before
enforcing hard pass/fail thresholds. Report medians, p95 and worst cases.

## Motion design: event vocabulary

Define a small motion graph instead of unrelated whole-body rotations:

- **sit**: brake -> shift COM to hind limbs -> pelvis descends -> hind
  stifles/hocks flex -> forelegs stabilize -> hold -> stand-up on interruption.
- **down**: brake -> forelimbs fold -> chest reaches support -> hindquarters
  settle -> hold -> forelimbs extend before moving.
- **shake (left/right)**: approach -> sit or stabilize -> shift COM to three
  supporting feet -> lift one paw toward the player's hand -> hold briefly ->
  paw returns to contact -> recover.
- **roll (left/right)**: settle from down -> head/yaw cues direction -> shift
  onto shoulder -> rotate thorax/spine over back -> replant legs -> stand or
  lie. An upright rigid 360-degree barrel roll is forbidden.
- **spin (left/right)**: brake into four-paw stance -> eight sequential
  45-degree turning footfalls -> recover on the ground. Only one paw swings
  per interval while the other three can remain supporting; body jump
  remains exactly zero. The pivot is currently procedural, not mocap-fitted.
- **jump**: compress hindquarters -> push-off -> flight with flexed joints ->
  fore/hind landing sequence -> absorb impact.
- **snow/sand zoom**: short excited runs and direction changes that do not
  trigger amid a held trick, water, cave, active sport, or menu interruption.
- **speak/howl** (future): sit or stand, chest/neck extension, muzzle opening,
  sustained head posture and original/licensed audio. No instant full-body
  snap to an unrelated animation.

Each motion owns *start, contact events, peak pose, recovery,* and
*interrupt path*. Transitions must explicitly blend from the actual current
pose, not assume an idle starting pose.

## Reference acquisition and scientific provenance

1. Record **user-owned footage of Shasta** for each trick, ideally side
   + front three-quarter views at 60 FPS with unobstructed feet and known
   ground plane. Also record natural gait, excited snow/sand runs, ears and
   howling. Do not require a lab or sensor-equipped board.
2. Annotate shoulders, elbows, wrists, hips, stifles, hocks, paws, pelvis,
   withers, nose and tail base in 8-12 salient frames per action. Mark true
   contacts, clipping, motion blur and occlusions explicitly.
3. Build normalized joint trajectories by dog shoulder height and action
   duration. Optimize pose and timing against **individual Shasta** before
   transferring general dog movement priors.
4. Relevant research leads: **InterPet4D** contains dog-human interaction
   motion with skeletal/SMAL data; **AI4Animation/MANN Dog** offers mocap;
   **DigiDogs** is synthetic dog pose data; **Kirin/AiM3D** offers reconstructed
   animal motion. Confirm licensing, coordinate conventions, rig topology,
   download size and annotation quality individually before ingestion.
5. **Licensing boundary:** InterPet4D and AI4Animation materials are
   CC BY-NC 4.0; do not copy their motion files or derived assets into a
   public commercial deployment without permission. Research evaluation
   may be separate from production assets. Use user-owned footage, properly
   licensed assets or independently created keyframes in production.

References:
- https://interactive-intelligence-lab.github.io/InterPet4D-Homepage/
- https://huggingface.co/datasets/ohicarip/interpet4d
- https://github.com/sebastianstarke/AI4Animation
- https://cvssp.org/data/DigiDogs/
- https://kirin-ani.github.io/

## Performance architecture

**Do not** add new individual `Mesh` elements for every joint. Instead:
retain one body geometry draw grouping, one instanced limb geometry, and a
continuous tail/face where possible. Use preallocated vectors, quaternions
and typed arrays. Compute the gait pose once per tick, solve contact targets
in the dog's local coordinate frame, then write joint transforms to the
existing instance buffers. Keep HUD state out of the animation loop.

Longer-term: transition the visual character to a single skinned mesh with
a skeletal hierarchy if the silhouette demands it. Compare skinned mesh vs
instancing by GPU calls, animation CPU cost, shading/texture quality and
mobile memory before deciding.

Recommended diagnostic channels: root world position/yaw, trick stage,
target and obstacle clearance, four grounded states, foot world positions,
paw slide distance, limb bend angles, hip/chest height, head and tail motion,
visible triangle/draw-call counts, p50/p95 animation CPU time, and FPS.
Capture these in **opt-in local QA traces only**, not persistent analytics.

## Execution sequence

1. **P0.0 Baseline diagnosis:** read exact failing CI logs and annotate
   pre-existing vs introduced regressions; preserve artifacts.
2. **P0.1 Fix deterministic failures:** neutral signed-zero, stable timebase,
   residual gait during tricks, grounded spin footfalls; run focused
   tests and integration contracts.
3. **P0.2 Visual evidence:** browser script captures actual pose intervals
   and full-frame screenshots in portrait/landscape, including before/after
   interruption. A screenshot of a welcome/background scene is a failure.
4. **P1.0 Contact engine:** implement stance anchors, local terrain normal,
   leg IK/contact, correct center-of-mass/shoulder roll, and test contact
   violations across known obstacle/slope locations.
5. **P1.1 Performance harness:** profile 10-second active, idle, jump, snow
   and repeated-command scenarios on hardware + software WebGL; confirm
   world FPS/bundle budgets unchanged.
6. **P2.0 Rig and reference fitting:** calibrated skeleton hierarchy,
   per-action motion curves learned/fitted offline, authored fallback,
   artifact provenance and licensing review.
7. **P3.0 Release:** only after explicit visual sign-off plus all required
   integration checks are green or failures are confirmed as independent
   baseline issues with tracked owners.

## Stop conditions

Do not merge on a green TypeScript build alone. Do not raise a failing
performance threshold merely to make CI pass. Do not claim "exactly like
Shasta" without comparison to Shasta-specific captured motion. Do not ship
external motion files with unverified redistribution or commercial rights.

## 2026-10-30: spin behavior scope and retired command

- **Removed:** Park it is not part of the Shasta command type, action
  duration table, menu, browser sequence or motion-state logic.
- **Grounded spin:** eight alternating individual paw lifts over 2.7 s,
  body rotation synchronized with footfall phases, no `jump` channel and
  no forced upward body position. The normal support anchor may reset when
  a stance foot reaches its safe IK tether; such resets are observable.
- **Minimum qualification:** at 10/15/30/60/120 Hz, spin angle advances
  monotonically to 360 degrees; exactly one paw at a time is lifted, all
  four are eventually repositioned, the root stays at ground height and
  interruption by Sit/Recall cancels spin. Visual browser QA must inspect
  peak yaw, per-paw lift and root jump diagnostics.
