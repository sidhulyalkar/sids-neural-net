# FRONTIER preference + habit learning

FRONTIER has two deliberately separate personalization layers.

1. **Explicit preference state** learns from Love / Important / Surprise / Useful / Read / Already knew / Later / Meh / Hide.
2. **Behavioral state** learns cautiously from what the owner actually spends time with: meaningful dwell, tile expansion, source opens, saves, reading layout, session rhythm, source choice, format, time-of-day, and repeated lane/topic engagement.

Both remain browser-local and are included in the portable FRONTIER memory export. No interaction history is written into the public daily snapshot.

## Why a separate behavioral model

A click is not a personality. FRONTIER therefore avoids collapsing every interaction into one opaque recommender score.

The behavioral model keeps counters for:

- broad lane engagement
- source kind and publisher/community engagement
- topic/tag engagement
- text / image / video / paper / code / thread format
- morning / afternoon / evening / late usage
- time-of-day × lane and time-of-day × format context
- weekday × lane context
- Desk vs Feed usage
- view usage
- session count and approximate active session duration

The model is intentionally aggregate-only. It does not record mouse paths, raw scrolling, precise cursor coordinates, or keystrokes.

## Evidence hierarchy

Implicit events are weighted by how meaningful they are:

```text
impression      very weak evidence
7.5 s dwell     weak positive evidence
expand          moderate positive evidence
open source     strong positive evidence
save            stronger positive evidence
explicit love / important / surprise / useful
                strongest positive evidence
meh / hide      negative evidence
```

A plain impression is not treated as dislike. Quiet-skip penalties only begin after repeated exposure, and even then their ranking effect is deliberately small. This prevents accidental scrolling, page position, or one busy session from poisoning the model.

## Contextual ranking

`lib/frontier/behavior.ts` computes a small confidence-weighted behavioral adjustment. The signal can consider:

- whether this lane has repeatedly earned engagement
- whether this source tends to produce useful items
- whether the item's format fits observed behavior
- whether this lane or format tends to work at the current time of day
- whether a topic has repeatedly led to meaningful engagement

The behavioral adjustment is intentionally bounded. It supplements the existing editorial score instead of replacing it.

FRONTIER still protects finite Daily Run slots for global importance, research evidence, code, reusable methods, favorite teams, active sports, broader sports, games/music/culture, resurfacing, and exploration. A learned habit cannot turn the product into a one-topic filter bubble.

## Inspectability

The Radar view includes **What FRONTIER is learning**. It exposes:

- high-confidence habit summaries
- preferred lane tendencies
- format tendency
- time-of-day rhythm
- Desk vs Feed preference
- approximate session shape
- confidence rather than pretending every observation is certain

The owner can pause implicit learning at any time or **Forget habits** without deleting saves, explicit reactions, history, or collections.

## Persistence and migration

The local state schema is version 2. Existing version-1 FRONTIER memory migrates in place by preserving profile, saves, collections, history, and game state while initializing an empty behavioral model.

Imported version-1 backups are accepted and upgraded the same way.

## Design constraints

- Local-first by default.
- No public behavioral telemetry.
- No raw surveillance-style event stream.
- No negative inference from one skip.
- Explicit reactions override implicit ambiguity.
- Important information can break through personalization.
- Exploration remains protected.
- Learned behavior is inspectable, pausable, resettable, and portable.
