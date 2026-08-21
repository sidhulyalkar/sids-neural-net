# Mosslight v0.4 — Mossglint Run

## The premise

Sprig carries a small portal gun whose core is powered by **Mossglint**, a mineral that forms only when a damaged ecological relationship is repaired.

Every Nature Atlas world is a sealed one-way arena. To leave it, the player must:

1. **Read** the arena and its movement grammar.
2. **Solve** the ecological puzzle nodes with the correct portal-gun resonances.
3. **Fight or route around** hostile encounters while completing the room.
4. **Condense enough Mossglint stones** to charge the gun.
5. **Defeat the guardian** on every tenth world.
6. **Commit through the eastern portal.** The previous world closes permanently.

The game is therefore about speed, spatial reading, route choice, mechanical execution, and adapting a persistent build over a very long run.

## Run structure

- A scored run starts at global depth 1.
- The canonical Nature Atlas contains 1,000 worlds.
- The existing ten authored rooms remain reusable **mechanic templates**, not a ten-room campaign.
- Ten unseen Atlas worlds are loaded at a time from the persistent without-replacement deck.
- After world 10, the runtime requests the next ten unseen worlds and continues with the same score, timer, upgrades, and global difficulty.
- Every tenth world is a guardian arena.
- Crossing world 1,000 records an **Atlas Clear** milestone and awards a large score bonus.
- The run may continue into a deeper Atlas loop after 1,000, so the game does not need a hard ending.

## Mossglint economy

Each completed puzzle node yields one Mossglint stone.

Normal worlds require one stone per puzzle node. Guardian worlds require the puzzle stones plus two guardian stones. The exit portal opens only when all three conditions are true:

- every required arena puzzle is solved;
- the Mossglint quota is met;
- the guardian is defeated, if the world is a guardian world.

The portal appears on the east edge. Entering it is irreversible during a scored run.

## Portal gun

The gun has six ecological resonances. They are simultaneously puzzle verbs and combat projectiles:

- **Rain**
- **Sun**
- **Seed**
- **Wind**
- **Mend**
- **Gather**

Mouse aim and independent arrow-key aim are equally supported. WASD movement can therefore be combined with arrow-key aiming as a laptop twin-stick layout.

### Default controls

- WASD: move
- Arrow keys: aim
- Mouse: free aim
- Click / Space: fire
- Shift: dash
- Q / E: cycle resonance
- 1–6: direct resonance select
- Enter: enter charged portal
- P: pause

Every keyboard action above can be remapped in-game and is persisted locally.

## Arena language

Atlas metadata proposes a natural movement problem, while the Director enforces novelty budgets so a forest-heavy run does not become ten near-identical forest corridors.

Situation grammars include:

- tidal lanes
- living corridors
- heat crossings
- alpine switchbacks
- orbital dances
- weather windows
- migration paths
- Earthheart convergence

The room can combine:

- static and moving geometry;
- predictable environmental fronts;
- telegraphed sweep lanes;
- moving puzzle targets;
- hostile wildlife encounters;
- guardian patterns.

The objective is readable difficulty. A skilled player should fail because they chose a poor route or mistimed a movement, not because the canvas became visual noise.

## Hostile encounter movement

Encounter agents use distinct grammars:

- patrol
- weave
- orbit
- swoop
- stalk
- telegraphed dash
- spiral

The Director avoids duplicating the same encounter grammar repeatedly inside a late room where alternatives are available.

The portal gun damages encounters. Defeating them awards score, but ordinary encounters are not part of the portal requirement. This preserves an important speed-running decision: **fight for safety and points, or route around them to save time.**

## Guardians

Every tenth world spawns a guardian themed from the active Atlas situation. Current guardian identities include:

- Rootwarden
- Tideglass Ray
- Cinder Hart
- Frosthorn
- Astral Moth
- Storm Heron
- Wayfinder Stag
- Atlas Warden

Guardians have capped health scaling and increasingly dense pattern cadence. Difficulty should grow primarily through pattern combinations and decision pressure rather than endlessly inflating hit points.

Defeating a guardian:

- awards two required Mossglint stones;
- awards a large score bonus;
- grants a persistent world gift.

## Persistent build system

World gifts last for the full run:

- **Rapid Bloom** — faster fire cadence
- **Giant Dew** — larger projectiles
- **Prism Spores** — three-shot fan
- **River Echo** — projectile piercing
- **Sunstep** — movement and dash recharge
- **Moss Ward** — renewable protection

This means a 100-world run develops a mechanical identity rather than feeling like 100 isolated rooms.

## Difficulty model

Global run depth never resets when the ten mechanic templates cycle.

Difficulty uses bounded logarithmic/natural growth rather than an uncapped speed multiplier. Deeper runs introduce pressure through:

- more simultaneous encounter agents, capped for readability;
- shorter but still readable telegraphs;
- more frequent arena situation pulses;
- guardian cadence;
- higher but capped enemy durability;
- overlapping movement grammars;
- increasingly valuable routing decisions.

Depth 300 must therefore be measurably harder than depth 3, while remaining physically playable on the same 960×640 arena.

## Score

Score rewards:

- correct puzzle chains;
- fast puzzle completion;
- Mossglint formation;
- hostile encounter defeats;
- guardian defeats;
- fast portal exits;
- Atlas Clear milestones.

Taking damage breaks chains and threatens the run. A scored run currently has three stability charges. Explorer mode provides a more forgiving learning path and automatically recovers after collapse.

## Audio

Mosslight uses a custom WebAudio score rather than external music assets.

The music engine:

- derives its tonal center from the current Atlas scene seed;
- gradually increases BPM with run depth under a hard cap;
- adds a guardian layer during boss encounters;
- uses separate music and SFX buses;
- persists music, SFX, and master-volume preferences.

This keeps audio lightweight, original, and reactive across all 1,000 worlds.

## Browser / performance contract

The runtime retains the bounded animation-frame fallback added for WebKit iframe throttling.

Release CI must validate the Game Network in:

- Google Chrome Stable
- Playwright Chromium
- Firefox
- WebKit

Mosslight-specific playtesting additionally verifies portal gating, guardian locks, dual mouse/keyboard aiming, persistent unseen Atlas sectors, deeper-world encounter scaling, and the FPS floor.

## Next systems after v0.4 stabilizes

1. Public username leaderboard backed by durable server storage.
2. Signed/validated run submissions rather than trusting client score payloads.
3. Daily seeded run shared by every player.
4. Guardian-specific arena geometry and bespoke phase changes.
5. More puzzle families that alter traversal rather than only target sequences.
6. Ghost/replay data for top runs if payload size remains practical.
7. Run history and per-world split times for speed-running analysis.
