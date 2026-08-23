# Adaptive Fractal Dendrite Homepage

## Why the landing page changed

The previous landing neuron chose its global radius from `min(viewportWidth, viewportHeight)`. On a 16:9 or ultrawide display that makes height the limiting dimension, so the arbor remains compact while large horizontal bands of the viewport are unused.

The adaptive homepage solves horizontal and vertical reach independently. It reserves a bottom identity band, finds the largest safe ellipse around the navigation core, and grows inside that envelope. A 1920×1080 screen therefore receives a substantially wider composition than a 390×844 phone, while both preserve the same eight semantic destinations.

## Navigation is invariant, morphology is generative

FRONTIER, Game Network, Builds, Deployed Systems, Contact, Visual Cortex, Research, and Paper Archive remain ordinary accessible links. Each generated field must expose one deterministic endpoint for every destination. Morphology is allowed to change geometry, branching rules, rendering primitives, and visual center of mass, but never the navigation contract.

A per-mount entropy seed makes repeat visits genuinely generative. The viewport class constrains which families are eligible, then weighted deterministic selection chooses one from the compatible set. For visual QA, query parameters can freeze both variables:

- `/?morph=aurora&seed=review-1`
- `/?morph=tectonic&seed=review-1`
- `/?morph=halo&seed=review-1`

The `morph` override is intentionally undocumented in the visible UI. It exists as a reproducibility and art-direction instrument for preview deployments and browser fixtures.

## Mathematical sources

The renderer combines several generative ideas rather than pretending to reproduce one biological neuron.

### Recursive L-system / self-similar branching

Prusinkiewicz and Lindenmayer showed how compact recursive production rules can generate branching plant forms. The rooted families use the same useful principle: a branch recursively produces daughter branches with a shrink ratio, split angle, dropout probability, and bounded noise.

For an ideal binary self-similar construction with daughter scale `s`, the similarity dimension is

`D = log(2) / log(1 / s)`.

The radial profile uses `s = 0.66`, giving `D ≈ 1.67`. The rendered field is finite, clipped, noisy, and interaction-aware, so this value is a density control rather than a claim of exact Hausdorff dimension.

Reference: Prusinkiewicz & Lindenmayer, *The Algorithmic Beauty of Plants*.

### Diffusion-limited aggregation cue

Witten and Sander's diffusion-limited aggregation work produces irregular dendritic aggregates with fractional scaling. The `coral` family borrows that visual logic through stronger angular noise, probabilistic dropout, and occasional weak central continuation. It does not run an expensive particle DLA simulation in the browser.

Reference: Witten & Sander, *Diffusion-Limited Aggregation, a Kinetic Critical Phenomenon*, Physical Review Letters 47, 1400 (1981).

### Space competition / colonization

Runions, Lane, and Prusinkiewicz demonstrated that competition for available space can produce convincing tree architecture. The homepage applies that principle at layout scale: destination-owned structures occupy a viewport-aware field, while hard geometry and path budgets prevent recursive growth from starving later navigation owners.

Reference: Runions, Lane & Prusinkiewicz, *Modeling Trees with a Space Colonization Algorithm*, Eurographics Workshop on Natural Phenomena (2007).

### Pipe-model-style taper

Supporting-branch radii use a generalized conservation relation of the form

`r^n = r1^n + r2^n`.

The homepage uses `n = 2.35` to convert estimated downstream terminal mass into line width. This makes rooted branches naturally thicken toward the core instead of receiving unrelated decorative widths.

## Morphology families

### Rooted dendritic families

- `radial`: balanced snowflake recursion with terminal dimension near 1.67.
- `coral`: noisy diffusion-inspired arbor with selective dropout and clustered continuation.
- `fan`: wide lateral branching that spends more visual energy along the long axis.
- `apical`: sparse compact/mobile arbor with stronger trunk continuity.

### New adaptive families

- `tectonic`: a wandering panoramic fault line. Destination fractures grow from the baseline while perpendicular recursive stress cracks decrease in length and increase irregularity. Weighted heavily for 21:9 and 32:9 displays.
- `spiraloid`: recursive branching with a fixed chiral rotation per depth and sinusoidal length modulation. Primary arms also receive a shallow corkscrew displacement, creating a helical depth cue without WebGL.
- `mycelial`: a non-rooted nearest-neighbor network. Scattered seeds form bifurcating stems and secondary connections; destination endpoints attach into the nearest local network rather than all converging on a soma.
- `halo`: an inverted arbor. Paths begin on the outer ellipse and bend inward, stopping at a protected central void while tangential deflection creates orbital arcs. Favored on portrait/mobile where the void gives text and Core room to breathe.
- `pixel-ghost`: a multi-generation cellular field rendered as shrinking square primitives. Survival and birth are neighbor-count driven, while thin orthogonal destination connectors preserve semantic navigation. It is deliberately rare and biased toward square or smaller canvases.
- `aurora`: spline-based recursive branches displaced by a global oscillating wind field. Later branches curl more strongly, producing broad overlapping ribbons that work especially well on cinematic widths.
- `echidna`: a hybrid radial/fan system. Early recursion is dendritic; deeper generations snap toward lateral growth, with barb length modulated by parent height. Portrait layouts gain a strong vertical spine with dense horizontal quills.
- `echo-nest`: recursive triangular stencils scaled by 0.6 and rotated 30 degrees. Deeper levels erase underlying canvas pixels before their outlines are redrawn, so the composition is defined by true-black negative-space cutouts rather than branch mass.

## Adaptive selection

Selection is weighted, not uniform. This keeps the homepage surprising without letting novelty damage composition.

- Compact phones favor `halo`, `apical`, `echidna`, and `spiraloid`; `pixel-ghost` is a smaller accent probability.
- Portrait screens favor `halo`, `echidna`, `spiraloid`, and `apical`.
- Balanced/square screens admit `spiraloid`, `mycelial`, `radial`, `echo-nest`, `coral`, and occasionally `pixel-ghost`.
- Standard landscape screens remain anchored by `radial`/`coral`/`fan`, with lower-probability flow and network families.
- Ultrawide screens shift toward `aurora`, `tectonic`, and `mycelial`.
- Extreme-wide screens make `aurora` and `tectonic` the dominant outcomes because they fill panoramic space without a small central island.

## Rendering architecture

The canvas now understands three bounded primitive classes:

1. `stroke` for dendrites, fractures, flow ribbons, web edges, and navigation connectors;
2. `pixel` for the cellular automaton squares;
3. `stencil` for recursive negative-space polygons.

This keeps the DOM small: navigation remains HTML, while high-complexity generative geometry stays in one DPR-capped canvas.

## Presentation and accessibility constraints

- Canvas rendering is DPR-capped through the existing visual limits.
- The bottom identity band is excluded from the growth envelope.
- Labels are attached to deterministic destination endpoints and clamped inside the viewport.
- Hover/focus highlights destination-owned geometry and dims unrelated branches.
- All eight destination links remain semantic, keyboard-accessible links and gesture-control targets.
- The canvas is decorative and `aria-hidden`.
- Every morphology has a hard path budget.
- Rooted owners receive fair per-destination budgets so recursion cannot starve later links.
- The old `MinimalDendriteHome` remains exported as a fallback/reference implementation.

## Regression and visual QA contract

`tests/home-dendrite-regression.test.ts` verifies:

1. all eight destinations remain first-class navigation endpoints;
2. wide screens use width-aware reach rather than `min(width, height)`;
3. adaptive selection is viewport-aware and seed-deterministic;
4. every morphology can be forced reproducibly;
5. all twelve engines stay within geometry and path budgets;
6. Pixel Ghost and Echo Nest emit their specialized canvas primitives.

`Adaptive Fractal Home CI` then builds the production application and performs browser-level checks. In addition to the ordinary homepage smoke test, `scripts/fractal-home-gallery.mjs` forces the eight new morphologies at their intended aspect ratios, verifies all navigation labels remain in-viewport, and stores deterministic screenshots for visual review.
