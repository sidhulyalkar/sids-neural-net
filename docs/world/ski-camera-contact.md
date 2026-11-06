# Ski presentation candidate

Based on PR #153 at `727baf3e7db122a7552e711ac680200180b7d36e`.
PR #154 remains the broader dynamics specification. PR #155 is a separate
browser-throughput diagnostic change; its latest halfpipe browser job passes,
but production, jet-ski and skate-grove gates still fail. Those failures are
not claimed fixed here.

## Changes

- Separate rigid-ski contact frames sample each binding, local normal and sole
  footprint. The skier root no longer uses the maximum terrain sample followed
  by a second rotation-induced lift. Two leg segments connect hips to boots.
- Airborne poses retain the connected ski/boot rig and disengage ground fitting.
- Ordinary skiing uses a seven-unit chase camera with restrained lookahead,
  manual drag override and gradual recentering. The camera checks actual foot
  clearance and projects the torso to verify on-screen framing. Terrain collision checks the
  entire sightline and shortens obstructed booms at the outer lips.
- Explicit Ski Jump retains its existing state machine and camera. Ski contact
  is restricted to land, outside galleries and caves. Other sports keep their
  camera branches. Returning from skiing resets leg transforms.
- Nonnegative bounded frame intervals prevent backward camera extrapolation
  when a queued RAF timestamp predates initialization/resume completion.
- `?ski-view=legacy` disables the new contact/follow presentation for comparison.
  No terrain, waterway, gallery, marine, Shasta or sport-physics module changes.

## Verification

Local suite: 1,053 tests pass; TypeScript and changed TypeScript ESLint pass.
The browser script is syntax-checked (repository ESLint excludes scripts).
Tests cover both soles on inclined planes, both walls/lips, entry/runout,
angle wrapping at 20/30/60/120 Hz, camera occlusion, outer-lip boom shortening,
and negative/stalled frame intervals. Raycasts against a reconstruction of the
actual 142-by-132 terrain mesh plus snow refinement verify sampled surface
agreement within 0.08 world units.

`scripts/playtest-ski-presentation.mjs` records a
continuous JSON trace, Playwright trace and screenshots for entry, downhill,
both walls, deliberate hop/landing and portrait/landscape layouts. It asserts
ordinary skiing never arms Big Air, contact disengages during the hop, and
contact returns afterward. The workflow uploads evidence under its exact SHA.

Local software Chromium evidence is diagnostic, not a hardware performance
qualification. At 1000x740, the earlier browser passes measured approximately
130–530 ms frame intervals. A warmed Node benchmark of 2,000 two-ski fits
measured 0.187 ms per pair, excluding rendering and diagnostics. Do not interpret those as playable frame rates.
Portrait/landscape resizing does not constitute touch-device qualification.

## Remaining acceptance gates

- Review final screenshots and continuous trace, including fast reversal and
  the outer shoulder where a rigid ski can bridge highly curved terrain.
- Validate camera framing, manual touch input and transitions on real desktop
  and mobile GPUs, including switches to other sports and gallery/cave entry.
- Compare full runtime cost against the parent at matched quality/camera views.
- Clear the inherited whole-site CI failures before any release.
- Add restrained tracks/spray and more dynamic carving/landing animation only
  after contact and camera acceptance. No such effects are added in this slice.

This is a draft visual iteration, not completion of the full Ski Dynamics V2
specification or a production release qualification.
