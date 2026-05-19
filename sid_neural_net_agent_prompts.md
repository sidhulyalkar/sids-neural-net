# Sid Neural Net — Detailed Agent Prompts for Claude Code and Codex

Use this guide to coordinate the next refactor pass for the Sid Neural Net personal website.

The goal is not to add more decoration. The goal is to make the site feel like a minimal, professional neural systems portfolio: dark, sparse, precise, and unmistakably dendritic.

---

## Current Problems to Fix

The current Build Cortex / Visual Archive output is improving, but the background still reads incorrectly. It looks like abstract orbital/space lines instead of neural circuitry.

The site needs the following corrections:

1. Replace all smooth curvy background lines with angular dendritic neural morphology.
2. Remove any remaining space/orbit/starfield visual language.
3. Make all subpages minimal and compact.
4. Remove secondary page titles and excess description text.
5. Rename Identity to Core.
6. Update Contact content and spacing.
7. Update professional links.
8. Update footer to exactly two lines on desktop.
9. Update location to Los Gatos, California.
10. Remove “(Fork)” from project names.
11. Improve Build Cortex so it feels back on-theme.
12. Add direct project links to deployed systems, especially the Sabatini DataJoint pipeline.
13. Update stack tags to show actual programming languages, processing tools, and infrastructure.
14. Keep the site fast, accessible, and responsive.

---

# Prompt for Claude Code

```text
You are working on my personal portfolio website repo: Sid Neural Net.

Your job is to implement the next major visual/content refinement pass. The site is close, but still has several issues that make it feel less professional and less on-theme.

Primary objective:
Make the site feel like a minimal, professional, dark neural-circuit portfolio. It should look like a refined computational neuroscience systems map, not a space/orbit UI, not a generic sci-fi dashboard, and not a busy project grid.

The homepage / intro page has the correct general direction: sparse neuron/dendrite structure, dark background, asymmetric biological geometry, clean minimal text. Subpages should inherit that visual language.

Important:
Do not add more UI chrome. Remove clutter.
Do not add more explanatory copy. Remove unnecessary copy.
Do not use large smooth decorative curves.
Do not reintroduce menus, map buttons, atlas buttons, or top bars.

---

## 1. Background: strict neural circuit morphology

The current background is wrong. It still reads as abstract space/orbit curves. I do not want to see any single large curvy Bezier/spline lines anywhere on subpages.

Replace the current background system with a neural circuit / dendrite morphology background that directly matches the intro/homepage neuron style.

### Hard visual requirements

Remove:
- Long smooth curves
- Bezier/spline orbit arcs
- Star-field dots
- Abstract space-map lines
- Giant isolated sweeping paths
- Decorative curves behind content
- Sine-wave/vine-like forms
- Large smooth diagonal ribbons or curved page decorations

Use:
- Sparse dendritic arborization
- Angular, segmented, biological branches
- SVG polylines or paths built from hard/segmented points
- Main branches that split into smaller branches
- Secondary and tertiary branches with reduced opacity and thinner strokes
- Occasional tiny node points only at branch junctions
- Asymmetric organic structures resembling traced neuron/dendrite morphology
- Low-contrast muted gray/cyan linework
- No animation required

### Implementation direction

Refactor or replace the reusable `NeuralBackground` component.

It should generate fixed dendritic branch clusters using SVG polylines. Avoid Bezier paths unless they are used only for very short, slightly angled, non-smooth branch details.

A good background cluster should look like:
- One main dendrite enters from a side or corner.
- It bends through short angular segments.
- It splits into 2–4 uneven branches.
- Each branch splits again into smaller short segments.
- The whole pattern feels like a neural arbor, not a decorative curve.

Visual style:
- stroke: muted gray/cyan
- opacity: roughly 0.05–0.18
- width: main branch around 1–1.5 px, secondary 0.5–1 px
- nodes: tiny circles at only a few branch junctions
- no glow, or only extremely subtle glow if already part of the design system
- background must not compete with content
- no continuous animation loops
- no expensive canvas animation

Page usage:
- All subpages should use this neural circuit background.
- Each page can rotate, translate, scale, or crop the same dendritic cluster differently.
- Visual Archive currently looks empty and shows large smooth curves. Replace with sparse dendritic morphology.
- Build Cortex currently has remaining off-theme lines behind cards. Replace those too.
- Paper Archive, Contact, Core, Resume, Research Ideas, Visual Archive, Build Cortex, Learning Trails, Timeline, and any remaining pages should all use this background system.

Acceptance test:
Open each subpage. If you can describe the background as “orbit,” “space,” “wave,” “curve,” or “spline,” it fails. If it looks like sparse dendrite morphology or neural circuit tracing, it passes.

---

## 2. Navigation simplification

Keep the site minimal.

Requirements:
- No top navigation bar.
- No Map button.
- No Atlas button.
- No Full Brain View dropdown.
- No hamburger menu.
- No duplicated navigation concepts.
- On subpages, use only the minimal top-left dendrite + hexagon home control.
- The hexagon should return to the homepage.
- It should be visually subtle and consistent across pages.

The current top-left hexagon/dendrite idea is acceptable, but make sure it is aligned, clickable, accessible, and visually intentional.

Accessibility:
- The hexagon must have an accessible label such as `Return home`.
- It must be keyboard focusable.
- It must have a subtle but visible focus state.

---

## 3. Rename Identity to Core

Replace “Identity” with “Core” everywhere user-facing.

Update:
- Homepage node label
- Route title/page heading
- Any nav/menu references if still present
- Data model label if labels are generated from data
- Page metadata/title if present

Do not show both “Identity” and “Core.” The public-facing term should be “Core.”

Suggested copy:
- Page eyebrow: `CORE`
- Page title: `core`

Keep it minimal. Do not add long description text.

---

## 4. Footer update

Update the homepage footer to exactly two lines on desktop/laptop.

Line 1:
`SIDHARTH HULYALKAR`

Line 2:
`NEURAL DATA SYSTEMS | MULTIMODAL FOUNDATION MODELING & INTERPRETABILITY | SCIENTIFIC SOFTWARE`

Rules:
- Keep centered.
- Keep line 1 letter-spaced and code-like.
- Keep line 2 smaller and readable.
- Do not split “SCIENTIFIC SOFTWARE” into a third desktop line.
- On mobile, line 2 may wrap naturally if needed.
- Use American spelling: `MODELING`, not `MODELLING`.
- Fix typo: `MULTIMODAL`, not `MUTLIMODAL`.
- Do not add extra subtitles or tagline lines.

---

## 5. Contact page cleanup

The Contact page should be minimal and professional.

Update:
- Email: `sidsoccer21@gmail.com`
- Location: `Los Gatos, California`
- GitHub: `https://github.com/sidhulyalkar`
- LinkedIn: `https://www.linkedin.com/in/sidharth-hulyalkar/`
- Google Scholar: `https://scholar.google.com/citations?user=nuvjyyMAAAAJ&hl=en`

Requirements:
- Do not show both “connect” and “contact.” Use only `contact`.
- Do not include redundant descriptive panels.
- Do not include long text about conversations/collaboration.
- Make the page breathe with better spacing.
- Leave room for future professional photos or portrait/photo blocks, but do not use stock placeholders.
- If image slots exist, keep them subtle and optional.
- Make each contact/social item a clean direct link.
- Add a Google Scholar item in the Social/Contact section.
- The Contact page should feel like a small professional contact card, not a dashboard.

Suggested page structure:
- Small eyebrow: `CONTACT`
- Compact code-like title: `contact`
- Minimal link grid:
  - Email
  - GitHub
  - LinkedIn
  - Google Scholar
  - Location
- Optional empty right-side visual area reserved for future photo, hidden on mobile if empty

Do not add a second subtitle under Resume or Google Scholar cards.

---

## 6. Remove secondary titles and extra text across all pages

All subpages should be minimal.

Remove:
- Large hero descriptions
- Secondary explanatory subtitles
- Redundant page summaries
- “PDF served from /resume/SidharthHulyalkar_Resume.pdf.”
- Any “this page contains...” type copy
- Placeholder-y phrases like `Image pending`, `Empty frame`, `PDF link pending` when not necessary
- Redundant descriptors under page links/cards
- Anything that reads like a wireframe label instead of final portfolio text

Keep:
- Small eyebrow label
- Compact code-like title
- Essential content
- Necessary metadata
- Direct links
- Skills/tags only where helpful

Examples:
- Resume page: do not show a second descriptive title for the PDF.
- Google Scholar card/link: no second descriptive title needed.
- Visual Archive: do not show “curation in progress” unless there is no image content yet. If still empty, make it very quiet and tasteful.
- Paper Archive: keep publication metadata, but simplify labels.

---

## 7. Typography and page titles

Make all subpage titles smaller, code-like, and calm.

Requirements:
- Avoid giant left-side hero typography on subpages.
- Use compact monospaced titles.
- Titles should feel like labels in a technical interface, not billboard headings.
- Lowercase titles are acceptable and currently fit the direction.
- Use consistent spacing across pages.

Suggested pattern:
- Eyebrow: uppercase, tiny, cyan, letter-spaced
- Title: lowercase monospaced, maybe 1.25–2rem depending on viewport
- Minimal content below

Example:
`PROJECTS`
`build cortex`

Avoid:
- Huge all-caps hero titles
- Big empty description panels
- Multiple stacked headings that say the same thing

---

## 8. Build Cortex page improvements

The current Build Cortex page looks weird and slightly off-theme. It still feels like a heavy dashboard and has some awkward card proportions.

Goal:
Make Build Cortex feel like a clean technical project archive inside the neural-circuit world.

Requirements:
- Remove “(Fork)” from all visible project names.
- Project cards should be cleaner, flatter, and less bulky.
- Keep the useful search/filter only if it remains visually quiet.
- Remove unnecessary card decoration and diagonal glare if it makes cards look sci-fi/generic.
- Make card sizes more consistent.
- Keep grid readable with good spacing.
- Avoid giant empty columns or awkward staggered masonry if it causes visual imbalance.
- Tags should show real languages, tools, processing pipelines, and infrastructure.
- Repository links should be direct and visible.
- Deployed systems / major systems should have relevant project links.

Specific project link to include:
`https://github.com/bernardosabatinilab/sabatini-datajoint-pipeline`

Add this as a direct project/repository link for the Sabatini/DataJoint deployed systems entry or the relevant DataJoint pipeline project.

Also ensure links exist where available for:
- neurOS-v1
- neuroFMx / neuros-neurofm if represented separately
- NeuroForge
- neuros-mechint / Neural Multimodal Transformer Mechanistic Interpretability
- element-deeplabcut
- element-facemap if included
- element-calcium-imaging if included
- sabatini-datajoint-pipeline
- any deployed systems page entries that reference real infrastructure

If the repo has existing project data files, update those data files rather than hardcoding links into cards.

---

## 9. Project stack/tag cleanup

Update stacks/tags to show actual programming languages, processing tools, and infrastructure.

Remove tags that are vague or misleading where better specific tags exist.

General rule:
Each project should show:
- Main programming languages
- Key frameworks/libraries
- Processing tools
- Infrastructure/deployment tools
- Scientific data modalities if relevant

Examples:

### UCSD / NEATLABs style projects
Use relevant tags such as:
- MATLAB
- Python
- LFP
- EEG
- behavioral analysis
- Granger causality
- cross-correlation
- Q-learning
- electrophysiology
- optogenetics
- behavioral rigs

### DataJoint / deployed systems projects
Use relevant tags such as:
- Python
- DataJoint
- Docker
- AWS
- Kubernetes
- MySQL
- S3
- EFS
- Terraform
- SpikeInterface
- Suite2p
- CaImAn
- DeepLabCut
- Facemap
- fiber photometry
- calcium imaging
- electrophysiology
- pose estimation
- worker orchestration

### neurOS / neuroFMx
Use relevant tags such as:
- Python
- PyTorch
- FastAPI
- NWB
- Zarr
- WebDataset
- Mamba
- transformers
- Perceiver IO
- LoRA
- FSDP
- real-time inference
- neural time series
- foundation models

### neuros-mechint
Use relevant tags such as:
- Python
- PyTorch
- mechanistic interpretability
- path patching
- ACDC
- counterfactual interventions
- Bokeh
- Plotly
- neural models

### PetPath / PetNet if present
Use relevant tags such as:
- React
- TypeScript
- geolocation
- wearable data
- social network
- activity tracking

Important:
Inspect existing repository/package files and project data before editing:
- package.json
- pyproject.toml
- setup.py
- requirements.txt
- README files
- project metadata JSON/TS files
- GitHub URLs already in data

Do not invent fake links. If a direct link is unavailable, leave it blank or add a TODO in data comments if appropriate.

---

## 10. Resume / Scholar / Social section cleanup

Where Resume and Google Scholar appear:
- Do not add second descriptive titles.
- Use direct simple labels:
  - Resume
  - Google Scholar
  - GitHub
  - LinkedIn
- Remove extra description unless needed for accessibility.
- Resume link should point directly to the resume PDF.
- Remove any visible implementation path text.

The visible site should never say:
`PDF served from /resume/SidharthHulyalkar_Resume.pdf.`

---

## 11. Visual Archive

The Visual Archive page should not look empty, broken, or placeholder-heavy.

Requirements:
- Use professional label: `Visual Archive`.
- Remove awkward labels such as:
  - Visual Field Notes
  - Image Pending
  - Empty Frame
  - Location Pending
  - Date Pending
- If photos are not wired in yet, keep the page very minimal.
- Do not use stock placeholders.
- Either hide empty image cards or show a tasteful reserved space with no awkward placeholder text.
- The background must be dendritic and angular, not smooth curved.
- Leave future space for selected field images, Shasta images, landscape images, and artistic photography.

Suggested minimal empty state:
- Eyebrow: `ARCHIVE`
- Title: `visual archive`
- One quiet line only if necessary:
  `Selected field images will appear here once curated.`
Even that line may be omitted if the page looks better without it.

---

## 12. Paper Archive

Paper Archive is one of the most important sections. Keep it clean and credible.

Requirements:
- Keep publication cards.
- Reduce heavy dashboard feeling.
- Make cards more minimal and aligned.
- Preserve direct DOI/PDF/PubMed/PMC links where available.
- Do not overuse “PDF pending” if it makes the page feel unfinished.
- If a PDF is unavailable, simply omit the PDF link rather than showing a loud pending label.
- Keep metadata accurate.
- Avoid fake or overly broad tags.
- Tags should be secondary, not visually dominant.

---

## 13. Skills / Highlights

Highlight skills more clearly in the highlights section.

Skills should emphasize:
- Neural data systems
- Multimodal ML
- Scientific software
- DataJoint
- Python
- Docker
- AWS
- PyTorch
- FastAPI
- React / TypeScript
- NWB / Zarr
- Calcium imaging
- Electrophysiology
- DeepLabCut / pose estimation
- Suite2p / CaImAn
- Mechanistic interpretability
- Foundation models
- Real-time systems / BCI infrastructure

Keep this concise. Do not create a giant resume wall.

---

## 14. Responsive and accessibility requirements

After implementing:
- Test desktop, laptop, tablet, mobile.
- Confirm no horizontal overflow.
- Confirm all links are keyboard accessible.
- Confirm home hexagon has accessible label.
- Confirm color contrast is readable.
- Confirm reduced-motion preferences are respected.
- Confirm there are no console errors.
- Confirm backgrounds do not create performance problems.
- Confirm production build passes.

Commands:
Inspect `package.json` and run whatever exists:
- npm install / pnpm install / yarn install as appropriate
- npm run lint
- npm run typecheck
- npm run test
- npm run build

If commands are missing, report that clearly.

---

## 15. Commit structure

Use clear commits:
1. `refactor neural background morphology`
2. `simplify subpage headers and copy`
3. `rename identity to core`
4. `update contact social footer content`
5. `polish build cortex project cards`
6. `fix project stacks and repository links`
7. `qa responsive accessibility build`

Before editing:
- Check git status.
- Avoid overwriting unrelated work.
- Keep changes organized.
- Prefer editing shared components/data files rather than one-off patches.

Final report:
Give me:
- Summary of changes
- Files changed
- Commands run and results
- Screenshots or page notes for Visual Archive, Build Cortex, Contact, Paper Archive, and homepage
- Any remaining TODOs
```

---

# Prompt for Codex

```text
You are working on my personal portfolio website repo: Sid Neural Net.

Claude Code is doing the major visual refactor. Your job is to act as the detail-oriented QA, data-integrity, link, accessibility, and project metadata engineer.

Use this prompt as your source of truth. Your role is to verify, fix, and harden the implementation without fighting Claude’s design work.

Primary objective:
Make the website launch-ready: all routes work, all links are correct, content is clean, project stacks are accurate, and no off-theme UI remains.

Before doing anything:
1. Run `git status`.
2. Inspect recent commits.
3. Identify the routing/data/component structure.
4. Avoid overwriting Claude’s active design refactor.
5. Prefer targeted changes to data/config/tests.

---

## 1. Verify no off-theme background remains

Check all pages for bad background elements.

Failing background elements:
- Long smooth curves
- Bezier/spline orbit arcs
- Star-field dots
- Abstract space-map lines
- Giant isolated sweeping paths
- Decorative curves behind content
- Sine-wave/vine-like shapes

Passing background elements:
- Angular segmented dendritic branches
- Polyline-like neural arborization
- Asymmetric branch clusters
- Sparse junction nodes
- Low-contrast neural-circuit texture
- Visual similarity to homepage dendrite/neuron structure

Pages to check:
- Home / atlas
- Core
- Build Cortex
- Code if separate
- Paper Archive
- Visual Archive
- Contact
- Resume
- Research Ideas
- Learning Trails
- Timeline
- Life
- Full Graph if it still exists

If you find old background code, remove it or point Claude to the exact component/file if it is part of ongoing design work.

---

## 2. Verify navigation simplification

Confirm:
- No top nav bar remains.
- No Map button remains.
- No Atlas button remains.
- No Full Brain View dropdown remains.
- No hamburger menu remains.
- No hidden inaccessible menu is needed.
- Subpages have a minimal top-left dendrite + hexagon home control.
- The hexagon returns to the homepage.
- The hexagon is keyboard accessible.
- The hexagon has an accessible label like `Return home`.

Search the codebase for:
- `Map`
- `Atlas`
- `Full Brain View`
- `menu`
- `hamburger`
- `brain view`
- `dropdown`

Remove or update user-facing leftovers.

---

## 3. Rename Identity to Core everywhere

Search for:
- `Identity`
- `identity`

Replace user-facing “Identity” with “Core.”

Be careful:
- Route names may remain internal if changing them would break routing.
- But public labels, headings, page titles, metadata, and node labels should say Core.
- Do not show both terms.

Expected public page:
- Eyebrow: `CORE`
- Title: `core`

---

## 4. Verify footer exactly

Homepage desktop footer should be exactly two lines:

Line 1:
`SIDHARTH HULYALKAR`

Line 2:
`NEURAL DATA SYSTEMS | MULTIMODAL FOUNDATION MODELING & INTERPRETABILITY | SCIENTIFIC SOFTWARE`

Check:
- No typo: `MULTIMODAL`, not `MUTLIMODAL`.
- Use `MODELING`, not `MODELLING`.
- Scientific Software should not wrap to a third line on desktop/laptop.
- Mobile wrapping is acceptable if needed.
- No third tagline line.

---

## 5. Contact and social links

Verify and update:
- Email: `sidsoccer21@gmail.com`
- Location: `Los Gatos, California`
- GitHub: `https://github.com/sidhulyalkar`
- LinkedIn: `https://www.linkedin.com/in/sidharth-hulyalkar/`
- Google Scholar: `https://scholar.google.com/citations?user=nuvjyyMAAAAJ&hl=en`

Requirements:
- Contact page uses only `contact`, not both “connect” and “contact.”
- Social section includes all direct professional sites.
- Resume and Google Scholar sections do not have extra secondary descriptive titles.
- Contact page is minimal and spaced cleanly.
- Any future photo area should be optional and not show stock/awkward placeholders.

Search for old email addresses and replace them.

---

## 6. Remove implementation/path text

Search and remove visible text:
`PDF served from /resume/SidharthHulyalkar_Resume.pdf.`

Also remove any similar implementation details from public UI, such as:
- `served from`
- `data layer provides`
- `pending`
- `image pending`
- `empty frame`
- `location pending`
- `date pending`

Do not remove legitimate publication dates or metadata.

---

## 7. Build Cortex project cleanup

The Build Cortex page needs data cleanup and QA.

Requirements:
- Remove `(Fork)` from visible project names.
- Project cards should not show irrelevant fork labels.
- Project links should point to relevant repositories or deployed systems where known.
- Add or verify direct link:
  `https://github.com/bernardosabatinilab/sabatini-datajoint-pipeline`
- Use this link for the Sabatini/DataJoint deployed systems project entry.

Also verify likely direct links if represented:
- `https://github.com/sidhulyalkar/neurOS-v1`
- `https://github.com/sidhulyalkar/NeuroForge`
- `https://github.com/sidhulyalkar/element-deeplabcut`
- `https://github.com/sidhulyalkar/element-facemap`
- `https://github.com/sidhulyalkar/element-calcium-imaging`
- Any neuros-mechint or neuroFMx repo paths if represented in project data

Do not invent links. If uncertain, leave a TODO in the final report rather than adding fake URLs.

---

## 8. Project stack/tag audit

Find the data source for projects. It may be JSON, TS, MD, generated graph data, or a GitHub import script.

Update tags/stacks to show actual programming languages, processing tools, and infrastructure.

Remove vague/misleading tags if more specific tags exist.

Use these as guidance:

### UCSD / NEATLABs projects
Relevant tags:
- MATLAB
- Python
- LFP
- EEG
- behavioral analysis
- Granger causality
- cross-correlation
- Q-learning
- electrophysiology
- optogenetics
- behavioral rigs

### DataJoint / deployed systems
Relevant tags:
- Python
- DataJoint
- Docker
- AWS
- Kubernetes
- MySQL
- S3
- EFS
- Terraform
- SpikeInterface
- Suite2p
- CaImAn
- DeepLabCut
- Facemap
- fiber photometry
- calcium imaging
- electrophysiology
- pose estimation
- worker orchestration

### neurOS / neuroFMx
Relevant tags:
- Python
- PyTorch
- FastAPI
- NWB
- Zarr
- WebDataset
- Mamba
- transformers
- Perceiver IO
- LoRA
- FSDP
- real-time inference
- neural time series
- foundation models

### neuros-mechint / interpretability tools
Relevant tags:
- Python
- PyTorch
- mechanistic interpretability
- path patching
- ACDC
- counterfactual interventions
- Bokeh
- Plotly
- neural models

### Frontend/web projects
Relevant tags:
- React
- TypeScript
- Vite
- Tailwind
- SVG
- accessibility
- responsive design

Rules:
- Inspect actual repo/package files before editing if available.
- Check README, package.json, pyproject.toml, setup.py, requirements.txt, and project metadata.
- Do not claim tools that are not reflected in the repo or known project metadata.
- Keep tags concise.

---

## 9. Visual Archive QA

Verify:
- Label is `Visual Archive`.
- No `Visual Field Notes`.
- No awkward placeholder text:
  - `Image Pending`
  - `Empty Frame`
  - `Location Pending`
  - `Date Pending`
- If images are not ready, page should be extremely minimal.
- No stock placeholders.
- Background should be angular dendritic morphology.
- Page should leave room for future curated photos but not look broken.

Acceptable empty-state copy if needed:
`Selected field images will appear here once curated.`

Even this can be omitted if visual layout works without it.

---

## 10. Paper Archive QA

Verify:
- Publication cards retain accurate metadata.
- DOI/PDF/PubMed/PMC/OpenAlex links work where available.
- Missing PDFs are not loudly displayed as `PDF pending` unless intentionally minimal.
- Tags are not visually dominant.
- Card layout is readable and aligned.
- No duplicate publication entries.
- No fake links.

---

## 11. Resume / highlights / skills

Verify:
- Resume PDF link works.
- No implementation path text appears.
- Highlights section emphasizes skills clearly and concisely.

Skills to include where appropriate:
- Neural data systems
- Multimodal ML
- Scientific software
- DataJoint
- Python
- Docker
- AWS
- PyTorch
- FastAPI
- React / TypeScript
- NWB / Zarr
- Calcium imaging
- Electrophysiology
- DeepLabCut / pose estimation
- Suite2p / CaImAn
- Mechanistic interpretability
- Foundation models
- Real-time systems / BCI infrastructure

---

## 12. Build, lint, accessibility, responsive tests

Inspect package manager and scripts, then run available commands:
- install command if needed
- lint
- typecheck
- test
- build

Also manually inspect:
- desktop
- laptop
- tablet
- mobile

Check:
- no horizontal overflow
- readable text
- keyboard navigation
- focus states
- accessible labels
- reduced motion support
- console errors
- broken routes
- broken links

If browser automation exists, use it. If not, manually run the dev server and inspect.

---

## 13. Suggested targeted commit sequence

Use small safe commits:
1. `qa remove stale navigation labels`
2. `qa update contact footer social links`
3. `qa rename identity to core`
4. `qa clean project names and links`
5. `qa update project stacks`
6. `qa remove placeholder text`
7. `qa accessibility responsive build fixes`

---

## 14. Final report format

At the end, report:

1. Summary of what you checked
2. Files changed
3. Commands run and results
4. Routes manually inspected
5. Broken links fixed
6. Remaining issues
7. Any places Claude should revisit visually

Be explicit. If something could not be verified, say so.
```

---

# Quick Paste Prompt for Claude Code

Use this shorter prompt if you want to paste directly into Claude Code without the whole guide:

```text
Refactor Sid Neural Net to fix the remaining design/content issues.

The current backgrounds are wrong: they still look like abstract space/orbit curves. Remove every long smooth Bezier/spline/orbit/starfield/giant sweeping line from subpages. Replace the reusable NeuralBackground with sparse angular dendritic neural morphology matching the homepage neuron: segmented polyline branches, asymmetric arborization, branch splits, tiny junction nodes only, low-contrast muted gray/cyan opacity ~0.05–0.18, no animation loops, no large smooth curves.

Apply this to all subpages, especially Visual Archive and Build Cortex.

Simplify pages further:
- No top nav, map, atlas, full brain view, hamburger, or menu.
- Keep only the top-left dendrite + hexagon home control on subpages.
- Rename Identity to Core everywhere user-facing.
- Remove secondary titles/descriptions across pages.
- Make subpage titles smaller, code-like, and minimal.
- Remove “PDF served from /resume/SidharthHulyalkar_Resume.pdf.”
- Contact page should use only “contact,” not connect/contact, and should be minimal.
- Update email to sidsoccer21@gmail.com.
- Update location to Los Gatos, California.
- Add direct links: GitHub https://github.com/sidhulyalkar, LinkedIn https://www.linkedin.com/in/sidharth-hulyalkar/, Google Scholar https://scholar.google.com/citations?user=nuvjyyMAAAAJ&hl=en.
- Footer on homepage must be exactly two lines on desktop:
  SIDHARTH HULYALKAR
  NEURAL DATA SYSTEMS | MULTIMODAL FOUNDATION MODELING & INTERPRETABILITY | SCIENTIFIC SOFTWARE
- Use MODELING, not MODELLING. Fix MULTIMODAL typo.
- Visual Archive should not show Image Pending / Empty Frame / Location Pending / Date Pending.
- Remove “(Fork)” from Build Cortex project names.
- Improve Build Cortex card layout so it feels minimal and on-theme.
- Add relevant deployed system/project links, including https://github.com/bernardosabatinilab/sabatini-datajoint-pipeline for the Sabatini/DataJoint pipeline.
- Update project stacks/tags to show real languages/tools/infrastructure: UCSD = MATLAB, Python, LFP/EEG/ephys/behavioral analysis; DataJoint = Python, DataJoint, Docker, AWS, Kubernetes, MySQL, S3, EFS, Terraform, SpikeInterface, Suite2p, CaImAn, DeepLabCut, Facemap, etc.; neurOS/neuroFMx = Python, PyTorch, FastAPI, NWB, Zarr, WebDataset, Mamba, transformers, Perceiver IO, LoRA, FSDP; mechint = Python, PyTorch, path patching, ACDC, counterfactual interventions, Bokeh/Plotly.

Run build/lint/typecheck if available and report changed files, commands, results, and screenshots/page notes for homepage, Visual Archive, Build Cortex, Contact, Paper Archive.
```

---

# Quick Paste Prompt for Codex

Use this after Claude finishes the visual pass:

```text
Act as QA/data-integrity engineer for Sid Neural Net after Claude’s design refactor.

Check all routes and fix safe issues without overwriting Claude’s visual work.

Verify:
- No top nav, Map, Atlas, Full Brain View, hamburger/menu remain.
- Subpages use only top-left dendrite + hexagon home control.
- No smooth orbit/space/Bezier/starfield backgrounds remain. Backgrounds must be angular segmented dendritic neural morphology.
- Identity is renamed to Core everywhere user-facing.
- Homepage footer is exactly:
  SIDHARTH HULYALKAR
  NEURAL DATA SYSTEMS | MULTIMODAL FOUNDATION MODELING & INTERPRETABILITY | SCIENTIFIC SOFTWARE
- Email is sidsoccer21@gmail.com.
- Location is Los Gatos, California.
- GitHub, LinkedIn, Google Scholar direct links exist:
  https://github.com/sidhulyalkar
  https://www.linkedin.com/in/sidharth-hulyalkar/
  https://scholar.google.com/citations?user=nuvjyyMAAAAJ&hl=en
- Remove visible implementation/path text like “PDF served from /resume/SidharthHulyalkar_Resume.pdf.”
- Remove awkward placeholders: Image Pending, Empty Frame, Location Pending, Date Pending, loud PDF Pending.
- Remove “(Fork)” from Build Cortex names.
- Add/verify project link for Sabatini/DataJoint:
  https://github.com/bernardosabatinilab/sabatini-datajoint-pipeline
- Audit project links for neurOS-v1, NeuroForge, element-deeplabcut, element-facemap, element-calcium-imaging, neuros-mechint/neuroFMx where present.
- Update project stacks/tags to reflect real languages/tools/infrastructure by inspecting data files and repo/package metadata.
- Run available package scripts: lint, typecheck, test, build.
- Check accessibility, keyboard navigation, focus states, route behavior, responsive layout, console errors, and broken links.

Final report:
summary, files changed, commands run/results, routes checked, fixed issues, remaining visual issues for Claude.
```
