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
