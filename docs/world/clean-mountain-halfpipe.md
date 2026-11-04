# Granite Ridge: one clean ski-face halfpipe

## Rollback boundary

This branch **forks from World PR #142**, not from the abandoned alpine
PR #152. The rejected package remains isolated and must never be merged.
No code, 3D assets, routes or functionality from the glacier cave, complex
terrain park, rail chains, freestyle HUD or mountain-wide obstacle scatter
is present. This is a narrowly scoped replacement.

## Position and sightline

The edited face is the south-facing (+Z downhill) snow apron centered at
x≈13.5, z=-57.5…-36. It corresponds to the skier's mountain-facing foreground
shown in the feedback screenshot. Two subtle groomed walls, a clean snow
bottom and one transition runout are the only new visual elements.

- **Pipe:** 21.5 world units long, 2.5-unit flat bottom, 7.1-unit lip-to-lip
  width, 3.1-unit bank rise. A 3.3-unit longitudinal fade and 1.25-unit
  lateral feather keep it attached to the original mountain instead of
  creating rectangular cutouts or vertical seams.
- **Summit:** a compact +3.25-unit upper snow dome centered (8,-67), within
  x±3.8, z±4.5. Its footprint lies completely west of the arcade chamber
  roof (x≈12.2…19.8, z≈-81…-63). The lift reaches zero before the
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


## Strict implementation phases

**Phase 0, scope freeze (complete):** branch from the latest reviewed World
PR #142, without cherry-picking anything from the abandoned PR #152.
Freeze the baseline versions of `lib/world/hydrology.ts`, the cavern and
gallery code, and marine habitat systems. Check any proposed change against
the following allowlist: `mountainHalfpipe.ts`, `worldMountainHalfpipe.ts`,
small integration points in `model.ts`, `activities.ts`, `bigAir.ts`,
`worldRenderer.ts` and the matching tests/workflow. Do **not** modify
hydrology formulas, water meshes, cavern architecture, reef placement or
base world constants to make this feature fit.

**Phase 1, mathematical terrain approval:** sample original and proposed
heightfields over a dense world grid. The delta must be exactly zero outside
two compact envelopes: the halfpipe on x=13.5±4.8, z=-57.5…-36,
and summit on x=8±3.8, z=-67±4.5. Verify the *entire* arcade roof, waterfall
ribbon, snowmelt catchment, underwater shelf, woodland trails, photo markers
and existing authored ride obstacles at unchanged elevations.

**Phase 2, ride/contact qualification:** sample the same public
`terrainHeight` for the skis and snow mesh, with soft entrance and exit
blends. Check bank cross-section continuity, gradient and 5/20/30/60 FPS
step behavior; allow a **manual** low pop inside the pipe only. Free ski
never starts the Big Air flight machine. Its explicit Ski Jump shortcut
remains armed independently at the old marked lip.

**Phase 3, visual composition:** review from the exact pictured third-person
ski view, plus summit, side, downhill and mobile perspectives. One carved
snow trough, subtle snow lip, no glacier, no rail corridor, no stacked timber
kickers. Preserve existing forests away from the reserved ski corridor.
Compare before/after screenshots at identical camera poses to catch unwanted
landscape changes. Reject a halfpipe that reads as a rectangular snow sticker
or artificial elevated platform.

**Phase 4, release gates:** same-commit TypeScript, lint, production build,
world geometry regression, full waterfall/gallery/browser checks, and
explicit/free ski playback checks. Audit the screenshot artifacts, camera
headroom and measured draw calls. Fix any issue at source; do not bypass a
test or weaken protected-geometry invariants. Keep the PR draft until the
full evidence matrix is green.

### Explicit non-goals

No glacier cave or tunnels; no new rails, boxes, stunt kickers, freestyle
orbs, score systems, trick HUD, transit shortcuts, random tree scatter,
global mountain scale multiplier, changes to water hydrology, or new camera
mode. A larger ski area may only be pursued separately after the single
halfpipe passes visual and gameplay review.

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


## November 4 qualification repair

The `5eef9e0` candidate passed landscape regression, but its full Website CI,
halfpipe, Redwood and Jet-Ski workflows failed. It is not a release-qualified
commit. The Jet-Ski workflow stopped at disc-golf second-shot camera clearance,
before running its jet-ski and mountain checks; those features cannot be
claimed as verified by that run.

This follow-up corrects downward-facing snow/lip triangle winding and asserts
positive vertical normals across both meshes. It also isolates Playwright from
the locked application dependencies, waits for page loading before world entry,
removes screenshot latency before the halfpipe hop, and requires a grounded
landing without Big Air. The ridge-log browser approach now derives its heading
from the actual skier arrival, and the Redwood exit checks the current underwater
Moss Canyon destination instead of the retired land destination.

Local validation: all 1,044 unit tests, TypeScript and lint pass. Browser script
syntax and patch whitespace checks pass. Managed preview cannot launch this
Next.js checkout because it supplies unsupported `--host` / `--strictPort`
arguments. Desktop/mobile visual review, revised browser gates and the separate
disc-golf camera failure remain unresolved. Do not merge or promote this
candidate on unit evidence alone.
