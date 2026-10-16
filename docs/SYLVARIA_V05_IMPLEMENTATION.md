# Sylvaria v0.5 — Implementation Contract

## Product identity

**Sylvaria** is the canonical player-facing game name. **Sprid** is the protagonist. **Mossglint** remains the resource and portal-energy language.

The canonical Game Network URL is `/arcade/sylvaria`. `/arcade/mosslight` remains a compatibility alias so existing links do not break. Internal runtime/data names such as `/game-runtimes/mosslight-v2`, `MosslightContent`, `MosslightExpedition`, and `__MOSSLIGHT_PLAYTEST__` remain temporarily stable integration contracts and are not player-facing branding.

Version: **v0.5.0 — Mossglint Run**.

## Core run fantasy

Sprid carries a compact living portal gun whose chamber is powered by Mossglint. Every world in the Nature Atlas is a sealed one-way arena. The player must understand that world's movement grammar, solve its ecological circuits, fight or route around patterned hostile encounters, collect enough Mossglint, fire a charged portal shot into the eastern world anchor, survive the extraction phase, and commit forward through the resulting rift.

The emotional rhythm of a world is:

1. **Arrival** — a new biome and movement problem establishes itself.
2. **Read** — the player identifies puzzle nodes, safe lanes, enemies, moving geometry, gifts, and the eastern anchor.
3. **Solve / survive** — ecological resonance shots solve relationships while the same gun can damage hostile encounters.
4. **Mossglint ready** — puzzle completion plus guardian clearance on boss worlds fills the required Mossglint quota.
5. **Fire gate** — the player deliberately presses the remappable portal-fire action, default `F`.
6. **Extraction** — a neon purple/blue/green rift opens and arena pressure rises briefly.
7. **Commit** — Sprid reaches the live gate and crosses it. The previous world is irreversibly closed for that scored run.

A completed puzzle never opens the gate automatically in v0.5.

## Portal state machine

The gameplay runtime owns an explicit state machine:

`sealed -> ready -> charging -> firing -> open/extraction -> next world`

### `sealed`

- Default world state.
- Eastern anchor is visible but dormant.
- HUD shows Mossglint percentage.
- Entering or interacting with the anchor cannot advance the run.

### `ready`

Requirements:

- all required puzzle nodes solved;
- Mossglint quota met;
- guardian defeated on every tenth world.

Effects:

- HUD changes to `READY · F`;
- dedicated FIRE GATE button becomes active;
- Sprid's gun chamber changes to purple/blue/green gate energy;
- charge-ready chime plays;
- the eastern anchor gains animated ring fragments.

### `charging`

Triggered only by the portal-fire action (`F` by default or the HUD FIRE GATE button).

- Sprid receives a visible charge ring and stronger gun glow;
- a low portal-charge audio pulse plays;
- normal movement remains available;
- the charge interval is intentionally short enough not to interrupt run flow.

### `firing`

- A high-energy Mossglint bolt launches from Sprid toward the eastern anchor.
- The bolt has a multicolor neon trail.
- It homes to the fixed safe anchor pocket so procedural geometry cannot invalidate the transition.
- Anchor impact is what creates the portal.

### `open / extraction`

- The portal becomes a continuous animated rift.
- World threats remain active and receive a small bounded extraction-pressure increase.
- Situation sweeps can arrive more frequently.
- The portal itself remains a visually dominant readable target.
- Enter only commits when Sprid is physically close enough to the live rift.
- Crossing the portal boundary also commits after its short materialization safety window.

### Transition

- The completed world is logged with time, score, and hits.
- A speed bonus is awarded.
- `worldDepth` increments globally.
- After ten loaded templates, the runtime requests the next ten unseen canonical Atlas scenes without resetting score, build, timer, or difficulty.

## 1,000-world structure

The Nature Atlas remains exactly 1,000 scenes.

- Ten unseen Atlas scenes are loaded at a time.
- The persistent deck samples without replacement until all 1,000 are consumed.
- Global run difficulty never resets when the ten mechanic templates repeat.
- Every tenth global world is a guardian arena.
- Crossing all 1,000 records an Atlas Clear and awards a large milestone bonus.
- The run may continue into a deeper shuffled loop after world 1,000.

The long-term challenge is therefore measurable: can a player actually traverse all 1,000 Sylvarian worlds in one scored expedition?

## Canonical controls

Defaults:

- `W A S D` — move Sprid
- `Mouse` — free aim
- `Arrow Keys` — independent laptop-friendly aim
- `Click / Space` — fire selected ecological resonance
- `Shift` — dash
- `Q / E` — cycle unlocked resonances
- `1–6` — direct resonance select
- `F` — fire the charged gate once Mossglint is aligned
- `Enter` — commit through an open gate when physically near it
- `P` — pause

Every keyboard action, including `F` and `Enter`, is remappable. Preferences persist locally. v0.5 migrates prior v0.4 settings when possible.

## Portal gun

The six resonance channels remain:

- Rain
- Sun
- Seed
- Wind
- Mend
- Gather

They are simultaneously ecological puzzle verbs and combat projectiles.

Persistent world gifts continue to modify the same weapon and movement model:

- **Rapid Bloom** — faster fire cadence
- **Giant Dew** — larger projectiles
- **Prism Spores** — three-shot fan
- **River Echo** — projectile piercing
- **Sunstep** — movement and dash recharge
- **Moss Ward** — renewable protection

The portal gate is deliberately a separate action from those six resonances so finishing a world has a distinct climax rather than feeling like one more ordinary shot.

## Sprid v2 visual language

The v0.5 procedural renderer moves Sprid toward the supplied concept-art direction while staying lightweight enough for a 960×640 browser canvas.

Sprid now reads as a character rather than an orb:

- luminous moss-green core;
- bright directional eyes and a small face;
- asymmetric living moss / leaf crown;
- root-like legs with walk movement;
- ground shadow;
- dash deformation;
- visible recoil;
- clearly separated portal gun;
- illuminated gun chamber showing progression toward gate-ready state;
- purple/blue/green motes orbit Sprid when the gate shot is ready.

The goal is not photorealistic concept art at runtime. The goal is to preserve the references' silhouette, material language, bioluminescence, and portal-tech contrast at real gameplay scale.

## World visual language

The supplied reference imagery establishes the visual north star: detailed bioluminescent environments, moss and roots, luminous fungi, cavernous depth, magical technology, icy voids, reefs, glowing portal anchors, and strongly separated traversal surfaces.

The runtime uses Atlas metadata to generate different treatments instead of displaying one static background behind incompatible collision geometry.

Current broad rendering families include:

- **forest / garden / meadow** — living root silhouettes, green canopy energy, organic barriers;
- **reef / wetland / river / shore** — layered water bands and cyan bioluminescence;
- **ice / snow / mountain** — crystalline ridgelines and cold luminous accents;
- **desert / canyon / volcanic** — warm carved silhouettes and ember lighting;
- **celestial / anomalous** — star-like particles, glow fields, and cooler void depth.

Atlas atmosphere, palette, terrain, focal subject, render cues, sparkle, wildlife, and depth continue to influence the generated world.

## Neon gate rendering

The open extraction portal uses a signature palette:

- violet / purple `#9b5cff`
- cyan / blue `#52d9ff`
- Mossglint green `#79ff9a`
- deep electric blue `#6f73ff`

It is composed from multiple inexpensive 2D effects:

- dark radial inner membrane;
- several independently rotating broken rings;
- additive orbiting particles;
- breathing scale modulation;
- glow and bloom from Canvas shadow blur;
- multicolor gate-shot trail;
- separate sealed / ready / charging / firing / open visual states.

Reduced-motion mode disables decorative UI pulsing while keeping essential gameplay telegraphs.

## Encounter and arena model

Hostile movement grammars remain:

- patrol
- weave
- orbit
- swoop
- stalk
- telegraphed dash
- spiral

The Director prevents unnecessary repetition inside a room and across a ten-world sector.

Situation grammars remain:

- tidal lanes
- living corridors
- heat crossings
- alpine switchbacks
- orbital dances
- weather windows
- migration paths
- Earthheart convergence

During extraction, these systems are intentionally intensified only slightly. The portal should create a short climax, not a random death trap after the player has already solved the room.

## Guardians

Every tenth global world still requires a guardian defeat before the gate can become ready.

Current guardian identities include Rootwarden, Tideglass Ray, Cinder Hart, Frosthorn, Astral Moth, Storm Heron, Wayfinder Stag, and Atlas Warden.

v0.5 adds visible hostile guardian volleys to make boss pressure more legible and more distinct from normal contact-only encounters. Guardian rewards remain two required Mossglint stones, score, and a persistent world gift.

## Audio

`SylvariaMusic` remains synthesized with WebAudio so the runtime does not need heavy external audio assets.

The score:

- derives tonal material from the active Atlas seed;
- gradually increases BPM with global depth under a hard cap;
- adds a stronger layer during guardian worlds;
- preserves separate music and SFX buses.

v0.5 adds specific portal cues:

- Mossglint-ready chime;
- low gate-charge pulse;
- gate-shot discharge;
- multitone portal-open shimmer;
- run-collapse sound;
- Atlas-clear cue.

## Accessibility / UX

- Explorer mode remains available for learning.
- Aim assistance is optional.
- Mouse and arrow aim are both first-class.
- Controls are remappable.
- Reduced motion is available.
- Portal state is represented redundantly through HUD text, button state, Sprid's gun, anchor animation, world toast, and sound rather than relying on color alone.
- The procedural preflight reserves both the spawn pocket and portal pocket before each sector becomes playable.

## Browser / performance contract

Release CI must validate Sylvaria in:

- Google Chrome Stable
- Playwright Chromium
- Firefox
- WebKit

The four-browser matrix must prove:

- runtime iframe attachment and native focus bridge;
- nonblank canvas rendering;
- WASD movement;
- arrow-key + Space firing;
- canonical runtime identity `Sylvaria / 0.5.0`;
- puzzle completion produces `ready`, not an automatically open portal;
- a real `F` keypress fires the portal sequence;
- the runtime reaches the open extraction phase.

The dedicated Sylvaria playtest additionally verifies mouse correctness, keyboard-assisted puzzle correctness, guardian lock behavior, portal-shot counting, one-way advancement, depth-300 scaling, persistent unseen Atlas sectors, and the FPS floor.

The bounded requestAnimationFrame fallback remains in place for throttled WebKit iframes.

## Compatibility boundaries

The following internal names remain intentionally stable in v0.5 so the visual/gameplay rewrite does not break deployed URLs and test integrations:

- `/game-runtimes/mosslight-v2/*`
- `/game-runtimes/mosslight-atlas`
- `window.MosslightContent`
- `window.MosslightExpedition`
- `window.MosslightDirector`
- `window.MosslightArenaPreflight`
- `window.__MOSSLIGHT_PLAYTEST__`

They are implementation details, not player-facing product names. A later low-risk migration may rename these after Sylvaria v0.5 is stable.

## Competitive layer after v0.5 stability

The next major subsystem is the public run leaderboard already planned for Sylvaria:

- public username;
- private email only if needed for verification/recovery;
- deepest world;
- score;
- run duration;
- Atlas-clear count;
- validated run submissions rather than trusting arbitrary client score payloads;
- eventual daily seeded runs and per-world split/replay data.

That server-backed layer should ship after the v0.5 portal/extraction mechanics are green across production browsers.
