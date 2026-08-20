# FRONTIER — Personal Intelligence Radar

FRONTIER is a native `/frontier` destination inside `sids-neural-net`. It is designed as a finite, media-rich daily intelligence run rather than an engagement-maximizing infinite social feed.

## Product principles

1. **Discovery value over clicks.** Ranking combines personal relevance, importance, quality, freshness, momentum, novelty, knowledge state, and resurfacing.
2. **Important can beat personalized.** Major developments are allowed to break through the taste model.
3. **Knowledge is not taste.** `Already knew` advances the modeled knowledge frontier without teaching dislike.
4. **Missed does not mean irrelevant.** Unresolved high-value items can return after 1, 3, and 7 days.
5. **Breadth before scroll depth.** The daily run reserves space for Premier League, ML/data, AI/NeuroAI, transferable methods, and exploration before filling remaining slots.
6. **Game mechanics reward learning behavior, not raw clicks.** XP is minted once per signal and quest rewards are idempotent per day.
7. **Memory is explicit and portable.** Saves, groups, history, and learned preferences are browser-local by default and can be exported/imported as JSON.
8. **Media is evidence-bearing.** Images, videos, charts, metrics, and generated signal art are presentation modes around the same provenance-rich signal model, not decoration pasted onto a generic card.

## Architecture

```text
live internet
  ├─ Hacker News
  ├─ GitHub
  ├─ OpenAlex
  ├─ specialist RSS
  ├─ YouTube public Atom feeds (optional channel set)
  ├─ football-data.org (optional key)
  └─ Brave Search (optional key)
          │
          ▼
lib/frontier/sources.ts
  normalize → classify → score → deduplicate
          │
          ▼
/api/frontier/feed
  cached, fault-isolated JSON
          │
          ▼
FrontierExperience
  merge live candidates + due second chances
          │
          ▼
client personalization
  lane affinity + topic affinity + source affinity + known-topic state
          │
          ▼
finite daily run / explore / saved / history / interest map
          │
          ▼
Zustand persisted memory
```

The server source mesh never writes user state. The browser memory never needs source API credentials.

## Source behavior

### Zero-configuration core

- Hacker News top stories and discussion momentum
- GitHub repository discovery using anonymous API capacity
- OpenAlex recent scholarly works
- Guardian football RSS

Every source is wrapped independently. A timeout or malformed payload from one adapter produces degraded source status rather than a failed feed.

### Optional widening

Set these in Vercel/project environment variables when desired:

```bash
FRONTIER_GITHUB_TOKEN=
BRAVE_SEARCH_API_KEY=
FOOTBALL_DATA_API_KEY=
OPENALEX_EMAIL=
OPENALEX_API_KEY=
FRONTIER_RSS_FEEDS=
FRONTIER_YOUTUBE_CHANNELS=
```

- `BRAVE_SEARCH_API_KEY` adds a broad-web discovery layer and converts discovered YouTube URLs into playable video signals.
- `FOOTBALL_DATA_API_KEY` adds structured Premier League fixtures/results.
- `FRONTIER_RSS_FEEDS` accepts comma-separated specialist RSS endpoints.
- `FRONTIER_YOUTUBE_CHANNELS` accepts comma-separated YouTube channel IDs and consumes their public Atom feeds. No YouTube API key is required for these monitored-channel feeds.

## Feed data model

All sources normalize into `FrontierItem`:

- source provenance
- title/summary/url
- publication time
- primary lane
- tags and authors
- media (`image`, `youtube`, `video`, `chart`, `none`)
- structured metrics
- base score
- importance
- novelty
- quality
- momentum
- human-readable recommendation rationale

This lets a match result, paper, repository, video, and article coexist without pretending they are the same media object. Feature video cards can play inline; smaller video cards preserve a poster and open to the primary source.

## Personal learning state

The client stores four separable kinds of state:

- **lane affinity** — broad intellectual direction
- **topic affinity** — learned concept-level preference
- **source affinity** — whether a source repeatedly produces value
- **known topics** — subjects already familiar enough that introductory results should lose novelty

Feedback has intentionally different semantics:

| Signal | Effect |
| --- | --- |
| Love | strong positive preference |
| Important | positive + importance preference |
| Surprise | positive + raises exploration budget |
| Useful | positive practical preference |
| Read | weak positive completion signal |
| Already knew | raises knowledge state, no dislike |
| Later | weak positive + remains unresolved |
| Meh | negative preference |
| Hide | strong negative and suppress item |

Saving is *not* automatically treated as liking. Collections are external-memory organization, not taste labels.

## Persistent second chances

An unresolved item can return after:

```text
first impression
  └─ +1 day → second chance
       └─ +3 days → third chance
            └─ +7 days → final chance
```

The original item snapshot is stored in browser history, so resurfacing does not depend on the source still returning the item in tomorrow's API window.

## Visual language

FRONTIER deliberately avoids the standard social-media center-column clone.

- asymmetric editorial feature grid
- finite daily-run structure
- generative signal art when publisher media is absent
- publisher images with lazy loading and restrained treatment
- inline YouTube / video support for feature signals
- provenance and ranking evidence visible on-card
- structured match / repository / paper metrics
- lane-specific visual accents
- subtle animated signal-field background
- responsive 12-column desktop layout collapsing cleanly for mobile
- wrapped touch-safe reaction controls on narrow cards
- `content-visibility` and lazy media to keep deep feeds inexpensive
- `prefers-reduced-motion` support

The `My radar` constellation exposes the learned preference state visually, so personalization remains inspectable.

## Persistence and privacy

`lib/frontier/store.ts` uses Zustand persistence backed by browser storage. This gives immediate deployment with no database or account migration and keeps private interaction history off the public website backend.

The user can export a complete versioned memory capsule and import it into another browser. The storage boundary is intentionally isolated so a future authenticated remote-sync adapter can be added without changing ranking or UI semantics.

## Production gates

The website CI checks FRONTIER through the same production release pipeline as the rest of the site:

- TypeScript typecheck
- ESLint
- Node test suite, including ranking, knowledge-state, resurfacing, RSS-image, and YouTube-Atom tests
- deterministic existing corpus audits
- Next module/bundle analysis
- production build
- emitted JavaScript bundle budget
- running-server smoke test for `/frontier`
- running-server smoke test for `/api/frontier/feed`
- Playwright desktop screenshot at 1440×1100
- Playwright mobile screenshot at 390×844

The source API route is designed to return a valid degraded payload even when CI has no optional source credentials.

## Future extensions

The next meaningful upgrades should deepen the world model rather than merely adding more feeds:

1. authenticated cross-device memory sync
2. entity extraction and personal knowledge graph
3. temporal attention velocity / emerging-signal detection
4. transcript-aware video summaries and chapter extraction
5. explicit contradiction / belief-update tracking
6. contextual-bandit exploration after enough interactions exist
7. learned candidate-generation queries from positive and negative topic evidence
8. “this updates something you learned last month” memory bridges

The architecture in this PR leaves those boundaries explicit rather than baking them into presentation code.
