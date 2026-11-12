# Ski V3: Astra start here (minimal-context handoff)

**Status:** evidence-only draft branch, not production. **Do not merge.**
**Implementation base:** [PR #156](https://github.com/sidhulyalkar/sids-neural-net/pull/156), head `849ded7e7114555d1ba781d242f7ce7be095d5f2`. Verify latest head and CI before editing.
**Recording:** `docs/world/evidence/ski-v3-20261112/halfpipe-2026-11-12-review.mp4` (28.17 s, 1280×838, 24 fps). **Binary upload required separately; not in this docs-only commit.** The source video build SHA is **unknown**; never assume it is PR #156.
**Architecture:** [PR #154 V2 spec](https://github.com/sidhulyalkar/sids-neural-net/blob/3cfba692ae06c74a4a82425de5cca074f56f99af/docs/world/ski-dynamics-v2-astra-implementation-spec.md); [PR #156 contact/camera notes](https://github.com/sidhulyalkar/sids-neural-net/blob/849ded7e7114555d1ba781d242f7ce7be095d5f2/docs/world/ski-camera-contact.md).

## What to inspect, in order
1. Watch the 28-second clip and identify reproducible timecodes. Sample `1.25, 3.40, 6.10, 7.30, 13.30, 19.30, 20.50, 24.80` seconds. These are **inspection anchors**, not a claimed root-cause mapping.
2. `lib/world/activities.ts`: halfpipe-dependent steering and scalar-speed movement.
3. `components/world/worldSkiContact.ts`: independent rigid-ski surface fitting; quantify **max and mean** sole clearance, not just minimum. Test the full ski length across lips and walls.
4. `components/world/worldRenderer.ts`: chase camera, ski/input state, per-frame allocations, jump and landing logic.
5. `lib/world/rideBoost.ts` + `components/world/worldRideChallengeGeometry.ts`: remove **ski-only** rings, raycasts, shooting input, reticle, HUD and boost behavior. Preserve bike/skate, Disc Golf.
6. `scripts/playtest-ski-presentation.mjs`: existing hop waits for speed <0.2. Add moving takeoffs, real lip exits, controlled rotations, rough landings and recovery.
7. `lib/world/mountainHalfpipe.ts` and `components/world/worldMountainHalfpipe.ts`: surface continuity and no protected landscape edits.

## Implementation sequence, with review gates
- **V3-0**: isolate/remove ski shooting; measurable effect counts and regression checks.
- **V3-1**: fixed-timestep ski velocity + carve/slip solver (OFF-by-default flag).
- **V3-2**: stable independent ski contacts; maximum gap/penetration tests; avatar stance.
- **V3-3**: chase/broadcast camera with obstruction and landing visibility.
- **V3-4**: airborne spin/flip/grab controls, heading/normal-based landing assessment, stumble/crash/get-up.
- **V3-5**: two curved fading ski tracks, spray and **transient local** snow compression; no permanent terrain edits.
- **V3-6**: repeated real-browser runs, touch/controller, camera snapshots and performance/regression evidence.

**Acceptance demos:** continuous wall-to-wall carve; clean moving 360 landing; deliberate failed landing + recovery. No phantom/suspended skis, unrequested Big Air, ski target rings, camera clips or world regressions.

**Non-regression boundary:** waterfalls/streams, museum/hidden galleries, arcade/cave roof, reef/Moss Canyon, Shasta, bikes, skates, Jet-Ski, Disc Golf. Do not modify global mountain scale or revive rejected terrain-park PR #152. Do not merge with failed production/whole-site gates.

**Efficiency:** Read this document, the 28-second clip, and only the files referenced above. Read deeper V2/V3 specs only for the stage you are implementing. Deliver one small PR at a time, with tested commit SHA, before/after screenshot, measured performance and explicitly listed remaining failures.
