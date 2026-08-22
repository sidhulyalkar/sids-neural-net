# FRONTIER multi-source ingestion

`lib/frontier/sourceIngestor.ts` is a small normalization layer for public research, code, discussion, and RSS sources. It deliberately avoids a dependency-heavy feed framework: each adapter performs bounded work, parses only the fields FRONTIER needs, and emits the existing `FrontierItem` contract.

## Built-in core adapters

- **arXiv**: Atom API, newest-first research results
- **Hugging Face Daily Papers**: public daily-papers API
- **GitHub Trending signal**: repository search over newly created/high-starred repositories, optionally authenticated with the existing FRONTIER GitHub token
- **Papers With Code**: public papers endpoint when available
- **Hacker News**: Algolia HN search API
- **Targeted RSS / Atom**: zero-dependency XML normalization for configured feeds

`sourceIngestorShared.ts` keeps one server-module instance alive so adapter cooldowns are shared across nearby feed requests instead of being recreated per visitor.

## Expanded public adapters

`expandedSources.ts` adds independent, zero/low-configuration public discovery for:

- **bioRxiv** recent preprints
- **medRxiv** recent preprints
- **OpenReview** paper/review search
- **Lobsters** technical-community stories
- **NASA APOD** first-party high-resolution visual science

`expandedSourcesShared.ts` coalesces concurrent identical requests and holds a two-minute bounded cache keyed by normalized topic focus. This protects upstream APIs during request bursts while remaining fresher than the normal browser refresh cadence.

`vimeoSource.ts` optionally adds **Vimeo Staff Picks** when `FRONTIER_VIMEO_ACCESS_TOKEN` is configured. Vimeo requires an API token even for public metadata, so FRONTIER keeps it optional and server-only. It requests curated public metadata and real Vimeo thumbnails only; it does not request private video-file URLs or attempt to bypass platform playback controls.

The multi-source meshes are merged into `getIntegratedFrontierFeed()` in parallel with FRONTIER's existing adaptive web discovery, personal/community, sports, Steam, Reddit, OpenAlex, YouTube and other source adapters. An individual source failure yields a degraded source status rather than failing the page.

## Unified normalization

Every adapter emits:

- stable id
- canonical URL
- title
- bounded summary
- source/source label/source kind
- normalized timestamp
- inferred FRONTIER lane
- metadata tags
- authors where available
- source metrics where meaningful
- optional source-backed media
- bounded quality / importance / novelty / momentum / base score

All values enter the same downstream English normalization, recommendation, semantic indexing, magazine-clipping and media contracts as existing FRONTIER signals.

## Rate limiting + burst control

`SourceRateLimiter` maintains a source-local next-eligible timestamp. Each core public adapter defines a conservative minimum interval. Parallel multi-source ingestion is allowed, but repeated calls to the same adapter are serialized according to that source's interval.

Expanded sources additionally use module-level source pacing. Shared wrappers coalesce concurrent identical requests and briefly cache results. Vimeo uses the same two-minute coalescing pattern when enabled.

Requests also have:

- bounded timeouts
- `AbortSignal` propagation where applicable
- no-store upstream fetch behavior
- bounded result counts
- no unbounded retries

The `/api/frontier/ingest` route caps client-requested source limits at 24.

## Deduplication

`dedupeIngestedItems()` deduplicates on two independent keys:

1. canonical URL with common tracking parameters removed
2. normalized title

The integrated feed performs another canonical URL/title dedupe across all FRONTIER source meshes. This catches the same paper or story appearing through arXiv, OpenReview, bioRxiv, a code community, RSS, or another discovery adapter.

## RSS resilience

The RSS parser supports both RSS `<item>` and Atom `<entry>` structures and extracts common title, link, date, summary/content, category and author fields. It decodes CDATA/entities and strips markup from feed text.

Malformed entries missing a title or link are skipped independently. A broken feed in a multi-feed RSS batch is ignored while valid feeds continue.

Default feeds currently include GitHub's blog and Guardian football. Extra feeds can be supplied using:

```text
FRONTIER_RSS_FEEDS=https://example.com/feed.xml,https://another.example/atom.xml
```

`FRONTIER_TARGET_RSS_FEEDS` is also recognized as a more explicit alias.

This is the preferred integration path for a public artist/label/podcast SoundCloud or Bandcamp RSS/Atom feed when one is explicitly exposed. FRONTIER does not scrape arbitrary creator HTML pages to manufacture a feed contract.

## Browser CORS fallback

The ingestion abstraction is usable from either server or browser code. Public feeds frequently have inconsistent CORS headers, so a browser caller can provide `fallbackEndpoint: '/api/frontier/ingest'`.

If the direct request fails, the ingestor retries through the same-origin server route using only an allowlisted source id, query and bounded limit. The route is **not** a generic URL proxy, so a user cannot make FRONTIER fetch arbitrary internal or external URLs.

The main production feed performs public-source ingestion server-side, which naturally avoids browser CORS problems and keeps source request policy centralized.

## Media safety

Source ingestion can attach only genuine upstream media metadata. Rendering remains a separate concern:

- common trusted first-party media CDNs can be decorated with the bounded same-origin image gateway
- arbitrary publisher domains fall back to browser-native media rather than widening the proxy
- NASA APOD and Vimeo thumbnail hosts are explicitly trusted because they are first-party sources in the ingestion mesh
- missing images do not trigger generated filler; text-only items become editorial clippings

## Cost model

The built-in mesh requires no paid discovery API. Optional credentials improve quotas or add sources such as Vimeo Staff Picks, but arXiv, HF Daily Papers, bioRxiv, medRxiv, OpenReview, Lobsters, NASA APOD, HN, targeted RSS and anonymous GitHub allowance provide a broad public baseline.

The architecture intentionally treats each public endpoint as fallible. Availability or policy changes at one upstream source should reduce breadth, not take FRONTIER offline.

For the full fan-in, local semantic ranker and deployment model, see `docs/FRONTIER_DISCOVERY_ENGINE.md`.
