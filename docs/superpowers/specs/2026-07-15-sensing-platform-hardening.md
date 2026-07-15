# Sensing Platform Hardening and Extension Contract

**Date:** 2026-07-15
**Status:** v1.1 reliability implemented; later capabilities proposed
**Scope:** Complements the ambient emotion v1 and hand-gesture v2 work.

## Validated baseline

The ambient layer is correctly client-only and consent-gated. Its pure emotion mapper, smoothing,
and token generation pass deterministic tests; TypeScript and the production Next.js build pass.
Camera behavior still requires a real-browser webcam smoke test.

## v1.1 reliability requirements

- MediaPipe is a direct, pinned application dependency rather than an accidental transitive one.
- FaceLandmarker tries the GPU delegate first and falls back to CPU.
- Disable/unmount invalidates in-flight model loads. A model that resolves late is immediately closed.
- A single load generation is shared by concurrent callers, including React development remounts.
- Provider teardown remains responsible for cancelling RAF, stopping every media track, detaching the
  video element, closing inference tasks, and restoring default CSS tokens.

## v2 shared-runtime contract

Emotion and gesture recognition must share one camera stream and one scheduling owner. Do not mount
a second `getUserMedia` session or an unrelated perpetual RAF loop.

Each recognizer may have its own cadence because its cost and latency needs differ:

| Processor | Suggested cadence | Behavior under load |
|---|---:|---|
| Face emotion | 8–12 FPS | Drop frames; never queue inference |
| Hand gesture | 12–18 FPS | Prefer responsiveness; drop frames |
| Audio analyser | Display RAF | Read the latest FFT buffer only |

The shared provider should expose independent capability states such as `faceStatus` and
`gestureStatus`. Failure of one recognizer must not tear down the camera or other recognizers.

## Gesture-control safety contract

- Gesture navigation is separately enabled, even if camera consent already exists.
- Every destructive or route-changing action needs a dwell threshold or explicit completion gesture.
- Apply a 500–900 ms cooldown after an accepted gesture to prevent repeated navigation.
- Show immediate visual feedback for candidate, accepted, cooling-down, and unavailable states.
- Never replace keyboard, pointer, touch, or browser Back behavior; gestures are additive controls.
- Suppress gestures while typing, while a modal owns focus, or when the document is hidden.
- Start with a small mapping: horizontal swipe for next/previous, open palm to open command search,
  pinch for selection, and closed fist or two-handed cancel to exit gesture mode.
- Allow per-gesture remapping and disabling; do not persist camera-derived landmarks or expressions.

## Recommended feature sequence

### v2.1 — Calibration and diagnostics

A 10-second opt-in calibration estimates neutral facial baselines, camera framing, dominant hand,
and gesture range. Store only derived thresholds in session memory by default. Add a diagnostics
panel for delegate, inference cadence, dropped frames, camera resolution, and face/hand presence.

### v2.2 — Adaptive performance

Measure inference time and automatically step between quality tiers. Reduce cadence when processing
exceeds its frame budget, the tab is backgrounded, or mobile thermal/battery conditions are poor.
Offer a manual Low Power mode.

### v3 — Closed-loop audio/visual layer

Require a separate audio enable gesture and an always-visible mute. Emotion controls slow musical
parameters such as timbre and harmony; FFT energy controls immediate visual pulse. Apply limiting,
short fades, and a conservative volume ceiling. Reduced-motion and reduced-sound preferences should
independently disable visual or audio reactivity.

### Research-page experience

Present live scores as expression estimates, not measurements of internal emotion. Include the
heuristic equations, confidence caveat, local-processing architecture, model/delegate status, and a
one-click reset. An optional session summary may aggregate counts locally, but must be clearly
ephemeral and export only after an explicit user action.

## Manual acceptance checklist

1. Denying permission leaves the site usable and the toggle recoverable.
2. Enabling, disabling, and re-enabling does not leave the camera indicator active.
3. Rapidly toggling during model download creates no late-running inference task.
4. GPU failure reaches CPU mode or presents a useful error if both delegates fail.
5. Hiding the tab stops inference; returning resumes without an FPS spike.
6. Losing the face relaxes toward the default mood instead of retaining stale state.
7. Gesture cooldown prevents a held pose from firing the same action repeatedly.
8. Keyboard, touch, pointer, reduced-motion, and screen-reader paths remain fully usable.
