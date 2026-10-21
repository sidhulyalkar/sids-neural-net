# Sid's World PR #94: Integration Contract

Status: **reviewed merge preview only**. The base branch `feat/sids-world` is receiving parallel changes; PR #94 remains draft. Never overwrite shared renderer sources by copying one side in full. The [preview workflow](../../.github/workflows/world-integration-preview.yml) checks out the exact PR SHA, fetches its current base SHA, executes `git merge --no-commit --no-ff`, and makes changes **only in the ephemeral Actions workspace**. Neither original branch is written.

## Diagnosed conflicts and chosen behaviors

The merge-base audit initially isolated five true textual-conflict files from ten overlapping paths:

- `world-regression.yml`: retain both skate and skim tests, source lint, and the expanded browser script syntax checks
- `WorldHome.tsx`, `WorldScene.tsx`, `world.module.css`: retain the jet-ski chooser and callbacks alongside the skimboarding pickup/HUD/callbacks; hide the normal activity panel whenever *any* mutually exclusive game mode is active
- `worldRenderer.ts`: retain the jet-ski racing and physical pier, the skateboard's flick/manual/pop/landing system, the North Shore board pickup/trick controller, both shoreline geometries, Shasta's alpine behavior, and the camera targeting protections
- `model.ts`, `biomes.ts`, and other cleanly merged files: preserve their independently authored environmental changes, not just the newest copy of each file.

The exact conflict count is guarded in `scripts/resolve-world-integration.py`. Unknown conflicting paths, changes to reviewed marker shapes, or unmerged content abort. When parallel edits added a new shore-geometry conflict, the preview stopped until both surface roles were reviewed and retained.

## Actual island geography, not test-only exceptions

The first merged World tests exposed a true conflict. North Shore surf geometry originally began around z=47.5, overlapping the skate grove (x=-20..8, z=28..52), and causing submerged park cells. The integration now positions the shoreline near **z=66** at x=0 with a continuous foreshore over the twelve units preceding the actual shoreline. The moved line is consumed coherently by sand blending, planted skimboard positions, waves, foam, shore animals, ocean classification and North Shore navigation. Beach vegetation clearing starts at the real foreshore, not the skate plaza.

The jet-ski route retains the existing two-lap buoys and physical natural-rock arches. The original ocean guard `z > WORLD_BOUNDS.maxZ + 20` was invalidated when the new North Shore increased maxZ to 94. The integration uses the **actual offshore coastline and physical water classification** with a finite northern race boundary, preserving the north-bend, arch water passage, eastern lagoon transition and AI opponents without relocating their gates.

## Validation status and gates

The first successful [unit-only merged preview](https://github.com/sidhulyalkar/sids-neural-net/actions/runs/38663249697) passed `npm ci`, TypeScript, isolated skate/skim contracts and all World unit tests. This is stronger evidence than separate green branches, but is not a production merge.

The newer [full merged browser preview](https://github.com/sidhulyalkar/sids-neural-net/actions/runs/38663460851) additionally checks the actual skimboarding heat, redwood bowl W → A → S → Space return and landed combo, Joshua moving skill-shot hit, and jet-ski browser race. Screenshots and diagnostics are uploaded even if a test fails. Its final result must be confirmed before sign-off.

**Release requirements:** verify current base SHA after browser acceptance, preserve the exact merged tree without changing unrelated project assets, pass production build and merged-world/browser checks, verify no duplicate minigames can run concurrently, visually inspect surf/skate boundaries, then land through a reviewed integration branch or PR. Keep PR #94 draft until those checks and formal mergeability are satisfied.

This document describes a safety-gated engineering integration, not an already deployed website or committed merge.
