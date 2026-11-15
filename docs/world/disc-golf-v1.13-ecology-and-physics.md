# Disc Golf & World Ecology: long finale, flight physics, and environmental QA

Status: implemented on `feat/sids-world`. Automated checks verify deterministic functionality, but the **rendered course and ecological scenery still require manual browser inspection**.

## Hole 9: the grand traverse

Nine-hole finale moves from the previous ~96 world-unit walk to approximately **309 world units**. The tee stays at (46,49), and the basket stays at (-24,-15). The required route visits **eight** distinct 9-world-unit-radius luminous arches, in order:

(43,17) → (45,-9) → (45,-34) → (26,-69) → (5,-62) → (-15,-47) → (-16,9) → (-24,38) → chains (-24,-15).

The player may use multiple shots per segment and recover missed gates from either side. The more involved course has par **11**, not 5. Because the layout and par change materially, saved scores receive a new course version (`disc-golf-v1.10`). No previous short-course strokes are retroactively reassigned. The analytic course audit checks tee/basket clearance, leg lengths, gate staging throws, slopes, water, and fixed landmarks, but this does not certify the waterfall, canopy occlusion, Shasta POV, or visual gate visibility.

## Critique of the flight model

Existing `discGolfAerodynamics.ts` is a deterministic, reduced-order simulator. It implements lift and drag acting on air-relative velocity, torque-induced gyroscopic bank precession, finite spin and spin decay, and separate nose/loft/bank controls. Preview and live flight use the same integrator. **It is not a six-degree-of-freedom rigid-body model and must not be advertised as physically accurate to real measured discs**.

Specific scientific gaps and priority:

1. **Measure aerodynamic coefficients per disc mold.** Coefficients `CL(alpha)`, `CD(alpha)`, and `CM(alpha)` are nominal linear/quadratic curves with clamps, not fitted to real disc-golf molds. A credible model needs wind-tunnel/CFD or measured free-flight data, with uncertainty and cross-validation. `CM` and lift-to-drag ratio are major predictors of turn/fade and glide (Kamaruddin et al., 2018).
2. **Full 6-DOF rotation.** Yaw follows travel by assumption, pitch is approximately fixed, and roll uses a reduced-order torque term with an empirical multiplier. That misses wobble, nutation, coupled inertial response, spin-axis tilt, and aerodynamic roll/yaw damping. Replace the approximation with quaternion attitude plus full inertia tensor and calibrated moment coefficients before claiming true physical fidelity.
3. **Spin is not a sideways motor.** Lift originates primarily from air-relative translation; angular momentum stabilizes the spinning disc. Spin magnitude changes gyroscopic precession under aerodynamic moment. The Magnus contribution is not the dominant source of disc golf glide or curvature.
4. **Release coupling and wind.** Independent settings for RPM, nose, loft, bank and linear speed are useful for experimentation but humans naturally couple these through grip and throw mechanics. Later, offer release presets based on measured correlations rather than forcing every control. Include vertical gusts and spatially varying wind for the exposed mountain ridge.
5. **Terrain landing.** The current disc typically stops on first ground contact. A physically defensible finish needs orientation-dependent rim strikes, restitution, tangential friction, skips, slides, rolls and downhill escapes, with appropriate water/OB logic. This has not yet been implemented.
6. **Numerics and validation.** Compare the live/preview integrator against recordings and multiple numerical step sizes. Benchmark early high-speed turn, late low-speed fade, range, apex, time aloft, and final approach angle across RHBH/forehand releases and distinct RPM. Never change coefficients solely to engineer a guaranteed ace.

Useful sources:
- [Kamaruddin, Potts & Crowther, Aerodynamic performance of flying discs (2018)](https://doi.org/10.1108/AEAT-09-2016-0143)
- [Disc golf trajectory modelling combining CFD and rigid body dynamics (2022)](https://doi.org/10.1007/s12283-022-00390-5)
- [UC Davis Frisbee flight simulation and biomechanics](https://research.engineering.ucdavis.edu/biosport/sample-page/test-page-1/frisbee-flight-simulation-and-throw-biomechanics/)
- [Measurement of Flight Dynamics of a Frisbee Using a Triaxial MEMS Gyroscope (2020)](https://www.mdpi.com/2504-3900/49/1/66)

## Habitat debugging and art direction

- **Squirrels and small animals:** Avoid per-frame heading snaps when roaming or switching flee targets. The new pure steering function caps heading change, uses a short panic hysteresis and respects home range/water. Gait uses displacement rather than artificial oscillations. Wildlife regression tests check that no instant turn reversal can occur.
- **Rainforest snakes and leaves:** Reptiles now have full modeled trunks and continuous branches beneath their perches, not disconnected hovering limbs. Major crown blades have visible stems connecting to modeled trunk branches. Vines (lianas) descend from supported branch forks without intersecting the ground.
- **Localized tropical weather:** Four small cloud clusters above the rainforest and one faint animated streak layer; no island-wide rain and no GPU particle storm. Weather shares small geometry buffers and uses deterministic elapsed time.
- **California woodland:** Add coast live oak, tanoak, madrone, and Douglas-fir silhouettes alongside existing redwoods, with differentiated branching. Instanced redwood needle litter uses the actual terrain height. New tree trunks respect sport clearance and disc-golf gate approach corridors.

### Release checklist

Run TypeScript typecheck, strict World ESLint, all World unit tests, terrain/fairway audit, procedural-world geometry checks, and browser screenshots at mobile and desktop. Walk the full eight-gate Hole 9 with manual/assisted shots; inspect actual ground clearance, camera behavior, canopy attachment, wildlife direction changes, localized rain density, and terrain-grounded needles. Inspect resource disposal and draw-call counts. Do not merge on a green analytic check alone.
