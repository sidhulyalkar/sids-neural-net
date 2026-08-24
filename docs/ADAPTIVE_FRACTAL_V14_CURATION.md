# Adaptive Fractal Home V14 Curation

PR #26 now exposes a deliberately smaller public morphology set and treats navigation readability as a hard rendering constraint.

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

## Qualification boundary

Runtime head `ee6a09b7ead82862f0c3a5f34f844cd36412dc73` passed Adaptive Fractal Home CI run `32789288246` and Website CI run `32789288251` end-to-end. The deterministic browser gallery verifies all six active morphologies, rejects all six retired morphologies, confirms eight protected destination controls plus CORE, confirms visible opaque destination labels, checks CORE centering/diameter, and validates the Echo Nest Fermat layout.
