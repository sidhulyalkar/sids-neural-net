# FRONTIER evidence contract v1

**Status:** Implementation foundation. No scene renderer, source fetcher, or scientific
result generator is included in this pull request.

**Related work:** Draft [FRONTIER V3 PR #169](https://github.com/sidhulyalkar/sids-neural-net/pull/169)
contains the research-journal shell and full staged explanation-engine plan. This
contract is deliberately built against `master`, in a separate PR, to limit
scope and make validation independent of that unmerged frontend overhaul.

## Invariants

1. **Discovery and evidence are different products.** A `FrontierItem` can be
   discovered, ranked, saved and read even when its evidence manifest is absent.
   Item popularity, stars, citations, likes and comments are never scientific results.
2. **A cited source is not a reproduced result.** A publisher-reported result
   remains publisher-reported. `verified-derived` requires explicit computation
   lineage that later adapters must supply, not merely trust in a famous journal.
3. **Exact provenance.** Every record cites the canonical source identity,
   revision and an original publisher-hosted location. The source URL, version,
   and revision must agree within the manifest. Arbitrary third-party links
   cannot be smuggled in as a supporting source.
4. **Display rights are independent of discoverability.** A source image
   may exist but only be linkable. `permitted` requires attribution and
   license or explicit rights documentation. Source rights must be audited by
   the adapter before the flag is emitted; the schema cannot independently
   ascertain copyright permissions.
5. **Missing evidence is a valid state.** A source-only manuscript never
   receives a placeholder figure, plotted neural trace or fabricated pipeline.
   The editorial-reading fallback remains eligible.
6. **Zero extra first-paint cost.** `lib/frontier/evidence/*` has no imports
   into the default page or the cold snapshot and performs no network requests.
   Fetching original materials and rendering visual scenes are separate PRs.

## Files

- `lib/frontier/evidence/schema.ts`: strict Zod v4 schemas, public HTTPS URL
  shape checks, source/version and cross-reference checks, typed evidence,
  bounded manifest sizes and rights metadata.
- `lib/frontier/evidence/eligibility.ts`: deterministic decision matrix
  returning eligible evidence IDs, allowed operations and an explicit
  abstention reason. `parseQualifiedStoryManifest` revalidates each declared
  scene using only its selected records.
- `tests/fixtures/frontier-evidence-source-corpus.v1.json`: six identities
  taken from the 2026-11-14 Frontier snapshot (arXiv, SpikeInterface GitHub
  commit, NBA source scoreboard, source YouTube video, NASA APOD and a Steam
  game article). They are **source-only** fixtures, with no measurements,
  source-figure license claims, asset rights or available scenes.
- `tests/frontier-evidence-contract.test.ts`: positive and negative
  validation paths with explicitly synthetic `example.org` data.

## Scene-selection rules

| Scene | Necessary evidence | What the registry refuses |
| --- | --- | --- |
| Editorial reading | Canonical source | Never blocked |
| Original figure | Display-permitted source figure, caption, alt and citation | Unlicensed or unknown display rights |
| Figure comparison | Same documented pairing group, viewpoint, registration and distinct conditions or dates | Two unrelated images or two identical conditions |
| Benchmark ledger | Two values with identical metric, unit, dataset, split, protocol, comparison group and different methods | Engagment metrics, mixed units, missing comparison protocol |
| Pipeline explorer | Source files at the exact pinned commit plus explicit, connected directed edges | Guessed architecture or a list of unrelated file names |
| Event timeline | Two source events with distinct timestamps/offsets in the same event group | Events without timing or a shared timeline |
| Source video | Publisher source with link/display policy | Unknown rights or invented clip frames |
| Sports state | A source-kind sports record with structured reported competition state | Missing official state or speculative positions |
| Geospatial observations | Source-kind nature records with WGS84 coordinates | Invented locations, invalid coordinates |
| Time-aligned signals | At least two distinct channels with the same explicit clock, sample rate, start time and x unit | Alignment assumed merely from publication proximity |

**Important:** eligibility does not mean the corresponding React renderer has
been implemented or that the content has been independently reproduced. The
actual UI must gate each scene behind renderer availability and its own QA.

## Reader integration (future PR)

The presentation shell should initially request a small manifest only **after**
a user opens an investigation. It should validate
`parseQualifiedStoryManifest` server-side before publishing public artifacts
and never interpret an untrusted JSON file as an executable scene.

A story manifest is a versioned *index* to source-backed evidence. Original
video bytes, full signals, large tables and raw paper HTML are not stored in
the daily `FrontierItem` snapshot. Immutable asset keys reference separately
secured assets; a figure's URL and its display permission must be validated
in the source adapter before a renderer creates an image element.

For example, the original figure inspector can display a credited image and
caption, but a figure-comparison slider must additionally have a documented
pairing and matching conditions. For event timelines and neural series, dates,
timebases and measurement units must be explicit. Every source link remains
available when a renderer, asset or network request fails.

## Qualification

Run:

```bash
npm run typecheck
npm run lint
node --import tsx --test tests/frontier-evidence-contract.test.ts
npm test
npm run build
```

CI must also preserve the existing website, snapshot and bundled-JavaScript
budgets. Source fixture tests are offline and deterministic. The real source
URLs are grounded in observed archive records; the synthetic measurements
used in test-only comparisons are **not** scientific claims and are never
shown in production.

## Next PR

First, freeze a rights-cleared paper fixture with genuine paper HTML, captions
and provenance anchors. Extend the narrow current arXiv extractor with a
proper DOM parser and a measured extraction precision/coverage report. Do not
build a general-purpose visual scene engine or a mandatory WebGL path yet.
