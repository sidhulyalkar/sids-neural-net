# Rotation — a gesture-reactive Spotify showcase

**Date:** 2026-07-16
**Status:** Approved design, ready for implementation plan

## Concept

A new experience (`/rotation`) that showcases Sid's Spotify top tracks. A visitor
picks a track from a gallery; the real song plays in Spotify's official embed; the
existing neural organism reacts to the visitor's hands/face/gestures **and** to a
beat-synced timeline of the song. The visuals lock to the music while the visitor
sculpts them live. Music leads, gestures accent.

This reuses the entire perceptual-cortex pipeline. The only new signal injection
point is `input.audio` — the same `AudioFeatures` channel the live microphone used.

## Hard constraints (why the design is shaped this way)

Verified against the current Spotify platform (Nov 2024 API changes):

- **No API audio.** `preview_url`, `audio-features`, and `audio-analysis` are removed
  for new apps. We cannot pull tempo/energy/valence, and cannot play previews via the API.
- **No live audio tap.** The Web Playback SDK is DRM/EME-protected; its output cannot
  be routed into an `AnalyserNode`. Real Spotify audio can never drive the visualizer.
- **Spotify downloads are not usable audio.** Premium offline tracks are encrypted OGG
  blobs in an obfuscated cache; only the Spotify app can decrypt them. Not analyzable.
- **The embed IS available.** The Spotify iFrame Embed API plays real audio (30s for
  logged-out visitors, full tracks for logged-in Premium) with **no API auth**, and its
  `playback_update` event exposes `position`, `duration`, `isPaused`, `playingURI` in ms.
  This is our audio source AND our playback clock.
- **Top Tracks still works** with the owner's personal auth (`GET /me/top/tracks`).

Consequence: we cannot make real audio react the organism. Instead we **pre-analyze
offline and store only derived features**, then sync that timeline to the embed's
reported playback position. No audio is ever hosted, cached, or reconstructed.

## Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| How "music plays" | Spotify embed iframe (real audio); visualizer reactive to gestures + synced precomputed timeline |
| Analysis fidelity (v1) | **Beat-grid only (Tier B)**: BPM + downbeat → synced pulses + energy envelope. Format reserves channels for future spectral (Tier A). |
| Top-tracks source | **Manual refresh script** using Sid's personal auth → committed JSON. No per-visitor auth, no runtime Spotify dependency. |
| Placement | **New `/rotation` route**, reusing `PerceptualCortexCanvas` + fusion. |
| Music/gesture mix | **Music leads, gestures accent.** Timeline is the dominant driver; hands/face modulate on top. |
| Generative synth layer | **None.** Spotify audio is the only audio. `SoundscapeEngine` stays for the crystallized-replay feature it already serves. |

## Architecture

```
Spotify embed (real audio + playback clock)
        │  position / isPaused via iFrame API "playback_update" (~1/sec)
        ▼
MusicPlaybackController ──► sample(timeline, positionMs) ──► AudioFeatures
        │  (interpolated local clock between updates)               │
   beat-flash overlay (rAF-tight accents)          input.audio = musicFeatures * musicIntensity
        │                                                          │
        └────────► PerceptualCortexCanvas ◄── advanceWorld(world, input) ◄── hands/face/pointer (unchanged)
```

Music and gestures use **separate** `InputSnapshot` fields (`audio` vs `hands`/`face`),
so they coexist without blending logic — `advanceWorld` already sums their contributions.

## Components

### Data

- **Top-tracks manifest** — `content/music/top-tracks.json`
  Metadata only, committed. Per track:
  `{ spotifyId, title, artist, album, albumArtUrl, spotifyUrl, popularity, bpm?, downbeatMs? }`.
  Validated with a zod schema.

- **Beat-grid timelines** — `public/music/timelines/<spotifyId>.json`
  Per-track, **lazy-loaded on select** (never all shipped upfront). v1 shape:
  ```
  {
    version: 1,
    durationMs: number,
    bpm: number,
    downbeatMs: number,
    sections?: Array<{ startMs: number; kind: 'intro'|'build'|'drop'|'break'|'outro'; intensity: number }>,
    // reserved for Tier A (added later, ignored by v1 sampler if absent):
    spectral?: { frameMs: number; low: number[]; mid: number[]; high: number[]; centroid: number[] }
  }
  ```

### Scripts (manual, Node/tsx; follow existing `scripts/` patterns)

- **`scripts/fetch-spotify-top.ts`** (`npm run music:fetch`)
  Authorization-Code flow with Sid's personal refresh token from `.env.local`
  (git-ignored, never committed). Calls `GET /me/top/tracks?limit=50` and writes the
  manifest. Writes metadata only — no audio. Prints tracks missing a `bpm` so they can
  be filled in.

- **`scripts/build-beatgrid.ts`** (`npm run music:grid`)
  Takes `spotifyId` + `bpm` + `downbeatMs` (+ optional section markers) and emits the
  timeline file. When Tier A is added later, a separate librosa script fills `spectral`.

### Runtime modules (`components/perceptual-cortex/`)

- **`musicTimeline.ts`** — pure `sample(timeline, posMs): AudioFeatures`.
  - v1: beat phase from `bpm`/`downbeatMs` → decaying `onset` at each beat; kick →
    `lowEnergy`; section `intensity` shapes `smoothedRms`, `midEnergy`, `highEnergy`,
    `spectralCentroid`. Deterministic, no audio, no allocation in the hot path.
  - Tier A (future): if `spectral` present, interpolate per-frame arrays instead of
    synthesizing — same return type, no downstream changes.

- **`MusicSignalSource.ts`** — `MusicPlaybackController`.
  - Wraps the iFrame API: injects the API script once, `createController` on a mounted
    element, `loadUri`, `play`/`pause`.
  - Listens to `playback_update`; maintains an interpolated clock:
    `pos = lastPos + (isPaused ? 0 : performance.now() - lastUpdateWall)`, snapping to the
    reported position on each event to remove drift.
  - Exposes `getPositionMs()`, `isPlaying`, and lifecycle `destroy()` (mirrors the
    disable/stop discipline of `AudioSignalSource`/`SoundscapeEngine`).

### UI

- **`app/rotation/page.tsx`** + **`components/rotation/RotationExperience.tsx`**
  - Landing: album-art gallery from the manifest ("Sid's rotation").
  - Select a track → mount the Spotify embed, lazy-load its timeline, start sync, reveal
    the reused `PerceptualCortexCanvas`.
  - Each animation frame: `input.audio = sample(timeline, controller.getPositionMs())`
    scaled by `musicIntensity` (>1, so music leads); `input.audioActive = true`. Live
    gesture sources remain fully active and accent on top.
  - Thin **beat-flash overlay** on a direct rAF path for tight on-beat accents,
    independent of fusion smoothing.
  - A "Listen on Spotify" affordance links out via `spotifyUrl`.
  - Reuses the theme selector, reduced-motion, and vision/audio toggles as relevant.

## Sync details

`playback_update` fires ~1×/sec. We treat its `position` as ground truth and interpolate
between events with `performance.now()`. On `isPaused` we freeze the clock; on seek the
next event snaps us. Preview (0–30 000 ms) vs full track both just report their own
position — the sampler handles either. If the API never becomes ready or is blocked, the
gallery still works (embed plays, timeline sync simply stays at 0 and gestures drive alone).

## Music-leads mixing

`musicIntensity` (default ~1.4) scales sampled `AudioFeatures` before assignment so the
beat/energy dominates `advanceWorld` (which drives `pulseRate` from `audio.onset`, bands
from energies, etc.), while gesture fields contribute their normal weights as accents.
Tunable constant; no per-field blending required.

## Privacy / legal

- Real audio is entirely Spotify's embed (their player, their rights). We never host,
  cache, or reconstruct song audio.
- We store only derived numbers (BPM, beat grid; later spectral envelopes) plus public
  metadata and album art.
- No per-visitor login, no deprecated endpoints, no DRM circumvention. Consistent with the
  existing "processed locally, nothing stored" ethos.

## Testing (fits `tests/*.test.ts` node runner)

- `sample()` determinism: `onset` peaks at `downbeatMs + n·(60000/bpm)`; returns valid
  `AudioFeatures` (all fields in [0,1] where expected) for arbitrary positions incl. past
  `durationMs`.
- Interpolated clock: advances while playing, freezes on pause, snaps to reported position
  on update.
- Manifest zod-schema validation (rejects missing required fields).

## Out of scope (v1)

Per-visitor Spotify auth · live audio tapping · audio-features/recommendations API · real
spectral (Tier A) analysis (format-ready only) · generative synth layer · playlist creation.

## Open follow-ups (post-v1)

- Tier A librosa pipeline to fill `spectral` channels from unprotected local files.
- Optional cron/scheduled refresh of the manifest.
- Per-section visual palette shifts (build → drop transitions driving theme accents).
