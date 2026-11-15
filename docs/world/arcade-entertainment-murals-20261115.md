# Arcade cavern entertainment mural integration (review only)

Base: `rc/iland-world-master-port-20261114` (draft PR #183). This branch
introduces **zero terrain, physics, navigation, camera, collision, or game-target
geometry changes**.

## Artwork now mounted in the existing cave renderer

- **Anime: RAID ASCEND**. Left middle-height wall near the entrance,
  `z=-80.45..-75.12, v=.26..86`. Uses the original local SVG.
- **Sports anime: STRIKER // SET POINT**. Left middle-height wall, rearward,
  `z=-74.93..-69.08, v=.26..86`. Uses the original local SVG.
- **TV sci-fi comedy: OUT OF THIS WORLD**. Right upper wall, between
  the entry landscape and the game niches,
  `z=-75.48..-71.75, v=.56..95`. Uses the original local SVG.
- **Sports fandom**. Existing Chelsea / Patriots / Warriors crest tribute
  stays in the lower right zone.
- **Rear-wall centerpiece**. A responsive 4.8:1 composite of three original,
  locally authored sports-anime, fantasy and comedy SVGs replaces the former
  three-photo rear banner. Its declared raster size is 2048 x 427 to cap
  GPU texture memory while retaining a vector source master.
- **Personal highlights**. Real Shasta photo remains on the rear wall,
  alongside travel imagery in the retained scenic side gallery.
- **All currently playable Game Network titles**. Stretchicorn, uniRico,
  and Unicorn Stampede preserve their original art and selection targets.

The former very wide right-side travel gallery is shortened to the entrance
so it does not layer under the comedy mural. The long Shasta collage on the
left was removed from the cave **only** (the photo archive and rear portrait
remain intact) to make room for the entertainment panels. Their narrower
physical footprints better respect the original 1600x1000 SVG proportions.

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


## Focused screenshot gate

`scripts/playtest-arcade-interior.mjs` checks the nine mural meshes, all
three locally hosted SVG assets, the three separate playable game covers,
Shasta's retained rear portrait, bounded art draw calls, and live desktop
screenshots after a real keyboard approach into the room. It uses the origin
of `WORLD_BASE_URL` for asset requests, so a `/world` route prefix does not
accidentally resolve `/world/world/...` URLs.

The independent `Arcade Cavern Artwork Review` GitHub workflow captures
screenshots and a JSON trace at its own exact head, even if skiing tests fail.
This is **not** a replacement for physical-GPU timing or a manual art review.


### Visual review from first browser evidence

The first exact-head screenshot pass showed that the upper rear wall carried
three travel photos. Because the three game targets command the player's
natural forward view, the entertainment murals were easy to miss on the
sidewalls. The new panoramic original-art triptych uses that rear title band
without covering the existing center game hitbox, and the mountain/travel
photo galleries remain on the side walls. Re-run screenshot evidence after
this change and inspect legibility at gameplay distance, not merely asset
loading.
