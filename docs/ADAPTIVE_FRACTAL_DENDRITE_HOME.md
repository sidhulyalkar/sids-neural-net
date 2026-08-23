# Adaptive Fractal Dendrite Homepage

## Why the landing page changed

The previous landing neuron chose its global radius from `min(viewportWidth, viewportHeight)`. On a 16:9 or ultrawide display that makes the height the limiting dimension, so the arbor remains compact while large horizontal bands of the viewport are unused.

The new homepage solves horizontal and vertical reach independently. It reserves a bottom identity band, finds the largest safe ellipse around the soma, and grows the dendritic field inside that ellipse. A 1920×1080 screen therefore receives a much wider arbor than a 390×844 phone, while both preserve the same eight destination topology.

## Mathematical sources

The renderer deliberately combines several ideas rather than imitating one biological neuron or one textbook fractal.

### 1. Recursive L-system / self-similar branching

Prusinkiewicz and Lindenmayer showed how compact recursive production rules can generate branching plant forms. The terminal arbor uses the same useful principle: a branch recursively produces daughter branches with a shrink ratio and split angle.

For an ideal binary self-similar construction with daughter scale `s`, the similarity dimension is

`D = log(2) / log(1 / s)`.

The default radial profile uses `s = 0.66`, which gives `D ≈ 1.67`. The rendered structure is not an exact mathematical fractal because branches are clipped, dropped, jittered, and embedded in a finite viewport, but this gives the terminal geometry a controlled dendritic density instead of arbitrary decoration.

Reference: Prusinkiewicz & Lindenmayer, *The Algorithmic Beauty of Plants*.

### 2. Diffusion-limited aggregation as a morphology cue

Witten and Sander's diffusion-limited aggregation work produces irregular dendritic aggregates with fractional scaling. The `coral` morphology borrows that visual logic through stronger angular noise, probabilistic branch dropout, and occasional weak central continuation. It does not run a costly particle DLA simulation in the browser.

Reference: Witten & Sander, *Diffusion-Limited Aggregation, a Kinetic Critical Phenomenon*, Physical Review Letters 47, 1400 (1981).

### 3. Space competition / colonization

Runions, Lane, and Prusinkiewicz demonstrated that competition for available space can produce convincing tree architecture. The homepage applies the same design principle at layout scale: eight fixed navigation owners occupy separate angular sectors inside a responsive ellipse, while their recursive daughter branches are bounded to the available visual field.

Reference: Runions, Lane & Prusinkiewicz, *Modeling Trees with a Space Colonization Algorithm*, Eurographics Workshop on Natural Phenomena (2007).

### 4. Pipe-model-style taper

The space-colonization paper describes supporting-branch radii with a generalized conservation relation of the form

`r^n = r1^n + r2^n`, with `n` commonly between 2 and 3.

The homepage uses `n = 2.35` to convert estimated downstream terminal mass into line width. This makes branches naturally thicken toward the soma instead of assigning unrelated widths by hand.

## Morphology families

The navigation topology never changes: FRONTIER, Game Network, Builds, Deployed Systems, Contact, Visual Cortex, Research, and Paper Archive always have one primary arm each. What changes is the visual morphology.

- `apical`: compact/mobile-first, fewer branch points, stronger trunk continuity.
- `radial`: balanced recursive snowflake with a target terminal similarity dimension near 1.67.
- `coral`: noisier diffusion-inspired arbor with selective dropout and clustered continuation.
- `fan`: wider, more lateral branching for ultrawide displays.

The viewport class constrains which families are eligible, then a per-mount entropy seed chooses among compatible families. Resizing within a class preserves the seed while recomputing the envelope from the actual viewport.

## Presentation constraints

- Canvas rendering is DPR-capped through the existing visual limits.
- The bottom title band is excluded from the growth envelope.
- Labels are attached to deterministic primary endpoints and clamped inside the viewport.
- Hover/focus highlights only the owning subtree and dims unrelated branches.
- All eight destination links remain ordinary accessible links and gesture-control targets.
- The canvas is decorative and `aria-hidden`; navigation remains semantic HTML.
- Branch generation has a morphology-specific hard path budget.
- The old `MinimalDendriteHome` remains exported as a preserved fallback/reference implementation.

## Regression contract

`tests/home-dendrite-regression.test.ts` verifies:

1. all eight destinations are first-class dendrites;
2. wide screens use width-aware reach rather than `min(width, height)`;
3. morphology selection is viewport-aware and seed-deterministic;
4. the default recursive scaling sits in a dendritic similarity-dimension range;
5. generated paths and navigation endpoints stay bounded across phone, tablet, desktop, 1080p, and ultrawide fixtures.
