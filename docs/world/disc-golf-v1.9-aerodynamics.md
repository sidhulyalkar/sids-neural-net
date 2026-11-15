# Disc Golf v1.9: aerodynamic flight and measured-release roadmap

**Status:** Reduced-order physics implementation. Not a validated six-DOF model. Browser playtest, reference calibration and competitive balancing are still required.

## Scientific distinction: spin is not sideways thrust

A sport disc generates most of its lift from *forward flight through the air* and its shape. Spin makes the orientation resistant to angular disturbances. Aerodynamic pitching moment then produces gyroscopic precession and changes its bank; sideways lift from that bank curves the flight. A pure Magnus term is not an adequate model of a golf disc and must never be added just because RPM increases.

Core relations (forces in SI-style world units, world gravity maintained at 10.8 m/s²):
- Air-relative velocity `v_air = v_disc - v_wind`, `q=0.5 * rho * |v_air|²`.
- `CL(alpha) = clamp(CL0 + CL_alpha * alpha)`
- `CD(alpha) = clamp(CD0 + CD_alpha * (alpha-alpha_trim)²)`.
- `CM(alpha) = clamp(CM0 + CM_alpha * alpha)`.
- `F_lift = q A CL * normalized(n - dot(n,v_air_hat)*v_air_hat)`, perpendicular to air velocity.
- `F_drag = -q A CD * v_air_hat`, opposing air velocity.
- `a = (F_lift+F_drag)/m + g`.
- Gyroscopic bank precession in this reduced-order model: `roll_rate ≈ -k * q A diameter CM / (I_spin omega)` with explicit forehand/backhand sign. This is a *calibrated coupling approximation*, not full Euler rigid-body rotational dynamics.
- `omega(t + dt) ≈ omega(t) exp(-0.12 dt)` (hypothesized spin-down rate).

### Controls and their distinct meanings

- **Power** sets linear launch speed; **A/D** changes heading; **W/S** changes flight-path launch angle.
- **Q/E or the curve slider** sets *initial bank*, not mysterious sideways force.
- **Nose (-15° to +15°)** changes the disc plane's pitch relative to launch direction. At high angle of attack, lift, drag and pitching moment all change. A player can trade forward distance for float/height or stall risk.
- **Flick (200–1100 RPM)** independently sets axial spin, thus the angular momentum resisting pitching-induced bank changes. Backhand/forehand sets spin sense.
- **Disc:** putter/midrange/fairway/driver selects transparent nominal lift, drag and pitching-moment coefficient curves. No claim that these are measured proprietary disc molds, or that labeled speed/glide/turn/fade numbers uniquely determine actual coefficients. Profiles should be further tuned to match measured throw data.

The nose attitude and bank persist and evolve during flight. The disc's spin texture rotates using the integrated angular velocity, not an arbitrary constant. Trajectory preview, automatic power suggestion, Shasta's fetch target and live shot results share one simulator and cannot drift under identical release state and wind.

### Limits and next scientific tranche

The model treats yaw as aligned with the current air-relative horizontal heading. It **does not solve full rigid-body pitch/yaw rates, coupled inertia tensor, aerodynamic side force, turbulent separation, flutter, ground effect, impact bounce, rolling/sliding, or spatial wind shear**. Its values are deliberately marked nominal and are only constrained by qualitative regression tests. It must not be marketed as a quantitatively accurate predictor of a real commercial disc.

To calibrate properly, collect throws with known disc mass/diameter, release speed, axial RPM, 3D disc attitude (including nose and bank), wind and 3D tracked trajectory. Estimate the coefficient curves and moments with held-out trajectory fit. Benchmark late fade, early turn, throw range, time aloft, and angle sensitivity against *observed* throws. Use those data to choose whether a full six-DOF rigid-body model is warranted. Do not silently overfit to an arcade course.

### References

1. Crowther & Potts, *Simulation of a spin-stabilised sports disc*, Sports Engineering 10:3–21 (2007). DOI [10.1007/BF02844198](https://doi.org/10.1007/BF02844198).
2. Potts & Crowther, *Frisbee Aerodynamics*, AIAA 2002-3150. DOI [10.2514/6.2002-3150](https://doi.org/10.2514/6.2002-3150).
3. Kamaruddin, Potts & Crowther, *Aerodynamic performance of flying discs*, Aircraft Engineering and Aerospace Technology (2018). DOI [10.1108/AEAT-09-2016-0143](https://doi.org/10.1108/AEAT-09-2016-0143).
4. *Disc golf trajectory modelling combining computational fluid dynamics and rigid body dynamics*, Sports Engineering (2022). [DOI 10.1007/s12283-022-00390-5](https://doi.org/10.1007/s12283-022-00390-5).


## v1.10: disc-first camera, followed by Shasta

The shot is the hero, not the dog animation. On an accepted release, cancel any old fetch sequence and show the **actual flying disc**, following its live velocity with an elevated tracking camera on drives. Close putts retain a broad, stable third-person view that keeps the entire short throw visible. The camera and flight use the same renderer state; there is no prerecorded shot reconstruction.

When the disc reaches a valid lie or chains, leave the camera on the landing point for **0.85 seconds** to establish the result. Shasta is deliberately held at his existing position during the entire flight *and* landing reveal; never target the relocated player, which teleports to the lie as part of the existing controls. After the hold, let Shasta accelerate toward the fixed target using the existing obstacle-aware, water-avoiding terrain-following dog locomotion. Show his initial run for **0.95 seconds** from a higher trailing shot before blending to his **dog-eye camera**. This POV uses his actual interpolated world position, low to the terrain, pointed toward the discovered disc, and stays through his brief find/sniff (1.65 seconds). Return smoothly to player-controlled third-person framing afterward. No extra HUD prose.

The finite states are **idle → flight → landed → chase → found → idle**. A splash, cancellation, exit, new hole, or new throw clears the previous shot story. An unreachable disc times out after 14 seconds of chase. The score, gates, physics, and player's lie never depend on the camera or fetch phases. `prefers-reduced-motion` disables the automatic cinematic transitions and fast flight-follow framing.

Browser acceptance: on Hole 1, capture disc-flight, landing-reveal, Shasta run-up and Shasta POV frames with `scripts/playtest-disc-golf.mjs`; check the on-canvas diagnostic `data-disc-golf-cinematic-stage`. Verify short putting, mountain shots, steep slopes, water retries, rethrows during a chase, Shasta unable to reach the lie, fast hole switching, and normal follow behavior after exit. Screenshots must be inspected manually before claiming visual signoff. Do not let Shasta's viewpoint tunnel through terrain or abruptly snap between phases.

## v1.11: deferred player handoff after Shasta finds the disc

The explorer is the **thrower**, not the camera's moving target. During disc flight, aerial landing reveal, Shasta's initial run, and the subsequent low dog-eye view, keep the explorer model and the renderer's physical `player` at the **previous lie / tee**. The disc physics independently commits `discGolf.lie`, strokes, gates, and shot outcome as soon as it lands. Neither that physics result nor the live landing beacon implies that the explorer has moved.

The fetch presentation has five ordered states: `flight → landed → chase → found → idle`. `landing` holds 0.85 seconds, `chase` always lasts long enough for the 0.95-second initial run and dog POV cut, and `found` stays on Shasta for 1.65 seconds. Only the transition **from found to idle** authorizes relocating the explorer to the committed lie (or basket position for a holed shot). Existing terrain support and heading calculation determine the new avatar pose. Fade back smoothly to the third-person camera, retaining any completed gate progress. Do not teleport the player at touchdown.

**Deadlock protection:** If Shasta cannot reach the disc, the existing 14-second post-landing chase timeout authorizes a safe fallback transfer to the correct lie. A new hole, explicit exit, rejected throw, water retry or canceled flight must never accidentally transfer to a stale destination. The HUD's `presentationPending` lock prevents repeated throws and next-hole navigation until the handoff completes. Preserve the score in memory on a legitimate basket catch, but defer opening the scorecard until after Shasta's view. Keep normal controls available immediately on free water redos.

**Verification:** Browser `data-disc-golf-avatar-x/z` must equal the original throwing position throughout `disc`, `landing`, `chase`, and `shasta` camera stages. `data-disc-golf-lie-x/z` tracks the independently landed disc. After `data-disc-golf-handoff=complete` and `data-disc-golf-handoff-reason=found`, player coordinates must equal the disc's committed lie. Pure tests cover no premature handoff, short-putt POV, basket vs previous lie, no duplicate transfers, cancellation and timeout. The browser playtest script checks all these coordinates on Hole 1 and waits for an unlocked handoff before selecting subsequent holes. Actual browser visual signoff is not implied by passing TypeScript or unit contracts.

## v1.12: low-profile bottom HUD

The Disc Golf overlay must not obscure the thrown disc, the explorer, the upcoming gate, or Shasta. Retire the old 410px-wide right-hand stack of always-visible controls. Default to a **nearly screen-wide bar along the bottom edge** (approximately 76px minimum high at desktop sizes) containing only the current funny hole name, par, strokes, next gate/remaining distance, wind, aim/loft/curve readouts, slim power meter, primary throw/next-hole action, and `Tune / Course / Exit` buttons.

The thin bar is the **only** always-visible Disc Golf UI. The `Tune` button opens an accessible, scrollable panel **above** the bar with touch-friendly sliders for aim, loft, bank, nose, spin, disc profile, and throw style. The `Course` button opens the hole selector, scorecard, saved best and new-round actions. Neither panel should occupy the throw view by default. Launching a shot collapses optional panels so the entire disc-flight, landing reveal, Shasta chase and dog-eye POV remain prominent. Independent hotkeys (A/D, W/S, Q/E and Space) preserve the original mechanical controls.

At 900px and narrower, the bar may wrap into compact rows, retaining the primary power and throw controls as visible touch targets. The 390px test viewport must keep the entire HUD within bounds and the resting bar under 170px tall. Account for device safe areas. Hide redundant global location, discovery and WASD hints while Disc Golf is active, so they cannot compete with the bottom bar.

The optional browser playtest `scripts/playtest-disc-golf.mjs` asserts the idle desktop geometry, mobile dimensions, default-collapsed controls, functionality of both popovers, and the full nine-hole throwing/fetch progression. These structural checks do not replace screenshots or a manually inspected responsive browser QA pass.

## v1.14: kinetic throw rail in the compact HUD

The default Disc Golf bar now contains a tactile launch rail rather than a passive 13px progress strip. It features a horizontally graduated strength ruler, an engraved disc-shaped moving grip, a subtly glowing fill, a precise ±6-point ideal-power band, and an independent target tick. When charging with Space, the existing `discGolfPullback` power cycle animates the same grip; quick Space taps still commit suggested power.

**Direct pointer interaction:** Press anywhere on the rail, drag the grip left for a softer shot or right for a stronger shot, then release to launch exactly once. Track coordinates map linearly to 4–100 power with clamping at either edge, and the same `DiscShot` is sent to the flight solver as a keyboard throw. The live trajectory preview updates in power buckets during dragging to protect performance. Pointer cancel or window blur aborts safely without consuming a stroke. The result stays visible in the rail until Shasta finishes retrieval.

**Keyboard access:** Focus the rail, use arrow keys for ±1, PageUp/PageDown for ±10, Home/End for min/max, Enter to throw at the chosen power, and Escape to restore recommended power. When focused, these keys must not accidentally turn the player or change aim. The ordinary global A/D, W/S, Q/E and Space mechanics are preserved. Semantics use an ARIA slider with displayed value, suggested-power description, disabled state during flight/fetch, and clear focus styling.

**Art and performance:** Typography and visuals remain restrained and natural: warm parchment/brass disc grip, sea-glass fill, small ruler ticks, no colored status callouts or large floating annotations. The rail expands horizontally on desktop but remains in the original thin bottom HUD, wrapping beneath the shot status on mobile. Motion-reduction preference removes handle and fill transitions. No new Three.js draw calls, textures, network assets or large JS animations are required.

**Release gate:** Keep the existing World typecheck/lint/flight tests and the new pure `discGolfPowerRail` bounds/target tests passing. Run `scripts/playtest-disc-golf.mjs` on the actual site to verify pointer drag, keyboard editing, desktop/mobile width, unobstructed flight, and a real accepted throw. Those browser assertions are authored but should not be reported as passed until run and visually inspected.
