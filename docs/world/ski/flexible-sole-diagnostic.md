# Ski V3: constrained-flex versus rigid snow-contact experiment

**Status:** development-lab visual candidate; **not** the production ski geometry or the authoritative collider.

The parent V3-1 audit recorded approximately 0.87 world units of toe/tail clearance even when the rigid fit had a near-zero minimum. This is a geometry/curvature issue rather than something a minimum-only assertion can detect.

## Models

- **rigid**: exact PR #156 `fitSkiContact` pose, sampled at 33 × 3 underside vertices per ski (99). Control.
- **bounded**: keep the existing rigid pose but move each sample **vertically only** toward terrain by at most 0.3 world units. The number is an explicitly provisional visual deformation budget, **not a measurement of real ski stiffness**. The geometry is a finite-width dynamically deformed strip, not two unrelated floating planks.
- **surface**: move each sample to the analytic snow surface +0.008 world units. This is an *idealized upper bound*, not a physically plausible ski. Severe curvature or torsion may be unacceptable; curvature is recorded for review.

Across all variants the authoritative `SkiSimulation` position, velocity, two-support contact state, gravity, controls, camera, terrain and input trace remain identical. The deformation is strictly a visual diagnostic.

## Run

```bash
node --import tsx --test tests/world-ski-flexible-sole.test.ts
node --import tsx scripts/ski-flex-sole-audit.ts
npm run dev
# /dev/ski-lab?five-carve&sole=rigid
# /dev/ski-lab?five-carve&sole=bounded&capture-tick=706
# /dev/ski-lab?five-carve&sole=surface&capture-tick=706
```

`scripts/ski-flex-sole-audit.ts` writes `artifacts/ski-flex-sole/rigid-bounded-surface.json` with the sampled signed clearance, maximum deformation, and approximate centerline curvature for **each** ski at comparable physics ticks. The exact-head CI job uploads the report and tested SHA.

## What constitutes a real fix

A reduced sampled gap is **not enough**. Before rendering in ordinary island skiing, the candidate needs a coherent 3D binding/boot and articulated leg rig, believable bend/twist and limited stress, independently constrained toe/tail penetration against the *rendered* triangulated snow surface, credible camera frames at both banks, and an authoritative contact model that agrees with the drawn skis. Avoid painting an ideal ribbon onto snow and calling it a rigid ski.

No terrain edit is approved. An unacceptably tight bend radius may require changing *ski rendering / length / behavior* or bringing the author an explicit terrain-curvature tradeoff, not silently changing the protected mountain.
