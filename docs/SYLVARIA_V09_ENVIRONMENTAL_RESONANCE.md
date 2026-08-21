# Sylvaria v0.9.0: Environmental Resonance

Environmental Resonance extends Countercut without replacing it. Terrain is a deterministic combat system that changes spacing, route quality, and evasion safety while preserving the v0.8.2 input and counter grammar.

## Protected Countercut invariants

The following contracts are intentionally unchanged:

- fixed 120 Hz combat simulation;
- WASD produces discrete cardinal step-dashes, never analog drift;
- one additional movement command can remain queued through the active dash and survives key release;
- Arrow Keys produce independent cardinal machete cuts;
- a projectile counter succeeds only when the cut matches its actual arrival side and physically intersects the slash;
- hostile nonlinear motion is removed after a counter;
- normal reflected speed is approximately 840 px/s and a perfect return is approximately 1040 px/s;
- Crosscuts, Long Returns, perfect penetration, and counter-stagger remain part of the reward loop;
- 128 live shots and 72 pending shots remain hard performance caps;
- living trees, deadwood, persistent heartwood, Perfect Groves, Flow, and PAC-a-Saw remain run-level systems.

Terrain is therefore another spatial input to the existing combat problem, not a replacement movement engine.

## Shared terrain matrix

Every grounded actor queries the same `mobilityAt(x, y)` function. Player dashes, ordinary enemy movement, Skidder charges, and evade planning all derive their terrain behavior from the same deterministic patches.

| Terrain | Sprid | Enemies | Tactical purpose |
| --- | --- | --- | --- |
| Ice | longer commitment and glide | increased mobility while grounded | creates risky long movement windows for projectile reading |
| Mud | sharply shortened movement and repeat cadence | sharply reduced movement and escape range | trap ranged units and spoil backsteps/blinks |
| Sand | moderate drag | moderate drag | makes charge and flank routing deliberate |
| Shallow water | modest drag | modest drag | readable slow lanes and projectile wakes |
| Brambles | slower movement plus stagger/damage | same hazard | hard-denial pocket for reflected knockback |
| Tall grass | slight drag and visual cover | same footing | destructible soft scenery and sightline shaping |
| Ice shards | strong drag plus stagger/damage | same hazard | contextual terrain transformation after an ice fracture |

Mud, brambles, and ice shards are rejected as safe blink/backstep destinations. An evasive enemy caught without a safe route enters a brief recovery state rather than teleporting through a hazard.

## Environmental Countercut routing

Returned projectiles preserve the v0.8.2 targeting rules. The environment adds a second spatial reward layer:

1. A reflected hit applies controlled knockback.
2. If that knockback moves the target from safe ground into brambles or ice shards, the game records a `TERRAIN ROUTE`.
3. The hazard immediately applies its normal symmetric effect.
4. The reflected projectile still receives its ordinary Crosscut, Long Return, penetration, and distance rewards.

This allows one decision to compose several systems without introducing a new attack button.

## Destructible forest feel

### Tall grass

Grass patches generate lightweight procedural blades. A normal machete cut can remove individual blades, producing small particles and a modest Flow/score reward when a cut clears several at once. Grass is intentionally soft scenery rather than a physical blocker.

### Deadwood

Deadwood remains a two-hit physical blocker from Countercut v0.8.2.

### Brittle root / stone barriers

Brittle barriers are physical route geometry with two hit points. They can be opened by repeated machete cuts or by a reflected projectile. A Countercut break awards extra score because the player used incoming pressure to manufacture a route.

### Ice fracture

A normal standing cut does not rewrite terrain. A precisely timed cut during a committed dash can fracture an ice patch near the blade into an ice-shard hazard. The transformation is contextual and bounded so the machete does not become a universal projectile or terrain eraser.

Sand clouds that cancel projectiles are deliberately deferred. They would weaken arrival-side reading if ordinary melee could cheaply remove hostile fire. If added later, they should require a similarly committed contextual action and a narrow interception window.

## Authored first-ten terrain curriculum

1. **Trailhead Trespass**: nearly clean footing with harmless tall grass.
2. **Nailgun Nursery**: open lanes for learning reflected speed and distance.
3. **Red Tape Ravine**: mud banks introduce shared high drag.
4. **Skidder Switchback**: sand teaches charge routing through drag.
5. **Sawdisc Wetland**: water and ice contrast short and long commitments.
6. **Committee Canopy**: tall grass plus one mud trap supports sightline shaping and support pursuit.
7. **Subsidy Grove**: mud, brambles, and grass explicitly challenge blink safety.
8. **Clearcut Conveyor**: brambles, sand, and brittle barriers turn Mulcher artillery into route pressure.
9. **Four-Way Firebreak**: mixed ice, mud, brambles, grass, and breakable geometry tests full environmental fluency.
10. **PAC-a-Saw Summit**: a relatively readable center with a more dangerous terrain rim makes boss knockback and long Countercuts tactically meaningful.

After room ten, deterministic seeded rooms choose a bounded mix of terrain families, enemy roles, support density, and route barriers. Hazard density is kept below the point where the four-direction projectile grammar becomes visually ambiguous.

## Visual Resonance

v0.9 keeps the renderer procedural rather than moving to sprite sheets or a WebGL-only shader path.

### Why Canvas 2D

- no new asset download or texture atlas budget;
- deterministic silhouettes and terrain across every seeded room;
- one rendering path across Chrome, Firefox, and Safari/WebKit;
- easy alignment between visual cues and simulation geometry;
- lower regression risk after the four-browser movement work;
- enough graphical expressiveness for the current top-down scale.

### Cached terrain layer

Static room gradient and terrain patches are painted once into a 960x640 terrain canvas. The active canvas draws only living geometry and interaction state:

- trees;
- grass sway;
- Sprid;
- enemies and afterimages;
- projectiles and trails;
- slashes;
- particles;
- telegraphs and recovery rings.

The terrain cache is rebuilt only when the room changes or a persistent terrain mutation such as ice fracture occurs.

### Character silhouettes and combat states

Sprid and the enemy roster use procedural path silhouettes rather than anonymous circles. Enemy-specific tools and chassis are visible at combat scale. Locomotion is expressed through low-cost body motion, while attack anticipation, recoil, blink ghosts, backstep afterimages, and recovery rings communicate state without changing any hitbox.

Projectile families retain distinct visual signatures for straight, zigzag, wave, spiral, swerve, wobble, and return fire. Bright returned projectiles remain visually dominant over decorative terrain.

## Performance budget

- 120 Hz fixed simulation;
- at most 128 live projectiles;
- at most 72 scheduled projectiles;
- at most 280 particles;
- cached static terrain layer;
- no sprite sheets or external texture assets;
- no mandatory WebGL context;
- bounded blink afterimage history;
- deterministic deep-room terrain generation.

## v0.9 validation contract

Static validation must reject regressions in protected Countercut mechanics and additionally require:

- all seven terrain states (`ice`, `mud`, `sand`, `water`, `bramble`, `grass`, `shards`);
- shared `terrainAt` / `mobilityAt` sampling;
- terrain-aware player dash resolution;
- terrain-aware enemy movement and Skidder charge speed;
- unsafe evade-destination rejection;
- symmetric hazard handling;
- reflected knockback terrain routing;
- destructible tall grass;
- brittle route barriers;
- contextual ice fracture;
- cached terrain rendering;
- procedural enemy silhouettes, recoil, locomotion, and evade afterimages;
- distinct projectile visual signatures;
- unchanged projectile and movement queue caps/contracts.

Browser validation continues to run the real `/arcade/sylvaria` iframe on Chrome Stable, Chromium, Firefox, and WebKit. The rapid press-and-release D → S test remains unchanged in spirit: the second command must be accepted into the persistent queue, survive key release, eventually execute as a second discrete dash, drain the queue, and coexist with an independent ArrowUp cut.

The dedicated combat playtest should additionally prove that terrain changes actual simulation state rather than only rendering: mud must reduce commitment, enemies must report and obey the same terrain, unsafe evade routes must be jammed, foliage/barriers must be destructible, and Countercut knockback must be able to create a terrain-route reward.
