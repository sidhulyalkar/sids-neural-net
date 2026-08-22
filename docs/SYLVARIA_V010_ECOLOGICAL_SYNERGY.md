# Sylvaria v0.10.0: Ecological Synergy

v0.10 begins from the fully qualified **v0.9.1 Forage & Fracture** baseline at `d5c354c3e8c02352851a9ac1e2bcbec5a77d7ae4`. Website CI #602 passed the complete production, four-browser, and combat/ecology gauntlet on that commit.

The purpose of Ecological Synergy is not to add more buttons or another independent combat system. It lets the already-readable Countercut, terrain, forage, fungus, and hazard systems compose into deliberate player-authored chains.

## Protected invariants

The following are release invariants, not balance knobs for v0.10:

- fixed 120 Hz simulation;
- WASD remains discrete cardinal step-dashes;
- exactly one movement command can persist through an active dash and survive key release;
- Arrow Keys remain independent cardinal machete cuts;
- Countercut still matches the projectile's actual arrival side;
- normal and perfect returns remain 840 px/s and 1040 px/s;
- Crosscuts, Long Returns, perfect penetration, counter stagger, heartwood and Perfect Groves remain intact;
- 128 live projectiles and 72 pending projectiles remain hard caps;
- the rapid press/release D → S regression remains mandatory on Chrome Stable, Chromium, Firefox and WebKit.

`movement.js` remains the protected v0.9.1 implementation. Ecological Synergy is layered around its exposed simulation hooks.

## Countercut-authored chain reactions

Environmental reactions should begin with a legible player action rather than autonomous screen noise.

### Returned projectile → mushroom

A friendly reflected projectile may trigger a mushroom it crosses. The return remains alive after the ecological interaction, so the player can compose a mushroom trigger and an enemy hit from one successful Countercut.

The reflected projectile retains its normalized `return` motion. v0.10 stores the original hostile projectile family separately as `originPattern` so ecological systems can respond to where the return came from without restoring hostile movement geometry.

A **wave-origin return** striking a toxic mushroom creates a wider spore bloom. A perfect return adds a smaller additional bloom bonus. These modifiers change the environmental consequence, never the return's protected speed.

Each returned projectile has a bounded ecological-hit count to prevent one projectile from detonating every mushroom in a room.

## Committed spore shear

A toxic gas cloud may be displaced only by a machete cut made during a live committed dash or the existing 85 ms dash-echo window.

The gas moves in the cut direction and receives a small bounded radius/lifetime extension. This creates a spatial verb without creating a generic projectile eraser or a free standing-wind attack.

During Verdant Flow the shear is stronger. The underlying dash distance, dash timing, slash timing, Countercut window, and return speed are unchanged.

## Hazard-aware enemy behavior

v0.10 intentionally avoids a heavyweight navmesh. The arena remains deterministic and small enough for a bounded local hazard heuristic.

`hazardScoreAt(x, y, enemy)` scores nearby:

- brambles and ice shards strongly;
- active toxic gas strongly;
- mud softly for cautious ranged/support enemies.

Cautious archetypes evaluate four short local candidate directions only while in ordinary `move` state. They do not override attack telegraphs, recovery, or committed evade motion.

Cautious set:

- Nailgun Foreman;
- Timber Lobbyist;
- Committee Chair;
- Subsidy Broker;
- Boundary Surveyor.

**Skidder Bruisers are deliberately excluded.** They remain reckless enough to bait through poison, shards, mud, and other denial zones. Enemy intelligence should create personality, not universal self-preservation.

Blink/backstep destination validation additionally rejects active gas clouds. Existing mud/bramble/shard rejection remains intact.

## PAC-a-Saw bulldozing

PAC-a-Saw is an industrial clear-cut machine. It should not politely route around the same light geometry Sprid chops.

When its physical body overlaps deadwood or brittle rubble, the object is destroyed and a clear `INDUSTRIAL BULLDOZE` cue is emitted. This event intentionally bypasses player exploration reward functions:

- no hidden cache pickup;
- no discovery credit;
- no free score or Flow reward.

The destroyed geometry can still alter the arena and manufacture a new route. This makes the boss reshape the fight without rewarding passivity.

PAC-a-Saw's collision radius and attack timing remain unchanged.

## Verdant Flow

Verdant Flow is a short expression state, not a permanent stat tier.

The synergy chain observes successful core events:

- perfect Countercut;
- Crosscut;
- Long Return;
- terrain route;
- environmental hazard finish;
- spore route.

A spore route counts more strongly because it requires setup plus timing. The chain has a short expiration window.

Verdant Flow activates when:

- Flow is at least 75%;
- the current synergy chain reaches at least three points;
- a new qualifying event occurs;
- no Verdant Flow state is already active.

The state lasts 3.6 seconds.

Verdant Flow may amplify **ecological expression**, such as gas shear distance or bloom size. It does not alter protected dash distance, Countercut direction rules, Countercut timing, or 840/1040 return speeds.

Visual language is intentionally compact: rotating leaf strokes around Sprid plus `VERDANT ×N` in the existing Flow HUD slot. No additional meter is introduced.

## Visual priority under chaos

The active canvas is treated as a priority stack rather than every effect competing equally.

### Priority 0: cached world material

Terrain fills, mud ruts, sand contours, water rings, ice glints and static background geometry remain in the cached terrain layer whenever possible.

### Priority 1: soft ecology

Gas, grass sway, mushrooms and pickups remain lower-contrast than attack geometry. Their boundaries remain readable, but they should not become brighter than incoming projectiles.

### Priority 2: enemies and boss state

Enemy silhouettes, locked intents, recovery cues, PAC-a-Saw's chassis, heat state and exhaust are drawn above passive ecology.

### Priority 3: projectile grammar

Hostile projectile shapes retain their family signatures. Friendly returns remain brighter than hostile fire.

### Priority 4: immediate threat

Only one hostile projectile receives the nearest-threat halo. Selection uses closing velocity and approximate time-to-impact, so the highlight answers “what must I read now?” rather than merely “what is closest?”

### Priority 5: Sprid / slash / Verdant state

Sprid, the machete direction, active slash, guard cue and Verdant Flow remain the strongest local player cues.

The v0.10 overlay is drawn after the v0.9.1 renderer so threat, return, Flow and boss-heat communication can be strengthened without changing simulation geometry.

## Performance strategy

Ecological Synergy remains bounded:

- no navmesh or A* grid;
- four local hazard candidates for cautious enemy steering;
- one selected immediate projectile threat;
- returned-shot ecological hits capped per projectile;
- existing projectile caps unchanged;
- existing gas-cloud cap retained;
- existing cached terrain layer retained;
- procedural Canvas 2D, no mandatory WebGL path.

The full four-browser and combat/ecology gauntlets remain mandatory after every simulation-facing change.

## Size profiling and the 13 KiB target

The readable portfolio runtime and a competition package are now treated as separate artifacts.

The current development runtime is deliberately modular, documented and regression-testable. It is **not** currently a 13 KiB competition artifact. v0.9.1 JavaScript modules alone were roughly 82.8 KB raw before the HTML, CSS and rendering helpers.

`scripts/profile-sylvaria-size.mjs` measures:

- raw bytes;
- gzip level 9 bytes;
- Brotli quality 11 bytes;
- per-file contribution;
- aggregate readable-runtime size;
- portfolio payload size including the Game Network bridge;
- distance from a 13 KiB reference cap.

The report is diagnostic, not a false release gate. A future competition pipeline should create a separate flattened/minified/packed artifact, remove portfolio integration, and validate the actual ZIP against the official competition rules at submission time.

Readable source should not be destroyed prematurely merely to make a development folder resemble a submission archive.

## v0.10 qualification contract

Before v0.10 can replace v0.9.1 as the qualified runtime, CI must prove all v0.9.1 invariants plus:

- returned projectiles can deliberately trigger mushrooms;
- wave-origin return state survives normalization only as ecological metadata;
- toxic bloom amplification is bounded;
- committed dash-cut gas shear works and standing cuts do not gain the same verb;
- gas is rejected as evasive destination space;
- cautious enemies reduce local hazard score without changing Skidder behavior;
- PAC-a-Saw bulldozes deadwood/rubble without producing forage rewards;
- Verdant Flow requires real qualifying events and does not modify 840/1040 returns;
- immediate-threat selection produces one readable hostile priority cue;
- all new state remains within the existing projectile/performance budgets;
- the size profiler produces a retained CI artifact.
