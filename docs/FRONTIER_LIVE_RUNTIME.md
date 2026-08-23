# FRONTIER live adaptive runtime

FRONTIER is designed to refresh discovery **at request time**. A new article, paper, repository, sports story, or other signal does not require a new `sidhulyalkar.com` deployment before it can appear.

The checked-in daily snapshot is a durability layer and fallback. It is not the primary live transport.

## Runtime loop

```text
browser-local taste + behavior
          │
          ▼
  bounded discovery focus
          │
          ▼
/api/frontier/feed?focus=...
          │
          ├─ existing core source mesh
          ├─ personal/team/game/music mesh
          ├─ active-sports mesh
          ├─ focused GDELT live web search
          ├─ focused OpenAlex search
          └─ focused GitHub repository search
          │
          ▼
 normalize → dedupe → English → rank locally
          │
          ▼
 finite Grid/List FRONTIER
```

The client refreshes every four minutes while the FRONTIER tab is visible and refreshes again when a hidden tab becomes visible. `Refresh live` bypasses the short response cache. Requests are cancelled when a newer request supersedes them so an older slow response cannot overwrite a newer feed.

This is intentionally near-real-time polling rather than a permanent WebSocket. The upstream sources are pull APIs and public feeds, and serverless request-time querying is cheaper and more failure-tolerant than holding a connection open when no upstream source is actually pushing events.

## Adaptive query planner

`lib/frontier/discoveryFocus.ts` converts the browser-local world model into a small list of search concepts.

Inputs include:

- explicit topic affinity from reactions
- stable between-session behavioral evidence
- underexposed interests that still deserve exploration
- known-topic state
- negative feedback

The planner collapses aliases such as `mtb` into `mountain biking`, ignores generic tags, excludes strongly negative topics, applies a small penalty to topics already modeled as familiar, and sends at most ten short focus strings to the runtime endpoint.

Raw browsing history, dwell traces, saved items, and reaction history remain in browser storage. The server sees only the bounded focus concepts needed to run the current request.

## Live source strategy

### GDELT

Focused concepts query GDELT DOC 2.0 across the last 48 hours, sorted newest first. FRONTIER uses the source URL, headline, source domain, publication time, source country when available, and source-backed social image when supplied.

No article body is invented when GDELT only provides a headline. The text-only editorial clipping renderer falls back to that real headline.

A per-domain cap prevents a single publisher from taking over the candidate pool. Known high-authority news, scientific, institutional, and official-sports domains receive a quality prior, while unknown domains remain eligible at a lower prior rather than being discarded outright.

### OpenAlex

Research-like focus concepts query recent OpenAlex works directly at runtime. Results preserve work title, authors, venue/source, publication date, citation count, topical metadata, and source/DOI/open-access destination.

### GitHub

Builder-like concepts query recently pushed repositories. Ranking uses recency plus repository activity and keeps stars/forks as discovery signals rather than treating popularity as truth.

Existing Reddit, Hacker News, RSS, Steam, YouTube, sports, football, Brave, and other adapters continue to participate in the wider mesh.

## Ranking

FRONTIER separates candidate generation from ranking.

Candidate generation asks, “What is new enough and adjacent enough to inspect?” Ranking asks, “Which finite set is most useful for this reader right now?”

The personalized score combines:

- source-level base relevance
- importance
- source quality
- momentum
- freshness
- explicit lane/topic/source affinity
- useful novelty
- known-topic penalty
- learned behavioral adjustment
- resurfacing
- a small uncertainty/exploration bonus

The uncertainty bonus is deliberately bounded. It prevents an early handful of clicks from collapsing the system into a narrow filter bubble while keeping explicit positive/negative feedback much stronger.

The finite Daily Run also caps repeated lanes and repeated source hosts so one topic or publisher cannot monopolize the page.

## Behavioral learning

### Explicit feedback

The main card actions expose:

- **thumb up**: more like this
- **thumb down**: less like this
- save
- open source

The existing richer feedback menu remains available for `love`, `important`, `surprise`, `useful`, `read`, `already knew`, `later`, `meh`, and `hide`.

Up/down feedback updates lane, topic, and source affinity. `Already knew` updates knowledge without teaching dislike. `Hide` suppresses the item. Negative feedback also prevents unwanted resurfacing.

### Dwell

Cards measure actual time while at least 55% of the card is visible. Attention stops accumulating when the card leaves the viewport or the browser tab becomes hidden.

Dwell is not treated as an implicit “like.” Roughly twelve seconds of visible attention contributes one soft engagement unit, and the contribution is capped relative to impressions. Opens, saves, and explicit votes remain materially stronger evidence.

History stores accumulated attention time so the learned model remains inspectable.

### Stability

Behavior learned during a session does not reshuffle the active reading surface underneath the user. Ranking reads a frozen behavioral snapshot captured at the start of a new session. New behavior becomes ranking evidence on a later session.

Adaptive **query focus** can update as explicit preferences evolve, while the card ranking remains governed by the frozen behavioral snapshot. This separates “search a little wider/narrower next refresh” from “reorder what I am currently reading.”

## Reliability and privacy

- every upstream source is independently fault-isolated
- network fetches have bounded timeouts
- the live route always returns a usable degraded response rather than requiring all sources to succeed
- live responses are short cached; manual refresh uses `no-store`
- the durable snapshot remains available if upstream sources fail
- raw private behavior remains browser-local
- only public discovery results are eligible for public snapshots
- live source images/videos must still satisfy the real-media-only rendering contract

## Deployment implication

Code changes still require a deployment, as normal. **Content changes do not.** Once this runtime is deployed, opening FRONTIER or leaving it open is enough to query current upstream information and receive new candidates. The scheduled GitHub snapshot refresh remains useful for durability, but it is no longer what makes the live page current.
