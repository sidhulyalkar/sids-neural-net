# World Mode validation

Validated on 2026-10-03 against the production Next.js build.

## Automated checks

- Production build: PASS, 107 static pages generated.
- TypeScript: PASS.
- Full repository ESLint (`--max-warnings=0`): PASS.
- Full unit-test runner: PASS, 625 tests across 116 test files; all four new world tests also run directly.
- Existing JavaScript budget: PASS. 24 analyzed client chunks, approximately 1.42 MB raw /
  0.52 MB compressed total. Largest raw chunk approximately 229 KB, below the unchanged
  500 KB limit. The first implementation's approximately 715 KB Three.js chunk failed;
  importing source modules and splitting the rendering backend removed that failure.

## Production-browser audit

`scripts/playtest-world.mjs` covers:

- WASD movement changes the explorer position.
- All four jumps land within interaction range; discovery cards open and close.
- All six featured project destinations return HTTP 200.
- All three photographic memories decode successfully.
- Menu focus cycles within the panel; Escape closes it.
- A real `WEBGL_lose_context` event preserves conventional navigation.
- Reduced-motion visitors receive the static landing view without a WebGL canvas.
- At 390 × 844, mobile starts without WebGL, opts into an actually rendered scene,
  supports touch walking, and has no horizontal overflow.
- Visitors without JavaScript receive visible navigation.
- `/atlas` still renders its eight-destination neural surface.
- No JavaScript page errors are observed.

The scene sample at the coast reports 37 draw calls and 48,060 triangles, below the
100-call target. Other views vary with frustum culling. These are renderer counters,
not estimates based on the number of objects in source code.

## Limits and promotion gate

Chromium here renders WebGL using SwiftShader, a CPU implementation. Observed software
frame rates are approximately 4–16 FPS depending on viewport and concurrent work.
**This does not qualify the 60 FPS desktop / 30 FPS mobile target.** Adaptive DPR reaches
0.75 in this environment. No claim of smooth hardware performance is made.

Before merging a change that replaces the default homepage:

1. Run a 60-second exploration on hardware-accelerated desktop Chrome/Firefox and on
   a physical phone. Check p95 frame time and whether movement/camera feel comfortable.
2. Visit all four regions, orbit near the large sequoias, and check trunk occlusion.
3. Inspect cold-load transfer, interaction latency, and the static fallback at 200% zoom.
4. Review the four-region visual composition with Sid. The landscape is a deliberately
   simple procedural first version; it does not claim photorealism or reconstruction.

Deferred from this version: vehicles, controller support, audio, live GitHub world growth,
private Frontier personalization, photogrammetric camera/photo alignment, and new biomes.
The existing game, research, photography, and Frontier pages remain the destination experiences.

## Final verification environment limitation

The fully completed browser report above was collected before the final renderer
module split. That split subsequently passed TypeScript, the production build, lint,
and the unchanged bundle budget. A final browser rerun was attempted after the session
reset, but Chromium could not create its process-singleton IPC socket (`EPERM`).
The current approval policy rejects the required process escalation. Re-run the
committed browser audit on the branch in CI or a local environment before promotion.

## Stage two

Swept trunk collision and active-frame diagnostics are implemented as specified in
[stage-2-spec.md](stage-2-spec.md). Ten focused tests cover content, movement,
percentiles, pause/reset, quality hysteresis, and the DPR floor. The production
browser audit now requires valid timing diagnostics as well as the original flows.

Publication is authorized by Sid's follow-up request. Shell push has no GitHub
credentials; publication uses the connected GitHub account. This remains a draft
until the final production browser and hardware qualification gates pass.
