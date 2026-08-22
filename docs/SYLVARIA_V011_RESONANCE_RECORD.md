# Sylvaria v0.11.0 · Resonance & Record

v0.11 turns the qualified v0.10 Ecological Synergy sandbox into a more legible competitive arcade game without reopening the mechanics that already make Countercut trustworthy.

Baseline: `2932018a23560072c731068f8d260234a82d1b68` · Website CI #673 green.

## Frozen simulation contract

These are release invariants, not tuning knobs:

- simulation advances at exactly **120 Hz** (`FIXED_DT = 1 / 120`);
- WASD remains a discrete cardinal step-dash grammar;
- the persistent one-command movement queue survives key release;
- Arrow-key cuts remain independent of movement;
- Countercut still matches the projectile's actual arrival side;
- Countercut hit geometry is unchanged;
- normal returns remain **840 px/s** and perfect returns **1040 px/s**;
- Crosscut, Long Return and perfect penetration semantics remain unchanged;
- projectile caps remain **128 live / 72 pending**.

v0.11 visual effects may observe authoritative events but may not mutate these mechanics.

## Implementation order

1. Replay schema/codec and abuse limits.
2. Exact-source Node replay verifier and golden deterministic fixtures.
3. Server-issued single-use ranked-run tickets, replay digest/proof and storage boundary.
4. Browser input recorder plus browser ↔ Node replay parity in CI.
5. Render-only Resonance presentation layer and performance screenshots.
6. Three-act narrative/boss metadata and render treatments.
7. Only after replay parity is qualified: new simulation mechanics for Act II river currents and Act III oil/burn zones.
8. Leaderboard UI after the server-authoritative path is proven.

The ordering is intentional. A prettier game is not allowed to create a less trustworthy score.

---

# Pillar I · Resonance / game feel

## Presentation hold, not simulation hit-stop

A literal pause would alter collision opportunities, input timing and replay duration. v0.11 therefore implements **presentation hold**:

- perfect Countercut: approximately 42 ms visual hold;
- Crosscut enemy kill: approximately 58 ms visual hold;
- the 120 Hz simulation continues underneath;
- input collection and deterministic state updates continue normally;
- the render layer may briefly replay a captured impact frame, then catch up to the current state;
- camera impulse is render-only and never changes world coordinates.

Suggested camera impulse envelope:

`offset(t) = direction * amplitude * exp(-18t) * max(0, 1 - t / duration)`

Use the reflected-shot direction for Countercut impacts and the enemy-hit direction for Crosscut kills. No random source is required, so screenshots are stable and the presentation itself is easier to test.

## Visual-priority stack

Only one incoming hostile projectile receives the full critical-threat treatment:

1. terrain/background cache;
2. low-alpha ecology atmosphere;
3. ordinary entities/projectiles;
4. friendly reflected returns;
5. prioritized hostile threat halo;
6. Sprid + machete slash;
7. impact particles / Verdant resonance arcs;
8. HUD.

Threat priority continues to be selected by closing velocity / estimated time-to-impact rather than nearest Euclidean distance.

Critical projectile halo layers:

- inner 1.5 px ring at `r + 6`;
- outer breathing ring at `r + 12 + 2 sin(ωt)`;
- rear velocity chevron indicating approach vector;
- when TTI < 0.30 s, one short radial tick on the player-facing side.

Do not apply full glow to every projectile. The purpose is information, not luminance inflation.

## Render-only impact particles

Maintain a separate presentation pool from `state.particles` so VFX cannot affect gameplay caps or replay state.

Recommended cap: **96 presentation particles**.

Ice fracture burst:

- 12–18 triangular shards;
- angle seeded from shard index + impact direction rather than runtime RNG;
- 0.20–0.42 s life;
- fast outward velocity, slight render-only angular spin;
- one thin expanding ring.

Spore ignition / wave bloom:

- 10–16 translucent circular motes;
- two expanding contour rings;
- growth driven by visual time only;
- use the gas cloud's actual current/max radius as the spatial reference.

Render VFX must be culled when alpha reaches zero and must not allocate unbounded arrays per frame.

## Audio event surface

Gameplay remains authoritative; audio subscribes to events.

Expose a lightweight event bus such as:

- `perfect-counter`
- `crosscut-kill`
- `ice-fracture`
- `spore-bloom`
- `verdant-enter`
- `verdant-exit`
- `boss-phase`

`window.SylvariaAudioDirector.snapshot()` should expose a normalized mix target without affecting simulation.

Suggested music stem intensity:

- Flow < 40: bed 1.00, pulse 0.00, canopy 0.00;
- Flow 40–74: bed 1.00, pulse lerp 0.00→0.45;
- Flow ≥75: pulse 0.55;
- Verdant active: canopy 0.80, pulse 0.75, short counter accent enabled.

The first implementation may remain procedural Web Audio. Shipping large music files is not a prerequisite for the event architecture.

---

# Pillar II · World / narrative progression

## Act I · The Fringes · depths 1–10

Existing curriculum remains authoritative:

- grass, mud, sand, water, ice, bramble;
- forage and toxic fungi;
- first environmental routing chains;
- boss identity: **PAC-a-Saw · Surveyor Rig**.

Narrative purpose: Sprid initially believes he is stopping isolated logging incursions. Repeated survey flags, subsidy documents and mechanized scouts reveal an organized extraction system.

## Act II · The Deep Heartwood · depths 11–20

Visual/narrative scaffold can land before new simulation rules:

- darker canopy and bioluminescent fungal landmarks;
- luminous spores obscure peripheral sightlines but keep the prioritized threat readable;
- water channels become visually directional;
- boss identity: **The Harvester**.

After replay parity is proven, add deterministic current fields. Currents modify projectile velocity only through a fixed per-tick vector sampled from authored/current-zone data. The same sampler must run in browser and Node replay verification.

## Act III · The Scar · depths 21–30

Initial render/narrative layer:

- exposed soil, soot, heat shimmer, machine tracks and stripped trunks;
- boss identity: **Mulcher Apex**.

Later deterministic mechanics, only after parity:

- oil slick: very low traction / high carry, conceptually more extreme than ice but still bounded;
- industrial burn zones: telegraphed hazard footprint with a future-envelope field available to AI planning;
- no non-deterministic particle or physics sources may leak into authoritative state.

## Boss framework

Boss identity is initially a data/render distinction so hitboxes and attack timing stay frozen while narrative structure matures.

- **Surveyor Rig**: territory marking, blink/route denial language, Act I ecology.
- **The Harvester**: river/channel pressure and luminous canopy telegraphs, Act II.
- **Mulcher Apex**: bulldozing, industrial heat and scar hazards, Act III.

Unique simulation attacks land only when replay parity tests exist for them. Until then, do not describe the three forms as mechanically distinct in user-facing copy.

---

# Pillar III · Record / deterministic leaderboard

The leaderboard is **server-authoritative and tamper-resistant**. It is not described as hack-proof.

The server never trusts a client score. A ranked submission is accepted only when the server independently replays the run and produces the same score using the exact qualified engine source hash.

## Replay clock

Replay timing is simulation-tick based, never wall-clock based.

One tick = `1 / 120` second.

Only gameplay-affecting actions are recorded:

| Code | Action |
| ---: | --- |
| 0 | W down |
| 1 | W up |
| 2 | A down |
| 3 | A up |
| 4 | S down |
| 5 | S up |
| 6 | D down |
| 7 | D up |
| 8 | cut up |
| 9 | cut down |
| 10 | cut left |
| 11 | cut right |

Mute, fullscreen, pause-menu presentation and browser chrome are not leaderboard inputs.

## Compact wire format

Events are sorted by tick. Encode each event as:

`packed = deltaTick * 16 + actionCode`

Then write `packed` as unsigned LEB128/varint. Simultaneous actions therefore use `deltaTick = 0` after the first event on that tick.

Envelope schema 1:

```ts
{
  schema: 1,
  engineVersion: '0.11.0',
  engineHash: string,
  seed: number,
  durationTicks: number,
  input: string // base64url varint bytes
}
```

Validation limits:

- maximum run: 144,000 ticks (20 minutes);
- maximum 20,000 input events;
- maximum encoded input payload 120 KiB;
- action code 0–11 only;
- non-negative monotonic tick deltas;
- first event tick >= 1.

## Exact-source Node verifier

Do not launch Chromium in every score API request.

The verifier loads the exact qualified browser engine sources into a Node `vm` sandbox:

- `v091/model.js`
- `v091/world.js`
- `v091/movement.js`
- `v091/battle-core.js`
- `v091/synergy-v010.js`
- later authoritative v0.11 simulation modules, if any.

Canvas, DOM, localStorage and audio receive no-op shims. Rendering is not executed.

Per simulation tick, the verifier must reproduce `boot.js` update ordering exactly:

1. apply all replay input events scheduled for this tick;
2. shared timers / room time;
3. movement;
4. pending shots;
5. enemies;
6. boss;
7. shots;
8. slashes;
9. gas;
10. pickups;
11. particles;
12. room-clear/advance logic.

A ranked replay is valid only when:

- schema/version/hash/official seed match the active competition season;
- the replay stays under strict resource limits;
- replay terminates at the declared duration tick;
- the authoritative simulation reaches a legal end state;
- recomputed `Math.floor(state.score)` equals the claimed score;
- replay digest is not already accepted for the same engine/seed season.

Compute:

- SHA-256 over replay bytes;
- SHA-256 over canonical final authoritative state;
- SHA-256 over concatenated authoritative engine sources.

## Ranked-run ticket

A good score cannot be retroactively converted into a ranked run.

The client requests a ticket **before the run starts**. The server ticket contains:

- schema;
- engine version;
- engine source hash;
- official competition seed;
- random nonce;
- build SHA;
- issued-at and expiration timestamps.

Canonical ticket claims are protected by server HMAC-SHA256. The server secret never reaches the client.

Database state makes the ticket single-use. Submission atomically claims the nonce before expensive replay verification, preventing concurrent double-submission.

If ticket issuance is unavailable, gameplay still works but the run is explicitly **unranked**.

## Accepted-run proof

After successful replay, the server computes an HMAC over:

- engine version/hash;
- build SHA;
- ticket nonce;
- replay SHA-256;
- final-state SHA-256;
- verified score;
- duration ticks.

This proof is evidence that the portfolio server accepted that exact replay against that exact engine. It is not a client authentication credential.

## PostgreSQL / Supabase schema

### `sylvaria_engine_versions`

- `engine_version text`
- `engine_hash text`
- `build_sha text`
- `official_seed bigint`
- `active boolean`
- `created_at timestamptz`
- primary key `(engine_version, engine_hash)`

### `sylvaria_players`

- `id uuid primary key`
- `auth_subject text null unique`
- `display_name text`
- `created_at timestamptz`

Identity is optional in the first portfolio version. Replay integrity does not depend on proving a human identity.

### `sylvaria_run_tickets`

- `nonce uuid primary key`
- engine version/hash/seed/build SHA
- `request_fingerprint text` containing an HMAC-derived fingerprint, never a raw IP
- `issued_at`, `expires_at`, `used_at`

### `sylvaria_verified_runs`

- `id uuid primary key`
- optional player id + display-name snapshot
- engine version/hash/build SHA/seed
- ticket nonce unique
- replay schema
- replay bytes / compact base64url
- replay SHA-256 unique per engine/seed
- verified score
- world depth
- duration ticks
- final-state SHA-256
- verification proof
- verified timestamp

Leaderboard index:

`(engine_version, engine_hash, seed, score DESC, verified_at ASC)`

Enable RLS and expose no direct public write policy. The Next.js server uses a secret server credential for ticket/run persistence.

## API surface

All ranked actions use Node runtime and fail closed when competitive secrets/storage are not configured.

- `POST /api/sylvaria/run-ticket`
- `POST /api/sylvaria/leaderboard/submit`
- `GET /api/sylvaria/leaderboard`

The read route returns only server-verified runs for the current active engine/hash/seed.

Do not make gameplay depend on leaderboard availability.

---

# Pillar IV · Qualification gates

Every v0.11 head must continue to pass:

- semantic assertions that `movement.js` preserves 120 Hz queue/Countercut constants;
- Chrome Stable, Chromium, Firefox and WebKit rapid D → S + independent cut matrix;
- complete protected combat/ecology baseline;
- complete v0.10 Ecological Synergy lab;
- replay codec round-trip/fuzz boundary tests;
- one golden replay verified in Node;
- browser-recorded replay → Node score/state parity;
- cryptographic ticket expiry/tamper/single-use tests using an in-memory persistence adapter;
- render Resonance FPS and screenshot readability tests once that layer lands.

New Act II/III simulation mechanics cannot land until a corresponding browser ↔ Node replay parity test exists.
