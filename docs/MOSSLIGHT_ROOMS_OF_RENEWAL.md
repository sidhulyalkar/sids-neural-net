# Mosslight: Rooms of Renewal

## One-line pitch

**A fast, fluid top-down action-puzzle game where nothing is defeated and every room is a small living system to understand, repair, and set free.**

The room-unlock cadence is intentionally readable and arcade-like, but the ruleset is original: the player's directional shots are ecological interventions rather than weapons. The satisfying part is learning causal chains quickly enough to turn a stressed biome into a thriving one.

## v0.1 implementation status

The first playable runtime is implemented at `/game-runtimes/mosslight/index.html` and registered in the site's Arcade. CI compiles the embedded JavaScript before release and checks the authored campaign contract: ten named rooms, six restoration abilities, moving storm-cloud encounters, river sluices, restoration targets, and environmental stress fronts. Browser fixtures exercise both the standalone runtime and the neural Arcade chamber.

## Design pillars

1. **Action-game hands, puzzle-game brain.** Movement should feel immediate, smooth, and expressive. The player independently aims and fires restoration abilities while accelerating, drifting, and dashing through a room.
2. **Cause and effect over checklist gardening.** Rain alone is rarely enough. A dry flower may need rain, seed, then sun. A rescued animal may need healing and food. A river needs its gates pointed correctly before it can reach a basin.
3. **Every room changes the visual grammar.** Orchard, wetland, cloud meadow, burn scar, pollinator conservatory, alpine thaw, tidal nursery, and the final Earthheart should feel like separate miniature worlds.
4. **No combat reskin.** There are hazards and pressure, but no enemies to kill. Stress fronts, smoke, heat, current, and thorns disrupt movement and break combo chains. Progress comes from restoration.
5. **Readable mastery.** New players can follow the need icons above organisms. Strong players optimize route, ability order, aim, dash timing, chain multiplier, and room completion time.

## Control model

- `WASD`: move with acceleration and drag, not grid stepping.
- Mouse: independent aim.
- Left mouse: cast selected ability.
- Arrow keys: keyboard aim fallback.
- `Space`: keyboard cast fallback.
- `Shift`: dash in movement direction or aim direction if stationary.
- `1-6`: select restoration abilities.
- `Q/E`: cycle unlocked abilities.
- `R`: restart current room.
- `P`: pause.

Movement target:

- 60 Hz fixed-feel simulation on a requestAnimationFrame clock.
- Normalized diagonal input.
- High acceleration, soft drag, capped velocity.
- Short impulse dash with cooldown and visible recovery ring.
- Projectiles travel quickly enough to support directional skill rather than point-and-click waiting.

## Restoration abilities

| Key | Ability | Primary uses |
| --- | --- | --- |
| 1 | Rain | water plants, cool embers, fill channels, melt-flow follow-up |
| 2 | Sun | bloom watered plants, thaw ice, wake growth, finish storm cycles |
| 3 | Seed | repopulate soil, grow roots, stabilize banks, begin habitat recovery |
| 4 | Wind | push miniature storm clouds, clear smoke, carry pollen, steer moving weather |
| 5 | Mend | heal animals, coral, damaged trees, and stressed habitat nodes |
| 6 | Gather | pick fruit/seed resources and feed recovered animals |

Abilities consume a small amount of **Harmony**, which regenerates quickly. Correct ecological actions partially refund Harmony and extend a combo chain. Repeatedly firing random abilities is slower than reading the room.

## Core object grammar

Most targets expose a short restoration sequence, for example:

- Dry flower: `Rain → Seed → Sun`
- Fruit tree: `Rain → Sun → Gather`
- Injured animal: `Mend → Gather` (Gather consumes one collected fruit)
- Burn scar: `Rain → Wind → Seed → Sun`
- Pollinator patch: `Rain → Sun → Wind`
- Ice spring: `Sun → Rain → Seed`
- Coral nursery: `Mend → Rain → Sun`

Two objects deliberately break the simple sequence grammar:

### Drifting storm clouds

Wind shots physically push a cloud through the room. Rain only advances it once the cloud is inside its marked dry basin. The player therefore has to aim while moving, not simply select the right icon.

### River sluices

Rain/current shots rotate a small gate. The channel visibly changes direction. The gate completes only when its orientation matches the room's required route.

These two mechanics keep later rooms from collapsing into a sequence-matching quiz.

## Pressure without violence

Rooms can contain moving **stress fronts**: smoke wisps, heat motes, thorn pulses, turbulent current, or cold gusts. Contact:

- knocks the player back,
- removes Harmony,
- breaks the current chain,
- increments a stress-hit counter,
- never causes death or a hard reset.

As restoration percentage rises, stress fronts become dimmer and calmer. The room literally feels easier because the ecology is stabilizing.

## Room campaign

### 1. Dew Garden
**Teaches:** movement, directional casting, Rain, Sun.

Water and wake three thirsty plants. The first room is generous and nearly hazard-free.

### 2. Orchard House
**Unlocks:** Seed, Gather.

Restore fruit trees, grow a bare patch, collect fruit, and learn that completing a habitat can create resources for later organisms.

### 3. Rescue Hollow
**Unlocks:** Mend.

Heal an injured fox, owl, and deer, then feed recovered animals using gathered fruit. Animal targets wander slightly, introducing lead-aiming.

### 4. River Workshop
**Unlocks:** Wind.

Rotate river sluices and restore riparian plants. The room is a hydrology puzzle embedded inside action movement.

### 5. Cloud Meadow

Push miniature clouds across the map with Wind, position them over dry basins, trigger Rain, then finish with Sun. This is the first strongly spatial weather room.

### 6. Emberstep

Cool embers, push smoke away, reseed blackened ground, and provide sunlight. Moving heat fronts reward dashing and route planning.

### 7. Pollinator Conservatory

Bloom flowers and use Wind to carry pollen through the room. Dense plant geometry creates a movement maze without turning plants into walls everywhere.

### 8. Alpine Thaw

Use Sun to open frozen springs, Rain/current to carry meltwater, Seed to restore alpine flowers, and Mend to recover a mountain animal.

### 9. Tide Nursery

Restore mangroves, seagrass, and coral while navigating rhythmic current hazards. The visual field shifts toward moonlit teal water and tidal pulses.

### 10. Earthheart

A final mixed-system room using all six abilities. A cloud must be positioned, water routed, a grove restored, fruit gathered, wildlife healed and fed, and the central habitat node mended. The final door opens only when the whole causal chain is healthy.

## Progression and scoring

Each room awards a restoration grade based on:

- completion time,
- ecological chain multiplier,
- stress hits,
- wasted casts,
- optional habitat nodes.

The first version tracks campaign time, best chain, casts, correct actions, stress hits, and fruit gathered. A later version can persist best grades locally without requiring an account.

## Visual language

The runtime is procedural Canvas so it loads instantly inside the portfolio Arcade.

- Soft organic room silhouettes over crisp geometric boundaries.
- Ability projectiles have unique trail shapes rather than just recolors.
- Need icons float above targets for immediate readability.
- Correct actions produce expanding rings, leaf/seed/rain particles, and pitch-shifted chimes.
- Completed organisms become visibly richer: brighter foliage, fruit, bloom petals, calm animal halos, moving water.
- A subtle parallax offset follows player velocity to keep fixed-screen rooms from feeling static.
- Each room owns a distinct palette, floor pattern, decor family, hazard style, and ambient particle field.

## Audio

No downloaded audio assets are required. The game uses Web Audio oscillators and filtered noise for:

- restoration pings,
- combo steps,
- room-complete chords,
- dash transients,
- rain/wind texture,
- low stress-contact thumps.

Audio begins only after user interaction.

## Portfolio integration

Mosslight ships as a self-contained browser runtime at:

`/game-runtimes/mosslight/index.html`

It is registered as a first-class playable title in `/arcade`, so it inherits the neural play chamber, focus mode, fullscreen path, reload control, and surrounding dendritic geometry.

## Originality boundary

The inspiration is the satisfying cadence of entering a compact room, understanding what it asks, restoring it, and unlocking the next space. Mosslight does **not** reuse the referenced game's story, characters, art, level layouts, source, rules, dialogue, or planting-only objective. Its mechanical identity is independent aiming, ecological ability chains, weather physics, hydrology, animal care, gathering/feeding, nonlethal pressure, and biome-specific causal puzzles.

## Definition of done for v0.1

- 10 distinct playable rooms.
- 6 unlockable abilities.
- Mouse and keyboard directional firing.
- Smooth accelerated movement + dash.
- Sequence targets, moving clouds, river sluices, wandering animals.
- Fruit inventory and feeding dependency.
- Stress hazards without death.
- Room unlock/transition flow.
- Campaign completion screen and run stats.
- Procedural visual/audio feedback.
- Arcade catalog/chamber integration.
- CI route smoke and browser fixture.
