# FRONTIER Phase 7 — Signal Precision and Synthesis

Phase 7 reduces semantic cross-contamination while increasing the amount of useful evidence each spatial card can carry. It does not replace the Phase 5 exact-unseen contract or the Phase 6 autonomous scout.

## Authority order

```text
real source item
    ↓
exact unseen boundary
    ↓
positive semantic ranking
    ├─ routed 64D fast trajectory
    ├─ global long-term fallback
    └─ explicit Avoid subtraction
    ↓
anti-staleness / exploration
    ↓
presentation synthesis
    ├─ grounded artifacts
    ├─ semantic velocity
    └─ convergence collapse
    ↓
spatial card / focal plane
```

Synthesis is downstream of ranking. It can compress presentation, annotate evidence, or elevate visual salience, but it does not create a synthetic article identity or bypass explicit ranking constraints.

## Parallel context trajectories

The original global sequence state remains for backward compatibility, peer continuity, and cold start. Phase 7 adds seven bounded parallel fast states:

- research
- algorithms
- spectator sports
- outdoor / motion
- games
- music
- culture

Existing FRONTIER lanes route deterministically into one of these namespaces. Every trajectory uses the same bounded state-space update as the original fast model:

```text
x[k+1] = A x[k] + B(wu[k])
y[k]   = Cx[k]
```

Each trajectory stores one 64D state plus its reconstructed 384D target. Total fast trajectory state therefore remains tiny and fixed.

Candidate semantic scoring resolves its positive target by candidate domain. A new trajectory blends with the global fallback for its first two interactions; after three context-specific interactions it becomes authoritative for that domain's fast target. A trajectory older than 36 hours falls back to the global target rather than carrying stale momentum forever.

Exploration distance is also resolved against the candidate's own 64D state. A music deep dive therefore does not make a technical paper look novel merely because it is far from the current music state.

## Explicit negative semantic anchors

The command palette now accepts:

```text
Avoid: generic AI hype
Avoid: transfer rumor spam
Unavoid: generic AI hype
List avoids
```

An Avoid anchor is a persistent 384D vector with the same embedding-backend tag used by Watch Intents. MiniLM and feature-hash spaces are never mixed.

Avoid is intentionally not negative training. It is a reversible score-time subtraction:

```text
S = S_positive - P_avoid
```

The normalized avoid match begins at 0.74 and ramps to a maximum penalty of 0.34. The penalty also remains fully present during high exploration temperature, so novelty cannot resurrect a semantic region the reader explicitly suppressed.

Removing or pausing an anchor removes the suppression immediately without having to reverse changes to the positive profile.

## Rolling 14-day source yield

The autonomous RSS/Atom roster still has a hard maximum of 50 sources. Phase 7 adds a rolling 14-day evidence window per learned source:

- poll count
- returned candidates
- exact-unseen candidates
- aligned high-value candidates
- failures

Lifetime yield remains diagnostic, but recent aligned/unseen yield now has stronger retention weight. Low recent yield increases poll spacing by up to 4×.

After probation, sources can be evicted automatically when they repeatedly return material that is neither unseen nor aligned, remain below minimal aligned/unseen rates after enough samples, or fail on at least 75% of a sufficiently large recent polling window.

The elected Phase 5 daemon remains the single network owner. It computes aligned yield from normalized item quality/base score/importance or novelty and feeds the sample back into the local roster.

## Convergence nodes

Convergence is a post-ranking presentation collapse over real source items.

A cluster requires:

- the same routed curiosity context
- publication inside a bounded 72-hour default window
- strong vector similarity (`cosine >= 0.83`), or a slightly looser vector match plus salient token overlap
- at least three member items
- at least three distinct source kinds or domains by default

Union-find builds connected semantic components. The best real source card becomes the representative. Other real members are carried as source links inside `convergence.members` and suppressed only from that presentation pass.

The representative preserves:

- canonical item identity
- canonical outbound URL
- Watch priority from the strongest cluster member
- strongest Velocity signal
- grounded artifacts from cluster members

No generated headline, generated article body, or synthetic URL is introduced.

## Axiomatic artifact extraction

Phase 7 extracts compact structural evidence only from information already present in the normalized item:

- existing source metrics → benchmark badges
- GitHub repository or release URLs → repo/release badges
- compact formula-like expressions present in title/summary
- compact benchmark claims present in summary text
- explicitly labeled tracklists/setlists in music summaries

Extraction is deterministic and bounded. It does not infer missing benchmark values, manufacture equations, or summarize unavailable article bodies.

The focal plane also selects up to three high-information sentences from the real summary as takeaways using deterministic lexical/numeric cues rather than generative rewriting.

## Emerging semantic velocity

Velocity uses a separate bounded local observation store:

- maximum 640 observations
- maximum 48 hours
- 64D projected vectors only

For a candidate, the detector measures semantic neighbors (`cosine >= 0.81`) in:

- recent window: 2 hours
- baseline window: previous 22 hours

A Pulse requires all of:

- at least four recent semantic neighbors
- at least three distinct sources
- at least 2.15× recent-vs-baseline acceleration
- composite velocity score >= 0.62

This prevents one prolific source from manufacturing an emerging trend through volume alone.

## Focal-plane Quick View

When a pointer is over a card, Space opens a temporary focal plane. Escape or the backdrop closes it.

The focal plane exposes:

- full normalized summary
- deterministic source-grounded takeaways
- structural artifacts
- converging real source links
- Watch / Velocity metadata
- the existing authentic media surface
- canonical source link

The previous focused element is restored with `preventScroll` after close. Space is ignored while focus is on text inputs, links, buttons, media, or other interactive controls.

The focal plane does not create a second page, mutate card order, or itself mark hidden convergence members as seen.

## Adaptive typographic density

The reading surface has three presentation states:

- `scan`
- `balanced`
- `deep`

High absolute scroll velocity enters scan mode. Scan mode persists through a lower hysteresis threshold so the layout does not flicker. Sustained dwell, explicit expand, or open temporarily enters deep mode unless the reader begins moving quickly again.

Only presentation variables change:

- row/feed gap
- headline scale/line-height
- summary scale/line-height
- local vertical spacing

Density state never changes semantic weights or engagement evidence.

## Failure model

All Phase 7 systems are additive:

- trajectory IndexedDB failure → global ranking target
- Avoid store failure → ordinary positive ranking
- synthesis vector lookup failure → real items remain uncollapsed
- velocity store failure → no Pulse annotation
- artifact extraction failure → ordinary card
- focal plane failure → ordinary card navigation
- adaptive-density failure → balanced layout

The reading surface remains usable without any Phase 7 subsystem.

## Regression invariants

Phase 7 tests lock:

- deterministic lane → trajectory routing
- context isolation and cold-start blending
- bounded Avoid penalty and reversible palette grammar
- Avoid subtraction from the final hybrid score
- 14-day low-yield source eviction
- productive source retention
- three-source convergence and two-source non-collapse
- grounded benchmark/repository/formula extraction
- cross-source semantic Velocity requirements
- adaptive density thresholds/hysteresis
- focal-plane keyboard policy

All previous exact-unseen, Watch threshold, source gateway, worker, vector, sequence, CRDT, privacy, build-budget, Nature Atlas, and World Loom gates remain enabled.
