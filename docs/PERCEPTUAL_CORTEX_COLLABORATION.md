# Perceptual Cortex collaboration log

This file is the handoff surface for parallel work on Perceptual Cortex and the sensing lab. Update it whenever a change affects shared sensor infrastructure, model lifecycle, data contracts, or gesture semantics.

## Working agreement

- Commit focused, working slices with the files and verification results described in the commit message.
- Do not bundle unrelated work from another active contributor into a commit.
- Shared utilities should live under `components/sensing/core/` only when their behavior is product-neutral.
- Product policy stays at the product boundary: ambient navigation belongs to `components/sensing`, while artistic mappings belong to `components/perceptual-cortex`.
- Raw camera, audio, landmarks, and typed content never enter a shared global store.
- Permission owners must stop their own streams, workers, animation frames, and audio contexts on disable and unmount.
- Before changing a shared contract, record the change and its consumers below.

## Shared candidates

These are good candidates to extract once the Perceptual Cortex vision slice needs them:

| Capability | Current location | Intended shared boundary |
| --- | --- | --- |
| MediaPipe console suppression | `components/sensing/quietMediapipeLogs.ts` | Reuse directly or move to `components/sensing/core/` with both consumers updated in one commit |
| Camera error normalization | `components/sensing/errors.ts` | Share product-neutral error classification and retain product-specific copy in each UI |
| MediaPipe task/model initialization | sensing hooks | Extract only model construction and teardown; keep scheduling and feature mapping local |
| Landmark math | gesture engine and future cortex features | Share pure vector/landmark primitives, not navigation gesture thresholds |
| Confidence decay and smoothing | future cortex processing | Place pure filters in `components/sensing/core/processing/` when a second consumer exists |

The current audio analyzer remains route-local because the ambient sensing package does not consume microphone features. It can move to shared core if another experience needs the same feature contract.

## Change log

### 2026-07-15 — Perceptual Cortex phases 1 and 2

- Added the standalone `/perceptual-cortex` route and Visual Cortex portal.
- Added pointer/touch and privacy-safe keyboard cadence inputs.
- Added deterministic neural rendering, mutable fusion state, signal microscope, crystallization, and PNG export.
- Added explicit route-local microphone activation with Web Audio feature analysis.
- Audio is never recorded or uploaded; tracks and the `AudioContext` are stopped on disable and unmount.
- Added audio feature and fusion tests.
- No shared sensing or sensing-lab files were changed in this slice.
- Verified with `npm run typecheck`, `npm run test` (33 passing), and `npx next build`.

## Next coordinated change

The hand-tracking slice should first review the current sensing hooks and reuse product-neutral MediaPipe setup, error normalization, and landmark math. It must not reuse navigation gesture classifications as artistic controls: Perceptual Cortex consumes continuous palm position, velocity, pinch, openness, separation, and synchrony.

### 2026-07-15 — Vision, composition, replay, and production hardening

- Added a dedicated vision worker using the repository-pinned MediaPipe version and model conventions.
- The worker accepts transferable `ImageBitmap` frames and returns compact continuous features; it does not return raw landmarks.
- Added two-hand force, speed, pinch, separation/symmetry, bilateral bloom, head pose, facial activity, and stillness mappings.
- Added normalized replay, deterministic titles and interpretations, six synthetic demos, adaptive quality, 1920×1080 export, and deterministic visual fixtures.
- Migrated linting from interactive `next lint` to ESLint 9 flat configuration.
- No active sensing-lab or gesture-engine files were modified.

### 2026-07-15 — Conceptual color templates

- Added Homeostasis, Plasticity, Synchrony, Criticality, and Liminality templates.
- Each template defines a semantic palette for pointer, touch, keyboard, audio, hand, face, and synthetic signals rather than applying a single global tint.
- Themes also control the soma, membrane, branch populations, pulses, lighting, fog, export background, and exported metadata.
- Theme concepts are visible in the instrument so the palette remains interpretable instead of decorative.
