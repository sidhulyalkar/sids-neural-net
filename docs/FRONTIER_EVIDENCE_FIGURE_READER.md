# FRONTIER · Original figure reader (first visual instrument)

**Status:** Stacked draft PR #175. Functional component and guarded synthetic browser
fixture; no real publisher image has been approved or published in this PR.

## What users will see when a story has been published

- A restrained research-journal article with an original research title, a
  source-derived summary, exact publisher and source revision
- One original figure at a time with the **publisher's caption**, attribution,
  and a direct source-anchor link
- Accessible **Previous/Next** and **Inspect image/Fit image** controls
- A three-step reading guide (understand, inspect, verify), not a fabricated
  experiment animation or synthetic measurement plot
- Missing-media fallback with original source and caption still readable
- No third-party model downloads, autoplay, on-demand source crawling, or
  WebGL on the normal Frontier feed

The first-pass viewer treats evidence as publisher-reported. It does not claim
replication, synthesize findings, derive statistics, or create artificial
before/after comparisons.

## Integration architecture

```text
Offline approved source HTML
  → scripts/frontier/extract_arxiv_html.py
  → typed candidates + source anchors
  → reviewed asset bytes + license/attribution + caption hash
  → scripts/frontier/build-arxiv-story.ts
  → private, immutable bundle
    ├── manifest.json
    ├── assets.json
    ├── candidates.json
    ├── provenance.json
    └── assets/<sha256>.<extension>
  → administrative inspection and checked-in publication
    content/frontier/stories/<item-id>/
  → /frontier/story/<item-id>
    ├── server-only qualified manifest loader
    ├── interactive original-figure reader
    └── hash-verifying /api/frontier/story-assets/<item-id>/<sha256>
```

Nothing in the normal `app/frontier/page.tsx` imports the inspector or private
story loader. Source-candidate images are never promoted to website imagery by
the existence of an `<img>` element alone.

## Publication gate

1. Acquire publisher HTML externally through a controlled, rights-compliant
   process. Freeze the canonical arXiv **versioned** ID, HTML digest, retrieval
   timestamp and source-asset provenance. The CLI itself makes no network calls.
2. Run the offline source builder in source-only mode. Inspect the candidates
   and source anchors. Source-only manifests have no displayable figure stage.
3. Separately review each figure's redistribution/display rights and record the
   exact rights basis, attribution and immutable local asset bytes.
4. Provide the explicit `--approvals` file and private `--asset-root` when
   rerunning the builder into a new output directory. Never overwrite an
   existing approved bundle without review.
5. Inspect the manifest, original captions, asset hashes and files, then
   publish a curated bundle under `content/frontier/stories/<item-id>/`.
6. Visually review the built route at desktop, 390px and 320px mobile widths,
   then verify all source anchors and missing-media states before promotion.

A source with no approved figure should remain in the normal editorial reader.
It should not be given a pseudo-figure to make the route appear richer.

## Security rules

- Only safe article IDs route to a checked-in, known content directory.
- No arbitrary source URL can be sent to the asset route.
- Private asset paths must be exactly `assets/<sha256>.{png,jpg,webp}`,
  with the file present inside the approved bundle directory.
- The image gateway verifies actual bytes against SHA-256 on every read and
  refuses missing, mismatched, overlarge or unapproved images.
- An unknown or unpublished `/frontier/story/<id>` returns 404.
- The source figure URL is shown as a publisher citation, not used as an
  unverified in-page media URL.
- The CI-only `/frontier/evidence-audit` and matching synthetic SVG asset
  endpoint return 404 when `FRONTIER_INTERACTION_AUDIT` is disabled.

## Testing

The CI browser suite runs
`scripts/frontier-evidence-story-browser-audit.cjs` at 1440, 390 and 320
pixel widths with reduced-motion enabled. It verifies original figure
switching, captions and publisher anchors, zoom control, a failed-media
fallback, unknown route rejection and no horizontal overflow. Screenshots
are saved to `artifacts/frontier/evidence-story/` for visual review.

Unit/source-adapter tests remain in PRs #172 and #173. This PR is stacked on
#173, not independently mergeable into master before its contracts land.

## Next milestones

This is **one working source-backed instrument**, not the full Ai2-style
interactive explanation engine. After a genuinely rights-cleared pilot paper
passes visual review, build a source-tied section/figure narrative
(`Orient → Methods → Evidence → Limitations`), then normalized benchmark
tables, actual software pipeline graphs, and eventually temporal motion and
neural-data explorers. Every new instrument needs its own evidence eligibility
contract and accessible fallback.
