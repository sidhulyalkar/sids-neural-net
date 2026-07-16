# Rotation — Spotify Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/rotation`, an experience where Sid's Spotify top tracks play in Spotify's official embed while the existing neural organism reacts to a beat-synced precomputed timeline plus the visitor's live gestures.

**Architecture:** The Spotify iFrame embed provides real audio and a `playback_update` clock. A pure `sample(timeline, posMs)` function turns a precomputed beat-grid into `AudioFeatures` — the exact channel the live microphone used — which is fed into the untouched `advanceWorld` fusion pipeline alongside gesture inputs. Music leads; gestures accent. No audio is ever hosted, only derived beat-grid numbers.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, zustand (shared world store), @react-three/fiber (reused canvas), zod (manifest validation), Spotify iFrame Embed API, `node:test` + `tsx` (tests), `tsx` scripts.

## Global Constraints

- **No hosted/reconstructed song audio.** Store only derived numbers (BPM, beat grid) and public metadata/art. Real audio plays exclusively through Spotify's embed. (verbatim from spec: "We never host, cache, or reconstruct song audio.")
- **No deprecated Spotify endpoints, no DRM circumvention, no per-visitor auth.** Owner-only `GET /me/top/tracks` in a manual script; visitors need no login.
- **Beat-grid (Tier B) only for v1.** Timeline format reserves `spectral` channels for future Tier A, but the v1 sampler ignores them.
- **Music leads, gestures accent.** Sampled features are scaled by `MUSIC_INTENSITY = 1.4` before entering fusion; gesture inputs keep their normal weights.
- **Reuse, don't fork.** Reuse `PerceptualCortexCanvas`, `advanceWorld`, `usePerceptualStore`, and `AudioFeatures`. No new world-state fields.
- **Tests are pure-logic** under `tests/*.test.ts`, run with `npm test` (`node --import tsx --test tests/*.test.ts`). Browser/iFrame glue is verified by `npm run typecheck`, `npm run lint`, and `next build`.
- **zod is already a dependency** (`^3.24.0`) — do not add new dependencies.

## File Structure

**Create:**
- `lib/spotify/manifest.ts` — zod schema, `Track`/`Manifest` types, `parseManifest()`.
- `components/perceptual-cortex/musicTimeline.ts` — `MusicTimeline` type + pure `sample()`.
- `components/perceptual-cortex/playbackClock.ts` — pure `PlaybackClock` (interpolates position between updates).
- `components/rotation/MusicSignalSource.ts` — iFrame API loader, ambient types, `MusicPlaybackController`.
- `components/rotation/SpotifyEmbed.tsx` — mounts the embed container, owns a controller.
- `components/rotation/TrackGallery.tsx` — album-art gallery grid.
- `components/rotation/RotationExperience.tsx` — the experience shell + rAF loop.
- `app/rotation/page.tsx` — route + metadata.
- `scripts/build-beatgrid.ts` — author a beat-grid timeline file.
- `scripts/fetch-spotify-top.ts` — owner-auth top-tracks fetch.
- `content/music/top-tracks.json` — sample manifest (committed, replaceable).
- `public/music/timelines/4uLU6hMCjMI75M1A2tKUQC.json` — sample timeline.
- `.env.local.example` — documents Spotify env vars.
- `types/spotify-iframe.d.ts` — ambient module note (folded into Task 6 file instead; see task).

**Modify:**
- `package.json` — add `music:fetch` and `music:grid` scripts.
- `components/perceptual-cortex/PerceptualCortexExperience.tsx:142` — add a "Rotation" discovery link.
- `tests/rotation.test.ts` — new test file for the pure modules.

---

### Task 1: Manifest schema + sample data

**Files:**
- Create: `lib/spotify/manifest.ts`
- Create: `content/music/top-tracks.json`
- Test: `tests/rotation.test.ts`

**Interfaces:**
- Produces: `parseManifest(data: unknown): Manifest`; `type Track = { spotifyId: string; title: string; artist: string; album: string; albumArtUrl: string; spotifyUrl: string; popularity: number; bpm?: number; downbeatMs?: number }`; `type Manifest = { generatedAt: string; tracks: Track[] }`.

- [ ] **Step 1: Write the failing test**

Append to `tests/rotation.test.ts` (create the file with these imports at the top):

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseManifest } from '../lib/spotify/manifest';

test('parseManifest accepts a valid manifest and applies defaults', () => {
  const manifest = parseManifest({
    generatedAt: '2026-07-16T00:00:00.000Z',
    tracks: [{ spotifyId: 'abc', title: 'Song', artist: 'Artist', spotifyUrl: 'spotify:track:abc' }],
  });
  assert.equal(manifest.tracks.length, 1);
  assert.equal(manifest.tracks[0].album, '');
  assert.equal(manifest.tracks[0].popularity, 0);
});

test('parseManifest rejects a track missing a title', () => {
  assert.throws(() => parseManifest({ generatedAt: 'x', tracks: [{ spotifyId: 'abc', artist: 'A', spotifyUrl: 'u' }] }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/spotify/manifest'`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/spotify/manifest.ts`:

```ts
import { z } from 'zod';

export const trackSchema = z.object({
  spotifyId: z.string().min(1),
  title: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().default(''),
  albumArtUrl: z.string().default(''),
  spotifyUrl: z.string().min(1),
  popularity: z.number().int().min(0).max(100).default(0),
  bpm: z.number().positive().optional(),
  downbeatMs: z.number().min(0).optional(),
});

export const manifestSchema = z.object({
  generatedAt: z.string(),
  tracks: z.array(trackSchema),
});

export type Track = z.infer<typeof trackSchema>;
export type Manifest = z.infer<typeof manifestSchema>;

export function parseManifest(data: unknown): Manifest {
  return manifestSchema.parse(data);
}
```

- [ ] **Step 4: Create the sample manifest**

Create `content/music/top-tracks.json` (sample data — `scripts/fetch-spotify-top.ts` overwrites it; the `spotifyId` is a public placeholder track to keep dev working, replace with your own):

```json
{
  "generatedAt": "2026-07-16T00:00:00.000Z",
  "tracks": [
    {
      "spotifyId": "4uLU6hMCjMI75M1A2tKUQC",
      "title": "Sample Track (replace via npm run music:fetch)",
      "artist": "Placeholder Artist",
      "album": "",
      "albumArtUrl": "",
      "spotifyUrl": "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
      "popularity": 50,
      "bpm": 113,
      "downbeatMs": 320
    }
  ]
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS for both new tests, existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add lib/spotify/manifest.ts content/music/top-tracks.json tests/rotation.test.ts
git commit -m "feat(rotation): manifest schema + sample top-tracks data"
```

---

### Task 2: Music timeline sampler

**Files:**
- Create: `components/perceptual-cortex/musicTimeline.ts`
- Test: `tests/rotation.test.ts`

**Interfaces:**
- Consumes: `AudioFeatures` from `./audioFeatures`.
- Produces: `type TimelineSection = { startMs: number; kind: 'intro'|'build'|'drop'|'break'|'outro'; intensity: number }`; `type MusicTimeline = { version: 1; durationMs: number; bpm: number; downbeatMs: number; sections?: TimelineSection[]; spectral?: { frameMs: number; low: number[]; mid: number[]; high: number[]; centroid: number[] } }`; `sample(timeline: MusicTimeline, posMs: number, intensity?: number): AudioFeatures`.

- [ ] **Step 1: Write the failing test**

Append to `tests/rotation.test.ts`:

```ts
import { sample, type MusicTimeline } from '../components/perceptual-cortex/musicTimeline';

const grid: MusicTimeline = { version: 1, durationMs: 200000, bpm: 120, downbeatMs: 0 };

test('sample is deterministic for a given position', () => {
  assert.deepEqual(sample(grid, 1234), sample(grid, 1234));
});

test('sample peaks onset on the downbeat and dips off-beat', () => {
  const beatMs = 60000 / 120; // 500ms
  const onBeat = sample(grid, 4 * beatMs).onset;
  const offBeat = sample(grid, 4 * beatMs + beatMs / 2).onset;
  assert.ok(onBeat > 0.8, `expected strong onset on beat, got ${onBeat}`);
  assert.ok(offBeat < 0.2, `expected weak onset off beat, got ${offBeat}`);
});

test('sample returns all fields within [0,1]', () => {
  for (const pos of [0, 137, 5000, 250000]) {
    const f = sample(grid, pos, 1.4);
    for (const [k, v] of Object.entries(f)) {
      assert.ok(v >= 0 && v <= 1, `${k}=${v} out of range at pos ${pos}`);
    }
  }
});

test('intensity raises energy but stays clamped', () => {
  const beatMs = 60000 / 120;
  assert.ok(sample(grid, beatMs, 1.4).lowEnergy >= sample(grid, beatMs, 1.0).lowEnergy);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../components/perceptual-cortex/musicTimeline'`.

- [ ] **Step 3: Write minimal implementation**

Create `components/perceptual-cortex/musicTimeline.ts`:

```ts
import type { AudioFeatures } from './audioFeatures';

export type TimelineSection = {
  startMs: number;
  kind: 'intro' | 'build' | 'drop' | 'break' | 'outro';
  intensity: number;
};

export type MusicTimeline = {
  version: 1;
  durationMs: number;
  bpm: number;
  downbeatMs: number;
  sections?: TimelineSection[];
  // Reserved for Tier A spectral analysis; ignored by the v1 sampler.
  spectral?: { frameMs: number; low: number[]; mid: number[]; high: number[]; centroid: number[] };
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

// Phase within a beat in [0,1): 0 exactly on the beat.
const beatPhase = (posMs: number, downbeatMs: number, beatMs: number) => {
  const raw = (posMs - downbeatMs) % beatMs;
  return (raw < 0 ? raw + beatMs : raw) / beatMs;
};

// Section intensity at a position; defaults to 0.5 when no sections are authored.
const sectionIntensity = (timeline: MusicTimeline, posMs: number) => {
  if (!timeline.sections?.length) return 0.5;
  let current = timeline.sections[0].intensity;
  for (const section of timeline.sections) {
    if (section.startMs <= posMs) current = section.intensity;
    else break;
  }
  return clamp01(current);
};

export function sample(timeline: MusicTimeline, posMs: number, intensity = 1): AudioFeatures {
  const beatMs = 60000 / timeline.bpm;
  const phase = beatPhase(posMs, timeline.downbeatMs, beatMs);
  const offPhase = beatPhase(posMs, timeline.downbeatMs + beatMs / 2, beatMs);
  const beatEnv = Math.exp(-phase * 6);        // kick spike, decays across the beat
  const hatEnv = Math.exp(-offPhase * 8);      // off-beat hi-hat spike
  const drive = sectionIntensity(timeline, posMs);

  const scale = (value: number) => clamp01(value * intensity);
  const smoothedRms = scale(drive * (0.35 + 0.25 * beatEnv));
  return {
    rms: smoothedRms,
    smoothedRms,
    lowEnergy: scale(drive * (0.4 + 0.6 * beatEnv)),
    midEnergy: scale(drive * 0.5),
    highEnergy: scale(drive * (0.3 + 0.5 * hatEnv)),
    spectralCentroid: scale(0.3 + 0.4 * hatEnv),
    spectralFlux: scale(beatEnv),
    onset: scale(beatEnv),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for all four new tests. (On-beat onset = `exp(0)=1` scaled/clamped; off-beat onset = `exp(-3)≈0.05`.)

- [ ] **Step 5: Commit**

```bash
git add components/perceptual-cortex/musicTimeline.ts tests/rotation.test.ts
git commit -m "feat(rotation): pure beat-grid to AudioFeatures sampler"
```

---

### Task 3: Playback clock interpolation

**Files:**
- Create: `components/perceptual-cortex/playbackClock.ts`
- Test: `tests/rotation.test.ts`

**Interfaces:**
- Produces: `class PlaybackClock { update(positionMs: number, isPaused: boolean, wallMs: number): void; positionMs(wallMs: number): number; get isPlaying(): boolean }`.

- [ ] **Step 1: Write the failing test**

Append to `tests/rotation.test.ts`:

```ts
import { PlaybackClock } from '../components/perceptual-cortex/playbackClock';

test('playback clock interpolates while playing', () => {
  const clock = new PlaybackClock();
  clock.update(1000, false, 0);
  assert.equal(clock.positionMs(500), 1500);
  assert.equal(clock.isPlaying, true);
});

test('playback clock freezes while paused', () => {
  const clock = new PlaybackClock();
  clock.update(1000, true, 0);
  assert.equal(clock.positionMs(500), 1000);
  assert.equal(clock.isPlaying, false);
});

test('playback clock snaps to the reported position on update', () => {
  const clock = new PlaybackClock();
  clock.update(1000, false, 0);
  clock.update(2000, false, 1000);
  assert.equal(clock.positionMs(1000), 2000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../components/perceptual-cortex/playbackClock'`.

- [ ] **Step 3: Write minimal implementation**

Create `components/perceptual-cortex/playbackClock.ts`:

```ts
// Interpolates playback position between the ~1Hz Spotify `playback_update` events
// using an injected wall clock, so callers get a smooth per-frame position.
export class PlaybackClock {
  private lastPositionMs = 0;
  private lastWallMs = 0;
  private playing = false;

  update(positionMs: number, isPaused: boolean, wallMs: number) {
    this.lastPositionMs = positionMs;
    this.lastWallMs = wallMs;
    this.playing = !isPaused;
  }

  positionMs(wallMs: number): number {
    if (!this.playing) return this.lastPositionMs;
    return this.lastPositionMs + (wallMs - this.lastWallMs);
  }

  get isPlaying() {
    return this.playing;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for all three new tests.

- [ ] **Step 5: Commit**

```bash
git add components/perceptual-cortex/playbackClock.ts tests/rotation.test.ts
git commit -m "feat(rotation): interpolating playback clock"
```

---

### Task 4: Beat-grid author script + sample timeline

**Files:**
- Create: `scripts/build-beatgrid.ts`
- Create: `public/music/timelines/4uLU6hMCjMI75M1A2tKUQC.json`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: `MusicTimeline` type (Task 2) for the emitted shape.
- Produces: CLI `npm run music:grid -- <spotifyId> <bpm> <downbeatMs> [durationMs]` writing `public/music/timelines/<spotifyId>.json`.

- [ ] **Step 1: Add the npm scripts**

In `package.json`, add to `"scripts"` (after `"photos:update"`):

```json
    "music:fetch": "tsx scripts/fetch-spotify-top.ts",
    "music:grid": "tsx scripts/build-beatgrid.ts"
```

- [ ] **Step 2: Write the script**

Create `scripts/build-beatgrid.ts`:

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MusicTimeline } from '../components/perceptual-cortex/musicTimeline';

const [spotifyId, bpmArg, downbeatArg, durationArg] = process.argv.slice(2);

if (!spotifyId || !bpmArg || !downbeatArg) {
  console.error('Usage: npm run music:grid -- <spotifyId> <bpm> <downbeatMs> [durationMs]');
  process.exit(1);
}

const bpm = Number(bpmArg);
const downbeatMs = Number(downbeatArg);
const durationMs = Number(durationArg ?? 210000);

if (!Number.isFinite(bpm) || bpm <= 0 || !Number.isFinite(downbeatMs)) {
  console.error('bpm must be > 0 and downbeatMs must be a number.');
  process.exit(1);
}

const timeline: MusicTimeline = {
  version: 1,
  durationMs,
  bpm,
  downbeatMs,
  sections: [
    { startMs: 0, kind: 'intro', intensity: 0.4 },
    { startMs: Math.round(durationMs * 0.25), kind: 'build', intensity: 0.7 },
    { startMs: Math.round(durationMs * 0.4), kind: 'drop', intensity: 1 },
    { startMs: Math.round(durationMs * 0.75), kind: 'break', intensity: 0.55 },
    { startMs: Math.round(durationMs * 0.85), kind: 'outro', intensity: 0.5 },
  ],
};

const dir = join(process.cwd(), 'public', 'music', 'timelines');
await mkdir(dir, { recursive: true });
await writeFile(join(dir, `${spotifyId}.json`), JSON.stringify(timeline, null, 2));
console.log(`Wrote public/music/timelines/${spotifyId}.json (bpm ${bpm}, downbeat ${downbeatMs}ms).`);
```

- [ ] **Step 3: Generate the sample timeline**

Run: `npm run music:grid -- 4uLU6hMCjMI75M1A2tKUQC 113 320 213000`
Expected: prints `Wrote public/music/timelines/4uLU6hMCjMI75M1A2tKUQC.json ...` and the file exists.

- [ ] **Step 4: Verify the emitted file parses as a timeline**

Run: `node --import tsx -e "import('./components/perceptual-cortex/musicTimeline.ts').then(async m => { const t = JSON.parse(await import('node:fs/promises').then(f => f.readFile('public/music/timelines/4uLU6hMCjMI75M1A2tKUQC.json','utf8'))); console.log(m.sample(t, 1000)); })"`
Expected: prints an `AudioFeatures` object with numeric fields (no throw).

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/build-beatgrid.ts public/music/timelines/4uLU6hMCjMI75M1A2tKUQC.json
git commit -m "feat(rotation): beat-grid author script + sample timeline"
```

---

### Task 5: Spotify top-tracks fetch script

**Files:**
- Create: `scripts/fetch-spotify-top.ts`
- Create: `.env.local.example`

**Interfaces:**
- Consumes: env `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN`.
- Produces: overwrites `content/music/top-tracks.json` with the owner's top tracks (metadata only, preserving any existing `bpm`/`downbeatMs`).

- [ ] **Step 1: Document the env vars**

Create `.env.local.example`:

```bash
# Spotify owner credentials for `npm run music:fetch` (never commit .env.local).
# 1. Create an app at https://developer.spotify.com/dashboard (redirect URI http://127.0.0.1:8888/callback).
# 2. One-time authorize (scope user-top-read) to obtain a refresh token:
#    open: https://accounts.spotify.com/authorize?client_id=YOUR_ID&response_type=code&redirect_uri=http://127.0.0.1:8888/callback&scope=user-top-read
#    then exchange the returned ?code= for a refresh_token via:
#    curl -X POST https://accounts.spotify.com/api/token \
#      -d grant_type=authorization_code -d code=THE_CODE \
#      -d redirect_uri=http://127.0.0.1:8888/callback \
#      -u "YOUR_ID:YOUR_SECRET"
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REFRESH_TOKEN=
```

- [ ] **Step 2: Write the script**

Create `scripts/fetch-spotify-top.ts`:

```ts
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { manifestSchema, type Track } from '../lib/spotify/manifest';

const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN } = process.env;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
  console.error('Missing Spotify env vars. See .env.local.example.');
  process.exit(1);
}

async function accessToken(): Promise<string> {
  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: SPOTIFY_REFRESH_TOKEN! }),
  });
  if (!response.ok) throw new Error(`Token refresh failed: ${response.status} ${await response.text()}`);
  return ((await response.json()) as { access_token: string }).access_token;
}

const manifestPath = join(process.cwd(), 'content', 'music', 'top-tracks.json');

async function existingGrids(): Promise<Map<string, Pick<Track, 'bpm' | 'downbeatMs'>>> {
  try {
    const parsed = manifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
    return new Map(parsed.tracks.map((t) => [t.spotifyId, { bpm: t.bpm, downbeatMs: t.downbeatMs }]));
  } catch {
    return new Map();
  }
}

async function main() {
  const token = await accessToken();
  const grids = await existingGrids();
  const response = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=medium_term', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Top tracks failed: ${response.status} ${await response.text()}`);
  const data = (await response.json()) as {
    items: Array<{ id: string; name: string; popularity: number; external_urls: { spotify: string };
      artists: Array<{ name: string }>; album: { name: string; images: Array<{ url: string }> } }>;
  };

  const tracks: Track[] = data.items.map((item) => {
    const prior = grids.get(item.id);
    return {
      spotifyId: item.id,
      title: item.name,
      artist: item.artists.map((a) => a.name).join(', '),
      album: item.album.name,
      albumArtUrl: item.album.images[0]?.url ?? '',
      spotifyUrl: item.external_urls.spotify,
      popularity: item.popularity,
      ...(prior?.bpm ? { bpm: prior.bpm } : {}),
      ...(prior?.downbeatMs != null ? { downbeatMs: prior.downbeatMs } : {}),
    };
  });

  const manifest = manifestSchema.parse({ generatedAt: new Date().toISOString(), tracks });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  const missing = tracks.filter((t) => t.bpm == null).map((t) => `${t.title} — ${t.artist}`);
  console.log(`Wrote ${tracks.length} tracks to content/music/top-tracks.json.`);
  if (missing.length) console.log(`\nNeed a beat-grid (run npm run music:grid -- <id> <bpm> <downbeatMs>):\n- ${missing.join('\n- ')}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
```

- [ ] **Step 3: Verify it typechecks and fails cleanly without creds**

Run: `npm run typecheck`
Expected: no type errors.

Run: `npx tsx scripts/fetch-spotify-top.ts`
Expected: prints `Missing Spotify env vars. See .env.local.example.` and exits non-zero (confirms the guard; do not commit real creds).

- [ ] **Step 4: Commit**

```bash
git add scripts/fetch-spotify-top.ts .env.local.example
git commit -m "feat(rotation): owner-auth Spotify top-tracks fetch script"
```

---

### Task 6: Music playback controller (iFrame API wrapper)

**Files:**
- Create: `components/rotation/MusicSignalSource.ts`

**Interfaces:**
- Consumes: `PlaybackClock` (Task 3).
- Produces: `class MusicPlaybackController` with `static create(element: HTMLElement, uri: string): Promise<MusicPlaybackController>`, `loadTrack(uri: string): void`, `play(): void`, `pause(): void`, `getPositionMs(): number`, `get isPlaying(): boolean`, `destroy(): void`.

- [ ] **Step 1: Write the module**

Create `components/rotation/MusicSignalSource.ts`:

```ts
import { PlaybackClock } from '../perceptual-cortex/playbackClock';

// Minimal ambient shape of the Spotify iFrame API (no official types published).
type PlaybackData = { position: number; duration: number; isPaused: boolean; playingURI: string };
type EmbedController = {
  addListener: (event: 'ready' | 'playback_started' | 'playback_update', cb: (e: { data: PlaybackData }) => void) => void;
  loadUri: (uri: string) => void;
  play: () => void;
  pause: () => void;
  resume: () => void;
  togglePlay: () => void;
  destroy: () => void;
};
type IFrameAPI = {
  createController: (
    element: HTMLElement,
    options: { uri: string; width?: string | number; height?: string | number },
    callback: (controller: EmbedController) => void,
  ) => void;
};

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: IFrameAPI) => void;
    __spotifyIframeApi?: IFrameAPI;
  }
}

const API_SRC = 'https://open.spotify.com/embed/iframe-api/v1';

function loadIframeApi(): Promise<IFrameAPI> {
  if (window.__spotifyIframeApi) return Promise.resolve(window.__spotifyIframeApi);
  return new Promise((resolve) => {
    const prior = window.onSpotifyIframeApiReady;
    window.onSpotifyIframeApiReady = (api) => {
      window.__spotifyIframeApi = api;
      prior?.(api);
      resolve(api);
    };
    if (!document.querySelector(`script[src="${API_SRC}"]`)) {
      const script = document.createElement('script');
      script.src = API_SRC;
      script.async = true;
      document.body.appendChild(script);
    }
  });
}

export class MusicPlaybackController {
  private clock = new PlaybackClock();
  private constructor(private controller: EmbedController) {
    controller.addListener('playback_update', (e) => {
      this.clock.update(e.data.position, e.data.isPaused, performance.now());
    });
  }

  static async create(element: HTMLElement, uri: string): Promise<MusicPlaybackController> {
    const api = await loadIframeApi();
    return new Promise((resolve) => {
      api.createController(element, { uri, width: '100%', height: 80 }, (controller) => {
        resolve(new MusicPlaybackController(controller));
      });
    });
  }

  loadTrack(uri: string) { this.controller.loadUri(uri); }
  play() { this.controller.play(); }
  pause() { this.controller.pause(); }
  getPositionMs() { return this.clock.positionMs(performance.now()); }
  get isPlaying() { return this.clock.isPlaying; }
  destroy() { this.controller.destroy(); }
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add components/rotation/MusicSignalSource.ts
git commit -m "feat(rotation): Spotify iFrame playback controller"
```

---

### Task 7: Track gallery + embed components

**Files:**
- Create: `components/rotation/TrackGallery.tsx`
- Create: `components/rotation/SpotifyEmbed.tsx`

**Interfaces:**
- Consumes: `Track` (Task 1), `MusicPlaybackController` (Task 6).
- Produces: `<TrackGallery tracks selectedId onSelect />`; `<SpotifyEmbed uri onController />` (calls `onController(controller)` once ready; reloads the uri on change).

- [ ] **Step 1: Write the gallery**

Create `components/rotation/TrackGallery.tsx`:

```tsx
'use client';

import type { Track } from '@/lib/spotify/manifest';

export function TrackGallery({ tracks, selectedId, onSelect }: {
  tracks: Track[];
  selectedId: string | null;
  onSelect: (track: Track) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {tracks.map((track) => (
        <button
          key={track.spotifyId}
          onClick={() => onSelect(track)}
          className={`group flex flex-col overflow-hidden rounded-lg border text-left transition ${
            selectedId === track.spotifyId ? 'border-amber/60 bg-amber/10' : 'border-white/10 bg-black/30 hover:border-white/30'
          }`}
        >
          <div className="aspect-square w-full bg-gradient-to-br from-violet/30 via-cyan/20 to-rose/30">
            {track.albumArtUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={track.albumArtUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="p-2">
            <p className="truncate font-mono text-[11px] text-white/85">{track.title}</p>
            <p className="truncate font-mono text-[9px] uppercase tracking-[.14em] text-white/45">{track.artist}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write the embed component**

Create `components/rotation/SpotifyEmbed.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { MusicPlaybackController } from './MusicSignalSource';

export function SpotifyEmbed({ uri, onController }: {
  uri: string;
  onController: (controller: MusicPlaybackController) => void;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const controller = useRef<MusicPlaybackController | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!host.current) return;
    if (controller.current) {
      controller.current.loadTrack(uri);
      return;
    }
    MusicPlaybackController.create(host.current, uri).then((created) => {
      if (cancelled) { created.destroy(); return; }
      controller.current = created;
      onController(created);
    });
    return () => { cancelled = true; };
  }, [uri, onController]);

  useEffect(() => () => { controller.current?.destroy(); controller.current = null; }, []);

  return <div ref={host} className="w-full" />;
}
```

- [ ] **Step 3: Verify it typechecks and lints**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/rotation/TrackGallery.tsx components/rotation/SpotifyEmbed.tsx
git commit -m "feat(rotation): track gallery + Spotify embed components"
```

---

### Task 8: Rotation experience (rAF loop wiring music + gestures)

**Files:**
- Create: `components/rotation/RotationExperience.tsx`

**Interfaces:**
- Consumes: `usePerceptualStore` + `worldSnapshot` (store), `advanceWorld`/`createInputSnapshot` (fusion), `sample` (Task 2), `MusicPlaybackController` (Task 6), `SpotifyEmbed`/`TrackGallery` (Task 7), `PerceptualCortexCanvas` (dynamic), `parseManifest` + manifest JSON, `MusicTimeline` (Task 2).
- Produces: `export function RotationExperience()`.

- [ ] **Step 1: Write the experience**

Create `components/rotation/RotationExperience.tsx`:

```tsx
'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { advanceWorld, createInputSnapshot, type InputSnapshot } from '../perceptual-cortex/fusionEngine';
import { usePerceptualStore } from '../perceptual-cortex/perceptualStore';
import { sample, type MusicTimeline } from '../perceptual-cortex/musicTimeline';
import { initialQuality, type QualityTier } from '../perceptual-cortex/quality';
import { visualThemeList, type VisualThemeId } from '../perceptual-cortex/visualThemes';
import { parseManifest, type Track } from '@/lib/spotify/manifest';
import manifestData from '@/content/music/top-tracks.json';
import { TrackGallery } from './TrackGallery';
import { SpotifyEmbed } from './SpotifyEmbed';
import type { MusicPlaybackController } from './MusicSignalSource';

const CortexCanvas = dynamic(() => import('../perceptual-cortex/PerceptualCortexCanvas').then((m) => m.PerceptualCortexCanvas), { ssr: false });

const MUSIC_INTENSITY = 1.4;
const manifest = parseManifest(manifestData);

export function RotationExperience() {
  const { seed, visualTheme, reducedMotion, start, setReducedMotion, setVisualTheme } = usePerceptualStore();
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const capture = useRef<(() => string) | null>(null);
  const input = useRef<InputSnapshot>(createInputSnapshot());
  const controller = useRef<MusicPlaybackController | null>(null);
  const timeline = useRef<MusicTimeline | null>(null);
  const flash = useRef<HTMLDivElement | null>(null);
  const pointer = useRef({ x: 0, y: 0, time: 0 });
  const [selected, setSelected] = useState<Track | null>(null);
  const [quality, setQuality] = useState<QualityTier>('balanced');

  useEffect(() => {
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    setQuality(initialQuality(innerWidth, memory));
    setReducedMotion(matchMedia('(prefers-reduced-motion: reduce)').matches);
    start();
  }, [setReducedMotion, start]);

  const selectTrack = async (track: Track) => {
    setSelected(track);
    timeline.current = null;
    try {
      const response = await fetch(`/music/timelines/${track.spotifyId}.json`);
      timeline.current = response.ok ? ((await response.json()) as MusicTimeline) : null;
    } catch {
      timeline.current = null;
    }
  };

  const onController = useCallback((created: MusicPlaybackController) => {
    controller.current = created;
    created.play();
  }, []);

  useEffect(() => {
    let raf = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      const music = controller.current;
      if (music && timeline.current && music.isPlaying) {
        const features = sample(timeline.current, music.getPositionMs(), MUSIC_INTENSITY);
        input.current.audio = features;
        input.current.audioActive = true;
        if (flash.current) flash.current.style.opacity = String(0.08 + features.onset * 0.32);
      } else {
        input.current.audioActive = false;
        if (flash.current) flash.current.style.opacity = '0';
      }
      const world = usePerceptualStore.getState().worldSnapshot;
      advanceWorld(world, input.current, now, dt);
      input.current.speed *= Math.exp(-dt * 4);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => () => { controller.current?.destroy(); }, []);

  const onPointerMove = (event: React.PointerEvent) => {
    const now = performance.now();
    const x = event.clientX / innerWidth * 2 - 1;
    const y = -(event.clientY / innerHeight * 2 - 1);
    const dt = Math.max(8, now - pointer.current.time) / 1000;
    input.current.speed = Math.hypot(x - pointer.current.x, y - pointer.current.y) / dt;
    Object.assign(input.current, { x, y, pointerActive: true, pointerType: event.pointerType || 'unknown' });
    pointer.current = { x, y, time: now };
  };

  return (
    <section className="fixed inset-0 z-40 overflow-hidden bg-[#020306]" onPointerMove={onPointerMove} onPointerLeave={() => { input.current.pointerActive = false; }}>
      <div className="absolute inset-0"><CortexCanvas seed={seed} quality={quality} themeId={visualTheme} onCanvas={(v) => { canvas.current = v; }} onCaptureReady={(v) => { capture.current = v; }} /></div>
      <div ref={flash} className="pointer-events-none absolute inset-0 bg-white mix-blend-overlay" style={{ opacity: 0, transition: 'opacity 60ms linear' }} />

      <header className="absolute left-5 right-5 top-5 z-10 flex items-start justify-between font-mono sm:left-8 sm:right-8 sm:top-8">
        <div>
          <p className="text-[10px] uppercase tracking-[.34em] text-amber/70">gesture-reactive rotation</p>
          <h1 className="mt-2 text-sm uppercase tracking-[.22em] text-white/90">Sid&apos;s Rotation</h1>
          <p className="mt-2 max-w-sm text-[9px] normal-case tracking-[.08em] text-white/35">Pick a track — the organism reacts to the beat and to your hands, face, and pointer. Real audio streams from Spotify.</p>
        </div>
        <Link href="/perceptual-cortex" className="rounded-full border border-white/15 bg-black/20 px-4 py-2 text-[10px] uppercase tracking-[.2em] text-white/60 backdrop-blur hover:text-white">Cortex</Link>
      </header>

      <aside className="absolute bottom-5 left-5 right-5 z-10 max-h-[42vh] overflow-y-auto rounded-xl border border-white/10 bg-[#050914]/80 p-4 backdrop-blur-xl sm:left-8 sm:right-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <select aria-label="Conceptual color theme" value={visualTheme} onChange={(e) => setVisualTheme(e.target.value as VisualThemeId)} className="rounded-full border border-white/15 bg-black/60 px-3 py-2 font-mono text-[10px] uppercase tracking-[.12em] text-white/65">
            {visualThemeList.map((theme) => <option key={theme.id} value={theme.id}>{theme.label} · {theme.concept}</option>)}
          </select>
          <label className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.14em] text-white/45"><input type="checkbox" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} /> reduced motion</label>
        </div>
        {selected && (
          <div className="mb-3">
            <SpotifyEmbed uri={`spotify:track:${selected.spotifyId}`} onController={onController} />
            <a href={selected.spotifyUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block font-mono text-[9px] uppercase tracking-[.16em] text-green/70 hover:text-green">Listen on Spotify ↗</a>
          </div>
        )}
        <TrackGallery tracks={manifest.tracks} selectedId={selected?.spotifyId ?? null} onSelect={selectTrack} />
        <p className="mt-3 border-t border-white/10 pt-3 font-mono text-[9px] leading-4 text-white/30">Audio streams from Spotify. This site stores only derived beat timing — never song audio.</p>
      </aside>
    </section>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors. (If TypeScript rejects the JSON import, confirm `resolveJsonModule` is set — Next.js `tsconfig.json` enables it by default; do not disable.)

- [ ] **Step 3: Commit**

```bash
git add components/rotation/RotationExperience.tsx
git commit -m "feat(rotation): experience shell wiring music timeline + gestures"
```

---

### Task 9: Route + discovery link

**Files:**
- Create: `app/rotation/page.tsx`
- Modify: `components/perceptual-cortex/PerceptualCortexExperience.tsx:142`

**Interfaces:**
- Consumes: `RotationExperience` (Task 8).

- [ ] **Step 1: Create the route**

Create `app/rotation/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { RotationExperience } from '@/components/rotation/RotationExperience';

export const metadata: Metadata = {
  title: "Sid's Rotation",
  description: 'A gesture-reactive visualizer for my Spotify rotation — the neural organism moves to the beat and to you.',
  alternates: { canonical: '/rotation' },
};

export default function RotationPage() {
  return <RotationExperience />;
}
```

- [ ] **Step 2: Add a discovery link from the cortex header**

In `components/perceptual-cortex/PerceptualCortexExperience.tsx`, the header currently ends with a single "Exit" link (line ~142). Replace that single `<Link>` with two links so Rotation is reachable:

Find:
```tsx
      <Link href="/photography" className="rounded-full border border-white/15 bg-black/20 px-4 py-2 text-[10px] uppercase tracking-[.2em] text-white/60 backdrop-blur hover:text-white">Exit</Link>
```
Replace with:
```tsx
      <div className="flex gap-2">
        <Link href="/rotation" className="rounded-full border border-amber/30 bg-amber/10 px-4 py-2 text-[10px] uppercase tracking-[.2em] text-amber/80 backdrop-blur hover:text-amber">Rotation</Link>
        <Link href="/photography" className="rounded-full border border-white/15 bg-black/20 px-4 py-2 text-[10px] uppercase tracking-[.2em] text-white/60 backdrop-blur hover:text-white">Exit</Link>
      </div>
```

- [ ] **Step 3: Verify build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: build succeeds; `/rotation` appears in the route list.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`, open `http://localhost:3000/rotation`.
Expected: gallery renders the sample track; selecting it mounts the Spotify player; pressing play in the embed animates the organism on the beat; moving the pointer accents it; the "Cortex" link and "Rotation" link (from `/perceptual-cortex`) both navigate.

- [ ] **Step 5: Commit**

```bash
git add app/rotation/page.tsx components/perceptual-cortex/PerceptualCortexExperience.tsx
git commit -m "feat(rotation): add /rotation route and discovery link"
```

---

### Task 10: Full verification + docs

**Files:**
- Modify: `docs/PERCEPTUAL_CORTEX_COLLABORATION.md` (append a Rotation note, matching how the sonification feature was documented)

- [ ] **Step 1: Run the full gate**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green. Confirm `tests/rotation.test.ts` cases all pass and the existing suite is unaffected.

- [ ] **Step 2: Document the feature**

Append to `docs/PERCEPTUAL_CORTEX_COLLABORATION.md` a short section:

```markdown
## Rotation (Spotify showcase)

`/rotation` showcases top tracks. Spotify's embed streams the real audio and reports
playback position via the iFrame API; a precomputed per-track beat-grid
(`public/music/timelines/<id>.json`) is sampled at that position into `AudioFeatures`
and fed through `advanceWorld` alongside live gestures (music leads at
`MUSIC_INTENSITY = 1.4`). No song audio is ever hosted or reconstructed — only derived
beat timing and public metadata. Refresh the list with `npm run music:fetch`; author a
beat-grid with `npm run music:grid -- <id> <bpm> <downbeatMs>`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/PERCEPTUAL_CORTEX_COLLABORATION.md
git commit -m "docs(rotation): document the Spotify showcase experience"
```

---

## Self-Review

**Spec coverage:**
- Spotify embed as audio + iFrame playback clock → Tasks 6, 7. ✓
- Precomputed beat-grid timeline, format-reserved spectral → Task 2 (`MusicTimeline`, `sample` ignores `spectral`). ✓
- Manual top-tracks refresh script, owner auth, metadata only → Task 5. ✓
- Beat-grid author script → Task 4. ✓
- `/rotation` route reusing canvas + fusion → Tasks 8, 9. ✓
- Music leads, gestures accent (`MUSIC_INTENSITY`) → Task 8. ✓
- Inject via `AudioFeatures`, no new world fields → Task 2 return type + Task 8 `input.audio`. ✓
- Sync interpolation between `playback_update` events → Task 3 + Task 6. ✓
- No hosted audio / privacy copy → Task 8 UI copy + Task 10 docs. ✓
- Tests: `sample()` determinism/beat peaks, clock, manifest schema → Tasks 1–3. ✓
- Out of scope items (no synth layer, no per-visitor auth, no Tier A) → honored; none implemented. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `MusicTimeline`/`TimelineSection` defined in Task 2 and reused verbatim in Tasks 4 & 8; `sample(timeline, posMs, intensity?)` signature consistent across Tasks 2 & 8; `MusicPlaybackController` API (`create`/`getPositionMs`/`isPlaying`/`play`/`loadTrack`/`destroy`) defined in Task 6 and used consistently in Tasks 7 & 8; `Track`/`Manifest` from Task 1 reused in Tasks 5 & 8. ✓

**Note for implementers:** The Spotify embed only plays 30s previews for logged-out visitors and full tracks for logged-in Premium visitors — both report their own position, so the sampler works either way. The iFrame API requires a real browser; there is no unit test for the embed glue, which is why Tasks 6–9 verify via typecheck/lint/build/manual smoke rather than `node:test`.
```

