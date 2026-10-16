# Redwood Skate Grove: ride-through giant sequoia and 360° timber loop

## Motivation

Extend the existing natural skatepark with two unmistakable landmarks: a giant
fallen sequoia with a hollow, rideable bore, and a wooden full loop-the-loop.
The uploaded reference shows a warm heartwood passage and a freestanding
wooden loop set among redwoods. The aim is familiar, intuitive arcade
skateboarding rather than a high-precision simulator or a new minigame.

**Status:** implementation candidate on `feat/sequoia-tunnel-skate-loop`, based on
the live integration chain's draft `fix/world-throw-camera-steering` branch.
Do not merge to the website or production before browser acceptance.

## Layout and meaningful clearances

| Feature | Location (world x,z) | Footprint / height | Why here |
| --- | --- | --- | --- |
| Hollow fallen sequoia | `(-11,30.7)` | Existing log is 8.8 units long; inner bore radius 2.05, bark radius 2.37; crown above riding floor by roughly 3.17 units | Builds around the existing north split-log riding channel, preserving the existing sampled terrain and entry/exit. Both ends remain open |
| Timber 360 loop | `(-2.3,44.2)` | 2.15-unit wheel radius (4.3 unit rise), 2.35-unit-wide polished planks, outer bark backing and narrow coping | Open central meadow pocket between the north/south quarterpipes, east of the bowl and away from existing three grind rails |

Both landmarks are wholly inside the `x=-20..8,z=28..52` skate meadow.
The existing redwood bowl centered `(-12,40)`, the north/south timber
quarterpipes, stump pads, the original grind IDs, and the south meadow coastline
retain their old geometry, reserved approach routes and heightfield physics.

## Rider flow

1. Start in Skate at the existing east approach `(3,40.8)`.
2. Explore the redwood bowl and forest. The old north split log is now the
   polished floor inside the fallen sequoia, passable from either open mouth.
3. To try the loop, line up along the loop's narrow east-west lane and
   approach from the east, traveling west at 8.4 world units/s or faster.
4. The loop starts only on a swept **east-to-west crossing of the actual bottom
   seam**, inside ±0.82 units of the centerline, with heading x component
   more negative than -0.8. A rider next to the structure, stationary, outside
   the lane, or going the wrong way is not teleported onto it.
5. The rider completes an actual 360° circular ride with wheels at
   `x=cx-R sin(theta)`, `y=base+R(1-cos(theta))`. The body/pitch follows the
   track from standing, through inverted, and back to standing. A limited
   arcade gravity/contact assist prevents stalling on the ceiling.
6. The last point coincides with the first, with westward travel restored.
   A completed revolution awards "Sequoia Loop 360°" on the existing trick
   score/result HUD, not a new game session. Speed carries into free roam.

## Geometry and collision ownership

The tunnel shell is **truly open-ended** (inner and outer arch skins are built
without end caps). The existing `skateParkSurface` and `groundHeight` stay
the *only* wheel-height authority inside it. Nothing collidable crosses the
mouth or top of the riding channel. Bark flutes, annual rings and cut grain are
static geometry, not invisible obstacles.

A normal island terrain heightfield assigns one height per x/z position. It
cannot correctly represent a rider at both the bottom and inverted top of a
loop at overlapping x/z coordinates. Therefore, the loop alone uses a small
stateful parametric wheel-contact path, with speed integration in ≤25 ms slices
and a maximum 500 ms catchup interval. This is not a global physics change.
The cedar surface, dark underside and safety-edge seams are sampled from
the **same circle** as the rider, avoiding a visual/physical discontinuity.

Neither landmark is an independent game activity or menu. Both inherit the
current skateboard controls, one-button tricks, existing game exclusivity,
fast-travel cleanup, escape/exit behavior and equipment changes.

## Camera, visual treatment, performance

- The sequoia camera stays *outside the approaching open mouth* while the
  rider is under its roof, looking into the hollow so the player does not
  disappear behind opaque bark.
- During inversion, a stable outside three-quarter camera frames the entire
  loop, avoiding a boom that clips through timber. Camera returns to normal
  interpolation afterward.
- Pale wood = usable board contact; dark fluted bark = exterior; narrow metal
  coping and crossgrain strips outline the circle. Timber buttresses sit on
  the **outer lane edges**, not in the center.
- All sculpture meshes and instanced detail are constructed at world creation
  and disposed at route teardown. No extra textures, network assets, shaders,
  frame-by-frame mesh generation or external 3D model dependencies.

## Quality gates (not all claimed passed)

- Unit: geometric clearance, continuous tunnel floor, wrong-way/idle/low-speed
  loop rejection, full inverted pose, 10/20/40/60 Hz completion, ordinary skate
  scoring, preservation of existing rail IDs and the bowl.
- Existing World unit suite, typecheck, strict lint, Next production build and
  bundle budget remain mandatory.
- Browser: inspect open tunnel mouths and visibility from each direction,
  real slow and fast riding into the loop, full inverted and landed screenshots,
  no avatar detachment, no pop/grind during inversion, 20 FPS throttled GPU
  simulation, mobile/camera framing, and ability to skate away after exit.
- Cross-world: skate -> ski/jet/skim/disc/mountain transitions, Shasta, foliage
  occlusion, and zero regressions in existing Redwood/Island/World scripts.
- No automatic production merge or deployment on this candidate.
