# PhysioPersona Nature Atlas 900

The PhysioPersona Nature Atlas is a local-first interactive layer for `/physiology`. It turns a physiology-reactive avatar into a tiny explorer that can inhabit **900 deterministic miniature nature worlds** while keeping scientific evidence and playful preference learning deliberately separate.

## Rendering decision

The atlas is now **2D-first in production**.

The world model is renderer-independent. The default experience uses layered SVG, Canvas atmosphere, CSS/DOM UI, and pointer parallax. The existing React Three Fiber / Three.js renderer remains available as an explicit experimental mode and is dynamically loaded only after a visitor asks for it.

This ordering lets us establish composition, atmosphere, focal-subject quality, interactions, and activity design before spending 3D asset and GPU budget.

See `PHYSIO_PERSONA_2D_FIRST_RENDERING.md` for the renderer-specific architecture.

## Design goals

1. **900 worlds without 900 custom scene components.** Worlds are data-driven scene specifications compiled into a shared rendering vocabulary.
2. **Detailed illustration before geometry.** SVG supplies crisp scene forms and the character rig; Canvas supplies weather, glow, stars, mist, and other high-frequency effects.
3. **Recognizable variation, not palette swaps.** Every world has a focal subject, depth grammar, foreground/midground/backdrop brief, atmosphere, motion, lighting, camera intent, interaction cue, wildlife, and deterministic seed.
4. **Local, inspectable preference learning.** The game persona is trained only by explicit choices. It is not a psychological diagnosis and physiology does not silently change the saved preference vector.
5. **3D is a promotion path.** Strong 2D worlds can later be translated into real Three.js/WebXR environments using the same scene contract.

## Atlas collections

| Range | Collection |
| --- | --- |
| 001–100 | Original atlas |
| 101–150 | Deep woods + rainforest |
| 151–200 | Rivers + oceans + wetlands |
| 201–250 | Frost + alpine peaks |
| 251–300 | Valleys + gardens |
| 301–350 | Savannas + canyons |
| 351–400 | Skies + weather |
| 401–450 | Fairycore thickets |
| 451–500 | Bioluminescent ecosystems |
| 501–550 | Pastel blooms |
| 551–600 | Rain + dark woods |
| 601–650 | Autumn + harvest |
| 651–700 | Zen + minimalist spaces |
| 701–750 | Ethereal coastlines |
| 751–800 | Crystal + glacial dreams |
| 801–850 | Sun-bleached desert |
| 851–900 | Celestial vistas |

## World contract

`RichNatureWorldDefinition` adds a renderer-independent scene plan to the original `NatureWorldDefinition` compatibility layer:

```ts
type NatureScenePlan = {
  collection: NatureCollectionId;
  collectionLabel: string;
  focalSubject: string;
  visualThesis: string;
  foreground: string;
  midground: string;
  backdrop: string;
  atmosphere: NatureAtmosphere;
  motion: string;
  lighting: string;
  camera: string;
  depth: NatureDepthMode;
  interactionCue: string;
  renderCues: NatureRenderCue[];
  density: number;
  sparkle: number;
};
```

A module-load invariant throws if the compiled atlas does not contain exactly 900 worlds.

## Scene compiler

`lib/physiology/natureWorldsExpanded.ts` contains the exact 101–900 manifest and enriches the hand-authored 001–100 launch set.

The compiler derives or preserves:

- broad theme and terrain;
- compatible palette;
- base persona biome for compatibility with the existing preference model;
- atmosphere such as clear, fog, rain, storm, snow, glow, sunrise, sunset, or night;
- render cues from focal-subject vocabulary;
- broad wildlife classes;
- scene depth grammar;
- suggested activities;
- mood compatibility;
- transparent game-preference bias;
- deterministic seed.

This is a **visual grammar**, not a runtime image-generation request. Worlds are reproducible and do not need a network model call to render.

## Production 2D renderer

The production scene uses several specialized layers instead of forcing everything into one canvas:

- `NatureWorldArt2D.tsx` renders deterministic SVG environments and focal subjects;
- `NatureAtmosphereCanvas.tsx` renders bounded particles, fog, rain, snow, glow, stars, and wind;
- `Persona2D.tsx` renders the physiology-reactive vector character;
- `NatureWorld2D.tsx` owns parallax, water-ripple interaction, compositing, reduced-motion behavior, and activity props;
- `NatureWorldThumbnail2D.tsx` gives field-guide cards lightweight SVG previews using the same palette and cue system.

The active world is composed as layered illustration:

1. sky and celestial layer;
2. clouds and atmosphere;
3. distant ranges / horizon;
4. terrain or water;
5. far vegetation and wildlife;
6. focal subject;
7. persona and activity prop;
8. near foliage;
9. Canvas atmosphere;
10. vignette and light treatment.

Pointer movement offsets these visual layers at different strengths to produce parallax without WebGL.

## Experimental 3D renderer

`NatureWorldViewport.tsx` is the presentation boundary.

The default path renders `NatureWorld2D`. The existing `PhysioPersonaAtlasScene` is loaded through `next/dynamic` only when the user selects **3D experimental**.

That preserves the Three.js work while keeping production startup and mobile rendering independent of WebGL.

A world should move further into 3D only after its 2D version has established:

- recognizable focal subject;
- strong composition;
- readable depth hierarchy;
- successful palette;
- useful activity;
- interaction worth preserving.

## Depth modes

Six scene grammars influence both renderers:

- `macro`: close focal objects such as leaves, flowers, shells, mushrooms, droplets, and crystals;
- `pathway`: trails, rivers, roads, bridges, canyons, and tunnels that pull the eye through depth;
- `panorama`: oceans, ranges, fields, skies, salt flats, and horizon-scale scenes;
- `vertical`: peaks, waterfalls, canopies, cliffs, aurora, and tall focal structures;
- `horizon`: shoreline and layered landscape compositions;
- `intimate`: cozy pockets such as dens, gardens, moss, rocks, and small woodland subjects.

## Atlas progression

`NatureAtlasProgress` stays in the browser:

```ts
type NatureAtlasProgress = {
  schemaVersion: 1;
  discovered: string[];
  favorites: string[];
  visits: Record<string, number>;
  recent: string[];
};
```

The field guide supports search, 17 collection filters, favorites-only filtering, discovery count, collection coverage, per-world visits, and pagination at 48 cards per page.

Nothing is locked. Discovery is a soft passport, not a grind gate.

## Preference-learning boundary

The saved game persona contains six transparent values:

- curiosity;
- energy;
- collector;
- explorer;
- calm worlds;
- wild worlds.

The causal rule is:

> **The recommender is not allowed to train itself.**

Explicit world choices and activity choices can update the game-preference vector. Favorites are explicit preference signals. The `wander()` action can choose and discover a recommended destination, but it does not update persistent preferences merely because the system displayed that world.

Self-reported mood is also not written into the permanent game-personality vector.

## Physiology boundary

The avatar remains downstream of `physioatlas.persona.v1` evidence in both renderers:

- respiration drives breathing cadence;
- movement can affect body motion;
- cardiac rate drives a visible pulse;
- sleep estimates can modify animation energy when present;
- weak or missing signals should remain absent or unknown rather than fabricated.

The world preference model never treats physiology as evidence of personality.

## Camera boundary

The optional camera interaction is browser-local and samples a soft color seed for the avatar. Raw frames are not uploaded by this feature. Future face-landmark animation should remain a local expression rig, not an emotion or personality diagnosis.

## Performance strategy

The 2D-first design avoids the obvious 900-world performance traps:

- one active SVG world at a time;
- one bounded Canvas effects layer with DPR capped at 1.5;
- no WebGL initialization in default mode;
- experimental Three.js is dynamically imported;
- field-guide cards use lightweight SVG previews rather than canvases;
- pagination mounts at most 48 cards at once;
- scatter and particles are deterministic and bounded;
- `prefers-reduced-motion` is respected;
- inactive worlds cost data memory rather than render loops.

## Key files

- `lib/physiology/natureWorlds.ts` — original 001–100 scene definitions and palettes.
- `lib/physiology/natureWorldsExpanded.ts` — 900-world manifest/compiler, scene plans, recommendation helpers, atlas progression.
- `components/physiology/NatureWorldViewport.tsx` — renderer-independent presentation boundary and 2D/3D switch.
- `components/physiology/nature2d/NatureWorld2D.tsx` — interactive illustrated viewport.
- `components/physiology/nature2d/NatureWorldArt2D.tsx` — layered SVG environment and focal-subject renderer.
- `components/physiology/nature2d/NatureAtmosphereCanvas.tsx` — Canvas weather and glow effects.
- `components/physiology/nature2d/Persona2D.tsx` — physiology-reactive vector explorer.
- `components/physiology/nature2d/NatureWorldThumbnail2D.tsx` — lightweight field-guide previews.
- `components/physiology/PhysioPersonaAtlasScene.tsx` — experimental React Three Fiber renderer.
- `components/physiology/NatureWorldAtlas.tsx` — searchable/paginated 900-world field guide.
- `components/physiology/usePersonaWorld.ts` — local persona + atlas state and explicit-learning rules.
- `components/physiology/PhysioPersonaAtlasLab.tsx` — integrated user experience.
- `components/physiology/PersonaEvidencePanel.tsx` — research snapshot, camera seed, confidence, observability, and privacy controls.

## Validation expectations

A Nature Atlas change is not complete until:

1. the 900-world count invariant passes;
2. TypeScript succeeds;
3. the production Next.js build succeeds;
4. representative worlds across all 17 collections render without runtime errors;
5. 2D is the initial renderer and 3D remains opt-in;
6. discovery/favorite/reset/export behavior remains local;
7. recommender-selected wandering still does not train persistent preferences;
8. the evidence and privacy boundaries remain visible in the UI.
