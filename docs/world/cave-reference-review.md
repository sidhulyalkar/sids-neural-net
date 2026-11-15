# Cave reference review — 2026-10-18

The supplied reference is an art-direction target, not evidence of the current
runtime. A real browser walkthrough confirmed a substantial visual gap.

## Implemented locally

- Replaced the active anime/TV mural program with Shasta and landscape galleries;
  preserved Chelsea, Patriots, Warriors and the rear identity band.
- Shasta includes all 12 archive entries tagged `dog`, without cropping faces.
  Visitor-left on entry is world +X (the shell calls this `right`).
- Separate landscape selections on the two remaining wall regions.
- 2048 × 1280 gallery atlases, image decoding with per-image failure isolation,
  and a disposal guard against late uploads after leaving the world.
- Stone material adds world-space mineral grain and strata to the shell, floor,
  rear wall and existing baffle without adding draw calls or changing collision.
- Wall art remains non-interactive and clear of existing game targets.

## Remaining reference gaps

The scene does not yet match the supplied image. It still needs authored rock
relief, moss/fern clusters, cascading water, warm local light pools, and large
verified game-cover artwork. Landscape photos are currently framed galleries,
not painted nature graffiti. The large entrance baffle still interrupts the
view; its collider and wayfinding route must be changed together if redesigned.

No cover/poster files for Stretchicorn, uniRico or Unicorn Stampede were found
in this checkout, and their default `public/game-runtimes/<slug>` directories
are absent. Do not substitute fabricated screenshots or describe the text-only
niches as completed poster integration.

## Validation

Production build, TypeScript and focused lint passed. Eight cave geometry and
wayfinding tests passed. The first real-keyboard browser walkthrough passed
with no page errors, retaining eight mural draw calls and 6,334 mural triangles.
The final full walkthrough also passed with no page or shader errors.
A subsequent material refinement corrected texture scale on transformed meshes
and softened the mineral seams; the production build passed again. Evidence lives under
`artifacts/world/cave-reference-final/` with its adjacent browser log.

Software-rendered browser FPS is not a representative hardware performance
measurement. Visual parity remains an open acceptance criterion. Changes have
not been pushed or deployed.
