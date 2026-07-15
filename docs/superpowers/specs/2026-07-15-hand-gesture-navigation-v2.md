# Hand-Gesture Navigation — v2 Design and Implementation Spec

**Date:** 2026-07-15
**Status:** Implemented; browser/webcam acceptance pending
**Depends on:** Ambient emotion sensing v1 and sensing platform v1.1

## Product behavior

Gesture control is an optional second capability inside an already-active sensing session. It never
starts a second camera. The viewer first enables the ambient camera layer, then separately enables
hand controls after reading a hand-specific local-processing disclosure.

Supported controls:

| Input | Guard | Website action |
|---|---|---|
| Horizontal open-hand swipe | ≥24% frame width, ≤16% vertical drift, 100–420 ms | Previous/next site section |
| Open palm | 700 ms dwell | Open searchable site navigation |
| Closed fist | 450 ms dwell | Close site navigation |
| Index-thumb pinch | 180 ms dwell | Activate link/button under the air cursor |
| Thumbs up | 650 ms dwell | Activate link/button under the air cursor |
| Downward karate chop | Flat tucked-thumb hand, ≥20% vertical travel | Scroll down 80% of one viewport |
| Secret circle-game pose | Held low for 900 ms | Temporary prank palette reaction |

Every accepted action starts an 800 ms cooldown. A held pose is latched until it changes or the hand
leaves the frame, preventing repeated actions.

The secret pose takes priority over pinch because both join the index finger and thumb. A circle pose
with the remaining three fingers extended suppresses normal pinch activation while its 900 ms dwell
is evaluated. Its reaction has a 30-second cooldown, changes only presentation for 3.2 seconds, and
restores the exact prior mood state. Reduced-motion users get the static palette change without an
animated transition.

## Runtime architecture

`SensingProvider` remains the only owner of `getUserMedia` and `requestAnimationFrame`.

```text
shared video stream
  ├─ FaceLandmarker at ~12 FPS → emotion mapper → mood tokens
  └─ GestureRecognizer at ~15 FPS → temporal gesture reducer → gesture store
                                                      ↓
                                    navigation / command palette / air cursor
```

Face and hand models have independent loading, status, errors, timestamps, and teardown. Gesture
failure does not stop emotion inference. Both recognizers drop frames naturally because inference is
synchronous and only the latest video frame is sampled; no frame queue is created.

## Recognition and controls

MediaPipe GestureRecognizer supplies one hand's landmarks plus canned pose classification. Swipe and
pinch are derived transparently from landmarks:

- Cursor and palm x-coordinates are mirrored to match selfie-view expectations.
- Pinch distance is divided by palm width, making the threshold scale-independent.
- Swipe uses a bounded temporal sample window and rejects excessive vertical motion.
- Low-confidence canned poses are treated as `None`.

The gesture reducer is pure and deterministic. DOM navigation and click effects live in a separate
controller and consume monotonically numbered actions.

## Safety and accessibility

- Controls are additive; keyboard, pointer, touch, browser Back, and all links remain unchanged.
- Navigation gestures are suppressed while typing, while the command palette is open, or while an
  unrelated modal owns focus.
- Pinch activates only links, buttons, command items, and explicit button roles.
- Disabled controls and sensing UI marked `data-gesture-ignore` cannot be air-clicked.
- Gesture inference pauses with the existing hidden-tab behavior and stops when sensing is disabled.
- A visible cursor, target label, pose, action feedback, and inference FPS make recognition legible.
- Holding the air cursor near the top or bottom edge scrolls the open navigation list.
- The palette remains fully searchable and operable without gestures.

## Privacy

Frames and landmarks remain in browser memory and are never persisted or uploaded. Enabling gestures
downloads the pinned MediaPipe runtime/model. The model URL is versioned; production self-hosting is
still recommended for offline operation and tighter supply-chain control.

## Automated acceptance

Unit tests cover normalized pinch detection, pose dwell thresholds, pose latch/release behavior,
cooldown, mirrored horizontal swipe recognition, vertical-swipe rejection, karate-chop shape and
motion, secret/pinch disambiguation, secret dwell, and prank cooldown. Existing emotion tests remain
unchanged.

## Manual acceptance

1. Enable ambient sensing, then enable gestures; the browser camera indicator must not restart.
2. Confirm face colors continue updating while hand controls run.
3. Hold open palm: palette opens once, not repeatedly.
4. Hold closed fist: palette closes once.
5. Swipe in both directions and verify adjacent-section navigation and cooldown.
6. Point at a palette item and pinch; verify only the highlighted target activates.
7. Focus a normal form input and verify swipes/pinches do not navigate or click.
8. Disable gestures and verify emotion sensing continues.
9. Disable ambient sensing and verify both models close and camera access stops.
10. Repeat on a CPU-fallback browser and a mobile device.

## Next extensions

- Per-user calibration for cursor bounds, dominant hand, pinch ratio, and swipe distance.
- Exponential cursor smoothing and optional magnetic snapping toward interactive targets.
- User-editable gesture mappings stored locally only after explicit opt-in.
- Low-power mode with measured inference-time adaptation.
- A research-page visualization of the 21 hand landmarks and gesture state machine.
