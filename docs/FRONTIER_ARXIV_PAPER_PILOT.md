# FRONTIER / Original-paper extraction pilot

**Status:** Offline parsing and private story bundle compilation, stacked on [PR #172](https://github.com/sidhulyalkar/sids-neural-net/pull/172). This is **not yet a live, interactive paper exhibit**.

## Why we built this first

The reference [Ai2's OlmoEarth embeddings story](https://narrative.allen.ai/olmoearth-embeddings) uses source data to teach progressively. Before building a universal scene engine, FRONTIER must learn to identify what a research paper actually supplies, what can safely be displayed, and what remains unavailable.

Pilot source: [AgentSSL: Can MLE Agents Leverage Unlabeled Data?](https://arxiv.org/html/2611.17323v1), an existing real FRONTIER item. The source has a published HTML paper with a structured contents list, methods, results, ecology applications and license information. The adapter **does not yet assert how many figures will pass extraction on the live page**. CI uses clearly synthetic, source-shaped HTML and raster fixtures. Live-source coverage and rights review remain separate acceptance gates.

## Two-stage content pipeline

```text
Previously acquired arXiv HTML with provenance
      ↓ offline Python HTMLParser (no network)
Candidate sections + original figure/caption/source anchors
      ↓ strict TypeScript source and revision checks
Basic source manifest (readable, zero figure claims)
      ↓ optional explicit figure review, bytes + license + caption digest
Qualified original-figure evidence + SHA-256 asset bundle
      ↓ renderer (future PR)
Guided original paper figure inspector
```

The HTML parser cannot automatically grant a license or decide a scientific result. Its output says `rightsStatus: unverified` even when the paper links to a Creative Commons license. A reviewer or approved source-specific rights adapter must verify actual figure rights and the appropriate attribution before display is authorized.

## Offline source-only extraction

The input must be HTML saved from the **exact canonical versioned** publisher URL, with its acquisition URL, retrieval timestamp and digest recorded in the operator's source audit log. The extractor never makes its own network requests.

```bash
python3 scripts/frontier/extract_arxiv_html.py \
  --paper-id 2611.17323v1 \
  --input /path/to/verified/arxiv-2611.17323v1.html \
  > /tmp/frontier-paper-candidates.json
```

Then create a private, immutable story bundle:

```bash
npx tsx scripts/frontier/build-arxiv-story.ts \
  --paper-id 2611.17323v1 \
  --item-id ingest-arxiv-l2kgb2 \
  --html /path/to/verified/arxiv-2611.17323v1.html \
  --observed-at 2026-11-14T19:13:13.373Z \
  --built-at 2026-11-14T19:13:13.373Z \
  --out /tmp/frontier-pilot-story-v1
```

The bundle contains `manifest.json`, `candidates.json`, `assets.json`, `provenance.json` and an initially empty `assets/` folder. It cannot overwrite an existing output directory.

The timestamp above demonstrates the interface; a real acquisition must use its own honest retrieval/build timestamps. A local HTML file without an audited source acquisition record is not sufficient to claim an independently verified publisher source.

## Explicit asset review

Only when source rights and bytes have been verified, provide a local approvals file and `--asset-root`. Each entry specifies:

- The *exact* original HTML figure URL/anchor and image URL.
- SHA-256 of the original extracted caption. This prevents approvals from being silently reused after a figure's text changes.
- The locally acquired image file relative to a vetted asset root. Paths outside the root are rejected, including symlinks resolving outside it.
- The figure display policy, actual license or explicit rights source, and attribution. Unknown or link-only rights must not be promoted.

The compiler checks bytes for bounded sizes and basic raster signatures, derives a SHA-256 content-addressed key, verifies that the source filename extension agrees with the bytes, and inserts only the approved figure records. **This is a preliminary MIME check, not a complete image decoder or scientific-content verification**. A renderer must still handle failed image decoding and preserve the original source link. A more rigorous decode/dimension check belongs in the subsequent asset-ingestion stage.

Approvals are operator decisions, not inference from an image URL. The bundle writer deliberately refuses output inside `public/`; a separate, reviewed publish step will be required before the website can display actual publisher assets.

## Source integrity and limitations

The code enforces:
- Canonical versioned arXiv IDs and same-paper HTTPS raster paths.
- Structural association of `figure.ltx_figure`, image, `figcaption`, source section and original anchor.
- HTML input max 1.4 MB, max 40 source sections, max 12 figure candidates, bounded captions, max 4 MiB per approved image.
- Content hash and source-revision linkage, not title-based deduplication.
- Fail-closed rejection for malformed image sources, stale review captions, off-source links and extraneous approvals.
- A valid text/source-only story even when zero images are available.

It deliberately does **not**:
- Fetch HTML or images during initial page load.
- Run paper-supplied JavaScript or untrusted source code.
- Infer numerical results, benchmarks, cohorts or experiment trajectories.
- Treat found HTML assets as licensed or automatically renderable.
- Guarantee perfect HTML conversion coverage across arXiv versions.
- Perform scientific peer review or fact-check extracted claims.
- Alter `/frontier` or `/frontier/advanced` in this stacked PR.

## Tests and acceptance gates

```bash
python3 scripts/frontier/extract_arxiv_html.py --paper-id 2611.17323v1 \
  --input tests/fixtures/frontier/arxiv-synthetic-structure.html
node --import tsx --test tests/frontier-arxiv-source-adapter.test.ts
node --import tsx --test tests/frontier-arxiv-story-builder.test.ts
npm run typecheck
npm run lint
npm test
npm run build
```

**Before starting the interactive viewer PR:** acquire and inspect the real versioned HTML, record source fetch status and SHA-256, audit figure/section extraction coverage on a small real-paper corpus, verify actual licensing and asset decode dimensions for one original figure, and save its vetted manifest to a private artifact. The resulting real paper fixture must then pass the same provenance checks as the synthetic regression suite.

## Next vertical slice

Build an opt-in, lazy-loaded **original research figure inspector** that reads the approved manifest, offers understandable source-linked captions and a keyboard-accessible figure selector, and falls back to the paper's original HTML/PDF if the display asset fails. It must not add render-time network parsing or 3D dependencies to the default journal.
