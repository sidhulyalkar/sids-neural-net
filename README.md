# Sid's Neural Net

A living portfolio and research atlas for Sidharth Hulyalkar, built as an interactive Next.js app. The site presents work, publications, and ideas through a cinematic 3D neural atlas experience.

## Architecture Overview

The site has two primary graph experiences:

### Homepage: Cinematic Neural Atlas (`/`)

The homepage is an immersive 3D neural atlas built with React Three Fiber. It provides a curated, story-driven navigation experience:

- **Category neurons**: Major thematic clusters (Projects, Publications, Professional Work, Research Ideas, etc.)
- **Signal propagation**: Electric pulses travel along dendrites when navigating
- **Camera travel**: Smooth transitions into category subnetworks
- **Leaf detail panels**: Rich readable information for individual items
- **URL state**: Deep-linking via `?atlas=category&node=slug`

### Full Neural Graph Archive (`/neural-net`)

The `/neural-net` route provides a power-user view of the complete generated graph:

- **Cosmograph renderer**: GPU-accelerated large graph visualization
- **Full dataset**: All 84+ nodes and 580+ edges
- **Filters**: By type, domain, mode, and search
- **Focus param**: Direct node selection via `?focus=slug`

## Implementation Reference

See `docs/NEURAL_ATLAS_FULL_IMPLEMENTATION_PLAN.md` for the complete implementation plan and prompt sequence used to build the atlas.

## What Is Built

- **Homepage**: Cinematic 3D neural atlas with R3F, signal propagation, and category navigation
- **Full Graph Archive**: Cosmograph-powered interactive graph at `/neural-net`
- Projects directory with search, filters, and generated detail pages
- Code systems page for GitHub-linked repositories and engineering themes
- Publications page for peer-reviewed work
- Archive page for publications, case studies, and long-form technical traces
- Timeline with weighted career, research, project, publication, and life events
- Case studies powered by MDX
- Life, About, Contact, Field Notes, and Learning Trails pages
- SEO metadata, sitemap, robots.txt, and Vercel configuration

Current generated data:

- 63 GitHub repositories ingested into `data/generated/github-repos.json`
- 84 graph nodes and 581 edges in `data/generated/neural-graph.json`
- 81 project nodes and 3 publication nodes
- 3 MDX project deep dives
- 13 timeline events

## Tech Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS
- **3D Atlas**: React Three Fiber, Three.js, @react-three/drei, @react-three/postprocessing
- **Full Graph**: Cosmograph via `@cosmograph/react`
- **State**: Zustand for navigation state machine
- **Animation**: Framer Motion for overlays and transitions
- MDX content through `next-mdx-remote`
- Zod for runtime data validation
- YAML and JSON data sources
- GitHub API ingestion script

## Quick Local Test

Use Node.js 18.18+ or Node.js 20+. This repo has a `package-lock.json`, so use npm for the cleanest path.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

For a quick smoke test, visit:

- `http://localhost:3000/`
- `http://localhost:3000/neural-net`
- `http://localhost:3000/projects`
- `http://localhost:3000/code`
- `http://localhost:3000/publications`
- `http://localhost:3000/archive`
- `http://localhost:3000/photography`
- `http://localhost:3000/case-studies`
- `http://localhost:3000/timeline`

The dev server uses the checked-in generated files under `data/generated`, so you can preview the app without refreshing GitHub data first.

## Environment Variables

Start from `.env.example`:

```bash
NEXT_PUBLIC_GITHUB_USERNAME=sidhulyalkar
GITHUB_TOKEN=
OPENALEX_EMAIL=
SEMANTIC_SCHOLAR_API_KEY=
```

The canonical production origin is deliberately code-owned in `lib/siteAuthority.ts` and is fixed to `https://sidhulyalkar.com`. Preview or local environment variables cannot silently change canonical, OpenGraph, robots, or sitemap identity.

`GITHUB_TOKEN` is optional, but recommended when refreshing repository data so the GitHub API has a higher rate limit.

## Data Pipeline

Refresh the generated data with:

```bash
npm run ingest
```

That runs:

```bash
npm run ingest:github
npm run ingest:graph
```

The pipeline:

1. Fetches public GitHub repos for `NEXT_PUBLIC_GITHUB_USERNAME`.
2. Normalizes them into `data/generated/github-repos.json`.
3. Merges GitHub repos, manual project overrides, publications, and context-pack docs.
4. Writes the final graph to `data/generated/neural-graph.json`.

Manual inputs live in:

- `data/manual/project-overrides.yaml`
- `data/manual/publications.yaml`
- `data/manual/timeline-events.yaml`
- `content/case-studies/*.mdx`
- `sids_neural_net_project_context_pack/*.md`

## Validation Commands

Run these before deploying or pushing:

```bash
npm run typecheck
npm run lint
npx next build
```

`npx next build` validates the app without refreshing generated data. The configured `npm run build` refreshes generated data first, then creates the production Next.js build; avoid that ingest step while Claude is actively working on generated neural atlas data unless you intend to refresh those files.

If you are working from WSL and Node is installed only on Windows, run the npm commands from PowerShell/Command Prompt in this folder or upgrade to WSL 2 and install Node inside WSL. WSL 1 can fail to execute Windows Node/npm shims.

## Deployment

The project is ready for Vercel.

1. Push the repository to GitHub.
2. Import the GitHub repo in Vercel.
3. Set any environment variables from `.env.example`.
4. Use the included `vercel.json`; the build command is `npm run build`.

Vercel should detect this as a Next.js project and install dependencies with npm because `package-lock.json` is present.

## Documentation

Key documentation files:

- `docs/NEURAL_ATLAS_FULL_IMPLEMENTATION_PLAN.md` - Complete implementation plan and prompt sequence
- `docs/NEURAL_ATLAS_REBUILD_PLAN.md` - Initial architecture audit and rebuild plan
- `docs/NEURAL_ATLAS_REMAINING_POLISH.md` - Status, risks, and remaining work
- `docs/ATLAS_QA_CHECKLIST.md` - Manual QA verification checklist
- `docs/SITE_QA_CHECKLIST.md` - Portfolio shell routing, accessibility, responsive, and content QA checklist
- `docs/ATLAS_STORYTELLING_POLISH.md` - Copy and design brief

## Project Structure

```text
app/                  Next.js routes, metadata, sitemap, robots
components/
  neural-atlas-3d/    3D atlas experience (R3F, morphologies, panels)
  neural-net/         Full graph archive (Cosmograph)
  home/               Homepage components
  layout/             Header, Footer, navigation
  ui/                 Shared UI components
content/              MDX project deep dives and context documents
data/generated/       Generated GitHub repo and neural graph JSON
data/manual/          Manually curated YAML data
src/data/             Navigation, social links, curated code systems, page data
docs/                 Implementation plans, QA checklists, design briefs
lib/                  Data schemas, content loaders, ranking utilities
scripts/              GitHub ingestion and graph build scripts
```

## Commit Workflow

After validation:

```bash
git status -sb
git add README.md package.json vercel.json app/sitemap.ts app/robots.ts
git commit -m "Add project README and npm deployment scripts"
```

For the first full project commit, stage the intended app files explicitly or use `git add -A` only if every untracked file in the working tree belongs in the repository.
