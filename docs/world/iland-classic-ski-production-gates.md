# iLand classic-ski production candidate (22 November 2026)

> Review only. **DO NOT MERGE OR DEPLOY** until the exact-head checks, visual QA, and integration reconciliation below are complete.

## Product decision

Stop extending Ski V3/V4/V5, full edge/snow physics, five-crossing halfpipe telemetry, player-executed 180/360 trick scoring, and winter terrain experiments for this release. Those research branches remain historical experiments, **not** production dependencies. Do not delete or revert unrelated island systems.

Restore the compact, pre-halfpipe ski experience:
- Terrain height remains the original Granite Ridge heightfield, including later safe South Shore land/water integration, with no halfpipe carve, summit boost or special tessellation.
- Ski starts at the original high shoulder at (8,-54), retains responsive arcade WASD, original timber ramps, ordinary hops and snowfall.
- **Ski Jump remains a distinct menu-authorized activity**, not an automatic normal-ski trigger.
- NEXT_PUBLIC_SKI_V3, snow-carving experiment flags and ski-view query arguments cannot activate the dormant V3 solver or halfpipe in this candidate.
- Non-ski systems continue to share their existing world, collision, camera, input and render authorities.

## Preserved integration lineage

Candidate derives from draft #195, which includes draft #192, #191, #189, #188, #187, #185 and the master-based #183 iLand port. The selective rollback preserves their unrelated implementation: southern shore + Eagle Ray passage, mobile MOVE/LOOK controls, arcade cavern and original mural fallback, snorkeling, Shasta, bike/skate/jet ski, 49-photo native-aspect gallery, image streaming, focus/HD transitions, E exit from any gallery room and exact pre-entry underwater return.

This does **not** assert all independently developed features have been reconciled. PR #174/#181 have additional north-shore camera occlusion, Cairn presentation, bike-camera, skim and touch QA that still need explicit file-by-file comparison. Do not merge their divergent renderer wholesale. Generated optional WebP mural textures remain disabled until all six valid assets are committed and visually inspected.

## Disc-golf steering contract

- The next **mandatory gate** is the target until cleared. Only then is the basket the objective.
- Both avatar stance and release velocity use `discGolfAimedHeading(lie,target,basket,aimOffset)`; horizontal yaw is `atan2(x,z)` and HUD aim is clamped to +/-55 degrees.
- Player-visible rotation updates during aiming, including after Shasta fetch handoff. The avatar remains stationary at the previous lie while Shasta retrieves the disc and relocates only after the presentation finishes.
- Timing accuracy remains a release-time deviation; don't artificially rotate the pre-throw stance to a future timing error.
- Tests compare normalized launched velocity to avatar aim on all nine holes, all mandatory-gate stages and multiple positive/negative aim offsets, plus fallback and clamping.
- Runtime evidence: `data-disc-golf-facing-dot` and `data-disc-golf-aim-offset`.

## Release gates, all on a single exact candidate SHA

| Gate | Required proof | Initial status |
| --- | --- | --- |
| Build and dependencies | `npm ci`, typecheck, lint, unit tests, production build, bundle budget, advisories | PENDING |
| Classic ski | Desktop/mobile browser entry, natural move/hop, original uncarved ridge, 0 halfpipe triangles, 0 V3 runtime; both stale environment flag settings | PENDING |
| Ski Jump | Only explicit menu entry arms scored Big Air, proper exit/re-entry and mode switch | PENDING |
| Disc golf | Nine-hole browser test, all tee/gate/basket directions, aim slider vs actual heading, power/flight, collision, score, camera and Shasta fetch | PENDING |
| Marine | Surface/dive, South Shore land-to-sea route, east/west/north/south habitats, depth, kelp, coral, ray passage, swimming touch | PENDING |
| Galleries and arcade | Photo orientation, native HD streaming, modal, E exit/pose restore, paper museum, 3 arcade games, art fallback and deep links | PENDING |
| Other sports and Shasta | Bike, Redwood skate, skim, Jet Ski dock/race, Joshua race, mountain Big Air, Shasta animation, controls on game exit | PENDING |
| Site parity | Existing production home, FRONTIER, photography, game network and other routes unaffected | PENDING |
| Accessibility / performance | Desktop/mobile keyboard+touch, focus, reduced motion, actual hardware GPU frame p50/p95/p99, memory, screenshot review | PENDING |
| Integration reconciliation | Audit and selectively port relevant non-ski #174/#181 differences without clobbering #195 | OPEN |
| Preview / deploy | Exact-SHA staging preview READY, user inspection, rollback plan, explicit promotion approval | PENDING |

**Pass criterion:** no unreviewed failures, no automatic Ski Jump, no loss of gallery/underwater state, no wrong-facing disc-golf avatar, no silent missing assets, no stale CI assertions demanding the retired halfpipe. No merge/deployment when a gate remains unverified.

## CI adaptation

Replace historical V3 trick and halfpipe browser jobs with `scripts/playtest-classic-ski.mjs`, under `NEXT_PUBLIC_SKI_V3=0` and `=1` to prove the stale flag is harmless. Independently run the nine-hole `scripts/playtest-disc-golf.mjs` under the classic setting. Retain the entire build/unit matrix plus cross-feature gallery, mobile swimming, South Shore, arcade, FRONTIER and site CI.

## Later, only if usage justifies it

Keep physically rigorous snow and freestyle carving in separate historical experiment branches. Consider only lightweight visual ski polish when it contributes materially to the overall island experience. Focus production engineering effort on world navigation, accessibility, stable camera, disc golf, marine discovery, galleries and smooth first paint.
