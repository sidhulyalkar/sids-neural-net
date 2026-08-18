# PhysioPersona Tiny Worlds

PhysioPersona has two deliberately separate systems:

1. **evidence-reactive embodiment** consumes `physioatlas.persona.v1` snapshots and may animate breathing, movement, cardiac pulse, sleep-related energy, and future browser-local expression features only within their stated confidence/claim boundaries;
2. **tiny-world personality** is a transparent game state trained only by explicit visitor choices.

The second system is not a psychological model and must never be presented as one.

## Why this split exists

A playful avatar benefits from memory and adaptation. A physiology experiment benefits from uncertainty, abstention, provenance, and strict claim boundaries. Combining the two into one latent "personality" score would make both systems worse.

The rule is therefore:

```text
physiology / expression evidence          explicit game choices
              |                                  |
              v                                  v
    evidence-reactive animation       local preference + history
              |                                  |
              +---------------+------------------+
                              v
                     procedural tiny world
```

Mood is also kept separate. `calm`, `curious`, `energized`, and `sleepy` are explicit self-report controls for the current visit. Mood can change lighting, pace, stars, and recommendation weights, but it does not permanently modify the saved preference vector.

## Current local profile

The browser stores `sid.physio-persona.world.v1` in `localStorage`.

The profile contains:

- schema version and timestamps;
- visit and adventure counts;
- six editable game preferences from `0..1`:
  - curiosity;
  - energy;
  - collector;
  - explorer;
  - calm-world affinity;
  - wild-world affinity;
- per-biome affinity;
- explicit activity counts;
- at most twelve short adventure memories.

The visitor can edit every trait, export the profile as JSON, or erase it. There is no server profile in v1.

## Current biomes

| Biome | Nature vocabulary | Representative tasks |
| --- | --- | --- |
| snowy mountain ridge | snow, pines, peaks, rocks | wander, collect, cairn, snow angel, stargaze |
| deep fern jungle | ferns, moss, dense trees, fireflies | wander, collect, garden, chase fireflies |
| warm fire cave | rock shelter, minerals, firelight | warm by fire, collect, rest, stargaze |
| river bend | water, reeds, stones | fish, skip stones, collect, wander |
| windy little coast | sand, ocean, shells, sea grass | collect, shoreline wander, skip stones, stargaze |
| wildflower meadow | grass, flowers, mushrooms, garden | garden, rest, collect, chase fireflies |

All scenes are currently composed from lightweight procedural Three.js geometry. This keeps the experience fast, avoids asset licensing/deployment complexity, and gives future procedural variation room to grow.

## Learning rule

Only explicit world/activity choices call `recordAdventure()`.

An adventure:

- adds a small activity-specific delta to the relevant game preferences;
- adds a much smaller biome-derived preference delta;
- increases that biome's affinity;
- increments the activity count;
- writes one human-readable memory.

Learning is intentionally slow. The system should develop a gentle bias over many choices rather than aggressively extrapolating from one click.

Direct slider edits always override the learned vector.

## Recommendation rule

The world director is intentionally inspectable rather than ML-heavy.

A biome score combines:

1. saved biome affinity;
2. transparent weighted matches against the six game preferences;
3. a temporary mood weight.

Activities combine explicit preference matches, current mood, and a novelty bonus for under-used tasks.

The UI displays a plain-language explanation for the recommended world. A future learned policy may replace this heuristic only if its inputs and outputs remain inspectable and resettable.

## Rendering rule

`PhysioPersonaScene` receives both systems as separate props:

```ts
{
  snapshot, // evidence contract
  mood,     // current explicit self-report
  accent,   // local appearance seed
  biome,    // game state
  activity, // game state
}
```

Do not write game preferences back into a PhysioAtlas evidence snapshot. Do not write physiology-derived labels into the persistent game profile.

## Privacy rules

- `localStorage` is the default persistence mechanism for tiny-world personality.
- Raw camera frames are not part of the game profile.
- Raw RF is not part of the game profile.
- Biometric templates are not part of the game profile.
- PhysioAtlas replay remains a separate presentation-safe evidence input.
- Future sync/account features must be opt-in and should keep world history independent from raw sensing data.

## Performance rules

The world should remain a portfolio detour, not a GPU benchmark.

- prefer low-poly/procedural geometry;
- keep device pixel ratio capped;
- avoid per-frame React state updates;
- perform motion through `useFrame` refs;
- share simple materials/geometry patterns when the scene library grows;
- use level-of-detail or instancing before adding dense forests/particles;
- respect reduced-motion preferences before adding cinematic camera movement or weather systems.

## Good next extensions

### World variation

Add deterministic seeds inside each biome so repeated visits can generate different tree/rock/flower layouts without making world identity unstable.

### Weather and time

Add a local world clock and a small weather state machine: clear, mist, snow, rain, windy, firefly dusk. Weather should affect presentation only.

### Discoveries

Add small collectible objects with a transparent collection book: shells, leaves, stones, flowers, strange signal motes, tiny constellations. Collectibles can influence the `collector` game preference because acquisition is explicit.

### Tiny shelters

Let repeated visits gradually decorate a campsite, cave nook, garden, or lookout. These should be cosmetic progression, not physiology rewards.

### Browser-local face rig

Add local face landmarks/blendshapes for blink, mouth, smile shape, and head pose. Expression features animate the avatar and remain distinct from self-reported mood.

### Evidence journeys

A de-identified physiology replay can become a special journey through a world. Confidence/observability should remain inspectable and abstention should visibly quiet the evidence-reactive animation.

### Secure live bridge

A future WiFisio companion may stream only presentation-safe persona snapshots over short-lived scoped sessions. Never expose the local Research Hub or raw RF directly to the public site.
