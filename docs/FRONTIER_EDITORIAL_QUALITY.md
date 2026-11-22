# FRONTIER editorial quality contract

FRONTIER is an evidence-led reader, not a feed that maximizes item count. A
candidate can be **true**, **highly rated at its source**, and **still not be
informative or relevant enough** for a precious slot in the edition.

## Admission before ranking

`editorialAdmission.ts` is a deterministic content-sufficiency gate,
independent of source popularity, predicted preference, and upstream scores.
It runs in both the live aggregate and the cold snapshot, before the
personalized ranker. The browser's durable candidate reservoir also
requalifies previously stored candidates on insertion and replay.

- **Structured sports states:** need structured payloads, not article prose.
- **Videos:** at least 90 characters / 13 words of genuine creator-provided
  content after sponsor, affiliate, and membership cleanup.
- **Community/link sources:** at least 80 characters / 12 words of substantive
  linked or firsthand context. Empty Hacker News/Lobsters entries are not
  promoted simply because their title has momentum.
- **News/RSS/web discovery:** at least 70 characters / 10 words with informative
  source copy; no advertorial starts.
- **GitHub:** specific release, change, or descriptive project metadata.
  Stars, forks, and generic "recently active project" descriptions cannot
  substitute for concrete technical evidence.
- **Research:** substantive paper/method descriptions without requiring
  citations (zero citations is normal for new research).
- **Other direct sources:** a baseline informative excerpt requirement.

These thresholds are deliberately asymmetric. A software release, scientific
abstract, scoreboard, and community discussion have very different evidence
shapes. Source trust remains a separate prerequisite.

An admission decision does **not** verify a publisher's factual claims. A
primary document can truthfully establish its own release notes, but independent
claims (especially clinical, consequential, or contested ones) still need
source-level verification and calibrated uncertainty. We must never invent
specific findings from a video title or an abstract.

## Content repair and information gain

Example: a Thinking Basketball NBA officiating video arrived with SeatGeek,
membership, and podcast links ahead of a substantive description. The
existing editorial sanitizer extracts only the original analytical passage.
The new gate ensures that a promotion-only version cannot survive, regardless
of the publisher's preassigned quality or the user's sports interest.

For official reporting, distinguish **new rules** from **newly emphasized
enforcement of existing rules**. A general topic description is not sufficient
evidence for a detailed claim. When direct source material is insufficient,
show its modest, attributed excerpt or exclude the story; do not write a
confident synthetic recap.

## Evaluation and release acceptance

Run:

```sh
npm test
npm run frontier:editorial-audit
npm run frontier:review-kit
npm run frontier:slate-audit
npm run typecheck
npm run lint
```

The editorial audit prints per-source input/admission counts, rejection reasons,
the highest-ranking qualified stories, and a bounded sample of exclusions.
It is an observable audit, not a model claiming its own precision.

Before a production rollout, human-label a stratified set of at least 100
candidates, including low-ranking discoveries and short niche releases. Record
story-level and recommendation-level outcomes:

| Measure | Release goal |
| --- | --- |
| Promotional copy in displayed summaries | 0 |
| Broken or untraceable displayed source links | 0 in audited sample |
| Unsupported factual claims in editorial copy | 0 in audited sample |
| Useful / worthwhile @14 according to blinded human review | >= 85% |
| Relevant @14 for the intended preference profile | >= 90% |
| Novel / non-redundant @14 | >= 85% |
| Valid short-form science / release items falsely rejected | <= 5% |
| Qualified cross-domain diversity | monitored, never forced over quality |

Targets are proposed acceptance criteria, **not measured results**. The next
evaluation phase should compare blind judgments against the prior system using
a fixed candidate batch, query provenance, reason-coded failures, and
calibration by source kind and topic. Keep all rejected candidates in the
offline audit rather than silently erasing the hard cases.

## Phase 2: full-inventory cold-start selection

Cold navigation previously sent only the first 36 provider-ordered snapshot
items to the reader. That prematurely excluded high-fit specialist work buried
below the provider cutoff. `selectFrontierColdEdition` now **ranks every
qualified candidate with the explicit taste profile first**, then composes
the finite 36-story reader edition. The reader receives the already chosen
edition as the SSR initial state and never silently recomposes it from that
truncated payload. Personalized hydration can still use the wider snapshot
when explicitly learned user history exists.

The first paint remains small: it transmits only the final edition, not the
whole source inventory. No new HTTP request is required.

## Phase 2: evidence-first blind review

Run `npm run frontier:review-kit` from the repository root. The command
reads the committed snapshot and writes:

- `artifacts/frontier-editorial-review/sample.json`: canonical source URLs,
  source-backed excerpts, admission reasons, reader positions, quality-review
  triage flags and SHA-256 provenance of the input snapshot.
- `sample.csv`: spreadsheet-friendly list of exactly the same review tasks.
- `labels.template.json`: explicit **null** labels, never synthetic judgments.
- `report.json`: source/quality rejection census and **null** quality metrics
  until the relevant source links have actually been inspected.

The deep snapshot builder writes a separate bounded
`artifacts/frontier-editorial-review/rejected-candidates.json` file containing
public source metadata rejected at the editorial gate. It is **never placed
in `latest.json` or returned by public feed endpoints**. The review-kit command
merges this same-run shadow evidence into the labeling pool, and checks the
snapshot timestamp to avoid evaluating stale mismatched rejections. When that
file is missing, the report explicitly says rejection capture is unavailable,
and false-exclusion quality cannot be considered measured.

The sampler includes the baseline first 14, the qualified first 14, and a
fixed, round-robin mix of approved/rejected rows across source kinds. It
avoids evaluation on only the candidates the new algorithm already trusts.
Its baseline is a *provider-ordered first-36 selection strategy control*;
it is not claimed to be an exact reconstruction of historical live sessions.

For each sampled item, open the **original source** and annotate these
boolean/null fields in a separate JSON labels file:

- `worthwhile`: worth a scarce editorial slot
- `relevant`: relevant to this specific reader's interests
- `novel`: supplies a new fact, technique, result or substantive perspective
- `sourceTraceable`: URL opens the attributed source
- `claimsSupported`: original source substantiates the visible claims

Use `null` for anything not actually checked, including inaccessible sources.
Then run:

```sh
npm run frontier:review-kit -- --labels=path/to/review-labels.json
```

Reported top-14 quality percentages remain `null` until **every** selected
item has the corresponding human label. The false-exclusion metric requires a
rejected candidate to be marked worthwhile **and** source-traceable **and**
factually supported; it uses reviewed rejected candidates as its denominator.
A partial observed rate is reported separately and must not be presented as a
validated rate. Duplicate labels and IDs not in the frozen sample are errors.

Editorial triage flags such as `generic-teaser`,
`high-provider-score-low-evidence`, and `promotional-language` are
review prompts, not unverified statements of fact. The sampler's output is
fully offline and requires no external model or private browsing telemetry.

The branch-head CI publishes this kit as a qualification artifact, but **CI
does not assert that human review occurred**. Human labels must be provided
explicitly and their results should be audited across source categories.
Do not tune only to the reviewed false positives and forget the reviewed
false negatives.

## Failure behavior

If scraping returns only a title, a paid description, or no useful context,
the candidate does not enter the editorial reader. Source adapters may continue
reporting degraded status; an incomplete edition is preferable to filler.
The deterministic rule is intentionally cheap enough for first paint and adds
no network requests, LLM dependency, or new paid service.

The existing relevance engine still decides *which* qualified stories are
especially useful today. Admission does not infer a user's taste from passive
clicks, and no source score can bypass editorial qualification.
