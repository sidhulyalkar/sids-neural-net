# Neural Atlas Rebuild Plan

## 1. Current Architecture Summary

### Homepage

- `app/page.tsx` renders `components/neural-atlas/NeuralGraphHome.tsx`.
- The homepage is currently a client-side Framer Motion + SVG/DOM atlas, not a React Three Fiber scene.
- `NeuralGraphHome` manages hover, active category, selected leaf, palette, menu, signal overlay, and reduced-motion state locally with React state.
- `components/neural-atlas/atlas-data.ts` maps `data/generated/neural-graph.json` into curated category nodes and category-specific leaf subnetworks.
- `components/neural-atlas/DendritePath.tsx` draws SVG quadratic curves and small branch paths.
- `components/neural-atlas/NeuralNode.tsx` renders positioned DOM buttons for category and leaf neurons.
- `components/neural-atlas/SignalPropagationOverlay.tsx` provides the current full-screen electric transition.
- `app/globals.css` owns most visual tokens and atlas-specific utility classes, including panel treatments, dendrite glow, publication archive styles, and current DOM morphology classes.

### `/neural-net`

- `app/neural-net/page.tsx` parses `data/generated/neural-graph.json` through `NeuralGraphSchema`.
- `app/neural-net/NeuralNetClient.tsx` owns selected node and filter state, renders a sidebar, and passes filtered state into `components/neural-net/NeuralGraph.tsx`.
- `components/neural-net/NeuralGraph.tsx` dynamically imports `CosmographCanvas` with SSR disabled.
- `components/neural-net/CosmographCanvas.tsx` uses `@cosmograph/react` for the dense GPU graph.
- `components/neural-net/NodeInspector.tsx` shows selected node details and links to project, publication DOI, case study, or source URLs.
- This route is functional as a dense graph explorer, but it is separate from the homepage atlas experience.

### Graph Data Generation

- `scripts/build-neural-graph.ts` merges GitHub ingestion, manual project overrides, context markdown, and publications.
- GitHub data comes from `data/generated/github-repos.json`.
- Manual project metadata comes from `data/manual/project-overrides.yaml`.
- Publication metadata comes from `data/manual/publications.yaml`.
- Context/project narrative nodes come from `sids_neural_net_project_context_pack/*.md`.
- The generated graph is written to `data/generated/neural-graph.json`.
- Generated nodes have both `id` and `slug`. Edges currently use `source` and `target` as slugs.
- Current graph snapshot: 84 nodes, 582 edges, 81 projects, and 3 publications.

### Project And Publication Details

- `app/projects/[slug]/page.tsx` renders canonical project details from generated graph data.
- Project routes use `slug` for static params, lookup, canonical URL, and `/neural-net?focus=...` links.
- The related-node section should use edge `source`/`target` slugs consistently.
- `app/publications/page.tsx` filters generated graph nodes where `type === 'publication'`, sorts by publication year, enriches via `getOpenAlexPublicationEnhancements`, and renders `PublicationFocusArchive`.
- Publications do not yet have individual `/publications/[slug]` detail routes; canonical detail currently lives in the archive view and DOI/external links.

## 2. Problems To Fix

- The homepage graph is still fundamentally a DOM/SVG stage. It can be cinematic, but it is not a true spatial navigation system with 3D camera travel, depth, instancing, or shader-driven signals.
- The Cosmograph graph is separated from the homepage experience. `/neural-net` explores dense data, while the homepage uses a separate curated layer.
- Category navigation should zoom into subnetworks in-place instead of primarily behaving like route navigation.
- Leaf nodes need richer detail states with project descriptions, code explanations, publication summaries, DOI/GitHub/external links, related nodes, and optional publication/PDF cards.
- Related-node logic must use `slug` consistently because generated edges use slugs. Mixing `id` and `slug` creates empty or incorrect related sections.
- The system needs a clear visual/state architecture for travel, focus, expansion, detail, and backtracking.
- Atlas state is currently local React state. It should become a typed navigation state machine or store once the R3F version lands.
- Current graph categories are curated in code. The next version should formalize category/subnetwork metadata so category membership and layouts are easier to maintain.
- Publications are present in the generated graph, but their atlas detail treatment should be stronger and should support DOI/PMID/PMCID/OpenAlex data consistently.
- The current generated graph only has `project` and `publication` nodes, despite schemas supporting richer node types. Personal, field-note, role, organization, skill, and milestone nodes should eventually enter the graph pipeline or a curated atlas overlay.
- Mobile and reduced-motion paths need first-class design, not a degraded afterthought.

## 3. Target Architecture

### Main Component

- Add `components/neural-atlas-3d/NeuralAtlasExperience.tsx` as the new homepage entry point.
- Keep `components/neural-atlas/*` available as the accessible DOM/SVG fallback and as a source of reusable content/panel components during migration.
- Eventually update `app/page.tsx` to render the 3D experience with a dynamic import and fallback.

### Renderer Layer

- Use React Three Fiber for the main atlas renderer.
- Use Three.js primitives for:
  - neuron somas,
  - dendritic branch curves,
  - axon bundles,
  - glial particles,
  - signal particles,
  - volumetric-ish glow planes or shader materials.
- Keep DOM overlays separate from the canvas for readability, accessibility, SEO-adjacent navigation, and mobile layout.

### Graph Data Adapter

- Create a dedicated adapter under `components/neural-atlas-3d/data/` or `lib/atlas/`.
- Inputs:
  - `data/generated/neural-graph.json`,
  - curated category definitions,
  - manual subnetwork layout metadata.
- Outputs:
  - category nodes,
  - subnetwork nodes,
  - leaf nodes,
  - atlas edges,
  - canonical routes,
  - related-node lists,
  - layout positions in 3D coordinates.
- Normalize all graph references around `slug` for generated graph relationships.

### Navigation State Machine

- Add a typed state machine or lightweight Zustand store for:
  - `overview`,
  - `travelingToCategory`,
  - `categoryFocused`,
  - `expandingSubnetwork`,
  - `leafFocused`,
  - `detailOpen`,
  - `returning`.
- Store selected category slug/id, selected leaf slug, hovered node, camera target, active signal edge/path, and transition timestamps.
- Keep state serializable enough to support URL query focus later.

### DOM Overlays

- Use Framer Motion for:
  - atlas HUD,
  - command palette,
  - category readouts,
  - leaf detail drawers,
  - publication/project cards,
  - route/fallback navigation.
- Use overlays for text-heavy content. Do not put long readable text inside WebGL.

### Graceful Fallbacks

- SSR should never attempt to render WebGL-only code.
- Use dynamic imports for the R3F scene.
- Fallback to DOM/SVG atlas for:
  - reduced-motion,
  - low-power/mobile cases where needed,
  - WebGL unavailable,
  - canvas initialization failure.
- Keep `/projects`, `/projects/[slug]`, `/publications`, `/case-studies`, `/ideas`, `/photography`, `/field-notes`, `/about`, `/contact`, and `/neural-net` functional as SEO and accessibility exits.

## 4. Implementation Phases

### Phase 1: Dependencies

- Add `three`, `@react-three/fiber`, `@react-three/drei`, `zustand`, and `@types/three`.
- Confirm compatibility with Next.js 15 and React 19.
- Keep `@cosmograph/react` for `/neural-net`; do not replace it during the atlas renderer work.
- Add a small capability check for WebGL and reduced motion before mounting the 3D scene.

### Phase 2: Data Model

- Move category/subnetwork definitions into a stable adapter module.
- Define `AtlasCategoryNode`, `AtlasLeafNode`, `AtlasEdge`, `AtlasRouteTarget`, and `AtlasLayoutNode`.
- Make generated graph relationships slug-first.
- Add tests or fixture checks that every atlas leaf has a valid route and every generated edge resolves to known slugs.

### Phase 3: 3D Scene Foundation

- Create `components/neural-atlas-3d/NeuralAtlasExperience.tsx`.
- Create `NeuralAtlasScene.tsx` with a camera, lights, fog, background tissue field, and basic category nodes.
- Mount the scene through dynamic import from the homepage.
- Preserve the current DOM/SVG atlas as fallback until 3D reaches feature parity.

### Phase 4: Neuron Morphologies

- Implement reusable neuron primitives:
  - category soma,
  - pyramidal neuron,
  - stellate neuron,
  - interneuron,
  - glial accent,
  - axon bundle.
- Use instancing where possible for particles and repeated small morphology details.
- Keep sizes and colors driven by node type, importance, and category.

### Phase 5: Dendrite And Axon Curves

- Generate curve geometry from atlas edges.
- Use `TubeGeometry`, Drei curve helpers, or custom buffer geometry for axons/dendrites.
- Add branch curves for local morphology without making layout unreadable.
- Keep edge density lower in the cinematic atlas than in `/neural-net`.

### Phase 6: Signal Propagation Animation

- Add animated signal uniforms or particles traveling along selected curves.
- Keep the 1.5-2 second electric intensification as a state transition.
- Ensure text overlays dim or isolate during bright flashes so content never becomes unreadable.
- Respect `prefers-reduced-motion` by replacing travel/flash with instant focus and gentle opacity changes.

### Phase 7: Camera Travel And Subnetwork Expansion

- Define camera targets for overview, category focus, and leaf focus.
- Use state-driven camera interpolation rather than ad hoc animation calls.
- On category select:
  - trigger signal,
  - travel camera,
  - fade/expand local subnetwork,
  - update HUD/readout.
- On back:
  - collapse subnetwork,
  - restore overview camera,
  - clear leaf state.

### Phase 8: Leaf Detail Panels

- Build `AtlasLeafDetailPanel` as a DOM overlay.
- Include summary, longer description when available, tags, domains, status, GitHub metadata, DOI/PMID/PMCID, related nodes, and canonical links.
- Keep content scrollable, keyboard-dismissable, and route-aware.

### Phase 9: Publications Integration

- Map publication nodes into publication subnetworks with distinct morphology and violet visual tone.
- Include DOI, PMID, PMCID, venue, year, author list, OpenAlex enhancements, and external links.
- Consider `/publications/[slug]` for SEO-friendly individual publication pages if publication detail grows beyond the archive.

### Phase 10: Projects Integration

- Map project leaves to `/projects/[slug]`.
- Surface GitHub metadata, status, language, stars/forks, domains, tags, and related nodes.
- Keep project detail route canonical and improve atlas deep links later with `/?focus=<slug>` or `/atlas/<slug>`.

### Phase 11: SEO And Fallback Pages

- Preserve all existing readable routes.
- Add metadata where detail routes are missing or thin.
- Ensure every atlas leaf has an ordinary anchor route.
- Add fallback navigation lists for users without WebGL or with reduced motion enabled.

### Phase 12: Performance And Accessibility Polish

- Profile canvas draw calls, geometry counts, particle counts, and texture/shader cost.
- Use instancing for glial particles and repeated dendrite accents.
- Add keyboard navigation for category selection, back, command palette, and detail panels.
- Add ARIA labels for interactive DOM controls.
- Verify contrast during signal flashes.
- Test desktop, tablet, and mobile viewport framing.
- Run `npm run typecheck`, `npm run build`, and visual smoke tests after the local Node/npm environment is healthy.

## Audit Notes And Small Fixes

- `app/projects/[slug]/page.tsx` had related-node logic comparing edge slugs against node IDs. Generated edges use slugs, so the related-node lookup should compare `edge.source`/`edge.target` to `project.slug` and then resolve related nodes by `node.slug`.
- `scripts/build-neural-graph.ts` declares `CONTENT_DIR` but does not currently use it.
- `scripts/build-neural-graph.ts` creates `nodeMap` in `generateEdges` but does not currently use it.
- The graph builder only emits project and publication nodes today, although schemas and UI labels support richer node types.
- Local verification is blocked in this shell because Node/npm are not currently executable here.
