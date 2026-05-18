# Neural Atlas Portfolio: Full Implementation Plan and Agent Prompt Pack

This document is intended to live inside the `sids-neural-net` repository so Codex, Claude Code, or any other coding agent can understand the full product vision, implementation history, remaining work, and safe parallelization boundaries.

The project goal is to transform the personal website into a premium interactive 2D/3D neural atlas portfolio: a living, navigable neural-tissue-inspired interface that lets visitors explore professional work, projects, publications, research ideas, personal interests, photography, and contact information through cinematic neuron-to-neuron navigation.

---

## 0. Product North Star

The website should feel like navigating through a living neural tissue map.

The homepage begins in a large 2D/3D neural space. At the center are major category neuron cell bodies representing:

- About / Identity
- Professional Work / Deployed Systems
- Projects / Code
- Publications / Papers
- Research Ideas
- Personal Interests
- Photography / Field Notes
- Contact

When a category neuron is selected:

- The camera smoothly zooms toward it.
- An electric signal visibly propagates along a dendrite/axon path.
- The visual field briefly intensifies with purple/blue/white electric energy.
- The view arrives at a subnetwork of related child neurons.
- Subnetworks include varied neuron morphologies: pyramidal neurons, stellate neurons, interneuron-like nodes, glial particle fields, dendritic branches, axon bundles, and abstract neural clusters.

When a leaf neuron is selected:

- The camera zooms further into the neuron.
- A readable detail chamber/panel opens.
- Leaf nodes can represent project descriptions, code explanations, publication summaries, case studies, research ideas, photography/field-note entries, external links, or contact/collaboration entries.

The final experience should feel:

- mysterious but elegant,
- scientifically inspired,
- technically impressive,
- readable and useful,
- performant,
- accessible,
- polished enough to impress researchers, recruiters, collaborators, and founders.

Think of it as a tiny cyber-neuroscience cathedral that still helps someone quickly find projects, papers, GitHub, background, and contact information.

---

## 1. Current Parallel Development Context

At the time this document was created:

- Codex has completed Prompts 1-8.
- Codex is currently working on Prompt 9.
- Claude Code may be asked to work in parallel on non-conflicting tasks.

Agents should inspect the repository and commit history before making changes:

```bash
git status
git log --oneline --decorate -n 30
git diff
git branch
npm run typecheck
npm run build
```

Use the commit history as the source of truth for what has already been implemented.

Do not restart the project from scratch. Preserve the architecture already built unless it is clearly broken.

---

## 2. Expected Architecture

The intended architecture is a hybrid spatial-interface system:

- **React Three Fiber / Three.js**: living neural world, neuron morphologies, dendrites, signal propagation, spatial camera travel.
- **Framer Motion / DOM overlays**: readable panels, breadcrumbs, detail chambers, command palette, accessibility controls, transition overlays.
- **Zustand or lightweight store**: navigation state machine.
- **Generated graph data**: content source from `data/generated/neural-graph.json`.
- **Curated atlas adapter**: maps generated content into a story-driven atlas of categories, subnetworks, and leaf nodes.
- **Existing Next.js routes**: SEO, fallback, archive, and direct-link pages.
- **`/neural-net` route**: full power-user graph archive, separate from the cinematic homepage atlas.

Mental model:

- Three.js/R3F = living neural tissue and navigation space.
- Zustand/store = navigation state machine.
- DOM overlay = cockpit HUD, breadcrumbs, readable details, accessibility controls.
- Existing routes = SEO/fallback/archive pages.
- Generated graph data = content source.
- Curated atlas adapter = story layer.

Avoid:

- hard-coded one-off animation chains,
- a single giant component,
- tiny unreadable 3D text as primary content,
- over-bright glow that ruins readability,
- showing every generated node at once,
- breaking existing project/publication routes,
- mixing slug/id inconsistently.

---

## 3. Files and Areas That May Exist After Prompts 1-8

Agents should verify exact paths in the repo. Likely key areas:

```text
app/page.tsx
app/layout.tsx
app/globals.css
app/neural-net/NeuralNetClient.tsx
app/projects/[slug]/page.tsx
app/publications/page.tsx
app/case-studies/[slug]/page.tsx
components/neural-atlas-3d/
components/neural-atlas-3d/NeuralAtlasExperience.tsx
components/neural-atlas-3d/NeuralAtlasCanvas.tsx
components/neural-atlas-3d/NeuralAtlasScene.tsx
components/neural-atlas-3d/NeuralAtlasOverlay.tsx
components/neural-atlas-3d/atlasTypes.ts
components/neural-atlas-3d/atlasStore.ts
components/neural-atlas-3d/atlasDataAdapter.ts
components/neural-atlas-3d/morphology/
components/neural-atlas-3d/graph/
components/neural-atlas-3d/camera/
components/neural-atlas-3d/panels/
components/neural-net/
data/generated/neural-graph.json
data/manual/publications.yaml
data/manual/project-overrides.yaml
content/case-studies/
content/context/
```

---

## 4. Parallel Work Warning

If Codex is actively implementing Prompt 9, other agents should avoid editing files likely touched by Prompt 9:

```text
components/neural-atlas-3d/panels/LeafDetailPanel.tsx
components/neural-atlas-3d/panels/CategoryPreviewPanel.tsx
components/neural-atlas-3d/panels/BreadcrumbTrail.tsx
components/neural-atlas-3d/NeuralAtlasOverlay.tsx
components/neural-atlas-3d/atlasDataAdapter.ts
components/neural-atlas-3d/atlasTypes.ts
app/projects/[slug]/page.tsx
```

Safe parallel work during Prompt 9:

- Improve `/neural-net` as the Full Neural Graph Archive.
- Add QA docs.
- Add remaining-polish docs.
- Add storytelling/copy brief docs.
- Run typecheck/build and document failures.
- Make tiny isolated fixes outside Prompt 9 collision files.

Avoid implementing Prompt 10, Prompt 11, or Prompt 15 directly if those changes require editing `atlasDataAdapter.ts`, detail panels, or overlay files while Prompt 9 is in progress.

---

## 5. Recommended Implementation Order

1. Scaffold R3F architecture without deleting old code.
2. Create the atlas data adapter.
3. Render root category neurons.
4. Add signal propagation.
5. Add camera transition into category subnetworks.
6. Add leaf detail panels.
7. Integrate publications/papers and project links.
8. Curate category subnetworks.
9. Polish performance, mobile, and reduced motion.
10. Make `/neural-net` the full archive instead of the main experience.
11. Final storytelling/copy polish.

---

# Prompt Pack

The following prompts are the complete implementation sequence.

---

## Prompt 1: Master Rebuild Direction

```text
You are working in my Next.js 15 / React 19 / TypeScript portfolio repo called sids-neural-net.

My goal is to rebuild the website into a premium 2D/3D interactive neural atlas. The site should feel like navigating through a living neural tissue map: mysterious, elegant, cinematic, scientific, and readable. This should not feel like a generic portfolio, starfield, or node graph. It should feel like a handcrafted neuroscience-inspired spatial interface.

Current repo context:
- Home page is app/page.tsx and currently renders components/neural-atlas/NeuralGraphHome.tsx.
- There is also a larger /neural-net route using @cosmograph/react in components/neural-net.
- Generated data exists in data/generated/neural-graph.json.
- Manual publication data exists in data/manual/publications.yaml.
- Project/content sources include content/case-studies, content/context, data/manual/project-overrides.yaml, and GitHub ingestion scripts.
- Existing visual components include components/neural-atlas/DendritePath.tsx, NeuralNode.tsx, SignalPropagationOverlay.tsx, registry.ts, etc.
- Existing style tokens live in app/globals.css and tailwind.config.ts.
- The current visual language is cyan/violet/white/electric on deep navy/black. Preserve that palette, but make it more refined and less flat.

New product vision:
The entire site should begin as a large 2D/3D navigable neural space. At the center are several large category neuron cell bodies:
1. About / Identity
2. Professional Work
3. Projects / Code
4. Publications / Papers
5. Research Ideas
6. Personal Interests
7. Photography / Field Notes
8. Contact

When a category neuron is selected:
- The camera should smoothly zoom toward it.
- An electric signal should visibly propagate along the connected axon/dendrite path.
- The screen should briefly intensify with purple/blue/white electric lighting for about 1.5 to 2 seconds.
- The view should arrive at a new subnetwork around the selected category.
- Each subnetwork should have more realistic and varied neuron morphologies, such as pyramidal neurons, stellate cells, interneuron-like nodes, small glial accent particles, axon bundles, dendritic branches, etc.
- Category neurons lead to subnetworks.
- Leaf neurons do not lead to another graph. Instead, selecting a leaf neuron zooms into the neuron and reveals a highly readable detail view containing:
  - project descriptions,
  - code explanations,
  - paper summaries,
  - DOI / GitHub / external links,
  - related nodes,
  - optionally embedded paper PDFs or publication cards.

This should be a real showcase of technical and design taste. It should demonstrate:
- advanced WebGL/Three.js/R3F rendering,
- performant graph layout,
- smooth state-driven camera motion,
- readable content overlays,
- strong accessibility fallbacks,
- good SEO for detail routes,
- reduced-motion support,
- mobile responsiveness,
- maintainable architecture.

Important implementation direction:
Use a hybrid architecture:
- React Three Fiber / Three.js for the main neural spatial experience.
- Framer Motion for DOM overlays, readable panels, command palette, and transitions.
- Zustand or a lightweight reducer/store for navigation state.
- Data-driven node definitions derived from existing generated graph data plus curated category/subnetwork metadata.
- Use shader-style materials or animated tube/curve materials for electric signal propagation.
- Keep /projects, /publications, /case-studies, etc. functional for SEO and fallback navigation, but make the homepage the cinematic atlas entrypoint.
- Do not remove the existing data ingestion pipeline unless replacing it with a better one.
- Do not hard-code a tiny fake graph. Build a curated atlas layer on top of the existing graph.

Before making large edits:
1. Inspect the current file structure.
2. Identify the current graph and content flow.
3. Create a concise implementation plan in a new file called docs/NEURAL_ATLAS_REBUILD_PLAN.md.
4. Then implement the rebuild in phases with small, working commits.

Quality bar:
- No broken routes.
- No TypeScript errors.
- No hydration errors.
- No unreadable text over bright effects.
- No giant monolithic component.
- No purely decorative graph that cannot navigate real content.
- Prefer elegant abstractions over one-off animation hacks.
- Preserve the current content and personal/professional positioning, but make the experience feel much more premium and memorable.
```

---

## Prompt 2: Audit and Plan Before Coding

```text
Before modifying the visual system, audit the repo and write a concrete rebuild plan.

Please inspect:
- app/page.tsx
- app/layout.tsx
- app/globals.css
- components/neural-atlas/*
- components/neural-net/*
- lib/data/schemas.ts
- scripts/build-neural-graph.ts
- data/generated/neural-graph.json
- data/manual/publications.yaml
- data/manual/project-overrides.yaml
- app/projects/[slug]/page.tsx
- app/publications/page.tsx

Then create docs/NEURAL_ATLAS_REBUILD_PLAN.md with:

1. Current architecture summary
   - How homepage works now
   - How /neural-net works now
   - How graph data is generated
   - How project/publication details are rendered

2. Problems to fix
   - The homepage graph is currently static SVG and not a true spatial navigation system
   - The Cosmograph graph is separated from the homepage experience
   - Category navigation currently routes to separate pages instead of zooming into subnetworks
   - Leaf nodes need rich detail states
   - Related-node logic should use slug consistently, not mix slug and id
   - Need a true visual/state architecture for travel, focus, expansion, and detail

3. Target architecture
   - A new main component: components/neural-atlas-3d/NeuralAtlasExperience.tsx
   - A renderer layer using React Three Fiber
   - A graph data adapter that maps generated graph nodes into curated category/subnetwork/leaf nodes
   - A navigation state machine
   - DOM overlay panels for readability
   - graceful fallbacks for mobile/reduced-motion/SSR

4. Implementation phases
   - Dependencies
   - Data model
   - 3D scene foundation
   - Neuron morphologies
   - Dendrite/axon curves
   - Signal propagation animation
   - Camera travel and subnetwork expansion
   - Leaf detail panels
   - Publications integration
   - Projects integration
   - SEO/fallback pages
   - Performance/accessibility polish

Do not implement the full rebuild yet in this prompt. Just create the plan and fix any obvious small bugs found during audit only if they are low risk.
```

---

## Prompt 3: Install Rendering/State Dependencies

```text
Implement the dependency and scaffolding phase for the neural atlas rebuild.

Add the following dependencies if not already present:
- three
- @react-three/fiber
- @react-three/drei
- @react-three/postprocessing
- zustand

Keep existing dependencies such as framer-motion, @cosmograph/react, Tailwind, etc. Do not remove the old graph components yet.

Create a new folder:

components/neural-atlas-3d/

Inside it, scaffold these files:

- index.ts
- NeuralAtlasExperience.tsx
- NeuralAtlasCanvas.tsx
- NeuralAtlasScene.tsx
- NeuralAtlasOverlay.tsx
- NeuralAtlasFallback.tsx
- NeuralAtlasLoading.tsx
- atlasTypes.ts
- atlasStore.ts
- atlasDataAdapter.ts
- visualConstants.ts
- morphology/
  - SomaMesh.tsx
  - PyramidalNeuron.tsx
  - StellateNeuron.tsx
  - Interneuron.tsx
  - GlialParticleField.tsx
- graph/
  - DendriteCurve.tsx
  - SignalPulse.tsx
  - NeuralNode3D.tsx
  - NeuralSubnetwork.tsx
- camera/
  - CameraRig.tsx
  - cameraTargets.ts
- panels/
  - CategoryPreviewPanel.tsx
  - LeafDetailPanel.tsx
  - BreadcrumbTrail.tsx
  - AtlasCommandPalette.tsx

Requirements:
- Components can initially be minimal but must compile.
- Use dynamic import for the R3F experience from app/page.tsx or a client wrapper to avoid SSR issues.
- Keep app/page.tsx rendering a working page.
- Add a fallback for reduced motion or WebGL unavailable.
- Run npm run typecheck.
- Fix any TypeScript errors.
- Commit with message: "Scaffold 3D neural atlas architecture".
```

---

## Prompt 4: Define the Atlas Data Model

```text
Implement the data model for the new neural atlas.

Create a robust TypeScript model in components/neural-atlas-3d/atlasTypes.ts.

The atlas should distinguish:

Node kinds:
- root
- category
- subcategory
- leaf

Leaf content types:
- project
- publication
- case-study
- field-note
- idea
- photography
- contact
- external

Neuron morphologies:
- soma
- pyramidal
- stellate
- interneuron
- purkinje-inspired
- glial
- axon-terminal

Node fields:
- id
- slug
- title
- shortLabel
- summary
- kind
- contentType
- morphology
- category
- parentId
- childrenIds
- relatedIds
- position: { x, y, z }
- scale
- color
- route
- externalUrl
- sourceNodeSlug for nodes derived from data/generated/neural-graph.json
- publication metadata if publication
- github metadata if project
- tags
- domains
- importance
- featured
- hiddenUntilParentFocused boolean

Edge fields:
- id
- source
- target
- relation
- strength
- curveType
- color
- signalDelay
- dendriteBranches
- visibleInStates

Navigation state:
- level: root | category | detail
- activeCategoryId
- activeNodeId
- selectedLeafId
- cameraMode: overview | traveling | category | detail
- signalPath: string[] or active edge id
- transitionPhase: idle | charging | traveling | arriving | reading

Now implement atlasDataAdapter.ts:
- Import data/generated/neural-graph.json and validate with NeuralGraphSchema.
- Create a curated root graph with central category neurons:
  - about
  - professional-work
  - projects
  - publications
  - research-ideas
  - personal-interests
  - photography
  - contact
- Map generated nodes into categories using domains, tags, type, cluster, title, and source.
- Publications from generated graph should become leaf nodes under publications.
- GitHub/project nodes should become leaf nodes under projects or professional-work depending on domains/tags/importance.
- Context-doc nodes about DataJoint, Harvard Sabatini, NEATLABs, Allen Mindscope, Lu Lab, etc. should become professional-work leaf nodes.
- Mechanistic interpretability, BCI, neuroFMx, neurOS, foundation model nodes should appear under research-ideas and projects as appropriate.
- Personal nodes should appear under personal-interests/photography.
- Include a small curated set of hand-authored category descriptions.
- Avoid duplicate leaf nodes by slug.
- Output an AtlasGraph object with nodes and edges.

Important:
- The root graph should start with only category neurons visible.
- When a category is focused, reveal its children/subnetwork.
- Leaf nodes should carry enough content to render a detail panel without navigating away.
- Keep route fields so a detail can link to /projects/[slug], /publications, /case-studies/[slug], or external URLs.
- Run typecheck.
- Commit with message: "Add data-driven atlas graph model".
```

---

## Prompt 5: Build the R3F Canvas Foundation

```text
Build the first working 3D neural atlas scene.

Replace the homepage experience with a dynamic import of NeuralAtlasExperience, but keep a graceful fallback.

Implementation requirements:
- app/page.tsx should render the new NeuralAtlasExperience.
- NeuralAtlasExperience should:
  - load the adapted AtlasGraph,
  - render NeuralAtlasCanvas,
  - render NeuralAtlasOverlay,
  - render NeuralAtlasFallback if prefers-reduced-motion is true or WebGL fails.
- NeuralAtlasCanvas should use @react-three/fiber Canvas.
- Use orthographic or perspective camera, whichever feels better for 2D/3D hybrid navigation. Prefer perspective with shallow depth, but keep text/panels in DOM.
- Scene should have:
  - deep navy/black background,
  - subtle volumetric dust / particle field,
  - root category neurons arranged around a central “about / signal origin” soma,
  - curved dendrite/axon connections between category neurons,
  - bloom/postprocessing if performant,
  - ambient and point lighting with cyan/violet accents.
- Do not render readable text inside Three.js except tiny optional labels. Use DOM overlays for readable content.
- Nodes should be clickable and keyboard-accessible via mirrored DOM controls in overlay.
- Add hover state with subtle glow and dendrite highlight.
- Add selected state.
- The first version only needs root-level navigation and hover/select. Subnetwork expansion comes later.

Visual tone:
- Elegant, mysterious, scientific.
- Avoid cheesy neon overload.
- Nodes should look like organic cell bodies, not plain circles.
- Edges should feel like dendrites/axons, not graph lines.
- Make it feel spatial: slight parallax, depth offsets, soft focus.

Performance:
- Keep geometry counts reasonable.
- Use memoization for generated curves/geometries.
- Avoid re-render storms in pointer move handlers.
- Ensure it runs smoothly on a normal laptop.

Run:
- npm run typecheck
- npm run build if feasible

Commit:
"Render root 3D neural atlas experience"
```

---

## Prompt 6: Implement Neuron Morphologies

```text
Upgrade the node rendering from simple spheres/circles to realistic abstract neuron morphologies.

Files to implement:
- morphology/SomaMesh.tsx
- morphology/PyramidalNeuron.tsx
- morphology/StellateNeuron.tsx
- morphology/Interneuron.tsx
- morphology/GlialParticleField.tsx
- graph/NeuralNode3D.tsx

Requirements:
1. SomaMesh
   - Organic cell-body shape using layered spheres/metaball-like visual approximation or distorted geometry.
   - Use shader/noise-like distortion if practical.
   - Accept color, scale, active, hovered, selected props.
   - Should have inner glow and rim glow.

2. PyramidalNeuron
   - Triangular/pyramidal soma suggestion.
   - Apical dendrite projecting upward.
   - Branching basal dendrites.
   - Use curves/tubes for dendrites.
   - Good for professional/research/project nodes.

3. StellateNeuron
   - Star-like branching morphology.
   - Good for ideas/personal/creative nodes.

4. Interneuron
   - Compact soma with dense local branches.
   - Good for publications or smaller leaf details.

5. GlialParticleField
   - Ambient small particles, slow drift, non-distracting.
   - Use instancing if possible.

6. NeuralNode3D
   - Chooses morphology based on node.morphology.
   - Handles pointer events.
   - Emits hover/select callbacks to atlasStore.
   - Scales visual prominence based on importance and kind.
   - Category nodes must be larger than leaf nodes.
   - Leaf nodes must still be visually distinct.

Visual quality:
- Branches should be organic and varied. Avoid perfectly symmetrical toy shapes.
- Add seeded randomness so positions are stable across renders.
- The result should feel abstract-scientific rather than medical-diagram literal.
- Use cyan/violet/white/rose/green/amber accents according to category.

Accessibility:
- Do not rely only on color. Overlay panels should label active node.
- Reduced motion should show static high-quality layout.

Commit:
"Add abstract neuron morphologies for atlas nodes"
```

---

## Prompt 7: Implement Dendrite Curves and Electric Signal Propagation

```text
Implement the dendrite/axon rendering and click-travel signal animation.

Files:
- graph/DendriteCurve.tsx
- graph/SignalPulse.tsx
- visualConstants.ts
- atlasStore.ts

Requirements:
1. DendriteCurve
   - Render edges as 3D CatmullRom curves or cubic Bezier tubes.
   - Curves should have slight z-depth variation.
   - Each edge should support small side branches/twigs.
   - Edge appearance changes when source/target is hovered/active.
   - Edges should be faint at rest and brighten during signal propagation.

2. SignalPulse
   - When user selects a category or leaf node, animate a bright electric pulse along the path.
   - The pulse should travel along the selected curve, not just flash the whole screen.
   - Pulse should be white-hot core with cyan/violet bloom.
   - Add secondary small pulses trailing behind the main pulse.
   - Total travel/electric transition should take around 1.5-2 seconds for category transitions.
   - Respect prefers-reduced-motion by skipping travel and directly focusing.

3. Store/state
   - atlasStore should model transition phases:
     idle -> charging -> traveling -> arriving -> category/detail
   - Store active signal edge/path, active node, active category, selected leaf.
   - Prevent double-click chaos during transition.
   - Allow Escape or Back to return to previous level.

4. Overlay
   - During propagation, briefly show subtle text such as:
     "signal propagation"
     selected node title
   - Keep it tasteful and brief.
   - Avoid blocking the whole experience for too long.

5. Visual polish
   - Add a short global electric flare during arrival, but readable content must never remain washed out.
   - Use color harmonies by category:
     Publications: violet/white
     Projects: cyan/blue
     Professional: cyan/green
     Research Ideas: green/violet
     Photography: rose/amber
     Personal: amber/rose
     Contact: blue/white

Commit:
"Animate dendrite signal propagation"
```

---

## Prompt 8: Camera Travel and Subnetwork Expansion

```text
Implement the core navigation behavior: selecting a category zooms into that category and reveals its subnetwork.

Files:
- camera/CameraRig.tsx
- camera/cameraTargets.ts
- graph/NeuralSubnetwork.tsx
- NeuralAtlasScene.tsx
- atlasStore.ts
- NeuralAtlasOverlay.tsx

Behavior:
1. Root overview
   - Shows central about/signal-origin neuron plus category neurons.
   - Only root/category nodes are prominent.
   - Leaf nodes are hidden or faint ghost particles.

2. Category selection
   - On click/category select:
     - trigger signal propagation,
     - camera smoothly travels toward the category neuron,
     - surrounding root graph drifts/fades into background,
     - child nodes/subnetwork bloom into visibility around that category.
   - The transition should feel like moving along an axon into a connected neural neighborhood.
   - Use camera position, target, fov/zoom, and depth-of-field/bloom changes if possible.

3. Category view
   - Shows selected category neuron plus child leaf/subcategory neurons.
   - Child neurons arranged in a biologically inspired cluster, not a boring grid.
   - Edges should connect child nodes to category and related child nodes.
   - A breadcrumb overlay should show:
     Sid Neural Net / Projects
     or
     Sid Neural Net / Publications
   - Include a Back to Cortex / Overview button.

4. Leaf selection
   - Selecting a leaf node should zoom further into that neuron.
   - It should not navigate away automatically.
   - It should open a readable detail panel in the DOM.
   - The detail panel should feel embedded in the neuron/cell membrane, but text must be clean and readable.

5. URL state
   - Update URL query or hash when selecting category/leaf, e.g.
     /?atlas=projects
     /?atlas=projects&node=neuros-v1
   - On page load, parse query and open the right category/node.
   - Do this without breaking SSR.
   - Keep regular routes like /projects/[slug] available as fallback/detail links.

6. Keyboard controls
   - Escape goes back one level.
   - Arrow keys can cycle visible nodes if straightforward.
   - Enter selects focused overlay node.
   - Make overlay controls accessible.

7. Motion quality
   - Use damped interpolation, not abrupt jumps.
   - Avoid motion sickness by keeping travel smooth and short.
   - Respect reduced motion.

Commit:
"Add camera travel and subnetwork navigation"
```

---

## Prompt 9: Leaf Detail Panel for Projects, Papers, and Code Explanations

```text
Build the detail reading experience when a leaf neuron is selected.

Files:
- panels/LeafDetailPanel.tsx
- panels/CategoryPreviewPanel.tsx
- panels/BreadcrumbTrail.tsx
- NeuralAtlasOverlay.tsx
- atlasDataAdapter.ts if data fields need expansion

LeafDetailPanel requirements:
- Render a large readable panel with a glass/organic membrane style.
- It should appear after the camera arrives at the leaf neuron.
- It must support these content types:
  1. project
  2. publication
  3. case-study
  4. idea
  5. photography
  6. contact/external

Project leaves should show:
- title
- summary
- longer description if available
- why it matters
- technologies/tags
- GitHub link if available
- internal project detail link: /projects/[slug]
- related nodes

Publication leaves should show:
- title
- authors
- year
- venue
- DOI link
- PMID/PMCID if available
- my contribution section if available or a placeholder field in curated data
- a readable 3-5 bullet summary
- internal publication page link
- optional paper embed support if a local PDF exists in public/papers

Code/project explanation leaves should show:
- project summary
- architecture highlights
- representative modules/files if available from metadata
- “What this demonstrates” section aimed at recruiters/researchers
- GitHub link

Case-study leaves should show:
- title
- MDX summary if available
- link to /case-studies/[slug]

UI:
- Include buttons:
  - Open full page
  - Open GitHub / DOI / external
  - Related nodes
  - Back to subnetwork
- Use typography that is extremely readable.
- Do not put paragraphs directly on top of bright visual effects.
- Use Framer Motion for panel entrance/exit.
- Keep panel width responsive:
  - desktop: side panel or centered reading chamber
  - mobile: bottom sheet

Bug fix:
- In app/projects/[slug]/page.tsx, related node lookup appears to compare edge.source/target with project.id even though generated edges use slugs. Fix related lookup to use project.slug consistently.

Commit:
"Add rich leaf detail panels for atlas nodes"
```

---

## Prompt 10: Publication and Paper Integration

```text
Improve publication integration so publication neurons feel like real paper chambers.

Inspect:
- data/manual/publications.yaml
- app/publications/page.tsx
- components/publications/*
- data/generated/neural-graph.json
- atlasDataAdapter.ts
- LeafDetailPanel.tsx

Implement:
1. Extend publication metadata model if needed:
   - abstract
   - contribution
   - methods
   - keyFindings
   - localPdfPath
   - externalLinks
   - relatedProjects
   - image/figure placeholder fields

2. Update data/manual/publications.yaml with curated fields for existing publications:
   - Keep DOI/PMID/PMCID.
   - Add short summaries.
   - Add "myContribution" where known from existing context.
   - Add "whyItMatters" for portfolio storytelling.
   - Do not fabricate scientific claims. Use cautious, accurate phrasing.

3. Publication neuron behavior:
   - Publications category opens a violet-toned archive subnetwork.
   - Each paper leaf uses an interneuron or pyramidal morphology.
   - Selecting a paper zooms into a readable paper chamber.
   - If local PDF exists under public/papers/[slug].pdf, show an embedded PDF preview iframe.
   - If no local PDF exists, show DOI/PMCID/PMID links and a clean citation card.
   - Include a “copy citation” button if easy.

4. Page consistency:
   - /publications should still work as a normal route.
   - The atlas publication detail panel should link to /publications or DOI.
   - Do not remove existing PublicationFocusArchive unless replacing it with better code.

5. Accessibility:
   - Embedded PDF must have title attribute.
   - External links must have clear labels.

Commit:
"Integrate publication neurons with paper detail chambers"
```

---

## Prompt 11: Category Subnetworks and Content Curation

```text
Curate the atlas subnetworks so the experience tells a strong story.

Update atlasDataAdapter.ts and any curated metadata files so each category has high-quality children.

Categories:

1. About / Identity
   - Summary of who I am
   - Key identity nodes:
     - neuroscience data systems
     - applied AI scientist/engineer
     - multimodal ML
     - real-time systems
     - creative builder
     - outdoors/photography/Shasta

2. Professional Work
   - DataJoint
   - Harvard Sabatini pipeline
   - Allen Mindscope
   - Lu Lab DeepLabCut/Facemap
   - NEATLABs
   - Dolby Labs
   - Panoptic Bio
   - Paradromics/BCI instrumentation context if present
   - Focus: credibility, deployed systems, research infrastructure

3. Projects / Code
   - neurOS-v1
   - NeuroForge
   - BCI-DL-classifier
   - neuroFMx
   - neuros-mechint
   - PetPath/PetNet
   - DataJoint Elements / element-deeplabcut / element-facemap
   - Other strong GitHub projects
   - Focus: code artifacts and engineering taste

4. Publications / Papers
   - all publication nodes from data/manual/publications.yaml
   - Focus: peer-reviewed work, neural behavior, electrophysiology

5. Research Ideas
   - brain foundation models
   - mechanistic interpretability for neural models
   - session stitching
   - neural latent search
   - BCI middleware
   - closed-loop VR / primate neural experiments
   - astrocyte modeling if present
   - Focus: speculative but grounded research agenda

6. Personal Interests
   - mountain biking
   - skiing
   - hiking/adventure
   - Shasta
   - food/cooking
   - anime/comedy/media if present
   - Focus: personality without diluting professional polish

7. Photography / Field Notes
   - landscape/texture/timing concept
   - travel nodes
   - Shasta/action/outdoors
   - future Google Photos curation placeholder
   - Focus: artistic eye and field attention

8. Contact
   - collaboration
   - roles
   - research conversations
   - applied AI systems
   - link to email/LinkedIn/GitHub

Rules:
- Each category should have 6-14 child nodes initially.
- Very large categories can have subcategory nodes.
- Avoid overwhelming the user with 80 nodes at once.
- Use importance to decide which nodes are visible first.
- Low-priority nodes can exist but should be hidden behind "show more signal".
- Related cross-category edges should exist but be visually subtle.
- Each category should have a distinct color/mood while preserving the global palette.

Commit:
"Curate category subnetworks for portfolio storytelling"
```

---

## Prompt 12: Make the Homepage Feel Premium and Complete

```text
Polish the homepage atlas into a complete portfolio landing experience.

Requirements:
1. Initial load
   - Start with a cinematic but fast intro.
   - A few central category neurons should appear first.
   - Dendrites should draw in organically.
   - Do not delay interactivity more than ~1 second.
   - Include skip/reduced-motion behavior.

2. Hero copy overlay
   - Minimal, elegant overlay:
     "Sidharth Hulyalkar"
     "Applied AI scientist/engineer building neural data systems, multimodal ML infrastructure, and strange useful interfaces."
   - Include small actions:
     - Enter the atlas
     - Projects
     - Publications
     - Contact
   - The overlay should not dominate the graph. It should feel like a navigation HUD.

3. Category preview
   - Hovering/focusing a category shows short preview copy in a side/bottom panel.
   - Include 2-3 representative child nodes.
   - Include "Follow signal" button.

4. Visual style
   - Keep deep navy/black base.
   - Use electric cyan/violet/white with restraint.
   - Add subtle procedural dust and light falloff.
   - Nodes should have organic texture and slight depth.
   - Dendrites should feel alive but not noisy.
   - Text must be crisp.

5. Header/footer
   - Decide whether global Header/Footer should be hidden or transformed on homepage.
   - The atlas homepage likely needs an immersive mode with a minimal floating nav rather than the standard Header/Footer.
   - Keep normal Header/Footer on other pages.
   - Implement cleanly in layout/page composition.

6. Responsiveness
   - Desktop: full cinematic atlas.
   - Tablet: simplified 3D with fewer particles.
   - Mobile: 2D/DOM fallback or simplified canvas where category neurons are still clickable.
   - Reduced motion: static atlas with direct open panels.

7. Do not break existing pages.
8. Run typecheck and build.

Commit:
"Polish immersive neural atlas homepage"
```

---

## Prompt 13: Preserve and Improve the Full `/neural-net` Route

```text
The new homepage atlas is curated and cinematic. Keep /neural-net as a separate power-user data graph, but make it visually consistent.

Inspect:
- app/neural-net/NeuralNetClient.tsx
- components/neural-net/*
- components/neural-atlas-3d visual constants

Tasks:
1. Rename user-facing copy from "Full data graph" to something like "Full Neural Graph Archive".
2. Keep Cosmograph because it is useful for large graph exploration.
3. Make colors, labels, and panel styles align with the new atlas.
4. Add support for URL focus query:
   /neural-net?focus=neuros-v1
   It should select/focus the corresponding node if Cosmograph supports it. If not, open the inspector for that node and show a clear label.
5. Fix selectedNodeId bug if needed:
   Current code passes selectedNode?.id, but many graph operations use slug. Standardize selection on slug unless there is a strong reason not to.
6. Add a CTA back to the cinematic atlas:
   "Return to Atlas"
7. Keep filters and inspector functional.
8. Run typecheck.

Commit:
"Align full neural graph archive with atlas experience"
```

---

## Prompt 14: Performance, Accessibility, and Production Hardening

```text
Do a production hardening pass for the neural atlas.

Performance:
- Memoize generated geometries/curves.
- Avoid unnecessary state updates during pointer movement.
- Use instanced meshes for particles/ambient points if possible.
- Reduce particle count and postprocessing on mobile.
- Lazy-load the 3D atlas.
- Ensure initial JS bundle does not explode unnecessarily.
- Add a simple WebGL capability fallback.

Accessibility:
- Respect prefers-reduced-motion.
- Make all category and leaf nodes reachable through DOM overlay controls.
- Add keyboard navigation:
  - Tab through visible nodes
  - Enter selects
  - Escape backs out
- Ensure focus styles are visible.
- Ensure text contrast passes common sense standards.
- Do not rely only on color.
- Use aria labels for node controls and panels.

Reliability:
- No hydration errors.
- No broken route links.
- No TypeScript errors.
- No console errors during normal navigation.
- Existing routes still work:
  - /
  - /projects
  - /projects/[slug]
  - /publications
  - /case-studies
  - /case-studies/[slug]
  - /neural-net
  - /about
  - /contact
  - /photography
  - /ideas
  - /timeline

Testing:
- Run npm run typecheck.
- Run npm run build.
- If lint script is broken because of Next 15/ESLint config, document it and fix if reasonable.
- Add docs/ATLAS_QA_CHECKLIST.md with manual QA steps:
  - root navigation
  - category transition
  - leaf detail
  - back navigation
  - mobile
  - reduced motion
  - direct URL state
  - publication link
  - project GitHub link

Commit:
"Production harden neural atlas experience"
```

---

## Prompt 15: Final Storytelling Polish

```text
Do a final storytelling/design polish pass.

Goal:
The site should make visitors think:
"This person builds serious neural/AI systems, but also has unusually strong creative taste."

Tasks:
1. Review all homepage/category/leaf copy.
   - Remove generic portfolio language.
   - Make the writing precise, confident, and slightly poetic without being corny.
   - Emphasize:
     - neuroscience data infrastructure,
     - multimodal ML,
     - foundation models for neural data,
     - mechanistic interpretability,
     - real-time/BCI systems,
     - applied AI product work,
     - photography/adventure as perceptual craft.

2. Improve category labels:
   - Professional Work could be "Deployed Systems"
   - Projects / Code could be "Build Cortex"
   - Publications could be "Paper Archive"
   - Research Ideas could be "Speculative Circuits"
   - Personal Interests could be "Field Inputs"
   - Photography could be "Visual Field Notes"
   Use tasteful labels, but keep clarity.

3. Add subtle microcopy:
   - "follow signal"
   - "return to cortex"
   - "open chamber"
   - "related synapses"
   Use sparingly.

4. Ensure the first 10 seconds of the site are compelling:
   - Name visible
   - Role clear
   - Main categories clear
   - Interaction obvious
   - Motion elegant
   - No wall of text

5. Add a short "How to navigate" hint:
   - click a neuron
   - follow the signal
   - escape returns

6. Make sure recruiter/researcher visitors can still quickly find:
   - resume-ish summary/about
   - projects
   - publications
   - contact
   - GitHub/LinkedIn

Commit:
"Refine atlas storytelling and interaction copy"
```

---

# Parallel Claude Code Prompt While Codex Works on Prompt 9

Use this when Claude needs to work in parallel while Codex is currently implementing Prompt 9.

```text
You are Claude Code working inside my Next.js / React / TypeScript personal website repo: sids-neural-net.

This project is being rebuilt into a premium, cinematic, interactive neural atlas portfolio.

IMPORTANT CONTEXT:
Codex has already completed Prompts 1-8 of the neural atlas rebuild and is currently working in parallel on Prompt 9, which is focused on rich leaf detail panels for projects, publications, code explanations, and related node behavior.

Your job right now is to continue making progress efficiently WITHOUT causing merge conflicts with Codex’s active Prompt 9 work.

You may inspect the full repo, commit history, and current branch state to understand what has changed so far. Please use the commit history as a source of truth for what Codex has already completed.

Start by running commands such as:

- git status
- git log --oneline --decorate -n 20
- git diff
- git branch
- npm run typecheck, if available
- npm run build, if reasonable

Do not blindly rewrite or restart the work. Preserve the architecture Codex has built unless it is clearly broken.

PROJECT END GOAL:
The website should become a large 2D/3D interactive neural atlas. It should begin in a living neural-tissue-like space with major category neuron cell bodies. Selecting a category should trigger camera travel, electric signal propagation, and reveal a category subnetwork. Selecting a leaf neuron should open a readable detail chamber/panel. The result should feel mysterious, elegant, scientific, premium, useful, accessible, and performant.

PARALLEL WORK WARNING:
Codex is currently working on Prompt 9.

Prompt 9 likely touches or may touch:

- components/neural-atlas-3d/panels/LeafDetailPanel.tsx
- components/neural-atlas-3d/panels/CategoryPreviewPanel.tsx
- components/neural-atlas-3d/panels/BreadcrumbTrail.tsx
- components/neural-atlas-3d/NeuralAtlasOverlay.tsx
- components/neural-atlas-3d/atlasDataAdapter.ts
- components/neural-atlas-3d/atlasTypes.ts
- app/projects/[slug]/page.tsx

Avoid editing those files unless absolutely necessary for a small type/import fix. If you notice issues in those files, document them rather than modifying them right now.

Do not implement Prompt 10, Prompt 11, or Prompt 15 directly yet if they require editing atlasDataAdapter.ts or detail panel components. Those should wait until Codex finishes Prompt 9.

Your job is to make useful, non-conflicting progress in parallel.

SAFE WORKSTREAMS FOR YOU RIGHT NOW:

1. Improve /neural-net as the “Full Neural Graph Archive”.
2. Add QA and production-hardening documentation.
3. Audit reduced-motion, WebGL fallback, accessibility, and performance gaps.
4. Draft final storytelling/copy guidance in docs.
5. Make small isolated fixes that do not overlap with Prompt 9.
6. Run typecheck/build and document any current failures.

WORKSTREAM 1: FULL NEURAL GRAPH ARCHIVE

Inspect:
- app/neural-net/NeuralNetClient.tsx
- components/neural-net/*
- data/generated/neural-graph.json
- relevant graph utilities

Tasks:
1. Rename the user-facing concept to “Full Neural Graph Archive”.
2. Preserve Cosmograph or the current large-graph renderer if it is working.
3. Make the route visually consistent with the new neural atlas: deep navy/black, cyan/violet/white accents, glassy dark panels, readable labels.
4. Add a clear CTA back to the homepage atlas: “Return to Atlas” route `/`.
5. Support `/neural-net?focus=neuros-v1` if feasible. If the graph library cannot programmatically focus, at least open/select the matching node in the inspector/details panel.
6. Check whether graph node selection is consistently using slug or id. Prefer slug-based selection unless the current implementation clearly uses id everywhere.
7. Keep filters, inspector, search, and existing graph interactions functional.
8. Run typecheck after changes.

Suggested commit message:
“Align full neural graph archive with atlas experience”

WORKSTREAM 2: QA CHECKLIST

Create `docs/ATLAS_QA_CHECKLIST.md` with manual QA steps for:
- root overview
- category selection
- signal propagation
- camera travel
- subnetwork reveal
- leaf detail behavior
- Back/Escape behavior
- direct URL state
- existing route regression checks
- mobile
- reduced motion
- accessibility
- performance
- production build

Suggested commit message:
“Add neural atlas QA checklist”

WORKSTREAM 3: REMAINING POLISH / RISK AUDIT

Create `docs/NEURAL_ATLAS_REMAINING_POLISH.md` with:
- architecture status
- Prompt 9 collision notes
- performance risks
- accessibility risks
- data/model risks
- UX risks
- recommended next implementation order after Codex finishes Prompt 9

Suggested commit message:
“Document remaining neural atlas polish risks”

WORKSTREAM 4: STORYTELLING / COPY BRIEF

Create `docs/ATLAS_STORYTELLING_POLISH.md` with:
- core positioning
- hero copy options
- category label options
- category preview copy
- microcopy set
- recruiter/researcher clarity guardrails
- tone rules

Suggested commit message:
“Draft neural atlas storytelling polish brief”

SMALL NON-CONFLICTING FIXES:
You may make small fixes if isolated and low-risk, such as README/docs updates, broken import fixes, typo fixes outside Prompt 9 files, minor route copy updates outside atlas detail panel work, and missing aria-labels to /neural-net controls.

Avoid:
- editing atlasDataAdapter.ts
- editing LeafDetailPanel.tsx
- editing NeuralAtlasOverlay.tsx
- editing CategoryPreviewPanel.tsx
- editing BreadcrumbTrail.tsx
- editing atlasTypes.ts
- changing homepage camera/navigation behavior
- changing R3F morphology internals
unless a typecheck error makes a tiny fix necessary.

DELIVERABLES:
Please complete as many of these as possible without overlapping Codex Prompt 9:
1. Improve /neural-net into the Full Neural Graph Archive.
2. Add docs/ATLAS_QA_CHECKLIST.md.
3. Add docs/NEURAL_ATLAS_REMAINING_POLISH.md.
4. Add docs/ATLAS_STORYTELLING_POLISH.md.
5. Run typecheck and build if reasonable.
6. Summarize files changed, validation, unresolved issues, files intentionally avoided, and recommended next steps.

Final summary format:

Summary:
- ...

Changed files:
- ...

Validation:
- npm run typecheck: pass/fail
- npm run build: pass/fail/not run

Avoided because Codex Prompt 9 is active:
- ...

Recommended next steps after Codex Prompt 9:
- ...

Proceed carefully, preserve the good work already done, and make the project more polished without starting a merge-conflict thunderstorm.
```

---

# Suggested Status Tracker

Agents should keep this updated in the repo or in commit summaries.

```text
Prompt 1: Complete / In progress / Not started
Prompt 2: Complete / In progress / Not started
Prompt 3: Complete / In progress / Not started
Prompt 4: Complete / In progress / Not started
Prompt 5: Complete / In progress / Not started
Prompt 6: Complete / In progress / Not started
Prompt 7: Complete / In progress / Not started
Prompt 8: Complete / In progress / Not started
Prompt 9: Complete / In progress / Not started
Prompt 10: Complete / In progress / Not started
Prompt 11: Complete / In progress / Not started
Prompt 12: Complete / In progress / Not started
Prompt 13: Complete / In progress / Not started
Prompt 14: Complete / In progress / Not started
Prompt 15: Complete / In progress / Not started
```

---

# Final Notes for Agents

Preserve clarity. The site can be strange, elegant, and neuron-shaped, but visitors must still quickly find:

- who Sidharth is,
- what he builds,
- projects/code,
- publications,
- research direction,
- contact links,
- GitHub/LinkedIn.

The atlas should be beautiful, but it should not become a glowing maze with a résumé trapped inside.

