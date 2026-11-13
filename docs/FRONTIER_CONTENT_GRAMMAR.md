# FRONTIER / Personal content grammar
**Implementation direction · November 2026**

Frontier is a personalized instrument for discovering and understanding useful
ideas. It is not a generic technology news aggregator. Presentations should reveal
the kind of intellectual evidence the visitor actually has, while celebrating the
source's form and preserving its provenance.

## Three independent decisions per story

1. **Realm**: what subject/world does the story belong to? Affects the site's
   background tint, type emphasis, source indicator and contextual accents.
   Current themes: research, neural, behavior, systems, nature, motion, culture.
2. **Source lens**: what is the actual source? Paper, repository, discussion,
   video, sports state, game update, music, field observation, reported article.
   A source imprint explains where the content came from without fabricating
   quality or authority.
3. **Evidence grammar**: what material is available and renderable? Text,
   genuine figures, measurements, sports state, technical artifacts and
   corroborating sources. This determines article composition.

An arXiv paper about spike sorting and a SpikeInterface software release can
share a neural realm without showing the same layout.

## Source-specific exhibit roadmap

| Content family | Storytelling centerpiece | Useful verified inputs | Do not infer |
| --- | --- | --- | --- |
| Neural dynamics & BCI research | Original experiment schematic, task, modality, neural readout, findings with limitations | Paper figures, methods, datasets, model outputs, reported metrics | Brain activity animations from an abstract |
| Behavioral science | Task design and observed behavior: stimulus → action → outcome, with timing when measured | Trial data, task descriptions, quantitative figures, temporal traces | Synthetic subjects or fabricated trial series |
| Computational models & ML papers | Model architecture and benchmark comparison with baseline, dataset and metric clearly named | Verifiable equations, tables, figures, source results | Performance deltas from popularity numbers |
| Engineering & scientific tools | Executable system map: inputs → stages → outputs, release history, dependencies | README, release notes, workflow files, code repo identity, verified APIs | Assuming repository capabilities from its name |
| Experimental data & open archives | Dataset explorer with modalities, scale, sample preview and protocol provenance | DANDI / NWB metadata, open dataset manifests, schema, methods | Rendered traces without actual recordings |
| Action sports, skiing & outdoor adventure | Authentic clip/storyboard or motion sequence, environmental context, and event timing | Source video, timestamps, captioned frames, terrain/map when sourced | Simulated trajectories presented as observed ones |
| Soccer, fantasy & other sport | Scoreline/standings, lineup, positional context and matchup factors where reported | Official schedule/status, statistics, teams, player roles | Tactical plays or projections without play data |
| Biodiversity & marine environments | Field-guide observation with original photos, species, habitat, date/place | Photo credit, species ID, observation record, ecology references | Species identifications from an ambiguous caption |
| Anime, games & interactive worlds | Release and worldbuilding context, authentic art/video, link to original | Developer announcements, trailers, patch notes, original gameplay | Invented gameplay scenes and release dates |
| Music & bass culture | Event lineups, actual track/artist metadata and playable links where licensed | Artist catalogs, event announcements, official video | Copyrighted playback from metadata only |
| Public discussion | Debate viewpoints with sourced quotations and timestamps | Original thread, score and comments (as activity only) | Popularity as epistemic correctness |
| Unexpected explorations | Clean editorial reporting with diverse authentic sources | Verified articles and evidence | A forced nature visual theme merely because it is a wildcard |

## Evidence acquisition gaps from the current local snapshot

The 2026-11-13 snapshot contains 149 items, including 52 GitHub records and
30 research records across arXiv, Hugging Face Papers and OpenAlex. It carries
no populated `figures` arrays; some images are generic publisher or social
covers. Source-native visualizations must therefore degrade to paper identity,
compact source excerpts, provenance, original media and meaningful external
links rather than making up schematics.

Prioritize a separate, provenance-safe enrichment pipeline that fetches and
indexes optional evidence for admitted sources *after* the rapid cold snapshot
is served. Each extracted block should include:

- source_url, fetch/observation date, license/attribution and original location
- asset URL or bounded exact excerpt, type (figure/table/method/result)
- evidence status (verified/source-provided/unavailable), caption/units, modality
- linkage to the original item ID, retry-safe source ID, meaningful uncertainty
- explicit absence rather than a fabricated replacement

Only elevate numerical claims when the original measurement and its units are
available. Label data figures and conceptual illustrations differently. Any
generated explanation is an explanation, not experimental evidence.

## Visual experience rules

- Compact 28–42px major titles, legible text at 16–22px, no duplicated headers.
- First paint remains a source-grounded snapshot, with no mandatory 3D runtime.
- For actual figures, show the figure with its caption and credit before large
  paragraphs when the source format benefits from that treatment.
- For software, give verified technical provenance visual priority over decorative
  social cards; platform stars/forks stay small and labeled as activity.
- For live sports, show the status and observed scores first, clearly timestamped.
- For short video, use poster, duration and a direct link to the verified original;
  no fake play controls. Action frames and segment timelines require real frames.
- For behavior, explicitly privilege measurements, time alignment and tasks over
  generic brain imagery.
- For a source with only text, embrace excellent typography instead of a fake
  dashboard. Do not render empty evidence sections.
- Related stories must be source-tag-grounded or explicitly labeled as adjacent
  in the edition. A personal connection should be marked as interpretation.
- Transitions should change the entire journal atmosphere *subtly*, without
  re-fetching, remounting or requiring GPU work. Honor reduced motion.

## Curatorial implications

Preserve the selected balance: conceptual depth and relevance, with an intentional
fraction of discoveries beyond established interests. Do not turn the site into
a filter bubble. Favor observable methods, original figures and explanatory
utility; de-emphasize generic AI announcements, repeated summaries, rumor
headlines and content that is not clearly related to the selected category.

## Release criteria

- Run unit tests for source identity and domain mapping; test known ambiguous
  wildcard, paper, code, YouTube, field and behavioral cases.
- Verify no made-up code metrics, animal data, causal connections or figure assets.
- Browser screenshots at 1440px / 390px / 320px: no overflow, no giant empty media,
  accessible focus and source links, correct topic atmosphere.
- Keep source-specific components light. Share a structured source lens with the
  advanced exploration route only after the default reader passes qualification.
- Never merge a preview without green exact-head CI and a source-coverage audit.
