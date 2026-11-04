# Granite Ridge: one clean ski-face halfpipe

## Rollback boundary

This branch **forks from World PR #142**, not from the abandoned alpine
PR #152. The rejected package remains isolated and must never be merged.
No code, 3D assets, routes or functionality from the glacier cave, complex
terrain park, rail chains, freestyle HUD or mountain-wide obstacle scatter
is present. This is a narrowly scoped replacement.

## Position and sightline

The edited face is the south-facing (+Z downhill) snow apron centered at
x≈7, z=-60…-35. It corresponds to the skier's mountain-facing foreground
shown in the feedback screenshot. Two subtle groomed walls, a clean snow
bottom and one transition runout are the only new visual elements.

- **Pipe:** 25 world units long, 3.5-unit flat bottom, 10.5-unit lip-to-lip
  width, 3.65-unit bank rise. A 3.65-unit longitudinal fade and 2.25-unit
  lateral feather keep it attached to the original mountain instead of
  creating rectangular cutouts or vertical seams.
- **Summit:** a compact +4.25-unit upper snow dome centered (8,-66), within
  x±6.25, z±8.2. The increased vertical room reaches zero before the
  meltwater source, mountain-lake photo, west waterfall roof, and arcade
  cave. No ridge is widened into the lake/shore or ocean.
- **Aesthetics:** pale sculpted snow and restrained compressed-snow coping.
  No separate floating timber jump decks, billboard, ice tunnel, park
  boxes, signage, posts, curved rails or surrounding prop scatter.

The original **full** pre-halfpipe terrain function is retained as
`terrainHeightBeforeHalfpipe`. The public `terrainHeight` only applies
`mountainFaceEditDelta` and is exactly identical outside these two compact
footprints. High-resolution snow geometry samples this **same** heightfield.

## Protected systems

The following are a hard non-regression boundary:

- Snowmelt path, melt basin (-13,-66) and its ribbons.
- Fern Falls crown, waterfall, plunge pool, museum, drainage, creek outlet.
- Underwater Moss Canyon and kelp/marine ecology.
- Mountain-lake photo discovery and existing gallery rooms.
- Arcade cave doorway/shaft and waterfall paper museum roof.
- Joshua dirt-bike course, ramps, free-roam routes and skill shot.
- Redwood hollow log, sequoia loop, Shasta, shore sports and other modes.

Legacy face kicker entries remain in the manifest solely for historical
compatibility, but their three selected visual timber surfaces and
corresponding hidden physical ramp supports are disabled on this ski face.
Other bike/skate ramp behavior away from the face is preserved.

## Skiing contract

Selecting ordinary **Skiing** means free exploration, speed control and
ordinary terrain physics. Neither descending a steep mountain shoulder nor
crossing a former kicker enters the special Big Air flight/HUD. Pressing
Space inside the halfpipe can perform a restrained *manual* ski pop using
ordinary airborne physics, without opening a scoring/flight challenge.

The distinct **Ski jump** menu button retains the original authorized
Big Air path: it transports to the original marked in-run and arms the
marked lip. Only crossing that lip while explicitly armed may start the
camera/score game. Leaving Big Air resets back to ordinary skiing.

## Gates before a merge

- [ ] World Landscape Regression with all pre-existing tests.
- [ ] Strict protected-waterway identity across full snowmelt, waterfall,
      plunge pool and downstream samples.
- [ ] Waterfall cave / arcade / memory landmarks stay at baseline heights.
- [ ] Halfpipe banks are smooth, skier can traverse/run out and cannot
      collide with missing timber jump decks.
- [ ] Ski without jump selection: continuous descent, no Big Air HUD,
      no surprise ramp launch.
- [ ] Explicit Ski jump: marked in-run launch is still available.
- [ ] Desktop + mobile screenshots: one attractive snow feature, no
      glacier cave, no clutter, no world-wide camera obstruction.
- [ ] Production lint/typecheck/build and visual frame/draw-call review.

Do **not** promote this branch to the stable world base until same-head
CI and screenshots are reviewed. Never relax hydrology or cave checks
to make the halfpipe pass.
