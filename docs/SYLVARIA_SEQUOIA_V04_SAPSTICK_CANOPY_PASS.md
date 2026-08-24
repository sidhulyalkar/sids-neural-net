# Sylvaria: Sequoia v0.4 - Sap Stick Canopy + Feel Recovery

## Why this pass exists

The sparse-canopy direction is working, and the latest playtest confirms that the movement recovery made ordinary running, jumping, and velocity correction substantially smoother. The remaining control tax was Sap Stick itself: requiring **Shift + Space** made a route tool that should feel instinctive depend on a precise two-key chord while the player's movement fingers were already busy.

v0.4 now treats negative space and Sap Stick as one continuous movement language. Branches are runways. Amber knots are airborne handles. The control should feel closer to grabbing a vine than entering a keyboard shortcut.

The governing rule is:

> Run and jump create the base rhythm. **Press Shift** to fire at a readable amber anchor, **hold Shift while steering** to shape the swing, and **release Shift** to vault. There is **no charge**.

## Canonical Sap Stick input

Desktop input is intentionally one button:

**Press Shift -> hold + A/D or Left/Right -> release Shift**

The moment Shift is pressed during gameplay, Sap Stick attempts to acquire the best valid amber knot. There is no second Space press and no chord timing requirement.

While the tether is live:

- Shift keeps the tether engaged.
- A/D or Left/Right always mean screen-left / screen-right swing steering.
- Space/W/Up do not queue a hidden Air Kick behind the tether.
- Releasing Shift releases the tether and vaults.
- The resulting vault refreshes Air Kick so the player can continue the line deliberately.

Touch uses the same lifecycle: press the Sap region to fire and hold, release the pointer to vault.

## Forgiving acquisition without autopilot

A press that happens a fraction early should not turn into a dead input. The new Sap Stick has a **0.18 s acquisition buffer**. If no knot is reachable on the exact keydown frame, the held input may acquire one that becomes reachable during that short window.

This is intentionally bounded. It is not a persistent tractor beam and it does not search indefinitely while Shift is held.

The target score remains deterministic and considers:

- distance
- vertical advantage
- current movement direction
- whether an anchor is behind the player
- whether the player is falling / close to the threat
- whether the knot is an authored `sap-stick` route anchor
- recent-anchor reuse lockout

The route designer still chooses which anchors exist. Target assistance only chooses the most plausible reachable one.

## Hold-to-swing movement contract

The old fixed 0.22-second auto-vault is removed from player-facing control.

The new lifecycle is:

1. Press Shift.
2. Sap Stick fires immediately when a valid knot exists.
3. A tiny **0.075 s internal minimum** prevents one-frame press/release jitter from producing inconsistent physics. This is not a timing challenge for the player.
4. Hold Shift and steer with A/D or Left/Right.
5. Sap Stick temporarily suppresses the legacy tangent-pump input mapping and gives the player direct screen-horizontal steering authority. This prevents the same direction key from feeling inverted as Pip moves around an anchor.
6. Release Shift when the swing looks right.
7. The release preserves useful momentum, guarantees a useful upward vault, and refreshes Air Kick.
8. A **1.35 s safety ceiling** prevents pathological indefinite tethers while still allowing a long, readable swing.

Recent anchors keep their reuse lock, so one knot cannot become an infinite elevator.

## Reset input safety

`R` is removed as the retry key because it sits directly beside the left-hand movement cluster and can be hit accidentally during fast play.

The current-seed reset is now the **0 key**. `N` remains new route and `P` remains pause.

This keeps destructive run control away from A/D, W, Space, and Shift.

## Branchless route topology

v0.4 adds the `SAPRUN` grammar and allows a route tier to set `branch: false`.

A branchless tier creates an amber anchor but no collision platform. The important density contracts are:

- `GROVE`: 2 branches across 4 tiers
- `SAPRUN`: 2 branches across 5 tiers, with 3 branchless amber tiers
- `SLINGSHOT`: 2 branches across 4 tiers

The physical corridor is **760 px** wide (`x=100` to `x=860`).

This changes the visual/spatial rhythm from:

`branch -> branch -> branch -> branch`

to:

`runway -> open air -> amber swing -> amber swing -> landing`

As difficulty rises, harder phases can use more `SAPRUN`, `SLINGSHOT`, `GROVE`, and `CRUX` without simply filling the viewport with smaller shelves.

## Anti-autopilot rules remain

The earlier runaway Flow failure remains a regression boundary.

Passive bark:

- does not score Flow
- does not refresh Air Kick
- is a low-energy redirect

Stride carry and combo acceleration remain bounded. CROWNVELOCITY still requires a meaningful Flow chain. Sap Stick adds route expressiveness rather than restoring automatic ping-pong climbing.

## Sequoia bark model

The production sequoia renderer uses a deterministic **shared-vertex anisotropic puzzle lattice** with weathered gray/mauve exterior flakes, cinnamon-red fibrous core, longitudinal tearing, overlapping curls, and puzzle-like adjacency.

Adjacent bark cells share deterministic vertices, so boundaries fit exactly. Fibers remain mostly vertical, and the bark hash depends only on world-space row, column, and trunk side. It does not consume route RNG.

The exact collision boundary remains readable as a natural crease and warm wood rim rather than a glowing gameplay stripe.

## Pip visual target

Pip remains a mascot rather than a tiny generic climber silhouette:

- oversized expressive head and eyes
- leaf hood and tiny sprout
- orange/red speed scarf
- green leaf tunic
- small satchel
- oversized boots
- visible amber Sap Stick
- grin / panic expression based on vertical state
- `GRIP!` cue during Bark Cling

The scarf remains velocity-readable, so personality is also movement feedback.

## HUD and tutorial language

The final control HUD overlays every render tier, including fallback rendering, so old Shift + Space instructions cannot survive visually.

It teaches:

- `SHIFT = FIRE`
- `HOLD + A/D = SWING`
- `RELEASE = VAULT`
- `0 = RESET`

During relevant early routes, a compact tutorial card also explains the 0.18-second early-lock buffer.

## Telemetry

Sap Stick now records:

- `sapStickPresses`
- `sapStickCasts`
- `sapStickBufferedLocks`
- `sapStickHoldReleases`
- `sapStickSafetyReleases`
- `sapStickVaults`
- `sapStickRescues`
- `sapStickMisses`

Same-seed playtests should compare:

- branch density visible per camera window
- Shift press-to-lock success
- buffered locks vs true misses
- tether hold duration
- left/right steering authority while tethered
- release velocity and upward vault consistency
- rescue casts vs normal casts
- Flow chain length
- peak/average speed
- Air Kick usage after Sap Stick vaults
- route completion by grammar
- RAF frame pacing and render-cost telemetry

## Qualification boundary

A v0.4 head is not qualified until it passes:

- runtime syntax / deterministic invariants
- sparse-route density checks
- anti-autopilot movement envelope
- Sap Stick no-charge acquisition, hold, release, and anchor-reuse checks
- production build and runtime smoke
- one physical Space -> one jump action
- physical ground jump -> separate Air Kick
- physical Shift press -> Sap Stick cast without incrementing jump authority
- Shift held with A/D -> player-owned swing steering
- Shift release -> Sap Stick vault
- Space during an active tether -> no hidden queued Air Kick
- 0 key -> retry current seed
- R key -> never reset
- blur / lost focus -> tether safely releases
- Chrome Stable, Chromium, Firefox, and WebKit

The PR remains draft until those exact-head gates are green.