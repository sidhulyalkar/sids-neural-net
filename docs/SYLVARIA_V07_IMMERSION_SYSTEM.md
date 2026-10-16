# Sylvaria v0.7 — Immersion System

Sylvaria v0.7 turns the Mossglint Run from a framed 960×640 browser arena into a full-device living world while preserving the exact deterministic gameplay coordinate system underneath it.

The production rule is simple: **gameplay remains logical 960×640; presentation may extend everywhere.** The arena never stretches, pointer coordinates never change meaning, collision geometry never depends on device shape, and the decorative world is free to occupy the entire viewport.

## 1. Logical 960×640 gameplay contract

Physics, collision, aiming, targets, enemies, portals, and authored room geometry continue to use the 960×640 coordinate system from `game-v5.js`.

The CSS playfield is always 3:2:

- width: `min(100vw, 100svh × 1.5)`
- height: `min(100svh, 100vw ÷ 1.5)`

On screens wider or taller than 3:2, the remaining device area is not black letterbox space. It becomes the continuation of the current world through the v0.7 backdrop renderer.

This lets an ultrawide desktop, a laptop, a tablet, and a portrait phone all see a correctly proportioned arena while still feeling surrounded by the biome.

## 2. High-DPI sharpness

`render-scale-v7.js` selects an internal Canvas render scale before gameplay starts:

| Device condition | Internal scale |
| --- | ---: |
| constrained memory / CPU | 1× |
| DPR < 1.25 | 1× |
| DPR 1.25–1.74 | 1.5× |
| DPR ≥ 1.75 | 2× |

The browser still receives logical coordinates. The Canvas backing store simply has more physical pixels, which makes Sprid, creature silhouettes, portal rings, fine strokes, and typography considerably sharper on Retina/high-DPI screens.

The scaler must initialize before `render-optimizer-v6.js` and `game-v5.js`, because changing Canvas dimensions resets its drawing context.

## 3. Full-device world composition

The v0.7 renderer has three visual planes:

1. `#sylWorldBackdrop` — viewport-sized distant world, horizon, sky, weather, silhouettes, stars, caustics and biome extension.
2. `#c` — the exact gameplay arena and authoritative gameplay render.
3. `#sylVisualOverlay` — atmosphere, parallax foreground, interaction ripples, target aura polish, face details and portal accents.

The viewport plane is intentionally independent from gameplay geometry. A decorative tree outside the playfield can make a forest feel enormous without becoming an invisible collision object.

## 4. Five world families

The real 1,000-world Nature Atlas drives the renderer. Theme classification consumes the canonical Atlas collection, terrain, nested scene atmosphere, focal subject, render cues and room decor.

### Forest / moss

Visual thesis: **moss cathedral · cyan spores · warm bark**

- immense framing trunks and organic arches
- mossy horizons
- floating spores and firefly-like motes
- foreground roots/vines that parallax with Sprid
- green/cyan interaction ripples

### Cave / volcanic

Visual thesis: **ember cavern · basalt teeth · teal fungi**

- dark basalt silhouettes
- cracked warm horizon light
- upward ember drift
- teal ecological accents against hot orange danger
- environmental pulses when the portal destabilizes the chamber

### Reef / wetland

Visual thesis: **living water · coral gardens · soft caustics**

- full-screen water depth gradient
- animated caustic/wave bands
- kelp/coral silhouettes around the arena edges
- rising bubbles
- warm coral contrasted against blue-green navigation space

### Ice / alpine

Visual thesis: **glacial air · crystal ridges · violet snowlight**

- layered translucent mountain/crystal ridges
- snow/frost drift
- pale cyan navigation values
- violet secondary light
- crisp low-width strokes rather than heavy bloom

### Celestial / anomaly

Visual thesis: **deep indigo · aurora ribbons · orbital flora**

- canonical Atlas collection `celestial`, worlds 851–900, takes classification priority
- nebula-like distant gradients
- multicolor star field
- aurora ribbons
- subtle parallax based on Sprid position
- cyan, moss-green and magenta orbital reactions

This fixes the v0.6 visual-QA blind spot where celestial metadata existed in `atlas.collection` and `atlas.scene.*` but the classifier only inspected flattened fields.

## 5. Dynamically reactive scenes

A world should respond to the player rather than behaving like wallpaper.

v0.7 observes safe, read-only gameplay snapshots and produces decorative reactions for:

- resonance casts — color-matched wave emitted from Sprid's gun direction
- damage — brief danger-colored environmental pulse
- Mossglint collection — green/cyan expansion and orbiting motes
- portal opening — large violet/cyan/green world ripple
- movement — restrained footfall/ground response
- player position — low-amplitude foreground and distant parallax

None of these effects can alter collision, hit detection, enemy AI, timers, or scoring.

## 6. Atmosphere grammar

Atmosphere is no longer one generic particle system.

- rain / storm → diagonal rain streaks
- snow / frost → drifting snow crystals
- reef → rising bubbles and caustic bands
- volcanic → upward embers
- celestial → slow colored orbital/star drift
- forest → spores and soft ecological motes

Density is bounded by render quality, with gameplay telegraphs always drawn by the authoritative game renderer.

## 7. Sprid and enemy readability

Sprid remains recognizable before effects:

- bright directional eyes are the highest-contrast facial details
- asymmetric leaf crown survives every palette
- portal gun remains visually detached from the body
- white highlight line improves high-DPI silhouette definition
- gate-ready state gains orbiting Mossglint colors

Enemy polish keeps the v0.6 species silhouettes and adds sharper facial intent:

- blink timing
- directional/high-alert pupils for stalk, swoop and dash patterns
- danger-colored brows for aggressive telegraphs
- faces remain overlays only, so hit radii never change

## 8. Fullscreen and device immersion

There are two fullscreen entry points:

### Portfolio chamber fullscreen

`ArcadePlaySpace` fullscreens the entire Game Network shell. While active:

- site header disappears
- footer and project copy disappear
- chamber border/padding disappear
- iframe fills the physical fullscreen element
- iframe focus is restored automatically
- the neural cursor remains suppressed

The Sylvaria runtime then receives the full viewport and renders its living-world extension around the aspect-safe arena.

### Runtime fullscreen control

Sylvaria also inserts a `FULLSCREEN` button in its run rail for standalone play.

The control uses the browser Fullscreen API when available and a pseudo-fullscreen viewport fallback where it is not. Safe-area CSS accounts for mobile display cutouts.

## 9. Performance budget

The v0.7 performance budget extends rather than replaces the v0.6 quality governor.

### Gameplay render

- authoritative game remains one requestAnimationFrame loop
- gameplay Canvas blur is capped by quality tier
- transform-aware gradient cache remains bounded
- logical physics step remains 60 Hz

### Immersive overlay

- Performance: overlay 24 FPS
- Balanced: overlay 30 FPS
- High: overlay 45 FPS

### Full-device backdrop

- Performance: 12 FPS
- Balanced: 20 FPS
- High: 30 FPS

The distant backdrop deliberately updates more slowly than gameplay. Slow atmospheric motion does not need 60 rasterizations per second, and this protects input/combat responsiveness.

### Particle limits

The scene model owns at most 72 seeded background particles. Per-frame visible atmosphere is capped to:

- Performance: 14
- Balanced: 28
- High: 46

Foreground parallax is disabled in Performance, capped at 7 in Balanced, and capped at 12 in High.

The automatic quality governor can still downshift when sustained FPS falls.

## 10. Color and glow hierarchy

Glow is semantic rather than universal decoration.

1. player aim/eyes and gameplay telegraphs
2. active resonance/projectiles
3. Mossglint and portal readiness
4. portal extraction
5. world ambience

The environment must never become brighter or higher contrast than an immediate gameplay threat. Performance mode dramatically reduces ambient blur before touching gameplay clarity.

## 11. Visual QA matrix

A release is not visually complete because one desktop screenshot looks good.

CI must exercise:

| Surface | Requirement |
| --- | --- |
| 960×640 | native 3:2 playfield, all five real Atlas families |
| widescreen desktop | viewport background fills side extension; playfield stays exactly 3:2 |
| portrait/mobile | world fills vertical extension; playfield stays exactly 3:2; HUD respects safe area |
| DPR 2 | backing Canvas uses 2× internal pixels on capable hardware |
| Performance tier | blur ≤ 1 px; bounded atmosphere; gameplay remains readable |
| Chrome Stable | focus, input, portal, visual layers |
| Chromium | focus, input, portal, visual layers |
| Firefox | focus, input, portal, visual layers |
| WebKit | focus, input, portal, visual layers |
| celestial | an actual `collection === 'celestial'` Atlas world renders as celestial |

Screenshots should be generated from real Atlas scenes, not synthetic palette fixtures.

## 12. Release standard

Sylvaria v0.7 is ready when:

- all 1,000 Atlas worlds remain valid;
- every real world resolves to a visual family;
- all five families are found by the automated Atlas scan;
- no device shape stretches the gameplay field;
- high-DPI rendering does not change input coordinates;
- fullscreen removes portfolio chrome;
- cross-browser focus and keyboard input still pass;
- dedicated gameplay/FPS CI remains green;
- Performance mode remains visually legible;
- visual screenshots show meaningful family-level composition differences, not palette swaps.

The target feeling is not “a Canvas game with a different background.” It is a compact portal expedition whose **world reaches beyond the arena**, while Sprid, targets, enemies and the gate remain crisp enough to read in motion.
