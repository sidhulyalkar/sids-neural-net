# FRONTIER Phase 8 — Fluid Spatial Interaction

Phase 8 makes the FRONTIER surface feel continuous without changing the recommendation authority graph introduced in Phases 2–7.

The interaction layer remains downstream of ranking, exact unseen suppression, Watch/Avoid intent scoring, anti-staleness, and synthesis.

## Product contract

1. The first qualified pointer release reacts immediately. There is no timer that delays the single-click path.
2. A second qualified release on the same item within 250 ms interrupts the first interaction, collapses the inline expansion, and synchronously opens the canonical source in a new tab.
3. Scroll gestures, long presses, media controls, feedback controls, and explicit native links are never interpreted as fluid card clicks.
4. Inline focus marks an item durably seen but does not itself become semantic preference evidence.
5. Grid reflow is performed once. Motion frames are compositor transforms, not repeated layout mutations.
6. Reduced-motion users receive the final layout without FLIP animation.
7. Existing video/iframe/GPU media components are not re-keyed, cloned, portaled, or remounted during inline expansion.
8. No modal backdrop, close button, heavy shadow, or persistent Phase 8 control surface is introduced.

## Browser click latency clarification

The historical ~300 ms click delay was primarily associated with touch browsers waiting for a possible double-tap gesture. Modern desktop `click` events are not universally delayed by 300 ms.

FRONTIER nevertheless avoids relying on `click`/`dblclick` arbitration. `useFluidInteraction.ts` owns a small pointer state machine:

```text
pointerdown
  ↓
qualified pointerup
  ├─ first release       → expand now
  ├─ second ≤ 250 ms     → external open + collapse
  └─ later release       → ordinary collapse / new sequence
```

The first path contains no timeout.

`touch-action: manipulation` removes the browser's double-tap zoom arbitration from the card surface while preserving pan and pinch behavior.

## Pointer qualification

A release is eligible only when:

- it is the primary pointer
- it uses the primary button
- pointer ID matches the initiating press
- movement stays within 9 px
- press duration stays below 650 ms
- the target is not a button, input, select, contenteditable surface, video, audio, iframe, slider, or explicitly native link

The editorial headline/source link is the one anchor deliberately routed through the fluid interaction model. Save, feedback, explicit external-link, artifact, convergence-source, and media controls retain native one-click semantics.

## Critically damped FLIP

Phase 8 measures visible/near-visible fluid cards immediately before a layout state change.

The grid then performs one real layout update. Each card receives a FLIP transform from its previous rectangle to its new rectangle.

The interpolation is a sampled critically damped response:

```text
F = -kx - cv

x(t) = (1 + ωt)e^(-ωt)
progress(t) = 1 - x(t)
```

with a normalized endpoint and `ω = 9.5`.

Twenty-two sampled keyframes are handed to WAAPI with linear interpolation between the physical samples. WAAPI therefore owns compositor timing while the main thread does not integrate spring state on every frame.

Current motion duration: 460 ms.

A second click during an active expansion first measures the currently transformed visual rectangle, then cancels the old animation, changes the layout back, and launches a new FLIP from that exact interrupted position. The reverse motion therefore does not snap back to an old layout frame before collapsing.

## One layout, compositor motion

Only the expansion state changes layout:

```css
grid-column: 1 / -1;
```

Neighboring items move to their final CSS Grid positions immediately in layout space, then their visual transforms animate from the captured previous rectangles.

No `width`, `height`, `top`, `left`, or grid properties are animated per frame.

Permanent `will-change` is intentionally avoided. WAAPI promotes only the elements that are actually moving.

`content-visibility:auto` remains enabled for the normal virtualized card reservoir. The expanded card temporarily becomes visible so its complete inline content can participate in the one layout pass.

## Inline focal content

The old modal quick-view behavior is replaced on `SignalBoard` by an inline focal state.

A focused card expands into the grid and exposes:

- the existing normalized summary
- deterministic source-grounded takeaways
- structural artifacts
- converging source links
- the canonical source link

The existing card subtree stays mounted above the additional focal detail. Media is not duplicated in the detail section.

Space over a hovered card opens the same inline state. Escape collapses it.

A later ordinary single click on the expanded card collapses it. A second click within the active 250 ms sequence opens the canonical source externally and collapses the card.

## Media continuity

### Native video and iframe

`InlineMediaSurface.tsx` provides a stable React context/boundary but deliberately performs no reparenting.

The exact `HTMLVideoElement`, MSE controller, YouTube iframe, or native image subtree remains mounted while the parent card changes geometry.

`AdaptiveVideoSurface` already omits native browser controls. Its custom minimal controls appear through hover/focus behavior and its internal fullscreen FLIP remains independent from card expansion.

Playback time, decoder state, buffered ranges, mute state, and playback coordinator ownership therefore survive the card transition naturally.

### Shared WebGL2 image plane

The WebGL image renderer is viewport-fixed, so a DOM transform does not automatically move canvas pixels.

Phase 8 handles this explicitly:

1. `GpuImageSurface` now separates its visual frame from the GPU registration slot.
2. Before expansion it remembers the compact frame size.
3. While inline-expanded, the registration slot retains that compact layout size and uses a transform to occupy the larger visual frame.
4. The texture key therefore does not churn merely because the card is expanding.
5. During the 460 ms spatial FLIP, `useSpatialFlip` ticks the plane through its existing lightweight viewport invalidation path each animation frame.
6. The plane reads the transformed registration rectangle and redraws the same texture at the current interpolated coordinates.

The existing WebGL2 drawing buffer remains the same wide-gamut/P3-capable context. No second canvas or replacement image element is introduced.

## Aesthetic treatment

Expansion uses optical space rather than chrome:

- no modal backdrop
- no close icon
- no border added around the focused state
- no heavy shadow
- one extremely faint sage radial field
- typography and evidence remain aligned to Phase 7 density variables
- compact hint: `click focus · 2× source`

## Accessibility and input safety

- Escape collapses inline focus.
- Space retains the keyboard quick-view path when the pointer is over a card.
- Space is ignored while typing or interacting with controls/media.
- Explicit source/artifact/convergence links remain ordinary keyboard-focusable anchors.
- Reduced-motion preference skips FLIP animation completely.
- Pointer drag/scroll gestures never trigger expansion.

## Tests

`tests/frontier-phase8.test.ts` locks the core timing/math contract:

- first release returns `expand` immediately
- second release inside 250 ms returns `external`
- late release becomes ordinary collapse
- movement threshold rejects scroll gestures
- long-press threshold rejects holds
- pointer ID mismatch is rejected
- critically damped progress is monotonic and reaches exactly 1
- FLIP inversion starts at the old box and finishes at identity

The complete pre-existing FRONTIER production gate remains authoritative for TypeScript, lint, older recommendation/safety tests, build budget, privacy boundaries, media gateway boundaries, production build, and desktop/mobile browser captures.

## Authority boundary

Phase 8 does not change positive ranking, negative Avoid penalties, exploration temperature, Watch thresholds, source pruning, convergence, or velocity scoring.

Inline expansion is intentionally presentation state. It marks the canonical identity seen because the user explicitly focused it, but the animation itself does not feed the semantic model.

That keeps the system from learning that visually satisfying motion means a topic is preferred.
