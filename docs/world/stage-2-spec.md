# World Mode — stage 2: movement and performance reliability

Goal: make the existing four-landmark world more reliable and measurable without
expanding its content scope. Implementation completed; release qualification is separate.

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| NAV-01 | Sweep the entire movement segment against expanded trunk circles; a clear endpoint must not permit tunnelling. | Long-step regression crosses a trunk and stops on the entry side. |
| NAV-02 | Slide on oblique contact, stay inside map bounds, and stop safely in crowded corners with bounded work. | Oblique, boundary, and 100-step overlapping-trunk regression tests. |
| PERF-01 | Report active-frame FPS, p50/p95 frame times in milliseconds, sample count, DPR, draw calls, and triangles. Store only on canvas diagnostic attributes. | Pure sampler tests and production browser audit assertions. |
| PERF-02 | Reset partial sampling windows on resume; require two consecutive sub-40 FPS windows before reducing DPR by 0.25, floor 0.75. | Reset, recovery, sustained slowness, and floor tests. |
| RELEASE-01 | Preserve production browser evidence as CI artifacts and state merge criteria explicitly. | Existing CI artifact upload, enhanced world audit, checklist below. |

Movement assumes an unoccupied starting point: spawn and landmark travel use
clearings. It is collision avoidance, not pathfinding; a blocked click destination
may require another click or landmark travel. Four contact iterations bound work
per move. No new dependencies, analytics service, biomes, content, or asset pipeline.

## Verification and promotion

- Run `node --import tsx --test tests/world-navigation.test.ts tests/world-performance.test.ts`.
- Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
- Run the production `scripts/playtest-world.mjs` audit using the environment described
  in `README.md`; inspect screenshots and `report.json`, not only the process exit code.
- Require a passing production CI browser audit on the final PR revision before merge.
- Hardware qualification: record browser/version, device, viewport, DPR, and diagnostics
  after 15 seconds in each landmark; walk and orbit for 60 seconds. Target median frame
  time <=16.7ms desktop and <=33.4ms phone. Report p95 separately; investigate repeated
  >100ms stalls, input discomfort, unreadable panels, or thermal degradation.
- Physical phone and desktop GPU qualification remain pending; software-rendered
  headless measurements cannot qualify hardware targets. Keep the PR draft until done.

## Next decision after qualification

Use the measured slowest landmark and device to choose any further optimization.
Only add pathfinding if hands-on testing shows blocked click movement is confusing.
