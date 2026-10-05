# FRONTIER v25 render contract

FRONTIER should feel like a finite, precomposed reading surface rather than a live river whose entire history stays mounted. The performance authority is therefore the page, not the full candidate pool.

## Current bottlenecks

The current production route mounts decorative WebGL, telemetry, sync, runtime controls, autonomy, and the reading surface together. The reading surface can start from 48 selected items and extend with up to 96 streamed items. `SignalBoard` then performs semantic/synthesis work and maps the full displayed list into live card components. That architecture is useful for an infinite river, but it is the wrong topology for a page-turning interface.

The dominant costs are expected to be:

1. too many live React card trees and per-card effects;
2. media decoding and GPU/native media work for content the reader cannot see yet;
3. passive discovery changing the surface shortly after first paint;
4. ambient WebGL and bridges competing with first paint and interaction frames;
5. page-turn implementations that mount both outgoing and incoming React pages simultaneously.

## v25 invariants

### DOM and React

- Desktop `desk`: at most 10 mounted cards.
- Mobile / `feed`: at most 4 mounted cards.
- Exactly one live React page tree after navigation commits.
- Full candidate/ranking authority may remain in memory, but unmounted pages do not create card components.
- Page changes must not require rebuilding unrelated masthead, controls, or utility dock UI.

### Page turn

Use same-document `document.startViewTransition()` when supported. The browser snapshots the outgoing page, React swaps to the next single live page, and the compositor animates the old/new snapshots. This preserves a convincing paper turn without maintaining two expensive card trees.

Fallback: immediate DOM swap plus a short transform/opacity entrance. Reduced-motion: immediate or <=100 ms opacity transition.

Target visual motion:

- desktop: 220-260 ms;
- mobile: 180-220 ms;
- transform + opacity only;
- modest perspective/rotateY, not a 90-degree fold;
- no animated blur, filter, backdrop-filter, or clip-path.

### Media

- Current page: browser loads only media-bearing cards actually mounted.
- Idle warm: next page first, previous page second.
- Intent warm: pointer/focus/swipe direction may promote the destination page.
- Normal warm concurrency: 2.
- Save-Data or 2G: 0 idle warms, <=1 explicit-destination warm.
- 3G: <=1 idle and <=2 explicit-destination warms.
- Keep a small decoded cache and evict aggressively. The cache must ultimately be bounded by decoded pixel cost as well as URL count.
- Feed cards use poster/native-image surfaces until explicit expansion. No hidden autoplay video or iframe work.

### Data

- First content should come from a server/snapshot path when possible.
- Do not issue a duplicate passive `cache: no-store` feed request merely because the client hydrated.
- Live discovery may fill a candidate queue in the background, but it must not mutate the mounted page during its first interaction window.
- Explicit refresh/search can fetch immediately.

### Route isolation

The animated background, signal telemetry, mesh sync, and runtime controls are not dependencies of first useful paint. They must remain behind a lazy idle boundary. The ambient WebGL canvas is skipped for reduced-motion, Save-Data, and 2G clients.

The autonomy provider remains on the immediate path until its dependency surface is measured and a safe neutral context is proven.

## Performance gates

The v25 browser audit should run at 390x844, 1440x900, and 2560x1080 and repeat forward/back navigation at least 20 times.

Required gates:

- mounted card count within the 10/4 budget;
- exactly one live page plane after every committed turn;
- input-to-DOM-swap p95 <= 100 ms on the CI machine;
- no long task > 50 ms attributable to a page turn;
- no unexpected network request during a warmed page turn;
- adjacent media warm queue concurrency <= 2;
- no browse-card iframe or active video element;
- no decorative canvas or deferred bridge required before first useful content;
- stable card geometry before and after the page turn;
- reduced-motion path verified independently.

## Migration order

1. **Cold-path isolation**: defer non-critical route systems. Implemented first on v25.
2. **Bounded page authority**: preserve ranking over the full candidate set, but materialize only the current 10/4-card page.
3. **Predictive media warming**: next/previous page warm queue with connection-aware budgets and stale-direction cancellation.
4. **Compositor page turn**: View Transition snapshots with a progressive fallback.
5. **Server snapshot first paint**: remove duplicate hydration-time retrieval from the common path.
6. **Media surface simplification**: poster/native image for browse, rich video/GPU only on explicit expansion.
7. **Measured qualification**: exact-head browser timing, frame-gap, network, DOM, and screenshot audits before promotion.

## What not to merge

The older v21-v24 branches are design evidence, not merge candidates. Their useful constraints should be ported selectively onto current `master`; their stale base and older FRONTIER contracts should not be reintroduced wholesale.
