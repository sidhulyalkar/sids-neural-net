# PhysioPersona Nature Atlas: 2D-first rendering architecture

The Nature Atlas now treats rendering as a presentation concern downstream of the 900-world scene contract.

## Decision

Production defaults to an illustrated 2D renderer. The existing React Three Fiber / Three.js renderer remains available as an explicit experimental mode.

This order is intentional:

1. validate composition, atmosphere, visual identity, interaction, and activities cheaply in 2D;
2. keep every world responsive and usable on ordinary browsers and mobile GPUs;
3. promote selected worlds into richer 3D only after their visual grammar is proven;
4. keep both renderers consuming the same `RichNatureWorldDefinition` contract.

## Shared contract

`lib/physiology/natureWorldsExpanded.ts` remains the source of truth.

Each world exposes:

- stable ID and atlas index
- collection and terrain
- palette and base biome
- focal subject
- wildlife
- supported activities
- preference biases
- deterministic seed
- visual thesis
- foreground, midground, backdrop
- atmosphere
- motion language
- lighting intent
- camera intent
- depth mode
- interaction cue
- render cues
- density and sparkle

The renderer may interpret these fields differently, but must not mutate their meaning.

## Renderer boundary

`components/physiology/NatureWorldViewport.tsx` owns the mode switch.

### 2D production mode

`components/physiology/nature2d/`

- `NatureWorld2D.tsx`: interactive viewport and compositing shell
- `NatureWorldArt2D.tsx`: layered SVG environment and focal subject system
- `NatureAtmosphereCanvas.tsx`: deterministic particles, mist, rain, snow, glow, stars, and wind
- `Persona2D.tsx`: physiology-reactive vector character rig

The 2D renderer combines SVG, Canvas, CSS, and DOM rather than forcing every effect through one graphics technology.

### 3D experimental mode

The existing React Three Fiber scene remains code-split behind the mode selector. It does not initialize in the normal 2D experience.

## 2D layer model

The illustration uses real visual depth without WebGL:

1. sky gradient and celestial layer
2. clouds and atmospheric silhouettes
3. distant mountains / horizon
4. water or terrain base
5. far vegetation and wildlife
6. focal subject
7. physiology-reactive persona and activity prop
8. near foliage
9. Canvas particles and atmosphere
10. vignette / light treatment

Pointer movement offsets these layers at different strengths. Reduced-motion users receive the same composition without continuous pointer-driven movement.

## Determinism

Every world uses its existing stable seed.

Scatter positions, particle populations, vegetation placement, and supporting motifs are derived from that seed. Revisiting a world therefore preserves its visual identity instead of rerolling the scene on every render.

## Physiology stays renderer-independent

The same evidence contract controls both 2D and 3D avatars.

Current 2D mappings include:

- respiration rate -> breathing cycle duration
- cardiac rate -> chest pulse duration
- movement intensity -> idle amplitude
- sleep estimate / self-reported mood -> eye openness and pacing
- explicit activity -> pose and activity prop

No physiological signal is converted into a saved personality trait.

## Interaction

The 2D viewport supports lightweight interaction without becoming a game engine dependency:

- pointer parallax
- water ripple taps
- activity-specific animated props
- gaze following
- deterministic weather motion
- optional Three.js handoff

Future interactions should remain cheap, local, and world-specific.

## Performance rules

- one active illustrated world at a time
- no WebGL initialization in default mode
- Canvas DPR capped at 1.5
- bounded deterministic particle counts
- atlas cards stay CSS-only
- 48 atlas cards per page
- honor `prefers-reduced-motion`
- avoid network-loaded scene assets for the base experience

## Art direction

The production target is not generic flat iconography. The visual goal is a detailed animated storybook window:

- atmospheric depth
- layered silhouettes
- focal-object hierarchy
- soft material gradients
- restrained texture via shape overlap and transparency
- small ambient motion
- readable color scripting
- scene-specific interaction

Highly specific worlds receive bespoke SVG focal families while the shared environment vocabulary supplies context.

## Promotion path to 3D

A world should be considered ready for a richer Three.js/WebXR version only after the 2D version has established:

- strong composition
- recognizable focal subject
- successful palette
- readable foreground/midground/background separation
- useful activity
- interaction worth preserving

The long-term experience can then expose a deliberate `Enter in 3D` transition instead of making 3D mandatory for every atlas visit.

## Invariants

1. The 900-world catalog stays renderer-independent.
2. 2D is the production default until visual coverage is mature.
3. 3D remains optional and code-split.
4. Explicit choices train the game persona; recommender-selected wandering does not.
5. Mood is temporary self-report context.
6. Physiology animates embodiment, not psychological diagnosis.
7. Raw RF, raw camera frames, and biometric templates remain outside atlas persistence.
