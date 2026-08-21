# Sylvaria v0.8.1 — Countercut

Sylvaria Countercut replaces the older Mossglint portal action-puzzle with a compact directional counter-fighting game about protecting living forests under active clear-cut pressure. v0.8.1 is the first feel-and-structure pass after the combat rewrite: it makes movement buffered and physical, makes enemy intentions trustworthy, and turns the forest itself into real route geometry.

## Core rule

The game intentionally uses two independent four-direction vocabularies:

- **W / A / S / D** — cardinal **step-dashes**. A tap produces one short committed burst. Holding repeats discrete bursts at a game-controlled cadence. A quick second tap during the current burst is buffered briefly instead of being eaten.
- **Arrow keys** — cardinal **machete cuts**. Up, down, left, and right cuts damage enemies, chop deadwood, and counter incoming projectiles from the matching side. The active slash travels with Sprid during a dash.

Movement and attack direction are independent. A player can dash east while cutting north, retreat west while returning a projectile south, or chain repeated movement bursts through a lane while defending an orthogonal firing line.

## Why step-dashes

Step-dashes are both a rendering strategy and a combat commitment:

1. Movement uses explicit eased impulses instead of tiny frame-dependent velocity changes.
2. A tap always means one readable unit of movement.
3. Holding a direction repeats that unit at a game-controlled cadence rather than relying on operating-system key repeat.
4. A short input buffer allows deliberate dash chains without turning movement into analog drift.
5. Dash length grows with run depth. Later steps clear danger faster but can overshoot narrow safe pockets.
6. The authoritative simulation runs at a fixed **120 Hz**, with rendering decoupled from combat updates.

Rooms 1–10 grow the base step from **48 px to 66 px**. Deeper seeded rooms continue lengthening it in bounded increments up to 104 px. Flow improves cadence and cut recovery, not raw dash distance, so the player's learned spatial unit remains legible.

## Physical route geometry

Living trees and uncut deadwood are not decorative sprites. They physically stop a committed step-dash. The dash resolver samples the full path and shortens or blocks the step before the collision boundary.

That makes the machete part of navigation as well as combat. Chopping deadwood can turn a blocked future line into an escape route, while living trees create protected pockets and force the player to route around the grove they are defending.

## Counter system

Every hostile projectile has a readable approach side relative to Sprid. A slash only reflects it when the slash direction matches that approach side and the slash volume physically intersects the projectile.

- **normal counter** — returns the projectile as a stronger friendly shot;
- **perfect counter** — early contact returns a faster, harder projectile and adds more Flow;
- **wrong-direction cut** — no reflection;
- **no cut** — projectile damages Sprid or applies its special effect.

The perfect window is deliberately forgiving in the first rooms and tightens slightly with depth. Nearby incoming projectiles also display a small directional arrival cue so the game teaches the spatial rule visually rather than relying on prose.

## Flow and movement mastery

Flow rewards controlled aggression rather than passive survival. Perfect counters, successful cuts, and **dash grazes** build Flow. A graze occurs when a hostile projectile passes close to Sprid during a committed dash without connecting.

Flow shortens step-repeat cadence and machete recovery within bounded limits. It does not change the current step length. This keeps advanced play faster without quietly invalidating the player's spatial calibration.

## Run endurance and forest pressure

Sprid's heartwood persists between rooms. Taking damage therefore matters across the run instead of disappearing at every transition.

Living trees are objectives, not decoration. Fellers, Skidder Bruisers, Clearcut Mechs, and PAC-a-Saw can prioritize the grove. If every living tree is felled, the run ends. Clearing a room with **every tree still alive** awards a Perfect Grove bonus and restores one heartwood, creating a direct reason to defend the forest rather than merely rush the last enemy.

## Deterministic enemy intent

Gameplay decisions are deterministic for a room seed. Cosmetic particles and screen shake may still vary, but enemy target choices and recovery timing do not use ambient `Math.random()`.

Attacks lock their important intent during the telegraph:

- a Feller commits to Sprid or a particular tree;
- a Skidder commits to the player's telegraphed position before charging;
- a Clearcut Mech locks either a grove target or a player burst;
- PAC-a-Saw locks its phase attack and target before release.

Intent lines and target markers make those commitments visible. A player who reads a tell correctly should be rewarded even if they move before the attack releases.

## Enemy roster

| Enemy | Combat role | Structural answer |
| --- | --- | --- |
| Rookie Feller | close-range pressure and tree cutting | read whether the axe commits to Sprid or a tree, then punish |
| Nailgun Foreman | cardinal projectile teacher | directional projectile counters |
| Timber Lobbyist | red-tape debuff projectiles | reflect red tape or accept slower dash cadence |
| Skidder Bruiser | armored charger | step off the locked charge line, punish green recovery |
| Harvester Drone | curved saw-disc pressure | track the actual arrival side, not the launch side |
| Committee Chair | true support shield | destroy or separate the Chair to remove nearby damage reduction |
| Subsidy Broker | interceptable enemy acceleration | counter the travelling subsidy before it reaches the marked ally |
| Clearcut Mech | heavy mixed pressure and direct tree attacks | read the locked target, interrupt or reposition |
| PAC-a-Saw | three-phase room-10 boss | synthesize movement, counters, target priority, grove defense, and recovery punishes |

The political and industry enemies are fictional system-level satire rather than representations of real people or parties.

## Committee shields and subsidy transfers

The support enemies now obey the promises made by their presentation.

A live **Committee Chair** projects a visible support link and reduces damage taken by nearby cutters. Reflected projectiles punch through more of that protection than ordinary machete contact, giving counters a strategic role beyond raw damage.

A **Subsidy Broker** chooses a concrete beneficiary and launches a coin transfer toward that ally. The speed boost is applied only if the transfer reaches its target. The player can intercept, counter, or kill the recipient before delivery. The joke is now also a gameplay system.

## First ten rooms

1. **Trailhead Trespass** — buffered tap/hold step-dashes, physical deadwood, and basic Feller commitments at 48 px movement.
2. **Nailgun Nursery** — first directional projectile counters with generous timing.
3. **Red Tape Ravine** — reflected movement debuffs and cadence punishment.
4. **Skidder Switchback** — locked charge lines and recovery punishes.
5. **Sawdisc Wetland** — curved projectiles whose arrival side can differ from their launch line.
6. **Committee Canopy** — target priority around genuine support shielding.
7. **Subsidy Grove** — interceptable enemy synergy and accelerating transfers.
8. **Clearcut Conveyor** — heavy direct grove pressure with visible target intent.
9. **Four-Way Firebreak** — mixed-roster fluency: longer steps, route geometry, and simultaneous movement/orthogonal defense.
10. **PAC-a-Saw Summit** — three-phase synthesis boss with explicit vulnerable recovery windows and emergency clear-cut pressure.

## Deep-run generation

After room ten, `proceduralBlueprint(depth)` creates deterministic room blueprints from the room depth. It selects bounded enemy mixes, limits support-unit density, controls tree/deadwood counts, inherits palette language, schedules every-tenth-room guardians, and increases dash length. The first ten rooms remain the authored teaching language; deeper rooms recombine that language rather than introducing opaque verbs.

## UX and readability rules

- attack intent is visible before commitment;
- recovery/vulnerability is shown with a distinct green ring;
- hostile colors stay warmer or more synthetic than forest objectives;
- living-tree health is visible in-world and summarized in the HUD;
- the HUD always shows Flow, tree survival, step length, counters, grazes, heartwood, and boss phase when present;
- Sprid visibly stretches along the dash vector without changing collision geometry;
- the machete is rendered separately from the dash-body transform so attack direction remains world-cardinal;
- counter flashes are brighter than ambient effects;
- the gameplay field remains a stable 960×640 / 3:2 logical arena even when the background expands fullscreen;
- **P** toggles pause/resume and **M** toggles the lightweight procedural combat SFX.

## Validation

`npm run check:mosslight` validates the Countercut contract rather than the retired portal contract.

CI additionally runs:

- a dedicated Chromium combat playtest for single steps, held steps, buffered direction changes, physical deadwood blocking/chopping, all four counters, dash+cut overlap, persistent heartwood, Perfect Grove healing, dash-length progression, deterministic deep-room generation, room-10 boss recovery windows, pause toggling, and FPS;
- a Chrome Stable / Chromium / Firefox / WebKit matrix through the real `/arcade/sylvaria` iframe route, including buffered two-direction movement and an independent machete cut;
- production route smoke checks and browser screenshots;
- the existing repository typecheck, lint, unit, dependency, build, Nature Atlas, World Loom, and bundle gates.
