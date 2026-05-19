# Neural Rendering QA Checklist

This checklist protects the sparse canvas-rendered atlas aesthetic while Claude works on the renderer itself.

## Visual Constraints

- [ ] No soma larger than 36px diameter.
- [ ] No halo larger than 50px radius.
- [ ] No giant Origin Signal disk.
- [ ] No large filled geometry; morphology should read as thin skeleton traces.
- [ ] No radial hub-and-spoke graph.
- [ ] Not every node connects directly to Origin Signal.
- [ ] Use 4-6 total connective tracts on the homepage.
- [ ] No thick axon roads or white cables.
- [ ] Branch width stays at or below 1.4px.
- [ ] Axon/tract width stays at or below 0.8px.
- [ ] Heavy glow and blur filters remain disabled unless explicitly testing.

## Segment Budgets

- [ ] Total scene segments stay under 900.
- [ ] Background tissue stays under 400 segments.
- [ ] Homepage SWC previews are capped to 70 segments each.
- [ ] Detail SWC renderings are capped to 600 segments each.
- [ ] SWC/procedural skeletons are simplified before drawing.
- [ ] No full-resolution SWC morphology renders on the homepage.

## Canvas And Performance

- [ ] Canvas DPR is capped to 1.5.
- [ ] Canvas backing store is not oversized on retina or ultrawide displays.
- [ ] Mobile and reduced-motion modes lower segment budgets.
- [ ] Memory usage does not climb continuously while idling or navigating.
- [ ] Route transitions do not trigger runaway geometry generation.
- [ ] No hydration mismatch caused by random geometry.

## Interaction And Layout

- [ ] Tiny labeled anchors remain readable.
- [ ] Labels remain within the viewport.
- [ ] Hit targets are clickable without needing giant visual nodes.
- [ ] Mobile layout remains usable.
- [ ] Route pages do not zoom into a giant soma.
- [ ] The debug overlay is hidden in production unless `?debugNeural=1` is present.

## Failure Handling

- [ ] SWC files fail gracefully and fall back to procedural skeletons.
- [ ] Missing or malformed SWC rows are ignored rather than crashing.
- [ ] Validation warnings/errors are visible in development.
- [ ] The renderer can be inspected with `python3 scripts/inspect_swc_files.py`.

## Files To Use

- Visual limits: `src/config/neuralVisualConfig.ts`
- Scene validation: `src/lib/neural-render/validateNeuralScene.ts`
- Skeleton utilities: `src/lib/neural-render/simplifySkeleton.ts`
- Debug overlay: `src/components/neural/NeuralDebugOverlay.tsx`
- Low-power hooks: `src/hooks/useReducedMotion.ts`, `src/hooks/useLowPowerMode.ts`
- Layout target data: `src/data/neuralAtlasLayout.ts`
