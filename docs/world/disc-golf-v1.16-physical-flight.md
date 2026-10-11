# Disc Golf v1.16: six-DOF flight, ground contact and calibration

**Status:** experimental physically grounded gameplay; NOT quantitatively calibrated to any commercial disc. Feature branch only until browser walkthrough and real-shot calibration.

## Implemented

- Six coupled translational/rotational degrees of freedom: world-frame 3D position/velocity, normalized body-to-world quaternion, world-frame angular momentum, inertia tensor for an axisymmetric body, and aerodynamic moment. Spin is integrated into the quaternion and visual axial spin phase.
- The rigid-body integrator applies air-relative translational lift/drag, aerodynamic pitching moment, gravity, angular momentum conservation (apart from documented drag and damping), and substepped quaternion rotations for high RPM. Backhand and forehand have opposite spin sense. An isolated reduced-order model remains in `discGolfAerodynamics.ts` for comparison.
- Spatially varying wind shear and light three-dimensional gusts based on release weather, flight height and position. Wind samples are deterministic for live play and preview with identical inputs.
- Shallow rim impact can skip, high-bank impact can edge-roll, and otherwise the disc skids and brakes with terrain-normal restitution and Coulomb-like sliding/rolling resistance. Terrain downhill gravity contributes to the final lie; a disc sliding into water remains a free redo. A shot is **not marked landed while still moving**.
- Release power, heading, loft, nose, bank, spin RPM, and disc class remain separate controls. The HUD retains the low bottom bar and Shasta's disc-first fetch POV. Shasta begins only after the disc *settles*, then the player moves to the final lie after the find.
- `discGolfCalibration.ts` accepts measured 3D trajectory samples and known initial release speed, nose, bank, spin, and wind; it offers bounded coefficient fitting with a held-out RMSE. No user measurement dataset is assumed or invented.
- Added unit checks for quaternion normalization, bounded angular momentum, wind relative force, early turn and late fade, real slide/skip/roll physics, terrain gradients, collision water logic, preview/live parity, measured-sample validation, and course safety. The expanded Hole 9 multi-gate trek must still meet the actual 24-gate course audit after the new physics.

## Important scientific limitations

- No known measurements have been supplied to fit the nominal `CL/CD/CM` and damping coefficients, restitution, or rolling friction for actual discs. The solver is physically structured and deterministic, not yet a validated quantitative replica.
- The body is symmetric with approximate transverse inertia and aerodynamic moment. No full wind-tunnel moment lookup table for sideslip, Reynolds number, spin ratio or flutter. Strong stalls, gyroscopic nutation and high-angle impacts need real calibration.
- Ground contact is a bounded Coulomb/restitution approximation, not finite-element deformation, granular impact mechanics, or a model of disc rim geometry.
- Water, tree trunk collisions, gates and course out-of-bounds retain intentional gameplay simplifications; official tournament rules are not implied.
- Live power recommendations must be profiled for input latency under the new rotational substepping. The manual browser script is still necessary to inspect visual stance/ground penetration, weather/cloud placement and the full eight-gate Hole 9.

## Calibration acceptance path

1. Obtain at least 20 measured throws per disc class spanning speed, nose, bank, throw style and spin, with time-synchronized 3D trajectories (stereo cameras or mocap), metered wind and impact tracking.
2. Fit aerodynamics on one cohort using the calibration API. Record mass, rim diameter, profile shape, gravity, air density and uncertainties. Keep entire throws held out, not just the final few samples.
3. Compare 3D landing location, turn point, fade, trajectory apex, spin loss, time aloft and observed ground contact. Report means and confidence intervals across unseen discs and throwers. Never call the model validated from synthetic tests.
4. Tune restitution/sliding/rolling independently against high-speed ground contact videos across grass, pine litter, packed dirt, rock, and wet slopes.
5. Run real browser visual QA (desktop/mobile and reduced motion): all nine holes, dynamic curve shots, steep mountain impacts, Shasta fetch, gate crossings, snake/leaf attachments, rainy rainforest, forest-floor litter, and responsive HUD.

## Sources

Giljarhus, Gooding & Njærheim, *Disc golf trajectory modelling combining computational fluid dynamics and rigid body dynamics*, Sports Engineering 25:26 (2022): https://doi.org/10.1007/s12283-022-00390-5

Kamaruddin et al., *Aerodynamic performance of flying discs* (2018): https://doi.org/10.1108/AEAT-09-2016-0143

Crowther & Potts, *Simulation of a spin-stabilised sports disc* (2007): https://doi.org/10.1007/BF02844198
