# World Loom 3D Engine

The World Loom is the procedural 3D compilation layer for the PhysioPersona Nature Atlas.

Its job is not to hand-author 900 Three.js scenes. Its job is to translate the renderer-independent `RichNatureWorldDefinition` catalog into deterministic, traversable, performance-bounded 3D scene plans that can be rendered on desktop and promoted into WebXR.

The central rule is:

> The compiler owns world layout. The renderer owns presentation.

A renderer must never decide where the landmark goes, how large the world is, whether a route exists, or which spatial archetype a world uses.

## Runtime pipeline

```text
RichNatureWorldDefinition
        |
        v
  compileWorld3D()
        |
        v
    World3DPlan
        |
        +-- topology / traversal
        +-- anchors / regions / connections
        +-- structures
        +-- instanced scatter recipes
        +-- atmosphere
        +-- lighting
        +-- camera
        +-- world law
        +-- interactions
        +-- budgets
        +-- diagnostics
        |
        v
 WorldLoom3DScene
        |
        +-- desktop orbit view
        +-- native WebXR session handoff
```

`World3DPlan` is intentionally serializable in spirit. Renderer objects, React state, Three.js materials, meshes, cameras and textures do not belong in the plan.

---

# 1. Spatial standard

## Units

**1 Three.js unit = 1 meter. Always.**

No scene is allowed to invent a local scale system.

This makes authored hero scenes, procedural scenes, locomotion, interaction reach, camera placement and XR all comparable.

## Human reference

| Property | Standard |
|---|---:|
| Avatar height | 1.68 m |
| Standing eye height | 1.60 m |
| Seated eye height | 1.20 m |
| Minimum head clearance | 2.15 m |
| Spawn clear radius | 1.50 m |
| Minimum walkable width | 1.25 m |
| Preferred walkable width | 1.80 m |
| Maximum step height | 0.22 m |
| Maximum normal walk slope | 28 degrees |
| Comfortable interaction distance | 1.25 m |
| Maximum intended interaction distance | 2.20 m |
| Interaction height band | 0.35–1.70 m |

Generated worlds must work without jumping. Jumping may later become a game mechanic, but it must never be required by the base scene compiler.

## Pocket-world scale

| Property | Standard |
|---|---:|
| Minimum world radius | 7 m |
| Default world radius | 11 m |
| Maximum normal world radius | 18 m |
| Landmark distance from spawn | 4.5–12 m |
| Preferred landmark silhouette height | >= 3.2 m |

These are deliberately compact spaces. We are building memorable spatial compositions, not kilometers of empty procedural terrain.

---

# 2. Composition standard

Every generated world needs four readable pieces:

1. **Spawn** — safe, quiet, visually legible.
2. **Traversal beat** — something that pulls the eye and body forward.
3. **Landmark** — the primary silhouette and interaction focus.
4. **Destination** — a reason to move beyond the first reveal.

The compiler represents these explicitly as anchors.

A valid world therefore begins with a graph:

```text
spawn -> waypoint -> landmark -> destination
```

More complex worlds may add branches, loops and optional anchors later, but the minimum spine stays inspectable.

## Landmark rule

A landmark must be distinguishable by at least two of:

- silhouette
- height
- emissive value
- color contrast
- motion
- negative space
- framing

Do not make a landmark merely “one more object, but larger.”

## Spawn rule

Nothing solid should intrude into the 1.5 m preferred spawn-clear radius.

The player should begin with:

- stable ground or spatial reference
- an obvious forward composition
- no geometry intersecting the head/body volume
- no rapid motion immediately adjacent to the camera

---

# 3. Spatial archetypes

World Loom currently supports the following high-level topologies:

- `sanctuary`
- `ribbon`
- `archipelago`
- `cathedral`
- `canyon`
- `bowl`
- `spiral`
- `orbit`
- `reef`
- `labyrinth`
- `horizon`
- `inversion`
- `web`
- `tower`
- `fracture`

A biome is not a topology.

A forest can be a cathedral, labyrinth, ribbon, bowl or archipelago. This is how visual variety becomes spatial variety rather than palette swapping.

## Archetype expectations

### Sanctuary

- single legible center
- enclosure without claustrophobia
- landmark framed by perimeter geometry
- good for calm, intimate and ritual worlds

### Ribbon

- clear forward vector
- path curvature should reveal the scene gradually
- never require ambiguous route finding

### Archipelago

- multiple separated masses
- strong negative space
- floating scenery may be non-walkable unless a future locomotion mechanic explicitly supports it

### Cathedral

- vertical rhythm
- repeated columns/spires
- landmark framed by height and symmetry/asymmetry

### Canyon

- constrained lateral movement
- long sightline
- strong reveal at the end of the path

### Bowl

- low central space surrounded by silhouettes
- horizon remains readable

### Spiral

- vertical progression uses <= 0.20 m generated step increments in the base compiler
- no required jumping

### Orbit

- central anchor with secondary forms around it
- environment motion must remain subtle in XR

### Reef

- dense volumetric composition
- clear local floor/reference despite visual depth

### Labyrinth

- branching walls/chambers
- destination graph must remain machine-reachable
- visual landmarks prevent disorientation

### Horizon

- sparse foreground
- large distant silhouette
- lowest enclosure values

### Inversion

- geometry above and below
- stable local floor/reference must remain visible

### Web

- nodes connected by bridges or implied links
- graph readability is part of the visual language

### Tower

- vertical landmark dominates composition
- base traversal remains comfortable even when the tower itself is not climbable

### Fracture

- broken masses imply a previously continuous world
- useful for Fold/Atlas story language

---

# 4. Primitive vocabulary

The base runtime intentionally uses a small procedural vocabulary:

- slab
- column
- arch
- ring
- island
- dome
- shard
- spire
- boulder
- crystal
- canopy
- portal

These primitives are not the final art style. They are the structural alphabet.

Higher fidelity should come from:

- better procedural geometry generators
- shared shader families
- authored hero meshes
- instanced detail modules
- selective textures

not from turning every Atlas entry into bespoke JSX.

## Repetition rule

Four or more repeated decorative objects should normally become one `InstancedMesh` group.

The compiler emits scatter recipes rather than hundreds of React components.

---

# 5. Material standard

Every material belongs to a semantic role:

- ground
- accent
- secondary
- water
- glow
- fog

And a treatment family:

- matte
- soft
- glow
- water
- glass

This keeps palettes renderer-independent and prevents uncontrolled material proliferation.

## Material constraints

- Avoid large numbers of unique materials.
- Prefer shared materials per scatter group.
- Transparency is expensive and visually unstable in layered scenes. Keep transparent layers bounded.
- Do not use metalness merely to create contrast.
- Emissive materials should identify magic, bioluminescence, portals, crystals or focal interactions.
- Ground should remain visually quieter than the landmark.

---

# 6. Lighting standard

Base scenes use a restrained rig:

1. ambient light
2. hemisphere fill
3. one directional key
4. optional landmark point light

No generated world should solve visual hierarchy by adding ten point lights.

## Dynamic-light budget

| Target | Maximum |
|---|---:|
| Mobile | 2 |
| Desktop | 3 |
| WebXR | 2 |

The long-term renderer should increasingly move atmosphere into emissive materials, baked/procedural shading and environment light rather than dynamic lights.

## Shadow rule

- One primary shadow-casting directional light.
- Instanced scenery may cast shadows only where the cost is justified.
- Avoid large high-resolution shadow maps.
- Current base shadow map: 1024 x 1024.

---

# 7. Camera standard

Desktop view is an inspection camera, not the final gameplay camera.

The compiler owns:

- camera position
- target
- FOV
- min/max orbit distance

Typical FOV:

- intimate / normal: ~43 degrees
- panorama / horizon: ~48 degrees

Do not use extreme FOV to make a small scene look larger. Build spatial scale correctly instead.

In WebXR the headset owns the user camera pose. Scene design must therefore remain coherent without relying on a cinematic fixed camera.

---

# 8. WebXR comfort standard

Generated worlds must preserve a stable local reference.

World-law animation is capped to approximately:

- <= 0.16 m translation amplitude
- <= 0.06 rad rotation amplitude

and current procedural motion uses only a fraction of those caps.

Avoid:

- rotating the entire horizon
- fast oscillating floors
- forced camera movement
- sudden scale changes around the viewer
- geometry spawning immediately beside the head
- required jumping
- narrow bridges below 1.25 m unless a future locomotion mode explicitly opts into them

The runtime enables native Three.js WebXR and requests `local-floor`, with optional `bounded-floor` and `hand-tracking` features where supported.

A generated plan exposes an `xrSafe` diagnostic. XR entry should be withheld when compiler errors exist.

---

# 9. Performance budgets

The engine treats WebXR as the most important baseline budget because stereo rendering is less forgiving than desktop preview.

## Mobile

- <= 80 estimated draw calls
- <= 120k visible triangles
- <= 900 instances
- <= 2 dynamic lights
- <= 220 particles

## Desktop

- <= 120 estimated draw calls
- <= 260k visible triangles
- <= 1,800 instances
- <= 3 dynamic lights
- <= 420 particles

## WebXR

- <= 90 estimated draw calls
- <= 180k visible triangles
- <= 1,250 instances
- <= 2 dynamic lights
- <= 280 particles

The current compiler is intentionally far below these ceilings. Headroom is reserved for later hero meshes, interaction effects and richer shaders.

## Performance philosophy

Spend geometry on silhouette.

Spend shader complexity on focal materials.

Spend particles on moments.

Do not spend GPU time uniformly across the entire world.

---

# 10. World laws

Each generated world receives one dominant environmental law:

- stillness
- orbit
- bloom
- echo
- tide
- breath
- gravity-well
- gaze
- harmony
- magnetism
- shadow
- fracture
- reflection
- growth
- constellation

The current runtime implements intentionally restrained visual forms of several laws. The type system includes the larger vocabulary so gameplay systems can grow without changing the scene contract.

## World-law rule

One world should have one dominant law.

Additional interactions can remix that law, but avoid giving every scene five competing gimmicks.

The law should be recognizable within seconds of interaction.

---

# 11. Interaction standard

Base verbs:

- touch
- grab
- place
- connect
- align
- strike
- grow
- collect
- follow
- climb
- glide
- tune

Interactions are compiled against named anchors.

The renderer should not infer gameplay from mesh names or DOM state.

The current first interaction is landmark resonance. Clicking/tapping the landmark triggers the world law visually, giving every generated world a minimal responsive behavior while the larger gameplay system is built.

---

# 12. Physiology boundary

Physiology remains renderer-independent.

The 3D persona currently maps:

- respiration rate -> torso breathing
- cardiac rate -> visible heart pulse
- movement intensity -> idle energy
- explicit mood -> animation energy

These are embodiment effects, not psychological inference.

A future world may let physiology influence atmosphere, but it should remain descriptive and reversible, for example:

```text
respiration -> foliage breathing cadence
cardiac rate -> crystal pulse cadence
movement -> particle energy
```

Do not turn physiological values into persistent personality traits.

---

# 13. Determinism

The same Atlas world must compile to the same scene plan for the same schema version.

Use seeded randomness only.

Do not call `Math.random()` inside the compiler or deterministic scatter generation.

Derived systems should use salted/derived seeds so adding one scatter family does not unexpectedly reroll every unrelated subsystem.

Determinism gives us:

- reproducible bug reports
- stable world identity
- visual regression testing
- replayable procedural layouts
- shareable world recipes later

---

# 14. Validation

`npm run check:world3d` compiles all 900 Atlas worlds.

The audit currently checks:

- exact 900-world corpus
- finite anchor transforms
- finite positive structure transforms
- spawn clearance warnings
- minimum route width
- spawn -> destination graph reachability
- instance budget
- estimated draw-call budget
- particle budget
- XR-safe status

Website CI runs this audit after TypeScript checking and before the production build.

A new generator feature is not complete if only the developer's favorite three scenes still work.

It must survive the corpus.

---

# 15. Development workflow

When adding a new 3D capability:

1. Add or extend the renderer-independent type.
2. Add the rule to the compiler.
3. Keep randomness deterministic.
4. Add a runtime interpretation.
5. Test against deliberately different world families.
6. Run `npm run typecheck`.
7. Run `npm run check:world3d`.
8. Run the production build.
9. Visually inspect representative worlds.
10. Only then add world-specific polish.

## Representative stress worlds

The initial visual review set should include at least:

- redwood / giant forest
- spider silk / web
- sea glass shore
- underwater kelp / reef
- alpine peak
- desert canyon
- glowing mushroom world
- bioluminescent cave
- zen garden
- crystal/geode world
- floating celestial world
- aurora/observatory world

If one compiler cannot make all of those spatially distinct, the vocabulary is still too narrow.

---

# 16. What should remain authored

Procedural generation should not erase art direction.

The following are good candidates for authored modules layered onto a generated plan:

- signature landmark meshes
- creature rigs
- story props
- puzzle mechanisms
- hero shaders
- named architecture
- collection-specific portal language
- narrative encounters

The generator should provide composition and reliable space so authored work is concentrated where visitors notice it.

---

# 17. Next engine milestones

## V0.2 — spatial readability

- connection geometry generated from the anchor graph
- path/bridge visualization
- explicit spawn marker in debug mode
- landmark framing tests
- topology-specific camera framing

## V0.3 — geometry grammar

Add reusable operators:

- stack
- orbit
- bridge
- spiral
- fracture
- taper
- cluster
- growToward
- repeatAlongSpline
- noiseDisplace

These should produce plan data, not mutate Three.js objects directly.

## V0.4 — gameplay runtime

- interaction registry
- proximity and controller targeting
- world-law state machine
- collectibles
- place/connect/align verbs
- completion conditions

## V0.5 — WebXR locomotion

- controller rays
- hand/controller interaction abstraction
- teleport targets generated from walkable regions
- bounded-room comfort behavior
- XR HUD replacement with world-space UI

## V0.6 — World Loom Lab

Developer interface for:

- seed
- archetype
- biome
- world law
- density
- verticality
- enclosure
- landmark
- atmosphere
- instant reweave
- diagnostics
- save/export world recipe

## V1.0 — Living Atlas

A stable procedural universe where selected Atlas entries can be entered in desktop 3D or WebXR, and the same compiler becomes the basis for story worlds, generated side worlds and eventually player-created world recipes.
