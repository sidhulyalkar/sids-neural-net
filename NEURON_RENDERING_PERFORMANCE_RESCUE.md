# Claude Code Instructions: Neuron Rendering Performance Rescue + Visual Simplification

## One-line directive

Treat this as a **performance rescue and visual simplification task**: delete the heavy neuron art path, replace it with a canvas-based skeleton renderer, and keep the page elegant, sparse, and fast.

---

## Context

You are working in my Next.js personal website repo. The current neuron/connectomics homepage is visually wrong and performance-heavy. It is killing memory/GPU and still does not look like clean neurons.

I want you to stop iterating on the current giant soma / polygon / glow-heavy renderer and redesign the rendering strategy from first principles.

The goal is **not** to build a full Neuroglancer clone. The goal is to borrow the performance and visual principles used by tools like Neuroglancer, MICrONS viewers, Vaa3D/NeuTube-style morphology visualization, and web connectomics tools:

- Render sparse skeletons, not filled blobs.
- Render line segments / polylines, not giant meshes.
- Use precomputed geometry.
- Use level-of-detail.
- Keep DOM element count low.
- Avoid massive translucent layers.
- Avoid huge filters and blur effects.
- Keep navigation nodes clear and simple.

---

## Current problems

- The Origin Signal node is a giant gray/white disk covering most of the viewport.
- The soma is too large and looks like a moon, not a neuron.
- Dendrites are not visible as meaningful branching morphology.
- Inter-node axons are overly long, smooth, and sparse.
- There are giant translucent circles that create expensive overdraw.
- The whole page is slow and memory-heavy.
- The result does not look like real SWC/MICrONS skeletons.

Please implement a new optimal strategy.

---

## 1. First, audit and disable expensive visual paths

Find and remove/disable any code that renders:

- Giant translucent circles or halos larger than about `120px` radius.
- Large filled polygons.
- Triangulated soma shards.
- Huge SVG filters / blur filters.
- Thick glowing cables.
- Per-frame React state updates.
- Thousands of React/SVG elements.
- Unbounded branch recursion.
- Any randomly regenerated geometry during render.
- Any `Math.random()` called during component render.

The current giant disk around Origin Signal must be removed. No navigation node should cover more than about **8–10% of the viewport**.

---

## 2. Replace the renderer with a lightweight skeleton-first renderer

Use a **2D skeleton rendering approach first**. Do not use heavy 3D meshes yet.

Preferred implementation:

- Use a single `<canvas>` for the neuron/connectome background.
- Use normal React/HTML only for labels and clickable navigation hit areas.
- Draw all morphology on canvas from precomputed arrays.
- Keep interactions lightweight by redrawing canvas on hover/click, not rerendering thousands of React nodes.

Suggested architecture:

```txt
src/
  components/
    neural/
      NeuralAtlas.tsx
      NeuralCanvas.tsx
      NeuralLabels.tsx
  lib/
    neural-render/
      seededRandom.ts
      generateNeuronSkeleton.ts
      generateAxonBundle.ts
      parseSWC.ts
      normalizeSkeleton.ts
      drawSkeletonCanvas.ts
      spatialLayout.ts
```

The canvas should be:

- Absolutely positioned.
- Full viewport.
- DevicePixelRatio-aware but capped at `2`.
- Redrawn only when viewport size, hover target, active route, or geometry changes.
- Not updated via React state every animation frame.

Example canvas setup:

```ts
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = Math.floor(width * dpr);
canvas.height = Math.floor(height * dpr);
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
```

---

## 3. Use precomputed skeleton arrays

Represent neurons as compact line/polyline data:

```ts
type Vec2 = { x: number; y: number };

type SkeletonSegment = {
  points: Vec2[];
  width: number;
  alpha: number;
  depth: number;
  color: string;
};

type NeuronSkeleton = {
  id: string;
  label: string;
  route?: string;
  soma: Vec2;
  somaRadius: number;
  color: string;
  segments: SkeletonSegment[];
};

type AxonBundle = {
  from: string;
  to: string;
  strands: SkeletonSegment[];
};
```

Generate once using `useMemo` from fixed seeds.

Do not regenerate skeletons during hover, animation, or render loops.

---

## 4. Make the visual simpler and more neuron-like

The homepage should show a small number of clear neuron-like navigation nodes, not a giant dense brain.

Visual rules:

- 7 major neurons max.
- Each major neuron has a small soma.
- Each soma has 6–10 primary dendrites.
- Each dendrite branches 1–3 times.
- Total visible branch segments per neuron: `40–90`.
- Total full scene branch segments target: under `700`.
- Soma radius:
  - Origin Signal: `24–34px` max.
  - Other nodes: `14–24px`.
- No giant halos.
- Optional local aura radius max:
  - Origin Signal: `70px`.
  - Other nodes: `45px`.
  - Alpha below `0.05`.
- Branch width:
  - Primary: `1.1–1.8px`.
  - Secondary: `0.6–1.1px`.
  - Terminal: `0.25–0.7px`.
- Axon bundle width:
  - `0.35–1.0px` per strand.
  - 2–4 strands max per connection.

The goal is not to fill the screen with geometry. The goal is sparse, elegant, scientific-looking traced skeletons.

---

## 5. Use Neuroglancer-style principles, adapted for a portfolio

Neuroglancer handles large neuroscience data with WebGL and supports line-segment skeleton rendering. For this portfolio, we should mimic the data model, not the entire viewer.

Adopt these principles:

- Skeletons are arrays of points and edges.
- Geometry is precomputed.
- Rendering is batched.
- Display detail depends on zoom/focus.
- Hidden/distant/unfocused items are drawn with less detail.
- Heavy volumetric effects are avoided.
- Selections/hover modify style/state, not geometry.

Since this site does not need true volumetric viewing, use Canvas 2D first. If performance is still bad, use WebGL/PixiJS/regl later.

Do **not** introduce the full Neuroglancer dependency unless explicitly justified.

---

## 6. Level-of-detail

Implement simple LOD.

### Home overview

- Draw somas.
- Draw primary and secondary branches only.
- Draw inter-node axon bundles lightly.
- Hide terminal twigs unless hovered.

### Hover/focus

- Draw full detail for hovered neuron.
- Dim unrelated neurons to `0.25–0.45` alpha.
- Draw terminal twigs for hovered neuron only.
- Brighten selected axon bundle.

### Route/detail view

- Keep background morphology extremely subtle.
- Do not zoom into a huge soma.
- If route is `?atlas=about`, show content panel/card over a dim skeleton background.

This should prevent the giant Origin Signal blob problem.

---

## 7. Procedural skeleton generation

Rewrite the generator to produce clean traced arbors.

Pseudo-logic:

```ts
function generateNeuronSkeleton(seed, center, options): NeuronSkeleton {
  const rng = seededRandom(seed);
  const segments = [];

  for each primary dendrite:
    angle = evenly distributed angle + rng jitter
    start = point on soma edge
    createBranch(start, angle, length, depth=0)

  return { soma, somaRadius, segments };
}

function createBranch(start, angle, length, depth) {
  if totalSegments > maxSegments return;

  const points = [start];
  let p = start;
  let theta = angle;

  for step in 0..numSteps:
    theta += small angular jitter
    p = p + unit(theta) * stepLength
    points.push(p)

    maybe spawn child branch if depth < maxDepth
  }

  segments.push({
    points,
    width: widthByDepth(depth),
    alpha: alphaByDepth(depth),
    depth,
    color
  });
}
```

Important:

- Branches should be irregular polylines, not smooth Bezier roads.
- Branches should taper by depth.
- Branch recursion should be capped.
- Generated skeleton should be deterministic.
- No filled polygons except a small soma.

---

## 8. Soma design

Render soma as a small organic blob, not a disk.

Canvas approach:

- Draw a small noise-perturbed closed path.
- Fill with dark translucent color.
- Stroke with neuron color at low alpha.
- Add tiny center glow only.
- No giant gray circle.
- No giant white solid center.

Suggested style:

```ts
ctx.globalAlpha = active ? 0.85 : 0.45;
ctx.fillStyle = "rgba(210, 220, 210, 0.16)";
ctx.strokeStyle = colorWithAlpha(neuron.color, active ? 0.7 : 0.35);
ctx.lineWidth = 1;
```

Soma should remain understated. The morphology should carry the neuron identity, not a huge orb.

---

## 9. Axon bundles

Current cables are too smooth and thick. Replace with thin bundles:

- Each connection is 2–4 irregular strands.
- Each strand is a polyline with 8–18 control points.
- Jitter perpendicular to path.
- Alpha `0.14–0.35`.
- Width `0.35–0.9px`.
- No glow by default.
- On click/hover, draw one small moving pulse, but optional.

Do not draw thick roads.

---

## 10. Keep labels and hit targets separate

Do not make morphology itself responsible for click accuracy.

Use separate absolutely positioned HTML buttons for the navigation nodes:

- Position them at each soma coordinate.
- Label chip near soma.
- Hit target can be `44–64px` invisible circle.
- Label remains readable.
- Canvas remains decorative/background.

This avoids expensive hit testing and preserves accessibility.

---

## 11. Route view problem

The screenshot shows `/atlas=about` zooming into a giant Origin Signal soma. Fix this behavior.

For detail routes:

- Do not scale the neuron scene so much that the soma fills the viewport.
- Keep background canvas at normal scale or only slightly pan.
- Display the content/detail panel as the main focus.
- Dim morphology behind it.
- If there is a transition, animate a subtle pulse along axon lines, not a huge camera zoom into a node.

If current route transition uses scale transforms, cap scale to `1.15` max or remove it.

---

## 12. Performance budgets

Hard limits:

- Total canvas draw calls should be reasonable.
- Total skeleton segments under `700` in overview.
- No more than 7 major neurons.
- No branch recursion beyond depth `3` for homepage.
- No canvas dimension above `2x` DPR.
- No blur filters above `8px`.
- Avoid `shadowBlur` on every branch. If used, only use it for hovered neuron or pulse.
- No large translucent circles over the whole page.
- No per-segment React elements.
- No per-frame React rerenders.

Optional animation:

- Use `requestAnimationFrame` only for hover/click pulse.
- Stop animation when no active pulse exists.
- Respect `prefers-reduced-motion`.

---

## 13. SWC support

Keep SWC parsing utilities, but do not render raw SWC files directly at full detail on the homepage.

If SWC is loaded:

- Parse it.
- Downsample it.
- Normalize it.
- Cap max segments.
- Simplify polylines with Ramer-Douglas-Peucker or simple point skipping.
- Use it as background/focus detail only.

Add utilities:

```ts
simplifySkeleton(points, epsilon)
limitSkeletonSegments(segments, maxSegments)
```

Homepage should use either:

- Curated low-res procedural skeletons, or
- Downsampled SWC skeleton previews.

Do not render full morphology files unbounded.

---

## 14. Build a performance-mode fallback

Add a config:

```ts
const NEURAL_RENDER_CONFIG = {
  mode: "canvas-lite",
  maxNeurons: 7,
  maxSegmentsPerNeuron: 90,
  maxTotalSegments: 650,
  dprCap: 2,
  enableGlow: false,
  enablePulse: true,
  enableTerminalTwigsOnHoverOnly: true,
};
```

Also respect reduced motion:

```ts
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
```

If reduced motion:

- No pulse animation.
- No shimmer.
- Static canvas only.

---

## 15. What to avoid

Do **not**:

- Add more bloom.
- Add more 3D geometry.
- Add giant cell bodies.
- Render thousands of SVG paths.
- Use mesh/tube geometry for every dendrite.
- Make the page look like a neuron simulation.
- Use full Neuroglancer as an embedded dependency.
- Keep the current giant disk/halo/zoom behavior.
- Keep the thick smooth cable look.

---

## 16. Desired final look

The final homepage should feel like:

- A clean, dark connectomics map.
- Sparse real traced neuronal skeletons.
- Small glowing somas as navigation anchors.
- Thin branching arbors.
- Thin axon bundles connecting sections.
- Calm, premium, readable, smooth.

It should not look like:

- A giant moon.
- A shattered polygon sculpture.
- A sci-fi circuit board.
- A dense web of decorative confetti.
- A full data viewer.

---

## 17. Validation checklist

After implementation:

- Run lint/typecheck/build if available.
- Open the homepage and verify memory/GPU usage is reasonable.
- Verify no giant disk appears on Origin Signal.
- Verify no node covers more than 10% viewport area.
- Verify labels remain clickable.
- Verify canvas draws static skeletons smoothly.
- Verify route/detail page does not zoom into a huge soma.
- Verify terminal branches appear only on hover/focus, if implemented.
- Verify there are no React hydration warnings caused by random geometry.

---

## Final summary requested from Claude

Please summarize:

- What expensive rendering paths were removed.
- Which renderer is now used.
- How geometry is generated.
- How LOD is enforced.
- Where config limits live.
- How to tune visual density later.

---

## Visual sanity check

If any single soma or branch group covers more than about **8–12% of the viewport**, it is too large.

If any axon looks thicker than a label chip, it is too thick.

If the center looks like broken glass, delete that rendering path entirely.

The core strategy is: **Canvas-lite now, WebGL later only if needed**. Neuroglancer-scale tools win by treating neurons as data structures first and visuals second. This site should do the same: tiny skeleton arrays, capped detail, labels as HTML, no heroic glowing moon-orbs.
