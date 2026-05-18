# Neural Atlas: Remaining Polish and Risk Assessment

Last updated: After Prompt 9 completion

---

## Architecture Status

The neural atlas architecture is substantially implemented through Prompt 9. The system now includes:

### Core Components (Implemented)
- **NeuralAtlasExperience**: Main wrapper with WebGL detection and fallback
- **NeuralAtlasCanvas**: R3F Canvas with postprocessing
- **NeuralAtlasScene**: 3D scene with nodes, edges, particles
- **NeuralAtlasOverlay**: DOM overlay for readable panels and controls
- **atlasStore (Zustand)**: Navigation state machine
- **atlasDataAdapter**: Maps generated graph to curated atlas structure
- **atlasTypes**: Full TypeScript model for atlas nodes/edges/state

### Rendering (Implemented)
- Neuron morphologies: soma, pyramidal, stellate, interneuron
- Dendrite curves with CatmullRom tubes
- Signal propagation animation with pulse
- Particle/dust field for atmosphere
- Bloom/postprocessing effects
- Category-specific color harmonies

### Navigation (Implemented)
- Root overview with category ring layout
- Camera travel to category subnetworks
- Subnetwork reveal with child nodes
- Leaf detail panel with rich content
- Breadcrumb trail
- Back/Escape navigation
- URL state (`?atlas=` and `&node=`)

---

## What Appears Implemented

Based on commit history through Prompt 9:

| Prompt | Description | Status |
|--------|-------------|--------|
| 1-2 | Master rebuild direction & audit | Complete |
| 3 | Scaffold R3F architecture | Complete |
| 4 | Data model & adapter | Complete |
| 5 | R3F canvas foundation | Complete |
| 6 | Neuron morphologies | Complete |
| 7 | Dendrite signal propagation | Complete |
| 8 | Camera travel & subnetworks | Complete |
| 9 | Leaf detail panels | Complete |

---

## What Appears Incomplete

### Prompt 10: Publication Integration (Codex Active)
- Extended publication metadata (abstract, contribution, keyFindings)
- Curated publication.yaml fields (myContribution, whyItMatters)
- Publication neuron chamber with PDF embed support
- Violet-toned archive subnetwork styling
- Copy citation button

### Prompt 11: Category Subnetwork Curation
- Hand-authored category descriptions
- Curated child node selection per category
- Importance-based visibility filtering
- "Show more signal" for lower-priority nodes
- Cross-category related edges styling

### Prompt 12: Homepage Premium Polish
- Cinematic intro sequence
- Skip/reduced-motion intro handling
- Hero copy overlay refinement
- Header/Footer immersive mode toggle
- Tablet/mobile simplification

### Prompt 13: /neural-net Archive Polish
- Partial: branding and Return to Atlas added
- Partial: focus query param support added
- Partial: slug consistency improved
- Remaining: programmatic graph focus/zoom (if Cosmograph supports)

### Prompt 14: Production Hardening
- Memoization audit for geometries/curves
- Instanced meshes for particles
- Mobile particle count reduction
- Lazy loading optimization
- Accessibility aria-labels audit
- Full keyboard navigation
- Error boundary implementation

### Prompt 15: Storytelling Polish
- Category label refinement
- Microcopy audit ("follow signal", "return to cortex")
- First 10 seconds experience audit
- Navigation hint overlay
- Recruiter/researcher quick-find paths

---

## Codex Prompt 10 Collision Notes

Codex is currently implementing Prompt 10 (Publication Integration). The following files are likely being edited and should be avoided:

### Files to Avoid
- `data/manual/publications.yaml` - Codex adding curated fields
- `app/publications/page.tsx` - Potential updates
- `components/publications/*` - Any publication components
- `components/neural-atlas-3d/atlasDataAdapter.ts` - Publication mapping
- `components/neural-atlas-3d/atlasTypes.ts` - Publication metadata types
- `components/neural-atlas-3d/panels/LeafDetailPanel.tsx` - Publication rendering
- `public/papers/*` - Any PDF assets

### Safe to Edit (Verified)
- `app/neural-net/*` - Graph archive route
- `components/neural-net/*` - Graph components
- `docs/*` - Documentation files
- Other routes not related to publications

---

## Files Intentionally Avoided This Session

The following files were not edited to prevent merge conflicts:
- `atlasDataAdapter.ts`
- `atlasTypes.ts`
- `LeafDetailPanel.tsx`
- `CategoryPreviewPanel.tsx`
- `BreadcrumbTrail.tsx`
- `app/publications/page.tsx`
- `components/publications/*`
- `data/manual/publications.yaml`

---

## Performance Risks

1. **Geometry regeneration**: Neuron morphologies may recreate geometry on re-renders. Need memoization audit.

2. **Particle count**: Glial particle field and dust may cause frame drops on mobile. Need to reduce count on low-end devices.

3. **Postprocessing overhead**: Bloom and depth-of-field can be expensive. Consider quality tiers.

4. **Bundle size**: Three.js and R3F add significant JS. Ensure tree-shaking works and consider lazy loading.

5. **Memory leaks**: R3F geometries/materials need proper disposal on unmount.

---

## Accessibility Risks

1. **Keyboard navigation incomplete**: Tab order through 3D nodes is complex. Need mirrored DOM controls.

2. **Screen reader support**: 3D canvas is not accessible. Overlay must provide all functionality.

3. **Reduced motion**: Implemented but needs testing. Camera travel should be instant, not just faster.

4. **Color reliance**: Some states may rely only on color. Need shape/label indicators.

5. **Focus visibility**: Focus rings need to be clearly visible on dark backgrounds.

---

## Data/Model Risks

1. **Slug vs ID consistency**: Edges use slugs, some code used IDs. Fixed in /neural-net, but verify atlas adapter.

2. **Missing nodes**: Some generated nodes may not map to categories. Need fallback handling.

3. **Related nodes**: Cross-category relationships may be sparse. Consider generating more semantic connections.

4. **Publication data**: Depends on Prompt 10 completion for full metadata.

---

## UX Risks

1. **First-time orientation**: Users may not understand they can click neurons. Need subtle hints.

2. **Transition length**: 1.5-2s transitions may feel slow for repeat navigation. Consider shortening after first visit.

3. **Detail panel density**: Too much information could overwhelm. Need progressive disclosure.

4. **Mobile touch**: Touch-to-select may conflict with pan/zoom. Need gesture disambiguation.

5. **Back navigation**: Users may get lost in deep navigation. Breadcrumbs help but may not be enough.

---

## Recommended Next Order After Codex Prompt 10

1. **Prompt 11: Category Curation**
   Curate each category's subnetwork with hand-picked children, descriptions, and importance settings. This makes the atlas feel intentional rather than auto-generated.

2. **Prompt 14: Production Hardening**
   Performance optimization, accessibility audit, error boundaries, and full keyboard navigation. Critical before public launch.

3. **Prompt 15: Storytelling Polish**
   Final copy refinement, category labels, microcopy, and the first-10-seconds experience. This is the final emotional polish.

4. **Prompt 12: Homepage Premium**
   If not already addressed in earlier prompts, add cinematic intro, header/footer immersive mode, and mobile simplification.

5. **Prompt 13: /neural-net Archive**
   Most of this was completed in this session. Remaining: programmatic focus/zoom if Cosmograph API supports it.

---

## Quick Wins (Can Be Done Anytime)

- Add more aria-labels to overlay controls
- Improve focus ring visibility
- Add loading states for slow networks
- Add error messages for WebGL failures
- Document keyboard shortcuts in UI
- Add skip-to-content link for accessibility
- Test and fix any console warnings/errors
