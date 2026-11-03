# FRONTIER Signal Trail

The original large radial interest orb has been replaced by a compact constellation
of **ten connected points**. The score means *how interesting the article is
to this reader*, never factual importance, scientific quality, or how long the
reader held a button.

## Interaction

- **Mouse / touch**: tap a point or drag across the trail, release to commit
  one integer score from 1 through 10. No minimum dwell duration.
- **Keyboard**: focus the native range, use arrow keys or Home/End to select,
  release the key to commit. Its native semantics are preserved.
- **Assistive technology**: descriptive label, value text, instructions,
  visible keyboard focus and a separate live save announcement. Blurring the
  control commits a changed score even if the input device does not generate
  conventional pointer/key-up events.
- **Reduced motion**: no animation is required to use or understand the score;
  CSS transitions are disabled when requested.
- **History**: existing `rateInterest(..., 'slider')` persists the exact score
  and canonical coarse preference; revisions replace a vote rather than
  awarding another reaction or XP.

The SVG star trail is decorative. **One native range input** owns all input,
with 44+ CSS-pixel touch height. The ten nodes and their connecting line
illuminate as a minimal visual confirmation. No canvas, WebGL, new media
request, particles library, or additional background task is introduced.

## Editorial layout

- Preserve one mounted article and at most one genuine source image.
- Keep wide desktop images adjacent to source explanations when useful,
  rather than forcing every article into an unusually tall vertical scroll.
- Keep text-only stories text-first; scores and standings take precedence
  over art in structured sports stories.
- Avoid floating mobile controls over reading text.
- Remove the separate orb and precision popup, strong salmon summary
  decoration, and heavy borders around the primary image. Maintain publisher
  provenance, original-link actions, saving and secondary evidence.

## Validation

```sh
npm test
npm run typecheck
npm run lint
node scripts/frontier-focus-reader-audit.cjs
```

The focus reader browser audit now covers single-control rendering, pointer
tap, exact keyboard 9/10 and 2/10, persistence across reload, replacing
ratings without awarding extra preference events/XP, no mobile horizontal
overflow, readable source images, and accessible native range semantics.

This UX-only PR stacks on #147 (and its #143 through #145 dependencies).
Editorial benchmark and independent source review remain separate release
gates. Do not treat a beautiful interaction as evidence of improved ranking
quality without user evaluation.
