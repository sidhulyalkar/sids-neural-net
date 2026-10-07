# Sid’s World — coastal expansion

## Astra master biome specification

For the next major world-expansion tranche, use [astra-world-biome-master-spec.md](astra-world-biome-master-spec.md) as the authoritative design/implementation contract. It supersedes ad-hoc cave/waterfall iterations and defines the island biome map, mountain/cave geometry, snowmelt hydrology, Paper Archive cave, ecology modules, reef quality, rainforest, redwood and desert plans.

## Product contract

A small, optional spatial index into the existing portfolio. One continuous landscape,
seven landmarks, five movement activities, one explorer, Shasta, six selected projects,
three photographic memories, and one quiet surprise. Conventional information is
always reachable without walking. The site does not require sound, a controller,
camera access, an account, or completing a game.

| Place | Role | Existing destination |
| --- | --- | --- |
| Redwood grove | Sid’s background and interests | `/about`, `/resume` |
| Granite overlook | Three engineering projects | `/projects` and real project routes |
| Strange grove | Three research projects; Frontier | `/ideas`, `/frontier` |
| Wild coast | Personal photography | `/photography` |
| Fern falls | Waterfall trail and photographs | `/photography` |
| Moss canyon | Mossy passage and personal background | `/about` |
| Arcade cavern | Stretchicorn feature and all three playable games | `/arcade`, real game routes |

`/` is the new homepage; `/world` is an alias. `/atlas` preserves the original
procedural dendritic homepage. All prior content routes remain intact. World Mode
isolates its input from the decorative cursor and camera/gesture stack.

## Interaction

- **Explore world:** ease from the overview into third-person exploration.
- **Move:** WASD/arrows; click/tap terrain for a destination; drag to orbit; wheel to zoom.
- **Discover:** approach a stone and use the action button or Enter. A nearby stone is also clickable.
- **Jump:** Menu / M → one of seven places. Camera travel preserves a sense of location.
- **Browse:** Menu → direct page links, or View site → the original fractal menu (`/atlas`) on the welcome screen.
- **Pause:** Menu → Pause world; reopen the menu to resume.
- **Leave a panel:** Escape, the close button, or the backdrop. Focus remains in the
  dialog while it is open and returns to the originating control after closing.

Shasta follows the explorer and heads toward the hidden viewpoint when nearby.
Tree trunks block walking and shorten the camera boom before they obscure the explorer.
Terrain and camera boundaries keep the visitor inside the authored patch.

## Content and visual provenance

`lib/world/content.ts` selects six real entries from `data/generated/neural-graph.json`.
Titles and summaries come from that source; the world does not maintain parallel copy.
`MEMORY_POINTS` resolves three records in `src/data/visualArchive.ts`:

- `photo-001`: mountain lake
- `photo-028`: reflective beach at sunset
- `photo-038`: coastal wildflowers

Photos fade into a readable viewer; they are not claimed to be photogrammetric
reconstructions or geographically aligned overlays. No locations or dates are inferred
from the photos. The hidden Shasta image uses the existing optimized `photo-042` asset.
The landscape is an imagined geography, not an asserted record of specific visited places.

The scene is deterministic, generated geometry: coast redwoods, granite silhouettes, terrain,
coast, dendritic plants, explorer, and dog. It adds no model downloads, texture atlases,
physics engine, postprocessing stack, or new production dependencies.

## Runtime boundaries

- Server-rendered identity, links, and no-JavaScript navigation exist before WebGL.
- The scene and Three.js load dynamically. Mobile/coarse-pointer, reduced-motion,
  and Save-Data visitors start with photography and conventional navigation.
- Explicit Explore world opts into animation. Changes to reduced-motion preference stop it.
- Renderer or WebGL context failure returns to the photograph and direct navigation.
  A 15-second scene-readiness timeout prevents an indefinite loading screen.
- Draws stop behind a dialog, when explicitly paused, or when the tab is hidden.
- Input resets on blur/visibility changes; delta time is bounded after stalls.
- DPR starts at at most 1.5 and adapts down to 0.75 under sustained slow frames.
- Shared instanced geometry batches trunks, foliage, grass, rocks, peaks, and waves.
  Distant particles are culled; the static scenery shadow map is rendered once.
- Unmount releases listeners, animation frames, observers, GPU geometry/materials,
  instance buffers, renderer, and context.

This compact world does not need a cell-streaming subsystem. All geometry is small;
only photography and destination content load when requested. The requested sport equipment is procedural and costs no model downloads. No inventory, accounts, or private Frontier personalization.

## Verification and release gate

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm start
# Install Playwright separately, as existing browser audits do:
npm install --prefix /tmp/world-playwright --no-package-lock --no-save playwright@1.55.0
/tmp/world-playwright/node_modules/.bin/playwright install chromium
PLAYWRIGHT_MODULE_ROOT=/tmp/world-playwright/node_modules/playwright node scripts/playtest-world.mjs
```

The browser audit writes screenshots and `report.json` to `artifacts/world` and is
included in Website CI. Override `WORLD_BASE_URL`, `WORLD_AUDIT_DIR`, and optionally
`WORLD_BROWSER_EXECUTABLE` for local environments.

The pure world tests check acceleration/braking, snow transitions, climb routes, collision/bounds, reachable jump destinations,
discovery priority, and resolution to real published project pages/photos. Existing
fractal browser audits now point to `/atlas`; their geometry assertions remain intact.

Desktop **60 FPS**, mobile **30 FPS**, fewer than **100 draw calls**, and an incremental
world JavaScript target below **250 KB gzip** are targets, not all verified claims.
Software Chromium can verify functionality and draw counts but cannot qualify GPU
smoothness. Before promoting the new default homepage, record a 60-second walk on a
hardware-accelerated desktop and physical phone, confirm touch/camera comfort, inspect
all seven places, and review first-load transfer and p95 frame time. See `validation.md`
for measured results and remaining limitations.

Stage-two implementation and acceptance criteria: [stage-2-spec.md](stage-2-spec.md).

## Coastal expansion specification

See [coastal-expansion-spec.md](coastal-expansion-spec.md) for palette provenance,
plant references, all five movement modes, new destinations, and acceptance criteria.
