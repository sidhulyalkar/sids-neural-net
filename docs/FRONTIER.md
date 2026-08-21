# FRONTIER — Personal Intelligence Radar

FRONTIER is a native `/frontier` destination inside `sids-neural-net`. It is a finite personal world radar, not an engagement-maximizing infinite social feed.

The product intentionally has two complementary faces:

- **Brainfood** — novel studies, public codebases, useful methods, project designs, ML/data, AI/NeuroAI, and broad science.
- **After Hours** — Patriots, Warriors, Chelsea, Manchester City, active sports, sports highlights, Reddit/community posts, memes, games, bass music, video, outdoors, animals, and internet culture.

`For You` recombines both into one daily run while preserving independent lane budgets.

## Product principles

1. **Discovery value over clicks.** Ranking combines personal relevance, importance, quality, freshness, momentum, novelty, knowledge state, and resurfacing.
2. **Important can beat personalized.** Major developments are allowed to break through the taste model.
3. **Knowledge is not taste.** `Already knew` advances the modeled knowledge frontier without teaching dislike.
4. **Missed does not mean irrelevant.** Unresolved high-value items can return after 1, 3, and 7 days.
5. **Breadth before scroll depth.** The daily run explicitly reserves room for evidence, code, reusable methods, favorite teams, active sports, broader sports, games, culture, and useful surprise.
6. **Fun is first-class, not filler.** A great climbing send, downhill run, match clip, game release, bass set, or genuinely funny community post can be valuable without pretending to be a research paper.
7. **Game mechanics reward meaningful behavior, not raw clicks.** XP is minted once per signal and quest rewards are idempotent per day.
8. **Memory is explicit and portable.** Saves, groups, history, and learned preferences are browser-local by default and can be exported/imported as JSON.
9. **Media is evidence-bearing.** Images, videos, charts, metrics, and generated signal art are presentation modes around the same provenance-rich signal model.
10. **The feed must end.** FRONTIER is deliberately finite. Explore exists when the user wants depth; Daily Run should never become sludge.

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

Four active sports rotate through the live discovery mesh each day. Recent snapshots accumulate across deployments, so all disciplines remain in orbit without multiplying every request by eight on every page load.

The source strategy has three layers:

1. **Professional / current stories** — zero-config news RSS searches for competition results, athlete stories, records, event news, and notable performances.
2. **Community clips** — recent top Reddit posts from relevant climbing, MTB, skiing, skateboarding, longboarding, and soccer communities, with YouTube and Reddit-hosted video promoted to playable media when available.
3. **Wider clip discovery** — when `BRAVE_SEARCH_API_KEY` is configured, sport-specific queries expand into YouTube, web, X/Threads-indexed results, best runs, sends, tricks, and highlight videos.

For RipStik and RipSurf, FRONTIER deliberately searches progression, creator riding, advanced tricks, and standout clips rather than inventing a professional circuit that may not exist.

### Games

The checked-in game seed is based on the supplied Steam library snapshot. It includes strong interests such as Elden Ring, Ender Lilies, Hollow Knight / Silksong, Nine Sols, Dead Cells, Celeste, TUNIC, Rain World, Outer Wilds, Ori, Cyberpunk 2077, Deep Rock Galactic, Lethal Company, Valheim, V Rising, Astroneer, The Binding of Isaac, Another Crab's Treasure, Palworld, ULTRAKILL, Ender Magnolia, and adjacent titles.

Only a small rotating subset is polled each day. This keeps the source fan-out cheap and prevents the same games from dominating every run.

### Music

`content/music/taste-profile.json` is the reusable taste bridge between the existing music showcase and FRONTIER. The fallback seed contains bass/electronic artists already represented by the site, while `npm run music:fetch` can refresh:

- top artists
- followed artists when the refresh token has `user-follow-read`
- playlist names when the refresh token has `playlist-read-private`
- top tracks

FRONTIER uses artist/playlist metadata only for discovery. The existing beat-synchronized Rotation experience still requires separately curated BPM/downbeat timing and is not overwritten.

The supplied SoundCloud profile remains a discovery anchor for broad-web searches. No fragile unauthenticated page scraping is required.

### Reddit

The supplied followed-subreddit snapshot is checked into the personal-interest layer and grouped into lightweight daily rotations across:

- science / ML / neuroscience / engineering
- games / music
- sports and favorite-team communities
- active sports such as mountain biking / climbing / skiing / soccer
- humor / memes / internet culture
- animals / huskies / nature / photography / food

Favorite-team communities are always eligible; active-sports communities receive dedicated rotating slots; the rest rotate deterministically by date.

## Architecture

```text
live internet
  ├─ Hacker News
  ├─ GitHub
  ├─ OpenAlex
  ├─ specialist RSS
  ├─ Reddit public listings
  ├─ active-sports news + clip mesh
  ├─ Steam public game news
  ├─ YouTube public Atom feeds (optional channel set)
  ├─ football-data.org (optional key)
  └─ Brave Search (optional personal web / video / social widening)
          │
          ├───────────────────────┬────────────────────────┐
          ▼                       ▼                        ▼
lib/frontier/sources.ts  lib/frontier/personalSources.ts  activeSportsSources.ts
  research/core mesh       teams + games + culture        motion + pro + clips
          └───────────────────────┼────────────────────────┘
                                  ▼
                         lib/frontier/aggregate.ts
                       normalize + dedupe + snapshot fallback
                                  │
                                  ▼
                           /api/frontier/feed
                        cached, fault-isolated JSON
                                  │
                                  ▼
                          FrontierExperience
                  Daily Run / Explore / Saved / History / My Radar
                                  │
                                  ▼
                            client memory
              lane affinity + topic affinity + source affinity + known state
```

The server source mesh never writes private user interaction state. Browser memory never needs source credentials.

## Source behavior

### Zero-configuration core

- Hacker News top stories and discussion momentum
- GitHub repository discovery using anonymous API capacity
- OpenAlex recent scholarly works
- Guardian football RSS
- Reddit public top-of-day listings across the rotating personal subreddit orbit
- active-sports news RSS plus top community clip/story discovery
- Steam public game news for the rotating library sample

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
FRONTIER_SUBREDDITS=
```

- `BRAVE_SEARCH_API_KEY` adds targeted discovery for favorite teams, active sports, best clips, YouTube, X/Threads results, games, bass artists, SoundCloud, and the broader web.
- `FOOTBALL_DATA_API_KEY` adds structured Premier League fixtures/results.
- `FRONTIER_RSS_FEEDS` accepts comma-separated specialist RSS endpoints.
- `FRONTIER_YOUTUBE_CHANNELS` accepts comma-separated YouTube channel IDs and consumes their public Atom feeds without a YouTube API key.
- `FRONTIER_SUBREDDITS` appends extra communities to the checked-in personal rotation.

## Brainfood / After Hours / Explore

The top-level perspective control is intentionally tiny:

- **For You** — balanced world model.
- **Brainfood** — research/code/method/project-design lanes only.
- **After Hours** — favorite teams, active sports, broader sports, games, music, Reddit/social culture, life/outdoors, and wildcards.

Pinned personal topics provide fast paths for New papers, Open source, NeuroAI, ML + data, Patriots, Warriors, Chelsea, Man City, **Active sports**, Bass Orbit, Game Radar, and Internet Gold.

Explore adds an orthogonal format filter:

- Studies
- Codebases
- Project design
- Video
- Posts + threads
- Sports
- Games
- Music

This avoids forcing source, topic, and media type into one overloaded category system.

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

A match result, climbing final, downhill clip, paper, repository, Reddit post, Steam update, video, and article can therefore coexist without pretending they are the same object.

## Personal learning state

The client stores four separable kinds of state:

- **lane affinity** — broad direction
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

## Daily archive + Vercel deployment

FRONTIER has both live cache refreshes and a durable daily snapshot.

`npm run frontier:snapshot` writes the current integrated source mesh to:

```text
content/frontier/latest.json
```

`.github/workflows/frontier-refresh.yml` runs daily and can also be triggered manually. It:

1. installs the production dependencies,
2. optionally refreshes the Spotify taste profile when owner credentials are present,
3. builds the integrated FRONTIER snapshot,
4. refuses to replace the archive when the live mesh is suspiciously empty,
5. commits changed snapshot/taste files to `master`.

On the normal Git-backed Vercel setup, that content commit naturally produces a fresh deployment. The live API still refreshes more frequently through CDN caching, while the committed snapshot gives cross-deployment continuity and a fallback when an upstream source is temporarily unavailable.

The scheduled refresh is daily by default. Changing the cron to every other day is a one-line deployment policy change; the product architecture does not depend on the exact cadence.

## Visual language

FRONTIER deliberately avoids the standard center-column social clone.

- one large editorial feature plus a compact signal river
- tiny pill controls instead of dashboard chrome
- Brainfood / After Hours perspectives rather than a sprawling sidebar
- one compact `Active sports` shortcut rather than eight permanent navigation tabs
- lane accents for science, teams, sports/motion, games, music, and internet culture
- publisher/community images with lazy loading and restrained treatment
- inline YouTube/video support for feature signals
- provenance and ranking evidence visible on-card
- structured match / repository / paper / community metrics
- subtle animated signal-field background
- responsive 12-column desktop layout collapsing cleanly for mobile
- touch-safe reaction controls
- `content-visibility` and lazy media to keep deep Explore views inexpensive
- `prefers-reduced-motion` support

The design should feel playful through content, typography, small glyphs, and accents rather than through noisy decoration.

## Persistence and privacy

`lib/frontier/store.ts` uses Zustand persistence backed by browser storage. This gives immediate deployment with no database/account migration and keeps private interaction history off the public website backend.

The user can export a complete versioned memory capsule and import it into another browser. The storage boundary is intentionally isolated so a future authenticated remote-sync adapter can be added without changing ranking or UI semantics.

## Navigation integration

FRONTIER is registered in the site navigation, homepage live portal, sitemap, and shared section layout. The shared section header means pages using `ComicSectionLayout`, including Core/About and Contact, expose a compact FRONTIER jump without each page duplicating navigation code.

## Production gates

The website CI checks FRONTIER through the same production release pipeline as the rest of the site:

- TypeScript typecheck
- ESLint
- Node test suite, including active-sports cold start, daily rotation, daily-run reservation, professional-news parsing, playable community clips, personal-team, subreddit, game-library, ranking, knowledge-state, resurfacing, RSS-image, and YouTube-Atom tests
- deterministic existing corpus audits
- Next module/bundle analysis
- production build
- emitted JavaScript bundle budget
- running-server smoke test for `/frontier`
- running-server smoke test for `/api/frontier/feed`
- Playwright desktop screenshot at 1440×1100
- Playwright mobile screenshot at 390×844

The source API returns a valid degraded payload even when optional credentials are absent.

## Future extensions

The next meaningful upgrades should deepen the world model rather than simply pile on more feeds:

1. authenticated cross-device memory sync
2. entity extraction and a temporal personal knowledge graph
3. emerging-signal / attention-velocity detection
4. transcript-aware video summaries and chapter extraction
5. explicit contradiction / belief-update tracking
6. contextual-bandit exploration after enough interactions exist
7. learned candidate-generation queries from positive and negative topic evidence
8. “this updates something you learned last month” memory bridges
9. authenticated first-party connectors for services whose public pages intentionally resist scraping

The architecture keeps these boundaries explicit rather than baking them into presentation code.
