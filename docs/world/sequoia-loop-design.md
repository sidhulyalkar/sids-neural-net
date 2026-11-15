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


## V2 art-direction revision (reference vs latest playtest)

The v1 screenshot revealed three precise visual shortcomings: a too-smooth
earthy bowl, a narrow manufactured-looking log pipe, and an undersized loop.
This revision addresses those root causes, not just their material colors.

| Asset | V1 | V2 | Physical relationship |
| --- | --- | --- | --- |
| Stump | radius 5.4, peak banking ~2.05 | rim 5.65, 2.62-unit organic bank, raised contrast and bark apron with longitudinal furrows/roots | `redwoodBowlBankRise` owns contact; flutes hug only the outside |
| Fallen tree | 8.8 units long, ~2-unit circular inner radius | 10.7 long, 2.85-unit tall inner elliptical roof, 2.61 lateral half-bore, tapered external 3.32-unit radius | Existing `groveLogRise` is widened, flat in the center; no end disks/inside decor |
| Timber loop | 2.15 radius, 2.35 wide | **3.75 radius and 3.45 wide**, more substantial heavy-timber support | Shared `SKATE_LOOP.radius` drives visible mesh AND inverted 3D wheel state |
| Surroundings | few fern fringes / bare brown soil | fallen bark and needle duff at park edges, six extra old-growth framing trees outside the active meadow | World tree renderer creates real trunk obstacle and canopy occlusion for each tree |

The loop remains an assisted arcade stunt (not an unsupported claim of real
skateboard physics). Its minimum contact speed is raised to 5.1 world units/s
while inverted so it is reliably completed on the 7.5-unit diameter structure
even at low frame rates. Entry still requires deliberate alignment and the
8.4-unit/s approach gate, and uses the exact same line-scoring system.

The open tunnel has a central clear floor at least 2.72 units wide, a much
wider arch above it, and no under-roof plants/structural braces. Its decorative
root buttresses are outside both open mouths, rather than across the runway.

The bowl's bark is layered on the *exterior* and painted onto the real sampled
bank; it is deliberately not a coincident invisible collider. Outer appendages
never change the existing skateboard collision authority.

### Visual signoff

The visual target is a large bark-sheathed stump as centerpiece, a massive
authentic fallen log, and a dominating sculptural timber loop in a denser
redwood forest. A production-ready pass must still inspect screenshots in a
real browser, including looking down both log entrances, examining the outer
stump rim, seeing the entire new loop, capturing the rider inverted mid-loop,
and verifying actual clean free-roam control after the stunt. Passing geometry
tests is not a substitute for those observations.
