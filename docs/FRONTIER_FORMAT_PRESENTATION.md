# FRONTIER format-specific evidence presentation

The default reader retains a **single ranked story**, not a multi-card feed.
Formatting must make the provenance and utility of information clear without
inventing conclusions or swapping content types mid-session.

## Decision contract

`lib/frontier/storyPresentation.ts` derives presentation metadata entirely
from existing trusted `FrontierItem` source fields.

| Source format | Visible lead attribution | Important early material | Original action |
| --- | --- | --- | --- |
| arXiv/bioRxiv/medRxiv | Abstract / source excerpt | Authors and original excerpt; preprint caveat | Open research source |
| OpenAlex | Abstract / source excerpt | Research metadata and any source-reported metrics | Open research record |
| GitHub | Repository description | Genuine implementation description and reported benchmarks | View repository |
| YouTube/Vimeo | Creator description | Creator-provided source description; never an implied transcript | Watch original |
| Sports state | Source coverage | Scores, schedule or standings immediately visible | View score source |
| Community | Linked discussion excerpt | Attributed community excerpts | Open discussion |
| Other news/media | Source overview | Original publisher synopsis | Read original |

### Metric ontology

Frontier never conflates *popularity* with *scientific evidence*.

- Stars, forks, points, upvotes, replies, citations and views are **source
  activity**, not validated performance or a replication outcome.
- Live/final/upcoming counts are **schedule metadata**, not independent evidence.
- Other explicitly supplied measurements are labeled **Numbers reported by
  the source**, without asserting that a reviewer reproduced them.
- Missing metrics and references are omitted rather than replaced by synthetic
  guesses, opaque scores, or algorithmically invented importance summaries.

The browser's top source excerpt remains verbatim (after existing commercial
copy and entity cleaning). Only its placement and *source type label* change.

### Snapshot, not live broadcast

Sports rows are drawn from the supplied `sportsState` payload, with the source
record's publication date. The component states clearly that scores may have
changed; it must not imply a websocket connection or current official result.

### Regression and rollout

```bash
npm test
npm run typecheck
npm run lint
node scripts/frontier-focus-reader-audit.cjs
```

The browser audit mocks format-specific payloads against the real reader and
verifies original-source action labels, visible scores, and the distinction
between activity metadata and performance claims.

Keep these changes stacked on editorial admission #143 and the reader
navigation/transition PR #144. Do not present the 85% quality / 90% relevance
targets as measured until the independent original-source evaluation is labeled.

Website CI also includes unrelated Game Network browser suites. An unrelated
failure must be addressed as its own regression, rather than being hidden or
misrepresented as a FRONTIER pass.
