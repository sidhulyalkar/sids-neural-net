# Sylvaria: Sequoia v0.3 — Aerial Combo Architecture

## Why v0.3 exists

The v0.2 playtest showed a structural problem: the game rewarded multi-floor landings, but did not give the player enough ways to remain airborne. A normal +1 landing banked the combo immediately and a second jump was not available. The result read as platform hopping rather than kinetic climbing.

v0.3 changes the scoring and movement grammar so a long combo is a sequence of distinct movement decisions rather than a side effect of landing high enough.

## The renewable Air Kick

The player starts each grounded launch with one airborne **Air Kick**. Pressing jump again while airborne consumes it.

The Air Kick is momentum-preserving rather than a generic reset. It keeps the existing horizontal commitment, adds a bounded directional impulse, and adds vertical lift from current horizontal speed. Reverse-direction Air Kicks are deliberately weaker so velocity commitments still matter.

The Air Kick refreshes only after skilled traversal interactions:

- threading a Resin Ring;
- hitting sequoia bark above the rebound-speed threshold;
- producing a strong Sapline release;
- entering CROWNVELOCITY;
- landing, which restores the ordinary baseline charge.

This allows very long aerial routes without giving the player unconditional flight.

## Flow links

The combo counter is now a **Flow chain**. A link can come from several movement families:

- `AIR`: Air Kick;
- `BARK`: skilled wall rebound;
- `SAP`: strong Sapline release or SAP SURGE;
- `RING`: Resin Ring thread;
- `SKIP`: multi-floor landing;
- `BURL`: launch from a marked Launch Burl.

Ordinary +1 landings no longer instantly bank a live chain. They grant a short continuation grace period. A Recovery shelf banks the chain only if the player remains grounded on it long enough. Hesitation still drains Flow aggressively.

Repeated identical links have a short duplicate cooldown, and CROWNVELOCITY requires movement variety rather than raw repetition.

## Sap escalation

At **5× Flow**, a Sapline stretched beyond the surge threshold becomes **SAP SURGE** on release. The stored spring impulse receives a bounded multiplier, gains extra upward conversion, counts as two Flow links, and refreshes Air Kick.

At **7× Flow**, once at least three distinct movement families have been used, **CROWNVELOCITY** starts. CROWNVELOCITY increases Sap pumping, strengthens bounded Sap release conversion, widens the camera slightly, intensifies speed feedback, and refreshes Air Kick on entry.

A representative high-level route is therefore:

`Launch Burl → Air Kick → Resin Ring → bark rebound → Air Kick refresh → Sap attach/pump → SAP SURGE → Air Kick → multi-floor skip → CROWNVELOCITY`

The system is intentionally open-ended. Rings, bark, and Sap can refresh the Air Kick again, so a skilled player can continue chaining as long as the route and execution support it.

## New route objects

### Resin Rings

Resin Rings are visible aerial gates. Passing through one adds Flow and refreshes Air Kick. A high-speed thread counts double, rewarding committed trajectories rather than slow steering through the center.

Ring radius shrinks progressively with altitude.

### Launch Burls

Some branches carry a glowing resin burl near their intended takeoff point. Jumping within the burl radius adds bounded vertical and horizontal launch energy and creates a Flow link.

They make route intent readable before takeoff and give authored grammars explicit launch punctuation.

## Progressive tower chapters

Difficulty is compositional rather than a single global distance multiplier.

### ROOTWAYS — floor 0+

Wide FLOW and RECOVERY geometry teaches Air Kick, rings, burls, and basic Sap timing. Fire pressure is reduced.

### REDWOOD RUN — floor 24+

CRUX chunks enter the rotation. Branches begin narrowing and route sequences increasingly pair rings with Sap targets.

### SAPWORK — floor 60+

SLINGSHOT and CRUX frequency increases. Aerial refreshes become important for efficient ascent, and threat pressure reaches normal-to-high levels.

### HIGH CANOPY — floor 105+

Narrower branches, smaller rings, larger vertical deltas, more SLINGSHOT/CRUX composition, and stronger pressure reward pre-planned aerial chains.

### CROWNLINE — floor 155+

The route sequence heavily favors CRUX and SLINGSHOT. The game expects the player to combine bark, rings, Air Kick and Sap rather than solve each branch in isolation.

Geometry remains bounded so the generator cannot create impossible quadratic difficulty spikes.

## Combo decay

Flow time decays at different rates depending on player commitment:

- Sapline: very slow decay;
- strong upward ascent: slow decay;
- high horizontal momentum: moderately slow decay;
- immediate post-landing continuation grace: slow decay;
- low-speed hesitation: 2× decay.

This makes the timer describe kinetic intent instead of wall-clock time alone.

## Telemetry added in v0.3

In addition to v0.2 movement metrics, the run JSON now records:

- double-jump count;
- Air Kick refresh count;
- Air Kick launch speed;
- Flow link count and mean interval between links;
- Launch Burl activations;
- Resin Rings threaded;
- SAP SURGE count;
- maximum Flow chain;
- CROWNVELOCITY entries;
- route completion by grammar and altitude phase.

The primary tuning question is no longer merely “can the player skip branches?” It is whether the player can deliberately sustain a heterogeneous aerial chain.

For same-seed comparisons, useful targets are:

- airborne ratio should increase without making grounded Recovery shelves irrelevant;
- double-jump usage should be common, but refreshes should come predominantly from skilled interactions rather than landings;
- mean Flow-link interval should remain comfortably below the hesitation timeout during successful routes;
- Sap release gain should rise when Flow is high, without unbounded peak velocity;
- high-altitude CRUX completion should fall gradually, not collapse at a single phase boundary;
- long chains should correlate with movement-family variety and lower Momentum Burn frequency.

Use `R` for the same seed, `N` for another route, `T` for the live panel and `J` for the complete run JSON.
