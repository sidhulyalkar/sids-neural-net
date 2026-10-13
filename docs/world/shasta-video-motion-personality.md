# Shasta motion and personality: source-informed World implementation

Status: **draft** PR #94. Reference sources: user-supplied `IMG_0120.MOV`
(20.52s) and `IMG_0245.MOV` (60.74s), examined on Oct 13, 2026.
Personal reference videos are not imported or published to the site.

## What the footage actually supports

- **IMG_0120.MOV, park grass:** close views of Shasta reclining on his
  side, lifting/turning his head, sitting up comfortably, with upright ears
  and relaxed open-mouth panting. The body isn't a spring: posture transitions
  are localized and controlled.
- **IMG_0245.MOV, fallen tree in a forest:** he follows the length of a log,
  explores around/along it, sets down each paw deliberately, and uses small
  head/shoulder adjustments to steady himself. His torso travels relatively
  smoothly rather than jumping up and down each stride. The tail reads as
  a long relaxed plume with expressive carriage, not a rigid upright flag.
- Neither clip provides calibrated, side-on high-speed treadmill footage,
  ground reaction forces, gait phase markers or measured skeletal dimensions.
  No exact joint angles, masses, stride cadence or force plate data are
  claimed. The numbers below are art-directed game parameters informed by
  the observed style rather than measured subject-specific biomechanics.
- The clips do **not** show skiing or rolling in snow. Alpine celebration
  is an intentional, playful extension of the relaxed grass behavior.

## Root cause and resulting architecture

The original model attached a sine-wave joint animation to smoothed speed and
also animated the whole dog's height. Repeated automatic disc fetch made
Shasta appear to hop. The replacement separates independent concerns:

1. **Navigation** remains obstacle-aware via `shastaDetour`,
   `steerShastaVelocity` and `constrainMove`. Distances travelled, not
   requested velocity, drive animation phase.
2. **Gait** in `lib/world/shastaGait.ts` uses grounded stance/swing feet,
   diagonal trot timing and a higher-speed canter, with small torso
   oscillation capped below approximately 2cm in world units.
3. **Foot placement (updated Oct 13)** uses one continuous straight
   stylized limb per hip/paw pair. Four separate terrain filters move four
   compact paws gently up/down; there is no knee or hock inverse kinematics.
   Swing lifts individual paws, not the dog root.
4. **Personality** in `lib/world/shastaPersonality.ts` is a deterministic,
   cancellable Ski event: perk -> snow run -> side/back roll -> shake ->
   rejoin. This only starts when selected Ski mode reaches alpine terrain.
   It stops if another activity takes over, and will not trigger during
   Shasta's disc-golf fetch. It is a one-shot event, not an infinite loop.
5. **Expression** repositions head/muzzle/eyes/ears together using existing
   instanced art, opens mouth/tongue while panting, and changes the continuous
   tail plume's wag amplitude with excitement.
6. **Snow powder** is one pooled 12-instance low-poly geometry with a
   bounded per-frame transform update; no unbounded particle allocations.

## Auditable invariants

- The center of mass never performs a large arbitrary bounce during a
  normal walk, trot, or disc-fetch sprint.
- Four straight leg columns remain visually connected to their own compact
  paws. Sample terrain at each foot without moving the whole dog.
- Deterministic phase increment depends on actual dog displacement.
- Repeated selecting of other activities clears the queued or active
  celebration; it never steals focus during disc golf, jet skiing, cave,
  or water cinematics.
- Shasta's original male cream/tan coat, amber eyes, relaxed tail shape,
  and harness-free appearance remain unchanged.
- The World regression suite includes bounded straight-leg reach,
  anti-hop bounds and personality state machine tests.
- Chromium snow play acceptance captures run, roll and shake frames,
  measures body bob, and confirms cancel-on-mode-switch. Browser validation
  and visual/manual device review are required before promoting the draft.

## Next scientific calibration opportunity

To build a genuinely individualized musculoskeletal motion model, record
a few seconds of **side-on**, **front** and **rear** views of normal walking,
trot and running on level ground at a known camera frame rate, ideally with
camera calibration, markers or 3D pose estimates. Then fit individualized
joint trajectories, stance durations, step lengths and foot contact rather
than assuming nominal limb geometry from uncalibrated personal clips.

## Follow-camera and paw stability follow-up (Oct 13)

The first implemented version looked better in low-speed checks but the
walk/trot/canter changes still occurred at abrupt velocity thresholds.
Those changed the phase offsets and step lengths on a single update,
producing a visible knee/paw pop, particularly near uneven terrain.

- Continuous smoothstep blending now drives foot offsets, stride length,
  swing height, and duty factor through speed transitions. Named gait
  labels still exist for diagnostics, but cannot jump the underlying pose.
- Four bounded, smoothed ankle-ground offsets reduce knee jitter caused by
  small terrain-height changes under each paw. The base ground height and
  torso slope also have slower response, without changing navigation,
  fetching, or the committed disc lie.
- The former Shasta eye camera sampled moving terrain at Shasta's nose and
  changed direction with the goal vector, which can whip near a landed disc.
  `lib/world/shastaCamera.ts` now owns a low-pass filtered world-space anchor
  and separately damped heading/height. The fetch uses a more readable
  7.6-unit over-the-shoulder follow view, and the chase intro a wider
  11.7-unit trailing composition; the dog remains visible in both.
- The smoothing camera is **only** used for Shasta's `chase` / `shasta`
  disc-fetch stages. Flying disc shots, ordinary disc-golf aiming, jet skiing
  and mountain cinematics retain their existing framing.
- `tests/world-shasta-camera.test.ts` asserts third-person distance,
  terrain-height filtering, heading stability, teleport resets, and
  continuous gait poses either side of the previous transition thresholds.
  The Chromium disc-golf playtest also checks that the actual camera
  records a third-person trailing boom while Shasta runs.
- The World remains a stylized art-direction model; manual playback review
  is needed to tune remaining gait damping and camera composition.

## Authoritative Shasta leg silhouette: straight rig (Oct 13, later pass)

The subsequent anatomical knee/hock implementation looked too mechanical
in the user's gameplay screenshots. At the user's direction, it has been
**replaced**, not refined. The current spec is deliberately stylized:

- **Four straight cylinder legs**, each connecting a fixed chest/hip anchor
  to a lightly animated paw target in one uninterrupted mesh.
- **Four slim oval paws**, one per leg, no individual toe blobs, knee spheres,
  hock spheres, or additional bent segments. Both the paw lateral radius
  and leg lateral radius equal **0.086 world units**.
- **Gentle ground conformance:** clamp local paw terrain variation to ±0.075
  units, ease offsets per foot, and allow a tiny pitch change up to 0.045
  radians when the foot is planted. Torso/neck do not copy ankle noise.
- Keep continuous distance-driven walk/trot/canter phase, eye/head/tail
  personality, the sealed white tail tip, fetch camera, and snow-play state
  machine. This is not a skeletal dog biomechanics model.
- Regression contracts now check four-leg count and equal narrow paw/leg
  widths in actual Chromium snow and disc-fetch gameplay. Older articulated
  knee/hock acceptance contracts are intentionally deleted.

Review the left/right silhouettes at rest, walking, fetching a disc, and
snow zoomies before promoting the draft branch.
