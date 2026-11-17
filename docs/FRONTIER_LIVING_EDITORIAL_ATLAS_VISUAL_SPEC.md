# FRONTIER: Living Editorial Atlas · Visual Architecture V3.4

Status: **draft design experiment**. Base: verified integrated reader [PR #194](https://github.com/sidhulyalkar/sids-neural-net/pull/194). Not a production release.

## The problem shown in real CI screenshots

1. **Contents became an accordion**: the publication index and the live article were stacked, so neither could own the viewport. At mobile width the open index stretched the page above an unrelated sports article.
2. **The editorial cover lacked a focal point**: a pale, low-contrast research note competed with a pale list of stories, creating little compositional hierarchy.
3. **Cross-disciplinary exploration was invisible**: counts were already present in the top navigation, but the actual distribution and pathways through research, engineering, sports, culture, and nature had no spatial expression.
4. **Original source quality must survive**: a compelling visual cannot create fake paper figures, claimed measurements, unsupported video inspection, or uncited results.

## New visual grammar

**Mode 1: Issue cover** is a first-class surface. When Contents opens, the current reader stage is hidden through the existing state attribute and the index expands into ordinary page scroll, not a 75vh nested scroll. The featured verified investigation uses a split-layout publication folio. The dark right half is labeled and decorative only; it conveys **no scientific data**.

**Mode 2: Multidisciplinary source atlas** consists of five keyboard-accessible buttons with actual inventory counts. Each bar expresses its own ratio to the highest source count, **not** a partition of 100%; stories can appear in more than one subject. Zero-count lenses are disabled, rather than implying something is available. Clicking a lens changes to the existing subject reader and restores page scroll to its beginning.

**Mode 3: Reading list** retains ranked, real article identities. The first item spans the directory, with a quieter hierarchy than the flagship research folio. Color indicators are source **realm** metadata already classified by the existing source contracts; no algorithmically invented facts.

**Mode 4: Focused reader** remains intact when Contents is closed. There is still one active DOM article and no additional image/media fetch during first paint.

## Aesthetic constraints

- Type hierarchy: distinctive short serif titles, 12–15px readable metadata, visible original links; avoid giant hero titles.
- Palette: warm paper for reading, deep forest ink for orientation, restrained discipline accents, never saturated decorative noise.
- Layout: true two-column editorial folio and atlas on wide screens; a compact stacked cover on 390px; two-column lenses at 320px.
- Interaction: minimum 44px touch targets, visible focus rings, disabled empty lenses, reduced-motion transitions, avoid horizontal page overflow.
- Evidence: no image search, no stock art, no fabricated charts; source figures stay behind the existing publisher rights and MIME/host gates.

## Production qualification

- [ ] Exact-head Next typecheck, lint, unit tests and bundle budget
- [ ] Responsive Chromium snapshots: **1440, 390, 320px**, index and focused article
- [ ] Browser proves index is a separate cover state, visible atlas has five real buttons, counts and labels, no overflow
- [ ] Browser proves an atlas lens actually navigates to the corresponding section, and the deep research entry reaches verified AgentSSL
- [ ] Source-only paper, media fallback, privacy and accessibility gates remain unchanged
- [ ] Human review of spacing, color contrast, typography and mobile scroll
- [ ] Draft preserved, no merge or deployment

## Next design system iteration (not a claim of implementation)

Build content-specific evidence stages rather than assigning every format the same editorial cards: research gets an original-figure or source-navigation plate, sport gets authentic scoreboard/timeline layouts, code gets repository architecture, nature gets real geo/photo observations, media gets source videos. Each specialized stage must have a truthful input contract and a format-specific browser test.
