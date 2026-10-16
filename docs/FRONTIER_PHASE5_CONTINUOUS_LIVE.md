# FRONTIER Phase 5 — continuous unseen discovery

Phase 5 turns FRONTIER's request-time discovery system into a continuously warming, multi-tab local stream while preserving the local-first and visually quiet product contract established in Phases 3 and 4.

The goal is not infinite scrolling for its own sake. The goal is a stronger invariant:

> When FRONTIER offers a new live rotation, candidates whose canonical identity is already committed to the local seen ledger are rejected before ranking or insertion.

This invariant is exact for the canonical signatures FRONTIER records. It does **not** claim that two independently published URLs about the same real-world story are semantically identical, and it does not claim that upstream sources can always supply a non-empty unseen batch. When the source mesh has no unseen material, FRONTIER remains quiet rather than recycling content.

## 1. Seen identity: Bloom accelerator + exact ledger

`lib/frontier/live/seenLedger.ts` owns the live-feed suppression boundary.

Each item can contribute two canonical signatures:

- canonical URL hash
- normalized title hash, when the normalized title is long enough to be a useful identity signal

URL canonicalization removes fragments, common tracking parameters, leading `www.`, duplicate path separators and irrelevant query ordering. Title canonicalization normalizes case, Unicode combining marks, punctuation and whitespace.

### Why the Bloom filter is not authoritative

A Bloom filter has false positives by construction. Treating a Bloom hit as definitive would incorrectly suppress some genuinely unseen content.

FRONTIER therefore uses the Bloom filter only as a fast negative cache:

```text
candidate signatures
      │
      ▼
Bloom says definitely absent? ── yes ──► unseen
      │ no / maybe
      ▼
exact IndexedDB lookup
      │
      ├─ record exists ──► reject
      └─ no record ──────► unseen
```

The authoritative store is IndexedDB `seen_items_store` in `frontier-seen-ledger-v1`.

A revision token in the metadata store lets another tab detect that its in-memory Bloom snapshot is stale. Cross-tab seen commits are additionally announced over `BroadcastChannel`, allowing pending buffers to evict newly seen items immediately.

### What counts as seen

A live card enters the durable seen ledger when either condition is met:

1. it remains at least 55% visible in an active browser tab for **2.5 continuous seconds**, or
2. the user explicitly opens, saves, reacts to, or expands the item.

The existing behavioral `impression` event still occurs when a card first enters the 55% viewport threshold. Phase 5 intentionally separates that soft telemetry event from the stronger permanent suppression decision.

Leaving the viewport or hiding the tab before the 2.5-second threshold cancels the durable timer.

### Migration

On the first Phase 5 run, previously recorded FRONTIER history is copied into the seen ledger once. This prevents an upgrade from treating years of already-recorded history as fresh material.

### Live resurfacing policy

The previous automatic `second-chance` resurfacing mechanism is no longer part of `Today` or `Browse`.

Seen material remains fully available through:

- History
- Saved
- user-created collections

A future spaced-review mode can deliberately surface old material, but that mode must be explicit rather than competing with the fresh-content invariant.

## 2. Multi-tab discovery daemon

Every FRONTIER tab owns a lightweight module worker, but only one worker is permitted to poll the source mesh at a time when Web Locks are available.

```text
Tab A worker ─┐
Tab B worker ─┼── navigator.locks: frontier_live_daemon
Tab C worker ─┘                    │
                                   ▼
                            elected leader
                                   │
                                   ▼
                        /api/frontier/feed
                                   │
                      normalize / source isolation
                                   │
                                   ▼
                   exact seen guard + candidate pool
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
             BroadcastChannel              IndexedDB pool
                    │
          ┌─────────┼─────────┐
          ▼         ▼         ▼
        Tab A     Tab B     Tab C
       pending   pending   pending
```

The lock is origin-scoped and exclusive. The leader holds it for the lifetime of its discovery loop. If that worker or tab disappears, the callback settles and another waiting worker can acquire the lock.

`BroadcastChannel('frontier-live-daemon-v1')` carries:

- newly discovered unseen batches
- poll requests from follower tabs
- coarse tab-presence/activity heartbeats

The elected leader therefore adapts polling cadence using aggregate activity rather than only the leader tab's visibility.

### Poll cadence

The base cadence is deliberately conservative:

- visible + recently active: 45 seconds
- visible but idle: 120 seconds
- all known tabs hidden: 300 seconds

Repeated empty polls back off gradually. Network failures use an exponential multiplier. The interval is capped at ten minutes.

Near-end scrolling and manual refresh can wake the leader early without creating a second network poller.

### Source architecture

The worker does **not** call OpenAlex, arXiv, GitHub, RSS, Hacker News, Hugging Face or other upstream services directly.

Instead it calls the existing same-origin `/api/frontier/feed` route. That route already owns:

- upstream source adapters
- source-specific timeouts
- normalization
- deduplication
- media decoration
- SSRF/privacy boundaries
- optional credentials and server-side environment configuration

This avoids duplicating CORS-sensitive clients and prevents public browser code from becoming a second ingestion implementation.

A focused poll can issue one bounded broad fallback request when personalization returns too few unseen candidates. There is no unbounded retry loop and no synthetic filler.

### Candidate pool

`frontier-live-candidates-v1` is a shared IndexedDB staging pool.

It is bounded to:

- at most 512 records
- at most 72 hours of age

Candidates are canonical-deduplicated before insertion and exact-seen-filtered again when read. The pool exists to survive tab handoff and leader changes, not to become a second lifetime archive.

### Browser fallback

If Web Locks are unavailable, a worker can still run in a `single-worker-fallback` mode. In that compatibility mode FRONTIER cannot promise origin-wide single-leader coordination across tabs, but the exact seen ledger, candidate deduplication and BroadcastChannel sharing remain useful where supported.

## 3. Anti-staleness and dynamic exploration

The existing hybrid ranking remains the exploitation baseline.

During a novelty rotation Phase 5 computes:

```text
S_final = (1 - tau) * S_rank
        + tau * exploration(item, x_k)
        - P_repetition(item | visible grid)
```

where `tau` is clamped to `[0, 1]`.

### 64D context distance

Candidate 384D embeddings are projected using the same deterministic projection used by the recurrent sequence model. Distance is computed against the active 64D recurrent state:

```text
distance = (1 - cosine(project(u_item), x_k)) / 2
```

The exploration term multiplies semantic distance by a bounded credibility factor. Semantic strangeness alone cannot turn a low-quality candidate into the winner.

### Repetition penalty

`P_repetition` is logarithmic so repeated domains, authors and topic clusters are discouraged without being permanently banned:

- domain: `alpha * log(1 + N_domain)`
- author: `0.55 * alpha * log(1 + N_author)`
- tag cluster: `0.45 * alpha * log(1 + N_tag)`

The reference set is the visible/current rotation before a fresh insertion.

### Temperature schedule

Current product defaults:

- ordinary browsing: `tau = 0.08`
- queued stream insertion: temporary `tau = 0.62`
- explicit manual fresh rotation: temporary `tau = 0.82`
- topic-search transition: temporary intermediate exploration boost

Temperature decays back to the baseline after the short novelty window.

## 4. Non-disruptive stream insertion

Fresh discoveries discovered while the user is reading are not immediately injected into the active grid.

Each tab maintains a bounded pending buffer. A small `FrontierStreamPulse` near the Utility Dock indicates that fresh signals are waiting.

The user can reveal them by:

- clicking the pulse
- pressing `N`
- naturally approaching the end of the current feed

`SignalBoard` keeps a stable displayed-item order while stream items append. Existing cards therefore do not reshuffle underneath the reader just because the semantic model has reranked the enlarged candidate set.

A manual refresh is intentionally different: it represents an explicit request for a new rotation, so the previous order is released and the high-temperature unseen set becomes the new surface.

## 5. Exact filtering boundaries

Seen filtering is applied at multiple boundaries rather than only once:

1. cached-feed hydration
2. direct `/api/frontier/feed` response
3. daemon leader ingestion
4. shared candidate-pool insertion
5. follower BroadcastChannel receipt
6. tab pending-buffer admission
7. pending-buffer flush into the visible feed
8. manual fresh rotation

The repeated checks protect against normal races such as an item being marked seen in another tab while it is waiting in the local pending queue.

The invariant is identity-level and local-first. It is intentionally phrased more narrowly than “100% of real-world stories can never repeat,” because two publishers may report the same underlying event using different URLs and materially different titles.

## 6. Runtime health and failure contract

Phase 5 adds `live-daemon` to the Phase 4 runtime-health registry.

A daemon worker failure:

- marks the subsystem degraded/failed
- terminates the failed worker
- retries with bounded exponential backoff
- does not block the current feed
- does not destroy the seen ledger or candidate pool

A polling failure leaves the current reading surface untouched.

If IndexedDB is blocked by browser privacy policy, FRONTIER falls back to its existing in-session state rather than refusing to render. In that degraded environment the durable cross-session unseen guarantee is necessarily unavailable.

If BroadcastChannel is unavailable, cross-tab immediate delivery is unavailable but each tab can still read persisted state where browser capabilities allow it.

## 7. Reset semantics

The FRONTIER reset action now clears:

- regular local FRONTIER memory
- vector memory through the existing reset path
- seen ledger
- live candidate pool
- pending stream buffer
- exploration rotation state

This makes Reset a true fresh-start operation rather than leaving Phase 5 suppression state behind.

## 8. Regression coverage

Phase 5 adds deterministic tests for:

- Bloom-filter no-false-negative behavior for inserted signatures
- bounded measured false-positive rate on held-out signatures
- canonical URL/tracking normalization
- exclusive leader handoff after the current lock owner releases
- logarithmic repetition penalties for domain/author/topic reuse
- 64D semantic-distance behavior
- high-temperature promotion of credible semantically distant candidates

These tests complement the existing Phase 3/4 vector, sequence, signal, CRDT, runtime-health, ingestion, privacy, media, bundle and production-browser gates.

## 9. Product result

Phase 5 changes the conceptual model from:

```text
open page → fetch → rank → read → refresh
```

to:

```text
continuous shared discovery
        ↓
exact unseen guard
        ↓
bounded candidate reservoir
        ↓
quiet pending pulse
        ↓
explicit or near-end insertion
        ↓
diversity-aware semantic ranking
        ↓
2.5 s / explicit durable seen commit
        ↺
```

The page can remain visually still while the intelligence layer behind it keeps searching for the next genuinely unseen thing worth showing.
