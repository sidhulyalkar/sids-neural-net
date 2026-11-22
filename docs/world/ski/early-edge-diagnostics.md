# Ski V3-2: edge-turn timing comparison (development-only)

**Parent:** [V3-1 PR #160](https://github.com/sidhulyalkar/sids-neural-net/pull/160), head `f6e91832c506e9718289f2fdb6f40a9b143b6edb`. No new mountain geometry or island runtime behavior is introduced.

The original V3-1 controller steers toward a bank until the exact bank-visit event, then changes the heading target. Its measured result was 1 of 6 required visits, 0 of 5 traversals, leaving the pipe at tick 830. The diagnostic code in `app/dev/ski-lab/earlyEdge.ts` preserves this timing as lead=0 and tests early edge steering at 0.5, 1.0, 1.5, 2.0, 2.5 and 3.0 world units ahead of the *same* bank threshold.

## Invariants

- Identical `createTrial()` initial position, velocity, tuning constants, slope, bank threshold, permitted halfpipe footprint and 30-second maximum.
- Controller changes *only* ordinary steering input, never skier position, velocity, terrain or contact.
- Early steering can happen only when the skier is grounded, moving toward the requested bank, and within the prescribed lead distance. A reversal does not count as a visit.
- Each successful visit must still cross the existing horizontal threshold while grounded; visits must alternate left/right.
- Zero-lead reproduces the original controller for regression. The first bank in the original trace occurred at tick ~706; exit near tick 830.
- Neither timing variants nor a successful physics-only crossing count establish visual clearance, camera or mobile performance.

## Run

```bash
node --import tsx --test tests/world-ski-early-edge.test.ts
node --import tsx scripts/ski-early-edge-sweep.ts
npm run dev
# Open /dev/ski-lab?five-carve
# Compare /dev/ski-lab?five-carve&early-lead=1.5
```

The sweep writes per-tick CSV, serialized input traces, and `summary.json` in `artifacts/ski-early-edge/`. CI uploads evidence against the exact tested head SHA. Note the first outbound steering reversal tick, bank visits, max physical step, signed lateral slip, speed and exit. Report measured values from artifacts; do not substitute a projected improvement.

## Interpretation

- If a lead value raises visits or reverses lateral velocity earlier, the previous failure includes **late steering**.
- If the skier still exits or turns without significant lateral acceleration, investigate **turn authority, grip and pressure**, not just input timing.
- If the skier leaves the bank threshold unmet or a turn triggers too early, the lead is overly aggressive. Do not count inputs as bank traversals.
- If a run reaches all six visits, gate still stays **unqualified** until sole contact is corrected and a hardware-backed browser capture proves visibility and frame pacing.

Next independent step: solve the 0.87-unit rigid-ski bridging gap with controlled flexible contact, keeping the existing rigid fit as a comparison and preserving the island rig.
