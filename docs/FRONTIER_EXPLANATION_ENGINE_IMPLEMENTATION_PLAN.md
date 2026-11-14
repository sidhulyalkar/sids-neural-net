# FRONTIER Explanation Engine
## Evidence-first implementation plan and release contract

Status: planning specification; **not a claim that the scene engine exists**.
Baseline examined: draft PR #169 at 409fab60ef4791b7a82587fab93d95823ad01d87.
Reference: https://narrative.allen.ai/olmoearth-embeddings

### 1. The product we are actually building

FRONTIER is a personally edited atlas of interesting ideas. Its six editorial areas are For you, Research, Engineering, Sports, Entertainment, and Nature. Every item must stay easy to scan and readable without interactive JavaScript, media playback, or a high-end GPU.

The differentiated experience is a **guided visual investigation**. First establish a question and the original source, then explain the mechanism, inspect credible evidence, offer a genuinely evidence-supported operation, and provide a path to the original dataset/paper/repository/video. The adaptive behavior is the **choice of scene and explanation**, not merely ambient background color.

OlmoEarth's reference choreography is useful because it takes a concrete satellite image, teaches embeddings through a progression of comparisons, demonstrates change/similarity operations on real data, and then opens a richer explorer. Reuse its teaching principles and interaction discipline, not its graphic assets, branded appearance, scientific observations, or implementation.

**Definition of done for an interactive story:** A visitor can identify (1) the central question, (2) what the source actually did, (3) what is reported, (4) a limitation/uncertainty if present, and (5) exactly where a claim or interaction came from. If evidence is absent, a beautiful readable source note is correct.

**Non-goals for the first release:** a generic LLM that generates arbitrary charts; a 3D scene for every story; unlicensed paper-image mirroring; automatic external media autoplay; synthesizing neural activity or match trajectories; running untrusted source code; replacing the fast /frontier snapshot with /frontier/advanced machinery.

### 2. Baseline reality and constraints

The current default route app/frontier/page.tsx imports the cold snapshot and FrontierFocusReader only. Keep that SSR/first-readable-paint isolation. The advanced route imports BackgroundCanvas and the heavier FrontierExperience, background signals, and synchronization machinery. These remain separate delivery bundles.

Current FrontierItem carries title, summary, source identifiers, media, a small figures array, metrics, sportsState, simple artifacts, convergence members, and ranking/personalization fields. It is **not** an evidence model for methods, trial tables, provenance locators or timelines. The short summary-oriented sourceBrief does not manufacture facts. The arXiv HTML figure parser in paperFigures.ts only attempts a small bounded subset; it uses structural assumptions about ltx_figure HTML and will not cover every publication.

The committed November 13 snapshot contains 149 items: 0 with figures, 0 with structured artifacts, 68 with metrics, 3 with structured sports state, and 92 with media URLs. Many metrics are source-activity counters, not scientific measurements. Existence of a media URL does not prove rehosting, offline playback, or redistribution rights.

Draft PR #169 is already large (85 commits, 26 changed files at baseline). **Freeze and visually audit it as a shell release.** New evidence and scene work should be separate small PRs against the accepted base, not an endless addition to PR #169.

### 3. Three separate data layers

**Discovery item** (existing FrontierItem): compact summary, recommendation metadata, reliable link and optional hero media. Cached/snapshot-friendly.

**Evidence bundle** (new, fetched only on deliberate deep read or a nonblocking qualified cache): bounded typed records from an original publisher, official API, repository, or public dataset. Has provenance, version and extraction status. Cannot silently claim independent reproducibility.

**Story manifest** (new, deterministic projection from qualified evidence): ordered chapters, scene type, source anchors, labels, permitted interactions, and fallback state. This is presentation selection, not evidence generation. A compiler should not invent missing records to satisfy a desired scene.

Do **not** put full document HTML, binary figures, long time-series, embedding tensors, or source code inside every FrontierItem in the daily snapshot. Use a separate content-addressed manifest and lazily loaded assets.

Suggested first schema (Zod 4 already exists in package dependencies):

\`\`\`ts
type EvidenceStatus =
  | 'publisher-reported'        // sourced claim, not independently reproduced
  | 'extracted-needs-review'    // may be shown as quotation with caution; not data chart
  | 'verified-derived'          // explicit, reproducible computation from cited source data
  | 'unavailable';

type SourceLocator = {
  sourceUrl: string;            // canonical, allowlisted HTTPS
  documentId: string;           // exact paper/repo/event identity
  version?: string;             // versioned paper, commit SHA, event timestamp
  section?: string;             // publisher heading / section or figure identifier
  page?: number;
  span?: { start: number; end: number }; // stable original text offset when available
  retrievedAt: string;
};

type EvidenceRecord =
  | { type: 'quotation'; id: string; text: string; locator: SourceLocator; status: EvidenceStatus }
  | { type: 'figure'; id: string; assetRef: string; caption: string; alt: string;
      locator: SourceLocator; status: EvidenceStatus; rights: AssetRights }
  | { type: 'measurement'; id: string; value: number; unit: string;
      metric: string; dataset?: string; split?: string; cohort?: string;
      comparatorId?: string; locator: SourceLocator; status: EvidenceStatus }
  | { type: 'series'; id: string; assetRef: string; xUnit: string; yUnit: string;
      clockOrFrameBasis?: string; locator: SourceLocator; status: EvidenceStatus }
  | { type: 'event'; id: string; time: string; label: string; eventType: string;
      locator: SourceLocator; status: EvidenceStatus }
  | { type: 'source-file'; id: string; path: string; commit: string;
      verifiedRole?: 'input'|'transform'|'output'; locator: SourceLocator; status: EvidenceStatus };

type AssetRights = {
  display: 'permitted'|'link-only'|'unknown';
  license?: string;
  attribution?: string;
};

type SceneType =
  | 'editorial-reading' | 'original-figure' | 'figure-compare'
  | 'benchmark-table' | 'verified-pipeline' | 'event-timeline'
  | 'source-video' | 'sports-state' | 'geospatial-observations'
  | 'time-aligned-signals';

type StoryScene = {
  id: string;
  question: string;
  title: string;
  sceneType: SceneType;
  evidenceIds: string[];
  permittedOperations: Array<'inspect'|'switch'|'scrub'|'highlight'|'compare'>;
  accessibleSummary: string;
  annotation: 'publisher-original'|'source-reported'|'verified-derived'|'editorial-explanation';
};

type StoryManifest = {
  schemaVersion: 1;
  itemId: string;
  canonicalSourceUrl: string;
  sourceVersion: string;        // e.g. arXiv v2 or Git commit SHA
  extractVersion: string;
  builtAt: string;
  state: 'basic'|'partial'|'rich';
  evidence: EvidenceRecord[];
  scenes: StoryScene[];
};
\`\`\`

The example is a **conceptual contract**, not drop-in production code. Define bounded text lengths, URL validation, numeric limits, stable IDs and exhaustive type guards in the actual Zod schemas. Keep claim-level confidence/verification semantics distinct from source popularity. An extraction timestamp must not be used as the publication time.

### 4. Evidence ingestion contract

Ingestion is **offline and idempotent**:

1. Resolve canonical origin and revision (arXiv ID/version; DOI/publisher where permitted; GitHub repository + exact commit/tag; official sports event ID; verified video ID).
2. Check publisher rights, robots/API terms and URL security before retrieval.
3. Fetch within explicit concurrency, response-byte and time budgets. Preserve ETags/Last-Modified and audit failed/skipped reasons.
4. Parse DOM/structured API rather than regex-only full-HTML scraping when extending beyond the current limited arXiv proof of concept. Extract figure + caption pairs, source section references, tables and metadata.
5. Normalize units, dates, table dimensions and source selectors. Persist each record with original source URL and revision. Never join data across sources by similar title alone.
6. Validate with schema plus source-specific semantic gates. Keep rejected records in internal diagnostics, not the user story.
7. Derive and store the small manifest; maintain atomic latest index replacement. A failed refresh leaves the previous valid manifest intact.

An evidence bundle cache key should depend on canonical source ID + source revision + extractor version. Manifests also depend on scene-compiler version. Avoid hash collisions and stale overlays when a paper is revised or a repository tag moves.

**First adapter:** arXiv HTML. Audit actual coverage over a frozen paper corpus before widening. Current parser accepts only certain original raster formats and caption lengths; stress test nested markup, multi-panel figures, equations, HTML variation, source redirects, and unrenderable assets. Use arXiv HTML only where the original source grants acceptable display rights. Show linked publisher figure when rehosting isn't permitted.

**Second adapter:** GitHub repositories/releases/commits. Pull documented README sections, release changes and workflow/metadata at a pinned commit. Never create a pipeline graph from a package name or guessed stages. Labels such as "data ingestion" are valid only if an explicit upstream file/workflow describes that role.

**Later adapters:** official sports events and timestamps, source-video cue points, DANDI/NWB/Neurodata Without Borders metadata when available, authoritative ecology/geospatial archives, and official game/music release metadata. Each new adapter needs a fixture corpus and rights review.

### 5. Deterministic scene selection, not an automatic diagram machine

Create a registry of scene definitions. Each definition declares evidence requirements, rendering component and allowed operations. The compiler must produce either a supported scene or an editorial fallback, never a plausible fake.

| Scene | Minimum qualified evidence | Permitted operation | When unavailable |
| --- | --- | --- | --- |
| Editorial reading | canonical source, title, faithful source summary | inspect citation/source | Always the base |
| Original figure inspector | accessible figure + caption + source anchor + display permission | zoom/pan, switch panels | Caption/source link |
| Figure compare | two source-valid paired images, known same target/viewpoint and time or valid registration | labeled before/after slider | Two independent figures, no comparison claim |
| Benchmark view | ≥2 comparable reported measurements with same metric, dataset, split, unit and direction | filter/sort, inspect source cells | Plain reported-value ledger |
| Pipeline explorer | documented nodes and directed edges at a pinned commit or official diagram | select documented stage and source file | Repository/release evidence |
| Video timeline | source video plus verified actual timecoded events / shot spans | seek real timestamp | Source video without fabricated chapters |
| Sports explorer | official event, result and optionally event positions/times | select event or filter official data | Scoreboard/status only |
| Neural/behavior timeline | original signals/events and shared timebase, channels, units, uncertainty | select trial, scrub synchronized signals | Original figures and methods |
| Ecology/geo explorer | source-licensed georeferenced observations/timepoints, coordinate reference and accuracy | spatial inspection or time comparison | Photo/source field note |

Cross-domain comparisons must not turn into visual data comparisons without compatible units and controls. Citation counts, stars, upvotes and HN points are **engagement metadata**, never performance results. A reported model improvement must cite the baseline, metric and evaluation context. A source-labeled interpretive diagram is not an observed experiment.

### 6. Narrative assembly

Each eligible story asks four questions:
- **Orient:** What's the specific question, and why does it matter?
- **Mechanism:** What was actually done? Prefer publisher methods/architecture with a source anchor.
- **Evidence:** What does the original source show? Figures, measurements, documented workflow or actual events.
- **Explore:** What can be directly manipulated or investigated without inventing evidence?

One honest source-only article may have just **Orient + Open source**. A rich paper may have an original figure, source-cited method and benchmark inspection. Do not force four scenes on every item.

Keep explanation text as source quotations, faithful bounded source paraphrases, or explicitly marked editorial interpretation. Any language-model-assisted drafting must emit claim-to-evidence IDs, pass a verifier checking source support, and fall back to source text if unsupported. Human review is required for the pilot's flagship demonstrations and high-impact scientific claims.

### 7. UI architecture and interaction

Keep the existing **six subject shelves** and the topic-based page atmosphere. Build an opt-in "Investigate" mode in the existing focused reader, not a new mandatory route or GPU page.

Suggested component breakdown:
- FrontierStoryShell: displays provenance, title, short explanation and subject chrome.
- FrontierStoryChapters: semantic outline and keyboard navigation; update from scene manifest rather than simple figure-count heuristics.
- FrontierEvidenceStage: one mounted active scene. Lazy-load the scene-specific renderer.
- FrontierEvidenceLedger: evidence IDs, source anchors, publication/retrieval version, publisher claims and caveats.
- FrontierSceneRegistry: supported scene types and required evidence.
- scene modules: FigureInspector, BenchmarkLedger, VerifiedPipeline, SourceVideoTimeline, SportsEvents, GeoObservations, NeuralSeries.
- FrontendStoryState: local active chapter/selection/zoom. Keep this **out of preference memory**. Preserve existing saved/rating/seen and search semantics separately.

**Desktop:** restrained 28–42px headlines; top editorial shelf; 58–65% visual stage with 35–42% concise explanatory text in the flagship investigative mode. Stage sticks while explanation chapters progress; IntersectionObserver is only an enhancement, never required for reading. A scene transition changes labels, highlights and source-specific visual data, not a flashing background.

**Mobile:** stage above the current explanation, naturally scrolling rather than scroll-jacking; smaller static stage, touch targets ≥44px, accessible source citation drawer, no horizontal overflow. Explicit chapter controls, Escape handling, keyboard navigation, alt text, captions, color contrast, reduced-motion CSS. No autoplay. Avoid interpreting smooth scroll as forced program state.

**Visual identity:** one disciplined typographic system, shared spacing, low-saturation realm palettes, no giant duplicated headlines, and no decorative data-looking plots. Differences between Research, Sports, Engineering, Entertainment and Nature should come primarily from authentic content, instrument shape and visual hierarchy; palette is supporting context.

### 8. Delivery and caching

A new source-specific story endpoint can serve prebuilt, schema-validated manifests by stable ID, e.g. /api/frontier/stories/[id] (path must be safe, non-enumerable as sensitive data; public stories are fine). Do not fetch arbitrary user-supplied URLs in this endpoint. First paint remains the current cold-snapshot route and the existing 36-item page contract.

The manifest endpoint returns a small JSON document with version, content hash/ETag and explicit incomplete/failure states. Long arrays, code, tiles, video and full-resolution media remain separately referenced assets, loaded only when a supported chapter is actually opened. If a manifest is missing/stale, the reader stays functional with the present source brief and primary link.

Initially store small versioned manifests and an index with the offline snapshot artifact pipeline. Avoid introducing a database just to ship the first example. If volume becomes large, migrate the same schema to object storage with immutable asset keys and a bounded CDN, without changing the React scene contract. Do not bundle all active manifests into the React Server Component payload.

### 9. Security and rights

- Server fetches: HTTPS, exact allowlisted publisher hosts, public DNS/IP checks, redirect revalidation, MIME and byte caps, timeout and concurrency limits. Reuse the existing secured media proxy. No arbitrary client-provided origin.
- HTML/PDF: treat as untrusted content, parse/sanitize into typed records, never inject raw scripts/HTML or run arbitrary code from a source. PDF extraction is not a first-release dependency.
- Asset display: preserve creator attribution, license, original links, allowed display/rehost behavior, and takedown/invalid-content handling.
- Data: no user medical/wearable/account data in public story manifests; clear opt-in boundaries for any future personalized/private research workspace.
- Instrumentation: record performance and opt-in feedback without leaking a reader's private topic history, clinical data, or detailed behavior to third-party analytics.
- Maintain current source quality and content ranking; no engagement signal should be mislabeled as truth.

### 10. Performance contract

Enforce the **existing** repo-wide client JS ceilings: ≤800 kB compressed aggregate, ≤190 kB largest compressed chunk, ≤500 kB raw chunk. A new story-stage module should be dynamically loaded only for supported evidence. Record **route-specific** shipped JS delta relative to PR #169; no default three.js, embeddings atlas, video decoding worker or map runtime.

Proposed user-facing targets (measure rather than promise):
- Desktop/mobile 75th-percentile LCP ≤2.5s on production-equivalent throttling.
- 75th-percentile INP ≤200ms and CLS ≤0.1.
- Subject tab change under 100ms in a warmed typical browser; no network fetch required.
- No source-video byte request until deliberate play.
- At most one active scene and its directly relevant evidence images mounted.
- No additional requests or measurable layout shift on the default first-readable paint from optional story manifests.
- The existing ≤9s browser first-reader test remains a generous functional gate, **not** the performance target.

Profile with React/Chrome tools; fix the highest-cost renderer first. UI should remain legible when network/media fail, JavaScript is delayed, WebGL is disabled, or reduced motion is requested.

### 11. Gold-standard source fixture suite

Do not choose all fixtures because they will look pretty. Freeze source records *and provenance*:

- **ML paper:** AgentSSL (arXiv 2611.17323v1) as the source-title/abstract baseline; inspect whether real figures or tables are actually available before selecting it as a figure flagship.
- **Neurotech code:** SpikeInterface release/commit appearing in current snapshot. Verify exact release notes, paths and stages before rendering a pipeline.
- **Sports:** official structured NBA scoreboard/status item in the snapshot; later choose a documented event feed if an event timeline is desired.
- **Video:** an eligible licensed original clip or source-hosted YouTube record, with real duration; do not invent cue points.
- **Text-only control:** a source without image or structured evidence; this must remain elegant and fully readable.
- **Nature:** acquire a rights-eligible observation with real georeferenced evidence rather than inventing an example from a currently sparse shelf.

A fixture is accepted only if its exact URL/revision, published text, assets, rights, and expected scene eligibility are recorded. Use real-source HTML fixtures with controlled fake transport in CI so tests remain deterministic and independent of publisher uptime.

### 12. Small PR sequence (each independently reversible)

| PR | Deliverable | Primary acceptance gate |
| --- | --- | --- |
| **0 · Shell release** | Freeze/audit PR #169, inspect 1440/390/320 screenshots, document known gaps, preserve exact-head green CI. Do not merge a massive mixed diff without review. | No UX regression, all current audits green, visual sign-off |
| **1 · Evidence contract** | Zod source/evidence/scene schemas; stable IDs, locators, rights and fixtures. No new renderer. | Invalid/unsafe evidence rejected; gold fixtures stable |
| **2 · arXiv source adapter** | DOM-based figure/caption extraction, method/section anchors, table parsing limited to valid original HTML; cache/version/retry report. | Source provenance exact; unavailable docs fail closed |
| **3 · Scene compiler** | Deterministic evidence-to-scene eligibility registry, no autogenerated data, accessible fallbacks. | Unit matrix for every scene type and negative case |
| **4 · First flagship** | Story shell + lazy evidence stage + original-figure inspector + source ledger for one qualified paper. | Screenshot + keyboard + click-to-source quality bar |
| **5 · Scientific depth** | Verified methods/equations and like-for-like benchmark ledger; optional source-cited explanatory annotations. | No unmatched metrics/incorrect units or unsupported claims |
| **6 · Engineering vertical** | Repository release viewer and verified pipeline-stage inspector with pinned commit anchors. | Each visible stage maps to actual README/workflow/repo path |
| **7 · Temporal verticals** | Official sports state and real source-video event/cue timeline where timestamps exist. | Accurate times/status; source fallback; no autoplay |
| **8 · Nature/culture** | Rights-safe field-guide comparisons and source-native game/music/media modules. | No invented geodata, visual assets or release claims |
| **9 · Shared explorer** | Reuse schema/renderers in /frontier/advanced behind opt-in lazy chunks. | Default page performance unchanged; no double event tracking |
| **10 · Harden/roll out** | Coverage dashboard, error-rate monitoring, visual QA, user tests, feature flag/rollback. | Measured quality/latency and editorial approval |

Parallelism: after PR 1 stabilizes schemas, adapter research for papers, software and official sports can proceed independently. The core renderer depends on validated scene contracts; advanced integration depends on stable components. Avoid opening five dependent WIP branches before PR 1's contract has tests.

### 13. Quality gates and observability

Every PR must pass typecheck, zero-warning lint, unit suite, stable production build and bundle checks, deterministic fixtures, narrow/mobile browser checks, source URL security, and current personalization/reader regressions.

Add **evidence-specific** gates:
- Source fidelity: 100% of displayed quantitative claims have a source anchor, metric name and units (or are explicitly unquantified).
- Truthfulness: no synthetic signals, invented code stages, fabricated timelines, unsourced before/after claims, or ambiguous images labeled original.
- Graceful fallback: force every asset fetch, scene decode, source endpoint and source-video failure in tests.
- Layout: visual snapshots for text-only, 1 figure, multi-panel, benchmark, code, sports, video, unavailable media at 1440/390/320 widths; accessible color/typography.
- Scientific review: hand-check a defined flagship corpus. Track extraction precision and usable-figure rate separately from raw ingestion success.
- E2E: browsing shelf changes does not fetch a live source mesh, lose saved state, reset rating, remount extra articles or leak hidden source media.
- Accessibility: tab semantics/roving focus, arrow navigation where appropriate, proper scene announcement, captions, keyboard-only traversal, contrast and reduced motion.

Instrument: percentage of current discovered sources with usable qualified evidence; rate of evidence-only vs explorable stories; source-click/citation-open conversion; time to answer a task; render/asset failure by source; delta to route JS/LCP/INP. No vanity metric should determine scientific trust.

### 14. User-centered visual acceptance

Review with realistic tasks rather than a glossy screenshot alone:

1. A reader opens a neuroscience paper and can identify the research question, measured variable, conclusion and source caveat without rereading five abstracts.
2. A reader opens a code release and can distinguish a documented capability from a proposed feature, then jump to the exact release/commit evidence.
3. A sports reader immediately sees what is known (result/status/time) and what is not (unavailable player location/tactics).
4. An action video reader can view an actual clip and, when timecoded evidence exists, navigate genuine events; it never plays or invents events automatically.
5. A discovery outside established interests still feels worth reading, with comparable source transparency and strong text-only fallback.

Collect brief feedback: "What did you learn?", "Can you check where this came from?", "Was any visual misleading?", "Would you explore another scene?". Treat clarity, factual grounding and visual restraint as independent pass/fail dimensions.

### 15. Immediate next implementation move

**Do not begin with a general-purpose generative graphic engine.** First close the PR #169 visual-review gate. Then implement **PR 1 (versioned evidence schema, six frozen source fixtures, and eligibility matrix)**. Pick one paper with real renderable source figures and build PRs 2–4 end to end. The first polished scientific investigation becomes the reference implementation for the rest of the site.

When that vertical slice is stable, expand to actual GitHub pipeline evidence and sports/video timestamps. The rest of the visual library should grow by validated source capability, not by pressure to fill every tab with a novel animation.
