# FRONTIER interface contract

FRONTIER is a reading experience first. Product machinery should stay quiet until the user asks for it.

## Default surface

The persistent interface is deliberately small:

- FRONTIER identity
- one universal topic search field
- tiny live-state dot + refresh
- compact account state
- the actual content surface
- one floating bottom Utility Dock for view/scope/filter/layout controls

Nothing should sit between the search masthead and the content feed unless it is content.

## Bottom Utility Dock

Navigation and feed controls live in a compact glass dock at the bottom center of the viewport.

The dock owns:

- Today / Browse / Saved / Seen / Radar
- For You / Brainfood / After Hours when the current view is a live feed
- category and format filters
- Grid / List layout mode
- the current focused-search phrase when one is active

The dock should take only the width its controls need. It uses a translucent graphite surface, subtle blur, a hairline border, and no decorative copy.

### Motion behavior

The dock is intentionally peripheral while reading:

- scrolling downward fades/translates it below the viewport edge
- scrolling upward restores it
- moving a pointer near the bottom edge restores it
- pointer interaction and keyboard focus keep it visible
- the behavior is requestAnimationFrame-throttled and uses passive scroll/pointer listeners
- `prefers-reduced-motion` removes decorative transitions

The content canvas reserves bottom safe space so the dock never covers the final cards or browser safe-area inset. On narrow screens it is lifted above the site's persistent camera-signal affordance so both controls retain independent hit targets.

## Topic search

The masthead search is both a local relevance filter and a live-discovery control.

1. The user types a natural topic or phrase and presses Enter.
2. Input is normalized and bounded before it enters the live request contract.
3. The explicit query becomes the first discovery-focus term, ahead of learned adaptive interests.
4. The server performs the normal request-time source mesh using that focus.
5. Results are locally filtered and reranked by title/tag/summary relevance while retaining the normal credibility and personalization ranking upstream.

The `/` key focuses search when the user is not already typing in another control. Escape clears the current query.

A search is not itself treated as a positive preference vote. FRONTIER learns from what the user subsequently reads, saves, opens, upvotes, downvotes, or spends meaningful visible attention on. This prevents curiosity searches from permanently rewriting taste.

## Waterfall search transition

Submitting a non-empty search creates a short tactile transition from searching into exploration.

Before React clears the input, `useWaterfallText` measures the visible input characters from a temporary single text node using DOM `Range` geometry. This preserves real browser font metrics and kerning rather than estimating character widths.

The visible characters are copied into an `aria-hidden`, pointer-events-none fixed overlay. A tiny requestAnimationFrame loop advances each glyph with:

- initial upward/outward momentum
- gravity
- air drag
- horizontal wall response
- a low-restitution bounce against the top of the Utility Dock, or the viewport floor when the dock is unavailable
- floor friction and angular damping
- a complete opacity fade by 1.5 seconds

There is no physics dependency. The integrator is a few scalar updates in `lib/frontier/waterfallPhysics.ts`.

### Lifecycle safety

The animation is self-cleaning:

- a new search cancels and removes any previous particle overlay
- completion cancels the animation frame and removes every generated node
- component unmount cancels the frame and removes the overlay
- hidden tabs naturally skip stale animation work because requestAnimationFrame pauses
- reduced-motion users skip the particle effect entirely
- generated glyph nodes never receive pointer events and never enter the accessibility tree

## Content, not chrome

The interface should not explain itself repeatedly.

- no onboarding cards masquerading as content
- no permanent source-count dashboards
- no visible XP/streak/status prose in the reading surface
- no permanent preference-model explanation
- no decorative generated media
- no tags unless they materially help navigation
- no permanent top filter/navigation rail between search and content

Text-only content uses source-grounded editorial clippings. Real source media is shown only when it exists and is useful.

## Progressive disclosure

Secondary mechanics stay behind deliberate actions:

- card metrics and recommendation rationale → Context
- detailed reactions → Context → Feedback
- collections membership → Organize
- export/import/reset → Data
- learned behavioral model → Radar

## Responsive behavior

Desktop prioritizes a centered search field and broad content canvas. Mobile gives search its own full-width masthead row and defaults the content board to List mode. The Utility Dock can horizontally scroll within its viewport-width cap rather than forcing controls to wrap over content.

## Accessibility

- search uses the native `role="search"` form behavior
- all icon-only controls have `aria-label` and `title`
- native selects remain keyboard and screen-reader accessible
- Grid/List state uses `aria-pressed`
- the Utility Dock remains visible while focused
- falling text is decorative and `aria-hidden`
- preference learning remains user-toggleable
- motion transitions respect `prefers-reduced-motion`

## Design test

Before adding persistent UI, ask:

> Does this help choose, find, read, save, or understand content right now?

If not, it should probably be contextual, collapsed, or removed.
