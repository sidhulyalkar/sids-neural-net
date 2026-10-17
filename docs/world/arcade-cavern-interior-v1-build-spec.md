# Arcade Cavern Interior V1: The Underground Fandom Fresco

Status: implementation specification, not implemented. Target branch: feat/sequoia-tunnel-skate-loop, draft PR #101. Authored October 17, 2026.

## 1. Experience and art direction

Transform the existing Granite Ridge game cavern into a distinct hand-painted underground hangout, not a rectangular gallery or a wall of streaming cover thumbnails. The room should feel discovered: weathered basalt, layered stencil art, warm lantern pools, occasional cyan/pink/gold reflective inks, improvised sports tributes, fantasy/anime motifs, and adult-animation jokes. Keep the existing arcade playable.

Art-direction title: **SID'S UNDERGROUND / PLAY LOUD**. Composition rule: about 60% natural stone or deliberate negative space, 30% layered matte graffiti, and 10% luminous ink accents. Distinguish broad murals that read at 6-9 m, medium callouts at 2-4 m, and micro-details visible only close up. Use angular hand-cut low-poly/brush contours with carefully constrained palettes, not stock logos and not rectangular show posters.

Graffiti should reference the actual favorites by name or deliberate motif. Design original homage compositions rather than importing frames/official logos or cloning a character's exact model. Team names and series titles may appear as lettering. No web-hosted graphics at runtime.

## 2. Fixed world coordinates and invariants

Existing canonical model lives in lib/world/model.ts:

- Entrance: (x=16, z=-82), outside arrival (16,-86.4).
- Tunnel: z -82 to -63, centered x=16, half-width caveHalfWidth(z), initially 3.8 and widening toward ~6.3.
- Tunnel floor: arcadeCaveFloorHeight({x,z}), not world surface terrainHeight.
- Shell: 17 rings. Per ring, stone faces follow floor, vertical shoulder at +/-halfWidth and inward roof facets. Actual ceiling uses min(floor+6.05, mountainSurfaceHeight(16,z)-0.3).
- Baffle: centered (14.2,-74.5), 4.8 wide by 0.7 deep. The clear bypass is to the EAST (x approximately 18.3-18.65).
- Warm lantern: (16,-67.5), y computed from floor + ceilingClearance - 0.85; one existing point light.
- Three live game targets: left (10.35,-67), center (16,-63.45), right (21.65,-67), each with a 3.6 x 2.65 selection band and its own yaw. Selection and gazing must continue to work.
- Existing teal floor route: (16,-80.65) -> (18.65,-77.1) -> (18.65,-73.0) -> (18.3,-70.0) -> (16,-66.65). Preserve this bypass as the principal navigation cue.

Do not change ARCADE_CAVE coordinates, caveHalfWidth, underground support layers, caveObstacles, game discovery IDs, or the Shasta waiting rules merely to accommodate art.

All mural positions are local parameters on a sampled SHELL surface. The z intervals below are authoring envelopes, not permission to place artwork through the mountain or in the player's path. Bake a safe per-vertex transform using the same ring data used for the cave shell. Maintain a small depth offset inward from the rock (nominal 0.025-0.055 m), clamp height to actual roof, and reject invalid/out-of-bounds placement.

## 3. Curated mural program

| Zone and nominal z | Main statement | Fandom treatment | Palette / hierarchy |
| --- | --- | --- | --- |
| Arrival throat, -81.5 to -76.5 | "PLAY LOUD", little arrows, spray tags, carved "ONE MORE RUN" | Deliberately sparse, no hero character | Charcoal, muted amber, teal; 15-20% area painted |
| Left wall after baffle, -73.4 to -68.1 | **THE HOME STAND** as one continuous fan mural | Chelsea blue with football/lion-inspired negative silhouette, Patriots navy/red star-stripe motion, Warriors gold/blue bridge and basketball swoosh. Painted words CHELSEA / PATRIOTS / WARRIORS are okay; no exact logo dependence | Royal blue -> navy/crimson -> gold. Shared white spray strokes and rim highlights; 1 hero mural with 3 interlocking beats |
| Right throat/corridor, -79 to -74 | **OUT OF THIS WORLD** | Rick and Morty cosmic portal geometry, Futurama orbital city and delivery motifs, Solar Opposites gooey alien devices, then small humorous nods to South Park, Archer, BoJack Horseman, The Boondocks, Brickleberry, American Dad and The League | Acid lime/cyan/violet with thin red/yellow marks. One graphic collage, NOT 9 portraits |
| Right corridor after baffle, -72.8 to -68 | **BEYOND THE PANEL** | Frieren time-rune arc, Fullmetal Alchemist: Brotherhood alchemical rings, Vinland Saga travel/sea marks, Solo Leveling shadow crown, Hell's Paradise floral flame, Demon Slayer slash motif | Desaturated midnight blue/plum, bone ink, warm gold, small electric teal. Larger negative gaps |
| Small anime sports and lighter tags at side corners | **NEXT LEVEL** | Haikyuu!! court/net velocity, Blue Lock soccer target, Spy x Family spy-style stamp, Apothecary Diaries botanic stencil, plus tiny Hunter x Hunter/Overlord/Mashle/Mushoku Tensei identifiers if space permits | High-contrast ink lettering and marks, no crowding of game panels |
| Rear upper band, z about -63 | **SID'S UNDERGROUND** + small **LEVEL SELECT** below | Unifies cave, games, mountain and motion | Warm ivory lettering with blue/gold shadow, controlled magenta accents. Must fit ABOVE the center game interaction rectangle |
| Three game niche PERIMETERS at left/center/right game locations | Individual framing, not posters over the hitboxes | Left = competitive/sports, center = arcade rainbow energy, right = anime/sci-fi experimental. Reuse actual game title glyphs from the runtime | Narrow painted outlines and corner symbols. Do not intersect the invisible selection planes |
| Floor, -80 to -64 | Broken route markings, paint scuffs, little court arcs and skate wheel ticks | Chelsea/Warriors/Patriots color echoes near edges; convergence arrows toward playable niches | Matte and low-luminance. Center travel path remains visually obvious |
| Ceiling, -76 to -65 | Sparse constellation, swirl glyphs, brush-crack highlights | Portal, alchemical rings, laser/star tracers | <=10% painted; do not compete with lantern and game title |

The user's supplied Crunchyroll screenshots and named western series are the selection source. The first build should feature a small curated set of larger references, with additional favorites as micro-tags; do not use fabricated anime preferences or force equal prominence across all titles.

## 4. Composition rules that prevent the "poster tunnel" look

1. All large compositions should bleed across two or more angled facets, with masks, layered spray strokes, partial occlusion by rock and faded peripheral edges.
2. Use a shared graffiti grammar: 3 brush stroke profiles, 2 drip styles, jagged knockout outlines, stenciled words, angular impact marks, and tiny arrows. Art assets are authored, deterministic, reusable procedural geometry or a single small self-hosted atlas when vector lettering needs it.
3. Keep a common basalt base and warm lantern hue behind every palette. Saturation increases as the visitor moves inward; the back wall is a payoff, not another full-color poster stack.
4. Do not add standalone signage objects through the walking lane. Pigment is uncollidable geometry attached to rock, floor or ceiling.
5. Favor intentional asymmetry. Avoid tiled identical symbols and repeated glow halos.
6. No gameplay, camera, pointer, or keyboard action should depend on the decoration being visible.

## 5. Surface atlas and data contracts

New contract module: lib/world/arcadeCavernArtTypes.ts.

    type ArtSurface = "left-wall" | "right-wall" | "rear-wall" |
                      "baffle-face" | "floor" | "ceiling";
    type ArtLayer = "hero" | "mural" | "tag" | "inlay" | "emissive";
    type ArtAnchor = {
      surface: ArtSurface;
      z: number;          // real world longitudinal coordinate, -82..-63
      u: number;          // normalized position along the selected facet
      v: number;          // normalized height/across-facet coordinate
      offset: number;     // nominal 0.025..0.055 m toward the cave air
    };
    type CavernArtMotif = {
      id: string; anchor: ArtAnchor; layer: ArtLayer;
      motif: string; palette: string; scale: number;
      rotation?: number; opacity?: number;
      protectedGame?: 0 | 1 | 2;
    };

Exact Typescript types may evolve during the contract-first task, but semantics and coordinate ownership must remain stable. A shared pure surface sampler must return position, tangent frame, inward-facing normal and validity. It should use arcadeCaveFloorHeight, caveHalfWidth and the ACTUAL shell ring profiles. Invalid material placement is rejected, never silently clamped through the stone.

Per-theme descriptors belong in separate files:
- lib/world/arcadeMuralsSports.ts
- lib/world/arcadeMuralsAnime.ts
- lib/world/arcadeMuralsComedy.ts
- lib/world/arcadeMuralsIdentity.ts

A single registry (lib/world/arcadeCavernArtManifest.ts) concatenates each descriptor group, validates unique IDs, palettes and protected areas, and provides a deterministic ordering. Content data contains no Three.js imports.

Geometry renderer: components/world/worldArcadeGraffitiGeometry.ts with a scene-owned group and dispose() API. It accepts the typed manifest and the shared sampler, produces mesh batches by material/surface, and does not modify the preexisting cave rocks, collision system, controls, or markerObjects selection array. Disable raycasting on every art mesh, including floor accents. Use geometry normals to avoid z-fighting. Do not introduce CSS overlay posters.

## 6. Concrete geometry and lighting budgets

These are implementation targets, to be verified against the current baseline, not claimed measured results:

- Target <= 18 additional draw calls during cavern view, <= 40,000 new triangles, <= 10 shared additional materials; aggregate geometry by surface and palette.
- Optional single 1024x1024 self-hosted art atlas only for lettering/details that are materially better than authored meshes. No remotely fetched images, new heavy font libraries, or unbounded transparent quads.
- Keep the existing warm point light at z=-67.5 as the dominant physical light source. Start with ZERO new real-time point lights; use small restrained emissive paints (matte first) and tune existing light distance/exposure before considering an extra light.
- Emissive cyan/gold/purple should highlight no more than ~10% of ink area. Avoid high-bloom washes, expensive shadows for decals, and continuous animation.
- No collisions from graffiti, no shadows cast by thin decals, no particle simulation or dynamic decals.
- Mobile reduced-quality pass can omit micro-tags and tiny ceiling strokes, not wayfinding or game labels.
- Measure draw calls, heap/triangle counts and cave FPS on the same viewport and browser before/after. Budget breaches must be justified and independently reviewed.

## 7. Player navigation and interaction safe zones

- Hold a continuous >=2.4 m clear floor corridor through the tunnel; particularly preserve the x~18.65 eastern bypass at z=-74.5.
- Preserve >=0.45 m visual clearance around the 3.6x2.65 game interaction bands and their legible glyph titles. Do not put murals in front of the live hit areas or add art to markerObjects.
- At the chamber reveal, framing and lighting should direct visitors to the games before decorative motifs. Game titles and enter prompts must win in contrast and raycast priority.
- Preserve W/A/S/D, caveLayer transitions, Shasta's entrance wait state, sidebar navigation, and mode switches. No new keybindings for art.
- Do not add audio, flashing lights, or rapidly cycling emissive colors in V1. Respect reduced-motion styling and keep informational cues readable without color alone.

## 8. Validation and objective acceptance gates

Deterministic tests:
- Every manifest entry has unique ID, recognized palette, legal surface/zone, finite sample transform, correct normal orientation and bounded depth offset.
- No art crosses the cave wall/roof, walkable corridor, rock baffle, entrance threshold, game hitboxes or live game titles.
- No new cave obstacles, no change in floor support layer, no changes to cave game discovery IDs.
- Deterministic 10-60 FPS movement and camera regressions preserved, including the previously flaky center-panel lateral walk.
- Geometry batching, draw-call and material limits verified with bounded tolerances; dispose() releases new geometries/materials safely.

Real browser screenshots and interaction:
1. Approach from (16,-86.4): original Granite Signal exterior and readable entrance.
2. Entrance throat (~16,-79.7): paint density increases, passage remains obvious.
3. Baffle bypass (~18.5,-73): floor arrows and left/right art visible without blocking the walk.
4. Reveal (~16,-68): all 3 playable game niches visible, lantern pools and sports/anime murals have balanced contrast.
5. Sports mural closeup, anime mural closeup and comedy wall closeup, at normal player eye level.
6. Ceiling/floor overview from within the chamber; no clipping, z-fighting or rectangular art billboards.
7. Click/gaze each of the 3 game targets and return to free roam. Verify readable names, no raycast interception, and no JS/page errors.
8. Complete the existing website World navigation checks; do not dismiss the current Arcade Cavern navigation timeout as unrelated until reproduced and resolved.

Save evidence with stable filenames as GitHub Actions artifacts. Review actual screenshot contents, not just green dataset flags. Use a final manual visual signoff against this spec before merge.

## 9. Release staging and out-of-scope

Stage 1: shared art/geometry contract, sample surface coordinate probes, baseline screenshot captures.
Stage 2: sports, anime, comedy and hero descriptors in separate files.
Stage 3: renderer + floor/ceiling details + restrained lantern treatment.
Stage 4: single integration owner adds the art group to World renderer and links disposal/QA. No parallel edits to worldRenderer.ts.
Stage 5: screenshot-driven polish, CI, full World and skatepark/skim/jet-ski nonregression.
Stage 6: only then mark draft PR ready, after the pre-existing site-wide navigation audit is green.

V1 does NOT implement animated character replicas, complete anime catalogs, texture streaming, chat/in-game editing controls, a redesign of the rock tunnel, additional minigames, or new gameplay collisions.

## 10. Subagent coordination

See docs/world/arcade-cavern-interior-subagent-plan.md for a frozen API, parallel file ownership, dependency graph, branch and PR integration rules, and independent test deliverables. Until an agent is explicitly started on a task, these are planned work packages, not running agents.
