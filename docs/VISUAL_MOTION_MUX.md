# Visual Motion on Mux

The Visual Cortex keeps video delivery out of the Next.js/Vercel deployment. Large camera originals stay local or in a separate archive, while Mux handles ingest, adaptive HLS playback, thumbnails, and 4K delivery.

## One-time setup

1. Create a Mux API access token with Video read/write access.
2. Copy the repository environment template if needed:

```bash
cp .env.example .env.local
```

3. Put the credentials in `.env.local`:

```bash
MUX_TOKEN_ID=...
MUX_TOKEN_SECRET=...
```

The uploader reads `.env.local` itself. These values are server/local-only and must never use a `NEXT_PUBLIC_` prefix.

Install ffmpeg so `ffprobe` is available:

```bash
brew install ffmpeg
```

The upload path also uses the `curl` binary that ships with macOS.

## Upload a single video

Uploads are **drafts by default**. A draft is uploaded to Mux and added to the manifest, but is not shown on the public photography page.

```bash
npm run motion:upload -- "/absolute/path/to/Moorea-fish-schools.mp4" \
  --collection "Moorea" \
  --location "Moorea, French Polynesia" \
  --captured-with "DJI Osmo Action 4"
```

To publish immediately, add `--publish`.

## Upload a folder

Pass a folder to ingest all supported video files in it. Apple `.AAE` sidecars and unrelated files are ignored.

```bash
npm run motion:upload -- "/absolute/path/to/selected vids" \
  --collection "Moorea" \
  --location "Moorea, French Polynesia" \
  --captured-with "DJI Osmo Action 4"
```

Use `--recursive` to descend into subfolders.

Before a large batch, verify discovery and metadata without uploading:

```bash
npm run motion:upload -- "/absolute/path/to/selected vids" --dry-run
```

## Publish and unpublish

After reviewing a draft in the manifest:

```bash
npm run motion:publish -- moorea-fish-schools
npm run motion:unpublish -- moorea-fish-schools
```

Then commit `src/data/visualMotionManifest.json`.

## Resuming after ingest

If the file reaches Mux but the local process exits while Mux is still processing it, the uploader writes a small local checkpoint under `.cache/mux-video/`.

Resume with:

```bash
npm run motion:resume -- <mux-upload-id>
```

The checkpoint never stores API credentials or a signed upload URL.

## Validation

```bash
npm run motion:check
npm test
npm run typecheck
npm run lint
```

The manifest validator checks duplicate IDs and source hashes, required dimensions/duration, Mux playback IDs for published entries, and prevents signed upload URLs or credentials from being checked in.

## What gets committed

Only compact metadata is stored in Git:

- title, slug, description and curation fields
- Mux asset/playback/upload IDs
- source filename, byte size and SHA-256 digest
- duration and source dimensions
- poster timestamp
- published/featured state

The multi-gigabyte source files do **not** enter Git, `public/`, or Vercel.

## Playback behavior

The gallery is poster-first. Before a visitor clicks a film, the page requests only a Mux thumbnail. On click it mounts Mux Player in an iframe. Mux then chooses an adaptive HLS rendition for the current display and connection, with the built-in quality selector available on platforms that expose it.

For 4K source material the uploader explicitly requests a Mux `max_resolution_tier` of `2160p`; 1440p inputs request 1440p and smaller inputs request 1080p. It never upscales the source.
