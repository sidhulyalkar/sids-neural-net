# Adaptive Fractal Home V14 Curation

PR #26 exposes a deliberately smaller public morphology set and treats navigation readability as a hard rendering constraint.

## Active homepage families

- Radial Snowflake
- Diffusion Coral
- Lateral Fan
- Apical Arbor
- Helical Spiraloid
- Echo Nest / Fermat lattice

Aurora Veil, Mycelial Web, Tectonic Rift, Pendulum Halo, Pixel Ghost, and Echidna Quill are retired from public homepage selection. Explicit legacy morphology URLs are mapped to a supported fallback before the homepage's generated session seed is consumed, and the theme-persistence layer refuses to carry retired families into subpages.

## Navigation clearance contract

The V13 crisp topology renderer remains responsible for geometry. Every primary route starts on the outside edge of the circular CORE control and terminates on the measured border of its destination control. Secondary dendrites snap back to their parent topology and orphan/very-short branchlets are pruned.

V14 makes every destination card fully opaque (`#010406`) rather than translucent. This closes the presentation-layer gap where correctly terminated trunks or auxiliary fractal geometry could still be visible through a card. The label itself remains the highest visible navigation surface, so there is no separate overlay capable of covering destination text.

Runtime metadata used by browser qualification:

- `data-primary-routing="core-and-label-edge-v13"`
- `data-topology-repair="snap-prune-v13"`
- `data-core-clearance="circle-edge-v13"`
- `data-render-fidelity="crisp-no-glow-v13"`
- `data-destination-clearance="opaque-card-v14"`
- `data-destination-edge-clearance="v14"`

## Minimal production chrome

The production homepage deliberately omits the morphology/scientific caption from the top of the viewport. The underlying morphology and dimension remain available as DOM metadata for testing and diagnostics, but the visible landing page is reduced to the fractal field, navigation, CORE, identity lockup, and optional camera-controls affordance. Runtime metadata exposes `data-home-chrome="minimal-v15"`.

## Production qualification boundary

The final feature head `3e4b37e52273cd893bd1592d4f2bc7aca89c51ef` passed Adaptive Fractal Home CI run `32792043754` and Website CI run `32792043755` end-to-end, including the minimal-chrome visual gallery. PR #26 was then merged to `master` as `9f3db1a0fc4932873a68b45e10893fc646b9620b`.

The merge commit independently passed the full Website CI production gate in run `32792411282`, including dependency audit, typecheck, lint, unit tests, deterministic corpus checks, production build and bundle budget, public-route smoke tests, FRONTIER privacy/media/interaction audits, homepage navigation, multi-browser Game Network validation, and production browser captures.
