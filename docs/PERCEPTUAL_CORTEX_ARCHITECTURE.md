# Perceptual Cortex architecture

## Product decision

Perceptual Cortex is a standalone, full-viewport instrument at `/perceptual-cortex`. It does not replace the homepage. Phase 1 must be satisfying with pointer, touch, keyboard timing, and a synthetic ambient signal before camera or microphone work begins.

## Existing code and isolation

- Reuse the site's cyan/violet/rose palette, Geist fonts, Three.js, React Three Fiber, Zustand, and the established neural morphology language.
- Keep the experience independent from `components/neural-atlas-canvas`: its homepage renderer owns navigation and has a different lifecycle.
- Keep it independent from the current ambient `components/sensing` provider. Later camera work may reuse MediaPipe loading knowledge, but Perceptual Cortex needs explicit, route-local permissions and teardown.
- Add a small portal to Visual Cortex only; do not alter global navigation in Phase 1.

Isolation is a lifecycle boundary, not a ban on shared code. Product-neutral camera errors, MediaPipe initialization, teardown helpers, landmark math, and temporal filters should be shared when a second consumer exists. Navigation gesture semantics and artistic mappings remain separate. Parallel-work handoffs are recorded in `docs/PERCEPTUAL_CORTEX_COLLABORATION.md`.

## Component boundaries

`PerceptualCortexExperience` owns the UI phase and route-level input listeners. `PerceptualCortexCanvas` owns only rendering. The Zustand store separates low-frequency UI state from a mutable `worldSnapshot` read directly inside `useFrame`. Processing modules have no React or Three.js dependency.

```text
Pointer / keyboard / synthetic clock
  -> normalized SignalFrame
  -> PerceptualFusionEngine
  -> mutable PerceptualWorldState snapshot
  -> R3F refs and buffer attributes
```

Future sources implement the same `SignalFrame<T>` contract. Rendering never consumes raw landmarks, waveform samples, streams, or model objects.

## Signal contracts

Sources are `hand | face | audio | pointer | touch | keyboard | synthetic`. Phase 1 emits normalized pointer position, velocity, speed, pressure, down state, keyboard event impulse, cadence, cadence variability, and ambient phase. The fusion result contains excitation, coherence, tension, symmetry, entropy, plasticity, trail energy, growth impulse, pulse rate, propagation velocity, and active modalities.

Keyboard processing observes timestamps and key-up duration only. It never stores or forwards `key`, `code`, typed text, or input values, and ignores editable targets and modifier shortcuts.

## Render loop

High-frequency signals update a mutable store snapshot without React subscriptions. `useFrame` reads the snapshot and mutates object transforms, material values, and pooled trail/pulse positions. Procedural topology is deterministic from the session seed and is generated once. Phase 1 uses batched line geometry and a fixed-size point pool; later work can promote major branches to instanced tubes and shader materials.

## Worker and media strategy

Phase 1 loads no media or vision code. Phase 2 audio uses Web Audio analysis without recording. Phase 3/4 creates camera streams only after a click and dynamically imports MediaPipe into `vision.worker.ts`. Video frames travel to the worker; compact features return. Streams, workers, animation frames, and audio contexts are owned outside Zustand and stopped on disable, route exit, and visibility changes.

## Privacy boundary

- No permission is requested on route load.
- No sensor payload leaves the browser.
- No audio, video, raw landmarks, images, or typed content is retained.
- Replay may contain only normalized artistic world features at 10–15 Hz.
- Camera and microphone remain independently enabled and visibly indicated.

## Performance budget

Balanced mode targets 55–60 FPS desktop and at least 30 FPS mobile, DPR capped at 1.5, fixed object pools, no per-frame React state, and no allocations in hot loops. Vision begins at 640×360 and 12–24 Hz in a worker. Adaptation reduces particles, pulses, DPR, and then inference cadence one step at a time.

## Delivery phases

1. Pointer/touch, privacy-safe keyboard cadence, synthetic ambience, fusion, deterministic organism, pooled trails/pulses, signal view, and PNG crystallization.
2. Explicit microphone permission and local FFT features.
3. Worker-based hand tracking and bilateral events.
4. Head pose and continuous facial-activity controls without emotion claims.
5. Feature replay, deterministic interpretation, and synthetic demonstrations.
6. Performance, accessibility, browser, SEO, and Visual Cortex polish.
