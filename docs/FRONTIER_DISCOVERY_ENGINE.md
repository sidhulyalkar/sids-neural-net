# FRONTIER discovery engine

FRONTIER is a request-time discovery system, not a static content build. New signals can appear on `/frontier` without a site redeploy. The browser requests a bounded live candidate set, the server fans out across public sources, and the client applies private local reranking and learning.

## Design goals

- **Fresh without redeploying.** `/api/frontier/feed` executes at request time and the browser refreshes while the page is active.
- **Free/public first.** The baseline works without paid search, embedding, or vector-database services.
- **Graceful partial failure.** One broken or rate-limited upstream is a degraded source status, not a broken feed.
- **Source-backed media only.** Discovery never creates fake article imagery. Real source images/video are optional enrichment; text-only signals use editorial clipping cards.
- **Private personalization.** Raw dwell history and local semantic vectors do not need to leave the browser for candidate generation.
- **Bounded everything.** Per-source timeouts, request pacing, candidate limits, source/domain diversity, vector LRU limits, GPU memory budgets, and media-prefetch budgets all prevent one subsystem from consuming the experience.

## Candidate meshes

### Core research / engineering ingestion

`sourceIngestor.ts` normalizes:

- arXiv Atom
- Hugging Face Daily Papers JSON
- GitHub repository search used as a trending-style recent-repository signal
- Papers With Code
- Hacker News via the public Algolia index
- targeted RSS / Atom feeds

`sourceIngestorShared.ts` keeps one server-module ingestor instance so source cooldowns persist across nearby requests instead of resetting on every invocation.

### Expanded public research + community mesh

`expandedSources.ts` adds:

- bioRxiv recent preprints
- medRxiv recent preprints
- OpenReview search
- Lobsters newest stories
- NASA Astronomy Picture of the Day

These adapters use official/public JSON endpoints, bounded timeouts, per-source pacing, focused-topic filtering, source-specific metadata normalization, and independent status reporting. `expandedSourcesShared.ts` coalesces concurrent identical requests and keeps a two-minute bounded in-process cache, shorter than the normal browser refresh cadence.

### Curated visual discovery

`vimeoSource.ts` optionally adds Vimeo Staff Picks when `FRONTIER_VIMEO_ACCESS_TOKEN` is configured. Vimeo requires an API access token even for public-data requests, so this is intentionally optional rather than pretending to be anonymous zero-config ingestion.

The adapter requests only public Staff Picks metadata, uses content-rating filtering, carries the real first-party Vimeo thumbnail into the media contract, and links playback back to the canonical Vimeo page. It does not request private video-file URLs or attempt to bypass Vimeo playback/auth rules.

### Existing broad + personal meshes

The integrated feed also retains the existing:

- OpenAlex scholarly discovery
- GDELT focused web/news discovery
- personal Reddit rotation
- Steam game news
- YouTube/RSS signals
- favorite-team and active-sports sources
- public web discovery when an optional search key is configured
- durable checked-in snapshot as a degraded-mode safety net

## Why some suggested sources remain optional rather than hard-coded

FRONTIER prefers stable public contracts over brittle scraping.

- **Kaggle:** public datasets/competitions can be integrated where the official API exposes the needed resource, but the feed does not scrape discussion pages as a pretend API.
- **Vimeo:** implemented as an optional authenticated-public-data adapter because Vimeo requires a token for API requests.
- **SoundCloud / Bandcamp:** when an artist, label, or podcast exposes a stable public RSS/Atom endpoint, add it through `FRONTIER_RSS_FEEDS`. Broad HTML scraping is deliberately avoided.
- **Unsplash:** image discovery should be added only through its documented API and attribution requirements. NASA APOD already gives the zero-key baseline a first-party high-resolution visual-science source.

This keeps the discovery engine maintainable and honest about upstream capabilities.

## Unified item contract

Every adapter produces a `FrontierItem` with:

- stable id
- title + source-grounded summary
- canonical destination URL
- source kind + label
- publication time
- FRONTIER lane
- normalized tags / authors
- optional real media payload
- optional source metrics
- quality, freshness/momentum, novelty, importance, and base score

The aggregate layer deduplicates canonical URLs and normalized titles before English normalization and client ranking.

## Source scoring

Source credibility is a prior, not a truth oracle. FRONTIER keeps relevance, freshness, credibility, community momentum, novelty, and personal affinity separable.

Examples:

- primary scholarly or institutional sources begin with a stronger quality prior
- community sources can earn high momentum without being treated as authoritative evidence
- a niche specialist source can still rank highly when it is unusually relevant
- source/domain diversity prevents one publisher from swallowing the finite run

## Live request flow

```text
Browser preference summary + optional explicit query
                ↓
        /api/frontier/feed
                ↓
   ┌────────────┼──────────────┐
   │            │              │
core mesh   expanded mesh   personal/broad meshes
   │            │              │
   └────────────┼──────────────┘
                ↓
      canonical deduplication
                ↓
       English normalization
                ↓
       bounded candidate set
                ↓
 browser-local semantic + lexical reranking
                ↓
       finite FRONTIER surface
```

The browser ordinarily refreshes every four minutes while visible and refreshes again when returning to the tab. Manual refresh can bypass ordinary cache behavior. A recent real feed is retained locally as a fast/degraded startup surface.

## Local semantic reranking

The client-side vector engine provides a second-stage ranker without a paid model API.

- Worker-based 384D embedding interface
- preferred MiniLM feature extraction when the optional browser ML runtime/model is available
- deterministic local feature-hash fallback when it is not
- IndexedDB vector persistence
- 1,000-item LRU cap
- local user-interest centroid
- seven-day evidence half-life
- explicit and implicit telemetry
- lexical BM25 + semantic cosine similarity
- bounded epsilon-greedy exploration

The target hybrid score is:

```text
0.40 × semantic similarity
+ 0.30 × freshness
+ 0.20 × credibility
+ 0.10 × BM25
```

The exploration layer then reserves a small fraction of the surface for high-novelty candidates so personalization does not collapse into a filter bubble.

## Behavioral evidence

Strong evidence:

- upvote
- downvote
- save
- source open
- richer explicit reactions

Soft evidence:

- meaningful visible dwell
- context/media expansion
- reading depth
- repeated source/topic/format preference

An impression alone is extremely weak evidence. One skip is not treated as dislike. Search text itself is used to retrieve/rank the current request but is not automatically converted into a preference.

## Media-aware discovery

Real media is carried through the same `FrontierItem` contract. Media rendering is handled separately by the FRONTIER media engine:

- Display-P3 WebGL2 when supported
- bicubic reconstruction only when source pixels are below physical display density
- DPR-aware render targets
- worker image decode + GPU texture LRU
- native video/HLS/MSE playback
- 300 ms pointer/scroll predictive prefetch

NASA APOD and Vimeo thumbnail hosts are part of the default trusted same-origin media gateway set, so their real imagery can use the GPU path while the proxy remains closed to arbitrary upstream domains.

Separating discovery from rendering keeps source adapters small and keeps media failure from breaking reading.

## Deployment configuration

The zero-config baseline needs no paid API. Optional environment variables increase coverage or quotas:

```text
FRONTIER_GITHUB_TOKEN=
BRAVE_SEARCH_API_KEY=
FOOTBALL_DATA_API_KEY=
FRONTIER_NASA_API_KEY=
FRONTIER_VIMEO_ACCESS_TOKEN=
OPENALEX_EMAIL=
OPENALEX_API_KEY=
FRONTIER_RSS_FEEDS=
FRONTIER_YOUTUBE_CHANNELS=
FRONTIER_SUBREDDITS=
FRONTIER_MUSIC_ARTISTS=
```

See `.env.local.example` for the full account, memory, media-proxy, and discovery configuration.

## Reliability contract

A production source adapter should satisfy all of the following:

1. bounded timeout / abort support
2. no unbounded retries
3. request pacing or cache coalescing
4. malformed payloads become empty/degraded results
5. stable canonical URL when possible
6. no fabricated media or quotes
7. explicit source status
8. deduplication before feed fan-in
9. no arbitrary proxy behavior
10. tests for parser shape and failure-safe behavior

That contract is more important than maximizing the raw number of upstream logos in the source list.
