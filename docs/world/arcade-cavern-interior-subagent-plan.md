# Arcade Cavern Graffiti V1: Subagent Execution Plan

Status: ready for task dispatch, NOT a claim that parallel agents have started. Canonical visual/engineering contract: docs/world/arcade-cavern-interior-v1-build-spec.md. Target integration branch: feat/sequoia-tunnel-skate-loop, draft PR #101.

## Objectives

Ship a bespoke lantern-lit fandom mural room that preserves the underground gameplay and fits the low-poly island. Organize isolated artwork content, procedural geometry, ambience, and quality assurance as independent owned surfaces of work. Keep a SINGLE INTEGRATOR for components/world/worldRenderer.ts, which is already a large, high-conflict file.

The current known global website CI failure is in the longer World/Arcade Cavern navigation audit, even when focused Arcade Cavern and World unit checks pass. Do not call the feature complete or merge it until that is resolved and screenshots are visually reviewed.

## Parallelization DAG

    S0 Surface API + baseline snapshot (must finish first)
       |----------------+----------------+---------------+-----------------+----------------|
       v                v                v               v                 v                v
    S1 Sports        S2 Anime        S3 Comedy/Hero    S4 Art Renderer    S5 Atmosphere     S6 QA Harness
       |                |                |               |                 |                |
       +----------------+----------------+---------------+-----------------+----------------+
                                            |
                                            v
                               S7 Sole Integrator and Release
                                            |
                                     art direction review
                                            |
                                complete cross-world CI -> ready

S0 must publish its stable TypeScript interfaces and transformation conventions before S1-S6 begin. S4 can start immediately from S0's fixtures and should not wait for S1-S3 to write artwork. S6 captures a baseline before murals land. S7 alone imports all artifacts into World renderer after each owned PR is ready.

## Subagent assignments and exact file ownership

### S0: Shell sampler and immutable manifest contract (critical path)

Owned files:
- lib/world/arcadeCavernArtTypes.ts (new)
- lib/world/arcadeCavernSurface.ts (new)
- lib/world/arcadeCavernArtManifest.ts (new, import-friendly registry)
- tests/world-arcade-cavern-surfaces.test.ts (new)

Deliver:
- ArtSurface/ArtAnchor/CavernArtMotif types and palette constants.
- Pure mapping from longitudinal z and normalized wall/roof/floor coordinates to a world position, correct inward normal and tangent frame, based on the exact cave ring geometry.
- A manifest validation API that accepts independent theme arrays, enforces unique IDs and rejects invalid placement near baffle, hitboxes and protected route.
- Stable representative fixtures at z=-80,-74.5,-70,-67,-63.4. Include clear semantics for left/right normals, front-of-rock offset and floor-layer support.
- A frozen contract note with sample valid descriptors. Do not require theme files to exist just to typecheck this task.

Do NOT edit worldRenderer.ts, game discovery, caveObstacles or navigation code. Gate: tests prove normals and surface height match cave rings, no invalid/NaN coordinates, no mural in safe-route envelope.

### S1: Sports mural author

Owned files:
- lib/world/arcadeMuralsSports.ts (new)
- tests/world-arcade-murals-sports.test.ts (new)

Deliver: one coherent mural on the LEFT inner corridor after the baffle, approx z -73.4 to -68.1. Chelsea royal-blue lion-inspired negative silhouette/football motion, Patriots navy-red kinetic star stripes, Warriors golden court/bridge arc; shared white spray and amber edge grime. No official logo dependencies, flat rectangular cover art, mesh code or unique lighting code. Descriptor groups use the S0 contract only.

Acceptance: one readable hero line at 6-9 m, three identifiable named fandom beats at close range; <=30% of wall area painted in this region; safe to compose behind no game panel. Typed descriptors and independent tests.

### S2: Anime mural author

Owned files:
- lib/world/arcadeMuralsAnime.ts (new)
- tests/world-arcade-murals-anime.test.ts (new)

Deliver: dark/fantasy primary mural on RIGHT inner corridor z -72.8 to -68.0. Select Frieren, Solo Leveling, Vinland Saga, Fullmetal Alchemist: Brotherhood and a handful of secondary tags from the user's screenshot (e.g. Hell's Paradise, Demon Slayer, Haikyuu!!, Blue Lock, Spy x Family). Compose magical concentric linework, aged voyage/sword etchings, abstract shadow crown and alchemical geometry with original hand-painted shapes. Do not create a separate poster for each franchise.

Acceptance: one primary composition, 2-4 medium motifs and sparse micro-tags. Ensure each descriptor has a distinct ID, bounded ink brightness and no game-niche occlusion.

### S3: Animation-comedy, title and identity author

Owned files:
- lib/world/arcadeMuralsComedy.ts (new)
- lib/world/arcadeMuralsIdentity.ts (new)
- tests/world-arcade-murals-identity.test.ts (new)

Deliver: right-side throat collage z -79 to -74 (Rick and Morty, Futurama, Solar Opposites, South Park, BoJack Horseman, Archer, The Boondocks, American Dad, Brickleberry, The League). Favor portal geometry, orbital skylines, satirical line art, graphic snow hills and punchy letter tags over portrait clones. Rear upper-wall identity must be "SID'S UNDERGROUND", above the center game hitbox, with a subtle "LEVEL SELECT" accent.

Acceptance: title readable from normal chamber view, not placed on any game selection target; broad collage coordinated in scale and palette; descriptors conform to S0. No HTML or new overlays.

### S4: Procedural graffiti renderer

Owned files:
- components/world/worldArcadeGraffitiGeometry.ts (new)
- tests/world-arcade-graffiti-geometry.test.ts (new)

Deliver: createWorldArcadeGraffiti(scene, descriptors, shellSampler) returns {root, dispose, diagnostics}, or the equivalent exact S0 frozen signature. Batch shapes by material and surface, attach artwork through sampled shell normals, turn off raycasting and shadows on thin painted meshes, avoid z-fighting. Implement 3 reusable strokes, stencil lettering, rings/arcs, paint drip and layered broad silhouette primitives. Use deterministic pseudo-randomness only by fixed ID hash. Surface overrides must never act as collision.

Acceptance: no geometry inside rock or game selection planes; draw-call/triangle budget check; scene independent unit tests using typed sample fixtures; complete disposal; no edits to World renderer. No image placeholders.

### S5: Floor, ceiling and lantern atmosphere

Owned files:
- lib/world/arcadeCavernAtmosphere.ts (new)
- components/world/worldArcadeGraffitiAtmosphere.ts (new)
- tests/world-arcade-graffiti-atmosphere.test.ts (new)

Deliver: noncolliding feathered floor route/court arcs and scuffs, at exactly underground floor Y + small offset; sparse ceiling constellation/sigil inlays sampled from the real cave ceiling; lantern reveal plan based on existing warm light. Material pooling and low emissive coverage. Preserve the existing teal route past baffle, game panels and user focus. Zero added runtime lights initially.

Acceptance: noninteractive meshes, no center-lane obstructions, no flicker, do not modify existing lantern rig or World renderer; deterministic low draw-call implementation and cleanup.

### S6: Real-browser, performance and navigation QA

Owned files:
- scripts/playtest-arcade-interior.mjs (new)
- tests/world-arcade-cavern-art.test.ts (new)
- .github/workflows/arcade-interior-browser.yml (new)
- scripts/playtest-world.mjs (only if needed to fix the PRE-EXISTING 1 FPS cave navigation audit)

Deliver: baseline screenshot captures and then seven screenshot and three-niche play tests described in the build spec. Track actual draw calls, art batch count, player/surface/lighting status, JS exceptions, and gameplay selection. Gate entry from the exterior and traversal around the rock baffle. Slow SwiftShader testing must sample actual position/direction and distinguish timed-out polling from collision, without cheating player position or weakening success conditions.

Acceptance: all 3 target selections, title readable, all screenshots saved in Actions artifacts, performance delta reported. The existing broad website CI failure must be diagnosed, fixed independently, and independently verified before release. No edits to World renderer, model or cave geometry.

### S7: Sole integrator and art director

Owned shared files ONLY after upstream tasks are ready:
- components/world/worldRenderer.ts
- .github/workflows/ci.yml
- docs/world/arcade-cavern-interior-v1-build-spec.md (final revisions only)
- draft PR description and integration signoff notes

Integrate in order: S0 -> S4 -> S5 -> S1 -> S2 -> S3 -> S6. Connect art group immediately after shell and before game titles, carefully test render order, raycast exemptions, teardown and optional quality modes. Own actual viewport screenshot inspection, contrast and readability feedback. Do not move game panels, lantern, baffle or cave entrance simply to fit murals.

Gate: TypeScript, ESLint, all World tests, design invariants, focused Arcade Cavern browser, all 3 game interactions, global website navigation, prior skatepark/skimming/jet-ski and other applicable island CI. Keep feature behind branch until all pass.

## Coordination and commit protocol

- Use one issue per subagent and branch names of the form feat/arcade-interior-s0-shell, feat/arcade-interior-s1-sports, etc.
- Each agent creates an isolated PR targeting feat/sequoia-tunnel-skate-loop (not main), based on the frozen S0 contract commit. Avoid stacking modifications to the existing large PR while authors work in parallel.
- Single-file ownership is strict: if another task needs a change to someone else's file, describe it in the PR handoff and let the owner/integrator apply it.
- S0 publishes the EXACT public APIs and representative data fixtures before parallel authoring. API changes after freeze need explicit coordinator signoff plus consumer updates.
- An agent PR must include a concise artifact summary, screenshots for any visual changes, tests run (with actual results), scene-batch cost when relevant, and unresolved risks.
- No agent merges their own PR directly into production. S7 reviews and serially integrates to the draft PR branch.
- Abort a merge if scene/cave navigability, game selection or World CI regress. Preserve passing baseline artifacts for comparison.

## Efficiency and check-in cadence

1. Coordinator freezes baseline and starts S0; captures current focused exterior/interior screenshots, known site-wide CI failure and baseline draw calls.
2. When S0 succeeds, dispatch S1-S6 concurrently. S1-S3 need only descriptor data and independent tests. S4-S5 need only frozen fixtures, not finished art. S6 can write QA early.
3. Midpoint reviews: compare representative sports/anime/comedy preview compositions against the visual spec BEFORE polishing micro-details.
4. Integrate S4 + S5 with one or two placeholder descriptors to validate placement, light response and game selection. Then incrementally add each themed data group.
5. Capture five new viewpoints after each integration batch; stop if visual density or camera clipping is poor. Avoid a giant all-at-once revision.
6. Full browser and visual signoff. If the 1 FPS cave walk audit persists, open/fix a separate reproducible test problem; do not modify cave collision without a failed physical collision test.
7. Final user review in Vercel preview before promotion/merge.

## Definitions

Done for **agent**: owned code compiles, own tests pass, contract intact, handoff + evidence published.
Done for **implementation**: coherent mural room rendered in browser, no lane or selection obstruction, performance measured, QA passing across the rest of World, visually approved.
Done for **release**: all required CI workflows green and draft PR approved for integration.

No autonomous subagents are claimed to be running merely because issues and documents exist. Task dispatch requires an available coding-agent executor or human collaborators.
