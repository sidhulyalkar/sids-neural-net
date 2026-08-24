# Sylvaria: Sequoia v0.3 — Aerial Flow + Stride

## Thesis

Sylvaria: Sequoia is a kinetic vertical climber. The base game must be easy to enter and difficult to master. Running, speed-scaled jumping, multi-floor clears and forgiving momentum retention form the primary loop. Air Kick, bark interaction, Resin Rings and Sapline are accelerants, recovery tools and expert combo extenders rather than prerequisites for basic fun.

A gameplay recording exposed the crucial distinction. The player could eventually reach a 6× chain through repeated two-floor clears, proving that the combo loop itself worked, but it took too much friction to enter that state and the game did too little to preserve or reward it. The v0.3 Icy-flow pass therefore makes successful speed self-reinforcing.

## Core positive-feedback loop

1. Run on a readable runway and build **Stride**.
2. Horizontal speed directly increases grounded jump height.
3. Clear 2+ floors to add Flow.
4. A multi-floor clear adds a small bounded **Combo Carry** to horizontal speed.
5. Recent legitimate Stride survives a brief reversal so the next launch is not crippled merely because instantaneous `vx` crosses zero.
6. Continue 2+ floor clears to reach **CROWNVELOCITY** at 6× pure Flow, or reach it earlier at 4× by combining three movement families.
7. Use Air Kick, bark and Sap to rescue, redirect or extend the chain.

The player should feel the game become easier to move through after doing something skillful. Difficulty comes from sustaining and steering this increasing movement state while geometry and pressure gradually become less forgiving.

## Stride

`strideMomentum` is a bounded memory of recent real horizontal speed. It is not automatic movement and it cannot exceed the configured Stride cap.

- Actual speed immediately raises Stride.
- Stride decays slowly.
- Decay slows further during a live combo, Sapline use and wall recovery.
- Idling with no combo drains it faster.
- If the player queues a grounded jump while turning around, the launch may inherit 90% of recent Stride when instantaneous horizontal speed is temporarily much lower.

This solves a specific vertical-climber contradiction: an alternating platform should require a direction change without forcing every successful high-speed landing to erase the speed that made it successful.

The HUD exposes this state as **STRIDE → RUSH I → RUSH II → RUSH III → CROWN RUSH**. A small marker separately shows actual instantaneous horizontal speed so the assist remains legible rather than mysterious.

## Speed-scaled jump envelope

Ground launch is dominated by horizontal commitment:

`jumpVy = base + min(momentumCap, |vx| × momentumGain) + bounded Flow lift + optional Launch Burl lift`

The current easy-entry envelope is intentionally broad:

- standing jump has generous clearance over a single Rootways gap;
- low Momentum-Burst entry speed comfortably supports a 2-floor combo;
- an ordinary developed run supports about 3 Rootways floors;
- Rush speed supports about 4;
- full Stride supports about 5.

`npm run check:sylvaria-flow` calculates this envelope from the actual tuning and route source and fails CI if future changes accidentally make the teaching band expert-only.

Jump-release drag is intentionally tiny. The player should learn **run faster = jump higher**, not discover that expected jump height depends on an invisible key-hold micro-timing requirement.

## Momentum Burst

A committed grounded run charges a one-per-branch Momentum Burst. It is a small bounded impulse that helps a beginner enter the speed loop quickly rather than requiring a long runway before the game becomes expressive.

It does not replace ordinary acceleration. Once the player has Stride and Flow, normal speed retention and Combo Carry become the dominant snowball.

## Combo Carry

Every successful 2+ floor clear adds a small horizontal impulse in the intended movement direction. The impulse increases gently with Flow and is capped.

This is the central positive-feedback correction:

`speed → higher jump → multi-floor clear → a little more speed → easier next high jump`

A successful combo should create the conditions for another successful combo while still requiring the player to choose a safe landing and direction.

## Flow and CROWNVELOCITY

Flow remains a chain of skilled movement actions:

- `AIR` — Air Kick
- `BARK` — strong bark rebound / Bark Kick
- `SAP` — useful Sap release / Quick Sling / SAP SURGE
- `RING` — Resin Ring thread
- `SKIP` — 2+ floor clear
- `BURL` — Launch Burl takeoff

The most important scoring path, however, no longer requires mechanic variety. Repeated multi-floor clears are sufficient.

### CROWNVELOCITY entry

- **Pure Flow:** 6× chain, even if built primarily from SKIP links.
- **Varied Flow:** 4× chain with at least three movement families.

On entry, Air Kick refreshes and Stride is brought to a strong but bounded minimum. CROWNVELOCITY increases traversal feedback and makes the player want to keep the speed state alive.

The older 7× + three-family core threshold remains as a conservative underlying invariant, but the flow-assist layer intentionally ignites the player-facing state earlier.

## Renewable Air Kick

Every grounded launch begins with one Air Kick. Press Jump again while airborne to spend it.

Air Kick preserves the current horizontal commitment, adds directional impulse and significant vertical lift. It does not reset the character to a fixed canned trajectory.

Air Kick can be restored by landing, Resin Rings, useful Sap releases, skilled bark interactions and CROWNVELOCITY entry. The result supports long aerial chains without unlimited jump-spam.

## Bark: rebound, recovery and Bark Kick

Wall contact should be an upward routing tool, not a punishment that sends Pip through a long lateral recovery arc.

The automatic rebound converts a large fraction of incoming movement into height while keeping horizontal travel compact enough for the narrow twin-sequoia arena. Stride memory preserves the *speed state* even though the physical rebound itself is shorter.

Every proper bark rebound also opens a short Bark Kick grace window. Jump during the window to perform a deliberate strong upward kick, restore Air Kick, create a BARK Flow link and receive a short directional acceleration recovery period.

This creates two layers: touch bark for the automatic upward-biased rebound, or touch bark + Jump for the intentional Bark Kick extension.

## Sapline: coveted utility first, mastery second

Sap should be useful the instant the player reaches for it.

### Sap Snap

Attaching to a valid knot above the player immediately shortens the rope and applies a strong upward/toward impulse. This arrests bad falls and starts useful motion immediately.

### Quick Sling

Release shortly after a valid Sap Snap for a reliable upward fling. Quick Sling restores Air Kick and adds a SAP Flow link.

### Pumped sling

Hold longer and use horizontal input to pump the pendulum. Stretch stores additional energy and the eventual release converts that energy into tangential and upward velocity.

### SAP SURGE

At 5× Flow, a sufficiently stretched release receives the larger SAP SURGE conversion. Advanced Sap should amplify an already-working run rather than be required to begin one.

## Resin Rings and Launch Burls

**Resin Rings** are aerial route markers. Threading one extends Flow and restores Air Kick; high-speed threads are more valuable.

**Launch Burls** are visible marked takeoff areas that add bounded lift and horizontal energy. They teach the player where a route wants to begin.

Both exist to make aerial intent readable before the player commits.

## Route grammar and progressive difficulty

Difficulty is compositional, not merely larger gaps.

### ROOTWAYS — floor 0+

Rootways is intentionally runway-heavy:

- FLOW gaps: 54 / 58 / 60 / 62 / 64 px
- RECOVERY gaps: 52 / 56 / 60 px
- near-full-width center branches dominate
- very small slopes and jitter
- FLOW / RECOVERY sequence emphasis
- environmental pressure multiplier 0.58

The player should discover Stride, two-floor clears and Air Kick without already solving precision lateral transfers.

### REDWOOD RUN — floor 44+

Introduces more side commitment and the first deliberate SLINGSHOT / CRUX pairings while retaining regular FLOW and RECOVERY breathing room.

### SAPWORK — floor 90+

Sap conversion, renewable Air Kick and mixed traversal become increasingly useful.

### HIGH CANOPY — floor 145+

Platforms shorten, slopes and vertical deltas grow, and preserving a high-speed state becomes a genuine routing problem.

### CROWNLINE — floor 205+

CRUX and SLINGSHOT dominate. The player is expected to combine pure momentum chaining with bark, rings and Sap when the direct runway is no longer enough.

## Rising pressure

Rootways pressure is deliberately low. The environmental rise should teach urgency only after the player has had time to discover the speed loop.

The threat remains gap-aware and rubber-banded. A struggling player receives breathing room; a player far above the threat causes it to catch up gradually.

Difficulty should increasingly come from shrinking geometric freedom and higher routing demands, not simply making the fire arbitrarily fast.

## Input generosity

The simulation remains deterministic at 120 Hz, but the input contract is intentionally forgiving:

- 190 ms jump buffer
- 120 ms coyote time
- 28 ms duplicate-edge filter
- unique request IDs guarantee one physical jump request becomes one movement action
- title/restart Space is quarantined until key-up so it cannot consume Air Kick

The duplicate filter is short because a genuinely rapid intentional second tap should still produce Air Kick.

## Telemetry

`T` toggles telemetry. `J` copies the current run JSON. `R` retries the exact seed and `N` creates another route seed.

Tracked signals include grounded / airborne / low-momentum time, average and peak speed, jump and Air Kick launch speeds, wall rebound retention and lift, Sap attach / release / stretch / speed gain, Flow link intervals and maximum chain, multi-floor skips, CROWNVELOCITY entries, Momentum Burns, Sap Catches and route completion/failure by grammar.

The flow-assist layer also records Stride launch carries, combo speed carries, wall Stride carries, Momentum Bursts, Sap Snaps, Quick Slings and Bark Kicks.

## Same-seed comparisons

Feel changes should be tested against the same route seed before changing content variety. Useful comparisons include:

- time to first 2× Flow,
- time to first 4× and 6×,
- percentage of runs reaching CROWNVELOCITY,
- low-momentum ratio,
- average and peak horizontal speed,
- mean floors per skip,
- Flow timeout frequency,
- Momentum Burn frequency,
- Sap attach-to-useful-release conversion,
- recovery rate after wall contact.

A good easy-entry build should make 2× common, 4× understandable and 6× exciting. Expert mastery is how long the player can sustain the state once the upper tower begins removing the generous runways.
