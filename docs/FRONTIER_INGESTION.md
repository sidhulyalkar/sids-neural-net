# FRONTIER multi-source ingestion

`lib/frontier/sourceIngestor.ts` is a small normalization layer for public research, code, discussion, and RSS sources. It deliberately avoids a dependency-heavy feed framework: each adapter performs one bounded request, parses only the fields FRONTIER needs, and emits the existing `FrontierItem` contract.

## Built-in adapters

- **arXiv**: Atom API, newest-first research results
- **Hugging Face Daily Papers**: public daily-papers API
- **GitHub Trending signal**: repository search over newly created/high-starred repositories, optionally authenticated with the existing FRONTIER GitHub token
- **Papers With Code**: public papers endpoint when available
- **Hacker News**: Algolia HN search API
- **Targeted RSS / Atom**: zero-dependency XML normalization for configured feeds

The multi-source mesh is merged into `getIntegratedFrontierFeed()` in parallel with FRONTIER's existing live discovery, personal/community, and sports adapters. An individual source failure yields a degraded source status rather than failing the page.

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
- bounded quality / importance / novelty / momentum / base score

All values enter the same downstream English normalization, recommendation, semantic indexing, magazine-clipping and media contracts as existing FRONTIER signals.

## Rate limiting

`SourceRateLimiter` maintains a source-local next-eligible timestamp. Each public adapter defines a conservative minimum interval. Parallel multi-source ingestion is allowed, but repeated calls to the same adapter are serialized according to that source's interval.

Requests also have:

- a 7-second timeout
- `AbortSignal` propagation
- no-store upstream fetch behavior
- bounded result counts

The `/api/frontier/ingest` route caps client-requested source limits at 24.

## Deduplication

`dedupeIngestedItems()` deduplicates on two independent keys:

1. canonical URL with common tracking parameters removed
2. normalized title

The integrated feed performs another canonical URL/title dedupe across all FRONTIER source meshes. This catches the same paper or story appearing through arXiv, a code community, RSS, or another discovery adapter.

## RSS resilience

The RSS parser supports both RSS `<item>` and Atom `<entry>` structures and extracts common title, link, date, summary/content, category and author fields. It decodes CDATA/entities and strips markup from feed text.

Malformed entries missing a title or link are skipped independently. A broken feed in a multi-feed RSS batch is ignored while valid feeds continue.

Default feeds currently include GitHub's blog and Guardian football. Extra feeds can be supplied using the existing environment variable:

```text
FRONTIER_RSS_FEEDS=https://example.com/feed.xml,https://another.example/atom.xml
```

`FRONTIER_TARGET_RSS_FEEDS` is also recognized as a more explicit alias.

## Browser CORS fallback

The ingestion abstraction is usable from either server or browser code. Public feeds frequently have inconsistent CORS headers, so a browser caller can provide `fallbackEndpoint: '/api/frontier/ingest'`.

If the direct request fails, the ingestor retries through the same-origin server route using only an allowlisted source id, query and bounded limit. The route is **not** a generic URL proxy, so a user cannot make FRONTIER fetch arbitrary internal or external URLs.

The main production feed currently performs public-source ingestion server-side, which naturally avoids browser CORS problems and keeps source request policy centralized.

## Cost model

The built-in mesh requires no paid discovery API. Optional existing credentials can improve rate limits or expand other FRONTIER adapters, but arXiv, HF Daily Papers, HN, targeted RSS and anonymous GitHub allowance provide a functioning public baseline.

The architecture intentionally treats each public endpoint as fallible. Availability or policy changes at one upstream source should reduce breadth, not take FRONTIER offline.