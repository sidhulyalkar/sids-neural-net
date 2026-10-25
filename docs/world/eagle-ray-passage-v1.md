# Southern Arch Snorkeling / Eagle Ray Fever

Implementation branch: `feat/eagle-ray-passage-v1` · PR #124.
**This branch is not deployed until merged and released.**

## Correct geography (fixed after screenshot review)
The basalt **lava-window** jet-ski arch lives at **(x=17,z=-127)**,
outside the finite land-heightfield at z=-96. The initial PR erroneously
put rays in the eastern tropical lagoon (x≈82,z≈8), where the user already
enjoyed existing snorkeling. That placement has been **removed**:
the original west kelp reef, eastern lagoon reef, and north skimboard
snorkeling remain unchanged.

This feature adds a new `south-channel` water zone from **z=-96 to -166**.
It connects naturally to existing east lagoon and west coast swimming at
the island's southern corner. `stepSwim` alone uses the expanded aquatic
clamp; land/skate/bike/ski remain inside `WORLD_BOUNDS`.

### Reach the south passage
1. Enter either the established east tropical lagoon or west kelp water near
   the southern shoreline.
2. Swim toward **negative Z** past the southern headland, then toward
   the basalt sea arch at **(17,-127)**.
3. The HUD canvas dataset exposes `southPassageSwimmable` when inside the
   southern zone, and `eagleFever`, `eagleFeverVisible`, `southReefFish`,
   and `southReefCorals` for browser audits.

No inland teleport or rerouted cave portal is required. The south arch is
not directly walkable past z=-96 because land-sport bounds are deliberately
unchanged. A future coast access/wayfinding design can give a shorter entry
without risking the mountain and arcade cave.

## Marine content
- **120 instanced eagle rays** in 6 vertical bands / 4 wing cohorts,
  plus 8 detailed eagle-ray visitors, 1 manta and 3 benthic stingrays.
- **Two cleaning stations** near the arch, with 14 cleaner fish and 10
  shrimp; occasional visitors detach from the migration flow.
- **Three southern reef gardens:** 72 reef fish, 112 seagrass blades,
  48 coral heads, 66 anemone tentacles, 21 sea stars, 18 crabs,
  10 lobster-like benthic models, and 25 nudibranch-like sea slugs.
  These are *stylized low-poly proxies*, not zoologically accurate models.
- Additional dark-blue southern underwater atmosphere and visibility range.
  Shore preview is gated by proximity to the southern mountain and does not
  render all marine scenery during inland exploration.

## Geometry and runtime
- SOUTH-only smooth trench displacement, max 17.5 world units, zero on
  z>=-96. Eastern lagoon and western kelp floor calculations retain their
  original formulas.
- The single southern seabed mesh spans z=-96..-166 and matches the precise
  depth sampler used for swimming and camera clearance; no separate
  decorative mesh with mismatched physics.
- Local max dive range blends up to 16 world units, obeying seabed clearance.
  Standard kelp/lagoon dive limits remain capped at 10 world units.
- Four instanced eagle-wing draw calls + one instanced tails draw;
  8 instanced batches for additional fauna. Ray wing vertex/normals updates
  are throttled to 15 Hz; trajectories move each frame. CPU update is
  linear in creature count and skipped when the channel is not rendered.
- Mobile reduces eagle-fever draw population from 120 to 96. Owned geometries
  and materials have explicit GPU disposal.

## Qualification
- `npm run typecheck`
- `node --import tsx --test tests/world-*.test.ts`
- `npx eslint lib/world/model.ts lib/world/rayPassage.ts lib/world/rayFever.ts
  lib/world/activities.ts lib/world/biomes.ts components/world/worldRayPassage.ts
  components/world/worldSouthChannelLife.ts tests/world-ray-passage.test.ts
  tests/world-eagle-fever.test.ts tests/world-south-channel.test.ts --max-warnings=0`
- `npm run check:world3d`
- Browser: kelp reef and lagoon unaffected; swim south from both coasts,
  descend through fever near lava-window, surface, swim back, resume sports.
- Inspect actual desktop/mobile GPU FPS, draw calls, water visibility,
  ocean/land mesh seam, and the arch passage before removing draft status.
- Independent existing security blocker: issue #125 (Next.js/Zod).

Do not claim that code-level tests prove visual fidelity or that this
feature is already on the public site. Keep preview and release distinct.
