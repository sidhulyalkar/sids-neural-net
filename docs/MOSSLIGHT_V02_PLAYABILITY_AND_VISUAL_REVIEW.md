# Mosslight v0.2 — Playability + Visual Review

## Why v0.2 exists

The first playable Mosslight proved the ecological action-puzzle loop, but its presentation still behaved like a prototype in three important ways:

1. the player read as a glowing cursor rather than a character,
2. different animals shared one generic silhouette,
3. the title screen taught too many controls before the first interaction.

v0.2 treats accessibility, visual identity, and game feel as core mechanics rather than polish.

## The default experience

The first screen teaches only three things:

- **WASD** moves Sprid,
- **Mouse** aims,
- **Click** uses the current restoration tool.

Everything else is secondary and learned in play:

- Shift dashes,
- Q/E cycles unlocked tools,
- 1–6 are optional shortcuts,
- R restarts the current room,
- P pauses.

The default difficulty is **Gentle**. An optional **Flow** mode preserves a tighter mastery version.

## Sprid

The player is now **Sprid**, a tiny moss keeper rendered as an animated character rather than an orb.

Visual requirements:

- readable head/body separation at 960×640,
- eyes and blink cycle,
- leaf-like ears/sprouts,
- two-foot walk cycle,
- velocity lean / dash stretch,
- ground shadow,
- selected-tool aim pointer,
- separate directional reticle.

The character should communicate where the player is looking before a projectile is fired.

## Gentle mode rules

Gentle mode is the first-play default.

- large target collision padding,
- an aim-assist cone nudges casts toward a compatible nearby target,
- hazards move at roughly 62% of Flow speed before restoration scaling,
- wrong tools give a clear hint instead of meaningfully punishing the chain,
- correct actions automatically select the target's next tool when that sequence is obvious,
- dash has a forgiving cooldown,
- there is no health bar, death, or run-ending failure,
- the room objective and nearest target need remain visible.

Gentle mode should let a first-time player learn by acting rather than memorizing controls.

## Flow mode rules

Flow mode is optional mastery.

- no aim magnetism,
- faster environmental stress fronts,
- shorter chain timer,
- wrong casts reduce the current chain,
- dash cooldown is slightly longer.

Progression and room logic are otherwise identical, so learning transfers directly.

## Visual restoration rule

A room should not merely display a percentage. It must *look healthier* as restoration rises.

Examples:

- Dew Garden gains brighter plant motion and pond presence.
- Orchard House gains warmer, richer canopy color.
- Rescue Hollow gains more firefly-like ambient life.
- River Workshop water becomes more visible and luminous.
- Cloud Meadow grass movement becomes richer.
- Emberstep shifts charred marks toward green recovery.
- Pollinator Conservatory fills with pollen motes.
- Alpine Thaw reveals meltwater.
- Tide Nursery strengthens moving water lines.
- Earthheart brightens its radial root/energy network.

## Creature identity

Animals now use species-specific procedural silhouettes instead of one shared body:

- fox — tail, ears, low quadruped body,
- owl — round body, face disks, beak, wing flap,
- deer/fawn — long legs, ears, antler/branch marks,
- marmot — compact alpine body and round ears.

A restored creature receives a calm heart indicator, but the animal itself should already be identifiable before restoration.

## Room-by-room first-play expectation

### 1. Dew Garden

Target first completion: 30–60 seconds.

The player should discover movement and directional casting with no hazard pressure. Need bubbles teach Rain → Sun without requiring a tutorial modal.

### 2. Orchard House

Target: 45–75 seconds.

Introduces Seed and Gather. The important concept is that a completed organism can create a resource for another relationship.

### 3. Rescue Hollow

Target: 45–90 seconds.

The first emotional room. The player should recognize the fox, owl, and fawn immediately, then learn Mend → Gather while tracking gently moving targets.

### 4. River Workshop

Target: 60–120 seconds.

The first spatial puzzle. Pale goal arrows make sluice orientation readable. Rain rotates gates, so the player learns to observe rather than spam.

### 5. Cloud Meadow

Target: 60–120 seconds.

The first physics-like room. Wind moves cloud mass into dotted dry basins, then Rain and Sun complete the relationship.

### 6. Emberstep

Target: 75–135 seconds.

Environmental stress begins. Smoke and heat are slow in Gentle mode and only cause knockback. The player should read them as moving terrain, not enemies.

### 7. Pollinator Conservatory

Target: 75–135 seconds.

Denser geometry but a visually bright payoff. Pollen motes increase as the room becomes healthy.

### 8. Alpine Thaw

Target: 75–150 seconds.

Recombines old verbs. Ice should visibly become plant/water life and the marmot provides a character anchor.

### 9. Tide Nursery

Target: 90–150 seconds.

Moving current fronts create rhythm. Their arrows must remain visually predictable enough that a first-time player can dash through them.

### 10. Earthheart

Target: 2–4 minutes.

A synthesis room, not a boss. All six verbs appear, but every active target still advertises the next useful action.

## Automated visual playtest

Production CI now runs a dedicated Mosslight browser playtest after the built Next site is serving.

It verifies:

- the v0.2 runtime loads without page/console errors,
- real WASD input moves Sprid,
- a real pointer click registers a cast,
- all ten rooms can be entered through the playtest API,
- all ten stressed states render,
- all ten restored states render,
- the runtime remains above a minimum headless FPS threshold,
- a JSON report is uploaded with the screenshots.

This produces **20 room-state screenshots** per production gate so visual regressions can be reviewed rather than inferred from code.

## Human review rubric

For each room, inspect:

1. **Character:** Can Sprid be found instantly? Is aim direction obvious?
2. **Objective:** Can the player tell what needs attention without reading a paragraph?
3. **Target identity:** Are plant, animal, cloud, sluice, ember, ice, coral, mangrove, and Earthheart forms distinct?
4. **Depth:** Does the room feel composed rather than like objects on a flat spreadsheet?
5. **Motion:** Does ambient animation add life without obscuring the interaction layer?
6. **Restoration contrast:** Does the restored screenshot look clearly healthier than the stressed screenshot?
7. **Hazard readability:** Can moving stress fronts be predicted before contact?
8. **UI load:** Is the HUD secondary to the room rather than dominating it?
9. **Color:** Does the room have a recognizable palette without losing tool-color readability?
10. **Fun signal:** Is there a visible reward every few seconds during successful play?

## v0.2 definition of done

- Sprid replaces the anonymous orb player.
- Species-specific creature silhouettes ship.
- Three-control onboarding ships.
- Gentle mode is default.
- Flow mode is optional.
- Aim assistance ships only in Gentle mode.
- Wrong-cast punishment is softened in Gentle mode.
- Tool selection guides the player through simple sequences.
- Ten room-specific visual grammars remain distinct.
- Restoration visibly changes environments.
- Dedicated browser playtest captures all 20 stressed/restored states.
- Production lint, typecheck, security, bundle, Atlas, and XR gates remain green.
