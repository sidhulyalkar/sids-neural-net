# FRONTIER: Editorial preference calibration

Owner-selected preset (November 2, 2026)

- Discovery: balance surprising discoveries and useful validated advances.
- Depth: prefer conceptual explanations, mechanisms, causal links, tradeoffs,
  and significance before implementation minutiae.
- Practical utility: balance transferable tools with pure curiosity.
- Exploration: target 25% unfamiliar, qualified discoveries. This is a
  **soft target**, not a compulsory share or permission to lower source quality.
- Lower the prominence of duplicate coverage, exaggerated headlines,
  speculation with little supporting source detail, celebrity gossip,
  superficial descriptions, and generic AI product announcements.

## Implementation

`lib/frontier/editorialTaste.ts` is a deterministic preset. The ranking
component `editorialTaste` is reported separately from source trust,
personal interests, freshness, and previous explicit feedback. It operates
on admitted source content; it never asserts that automatically flagged
claims are false or independently verified.

The slate selection gives a modest exploration bonus to qualifying candidates
inside the existing personalization window. Near-identical headlines are
not selected twice. Scientific discoveries and meaningful releases remain
eligible even when their summaries are concise.

## Measurement

`npm run frontier:review-kit` provides the preset version, heuristic
risk categories, qualified-exploration share, source URLs and independent
review fields for conceptual usefulness, practical value, noise avoidance
and worthwhile unexpected discoveries.

The review metrics stay unscored until original sources are inspected and
corresponding human labels are provided. The measured exploration share is
only a heuristic exposure statistic, not proof that the reader found those
items surprising.

Review admitted and rejected content, compare against the baseline edition,
and monitor false rejections. Keep independent verification distinct from
lexical signal detection.

## Qualification

```sh
npm test
npm run typecheck
npm run lint
npm run frontier:review-kit
npm run frontier:slate-audit
```

This work depends on the existing editorial and reader PR stack. Do not
deploy until those dependencies and browser checks are validated.
