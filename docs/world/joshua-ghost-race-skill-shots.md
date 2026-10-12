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
The target must be selected by a real world-space ray intersection,
within 32 horizontal world units, with clear line of sight and at least
2.25 world units/s of movement. A hit displays a short shot tracer,
awards 2.4 seconds of increased acceleration and 1.6× speed cap, and
cools that specific target down for nine seconds. Speed coasts back down
after the boost without an instantaneous clamp. Other gear and game modes
cannot use the system. No input can trigger a disc golf shot or a jet-ski
boost accidentally.

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
