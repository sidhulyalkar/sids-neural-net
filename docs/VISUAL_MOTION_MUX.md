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

The uploader sends large files to Mux itself in sequential 20 MiB resumable chunks. Each chunk is retried independently, so a brief network failure does not restart a multi-gigabyte transfer.

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

Before a large batch, verify discovery and metadata without encoding or uploading:

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

If an upload or Mux ingest is interrupted, the uploader writes a local checkpoint under `.cache/mux-video/`. The checkpoint records the byte offset, temporary upload path, and the expiring Direct Upload URL so `motion:resume` can continue the same large transfer.

Resume with:

```bash
npm run motion:resume -- <mux-upload-id>
```

The checkpoint never stores the Mux API token and the entire cache directory is Git-ignored. Its Direct Upload URL is temporary, so treat the cache as local state rather than something to copy or commit.

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

For 4K source material the uploader explicitly requests a Mux `max_resolution_tier` of `2160p`; 1440p inputs request 1440p and smaller inputs request 1080p. High-resolution inputs are first converted to a temporary standards-safe H.264 mezzanine capped at 4096 px, 60 fps, 18 Mbps and a closed 2-second GOP, then deleted after a successful ingest unless `--keep-mezzanine` is set. The original file is never modified. HDR sources are rejected by the automatic mezzanine path instead of being silently tone-mapped; prepare an SDR master deliberately before publishing HDR footage.


## Curated presentation metadata

Raw source filenames and ingest provenance stay in `visualMotionManifest.json`. Public-facing titles, short descriptions, alt text, tags, and gallery order live separately in `src/data/visualMotionCuration.json`.

That separation keeps the archive auditable while allowing the public gallery to use concise editorial names. A matching curation record is applied automatically at render time and during future ingests; an explicit CLI `--title`, `--description`, or `--alt` still takes precedence for one-off uploads.


## Free-plan rotation

Mux's Free plan stores up to 10 video assets. Treat those 10 as the active streaming shelf, not the permanent archive.

- `motion:unpublish` hides a video from the website but keeps its Mux asset and therefore does **not** free a slot.
- `motion:retire` deletes the Mux asset, hides the video, and preserves the local manifest identity, source SHA, and historical Mux IDs so the item can be restored later.
- Re-running `motion:upload` on the original source of a retired item restores the same stable gallery slug instead of creating a duplicate record.

Check the current shelf:

```bash
npm run motion:slots
```

Preview a retirement without changing anything:

```bash
npm run motion:retire -- coral-garden-2
```

After reviewing the preview, explicitly free the slot:

```bash
npm run motion:retire -- coral-garden-2 --confirm-delete
```

Then upload the replacement video normally. Keep the original source files as the long-term archive; Mux is the publication/cache layer.
