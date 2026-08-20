# Sensing layer: observable signals, gestures, and shared camera runtime

Consent-gated, browser-only sensing for aesthetic site reactivity and hand-gesture navigation. Camera frames stay local and are never persisted by the production site.

The production contract is intentionally narrow: **the face pipeline reports visible activation, not emotion, intent, personality, or mental state.** Its public features are facial activity, smile activation, eye openness, brow activity, mouth activity, expression asymmetry, blink activation, stillness, and measured head pose when a pose adapter is available.

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

`CameraSession` is also used by Perceptual Cortex so both systems share the same permission, stream attachment, and track-cleanup behavior. Perceptual Cortex still owns its worker-isolated feature extraction and fusion runtime rather than importing the global sensing engine.

## Shared tools

| Tool | Path | Purpose |
|---|---|---|
| `CameraSession` | `lib/media/CameraSession.ts` | One explicit getUserMedia lifecycle with reliable track cleanup. |
| MediaPipe log filter | `components/sensing/quietMediapipeLogs.ts` | Prevents harmless MediaPipe `INFO:` output from becoming a blocking Next dev overlay. |
| GPU→CPU delegate fallback | `useFaceLandmarker.ts`, `useGestureRecognizer.ts` | Rebuilds on CPU when a delegate constructs successfully but fails on first inference. |
| Runtime calibration | `components/sensing/gestures/gestureCalibration.ts` | Derives a local pointer/pinch profile from the visitor's own short calibration course without storing frames or landmarks. |
| Sensing Lab | `app/sensing-lab`, `components/sensing/lab/` | Local camera health, raw observable face activations, hand landmarks, gesture state, and optional owner calibration recording. |
| Take analyzer | `scripts/analyze-gesture-takes.ts` | Replays locally downloaded JSONL through the real reducer. Historical recordings are intentionally not committed to production. |

## Measured gesture constraints

These findings came from the prior calibration campaign and remain engineering constraints rather than guesses.

1. **Palm width is a poor scale reference.** It foreshortens dramatically when the hand turns edge-on. Use hand length for scale-sensitive geometry.
2. **2D landmarks cannot reliably establish a pinch.** Projected fingertips can overlap without touching. Production pinch uses 3D distance when z is available and must still pass UI-level target lock, dwell, release, and same-target gates.
3. **Do not gate motion measurement on recognition.** Fast motion is blurriest at peak velocity. Shape recognition decides whether to watch, not which motion samples are recorded.
4. **Endpoint comparisons alias motion and recovery.** Scan for the largest excursion inside the window instead of comparing only first and last samples.
5. **If the inverse motion is also a common gesture, tune less and redesign more.** Ambiguous swipes/chops were replaced with more identifiable pose transitions.
6. **Record negatives.** Deliberate gesture takes measure recall; normal `idle_*` activity is what exposes false positives.
7. **`performance.now()` restarts per page load.** Offline replay must split large timestamp jumps into separate sessions.
8. **MediaPipe canned gesture scores are class-dependent.** One global confidence threshold can erase otherwise valid classes.
9. **Motion gestures need temporal resolution.** Hands run at 30 fps because a roughly 200 ms strike is under-sampled at 15 fps once blur removes frames.
10. **User calibration must not weaken gesture identity.** Runtime calibration may tune pointer halo and pinch timing, but the validated pose/motion thresholds for navigation remain safety floors.

## Current gesture set

| Gesture | Action | Evidence status |
|---|---|---|
| Point + locked pinch | target activation | production; target-aware + per-browser calibrated |
| Raise right hand | `navigate_next` | validated in prior calibration + verified in first-use course |
| Raise left hand | `navigate_previous` | validated in prior calibration + verified in first-use course |
| Fist + downward strike | `page_down` | validated in prior calibration + verified in first-use course |
| Open-palm → fist transition | `open_palette` | validated in prior calibration + verified in first-use course |
| Closed-fist dwell | `close_palette` | validated in prior calibration |
| Thumb-up dwell | `activate` | strongest prior performer; retained as alternate activation |
| Clap | `activate` | implemented, still needs fresh two-hand validation |
| Circle-game dwell | `prank` | experimental |

The gesture runtime remains opt-in. Hidden tabs pause inference, the camera is released on cleanup, and MediaPipe does not enter the global bundle/lifecycle until the visitor explicitly enables camera signals.

## First-use visitor calibration

The production site now runs a short six-checkpoint calibration before unlocking gesture-driven navigation on a browser that has no saved profile:

1. hold the air cursor on the calibration target;
2. pinch the locked target and release;
3. raise the right open palm;
4. raise the left open palm;
5. perform the open-palm → fist menu transition;
6. perform the downward closed-fist scroll strike.

While this course is active, navigation, palette opening, target activation, and scrolling are **sandboxed**. The reducer still recognizes them, but the real page does not move until all checkpoints pass. This prevents the act of learning the controls from accidentally navigating the site.

The course stores only a small `localStorage` profile containing derived values such as pointer jitter, target acquisition halo, target-lock timing, pinch dwell, and release debounce. It does **not** persist camera frames, hand landmarks, biometric templates, or the calibration trajectory itself. Larger gesture identity thresholds are verified by successful checkpoints but remain at their validated global safety settings rather than being weakened per user.

The derived profile is reused on later visits from that browser. The live `Hands live` control exposes a **recalibrate** action for a new camera position, lighting setup, or user.

## Facial signal semantics

The expression adapter maps MediaPipe blendshape activations only to directly observable dimensions. For example, symmetric mouth-smile blendshapes can increase `smileActivation`; brow blendshapes can increase `browActivity`; blink blendshapes can increase `blinkActivation`. Those dimensions may alter color, glow, parallax, or particle activity.

It deliberately does **not** map those signals to categories such as joy, fear, sadness, anger, surprise, or calm. The old heuristic emotion subsystem and its tests were removed from production rather than hidden behind different copy.

Head orientation is initialized neutral unless a transformation-matrix adapter supplies measured pose values. The system does not fabricate pose from unrelated blendshape scores.

## Owner calibration protocol

The first-use course is for visitor-specific interaction tuning. Threshold research still happens separately in `/sensing-lab`: start the camera, select a gesture or `idle_*` label, record locally, then download the JSONL file. Use fresh gesture and idle takes when changing reducer thresholds:

```bash
npx tsx scripts/analyze-gesture-takes.ts ~/Downloads/gesture-takes-*.jsonl
```

Do not commit those recordings to the production repository. The analyzer code is versioned; calibration data stays local.

## Remaining experimental work

The clap needs fresh two-hand positive and idle data. Circle-game isolation and hammer-specific calibration can also be improved. Those gaps do not prevent the validated gesture/navigation subset or the observable-expression visual layer from shipping, but they should remain labeled experimental until measured again.
