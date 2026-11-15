# Arcade cavern entertainment mural integration (review only)

Base: `rc/iland-world-master-port-20261114` (draft PR #183). This branch
introduces **zero terrain, physics, navigation, camera, collision, or game-target
geometry changes**.

## Artwork now mounted in the existing cave renderer

- **Anime: RAID ASCEND**. Right upper wall, behind the playable sports niche,
  `z=-75.48..-68.10, v=.56..95`. Uses the original local SVG.
- **Sports anime: STRIKER // SET POINT**. Left lower, rearward
  `z=-74.95..-69.08, v=.12..51`. Uses original local SVG.
- **TV sci-fi comedy: OUT OF THIS WORLD**. Left lower, toward entrance
  `z=-80.45..-75.20, v=.12..51`. Uses original local SVG.
- **Sports fandom**. Existing Chelsea / Patriots / Warriors crest tribute
  stays in the lower right zone.
- **Personal highlights**. Real Shasta photo remains on the rear wall,
  alongside travel imagery.
- **All currently playable Game Network titles**. Stretchicorn, uniRico,
  and Unicorn Stampede preserve their original art and selection targets.

The former very wide right-side travel gallery is shortened to the entrance
so it does not layer under the anime mural. The long Shasta collage on the
left was removed from the cave **only** (the photo archive and rear portrait
remain intact) to make room for the entertainment panels.

## Asset provenance and performance

The first implementation intentionally uses the three *existing original
locally hosted SVG works* in `public/world/arcade-cavern/`, which are
fast-loading vector artwork. This does **not** claim to have shipped the
previously generated PNG/WEBP fan-art exports from ChatGPT. Those remain
separate reference assets and need explicit provenance, image QA, optimized
file ingestion, and public-use review before they replace any shipped art.

The existing renderer reuses the same surface projector, transparent paint
materials, local image loader, and disposal lifecycle. No new JS runtime,
remote media fetch, animation loop, collider, or draw-call class is added.
Game-cover galleries and all three clickable arcade panels are unchanged.

## Required exact-head review gates

1. `npx tsx --test tests/world-arcade-cavern-art.test.ts`.
2. Type check, lint, full tests, production build and bundle budget for the
   actual branch head, checking both ski-v3 enabled and fallback.
3. Desktop and mobile screenshots entering and traversing the cavern.
4. Verify all three game selection panels remain clickable, and their covers
   do not sit behind the new murals.
5. Inspect UV stretching, edge clipping, reflections, upload time, GPU draw
   calls, frame time, and texture-memory pressure.
6. Confirm original mural illustration provenance and remove any fan
   likeness or trademark use not cleared for public publication.

No merge or deployment from this branch without review of the island's
existing production qualification blockers.
