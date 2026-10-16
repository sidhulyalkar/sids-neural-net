# North Shore: coherent breaking surf and momentum-based airs

Built on integrated island candidate `65c67d2`. Retains the Jet Ski, disc golf,
Shasta, mountain, skatepark and marine life systems, and incorporates the
reference woodland skatepark and sideways stance from `cf505af`.

## Critique and corrections

The supplied island screenshot shows broad pale overlapping ribbons rather
than a readable steep wave face. The old renderer drew three full-width
surfaces per crest; board pitch was independently clamped to 0.22 radians.
The upright display-board geometry also mixed pitch, spin and support axes.
The old foot-contact diagnostic used two scalar formulas that cancelled,
rather than measuring the rendered rider.

- One continuous transparent surface now samples physical wave elevation.
  Height, color and alpha distinguish the trough, face and crest. Five narrow
  curled lips and one instanced foam pool replace wide whitewater sheets.
  At most seven draw calls; static bottom samples; distant animation is culled.
- Shoreward crests disappear after washing out on sand rather than resetting
  while still visibly offshore. Shoaling raises a steep face with a long back.
- Five-point support raises the rigid planing footprint clear of steep water.
  Rider and board share one tilted support frame. The riding board has its own
  horizontal geometry, top-side tail art, correct yaw spin and sideways rider.
- Fast, seaward crossings of an actual moving crest automatically launch.
  Space at the face also gives a stronger pop; flat-water hops stay smaller.
- Wave propulsion comes from the shoreward pocket. W preserves approach speed
  and pumps the face, but no longer supplies constant offshore motor power.
- Flight uses absolute ballistic elevation relative to sampled support, so a
  moving wave underneath cannot lift a supposedly airborne rider. Q/E/F queue
  different tricks; late presses without a real rotation window are rejected.
  Points require a completed visible rotation and adequate touchdown speed.
- Existing R wrap, 90-second heats, clean-return bonus, recoveries, accessible
  controls and minigame exclusivity remain. Scores use a new storage version.

This is deliberately approachable, stylized skimboarding. It is not a fluid
simulation, a real-world safety model, or copied Wavedash game code. The linked
Wavedash page was available, but its playable embed stayed at 0% in the browser;
no claim of measured gameplay parity is made.

## Evidence and release boundary

Deterministic tests exercise natural lip launches, full 360 landings, clean
returns at 20/40/60 Hz, reversed/slow/idle launch rejection, ballistic flight,
late-key rejection, rigid support clearance, renderer/physics height agreement,
edge alpha, draw budget, culling and disposal. Browser QA additionally captures
an actual airborne canvas frame and measures transformed sole-to-deck error,
then switches beach → rainforest → skatepark → beach in one session.

Production deployment and final visual acceptance depend on the published
revision's browser evidence. Keep the change in a draft PR until those checks
and review are complete.
