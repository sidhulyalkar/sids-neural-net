# Astra handoff: Costa Rica rainforest expansion

> **Master-plan note:** This rainforest handoff is now subordinate to [astra-world-biome-master-spec.md](astra-world-biome-master-spec.md), which defines the island-wide biome topology, reusable fauna architecture, performance budgets, cave/waterfall work, desert/redwood/alpine integration, and sequencing. Use this file for Manuel Antonio-specific ecological detail only.

Status: planned next biome after the east-side lagoon reef is qualified on an exact green SHA.

## Product intent

Build a rainforest section inspired by Sid's Costa Rica trip without turning the world into a theme-park collage. The biome should feel dense, humid, layered and alive, but the interface should remain quiet. Let motion, plants, animals, water and Sid's real media do most of the storytelling.

The world must distinguish between:

1. **Ambient ecology** — species and systems that are characteristic of Costa Rica and can populate the biome as environmental context.
2. **Personal discoveries** — only photos/videos that are actually present in Sid's archive or explicitly identified by Sid as something he saw/experienced.

Never imply that an ambient species was personally observed unless a real media item or explicit user statement backs that claim.

## Ecological reference envelope

Use Costa Rica SINAC material as the baseline rather than generic jungle imagery.

- SINAC wildlife overview: https://sinac.go.cr/EN-US/visasilves/Pages/default.aspx
- Manuel Antonio National Park flora/fauna: https://www.sinac.go.cr/EN-US/ac/acopac/pnma/Pages/default.aspx
- La Cangreja National Park flora/fauna: https://sinac.go.cr/EN-US/ac/accvc/lcnp/Pages/default.aspx

Candidate ambient cast supported by those references includes toucans, sloths, white-faced monkeys, howler monkeys, coatis, agoutis, poison frogs and lizards. Use those as a palette, not a claim that Sid saw every species.

The archive already contains tropical/rainy imagery and wildlife details, including:
- photo-016: lizard on bark/leaves
- photo-017: bright green frog
- photo-019: rainy green valley
- photo-020: dense tropical leaves/stems
- photo-021: yellow flower in lush wet hills
- photo-023: palm-lined road through green fields
- photo-024: palm-lined tropical beach

These may be used as visual/personal discoveries only with descriptive wording unless location metadata is added later.

## Biome layout

Reserve a contained southeast/central-south land section rather than expanding every existing region.

Suggested progression:

- **Rainforest edge**: broad-leaf plants, heliconia-like forms, palms, wet understory.
- **Canopy corridor**: taller trunks, lianas, epiphyte clusters and moving canopy shadows.
- **Creek / riparian pocket**: rocks, shallow stream, frogs/lizards/insects.
- **Dense understory loop**: tighter visibility, leaf litter, fungi-like forms, small animal discoveries.
- **Canopy opening / overlook**: visual relief and one media discovery point.

Do not add a zoo-style list of species. The player should notice animals while moving.

## Runtime architecture

Use the same rules introduced by the two-reef system:

- Each biome gets a root group.
- A biome root is visible/animated only when the player is in or immediately adjacent to that biome.
- Dense vegetation must be instanced by part type/material.
- Small wildlife should share instanced body/tail/wing meshes where practical.
- Only a handful of hero animals may use multi-mesh groups.
- Animal paths are deterministic and cheap; no rigid-body physics or per-animal skeletal animation.
- Media loads only when its discovery panel opens.
- Video uses `preload="metadata"`; posters can be local optimized stills.
- Closing a media panel returns to the same world position and heading.

## Performance contract

Keep the current World Mode browser gates and add rainforest-specific checks.

Target on CI SwiftShader while rainforest is active:

- < 100 renderer draw calls (hard gate remains)
- prefer <= 70 draw calls for rainforest
- <= 90,000 visible triangles
- <= 90 visible renderables
- no inactive reef or rainforest animation work
- DPR/shadow adaptive quality behavior remains unchanged
- mobile still has no horizontal overflow
- reduced-motion and WebGL-loss fallbacks remain conventional navigation

If richer geometry threatens the budget, increase instance count before increasing mesh/material count.

## Wildlife behavior

Animals should feel curious, shy or indifferent, not hostile.

- small mammals/lizards: wander, pause, flee short distances from Shasta/player
- birds: perch, hop, short deterministic flights
- frogs: mostly stationary with rare short hops
- monkeys/sloths: hero animals placed above ground; minimal animation
- Shasta may investigate nearby small animals, but should never catch/attack them
- no feeding mechanics

Keep Shasta's existing distance-phased gait, bounded yaw step and smoothed terrain height intact.

## Personal media system

Use `WorldVideoPoint` / photo-memory discoveries rather than one-off UI.

A personal discovery record should contain:
- id
- short title
- one-sentence factual detail
- world point
- media source
- optional poster
- biome/reef association

Copy rules:
- no sentimental/cinematic filler
- no invented place names
- no "epic", "magical", "where the wild calls", etc.
- title should be a place/object/activity label
- detail should describe what is actually visible or known

## Polynesian reef continuation

The east lagoon should remain its own warm-water root. Its current art direction is based on Sid's Bora Bora / Tahiti / Mo'orea trip:
- purple / green / gold coral garden
- manta ray
- spotted/eagle-ray-like ray
- stingray
- blacktip-style reef sharks
- varied colorful reef fish

The reef is an autobiographical art-directed composite, not a claim that one exact surveyed reef contained every represented species.

Coral forms should take inspiration from common Pacific reef architectures such as massive Porites-like heads, branching/staghorn forms and Pocillopora-like clumps without labeling procedural geometry as a specific species unless we later add a verified source-backed identification.

## Media blocker

There are currently no committed `.mp4`, `.mov` or `.webm` snorkeling clips in the repository. Do not add fake placeholders or external stock video.

The runtime is ready for real clips through `SNORKEL_VIDEO_POINTS`. Once Sid supplies/export-selects the clips:
1. optimize them for web playback,
2. create lightweight poster frames,
3. add entries with real local paths,
4. place discovery points in the corresponding reef,
5. browser-test play/pause/Escape/close and exact-position return.

## Astra first actions

1. Do not change the rainforest runtime until the current east-lagoon branch head is exact-green in all three required workflows.
2. Review the final lagoon screenshots and renderer diagnostics.
3. Implement rainforest in a new isolated root using the performance contract above.
4. Start with vegetation + one creek + 3 small wildlife types.
5. Add hero animals only after the first rainforest browser audit stays below budget.
6. Add personal Costa Rica media only from real archive assets or explicit user-provided media/location metadata.
