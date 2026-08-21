# FRONTIER Google identity + persistent memory

FRONTIER can run anonymously with browser-local learning, or as a signed-in personal platform whose preference model follows the user across sessions and devices.

The signed-in design intentionally separates four concerns:

1. **Identity** — Google OpenID Connect (`openid email profile`).
2. **Private remote memory** — a per-user snapshot stored in a private Redis/Upstash REST database and encrypted before storage.
3. **Optional Google taste import** — YouTube read-only access is requested separately and only after the user explicitly chooses it.
4. **Live discovery** — the existing request-time FRONTIER source mesh consumes the resulting preference model without exposing raw private history to discovery providers.

No auth/database npm dependency is required. The implementation uses Next route handlers, Node crypto, Google OAuth endpoints, and the Redis REST API directly.

## Deployment configuration

### Google Cloud

Create a Google OAuth **Web application**, enable the YouTube Data API v3 for the project, configure the OAuth consent screen, and register this production callback:

```text
https://sidhulyalkar.com/api/auth/google/callback
```

For local development also register:

```text
http://localhost:3000/api/auth/google/callback
```

Set:

```bash
FRONTIER_GOOGLE_CLIENT_ID=
FRONTIER_GOOGLE_CLIENT_SECRET=
FRONTIER_AUTH_SECRET=
FRONTIER_AUTH_ORIGIN=https://sidhulyalkar.com
```

`FRONTIER_AUTH_SECRET` should be a long random production secret and must never be committed. Changing it intentionally invalidates existing FRONTIER sessions and makes previously encrypted private cloud records unreadable, so treat it as durable application key material.

### Cloud memory

Create a private Upstash Redis database (or a Vercel Redis/KV-compatible REST database) and set either:

```bash
FRONTIER_REDIS_REST_URL=
FRONTIER_REDIS_REST_TOKEN=
```

or the compatible `UPSTASH_REDIS_REST_*` / `KV_REST_*` environment names.

The account can still sign in if remote storage is absent, but cross-device memory and Google taste import deliberately remain disabled rather than pretending persistence exists.

## Authentication flow

`/api/auth/google/start`

- creates a cryptographically random OAuth state nonce
- stores state / return path in short-lived HttpOnly, SameSite=Lax cookies
- requests only `openid email profile` for normal sign-in
- redirects to Google's OAuth authorization endpoint

`/api/auth/google/callback`

- validates state
- exchanges the authorization code server-side
- retrieves Google OpenID user info
- requires a stable Google `sub` + verified email
- issues a 30-day HMAC-signed HttpOnly FRONTIER session cookie
- never exposes Google access tokens to client JavaScript

The remote storage key is derived from a SHA-256 hash of Google's stable `sub`, not from the user's email address.

## Memory model

`/api/frontier/memory` is authenticated and `private, no-store`.

On first signed-in load in a browser:

```text
browser memory ─┐
                ├─ deterministic merge ─→ current browser state ─→ private cloud snapshot
cloud memory ───┘
```

The merge preserves:

- explicit topic/lane/source affinities
- knowledge state
- behavior aggregates and attention time
- saves
- collections
- recent/meaningful history
- reactions
- XP/streak state
- the newest stable ranking snapshot

After the initial merge, the current browser snapshot is authoritative. This matters because a pure set-union would make explicit deletions impossible: an unsaved item or removed collection would reappear forever. Subsequent writes therefore replace the user's current remote snapshot.

The client debounces writes so ordinary scrolling does not hammer storage. It also attempts a final best-effort flush on pagehide.

### Longitudinal growth without an infinite raw log

The enduring model is carried by bounded behavioral aggregates, topic/source/lane affinities, knowledge state, and stable ranking snapshots. Those structures can continue learning for years without storing every scroll event forever.

Before a cloud write, raw item history is compacted to a bounded recent/meaningful window. Saves, reactions, opened items, and recent entries receive priority. This protects sync latency and storage cost while preserving the statistics that actually drive long-term recommendations.

### Encryption at rest

Both cloud memory and stored Google OAuth grants are encrypted with **AES-256-GCM** before they are written to Redis. Separate purpose-derived keys are generated from `FRONTIER_AUTH_SECRET` for memory and Google credentials. The Redis database therefore does not contain readable preference history, saves, or OAuth tokens.

## What Google preferences are imported

There is no single Google API that exposes “all Google preferences.” FRONTIER does not claim otherwise.

Normal Google sign-in imports **identity only**.

The account dock exposes **Import YouTube taste** as a separate opt-in. That incremental OAuth request adds:

```text
https://www.googleapis.com/auth/youtube.readonly
```

FRONTIER then reads a bounded sample of:

- YouTube subscriptions
- the account's liked-videos playlist when available

The server converts those rows into compact preference terms and returns only the derived preference signal to the browser. Raw liked-video IDs/titles are not inserted into the persistent FRONTIER profile.

Examples of useful imported signal include:

- creator/channel affinity
- recurring sports or game terms
- music artists and genres
- research/engineering concepts
- team names

Imported signals are bounded and remain weaker than repeated explicit FRONTIER feedback. A one-time Google import should seed discovery, not permanently override what the user later teaches FRONTIER directly.

### What is deliberately not silently imported

Google Search history, Chrome browsing history, Gmail contents, Drive documents, Calendar contents, location history, and other private account data are **not** silently ingested.

Some of these are not available through normal Google Sign-In APIs at all. Others require substantially broader sensitive or data-portability scopes. Any future support should remain a separate explicit connector with a clear preview of what will be learned before applying it.

## Token storage

When YouTube permission is granted, Google OAuth tokens are stored only server-side and encrypted before storage. The browser receives neither the access token nor refresh token.

The importer refreshes an expired Google access token server-side when a refresh token is available. If permission expires or is revoked, the UI asks the user to reconnect rather than falling back to a weaker hidden path.

Google recommends incremental authorization for web-server OAuth applications, which is why FRONTIER requests the YouTube scope only when the user invokes the import rather than bundling it into ordinary sign-in.

## Recommendation growth over time

Cross-device persistence turns the existing local learner into a longitudinal preference model.

The model continues to learn from:

- thumb up / thumb down
- Love / Important / Surprise / Useful / Read / Already knew / Later / Meh / Hide
- real visible attention time
- expand/open/save behavior
- source preference
- topic preference
- media/format preference
- novelty appetite
- time-of-day and weekday context
- reading mode and navigation habits

Current-session implicit behavior still feeds a **frozen between-session ranking snapshot**, so a page does not reorder beneath the user while they are reading it. Cloud sync persists the richer model so later sessions and other devices can start from that accumulated evidence.

## Privacy boundary

Public FRONTIER discovery snapshots never contain authenticated user memory.

The live discovery API receives only the already-bounded focus concepts generated by the client. It does not receive:

- raw Google liked-video history
- raw YouTube subscription rows
- Google OAuth credentials
- full FRONTIER history
- saved items
- raw attention traces
- email address

This lets the live search layer benefit from personalization without turning private memory into a query log.

## Failure behavior

The product degrades deliberately:

- Google OAuth missing → FRONTIER remains local-first and shows `local memory`.
- Redis missing → sign-in works, cloud sync and Google taste import stay disabled.
- Redis temporarily unavailable → local memory continues to function and the account pill reports a sync issue.
- YouTube scope absent/revoked → import requests reconnect; normal FRONTIER use continues.
- Google APIs unavailable → existing preference memory remains intact.

The signed-in layer must never be a single point of failure for reading the live radar.
