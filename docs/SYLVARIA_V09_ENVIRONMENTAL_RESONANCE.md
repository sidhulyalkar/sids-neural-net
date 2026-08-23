# Sylvaria v0.9.1: Environmental Resonance · Forage & Fracture

v0.9.1 turns the arena into a small tactical ecology without replacing Countercut. Terrain, destructible vegetation, rubble, temporary forage, mushrooms, and industrial hazards create reasons to explore while enemies are still alive. Every new system is subordinate to the existing eight-key spatial grammar.

## Protected Countercut invariants

These contracts remain unchanged:

- fixed **120 Hz** simulation;
- WASD produces discrete cardinal step-dashes;
- one additional movement command can persist through the active dash and key release;
- Arrow Keys create independent cardinal machete cuts;
- a Countercut succeeds only when the cut matches the projectile's actual arrival side and intersects the slash;
- hostile nonlinear motion is normalized after reflection;
- normal returns travel at approximately **840 px/s** and perfect returns at **1040 px/s**;
- Crosscuts, Long Returns, perfect penetration, counter stagger, Flow, living-tree defense, and Perfect Groves remain intact;
- live projectile and pending-volley caps remain **128 / 72**.

Exploration adds choices, not controls.

## Modular runtime

The production runtime is split into a single deterministic simulation graph:

`model.js → world.js → movement.js → battle-core.js → render.js → boot.js`

`movement.js` owns the fragile persistent queue, dash commitment, slash geometry, ice fracture, and Countercut behavior. `battle-core.js` owns projectiles, enemy AI, evasion, and PAC-a-Saw. This isolates the mechanics most likely to regress while keeping one browser-visible state.

## Shared terrain matrix

All grounded actors use the same `terrainAt()` / `mobilityAt()` sampler.

| Terrain | Mechanical rule | Tactical use |
| --- | --- | --- |
| Ice | extends movement commitment | glide through a firing lane while reading the next arrival side |
| Mud | heavy drag | trap ranged enemies and compress blink/backstep options |
| Sand | moderate drag | disrupt charges and create committed routing |
| Water | modest drag | slower readable lanes |
| Brambles | symmetric damage/stagger | Countercut knockback target |
| Tall grass | light drag, destructible | sightline shaping and hidden forage |
| Ice shards | strong drag plus damage/stagger | hazard created by contextual dash-cut fracture |

Mud, brambles, and shards are rejected as safe evade destinations. If no legal route remains, the enemy enters a brief recovery state and exposes an `ESCAPE JAMMED` tell.

## Dash-cut ice fracture repair

The live fracture bug was caused by interaction timing around dash completion. v0.9.1 resolves the interaction when the cut is created rather than relying on a later terrain poll.

A cut can fracture ice when either:

1. Sprid is currently in a committed dash and that dash segment intersects the patch, or
2. the cut occurs during an **85 ms post-dash echo window** and the just-completed dash segment crossed the ice.

The original ice patch is deactivated and replaced by an explicit `shards` patch. Standing cuts still cannot arbitrarily rewrite terrain.

## Laboratory enemy-drag proof

The playtest API includes `labEnemyTravel(type, surface, duration)`. The fixture removes living trees, deadwood, rubble, foliage, mushrooms, projectiles, and other collision noise, places the same enemy at the same coordinates, and repeatedly calls the production `moveToward()` function at the production 120 Hz timestep.

This allows a direct ground-versus-mud displacement ratio instead of inferring drag inside an authored room.

## Centralized hazard bookkeeping

Environmental damage now uses the same authoritative damage/death functions as direct combat:

- `damageEnemy()` → `resolveEnemyDeath()`;
- `damageBoss()` → `updateBossPhases()` / `resolveBossDeath()`;
- `damagePlayer()` includes Barkguard interception;
- `applyTerrainHazard()` and toxic gas call those same functions rather than mutating HP directly.

As a result, bramble, shard, and spore kills correctly increment kills, hazard kills, score, Flow, boss phase transitions, and death state.

## Forest chemistry and exploration rewards

Exploration rewards are deterministic, temporary, and bounded. The game does not become a permanent-stat loot loop.

### Hidden forage

Fully clearing a grass patch, chopping deadwood, or breaking brittle rubble can reveal a deterministic cache. Discoveries build a short exploration chain that pays small score/Flow bonuses while encouraging continued movement through the arena.

Available field finds:

- **Heartleaf**: restores one heartwood;
- **Rush Resin**: temporary faster held-dash cadence plus a restrained dash-length bonus;
- **Barkguard**: blocks the next incoming hit;
- **Edge Stone**: temporarily extends machete reach;
- **Flow Sap**: restores Flow.

Pickups expire if ignored, keeping the decision tactical rather than encouraging post-combat vacuuming.

### Mushrooms

Mushroom caps use strong procedural color/spot signatures and require only the normal machete cut.

Beneficial caps release a corresponding field find. Toxic caps behave differently:

- **Venomcap** emits yellow-green poison spores;
- **Ghostcap** emits a wider uncanny spore cloud.

The gas is a **symmetric hazard**. It can hurt Sprid, ordinary enemies, and PAC-a-Saw. Triggering a dangerous mushroom while an enemy is inside the cloud is therefore a routing tactic rather than a free reward.

## First-ten ecology curriculum

1. **Trailhead Trespass**: clean movement, grass, first hidden Heartleaf.
2. **Nailgun Nursery**: open return lanes, deadwood caches, first Rush Resin.
3. **Red Tape Ravine**: mud plus safe restorative/guard fungi.
4. **Skidder Switchback**: sand and the first Venomcap lesson.
5. **Sawdisc Wetland**: water, ice, Edgecap, and live dash-cut fracture.
6. **Committee Canopy**: dense grass, guard forage, and deceptive Ghostcap risk.
7. **Subsidy Grove**: blink trapping, brambles, reach buffs, and poisonous routing.
8. **Clearcut Conveyor**: rubble reshaping, artillery, caches, and Venomcaps.
9. **Four-Way Firebreak**: full terrain + forest chemistry fluency.
10. **PAC-a-Saw Summit**: readable center, hazardous rim, tactical forage, and industrial boss telegraphs.

Deep rooms deterministically remix bounded terrain, mushrooms, reward caches, enemy roles, and barriers while preserving projectile readability.

## PAC-a-Saw visual and anticipation upgrade

PAC-a-Saw now reads as an industrial clear-cut machine rather than a large generic body:

- twin procedural spinning saws;
- bright metallic leading-edge sheen so the rotating threat remains visually obvious;
- tracked chassis and heavy central housing;
- dual exhaust stacks;
- a continuous heat state tied to phase and attack activity;
- steam/spark exhaust particles emitted during telegraphs;
- faster exhaust cadence in phase three;
- heat-colored anticipation rings before major volleys.

This visual state never changes its hitbox or attack timing. It communicates the existing simulation more clearly.

## Material rendering

Sylvaria stays on procedural **Canvas 2D** rather than adding sprite sheets or a WebGL-only renderer. Static terrain is cached on a 960×640 background canvas. Dynamic objects remain on the active layer.

Material identity comes from shape language:

- ice uses directional glints and fracture lines;
- mud uses ruts and viscous marks;
- sand uses contour arcs;
- water uses ripple ellipses;
- brambles use thorn silhouettes;
- shards use bright angular geometry;
- grass sways until cut;
- toxic fungi carry luminous warning rings;
- returned projectiles remain brighter than all terrain ornament.

## Performance envelope

- 120 Hz fixed simulation;
- 128 live projectiles;
- 72 scheduled projectiles;
- 300 bounded particles;
- at most 10 gas clouds;
- at most 24 active forage pickups;
- cached static terrain;
- bounded enemy afterimages;
- deterministic layout and cache generation;
- no external sprite/texture payload;
- no mandatory WebGL context.

## v0.9.1 validation contract

Static and browser validation must prove all prior Countercut invariants plus:

- canonical modular production wiring;
- shared terrain mobility for player, ordinary enemies, Skidder charges, and evade planning;
- blocker-free enemy mud-drag measurement through production `moveToward()`;
- live dash-cut ice fracture and post-dash echo behavior;
- centralized environmental enemy/boss bookkeeping;
- grass/deadwood/rubble exploration caches;
- Heartleaf, Rush Resin, Barkguard, Edge Stone, and Flow Sap effects;
- safe and toxic mushroom types;
- symmetric poison gas;
- cached material rendering;
- industrial PAC-a-Saw silhouette, high-contrast saw edges, heat, and exhaust anticipation;
- unchanged 128/72 projectile caps and persistent movement queue.

The four-browser matrix continues to run **Chrome Stable, Chromium, Firefox, and WebKit**. The rapid press-and-release D → S queue test remains unchanged: S must enter the persistent queue, survive key release, execute after the first committed dash, drain cleanly, and coexist with an independent Arrow-key cut.

The dedicated combat/environment gauntlet must additionally measure terrain physics numerically and exercise real ice fracture, forage, toxic gas, environmental kills, and boss hazard phase transitions rather than accepting static feature presence.
