# Ski V5-W0: On-demand winter environment (experimental draft)

**Status:** W0 implementation slice. This branch is stacked on experimental Ski V4 PR #186; **do not merge or deploy**. It does not qualify Ski V5 ski-contact physics or solve the current halfpipe failure.

## Goal

The ordinary iLand should not allocate high-resolution snow geometry, a snow shader, snowfall GPU buffers, or a snow-contact triangle index. Selecting Skiing creates a winter terrain variant and enables a bounded weather transition. Returning to another activity releases those resources after an explicit safe-to-exit check.

## Implementation in this slice

- `lib/world/ski/winterState.ts` owns an independently tested, pure arrival/departure state machine. In-flight skiing exits hold the snowy terrain until grounded.
- `components/world/worldRenderer.ts` keeps the ordinary island geometry immutable. Only the Ski activity clones/refines the mountain surface. Swapping the ground mesh's geometry and material is atomic; there is never a parallel snow overlay z-fighting the ordinary ground. Legacy, V3, and opt-in V4 ski contact all index the same winter geometry. After returning to normal, contact index, track ribbons, refined geometry and material are released.
- `components/world/worldMountainHalfpipe.ts` preserves the original vertex pigment through refinement in the additional `baseColor` attribute. `worldSnowpackSurface.ts` mixes base and snow pigment in the vertex shader through a shared uniform, with roughness matching the snow state. This affects appearance only: snow geometry and ski physics remain authoritative and stable during the fade.
- `components/world/worldSnowfall.ts` is dynamically imported only on first Skiing selection. Camera-local particles have bounded fixed buffers, seeded trajectories, alpha-softened flakes, mobile/desktop capacity tiers, and explicit disposal.
- A lighter cooler sky and winter sun blend with the same visual transition. Snowfall is suppressed inside caves, the photo gallery and water. Weather opacity does not grant physical ski contact.
- Canvas datasets record winter phase, blend, geometry presence, snow particle count and refined-triangle count for exact-browser evidence.

## Explicit limitations and follow-up priorities

1. **Ordinary geometry is unrefined, not restored to pre-halfpipe geology yet.** The upstream `terrainHeight()` in `lib/world/model.ts` still includes the V4 mountain halfpipe and summit edit for every mode. V5-W1 must author a genuinely separate pre-ski mountain shape, preserving protected caves, hydrology and geography, and switch both the ordinary collision provider and rendered mesh consistently. Do not relabel the current W0 as a complete mountain redesign.
2. Current terrain refinement is **synchronous on the first Ski selection**. It is deferred out of page startup but may cause a noticeable hitch. Measure on physical mobile hardware and split preparation into idle/chunked jobs or a worker without stale activation.
3. Snowfall represents falling flakes, **not time-evolving snowpack accumulation**. Ski-contact snow depth is still statically authored by the existing V4 snowpack sampler; later add bounded deformation tiles/compaction.
4. The V4 core and base world modules are still statically imported. GPU/geometry allocation is gated; full code-splitting awaits V5-W2. `worldSnowfall.ts` is the first dynamically imported component.
5. The original Ski V4 physics has **0/24 qualified bank-to-bank trials** and severe old halfpipe curvature constraints. Winter presentation does not qualify carving, braking, landings, or physical-device performance.
6. While fading winter out, the refined winter surface remains installed until the fade finishes. Input-state changes while airborne defer restoration; further integration tests should cover player transfer at shared-geometry boundaries and flight continuity.

## Verification plan

- `npm run typecheck`, `npm test`, `npm run build`; record exact SHA and failures.
- New `world-ski-winter-state.test.ts`: baseline, finite arrival, rapid mode changes, midair hold, full return and invalid dt.
- New `world-ski-winter-terrain.test.ts`: untouched base mesh and full-color/coverage attribute alignment after winter refinement.
- Browser: load `/world` (winterTerrain=none, mountainHalfpipeTriangles=0), select Ski (winterTerrain=active, particles appear, blend increases), leave Ski after stopping (returns to no winter resources), rapid toggle, paused/browser-hidden state, underwater and gallery suppression, V4 opt-in exact-input telemetry.
- Check mobile GPU p50/p95/p99 and first-time Ski selection hitch. Test ordinary/skate/bike/Jet-Ski/gallery after the transition.
- Do not merge before release matrix and genuine five traversals in the redesigned skiable channel.

## Proposed V5-W1: geometry authority

Keep protected-world base surfaces untouched. Generate winter topography from an authored skiing-region patch whose perimeter matches the ordinary ground exactly. Remove the always-active `mountainFaceEditDelta` from shared base `terrainHeight()` only after replacing its callers with an explicit surface authority. New ski contact and all visual ground/cave/nav physics must share the exact selected indexed triangle mesh. Validate both modes and every protected anchor before allowing arbitrary seasonal geometry changes.
