# Sensing layer — architecture, shared tools, and measured findings

Consent-gated, browser-only camera sensing: ambient emotion tint + hand gesture
navigation. Nothing leaves the device.

**Owner surface:** `components/sensing/**`, `app/sensing-lab/**`,
`tests/sensing-*.test.ts`, `scripts/analyze-gesture-takes.ts`.

> **Working alongside `components/perceptual-cortex/`.** That package does its own
> worker-based tracking and audio reactivity, and deliberately does not import the
> sensing engine. The two are independent by design — but several problems below
> are inherent to MediaPipe-in-the-browser and will bite any package that touches
> it. **Read "Shared tools" before writing new MediaPipe code.**

## Shared tools — reuse these, don't re-solve them

| Tool | Path | Why it exists |
|---|---|---|
| `quietMediapipeInfoLogs()` | `components/sensing/quietMediapipeLogs.ts` | MediaPipe's WASM logs `INFO:` lines through `console.error`. Next's dev overlay escalates any `console.error` into a blocking modal, so loading a model pops an error dialog that reports *success*. Call this before any MediaPipe import. Safe to call from anywhere; it filters only exact `INFO:`-prefixed strings and is idempotent. |
| GPU→CPU delegate fallback | `useFaceLandmarker.ts`, `useGestureRecognizer.ts` | **A GPU delegate can construct successfully and then fail on every inference** (Firefox/WebGL: `No texture2d array with name - dst_tensor_output_10`). Construction-time try/catch never sees this. Both hooks catch the *first inference* throw, rebuild on CPU, and expose `getDelegate()`. Any new MediaPipe integration needs this or it will silently detect nothing in Firefox. |
| Sensing Lab | `app/sensing-lab`, `components/sensing/lab/` | Dev instrument: live camera + landmark overlay + every intermediate value, plus labeled JSONL recording. Localizes failures to a stage (camera → frame content → model → heuristic → action). Not linked from the site. |
| Take analyzer | `scripts/analyze-gesture-takes.ts` | Replays recorded JSONL through the real reducer. `npx tsx scripts/analyze-gesture-takes.ts <file>.jsonl` |

## Hard-won constraints (all measured, not guessed)

These cost real debugging time. They generalize beyond this package.

1. **Palm width is not a scale reference.** `d(indexMcp, pinkyMcp)` foreshortens to
   ~⅓ when the hand turns edge-on (measured 0.154 flat → 0.058). Anything
   normalized by it inflates ~2.6× exactly when the hand is angled. Use
   `getHandLength()` = `d(wrist, middleMcp)`, which lies along the rotation axis.
2. **2D landmarks cannot detect a pinch.** Thumb and index tips *project* onto the
   same point without touching. Measured: 2D `isPinching` fired on **13–18%** of
   idle frames vs **4%** of deliberate pinch frames — inverted against reality.
   Adding z roughly halves the false rate at equal recall, so `isPinching` now
   uses `distance3`. Landmarks without z degrade silently to the 2D behaviour.
3. **Gate measurement on recognition and you lose the gesture.** A fast strike is
   blurriest exactly when it moves fastest, so the shape test fails during the
   part that matters. Recording positions only on shape-matching frames capped
   dy at 0.093; tracking *through* the blur found the real 0.649. The shape test
   decides *whether to watch*, never *what to record*.
4. **Endpoint comparisons alias.** Comparing `buffer[first] → buffer[last]` breaks
   once the sample rate is high enough to hold a motion *and its recovery* — they
   cancel. Scan for the largest excursion instead. Raising 15→30fps made the chop
   fire *less* until this was fixed.
5. **A motion gesture whose inverse is also a gesture is unresolvable.** Swipes
   couldn't be told from their return stroke; the flat-hand chop couldn't be told
   from lowering a raised hand (shape, start height, end height and velocity all
   overlapped). Both were replaced by poses, not tuned.
6. **Record negatives.** Gesture takes only measure recall. Every false positive
   we found came from `idle_*` takes of normal activity.
7. **`performance.now()` restarts per page load.** Replaying across sessions
   invents false gaps; the analyzer splits on >5s jumps.
8. **MediaPipe's canned scores are not on a common scale.** Measured: Closed_Fist
   p50 **0.95**, Open_Palm p50 **0.60**. A single 0.65 confidence gate discarded
   92% of open palms, so `open_palette` never fired once in any take. Do not
   assume one threshold fits every class.
9. **Restart the dev server after structural changes.** Adding a metadata route
   (`app/favicon.ico`) or reshaping modules mid-session poisons the webpack cache
   (`Cannot find module './331.js'`, `__webpack_modules__[moduleId] is not a
   function`). Fix: `pkill -f "next dev"; rm -rf .next node_modules/.cache; npm run dev`.

## Current gesture set

| Gesture | Action | Status |
|---|---|---|
| Raise **right** hand | `navigate_next` | ✅ fires; handedness verified correct (98%/96%), **not** inverted |
| Raise **left** hand | `navigate_previous` | ✅ fires clean |
| **Fist** + downward strike | `page_down` | ✅ 10 fires/28s; zero idle false positives |
| Open palm **flashed into a fist** | `open_palette` | ✅ 15 fires; a *held* palm is how you raise to navigate, so the transition is the gesture |
| Closed fist (dwell 450ms) | `close_palette` | ✅ |
| Thumb up (dwell 650ms) | `activate` | ✅ best performer (classifier 105/105) |
| Pinch (dwell 180ms, **3D**) | `activate` | ⚠️ 10 fires; false-positive rate **unmeasured** (idle takes predate z) |
| Circle-game (dwell 900ms) | `prank` | ⚠️ leaks `activate` |

Rates: face 12fps, hands **30fps** (a ~200ms strike at 15fps is ~3 samples — too
few once blur takes some).

## Open work

- **Idle takes need re-recording with `z`.** All `idle_*` takes predate z, so the
  3D pinch threshold (0.20) has **never been measured against normal activity** —
  `distance3` silently degrades to 2D on them, making those numbers invalid.
  This is the single most important gap: the pinch was the only false-positive
  source and its new rate is unknown.
- `raise_left` still emits one `open_palette` (2.3/min) — a raise followed by a fist.
- Circle-game pose leaks `activate`; untested against z.
- `RAISE_MAX_PALM_Y = 0.42` / `RAISE_DWELL_MS = 450` are reasoned, not fitted.
- The hammer is validated only against a *proxy* (an old `fist` take), never a
  real strike. No `hammer_down` take exists yet.

## Recording protocol

Open `/sensing-lab` in **Chrome** (Firefox's GPU delegate fails; CPU fallback at
6fps starves motion gestures). Start camera → pick a label → Record → Download.
Hit Clear between labels; files are cumulative until you do.

- **Gesture takes:** perform deliberately, pause fully between reps.
- **Idle takes:** never perform a gesture; behave normally with hands visible.
  Any action fired is a false positive.
