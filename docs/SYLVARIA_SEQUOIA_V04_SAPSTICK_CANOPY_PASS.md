# Sylvaria: Sequoia v0.4 - Heartwood Crown + Sap Stick Canopy

## Why this pass exists

The movement is finally becoming fun enough that the next question matters: **why does the player desperately want one more floor?** A personal best and a score are useful feedback, but they are too abstract to carry the whole game. Sylvaria needs visible temptation, finite purpose, and late-game situations that change how the player thinks instead of merely making the same jump smaller.

The governing identity is now:

> **The forest is the interface, and the crown is a real destination.** Build momentum, leave the safe line for persistent Heartseeds, survive increasingly strange canopy trials, and wake the Living Crown.

The game deliberately layers three appetites:

1. **Immediate:** the next Crown Mark is close and visible.
2. **Run-level:** a glowing Heartseed or authored trial creates a risky decision right now.
3. **Long-term:** five persistent Heartseeds unlock the Living Crown at floor 250.

Score and personal-best height remain useful, but they are no longer the only answer to “why climb?”

## Canonical Sap Stick input

Desktop input remains intentionally one button:

**Press Shift -> hold Shift + A/D or Left/Right -> release Shift**

Press Shift to fire immediately at the best valid amber knot. Hold Shift and steer the swing in screen space. Release Shift to vault with useful momentum and a refreshed Air Kick. There is **no charge** requirement and no Shift+Space chord.

A **0.18 s acquisition buffer** forgives a slightly early press without turning Sap Stick into autopilot. A tiny **0.075 s internal minimum** only filters one-frame key jitter. A **1.35 s safety ceiling** prevents pathological indefinite tethers. Recent-anchor reuse lockouts prevent one knot from becoming an infinite elevator.

Space/W/Up while tethered cannot queue a hidden Air Kick. Touch uses the same press, hold, release lifecycle.

## Clean Sap instead of free Flow

An ordinary Sap vault is connective movement. It may preserve a live Flow timer briefly, but it does not automatically mint a SAP combo link.

A **Clean Sap** earns the SAP link only when the player deliberately shapes a useful release:

- player-authored release;
- tether age between **0.16 s and 0.82 s**;
- horizontal release speed at least **330 px/s**.

This keeps Shift friendly while restoring meaning to Flow. The game rewards execution, not repetitive input spam.

## The Heartwood objective

### Five persistent Heartseeds

The canopy now contains five named Heartseeds:

| Heartseed | Floor | Intended feeling |
| --- | ---: | --- |
| ROOTLIGHT | 22 | first voluntary departure from the safest line |
| REDSTAR | 58 | commit to an outer-line catch as wind begins to matter |
| SAPHEART | 103 | trust open-air Sap movement rather than shelves |
| SKYSEED | 153 | take the exposed storm-side line |
| CROWNCORE | 218 | claim a high-canopy prize inside the expert ecology |

A Heartseed is not ordinary currency. It is a memorable world-space object positioned off the safest traversal line. The player can ignore it and keep climbing, or become greedy and alter the route to take it.

Collected Heartseeds persist between runs in local storage. The persistent reward is **progress toward the finite objective**, not permanent movement-stat power creep.

### Immediate risk/reward

Taking a Heartseed also gives a bounded run-local recovery reward:

- refresh Air Kick;
- restore useful Stride opportunity;
- grant a Sap Catch when possible, otherwise resin.

That means the detour can be strategically attractive during a strong run without becoming mandatory progression.

### The Living Crown

Collecting all five Heartseeds unlocks **the Living Crown at floor 250**. Reaching floor 250 with the full set awakens it permanently and produces a distinct completion celebration.

The primary motivational loop becomes:

`climb -> see a Heartseed off the safe line -> choose risk -> bank permanent progress -> collect all five -> reach floor 250 -> wake the Living Crown`

After awakening the Crown, endless PB climbing remains available. The finite goal gives the game a destination; the endless climb remains the mastery tail.

## Crown Trail: the short-horizon appetite

Every **25 floors** remains a Crown Mark. The next Crown Mark appears as a restrained golden world-space gate and gives a quick audiovisual punctuation when crossed.

The loop is deliberately small:

`current floor -> visible Crown Mark -> cross it -> next Crown appears`

The minimal HUD preserves Crown distance and personal-best height, but its secondary objective slot now prioritizes **Heartseeds / Living Crown state instead of score**.

## Difficulty must add vocabulary

Late difficulty should not be “ROOTWAYS but meaner.” The player should discover new rules and need new reads.

The route language now progresses roughly as:

`runways -> open Sap lines -> crosswind -> breakaways -> pendulums -> Conefall -> Thundercrown`

### Existing expert families

- **WINDLINE:** exposed cross-anchor movement with wind correction.
- **SKYHOOK:** long branchless alternating Sap reads.
- **CROWNWEAVE:** repeated cross-corridor decisions with minimal shelf relief.

### BREAKAWAY

BREAKAWAY introduces **fragile branches**. From roughly floor 76 onward, selected branches crack after Pip lands and physically disappear after a readable grace period. BREAKAWAY and THUNDERCROWN routes force the mechanic; other late routes may receive it deterministically at increasing density.

The branch visibly cracks, sheds chips, then falls. The player receives a tiny coyote allowance at the moment of collapse so the mechanic creates urgency rather than cheap input theft.

The question changes from “can I land there?” to **“what is my exit before I land?”**

### PENDULUM

From roughly floor 92, selected authored Sap Stick anchors sway horizontally. PENDULUM and THUNDERCROWN routes force moving anchors, while other higher routes may receive them at bounded deterministic density.

The target itself is now time-dependent. A/D swing steering remains direct and screen-relative, but the player must decide when to cast and release rather than treating every knot as a stationary hook.

### CONEFALL

From roughly floor 132, high canopy can drop **telegraphed sequoia cones** through the traversal corridor. A clear top-of-screen warning appears before the cone enters the playfield.

A hit does not arbitrarily one-shot Pip. It knocks the player off line, forces downward velocity, and damages Flow timing. The hazard therefore creates a recoverable movement problem and an opportunity for Air Kick, Bark, or Sap recovery.

Cone cadence and speed escalate with altitude, but warning time remains readable.

### THUNDERCROWN

THUNDERCROWN is the late synthesis scenario:

- long branchless cross-anchor chains;
- swaying Sap targets;
- unstable landing branches;
- strong crosswind;
- falling Conefall pressure;
- little disposable shelf relief.

It is not intended for ROOTWAYS. It belongs to CROWNLINE, after the player has learned every movement verb separately.

## Determinism and fairness

Heartseed placement, fragile-branch selection, moving-anchor parameters, and Conefall variation use deterministic hashes of the run seed/floor rather than consuming `state.routeRng`.

That preserves the route-generation stream. The same seed remains meaningfully comparable across playtests, and visual or hazard decoration cannot silently mutate future route geometry.

A **same-seed retry** remains on the **0 key / Numpad 0**. `R` is intentionally harmless near the movement cluster. `N` generates a new route seed and `P` pauses.

## Crosswind and altitude ecology

Deterministic crosswind still begins only after roughly floor 46. It is strongest in open air, heavily reduced while tethered, and nearly absent while actively running on a branch.

Altitude changes visual ecology as well as physics. The production renderer keeps collision geometry exact while adding deterministic sequoia bark, deep flake shadows, moss/lichen/resin treatment, atmospheric scattering, cloud wisps, distant birds, moving amber anchors, Heartseed glows, bark fractures, and telegraphed falling cones.

The new hazards must be readable before they are punishing:

- fragile branches crack before collapse;
- moving anchors leave subtle motion traces;
- cones announce their lane before entering the screen;
- crosswind remains visible as sparse environmental streaks.

## Minimal gameplay HUD

The large left rail and permanent title remain suppressed during play. No opaque replacement panel consumes the newly recovered playfield.

The thin top-edge ribbon shows only what matters now:

- current floor + phase on the left;
- next Crown Mark in the center;
- PB + Heartseed/Living Crown state on the right;
- Flow only while a chain exists;
- wind only when meaningful;
- next Heartseed cue only when it is close enough to matter.

The opening title fades away after roughly 1.65 seconds. Its subtitle now communicates the larger objective: **WAKE THE CROWN · HEARTSEEDS x/5**.

Sap instructions remain transient. The playfield, not a dashboard, owns the screen.

## Motivation without grind

The Heartwood system deliberately avoids an upgrade shop, stat tree, or currency treadmill. The player should want to continue because:

- a visible Heartseed is dangerous and tempting;
- the next Crown Mark is close;
- a new trial family might appear higher up;
- the finite Living Crown objective is incomplete;
- a missed Heartseed creates a clean “I can get that next run” memory;
- after Crown awakening, PB and Flow mastery remain meaningful expert goals.

This keeps the hunger inside the movement itself instead of outside the game in menus.

## Telemetry

The pass records the previous movement/Flow metrics plus:

- `heartseeds`;
- `crownAwakenings`;
- `fragileBranchesTriggered`;
- `fragileBranchesBroken`;
- `conesSpawned`;
- `coneHits`;
- `conesDodged`;
- `crownMarks`;
- `routesCleared`;
- `personalBestFloors`;
- `windReversals` and wind exposure.

Events include Heartseed collection, Living Crown unlock/awakening, trial entry, branch cracking/collapse, cone impacts, Crown Marks, and route completion.

Same-seed playtests should compare not just height and score but **which temptations players take**, where they fail, whether trial mechanics are understood before punishment, Heartseed pickup rate, recovery after cone hits, moving-anchor success, and whether the player voluntarily risks a good run for a visible relic.

## Qualification boundary

The current head is not qualified until all of the following hold:

- runtime syntax and deterministic invariants;
- movement / jump / Clean Sap envelope;
- ordinary Sap cannot manufacture Flow;
- Heartseed mask persists across runs;
- all five Heartseeds unlock the Living Crown at 250;
- Heartseed pickup refills bounded run-local movement/survival resources;
- BREAKAWAY, PENDULUM, CONEFALL, and THUNDERCROWN grammars exist;
- fragile branches actually trigger and disappear;
- moving Sap anchors materially move;
- Conefall warning + spawn lifecycle is active only at appropriate altitude;
- hazard/quest systems do not consume route RNG;
- Crown Mark and persistent-PB contracts remain intact;
- press Shift, hold Shift, release Shift control lifecycle remains intact;
- Space during tether cannot become a hidden Air Kick;
- 0 key performs same-seed retry and R remains harmless;
- minimal HUD and title-fade contracts remain intact;
- production build and runtime smoke pass;
- Chrome Stable, Chromium, Firefox, and WebKit pass the existing Game Network matrix, Shift-hold movement matrix, and dedicated Heartwood/trial matrix.

The PR remains draft while gameplay feel and difficulty are still being tuned, even when exact-head qualification is green.
