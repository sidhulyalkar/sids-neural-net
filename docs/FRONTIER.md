# FRONTIER — Personal Intelligence Radar

FRONTIER is a native `/frontier` destination inside `sids-neural-net`. It is a finite personal world radar, not an engagement-maximizing infinite social feed.

> **Live runtime:** FRONTIER now performs request-time adaptive discovery independently of site deployments. See [`docs/FRONTIER_LIVE_RUNTIME.md`](./FRONTIER_LIVE_RUNTIME.md) for the current polling, query-planning, source-quality, dwell, up/down, exploration, privacy, and reliability contract.

The product intentionally has two complementary faces:

- **Brainfood** — novel studies, public codebases, useful methods, project designs, ML/data, AI/NeuroAI, and broad science.
- **After Hours** — Patriots, Warriors, Chelsea, Manchester City, active sports, sports highlights, Reddit/community posts, memes, games, bass music, video, outdoors, animals, and internet culture.

`For You` recombines both into one daily run while preserving independent lane budgets.

## Product principles

1. **Discovery value over clicks.** Ranking combines personal relevance, importance, quality, freshness, momentum, novelty, knowledge state, resurfacing, bounded behavioral evidence, and uncertainty-aware exploration.
2. **Important can beat personalized.** Major developments are allowed to break through the taste model.
3. **Knowledge is not taste.** `Already knew` advances the modeled knowledge frontier without teaching dislike.
4. **Missed does not mean irrelevant.** Unresolved high-value items can return after 1, 3, and 7 days.
5. **Breadth before scroll depth.** The daily run explicitly reserves room for evidence, code, reusable methods, favorite teams, active sports, broader sports, games, culture, and useful surprise.
6. **Fun is first-class, not filler.** A great climbing send, downhill run, match clip, game release, bass set, or genuinely funny community post can be valuable without pretending to be a research paper.
7. **Explicit feedback beats weak inference.** Up/down, richer reactions, opens, and saves outweigh passive dwell evidence.
8. **Attention is measured conservatively.** Dwell counts only while a card is actually visible and the browser tab is active; it never becomes an automatic like.
9. **Memory is explicit and portable.** Saves, groups, history, attention time, and learned preferences are browser-local by default and can be exported/imported as JSON.
10. **Media is evidence-bearing.** FRONTIER renders real source-backed media only. Text-only content becomes a source-grounded editorial clipping rather than generated filler art.
11. **The feed must end.** FRONTIER is deliberately finite. Explore exists when the user wants depth; Daily Run should never become sludge.
12. **Fresh content must not require a deploy.** Runtime queries refresh current candidates while the committed snapshot acts only as a durable fallback.

## Personal seed

`lib/frontier/interests.ts` contains the explicit cold-start world model rather than hiding it inside ranking constants.

### Favorite teams

- New England Patriots
- Golden State Warriors
- Chelsea FC
- Manchester City

Team aliases map into a dedicated `team_pulse` lane so favorite-team news, highlights, roster moves, tactical analysis, and community posts are not diluted into generic sports.

### Active sports / motion radar

FRONTIER separately models sports the owner actively does or is learning:

- rock climbing / bouldering / lead climbing
- mountain biking / downhill / enduro
- skiing / freeski / freeride
- skateboarding
- longboarding
- soccer
- RipStik / caster-board riding
- RipSurf / waveboard / land-surfing progression

These are not treated as generic “outdoors” tags. They receive positive cold-start affinities, an `Active sports` pinned shortcut, and their own Daily Run reservation so favorite-team news cannot crowd them out.

Four active sports rotate through the broad source mesh each day. The live adaptive query planner can additionally search whichever sports are earning strong explicit or stable behavioral preference.

### Games

The checked-in game seed is based on the supplied Steam library snapshot. It includes strong interests such as Elden Ring, Ender Lilies, Hollow Knight / Silksong, Nine Sols, Dead Cells, Celeste, TUNIC, Rain World, Outer Wilds, Ori, Cyberpunk 2077, Deep Rock Galactic, Lethal Company, Valheim, V Rising, Astroneer, The Binding of Isaac, Another Crab's Treasure, Palworld, ULTRAKILL, Ender Magnolia, and adjacent titles.

Only a small rotating subset is polled through Steam each day. Wider runtime discovery can still react to learned game topics through the adaptive web mesh.

### Music

`content/music/taste-profile.json` is the reusable taste bridge between the existing music showcase and FRONTIER. The fallback seed contains bass/electronic artists already represented by the site, while `npm run music:fetch` can refresh top/followed artists, playlist names, and top tracks when the appropriate Spotify owner scopes are configured.

FRONTIER uses artist/playlist metadata for discovery. The existing beat-synchronized Rotation experience still requires separately curated BPM/downbeat timing and is not overwritten.

### Reddit

The supplied followed-subreddit snapshot is checked into the personal-interest layer and grouped into lightweight rotations across science/ML/neuroscience, games/music, sports and favorite teams, active sports, humor/internet culture, animals, nature, photography, and food.

## Architecture

```text
browser-local world model
  ├─ explicit affinity
  ├─ up/down + rich feedback
  ├─ active viewport dwell
  ├─ opens / saves
  └─ frozen between-session behavior snapshot
          │
          ▼
  bounded discovery focus
          │
          ▼
  /api/frontier/feed
          │
          ├─ core mesh: HN / GitHub / OpenAlex / RSS
          ├─ personal mesh: teams / games / music / community
          ├─ active-sports mesh
          ├─ GDELT request-time live web search
          ├─ focused OpenAlex search
          └─ focused GitHub search
          │
          ▼
 normalize → dedupe → English → snapshot fallback
          │
          ▼
 client ranking + finite editorial selection
          │
          ▼
 Grid/List + editorial clipping + real media
```

The server source mesh never writes private user interaction state. Browser memory never needs source credentials. Only a short bounded list of discovery concepts is sent to the request-time adaptive endpoint.

## Live behavior

The client requests a live feed on load, refreshes every four minutes while the tab is visible, and refreshes when a hidden tab becomes visible again. A manual `Refresh live` request bypasses the short response cache.

This design is near-real-time polling because the upstream services are pull APIs/feeds. It does not require a long-running socket and does not require a Vercel deployment for new content to appear.

The committed daily snapshot remains useful for continuity and degraded upstream periods, but it is not the mechanism that keeps the page current.

## Source behavior

### Zero-configuration core

- Hacker News top stories and discussion momentum
- GitHub repository discovery using anonymous API capacity
- OpenAlex recent scholarly works
- Guardian football RSS
- Reddit public top-of-day listings across the rotating personal subreddit orbit
- active-sports news RSS plus top community clip/story discovery
- Steam public game news for the rotating library sample
- GDELT request-time article discovery for bounded learned focus concepts

Every source is wrapped independently. A timeout or malformed payload from one adapter produces degraded source status rather than a failed feed.

### Adaptive source quality

The live web adapter uses domain quality as a prior, not as an absolute truth label. Reuters/AP/BBC, scientific publishers, government/education domains, and official sports organizations receive stronger source-quality priors. Other domains can still surface when relevance, freshness, novelty, and personal fit are strong.

A same-domain cap and a same-host Daily Run cap prevent one outlet from taking over the page. Popularity or community momentum is always treated as discovery evidence, not truth evidence.

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
FRONTIER_SUBREDDITS=
FRONTIER_MUSIC_ARTISTS=
```

## Feed data model

All sources normalize into `FrontierItem` with provenance, title/summary/url, publication time, primary lane, tags/authors, optional real media, structured metrics, source-independent relevance signals, and a human-readable recommendation rationale.

A match result, climbing final, downhill clip, paper, repository, Reddit post, Steam update, video, and article can therefore coexist without pretending they are the same object.

## Personal learning state

The client stores separable evidence for broad lane affinity, topic affinity, source affinity, known topics, source/format/context behavior, and accumulated viewport-visible dwell.

Primary feedback semantics:

| Signal | Effect |
| --- | --- |
| Thumb up | strong “more like this” preference |
| Thumb down | strong “less like this” preference; no resurfacing |
| Love | strongest positive preference |
| Important | positive + importance preference |
| Surprise | positive + raises exploration budget |
| Useful | positive practical preference |
| Read | weak positive completion signal |
| Already knew | raises knowledge state, no dislike |
| Later | weak positive + remains unresolved |
| Meh | negative preference |
| Hide | strong negative and suppress item |

Dwell contributes only soft evidence. Roughly twelve seconds of genuinely visible attention is one soft engagement unit, capped so it cannot overwhelm direct feedback. Hidden-tab time is not counted.

Saving remains external-memory organization and only weak behavioral evidence rather than a permanent identity label.

## Stability + exploration

Behavior learned during the active visit does not reorder cards underneath the reader. Ranking uses a frozen behavior snapshot captured at session start.

FRONTIER also adds a small bounded uncertainty bonus for topics with weak behavioral evidence. This UCB-like term preserves exploration and helps prevent early interactions from collapsing the radar into a narrow filter bubble. Explicit feedback remains much stronger than this bonus.

The Daily Run retains protected category slots plus lane and source diversity caps.

## Daily archive + deployment

`npm run frontier:snapshot` and `.github/workflows/frontier-refresh.yml` still maintain `content/frontier/latest.json` as a durable fallback.

Code/schema changes require a normal website deployment. **New content does not.** Once the runtime is deployed, current source results are queried on page load and while the page remains active.

## Visual language

FRONTIER uses a restrained Grid/List editorial system. Real source images/videos are shown when present. Text-only signals become topic-aware editorial clippings derived only from source-backed titles/summaries. Generated filler imagery is not used.

## Persistence and privacy

`lib/frontier/store.ts` uses Zustand persistence backed by browser storage. The user can export/import a versioned memory capsule. Raw browsing history, reactions, attention traces, and saved-item state remain client-local; request-time adaptive discovery transmits only the bounded focus topics required to perform the current search.

## Production gates

Website CI validates FRONTIER through TypeScript, ESLint, unit tests, deterministic corpus audits, Next bundle analysis/build, JavaScript budget, running-server route smoke tests, and desktop/mobile browser fixtures. Live-discovery tests cover bounded query focus, alias collapse, negative-topic exclusion, source-backed GDELT parsing, publisher diversity, and the no-invented-body contract.

## Future extensions

The architecture now has clean insertion points for authenticated cross-device memory sync, richer entity/temporal knowledge graphs, emerging-signal velocity detection, transcript-aware video summaries, contradiction tracking, and more formal contextual-bandit evaluation. Those should be added only when they improve measurable discovery quality rather than simply increasing feed volume.
