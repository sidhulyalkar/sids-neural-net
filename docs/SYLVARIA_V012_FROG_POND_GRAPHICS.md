# Sylvaria v0.12 · Frog Pond graphics

v0.12 is a presentation release. The authoritative game remains the fully qualified v0.11.1 engine from Website CI #819.

## Release boundary

The following are frozen and must not change in this release:

- 120 Hz fixed simulation tick;
- persistent one-command WASD queue;
- Arrow-key attack cadence and Countercut arrival-side geometry;
- 840 / 1040 px/s reflected-shot speeds;
- projectile and pending-projectile caps;
- terrain collision, hazards, enemy AI and scoring;
- replay codec, source hash, HMAC ticket protocol and Node verifier.

The ranked engine version therefore remains **0.11.1**. The presentation version is **0.12.0**. A visual-only release must not invalidate an otherwise identical verified run.

## Player fantasy

The player is a frog defending and feeding through a sequence of pond clearings.

- WASD remains the same short committed movement.
- Arrow attacks are rendered as a fast directional tongue slap.
- The existing Countercut is explained visually as the tongue catching or batting an incoming attack back.
- Enemy roles are represented by distinct edible insects rather than machinery or abstract shapes.
- Existing environmental rules are translated into pond-readable materials without changing their simulation identifiers.

### Enemy presentation map

| Engine role | v0.12 visual |
| --- | --- |
| `feller` | house fly |
| `foreman` | bumblebee |
| `lobbyist` | mosquito |
| `skidder` | water beetle |
| `drone` | dragonfly |
| `chair` | hornet |
| `broker` | moth |
| `surveyor` | crane fly |
| `mech` | diving beetle |
| `mulcher` | giant wasp |

Boss encounters are presented as a large dragonfly, hornet queen and giant diving beetle at the three fixed milestones. Internal boss state remains unchanged.

### Terrain presentation map

| Engine surface | v0.12 visual |
| --- | --- |
| ground | moss / short pond grass |
| grass | reeds / soft rushes |
| water | shallow pond water |
| mud | wet mud |
| sand | pale bank |
| ice | slick algae film |
| bramble | dense thorn/reed tangle |
| shards | shell / sharp-stone bed |

Trees are presented as protected lily/reed beds. Debris and brittle objects become driftwood, broken reed bundles and stones. Mushrooms remain mushrooms because their existing readability already fits the pond edge.

## Render architecture

`v012-entry.js` loads the fully qualified v0.11.1 runtime first, then attaches the new renderer.

The boot loop continues to execute:

```text
while accumulator >= 1/120:
    authoritative update(1/120)

F.render()
```

Only `F.render` is replaced. The v0.12 render function reads state and never writes authoritative gameplay fields. If WebGL2 is unavailable or context creation fails, the qualified Canvas renderer remains the fallback.

### Canvas ownership

The existing `#c` Canvas remains in the DOM because it owns focus and is already integrated with responsive scaling. v0.12 creates a sibling `#pondCanvas` over the same playfield. When WebGL2 is healthy, the old Canvas becomes visually transparent but remains available for focus and fallback.

### Atlas strategy

The first art pass uses a generated atlas rather than shipping a pile of opaque binary sprites. At load time a small deterministic Canvas2D asset compiler creates:

- one diffuse atlas;
- one grayscale height atlas;
- a compact sprite manifest.

Those atlases are uploaded once to WebGL. No per-frame sprite painting occurs on Canvas2D.

This is intentionally replaceable. Hand-painted PNG/WebP diffuse + height/normal atlases can later occupy the same manifest without changing rendering or simulation.

## WebGL2 pipeline

The batch renderer expands sorted sprite instances into an interleaved vertex stream:

```text
x, y, u, v, depth, r, g, b, a
```

Six vertices form one quad. Instances are CPU-sorted by layer and foot-Y before batching. This gives Zelda-like overlap with a clear, inspectable rule instead of asking the depth buffer to sort translucent sprite edges.

The vertex shader converts 960×640 world coordinates to clip space and passes world position, UV, depth and tint to the fragment stage.

The fragment shader samples diffuse and height atlases. A local normal is reconstructed from neighboring height samples:

```glsl
float hL = texture(uHeight, uv - vec2(texel.x, 0.0)).r;
float hR = texture(uHeight, uv + vec2(texel.x, 0.0)).r;
float hD = texture(uHeight, uv - vec2(0.0, texel.y)).r;
float hU = texture(uHeight, uv + vec2(0.0, texel.y)).r;
vec3 n = normalize(vec3((hL-hR)*strength, (hD-hU)*strength, 1.0));
```

Up to six presentation lights are selected each frame:

1. frog / tongue glow;
2. nearest hostile priority shot;
3. strongest reflected shot;
4. up to three environmental gas / mushroom / boss lights.

Lighting uses world-space XY plus a fixed pseudo-Z height. No lighting result is ever fed back into simulation.

## Visual hierarchy

The renderer must remain readable under room-29 density.

Priority from strongest to weakest contrast:

1. frog silhouette and tongue;
2. imminent hostile attack;
3. interactive insects;
4. damaging terrain / gas;
5. protected lily beds and breakables;
6. decorative reeds, stones, flowers and shoreline texture.

Decoration is allowed to be rich only when it stays below gameplay contrast.

## Tongue attack contract

The tongue is a visual skin for existing slashes.

- The tongue root begins at the frog mouth.
- Its main extension follows the cardinal attack direction.
- A brighter slap tip and translucent sweep communicate the existing slash breadth.
- Tongue lifetime is read directly from `state.slashes`.
- No additional hit test is introduced.

Tests must prove that creating the renderer does not modify slash reach, life, Countercut quality, returned speed or replay outcome.

## Performance budgets

Target desktop portfolio runtime:

- 60 FPS render target;
- 120 Hz simulation remains independent;
- ≤ 1 generated atlas upload at startup;
- ≤ 1 background texture refresh per room;
- ≤ 6 dynamic lights;
- ≤ 500 sprite quads in a normal late arena;
- ≤ 900 sprite quads hard render cap;
- no per-frame image allocation;
- no per-frame WebGL buffer creation;
- context-loss fallback must preserve playability.

## Qualification plan

A v0.12 release is not green until:

1. v0.11.1 semantic/mechanics/replay gates remain green;
2. Chrome Stable, Chromium, Firefox and WebKit still produce matching authoritative replays;
3. the frog renderer initializes without changing the engine hash;
4. tongue visuals appear for all four Arrow directions;
5. every enemy engine role maps to a distinct insect silhouette;
6. pond environment renders in early, middle and late fixed arenas;
7. WebGL context loss falls back to the qualified Canvas renderer;
8. late-room FPS remains ≥ 50 in Chromium CI and ≥ 42 in the existing protected gauntlet;
9. screenshots are inspected for silhouette clarity rather than accepted solely by DOM assertions.

## Asset evolution

The generated atlas is phase one, not the artistic ceiling. Once the renderer and gameplay readability are qualified, the recommended production art workflow is:

1. paint final diffuse sprites in Aseprite/Krita at 2× or 4× delivery resolution;
2. author a grayscale height pass alongside the diffuse art;
3. optionally generate a normal pass from height with Laigter or SpriteIlluminator and hand-correct important forms;
4. pack diffuse and height/normal atlases with identical coordinates;
5. keep pivots at feet/mouth/attack anchors in the manifest;
6. swap atlases without touching simulation or replay code.

For a small team this is faster and more controllable than maintaining 3D source models for every pond prop. 3D-to-2D rendering is best reserved for especially complex boss assets if the hand-painted silhouette cannot provide enough directional depth.