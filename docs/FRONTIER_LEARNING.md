# FRONTIER preference + habit learning

FRONTIER separates explicit preference from cautious behavioral learning.

## What it learns

Explicit reactions keep their own semantics: Love, Important, Surprise, Useful, Read, Already knew, Later, Meh, and Hide.

The behavioral model learns aggregate patterns from meaningful dwell, tile expansion, source opens, saves, reading layout, session rhythm, source choice, content format, novelty level, reading depth when available, time of day, weekday, and repeated lane/topic engagement.

All behavioral state remains browser-local and is included in the portable FRONTIER memory export. No private interaction history is written into the public daily content snapshot.

## Evidence hierarchy

FRONTIER deliberately treats behavior as uncertain evidence rather than ground truth.

```text
impression      very weak evidence
7.5 s dwell     weak positive evidence
expand          moderate positive evidence
open source     strong positive evidence
save            stronger positive evidence
explicit positive feedback
                strongest positive evidence
meh / hide      negative evidence
```

One skip is never interpreted as dislike. Quiet-skip penalties begin only after repeated exposure and remain small. Old behavioral evidence gradually loses confidence so the model can follow preference drift rather than fossilizing an old version of the owner.

## Stable between-session learning

Live behavior is recorded immediately for inspection, but implicit ranking reads a frozen preference snapshot captured at the beginning of a session.

That means reading one mountain-bike story cannot suddenly reorder the feed while it is on screen. Evidence from the current visit becomes ranking evidence on a later session.

The regression suite explicitly locks this behavior: current-session engagement cannot change the behavioral ranking adjustment until a later session snapshot is created.

## Context it can learn

The local model can identify patterns such as:

- lanes and topics that repeatedly earn attention
- trusted or repeatedly useful sources
- text, image, video, paper, code, or discussion preference
- morning / afternoon / evening / late reading rhythm
- time-of-day × topic habit pockets
- weekday × topic patterns
- high-novelty versus familiar discovery appetite
- quick versus deeper reading preference when read-time metadata exists
- Desk versus Feed preference
- most-used FRONTIER views
- approximate session length and return rhythm

## Ranking guardrails

The learned behavioral adjustment is deliberately bounded and supplements the editorial score rather than replacing it.

FRONTIER still protects finite Daily Run space for global importance, primary research, public code, reusable methods/project design, favorite teams, active sports, broader sports, games/music/culture, second chances, and exploration. Personalization cannot collapse the page into a one-topic filter bubble.

## Inspectability and control

The Radar view includes **What FRONTIER is learning** with confidence-aware habit summaries and learned lane tendencies.

The owner can pause behavioral learning or use **Forget habits** to clear only the implicit behavior model while retaining saves, explicit reactions, history, collections, and the rest of FRONTIER memory. Pausing remains paused after forgetting habits.

## Persistence and migration

The local state schema is version 2. Existing version-1 state and memory exports migrate in place by preserving profile, saves, collections, history, and game state while initializing the behavioral model.

The ranking snapshot is local behavioral state and is never part of the public content archive.

## Design constraints

- local-first by default
- no public behavioral telemetry
- no raw cursor paths, raw scroll trails, or keystroke logging
- no negative inference from one skip
- explicit feedback keeps distinct semantics
- current-session implicit evidence must not reshuffle the reading surface
- important information can break through personalization
- exploration remains protected
- learned behavior is inspectable, pausable, resettable, and portable
