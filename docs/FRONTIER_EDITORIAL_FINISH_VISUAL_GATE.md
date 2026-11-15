# FRONTIER V3.1 · Editorial finish and visual approval

**Candidate:** stacked on [draft PR #169](https://github.com/sidhulyalkar/sids-neural-net/pull/169), not on production `master`.
**Status:** implementation candidate, subject to exact-head CI and independent screenshot review. Do not merge or deploy from this document.

## Intent

The interface should feel like an excellent independent journal that turns into a source-specific instrument when evidence is available. Typography, authentic figures, source identity, and generous reading rhythm lead; controls should look precise and quiet. A story with no accessible source image must remain visually complete without a synthetic placeholder.

The first paint stays as the fast source-grounded cold snapshot. Keep all previously implemented subject tabs, source provenance, content ranking, ratings, media opt-in, and deep source routes. Avoid adding a font service, Lottie/canvas/WebGL, image requests, synthetic metrics or figures.

## Visual hierarchy

1. **Issue identity:** compact FR⟂ONTIER masthead, six responsive subject shelves, a small edition/realm line. A section changes the atmosphere, not the provenance.
2. **Story proposition:** one headline, `28–42px` depending on viewport, with a restrained source/discipline kicker and author byline where available.
3. **Reading path:** numbered authentic sections, no forced narrative steps and no scroll-jacking.
4. **Evidence lead:** an actual original figure, official score, reported measurement, technical artifact or real video poster receives visual emphasis only when available. Text-only sources remain intentionally typographic.
5. **Source identity and continuation:** a compact independent side reference column, sticky only in sufficiently large desktop viewports, otherwise normal document flow.
6. **Deliberate actions:** open original, save, interest input, section navigation and page-turn arrows remain straightforward and keyboard accessible.

## Presentation grammar

| Format | Primary visual priority | Forbidden ornament |
| --- | --- | --- |
| Paper / text-only | Scholarly title, source-authored lead, citations, restrained white space | Fake paper cover, AI-generated brain diagram |
| Paper with licensed figure | Contained authentic image, real caption, figure source and credit | Crop that changes meaning, caption removed for style |
| Engineering / repository | Source identity in code-aware type, genuine artifacts and release references | Imaginary architecture chart, popularity count as benchmark |
| Sports | Official status and score displayed as an editorial match report | Fabricated trajectories or projected match events |
| Measured report | Source-reported labels and values, no unsupported axes | Unjustified comparable charts across incompatible units |
| Motion / original video | Cinematic native poster or deliberate video playback | Auto-playing remote media, speculative chapter timestamps |
| Nature | Original observation imagery and caption, quiet field-note character | Unsupported species labels or artificial field map |
| Entertainment | Publisher identity and authentic cover/trailer when available | Stock fan art treated as official media |

Realm palette is secondary to the source's evidence grammar. Research, neural, behavior, engineering, nature, sports/motion and culture maintain reversible, muted visual contexts.

## Approval frames

For **each source grammar** available in the pinned fixture edition, capture full-page screenshots at:

- 1440 × 900 desktop: headline rhythm, stable 2-column article, source rail alignment and credibility of the hero
- 390 × 844 mobile: legible hierarchy, correct article/source order, generous interaction targets and safe navigation placement
- 320 × 700 compact mobile: no content clipping or horizontal page scroll; long repository names, titles, and media captions must wrap

Also inspect an intentionally text-only source, a failed figure, a source video before activation, an empty subject shelf and the contents overlay. Compare against draft PR #169 baseline screenshots, not only against aesthetic intuition.

## Must-pass release checks

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run check:bundle`
- Browser focus-reader audit at 1440/390/320, including screenshot artifacts and no page errors
- Headline bounded to 28–42px on these viewports; source summary line-height at least 1.5; chapter, shelf and page-turn hit areas at least 44px
- No synthetic figures, no extra cold-load media/JS, no loss of source credit, no JavaScript or page-wide horizontal overflow
- Actual screenshots reviewed manually for visual hierarchy, whitespace, authentic source content, contrast, readability, and distinctiveness across research, engineering, motion and culture
- Both reduced-motion and keyboard paths retain clear focus indication and functional navigation

**Release policy:** exact-head CI and human screenshot approval are required. A code commit and CSS assertions alone do not establish visual perfection or production readiness.

## Next design iteration (separate from the shell)

Use the source-gated story pipeline in draft PRs #172 → #173 → #175 → #177 → #178 → #179 to make **one real research source** into a reviewed flagship investigation. Only show approved publisher material, with original anchor, version and rights. Build the equivalent immersive experience for a real source-backed sports or behavior dataset **after** acquiring actual time-aligned evidence. Do not turn the shell into a synthetic visualization machine.
