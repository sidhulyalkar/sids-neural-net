# Site QA Checklist

This checklist covers the portfolio shell around the experimental neural atlas. Claude is actively owning the neural renderer rescue, so avoid editing renderer/morphology files while using this checklist.

## Local Commands

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npx next build
```

Use `npx next build` when you want to validate the app without running the `npm run build` ingest step. The configured `npm run build` refreshes generated graph data before building.

## Key Routes

- `/` - immersive neural atlas landing
- `/about` - identity and working style
- `/projects` - searchable project directory
- `/projects/[slug]` - generated project detail pages
- `/code` - GitHub and code systems
- `/publications` - publication focus archive
- `/archive` - papers, case studies, and long-form technical artifacts
- `/photography` - visual field notes and gallery structure
- `/field-notes` - experimental notes placeholder
- `/ideas` - research idea nodes
- `/timeline` - chronological signal trace
- `/case-studies` and `/case-studies/[slug]` - MDX project briefs
- `/contact` - email and external profiles
- `/neural-net` - full generated graph archive

## Manual Navigation Checks

- Header logo returns to `/` from non-home pages.
- Menu opens with the menu button, closes after choosing a route, and closes with Escape.
- Site map opens from the Map button or `Cmd/Ctrl+K`, closes with Escape, and exposes all major routes.
- Active route state is visible in the menu and site map.
- Internal links use Next navigation and external links open in a new tab with `rel="noopener noreferrer"`.
- Project detail back links return to `/projects`.
- Archive links reach `/publications` and `/case-studies`.

## Responsive Checks

Check desktop, tablet, mobile, short-height screens, and 125-150% browser zoom:

- No page title, button label, or card text overflows its container.
- Menu remains scrollable on small-height screens.
- Tap targets are approximately 44px where practical.
- Project filters and view toggles remain usable on mobile.
- Publication archive falls back to stacked cards below large screens.
- Content pages stay readable without relying on the 3D atlas.

## Accessibility Checks

- Tab through the header, menu, page controls, and cards.
- Focus rings are visible on links, buttons, filter chips, and form controls.
- Escape closes open menus/dialogs.
- Icon-only buttons have accessible labels.
- Pages have one clear `h1` and semantic section headings.
- Reduced-motion preference disables page-level motion where supported by global CSS.
- Skip link appears on keyboard focus and lands on main content.

## Content Updates

Add project/publication source material in the existing data pipeline:

- Project overrides: `data/manual/project-overrides.yaml`
- Publications: `data/manual/publications.yaml`
- Timeline events: `data/manual/timeline-events.yaml`
- Long-form case studies: `content/case-studies/*.mdx`
- Navigation: `src/data/siteNav.ts`
- Social links: `src/data/socialLinks.ts`
- Curated code systems: `src/data/codeSystems.ts`
- Photography categories: `src/data/photographyCategories.ts`

## Protected Neural Renderer Area

Avoid editing these while Claude is working:

- `components/neural-atlas-3d/**`
- `components/neural-atlas/**` except purely presentational route wrappers, if absolutely necessary
- `components/neural-net/**`
- `lib/morphology/**`
- `public/morphologies/**`
- generated neural graph files when a build/ingest run would overwrite active renderer work
- any SWC parsing, canvas, WebGL, morphology, or neuron rendering path
