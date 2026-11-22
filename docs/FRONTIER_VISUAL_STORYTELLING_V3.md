# FRONTIER / Adaptive Visual Storytelling V3
**Design reference:** [Ai2 · Another way to view our planet](https://narrative.allen.ai/olmoearth-embeddings)
**Aim:** Turn credible discoveries into compact, source-grounded, delightful explanations, not generic cards or visual decoration.

## What the reference actually does

The Ai2 narrative teaches before it asks the visitor to manipulate a full explorer.
Its progression is visibly structured:

1. A broad human-scale question and a way into the work.
2. A concrete Peru example: **satellite observation → observations over a year → embedding → comparison → finding similar environments**.
3. Five situated examples whose controls match the question: **before/after change, progressive labeling, similarity threshold**.
4. A handoff into a full embeddings explorer for unconstrained use.

The maps and controls are not interchangeable ornaments. Each visual manipulation is the **explanation itself**: a difference stripe shows representation distance, a comparison slider shows change, and a source-specific threshold changes the actual similarity overlay. Its chapter navigation and short instructions keep the experience oriented.

**Interpretation for FRONTIER:** copy the teaching choreography, not Ai2's graphic treatment, data or code. Do not embed their proprietary story, reproduce imagery without rights or use their scientific values in unrelated work.

## The experience in one sentence

**A personally edited atlas of ideas where each source unfolds as a short visual investigation, and every interaction reveals something real.**

### Level 1: World (what am I browsing?)

A slim, persistent subject navigation with For you / Research / Engineering / Sports / Entertainment / Nature. Each section is a curated source subset, not a separate feed backend. An active story controls a subtle, reversible overall atmosphere. Use typography and image treatment for identity; color alone cannot communicate meaning. Keep clear provenance and no automatic content fetch on section switch.

### Level 2: Story (why is this interesting?)

Each article has up to four progressive steps, only when supported:
- **Orient:** the concrete question; source, authors, date, one short compelling but faithful statement.
- **Understand:** what was done, observed or released; a concept diagram *only* if clearly labeled interpretive and backed by verified steps.
- **Inspect:** primary evidence, e.g. a genuine figure, known benchmark, reported timeline, original clip, official match statistics.
- **Experiment:** direct manipulation of the evidence with a source-valid operation; otherwise provide a labeled reading/sourcing handoff.

No generic wizard, fake progress steps or empty panels. If a source has only text, excellent reading is the correct presentation.

### Level 3: Instrument (what can I do with this evidence?)

Every content family can offer a different **visual instrument** chosen by the available evidence and the user's question:

| Source/domain | Preferred scene | Valid interaction | Required evidence | Safe fallback |
| --- | --- | --- | --- | --- |
| Neuroscience | Experimental task ↔ observed behavior ↔ neural recording | Synced cursor, trial filter, region highlights | Actual time-aligned task and signal data | Source task diagram/figure and documented protocol |
| Behavioral science | Stimulus → action → outcome over recorded trials | Scrub real trials, condition comparison | Trial/event timestamps or original task schematic | Published experimental figure |
| AI/ML papers | Model schematic + benchmark ledger | Inspect modules, select dataset and named metric | Paper figures, equations, bounded table cells | Original paper figures and source abstract |
| Open-source tools | Verified input → pipeline → output graph | Trace documented stage, inspect entrypoint and release | Manifest/README/workflow and version provenance | Repo identity and labeled reference links |
| Soccer/sports | Scoreboard, real pitch/event map, actual timelines | Filter match/player, scrub logged events | Official event locations/timestamps | Source status/standings, not invented tactics |
| Skiing/action footage | Timeline of action beats and original video | Scrub authentic footage, compare frame sequences | Video plus decoded timestamps/frames and permitted display rights | Click-to-play original clip/poster |
| Nature & ecology | Field notebook, habitat map, authentic media | Compare real timepoints, explore documented species | Sourced geolocation, imagery, observations | Credited field photograph and original source |
| Games/anime/film | Creative release room | Explore announced features, trailers and release versions | Official trailers/patch notes/artwork | Developer source and original media |
| Music | Listening and scene context | Artist/lineup exploration and lawful external playback | Official metadata/rights/links | Source announcement and artist page |
| World/unknown | Clear editorial report | Compare independently sourced accounts | Actual corroborating sources | Unembellished text and provenance |

## Make a scene teach, not merely move

A scene schema must distinguish **raw observation**, **publisher claim**, and **interpretation**:

```ts
type VerifiedScene = {
  id: string;
  question: string;
  mode: 'read'|'original-figure'|'figure-comparison'|'timeline'|
        'source-flow'|'benchmark'|'map'|'sports-events'|'original-video';
  evidenceIds: string[];
  sourceUrls: string[];
  provenance: 'publisher-original'|'verified-derived'|'editorial-explanation';
  accessibleSummary: string;
  interaction?: {
    kind: 'select'|'scrub'|'compare'|'highlight';
    permittedOperation: string;
    units?: string;
  };
};
```

The future scene planner is **deterministic, bounded and evidence-gated**:
1. Acquire source and provenance (PDF/HTML/repository/video/official event feed).
2. Normalize evidence into typed figures/tables/media/series and source references.
3. Select only scene templates whose *required evidence contract* is satisfied.
4. Render one scene in the visual stage; other chapters remain lightweight text anchors.
5. Mark derived/explanatory graphics as such, never as a figure extracted from a paper.
6. Let the reader switch between **Story**, **Evidence**, and **Original source**.

The system may use model-generated explanation drafts, but claims need precise evidence anchors and uncertainty review. Generated graphics cannot be silently passed off as observational measurements.

## The visual identity

**Editorial rather than dashboard**. Target an approximately 40px desktop article title ceiling, 16–19px reading text, and a 7:5 evidence-to-copy split on spacious screens. Use 12-column composition, strong baseline rhythm, and carefully clipped media stages. Avoid large empty hero panels.

**Source plays the lead.** A real microscope image, diagram, neural trace, code graph, satellite map, match timeline or frame sequence can own 55–65% of the story stage. Otherwise text owns it. This avoids repeating a title in an invented poster.

**Subtle global response.** Research: warm parchment and precise typesetting. Neural/behavior: moss/teal with experimental timelines. Engineering: slate and monospaced labels. Sports: tactical-field green/ochre but no fake pitch. Entertainment: muted violet or cobalt, imagery led. Nature: mineral greens and original photography. The palette can transition in roughly 200–300ms, but not by flashing/saturating backgrounds; respect reduced motion.

**Interactions have an epistemic purpose.** Sliders only for genuinely corresponding before/after images; maps only for real coordinates; barcodes and embedding projections only with actual embeddings; neural traces only with actual recordings; charts only with comparable units and measurements.

## Navigation, responsive behavior and accessibility

- Top subject strip shows available story counts and uses local loaded candidates. The selected article keeps a stable single DOM article.
- Within a story, small chapter markers can control a **sticky evidence stage** while text scrolls. On mobile this becomes evidence above its explanation; never scroll-jack, auto-play footage, or block scrolling.
- Explicit Show source and See methods affordances; keyboard focus, captions, descriptive alt text, contrast and reduced-motion equivalents.
- Progressive enhancement: story text and provenance must be usable without intersection observers, media playback, 3D or remote images.
- Do not mount all video sources, large tables, 3D maps or offscreen stages on first paint. Lazy-load only the chosen evidence instrument.

## Current implementation, and why it is deliberately incomplete

The Research Journal branch has domain atmospheres, five source-evidence formats, verified figure/caption extraction for a bounded arXiv subset, an original-video exhibit, and local subject editions. This is the **foundation**, not yet the full scrollytelling engine.

A full responsive visual story requires better **source enrichment**, especially tables, experimental metadata, source figures, method sections, timestamped sports/video events, and dataset manifests. It would be misleading to fake these to fill out a visual stage.

## Roadmap and qualification

**V3.0: Source shelf**: six editorial tabs, semantic source routing, preserves mixed For you, keyboard/mobile tests. Implemented in draft PR #169.

**V3.1: Guided evidence scene**: for one qualified paper, introduce a compact interactive step controller using its actual available figure(s), methods/claim source snippets and provenance. The same controller must degrade to text on sources with no evidence. Golden fixture: a properly figure-rich arXiv HTML record.

**V3.2: Typed extractors**: structured paper methods/benchmarks, deterministic README pipeline references, source-video temporal frames, and official match-event schema. Keep extraction offline and source-cited.

**V3.3: True scene templates**: original figure carousel, eligible paired-image comparison, documented pipeline flow, measured benchmark chart, event timeline, behavior/neural synchronization when data exists.

**V3.4: Advanced explorer**: bring the same tokens and evidence schemas to `/frontier/advanced` without forcing its GPU/background machinery onto the default page.

Each milestone must pass typecheck, lint, unit tests, browser first paint, 1440/390/320px screenshot review, keyboard/reduced-motion checks, no fabricated media/metrics, full source links and no unexpected feed requests.
