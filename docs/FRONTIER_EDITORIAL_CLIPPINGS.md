# FRONTIER editorial clippings

Text-only signals are first-class visual objects in FRONTIER. They do not receive generated filler art, fake screenshots, decorative thumbnails, or reserved empty media space.

When a normalized `FrontierItem` has no renderable source-backed image or video, the card becomes an **editorial clipping**.

## Goals

- make text-only research, articles, posts, repositories, sports stories, game updates, music stories, and community discussions enjoyable to scan
- preserve the minimal graphite FRONTIER theme
- let typography create hierarchy instead of adding dashboard chrome
- keep every displayed quote, phrase, or excerpt grounded in the source-backed title or summary already present in the normalized item
- retain provenance, Save / Love / Open, Context, and behavioral-learning instrumentation
- keep Grid and List useful on desktop and mobile

## Source-grounded highlight contract

`lib/frontier/editorialClip.ts` derives a clipping from the normalized item.

Highlight selection follows this order:

1. a real quoted phrase already present in the source summary
2. a useful sentence from the source-backed summary
3. a phrase cut directly from the title when the summary is utility boilerplate or engagement metadata

The selector never invents a quotation or fact. Truncation may add an ellipsis, but the visible words remain a contiguous fragment of the existing title or summary.

Common utility summaries such as raw points/comments, generic discovery copy, or feed fallback text are intentionally rejected as magazine highlights.

## Editorial families

The clipping family is derived from lane and source type rather than random decoration.

### Research

OpenAlex, ML/data, AI, NeuroAI, methods, and broad-science signals use a restrained journal-like serif treatment.

### Builder

GitHub, builder signal, competitions, and creative-technology items use a precise mono-forward headline with a quiet technical-note treatment.

### Sport

Premier League, world soccer, favorite-team pulse, and active/broader sports use a tighter feature-headline rhythm with a serif field-note excerpt.

### Games

Gaming and Steam signals use a slightly chunkier feature face with a minimal vertical clipping rule.

### Music

Music signals use a spacious poster/editorial serif treatment and an italic listening note.

### Culture

Internet culture, life/outdoors, Reddit, and social signals use a literary magazine cut without scrapbook decoration.

### Dispatch

Everything else receives the neutral FRONTIER editorial treatment.

These variants stay intentionally close in color. The difference comes mainly from font stack, weight, spacing, line rhythm, and clipping-rule geometry so the feed still feels like one product.

## Grid and List behavior

### Grid

The clipping stacks source provenance, feature headline, source-backed excerpt, and a subtle `Read source` cue. The excerpt is line-clamped to keep mixed visual/text grids balanced.

### List

The clipping becomes a two-column editorial composition on wider screens: headline on one side and the source-backed pull line on the other. It collapses to one column on mobile.

The title and pull-line area links directly to the original content while the card still retains separate Save, Love, Open, Context, and feedback controls.

## Media failure behavior

If a supposedly real image/video fails at render time, the card drops that media key and naturally falls back to the editorial clipping treatment instead of leaving a blank rectangle.

GitHub owner avatars remain excluded from the content-media path because they are provenance decoration rather than imagery about the repository itself.

## Behavioral-learning boundary

Reading a clipping is instrumented identically to a media card:

- impression
- meaningful dwell
- context expansion
- source open
- save
- explicit positive/negative feedback

The visual fallback therefore does not create a second recommendation system or distort the learned preference model.

## Accessibility and performance

- clipping links have explicit source-oriented accessible labels
- visual quote marks are only used when a real quote was detected
- system font stacks avoid new font downloads
- no canvas, generated image, or heavy decorative asset is required
- mobile typography collapses predictably
- motion remains limited to the existing subtle hover transitions and respects reduced-motion settings
