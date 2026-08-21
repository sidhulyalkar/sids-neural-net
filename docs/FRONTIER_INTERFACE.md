# FRONTIER interface contract

FRONTIER is a reading experience first. Product machinery should stay quiet until the user asks for it.

## Default surface

The persistent interface is deliberately small:

- FRONTIER identity + current perspective
- one universal topic search field
- Today / Explore / Saved / Seen / Radar
- For You / Brainfood / After Hours
- live-state dot + manual refresh
- Grid/List icons inside the content surface

Everything else is either contextual or collapsed.

## Topic search

The masthead search is both a local relevance filter and a live-discovery control.

1. The user types a natural topic or phrase and presses Enter.
2. Input is normalized and bounded before it enters the live request contract.
3. The explicit query becomes the first discovery-focus term, ahead of learned adaptive interests.
4. The server performs the normal request-time source mesh using that focus.
5. Results are locally filtered and reranked by title/tag/summary relevance while retaining the normal credibility and personalization ranking upstream.

The `/` key focuses search when the user is not already typing in another control. Escape clears the current query.

A search is not itself treated as a positive preference vote. FRONTIER learns from what the user subsequently reads, saves, opens, upvotes, downvotes, or spends meaningful visible attention on. This prevents curiosity searches from permanently rewriting taste.

## Content, not chrome

The interface should not explain itself repeatedly.

- no onboarding cards masquerading as content
- no permanent source-count dashboards
- no visible XP/streak/status prose in the reading surface
- no permanent preference-model explanation
- no decorative generated media
- no tags unless they materially help navigation

Text-only content uses source-grounded editorial clippings. Real source media is shown only when it exists and is useful.

## Progressive disclosure

Secondary mechanics stay behind deliberate actions:

- card metrics and recommendation rationale → Context
- detailed reactions → Context → Feedback
- collections membership → Organize
- export/import/reset → Data
- learned behavioral model → Radar

## Responsive behavior

Desktop prioritizes a centered search field and broad content canvas. Mobile gives search its own full-width masthead row and defaults the content board to List mode. Filters are horizontally compact and never push explanatory copy ahead of the content.

## Accessibility

- search uses the native `role="search"` form behavior
- all icon-only controls have `aria-label` and `title`
- Grid/List state remains keyboard accessible
- preference learning remains user-toggleable
- motion transitions respect `prefers-reduced-motion`

## Design test

Before adding persistent UI, ask:

> Does this help choose, find, read, save, or understand content right now?

If not, it should probably be contextual, collapsed, or removed.
