# Sylvaria v0.8 — Countercut

Sylvaria v0.8 replaces the Mossglint portal action-puzzle loop with a compact directional counter-fighting game about protecting living forests under active clear-cut pressure.

## Core rule

The game intentionally uses two independent four-direction vocabularies:

- **W / A / S / D** — cardinal **step-dashes**. A tap produces one short committed burst. Holding repeats discrete bursts at a controlled cadence. There is no continuous analog drift.
- **Arrow keys** — cardinal **machete cuts**. Up, down, left, and right cuts damage enemies, chop deadwood, and counter incoming projectiles from the matching side.

Movement and attack directions are independent. A player can dash east while cutting north, retreat west while returning a projectile south, or chain repeated movement bursts through a lane while defending an orthogonal firing line.

## Why step-dashes

Step-dashes are both a rendering strategy and a game mechanic:

1. Movement uses explicit eased impulses instead of tiny frame-dependent velocity changes.
2. A tap always means one readable unit of movement.
3. Holding a direction repeats the same unit at a game-controlled cadence rather than relying on browser key repeat.
4. Dash length grows with run depth. This is intentionally both a benefit and a liability: later steps clear danger faster but can overshoot narrow safe pockets.
5. The authoritative simulation runs at a fixed 120 Hz, with rendering decoupled from combat updates.

Rooms 1–10 grow the base step from **48 px to 66 px**. Deeper seeded rooms continue lengthening it in bounded increments up to 104 px.

## Counter system

Every hostile projectile has a readable approach side relative to Sprid. A slash only reflects it when the slash direction matches that approach side and the slash volume physically intersects the projectile.

- normal counter: projectile is returned as a stronger friendly shot;
- perfect counter: contact early in the slash window returns a faster, harder projectile and adds more Flow;
- wrong-direction cut: no reflection;
- no cut: projectile damages Sprid or applies its special effect.

The goal is to make projectile defense spatial rather than button-timed. The player must understand **where** danger reaches them from, not merely press a universal parry button.

## Forest pressure

Living trees are objectives, not decoration. Fellers, Skidder Bruisers, Clearcut Mechs, and boss attacks can prioritize the grove. If every living tree is felled, the run ends.

Deadwood is intentionally useful clutter. Machete cuts can clear logs and dead material to open future dash lanes, adding a small routing decision between immediate offense and shaping the arena.

## Enemy roster

| Enemy | Combat role | Readable answer |
| --- | --- | --- |
| Rookie Feller | close-range pressure and tree cutting | bait the axe commitment, punish recovery |
| Nailgun Foreman | cardinal projectile teacher | directional projectile counters |
| Timber Lobbyist | red-tape debuff projectiles | reflect red tape or accept slower dash cadence |
| Skidder Bruiser | armored charger | sidestep its committed charge, cut the exposed recovery |
| Harvester Drone | curved saw-disc pressure | track the actual arrival side, not the launch side |
| Committee Chair | support / procedural armor satire | remove the support unit before boosted cutters snowball |
| Subsidy Broker | enemy-speed synergy and coin volleys | counter the money, break the acceleration loop |
| Clearcut Mech | heavy mixed pressure and direct tree attacks | interrupt telegraphs and prioritize grove defense |
| PAC-a-Saw | three-phase room-10 boss | synthesize movement, counters, target priority, and tree defense |

The political/industry enemies are fictional system-level satire rather than representations of real people or parties.

## First ten rooms

1. **Trailhead Trespass** — introduces tap/hold step-dashes and basic melee Fellers at 48 px movement.
2. **Nailgun Nursery** — introduces the first directional projectile counters.
3. **Red Tape Ravine** — adds reflected debuffs and movement-cadence punishment.
4. **Skidder Switchback** — teaches baiting a long armored commitment and punishing recovery.
5. **Sawdisc Wetland** — introduces curved projectiles whose arrival side can differ from their launch line.
6. **Committee Canopy** — adds a support enemy that strengthens nearby cutters.
7. **Subsidy Grove** — introduces enemy synergy through accelerating coin volleys and heavier target-priority decisions.
8. **Clearcut Conveyor** — introduces a heavy unit that directly pressures living trees.
9. **Four-Way Firebreak** — fluency check: mixed roster, longer step-dashes, and simultaneous movement/orthogonal defense.
10. **PAC-a-Saw Summit** — three-phase boss with aimed volleys, radial paperwork, saw pressure, and direct grove attacks.

## Deep-run generation

After room ten, `proceduralBlueprint(depth)` creates deterministic room blueprints from the room depth. It selects bounded enemy mixes, tree/deadwood counts, inherited palettes, boss cadence, and increasing dash length. The first ten rooms remain the authored teaching language; deeper rooms recombine that language rather than introducing opaque new verbs.

## UX and readability rules

- enemy attacks telegraph before commitment;
- hostile colors stay warmer or more synthetic than forest objectives;
- living-tree health is visible in-world and summarized in the HUD;
- the HUD always shows Flow, tree survival, step length, counter count, and boss phase when present;
- Sprid visibly stretches along the dash vector without changing collision geometry;
- counter flashes are brighter than ambient effects;
- the gameplay field remains a stable 960×640 / 3:2 logical arena even when the background expands fullscreen.

## Validation

`npm run check:mosslight` now validates the Countercut contract rather than the retired portal contract.

CI additionally runs:

- a dedicated Chromium combat playtest for tap movement, held movement, all four counters, dash+cut overlap, dash-length progression, room-10 boss state, post-room-10 generation, and FPS;
- a Chrome Stable / Chromium / Firefox / WebKit matrix through the real `/arcade/sylvaria` iframe route;
- production route smoke checks and screenshots;
- the existing repository typecheck, lint, unit, dependency, build, Nature Atlas, World Loom, and bundle gates.
