# Joshua Ghost Race and Land-Sport Skill Shots

Status: draft in PR #94 on `feat/island-jetski-dock-race-v1`.
This is an arcade enhancement, not a measured dirt-bike handling model.

## Intended player experience

**Joshua ghost race.** Select Bike and choose **Joshua circuit · race
ghosts** at the activity dock. The existing safe staging area places the
rider 1.5 units before the start gate, where the lap arms. The course uses
the same twelve ordered one-way checkpoints plus the return finish plane.
The stopwatch and personal best remain authoritative. Two translucent
pace ghosts, **Lucas** and **Ness**, travel independently along the safe
bypass-inclusive course. They have separate speed profiles, do not collide,
do not rubber-band, and are not recordings of another person's gameplay.
The HUD displays the current placing (1/3, 2/3 or 3/3). At the finish,
placing is decided by actual player finish time vs each reference time,
not an automatically assumed first place. Records use
`course-305-v2-ghost-boost` so speed-boosted times do not pollute the
pre-boost time-trial personal-best key.

**Skill shots.** Three gear modes (Bike, Ski, Skate) expose floating target
rings in relevant terrain. While rolling, aim the chase camera by dragging,
then click/tap a ring; keyboard players can aim the small center reticle
and press **F**. Passing near the ring without firing awards nothing.
A click must intersect the actual visible core or lie within a narrow,
speed-scaled tolerance around the screen projection of a charged 3D target.
Both paths require a real visible target, within 32 horizontal world units,
with clear terrain line of sight and at least 2.25 world units/s of movement.
The near-click tolerance is capped at 0.17 normalized screen coordinates
and does not choose a target from blank space or waive any cooldown. A hit displays a short shot tracer,
awards 2.4 seconds of increased acceleration and 1.6× speed cap, and
cools that specific target down for nine seconds. Speed coasts back down
after the boost without an instantaneous clamp. Other gear and game modes
cannot use the system. No input can trigger a disc golf shot or a jet-ski
boost accidentally.

## Real-browser moving aim correction (October 14, 2026)

The combined island browser job repeatedly failed at the Joshua shot despite
the visible-aim projection being available. We captured actual browser traces
from a deliberately isolated Joshua Chromium job, rather than weakening the
assertion. On the failing 13u/s run, the projected `joshua-0` center moved
from NDC y=0.619 to y=0.521 between choosing a visible aim position and
performing the click (0.098 NDC), and later attempts saw even larger drift
as the rider left the target behind. The old target forgiveness radius was
only 0.065 NDC, too small for an arcade moving-bike shot.

`nearAimTarget` now uses a small speed-responsive click radius
`min(0.17, 0.085 + speed*0.006)`. The raycast path is unchanged, and
the projection-assisted path still requires the same in-range, charged,
visible, unoccluded 3D object as the direct raycast. The geometry unit test
qualifies a 0.115 NDC offset at 13u/s while rejecting 0.23 NDC misses,
standing shots, cooldown bypass and terrain-occluded rings.

The isolated [Joshua Ride Skill Shot Browser QA](../../.github/workflows/ride-ghost-browser.yml)
saves shot-by-shot aim positions, speed, and a screenshot on success and
failure. [Run 38658988827](https://github.com/sidhulyalkar/sids-neural-net/actions/runs/38658988827)
reproduced the failure. After the repair,
[run 38659339121](https://github.com/sidhulyalkar/sids-neural-net/actions/runs/38659339121)
passed the real clicked `joshua-0` target on its **first attempt**, with
`aimAssist=true`, no page errors, and no proximity-only scoring.
The separately checked World regression
[run 38659387849](https://github.com/sidhulyalkar/sids-neural-net/actions/runs/38659387849)
passed on the unit-test follow-up commit. Revalidate other merged code and
the slower combined jet-ski workflow before treating PR #94 as releasable.

## Separation of concerns

- `lib/world/joshuaGhostRace.ts`: deterministic ground-safe ghost sampling,
  lap fractions, and finish-time comparison. No network or personal data.
- `lib/world/rideBoost.ts`: immutable target definitions, movement/range/
  cooldown checks and short-lived buff bookkeeping.
- `lib/world/activities.ts`: standard locomotion is still the authority
  for all terrain collisions, gear movement and airborne launch speeds.
- `components/world/worldRideChallengeGeometry.ts`: owned, reusable Three
  geometry for targets, a tracer and translucent reference cyclists.
- `components/world/worldRenderer.ts`: pointer and keyboard raycast,
  contextual HUD, local mode state and lifecycle cleanup.
- Existing `trials.ts` is authoritative for correct crossing order, elapsed
  time, shortcut invalidation and PB updates. Ghosts cannot affect scoring.

## Before merging

1. Confirm World tests, TypeScript, strict lint, and production gates at the
   final commit.
2. Ride through a full Joshua lap, confirm both ghosts follow the safe
   bypass sections and appear to have distinct stable pace; verify finish
   placing for faster/slower runs and that restart/exit works.
3. On desktop and touch, prove that a target is awarded only by aiming and
   clicking, terrain occlusion blocks it, holding a movement key continues
   steering, misses don't move the player to the ground, and each target
   recharges after the announced delay.
4. Test Ski boost leading into an existing freeform mountain ski jump,
   including direction-aware birds and camera. Test Skate boost near the
   grove ramp and Bike boost without leaving the marked race corridor.
5. Retest one-minigame-at-a-time blocking, disc golf controls, jet-ski
   control/boost bindings, pause, fast travel, keyboard focus and low-FPS
   performance. Verify geometry disposal after repeated scene entry/exit.
6. Capture real phone visual acceptance: target hitbox, HUD/reticle contrast,
   transparent ghost silhouettes and tap-vs-drag ambiguity.

No physical bike measurements, network ghosts, multiplayer synchronization
or verified speed records are implied.
