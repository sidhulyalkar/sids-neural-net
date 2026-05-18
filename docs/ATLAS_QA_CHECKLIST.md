# Neural Atlas QA Checklist

Manual QA verification checklist for the Neural Atlas experience.

---

## Root Overview

- [ ] Homepage loads without console errors
- [ ] Category neurons render in a ring around the central about/origin node
- [ ] All 8 expected categories are visible: About, Professional Work, Projects, Publications, Research Ideas, Personal Interests, Photography, Contact
- [ ] Nodes have organic neuron morphologies (not plain circles)
- [ ] Dendrite curves connect category neurons
- [ ] Background has deep navy/black with subtle particle/dust field
- [ ] Initial hero overlay shows name and role clearly
- [ ] Category quick links in hero are clickable

---

## Category Neuron Selection

- [ ] Clicking a category neuron triggers signal propagation
- [ ] Hovered category shows preview panel with summary and child count
- [ ] Clicking initiates camera travel toward the category
- [ ] Signal pulse is visible traveling along the dendrite path
- [ ] Transition phase indicator is accurate (charging -> traveling -> arriving)

---

## Signal Propagation

- [ ] Electric pulse has white-hot core with cyan/violet bloom
- [ ] Pulse travels along the correct dendrite curve (not random)
- [ ] Total transition takes approximately 1.5-2 seconds
- [ ] Global flare effect is subtle, not screen-blinding
- [ ] No visual artifacts or flicker during propagation

---

## Camera Travel

- [ ] Camera smoothly interpolates toward selected category
- [ ] Surrounding nodes fade/drift during transition
- [ ] No abrupt jumps or jarring motion
- [ ] Depth-of-field or bloom shifts appropriately
- [ ] Motion is comfortable (no nausea-inducing speed)

---

## Subnetwork Reveal

- [ ] Child/leaf nodes bloom into visibility around the category
- [ ] Layout is biologically inspired (not a boring grid)
- [ ] Child nodes use varied morphologies
- [ ] Edges connect children to the category and related siblings
- [ ] Only relevant children for the category are shown

---

## Leaf Detail Behavior

- [ ] Clicking a leaf node zooms further into that neuron
- [ ] Detail panel opens after camera arrives
- [ ] Panel contains: title, summary, tags, links
- [ ] Project leaves show GitHub link if available
- [ ] Publication leaves show DOI/authors/venue
- [ ] Case-study leaves show link to /case-studies/[slug]
- [ ] "Open full page" button links to correct route
- [ ] "Related nodes" section shows relevant connections
- [ ] Close/back button returns to category view

---

## Back / Escape Behavior

- [ ] Pressing Escape from detail returns to category view
- [ ] Pressing Escape from category returns to root overview
- [ ] Clicking breadcrumb "Overview" returns to root
- [ ] Back button on leaf panel returns to category
- [ ] No stuck states after rapid back navigation

---

## Direct URL State

- [ ] `/?atlas=projects` opens directly to Projects category
- [ ] `/?atlas=publications&node=some-pub-slug` opens to that publication detail
- [ ] Invalid category/node params gracefully fall back to overview
- [ ] URL updates when navigating through the atlas
- [ ] Refresh preserves current position
- [ ] Sharing URL opens the correct view

---

## Project Links

- [ ] Project leaf nodes have "View on GitHub" if github data exists
- [ ] "Open full page" links to /projects/[slug]
- [ ] Project page loads correctly from atlas link
- [ ] Related nodes on project page use slugs correctly

---

## Publication Links

- [ ] Publication leaf nodes show DOI link
- [ ] "View Publication" opens DOI in new tab
- [ ] Publications page (/publications) still works
- [ ] Publication detail shows authors, venue, year
- [ ] PMID/PMCID shown if available

---

## /neural-net Archive Route

- [ ] /neural-net loads without console errors
- [ ] Title shows "Full Neural Graph Archive"
- [ ] All graph nodes render in Cosmograph
- [ ] "Return to Atlas" link visible and functional
- [ ] Filters (type, domain, search, mode) work correctly
- [ ] Node inspector opens on click
- [ ] `?focus=neuros-v1` selects and shows that node
- [ ] Node selection uses slug consistently
- [ ] Mobile has visible "Atlas" back link

---

## Mobile Layout

- [ ] Homepage renders on mobile viewport
- [ ] Touch to select category works
- [ ] Detail panel is readable (bottom sheet or full width)
- [ ] No horizontal scroll or overflow
- [ ] Text is readable without zooming
- [ ] Touch gestures don't conflict with browser gestures

---

## Reduced Motion

- [ ] prefers-reduced-motion skips camera travel animation
- [ ] prefers-reduced-motion shows static high-quality layout
- [ ] Category selection immediately shows category view
- [ ] Leaf selection immediately shows detail panel
- [ ] No jarring instant transitions

---

## Keyboard Navigation

- [ ] Tab cycles through visible nodes/controls
- [ ] Enter selects focused node
- [ ] Escape backs out one level
- [ ] Arrow keys cycle visible nodes (if implemented)
- [ ] Focus ring is visible on active element

---

## Screen Reader / Accessibility

- [ ] Overlay controls have aria-labels
- [ ] Panels have proper heading hierarchy
- [ ] Interactive elements are keyboard accessible
- [ ] Color is not the only indicator of state
- [ ] Link purposes are clear from text

---

## Browser Console Errors

- [ ] No errors on initial load
- [ ] No errors during category navigation
- [ ] No errors during leaf detail open
- [ ] No hydration mismatches
- [ ] No React key warnings
- [ ] No WebGL context errors

---

## Production Build Verification

- [ ] `npm run build` completes without errors
- [ ] `npm run typecheck` passes
- [ ] Built site loads correctly
- [ ] All routes accessible in production build:
  - [ ] /
  - [ ] /projects
  - [ ] /projects/[slug]
  - [ ] /publications
  - [ ] /case-studies
  - [ ] /case-studies/[slug]
  - [ ] /neural-net
  - [ ] /about
  - [ ] /contact
  - [ ] /timeline
  - [ ] /photography (if exists)
  - [ ] /ideas (if exists)

---

## Performance Spot Checks

- [ ] Initial load feels fast (under 3s)
- [ ] Category transition is smooth
- [ ] No frame drops during hover/animation
- [ ] Memory usage stable after 5+ category transitions
- [ ] No CPU spike holding at 100% during idle

---

## Notes

Use this checklist before releases and after major changes. Not all items need to pass for every commit, but all should pass before a major version or public launch.
