# Ambient Emotion Sensing Layer — Design Spec

**Date:** 2026-07-14
**Status:** Approved (v1 implementation)
**Author:** Sid + Claude (brainstormed)

## Summary

A site-wide, toggleable ambient layer that senses the viewer's facial emotion **entirely in
the browser** and shifts the site's accent/atmosphere colors to match their mood. No backend,
no video or data ever leaves the device. This is v1 of a larger vision (gesture navigation,
audio-visual sync) that all rides on the same camera/inference spine.

## Decisions (locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Placement | Site-wide ambient layer (toggle), not a single page | Whole "neural net" reacts to its observer |
| Inference | 100% in-browser (MediaPipe Tasks, WASM/WebGL) | Zero cost, zero latency, trivial privacy story; fits Vercel/Next as-is |
| v1 slice | Sensing + emotion-driven color | Foundation everything else plugs into; immediate visible payoff |
| Color intensity | Subtle accent + atmosphere (CSS token shift) | On-brand, contrast-safe, no component rewrites |
| **Extreme emotions** | **Pop more (higher saturation + glow) while staying in brand hue families** | Anger / sadness / euphoric-joy should feel dramatic, not muted |
| Emotion model | Hand-written heuristic mapper over ~8 key blendshapes (approach A) | Fast, offline, fully explainable, live-tunable |

## Honest technical note

MediaPipe `FaceLandmarker` emits **52 ARKit blendshapes** (`mouthSmileLeft`, `browDownRight`,
`jawOpen`, …), *not* discrete emotions. v1 includes a transparent `blendshapesToEmotion`
heuristic that maps blendshapes → 6 emotion scores. This is a documented heuristic, not a
validated classifier — a bundled FER model is a possible v2 upgrade.

## Architecture (v1)

```
components/sensing/
  SensingProvider.tsx        # mounts in layout; consent-gated RAF loop; camera lifecycle; token writer
  useFaceLandmarker.ts       # loads MediaPipe FaceLandmarker (WASM/WebGL); returns detect(video)->blendshapes
  emotion/
    types.ts                 # Emotion, EmotionVector, blendshape name constants
    blendshapesToEmotion.ts  # pure: blendshapes[] -> EmotionVector (6 scores, normalized)
    smoothing.ts             # pure: EMA smoothing of EmotionVector to prevent color jitter
    emotionToTokens.ts       # pure: EmotionVector -> CSS token overrides (with extreme-intensity pop)
  ui/
    SensingToggle.tsx        # fixed control; consent + on/off; privacy disclosure
    SensingHud.tsx           # optional debug readout (emotion bars, FPS, dominant)
lib/stores/
  sensingStore.ts            # zustand: enabled, consented, permission, emotion, dominant, fps, error
```

### Data flow (one direction)

`getUserMedia` (only after explicit consent) → hidden `<video>` → throttled RAF loop
(~12 FPS) → `FaceLandmarker.detectForVideo` → blendshapes → `blendshapesToEmotion`
→ EMA `smoothing` → `sensingStore` → subscriber writes CSS custom properties on
`document.documentElement` with an eased transition → whole site atmosphere shifts.

### Emotion → palette (stays within existing brand tokens)

| Emotion | Brand hue family | Notes |
|---------|------------------|-------|
| joy / excitement | amber → green blend | Euphoria pushes brighter + stronger glow |
| calm / neutral | cyan (site default) | Resting state = current look |
| surprise | violet | Quick, punchy |
| sadness | blue (deepened) | Extreme sadness desaturates bg, deepens blue |
| anger | rose/red | Extreme anger raises saturation + glow intensity |
| fear | violet (dimmed) | Cooler, lower luminance |

**Extreme-intensity curve:** a per-emotion `intensity` (dominant score scaled by confidence)
drives an easing curve that increases saturation and glow radius for the top emotions as they
get stronger. Neutral/low-confidence stays near the default palette. Hue never leaves the brand
family; only saturation/lightness/glow are pushed.

## Consent, privacy & safety (built into v1)

- Default **OFF**. Camera starts only after an explicit "Enable" click with disclosure:
  *"Runs entirely in your browser. No video or data ever leaves your device or is stored."*
- Honors `prefers-reduced-motion` (color transitions slowed/disabled).
- Always-visible off switch; releases camera track + restores default tokens on disable.
- Auto-pauses on tab blur (`visibilitychange`); resumes on return.
- No network calls on the stream, no storage, no analytics.
- Graceful fallback: no camera / permission denied / WebGL unavailable → disabled state + message.

## Testing (prototype-appropriate)

- **Unit (primary value):** `blendshapesToEmotion`, `emotionToTokens`, `smoothing` are pure —
  tested with synthetic blendshape fixtures (big-smile vector → joy dominant; neutral → calm;
  extreme anger → higher saturation than mild anger). Run via `node --import tsx --test`.
- **Smoke:** provider renders nothing intrusive when disabled; toggle flips store state.
- Deferred (hardening TODO): webcam-driven E2E (hard to fake a camera cheaply in CI).

## Forward-compat (v2/v3 — design now, build later)

- **v2 gestures:** add `useHandLandmarker` (MediaPipe `GestureRecognizer`) into the same RAF
  loop → gesture events → nav mapping (swipe → route, open `cmdk`, scroll). No re-architecture.
- **v3 audio (closed loop, "both" direction):** `emotion → generative Web Audio soundscape`
  (mood sets key/timbre) **and** `Web Audio FFT → visual reactivity` (drives neural-net/gradient
  pulse). Store already carries the emotion vector; add `audioStore` + `AudioEngine` + analyser
  node the visuals subscribe to. Face → sound → screen closes.

## Out of scope for v1

Gesture nav, audio synthesis, FFT visual reactivity, bundled FER model, webcam E2E automation.
