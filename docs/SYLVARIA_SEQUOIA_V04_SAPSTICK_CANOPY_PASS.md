# Sylvaria: Sequoia v0.4 - Crown Trail + Sap Stick Canopy

## Why this pass exists

The sparse-canopy direction is working, and the latest playtests confirm that the movement recovery plus one-button Shift Sap Stick made ordinary climbing substantially smoother. The newest recording also exposed the next two problems clearly:

1. the permanent left HUD rail, game logo, and repeated control cards consume too much of the actual playfield;
2. once the player understands Shift, a normal Sap vault can be repeated so often that the Flow counter becomes enormous and stops communicating mastery.

In the uploaded run the visible Flow count climbed past 200. That is not a satisfying long-term reward loop. It means the traversal verb itself was manufacturing score faster than the player was making meaningful decisions.

v0.4 therefore moves toward a clearer identity:

> **The forest is the interface.** The player chases visible Crown milestones through an increasingly exposed canopy. Easy inputs make movement expressive; clean execution, route reading, and altitude pressure make mastery difficult.

## Canonical Sap Stick input

Desktop input remains intentionally one button:

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

A press that happens a fraction early should not turn into a dead input. Sap Stick has a **0.18 s acquisition buffer**. If no knot is reachable on the exact keydown frame, the held input may acquire one that becomes reachable during that short window.

This is intentionally bounded. It is not a persistent tractor beam and it does not search indefinitely while Shift is held.

The target score remains deterministic and considers distance, vertical advantage, movement direction, whether an anchor is behind the player, rescue state, authored `sap-stick` priority, and recent-anchor reuse lockout.

## Hold-to-swing movement contract

The player-facing lifecycle is:

1. Press Shift.
2. Sap Stick fires immediately when a valid knot exists.
3. A tiny **0.075 s internal minimum** filters one-frame key jitter. This is not a timing challenge.
4. Hold Shift and steer with A/D or Left/Right.
5. Sap Stick suppresses the old tangent-pump input mapping and gives direct screen-horizontal steering authority, so controls never invert around the anchor.
6. Release Shift when the line looks right.
7. The release preserves useful momentum, guarantees useful upward motion, and refreshes Air Kick.
8. A **1.35 s safety ceiling** prevents pathological indefinite tethers.

Recent anchors retain their reuse lock, so one knot cannot become an infinite elevator.

## Clean Sap instead of free Flow

One-button Sap must stay easy to use without making the combo economy automatic.

A normal Sap vault is now **connective movement**. It preserves a live Flow timer briefly, but does not mint a SAP combo link simply because the player used Shift.

A **Clean Sap** earns the SAP link only when the release demonstrates an intentional swing:

- release is player-authored rather than blur/safety forced;
- tether age is between **0.16 s and 0.82 s**;
- horizontal release speed is at least **330 px/s**.

The window is deliberately wide. It rewards shaping a useful launch, not frame-perfect timing. This restores meaning to the Flow counter while keeping Sap Stick forgiving.

## Reset input safety

`R` is not a retry key. The current-seed reset is **0 / Numpad 0**, deliberately away from A/D, W, Space, and Shift. `N` remains new route and `P` remains pause.

## The Crown Trail motivation loop

The climb now has a visible short-horizon objective instead of only an abstract high score.

### Crown Marks

Every **25 floors** is a Crown Mark. The next mark appears as a subtle golden world-space gate in the canopy. Crossing it awards score, a brief visual/audio celebration, and increments the run's Crown count.

The intended loop is:

`current floor -> visible next Crown -> cross it -> new Crown appears above -> chase again`

The next target is always close enough to feel attainable, while a strong run naturally chains many milestones.

### Persistent personal best

The game stores:

- highest floor reached;
- best Flow combo.

The minimal top ribbon shows the current floor, next Crown distance, and persistent PB. Game over also tells the player how many floors remain to the next Crown target. This gives an immediate reason for “one more run” without adding menus, currencies, or upgrade grind.

### Route clear rewards

Finishing a generated route chunk adds a small score bonus and telemetry event. This rewards surviving a whole movement phrase, not just farming one mechanic repeatedly.

## Branchless route topology

Base v0.4 route language remains:

- `GROVE`: broad runway plus branchless amber traversal;
- `SAPRUN`: three branchless amber tiers between real landing branches;
- `SLINGSHOT`: alternating open-air Sap line;
- `CRUX`: tighter conventional precision route.

The physical corridor remains **760 px** wide (`x=100` to `x=860`).

The visual/spatial rhythm is therefore:

`runway -> open air -> amber swing -> amber swing -> landing`

rather than a shelf ladder.

## Canopy escalation: difficulty changes shape with altitude

Difficulty should not mean “the same game but everything moves faster.” It now increases across several dimensions.

### 1. Route geometry

The existing geometry scaler shortens branches, increases vertical spacing slightly, and permits stronger slopes as altitude rises. ROOTWAYS stays generous; HIGH CANOPY and CROWNLINE have much less disposable landing surface.

### 2. New expert route families

Three later-canopy grammars are added:

- **WINDLINE**: exposed cross-anchor movement interrupted by a small precision landing;
- **SKYHOOK**: three branchless anchors with alternating lateral reads before a compact landing;
- **CROWNWEAVE**: repeated cross-corridor Sap decisions with very little shelf relief.

These enter gradually. They do not replace the teaching routes at floor zero.

### 3. Deterministic crosswind

Crosswind begins only after roughly **floor 46**, after the player has had time to learn running, Air Kick, Bark, and Sap.

Wind strength grows by altitude:

- lower REDWOOD RUN: light breeze;
- SAPWORK: noticeable correction pressure;
- HIGH CANOPY: strong gusts that influence open-air trajectories;
- CROWNLINE: exposed, changing wind requiring active steering.

Wind is deterministic from run seed, floor, and simulation time. It does not consume route RNG. It is strongest while airborne, heavily reduced while tethered, and almost absent while actively moving on the ground. A player who stalls on a high branch becomes more vulnerable to the gust, encouraging forward rhythm without simply stealing control.

The renderer exposes wind with sparse directional streaks and a tiny contextual arrow, so difficulty remains readable rather than invisible.

### 4. Rising canopy pressure

The existing upward threat continues to accelerate with floor/time. HIGH CANOPY and CROWNLINE now apply stronger phase pressure, so late play asks the player to solve harder routes while maintaining cadence.

### 5. Combo discipline

Because ordinary Sap no longer awards free Flow, CROWNVELOCITY and large combo values once again require a mixture of real scoring verbs: multi-floor skips, rings, burls, Bark Kick, Air Kick, and Clean Sap.

## Minimal gameplay HUD

The latest playtest showed the large left rail and permanent title made the playable corridor feel artificially narrow.

During active play:

- the large left COMBO/FLOW/MOMENTUM panel is suppressed;
- the permanent top-left game logo is suppressed;
- the old bottom-left Shift + Space panel is suppressed;
- the old right-side Sap tutorial card is suppressed;
- no opaque replacement rectangle is painted over those areas, so branches and Pip remain visible underneath.

The replacement is a thin top-edge ribbon:

- current floor + phase on the left;
- next Crown progress in the center;
- PB + score on the right;
- Flow appears only when a chain is active;
- wind appears only when meaningful.

Sap instructions are transient: a small bottom-center pill teaches the control during the first seconds, reappears briefly on relevant advanced routes, and becomes an active “A/D swing / release Shift” cue only while tethered.

The title screen remains a real title screen. Once play begins, a much smaller **SYLVARIA · SEQUOIA / CLIMB THE CROWN** mark fades away over roughly 1.65 seconds and then leaves the screen entirely.

## Sequoia visual identity

The production renderer continues using deterministic puzzle-fit sequoia bark, deep flake shadows, longitudinal fibers, moss/lichen/resin ecology, atmospheric scattering, cloud wisps, distant birds, and the mascot-scale Pip.

The new progression elements are intentionally diegetic or peripheral:

- Crown targets exist in world space;
- wind is visible as sparse environmental motion;
- phase arrival gets a brief typography beat;
- PB and Crown celebrations fade quickly.

Nothing should sit permanently in the middle of the climb.

## Anti-autopilot regression boundaries

Passive bark:

- does not score Flow;
- does not refresh Air Kick;
- remains a low-energy redirect.

Ordinary Sap Stick:

- does not score Flow automatically;
- may briefly preserve an existing chain;
- refreshes Air Kick after the vault;
- only Clean Sap earns the SAP link.

Stride carry and combo acceleration remain bounded. Wind cannot rewrite route generation. Render effects cannot alter collision geometry.

## Telemetry

In addition to existing movement metrics, the current pass records:

- `sapStickCleanVaults`;
- `sapStickFlowCarries`;
- `crownMarks`;
- `routesCleared`;
- `personalBestFloors`;
- `windReversals`;
- wind exposure time;
- maximum experienced wind.

Same-seed playtests should compare Crown cadence, PB progression, late-route completion, Clean Sap rate, combo inflation, wind corrections, Flow chain length, speed, Air Kick use, and failure location by phase.

## Qualification boundary

A v0.4 Crown Trail head is not qualified until it passes:

- runtime syntax and deterministic invariants;
- early movement/jump envelope;
- sparse-route density checks;
- delayed and bounded crosswind checks;
- late route-family presence;
- Crown interval and persistent-PB contracts;
- Clean Sap economy checks proving ordinary Sap cannot manufacture Flow;
- production build and runtime smoke;
- one physical Space -> one jump action;
- ground jump -> separate Air Kick;
- Shift alone -> Sap Stick cast;
- held Shift + A/D -> player-owned swing steering;
- Shift release -> vault + Air Kick refresh;
- Space during tether -> no hidden Air Kick;
- 0 -> same-seed retry;
- R -> harmless;
- minimal gameplay HUD contract;
- title fade contract;
- Chrome Stable, Chromium, Firefox, and WebKit.

The PR remains draft while gameplay feel is still being tuned, even when exact-head qualification is green.
