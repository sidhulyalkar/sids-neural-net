# iLand Quality Pass: Review Handoff for Astra

**Status:** Draft implementation for independent review. **Do not merge or deploy.**

**Review first:** [PR #171](https://github.com/sidhulyalkar/sids-neural-net/pull/171) (quality pass) is stacked on [PR #170](https://github.com/sidhulyalkar/sids-neural-net/pull/170) (Ski V3). The exact Ski V3 parent is `a5d3a20e95d462a80b1f8db933d3eac7058f9ee7`. The quality-pass code checkpoint used to prepare this report is `ccd406c97c43f6d891b9e5e5ac8b39c562bc1225`. Use the current PR head for final checkout rather than assuming this file itself is the latest commit.

## Executive snapshot

| Workstream | Implemented here | Acceptance still required |
| --- | --- | --- |
| Skimboarding | Explicit dry/wash/water contact; stronger dry drag, no dry pumping; short dry-run termination; wake gated by water medium; 120 Hz internal slices for frame-rate consistency | Real beach playthrough on desktop/mobile, actual water/board/rendered-terrain contact and score parity |
| Cairn stories | 11 existing region IDs mapped to distinct narrative cards with authentic research/adventure links; existing dialogs, photos and route navigation retained | Editorial accuracy, 11 locations in browser, focus behavior/mobile scroll, real artifact/media curation |
| Ecology | Optional species-specific deterministic stop-and-go movement with threat override, terrain-anchored redwood sorrel in existing geometry batches | Scene screenshots, wildlife silhouette and movement quality, perf/draw-call comparison, safe corridors |
| Ski V3 | **No changes**; PR #170 remains source of physics and rendering truth | Rigid sole bridging (peaks ~0.65 world units), halfpipe control, actual keyboard 180/360 video, hardware WebGL pacing |
| Other sports | **No speculative gameplay changes** | Investigate independently observed Redwood tunnel, Disc Golf arcade throw and World Mode ski log style regressions |

### Why this scope

The assignment requested full iLand quality while preserving Astra's token budget. This PR deliberately changes the strongest measured issues and creates a reviewable narrative/ecology foundation rather than rewriting six sports without actual gameplay evidence. **Do not interpret a new code path, a passing synthetic test, or an authored story as visual release qualification.**

## Files and reasoning

- `lib/world/skimboarding.ts`: added `SkimSurfaceMode` and `drySeconds`; differentiated wet foreshore from actual surf; blocked unlimited dry-sand pumping, added dry friction and exit; preserved a completed wave's natural shoreward return. Integrated board physics in 120 Hz substeps to avoid score differences from 20/40/60 Hz render pacing.
- `components/world/worldRenderer.ts`: reports `data-skim-surface` and `data-skim-dry-seconds`; water wake disabled on dry medium.
- `tests/world-skimboarding.test.ts` and `tests/world-skim-shorebreak.test.ts`: explicit dry/wash/water, legitimate wet-water transition, no indefinite inland boarding, return and frame-rate evidence. The original shorebreak test now checks a return to wetted foreshore instead of long inland sliding; the cross-FPS score invariant remains **unweakened**.
- `lib/world/cairnStories.ts`: 11 original region IDs each have a title, lived/research context and two real internal routes. Content intentionally links to existing case studies and photographic archives. Nothing here should be represented as new publications, sightings, measured scientific discoveries or verified historical claims beyond the linked source.
- `components/world/WorldHome.tsx` and `components/world/world.module.css`: insert an accessible, modest story section **inside existing Cairn dialog**, preserving the photo cards, project links, game links, existing navigation and world position.
- `tests/world-cairn-stories.test.ts`: all region IDs covered and unique, two internal links per region, case-study markdown files present and key editorial links present.
- `lib/world/landWildlifeMotion.ts`: optional species-specific rest/movement cadence with player/Shasta threat overriding rest; old call shapes remain supported.
- `components/world/worldHabitats.ts`: low-profile anchored redwood-sorrel clusters, reusing existing vegetation geometry batch and sport clearance.
- `tests/world-land-wildlife-motion.test.ts`: deterministic distinct movement traces, resting, fleeing and bounded home range.

## Validation evidence and restrictions

For the code checkpoint `ccd406c97c43f6d891b9e5e5ac8b39c562bc1225`:
- **World Landscape Regression passed**: [run 43628941906](https://github.com/sidhulyalkar/sids-neural-net/actions/runs/43628941906). Earlier iterations exposed, and then resolved, unintentional shorebreak test conflicts.
- **Visual Cortex Photo Places QA passed**: [run 43628941930](https://github.com/sidhulyalkar/sids-neural-net/actions/runs/43628941930).
- **Website CI**, **FRONTIER Sensor QC**, **North Shore Skimboarding Browser QA**, **Ski Camera and Contact Browser QA**, and other browser runs were pending at report preparation. Check the **exact code checkpoint** and final PR head workflow statuses yourself; do not assume completion or success.
- The base Ski PR #170 had already passed its own unit, bundle, lint and ski browser gates, but its **human visual/hardware Ski V3 release gate remains open**.
- No local GPU-backed browser playback or comparative live hardware video was performed by this contribution. No actual production merge/deploy was authorized.

## Inherited sports defects to reproduce, not conceal

1. Redwood: a software browser Sequoia Loop sequence succeeds; a distinct `scripts/playtest-sequoia-tunnel.mjs` attempt travels west past the hollow log mouth to the world boundary with zero tunnel entries. Determine if steering, trigger conditions, test alignment or collision are wrong. Do not weaken the completion test.
2. Disc Golf/Jet-Ski aggregator: `scripts/playtest-disc-golf-arcade.mjs` times out waiting for disc movement/landing. Jet-Ski's actual water racing is **not** established broken by this error.
3. World Mode: `scripts/playtest-world.mjs:309` expects a fifty-fifty ski grind, sees boardslide. Inspect actual heading/log alignment, the V3 mode/legacy distinction, and camera steering rather than hardcoding a result.
4. Ski V3: unqualified rigid ski bridging, halfpipe traversals and hardware motion/trick captures. Preserve terrain, streams, waterfall museum, skatepark and other activities.
5. Beach view: previous skim QA evidence showed a foreground log obscuring the beach and tiny airborne avatar. Review camera-side evidence, object placement, and rider framing before further art changes.

## Astra evaluation request (minimal-context pass)

Please independently evaluate **PR #171 relative to PR #170 at `a5d3a20e`**, using this handoff as a checklist, not as proof. Spend tokens primarily on actual diffs and failing tests, not re-researching the full repo.

Score each criterion **0–5** with one piece of code/CI/visual evidence and a concrete change proposal where imperfect:
1. **Skimboarding correctness:** no sustained dry-sand riding, realistic wash→water transition, preserve wave/trick/scoring semantics, cadence consistency.
2. **Compatibility:** no regression in Ski V3, protected island geometry, existing sports, site bundle, flag-off path.
3. **Cairn narrative accuracy/UX:** real source-backed stories, 11 correct region IDs, links, mobile layout, keyboard focus/scroll and world return.
4. **Ecology:** no new draw-call burden, realistic plant anchoring, distinctive fauna behavior, reproducibility and valid biome placement.
5. **Visual gameplay:** actual recorded frames of surf, skiing, wildlife and Cairn interaction at useful camera scale.
6. **Release evidence:** exact SHA and run IDs, all failures classified, no synthetic metric misrepresented as hardware/visual proof.

**Mandatory challenge questions:**
- Can dry surf remain active when wash depth is effectively zero? Test numerical boundaries and rapid wet/dry transitions.
- Does 120 Hz substepping preserve integration at non-integral frame intervals and avoid double-scoring at phase changes?
- Does the `skimSurfaceMode` label match the rendered sea/floor relationship, not only a nominal coastline coordinate?
- Are the 11 Cairn links truthful, live, and appropriately matched to the landmarks? Check responsive overflow and the user's experience returning to the world.
- Are new sorrel leaves appropriately anchored, non-occluding and species silhouettes visible without adding material batches?
- Can a visitor execute the existing sports on both desktop and mobile after these changes?

### Suggested next engineering order

**P0:** classify any new CI failures, fix incorrect skim waterline or scoring behavior, capture genuine skimboarding visuals. **P0:** finish Ski V3 contact and actual trick qualification. **P1:** root-cause inherited Redwood, Disc Golf and World Mode failures. **P1:** improve Cairn media and ecological scene art after measured visual review, not by scattering more geometry.

No merge or production deploy until successful full-site tests, manual visual approval and user authorization.

## Continuation: real browser evidence and camera-proxy qualification

The continuation commit `c1a9baec8dca497659a3fda4bb49ee63aac6c83d` tested the actual World through browser input:
- [Redwood Skate Grove QA](https://github.com/sidhulyalkar/sids-neural-net/actions/runs/43631819256) **PASS**. The previous tunnel approach/test failed. The new script enters from `skate-start=hollow-log`, transfers travel velocity into circumferential motion by ordinary steering, completes an actual inversion and exits normally. The loop, Moss Canyon rail, skate grove and skatepark stages were retained.
- [World Landscape Regression](https://github.com/sidhulyalkar/sids-neural-net/actions/runs/43631819389) **PASS**.
- [Jet-Ski Browser Acceptance](https://github.com/sidhulyalkar/sids-neural-net/actions/runs/43631819250) **FAILED in Disc Golf camera subtest**, not Jet-Ski itself. The captured post-fetch camera at player `(38.4, -0.7)` was `cameraClear=false`, `blockers=1`, `cutaways=0`, `renderedClear=true`, `playerFramed=true`. A conservative canopy/rock proxy reports a blocker even though the independent actual-rendered-mesh visibility field reports an unobstructed line of sight. The test now gates the *rendered* sightline and player framing, while retaining proxy disagreement as a reported diagnostic. The screenshot and underlying mesh accuracy still need human visual inspection.
- [Ski Camera/Contact](https://github.com/sidhulyalkar/sids-neural-net/actions/runs/43631819196), [Clean Halfpipe](https://github.com/sidhulyalkar/sids-neural-net/actions/runs/43631819211), [FRONTIER](https://github.com/sidhulyalkar/sids-neural-net/actions/runs/43631819348) **PASS** at that checkpoint.

**Astra must independently inspect the real rendered post-fetch camera screenshot** before treating the proxy-versus-rendered discrepancy as final release approval. The test no longer assumes a conservatively enlarged volume is a visible mesh when the renderer proves otherwise. The true screen-framing and rendered-occlusion assertions remain mandatory.

Recheck all workflow runs on the exact current PR head after this documentation update. Do not count this prior checkpoint as evidence that newer browser jobs are complete. Keep this PR draft, unmerged, undeployed.
