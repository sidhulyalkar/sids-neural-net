# FRONTIER Phase 6 — Autonomous Scout

Phase 6 moves FRONTIER from a continuously refreshed reader to a bounded autonomous research scout. The system can now learn **where** useful information lives, maintain explicit longitudinal semantic watches, and distinguish ambient discoveries from findings important enough to interrupt the quiet stream.

The architecture preserves the earlier contracts:

- exact seen-ledger suppression remains authoritative
- one Web-Locks-elected worker remains the network polling owner
- source media and article identity remain source-authentic
- semantic state and learned source state remain browser-local
- explicit user intent outranks passive inference
- optional autonomy failures never block the core feed
- no arbitrary crawler, hidden cloud memory, or second polling daemon is introduced

## Runtime topology

```text
explicit Watch: command
        │
        ▼
384D local embedding ───────► IndexedDB Watch Intent store
        │                              │
        │                              ▼
        │                     daemon focus expansion
        │                              │
        ▼                              ▼
incoming unseen candidates ◄── elected live daemon ◄── trusted mesh
        │                              │
        │                              └──── safe learned RSS/Atom roster
        ▼
local Watch semantic broker
        │
        ├── ambient ─────► quiet pending stream
        │
        └── interruption ► priority audio + priority-first pending slot
                                  │
                                  ▼
                          top-left spatial Signal slot

meaningful interaction
        │
        ▼
semantic telemetry bus
        │
        ▼
safe same-origin HTML gateway
        │
        ▼
sourceForagerWorker
        │
        ├── observed outbound domains
        └── discovered RSS/Atom endpoints
                    │
                    ▼
            local semantic gate
                    │
                    ▼
             yield-aware roster
                    │
                    └──── wakes elected daemon
```

## 1. Autonomous source foraging

### Engagement trigger

FRONTIER does not crawl every opened URL. The forager listens to the existing semantic telemetry bus and only considers strong evidence:

- continuous dwell of at least 18 seconds
- explicit open
- save
- positive reactions (`up`, `love`, `important`, `surprise`, `useful`)

Each canonical article has a six-hour local cooldown so repeated interactions do not repeatedly probe the same page.

### Safe gateway boundary

A browser worker never fetches a learned remote source directly. Public pages and feeds are retrieved through:

`GET /api/frontier/forage?mode=html|feed&url=...`

The Node gateway applies an independent security boundary:

- HTTPS only
- no URL credentials
- no non-standard ports
- auth/token/key/signature/session/password-like query parameters are rejected
- DNS is resolved before fetch
- private, loopback, link-local, documentation/test, multicast, and other unsafe addresses are rejected
- redirects are manual and every redirect target is revalidated
- maximum three redirects
- eight-second request timeout
- HTML byte ceiling: 240 KB
- feed byte ceiling: 760 KB
- strict HTML vs RSS/Atom/XML content-type checks
- feed payloads must also contain RSS/Atom/RDF structure

The route returns public content only to the same browser session that requested it and uses `no-store`.

### Worker-side source graph parser

`sourceForagerWorker.ts` performs parsing and source evaluation away from rendering.

The lightweight parser extracts:

- `<link rel="alternate" type="application/rss+xml|application/atom+xml">`
- anchor links that strongly resemble RSS/Atom endpoints
- academic/citation destinations
- GitHub dependencies/repositories
- recurring external domains
- page title, description, keywords, H1, and H2 context

The parser is deliberately not a general browser or JavaScript engine. It does not execute scripts.

### Observed domain vs promoted source

Phase 6 distinguishes two concepts:

1. **Observed domain**: a domain seen in a meaningful outbound graph.
2. **Promoted polling source**: a real RSS/Atom endpoint that passed semantic and credibility gates.

A generic outbound domain is never blindly turned into a polling endpoint. Repeatedly observed domains can be probed at most once every 12 hours to discover an advertised feed from their public homepage.

### Semantic promotion gate

Candidate feed context is encoded with the current local embedding backend, projected through the same deterministic 384D → 64D projection used by the recurrent sequence model, and compared with the active 64D state.

Current default promotion requirements:

- source must be an actual feed candidate
- cosine similarity to active state ≥ 0.58
- credibility ≥ 0.72

Feed-advertisement evidence, academic/citation evidence, GitHub provenance, and known scholarly domains contribute to credibility.

### 50-source yield-aware LRU

The autonomous roster is capped at 50 sources.

Retention is not simple recency. It combines:

- long-term unseen yield quality
- semantic similarity
- credibility
- recency of useful discoveries
- recency of polling
- failure penalty

Every learned-source poll updates:

- total polls
- total discovered items
- unseen items yielded
- EWMA yield quality
- consecutive failures
- last useful timestamp

Low-yield sources receive a slower polling cadence, repeated failures back off exponentially, and weak sources naturally lose the retention contest.

## 2. One elected polling authority

The Phase 5 Web Locks daemon remains the only network polling owner.

A leader poll now has three bounded layers:

1. focused integrated FRONTIER feed
2. up to three due autonomous RSS/Atom sources through the safe gateway
3. one broad integrated fallback only if the combined unseen set remains too small

A source-roster `BroadcastChannel` wakes the current leader when a new source is promoted. Followers never start their own learned-source polling loop.

## 3. Longitudinal Watch Intents

A Watch Intent is explicit user-authored state, not a passive inferred preference.

Example:

```text
Watch: state-space neural models
Watch: unannounced Virtual Riot festival set
Watch: new JS13k physics engines
```

The command text is locally embedded into a normalized 384D vector and stored in IndexedDB with:

- stable intent ID
- human label
- 384D vector
- embedding backend (`minilm` or `feature-hash`)
- active/paused state
- creation/update timestamps

Up to 48 intents are retained. Inactive/older intents are evicted first only if the bound is exceeded.

### Coordinate-space safety

MiniLM and the deterministic feature-hash fallback are both 384-dimensional but are not the same semantic coordinate system.

Phase 6 therefore persists the embedding backend beside every intent. Incoming candidates are compared only against intents from the same backend. If the local backend changes, active intent labels are re-embedded and the compatible vectors are persisted before scoring resumes.

The vector worker also treats each embedding request as coordinate-space atomic: an entire request uses MiniLM or the entire request is recomputed with feature hashing. A partially mixed batch is never returned.

## 4. Interruption threshold

Every unseen daemon candidate still enters the exact seen filter before Watch evaluation.

For candidates whose novelty and quality are high enough to ever become interruptions, FRONTIER computes semantic similarity against active Watch Intent vectors.

The normalized semantic score is:

```text
watch_score = (cosine(item, intent) + 1) / 2
```

Current strict interruption requirements:

- normalized Watch score ≥ 0.92
- item novelty ≥ 0.76
- item quality ≥ 0.70

A score of `0.92` corresponds to raw cosine similarity of `0.84`.

This prevents generic relevance from becoming an interruption and prevents a semantically close low-quality item from winning merely because it matches the watch text.

Only explicit Watch Intents can set:

```ts
item.highPriority = true
item.watchSignal = { intentId, label, score, triggeredAt }
```

Passive preference learning cannot create this flag.

## 5. Interruption UX

Ambient discoveries retain the Phase 5 Stream Pulse behavior.

A new high-priority Watch match:

1. is announced once per local canonical identity
2. produces a separate bright, rapidly decaying Web Audio transient when the page is visible
3. still obeys the user's global audio mute and browser user-activation rules
4. enters the pending stream ahead of ambient backlog
5. takes the dedicated leading **Signal** slot when the stream is next revealed

FRONTIER intentionally does not tear the current grid out from underneath an active reader. The sound is the interruption; the spatial insertion is priority-first at the next reveal/near-end transition.

`SignalBoard` preserves ambient relative order but moves explicit high-priority items to the leading edge and renders a minimal marker:

```text
SIGNAL · <watch label> · <semantic confidence>
```

The desk grid gives that item a top-left five-column editorial slot with a very faint sage field. Mobile remains single-column.

## 6. Minimal command palette

`Cmd+K` on macOS or `Ctrl+K` elsewhere opens the single transient command surface.

Supported commands:

- `Watch: <topic>`
- `Unwatch: <topic>`
- `List watches`
- `Help`

The palette can also pause/resume or delete stored watches. It shows no permanent navigation item or settings dashboard.

Focus behavior is explicit:

- opening records the previously focused element
- input receives focus on the next animation frame
- `Escape` or a second `Cmd/Ctrl+K` closes the palette
- the previously focused element is restored with `preventScroll`

## 7. Failure behavior

| Failure | Behavior |
| --- | --- |
| IndexedDB unavailable | Core feed continues; source/Watch persistence is disabled |
| Forager worker failure | Runtime health degrades; reading and daemon continue |
| Unsafe/private source URL | Gateway rejects it before fetch |
| Feed endpoint stops being RSS/Atom | Poll counts as failure and backs off |
| Learned source yields nothing | Yield EWMA falls; cadence slows; eventual eviction becomes likely |
| MiniLM unavailable | Entire embedding batch uses deterministic feature hash |
| Embedding backend changes | Watch labels re-embed before comparison |
| Watch scoring fails | Candidate remains ambient; never becomes a false interruption |
| Audio unavailable/muted | Priority item remains priority-first visually |
| Web Locks unavailable | Existing single-worker fallback remains in force |

## 8. Privacy boundary

Autonomous foraging expands the public web boundary carefully.

A public URL is sent to the same-origin server forage gateway only after meaningful local engagement. The gateway may retrieve that public page or a promoted public RSS/Atom feed, but:

- it does not receive the user's 384D Watch vectors
- it does not receive the 64D recurrent state
- it does not receive local behavioral history
- it cannot fetch private network addresses
- URLs containing credential/token-style query parameters are rejected
- learned source roster, source yield statistics, Watch vectors, and domain observations remain local IndexedDB state

The server therefore provides network isolation, not centralized cognitive state.

## 9. Deterministic Phase 6 tests

Phase 6 adds unit coverage for:

- 50-source bounded yield-aware retention and eviction
- failure penalties vs useful long-term yield
- strict Watch semantic threshold
- novelty and quality interruption floors
- Watch command parsing
- `Cmd/Ctrl+K` and Escape focus policy
- alternate RSS/Atom extraction
- rejection of insecure/private-style client candidates
- citation/GitHub source graph evidence
- 64D semantic source promotion vs orthogonal rejection

All Phase 2–5 tests and production gates remain active.
