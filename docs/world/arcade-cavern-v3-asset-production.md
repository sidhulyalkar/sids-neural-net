# Arcade Cavern V3: asset-first art direction and acceptance

Status: implementing in draft PR #110, based on open PR #101. **Not final art signoff**.

## Why V2 did not match the visual reference

The previous programmatic art functions `paintComedy`, `paintSports`,
`paintAnime` and `paintConceptStory` created circles, thin strokes,
slogans and simplified character placeholders on 1024x640 canvases.
Conforming geometry cannot make those drawings accurate. The screenshot
also showed an authored 4.8x4.7m grey baffle physically dividing the cave
at (14.2,-74.5), plus corresponding gameplay collision obstacles.

V3 removes the baffle and changes the walking route to a central straight
line. This is a navigational/layout repair, **not** merely hiding a debug
mesh. Keep the game's existing selection targets intact unless a subsequent
explicit arcade-room architectural change moves both the marker geometry
and target world coordinates together.

## Asset-production contract

A completed character mural is a **drawn master image**, not code that
draws a cartoon character from primitives at runtime. The source artwork
requires an actual approved character/portrait reference. Do not invent
the appearance of Shasta or paste the approved 3D screenshot itself onto
the room's wall: it includes perspective, UI and the player avatar.

Assets are registered in `lib/world/arcadeCavernAssetManifest.ts`. Place
approved optimized files under `public/world/arcade-cavern/`. Use
`png`, `webp` or `svg` for the current Three.js TextureLoader pipeline.
Only move to KTX2 when a tested KTX2Loader path is available.

Every completed asset must satisfy:

- Transparent/alpha outer perimeter, no solid rectangular background.
- Clearly illustrated *filled* silhouettes, with bold variable-weight
  contours and physically plausible, not 1px wireframe, brush details.
- Proportions and facial traits compared to an identified approved source.
- Correct typography/logos at normal third-person camera distance.
- Local file path, asset source/author attribution, intended rights/usage.
- Separate emission mask for intentionally luminous **accents**, not whole
  character images. The current V3 loader uses **matte** emission for
  authored assets until such a mask has been vetted.
- Normal and roughness data derived for rock-space blending where useful.
- Screenshots on the *actual angled stone*, not just source raster review.
- No third-party runtime hotlink.

### Priority slots

| Priority | Mural id | Art direction | Status |
| --- | --- | --- | --- |
| 0 | sids-underground | Broad filled, distressed original typographic hero | **Authored SVG integrated** |
| 1 | shasta-mountain-guardian | Actual husky photo-referenced high-res portrait, forest and snow | Source photo / commissioned render required |
| 2 | out-of-this-world | Character-accurate Rick and Morty, Solar Opposites, Futurama, South Park collage | Approved reference/cutouts required |
| 3 | raid-ascend | Dynamic Solo Leveling, JJK, Chainsaw Man, Fire Force, Shangri-La Frontier, Tower of God, Hell's Paradise, Kaiju 8 mural | Approved source/cutouts required |
| 4 | home-stand | Accurate Chelsea, New England Patriots, Golden State Warriors marks | Approved brand artwork required |
| 5 | striker-setpoint | Blue Lock and Haikyu!! energy and sport imagery | Approved source/cutouts required |
| 6 | neuroforge-synapses | Graphic brain anatomy with thicker luminous arcs, real circuit hierarchy | Detailed authored composition pending |

**Do not mark pending murals as authentic finished art.**
The existing Canvas art remains only as an explicit interim fallback, and
randomized filler strokes have been removed.

## Practical visual composition

1. Start with a clear cave **without** wall art and confirm there are no
   medium-grey barriers, exposed rectangular walls, accidental ceiling
   penetrations or obstructed game doors.
2. Establish a primary identity view facing SID'S UNDERGROUND and Shasta.
   This requires real environmental composition, possibly later moving
   the game machines from a dominant rear wall to side-wall alcoves.
3. Create the four secondary *professional mural compositions*, without
   12 tiny equal-sized titles or noisy micro-tag clutter.
4. Project murals with authored UVs onto the existing 17-ring inner
   shell, using projected decals only where they outperform mesh-following
   surfaces. Favor baked surface UVs for major panels and per-face placement
   for sharp turns; do not distort recognizably human faces across 90°
   rock corners.
5. Maintain natural basalt roughness behind all alpha edges. Keep warm
   lantern lighting and controlled selective bloom only for bright accents.

## Pass/fail measurements

- All game markers, return transports and camera behavior still work.
- Walk from x=16, z=-79 to z=-70 with no lateral detour or hidden collider.
- Show front/back and both walls at 1440x900 as real in-game screenshots.
- Hero lettering reads from the default camera with alpha edges, not an
  opaque sign rectangle, mirrored word or detached plane.
- Character and team imagery is only marked COMPLETE when actually
  recognizable and proportionally correct from approved source art.
- No accidental overpaint, random thin scribbles or 1px text clutter.
- Compile, typecheck, lint, browser interaction, texture loading and
  visual review all gate release.
- Keep the PR draft until screenshots are inspected; CI green alone
  is insufficient to claim concept-image fidelity.

## Implementation files

- `components/world/worldRenderer.ts`: world scene / game targets /
  path / lighting. Keep arcade collision and input code here unaffected.
- `lib/world/model.ts`: core cave collision and support.
- `components/world/worldArcadeGraffitiGeometry.ts`: surface UV projection,
  typed loader, selective output and owned GPU resource disposal.
- `components/world/worldArcadeStoneLining.ts`: existing rock-space UVs.
- `components/world/worldArcadeConceptArt.ts`: temporary old painted
  composition methods, *not* an acceptable final character-art authoring tool.
- `lib/world/arcadeCavernAssetManifest.ts`: authored source and provenance.
- `scripts/playtest-arcade-interior.mjs`: screenshots and authored
  asset-runtime assertions.
