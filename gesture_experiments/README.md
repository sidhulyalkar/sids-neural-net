# Gesture recordings

Labeled landmark takes from `/sensing-lab`, recorded on an M1 Max MacBook Pro in
Chrome. These are the empirical basis for every threshold in
`components/sensing/gestures/gestureEngine.ts` — keep them so changes can be
re-validated instead of re-guessed.

Replay any take through the real reducer:

```bash
npx tsx scripts/analyze-gesture-takes.ts gesture_experiments/<file>.jsonl
```

## Format

One JSON object per line:

```jsonc
{
  "t": 98183,              // performance.now(), RESTARTS each page load
  "label": "chop",
  "gesture": "Open_Palm",  // MediaPipe canned class, null when no hand
  "confidence": 0.81,
  "handedness": "Right",   // null on older takes
  "landmarks": [[x, y, z], ...]  // 21 points; null when no hand was visible
}
```

- **`landmarks: null` is signal, not a gap.** Live, a null observation resets the
  tracker. Replays that skip these invent actions the pipeline cannot fire.
- **`t` restarts per session.** The analyzer splits on jumps >5s. Don't merge
  takes from different recording sessions on one timeline.
- **Files are cumulative** until Clear was pressed, so later files often
  supersede earlier ones. The analyzer dedupes by line.

## Take inventory

| Label | Notes |
|---|---|
| `raise_right` / `raise_left` | 26fps, with `z` + handedness. Confirmed handedness is **not** inverted (98%/96% correct). |
| `chop` | Best take: 626 frames @ 22.5fps. Pre-dates the switch to the fist hammer, so it holds a *flat* hand — it no longer fires and is kept as historical evidence. |
| `idle_*` | Negative takes: normal activity, nothing performed. **Any** action fired is a false positive. `idle_typing` is 100% no-hand — a finding, not a failure: hands never enter frame while typing, so typing carries zero risk. |
| `pinch`, `fist`, `thumb_up`, `open_palm`, `circle` | Early takes at 9–14fps, no `z`. |
| `swipe_left` / `swipe_right` | Historical. Swipes were removed — a swipe is indistinguishable from its own return stroke. |

## Wanted

- `hammer_down` — fist strike, at 30fps with `z`. The hammer is validated only
  against a *proxy* (the old `fist` take), never a real strike.
- A `pinch` take with `z`, holding each pinch ~0.5s.
- More `circle`.
