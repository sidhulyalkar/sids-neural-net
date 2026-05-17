# Sid's Neural Net

A living portfolio and research atlas for Sidharth Hulyalkar, built as an interactive Next.js app. The site connects projects, publications, case studies, career milestones, and personal interests through a generated neural graph.

## What Is Built

- Homepage with an animated constellation hero, professional pillars, featured case studies, publications, current work, and personal signal strip.
- Neural Net view with an interactive React Flow graph.
- Projects directory with search, filters, and generated detail pages.
- Publications page for peer-reviewed work.
- Timeline with weighted career, research, project, publication, and life events.
- Case studies powered by MDX.
- Life, About, Contact, Field Notes, and Learning Trails pages.
- SEO metadata, sitemap, robots.txt, and Vercel configuration.

Current generated data:

- 63 GitHub repositories ingested into `data/generated/github-repos.json`
- 84 graph nodes and 581 edges in `data/generated/neural-graph.json`
- 81 project nodes and 3 publication nodes
- 3 MDX case studies
- 13 timeline events

## Tech Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS
- React Flow via `@xyflow/react`
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
- `http://localhost:3000/publications`
- `http://localhost:3000/case-studies`
- `http://localhost:3000/timeline`

The dev server uses the checked-in generated files under `data/generated`, so you can preview the app without refreshing GitHub data first.

## Environment Variables

Start from `.env.example`:

```bash
NEXT_PUBLIC_SITE_URL=https://sidsneural.net
NEXT_PUBLIC_GITHUB_USERNAME=sidhulyalkar
GITHUB_TOKEN=
OPENALEX_EMAIL=
SEMANTIC_SCHOLAR_API_KEY=
```

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
npm run build
```

`npm run build` refreshes generated data first, then creates the production Next.js build.

If you are working from WSL and Node is installed only on Windows, run the npm commands from PowerShell/Command Prompt in this folder or upgrade to WSL 2 and install Node inside WSL. WSL 1 can fail to execute Windows Node/npm shims.

## Deployment

The project is ready for Vercel.

1. Push the repository to GitHub.
2. Import the GitHub repo in Vercel.
3. Set any environment variables from `.env.example`.
4. Use the included `vercel.json`; the build command is `npm run build`.

Vercel should detect this as a Next.js project and install dependencies with npm because `package-lock.json` is present.

## Project Structure

```text
app/                  Next.js routes, metadata, sitemap, robots
components/           UI, layout, home, graph, project, publication, and timeline components
content/              MDX case studies and copied context documents
data/generated/       Generated GitHub repo and neural graph JSON
data/manual/          Manually curated YAML data
lib/                  Data schemas, content loaders, ranking utilities, context provider
scripts/              GitHub ingestion and graph build scripts
sids_neural_net_project_context_pack/
                      Source context docs used by the graph builder
```

## Commit Workflow

After validation:

```bash
git status -sb
git add README.md package.json vercel.json app/sitemap.ts app/robots.ts
git commit -m "Add project README and npm deployment scripts"
```

For the first full project commit, stage the intended app files explicitly or use `git add -A` only if every untracked file in the working tree belongs in the repository.
