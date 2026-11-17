# FRONTIER Research Journal: adaptive presentation contract

FRONTIER is a source-grounded reading interface, not a generic article gallery or a data dashboard.
A reader can encounter a paper, a repository, a sports event, or a field report; each should reveal
the important evidence first without replacing the source with invented charts or illustrations.

## Design authority

1. **Source data**: title, publication, figures, source metrics, sports state, references, convergence.
2. **Content format**: live/event, measured report, visual source, technical artifact, or brief.
3. **Domain atmosphere**: research, neural, systems, nature, motion, culture.
4. **Personalization**: ranking, seen state and saved preferences remain independent of the presentation.

The first layer controls truth. Formats and atmospheres control only presentation.
No format may synthesize data, convert heterogeneous numbers into a comparative bar, or
invent experiments, metrics, participants, relationships, or scientific figures. Platform
engagement counts (stars, forks, upvotes, comments, citations, etc.) are source activity,
not study results; they belong in the contextual rail instead of the measured-results exhibit.
Auto-generated social covers that simply repeat titles are excluded from the primary figure area.

## A source can change the whole journal environment

The active story supplies a deterministic, reversible domain realm. The reader's
top-level `data-realm` drives paper tint, surface wash, borders, text colors, source
accent, indicator, figure background, editorial rail, and section rhythm.
`data-format` adjusts composition. No continuous animation or heavy canvas is needed;
reduced-motion preference disables transitions.

| Realm | Canonical input | Accent |
| --- | --- | --- |
| Research | general papers and methods | Copper |
| Neural | neuroscience lane | Deep teal |
| Systems | engineering, building and competitions | Slate blue |
| Nature | life, outdoors and exploration | Botanical green |
| Motion | sports and world soccer | Mineral ochre |
| Culture | games, screen, music, internet culture | Muted plum |

Format precedence is deliberately deterministic:
`sportsState` → `live`; source metrics → `measured`; verified source figure
→ `visual`; repository/benchmark/formula/release artifact → `technical`;
otherwise → `brief`.

Presentation is chosen using `lib/frontier/journalPresentation.ts`. This module
does not change ranking, retrieval, seen state, personalization or source trust.

## Information grammar

- **Brief**: readable source summary; no placeholder media or data decoration.
- **Visual**: true publisher image/figure precedes summary, with original caption and attribution.
- **Measured**: reported values are prominent in separate, non-comparative cards.
- **Live**: event scores or standings are prominent. Preserve event status and source timestamps.
- **Technical**: primary repositories, formulas, benchmarks and releases appear as code-aware
  source references. Never render source text as executable code.

`FrontierJournalEvidence` accepts only existing `FrontierItem` fields and bounds each
visual collection to prevent flooding the reader. The content is source-based and
never treated as a confidence measure or personalization vote.

## Offline, verified research figures

The initial snapshot and live search never fetch a paper's full HTML on a
visitor's request. The scheduled/deep refresh can opt into
`FRONTIER_ENRICH_SOURCE_FIGURES=1` through `scripts/build-frontier-snapshot.ts`.
The scheduled workflow enables this on master, while pull-request candidate
audits leave it disabled.

The figure enrichment is intentionally bounded:
- At most three canonical `https://arxiv.org/abs/<id>` papers per deep run.
- At least three seconds between attempts, and a short deadline on each fetch.
- Only arXiv-owned HTML and same-paper raster image paths are eligible.
- Only actual `figure.ltx_figure` imagery paired with `figcaption` qualifies.
- At most two original figures per paper, with source caption, credit, and
  navigable HTML-figure provenance. Unknown captions or SVG/table-only content
  cannot be promoted.
- Errors, inaccessible HTML, non-HTML responses and exhausted budgets leave
  the original paper payload unchanged.

The site uses the resulting existing `FrontierItem.figures` field. A source
figure gets its native caption and a link back to the figure on the source HTML,
not an invented illustration or inferred experimental result.

## Real motion sources

A publisher-provided progressive HTTPS MP4/WebM/Ogg is only mounted into the
player after an explicit Play gesture. Initial paint uses the authentic poster
when present and never fetches the video bytes. YouTube/unsupported formats
open the original source without adding a heavyweight embedded player.
Playback errors retain a direct original-source link. Poster images are
removed from the generic research-figure list to prevent duplicates.
Canonical arXiv abstract records also expose their source-derived PDF link.

## Source-grounded research threads

`journalRelatedItems` links stories only when normalized source tags actually intersect.
If no same-tag article exists in the current edition, the rail falls back to clearly
labeled sequential reading. Never call an arbitrary subsequent article "related".
No search alone is recorded as evidence of enduring user preference.

## Performance and interaction constraints

- The first page remains server-backed by the cold snapshot; no WebGL or live source mesh.
- One article is mounted at a time and no more than one full source figure mounts.
- Topic changes should not remount the app shell or reset saves and reading state.
- Original source URLs stay accessible. Figures retain caption, credit and URL fallback logic.
- Hold-to-rate and exact-score revision maintain their original persistence semantics.
- `prefers-reduced-motion`, keyboard access, legible mobile text, no sideways scrolling.
- No source should present duplicate title posters or fabricated illustrative data.

## Release acceptance

1. Run TypeScript, warning-free lint, all unit tests, production build and JS budget.
2. Run `scripts/frontier-focus-reader-audit.cjs` at desktop 1440px and mobile 390px/320px.
3. Audit genuine text-only, sourced figure, metrics, technical artifact and sports-state samples.
4. Check the exact Git commit's Vercel preview; review captured screenshots from
   `artifacts/frontier/journal/` and correct layout problems before merging.
5. Verify that the original article, search, saves, feedback, scores and background refresh
   still work. Production remains untouched until the draft PR meets these checks.

## Further development

The existing advanced discovery surface is intentionally not imported into the cold reader.
Bring the same realm tokens and evidence grammar to `/frontier/advanced` as a separately
tested integration, rather than pulling its costly 3D/streaming graph into first paint.
