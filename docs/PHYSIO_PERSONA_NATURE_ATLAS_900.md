# PhysioPersona Nature Atlas 900

The PhysioPersona Nature Atlas is a local-first interactive layer for the `/physiology` experiment. It turns a physiology-reactive avatar into a tiny explorer that can inhabit **900 deterministic miniature nature worlds** while keeping the scientific evidence model and the playful preference model deliberately separate.

## Design goals

1. **900 worlds without 900 custom scene components.** Worlds are data-driven scene specifications compiled into a shared rendering vocabulary.
2. **Illustrative 2D art with real 3D depth.** The renderer uses flat-shaded low-poly props and illustration-like planes at different Z depths. Orbiting reveals parallax, creating a pop-up-book / diorama feel.
3. **Recognizable variation, not palette swaps.** Every world has a focal subject, scene depth grammar, foreground/midground/backdrop brief, atmosphere, motion, lighting, camera, interaction cue, render vocabulary, wildlife, and deterministic seed.
4. **Local, inspectable preference learning.** The game persona is trained only by explicit choices. It is not a psychological diagnosis and physiology does not silently change the saved preference vector.
5. **One WebGL scene at a time.** The field guide remains usable with 900 entries by using lightweight CSS previews and pagination instead of hundreds of canvases.

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

The original `NatureWorldDefinition` remains the compatibility layer. `RichNatureWorldDefinition` adds a scene plan:

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

A build-time invariant throws if the compiled atlas does not contain exactly 900 worlds.

## Scene compiler

`lib/physiology/natureWorldsExpanded.ts` contains the exact 101–900 manifest and enriches the hand-authored 001–100 launch set.

The compiler derives:

- broad theme and terrain;
- compatible palette;
- base persona biome for compatibility with the existing preference model;
- atmosphere such as clear, fog, rain, storm, snow, glow, sunrise, sunset, or night;
- render cues from the focal subject vocabulary;
- broad wildlife classes;
- scene depth grammar;
- suggested activities;
- mood compatibility;
- transparent game-preference bias;
- deterministic seed.

This is deliberately a **visual grammar**, not a generative-AI request executed at runtime. Visitors get stable, reproducible worlds and the site does not require an image model or network request to render a scene.

## 2.5D rendering

`components/physiology/NatureWorldRenderer.tsx` turns scene plans into an interactive miniature world.

The visual vocabulary currently includes:

- pine, oak, bamboo, willow, and palm forms;
- ferns, flowers, mushrooms, cactus, agave, and yucca;
- rocks, crystals, ice, coral, and shells;
- river, pond/lake, and ocean water sheets;
- mountain and cloud backdrop layers;
- caves, paths, bridges, and webs;
- rainbows, aurora ribbons, sun, moon, stars, and meteors;
- rain, storm, snow, wind, glow, and night particles;
- stylized insect, bird, aquatic, reptile, and mammal silhouettes.

The renderer uses deterministic scatter from each world seed. Re-entering a world preserves its broad composition rather than randomly rerolling every React render.

## Depth modes

Six scene grammars stop the atlas from feeling like one camera setup repeated 900 times:

- `macro`: close focal objects such as leaves, flowers, shells, mushrooms, droplets, and crystals;
- `pathway`: trails, rivers, roads, bridges, canyons, and tunnels that pull the eye through depth;
- `panorama`: oceans, ranges, fields, skies, salt flats, and horizon-scale scenes;
- `vertical`: peaks, waterfalls, canopies, cliffs, aurora, and tall focal structures;
- `horizon`: shoreline and layered landscape compositions;
- `intimate`: cozy pockets such as dens, gardens, moss, rocks, and small woodland subjects.

`PhysioPersonaAtlasScene.tsx` adapts camera height, distance, and FOV to the selected depth grammar.

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

The field guide supports:

- text search across scene metadata;
- 17 collection filters;
- favorites-only filtering;
- discovery count;
- favorite count;
- collection coverage;
- per-world visits;
- pagination at 48 cards per page.

Nothing is locked. Discovery is a soft passport, not a grind gate.

## Preference-learning boundary

The saved game persona contains six transparent values:

- curiosity;
- energy;
- collector;
- explorer;
- calm worlds;
- wild worlds.

The important causal rule is:

> **The recommender is not allowed to train itself.**

Explicit world choices and activity choices can update the game-preference vector. Favorites are explicit preference signals. The `wander()` action can choose and discover a recommended destination, but it does **not** update the persistent preference vector merely because the system displayed that world.

Self-reported mood is also not written into the permanent game-personality vector.

## Physiology boundary

The avatar remains downstream of `physioatlas.persona.v1` evidence:

- respiration can drive breathing animation;
- movement can affect body motion;
- cardiac rate can drive a visible pulse;
- sleep estimates can modify energy when present;
- weak or missing signals should remain absent/unknown rather than fabricated.

The 900-world preference model never treats physiology as evidence of personality.

## Camera boundary

The current optional camera interaction is browser-local and samples a soft color seed for the avatar. Raw frames are not uploaded by this feature. Future face-landmark animation should remain a local expression rig, not an emotion or personality diagnosis.

## Performance strategy

The atlas intentionally avoids the obvious 900-world performance traps:

- only one React Three Fiber `Canvas` is mounted;
- atlas cards use CSS previews, not WebGL thumbnails;
- field-guide pagination mounts at most 48 cards at once;
- scene scatter is deterministic and bounded;
- device pixel ratio is capped in the main canvas;
- primitives are reused instead of importing hundreds of large models or texture sets;
- the active world is selected by ID, so inactive worlds cost data memory rather than render loops.

## Key files

- `lib/physiology/natureWorlds.ts` — original 001–100 scene definitions and palettes.
- `lib/physiology/natureWorldsExpanded.ts` — 900-world manifest/compiler, scene plans, recommendation helpers, atlas progression.
- `components/physiology/NatureWorldRenderer.tsx` — deterministic 2.5D procedural world renderer.
- `components/physiology/PhysioPersonaAtlasScene.tsx` — scene host plus physiology-reactive avatar.
- `components/physiology/NatureWorldAtlas.tsx` — searchable/paginated 900-world field guide.
- `components/physiology/usePersonaWorld.ts` — local persona + atlas state and explicit-learning rules.
- `components/physiology/PhysioPersonaAtlasLab.tsx` — integrated user experience.
- `components/physiology/PersonaEvidencePanel.tsx` — research snapshot, camera seed, confidence, observability, and privacy controls.

## Extending the renderer

Adding world 901 should not require a new route or new scene host. Add the world specification and ensure its focal vocabulary maps to useful render cues.

For especially distinctive subjects, add a reusable hero-object family rather than a one-off world component. Good next hero families include:

- baskets, honeycomb, nests, acorn cups, and tree-library props;
- pumpkins, gourds, apples, hay bales, and harvest structures;
- fountains, pots, hedges, trellises, and garden gates;
- zen basins, stone lanterns, bamboo water spouts, bonsai, and ikebana;
- sea glass, specialty shell silhouettes, piers, canoes, and dams;
- mineral-specific crystal silhouettes and geode interiors;
- observatories, planet cards, halo effects, nebula ribbons, and specialized cloud structures.

The rule is to increase the **shared visual vocabulary** instead of accumulating 900 unrelated components.

## Validation expectations

A Nature Atlas change is not complete until:

1. the 900-world count invariant passes;
2. TypeScript succeeds;
3. the production Next.js build succeeds;
4. a representative sample from every collection renders without runtime errors;
5. discovery/favorite/reset/export behavior remains local;
6. recommender-selected wandering still does not train persistent preferences;
7. the evidence and privacy boundaries remain visible in the UI.
