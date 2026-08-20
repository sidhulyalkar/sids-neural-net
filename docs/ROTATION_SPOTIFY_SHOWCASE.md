# Rotation: Spotify listening fingerprint

`/rotation` is the portfolio-facing view of Sid's Spotify Top Items. It presents the owner account's top tracks and artists across Spotify's three affinity windows while reusing the site's neural visual language as an independent pointer/gesture-reactive background.

## What the page shows

- Top 20 tracks for the last ~4 weeks, ~6 months, and ~1 year.
- Top artists for the same three windows.
- Rank movement between adjacent windows.
- Fresh entries that appear in one window but not its comparison window.
- Top-20 overlap between windows.
- Artist breadth among the selected Top 20.
- Core tracks that appear in all three Top 20 sets.
- An official Spotify embed for a visitor-selected track.

Spotify describes `GET /me/top/{type}` as calculated affinity. The page therefore avoids claiming that these ranks are exact raw play counts. Exact play-count analytics would require a separate owner-provided listening-history export rather than the Top Items API.

## Privacy and runtime architecture

The visitor never authenticates with Spotify. The website serves a committed metadata snapshot from `content/music/top-tracks.json` and makes no owner-authenticated Spotify Web API calls in the browser.

The neural background may respond to pointer and locally processed camera gesture input. Spotify playback is intentionally independent: no audio is downloaded, analyzed, reconstructed, sampled, or synchronized to the visual field.

## Refreshing the data locally

1. Copy `.env.local.example` to `.env.local`.
2. Configure a Spotify Developer app and obtain an owner refresh token with only `user-top-read`.
3. Set `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and `SPOTIFY_REFRESH_TOKEN`.
4. Run:

```bash
npm run music:fetch
```

The script loads `.env.local`, refreshes the access token, and performs six Top Items calls: tracks + artists for `short_term`, `medium_term`, and `long_term`. It writes a validated v2 manifest.

## Automated refresh

`.github/workflows/spotify-showcase-refresh.yml` runs weekly on the repository default branch and can also be triggered manually. Add these Actions secrets before enabling it:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN`

If the secrets are absent, the workflow exits cleanly without modifying the repository.

## Spotify platform considerations

The implementation is deliberately metadata-first. Current Spotify documentation describes Top Items as an affinity ranking, requires `user-top-read`, and allows up to 50 results per request. This page stores/displays only the first 20 in each content set. Track/artist fields that Spotify removed or deprecated for 2026 Development Mode, including popularity and artist genres, are optional in the schema.

Spotify artwork and metadata are linked back to their Spotify destinations and are not modified or used as standalone content. The site does not use Spotify content for model training.

## Main files

- `app/rotation/page.tsx`
- `components/rotation/RotationExperience.tsx`
- `components/rotation/TrackGallery.tsx`
- `components/rotation/ArtistShelf.tsx`
- `components/rotation/SpotifyEmbed.tsx`
- `components/rotation/listeningStats.ts`
- `lib/spotify/manifest.ts`
- `scripts/fetch-spotify-top.ts`
- `content/music/top-tracks.json`
- `tests/rotation.test.ts`

## Publishing real data

The committed manifest intentionally remains marked `isPlaceholder: true` until the private owner credentials are used. Do not publish invented top tracks or infer them from public profile data. A successful `npm run music:fetch` replaces the placeholder with the owner's real Top Items and sets `isPlaceholder: false`.
