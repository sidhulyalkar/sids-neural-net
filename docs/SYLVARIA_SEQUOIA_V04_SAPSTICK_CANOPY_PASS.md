# Sylvaria: Sequoia v0.4 — Sapstick Canopy Pass

## Why this pass exists

The latest playtest was the first version that felt materially closer to the intended kinetic climber, but the route still read as a stack of branches. That created two problems at once: the screen was visually crowded and the player could often solve terrain by finding another shelf instead of making a deliberate movement decision.

v0.4 makes negative space part of the level design. Branches become rest/runway surfaces. The difficult connective tissue becomes **amber Sap Stick routes** that can cross air with no branch beneath them.

The governing rule is:

> Run and jump create the base rhythm. **Shift + Space** converts a readable amber anchor into a short, deterministic momentum vault. There is **no charge**.

## Canonical Sap Stick input

Desktop input is intentionally one chord:

**Hold Shift + tap Space**

Shift alone only arms the targeting preview. Space alone remains Jump / Air Kick. When Space arrives while Shift is held, the input layer consumes that edge before the jump contract, so a Sap Stick cast can never also become an Air Kick.

Touch retains a dedicated Sap control which calls the same `castSapStick()` authority.

## Fixed-duration, no-charge movement contract

The Sap Stick is not a grappling-hook simulator that asks the player to wait for a meter. It is an arcade movement verb:

1. Hold Shift to preview the best amber lock.
2. Tap Space to cast.
3. The stick acquires one valid anchor inside the authored targeting envelope.
4. The tether pulls and redirects momentum for **0.22 s**.
5. The stick auto-vaults, preserving useful horizontal speed and guaranteeing a useful upward release.
6. Air Kick is refreshed so the player can continue improvising.

A second cast while the tether is active releases early. Recent anchors receive a short reuse lock so mashing one node cannot create an infinite elevator.

The target score is deterministic and considers:

- distance
- vertical advantage
- current movement direction
- whether an anchor is behind the player
- whether the player is falling / close to the threat
- whether the knot is an authored `sap-stick` route anchor
- recent-anchor reuse lockout

This gives the player aim assistance without turning the ability into autopilot. The route designer chooses *which* anchors exist; the target score chooses the most plausible one among those reachable anchors.

## Branchless route topology

v0.4 adds the `SAPRUN` grammar and allows a route tier to set `branch: false`.

A branchless tier creates an amber anchor but no collision platform. The important density contracts are:

- `GROVE`: 2 branches across 4 tiers
- `SAPRUN`: 2 branches across 5 tiers, with 3 branchless amber tiers
- `SLINGSHOT`: 2 branches across 4 tiers

The physical corridor is also widened to **760 px** (`x=100` to `x=860`).

This changes the visual/spatial rhythm from:

`branch → branch → branch → branch`

to:

`runway → open air → amber vault → amber vault → landing`

As difficulty rises, harder phases can use more `SAPRUN`, `SLINGSHOT`, `GROVE`, and `CRUX` without simply filling the viewport with smaller shelves.

## Anti-autopilot rules remain

The earlier 371× Flow failure remains a regression boundary.

Passive bark:

- does not score Flow
- does not refresh Air Kick
- is a low-energy redirect

Stride carry and combo acceleration remain bounded. CROWNVELOCITY still requires a meaningful Flow chain. Sap Stick adds route expressiveness rather than restoring automatic ping-pong climbing.

## Sequoia bark model

The supplied sequoia reference shows a specific morphology: weathered gray/mauve exterior flakes, cinnamon-red fibrous core, strong longitudinal tearing, overlapping curls, and puzzle-like adjacency.

The v0.4 renderer encodes this as a deterministic **shared-vertex anisotropic puzzle lattice**.

### Shared vertices

Each bark plate is a quadrilateral derived from four lattice vertices. Adjacent cells call the same deterministic `barkVertex(row, col)` function, so their boundaries fit exactly. There are no independent random polygons that can leave implausible gaps or intersections.

### Anisotropy

The lattice cells are much taller than they are wide. Their jitter is also biased so the pieces retain the vertical/stringy structure of mature sequoia bark rather than looking like generic rock tiles.

### Layered material

Every plate has:

1. a dark reddish fibrous under-layer
2. a weathered gray/mauve outer face
3. a dark seam around the shared boundary
4. clipped longitudinal fiber strands
5. an occasional deterministic curled flap exposing lighter material

The bark hash depends only on world-space row, column, and trunk side. It does not consume route RNG and therefore does not shimmer or change shape while the camera scrolls.

The exact collision boundary is still visible, but as a natural dark crease with a warm wood rim instead of a glowing artificial stripe.

## Pip visual target

Pip is now a mascot rather than a tiny generic climber silhouette:

- oversized expressive head and eyes
- leaf hood and tiny sprout
- orange/red speed scarf
- green leaf tunic
- tiny serious satchel
- oversized boots
- visible amber Sap Stick
- goofy grin / panic expression based on vertical state
- `GRIP!` cue during Bark Cling

The scarf remains velocity-readable, so personality is also movement feedback.

## HUD and tutorial language

The v0.4 HUD follows the approved concept direction:

- COMBO readout
- segmented FLOW bar
- three-stage MOMENTUM display
- compact floor / phase / score
- persistent bottom-left `SHIFT + SPACE · SAP STICK` keycap card
- early `SAP GAP` / `GROVE CHAMBER` tutorial card
- Shift-held `LOCK` preview on the selected amber anchor

## Telemetry

New counters are recorded dynamically:

- `sapStickCasts`
- `sapStickVaults`
- `sapStickRescues`
- `sapStickMisses`

Same-seed playtests should compare:

- branch density visible per camera window
- Sap Stick cast-to-vault success
- misses per attempted branchless route
- rescue casts vs normal casts
- Flow chain length
- peak/average speed
- Air Kick usage after Sap Stick vaults
- route completion by grammar

## Qualification boundary

A v0.4 head is not qualified until it passes:

- runtime syntax / deterministic invariants
- sparse-route density checks
- anti-autopilot movement envelope
- Sap Stick no-charge timing and anchor-reuse checks
- production build and runtime smoke
- one physical Space -> one jump action
- physical ground jump -> separate Air Kick
- physical Shift + Space -> Sap Stick without incrementing the jump request count
- Sap Stick auto-vault after its fixed tether
- Chrome Stable, Chromium, Firefox, and WebKit

The PR remains draft until those exact-head gates are green.