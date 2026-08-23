# Sylvaria: Sequoia v0.2

Sylvaria: Sequoia is the kinetic vertical-climber branch of Sylvaria. The prior Sylvaria/Mosslight exploration and combat work remains preserved in repository history and its existing feature branches. This game does not inherit combat as a primary loop.

## Experience thesis

The game should be legible in seconds and expressive for hundreds of runs.

Its replay loop is deliberately compact:

1. accelerate horizontally,
2. convert momentum into height,
3. skip branches to build a combo,
4. use bark rebounds and Sapline timing to preserve or multiply flow,
5. bank a combo for safety or extend it for score,
6. survive pressure from the rising fire,
7. restart with almost no friction.

The design borrows a structural lesson from classic momentum climbers without reproducing their content: simple controls can support a deep mastery curve when velocity, jump height, multi-floor skips, combo fragility, scrolling pressure, and instant retries all reinforce one another.

## Pip and the Sap Stick

Pip is a small canopy runner with leaf ears, an animated leaf scarf, acorn boots, expressive face states, squash/stretch, and a resin-glowing Sap Stick.

The Sap Stick is traversal-only. It does not attack enemies. Holding `Shift` or `E` attaches an elastic Sapline to a reachable Resin Knot. Left/right input pumps tangential velocity. Releasing converts stored stretch and swing direction into a bounded impulse.

## Authoritative simulation

Physics advances at exactly 120 Hz and rendering interpolates between simulation states.

Rendering never consumes route-generation random numbers. Route topology and visual particles use separate deterministic RNG streams so frame rate, camera shake, or particle count cannot alter future geometry.

All major feel constants live in the `TUNE` object in `00-core.js`. Browser playtests can inspect or temporarily change numeric tuning values through `window.SYLVARIA_SEQUOIA_DEBUG.setTuning(section, key, value)` without rewriting the engine.

## Phase 1: kinetic calibration

### Horizontal movement

Ground acceleration is intentionally aggressive. Air acceleration falls as speed approaches the current ceiling, and reversing direction in the air is weaker than continuing an existing commitment.

This gives the player useful micro-correction without making a high-speed launch steer like a cursor.

### Momentum jump

Jump velocity is bounded:

```text
jumpVy = base + min(momentumCap, abs(vx) * momentumGain) + comboLift
```

Velocity therefore matters immediately but cannot explode quadratically.

### Bark rebound

A wall impact retains most incoming horizontal speed, reverses direction, adds a small horizontal rebound bonus, and converts a bounded portion of incoming speed into vertical lift.

The sequoia surface also contains periodic kinetic sweet spots. These provide a subtle ±8.5% rebound modifier. The visual renderer marks favorable bark regions softly, so route reading can become a learned skill rather than hidden randomness.

### Sapline

The Sapline is a damped elastic constraint:

- stretch produces radial spring force,
- radial velocity produces damping,
- left/right produces tangential pump acceleration,
- CROWNVELOCITY increases pump acceleration,
- release uses maximum stored stretch and current tangent direction,
- the release impulse is capped.

A good release should usually improve the player's trajectory, but a Sapline should not be a guaranteed speed button. Timing and route geometry remain meaningful.

### Threat pressure

The fire is not a constant-speed death plane.

Its target is a pressure band roughly 455 world units below Pip. If Pip opens a huge lead, the fire accelerates. If the fire is already crowding Pip, it slows. Time and altitude still raise the baseline pressure, and the final speed remains clamped.

This is designed to sustain tension while avoiding invisible rubber-band cheating. Telemetry exposes both the instantaneous threat speed and the player's gap.

## Phase 2: authored procedural route grammars

Individual branches are no longer independently random. The generator emits named kinetic chunks.

### FLOW

Five alternating left/right branches with generous widths and selected Resin Knots. FLOW should reward maintaining rhythm and make multi-floor combo chaining readable.

### CRUX

Four narrower branches with larger vertical separations and cross-chute Resin Knots. CRUX asks for an explicit commitment such as a bark rebound into a fast Sapline catch.

### RECOVERY

A broad central shelf followed by wider alternating branches. RECOVERY intentionally provides a place to bank a combo, understand the next route, and rebuild speed after a high-risk sequence.

### SLINGSHOT

A knot-dense sequence with taller gaps. It is the clearest invitation to use Sapline pumping as a momentum bank rather than treating the tether as emergency traversal.

The initial grammar cadence is:

```text
FLOW → FLOW → CRUX → RECOVERY → FLOW → SLINGSHOT → CRUX → RECOVERY
```

The sequence repeats while altitude gradually increases spacing and decreases branch width. Small seeded jitter keeps repeated runs alive without destroying the authored kinetic topology.

## Phase 3: CROWNVELOCITY rhythm

A landing at least two floors above the previous successful landing counts as a combo skip.

Four consecutive combo skips ignite `CROWNVELOCITY`.

CROWNVELOCITY deliberately preserves learned physics. It increases the speed ceiling modestly and Sapline pump gain, while most of the transformation is sensory:

- low-frequency drop plus ascending harmonic response,
- wider 2D camera view,
- stronger speed streaks,
- Pip afterimages,
- more aggressive scarf extension,
- brighter resin feedback,
- clearer combo typography.

### Dynamic combo decay

The nominal combo window is 2.72 seconds, but elapsed real time is not treated uniformly.

- During strong upward ascent (`vy > 260`), decay runs at roughly 0.52× speed.
- During low-horizontal-momentum hesitation (`abs(vx) < 135` and low vertical motion), decay runs at roughly 1.90× speed.
- Otherwise decay is normal.

The result rewards committed flight time while making indecision on a shelf expensive.

## Failure and recovery

Fire contact first causes `MOMENTUM BURN`:

- horizontal velocity is heavily reduced,
- the current combo is banked/lost,
- Pip receives a small upward shove,
- the run continues.

Banked combos fill Resin. A full Resin meter awards a `SAP CATCH`, with up to two stored catches. A sufficiently deep fall spends one catch and launches Pip back into the chute. Falling farther without a catch ends the run.

The failure ladder is therefore:

```text
miss → momentum damage → scramble → optional earned recovery → death
```

rather than every imperfect release becoming an instant restart.

## Telemetry: how we test feel empirically

Press `T` during a run to show the live telemetry panel. Press `J` to copy the complete JSON record. Press `R` to retry the exact same seed and `N` for a new seed.

### Movement rhythm

We record:

- total airborne and grounded time,
- average and peak total speed,
- average and peak horizontal speed,
- peak upward velocity,
- average airborne segment duration,
- time spent below the low-momentum threshold.

These tell us whether a tuning change creates sustained kinetic flow or excessive stop/start play.

### Bark rebound quality

For every qualifying wall rebound we record:

- incoming horizontal speed,
- outgoing/incoming horizontal retention,
- vertical lift,
- local bark sweet-spot multiplier.

A rebound system that feels inconsistent should show excessive unexplained spread. A system that feels dead should show low retained velocity and few follow-up skips.

### Sapline usefulness and mastery

We record:

- attach attempts,
- successful attachments and misses,
- attachment rate,
- attached duration,
- maximum line stretch,
- speed change at release.

The target is not 100% attach success or positive gain on every release. If those metrics become perfect, targeting may be trivial and the Sapline may have lost its skill expression. We instead compare how these values evolve with player familiarity and tuning changes.

### Combo and CROWNVELOCITY

We record:

- multi-floor skip count,
- floors skipped per qualifying landing,
- combo duration,
- maximum combo,
- bank, timeout, and drop endings,
- CROWNVELOCITY entry count and uptime.

This shows whether CROWNVELOCITY is aspirational-but-reachable rather than either invisible or automatic.

### Threat fairness

We record:

- minimum threat gap,
- average threat gap,
- percentage of time near the fire,
- Momentum Burn count,
- Sap Catch deployments.

The desired pattern is sustained pressure with recoverable mistakes. Frequent Burns during FLOW or RECOVERY are a red flag. Burns concentrated after CRUX sequences can be desirable if the same sequences remain learnable.

### Route grammar quality

For every FLOW, CRUX, RECOVERY, and SLINGSHOT chunk we record:

- generation count,
- attempts,
- completions,
- failures,
- completion rate,
- average successful traversal time,
- Burns,
- Sap Catches.

This lets us identify actual difficulty cliffs. If one CRUX has dramatically lower completion rates while adjacent FLOW sections are trivial, we tune the route rather than globally changing gravity or jump power.

## Calibration method

The key comparison unit is the same seed under two tuning profiles.

A useful tuning session should:

1. play a seed several times until the route is understood,
2. copy telemetry,
3. adjust one feel family such as rebound retention or Sapline pump gain,
4. retry the same seed,
5. compare both subjective control quality and objective metrics,
6. repeat on multiple seeds before promoting the change.

No single metric is an acceptance criterion. The goal is a coherent movement signature: meaningful velocity commitments, frequent but earned airborne flow, readable recovery windows, useful Sapline decisions, and a combo system that rewards aggression without becoming mandatory autopilot.

## Current controls

Desktop:

- `A/D` or arrows: run, air-correct, and pump Sapline swings.
- `Space`, `W`, or up arrow: jump.
- Hold `Shift` or `E`: attach Sapline.
- Release `Shift` or `E`: slingshot.
- `T`: telemetry overlay.
- `J`: copy run telemetry JSON.
- `R`: retry identical route seed.
- `N`: start a new route seed.
- `P`: pause.

Touch exposes four large lower-screen zones for left, right, jump, and Sapline.

## Next tuning boundary

v0.2 intentionally stops before adding enemies, collectibles, biomes, progression trees, or narrative systems. The next promotion criterion is simple: the movement loop should remain enjoyable for repeated sessions even if the score HUD is ignored.
