# Nature Atlas 1000 + World Loom XR

The Nature Atlas now contains **1,000 deterministic unique world definitions**. Every world shares the renderer-independent scene contract and compiles into the desktop World Loom and strict WebXR readiness audit.

## Corpus structure

- Worlds 001-100: original hand-authored Atlas
- Worlds 101-900: sixteen expanded visual collections
- Worlds 901-950: **Living Sanctuaries**
- Worlds 951-1000: **Geological Wonders**
- Total: **19 collections / 1,000 worlds**

The final hundred were added as new environmental grammars rather than palette permutations.

### Living Sanctuaries

These rooms emphasize ecological relationships and habitat-scale scenes: cloud-forest bromeliad basins, mangrove nurseries, kelp refuges, seagrass turtle habitat, vernal pools, pollinator meadows, beaver wetlands, oyster reefs, salmon riffles, migration stops, fungal networks, and other systems where the interesting subject is the relationship between living things and place.

### Geological Wonders

These rooms emphasize Earth structure and deep time: travertine terraces, basalt columns, gypsum dunes, karst towers, cenotes, lava tubes, fumaroles, obsidian flows, tufa towers, slot-canyon beams, glacier moulins, geodes, rimstone pools, yardangs, permafrost polygons, crater salt pans, and subterranean lakes.

## Determinism and uniqueness

The release validator requires:

- exactly 1,000 worlds
- 1,000 unique IDs
- 1,000 unique deterministic seeds
- every collection represented
- at least four canonical visual fixtures per collection
- bounded generic-fallback usage
- valid scene thesis, subject, render cues, density, sparkle, and activities

The extension remains data-driven. Adding a world does not create another JSX renderer branch.

## Strict World Loom gate

`npm run check:world3d` compiles all 1,000 worlds and fails the release if any generated scene is not desktop-ready or WebXR-ready.

The audit checks the same runtime constraints that hardened the first 900 worlds:

- collision-free local-floor spawn station
- oriented collision footprints for structures
- traversable corridor geometry
- adaptive lane and shoulder teleport candidates
- per-corridor teleport coverage
- interaction affordances
- bounded renderer diagnostics

The success condition is deliberately binary: **desktop 1000/1000 and strict WebXR 1000/1000**. A 999-world pass is a failed release.

## Production flag

Compiler/corpus readiness and device rollout are separate gates. The deterministic production build keeps immersive XR disabled with `NEXT_PUBLIC_WORLD_LOOM_XR=disabled` until representative physical-headset/browser validation is completed. Desktop 3D remains available independently.
