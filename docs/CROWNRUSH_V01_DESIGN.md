# Crownrush v0.1 Design

Crownrush is the new working identity for the game slot previously occupied by Sylvaria. The prior Sylvaria/Mosslight exploration and combat work remains preserved in repository history and its existing branches. Crownrush starts from a separate branch and deliberately does not inherit combat as a primary loop.

## Design thesis

The game should be understandable in seconds and expressive for hundreds of runs.

The core loop borrows the strongest structural lesson from Icy Tower without cloning its content:

1. simple horizontal movement,
2. speed becomes jump potential,
3. large vertical skips create combos,
4. combos create score and safety resources,
5. screen pressure removes hesitation,
6. one mistake damages rhythm before it necessarily ends the run,
7. restart friction stays near zero.

Crownrush adds a second mastery layer through the Sapline. The Sapline is not a generic grapple and not a combat weapon. It is a momentum bank.

## Player fantasy

Pip is a tiny canopy runner carrying a resin-tipped Sap Stick. Pip climbs the gap between two enormous sequoias while a fire front rises through the lower forest. The character is intentionally soft and readable against the monumental environment: leaf ears, an animated scarf, acorn boots, facial reactions, squash/stretch, and a glowing sap tip communicate state at a glance.

## Inputs

Desktop:

- `A/D` or left/right arrows: accelerate and pump swings.
- `Space`, `W`, or up arrow: jump.
- Hold `Shift` or `E`: attach the Sapline to the best reachable Resin Knot.
- Release `Shift` or `E`: convert stored line stretch and tangential velocity into a launch.
- `P`: pause.

Touch uses four large bottom zones for left, right, jump, and Sapline.

## Kinetic model

The simulation is fixed at 120 Hz and decoupled from rendering.

Horizontal speed increases jump height, but the mapping is bounded:

```text
jumpVy = baseJump + min(momentumCap, abs(vx) * momentumLift) + comboLift
```

This preserves the intuitive rule that speed becomes height while preventing runaway values.

Trunk contact keeps most horizontal momentum, reverses direction, and converts a bounded portion into vertical lift. Wall rebounds are tactile rather than sticky.

The Sapline is a damped elastic constraint. While attached, stretch produces force toward the Resin Knot and left/right input adds tangential pump force. Release adds a bounded impulse based on maximum stored stretch and current swing direction.

The earlier prototype equation `vy = mu * vx^2 + 0.5 * k * x^2` is not used literally because the terms do not share velocity units and quadratic velocity growth becomes unstable at high speed. Crownrush instead transfers energy through bounded acceleration and impulse terms.

## Combo rules

A combo jump must land at least two branch floors above the previous successful landing.

- First multi-floor skip starts the combo.
- Every consecutive multi-floor skip increments the multiplier.
- A one-floor landing banks and ends the combo.
- Falling to a lower floor ends the combo.
- Letting the combo timer expire ends the combo.
- Four consecutive skips trigger `CROWNVELOCITY`.

CROWNVELOCITY is primarily a feedback and expression state, not a sudden physics rewrite. It adds stronger Sapline pumping, a modest speed ceiling increase, motion streaks, afterimages, camera energy, and more aggressive scoring feedback while preserving learned timing.

## Failure and recovery

The rising fire is pressure, not an immediate binary death plane.

First contact causes `MOMENTUM BURN`:

- horizontal speed is heavily reduced,
- the active combo is lost,
- the player receives a small upward shove,
- the screen and audio communicate danger.

Banked combos fill a Resin meter. A full meter awards a `SAP CATCH`, up to two stored catches. If the player drops deep into the fire with a catch available, the game throws Pip back into the chute with substantial but imperfect speed. Without a catch, falling far enough below the fire ends the run.

This creates a better risk curve than instant death. Beginners get dramatic recoveries; experts can intentionally decide when to bank a combo for safety versus extending it for score.

## Procedural route generation

The world is generated as bounded vertical chunks represented by branches and Resin Knots.

Current v0.1 rules:

- branch spacing slowly increases with altitude,
- branch length slowly decreases,
- most branches alternate between trunks,
- occasional central branches break the rhythm,
- Resin Knots appear frequently enough to introduce optional swing routes,
- generated objects below the camera are recycled through small pools,
- generation always stays well ahead of the camera.

Future route-generation work should move from independent branch sampling to authored grammar chunks. A chunk should describe a recognizable climbing problem such as `wall-skip`, `pendulum-cross`, `double-knot slingshot`, `short-short-long`, or `recovery shelf`, with reachability checked against the current physics envelope.

## Camera and rendering

The camera tracks an anticipatory target based on upward and horizontal velocity while the fire front establishes a non-decreasing lower bound. Fast players sit lower in frame so they can read upcoming routes.

The current renderer is deliberately high-quality 2D Canvas rather than pretending to provide photorealistic displacement geometry. It uses procedural bark ridges, layered lighting, fog, altitude-dependent stars, resin bloom, branch highlights, particles, speed streaks, squash/stretch, scarf dynamics, and restrained velocity zoom. This keeps the website build lightweight and deterministic.

A later WebGL visual pass can add normal-mapped bark, parallax needles, volumetric light shafts, and GPU particles without replacing the gameplay simulation.

## Difficulty curve

Difficulty should come from execution pressure rather than surprise punishment.

Altitude gradually changes:

- branch vertical spacing,
- average branch length,
- route alternation frequency,
- Resin Knot usefulness and scarcity,
- fire ascent speed,
- required route-reading speed.

The player should always be able to identify why a run failed.

## Scoring

Score combines:

- altitude progression,
- continuous velocity-weighted survival score,
- multi-floor skip bonuses,
- combo multiplier growth.

The important leaderboard identities are:

- highest floor,
- highest score,
- best combo.

Replay ghosts and shareable deterministic run seeds are the natural next competitive layer.

## v0.1 acceptance criteria

- fixed 120 Hz simulation,
- no combat dependency,
- playable with three conceptual actions: move, jump, Sapline,
- momentum visibly affects jump capability,
- bark rebounds retain meaningful velocity,
- Sapline supports pumping and release launches,
- two-floor-or-greater jumps create combos,
- four skips trigger CROWNVELOCITY,
- misses usually cause momentum loss before death,
- banked combos can earn recovery charges,
- bounded procedural generation and recycling,
- keyboard and touch support,
- clear pause/restart flow,
- public Game Network integration only after runtime validation.
