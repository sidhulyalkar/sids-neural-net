# Shasta character specification

This document is the visual handoff for Shasta in World Mode. The runtime source of truth is `lib/world/shastaCharacter.ts`.

## Reference authority

The character definition is based on Sid's supplied photos across indoor, mountain, meadow, coast, redwood and close-up views. Generated model sheets are supporting design references only. We do not encode guessed real-world height or weight as facts.

## Identity

- Name: Shasta
- Sex: male
- Type: husky mix
- Build: lean, athletic, agile
- Overall read: light cream-white dog with warm tan/sable concentrated across the upper back and shoulders

## Face

- Face is predominantly light, not a dark generic husky mask
- Upright triangular ears
- Amber/golden eyes
- Small dark pupils
- Pinkish-brown nose
- Narrow-to-medium muzzle
- Warm tan is concentrated at the crown, brow/temple area and ears

## Coat blocking

- Cream-white base torso
- Bright white chest, muzzle, lower legs and paws
- Warm tan mantle over the upper back
- Narrower sable/darker spine layer inside the mantle
- Light-tan shoulder and rump transitions
- Avoid darkening the entire flank or face

## Tail

Shasta's tail is a major identity cue. It should not read as a tight circular husky curl.

The standing silhouette is modeled as a broad plume that:
1. leaves the rump with a warm tan base,
2. sweeps backward and downward,
3. reaches a low point behind the body,
4. widens into a cream-white plume,
5. curls gently outward and slightly upward at the tip.

The runtime uses six photo-derived control points under a single animated tail root. They drive one continuous tapered TubeGeometry with a warm-tan to cream-white vertex-color gradient, preserving the plume silhouette at one draw call without visible segment seams.

## Accessories

World Mode renders Shasta **without a harness**. The supplied outdoor photos may show a trail harness, but it is reference context only and must not obscure his natural coat/body silhouette in the default world character.

Do not reintroduce harness straps or panels unless Sid explicitly asks for an accessory variant.

## Face geometry

Shasta's forehead must remain smooth and structurally simple. Warm facial coloration should never be represented as separate bulbous brow/crown meshes. In particular:

- no tan ellipsoid above either eye;
- no raised crown bubble;
- amber irises/pupils may remain separate because they represent actual surface features;
- cheek ruff volumes must stay small enough that they soften the face without widening the skull;
- the muzzle should remain longer and narrower than a generic blocky husky head.

## Animation contract

Appearance changes must preserve the qualified locomotion system:
- finite acceleration and braking
- arrival slowing
- velocity-driven heading
- terrain-aware pitch/roll
- articulated diagonal trot
- stable curiosity hysteresis
- bounded low-FPS motion

Do not replace the tail with a torus or reintroduce static paws/upper legs.
