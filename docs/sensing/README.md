# Sensing layer: observable signals, gestures, and shared camera runtime

Consent-gated, browser-only sensing for aesthetic site reactivity and hand-gesture control. Camera frames stay local and are never persisted by the production site.

The face pipeline reports observable facial activity only. It does not infer emotion, intent, personality, or mental state.

**Owner surface:** `components/sensing/**`, `app/sensing-lab/**`, `lib/media/CameraSession.ts`, `tests/sensing-*.test.ts`, and `scripts/analyze-gesture-takes.ts`.

## Architecture

```text
InteractionCapabilityProvider
  ├─ lightweight consent + intent state
  └─ explicit opt-in
       ↓ dynamic import
SensingProvider
  ├─ CameraSession
  ├─ FaceLandmarker → observable ExpressionReading
  ├─ GestureRecognizer → gesture reducer
  ├─ per-browser gesture calibration → safe UI tolerances
  ├─ expression → visual tokens
  └─ strict teardown on disable/unmount
```

`CameraSession` is also used by Perceptual Cortex so both systems share the same permission, stream attachment, and track-cleanup behavior.

## Production gesture grammar

The public control vocabulary is intentionally small. A physical gesture has one primary meaning everywhere.

| Gesture | Action | Safety model |
|---|---|---|
| Point + pinch | Click the locked DOM target | target acquisition halo + stable lock + pinch dwell + release-to-rearm + same-target continuity |
| Closed fist dwell | Browser history back | canned `Closed_Fist` plus conservative landmark fallback + dwell + cooldown |
| Index + middle fingers + vertical stroke | Scroll up/down | `Victory`/two-finger geometry + minimum vertical travel + axis dominance + cooldown |

The reducer no longer emits the old raised-hand forward/back navigation, palm→fist palette opening, held-fist palette closing, downward-fist page scrolling, clap activation, or thumb-up activation. Those overlapping meanings made the control language harder to predict. Pinch is the click gesture; fist is the back gesture; two fingers are the scroll gesture.

Two-finger scrolling is bidirectional. A clear downward stroke emits a positive viewport-relative scroll delta, and an upward stroke emits a negative delta. Small jitter and primarily horizontal motion are rejected.

## First-use visitor calibration

A browser without a current calibration profile is offered a short five-checkpoint sandbox:

1. **Aim** — hold the cursor on the calibration target;
2. **Click** — pinch the locked target and release;
3. **Back** — hold a closed fist briefly;
4. **Scroll down** — raise index + middle fingers and move them downward;
5. **Scroll up** — keep the two-finger pose and move upward.

All action-producing gestures are sandboxed while calibration is active. A recognized fist does not actually navigate backward and recognized scroll strokes do not move the real page until the course finishes. This lets the visitor prove the gesture recognizer works on their camera geometry without the tutorial itself changing the page.

The course stores only a small `localStorage` profile containing derived pointer jitter, target acquisition halo, target-lock timing, pinch dwell, and release debounce. It does **not** persist camera frames, hand landmarks, biometric templates, scroll trajectories, or raw calibration samples.

The larger gesture-identity thresholds for fist and two-finger scrolling remain global safety floors. Visitor calibration verifies them rather than silently weakening them per person.

## Calibration is optional and transactional

First-time users can press **skip** at any checkpoint or press `Esc`. Gesture control immediately returns to the live site using conservative safe defaults, and no fake calibration profile is written.

Returning users can recalibrate from the persistent `Hands live` control or the guide whenever they move the laptop, change camera angle/distance, alter lighting, change posture, or hand the device to another person.

Recalibration is transactional:

- the previous saved profile remains untouched while the new course is running;
- **keep current** or `Esc` restores the last known-good profile immediately;
- only a fully completed replacement course overwrites the previous profile.

Calibration schema versions are bumped when the gesture vocabulary changes, so a profile created for an older control grammar cannot silently masquerade as current.

## Measured gesture constraints

These remain engineering constraints from prior calibration work:

1. Palm width is a poor scale reference because it foreshortens when the hand rotates. Use hand length for scale-sensitive geometry.
2. Pinch must use 3D thumb-index distance when depth is available; 2D overlap is insufficient.
3. Motion should be measured even when canned pose classification flickers because fast movement is the blurriest part of the gesture.
4. Motion gestures need temporal resolution; hand inference remains near 30 fps.
5. Runtime calibration may tune UI tolerance, but it must not weaken gesture identity simply to force a pass.
6. A gesture should have one public meaning. Ambiguous multi-purpose poses are redesigned rather than increasingly patched.

## Shared tools

| Tool | Path | Purpose |
|---|---|---|
| `CameraSession` | `lib/media/CameraSession.ts` | Explicit `getUserMedia` lifecycle with reliable cleanup. |
| MediaPipe log filter | `components/sensing/quietMediapipeLogs.ts` | Prevent harmless MediaPipe logs from becoming a blocking dev overlay. |
| GPU→CPU fallback | `useFaceLandmarker.ts`, `useGestureRecognizer.ts` | Rebuild on CPU if the GPU delegate fails during inference. |
| Runtime calibration | `components/sensing/gestures/gestureCalibration.ts` | Derive local pointer/pinch UI tolerances without storing camera data. |
| Sensing Lab | `app/sensing-lab`, `components/sensing/lab/` | Owner camera health, raw observable features, hand landmarks, and local research recording. |
| Take analyzer | `scripts/analyze-gesture-takes.ts` | Replay locally downloaded JSONL through the real reducer. |

## Owner calibration protocol

Visitor calibration is interaction setup, not threshold research. Reducer threshold work still happens in `/sensing-lab`: record positive gestures plus `idle_*` negatives locally, download the JSONL, then analyze it with:

```bash
npx tsx scripts/analyze-gesture-takes.ts ~/Downloads/gesture-takes-*.jsonl
```

Do not commit those recordings to production. Analyzer code is versioned; user recordings stay local.

## Facial signal semantics

The expression adapter maps MediaPipe blendshape activations only to directly observable dimensions such as smile activation, eye openness, brow activity, mouth activity, blink activation, stillness, asymmetry, and measured head pose when available. Those values may influence color, glow, parallax, or particles.

It deliberately does not map those signals to psychological categories such as joy, fear, sadness, anger, surprise, or calm.

## Remaining experimental work

The simplified production grammar is now deliberately narrower than the research gesture set. Clap, circle-game interactions, and other experimental poses can continue to be studied in the sensing lab, but they should not re-enter the production controls unless they add a distinct capability without overlapping the three core meanings.
