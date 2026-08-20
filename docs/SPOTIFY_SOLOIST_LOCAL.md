# Spotify Soloist: optional local integration

Spotify Soloist is intentionally separate from the public `/rotation` listening-fingerprint page.

## What each credential does

### Public Rotation data refresh

`npm run music:fetch` uses the Spotify Web API and needs:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN`

Those credentials fetch the owner's Top Tracks and Top Artists snapshots that are committed as static metadata for the website.

### Local Spotify Soloist device

Spotify Soloist uses:

- `SPOTIFY_SOLOIST_API_KEY`
- `SOLOIST_DEVICE_NAME` (optional)
- `SOLOIST_WS_ADDRESS` (optional, defaults to loopback)

The Soloist key starts Spotify's headless Linux playback daemon. It is not a Spotify Web API token and cannot replace the three Web API credentials above.

## Secret handling

Never commit or publish a Soloist key.

1. Copy `.env.local.example` to `.env.local`.
2. Paste the Soloist key only into `SPOTIFY_SOLOIST_API_KEY` in that local file.
3. Keep the variable server/local-only. Never rename it to a `NEXT_PUBLIC_*` variable.
4. Do not expose the Soloist WebSocket port to the public internet.

`.env.local` is already ignored by Git.

## Check the local setup

On the Linux machine that will run Soloist:

```bash
npm run music:soloist:doctor
```

The doctor checks:

- whether the secret exists without printing it,
- whether the current host is Linux,
- whether the `soloist` executable is available,
- the configured device name and loopback WebSocket address.

## Start Soloist

After installing the current Spotify Soloist build on the Linux host:

```bash
npm run music:soloist:start
```

The wrapper loads the key from `.env.local` and starts:

```text
soloist --device-name <name> --api-key <secret> --ws 127.0.0.1:9090
```

The secret is never logged by the wrapper.

## Why the public website does not connect directly

Spotify documents the Soloist WebSocket API as a local integration surface. It has no built-in browser-facing authentication, TLS, Origin validation, CSRF protection, or public network exposure policy. The website therefore does not connect a visitor's browser directly to Soloist.

A future local installation could use Soloist for a Raspberry Pi display, physical controls, a home listening dashboard, or a private authenticated bridge. That should remain a separate local-device system from the public portfolio.

## Useful future extension

If a Linux/Raspberry Pi installation becomes part of the project, add a small authenticated local companion service that reads Soloist's playback events and renders a private now-playing display. Keep that service on the local network and do not use the Soloist API key in browser code.
